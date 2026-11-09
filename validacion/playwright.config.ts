import { defineConfig, devices } from '@playwright/test';

/**
 * Validación del evaluador de Punto Ciego.
 *
 * - publicada / publicada-movil: la app en Vercel (URL_APP para apuntar a otra).
 * - enlaces: carpeta pública de Drive y repositorio público de GitHub.
 * - local / local-movil: sólo si se define CLON=<ruta a punto-ciego/prototipo> con
 *   `npm install` ya hecho; compila y sirve el clon en PUERTO_LOCAL (4393 por defecto)
 *   y lo apaga al terminar.
 */
const URL_APP = process.env.URL_APP ?? 'https://punto-ciego-zeta.vercel.app';
const CLON = process.env.CLON;
const PUERTO_LOCAL = Number(process.env.PUERTO_LOCAL ?? 4393);

const escritorio = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } };
const movil = { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 };

export default defineConfig({
  testDir: './tests',
  outputDir: './resultados',
  fullyParallel: true,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: 'informe', open: 'never' }]],
  use: {
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Cordoba',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'publicada', testMatch: 'app.spec.ts', use: { ...escritorio, baseURL: URL_APP } },
    { name: 'publicada-movil', testMatch: 'app.spec.ts', use: { ...movil, baseURL: URL_APP } },
    { name: 'enlaces', testMatch: 'enlaces.spec.ts', use: { ...escritorio } },
    ...(CLON
      ? [
          { name: 'local', testMatch: 'app.spec.ts', use: { ...escritorio, baseURL: `http://localhost:${PUERTO_LOCAL}` } },
          { name: 'local-movil', testMatch: 'app.spec.ts', use: { ...movil, baseURL: `http://localhost:${PUERTO_LOCAL}` } },
        ]
      : []),
  ],
  webServer: CLON
    ? {
        command: `npm run build && npm run preview -- --port ${PUERTO_LOCAL} --strictPort`,
        cwd: CLON,
        url: `http://localhost:${PUERTO_LOCAL}`,
        reuseExistingServer: false,
        timeout: 180_000,
      }
    : undefined,
});
