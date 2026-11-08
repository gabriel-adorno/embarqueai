import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';

import { interpolatePath, remainingAlong, type LatLng } from './geo';
import { directions, geocodeAddress } from './maps';
import {
  background,
  guardiansOf,
  presentMembers,
  removeToken,
  saveToken,
  sendPush,
} from './push';
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
  outbound_time?: string | null;
  return_time?: string | null;
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
  leg?: 'outbound' | 'return' | null;
  polyline: LatLng[];
  arrival_notified_at?: string | null;
};

const ARRIVAL_M = 800;

type PositionRow = {
  trip_id: string;
  lat: number;
  lng: number;
  remaining_m: number | null;
  recorded_at: string;
  source?: 'gps' | 'sim';
};

type Boarding = {
  id: string;
  trip_id: string;
  user_id: string;
  status: 'boarded' | 'alighted';
  recorded_at: string;
};

type Absence = {
  id: string;
  group_id: string;
  user_id: string;
  absent_on: string;
};

type FollowRow = {
  id: string;
  guardian_id: string;
  passenger_id: string;
  status: 'pending' | 'accepted';
  created_at: string;
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
    options?: {
      data?: { name?: string; role?: Role; phone?: string; terms_version?: string; terms_accepted_at?: string };
    };
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
      type: body.type === 'recovery' ? 'recovery' : body.type === 'signup' ? 'signup' : 'email',
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

gated.get('/follows', async (c) => {
  const me = c.get('profile');
  const rows = await rest<FollowRow[]>(
    c.env,
    c.get('token'),
    'follows',
    `?or=(guardian_id.eq.${me.id},passenger_id.eq.${me.id})&order=created_at.desc`,
  );
  const list = Array.isArray(rows) ? rows : [];
  const watching = [];
  const watchedBy = [];
  for (const row of list) {
    const otherId = row.guardian_id === me.id ? row.passenger_id : row.guardian_id;
    const profiles = await rest<Profile[]>(
      c.env,
      c.get('token'),
      'profiles',
      `?id=eq.${otherId}&select=*`,
    );
    const item = { ...row, person: profiles[0] ?? null };
    if (row.guardian_id === me.id) watching.push(item);
    else watchedBy.push(item);
  }
  return c.json({ watching, watched_by: watchedBy });
});

gated.post('/follows', async (c) => {
  const me = c.get('profile');
  if (me.role !== 'client') {
    throw new HTTPException(403, { message: 'Só a conta da família acompanha um passageiro.' });
  }
  const body = await c.req.json<{ email: string }>();
  const found = await rest<Profile[]>(
    c.env,
    adminToken(c.env),
    'profiles',
    `?email=eq.${encodeURIComponent(body.email.trim().toLowerCase())}`,
  );
  const passenger = found[0];
  if (!passenger) throw new HTTPException(400, { message: 'Nenhum usuário com este e-mail.' });
  if (passenger.id === me.id) {
    throw new HTTPException(400, { message: 'Use o e-mail de outra pessoa.' });
  }
  if (passenger.role !== 'client') {
    throw new HTTPException(400, { message: 'Só é possível acompanhar um passageiro.' });
  }
  try {
    const rows = await rest<FollowRow[]>(c.env, c.get('token'), 'follows', '', {
      method: 'POST',
      body: JSON.stringify({
        guardian_id: me.id,
        passenger_id: passenger.id,
        status: 'pending',
      }),
    });
    return c.json(rows?.[0] ?? { ok: true });
  } catch (err) {
    const text = err instanceof Error ? err.message : '';
    if (text.includes('duplicate') || text.includes('409')) {
      throw new HTTPException(400, { message: 'Este convite já existe.' });
    }
    throw err;
  }
});

gated.post('/follows/:id/accept', async (c) => {
  const me = c.get('profile');
  const rows = await rest<FollowRow[]>(
    c.env,
    c.get('token'),
    'follows',
    `?id=eq.${c.req.param('id')}&passenger_id=eq.${me.id}`,
    { method: 'PATCH', body: JSON.stringify({ status: 'accepted' }) },
  );
  if (!rows?.[0]) throw new HTTPException(404, { message: 'Convite não encontrado.' });
  return c.json(rows[0]);
});

gated.delete('/follows/:id', async (c) => {
  await rest(c.env, c.get('token'), 'follows', `?id=eq.${c.req.param('id')}`, {
    method: 'DELETE',
  });
  return c.json({ ok: true });
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

gated.delete('/profile/me', async (c) => {
  const me = c.get('profile');
  const admin = adminToken(c.env);
  if (me.role === 'transporter') {
    const groups = await rest<{ id: string }[]>(
      c.env,
      admin,
      'groups',
      `?transporter_id=eq.${me.id}&select=id`,
    );
    const ids = (groups ?? []).map((group) => group.id);
    if (ids.length) {
      const members = await rest<{ user_id: string }[]>(
        c.env,
        admin,
        'group_members',
        `?group_id=in.(${ids.join(',')})&select=user_id&limit=1`,
      );
      if (members?.length) {
        throw new HTTPException(409, {
          message: 'Remova os passageiros ou exclua seus grupos antes de excluir a conta.',
        });
      }
      // Por garantia, apaga os grupos (já vazios) antes; groups tem restrict com vehicles/routes.
      await rest(c.env, admin, 'groups', `?transporter_id=eq.${me.id}`, { method: 'DELETE' });
    }
  }
  // Apagar o usuário do Auth apaga em cascata o perfil e os dados ligados a ele.
  const res = await fetch(`${c.env.SUPABASE_URL}/auth/v1/admin/users/${me.id}`, {
    method: 'DELETE',
    headers: { apikey: admin, Authorization: `Bearer ${admin}` },
  });
  if (!res.ok) {
    console.warn('delete account: auth respondeu', res.status, await res.text());
    throw new HTTPException(500, { message: 'Não foi possível excluir a conta. Tente de novo.' });
  }
  return c.json({ ok: true });
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

gated.post('/push/token', async (c) => {
  const body = await c.req.json<{ token?: string; platform?: string }>();
  const token = body.token?.trim() ?? '';
  if (!/^Expo(nent)?PushToken\[.+\]$/.test(token)) {
    throw new HTTPException(400, { message: 'Token de notificação inválido.' });
  }
  await saveToken(c.env, c.get('profile').id, token, body.platform ?? null);
  return c.json({ ok: true });
});

gated.delete('/push/token', async (c) => {
  const body = await c.req.json<{ token?: string }>();
  if (body.token) await removeToken(c.env, c.get('profile').id, body.token);
  return c.json({ ok: true });
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
  const body = await c.req.json<{ type: string; plate: string; capacity?: number; photo?: string }>();
  assertPhoto(body.photo);
  const rows = await rest<Vehicle[]>(c.env, c.get('token'), 'vehicles', '', {
    method: 'POST',
    body: JSON.stringify({
      transporter_id: me.id,
      type: body.type,
      plate: body.plate.toUpperCase(),
      capacity: cleanCapacity(body.capacity),
      photo: body.photo || null,
    }),
  });
  const vehicle = Array.isArray(rows) ? rows[0] : (rows as unknown as Vehicle);
  if (!vehicle) throw new HTTPException(500, { message: 'Não foi possível cadastrar o veículo.' });
  return c.json(vehicle);
});

gated.delete('/vehicles/:id', async (c) => {
  requireTransporter(c.get('profile'));
  await rest(c.env, c.get('token'), 'vehicles', `?id=eq.${c.req.param('id')}`, {
    method: 'DELETE',
  });
  return c.json({ ok: true });
});

gated.patch('/vehicles/:id', async (c) => {
  requireTransporter(c.get('profile'));
  const body = await c.req.json<{ type?: string; plate?: string; capacity?: number | null; photo?: string | null }>();
  assertPhoto(body.photo);
  const rows = await rest<Vehicle[]>(
    c.env,
    c.get('token'),
    'vehicles',
    `?id=eq.${c.req.param('id')}`,
    {
      method: 'PATCH',
      body: JSON.stringify({
        ...(body.type ? { type: body.type } : {}),
        ...(body.plate ? { plate: body.plate.toUpperCase() } : {}),
        capacity: cleanCapacity(body.capacity),
        photo: body.photo || null,
      }),
    },
  );
  if (!rows?.[0]) throw new HTTPException(404, { message: 'Veículo não encontrado.' });
  return c.json(rows[0]);
});

gated.get('/routes', async (c) => {
  const me = c.get('profile');
  if (me.role === 'client') {
    const userIds = await clientWatchIds(c.env, c.get('token'), me.id);
    const members = await rest<{ group_id: string }[]>(
      c.env,
      c.get('token'),
      'group_members',
      `?user_id=in.(${userIds.join(',')})`,
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
    outbound_time?: string | null;
    return_time?: string | null;
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
      outbound_time: body.outbound_time || null,
      return_time: body.return_time || null,
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

gated.patch('/routes/:id', async (c) => {
  requireTransporter(c.get('profile'));
  const routeId = c.req.param('id');
  const body = await c.req.json<{
    name?: string;
    outbound_time?: string | null;
    return_time?: string | null;
    points?: { id?: string; name: string; sort_order: number }[];
  }>();
  const rows = await rest<RouteRow[]>(c.env, c.get('token'), 'routes', `?id=eq.${routeId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(body.name ? { name: body.name } : {}),
      outbound_time: body.outbound_time || null,
      return_time: body.return_time || null,
    }),
  });
  if (body.points?.length) {
    const active = await rest<Trip[]>(
      c.env,
      c.get('token'),
      'trips',
      `?route_id=eq.${routeId}&status=eq.in_progress&limit=1`,
    );
    if (active[0]) {
      throw new HTTPException(400, { message: 'Encerre o trajeto antes de mudar os pontos.' });
    }
    const existing = await rest<RoutePoint[]>(
      c.env,
      c.get('token'),
      'route_points',
      `?route_id=eq.${routeId}&select=id`,
    );
    const keep = new Set(body.points.map((point) => point.id).filter(Boolean));
    for (const point of Array.isArray(existing) ? existing : []) {
      if (keep.has(point.id)) continue;
      await rest(c.env, c.get('token'), 'group_members', `?point_id=eq.${point.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ point_id: null }),
      });
      await rest(c.env, c.get('token'), 'route_points', `?id=eq.${point.id}`, { method: 'DELETE' });
    }
    for (const point of body.points) {
      if (point.id) {
        await rest(c.env, c.get('token'), 'route_points', `?id=eq.${point.id}&route_id=eq.${routeId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: point.name, sort_order: point.sort_order }),
        });
        continue;
      }
      const coords = await geocodeAddress(c.env, point.name);
      await rest(c.env, c.get('token'), 'route_points', '', {
        method: 'POST',
        body: JSON.stringify({
          route_id: routeId,
          name: point.name,
          lat: coords.lat,
          lng: coords.lng,
          sort_order: point.sort_order,
        }),
      });
    }
  }
  return c.json(rows[0]);
});

gated.delete('/routes/:id', async (c) => {
  requireTransporter(c.get('profile'));
  const routeId = c.req.param('id');
  const active = await rest<Trip[]>(
    c.env,
    c.get('token'),
    'trips',
    `?route_id=eq.${routeId}&status=eq.in_progress&limit=1`,
  );
  if (active[0]) {
    throw new HTTPException(400, { message: 'Encerre o trajeto antes de excluir a rota.' });
  }
  const linked = await rest<Group[]>(
    c.env,
    c.get('token'),
    'groups',
    `?route_id=eq.${routeId}`,
  );
  for (const group of Array.isArray(linked) ? linked : []) {
    await rest(c.env, c.get('token'), 'groups', `?id=eq.${group.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ route_id: null }),
    });
  }
  await rest(c.env, c.get('token'), 'routes', `?id=eq.${routeId}`, { method: 'DELETE' });
  return c.json({ ok: true });
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

gated.patch('/groups/:id', async (c) => {
  requireTransporter(c.get('profile'));
  const body = await c.req.json<{ name?: string; vehicle_id?: string }>();
  const rows = await rest<Group[]>(c.env, c.get('token'), 'groups', `?id=eq.${c.req.param('id')}`, {
    method: 'PATCH',
    body: JSON.stringify({
      ...(body.name ? { name: body.name } : {}),
      ...(body.vehicle_id ? { vehicle_id: body.vehicle_id } : {}),
    }),
  });
  if (!rows?.[0]) throw new HTTPException(404, { message: 'Grupo não encontrado.' });
  return c.json(rows[0]);
});

gated.delete('/groups/:id', async (c) => {
  requireTransporter(c.get('profile'));
  const groupId = c.req.param('id');
  const active = await rest<Trip[]>(
    c.env,
    c.get('token'),
    'trips',
    `?group_id=eq.${groupId}&status=eq.in_progress&limit=1`,
  );
  if (active[0]) {
    throw new HTTPException(400, { message: 'Encerre o trajeto antes de excluir o grupo.' });
  }
  await rest(c.env, c.get('token'), 'groups', `?id=eq.${groupId}`, { method: 'DELETE' });
  return c.json({ ok: true });
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
    throw new HTTPException(400, { message: 'Apenas passageiros (conta de cliente) podem ser adicionados.' });
  }
  try {
    await rest(c.env, c.get('token'), 'group_members', '', {
      method: 'POST',
      body: JSON.stringify({ group_id: groupId, user_id: profile.id }),
    });
  } catch (err) {
    const text = err instanceof Error ? err.message : '';
    if (text.includes('duplicate') || text.includes('409')) {
      throw new HTTPException(400, { message: 'Este passageiro já está no grupo.' });
    }
    throw err;
  }
  return c.json({ ok: true });
});

gated.patch('/groups/:id/members/:userId', async (c) => {
  const me = c.get('profile');
  const userId = c.req.param('userId');
  if (me.role !== 'transporter' && me.id !== userId) {
    const follows = await rest<{ id: string }[]>(
      c.env,
      c.get('token'),
      'follows',
      `?guardian_id=eq.${me.id}&passenger_id=eq.${userId}&status=eq.accepted&limit=1`,
    );
    if (!follows[0]) {
      throw new HTTPException(403, { message: 'Você não acompanha este passageiro.' });
    }
  }
  const body = await c.req.json<{ point_id?: string | null }>();
  await rest(
    c.env,
    c.get('token'),
    'group_members',
    `?group_id=eq.${c.req.param('id')}&user_id=eq.${c.req.param('userId')}`,
    { method: 'PATCH', body: JSON.stringify({ point_id: body.point_id || null }) },
  );
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

gated.get('/groups/:id/absences', async (c) => {
  const from = c.req.query('from');
  if (from) {
    const start = absenceDay(from);
    const rows = await rest<Absence[]>(
      c.env,
      c.get('token'),
      'absences',
      `?group_id=eq.${c.req.param('id')}&absent_on=gte.${start}&absent_on=lte.${addDays(todayInSaoPaulo(), MAX_ABSENCE_DAYS)}&order=absent_on.asc`,
    );
    return c.json(Array.isArray(rows) ? rows : []);
  }
  const day = absenceDay(c.req.query('date'));
  const rows = await rest<Absence[]>(
    c.env,
    c.get('token'),
    'absences',
    `?group_id=eq.${c.req.param('id')}&absent_on=eq.${day}`,
  );
  return c.json(Array.isArray(rows) ? rows : []);
});

gated.post('/groups/:id/absences', async (c) => {
  const me = c.get('profile');
  if (me.role !== 'client') {
    throw new HTTPException(403, { message: 'Apenas o passageiro pode avisar ausência.' });
  }
  const groupId = c.req.param('id');
  const groups = await rest<Group[]>(c.env, c.get('token'), 'groups', `?id=eq.${groupId}`);
  const group = groups[0];
  if (!group) throw new HTTPException(404, { message: 'Grupo não encontrado.' });
  const day = absenceDay(c.req.query('date'));
  if (day === todayInSaoPaulo()) await assertRouteNotStarted(c.env, c.get('token'), group);
  try {
    await rest(c.env, c.get('token'), 'absences', '', {
      method: 'POST',
      body: JSON.stringify({ group_id: groupId, user_id: me.id, absent_on: day }),
    });
  } catch (err) {
    const text = err instanceof Error ? err.message : '';
    if (!text.includes('duplicate') && !text.includes('409')) throw err;
  }
  return c.json({ ok: true });
});

gated.delete('/groups/:id/absences', async (c) => {
  const me = c.get('profile');
  const day = absenceDay(c.req.query('date'));
  await rest(
    c.env,
    c.get('token'),
    'absences',
    `?group_id=eq.${c.req.param('id')}&user_id=eq.${me.id}&absent_on=eq.${day}`,
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

gated.get('/trips/history', async (c) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await rest<Trip[]>(
    c.env,
    c.get('token'),
    'trips',
    `?status=eq.ended&ended_at=gte.${encodeURIComponent(since)}&order=ended_at.desc&limit=40&select=id,route_id,group_id,started_at,ended_at,status`,
  );
  return c.json(Array.isArray(rows) ? rows : []);
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

gated.get('/trips/:id/boardings', async (c) => {
  const rows = await rest<Boarding[]>(
    c.env,
    c.get('token'),
    'boardings',
    `?trip_id=eq.${c.req.param('id')}`,
  );
  return c.json(Array.isArray(rows) ? rows : []);
});

gated.post('/trips/:id/boardings', async (c) => {
  requireTransporter(c.get('profile'));
  const body = await c.req.json<{ user_id: string; status: 'boarded' | 'alighted' }>();
  if (body.status !== 'boarded' && body.status !== 'alighted') {
    throw new HTTPException(400, { message: 'Status inválido.' });
  }
  const trip = await loadTrip(c.env, c.get('token'), c.req.param('id'));
  if (!trip || trip.status !== 'in_progress') {
    throw new HTTPException(400, { message: 'Trajeto não está em andamento.' });
  }
  const members = await rest<{ user_id: string }[]>(
    c.env,
    c.get('token'),
    'group_members',
    `?group_id=eq.${trip.group_id}&user_id=eq.${body.user_id}`,
  );
  if (!members[0]) {
    throw new HTTPException(400, { message: 'Passageiro não está neste grupo.' });
  }
  const rows = await rest<Boarding[]>(c.env, c.get('token'), 'boardings', '?on_conflict=trip_id,user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({
      trip_id: trip.id,
      user_id: body.user_id,
      status: body.status,
      recorded_at: new Date().toISOString(),
    }),
  });
  background(c.executionCtx, async () => {
    const [routes, people] = await Promise.all([
      rest<{ name: string }[]>(c.env, adminToken(c.env), 'routes', `?id=eq.${trip.route_id}&select=name`),
      rest<{ name: string }[]>(c.env, adminToken(c.env), 'profiles', `?id=eq.${body.user_id}&select=name`),
    ]);
    const routeName = routes?.[0]?.name ?? 'Rota';
    const name = people?.[0]?.name ?? 'Passageiro';
    const boarded = body.status === 'boarded';
    const data = { kind: 'boarding', tripId: trip.id, routeId: trip.route_id, url: `/trip/${trip.id}` };
    await sendPush(c.env, [body.user_id], {
      title: boarded ? 'Embarque registrado' : 'Desembarque registrado',
      body: routeName,
      data,
    });
    await sendPush(c.env, await guardiansOf(c.env, [body.user_id]), {
      title: boarded ? `${name} embarcou` : `${name} desembarcou`,
      body: routeName,
      data,
    });
  });
  return c.json(rows?.[0] ?? { ok: true });
});

gated.post('/trips/:id/position', async (c) => {
  requireTransporter(c.get('profile'));
  const body = await c.req.json<{ lat: number; lng: number }>();
  if (typeof body.lat !== 'number' || typeof body.lng !== 'number') {
    throw new HTTPException(400, { message: 'Localização inválida.' });
  }
  const trip = await loadTrip(c.env, c.get('token'), c.req.param('id'));
  if (!trip || trip.status !== 'in_progress') {
    throw new HTTPException(400, { message: 'Trajeto não está em andamento.' });
  }
  const siblings = await rest<Trip[]>(
    c.env,
    c.get('token'),
    'trips',
    `?route_id=eq.${trip.route_id}&status=eq.in_progress`,
  );
  const targets = siblings.length ? siblings : [trip];
  const recorded_at = new Date().toISOString();
  let current: PositionRow | null = null;
  const arriving: { trip: Trip; remaining: number }[] = [];
  for (const item of targets) {
    const poly: LatLng[] = Array.isArray(item.polyline) ? item.polyline : [];
    const row = await insertPosition(c.env, c.get('token'), {
      trip_id: item.id,
      lat: body.lat,
      lng: body.lng,
      remaining_m: poly.length ? remainingAlong(poly, { lat: body.lat, lng: body.lng }) : null,
      recorded_at,
      source: 'gps',
    });
    if (item.id === trip.id) current = row;
    if (row?.remaining_m != null && row.remaining_m < ARRIVAL_M && !item.arrival_notified_at) {
      arriving.push({ trip: item, remaining: row.remaining_m });
    }
  }
  if (arriving.length) {
    background(c.executionCtx, async () => {
      for (const { trip: item, remaining } of arriving) {
        // Marca antes de enviar; só quem conseguir marcar envia (evita repetir).
        const marked = await rest<Trip[]>(
          c.env,
          adminToken(c.env),
          'trips',
          `?id=eq.${item.id}&arrival_notified_at=is.null`,
          { method: 'PATCH', body: JSON.stringify({ arrival_notified_at: new Date().toISOString() }) },
        );
        if (!marked?.length) continue;
        const routes = await rest<{ name: string }[]>(
          c.env,
          adminToken(c.env),
          'routes',
          `?id=eq.${item.route_id}&select=name`,
        );
        const members = await presentMembers(c.env, item.group_id);
        const guardians = await guardiansOf(c.env, members);
        const meters = Math.max(100, Math.round(remaining / 100) * 100);
        await sendPush(c.env, [...members, ...guardians], {
          title: 'A van está chegando',
          body: `${routes?.[0]?.name ?? 'Rota'}: faltam cerca de ${meters} m`,
          data: { kind: 'arrival', tripId: item.id, routeId: item.route_id, url: `/trip/${item.id}` },
        });
      }
    });
  }
  return c.json(current);
});

gated.get('/alerts', async (c) => {
  const since = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
  const rows = await rest<{ id: string; trip_id: string; message: string; created_at: string }[]>(
    c.env,
    c.get('token'),
    'trip_alerts',
    `?created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=20`,
  );
  const alerts = Array.isArray(rows) ? rows : [];
  const withReplies = [];
  for (const alert of alerts) {
    const replies = await rest<
      { id: string; alert_id: string; user_id: string; message: string }[]
    >(c.env, c.get('token'), 'trip_alert_replies', `?alert_id=eq.${alert.id}`);
    const named = [];
    for (const reply of Array.isArray(replies) ? replies : []) {
      const profiles = await rest<Profile[]>(
        c.env,
        c.get('token'),
        'profiles',
        `?id=eq.${reply.user_id}&select=name`,
      );
      named.push({ ...reply, user_name: profiles[0]?.name ?? 'Passageiro' });
    }
    withReplies.push({ ...alert, replies: named });
  }
  return c.json(withReplies);
});

gated.post('/alerts/:id/replies', async (c) => {
  const me = c.get('profile');
  const body = await c.req.json<{ message: string }>();
  if (body.message !== 'Já estou no ponto' && body.message !== 'Pode seguir') {
    throw new HTTPException(400, { message: 'Resposta inválida.' });
  }
  try {
    const rows = await rest(c.env, c.get('token'), 'trip_alert_replies', '?on_conflict=alert_id,user_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        alert_id: c.req.param('id'),
        user_id: me.id,
        message: body.message,
      }),
    });
    return c.json(Array.isArray(rows) ? rows[0] : rows);
  } catch (err) {
    const text = err instanceof Error ? err.message : '';
    if (text.includes('duplicate') || text.includes('409')) return c.json({ ok: true });
    throw err;
  }
});

gated.post('/trips/:id/alerts', async (c) => {
  requireTransporter(c.get('profile'));
  const body = await c.req.json<{ message: string }>();
  const message = body.message?.trim() ?? '';
  if (message.length < 3) throw new HTTPException(400, { message: 'Escreva o aviso.' });
  const trip = await loadTrip(c.env, c.get('token'), c.req.param('id'));
  if (!trip || trip.status !== 'in_progress') {
    throw new HTTPException(400, { message: 'O trajeto não está em andamento.' });
  }
  const rows = await rest<{ id: string; trip_id: string; message: string; created_at: string }[]>(
    c.env,
    c.get('token'),
    'trip_alerts',
    '',
    { method: 'POST', body: JSON.stringify({ trip_id: trip.id, message }) },
  );
  background(c.executionCtx, async () => {
    const members = await presentMembers(c.env, trip.group_id);
    const guardians = await guardiansOf(c.env, members);
    await sendPush(c.env, [...members, ...guardians], {
      title: 'Aviso do transportador',
      body: message,
      data: { kind: 'alert', tripId: trip.id, routeId: trip.route_id, url: `/trip/${trip.id}` },
    });
  });
  return c.json(rows?.[0] ?? { ok: true });
});

gated.get('/reports', async (c) => {
  requireTransporter(c.get('profile'));
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const trips = await rest<Trip[]>(
    c.env,
    c.get('token'),
    'trips',
    `?status=eq.ended&ended_at=gte.${encodeURIComponent(since)}&order=ended_at.desc&limit=40&select=id,route_id,group_id,started_at,ended_at,status`,
  );
  const list = Array.isArray(trips) ? trips : [];
  const rows = [];
  let boarded = 0;
  let absences = 0;
  for (const trip of list) {
    const [routeRows, boardingRows, absenceRows] = await Promise.all([
      rest<RouteRow[]>(c.env, c.get('token'), 'routes', `?id=eq.${trip.route_id}&select=name`),
      rest<{ status: string }[]>(c.env, c.get('token'), 'boardings', `?trip_id=eq.${trip.id}&status=eq.boarded`),
      rest<{ id: string }[]>(
        c.env,
        c.get('token'),
        'absences',
        `?group_id=eq.${trip.group_id}&absent_on=eq.${trip.started_at.slice(0, 10)}`,
      ),
    ]);
    const boardedCount = Array.isArray(boardingRows) ? boardingRows.length : 0;
    const absentCount = Array.isArray(absenceRows) ? absenceRows.length : 0;
    boarded += boardedCount;
    absences += absentCount;
    rows.push({
      route_name: routeRows[0]?.name ?? 'Rota',
      started_at: trip.started_at,
      ended_at: trip.ended_at,
      boarded: boardedCount,
      absent: absentCount,
    });
  }
  return c.json({ trips: list.length, boarded, absences, rows });
});

gated.post('/trips/start', async (c) => {
  const me = c.get('profile');
  requireTransporter(me);
  const body = await c.req.json<{
    route_id: string;
    group_id: string;
    lat?: number;
    lng?: number;
    leg?: 'outbound' | 'return';
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
      leg: body.leg === 'return' ? 'return' : 'outbound',
      polyline: dir.points,
    }),
  });
  const trip = trips[0];
  const first = dir.points[0] ?? { lat: body.lat ?? points[0].lat, lng: body.lng ?? points[0].lng };
  await insertPosition(c.env, adminToken(c.env), {
    trip_id: trip.id,
    lat: first.lat,
    lng: first.lng,
    remaining_m: dir.distance_m,
    recorded_at: started,
    source: 'sim',
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

function cleanCapacity(value: number | null | undefined) {
  if (value == null || Number.isNaN(Number(value))) return null;
  const n = Math.round(Number(value));
  if (n < 1 || n > 80) return null;
  return n;
}

function assertPhoto(photo: string | null | undefined) {
  if (photo && photo.length > 280_000) {
    throw new HTTPException(400, { message: 'A foto ficou grande demais. Escolha outra.' });
  }
}

async function clientWatchIds(env: Env, token: string, meId: string) {
  const ids = new Set<string>([meId]);
  try {
    const rows = await rest<{ passenger_id: string }[]>(
      env,
      token,
      'follows',
      `?guardian_id=eq.${meId}&status=eq.accepted&select=passenger_id`,
    );
    for (const row of Array.isArray(rows) ? rows : []) ids.add(row.passenger_id);
  } catch {
    /* follows ainda não existe neste servidor */
  }
  return [...ids];
}

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

const MAX_ABSENCE_DAYS = 60;

function addDays(day: string, amount: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

/** Data da ausência: hoje por padrão; aceita AAAA-MM-DD de hoje até 60 dias. */
function absenceDay(raw: string | undefined) {
  const today = todayInSaoPaulo();
  if (!raw) return today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T12:00:00Z`)) || addDays(raw, 0) !== raw) {
    throw new HTTPException(400, { message: 'Data inválida.' });
  }
  if (raw < today || raw > addDays(today, MAX_ABSENCE_DAYS)) {
    throw new HTTPException(400, { message: 'Escolha uma data entre hoje e os próximos 60 dias.' });
  }
  return raw;
}

async function assertRouteNotStarted(env: Env, token: string, group: Group) {
  const byGroup = await rest<Trip[]>(
    env,
    token,
    'trips',
    `?group_id=eq.${group.id}&status=eq.in_progress&limit=1`,
  );
  const byRoute = group.route_id
    ? await rest<Trip[]>(
        env,
        token,
        'trips',
        `?route_id=eq.${group.route_id}&status=eq.in_progress&limit=1`,
      )
    : [];
  if (byGroup[0] || byRoute[0]) {
    throw new HTTPException(400, {
      message: 'A rota já começou. Avise a ausência antes do início.',
    });
  }
}

async function insertPosition(env: Env, token: string, row: PositionRow) {
  const rows = await rest<PositionRow[]>(env, token, 'trip_positions', '', {
    method: 'POST',
    body: JSON.stringify(row),
  });
  return rows?.[0] ?? row;
}

async function advancePosition(env: Env, trip: Trip) {
  const poly: LatLng[] = Array.isArray(trip.polyline) ? trip.polyline : [];
  const latest = await rest<PositionRow[]>(
    env,
    adminToken(env),
    'trip_positions',
    `?trip_id=eq.${trip.id}&order=recorded_at.desc&limit=1`,
  );
  const last = latest[0] ?? null;
  if (last?.source === 'gps' || trip.status !== 'in_progress' || poly.length === 0) {
    return last;
  }
  const elapsed = Date.now() - new Date(trip.started_at).getTime();
  const progress = Math.min(1, elapsed / TRIP_MS);
  const sim = interpolatePath(poly, progress);
  const recorded_at = new Date().toISOString();
  const fresh: PositionRow = {
    trip_id: trip.id,
    lat: sim.point.lat,
    lng: sim.point.lng,
    remaining_m: sim.remainingM,
    recorded_at,
    source: 'sim',
  };
  const lastAge = last ? Date.now() - new Date(last.recorded_at).getTime() : Infinity;
  if (lastAge < 8000) return fresh;
  return insertPosition(env, adminToken(env), fresh);
}
