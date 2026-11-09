/** Estados con su texto y su tono (chips y filas). */

export type ClaveEstado =
  | 'abierto'
  | 'en-verificacion'
  | 'cerrado'
  | 'reabierto'
  | 'confirmada'
  | 'en-revision'
  | 'descartada'
  | 'pendiente'
  | 'desatendido'
  | 'cierre-desmentido'
  | 'sin-alerta'
  | 'caso-documentado'
  | 'vulnerable';

export type Tono = 'neutro' | 'carbon' | 'rojo' | 'ambar' | 'verde' | 'tenue';

export const ESTADOS: Record<ClaveEstado, { texto: string; tono: Tono }> = {
  abierto: { texto: 'abierto', tono: 'neutro' },
  'en-verificacion': { texto: 'en verificación', tono: 'carbon' },
  cerrado: { texto: 'cerrado', tono: 'tenue' },
  reabierto: { texto: 'reabierto', tono: 'rojo' },
  confirmada: { texto: 'Ubicación confirmada', tono: 'verde' },
  'en-revision': { texto: 'En revisión', tono: 'ambar' },
  descartada: { texto: 'Descartada', tono: 'tenue' },
  pendiente: { texto: 'Pendiente', tono: 'ambar' },
  desatendido: { texto: 'desatendido', tono: 'rojo' },
  'cierre-desmentido': { texto: 'cierre desmentido', tono: 'rojo' },
  'sin-alerta': { texto: 'sin alerta', tono: 'tenue' },
  'caso-documentado': { texto: 'caso documentado', tono: 'carbon' },
  vulnerable: { texto: 'usuario vulnerable', tono: 'rojo' },
};

/** Texto del estado, para usarlo fuera de un chip. */
export function textoEstado(estado: ClaveEstado): string {
  return ESTADOS[estado].texto;
}
