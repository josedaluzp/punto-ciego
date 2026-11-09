/**
 * El mapa se baja aparte, después de la pantalla: su cartografía pesa más que
 * el resto de la página y no hace falta para leer la tabla o el formulario
 * (KT-06). Mientras llega, el lugar queda reservado con el mismo tamaño, así
 * que nada salta.
 */
import { lazy, Suspense } from 'react';
import type { MapaProps } from './Mapa';
import css from './Mapa.module.css';

const MapaSvg = lazy(() => import('./Mapa').then((m) => ({ default: m.Mapa })));

export function Mapa(props: MapaProps) {
  return (
    <Suspense fallback={<div className={[css.mapa, props.className].filter(Boolean).join(' ')} role="group" aria-label={props.etiqueta} aria-busy="true" />}>
      <MapaSvg {...props} />
    </Suspense>
  );
}
