import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { EmptyState, LoadingState } from '@/src/components/ui/States';
import { groupSchema } from '@/src/lib/schemas';
import { createGroup } from '@/src/services/groups';
import { listRoutes } from '@/src/services/routes';
import { listVehicles } from '@/src/services/vehicles';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/session';
import { notifyError, notifyKey } from '@/src/lib/notify';

type Form = { name: string; vehicle_id: string; route_id: string };

export default function NewGroupScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSessionStore((s) => s.session?.user);
  const isTransporter = user?.user_metadata.role === 'transporter';

  const vehicles = useQuery({
    queryKey: ['vehicles', user?.id],
    enabled: Boolean(user) && isTransporter,
    queryFn: () => listVehicles(user!.id),
  });
  const routes = useQuery({
    queryKey: ['routes', user?.id],
    enabled: Boolean(user) && isTransporter,
    queryFn: () => listRoutes(user!.id),
  });

  const form = useForm<Form>({
    resolver: zodResolver(groupSchema),
    defaultValues: { name: '', vehicle_id: '', route_id: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: Form) =>
      createGroup({ ...values, transporter_id: user!.id }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['groups'] });
      notifyKey('groupCreated');
      router.back();
    },
    onError: (err: Error) => notifyError(err.message),
  });

  if (!isTransporter) {
    return <Redirect href="/(app)/(tabs)/groups" />;
  }

  return (
    <Screen tab showBack>
        <ScreenTitle title="Novo grupo" subtitle="Nome, veículo e rota" />
        {vehicles.isLoading || routes.isLoading ? <LoadingState /> : null}
        {!vehicles.data?.length ? (
          <EmptyState title="Cadastre um veículo primeiro" />
        ) : null}
        <Controller
          control={form.control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Nome do grupo"
              placeholder="Ex.: Van do Afonso"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={form.formState.errors.name?.message}
            />
          )}
        />
        <Text style={styles.label}>Veículo</Text>
        {vehicles.data?.map((vehicle) => {
          const selected = form.watch('vehicle_id') === vehicle.id;
          return (
            <Pressable
              key={vehicle.id}
              onPress={() => form.setValue('vehicle_id', vehicle.id)}
              style={[styles.option, selected && styles.optionOn]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextOn]}>
                {vehicle.type} · {vehicle.plate}
              </Text>
            </Pressable>
          );
        })}
        {form.formState.errors.vehicle_id ? (
          <Text style={styles.error}>{form.formState.errors.vehicle_id.message}</Text>
        ) : null}
        <Text style={styles.label}>Rota</Text>
        {routes.data?.map((route) => {
          const selected = form.watch('route_id') === route.id;
          return (
            <Pressable
              key={route.id}
              onPress={() => form.setValue('route_id', route.id)}
              style={[styles.option, selected && styles.optionOn]}
            >
              <Text style={[styles.optionText, selected && styles.optionTextOn]}>
                {route.name}
              </Text>
            </Pressable>
          );
        })}
        {form.formState.errors.route_id ? (
          <Text style={styles.error}>{form.formState.errors.route_id.message}</Text>
        ) : null}
        <View style={{ height: 16 }} />
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
    marginTop: 8,
    fontSize: 13,
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { fontWeight: '700', color: colors.ink },
  optionTextOn: { color: colors.white },
  error: { color: colors.error, marginBottom: 8 },
});
