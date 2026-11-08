import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { href } from '@/src/lib/href';

/** Só aceita caminhos internos do app vindos do push (ex.: /trip/<id>). */
function safePath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^\/trip\/[A-Za-z0-9-]+$/.test(value) ? value : null;
}

/**
 * Ao tocar numa notificação push, abre a viagem correspondente.
 * Cobre o app aberto e o app iniciado a partir da notificação.
 */
export function NotificationObserver() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let remove: (() => void) | undefined;
    let cancelled = false;

    void import('expo-notifications').then((Notifications) => {
      if (cancelled) return;
      const open = (response: { notification: { request: { content: { data?: Record<string, unknown> } } } } | null) => {
        const path = safePath(response?.notification.request.content.data?.url);
        if (!path) return;
        router.push(href(path));
        void Notifications.clearLastNotificationResponseAsync();
      };
      open(Notifications.getLastNotificationResponse());
      const sub = Notifications.addNotificationResponseReceivedListener(open);
      remove = () => sub.remove();
    });

    return () => {
      cancelled = true;
      remove?.();
    };
  }, [router]);

  return null;
}
