import { afterEach, describe, expect, it, vi } from 'vitest';
import { almacenamientoNavegador } from './almacenamiento';

describe('almacenamientoNavegador', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin localStorage (pre-render en Node 25+) tira error para que persist quede inactivo', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => almacenamientoNavegador()).toThrow('localStorage no está disponible');
  });

  it('en el navegador devuelve el localStorage', () => {
    const falso = { getItem: () => null } as unknown as Storage;
    vi.stubGlobal('localStorage', falso);
    expect(almacenamientoNavegador()).toBe(falso);
  });
});
