import { Audio, Sequence, staticFile, useVideoConfig } from 'remotion';
import narracion from '../narracion.json';
import indice from '../public/voz/voz.json';

/**
 * Narración: un audio por texto, generado por scripts/narrar.py con la voz de
 * narracion.json. `indice` asocia cada texto (el mismo que se lee en pantalla) con su
 * archivo y su duración.
 */

const AUDIOS: Record<string, { archivo: string; ms: number }> = indice;
export const TEXTOS = narracion;

export function vozDe(texto: string) {
  const v = AUDIOS[texto];
  if (!v) throw new Error(`Falta la narración de «${texto.slice(0, 60)}…»: correr npm run voz.`);
  return v;
}

/** Segundos que dura la narración de un texto. */
export const segundosDe = (texto: string) => vozDe(texto).ms / 1000;

/** Reproduce la narración de `texto` desde el segundo `desde` de la secuencia actual. */
export const Narracion: React.FC<{ texto: string; desde: number }> = ({ texto, desde }) => {
  const { fps } = useVideoConfig();
  const v = vozDe(texto);
  return (
    <Sequence from={Math.round(desde * fps)} durationInFrames={Math.ceil((v.ms / 1000) * fps) + 1} layout="none">
      <Audio src={staticFile(`voz/${v.archivo}`)} />
    </Sequence>
  );
};
