import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { groupsApi, type PublicGroup } from '../api/groups';

// Loads public groups across all users for the Discover view. Selection lives
// in the URL (/discover/:groupId).
export function usePublicGroups() {
  const { getToken } = useAuth();
  const token = useCallback(() => getToken(), [getToken]);

  const [groups, setGroups] = useState<PublicGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGroups(await groupsApi.listPublic(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load public groups');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  return { groups, loading, error, reload: load };
}

export type UsePublicGroups = ReturnType<typeof usePublicGroups>;
