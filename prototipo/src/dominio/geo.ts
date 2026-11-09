/** Geometría sobre una esfera (suficiente a escala urbana y provincial). */

const R = 6_371_008.8;
const rad = (g: number) => (g * Math.PI) / 180;

export interface LatLon {
  lat: number;
  lon: number;
}

/** Distancia en metros entre dos puntos (fórmula del haversine). */
export function distanciaMetros(a: LatLon, b: LatLon): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Interpolación lineal entre dos puntos (válida en tramos cortos). */
export function interpolar(a: LatLon, b: LatLon, t: number): LatLon {
  return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
}

/**
 * Proyección de un punto sobre el segmento a–b en un plano local
 * equirectangular. Devuelve el punto más cercano, el parámetro t ∈ [0, 1] y
 * la distancia en metros.
 */
export function proyectarSobreSegmento(
  p: LatLon,
  a: LatLon,
  b: LatLon,
): { punto: LatLon; t: number; distancia: number } {
  const k = Math.cos(rad((a.lat + b.lat) / 2));
  const ax = a.lon * k;
  const bx = b.lon * k;
  const px = p.lon * k;
  const dx = bx - ax;
  const dy = b.lat - a.lat;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (p.lat - a.lat) * dy) / l2));
  const punto = interpolar(a, b, t);
  return { punto, t, distancia: distanciaMetros(p, punto) };
}
