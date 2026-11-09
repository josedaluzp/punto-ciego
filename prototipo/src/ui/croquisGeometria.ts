/**
 * Geometría del croquis, sin React: el corte de la vía a partir de su
 * caracterización (calzadas, separador, carriles, banquina) y los niveles en
 * que se apilan los números de los siniestros para que ninguno pise a otro.
 *
 * Las alturas de los niveles se miden desde el borde superior de la calzada
 * (`arriba`), que el croquis corre hacia abajo cuando hacen falta más niveles.
 */
import type { CaracterizacionVia } from '../dominio/tipos';

/** El dibujo de siempre: una calzada de dos carriles, sin banquina. */
export const VIA_POR_DEFECTO: CaracterizacionVia = { calzada: 'simple', carriles: 2, banquina: 'no corresponde' };

/** Distancia mínima, en píxeles, entre los centros de dos números. */
export const DISTANCIA_MINIMA = 26;
/** Radio del número seleccionado (el más grande). */
export const RADIO_NUMERO = 12;
/** Del borde superior de la calzada al centro del primer nivel de arriba. */
const PRIMER_NIVEL = 22;
const ANCHO_BANQUINA = 7;
const ANCHO_SEPARADOR = 10;

export interface Franja {
  y: number;
  alto: number;
}

export interface GeometriaVia {
  /** Borde superior de la calzada (sin banquina). */
  arriba: number;
  /** Borde inferior de la calzada (sin banquina). */
  abajo: number;
  /** Banquina exterior incluida. */
  arribaTotal: number;
  abajoTotal: number;
  /** Línea de eje o centro del separador. */
  eje: number;
  /** Centro del carril de ida (de izquierda a derecha) más cercano al eje. */
  ida: number;
  /** Centro del carril de vuelta más cercano al eje. */
  vuelta: number;
  calzadas: Franja[];
  separador: Franja | null;
  /** Líneas entre carriles del mismo sentido. */
  divisorias: number[];
  /** Línea de eje discontinua entre sentidos (calzada simple de dos o más carriles). */
  lineaEje: boolean;
  banquina: CaracterizacionVia['banquina'];
  anchoBanquina: number;
}

/** Corte de la vía con el borde superior de la banquina en `arribaTotal`. */
export function geometriaVia(via: CaracterizacionVia, arribaTotal: number): GeometriaVia {
  const carriles = Math.max(1, Math.round(via.carriles));
  const doble = via.calzada === 'doble';
  const ancho = carriles <= 2 ? 16 : 12;
  const anchoBanquina = via.banquina === 'no corresponde' ? 0 : ANCHO_BANQUINA;
  const vuelta = doble ? Math.max(1, Math.floor(carriles / 2)) : Math.floor(carriles / 2);
  const ida = doble ? Math.max(1, carriles - vuelta) : carriles - vuelta;

  const arriba = arribaTotal + anchoBanquina;
  const divisorias: number[] = [];
  for (let i = 1; i < vuelta; i++) divisorias.push(arriba + i * ancho);
  const finVuelta = arriba + vuelta * ancho;
  const separador = doble ? { y: finVuelta, alto: ANCHO_SEPARADOR } : null;
  const inicioIda = separador ? finVuelta + ANCHO_SEPARADOR : finVuelta;
  for (let i = 1; i < ida; i++) divisorias.push(inicioIda + i * ancho);
  const abajo = inicioIda + ida * ancho;
  const eje = separador ? finVuelta + ANCHO_SEPARADOR / 2 : vuelta > 0 ? finVuelta : (arriba + abajo) / 2;

  return {
    arriba,
    abajo,
    arribaTotal,
    abajoTotal: abajo + anchoBanquina,
    eje,
    ida: vuelta > 0 || separador ? inicioIda + ancho / 2 : eje,
    vuelta: vuelta > 0 ? finVuelta - ancho / 2 : eje,
    calzadas: separador
      ? [
          { y: arriba, alto: finVuelta - arriba },
          { y: inicioIda, alto: abajo - inicioIda },
        ]
      : [{ y: arriba, alto: abajo - arriba }],
    separador,
    divisorias,
    lineaEje: !doble && vuelta > 0,
    banquina: via.banquina,
    anchoBanquina,
  };
}

/** Texto accesible de la vía: "doble calzada con separador, 4 carriles, banquina pavimentada". */
export function describirVia(via: CaracterizacionVia): string {
  const calzada = via.calzada === 'doble' ? 'doble calzada con separador' : 'calzada simple';
  const carriles = `${via.carriles} ${via.carriles === 1 ? 'carril' : 'carriles'}`;
  const banquina = via.banquina === 'no corresponde' ? '' : `, banquina ${via.banquina}`;
  return `${calzada}, ${carriles}${banquina}`;
}

/**
 * Centro vertical de un nivel, relativo al borde superior de la calzada. El
 * nivel 0 va sobre el eje (`ejeRelativo`); los demás, apilados hacia arriba.
 */
export function yDeNivel(nivel: number, ejeRelativo: number): number {
  return nivel === 0 ? ejeRelativo : -(PRIMER_NIVEL + (nivel - 1) * DISTANCIA_MINIMA);
}

/** Borde superior de la calzada que deja entrar `nivelMaximo` niveles sobre ella. */
export function arribaParaNiveles(nivelMaximo: number, minimo: number): number {
  if (nivelMaximo < 1) return minimo;
  return Math.max(minimo, PRIMER_NIVEL + (nivelMaximo - 1) * DISTANCIA_MINIMA + RADIO_NUMERO + 4);
}

export interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PedidoNivel {
  numero: number;
  x: number;
  /** Nivel más bajo permitido (la salida de calzada queda fuera de la calzada: 1). */
  minimo: number;
}

/**
 * Asigna a cada número el nivel más bajo en el que queda a no menos de
 * `DISTANCIA_MINIMA` de los ya ubicados y no toca ningún obstáculo (por
 * ejemplo, el rótulo del sentido). Coordenadas relativas a `arriba`.
 */
export function asignarNiveles(pedidos: readonly PedidoNivel[], ejeRelativo: number, obstaculos: readonly Caja[] = []): Map<number, number> {
  const niveles = new Map<number, number>();
  const ubicados: { x: number; y: number }[] = [];
  const ordenados = [...pedidos].sort((a, b) => a.x - b.x || a.numero - b.numero);
  for (const p of ordenados) {
    let nivel = p.minimo;
    for (; nivel < 40; nivel++) {
      const y = yDeNivel(nivel, ejeRelativo);
      const lejos = ubicados.every((u) => Math.hypot(u.x - p.x, u.y - y) >= DISTANCIA_MINIMA);
      const libre = obstaculos.every(
        (o) => p.x + RADIO_NUMERO <= o.x || p.x - RADIO_NUMERO >= o.x + o.w || y + RADIO_NUMERO <= o.y || y - RADIO_NUMERO >= o.y + o.h,
      );
      if (lejos && libre) break;
    }
    niveles.set(p.numero, nivel);
    ubicados.push({ x: p.x, y: yDeNivel(nivel, ejeRelativo) });
  }
  return niveles;
}
