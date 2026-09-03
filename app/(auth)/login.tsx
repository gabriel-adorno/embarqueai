import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppMessage } from '@/src/components/ui/AppMessage';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { DEMO_ACCOUNTS } from '@/src/lib/ids';
import { flashFromAuthError, flashFromCatalog } from '@/src/lib/notify';
import { loginSchema } from '@/src/lib/schemas';
import * as auth from '@/src/services/auth';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/session';
import type { FlashMessage } from '@/src/store/toast';
import type { Role } from '@/src/types/database';

type Form = { email: string; password: string };

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: Role }>();
  const role: Role = params.role === 'transporter' ? 'transporter' : 'client';
  const setSession = useSessionStore((s) => s.setSession);
  const [banner, setBanner] = useState<FlashMessage | null>(null);
  const demo = role === 'client' ? DEMO_ACCOUNTS.client : DEMO_ACCOUNTS.transporter;

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: demo.email,
      password: demo.password,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    const { data, error } = await auth.signInWithPassword(values);
    if (error || !data.session) {
      setBanner(flashFromAuthError(error));
      return;
    }
    if (data.session.user.user_metadata.role !== role) {
      setBanner(flashFromCatalog('wrongRole'));
      return;
    }
    await setSession(data.session);
    router.replace('/(app)/(tabs)');
  });

  return (
    <Screen showBack keyboard>
          <ScreenTitle
            title="Entrar"
            subtitle={
              role === 'client'
                ? 'Acompanhe a van da sua família.'
                : 'Gerencie rotas e embarques.'
            }
          />
          {banner ? (
            <AppMessage title={banner.title} body={banner.body} kind={banner.kind} />
          ) : null}
          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="E-mail"
                placeholder="Digite seu e-mail"
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
            name="password"
            render={({ field: { onChange, onBlur, value } }) => (
              <Input
                label="Senha"
                placeholder="Digite sua senha"
                secureTextEntry
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.password?.message}
              />
            )}
          />
          <Link href={`/(auth)/forgot-password?role=${role}`} asChild>
            <Pressable accessibilityRole="link">
              <Text style={styles.link}>Esqueceu a senha?</Text>
            </Pressable>
          </Link>
          <Button label="Continuar" loading={isSubmitting} onPress={onSubmit} />
          <View style={styles.footer}>
            <Text style={styles.muted}>Não tem uma conta? </Text>
            <Link href={`/(auth)/sign-up?role=${role}`} asChild>
              <Pressable accessibilityRole="link">
                <Text style={styles.linkInline}>Cadastre-se</Text>
              </Pressable>
            </Link>
          </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.ink,
    fontWeight: '600',
    fontSize: 15,
    textDecorationLine: 'underline',
    marginBottom: 24,
  },
  footer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20 },
  muted: { color: colors.textMuted, fontSize: 15 },
  linkInline: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});
