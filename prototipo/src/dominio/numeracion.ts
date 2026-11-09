/** Numeración de registros: "PN-2026-0131", "FI-2026-0042". */

export type PrefijoRegistro = 'PN' | 'FI';

export function formatearNumero(prefijo: PrefijoRegistro, anio: number, n: number): string {
  return `${prefijo}-${anio}-${String(n).padStart(4, '0')}`;
}

export function parsearNumero(numero: string): { prefijo: string; anio: number; n: number } | null {
  const m = /^([A-Z]{2})-(\d{4})-(\d{4,})$/.exec(numero);
  return m ? { prefijo: m[1]!, anio: Number(m[2]), n: Number(m[3]) } : null;
}

/** Siguiente número libre del año para ese prefijo. */
export function siguienteNumero(prefijo: PrefijoRegistro, anio: number, existentes: readonly string[]): string {
  let max = 0;
  for (const e of existentes) {
    const p = parsearNumero(e);
    if (p && p.prefijo === prefijo && p.anio === anio) max = Math.max(max, p.n);
  }
  return formatearNumero(prefijo, anio, max + 1);
}
