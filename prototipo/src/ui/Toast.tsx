/** Pila de avisos breves; se monta una sola vez en la raíz. */
import { descartarAviso, useAvisos } from './avisos';
import { Icono } from './Icono';
import css from './Toast.module.css';

const ICONO = { info: 'documento', exito: 'ok', alerta: 'alerta', error: 'alerta' } as const;

export function Avisos() {
  const lista = useAvisos();
  return (
    <div className={css.pila} role="status" aria-live="polite" aria-relevant="additions">
      {lista.map((a) => (
        <div key={a.id} className={`${css.aviso} ${css[a.tono]}`}>
          <Icono nombre={ICONO[a.tono]} tamano={18} className={css.icono} />
          <div className={css.cuerpo}>
            <p className={css.texto}>{a.texto}</p>
            {a.detalle && <p className={css.detalle}>{a.detalle}</p>}
          </div>
          <button type="button" className={css.cerrar} onClick={() => descartarAviso(a.id)} aria-label="Cerrar aviso">
            <Icono nombre="cerrar" tamano={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
