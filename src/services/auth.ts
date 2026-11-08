/**
 * Trocar corpo por supabase.auth.* (Auth e-mail/senha).
 * A sessão real virá do Supabase Auth; não inventar JWT/refresh próprio.
 */
import { EMAIL_ALIASES, MOCK_OTP } from '@/src/lib/ids';
import { APP_MESSAGES } from '@/src/lib/messages';
import { uuid } from '@/src/lib/uuid';
import { isRemote } from '@/src/lib/config';
import * as remote from '@/src/services/remote';
import { loadDb, mutateDb } from '@/src/services/store';
import type { AuthSession, AuthUser, Role } from '@/src/types/database';

export type AuthError = { message: string; title?: string } | null;

export type AuthResponse = {
  data: { user: AuthUser | null; session: AuthSession | null };
  error: AuthError;
};

function normalizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  return EMAIL_ALIASES[trimmed] ?? trimmed;
}

function toUser(profile: {
  id: string;
  email: string;
  name: string;
  role: Role;
}): AuthUser {
  return {
    id: profile.id,
    email: profile.email,
    user_metadata: { name: profile.name, role: profile.role },
  };
}

function toSession(user: AuthUser): AuthSession {
  return { user, access_token: `sb-mock-${user.id}` };
}

export async function signUp({
  email,
  password,
  options,
}: {
  email: string;
  password: string;
  options: {
    data: { name: string; role: Role; phone?: string; terms_version?: string; terms_accepted_at?: string };
  };
}): Promise<AuthResponse> {
  if (isRemote()) return remote.signUp({ email, password, options });
  const normalized = normalizeEmail(email);
  const db = await loadDb();
  const exists = db.credentials.some((c) => c.email.toLowerCase() === normalized);
  if (exists) {
    return {
      data: { user: null, session: null },
      error: {
        title: APP_MESSAGES.emailTaken.title,
        message: APP_MESSAGES.emailTaken.body,
      },
    };
  }

  const id = uuid();
  const user = toUser({
    id,
    email: normalized,
    name: options.data.name,
    role: options.data.role,
  });

  await mutateDb((next) => {
    next.pending_accounts = (next.pending_accounts ?? []).filter(
      (item) => item.email !== normalized,
    );
    next.pending_accounts.push({
      id,
      email: normalized,
      password: password.trim(),
      name: options.data.name,
      role: options.data.role,
      phone: options.data.phone ?? null,
    });
  });

  return { data: { user, session: null }, error: null };
}

export async function signInWithPassword({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  if (isRemote()) return remote.signInWithPassword({ email, password });
  const db = await loadDb();
  const normalized = normalizeEmail(email);
  const cred = db.credentials.find((c) => c.email.toLowerCase() === normalized);
  if (!cred || cred.password !== password.trim()) {
    return {
      data: { user: null, session: null },
      error: {
        title: APP_MESSAGES.credentialsInvalid.title,
        message: APP_MESSAGES.credentialsInvalid.body,
      },
    };
  }
  const profile = db.profiles.find((p) => p.id === cred.user_id);
  if (!profile) {
    return {
      data: { user: null, session: null },
      error: {
        title: APP_MESSAGES.genericError.title,
        message: 'Perfil não encontrado.',
      },
    };
  }
  const user = toUser(profile);
  return { data: { user, session: toSession(user) }, error: null };
}

export async function signOut(): Promise<{ error: AuthError }> {
  if (isRemote()) return remote.signOut();
  return { error: null };
}

export async function resetPasswordForEmail(email: string): Promise<{
  data: Record<string, never>;
  error: AuthError;
}> {
  if (isRemote()) return remote.resetPasswordForEmail(email);
  const db = await loadDb();
  const normalized = normalizeEmail(email);
  const exists = db.credentials.some((c) => c.email.toLowerCase() === normalized);
  if (!exists) {
    return {
      data: {},
      error: {
        title: APP_MESSAGES.emailNotFound.title,
        message: APP_MESSAGES.emailNotFound.body,
      },
    };
  }
  await mutateDb((next) => {
    next.pending_otp_email = normalized;
  });
  return { data: {}, error: null };
}

export async function verifyOtp({
  email,
  token,
  type,
}: {
  email: string;
  token: string;
  type: 'recovery' | 'signup';
}): Promise<AuthResponse> {
  if (isRemote()) return remote.verifyOtp({ email, token, type });
  const db = await loadDb();
  const normalized = normalizeEmail(email);
  if (type === 'signup') {
    if (token.trim() !== MOCK_OTP) {
      return {
        data: { user: null, session: null },
        error: {
          title: APP_MESSAGES.invalidCode.title,
          message: APP_MESSAGES.invalidCode.body,
        },
      };
    }
    const pending = (db.pending_accounts ?? []).find((item) => item.email === normalized);
    if (!pending) {
      return {
        data: { user: null, session: null },
        error: {
          title: APP_MESSAGES.recoveryExpired.title,
          message: 'Cadastro não encontrado. Crie a conta de novo.',
        },
      };
    }
    const user = toUser(pending);
    await mutateDb((next) => {
      next.profiles.push({
        id: pending.id,
        name: pending.name,
        email: pending.email,
        phone: pending.phone,
        role: pending.role,
      });
      next.credentials.push({
        email: pending.email,
        password: pending.password,
        user_id: pending.id,
      });
      next.pending_accounts = (next.pending_accounts ?? []).filter((item) => item.email !== normalized);
    });
    return { data: { user, session: toSession(user) }, error: null };
  }
  if (db.pending_otp_email !== normalized) {
    return {
      data: { user: null, session: null },
      error: {
        title: APP_MESSAGES.recoveryExpired.title,
        message: APP_MESSAGES.recoveryExpired.body,
      },
    };
  }
  if (token.trim() !== MOCK_OTP) {
    return {
      data: { user: null, session: null },
      error: {
        title: APP_MESSAGES.invalidCode.title,
        message: APP_MESSAGES.invalidCode.body,
      },
    };
  }
  const cred = db.credentials.find((c) => c.email.toLowerCase() === normalized);
  const profile = db.profiles.find((p) => p.id === cred?.user_id);
  if (!profile) {
    return {
      data: { user: null, session: null },
      error: {
        title: APP_MESSAGES.genericError.title,
        message: 'Perfil não encontrado.',
      },
    };
  }
  const user = toUser(profile);
  return { data: { user, session: toSession(user) }, error: null };
}

export async function changePassword(userId: string, password: string): Promise<void> {
  if (isRemote()) {
    const { error } = await remote.updateUser({ password });
    if (error) throw new Error(error.message);
    return;
  }
  await mutateDb((db) => {
    const cred = db.credentials.find((item) => item.user_id === userId);
    if (!cred) throw new Error('Conta não encontrada.');
    cred.password = password.trim();
  });
}

/**
 * Exclui a conta e os dados ligados a ela.
 * Transportador com passageiros nos grupos precisa removê-los antes.
 */
export async function deleteAccount(userId: string): Promise<void> {
  if (isRemote()) return remote.deleteMyAccount();
  await mutateDb((db) => {
    const profile = db.profiles.find((item) => item.id === userId);
    if (!profile) throw new Error('Conta não encontrada.');
    const groupIds = db.groups.filter((g) => g.transporter_id === userId).map((g) => g.id);
    if (db.group_members.some((m) => groupIds.includes(m.group_id))) {
      throw new Error('Remova os passageiros ou exclua seus grupos antes de excluir a conta.');
    }
    const routeIds = db.routes.filter((r) => r.transporter_id === userId).map((r) => r.id);
    const tripIds = db.trips
      .filter((t) => groupIds.includes(t.group_id) || routeIds.includes(t.route_id))
      .map((t) => t.id);
    db.trip_positions = db.trip_positions.filter((p) => !tripIds.includes(p.trip_id));
    db.boardings = db.boardings.filter((b) => !tripIds.includes(b.trip_id) && b.user_id !== userId);
    db.trip_alerts = db.trip_alerts.filter((a) => !tripIds.includes(a.trip_id));
    db.trips = db.trips.filter((t) => !tripIds.includes(t.id));
    db.route_points = db.route_points.filter((p) => !routeIds.includes(p.route_id));
    db.routes = db.routes.filter((r) => r.transporter_id !== userId);
    db.groups = db.groups.filter((g) => g.transporter_id !== userId);
    db.vehicles = db.vehicles.filter((v) => v.transporter_id !== userId);
    db.group_members = db.group_members.filter((m) => m.user_id !== userId);
    db.absences = (db.absences ?? []).filter((a) => a.user_id !== userId);
    db.follows = db.follows.filter((f) => f.guardian_id !== userId && f.passenger_id !== userId);
    db.trip_alert_replies = db.trip_alert_replies.filter((r) => r.user_id !== userId);
    db.credentials = db.credentials.filter((c) => c.user_id !== userId);
    db.profiles = db.profiles.filter((p) => p.id !== userId);
  });
}

export async function updateUser({
  password,
}: {
  password: string;
}): Promise<{ data: { user: AuthUser | null }; error: AuthError }> {
  if (isRemote()) return remote.updateUser({ password });
  const db = await loadDb();
  const email = db.pending_otp_email;
  if (!email) {
    return {
      data: { user: null },
      error: {
        title: APP_MESSAGES.recoveryExpired.title,
        message: APP_MESSAGES.recoveryExpired.body,
      },
    };
  }
  await mutateDb((next) => {
    const cred = next.credentials.find((c) => c.email === email);
    if (cred) cred.password = password.trim();
    next.pending_otp_email = null;
  });
  const profile = db.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase());
  return {
    data: { user: profile ? toUser(profile) : null },
    error: null,
  };
}

export async function getUserById(id: string) {
  const db = await loadDb();
  return db.profiles.find((p) => p.id === id) ?? null;
}
