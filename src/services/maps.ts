/**
 * Adapter de mapa. Geocoding/Directions no Worker quando EXPO_PUBLIC_API_URL está setado.
 */
import { isRemote } from '@/src/lib/config';
import * as remote from '@/src/services/remote';
import type { MapMarker, MapPolyline, MapRegion } from '@/src/types/database';

export const DEFAULT_REGION: MapRegion = {
  latitude: -16.6869,
  longitude: -49.2648,
  latitudeDelta: 0.06,
  longitudeDelta: 0.06,
};

export type RenderMapInput = {
  markers: MapMarker[];
  polyline?: MapPolyline;
  initialRegion: MapRegion;
};

export function renderMap(input: RenderMapInput): RenderMapInput {
  return input;
}

export async function geocodeAddress(query: string): Promise<{
  lat: number;
  lng: number;
}> {
  if (isRemote()) return remote.geocodeAddress(query);
  let hash = 0;
  for (let i = 0; i < query.length; i += 1) {
    hash = (hash + query.charCodeAt(i) * (i + 1)) % 1000;
  }
  return {
    lat: DEFAULT_REGION.latitude + (hash % 40) * 0.0008,
    lng: DEFAULT_REGION.longitude + (hash % 35) * 0.0009,
  };
}

export function buildRoutePolyline(
  points: { lat: number; lng: number }[],
): MapPolyline {
  return {
    coordinates: points.map((p) => ({
      latitude: p.lat,
      longitude: p.lng,
    })),
  };
}

export async function getRoutePolyline(
  points: { lat: number; lng: number }[] | null | undefined,
): Promise<MapPolyline & { distance_m?: number }> {
  const list = points ?? [];
  if (isRemote() && list.length >= 2) {
    const dir = await remote.getDirectionsPolyline(list);
    const coordinates = dir?.coordinates;
    if (coordinates?.length) {
      return { coordinates, distance_m: dir.distance_m };
    }
  }
  return buildRoutePolyline(list);
}

export function regionFromPoints(
  points: { lat: number; lng: number }[],
): MapRegion {
  if (points.length === 0) return DEFAULT_REGION;
  const lats = points.map((p) => p.lat);
  const lngs = points.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max(0.04, (maxLat - minLat) * 1.8),
    longitudeDelta: Math.max(0.04, (maxLng - minLng) * 1.8),
  };
}

export function formatRemainingKm(remainingM: number | null | undefined, inProgress: boolean) {
  if (!inProgress) return '0 km';
  if (remainingM == null) return '—';
  const km = remainingM / 1000;
  return `${km.toFixed(1).replace('.', ',')} km`;
}
