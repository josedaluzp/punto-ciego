/** Campo de búsqueda con la etiqueta en línea, para la fila de filtros. */
import { useId } from 'react';
import campos from '../../ui/Campos.module.css';
import css from './ficha.module.css';

export function Busqueda({ etiqueta, placeholder, valor, onCambio }: { etiqueta: string; placeholder: string; valor: string; onCambio: (v: string) => void }) {
  const id = useId();
  return (
    <div className={[campos.campo, campos.enLinea, css.busqueda].join(' ')}>
      <label htmlFor={id} className={campos.etiqueta}>
        {etiqueta}
      </label>
      <input id={id} type="search" className={campos.entrada} placeholder={placeholder} value={valor} onChange={(e) => onCambio(e.target.value)} />
    </div>
  );
}
