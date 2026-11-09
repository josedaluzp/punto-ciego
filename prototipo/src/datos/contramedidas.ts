/**
 * Catálogo de contramedidas precargado (RF14). En el sistema real se carga
 * una sola vez del repositorio público de factores de modificación de
 * choques; su administración desde la interfaz quedó fuera del prototipo.
 *
 * FACTORES DE DEMOSTRACIÓN: los valores son sintéticos y la referencia
 * señala un "estudio de demostración". Ninguna cifra es una cita real.
 */
import type { Contramedida } from '../dominio/tipos';

const REF = 'Repositorio de factores de modificación de choques · estudio de demostración';

export const CATALOGO_CONTRAMEDIDAS: readonly Contramedida[] = [
  // Ruta · salida de calzada (las tres de la ficha FI-2026-0042)
  { id: 'CM-01', nombre: 'Bandas sonoras en el borde de calzada', tipoVia: 'ruta', tipoSiniestro: 'salida de calzada', factor: 0.72, calificacion: 4, referencia: `${REF} 1` },
  { id: 'CM-02', nombre: 'Pavimentación de banquina', tipoVia: 'ruta', tipoSiniestro: 'salida de calzada', factor: 0.81, calificacion: 3, referencia: `${REF} 2` },
  { id: 'CM-03', nombre: 'Demarcación de bordes de alta visibilidad', tipoVia: 'ruta', tipoSiniestro: 'salida de calzada', factor: 0.88, calificacion: 3, referencia: `${REF} 3` },
  // Ruta · choque frontal
  { id: 'CM-04', nombre: 'Separador central con barrera flexible', tipoVia: 'ruta', tipoSiniestro: 'choque frontal', factor: 0.56, calificacion: 4, referencia: `${REF} 4` },
  { id: 'CM-05', nombre: 'Bandas sonoras sobre el eje', tipoVia: 'ruta', tipoSiniestro: 'choque frontal', factor: 0.75, calificacion: 4, referencia: `${REF} 5` },
  { id: 'CM-06', nombre: 'Carril de sobrepaso alternado (2+1)', tipoVia: 'ruta', tipoSiniestro: 'choque frontal', factor: 0.78, calificacion: 3, referencia: `${REF} 6` },
  // Ruta · choque por alcance y en giro
  { id: 'CM-07', nombre: 'Dársena de giro a la izquierda', tipoVia: 'ruta', tipoSiniestro: 'choque por alcance', factor: 0.7, calificacion: 3, referencia: `${REF} 7` },
  { id: 'CM-08', nombre: 'Iluminación del cruce', tipoVia: 'ruta', tipoSiniestro: 'choque en giro', factor: 0.79, calificacion: 3, referencia: `${REF} 8` },
  { id: 'CM-09', nombre: 'Rotonda en el cruce a nivel', tipoVia: 'ruta', tipoSiniestro: 'choque en giro', factor: 0.62, calificacion: 4, referencia: `${REF} 9` },
  // Calle · atropello de peatón
  { id: 'CM-10', nombre: 'Fase peatonal exclusiva en el semáforo', tipoVia: 'calle', tipoSiniestro: 'atropello de peatón', factor: 0.66, calificacion: 4, referencia: `${REF} 10` },
  { id: 'CM-11', nombre: 'Isla de refugio peatonal', tipoVia: 'calle', tipoSiniestro: 'atropello de peatón', factor: 0.69, calificacion: 3, referencia: `${REF} 11` },
  { id: 'CM-12', nombre: 'Senda peatonal elevada', tipoVia: 'calle', tipoSiniestro: 'atropello de peatón', factor: 0.74, calificacion: 3, referencia: `${REF} 12` },
  // Calle · choque en giro
  { id: 'CM-13', nombre: 'Fase protegida de giro a la izquierda', tipoVia: 'calle', tipoSiniestro: 'choque en giro', factor: 0.68, calificacion: 4, referencia: `${REF} 13` },
  { id: 'CM-14', nombre: 'Prohibición de giro a la izquierda', tipoVia: 'calle', tipoSiniestro: 'choque en giro', factor: 0.73, calificacion: 3, referencia: `${REF} 14` },
  // Calle · caída de motociclista
  { id: 'CM-15', nombre: 'Bacheo y repavimentación del carril', tipoVia: 'calle', tipoSiniestro: 'caída de motociclista', factor: 0.77, calificacion: 3, referencia: `${REF} 15` },
  { id: 'CM-16', nombre: 'Demarcación antideslizante', tipoVia: 'calle', tipoSiniestro: 'caída de motociclista', factor: 0.86, calificacion: 2, referencia: `${REF} 16` },
  // Calle · alcance y lateral
  { id: 'CM-17', nombre: 'Coordinación semafórica (onda verde)', tipoVia: 'calle', tipoSiniestro: 'choque por alcance', factor: 0.8, calificacion: 3, referencia: `${REF} 17` },
  { id: 'CM-18', nombre: 'Semáforo en la intersección', tipoVia: 'calle', tipoSiniestro: 'choque lateral', factor: 0.71, calificacion: 3, referencia: `${REF} 18` },
  { id: 'CM-19', nombre: 'Reductores de velocidad antes del cruce', tipoVia: 'calle', tipoSiniestro: 'choque lateral', factor: 0.82, calificacion: 2, referencia: `${REF} 19` },
  // Calle · salida de calzada
  { id: 'CM-20', nombre: 'Barrera de contención en la curva', tipoVia: 'calle', tipoSiniestro: 'salida de calzada', factor: 0.76, calificacion: 3, referencia: `${REF} 20` },
];
