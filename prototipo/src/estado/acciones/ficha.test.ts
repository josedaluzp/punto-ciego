import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CATALOGO_CONTRAMEDIDAS } from '../../datos/contramedidas';
import { USUARIOS } from '../../datos/usuarios';
import { recomendarContramedidas } from '../../dominio/contramedidas';
import { concentracionesDe } from '../selectores';
import { restablecerDatos, useDemo } from '../store';
import { emitirFicha, fichaDeConcentracion, proximoNumeroFicha, puedeEmitirFicha } from './ficha';

vi.spyOn(console, 'warn').mockImplementation(() => {});

const [analista, tecnico, funcionario] = USUARIOS as [(typeof USUARIOS)[0], (typeof USUARIOS)[0], (typeof USUARIOS)[0]];

describe('acciones de la ficha (CU06)', () => {
  beforeEach(() => restablecerDatos());

  it('el próximo número libre de la semilla es FI-2026-0043', () => {
    expect(proximoNumeroFicha(useDemo.getState().fichas)).toBe('FI-2026-0043');
  });

  it('C-0007 ya tiene la ficha FI-2026-0042', () => {
    expect(fichaDeConcentracion(useDemo.getState().fichas, 'C-0007')?.numero).toBe('FI-2026-0042');
  });

  it('emite con número, fecha de la demo, técnico, contramedidas elegidas y evidencia congelada', () => {
    const cs = concentracionesDe(useDemo.getState());
    const c = cs.find((x) => !fichaDeConcentracion(useDemo.getState().fichas, x.id))!;
    const recomendadas = recomendarContramedidas(c, CATALOGO_CONTRAMEDIDAS).map((m) => m.id);
    const f = emitirFicha(c, recomendadas.slice(0, 1), tecnico);
    expect(f.numero).toBe('FI-2026-0043');
    expect(f.fecha.startsWith('2026-09-09T')).toBe(true);
    expect(f.emitidaPor).toBe('R. Quiroga');
    expect(f.contramedidaIds).toEqual(recomendadas.slice(0, 1));
    expect(f.siniestroIds).toEqual(c.siniestroIds);
    expect(f.indice).toBe(c.indice);
    const e = useDemo.getState();
    expect(e.fichas.at(-1)).toEqual(f);
    expect(e.registroConcentraciones[c.clave]).toBe(c.id);
    expect(proximoNumeroFicha(e.fichas)).toBe('FI-2026-0044');
  });

  it('el analista no emite fichas; el técnico y el funcionario sí', () => {
    expect(puedeEmitirFicha(analista)).toBe(false);
    expect(puedeEmitirFicha(tecnico)).toBe(true);
    expect(puedeEmitirFicha(funcionario)).toBe(true);
    const c = concentracionesDe(useDemo.getState())[3]!;
    expect(() => emitirFicha(c, [], analista)).toThrow();
    expect(useDemo.getState().fichas).toHaveLength(3);
  });
});
