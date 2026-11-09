import { describe, expect, it } from 'vitest';
import {
  RADIO_PUNTO_M,
  actualizarRegistro,
  agruparConcentraciones,
  colaPoisson,
  esSignificativa,
  nombreConcentracion,
} from './concentraciones';
import { posicionPorProgresiva } from './postes';
import { alNorte, siniestro, victima } from './prueba-util';
import { componentesRiesgo, indiceRiesgo } from './riesgo';
import type { Siniestro } from './tipos';

const BASE = { lat: -31.4282, lon: -64.1898 };

/** Fondo de siniestros dispersos para fijar la tasa media del ámbito. */
function fondoUrbano(n: number): Siniestro[] {
  return Array.from({ length: n }, (_, i) => siniestro({ lat: -31.3 - (i % 10) * 0.02, lon: -64.05 - Math.floor(i / 10) * 0.02 }));
}

function enRuta(ruta: string, km: number, extra: Partial<Siniestro> = {}): Siniestro {
  const p = posicionPorProgresiva(ruta, km)!;
  return siniestro({ ...p, ruta, km, ...extra });
}

describe('RF10 · prueba de Poisson', () => {
  it('cola de Poisson P(X ≥ n)', () => {
    expect(colaPoisson(0, 1)).toBe(1);
    expect(colaPoisson(1, 0.5)).toBeCloseTo(1 - Math.exp(-0.5), 10);
    expect(colaPoisson(2, 0.2)).toBeCloseTo(1 - Math.exp(-0.2) * 1.2, 10);
  });

  it('significativa con al menos dos siniestros y p < 0,05', () => {
    expect(esSignificativa(1, 0.0001)).toBe(false);
    expect(esSignificativa(2, 0.2)).toBe(true);
    expect(esSignificativa(2, 0.5)).toBe(false);
    expect(esSignificativa(3, 0.5)).toBe(true);
  });
});

describe('RF10 · agruparConcentraciones', () => {
  it('punto urbano: agrupa los siniestros a menos de 150 m', () => {
    const cerca = [0, 60, 120].map((m) => siniestro({ lat: alNorte(BASE.lat, m), lon: BASE.lon }));
    const lejos = siniestro({ lat: alNorte(BASE.lat, 400), lon: BASE.lon });
    const cs = agruparConcentraciones([...cerca, lejos, ...fondoUrbano(40)]);
    expect(cs).toHaveLength(1);
    expect(cs[0]!.unidad).toBe('punto');
    expect(cs[0]!.siniestroIds.sort()).toEqual(cerca.map((s) => s.id).sort());
    expect(RADIO_PUNTO_M).toBe(150);
  });

  it('ruta: agrupa por tramo de un kilómetro de progresiva', () => {
    const tramo = [694.1, 694.5, 694.9].map((km) => enRuta('RN 9', km));
    const otro = enRuta('RN 9', 695.2);
    const fondo = [500, 520, 540, 560, 580, 600, 620].map((km) => enRuta('RN 9', km + 0.5));
    const cs = agruparConcentraciones([...tramo, otro, ...fondo]);
    expect(cs).toHaveLength(1);
    expect(cs[0]).toMatchObject({ unidad: 'tramo', ruta: 'RN 9', kmDesde: 694, kmHasta: 695 });
    expect(nombreConcentracion(cs[0]!)).toBe('RN 9 · km 694 a 695');
  });

  it('descarta los agrupamientos que no superan la prueba de significancia', () => {
    // Una ruta muy cargada: dos siniestros en un kilómetro no se apartan de la tasa media.
    const densa = Array.from({ length: 80 }, (_, i) => enRuta('RN 8', 600 + (i % 45) + 0.3));
    const cs = agruparConcentraciones(densa);
    for (const c of cs) expect(c.pValor).toBeLessThan(0.05);
    expect(cs.every((c) => c.siniestroIds.length >= 3)).toBe(true);
  });

  it('excluye los siniestros con ubicación en revisión, descartada o sin ubicación (RF08)', () => {
    const conf = [0, 50].map((m) => siniestro({ lat: alNorte(BASE.lat, m), lon: BASE.lon }));
    const rev = siniestro({ lat: alNorte(BASE.lat, 20), lon: BASE.lon });
    rev.ubicacion!.estado = 'en-revision';
    const desc = siniestro({ lat: alNorte(BASE.lat, 30), lon: BASE.lon });
    desc.ubicacion!.estado = 'descartada';
    const sin = siniestro({ ubicacion: null });
    const cs = agruparConcentraciones([...conf, rev, desc, sin, ...fondoUrbano(30)]);
    expect(cs).toHaveLength(1);
    expect(cs[0]!.siniestroIds.sort()).toEqual(conf.map((s) => s.id).sort());
  });

  it('ordena por índice de riesgo descendente', () => {
    const a = [0, 40].map((m) => siniestro({ lat: alNorte(BASE.lat, m), lon: BASE.lon, victimas: [victima('conductor')] }));
    const b = [0, 40].map((m) => siniestro({ lat: alNorte(BASE.lat, 2000 + m), lon: BASE.lon, victimas: [victima('peaton'), victima('peaton')] }));
    const cs = agruparConcentraciones([...a, ...b, ...fondoUrbano(30)]);
    expect(cs.map((c) => c.indice)).toEqual([...cs.map((c) => c.indice)].sort((x, y) => y - x));
    expect(cs[0]!.siniestroIds).toContain(b[0]!.id);
  });

  it('tipo predominante: el más frecuente, con desempate por víctimas fatales', () => {
    const s = [
      siniestro({ lat: BASE.lat, lon: BASE.lon, tipo: 'choque frontal' }),
      siniestro({ lat: alNorte(BASE.lat, 30), lon: BASE.lon, tipo: 'salida de calzada' }),
      siniestro({ lat: alNorte(BASE.lat, 60), lon: BASE.lon, tipo: 'salida de calzada' }),
    ];
    const [c] = agruparConcentraciones([...s, ...fondoUrbano(30)]);
    expect([c!.tipoPredominante, c!.cantidadPredominante]).toEqual(['salida de calzada', 2]);
  });

  it('conserva el número asignado entre recálculos y numera las nuevas a continuación', () => {
    const s = [0, 40].map((m) => siniestro({ lat: alNorte(BASE.lat, m), lon: BASE.lon }));
    const [c1] = agruparConcentraciones([...s, ...fondoUrbano(30)], {});
    const registro = actualizarRegistro([c1!], { 'tramo|RN 9|1': 'C-0040' });
    expect(c1!.id).toBe('C-0001');
    const otra = [0, 40].map((m) => siniestro({ lat: alNorte(BASE.lat, 3000 + m), lon: BASE.lon, victimas: [victima('peaton'), victima('peaton')] }));
    const cs = agruparConcentraciones([...s, ...otra, ...fondoUrbano(30)], registro);
    expect(cs.find((c) => c.clave === c1!.clave)!.id).toBe('C-0001');
    expect(cs.find((c) => c.clave !== c1!.clave)!.id).toBe('C-0041');
  });

  it('el índice de cada concentración es el de sus siniestros', () => {
    const s = [0, 40, 80].map((m) => siniestro({ lat: alNorte(BASE.lat, m), lon: BASE.lon }));
    const [c] = agruparConcentraciones([...s, ...fondoUrbano(30)]);
    expect(c!.indice).toBe(indiceRiesgo(componentesRiesgo(s)));
  });
});
