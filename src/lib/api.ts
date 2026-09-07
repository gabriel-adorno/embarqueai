import { getApiUrl } from '@/src/lib/config';

export async function api<T>(
  path: string,
  init: RequestInit & { auth?: boolean; allowError?: boolean } = {},
): Promise<T> {
  const base = getApiUrl();
  if (!base) throw new Error('API não configurada.');
  const { auth = true, allowError = false, headers, ...rest } = init;
  let token: string | null = null;
  if (auth) {
    const { useSessionStore } = await import('@/src/store/session');
    token = useSessionStore.getState().session?.access_token ?? null;
  }
  const res = await fetch(`${base}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as unknown) : null;
  if (!res.ok && !allowError) {
    const err =
      json && typeof json === 'object' && json !== null && 'error' in json
        ? (json as { error?: { message?: string } }).error
        : undefined;
    throw new Error(err?.message ?? `Falha na API (${res.status}).`);
  }
  return json as T;
}
