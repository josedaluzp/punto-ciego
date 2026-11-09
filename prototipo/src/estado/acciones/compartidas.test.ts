import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CRONICAS_DE_EJEMPLO } from '../../datos/semilla';
import { concentracionesDe } from '../selectores';
import { extraerDeCronica } from '../../dominio/extraccion';
import { georreferenciar } from '../../dominio/georreferenciacion';
import type { Siniestro } from '../../dominio/tipos';
import { restablecerDatos, useDemo } from '../store';
import { cambiarUsuario } from './base';
import { fijarNumerosConcentraciones, guardarUbicacion } from './compartidas';

// En Node no hay localStorage: el store funciona en memoria y avisa que no persiste.
vi.spyOn(console, 'warn').mockImplementation(() => {});

function incorporarEjemplo(i: number): Siniestro {
  const ej = CRONICAS_DE_EJEMPLO[i]!;
  const e = extraerDeCronica(ej.texto, ej.fechaPublicacion);
  const s: Siniestro = { id: `S-NUEVO-${i}`, fechaHecho: e.fechaHecho, lugarExtraido: e.lugar, victimas: e.victimas, tipo: e.tipo, cronicaIds: [], ubicacion: null, origen: 'sintetico' };
  useDemo.setState((st) => ({ siniestros: [...st.siniestros, s] }));
  return s;
}

describe('acciones compartidas', () => {
  beforeEach(() => restablecerDatos());

  it('confirmar una ubicación ejecuta CU09: la crónica de Pablo Cabrera alerta PN-2026-0157', () => {
    const s = incorporarEjemplo(1);
    const alertas = guardarUbicacion(s.id, georreferenciar(s.lugarExtraido));
    expect(alertas.map((a) => [a.reclamo, a.tipo])).toEqual([['PN-2026-0157', 'reclamo-desatendido']]);
    const r = useDemo.getState().reclamos.find((x) => x.numero === 'PN-2026-0157')!;
    expect(r.alerta).toBe(true);
    expect(r.siniestrosPosteriores).toEqual([s.id]);
    expect(r.historial.at(-1)?.fecha.startsWith('2026-09-09')).toBe(true);
  });

  it('una ubicación en revisión se guarda sin evaluar reclamos', () => {
    const s = incorporarEjemplo(1);
    const u = { ...georreferenciar(s.lugarExtraido)!, estado: 'en-revision' as const };
    expect(guardarUbicacion(s.id, u)).toEqual([]);
    expect(useDemo.getState().reclamos.find((x) => x.numero === 'PN-2026-0157')!.alerta).toBe(false);
    expect(useDemo.getState().siniestros.find((x) => x.id === s.id)!.ubicacion?.estado).toBe('en-revision');
  });

  it('las concentraciones se recalculan solas al confirmar (CU04)', () => {
    const antes = concentracionesDe(useDemo.getState(), { desde: 2021, hasta: 2026 });
    const s = incorporarEjemplo(0);
    guardarUbicacion(s.id, georreferenciar(s.lugarExtraido));
    const despues = concentracionesDe(useDemo.getState(), { desde: 2021, hasta: 2026 });
    const sabattini = despues.find((c) => c.id === 'C-0019')!;
    expect(sabattini.siniestroIds).toContain(s.id);
    expect(sabattini.siniestroIds.length).toBe(antes.find((c) => c.id === 'C-0019')!.siniestroIds.length + 1);
  });

  it('fijar números conserva el de una concentración nueva', () => {
    const todas = concentracionesDe(useDemo.getState(), { desde: 2021, hasta: 2026 });
    const nuevas = todas.filter((c) => !(c.clave in useDemo.getState().registroConcentraciones));
    expect(nuevas.length).toBeGreaterThan(0);
    fijarNumerosConcentraciones(nuevas);
    for (const c of nuevas) expect(useDemo.getState().registroConcentraciones[c.clave]).toBe(c.id);
  });

  it('restablecer vuelve a la semilla y conserva el usuario', () => {
    cambiarUsuario('mferreyra');
    useDemo.setState({ reclamos: [] });
    restablecerDatos();
    expect(useDemo.getState().reclamos).toHaveLength(32);
    expect(useDemo.getState().usuarioId).toBe('mferreyra');
    expect(() => cambiarUsuario('nadie')).toThrow();
  });
});
