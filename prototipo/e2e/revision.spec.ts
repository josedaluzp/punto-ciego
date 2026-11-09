import { expect, test, type Page } from '@playwright/test';

/** CU03 Revisar ubicación de baja confianza (RF08, RF09) · Figura 16. */

const CLAVE = 'punto-ciego:v1';
const esMovil = (page: Page) => (page.viewportSize()?.width ?? 1440) < 600;

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(String(e)));
  return errores;
}

interface UbicacionGuardada {
  estado: string;
  metodo: string;
  confianza: number;
  lat: number;
  lon: number;
  km?: number;
  revisadaPor?: string;
  revisadaEn?: string;
}

async function ubicacionGuardada(page: Page, fragmento: string): Promise<UbicacionGuardada> {
  return page.evaluate(
    ([clave, frag]) => {
      const datos = JSON.parse(localStorage.getItem(clave!)!).state;
      const s = datos.siniestros.find((x: { lugarExtraido?: { texto: string } }) => x.lugarExtraido?.texto.includes(frag!));
      return s.ubicacion;
    },
    [CLAVE, fragmento],
  );
}

async function conteoRiel(page: Page, entrada: string | RegExp) {
  if (esMovil(page)) await page.getByRole('button', { name: 'Menú' }).click();
  const link = page.getByRole('navigation', { name: 'Paquetes del sistema' }).getByRole('link', { name: entrada });
  const texto = (await link.innerText()).replace(/\s+/g, ' ');
  if (esMovil(page)) await page.getByRole('button', { name: 'Menú' }).click();
  return Number(/(\d+)\s*$/.exec(texto)![1]);
}

const lista = (page: Page) => page.getByRole('region', { name: 'Ubicaciones pendientes de revisión' });
const elegir = (page: Page, nombre: RegExp) => lista(page).getByRole('button', { name: nombre }).click();
const posicion = (page: Page) => page.locator('[data-prueba="posicion"]');
const resultado = (page: Page) => page.locator('[data-prueba="resultado"]');
const revisadas = (page: Page) => page.locator('[data-prueba="revisadas"]');

let errores: string[] = [];

test.beforeEach(async ({ page }) => {
  errores = vigilarErrores(page);
  await page.goto('/siniestros/revision');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Ubicaciones en revisión' })).toBeVisible();
});

test.afterEach(() => {
  expect(errores, errores.join('\n')).toEqual([]);
});

test('muestra las tres ubicaciones de la Figura 16 con crónica, método, confianza y motivo', async ({ page }) => {
  const items = lista(page).getByRole('button');
  await expect(items).toHaveCount(3);
  await expect(lista(page).getByRole('button', { name: /Av\. Circunvalación.*a la altura de barrio Los Boulevares.*corredor.*0,41/ })).toBeVisible();
  await expect(lista(page).getByRole('button', { name: /Barrio Villa El Libertador.*sin calle en el texto.*barrio.*0,22/ })).toBeVisible();
  await expect(lista(page).getByRole('button', { name: /RN 36, km 790.*progresiva fuera de la capa.*progresiva.*0,55/ })).toBeVisible();
  expect(await conteoRiel(page, /En revisión/)).toBe(3);

  await elegir(page, /Av\. Circunvalación/);
  await expect(page.getByRole('heading', { level: 2, name: 'Av. Circunvalación' })).toBeVisible();
  await expect(page.locator('mark')).toHaveText('avenida Circunvalación a la altura de barrio Los Boulevares');
  await expect(page.getByText('Medio local de ejemplo · 03/09/2026')).toBeVisible();
  await expect(page.getByText('servicio de normalización')).toBeVisible();
  await expect(page.getByRole('meter', { name: 'Confianza 0,41, umbral 0,70' })).toBeVisible();
  await expect(page.getByText(/margen de cientos de metros/)).toBeVisible();
  await expect(page.getByText('Hasta que se confirme, el siniestro no interviene en ningún cálculo.')).toBeVisible();
  await expect(page.getByRole('group', { name: /Mapa de la ciudad de Córdoba con la ubicación de Av\. Circunvalación/ })).toBeVisible();
});

test('confirmar la propuesta: queda registrado quién y cuándo, baja el riel y persiste al recargar', async ({ page }) => {
  await page.getByLabel('Usuario de demostración').selectOption({ label: 'L. Ahumada · Analista de siniestralidad' });
  await elegir(page, /Av\. Circunvalación/);
  const antes = await ubicacionGuardada(page, 'Circunvalación a la altura de barrio Los Boulevares');
  await page.getByRole('button', { name: 'Confirmar la propuesta' }).click();

  await expect(resultado(page)).toContainText('Ubicación de Av. Circunvalación confirmada por L. Ahumada.');
  await expect(resultado(page)).toContainText('Ya interviene en los cálculos');
  await expect(lista(page).getByRole('button')).toHaveCount(2);
  await expect(page.getByText('CU03 · 2 pendientes · umbral 0,70')).toBeVisible();
  expect(await conteoRiel(page, /En revisión/)).toBe(2);
  await expect(revisadas(page)).toContainText('Av. Circunvalación');
  await expect(revisadas(page)).toContainText('Propuesta confirmada');
  await expect(revisadas(page)).toContainText(/L\. Ahumada · 09\/09\/2026 \d\d:\d\d/);

  const u = await ubicacionGuardada(page, 'Circunvalación a la altura de barrio Los Boulevares');
  expect(u).toMatchObject({ estado: 'confirmada', metodo: antes.metodo, confianza: 0.41, lat: antes.lat, lon: antes.lon, revisadaPor: 'L. Ahumada' });
  expect(u.revisadaEn).toMatch(/^2026-09-09T/);

  await page.reload();
  await expect(lista(page).getByRole('button')).toHaveCount(2);
  await expect(lista(page).getByRole('button', { name: /Av\. Circunvalación/ })).toHaveCount(0);
  await expect(revisadas(page)).toContainText('Propuesta confirmada');
  expect(await conteoRiel(page, /En revisión/)).toBe(2);
});

test('corregir arrastrando el marcador: método manual y confianza 1', async ({ page }) => {
  test.skip(esMovil(page), 'el arrastre con puntero se prueba en escritorio; en móvil, con teclado');
  await elegir(page, /Barrio Villa El Libertador/);
  const antes = await posicion(page).innerText();
  const marcador = page.locator('[data-marcador="posicion"]');
  const caja = (await marcador.boundingBox())!;
  const x = caja.x + caja.width / 2;
  const y = caja.y + caja.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y - 30, { steps: 6 });
  await page.mouse.move(x + 90, y - 60, { steps: 6 });
  await page.mouse.up();

  await expect(page.getByText('Posición corregida', { exact: true })).toBeVisible();
  await expect(posicion(page)).not.toHaveText(antes);
  await expect(page.locator('[data-marcador="propuesta"]')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar posición corregida' }).click();

  await expect(resultado(page)).toContainText('Ubicación de Barrio Villa El Libertador corregida y confirmada por R. Quiroga.');
  await expect(revisadas(page)).toContainText('Corregida a mano · confianza 1,00');
  const u = await ubicacionGuardada(page, 'barrio Villa El Libertador');
  expect(u).toMatchObject({ estado: 'confirmada', metodo: 'manual', confianza: 1, revisadaPor: 'R. Quiroga' });
  expect(u.lat).toBeGreaterThan(-31.473);
});

test('corregir con el teclado: el marcador se mueve con las flechas', async ({ page }) => {
  await elegir(page, /Av\. Circunvalación/);
  const antes = await ubicacionGuardada(page, 'Circunvalación a la altura de barrio Los Boulevares');
  const marcador = page.locator('[data-marcador="posicion"]');
  await expect(marcador).toHaveAttribute('aria-label', /Arrastrable: usá las flechas/);
  await marcador.focus();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  await expect(marcador).toBeFocused();
  await expect(page.getByText('Posición corregida', { exact: true })).toBeVisible();

  // "Volver a la propuesta" descarta el borrador.
  await page.getByRole('button', { name: 'Volver a la propuesta' }).click();
  await expect(page.getByText('Coordenada propuesta', { exact: true })).toBeVisible();
  await marcador.focus();
  await page.keyboard.press('Shift+ArrowUp');
  await page.getByRole('button', { name: 'Confirmar posición corregida' }).focus();
  await page.keyboard.press('Enter');

  // El foco pasa al resultado, porque el botón ya no existe.
  await expect(resultado(page).locator('..')).toBeFocused();
  const u = await ubicacionGuardada(page, 'Circunvalación a la altura de barrio Los Boulevares');
  expect(u).toMatchObject({ estado: 'confirmada', metodo: 'manual', confianza: 1 });
  // Mayúscula + flecha arriba: 5 pasos de 20 m hacia el norte.
  expect(u.lat - antes.lat).toBeGreaterThan(0.0008);
  expect(u.lon).toBeCloseTo(antes.lon, 5);
});

test('corregir por progresiva sobre la ruta: el km fuera de la capa se rechaza y el siniestro entra en C-0031', async ({ page }) => {
  await elegir(page, /RN 36, km 790/);
  await expect(page.getByText('La capa de postes de la RN 36 va del km 600 al 770: el km 790 no figura. Se propone Río Cuarto, a falta de un poste.')).toBeVisible();
  const campo = page.getByLabel('Progresiva (km)');
  await campo.fill('790');
  await page.getByRole('button', { name: 'Ubicar en el km' }).click();
  await expect(campo).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('La capa de postes de la RN 36 va del km 600 al 770: el km 790 no figura.', { exact: true })).toBeVisible();

  await campo.fill('700,5');
  await page.getByRole('button', { name: 'Ubicar en el km' }).click();
  await expect(posicion(page)).toContainText('km 700,5');

  // El croquis del tramo también corrige: flecha derecha, un km más.
  const croquis = page.getByRole('slider', { name: 'Progresiva de la posición sobre la RN 36' });
  await croquis.focus();
  await page.keyboard.press('ArrowRight');
  await expect(posicion(page)).toContainText('km 701,5');
  await page.keyboard.press('ArrowLeft');
  await expect(posicion(page)).toContainText('km 700,5');

  await page.getByRole('button', { name: 'Confirmar posición corregida' }).click();
  await expect(resultado(page)).toContainText('Ubicación de RN 36, km 790 corregida y confirmada');
  // CU04: el siniestro confirmado entra en la priorización.
  await expect(resultado(page)).toContainText('integra la concentración C-0031 · RN 36 · km 700 a 701');
  const u = await ubicacionGuardada(page, 'kilómetro 790');
  expect(u).toMatchObject({ estado: 'confirmada', metodo: 'manual', confianza: 1, km: 700.5 });

  await resultado(page).getByRole('link', { name: 'Ver lugares priorizados' }).click();
  await expect(page).toHaveURL(/\/priorizacion$/);
});

test('descartar: pide confirmación y el siniestro queda fuera de los cálculos', async ({ page }) => {
  await elegir(page, /Barrio Villa El Libertador/);
  await page.getByRole('button', { name: 'Descartar ubicación' }).click();
  await expect(page.getByText('El siniestro queda sin ubicación y fuera de todo cálculo.')).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar' }).click();
  await expect(lista(page).getByRole('button')).toHaveCount(3);

  await page.getByRole('button', { name: 'Descartar ubicación' }).click();
  await page.getByRole('button', { name: 'Sí, descartar' }).click();
  await expect(resultado(page)).toContainText('Ubicación de Barrio Villa El Libertador descartada por R. Quiroga.');
  await expect(resultado(page)).toContainText('El siniestro queda sin ubicación y no participa de los cálculos.');
  await expect(revisadas(page)).toContainText('Descartada');
  expect(await conteoRiel(page, /En revisión/)).toBe(2);
  expect(await ubicacionGuardada(page, 'barrio Villa El Libertador')).toMatchObject({ estado: 'descartada', revisadaPor: 'R. Quiroga' });

  await page.reload();
  await expect(revisadas(page)).toContainText('Descartada');
  await expect(lista(page).getByRole('button')).toHaveCount(2);
});

test('al confirmar corre CU09 y muestra la alerta de un reclamo desatendido cercano', async ({ page }) => {
  // Un reclamo sintético presentado antes del siniestro, a unos 20 m de la propuesta.
  await page.evaluate((clave) => {
    const g = JSON.parse(localStorage.getItem(clave)!);
    const s = g.state.siniestros.find((x: { lugarExtraido?: { texto: string } }) => x.lugarExtraido?.texto.includes('a la altura de barrio Los Boulevares'));
    const base = g.state.reclamos.find((r: { numero: string }) => r.numero === 'PN-2026-0157');
    g.state.reclamos.push({ ...base, numero: 'PN-2026-0999', lat: s.ubicacion.lat + 0.0002, lon: s.ubicacion.lon, alerta: false, alertas: [], siniestrosPosteriores: [] });
    localStorage.setItem(clave, JSON.stringify(g));
  }, CLAVE);
  await page.reload();
  const desatendidos = await conteoRiel(page, /Desatendidos/);

  await elegir(page, /Av\. Circunvalación/);
  await page.getByRole('button', { name: 'Confirmar la propuesta' }).click();
  await expect(page.getByText('Alerta de reclamo desatendido: PN-2026-0999', { exact: true })).toBeVisible();
  await expect(resultado(page)).toContainText(/Alerta de reclamo desatendido: PN-2026-0999, a 2\d m\./);
  expect(await conteoRiel(page, /Desatendidos/)).toBe(desatendidos + 1);
  await resultado(page).getByRole('link', { name: 'Abrir PN-2026-0999' }).click();
  await expect(page).toHaveURL(/\/reclamos\/PN-2026-0999$/);
});

test('sin pendientes muestra el estado vacío y el riel en cero', async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await lista(page).getByRole('button').first().click();
    await page.getByRole('button', { name: 'Confirmar la propuesta' }).click();
    await expect(lista(page).getByRole('button')).toHaveCount(2 - i);
  }
  await expect(page.getByText('No quedan ubicaciones en revisión')).toBeVisible();
  await expect(page.getByText('Ninguna ubicación espera revisión.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ir a las crónicas' })).toBeVisible();
  expect(await conteoRiel(page, /En revisión/)).toBe(0);
  await expect(revisadas(page).getByRole('listitem')).toHaveCount(3);
});
