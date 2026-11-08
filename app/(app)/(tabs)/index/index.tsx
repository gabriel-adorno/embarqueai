import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { MapView } from '@/src/components/map/MapView';
import { BottomSheet } from '@/src/components/ui/BottomSheet';
import { Button } from '@/src/components/ui/Button';
import { MapTopBar } from '@/src/components/ui/MapTopBar';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { EmptyState, LoadingState } from '@/src/components/ui/States';
import { listFollows } from '@/src/services/follows';
import {
  clearAbsence,
  listAbsences,
  listGroupMembers,
  listGroupsForClient,
  listGroupsForTransporter,
  setAbsence,
} from '@/src/services/groups';
import { href } from '@/src/lib/href';
import { listVehicles } from '@/src/services/vehicles';
import { FirstSteps } from '@/src/components/trip/FirstSteps';
import { getRoutePolyline, regionFromPoints } from '@/src/services/maps';
import { listRoutePoints, listRoutes } from '@/src/services/routes';
import {
  getLatestTripPosition,
  listActiveTripForRoute,
  listAlerts,
  replyToAlert,
  subscribeTripPosition,
} from '@/src/services/trips';
import { formatEta } from '@/src/lib/eta';
import { notifyError } from '@/src/lib/notify';
import { remainingUntil } from '@/src/lib/path';
import { colors } from '@/src/theme/colors';
import { TAB_SCREEN_BOTTOM } from '@/src/theme/layout';
import { useSessionStore } from '@/src/store/session';
import type { MapMarker, MapPolyline, TripPosition } from '@/src/types/database';

export default function HomeScreen() {
  const qc = useQueryClient();
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
      const [routes, groups, follows] = await Promise.all([
        listRoutes(user.id),
        listGroupsForClient(user.id).catch(() => []),
        listFollows(user.id).catch(() => ({ watching: [], watched_by: [] })),
      ]);
      const watched = new Map(
        follows.watching
          .filter((item) => item.status === 'accepted')
          .map((item) => [item.passenger_id, item.person?.name ?? 'Passageiro']),
      );
      return Promise.all(
        routes.map(async (route) => {
          const points = (await listRoutePoints(route.id)) ?? [];
          const line = await getRoutePolyline(points);
          const trip = await listActiveTripForRoute(route.id);
          const position =
            trip?.status === 'in_progress' ? await getLatestTripPosition(trip.id) : null;
          const riders: { name: string; eta: string | null }[] = [];
          const path = (line?.coordinates ?? points.map((point) => ({
            latitude: point.lat,
            longitude: point.lng,
          }))).map((point) => ({ lat: point.latitude, lng: point.longitude }));
          for (const group of groups.filter((item) => item.route_id === route.id)) {
            const members = await listGroupMembers(group.id).catch(() => []);
            for (const member of members) {
              const own = member.user_id === user.id;
              const followed = watched.get(member.user_id);
              if (!own && !followed) continue;
              const stop = points.find((point) => point.id === member.point_id);
              const eta =
                stop && position && path.length
                  ? formatEta(
                      remainingUntil(path, { lat: position.lat, lng: position.lng }, stop),
                      trip?.status === 'in_progress',
                    )
                  : null;
              riders.push({ name: own ? 'Você' : followed!, eta });
            }
          }
          return { route, points, line, trip, position, riders };
        }),
      );
    },
  });

  // Grupos em que o próprio usuário viaja (não os de quem ele acompanha) e a ausência de hoje.
  const router = useRouter();
  const mine = useQuery({
    queryKey: ['home-my-groups', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const groups = await listGroupsForClient(user!.id).catch(() => []);
      const out: { id: string; name: string; absent: boolean }[] = [];
      for (const group of groups) {
        const members = await listGroupMembers(group.id).catch(() => []);
        if (!members.some((member) => member.user_id === user!.id)) continue;
        const absences = await listAbsences(group.id).catch(() => []);
        out.push({
          id: group.id,
          name: group.name,
          absent: absences.some((item) => item.user_id === user!.id),
        });
      }
      return out;
    },
  });

  const absenceMut = useMutation({
    mutationFn: (input: { groupId: string; absent: boolean }) =>
      input.absent ? clearAbsence(input.groupId, user!.id) : setAbsence(input.groupId, user!.id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['home-my-groups'] });
      void qc.invalidateQueries({ queryKey: ['group'] });
    },
    onError: (err: Error) => notifyError(err.message),
  });

  const isTransporter = user?.user_metadata.role === 'transporter';
  const setup = useQuery({
    queryKey: ['first-steps', user?.id],
    enabled: Boolean(user) && isTransporter,
    queryFn: async () => {
      const [vehicles, groups] = await Promise.all([
        listVehicles(user!.id).catch(() => []),
        listGroupsForTransporter(user!.id).catch(() => []),
      ]);
      return { vehicles: vehicles.length, groups: groups.length };
    },
  });
  // Ao voltar para o Início (ex.: depois de cadastrar o veículo), atualiza os passos.
  const refetchSetup = setup.refetch;
  useFocusEffect(
    useCallback(() => {
      if (isTransporter) void refetchSetup();
    }, [isTransporter, refetchSetup]),
  );

  const alerts = useQuery({
    queryKey: ['alerts', user?.id],
    enabled: Boolean(user),
    refetchInterval: 20_000,
    queryFn: () => listAlerts().catch(() => []),
  });
  const latestAlert = alerts.data?.[0];

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
    if (user?.user_metadata.role === 'transporter') {
      return (
        <Screen tab refreshable>
          <ScreenTitle title={`Olá, ${firstName}`} subtitle="Vamos montar sua operação" />
          <FirstSteps
            vehicles={setup.data?.vehicles ?? 0}
            groups={setup.data?.groups ?? 0}
            routes={0}
          />
        </Screen>
      );
    }
    return (
      <Screen tab refreshable>
        <ScreenTitle title={`Olá, ${firstName}`} subtitle="EmbarqueAI" />
        <EmptyState
          title="Nenhuma rota"
          hint="Quando uma rota for vinculada a você ou a alguém que você acompanha, ela aparece no mapa."
        />
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
      ? [{ id: 'van', title: 'Veículo', lat: van.lat, lng: van.lng }]
      : []),
  ];
  const polylines: MapPolyline[] = routes
    .map((item) => item.line)
    .filter((line): line is MapPolyline => Boolean(line?.coordinates?.length));
  const mapRegion = regionRef.current ?? regionFromPoints(allPoints);
  const names = routes.map((item) => item.route.name).join(' · ');
  const riderLines = routes.flatMap((item) =>
    item.riders.map(
      (rider) =>
        `${rider.name} · ${item.route.name}${rider.eta ? ` · ${rider.eta}` : ''}`,
    ),
  );

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
          <Text style={styles.sheetKicker}>{live ? 'Acompanhe o veículo' : 'Suas rotas'}</Text>
          <Text style={styles.route}>{riderLines.length ? riderLines.join('\n') : names}</Text>
          {latestAlert ? <Text style={styles.alert}>Aviso: {latestAlert.message}</Text> : null}
          {latestAlert?.replies?.map((reply) => (
            <Text key={reply.id} style={styles.reply}>
              {reply.user_name ?? 'Passageiro'}: {reply.message}
            </Text>
          ))}
          {latestAlert && user && user.user_metadata.role !== 'transporter' ? (
            <View style={styles.replies}>
              <View style={styles.replyAction}>
                <Button
                  size="sm"
                  label="Já estou no ponto"
                  onPress={() =>
                    void replyToAlert(user.id, latestAlert.id, 'Já estou no ponto')
                      .then(() => qc.invalidateQueries({ queryKey: ['alerts'] }))
                      .catch((err: Error) => notifyError(err.message))
                  }
                />
              </View>
              <View style={styles.replyAction}>
                <Button
                  size="sm"
                  variant="secondary"
                  label="Pode seguir"
                  onPress={() =>
                    void replyToAlert(user.id, latestAlert.id, 'Pode seguir')
                      .then(() => qc.invalidateQueries({ queryKey: ['alerts'] }))
                      .catch((err: Error) => notifyError(err.message))
                  }
                />
              </View>
            </View>
          ) : null}
          {(mine.data ?? []).map((group) => (
            <View key={group.id} style={styles.mineRow}>
              {!live ? (
                <View style={styles.replyAction}>
                  <Button
                    size="sm"
                    variant={group.absent ? 'secondary' : 'danger'}
                    label={group.absent ? 'Vou hoje' : 'Não vou hoje'}
                    loading={absenceMut.isPending && absenceMut.variables?.groupId === group.id}
                    onPress={() => absenceMut.mutate({ groupId: group.id, absent: group.absent })}
                  />
                </View>
              ) : null}
              <View style={styles.replyAction}>
                <Button
                  size="sm"
                  variant="secondary"
                  label={(mine.data?.length ?? 0) > 1 ? group.name : 'Meu grupo'}
                  onPress={() =>
                    router.push(href({ pathname: '/(app)/(tabs)/groups/[id]', params: { id: group.id } }))
                  }
                />
              </View>
            </View>
          ))}
          {mine.data?.some((group) => group.absent) && !live ? (
            <Text style={styles.reply}>Você avisou que não vai hoje.</Text>
          ) : null}
          <View style={styles.statusRow}>
            <View style={[styles.dot, !live && styles.dotOff]} />
            <Text style={styles.status}>
              {live
                ? (() => {
                    const eta = formatEta(van?.remaining_m, true);
                    return eta === 'Chegando' ? 'Em rota · chegando' : `Em rota · chegada ${eta}`;
                  })()
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
  alert: { color: colors.ink, fontWeight: '700', marginBottom: 8 },
  reply: { color: colors.textMuted, marginBottom: 4 },
  replies: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  replyAction: { flex: 1 },
  mineRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
});
