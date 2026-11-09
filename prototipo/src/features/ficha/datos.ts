/**
 * Lecturas de la ficha: siniestros ordenados y numerados como en el croquis,
 * su descripción breve y la caracterización del sitio en palabras.
 */
import { formato } from '../../dominio';
import type { Concentracion, Cronica, MetodoUbicacion, Siniestro, TipoUsuario } from '../../dominio';

export interface SiniestroFicha {
  numero: number;
  siniestro: Siniestro;
  /** Progresiva (km) en un tramo o altura en una cuadra. */
  posicion: number;
  fatal: boolean;
  /** "salida de calzada · motociclista". */
  descripcion: string;
  /** "Poste kilométrico, confianza 0,93 · La Voz del Interior". */
  origen: string;
}

const METODO: Record<MetodoUbicacion, string> = {
  normalizacion: 'normalización de calle',
  poste: 'poste kilométrico',
  localidad: 'centro de la localidad',
  manual: 'corrección manual',
};

/** "motociclista", "2 motociclistas", "peatón y conductor". */
export function victimasEnTexto(s: Pick<Siniestro, 'victimas'>): string {
  const partes: string[] = [];
  for (const gravedad of ['fallecido', 'herido-grave'] as const) {
    const cuenta = new Map<TipoUsuario, number>();
    for (const v of s.victimas) if (v.gravedad === gravedad) cuenta.set(v.tipoUsuario, (cuenta.get(v.tipoUsuario) ?? 0) + 1);
    const grupo = [...cuenta].map(([tipo, n]) => formato.usuario(tipo, n));
    if (grupo.length === 0) continue;
    partes.push(gravedad === 'fallecido' ? grupo.join(', ') : `herido grave: ${grupo.join(', ')}`);
  }
  return partes.join(' · ');
}

export function siniestrosDeFicha(
  ids: readonly string[],
  siniestros: readonly Siniestro[],
  cronicas: readonly Cronica[],
  c: Pick<Concentracion, 'unidad' | 'altura'> | null,
): SiniestroFicha[] {
  const porId = new Map(siniestros.map((s) => [s.id, s]));
  const medios = new Map(cronicas.map((cr) => [cr.id, cr.medio]));
  return ids
    .map((id) => porId.get(id))
    .filter((s): s is Siniestro => !!s)
    .sort((a, b) => a.fechaHecho.localeCompare(b.fechaHecho) || a.id.localeCompare(b.id))
    .map((s, i) => {
      const enRuta = c ? c.unidad === 'tramo' : s.ubicacion?.km !== undefined;
      const posicion = enRuta ? (s.ubicacion?.km ?? 0) : (s.lugarExtraido?.altura ?? c?.altura ?? 0);
      const victimas = victimasEnTexto(s);
      const u = s.ubicacion;
      const medio = s.cronicaIds.map((id) => medios.get(id)).find(Boolean);
      const metodo = u ? `${METODO[u.metodo]}, confianza ${formato.decimal(u.confianza)}` : 'sin ubicación';
      return {
        numero: i + 1,
        siniestro: s,
        posicion,
        fatal: s.victimas.some((v) => v.gravedad === 'fallecido'),
        descripcion: [s.tipo ?? 'tipo no informado', victimas].filter(Boolean).join(' · '),
        origen: medio ? `${metodo} · crónica de ${medio}` : metodo,
      };
    });
}

/** "km 694,3" en un tramo; "al 1230" en una cuadra. */
export function posicionEnTexto(unidad: Concentracion['unidad'], posicion: number): string {
  return unidad === 'tramo' ? formato.km(posicion) : `al ${Math.round(posicion)}`;
}

export function textoCalzada(c: Pick<Concentracion, 'via'>): string {
  return c.via.calzada === 'doble' ? 'Doble, con separador' : 'Simple';
}

export function textoBanquina(c: Pick<Concentracion, 'via'>): string {
  return { pavimentada: 'Pavimentada', 'sin pavimentar': 'Sin pavimentar', 'no corresponde': 'No corresponde' }[c.via.banquina];
}

/** "Tramo de ruta · Jesús María · departamento Colón". */
export function ambitoEnTexto(c: Pick<Concentracion, 'unidad' | 'localidad' | 'departamento'>): string {
  const partes = [c.unidad === 'tramo' ? 'Tramo de ruta de 1 km' : 'Punto urbano, radio de 150 m', c.localidad];
  if (c.departamento && c.departamento !== c.localidad) partes.push(`departamento ${c.departamento}`);
  return partes.join(' · ');
}

/** "08/09/2026" o "09/09/2026, 10:42" si la ficha guarda la hora. */
export function fechaFicha(iso: string): string {
  return iso.length > 10 ? `${formato.fecha(iso)}, ${formato.hora(iso)}` : formato.fecha(iso);
}
