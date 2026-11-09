/**
 * Reclamos vecinales: evaluación de desatendidos (RF16, CU09), bandeja
 * (RF17, CU10) y cierre (RF18, CU11).
 *
 * Radio de la evaluación: 50 m sobre calle y 500 m sobre ruta, como fija la
 * ficha de CU09 (Tabla 19, comentarios). Ningún reclamo dispara por sí solo
 * una alerta: hace falta un siniestro confirmado posterior a su presentación.
 */
import { diasEntre } from './fechas';
import { distanciaMetros } from './geo';
import type { Cierre, Reclamo, Rol, Siniestro, TipoAlerta } from './tipos';
import { MOTIVOS_CIERRE } from './tipos';

export const RADIO_RECLAMO_M = { calle: 50, ruta: 500 } as const;

/** Radio aplicable: el de ruta si el siniestro o el reclamo están sobre una ruta. */
export function radioReclamo(siniestro: Pick<Siniestro, 'ubicacion'>, reclamo: Pick<Reclamo, 'ruta'>): number {
  return siniestro.ubicacion?.ruta || reclamo.ruta ? RADIO_RECLAMO_M.ruta : RADIO_RECLAMO_M.calle;
}

/** Días desde la presentación hasta `hoy`; `null` si la fecha de inicio no se conoce. */
export function diasSinRespuesta(reclamo: Pick<Reclamo, 'fechaPresentacion'>, hoy: string): number | null {
  return reclamo.fechaPresentacion ? Math.max(0, diasEntre(reclamo.fechaPresentacion, hoy)) : null;
}

export interface AlertaEmitida {
  reclamo: string;
  tipo: TipoAlerta;
  siniestroId: string;
  distancia: number;
}

export interface ResultadoEvaluacion {
  /** Todos los reclamos, con los afectados ya actualizados. */
  reclamos: Reclamo[];
  alertas: AlertaEmitida[];
  /** Reclamos en el radio presentados después del siniestro (2.b): sin alerta. */
  posterioresAlSiniestro: string[];
}

/**
 * RF16 / CU09: confronta un siniestro confirmado con los reclamos cercanos.
 *
 * - Reclamo abierto, en verificación o reabierto, presentado antes del
 *   siniestro → alerta de reclamo desatendido y el siniestro queda asociado.
 * - Reclamo cerrado antes del siniestro → se reabre conservando su fecha de
 *   presentación original, con alerta de cierre desmentido por siniestro.
 * - Reclamo presentado después del siniestro → sin alerta.
 * - Reclamo cerrado después del siniestro → el cierre no queda desmentido.
 *
 * Es idempotente: confirmar dos veces el mismo siniestro no duplica nada.
 */
export function evaluarReclamosDesatendidos(
  siniestro: Siniestro,
  reclamos: readonly Reclamo[],
  en: string = siniestro.fechaHecho,
): ResultadoEvaluacion {
  const alertas: AlertaEmitida[] = [];
  const posterioresAlSiniestro: string[] = [];
  const u = siniestro.ubicacion;
  if (!u || u.estado !== 'confirmada') return { reclamos: [...reclamos], alertas, posterioresAlSiniestro };

  const actualizados = reclamos.map((r) => {
    const distancia = distanciaMetros(u, r);
    if (distancia > radioReclamo(siniestro, r)) return r;
    if (!r.fechaPresentacion) return r;
    if (diasEntre(r.fechaPresentacion, siniestro.fechaHecho) <= 0) {
      posterioresAlSiniestro.push(r.numero);
      return r;
    }
    if (r.siniestrosPosteriores.includes(siniestro.id)) return r;

    const dias = diasEntre(r.fechaPresentacion, siniestro.fechaHecho);
    if (r.estado === 'cerrado') {
      const cierre = r.cierre;
      if (!cierre || cierre.en.slice(0, 10) >= siniestro.fechaHecho) return r;
      alertas.push({ reclamo: r.numero, tipo: 'cierre-desmentido', siniestroId: siniestro.id, distancia });
      return {
        ...r,
        estado: 'reabierto' as const,
        alerta: true,
        cierre: undefined,
        cierresDesmentidos: [...(r.cierresDesmentidos ?? []), cierre],
        alertas: [...r.alertas, { tipo: 'cierre-desmentido' as const, siniestroId: siniestro.id, fecha: siniestro.fechaHecho, diasSinRespuesta: dias }],
        siniestrosPosteriores: [...r.siniestrosPosteriores, siniestro.id],
        historial: [
          ...r.historial,
          { fecha: `${siniestro.fechaHecho}T00:00:00`, texto: `Siniestro confirmado a ${Math.round(distancia)} m del lugar reclamado`, tipo: 'siniestro' as const },
          { fecha: en, texto: 'Cierre desmentido por siniestro: el reclamo se reabre y conserva su fecha de presentación', tipo: 'reapertura' as const },
        ],
      };
    }

    alertas.push({ reclamo: r.numero, tipo: 'reclamo-desatendido', siniestroId: siniestro.id, distancia });
    return {
      ...r,
      alerta: true,
      alertas: [...r.alertas, { tipo: 'reclamo-desatendido' as const, siniestroId: siniestro.id, fecha: siniestro.fechaHecho, diasSinRespuesta: dias }],
      siniestrosPosteriores: [...r.siniestrosPosteriores, siniestro.id],
      historial: [
        ...r.historial,
        { fecha: `${siniestro.fechaHecho}T00:00:00`, texto: `Siniestro confirmado a ${Math.round(distancia)} m del lugar reclamado`, tipo: 'siniestro' as const },
        { fecha: en, texto: `Alerta de reclamo desatendido: ${dias} días sin respuesta`, tipo: 'alerta' as const },
      ],
    };
  });
  return { reclamos: actualizados, alertas, posterioresAlSiniestro };
}

/**
 * RF17 / CU10: bandeja de reclamos desatendidos. Primero los que tienen
 * alerta, por siniestros posteriores y luego por días sin respuesta; después
 * los demás por antigüedad (2.a). Los de antigüedad desconocida van al final
 * de su grupo. Los cerrados no figuran salvo que se pidan.
 */
export function ordenarBandeja(reclamos: readonly Reclamo[], hoy: string, opciones: { incluirCerrados?: boolean } = {}): Reclamo[] {
  const dias = (r: Reclamo) => diasSinRespuesta(r, hoy) ?? -1;
  return reclamos
    .filter((r) => opciones.incluirCerrados || r.estado !== 'cerrado')
    .slice()
    .sort((a, b) => {
      if (a.alerta !== b.alerta) return a.alerta ? -1 : 1;
      if (a.estado === 'cerrado' && b.estado !== 'cerrado') return 1;
      if (b.estado === 'cerrado' && a.estado !== 'cerrado') return -1;
      if (a.alerta) {
        const d = b.siniestrosPosteriores.length - a.siniestrosPosteriores.length;
        if (d !== 0) return d;
      }
      return dias(b) - dias(a) || a.numero.localeCompare(b.numero);
    });
}

/** CU10 4.a: agendar la inspección pasa el reclamo a en verificación y conserva su antigüedad. */
export function agendarInspeccion(reclamo: Reclamo, fecha: string, por: string, en: string): Reclamo {
  if (reclamo.estado === 'cerrado') throw new Error('Un reclamo cerrado no admite inspección');
  return {
    ...reclamo,
    estado: 'en-verificacion',
    inspeccionAgendada: { fecha, por },
    historial: [...reclamo.historial, { fecha: en, texto: `Inspección agendada para el ${fecha.split('-').reverse().join('/')}: pasa a en verificación`, por, tipo: 'inspeccion' }],
  };
}

export interface ValidacionCierre {
  ok: boolean;
  errores: string[];
}

/** RF18: un cierre exige motivo y al menos un respaldo documental con referencia. */
export function puedeCerrar(cierre: Partial<Pick<Cierre, 'motivo' | 'respaldos'>>): ValidacionCierre {
  const errores: string[] = [];
  if (!cierre.motivo || !MOTIVOS_CIERRE.includes(cierre.motivo)) errores.push('Elegí el motivo del cierre.');
  const validos = (cierre.respaldos ?? []).filter((r) => r.referencia.trim().length > 0);
  if (validos.length === 0) errores.push('Hace falta al menos un respaldo. Sin respaldo, el cierre no se habilita.');
  return { ok: errores.length === 0, errores };
}

/** CU11: sólo el funcionario a cargo registra el cierre. */
export function rolPuedeCerrar(rol: Rol): boolean {
  return rol === 'funcionario';
}

/** CU11: registra el cierre firmado. Lanza un error si no se cumple RF18. */
export function cerrarReclamo(reclamo: Reclamo, cierre: Cierre): Reclamo {
  if (reclamo.estado === 'cerrado') throw new Error('El reclamo ya está cerrado');
  const v = puedeCerrar(cierre);
  if (!v.ok) throw new Error(v.errores.join(' '));
  return {
    ...reclamo,
    estado: 'cerrado',
    alerta: false,
    cierre,
    historial: [...reclamo.historial, { fecha: cierre.en, texto: `Cerrado por ${cierre.motivo}`, por: cierre.por, tipo: 'cierre' }],
  };
}
