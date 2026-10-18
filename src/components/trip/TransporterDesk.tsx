import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { todayInSaoPaulo } from '@/src/lib/day';
import { deviceNotice } from '@/src/lib/deviceNotice';
import { listAbsences, listGroupMembers, listGroupsForTransporter } from '@/src/services/groups';
import { listRoutes } from '@/src/services/routes';
import { listActiveTripForRoute, listTripHistory } from '@/src/services/trips';
import { useSessionStore } from '@/src/store/session';
import type { TripLeg } from '@/src/types/database';

const SEEN_KEY = '@embarqueai/seen-desk';

/** Avisa ausência do dia e lembra o horário de ida e volta. */
export function TransporterDesk() {
  const user = useSessionStore((s) => s.session?.user);
  const enabled = user?.user_metadata.role === 'transporter';
  const seen = useRef<Set<string>>(new Set());

  const query = useQuery({
    queryKey: ['transporter-desk', user?.id],
    enabled: Boolean(user) && enabled,
    refetchInterval: 30_000,
    queryFn: async () => {
      const [groups, routes, history] = await Promise.all([
        listGroupsForTransporter(user!.id),
        listRoutes(user!.id),
        listTripHistory().catch(() => []),
      ]);
      const absences = [];
      for (const group of groups) {
        const [today, members] = await Promise.all([
          listAbsences(group.id).catch(() => []),
          listGroupMembers(group.id).catch(() => []),
        ]);
        for (const absence of today) {
          const name =
            members.find((member) => member.user_id === absence.user_id)?.profile.name ??
            'Passageiro';
          absences.push({ id: absence.id, name, group: group.name });
        }
      }
      const live = [];
      for (const route of routes) {
        const trip = await listActiveTripForRoute(route.id);
        live.push({ route, trip });
      }
      return { absences, live, history };
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
    if (!query.data) return;
    const fresh: { key: string; title: string; body: string }[] = [];
    for (const absence of query.data.absences) {
      const key = `absent:${absence.id}`;
      if (seen.current.has(key)) continue;
      fresh.push({
        key,
        title: `${absence.name} não vai hoje`,
        body: absence.group,
      });
    }
    const now = minutesInSaoPaulo();
    const today = todayInSaoPaulo();
    for (const item of query.data.live) {
      remind(item.route, 'outbound', item.route.outbound_time, item.trip?.leg, now, today, query.data.history, fresh);
      remind(item.route, 'return', item.route.return_time, item.trip?.status === 'in_progress' ? item.trip.leg : null, now, today, query.data.history, fresh);
    }
    const pending = fresh.filter((item) => item.title && !seen.current.has(item.key));
    if (!pending.length) return;
    for (const item of pending) seen.current.add(item.key);
    void AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...seen.current].slice(-120)));
    for (const item of pending) void deviceNotice(item.title, item.body);
  }, [query.data]);

  return null;
}

function remind(
  route: { id: string; name: string },
  leg: TripLeg,
  time: string | null | undefined,
  liveLeg: TripLeg | null | undefined,
  now: number,
  today: string,
  history: { route_id: string; leg?: TripLeg | null; started_at: string }[],
  fresh: { key: string; title: string; body: string }[],
) {
  const scheduled = parseClock(time);
  if (scheduled == null) return;
  const delta = now - scheduled;
  if (delta < 0 || delta > 15) return;
  if (liveLeg === leg) return;
  const already = history.some(
    (trip) =>
      trip.route_id === route.id &&
      trip.leg === leg &&
      dayInSaoPaulo(trip.started_at) === today,
  );
  if (already) return;
  const key = `remind:${route.id}:${leg}:${today}`;
  fresh.push({
    key,
    title: leg === 'return' ? 'Hora da volta' : 'Hora da ida',
    body: `${route.name} · ${time}`,
  });
}

function parseClock(value: string | null | undefined) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

function minutesInSaoPaulo() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function dayInSaoPaulo(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(iso));
}
