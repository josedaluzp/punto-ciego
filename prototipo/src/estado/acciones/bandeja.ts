/**
 * Acciones de la bandeja de reclamos (CU10 y CU11). Quién actúa queda
 * registrado con el usuario de demostración activo.
 */
import { usuarioPorId } from '../../datos/usuarios';
import { diasEntre } from '../../dominio/fechas';
import { agendarInspeccion, cerrarReclamo, puedeCerrar, rolPuedeCerrar } from '../../dominio/reclamos';
import type { MotivoCierre, Reclamo, Respaldo, Rol } from '../../dominio/tipos';
import { ahora, hoy } from '../reloj';
import { useDemo } from '../store';

/** CU10: técnico de tránsito y funcionario a cargo (el funcionario hereda las funciones del técnico). */
export function rolPuedeAgendar(rol: Rol): boolean {
  return rol === 'tecnico' || rol === 'funcionario';
}

function reclamoActual(numero: string): Reclamo {
  const r = useDemo.getState().reclamos.find((x) => x.numero === numero);
  if (!r) throw new Error(`No existe el reclamo ${numero}`);
  return r;
}

function reemplazar(actualizado: Reclamo): void {
  useDemo.setState((e) => ({ reclamos: e.reclamos.map((x) => (x.numero === actualizado.numero ? actualizado : x)) }));
}

/** CU10 4.a: agenda la inspección; el reclamo pasa a en verificación y conserva su antigüedad. */
export function agendarInspeccionReclamo(numero: string, fecha: string): Reclamo {
  const usuario = usuarioPorId(useDemo.getState().usuarioId);
  if (!rolPuedeAgendar(usuario.rol)) throw new Error('Sólo el técnico de tránsito o el funcionario a cargo agendan una inspección.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || diasEntre(hoy(), fecha) < 0) throw new Error('La inspección se agenda para hoy o una fecha posterior.');
  const actualizado = agendarInspeccion(reclamoActual(numero), fecha, usuario.nombre, ahora());
  reemplazar(actualizado);
  return actualizado;
}

/** CU11: registra el cierre firmado por el usuario activo. Exige el rol y RF18. */
export function cerrarReclamoFirmado(numero: string, motivo: MotivoCierre, respaldos: Respaldo[]): Reclamo {
  const usuario = usuarioPorId(useDemo.getState().usuarioId);
  if (!rolPuedeCerrar(usuario.rol)) throw new Error('Sólo el funcionario a cargo registra el cierre de un reclamo.');
  const limpios = respaldos.map((r) => ({ ...r, referencia: r.referencia.trim() })).filter((r) => r.referencia.length > 0);
  const v = puedeCerrar({ motivo, respaldos: limpios });
  if (!v.ok) throw new Error(v.errores.join(' '));
  const actualizado = cerrarReclamo(reclamoActual(numero), { motivo, respaldos: limpios, por: usuario.nombre, en: ahora() });
  reemplazar(actualizado);
  return actualizado;
}
