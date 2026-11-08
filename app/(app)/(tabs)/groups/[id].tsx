import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { ConfirmModal } from '@/src/components/ui/ConfirmModal';
import { ContactActions } from '@/src/components/ui/ContactActions';
import { Input } from '@/src/components/ui/Input';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/States';
import {
  addGroupMemberByEmail,
  clearAbsence,
  deleteGroup,
  getGroup,
  listAbsences,
  listUpcomingAbsences,
  listGroupMembers,
  removeGroupMember,
  setAbsence,
  setMemberPoint,
  updateGroup,
} from '@/src/services/groups';
import { getProfile } from '@/src/services/profiles';
import { listRoutePoints } from '@/src/services/routes';
import { getVehicle, listVehicles } from '@/src/services/vehicles';
import { useSessionStore } from '@/src/store/session';
import { colors } from '@/src/theme/colors';
import { listFollows } from '@/src/services/follows';
import { formatDay, nextWeekdays, todayInSaoPaulo } from '@/src/lib/day';
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  const query = useQuery({
    queryKey: ['group', id, isTransporter],
    enabled: Boolean(id),
    queryFn: async () => {
      const group = await getGroup(id);
      if (!group) throw new Error('Grupo não encontrado.');
      const [vehicle, transporter, members, absences, upcoming, points, vehicles, follows] = await Promise.all([
        getVehicle(group.vehicle_id),
        getProfile(group.transporter_id),
        listGroupMembers(group.id).catch(() => []),
        listAbsences(group.id),
        listUpcomingAbsences(group.id).catch(() => []),
        group.route_id ? listRoutePoints(group.route_id) : Promise.resolve([]),
        isTransporter && user ? listVehicles(user.id) : Promise.resolve([]),
        !isTransporter && user
          ? listFollows(user.id).catch(() => ({ watching: [], watched_by: [] }))
          : Promise.resolve({ watching: [], watched_by: [] }),
      ]);
      const watched = follows.watching
        .filter((item) => item.status === 'accepted')
        .map((item) => item.passenger_id);
      return {
        group,
        members: isTransporter ? members : [],
        allMembers: members,
        watched,
        isMember: members.some((member) => member.user_id === user?.id),
        vehicle,
        transporter,
        absences,
        upcoming,
        points,
        vehicles,
      };
    },
  });

  const [groupName, setGroupName] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  useEffect(() => {
    if (!query.data) return;
    setGroupName(query.data.group.name);
    setVehicleId(query.data.group.vehicle_id);
  }, [query.data?.group.id, query.data?.group.name, query.data?.group.vehicle_id]);

  const saveGroup = useMutation({
    mutationFn: () => updateGroup(id, { name: groupName, vehicle_id: vehicleId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['group', id] }),
    onError: (err: Error) => notifyError(err.message),
  });

  const pointMut = useMutation({
    mutationFn: (input: { userId: string; pointId: string | null }) =>
      setMemberPoint(id, input.userId, input.pointId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['group', id] }),
    onError: (err: Error) => notifyError(err.message),
  });

  const absentIds = new Set(query.data?.absences.map((item) => item.user_id) ?? []);
  const iAmAbsent = Boolean(user && absentIds.has(user.id));

  const absenceMut = useMutation({
    mutationFn: () => (iAmAbsent ? clearAbsence(id, user!.id) : setAbsence(id, user!.id)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['group', id] }),
    onError: (err: Error) => notifyError(err.message),
  });

  const today = todayInSaoPaulo();
  const myUpcoming = new Set(
    (query.data?.upcoming ?? [])
      .filter((item) => item.user_id === user?.id && item.absent_on > today)
      .map((item) => item.absent_on),
  );
  const scheduleDays = nextWeekdays(today, 15);

  const scheduleMut = useMutation({
    mutationFn: (input: { day: string; absent: boolean }) =>
      input.absent ? clearAbsence(id, user!.id, input.day) : setAbsence(id, user!.id, input.day),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['group', id] }),
    onError: (err: Error) => notifyError(err.message),
  });

  const memberName = (userId: string) =>
    query.data?.members.find((member) => member.user_id === userId)?.profile.name ?? 'Passageiro';
  const futureAbsences = (query.data?.upcoming ?? []).filter((item) => item.absent_on > today);

  const addMut = useMutation({
    mutationFn: () => addGroupMemberByEmail(id, email),
    onSuccess: () => {
      setEmail('');
      void qc.invalidateQueries({ queryKey: ['group', id] });
      notifyKey('memberAdded');
    },
    onError: (err: Error) => notifyError(err.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteGroup(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['groups'] });
      router.back();
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
            isTransporter ? 'Veículo, motorista e passageiros' : 'Veículo e motorista do grupo'
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
            <ContactActions phone={query.data.transporter?.phone} />
            {!isTransporter && query.data.points.length
              ? query.data.allMembers
                  .filter(
                    (member) =>
                      member.user_id === user?.id || query.data?.watched.includes(member.user_id),
                  )
                  .map((member) => (
                    <View key={member.user_id} style={styles.block}>
                      <Text style={styles.label}>
                        {member.user_id === user?.id ? 'Meu ponto' : `Ponto de ${member.profile.name}`}
                      </Text>
                      <View style={styles.points}>
                        {query.data?.points.map((point) => {
                          const selected = member.point_id === point.id;
                          return (
                            <Pressable
                              key={point.id}
                              onPress={() =>
                                pointMut.mutate({
                                  userId: member.user_id,
                                  pointId: selected ? null : point.id,
                                })
                              }
                              style={[styles.chip, selected && styles.chipOn]}
                            >
                              <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                                {point.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))
              : null}
            {!isTransporter && query.data.isMember ? (
              <Button
                label={iAmAbsent ? 'Vou hoje' : 'Não vou hoje'}
                variant={iAmAbsent ? 'secondary' : 'danger'}
                loading={absenceMut.isPending}
                onPress={() => absenceMut.mutate()}
              />
            ) : null}
            {!isTransporter && query.data.isMember ? (
              <View style={styles.block}>
                <Text style={styles.label}>Programar ausência</Text>
                <Text style={styles.hint}>Toque nos dias em que você não vai.</Text>
                <View style={styles.points}>
                  {scheduleDays.map((day) => {
                    const absent = myUpcoming.has(day);
                    return (
                      <Pressable
                        key={day}
                        disabled={scheduleMut.isPending}
                        onPress={() => scheduleMut.mutate({ day, absent })}
                        style={[styles.chip, absent && styles.chipAbsent]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: absent }}
                        accessibilityLabel={`${formatDay(day)}${absent ? ', ausente' : ''}`}
                      >
                        <Text style={[styles.chipText, absent && styles.chipTextOn]}>
                          {formatDay(day)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
            {isTransporter ? (
              <>
                <Input label="Nome do grupo" value={groupName} onChangeText={setGroupName} />
                <Text style={styles.label}>Veículo</Text>
                {query.data.vehicles.map((item) => {
                  const selected = vehicleId === item.id;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => setVehicleId(item.id)}
                      style={[styles.option, selected && styles.optionOn]}
                    >
                      <Text style={[styles.optionText, selected && styles.optionTextOn]}>
                        {item.type} · {item.plate}
                      </Text>
                    </Pressable>
                  );
                })}
                <Button
                  size="sm"
                  label="Salvar grupo"
                  loading={saveGroup.isPending}
                  onPress={() => saveGroup.mutate()}
                />
                {query.data.members.length === 0 ? (
                  <EmptyState title="Sem passageiros" hint="Adicione pelo e-mail da conta do passageiro." />
                ) : null}
                {query.data.members.map((member) => (
                  <View key={member.user_id} style={styles.block}>
                    <ListRow
                      icon="person-outline"
                      glyph="👤"
                      title={member.profile.name}
                      subtitle={[
                        member.profile.email,
                        member.profile.phone,
                        absentIds.has(member.user_id) ? 'Não vai hoje' : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                    {query.data.points.length ? (
                      <View style={styles.points}>
                        {query.data.points.map((point) => {
                          const selected = member.point_id === point.id;
                          return (
                            <Pressable
                              key={point.id}
                              onPress={() =>
                                pointMut.mutate({
                                  userId: member.user_id,
                                  pointId: selected ? null : point.id,
                                })
                              }
                              style={[styles.chip, selected && styles.chipOn]}
                            >
                              <Text style={[styles.chipText, selected && styles.chipTextOn]}>
                                {point.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    ) : null}
                    <Button
                      size="sm"
                      label="Remover"
                      variant="danger"
                      onPress={() => setRemoveUserId(member.user_id)}
                    />
                  </View>
                ))}
                {futureAbsences.length ? (
                  <View style={styles.block}>
                    <Text style={styles.label}>Próximas ausências</Text>
                    {futureAbsences.map((item) => (
                      <Text key={item.id} style={styles.absenceRow}>
                        {formatDay(item.absent_on)} · {memberName(item.user_id)}
                      </Text>
                    ))}
                  </View>
                ) : null}
                <Button
                  label="Excluir grupo"
                  variant="danger"
                  loading={deleteMut.isPending}
                  onPress={() => setConfirmDelete(true)}
                />
                <View style={styles.add}>
                  <Input
                    label="Adicionar passageiro por e-mail"
                    placeholder="passageiro@email.com"
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
        visible={confirmDelete}
        title="Certeza que deseja excluir este grupo?"
        onNo={() => setConfirmDelete(false)}
        onYes={() => {
          setConfirmDelete(false);
          deleteMut.mutate();
        }}
      />
      <ConfirmModal
        visible={Boolean(removeUserId)}
        title="Certeza que deseja remover este passageiro?"
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
  label: { color: colors.ink, fontWeight: '600', marginBottom: 8, fontSize: 13 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  optionOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { fontWeight: '700', color: colors.ink },
  optionTextOn: { color: colors.white },
  points: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontWeight: '700', color: colors.ink, fontSize: 13 },
  chipTextOn: { color: colors.white },
  chipAbsent: { backgroundColor: colors.danger, borderColor: colors.danger },
  hint: { color: colors.textMuted, fontSize: 12, marginTop: -4, marginBottom: 8 },
  absenceRow: { color: colors.ink, fontSize: 14, paddingVertical: 4 },
});
