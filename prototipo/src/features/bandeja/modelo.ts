/**
 * Lecturas puras de la bandeja: cómo se tiñe cada fila, qué alerta muestra,
 * los siniestros posteriores con su distancia y el lugar para el croquis.
 */
import { distanciaMetros } from '../../dominio/geo';
import type { Cierre, Cronica, Reclamo, Siniestro } from '../../dominio/tipos';
import type { ClaveEstado, EstadoFila } from '../../ui';

export type ClaveAlerta = Extract<ClaveEstado, 'desatendido' | 'cierre-desmentido' | 'sin-alerta'>;

/** Un reclamo reabierto por un siniestro posterior a su cierre (CU09 2.a). */
export function cierreDesmentido(r: Pick<Reclamo, 'alertas' | 'cierresDesmentidos'>): Cierre | null {
  if (!r.alertas.some((a) => a.tipo === 'cierre-desmentido')) return null;
  return r.cierresDesmentidos?.at(-1) ?? null;
}

export function claveAlerta(r: Reclamo): ClaveAlerta {
  if (!r.alerta || r.estado === 'cerrado') return 'sin-alerta';
  return r.alertas.some((a) => a.tipo === 'cierre-desmentido') ? 'cierre-desmentido' : 'desatendido';
}

/** El estado tiñe la fila: alerta en rojo, verificación en ámbar rayado, cerrado atenuado. */
export function estadoFila(r: Reclamo): EstadoFila | undefined {
  if (r.estado === 'cerrado') return 'cerrado';
  if (r.alerta) return 'alerta';
  if (r.estado === 'en-verificacion') return 'revision';
  return undefined;
}

/** Fecha de la primera alerta vigente (la que inauguró la omisión). */
export function alertaDesde(r: Reclamo): string | null {
  return r.alertas[0]?.fecha ?? null;
}

export interface SiniestroPosterior {
  siniestro: Siniestro;
  distancia: number;
  cronicas: Cronica[];
}

export function siniestrosPosteriores(r: Reclamo, siniestros: readonly Siniestro[], cronicas: readonly Cronica[]): SiniestroPosterior[] {
  return r.siniestrosPosteriores
    .map((id) => siniestros.find((s) => s.id === id))
    .filter((s): s is Siniestro => !!s)
    .map((s) => ({
      siniestro: s,
      distancia: s.ubicacion ? Math.round(distanciaMetros(s.ubicacion, r)) : 0,
      cronicas: s.cronicaIds.map((c) => cronicas.find((x) => x.id === c)).filter((c): c is Cronica => !!c),
    }))
    .sort((a, b) => a.siniestro.fechaHecho.localeCompare(b.siniestro.fechaHecho));
}

/** Calle y altura de "Av. Colón al 5300"; `null` si el lugar no es una cuadra. */
export function cuadraDelLugar(lugar: string): { calle: string; altura: number } | null {
  const m = /^(.+) al (\d+)$/.exec(lugar.trim());
  return m ? { calle: m[1]!, altura: Number(m[2]) } : null;
}
