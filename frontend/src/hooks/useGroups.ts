import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { groupsApi, type Group as TodoGroup } from '../api/groups';

// Loads and mutates the signed-in user's groups. Selection now lives in the URL
// (/tasks/:groupId), so this hook only owns the data, not the active group.
export function useGroups() {
  const { getToken } = useAuth();
  const token = useCallback(() => getToken(), [getToken]);

  const [groups, setGroups] = useState<TodoGroup[]>([]);
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
      setGroups(await groupsApi.list(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Returns the created group (or undefined on failure) so the caller can navigate.
  const addGroup = (name: string) =>
    run(async () => {
      const created = await groupsApi.create(token, name.trim());
      setGroups((prev) => [created, ...prev]);
      return created;
    });

  const renameGroup = (id: string, name: string) =>
    run(async () => {
      const updated = await groupsApi.update(token, id, { name: name.trim() });
      setGroups((prev) => prev.map((g) => (g._id === id ? updated : g)));
      return updated;
    });

  const toggleGroupPublic = (group: TodoGroup) =>
    run(async () => {
      const updated = await groupsApi.update(token, group._id, {
        isPublic: !group.isPublic,
      });
      setGroups((prev) => prev.map((g) => (g._id === group._id ? updated : g)));
    });

  const deleteGroup = (id: string) =>
    run(async () => {
      await groupsApi.remove(token, id);
      setGroups((prev) => prev.filter((g) => g._id !== id));
    });

  return {
    groups,
    loading,
    error,
    busy,
    addGroup,
    renameGroup,
    toggleGroupPublic,
    deleteGroup,
  };
}

export type UseGroups = ReturnType<typeof useGroups>;
