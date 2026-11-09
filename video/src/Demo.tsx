import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import {
  AbsoluteFill,
  Easing,
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import escritorio from '../public/tomas/escritorio.json';
import vecino from '../public/tomas/vecino.json';
import { C, PAPEL, REGISTRO, UI } from './estilo';
import { Encabezado, useEntrada } from './comunes';
import { CAPITULOS, PASOS, type Capitulo, type Toma } from './guion';
import { PuestaEnMarcha, DURACION_PUESTA } from './PuestaEnMarcha';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pistas que deja la grabación, en milisegundos desde el comienzo de cada toma. */
interface Pistas {
  escenas: { id: string; inicio: number; fin: number }[];
  subtitulos: { t: number; texto: string }[];
  camara: { t: number; foco: Rect | null }[];
}

const PISTAS: Record<Toma, Pistas> = { escritorio, vecino };
const TRANSICION = 14;
const PLACAS = { apertura: 4.5, problema: 5, cadena: 5.5, cierre: 6 };

/** Tamaño de la toma de escritorio y escala con que se muestra dentro del cuadro. */
const TOMA = { w: 1920, h: 1080 };
const ESCALA = 0.8;
/** La cámara acerca hasta 1,9 veces y tarda un segundo en llegar a cada zona. */
const ACERCAMIENTO_MAXIMO = 1.9;
const VIAJE_MS = 1000;
const MARGEN = 56;

function tramo(c: Capitulo, fps: number) {
  const e = PISTAS[c.toma].escenas.find((x) => x.id === c.escena);
  if (!e) throw new Error(`La toma ${c.toma} no tiene la escena "${c.escena}": volver a grabar.`);
  return { ...e, desde: Math.round((e.inicio / 1000) * fps), duracion: Math.round(((e.fin - e.inicio) / 1000) * fps) };
}

interface Vista {
  z: number;
  x: number;
  y: number;
}

const COMPLETA: Vista = { z: 1, x: 0, y: 0 };

/** Encuadre que deja la zona centrada y con margen, sin salirse de la toma. */
function vistaDe(foco: Rect | null): Vista {
  if (!foco) return COMPLETA;
  const z = Math.min(ACERCAMIENTO_MAXIMO, Math.max(1, Math.min(TOMA.w / (foco.w + 2 * MARGEN), TOMA.h / (foco.h + 2 * MARGEN))));
  const ancho = TOMA.w / z;
  const alto = TOMA.h / z;
  const dentro = (v: number, max: number) => Math.min(Math.max(v, 0), max);
  return { z, x: dentro(foco.x + foco.w / 2 - ancho / 2, TOMA.w - ancho), y: dentro(foco.y + foco.h / 2 - alto / 2, TOMA.h - alto) };
}

const mezclar = (a: Vista, b: Vista, p: number): Vista => ({ z: a.z + (b.z - a.z) * p, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p });
const avance = (ms: number) => Easing.inOut(Easing.cubic)(Math.min(1, Math.max(0, ms / VIAJE_MS)));

/**
 * Encuadre en el instante `ms`: cada evento de cámara parte de donde estaba la
 * cámara en ese momento (aunque el viaje anterior no hubiera terminado).
 */
function camaraEn(eventos: Pistas['camara'], ms: number): Vista {
  let desde = COMPLETA;
  let hacia = COMPLETA;
  let t0 = -Infinity;
  for (const e of eventos) {
    if (e.t > ms) break;
    desde = mezclar(desde, hacia, avance(e.t - t0));
    hacia = vistaDe(e.foco);
    t0 = e.t;
  }
  return mezclar(desde, hacia, avance(ms - t0));
}

/** Subtítulo vigente en el capítulo y cuántos cuadros lleva en pantalla. */
function useSubtitulo(toma: Toma, inicio: number, fin: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = inicio + (frame / fps) * 1000;
  const vigente = PISTAS[toma].subtitulos.filter((s) => s.t >= inicio && s.t <= Math.min(ms, fin)).at(-1);
  if (!vigente) return null;
  const opacidad = interpolate(ms - vigente.t, [0, 350], [0, 1], { extrapolateRight: 'clamp' });
  return { texto: vigente.texto, opacidad };
}

export function duracionTotal(fps: number) {
  const placas = Object.values(PLACAS).reduce((a, s) => a + Math.round(s * fps), 0);
  const capitulos = CAPITULOS.reduce((a, c) => a + tramo(c, fps).duracion, 0) + DURACION_PUESTA(fps);
  const transiciones = (CAPITULOS.length + Object.keys(PLACAS).length) * TRANSICION;
  return placas + capitulos - transiciones;
}


const Marca: React.FC<{ tam?: number; color?: string }> = ({ tam = 34, color = C.tinta }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: tam * 0.35, fontFamily: UI, fontWeight: 700, fontSize: tam, color }}>
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
    Punto Ciego
  </div>
);

const Apertura: React.FC = () => (
  <AbsoluteFill style={{ ...PAPEL, alignItems: 'center', justifyContent: 'center', gap: 36 }}>
    <div style={{ ...useEntrada(0) }}>
      <Marca tam={112} />
    </div>
    <div style={{ ...useEntrada(10), fontFamily: UI, fontSize: 40, color: C.tinta, textAlign: 'center', maxWidth: 1300, lineHeight: 1.3 }}>
      Sistema de priorización de puntos negros viales y alerta de reclamos desatendidos
    </div>
    <div style={{ ...useEntrada(22), fontFamily: REGISTRO, fontSize: 26, color: C.tenue, marginTop: 40, textAlign: 'center', lineHeight: 1.6 }}>
      Universidad Siglo 21 · Trabajo Final de Grado · Ingeniería en Software
      <br />
      José Paulino Da Luz Pereira · 2026
    </div>
  </AbsoluteFill>
);

const Problema: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: C.riel, alignItems: 'flex-start', justifyContent: 'center', padding: '0 220px', gap: 28 }}>
    <div style={{ ...useEntrada(0), fontFamily: UI, fontSize: 64, fontWeight: 600, color: C.rielTexto, lineHeight: 1.2 }}>
      Los organismos publican cuántas personas mueren en el tránsito.
    </div>
    <div style={{ ...useEntrada(28), fontFamily: UI, fontSize: 64, fontWeight: 700, color: C.amarillo }}>No publican dónde.</div>
    <div style={{ ...useEntrada(60), fontFamily: UI, fontSize: 32, color: C.rielTenue, marginTop: 24, maxWidth: 1300, lineHeight: 1.4 }}>
      Sin ese dato, las intervenciones sobre la vía se deciden por reclamo o por criterio, y ningún lugar puede compararse con otro según su riesgo.
    </div>
  </AbsoluteFill>
);

const Cadena: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ ...PAPEL, alignItems: 'center', justifyContent: 'center', gap: 64 }}>
      <div style={{ ...useEntrada(0), fontFamily: REGISTRO, fontSize: 28, color: C.tenue, letterSpacing: 2 }}>
        LA CADENA CENTRAL DEL PROTOTIPO
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
        {PASOS.map((paso, i) => {
          const p = interpolate(frame, [12 + i * 16, 28 + i * 16], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic) });
          return (
            <div key={paso} style={{ display: 'flex', alignItems: 'center', gap: 28, opacity: p }}>
              {i > 0 && <div style={{ fontFamily: UI, fontSize: 48, color: C.rojo }}>→</div>}
              <div style={{ border: `2px solid ${C.tinta}`, background: C.papel, width: 300, height: 170, boxSizing: 'border-box', padding: '0 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', fontFamily: UI, fontWeight: 600, fontSize: 34, color: C.tinta, textAlign: 'center', lineHeight: 1.2 }}>
                <div style={{ fontFamily: REGISTRO, fontSize: 22, color: C.rojo, marginBottom: 8 }}>{String(i + 1).padStart(2, '0')}</div>
                {paso}
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};


type PropsCapitulo = { n: number; c: Capitulo; desde: number; inicio: number; fin: number };

const CapituloEscritorio: React.FC<PropsCapitulo> = ({ n, c, desde, inicio, fin }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = inicio + (frame / fps) * 1000;
  const v = camaraEn(PISTAS.escritorio.camara.filter((e) => e.t >= inicio && e.t <= fin), ms);
  const subtitulo = useSubtitulo('escritorio', inicio, fin);
  const ANCHO = TOMA.w * ESCALA;
  return (
    <AbsoluteFill style={{ ...PAPEL, padding: '24px 192px 0' }}>
      <Encabezado n={n} c={c} />
      <div style={{ marginTop: 16, width: ANCHO, height: TOMA.h * ESCALA, border: `1px solid ${C.linea}`, boxShadow: '0 18px 50px -20px rgba(20,30,60,.35)', overflow: 'hidden', background: C.papel }}>
        <div style={{ width: TOMA.w, height: TOMA.h, transformOrigin: '0 0', transform: `scale(${ESCALA * v.z}) translate(${-v.x}px, ${-v.y}px)` }}>
          <OffthreadVideo src={staticFile('tomas/escritorio.webm')} trimBefore={desde} muted style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
      <div style={{ marginTop: 14, minHeight: 76, fontFamily: UI, fontSize: 28, lineHeight: 1.35, color: C.tinta, maxWidth: ANCHO, opacity: subtitulo?.opacidad ?? 0 }}>
        {subtitulo?.texto}
      </div>
    </AbsoluteFill>
  );
};

const CapituloTelefono: React.FC<PropsCapitulo> = ({ n, c, desde, inicio, fin }) => {
  const subtitulo = useSubtitulo('vecino', inicio, fin);
  return (
    <AbsoluteFill style={{ ...PAPEL, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 120 }}>
      <div style={{ padding: 14, borderRadius: 54, background: C.riel, boxShadow: '0 30px 70px -25px rgba(20,30,60,.5)', ...useEntrada(0) }}>
        <div style={{ width: 425, height: 920, borderRadius: 42, overflow: 'hidden', background: C.papel }}>
          <OffthreadVideo src={staticFile('tomas/vecino.webm')} trimBefore={desde} muted style={{ width: '100%', height: '100%' }} />
        </div>
      </div>
      <div style={{ width: 760, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <Encabezado n={n} c={c} />
        <div style={{ minHeight: 200, fontFamily: UI, fontSize: 36, lineHeight: 1.4, color: C.tinta, opacity: subtitulo?.opacidad ?? 0 }}>{subtitulo?.texto}</div>
      </div>
    </AbsoluteFill>
  );
};

const Cierre: React.FC = () => (
  <AbsoluteFill style={{ ...PAPEL, alignItems: 'center', justifyContent: 'center', gap: 34 }}>
    <div style={useEntrada(0)}>
      <Marca tam={84} />
    </div>
    <div style={{ ...useEntrada(10), fontFamily: UI, fontSize: 38, color: C.tinta, textAlign: 'center', lineHeight: 1.35, maxWidth: 1300 }}>
      De la crónica a la ficha de intervención, y del reclamo del vecino a la alerta que vuelve visible la omisión.
    </div>
    <div style={{ ...useEntrada(24), fontFamily: REGISTRO, fontSize: 24, color: C.tenue, textAlign: 'center', lineHeight: 1.7, marginTop: 30 }}>
      Prototipo web en TypeScript y React · datos sintéticos de demostración
      <br />
      El código fuente y el instructivo de puesta en marcha acompañan este video.
    </div>
  </AbsoluteFill>
);

export const Demo: React.FC = () => {
  const { fps } = useVideoConfig();
  const s = (seg: number) => Math.round(seg * fps);
  const transicion = <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSICION })} />;

  return (
    <AbsoluteFill style={{ backgroundColor: C.papel }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={s(PLACAS.apertura)}>
          <Apertura />
        </TransitionSeries.Sequence>
        {transicion}
        <TransitionSeries.Sequence durationInFrames={s(PLACAS.problema)}>
          <Problema />
        </TransitionSeries.Sequence>
        {transicion}
        <TransitionSeries.Sequence durationInFrames={s(PLACAS.cadena)}>
          <Cadena />
        </TransitionSeries.Sequence>
        {transicion}
        <TransitionSeries.Sequence durationInFrames={DURACION_PUESTA(fps)}>
          <PuestaEnMarcha />
        </TransitionSeries.Sequence>
        {CAPITULOS.flatMap((c, i) => {
          const { desde, duracion, inicio, fin } = tramo(c, fps);
          const Pantalla = c.toma === 'vecino' ? CapituloTelefono : CapituloEscritorio;
          return [
            <TransitionSeries.Transition key={`t${i}`} presentation={fade()} timing={linearTiming({ durationInFrames: TRANSICION })} />,
            <TransitionSeries.Sequence key={c.escena} durationInFrames={duracion}>
              <Pantalla n={i + 1} c={c} desde={desde} inicio={inicio} fin={fin} />
            </TransitionSeries.Sequence>,
          ];
        })}
        {transicion}
        <TransitionSeries.Sequence durationInFrames={s(PLACAS.cierre)}>
          <Cierre />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
