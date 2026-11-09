import { describe, expect, it } from 'vitest';
import { CATALOGO_CONTRAMEDIDAS } from '../datos/contramedidas';
import { recomendarContramedidas, reduccionEsperada, tipoViaDe } from './contramedidas';
import type { Contramedida } from './tipos';

describe('RF14 · recomendarContramedidas', () => {
  it('tramo de ruta con salida de calzada: las tres de la ficha, por factor ascendente', () => {
    const r = recomendarContramedidas({ unidad: 'tramo', tipoPredominante: 'salida de calzada' }, CATALOGO_CONTRAMEDIDAS);
    expect(r.map((c) => [c.nombre, c.factor, c.calificacion])).toEqual([
      ['Bandas sonoras en el borde de calzada', 0.72, 4],
      ['Pavimentación de banquina', 0.81, 3],
      ['Demarcación de bordes de alta visibilidad', 0.88, 3],
    ]);
    expect(r.map(reduccionEsperada)).toEqual([28, 19, 12]);
  });

  it('filtra por tipo de vía: un punto urbano nunca recibe una contramedida de ruta', () => {
    const r = recomendarContramedidas({ unidad: 'punto', tipoPredominante: 'salida de calzada' }, CATALOGO_CONTRAMEDIDAS);
    expect(r.every((c) => c.tipoVia === 'calle')).toBe(true);
    expect(tipoViaDe({ unidad: 'punto' })).toBe('calle');
    expect(tipoViaDe({ unidad: 'tramo' })).toBe('ruta');
  });

  it('filtra por tipo de siniestro predominante', () => {
    const r = recomendarContramedidas({ unidad: 'punto', tipoPredominante: 'atropello de peatón' }, CATALOGO_CONTRAMEDIDAS);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((c) => c.tipoSiniestro === 'atropello de peatón')).toBe(true);
  });

  it('a igual factor, primero la de mejor calificación', () => {
    const cat: Contramedida[] = [
      { id: 'a', nombre: 'A', tipoVia: 'ruta', tipoSiniestro: 'choque frontal', factor: 0.7, calificacion: 2, referencia: 'r' },
      { id: 'b', nombre: 'B', tipoVia: 'ruta', tipoSiniestro: 'choque frontal', factor: 0.7, calificacion: 5, referencia: 'r' },
      { id: 'c', nombre: 'C', tipoVia: 'ruta', tipoSiniestro: 'choque frontal', factor: 0.6, calificacion: 1, referencia: 'r' },
    ];
    expect(recomendarContramedidas({ unidad: 'tramo', tipoPredominante: 'choque frontal' }, cat).map((c) => c.id)).toEqual(['c', 'b', 'a']);
  });

  it('sin contramedidas aplicables devuelve una lista vacía (CU07 2.a)', () => {
    expect(recomendarContramedidas({ unidad: 'tramo', tipoPredominante: 'atropello de peatón' }, CATALOGO_CONTRAMEDIDAS)).toEqual([]);
  });

  it('todas las del catálogo tienen factor y referencia', () => {
    for (const c of CATALOGO_CONTRAMEDIDAS) {
      expect(c.factor).toBeGreaterThan(0);
      expect(c.factor).toBeLessThan(1);
      expect(c.referencia).toMatch(/demostración/);
    }
  });
});
