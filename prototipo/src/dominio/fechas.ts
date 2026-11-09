/** Fechas ISO (`AAAA-MM-DD`) sin zona horaria: se opera en días UTC. */

const MS_DIA = 86_400_000;

export function aDia(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number);
  return Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1) / MS_DIA;
}

export function deDia(n: number): string {
  return new Date(n * MS_DIA).toISOString().slice(0, 10);
}

export function sumarDias(iso: string, dias: number): string {
  return deDia(aDia(iso) + dias);
}

/** Días enteros de `desde` a `hasta` (positivo si `hasta` es posterior). */
export function diasEntre(desde: string, hasta: string): number {
  return aDia(hasta) - aDia(desde);
}

/** 0 = domingo … 6 = sábado. */
export function diaSemana(iso: string): number {
  return new Date(aDia(iso) * MS_DIA).getUTCDay();
}

export function anio(iso: string): number {
  return Number(iso.slice(0, 4));
}

export function esFechaValida(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return deDia(aDia(iso)) === iso;
}
