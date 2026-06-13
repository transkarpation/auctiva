import { request, type TokenGetter } from './client';

export type Notification = {
  _id: string;
  userId: string;
  type: string;
  read: boolean;
  message: string;
  auctionId?: string;
  data?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export const notificationsApi = {
  // The current user's notifications (newest first).
  list: (getToken: TokenGetter) =>
    request<Notification[]>(getToken, '/notifications'),

  // Set a single notification's read state.
  setRead: (getToken: TokenGetter, id: string, read: boolean) =>
    request<Notification>(getToken, `/notifications/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ read }),
    }),

  // Mark all of the user's unread notifications as read.
  markAllRead: (getToken: TokenGetter) =>
    request<{ updated: number }>(getToken, '/notifications/read-all', {
      method: 'PATCH',
    }),

  // Delete a notification.
  remove: (getToken: TokenGetter, id: string) =>
    request<void>(getToken, `/notifications/${id}`, { method: 'DELETE' }),
};
