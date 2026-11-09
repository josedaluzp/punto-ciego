/**
 * CU08 Presentar reclamo vecinal (RF15): flujo normal con el mapa, con la
 * dirección escrita, cursos alternativos (sin foto, control no superado) y
 * validaciones; el reclamo queda abierto en "Todos" de la bandeja y persiste.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test, type Page } from '@playwright/test';

const CLAVE = 'punto-ciego:v1';
const FOTO = fileURLToPath(new URL('../public/fotos/foto-danio-1.jpg', import.meta.url));
/** Mitad de la cuadra de Av. Colón al 5300 en el nomenclador simulado (altura 5350). */
const COLON_5300 = { lat: -31.3948, lon: -64.2567 };
/** Un punto de Villa Cabrera a más de 120 m de toda calle del nomenclador simulado. */
const SIN_CALLE = { lat: -31.374, lon: -64.2 };

/** Ajuste lineal del plano de la ciudad (el mismo de `src/dominio/proyeccion.ts`). */
const AJUSTE: { ax: number; bx: number; ay: number; by: number } = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/datos/cartografia.json', import.meta.url)), 'utf8'),
).proyeccion.ciudad;
const aCiudad = (p: { lat: number; lon: number }) => ({ x: AJUSTE.ax * p.lon + AJUSTE.bx, y: AJUSTE.ay * p.lat + AJUSTE.by });

const esMovil = (page: Page) => (page.viewportSize()?.width ?? 1440) < 600;

function vigilarErrores(page: Page): string[] {
  const errores: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errores.push(m.text());
  });
  page.on('pageerror', (e) => errores.push(String(e)));
  return errores;
}

const mapa = (page: Page) => page.getByRole('group', { name: /Mapa de la ciudad de Córdoba/ });

/** Posición en pantalla de una lat/lon dentro del mapa de la ciudad. */
async function enPantalla(page: Page, p: { lat: number; lon: number }) {
  const { x, y } = aCiudad(p);
  return mapa(page).evaluate(
    (svg, punto) => {
      const ctm = (svg as SVGSVGElement).getScreenCTM()!;
      const q = new DOMPoint(punto.x, punto.y).matrixTransform(ctm);
      return { x: q.x, y: q.y };
    },
    { x, y },
  );
}

/** Toca (o hace clic en) el mapa sobre una lat/lon. */
async function tocarMapa(page: Page, p: { lat: number; lon: number }) {
  await expect(mapa(page)).toBeVisible();
  const q = await enPantalla(page, p);
  if (esMovil(page)) await page.touchscreen.tap(q.x, q.y);
  else await page.mouse.click(q.x, q.y);
}

async function cantidadReclamos(page: Page): Promise<number> {
  return page.evaluate((clave) => JSON.parse(localStorage.getItem(clave)!).state.reclamos.length, CLAVE);
}

async function sinDesborde(page: Page, momento: string) {
  if (!esMovil(page)) return;
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde, `${momento}: desborda ${desborde} px`).toBeLessThanOrEqual(0);
}

const DESCRIPCION = 'Pozo grande en el carril derecho, las motos lo esquivan de golpe hacia el centro.';

test.describe('CU08 presentar reclamo vecinal', () => {
  test('flujo normal con el mapa y foto: comprobante PN-2026-0205', async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto('/reclamo');
    await expect(page.getByRole('heading', { level: 1, name: 'Reclamo por un lugar peligroso' })).toBeVisible();
    await expect(page.getByText('Sin crear una cuenta y sin datos personales.')).toBeVisible();
    await expect(page.getByText('Todavía no marcaste el lugar.')).toBeVisible();
    await sinDesborde(page, 'paso 1');

    await tocarMapa(page, COLON_5300);
    await expect(page.locator('[data-lugar]')).toHaveText('Av. Colón al 5300');
    await expect(page.getByRole('button', { name: /Lugar del reclamo: Av\. Colón al 5300/ })).toBeVisible();

    await page.getByRole('button', { name: 'Continuar' }).click();
    const tituloPaso2 = page.getByRole('heading', { level: 2, name: 'Qué pasa' });
    await expect(tituloPaso2).toBeFocused();
    await expect(page.getByText('Av. Colón al 5300', { exact: true })).toBeVisible();
    // Sin datos personales: ningún campo de nombre, documento, teléfono ni correo.
    for (const campo of [/nombre/i, /DNI|documento/i, /tel[eé]fono|celular/i, /correo|e-?mail/i]) {
      await expect(page.getByRole('textbox', { name: campo })).toHaveCount(0);
    }
    await sinDesborde(page, 'paso 2');

    await page.getByLabel('¿Qué pasa en el lugar?').fill(DESCRIPCION);
    await page.getByLabel('Agregar una foto').setInputFiles(FOTO);
    const vista = page.getByRole('img', { name: 'Vista previa de la fotografía adjunta' });
    await expect(vista).toBeVisible();
    await expect(vista).toHaveAttribute('src', /^data:image\/jpeg;base64,/);
    await page.getByLabel('No soy un programa automático').check();
    await page.getByRole('button', { name: 'Enviar reclamo' }).click();

    await expect(page.getByRole('heading', { level: 1, name: 'Reclamo registrado' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Número de reclamo' })).toBeFocused();
    await expect(page.locator('[data-numero]')).toHaveText('PN-2026-0205');
    await expect(page.getByText(/^09\/09\/2026 · \d{2}:\d{2}$/)).toBeVisible();
    await expect(page.getByText('Av. Colón al 5300', { exact: true })).toBeVisible();
    await expect(page.getByText('abierto', { exact: true })).toBeVisible();
    await expect(page.getByText(DESCRIPCION)).toBeVisible();
    await expect(page.getByRole('img', { name: 'Fotografía adjunta al reclamo' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Qué pasa ahora' })).toBeVisible();
    await expect(page.getByText(/sistema emite una alerta de reclamo desatendido/)).toBeVisible();
    await sinDesborde(page, 'comprobante');

    const guardado = await page.evaluate((clave) => JSON.parse(localStorage.getItem(clave)!).state.reclamos.at(-1), CLAVE);
    expect(guardado).toMatchObject({ numero: 'PN-2026-0205', estado: 'abierto', alerta: false, lugar: 'Av. Colón al 5300', fechaPresentacion: '2026-09-09', descripcion: DESCRIPCION });
    expect(guardado.foto).toMatch(/^data:image\/jpeg/);
    expect(errores, errores.join('\n')).toEqual([]);
  });

  test('flujo normal escribiendo la dirección, sin foto (3.a)', async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto('/reclamo');
    await page.getByText('Prefiero escribir la calle y la altura').click();
    await page.getByLabel('Calle').fill('Sabattini');
    await page.getByLabel('Altura').fill('4720');
    await page.getByRole('button', { name: 'Ubicar en el mapa' }).click();
    await expect(page.locator('[data-lugar]')).toHaveText('Av. Amadeo Sabattini al 4700');
    await sinDesborde(page, 'dirección escrita');

    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('¿Qué pasa en el lugar?').fill('No hay rampa ni senda en la esquina y los peatones cruzan entre los autos.');
    await page.getByLabel('No soy un programa automático').check();
    await page.getByRole('button', { name: 'Enviar reclamo' }).click();

    await expect(page.locator('[data-numero]')).toHaveText('PN-2026-0205');
    await expect(page.getByText('Av. Amadeo Sabattini al 4700', { exact: true })).toBeVisible();
    await expect(page.getByText('Sin fotografía')).toBeVisible();

    // Otro reclamo toma el número siguiente.
    await page.getByRole('button', { name: 'Presentar otro reclamo' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Dónde es' })).toBeFocused();
    await expect(page.getByText('Todavía no marcaste el lugar.')).toBeVisible();
    await page.getByText('Prefiero escribir la calle y la altura').click();
    await page.getByLabel('Calle').fill('Av. Colón');
    await page.getByLabel('Altura').fill('5300');
    await page.getByLabel('Altura').press('Enter');
    await expect(page.locator('[data-lugar]')).toHaveText('Av. Colón al 5300');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('¿Qué pasa en el lugar?').fill(DESCRIPCION);
    await page.getByLabel('No soy un programa automático').check();
    await page.getByRole('button', { name: 'Enviar reclamo' }).click();
    await expect(page.locator('[data-numero]')).toHaveText('PN-2026-0206');
    expect(errores, errores.join('\n')).toEqual([]);
  });

  test('validaciones: lugar obligatorio, dirección, descripción mínima y control (4.a)', async ({ page }) => {
    const errores = vigilarErrores(page);
    await page.goto('/reclamo');

    await page.getByRole('button', { name: 'Continuar' }).click();
    const errorLugar = page.getByRole('alert').filter({ hasText: 'Marcá el lugar en el mapa o escribí la calle y la altura.' });
    await expect(errorLugar).toBeVisible();
    await expect(errorLugar).toBeFocused();
    await expect(page.getByRole('heading', { level: 2, name: 'Dónde es' })).toBeVisible();

    await page.getByText('Prefiero escribir la calle y la altura').click();
    await page.getByRole('button', { name: 'Ubicar en el mapa' }).click();
    await expect(page.getByText('Escribí el nombre de la calle.')).toBeVisible();
    await expect(page.getByLabel('Calle')).toBeFocused();
    await expect(page.getByLabel('Calle')).toHaveAttribute('aria-invalid', 'true');

    await page.getByLabel('Calle').fill('Calle Inventada');
    await page.getByRole('button', { name: 'Ubicar en el mapa' }).click();
    await expect(page.getByText(/No encontramos «Calle Inventada»/)).toBeVisible();

    await page.getByLabel('Calle').fill('Av. Colón');
    await page.getByLabel('Altura').fill('9900');
    await page.getByRole('button', { name: 'Ubicar en el mapa' }).click();
    await expect(page.getByText(/Av\. Colón va del 0 al 6500/)).toBeVisible();
    await expect(page.getByLabel('Altura')).toBeFocused();

    await page.getByLabel('Altura').fill('5300');
    await page.getByRole('button', { name: 'Ubicar en el mapa' }).click();
    await expect(page.locator('[data-lugar]')).toHaveText('Av. Colón al 5300');
    await expect(errorLugar).toHaveCount(0);
    await page.getByRole('button', { name: 'Continuar' }).click();

    const enviar = page.getByRole('button', { name: 'Enviar reclamo' });
    const descripcion = page.getByLabel('¿Qué pasa en el lugar?');
    await enviar.click();
    await expect(page.getByText('Contá qué pasa en el lugar.')).toBeVisible();
    await expect(descripcion).toBeFocused();

    await descripcion.fill('Pozo');
    await enviar.click();
    await expect(page.getByText('Contalo con un poco más de detalle: al menos 20 caracteres (llevás 4).')).toBeVisible();

    await descripcion.fill(DESCRIPCION);
    await expect(page.getByText(/al menos 20 caracteres \(llevás/)).toHaveCount(0);
    const antes = await cantidadReclamos(page);
    await enviar.click();
    await expect(page.getByRole('alert').filter({ hasText: /No pudimos comprobar que el envío no es automático/ })).toBeVisible();
    await expect(page.getByLabel('No soy un programa automático')).toBeFocused();
    expect(await cantidadReclamos(page)).toBe(antes);

    // Volver al lugar conserva lo escrito.
    await page.getByRole('button', { name: 'Cambiar' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Dónde es' })).toBeFocused();
    await expect(page.locator('[data-lugar]')).toHaveText('Av. Colón al 5300');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page.getByLabel('¿Qué pasa en el lugar?')).toHaveValue(DESCRIPCION);

    await page.getByLabel('No soy un programa automático').check();
    await page.getByRole('button', { name: 'Enviar reclamo' }).click();
    await expect(page.locator('[data-numero]')).toHaveText('PN-2026-0205');
    expect(await cantidadReclamos(page)).toBe(antes + 1);
    expect(errores, errores.join('\n')).toEqual([]);
  });

  test('la chapa del comprobante rotula la calle del reclamo; un punto sin calle no la inventa', async ({ page }) => {
    const errores = vigilarErrores(page);
    const presentar = async () => {
      await page.getByRole('button', { name: 'Continuar' }).click();
      await page.getByLabel('¿Qué pasa en el lugar?').fill(DESCRIPCION);
      await page.getByLabel('No soy un programa automático').check();
      await page.getByRole('button', { name: 'Enviar reclamo' }).click();
      await expect(page.getByRole('heading', { level: 1, name: 'Reclamo registrado' })).toBeVisible();
    };
    const lugarComprobante = () => page.getByRole('definition').filter({ has: page.locator('svg') }).first();

    await page.goto('/reclamo');
    await tocarMapa(page, COLON_5300);
    await expect(page.locator('[data-lugar]')).toHaveText('Av. Colón al 5300');
    await expect(page.getByRole('img', { name: 'Calle: Av. Colón' })).toBeVisible();
    await presentar();
    const chapa = lugarComprobante().getByRole('img');
    await expect(chapa).toHaveAccessibleName('Calle: Av. Colón');
    await expect(chapa).not.toContainText(/SIN CALLE/i);
    const guardado = await page.evaluate((clave) => JSON.parse(localStorage.getItem(clave)!).state.reclamos.at(-1), CLAVE);
    expect(guardado).toMatchObject({ numero: 'PN-2026-0205', calle: 'Av. Colón' });

    // Un punto marcado lejos de toda calle del nomenclador: la chapa no rotula ninguna calle.
    await page.getByRole('button', { name: 'Presentar otro reclamo' }).click();
    await tocarMapa(page, SIN_CALLE);
    await expect(page.locator('[data-lugar]')).toHaveText('Punto marcado en el mapa');
    await presentar();
    await expect(page.locator('[data-numero]')).toHaveText('PN-2026-0206');
    const chapaSinCalle = lugarComprobante().getByRole('img');
    await expect(chapaSinCalle).not.toHaveAccessibleName(/Calle:/);
    await expect(chapaSinCalle).not.toContainText('Colón');
    const segundo = await page.evaluate((clave) => JSON.parse(localStorage.getItem(clave)!).state.reclamos.at(-1), CLAVE);
    expect(segundo.calle).toBeUndefined();
    expect(errores, errores.join('\n')).toEqual([]);
  });

  test('una foto que no es imagen se rechaza y se puede quitar la foto', async ({ page }) => {
    await page.goto('/reclamo');
    await tocarMapa(page, COLON_5300);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('Agregar una foto').setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') });
    await expect(page.getByText('Ese archivo no es una imagen. Elegí una foto (JPG, PNG o similar).')).toBeVisible();
    await page.getByLabel('Agregar una foto').setInputFiles(FOTO);
    await expect(page.getByRole('img', { name: 'Vista previa de la fotografía adjunta' })).toBeVisible();
    await page.getByRole('button', { name: 'Quitar la foto' }).click();
    await expect(page.getByRole('img', { name: 'Vista previa de la fotografía adjunta' })).toHaveCount(0);
    await expect(page.getByLabel('Agregar una foto')).toBeAttached();
  });

  test('el marcador se corrige arrastrándolo y con las flechas', async ({ page }) => {
    await page.goto('/reclamo');
    await page.getByText('Prefiero escribir la calle y la altura').click();
    await page.getByLabel('Calle').fill('Av. Colón');
    await page.getByLabel('Altura').fill('5300');
    await page.getByRole('button', { name: 'Ubicar en el mapa' }).click();
    const lugar = page.locator('[data-lugar]');
    await expect(lugar).toHaveText('Av. Colón al 5300');

    const pin = page.getByRole('button', { name: /Lugar del reclamo: Av\. Colón al 5300/ });
    if (!esMovil(page)) {
      // Arrastre con el puntero, unos 200 m al oeste, siguiendo la avenida.
      const desde = await enPantalla(page, COLON_5300);
      const hasta = await enPantalla(page, { lat: -31.3943, lon: -64.258 });
      await page.mouse.move(desde.x, desde.y);
      await page.mouse.down();
      await page.mouse.move((desde.x + hasta.x) / 2, (desde.y + hasta.y) / 2, { steps: 4 });
      await page.mouse.move(hasta.x, hasta.y, { steps: 4 });
      await page.mouse.up();
      await expect(lugar).not.toHaveText('Av. Colón al 5300');
      await expect(lugar).toHaveText(/^Av\. Colón al \d+00$/);
    } else {
      await pin.focus();
      for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowLeft');
      await expect(lugar).toHaveText(/^Av\. Colón al \d+00$/);
      await expect(lugar).not.toHaveText('Av. Colón al 5300');
    }
  });

  test('el reclamo aparece en "Todos" de la bandeja y persiste al recargar', async ({ page }) => {
    await page.goto('/reclamo');
    await tocarMapa(page, COLON_5300);
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByLabel('¿Qué pasa en el lugar?').fill(DESCRIPCION);
    await page.getByLabel('No soy un programa automático').check();
    await page.getByRole('button', { name: 'Enviar reclamo' }).click();
    await expect(page.locator('[data-numero]')).toHaveText('PN-2026-0205');

    await page.getByRole('link', { name: 'Ver cómo lo recibe el organismo' }).click();
    await expect(page).toHaveURL(/\/reclamos\?vista=todos$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Todos los reclamos' })).toBeVisible();

    const revisarRiel = async () => {
      if (esMovil(page)) await page.getByRole('button', { name: 'Menú' }).click();
      const nav = page.getByRole('navigation', { name: 'Paquetes del sistema' });
      await expect(nav.getByRole('link', { name: /Todos\s*33$/ })).toHaveAttribute('aria-current', 'page');
    };
    await revisarRiel();
    await page.reload();
    await revisarRiel();

    const r = await page.evaluate(
      (clave) => (JSON.parse(localStorage.getItem(clave)!).state.reclamos as { numero: string; estado: string }[]).find((x) => x.numero === 'PN-2026-0205'),
      CLAVE,
    );
    expect(r).toMatchObject({ numero: 'PN-2026-0205', estado: 'abierto' });
  });
});
