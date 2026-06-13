import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@clerk/react';
import { notificationsApi, type Notification } from '../api/notifications';
import { useRealtime } from '../realtime/RealtimeProvider';

// Loads the signed-in user's notifications, keeps them live via the personal
// realtime channel, and exposes read/delete mutations (applied optimistically).
export function useNotifications() {
  const { getToken } = useAuth();
  const token = useCallback(() => getToken(), [getToken]);
  const { onMessage } = useRealtime();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setNotifications(await notificationsApi.list(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live: the backend pushes new notifications to the personal channel carrying
  // their stored id. Prepend them (deduped) so the bell updates without polling.
  useEffect(
    () =>
      onMessage((m) => {
        if (m.type !== 'notification' || typeof m.notificationId !== 'string') return;
        const id = m.notificationId;
        const incoming: Notification = {
          _id: id,
          userId: '',
          type: typeof m.notificationType === 'string' ? m.notificationType : 'bid.placed',
          read: false,
          message: typeof m.message === 'string' ? m.message : '',
          auctionId: typeof m.auctionId === 'string' ? m.auctionId : undefined,
          createdAt: m.at ?? new Date().toISOString(),
          updatedAt: m.at ?? new Date().toISOString(),
        };
        setNotifications((prev) =>
          prev.some((n) => n._id === id) ? prev : [incoming, ...prev],
        );
      }),
    [onMessage],
  );

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markRead = useCallback(
    async (id: string) => {
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n)),
      );
      try {
        await notificationsApi.setRead(token, id, true);
      } catch {
        void load(); // re-sync on failure
      }
    },
    [token, load],
  );

  const markAllRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await notificationsApi.markAllRead(token);
    } catch {
      void load();
    }
  }, [token, load]);

  const remove = useCallback(
    async (id: string) => {
      setNotifications((prev) => prev.filter((n) => n._id !== id));
      try {
        await notificationsApi.remove(token, id);
      } catch {
        void load();
      }
    },
    [token, load],
  );

  return {
    notifications,
    unreadCount,
    loading,
    error,
    reload: load,
    markRead,
    markAllRead,
    remove,
  };
}
