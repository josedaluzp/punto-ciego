import { expect, test, type Page } from './fixtures';

/**
 * Feature bandeja: CU09 (superficie), CU10 Consultar bandeja de reclamos
 * desatendidos y CU11 Registrar resolución del lugar (RF16 a RF18).
 */

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
const filas = (page: Page) => page.locator('table[aria-label] tbody tr');
const fila = (page: Page, numero: string) => filas(page).filter({ hasText: numero });

async function riel(page: Page) {
  if (esMovil(page)) await page.getByRole('button', { name: 'Menú' }).click();
  return page.getByRole('navigation', { name: 'Paquetes del sistema' });
}

async function comoUsuario(page: Page, etiqueta: string) {
  await page.getByLabel('Usuario de demostración').selectOption({ label: etiqueta });
}

let errores: string[] = [];
test.beforeEach(({ page }) => {
  errores = vigilarErrores(page);
});
test.afterEach(() => {
  expect(errores, errores.join('\n')).toEqual([]);
});

test.describe('CU10 · bandeja', () => {
  test('ordena por siniestros posteriores y días sin respuesta, y tiñe la fila por estado', async ({ page }) => {
    await page.goto('/reclamos');
    await expect(page.getByRole('heading', { level: 1, name: 'Bandeja de reclamos desatendidos' })).toBeVisible();
    await expect(page.getByText('3 con alerta · 29 abiertos sin alerta')).toBeVisible();
    await expect(filas(page)).toHaveCount(32);

    const numeros = await filas(page).locator('.registro').allTextContents();
    expect(numeros.slice(0, 4)).toEqual(['PN-2026-0131', 'PN-2026-0186', 'PN-2026-0204', 'PN-2026-0157']);
    expect(numeros.at(-1)).toBe('PN-2026-0160');

    for (const n of ['PN-2026-0131', 'PN-2026-0186', 'PN-2026-0204']) await expect(fila(page, n)).toHaveAttribute('data-estado', 'alerta');
    await expect(fila(page, 'PN-2026-0157')).not.toHaveAttribute('data-estado', /.+/);

    await expect(fila(page, 'PN-2026-0131')).toContainText('146');
    await expect(fila(page, 'PN-2026-0131')).toContainText('2');
    await expect(fila(page, 'PN-2026-0186')).toContainText('en verificación');
    await expect(fila(page, 'PN-2026-0204')).toContainText('reabierto');
    await expect(fila(page, 'PN-2026-0204').getByRole('img', { name: 'Ruta nacional 36' })).toBeVisible();
    await expect(fila(page, 'PN-2026-0204').getByLabel('kilómetro 612')).toBeVisible();
    const piaggio = fila(page, 'PN-2026-0160');
    await expect(piaggio).toContainText('Agustín Piaggio al 1000');
    await expect(piaggio).toContainText('caso documentado');
    await expect(piaggio).toContainText('s/d');
  });

  test('la marca de cierre desmentido de PN-2026-0204 se ve en la bandeja y en el detalle', async ({ page }) => {
    await page.goto('/reclamos');
    if (!esMovil(page)) await expect(fila(page, 'PN-2026-0204')).toContainText('cierre desmentido');
    await page.goto('/reclamos/PN-2026-0204');
    const marca = page.locator('[data-prueba="cierre-desmentido"]');
    await expect(marca).toContainText('Cierre desmentido por siniestro');
    await expect(marca).toContainText('M. Ferreyra lo cerró el 20/07/2026 por obra ejecutada');
    await expect(marca).toContainText('OT-2026-0877');
    await expect(page.getByText('Presentado el 07/07/2026')).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toHaveText('reabierto');
  });

  test('vista de todos los reclamos con filtro por estado', async ({ page }) => {
    await page.goto('/reclamos');
    await page.getByLabel('Vista', { exact: true }).selectOption('todos');
    await expect(page).toHaveURL(/vista=todos/);
    await expect(page.getByRole('heading', { level: 1, name: 'Todos los reclamos' })).toBeVisible();
    await expect(filas(page)).toHaveCount(32);
    const nav = await riel(page);
    await expect(nav.getByRole('link', { name: /Todos\s*32/ })).toHaveAttribute('aria-current', 'page');
    if (esMovil(page)) await page.getByRole('button', { name: 'Menú' }).click();

    await page.getByLabel('Estado', { exact: true }).selectOption('reabierto');
    await expect(filas(page)).toHaveCount(1);
    await expect(filas(page).first()).toContainText('PN-2026-0204');
    await page.getByLabel('Estado', { exact: true }).selectOption('cerrado');
    await expect(page.getByText('No hay reclamos en este estado')).toBeVisible();

    await page.goto('/reclamos?vista=todos');
    const dias = page.getByRole('columnheader', { name: /Días/ });
    await dias.getByRole('button').click();
    await expect(dias).toHaveAttribute('aria-sort', 'descending');
    await expect(filas(page).first()).toContainText('PN-2026-0131');
  });

  test('elegir un reclamo: vista previa en escritorio, detalle en el teléfono', async ({ page }) => {
    await page.goto('/reclamos');
    await fila(page, 'PN-2026-0186').click();
    if (esMovil(page)) {
      await expect(page).toHaveURL(/\/reclamos\/PN-2026-0186$/);
      return;
    }
    const previa = page.getByRole('region', { name: 'Vista previa de PN-2026-0186' });
    await expect(previa.getByRole('heading', { name: 'Av. Colón al 5300' })).toBeVisible();
    await expect(previa.getByText('Foto ilustrativa · no es este punto')).toBeVisible();
    await expect(previa.getByText(/Inspección agendada para el 15\/09\/2026/)).toBeVisible();
    await expect(page.getByRole('button', { name: /^PN-2026-0186, Av\. Colón al 5300/ })).toHaveAttribute('aria-pressed', 'true');
    await previa.getByRole('link', { name: 'Abrir PN-2026-0186' }).click();
    await expect(page).toHaveURL(/\/reclamos\/PN-2026-0186$/);
  });

  test('el mapa cambia al plano provincial para un reclamo sobre ruta', async ({ page }) => {
    test.skip(esMovil(page), 'en el teléfono elegir abre el detalle');
    await page.goto('/reclamos');
    await fila(page, 'PN-2026-0204').click();
    await expect(page.getByRole('button', { name: 'Provincia' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: /^PN-2026-0204, RN 36/ })).toBeVisible();
  });

  test('CU09: una alerta nueva sobre PN-2026-0157 aparece en la bandeja y en el riel', async ({ page }) => {
    await page.goto('/reclamos');
    await expect(fila(page, 'PN-2026-0131')).toBeVisible();
    // Simula lo que deja guardarUbicacion al confirmar la crónica de Pablo Cabrera.
    await page.evaluate((clave) => {
      const g = JSON.parse(localStorage.getItem(clave)!);
      const s = g.state.siniestros.find((x: { ubicacion: { estado: string } | null }) => x.ubicacion?.estado === 'confirmada');
      g.state.reclamos = g.state.reclamos.map((r: Record<string, unknown> & { numero: string; alertas: unknown[]; siniestrosPosteriores: string[]; historial: unknown[] }) =>
        r.numero === 'PN-2026-0157'
          ? {
              ...r,
              alerta: true,
              alertas: [...r.alertas, { tipo: 'reclamo-desatendido', siniestroId: s.id, fecha: '2026-09-07', diasSinRespuesta: 90 }],
              siniestrosPosteriores: [...r.siniestrosPosteriores, s.id],
              historial: [...r.historial, { fecha: '2026-09-09T10:00:00', texto: 'Alerta de reclamo desatendido: 90 días sin respuesta', tipo: 'alerta' }],
            }
          : r,
      );
      localStorage.setItem(clave, JSON.stringify(g));
    }, CLAVE);
    await page.reload();
    await expect(page.getByText('4 con alerta · 28 abiertos sin alerta')).toBeVisible();
    await expect(fila(page, 'PN-2026-0157')).toHaveAttribute('data-estado', 'alerta');
    const numeros = await filas(page).locator('.registro').allTextContents();
    expect(numeros.slice(0, 4)).toContain('PN-2026-0157');
    const nav = await riel(page);
    await expect(nav.getByRole('link', { name: /Desatendidos\s*4/ })).toBeVisible();
  });
});

test.describe('CU10 · detalle y agendar inspección', () => {
  test('el detalle muestra descripción, foto, siniestros posteriores con distancia, croquis, mapa e historia', async ({ page }) => {
    await page.goto('/reclamos/PN-2026-0186');
    await expect(page.getByRole('heading', { level: 2, name: /Av\. Colón al 5300/ })).toBeVisible();
    await expect(page.getByText('Presentado el 21/05/2026 · 111 días sin respuesta · 1 siniestro posterior al reclamo')).toBeVisible();
    await expect(page.getByText('«Pozo grande en el carril derecho')).toBeVisible();
    await expect(page.getByRole('img', { name: 'Fotografía adjunta al reclamo PN-2026-0186' })).toBeVisible();
    await expect(page.getByText(/Ubicación confirmada a\s+\d+ m del lugar reclamado/)).toBeVisible();
    await expect(page.getByText(/Crónica de origen:/)).toBeVisible();
    await expect(page.getByText('El reclamo lleva 111 días sin respuesta')).toBeVisible();
    await expect(page.getByText('Posición ilustrativa')).toBeVisible();
    await expect(page.getByRole('group', { name: /Mapa del lugar reclamado/ })).toBeVisible();
    const historial = page.locator('[data-prueba="historial"]');
    await expect(historial).toContainText('Reclamo presentado con fotografía');
    await expect(historial).toContainText('R. Quiroga · Técnico de tránsito');
    await expect(page.locator('[data-prueba="inspeccion"]')).toContainText('15/09/2026');
  });

  test('el caso documentado cita su evidencia real sin reproducir la foto del medio', async ({ page }) => {
    await page.goto('/reclamos/PN-2026-0160');
    await expect(page.getByText('Evidencia documental verificada')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver la nota y su fotografía en el medio' })).toHaveAttribute('href', /cadena3\.com/);
    await expect(page.getByText('Sin fecha de inicio informada')).toBeVisible();
    await expect(page.locator('img[alt^="Fotografía adjunta"]')).toHaveCount(0);
  });

  test('agendar la inspección pasa a en verificación, registra quién y persiste', async ({ page }) => {
    await page.goto('/reclamos/PN-2026-0131');
    await expect(page.locator('[aria-current="step"]')).toHaveText('abierto');
    await page.getByLabel('Fecha de la inspección').fill('2026-09-16');
    await page.getByRole('button', { name: 'Agendar inspección' }).click();
    await expect(page.getByText('PN-2026-0131 pasó a en verificación')).toBeVisible();
    await expect(page.locator('[aria-current="step"]')).toHaveText('en verificación');
    await expect(page.locator('[data-prueba="inspeccion"]')).toContainText('16/09/2026 por R. Quiroga');
    await expect(page.locator('[data-prueba="historial"]')).toContainText('Inspección agendada para el 16/09/2026');

    await page.reload();
    await expect(page.locator('[aria-current="step"]')).toHaveText('en verificación');
    await expect(page.getByText('Presentado el 16/04/2026 · 146 días sin respuesta')).toBeVisible();
    await page.goto('/reclamos');
    await expect(fila(page, 'PN-2026-0131')).toContainText('en verificación');
    await expect(filas(page).first()).toContainText('PN-2026-0131');
  });

  test('una fecha pasada no habilita agendar; el analista no agenda', async ({ page }) => {
    await page.goto('/reclamos/PN-2026-0131');
    await page.getByLabel('Fecha de la inspección').fill('2026-09-01');
    await expect(page.getByText('Elegí hoy o una fecha posterior.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agendar inspección' })).toBeDisabled();
    await comoUsuario(page, 'L. Ahumada · Analista de siniestralidad');
    await expect(page.getByRole('button', { name: 'Agendar inspección' })).toHaveCount(0);
    await expect(page.getByText(/La inspección la agenda el técnico de tránsito o el funcionario a cargo/)).toBeVisible();
  });

  test('un número inexistente lleva de vuelta a la bandeja', async ({ page }) => {
    await page.goto('/reclamos/PN-2026-9999');
    await expect(page.getByText('No hay ningún reclamo con el número PN-2026-9999')).toBeVisible();
    await page.getByRole('link', { name: 'Volver a la bandeja' }).click();
    await expect(page).toHaveURL(/\/reclamos$/);
  });
});

test.describe('CU11 · cerrar reclamo', () => {
  test('el analista y el técnico no pueden cerrar; el funcionario sí', async ({ page }) => {
    await page.goto('/reclamos/PN-2026-0186');
    const firmar = page.getByRole('button', { name: 'Firmar y cerrar' });
    for (const u of ['L. Ahumada · Analista de siniestralidad', 'R. Quiroga · Técnico de tránsito']) {
      await comoUsuario(page, u);
      await expect(page.locator('[data-prueba="sin-permiso"]')).toContainText('Sólo el funcionario a cargo registra el cierre');
      await expect(page.getByRole('radio', { name: 'Obra ejecutada' })).toBeDisabled();
      await expect(firmar).toBeDisabled();
    }
    await comoUsuario(page, 'M. Ferreyra · Funcionario a cargo');
    await expect(page.locator('[data-prueba="sin-permiso"]')).toHaveCount(0);
    await expect(page.getByRole('radio', { name: 'Obra ejecutada' })).toBeEnabled();
    await expect(page.getByText(/firma M\. Ferreyra, Funcionario a cargo, Ingeniería de Tránsito/)).toBeVisible();
  });

  test('sin respaldo no se habilita (4.a); con respaldo cierra firmado, sale de la bandeja y persiste', async ({ page }) => {
    await page.goto('/reclamos/PN-2026-0186');
    await comoUsuario(page, 'M. Ferreyra · Funcionario a cargo');
    const firmar = page.getByRole('button', { name: 'Firmar y cerrar' });
    await page.getByRole('radio', { name: 'Obra ejecutada' }).check();
    await expect(page.locator('[data-prueba="errores-cierre"]')).toContainText('Hace falta al menos un respaldo');
    await expect(firmar).toBeDisabled();
    await page.getByRole('checkbox', { name: 'Número de orden de trabajo' }).check();
    await expect(firmar).toBeDisabled();
    await page.getByLabel('N.º de orden de trabajo').fill('OT-2026-0912');
    await expect(firmar).toBeEnabled();
    await firmar.click();

    await expect(page.getByText('PN-2026-0186 cerrado')).toBeVisible();
    const res = page.locator('[data-prueba="resolucion"]');
    await expect(res).toContainText('obra ejecutada');
    await expect(res).toContainText('orden de trabajo: OT-2026-0912');
    await expect(res).toContainText('M. Ferreyra · Funcionario a cargo, Ingeniería de Tránsito');
    await expect(res).toContainText('09/09/2026');
    await expect(page.locator('[aria-current="step"]')).toHaveText('cerrado');
    await expect(page.locator('[data-prueba="historial"]')).toContainText('Cerrado por obra ejecutada');

    await page.reload();
    await expect(page.locator('[data-prueba="resolucion"]')).toContainText('OT-2026-0912');

    await page.goto('/reclamos');
    await expect(page.getByText('2 con alerta · 29 abiertos sin alerta')).toBeVisible();
    await expect(fila(page, 'PN-2026-0186')).toHaveCount(0);
    const nav = await riel(page);
    await expect(nav.getByRole('link', { name: /Desatendidos\s*2/ })).toBeVisible();
    await page.goto('/reclamos?vista=todos&estado=cerrado');
    await expect(fila(page, 'PN-2026-0186')).toHaveAttribute('data-estado', 'cerrado');
  });

  test('la fotografía de la obra sirve de respaldo', async ({ page }) => {
    await page.goto('/reclamos/PN-2026-0204');
    await comoUsuario(page, 'M. Ferreyra · Funcionario a cargo');
    await page.getByRole('radio', { name: 'Deterioro no constatado' }).check();
    await page.getByRole('checkbox', { name: 'Fotografía de la obra terminada' }).check();
    await page.getByLabel('Archivo de la fotografía').setInputFiles({ name: 'obra-rn36-km612.jpg', mimeType: 'image/jpeg', buffer: Buffer.from([0xff, 0xd8, 0xff]) });
    await expect(page.getByText('Adjunta: obra-rn36-km612.jpg')).toBeVisible();
    await page.getByRole('button', { name: 'Firmar y cerrar' }).click();
    await expect(page.locator('[data-prueba="resolucion"]')).toContainText('fotografía de la obra: obra-rn36-km612.jpg');
  });

  test('decidir no cerrar (5.a) deja el reclamo en su estado', async ({ page }) => {
    await page.goto('/reclamos/PN-2026-0131');
    await comoUsuario(page, 'M. Ferreyra · Funcionario a cargo');
    await page.getByRole('radio', { name: 'Otra jurisdicción o duplicado' }).check();
    await page.getByRole('button', { name: 'No cerrar' }).click();
    await expect(page.getByText('El reclamo no se cerró')).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Otra jurisdicción o duplicado' })).not.toBeChecked();
    await expect(page.locator('[aria-current="step"]')).toHaveText('abierto');
  });
});

test('ninguna pantalla de la bandeja desborda a 390 px', async ({ page }) => {
  test.skip(!esMovil(page), 'sólo en el proyecto móvil');
  for (const ruta of ['/reclamos', '/reclamos?vista=todos', '/reclamos/PN-2026-0186', '/reclamos/PN-2026-0204', '/reclamos/PN-2026-0160']) {
    await page.goto(ruta);
    await expect(page.locator('main#contenido')).toBeVisible();
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(desborde, `${ruta} desborda ${desborde} px`).toBeLessThanOrEqual(0);
  }
});
