/**
 * CU03: cómo se nombra y se explica una ubicación en revisión. Funciones
 * puras, sin React, para que la pantalla y las pruebas digan lo mismo.
 */
import { coberturaPostes, formato, UMBRAL_CONFIANZA } from '../../dominio';
import type { Cronica, MetodoUbicacion, Precision, Siniestro, Ubicacion } from '../../dominio';

/** Nombre del lugar como lo extrajo la crónica: "Av. Circunvalación", "Barrio Villa El Libertador", "RN 36, km 790". */
export function nombreLugar(s: Pick<Siniestro, 'lugarExtraido' | 'ubicacion'>): string {
  const l = s.lugarExtraido;
  if (l?.ruta) return l.km !== undefined ? `${l.ruta}, ${formato.km(l.km)}` : l.ruta;
  if (l?.calle && l.calle2) return `${l.calle} y ${l.calle2}`;
  if (l?.calle) return l.altura ? `${l.calle} al ${l.altura}` : l.calle;
  if (l?.barrio) return `Barrio ${l.barrio}`;
  if (l?.localidad) return l.localidad;
  return s.ubicacion?.nomenclatura ?? 'Lugar sin nombre';
}

/** Por qué quedó en revisión, en pocas palabras (la línea bajo el nombre en la lista). */
export function resumenMotivo(s: Pick<Siniestro, 'lugarExtraido' | 'ubicacion'>): string {
  const l = s.lugarExtraido;
  const u = s.ubicacion;
  if (l?.ruta) {
    if (l.km === undefined) return 'ruta sin progresiva';
    return u?.metodo === 'localidad' ? 'progresiva fuera de la capa' : 'progresiva dudosa';
  }
  if (l?.calle && l.barrio && l.altura === undefined) return `«a la altura de barrio ${l.barrio}»`;
  if (l?.calle && !l.altura && !l.calle2) return 'calle sin altura en el texto';
  if (!l?.calle && l?.barrio) return 'sin calle en el texto';
  if (u?.precision === 'cuadra') return 'altura fuera del rango de la calle';
  return 'lugar impreciso';
}

const PRECISION: Record<Precision, string> = {
  cuadra: 'cuadra',
  interseccion: 'intersección',
  'ruta-progresiva': 'progresiva',
  corredor: 'corredor',
  barrio: 'barrio',
};

export function etiquetaPrecision(p: Precision): string {
  return PRECISION[p];
}

const METODO: Record<MetodoUbicacion, string> = {
  normalizacion: 'servicio de normalización',
  poste: 'poste kilométrico',
  localidad: 'localidad más cercana',
  manual: 'corrección manual',
};

export function etiquetaMetodo(m: MetodoUbicacion): string {
  return METODO[m];
}

/** Localidad propuesta, leída de la nomenclatura ("…; se propone Río Cuarto"). */
function localidadPropuesta(u: Ubicacion): string | null {
  const m = /se propone (?:el centro de )?(.+)$/.exec(u.nomenclatura ?? '');
  return m ? m[1]!.trim() : null;
}

/** Motivo de la baja confianza, en una o dos oraciones (RF07, RF08). */
export function motivoBajaConfianza(s: Pick<Siniestro, 'lugarExtraido' | 'ubicacion'>): string {
  const l = s.lugarExtraido;
  const u = s.ubicacion;
  if (!u) return 'El sistema no pudo proponer una coordenada para este lugar.';
  if (l?.ruta) {
    const loc = localidadPropuesta(u);
    const propuesta = loc ? ` Se propone ${loc}, a falta de un poste.` : '';
    if (l.km === undefined) return `La crónica nombra la ${l.ruta} sin progresiva: no hay poste que ubicar.${propuesta}`;
    const cob = coberturaPostes(l.ruta);
    if (cob && (l.km < cob.desde || l.km > cob.hasta)) {
      return `La capa de postes de la ${l.ruta} va del km ${cob.desde} al ${cob.hasta}: el ${formato.km(l.km)} no figura.${propuesta}`;
    }
    if (!cob) return `La ${l.ruta} no tiene postes cargados en la capa.${propuesta}`;
    return `La progresiva del ${formato.km(l.km)} no se pudo confirmar sobre la capa de postes.${propuesta}`;
  }
  if (l?.calle && l.barrio && l.altura === undefined) {
    return `La crónica nombra ${l.calle} y un barrio de referencia, sin altura. Sobre una vía de esta extensión eso deja un margen de cientos de metros.`;
  }
  if (l?.calle && !l.altura && !l.calle2) return `La crónica nombra ${l.calle} sin altura ni referencia: la coordenada es un punto medio de la calle.`;
  if (!l?.calle && l?.barrio) return 'La crónica nombra sólo el barrio, sin calle ni altura: la coordenada propuesta es el centro del barrio.';
  if (u.precision === 'cuadra') return 'La altura queda fuera del rango conocido de la calle: la coordenada se extrapoló.';
  if (u.metodo === 'localidad') return 'Ningún servicio resolvió el lugar: se propone el centro de la localidad.';
  return `La confianza queda por debajo del umbral de ${formato.decimal(UMBRAL_CONFIANZA)}.`;
}

/** Texto de la crónica partido en tres para resaltar el lugar extraído. */
export function partirResaltado(texto: string, s: Pick<Siniestro, 'lugarExtraido'>): [string, string, string] {
  const l = s.lugarExtraido;
  if (!l) return [texto, '', ''];
  let inicio = l.inicio;
  let fin = l.fin;
  if (inicio === undefined || fin === undefined || texto.slice(inicio, fin) !== l.texto) {
    const i = texto.indexOf(l.texto);
    if (i < 0 || !l.texto) return [texto, '', ''];
    inicio = i;
    fin = i + l.texto.length;
  }
  return [texto.slice(0, inicio), texto.slice(inicio, fin), texto.slice(fin)];
}

export type ResultadoRevision = 'confirmada' | 'corregida' | 'descartada';

/** Qué decidió el analista, leído de la ubicación revisada. */
export function resultadoRevision(u: Ubicacion): ResultadoRevision | null {
  if (!u.revisadaEn) return null;
  if (u.estado === 'descartada') return 'descartada';
  if (u.estado === 'confirmada') return u.metodo === 'manual' ? 'corregida' : 'confirmada';
  return null;
}

/** "09/09/2026 10:42". */
export function momento(iso: string): string {
  return `${formato.fecha(iso)} ${formato.hora(iso)}`;
}

/** La crónica de origen (la primera incorporada) de un siniestro. */
export function cronicaDe(s: Pick<Siniestro, 'cronicaIds'>, cronicas: readonly Cronica[]): Cronica | null {
  const id = s.cronicaIds[0];
  return (id && cronicas.find((c) => c.id === id)) || null;
}

/** "2,5" o "765.4" → número; `null` si no es una progresiva. */
export function leerKm(texto: string): number | null {
  const t = texto.trim().replace(/^km\s*/i, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}
