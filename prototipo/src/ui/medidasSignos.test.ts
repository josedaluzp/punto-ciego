import { describe, expect, it } from 'vitest';
import { enPantalla, medidasEscudo, medidasRombo, PISO_PRINCIPAL, PISO_SECUNDARIO } from './medidasSignos';
import { ajustarChapa } from './textoChapa';

/**
 * KT-09 del reporte k0lmenIA: piso de legibilidad de los textos de los signos
 * en las listas del teléfono. Rótulo secundario ("RUTA NAC.", "AV.") de 9 px o
 * más; número o nombre principal de 11 px o más.
 */

/** Tamaños de escudo y chapa que usan las listas (28 a 48 px). */
const TAMANOS_LISTA = [28, 30, 32, 34, 36, 40, 48];

describe('KT-09 · escudo de ruta', () => {
  it.each(TAMANOS_LISTA)('a tamaño %i, "RUTA NAC." y el número se leen', (tamano) => {
    for (const numero of ['9', '36', '158']) {
      const m = medidasEscudo(tamano, numero);
      expect(enPantalla(m.rotulo, m.px)).toBeGreaterThanOrEqual(PISO_SECUNDARIO);
      expect(enPantalla(m.cifra, m.px)).toBeGreaterThanOrEqual(PISO_PRINCIPAL);
    }
  });
});

describe('KT-09 · chapa de calle', () => {
  // Ancho y alto como en ChapaCalle: base mínima de 34 px, ancho × 1,75 y alto × 0,66.
  const chapa = (tamano: number, calle: string) => {
    const base = Math.max(tamano, 34);
    const ancho = Math.round(base * 1.75);
    const alto = Math.round(base * 0.66);
    return ajustarChapa(calle, ancho - 8, Math.min(12, alto * 0.5));
  };

  it.each(TAMANOS_LISTA)('a tamaño %i, el prefijo y el nombre se leen', (tamano) => {
    for (const calle of ['Av. Colón', 'Av. Circunvalación', 'Av. Monseñor Pablo Cabrera', 'Bv. San Juan', 'Agustín Piaggio']) {
      const t = chapa(tamano, calle);
      expect(t.fuente, calle).toBeGreaterThanOrEqual(PISO_PRINCIPAL);
      if (t.prefijo) expect(t.fuentePrefijo, calle).toBeGreaterThanOrEqual(PISO_SECUNDARIO);
    }
  });
});

describe('KT-09 · rombo de índice', () => {
  it.each(['chico', 'normal', 'grande'] as const)('el índice del rombo %s se lee', (tamano) => {
    const m = medidasRombo(tamano);
    expect(enPantalla(m.cifra, m.px)).toBeGreaterThanOrEqual(PISO_PRINCIPAL);
  });
});
