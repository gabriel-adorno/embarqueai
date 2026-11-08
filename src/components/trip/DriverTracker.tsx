import { useQuery } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { ConfirmModal } from '@/src/components/ui/ConfirmModal';
import { listMyActiveTrip, publishDriverPosition } from '@/src/services/trips';
import { useSessionStore } from '@/src/store/session';
import { startDriverBackground, stopDriverBackground } from '@/src/tasks/driverLocation';

/** Envia o GPS do transportador enquanto o app está aberto e existe trajeto ao vivo. */
export function DriverTracker() {
  const role = useSessionStore((s) => s.session?.user.user_metadata.role);
  const enabled = role === 'transporter';

  const trip = useQuery({
    queryKey: ['driver-active-trip'],
    enabled,
    refetchInterval: 12_000,
    queryFn: listMyActiveTrip,
  });

  const routeId = trip.data?.status === 'in_progress' ? trip.data.route_id : null;

  // Aviso obrigatório (Google Play) antes de pedir a localização em segundo plano.
  const [disclosure, setDisclosure] = useState(false);
  const answer = useRef<((ok: boolean) => void) | null>(null);
  const askDisclosure = () =>
    new Promise<boolean>((resolve) => {
      answer.current = resolve;
      setDisclosure(true);
    });
  const reply = (ok: boolean) => {
    setDisclosure(false);
    answer.current?.(ok);
    answer.current = null;
  };

  useEffect(() => {
    if (!routeId) return;
    let sub: Location.LocationSubscription | null = null;
    let stopped = false;
    let lastSent = 0;

    void (async () => {
      try {
        if (Platform.OS !== 'web') {
          const current = await Location.getBackgroundPermissionsAsync();
          let allowed = current.status === Location.PermissionStatus.GRANTED;
          if (!allowed && current.canAskAgain) allowed = await askDisclosure();
          if (stopped) return;
          if (allowed) {
            const token = useSessionStore.getState().session?.access_token ?? null;
            const background = await startDriverBackground(routeId, token);
            if (background || stopped) return;
          }
        }
        const permission = await Location.requestForegroundPermissionsAsync();
        if (stopped || permission.status !== Location.PermissionStatus.GRANTED) return;
        sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 20,
            timeInterval: 5000,
          },
          (pos) => {
            const now = Date.now();
            if (now - lastSent < 4000) return;
            lastSent = now;
            void publishDriverPosition(routeId, pos.coords.latitude, pos.coords.longitude).catch(
              () => undefined,
            );
          },
        );
      } catch {
        /* sem GPS o mapa segue com a última posição conhecida */
      }
    })();

    return () => {
      stopped = true;
      sub?.remove();
      answer.current?.(false);
      answer.current = null;
      setDisclosure(false);
      void stopDriverBackground();
    };
  }, [routeId]);

  return (
    <ConfirmModal
      visible={disclosure}
      title="Localização durante o trajeto"
      body={
        'O EmbarqueAI coleta a localização deste aparelho enquanto um trajeto está ao vivo, ' +
        'inclusive com o app fechado ou a tela bloqueada, para mostrar a posição do veículo ' +
        'aos passageiros e responsáveis e avisar quando a van estiver chegando. ' +
        'A coleta para quando você encerra o trajeto.\n\n' +
        'Na próxima tela, escolha "Permitir o tempo todo".'
      }
      yesLabel="Continuar"
      noLabel="Agora não"
      onNo={() => reply(false)}
      onYes={() => reply(true)}
    />
  );
}
