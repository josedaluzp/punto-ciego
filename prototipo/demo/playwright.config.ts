import { defineConfig } from '@playwright/test';

/**
 * Grabación del video de la demo (no es una prueba): `npm run demo:grabar`.
 * Los videos y las marcas de cada escena quedan en demo/salida/ y los toma el
 * proyecto Remotion de ../video.
 */
const PUERTO = Number(process.env.PUERTO_DEMO ?? 4180);

export default defineConfig({
  testDir: '.',
  testMatch: 'grabar.spec.ts',
  outputDir: './salida/playwright',
  workers: 1,
  reporter: [['list']],
  timeout: 300_000,
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    browserName: 'chromium',
    locale: 'es-AR',
    timezoneId: 'America/Argentina/Cordoba',
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${PUERTO} --strictPort`,
    url: `http://localhost:${PUERTO}`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
