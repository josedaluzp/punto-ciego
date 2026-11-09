import { describe, expect, it } from 'vitest';
import { buscarDuplicado, cronicaPorUrl, lugaresEquivalentes } from './duplicados';
import { extraerDeCronica } from './extraccion';
import { siniestro } from './prueba-util';
import { jaccard } from './texto';
import type { Cronica } from './tipos';

const T1 =
  'Un motociclista de 24 años murió en la madrugada del sábado tras chocar contra un automóvil en avenida Amadeo Sabattini al 4700, en barrio Empalme. El conductor del automóvil resultó ileso.';
const T2 =
  'Un motociclista de 24 años murió el sábado tras chocar contra un automóvil que giró en avenida Amadeo Sabattini al 4700, en barrio Empalme. El conductor resultó ileso.';
const OTRO = 'Un peatón murió atropellado por un colectivo en Av. Sabattini al 4750 mientras cruzaba la calle con su perro.';

function preparar() {
  const e1 = extraerDeCronica(T1, '2026-09-14');
  const s = siniestro({ fechaHecho: e1.fechaHecho, lugarExtraido: e1.lugar });
  const c: Cronica = { id: 'CR-1', medio: 'Medio', fechaPublicacion: '2026-09-14', url: 'https://medio.example/a', texto: T1, siniestroId: s.id, origen: 'sintetico' };
  return { s, c };
}

describe('RF03 · buscarDuplicado', () => {
  it('misma fecha, mismo lugar y texto semejante: vincula (4.a)', () => {
    const { s, c } = preparar();
    expect(jaccard(T1, T2)).toBeGreaterThanOrEqual(0.35);
    const dup = buscarDuplicado(extraerDeCronica(T2, '2026-09-15'), T2, [s], [c]);
    expect(dup).toMatchObject({ nivel: 'seguro' });
    expect(dup?.siniestro.id).toBe(s.id);
  });

  it('acepta un día de diferencia en la fecha del hecho', () => {
    const { s, c } = preparar();
    const e = { ...extraerDeCronica(T2, '2026-09-15'), fechaHecho: '2026-09-13' };
    expect(buscarDuplicado(e, T2, [s], [c])?.siniestro.id).toBe(s.id);
  });

  it('dos días de diferencia: no es el mismo hecho', () => {
    const { s, c } = preparar();
    const e = { ...extraerDeCronica(T2, '2026-09-15'), fechaHecho: '2026-09-14' };
    expect(buscarDuplicado(e, T2, [s], [c])).toBeNull();
  });

  it('mismo día y lugar pero texto distinto: coincidencia dudosa, decide el analista (4.b)', () => {
    const { s, c } = preparar();
    const e = { ...extraerDeCronica(OTRO, '2026-09-12') };
    expect(jaccard(T1, OTRO)).toBeLessThan(0.35);
    expect(buscarDuplicado(e, OTRO, [s], [c])?.nivel).toBe('dudoso');
  });

  it('otro lugar: no es candidato aunque el texto se parezca', () => {
    const { s, c } = preparar();
    const t = T2.replace('Amadeo Sabattini al 4700', 'Colón al 4700');
    expect(buscarDuplicado(extraerDeCronica(t, '2026-09-15'), t, [s], [c])).toBeNull();
  });
});

describe('RF03 · lugaresEquivalentes', () => {
  it('ruta: misma ruta a menos de un kilómetro', () => {
    expect(lugaresEquivalentes({ texto: '', ruta: 'RN 9', km: 694.3 }, { texto: '', ruta: 'RN 9', km: 695.1 })).toBe(true);
    expect(lugaresEquivalentes({ texto: '', ruta: 'RN 9', km: 694 }, { texto: '', ruta: 'RN 9', km: 696 })).toBe(false);
    expect(lugaresEquivalentes({ texto: '', ruta: 'RN 9', km: 694 }, { texto: '', ruta: 'RN 19', km: 694 })).toBe(false);
  });

  it('calle: misma calle, sin importar prefijo ni tildes, a menos de 200 de altura', () => {
    expect(lugaresEquivalentes({ texto: '', calle: 'Av. Colón', altura: 5300 }, { texto: '', calle: 'avenida Colon', altura: 5450 })).toBe(true);
    expect(lugaresEquivalentes({ texto: '', calle: 'Av. Colón', altura: 5300 }, { texto: '', calle: 'Av. Colón', altura: 5600 })).toBe(false);
  });

  it('intersección: las mismas dos calles en cualquier orden', () => {
    expect(
      lugaresEquivalentes({ texto: '', calle: 'Av. Colón', calle2: 'Av. Sagrada Familia' }, { texto: '', calle: 'Av. Sagrada Familia', calle2: 'Av. Colón' }),
    ).toBe(true);
  });
});

describe('CU01 2.a · dirección web repetida', () => {
  it('reconoce la URL ya incorporada aunque cambie la barra final o las mayúsculas', () => {
    const { c } = preparar();
    expect(cronicaPorUrl('https://MEDIO.example/a/', [c])?.id).toBe('CR-1');
    expect(cronicaPorUrl('https://medio.example/b', [c])).toBeNull();
  });
});
