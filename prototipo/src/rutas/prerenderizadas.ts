/**
 * Rutas que el build pre-renderiza a HTML (KT-06b del reporte k0lmenIA): las
 * pantallas fijas, que con la semilla siempre muestran lo mismo. Las que
 * llevan número (ficha, reclamo) dependen de lo que el usuario cargó y se
 * arman en el cliente. La comparten el pre-render, el cliente, `vite preview`
 * y `vercel.json` (la prueba `prerenderizadas.test.ts` vigila que coincidan).
 */
export const RUTAS_PRERENDERIZADAS = [
  '/priorizacion',
  '/priorizacion/fichas',
  '/siniestros/cronicas',
  '/siniestros/revision',
  '/reclamo',
  '/reclamos',
  '/componentes',
] as const;

/** Direcciones que sólo redirigen: se sirven con el HTML de su destino. */
export const ALIAS_PRERENDERIZADOS: Readonly<Record<string, (typeof RUTAS_PRERENDERIZADAS)[number]>> = {
  '/': '/priorizacion',
  '/siniestros': '/siniestros/cronicas',
};

/** Archivo de `dist` con el HTML de una ruta (o alias) pre-renderizada: `/reclamos` → `reclamos/index.html`. */
export function archivoDeRuta(ruta: string): string {
  return ruta === '/' ? 'index.html' : `${ruta.slice(1)}/index.html`;
}

/** Shell vacío para el resto de las rutas: el cliente arma la pantalla. */
export const ARCHIVO_SPA = 'spa.html';
