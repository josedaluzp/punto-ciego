/**
 * CU04 Actualizar concentraciones de riesgo. Las concentraciones no se
 * guardan (se derivan de los siniestros confirmados, ver `selectores.ts`);
 * lo que se guarda es el último cálculo pedido por el analista, para poder
 * informar qué cambió desde entonces (curso alternativo 1.a: recálculo
 * completo de la provincia tras corregir ubicaciones).
 *
 * Vive en su propia clave de localStorage para no tocar el store de la base.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { diferencias, resumir, type Diferencias, type LugarCalculado } from '../../features/priorizacion/diferencias';
import type { Concentracion } from '../../dominio/tipos';
import { almacenamientoNavegador } from '../almacenamiento';
import { ahora } from '../reloj';
import type { Periodo } from '../selectores';

export const CLAVE_CALCULO = 'punto-ciego:v1:ultimo-calculo';

export interface Calculo {
  en: string;
  por: string;
  periodo: Periodo;
  lugares: LugarCalculado[];
}

interface EstadoCalculo {
  ultimo: Calculo | null;
}

export const useUltimoCalculo = create<EstadoCalculo>()(
  persist(() => ({ ultimo: null as Calculo | null }), {
    name: CLAVE_CALCULO,
    version: 1,
    storage: createJSONStorage(almacenamientoNavegador),
  }),
);

/** Primer cálculo registrado al abrir la pantalla, si todavía no hay ninguno. */
export function registrarCalculoInicial(cs: readonly Concentracion[], periodo: Periodo, por: string): void {
  if (useUltimoCalculo.getState().ultimo) return;
  useUltimoCalculo.setState({
    ultimo: { en: ahora(), por, periodo: { ...periodo }, lugares: resumir(cs) },
  });
}

export interface ResultadoActualizacion {
  calculo: Calculo;
  anterior: Calculo | null;
  diferencias: Diferencias;
}

/** Recalcula (las concentraciones recibidas ya son el recálculo) y deja registrado quién y cuándo. */
export function actualizarConcentraciones(cs: readonly Concentracion[], periodo: Periodo, por: string): ResultadoActualizacion {
  const anterior = useUltimoCalculo.getState().ultimo;
  const calculo: Calculo = {
    en: ahora(),
    por,
    periodo: { ...periodo },
    lugares: resumir(cs),
  };
  useUltimoCalculo.setState({ ultimo: calculo });
  return {
    calculo,
    anterior,
    diferencias: diferencias(anterior?.lugares ?? [], calculo.lugares),
  };
}
