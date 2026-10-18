import { Platform } from 'react-native';
import * as Location from 'expo-location';

import type { MapRegion } from '@/src/types/database';

const STREET_DELTA = 0.01;

export type LocationStatus = 'granted' | 'denied' | 'unavailable';

export type UserLocationResult =
  | { status: 'granted'; region: MapRegion }
  | { status: Exclude<LocationStatus, 'granted'> };

export function regionFromCoords(latitude: number, longitude: number): MapRegion {
  return {
    latitude,
    longitude,
    latitudeDelta: STREET_DELTA,
    longitudeDelta: STREET_DELTA,
  };
}

function browserGeolocation(): Geolocation | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  return window.navigator?.geolocation;
}

function requestBrowserRegion(): Promise<UserLocationResult> {
  const geo = browserGeolocation();
  if (!geo) return Promise.resolve({ status: 'unavailable' });

  return new Promise((resolve) => {
    geo.getCurrentPosition(
      (pos) => {
        resolve({
          status: 'granted',
          region: regionFromCoords(pos.coords.latitude, pos.coords.longitude),
        });
      },
      (error) => {
        resolve({ status: error.code === 1 ? 'denied' : 'unavailable' });
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  });
}

export async function requestUserRegion(): Promise<UserLocationResult> {
  try {
    if (Platform.OS === 'web') {
      return await requestBrowserRegion();
    }

    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== Location.PermissionStatus.GRANTED) {
      return { status: 'denied' };
    }

    const current = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      status: 'granted',
      region: regionFromCoords(current.coords.latitude, current.coords.longitude),
    };
  } catch {
    return { status: 'unavailable' };
  }
}
