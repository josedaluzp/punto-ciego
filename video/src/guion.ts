/**
 * Capítulos del video: qué escena grabada corresponde a cada uno. Las escenas
 * (`id`) son las de prototipo/demo/grabar.spec.ts, que también escribe los
 * subtítulos, sincronizados con lo que pasa en pantalla. El orden de los
 * capítulos sigue la cadena, no el orden de grabación. El capítulo 00, la
 * puesta en marcha, no sale de una toma: lo arma PuestaEnMarcha.tsx.
 */

export type Toma = 'escritorio' | 'vecino';

export interface Capitulo {
  toma: Toma;
  escena: string;
  titulo: string;
  casos: string;
}

export const CAPITULOS: Capitulo[] = [
  { toma: 'escritorio', escena: 'crónica', titulo: 'Incorporar una crónica', casos: 'CU01 · CU02' },
  { toma: 'escritorio', escena: 'ruta', titulo: 'Ubicar sobre una ruta', casos: 'CU02' },
  { toma: 'escritorio', escena: 'duplicado', titulo: 'Reconocer un hecho repetido', casos: 'CU01' },
  { toma: 'escritorio', escena: 'revisión', titulo: 'Revisar las ubicaciones dudosas', casos: 'CU03' },
  { toma: 'escritorio', escena: 'actualización', titulo: 'Actualizar las concentraciones', casos: 'CU04' },
  { toma: 'escritorio', escena: 'priorización', titulo: 'Priorizar los lugares', casos: 'CU05' },
  { toma: 'escritorio', escena: 'ficha', titulo: 'Emitir la ficha de intervención', casos: 'CU06 · CU07' },
  { toma: 'vecino', escena: 'reclamo', titulo: 'El reclamo del vecino', casos: 'CU08' },
  { toma: 'escritorio', escena: 'bandeja', titulo: 'Alertar el reclamo desatendido', casos: 'CU09 · CU10' },
  { toma: 'escritorio', escena: 'cierre', titulo: 'Cerrar con respaldo', casos: 'CU11' },
];

export const PASOS = ['Ubicar', 'Priorizar', 'Emitir la ficha', 'Alertar el reclamo desatendido'];
