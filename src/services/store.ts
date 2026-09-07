/**
 * Persistência local do MVP (memória + AsyncStorage).
 * Trocar este módulo por Postgres + RLS no Supabase quando o backend existir.
 * Cloudflare não substitui este armazenamento.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEMO_ROUTE_NAME, DEMO_ROUTE_STOPS } from '@/src/lib/demoRoute';
import { DEMO_ACCOUNTS, EMAIL_ALIASES, MOCK_PASSWORD, SEED } from '@/src/lib/ids';
import type {
  Group,
  GroupMember,
  Profile,
  Route,
  RoutePoint,
  Trip,
  TripPosition,
  Vehicle,
} from '@/src/types/database';

const STORAGE_KEY = '@embarqueai/mock-db-v3';
const LEGACY_KEYS = ['@embarqueai/mock-db-v1', '@vango/mock-db-v1'];

export type Credential = {
  email: string;
  password: string;
  user_id: string;
};

export type MockDb = {
  profiles: Profile[];
  vehicles: Vehicle[];
  routes: Route[];
  route_points: RoutePoint[];
  groups: Group[];
  group_members: GroupMember[];
  trips: Trip[];
  trip_positions: TripPosition[];
  credentials: Credential[];
  pending_otp_email: string | null;
};

function seedDb(): MockDb {
  return {
    profiles: [
      {
        id: SEED.clientId,
        name: 'José Antônio de Paula',
        email: DEMO_ACCOUNTS.client.email,
        phone: '(62) 99999-1111',
        role: 'client',
      },
      {
        id: SEED.transporterId,
        name: 'Afonso de Souza Bezerra',
        email: DEMO_ACCOUNTS.transporter.email,
        phone: '(62) 98888-2222',
        role: 'transporter',
      },
    ],
    credentials: [
      {
        email: DEMO_ACCOUNTS.client.email,
        password: MOCK_PASSWORD,
        user_id: SEED.clientId,
      },
      {
        email: DEMO_ACCOUNTS.transporter.email,
        password: MOCK_PASSWORD,
        user_id: SEED.transporterId,
      },
    ],
    vehicles: [
      {
        id: SEED.vehicleId,
        transporter_id: SEED.transporterId,
        type: 'Van',
        plate: 'MUT-1245',
      },
    ],
    routes: [
      {
        id: SEED.routeId,
        transporter_id: SEED.transporterId,
        name: DEMO_ROUTE_NAME,
        status: 'draft',
      },
    ],
    route_points: DEMO_ROUTE_STOPS.map((stop, index) => ({
      id: [SEED.pointA, SEED.pointB, SEED.pointC][index],
      route_id: SEED.routeId,
      name: stop.name,
      lat: stop.lat,
      lng: stop.lng,
      sort_order: index,
    })),
    groups: [
      {
        id: SEED.groupId,
        name: 'Van do Afonso',
        vehicle_id: SEED.vehicleId,
        route_id: SEED.routeId,
        transporter_id: SEED.transporterId,
      },
    ],
    group_members: [{ group_id: SEED.groupId, user_id: SEED.clientId }],
    trips: [],
    trip_positions: [],
    pending_otp_email: null,
  };
}

function ensureDemoAccounts(db: MockDb): void {
  const demos = [
    {
      id: SEED.clientId,
      email: DEMO_ACCOUNTS.client.email,
      name: 'José Antônio de Paula',
      phone: '(62) 99999-1111' as const,
      role: 'client' as const,
    },
    {
      id: SEED.transporterId,
      email: DEMO_ACCOUNTS.transporter.email,
      name: 'Afonso de Souza Bezerra',
      phone: '(62) 98888-2222' as const,
      role: 'transporter' as const,
    },
  ];

  for (const demo of demos) {
    const profile = db.profiles.find((p) => p.id === demo.id);
    if (profile) {
      profile.email = demo.email;
      profile.role = demo.role;
    } else {
      db.profiles.push({
        id: demo.id,
        name: demo.name,
        email: demo.email,
        phone: demo.phone,
        role: demo.role,
      });
    }

    const cred = db.credentials.find((c) => c.user_id === demo.id);
    if (cred) {
      cred.email = demo.email;
      cred.password = MOCK_PASSWORD;
    } else {
      db.credentials.push({
        email: demo.email,
        password: MOCK_PASSWORD,
        user_id: demo.id,
      });
    }
  }

  const demoIds = new Set<string>(demos.map((d) => d.id));
  const reservedEmails = new Set(
    [
      ...demos.map((d) => d.email),
      ...Object.keys(EMAIL_ALIASES),
      ...Object.values(EMAIL_ALIASES),
    ].map((email) => email.toLowerCase()),
  );

  db.credentials = db.credentials.filter((c) => {
    if (demoIds.has(c.user_id)) return true;
    return !reservedEmails.has(c.email.toLowerCase());
  });
}

let memory: MockDb | null = null;
let loadPromise: Promise<void> | null = null;

async function persist(): Promise<void> {
  if (!memory) return;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
}

export async function loadDb(): Promise<MockDb> {
  if (memory) return memory;
  if (!loadPromise) {
    loadPromise = (async () => {
      let raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) {
        for (const key of LEGACY_KEYS) {
          raw = await AsyncStorage.getItem(key);
          if (raw) break;
        }
      }
      if (raw) {
        memory = JSON.parse(raw) as MockDb;
        ensureDemoAccounts(memory);
        await persist();
      } else {
        memory = seedDb();
        await persist();
      }
    })();
  }
  await loadPromise;
  if (!memory) {
    memory = seedDb();
  }
  return memory;
}

export async function mutateDb(updater: (db: MockDb) => void): Promise<MockDb> {
  const db = await loadDb();
  updater(db);
  await persist();
  return db;
}

export async function resetDb(): Promise<void> {
  memory = seedDb();
  await persist();
}
