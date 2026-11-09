/**
 * CU04: diferencias entre dos cálculos de concentraciones. Se comparan por la
 * clave estable de cada concentración (no por su número), así que un lugar
 * que cambia de puesto sigue siendo el mismo lugar.
 */
import { nombreConcentracion } from '../../dominio/concentraciones';
import type { Concentracion } from '../../dominio/tipos';

export interface LugarCalculado {
  clave: string;
  id: string;
  nombre: string;
  indice: number;
  rango: number;
}

export interface CambioIndice {
  lugar: LugarCalculado;
  antes: number;
  /** Puesto anterior. */
  rangoAntes: number;
}

export interface Diferencias {
  nuevas: LugarCalculado[];
  /** Dejaron de ser significativas. */
  retiradas: LugarCalculado[];
  /** Cambió el índice (al centésimo, como se muestra). */
  cambiaron: CambioIndice[];
  /** Mismo índice, otro puesto. */
  reordenadas: number;
}

export function resumir(cs: readonly Concentracion[]): LugarCalculado[] {
  return cs.map((c, i) => ({
    clave: c.clave,
    id: c.id,
    nombre: nombreConcentracion(c),
    indice: c.indice,
    rango: i + 1,
  }));
}

const centesimos = (v: number) => Math.round(v * 100);

export function diferencias(antes: readonly LugarCalculado[], ahora: readonly LugarCalculado[]): Diferencias {
  const previo = new Map(antes.map((l) => [l.clave, l]));
  const actual = new Set(ahora.map((l) => l.clave));
  const nuevas: LugarCalculado[] = [];
  const cambiaron: CambioIndice[] = [];
  let reordenadas = 0;
  for (const l of ahora) {
    const p = previo.get(l.clave);
    if (!p) nuevas.push(l);
    else if (centesimos(p.indice) !== centesimos(l.indice)) cambiaron.push({ lugar: l, antes: p.indice, rangoAntes: p.rango });
    else if (p.rango !== l.rango) reordenadas++;
  }
  const retiradas = antes.filter((l) => !actual.has(l.clave));
  return { nuevas, retiradas, cambiaron, reordenadas };
}

export function sinCambios(d: Diferencias): boolean {
  return d.nuevas.length === 0 && d.retiradas.length === 0 && d.cambiaron.length === 0 && d.reordenadas === 0;
}
