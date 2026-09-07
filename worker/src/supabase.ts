export type Json = Record<string, unknown> | unknown[] | null;

function headers(env: Env, token: string, extra?: Record<string, string>) {
  return {
    apikey: env.SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export async function authFetch(
  env: Env,
  path: string,
  init: RequestInit & { token?: string } = {},
) {
  const token = init.token ?? env.SUPABASE_ANON_KEY;
  const { token: _t, ...rest } = init;
  void _t;
  return fetch(`${env.SUPABASE_URL}/auth/v1${path}`, {
    ...rest,
    headers: {
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(rest.headers as Record<string, string> | undefined),
    },
  });
}

export async function rest<T>(
  env: Env,
  token: string,
  table: string,
  search: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${env.SUPABASE_URL}/rest/v1/${table}${search}`;
  const res = await fetch(url, {
    ...init,
    headers: headers(env, token, {
      Prefer: 'return=representation',
      ...(init.headers as Record<string, string> | undefined),
    }),
  });
  if (res.status === 204) return null as T;
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `Supabase ${res.status}`);
  }
  if (!text) return null as T;
  return JSON.parse(text) as T;
}

export function adminToken(env: Env) {
  return env.SUPABASE_SERVICE_ROLE_KEY;
}

export type SbUser = {
  id: string;
  email?: string;
  user_metadata?: { name?: string; role?: string };
};

export async function getAuthUser(env: Env, token: string): Promise<SbUser | null> {
  const res = await authFetch(env, '/user', { method: 'GET', token });
  if (!res.ok) return null;
  return (await res.json()) as SbUser;
}
