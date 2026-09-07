/** Trocar corpo por supabase.from('routes') / supabase.from('route_points'). */
import { isRemote } from '@/src/lib/config';
import { uuid } from '@/src/lib/uuid';
import * as remote from '@/src/services/remote';
import { loadDb, mutateDb } from '@/src/services/store';
import type { Route, RoutePoint, RouteStatus } from '@/src/types/database';

export async function listRoutes(userId: string): Promise<Route[]> {
  if (isRemote()) return remote.listRoutes(userId);
  const db = await loadDb();
  const profile = db.profiles.find((p) => p.id === userId);
  if (profile?.role === 'client') {
    const groupIds = db.group_members
      .filter((m) => m.user_id === userId)
      .map((m) => m.group_id);
    const routeIds = [
      ...new Set(
        db.groups
          .filter((g) => groupIds.includes(g.id) && g.route_id)
          .map((g) => g.route_id as string),
      ),
    ];
    return db.routes.filter((r) => routeIds.includes(r.id));
  }
  return db.routes.filter((r) => r.transporter_id === userId);
}

export async function getRoute(id: string): Promise<Route | null> {
  if (isRemote()) return remote.getRoute(id);
  const db = await loadDb();
  return db.routes.find((r) => r.id === id) ?? null;
}

export async function listRoutePoints(routeId: string): Promise<RoutePoint[]> {
  if (isRemote()) return remote.listRoutePoints(routeId);
  const db = await loadDb();
  return db.route_points
    .filter((p) => p.route_id === routeId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function createRoute(input: {
  transporter_id: string;
  name: string;
  points: { name: string; lat: number; lng: number }[];
  group_ids?: string[];
}): Promise<Route> {
  if (isRemote()) return remote.createRoute(input);
  const route: Route = {
    id: uuid(),
    transporter_id: input.transporter_id,
    name: input.name,
    status: 'draft',
  };
  const points: RoutePoint[] = input.points.map((point, index) => ({
    id: uuid(),
    route_id: route.id,
    name: point.name,
    lat: point.lat,
    lng: point.lng,
    sort_order: index,
  }));
  await mutateDb((db) => {
    db.routes.push(route);
    db.route_points.push(...points);
    for (const groupId of input.group_ids ?? []) {
      const group = db.groups.find(
        (g) => g.id === groupId && g.transporter_id === input.transporter_id,
      );
      if (group) group.route_id = route.id;
    }
  });
  return route;
}

export async function updateRouteStatus(
  id: string,
  status: RouteStatus,
): Promise<Route> {
  if (isRemote()) return remote.updateRouteStatus(id, status);
  let updated: Route | undefined;
  await mutateDb((db) => {
    const route = db.routes.find((r) => r.id === id);
    if (!route) throw new Error('Rota não encontrada.');
    route.status = status;
    updated = route;
  });
  return updated as Route;
}
