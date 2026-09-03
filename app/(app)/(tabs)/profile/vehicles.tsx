import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/States';
import { href } from '@/src/lib/href';
import { deleteVehicle, listVehicles } from '@/src/services/vehicles';
import { useSessionStore } from '@/src/store/session';

export default function VehiclesScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSessionStore((s) => s.session?.user);

  const query = useQuery({
    queryKey: ['vehicles', user?.id],
    enabled: Boolean(user),
    queryFn: () => listVehicles(user!.id),
  });

  const remove = useMutation({
    mutationFn: deleteVehicle,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['vehicles', user?.id] }),
  });

  if (user?.user_metadata.role !== 'transporter') {
    return <Redirect href="/(app)/(tabs)/profile" />;
  }

  return (
    <Screen tab showBack>
        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? <ErrorState message="Falha ao carregar veículos." /> : null}
        {query.data?.length === 0 ? (
          <EmptyState title="Nenhum veículo" hint="Registre tipo e placa para criar grupos." />
        ) : null}
        {query.data?.map((vehicle) => (
          <View key={vehicle.id} style={styles.block}>
            <ListRow
              icon="bus-outline"
              glyph="🚐"
              title={vehicle.type}
              subtitle={vehicle.plate}
            />
            <Button
              label="Remover"
              variant="danger"
              onPress={() => remove.mutate(vehicle.id)}
            />
          </View>
        ))}
        <View style={styles.footer}>
          <Button
            label="Adicionar veículo"
            onPress={() => router.push(href('/(app)/(tabs)/profile/vehicle-new'))}
          />
        </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10, marginBottom: 12 },
  footer: { marginTop: 16 },
});
