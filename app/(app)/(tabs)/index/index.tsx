import { LinearGradient } from 'expo-linear-gradient';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MapView } from '@/src/components/map/MapView';
import { BottomSheet } from '@/src/components/ui/BottomSheet';
import { BrandMark } from '@/src/components/ui/BrandMark';
import { Button } from '@/src/components/ui/Button';
import { ListRow } from '@/src/components/ui/ListRow';
import { MapTopBar } from '@/src/components/ui/MapTopBar';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/States';
import { listGroupsForClient, listGroupsForTransporter } from '@/src/services/groups';
import { buildRoutePolyline, DEFAULT_REGION, regionFromPoints } from '@/src/services/maps';
import { listRoutePoints } from '@/src/services/routes';
import { getLatestTripPosition, listActiveTripForGroup } from '@/src/services/trips';
import { href } from '@/src/lib/href';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/session';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSessionStore((s) => s.session);
  const user = session?.user;
  const role = user?.user_metadata.role;
  const isTransporter = role === 'transporter';
  const firstName = user?.user_metadata.name.split(' ')[0] ?? '';

  const groupsQuery = useQuery({
    queryKey: ['groups', role, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) return [];
      return isTransporter
        ? listGroupsForTransporter(user.id)
        : listGroupsForClient(user.id);
    },
  });

  const mapQuery = useQuery({
    queryKey: ['home-map', groupsQuery.data?.map((g) => g.id).join(',')],
    enabled: Boolean(groupsQuery.data),
    queryFn: async () => {
      const groups = groupsQuery.data ?? [];
      const first = groups[0];
      if (!first) {
        return { markers: [], polyline: undefined, region: DEFAULT_REGION, tripId: null };
      }
      const points = await listRoutePoints(first.route_id);
      const trip = await listActiveTripForGroup(first.id);
      const position = trip ? await getLatestTripPosition(trip.id) : null;
      const markers = points.map((p) => ({
        id: p.id,
        title: p.name,
        lat: p.lat,
        lng: p.lng,
      }));
      if (position) {
        markers.push({
          id: `van-${trip?.id}`,
          title: 'Van',
          lat: position.lat,
          lng: position.lng,
        });
      }
      return {
        markers,
        polyline: buildRoutePolyline(points),
        region: regionFromPoints(points),
        tripId: trip?.id ?? null,
        groupId: first.id,
      };
    },
  });

  const live = Boolean(mapQuery.data?.tripId);

  return (
    <View style={styles.root}>
      <View style={styles.map}>
        {mapQuery.isLoading ? <LoadingState label="Carregando mapa..." /> : null}
        {mapQuery.isError ? (
          <ErrorState message="Não foi possível carregar o mapa." />
        ) : null}
        {mapQuery.data ? (
          <MapView
            markers={mapQuery.data.markers}
            polyline={mapQuery.data.polyline}
            initialRegion={mapQuery.data.region}
          />
        ) : null}
      </View>

      <LinearGradient
        pointerEvents="none"
        colors={['rgba(14,42,71,0.28)', 'transparent']}
        style={[styles.mapFade, { height: insets.top + 90 }]}
      />

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
          ) : (
            <BrandMark compact />
          )}
        </View>
      </MapTopBar>

      <View style={[styles.sheetWrap, { bottom: Math.max(insets.bottom, 10) + 70 }]}>
        <BottomSheet floating>
          <Text style={styles.sheetKicker}>
            {isTransporter ? 'Operação' : 'Sua viagem'}
          </Text>
          {isTransporter ? (
            <>
              <ListRow
                icon="navigate-outline"
                glyph="🧭"
                title="Minhas rotas"
                subtitle="Pontos e início do trajeto"
                onPress={() => router.push('/(app)/(tabs)/routes')}
              />
              <ListRow
                icon="people-outline"
                glyph="👥"
                title="Grupos"
                subtitle="Veículo, rota e membros"
                onPress={() => router.push('/(app)/(tabs)/groups')}
              />
              <ListRow
                icon="bus-outline"
                glyph="🚐"
                title="Veículos"
                subtitle="Tipo e placa"
                onPress={() => router.push(href('/(app)/(tabs)/profile/vehicles'))}
              />
              <View style={styles.cta}>
                <Button
                  label="Iniciar rota"
                  onPress={() => router.push('/(app)/(tabs)/routes')}
                />
              </View>
            </>
          ) : (
            <>
              <ListRow
                icon="location-outline"
                glyph="📍"
                title="Rota ao vivo"
                subtitle={
                  live
                    ? 'Localização do transporte em tempo real'
                    : 'Nenhuma rota em andamento agora'
                }
                onPress={
                  mapQuery.data?.tripId
                    ? () =>
                        router.push(
                          href(`/(app)/(tabs)/index/trip/${mapQuery.data!.tripId}`),
                        )
                    : undefined
                }
              />
              <ListRow
                icon="people-outline"
                glyph="🚐"
                title="Van vinculada"
                subtitle="Grupo e motorista"
                onPress={() => router.push('/(app)/(tabs)/groups')}
              />
              {!live ? (
                <EmptyState
                  title="Nenhuma rota em andamento"
                  hint="Quando o trajeto começar, a van aparece no mapa."
                  glyph="🚐"
                />
              ) : (
                <View style={styles.cta}>
                  <Button
                    label="Acompanhar van"
                    onPress={() =>
                      router.push(href(`/(app)/(tabs)/index/trip/${mapQuery.data!.tripId}`))
                    }
                  />
                </View>
              )}
            </>
          )}
        </BottomSheet>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  map: { ...StyleSheet.absoluteFill },
  mapFade: { position: 'absolute', top: 0, left: 0, right: 0 },
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
  sheetWrap: {
    position: 'absolute',
    left: 12,
    right: 12,
  },
  sheetKicker: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  cta: { marginTop: 6 },
});
