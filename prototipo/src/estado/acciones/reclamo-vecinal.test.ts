import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ordenarBandeja } from '../../dominio/reclamos';
import { hoy } from '../reloj';
import { restablecerDatos, useDemo } from '../store';
import { presentarReclamo } from './reclamo-vecinal';

// En Node no hay localStorage: el store funciona en memoria y avisa que no persiste.
vi.spyOn(console, 'warn').mockImplementation(() => {});

const DATOS = {
  lat: -31.395,
  lon: -64.256,
  lugar: 'Av. Colón al 5300',
  ambito: 'Villa Cabrera',
  descripcion: '  Pozo grande en el carril derecho, las motos lo esquivan.  ',
};

describe('presentarReclamo (CU08)', () => {
  beforeEach(() => restablecerDatos());

  it('registra PN-2026-0205 abierto, con fecha de hoy y sin alerta', () => {
    const r = presentarReclamo(DATOS);
    expect(r.numero).toBe('PN-2026-0205');
    expect(r.estado).toBe('abierto');
    expect(r.fechaPresentacion).toBe(hoy());
    expect(r.alerta).toBe(false);
    expect(r.descripcion).toBe('Pozo grande en el carril derecho, las motos lo esquivan.');
    expect(r.historial).toEqual([expect.objectContaining({ texto: 'Reclamo presentado', tipo: 'presentacion' })]);
    expect(useDemo.getState().reclamos.at(-1)).toEqual(r);
  });

  it('numera en orden y anota la fotografía en la historia', () => {
    presentarReclamo(DATOS);
    const r = presentarReclamo({ ...DATOS, foto: 'data:image/jpeg;base64,AAAA' });
    expect(r.numero).toBe('PN-2026-0206');
    expect(r.historial[0]!.texto).toBe('Reclamo presentado con fotografía');
  });

  it('no guarda datos personales: sólo lugar, descripción y foto', () => {
    const r = presentarReclamo(DATOS);
    expect(Object.keys(r).sort()).toEqual(
      ['alerta', 'alertas', 'ambito', 'descripcion', 'estado', 'fechaPresentacion', 'foto', 'historial', 'lat', 'lon', 'lugar', 'numero', 'origen', 'siniestrosPosteriores', 'x', 'y'].sort(),
    );
  });

  it('guarda la calle del nomenclador sólo cuando el lugar cae sobre una', () => {
    expect(presentarReclamo({ ...DATOS, calle: 'Av. Colón' }).calle).toBe('Av. Colón');
    expect('calle' in presentarReclamo({ ...DATOS, lugar: 'Punto marcado en el mapa' })).toBe(false);
  });

  it('queda en la bandeja del área técnica', () => {
    presentarReclamo(DATOS);
    expect(ordenarBandeja(useDemo.getState().reclamos, hoy()).map((r) => r.numero)).toContain('PN-2026-0205');
  });
});
