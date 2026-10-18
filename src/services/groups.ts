/** Trocar corpo por supabase.from('groups') / supabase.from('group_members'). */
import { isRemote } from '@/src/lib/config';
import { acceptedPassengerIds } from '@/src/services/follows';
import { uuid } from '@/src/lib/uuid';
import * as remote from '@/src/services/remote';
import { loadDb, mutateDb } from '@/src/services/store';
import { todayInSaoPaulo } from '@/src/lib/day';
import type { Absence, Group, GroupMember, Profile } from '@/src/types/database';

export async function listGroupsForTransporter(
  transporterId: string,
): Promise<Group[]> {
  if (isRemote()) return remote.listGroupsForTransporter(transporterId);
  const db = await loadDb();
  return db.groups.filter((g) => g.transporter_id === transporterId);
}

export async function listGroupsIRide(userId: string): Promise<Group[]> {
  if (isRemote()) {
    const groups = await remote.listGroupsForClient(userId);
    const mine: Group[] = [];
    for (const group of groups) {
      const members = await remote.listGroupMembers(group.id).catch(() => []);
      if (members.some((member) => member.user_id === userId)) mine.push(group);
    }
    return mine;
  }
  const db = await loadDb();
  const ids = db.group_members
    .filter((member) => member.user_id === userId)
    .map((member) => member.group_id);
  return db.groups.filter((group) => ids.includes(group.id));
}

export async function listGroupsForClient(userId: string): Promise<Group[]> {
  if (isRemote()) return remote.listGroupsForClient(userId);
  const db = await loadDb();
  const watched = await acceptedPassengerIds(userId);
  const ids = db.group_members
    .filter((m) => watched.includes(m.user_id))
    .map((m) => m.group_id);
  return db.groups.filter((g) => ids.includes(g.id));
}

export async function deleteGroup(id: string): Promise<void> {
  if (isRemote()) return remote.deleteGroup(id);
  await mutateDb((db) => {
    const live = db.trips.some((trip) => trip.group_id === id && trip.status === 'in_progress');
    if (live) throw new Error('Encerre o trajeto antes de excluir o grupo.');
    const tripIds = db.trips.filter((trip) => trip.group_id === id).map((trip) => trip.id);
    db.trips = db.trips.filter((trip) => trip.group_id !== id);
    db.trip_positions = db.trip_positions.filter((item) => !tripIds.includes(item.trip_id));
    db.boardings = (db.boardings ?? []).filter((item) => !tripIds.includes(item.trip_id));
    db.absences = (db.absences ?? []).filter((item) => item.group_id !== id);
    db.group_members = db.group_members.filter((item) => item.group_id !== id);
    db.groups = db.groups.filter((group) => group.id !== id);
  });
}

export async function getGroup(id: string): Promise<Group | null> {
  if (isRemote()) return remote.getGroup(id);
  const db = await loadDb();
  return db.groups.find((g) => g.id === id) ?? null;
}

export async function createGroup(input: {
  name: string;
  vehicle_id: string;
  route_id?: string | null;
  transporter_id: string;
}): Promise<Group> {
  if (isRemote()) return remote.createGroup(input);
  const group: Group = {
    id: uuid(),
    name: input.name,
    vehicle_id: input.vehicle_id,
    route_id: input.route_id ?? null,
    transporter_id: input.transporter_id,
  };
  await mutateDb((db) => {
    db.groups.push(group);
  });
  return group;
}

export async function listGroupMembers(
  groupId: string,
): Promise<(GroupMember & { profile: Profile })[]> {
  if (isRemote()) return remote.listGroupMembers(groupId);
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
  if (isRemote()) return remote.addGroupMemberByEmail(groupId, email);
  await mutateDb((db) => {
    const profile = db.profiles.find(
      (p) => p.email.toLowerCase() === email.toLowerCase(),
    );
    if (!profile) throw new Error('Nenhum usuário com este e-mail.');
    if (profile.role !== 'client') {
      throw new Error('Apenas passageiros (conta de cliente) podem ser adicionados.');
    }
    const exists = db.group_members.some(
      (m) => m.group_id === groupId && m.user_id === profile.id,
    );
    if (exists) throw new Error('Este passageiro já está no grupo.');
    db.group_members.push({ group_id: groupId, user_id: profile.id });
  });
}

export async function updateGroup(
  id: string,
  input: { name: string; vehicle_id: string },
): Promise<Group> {
  if (isRemote()) return remote.updateGroup(id, input);
  let updated: Group | undefined;
  await mutateDb((db) => {
    const group = db.groups.find((item) => item.id === id);
    if (!group) throw new Error('Grupo não encontrado.');
    group.name = input.name;
    group.vehicle_id = input.vehicle_id;
    updated = group;
  });
  return updated as Group;
}

export async function setMemberPoint(
  groupId: string,
  userId: string,
  pointId: string | null,
): Promise<void> {
  if (isRemote()) return remote.setMemberPoint(groupId, userId, pointId);
  await mutateDb((db) => {
    const member = db.group_members.find(
      (item) => item.group_id === groupId && item.user_id === userId,
    );
    if (!member) throw new Error('Passageiro não está no grupo.');
    member.point_id = pointId;
  });
}

export async function removeGroupMember(
  groupId: string,
  userId: string,
): Promise<void> {
  if (isRemote()) return remote.removeGroupMember(groupId, userId);
  await mutateDb((db) => {
    db.group_members = db.group_members.filter(
      (m) => !(m.group_id === groupId && m.user_id === userId),
    );
  });
}

export async function listAbsences(groupId: string): Promise<Absence[]> {
  if (isRemote()) return remote.listAbsences(groupId);
  const day = todayInSaoPaulo();
  const db = await loadDb();
  return (db.absences ?? []).filter((item) => item.group_id === groupId && item.absent_on === day);
}

export async function setAbsence(groupId: string, userId: string): Promise<void> {
  if (isRemote()) return remote.setAbsence(groupId);
  const day = todayInSaoPaulo();
  await mutateDb((db) => {
    const group = db.groups.find((item) => item.id === groupId);
    if (!group) throw new Error('Grupo não encontrado.');
    const live = db.trips.some(
      (trip) =>
        trip.status === 'in_progress' &&
        (trip.group_id === groupId || (group.route_id && trip.route_id === group.route_id)),
    );
    if (live) throw new Error('A rota já começou. Avise a ausência antes do início.');
    db.absences ??= [];
    const exists = db.absences.some(
      (item) => item.group_id === groupId && item.user_id === userId && item.absent_on === day,
    );
    if (exists) return;
    db.absences.push({
      id: uuid(),
      group_id: groupId,
      user_id: userId,
      absent_on: day,
    });
  });
}

export async function clearAbsence(groupId: string, userId: string): Promise<void> {
  if (isRemote()) return remote.clearAbsence(groupId);
  const day = todayInSaoPaulo();
  await mutateDb((db) => {
    db.absences = (db.absences ?? []).filter(
      (item) =>
        !(item.group_id === groupId && item.user_id === userId && item.absent_on === day),
    );
  });
}
