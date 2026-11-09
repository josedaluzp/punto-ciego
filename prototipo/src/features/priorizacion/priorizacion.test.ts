import { describe, expect, it } from 'vitest';
import { generarSemilla, PERIODO_PREDETERMINADO } from '../../datos/semilla';
import { nombreConcentracion } from '../../dominio/concentraciones';
import { concentracionesDe } from '../../estado/selectores';
import { diferencias, resumir, sinCambios } from './diferencias';
import { filtrarLugares, viaDe, viasDisponibles, VIA_TODAS } from './filtros';

const datos = generarSemilla();
const cs = concentracionesDe(datos, PERIODO_PREDETERMINADO);
const todo = { ambito: 'todo', via: VIA_TODAS, usuario: 'todos' } as const;

describe('Filtros de lugares priorizados (RF12)', () => {
  it('sin filtros conserva las 38 concentraciones en orden y con su rango', () => {
    const l = filtrarLugares(cs, datos.siniestros, todo);
    expect(l).toHaveLength(38);
    expect(l.map((x) => x.rango)).toEqual(cs.map((_, i) => i + 1));
  });

  it('el ámbito separa tramos de ruta y puntos de calle, sin perder el rango provincial', () => {
    const rutas = filtrarLugares(cs, datos.siniestros, {
      ...todo,
      ambito: 'rutas',
    });
    const calles = filtrarLugares(cs, datos.siniestros, {
      ...todo,
      ambito: 'calles',
    });
    expect(rutas.every((l) => l.c.unidad === 'tramo')).toBe(true);
    expect(calles.every((l) => l.c.unidad === 'punto')).toBe(true);
    expect(rutas.length + calles.length).toBe(38);
    expect(rutas.slice(0, 3).map((l) => [nombreConcentracion(l.c), l.rango])).toEqual([
      ['RN 9 · km 694 a 695', 1],
      ['RN 19 · km 312 a 313', 3],
      ['RN 158 · km 170 a 171', 5],
    ]);
  });

  it('la vía filtra por ruta o calle y las vías se listan rutas primero', () => {
    const vias = viasDisponibles(cs, 'todo');
    expect(vias[0]).toMatch(/^RN /);
    expect(viasDisponibles(cs, 'calles').every((v) => !/^R[NP] /.test(v))).toBe(true);
    const rn9 = filtrarLugares(cs, datos.siniestros, { ...todo, via: 'RN 9' });
    expect(rn9.length).toBeGreaterThan(0);
    expect(rn9.every((l) => viaDe(l.c) === 'RN 9')).toBe(true);
  });

  it('el usuario vulnerable deja sólo los lugares con víctimas de ese tipo', () => {
    const porId = new Map(datos.siniestros.map((s) => [s.id, s]));
    const peatones = filtrarLugares(cs, datos.siniestros, {
      ...todo,
      usuario: 'peaton',
    });
    expect(peatones.length).toBeGreaterThan(0);
    expect(peatones.length).toBeLessThan(38);
    for (const { c } of peatones) {
      expect(c.siniestroIds.some((id) => porId.get(id)!.victimas.some((v) => v.tipoUsuario === 'peaton'))).toBe(true);
    }
  });
});

describe('Diferencias entre cálculos (CU04)', () => {
  it('el mismo cálculo no tiene cambios', () => {
    expect(sinCambios(diferencias(resumir(cs), resumir(cs)))).toBe(true);
  });

  it('informa nuevas, retiradas, índices cambiados y cambios de puesto', () => {
    const ahora = resumir(cs);
    const antes = ahora
      .filter((l) => l.clave !== ahora[5]!.clave)
      .map((l) => (l.clave === ahora[0]!.clave ? { ...l, indice: 0.85 } : l))
      .concat({
        clave: 'retirada',
        id: 'C-9999',
        nombre: 'Lugar de prueba',
        indice: 0.3,
        rango: 39,
      });
    const d = diferencias(antes, ahora);
    expect(d.nuevas.map((l) => l.clave)).toEqual([ahora[5]!.clave]);
    expect(d.retiradas.map((l) => l.id)).toEqual(['C-9999']);
    expect(d.cambiaron).toHaveLength(1);
    expect(d.cambiaron[0]!.antes).toBe(0.85);
    expect(d.cambiaron[0]!.lugar.indice).toBeCloseTo(0.91, 2);
  });
});
