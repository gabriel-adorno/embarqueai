import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LiveTripMap } from '@/src/components/map/LiveTripMap';
import { BackButton } from '@/src/components/ui/BackButton';
import { Button } from '@/src/components/ui/Button';
import { ConfirmModal } from '@/src/components/ui/ConfirmModal';
import { Input } from '@/src/components/ui/Input';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/States';
import { notifyError } from '@/src/lib/notify';
import { listGroupsForTransporter } from '@/src/services/groups';
import { getRoute, listRoutePoints, listRoutes, updateRoute } from '@/src/services/routes';
import { listActiveTripForRoute } from '@/src/services/trips';
import { useSessionStore } from '@/src/store/session';
import { colors } from '@/src/theme/colors';

export default function RouteLiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const isTransporter =
    useSessionStore((s) => s.session?.user.user_metadata.role) === 'transporter';
  const loaded = useRef('');
  const [name, setName] = useState('');
  const [outbound, setOutbound] = useState('');
  const [backTime, setBackTime] = useState('');
  const [pointNames, setPointNames] = useState<{ id?: string; name: string }[]>([]);
  const [newPoint, setNewPoint] = useState('');
  const userId = useSessionStore((s) => s.session?.user.id);
  /** null até carregar os grupos; depois, os IDs dos grupos marcados para esta rota. */
  const [groupIds, setGroupIds] = useState<string[] | null>(null);
  const [pendingMove, setPendingMove] = useState<{ id: string; name: string; from: string } | null>(
    null,
  );

  const groups = useQuery({
    queryKey: ['route-edit-groups', id, userId],
    enabled: Boolean(id && userId && isTransporter),
    queryFn: async () => {
      const [list, routes] = await Promise.all([
        listGroupsForTransporter(userId!),
        listRoutes(userId!),
      ]);
      const names = new Map(routes.map((route) => [route.id, route.name]));
      return list.map((group) => ({
        ...group,
        currentRoute: group.route_id && group.route_id !== id ? names.get(group.route_id) ?? 'outra rota' : null,
      }));
    },
  });

  useEffect(() => {
    if (!groups.data || groupIds !== null) return;
    setGroupIds(groups.data.filter((group) => group.route_id === id).map((group) => group.id));
  }, [groups.data, groupIds, id]);

  const query = useQuery({
    queryKey: ['route-live-gate', id],
    enabled: Boolean(id),
    refetchInterval: 5_000,
    queryFn: async () => {
      const route = await getRoute(id);
      if (!route) throw new Error('Rota não encontrada.');
      const [trip, points] = await Promise.all([
        listActiveTripForRoute(id),
        listRoutePoints(id),
      ]);
      return { route, points, live: trip?.status === 'in_progress' };
    },
  });

  useEffect(() => {
    if (!query.data || loaded.current === query.data.route.id) return;
    loaded.current = query.data.route.id;
    setName(query.data.route.name);
    setOutbound(query.data.route.outbound_time ?? '');
    setBackTime(query.data.route.return_time ?? '');
    setPointNames(query.data.points.map((point) => ({ id: point.id, name: point.name })));
  }, [query.data]);

  const save = useMutation({
    mutationFn: () =>
      updateRoute(id, {
        name,
        outbound_time: outbound || null,
        return_time: backTime || null,
        points: pointNames.map((point, index) => ({
          id: point.id,
          name: point.name,
          sort_order: index,
        })),
        ...(groupIds !== null ? { group_ids: groupIds } : {}),
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['route-live-gate', id] });
      void qc.invalidateQueries({ queryKey: ['route-edit-groups', id] });
      void qc.invalidateQueries({ queryKey: ['routes'] });
      void qc.invalidateQueries({ queryKey: ['groups'] });
      void qc.invalidateQueries({ queryKey: ['group'] });
    },
    onError: (err: Error) => notifyError(err.message),
  });

  if (query.isLoading) {
    return (
      <Screen tab keyboard showBack>
        <LoadingState />
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen tab keyboard showBack>
        <ErrorState message="Não foi possível abrir a rota." />
      </Screen>
    );
  }

  if (!query.data?.live) {
    return (
      <>
      <Screen tab keyboard showBack>
        <ScreenTitle
          title={query.data?.route.name ?? 'Rota'}
          subtitle={
            isTransporter
              ? 'Ajuste nome, horários, grupos e a ordem dos pontos.'
              : 'Pontos desta rota. O mapa ao vivo aparece quando o trajeto começa.'
          }
        />
        {isTransporter ? (
          <>
            <Input label="Nome" value={name} onChangeText={setName} />
            <Input label="Horário da ida" placeholder="07:10" value={outbound} onChangeText={setOutbound} />
            <Input label="Horário da volta" placeholder="12:30" value={backTime} onChangeText={setBackTime} />
            <Text style={styles.label}>Grupos nesta rota</Text>
            {groups.isLoading ? <Text style={styles.hint}>Carregando grupos…</Text> : null}
            {groups.data && !groups.data.length ? (
              <Text style={styles.hint}>Você ainda não tem grupos. Crie um na aba Grupos.</Text>
            ) : null}
            {groups.data?.map((group) => {
              const on = groupIds?.includes(group.id) ?? false;
              return (
                <Pressable
                  key={group.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={group.name}
                  onPress={() => {
                    if (on) {
                      setGroupIds((current) => (current ?? []).filter((gid) => gid !== group.id));
                    } else if (group.currentRoute) {
                      setPendingMove({ id: group.id, name: group.name, from: group.currentRoute });
                    } else {
                      setGroupIds((current) => [...(current ?? []), group.id]);
                    }
                  }}
                  style={[styles.option, on && styles.optionOn]}
                >
                  <Text style={[styles.optionText, on && styles.optionTextOn]}>{group.name}</Text>
                  {group.currentRoute ? (
                    <Text style={[styles.optionHint, on && styles.optionHintOn]}>
                      {on ? `Sai de: ${group.currentRoute}` : `Hoje na rota: ${group.currentRoute}`}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
            {pointNames.map((point, index) => (
              <View key={point.id ?? `new-${index}`} style={styles.point}>
                <Input
                  label={`Ponto ${index + 1}`}
                  value={point.name}
                  onChangeText={(value) =>
                    setPointNames((current) =>
                      current.map((item) => (item.id === point.id ? { ...item, name: value } : item)),
                    )
                  }
                />
                <View style={styles.pointActions}>
                  <View style={styles.pointAction}>
                    <Button
                      size="sm"
                      variant="secondary"
                      label="Subir"
                      disabled={index === 0}
                      onPress={() => setPointNames((current) => movePoint(current, index, -1))}
                    />
                  </View>
                  <View style={styles.pointAction}>
                    <Button
                      size="sm"
                      variant="secondary"
                      label="Descer"
                      disabled={index === pointNames.length - 1}
                      onPress={() => setPointNames((current) => movePoint(current, index, 1))}
                    />
                  </View>
                  <View style={styles.pointAction}>
                    <Button
                      size="sm"
                      variant="danger"
                      label="Tirar"
                      disabled={pointNames.length <= 2}
                      onPress={() =>
                        setPointNames((current) => current.filter((_, item) => item !== index))
                      }
                    />
                  </View>
                </View>
              </View>
            ))}
            <Input
              label="Novo ponto"
              placeholder="Endereço ou nome"
              value={newPoint}
              onChangeText={setNewPoint}
            />
            <Button
              size="sm"
              variant="secondary"
              label="Incluir ponto"
              onPress={() => {
                const value = newPoint.trim();
                if (value.length < 2 || pointNames.length >= 8) return;
                setPointNames((current) => [...current, { name: value }]);
                setNewPoint('');
              }}
            />
            <Button label="Salvar rota" loading={save.isPending} onPress={() => save.mutate()} />
          </>
        ) : query.data?.points.length ? (
          query.data.points.map((point, index) => (
            <ListRow
              key={point.id}
              icon="location-outline"
              glyph="📍"
              title={point.name}
              subtitle={`Ponto ${index + 1}`}
            />
          ))
        ) : (
          <EmptyState title="Rota sem pontos" />
        )}
      </Screen>
      <ConfirmModal
        visible={Boolean(pendingMove)}
        title={
          pendingMove
            ? `"${pendingMove.name}" está na rota "${pendingMove.from}". Mover para esta rota? A rota atual ficará sem esse grupo.`
            : ''
        }
        onNo={() => setPendingMove(null)}
        onYes={() => {
          const move = pendingMove;
          if (move) setGroupIds((current) => [...(current ?? []), move.id]);
          setPendingMove(null);
        }}
      />
      </>
    );
  }

  return (
    <LiveTripMap
      routeId={id}
      header={
        <View style={styles.topRow}>
          <BackButton />
          <Text style={styles.topTitle}>Rota ao vivo</Text>
          <View style={styles.topSpacer} />
        </View>
      }
    />
  );
}

function movePoint<T>(items: T[], index: number, delta: number) {
  const next = index + delta;
  if (next < 0 || next >= items.length) return items;
  const copy = [...items];
  const [item] = copy.splice(index, 1);
  copy.splice(next, 0, item);
  return copy;
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.tabInk,
    letterSpacing: -0.3,
  },
  topSpacer: { width: 44, height: 44 },
  point: { marginBottom: 8 },
  label: { color: colors.ink, fontWeight: '600', marginBottom: 8, marginTop: 8, fontSize: 13 },
  hint: { color: colors.textMuted, fontSize: 13, marginBottom: 12 },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
    backgroundColor: colors.surface,
  },
  optionOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { fontWeight: '700', color: colors.ink },
  optionTextOn: { color: colors.white },
  optionHint: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  optionHintOn: { color: colors.white, opacity: 0.85 },
  pointActions: { flexDirection: 'row', gap: 8, marginTop: -8, marginBottom: 8 },
  pointAction: { flex: 1 },
});
