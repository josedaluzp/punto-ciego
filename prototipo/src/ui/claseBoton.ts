import type { VarianteBoton } from './Boton';
import css from './Boton.module.css';

/** Enlace con aspecto de botón (para navegar, no para actuar). */
export function claseBoton(variante: VarianteBoton = 'secundario', tamano: 'normal' | 'chico' = 'normal'): string {
  return [css.boton, css[variante], tamano === 'chico' && css.chico].filter(Boolean).join(' ');
}
