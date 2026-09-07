import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { LiveTripMap } from '@/src/components/map/LiveTripMap';
import { BackButton } from '@/src/components/ui/BackButton';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/States';
import { getRoute } from '@/src/services/routes';
import { listActiveTripForRoute } from '@/src/services/trips';
import { colors } from '@/src/theme/colors';

export default function RouteLiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const query = useQuery({
    queryKey: ['route-live-gate', id],
    enabled: Boolean(id),
    refetchInterval: 5_000,
    queryFn: async () => {
      const route = await getRoute(id);
      if (!route) throw new Error('Rota não encontrada.');
      const trip = await listActiveTripForRoute(id);
      return { route, live: trip?.status === 'in_progress' };
    },
  });

  if (query.isLoading) {
    return (
      <Screen tab showBack>
        <LoadingState />
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen tab showBack>
        <ErrorState message="Não foi possível abrir a rota." />
      </Screen>
    );
  }

  if (!query.data?.live) {
    return (
      <Screen tab showBack>
        <ScreenTitle
          title={query.data?.route.name ?? 'Rota'}
          subtitle="Acompanhe em tempo real"
        />
        <EmptyState title="Nenhuma rota ao vivo" />
      </Screen>
    );
  }

  return (
    <LiveTripMap
      routeId={id}
      header={
        <View style={styles.topRow}>
          <BackButton />
          <Text style={styles.topTitle}>Rota ao vivo</Text>
          <View style={styles.topSpacer} />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
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
});
