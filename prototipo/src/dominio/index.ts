/**
 * Dominio de Punto Ciego: funciones puras, sin React ni almacenamiento.
 * Cada archivo cita el requerimiento funcional que implementa.
 */
export * from './tipos';
export * from './extraccion';
export * from './duplicados';
export * from './georreferenciacion';
export * from './concentraciones';
export * from './riesgo';
export * from './contramedidas';
export * from './reclamos';
export * from './numeracion';
export {
  normalizarRuta,
  coberturaPostes,
  posicionPorProgresiva,
  progresivaMasCercana,
  rutaMasCercana,
  trazaTramo,
  RUTAS_CON_POSTES,
} from './postes';
export { servicioNormalizacionSimulado, buscarCalle, buscarBarrio, NOMBRES_CALLES, NOMBRES_BARRIOS } from './normalizacion';
export type { ServicioNormalizacion, ConsultaNormalizacion, RespuestaNormalizacion } from './normalizacion';
export { distanciaMetros, type LatLon } from './geo';
export { aProvincia, aCiudad, deProvincia, deCiudad, enPlanoCiudad, pxPorKm, type Plano } from './proyeccion';
export * as formato from './formato';
export * as fechas from './fechas';
