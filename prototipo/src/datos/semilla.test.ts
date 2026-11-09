import { describe, expect, it } from 'vitest';
import { agruparConcentraciones, nombreConcentracion } from '../dominio/concentraciones';
import { buscarDuplicado } from '../dominio/duplicados';
import { extraerDeCronica } from '../dominio/extraccion';
import { anio } from '../dominio/fechas';
import { decimal, porcentaje } from '../dominio/formato';
import { distanciaMetros } from '../dominio/geo';
import { georreferenciar } from '../dominio/georreferenciacion';
import { diasSinRespuesta, evaluarReclamosDesatendidos, ordenarBandeja } from '../dominio/reclamos';
import type { Siniestro } from '../dominio/tipos';
import { CATALOGO_CONTRAMEDIDAS } from './contramedidas';
import { CRONICAS_DE_EJEMPLO, FECHA_DEMO, PERIODO_PREDETERMINADO, generarSemilla } from './semilla';

const datos = generarSemilla();
const enPeriodo = datos.siniestros.filter(
  (s) => anio(s.fechaHecho) >= PERIODO_PREDETERMINADO.desde && anio(s.fechaHecho) <= PERIODO_PREDETERMINADO.hasta,
);
const concentraciones = agruparConcentraciones(enPeriodo, datos.registroConcentraciones);

describe('Semilla · determinismo', () => {
  it('dos generaciones dan exactamente los mismos datos', () => {
    expect(generarSemilla()).toEqual(datos);
  });

  it('todo es sintético salvo el caso documentado de Agustín Piaggio', () => {
    expect(datos.siniestros.every((s) => s.origen === 'sintetico')).toBe(true);
    expect(datos.cronicas.every((c) => c.origen === 'sintetico' && c.url.includes('.example/'))).toBe(true);
    expect(datos.reclamos.filter((r) => r.origen === 'real').map((r) => r.lugar)).toEqual(['Agustín Piaggio al 1000']);
  });

  it('cada crónica vuelve a leerse igual que el siniestro que la originó', () => {
    const porId = new Map(datos.siniestros.map((s) => [s.id, s]));
    for (const c of datos.cronicas) {
      const s = porId.get(c.siniestroId)!;
      const e = extraerDeCronica(c.texto, c.fechaPublicacion);
      expect(e.fechaHecho, c.texto).toBe(s.fechaHecho);
      expect(e.victimas, c.texto).toEqual(s.victimas);
      expect(e.tipo, c.texto).toBe(s.tipo);
    }
  });

  it('las crónicas repetidas de un mismo hecho se reconocen como duplicadas (RF03)', () => {
    const conDos = datos.siniestros.filter((s) => s.cronicaIds.length > 1);
    expect(conDos.length).toBeGreaterThan(20);
    for (const s of conDos) {
      const segunda = datos.cronicas.find((c) => c.id === s.cronicaIds[1])!;
      const e = extraerDeCronica(segunda.texto, segunda.fechaPublicacion);
      const otros = datos.siniestros;
      const primeras = datos.cronicas.filter((c) => c.id !== segunda.id);
      const dup = buscarDuplicado(e, segunda.texto, otros, primeras);
      expect(dup?.siniestro.id, segunda.texto).toBe(s.id);
      expect(dup?.nivel).toBe('seguro');
    }
  });
});

describe('Semilla · Figura 17, lugares priorizados', () => {
  it('hay 38 concentraciones significativas en 2021–2025', () => {
    expect(concentraciones).toHaveLength(38);
    expect(concentraciones.every((c) => c.pValor < 0.05 && c.siniestroIds.length >= 2)).toBe(true);
  });

  it('las seis primeras reproducen la tabla de la figura', () => {
    const filas = concentraciones.slice(0, 6).map((c) => [
      c.id,
      nombreConcentracion(c),
      c.unidad,
      c.fallecidos,
      porcentaje(c.vulnerables),
      decimal(c.indice),
      c.tipoPredominante,
      c.localidad,
    ]);
    expect(filas).toEqual([
      ['C-0007', 'RN 9 · km 694 a 695', 'tramo', 5, '80 %', '0,91', 'salida de calzada', 'Jesús María'],
      ['C-0012', 'Av. Vélez Sarsfield al 1200', 'punto', 4, '100 %', '0,88', 'atropello de peatón', 'Córdoba'],
      ['C-0003', 'RN 19 · km 312 a 313', 'tramo', 4, '50 %', '0,79', 'choque frontal', 'San Francisco'],
      ['C-0019', 'Av. Amadeo Sabattini al 4700', 'punto', 3, '100 %', '0,74', 'choque en giro', 'Córdoba'],
      ['C-0021', 'RN 158 · km 170 a 171', 'tramo', 3, '33 %', '0,66', 'choque frontal', 'Villa María'],
      ['C-0025', 'Av. Colón al 5300', 'punto', 2, '100 %', '0,61', 'caída de motociclista', 'Córdoba'],
    ]);
  });

  it('el resto queda por debajo de la sexta', () => {
    expect(concentraciones.slice(6).every((c) => c.indice < concentraciones[5]!.indice - 0.005)).toBe(true);
  });

  it('las concentraciones salen del cálculo, no de valores fijados: cada número del registro corresponde a una clave calculada', () => {
    const recalculadas = agruparConcentraciones(enPeriodo);
    expect(new Set(recalculadas.map((c) => c.clave))).toEqual(new Set(Object.keys(datos.registroConcentraciones)));
  });

  it('ningún siniestro en revisión interviene en el cálculo (RF08)', () => {
    const enRevision = new Set(datos.siniestros.filter((s) => s.ubicacion?.estado !== 'confirmada').map((s) => s.id));
    expect(enRevision.size).toBe(3);
    expect(concentraciones.flatMap((c) => c.siniestroIds).some((id) => enRevision.has(id))).toBe(false);
  });
});

describe('Semilla · Figura 18, ficha FI-2026-0042', () => {
  const ficha = datos.fichas.find((f) => f.numero === 'FI-2026-0042')!;
  const c = concentraciones.find((x) => x.id === ficha.concentracionId)!;
  const sins = c.siniestroIds.map((id) => datos.siniestros.find((s) => s.id === id)!);

  it('corresponde a RN 9 km 694 a 695, rango 1 de 38, departamento Colón', () => {
    expect(nombreConcentracion(c)).toBe('RN 9 · km 694 a 695');
    expect(concentraciones.indexOf(c)).toBe(0);
    expect(c.departamento).toBe('Colón');
  });

  it('reúne los cuatro siniestros de la figura con su mes y su progresiva', () => {
    const filas = sins.map((s) => [s.fechaHecho.slice(0, 7), s.tipo, s.ubicacion!.km, s.ubicacion!.metodo]);
    expect(filas).toEqual([
      ['2022-03', 'salida de calzada', 694.3, 'poste'],
      ['2023-11', 'salida de calzada', 694.8, 'poste'],
      ['2024-06', 'choque frontal', 694.6, 'poste'],
      ['2025-01', 'salida de calzada', 694.1, 'poste'],
    ]);
  });

  it('caracteriza la vía: calzada simple de dos carriles, sin banquina pavimentada', () => {
    expect(c.via).toEqual({ calzada: 'simple', carriles: 2, banquina: 'sin pavimentar' });
    expect(c.cantidadPredominante).toBe(3);
  });

  it('recomienda las tres contramedidas en orden de factor', () => {
    const cms = ficha.contramedidaIds.map((id) => CATALOGO_CONTRAMEDIDAS.find((m) => m.id === id)!);
    expect(cms.map((m) => [m.nombre, m.factor])).toEqual([
      ['Bandas sonoras en el borde de calzada', 0.72],
      ['Pavimentación de banquina', 0.81],
      ['Demarcación de bordes de alta visibilidad', 0.88],
    ]);
  });
});

describe('Semilla · Figura 16, ubicaciones en revisión', () => {
  it('son las tres de la figura con su precisión y su confianza', () => {
    const rev = datos.siniestros
      .filter((s) => s.ubicacion?.estado === 'en-revision')
      .map((s) => [s.lugarExtraido?.calle ?? s.lugarExtraido?.barrio ?? s.lugarExtraido?.ruta, s.ubicacion!.precision, decimal(s.ubicacion!.confianza)]);
    expect(rev).toEqual(
      expect.arrayContaining([
        ['Av. Circunvalación', 'corredor', '0,41'],
        ['Villa El Libertador', 'barrio', '0,22'],
        ['RN 36', 'ruta-progresiva', '0,55'],
      ]),
    );
    expect(rev).toHaveLength(3);
  });
});

describe('Semilla · Figuras 20 y 21, bandeja de reclamos', () => {
  const bandeja = ordenarBandeja(datos.reclamos, FECHA_DEMO);

  it('3 con alerta y 29 abiertos sin alerta', () => {
    expect(datos.reclamos).toHaveLength(32);
    expect(bandeja.filter((r) => r.alerta)).toHaveLength(3);
    expect(bandeja.filter((r) => !r.alerta)).toHaveLength(29);
  });

  it('el orden y las cifras de las primeras filas coinciden con la figura', () => {
    const filas = bandeja.slice(0, 4).map((r) => [r.numero, r.lugar, diasSinRespuesta(r, FECHA_DEMO), r.siniestrosPosteriores.length, r.alertas.at(-1)?.tipo ?? null, r.estado]);
    expect(filas).toEqual([
      ['PN-2026-0131', 'Av. Rafael Núñez al 2200', 146, 2, 'reclamo-desatendido', 'abierto'],
      ['PN-2026-0186', 'Av. Colón al 5300', 111, 1, 'reclamo-desatendido', 'en-verificacion'],
      ['PN-2026-0204', 'RN 36 · km 612', 64, 1, 'cierre-desmentido', 'reabierto'],
      ['PN-2026-0157', 'Av. Monseñor Pablo Cabrera al 1900', 92, 0, null, 'abierto'],
    ]);
  });

  it('PN-2026-0186: siniestro del 02/08 de un motociclista herido de gravedad, a menos de 50 m', () => {
    const r = datos.reclamos.find((x) => x.numero === 'PN-2026-0186')!;
    const s = datos.siniestros.find((x) => x.id === r.siniestrosPosteriores[0])!;
    expect(s.fechaHecho).toBe('2026-08-02');
    expect(s.victimas).toEqual([{ tipoUsuario: 'motociclista', gravedad: 'herido-grave' }]);
    expect(distanciaMetros(s.ubicacion!, r)).toBeLessThan(50);
    expect(r.fechaPresentacion).toBe('2026-05-21');
    expect(r.inspeccionAgendada?.por).toBe('R. Quiroga');
  });

  it('PN-2026-0204: reabierto por un siniestro posterior al cierre, sin cambiar la fecha de presentación', () => {
    const r = datos.reclamos.find((x) => x.numero === 'PN-2026-0204')!;
    expect(r.fechaPresentacion).toBe('2026-07-07');
    expect(r.cierre).toBeUndefined();
    expect(r.cierresDesmentidos?.[0]?.motivo).toBe('obra ejecutada');
  });

  it('el caso documentado no tiene fecha de inicio ni alerta', () => {
    const r = datos.reclamos.find((x) => x.origen === 'real')!;
    expect(diasSinRespuesta(r, FECHA_DEMO)).toBeNull();
    expect(r.alerta).toBe(false);
    expect(r.evidencia?.medio).toContain('Cadena 3');
  });
});

describe('Semilla · crónicas de ejemplo para CU01', () => {
  const nueva = (i: number): Siniestro => {
    const ej = CRONICAS_DE_EJEMPLO[i]!;
    const e = extraerDeCronica(ej.texto, ej.fechaPublicacion);
    return { id: `NUEVO-${i}`, fechaHecho: e.fechaHecho, lugarExtraido: e.lugar, victimas: e.victimas, tipo: e.tipo, cronicaIds: [], ubicacion: georreferenciar(e.lugar), origen: 'sintetico' };
  };

  it('la de Sabattini se confirma con 0,86 por normalización y no dispara alertas', () => {
    const s = nueva(0);
    expect(s.ubicacion).toMatchObject({ metodo: 'normalizacion', precision: 'cuadra', confianza: 0.86, estado: 'confirmada' });
    expect(s.fechaHecho).toBe('2026-09-05');
    expect(evaluarReclamosDesatendidos(s, datos.reclamos).alertas).toEqual([]);
    expect(buscarDuplicado(extraerDeCronica(CRONICAS_DE_EJEMPLO[0]!.texto, '2026-09-08'), CRONICAS_DE_EJEMPLO[0]!.texto, datos.siniestros, datos.cronicas)).toBeNull();
  });

  it('la de Pablo Cabrera dispara la alerta de PN-2026-0157 en vivo', () => {
    const s = nueva(1);
    const r = evaluarReclamosDesatendidos(s, datos.reclamos);
    expect(r.alertas.map((a) => [a.reclamo, a.tipo])).toEqual([['PN-2026-0157', 'reclamo-desatendido']]);
    const actualizado = r.reclamos.find((x) => x.numero === 'PN-2026-0157')!;
    expect(ordenarBandeja(r.reclamos, FECHA_DEMO).indexOf(actualizado)).toBeLessThan(4);
  });

  it('la de la RN 158 se ubica por poste kilométrico', () => {
    expect(nueva(2).ubicacion).toMatchObject({ metodo: 'poste', ruta: 'RN 158', km: 214.6, estado: 'confirmada' });
  });

  it('la segunda crónica de Sabattini se vincula a la primera', () => {
    const primera = nueva(0);
    const ej = CRONICAS_DE_EJEMPLO[3]!;
    const cr = { id: 'X', medio: '', fechaPublicacion: '2026-09-08', url: '', texto: CRONICAS_DE_EJEMPLO[0]!.texto, siniestroId: primera.id, origen: 'sintetico' as const };
    const dup = buscarDuplicado(extraerDeCronica(ej.texto, ej.fechaPublicacion), ej.texto, [primera], [cr]);
    expect(dup?.siniestro.id).toBe(primera.id);
    expect(dup?.nivel).toBe('seguro');
  });
});
