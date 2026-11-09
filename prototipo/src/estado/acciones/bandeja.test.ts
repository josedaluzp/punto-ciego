import { beforeEach, describe, expect, it, vi } from 'vitest';
import { restablecerDatos, useDemo } from '../store';
import { cambiarUsuario } from './base';
import { agendarInspeccionReclamo, cerrarReclamoFirmado, rolPuedeAgendar } from './bandeja';

vi.spyOn(console, 'warn').mockImplementation(() => {});

const reclamo = (n: string) => useDemo.getState().reclamos.find((r) => r.numero === n)!;

describe('acciones de la bandeja', () => {
  beforeEach(() => {
    restablecerDatos();
    cambiarUsuario('rquiroga');
  });

  it('agendar la inspección pasa a en verificación, registra quién y conserva la fecha de presentación', () => {
    agendarInspeccionReclamo('PN-2026-0131', '2026-09-15');
    const r = reclamo('PN-2026-0131');
    expect(r.estado).toBe('en-verificacion');
    expect(r.fechaPresentacion).toBe('2026-04-16');
    expect(r.inspeccionAgendada).toEqual({ fecha: '2026-09-15', por: 'R. Quiroga' });
    expect(r.historial.at(-1)).toMatchObject({ por: 'R. Quiroga', tipo: 'inspeccion' });
    expect(r.historial.at(-1)!.fecha.startsWith('2026-09-09')).toBe(true);
  });

  it('no agenda para una fecha pasada ni con el analista', () => {
    expect(() => agendarInspeccionReclamo('PN-2026-0131', '2026-09-01')).toThrow(/hoy o una fecha posterior/);
    cambiarUsuario('lahumada');
    expect(() => agendarInspeccionReclamo('PN-2026-0131', '2026-09-15')).toThrow(/técnico/);
    expect(reclamo('PN-2026-0131').estado).toBe('abierto');
    expect(rolPuedeAgendar('funcionario')).toBe(true);
  });

  it('sólo el funcionario cierra (CU11)', () => {
    for (const id of ['lahumada', 'rquiroga']) {
      cambiarUsuario(id);
      expect(() => cerrarReclamoFirmado('PN-2026-0186', 'obra ejecutada', [{ tipo: 'orden de trabajo', referencia: 'OT-1' }])).toThrow(/funcionario/);
    }
    expect(reclamo('PN-2026-0186').estado).toBe('en-verificacion');
  });

  it('sin respaldo no cierra (4.a); con respaldo cierra firmado y sale de la bandeja de alertas', () => {
    cambiarUsuario('mferreyra');
    expect(() => cerrarReclamoFirmado('PN-2026-0186', 'obra ejecutada', [])).toThrow(/al menos un respaldo/);
    expect(() => cerrarReclamoFirmado('PN-2026-0186', 'obra ejecutada', [{ tipo: 'acta de inspección', referencia: '   ' }])).toThrow(/al menos un respaldo/);
    cerrarReclamoFirmado('PN-2026-0186', 'obra ejecutada', [{ tipo: 'orden de trabajo', referencia: ' OT-2026-0912 ' }]);
    const r = reclamo('PN-2026-0186');
    expect(r.estado).toBe('cerrado');
    expect(r.alerta).toBe(false);
    expect(r.cierre).toMatchObject({ motivo: 'obra ejecutada', por: 'M. Ferreyra', respaldos: [{ tipo: 'orden de trabajo', referencia: 'OT-2026-0912' }] });
    expect(r.historial.at(-1)).toMatchObject({ por: 'M. Ferreyra', tipo: 'cierre' });
  });
});
