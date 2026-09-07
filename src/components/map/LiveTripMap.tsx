import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MapView } from '@/src/components/map/MapView';
import { BottomSheet } from '@/src/components/ui/BottomSheet';
import { ErrorState, LoadingState } from '@/src/components/ui/States';
import { MapTopBar } from '@/src/components/ui/MapTopBar';
import {
  buildRoutePolyline,
  formatRemainingKm,
  getRoutePolyline,
  regionFromPoints,
} from '@/src/services/maps';
import { getRoute, listRoutePoints } from '@/src/services/routes';
import {
  getLatestTripPosition,
  listActiveTripForRoute,
  subscribeTripPosition,
} from '@/src/services/trips';
import { colors } from '@/src/theme/colors';
import { TAB_SCREEN_BOTTOM } from '@/src/theme/layout';
import type { TripPosition } from '@/src/types/database';

type Props = {
  routeId: string;
  header: ReactNode;
};

export function LiveTripMap({ routeId, header }: Props) {
  const [live, setLive] = useState<TripPosition | null>(null);

  const query = useQuery({
    queryKey: ['route-live', routeId],
    enabled: Boolean(routeId),
    staleTime: 30_000,
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const route = await getRoute(routeId);
      if (!route) throw new Error('Rota não encontrada.');
      const trip = await listActiveTripForRoute(routeId);
      if (!trip || trip.status !== 'in_progress') {
        return { route, points: [], trip: null, position: null, line: undefined };
      }
      const points = (await listRoutePoints(routeId)) ?? [];
      const position = await getLatestTripPosition(trip.id);
      const line = await getRoutePolyline(points);
      return { route, points, trip, position, line };
    },
  });

  const tripId = query.data?.trip?.id;
  const inProgress = query.data?.trip?.status === 'in_progress';

  useEffect(() => {
    if (!tripId || !inProgress) return;
    return subscribeTripPosition(tripId, setLive);
  }, [tripId, inProgress]);

  const position = live ?? query.data?.position ?? null;
  const elapsed = query.data?.trip
    ? minutesSince(query.data.trip.started_at)
    : null;

  const regionRef = useRef(query.data ? regionFromPoints(query.data.points) : null);
  if (query.data?.points.length && !regionRef.current) {
    regionRef.current = regionFromPoints(query.data.points);
  }
  const lineRef = useRef(query.data?.line);
  if (query.data?.line && !lineRef.current) {
    lineRef.current = query.data.line;
  }

  if (query.isPending && !query.data) {
    return (
      <View style={styles.root}>
        <LoadingState />
      </View>
    );
  }

  if ((query.isError && !query.data) || !query.data || !inProgress) {
    return (
      <View style={styles.root}>
        <ErrorState message="Não foi possível abrir o mapa ao vivo." />
      </View>
    );
  }

  const mapLine = lineRef.current ?? query.data.line ?? buildRoutePolyline(query.data.points);
  const mapRegion = regionRef.current ?? regionFromPoints(query.data.points);

  return (
    <View style={styles.root}>
      <View style={styles.map}>
        <MapView
          markers={[
            ...query.data.points.map((p) => ({
              id: p.id,
              title: p.name,
              lat: p.lat,
              lng: p.lng,
            })),
            ...(position
              ? [{ id: 'van', title: 'Van', lat: position.lat, lng: position.lng }]
              : []),
          ]}
          polyline={mapLine}
          initialRegion={mapRegion}
          showsUserLocation={false}
        />
      </View>

      <MapTopBar>{header}</MapTopBar>

      <View style={[styles.sheetWrap, { paddingBottom: 12 }]}>
        <BottomSheet floating>
          <Text style={styles.kicker}>Acompanhe a van</Text>
          <Text style={styles.route}>{query.data.route.name}</Text>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Distância restante</Text>
              <Text style={styles.statValue}>
                {formatRemainingKm(position?.remaining_m, true)}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Tempo</Text>
              <Text style={styles.statValue}>
                {elapsed ? `${elapsed.h}h ${elapsed.m} min` : '—'}
              </Text>
            </View>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.dot} />
            <Text style={styles.status}>Van em rota</Text>
          </View>
        </BottomSheet>
      </View>
    </View>
  );
}

function minutesSince(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const total = Math.floor(diff / 60000);
  return { h: Math.floor(total / 60), m: total % 60 };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  map: { ...StyleSheet.absoluteFill },
  sheetWrap: { position: 'absolute', left: 12, right: 12, bottom: TAB_SCREEN_BOTTOM - 40 },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  route: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    marginTop: 6,
    marginBottom: 16,
    letterSpacing: -0.5,
  },
  stats: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
  },
  statLabel: { color: colors.textMuted, fontSize: 13 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.ink, marginTop: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.live,
  },
  status: { fontWeight: '700', color: colors.ink, flex: 1 },
});
