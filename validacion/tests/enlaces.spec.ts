import { expect, test } from '@playwright/test';

/** Los otros dos enlaces que recibe el evaluador: la carpeta de Drive y el repositorio. */

const DRIVE = process.env.URL_DRIVE ?? 'https://drive.google.com/drive/folders/1h6gJafeSdBVx3QS7ACGtBTXZHZjTLiQQ';
const REPO = process.env.URL_REPO ?? 'https://github.com/josedaluzp/punto-ciego';
const ARCHIVOS = ['video-demo-punto-ciego.mp4', 'codigo-fuente-punto-ciego.zip', 'instructivo-puesta-en-marcha.pdf'];

test('la carpeta de Drive es pública y lista los tres archivos', async ({ page }, info) => {
  await page.goto(DRIVE);
  await expect(page, 'Drive pidió iniciar sesión: la carpeta no es pública').not.toHaveURL(/accounts\.google\.com/);
  try {
    for (const nombre of ARCHIVOS) {
      await expect(page.getByText(nombre, { exact: true }).first(), `falta ${nombre} en la carpeta`).toBeVisible({ timeout: 30_000 });
    }
  } finally {
    await page.screenshot({ path: info.outputPath('drive.png'), fullPage: true });
  }
});

test('el repositorio de GitHub responde, es público y tiene README con prototipo/ y video/', async ({ page, request }) => {
  const r = await page.goto(REPO);
  expect(r?.status()).toBe(200);
  await expect(page.locator('article.markdown-body').first()).toContainText('Punto Ciego');

  const [, , , dueno, nombre] = REPO.split('/');
  const repo = await request.get(`https://api.github.com/repos/${dueno}/${nombre}`);
  expect(repo.status()).toBe(200);
  expect((await repo.json()).private).toBe(false);
  const contenido = await request.get(`https://api.github.com/repos/${dueno}/${nombre}/contents/`);
  expect(contenido.status()).toBe(200);
  const nombres = (await contenido.json()).map((e: { name: string }) => e.name);
  expect(nombres).toEqual(expect.arrayContaining(['README.md', 'prototipo', 'video']));
  const readme = await request.get(`https://raw.githubusercontent.com/${dueno}/${nombre}/HEAD/README.md`);
  expect(readme.status()).toBe(200);
  expect(await readme.text()).toContain('punto-ciego-zeta.vercel.app');
});
