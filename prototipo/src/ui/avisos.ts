/**
 * Almacén de avisos breves (RNF01). `avisar()` se llama desde cualquier lado;
 * `<Avisos />` (Toast.tsx) los muestra.
 */
import { useSyncExternalStore } from 'react';

export type TonoAviso = 'info' | 'exito' | 'alerta' | 'error';

export interface Aviso {
  id: number;
  texto: string;
  detalle?: string;
  tono: TonoAviso;
}

let avisos: Aviso[] = [];
let siguiente = 1;
const oyentes = new Set<() => void>();
const emitir = () => oyentes.forEach((f) => f());

export function avisar(texto: string, opciones: { tono?: TonoAviso; detalle?: string; duracion?: number } = {}): number {
  const id = siguiente++;
  avisos = [...avisos.slice(-3), { id, texto, detalle: opciones.detalle, tono: opciones.tono ?? 'info' }];
  emitir();
  const duracion = opciones.duracion ?? (opciones.tono === 'alerta' || opciones.tono === 'error' ? 8000 : 4500);
  if (typeof window !== 'undefined') window.setTimeout(() => descartarAviso(id), duracion);
  return id;
}

export function descartarAviso(id: number): void {
  avisos = avisos.filter((a) => a.id !== id);
  emitir();
}

function suscribir(f: () => void) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export function useAvisos(): Aviso[] {
  return useSyncExternalStore(suscribir, () => avisos, () => avisos);
}
