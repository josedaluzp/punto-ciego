import { expect, test as base, type Page } from '@playwright/test';

/**
 * La app sirve el HTML pre-renderizado y React lo hidrata después: hasta que
 * `<html>` lleva `data-hidratado`, un clic o un texto se pierden. Como las e2e
 * del prototipo (prototipo/e2e/fixtures.ts), `goto` y `reload` esperan esa marca.
 */
const test = base.extend({
  page: async ({ page }, usar) => {
    const hidratada = () => page.waitForFunction(() => document.documentElement.hasAttribute('data-hidratado'));
    const ir = page.goto.bind(page);
    const recargar = page.reload.bind(page);
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
    await usar(page);
  },
});

/**
 * La app de Punto Ciego tal como la recibe el evaluador: cada ruta del README y la
 * cadena central completa. Corre contra la URL publicada (proyectos «publicada») o
 * contra un preview del clon (proyectos «local»). Selectores tomados de
 * prototipo/e2e/cadena.spec.ts del repositorio público.
 */

const RUTAS: { ruta: string; titulo: string }[] = [
  { ruta: '/siniestros/cronicas', titulo: 'Siniestros registrados' },
  { ruta: '/siniestros/revision', titulo: 'Ubicaciones en revisión' },
  { ruta: '/priorizacion', titulo: 'Lugares priorizados' },
  { ruta: '/priorizacion/fichas', titulo: 'Fichas emitidas' },
  { ruta: '/reclamo', titulo: 'Reclamo por un lugar peligroso' },
  { ruta: '/reclamos', titulo: 'Bandeja de reclamos desatendidos' },
  { ruta: '/reclamos?vista=todos', titulo: 'Todos los reclamos' },
  { ruta: '/reclamos/PN-2026-0157', titulo: 'Reclamo' },
  { ruta: '/componentes', titulo: 'Catálogo de componentes' },
];

const esMovil = (page: Page) => (page.viewportSize()?.width ?? 1440) < 600;

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(`console: ${m.text()}`);
  });
  page.on('pageerror', (e) => errores.push(`pageerror: ${String(e)}`));
  page.on('response', (r) => {
    if (r.status() >= 400) errores.push(`HTTP ${r.status()} ${r.url()}`);
  });
  return errores;
}

/** Abre el riel (en el teléfono es un menú), corre `f` y lo vuelve a cerrar. */
async function enRiel(page: Page, f: (nav: ReturnType<Page['getByRole']>) => Promise<void>) {
  if (esMovil(page)) await page.getByRole('button', { name: 'Menú' }).click();
  await f(page.getByRole('navigation', { name: 'Paquetes del sistema' }));
  if (esMovil(page) && (await page.getByRole('navigation', { name: 'Paquetes del sistema' }).isVisible())) {
    await page.getByRole('button', { name: 'Menú' }).click();
  }
}

async function conteoRiel(page: Page, entrada: string): Promise<number> {
  let n = NaN;
  await enRiel(page, async (nav) => {
    const texto = (await nav.getByRole('link', { name: new RegExp(`^${entrada}\\s*\\d+$`) }).innerText()).replace(/\s+/g, ' ');
    n = Number(/(\d+)\s*$/.exec(texto)![1]);
  });
  return n;
}

const filas = (page: Page) => page.locator('table[aria-label] tbody tr');
const fila = (page: Page, texto: string) => filas(page).filter({ hasText: texto });

async function sinDesborde(page: Page) {
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde, `desborde horizontal en ${page.url()}`).toBeLessThanOrEqual(0);
}

test.describe('rutas del README', () => {
  for (const { ruta, titulo } of RUTAS) {
    test(`${ruta} carga sin errores y muestra «${titulo}»`, async ({ page }) => {
      const errores = vigilarErrores(page);
      const resp = await page.goto(ruta);
      expect(resp?.status(), `estado HTTP de ${ruta}`).toBe(200);
      await expect(page.locator('main#contenido')).toBeVisible();
      const h1 = page.getByRole('heading', { level: 1 });
      await expect(h1).toHaveText(titulo);
      // En /reclamo (cara pública) el título puede quedar fuera de la vista en el teléfono.
      if (ruta !== '/reclamo') await expect(h1).toBeVisible();
      await expect(page.getByText(/Datos sintéticos/).filter({ visible: true }).first()).toBeVisible();
      await sinDesborde(page);
      expect(errores, errores.join('\n')).toEqual([]);
    });
  }

  test('la raíz redirige a /priorizacion', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/priorizacion$/);
    await expect(page.getByText('38 concentraciones significativas')).toBeVisible();
  });
});

test('cadena central: crónica → alerta PN-2026-0157 → inspección y cierre → ficha FI-2026-0043 → reclamo vecinal', async ({ page }) => {
  const errores = vigilarErrores(page);

  // CU01–CU02 + CU09: incorporar la crónica de ejemplo dispara la alerta de PN-2026-0157.
  await page.goto('/siniestros/cronicas');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  expect(await conteoRiel(page, 'Desatendidos')).toBe(3);
  await page.getByRole('link', { name: 'Incorporar crónica' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Incorporar crónica' })).toBeVisible();
  await page.getByLabel('Cargar una crónica de ejemplo').selectOption({ label: 'Ciclista en Av. Monseñor Pablo Cabrera al 1900' });
  await expect(page.getByRole('heading', { name: 'Lo que extrajo el sistema' })).toBeVisible();
  await page.getByRole('button', { name: 'Incorporar crónica' }).click();
  await expect(page.getByText('Alerta de reclamo desatendido · PN-2026-0157')).toBeVisible();
  await page.getByRole('link', { name: 'Ver la bandeja de reclamos desatendidos' }).click();

  // CU10: la alerta en la bandeja.
  await expect(page).toHaveURL(/\/reclamos$/);
  await expect(page.getByText('4 con alerta · 28 abiertos sin alerta')).toBeVisible();
  await expect(fila(page, 'PN-2026-0157')).toHaveAttribute('data-estado', 'alerta');
  expect(await conteoRiel(page, 'Desatendidos')).toBe(4);
  await fila(page, 'PN-2026-0157').click();
  if (!esMovil(page)) {
    await page.getByRole('region', { name: 'Vista previa de PN-2026-0157' }).getByRole('link', { name: 'Abrir PN-2026-0157' }).click();
  }
  await expect(page).toHaveURL(/\/reclamos\/PN-2026-0157$/);

  // CU10: agendar la inspección (usuario inicial R. Quiroga).
  await page.getByLabel('Fecha de la inspección').fill('2026-09-16');
  await page.getByRole('button', { name: 'Agendar inspección' }).click();
  await expect(page.getByText('PN-2026-0157 pasó a en verificación')).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toHaveText('en verificación');

  // CU11: M. Ferreyra cierra con su firma.
  await page.getByLabel('Usuario de demostración').selectOption({ label: 'M. Ferreyra · Funcionario a cargo' });
  await page.getByRole('radio', { name: 'Obra ejecutada' }).check();
  await page.getByRole('checkbox', { name: 'Número de orden de trabajo' }).check();
  await page.getByLabel('N.º de orden de trabajo').fill('OT-2026-0920');
  await page.getByRole('button', { name: 'Firmar y cerrar' }).click();
  await expect(page.getByText('PN-2026-0157 cerrado')).toBeVisible();
  await expect(page.locator('[data-prueba="resolucion"]')).toContainText('M. Ferreyra · Funcionario a cargo');
  await page.goto('/reclamos?vista=todos');
  await expect(fila(page, 'PN-2026-0157')).toHaveAttribute('data-estado', 'cerrado');

  // CU05 → CU06/CU07: emitir FI-2026-0043 desde Av. Amadeo Sabattini al 4700.
  await page.getByLabel('Usuario de demostración').selectOption({ label: 'R. Quiroga · Técnico de tránsito' });
  await page.goto('/priorizacion');
  await fila(page, 'Av. Amadeo Sabattini al 4700').click();
  await expect(page.locator('#lugar-seleccionado')).toHaveText('Av. Amadeo Sabattini al 4700');
  await page.getByRole('button', { name: 'Emitir ficha de intervención' }).click();
  await expect(page).toHaveURL(/\/priorizacion\/fichas\/nueva\?concentracion=C-\d+$/);
  await expect(page.locator('[data-prueba="acta"]').getByText(/al emitirse,\s*FI-2026-0043/)).toBeVisible();
  await page.getByRole('button', { name: 'Emitir ficha FI-2026-0043' }).click();
  await expect(page).toHaveURL(/\/priorizacion\/fichas\/FI-2026-0043$/);
  await expect(page.getByText('Ficha FI-2026-0043 emitida')).toBeVisible();
  await page.goto('/priorizacion/fichas');
  await expect(
    page.getByRole('table', { name: 'Fichas de intervención emitidas' }).getByRole('row', { name: /FI-2026-0043/ }),
  ).toContainText('Av. Amadeo Sabattini al 4700');

  // CU08: el vecino presenta un reclamo y llega a la bandeja como PN-2026-0205.
  await page.goto('/reclamo');
  await page.getByText('Prefiero escribir la calle y la altura').click();
  await page.getByLabel('Calle').fill('Sabattini');
  await page.getByLabel('Altura').fill('4720');
  await page.getByRole('button', { name: 'Ubicar en el mapa' }).click();
  await expect(page.locator('[data-lugar]')).toHaveText('Av. Amadeo Sabattini al 4700');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByLabel('¿Qué pasa en el lugar?').fill('No hay rampa ni senda en la esquina y los peatones cruzan entre los autos.');
  await page.getByLabel('No soy un programa automático').check();
  await page.getByRole('button', { name: 'Enviar reclamo' }).click();
  await expect(page.locator('[data-numero]')).toHaveText('PN-2026-0205');
  await page.getByRole('link', { name: 'Ver cómo lo recibe el organismo' }).click();
  await expect(page).toHaveURL(/\/reclamos\?vista=todos$/);
  await expect(fila(page, 'PN-2026-0205')).toHaveCount(1);
  await expect(filas(page)).toHaveCount(33);
  await sinDesborde(page);

  expect(errores, errores.join('\n')).toEqual([]);
});
