import { expect, test, type Page } from '@playwright/test';

/**
 * Regresiones de los hallazgos del reporte de pruebas k0lmenIA (2026-11-09).
 * Cada bloque lleva el ID del hallazgo que cubre.
 */

/** Elementos genéricos (span, div) con `aria-label` y sin rol: el nombre no se anuncia (axe `aria-prohibited-attr`). */
const etiquetasSinRol = (page: Page) =>
  page.locator('span[aria-label]:not([role]), div[aria-label]:not([role]), small[aria-label]:not([role]), b[aria-label]:not([role])').evaluateAll((els) =>
    els.map((e) => e.getAttribute('aria-label')),
  );

test.describe('KT-01 · nombre accesible del mojón y de la confianza', () => {
  test('el mojón kilométrico se anuncia como imagen con su nombre', async ({ page }) => {
    await page.goto('/priorizacion');
    await expect(page.getByRole('img', { name: /^kilómetro \d/ }).first()).toBeVisible();
  });

  test('la confianza de cada ubicación pendiente forma parte del nombre del ítem', async ({ page }) => {
    await page.goto('/siniestros/revision');
    await expect(page.getByRole('button', { name: /confianza \d,\d\d/ }).first()).toBeVisible();
  });

  for (const ruta of ['/priorizacion', '/siniestros/cronicas', '/siniestros/revision', '/reclamos', '/componentes']) {
    test(`ningún span o div de ${ruta} lleva aria-label sin rol`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page.locator('main')).toBeVisible();
      expect(await etiquetasSinRol(page)).toEqual([]);
    });
  }
});

test.describe('KT-02 · el nombre del encabezado ordenable empieza con el texto visible', () => {
  const esMovil = (page: Page) => (page.viewportSize()?.width ?? 1440) < 600;
  // Sólo las columnas ordenables llevan botón: catálogo, emitir ficha y la bandeja en la vista «todos».
  const casos: { ruta: string; visible: string; completo: string; enMovil: boolean }[] = [
    { ruta: '/componentes', visible: 'Sin.', completo: 'Siniestros', enMovil: false },
    { ruta: '/componentes', visible: 'Fallec.', completo: 'Fallecidos', enMovil: true },
    { ruta: '/componentes', visible: 'Vulner.', completo: 'Vulnerables', enMovil: false },
    { ruta: '/priorizacion/fichas/nueva', visible: 'Sin.', completo: 'Siniestros', enMovil: false },
    { ruta: '/priorizacion/fichas/nueva', visible: 'Fallec.', completo: 'Fallecidos', enMovil: false },
    { ruta: '/reclamos?vista=todos', visible: 'Días', completo: 'Días sin respuesta', enMovil: true },
    { ruta: '/reclamos?vista=todos', visible: 'Sin.', completo: 'Siniestros posteriores al reclamo', enMovil: true },
  ];
  const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const c of casos) {
    test(`${c.ruta}: «${c.visible}» → ${c.completo}`, async ({ page }) => {
      test.skip(esMovil(page) && !c.enMovil, 'columna oculta en pantallas angostas');
      await page.goto(c.ruta);
      const encabezado = page.getByRole('columnheader').getByRole('button', {
        name: new RegExp(`^${escapar(c.visible)}.*${escapar(c.completo)}`),
      });
      await expect(encabezado).toBeVisible();
    });
  }
});

test.describe('KT-03 · área de toque de los marcadores del mapa', () => {
  // En el detalle del reclamo los marcadores son sólo imagen; en la priorización móvil el mapa no se muestra.
  for (const ruta of ['/reclamos', '/reclamos?vista=todos', '/priorizacion']) {
    test(`cada marcador interactivo de ${ruta} mide al menos 24 × 24 px`, async ({ page }) => {
      await page.goto(ruta);
      const marcadores = page.locator('[data-marcador][role="button"]');
      await expect(marcadores.first()).toBeAttached();
      const chicos = await marcadores.evaluateAll((els) =>
        els
          .map((e) => ({ id: e.getAttribute('data-marcador'), r: e.getBoundingClientRect() }))
          .filter(({ r }) => r.width > 0 && (r.width < 24 || r.height < 24))
          .map(({ id, r }) => `${id}: ${r.width.toFixed(1)} × ${r.height.toFixed(1)}`),
      );
      expect(chicos).toEqual([]);
    });
  }
});

test.describe('KT-04 · la tabla de la bandeja entra en pantallas angostas', () => {
  for (const ancho of [360, 390]) {
    test(`a ${ancho} px la tabla no desborda y «en verificación» se lee completo`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: 800 });
      await page.goto('/reclamos');
      const tabla = page.getByRole('table', { name: /reclamos/i });
      await expect(tabla).toBeVisible();
      const { scroll, cliente } = await tabla.evaluate((t) => {
        const c = t.parentElement!;
        return { scroll: c.scrollWidth, cliente: c.clientWidth };
      });
      expect(scroll).toBeLessThanOrEqual(cliente);

      const estado = tabla.getByText('en verificación').first();
      const caja = await estado.boundingBox();
      const cajaTabla = await tabla.evaluate((t) => t.parentElement!.getBoundingClientRect().toJSON() as DOMRect);
      expect(caja!.x + caja!.width).toBeLessThanOrEqual(cajaTabla.x + cajaTabla.width + 0.5);
    });
  }
});

test.describe('KT-05 · «ver la crónica» no apunta a dominios ficticios', () => {
  test('en el detalle del reclamo la crónica sintética abre dentro de la demo', async ({ page }) => {
    await page.goto('/reclamos/PN-2026-0131');
    const links = page.getByRole('link', { name: 'ver la crónica' });
    await expect(links.first()).toBeVisible();
    expect(await page.locator('a[href*=".example"]').count()).toBe(0);

    await links.first().click();
    await expect(page).toHaveURL(/\/siniestros\/cronicas\?siniestro=S-\d+/);
    await expect(page.getByText(/\.example\//).first()).toBeVisible();
  });
});

test.describe('KT-10 · calle y altura tienen largo máximo', () => {
  test('el formulario del vecino limita la calle a 80 caracteres y la altura a 5 dígitos', async ({ page }) => {
    await page.goto('/reclamo');
    await page.getByText('Prefiero escribir la calle y la altura').click();
    const calle = page.getByLabel('Calle', { exact: true });
    const altura = page.getByLabel('Altura', { exact: true });
    await expect(calle).toHaveAttribute('maxlength', '80');
    await expect(altura).toHaveAttribute('maxlength', '5');

    await calle.fill('A'.repeat(300));
    await expect(calle).toHaveValue('A'.repeat(80));
    await altura.pressSequentially('1234567');
    await expect(altura).toHaveValue('12345');
  });
});

test.describe('KT-11 · «Continuar» a la vista en el teléfono', () => {
  // Alto visible real con las barras del navegador del teléfono (390 × 844 nominal → ~664 útiles).
  for (const [ancho, alto] of [[390, 664], [360, 640], [390, 844]] as const) {
    test(`a ${ancho} × ${alto}, el botón principal del primer paso se ve sin desplazar`, async ({ page }) => {
      await page.setViewportSize({ width: ancho, height: alto });
      await page.goto('/reclamo');
      await expect(page.getByRole('group', { name: /Mapa de la ciudad/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continuar' })).toBeInViewport({ ratio: 1 });
    });
  }
});
