/**
 * Medidas de los signos de identidad del lugar (escudo de ruta, rombo de
 * índice): tamaño en pantalla y cuerpo de cada texto, en unidades del
 * viewBox de 40 × 40. El cuerpo en pantalla es `unidades × px / 40`.
 */

/** Piso de legibilidad del rótulo secundario ("RUTA NAC.", "AV."), en px (KT-09). */
export const PISO_SECUNDARIO = 9;
/** Piso de legibilidad del número o nombre principal, en px (KT-09). */
export const PISO_PRINCIPAL = 11;

/** Lado del viewBox de los signos cuadrados. */
export const LADO_VIEWBOX = 40;

/** Tamaño mínimo del escudo: con 40 px, "RUTA NAC." llega a 9 px sin apretarse de más. */
const ESCUDO_MINIMO = 40;
/** Cuerpo de diseño de "RUTA NAC." y del índice del rombo, en unidades del viewBox. */
const ROTULO_ESCUDO = 7.6;
const CIFRA_ROMBO = 10.6;
/** Ancho de "RUTA NAC." en el viewBox: de diseño y, si el piso agranda el cuerpo, un poco más para no apretarlo. */
const ANCHO_ROTULO_ESCUDO = 29;
const ANCHO_ROTULO_AGRANDADO = 32;

/** Unidades del viewBox que hacen falta para llegar a `piso` px con el signo a `px`. */
const conPiso = (unidades: number, piso: number, px: number) => Math.max(unidades, (piso * LADO_VIEWBOX) / px);

/** Cuerpo en pantalla de un texto del signo, en px. */
export const enPantalla = (unidades: number, px: number) => (unidades * px) / LADO_VIEWBOX;

export interface MedidasEscudo {
  /** Lado del escudo en pantalla, en px. */
  px: number;
  /** Cuerpo de "RUTA NAC." / "RUTA PROV.", en unidades del viewBox. */
  rotulo: number;
  /** Ancho al que se ajusta ese rótulo (`textLength`), en unidades del viewBox. */
  anchoRotulo: number;
  /** Cuerpo del número de ruta, en unidades del viewBox. */
  cifra: number;
}

export function medidasEscudo(tamano: number, numero: string): MedidasEscudo {
  const px = Math.max(tamano, ESCUDO_MINIMO);
  const cifra = numero.length >= 3 ? 14 : numero.length === 2 ? 17 : 19;
  const rotulo = conPiso(ROTULO_ESCUDO, PISO_SECUNDARIO, px);
  return {
    px,
    rotulo,
    anchoRotulo: rotulo > ROTULO_ESCUDO ? ANCHO_ROTULO_AGRANDADO : ANCHO_ROTULO_ESCUDO,
    cifra: conPiso(cifra, PISO_PRINCIPAL, px),
  };
}

export type TamanoRombo = 'chico' | 'normal' | 'grande';

export function medidasRombo(tamano: TamanoRombo): { px: number; cifra: number } {
  const px = { chico: 40, normal: 44, grande: 56 }[tamano];
  return { px, cifra: conPiso(CIFRA_ROMBO, PISO_PRINCIPAL, px) };
}
