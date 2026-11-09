/**
 * Capa de postes kilométricos (RF06). Simulada: un poste por kilómetro entre
 * las progresivas de anclaje de cada ruta, ajustado a la traza dibujada
 * (ver `scripts/extraer-cartografia.mjs`). Una progresiva con decimales se
 * interpola entre los dos postes que la rodean.
 *
 * Esta capa es la única fuente de coordenadas sobre ruta: el servicio de
 * normalización nunca se consulta para una progresiva, porque devuelve
 * coordenadas erróneas sin señal de error (ensayo descrito en la propuesta).
 */
import postesJson from '../datos/postes.json';
import { interpolar, proyectarSobreSegmento, type LatLon } from './geo';

type Poste = [km: number, lat: number, lon: number];
interface CapaRuta {
  desde: number;
  hasta: number;
  postes: Poste[];
}

const CAPA = postesJson as unknown as Record<string, CapaRuta>;

/** Rutas con postes cargados, en el orden del archivo. */
export const RUTAS_CON_POSTES: readonly string[] = Object.keys(CAPA);

/** Normaliza "rn 9", "RN9", "Ruta Nacional 9" → "RN 9". */
export function normalizarRuta(ruta: string): string {
  const m = /(?:r\s*([np])|ruta\s+(nacional|provincial))?\s*(?:n[°º.]?\s*)?(\d+)/i.exec(ruta.trim());
  if (!m) return ruta.trim().toUpperCase();
  const tipo = (m[1] ?? m[2] ?? 'n').toLowerCase().startsWith('p') ? 'RP' : 'RN';
  return `${tipo} ${Number(m[3])}`;
}

export function coberturaPostes(ruta: string): { desde: number; hasta: number } | null {
  const capa = CAPA[normalizarRuta(ruta)];
  return capa ? { desde: capa.desde, hasta: capa.hasta } : null;
}

function poste(capa: CapaRuta, km: number): LatLon | null {
  const i = km - capa.desde;
  const p = capa.postes[i];
  return p && p[0] === km ? { lat: p[1], lon: p[2] } : null;
}

/**
 * Coordenada de una progresiva, interpolada entre los postes que la rodean.
 * Devuelve `null` si la ruta o la progresiva no figuran en la capa (CU02 2.b).
 */
export function posicionPorProgresiva(ruta: string, km: number): LatLon | null {
  const capa = CAPA[normalizarRuta(ruta)];
  if (!capa || !Number.isFinite(km) || km < capa.desde || km > capa.hasta) return null;
  const k0 = Math.floor(km);
  const a = poste(capa, k0);
  if (!a) return null;
  if (k0 === km || k0 === capa.hasta) return a;
  const b = poste(capa, k0 + 1);
  return b ? interpolar(a, b, km - k0) : a;
}

/** Poste más cercano a un punto sobre una ruta dada (para corregir a mano sobre ruta). */
export function progresivaMasCercana(ruta: string, p: LatLon): { km: number; distancia: number; punto: LatLon } | null {
  const capa = CAPA[normalizarRuta(ruta)];
  if (!capa) return null;
  let mejor: { km: number; distancia: number; punto: LatLon } | null = null;
  for (let i = 0; i + 1 < capa.postes.length; i++) {
    const [ka, la, oa] = capa.postes[i]!;
    const [, lb, ob] = capa.postes[i + 1]!;
    const pr = proyectarSobreSegmento(p, { lat: la, lon: oa }, { lat: lb, lon: ob });
    if (!mejor || pr.distancia < mejor.distancia) {
      mejor = { km: Math.round((ka + pr.t) * 10) / 10, distancia: pr.distancia, punto: pr.punto };
    }
  }
  return mejor;
}

/** Ruta y progresiva más cercanas a un punto, entre todas las rutas cargadas. */
export function rutaMasCercana(p: LatLon): { ruta: string; km: number; distancia: number } | null {
  let mejor: { ruta: string; km: number; distancia: number } | null = null;
  for (const ruta of RUTAS_CON_POSTES) {
    const r = progresivaMasCercana(ruta, p);
    if (r && (!mejor || r.distancia < mejor.distancia)) mejor = { ruta, km: r.km, distancia: r.distancia };
  }
  return mejor;
}

/** Puntos de la traza entre dos progresivas (para dibujar un tramo). */
export function trazaTramo(ruta: string, desde: number, hasta: number): LatLon[] {
  const out: LatLon[] = [];
  const a = posicionPorProgresiva(ruta, desde);
  if (a) out.push(a);
  for (let k = Math.floor(desde) + 1; k < hasta; k++) {
    const p = posicionPorProgresiva(ruta, k);
    if (p) out.push(p);
  }
  const b = posicionPorProgresiva(ruta, hasta);
  if (b) out.push(b);
  return out;
}

/** Largo cubierto por la capa de una ruta, en km (para la tasa media del ámbito). */
export function largoCubierto(ruta: string): number {
  const c = coberturaPostes(ruta);
  return c ? c.hasta - c.desde : 0;
}
