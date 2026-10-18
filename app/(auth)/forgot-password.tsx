import { zodResolver } from '@hookform/resolvers/zod';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text } from 'react-native';

import { AppMessage } from '@/src/components/ui/AppMessage';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { flashFromAuthError, notifyKey } from '@/src/lib/notify';
import { emailSchema, newPasswordSchema, otpSchema } from '@/src/lib/schemas';
import * as auth from '@/src/services/auth';
import { colors } from '@/src/theme/colors';
import type { FlashMessage } from '@/src/store/toast';
import type { Role } from '@/src/types/database';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ role?: Role }>();
  const role: Role = params.role === 'transporter' ? 'transporter' : 'client';
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState('');
  const [banner, setBanner] = useState<FlashMessage | null>(null);

  const emailForm = useForm<{ email: string }>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });
  const otpForm = useForm<{ token: string }>({
    resolver: zodResolver(otpSchema),
    defaultValues: { token: '' },
  });
  const passwordForm = useForm<{ password: string; confirmPassword: string }>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const sendCode = emailForm.handleSubmit(async (values) => {
    setBanner(null);
    const { error } = await auth.resetPasswordForEmail(values.email);
    if (error) {
      setBanner(flashFromAuthError(error));
      return;
    }
    setEmail(values.email);
    notifyKey('codeSent');
    setStep(2);
  });

  const checkCode = otpForm.handleSubmit(async (values) => {
    const { error } = await auth.verifyOtp({
      email,
      token: values.token,
      type: 'recovery',
    });
    setBanner(null);
    if (error) {
      setBanner(flashFromAuthError(error));
      return;
    }
    setStep(3);
  });

  const changePassword = passwordForm.handleSubmit(async (values) => {
    const { error } = await auth.updateUser({ password: values.password });
    setBanner(null);
    if (error) {
      setBanner(flashFromAuthError(error));
      return;
    }
    notifyKey('passwordChanged');
    router.replace(`/(auth)/login?role=${role}`);
  });

  return (
    <Screen showBack keyboard>
        <ScreenTitle title="Recuperar senha" subtitle={`Etapa ${step} de 3`} />
        {banner ? (
          <AppMessage title={banner.title} body={banner.body} kind={banner.kind} />
        ) : null}
        {step === 1 ? (
          <>
            <Controller
              control={emailForm.control}
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
                  error={emailForm.formState.errors.email?.message}
                />
              )}
            />
            <Text style={styles.hint}>No MVP o código mock é 123456.</Text>
            <Button
              label="Continuar"
              loading={emailForm.formState.isSubmitting}
              onPress={sendCode}
            />
          </>
        ) : null}
        {step === 2 ? (
          <>
            <Controller
              control={otpForm.control}
              name="token"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Código"
                  placeholder="Digite o código"
                  keyboardType="number-pad"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={otpForm.formState.errors.token?.message}
                />
              )}
            />
            <Button
              label="Continuar"
              loading={otpForm.formState.isSubmitting}
              onPress={checkCode}
            />
          </>
        ) : null}
        {step === 3 ? (
          <>
            <Controller
              control={passwordForm.control}
              name="password"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Nova senha"
                  placeholder="Nova senha"
                  secureTextEntry
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={passwordForm.formState.errors.password?.message}
                />
              )}
            />
            <Controller
              control={passwordForm.control}
              name="confirmPassword"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Confirmar senha"
                  placeholder="Repita a senha"
                  secureTextEntry
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  error={passwordForm.formState.errors.confirmPassword?.message}
                />
              )}
            />
            <Button
              label="Alterar senha"
              loading={passwordForm.formState.isSubmitting}
              onPress={changePassword}
            />
          </>
        ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, marginBottom: 16, fontSize: 13 },
});
