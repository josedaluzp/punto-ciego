import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Icono, type NombreIcono } from './Icono';
import css from './Boton.module.css';
import { claseBoton } from './claseBoton';

export type VarianteBoton = 'primario' | 'secundario' | 'peligro' | 'fantasma';

export interface BotonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBoton;
  tamano?: 'normal' | 'chico';
  icono?: NombreIcono;
  /** Ocupa todo el ancho del contenedor. */
  ancho?: boolean;
  /** Muestra que la acción está en curso y la deshabilita. */
  cargando?: boolean;
  children: ReactNode;
}

/** Botón de la demo. La acción principal de cada pantalla es `primario` (tinta carbónica). */
export const Boton = forwardRef<HTMLButtonElement, BotonProps>(function Boton(
  { variante = 'secundario', tamano = 'normal', icono, ancho, cargando, disabled, className, children, type = 'button', ...resto },
  ref,
) {
  const clases = [claseBoton(variante, tamano), ancho && css.ancho, className].filter(Boolean).join(' ');
  return (
    <button ref={ref} type={type} className={clases} disabled={disabled || cargando} aria-busy={cargando || undefined} {...resto}>
      {icono && <Icono nombre={icono} tamano={tamano === 'chico' ? 15 : 17} />}
      <span>{children}</span>
    </button>
  );
});
