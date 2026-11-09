/**
 * Servicio estatal de normalización de datos geográficos, SIMULADO (RF05).
 *
 * En el sistema real es un servicio externo (CU02, actor secundario). En la
 * demo lo reemplaza un nomenclador local de la ciudad de Córdoba
 * (`src/datos/calles.json`): cada calle es una poligonal con alturas de
 * referencia y la altura pedida se interpola entre ellas. Datos sintéticos.
 *
 * El servicio sólo resuelve calles, intersecciones y barrios. No sabe nada de
 * rutas: quien consulte con una progresiva recibe `null` (y la regla RF06 es
 * no consultarlo nunca para rutas; ver `georreferenciacion.ts`).
 */
import calles from '../datos/calles.json';
import { distanciaMetros, interpolar, proyectarSobreSegmento, type LatLon } from './geo';
import { claveCalle, normalizar } from './texto';

export interface ConsultaNormalizacion {
  calle?: string;
  altura?: number;
  calle2?: string;
  barrio?: string;
}

export type CalidadNormalizacion =
  | 'altura'
  | 'altura-extrapolada'
  | 'interseccion'
  | 'corredor'
  | 'calle'
  | 'barrio';

export interface RespuestaNormalizacion extends LatLon {
  /** Nomenclatura oficial, como la devolvería el servicio. */
  nomenclatura: string;
  calidad: CalidadNormalizacion;
  barrio?: string;
}

export interface ServicioNormalizacion {
  normalizar(consulta: ConsultaNormalizacion): RespuestaNormalizacion | null;
}

export interface CalleNomenclador {
  nombre: string;
  barrio: string | null;
  corredor?: boolean;
  tramos: [number, number, number][];
}

export const CALLES_NOMENCLADOR = calles.calles as unknown as readonly CalleNomenclador[];
const CALLES = CALLES_NOMENCLADOR;
const BARRIOS = calles.barrios;

/** Tolerancia para extrapolar una altura fuera del rango conocido. */
const EXTRAPOLACION_MAX = 400;

export function buscarCalle(nombre: string): CalleNomenclador | null {
  const k = claveCalle(nombre);
  if (!k) return null;
  const exacta = CALLES.find((c) => claveCalle(c.nombre) === k);
  if (exacta) return exacta;
  // "Sabattini" encuentra "Av. Amadeo Sabattini"; "Vélez Sársfield" se tolera con o sin tilde.
  const conPalabras = CALLES.filter((c) => {
    const kc = claveCalle(c.nombre);
    return ` ${kc} `.includes(` ${k} `) || ` ${k} `.includes(` ${kc} `);
  });
  return conPalabras.length === 1 ? conPalabras[0]! : null;
}

export function buscarBarrio(nombre: string): { nombre: string; lat: number; lon: number } | null {
  const k = normalizar(nombre).trim();
  return BARRIOS.find((b) => normalizar(b.nombre) === k) ?? null;
}

function puntos(c: CalleNomenclador): LatLon[] {
  return c.tramos.map(([, lat, lon]) => ({ lat, lon }));
}

/** Posición de una altura sobre la calle, interpolada; null si la calle no tiene alturas. */
export function posicionPorAltura(c: CalleNomenclador, altura: number): { punto: LatLon; extrapolada: boolean } | null {
  if (c.corredor) return null;
  const t = c.tramos;
  const primero = t[0]!;
  const ultimo = t[t.length - 1]!;
  if (altura < primero[0] - EXTRAPOLACION_MAX || altura > ultimo[0] + EXTRAPOLACION_MAX) return null;
  const extrapolada = altura < primero[0] || altura > ultimo[0];
  const h = Math.min(Math.max(altura, primero[0]), ultimo[0]);
  for (let i = 0; i + 1 < t.length; i++) {
    const [h0, la0, lo0] = t[i]!;
    const [h1, la1, lo1] = t[i + 1]!;
    if (h >= h0 && h <= h1) {
      const f = h1 === h0 ? 0 : (h - h0) / (h1 - h0);
      return { punto: interpolar({ lat: la0, lon: lo0 }, { lat: la1, lon: lo1 }, f), extrapolada };
    }
  }
  return null;
}

/** Punto de la calle más cercano a otro punto. */
function proyectarEnCalle(c: CalleNomenclador, p: LatLon): { punto: LatLon; distancia: number } {
  const pts = puntos(c);
  let mejor = { punto: pts[0]!, distancia: Infinity };
  for (let i = 0; i + 1 < pts.length; i++) {
    const pr = proyectarSobreSegmento(p, pts[i]!, pts[i + 1]!);
    if (pr.distancia < mejor.distancia) mejor = { punto: pr.punto, distancia: pr.distancia };
  }
  return mejor;
}

/** Cruce de dos calles: el par de puntos más próximos de sus poligonales. */
export function cruce(a: CalleNomenclador, b: CalleNomenclador): { punto: LatLon; distancia: number } {
  const pa = puntos(a);
  let mejor = { punto: pa[0]!, distancia: Infinity };
  for (let i = 0; i + 1 < pa.length; i++) {
    const largo = distanciaMetros(pa[i]!, pa[i + 1]!);
    const pasos = Math.max(1, Math.ceil(largo / 20));
    for (let s = 0; s <= pasos; s++) {
      const q = interpolar(pa[i]!, pa[i + 1]!, s / pasos);
      const pr = proyectarEnCalle(b, q);
      if (pr.distancia < mejor.distancia) mejor = { punto: interpolar(q, pr.punto, 0.5), distancia: pr.distancia };
    }
  }
  return mejor;
}

/** Distancia máxima para aceptar que dos poligonales se cruzan. */
const TOLERANCIA_CRUCE = 150;

export const servicioNormalizacionSimulado: ServicioNormalizacion = {
  normalizar(consulta) {
    const calle = consulta.calle ? buscarCalle(consulta.calle) : null;

    if (calle && consulta.calle2) {
      const otra = buscarCalle(consulta.calle2);
      if (!otra) return null;
      const c = cruce(calle, otra);
      if (c.distancia > TOLERANCIA_CRUCE) return null;
      return { ...c.punto, nomenclatura: `${calle.nombre} y ${otra.nombre}`, calidad: 'interseccion' };
    }

    if (calle && consulta.altura !== undefined && !calle.corredor) {
      const pos = posicionPorAltura(calle, consulta.altura);
      if (!pos) return null;
      return {
        ...pos.punto,
        nomenclatura: `${calle.nombre} ${consulta.altura}, Córdoba`,
        calidad: pos.extrapolada ? 'altura-extrapolada' : 'altura',
        barrio: calle.barrio ?? undefined,
      };
    }

    if (calle) {
      const barrio = consulta.barrio ? buscarBarrio(consulta.barrio) : null;
      if (barrio) {
        const pr = proyectarEnCalle(calle, barrio);
        return { ...pr.punto, nomenclatura: `${calle.nombre} (a la altura de ${barrio.nombre})`, calidad: 'corredor', barrio: barrio.nombre };
      }
      const pts = puntos(calle);
      const medio = pts[Math.floor(pts.length / 2)]!;
      return { ...medio, nomenclatura: `${calle.nombre}, Córdoba`, calidad: 'calle' };
    }

    if (consulta.barrio) {
      const b = buscarBarrio(consulta.barrio);
      if (b) return { lat: b.lat, lon: b.lon, nomenclatura: `Barrio ${b.nombre}, Córdoba`, calidad: 'barrio', barrio: b.nombre };
    }
    return null;
  },
};

/** Nombres oficiales de las calles del nomenclador (para formularios y pruebas). */
export const NOMBRES_CALLES: readonly string[] = CALLES.map((c) => c.nombre);
export const NOMBRES_BARRIOS: readonly string[] = BARRIOS.map((b) => b.nombre);
