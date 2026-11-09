/**
 * Control del build de producción (KT-06 del reporte k0lmenIA): corre al final
 * de `npm run build` y falla si
 * - algún chunk de JS supera LIMITE_JS_KB (el código va dividido por ruta), o
 * - se emiten subconjuntos de fuente que la demo no usa (sólo hace falta latin:
 *   el castellano entra completo en él).
 *
 * Uso: node scripts/verificar-bundle.mjs [carpeta-dist]
 */
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LIMITE_JS_KB = 300;
const SUBCONJUNTOS_SOBRANTES = /-(vietnamese|latin-ext|cyrillic|cyrillic-ext|greek|greek-ext)-/;

const dist = process.argv[2] ?? 'dist';
const assets = join(dist, 'assets');
const archivos = readdirSync(assets);
const problemas = [];

for (const a of archivos) {
  const kb = statSync(join(assets, a)).size / 1024;
  if (a.endsWith('.js') && kb > LIMITE_JS_KB) problemas.push(`${a}: ${kb.toFixed(0)} KB de JS (límite ${LIMITE_JS_KB} KB)`);
  if (/\.woff2?$/.test(a) && SUBCONJUNTOS_SOBRANTES.test(a)) problemas.push(`${a}: subconjunto de fuente que la demo no usa`);
}

if (problemas.length) {
  console.error(`verificar-bundle: ${problemas.length} problema(s)\n  ${problemas.join('\n  ')}`);
  process.exit(1);
}
const js = archivos.filter((a) => a.endsWith('.js'));
const mayor = Math.max(...js.map((a) => statSync(join(assets, a)).size / 1024));
console.log(`verificar-bundle: ${js.length} chunks de JS, el mayor de ${mayor.toFixed(0)} KB; fuentes sólo latin.`);
