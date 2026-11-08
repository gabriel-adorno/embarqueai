import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { ConfirmModal } from '@/src/components/ui/ConfirmModal';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/States';
import { listGroupsForClient, listGroupsForTransporter } from '@/src/services/groups';
import { requestUserRegion } from '@/src/services/location';
import { deleteRoute, listRoutePoints, listRoutes, updateRouteStatus } from '@/src/services/routes';
import { listActiveTripForRoute, startTrip, stopTrip } from '@/src/services/trips';
import type { TripLeg } from '@/src/types/database';
import { useSessionStore } from '@/src/store/session';
import { href } from '@/src/lib/href';
import { notifyError } from '@/src/lib/notify';

export default function RoutesTab() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSessionStore((s) => s.session?.user);
  const isTransporter = user?.user_metadata.role === 'transporter';
  const [confirmStart, setConfirmStart] = useState<{ id: string; leg: TripLeg } | null>(null);
  const [confirmStop, setConfirmStop] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['routes', user?.id, isTransporter],
    enabled: Boolean(user),
    refetchInterval: isTransporter ? false : 8_000,
    queryFn: async () => {
      if (!user) return [];
      const [routes, groups] = await Promise.all([
        listRoutes(user.id),
        isTransporter
          ? listGroupsForTransporter(user.id)
          : listGroupsForClient(user.id),
      ]);
      return Promise.all(
        routes.map(async (route) => {
          const linked = groups.filter((g) => g.route_id === route.id);
          return {
            ...route,
            points: (await listRoutePoints(route.id)) ?? [],
            trip: await listActiveTripForRoute(route.id),
            groupNames: linked.map((g) => g.name),
          };
        }),
      );
    },
  });

  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );

  const startMut = useMutation({
    mutationFn: async (input: { id: string; leg: TripLeg }) => {
      const routeId = input.id;
      const groups = await listGroupsForTransporter(user!.id);
      const linked = groups.filter((g) => g.route_id === routeId);
      if (!linked.length) throw new Error('Vincule esta rota a um grupo antes de iniciar.');
      const points = await listRoutePoints(routeId);
      const first = points[0];
      if (!first) throw new Error('A rota precisa de pontos.');
      const located = await requestUserRegion();
      const lat = located.status === 'granted' ? located.region.latitude : first.lat;
      const lng = located.status === 'granted' ? located.region.longitude : first.lng;
      await updateRouteStatus(routeId, 'active');
      let trip = null;
      for (const group of linked) {
        trip = await startTrip({
          route_id: routeId,
          group_id: group.id,
          lat,
          lng,
          leg: input.leg,
        });
      }
      if (!trip) throw new Error('Não foi possível iniciar a rota.');
      return trip;
    },
    onSuccess: (trip) => {
      void qc.invalidateQueries();
      router.push(href(`/(app)/(tabs)/routes/${trip.route_id}`));
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

  const openRoute = (routeId: string) => {
    router.push(href({ pathname: '/(app)/(tabs)/routes/[id]', params: { id: routeId } }));
  };

  const deleteMut = useMutation({
    mutationFn: deleteRoute,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['routes'] }),
    onError: (err: Error) => notifyError(err.message),
  });

  return (
    <>
    <Screen tab refreshable>
        <ScreenTitle
          title="Rotas"
          subtitle={
            isTransporter
              ? 'Inicie o trajeto para o passageiro ver o mapa ao vivo'
              : 'Todas as rotas dos seus grupos'
          }
        />
        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? <ErrorState message="Falha ao carregar rotas." /> : null}
        {query.data?.length === 0 ? (
          <EmptyState
            title="Nenhuma rota"
            hint={
              isTransporter
                ? 'Crie uma rota e selecione os grupos de passageiros.'
                : 'Quando o transportador vincular seu grupo a uma rota, ela aparece aqui.'
            }
          />
        ) : null}
        {query.data?.map((route) => {
          const live = Boolean(route.trip);
          const groupsLabel = route.groupNames.length
            ? route.groupNames.join(', ')
            : 'Sem grupo';
          return (
            <View key={route.id} style={styles.block}>
              <ListRow
                icon="navigate-outline"
                glyph="🧭"
                title={route.name}
                subtitle={[
                  groupsLabel,
                  `${route.points.length} pontos`,
                  route.outbound_time ? `Ida ${route.outbound_time}` : null,
                  route.return_time ? `Volta ${route.return_time}` : null,
                  live ? `Ao vivo · ${route.trip?.leg === 'return' ? 'Volta' : 'Ida'}` : 'Parada',
                ]
                  .filter(Boolean)
                  .join(' · ')}
                onPress={() => openRoute(route.id)}
              />
              <View style={styles.actions}>
                {live ? (
                  <View style={styles.action}>
                    <Button size="sm" label="Mapa ao vivo" onPress={() => openRoute(route.id)} />
                  </View>
                ) : (
                  <View style={styles.action}>
                    <Button
                      size="sm"
                      variant="secondary"
                      label="Pontos"
                      onPress={() => openRoute(route.id)}
                    />
                  </View>
                )}
                {isTransporter && live ? (
                  <View style={styles.action}>
                    <Button
                      size="sm"
                      variant="danger"
                      label="Parar"
                      onPress={() => setConfirmStop(route.id)}
                    />
                  </View>
                ) : null}
                {isTransporter && !live ? (
                  <>
                    <View style={styles.action}>
                      <Button
                        size="sm"
                        label="Ida"
                        onPress={() => setConfirmStart({ id: route.id, leg: 'outbound' })}
                      />
                    </View>
                    <View style={styles.action}>
                      <Button
                        size="sm"
                        variant="secondary"
                        label="Volta"
                        onPress={() => setConfirmStart({ id: route.id, leg: 'return' })}
                      />
                    </View>
                  </>
                ) : null}
                {isTransporter && !live ? (
                  <View style={styles.action}>
                    <Button
                      size="sm"
                      variant="danger"
                      label="Excluir"
                      onPress={() => setConfirmDelete(route.id)}
                    />
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
        <View style={styles.footer}>
          <Button
            label="Histórico"
            variant="secondary"
            onPress={() => router.push(href({ pathname: '/(app)/(tabs)/routes/history' }))}
          />
          {isTransporter ? (
            <Button
              label="Relatório"
              variant="secondary"
              onPress={() => router.push(href({ pathname: '/(app)/(tabs)/routes/report' }))}
            />
          ) : null}
          {isTransporter ? (
            <Button
              label="Criar rota"
              onPress={() => router.push(href({ pathname: '/(app)/(tabs)/routes/new' }))}
            />
          ) : null}
        </View>
    </Screen>
      <ConfirmModal
        visible={Boolean(confirmStart)}
        title={
          confirmStart?.leg === 'return'
            ? 'Deseja iniciar a volta?'
            : 'Deseja iniciar a ida?'
        }
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
      <ConfirmModal
        visible={Boolean(confirmDelete)}
        title="Certeza que deseja excluir esta rota?"
        onNo={() => setConfirmDelete(null)}
        onYes={() => {
          if (confirmDelete) deleteMut.mutate(confirmDelete);
          setConfirmDelete(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10, marginBottom: 16 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
  footer: { marginTop: 8, gap: 10 },
});
