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
import { isRemote } from '@/src/lib/config';
import { href } from '@/src/lib/href';
import { flashFromAuthError, notifyKey } from '@/src/lib/notify';
import { otpSchema } from '@/src/lib/schemas';
import * as auth from '@/src/services/auth';
import { useSessionStore } from '@/src/store/session';
import { colors } from '@/src/theme/colors';
import type { FlashMessage } from '@/src/store/toast';

export default function ConfirmEmailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string; role?: string }>();
  const email = params.email ?? '';
  const setSession = useSessionStore((s) => s.setSession);
  const [banner, setBanner] = useState<FlashMessage | null>(null);
  const form = useForm<{ token: string }>({
    resolver: zodResolver(otpSchema),
    defaultValues: { token: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const { data, error } = await auth.verifyOtp({
      email,
      token: values.token,
      type: 'signup',
    });
    setBanner(null);
    if (error || !data.session) {
      setBanner(flashFromAuthError(error));
      return;
    }
    await setSession(data.session);
    notifyKey('accountCreated');
    router.replace(href('/(app)/(tabs)'));
  });

  return (
    <Screen showBack keyboard>
      <ScreenTitle title="Confirmar e-mail" subtitle={email || 'Digite o código recebido'} />
      {banner ? <AppMessage title={banner.title} body={banner.body} kind={banner.kind} /> : null}
      <Text style={styles.hint}>
        {isRemote()
          ? 'Digite o código que chegou no e-mail para liberar a conta.'
          : 'No teste local, o código é 123456.'}
      </Text>
      <Controller
        control={form.control}
        name="token"
        render={({ field: { onChange, onBlur, value } }) => (
          <Input
            label="Código"
            keyboardType="number-pad"
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            error={form.formState.errors.token?.message}
          />
        )}
      />
      <Button label="Confirmar" loading={form.formState.isSubmitting} onPress={onSubmit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, marginBottom: 16, fontSize: 14, lineHeight: 20 },
});
