import { expect, test, type Page } from '@playwright/test';

/** CU06 (emitir ficha de intervención) y CU07 (recomendar contramedidas), más el listado de fichas emitidas. */

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(String(e)));
  return errores;
}

const esMovil = (page: Page) => (page.viewportSize()?.width ?? 1440) < 600;

let errores: string[] = [];
test.beforeEach(({ page }) => {
  errores = vigilarErrores(page);
});
test.afterEach(() => {
  expect(errores, errores.join('\n')).toEqual([]);
});

const acta = (page: Page) => page.locator('[data-prueba="acta"]');

test.describe('ficha emitida', () => {
  test('FI-2026-0042 muestra los datos de la Figura 18', async ({ page }) => {
    await page.goto('/priorizacion/fichas/FI-2026-0042');
    const a = acta(page);
    await expect(page.getByRole('heading', { level: 1, name: 'Ficha de intervención' })).toBeVisible();
    await expect(a.getByRole('heading', { name: 'RN 9 · km 694 a 695' })).toBeVisible();
    await expect(a.getByText('FI-2026-0042', { exact: true }).first()).toBeVisible();
    await expect(a.getByText(/Emitida el\s*08\/09\/2026\s*por\s*R\. Quiroga/)).toBeVisible();

    // Cierre del acta: emitida por, fecha, folio y línea de firma de demostración.
    const cierre = a.getByLabel('Cierre del acta');
    await expect(cierre).toContainText('Emitida porR. QuirogaTécnico de tránsito · Ingeniería de Tránsito');
    await expect(cierre).toContainText('Fecha08/09/2026');
    await expect(cierre).toContainText('FolioFI-2026-0042');
    await expect(cierre.getByText('Firma de R. Quiroga · rotulado de demostración, sin firma real')).toBeVisible();
    await expect(a.getByRole('img', { name: 'Ruta nacional 9' })).toBeVisible();
    await expect(a.getByRole('img', { name: 'Índice de riesgo 0,91' })).toBeVisible();
    await expect(a.getByText(/Datos sintéticos de demostración/)).toBeVisible();

    const sitio = a.getByRole('region', { name: 'Caracterización del sitio' });
    for (const [dt, dd] of [
      ['Calzada', 'Simple'],
      ['Carriles', '2'],
      ['Banquina', 'Sin pavimentar'],
      ['Tipo predominante', 'salida de calzada (3 de 4)'],
      ['Siniestros', '4'],
      ['Fallecidos', '5'],
      ['Víctimas vulnerables', '80 % (4 de 5)'],
    ]) {
      await expect(sitio.locator('div', { has: page.locator('dt', { hasText: new RegExp(`^${dt}$`) }) }).locator('dd')).toHaveText(dd);
    }

    const lista = a.getByRole('list', { name: /Lista de siniestros/ });
    await expect(lista.getByRole('listitem')).toHaveCount(4);
    const fechas = await lista.getByRole('listitem').evaluateAll((li) => li.map((x) => x.textContent ?? ''));
    expect(fechas.map((t) => /\d{2}\/\d{4}/.exec(t)?.[0])).toEqual(['03/2022', '11/2023', '06/2024', '01/2025']);
    await expect(a.getByRole('group', { name: /Croquis de RN 9/ })).toBeVisible();

    const medidas = a.getByRole('region', { name: /Contramedidas recomendadas · ruta · salida de calzada/ });
    const items = medidas.getByRole('listitem');
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText('Bandas sonoras en el borde de calzada');
    await expect(items.nth(0)).toContainText('factor 0,72');
    await expect(items.nth(0)).toContainText('reducción esperada 28 %');
    await expect(items.nth(0).getByRole('img', { name: 'calificación 4 de 5' })).toBeVisible();
    await expect(items.nth(1)).toContainText('Pavimentación de banquina');
    await expect(items.nth(1)).toContainText('factor 0,81');
    await expect(items.nth(2)).toContainText('Demarcación de bordes de alta visibilidad');
    await expect(items.nth(2)).toContainText('factor 0,88');
    await expect(items.nth(2)).toContainText('Referencia:');
    await expect(medidas.getByText('Factores de demostración.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Imprimir o guardar en PDF' })).toBeVisible();
  });

  test('número inexistente: vacío con vuelta a la lista', async ({ page }) => {
    await page.goto('/priorizacion/fichas/FI-2026-0099');
    await expect(page.getByText('No existe la ficha FI-2026-0099')).toBeVisible();
    await page.getByRole('link', { name: 'Volver a las fichas emitidas' }).click();
    await expect(page).toHaveURL(/\/priorizacion\/fichas$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Fichas emitidas' })).toBeVisible();
  });
});

test.describe('fichas emitidas (lista)', () => {
  test('lista las tres fichas de la semilla y abre el detalle', async ({ page }) => {
    await page.goto('/priorizacion/fichas');
    const tabla = page.getByRole('table', { name: 'Fichas de intervención emitidas' });
    await expect(tabla.getByRole('row')).toHaveCount(4);
    const fila = tabla.getByRole('row', { name: /FI-2026-0042/ });
    await expect(fila).toContainText('RN 9 · km 694 a 695');
    await expect(fila.getByRole('img', { name: 'Índice de riesgo 0,91' })).toBeVisible();
    if (!esMovil(page)) {
      await expect(fila).toContainText('08/09/2026');
      await expect(fila).toContainText('R. Quiroga');
      await expect(fila).toContainText('Bandas sonoras en el borde de calzada y 2 más');
    }
    await fila.getByText('RN 9 · km 694 a 695').click();
    await expect(page).toHaveURL(/\/priorizacion\/fichas\/FI-2026-0042$/);
  });

  test('busca y filtra; sin coincidencias ofrece limpiar', async ({ page }) => {
    await page.goto('/priorizacion/fichas');
    const tabla = page.getByRole('table', { name: 'Fichas de intervención emitidas' });
    await page.getByLabel('Buscar ficha').fill('RN 19');
    await expect(tabla.getByRole('row')).toHaveCount(2);
    await expect(page.getByText('1 de 3 fichas')).toBeVisible();
    await page.getByLabel('Buscar ficha').fill('');
    await page.getByLabel('Emitida por').selectOption('M. Ferreyra');
    await expect(tabla.getByRole('row', { name: /FI-2026-0040/ })).toBeVisible();
    await expect(tabla.getByRole('row')).toHaveCount(2);
    await page.getByLabel('Emitida por').selectOption('');
    await page.getByLabel('Tipo de vía').selectOption('calle');
    await expect(tabla.getByRole('row', { name: /FI-2026-0038/ })).toBeVisible();
    await expect(tabla.getByRole('row')).toHaveCount(2);
    await page.getByLabel('Buscar ficha').fill('zzz');
    await expect(page.getByText('Ninguna ficha coincide con los filtros')).toBeVisible();
    await page.getByRole('button', { name: 'Limpiar los filtros' }).click();
    await expect(tabla.getByRole('row')).toHaveCount(4);
  });
});

test.describe('emitir una ficha (CU06)', () => {
  test('desde la priorización: elige contramedidas, emite FI-2026-0043, aparece en la lista y persiste', async ({ page }) => {
    await page.goto('/priorizacion/fichas/nueva?concentracion=C-0021');
    const a = acta(page);
    await expect(a.getByRole('heading', { name: 'RN 158 · km 170 a 171' })).toBeVisible();
    await expect(a.getByText(/al emitirse,\s*FI-2026-0043/)).toBeVisible();
    await expect(a.getByText(/Se registra el\s*09\/09\/2026\s*a nombre de\s*R\. Quiroga/)).toBeVisible();

    const casillas = a.getByRole('checkbox');
    await expect(casillas).toHaveCount(3);
    for (const c of await casillas.all()) await expect(c).toBeChecked();
    await a.getByRole('checkbox', { name: /Carril de sobrepaso alternado/ }).uncheck();

    await page.getByRole('button', { name: 'Emitir ficha FI-2026-0043' }).click();
    await expect(page).toHaveURL(/\/priorizacion\/fichas\/FI-2026-0043$/);
    await expect(page.getByText('Ficha FI-2026-0043 emitida')).toBeVisible();
    const emitida = acta(page);
    await expect(emitida.getByText(/Emitida el\s*09\/09\/2026, \d{2}:\d{2}\s*por\s*R\. Quiroga/)).toBeVisible();
    await expect(emitida.getByLabel('Cierre del acta')).toContainText(/Fecha y hora09\/09\/2026, \d{2}:\d{2}FolioFI-2026-0043/);
    const medidas = emitida.getByRole('region', { name: /Contramedidas recomendadas/ });
    await expect(medidas.getByRole('listitem')).toHaveCount(2);
    await expect(medidas).not.toContainText('Carril de sobrepaso');
    await expect(medidas.getByText(/El catálogo recomendaba 3 contramedidas; R\. Quiroga incluyó 2/)).toBeVisible();

    await page.getByRole('link', { name: 'Fichas emitidas', exact: true }).first().click();
    const tabla = page.getByRole('table', { name: 'Fichas de intervención emitidas' });
    await expect(tabla.getByRole('row', { name: /FI-2026-0043/ })).toContainText('RN 158 · km 170 a 171');
    await expect(tabla.getByRole('row')).toHaveCount(5);

    await page.reload();
    await expect(page.getByRole('table', { name: 'Fichas de intervención emitidas' }).getByRole('row', { name: /FI-2026-0043/ })).toBeVisible();
    await page.goto('/priorizacion/fichas/nueva?concentracion=C-0021');
    await expect(page.getByText('ya tiene la ficha FI-2026-0043')).toBeVisible();
  });

  test('desde la lista: «Nueva ficha», elige la concentración y emite', async ({ page }) => {
    await page.goto('/priorizacion/fichas');
    await page.getByRole('link', { name: 'Nueva ficha' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Nueva ficha de intervención' })).toBeVisible();
    await page.getByLabel('Buscar concentración').fill('Sabattini');
    const tabla = page.getByRole('table', { name: /Concentraciones significativas/ });
    await expect(tabla.getByRole('row')).toHaveCount(2);
    await tabla.getByRole('row', { name: /C-0019/ }).click();
    await expect(page).toHaveURL(/concentracion=C-0019/);
    await expect(acta(page).getByRole('heading', { name: 'Av. Amadeo Sabattini al 4700' })).toBeVisible();
    await page.getByRole('button', { name: 'Emitir ficha FI-2026-0043' }).click();
    await expect(page).toHaveURL(/\/priorizacion\/fichas\/FI-2026-0043$/);
    await expect(acta(page).getByRole('region', { name: /Contramedidas recomendadas · calle · choque en giro/ }).getByRole('listitem')).toHaveCount(2);
  });

  test('alternativo: la concentración ya tiene ficha y se ofrece abrirla', async ({ page }) => {
    await page.goto('/priorizacion/fichas/nueva');
    await page.getByRole('table', { name: /Concentraciones significativas/ }).getByRole('row', { name: /C-0007/ }).click();
    await expect(page.getByText('RN 9 · km 694 a 695 (C-0007) ya tiene la ficha FI-2026-0042')).toBeVisible();
    await expect(page.getByText(/La emitió R\. Quiroga el 08\/09\/2026/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Emitir ficha/ })).toHaveCount(0);
    await page.getByRole('link', { name: 'Abrir FI-2026-0042' }).click();
    await expect(page).toHaveURL(/\/priorizacion\/fichas\/FI-2026-0042$/);
  });

  test('alternativo: concentración inexistente', async ({ page }) => {
    await page.goto('/priorizacion/fichas/nueva?concentracion=C-9999');
    await expect(page.getByText('No hay una concentración C-9999 entre las significativas de 2021–2025')).toBeVisible();
    await page.getByRole('link', { name: 'Elegir otra concentración' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Nueva ficha de intervención' })).toBeVisible();
  });

  test('CU06 3.a: sin contramedidas aplicables se emite con aviso de catálogo incompleto', async ({ page }) => {
    await page.goto('/priorizacion/fichas/nueva?concentracion=C-0017');
    await expect(page.getByText(/El catálogo no contiene contramedidas para calle · choque frontal/)).toBeVisible();
    await page.getByRole('button', { name: 'Emitir ficha FI-2026-0043' }).click();
    await expect(page).toHaveURL(/FI-2026-0043$/);
    await expect(page.getByText(/Emitida sin recomendación: el catálogo no contiene contramedidas para calle · choque frontal/)).toBeVisible();
  });

  test('pide al menos una contramedida cuando hay recomendadas', async ({ page }) => {
    await page.goto('/priorizacion/fichas/nueva?concentracion=C-0019');
    for (const c of await acta(page).getByRole('checkbox').all()) await c.uncheck();
    await page.getByRole('button', { name: 'Emitir ficha FI-2026-0043' }).click();
    await expect(page.getByRole('alert')).toHaveText('Elegí al menos una contramedida para incluir en la ficha.');
    await expect(page).toHaveURL(/concentracion=C-0019/);
  });

  test('el analista no emite fichas', async ({ page }) => {
    await page.goto('/priorizacion/fichas/nueva?concentracion=C-0019');
    await page.getByLabel('Usuario de demostración').selectOption('lahumada');
    await expect(page.getByRole('button', { name: 'Emitir ficha FI-2026-0043' })).toBeDisabled();
    await expect(page.getByText(/Las fichas las emite el técnico de tránsito o el funcionario a cargo/)).toBeVisible();
    await page.getByLabel('Usuario de demostración').selectOption('mferreyra');
    await page.getByRole('button', { name: 'Emitir ficha FI-2026-0043' }).click();
    await expect(acta(page).getByText(/Emitida el .* por\s*M\. Ferreyra/)).toBeVisible();
    await expect(acta(page).getByLabel('Cierre del acta')).toContainText('M. FerreyraFuncionario a cargo · Ingeniería de Tránsito');
  });
});
