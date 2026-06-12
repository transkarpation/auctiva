import mongoose from "mongoose";
import { env } from "../env.js";

export async function connectDB(): Promise<void> {
  mongoose.connection.on("connected", () => {
    console.log("MongoDB connected");
  });
  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  await mongoose.connect(env.mongoUri);
}
