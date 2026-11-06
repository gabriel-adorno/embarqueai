import { adminToken, rest } from './supabase';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100;

export type PushMessage = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

type Ticket = { status: 'ok' | 'error'; details?: { error?: string } };

function inList(ids: string[]) {
  return `(${ids.map((id) => encodeURIComponent(id)).join(',')})`;
}

function quotedList(values: string[]) {
  return `(${values.map((v) => encodeURIComponent(`"${v.replace(/"/g, '')}"`)).join(',')})`;
}

function unique(ids: (string | null | undefined)[]) {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

/** Responsáveis que acompanham (aceitos) algum dos passageiros. */
export async function guardiansOf(env: Env, passengerIds: string[]): Promise<string[]> {
  if (!passengerIds.length) return [];
  const rows = await rest<{ guardian_id: string }[]>(
    env,
    adminToken(env),
    'follows',
    `?passenger_id=in.${inList(passengerIds)}&status=eq.accepted&select=guardian_id`,
  );
  return unique((rows ?? []).map((row) => row.guardian_id));
}

/** Passageiros do grupo, sem quem avisou ausência hoje (horário de São Paulo). */
export async function presentMembers(env: Env, groupId: string): Promise<string[]> {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(
    new Date(),
  );
  const [members, absences] = await Promise.all([
    rest<{ user_id: string }[]>(
      env,
      adminToken(env),
      'group_members',
      `?group_id=eq.${groupId}&select=user_id`,
    ),
    rest<{ user_id: string }[]>(
      env,
      adminToken(env),
      'absences',
      `?group_id=eq.${groupId}&absent_on=eq.${today}&select=user_id`,
    ),
  ]);
  const absent = new Set((absences ?? []).map((row) => row.user_id));
  return unique((members ?? []).map((row) => row.user_id)).filter((id) => !absent.has(id));
}

export async function sendPush(env: Env, userIds: string[], message: PushMessage): Promise<void> {
  const ids = unique(userIds);
  if (!ids.length) return;
  const rows = await rest<{ token: string }[]>(
    env,
    adminToken(env),
    'push_tokens',
    `?user_id=in.${inList(ids)}&select=token`,
  );
  const tokens = unique((rows ?? []).map((row) => row.token));
  for (let i = 0; i < tokens.length; i += CHUNK) {
    const batch = tokens.slice(i, i + CHUNK);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(
        batch.map((to) => ({
          to,
          title: message.title,
          body: message.body,
          data: message.data ?? {},
          sound: 'default',
          channelId: 'default',
        })),
      ),
    });
    if (!res.ok) {
      console.warn('push: Expo respondeu', res.status, await res.text());
      continue;
    }
    const json = (await res.json()) as { data?: Ticket[] };
    const dead = (json.data ?? [])
      .map((ticket, index) =>
        ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
          ? batch[index]
          : null,
      )
      .filter((token): token is string => Boolean(token));
    if (dead.length) {
      await rest(env, adminToken(env), 'push_tokens', `?token=in.${quotedList(dead)}`, {
        method: 'DELETE',
      });
    }
  }
}

/** Roda o envio sem atrasar a resposta e sem derrubar a requisição se falhar. */
export function background(
  ctx: { waitUntil: (promise: Promise<unknown>) => void },
  task: () => Promise<void>,
) {
  ctx.waitUntil(
    task().catch((err: unknown) => {
      console.warn('push: falha ao enviar', err instanceof Error ? err.message : err);
    }),
  );
}

export async function saveToken(env: Env, userId: string, token: string, platform: string | null) {
  await rest(env, adminToken(env), 'push_tokens', '?on_conflict=token', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      token,
      user_id: userId,
      platform,
      updated_at: new Date().toISOString(),
    }),
  });
}

export async function removeToken(env: Env, userId: string, token: string) {
  await rest(
    env,
    adminToken(env),
    'push_tokens',
    `?token=eq.${encodeURIComponent(token)}&user_id=eq.${userId}`,
    { method: 'DELETE' },
  );
}
