/**
 * Backfills the `users` collection from Clerk for every userId already
 * referenced by existing groups/todos/auctions. The Clerk webhook keeps users
 * in sync going forward; this one-time script captures users that existed
 * before webhook persistence was added.
 *
 * Usage:
 *   npm run backfill-users
 */
import mongoose from "mongoose";
import { clerkClient } from "@clerk/express";
import { connectDB } from "../src/config/db.js";
import { UserModel } from "../src/models/User.js";
import { GroupModel } from "../src/models/Group.js";
import { TodoModel } from "../src/models/Todo.js";
import { AuctionModel } from "../src/models/Auction.js";

async function main(): Promise<void> {
  await connectDB();

  // Gather distinct Clerk user ids referenced anywhere in the data.
  const ids = new Set<string>();
  for (const Model of [GroupModel, TodoModel, AuctionModel]) {
    const distinct = (await Model.distinct("userId")) as string[];
    distinct.forEach((id) => id && ids.add(id));
  }
  const userIds = [...ids];
  console.log(`Found ${userIds.length} distinct userId(s) referenced in data.`);
  if (userIds.length === 0) {
    await mongoose.connection.close();
    return;
  }

  // Clerk's getUserList accepts a batch of ids (max 100 here to stay well under
  // limits). Map each Clerk user (camelCase SDK shape) into our schema.
  let upserted = 0;
  for (let i = 0; i < userIds.length; i += 100) {
    const chunk = userIds.slice(i, i + 100);
    const res = await clerkClient.users.getUserList({ userId: chunk, limit: 100 });
    const users = Array.isArray(res) ? res : res.data;
    for (const u of users) {
      const primaryEmail =
        u.emailAddresses?.find((e) => e.id === u.primaryEmailAddressId)
          ?.emailAddress ?? u.emailAddresses?.[0]?.emailAddress;
      await UserModel.findOneAndUpdate(
        { clerkId: u.id },
        {
          clerkId: u.id,
          email: primaryEmail,
          firstName: u.firstName ?? undefined,
          lastName: u.lastName ?? undefined,
          username: u.username ?? undefined,
          imageUrl: u.imageUrl ?? undefined,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
      upserted++;
    }
  }

  console.log(`Upserted ${upserted} user(s) into the users collection.`);

  const missing = userIds.length - upserted;
  if (missing > 0) {
    console.warn(
      `${missing} referenced userId(s) were not found in Clerk (deleted accounts?).`
    );
  }

  await mongoose.connection.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  });
