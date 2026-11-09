/**
 * Tabla densa con encabezados ordenables. Toda cifra va en columna, alineada
 * a la derecha y con dígitos de ancho fijo. La fila seleccionada lleva un
 * borde interior carbónico; el estado (alerta, revisión, confirmado,
 * cerrado) tiñe la fila entera.
 */
import { useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import css from './Tabla.module.css';

export type EstadoFila = 'alerta' | 'revision' | 'confirmado' | 'cerrado';

export interface Columna<T> {
  clave: string;
  titulo: ReactNode;
  /**
   * Título completo si `titulo` es abreviado: se suma, oculto a la vista,
   * después de la abreviatura y queda como `title` del encabezado.
   */
  tituloCompleto?: string;
  alinear?: 'izquierda' | 'derecha';
  /** Ancho CSS de la columna. */
  ancho?: string;
  render: (fila: T) => ReactNode;
  /** Valor para ordenar; sin él la columna no es ordenable. */
  orden?: (fila: T) => string | number | null;
  /** Oculta la columna en pantallas angostas. */
  ocultarEnMovil?: boolean;
}

export type Sentido = 'asc' | 'desc';

export interface TablaProps<T> {
  /** Nombre accesible de la tabla. */
  etiqueta: string;
  columnas: readonly Columna<T>[];
  filas: readonly T[];
  claveFila: (fila: T) => string;
  seleccionada?: string | null;
  onSeleccionar?: (fila: T) => void;
  estadoFila?: (fila: T) => EstadoFila | undefined;
  /** Orden inicial; sin él se respeta el orden de `filas`. */
  ordenInicial?: { clave: string; sentido: Sentido };
  vacio?: ReactNode;
  pie?: ReactNode;
}

/** Clases de una celda según su columna (las mismas en el encabezado y en el cuerpo). */
const claseCelda = (c: Pick<Columna<unknown>, 'alinear' | 'ocultarEnMovil'>) =>
  [c.alinear === 'derecha' && css.der, c.ocultarEnMovil && css.ocultable].filter(Boolean).join(' ');

export function Tabla<T>({ etiqueta, columnas, filas, claveFila, seleccionada, onSeleccionar, estadoFila, ordenInicial, vacio, pie }: TablaProps<T>) {
  const [orden, setOrden] = useState<{ clave: string; sentido: Sentido } | null>(ordenInicial ?? null);

  const ordenadas = useMemo(() => {
    if (!orden) return filas;
    const col = columnas.find((c) => c.clave === orden.clave);
    if (!col?.orden) return filas;
    const f = col.orden;
    const signo = orden.sentido === 'asc' ? 1 : -1;
    return [...filas].sort((a, b) => {
      const va = f(a);
      const vb = f(b);
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (va < vb ? -1 : 1) * signo;
    });
  }, [filas, columnas, orden]);

  const alternar = (clave: string) => {
    setOrden((o) => (o?.clave === clave ? { clave, sentido: o.sentido === 'asc' ? 'desc' : 'asc' } : { clave, sentido: 'desc' }));
  };

  const alTeclear = (e: KeyboardEvent<HTMLTableRowElement>, fila: T) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSeleccionar?.(fila);
    }
  };

  return (
    <div className={css.contenedor}>
      <table className={css.tabla} aria-label={etiqueta}>
        <thead>
          <tr>
            {columnas.map((c) => {
              const activa = orden?.clave === c.clave;
              const ariaSort = activa ? (orden!.sentido === 'asc' ? 'ascending' : 'descending') : c.orden ? 'none' : undefined;
              return (
                <th
                  key={c.clave}
                  scope="col"
                  aria-sort={ariaSort}
                  style={c.ancho ? { width: c.ancho } : undefined}
                  className={claseCelda(c)}
                >
                  {c.orden ? (
                    <button type="button" className={css.ordenar} onClick={() => alternar(c.clave)} title={c.tituloCompleto}>
                      <span>
                        {c.titulo}
                        {/* El nombre accesible empieza con lo que se ve (WCAG 2.5.3) y suma el título completo. */}
                        {c.tituloCompleto && <span className={css.paraLector}> ({c.tituloCompleto})</span>}
                      </span>
                      <svg width="9" height="12" viewBox="0 0 9 12" aria-hidden="true" className={css.flechas}>
                        <path d="M1.5 4.5L4.5 1.5 7.5 4.5" className={activa && orden!.sentido === 'asc' ? css.on : undefined} />
                        <path d="M1.5 7.5L4.5 10.5 7.5 7.5" className={activa && orden!.sentido === 'desc' ? css.on : undefined} />
                      </svg>
                    </button>
                  ) : (
                    <span title={c.tituloCompleto}>{c.titulo}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((f) => {
            const k = claveFila(f);
            const estado = estadoFila?.(f);
            const sel = seleccionada === k;
            return (
              <tr
                key={k}
                className={[css.fila, estado && css[estado], sel && css.sel, onSeleccionar && css.seleccionable].filter(Boolean).join(' ')}
                aria-selected={onSeleccionar ? sel : undefined}
                tabIndex={onSeleccionar ? 0 : undefined}
                onClick={onSeleccionar ? () => onSeleccionar(f) : undefined}
                onKeyDown={onSeleccionar ? (e) => alTeclear(e, f) : undefined}
                data-estado={estado}
              >
                {columnas.map((c) => (
                  <td key={c.clave} className={claseCelda(c)}>
                    {c.render(f)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {ordenadas.length === 0 && vacio}
      {pie && <div className={css.pie}>{pie}</div>}
    </div>
  );
}
