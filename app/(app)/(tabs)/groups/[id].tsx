import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { ConfirmModal } from '@/src/components/ui/ConfirmModal';
import { Input } from '@/src/components/ui/Input';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/States';
import {
  addGroupMemberByEmail,
  getGroup,
  listGroupMembers,
  removeGroupMember,
} from '@/src/services/groups';
import { getProfile } from '@/src/services/profiles';
import { getVehicle } from '@/src/services/vehicles';
import { useSessionStore } from '@/src/store/session';
import { href } from '@/src/lib/href';
import { notifyError, notifyKey } from '@/src/lib/notify';

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSessionStore((s) => s.session?.user);
  const isTransporter = user?.user_metadata.role === 'transporter';
  const [email, setEmail] = useState('');
  const [removeUserId, setRemoveUserId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['group', id, isTransporter],
    enabled: Boolean(id),
    queryFn: async () => {
      const group = await getGroup(id);
      if (!group) throw new Error('Grupo não encontrado.');
      const [vehicle, transporter, members] = await Promise.all([
        getVehicle(group.vehicle_id),
        getProfile(group.transporter_id),
        isTransporter ? listGroupMembers(group.id) : Promise.resolve([]),
      ]);
      return { group, members, vehicle, transporter };
    },
  });

  const addMut = useMutation({
    mutationFn: () => addGroupMemberByEmail(id, email),
    onSuccess: () => {
      setEmail('');
      void qc.invalidateQueries({ queryKey: ['group', id] });
      notifyKey('memberAdded');
    },
    onError: (err: Error) => notifyError(err.message),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => removeGroupMember(id, userId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['group', id] }),
  });

  return (
    <>
    <Screen tab showBack>
        <ScreenTitle
          title={query.data?.group.name ?? 'Grupo'}
          subtitle={
            isTransporter ? 'Van, motorista e alunos' : 'Van e motorista do grupo'
          }
        />
        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? <ErrorState message="Não foi possível abrir o grupo." /> : null}
        {query.data ? (
          <>
            <ListRow
              icon="bus-outline"
              glyph="🚐"
              title={query.data.vehicle?.type ?? 'Van'}
              subtitle={query.data.vehicle?.plate ?? ''}
              onPress={() =>
                router.push(href(`/(app)/(tabs)/groups/van/${query.data.group.vehicle_id}`))
              }
            />
            <ListRow
              icon="person-outline"
              glyph="👤"
              title={query.data.transporter?.name ?? 'Motorista'}
              subtitle={
                [query.data.transporter?.email, query.data.transporter?.phone]
                  .filter(Boolean)
                  .join(' · ') || 'Motorista do grupo'
              }
            />
            {isTransporter ? (
              <>
                {query.data.members.length === 0 ? (
                  <EmptyState title="Sem alunos" hint="Adicione pelo e-mail da conta do aluno." />
                ) : null}
                {query.data.members.map((member) => (
                  <View key={member.user_id} style={styles.block}>
                    <ListRow
                      icon="person-outline"
                      glyph="👤"
                      title={member.profile.name}
                      subtitle={[member.profile.email, member.profile.phone]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                    <Button
                      label="Remover"
                      variant="danger"
                      onPress={() => setRemoveUserId(member.user_id)}
                    />
                  </View>
                ))}
                <View style={styles.add}>
                  <Input
                    label="Adicionar aluno por e-mail"
                    placeholder="aluno@email.com"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />
                  <Button
                    label="Adicionar"
                    loading={addMut.isPending}
                    onPress={() => addMut.mutate()}
                  />
                </View>
              </>
            ) : null}
          </>
        ) : null}
    </Screen>
      <ConfirmModal
        visible={Boolean(removeUserId)}
        title="Certeza que deseja remover este aluno?"
        onNo={() => setRemoveUserId(null)}
        onYes={() => {
          if (removeUserId) removeMut.mutate(removeUserId);
          setRemoveUserId(null);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10, marginBottom: 8 },
  add: { marginTop: 16 },
});
