/* eslint-disable react-refresh/only-export-components -- entrada del pre-render en Node: no pasa por la recarga en caliente. */
/**
 * Entrada del pre-render (KT-06b): la aplicación en una ruta, con la semilla.
 * `scripts/prerenderizar.mjs` la renderiza con `renderToPipeableStream`
 * después del build del cliente.
 */
import { StrictMode } from 'react';
import { StaticRouter } from 'react-router-dom';
import { Aplicacion } from './App';

export { renderToPipeableStream } from 'react-dom/server';
export { ALIAS_PRERENDERIZADOS, ARCHIVO_SPA, RUTAS_PRERENDERIZADAS, archivoDeRuta } from './rutas/prerenderizadas';

export function aplicacionEn(ruta: string) {
  return (
    <StrictMode>
      <StaticRouter location={ruta}>
        <Aplicacion />
      </StaticRouter>
    </StrictMode>
  );
}
