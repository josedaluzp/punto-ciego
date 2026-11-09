/** Formatos de presentación en español de la Argentina. */

/** 0.91 → "0,91". */
export function decimal(v: number, digitos = 2): string {
  return v.toFixed(digitos).replace('.', ',');
}

/** 0.8 → "80 %". */
export function porcentaje(v: number): string {
  return `${Math.round(v * 100)} %`;
}

/** "2026-09-09" → "09/09/2026". */
export function fecha(iso: string): string {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
}

/** "2026-09-09" → "09/09". */
export function fechaCorta(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}`;
}

/** "2022-03-14" → "03/2022". */
export function mesAnio(iso: string): string {
  const [a, m] = iso.slice(0, 10).split('-');
  return `${m}/${a}`;
}

/** "2026-09-09T10:42:00" → "10:42". */
export function hora(iso: string): string {
  return iso.slice(11, 16);
}

/** 694.3 → "km 694,3"; 694 → "km 694". */
export function km(v: number): string {
  return `km ${Number.isInteger(v) ? v : decimal(v, 1)}`;
}

/** 1228 → "1.228". */
export function miles(v: number): string {
  return Math.round(v)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** plural(2, 'siniestro') → "2 siniestros". */
export function plural(n: number, singular: string, pluralForma = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForma}`;
}

const ETIQUETA_USUARIO = {
  peaton: ['peatón', 'peatones'],
  ciclista: ['ciclista', 'ciclistas'],
  motociclista: ['motociclista', 'motociclistas'],
  conductor: ['conductor', 'conductores'],
  acompanante: ['acompañante', 'acompañantes'],
} as const;

/** "motociclista" / "2 motociclistas". */
export function usuario(tipo: keyof typeof ETIQUETA_USUARIO, cantidad = 1): string {
  const [s, p] = ETIQUETA_USUARIO[tipo];
  return cantidad === 1 ? s : `${cantidad} ${p}`;
}
