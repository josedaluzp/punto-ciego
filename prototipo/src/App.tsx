import { BrowserRouter } from 'react-router-dom';
import { Rutas } from './rutas/Rutas';
import { Avisos } from './ui';

export function App() {
  return (
    <BrowserRouter>
      <a href="#contenido" className="saltar">
        Saltar al contenido
      </a>
      <Rutas />
      <Avisos />
    </BrowserRouter>
  );
}
