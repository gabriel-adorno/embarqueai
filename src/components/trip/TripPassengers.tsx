import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/src/components/ui/Button';
import { listAbsences, listGroupMembers, listGroupsForTransporter } from '@/src/services/groups';
import { listRoutePoints } from '@/src/services/routes';
import { listBoardings, setBoarding } from '@/src/services/trips';
import { colors } from '@/src/theme/colors';
import { useSessionStore } from '@/src/store/session';
import { notifyError } from '@/src/lib/notify';
import type { BoardingStatus } from '@/src/types/database';

type Props = {
  tripId: string;
  routeId: string;
};

export function TripPassengers({ tripId, routeId }: Props) {
  const qc = useQueryClient();
  const user = useSessionStore((s) => s.session?.user);
  const isTransporter = user?.user_metadata.role === 'transporter';

  const query = useQuery({
    queryKey: ['trip-passengers', tripId, routeId, user?.id],
    enabled: Boolean(user),
    queryFn: async () => {
      const [boardings, points] = await Promise.all([
        listBoardings(tripId),
        listRoutePoints(routeId).catch(() => []),
      ]);
      if (!isTransporter || !user) return { members: [], boardings, absentIds: [] as string[], points };
      const groups = (await listGroupsForTransporter(user.id)).filter((group) => group.route_id === routeId);
      const members = (
        await Promise.all(groups.map((group) => listGroupMembers(group.id)))
      ).flat();
      const absences = (
        await Promise.all(groups.map((group) => listAbsences(group.id)))
      ).flat();
      const unique = new Map(members.map((member) => [member.user_id, member]));
      return {
        members: [...unique.values()],
        boardings,
        absentIds: absences.map((item) => item.user_id),
        points,
      };
    },
  });

  const mutation = useMutation({
    mutationFn: (input: { userId: string; status: BoardingStatus }) =>
      setBoarding(tripId, input.userId, input.status),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['trip-passengers', tripId] }),
    onError: (err: Error) => notifyError(err.message),
  });

  if (!isTransporter) {
    const mine = query.data?.boardings.find((item) => item.user_id === user?.id);
    if (!mine) return null;
    return (
      <Text style={styles.mine}>
        {mine.status === 'boarded' ? 'Você embarcou' : 'Você desembarcou'}
      </Text>
    );
  }

  const members = query.data?.members ?? [];
  if (!members.length) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Passageiros</Text>
      <ScrollView style={styles.list} nestedScrollEnabled>
      {members.map((member) => {
        const boarding = query.data?.boardings.find((item) => item.user_id === member.user_id);
        const absent = query.data?.absentIds.includes(member.user_id);
        const stop = query.data?.points.find((point) => point.id === member.point_id)?.name;
        const label = [
          boarding?.status === 'boarded'
            ? 'Embarcou'
            : boarding?.status === 'alighted'
              ? 'Desembarcou'
              : absent
                ? 'Avisou ausência'
                : 'Aguardando',
          stop,
        ]
          .filter(Boolean)
          .join(' · ');
        return (
          <View key={member.user_id} style={styles.row}>
            <View style={styles.copy}>
              <Text style={styles.name}>{member.profile.name}</Text>
              <Text style={styles.state}>{label}</Text>
            </View>
            <View style={styles.actions}>
              <View style={styles.action}>
                <Button
                  label="Embarcou"
                  variant={boarding?.status === 'boarded' ? 'primary' : 'secondary'}
                  disabled={absent || mutation.isPending}
                  onPress={() => mutation.mutate({ userId: member.user_id, status: 'boarded' })}
                />
              </View>
              <View style={styles.action}>
                <Button
                  label="Desembarcou"
                  variant={boarding?.status === 'alighted' ? 'primary' : 'secondary'}
                  disabled={!boarding || absent || mutation.isPending}
                  onPress={() => mutation.mutate({ userId: member.user_id, status: 'alighted' })}
                />
              </View>
            </View>
          </View>
        );
      })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14, gap: 10 },
  list: { maxHeight: 220 },
  action: { flex: 1 },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  row: { gap: 8 },
  copy: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { fontWeight: '700', color: colors.ink, flex: 1 },
  state: { color: colors.textMuted, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 8 },
  mine: { marginTop: 12, fontWeight: '700', color: colors.ink },
});
