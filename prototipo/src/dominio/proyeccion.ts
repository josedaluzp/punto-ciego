/**
 * Proyección lat/lon ↔ x/y de los dos planos de dibujo.
 *
 * Los dos planos vienen de los canvas de la Entrega 2 (`mapa.json`), que los
 * proyectó en forma equirectangular. En esa proyección cada eje es función
 * lineal de una sola coordenada, así que alcanza un ajuste lineal por eje:
 *
 *   x = ax · lon + bx        y = ay · lat + by
 *
 * - Provincia: mínimos cuadrados sobre las diez ciudades dibujadas, con su
 *   coordenada real como punto de control (residuo máximo < 1 px ≈ 1 km).
 * - Ciudad de Córdoba: los dos casos con coordenada real de la E2 (Agustín
 *   Piaggio al 1000 y Av. Monseñor Pablo Cabrera al 1900). Las dos escalas
 *   dan 30,5 px por km, lo que confirma que el plano no está rotado. Es el
 *   mismo ajuste de `entregas/entrega-3/scripts/interfaces.py`.
 *
 * Los coeficientes los calcula `scripts/extraer-cartografia.mjs` y quedan en
 * `src/datos/cartografia-base.json`.
 */
import cartografia from '../datos/cartografia-base.json';
import type { LatLon } from './geo';

export interface Ajuste {
  ax: number;
  bx: number;
  ay: number;
  by: number;
}

export type Plano = 'provincia' | 'ciudad';

export const AJUSTES: Record<Plano, Ajuste> = cartografia.proyeccion;

export function aPlano(plano: Plano, p: LatLon): { x: number; y: number } {
  const a = AJUSTES[plano];
  return { x: a.ax * p.lon + a.bx, y: a.ay * p.lat + a.by };
}

export function dePlano(plano: Plano, x: number, y: number): LatLon {
  const a = AJUSTES[plano];
  return { lat: (y - a.by) / a.ay, lon: (x - a.bx) / a.ax };
}

export const aProvincia = (p: LatLon) => aPlano('provincia', p);
export const aCiudad = (p: LatLon) => aPlano('ciudad', p);
export const deProvincia = (x: number, y: number) => dePlano('provincia', x, y);
export const deCiudad = (x: number, y: number) => dePlano('ciudad', x, y);

/** Píxeles por kilómetro del plano, en sentido horizontal, a una latitud. */
export function pxPorKm(plano: Plano, lat = -31.4): number {
  return Math.abs(AJUSTES[plano].ax) / (111.32 * Math.cos((lat * Math.PI) / 180));
}

/** Caja del plano de la ciudad, en lat/lon: sirve para saber si un punto cae dentro. */
export function enPlanoCiudad(p: LatLon): boolean {
  const { x, y } = aCiudad(p);
  return x >= 0 && x <= 1000 && y >= 0 && y <= 664;
}
