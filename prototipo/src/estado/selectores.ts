/**
 * Lecturas derivadas del store. Las concentraciones se recalculan cada vez
 * que cambian los siniestros (CU04 se ejecuta al confirmar una ubicación).
 */
import { useMemo } from 'react';
import { PERIODO_PREDETERMINADO } from '../datos/semilla';
import { usuarioPorId } from '../datos/usuarios';
import { agruparConcentraciones } from '../dominio/concentraciones';
import { anio } from '../dominio/fechas';
import { ordenarBandeja } from '../dominio/reclamos';
import type { Concentracion, Siniestro, Usuario } from '../dominio/tipos';
import { hoy } from './reloj';
import { useDemo, type EstadoDemo } from './store';

export interface Periodo {
  desde: number;
  hasta: number;
}

export function siniestrosDelPeriodo(siniestros: readonly Siniestro[], periodo: Periodo): Siniestro[] {
  return siniestros.filter((s) => {
    const a = anio(s.fechaHecho);
    return a >= periodo.desde && a <= periodo.hasta;
  });
}

/** Concentraciones significativas del período, ordenadas por índice (RF10, RF11). */
export function concentracionesDe(estado: Pick<EstadoDemo, 'siniestros' | 'registroConcentraciones'>, periodo: Periodo = PERIODO_PREDETERMINADO): Concentracion[] {
  return agruparConcentraciones(siniestrosDelPeriodo(estado.siniestros, periodo), estado.registroConcentraciones);
}

export function useConcentraciones(periodo: Periodo = PERIODO_PREDETERMINADO): Concentracion[] {
  const siniestros = useDemo((e) => e.siniestros);
  const registro = useDemo((e) => e.registroConcentraciones);
  const { desde, hasta } = periodo;
  return useMemo(() => concentracionesDe({ siniestros, registroConcentraciones: registro }, { desde, hasta }), [siniestros, registro, desde, hasta]);
}

export function useUsuario(): Usuario {
  const id = useDemo((e) => e.usuarioId);
  return usuarioPorId(id);
}

/** Bandeja ordenada (RF17), sin los cerrados. */
export function useBandeja() {
  const reclamos = useDemo((e) => e.reclamos);
  return useMemo(() => ordenarBandeja(reclamos, hoy()), [reclamos]);
}

export interface Conteos {
  cronicas: number;
  enRevision: number;
  lugares: number;
  fichas: number;
  desatendidos: number;
  reclamos: number;
}

/** Cantidades vivas del riel. */
export function useConteos(): Conteos {
  const cronicas = useDemo((e) => e.cronicas.length);
  const enRevision = useDemo((e) => e.siniestros.filter((s) => s.ubicacion?.estado === 'en-revision').length);
  const fichas = useDemo((e) => e.fichas.length);
  const desatendidos = useDemo((e) => e.reclamos.filter((r) => r.alerta && r.estado !== 'cerrado').length);
  const reclamos = useDemo((e) => e.reclamos.length);
  const lugares = useConcentraciones().length;
  return { cronicas, enRevision, lugares, fichas, desatendidos, reclamos };
}
