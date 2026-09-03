/** Trocar corpo por supabase.from('profiles'). */
import { loadDb, mutateDb } from '@/src/services/store';
import type { Profile } from '@/src/types/database';

export async function getProfile(id: string): Promise<Profile | null> {
  const db = await loadDb();
  return db.profiles.find((p) => p.id === id) ?? null;
}

export async function getProfileByEmail(email: string): Promise<Profile | null> {
  const db = await loadDb();
  return (
    db.profiles.find((p) => p.email.toLowerCase() === email.toLowerCase()) ??
    null
  );
}

export async function updateProfile(
  id: string,
  patch: Partial<Pick<Profile, 'name' | 'phone'>>,
): Promise<Profile> {
  let updated: Profile | undefined;
  await mutateDb((db) => {
    const profile = db.profiles.find((p) => p.id === id);
    if (!profile) throw new Error('Perfil não encontrado.');
    Object.assign(profile, patch);
    updated = profile;
  });
  return updated as Profile;
}
