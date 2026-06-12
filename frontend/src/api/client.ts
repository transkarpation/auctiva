const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

// Clerk's getToken() — returns the session JWT (or null when signed out).
export type TokenGetter = () => Promise<string | null>;

export async function request<T>(
  getToken: TokenGetter,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  }

  // 204 No Content (delete) has no body.
  return (res.status === 204 ? undefined : await res.json()) as T;
}
