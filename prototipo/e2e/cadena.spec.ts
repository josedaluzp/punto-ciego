import { expect, test, type Page } from './fixtures';

/**
 * Recorrido de la cadena central de la demo, de punta a punta y con el estado
 * acumulado de un solo navegador:
 * crónica de Pablo Cabrera (CU01–CU02) → alerta de PN-2026-0157 (CU09) →
 * inspección agendada y cierre firmado por M. Ferreyra (CU10–CU11) →
 * ubicación revisada que entra en la priorización (CU03–CU04) → ficha
 * FI-2026-0043 emitida desde un lugar sin ficha (CU05–CU07) → reclamo del
 * vecino PN-2026-0205 (CU08) → restablecer vuelve a la semilla.
 *
 * Necesita las seis features. Mientras alguna pantalla siga siendo el
 * marcador provisorio de la base, la prueba se salta (ver `antesDeEmpezar`).
 */

const CLAVE = 'punto-ciego:v1';
const esMovil = (page: Page) => (page.viewportSize()?.width ?? 1440) < 600;

/** Pantallas de la cadena; si alguna muestra el marcador de la base, falta su feature. */
const PANTALLAS = ['/siniestros/cronicas', '/siniestros/revision', '/priorizacion', '/priorizacion/fichas', '/reclamos', '/reclamos/PN-2026-0157', '/reclamo'];

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(String(e)));
  return errores;
}

async function faltanFeatures(page: Page): Promise<string[]> {
  const faltan: string[] = [];
  for (const ruta of PANTALLAS) {
    await page.goto(ruta);
    await expect(page.locator('main#contenido, main').first()).toBeVisible();
    if ((await page.locator('#marcador-titulo').count()) > 0) faltan.push(ruta);
  }
  return faltan;
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

test('cadena central completa, de la crónica a la ficha y al reclamo del vecino', async ({ page }) => {
  test.setTimeout(150_000);
  const faltan = await faltanFeatures(page);
  test.skip(faltan.length > 0, `faltan las features de: ${faltan.join(', ')}`);
  await page.evaluate(() => localStorage.clear());
  const errores = vigilarErrores(page);

  // ── CU01–CU02: la crónica de Pablo Cabrera confirma su ubicación y CU09 alerta PN-2026-0157.
  await page.goto('/siniestros/cronicas');
  expect(await conteoRiel(page, 'Desatendidos')).toBe(3);
  await page.getByRole('link', { name: 'Incorporar crónica' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Incorporar crónica' })).toBeVisible();
  await page.getByLabel('Cargar una crónica de ejemplo').selectOption({ label: 'Ciclista en Av. Monseñor Pablo Cabrera al 1900' });
  await expect(page.getByRole('heading', { name: 'Lo que extrajo el sistema' })).toBeVisible();
  await page.getByRole('button', { name: 'Incorporar crónica' }).click();
  await expect(page.getByText('Alerta de reclamo desatendido · PN-2026-0157')).toBeVisible();
  await sinDesborde(page);
  await page.getByRole('link', { name: 'Ver la bandeja de reclamos desatendidos' }).click();

  // ── CU10: la alerta aparece en la bandeja y el riel coincide con lo que se ve.
  await expect(page).toHaveURL(/\/reclamos$/);
  await expect(page.getByText('4 con alerta · 28 abiertos sin alerta')).toBeVisible();
  await expect(fila(page, 'PN-2026-0157')).toHaveAttribute('data-estado', 'alerta');
  await expect(filas(page)).toHaveCount(32);
  expect(await conteoRiel(page, 'Desatendidos')).toBe(4);
  expect(await conteoRiel(page, 'Todos')).toBe(32);
  await fila(page, 'PN-2026-0157').click();
  if (!esMovil(page)) await page.getByRole('region', { name: 'Vista previa de PN-2026-0157' }).getByRole('link', { name: 'Abrir PN-2026-0157' }).click();
  await expect(page).toHaveURL(/\/reclamos\/PN-2026-0157$/);

  // ── CU10: agendar la inspección.
  await page.getByLabel('Fecha de la inspección').fill('2026-09-16');
  await page.getByRole('button', { name: 'Agendar inspección' }).click();
  await expect(page.getByText('PN-2026-0157 pasó a en verificación')).toBeVisible();
  await expect(page.locator('[aria-current="step"]')).toHaveText('en verificación');

  // ── CU11: M. Ferreyra cierra con respaldo.
  await page.getByLabel('Usuario de demostración').selectOption({ label: 'M. Ferreyra · Funcionario a cargo' });
  await page.getByRole('radio', { name: 'Obra ejecutada' }).check();
  await page.getByRole('checkbox', { name: 'Número de orden de trabajo' }).check();
  await page.getByLabel('N.º de orden de trabajo').fill('OT-2026-0920');
  await page.getByRole('button', { name: 'Firmar y cerrar' }).click();
  await expect(page.getByText('PN-2026-0157 cerrado')).toBeVisible();
  await expect(page.locator('[data-prueba="resolucion"]')).toContainText('M. Ferreyra · Funcionario a cargo');
  await sinDesborde(page);

  // Riel y vistas coherentes: «Desatendidos» = filas con alerta de la vista por defecto; «Todos» = ?vista=todos.
  await page.goto('/reclamos');
  await expect(page.getByText('3 con alerta · 28 abiertos sin alerta')).toBeVisible();
  await expect(fila(page, 'PN-2026-0157')).toHaveCount(0);
  await expect(filas(page).and(page.locator('[data-estado="alerta"]'))).toHaveCount(3);
  expect(await conteoRiel(page, 'Desatendidos')).toBe(3);
  await page.goto('/reclamos?vista=todos');
  await expect(filas(page)).toHaveCount(32);
  await expect(fila(page, 'PN-2026-0157')).toHaveAttribute('data-estado', 'cerrado');
  expect(await conteoRiel(page, 'Todos')).toBe(32);

  // ── CU03: revisar la ubicación de RN 36 km 790 por progresiva; entra en la priorización (CU04).
  await page.getByLabel('Usuario de demostración').selectOption({ label: 'R. Quiroga · Técnico de tránsito' });
  await page.goto('/siniestros/revision');
  expect(await conteoRiel(page, 'En revisión')).toBe(3);
  await page.getByRole('region', { name: 'Ubicaciones pendientes de revisión' }).getByRole('button', { name: /RN 36, km 790/ }).click();
  await page.getByLabel('Progresiva (km)').fill('700,5');
  await page.getByRole('button', { name: 'Ubicar en el km' }).click();
  await page.getByRole('button', { name: 'Confirmar posición corregida' }).click();
  const resultado = page.locator('[data-prueba="resultado"]');
  await expect(resultado).toContainText('integra la concentración C-0031 · RN 36 · km 700 a 701');
  expect(await conteoRiel(page, 'En revisión')).toBe(2);
  await resultado.getByRole('link', { name: 'Ver lugares priorizados' }).click();
  await expect(page).toHaveURL(/\/priorizacion$/);
  await expect(fila(page, 'RN 36 · km 700 a 701')).toHaveCount(1);
  // En la lista de siniestros ya figura confirmada.
  await page.goto('/siniestros/cronicas');
  await expect(fila(page, 'S-0471')).toContainText('Confirmada');

  // ── CU05 → CU06: un lugar sin ficha abre el borrador y se emite FI-2026-0043.
  await page.goto('/priorizacion');
  const sabattini = fila(page, 'Av. Amadeo Sabattini al 4700');
  await sabattini.click();
  await expect(page.locator('#lugar-seleccionado')).toHaveText('Av. Amadeo Sabattini al 4700');
  await expect(page.locator('[data-prueba="ficha-vigente"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Emitir ficha de intervención' }).click();
  await expect(page).toHaveURL(/\/priorizacion\/fichas\/nueva\?concentracion=C-0019$/);
  await expect(page.locator('[data-prueba="acta"]').getByText(/al emitirse,\s*FI-2026-0043/)).toBeVisible();
  await sinDesborde(page);
  await page.getByRole('button', { name: 'Emitir ficha FI-2026-0043' }).click();
  await expect(page).toHaveURL(/\/priorizacion\/fichas\/FI-2026-0043$/);
  await expect(page.getByText('Ficha FI-2026-0043 emitida')).toBeVisible();
  await page.goto('/priorizacion/fichas');
  const tabla = page.getByRole('table', { name: 'Fichas de intervención emitidas' });
  await expect(tabla.getByRole('row', { name: /FI-2026-0043/ })).toContainText('Av. Amadeo Sabattini al 4700');
  expect(await conteoRiel(page, 'Fichas emitidas')).toBe(4);
  // Y el lugar ya muestra su ficha vigente en la priorización.
  await page.goto('/priorizacion');
  await fila(page, 'Av. Amadeo Sabattini al 4700').click();
  await expect(page.locator('[data-prueba="ficha-vigente"]')).toContainText('FI-2026-0043');

  // ── CU08: el vecino presenta un reclamo; llega a la bandeja (vista todos) como PN-2026-0205.
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
  await sinDesborde(page);
  await page.getByRole('link', { name: 'Ver cómo lo recibe el organismo' }).click();
  await expect(page).toHaveURL(/\/reclamos\?vista=todos$/);
  await expect(fila(page, 'PN-2026-0205')).toHaveCount(1);
  await expect(filas(page)).toHaveCount(33);
  expect(await conteoRiel(page, 'Todos')).toBe(33);

  // ── Restablecer vuelve a la semilla.
  await enRiel(page, async () => {
    await page.getByRole('button', { name: 'Restablecer datos de demostración' }).click();
  });
  await expect(page.getByText('Datos de demostración restablecidos')).toBeVisible();
  expect(await conteoRiel(page, 'Todos')).toBe(32);
  expect(await conteoRiel(page, 'Desatendidos')).toBe(3);
  expect(await conteoRiel(page, 'En revisión')).toBe(3);
  expect(await conteoRiel(page, 'Fichas emitidas')).toBe(3);
  const semilla = await page.evaluate((clave) => {
    const e = JSON.parse(localStorage.getItem(clave)!).state;
    return {
      reclamo0205: e.reclamos.some((r: { numero: string }) => r.numero === 'PN-2026-0205'),
      ficha0043: e.fichas.some((f: { numero: string }) => f.numero === 'FI-2026-0043'),
      estado0157: e.reclamos.find((r: { numero: string }) => r.numero === 'PN-2026-0157').estado,
    };
  }, CLAVE);
  expect(semilla).toEqual({ reclamo0205: false, ficha0043: false, estado0157: 'abierto' });

  expect(errores, errores.join('\n')).toEqual([]);
});
