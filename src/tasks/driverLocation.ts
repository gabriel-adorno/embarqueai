import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { getApiUrl } from '@/src/lib/config';
import { publishDriverPosition } from '@/src/services/trips';

export const DRIVER_LOCATION_TASK = 'embarqueai-driver-location';
const BG_KEY = '@embarqueai/driver-bg';

type BgJob = {
  routeId: string;
  token: string | null;
  apiUrl: string;
};

if (Platform.OS !== 'web') {
  TaskManager.defineTask(DRIVER_LOCATION_TASK, async ({ data, error }) => {
    if (error) return;
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations;
    const latest = locations?.[locations.length - 1];
    if (!latest) return;
    const raw = await AsyncStorage.getItem(BG_KEY);
    if (!raw) return;
    const job = JSON.parse(raw) as BgJob;
    const { latitude, longitude } = latest.coords;
    if (job.apiUrl && job.token) {
      await fetch(`${job.apiUrl}/trips/active?route_id=${job.routeId}`, {
        headers: { Authorization: `Bearer ${job.token}` },
      })
        .then(async (res) => {
          if (!res.ok) return null;
          return (await res.json()) as { id?: string } | null;
        })
        .then(async (trip) => {
          if (!trip?.id) return;
          await fetch(`${job.apiUrl}/trips/${trip.id}/position`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${job.token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ lat: latitude, lng: longitude }),
          });
        })
        .catch(() => undefined);
      return;
    }
    await publishDriverPosition(job.routeId, latitude, longitude).catch(() => undefined);
  });
}

export async function startDriverBackground(routeId: string, token: string | null): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const foreground = await Location.requestForegroundPermissionsAsync();
  if (foreground.status !== Location.PermissionStatus.GRANTED) return false;
  const background = await Location.requestBackgroundPermissionsAsync();
  if (background.status !== Location.PermissionStatus.GRANTED) return false;

  await AsyncStorage.setItem(
    BG_KEY,
    JSON.stringify({ routeId, token, apiUrl: getApiUrl() } satisfies BgJob),
  );
  const running = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK);
  if (!running) {
    await Location.startLocationUpdatesAsync(DRIVER_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 8000,
      distanceInterval: 25,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'EmbarqueAI',
        notificationBody: 'Enviando a localização do trajeto.',
      },
    });
  }
  return true;
}

export async function stopDriverBackground(): Promise<void> {
  await AsyncStorage.removeItem(BG_KEY);
  if (Platform.OS === 'web') return;
  const running = await Location.hasStartedLocationUpdatesAsync(DRIVER_LOCATION_TASK).catch(
    () => false,
  );
  if (running) await Location.stopLocationUpdatesAsync(DRIVER_LOCATION_TASK);
}
