import { BrowserRouter } from 'react-router-dom';
import { Rutas } from './rutas/Rutas';
import { Avisos } from './ui';

/** La aplicación sin el enrutador: el cliente usa `BrowserRouter` y el pre-render `StaticRouter`. */
export function Aplicacion() {
  return (
    <>
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>
      <Rutas />
      <Avisos />
    </>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Aplicacion />
    </BrowserRouter>
  );
}
