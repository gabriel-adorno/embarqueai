import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { formatEta } from '@/src/lib/eta';
import { deviceNotice } from '@/src/lib/deviceNotice';
import { listBoardings, listAlerts, listActiveTripForRoute } from '@/src/services/trips';
import { getLatestTripPosition } from '@/src/services/trips';
import { listFollows } from '@/src/services/follows';
import { listRoutes } from '@/src/services/routes';
import { useSessionStore } from '@/src/store/session';

const SEEN_KEY = '@embarqueai/seen-notices';

/** Avisa chegada, embarque e atraso mesmo fora da tela do mapa. */
export function FamilyNotifier() {
  const user = useSessionStore((s) => s.session?.user);
  const enabled = user?.user_metadata.role === 'client';
  const seen = useRef<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ['family-notices', user?.id],
    enabled: Boolean(user) && enabled,
    refetchInterval: 20_000,
    queryFn: async () => {
      const [routes, alerts, follows] = await Promise.all([
        listRoutes(user!.id),
        listAlerts().catch(() => []),
        listFollows(user!.id).catch(() => ({ watching: [], watched_by: [] })),
      ]);
      const live = [];
      for (const route of routes) {
        const trip = await listActiveTripForRoute(route.id);
        if (!trip || trip.status !== 'in_progress') continue;
        const [position, boardings] = await Promise.all([
          getLatestTripPosition(trip.id),
          listBoardings(trip.id).catch(() => []),
        ]);
        live.push({ route, trip, position, boardings });
      }
      const watched = follows.watching
        .filter((item) => item.status === 'accepted')
        .map((item) => ({ id: item.passenger_id, name: item.person?.name ?? 'Passageiro' }));
      return { live, alerts, watched };
    },
  });

  useEffect(() => {
    void AsyncStorage.getItem(SEEN_KEY).then((raw) => {
      if (!raw) return;
      try {
        seen.current = new Set(JSON.parse(raw) as string[]);
      } catch {
        seen.current = new Set();
      }
    });
  }, []);

  useEffect(() => {
    if (!query.data || !user) return;
    const fresh: { key: string; title: string; body: string }[] = [];
    for (const item of query.data.live) {
      const etaKey = `eta:${item.trip.id}`;
      if (
        item.position?.remaining_m != null &&
        item.position.remaining_m < 800 &&
        !seen.current.has(etaKey)
      ) {
        fresh.push({
          key: etaKey,
          title: 'A van está chegando',
          body: `${item.route.name}: ${formatEta(item.position.remaining_m, true)}`,
        });
      }
      const mine = item.boardings.find((boarding) => boarding.user_id === user.id);
      if (mine && !seen.current.has(`board:${item.trip.id}:${mine.status}`)) {
        fresh.push({
          key: `board:${item.trip.id}:${mine.status}`,
          title: mine.status === 'boarded' ? 'Embarque registrado' : 'Desembarque registrado',
          body: item.route.name,
        });
      }
      for (const person of query.data.watched) {
        const boarding = item.boardings.find((item) => item.user_id === person.id);
        if (!boarding) continue;
        const key = `watch:${item.trip.id}:${person.id}:${boarding.status}`;
        if (seen.current.has(key)) continue;
        fresh.push({
          key,
          title: boarding.status === 'boarded' ? `${person.name} embarcou` : `${person.name} desembarcou`,
          body: item.route.name,
        });
      }
    }
    for (const alert of query.data.alerts) {
      const key = `alert:${alert.id}`;
      if (seen.current.has(key)) continue;
      fresh.push({ key, title: 'Aviso do transportador', body: alert.message });
    }
    if (!fresh.length) return;
    for (const item of fresh) seen.current.add(item.key);
    void AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen.current].slice(-80)));
    for (const item of fresh) void deviceNotice(item.title, item.body);
  }, [query.data, user]);

  return null;
}
