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
import { listRoutePoints, listRoutes, updateRouteStatus } from '@/src/services/routes';
import { listActiveTripForRoute, startTrip, stopTrip } from '@/src/services/trips';
import { useSessionStore } from '@/src/store/session';
import { href } from '@/src/lib/href';
import { notifyError } from '@/src/lib/notify';

export default function RoutesTab() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSessionStore((s) => s.session?.user);
  const isTransporter = user?.user_metadata.role === 'transporter';
  const [confirmStart, setConfirmStart] = useState<string | null>(null);
  const [confirmStop, setConfirmStop] = useState<string | null>(null);

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

  const openLive = (routeId: string) => {
    router.push(href({ pathname: '/(app)/(tabs)/routes/[id]', params: { id: routeId } }));
  };

  return (
    <>
    <Screen tab>
        <ScreenTitle
          title="Rotas"
          subtitle={
            isTransporter
              ? 'Inicie o trajeto para o aluno ver o mapa ao vivo'
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
                ? 'Crie uma rota e selecione os grupos de alunos.'
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
                subtitle={`${groupsLabel} · ${live ? 'Ao vivo' : 'Aguardando início'}`}
                onPress={live ? () => openLive(route.id) : undefined}
              />
              {isTransporter ? (
                live ? (
                  <>
                    <Button label="Ver mapa ao vivo" onPress={() => openLive(route.id)} />
                    <Button
                      label="Parar trajeto"
                      variant="danger"
                      onPress={() => setConfirmStop(route.id)}
                    />
                  </>
                ) : (
                  <Button label="Iniciar rota" onPress={() => setConfirmStart(route.id)} />
                )
              ) : live ? (
                <Button label="Acompanhar ao vivo" onPress={() => openLive(route.id)} />
              ) : null}
            </View>
          );
        })}
        {isTransporter ? (
          <View style={styles.footer}>
            <Button
              label="Criar rota"
              onPress={() => router.push(href({ pathname: '/(app)/(tabs)/routes/new' }))}
            />
          </View>
        ) : null}
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

const styles = StyleSheet.create({
  block: { gap: 10, marginBottom: 16 },
  footer: { marginTop: 8 },
});
