import { decodePolyline, mockGeocode, pathLengthM, type LatLng } from './geo';

type DirectionsOk = {
  coordinates: { latitude: number; longitude: number }[];
  points: LatLng[];
  distance_m: number;
};

export async function geocodeAddress(
  env: Env,
  query: string,
): Promise<LatLng> {
  const key = env.GOOGLE_MAPS_SERVER_KEY?.trim();
  if (!key) return mockGeocode(query);

  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  url.searchParams.set('address', query);
  url.searchParams.set('key', key);
  const res = await fetch(url);
  const data = (await res.json()) as {
    status: string;
    results?: { geometry: { location: { lat: number; lng: number } } }[];
  };
  const loc = data.results?.[0]?.geometry.location;
  if (data.status !== 'OK' || !loc) {
    return mockGeocode(query);
  }
  return { lat: loc.lat, lng: loc.lng };
}

export async function directions(env: Env, points: LatLng[]): Promise<DirectionsOk> {
  if (points.length < 2) {
    const coords = points.map((p) => ({ latitude: p.lat, longitude: p.lng }));
    return { coordinates: coords, points, distance_m: 0 };
  }

  const key = env.GOOGLE_MAPS_SERVER_KEY?.trim();
  if (key) {
    const origin = `${points[0].lat},${points[0].lng}`;
    const destination = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;
    const url = new URL('https://maps.googleapis.com/maps/api/directions/json');
    url.searchParams.set('origin', origin);
    url.searchParams.set('destination', destination);
    url.searchParams.set('key', key);
    if (points.length > 2) {
      url.searchParams.set(
        'waypoints',
        points
          .slice(1, -1)
          .map((p) => `${p.lat},${p.lng}`)
          .join('|'),
      );
    }
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      routes?: {
        overview_polyline?: { points: string };
        legs?: { distance?: { value: number } }[];
      }[];
    };
    const route = data.routes?.[0];
    if (data.status === 'OK' && route?.overview_polyline?.points) {
      const decoded = decodePolyline(route.overview_polyline.points);
      const distance_m =
        route.legs?.reduce((sum, leg) => sum + (leg.distance?.value ?? 0), 0) ??
        Math.round(pathLengthM(decoded));
      return {
        points: decoded,
        coordinates: decoded.map((p) => ({ latitude: p.lat, longitude: p.lng })),
        distance_m,
      };
    }
  }

  return {
    points,
    coordinates: points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
    distance_m: Math.round(pathLengthM(points)),
  };
}
