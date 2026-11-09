/**
 * Tipos del dominio, según el diagrama de clases de la Entrega 3
 * (Figuras 10 y 11) y el diccionario de datos (Tabla 22).
 *
 * Convenciones:
 * - Las fechas del hecho y de presentación son fechas ISO `AAAA-MM-DD`.
 * - Los momentos de registro (`revisadaEn`, `cierre.en`, `historial.fecha`)
 *   son ISO completos `AAAA-MM-DDTHH:mm:ss`.
 * - `lat`/`lon` en WGS 84 son la fuente de verdad de toda posición; `x`/`y`
 *   son la misma posición en el plano de dibujo de la provincia
 *   (ver `proyeccion.ts`), guardados para no recalcularlos al pintar.
 */

export type Origen = 'sintetico' | 'real';

// ── Siniestros ──────────────────────────────────────────────────────────────

export type TipoUsuario = 'peaton' | 'ciclista' | 'motociclista' | 'conductor' | 'acompanante';

/** Peatón, ciclista y motociclista son usuarios vulnerables (RF11). */
export const USUARIOS_VULNERABLES: readonly TipoUsuario[] = ['peaton', 'ciclista', 'motociclista'];

export type Gravedad = 'fallecido' | 'herido-grave';

export interface Victima {
  tipoUsuario: TipoUsuario;
  /**
   * RF02 pide las víctimas fatales. La extracción también reconoce a los
   * heridos de gravedad porque pesan en la severidad del índice (RF11).
   */
  gravedad: Gravedad;
}

export type TipoSiniestro =
  | 'salida de calzada'
  | 'choque frontal'
  | 'atropello de peatón'
  | 'choque en giro'
  | 'caída de motociclista'
  | 'choque por alcance'
  | 'choque lateral';

export const TIPOS_SINIESTRO: readonly TipoSiniestro[] = [
  'salida de calzada',
  'choque frontal',
  'atropello de peatón',
  'choque en giro',
  'caída de motociclista',
  'choque por alcance',
  'choque lateral',
];

/** Nivel de precisión del lugar extraído (RF04, Tabla 22 `nivel_precision`). */
export type Precision = 'cuadra' | 'interseccion' | 'ruta-progresiva' | 'corredor' | 'barrio';

/** Método que produjo la coordenada (RF07, Tabla 22 `metodo`). */
export type MetodoUbicacion = 'normalizacion' | 'poste' | 'localidad' | 'manual';

/**
 * Estado de la ubicación. `en-revision` es la "pendiente de revisión" de CU02
 * 5.a; `pendiente` queda para el caso en que el servicio no respondió (3.a).
 */
export type EstadoUbicacion = 'confirmada' | 'en-revision' | 'descartada' | 'pendiente';

/** Lo que la extracción reconoce del lugar en el texto de la crónica. */
export interface LugarExtraido {
  /** Fragmento literal de la crónica que describe el lugar. */
  texto: string;
  /** Posición del fragmento dentro del texto, para resaltarlo. */
  inicio?: number;
  fin?: number;
  calle?: string;
  altura?: number;
  /** Segunda calle de una intersección. */
  calle2?: string;
  /** "RN 9" o "RP 5". */
  ruta?: string;
  km?: number;
  barrio?: string;
  localidad?: string;
}

export interface Ubicacion {
  metodo: MetodoUbicacion;
  precision: Precision;
  /** Entre 0 y 1 (RF07). */
  confianza: number;
  lat: number;
  lon: number;
  /** Plano de dibujo de la provincia. */
  x: number;
  y: number;
  ruta?: string;
  km?: number;
  /** Nomenclatura oficial devuelta por el servicio, o descripción del método. */
  nomenclatura?: string;
  estado: EstadoUbicacion;
  revisadaPor?: string;
  revisadaEn?: string;
}

export interface Cronica {
  id: string;
  medio: string;
  fechaPublicacion: string;
  url: string;
  texto: string;
  siniestroId: string;
  origen: Origen;
  /** Quién la incorporó desde la pantalla y cuándo (RNF02); la semilla no los lleva. */
  incorporadaPor?: string;
  incorporadaEn?: string;
}

export interface Siniestro {
  id: string;
  fechaHecho: string;
  lugarExtraido: LugarExtraido | null;
  victimas: Victima[];
  tipo: TipoSiniestro | null;
  cronicaIds: string[];
  ubicacion: Ubicacion | null;
  origen: Origen;
}

// ── Priorización ────────────────────────────────────────────────────────────

export type UnidadConcentracion = 'punto' | 'tramo';

export type Calzada = 'simple' | 'doble';
export type Banquina = 'pavimentada' | 'sin pavimentar' | 'no corresponde';

export interface CaracterizacionVia {
  calzada: Calzada;
  carriles: number;
  banquina: Banquina;
}

export interface Concentracion {
  /** "C-0007". */
  id: string;
  /** Clave estable para conservar el número entre recálculos. */
  clave: string;
  unidad: UnidadConcentracion;
  siniestroIds: string[];
  /** Índice de riesgo entre 0 y 1 (RF11). */
  indice: number;
  severidad: number;
  frecuencia: number;
  /** Proporción de víctimas fatales que son usuarios vulnerables, 0..1. */
  vulnerables: number;
  fallecidos: number;
  heridosGraves: number;
  /** Cantidad de víctimas fatales que son usuarios vulnerables. */
  fallecidosVulnerables: number;
  tipoPredominante: TipoSiniestro;
  /** Cuántos siniestros son del tipo predominante. */
  cantidadPredominante: number;
  via: CaracterizacionVia;
  ruta?: string;
  kmDesde?: number;
  kmHasta?: number;
  calle?: string;
  altura?: number;
  localidad: string;
  departamento?: string;
  lat: number;
  lon: number;
  x: number;
  y: number;
  /** Siniestros esperados en la unidad según la tasa media del ámbito. */
  esperado: number;
  /** Valor p de la prueba de Poisson. */
  pValor: number;
}

export type TipoVia = 'calle' | 'ruta';

export interface Contramedida {
  id: string;
  nombre: string;
  tipoVia: TipoVia;
  tipoSiniestro: TipoSiniestro;
  /** Proporción de siniestros que se espera conservar (0,72 = reduce 28 %). */
  factor: number;
  /** Calidad del estudio que respalda el factor, de 1 a 5 estrellas. */
  calificacion: 1 | 2 | 3 | 4 | 5;
  referencia: string;
}

export interface Ficha {
  /** "FI-2026-0042". */
  numero: string;
  concentracionId: string;
  fecha: string;
  emitidaPor: string;
  contramedidaIds: string[];
  /** Evidencia congelada al emitir, para la trazabilidad (RNF02). */
  siniestroIds: string[];
  indice: number;
}

// ── Reclamos ────────────────────────────────────────────────────────────────

export type EstadoReclamo = 'abierto' | 'en-verificacion' | 'cerrado' | 'reabierto';

export type TipoAlerta = 'reclamo-desatendido' | 'cierre-desmentido';

export interface Alerta {
  tipo: TipoAlerta;
  siniestroId: string;
  /** Fecha del hecho que la disparó. */
  fecha: string;
  /** Días sin respuesta al momento del siniestro. */
  diasSinRespuesta: number;
}

export type MotivoCierre = 'obra ejecutada' | 'deterioro no constatado' | 'otra jurisdicción o duplicado';

export const MOTIVOS_CIERRE: readonly MotivoCierre[] = [
  'obra ejecutada',
  'deterioro no constatado',
  'otra jurisdicción o duplicado',
];

export type TipoRespaldo = 'orden de trabajo' | 'fotografía de la obra' | 'acta de inspección';

export interface Respaldo {
  tipo: TipoRespaldo;
  /** Número de orden de trabajo, nombre del archivo o número de acta. */
  referencia: string;
}

export interface Cierre {
  motivo: MotivoCierre;
  respaldos: Respaldo[];
  por: string;
  en: string;
}

export interface EntradaHistorial {
  fecha: string;
  texto: string;
  por?: string;
  tipo?: 'presentacion' | 'siniestro' | 'alerta' | 'inspeccion' | 'cierre' | 'reapertura';
}

export interface Reclamo {
  /** "PN-2026-0131". */
  numero: string;
  /** Fecha de presentación; `null` sólo en el caso documentado sin fecha de inicio. */
  fechaPresentacion: string | null;
  lat: number;
  lon: number;
  x: number;
  y: number;
  /** "Av. Colón al 5300" o "RN 36 · km 612". */
  lugar: string;
  /** Barrio o jurisdicción, como se muestra bajo el número. */
  ambito: string;
  /** Calle del nomenclador, cuando el lugar cae sobre una (reclamo vecinal); la chapa la rotula. */
  calle?: string;
  ruta?: string;
  km?: number;
  descripcion: string;
  /** Ruta de la fotografía adjunta (optativa, RF15). */
  foto?: string;
  estado: EstadoReclamo;
  alerta: boolean;
  alertas: Alerta[];
  siniestrosPosteriores: string[];
  inspeccionAgendada?: { fecha: string; por: string };
  cierre?: Cierre;
  /** Cierres anteriores desmentidos por un siniestro. */
  cierresDesmentidos?: Cierre[];
  historial: EntradaHistorial[];
  origen: Origen;
  /** Sólo en el caso documentado: de dónde sale. */
  evidencia?: { medio: string; fecha: string; titular?: string; url?: string; cita?: string; nota: string };
}

// ── Usuarios de demostración ────────────────────────────────────────────────

export type Rol = 'analista' | 'tecnico' | 'funcionario';

export interface Usuario {
  id: string;
  nombre: string;
  rol: Rol;
  /** "Analista de siniestralidad". */
  cargo: string;
  area: string;
}
