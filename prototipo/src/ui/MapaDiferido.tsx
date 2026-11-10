/**
 * El mapa se baja aparte, después de la pantalla: su cartografía pesa más que
 * el resto de la página y no hace falta para leer la tabla o el formulario
 * (KT-06). Mientras llega, el lugar queda reservado con el mismo tamaño, así
 * que nada salta. Tampoco va en el HTML pre-renderizado (KT-06b): pesaría
 * ~100 KB y se dibujaría sin conocer el tamaño real; se arma al hidratar.
 */
import { lazy, Suspense, useSyncExternalStore } from 'react';
import type { MapaProps } from './Mapa';
import css from './Mapa.module.css';

const MapaSvg = lazy(() => import('./Mapa').then((m) => ({ default: m.Mapa })));

const sinCambios = () => () => {};
/** `false` en el pre-render y al hidratar; `true` en el cliente. */
const useEnCliente = () =>
  useSyncExternalStore(
    sinCambios,
    () => true,
    () => false,
  );

export function Mapa(props: MapaProps) {
  const lugar = <div className={[css.mapa, props.className].filter(Boolean).join(' ')} role="group" aria-label={props.etiqueta} aria-busy="true" />;
  if (!useEnCliente()) return lugar;
  return (
    <Suspense fallback={lugar}>
      <MapaSvg {...props} />
    </Suspense>
  );
}
