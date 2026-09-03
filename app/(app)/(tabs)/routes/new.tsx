import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';

import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { routeSchema } from '@/src/lib/schemas';
import { geocodeAddress } from '@/src/services/maps';
import { createRoute } from '@/src/services/routes';
import { useSessionStore } from '@/src/store/session';
import { notifyKey } from '@/src/lib/notify';

type Form = { name: string; pointA: string; pointB: string; pointC?: string };

export default function NewRouteScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSessionStore((s) => s.session?.user);

  const form = useForm<Form>({
    resolver: zodResolver(routeSchema),
    defaultValues: { name: '', pointA: '', pointB: '', pointC: '' },
  });

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
      });
    },
    onSuccess: () => {
      notifyKey('routeCreated');
      void qc.invalidateQueries({ queryKey: ['routes', user?.id] });
      router.back();
    },
  });

  return (
    <Screen tab showBack>
        <ScreenTitle title="Nova rota" subtitle="Pontos já nascem com lat/lng." />
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
  );
}
