/**
 * Íconos dibujados a mano, un solo trazo de 1,7 px sobre una caja de 20.
 * Para agregar uno: sumar su trazo a TRAZOS.
 */
import type { SVGProps } from 'react';

const TRAZOS = {
  /** Marca de Punto Ciego: un cuadrante de reloj, el tiempo que pasó sin respuesta. */
  marca: <><circle cx="10" cy="10" r="7" /><path d="M10 3v7l5 2" /></>,
  menu: <path d="M3 6h14M3 10h14M3 14h14" />,
  cerrar: <path d="M5 5l10 10M15 5L5 15" />,
  mas: <path d="M10 4v12M4 10h12" />,
  menos: <path d="M4 10h12" />,
  encuadre: <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />,
  restablecer: <><path d="M4 10a6 6 0 1 0 1.8-4.3" /><path d="M4 3v3.7h3.7" /></>,
  externo: <><path d="M11 4h5v5" /><path d="M16 4l-7 7" /><path d="M14 12v4H4V6h4" /></>,
  alerta: <><path d="M10 3l8 14H2z" /><path d="M10 8v4M10 14.5v.5" /></>,
  ok: <path d="M4 10.5l4 4 8-9" />,
  documento: <><path d="M5 2.5h7l3 3v12H5z" /><path d="M8 9h5M8 12h5M8 15h3" /></>,
  ubicacion: <><path d="M10 18s5.5-5.2 5.5-9.5a5.5 5.5 0 0 0-11 0C4.5 12.8 10 18 10 18z" /><circle cx="10" cy="8.5" r="2" /></>,
  foto: <><rect x="2.5" y="5" width="15" height="11" rx="1.5" /><circle cx="10" cy="10.5" r="3" /><path d="M7 5l1.2-2h3.6L13 5" /></>,
  usuario: <><circle cx="10" cy="7" r="3.2" /><path d="M3.5 17c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5" /></>,
  flecha: <path d="M4 10h12M11 5l5 5-5 5" />,
  atras: <path d="M16 10H4M9 5l-5 5 5 5" />,
  descarga: <><path d="M10 3v10M5.5 8.5L10 13l4.5-4.5" /><path d="M4 17h12" /></>,
  calendario: <><rect x="3" y="4.5" width="14" height="12.5" rx="1" /><path d="M3 8.5h14M7 2.5v4M13 2.5v4" /></>,
  firma: <><path d="M3 15c2-1 3.5-6 5-6s.5 5 2 5 2.5-3 4-3 2 2 3 2" /><path d="M3 18h14" /></>,
} as const;

export type NombreIcono = keyof typeof TRAZOS;

interface IconoProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  nombre: NombreIcono;
  tamano?: number;
  /** Texto para lectores de pantalla; sin él, el ícono es decorativo. */
  titulo?: string;
}

export function Icono({ nombre, tamano = 18, titulo, ...resto }: IconoProps) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={titulo ? undefined : true}
      role={titulo ? 'img' : undefined}
      aria-label={titulo}
      focusable="false"
      {...resto}
    >
      {TRAZOS[nombre]}
    </svg>
  );
}
