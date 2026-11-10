import { expect, test, type Page } from './fixtures';

/** CU04 Actualizar concentraciones de riesgo y CU05 Consultar lugares priorizados (Figura 17). */

const FIGURA_17 = [
  {
    nombre: 'RN 9 · km 694 a 695',
    indice: '0,91',
    fallecidos: '5',
    vulnerables: '80 %',
  },
  {
    nombre: 'Av. Vélez Sarsfield al 1200',
    indice: '0,88',
    fallecidos: '4',
    vulnerables: '100 %',
  },
  {
    nombre: 'RN 19 · km 312 a 313',
    indice: '0,79',
    fallecidos: '4',
    vulnerables: '50 %',
  },
  {
    nombre: 'Av. Amadeo Sabattini al 4700',
    indice: '0,74',
    fallecidos: '3',
    vulnerables: '100 %',
  },
  {
    nombre: 'RN 158 · km 170 a 171',
    indice: '0,66',
    fallecidos: '3',
    vulnerables: '33 %',
  },
  {
    nombre: 'Av. Colón al 5300',
    indice: '0,61',
    fallecidos: '2',
    vulnerables: '100 %',
  },
];

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(String(e)));
  return errores;
}

const esMovil = (page: Page) => (page.viewportSize()?.width ?? 1440) < 600;
const filas = (page: Page) =>
  page
    .getByRole('table', {
      name: 'Concentraciones ordenadas por índice de riesgo',
    })
    .locator('tbody tr');
const lugar = (page: Page) => page.getByRole('heading', { level: 2 }).and(page.locator('#lugar-seleccionado'));
const conteo = (page: Page) => page.locator('[data-prueba="conteo"]');

async function abrirMapa(page: Page) {
  if (esMovil(page)) await page.getByRole('button', { name: 'Ver en el mapa de la provincia' }).click();
}

let errores: string[] = [];
test.beforeEach(async ({ page }) => {
  errores = vigilarErrores(page);
  await page.goto('/');
  await expect(page).toHaveURL(/\/priorizacion$/);
});
test.afterEach(() => {
  expect(errores, errores.join('\n')).toEqual([]);
});

test.describe('CU05 · lista ordenada por índice', () => {
  test('reproduce el orden y los valores de la Figura 17', async ({ page }) => {
    await expect(conteo(page)).toHaveText('38 concentraciones significativas');
    await expect(filas(page)).toHaveCount(38);
    for (const [i, f] of FIGURA_17.entries()) {
      const fila = filas(page).nth(i);
      await expect(fila.locator('td').first()).toHaveText(String(i + 1));
      await expect(fila).toContainText(f.nombre);
      await expect(fila.getByRole('img', { name: `Índice de riesgo ${f.indice}` })).toBeVisible();
      await expect(fila.locator('td').nth(3)).toHaveText(f.fallecidos);
      if (!esMovil(page)) await expect(fila.locator('td').nth(4)).toHaveText(f.vulnerables);
    }
  });

  test('la identidad de cada lugar: escudo y mojón en ruta, chapa azul en calle', async ({ page }) => {
    const rn9 = filas(page).nth(0);
    await expect(rn9.getByRole('img', { name: 'Ruta nacional 9' })).toBeVisible();
    if (!esMovil(page)) await expect(rn9.getByLabel('kilómetro 694')).toBeVisible();
    await expect(filas(page).nth(1).getByRole('img', { name: 'Calle: Av. Vélez Sarsfield' })).toBeVisible();
  });

  test('el primer lugar queda elegido con su croquis, sus siniestros y la fórmula del índice', async ({ page }) => {
    await expect(filas(page).nth(0)).toHaveAttribute('aria-selected', 'true');
    await expect(lugar(page)).toHaveText('RN 9 · km 694 a 695');
    const panel = page.locator('[data-prueba="lugar-seleccionado"]');
    await expect(panel).toContainText('4 siniestros · 5 fallecidos · 4 motociclistas');
    await expect(panel).toContainText('Los reclamos vecinales no intervienen en este orden.');
    await expect(panel.getByRole('group', { name: /RN 9/ })).toBeVisible();
    const lista = panel.getByRole('list', { name: 'Siniestros del lugar' }).locator('li');
    await expect(lista).toHaveCount(4);
    await expect(lista.first()).toContainText('03/2022');
    await expect(lista.first()).toContainText('km 694,3');
    await expect(page.locator('[data-prueba="formula-lugar"]')).toBeHidden();
    await panel.getByText('Cómo se calcula el índice').click();
    await expect(page.locator('[data-prueba="formula-lugar"]')).toBeVisible();
    await expect(page.locator('[data-prueba="formula-lugar"]')).toContainText('0,91 = 0,5 ·');
    await expect(panel).toContainText('Los reclamos vecinales no intervienen en el índice.');
  });
});

test.describe('CU05 · selección sincronizada', () => {
  test('clic en la lista: cambia el croquis y el marcador del mapa', async ({ page }) => {
    await filas(page).nth(1).click();
    await expect(filas(page).nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(lugar(page)).toHaveText('Av. Vélez Sarsfield al 1200');
    await expect(page).toHaveURL(/lugar=C-0012/);
    await abrirMapa(page);
    await expect(page.locator('[data-marcador="C-0012"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-marcador="C-0007"]')).toHaveAttribute('aria-pressed', 'false');
  });

  test('clic en el mapa: elige el lugar en la lista y en el croquis', async ({ page }) => {
    await abrirMapa(page);
    await page.locator('[data-marcador="C-0021"]').click();
    await expect(lugar(page)).toHaveText('RN 158 · km 170 a 171');
    await expect(filas(page).nth(4)).toHaveAttribute('aria-selected', 'true');
  });

  test('teclado: flechas en la lista y Enter sobre un marcador', async ({ page }) => {
    await filas(page).nth(0).focus();
    await page.keyboard.press('ArrowDown');
    await expect(filas(page).nth(1)).toBeFocused();
    await expect(lugar(page)).toHaveText('Av. Vélez Sarsfield al 1200');
    await page.keyboard.press('ArrowDown');
    await expect(lugar(page)).toHaveText('RN 19 · km 312 a 313');
    await page.keyboard.press('ArrowUp');
    await expect(lugar(page)).toHaveText('Av. Vélez Sarsfield al 1200');
    await page.keyboard.press('End');
    await expect(filas(page).nth(37)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(lugar(page)).toHaveText('RN 9 · km 694 a 695');

    await abrirMapa(page);
    await page.locator('[data-marcador="C-0019"]').focus();
    await page.keyboard.press('Enter');
    await expect(lugar(page)).toHaveText('Av. Amadeo Sabattini al 4700');
  });

  test('la dirección ?lugar= abre un lugar (la ficha vuelve con «Ver en el mapa»)', async ({ page }) => {
    await page.goto('/priorizacion?lugar=C-0025');
    await expect(lugar(page)).toHaveText('Av. Colón al 5300');
    await expect(filas(page).nth(5)).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('CU05 · filtros', () => {
  test('ámbito: sólo rutas, conservando el puesto provincial', async ({ page }) => {
    await page.getByLabel('Ámbito').selectOption({ label: 'Sólo rutas' });
    await expect(conteo(page)).toContainText('de 38 concentraciones significativas');
    await expect(filas(page).nth(0)).toContainText('RN 9 · km 694 a 695');
    await expect(filas(page).nth(1)).toContainText('RN 19 · km 312 a 313');
    await expect(filas(page).nth(1).locator('td').first()).toHaveText('3');
    await expect(filas(page).filter({ hasText: 'Av. ' })).toHaveCount(0);
  });

  test('ámbito calles y vía puntual', async ({ page }) => {
    await page.getByLabel('Ámbito').selectOption({ label: 'Sólo calles' });
    await expect(filas(page).nth(0)).toContainText('Av. Vélez Sarsfield al 1200');
    await expect(lugar(page)).toHaveText('Av. Vélez Sarsfield al 1200');
    await page.getByLabel('Ámbito').selectOption({ label: 'Provincia de Córdoba' });
    await page.getByLabel('Vía').selectOption('RN 9');
    await expect(conteo(page)).toHaveText('5 de 38 concentraciones significativas');
    await expect(filas(page)).toHaveCount(5);
    await expect(filas(page).nth(1).locator('td').first()).toHaveText('12');
  });

  test('tipo de usuario vulnerable', async ({ page }) => {
    await page.getByLabel('Usuario vulnerable').selectOption({ label: 'Peatones' });
    await expect(conteo(page)).toHaveText('6 de 38 concentraciones significativas');
    await expect(filas(page).nth(0)).toContainText('Av. Vélez Sarsfield al 1200');
  });

  test('período: recalcula las concentraciones con los años elegidos', async ({ page }) => {
    await page.getByLabel('Período desde').selectOption('2024');
    await expect(conteo(page)).toHaveText('11 concentraciones significativas');
    await page.getByLabel('Período hasta').selectOption('2026');
    await page.getByLabel('Período desde').selectOption('2021');
    await expect(conteo(page)).toHaveText('39 concentraciones significativas');
  });

  test('4.a: ningún lugar cumple el filtro y se sugiere ampliar el período', async ({ page }) => {
    await page.getByLabel('Período desde').selectOption('2025');
    await page.getByLabel('Usuario vulnerable').selectOption({ label: 'Peatones' });
    await expect(page.getByText('Ningún lugar cumple el filtro')).toBeVisible();
    await expect(conteo(page)).toHaveText('0 de 1 concentraciones significativas');
    await page.getByRole('button', { name: 'Ampliar el período a 2021 a 2026' }).click();
    await expect(conteo(page)).toHaveText('6 de 39 concentraciones significativas');
    await expect(filas(page).nth(0)).toContainText('Av. Vélez Sarsfield al 1200');
  });
});

test.describe('CU05 → CU06 · emitir la ficha', () => {
  test('el lugar con ficha abre esa ficha (RN 9 → FI-2026-0042)', async ({ page }) => {
    await expect(page.locator('[data-prueba="ficha-vigente"]')).toContainText('FI-2026-0042');
    await page.getByRole('button', { name: 'Emitir ficha de intervención' }).click();
    await expect(page).toHaveURL(/\/priorizacion\/fichas\/FI-2026-0042$/);
  });

  test('un lugar sin ficha abre el borrador de la ficha nueva para esa concentración', async ({ page }) => {
    await filas(page).nth(3).click();
    await expect(lugar(page)).toHaveText('Av. Amadeo Sabattini al 4700');
    await expect(page.locator('[data-prueba="ficha-vigente"]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Emitir ficha de intervención' }).click();
    await expect(page).toHaveURL(/\/priorizacion\/fichas\/nueva\?concentracion=C-0019$/);
  });
});

test.describe('CU04 · actualizar concentraciones', () => {
  test('sin cambios desde el último cálculo: fecha, hora y quién', async ({ page }) => {
    await expect(page.locator('[data-prueba="ultimo-calculo"]')).toContainText('09/09/2026');
    await page.getByRole('button', { name: 'Actualizar concentraciones' }).click();
    const r = page.locator('[data-prueba="actualizacion"]');
    await expect(r).toContainText(/Concentraciones actualizadas el 09\/09\/2026 a las \d\d:\d\d/);
    await expect(r).toContainText('por R. Quiroga: 38 concentraciones significativas entre 2021 y 2025');
    await expect(r).toContainText('sin cambios.');
    await r.getByRole('button', { name: 'Cerrar el resultado de la actualización' }).click();
    await expect(r).toHaveCount(0);
  });

  test('tras pasar siniestros a revisión, informa la concentración retirada', async ({ page }) => {
    await expect(page.locator('[data-prueba="ultimo-calculo"]')).toBeVisible();
    // Los siniestros de Av. Colón al 5300 dejan de estar confirmados (como si se corrigieran en CU03).
    const cambiados = await page.evaluate(() => {
      type S = {
        ubicacion: { estado: string } | null;
        lugarExtraido: { calle?: string; altura?: number } | null;
      };
      const datos = JSON.parse(localStorage.getItem('punto-ciego:v1')!);
      const colon = (datos.state.siniestros as S[]).filter(
        (x) => x.lugarExtraido?.calle === 'Av. Colón' && Math.abs((x.lugarExtraido.altura ?? 0) - 5300) <= 100 && x.ubicacion?.estado === 'confirmada',
      );
      for (const x of colon) x.ubicacion!.estado = 'en-revision';
      localStorage.setItem('punto-ciego:v1', JSON.stringify(datos));
      return colon.length;
    });
    expect(cambiados).toBeGreaterThanOrEqual(2);
    await page.reload();
    await expect(conteo(page)).toHaveText('37 concentraciones significativas');
    await page.getByRole('button', { name: 'Actualizar concentraciones' }).click();
    const r = page.locator('[data-prueba="actualizacion"]');
    await expect(r).toContainText('1 retirada');
    await expect(r).toContainText('Dejó de ser significativa: C-0025 Av. Colón al 5300');
  });
});

test.describe('móvil', () => {
  test('lista primero, mapa plegable debajo y sin desplazamiento horizontal', async ({ page }) => {
    test.skip(!esMovil(page), 'sólo en el proyecto móvil');
    const lista = await filas(page).first().boundingBox();
    const boton = page.getByRole('button', {
      name: 'Ver en el mapa de la provincia',
    });
    await expect(boton).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('[data-marcador="C-0007"]')).toBeHidden();
    const b = await boton.boundingBox();
    expect(b!.y).toBeGreaterThan(lista!.y);
    await boton.click();
    await expect(page.getByRole('button', { name: 'Ocultar el mapa' })).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-marcador="C-0007"]')).toBeVisible();
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(desborde).toBeLessThanOrEqual(0);
  });
});
