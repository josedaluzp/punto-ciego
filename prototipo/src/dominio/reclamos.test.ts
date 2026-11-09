import { describe, expect, it } from 'vitest';
import { posicionPorProgresiva } from './postes';
import { alNorte, reclamo, siniestro } from './prueba-util';
import {
  RADIO_RECLAMO_M,
  agendarInspeccion,
  cerrarReclamo,
  diasSinRespuesta,
  evaluarReclamosDesatendidos,
  ordenarBandeja,
  puedeCerrar,
  rolPuedeCerrar,
} from './reclamos';
import type { Cierre, Reclamo } from './tipos';

const LAT = -31.395;
const LON = -64.256;
const CIERRE: Cierre = {
  motivo: 'obra ejecutada',
  respaldos: [{ tipo: 'orden de trabajo', referencia: 'OT-2026-0877' }],
  por: 'M. Ferreyra',
  en: '2026-07-20T12:30:00',
};

describe('RF16 · evaluarReclamosDesatendidos: los tres casos de la Figura 8', () => {
  it('caso 1, reclamo abierto: siniestro posterior en el radio → alerta de reclamo desatendido', () => {
    const r = reclamo({ lat: LAT, lon: LON, fechaPresentacion: '2026-05-21' });
    const s = siniestro({ lat: alNorte(LAT, 18), lon: LON, fechaHecho: '2026-08-02' });
    const res = evaluarReclamosDesatendidos(s, [r]);
    expect(res.alertas).toEqual([{ reclamo: r.numero, tipo: 'reclamo-desatendido', siniestroId: s.id, distancia: expect.closeTo(18, 0) }]);
    const a = res.reclamos[0]!;
    expect(a).toMatchObject({ alerta: true, estado: 'abierto', siniestrosPosteriores: [s.id], fechaPresentacion: '2026-05-21' });
    expect(a.alertas[0]).toMatchObject({ tipo: 'reclamo-desatendido', diasSinRespuesta: 73 });
  });

  it('caso 1 también para en verificación y reabierto', () => {
    for (const estado of ['en-verificacion', 'reabierto'] as const) {
      const r = reclamo({ lat: LAT, lon: LON, estado });
      const s = siniestro({ lat: LAT, lon: LON, fechaHecho: '2026-08-02' });
      const res = evaluarReclamosDesatendidos(s, [r]);
      expect(res.alertas[0]?.tipo).toBe('reclamo-desatendido');
      expect(res.reclamos[0]!.estado).toBe(estado);
    }
  });

  it('caso 2, cerrado antes del siniestro → se reabre conservando la fecha original, con alerta de cierre desmentido', () => {
    const r = cerrarReclamo(reclamo({ lat: LAT, lon: LON, fechaPresentacion: '2026-07-07' }), CIERRE);
    const s = siniestro({ lat: LAT, lon: LON, fechaHecho: '2026-08-25' });
    const res = evaluarReclamosDesatendidos(s, [r]);
    const a = res.reclamos[0]!;
    expect(res.alertas.map((x) => x.tipo)).toEqual(['cierre-desmentido']);
    expect(a).toMatchObject({ estado: 'reabierto', alerta: true, fechaPresentacion: '2026-07-07', siniestrosPosteriores: [s.id] });
    expect(a.cierre).toBeUndefined();
    expect(a.cierresDesmentidos).toEqual([CIERRE]);
    expect(a.historial.at(-1)?.tipo).toBe('reapertura');
  });

  it('caso 3, presentado después del siniestro → sin alerta', () => {
    const r = reclamo({ lat: LAT, lon: LON, fechaPresentacion: '2026-08-10' });
    const s = siniestro({ lat: LAT, lon: LON, fechaHecho: '2026-08-02' });
    const res = evaluarReclamosDesatendidos(s, [r]);
    expect(res.alertas).toEqual([]);
    expect(res.reclamos[0]).toBe(r);
    expect(res.posterioresAlSiniestro).toEqual([r.numero]);
  });

  it('el mismo día de la presentación no cuenta como posterior', () => {
    const r = reclamo({ lat: LAT, lon: LON, fechaPresentacion: '2026-08-02' });
    const s = siniestro({ lat: LAT, lon: LON, fechaHecho: '2026-08-02' });
    expect(evaluarReclamosDesatendidos(s, [r]).alertas).toEqual([]);
  });

  it('cerrado después del siniestro: el cierre no queda desmentido', () => {
    const r = cerrarReclamo(reclamo({ lat: LAT, lon: LON, fechaPresentacion: '2026-05-01' }), CIERRE);
    const s = siniestro({ lat: LAT, lon: LON, fechaHecho: '2026-07-10' });
    const res = evaluarReclamosDesatendidos(s, [r]);
    expect(res.alertas).toEqual([]);
    expect(res.reclamos[0]!.estado).toBe('cerrado');
  });

  it('radio: 50 m sobre calle (CU09)', () => {
    expect(RADIO_RECLAMO_M.calle).toBe(50);
    const r = reclamo({ lat: LAT, lon: LON });
    const dentro = siniestro({ lat: alNorte(LAT, 45), lon: LON, fechaHecho: '2026-08-02' });
    const fuera = siniestro({ lat: alNorte(LAT, 60), lon: LON, fechaHecho: '2026-08-02' });
    expect(evaluarReclamosDesatendidos(dentro, [r]).alertas).toHaveLength(1);
    expect(evaluarReclamosDesatendidos(fuera, [r]).alertas).toHaveLength(0);
  });

  it('radio: 500 m sobre ruta (CU09)', () => {
    expect(RADIO_RECLAMO_M.ruta).toBe(500);
    const p = posicionPorProgresiva('RN 36', 612)!;
    const r = reclamo({ ...p, ruta: 'RN 36', km: 612 });
    const dentro = siniestro({ ...posicionPorProgresiva('RN 36', 612.4)!, ruta: 'RN 36', km: 612.4, fechaHecho: '2026-08-25' });
    const fuera = siniestro({ ...posicionPorProgresiva('RN 36', 612.7)!, ruta: 'RN 36', km: 612.7, fechaHecho: '2026-08-25' });
    expect(evaluarReclamosDesatendidos(dentro, [r]).alertas).toHaveLength(1);
    expect(evaluarReclamosDesatendidos(fuera, [r]).alertas).toHaveLength(0);
  });

  it('ningún reclamo dispara por sí solo: un siniestro sin ubicación confirmada no evalúa nada', () => {
    const r = reclamo({ lat: LAT, lon: LON });
    const s = siniestro({ lat: LAT, lon: LON, fechaHecho: '2026-08-02' });
    s.ubicacion!.estado = 'en-revision';
    expect(evaluarReclamosDesatendidos(s, [r]).alertas).toEqual([]);
    expect(evaluarReclamosDesatendidos({ ...s, ubicacion: null }, [r]).alertas).toEqual([]);
  });

  it('el caso documentado sin fecha de inicio no puede compararse y no alerta', () => {
    const r = reclamo({ lat: LAT, lon: LON, fechaPresentacion: null });
    const s = siniestro({ lat: LAT, lon: LON, fechaHecho: '2026-08-02' });
    expect(evaluarReclamosDesatendidos(s, [r]).alertas).toEqual([]);
  });

  it('es idempotente: confirmar dos veces el mismo siniestro no duplica la alerta', () => {
    const r = reclamo({ lat: LAT, lon: LON });
    const s = siniestro({ lat: LAT, lon: LON, fechaHecho: '2026-08-02' });
    const una = evaluarReclamosDesatendidos(s, [r]).reclamos;
    const dos = evaluarReclamosDesatendidos(s, una);
    expect(dos.alertas).toEqual([]);
    expect(dos.reclamos[0]!.siniestrosPosteriores).toEqual([s.id]);
  });
});

describe('RF17 · ordenarBandeja', () => {
  const HOY = '2026-09-09';
  const r = (numero: string, fecha: string | null, posteriores: number, extra: Partial<Reclamo> = {}): Reclamo =>
    reclamo({ numero, fechaPresentacion: fecha, alerta: posteriores > 0, siniestrosPosteriores: Array.from({ length: posteriores }, (_, i) => `S-${i}`), ...extra });

  it('con alerta primero, por siniestros posteriores y días sin respuesta; después el resto por antigüedad', () => {
    const lista = [
      r('PN-2026-0157', '2026-06-09', 0),
      r('PN-2026-0204', '2026-07-07', 1, { estado: 'reabierto' }),
      r('PN-2026-0160', null, 0),
      r('PN-2026-0186', '2026-05-21', 1, { estado: 'en-verificacion' }),
      r('PN-2026-0131', '2026-04-16', 2),
      r('PN-2026-0170', '2026-08-01', 0),
    ];
    expect(ordenarBandeja(lista, HOY).map((x) => x.numero)).toEqual([
      'PN-2026-0131',
      'PN-2026-0186',
      'PN-2026-0204',
      'PN-2026-0157',
      'PN-2026-0170',
      'PN-2026-0160',
    ]);
  });

  it('los cerrados no figuran salvo que se pidan', () => {
    const lista = [r('PN-2026-0001', '2026-01-01', 0, { estado: 'cerrado' }), r('PN-2026-0002', '2026-02-01', 0)];
    expect(ordenarBandeja(lista, HOY).map((x) => x.numero)).toEqual(['PN-2026-0002']);
    expect(ordenarBandeja(lista, HOY, { incluirCerrados: true }).map((x) => x.numero)).toEqual(['PN-2026-0002', 'PN-2026-0001']);
  });

  it('días sin respuesta desde la presentación; null si no se conoce', () => {
    expect(diasSinRespuesta({ fechaPresentacion: '2026-05-21' }, HOY)).toBe(111);
    expect(diasSinRespuesta({ fechaPresentacion: null }, HOY)).toBeNull();
  });

  it('agendar la inspección pasa a en verificación y conserva la antigüedad (CU10 4.a)', () => {
    const a = agendarInspeccion(reclamo({ fechaPresentacion: '2026-05-21' }), '2026-09-15', 'R. Quiroga', '2026-09-05T11:20:00');
    expect(a).toMatchObject({ estado: 'en-verificacion', fechaPresentacion: '2026-05-21', inspeccionAgendada: { fecha: '2026-09-15', por: 'R. Quiroga' } });
    expect(diasSinRespuesta(a, HOY)).toBe(111);
    expect(() => agendarInspeccion({ ...a, estado: 'cerrado' }, '2026-09-15', 'R. Quiroga', '')).toThrow();
  });
});

describe('RF18 · puedeCerrar y cerrarReclamo', () => {
  it('sin respaldo no se habilita', () => {
    expect(puedeCerrar({ motivo: 'obra ejecutada', respaldos: [] })).toEqual({
      ok: false,
      errores: ['Hace falta al menos un respaldo. Sin respaldo, el cierre no se habilita.'],
    });
  });

  it('un respaldo sin referencia no cuenta', () => {
    expect(puedeCerrar({ motivo: 'obra ejecutada', respaldos: [{ tipo: 'acta de inspección', referencia: '   ' }] }).ok).toBe(false);
  });

  it('sin motivo no se habilita', () => {
    const v = puedeCerrar({ respaldos: [{ tipo: 'orden de trabajo', referencia: 'OT-1' }] });
    expect(v.ok).toBe(false);
    expect(v.errores).toEqual(['Elegí el motivo del cierre.']);
  });

  it('motivo y al menos un respaldo: se habilita', () => {
    expect(puedeCerrar({ motivo: 'deterioro no constatado', respaldos: [{ tipo: 'acta de inspección', referencia: 'Acta 12' }] }).ok).toBe(true);
  });

  it('cerrar registra quién, cuándo y con qué respaldo, y saca la alerta', () => {
    const c = cerrarReclamo(reclamo({ alerta: true }), CIERRE);
    expect(c).toMatchObject({ estado: 'cerrado', alerta: false, cierre: CIERRE });
    expect(c.historial.at(-1)).toMatchObject({ por: 'M. Ferreyra', tipo: 'cierre' });
  });

  it('cerrar sin respaldo lanza un error y no cambia el reclamo', () => {
    const r = reclamo();
    expect(() => cerrarReclamo(r, { ...CIERRE, respaldos: [] })).toThrow(/respaldo/);
    expect(r.estado).toBe('abierto');
  });

  it('sólo el funcionario a cargo cierra (CU11)', () => {
    expect(rolPuedeCerrar('funcionario')).toBe(true);
    expect(rolPuedeCerrar('tecnico')).toBe(false);
    expect(rolPuedeCerrar('analista')).toBe(false);
  });
});
