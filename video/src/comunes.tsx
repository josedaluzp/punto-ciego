import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { C, REGISTRO, UI } from './estilo';
import type { Capitulo } from './guion';

/** Entrada suave: sube y aparece, con `retraso` en cuadros. */
export function useEntrada(retraso = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - retraso, fps, config: { damping: 200 } });
  return { opacity: p, transform: `translateY(${interpolate(p, [0, 1], [18, 0])}px)` };
}

/** Encabezado de capítulo: número, título y casos de uso. */
export const Encabezado: React.FC<{ n: number; c: Pick<Capitulo, 'titulo' | 'casos'> }> = ({ n, c }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 24, ...useEntrada(0) }}>
    <span style={{ fontFamily: REGISTRO, fontWeight: 700, fontSize: 34, color: C.rojo }}>{String(n).padStart(2, '0')}</span>
    <span style={{ fontFamily: UI, fontWeight: 700, fontSize: 46, color: C.tinta }}>{c.titulo}</span>
    <span style={{ fontFamily: REGISTRO, fontSize: 24, color: C.tenue }}>{c.casos}</span>
  </div>
);
