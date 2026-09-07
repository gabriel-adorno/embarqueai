import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MapView } from '@/src/components/map/MapView';
import { BackButton } from '@/src/components/ui/BackButton';
import { BottomSheet } from '@/src/components/ui/BottomSheet';
import { ErrorState, LoadingState } from '@/src/components/ui/States';
import { MapTopBar } from '@/src/components/ui/MapTopBar';
import { buildRoutePolyline, formatRemainingKm, getRoutePolyline, regionFromPoints } from '@/src/services/maps';
import { getRoute, listRoutePoints } from '@/src/services/routes';
import {
  getLatestTripPosition,
  getTrip,
  subscribeTripPosition,
} from '@/src/services/trips';
import { colors } from '@/src/theme/colors';
import { TAB_SCREEN_BOTTOM } from '@/src/theme/layout';
import type { TripPosition } from '@/src/types/database';

export default function TripScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [live, setLive] = useState<TripPosition | null>(null);

  const query = useQuery({
    queryKey: ['trip', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const trip = await getTrip(id);
      if (!trip) throw new Error('Viagem não encontrada.');
      const [route, points, position] = await Promise.all([
        getRoute(trip.route_id),
        listRoutePoints(trip.route_id),
        getLatestTripPosition(trip.id),
      ]);
      const line = await getRoutePolyline(points);
      return { trip, route, points, position, line };
    },
  });

  useEffect(() => {
    if (!id || query.data?.trip.status !== 'in_progress') return;
    const unsub = subscribeTripPosition(id, setLive);
    return unsub;
  }, [id, query.data?.trip.status]);

  const position = live ?? query.data?.position ?? null;
  const elapsed = query.data
    ? minutesSince(query.data.trip.started_at)
    : { h: 0, m: 0 };
  const inProgress = query.data?.trip.status === 'in_progress';

  return (
    <View style={styles.root}>
      <View style={styles.map}>
        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? <ErrorState message="Não foi possível abrir a viagem." /> : null}
        {query.data ? (
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
            polyline={query.data.line ?? buildRoutePolyline(query.data.points)}
            initialRegion={regionFromPoints(query.data.points)}
          />
        ) : null}
      </View>

      <MapTopBar>
        <View style={styles.topRow}>
          <BackButton />
          <Text style={styles.topTitle}>Viagem</Text>
          <View style={styles.topSpacer} />
        </View>
      </MapTopBar>

      {query.data ? (
        <View style={[styles.sheetWrap, { paddingBottom: 12 }]}>
          <BottomSheet floating>
            <Text style={styles.kicker}>Informações da viagem</Text>
            <Text style={styles.route}>{query.data.route?.name}</Text>
            <View style={styles.stats}>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Distância restante</Text>
                <Text style={styles.statValue}>
                  {formatRemainingKm(position?.remaining_m, inProgress)}
                </Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statLabel}>Tempo</Text>
                <Text style={styles.statValue}>
                  {elapsed.h}h {elapsed.m} min
                </Text>
              </View>
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.dot, !inProgress && styles.dotOff]} />
              <Text style={styles.status}>
                {inProgress ? 'Em rota' : 'Trajeto encerrado'}
              </Text>
            </View>
          </BottomSheet>
        </View>
      ) : null}
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.tabInk,
    letterSpacing: -0.3,
  },
  topSpacer: { width: 44, height: 44 },
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
  dotOff: { backgroundColor: colors.textMuted },
  status: { fontWeight: '700', color: colors.ink },
});
