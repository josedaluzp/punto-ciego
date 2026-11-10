import { describe, expect, it } from 'vitest';
import vercel from '../../vercel.json';
import { ALIAS_PRERENDERIZADOS, ARCHIVO_SPA, RUTAS_PRERENDERIZADAS, archivoDeRuta } from './prerenderizadas';

/** KT-06b: Vercel sirve cada ruta pre-renderizada con su HTML y el resto con el shell vacío. */
describe('KT-06b · vercel.json y las rutas pre-renderizadas', () => {
  const reescrituras = vercel.rewrites;
  const destinoDe = (ruta: string) => reescrituras.find((r) => r.source === ruta)?.destination;

  it.each([...RUTAS_PRERENDERIZADAS, ...Object.keys(ALIAS_PRERENDERIZADOS)])('%s se sirve con su HTML', (ruta) => {
    expect(destinoDe(ruta)).toBe(`/${archivoDeRuta(ruta)}`);
  });

  it('el resto de las rutas usa el shell vacío, y es la última regla', () => {
    expect(reescrituras.at(-1)).toEqual({ source: '/(.*)', destination: `/${ARCHIVO_SPA}` });
  });

  it('no hay reglas para rutas que no se pre-renderizan', () => {
    const conocidas = new Set<string>([...RUTAS_PRERENDERIZADAS, ...Object.keys(ALIAS_PRERENDERIZADOS), '/(.*)']);
    expect(reescrituras.map((r) => r.source).filter((s) => !conocidas.has(s))).toEqual([]);
  });
});
