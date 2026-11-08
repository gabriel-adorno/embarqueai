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
import { flashFromAuthError, notifyKey } from '@/src/lib/notify';
import { href } from '@/src/lib/href';
import { LEGAL } from '@/src/lib/legal';
import { signUpSchema } from '@/src/lib/schemas';
import * as auth from '@/src/services/auth';
import { useSessionStore } from '@/src/store/session';
import type { FlashMessage } from '@/src/store/toast';
import { colors } from '@/src/theme/colors';
import type { Role } from '@/src/types/database';

type Form = {
  name: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
};

export default function SignUpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: Role }>();
  const [role, setRole] = useState<Role | null>(
    params.role === 'transporter' || params.role === 'client' ? params.role : null,
  );
  const [roleError, setRoleError] = useState(false);
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
      acceptTerms: false,
    },
  });

  const submitForm = handleSubmit(async (values) => {
    if (!role) return;
    const { data, error } = await auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          name: values.name,
          role,
          phone: values.phone,
          terms_version: LEGAL.version,
          terms_accepted_at: new Date().toISOString(),
        },
      },
    });
    setBanner(null);
    if (error) {
      setBanner(flashFromAuthError(error));
      return;
    }
    if (!data.session) {
      router.push(
        href({
          pathname: '/(auth)/confirm-email',
          params: { email: values.email.trim().toLowerCase(), role },
        }),
      );
      return;
    }
    await setSession(data.session);
    notifyKey('accountCreated');
    router.replace(href('/(app)/(tabs)'));
  });

  const onSubmit = () => {
    setRoleError(!role);
    void submitForm();
  };

  return (
    <Screen showBack keyboard>
          <ScreenTitle
            title="Criar conta"
            subtitle="Escolha como você vai usar o app e preencha seus dados."
          />
          <Text style={styles.label}>Como você vai usar?</Text>
          <View style={styles.roles}>
            {ROLES.map((item) => {
              const on = role === item.value;
              return (
                <Pressable
                  key={item.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={item.title}
                  onPress={() => {
                    setRole(item.value);
                    setRoleError(false);
                  }}
                  style={({ pressed }) => [
                    styles.role,
                    on && styles.roleOn,
                    roleError && styles.roleError,
                    pressed && styles.rolePressed,
                  ]}
                >
                  <Text style={styles.roleGlyph}>{item.glyph}</Text>
                  <Text style={[styles.roleTitle, on && styles.roleTitleOn]}>{item.title}</Text>
                  <Text style={[styles.roleSub, on && styles.roleSubOn]}>{item.subtitle}</Text>
                </Pressable>
              );
            })}
          </View>
          {roleError ? <Text style={[styles.error, styles.roleErrorText]}>Escolha uma opção.</Text> : null}
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
          <Controller
            control={control}
            name="acceptTerms"
            render={({ field: { onChange, value } }) => (
              <View style={styles.terms}>
                <Pressable
                  onPress={() => onChange(!value)}
                  style={styles.checkRow}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: value }}
                  accessibilityLabel="Li e aceito os Termos de Uso e a Política de Privacidade"
                >
                  <View style={[styles.box, value && styles.boxOn]}>
                    {value ? <Text style={styles.check}>✓</Text> : null}
                  </View>
                  <Text style={styles.termsText}>
                    Li e aceito os{' '}
                    <Link href={href('/legal/terms')} style={styles.link}>
                      Termos de Uso
                    </Link>{' '}
                    e a{' '}
                    <Link href={href('/legal/privacy')} style={styles.link}>
                      Política de Privacidade
                    </Link>
                    .
                  </Text>
                </Pressable>
                {errors.acceptTerms?.message ? (
                  <Text style={styles.error}>{errors.acceptTerms.message}</Text>
                ) : null}
              </View>
            )}
          />
          <Button label="Continuar" loading={isSubmitting} onPress={onSubmit} />
    </Screen>
  );
}

const ROLES: { value: Role; glyph: string; title: string; subtitle: string }[] = [
  {
    value: 'client',
    glyph: '📍',
    title: 'Passageiro ou responsável',
    subtitle: 'Acompanho minha viagem ou a de alguém',
  },
  {
    value: 'transporter',
    glyph: '🚐',
    title: 'Transportador',
    subtitle: 'Dirijo e organizo rotas e grupos',
  },
];

const styles = StyleSheet.create({
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  roles: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  role: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 14,
    gap: 4,
  },
  roleOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  roleError: { borderColor: colors.error },
  rolePressed: { opacity: 0.85 },
  roleGlyph: { fontSize: 22, marginBottom: 4 },
  roleTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  roleTitleOn: { color: colors.white },
  roleSub: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
  roleSubOn: { color: colors.white, opacity: 0.9 },
  roleErrorText: { marginTop: 0, marginBottom: 12 },
  terms: { marginBottom: 16 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  check: { color: colors.white, fontSize: 14, fontWeight: '800', lineHeight: 16 },
  termsText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20 },
  link: { color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' },
  error: { color: colors.error, fontSize: 13, marginTop: 6 },
});
