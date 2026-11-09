/**
 * Acciones de CU01 (incorporar crónica) y CU02 (georreferenciar siniestro).
 *
 * `incorporarCronica` registra la crónica con los datos que el analista
 * confirmó o corrigió. Si decide vincularla a un siniestro existente (RF03,
 * cursos 4.a y 4.b), sólo agrega la crónica a ese siniestro. Si no, crea el
 * siniestro, lo georreferencia (RF04 a RF07) y guarda la ubicación con
 * `guardarUbicacion`: confirmada si alcanza el umbral, y entonces se evalúan
 * los reclamos (CU09); en revisión si no (RF08).
 */
import { cronicaPorUrl } from '../../dominio/duplicados';
import { buscarLocalidad, georreferenciar } from '../../dominio/georreferenciacion';
import { aProvincia } from '../../dominio/proyeccion';
import type { AlertaEmitida } from '../../dominio/reclamos';
import type { Cronica, LugarExtraido, Siniestro, TipoSiniestro, Ubicacion, Victima } from '../../dominio/tipos';
import { ahora } from '../reloj';
import { useDemo } from '../store';
import { guardarUbicacion } from './compartidas';

export interface EntradaCronica {
  url: string;
  medio: string;
  fechaPublicacion: string;
  texto: string;
}

/** Lo extraído por el sistema, tal como el analista lo confirmó o corrigió. */
export interface DatosConfirmados {
  lugar: LugarExtraido | null;
  fechaHecho: string;
  victimas: Victima[];
  tipo: TipoSiniestro | null;
}

export type DecisionDuplicado = { tipo: 'nuevo' } | { tipo: 'vincular'; siniestroId: string };

export interface ResultadoIncorporacion {
  cronica: Cronica;
  siniestro: Siniestro;
  /** La crónica se vinculó a un siniestro ya registrado (RF03). */
  vinculada: boolean;
  alertas: AlertaEmitida[];
}

/** "S-0471" → siguiente "S-0472"; "CR-0512" → "CR-0513". */
export function siguienteId(prefijo: 'S' | 'CR', existentes: readonly string[]): string {
  let max = 0;
  const re = new RegExp(`^${prefijo}-(\\d+)$`);
  for (const id of existentes) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `${prefijo}-${String(max + 1).padStart(4, '0')}`;
}

/**
 * CU01 3.a: el texto no tiene un lugar reconocible. El siniestro se registra
 * igual y su ubicación va a revisión con confianza cero, propuesta en el
 * centro de la ciudad de Córdoba para que el analista la mueva (CU03) o la
 * descarte.
 */
export function ubicacionSinLugar(): Ubicacion {
  const c = buscarLocalidad('Córdoba')!;
  const { x, y } = aProvincia(c);
  return {
    metodo: 'localidad',
    precision: 'barrio',
    confianza: 0,
    lat: c.lat,
    lon: c.lon,
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    nomenclatura: 'Sin lugar reconocible en el texto; se propone el centro de Córdoba',
    estado: 'en-revision',
  };
}

export function incorporarCronica(
  entrada: EntradaCronica,
  datos: DatosConfirmados,
  decision: DecisionDuplicado,
  por: string,
): ResultadoIncorporacion {
  const estado = useDemo.getState();
  const repetida = cronicaPorUrl(entrada.url, estado.cronicas);
  if (repetida) throw new Error(`La dirección web ya fue incorporada en ${repetida.id}`);

  const cronicaId = siguienteId('CR', estado.cronicas.map((c) => c.id));
  const base = {
    id: cronicaId,
    medio: entrada.medio.trim(),
    fechaPublicacion: entrada.fechaPublicacion,
    url: entrada.url.trim(),
    texto: entrada.texto,
    origen: 'sintetico' as const,
    incorporadaPor: por,
    incorporadaEn: ahora(),
  };

  if (decision.tipo === 'vincular') {
    const existente = estado.siniestros.find((s) => s.id === decision.siniestroId);
    if (!existente) throw new Error(`No existe el siniestro ${decision.siniestroId}`);
    const cronica: Cronica = { ...base, siniestroId: existente.id };
    const siniestro: Siniestro = { ...existente, cronicaIds: [...existente.cronicaIds, cronicaId] };
    useDemo.setState({
      cronicas: [...estado.cronicas, cronica],
      siniestros: estado.siniestros.map((s) => (s.id === siniestro.id ? siniestro : s)),
    });
    return { cronica, siniestro, vinculada: true, alertas: [] };
  }

  const siniestroId = siguienteId('S', estado.siniestros.map((s) => s.id));
  const cronica: Cronica = { ...base, siniestroId };
  const nuevo: Siniestro = {
    id: siniestroId,
    fechaHecho: datos.fechaHecho,
    lugarExtraido: datos.lugar,
    victimas: datos.victimas,
    tipo: datos.tipo,
    cronicaIds: [cronicaId],
    ubicacion: null,
    origen: 'sintetico',
  };
  useDemo.setState({ cronicas: [...estado.cronicas, cronica], siniestros: [...estado.siniestros, nuevo] });

  // CU02, incluido en el paso 6 de CU01.
  const ubicacion = georreferenciar(datos.lugar) ?? ubicacionSinLugar();
  const alertas = guardarUbicacion(siniestroId, ubicacion);
  const siniestro = useDemo.getState().siniestros.find((s) => s.id === siniestroId)!;
  return { cronica, siniestro, vinculada: false, alertas };
}
