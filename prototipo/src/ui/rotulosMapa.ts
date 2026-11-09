/**
 * Ubicación de los rótulos del mapa de la provincia (ciudades y rutas) para
 * que no se pisen entre sí ni tapen los marcadores. Sin React: recibe cajas
 * en unidades del plano y devuelve dónde va cada texto.
 *
 * - Ciudad: a la derecha del punto; si choca, a la izquierda, arriba o abajo.
 * - Ruta: en su posición de siempre; si choca, en el punto libre de su traza
 *   más cercano a esa posición.
 */

export interface Caja {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Rotulo {
  texto: string;
  x: number;
  /** Línea de base. */
  y: number;
  ancla: 'start' | 'end' | 'middle';
}

export interface CiudadMapa {
  nombre: string;
  x: number;
  y: number;
}

export interface RutaMapa {
  ref: string;
  lx: number;
  ly: number;
  /** Puntos de la traza, para buscar dónde correr el rótulo. */
  puntos: readonly { x: number; y: number }[];
}

/** Ancho aproximado de un texto de Archivo: 0,58 em por carácter (0,62 en negrita). */
export function anchoTexto(texto: string, fuente: number, negrita = false): number {
  return texto.length * fuente * (negrita ? 0.62 : 0.58);
}

export function cajaDeRotulo(r: Rotulo, fuente: number, negrita = false): Caja {
  const w = anchoTexto(r.texto, fuente, negrita);
  const x = r.ancla === 'start' ? r.x : r.ancla === 'end' ? r.x - w : r.x - w / 2;
  return { x, y: r.y - fuente * 0.8, w, h: fuente };
}

export function seTocan(a: Caja, b: Caja, holgura = 0): boolean {
  return a.x - holgura < b.x + b.w && b.x - holgura < a.x + a.w && a.y - holgura < b.y + b.h && b.y - holgura < a.y + a.h;
}

function adentro(c: Caja, marco: Caja): boolean {
  return c.x >= marco.x && c.y >= marco.y && c.x + c.w <= marco.x + marco.w && c.y + c.h <= marco.y + marco.h;
}

/** Puntos (x, y) de un `d` hecho de M y L absolutos. */
export function puntosDeTraza(d: string): { x: number; y: number }[] {
  const puntos: { x: number; y: number }[] = [];
  const re = /[ML]\s*(-?[\d.]+)[ ,](-?[\d.]+)/g;
  for (let m = re.exec(d); m; m = re.exec(d)) puntos.push({ x: Number(m[1]), y: Number(m[2]) });
  return puntos;
}

/**
 * `k`: unidades del plano por píxel de pantalla. `marcadores`: cajas de los
 * marcadores (y sus rótulos) que ningún nombre debe tapar. `marco`: lo que se
 * ve del mapa; un rótulo que no entra se prueba en otra posición.
 */
export function ubicarRotulos(
  ciudades: readonly CiudadMapa[],
  rutas: readonly RutaMapa[],
  marcadores: readonly Caja[],
  k: number,
  marco: Caja,
): { ciudades: Rotulo[]; rutas: Rotulo[] } {
  const fuenteCiudad = 10 * k;
  const fuenteRuta = 9.5 * k;
  const holgura = 2 * k;
  const puntos: Caja[] = ciudades.map((c) => ({ x: c.x - 3 * k, y: c.y - 3 * k, w: 6 * k, h: 6 * k }));
  const ocupadas: Caja[] = [...marcadores, ...puntos];
  const libre = (c: Caja, propio?: Caja) => adentro(c, marco) && ocupadas.every((o) => o === propio || !seTocan(c, o, holgura));

  const rotCiudades: Rotulo[] = ciudades.map((c, i) => {
    const d = 5 * k;
    const candidatos: Rotulo[] = [
      { texto: c.nombre, x: c.x + d, y: c.y + 3.5 * k, ancla: 'start' },
      { texto: c.nombre, x: c.x - d, y: c.y + 3.5 * k, ancla: 'end' },
      { texto: c.nombre, x: c.x, y: c.y - d, ancla: 'middle' },
      { texto: c.nombre, x: c.x, y: c.y + d + fuenteCiudad * 0.8, ancla: 'middle' },
    ];
    const elegido = candidatos.find((r) => libre(cajaDeRotulo(r, fuenteCiudad), puntos[i])) ?? candidatos[0]!;
    ocupadas.push(cajaDeRotulo(elegido, fuenteCiudad));
    return elegido;
  });

  const rotRutas: Rotulo[] = rutas.map((r) => {
    const original: Rotulo = { texto: r.ref, x: r.lx, y: r.ly, ancla: 'start' };
    let elegido = original;
    if (!libre(cajaDeRotulo(original, fuenteRuta, true))) {
      // Puntos de la traza ordenados por cercanía al lugar de siempre; el
      // rótulo se apoya a la derecha del punto, apenas por encima.
      const cercanos = r.puntos
        .map((p) => ({ p, d: Math.hypot(p.x - r.lx, p.y - r.ly) }))
        .sort((a, b) => a.d - b.d);
      for (const { p } of cercanos) {
        const prueba: Rotulo = { texto: r.ref, x: p.x + 4 * k, y: p.y - 3 * k, ancla: 'start' };
        if (libre(cajaDeRotulo(prueba, fuenteRuta, true))) {
          elegido = prueba;
          break;
        }
      }
    }
    ocupadas.push(cajaDeRotulo(elegido, fuenteRuta, true));
    return elegido;
  });

  return { ciudades: rotCiudades, rutas: rotRutas };
}
