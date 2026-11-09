/** Controles de formulario estándar de la web, con su etiqueta. */
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import css from './Campos.module.css';

export interface Opcion {
  valor: string;
  texto: string;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  etiqueta: string;
  opciones: readonly Opcion[];
  valor: string;
  onCambio: (valor: string) => void;
  /** Muestra la etiqueta arriba del control; si no, queda sólo para lectores de pantalla. */
  etiquetaVisible?: boolean;
  /** Etiqueta en línea, a la izquierda (filas de filtros). */
  enLinea?: boolean;
}

export function Select({ etiqueta, opciones, valor, onCambio, etiquetaVisible = false, enLinea = false, className, id, ...resto }: SelectProps) {
  const auto = useId();
  const idc = id ?? auto;
  return (
    <div className={[css.campo, enLinea && css.enLinea, className].filter(Boolean).join(' ')}>
      <label htmlFor={idc} className={etiquetaVisible || enLinea ? css.etiqueta : 'solo-lectores'}>
        {etiqueta}
      </label>
      <span className={css.envoltorioSelect}>
        <select id={idc} className={css.select} value={valor} onChange={(e) => onCambio(e.target.value)} {...resto}>
          {opciones.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.texto}
            </option>
          ))}
        </select>
        <svg className={css.flecha} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M2.5 4.5L6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  );
}

interface CampoBase {
  etiqueta: string;
  ayuda?: ReactNode;
  error?: string;
  /** Texto en Courier Prime (direcciones web, números). */
  registro?: boolean;
}

/** Etiqueta, control y nota de ayuda o error, con el cableado de accesibilidad en un solo lugar. */
function Envoltorio({
  etiqueta,
  ayuda,
  error,
  className,
  id,
  children,
}: Pick<CampoBase, 'etiqueta' | 'ayuda' | 'error'> & {
  className?: string;
  id?: string;
  children: (a: { id: string; 'aria-invalid'?: true; 'aria-describedby'?: string }) => ReactNode;
}) {
  const auto = useId();
  const idc = id ?? auto;
  const nota = error ?? ayuda;
  return (
    <div className={[css.campo, className].filter(Boolean).join(' ')}>
      <label htmlFor={idc} className={css.etiqueta}>
        {etiqueta}
      </label>
      {children({ id: idc, 'aria-invalid': error ? true : undefined, 'aria-describedby': nota ? `${idc}-ayuda` : undefined })}
      {nota && (
        <p id={`${idc}-ayuda`} className={error ? css.error : css.ayuda}>
          {nota}
        </p>
      )}
    </div>
  );
}

export type CampoTextoProps = CampoBase & InputHTMLAttributes<HTMLInputElement>;

/** Campo de texto con etiqueta; reenvía `ref` al `<input>` (para enfocarlo, p. ej. al validar). */
export const CampoTexto = forwardRef<HTMLInputElement, CampoTextoProps>(function CampoTexto(
  { etiqueta, ayuda, error, registro, className, id, ...resto },
  ref,
) {
  return (
    <Envoltorio etiqueta={etiqueta} ayuda={ayuda} error={error} className={className} id={id}>
      {(a) => <input ref={ref} {...a} className={[css.entrada, registro && 'registro'].filter(Boolean).join(' ')} {...resto} />}
    </Envoltorio>
  );
});

export type AreaTextoProps = CampoBase & TextareaHTMLAttributes<HTMLTextAreaElement>;

/** Área de texto con etiqueta; reenvía `ref` al `<textarea>`. */
export const AreaTexto = forwardRef<HTMLTextAreaElement, AreaTextoProps>(function AreaTexto(
  { etiqueta, ayuda, error, registro, className, id, ...resto },
  ref,
) {
  return (
    <Envoltorio etiqueta={etiqueta} ayuda={ayuda} error={error} className={className} id={id}>
      {(a) => <textarea ref={ref} {...a} className={[css.entrada, css.area, registro && 'registro'].filter(Boolean).join(' ')} {...resto} />}
    </Envoltorio>
  );
});

/** Fila de filtros de una pantalla, con un texto de conteo a la derecha. */
export function FilaFiltros({ children, conteo }: { children: ReactNode; conteo?: ReactNode }) {
  return (
    <div className={css.filaFiltros}>
      {children}
      {conteo && <p className={css.conteo}>{conteo}</p>}
    </div>
  );
}
