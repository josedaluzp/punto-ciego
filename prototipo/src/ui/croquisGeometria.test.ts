import { describe, expect, it } from 'vitest';
import { asignarNiveles, DISTANCIA_MINIMA, geometriaVia, VIA_POR_DEFECTO, yDeNivel } from './croquisGeometria';

describe('geometriaVia', () => {
  it('sin caracterización conserva el dibujo de siempre: dos carriles entre 46 y 78, eje en 62', () => {
    const g = geometriaVia(VIA_POR_DEFECTO, 46);
    expect(g).toMatchObject({ arriba: 46, abajo: 78, eje: 62, ida: 70, vuelta: 54, separador: null, lineaEje: true });
    expect(g.divisorias).toEqual([]);
    expect(g.calzadas).toHaveLength(1);
  });

  it('doble calzada de 4 carriles: dos calzadas, separador al medio y una línea de carril en cada una', () => {
    const g = geometriaVia({ calzada: 'doble', carriles: 4, banquina: 'pavimentada' }, 0);
    expect(g.calzadas).toHaveLength(2);
    expect(g.separador).not.toBeNull();
    expect(g.lineaEje).toBe(false);
    expect(g.divisorias).toHaveLength(2);
    expect(g.anchoBanquina).toBeGreaterThan(0);
    expect(g.eje).toBeCloseTo(g.separador!.y + g.separador!.alto / 2);
    expect(g.vuelta).toBeLessThan(g.separador!.y);
    expect(g.ida).toBeGreaterThan(g.separador!.y + g.separador!.alto);
  });
});

describe('asignarNiveles', () => {
  const eje = 16;
  const centros = (niveles: Map<number, number>, xs: Record<number, number>) =>
    [...niveles].map(([n, nivel]) => ({ x: xs[n]!, y: yDeNivel(nivel, eje) }));

  it('tres siniestros en la misma progresiva quedan en tres niveles, a no menos de 26 px', () => {
    const xs = { 1: 300, 2: 300, 3: 302 };
    const niveles = asignarNiveles(
      Object.entries(xs).map(([n, x]) => ({ numero: Number(n), x, minimo: n === '2' ? 1 : 0 })),
      eje,
    );
    expect(new Set(niveles.values()).size).toBe(3);
    const c = centros(niveles, xs);
    for (let i = 0; i < c.length; i++)
      for (let j = i + 1; j < c.length; j++) expect(Math.hypot(c[i]!.x - c[j]!.x, c[i]!.y - c[j]!.y)).toBeGreaterThanOrEqual(DISTANCIA_MINIMA);
  });

  it('un número que caería sobre el rótulo del sentido sube un nivel', () => {
    const caja = { x: 500, y: -30, w: 120, h: 16 };
    const niveles = asignarNiveles([{ numero: 1, x: 560, minimo: 1 }], eje, [caja]);
    expect(niveles.get(1)).toBe(2);
  });
});
