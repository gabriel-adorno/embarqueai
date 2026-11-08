import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { ContactActions } from '@/src/components/ui/ContactActions';
import { Input } from '@/src/components/ui/Input';
import { VehiclePhotoField } from '@/src/components/ui/VehiclePhotoField';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { ErrorState, LoadingState } from '@/src/components/ui/States';
import { notifyError } from '@/src/lib/notify';
import { getProfile } from '@/src/services/profiles';
import { getVehicle, updateVehicle } from '@/src/services/vehicles';
import { useSessionStore } from '@/src/store/session';
import { colors } from '@/src/theme/colors';
import { formatPlate } from '@/src/lib/plate';

const TYPES = ['Van', 'Micro-ônibus', 'Ônibus'] as const;

export default function VanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const isTransporter = useSessionStore((s) => s.session?.user.user_metadata.role) === 'transporter';
  const [type, setType] = useState('');
  const [plate, setPlate] = useState('');
  const [capacity, setCapacity] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['vehicle', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const vehicle = await getVehicle(id);
      if (!vehicle) throw new Error('Veículo não encontrado.');
      const transporter = await getProfile(vehicle.transporter_id);
      return { vehicle, transporter };
    },
  });

  useEffect(() => {
    if (!query.data) return;
    setType(query.data.vehicle.type);
    setPlate(formatPlate(query.data.vehicle.plate));
    setCapacity(query.data.vehicle.capacity ? String(query.data.vehicle.capacity) : '');
    setPhoto(query.data.vehicle.photo ?? null);
  }, [query.data]);

  const mutation = useMutation({
    mutationFn: () =>
      updateVehicle(id, { type, plate, capacity: Number(capacity) || null, photo }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['vehicle', id] }),
    onError: (err: Error) => notifyError(err.message),
  });

  return (
    <Screen tab refreshable showBack>
      <ScreenTitle
        title={query.data?.vehicle.type ?? 'Veículo'}
        subtitle={isTransporter ? 'Tipo, placa, lugares e foto' : 'Dados do veículo'}
      />
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState message="Não foi possível abrir o veículo." /> : null}
      {query.data && isTransporter ? (
        <>
          <Text style={styles.label}>Tipo</Text>
          <View style={styles.chips}>
            {TYPES.map((item) => {
              const selected = type === item;
              return (
                <Pressable
                  key={item}
                  onPress={() => setType(item)}
                  style={[styles.chip, selected && styles.chipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextOn]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
          <Input
            label="Placa"
            autoCapitalize="characters"
            value={plate}
            onChangeText={setPlate}
          />
          <Input
            label="Lugares"
            keyboardType="number-pad"
            value={capacity}
            onChangeText={setCapacity}
          />
          <VehiclePhotoField photo={photo} onChange={setPhoto} />
          <Button
            label="Salvar veículo"
            loading={mutation.isPending}
            onPress={() => mutation.mutate()}
          />
        </>
      ) : null}
      {query.data && !isTransporter ? (
        <>
          {query.data.vehicle.photo ? (
            <Image source={{ uri: query.data.vehicle.photo }} style={styles.photo} />
          ) : null}
          <ListRow
            icon="bus-outline"
            glyph="🚐"
            title={query.data.vehicle.type}
            subtitle={`Placa ${formatPlate(query.data.vehicle.plate)}${
              query.data.vehicle.capacity ? ` · ${query.data.vehicle.capacity} lugares` : ''
            }`}
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

const styles = StyleSheet.create({
  label: {
    color: colors.ink,
    fontWeight: '600',
    marginBottom: 8,
    fontSize: 13,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontWeight: '700', color: colors.ink },
  chipTextOn: { color: colors.white },
  photo: { width: 96, height: 96, borderRadius: 20, marginBottom: 16 },
});
