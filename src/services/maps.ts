/**
 * Adapter de mapa. Interface, NÃO Google.
 * Depois: Google Maps SDK + Directions (PROVIDER_GOOGLE + Directions/Geocoding).
 * Não ler GOOGLE_MAPS_API_KEY neste MVP. Não setar PROVIDER_GOOGLE.
 */
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

/** Mock: devolve lat/lng fixos próximos a Goiânia, com offset pelo texto. */
export async function geocodeAddress(query: string): Promise<{
  lat: number;
  lng: number;
}> {
  let hash = 0;
  for (let i = 0; i < query.length; i += 1) {
    hash = (hash + query.charCodeAt(i) * (i + 1)) % 1000;
  }
  return {
    lat: DEFAULT_REGION.latitude + (hash % 40) * 0.0008,
    lng: DEFAULT_REGION.longitude + (hash % 35) * 0.0009,
  };
}

/** Mock: liga os pontos em linha reta. Depois: Directions API. */
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
