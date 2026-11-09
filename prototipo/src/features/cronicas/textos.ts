/**
 * Textos y lecturas puras de la pantalla de crónicas: cómo se nombra un
 * lugar, un método, una precisión y las víctimas, y la crónica de ejemplo
 * propia de esta pantalla (la de confianza baja).
 */
import { CRONICAS_DE_EJEMPLO, type CronicaDeEjemplo } from '../../datos/semilla';
import { km, usuario } from '../../dominio/formato';
import type { EstadoUbicacion, LugarExtraido, MetodoUbicacion, Precision, Siniestro, TipoUsuario, Victima } from '../../dominio/tipos';
import type { EstadoFila } from '../../ui';

/**
 * Quinta crónica de ejemplo, sólo de esta pantalla: nombra la avenida sin
 * altura, así que el servicio de normalización devuelve el corredor con
 * confianza 0,30 y la ubicación queda en revisión (RF08). Sintética.
 */
export const EJEMPLO_CONFIANZA_BAJA: CronicaDeEjemplo = {
  titulo: 'Motociclista sobre Av. Vélez Sarsfield, sin altura',
  proposito: 'La crónica no informa la altura: el servicio sólo ubica el corredor, la confianza queda en 0,30 y la ubicación pasa a revisión.',
  medio: 'Medio local de ejemplo',
  url: 'https://medio-local.example/policiales/motociclista-murio-velez-sarsfield',
  fechaPublicacion: '2026-09-09',
  texto:
    'Un motociclista de 41 años murió anoche tras chocar contra un automóvil sobre avenida Vélez Sarsfield, en el sur de la ciudad. La policía no precisó a qué altura ocurrió el hecho. La causa quedó a cargo de la fiscalía de turno.',
};

/** Las cuatro crónicas de ejemplo de la semilla y la de confianza baja. */
export const EJEMPLOS: readonly CronicaDeEjemplo[] = [...CRONICAS_DE_EJEMPLO, EJEMPLO_CONFIANZA_BAJA];

export const TEXTO_METODO: Record<MetodoUbicacion, string> = {
  normalizacion: 'Servicio de normalización (calle)',
  poste: 'Capa de postes kilométricos (ruta)',
  localidad: 'Localidad mencionada',
  manual: 'Corrección manual',
};

/** Rótulo corto para la tabla. */
export const TEXTO_METODO_CORTO: Record<MetodoUbicacion, string> = {
  normalizacion: 'Normalización',
  poste: 'Poste km',
  localidad: 'Localidad',
  manual: 'Manual',
};

export const TEXTO_PRECISION: Record<Precision, string> = {
  cuadra: 'Cuadra (calle y altura)',
  interseccion: 'Intersección de dos calles',
  'ruta-progresiva': 'Ruta con progresiva',
  corredor: 'Corredor (vía sin altura ni progresiva)',
  barrio: 'Barrio o localidad',
};

/** "RN 158, km 214,6", "Av. Amadeo Sabattini al 4700", "Av. Colón y Av. General Paz". */
export function nombreLugar(lugar: LugarExtraido | null): string {
  if (!lugar) return 'Sin lugar reconocible';
  if (lugar.ruta) return lugar.km !== undefined ? `${lugar.ruta}, ${km(lugar.km)}` : lugar.ruta;
  if (lugar.calle && lugar.calle2) return `${lugar.calle} y ${lugar.calle2}`;
  if (lugar.calle) return lugar.altura !== undefined ? `${lugar.calle} al ${lugar.altura}` : lugar.calle;
  if (lugar.barrio) return `Barrio ${lugar.barrio}`;
  if (lugar.localidad) return lugar.localidad;
  return lugar.texto;
}

/** Barrio o localidad que acompaña al lugar, si la crónica la nombra. */
export function ambitoLugar(lugar: LugarExtraido | null): string | null {
  if (!lugar) return null;
  if (lugar.ruta) return lugar.localidad ? `cerca de ${lugar.localidad}` : null;
  if (lugar.calle && lugar.barrio) return `barrio ${lugar.barrio}`;
  return lugar.localidad ?? null;
}

const ORDEN_USUARIO: readonly TipoUsuario[] = ['peaton', 'ciclista', 'motociclista', 'conductor', 'acompanante'];

/** "1 motociclista" / "2 peatones y 1 conductor" para una gravedad. */
export function contarPorUsuario(victimas: readonly Victima[], gravedad: Victima['gravedad']): string | null {
  const partes: string[] = [];
  for (const t of ORDEN_USUARIO) {
    const n = victimas.filter((v) => v.gravedad === gravedad && v.tipoUsuario === t).length;
    if (n > 0) partes.push(n === 1 ? `1 ${usuario(t)}` : usuario(t, n));
  }
  if (partes.length === 0) return null;
  return partes.length === 1 ? partes[0]! : `${partes.slice(0, -1).join(', ')} y ${partes.at(-1)}`;
}

/** Víctimas de un siniestro por gravedad: fatales y heridos graves, cada una por tipo de usuario. */
export function resumenVictimas(s: Pick<Siniestro, 'victimas'>): { fatales: string | null; graves: string | null; cantidadFatales: number } {
  return {
    fatales: contarPorUsuario(s.victimas, 'fallecido'),
    graves: contarPorUsuario(s.victimas, 'herido-grave'),
    cantidadFatales: s.victimas.filter((v) => v.gravedad === 'fallecido').length,
  };
}

/** El estado de la ubicación tiñe la fila entera (verde, ámbar rayado o tenue). */
export function estadoFilaUbicacion(estado: EstadoUbicacion | null | undefined): EstadoFila | undefined {
  if (estado === 'confirmada') return 'confirmado';
  if (estado === 'en-revision' || estado === 'pendiente') return 'revision';
  if (estado === 'descartada') return 'cerrado';
  return 'revision';
}

export const TEXTO_ESTADO_UBICACION: Record<EstadoUbicacion | 'sin-ubicacion', string> = {
  confirmada: 'Confirmada',
  'en-revision': 'En revisión',
  pendiente: 'Pendiente',
  descartada: 'Descartada',
  'sin-ubicacion': 'Sin ubicación',
};
