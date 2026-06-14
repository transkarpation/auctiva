import { FileModel } from "../models/File.js";
import { AuctionModel } from "../models/Auction.js";
import { signObjectUrl } from "./cloudfront.js";
import { fileStorageEnabled } from "../env.js";
import { logger } from "./logger.js";

const log = logger.child({ component: "url-refresh" });

// Re-signs CloudFront URLs for files whose stored signed URL is close to
// expiring, and propagates each new URL to any auction image that snapshotted
// it. Signed URLs are minted once at upload time, so without this they would
// eventually 403; running this on a cadence shorter than the URL TTL keeps
// every stored URL continuously valid.
export async function refreshExpiringSignedUrls(opts: {
  // Refresh any URL expiring within this window from now (ms). Must exceed the
  // gap between runs so a URL can't lapse between two cron ticks.
  aheadMs: number;
}): Promise<{ scanned: number; refreshed: number; auctionsUpdated: number }> {
  if (!fileStorageEnabled) {
    log.warn("File storage not configured — skipping signed-URL refresh.");
    return { scanned: 0, refreshed: 0, auctionsUpdated: 0 };
  }

  const cutoff = new Date(Date.now() + opts.aheadMs);
  const files = await FileModel.find({ signedUrlExpiresAt: { $lte: cutoff } });

  let refreshed = 0;
  let auctionsUpdated = 0;
  for (const file of files) {
    const signed = signObjectUrl(file.key);
    file.signedUrl = signed.url;
    file.signedUrlExpiresAt = new Date(signed.expiresAt);
    await file.save();
    refreshed++;

    // Update any auction image that froze this file's previous URL.
    const result = await AuctionModel.updateMany(
      { "images.fileId": file._id },
      { $set: { "images.$[img].url": signed.url } },
      { arrayFilters: [{ "img.fileId": file._id }] }
    );
    auctionsUpdated += result.modifiedCount;
  }

  return { scanned: files.length, refreshed, auctionsUpdated };
}
