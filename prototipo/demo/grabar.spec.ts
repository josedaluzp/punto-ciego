import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Browser, type Locator, type Page } from '@playwright/test';

/**
 * Graba la demo de la cadena central para el video de la Entrega 4.
 *
 * Mismo recorrido que e2e/cadena.spec.ts, pero contado: cada pantalla se
 * presenta entera, después se recorre componente por componente y recién al
 * final se actúa. La grabación deja, además del video, tres pistas en
 * salida/<toma>.json, en milisegundos desde el comienzo del video:
 * - escenas: inicio y fin de cada capítulo;
 * - subtitulos: qué se explica y desde cuándo (cada uno se sostiene el tiempo
 *   de lectura que pide su largo antes de que la grabación siga);
 * - camara: la zona de la pantalla que se explica; Remotion la acerca.
 *
 * Dos tomas, cada una desde la semilla:
 * - escritorio (1920×1080): crónicas sobre calle y ruta, duplicado, revisión,
 *   actualización, priorización, ficha, bandeja, cierre y cierre desmentido.
 * - vecino (teléfono): el reclamo del vecino, que Remotion monta en un marco de teléfono.
 */

const SALIDA = join(dirname(fileURLToPath(import.meta.url)), 'salida');

/** Lectura cómoda de un subtítulo: unas tres palabras por segundo, nunca menos de 3,5 s. */
const MS_POR_PALABRA = 340;
const LECTURA_MINIMA = 3500;
/** DEMO_RAPIDO=1 recorre el guion casi sin pausas: sirve para validarlo antes de grabar. */
const RITMO = process.env.DEMO_RAPIDO ? 0.05 : 1;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Cursor dibujado en la página: el video de Playwright no muestra el del sistema.
 * En el teléfono no hay flecha, sólo el círculo de cada toque.
 */
const CURSOR = (conFlecha: boolean) => {
  const montar = () => {
    if (document.getElementById('demo-cursor')) return;
    const c = document.createElement('div');
    c.id = 'demo-cursor';
    if (conFlecha) c.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 24 24"><path d="M4 2l16 10-7 1.6L9.4 21z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, {
      position: 'fixed', left: '0', top: '0', zIndex: '2147483647', pointerEvents: 'none',
      transform: 'translate(-200px,-200px)', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.35))',
    });
    document.body.appendChild(c);
    let x = -200, y = -200;
    addEventListener('mousemove', (e) => {
      x = e.clientX; y = e.clientY;
      c.style.transform = `translate(${x - 4}px,${y - 2}px)`;
    }, true);
    addEventListener('mousedown', () => {
      const o = document.createElement('div');
      Object.assign(o.style, {
        position: 'fixed', left: `${x - 18}px`, top: `${y - 18}px`, width: '36px', height: '36px',
        borderRadius: '50%', border: '3px solid #c8102e', zIndex: '2147483646', pointerEvents: 'none',
        transition: 'transform .45s ease-out, opacity .45s ease-out',
      });
      document.body.appendChild(o);
      requestAnimationFrame(() => { o.style.transform = 'scale(1.8)'; o.style.opacity = '0'; });
      setTimeout(() => o.remove(), 500);
    }, true);
  };
  if (document.body) montar();
  else addEventListener('DOMContentLoaded', montar);
};

class Toma {
  readonly escenas: { id: string; inicio: number; fin: number }[] = [];
  readonly subtitulos: { t: number; texto: string }[] = [];
  readonly camara: { t: number; foco: Rect | null }[] = [];
  private t0 = 0;
  private libreDesde = 0;
  page!: Page;

  constructor(private readonly nombre: string) {}

  private ahora() {
    return Date.now() - this.t0;
  }

  async abrir(browser: Browser, viewport: { width: number; height: number }, extra: object = {}) {
    const contexto = await browser.newContext({
      viewport,
      recordVideo: { dir: join(SALIDA, 'crudo'), size: viewport },
      locale: 'es-AR',
      timezoneId: 'America/Argentina/Cordoba',
      ...extra,
    });
    await contexto.addInitScript(CURSOR, !('isMobile' in extra));
    this.page = await contexto.newPage();
    // El video empieza con la página: las marcas se miden desde acá.
    this.t0 = Date.now();
    await this.page.goto('/priorizacion');
    await this.page.evaluate(() => localStorage.clear());
    // Cómo se ve la aplicación al abrirla: la usa la escena de puesta en marcha.
    await this.page.reload();
    await this.page.waitForLoadState('networkidle');
    mkdirSync(SALIDA, { recursive: true });
    await this.page.screenshot({ path: join(SALIDA, `${this.nombre}-inicio.png`) });
    return this.page;
  }

  /** Espera a que el subtítulo vigente se haya podido leer. */
  async leido() {
    const falta = this.libreDesde - this.ahora();
    if (falta > 0) await this.page.waitForTimeout(falta);
  }

  /** Cambia el subtítulo, después de dar tiempo a leer el anterior. */
  async decir(texto: string) {
    await this.leido();
    const t = this.ahora();
    this.subtitulos.push({ t, texto });
    this.libreDesde = t + RITMO * Math.max(LECTURA_MINIMA, texto.split(/\s+/).length * MS_POR_PALABRA);
  }

  /**
   * Lleva la cámara a la zona que ocupan los elementos (o a la pantalla entera,
   * sin elementos). Primero la trae a la vista, después la mide.
   */
  async enfocar(...elementos: Locator[]) {
    let foco: Rect | null = null;
    if (elementos.length) {
      await elementos[0]!.scrollIntoViewIfNeeded();
      await this.page.waitForTimeout(250);
      const cajas = (await Promise.all(elementos.map((e) => e.boundingBox()))).filter((c) => c !== null);
      if (cajas.length) {
        const x = Math.min(...cajas.map((c) => c.x));
        const y = Math.min(...cajas.map((c) => c.y));
        foco = {
          x, y,
          w: Math.max(...cajas.map((c) => c.x + c.width)) - x,
          h: Math.max(...cajas.map((c) => c.y + c.height)) - y,
        };
      }
    }
    this.camara.push({ t: this.ahora(), foco });
  }

  async escena(id: string, f: () => Promise<void>) {
    const inicio = this.ahora();
    await this.enfocar();
    await f();
    await this.leido();
    await this.page.waitForTimeout(700);
    this.escenas.push({ id, inicio, fin: this.ahora() });
  }

  async cerrar() {
    const video = this.page.video()!;
    await this.page.context().close();
    mkdirSync(SALIDA, { recursive: true });
    renameSync(await video.path(), join(SALIDA, `${this.nombre}.webm`));
    const { escenas, subtitulos, camara } = this;
    writeFileSync(join(SALIDA, `${this.nombre}.json`), JSON.stringify({ escenas, subtitulos, camara }, null, 2));
  }
}

const pausa = (page: Page, ms: number) => page.waitForTimeout(ms * RITMO);

/** Lleva el cursor hasta el control, como lo haría una persona, y hace clic. */
async function clic(page: Page, objetivo: Locator) {
  await objetivo.scrollIntoViewIfNeeded();
  const caja = await objetivo.boundingBox();
  if (caja) {
    await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2, { steps: 28 });
    await pausa(page, 250);
  }
  await objetivo.click();
}

async function escribir(page: Page, campo: Locator, texto: string) {
  await clic(page, campo);
  await campo.fill('');
  await campo.pressSequentially(texto, { delay: 55 });
}

async function elegir(page: Page, campo: Locator, opcion: { label: string }) {
  await clic(page, campo);
  await campo.selectOption(opcion);
}

/** Recorre un elemento con el cursor para señalarlo, sin hacer clic. */
async function senalar(page: Page, objetivo: Locator, ms = 700) {
  const caja = await objetivo.boundingBox();
  if (!caja) return;
  await page.mouse.move(caja.x + Math.min(caja.width * 0.1, 40), caja.y + caja.height / 2, { steps: 24 });
  await page.mouse.move(caja.x + caja.width * 0.9, caja.y + caja.height / 2, { steps: 40 });
  await pausa(page, ms);
}

const filas = (page: Page) => page.locator('table[aria-label] tbody tr');
const fila = (page: Page, texto: string) => filas(page).filter({ hasText: texto });
const celdas = (page: Page, desde: number, hasta: number, columnas: number[]) =>
  Array.from({ length: hasta - desde }, (_, i) => columnas.map((c) => filas(page).nth(desde + i).locator('td').nth(c))).flat();

test('escritorio: recorrido completo de la aplicación', async ({ browser }) => {
  test.setTimeout(900_000);
  const toma = new Toma('escritorio');
  const page = await toma.abrir(browser, { width: 1920, height: 1080 });
  const decir = (t: string) => toma.decir(t);
  const incorporarEjemplo = async (titulo: string) => {
    await page.goto('/siniestros/cronicas?incorporar');
    await expect(page.getByRole('heading', { level: 1, name: 'Incorporar crónica' })).toBeVisible();
    await elegir(page, page.getByLabel('Cargar una crónica de ejemplo'), { label: titulo });
  };

  // ── Incorporar una crónica sobre calle (CU01, CU02): extracción, ubicación y alerta.
  await toma.escena('crónica', async () => {
    await page.goto('/siniestros/cronicas');
    await decir('La lista de siniestros reúne los hechos reconstruidos a partir de crónicas periodísticas: dónde ocurrieron, quiénes fueron las víctimas y cómo se ubicó cada uno.');
    await senalar(page, filas(page).nth(4), 1200);
    await toma.enfocar(page.getByLabel('Estado de la ubicación'), page.getByLabel('Año del hecho'));
    await decir('Los filtros permiten ver los siniestros según el estado de su ubicación, el método que la produjo, el tipo de vía y el año del hecho.');
    await toma.leido();
    await toma.enfocar(...celdas(page, 0, 6, [3, 4]));
    await decir('Cada ubicación informa el método con que se obtuvo y su confianza. Las que no alcanzan el umbral de 0,70 quedan en revisión y no intervienen en ningún cálculo.');
    await senalar(page, filas(page).nth(0).locator('td').nth(3), 900);
    await senalar(page, filas(page).nth(4).locator('td').nth(3), 900);
    await toma.leido();

    await toma.enfocar();
    await clic(page, page.getByRole('link', { name: 'Incorporar crónica' }).first());
    await expect(page.getByRole('heading', { level: 1, name: 'Incorporar crónica' })).toBeVisible();
    const cronica = page.getByRole('region', { name: 'Crónica', exact: true });
    await toma.enfocar(cronica);
    await decir('Para incorporar un hecho se carga la crónica tal como la publicó el medio: su texto, el medio, la fecha y la dirección web. Acá se usa una de las crónicas de ejemplo.');
    await elegir(page, page.getByLabel('Cargar una crónica de ejemplo'), { label: 'Ciclista en Av. Monseñor Pablo Cabrera al 1900' });
    await senalar(page, page.getByLabel('Texto de la crónica'), 1500);
    await toma.leido();

    const extraido = page.getByRole('region', { name: 'Lo que extrajo el sistema', exact: true });
    await toma.enfocar(extraido);
    await decir('El sistema extrae el lugar, la fecha del hecho, las víctimas y el tipo de siniestro. En el texto resalta el fragmento que reconoció como lugar.');
    await senalar(page, extraido.getByRole('textbox').first(), 900);
    await senalar(page, extraido.getByText('Cuadra (calle y altura)'), 900);
    await senalar(page, extraido.getByText('usuario vulnerable'), 900);
    await decir('La fecha sale de las referencias del texto, como «ayer» o «el sábado», y cada dato puede confirmarse o corregirse antes de incorporar.');
    await toma.leido();

    await clic(page, page.getByRole('button', { name: 'Incorporar crónica' }));
    await expect(page.getByText('Alerta de reclamo desatendido · PN-2026-0157')).toBeVisible();
    const incorporado = page.getByRole('region', { name: /Siniestro S-\d+ incorporado/ });
    await toma.enfocar(incorporado.getByRole('heading', { level: 2 }), incorporado.getByText(/la ubicación queda confirmada/));
    await decir('Como la vía es una calle, la coordenada sale del servicio de normalización de direcciones. Con una confianza de 0,86 la ubicación queda confirmada y entra en el cálculo.');
    await toma.leido();
    const alerta = incorporado.getByText(/Alerta de reclamo desatendido:/);
    await toma.enfocar(alerta, incorporado.getByRole('link', { name: 'Ver la bandeja de reclamos desatendidos' }));
    await decir('Y detecta que a 15 metros había un reclamo vecinal presentado 90 días antes y sin respuesta: emite la alerta de reclamo desatendido.');
    await senalar(page, alerta, 1500);
    await toma.leido();
    const mapa = incorporado.getByRole('group', { name: /Mapa con la ubicación/ });
    await toma.enfocar(mapa);
    await decir('El mapa abre sobre el lugar del hecho. Con «Ver todo el mapa» se pasa a la vista completa de la ciudad de Córdoba, y con los botones se acerca o se aleja.');
    await clic(page, incorporado.getByRole('button', { name: 'Ver todo el mapa' }));
    await pausa(page, 2500);
    await clic(page, incorporado.getByRole('button', { name: 'Acercar' }));
    await pausa(page, 1200);
    await clic(page, incorporado.getByRole('button', { name: 'Acercar' }));
    await toma.leido();
    await toma.enfocar(incorporado.getByRole('figure').first());
    await decir('El croquis del lugar muestra la posición del siniestro sobre la calle, a la altura que indicaba la crónica.');
  });

  // ── Ubicar sobre ruta (CU02): la progresiva se resuelve con los postes kilométricos.
  await toma.escena('ruta', async () => {
    await incorporarEjemplo('Despiste en la ruta nacional 158, km 214');
    await toma.enfocar(page.getByRole('region', { name: 'Crónica', exact: true }));
    await decir('Sobre una ruta, la crónica no da una dirección sino una progresiva: «ruta nacional 158, a la altura del kilómetro 214,6».');
    await senalar(page, page.getByLabel('Texto de la crónica'), 1500);
    await toma.leido();
    await toma.enfocar();
    await clic(page, page.getByRole('button', { name: 'Incorporar crónica' }));
    const incorporado = page.getByRole('region', { name: /Siniestro S-\d+ incorporado/ });
    await expect(incorporado).toBeVisible();
    await toma.enfocar(incorporado.getByRole('heading', { level: 2 }), incorporado.getByText(/la ubicación queda confirmada/));
    await decir('El sistema no consulta el servicio de direcciones, que ubica mal las progresivas sin advertirlo: usa la capa de postes kilométricos de la red vial. La confianza llega a 0,93.');
    await toma.leido();
    await toma.enfocar(incorporado.getByRole('group', { name: /Mapa con la ubicación/ }), incorporado.getByRole('figure').first());
    await decir('El mapa muestra el punto sobre la traza de la RN 158, y el croquis del tramo lo sitúa entre los km 214 y 215.');
  });

  // ── Reconocer un hecho repetido (CU01, RF03).
  await toma.escena('duplicado', async () => {
    await incorporarEjemplo('Motociclista en Av. Amadeo Sabattini al 4700');
    await toma.enfocar();
    await decir('Un mismo siniestro suele aparecer en varios medios. Primero se incorpora una crónica del hecho de Av. Amadeo Sabattini al 4700.');
    await clic(page, page.getByRole('button', { name: 'Incorporar crónica' }));
    await expect(page.getByRole('region', { name: /Siniestro S-\d+ incorporado/ })).toBeVisible();
    await toma.leido();
    await incorporarEjemplo('Otra crónica del hecho de Sabattini');
    const extraido = page.getByRole('region', { name: 'Lo que extrajo el sistema', exact: true });
    const aviso = extraido.getByText('La crónica refiere a un siniestro ya registrado.');
    await toma.enfocar(aviso, extraido.getByRole('button', { name: /Vincular la crónica/ }));
    await decir('Al cargar otra crónica del mismo hecho, el sistema la reconoce: misma fecha, mismo lugar y textos semejantes. Propone vincularla en lugar de crear un siniestro nuevo.');
    await senalar(page, aviso, 1500);
    await toma.leido();
    await clic(page, extraido.getByRole('button', { name: /Vincular la crónica/ }));
    const vinculada = page.getByRole('region', { name: /Crónica CR-\d+ vinculada/ });
    await expect(vinculada).toBeVisible();
    await toma.enfocar(vinculada.getByRole('heading', { level: 2 }), vinculada.getByText(/no se creó un siniestro nuevo/));
    await decir('La crónica queda vinculada al siniestro existente, que ahora suma dos fuentes. El hecho no se cuenta dos veces.');
  });

  // ── Revisar las ubicaciones dudosas (CU03).
  await toma.escena('revisión', async () => {
    await page.goto('/siniestros/revision');
    await expect(page.getByRole('heading', { level: 1, name: 'Ubicaciones en revisión' })).toBeVisible();
    await decir('Las ubicaciones de baja confianza esperan la revisión de una persona. Hasta que alguien las confirme, no intervienen en ningún cálculo.');
    await toma.leido();
    const pendientes = page.getByRole('region', { name: 'Ubicaciones pendientes de revisión', exact: true });
    await toma.enfocar(pendientes);
    await decir('Cada una indica por qué no alcanzó el umbral: una crónica que nombra sólo el barrio, un corredor sin altura o una progresiva que no figura en la capa de postes.');
    for (const b of await pendientes.getByRole('button').all()) await senalar(page, b, 600);
    await toma.leido();

    await clic(page, pendientes.getByRole('button', { name: /RN 36, km 790/ }));
    const articulo = page.getByRole('article', { name: 'RN 36, km 790', exact: true });
    await toma.enfocar(articulo.getByRole('heading', { level: 2 }), articulo.getByRole('figure').first());
    await decir('La crónica sitúa el hecho en el km 790 de la RN 36, pero los postes cargados de esa ruta llegan sólo al km 770. El sistema propuso la localidad más cercana, con confianza 0,55.');
    await senalar(page, articulo.getByRole('figure').first(), 1500);
    await toma.leido();

    const correccion = articulo.getByRole('region', { name: 'Corrección sobre el mapa', exact: true });
    const revision = articulo.getByRole('complementary', { name: 'Revisión', exact: true });
    await toma.enfocar(revision);
    await decir('Hay tres decisiones posibles: confirmar la propuesta, corregir la posición o descartar la ubicación. Cualquiera de ellas queda registrada a nombre de quien la tomó.');
    await senalar(page, revision.getByRole('button', { name: 'Confirmar la propuesta' }), 700);
    await senalar(page, revision.getByRole('button', { name: 'Descartar ubicación' }), 900);
    await toma.leido();
    await toma.enfocar(correccion, revision);
    await decir('Para corregir, se puede arrastrar el marcador sobre el mapa o escribir la progresiva correcta: el sistema la ubica sobre el poste kilométrico.');
    await escribir(page, page.getByLabel('Progresiva (km)'), '700,5');
    await clic(page, page.getByRole('button', { name: 'Ubicar en el km' }));
    await pausa(page, 1200);
    await decir('El croquis del tramo muestra el punto corregido entre los km 695 y 705.');
    await senalar(page, correccion.getByRole('figure'), 1200);
    await toma.leido();

    await clic(page, page.getByRole('button', { name: 'Confirmar posición corregida' }));
    const resultado = page.locator('[data-prueba="resultado"]');
    await expect(resultado).toContainText('integra la concentración C-0031');
    await toma.enfocar(resultado);
    await decir('Confirmada, la ubicación pasa a los cálculos: el siniestro integra la concentración del km 700 al 701 de la RN 36.');
  });

  // ── Actualizar concentraciones (CU04).
  await toma.escena('actualización', async () => {
    await page.goto('/priorizacion');
    await expect(page.getByRole('heading', { level: 1, name: 'Lugares priorizados' })).toBeVisible();
    const boton = page.getByRole('button', { name: 'Actualizar concentraciones' });
    await toma.enfocar(boton);
    await decir('Con los siniestros nuevos y la ubicación corregida, el técnico vuelve a calcular las concentraciones.');
    await clic(page, boton);
    const resultado = page.locator('[data-prueba="actualizacion"]');
    await expect(resultado).toBeVisible();
    await toma.enfocar(resultado);
    await decir('El sistema agrupa los siniestros confirmados por punto en las calles y por tramo de un kilómetro en las rutas, y conserva sólo las concentraciones estadísticamente significativas.');
    await senalar(page, resultado, 1500);
    await decir('El resultado informa cuándo se calculó, quién lo pidió y qué cambió respecto del cálculo anterior.');
  });

  // ── Priorizar las concentraciones (CU05).
  await toma.escena('priorización', async () => {
    await toma.enfocar();
    await decir('La priorización responde la pregunta que da origen al sistema: dónde conviene intervenir primero.');
    await toma.leido();
    const mapa = page.getByRole('region', { name: 'Mapa de la provincia', exact: true });
    await toma.enfocar(mapa);
    await decir('El mapa muestra todas las concentraciones significativas de la provincia: puntos sobre las calles de las ciudades y tramos de un kilómetro sobre las rutas.');
    await senalar(page, mapa, 1200);
    await toma.leido();
    await decir('Al acercarse, aparecen las concentraciones de la ciudad de Córdoba; «Ver todo el mapa» vuelve a la provincia completa.');
    await clic(page, mapa.getByRole('button', { name: 'Acercar' }));
    await pausa(page, 900);
    await clic(page, mapa.getByRole('button', { name: 'Acercar' }));
    await pausa(page, 2500);
    await clic(page, mapa.getByRole('button', { name: 'Ver todo el mapa' }));
    await toma.leido();

    await toma.enfocar(page.getByLabel('Ámbito'), page.getByLabel('Usuario vulnerable'));
    await decir('Los filtros acotan el análisis por ámbito, vía, período y tipo de usuario. Por ejemplo, sólo las rutas.');
    await elegir(page, page.getByLabel('Ámbito'), { label: 'Sólo rutas' });
    await pausa(page, 1500);
    await toma.leido();
    await toma.enfocar();
    await decir('El mapa y la lista se reducen a los tramos de ruta. Se vuelve a toda la provincia para seguir.');
    await toma.leido();
    await elegir(page, page.getByLabel('Ámbito'), { label: 'Provincia de Córdoba' });
    await pausa(page, 800);

    await toma.enfocar(page.getByRole('region', { name: 'Lista ordenada por índice de riesgo', exact: true }).getByRole('row').first(), filas(page).nth(4));
    await decir('La lista ordena las concentraciones por un índice de riesgo que combina severidad, frecuencia y proporción de usuarios vulnerables. Los reclamos vecinales no intervienen en este orden.');
    for (let i = 0; i < 4; i++) await senalar(page, filas(page).nth(i), 500);
    await toma.leido();

    const detalle = page.getByRole('region', { name: 'RN 9 · km 694 a 695', exact: true });
    await toma.enfocar(detalle);
    await decir('Al elegir un lugar se abre su detalle. El croquis sitúa cada siniestro sobre el tramo, con su fecha, su tipo y sus víctimas; el rojo marca los que tuvieron víctimas fatales.');
    await senalar(page, detalle.getByRole('group', { name: /Croquis/ }), 1500);
    await toma.leido();
    await clic(page, detalle.getByText('Cómo se calcula el índice'));
    await pausa(page, 600);
    await toma.enfocar(detalle.getByRole('group').filter({ hasText: 'Cómo se calcula el índice' }));
    await decir('El índice no es una caja negra: cada componente y su peso pueden consultarse desde el propio lugar.');
    await toma.leido();

    await toma.enfocar();
    await clic(page, fila(page, 'Av. Amadeo Sabattini al 4700'));
    await expect(page.locator('#lugar-seleccionado')).toHaveText('Av. Amadeo Sabattini al 4700');
    await toma.enfocar(page.getByRole('region', { name: 'Av. Amadeo Sabattini al 4700', exact: true }));
    await decir('Av. Amadeo Sabattini al 4700 todavía no tiene una ficha de intervención.');
  });

  // ── Emitir la ficha de intervención (CU06, CU07).
  await toma.escena('ficha', async () => {
    await clic(page, page.getByRole('button', { name: 'Emitir ficha de intervención' }));
    await expect(page).toHaveURL(/\/priorizacion\/fichas\/nueva/);
    await toma.enfocar();
    await decir('La ficha de intervención reúne en un solo documento lo que el funcionario necesita para decidir sobre el lugar.');
    await toma.leido();
    await toma.enfocar(page.getByRole('region', { name: 'Caracterización del sitio', exact: true }));
    await decir('La caracterización del sitio: calzada, carriles, tipo de siniestro predominante, fallecidos y proporción de víctimas vulnerables.');
    await toma.leido();
    await toma.enfocar(page.getByRole('region', { name: 'Siniestros que componen el punto', exact: true }));
    await decir('Los siniestros que componen el punto, cada uno con su crónica de origen y la confianza de su ubicación.');
    await toma.leido();
    const contramedidas = page.getByRole('region', { name: /Contramedidas recomendadas/ });
    await toma.enfocar(contramedidas);
    await decir('Las contramedidas recomendadas para el tipo de vía y de siniestro, ordenadas por su factor de reducción y con la referencia bibliográfica que lo respalda.');
    for (const c of await contramedidas.getByText(/reducción esperada/).all()) await senalar(page, c, 900);
    await decir('El técnico elige cuáles incluir y emite la ficha, que queda numerada y registrada a su nombre. Es un insumo para la decisión, no la reemplaza.');
    await toma.leido();
    await clic(page, page.getByRole('button', { name: 'Emitir ficha FI-2026-0043' }));
    await expect(page.getByText('Ficha FI-2026-0043 emitida')).toBeVisible();
    await toma.enfocar();
    await decir('La ficha FI-2026-0043 queda emitida, y el lugar la muestra como vigente en la priorización.');
    await toma.leido();
    await page.goto('/priorizacion/fichas');
    await toma.enfocar(page.getByRole('table', { name: 'Fichas de intervención emitidas' }));
    await decir('El listado de fichas emitidas permite buscarlas por número, ruta o lugar, y muestra quién emitió cada una y cuándo.');
    await senalar(page, page.getByRole('row', { name: /FI-2026-0043/ }), 1500);
  });

  // ── Alertar el reclamo desatendido (CU09, CU10).
  await toma.escena('bandeja', async () => {
    await page.goto('/reclamos');
    await expect(fila(page, 'PN-2026-0157')).toHaveAttribute('data-estado', 'alerta');
    await decir('La bandeja de reclamos no ordena por riesgo: ordena por los siniestros ocurridos después de cada reclamo y por los días que lleva sin respuesta.');
    await toma.leido();
    await toma.enfocar(page.getByRole('region', { name: 'Reclamos', exact: true }).getByRole('row').first(), filas(page).nth(3));
    await decir('Arriba quedan los desatendidos: reclamos a los que siguió un siniestro en el mismo lugar. PN-2026-0157 recibió su alerta con la crónica incorporada al comienzo.');
    await senalar(page, fila(page, 'PN-2026-0157'), 1200);
    await toma.leido();

    const lateral = page.getByRole('complementary', { name: 'Reclamo elegido', exact: true });
    const mapa = lateral.getByRole('group', { name: /Mapa de la/ }).first();
    await toma.enfocar(mapa);
    await decir('El mapa sitúa los reclamos y los siniestros posteriores. Abre sobre la ciudad de Córdoba y puede pasar a la provincia completa.');
    await clic(page, lateral.getByRole('button', { name: 'Provincia' }));
    await pausa(page, 2500);
    await clic(page, lateral.getByRole('button', { name: 'Ciudad' }));
    await toma.leido();

    await clic(page, fila(page, 'PN-2026-0157'));
    await toma.enfocar(lateral);
    await decir('La vista previa resume la historia del reclamo: cuándo se presentó, cuándo ocurrió el siniestro y desde cuándo está en alerta.');
    await toma.leido();
    await toma.enfocar();
    await clic(page, page.getByRole('region', { name: 'Vista previa de PN-2026-0157', exact: true }).getByRole('link', { name: 'Abrir PN-2026-0157' }));
    await expect(page).toHaveURL(/\/reclamos\/PN-2026-0157$/);
    await toma.enfocar(page.getByRole('region', { name: 'Estado del reclamo', exact: true }), page.getByRole('region', { name: /Siniestros posteriores al reclamo/ }));
    await decir('El detalle muestra el estado del reclamo, lo que pidió el vecino y el siniestro posterior, ocurrido a 15 metros del lugar reclamado.');
    await toma.leido();
    await toma.enfocar(page.getByRole('region', { name: 'El lugar', exact: true }));
    await decir('El croquis y el mapa sitúan el reclamo y el siniestro en el mismo punto de la avenida.');
    await toma.leido();
    const inspeccion = page.getByRole('region', { name: 'Inspección del lugar', exact: true });
    await toma.enfocar(inspeccion);
    await decir('El técnico de tránsito agenda la inspección. El reclamo pasa a verificación y conserva su antigüedad.');
    await clic(page, page.getByLabel('Fecha de la inspección'));
    await page.getByLabel('Fecha de la inspección').fill('2026-09-16');
    await clic(page, page.getByRole('button', { name: 'Agendar inspección' }));
    await expect(page.getByText('PN-2026-0157 pasó a en verificación')).toBeVisible();
  });

  // ── Cerrar con respaldo (CU11), el cierre desmentido (RF16) y el fin de la demostración.
  await toma.escena('cierre', async () => {
    const resolver = page.getByRole('complementary', { name: 'Resolver el reclamo', exact: true });
    await toma.enfocar(page.getByLabel('Usuario de demostración'), resolver);
    await decir('El cierre sólo puede firmarlo el funcionario a cargo, y exige un respaldo verificable. Se cambia al usuario que tiene ese rol.');
    await elegir(page, page.getByLabel('Usuario de demostración'), { label: 'M. Ferreyra · Funcionario a cargo' });
    await toma.leido();
    await toma.enfocar(resolver);
    await decir('Se indica el motivo del cierre y su respaldo: en este caso, la orden de trabajo de la obra ejecutada.');
    await clic(page, page.getByRole('radio', { name: 'Obra ejecutada' }));
    await clic(page, page.getByRole('checkbox', { name: 'Número de orden de trabajo' }));
    await escribir(page, page.getByLabel('N.º de orden de trabajo'), 'OT-2026-0920');
    await toma.leido();
    await clic(page, page.getByRole('button', { name: 'Firmar y cerrar' }));
    await expect(page.getByText('PN-2026-0157 cerrado')).toBeVisible();
    await toma.enfocar(page.locator('[data-prueba="resolucion"]'));
    await decir('La resolución queda firmada con nombre, cargo y fecha.');
    await toma.leido();
    await toma.enfocar(page.getByRole('region', { name: 'Historia del reclamo', exact: true }));
    await decir('La historia del reclamo conserva cada paso, con su fecha y su autor.');
    await toma.leido();

    await page.goto('/reclamos?vista=todos');
    await toma.enfocar();
    await decir('La vista «Todos» reúne cada reclamo, también los cerrados y los que no tienen alerta.');
    await senalar(page, fila(page, 'PN-2026-0157'), 1200);
    await toma.leido();
    await clic(page, fila(page, 'PN-2026-0204'));
    await clic(page, page.getByRole('region', { name: 'Vista previa de PN-2026-0204', exact: true }).getByRole('link', { name: 'Abrir PN-2026-0204' }));
    await expect(page).toHaveURL(/\/reclamos\/PN-2026-0204$/);
    await toma.enfocar(page.getByRole('heading', { level: 2 }).first(), page.getByText(/Cierre desmentido por siniestro/).first());
    await decir('Un cierre no es definitivo. PN-2026-0204 se había cerrado por obra ejecutada, y un siniestro posterior en el lugar lo reabrió como cierre desmentido, sin perder su antigüedad.');
    await toma.leido();

    await toma.enfocar();
    await decir('El botón «Restablecer datos de demostración», al pie del menú, devuelve el sistema a su estado inicial para recorrerlo otra vez.');
    await clic(page, page.getByRole('button', { name: 'Restablecer datos de demostración' }));
    await expect(page.getByText('Datos de demostración restablecidos')).toBeVisible();
  });

  await toma.cerrar();
});

test('vecino: el reclamo desde el teléfono', async ({ browser }) => {
  test.setTimeout(300_000);
  const toma = new Toma('vecino');
  const page = await toma.abrir(browser, { width: 390, height: 844 }, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const decir = (t: string) => toma.decir(t);

  await toma.escena('reclamo', async () => {
    await page.goto('/reclamo');
    await decir('El vecino presenta el reclamo desde el teléfono, sin crear una cuenta y sin dar datos personales.');
    await toma.leido();
    await decir('Primero, dónde es: puede tocar el mapa o escribir la calle y la altura.');
    await clic(page, page.getByText('Prefiero escribir la calle y la altura'));
    await escribir(page, page.getByLabel('Calle'), 'Sabattini');
    await escribir(page, page.getByLabel('Altura'), '4720');
    await clic(page, page.getByRole('button', { name: 'Ubicar en el mapa' }));
    await expect(page.locator('[data-lugar]')).toHaveText('Av. Amadeo Sabattini al 4700');
    await decir('El sistema reconoce la dirección y la muestra con la identidad visual del lugar, igual que la verá el área técnica.');
    await toma.leido();
    await clic(page, page.getByRole('button', { name: 'Continuar' }));
    await decir('Después, qué pasa. La fotografía es optativa, y un control simple frena los envíos automatizados.');
    await escribir(page, page.getByLabel('¿Qué pasa en el lugar?'), 'No hay rampa ni senda en la esquina y los peatones cruzan entre los autos.');
    await clic(page, page.getByLabel('No soy un programa automático'));
    await toma.leido();
    await clic(page, page.getByRole('button', { name: 'Enviar reclamo' }));
    await expect(page.locator('[data-numero]')).toHaveText('PN-2026-0205');
    await decir('El reclamo queda registrado con su número, su fecha y el lugar, y llega a la bandeja del área técnica.');
  });

  await toma.cerrar();
});
