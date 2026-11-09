/**
 * Acciones que usan más de una feature. La confirmación de una ubicación es
 * el punto donde CU02 (crónicas) y CU03 (revisión) incluyen CU04 y CU09: la
 * ubicación pasa a confirmada, las concentraciones se recalculan solas (son
 * derivadas) y se evalúan los reclamos desatendidos.
 */
import { actualizarRegistro } from '../../dominio/concentraciones';
import { evaluarReclamosDesatendidos, type AlertaEmitida } from '../../dominio/reclamos';
import type { Concentracion, Ubicacion } from '../../dominio/tipos';
import { ahora } from '../reloj';
import { useDemo } from '../store';

/**
 * Guarda la ubicación de un siniestro. Si queda confirmada, ejecuta CU09 y
 * devuelve las alertas emitidas (para avisarlas en pantalla).
 */
export function guardarUbicacion(siniestroId: string, ubicacion: Ubicacion | null): AlertaEmitida[] {
  const estado = useDemo.getState();
  const s = estado.siniestros.find((x) => x.id === siniestroId);
  if (!s) throw new Error(`No existe el siniestro ${siniestroId}`);
  const actualizado = { ...s, ubicacion };
  const siniestros = estado.siniestros.map((x) => (x.id === siniestroId ? actualizado : x));
  if (ubicacion?.estado !== 'confirmada') {
    useDemo.setState({ siniestros });
    return [];
  }
  const r = evaluarReclamosDesatendidos(actualizado, estado.reclamos, ahora());
  useDemo.setState({ siniestros, reclamos: r.reclamos });
  return r.alertas;
}

/**
 * Fija en el registro el número de las concentraciones dadas, para que no
 * cambie aunque aparezcan otras (llamar al emitir una ficha).
 */
export function fijarNumerosConcentraciones(concentraciones: readonly Concentracion[]): void {
  useDemo.setState((e) => ({ registroConcentraciones: actualizarRegistro(concentraciones, e.registroConcentraciones) }));
}
