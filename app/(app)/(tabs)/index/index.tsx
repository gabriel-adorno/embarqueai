import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MapView } from '@/src/components/map/MapView';
import { BottomSheet } from '@/src/components/ui/BottomSheet';
import { MapTopBar } from '@/src/components/ui/MapTopBar';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { EmptyState, LoadingState } from '@/src/components/ui/States';
import { getRoutePolyline, regionFromPoints } from '@/src/services/maps';
import { listRoutePoints, listRoutes } from '@/src/services/routes';
import {
  getLatestTripPosition,
  listActiveTripForRoute,
  subscribeTripPosition,
} from '@/src/services/trips';
import { colors } from '@/src/theme/colors';
import { TAB_SCREEN_BOTTOM } from '@/src/theme/layout';
import { useSessionStore } from '@/src/store/session';
import type { MapMarker, MapPolyline, TripPosition } from '@/src/types/database';

export default function HomeScreen() {
  const session = useSessionStore((s) => s.session);
  const user = session?.user;
  const firstName = user?.user_metadata.name?.split(' ')[0] ?? '';
  const [livePos, setLivePos] = useState<TripPosition | null>(null);

  const query = useQuery({
    queryKey: ['home-routes', user?.id],
    enabled: Boolean(user),
    staleTime: 15_000,
    refetchInterval: 15_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!user) return [];
      const routes = await listRoutes(user.id);
      return Promise.all(
        routes.map(async (route) => {
          const points = (await listRoutePoints(route.id)) ?? [];
          const line = await getRoutePolyline(points);
          const trip = await listActiveTripForRoute(route.id);
          const position =
            trip?.status === 'in_progress' ? await getLatestTripPosition(trip.id) : null;
          return { route, points, line, trip, position };
        }),
      );
    },
  });

  const liveTrip = query.data?.find((item) => item.trip?.status === 'in_progress')?.trip;

  useEffect(() => {
    if (!liveTrip?.id) {
      setLivePos(null);
      return;
    }
    return subscribeTripPosition(liveTrip.id, setLivePos);
  }, [liveTrip?.id]);

  const routes = query.data ?? [];
  const allPoints = routes.flatMap((item) => item.points);
  const regionRef = useRef(allPoints.length ? regionFromPoints(allPoints) : null);
  if (allPoints.length && !regionRef.current) {
    regionRef.current = regionFromPoints(allPoints);
  }

  if (query.isPending && !query.data) {
    return (
      <Screen tab>
        <LoadingState />
      </Screen>
    );
  }

  if (!routes.length) {
    return (
      <Screen tab>
        <ScreenTitle title={`Olá, ${firstName}`} subtitle="EmbarqueAI" />
        <EmptyState title="Nenhuma rota" hint="Quando uma rota for vinculada ao seu grupo, ela aparece no mapa." />
      </Screen>
    );
  }

  const live = Boolean(liveTrip);
  const van = livePos ?? routes.find((item) => item.trip?.id === liveTrip?.id)?.position ?? null;
  const markers: MapMarker[] = [
    ...allPoints.map((p) => ({
      id: p.id,
      title: p.name,
      lat: p.lat,
      lng: p.lng,
    })),
    ...(van
      ? [{ id: 'van', title: 'Van', lat: van.lat, lng: van.lng }]
      : []),
  ];
  const polylines: MapPolyline[] = routes
    .map((item) => item.line)
    .filter((line): line is MapPolyline => Boolean(line?.coordinates?.length));
  const mapRegion = regionRef.current ?? regionFromPoints(allPoints);
  const names = routes.map((item) => item.route.name).join(' · ');

  return (
    <View style={styles.root}>
      <View style={styles.map}>
        <MapView
          markers={markers}
          polylines={polylines}
          initialRegion={mapRegion}
          showsUserLocation={false}
        />
      </View>

      <MapTopBar>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.kicker}>EmbarqueAI</Text>
            <Text style={styles.hello}>Olá, {firstName}</Text>
          </View>
          {live ? (
            <View style={styles.liveChip}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Ao vivo</Text>
            </View>
          ) : null}
        </View>
      </MapTopBar>

      <View style={[styles.sheetWrap, { paddingBottom: 12 }]}>
        <BottomSheet floating>
          <Text style={styles.sheetKicker}>{live ? 'Acompanhe a van' : 'Suas rotas'}</Text>
          <Text style={styles.route}>{names}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, !live && styles.dotOff]} />
            <Text style={styles.status}>
              {live
                ? 'Van em rota'
                : 'Aguardando o transportador iniciar o trajeto'}
            </Text>
          </View>
        </BottomSheet>
      </View>
    </View>
  );
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
  kicker: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  hello: { fontSize: 22, fontWeight: '800', color: colors.tabInk, letterSpacing: -0.4 },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.live,
  },
  liveText: { fontWeight: '700', color: colors.tabInk, fontSize: 13 },
  sheetKicker: {
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
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.live,
  },
  dotOff: { backgroundColor: colors.textMuted },
  status: { fontWeight: '700', color: colors.ink, flex: 1 },
});
