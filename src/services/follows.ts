import { isRemote } from '@/src/lib/config';
import { uuid } from '@/src/lib/uuid';
import * as remote from '@/src/services/remote';
import { loadDb, mutateDb } from '@/src/services/store';
import type { Follow, Profile } from '@/src/types/database';

export type FollowLists = {
  watching: Follow[];
  watched_by: Follow[];
};

export async function acceptedPassengerIds(userId: string): Promise<string[]> {
  const db = await loadDb();
  const extra = (db.follows ?? [])
    .filter((item) => item.guardian_id === userId && item.status === 'accepted')
    .map((item) => item.passenger_id);
  return [userId, ...extra];
}

export async function listFollows(userId: string): Promise<FollowLists> {
  if (isRemote()) return remote.listFollows();
  const db = await loadDb();
  const withPerson = (row: Follow, personId: string): Follow => ({
    ...row,
    person: db.profiles.find((profile) => profile.id === personId),
  });
  return {
    watching: (db.follows ?? [])
      .filter((item) => item.guardian_id === userId)
      .map((item) => withPerson(item, item.passenger_id)),
    watched_by: (db.follows ?? [])
      .filter((item) => item.passenger_id === userId)
      .map((item) => withPerson(item, item.guardian_id)),
  };
}

export async function requestFollow(userId: string, email: string): Promise<void> {
  if (isRemote()) return remote.requestFollow(email);
  await mutateDb((db) => {
    const passenger = db.profiles.find(
      (profile) => profile.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!passenger) throw new Error('Nenhum usuário com este e-mail.');
    if (passenger.id === userId) throw new Error('Use o e-mail de outra pessoa.');
    if (passenger.role !== 'client') throw new Error('Só é possível acompanhar um passageiro.');
    db.follows ??= [];
    const exists = db.follows.some(
      (item) => item.guardian_id === userId && item.passenger_id === passenger.id,
    );
    if (exists) throw new Error('Este convite já existe.');
    db.follows.push({
      id: uuid(),
      guardian_id: userId,
      passenger_id: passenger.id,
      status: 'pending',
      created_at: new Date().toISOString(),
    });
  });
}

export async function acceptFollow(userId: string, id: string): Promise<void> {
  if (isRemote()) return remote.acceptFollow(id);
  await mutateDb((db) => {
    const row = (db.follows ?? []).find((item) => item.id === id && item.passenger_id === userId);
    if (!row) throw new Error('Convite não encontrado.');
    row.status = 'accepted';
  });
}

export async function removeFollow(id: string): Promise<void> {
  if (isRemote()) return remote.removeFollow(id);
  await mutateDb((db) => {
    db.follows = (db.follows ?? []).filter((item) => item.id !== id);
  });
}

export function personName(person: Profile | undefined, fallback: string) {
  return person?.name || fallback;
}
