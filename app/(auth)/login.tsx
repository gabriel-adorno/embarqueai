import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppMessage } from '@/src/components/ui/AppMessage';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { href } from '@/src/lib/href';
import { DEMO_ACCOUNTS } from '@/src/lib/ids';
import { flashFromAuthError } from '@/src/lib/notify';
import { loginSchema } from '@/src/lib/schemas';
import * as auth from '@/src/services/auth';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/session';
import type { FlashMessage } from '@/src/store/toast';

type Form = { email: string; password: string };

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useSessionStore((s) => s.setSession);
  const [banner, setBanner] = useState<FlashMessage | null>(null);

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Form>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setBanner(null);
    const { data, error } = await auth.signInWithPassword(values);
    if (error || !data.session) {
      setBanner(flashFromAuthError(error));
      return;
    }
    await setSession(data.session);
    router.replace(href('/(app)/(tabs)'));
  });

  return (
    <Screen showBack keyboard>
          <ScreenTitle
            title="Entrar"
            subtitle="Passageiros, responsáveis e transportadores entram por aqui."
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
          <Link href="/(auth)/forgot-password" asChild>
            <Pressable accessibilityRole="link">
              <Text style={styles.link}>Esqueceu a senha?</Text>
            </Pressable>
          </Link>
          <Button label="Continuar" loading={isSubmitting} onPress={onSubmit} />
          <View style={styles.footer}>
            <Text style={styles.muted}>Não tem uma conta? </Text>
            <Link href="/(auth)/sign-up" asChild>
              <Pressable accessibilityRole="link">
                <Text style={styles.linkInline}>Cadastre-se</Text>
              </Pressable>
            </Link>
          </View>
          <View style={styles.demo}>
            <Text style={styles.demoLabel}>Conta de teste</Text>
            <View style={styles.demoRow}>
              {(
                [
                  ['Passageiro', DEMO_ACCOUNTS.client],
                  ['Transportador', DEMO_ACCOUNTS.transporter],
                ] as const
              ).map(([label, account]) => (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={`Preencher conta de teste: ${label}`}
                  onPress={() => {
                    setValue('email', account.email, { shouldValidate: true });
                    setValue('password', account.password, { shouldValidate: true });
                  }}
                  style={({ pressed }) => [styles.demoChip, pressed && styles.demoPressed]}
                >
                  <Text style={styles.demoText}>{label}</Text>
                </Pressable>
              ))}
            </View>
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
  demo: { marginTop: 28 },
  demoLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  demoRow: { flexDirection: 'row', gap: 8 },
  demoChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  demoPressed: { opacity: 0.7 },
  demoText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 20 },
  muted: { color: colors.textMuted, fontSize: 15 },
  linkInline: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 15,
    textDecorationLine: 'underline',
  },
});
