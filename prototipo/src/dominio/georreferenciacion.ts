/**
 * Clasificación de la precisión (RF04) y georreferenciación (RF05, RF06, RF07,
 * RF08) de un lugar extraído. Corresponde a CU02.
 *
 * - Calle o intersección → servicio de normalización (simulado).
 * - Ruta con progresiva → capa de postes kilométricos. El servicio de
 *   normalización NO se consulta nunca para una ruta: ante una progresiva
 *   devuelve coordenadas erróneas sin señal de error.
 * - Ruta o progresiva fuera de la capa → localidad mencionada o más cercana,
 *   con confianza baja (CU02 2.b).
 * - Toda ubicación lleva su método y una confianza entre 0 y 1 (RF07); por
 *   debajo de `UMBRAL_CONFIANZA` queda en revisión y fuera de todo cálculo
 *   (RF08) hasta que la confirme el analista (CU03).
 */
import cartografia from '../datos/cartografia.json';
import { distanciaMetros, type LatLon } from './geo';
import { servicioNormalizacionSimulado, type ServicioNormalizacion } from './normalizacion';
import { coberturaPostes, posicionPorProgresiva } from './postes';
import { aProvincia } from './proyeccion';
import { normalizar } from './texto';
import type { EstadoUbicacion, LugarExtraido, MetodoUbicacion, Precision, Ubicacion } from './tipos';

/** Umbral de confianza configurado (CU02, comentarios: "se fijó inicialmente en 0,7"). */
export const UMBRAL_CONFIANZA = 0.7;

/**
 * Confianza asignada según cómo se obtuvo la coordenada. El servicio real
 * informa la calidad del resultado; el simulado la traduce a estos valores.
 */
export const CONFIANZA = {
  /** Calle y altura dentro del rango del nomenclador. */
  cuadra: 0.86,
  /** Altura fuera del rango conocido de la calle, extrapolada. */
  cuadraExtrapolada: 0.62,
  interseccion: 0.9,
  /** Calle sin altura, con una referencia de barrio ("a la altura de barrio X"). */
  corredor: 0.41,
  /** Calle sin altura ni referencia: el medio de la calle. */
  calle: 0.3,
  barrio: 0.22,
  /** Progresiva encontrada en la capa de postes. */
  poste: 0.93,
  /** Ruta con progresiva fuera de la capa: localidad mencionada o más cercana. */
  localidadRuta: 0.55,
  /** Ruta sin progresiva: localidad mencionada o más cercana. */
  rutaSinProgresiva: 0.3,
  /** Ningún servicio resolvió el lugar: centro de la localidad. */
  localidad: 0.1,
} as const;

export interface Localidad extends LatLon {
  nombre: string;
  departamento: string;
}

export const LOCALIDADES: readonly Localidad[] = cartografia.provincia.ciudades.map((c) => ({
  nombre: c.nombre,
  lat: c.lat,
  lon: c.lon,
  departamento: c.departamento,
}));

export function buscarLocalidad(nombre: string): Localidad | null {
  const k = normalizar(nombre);
  return LOCALIDADES.find((l) => normalizar(l.nombre) === k) ?? null;
}

export function localidadMasCercana(p: LatLon): Localidad {
  let mejor = LOCALIDADES[0]!;
  let d = Infinity;
  for (const l of LOCALIDADES) {
    const dl = distanciaMetros(p, l);
    if (dl < d) {
      d = dl;
      mejor = l;
    }
  }
  return mejor;
}

/** RF04: nivel de precisión del lugar extraído, o `null` si no hay lugar reconocible. */
export function clasificarPrecision(lugar: LugarExtraido | null): Precision | null {
  if (!lugar) return null;
  if (lugar.ruta) return lugar.km !== undefined ? 'ruta-progresiva' : 'corredor';
  if (lugar.calle && lugar.calle2) return 'interseccion';
  if (lugar.calle && lugar.altura !== undefined) return 'cuadra';
  if (lugar.calle) return 'corredor';
  if (lugar.barrio || lugar.localidad) return 'barrio';
  return null;
}

/** Estado inicial de una ubicación según su confianza (RF08). */
export function estadoPorConfianza(confianza: number): EstadoUbicacion {
  return confianza >= UMBRAL_CONFIANZA ? 'confirmada' : 'en-revision';
}

/** ¿Interviene esta ubicación en los cálculos? Sólo las confirmadas (RF08). */
export function intervieneEnCalculos(u: Ubicacion | null | undefined): u is Ubicacion {
  return !!u && u.estado === 'confirmada';
}

export interface ServiciosGeo {
  normalizacion: ServicioNormalizacion;
  posicionPorProgresiva: typeof posicionPorProgresiva;
}

export const SERVICIOS_SIMULADOS: ServiciosGeo = {
  normalizacion: servicioNormalizacionSimulado,
  posicionPorProgresiva,
};

/** Coordenadas geográficas y del plano provincial, con el mismo redondeo para toda ubicación. */
function coordenadas(p: LatLon): Pick<Ubicacion, 'lat' | 'lon' | 'x' | 'y'> {
  const { x, y } = aProvincia(p);
  return {
    lat: Math.round(p.lat * 1e6) / 1e6,
    lon: Math.round(p.lon * 1e6) / 1e6,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
  };
}

function ubicacion(
  p: LatLon,
  metodo: MetodoUbicacion,
  precision: Precision,
  confianza: number,
  extra: Partial<Ubicacion> = {},
): Ubicacion {
  return {
    metodo,
    precision,
    confianza,
    ...coordenadas(p),
    estado: estadoPorConfianza(confianza),
    ...extra,
  };
}

function porRuta(lugar: LugarExtraido & { ruta: string }, servicios: ServiciosGeo, precision: Precision): Ubicacion {
  const { ruta, km } = lugar;
  if (km !== undefined) {
    const p = servicios.posicionPorProgresiva(ruta, km);
    if (p) {
      return ubicacion(p, 'poste', precision, CONFIANZA.poste, {
        ruta,
        km,
        nomenclatura: `${ruta}, poste del km ${Math.floor(km)}`,
      });
    }
  }
  // 2.b: la ruta o la progresiva no figuran en la capa de postes.
  const mencionada = lugar.localidad ? buscarLocalidad(lugar.localidad) : null;
  let referencia: LatLon | null = mencionada;
  if (!referencia) {
    const cob = coberturaPostes(ruta);
    if (cob) {
      const extremo = km !== undefined && km < cob.desde ? cob.desde : cob.hasta;
      referencia = servicios.posicionPorProgresiva(ruta, extremo);
    }
  }
  const loc = mencionada ?? localidadMasCercana(referencia ?? LOCALIDADES[0]!);
  const confianza = km !== undefined ? CONFIANZA.localidadRuta : CONFIANZA.rutaSinProgresiva;
  return ubicacion(loc, 'localidad', precision, confianza, {
    ruta,
    km,
    nomenclatura:
      km !== undefined
        ? `${ruta} km ${km} fuera de la capa de postes; se propone ${loc.nombre}`
        : `${ruta} sin progresiva; se propone ${loc.nombre}`,
  });
}

/**
 * RF05, RF06, RF07: convierte el lugar extraído en una ubicación con método,
 * precisión, confianza y estado. Devuelve `null` si no hay lugar reconocible
 * (CU01 3.a: la crónica queda sin ubicación).
 */
export function georreferenciar(lugar: LugarExtraido | null, servicios: ServiciosGeo = SERVICIOS_SIMULADOS): Ubicacion | null {
  const precision = clasificarPrecision(lugar);
  if (!lugar || !precision) return null;

  if (lugar.ruta) return porRuta(lugar as LugarExtraido & { ruta: string }, servicios, precision);

  // Calles, intersecciones y barrios de la ciudad de Córdoba: servicio de normalización.
  if (lugar.calle || lugar.barrio) {
    const r = servicios.normalizacion.normalizar({
      calle: lugar.calle,
      altura: lugar.altura,
      calle2: lugar.calle2,
      barrio: lugar.barrio,
    });
    if (r) {
      const confianza = {
        altura: CONFIANZA.cuadra,
        'altura-extrapolada': CONFIANZA.cuadraExtrapolada,
        interseccion: CONFIANZA.interseccion,
        corredor: CONFIANZA.corredor,
        calle: CONFIANZA.calle,
        barrio: CONFIANZA.barrio,
      }[r.calidad];
      return ubicacion(r, 'normalizacion', precision, confianza, { nomenclatura: r.nomenclatura });
    }
  }

  const loc = (lugar.localidad && buscarLocalidad(lugar.localidad)) || buscarLocalidad('Córdoba')!;
  return ubicacion(loc, 'localidad', precision, CONFIANZA.localidad, {
    nomenclatura: `Sin resultado del servicio; se propone el centro de ${loc.nombre}`,
  });
}

/**
 * CU03: el analista confirma, corrige sobre el mapa o descarta una ubicación.
 * Una corrección cambia el método a `manual` y deja la confianza en 1.
 */
export function revisarUbicacion(
  u: Ubicacion,
  decision: { accion: 'confirmar' } | { accion: 'corregir'; lat: number; lon: number; km?: number } | { accion: 'descartar' },
  por: string,
  en: string,
): Ubicacion {
  if (decision.accion === 'descartar') return { ...u, estado: 'descartada', revisadaPor: por, revisadaEn: en };
  if (decision.accion === 'confirmar') return { ...u, estado: 'confirmada', revisadaPor: por, revisadaEn: en };
  return {
    ...u,
    metodo: 'manual',
    confianza: 1,
    ...coordenadas(decision),
    km: decision.km ?? u.km,
    estado: 'confirmada',
    revisadaPor: por,
    revisadaEn: en,
  };
}
