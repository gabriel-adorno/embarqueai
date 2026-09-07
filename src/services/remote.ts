import { api } from '@/src/lib/api';
import type {
  AuthSession,
  AuthUser,
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
  options: { data: { name: string; role: Role; phone?: string } };
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
  type: 'recovery';
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
}): Promise<Vehicle> {
  return first(
    await api<Vehicle | Vehicle[]>('/vehicles', {
      method: 'POST',
      body: JSON.stringify({ type: input.type, plate: input.plate }),
    }),
  );
}

export async function deleteVehicle(id: string): Promise<void> {
  await api(`/vehicles/${id}`, { method: 'DELETE' });
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
}): Promise<Route> {
  return api<Route>('/routes', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name,
      points: input.points,
      group_ids: input.group_ids ?? [],
    }),
  });
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
}): Promise<Trip> {
  return api<Trip>('/trips/start', { method: 'POST', body: JSON.stringify(input) });
}

export async function stopTrip(tripId: string): Promise<Trip> {
  return api<Trip>(`/trips/${tripId}/stop`, { method: 'POST' });
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
