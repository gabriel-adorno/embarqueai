import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Screen } from '@/src/components/ui/Screen';
import { vehicleSchema } from '@/src/lib/schemas';
import { createVehicle } from '@/src/services/vehicles';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/session';

const TYPES = ['Van', 'Micro-ônibus', 'Ônibus'] as const;

type Form = { type: string; plate: string };

export default function NewVehicleScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSessionStore((s) => s.session?.user);

  const form = useForm<Form>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: { type: 'Van', plate: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: Form) =>
      createVehicle({
        transporter_id: user!.id,
        type: values.type,
        plate: values.plate,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vehicles', user?.id] });
      router.back();
    },
  });

  return (
    <Screen tab showBack>
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
        <Button
          label="Confirmar"
          loading={mutation.isPending}
          onPress={form.handleSubmit((v) => mutation.mutate(v))}
        />
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
});
