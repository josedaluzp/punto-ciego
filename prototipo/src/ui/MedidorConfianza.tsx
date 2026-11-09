/** Confianza de una ubicación contra el umbral (RF07, RF08), como en la Figura 15. */
import { UMBRAL_CONFIANZA } from '../dominio/georreferenciacion';
import { decimal } from '../dominio/formato';
import css from './MedidorConfianza.module.css';

export function MedidorConfianza({ valor, umbral = UMBRAL_CONFIANZA }: { valor: number; umbral?: number }) {
  const supera = valor >= umbral;
  return (
    <div className={css.medidor}>
      <p className={css.cifras}>
        <b className={css.valor}>{decimal(valor)}</b> <span className={css.umbral}>umbral {decimal(umbral)}</span>
      </p>
      <div
        className={css.barra}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={valor}
        aria-label={`Confianza ${decimal(valor)}, umbral ${decimal(umbral)}`}
      >
        <span className={`${css.relleno} ${supera ? css.supera : css.bajo}`} style={{ width: `${valor * 100}%` }} />
        <span className={css.marca} style={{ left: `${umbral * 100}%` }} />
      </div>
    </div>
  );
}
