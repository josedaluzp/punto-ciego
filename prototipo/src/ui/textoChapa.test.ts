import { describe, expect, it } from 'vitest';
import { CUERPO_MINIMO_CHAPA, ajustarChapa, textoChapa } from './textoChapa';

describe('textoChapa', () => {
  it('abrevia el tipo de vía y pasa el nombre a mayúsculas', () => {
    expect(textoChapa('Av. Vélez Sarsfield')).toEqual({ prefijo: 'AV.', nombre: 'VÉLEZ SARSFIELD' });
    expect(textoChapa('Bv. San Juan')).toEqual({ prefijo: 'BV.', nombre: 'SAN JUAN' });
    expect(textoChapa('Agustín Piaggio')).toEqual({ prefijo: '', nombre: 'AGUSTÍN PIAGGIO' });
  });

  it('quita la altura', () => {
    expect(textoChapa('Av. Colón al 5300')).toEqual({ prefijo: 'AV.', nombre: 'COLÓN' });
  });

  it('con un nombre largo se queda con las últimas palabras, sin empezar por un conector', () => {
    expect(textoChapa('Av. Amadeo Sabattini').nombre).toBe('SABATTINI');
    expect(textoChapa('Av. Monseñor Pablo Cabrera').nombre).toBe('PABLO CABRERA');
    expect(textoChapa('Av. La Voz del Interior').nombre).toBe('INTERIOR');
  });
});

describe('ajustarChapa', () => {
  it('un nombre corto entra entero con el cuerpo pedido', () => {
    expect(ajustarChapa('Av. Colón', 62, 11)).toEqual({ prefijo: 'AV.', nombre: 'COLÓN', fuente: 11, fuentePrefijo: 9, comprimir: false });
  });

  it('un nombre largo deja palabras antes que bajar del cuerpo mínimo', () => {
    const t = ajustarChapa('Av. Vélez Sarsfield', 54, 11);
    expect(t.nombre).toBe('SARSFIELD');
    expect(t.fuente).toBeGreaterThanOrEqual(CUERPO_MINIMO_CHAPA);
  });

  it('una sola palabra que no entra se abrevia con punto', () => {
    const t = ajustarChapa('Av. Circunvalación', 52, 10);
    expect(t.nombre).toMatch(/^CIRCUN.*\.$/);
    expect(t.fuente).toBe(CUERPO_MINIMO_CHAPA);
  });

  it('sin calle lo dice', () => {
    expect(ajustarChapa(undefined, 54, 11).nombre).toBe('SIN CALLE');
  });
});
