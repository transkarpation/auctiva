import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { auctionsApi, type Auction, type NewAuction } from '../api/auctions';
import { filesApi } from '../api/files';
import { useRealtime } from '../realtime/RealtimeProvider';

// Loads and mutates the signed-in user's auctions.
export function useAuctions() {
  const { getToken } = useAuth();
  const token = useCallback(() => getToken(), [getToken]);
  const { onMessage } = useRealtime();

  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async <T>(action: () => Promise<T>): Promise<T | undefined> => {
      setBusy(true);
      setError(null);
      try {
        return await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong');
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAuctions(await auctionsApi.listMine(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load auctions');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Apply deployment-status changes pushed to the user's personal channel, so an
  // auction flips from "pending" to "deployed"/"failed" the moment the worker
  // finishes — no polling needed.
  useEffect(
    () =>
      onMessage((m) => {
        if (m.type !== 'auction.updated' || typeof m.auctionId !== 'string') return;
        const id = m.auctionId;
        setAuctions((prev) =>
          prev.map((a) =>
            a._id === id
              ? {
                  ...a,
                  deploymentStatus: m.deploymentStatus as Auction['deploymentStatus'],
                  contractAddress:
                    (m.contractAddress as string | undefined) ?? a.contractAddress,
                  deploymentTxHash:
                    (m.deploymentTxHash as string | undefined) ?? a.deploymentTxHash,
                }
              : a,
          ),
        );
      }),
    [onMessage],
  );

  // Fallback safety net: if realtime was unavailable while a deploy completed,
  // poll until nothing is pending so the UI still converges.
  const hasPending = auctions.some((a) => a.deploymentStatus === 'pending');
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => void load(), 10000);
    return () => clearInterval(id);
  }, [hasPending, load]);

  // Create an auction, optionally uploading `images` first (POST /files) and
  // attaching the resulting file ids. Upload + create share one busy/error
  // cycle, so a failed upload surfaces the same way and aborts the create.
  const create = (data: NewAuction, images?: File[]) =>
    run(async () => {
      let imageFileIds = data.imageFileIds;
      if (images?.length) {
        const uploaded = await Promise.all(images.map((f) => filesApi.upload(token, f)));
        imageFileIds = uploaded.map((u) => u.id);
      }
      const created = await auctionsApi.create(token, { ...data, imageFileIds });
      setAuctions((prev) => [created, ...prev]);
      return created;
    });

  // Edit a draft. Like create, optional `images` are uploaded first and replace
  // the auction's images; omit them to leave existing images untouched.
  const update = (id: string, data: Partial<NewAuction>, images?: File[]) =>
    run(async () => {
      let imageFileIds = data.imageFileIds;
      if (images?.length) {
        const uploaded = await Promise.all(images.map((f) => filesApi.upload(token, f)));
        imageFileIds = uploaded.map((u) => u.id);
      }
      const updated = await auctionsApi.update(token, id, { ...data, imageFileIds });
      setAuctions((prev) => prev.map((a) => (a._id === id ? updated : a)));
      return updated;
    });

  // Publish a draft (triggers deployment; status flips to pending).
  const publish = (id: string) =>
    run(async () => {
      const updated = await auctionsApi.publish(token, id);
      setAuctions((prev) => prev.map((a) => (a._id === id ? updated : a)));
      return updated;
    });

  const remove = (id: string) =>
    run(async () => {
      await auctionsApi.remove(token, id);
      setAuctions((prev) => prev.filter((a) => a._id !== id));
    });

  return { auctions, loading, error, busy, create, update, publish, remove };
}
