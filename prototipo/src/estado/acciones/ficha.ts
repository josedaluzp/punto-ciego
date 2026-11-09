/**
 * Acciones de la ficha de intervención (CU06, RF13).
 *
 * Emitir una ficha registra su número (siguiente libre del año), la fecha y
 * la hora de la demo, el técnico que la emitió, las contramedidas que eligió
 * de las recomendadas (CU07) y la evidencia congelada: los siniestros y el
 * índice de la concentración en ese momento (RNF02). Además fija el número de
 * la concentración, para que no cambie aunque aparezcan otras después.
 */
import { anio } from '../../dominio/fechas';
import { siguienteNumero } from '../../dominio/numeracion';
import type { Concentracion, Ficha, Usuario } from '../../dominio/tipos';
import { ahora, hoy } from '../reloj';
import { useDemo } from '../store';
import { fijarNumerosConcentraciones } from './compartidas';

/** CU06: sólo el técnico de tránsito y el funcionario a cargo emiten fichas. */
export function puedeEmitirFicha(usuario: Pick<Usuario, 'rol'>): boolean {
  return usuario.rol === 'tecnico' || usuario.rol === 'funcionario';
}

/** Número que recibirá la próxima ficha: FI-2026-0043 en la semilla. */
export function proximoNumeroFicha(fichas: readonly Pick<Ficha, 'numero'>[]): string {
  return siguienteNumero('FI', anio(hoy()), fichas.map((f) => f.numero));
}

/** Ficha ya emitida para la concentración, si la hay. */
export function fichaDeConcentracion(fichas: readonly Ficha[], concentracionId: string): Ficha | undefined {
  return fichas.find((f) => f.concentracionId === concentracionId);
}

export function emitirFicha(concentracion: Concentracion, contramedidaIds: readonly string[], usuario: Usuario): Ficha {
  if (!puedeEmitirFicha(usuario)) throw new Error(`${usuario.nombre} (${usuario.cargo}) no emite fichas de intervención`);
  const { fichas } = useDemo.getState();
  const ficha: Ficha = {
    numero: proximoNumeroFicha(fichas),
    concentracionId: concentracion.id,
    fecha: ahora(),
    emitidaPor: usuario.nombre,
    contramedidaIds: [...contramedidaIds],
    siniestroIds: [...concentracion.siniestroIds],
    indice: concentracion.indice,
  };
  fijarNumerosConcentraciones([concentracion]);
  useDemo.setState((e) => ({ fichas: [...e.fichas, ficha] }));
  return ficha;
}
