import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/States';
import { href } from '@/src/lib/href';
import { notifyError } from '@/src/lib/notify';
import {
  acceptFollow,
  listFollows,
  removeFollow,
  requestFollow,
} from '@/src/services/follows';
import { listGroupMembers, listGroupsForClient, listGroupsIRide } from '@/src/services/groups';
import { useSessionStore } from '@/src/store/session';
import { colors } from '@/src/theme/colors';
import type { Group } from '@/src/types/database';

export default function PeopleScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useSessionStore((s) => s.session?.user);
  const [email, setEmail] = useState('');

  const query = useQuery({
    queryKey: ['follows', user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [lists, own, visible] = await Promise.all([
        listFollows(user!.id),
        listGroupsIRide(user!.id),
        listGroupsForClient(user!.id),
      ]);
      const passengerGroups = new Map<string, Group[]>();
      for (const item of lists.watching) {
        if (item.status !== 'accepted') continue;
        const matched: Group[] = [];
        for (const group of visible) {
          const members = await listGroupMembers(group.id).catch(() => []);
          if (members.some((member) => member.user_id === item.passenger_id)) matched.push(group);
        }
        passengerGroups.set(item.passenger_id, matched);
      }
      return { ...lists, own, passengerGroups };
    },
  });

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['follows', user?.id] });
    void qc.invalidateQueries({ queryKey: ['groups'] });
    void qc.invalidateQueries({ queryKey: ['routes'] });
    void qc.invalidateQueries({ queryKey: ['home-routes'] });
  };

  const invite = useMutation({
    mutationFn: () => requestFollow(user!.id, email),
    onSuccess: () => {
      setEmail('');
      refresh();
    },
    onError: (err: Error) => notifyError(err.message),
  });

  const accept = useMutation({
    mutationFn: (id: string) => acceptFollow(user!.id, id),
    onSuccess: refresh,
    onError: (err: Error) => notifyError(err.message),
  });

  const remove = useMutation({
    mutationFn: removeFollow,
    onSuccess: refresh,
    onError: (err: Error) => notifyError(err.message),
  });

  const watching = query.data?.watching ?? [];
  const incoming = (query.data?.watched_by ?? []).filter((item) => item.status === 'pending');
  const guardians = (query.data?.watched_by ?? []).filter((item) => item.status === 'accepted');

  const openGroup = (groupId: string) => {
    router.push(href({ pathname: '/(app)/(tabs)/groups/[id]', params: { id: groupId } }));
  };

  return (
    <Screen tab>
      <ScreenTitle
        title="Pessoas"
        subtitle="Acompanhe quem viaja, ou aceite quem quer acompanhar você."
      />
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? (
        <ErrorState
          message={
            query.error instanceof Error && /404|follows|PGRST/i.test(query.error.message)
              ? 'Acompanhar alguém fica disponível depois de atualizar o servidor.'
              : 'Não foi possível carregar as pessoas.'
          }
        />
      ) : null}

      <Text style={styles.section}>Acompanho</Text>
      {watching.length === 0 ? (
        <EmptyState title="Ninguém ainda" hint="Informe o e-mail de quem viaja. A pessoa precisa aceitar." />
      ) : null}
      {watching.map((item) => {
        const groups = query.data?.passengerGroups.get(item.passenger_id) ?? [];
        const first = groups[0];
        return (
          <View key={item.id} style={styles.block}>
            <ListRow
              icon="person-outline"
              glyph="👤"
              title={item.person?.name ?? 'Passageiro'}
              subtitle={
                item.status === 'accepted'
                  ? groups.map((group) => group.name).join(', ') || 'Ainda sem grupo'
                  : 'Aguardando aceite'
              }
              onPress={first ? () => openGroup(first.id) : undefined}
            />
            <Button
              size="sm"
              variant="danger"
              label={item.status === 'accepted' ? 'Deixar de acompanhar' : 'Cancelar convite'}
              onPress={() => remove.mutate(item.id)}
            />
          </View>
        );
      })}

      <View style={styles.form}>
        <Input
          label="E-mail de quem viaja"
          placeholder="passageiro@email.com"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <Button label="Acompanhar" loading={invite.isPending} onPress={() => invite.mutate()} />
      </View>

      <Text style={styles.section}>Convites para você</Text>
      {incoming.length === 0 ? (
        <EmptyState title="Nenhum convite" hint="Quando alguém pedir para acompanhar sua viagem, aparece aqui." />
      ) : null}
      {incoming.map((item) => (
        <View key={item.id} style={styles.block}>
          <ListRow
            icon="person-outline"
            glyph="👤"
            title={item.person?.name ?? 'Responsável'}
            subtitle={item.person?.email ?? 'Quer acompanhar você'}
          />
          <View style={styles.row}>
            <View style={styles.action}>
              <Button size="sm" label="Aceitar" onPress={() => accept.mutate(item.id)} />
            </View>
            <View style={styles.action}>
              <Button size="sm" variant="danger" label="Recusar" onPress={() => remove.mutate(item.id)} />
            </View>
          </View>
        </View>
      ))}

      {guardians.length ? <Text style={styles.section}>Acompanham você</Text> : null}
      {guardians.map((item) => (
        <ListRow
          key={item.id}
          icon="person-outline"
          glyph="👤"
          title={item.person?.name ?? 'Responsável'}
          subtitle={item.person?.email ?? 'Vê a sua viagem'}
        />
      ))}

      <Text style={styles.section}>Minhas viagens</Text>
      {query.data?.own.length === 0 ? (
        <EmptyState
          title="Você ainda não viaja"
          hint="Quando o transportador adicionar seu e-mail a um grupo, a van aparece no Início."
        />
      ) : null}
      {query.data?.own.map((group) => (
        <ListRow
          key={group.id}
          icon="people-outline"
          glyph="🚐"
          title={group.name}
          subtitle="Sua viagem"
          onPress={() => openGroup(group.id)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 8,
    marginBottom: 10,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  block: { gap: 8, marginBottom: 12 },
  form: { marginTop: 4, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  action: { flex: 1 },
});
