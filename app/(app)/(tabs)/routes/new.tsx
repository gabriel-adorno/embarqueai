import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text } from 'react-native';

import { TransporterOnly } from '@/src/components/nav/TransporterOnly';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { EmptyState, LoadingState } from '@/src/components/ui/States';
import { routeSchema } from '@/src/lib/schemas';
import { geocodeAddress } from '@/src/services/maps';
import { listGroupsForTransporter } from '@/src/services/groups';
import { createRoute } from '@/src/services/routes';
import { useSessionStore } from '@/src/store/session';
import { notifyError, notifyKey } from '@/src/lib/notify';
import { colors } from '@/src/theme/colors';

type Form = {
  name: string;
  pointA: string;
  pointB: string;
  pointC?: string;
  group_ids: string[];
};

export default function NewRouteScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSessionStore((s) => s.session?.user);

  const groups = useQuery({
    queryKey: ['groups', 'transporter', user?.id],
    enabled: Boolean(user),
    queryFn: () => listGroupsForTransporter(user!.id),
  });

  const form = useForm<Form>({
    resolver: zodResolver(routeSchema),
    defaultValues: { name: '', pointA: '', pointB: '', pointC: '', group_ids: [] },
  });

  const selected = form.watch('group_ids');

  const mutation = useMutation({
    mutationFn: async (values: Form) => {
      const names = [values.pointA, values.pointB, values.pointC].filter(
        (p): p is string => Boolean(p && p.trim()),
      );
      const points = await Promise.all(
        names.map(async (name) => {
          const coords = await geocodeAddress(name);
          return { name, ...coords };
        }),
      );
      return createRoute({
        transporter_id: user!.id,
        name: values.name,
        points,
        group_ids: values.group_ids,
      });
    },
    onSuccess: () => {
      notifyKey('routeCreated');
      void qc.invalidateQueries({ queryKey: ['routes'] });
      void qc.invalidateQueries({ queryKey: ['groups'] });
      router.back();
    },
    onError: (err: Error) => notifyError(err.message),
  });

  return (
    <TransporterOnly fallback="/(app)/(tabs)/routes">
    <Screen tab showBack>
        <ScreenTitle
          title="Nova rota"
          subtitle="Pontos da viagem e grupos (alunos) que vão nessa rota."
        />
        {groups.isLoading ? <LoadingState /> : null}
        {!groups.data?.length ? (
          <EmptyState
            title="Crie um grupo primeiro"
            hint="Monte o grupo, adicione os alunos e depois vincule na rota."
          />
        ) : null}
        <Controller
          control={form.control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Nome da rota"
              placeholder="Ex.: Rota manhã"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={form.formState.errors.name?.message}
            />
          )}
        />
        <Text style={styles.label}>Grupos nesta rota</Text>
        {groups.data?.map((group) => {
          const on = selected.includes(group.id);
          return (
            <Pressable
              key={group.id}
              onPress={() => {
                const next = on
                  ? selected.filter((id) => id !== group.id)
                  : [...selected, group.id];
                form.setValue('group_ids', next, { shouldValidate: true });
              }}
              style={[styles.option, on && styles.optionOn]}
            >
              <Text style={[styles.optionText, on && styles.optionTextOn]}>
                {group.name}
              </Text>
            </Pressable>
          );
        })}
        {form.formState.errors.group_ids ? (
          <Text style={styles.error}>{form.formState.errors.group_ids.message}</Text>
        ) : null}
        <Controller
          control={form.control}
          name="pointA"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Ponto 1"
              placeholder="Nome do ponto"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={form.formState.errors.pointA?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="pointB"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Ponto 2"
              placeholder="Nome do ponto"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={form.formState.errors.pointB?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="pointC"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Ponto 3 (opcional)"
              placeholder="Nome do ponto"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
            />
          )}
        />
        <Button
          label="Criar rota"
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
