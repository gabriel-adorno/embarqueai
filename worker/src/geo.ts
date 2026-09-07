export type LatLng = { lat: number; lng: number };

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

export function pathLengthM(points: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += haversineM(points[i - 1], points[i]);
  }
  return total;
}

export function interpolatePath(
  points: LatLng[],
  progress: number,
): { point: LatLng; remainingM: number } {
  if (points.length === 0) {
    return { point: { lat: 0, lng: 0 }, remainingM: 0 };
  }
  if (points.length === 1) {
    return { point: points[0], remainingM: 0 };
  }
  const total = pathLengthM(points);
  const p = Math.min(1, Math.max(0, progress));
  const target = total * p;
  let walked = 0;
  for (let i = 1; i < points.length; i += 1) {
    const from = points[i - 1];
    const to = points[i];
    const seg = haversineM(from, to);
    if (walked + seg >= target) {
      const t = seg === 0 ? 0 : (target - walked) / seg;
      return {
        point: {
          lat: from.lat + (to.lat - from.lat) * t,
          lng: from.lng + (to.lng - from.lng) * t,
        },
        remainingM: Math.round(total * (1 - p)),
      };
    }
    walked += seg;
  }
  return { point: points[points.length - 1], remainingM: 0 };
}

/** Decode Google encoded polyline. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;
    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

export function mockGeocode(query: string): LatLng {
  let hash = 0;
  for (let i = 0; i < query.length; i += 1) {
    hash = (hash + query.charCodeAt(i) * (i + 1)) % 1000;
  }
  return {
    lat: -16.6869 + (hash % 40) * 0.0008,
    lng: -49.2648 + (hash % 35) * 0.0009,
  };
}
