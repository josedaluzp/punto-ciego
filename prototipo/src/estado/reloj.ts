/**
 * Reloj de la demo. "Hoy" es siempre FECHA_DEMO (09/09/2026), la fecha en que
 * la bandeja de las Figuras 20 y 21 muestra sus días sin respuesta. Las
 * acciones de la demo se registran en esa fecha con la hora real del equipo.
 */
import { FECHA_DEMO } from '../datos/semilla';

export function hoy(): string {
  return FECHA_DEMO;
}

/** Momento ISO de una acción: la fecha de la demo con la hora real. */
export function ahora(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${FECHA_DEMO}T${hh}:${mm}:${ss}`;
}
