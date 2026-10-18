/**
 * Trocar corpo por supabase.from('trips') / supabase.from('trip_positions').
 * subscribeTripPosition: depois vira canal Supabase Realtime em trip_positions.
 */
import { isRemote } from '@/src/lib/config';
import { remainingAlong } from '@/src/lib/path';
import { uuid } from '@/src/lib/uuid';
import * as remote from '@/src/services/remote';
import { loadDb, mutateDb } from '@/src/services/store';
import type { Boarding, BoardingStatus, Trip, TripAlert, TripPosition } from '@/src/types/database';

export async function listActiveTripForGroup(
  groupId: string,
): Promise<Trip | null> {
  if (isRemote()) return remote.listActiveTripForGroup(groupId);
  const db = await loadDb();
  const group = db.groups.find((g) => g.id === groupId);
  if (group?.route_id) {
    const byRoute = db.trips.find(
      (t) => t.route_id === group.route_id && t.status === 'in_progress',
    );
    if (byRoute) return byRoute;
  }
  return (
    db.trips.find((t) => t.group_id === groupId && t.status === 'in_progress') ??
    null
  );
}

export async function listActiveTripForRoute(
  routeId: string,
): Promise<Trip | null> {
  if (isRemote()) return remote.listActiveTripForRoute(routeId);
  const db = await loadDb();
  return (
    db.trips.find((t) => t.route_id === routeId && t.status === 'in_progress') ??
    null
  );
}

export async function getTrip(id: string): Promise<Trip | null> {
  if (isRemote()) return remote.getTrip(id);
  const db = await loadDb();
  return db.trips.find((t) => t.id === id) ?? null;
}

export async function startTrip(input: {
  route_id: string;
  group_id: string;
  lat: number;
  lng: number;
  leg?: 'outbound' | 'return';
}): Promise<Trip> {
  if (isRemote()) return remote.startTrip(input);
  const trip: Trip = {
    id: uuid(),
    route_id: input.route_id,
    group_id: input.group_id,
    started_at: new Date().toISOString(),
    ended_at: null,
    status: 'in_progress',
    leg: input.leg === 'return' ? 'return' : 'outbound',
  };
  await mutateDb((db) => {
    db.trips.push(trip);
    db.trip_positions.push({
      trip_id: trip.id,
      lat: input.lat,
      lng: input.lng,
      recorded_at: new Date().toISOString(),
    });
  });
  return trip;
}

export async function listAlerts(): Promise<TripAlert[]> {
  if (isRemote()) return remote.listAlerts();
  const db = await loadDb();
  const since = Date.now() - 2 * 24 * 60 * 60 * 1000;
  return (db.trip_alerts ?? [])
    .filter((item) => new Date(item.created_at).getTime() >= since)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((alert) => ({
      ...alert,
      replies: (db.trip_alert_replies ?? [])
        .filter((reply) => reply.alert_id === alert.id)
        .map((reply) => ({
          ...reply,
          user_name: db.profiles.find((profile) => profile.id === reply.user_id)?.name,
        })),
    }));
}

const REPLIES = ['Já estou no ponto', 'Pode seguir'];

export async function replyToAlert(userId: string, alertId: string, message: string): Promise<void> {
  if (!REPLIES.includes(message)) throw new Error('Resposta inválida.');
  if (isRemote()) return remote.replyToAlert(alertId, message);
  await mutateDb((db) => {
    db.trip_alert_replies ??= [];
    const current = db.trip_alert_replies.find(
      (item) => item.alert_id === alertId && item.user_id === userId,
    );
    if (current) {
      current.message = message;
      return;
    }
    db.trip_alert_replies.push({
      id: uuid(),
      alert_id: alertId,
      user_id: userId,
      message,
    });
  });
}

export async function sendTripAlert(tripId: string, message: string): Promise<void> {
  if (isRemote()) return remote.sendTripAlert(tripId, message);
  const text = message.trim();
  if (text.length < 3) throw new Error('Escreva o aviso.');
  await mutateDb((db) => {
    const trip = db.trips.find((item) => item.id === tripId && item.status === 'in_progress');
    if (!trip) throw new Error('O trajeto não está em andamento.');
    db.trip_alerts ??= [];
    db.trip_alerts.push({
      id: uuid(),
      trip_id: tripId,
      message: text,
      created_at: new Date().toISOString(),
    });
  });
}

export async function listMyActiveTrip(): Promise<Trip | null> {
  if (isRemote()) return remote.listMyActiveTrip();
  const db = await loadDb();
  return db.trips.find((trip) => trip.status === 'in_progress') ?? null;
}

export async function listTripHistory(): Promise<Trip[]> {
  if (isRemote()) return remote.listTripHistory();
  const db = await loadDb();
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return db.trips
    .filter((trip) => trip.status === 'ended' && trip.ended_at && new Date(trip.ended_at).getTime() >= since)
    .sort((a, b) => (b.ended_at ?? '').localeCompare(a.ended_at ?? ''));
}

export async function publishDriverPosition(routeId: string, lat: number, lng: number): Promise<void> {
  if (isRemote()) {
    const trip = await listActiveTripForRoute(routeId);
    if (!trip) return;
    try {
      await remote.publishTripPosition(trip.id, lat, lng);
    } catch (err) {
      if (err instanceof Error && /404/.test(err.message)) return;
      throw err;
    }
    return;
  }
  await mutateDb((db) => {
    const points = db.route_points
      .filter((point) => point.route_id === routeId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((point) => ({ lat: point.lat, lng: point.lng }));
    const remaining_m = remainingAlong(points, { lat, lng });
    const recorded_at = new Date().toISOString();
    for (const trip of db.trips) {
      if (trip.route_id !== routeId || trip.status !== 'in_progress') continue;
      db.trip_positions.push({
        trip_id: trip.id,
        lat,
        lng,
        remaining_m,
        recorded_at,
        source: 'gps',
      });
    }
  });
}

export async function listBoardings(tripId: string): Promise<Boarding[]> {
  if (isRemote()) return remote.listBoardings(tripId);
  const db = await loadDb();
  return (db.boardings ?? []).filter((item) => item.trip_id === tripId);
}

export async function setBoarding(
  tripId: string,
  userId: string,
  status: BoardingStatus,
): Promise<void> {
  if (isRemote()) return remote.setBoarding(tripId, userId, status);
  await mutateDb((db) => {
    db.boardings ??= [];
    const current = db.boardings.find((item) => item.trip_id === tripId && item.user_id === userId);
    if (current) {
      current.status = status;
      current.recorded_at = new Date().toISOString();
      return;
    }
    db.boardings.push({
      id: uuid(),
      trip_id: tripId,
      user_id: userId,
      status,
      recorded_at: new Date().toISOString(),
    });
  });
}

export async function stopTrip(tripId: string): Promise<Trip> {
  if (isRemote()) return remote.stopTrip(tripId);
  let updated: Trip | undefined;
  await mutateDb((db) => {
    const trip = db.trips.find((t) => t.id === tripId);
    if (!trip) throw new Error('Viagem não encontrada.');
    trip.status = 'ended';
    trip.ended_at = new Date().toISOString();
    updated = trip;
  });
  return updated as Trip;
}

export async function appendTripPosition(
  tripId: string,
  lat: number,
  lng: number,
): Promise<void> {
  await mutateDb((db) => {
    db.trip_positions.push({
      trip_id: tripId,
      lat,
      lng,
      recorded_at: new Date().toISOString(),
      source: 'sim',
    });
  });
}

export async function getLatestTripPosition(
  tripId: string,
): Promise<TripPosition | null> {
  if (isRemote()) return remote.getLatestTripPosition(tripId);
  const db = await loadDb();
  const positions = db.trip_positions.filter((p) => p.trip_id === tripId);
  return positions[positions.length - 1] ?? null;
}

/**
 * UI só conhece este subscribe. Mock: setInterval movendo um ponto.
 * Depois: supabase.channel(...).on('postgres_changes', { table: 'trip_positions' }).
 */
export function subscribeTripPosition(
  tripId: string,
  callback: (position: TripPosition) => void,
): () => void {
  if (isRemote()) return remote.subscribeTripPosition(tripId, callback);
  let t = 0;
  const timer = setInterval(() => {
    void (async () => {
      const db = await loadDb();
      const trip = db.trips.find((item) => item.id === tripId);
      if (!trip || trip.status !== 'in_progress') return;
      const positions = db.trip_positions.filter((item) => item.trip_id === tripId);
      const latest = positions[positions.length - 1];
      if (latest?.source === 'gps') {
        const age = Date.now() - new Date(latest.recorded_at).getTime();
        if (age < 20_000) {
          callback(latest);
          return;
        }
      }
      const points = db.route_points
        .filter((p) => p.route_id === trip.route_id)
        .sort((a, b) => a.sort_order - b.sort_order);
      if (points.length < 2) return;
      const idx = t % (points.length - 1);
      const from = points[idx];
      const to = points[idx + 1];
      const local = (t * 0.08) % 1;
      const lat = from.lat + (to.lat - from.lat) * local;
      const lng = from.lng + (to.lng - from.lng) * local;
      t += 1;
      const remaining_m = remainingAlong(
        points.map((point) => ({ lat: point.lat, lng: point.lng })),
        { lat, lng },
      );
      await appendTripPosition(tripId, lat, lng);
      callback({
        trip_id: tripId,
        lat,
        lng,
        remaining_m,
        recorded_at: new Date().toISOString(),
        source: 'sim',
      });
    })();
  }, 2000);

  return () => clearInterval(timer);
}
