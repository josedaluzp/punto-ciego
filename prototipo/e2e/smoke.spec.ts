import { expect, test, type Page } from '@playwright/test';
import { RUTAS as RUTAS_DEMO } from '../src/rutas/lista';

/** Todas las rutas de la demo (SPEC, "Rutas y paquetes"), más la raíz y una inexistente. */
const RUTAS = ['/', ...RUTAS_DEMO, '/ruta-que-no-existe'];

const CLAVE = 'punto-ciego:v1';

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(String(e)));
  return errores;
}

const esMovil = (page: Page) => (page.viewportSize()?.width ?? 1440) < 600;

test.describe('cada ruta carga', () => {
  for (const ruta of RUTAS) {
    test(`${ruta} sin errores, con título y aviso de datos sintéticos`, async ({ page }) => {
      const errores = vigilarErrores(page);
      await page.goto(ruta);
      await expect(page.locator('main#contenido')).toBeVisible();
      if (ruta !== '/reclamo') await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expect(page.getByText(/Datos sintéticos/).filter({ visible: true }).first()).toBeVisible();
      expect(errores, errores.join('\n')).toEqual([]);
    });
  }

  test('la raíz lleva a los lugares priorizados', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/priorizacion$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Lugares priorizados' })).toBeVisible();
    await expect(page.getByText('38 concentraciones significativas')).toBeVisible();
  });

  test('/reclamo es la cara pública: sin el riel del organismo', async ({ page }) => {
    await page.goto('/reclamo');
    await expect(page.getByRole('navigation', { name: 'Paquetes del sistema' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Restablecer/ })).toHaveCount(0);
  });
});

test.describe('pantalla angosta', () => {
  test('ninguna ruta tiene desplazamiento horizontal a 390 px', async ({ page }) => {
    test.skip(!esMovil(page), 'sólo en el proyecto móvil');
    for (const ruta of RUTAS) {
      await page.goto(ruta);
      await expect(page.locator('main#contenido')).toBeVisible();
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(desborde, `${ruta} desborda ${desborde} px`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('riel', () => {
  async function abrirMenu(page: Page) {
    if (esMovil(page)) await page.getByRole('button', { name: 'Menú' }).click();
  }

  test('agrupa los tres paquetes con sus cantidades vivas', async ({ page }) => {
    await page.goto('/priorizacion');
    await abrirMenu(page);
    const nav = page.getByRole('navigation', { name: 'Paquetes del sistema' });
    for (const p of ['Siniestros', 'Priorización', 'Reclamos']) await expect(nav.getByText(p, { exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Lugares priorizados\s*38/ })).toHaveAttribute('aria-current', 'page');
    await expect(nav.getByRole('link', { name: /En revisión\s*3/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Desatendidos\s*3/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Todos\s*32/ })).toBeVisible();
  });

  test('el selector de usuario cambia quién actúa y se recuerda', async ({ page }) => {
    await page.goto('/reclamos');
    const selector = page.getByLabel('Usuario de demostración');
    await selector.selectOption({ label: 'M. Ferreyra · Funcionario a cargo' });
    await page.reload();
    await expect(page.getByLabel('Usuario de demostración')).toHaveValue('mferreyra');
  });

  test('restablecer vuelve a la semilla', async ({ page }) => {
    await page.goto('/priorizacion');
    await expect(page.locator('main#contenido')).toBeVisible();
    // Se simula trabajo hecho: se borran crónicas y reclamos del almacenamiento.
    await page.evaluate((clave) => {
      const guardado = JSON.parse(localStorage.getItem(clave)!);
      guardado.state.cronicas = guardado.state.cronicas.slice(0, 10);
      guardado.state.reclamos = guardado.state.reclamos.slice(0, 2);
      localStorage.setItem(clave, JSON.stringify(guardado));
    }, CLAVE);
    await page.reload();
    await abrirMenu(page);
    const nav = page.getByRole('navigation', { name: 'Paquetes del sistema' });
    await expect(nav.getByRole('link', { name: /Crónicas\s*10$/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Todos\s*2$/ })).toBeVisible();

    await page.getByRole('button', { name: 'Restablecer datos de demostración' }).click();
    await expect(page.getByText('Datos de demostración restablecidos')).toBeVisible();
    await expect(nav.getByRole('link', { name: /Todos\s*32$/ })).toBeVisible();
    await expect(nav.getByRole('link', { name: /Crónicas\s*10$/ })).toHaveCount(0);
    const cronicas = await page.evaluate((clave) => JSON.parse(localStorage.getItem(clave)!).state.cronicas.length, CLAVE);
    expect(cronicas).toBeGreaterThan(500);
  });

  test('datos ilegibles en el almacenamiento: se vuelve a la semilla', async ({ page }) => {
    await page.goto('/priorizacion');
    await page.evaluate((clave) => localStorage.setItem(clave, '{"roto":'), CLAVE);
    await page.reload();
    await expect(page.getByText('38 concentraciones significativas')).toBeVisible();
  });
});

test.describe('componentes compartidos', () => {
  test('la tabla ordena por encabezado', async ({ page }) => {
    await page.goto('/componentes');
    const fallec = page.getByRole('columnheader', { name: /Fallec/ });
    await expect(fallec).toHaveAttribute('aria-sort', 'none');
    await fallec.getByRole('button').click();
    await expect(fallec).toHaveAttribute('aria-sort', 'descending');
    await fallec.getByRole('button').click();
    await expect(fallec).toHaveAttribute('aria-sort', 'ascending');
  });

  test('el marcador del mapa se arrastra con el teclado', async ({ page }) => {
    await page.goto('/componentes');
    await page.getByLabel('Vista del mapa').selectOption('ciudad');
    const posicion = page.locator('[data-prueba="posicion-pin"]');
    const antes = await posicion.textContent();
    await page.getByRole('button', { name: /Posición corregida/ }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(posicion).not.toHaveText(antes ?? '');
  });

  test('el marcador del mapa se arrastra con el puntero', async ({ page }) => {
    test.skip(esMovil(page), 'el arrastre con mouse se prueba en escritorio');
    await page.goto('/componentes');
    await page.getByLabel('Vista del mapa').selectOption('ciudad');
    const posicion = page.locator('[data-prueba="posicion-pin"]');
    const antes = await posicion.textContent();
    const pin = page.locator('[data-marcador="pin"]');
    const caja = (await pin.boundingBox())!;
    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2);
    await page.mouse.down();
    await page.mouse.move(caja.x + caja.width / 2 + 60, caja.y + caja.height / 2 + 30, { steps: 6 });
    await page.mouse.up();
    await expect(posicion).not.toHaveText(antes ?? '');
  });

  test('seleccionar un marcador del mapa selecciona la fila', async ({ page }) => {
    test.skip(esMovil(page), 'en escritorio el mapa y la tabla están lado a lado');
    await page.goto('/componentes');
    await page.getByRole('button', { name: /^3\. RN 19/ }).click();
    await expect(page.getByRole('row', { name: /C-0003/ })).toHaveAttribute('aria-selected', 'true');
  });

  test('el croquis mueve su marcador con las flechas', async ({ page }) => {
    await page.goto('/componentes');
    const km = page.locator('[data-prueba="km-croquis"]');
    await expect(km).toHaveText('km 694,5');
    await page.getByRole('slider', { name: 'Progresiva corregida' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(km).toHaveText('km 694,6');
  });
});
