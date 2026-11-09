import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CRONICAS_DE_EJEMPLO } from '../../datos/semilla';
import { buscarDuplicado } from '../../dominio/duplicados';
import { extraerDeCronica } from '../../dominio/extraccion';
import { EJEMPLO_CONFIANZA_BAJA } from '../../features/cronicas/textos';
import type { CronicaDeEjemplo } from '../../datos/semilla';
import { concentracionesDe } from '../selectores';
import { restablecerDatos, useDemo } from '../store';
import { incorporarCronica, siguienteId, ubicacionSinLugar, type DecisionDuplicado } from './cronicas';

vi.spyOn(console, 'warn').mockImplementation(() => {});

function incorporar(ej: CronicaDeEjemplo, decision: DecisionDuplicado = { tipo: 'nuevo' }) {
  const e = extraerDeCronica(ej.texto, ej.fechaPublicacion);
  return incorporarCronica(ej, { lugar: e.lugar, fechaHecho: e.fechaHecho, victimas: e.victimas, tipo: e.tipo }, decision, 'L. Ahumada');
}

describe('incorporar crónica (CU01) y georreferenciar (CU02)', () => {
  beforeEach(() => restablecerDatos());

  it('numera el siniestro y la crónica después de los de la semilla', () => {
    expect(siguienteId('S', ['S-0001', 'S-0471', 'X-9999'])).toBe('S-0472');
    expect(siguienteId('CR', [])).toBe('CR-0001');
    const r = incorporar(CRONICAS_DE_EJEMPLO[0]!);
    expect(r.siniestro.id).toBe('S-0472');
    expect(r.cronica.id).toBe('CR-0513');
    expect(r.cronica.incorporadaPor).toBe('L. Ahumada');
    expect(r.cronica.incorporadaEn?.startsWith('2026-09-09T')).toBe(true);
  });

  it('Sabattini: servicio de normalización, 0,86, confirmada y dentro de su concentración', () => {
    const r = incorporar(CRONICAS_DE_EJEMPLO[0]!);
    expect(r.vinculada).toBe(false);
    expect(r.siniestro.ubicacion).toMatchObject({ metodo: 'normalizacion', precision: 'cuadra', confianza: 0.86, estado: 'confirmada' });
    expect(r.siniestro.cronicaIds).toEqual([r.cronica.id]);
    const c = concentracionesDe(useDemo.getState(), { desde: 2021, hasta: 2026 }).find((x) => x.siniestroIds.includes(r.siniestro.id));
    expect(c?.calle).toBe('Av. Amadeo Sabattini');
  });

  it('Pablo Cabrera: al confirmarse dispara la alerta de PN-2026-0157', () => {
    const r = incorporar(CRONICAS_DE_EJEMPLO[1]!);
    expect(r.alertas.map((a) => a.reclamo)).toEqual(['PN-2026-0157']);
    expect(useDemo.getState().reclamos.find((x) => x.numero === 'PN-2026-0157')!.siniestrosPosteriores).toContain(r.siniestro.id);
  });

  it('RN 158 km 214,6: capa de postes, nunca el servicio de normalización', () => {
    const r = incorporar(CRONICAS_DE_EJEMPLO[2]!);
    expect(r.siniestro.ubicacion).toMatchObject({ metodo: 'poste', precision: 'ruta-progresiva', ruta: 'RN 158', km: 214.6, estado: 'confirmada' });
  });

  it('la segunda crónica de Sabattini se reconoce como el mismo siniestro y se vincula (RF03)', () => {
    const primera = incorporar(CRONICAS_DE_EJEMPLO[0]!);
    const ej = CRONICAS_DE_EJEMPLO[3]!;
    const e = extraerDeCronica(ej.texto, ej.fechaPublicacion);
    const { siniestros, cronicas } = useDemo.getState();
    const d = buscarDuplicado({ fechaHecho: e.fechaHecho, lugar: e.lugar }, ej.texto, siniestros, cronicas);
    expect(d).toMatchObject({ nivel: 'seguro' });
    expect(d!.siniestro.id).toBe(primera.siniestro.id);
    const antes = useDemo.getState().siniestros.length;
    const r = incorporar(ej, { tipo: 'vincular', siniestroId: d!.siniestro.id });
    expect(r.vinculada).toBe(true);
    expect(useDemo.getState().siniestros.length).toBe(antes);
    expect(useDemo.getState().siniestros.find((s) => s.id === primera.siniestro.id)!.cronicaIds).toEqual([primera.cronica.id, r.cronica.id]);
  });

  it('confianza baja: la ubicación queda en revisión y fuera de los cálculos (RF08)', () => {
    const antes = concentracionesDe(useDemo.getState(), { desde: 2021, hasta: 2026 });
    const r = incorporar(EJEMPLO_CONFIANZA_BAJA);
    expect(r.siniestro.ubicacion).toMatchObject({ metodo: 'normalizacion', precision: 'corredor', estado: 'en-revision' });
    expect(r.siniestro.ubicacion!.confianza).toBeLessThan(0.7);
    expect(r.alertas).toEqual([]);
    const despues = concentracionesDe(useDemo.getState(), { desde: 2021, hasta: 2026 });
    expect(despues.some((c) => c.siniestroIds.includes(r.siniestro.id))).toBe(false);
    expect(despues.length).toBe(antes.length);
  });

  it('sin lugar reconocible: registra la crónica y deriva la ubicación a revisión (CU01 3.a)', () => {
    const r = incorporarCronica(
      { url: 'https://diario.example/sin-lugar', medio: 'Diario de ejemplo', fechaPublicacion: '2026-09-09', texto: 'Dos personas murieron en un choque. No se informó el lugar del hecho.' },
      { lugar: null, fechaHecho: '2026-09-08', victimas: [], tipo: null },
      { tipo: 'nuevo' },
      'L. Ahumada',
    );
    expect(r.siniestro.ubicacion).toEqual(ubicacionSinLugar());
    expect(r.siniestro.ubicacion!.estado).toBe('en-revision');
  });

  it('no registra dos veces la misma dirección web (CU01 2.a)', () => {
    incorporar(CRONICAS_DE_EJEMPLO[0]!);
    expect(() => incorporar({ ...CRONICAS_DE_EJEMPLO[0]!, url: `${CRONICAS_DE_EJEMPLO[0]!.url}/` })).toThrow(/ya fue incorporada/);
  });
});
