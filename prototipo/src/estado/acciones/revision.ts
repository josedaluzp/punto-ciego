/**
 * CU03 Revisar ubicación de baja confianza (RF09). El analista confirma la
 * propuesta, la corrige sobre el mapa (método manual, confianza 1) o la
 * descarta; queda registrado quién y cuándo. Al confirmar o corregir,
 * `guardarUbicacion` ejecuta CU09 y las concentraciones (CU04) se recalculan
 * solas porque son derivadas.
 */
import { formato, revisarUbicacion, type AlertaEmitida } from '../../dominio';
import { ahora } from '../reloj';
import { useDemo } from '../store';
import { guardarUbicacion } from './compartidas';

export type DecisionRevision =
  | { accion: 'confirmar' }
  | { accion: 'corregir'; lat: number; lon: number; km?: number }
  | { accion: 'descartar' };

/**
 * Aplica la decisión del analista a una ubicación en revisión y la guarda.
 * Devuelve las alertas de reclamo desatendido que haya emitido CU09.
 */
export function resolverRevision(siniestroId: string, decision: DecisionRevision, por: string): AlertaEmitida[] {
  const s = useDemo.getState().siniestros.find((x) => x.id === siniestroId);
  if (!s?.ubicacion) throw new Error(`El siniestro ${siniestroId} no tiene ubicación que revisar`);
  if (s.ubicacion.estado !== 'en-revision') throw new Error(`La ubicación de ${siniestroId} ya no está en revisión`);
  let u = revisarUbicacion(s.ubicacion, decision, por, ahora());
  if (decision.accion === 'corregir') {
    const km = decision.km;
    u = {
      ...u,
      nomenclatura:
        u.ruta && km !== undefined
          ? `${u.ruta}, ${formato.km(km)}, corregida a mano`
          : 'Posición corregida a mano sobre el mapa',
    };
  }
  return guardarUbicacion(siniestroId, u);
}
