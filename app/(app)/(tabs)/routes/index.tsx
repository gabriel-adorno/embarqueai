import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { ConfirmModal } from '@/src/components/ui/ConfirmModal';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/States';
import { listGroupsForTransporter } from '@/src/services/groups';
import { listRoutePoints, listRoutes, updateRouteStatus } from '@/src/services/routes';
import { listActiveTripForRoute, startTrip, stopTrip } from '@/src/services/trips';
import { useSessionStore } from '@/src/store/session';
import { href } from '@/src/lib/href';
import { notifyError } from '@/src/lib/notify';

export default function RoutesTab() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSessionStore((s) => s.session?.user);
  const [confirmStart, setConfirmStart] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['routes', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) return [];
      const routes = await listRoutes(user.id);
      return Promise.all(
        routes.map(async (route) => ({
          ...route,
          points: await listRoutePoints(route.id),
          trip: await listActiveTripForRoute(route.id),
        })),
      );
    },
  });

  const startMut = useMutation({
    mutationFn: async (routeId: string) => {
      const groups = await listGroupsForTransporter(user!.id);
      const group = groups.find((g) => g.route_id === routeId);
      if (!group) throw new Error('Vincule esta rota a um grupo antes de iniciar.');
      const points = await listRoutePoints(routeId);
      const first = points[0];
      if (!first) throw new Error('A rota precisa de pontos.');
      await updateRouteStatus(routeId, 'active');
      return startTrip({
        route_id: routeId,
        group_id: group.id,
        lat: first.lat,
        lng: first.lng,
      });
    },
    onSuccess: (trip) => {
      void qc.invalidateQueries();
      router.push(href(`/(app)/(tabs)/index/trip/${trip.id}`));
    },
    onError: (err: Error) => notifyError(err.message),
  });

  const stopMut = useMutation({
    mutationFn: async (routeId: string) => {
      const trip = await listActiveTripForRoute(routeId);
      if (!trip) throw new Error('Nenhum trajeto ativo.');
      await stopTrip(trip.id);
      await updateRouteStatus(routeId, 'stopped');
    },
    onSuccess: () => {
      void qc.invalidateQueries();
    },
    onError: (err: Error) => notifyError(err.message),
  });

  if (user?.user_metadata.role !== 'transporter') {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return (
    <>
    <Screen tab>
        <ScreenTitle title="Rotas" subtitle="Pontos e início do trajeto" />
        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? <ErrorState message="Falha ao carregar rotas." /> : null}
        {query.data?.length === 0 ? (
          <EmptyState title="Nenhuma rota" hint="Crie uma rota com pelo menos dois pontos." />
        ) : null}
        {query.data?.map((route) => (
          <View key={route.id} style={styles.block}>
            <ListRow
              icon="navigate-outline"
              glyph="🧭"
              title={route.name}
              subtitle={`${route.points.length} pontos · ${statusLabel(route.status)}`}
              onPress={() =>
                route.trip ? setConfirmStop(route.id) : setConfirmStart(route.id)
              }
            />
            {route.trip ? (
              <Button
                label="Parar trajeto"
                variant="danger"
                onPress={() => setConfirmStop(route.id)}
              />
            ) : (
              <Button label="Iniciar rota" onPress={() => setConfirmStart(route.id)} />
            )}
          </View>
        ))}
        <View style={styles.footer}>
          <Button label="Criar rota" onPress={() => router.push(href('/(app)/(tabs)/routes/new'))} />
        </View>
    </Screen>
      <ConfirmModal
        visible={Boolean(confirmStart)}
        title="Deseja mesmo iniciar essa rota?"
        onNo={() => setConfirmStart(null)}
        onYes={() => {
          if (confirmStart) startMut.mutate(confirmStart);
          setConfirmStart(null);
        }}
      />
      <ConfirmModal
        visible={Boolean(confirmStop)}
        title="Certeza que deseja parar o trajeto?"
        onNo={() => setConfirmStop(null)}
        onYes={() => {
          if (confirmStop) stopMut.mutate(confirmStop);
          setConfirmStop(null);
        }}
      />
    </>
  );
}

function statusLabel(status: string) {
  if (status === 'active') return 'Em andamento';
  if (status === 'stopped') return 'Parada';
  return 'Rascunho';
}

const styles = StyleSheet.create({
  block: { gap: 10, marginBottom: 16 },
  footer: { marginTop: 8 },
});
