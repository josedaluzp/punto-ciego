import { expect, test, type Page } from './fixtures';

/**
 * Títulos de `CRONICAS_DE_EJEMPLO` (semilla) y de `EJEMPLO_CONFIANZA_BAJA`
 * (pantalla). Se copian porque la semilla importa JSON, que Playwright no
 * carga sin atributos de importación.
 */
const CRONICAS_DE_EJEMPLO = [
  { titulo: 'Motociclista en Av. Amadeo Sabattini al 4700' },
  { titulo: 'Ciclista en Av. Monseñor Pablo Cabrera al 1900' },
  { titulo: 'Despiste en la ruta nacional 158, km 214' },
  { titulo: 'Otra crónica del hecho de Sabattini' },
] as const;
const EJEMPLO_CONFIANZA_BAJA = { titulo: 'Motociclista sobre Av. Vélez Sarsfield, sin altura' };

/** CU01 Incorporar crónica y CU02 Georreferenciar siniestro (RF01 a RF08). */

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(String(e)));
  return errores;
}

const esMovil = (page: Page) => (page.viewportSize()?.width ?? 1440) < 600;

async function abrirIncorporar(page: Page) {
  await page.goto('/siniestros/cronicas');
  await page.getByRole('link', { name: 'Incorporar crónica' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Incorporar crónica' })).toBeVisible();
}

async function cargarEjemplo(page: Page, titulo: string) {
  await page.getByLabel('Cargar una crónica de ejemplo').selectOption({ label: titulo });
  await expect(page.getByRole('heading', { name: 'Lo que extrajo el sistema' })).toBeVisible();
}

const resultado = (page: Page) => page.locator('section[aria-labelledby="titulo-extraccion"]');

async function conteoRiel(page: Page, entrada: RegExp) {
  if (esMovil(page)) await page.getByRole('button', { name: 'Menú' }).click();
  const link = page.getByRole('navigation', { name: 'Paquetes del sistema' }).getByRole('link', { name: entrada });
  await expect(link).toBeVisible();
  if (esMovil(page)) await page.getByRole('button', { name: 'Menú' }).click();
}

test.describe('lista de siniestros', () => {
  test('muestra método, confianza y estado; filtra y abre el detalle', async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto('/siniestros/cronicas');
    await expect(page.getByRole('heading', { level: 1, name: 'Siniestros registrados' })).toBeVisible();
    await expect(page.getByText('471 siniestros · 512 crónicas')).toBeVisible();
    const tabla = page.getByRole('table', { name: /Siniestros registrados/ });
    await expect(tabla.locator('tbody tr')).toHaveCount(50);
    await page.getByRole('button', { name: 'Mostrar 50 más' }).click();
    await expect(tabla.locator('tbody tr')).toHaveCount(100);

    await page.getByLabel('Estado de la ubicación').selectOption('en-revision');
    await expect(tabla.locator('tbody tr')).toHaveCount(3);
    await expect(tabla.locator('tbody tr[data-estado="revision"]')).toHaveCount(3);
    await expect(page.getByText('3 de 471 siniestros')).toBeVisible();

    await tabla.getByRole('row', { name: /S-0470/ }).click();
    await expect(page).toHaveURL(/siniestro=S-0470/);
    const detalle = page.getByRole('complementary', { name: 'Detalle del siniestro' });
    await expect(detalle.getByRole('heading', { name: /Siniestro\s+S-0470/ })).toBeVisible();
    await expect(detalle.getByRole('meter', { name: 'Confianza 0,41, umbral 0,70' })).toBeVisible();
    await expect(detalle.getByRole('link', { name: 'Ir a ubicaciones en revisión' })).toHaveAttribute('href', '/siniestros/revision');

    await page.getByLabel('Vía', { exact: true }).selectOption('ruta');
    await page.getByLabel('Método', { exact: true }).selectOption('manual');
    await expect(page.getByText('Ningún siniestro coincide con los filtros')).toBeVisible();
    await page.getByRole('button', { name: 'Quitar los filtros' }).click();
    await expect(tabla.locator('tbody tr')).toHaveCount(50);
    expect(errores, errores.join('\n')).toEqual([]);
  });
});

test.describe('incorporar crónica: flujo normal con cada crónica de ejemplo', () => {
  test('Sabattini: extrae, resalta el lugar, ubica por normalización con 0,86 y confirma', async ({ page }) => {
    const errores = vigilarErrores(page);
    await abrirIncorporar(page);
    await expect(page.getByText('Todavía no hay texto para analizar')).toBeVisible();
    await cargarEjemplo(page, CRONICAS_DE_EJEMPLO[0]!.titulo);

    await expect(page.locator('mark')).toHaveText('avenida Amadeo Sabattini al 4700');
    await expect(page.getByRole('textbox', { name: 'Lugar' })).toHaveValue('avenida Amadeo Sabattini al 4700');
    await expect(page.getByText('Cuadra (calle y altura)')).toBeVisible();
    await expect(page.getByLabel('Fecha del hecho')).toHaveValue('2026-09-05');
    await expect(page.getByLabel('Tipo de usuario de la víctima 1')).toHaveValue('motociclista');
    await expect(page.getByLabel('Gravedad de la víctima 1')).toHaveValue('fallecido');
    await expect(page.getByLabel('Tipo de siniestro')).toHaveValue('choque en giro');
    await expect(page.getByText('Ninguno con la misma fecha y el mismo lugar')).toBeVisible();

    await page.getByRole('button', { name: 'Incorporar crónica' }).click();
    const r = resultado(page);
    await expect(r.getByRole('heading', { name: /Siniestro\s+S-0472\s+incorporado/ })).toBeFocused();
    await expect(r.getByText('Ubicación confirmada', { exact: true })).toBeVisible();
    await expect(r.getByText('Servicio de normalización (calle)')).toBeVisible();
    await expect(r.getByRole('meter', { name: 'Confianza 0,86, umbral 0,70' })).toBeVisible();
    await expect(r.getByText(/queda confirmada y entra en el cálculo de concentraciones/)).toBeVisible();
    await expect(r.getByRole('img', { name: /Mapa con la ubicación del siniestro S-0472/ }).or(r.getByLabel(/Mapa con la ubicación del siniestro S-0472/))).toBeVisible();
    await expect(r.getByText('Croquis del lugar')).toBeVisible();
    await expect(page.getByText('472 siniestros · 513 crónicas')).toBeVisible();
    expect(errores, errores.join('\n')).toEqual([]);
  });

  test('RN 158 km 214,6: capa de postes kilométricos, nunca normalización', async ({ page }) => {
    await abrirIncorporar(page);
    await cargarEjemplo(page, CRONICAS_DE_EJEMPLO[2]!.titulo);
    await expect(page.getByText('Ruta con progresiva', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Incorporar crónica' }).click();
    const r = resultado(page);
    await expect(r.getByText('Capa de postes kilométricos (ruta)')).toBeVisible();
    await expect(r.getByText('RN 158, poste del km 214')).toBeVisible();
    await expect(r.getByRole('meter', { name: 'Confianza 0,93, umbral 0,70' })).toBeVisible();
    await expect(r.getByText('Croquis del tramo')).toBeVisible();
    await expect(r.getByText(/RN 158 · km 214 a 215/)).toBeVisible();
  });

  test('Pablo Cabrera: dispara en vivo la alerta de PN-2026-0157', async ({ page }) => {
    const errores = vigilarErrores(page);
    await abrirIncorporar(page);
    await conteoRiel(page, /Desatendidos\s*3/);
    await cargarEjemplo(page, CRONICAS_DE_EJEMPLO[1]!.titulo);
    await page.getByRole('button', { name: 'Incorporar crónica' }).click();
    await expect(page.getByText('Alerta de reclamo desatendido · PN-2026-0157')).toBeVisible();
    const r = resultado(page);
    await expect(r.getByRole('link', { name: 'PN-2026-0157' })).toHaveAttribute('href', '/reclamos/PN-2026-0157');
    await expect(r.getByRole('link', { name: 'Ver la bandeja de reclamos desatendidos' })).toHaveAttribute('href', '/reclamos');
    await conteoRiel(page, /Desatendidos\s*4/);
    await r.getByRole('link', { name: 'Ver la bandeja de reclamos desatendidos' }).click();
    await expect(page).toHaveURL(/\/reclamos$/);
    expect(errores, errores.join('\n')).toEqual([]);
  });

  test('segunda crónica de Sabattini: se reconoce el duplicado y se vincula (RF03)', async ({ page }) => {
    await abrirIncorporar(page);
    await cargarEjemplo(page, CRONICAS_DE_EJEMPLO[0]!.titulo);
    await page.getByRole('button', { name: 'Incorporar crónica' }).click();
    await page.getByRole('button', { name: 'Incorporar otra crónica' }).click();
    await cargarEjemplo(page, CRONICAS_DE_EJEMPLO[3]!.titulo);
    await expect(page.getByText('La crónica refiere a un siniestro ya registrado.')).toBeVisible();
    await page.getByRole('button', { name: 'Vincular la crónica a S-0472' }).click();
    const r = resultado(page);
    await expect(r.getByRole('heading', { name: /Crónica\s+CR-0514\s+vinculada a\s+S-0472/ })).toBeVisible();
    await expect(r.getByText(/no se creó un siniestro nuevo/)).toBeVisible();
    await expect(page.getByText('472 siniestros · 514 crónicas')).toBeVisible();

    await r.getByRole('link', { name: 'Ver S-0472 en la lista de siniestros' }).click();
    const detalle = page.getByRole('complementary', { name: 'Detalle del siniestro' });
    await expect(detalle.getByRole('heading', { name: '2 crónicas de origen' })).toBeVisible();
    await expect(detalle.getByText(/incorporada por R\. Quiroga/)).toHaveCount(2);
  });
});

test.describe('incorporar crónica: cursos alternativos', () => {
  test('confianza baja: la ubicación queda en revisión, con aviso y enlace (RF08)', async ({ page }) => {
    await abrirIncorporar(page);
    await cargarEjemplo(page, EJEMPLO_CONFIANZA_BAJA.titulo);
    await expect(page.getByText('Corredor (vía sin altura ni progresiva)')).toBeVisible();
    await page.getByRole('button', { name: 'Incorporar crónica' }).click();
    const r = resultado(page);
    await expect(r.getByText('En revisión', { exact: true })).toBeVisible();
    await expect(r.getByRole('meter', { name: 'Confianza 0,30, umbral 0,70' })).toBeVisible();
    await expect(r.getByText(/por debajo del umbral de 0,70: la ubicación queda en revisión/)).toBeVisible();
    await conteoRiel(page, /En revisión\s*4/);
    await r.getByRole('link', { name: 'Ir a ubicaciones en revisión' }).click();
    await expect(page).toHaveURL(/\/siniestros\/revision$/);
  });

  test('el analista corrige el lugar y la ubicación sigue a la corrección', async ({ page }) => {
    await abrirIncorporar(page);
    await cargarEjemplo(page, EJEMPLO_CONFIANZA_BAJA.titulo);
    const lugar = page.getByRole('textbox', { name: 'Lugar' });
    await lugar.fill('xx');
    await expect(page.getByText(/No se reconoce un lugar/)).toBeVisible();
    await lugar.fill('avenida Vélez Sarsfield al 1200');
    await expect(page.getByText('Av. Vélez Sarsfield al 1200')).toBeVisible();
    await expect(page.getByText('Cuadra (calle y altura)')).toBeVisible();
    await page.getByRole('button', { name: 'Agregar víctima' }).click();
    await page.getByLabel('Tipo de usuario de la víctima 2').selectOption('acompanante');
    await page.getByLabel('Gravedad de la víctima 2').selectOption('herido-grave');
    await page.getByRole('button', { name: 'Incorporar crónica' }).click();
    const r = resultado(page);
    await expect(r.getByText('Ubicación confirmada', { exact: true })).toBeVisible();
    await expect(r.getByRole('meter', { name: 'Confianza 0,86, umbral 0,70' })).toBeVisible();
    await r.getByRole('link', { name: 'Ver S-0472 en la lista de siniestros' }).click();
    await expect(page.getByRole('complementary', { name: 'Detalle del siniestro' }).getByText('1 acompañante')).toBeVisible();
  });

  test('coincidencia dudosa: el analista decide crear un siniestro nuevo (4.b)', async ({ page }) => {
    await abrirIncorporar(page);
    await cargarEjemplo(page, CRONICAS_DE_EJEMPLO[0]!.titulo);
    await page.getByRole('button', { name: 'Incorporar crónica' }).click();
    await page.getByRole('button', { name: 'Incorporar otra crónica' }).click();
    await page.getByLabel('Dirección web').fill('https://radio.example/transito/colectivo-camioneta-sabattini');
    await page.getByLabel('Medio').fill('Radio de ejemplo');
    await page.getByLabel('Fecha de publicación').fill('2026-09-06');
    await page
      .getByLabel('Texto de la crónica')
      .fill('Ayer una camioneta embistió a un colectivo urbano en avenida Amadeo Sabattini al 4700. Hubo demoras en el tránsito durante toda la tarde y cortes parciales de calzada.');
    await expect(page.getByText('Coincidencia dudosa.')).toBeVisible();
    await page.getByRole('button', { name: 'Incorporar crónica' }).click();
    await expect(page.getByText('Elegí si vinculás la crónica o creás un siniestro nuevo.')).toBeVisible();
    await page.getByLabel('Es otro hecho: crear un siniestro nuevo').check();
    await page.getByRole('button', { name: 'Incorporar crónica' }).click();
    await expect(resultado(page).getByRole('heading', { name: /Siniestro\s+S-0473\s+incorporado/ })).toBeVisible();
  });

  test('texto sin lugar reconocible: se registra y va a revisión (3.a); datos obligatorios', async ({ page }) => {
    await abrirIncorporar(page);
    await page.getByRole('button', { name: 'Incorporar crónica' }).click();
    await expect(page.getByText('Ingresá la dirección web completa de la nota, con https://.')).toBeVisible();
    await expect(page.getByText('Indicá el medio que publicó la crónica.')).toBeVisible();
    await page.getByLabel('Dirección web').fill('https://diario.example/policiales/choque-sin-lugar');
    await page.getByLabel('Medio').fill('Diario de ejemplo');
    await page.getByLabel('Fecha de publicación').fill('2026-09-09');
    await page.getByLabel('Texto de la crónica').fill('Un conductor murió anoche en un choque. La policía no informó dónde ocurrió el hecho.');
    await expect(page.getByText('Sin lugar reconocible: la ubicación irá a revisión')).toBeVisible();
    await page.getByRole('button', { name: 'Incorporar crónica' }).click();
    const r = resultado(page);
    await expect(r.getByText('En revisión', { exact: true })).toBeVisible();
    await expect(r.getByText('Sin lugar reconocible en el texto; se propone el centro de Córdoba')).toBeVisible();
  });
});

test.describe('persistencia', () => {
  test('lo incorporado sobrevive a la recarga y la dirección web no se registra dos veces (2.a)', async ({ page }) => {
    await abrirIncorporar(page);
    await cargarEjemplo(page, CRONICAS_DE_EJEMPLO[1]!.titulo);
    await page.getByRole('button', { name: 'Incorporar crónica' }).click();
    await expect(resultado(page).getByRole('heading', { name: /S-0472/ })).toBeVisible();

    await page.goto('/siniestros/cronicas?siniestro=S-0472');
    await page.reload();
    await expect(page.getByText('472 siniestros · 513 crónicas')).toBeVisible();
    const tabla = page.getByRole('table', { name: /Siniestros registrados/ });
    await expect(tabla.locator('tbody tr').first()).toContainText('S-0472');
    const detalle = page.getByRole('complementary', { name: 'Detalle del siniestro' });
    await expect(detalle.getByRole('heading', { name: /Siniestro\s+S-0472/ })).toBeVisible();
    await expect(detalle.getByRole('link', { name: 'PN-2026-0157' })).toBeVisible();

    await page.goto('/siniestros/cronicas?incorporar');
    await cargarEjemplo(page, CRONICAS_DE_EJEMPLO[1]!.titulo);
    await expect(page.getByRole('alert').filter({ hasText: 'Esta dirección web ya fue incorporada' })).toBeVisible();
    await expect(page.locator('form button[type="submit"]')).toBeDisabled();
    await expect(page.getByText('Esta dirección web ya está registrada.')).toBeVisible();
  });

  test('a 390 px la pantalla no desborda en ningún estado', async ({ page }) => {
    test.skip(!esMovil(page), 'sólo en el proyecto móvil');
    for (const ruta of ['/siniestros/cronicas', '/siniestros/cronicas?siniestro=S-0468', '/siniestros/cronicas?incorporar']) {
      await page.goto(ruta);
      await expect(page.locator('main#contenido')).toBeVisible();
      const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(desborde, `${ruta} desborda ${desborde} px`).toBeLessThanOrEqual(0);
    }
    await cargarEjemplo(page, CRONICAS_DE_EJEMPLO[2]!.titulo);
    await page.getByRole('button', { name: 'Incorporar crónica' }).click();
    await expect(resultado(page).getByText('Croquis del tramo')).toBeVisible();
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(desborde).toBeLessThanOrEqual(0);
  });
});
