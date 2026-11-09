/**
 * Caracterización de las vías (RF13: tipo de calzada, carriles, banquina).
 * Datos sintéticos de demostración. RNF07: la jurisdicción y el tipo de vía
 * son datos; sumar otra red es cargar esta tabla, no cambiar el programa.
 */
import type { CaracterizacionVia } from '../dominio/tipos';

interface TramoVia extends CaracterizacionVia {
  desde: number;
  hasta: number;
}

/** Caracterización por defecto de cada ruta, con excepciones por tramo. */
export const VIAS_RUTA: Record<string, { porDefecto: CaracterizacionVia; tramos?: TramoVia[] }> = {
  'RN 9': {
    porDefecto: { calzada: 'simple', carriles: 2, banquina: 'sin pavimentar' },
    tramos: [{ desde: 640, hasta: 680, calzada: 'doble', carriles: 4, banquina: 'pavimentada' }],
  },
  'RN 19': {
    porDefecto: { calzada: 'simple', carriles: 2, banquina: 'sin pavimentar' },
    tramos: [{ desde: 110, hasta: 130, calzada: 'doble', carriles: 4, banquina: 'pavimentada' }],
  },
  'RN 158': { porDefecto: { calzada: 'simple', carriles: 2, banquina: 'sin pavimentar' } },
  'RN 36': {
    porDefecto: { calzada: 'simple', carriles: 2, banquina: 'pavimentada' },
    tramos: [{ desde: 600, hasta: 625, calzada: 'doble', carriles: 4, banquina: 'pavimentada' }],
  },
  'RN 38': { porDefecto: { calzada: 'simple', carriles: 2, banquina: 'sin pavimentar' } },
  'RN 8': { porDefecto: { calzada: 'simple', carriles: 2, banquina: 'pavimentada' } },
  'RN 35': { porDefecto: { calzada: 'simple', carriles: 2, banquina: 'sin pavimentar' } },
};

/** Calles urbanas: avenidas de doble mano salvo excepción. La banquina no corresponde. */
export const VIAS_CALLE: Record<string, CaracterizacionVia> = {
  'Agustín Piaggio': { calzada: 'simple', carriles: 2, banquina: 'no corresponde' },
  'Bv. San Juan': { calzada: 'doble', carriles: 6, banquina: 'no corresponde' },
  'Av. Circunvalación': { calzada: 'doble', carriles: 6, banquina: 'pavimentada' },
  'Av. Castro Barros': { calzada: 'simple', carriles: 3, banquina: 'no corresponde' },
  'Av. Japón': { calzada: 'simple', carriles: 2, banquina: 'no corresponde' },
};

export const VIA_CALLE_POR_DEFECTO: CaracterizacionVia = { calzada: 'doble', carriles: 4, banquina: 'no corresponde' };
export const VIA_RUTA_POR_DEFECTO: CaracterizacionVia = { calzada: 'simple', carriles: 2, banquina: 'sin pavimentar' };

export function caracterizarVia(lugar: { ruta?: string; km?: number; calle?: string }): CaracterizacionVia {
  if (lugar.ruta) {
    const v = VIAS_RUTA[lugar.ruta];
    if (!v) return VIA_RUTA_POR_DEFECTO;
    const km = lugar.km;
    const t = km === undefined ? undefined : v.tramos?.find((x) => km >= x.desde && km < x.hasta);
    if (t) return { calzada: t.calzada, carriles: t.carriles, banquina: t.banquina };
    return v.porDefecto;
  }
  return (lugar.calle && VIAS_CALLE[lugar.calle]) || VIA_CALLE_POR_DEFECTO;
}
