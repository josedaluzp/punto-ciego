/**
 * Semilla determinista de la demo: provincia de Córdoba, 2021–2026.
 * DATOS SINTÉTICOS DE DEMOSTRACIÓN, salvo el caso documentado de Agustín
 * Piaggio al 1000 (Entrega 2), que conserva su evidencia real.
 *
 * Nada está fijado a mano en las concentraciones: la semilla redacta cada
 * crónica a partir de una especificación del hecho y la hace pasar por el
 * mismo camino que una crónica real (extraerDeCronica → georreferenciar).
 * Las 38 concentraciones significativas, su orden y su índice salen de
 * agruparConcentraciones + indiceRiesgo sobre los siniestros confirmados de
 * 2021 a 2025, y los tres reclamos con alerta salen de reproducir en orden
 * cronológico las presentaciones, los cierres y los siniestros de 2026 con
 * evaluarReclamosDesatendidos. Las pruebas de `semilla.test.ts` verifican que
 * el resultado reproduce las Figuras 15 a 21 del documento.
 *
 * Lo único que la semilla fija es el NÚMERO de cada concentración (C-0007,
 * C-0012…), que en el sistema real asigna la base de datos: se registra en
 * `registroConcentraciones` para que el número no cambie entre recálculos.
 */
import { agruparConcentraciones, nombreConcentracion, type RegistroConcentraciones } from '../dominio/concentraciones';
import { recomendarContramedidas } from '../dominio/contramedidas';
import { extraerDeCronica } from '../dominio/extraccion';
import { anio, diaSemana, diasEntre, sumarDias } from '../dominio/fechas';
import { distanciaMetros, type LatLon } from '../dominio/geo';
import { georreferenciar } from '../dominio/georreferenciacion';
import { CALLES_NOMENCLADOR, buscarCalle, posicionPorAltura, servicioNormalizacionSimulado } from '../dominio/normalizacion';
import { coberturaPostes, posicionPorProgresiva } from '../dominio/postes';
import { aProvincia } from '../dominio/proyeccion';
import { agendarInspeccion, cerrarReclamo, evaluarReclamosDesatendidos } from '../dominio/reclamos';
import type { Cronica, Ficha, Reclamo, Siniestro, TipoSiniestro } from '../dominio/tipos';
import { CATALOGO_CONTRAMEDIDAS } from './contramedidas';

/** "Hoy" de la demo: fija los días sin respuesta que muestran las Figuras 20 y 21. */
export const FECHA_DEMO = '2026-09-09';
/** Período por defecto de la priorización (Figura 17). */
export const PERIODO_PREDETERMINADO = { desde: 2021, hasta: 2025 } as const;
export const ANIOS_DISPONIBLES = [2021, 2022, 2023, 2024, 2025, 2026] as const;

export interface DatosDemo {
  cronicas: Cronica[];
  siniestros: Siniestro[];
  reclamos: Reclamo[];
  fichas: Ficha[];
  registroConcentraciones: RegistroConcentraciones;
}

// ── Generador pseudoaleatorio determinista (mulberry32) ─────────────────────

type Aleatorio = ReturnType<typeof generador>;

function generador(semilla: number) {
  let a = semilla >>> 0;
  const siguiente = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    siguiente,
    entero: (min: number, max: number) => min + Math.floor(siguiente() * (max - min + 1)),
    elegir: <T>(xs: readonly T[]): T => xs[Math.floor(siguiente() * xs.length)]!,
  };
}

// ── Especificación de los hechos ────────────────────────────────────────────

/**
 * Víctimas en código: M motociclista, P peatón, C ciclista, A conductor,
 * O acompañante. Mayúscula = víctima fatal; minúscula = herido de gravedad.
 */
type Codigo = 'M' | 'P' | 'C' | 'A' | 'O' | 'm' | 'p' | 'c' | 'a' | 'o';

type LugarHecho = { calle: string; altura: number } | { ruta: string; km: number };

interface Hecho {
  fecha: string;
  lugar: LugarHecho;
  tipo: TipoSiniestro;
  victimas: Codigo[];
  grupo?: string;
  /** Texto propio en lugar del redactado (casos en revisión). */
  texto?: string;
  medio?: number;
  publicadoDias?: number;
}

type HechoGrupo = [fecha: string | null, tipo: TipoSiniestro, victimas: Codigo[], ajuste?: number];

interface Grupo {
  id: string;
  lugar: LugarHecho;
  hechos: HechoGrupo[];
}

const S: TipoSiniestro = 'salida de calzada';
const F: TipoSiniestro = 'choque frontal';
const AT: TipoSiniestro = 'atropello de peatón';
const G: TipoSiniestro = 'choque en giro';
const CA: TipoSiniestro = 'caída de motociclista';
const AL: TipoSiniestro = 'choque por alcance';
const L: TipoSiniestro = 'choque lateral';

/**
 * Las 38 concentraciones de 2021–2025. Las seis primeras reproducen la tabla
 * de la Figura 17 y la ficha FI-2026-0042 de la Figura 18. En los grupos de
 * ruta, `ajuste` es la décima de kilómetro; en los de calle, el corrimiento
 * de altura.
 */
const GRUPOS: Grupo[] = [
  {
    id: 'C-0007',
    lugar: { ruta: 'RN 9', km: 694 },
    hechos: [
      ['2022-03-14', S, ['M'], 0.3],
      ['2023-11-04', S, ['M', 'M'], 0.8],
      ['2024-06-21', F, ['A', 'a'], 0.6],
      ['2025-01-18', S, ['M'], 0.1],
    ],
  },
  {
    id: 'C-0012',
    lugar: { calle: 'Av. Vélez Sarsfield', altura: 1200 },
    hechos: [
      [null, AT, ['P'], -20],
      [null, AT, ['P'], 10],
      [null, AT, ['P', 'p'], 30],
      [null, AT, ['P', 'p'], -10],
    ],
  },
  {
    id: 'C-0003',
    lugar: { ruta: 'RN 19', km: 312 },
    hechos: [
      [null, F, ['A', 'O'], 0.4],
      [null, F, ['M'], 0.7],
      [null, S, ['M'], 0.2],
      [null, F, ['a'], 0.5],
      [null, AL, [], 0.9],
    ],
  },
  {
    id: 'C-0019',
    lugar: { calle: 'Av. Amadeo Sabattini', altura: 4700 },
    hechos: [
      [null, G, ['M'], 0],
      [null, G, ['M'], 20],
      [null, G, ['C'], -20],
      [null, G, [], 30],
    ],
  },
  {
    id: 'C-0021',
    lugar: { ruta: 'RN 158', km: 170 },
    hechos: [
      [null, F, ['A', 'O'], 0.3],
      [null, F, ['M'], 0.6],
      [null, F, ['a'], 0.2],
      [null, S, ['a'], 0.8],
    ],
  },
  {
    id: 'C-0025',
    lugar: { calle: 'Av. Colón', altura: 5300 },
    hechos: [
      ['2023-05-12', CA, ['M'], -10],
      ['2024-09-30', CA, ['M'], 20],
      ['2025-07-08', CA, ['m'], 0],
    ],
  },
  // Puntos urbanos
  { id: 'C-0001', lugar: { calle: 'Av. Colón', altura: 2000 }, hechos: [[null, AT, ['P'], 0], [null, AT, ['P'], 30]] },
  { id: 'C-0002', lugar: { calle: 'Av. Juan B. Justo', altura: 4000 }, hechos: [[null, CA, ['M'], 0], [null, CA, ['m'], 20]] },
  { id: 'C-0004', lugar: { calle: 'Av. Fuerza Aérea', altura: 4000 }, hechos: [[null, G, ['M'], 0], [null, G, ['A'], -20]] },
  { id: 'C-0005', lugar: { calle: 'Av. Rafael Núñez', altura: 4000 }, hechos: [[null, AT, ['P'], 0], [null, AT, ['p'], 20]] },
  { id: 'C-0006', lugar: { calle: 'Av. Armada Argentina', altura: 2000 }, hechos: [[null, CA, ['M'], 10], [null, CA, ['M'], -10]] },
  { id: 'C-0008', lugar: { calle: "Av. O'Higgins", altura: 5000 }, hechos: [[null, L, ['A'], 0], [null, L, ['M'], 20]] },
  { id: 'C-0009', lugar: { calle: 'Av. Valparaíso', altura: 4500 }, hechos: [[null, AT, ['P'], 0], [null, AT, ['p'], -20]] },
  { id: 'C-0010', lugar: { calle: 'Av. Don Bosco', altura: 6000 }, hechos: [[null, S, ['A'], 0], [null, S, ['a'], 30]] },
  { id: 'C-0011', lugar: { calle: 'Av. Sagrada Familia', altura: 1500 }, hechos: [[null, L, ['C'], 0], [null, L, ['c'], 20]] },
  { id: 'C-0013', lugar: { calle: 'Bv. Los Granaderos', altura: 3500 }, hechos: [[null, G, ['M'], 0], [null, G, ['m'], 20], [null, G, [], -20]] },
  { id: 'C-0014', lugar: { calle: 'Av. Patria', altura: 1500 }, hechos: [[null, AL, ['M'], 0], [null, AL, ['m'], 20]] },
  { id: 'C-0015', lugar: { calle: 'Av. La Voz del Interior', altura: 7000 }, hechos: [[null, AL, ['A'], 0], [null, AL, ['A'], -30]] },
  { id: 'C-0016', lugar: { calle: 'Av. Castro Barros', altura: 1000 }, hechos: [[null, AT, ['P'], 0], [null, AT, ['p'], 20], [null, AT, [], -10]] },
  { id: 'C-0017', lugar: { calle: 'Av. Recta Martinoli', altura: 7000 }, hechos: [[null, F, ['A', 'O'], 0], [null, F, ['A'], 30]] },
  { id: 'C-0018', lugar: { calle: 'Bv. Presidente Arturo Illia', altura: 600 }, hechos: [[null, AT, ['P'], 0], [null, AT, ['P'], 20]] },
  { id: 'C-0020', lugar: { calle: 'Av. Malvinas Argentinas', altura: 3000 }, hechos: [[null, CA, ['M'], 0], [null, CA, ['m'], -20]] },
  // Tramos de ruta
  { id: 'C-0022', lugar: { ruta: 'RN 9', km: 530 }, hechos: [[null, F, ['A', 'O'], 0.2], [null, F, ['M'], 0.7]] },
  { id: 'C-0023', lugar: { ruta: 'RN 9', km: 612 }, hechos: [[null, S, ['M'], 0.4], [null, S, ['A'], 0.6]] },
  { id: 'C-0024', lugar: { ruta: 'RN 9', km: 718 }, hechos: [[null, S, ['M'], 0.1], [null, S, ['M'], 0.5]] },
  { id: 'C-0026', lugar: { ruta: 'RN 19', km: 140 }, hechos: [[null, F, ['A'], 0.3], [null, F, ['A', 'O'], 0.6]] },
  { id: 'C-0027', lugar: { ruta: 'RN 19', km: 255 }, hechos: [[null, AL, ['A'], 0.2], [null, AL, ['a'], 0.8]] },
  { id: 'C-0028', lugar: { ruta: 'RN 158', km: 40 }, hechos: [[null, S, ['M'], 0.5], [null, S, ['a'], 0.3]] },
  { id: 'C-0029', lugar: { ruta: 'RN 158', km: 260 }, hechos: [[null, F, ['A'], 0.1], [null, F, ['O'], 0.4], [null, F, [], 0.9]] },
  { id: 'C-0030', lugar: { ruta: 'RN 36', km: 640 }, hechos: [[null, S, ['M'], 0.3], [null, S, ['A'], 0.5], [null, S, ['m'], 0.7]] },
  { id: 'C-0031', lugar: { ruta: 'RN 36', km: 700 }, hechos: [[null, F, ['A'], 0.4], [null, F, ['A'], 0.6]] },
  { id: 'C-0032', lugar: { ruta: 'RN 38', km: 35 }, hechos: [[null, S, ['M'], 0.2], [null, S, ['a'], 0.6]] },
  { id: 'C-0033', lugar: { ruta: 'RN 38', km: 100 }, hechos: [[null, F, ['A', 'O'], 0.5], [null, F, [], 0.1]] },
  { id: 'C-0034', lugar: { ruta: 'RN 8', km: 620 }, hechos: [[null, G, ['A'], 0.3], [null, G, ['M'], 0.4]] },
  { id: 'C-0035', lugar: { ruta: 'RN 35', km: 640 }, hechos: [[null, S, ['A'], 0.5], [null, S, ['a'], 0.2]] },
  { id: 'C-0036', lugar: { ruta: 'RN 9', km: 470 }, hechos: [[null, AL, ['M'], 0.6], [null, AL, ['A'], 0.3]] },
  { id: 'C-0037', lugar: { ruta: 'RN 19', km: 300 }, hechos: [[null, S, ['M'], 0.4], [null, S, ['m'], 0.6]] },
  { id: 'C-0038', lugar: { ruta: 'RN 158', km: 110 }, hechos: [[null, F, ['M'], 0.7], [null, F, ['A'], 0.2]] },
];

/** Reclamos de las Figuras 19 a 21, con su lugar. */
const RECLAMOS_FIJOS = {
  'PN-2026-0131': { calle: 'Av. Rafael Núñez', altura: 2200 },
  'PN-2026-0157': { calle: 'Av. Monseñor Pablo Cabrera', altura: 1900 },
  'PN-2026-0186': { calle: 'Av. Colón', altura: 5300 },
} as const;

/** Siniestros de 2026 que dan las alertas de la bandeja (Figura 20). */
const HECHOS_2026: Hecho[] = [
  { fecha: '2026-06-03', lugar: { calle: 'Av. Rafael Núñez', altura: 2190 }, tipo: CA, victimas: ['M'] },
  { fecha: '2026-08-18', lugar: { calle: 'Av. Rafael Núñez', altura: 2210 }, tipo: AL, victimas: ['m'] },
  { fecha: '2026-08-02', lugar: { calle: 'Av. Colón', altura: 5310 }, tipo: CA, victimas: ['m'], medio: 0 },
  { fecha: '2026-08-25', lugar: { ruta: 'RN 36', km: 612.2 }, tipo: F, victimas: ['A'] },
];

/** Los tres siniestros de la Figura 16, que quedan en revisión. */
const HECHOS_EN_REVISION: Hecho[] = [
  {
    fecha: '2026-09-02',
    lugar: { calle: 'Av. Circunvalación', altura: 0 },
    tipo: AT,
    victimas: ['P'],
    medio: 0,
    publicadoDias: 1,
    texto:
      'Un peatón murió atropellado anoche en avenida Circunvalación a la altura de barrio Los Boulevares, cuando intentaba cruzar la calzada. Intervino personal policial y de la fiscalía de turno.',
  },
  {
    fecha: '2026-08-29',
    lugar: { calle: 'Agustín Piaggio', altura: 0 },
    tipo: L,
    victimas: ['C'],
    medio: 1,
    publicadoDias: 1,
    texto:
      'Un ciclista de 16 años murió anoche en barrio Villa El Libertador tras chocar con un automóvil. La causa quedó a cargo de la fiscalía de turno.',
  },
  {
    fecha: '2026-09-05',
    lugar: { ruta: 'RN 36', km: 790 },
    tipo: F,
    victimas: ['A'],
    medio: 3,
    publicadoDias: 0,
    texto:
      'Un conductor de 52 años murió esta madrugada en un choque frontal sobre la ruta nacional 36, en el kilómetro 790. Personal de tránsito trabajó en el lugar durante varias horas.',
  },
];

// ── Redacción de las crónicas ───────────────────────────────────────────────

export const MEDIOS = [
  { nombre: 'Medio local de ejemplo', dominio: 'medio-local.example' },
  { nombre: 'Diario de ejemplo', dominio: 'diario.example' },
  { nombre: 'Radio de ejemplo', dominio: 'radio.example' },
  { nombre: 'Portal regional de ejemplo', dominio: 'portal-regional.example' },
] as const;

const USUARIO_TEXTO: Record<string, [string, string, string]> = {
  M: ['motociclista', 'motociclistas', 'un'],
  P: ['peatón', 'peatones', 'un'],
  C: ['ciclista', 'ciclistas', 'un'],
  A: ['conductor', 'conductores', 'un'],
  O: ['acompañante', 'acompañantes', 'un'],
};
const NUMERO_TEXTO = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco'];

const FRASE_TIPO: Record<TipoSiniestro, string> = {
  'salida de calzada': 'tras despistarse',
  'choque frontal': 'en un choque frontal',
  'atropello de peatón': 'al ser atropellado por un automóvil',
  'choque en giro': 'cuando un automóvil giró a la izquierda',
  'caída de motociclista': 'tras una caída',
  'choque por alcance': 'al ser embestido desde atrás',
  'choque lateral': 'tras chocar con un automóvil',
};
const SUSTANTIVO_TIPO: Record<TipoSiniestro, string> = {
  'salida de calzada': 'Un despiste',
  'choque frontal': 'Un choque frontal',
  'atropello de peatón': 'Un atropello',
  'choque en giro': 'Un choque entre una moto y un auto que giró',
  'caída de motociclista': 'Una caída de moto',
  'choque por alcance': 'Un choque desde atrás',
  'choque lateral': 'Un choque entre dos autos',
};
const CIERRES = [
  'Intervino personal policial y de la fiscalía de turno.',
  'La causa quedó a cargo de la fiscalía de turno.',
  'Personal de tránsito trabajó en el lugar durante varias horas.',
  'Testigos aportaron datos a los investigadores.',
];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function lugarTexto(l: LugarHecho): string {
  if ('ruta' in l) {
    const km = Number.isInteger(l.km) ? String(l.km) : l.km.toFixed(1).replace('.', ',');
    return `sobre la ruta nacional ${l.ruta.replace('RN ', '')}, a la altura del kilómetro ${km}`;
  }
  const c = l.calle;
  if (c.startsWith('Av. ')) return `en avenida ${c.slice(4)} al ${l.altura}`;
  if (c.startsWith('Bv. ')) return `en bulevar ${c.slice(4)} al ${l.altura}`;
  return `en calle ${c} al ${l.altura}`;
}

function fechaTexto(hecho: string, publicacion: string, r: Aleatorio): string {
  const d = diasEntre(hecho, publicacion);
  if (d === 0) return r.elegir(['esta madrugada', 'esta mañana', 'esta tarde']);
  if (d === 1) return r.elegir(['anoche', 'ayer por la tarde', 'ayer por la mañana']);
  const dia = DIAS[diaSemana(hecho)]!;
  return r.elegir([`el ${dia}`, `en la madrugada del ${dia}`]);
}

function grupos(codigos: Codigo[]): { codigo: string; n: number }[] {
  const out: { codigo: string; n: number }[] = [];
  for (const c of codigos) {
    const g = out.find((x) => x.codigo === c);
    if (g) g.n++;
    else out.push({ codigo: c, n: 1 });
  }
  return out;
}

/** Redacta una crónica que la extracción (RF02) vuelve a leer igual. */
function redactar(h: Hecho, publicacion: string, r: Aleatorio): string {
  const fecha = fechaTexto(h.fecha, publicacion, r);
  const frase = FRASE_TIPO[h.tipo];
  const lugar = lugarTexto(h.lugar);
  const fatales = grupos(h.victimas.filter((c) => c === c.toUpperCase()));
  const graves = grupos(h.victimas.filter((c) => c !== c.toUpperCase()).map((c) => c.toUpperCase() as Codigo));
  const oraciones: string[] = [];

  if (fatales.length === 1 && fatales[0]!.n === 1) {
    const [s] = USUARIO_TEXTO[fatales[0]!.codigo]!;
    oraciones.push(`Un ${s} de ${r.entero(18, 72)} años murió ${fecha} ${frase} ${lugar}.`);
  } else if (fatales.length === 1) {
    const g = fatales[0]!;
    const [, p] = USUARIO_TEXTO[g.codigo]!;
    oraciones.push(`${capitalizar(NUMERO_TEXTO[g.n]!)} ${p} murieron ${fecha} ${frase} ${lugar}.`);
  } else if (fatales.length > 1) {
    const hayConductor = fatales.some((g) => g.codigo === 'A');
    const items = fatales.map((g) => {
      const [s, p] = USUARIO_TEXTO[g.codigo]!;
      if (g.n > 1) return `${NUMERO_TEXTO[g.n]} ${p}`;
      if (g.codigo === 'A') return 'el conductor';
      if (g.codigo === 'O' && hayConductor) return 'su acompañante';
      return `un ${s}`;
    });
    const lista = items.length > 1 ? `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}` : items[0]!;
    oraciones.push(`Murieron ${lista} ${fecha} ${frase} ${lugar}.`);
  }

  for (const g of graves) {
    const [s, p] = USUARIO_TEXTO[g.codigo]!;
    const mismaClase = fatales.some((f) => f.codigo === g.codigo);
    if (fatales.length === 0 && g === graves[0]) {
      oraciones.push(
        g.n > 1
          ? `${capitalizar(NUMERO_TEXTO[g.n]!)} ${p} resultaron heridos de gravedad ${fecha} ${frase} ${lugar}.`
          : `Un ${s} resultó herido de gravedad ${fecha} ${frase} ${lugar}.`,
      );
    } else if (g.n > 1) {
      oraciones.push(`${capitalizar(NUMERO_TEXTO[g.n]!)} ${p} resultaron heridos de gravedad.`);
    } else if (g.codigo === 'A' && mismaClase) {
      oraciones.push('El conductor del otro vehículo resultó herido de gravedad.');
    } else if (g.codigo === 'O') {
      oraciones.push('Su acompañante resultó herido de gravedad.');
    } else {
      oraciones.push(`${mismaClase ? 'Otro' : 'Un'} ${s} resultó herido de gravedad.`);
    }
  }

  if (oraciones.length === 0) {
    oraciones.push(`${SUSTANTIVO_TIPO[h.tipo]} ${fecha} ${lugar} dejó solo heridos leves.`);
  }
  oraciones.push(r.elegir(CIERRES));
  return oraciones.join(' ');
}

function slug(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Posiciones ──────────────────────────────────────────────────────────────

function posicion(l: LugarHecho): LatLon {
  if ('ruta' in l) {
    const p = posicionPorProgresiva(l.ruta, l.km);
    if (!p) throw new Error(`Semilla: ${l.ruta} km ${l.km} fuera de la capa`);
    return p;
  }
  const c = buscarCalle(l.calle);
  const p = c && posicionPorAltura(c, l.altura);
  if (!p) throw new Error(`Semilla: ${l.calle} al ${l.altura} no figura en el nomenclador`);
  return p.punto;
}

const CALLES_SEMILLA = CALLES_NOMENCLADOR.filter((c) => !c.corredor);

/** Calle al azar y una altura dentro de su numeración, redondeada a `paso`. */
function cuadraAzar(r: Aleatorio, paso: number): { calle: string; altura: number } {
  const c = r.elegir(CALLES_SEMILLA);
  const a0 = c.tramos[0]![0];
  const a1 = c.tramos[c.tramos.length - 1]![0];
  return { calle: c.nombre, altura: Math.round((a0 + r.siguiente() * (a1 - a0)) / paso) * paso };
}

const LARGO_RUTAS: [string, number][] = [
  ['RN 9', 58],
  ['RN 19', 44],
  ['RN 158', 58],
  ['RN 36', 34],
  ['RN 38', 22],
  ['RN 8', 8],
  ['RN 35', 20],
];

const TIPOS_CALLE: [TipoSiniestro, Codigo[][]][] = [
  [AT, [['P'], ['P'], ['P', 'p']]],
  [CA, [['M'], ['M'], ['m']]],
  [G, [['M'], ['C'], ['A']]],
  [L, [['A'], ['M'], ['C'], ['O']]],
  [AL, [['M'], ['A']]],
];
const TIPOS_RUTA: [TipoSiniestro, Codigo[][]][] = [
  [S, [['M'], ['A'], ['A', 'O'], ['M'], ['a']]],
  [S, [['M'], ['A']]],
  [F, [['A'], ['A', 'O'], ['M'], ['A', 'a']]],
  [F, [['A'], ['A']]],
  [AL, [['A'], ['M']]],
  [L, [['A'], ['C']]],
];

function fechaAzar(r: Aleatorio, desde: string, hasta: string): string {
  return sumarDias(desde, r.entero(0, diasEntre(desde, hasta)));
}

// ── Generación ──────────────────────────────────────────────────────────────

const SEMILLA = 0xc7748337;

export function generarSemilla(): DatosDemo {
  const r = generador(SEMILLA);
  const hechos: Hecho[] = [];
  const ocupados: LatLon[] = [];
  const kmUsados = new Map<string, Set<number>>();
  const usarKm = (ruta: string, km: number) => {
    const s = kmUsados.get(ruta) ?? new Set<number>();
    s.add(Math.floor(km));
    kmUsados.set(ruta, s);
  };

  // Concentraciones.
  for (const g of GRUPOS) {
    if ('ruta' in g.lugar) usarKm(g.lugar.ruta, g.lugar.km);
    else ocupados.push(posicion(g.lugar));
    for (const [fecha, tipo, victimas, ajuste = 0] of g.hechos) {
      const lugar: LugarHecho =
        'ruta' in g.lugar
          ? { ruta: g.lugar.ruta, km: Math.round((g.lugar.km + ajuste) * 10) / 10 }
          : { calle: g.lugar.calle, altura: g.lugar.altura + ajuste };
      hechos.push({ fecha: fecha ?? fechaAzar(r, '2021-01-05', '2025-12-20'), lugar, tipo, victimas, grupo: g.id });
    }
  }
  for (const l of Object.values(RECLAMOS_FIJOS)) ocupados.push(posicion(l));
  usarKm('RN 36', 612);
  for (const h of HECHOS_2026) hechos.push(h);

  // Siniestros sueltos sobre calle: a más de 300 m de cualquier otro punto,
  // para que ninguno forme por azar una concentración.
  const sueltosCalle = (cantidad: number, desde: string, hasta: string) => {
    let intentos = 0;
    let hechosAgregados = 0;
    while (hechosAgregados < cantidad && intentos < cantidad * 60) {
      intentos++;
      const lugar = cuadraAzar(r, 10);
      const p = posicion(lugar);
      if (ocupados.some((o) => distanciaMetros(o, p) < 300)) continue;
      ocupados.push(p);
      const [tipo, opciones] = r.elegir(TIPOS_CALLE);
      hechos.push({ fecha: fechaAzar(r, desde, hasta), lugar, tipo, victimas: r.elegir(opciones) });
      hechosAgregados++;
    }
  };
  // Siniestros sueltos sobre ruta: cada uno en un kilómetro sin otro siniestro.
  const sueltosRuta = (ruta: string, cantidad: number, desde: string, hasta: string) => {
    const cob = coberturaPostes(ruta)!;
    let n = 0;
    let intentos = 0;
    while (n < cantidad && intentos < cantidad * 50) {
      intentos++;
      const k = r.entero(cob.desde, cob.hasta - 1);
      if (kmUsados.get(ruta)?.has(k)) continue;
      usarKm(ruta, k);
      const [tipo, opciones] = r.elegir(TIPOS_RUTA);
      hechos.push({
        fecha: fechaAzar(r, desde, hasta),
        lugar: { ruta, km: Math.round((k + r.entero(1, 9) / 10) * 10) / 10 },
        tipo,
        victimas: r.elegir(opciones),
      });
      n++;
    }
  };
  sueltosCalle(105, '2021-01-03', '2025-12-28');
  for (const [ruta, n] of LARGO_RUTAS) sueltosRuta(ruta, n, '2021-01-03', '2025-12-28');
  sueltosCalle(14, '2026-01-04', '2026-08-30');
  for (const ruta of ['RN 9', 'RN 19', 'RN 158']) sueltosRuta(ruta, 3, '2026-01-04', '2026-08-30');
  for (const h of HECHOS_EN_REVISION) hechos.push(h);

  // Crónicas y siniestros, por el mismo camino que una crónica real.
  hechos.sort((a, b) => a.fecha.localeCompare(b.fecha));
  const siniestros: Siniestro[] = [];
  const cronicas: Omit<Cronica, 'id'>[] = [];
  const grupoDe = new Map<string, string>();
  hechos.forEach((h, i) => {
    const id = `S-${String(i + 1).padStart(4, '0')}`;
    const pub = sumarDias(h.fecha, h.publicadoDias ?? r.entero(0, 3));
    const texto = h.texto ?? redactar(h, pub, r);
    const e = extraerDeCronica(texto, pub);
    verificar(h, e, texto);
    const ubicacion = georreferenciar(e.lugar);
    const medioA = h.medio ?? r.entero(0, MEDIOS.length - 1);
    const medio = MEDIOS[medioA]!;
    const urlBase = `https://${medio.dominio}/policiales/${slug(e.lugar?.texto ?? 'siniestro')}-${h.fecha}`;
    cronicas.push({ medio: medio.nombre, fechaPublicacion: pub, url: urlBase, texto, siniestroId: id, origen: 'sintetico' });
    // Uno de cada ocho hechos tiene una segunda crónica de otro medio (RF03).
    if (!h.texto && r.siguiente() < 0.125) {
      const otro = MEDIOS[(medioA + 1 + r.entero(0, 2)) % MEDIOS.length]!;
      const pub2 = sumarDias(pub, r.entero(0, 1));
      const texto2 = redactar(h, pub2, r);
      cronicas.push({
        medio: otro.nombre,
        fechaPublicacion: pub2,
        url: `https://${otro.dominio}/sociedad/${slug(e.lugar?.texto ?? 'siniestro')}-${h.fecha}`,
        texto: texto2,
        siniestroId: id,
        origen: 'sintetico',
      });
    }
    if (h.grupo) grupoDe.set(id, h.grupo);
    siniestros.push({
      id,
      fechaHecho: e.fechaHecho,
      lugarExtraido: e.lugar,
      victimas: e.victimas,
      tipo: e.tipo,
      cronicaIds: [],
      ubicacion,
      origen: 'sintetico',
    });
  });

  cronicas.sort((a, b) => a.fechaPublicacion.localeCompare(b.fechaPublicacion) || a.url.localeCompare(b.url));
  const cronicasConId: Cronica[] = cronicas.map((c, i) => ({ ...c, id: `CR-${String(i + 1).padStart(4, '0')}` }));
  const porSiniestro = new Map(siniestros.map((s) => [s.id, s]));
  for (const c of cronicasConId) porSiniestro.get(c.siniestroId)!.cronicaIds.push(c.id);

  // Números de las concentraciones: los de la especificación.
  const periodo = siniestros.filter((s) => anio(s.fechaHecho) <= PERIODO_PREDETERMINADO.hasta);
  const calculadas = agruparConcentraciones(periodo);
  const registroConcentraciones: RegistroConcentraciones = {};
  for (const c of calculadas) {
    const ids = new Set(c.siniestroIds.map((s) => grupoDe.get(s)));
    const [grupo] = [...ids];
    if (ids.size !== 1 || !grupo) throw new Error(`Semilla: la concentración ${nombreConcentracion(c)} no corresponde a un grupo`);
    registroConcentraciones[c.clave] = grupo;
  }
  if (calculadas.length !== GRUPOS.length) {
    throw new Error(`Semilla: salieron ${calculadas.length} concentraciones y se esperaban ${GRUPOS.length}`);
  }

  const reclamos = generarReclamos(r, siniestros);
  const concentraciones = agruparConcentraciones(periodo, registroConcentraciones);
  const fichas = generarFichas(concentraciones);

  return { cronicas: cronicasConId, siniestros, reclamos, fichas, registroConcentraciones };
}

/** La crónica redactada tiene que leerse igual que la especificación. */
function verificar(h: Hecho, e: ReturnType<typeof extraerDeCronica>, texto: string) {
  const fatales = h.victimas.filter((c) => c === c.toUpperCase()).length;
  const graves = h.victimas.length - fatales;
  const errores: string[] = [];
  if (e.fechaHecho !== h.fecha) errores.push(`fecha ${e.fechaHecho} ≠ ${h.fecha}`);
  if (e.fallecidos !== fatales) errores.push(`fallecidos ${e.fallecidos} ≠ ${fatales}`);
  if (e.heridosGraves !== graves) errores.push(`heridos graves ${e.heridosGraves} ≠ ${graves}`);
  if (e.tipo !== h.tipo) errores.push(`tipo ${e.tipo} ≠ ${h.tipo}`);
  if (!h.texto) {
    const l = h.lugar;
    if ('ruta' in l ? e.lugar?.ruta !== l.ruta || e.lugar?.km !== l.km : e.lugar?.altura !== l.altura) {
      errores.push(`lugar ${JSON.stringify(e.lugar)}`);
    }
  }
  if (errores.length) throw new Error(`Semilla: la crónica no se lee como se redactó (${errores.join('; ')}): ${texto}`);
}

// ── Reclamos ────────────────────────────────────────────────────────────────

const DESCRIPCIONES = [
  'Pozo profundo en el carril derecho; las motos lo esquivan de golpe.',
  'Semáforo apagado desde hace semanas.',
  'Falta la demarcación de la senda peatonal frente a la escuela.',
  'Luminarias apagadas en toda la cuadra; de noche no se ve a los peatones.',
  'Los autos doblan rápido y no respetan el paso peatonal.',
  'Un árbol tapa el cartel de PARE.',
  'Tapa de cloaca hundida en medio de la calzada.',
  'Badén muy marcado que hace saltar a las motos.',
  'Cruce sin semáforo con mucho tránsito en hora pico.',
  'Cartel de velocidad máxima caído hace meses.',
  'Calzada destrozada en toda la cuadra.',
  'No hay rampa ni senda en la esquina y los peatones cruzan entre los autos.',
];
const FOTOS = ['/fotos/foto-danio-2.jpg', '/fotos/foto-danio-3.jpg', '/fotos/foto-danio-4.jpg'];

function reclamoBase(
  numero: string,
  fecha: string | null,
  hora: string,
  p: LatLon,
  lugar: string,
  ambito: string,
  descripcion: string,
  foto?: string,
): Reclamo {
  const { x, y } = aProvincia(p);
  return {
    numero,
    fechaPresentacion: fecha,
    lat: Math.round(p.lat * 1e6) / 1e6,
    lon: Math.round(p.lon * 1e6) / 1e6,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    lugar,
    ambito,
    descripcion,
    foto,
    estado: 'abierto',
    alerta: false,
    alertas: [],
    siniestrosPosteriores: [],
    historial: fecha
      ? [{ fecha: `${fecha}T${hora}:00`, texto: foto ? 'Reclamo presentado con fotografía' : 'Reclamo presentado', tipo: 'presentacion' }]
      : [],
    origen: 'sintetico',
  };
}

/** Corre un punto unos metros hacia el norte (el vecino no marca exacto). */
function correr(p: LatLon, metros: number): LatLon {
  return { lat: p.lat + metros / 111_320, lon: p.lon };
}

function generarReclamos(r: Aleatorio, siniestros: Siniestro[]): Reclamo[] {
  const fijos: Reclamo[] = [
    reclamoBase(
      'PN-2026-0131',
      '2026-04-16',
      '09:15',
      correr(posicion(RECLAMOS_FIJOS['PN-2026-0131']), 12),
      'Av. Rafael Núñez al 2200',
      'Cerro de las Rosas',
      'Semáforo intermitente desde hace meses en la esquina; los autos cruzan sin frenar.',
      '/fotos/foto-danio-3.jpg',
    ),
    reclamoBase(
      'PN-2026-0157',
      '2026-06-09',
      '18:40',
      correr(posicion(RECLAMOS_FIJOS['PN-2026-0157']), 15),
      'Av. Monseñor Pablo Cabrera al 1900',
      'Alta Córdoba',
      'Ciclovía cortada y sin señalizar; las bicicletas tienen que salir a la avenida.',
    ),
    reclamoBase(
      'PN-2026-0186',
      '2026-05-21',
      '10:42',
      correr(posicion(RECLAMOS_FIJOS['PN-2026-0186']), 10),
      'Av. Colón al 5300',
      'Villa Cabrera',
      'Pozo grande en el carril derecho, las motos lo esquivan de golpe hacia el centro.',
      '/fotos/foto-danio-1.jpg',
    ),
    {
      ...reclamoBase(
        'PN-2026-0204',
        '2026-07-07',
        '07:55',
        posicionPorProgresiva('RN 36', 612)!,
        'RN 36 · km 612',
        'jurisdicción nacional',
        'Banquina descalzada y sin demarcación; los camiones se tiran a la banquina al cruzarse.',
      ),
      ruta: 'RN 36',
      km: 612,
    },
    {
      ...reclamoBase(
        'PN-2026-0160',
        null,
        '00:00',
        { lat: -31.49538, lon: -64.17869 },
        'Agustín Piaggio al 1000',
        'Villa El Libertador',
        'Vecinos «cansados de renegar con los pozos y la falta de respuestas» convirtieron el reclamo en una canción.',
      ),
      origen: 'real',
      evidencia: {
        medio: 'Cadena 3, Córdoba',
        fecha: '2026-06-12',
        titular: 'Bachata del bache: con una canción, vecinos reclaman por una calle destrozada',
        url: 'https://cadena3.com/noticia/siempre-juntos/bachata-del-bache-con-una-cancion-vecinos-reclaman-por-una-calle-destrozada_561812',
        cita: 'Vecinos «cansados de renegar con los pozos y la falta de respuestas» convirtieron el reclamo del grupo de WhatsApp en una canción',
        nota: 'La nota no fecha el inicio del reclamo ni informa siniestros en el punto. La fotografía del caso es del medio, con derechos reservados: se cita y no se reproduce.',
      },
    },
  ];

  // 27 reclamos abiertos sin alerta, posteriores al 9 de junio y lejos de todo siniestro.
  const puntosSiniestro = siniestros.filter((s) => s.ubicacion).map((s) => s.ubicacion!);
  const ocupados: LatLon[] = fijos.map((x) => x);
  const libres = Array.from({ length: 46 }, (_, i) => 158 + i).filter((n) => ![160, 186].includes(n));
  const numeros = libres.filter((_, i) => i % 17 !== 3 && i % 17 !== 11).slice(0, 27);
  const fechas = numeros.map((_, i) => sumarDias('2026-06-10', Math.round((i * 86) / 26))).sort();
  const sinteticos: Reclamo[] = [];
  let intentos = 0;
  while (sinteticos.length < 27 && intentos < 4000) {
    intentos++;
    const { calle, altura } = cuadraAzar(r, 100);
    const p = posicion({ calle, altura });
    if (puntosSiniestro.some((o) => distanciaMetros(o, p) < 150)) continue;
    if (ocupados.some((o) => distanciaMetros(o, p) < 300)) continue;
    ocupados.push(p);
    const i = sinteticos.length;
    const resp = servicioNormalizacionSimulado.normalizar({ calle, altura });
    sinteticos.push(
      reclamoBase(
        `PN-2026-${String(numeros[i]).padStart(4, '0')}`,
        fechas[i]!,
        `${String(r.entero(7, 21)).padStart(2, '0')}:${String(r.entero(0, 59)).padStart(2, '0')}`,
        correr(p, r.entero(-15, 15)),
        `${calle} al ${altura}`,
        resp?.barrio ?? 'Córdoba',
        r.elegir(DESCRIPCIONES),
        r.siguiente() < 0.4 ? r.elegir(FOTOS) : undefined,
      ),
    );
  }

  // Reproducción cronológica de presentaciones, cierres, inspecciones y siniestros de 2026.
  let reclamos = [...fijos, ...sinteticos];
  type Evento = { fecha: string; orden: number; aplicar: () => void };
  const eventos: Evento[] = [
    {
      fecha: '2026-07-20',
      orden: 1,
      aplicar: () => {
        reclamos = reclamos.map((x) =>
          x.numero === 'PN-2026-0204'
            ? cerrarReclamo(x, {
                motivo: 'obra ejecutada',
                respaldos: [{ tipo: 'orden de trabajo', referencia: 'OT-2026-0877' }],
                por: 'M. Ferreyra',
                en: '2026-07-20T12:30:00',
              })
            : x,
        );
      },
    },
    {
      fecha: '2026-09-05',
      orden: 1,
      aplicar: () => {
        reclamos = reclamos.map((x) =>
          x.numero === 'PN-2026-0186' ? agendarInspeccion(x, '2026-09-15', 'R. Quiroga', '2026-09-05T11:20:00') : x,
        );
      },
    },
    ...siniestros
      .filter((s) => s.fechaHecho >= '2026-01-01' && s.ubicacion?.estado === 'confirmada')
      .map((s) => ({
        fecha: s.fechaHecho,
        orden: 2,
        aplicar: () => {
          reclamos = evaluarReclamosDesatendidos(s, reclamos, `${sumarDias(s.fechaHecho, 1)}T08:00:00`).reclamos;
        },
      })),
  ];
  eventos.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden);
  for (const e of eventos) e.aplicar();

  return reclamos.sort((a, b) => a.numero.localeCompare(b.numero));
}

// ── Fichas ──────────────────────────────────────────────────────────────────

function generarFichas(concentraciones: ReturnType<typeof agruparConcentraciones>): Ficha[] {
  const emitir = (numero: string, id: string, fecha: string, por: string): Ficha => {
    const c = concentraciones.find((x) => x.id === id);
    if (!c) throw new Error(`Semilla: no existe la concentración ${id}`);
    return {
      numero,
      concentracionId: id,
      fecha,
      emitidaPor: por,
      contramedidaIds: recomendarContramedidas(c, CATALOGO_CONTRAMEDIDAS).map((m) => m.id),
      siniestroIds: c.siniestroIds,
      indice: c.indice,
    };
  };
  return [
    emitir('FI-2026-0038', 'C-0012', '2026-08-20', 'R. Quiroga'),
    emitir('FI-2026-0040', 'C-0003', '2026-09-01', 'M. Ferreyra'),
    emitir('FI-2026-0042', 'C-0007', '2026-09-08', 'R. Quiroga'),
  ];
}

// ── Crónicas de ejemplo, listas para pegar en CU01 ──────────────────────────

export interface CronicaDeEjemplo {
  titulo: string;
  proposito: string;
  medio: string;
  url: string;
  fechaPublicacion: string;
  texto: string;
}

export const CRONICAS_DE_EJEMPLO: readonly CronicaDeEjemplo[] = [
  {
    titulo: 'Motociclista en Av. Amadeo Sabattini al 4700',
    proposito: 'Calle con altura: la ubica el servicio de normalización con confianza 0,86 y queda confirmada (Figura 15).',
    medio: 'Medio local de ejemplo',
    url: 'https://medio-local.example/sociedad/motociclista-murio-sabattini',
    fechaPublicacion: '2026-09-08',
    texto:
      'Un motociclista de 24 años murió en la madrugada del sábado tras chocar contra un automóvil en avenida Amadeo Sabattini al 4700, en barrio Empalme. Según fuentes policiales, el joven circulaba hacia el este cuando el vehículo giró a la izquierda. Fue trasladado al hospital, donde falleció horas más tarde. El conductor del automóvil resultó ileso.',
  },
  {
    titulo: 'Ciclista en Av. Monseñor Pablo Cabrera al 1900',
    proposito: 'Cae a menos de 50 m del reclamo PN-2026-0157, abierto desde el 09/06: al confirmarse dispara la alerta de reclamo desatendido.',
    medio: 'Diario de ejemplo',
    url: 'https://diario.example/policiales/ciclista-murio-pablo-cabrera',
    fechaPublicacion: '2026-09-08',
    texto:
      'Una ciclista de 19 años murió ayer por la tarde tras chocar con una camioneta en avenida Monseñor Pablo Cabrera al 1900, en barrio Alta Córdoba. Vecinos de la zona recordaron que la ciclovía está cortada desde hace meses. La causa quedó a cargo de la fiscalía de turno.',
  },
  {
    titulo: 'Despiste en la ruta nacional 158, km 214',
    proposito: 'Ruta con progresiva: la ubica la capa de postes kilométricos, sin consultar el servicio de normalización.',
    medio: 'Radio de ejemplo',
    url: 'https://radio.example/regionales/despiste-ruta-158-km-214',
    fechaPublicacion: '2026-09-09',
    texto:
      'Un motociclista de 33 años murió esta madrugada tras despistarse sobre la ruta nacional 158, a la altura del kilómetro 214,6, cerca de General Deheza. Personal de tránsito trabajó en el lugar durante varias horas.',
  },
  {
    titulo: 'Otra crónica del hecho de Sabattini',
    proposito: 'Incorporada después de la primera, se reconoce como el mismo siniestro (RF03) y se vincula en lugar de crear uno nuevo.',
    medio: 'Portal regional de ejemplo',
    url: 'https://portal-regional.example/policiales/murio-motociclista-avenida-sabattini',
    fechaPublicacion: '2026-09-09',
    texto:
      'Un motociclista de 24 años murió el sábado tras chocar contra un automóvil que giró a la izquierda en avenida Amadeo Sabattini al 4700, en barrio Empalme. El joven fue trasladado al hospital, donde falleció horas más tarde. El conductor del automóvil resultó ileso.',
  },
];

/** La semilla se calcula una sola vez por carga de la página. */
let cache: DatosDemo | null = null;
export function semilla(): DatosDemo {
  cache ??= generarSemilla();
  return structuredClone(cache);
}
