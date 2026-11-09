import { describe, expect, it } from 'vitest';
import { semilla } from '../../datos/semilla';
import { claveAlerta, cierreDesmentido, cuadraDelLugar, estadoFila, siniestrosPosteriores } from './modelo';

const datos = semilla();
const r = (n: string) => datos.reclamos.find((x) => x.numero === n)!;

describe('modelo de la bandeja', () => {
  it('alerta y tinte de fila por reclamo de la semilla', () => {
    expect(claveAlerta(r('PN-2026-0131'))).toBe('desatendido');
    expect(claveAlerta(r('PN-2026-0186'))).toBe('desatendido');
    expect(claveAlerta(r('PN-2026-0204'))).toBe('cierre-desmentido');
    expect(claveAlerta(r('PN-2026-0157'))).toBe('sin-alerta');
    expect(estadoFila(r('PN-2026-0131'))).toBe('alerta');
    expect(estadoFila(r('PN-2026-0157'))).toBeUndefined();
    expect(estadoFila({ ...r('PN-2026-0157'), estado: 'en-verificacion' })).toBe('revision');
    expect(estadoFila({ ...r('PN-2026-0131'), estado: 'cerrado' })).toBe('cerrado');
  });

  it('el cierre desmentido de PN-2026-0204 conserva quién lo cerró', () => {
    expect(cierreDesmentido(r('PN-2026-0204'))).toMatchObject({ por: 'M. Ferreyra', motivo: 'obra ejecutada' });
    expect(cierreDesmentido(r('PN-2026-0131'))).toBeNull();
  });

  it('siniestros posteriores con distancia dentro del radio y su crónica', () => {
    const ps = siniestrosPosteriores(r('PN-2026-0131'), datos.siniestros, datos.cronicas);
    expect(ps).toHaveLength(2);
    for (const p of ps) {
      expect(p.distancia).toBeLessThanOrEqual(50);
      expect(p.cronicas.length).toBeGreaterThan(0);
    }
    expect(ps[0]!.siniestro.fechaHecho <= ps[1]!.siniestro.fechaHecho).toBe(true);
    const ruta = siniestrosPosteriores(r('PN-2026-0204'), datos.siniestros, datos.cronicas);
    expect(ruta[0]!.distancia).toBeLessThanOrEqual(500);
  });

  it('lee la cuadra del lugar', () => {
    expect(cuadraDelLugar('Av. Colón al 5300')).toEqual({ calle: 'Av. Colón', altura: 5300 });
    expect(cuadraDelLugar('RN 36 · km 612')).toBeNull();
  });
});
