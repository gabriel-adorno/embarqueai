import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { AppMessage } from '@/src/components/ui/AppMessage';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { flashFromAuthError, notifyKey } from '@/src/lib/notify';
import { signUpSchema } from '@/src/lib/schemas';
import * as auth from '@/src/services/auth';
import { useSessionStore } from '@/src/store/session';
import type { FlashMessage } from '@/src/store/toast';
import type { Role } from '@/src/types/database';

type Form = {
  name: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
};

export default function SignUpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: Role }>();
  const role: Role = params.role === 'transporter' ? 'transporter' : 'client';
  const setSession = useSessionStore((s) => s.setSession);
  const [banner, setBanner] = useState<FlashMessage | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    const { data, error } = await auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { name: values.name, role, phone: values.phone },
      },
    });
    setBanner(null);
    if (error || !data.session) {
      setBanner(flashFromAuthError(error));
      return;
    }
    await setSession(data.session);
    notifyKey('accountCreated');
    router.replace('/(app)/(tabs)');
  });

  return (
    <Screen showBack keyboard>
          <ScreenTitle
            title="Criar conta"
            subtitle={role === 'client' ? 'Cliente' : 'Transportador'}
          />
          {banner ? (
            <AppMessage title={banner.title} body={banner.body} kind={banner.kind} />
          ) : null}
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Nome completo"
                placeholder="Seu nome"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="E-mail"
                placeholder="Seu e-mail"
                autoCapitalize="none"
                keyboardType="email-address"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="phone"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Telefone"
                placeholder="Seu telefone"
                keyboardType="phone-pad"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Senha"
                placeholder="Mínimo 6 caracteres"
                secureTextEntry
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
              />
            )}
          />
          <Controller
            control={control}
            name="confirmPassword"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Confirmar senha"
                placeholder="Repita a senha"
                secureTextEntry
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.confirmPassword?.message}
              />
            )}
          />
          <Button label="Continuar" loading={isSubmitting} onPress={onSubmit} />
    </Screen>
  );
}
