import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';
import { ALIAS_PRERENDERIZADOS } from './rutas/prerenderizadas';
import './ui/base.css';

const raiz = document.getElementById('root')!;
const aplicacion = (
  <StrictMode>
    <App />
  </StrictMode>
);

// La raíz y /siniestros sólo redirigen: se sirven con el HTML de su destino,
// así que la dirección se corrige antes de hidratar.
const destino = ALIAS_PRERENDERIZADOS[location.pathname];
if (destino && raiz.dataset.ruta === destino) history.replaceState(history.state, '', destino + location.search + location.hash);

// Se hidrata sólo si el HTML es de esta misma pantalla (KT-06b); si no (una
// ruta con número o con parámetros), se arma de cero.
if (raiz.dataset.ruta && raiz.dataset.ruta === location.pathname && location.search === '') {
  hydrateRoot(raiz, aplicacion);
} else {
  raiz.replaceChildren();
  createRoot(raiz).render(aplicacion);
}
