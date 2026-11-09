import { beforeEach, describe, expect, it, vi } from 'vitest';
import { posicionPorProgresiva } from '../../dominio';
import type { Reclamo } from '../../dominio/tipos';
import { concentracionesDe } from '../selectores';
import { restablecerDatos, useDemo } from '../store';
import { resolverRevision } from './revision';

vi.spyOn(console, 'warn').mockImplementation(() => {});

const PERIODO_CON_2026 = { desde: 2021, hasta: 2026 };

function enRevision() {
  return useDemo.getState().siniestros.filter((s) => s.ubicacion?.estado === 'en-revision');
}
function porLugar(texto: string) {
  return enRevision().find((s) => s.lugarExtraido?.texto.includes(texto))!;
}
function siniestro(id: string) {
  return useDemo.getState().siniestros.find((s) => s.id === id)!;
}

describe('CU03 · resolverRevision', () => {
  beforeEach(() => restablecerDatos());

  it('la semilla deja tres ubicaciones en revisión, fuera de todo cálculo', () => {
    expect(enRevision().map((s) => s.ubicacion!.confianza).sort()).toEqual([0.22, 0.41, 0.55]);
    const ids = new Set(enRevision().map((s) => s.id));
    for (const c of concentracionesDe(useDemo.getState(), PERIODO_CON_2026)) {
      expect(c.siniestroIds.some((id) => ids.has(id))).toBe(false);
    }
  });

  it('confirmar deja la propuesta tal cual y registra quién y cuándo', () => {
    const s = porLugar('Circunvalación');
    const antes = s.ubicacion!;
    expect(resolverRevision(s.id, { accion: 'confirmar' }, 'L. Ahumada')).toEqual([]);
    const u = siniestro(s.id).ubicacion!;
    expect(u).toMatchObject({ estado: 'confirmada', metodo: antes.metodo, confianza: 0.41, lat: antes.lat, lon: antes.lon, revisadaPor: 'L. Ahumada' });
    expect(u.revisadaEn).toMatch(/^2026-09-09T\d\d:\d\d:\d\d$/);
    expect(enRevision()).toHaveLength(2);
  });

  it('corregir pasa a método manual con confianza 1', () => {
    const s = porLugar('Villa El Libertador');
    resolverRevision(s.id, { accion: 'corregir', lat: -31.4801, lon: -64.2302 }, 'L. Ahumada');
    expect(siniestro(s.id).ubicacion).toMatchObject({ estado: 'confirmada', metodo: 'manual', confianza: 1, lat: -31.4801, lon: -64.2302 });
  });

  it('corregir por progresiva sobre ruta guarda el km y entra en la concentración del tramo (CU04)', () => {
    const s = porLugar('ruta nacional 36');
    const p = posicionPorProgresiva('RN 36', 700.5)!;
    resolverRevision(s.id, { accion: 'corregir', ...p, km: 700.5 }, 'L. Ahumada');
    const u = siniestro(s.id).ubicacion!;
    expect(u).toMatchObject({ ruta: 'RN 36', km: 700.5, metodo: 'manual', nomenclatura: 'RN 36, km 700,5, corregida a mano' });
    const tramo = concentracionesDe(useDemo.getState(), PERIODO_CON_2026).find((c) => c.siniestroIds.includes(s.id));
    expect(tramo).toMatchObject({ id: 'C-0031', ruta: 'RN 36', kmDesde: 700, kmHasta: 701 });
    expect(tramo!.siniestroIds).toHaveLength(3);
  });

  it('descartar deja el siniestro sin ubicación válida y sin evaluar reclamos', () => {
    const s = porLugar('Circunvalación');
    const reclamos = useDemo.getState().reclamos;
    expect(resolverRevision(s.id, { accion: 'descartar' }, 'L. Ahumada')).toEqual([]);
    expect(siniestro(s.id).ubicacion).toMatchObject({ estado: 'descartada', revisadaPor: 'L. Ahumada' });
    expect(useDemo.getState().reclamos).toBe(reclamos);
  });

  it('al confirmar corre CU09: un reclamo previo a 50 m dispara la alerta', () => {
    const s = porLugar('Circunvalación');
    const u = s.ubicacion!;
    const base = useDemo.getState().reclamos.find((r) => r.numero === 'PN-2026-0157')!;
    const cercano: Reclamo = { ...base, numero: 'PN-2026-0999', lat: u.lat + 0.0002, lon: u.lon, alerta: false, alertas: [], siniestrosPosteriores: [] };
    useDemo.setState((e) => ({ reclamos: [...e.reclamos, cercano] }));
    const alertas = resolverRevision(s.id, { accion: 'confirmar' }, 'L. Ahumada');
    expect(alertas.map((a) => [a.reclamo, a.tipo])).toEqual([['PN-2026-0999', 'reclamo-desatendido']]);
    expect(useDemo.getState().reclamos.find((r) => r.numero === 'PN-2026-0999')!.alerta).toBe(true);
  });

  it('no deja revisar dos veces la misma ubicación', () => {
    const s = porLugar('Circunvalación');
    resolverRevision(s.id, { accion: 'confirmar' }, 'L. Ahumada');
    expect(() => resolverRevision(s.id, { accion: 'descartar' }, 'L. Ahumada')).toThrow(/ya no está en revisión/);
  });
});
