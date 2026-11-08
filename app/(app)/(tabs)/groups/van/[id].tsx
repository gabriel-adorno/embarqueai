import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';

import { ContactActions } from '@/src/components/ui/ContactActions';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { ErrorState, LoadingState } from '@/src/components/ui/States';
import { getProfile } from '@/src/services/profiles';
import { getVehicle } from '@/src/services/vehicles';
import { formatPlate } from '@/src/lib/plate';

export default function GroupVanScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const query = useQuery({
    queryKey: ['vehicle', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const vehicle = await getVehicle(id);
      if (!vehicle) throw new Error('Van não encontrada.');
      const transporter = await getProfile(vehicle.transporter_id);
      return { vehicle, transporter };
    },
  });

  return (
    <Screen tab refreshable showBack>
      <ScreenTitle
        title={query.data?.vehicle.type ?? 'Van'}
        subtitle="Dados do veículo"
      />
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState message="Não foi possível abrir a van." /> : null}
      {query.data ? (
        <>
          <ListRow
            icon="bus-outline"
            glyph="🚐"
            title={query.data.vehicle.type}
            subtitle={`Placa ${formatPlate(query.data.vehicle.plate)}`}
          />
          <ListRow
            icon="person-outline"
            glyph="👤"
            title={query.data.transporter?.name ?? 'Motorista'}
            subtitle={
              [query.data.transporter?.email, query.data.transporter?.phone]
                .filter(Boolean)
                .join(' · ') || 'Motorista do veículo'
            }
          />
          <ContactActions phone={query.data.transporter?.phone} />
        </>
      ) : null}
    </Screen>
  );
}
