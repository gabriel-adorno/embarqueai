import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { ConfirmModal } from '@/src/components/ui/ConfirmModal';
import { Input } from '@/src/components/ui/Input';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { LoadingState } from '@/src/components/ui/States';
import { getProfile, updateProfile } from '@/src/services/profiles';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/session';
import { notifyError, notifyKey } from '@/src/lib/notify';
import { changePassword } from '@/src/services/auth';
import { href } from '@/src/lib/href';

export default function ProfileTab() {
  const qc = useQueryClient();
  const session = useSessionStore((s) => s.session);
  const signOut = useSessionStore((s) => s.signOut);
  const deleteAccount = useSessionStore((s) => s.deleteAccount);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const role = session?.user.user_metadata.role;
  const userId = session?.user.id;
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const query = useQuery({
    queryKey: ['profile', userId],
    enabled: Boolean(userId),
    queryFn: () => getProfile(userId!),
  });

  const form = useForm({
    values: {
      name: query.data?.name ?? '',
      phone: query.data?.phone ?? '',
    },
  });

  const passwordMut = useMutation({
    mutationFn: () => {
      if (password.length < 6) throw new Error('A senha deve ter pelo menos 6 caracteres.');
      if (password !== confirm) throw new Error('As senhas não coincidem.');
      return changePassword(userId!, password);
    },
    onSuccess: () => {
      setPassword('');
      setConfirm('');
      notifyKey('passwordChanged');
    },
    onError: (err: Error) => notifyError(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteAccount(),
    onError: (err: Error) => {
      setConfirmDelete(false);
      notifyError(err.message);
    },
  });

  const mutation = useMutation({
    mutationFn: (values: { name: string; phone: string }) =>
      updateProfile(userId!, { name: values.name, phone: values.phone }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile', userId] });
      notifyKey('profileUpdated');
    },
  });

  return (
    <>
    <Screen tab>
        <ScreenTitle
          title="Conta"
          subtitle={
            role === 'transporter'
              ? 'Seus dados de operação'
              : 'Seus dados. Para acompanhar alguém, abra Pessoas.'
          }
        />
        {query.isLoading ? <LoadingState /> : null}
        {query.data ? (
          <>
            <View style={styles.avatar}>
              <Text style={styles.initials}>
                {query.data.name
                  .split(' ')
                  .slice(0, 2)
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()}
              </Text>
            </View>
            <Text style={styles.email}>{query.data.email}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {role === 'transporter' ? 'Transportador' : 'Cliente'}
              </Text>
            </View>
            <Controller
              control={form.control}
              name="name"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Nome"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            <Controller
              control={form.control}
              name="phone"
              render={({ field: { onChange, onBlur, value } }) => (
                <Input
                  label="Telefone"
                  keyboardType="phone-pad"
                  value={value}
                  onChangeText={onChange}
                  onBlur={onBlur}
                />
              )}
            />
            <Button
              label="Salvar"
              loading={mutation.isPending}
              onPress={form.handleSubmit((v) => mutation.mutate(v))}
            />
            <Input
              label="Nova senha"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <Input
              label="Confirmar senha"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
            />
            <Button
              label="Alterar senha"
              variant="secondary"
              loading={passwordMut.isPending}
              onPress={() => passwordMut.mutate()}
            />
          </>
        ) : null}
        <View style={styles.gap}>
          <Button label="Sair" variant="danger" onPress={() => void signOut()} />
        </View>
        <View style={styles.legal}>
          <Link href={href('/legal/privacy')} style={styles.legalLink}>
            Política de Privacidade
          </Link>
          <Link href={href('/legal/terms')} style={styles.legalLink}>
            Termos de Uso
          </Link>
        </View>
        <View style={styles.gap}>
          <Button
            label="Excluir minha conta"
            variant="ghost"
            onPress={() => setConfirmDelete(true)}
          />
        </View>
    </Screen>
    <ConfirmModal
      visible={confirmDelete}
      title="Excluir sua conta?"
      body={
        role === 'transporter'
          ? 'Seus veículos, rotas, grupos e histórico de viagens serão apagados. Isso não pode ser desfeito. Se algum grupo ainda tiver passageiros, remova-os antes.'
          : 'Seus dados, ausências, vínculos com grupos e com quem você acompanha serão apagados. Isso não pode ser desfeito.'
      }
      yesLabel="Excluir"
      noLabel="Cancelar"
      danger
      loading={deleteMut.isPending}
      onNo={() => setConfirmDelete(false)}
      onYes={() => deleteMut.mutate()}
    />
    </>
  );
}

const styles = StyleSheet.create({
  legal: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 20 },
  legalLink: { color: colors.primary, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  avatar: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  initials: { color: colors.white, fontSize: 28, fontWeight: '800' },
  email: {
    textAlign: 'center',
    color: colors.textMuted,
    marginBottom: 10,
  },
  badge: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 20,
  },
  badgeText: {
    color: colors.primaryDark,
    fontWeight: '700',
    fontSize: 13,
  },
  gap: { marginTop: 12 },
});
