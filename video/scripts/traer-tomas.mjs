// Copia a public/tomas lo que necesita el video:
// - las tomas grabadas por Playwright (../prototipo/demo/salida) con sus pistas
//   y la captura de la aplicación recién abierta;
// - el README del prototipo convertido a HTML, para la escena de puesta en marcha.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const prototipo = join(raiz, '..', 'prototipo');
const origen = join(prototipo, 'demo', 'salida');
const destino = join(raiz, 'public', 'tomas');
mkdirSync(destino, { recursive: true });

const archivos = ['escritorio.webm', 'escritorio.json', 'escritorio-inicio.png', 'vecino.webm', 'vecino.json'];
for (const nombre of archivos) {
  const archivo = join(origen, nombre);
  if (!existsSync(archivo)) {
    console.error(`Falta ${archivo}: correr antes "npm run demo:grabar" en prototipo/.`);
    process.exit(1);
  }
  copyFileSync(archivo, join(destino, nombre));
}

const readme = readFileSync(join(prototipo, 'README.md'), 'utf8');
writeFileSync(join(destino, 'readme.html'), await marked.parse(readme));

console.log(`Tomas y README copiados a ${destino}`);
