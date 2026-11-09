/**
 * Lugar del reclamo vecinal (CU08, RF15): de un punto marcado en el mapa a un
 * nombre que el vecino reconoce ("Av. Colón al 5300"), y de una calle y altura
 * escritas al punto, con el servicio de normalización simulado.
 *
 * Funciones puras, sin React. El nomenclador es sintético (`src/datos/calles.json`).
 */
import calles from '../../datos/calles.json';
import { distanciaMetros, proyectarSobreSegmento, type LatLon } from '../../dominio/geo';
import { CALLES_NOMENCLADOR, buscarCalle, servicioNormalizacionSimulado } from '../../dominio/normalizacion';
import { enPlanoCiudad } from '../../dominio/proyeccion';

/** Un punto a más de esta distancia de toda calle del nomenclador no se nombra por calle. */
export const DISTANCIA_MAX_CALLE = 120;

/** Largo mínimo de la descripción del problema. */
export const DESCRIPCION_MIN = 20;
export const DESCRIPCION_MAX = 500;

export interface LugarReclamo extends LatLon {
  /** "Av. Colón al 5300", o "Punto marcado en el mapa" si no hay calle cerca. */
  lugar: string;
  /** Barrio: el de la calle en el nomenclador (como en la semilla) o el más cercano al punto. */
  ambito: string;
  /** Calle del nomenclador, si el punto cae sobre una. */
  calle?: string;
}

const BARRIOS = calles.barrios;

function barrioMasCercano(p: LatLon): string {
  let mejor = BARRIOS[0]!;
  let d = Infinity;
  for (const b of BARRIOS) {
    const db = distanciaMetros(p, b);
    if (db < d) {
      d = db;
      mejor = b;
    }
  }
  return mejor.nombre;
}

/** Cuadra a la que pertenece una altura: 5347 → 5300. */
export function cuadra(altura: number): number {
  return Math.max(0, Math.floor(altura / 100) * 100);
}

/** Nombra un punto marcado en el mapa por la calle más cercana y su cuadra. */
export function describirPunto(p: LatLon): LugarReclamo {
  let mejor: { nombre: string; barrio: string | null; altura: number | null; distancia: number } | null = null;
  for (const c of CALLES_NOMENCLADOR) {
    for (let i = 0; i + 1 < c.tramos.length; i++) {
      const [h0, la0, lo0] = c.tramos[i]!;
      const [h1, la1, lo1] = c.tramos[i + 1]!;
      const pr = proyectarSobreSegmento(p, { lat: la0, lon: lo0 }, { lat: la1, lon: lo1 });
      if (!mejor || pr.distancia < mejor.distancia) {
        mejor = { nombre: c.nombre, barrio: c.barrio, altura: c.corredor ? null : h0 + pr.t * (h1 - h0), distancia: pr.distancia };
      }
    }
  }
  const posicion = { lat: redondear(p.lat), lon: redondear(p.lon) };
  if (mejor && mejor.distancia <= DISTANCIA_MAX_CALLE) {
    const lugar = mejor.altura === null ? mejor.nombre : `${mejor.nombre} al ${cuadra(mejor.altura)}`;
    return { ...posicion, lugar, ambito: mejor.barrio ?? barrioMasCercano(p), calle: mejor.nombre };
  }
  return { ...posicion, lugar: 'Punto marcado en el mapa', ambito: barrioMasCercano(p) };
}

export type ResultadoDireccion =
  | { ok: true; lugar: LugarReclamo; nomenclatura: string }
  | { ok: false; campo: 'calle' | 'altura'; error: string };

/** Ubica una calle y altura escritas por el vecino con el servicio de normalización simulado (RF05). */
export function ubicarDireccion(calleEscrita: string, alturaEscrita: string): ResultadoDireccion {
  const nombre = calleEscrita.trim();
  if (!nombre) return { ok: false, campo: 'calle', error: 'Escribí el nombre de la calle.' };
  const calle = buscarCalle(nombre);
  if (!calle) {
    return { ok: false, campo: 'calle', error: `No encontramos «${nombre}» en el nomenclador de la ciudad. Elegí una calle de la lista o marcá el lugar en el mapa.` };
  }
  const textoAltura = alturaEscrita.trim();
  if (calle.corredor) {
    const r = servicioNormalizacionSimulado.normalizar({ calle: calle.nombre });
    if (!r) return { ok: false, campo: 'calle', error: 'No pudimos ubicar esa calle. Marcá el lugar en el mapa.' };
    return { ok: true, nomenclatura: r.nomenclatura, lugar: { ...describirPunto(r), lugar: calle.nombre, calle: calle.nombre } };
  }
  if (!/^\d{1,5}$/.test(textoAltura)) return { ok: false, campo: 'altura', error: 'Escribí la altura en números, por ejemplo 5300.' };
  const altura = Number(textoAltura);
  const r = servicioNormalizacionSimulado.normalizar({ calle: calle.nombre, altura });
  if (!r) {
    const desde = calle.tramos[0]![0];
    const hasta = calle.tramos[calle.tramos.length - 1]![0];
    return { ok: false, campo: 'altura', error: `${calle.nombre} va del ${desde} al ${hasta} en el nomenclador. Revisá la altura o marcá el lugar en el mapa.` };
  }
  const p = describirPunto(r);
  return { ok: true, nomenclatura: r.nomenclatura, lugar: { ...p, lugar: `${calle.nombre} al ${cuadra(altura)}`, calle: calle.nombre } };
}

/** El punto cae dentro del plano de la ciudad de Córdoba. */
export function dentroDeLaCiudad(p: LatLon): boolean {
  return enPlanoCiudad(p);
}

export function validarLugar(lugar: LugarReclamo | null): string | undefined {
  if (!lugar) return 'Marcá el lugar en el mapa o escribí la calle y la altura.';
  if (!dentroDeLaCiudad(lugar)) return 'El lugar tiene que estar dentro de la ciudad de Córdoba.';
  return undefined;
}

export function validarDescripcion(texto: string): string | undefined {
  const t = texto.trim();
  if (!t) return 'Contá qué pasa en el lugar.';
  if (t.length < DESCRIPCION_MIN) return `Contalo con un poco más de detalle: al menos ${DESCRIPCION_MIN} caracteres (llevás ${t.length}).`;
  if (t.length > DESCRIPCION_MAX) return `La descripción admite hasta ${DESCRIPCION_MAX} caracteres.`;
  return undefined;
}

function redondear(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}
