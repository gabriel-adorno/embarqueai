export type LatLng = { lat: number; lng: number };

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Distância que falta até uma parada, em metros. */
export function remainingUntil(poly: LatLng[], current: LatLng, stop: LatLng): number {
  return Math.max(0, remainingAlong(poly, current) - remainingAlong(poly, stop));
}

/** Distância que falta do ponto atual até o fim do trajeto, em metros. */
export function remainingAlong(poly: LatLng[], point: LatLng): number {
  if (poly.length === 0) return 0;
  if (poly.length === 1) return Math.round(haversineM(poly[0], point));

  let bestDist = Infinity;
  let bestRemaining = 0;
  let walked = 0;
  let total = 0;
  for (let i = 1; i < poly.length; i += 1) {
    total += haversineM(poly[i - 1], poly[i]);
  }

  for (let i = 1; i < poly.length; i += 1) {
    const a = poly[i - 1];
    const b = poly[i];
    const seg = haversineM(a, b);
    const t = seg === 0 ? 0 : clamp(projectT(a, b, point), 0, 1);
    const proj = {
      lat: a.lat + (b.lat - a.lat) * t,
      lng: a.lng + (b.lng - a.lng) * t,
    };
    const dist = haversineM(proj, point);
    if (dist < bestDist) {
      bestDist = dist;
      bestRemaining = total - (walked + seg * t);
    }
    walked += seg;
  }

  return Math.max(0, Math.round(bestRemaining));
}

function projectT(a: LatLng, b: LatLng, p: LatLng): number {
  const cos = Math.cos(toRad((a.lat + b.lat) / 2));
  const bx = (b.lng - a.lng) * cos;
  const by = b.lat - a.lat;
  const px = (p.lng - a.lng) * cos;
  const py = p.lat - a.lat;
  const den = bx * bx + by * by;
  if (den === 0) return 0;
  return (px * bx + py * by) / den;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}
