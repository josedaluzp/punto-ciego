/**
 * Pre-render de las pantallas fijas (KT-06b del reporte k0lmenIA): después del
 * build del cliente y del de `src/entrada-servidor.tsx`, escribe en `dist` el
 * HTML de cada ruta de `RUTAS_PRERENDERIZADAS` con la semilla, para que el
 * teléfono pinte la pantalla antes de bajar y ejecutar el JS. El cliente la
 * hidrata (`src/main.tsx`). El resto de las rutas usa `spa.html`, el shell
 * vacío.
 *
 * Uso: node scripts/prerenderizar.mjs [carpeta-dist] [carpeta-servidor]
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { pathToFileURL } from 'node:url';

// React y el enrutador en su versión de producción, como en el navegador.
process.env.NODE_ENV = 'production';

const dist = process.argv[2] ?? 'dist';
const servidor = process.argv[3] ?? 'dist-servidor';
const { aplicacionEn, renderToPipeableStream, RUTAS_PRERENDERIZADAS, ALIAS_PRERENDERIZADOS, ARCHIVO_SPA, archivoDeRuta } = await import(
  pathToFileURL(resolve(servidor, 'entrada-servidor.js')).href
);

/** HTML de `ruta`, con las pantallas diferidas (`lazy`) ya resueltas. */
function renderizar(ruta) {
  return new Promise((resolver, rechazar) => {
    let html = '';
    const destino = new Writable({
      write(trozo, _codificacion, listo) {
        html += trozo.toString();
        listo();
      },
      final(listo) {
        resolver(html);
        listo();
      },
    });
    const flujo = renderToPipeableStream(aplicacionEn(ruta), {
      onAllReady: () => flujo.pipe(destino),
      onShellError: rechazar,
      onError: rechazar,
    });
  });
}

const plantilla = readFileSync(join(dist, 'index.html'), 'utf8');
const RAIZ = '<div id="root"></div>';
if (!plantilla.includes(RAIZ)) throw new Error(`prerenderizar: ${dist}/index.html no tiene ${RAIZ}`);

writeFileSync(join(dist, ARCHIVO_SPA), plantilla);

const escribir = (archivo, contenido) => {
  mkdirSync(dirname(join(dist, archivo)), { recursive: true });
  writeFileSync(join(dist, archivo), contenido);
};

const paginas = new Map();
for (const ruta of RUTAS_PRERENDERIZADAS) {
  const html = await renderizar(ruta);
  const pagina = plantilla.replace(RAIZ, `<div id="root" data-ruta="${ruta}">${html}</div>`);
  paginas.set(ruta, pagina);
  escribir(archivoDeRuta(ruta), pagina);
}
// Los alias (la raíz, /siniestros) se sirven con el HTML de su destino.
for (const [alias, destino] of Object.entries(ALIAS_PRERENDERIZADOS)) escribir(archivoDeRuta(alias), paginas.get(destino));

rmSync(servidor, { recursive: true, force: true });
console.log(`prerenderizar: ${paginas.size} rutas pre-renderizadas, ${Object.keys(ALIAS_PRERENDERIZADOS).length} alias; el resto usa ${ARCHIVO_SPA}.`);
