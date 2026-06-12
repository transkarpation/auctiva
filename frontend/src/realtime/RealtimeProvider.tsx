import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@clerk/react';
import { Centrifuge, type Subscription } from 'centrifuge';
import { realtimeApi } from '../api/realtime';

const CENTRIFUGO_URL =
  import.meta.env.VITE_CENTRIFUGO_URL ?? 'ws://localhost:8000/connection/websocket';

// A message received on the user's personal channel. `type`/`message`/`at`
// match what the backend publishes; extra fields are passed through.
export type PersonalMessage = {
  type?: string;
  message?: string;
  at?: string;
  [key: string]: unknown;
};

type Handler = (msg: PersonalMessage) => void;

type RealtimeContextValue = {
  connected: boolean;
  personalChannel: string | null;
  // Registers a handler for messages on the personal channel; returns an
  // unsubscribe function. Handlers are stored in a ref so subscribing does not
  // re-render or reconnect.
  onMessage: (handler: Handler) => () => void;
};

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) throw new Error('useRealtime must be used within <RealtimeProvider>');
  return ctx;
}

// Holds a single Centrifugo connection for the signed-in user and fans out
// messages from their personal channel ("personal:#<userId>") to subscribers.
// One connection is shared across the app, so mount this once near the root of
// the authenticated tree.
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { isSignedIn, getToken } = useAuth();
  const [connected, setConnected] = useState(false);
  const [personalChannel, setPersonalChannel] = useState<string | null>(null);

  // Keep the latest Clerk getToken without re-creating the client each render.
  const clerkToken = useRef(getToken);
  clerkToken.current = getToken;

  const handlers = useRef<Set<Handler>>(new Set());
  const onMessage = useCallback((handler: Handler) => {
    handlers.current.add(handler);
    return () => {
      handlers.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    if (!isSignedIn) return;

    let cancelled = false;
    let centrifuge: Centrifuge | null = null;
    let sub: Subscription | null = null;

    const fetchToken = () => realtimeApi.centrifugoToken(() => clerkToken.current());

    void (async () => {
      // Initial fetch yields the connection token and the user's own channel.
      const { token, personalChannel: channel } = await fetchToken();
      if (cancelled) return;

      centrifuge = new Centrifuge(CENTRIFUGO_URL, {
        token,
        getToken: async () => (await fetchToken()).token,
      });
      centrifuge.on('connected', () => setConnected(true));
      centrifuge.on('disconnected', () => setConnected(false));

      sub = centrifuge.newSubscription(channel);
      sub.on('publication', (ctx) => {
        const msg = ctx.data as PersonalMessage;
        handlers.current.forEach((h) => h(msg));
      });
      sub.subscribe();

      setPersonalChannel(channel);
      centrifuge.connect();
    })();

    return () => {
      cancelled = true;
      sub?.unsubscribe();
      centrifuge?.disconnect();
      setConnected(false);
      setPersonalChannel(null);
    };
  }, [isSignedIn]);

  return (
    <RealtimeContext.Provider value={{ connected, personalChannel, onMessage }}>
      {children}
    </RealtimeContext.Provider>
  );
}
