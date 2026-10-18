/**
 * Cria contas demo e dados seed. Rode depois da migration e com worker/.dev.vars preenchido:
 *   cd worker && npm run seed
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const STOPS = [
  {
    name: 'Praça Cívica — Centro',
    query: 'Praça Cívica, Goiânia, GO',
    lat: -16.6809,
    lng: -49.2563,
  },
  {
    name: 'Jardim América',
    query: 'Jardim América, Goiânia, GO',
    lat: -16.7036,
    lng: -49.271,
  },
  {
    name: 'Setor Bueno',
    query: 'Setor Bueno, Goiânia, GO',
    lat: -16.7078,
    lng: -49.2643,
  },
];

async function geocodeStop(
  env: Record<string, string>,
  stop: (typeof STOPS)[number],
): Promise<{ lat: number; lng: number }> {
  const key = env.GOOGLE_MAPS_SERVER_KEY?.trim();
  if (!key) return { lat: stop.lat, lng: stop.lng };
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', stop.query);
  url.searchParams.set('key', key);
  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    results?: { geometry: { location: { lat: number; lng: number } } }[];
  };
  const loc = data.results?.[0]?.geometry.location;
  if (data.status !== 'OK' || !loc) return { lat: stop.lat, lng: stop.lng };
  return { lat: loc.lat, lng: loc.lng };
}

function loadDevVars() {
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    const raw = readFileSync(resolve(import.meta.dirname, '../.dev.vars'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
    }
  } catch {
    // usa process.env
  }
  return env;
}

async function authAdmin(
  env: Record<string, string>,
  path: string,
  init: RequestInit = {},
) {
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`auth ${path}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function rest(
  env: Record<string, string>,
  table: string,
  search: string,
  init: RequestInit = {},
) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}${search}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`rest ${table}: ${text}`);
  return text ? JSON.parse(text) : null;
}

async function ensureUser(
  env: Record<string, string>,
  input: { email: string; password: string; name: string; role: string; phone: string },
) {
  const created = await authAdmin(env, '/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      email_confirm: true,
      user_metadata: { name: input.name, role: input.role, phone: input.phone },
    }),
  }).catch(async (err: Error) => {
    if (!err.message.includes('already') && !err.message.includes('registered')) throw err;
    const list = await authAdmin(env, `/admin/users?email=${encodeURIComponent(input.email)}`);
    const users = Array.isArray(list) ? list : list?.users;
    const user = users?.find((u: { email?: string }) => u.email === input.email) ?? users?.[0];
    if (!user) throw err;
    return { user };
  });
  const user = created.user ?? created;
  await rest(env, 'profiles', `?id=eq.${user.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: input.name,
      phone: input.phone,
      role: input.role,
      email: input.email,
    }),
  });
  return user.id as string;
}

async function main() {
  const env = loadDevVars();
  for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) {
    if (!env[key]) throw new Error(`Falta ${key} em worker/.dev.vars`);
  }

  const clientId = await ensureUser(env, {
    email: 'cliente@embarqueai.com',
    password: 'senha123',
    name: 'José Antônio de Paula',
    role: 'client',
    phone: '(62) 99999-1111',
  });
  const transporterId = await ensureUser(env, {
    email: 'transportador@embarqueai.com',
    password: 'senha123',
    name: 'Afonso de Souza Bezerra',
    role: 'transporter',
    phone: '(62) 98888-2222',
  });

  const existing = await rest(
    env,
    'vehicles',
    `?transporter_id=eq.${transporterId}&plate=eq.MUT-1245`,
  );
  if (Array.isArray(existing) && existing.length > 0) {
    const demoRoutes = await rest(
      env,
      'routes',
      `?transporter_id=eq.${transporterId}&name=eq.${encodeURIComponent('Rota Manhã — Centro')}`,
    );
    const demoRoute = Array.isArray(demoRoutes) ? demoRoutes[0] : null;
    if (demoRoute?.id) {
      await rest(env, 'route_points', `?route_id=eq.${demoRoute.id}`, { method: 'DELETE' });
      const points = [];
      for (let i = 0; i < STOPS.length; i += 1) {
        const stop = STOPS[i];
        const coords = await geocodeStop(env, stop);
        points.push({
          route_id: demoRoute.id,
          name: stop.name,
          lat: coords.lat,
          lng: coords.lng,
          sort_order: i,
        });
      }
      await rest(env, 'route_points', '', {
        method: 'POST',
        body: JSON.stringify(points),
      });
      console.log('Seed já existia; pontos da rota demo atualizados.');
      return;
    }
    console.log('Seed já aplicado.');
    return;
  }

  const vehicles = await rest(env, 'vehicles', '', {
    method: 'POST',
    body: JSON.stringify({
      transporter_id: transporterId,
      type: 'Van',
      plate: 'MUT-1245',
    }),
  });
  const vehicleId = vehicles[0].id;

  const routes = await rest(env, 'routes', '', {
    method: 'POST',
    body: JSON.stringify({
      transporter_id: transporterId,
      name: 'Rota Manhã — Centro',
      status: 'draft',
    }),
  });
  const routeId = routes[0].id;

  const points = [];
  for (let i = 0; i < STOPS.length; i += 1) {
    const stop = STOPS[i];
    const coords = await geocodeStop(env, stop);
    points.push({
      route_id: routeId,
      name: stop.name,
      lat: coords.lat,
      lng: coords.lng,
      sort_order: i,
    });
  }

  await rest(env, 'route_points', '', {
    method: 'POST',
    body: JSON.stringify(points),
  });

  const groups = await rest(env, 'groups', '', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Van do Afonso',
      vehicle_id: vehicleId,
      route_id: routeId,
      transporter_id: transporterId,
    }),
  });
  await rest(env, 'group_members', '', {
    method: 'POST',
    body: JSON.stringify({ group_id: groups[0].id, user_id: clientId }),
  });

  console.log('Seed ok. Cliente e transportador: senha123');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
