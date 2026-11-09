import '@fontsource/archivo/400.css';
import '@fontsource/archivo/600.css';
import '@fontsource/archivo/700.css';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/700.css';

/** Los mismos tokens que prototipo/src/ui/tokens.css: el video habla con la voz de la app. */
export const C = {
  papel: 'oklch(0.993 0.002 250)',
  grilla: 'oklch(0.93 0.012 250)',
  tinta: 'oklch(0.25 0.03 262)',
  tenue: 'oklch(0.47 0.02 262)',
  linea: 'oklch(0.86 0.015 262)',
  carbon: 'oklch(0.4 0.14 264)',
  rojo: 'oklch(0.53 0.19 27)',
  amarillo: 'oklch(0.87 0.17 93)',
  riel: 'oklch(0.27 0.045 264)',
  rielTexto: 'oklch(0.93 0.02 264)',
  rielTenue: 'oklch(0.74 0.04 264)',
};

export const UI = "'Archivo', system-ui, sans-serif";
export const REGISTRO = "'Courier Prime', ui-monospace, monospace";

/** Papel cuadriculado de la app, en un módulo de 24 px. */
export const PAPEL: React.CSSProperties = {
  backgroundColor: C.papel,
  backgroundImage: `linear-gradient(${C.grilla} 1px, transparent 1px), linear-gradient(90deg, ${C.grilla} 1px, transparent 1px)`,
  backgroundSize: '24px 24px',
};
