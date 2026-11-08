import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';

import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/States';
import { href } from '@/src/lib/href';
import { listRoutes } from '@/src/services/routes';
import { listTripHistory } from '@/src/services/trips';
import { useSessionStore } from '@/src/store/session';

export default function TripHistoryScreen() {
  const router = useRouter();
  const userId = useSessionStore((s) => s.session?.user.id);

  const query = useQuery({
    queryKey: ['trip-history', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const [trips, routes] = await Promise.all([listTripHistory(), listRoutes(userId!)]);
      const names = new Map(routes.map((route) => [route.id, route.name]));
      return trips.map((trip) => ({
        ...trip,
        routeName: names.get(trip.route_id) ?? 'Rota',
      }));
    },
  });

  return (
    <Screen tab showBack>
      <ScreenTitle title="Histórico" subtitle="Viagens encerradas nos últimos 30 dias" />
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? (
        <ErrorState
          message={
            query.error instanceof Error && /404/.test(query.error.message)
              ? 'O histórico fica disponível depois de atualizar o servidor.'
              : 'Não foi possível carregar o histórico.'
          }
        />
      ) : null}
      {query.data?.length === 0 ? (
        <EmptyState title="Nenhuma viagem encerrada" hint="Quando um trajeto terminar, ele aparece aqui." />
      ) : null}
      {query.data?.map((trip) => (
        <ListRow
          key={trip.id}
          icon="time-outline"
          glyph="🕘"
          title={trip.routeName}
          subtitle={formatWhen(trip.started_at, trip.ended_at)}
          onPress={() => router.push(href(`/trip/${trip.id}`))}
        />
      ))}
    </Screen>
  );
}

function formatWhen(started: string, ended: string | null) {
  const start = new Date(started);
  const end = ended ? new Date(ended) : null;
  const when = start.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  if (!end) return when;
  const minutes = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  return `${when} · ${minutes} min`;
}
