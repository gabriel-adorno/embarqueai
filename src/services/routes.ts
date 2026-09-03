/** Trocar corpo por supabase.from('routes') / supabase.from('route_points'). */
import { uuid } from '@/src/lib/uuid';
import { loadDb, mutateDb } from '@/src/services/store';
import type { Route, RoutePoint, RouteStatus } from '@/src/types/database';

export async function listRoutes(transporterId: string): Promise<Route[]> {
  const db = await loadDb();
  return db.routes.filter((r) => r.transporter_id === transporterId);
}

export async function getRoute(id: string): Promise<Route | null> {
  const db = await loadDb();
  return db.routes.find((r) => r.id === id) ?? null;
}

export async function listRoutePoints(routeId: string): Promise<RoutePoint[]> {
  const db = await loadDb();
  return db.route_points
    .filter((p) => p.route_id === routeId)
    .sort((a, b) => a.sort_order - b.sort_order);
}

export async function createRoute(input: {
  transporter_id: string;
  name: string;
  points: { name: string; lat: number; lng: number }[];
}): Promise<Route> {
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
  });
  return route;
}

export async function updateRouteStatus(
  id: string,
  status: RouteStatus,
): Promise<Route> {
  let updated: Route | undefined;
  await mutateDb((db) => {
    const route = db.routes.find((r) => r.id === id);
    if (!route) throw new Error('Rota não encontrada.');
    route.status = status;
    updated = route;
  });
  return updated as Route;
}
