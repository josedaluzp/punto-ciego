import { describe, expect, it, vi } from 'vitest';
import {
  CONFIANZA,
  SERVICIOS_SIMULADOS,
  UMBRAL_CONFIANZA,
  clasificarPrecision,
  estadoPorConfianza,
  georreferenciar,
  intervieneEnCalculos,
  revisarUbicacion,
  type ServiciosGeo,
} from './georreferenciacion';
import { distanciaMetros } from './geo';
import { coberturaPostes, posicionPorProgresiva, progresivaMasCercana } from './postes';

/** Servicios con un espía sobre el servicio de normalización. */
function espiar(): { servicios: ServiciosGeo; normalizar: ReturnType<typeof vi.fn> } {
  const normalizar = vi.fn(SERVICIOS_SIMULADOS.normalizacion.normalizar);
  return { servicios: { ...SERVICIOS_SIMULADOS, normalizacion: { normalizar } }, normalizar };
}

describe('RF04 · clasificarPrecision', () => {
  it.each([
    [{ texto: '', calle: 'Av. Colón', altura: 5300 }, 'cuadra'],
    [{ texto: '', calle: 'Av. Colón', calle2: 'Av. Sagrada Familia' }, 'interseccion'],
    [{ texto: '', ruta: 'RN 9', km: 694 }, 'ruta-progresiva'],
    [{ texto: '', ruta: 'RN 9' }, 'corredor'],
    [{ texto: '', calle: 'Av. Circunvalación', barrio: 'Los Boulevares' }, 'corredor'],
    [{ texto: '', barrio: 'Villa El Libertador' }, 'barrio'],
  ] as const)('%o → %s', (lugar, esperado) => {
    expect(clasificarPrecision(lugar)).toBe(esperado);
  });

  it('sin lugar no hay precisión', () => {
    expect(clasificarPrecision(null)).toBeNull();
  });
});

describe('RF05 · calle e intersección por el servicio de normalización', () => {
  it('calle y altura: método normalización, confianza 0,86, confirmada', () => {
    const { servicios, normalizar } = espiar();
    const u = georreferenciar({ texto: '', calle: 'Av. Amadeo Sabattini', altura: 4700 }, servicios)!;
    expect(normalizar).toHaveBeenCalledTimes(1);
    expect(u).toMatchObject({ metodo: 'normalizacion', precision: 'cuadra', confianza: 0.86, estado: 'confirmada' });
    expect(u.nomenclatura).toContain('Av. Amadeo Sabattini 4700');
  });

  it('las alturas se interpolan: cien de altura son unos cien metros', () => {
    const a = georreferenciar({ texto: '', calle: 'Av. Vélez Sarsfield', altura: 1200 })!;
    const b = georreferenciar({ texto: '', calle: 'Av. Vélez Sarsfield', altura: 1300 })!;
    expect(distanciaMetros(a, b)).toBeGreaterThan(70);
    expect(distanciaMetros(a, b)).toBeLessThan(130);
  });

  it('intersección: el cruce de las dos poligonales', () => {
    const u = georreferenciar({ texto: '', calle: 'Av. Colón', calle2: 'Av. Sagrada Familia' })!;
    expect(u).toMatchObject({ metodo: 'normalizacion', precision: 'interseccion', confianza: CONFIANZA.interseccion });
  });

  it('el nombre se reconoce sin prefijo ni tildes', () => {
    expect(georreferenciar({ texto: '', calle: 'Sabattini', altura: 4700 })?.confianza).toBe(0.86);
    expect(georreferenciar({ texto: '', calle: 'Avenida Velez Sarsfield', altura: 1200 })?.confianza).toBe(0.86);
  });

  it('altura fuera del rango conocido: extrapolada y en revisión', () => {
    const u = georreferenciar({ texto: '', calle: 'Av. Colón', altura: 6800 })!;
    expect(u.confianza).toBe(CONFIANZA.cuadraExtrapolada);
    expect(u.estado).toBe('en-revision');
  });

  it('calle desconocida: centro de la localidad con confianza mínima', () => {
    const u = georreferenciar({ texto: '', calle: 'Calle Inventada', altura: 100 })!;
    expect(u).toMatchObject({ metodo: 'localidad', confianza: CONFIANZA.localidad, estado: 'en-revision' });
  });
});

describe('RF06 · rutas por la capa de postes, nunca por el servicio de normalización', () => {
  it('progresiva en la capa: método poste, sin consultar el servicio', () => {
    const { servicios, normalizar } = espiar();
    const u = georreferenciar({ texto: '', ruta: 'RN 9', km: 694.3 }, servicios)!;
    expect(normalizar).not.toHaveBeenCalled();
    expect(u).toMatchObject({ metodo: 'poste', precision: 'ruta-progresiva', ruta: 'RN 9', km: 694.3, confianza: CONFIANZA.poste, estado: 'confirmada' });
  });

  it('progresiva fuera de la capa (CU02 2.b): localidad con confianza baja, tampoco consulta el servicio', () => {
    const { servicios, normalizar } = espiar();
    const u = georreferenciar({ texto: '', ruta: 'RN 36', km: 790 }, servicios)!;
    expect(normalizar).not.toHaveBeenCalled();
    expect(u).toMatchObject({ metodo: 'localidad', confianza: 0.55, estado: 'en-revision' });
    expect(u.nomenclatura).toContain('Río Cuarto');
  });

  it('ruta sin postes cargados: localidad mencionada, sin consultar el servicio', () => {
    const { servicios, normalizar } = espiar();
    const u = georreferenciar({ texto: '', ruta: 'RP 5', km: 30, localidad: 'Alta Gracia' }, servicios)!;
    expect(normalizar).not.toHaveBeenCalled();
    expect(u.metodo).toBe('localidad');
    expect(u.nomenclatura).toContain('Alta Gracia');
  });

  it('ninguna ruta de la capa consulta el servicio, en ninguna progresiva', () => {
    const { servicios, normalizar } = espiar();
    for (const ruta of ['RN 9', 'RN 19', 'RN 158', 'RN 36', 'RN 38', 'RN 8', 'RN 35']) {
      const c = coberturaPostes(ruta)!;
      for (let km = c.desde - 5; km <= c.hasta + 5; km += 7) georreferenciar({ texto: '', ruta, km }, servicios);
    }
    expect(normalizar).not.toHaveBeenCalled();
  });

  it('una progresiva con decimales se interpola entre los dos postes', () => {
    const a = posicionPorProgresiva('RN 9', 694)!;
    const b = posicionPorProgresiva('RN 9', 695)!;
    const m = posicionPorProgresiva('RN 9', 694.5)!;
    expect(Math.abs(distanciaMetros(a, m) - distanciaMetros(m, b))).toBeLessThan(5);
    expect(progresivaMasCercana('RN 9', m)?.km).toBe(694.5);
  });
});

describe('RF07 y RF08 · método, confianza y umbral', () => {
  it('el umbral es 0,70', () => {
    expect(UMBRAL_CONFIANZA).toBe(0.7);
  });

  it('por debajo del umbral queda en revisión; en el umbral o por encima, confirmada', () => {
    expect(estadoPorConfianza(0.69)).toBe('en-revision');
    expect(estadoPorConfianza(0.7)).toBe('confirmada');
    expect(estadoPorConfianza(0.93)).toBe('confirmada');
  });

  it('corredor 0,41 y barrio 0,22 quedan en revisión (Figura 16)', () => {
    const corredor = georreferenciar({ texto: '', calle: 'Av. Circunvalación', barrio: 'Los Boulevares' })!;
    const barrio = georreferenciar({ texto: '', barrio: 'Villa El Libertador' })!;
    expect([corredor.confianza, corredor.estado]).toEqual([0.41, 'en-revision']);
    expect([barrio.confianza, barrio.estado]).toEqual([0.22, 'en-revision']);
  });

  it('sólo una ubicación confirmada interviene en los cálculos', () => {
    const u = georreferenciar({ texto: '', barrio: 'Villa El Libertador' })!;
    expect(intervieneEnCalculos(u)).toBe(false);
    expect(intervieneEnCalculos(null)).toBe(false);
    expect(intervieneEnCalculos({ ...u, estado: 'descartada' })).toBe(false);
    expect(intervieneEnCalculos({ ...u, estado: 'confirmada' })).toBe(true);
  });

  it('toda ubicación tiene método y confianza entre 0 y 1', () => {
    for (const l of [
      { texto: '', calle: 'Av. Colón', altura: 1000 },
      { texto: '', ruta: 'RN 19', km: 200 },
      { texto: '', barrio: 'Centro' },
      { texto: '', ruta: 'RN 36', km: 900 },
    ]) {
      const u = georreferenciar(l)!;
      expect(['normalizacion', 'poste', 'localidad', 'manual']).toContain(u.metodo);
      expect(u.confianza).toBeGreaterThanOrEqual(0);
      expect(u.confianza).toBeLessThanOrEqual(1);
    }
  });
});

describe('RF09 · revisarUbicacion', () => {
  const base = georreferenciar({ texto: '', calle: 'Av. Circunvalación', barrio: 'Los Boulevares' })!;

  it('corregir sobre el mapa: método manual, confianza 1, confirmada, con quién y cuándo', () => {
    const u = revisarUbicacion(base, { accion: 'corregir', lat: -31.3566, lon: -64.1668 }, 'L. Ahumada', '2026-09-09T10:00:00');
    expect(u).toMatchObject({ metodo: 'manual', confianza: 1, estado: 'confirmada', revisadaPor: 'L. Ahumada', revisadaEn: '2026-09-09T10:00:00', lat: -31.3566 });
  });

  it('confirmar sin mover conserva método y confianza', () => {
    const u = revisarUbicacion(base, { accion: 'confirmar' }, 'L. Ahumada', '2026-09-09T10:00:00');
    expect(u).toMatchObject({ metodo: 'normalizacion', confianza: 0.41, estado: 'confirmada' });
  });

  it('descartar deja la ubicación fuera de todo cálculo', () => {
    const u = revisarUbicacion(base, { accion: 'descartar' }, 'L. Ahumada', '2026-09-09T10:00:00');
    expect(u.estado).toBe('descartada');
    expect(intervieneEnCalculos(u)).toBe(false);
  });
});
