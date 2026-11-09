/** Texto de la chapa azul de nomenclatura (ver `ChapaCalle`). */

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

/** Ancho aproximado de un carácter en mayúscula de Archivo negrita, en em. */
const ANCHO_CARACTER = 0.64;
/** Cuerpo mínimo legible del nombre en la chapa, en px. */
export const CUERPO_MINIMO_CHAPA = 9.5;
/** Compresión horizontal máxima del texto (como una Archivo angosta). */
const COMPRESION_MAXIMA = 0.8;
const ESCALA_PREFIJO = 0.72;

export interface TextoAjustado {
  prefijo: string;
  nombre: string;
  /** Cuerpo del nombre, en px. */
  fuente: number;
  /** Si hay que comprimir el texto al ancho disponible (`textLength`). */
  comprimir: boolean;
}

function anchoTexto(prefijo: string, nombre: string, fuente: number): number {
  const caracteres = nombre.length + (prefijo ? (prefijo.length + 1) * ESCALA_PREFIJO : 0);
  return caracteres * ANCHO_CARACTER * fuente;
}

/**
 * Elige qué escribir en la chapa y con qué cuerpo para que entre en
 * `disponible` px sin bajar de {@link CUERPO_MINIMO_CHAPA}: primero comprime,
 * después deja las últimas palabras del nombre y por último quita el prefijo.
 */
export function ajustarChapa(calle: string | undefined, disponible: number, cuerpo: number): TextoAjustado {
  let { prefijo, nombre } = calle ? textoChapa(calle) : { prefijo: '', nombre: 'SIN CALLE' };
  const entra = (f: number) => anchoTexto(prefijo, nombre, f) * COMPRESION_MAXIMA <= disponible;
  for (;;) {
    if (entra(cuerpo)) break;
    if (entra(CUERPO_MINIMO_CHAPA)) {
      cuerpo = disponible / (anchoTexto(prefijo, nombre, 1) * COMPRESION_MAXIMA);
      break;
    }
    const palabras = nombre.split(' ');
    if (palabras.length > 1) nombre = palabras.slice(1).join(' ');
    else if (prefijo) prefijo = '';
    else {
      // Una sola palabra que no entra: se abrevia con punto, como en las chapas.
      cuerpo = CUERPO_MINIMO_CHAPA;
      const caben = Math.floor(disponible / (ANCHO_CARACTER * cuerpo * COMPRESION_MAXIMA));
      if (nombre.length > caben) nombre = `${nombre.slice(0, Math.max(caben - 1, 3))}.`;
      break;
    }
  }
  return { prefijo, nombre, fuente: cuerpo, comprimir: anchoTexto(prefijo, nombre, cuerpo) > disponible };
}
