/**
 * `test` de Playwright con una espera más: `page.goto` y `page.reload` vuelven
 * cuando la pantalla terminó de hidratarse (`<html data-hidratado>`, ver
 * `src/rutas/Rutas.tsx`). Con el HTML pre-renderizado (KT-06b) la pantalla se
 * ve antes de que React conecte los manejadores; sin esta espera, un clic o
 * un texto escrito en ese intervalo se perdería.
 */
import { test as base, type Page } from '@playwright/test';

export * from '@playwright/test';

/** Hace que `goto` y `reload` de `page` esperen la hidratación. Para páginas creadas a mano (la grabación de la demo). */
export function conEsperaDeHidratacion(page: Page): Page {
  const ir = page.goto.bind(page);
  const recargar = page.reload.bind(page);
  const hidratada = () => page.waitForFunction(() => document.documentElement.hasAttribute('data-hidratado'));
  page.goto = async (...args) => {
    const respuesta = await ir(...args);
    await hidratada();
    return respuesta;
  };
  page.reload = async (...args) => {
    const respuesta = await recargar(...args);
    await hidratada();
    return respuesta;
  };
  return page;
}

export const test = base.extend({
  page: async ({ page }, usar) => {
    await usar(conEsperaDeHidratacion(page));
  },
});
