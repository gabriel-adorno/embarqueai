import { api } from '@/src/lib/api';
import type {
  Absence,
  AuthSession,
  Follow,
  ReportSummary,
  TripAlert,
  AuthUser,
  Boarding,
  BoardingStatus,
  Group,
  GroupMember,
  Profile,
  Role,
  Route,
  RoutePoint,
  RouteStatus,
  Trip,
  TripPosition,
  Vehicle,
} from '@/src/types/database';

type AuthError = { message: string; title?: string } | null;
type AuthPayload = {
  data: { user: AuthUser | null; session: { user: AuthUser; access_token: string } | null };
  error: AuthError;
};

function asArray<T>(value: T[] | T | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === 'object' && 'id' in (value as object)) {
    return [value as T];
  }
  return [];
}

function first<T>(value: T | T[] | null | undefined): T {
  if (Array.isArray(value)) {
    if (!value[0]) throw new Error('Resposta vazia da API.');
    return value[0];
  }
  if (!value) throw new Error('Resposta vazia da API.');
  return value;
}

async function withProfileRole(session: AuthSession): Promise<AuthSession> {
  try {
    const me = await api<Profile>('/profile/me', {
      auth: false,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!me?.role) return session;
    return {
      ...session,
      user: {
        ...session.user,
        user_metadata: {
          name: me.name || session.user.user_metadata.name,
          role: me.role,
        },
      },
    };
  } catch {
    return session;
  }
}

let recoveryToken: string | null = null;

export async function signUp(input: {
  email: string;
  password: string;
  options: {
    data: { name: string; role: Role; phone?: string; terms_version?: string; terms_accepted_at?: string };
  };
}): Promise<AuthPayload> {
  const result = await api<AuthPayload>('/auth/sign-up', {
    method: 'POST',
    auth: false,
    allowError: true,
    body: JSON.stringify(input),
  });
  if (result.data?.session) {
    result.data.session = await withProfileRole(result.data.session);
    if (result.data.user) result.data.user = result.data.session.user;
  }
  return result;
}

export async function signInWithPassword(input: {
  email: string;
  password: string;
}): Promise<AuthPayload> {
  const result = await api<AuthPayload>('/auth/sign-in', {
    method: 'POST',
    auth: false,
    allowError: true,
    body: JSON.stringify(input),
  });
  if (result.data?.session) {
    result.data.session = await withProfileRole(result.data.session);
    if (result.data.user) result.data.user = result.data.session.user;
  }
  return result;
}

export async function signOut(): Promise<{ error: AuthError }> {
  try {
    return await api<{ error: AuthError }>('/auth/sign-out', { method: 'POST' });
  } catch {
    return { error: null };
  }
}

export async function resetPasswordForEmail(email: string) {
  return api<{ data: Record<string, never>; error: AuthError }>('/auth/forgot', {
    method: 'POST',
    auth: false,
    allowError: true,
    body: JSON.stringify({ email }),
  });
}

export async function verifyOtp(input: {
  email: string;
  token: string;
  type: 'recovery' | 'signup';
}): Promise<AuthPayload> {
  const result = await api<AuthPayload>('/auth/verify-otp', {
    method: 'POST',
    auth: false,
    allowError: true,
    body: JSON.stringify(input),
  });
  recoveryToken = result.data?.session?.access_token ?? null;
  if (result.data?.session) {
    result.data.session = await withProfileRole(result.data.session);
    if (result.data.user) result.data.user = result.data.session.user;
  }
  return result;
}

export async function updateUser(input: { password: string }) {
  const token = recoveryToken;
  recoveryToken = null;
  return api<{ data: { user: AuthPayload['data']['user'] }; error: AuthError }>(
    '/auth/password',
    {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      allowError: true,
    body: JSON.stringify(input),
    },
  );
}

export async function getMyProfile(): Promise<Profile> {
  return api<Profile>('/profile/me');
}

export async function deleteMyAccount(): Promise<void> {
  await api('/profile/me', { method: 'DELETE' });
}

export async function getProfile(id: string): Promise<Profile | null> {
  if (!id) return null;
  return api<Profile | null>(`/profile/${id}`);
}

export async function updateProfile(
  _id: string,
  patch: Partial<Pick<Profile, 'name' | 'phone'>>,
): Promise<Profile> {
  return api<Profile>('/profile/me', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function listVehicles(_transporterId: string): Promise<Vehicle[]> {
  return asArray(await api<Vehicle[]>('/vehicles'));
}

export async function getVehicle(id: string): Promise<Vehicle | null> {
  if (!id) return null;
  return api<Vehicle | null>(`/vehicles/${id}`);
}

export async function createVehicle(input: {
  transporter_id: string;
  type: string;
  plate: string;
  capacity?: number | null;
  photo?: string | null;
}): Promise<Vehicle> {
  return first(
    await api<Vehicle | Vehicle[]>('/vehicles', {
      method: 'POST',
      body: JSON.stringify({
        type: input.type,
        plate: input.plate,
        capacity: input.capacity ?? null,
        photo: input.photo ?? null,
      }),
    }),
  );
}

export async function deleteVehicle(id: string): Promise<void> {
  await api(`/vehicles/${id}`, { method: 'DELETE' });
}

export async function updateVehicle(
  id: string,
  input: { type: string; plate: string; capacity?: number | null; photo?: string | null },
): Promise<Vehicle> {
  try {
    return first(
      await api<Vehicle | Vehicle[]>(`/vehicles/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    );
  } catch (err) {
    if (isUnsupported(err)) {
      throw new Error('Editar veículo exige a atualização do servidor.');
    }
    throw err;
  }
}

export async function listRoutes(_transporterId: string): Promise<Route[]> {
  return asArray(await api<Route[]>('/routes'));
}

export async function getRoute(id: string): Promise<Route | null> {
  return api<Route | null>(`/routes/${id}`);
}

export async function listRoutePoints(routeId: string): Promise<RoutePoint[]> {
  return asArray(await api<RoutePoint[]>(`/routes/${routeId}/points`));
}

export async function createRoute(input: {
  transporter_id: string;
  name: string;
  points: { name: string; lat: number; lng: number }[];
  group_ids?: string[];
  outbound_time?: string | null;
  return_time?: string | null;
}): Promise<Route> {
  return api<Route>('/routes', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      points: input.points,
      group_ids: input.group_ids ?? [],
      outbound_time: input.outbound_time ?? null,
      return_time: input.return_time ?? null,
    }),
  });
}

export async function updateRoute(
  id: string,
  input: {
    name: string;
    outbound_time?: string | null;
    return_time?: string | null;
    points?: { id?: string; name: string; sort_order: number }[];
    /** Grupos que devem ficar nesta rota; os demais saem dela. */
    group_ids?: string[];
  },
): Promise<Route> {
  return api<Route>(`/routes/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function deleteRoute(id: string): Promise<void> {
  try {
    await api(`/routes/${id}`, { method: 'DELETE' });
  } catch (err) {
    if (isUnsupported(err)) {
      throw new Error('Excluir rota exige a atualização do servidor.');
    }
    throw err;
  }
}

export async function updateRouteStatus(id: string, status: RouteStatus): Promise<Route> {
  return api<Route>(`/routes/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export async function listGroupsForTransporter(_id: string): Promise<Group[]> {
  return asArray(await api<Group[]>('/groups'));
}

export async function listGroupsForClient(_id: string): Promise<Group[]> {
  return asArray(await api<Group[]>('/groups'));
}

export async function updateGroup(
  id: string,
  input: { name: string; vehicle_id: string },
): Promise<Group> {
  return api<Group>(`/groups/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export async function setMemberPoint(
  groupId: string,
  userId: string,
  pointId: string | null,
): Promise<void> {
  await api(`/groups/${groupId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify({ point_id: pointId }),
  });
}

export async function deleteGroup(id: string): Promise<void> {
  try {
    await api(`/groups/${id}`, { method: 'DELETE' });
  } catch (err) {
    if (isUnsupported(err)) {
      throw new Error('Excluir grupo exige a atualização do servidor.');
    }
    throw err;
  }
}

export async function getGroup(id: string): Promise<Group | null> {
  return api<Group | null>(`/groups/${id}`);
}

export async function createGroup(input: {
  name: string;
  vehicle_id: string;
  route_id?: string | null;
  transporter_id: string;
}): Promise<Group> {
  return first(
    await api<Group | Group[]>('/groups', {
      method: 'POST',
      body: JSON.stringify({
        name: input.name,
        vehicle_id: input.vehicle_id,
        route_id: input.route_id ?? null,
      }),
    }),
  );
}

export async function listGroupMembers(
  groupId: string,
): Promise<(GroupMember & { profile: Profile })[]> {
  return asArray(
    await api<(GroupMember & { profile: Profile })[]>(`/groups/${groupId}/members`),
  );
}

export async function addGroupMemberByEmail(groupId: string, email: string): Promise<void> {
  await api(`/groups/${groupId}/members`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function removeGroupMember(groupId: string, userId: string): Promise<void> {
  await api(`/groups/${groupId}/members/${userId}`, { method: 'DELETE' });
}

export async function listAbsences(groupId: string): Promise<Absence[]> {
  try {
    return asArray(await api<Absence[]>(`/groups/${groupId}/absences`));
  } catch (err) {
    if (isUnsupported(err)) return [];
    throw err;
  }
}

export async function listUpcomingAbsences(groupId: string, from: string): Promise<Absence[]> {
  try {
    return asArray(await api<Absence[]>(`/groups/${groupId}/absences?from=${from}`));
  } catch (err) {
    if (isUnsupported(err)) return [];
    throw err;
  }
}

export async function setAbsence(groupId: string, day?: string): Promise<void> {
  try {
    await api(`/groups/${groupId}/absences${day ? `?date=${day}` : ''}`, { method: 'POST' });
  } catch (err) {
    if (isUnsupported(err)) {
      throw new Error('Avisar ausência exige a atualização do servidor.');
    }
    throw err;
  }
}

export async function clearAbsence(groupId: string, day?: string): Promise<void> {
  try {
    await api(`/groups/${groupId}/absences${day ? `?date=${day}` : ''}`, { method: 'DELETE' });
  } catch (err) {
    if (isUnsupported(err)) {
      throw new Error('Avisar ausência exige a atualização do servidor.');
    }
    throw err;
  }
}

export async function listActiveTripForGroup(groupId: string): Promise<Trip | null> {
  return api<Trip | null>(`/trips/active?group_id=${groupId}`);
}

export async function listActiveTripForRoute(routeId: string): Promise<Trip | null> {
  return api<Trip | null>(`/trips/active?route_id=${routeId}`);
}

export async function getTrip(id: string): Promise<Trip | null> {
  return api<Trip | null>(`/trips/${id}`);
}

export async function startTrip(input: {
  route_id: string;
  group_id: string;
  lat: number;
  lng: number;
  leg?: 'outbound' | 'return';
}): Promise<Trip> {
  return api<Trip>('/trips/start', { method: 'POST', body: JSON.stringify(input) });
}

export async function stopTrip(tripId: string): Promise<Trip> {
  return api<Trip>(`/trips/${tripId}/stop`, { method: 'POST' });
}

export async function listMyActiveTrip(): Promise<Trip | null> {
  return api<Trip | null>('/trips/active');
}

export async function listTripHistory(): Promise<Trip[]> {
  return asArray(await api<Trip[]>('/trips/history'));
}

export async function publishTripPosition(
  tripId: string,
  lat: number,
  lng: number,
): Promise<void> {
  await api(`/trips/${tripId}/position`, {
    method: 'POST',
    body: JSON.stringify({ lat, lng }),
  });
}

export async function listBoardings(tripId: string): Promise<Boarding[]> {
  try {
    return asArray(await api<Boarding[]>(`/trips/${tripId}/boardings`));
  } catch (err) {
    if (isUnsupported(err)) return [];
    throw err;
  }
}

export async function setBoarding(
  tripId: string,
  userId: string,
  status: BoardingStatus,
): Promise<void> {
  try {
    await api(`/trips/${tripId}/boardings`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, status }),
    });
  } catch (err) {
    if (isUnsupported(err)) {
      throw new Error('Registrar embarque exige a atualização do servidor.');
    }
    throw err;
  }
}

export async function listAlerts(): Promise<TripAlert[]> {
  try {
    return asArray(await api<TripAlert[]>('/alerts'));
  } catch (err) {
    if (isUnsupported(err)) return [];
    throw err;
  }
}

export async function replyToAlert(alertId: string, message: string): Promise<void> {
  await api(`/alerts/${alertId}/replies`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function sendTripAlert(tripId: string, message: string): Promise<void> {
  await api(`/trips/${tripId}/alerts`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function getReport(): Promise<ReportSummary> {
  return api<ReportSummary>('/reports');
}

export async function listFollows(): Promise<{ watching: Follow[]; watched_by: Follow[] }> {
  const data = await api<{ watching: Follow[]; watched_by: Follow[] }>('/follows');
  return {
    watching: asArray(data?.watching),
    watched_by: asArray(data?.watched_by),
  };
}

export async function requestFollow(email: string): Promise<void> {
  await api('/follows', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function acceptFollow(id: string): Promise<void> {
  await api(`/follows/${id}/accept`, { method: 'POST' });
}

export async function removeFollow(id: string): Promise<void> {
  await api(`/follows/${id}`, { method: 'DELETE' });
}

function isUnsupported(err: unknown) {
  return err instanceof Error && /404|não encontrad/i.test(err.message);
}

export async function getLatestTripPosition(tripId: string): Promise<TripPosition | null> {
  return api<TripPosition | null>(`/trips/${tripId}/position`);
}

export function subscribeTripPosition(
  tripId: string,
  callback: (position: TripPosition) => void,
): () => void {
  const tick = () => {
    void getLatestTripPosition(tripId).then((pos) => {
      if (pos) callback(pos);
    });
  };
  tick();
  const timer = setInterval(tick, 2000);
  return () => clearInterval(timer);
}

export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number }> {
  return api<{ lat: number; lng: number }>('/maps/geocode', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
}

export async function getDirectionsPolyline(
  points: { lat: number; lng: number }[],
): Promise<{ coordinates: { latitude: number; longitude: number }[]; distance_m: number }> {
  const dir = await api<{
    coordinates?: { latitude: number; longitude: number }[];
    distance_m?: number;
  }>('/maps/directions', {
    method: 'POST',
    body: JSON.stringify({ points }),
  });
  return {
    coordinates: Array.isArray(dir?.coordinates) ? dir.coordinates : [],
    distance_m: dir?.distance_m ?? 0,
  };
}
