/**
 * Contenido provisorio de una ruta cuya pantalla construye una feature.
 * Cada feature reemplaza su página entera; este componente es de la base y
 * no hace falta tocarlo.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import css from './MarcadorFeature.module.css';

export interface MarcadorFeatureProps {
  /** Rama que la construye: "feat/priorizacion". */
  rama: string;
  /** Casos de uso que implementa, con su nombre. */
  casos: string[];
  requerimientos: string;
  /** Qué va a mostrar la pantalla, en una o dos oraciones. */
  descripcion: string;
  /** Piezas de la base que conviene usar. */
  piezas: string[];
  /** Cifras de la semilla que la pantalla debe reproducir. */
  datos?: ReactNode;
}

export function MarcadorFeature({ rama, casos, requerimientos, descripcion, piezas, datos }: MarcadorFeatureProps) {
  return (
    <section className={css.marcador} aria-labelledby="marcador-titulo">
      <h2 id="marcador-titulo" className={css.titulo}>
        Esta pantalla implementa {casos.length === 1 ? 'el caso de uso' : 'los casos de uso'} {casos.map((c) => c.split(' ')[0]).join(' y ')}
      </h2>
      <ul className={css.casos}>
        {casos.map((c) => (
          <li key={c}>
            <span className="registro">{c.split(' ')[0]}</span> {c.split(' ').slice(1).join(' ')}
          </li>
        ))}
      </ul>
      <p className={css.texto}>{descripcion}</p>
      <dl className={css.ficha}>
        <dt>Requerimientos</dt>
        <dd className="registro">{requerimientos}</dd>
        <dt>La construye</dt>
        <dd className="registro">{rama}</dd>
        <dt>Piezas de la base</dt>
        <dd>{piezas.join(', ')}</dd>
        {datos && (
          <>
            <dt>Datos de la semilla</dt>
            <dd>{datos}</dd>
          </>
        )}
      </dl>
      <p className={css.texto}>
        Las piezas compartidas se ven funcionando en el <Link to="/componentes">catálogo de componentes</Link>.
      </p>
    </section>
  );
}
