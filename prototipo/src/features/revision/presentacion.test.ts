import { describe, expect, it } from 'vitest';
import { semilla } from '../../datos/semilla';
import { cronicaDe, leerKm, motivoBajaConfianza, nombreLugar, partirResaltado, resultadoRevision, resumenMotivo } from './presentacion';

const datos = semilla();
const enRevision = datos.siniestros.filter((s) => s.ubicacion?.estado === 'en-revision');
const por = (t: string) => enRevision.find((s) => s.lugarExtraido?.texto.includes(t))!;

describe('presentación de CU03', () => {
  it('nombra los tres lugares de la Figura 16', () => {
    expect(enRevision.map(nombreLugar).sort()).toEqual(['Av. Circunvalación', 'Barrio Villa El Libertador', 'RN 36, km 790']);
  });

  it('resume el motivo como la Figura 16', () => {
    expect(resumenMotivo(por('Circunvalación'))).toBe('«a la altura de barrio Los Boulevares»');
    expect(resumenMotivo(por('Villa El Libertador'))).toBe('sin calle en el texto');
    expect(resumenMotivo(por('ruta nacional 36'))).toBe('progresiva fuera de la capa');
  });

  it('explica la baja confianza', () => {
    expect(motivoBajaConfianza(por('Circunvalación'))).toMatch(/margen de cientos de metros/);
    expect(motivoBajaConfianza(por('Villa El Libertador'))).toMatch(/centro del barrio/);
    expect(motivoBajaConfianza(por('ruta nacional 36'))).toBe(
      'La capa de postes de la RN 36 va del km 600 al 770: el km 790 no figura. Se propone Río Cuarto, a falta de un poste.',
    );
  });

  it('resalta el lugar extraído dentro de la crónica', () => {
    const s = por('Circunvalación');
    const c = cronicaDe(s, datos.cronicas)!;
    const [antes, lugar, despues] = partirResaltado(c.texto, s);
    expect(lugar).toBe('avenida Circunvalación a la altura de barrio Los Boulevares');
    expect(antes + lugar + despues).toBe(c.texto);
  });

  it('busca el fragmento si las posiciones no coinciden', () => {
    const s = { lugarExtraido: { texto: 'barrio Centro', inicio: 0, fin: 3 } };
    expect(partirResaltado('Choque en barrio Centro anoche', s)).toEqual(['Choque en ', 'barrio Centro', ' anoche']);
  });

  it('lee la decisión registrada', () => {
    const u = por('Circunvalación').ubicacion!;
    expect(resultadoRevision(u)).toBeNull();
    expect(resultadoRevision({ ...u, estado: 'confirmada', revisadaEn: '2026-09-09T10:00:00' })).toBe('confirmada');
    expect(resultadoRevision({ ...u, estado: 'confirmada', metodo: 'manual', revisadaEn: '2026-09-09T10:00:00' })).toBe('corregida');
    expect(resultadoRevision({ ...u, estado: 'descartada', revisadaEn: '2026-09-09T10:00:00' })).toBe('descartada');
  });

  it('lee progresivas con coma o punto', () => {
    expect(leerKm('765,4')).toBe(765.4);
    expect(leerKm('km 700')).toBe(700);
    expect(leerKm('setecientos')).toBeNull();
    expect(leerKm('')).toBeNull();
  });
});
