import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/States';
import { listGroupsForClient, listGroupsForTransporter } from '@/src/services/groups';
import { getVehicle } from '@/src/services/vehicles';
import { href } from '@/src/lib/href';
import { useSessionStore } from '@/src/store/session';

export default function GroupsTab() {
  const router = useRouter();
  const user = useSessionStore((s) => s.session?.user);
  const isTransporter = user?.user_metadata.role === 'transporter';

  const query = useQuery({
    queryKey: ['groups', user?.user_metadata.role, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) return [];
      const groups = isTransporter
        ? await listGroupsForTransporter(user.id)
        : await listGroupsForClient(user.id);
      return Promise.all(
        groups.map(async (group) => ({
          ...group,
          vehicle: await getVehicle(group.vehicle_id),
        })),
      );
    },
  });

  return (
    <Screen tab>
        <ScreenTitle
          title="Grupos"
          subtitle={
            isTransporter
              ? 'Veículo, rota e membros'
              : 'Vans vinculadas à sua família'
          }
        />
        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? <ErrorState message="Falha ao carregar grupos." /> : null}
        {query.data?.length === 0 ? (
          <EmptyState
            title="Nenhum grupo ainda"
            hint={
              isTransporter
                ? 'Crie um grupo ligado a um veículo e uma rota.'
                : 'Peça ao transportador para adicionar seu e-mail.'
            }
          />
        ) : null}
        {query.data?.map((group) => (
          <ListRow
            key={group.id}
            icon="people-outline"
            glyph="🚐"
            title={group.name}
            subtitle={`${group.vehicle?.type ?? ''} · ${group.vehicle?.plate ?? ''}`}
            onPress={() => router.push(href(`/(app)/(tabs)/groups/${group.id}`))}
          />
        ))}
        {isTransporter ? (
          <View style={styles.footer}>
            <Button label="Criar grupo" onPress={() => router.push(href('/(app)/(tabs)/groups/new'))} />
          </View>
        ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { marginTop: 24 },
});
