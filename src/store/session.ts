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
  signOut: async () => {
    await authService.signOut();
    await get().setSession(null);
  },
}));

export function useRole(): Role | null {
  return useSessionStore((s) => s.session?.user.user_metadata.role ?? null);
}
