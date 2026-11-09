import { describe, expect, it } from 'vitest';
import { contarPorUsuario, estadoFilaUbicacion, nombreLugar, resumenVictimas } from './textos';

describe('textos de la pantalla de crónicas', () => {
  it('nombra cada tipo de lugar', () => {
    expect(nombreLugar({ texto: '', ruta: 'RN 158', km: 214.6 })).toBe('RN 158, km 214,6');
    expect(nombreLugar({ texto: '', ruta: 'RN 9', km: 694 })).toBe('RN 9, km 694');
    expect(nombreLugar({ texto: '', calle: 'Av. Amadeo Sabattini', altura: 4700 })).toBe('Av. Amadeo Sabattini al 4700');
    expect(nombreLugar({ texto: '', calle: 'Av. Colón', calle2: 'Av. General Paz' })).toBe('Av. Colón y Av. General Paz');
    expect(nombreLugar({ texto: '', barrio: 'Güemes' })).toBe('Barrio Güemes');
    expect(nombreLugar(null)).toBe('Sin lugar reconocible');
  });

  it('cuenta víctimas por tipo de usuario y gravedad', () => {
    const v = [
      { tipoUsuario: 'peaton' as const, gravedad: 'fallecido' as const },
      { tipoUsuario: 'peaton' as const, gravedad: 'fallecido' as const },
      { tipoUsuario: 'conductor' as const, gravedad: 'fallecido' as const },
      { tipoUsuario: 'acompanante' as const, gravedad: 'herido-grave' as const },
    ];
    expect(contarPorUsuario(v, 'fallecido')).toBe('2 peatones y 1 conductor');
    expect(resumenVictimas({ victimas: v })).toEqual({ fatales: '2 peatones y 1 conductor', graves: '1 acompañante', cantidadFatales: 3 });
    expect(contarPorUsuario([], 'fallecido')).toBeNull();
  });

  it('el estado de la ubicación tiñe la fila', () => {
    expect(estadoFilaUbicacion('confirmada')).toBe('confirmado');
    expect(estadoFilaUbicacion('en-revision')).toBe('revision');
    expect(estadoFilaUbicacion('descartada')).toBe('cerrado');
  });
});
