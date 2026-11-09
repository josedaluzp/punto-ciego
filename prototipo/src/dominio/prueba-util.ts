/** Fábricas para las pruebas del dominio (no se usa en la aplicación). */
import { aProvincia } from './proyeccion';
import type { Reclamo, Siniestro, TipoSiniestro, TipoUsuario, Ubicacion, Victima } from './tipos';

let n = 0;

export function victima(tipoUsuario: TipoUsuario, gravedad: Victima['gravedad'] = 'fallecido'): Victima {
  return { tipoUsuario, gravedad };
}

export function ubic(lat: number, lon: number, extra: Partial<Ubicacion> = {}): Ubicacion {
  const { x, y } = aProvincia({ lat, lon });
  return { metodo: 'normalizacion', precision: 'cuadra', confianza: 0.86, lat, lon, x, y, estado: 'confirmada', ...extra };
}

export function siniestro(p: Partial<Siniestro> & { lat?: number; lon?: number; ruta?: string; km?: number } = {}): Siniestro {
  const { lat = -31.4167, lon = -64.1833, ruta, km, ...resto } = p;
  n++;
  return {
    id: `T-${String(n).padStart(4, '0')}`,
    fechaHecho: '2024-01-01',
    lugarExtraido: ruta ? { texto: `${ruta} km ${km}`, ruta, km } : { texto: 'Av. Colón al 1000', calle: 'Av. Colón', altura: 1000 },
    victimas: [victima('motociclista')],
    tipo: 'salida de calzada' as TipoSiniestro,
    cronicaIds: [],
    ubicacion: ubic(lat, lon, ruta ? { metodo: 'poste', precision: 'ruta-progresiva', confianza: 0.93, ruta, km } : {}),
    origen: 'sintetico',
    ...resto,
  };
}

/** Desplaza un punto hacia el norte una cantidad de metros. */
export function alNorte(lat: number, metros: number): number {
  return lat + metros / 111_320;
}

export function reclamo(p: Partial<Reclamo> = {}): Reclamo {
  const lat = p.lat ?? -31.4167;
  const lon = p.lon ?? -64.1833;
  const { x, y } = aProvincia({ lat, lon });
  return {
    numero: 'PN-2026-0001',
    fechaPresentacion: '2026-05-01',
    lat,
    lon,
    x,
    y,
    lugar: 'Av. Colón al 1000',
    ambito: 'Centro',
    descripcion: 'Pozo en el carril derecho',
    estado: 'abierto',
    alerta: false,
    alertas: [],
    siniestrosPosteriores: [],
    historial: [],
    origen: 'sintetico',
    ...p,
  };
}
