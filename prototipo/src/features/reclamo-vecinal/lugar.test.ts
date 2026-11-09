import { describe, expect, it } from 'vitest';
import { distanciaMetros } from '../../dominio/geo';
import { DESCRIPCION_MIN, cuadra, describirPunto, ubicarDireccion, validarDescripcion, validarLugar } from './lugar';

describe('lugar del reclamo vecinal', () => {
  it('nombra un punto sobre Av. Colón por su cuadra', () => {
    const l = describirPunto({ lat: -31.395, lon: -64.256 });
    expect(l.lugar).toBe('Av. Colón al 5300');
    expect(l.calle).toBe('Av. Colón');
    expect(l.ambito).toBe('Villa Cabrera');
  });

  it('un punto lejos de toda calle del nomenclador queda como punto marcado', () => {
    const l = describirPunto({ lat: -31.3, lon: -64.05 });
    expect(l.lugar).toBe('Punto marcado en el mapa');
    expect(l.calle).toBeUndefined();
  });

  it('cuadra redondea hacia abajo a la centena', () => {
    expect(cuadra(5347)).toBe(5300);
    expect(cuadra(99)).toBe(0);
  });

  it('ubica calle y altura con el servicio de normalización simulado', () => {
    const r = ubicarDireccion('colon', '5300');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lugar.lugar).toBe('Av. Colón al 5300');
    expect(distanciaMetros(r.lugar, { lat: -31.395, lon: -64.256 })).toBeLessThan(5);
  });

  it('acepta el nombre parcial de la calle', () => {
    const r = ubicarDireccion('Sabattini', '4720');
    expect(r.ok && r.lugar.lugar).toBe('Av. Amadeo Sabattini al 4700');
  });

  it('explica qué falta cuando no puede ubicar', () => {
    expect(ubicarDireccion('', '100')).toMatchObject({ ok: false, campo: 'calle' });
    expect(ubicarDireccion('Calle Inexistente', '100')).toMatchObject({ ok: false, campo: 'calle' });
    expect(ubicarDireccion('Av. Colón', '')).toMatchObject({ ok: false, campo: 'altura' });
    expect(ubicarDireccion('Av. Colón', 'cien')).toMatchObject({ ok: false, campo: 'altura' });
    const fuera = ubicarDireccion('Av. Colón', '9900');
    expect(fuera).toMatchObject({ ok: false, campo: 'altura' });
    expect(!fuera.ok && fuera.error).toContain('del 0 al 6500');
  });

  it('valida lugar obligatorio y descripción mínima', () => {
    expect(validarLugar(null)).toMatch(/Marcá el lugar/);
    expect(validarLugar(describirPunto({ lat: -31.395, lon: -64.256 }))).toBeUndefined();
    expect(validarDescripcion('   ')).toMatch(/Contá qué pasa/);
    expect(validarDescripcion('Pozo')).toMatch(/al menos/);
    expect(validarDescripcion('x'.repeat(DESCRIPCION_MIN))).toBeUndefined();
    expect(validarDescripcion('x'.repeat(501))).toMatch(/hasta 500/);
  });
});
