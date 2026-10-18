/** Trocar corpo por supabase.from('routes') / supabase.from('route_points'). */
import { isRemote } from '@/src/lib/config';
import { geocodeAddress } from '@/src/services/maps';
import { acceptedPassengerIds } from '@/src/services/follows';
import { uuid } from '@/src/lib/uuid';
import * as remote from '@/src/services/remote';
import { loadDb, mutateDb } from '@/src/services/store';
import type { Route, RoutePoint, RouteStatus } from '@/src/types/database';

export async function listRoutes(userId: string): Promise<Route[]> {
  if (isRemote()) return remote.listRoutes(userId);
  const db = await loadDb();
  const profile = db.profiles.find((p) => p.id === userId);
  if (profile?.role === 'client') {
    const watched = await acceptedPassengerIds(userId);
    const groupIds = db.group_members
      .filter((m) => watched.includes(m.user_id))
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
  outbound_time?: string | null;
  return_time?: string | null;
}): Promise<Route> {
  if (isRemote()) return remote.createRoute(input);
  const route: Route = {
    id: uuid(),
    transporter_id: input.transporter_id,
    name: input.name,
    status: 'draft',
    outbound_time: input.outbound_time ?? null,
    return_time: input.return_time ?? null,
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

export async function updateRoute(
  id: string,
  input: {
    name: string;
    outbound_time?: string | null;
    return_time?: string | null;
    points?: { id?: string; name: string; sort_order: number }[];
  },
): Promise<Route> {
  if (isRemote()) return remote.updateRoute(id, input);
  const geocoded = input.points
    ? await Promise.all(
        input.points.map(async (point) =>
          point.id ? point : { ...point, ...(await geocodeAddress(point.name)) },
        ),
      )
    : undefined;
  let updated: Route | undefined;
  await mutateDb((db) => {
    const route = db.routes.find((item) => item.id === id);
    if (!route) throw new Error('Rota não encontrada.');
    route.name = input.name;
    route.outbound_time = input.outbound_time ?? null;
    route.return_time = input.return_time ?? null;
    if (geocoded?.length) {
      const live = db.trips.some((trip) => trip.route_id === id && trip.status === 'in_progress');
      if (live) throw new Error('Encerre o trajeto antes de mudar os pontos.');
      const keep = new Set(geocoded.map((point) => point.id).filter(Boolean));
      const removed = db.route_points.filter((point) => point.route_id === id && !keep.has(point.id));
      for (const point of removed) {
        for (const member of db.group_members) {
          if (member.point_id === point.id) member.point_id = null;
        }
      }
      db.route_points = db.route_points.filter(
        (point) => point.route_id !== id || keep.has(point.id),
      );
      for (const point of geocoded) {
        if (point.id) {
          const row = db.route_points.find((item) => item.id === point.id);
          if (!row) continue;
          row.name = point.name;
          row.sort_order = point.sort_order;
          continue;
        }
        const coords = point as { lat?: number; lng?: number };
        db.route_points.push({
          id: uuid(),
          route_id: id,
          name: point.name,
          lat: coords.lat ?? 0,
          lng: coords.lng ?? 0,
          sort_order: point.sort_order,
        });
      }
    }
    updated = route;
  });
  return updated as Route;
}

export async function deleteRoute(id: string): Promise<void> {
  if (isRemote()) return remote.deleteRoute(id);
  await mutateDb((db) => {
    const live = db.trips.some((trip) => trip.route_id === id && trip.status === 'in_progress');
    if (live) throw new Error('Encerre o trajeto antes de excluir a rota.');
    for (const group of db.groups) {
      if (group.route_id === id) group.route_id = null;
    }
    const tripIds = db.trips.filter((trip) => trip.route_id === id).map((trip) => trip.id);
    db.trips = db.trips.filter((trip) => trip.route_id !== id);
    db.trip_positions = db.trip_positions.filter((item) => !tripIds.includes(item.trip_id));
    db.boardings = (db.boardings ?? []).filter((item) => !tripIds.includes(item.trip_id));
    db.route_points = db.route_points.filter((point) => point.route_id !== id);
    db.routes = db.routes.filter((route) => route.id !== id);
  });
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
