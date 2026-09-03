/**
 * Trocar corpo por supabase.from('trips') / supabase.from('trip_positions').
 * subscribeTripPosition: depois vira canal Supabase Realtime em trip_positions.
 */
import { uuid } from '@/src/lib/uuid';
import { loadDb, mutateDb } from '@/src/services/store';
import type { Trip, TripPosition } from '@/src/types/database';

export async function listActiveTripForGroup(
  groupId: string,
): Promise<Trip | null> {
  const db = await loadDb();
  return (
    db.trips.find((t) => t.group_id === groupId && t.status === 'in_progress') ??
    null
  );
}

export async function listActiveTripForRoute(
  routeId: string,
): Promise<Trip | null> {
  const db = await loadDb();
  return (
    db.trips.find((t) => t.route_id === routeId && t.status === 'in_progress') ??
    null
  );
}

export async function getTrip(id: string): Promise<Trip | null> {
  const db = await loadDb();
  return db.trips.find((t) => t.id === id) ?? null;
}

export async function startTrip(input: {
  route_id: string;
  group_id: string;
  lat: number;
  lng: number;
}): Promise<Trip> {
  const trip: Trip = {
    id: uuid(),
    route_id: input.route_id,
    group_id: input.group_id,
    started_at: new Date().toISOString(),
    ended_at: null,
    status: 'in_progress',
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

export async function stopTrip(tripId: string): Promise<Trip> {
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
    });
  });
}

export async function getLatestTripPosition(
  tripId: string,
): Promise<TripPosition | null> {
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
  let t = 0;
  const timer = setInterval(() => {
    void (async () => {
      const db = await loadDb();
      const trip = db.trips.find((item) => item.id === tripId);
      if (!trip || trip.status !== 'in_progress') return;
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
      await appendTripPosition(tripId, lat, lng);
      callback({
        trip_id: tripId,
        lat,
        lng,
        recorded_at: new Date().toISOString(),
      });
    })();
  }, 2000);

  return () => clearInterval(timer);
}
