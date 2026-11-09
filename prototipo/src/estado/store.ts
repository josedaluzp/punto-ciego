/**
 * Store único de la demo, persistido en localStorage bajo `punto-ciego:v1`.
 *
 * El estado son DATOS (crónicas, siniestros, reclamos, fichas, registro de
 * números) más el usuario de demostración elegido. Las acciones viven fuera
 * del store, en `src/estado/acciones/<feature>.ts`, como funciones que llaman
 * a `useDemo.setState`; así cada feature agrega las suyas sin tocar este
 * archivo. Las concentraciones no se guardan: se recalculan desde los
 * siniestros confirmados (ver `selectores.ts`).
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { semilla, type DatosDemo } from '../datos/semilla';
import { USUARIO_PREDETERMINADO } from '../datos/usuarios';

export const CLAVE_ALMACENAMIENTO = 'punto-ciego:v1';
export const VERSION_DATOS = 1;

export interface EstadoDemo extends DatosDemo {
  usuarioId: string;
}

function hayDatosGuardados(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(CLAVE_ALMACENAMIENTO) !== null;
  } catch {
    return false;
  }
}

const VACIO: DatosDemo = { cronicas: [], siniestros: [], reclamos: [], fichas: [], registroConcentraciones: {} };

/** Estado inicial: la semilla, salvo que haya datos guardados (que se cargan enseguida). */
export function estadoInicial(): EstadoDemo {
  return { ...(hayDatosGuardados() ? VACIO : semilla()), usuarioId: USUARIO_PREDETERMINADO };
}

export const useDemo = create<EstadoDemo>()(
  persist(() => estadoInicial(), {
    name: CLAVE_ALMACENAMIENTO,
    version: VERSION_DATOS,
    storage: createJSONStorage(() => localStorage),
    onRehydrateStorage: () => (estado, error) => {
      // Datos ilegibles o vacíos: se vuelve a la semilla. La hidratación corre
      // mientras se crea el store, así que la corrección se difiere un turno.
      if (error || !estado || estado.siniestros.length === 0) {
        queueMicrotask(() => useDemo.setState({ ...semilla() }));
      }
    },
  }),
);

// Primera visita: la semilla queda guardada desde el comienzo.
if (!hayDatosGuardados()) useDemo.setState((e) => ({ ...e }));

/** Restablece los datos de demostración; conserva el usuario elegido. */
export function restablecerDatos(): void {
  useDemo.setState({ ...semilla() });
}
