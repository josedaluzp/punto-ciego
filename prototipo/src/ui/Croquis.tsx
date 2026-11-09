/**
 * Croquis del lugar, en planta, como el de un acta policial: el tramo de
 * ruta con sus progresivas o la cuadra con sus alturas, y cada siniestro
 * numerado en su posición con el gesto de su tipo (salida de calzada, choque
 * frontal, atropello…). Rojo si hubo víctimas fatales; tinta si no.
 *
 * Es ilustrativo: muestra posición por progresiva o altura y tipo de
 * siniestro, no trayectorias reales. Siempre lleva el rótulo "posición
 * ilustrativa" para que nadie lo lea como una reconstrucción pericial.
 *
 * `marcador` agrega una marca arrastrable sobre el eje (con el puntero o con
 * las flechas del teclado) para corregir una posición.
 *
 * `caracterizacion` dibuja el corte de la vía con sus datos (calzada simple o
 * doble con separador, carriles, banquina); sin ella, una calzada de dos
 * carriles sin banquina. Los números que caen cerca se apilan en tantos
 * niveles como hagan falta para que ninguno quede a menos de 26 px de otro
 * ni sobre el rótulo del sentido.
 */
import { useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { decimal } from '../dominio/formato';
import type { CaracterizacionVia, TipoSiniestro } from '../dominio/tipos';
import css from './Croquis.module.css';
import { arribaParaNiveles, asignarNiveles, describirVia, geometriaVia, VIA_POR_DEFECTO, yDeNivel, type Caja, type GeometriaVia } from './croquisGeometria';
import { Icono } from './Icono';

export interface SiniestroCroquis {
  numero: number;
  /** Progresiva (km) en un tramo, o altura en una cuadra. */
  posicion: number;
  tipo: TipoSiniestro | null;
  fatal: boolean;
  /** Descripción accesible: "03/2022 salida de calzada, motociclista". */
  descripcion: string;
}

export interface CroquisProps {
  modo: 'tramo' | 'cuadra';
  /** "RN 9" o "Av. Colón". */
  via: string;
  desde: number;
  hasta: number;
  /** Localidad hacia la que crece la progresiva o la altura. */
  sentido?: string;
  siniestros: readonly SiniestroCroquis[];
  seleccionado?: number | null;
  onSeleccionar?: (numero: number) => void;
  marcador?: { posicion: number; etiqueta: string; onMover?: (posicion: number) => void };
  /** Caracterización del sitio (`Concentracion.via`): calzadas, carriles y banquina. */
  caracterizacion?: CaracterizacionVia;
}

const X0 = 44;
/** Margen derecho del eje, en píxeles. */
const MARGEN_DERECHO = 34;
/** Borde superior mínimo de la calzada: deja lugar a un nivel de números arriba. */
const ARRIBA_MINIMO = 46;
/** Rótulo del sentido: línea de base relativa al borde de la calzada, alto y ancho del ícono. */
const SENTIDO_BASE = -18;
const SENTIDO_ALTO = 16;
const SENTIDO_ICONO = 14;

function etiquetaEje(modo: CroquisProps['modo'], v: number): string {
  return modo === 'tramo' ? `km ${decimal(v, 1)}` : String(Math.round(v));
}

export function Croquis({ modo, via, desde, hasta, sentido, siniestros, seleccionado, onSeleccionar, marcador, caracterizacion }: CroquisProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const figRef = useRef<HTMLElement>(null);
  const sentidoRef = useRef<SVGTextElement>(null);
  const idPatron = `pc-separador-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  // El dibujo se arma al ancho real del contenedor: la letra y los gestos
  // conservan su tamaño en pantalla en cualquier ancho.
  const [ancho, setAncho] = useState(700);
  useLayoutEffect(() => {
    const el = figRef.current;
    if (!el) return;
    const medir = () => setAncho(Math.max(280, Math.round(el.getBoundingClientRect().width)));
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Ancho real del rótulo del sentido, para que los números lo esquiven.
  const [anchoSentido, setAnchoSentido] = useState(0);
  useLayoutEffect(() => {
    const t = sentidoRef.current;
    const medido = t && typeof t.getComputedTextLength === 'function' ? t.getComputedTextLength() : 0;
    setAnchoSentido(medido > 0 ? Math.ceil(medido) : (sentido?.length ?? 0) * 7);
  }, [sentido]);
  const X1 = ancho - MARGEN_DERECHO;
  const [arrastre, setArrastre] = useState<number | null>(null);
  const rango = hasta - desde || 1;
  const aX = (v: number) => X0 + ((v - desde) / rango) * (X1 - X0);
  const deX = (x: number) => desde + ((Math.min(Math.max(x, X0), X1) - X0) / (X1 - X0)) * rango;
  const paso = modo === 'tramo' ? rango / 10 : rango >= 100 ? 10 : rango / 10;
  const marcas: number[] = [];
  for (let v = desde; v <= hasta + 1e-9; v += paso) marcas.push(Math.round(v * 1000) / 1000);
  const cadaRotulo = modo === 'tramo' ? 5 : Math.max(1, Math.round(50 / paso));

  // Corte de la vía y niveles de los números. Los niveles se calculan
  // relativos al borde de la calzada; después la calzada baja lo necesario
  // para que entren todos.
  const datosVia = caracterizacion ?? VIA_POR_DEFECTO;
  const relativa = geometriaVia(datosVia, 0);
  const ejeRelativo = relativa.eje - relativa.arriba;
  const xFinSentido = X1 + 22;
  const xIconoSentido = xFinSentido - anchoSentido - SENTIDO_ICONO - 4;
  const cajaSentido: Caja | null = sentido
    ? { x: xIconoSentido, y: SENTIDO_BASE - SENTIDO_ALTO + 4, w: xFinSentido - xIconoSentido, h: SENTIDO_ALTO }
    : null;
  const niveles = asignarNiveles(
    siniestros.map((s) => ({ numero: s.numero, x: aX(s.posicion), minimo: s.tipo === 'salida de calzada' ? 1 : 0 })),
    ejeRelativo,
    cajaSentido ? [cajaSentido] : [],
  );
  const nivelMaximo = Math.max(0, ...niveles.values());
  const arriba = arribaParaNiveles(nivelMaximo, ARRIBA_MINIMO);
  const g = geometriaVia(datosVia, arriba - relativa.anchoBanquina);
  const yMarcas = g.abajoTotal + 34;
  const ALTO = g.abajoTotal + 62;

  const posMarcador = arrastre ?? marcador?.posicion;
  const xDe = (clientX: number) => {
    const ctm = svgRef.current?.getScreenCTM();
    return ctm ? new DOMPoint(clientX, 0).matrixTransform(ctm.inverse()).x : null;
  };
  const alApretar = (e: PointerEvent<SVGGElement>) => {
    if (!marcador?.onMover || e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    const x = xDe(e.clientX);
    if (x !== null) setArrastre(deX(x));
  };
  const alMover = (e: PointerEvent<SVGGElement>) => {
    if (arrastre === null) return;
    const x = xDe(e.clientX);
    if (x !== null) setArrastre(deX(x));
  };
  const alSoltar = () => {
    if (arrastre !== null) marcador?.onMover?.(Math.round(arrastre * (modo === 'tramo' ? 10 : 1)) / (modo === 'tramo' ? 10 : 1));
    setArrastre(null);
  };
  const alTeclear = (e: KeyboardEvent<SVGGElement>) => {
    if (!marcador?.onMover) return;
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const nuevo = Math.min(hasta, Math.max(desde, marcador.posicion + d * paso * (e.shiftKey ? 5 : 1)));
    marcador.onMover(Math.round(nuevo * 1000) / 1000);
  };

  const titulo = `Croquis de ${via}, ${modo === 'tramo' ? `km ${desde} a ${hasta}` : `alturas ${desde} a ${hasta}`}${caracterizacion ? `, ${describirVia(caracterizacion)}` : ''}`;

  return (
    <figure className={css.croquis} ref={figRef}>
      <svg ref={svgRef} viewBox={`0 0 ${ancho} ${ALTO}`} width="100%" height={ALTO} role="group" aria-label={titulo} className={css.svg}>
        <defs>
          <marker id="pc-flecha-rojo" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L8 4L0 8z" fill="var(--rojo)" />
          </marker>
          <marker id="pc-flecha-tinta" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L8 4L0 8z" fill="var(--tinta)" />
          </marker>
          <pattern id={idPatron} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" className={css.rayado} />
          </pattern>
        </defs>

        <g aria-hidden="true">
          <CorteVia g={g} izq={X0 - 22} der={X1 + 22} patron={idPatron} />
          {marcas.map((v, i) => {
            const x = aX(v);
            const larga = i % cadaRotulo === 0;
            return (
              <g key={v}>
                <line x1={x} y1={larga ? yMarcas : yMarcas + 3} x2={x} y2={yMarcas + 10} className={larga ? css.marcaLarga : css.marca} />
                {larga && (
                  <text x={x} y={yMarcas + 24} textAnchor="middle" className={css.rotuloEje}>
                    {etiquetaEje(modo, v)}
                  </text>
                )}
              </g>
            );
          })}
          {sentido && (
            <g className={css.sentido}>
              <Icono nombre="flecha" tamano={SENTIDO_ICONO} x={xIconoSentido} y={arriba + SENTIDO_BASE - 11} />
              <text ref={sentidoRef} x={xFinSentido} y={arriba + SENTIDO_BASE} textAnchor="end">
                {sentido}
              </text>
            </g>
          )}
          <g transform="translate(8 10)">
            <path d="M0 12 L5 0 L10 12 L5 9z" fill="var(--tinta)" />
            <text x="5" y="24" textAnchor="middle" className={css.norte}>
              N
            </text>
          </g>
        </g>

        {siniestros.map((s) => (
          <Gesto
            key={s.numero}
            s={s}
            x={aX(s.posicion)}
            cy={arriba + yDeNivel(niveles.get(s.numero) ?? 0, ejeRelativo)}
            g={g}
            seleccionado={seleccionado === s.numero}
            onSeleccionar={onSeleccionar}
          />
        ))}

        {marcador && posMarcador !== undefined && (
          <g
            transform={`translate(${aX(posMarcador)} 0)`}
            className={[css.marcador, marcador.onMover && css.movible].filter(Boolean).join(' ')}
            role={marcador.onMover ? 'slider' : 'img'}
            tabIndex={marcador.onMover ? 0 : undefined}
            aria-label={marcador.etiqueta}
            aria-valuemin={marcador.onMover ? desde : undefined}
            aria-valuemax={marcador.onMover ? hasta : undefined}
            aria-valuenow={marcador.onMover ? marcador.posicion : undefined}
            aria-valuetext={marcador.onMover ? etiquetaEje(modo, marcador.posicion) : undefined}
            onPointerDown={alApretar}
            onPointerMove={alMover}
            onPointerUp={alSoltar}
            onPointerCancel={() => setArrastre(null)}
            onKeyDown={alTeclear}
          >
            <line x1={0} y1={arriba - 16} x2={0} y2={g.abajo + 8} className={css.lineaMarcador} />
            <path d={`M-8 ${arriba - 28} L8 ${arriba - 28} L0 ${arriba - 16} Z`} className={css.puntaMarcador} />
            <rect x={-14} y={arriba - 44} width={28} height={30} fill="transparent" />
          </g>
        )}
      </svg>
      <figcaption className={css.pie}>
        <span>Posición ilustrativa</span>
        <span>
          {siniestros.length === 0
            ? 'Sin siniestros para ubicar en este croquis'
            : `${modo === 'tramo' ? 'Cada siniestro, en su progresiva' : 'Cada siniestro, en su altura'} · rojo: con víctimas fatales`}
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * Corte de la vía en planta: banquinas, una o dos calzadas (con separador
 * rayado entre ellas), línea de eje entre sentidos y líneas de carril.
 */
function CorteVia({ g, izq, der, patron }: { g: GeometriaVia; izq: number; der: number; patron: string }) {
  const largo = der - izq;
  const pavimentada = g.banquina === 'pavimentada';
  const claseRelleno = pavimentada ? css.banquina : css.banquinaTierra;
  const claseBorde = pavimentada ? css.bordeBanquina : css.bordeTierra;
  const banquina = g.anchoBanquina > 0 && (
    <>
      {[g.arribaTotal, g.abajo].map((y) => (
        <rect key={y} x={izq} y={y} width={largo} height={g.anchoBanquina} className={claseRelleno} />
      ))}
      <line x1={izq} y1={g.arribaTotal} x2={der} y2={g.arribaTotal} className={claseBorde} />
      <line x1={izq} y1={g.abajoTotal} x2={der} y2={g.abajoTotal} className={claseBorde} />
    </>
  );
  return (
    <>
      {banquina}
      {g.calzadas.map((c) => (
        <g key={c.y}>
          <rect x={izq} y={c.y} width={largo} height={c.alto} className={css.calzada} />
          <line x1={izq} y1={c.y} x2={der} y2={c.y} className={css.borde} />
          <line x1={izq} y1={c.y + c.alto} x2={der} y2={c.y + c.alto} className={css.borde} />
        </g>
      ))}
      {g.separador && <rect x={izq} y={g.separador.y + 1} width={largo} height={g.separador.alto - 2} fill={`url(#${patron})`} />}
      {g.lineaEje && <line x1={izq} y1={g.eje} x2={der} y2={g.eje} className={css.eje} />}
      {g.divisorias.map((y) => (
        <line key={y} x1={izq} y1={y} x2={der} y2={y} className={css.carril} />
      ))}
    </>
  );
}

function Gesto({
  s,
  x,
  cy,
  g,
  seleccionado,
  onSeleccionar,
}: {
  s: SiniestroCroquis;
  x: number;
  /** Centro del número: sobre el eje o en el nivel que le tocó. */
  cy: number;
  g: GeometriaVia;
  seleccionado: boolean;
  onSeleccionar?: (n: number) => void;
}) {
  const color = s.fatal ? 'var(--rojo)' : 'var(--tinta)';
  const flecha = s.fatal ? 'url(#pc-flecha-rojo)' : 'url(#pc-flecha-tinta)';
  const otra = 'url(#pc-flecha-tinta)';
  // Carriles de ida y de vuelta junto al eje, y bordes de la calzada.
  const ida = g.ida;
  const vuelta = g.vuelta;
  const arriba = g.arriba;
  const abajo = g.abajoTotal;
  let trazo = null;
  switch (s.tipo) {
    case 'salida de calzada':
      trazo = <path d={`M${x - 28} ${ida} Q ${x - 6} ${ida} ${x + 3} ${arriba - 8}`} fill="none" stroke={color} strokeWidth="1.6" markerEnd={flecha} />;
      break;
    case 'choque frontal':
      trazo = (
        <>
          <path d={`M${x - 34} ${ida} L ${x - 12} ${ida}`} stroke={color} strokeWidth="1.6" markerEnd={flecha} />
          <path d={`M${x + 34} ${vuelta} L ${x + 12} ${vuelta}`} stroke="var(--tinta)" strokeWidth="1.6" markerEnd={otra} />
        </>
      );
      break;
    case 'atropello de peatón':
      trazo = (
        <>
          <path d={`M${x - 36} ${ida} L ${x - 12} ${ida}`} stroke="var(--tinta)" strokeWidth="1.6" markerEnd={otra} />
          <path d={`M${x + 4} ${abajo + 26} L ${x + 4} ${abajo + 4}`} stroke={color} strokeWidth="1.4" strokeDasharray="3 3" />
          <circle cx={x + 4} cy={abajo + 28} r="3" fill={color} />
        </>
      );
      break;
    case 'choque en giro':
      trazo = (
        <>
          <path d={`M${x - 36} ${ida} Q ${x - 4} ${ida} ${x - 2} ${arriba - 6}`} fill="none" stroke="var(--tinta)" strokeWidth="1.6" markerEnd={otra} />
          <path d={`M${x + 34} ${vuelta} L ${x + 12} ${vuelta}`} stroke={color} strokeWidth="1.6" markerEnd={flecha} />
        </>
      );
      break;
    case 'caída de motociclista':
      trazo = (
        <>
          <path d={`M${x - 38} ${ida} L ${x - 12} ${ida - 4}`} stroke={color} strokeWidth="1.4" strokeDasharray="4 3" />
          <path d={`M${x - 15} ${ida - 9} l6 6 m0 -6 l-6 6`} stroke={color} strokeWidth="1.4" />
        </>
      );
      break;
    case 'choque por alcance':
      trazo = (
        <>
          <path d={`M${x - 44} ${ida} L ${x - 28} ${ida}`} stroke="var(--tinta)" strokeWidth="1.6" markerEnd={otra} />
          <path d={`M${x - 24} ${ida} L ${x - 12} ${ida}`} stroke={color} strokeWidth="1.6" markerEnd={flecha} />
        </>
      );
      break;
    case 'choque lateral':
      trazo = (
        <>
          <path d={`M${x - 34} ${ida} L ${x - 12} ${ida}`} stroke={color} strokeWidth="1.6" markerEnd={flecha} />
          <path d={`M${x} ${abajo + 26} L ${x} ${abajo + 2}`} stroke="var(--tinta)" strokeWidth="1.6" markerEnd={otra} />
        </>
      );
      break;
    default:
      trazo = null;
  }
  const interactivo = !!onSeleccionar;
  return (
    <g
      className={[css.gesto, interactivo && css.gestoInteractivo, seleccionado && css.gestoSel].filter(Boolean).join(' ')}
      role={interactivo ? 'button' : 'img'}
      tabIndex={interactivo ? 0 : undefined}
      aria-label={`${s.numero}: ${s.descripcion}`}
      aria-pressed={interactivo ? seleccionado : undefined}
      onClick={interactivo ? () => onSeleccionar(s.numero) : undefined}
      onKeyDown={
        interactivo
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSeleccionar(s.numero);
              }
            }
          : undefined
      }
    >
      {trazo}
      <circle cx={x} cy={cy} r={seleccionado ? 12 : 10} fill="var(--papel)" stroke={color} strokeWidth={seleccionado ? 2.4 : 1.6} />
      <text x={x} y={cy + 4} textAnchor="middle" className={css.numero} fill={color}>
        {s.numero}
      </text>
    </g>
  );
}
