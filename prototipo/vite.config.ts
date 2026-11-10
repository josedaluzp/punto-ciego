import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { ARCHIVO_SPA, archivoDeRuta } from './src/rutas/prerenderizadas';

/**
 * `vite preview` sirve como Vercel (`vercel.json`): cada ruta pre-renderizada
 * con su HTML (KT-06b) y el resto con el shell vacío (`ARCHIVO_SPA`).
 */
function servirPrerender(): Plugin {
  return {
    name: 'servir-prerender',
    configurePreviewServer(servidor) {
      const dist = join(servidor.config.root, servidor.config.build.outDir);
      servidor.middlewares.use((pedido, _respuesta, siguiente) => {
        const [ruta = '/', consulta] = (pedido.url ?? '/').split('?');
        if (ruta !== '/' && !ruta.includes('.') && pedido.headers.accept?.includes('text/html')) {
          const archivo = archivoDeRuta(ruta.replace(/\/$/, ''));
          const html = `/${existsSync(join(dist, archivo)) ? archivo : ARCHIVO_SPA}`;
          pedido.url = consulta ? `${html}?${consulta}` : html;
        }
        siguiente();
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), servirPrerender()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: {
    // Un solo CSS en el <head>: el HTML pre-renderizado ya sale con el estilo de su pantalla (KT-06b).
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        // React y la cartografía cambian poco: van en chunks propios que el navegador baja en paralelo y guarda en caché (KT-06).
        manualChunks(id) {
          if (/node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler|zustand)[\\/]/.test(id)) return 'vendor';
          if (id.endsWith('cartografia.json')) return 'cartografia';
          return undefined;
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
