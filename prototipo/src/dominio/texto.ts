/** Utilidades de texto para la extracción y la detección de duplicados. */

/** Minúsculas y sin tildes, para comparar sin depender de la escritura. */
export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

const VACIAS = new Set(
  (
    'a al ante bajo con contra de del desde durante e el en entre esta este hacia hasta la las lo los mas ' +
    'no o otra otro para pero por que se segun sin sobre su sus tras un una uno unos unas y fue era ser son habia muy'
  ).split(' '),
);

/** Palabras con contenido (tres letras o más, sin palabras vacías). */
export function tokens(s: string): Set<string> {
  const out = new Set<string>();
  for (const t of normalizar(s).split(/[^a-z0-9]+/)) {
    if (t.length >= 3 && !VACIAS.has(t)) out.add(t);
  }
  return out;
}

/** Índice de Jaccard entre los conjuntos de palabras de dos textos. */
export function jaccard(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 && tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/** Clave comparable de un nombre de calle: sin tildes ni prefijo de tipo de vía. */
export function claveCalle(nombre: string): string {
  return normalizar(nombre)
    .replace(/\b(avenida|av\.?|bulevar|boulevard|bv\.?|calle|pasaje|pje\.?)\s+/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
