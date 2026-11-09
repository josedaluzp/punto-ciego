/** Texto de la chapa azul de nomenclatura (ver `ChapaCalle`). */
import { PISO_PRINCIPAL, PISO_SECUNDARIO } from './medidasSignos';

const PREFIJOS: readonly [RegExp, string][] = [
  [/^(av\.?|avenida)\s+/i, 'AV.'],
  [/^(bv\.?|bulevar|boulevard)\s+/i, 'BV.'],
  [/^(pje\.?|pasaje)\s+/i, 'PJE.'],
  [/^(diag\.?|diagonal)\s+/i, 'DIAG.'],
  [/^calle\s+/i, ''],
];

const CONECTORES = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'EL', 'Y']);

/** Largo máximo del nombre en la chapa antes de quedarse con las últimas palabras. */
const NOMBRE_MAXIMO = 15;

/**
 * Lo que se escribe en la chapa: el tipo de vía abreviado y el nombre en
 * mayúsculas, como las chapas de nomenclatura. Sin la altura ("al 1200").
 * Si el nombre es muy largo se queda con las últimas palabras (el apellido),
 * sin empezar por un conector: «Av. Amadeo Sabattini» → AV. SABATTINI.
 */
export function textoChapa(calle: string): { prefijo: string; nombre: string } {
  let resto = calle.trim().replace(/\s+al\s+\d+.*$/i, '');
  let prefijo = '';
  for (const [re, abrev] of PREFIJOS) {
    if (re.test(resto)) {
      prefijo = abrev;
      resto = resto.replace(re, '');
      break;
    }
  }
  let palabras = resto.toLocaleUpperCase('es-AR').split(/\s+/).filter(Boolean);
  while (palabras.length > 1 && (palabras.join(' ').length > NOMBRE_MAXIMO || CONECTORES.has(palabras[0]!))) {
    palabras = palabras.slice(1);
  }
  return { prefijo, nombre: palabras.join(' ') };
}

/**
 * Ancho de cada carácter de Archivo 700, en em, medido en el navegador. El
 * prefijo va en 600, apenas más angosto: usar la misma tabla deja margen.
 * Un carácter que no está usa el de la letra más ancha habitual.
 */
const ANCHOS: Readonly<Record<string, number>> = {
  A: 0.724, B: 0.722, C: 0.733, D: 0.739, E: 0.683, F: 0.622, G: 0.802, H: 0.754, I: 0.301, J: 0.603,
  K: 0.725, L: 0.591, M: 0.872, N: 0.754, O: 0.793, P: 0.681, Q: 0.793, R: 0.73, S: 0.679, T: 0.641,
  U: 0.748, V: 0.694, W: 0.964, X: 0.706, Y: 0.699, Z: 0.653, Á: 0.724, É: 0.683, Í: 0.301, Ó: 0.793,
  Ú: 0.748, Ü: 0.748, Ñ: 0.754, ' ': 0.196, '.': 0.307, '-': 0.333,
};
const ANCHO_DESCONOCIDO = 0.8;
const DIGITO = 0.596;

const ems = (texto: string) => [...texto].reduce((t, c) => t + (ANCHOS[c] ?? (/\d/.test(c) ? DIGITO : ANCHO_DESCONOCIDO)), 0);

/** Cuerpo mínimo legible del nombre en la chapa, en px. */
export const CUERPO_MINIMO_CHAPA = PISO_PRINCIPAL;
/** Compresión horizontal máxima del texto (como una Archivo angosta). */
const COMPRESION_MAXIMA = 0.8;
const ESCALA_PREFIJO = 0.72;
/** Paso con que se achica el cuerpo hasta que el texto entra, en px. */
const PASO_CUERPO = 0.25;

export interface TextoAjustado {
  prefijo: string;
  nombre: string;
  /** Cuerpo del nombre, en px. */
  fuente: number;
  /** Cuerpo del prefijo ("AV.", "BV."), en px. */
  fuentePrefijo: number;
  /** Si hay que comprimir el texto al ancho disponible (`textLength`). */
  comprimir: boolean;
}

/** Cuerpo del prefijo: más chico que el nombre, pero no menos que el piso del rótulo secundario. */
const cuerpoPrefijo = (fuente: number) => Math.max(fuente * ESCALA_PREFIJO, PISO_SECUNDARIO);

/** Ancho en px del texto de la chapa: el prefijo y su espacio, más el nombre. */
function anchoTexto(prefijo: string, nombre: string, fuente: number): number {
  return ems(nombre) * fuente + (prefijo ? ems(`${prefijo} `) * cuerpoPrefijo(fuente) : 0);
}

/**
 * Elige qué escribir en la chapa y con qué cuerpo para que entre en
 * `disponible` px sin bajar de {@link CUERPO_MINIMO_CHAPA}: primero comprime
 * y achica el cuerpo, después deja las últimas palabras del nombre y por
 * último quita el prefijo.
 */
export function ajustarChapa(calle: string | undefined, disponible: number, cuerpo: number): TextoAjustado {
  let { prefijo, nombre } = calle ? textoChapa(calle) : { prefijo: '', nombre: 'SIN CALLE' };
  const entra = (f: number) => anchoTexto(prefijo, nombre, f) * COMPRESION_MAXIMA <= disponible;
  for (;;) {
    if (entra(cuerpo)) break;
    if (entra(CUERPO_MINIMO_CHAPA)) {
      while (!entra(cuerpo)) cuerpo -= PASO_CUERPO;
      cuerpo = Math.max(cuerpo, CUERPO_MINIMO_CHAPA);
      break;
    }
    const palabras = nombre.split(' ');
    if (palabras.length > 1) nombre = palabras.slice(1).join(' ');
    else if (prefijo) prefijo = '';
    else {
      // Una sola palabra que no entra: se abrevia con punto, como en las chapas.
      cuerpo = CUERPO_MINIMO_CHAPA;
      while (nombre.length > 4 && !entra(cuerpo)) nombre = `${nombre.slice(0, nombre.endsWith('.') ? -2 : -1)}.`;
      break;
    }
  }
  return { prefijo, nombre, fuente: cuerpo, fuentePrefijo: cuerpoPrefijo(cuerpo), comprimir: anchoTexto(prefijo, nombre, cuerpo) > disponible };
}
