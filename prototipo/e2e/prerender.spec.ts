import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * KT-06b del reporte k0lmenIA: el LCP móvil depende de que el HTML servido ya
 * traiga la pantalla. Las rutas fijas se pre-renderizan en el build y el
 * cliente las hidrata; las demás (con número) se siguen armando en el cliente.
 */

/** Ruta pedida, y lo que tiene que estar en el HTML antes de ejecutar JS: el título y la primera fila. */
const RUTAS: { ruta: string; titulo: RegExp; fila: (page: Page) => Locator }[] = [
  { ruta: '/', titulo: /^Lugares priorizados$/, fila: (p) => p.locator('main tbody tr').first() },
  { ruta: '/priorizacion', titulo: /^Lugares priorizados$/, fila: (p) => p.locator('main tbody tr').first() },
  { ruta: '/priorizacion/fichas', titulo: /^Fichas emitidas$/, fila: (p) => p.locator('main tbody tr').first() },
  { ruta: '/siniestros/cronicas', titulo: /^Siniestros registrados$/, fila: (p) => p.locator('main tbody tr').first() },
  { ruta: '/siniestros/revision', titulo: /^Ubicaciones en revisión$/, fila: (p) => p.locator('main li').first() },
  { ruta: '/reclamo', titulo: /^Reclamo por un lugar peligroso$/, fila: (p) => p.getByLabel('Pasos del reclamo').locator('li').first() },
  { ruta: '/reclamos', titulo: /^Bandeja de reclamos desatendidos$/, fila: (p) => p.locator('main tbody tr').first() },
  { ruta: '/componentes', titulo: /^Catálogo de componentes$/, fila: (p) => p.locator('main tbody tr').first() },
];

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(String(e)));
  return errores;
}

test.describe('KT-06b · el HTML servido ya trae la pantalla', () => {
  test.describe('sin JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    for (const { ruta, titulo, fila } of RUTAS) {
      test(`${ruta} muestra el título y la primera fila`, async ({ page }) => {
        await page.goto(ruta);
        await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
        await expect(fila(page)).toBeVisible();
      });
    }

    test('una ruta que no se pre-renderiza no recibe el contenido de otra pantalla', async ({ page }) => {
      await page.goto('/priorizacion/fichas/F-0000-99');
      await expect(page.locator('#root')).toBeEmpty();
    });
  });

  test.describe('con JavaScript', () => {
    for (const { ruta, titulo } of RUTAS) {
      test(`${ruta} se hidrata sin errores`, async ({ page }) => {
        const errores = vigilarErrores(page);
        await page.goto(ruta);
        await page.waitForLoadState('networkidle');
        await expect(page.getByRole('heading', { level: 1, name: titulo })).toBeVisible();
        expect(errores, errores.join('\n')).toEqual([]);
      });
    }

    test('con datos guardados distintos de la semilla, la pantalla los muestra sin errores de hidratación', async ({ page }) => {
      const errores = vigilarErrores(page);
      await page.goto('/priorizacion');
      await page.waitForLoadState('networkidle');
      await page.evaluate(() => {
        const clave = 'punto-ciego:v1';
        const guardado = JSON.parse(localStorage.getItem(clave)!);
        guardado.state.usuarioId = 'mferreyra';
        localStorage.setItem(clave, JSON.stringify(guardado));
      });
      await page.reload();
      await page.waitForLoadState('networkidle');
      await expect(page.getByLabel('Usuario de demostración').filter({ visible: true }).first()).toHaveValue('mferreyra');
      expect(errores, errores.join('\n')).toEqual([]);
    });

    test('la raíz sigue llevando a /priorizacion', async ({ page }) => {
      await page.goto('/');
      await expect(page).toHaveURL(/\/priorizacion$/);
    });
  });
});
