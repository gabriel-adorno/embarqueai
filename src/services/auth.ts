/**
 * Trocar corpo por supabase.auth.* (Auth e-mail/senha).
 * A sessão real virá do Supabase Auth; não inventar JWT/refresh próprio.
 */
import { EMAIL_ALIASES, MOCK_OTP } from '@/src/lib/ids';
import { APP_MESSAGES } from '@/src/lib/messages';
import { uuid } from '@/src/lib/uuid';
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
  options: { data: { name: string; role: Role; phone?: string } };
}): Promise<AuthResponse> {
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
    next.profiles.push({
      id,
      name: options.data.name,
      email: normalized,
      phone: options.data.phone ?? null,
      role: options.data.role,
    });
    next.credentials.push({
      email: normalized,
      password: password.trim(),
      user_id: id,
    });
  });

  return { data: { user, session: toSession(user) }, error: null };
}

export async function signInWithPassword({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
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
  return { error: null };
}

export async function resetPasswordForEmail(email: string): Promise<{
  data: Record<string, never>;
  error: AuthError;
}> {
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
  type: 'recovery';
}): Promise<AuthResponse> {
  void type;
  const db = await loadDb();
  const normalized = normalizeEmail(email);
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

export async function updateUser({
  password,
}: {
  password: string;
}): Promise<{ data: { user: AuthUser | null }; error: AuthError }> {
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
