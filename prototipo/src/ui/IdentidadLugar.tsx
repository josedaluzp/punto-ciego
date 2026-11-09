/**
 * Identidad de un lugar en las listas, tomada de la señalización vial
 * argentina: escudo de ruta nacional (blanco con borde negro, "RUTA NAC." y
 * el número), chapa azul de nomenclatura con el nombre de la calle, mojón
 * kilométrico "KM 694" y el índice de riesgo dentro de un rombo amarillo de
 * prevención.
 *
 * Los textos de los signos se ajustan al ancho disponible (`textLength`) para
 * que nunca se recorten, en escritorio ni en el teléfono.
 */
import type { CSSProperties } from 'react';
import { decimal } from '../dominio/formato';
import css from './IdentidadLugar.module.css';
import { ajustarChapa } from './textoChapa';

/** Tamaño mínimo del escudo: por debajo, "RUTA NAC." deja de leerse. */
const ESCUDO_MINIMO = 36;

/** Base mínima de la chapa: por debajo, el nombre de la calle no se lee. */
const CHAPA_MINIMA = 34;

/** Escudo de ruta: nacional (RN) o provincial (RP). */
export function EscudoRuta({ ruta, tamano = 40 }: { ruta: string; tamano?: number }) {
  const provincial = ruta.startsWith('RP');
  const numero = ruta.replace(/^R[NP]\s*/, '');
  const etiqueta = `${provincial ? 'Ruta provincial' : 'Ruta nacional'} ${numero}`;
  const px = Math.max(tamano, ESCUDO_MINIMO);
  const cifra = numero.length >= 3 ? 14 : numero.length === 2 ? 17 : 19;
  const anchoCifra = numero.length * 0.6 * cifra;
  return (
    <svg width={px} height={px} viewBox="0 0 40 40" role="img" aria-label={etiqueta} className={css.signo}>
      {provincial ? (
        <rect x="2" y="3" width="36" height="34" rx="5" fill="white" stroke="var(--negro)" strokeWidth="2" />
      ) : (
        <path d="M2.5 2.5 H37.5 V20.5 Q37.5 33 20 38 Q2.5 33 2.5 20.5 Z" fill="white" stroke="var(--negro)" strokeWidth="2" strokeLinejoin="round" />
      )}
      <text
        x="20"
        y="11.4"
        textAnchor="middle"
        fontFamily="var(--ui)"
        fontWeight="700"
        fontSize="7.6"
        fill="var(--negro)"
        textLength="29"
        lengthAdjust="spacingAndGlyphs"
      >
        {provincial ? 'RUTA PROV.' : 'RUTA NAC.'}
      </text>
      <text
        x="20"
        y={numero.length >= 3 ? 28.6 : 29.6}
        textAnchor="middle"
        fontFamily="var(--ui)"
        fontWeight="800"
        fontSize={cifra}
        fill="var(--negro)"
        style={{ fontVariantNumeric: 'tabular-nums' }}
        {...(anchoCifra > 27 ? { textLength: 27, lengthAdjust: 'spacingAndGlyphs' } : {})}
      >
        {numero}
      </text>
    </svg>
  );
}

/**
 * Chapa azul de nomenclatura con el nombre de la calle en blanco. Ocupa
 * `tamano` × 1,75 de ancho para que entre el nombre; sin calle, dice SIN CALLE.
 *
 * La calle llega sólo por `calle`. `titulo` es nada más la etiqueta accesible
 * (por defecto, "Calle: <nombre>"); nunca se lee para sacar la calle.
 */
export function ChapaCalle({ tamano = 40, titulo, calle }: { tamano?: number; titulo?: string; calle?: string }) {
  const etiqueta = titulo ?? (calle ? `Calle: ${calle}` : 'Calle urbana');
  const ancho = anchoChapa(tamano);
  const alto = Math.round(Math.max(tamano, CHAPA_MINIMA) * 0.66);
  const disponible = ancho - 8;
  const { prefijo, nombre, fuente, comprimir } = ajustarChapa(calle, disponible, Math.min(12, alto * 0.5));

  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={etiqueta} className={css.signo}>
      <rect x="0.5" y="0.5" width={ancho - 1} height={alto - 1} rx="3" fill="var(--azul-calle)" />
      <rect x="2.5" y="2.5" width={ancho - 5} height={alto - 5} rx="1.6" fill="none" stroke="white" strokeWidth="1" />
      <text
        x={ancho / 2}
        y={alto / 2 + fuente * 0.36}
        textAnchor="middle"
        fontFamily="var(--ui)"
        fontWeight="700"
        fontSize={fuente}
        fill="white"
        {...(comprimir ? { textLength: disponible, lengthAdjust: 'spacingAndGlyphs' } : {})}
      >
        {prefijo && (
          <tspan fontSize={fuente * 0.72} fontWeight="600">
            {prefijo}{' '}
          </tspan>
        )}
        {nombre}
      </text>
    </svg>
  );
}

function anchoChapa(tamano: number): number {
  return Math.round(Math.max(tamano, CHAPA_MINIMA) * 1.75);
}

/** Mojón kilométrico: "KM 694". */
export function Mojon({ km }: { km: number }) {
  const texto = Number.isInteger(km) ? String(km) : decimal(km, 1);
  return (
    <span className={css.mojon} aria-label={`kilómetro ${texto}`}>
      <small aria-hidden="true">KM</small>
      <span aria-hidden="true">{texto}</span>
    </span>
  );
}

/** Rombo amarillo de prevención con el índice de riesgo. */
export function RomboIndice({ valor, tamano = 'normal' }: { valor: number; tamano?: 'chico' | 'normal' | 'grande' }) {
  const px = { chico: 40, normal: 44, grande: 56 }[tamano];
  const texto = decimal(valor);
  return (
    <svg width={px} height={px} viewBox="0 0 40 40" role="img" aria-label={`Índice de riesgo ${texto}`} className={css.signo}>
      <rect x="6.5" y="6.5" width="27" height="27" rx="2.2" transform="rotate(45 20 20)" fill="var(--amarillo)" stroke="var(--negro)" strokeWidth="1.5" />
      <text
        x="20"
        y="23.9"
        textAnchor="middle"
        fontFamily="var(--ui)"
        fontWeight="800"
        fontSize="10.6"
        fill="var(--negro)"
        style={{ fontVariantNumeric: 'tabular-nums' }}
        textLength={texto.length > 4 ? 25 : undefined}
        lengthAdjust={texto.length > 4 ? 'spacingAndGlyphs' : undefined}
      >
        {texto}
      </text>
    </svg>
  );
}

/**
 * Escudo para una ruta o chapa para una calle, según el lugar. Reserva el
 * ancho de la chapa en los dos casos para que el texto de al lado quede
 * alineado en las listas.
 */
export function IdentidadLugar({ ruta, calle, tamano = 40 }: { ruta?: string; calle?: string; tamano?: number }) {
  return (
    <span className={css.identidad} style={{ '--ancho-identidad': `${anchoChapa(tamano)}px` } as CSSProperties}>
      {ruta ? <EscudoRuta ruta={ruta} tamano={tamano} /> : <ChapaCalle tamano={tamano} calle={calle} />}
    </span>
  );
}
