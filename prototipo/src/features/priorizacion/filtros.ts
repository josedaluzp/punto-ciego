/**
 * Filtros de los lugares priorizados (RF12, CU05 paso 3): ámbito, vía,
 * período y tipo de usuario vulnerable. El período se aplica antes de agrupar
 * (lo resuelve `useConcentraciones(periodo)`); el resto filtra la lista ya
 * ordenada por índice, así que cada lugar conserva su rango en la provincia.
 */
import type { Concentracion, Siniestro, TipoUsuario } from '../../dominio/tipos';

export type Ambito = 'todo' | 'rutas' | 'calles';
export type UsuarioVulnerable = 'todos' | Extract<TipoUsuario, 'peaton' | 'ciclista' | 'motociclista'>;

export interface Filtros {
  ambito: Ambito;
  /** "todas", o el nombre de una ruta ("RN 9") o de una calle ("Av. Colón"). */
  via: string;
  usuario: UsuarioVulnerable;
}

export const VIA_TODAS = 'todas';

export interface LugarPriorizado {
  c: Concentracion;
  /** Puesto en el orden por índice del período, antes de filtrar por ámbito, vía o usuario. */
  rango: number;
}

/** Nombre de la vía de una concentración: la ruta del tramo o la calle del punto. */
export function viaDe(c: Pick<Concentracion, 'ruta' | 'calle' | 'localidad'>): string {
  return c.ruta ?? c.calle ?? c.localidad;
}

function numeroRuta(via: string): number {
  const m = /^R[NP]\s*(\d+)/.exec(via);
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
}

/** Vías con alguna concentración en el ámbito: primero las rutas por número, después las calles. */
export function viasDisponibles(cs: readonly Concentracion[], ambito: Ambito): string[] {
  const vias = new Set<string>();
  for (const c of cs) {
    if (ambito === 'rutas' && c.unidad !== 'tramo') continue;
    if (ambito === 'calles' && c.unidad !== 'punto') continue;
    vias.add(viaDe(c));
  }
  return [...vias].sort((a, b) => numeroRuta(a) - numeroRuta(b) || a.localeCompare(b, 'es'));
}

function tieneUsuario(c: Concentracion, porId: ReadonlyMap<string, Siniestro>, tipo: TipoUsuario): boolean {
  return c.siniestroIds.some((id) => porId.get(id)?.victimas.some((v) => v.tipoUsuario === tipo));
}

/** Aplica ámbito, vía y usuario a la lista ordenada; conserva el rango original. */
export function filtrarLugares(cs: readonly Concentracion[], siniestros: readonly Siniestro[], f: Filtros): LugarPriorizado[] {
  const porId = new Map(siniestros.map((s) => [s.id, s]));
  return cs
    .map((c, i) => ({ c, rango: i + 1 }))
    .filter(({ c }) => {
      if (f.ambito === 'rutas' && c.unidad !== 'tramo') return false;
      if (f.ambito === 'calles' && c.unidad !== 'punto') return false;
      if (f.via !== VIA_TODAS && viaDe(c) !== f.via) return false;
      if (f.usuario !== 'todos' && !tieneUsuario(c, porId, f.usuario)) return false;
      return true;
    });
}
