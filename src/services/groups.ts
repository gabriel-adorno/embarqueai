/** Trocar corpo por supabase.from('groups') / supabase.from('group_members'). */
import { uuid } from '@/src/lib/uuid';
import { loadDb, mutateDb } from '@/src/services/store';
import type { Group, GroupMember, Profile } from '@/src/types/database';

export async function listGroupsForTransporter(
  transporterId: string,
): Promise<Group[]> {
  const db = await loadDb();
  return db.groups.filter((g) => g.transporter_id === transporterId);
}

export async function listGroupsForClient(userId: string): Promise<Group[]> {
  const db = await loadDb();
  const ids = db.group_members
    .filter((m) => m.user_id === userId)
    .map((m) => m.group_id);
  return db.groups.filter((g) => ids.includes(g.id));
}

export async function getGroup(id: string): Promise<Group | null> {
  const db = await loadDb();
  return db.groups.find((g) => g.id === id) ?? null;
}

export async function createGroup(input: {
  name: string;
  vehicle_id: string;
  route_id: string;
  transporter_id: string;
}): Promise<Group> {
  const group: Group = { id: uuid(), ...input };
  await mutateDb((db) => {
    db.groups.push(group);
  });
  return group;
}

export async function listGroupMembers(
  groupId: string,
): Promise<(GroupMember & { profile: Profile })[]> {
  const db = await loadDb();
  return db.group_members
    .filter((m) => m.group_id === groupId)
    .map((m) => {
      const profile = db.profiles.find((p) => p.id === m.user_id);
      if (!profile) throw new Error('Membro sem perfil.');
      return { ...m, profile };
    });
}

export async function addGroupMemberByEmail(
  groupId: string,
  email: string,
): Promise<void> {
  await mutateDb((db) => {
    const profile = db.profiles.find(
      (p) => p.email.toLowerCase() === email.toLowerCase(),
    );
    if (!profile) throw new Error('Nenhum usuário com este e-mail.');
    if (profile.role !== 'client') {
      throw new Error('Apenas clientes podem ser adicionados ao grupo.');
    }
    const exists = db.group_members.some(
      (m) => m.group_id === groupId && m.user_id === profile.id,
    );
    if (exists) throw new Error('Este membro já está no grupo.');
    db.group_members.push({ group_id: groupId, user_id: profile.id });
  });
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
): Promise<void> {
  await mutateDb((db) => {
    db.group_members = db.group_members.filter(
      (m) => !(m.group_id === groupId && m.user_id === userId),
    );
  });
}
