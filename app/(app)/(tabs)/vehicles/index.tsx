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
import { href } from '@/src/lib/href';
import { listGroupsForClient } from '@/src/services/groups';
import { deleteVehicle, getVehicle, listVehicles } from '@/src/services/vehicles';
import { useSessionStore } from '@/src/store/session';
import type { Vehicle } from '@/src/types/database';

export default function VehiclesTab() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSessionStore((s) => s.session?.user);
  const isTransporter = user?.user_metadata.role === 'transporter';
  const [removeId, setRemoveId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['vehicles', user?.id, isTransporter],
    enabled: Boolean(user),
    queryFn: async () => {
      if (!user) return [] as Vehicle[];
      if (isTransporter) return listVehicles(user.id);
      const groups = await listGroupsForClient(user.id);
      const vans: Vehicle[] = [];
      const seen = new Set<string>();
      for (const group of groups) {
        if (seen.has(group.vehicle_id)) continue;
        seen.add(group.vehicle_id);
        const vehicle = await getVehicle(group.vehicle_id);
        if (vehicle) vans.push(vehicle);
      }
      return vans;
    },
  });

  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query.refetch]),
  );

  const remove = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['vehicles'] }),
  });

  const openVan = (id: string) => {
    router.push(href({ pathname: '/(app)/(tabs)/vehicles/[id]', params: { id } }));
  };

  return (
    <>
    <Screen tab>
        <ScreenTitle
          title="Vans"
          subtitle={isTransporter ? 'Tipo e placa da frota' : 'Vans dos seus grupos'}
        />
        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? <ErrorState message="Falha ao carregar vans." /> : null}
        {query.data?.length === 0 ? (
          <EmptyState
            title="Nenhuma van"
            hint={
              isTransporter
                ? 'Registre tipo e placa para criar grupos.'
                : 'Quando o transportador vincular seu grupo, a van aparece aqui.'
            }
          />
        ) : null}
        {query.data?.map((vehicle) => (
          <View key={vehicle.id} style={styles.block}>
            <ListRow
              icon="bus-outline"
              glyph="🚐"
              title={vehicle.type}
              subtitle={vehicle.plate}
              onPress={() => openVan(vehicle.id)}
            />
            {isTransporter ? (
              <Button
                label="Remover"
                variant="danger"
                onPress={() => setRemoveId(vehicle.id)}
              />
            ) : null}
          </View>
        ))}
        {isTransporter ? (
          <View style={styles.footer}>
            <Button
              label="Adicionar van"
              onPress={() => router.push(href({ pathname: '/(app)/(tabs)/vehicles/new' }))}
            />
          </View>
        ) : null}
    </Screen>
      <ConfirmModal
        visible={Boolean(removeId)}
        title="Certeza que deseja remover esta van?"
        onNo={() => setRemoveId(null)}
        onYes={() => {
          if (removeId) remove.mutate(removeId);
          setRemoveId(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10, marginBottom: 12 },
  footer: { marginTop: 16 },
});
