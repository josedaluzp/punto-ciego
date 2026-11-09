/**
 * Recomendación de contramedidas (RF14, CU07).
 *
 * Filtra el catálogo por tipo de vía (calle para un punto urbano, ruta para un
 * tramo) y por el tipo de siniestro predominante, y ordena por factor de
 * reducción ascendente (el factor es la proporción de siniestros que se
 * espera conservar: menor factor, mayor reducción) y, a igual factor, por
 * calificación del estudio descendente. Sin contramedidas aplicables devuelve
 * una lista vacía (CU07 2.a; la ficha avisa catálogo incompleto, CU06 3.a).
 */
import type { Concentracion, Contramedida, TipoVia } from './tipos';

export function tipoViaDe(c: Pick<Concentracion, 'unidad'>): TipoVia {
  return c.unidad === 'tramo' ? 'ruta' : 'calle';
}

export function recomendarContramedidas(
  concentracion: Pick<Concentracion, 'unidad' | 'tipoPredominante'>,
  catalogo: readonly Contramedida[],
): Contramedida[] {
  const via = tipoViaDe(concentracion);
  return catalogo
    .filter((c) => c.tipoVia === via && c.tipoSiniestro === concentracion.tipoPredominante)
    .sort((a, b) => a.factor - b.factor || b.calificacion - a.calificacion || a.id.localeCompare(b.id));
}

/** 0,72 → 28 (% de reducción esperada). */
export function reduccionEsperada(c: Pick<Contramedida, 'factor'>): number {
  return Math.round((1 - c.factor) * 100);
}
