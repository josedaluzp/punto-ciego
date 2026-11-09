/**
 * Índice de riesgo de una concentración (RF11).
 *
 *   índice = 0,5 · severidad + 0,3 · frecuencia + 0,2 · vulnerables
 *
 * Cada componente está normalizado entre 0 y 1, así que el índice también:
 *
 * - severidad   = min(1, (fallecidos + 0,3 · heridos graves) / 5,5)
 *                 Víctimas fatales equivalentes respecto de una referencia de
 *                 5,5 (el máximo de la provincia en 2021–2025, redondeado).
 * - frecuencia  = min(1, siniestros / 4,5)
 *                 Cantidad de siniestros de la concentración en el período,
 *                 respecto de una referencia de 4,5.
 * - vulnerables = víctimas fatales que son peatones, ciclistas o
 *                 motociclistas sobre el total de víctimas fatales (si no hay
 *                 víctimas fatales, sobre el total de víctimas).
 *
 * Las referencias 5,5 y 4,5 y el peso 0,3 del herido grave se calibraron
 * sobre la semilla de demostración. Son datos sintéticos.
 *
 * La función NO recibe reclamos: el orden de priorización no depende de que
 * los vecinos reclamen (PRODUCT.md, posicionamiento; CU04, comentarios).
 */
import type { Siniestro } from './tipos';
import { USUARIOS_VULNERABLES } from './tipos';

export const PESOS = { severidad: 0.5, frecuencia: 0.3, vulnerables: 0.2 } as const;
export const SEVERIDAD_REFERENCIA = 5.5;
export const PESO_HERIDO_GRAVE = 0.3;
export const FRECUENCIA_REFERENCIA = 4.5;

export interface ComponentesRiesgo {
  severidad: number;
  frecuencia: number;
  vulnerables: number;
  fallecidos: number;
  heridosGraves: number;
  fallecidosVulnerables: number;
  siniestros: number;
}

export function componentesRiesgo(siniestros: readonly Siniestro[]): ComponentesRiesgo {
  let fallecidos = 0;
  let heridosGraves = 0;
  let fallecidosVulnerables = 0;
  let vulnerablesTodos = 0;
  for (const s of siniestros) {
    for (const v of s.victimas) {
      const vulnerable = USUARIOS_VULNERABLES.includes(v.tipoUsuario);
      if (vulnerable) vulnerablesTodos++;
      if (v.gravedad === 'fallecido') {
        fallecidos++;
        if (vulnerable) fallecidosVulnerables++;
      } else {
        heridosGraves++;
      }
    }
  }
  const victimas = fallecidos + heridosGraves;
  return {
    severidad: Math.min(1, (fallecidos + PESO_HERIDO_GRAVE * heridosGraves) / SEVERIDAD_REFERENCIA),
    frecuencia: Math.min(1, siniestros.length / FRECUENCIA_REFERENCIA),
    vulnerables: fallecidos > 0 ? fallecidosVulnerables / fallecidos : victimas > 0 ? vulnerablesTodos / victimas : 0,
    fallecidos,
    heridosGraves,
    fallecidosVulnerables,
    siniestros: siniestros.length,
  };
}

/** RF11: índice entre 0 y 1. Recibe sólo los tres componentes; nunca reclamos. */
export function indiceRiesgo(c: Pick<ComponentesRiesgo, 'severidad' | 'frecuencia' | 'vulnerables'>): number {
  const v = PESOS.severidad * c.severidad + PESOS.frecuencia * c.frecuencia + PESOS.vulnerables * c.vulnerables;
  return Math.min(1, Math.max(0, v));
}
