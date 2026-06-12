import { clerkClient } from "@clerk/express";

// Resolve Clerk user ids -> display names (best-effort; falls back gracefully).
export async function resolveOwnerNames(
  userIds: string[]
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (userIds.length === 0) return names;
  try {
    const res = await clerkClient.users.getUserList({ userId: userIds });
    // Newer SDKs return a paginated { data }, older ones return an array.
    const users = Array.isArray(res) ? res : res.data;
    for (const u of users) {
      const name =
        [u.firstName, u.lastName].filter(Boolean).join(" ") ||
        u.username ||
        u.primaryEmailAddress?.emailAddress ||
        "Unknown user";
      names.set(u.id, name);
    }
  } catch (err) {
    console.error("Failed to resolve owner names:", err);
  }
  return names;
}
