/**
 * Área de texto de la crónica con el lugar extraído resaltado (Figura 15).
 * El resaltado vive en una capa debajo del control, con la misma letra y el
 * mismo ajuste de línea; el control sigue siendo un textarea nativo.
 */
import { useId, useRef, type UIEvent } from 'react';
import css from './Cronicas.module.css';

export function TextoCronica({
  valor,
  onCambio,
  resaltado,
  error,
  deshabilitado,
}: {
  valor: string;
  onCambio: (v: string) => void;
  resaltado: { inicio: number; fin: number } | null;
  error?: string;
  deshabilitado?: boolean;
}) {
  const id = useId();
  const capa = useRef<HTMLDivElement>(null);
  const sincronizar = (e: UIEvent<HTMLTextAreaElement>) => {
    if (capa.current) capa.current.scrollTop = e.currentTarget.scrollTop;
  };
  const r = resaltado && resaltado.fin <= valor.length ? resaltado : null;
  return (
    <div className={css.campo}>
      <label htmlFor={id} className={css.etiqueta}>
        Texto de la crónica
      </label>
      <div className={css.textoCronica}>
        <div ref={capa} className={css.capaResaltado} aria-hidden="true">
          {r ? (
            <>
              {valor.slice(0, r.inicio)}
              <mark>{valor.slice(r.inicio, r.fin)}</mark>
              {valor.slice(r.fin)}
            </>
          ) : (
            valor
          )}
          {'\n'}
        </div>
        <textarea
          id={id}
          className={css.areaCronica}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          onScroll={sincronizar}
          rows={9}
          spellCheck={false}
          disabled={deshabilitado}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-nota`}
          placeholder="Pegá el texto completo de la nota periodística."
        />
      </div>
      <p id={`${id}-nota`} className={error ? css.error : css.ayuda}>
        {error ?? (r ? 'Resaltado: el fragmento que el sistema reconoció como lugar del hecho.' : 'El sistema extrae el lugar, la fecha del hecho, las víctimas y el tipo de siniestro.')}
      </p>
    </div>
  );
}
