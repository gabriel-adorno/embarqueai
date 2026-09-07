import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

import { interpolatePath, type LatLng } from './geo';
import { directions, geocodeAddress } from './maps';
import {
  adminToken,
  authFetch,
  getAuthUser,
  rest,
  type SbUser,
} from './supabase';

type Role = 'client' | 'transporter';

type Profile = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
};

type Vehicle = {
  id: string;
  transporter_id: string;
  type: string;
  plate: string;
};

type RouteRow = {
  id: string;
  transporter_id: string;
  name: string;
  status: 'draft' | 'active' | 'stopped';
};

type RoutePoint = {
  id: string;
  route_id: string;
  name: string;
  lat: number;
  lng: number;
  sort_order: number;
};

type Group = {
  id: string;
  name: string;
  vehicle_id: string;
  route_id: string | null;
  transporter_id: string;
};

type Trip = {
  id: string;
  route_id: string;
  group_id: string;
  started_at: string;
  ended_at: string | null;
  status: 'in_progress' | 'ended';
  polyline: LatLng[];
};

const TRIP_MS = 12 * 60 * 1000;

const app = new Hono<{ Bindings: Env; Variables: { token: string; user: SbUser; profile: Profile } }>();

app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.onError((err, c) => {
  const message = err instanceof Error ? err.message : 'Erro interno.';
  const status = (err instanceof HTTPException ? err.status : 500) as 400 | 401 | 403 | 404 | 500;
  return c.json({ error: { message } }, status);
});

app.get('/health', (c) => c.json({ ok: true }));

function bearer(c: { req: { header: (name: string) => string | undefined } }) {
  const header = c.req.header('Authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new HTTPException(401, { message: 'Não autenticado.' });
  return token;
}

// --- Auth ---

app.post('/auth/sign-up', async (c) => {
  const body = await c.req.json<{
    email: string;
    password: string;
    options?: { data?: { name?: string; role?: Role; phone?: string } };
  }>();
  const res = await authFetch(c.env, '/signup', {
    method: 'POST',
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      data: body.options?.data ?? {},
    }),
  });
  const json = (await res.json()) as {
    error?: string | { message?: string };
    msg?: string;
    user?: SbUser;
    session?: { access_token: string; user: SbUser } | null;
    access_token?: string;
  };
  if (!res.ok) {
    return c.json(
      { data: { user: null, session: null }, error: { message: authMessage(json) } },
      400,
    );
  }
  const session = await toSessionWithProfile(c.env, json);
  return c.json({ data: { user: session?.user ?? mapUser(json.user), session }, error: null });
});

app.post('/auth/sign-in', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>();
  const res = await authFetch(c.env, '/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: body.email, password: body.password }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return c.json(
      {
        data: { user: null, session: null },
        error: { message: authMessage(json), title: 'Não foi possível entrar' },
      },
      400,
    );
  }
  const session = await toSessionWithProfile(c.env, json);
  return c.json({ data: { user: session?.user ?? null, session }, error: null });
});

app.post('/auth/sign-out', async (c) => {
  const token = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (token) {
    await authFetch(c.env, '/logout', { method: 'POST', token });
  }
  return c.json({ error: null });
});

app.post('/auth/forgot', async (c) => {
  const body = await c.req.json<{ email: string }>();
  const res = await authFetch(c.env, '/recover', {
    method: 'POST',
    body: JSON.stringify({ email: body.email }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    return c.json({ data: {}, error: { message: authMessage(json) } }, 400);
  }
  return c.json({ data: {}, error: null });
});

app.post('/auth/verify-otp', async (c) => {
  const body = await c.req.json<{ email: string; token: string; type: string }>();
  const res = await authFetch(c.env, '/verify', {
    method: 'POST',
    body: JSON.stringify({
      email: body.email,
      token: body.token,
      type: body.type === 'recovery' ? 'recovery' : 'email',
    }),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    return c.json(
      { data: { user: null, session: null }, error: { message: authMessage(json) } },
      400,
    );
  }
  const session = await toSessionWithProfile(c.env, json);
  return c.json({ data: { user: session?.user ?? null, session }, error: null });
});

app.post('/auth/password', async (c) => {
  const token = bearer(c);
  const body = await c.req.json<{ password: string }>();
  const res = await authFetch(c.env, '/user', {
    method: 'PUT',
    token,
    body: JSON.stringify({ password: body.password }),
  });
  const json = (await res.json()) as { user?: SbUser; error?: unknown };
  if (!res.ok) {
    return c.json({ data: { user: null }, error: { message: authMessage(json) } }, 400);
  }
  return c.json({ data: { user: mapUser(json.user) }, error: null });
});

// --- Authed middleware ---

const gated = new Hono<{
  Bindings: Env;
  Variables: { token: string; user: SbUser; profile: Profile };
}>();

gated.use('*', async (c, next) => {
  const token = bearer(c);
  const user = await getAuthUser(c.env, token);
  if (!user) throw new HTTPException(401, { message: 'Sessão inválida.' });
  const rows = await rest<Profile[]>(
    c.env,
    token,
    'profiles',
    `?id=eq.${user.id}&select=*`,
  );
  const profile = rows[0];
  if (!profile) throw new HTTPException(403, { message: 'Perfil não encontrado.' });
  c.set('token', token);
  c.set('user', user);
  c.set('profile', profile);
  await next();
});

gated.get('/profile/me', (c) => c.json(c.get('profile')));

gated.patch('/profile/me', async (c) => {
  const token = c.get('token');
  const profile = c.get('profile');
  const body = await c.req.json<{ name?: string; phone?: string }>();
  const rows = await rest<Profile[]>(c.env, token, 'profiles', `?id=eq.${profile.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: body.name, phone: body.phone ?? null }),
  });
  return c.json(rows[0]);
});

gated.get('/profile/:id', async (c) => {
  const rows = await rest<Profile[]>(
    c.env,
    c.get('token'),
    'profiles',
    `?id=eq.${c.req.param('id')}&select=*`,
  );
  return c.json(rows[0] ?? null);
});

gated.get('/vehicles', async (c) => {
  const me = c.get('profile');
  const query =
    me.role === 'transporter'
      ? `?transporter_id=eq.${me.id}&select=*`
      : '?select=*';
  const rows = await rest<Vehicle[]>(c.env, c.get('token'), 'vehicles', query);
  return c.json(Array.isArray(rows) ? rows : []);
});

gated.get('/vehicles/:id', async (c) => {
  const rows = await rest<Vehicle[]>(
    c.env,
    c.get('token'),
    'vehicles',
    `?id=eq.${c.req.param('id')}`,
  );
  return c.json(Array.isArray(rows) ? (rows[0] ?? null) : rows);
});

gated.post('/vehicles', async (c) => {
  const me = c.get('profile');
  requireTransporter(me);
  const body = await c.req.json<{ type: string; plate: string }>();
  const rows = await rest<Vehicle[]>(c.env, c.get('token'), 'vehicles', '', {
    method: 'POST',
    body: JSON.stringify({
      transporter_id: me.id,
      type: body.type,
      plate: body.plate.toUpperCase(),
    }),
  });
  const vehicle = Array.isArray(rows) ? rows[0] : (rows as unknown as Vehicle);
  if (!vehicle) throw new HTTPException(500, { message: 'Não foi possível cadastrar a van.' });
  return c.json(vehicle);
});

gated.delete('/vehicles/:id', async (c) => {
  requireTransporter(c.get('profile'));
  await rest(c.env, c.get('token'), 'vehicles', `?id=eq.${c.req.param('id')}`, {
    method: 'DELETE',
  });
  return c.json({ ok: true });
});

gated.get('/routes', async (c) => {
  const me = c.get('profile');
  if (me.role === 'client') {
    const members = await rest<{ group_id: string }[]>(
      c.env,
      c.get('token'),
      'group_members',
      `?user_id=eq.${me.id}`,
    );
    const groupIds = (Array.isArray(members) ? members : []).map((m) => m.group_id);
    if (groupIds.length === 0) return c.json([]);
    const groups = await rest<Group[]>(
      c.env,
      c.get('token'),
      'groups',
      `?id=in.(${groupIds.join(',')})`,
    );
    const routeIds = [
      ...new Set(
        (Array.isArray(groups) ? groups : [])
          .map((g) => g.route_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    if (routeIds.length === 0) return c.json([]);
    const rows = await rest<RouteRow[]>(
      c.env,
      c.get('token'),
      'routes',
      `?id=in.(${routeIds.join(',')})`,
    );
    return c.json(Array.isArray(rows) ? rows : []);
  }
  const rows = await rest<RouteRow[]>(
    c.env,
    c.get('token'),
    'routes',
    `?transporter_id=eq.${me.id}&select=*`,
  );
  return c.json(Array.isArray(rows) ? rows : []);
});

gated.get('/routes/:id/points', async (c) => {
  const rows = await rest<RoutePoint[]>(
    c.env,
    c.get('token'),
    'route_points',
    `?route_id=eq.${c.req.param('id')}&order=sort_order.asc`,
  );
  return c.json(Array.isArray(rows) ? rows : []);
});

gated.get('/routes/:id', async (c) => {
  const rows = await rest<RouteRow[]>(
    c.env,
    c.get('token'),
    'routes',
    `?id=eq.${c.req.param('id')}`,
  );
  return c.json(rows[0] ?? null);
});

gated.post('/routes', async (c) => {
  const me = c.get('profile');
  requireTransporter(me);
  const body = await c.req.json<{
    name: string;
    points: { name: string; lat?: number; lng?: number }[];
    group_ids?: string[];
  }>();
  const groupIds = body.group_ids?.filter(Boolean) ?? [];
  if (groupIds.length === 0) {
    throw new HTTPException(400, { message: 'Selecione pelo menos um grupo.' });
  }
  const points = [];
  for (const point of body.points) {
    const coords =
      point.lat != null && point.lng != null
        ? { lat: point.lat, lng: point.lng }
        : await geocodeAddress(c.env, point.name);
    points.push({ name: point.name, ...coords });
  }
  const routes = await rest<RouteRow[]>(c.env, c.get('token'), 'routes', '', {
    method: 'POST',
    body: JSON.stringify({
      transporter_id: me.id,
      name: body.name,
      status: 'draft',
    }),
  });
  const route = routes[0];
  await rest(c.env, c.get('token'), 'route_points', '', {
    method: 'POST',
    body: JSON.stringify(
      points.map((p, i) => ({
        route_id: route.id,
        name: p.name,
        lat: p.lat,
        lng: p.lng,
        sort_order: i,
      })),
    ),
  });
  for (const groupId of groupIds) {
    const owned = await rest<Group[]>(
      c.env,
      c.get('token'),
      'groups',
      `?id=eq.${groupId}&transporter_id=eq.${me.id}`,
    );
    if (!owned[0]) {
      throw new HTTPException(400, { message: 'Grupo inválido.' });
    }
    await rest(c.env, c.get('token'), 'groups', `?id=eq.${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify({ route_id: route.id }),
    });
  }
  return c.json(route);
});

gated.patch('/routes/:id/status', async (c) => {
  requireTransporter(c.get('profile'));
  const body = await c.req.json<{ status: RouteRow['status'] }>();
  const rows = await rest<RouteRow[]>(
    c.env,
    c.get('token'),
    'routes',
    `?id=eq.${c.req.param('id')}`,
    { method: 'PATCH', body: JSON.stringify({ status: body.status }) },
  );
  return c.json(rows[0]);
});

gated.get('/groups', async (c) => {
  const me = c.get('profile');
  const query =
    me.role === 'transporter'
      ? `?transporter_id=eq.${me.id}&select=*`
      : '?select=*';
  const rows = await rest<Group[]>(c.env, c.get('token'), 'groups', query);
  return c.json(Array.isArray(rows) ? rows : []);
});

gated.get('/groups/:id', async (c) => {
  const rows = await rest<Group[]>(
    c.env,
    c.get('token'),
    'groups',
    `?id=eq.${c.req.param('id')}`,
  );
  return c.json(rows[0] ?? null);
});

gated.post('/groups', async (c) => {
  const me = c.get('profile');
  requireTransporter(me);
  const body = await c.req.json<{
    name: string;
    vehicle_id: string;
    route_id?: string | null;
  }>();
  const rows = await rest<Group[]>(c.env, c.get('token'), 'groups', '', {
    method: 'POST',
    body: JSON.stringify({
      name: body.name,
      vehicle_id: body.vehicle_id,
      route_id: body.route_id || null,
      transporter_id: me.id,
    }),
  });
  const group = Array.isArray(rows) ? rows[0] : (rows as unknown as Group);
  if (!group) throw new HTTPException(500, { message: 'Não foi possível criar o grupo.' });
  return c.json(group);
});

gated.get('/groups/:id/members', async (c) => {
  const members = await rest<{ group_id: string; user_id: string }[]>(
    c.env,
    c.get('token'),
    'group_members',
    `?group_id=eq.${c.req.param('id')}`,
  );
  const result = [];
  for (const member of members) {
    const profiles = await rest<Profile[]>(
      c.env,
      c.get('token'),
      'profiles',
      `?id=eq.${member.user_id}`,
    );
    if (!profiles[0]) throw new HTTPException(500, { message: 'Membro sem perfil.' });
    result.push({ ...member, profile: profiles[0] });
  }
  return c.json(result);
});

gated.post('/groups/:id/members', async (c) => {
  requireTransporter(c.get('profile'));
  const groupId = c.req.param('id');
  const body = await c.req.json<{ email: string }>();
  const found = await rest<Profile[]>(
    c.env,
    adminToken(c.env),
    'profiles',
    `?email=eq.${encodeURIComponent(body.email.trim().toLowerCase())}`,
  );
  const profile = found[0];
  if (!profile) throw new HTTPException(400, { message: 'Nenhum usuário com este e-mail.' });
  if (profile.role !== 'client') {
    throw new HTTPException(400, { message: 'Apenas alunos (conta de cliente) podem ser adicionados.' });
  }
  try {
    await rest(c.env, c.get('token'), 'group_members', '', {
      method: 'POST',
      body: JSON.stringify({ group_id: groupId, user_id: profile.id }),
    });
  } catch (err) {
    const text = err instanceof Error ? err.message : '';
    if (text.includes('duplicate') || text.includes('409')) {
      throw new HTTPException(400, { message: 'Este aluno já está no grupo.' });
    }
    throw err;
  }
  return c.json({ ok: true });
});

gated.delete('/groups/:id/members/:userId', async (c) => {
  requireTransporter(c.get('profile'));
  await rest(
    c.env,
    c.get('token'),
    'group_members',
    `?group_id=eq.${c.req.param('id')}&user_id=eq.${c.req.param('userId')}`,
    { method: 'DELETE' },
  );
  return c.json({ ok: true });
});

gated.get('/trips/active', async (c) => {
  const groupId = c.req.query('group_id');
  const routeIdQuery = c.req.query('route_id');
  let routeId = routeIdQuery ?? '';
  if (groupId && !routeId) {
    const groups = await rest<Group[]>(
      c.env,
      c.get('token'),
      'groups',
      `?id=eq.${groupId}`,
    );
    routeId = groups[0]?.route_id ?? '';
  }
  let q = '?status=eq.in_progress&order=started_at.desc&limit=1';
  if (routeId) q = `?route_id=eq.${routeId}&status=eq.in_progress&limit=1`;
  else if (groupId) q = `?group_id=eq.${groupId}&status=eq.in_progress&limit=1`;
  const rows = await rest<Trip[]>(c.env, c.get('token'), 'trips', q);
  return c.json(rows[0] ?? null);
});

gated.get('/trips/:id', async (c) => {
  const rows = await rest<Trip[]>(c.env, c.get('token'), 'trips', `?id=eq.${c.req.param('id')}`);
  return c.json(rows[0] ?? null);
});

gated.get('/trips/:id/position', async (c) => {
  const trip = await loadTrip(c.env, c.get('token'), c.req.param('id'));
  if (!trip) throw new HTTPException(404, { message: 'Viagem não encontrada.' });
  const position = await advancePosition(c.env, trip);
  return c.json(position);
});

gated.post('/trips/start', async (c) => {
  const me = c.get('profile');
  requireTransporter(me);
  const body = await c.req.json<{
    route_id: string;
    group_id: string;
    lat?: number;
    lng?: number;
  }>();
  const points = await rest<RoutePoint[]>(
    c.env,
    c.get('token'),
    'route_points',
    `?route_id=eq.${body.route_id}&order=sort_order.asc`,
  );
  if (points.length < 1) throw new HTTPException(400, { message: 'A rota precisa de pontos.' });
  const dir = await directions(
    c.env,
    points.map((p) => ({ lat: p.lat, lng: p.lng })),
  );
  const started = new Date().toISOString();
  const trips = await rest<Trip[]>(c.env, c.get('token'), 'trips', '', {
    method: 'POST',
    body: JSON.stringify({
      route_id: body.route_id,
      group_id: body.group_id,
      started_at: started,
      ended_at: null,
      status: 'in_progress',
      polyline: dir.points,
    }),
  });
  const trip = trips[0];
  const first = dir.points[0] ?? { lat: body.lat ?? points[0].lat, lng: body.lng ?? points[0].lng };
  await rest(c.env, adminToken(c.env), 'trip_positions', '', {
    method: 'POST',
    body: JSON.stringify({
      trip_id: trip.id,
      lat: first.lat,
      lng: first.lng,
      remaining_m: dir.distance_m,
      recorded_at: started,
    }),
  });
  return c.json(trip);
});

gated.post('/trips/:id/stop', async (c) => {
  requireTransporter(c.get('profile'));
  const rows = await rest<Trip[]>(c.env, c.get('token'), 'trips', `?id=eq.${c.req.param('id')}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'ended', ended_at: new Date().toISOString() }),
  });
  return c.json(rows[0]);
});

gated.post('/maps/geocode', async (c) => {
  const body = await c.req.json<{ query: string }>();
  const coords = await geocodeAddress(c.env, body.query);
  return c.json(coords);
});

gated.post('/maps/directions', async (c) => {
  const body = await c.req.json<{ points: LatLng[] }>();
  const dir = await directions(c.env, body.points ?? []);
  return c.json({
    coordinates: dir.coordinates,
    distance_m: dir.distance_m,
  });
});

app.route('/', gated);

export default app;

function requireTransporter(profile: Profile) {
  if (profile.role !== 'transporter') {
    throw new HTTPException(403, { message: 'Apenas o transportador pode fazer isso.' });
  }
}

function mapUser(user: SbUser | undefined | null) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? '',
    user_metadata: {
      name: user.user_metadata?.name ?? '',
      role: (user.user_metadata?.role === 'transporter' ? 'transporter' : 'client') as Role,
    },
  };
}

function toSession(json: Record<string, unknown> | { session?: unknown; user?: SbUser; access_token?: string }) {
  const raw = json as {
    access_token?: string;
    user?: SbUser;
    session?: { access_token: string; user: SbUser };
  };
  const access = raw.session?.access_token ?? raw.access_token;
  const user = raw.session?.user ?? raw.user;
  if (!access || !user) return null;
  return { access_token: access, user: mapUser(user)! };
}

async function toSessionWithProfile(
  env: Env,
  json: Record<string, unknown> | { session?: unknown; user?: SbUser; access_token?: string },
) {
  const session = toSession(json);
  if (!session) return null;
  try {
    const rows = await rest<Profile[]>(
      env,
      session.access_token,
      'profiles',
      `?id=eq.${session.user.id}&select=*`,
    );
    const profile = Array.isArray(rows) ? rows[0] : undefined;
    if (profile?.role) {
      session.user.user_metadata = {
        name: profile.name || session.user.user_metadata.name,
        role: profile.role === 'transporter' ? 'transporter' : 'client',
      };
    }
  } catch {
    /* keep JWT metadata */
  }
  return session;
}

function authMessage(json: unknown) {
  if (!json || typeof json !== 'object') return 'Não foi possível concluir.';
  const obj = json as { error_description?: string; error?: string | { message?: string }; msg?: string; message?: string };
  if (typeof obj.error === 'object' && obj.error?.message) return obj.error.message;
  return obj.error_description || obj.msg || obj.message || (typeof obj.error === 'string' ? obj.error : 'Não foi possível concluir.');
}

async function loadTrip(env: Env, token: string, id: string) {
  const rows = await rest<Trip[]>(env, token, 'trips', `?id=eq.${id}`);
  return rows[0] ?? null;
}

async function advancePosition(env: Env, trip: Trip) {
  const poly: LatLng[] = Array.isArray(trip.polyline) ? trip.polyline : [];
  if (trip.status !== 'in_progress' || poly.length === 0) {
    const latest = await rest<
      { trip_id: string; lat: number; lng: number; remaining_m: number | null; recorded_at: string }[]
    >(
      env,
      adminToken(env),
      'trip_positions',
      `?trip_id=eq.${trip.id}&order=recorded_at.desc&limit=1`,
    );
    return latest[0] ?? null;
  }
  const elapsed = Date.now() - new Date(trip.started_at).getTime();
  const progress = Math.min(1, elapsed / TRIP_MS);
  const sim = interpolatePath(poly, progress);
  const recorded_at = new Date().toISOString();
  const rows = await rest<
    { trip_id: string; lat: number; lng: number; remaining_m: number | null; recorded_at: string }[]
  >(env, adminToken(env), 'trip_positions', '', {
    method: 'POST',
    body: JSON.stringify({
      trip_id: trip.id,
      lat: sim.point.lat,
      lng: sim.point.lng,
      remaining_m: sim.remainingM,
      recorded_at,
    }),
  });
  return rows[0] ?? {
    trip_id: trip.id,
    lat: sim.point.lat,
    lng: sim.point.lng,
    remaining_m: sim.remainingM,
    recorded_at,
  };
}
