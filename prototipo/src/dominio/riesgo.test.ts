import { describe, expect, it } from 'vitest';
import { decimal } from './formato';
import { siniestro, victima } from './prueba-util';
import { PESOS, componentesRiesgo, indiceRiesgo } from './riesgo';
import type { Victima } from './tipos';

const M = victima('motociclista');
const P = victima('peaton');
const A = victima('conductor');
const O = victima('acompanante');
const g = (v: Victima): Victima => ({ ...v, gravedad: 'herido-grave' });

function indice(...victimasPorSiniestro: Victima[][]): number {
  return indiceRiesgo(componentesRiesgo(victimasPorSiniestro.map((victimas) => siniestro({ victimas }))));
}

describe('RF11 · indiceRiesgo', () => {
  it('pondera 0,5 severidad + 0,3 frecuencia + 0,2 vulnerables', () => {
    expect(PESOS).toEqual({ severidad: 0.5, frecuencia: 0.3, vulnerables: 0.2 });
    expect(indiceRiesgo({ severidad: 1, frecuencia: 0, vulnerables: 0 })).toBe(0.5);
    expect(indiceRiesgo({ severidad: 0, frecuencia: 1, vulnerables: 0 })).toBe(0.3);
    expect(indiceRiesgo({ severidad: 0, frecuencia: 0, vulnerables: 1 })).toBe(0.2);
  });

  it('queda normalizado entre 0 y 1', () => {
    expect(indice([])).toBeGreaterThanOrEqual(0);
    const muchos = Array.from({ length: 12 }, () => [M, M, P]);
    expect(indice(...muchos)).toBeLessThanOrEqual(1);
    expect(indice(...muchos)).toBe(1);
  });

  it('NO recibe reclamos: un objeto con reclamos da el mismo índice que sin ellos', () => {
    const c = componentesRiesgo([siniestro({ victimas: [M] }), siniestro({ victimas: [P] })]);
    const conReclamos = { ...c, reclamos: 120, alerta: true, siniestrosPosteriores: 9 };
    expect(indiceRiesgo(conReclamos)).toBe(indiceRiesgo(c));
    expect(indiceRiesgo.length).toBe(1);
  });

  it('más fallecidos, más severidad; más siniestros, más frecuencia; más vulnerables, más índice', () => {
    expect(indice([M], [M])).toBeGreaterThan(indice([M], []));
    expect(indice([A], [A], [])).toBeGreaterThan(indice([A], [A]));
    expect(indice([P], [P])).toBeGreaterThan(indice([A], [A]));
  });

  it('un herido grave pesa menos que un fallecido', () => {
    expect(indice([M], [g(M)])).toBeLessThan(indice([M], [M]));
    expect(indice([M], [g(M)])).toBeGreaterThan(indice([M], []));
  });

  it('vulnerables: proporción sobre las víctimas fatales', () => {
    const c = componentesRiesgo([siniestro({ victimas: [M] }), siniestro({ victimas: [M, M] }), siniestro({ victimas: [A, g(A)] }), siniestro({ victimas: [M] })]);
    expect(c).toMatchObject({ fallecidos: 5, heridosGraves: 1, fallecidosVulnerables: 4, vulnerables: 0.8 });
  });

  it('reproduce los índices de la Figura 17 a partir de sus componentes', () => {
    expect(decimal(indice([M], [M, M], [A, g(A)], [M]))).toBe('0,91');
    expect(decimal(indice([P], [P], [P, g(P)], [P, g(P)]))).toBe('0,88');
    expect(decimal(indice([A, O], [M], [M], [g(A)], []))).toBe('0,79');
    expect(decimal(indice([M], [M], [victima('ciclista')], []))).toBe('0,74');
    expect(decimal(indice([A, O], [M], [g(A)], [g(A)]))).toBe('0,66');
    expect(decimal(indice([M], [M], [g(M)]))).toBe('0,61');
  });
});
