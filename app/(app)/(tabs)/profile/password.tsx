import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { notifyError, notifyKey } from '@/src/lib/notify';
import { changePassword } from '@/src/services/auth';
import { useSessionStore } from '@/src/store/session';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const userId = useSessionStore((s) => s.session?.user.id);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const mutation = useMutation({
    mutationFn: () => {
      if (password.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
      if (password !== confirm) throw new Error('As senhas não coincidem.');
      return changePassword(userId!, password);
    },
    onSuccess: () => {
      notifyKey('passwordChanged');
      router.back();
    },
    onError: (err: Error) => notifyError(err.message),
  });

  return (
    <Screen tab keyboard showBack>
      <ScreenTitle title="Alterar senha" subtitle="Use pelo menos 6 caracteres." />
      <Input
        label="Nova senha"
        placeholder="Mínimo 6 caracteres"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Input
        label="Confirmar senha"
        placeholder="Repita a senha"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
      />
      <Button label="Salvar nova senha" loading={mutation.isPending} onPress={() => mutation.mutate()} />
    </Screen>
  );
}
