import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import * as authService from '@/src/services/auth';
import { loadDb } from '@/src/services/store';
import type { AuthSession, Role } from '@/src/types/database';

const SESSION_KEY = '@embarqueai/session';

type SessionState = {
  session: AuthSession | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setSession: (session: AuthSession | null) => Promise<void>;
  signOut: () => Promise<void>;
  /** Exclui a conta no servidor e limpa a sessão local. */
  deleteAccount: () => Promise<void>;
};

export const useSessionStore = create<SessionState>((set, get) => ({
  session: null,
  hydrated: false,
  hydrate: async () => {
    const { isRemote } = await import('@/src/lib/config');
    if (!isRemote()) {
      await loadDb();
    }
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    if (!raw) {
      set({ hydrated: true });
      return;
    }
    let session = JSON.parse(raw) as AuthSession;
    set({ session, hydrated: true });
    if (isRemote()) {
      try {
        const { getMyProfile } = await import('@/src/services/remote');
        const me = await getMyProfile();
        if (me?.role) {
          session = {
            ...session,
            user: {
              ...session.user,
              user_metadata: {
                name: me.name || session.user.user_metadata.name,
                role: me.role,
              },
            },
          };
          await get().setSession(session);
        }
      } catch {
        /* keep stored session */
      }
    }
  },
  setSession: async (session) => {
    if (session) {
      await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } else {
      await AsyncStorage.removeItem(SESSION_KEY);
    }
    set({ session });
  },
  deleteAccount: async () => {
    const userId = get().session?.user.id;
    if (!userId) return;
    await authService.deleteAccount(userId);
    // O token já sumiu do banco (cascade); aqui só limpa o registro local.
    const { unregisterPushToken } = await import('@/src/lib/push');
    await unregisterPushToken();
    await get().setSession(null);
  },
  signOut: async () => {
    const { unregisterPushToken } = await import('@/src/lib/push');
    await unregisterPushToken();
    await authService.signOut();
    await get().setSession(null);
  },
}));

export function useRole(): Role | null {
  return useSessionStore((s) => s.session?.user.user_metadata.role ?? null);
}
