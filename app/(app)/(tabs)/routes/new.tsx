import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  points: { value: string }[];
  group_ids: string[];
  outbound_time?: string;
  return_time?: string;
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
    defaultValues: {
      name: '',
      points: [{ value: '' }, { value: '' }],
      group_ids: [],
      outbound_time: '',
      return_time: '',
    },
  });

  const points = useFieldArray({ control: form.control, name: 'points' });
  const selected = form.watch('group_ids');

  const mutation = useMutation({
    mutationFn: async (values: Form) => {
      const names = values.points.map((point) => point.value.trim()).filter(Boolean);
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
        outbound_time: values.outbound_time || null,
        return_time: values.return_time || null,
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
          subtitle="Pontos da viagem e grupos que vão nessa rota."
        />
        {groups.isLoading ? <LoadingState /> : null}
        {!groups.data?.length ? (
          <EmptyState
            title="Crie um grupo primeiro"
            hint="Monte o grupo, adicione os passageiros e depois vincule na rota."
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
        <Controller
          control={form.control}
          name="outbound_time"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Horário da ida"
              placeholder="07:10"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={form.formState.errors.outbound_time?.message}
            />
          )}
        />
        <Controller
          control={form.control}
          name="return_time"
          render={({ field: { onChange, onBlur, value } }) => (
            <Input
              label="Horário da volta"
              placeholder="12:30"
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              error={form.formState.errors.return_time?.message}
            />
          )}
        />
        {form.formState.errors.group_ids ? (
          <Text style={styles.error}>{form.formState.errors.group_ids.message}</Text>
        ) : null}
        {points.fields.map((field, index) => (
          <View key={field.id}>
            <Controller
              control={form.control}
              name={`points.${index}.value`}
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label={`Ponto ${index + 1}`}
                  placeholder="Endereço ou nome do ponto"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={form.formState.errors.points?.[index]?.value?.message}
                />
              )}
            />
            {points.fields.length > 2 ? (
              <Button label="Remover ponto" variant="ghost" onPress={() => points.remove(index)} />
            ) : null}
          </View>
        ))}
        {points.fields.length < 8 ? (
          <Button
            label="Adicionar ponto"
            variant="secondary"
            onPress={() => points.append({ value: '' })}
          />
        ) : null}
        <View style={styles.gap} />
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
  gap: { height: 8 },
});
