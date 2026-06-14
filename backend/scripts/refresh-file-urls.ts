/**
 * Manually runs the signed-URL refresh once (the same work the every-5-days
 * cron performs). Re-signs file CloudFront URLs nearing expiry and propagates
 * the new URLs to auction images. Useful for testing without waiting for the
 * scheduled run.
 *
 * Usage:
 *   npm run refresh-file-urls            # default: refresh URLs expiring within 6 days
 *   npm run refresh-file-urls -- --all   # refresh every file regardless of expiry
 */
import mongoose from "mongoose";
import { connectDB } from "../src/config/db.js";
import { refreshExpiringSignedUrls } from "../src/lib/fileUrls.js";

async function main(): Promise<void> {
  await connectDB();

  // --all re-signs everything (effectively an infinite look-ahead window).
  const all = process.argv.includes("--all");
  const aheadMs = all ? Number.MAX_SAFE_INTEGER : 6 * 24 * 60 * 60 * 1000;

  const stats = await refreshExpiringSignedUrls({ aheadMs });
  console.log(
    `Refresh done — scanned ${stats.scanned}, refreshed ${stats.refreshed} file(s), ` +
      `updated ${stats.auctionsUpdated} auction image entr(ies).`
  );

  await mongoose.connection.close();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Refresh failed:", err);
    process.exit(1);
  });
