/**
 * Chips de estado, número de registro y estado vacío. El estado también tiñe
 * la fila entera de una tabla (ver `Tabla.estadoFila`); el chip es para
 * cuando no hay fila.
 */
import type { ReactNode } from 'react';
import { ESTADOS, type ClaveEstado } from './estados';
import css from './Estado.module.css';

export function ChipEstado({ estado, children }: { estado: ClaveEstado; children?: ReactNode }) {
  const e = ESTADOS[estado];
  return <span className={`${css.chip} ${css[e.tono]}`}>{children ?? e.texto}</span>;
}

/** Número de registro en Courier Prime: C-0007, FI-2026-0042, PN-2026-0131. */
export function Registro({ children, tenue }: { children: ReactNode; tenue?: boolean }) {
  return <span className={`registro ${tenue ? css.registroTenue : ''}`}>{children}</span>;
}

/** Estado vacío: dice qué falta y qué se puede hacer. */
export function Vacio({ titulo, children, accion }: { titulo: string; children?: ReactNode; accion?: ReactNode }) {
  return (
    <div className={css.vacio} role="status">
      <p className={css.vacioTitulo}>{titulo}</p>
      {children && <div className={css.vacioTexto}>{children}</div>}
      {accion && <div className={css.vacioAccion}>{accion}</div>}
    </div>
  );
}

/** Aviso de datos sintéticos (RNF02). */
export function AvisoSintetico({ variante = 'papel' }: { variante?: 'papel' | 'riel' | 'banda' }) {
  return (
    <p className={`${css.aviso} ${css[`aviso-${variante}`]}`} data-aviso-sintetico>
      Datos sintéticos de demostración
    </p>
  );
}
