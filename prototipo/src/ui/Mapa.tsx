/**
 * Mapa en SVG propio, sin teselas: provincia de Córdoba (contorno, vecinas,
 * rutas nacionales con su rótulo, ciudades) o ciudad de Córdoba (red vial en
 * tres jerarquías). Cartografía de la Entrega 2 (`src/datos/cartografia.json`).
 *
 * - Marcadores por lat/lon: punto (sobre calle), tramo (barra orientada sobre
 *   la ruta entre dos progresivas) y pin (posición propuesta o corregida).
 *   Su tamaño en pantalla no cambia con el acercamiento.
 * - `arrastrable` + `onArrastrar`: el analista mueve el marcador con el
 *   puntero o con las flechas del teclado (Mayúscula = paso largo).
 * - `encuadre`: acerca el mapa a un lugar. Botones de acercar, alejar y
 *   volver al encuadre completo; con el mapa acercado, arrastrar el fondo lo
 *   desplaza.
 * - `onClicMapa`: devuelve la lat/lon de un clic en el fondo (para marcar un
 *   reclamo).
 * - Los nombres de ciudades y rutas van en una capa por encima de los
 *   marcadores, con halo de papel, y se corren para no taparlos ni pisarse.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import cartografia from '../datos/cartografia.json';
import type { LatLon } from '../dominio/geo';
import { trazaTramo } from '../dominio/postes';
import { aPlano, dePlano, pxPorKm, type Plano } from '../dominio/proyeccion';
import { Icono } from './Icono';
import css from './Mapa.module.css';
import { anchoTexto, puntosDeTraza, ubicarRotulos, type Caja as CajaRotulo } from './rotulosMapa';

export type FormaMarcador = 'punto' | 'tramo' | 'pin';
export type TonoMarcador = 'riesgo' | 'alerta' | 'revision' | 'confirmado' | 'carbon' | 'tenue';

export interface Marcador extends LatLon {
  id: string;
  forma: FormaMarcador;
  tono: TonoMarcador;
  /** 0..1: escala el tamaño (por ejemplo, el índice de riesgo). */
  tamano?: number;
  /** Texto corto junto al marcador (rango, número). */
  rotulo?: string;
  /** Nombre accesible del marcador. */
  titulo: string;
  arrastrable?: boolean;
  /** Para un tramo: ruta y progresivas, para orientar la barra sobre la traza. */
  ruta?: string;
  kmDesde?: number;
  kmHasta?: number;
}

export interface Encuadre {
  centro: LatLon;
  /** Radio visible aproximado, en km. */
  radioKm: number;
}

export interface MapaProps {
  vista: Plano;
  /** Nombre accesible del mapa. */
  etiqueta: string;
  marcadores?: readonly Marcador[];
  seleccionado?: string | null;
  onSeleccionar?: (id: string) => void;
  /** Fin de un arrastre (o cada paso de teclado) de un marcador arrastrable. */
  onArrastrar?: (id: string, posicion: LatLon) => void;
  onClicMapa?: (posicion: LatLon) => void;
  encuadre?: Encuadre | null;
  /** Ruta a destacar con trazo grueso. */
  rutaDestacada?: string;
  /** Muestra los botones de acercar y alejar (por defecto, sí). */
  controles?: boolean;
  /** Muestra los nombres de las ciudades y de las rutas (por defecto, sí). */
  rotulos?: boolean;
  leyenda?: ReactNode;
  className?: string;
}

interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

const prov = cartografia.provincia;
/** Ciudades con nombre en el mapa (Villa Carlos Paz y Alta Gracia quedan pegadas a Córdoba). */
const CIUDADES_ROTULADAS = prov.ciudades.filter((c) => c.nombre !== 'Villa Carlos Paz' && c.nombre !== 'Alta Gracia');
const RUTAS_ROTULADAS = prov.rutas.map((r) => ({ ref: r.ref, lx: r.lx, ly: r.ly, puntos: puntosDeTraza(r.d) }));
const MARGEN = 14;
const CAJA_BASE: Record<Plano, Caja> = {
  provincia: {
    x: prov.caja[0]! - MARGEN,
    y: prov.caja[1]! - MARGEN,
    w: prov.caja[2]! - prov.caja[0]! + 2 * MARGEN,
    h: prov.caja[3]! - prov.caja[1]! + 2 * MARGEN,
  },
  ciudad: { x: 0, y: 0, w: 1000, h: 664 },
};
const ACERCAMIENTO_MAX: Record<Plano, number> = { provincia: 14, ciudad: 8 };
const FACTOR_ZOOM = 1.6;
/** Paso del teclado al mover un marcador, en metros. */
const PASO_TECLADO: Record<Plano, number> = { provincia: 1000, ciudad: 20 };

/** Mantiene la caja dentro del plano; si es más grande que el plano en un eje, la centra. */
function limitar(c: Caja, base: Caja): Caja {
  const eje = (v: number, largo: number, b0: number, bl: number) =>
    largo <= bl ? Math.min(Math.max(v, b0), b0 + bl - largo) : b0 - (largo - bl) / 2;
  return { w: c.w, h: c.h, x: eje(c.x, c.w, base.x, base.w), y: eje(c.y, c.h, base.y, base.h) };
}

/** Caja que muestra el radio pedido en el lado corto del contenedor. */
function cajaDeEncuadre(vista: Plano, e: Encuadre, aspecto: number): Caja {
  const base = CAJA_BASE[vista];
  const { x, y } = aPlano(vista, e.centro);
  const lado = Math.max(base.w / ACERCAMIENTO_MAX[vista], 2 * e.radioKm * pxPorKm(vista, e.centro.lat));
  const w = aspecto >= 1 ? lado * aspecto : lado;
  const h = aspecto >= 1 ? lado : lado / aspecto;
  return limitar({ x: x - w / 2, y: y - h / 2, w, h }, base);
}

/** Tinta del rótulo de cada tono: la variante oscura del color, legible sobre el papel. */
const COLOR_ROTULO: Record<TonoMarcador, string> = {
  riesgo: 'var(--rojo-tinta)',
  alerta: 'var(--rojo-tinta)',
  revision: 'var(--ambar-tinta)',
  confirmado: 'var(--verde-tinta)',
  carbon: 'var(--carbon)',
  tenue: 'var(--tenue)',
};
const COLOR: Record<TonoMarcador, string> = {
  riesgo: 'var(--rojo)',
  alerta: 'var(--rojo)',
  revision: 'var(--ambar)',
  confirmado: 'var(--verde)',
  carbon: 'var(--carbon)',
  tenue: 'var(--tenue)',
};

export function Mapa({
  vista,
  etiqueta,
  marcadores = [],
  seleccionado,
  onSeleccionar,
  onArrastrar,
  onClicMapa,
  encuadre,
  rutaDestacada,
  controles = true,
  rotulos = true,
  leyenda,
  className,
}: MapaProps) {
  const base = CAJA_BASE[vista];
  const svgRef = useRef<SVGSVGElement>(null);
  const contRef = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = contRef.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      setTam((t) => (t.w === r.width && t.h === r.height ? t : { w: r.width, h: r.height }));
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const aspecto = tam.w > 0 && tam.h > 0 ? tam.w / tam.h : base.w / base.h;
  const [caja, setCaja] = useState<Caja>(() => (encuadre ? cajaDeEncuadre(vista, encuadre, aspecto) : base));
  const [arrastre, setArrastre] = useState<{ id: string; x: number; y: number } | null>(null);
  const gesto = useRef<{ tipo: 'fondo' | 'marcador'; id?: string; arrastrable?: boolean; x0: number; y0: number; caja: Caja; movio: boolean } | null>(null);

  const claveEncuadre = encuadre ? `${encuadre.centro.lat.toFixed(5)},${encuadre.centro.lon.toFixed(5)},${encuadre.radioKm}` : '';
  useEffect(() => {
    setCaja(encuadre ? cajaDeEncuadre(vista, encuadre, aspecto) : CAJA_BASE[vista]);
    // El encuadre se recalcula sólo cuando cambia el lugar pedido, la vista o la forma del contenedor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveEncuadre, vista, Math.round(aspecto * 20)]);

  /** Unidades del plano por píxel de pantalla: los marcadores y rótulos se dibujan en píxeles. */
  const k = tam.w > 0 && tam.h > 0 ? Math.max(caja.w / tam.w, caja.h / tam.h) : caja.w / 420;

  const aSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }, []);

  const zoom = (factor: number) => {
    setCaja((c) => {
      const w = Math.min(Math.max(base.w, c.w), Math.max(base.w / ACERCAMIENTO_MAX[vista], c.w / factor));
      const h = (w * c.h) / c.w;
      return limitar({ x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2, w, h }, base);
    });
  };

  const alApretarFondo = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    gesto.current = { tipo: 'fondo', x0: e.clientX, y0: e.clientY, caja, movio: false };
  };

  const alMover = (e: PointerEvent<SVGSVGElement>) => {
    const g = gesto.current;
    if (!g) return;
    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (!g.movio && Math.hypot(dx, dy) < 4) return;
    if (!g.movio) {
      g.movio = true;
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    }
    if (g.tipo === 'marcador') {
      if (!g.arrastrable || !g.id) return;
      const p = aSvg(e.clientX, e.clientY);
      if (p) setArrastre({ id: g.id, ...p });
    } else if (g.tipo === 'fondo' && g.caja.w < base.w) {
      const rect = svgRef.current!.getBoundingClientRect();
      const escala = Math.max(g.caja.w / rect.width, g.caja.h / rect.height);
      setCaja(limitar({ ...g.caja, x: g.caja.x - dx * escala, y: g.caja.y - dy * escala }, base));
    }
  };

  const alSoltar = (e: PointerEvent<SVGSVGElement>) => {
    const g = gesto.current;
    gesto.current = null;
    if (!g) return;
    if (g.tipo === 'marcador' && g.id) {
      if (g.movio && g.arrastrable && arrastre) {
        onArrastrar?.(g.id, dePlano(vista, arrastre.x, arrastre.y));
      } else if (!g.movio) {
        onSeleccionar?.(g.id);
      }
      setArrastre(null);
      return;
    }
    if (!g.movio && onClicMapa) {
      const p = aSvg(e.clientX, e.clientY);
      if (p) onClicMapa(dePlano(vista, p.x, p.y));
    }
  };

  const alApretarMarcador = (e: PointerEvent<SVGGElement>, m: Marcador) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    // Un marcador fijo se selecciona al soltar sin mover; uno arrastrable, además, se mueve.
    gesto.current = { tipo: 'marcador', id: m.id, arrastrable: !!(m.arrastrable && onArrastrar), x0: e.clientX, y0: e.clientY, caja, movio: false };
  };

  const alTeclearMarcador = (e: KeyboardEvent<SVGGElement>, m: Marcador) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSeleccionar?.(m.id);
      return;
    }
    if (!m.arrastrable || !onArrastrar) return;
    const d = { ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key];
    if (!d) return;
    e.preventDefault();
    const metros = PASO_TECLADO[vista] * (e.shiftKey ? 5 : 1);
    const dLat = (d[1]! * metros) / 111_320;
    const dLon = (d[0]! * metros) / (111_320 * Math.cos((m.lat * Math.PI) / 180));
    onArrastrar(m.id, { lat: m.lat + dLat, lon: m.lon + dLon });
  };

  const vistos = useMemo(
    () =>
      marcadores.map((m) => {
        const p = arrastre?.id === m.id ? { x: arrastre.x, y: arrastre.y } : aPlano(vista, m);
        let angulo = 0;
        let largo = 0;
        if (m.forma === 'tramo' && m.ruta && m.kmDesde !== undefined && m.kmHasta !== undefined) {
          const t = trazaTramo(m.ruta, m.kmDesde, m.kmHasta);
          if (t.length >= 2) {
            const a = aPlano(vista, t[0]!);
            const b = aPlano(vista, t[t.length - 1]!);
            angulo = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
            largo = Math.hypot(b.x - a.x, b.y - a.y);
          }
        }
        return { m, x: p.x, y: p.y, angulo, largo };
      }),
    [marcadores, arrastre, vista],
  );

  /** Un marcador es control sólo si se puede seleccionar o, siendo arrastrable, mover. */
  const esInteractivo = (m: Marcador) => !!onSeleccionar || !!(m.arrastrable && onArrastrar);
  const acercado = caja.w < base.w - 0.5 || caja.h < base.h - 0.5;

  // Lo que se ve del mapa (el viewBox más el sobrante de preserveAspectRatio).
  const visible = useMemo<Caja>(() => {
    if (tam.w <= 0 || tam.h <= 0) return caja;
    const w = tam.w * k;
    const h = tam.h * k;
    return { x: caja.x + (caja.w - w) / 2, y: caja.y + (caja.h - h) / 2, w, h };
  }, [caja, tam.w, tam.h, k]);

  const rotulosProvincia = useMemo(() => {
    if (vista !== 'provincia' || !rotulos) return null;
    const obstaculos: CajaRotulo[] = vistos.flatMap(({ m, x, y, angulo, largo }) => cajasDeMarcador(m, x, y, k, angulo, largo));
    return ubicarRotulos(CIUDADES_ROTULADAS, RUTAS_ROTULADAS, obstaculos, k, visible);
  }, [vista, rotulos, vistos, k, visible]);

  return (
    <div ref={contRef} className={[css.mapa, className].filter(Boolean).join(' ')}>
      <svg
        ref={svgRef}
        className={[css.svg, acercado && css.desplazable, onClicMapa && css.marcable].filter(Boolean).join(' ')}
        viewBox={`${caja.x} ${caja.y} ${caja.w} ${caja.h}`}
        preserveAspectRatio="xMidYMid meet"
        role="group"
        aria-label={etiqueta}
        onPointerDown={alApretarFondo}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={() => {
          gesto.current = null;
          setArrastre(null);
        }}
      >
        {vista === 'provincia' ? (
          <CapasProvincia k={k} rutaDestacada={rutaDestacada} />
        ) : (
          <CapasCiudad />
        )}
        <g>
          {vistos.map(({ m, x, y, angulo, largo }) => (
            <MarcadorSvg
              key={m.id}
              m={m}
              x={x}
              y={y}
              k={k}
              angulo={angulo}
              largo={largo}
              seleccionado={seleccionado === m.id}
              arrastrando={arrastre?.id === m.id}
              interactivo={esInteractivo(m)}
              onPointerDown={(e) => alApretarMarcador(e, m)}
              onKeyDown={(e) => alTeclearMarcador(e, m)}
            />
          ))}
        </g>
        {rotulosProvincia && <RotulosProvincia k={k} rotulos={rotulosProvincia} />}
      </svg>
      {controles && (
        <div className={css.controles}>
          <button type="button" className={css.control} onClick={() => zoom(FACTOR_ZOOM)} aria-label="Acercar" disabled={caja.w <= base.w / ACERCAMIENTO_MAX[vista] + 0.5}>
            <Icono nombre="mas" tamano={16} />
          </button>
          <button type="button" className={css.control} onClick={() => zoom(1 / FACTOR_ZOOM)} aria-label="Alejar" disabled={!acercado}>
            <Icono nombre="menos" tamano={16} />
          </button>
          <button type="button" className={css.control} onClick={() => setCaja(base)} aria-label="Ver todo el mapa" disabled={!acercado}>
            <Icono nombre="encuadre" tamano={16} />
          </button>
        </div>
      )}
      {leyenda && <div className={css.leyenda}>{leyenda}</div>}
    </div>
  );
}

function CapasProvincia({ k, rutaDestacada }: { k: number; rutaDestacada?: string }) {
  return (
    <g aria-hidden="true">
      {prov.vecinas.map((v) => (
        <path key={v.nombre} d={v.d} className={css.vecina} />
      ))}
      <path d={prov.d} className={css.provincia} />
      {prov.rutas.map((r) => (
        <path key={r.ref} d={r.d} className={r.ref === rutaDestacada ? css.rutaDestacada : css.ruta} />
      ))}
      {CIUDADES_ROTULADAS.map((c) => (
        <circle key={c.nombre} cx={c.x} cy={c.y} r={2.2 * k} className={css.ciudad} />
      ))}
    </g>
  );
}

/** Nombres de ciudades y rutas, por encima de los marcadores y sin capturar el puntero. */
function RotulosProvincia({ k, rotulos }: { k: number; rotulos: ReturnType<typeof ubicarRotulos> }) {
  return (
    <g aria-hidden="true" className={css.capaRotulos} strokeWidth={3 * k}>
      {rotulos.ciudades.map((r) => (
        <text key={r.texto} x={r.x} y={r.y} textAnchor={r.ancla} fontSize={10 * k} className={css.rotuloCiudad}>
          {r.texto}
        </text>
      ))}
      {rotulos.rutas.map((r) => (
        <text key={r.texto} x={r.x} y={r.y} textAnchor={r.ancla} fontSize={9.5 * k} className={css.rotuloRuta}>
          {r.texto}
        </text>
      ))}
    </g>
  );
}

/** Cajas que ocupa un marcador en el plano (figura y rótulo), para que los nombres no lo tapen. */
function cajasDeMarcador(m: Marcador, x: number, y: number, k: number, angulo: number, largo: number): CajaRotulo[] {
  const t = m.tamano ?? 0.5;
  const cajas: CajaRotulo[] = [];
  let derecha: number;
  if (m.forma === 'tramo') {
    const l = Math.max(largo, (10 + 14 * t) * k);
    const a = (angulo * Math.PI) / 180;
    const dx = (Math.abs(Math.cos(a)) * l) / 2 + 3 * k;
    const dy = (Math.abs(Math.sin(a)) * l) / 2 + 3 * k;
    cajas.push({ x: x - dx, y: y - dy, w: 2 * dx, h: 2 * dy });
    derecha = l / 2;
  } else {
    const r = m.forma === 'punto' ? (3 + 4.5 * t) * k : 13 * k;
    cajas.push({ x: x - r, y: y - r, w: 2 * r, h: 2 * r });
    derecha = m.forma === 'pin' ? 15 * k : 8 * k;
  }
  if (m.rotulo) {
    const f = 11 * k;
    cajas.push({ x: x + derecha + 3 * k, y: y - 4 * k - f * 0.8, w: anchoTexto(m.rotulo, f, true), h: f });
  }
  return cajas;
}

function CapasCiudad() {
  const capas = cartografia.ciudad.capas;
  return (
    <g aria-hidden="true">
      <rect x={0} y={0} width={CAJA_BASE.ciudad.w} height={CAJA_BASE.ciudad.h} className={css.fondoCiudad} />
      <path d={capas.c} className={css.calleC} />
      <path d={capas.b} className={css.calleB} />
      <path d={capas.a} className={css.calleA} />
    </g>
  );
}

interface MarcadorSvgProps {
  m: Marcador;
  x: number;
  y: number;
  k: number;
  angulo: number;
  largo: number;
  seleccionado: boolean;
  arrastrando: boolean;
  interactivo: boolean;
  onPointerDown: (e: PointerEvent<SVGGElement>) => void;
  onKeyDown: (e: KeyboardEvent<SVGGElement>) => void;
}

function MarcadorSvg({ m, x, y, k, angulo, largo, seleccionado, arrastrando, interactivo, onPointerDown, onKeyDown }: MarcadorSvgProps) {
  const color = COLOR[m.tono];
  const t = m.tamano ?? 0.5;
  const tenue = m.tono === 'riesgo' && !seleccionado;
  let figura: ReactNode;
  let anillo = 10 * k;

  const l = Math.max(largo, (10 + 14 * t) * k);
  if (m.forma === 'tramo') {
    const g = 6 * k;
    anillo = l / 2 + 5 * k;
    figura = (
      <rect
        x={-l / 2}
        y={-g / 2}
        width={l}
        height={g}
        rx={1 * k}
        transform={`rotate(${angulo})`}
        fill={color}
        fillOpacity={tenue ? 0.78 : 1}
        stroke={seleccionado ? 'var(--tinta)' : 'none'}
        strokeWidth={1.5 * k}
      />
    );
  } else if (m.forma === 'punto') {
    const r = (3 + 4.5 * t) * k;
    anillo = r + 5 * k;
    figura = (
      <circle
        r={r}
        fill={color}
        fillOpacity={tenue ? 0.78 : 1}
        stroke={seleccionado ? 'var(--tinta)' : 'var(--papel)'}
        strokeWidth={(seleccionado ? 1.6 : 1) * k}
      />
    );
  } else {
    anillo = 15 * k;
    figura = (
      <>
        <circle r={13 * k} fill={color} fillOpacity={arrastrando ? 0.28 : 0.18} />
        <circle r={6.5 * k} fill={color} stroke="var(--papel)" strokeWidth={2.2 * k} />
      </>
    );
  }

  return (
    <g
      transform={`translate(${x} ${y})`}
      className={[css.marcador, interactivo && css.interactivo, m.arrastrable && css.arrastrable, arrastrando && css.arrastrando].filter(Boolean).join(' ')}
      role={interactivo ? 'button' : 'img'}
      tabIndex={interactivo ? 0 : undefined}
      aria-label={m.arrastrable ? `${m.titulo}. Arrastrable: usá las flechas para moverlo` : m.titulo}
      aria-pressed={interactivo && !m.arrastrable ? seleccionado : undefined}
      onPointerDown={interactivo ? onPointerDown : undefined}
      onKeyDown={interactivo ? onKeyDown : undefined}
      data-marcador={m.id}
    >
      <circle r={anillo} className={css.anillo} strokeWidth={2 * k} />
      {figura}
      {m.rotulo && (
        <text
          x={(m.forma === 'tramo' ? l / 2 : m.forma === 'pin' ? 15 * k : 8 * k) + 3 * k}
          y={-4 * k}
          fontSize={11 * k}
          className={css.rotuloMarcador}
          fill={COLOR_ROTULO[m.tono]}
        >
          {m.rotulo}
        </text>
      )}
    </g>
  );
}
