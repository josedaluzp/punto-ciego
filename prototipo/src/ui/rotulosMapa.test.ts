import { describe, expect, it } from 'vitest';
import { cajaDeRotulo, puntosDeTraza, seTocan, ubicarRotulos } from './rotulosMapa';

const marco = { x: 0, y: 0, w: 1000, h: 1000 };

describe('ubicarRotulos', () => {
  it('sin choques deja cada rótulo en su lugar de siempre', () => {
    const r = ubicarRotulos([{ nombre: 'Río Cuarto', x: 100, y: 100 }], [{ ref: 'RN 8', lx: 400, ly: 400, puntos: [] }], [], 1, marco);
    expect(r.ciudades[0]).toMatchObject({ x: 105, ancla: 'start' });
    expect(r.rutas[0]).toMatchObject({ x: 400, y: 400 });
  });

  it('una ciudad con un marcador a la derecha pasa el nombre a la izquierda', () => {
    const r = ubicarRotulos([{ nombre: 'Jesús María', x: 100, y: 100 }], [], [{ x: 104, y: 92, w: 20, h: 16 }], 1, marco);
    expect(r.ciudades[0]!.ancla).toBe('end');
  });

  it('la referencia de ruta que pisa el nombre de una ciudad se corre a un punto libre de su traza', () => {
    const puntos = puntosDeTraza('M200 100L260 100 M260 100L400 100');
    expect(puntos).toHaveLength(4);
    const r = ubicarRotulos([{ nombre: 'San Francisco', x: 100, y: 100 }], [{ ref: 'RN 19', lx: 120, ly: 103, puntos }], [], 1, marco);
    const ciudad = cajaDeRotulo(r.ciudades[0]!, 10);
    const ruta = cajaDeRotulo(r.rutas[0]!, 9.5, true);
    expect(seTocan(ciudad, ruta)).toBe(false);
  });
});
