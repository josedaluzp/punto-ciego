/**
 * Detección de crónicas que refieren a un siniestro ya registrado (RF03, CU01
 * pasos 4, 4.a y 4.b; curso 2.a para la dirección web repetida).
 *
 * Un siniestro es candidato cuando coinciden las tres condiciones:
 * 1. la fecha del hecho difiere en un día como máximo;
 * 2. el lugar extraído es equivalente (misma ruta a menos de un kilómetro,
 *    misma calle a menos de 200 de altura, misma intersección o mismo barrio);
 * 3. el texto es semejante: índice de Jaccard entre las palabras con
 *    contenido de la crónica nueva y las del siniestro ≥ 0,35.
 * Si se cumplen 1 y 2 pero no 3, la coincidencia es dudosa (4.b) y decide el
 * analista.
 */
import { diasEntre } from './fechas';
import { buscarCalle } from './normalizacion';
import { claveCalle, jaccard, normalizar } from './texto';
import type { Cronica, LugarExtraido, Siniestro } from './tipos';

export const UMBRAL_SIMILITUD = 0.35;
export const TOLERANCIA_DIAS = 1;
export const TOLERANCIA_KM = 1;
export const TOLERANCIA_ALTURA = 200;

export interface CandidatoDuplicado {
  siniestro: Siniestro;
  similitud: number;
  diasDiferencia: number;
  /** `seguro`: se vincula sola (4.a). `dudoso`: decide el analista (4.b). */
  nivel: 'seguro' | 'dudoso';
}

/** Clave de una calle: la del nombre oficial si el nomenclador la reconoce ("Sabattini" = "Av. Amadeo Sabattini"). */
function clave(calle: string): string {
  return claveCalle(buscarCalle(calle)?.nombre ?? calle);
}

/** ¿Describen los dos lugares el mismo sitio? */
export function lugaresEquivalentes(a: LugarExtraido | null, b: LugarExtraido | null): boolean {
  if (!a || !b) return false;
  if (a.ruta || b.ruta) {
    if (a.ruta !== b.ruta) return false;
    if (a.km === undefined || b.km === undefined) return true;
    return Math.abs(a.km - b.km) <= TOLERANCIA_KM;
  }
  const ca = a.calle ? clave(a.calle) : null;
  const cb = b.calle ? clave(b.calle) : null;
  if (a.calle2 || b.calle2) {
    const sa = new Set([ca, a.calle2 ? clave(a.calle2) : null]);
    const sb = [cb, b.calle2 ? clave(b.calle2) : null];
    // Misma intersección, o la cuadra de una calle que forma la intersección.
    return sb.filter((c) => c && sa.has(c)).length >= (a.calle2 && b.calle2 ? 2 : 1);
  }
  if (ca && cb) {
    if (ca !== cb) return false;
    if (a.altura === undefined || b.altura === undefined) return true;
    return Math.abs(a.altura - b.altura) <= TOLERANCIA_ALTURA;
  }
  if (a.barrio && b.barrio) return normalizar(a.barrio) === normalizar(b.barrio);
  return false;
}

/** Curso 2.a: la dirección web ya fue incorporada. */
export function cronicaPorUrl(url: string, cronicas: readonly Cronica[]): Cronica | null {
  const k = url.trim().replace(/\/+$/, '').toLowerCase();
  return cronicas.find((c) => c.url.trim().replace(/\/+$/, '').toLowerCase() === k) ?? null;
}

/**
 * RF03: busca un siniestro registrado al que corresponda la crónica nueva.
 * Devuelve el mejor candidato o `null` si no hay ninguno.
 */
export function buscarDuplicado(
  extraido: { fechaHecho: string; lugar: LugarExtraido | null },
  texto: string,
  siniestros: readonly Siniestro[],
  cronicas: readonly Cronica[],
): CandidatoDuplicado | null {
  const textosPorSiniestro = new Map<string, string[]>();
  for (const c of cronicas) {
    const l = textosPorSiniestro.get(c.siniestroId) ?? [];
    l.push(c.texto);
    textosPorSiniestro.set(c.siniestroId, l);
  }
  let mejor: CandidatoDuplicado | null = null;
  for (const s of siniestros) {
    const dd = Math.abs(diasEntre(extraido.fechaHecho, s.fechaHecho));
    if (dd > TOLERANCIA_DIAS) continue;
    if (!lugaresEquivalentes(extraido.lugar, s.lugarExtraido)) continue;
    const similitud = Math.max(0, ...(textosPorSiniestro.get(s.id) ?? []).map((t) => jaccard(texto, t)));
    const cand: CandidatoDuplicado = {
      siniestro: s,
      similitud,
      diasDiferencia: dd,
      nivel: similitud >= UMBRAL_SIMILITUD ? 'seguro' : 'dudoso',
    };
    if (!mejor || cand.similitud > mejor.similitud) mejor = cand;
  }
  return mejor;
}
