import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TransporterOnly } from '@/src/components/nav/TransporterOnly';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { VehiclePhotoField } from '@/src/components/ui/VehiclePhotoField';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { vehicleSchema } from '@/src/lib/schemas';
import { createVehicle } from '@/src/services/vehicles';
import { notifyError } from '@/src/lib/notify';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/session';

const TYPES = ['Van', 'Micro-ônibus', 'Ônibus'] as const;

type Form = { type: string; plate: string; capacity?: string };

export default function NewVehicleScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSessionStore((s) => s.session?.user);

  const form = useForm<Form>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { type: 'Van', plate: '', capacity: '' },
  });
  const [photo, setPhoto] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (values: Form) =>
      createVehicle({
        transporter_id: user!.id,
        type: values.type,
        plate: values.plate,
        capacity: Number(values.capacity) || null,
        photo,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vehicles'] });
      router.back();
    },
    onError: (err: Error) => notifyError(err.message),
  });

  return (
    <TransporterOnly fallback="/(app)/(tabs)/vehicles">
    <Screen tab showBack>
        <ScreenTitle title="Novo veículo" subtitle="Tipo, placa, lugares e foto" />
        <Text style={styles.label}>Tipo</Text>
        <View style={styles.chips}>
          {TYPES.map((type) => {
            const selected = form.watch('type') === type;
            return (
              <Pressable
                key={type}
                onPress={() => form.setValue('type', type)}
                style={[styles.chip, selected && styles.chipOn]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Controller
          control={form.control}
          name="plate"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Placa"
              placeholder="ABC-1234"
              autoCapitalize="characters"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={form.formState.errors.plate?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="capacity"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Lugares"
              placeholder="Ex.: 15"
              keyboardType="number-pad"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        <VehiclePhotoField photo={photo} onChange={setPhoto} />
        <Button
          label="Confirmar"
          loading={mutation.isPending}
          onPress={form.handleSubmit((v) => mutation.mutate(v))}
        />
    </Screen>
    </TransporterOnly>
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
});
