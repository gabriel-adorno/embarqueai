import { isRemote } from '@/src/lib/config';
import * as remote from '@/src/services/remote';
import { loadDb } from '@/src/services/store';
import type { ReportSummary } from '@/src/types/database';

export async function getReport(): Promise<ReportSummary> {
  if (isRemote()) return remote.getReport();
  const db = await loadDb();
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const trips = db.trips
    .filter(
      (trip) =>
        trip.status === 'ended' &&
        trip.ended_at &&
        new Date(trip.ended_at).getTime() >= since,
    )
    .sort((a, b) => (b.ended_at ?? '').localeCompare(a.ended_at ?? ''));

  let boarded = 0;
  let absences = 0;
  const rows = trips.map((trip) => {
    const boardedCount = (db.boardings ?? []).filter(
      (item) => item.trip_id === trip.id && item.status === 'boarded',
    ).length;
    const day = trip.started_at.slice(0, 10);
    const absentCount = (db.absences ?? []).filter(
      (item) => item.group_id === trip.group_id && item.absent_on === day,
    ).length;
    boarded += boardedCount;
    absences += absentCount;
    return {
      route_name: db.routes.find((route) => route.id === trip.route_id)?.name ?? 'Rota',
      started_at: trip.started_at,
      ended_at: trip.ended_at,
      boarded: boardedCount,
      absent: absentCount,
    };
  });

  return { trips: trips.length, boarded, absences, rows };
}
