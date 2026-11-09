/**
 * CU08 Presentar reclamo vecinal (RF15). El reclamo se registra sin cuenta y
 * sin datos personales, con su número, la fecha y la ubicación, en estado
 * abierto (pasos 5 y 6 de la ficha). No se evalúa contra los siniestros ya
 * registrados: RF16 sólo mira siniestros posteriores a la presentación, y se
 * ejecuta al confirmar la ubicación de un siniestro (CU09).
 */
import { siguienteNumero } from '../../dominio/numeracion';
import { aProvincia } from '../../dominio/proyeccion';
import type { Reclamo } from '../../dominio/tipos';
import { ahora } from '../reloj';
import { useDemo } from '../store';

export interface DatosReclamo {
  lat: number;
  lon: number;
  lugar: string;
  ambito: string;
  /** Calle del nomenclador, si el lugar cae sobre una; un punto marcado lejos de toda calle no la lleva. */
  calle?: string;
  descripcion: string;
  /** Fotografía optativa, reducida en el navegador (data URL); nunca se sube a ningún lado. */
  foto?: string;
}

export function presentarReclamo(datos: DatosReclamo): Reclamo {
  const en = ahora();
  const fecha = en.slice(0, 10);
  const estado = useDemo.getState();
  const numero = siguienteNumero('PN', Number(fecha.slice(0, 4)), estado.reclamos.map((r) => r.numero));
  const { x, y } = aProvincia(datos);
  const reclamo: Reclamo = {
    numero,
    fechaPresentacion: fecha,
    lat: datos.lat,
    lon: datos.lon,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    lugar: datos.lugar,
    ambito: datos.ambito,
    ...(datos.calle ? { calle: datos.calle } : {}),
    descripcion: datos.descripcion.trim(),
    foto: datos.foto,
    estado: 'abierto',
    alerta: false,
    alertas: [],
    siniestrosPosteriores: [],
    historial: [{ fecha: en, texto: datos.foto ? 'Reclamo presentado con fotografía' : 'Reclamo presentado', tipo: 'presentacion' }],
    origen: 'sintetico',
  };
  useDemo.setState((e) => ({ reclamos: [...e.reclamos, reclamo] }));
  return reclamo;
}
