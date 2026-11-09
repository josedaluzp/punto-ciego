/**
 * Agrupamiento de siniestros confirmados en concentraciones (RF10, CU04).
 *
 * Unidades:
 * - Punto sobre la trama urbana: siniestros a menos de 150 m de un siniestro
 *   central. Se agrupa de forma voraz, empezando por el siniestro con más
 *   vecinos (desempate: el más antiguo), para que el resultado sea
 *   determinista.
 * - Tramo sobre ruta: siniestros de la misma ruta en el mismo kilómetro de
 *   progresiva, [k, k + 1).
 *
 * Significancia (Bíl, Andrášik y Janoška, 2013, en su forma más simple):
 * bajo la hipótesis de que los siniestros del ámbito se reparten al azar, la
 * cantidad que cae en una unidad sigue una distribución de Poisson con media
 *
 *   λ_tramo = siniestros de la ruta / kilómetros de la ruta cubiertos por la capa
 *   λ_punto = siniestros urbanos · π · (0,15 km)² / superficie urbana (576 km²)
 *
 * y la unidad con n siniestros es significativa si n ≥ 2 y
 *
 *   p = P(X ≥ n | λ) = 1 − Σ_{k=0}^{n−1} e^(−λ) · λ^k / k!  <  0,05
 *
 * Sólo intervienen los siniestros con ubicación confirmada (RF08). El índice
 * de riesgo (RF11) se calcula en `riesgo.ts` y no recibe reclamos.
 */
import { caracterizarVia } from '../datos/vias';
import { distanciaMetros, type LatLon } from './geo';
import { localidadMasCercana } from './georreferenciacion';
import { buscarCalle } from './normalizacion';
import { largoCubierto, posicionPorProgresiva } from './postes';
import { aProvincia } from './proyeccion';
import { componentesRiesgo, indiceRiesgo } from './riesgo';
import type { Concentracion, Siniestro, TipoSiniestro } from './tipos';
import { TIPOS_SINIESTRO } from './tipos';

export const RADIO_PUNTO_M = 150;
export const LARGO_TRAMO_KM = 1;
export const MINIMO_SINIESTROS = 2;
export const NIVEL_SIGNIFICANCIA = 0.05;
/** Superficie del ejido de la ciudad de Córdoba, en km². */
export const SUPERFICIE_URBANA_KM2 = 576;

/** Registro de números de concentración: clave estable → "C-0007". */
export type RegistroConcentraciones = Record<string, string>;

/** P(X ≥ n) para X ~ Poisson(λ). */
export function colaPoisson(n: number, lambda: number): number {
  if (n <= 0) return 1;
  let termino = Math.exp(-lambda);
  let acumulada = termino;
  for (let k = 1; k < n; k++) {
    termino *= lambda / k;
    acumulada += termino;
  }
  return Math.max(0, 1 - acumulada);
}

export function esSignificativa(n: number, lambda: number): boolean {
  return n >= MINIMO_SINIESTROS && colaPoisson(n, lambda) < NIVEL_SIGNIFICANCIA;
}

function esConfirmado(s: Siniestro): s is Siniestro & { ubicacion: NonNullable<Siniestro['ubicacion']> } {
  return !!s.ubicacion && s.ubicacion.estado === 'confirmada';
}

function enRuta(s: Siniestro): boolean {
  return !!s.ubicacion?.ruta && s.ubicacion.km !== undefined && s.ubicacion.metodo !== 'localidad';
}

function porFecha(a: Siniestro, b: Siniestro): number {
  return a.fechaHecho === b.fechaHecho ? a.id.localeCompare(b.id) : a.fechaHecho.localeCompare(b.fechaHecho);
}

function predominante(siniestros: readonly Siniestro[]): { tipo: TipoSiniestro; cantidad: number } {
  const cuenta = new Map<TipoSiniestro, { n: number; fallecidos: number }>();
  for (const s of siniestros) {
    if (!s.tipo) continue;
    const c = cuenta.get(s.tipo) ?? { n: 0, fallecidos: 0 };
    c.n++;
    c.fallecidos += s.victimas.filter((v) => v.gravedad === 'fallecido').length;
    cuenta.set(s.tipo, c);
  }
  let mejor: { tipo: TipoSiniestro; cantidad: number; fallecidos: number } = { tipo: 'choque lateral', cantidad: 0, fallecidos: -1 };
  for (const tipo of TIPOS_SINIESTRO) {
    const c = cuenta.get(tipo);
    if (!c) continue;
    if (c.n > mejor.cantidad || (c.n === mejor.cantidad && c.fallecidos > mejor.fallecidos)) {
      mejor = { tipo, cantidad: c.n, fallecidos: c.fallecidos };
    }
  }
  return { tipo: mejor.tipo, cantidad: mejor.cantidad };
}

function centroide(siniestros: readonly Siniestro[]): LatLon {
  const n = siniestros.length;
  return {
    lat: siniestros.reduce((a, s) => a + s.ubicacion!.lat, 0) / n,
    lon: siniestros.reduce((a, s) => a + s.ubicacion!.lon, 0) / n,
  };
}

/** Calle y altura representativas de un punto: la calle más citada y la mediana de sus alturas. */
function direccion(siniestros: readonly Siniestro[]): { calle?: string; altura?: number } {
  const porCalle = new Map<string, number[]>();
  for (const s of siniestros) {
    const l = s.lugarExtraido;
    if (!l?.calle) continue;
    const oficial = buscarCalle(l.calle)?.nombre ?? l.calle;
    const alturas = porCalle.get(oficial) ?? [];
    if (l.altura !== undefined) alturas.push(l.altura);
    porCalle.set(oficial, alturas);
  }
  let calle: string | undefined;
  let alturas: number[] = [];
  for (const [c, a] of porCalle) {
    if (!calle || a.length > alturas.length) {
      calle = c;
      alturas = a;
    }
  }
  if (!calle) return {};
  if (alturas.length === 0) return { calle };
  const orden = [...alturas].sort((a, b) => a - b);
  const mediana = orden[Math.floor((orden.length - 1) / 2)]!;
  return { calle, altura: Math.round(mediana / 100) * 100 };
}

interface Grupo {
  unidad: 'punto' | 'tramo';
  clave: string;
  siniestros: Siniestro[];
  esperado: number;
  ruta?: string;
  kmDesde?: number;
}

function agruparPuntos(urbanos: Siniestro[], lambda: number): Grupo[] {
  const orden = [...urbanos].sort(porFecha);
  const vecinos = orden.map((a) =>
    orden.map((b, j) => (distanciaMetros(a.ubicacion!, b.ubicacion!) <= RADIO_PUNTO_M ? j : -1)).filter((j) => j >= 0),
  );
  const asignado = new Array<boolean>(orden.length).fill(false);
  const grupos: Grupo[] = [];
  for (;;) {
    let mejor = -1;
    let mejorN = 0;
    for (let i = 0; i < orden.length; i++) {
      if (asignado[i]) continue;
      const n = vecinos[i]!.filter((j) => !asignado[j]).length;
      if (n > mejorN) {
        mejor = i;
        mejorN = n;
      }
    }
    if (mejor < 0 || mejorN < MINIMO_SINIESTROS) break;
    const miembros = vecinos[mejor]!.filter((j) => !asignado[j]);
    for (const j of miembros) asignado[j] = true;
    const sins = miembros.map((j) => orden[j]!).sort(porFecha);
    grupos.push({ unidad: 'punto', clave: `punto|${sins[0]!.id}`, siniestros: sins, esperado: lambda });
  }
  return grupos;
}

function agruparTramos(enRutas: Siniestro[]): Grupo[] {
  const porRuta = new Map<string, Siniestro[]>();
  for (const s of enRutas) {
    const l = porRuta.get(s.ubicacion!.ruta!) ?? [];
    l.push(s);
    porRuta.set(s.ubicacion!.ruta!, l);
  }
  const grupos: Grupo[] = [];
  for (const [ruta, sins] of porRuta) {
    const largo = largoCubierto(ruta);
    if (largo <= 0) continue;
    const lambda = (sins.length / largo) * LARGO_TRAMO_KM;
    const porKm = new Map<number, Siniestro[]>();
    for (const s of sins) {
      const k = Math.floor(s.ubicacion!.km!);
      const l = porKm.get(k) ?? [];
      l.push(s);
      porKm.set(k, l);
    }
    for (const [k, l] of porKm) {
      grupos.push({ unidad: 'tramo', clave: `tramo|${ruta}|${k}`, siniestros: l.sort(porFecha), esperado: lambda, ruta, kmDesde: k });
    }
  }
  return grupos;
}

function numeroDe(n: number): string {
  return `C-${String(n).padStart(4, '0')}`;
}

/**
 * RF10 + RF11: concentraciones significativas, con su índice de riesgo,
 * ordenadas de mayor a menor índice. `registro` conserva los números ya
 * asignados; las concentraciones nuevas reciben el siguiente número libre.
 */
export function agruparConcentraciones(
  siniestros: readonly Siniestro[],
  registro: RegistroConcentraciones = {},
): Concentracion[] {
  const confirmados = siniestros.filter(esConfirmado);
  const rutas = confirmados.filter(enRuta);
  const urbanos = confirmados.filter((s) => !enRuta(s));
  const lambdaPunto = (urbanos.length * Math.PI * (RADIO_PUNTO_M / 1000) ** 2) / SUPERFICIE_URBANA_KM2;

  const grupos = [...agruparPuntos(urbanos, lambdaPunto), ...agruparTramos(rutas)].filter((g) =>
    esSignificativa(g.siniestros.length, g.esperado),
  );

  const concentraciones = grupos.map((g): Omit<Concentracion, 'id'> => {
    const comp = componentesRiesgo(g.siniestros);
    const pred = predominante(g.siniestros);
    const centro =
      g.unidad === 'tramo' ? (posicionPorProgresiva(g.ruta!, g.kmDesde! + LARGO_TRAMO_KM / 2) ?? centroide(g.siniestros)) : centroide(g.siniestros);
    const loc = localidadMasCercana(centro);
    const dir = g.unidad === 'punto' ? direccion(g.siniestros) : {};
    const { x, y } = aProvincia(centro);
    return {
      clave: g.clave,
      unidad: g.unidad,
      siniestroIds: g.siniestros.map((s) => s.id),
      indice: indiceRiesgo(comp),
      severidad: comp.severidad,
      frecuencia: comp.frecuencia,
      vulnerables: comp.vulnerables,
      fallecidos: comp.fallecidos,
      heridosGraves: comp.heridosGraves,
      fallecidosVulnerables: comp.fallecidosVulnerables,
      tipoPredominante: pred.tipo,
      cantidadPredominante: pred.cantidad,
      via: caracterizarVia({ ruta: g.ruta, km: g.kmDesde, calle: dir.calle }),
      ruta: g.ruta,
      kmDesde: g.kmDesde,
      kmHasta: g.kmDesde !== undefined ? g.kmDesde + LARGO_TRAMO_KM : undefined,
      calle: dir.calle,
      altura: dir.altura,
      localidad: loc.nombre,
      departamento: loc.departamento,
      lat: centro.lat,
      lon: centro.lon,
      x,
      y,
      esperado: g.esperado,
      pValor: colaPoisson(g.siniestros.length, g.esperado),
    };
  });

  concentraciones.sort((a, b) => b.indice - a.indice || b.fallecidos - a.fallecidos || a.clave.localeCompare(b.clave));

  let siguiente = Math.max(0, ...Object.values(registro).map((id) => Number(id.slice(2)) || 0)) + 1;
  return concentraciones.map((c) => ({ ...c, id: registro[c.clave] ?? numeroDe(siguiente++) }));
}

/** Registro actualizado con los números de las concentraciones dadas. */
export function actualizarRegistro(concentraciones: readonly Concentracion[], registro: RegistroConcentraciones): RegistroConcentraciones {
  const out = { ...registro };
  for (const c of concentraciones) out[c.clave] = c.id;
  return out;
}

/** Rótulo del lugar: "RN 9 · km 694 a 695" o "Av. Vélez Sarsfield al 1200". */
export function nombreConcentracion(c: Pick<Concentracion, 'unidad' | 'ruta' | 'kmDesde' | 'kmHasta' | 'calle' | 'altura' | 'localidad'>): string {
  if (c.unidad === 'tramo') return `${c.ruta} · km ${c.kmDesde} a ${c.kmHasta}`;
  if (c.calle) return c.altura !== undefined ? `${c.calle} al ${c.altura}` : c.calle;
  return `Punto en ${c.localidad}`;
}
