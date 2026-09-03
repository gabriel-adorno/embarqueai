import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Screen } from '@/src/components/ui/Screen';
import { LoadingState } from '@/src/components/ui/States';
import { getProfile, updateProfile } from '@/src/services/profiles';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/session';
import { href } from '@/src/lib/href';
import { notifyKey } from '@/src/lib/notify';

export default function ProfileTab() {
  const router = useRouter();
  const qc = useQueryClient();
  const session = useSessionStore((s) => s.session);
  const signOut = useSessionStore((s) => s.signOut);
  const role = session?.user.user_metadata.role;
  const userId = session?.user.id;

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

  const mutation = useMutation({
    mutationFn: (values: { name: string; phone: string }) =>
      updateProfile(userId!, { name: values.name, phone: values.phone }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['profile', userId] });
      notifyKey('profileUpdated');
    },
  });

  return (
    <Screen tab>
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
          </>
        ) : null}
        {role === 'transporter' ? (
          <View style={styles.gap}>
            <Button
              label="Veículos"
              variant="secondary"
              onPress={() => router.push(href('/(app)/(tabs)/profile/vehicles'))}
            />
          </View>
        ) : null}
        <View style={styles.gap}>
          <Button label="Sair" variant="danger" onPress={() => void signOut()} />
        </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 20,
  },
  gap: { marginTop: 12 },
});
