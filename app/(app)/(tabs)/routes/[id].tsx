import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { LiveTripMap } from '@/src/components/map/LiveTripMap';
import { BackButton } from '@/src/components/ui/BackButton';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { ListRow } from '@/src/components/ui/ListRow';
import { Screen } from '@/src/components/ui/Screen';
import { ScreenTitle } from '@/src/components/ui/ScreenTitle';
import { EmptyState, ErrorState, LoadingState } from '@/src/components/ui/States';
import { notifyError } from '@/src/lib/notify';
import { getRoute, listRoutePoints, updateRoute } from '@/src/services/routes';
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
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['route-live-gate', id] }),
    onError: (err: Error) => notifyError(err.message),
  });

  if (query.isLoading) {
    return (
      <Screen tab showBack>
        <LoadingState />
      </Screen>
    );
  }

  if (query.isError) {
    return (
      <Screen tab showBack>
        <ErrorState message="Não foi possível abrir a rota." />
      </Screen>
    );
  }

  if (!query.data?.live) {
    return (
      <Screen tab showBack>
        <ScreenTitle
          title={query.data?.route.name ?? 'Rota'}
          subtitle={
            isTransporter
              ? 'Ajuste nome, horários e a ordem dos pontos.'
              : 'Pontos desta rota. O mapa ao vivo aparece quando o trajeto começa.'
          }
        />
        {isTransporter ? (
          <>
            <Input label="Nome" value={name} onChangeText={setName} />
            <Input label="Horário da ida" placeholder="07:10" value={outbound} onChangeText={setOutbound} />
            <Input label="Horário da volta" placeholder="12:30" value={backTime} onChangeText={setBackTime} />
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
  pointActions: { flexDirection: 'row', gap: 8, marginTop: -8, marginBottom: 8 },
  pointAction: { flex: 1 },
});
