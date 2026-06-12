import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { auctionsApi, type PublicAuction } from '../api/auctions';

// Loads public auctions across all users for the browse view.
export function usePublicAuctions() {
  const { getToken } = useAuth();
  const token = useCallback(() => getToken(), [getToken]);

  const [auctions, setAuctions] = useState<PublicAuction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAuctions(await auctionsApi.listPublic(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load public auctions');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { auctions, loading, error, reload: load };
}
