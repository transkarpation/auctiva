import { request, type TokenGetter } from './client';

export type CentrifugoCredentials = {
  token: string;
  personalChannel: string;
};

export const realtimeApi = {
  // A short-lived Centrifugo connection token plus the user's personal channel.
  centrifugoToken: (getToken: TokenGetter) =>
    request<CentrifugoCredentials>(getToken, '/realtime/centrifugo-token'),

  // Demo helper: publish a message to the caller's own personal channel.
  notifySelf: (getToken: TokenGetter, message: string) =>
    request<{ ok: true }>(getToken, '/realtime/notify-self', {
      method: 'POST',
      body: JSON.stringify({ message }),
    }),
};
