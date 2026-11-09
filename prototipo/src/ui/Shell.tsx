/**
 * Marco de las pantallas del organismo: riel azul marino con los tres
 * paquetes del modelo UML (Siniestros, Priorización, Reclamos) y sus
 * cantidades vivas, aviso de datos sintéticos y restablecimiento al pie;
 * barra superior con el título, el código del caso de uso en Courier Prime y
 * el selector del usuario de demostración.
 *
 * En pantallas angostas el riel se pliega en una barra con menú.
 */
import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { USUARIOS } from '../datos/usuarios';
import { miles } from '../dominio/formato';
import { cambiarUsuario, restablecerDatos } from '../estado/acciones/base';
import { useConteos, useUsuario } from '../estado/selectores';
import { AvisoSintetico } from './Estado';
import { Icono } from './Icono';
import { avisar } from './avisos';
import css from './Shell.module.css';

export interface ShellProps {
  /** Título de la pantalla: "Lugares priorizados". */
  titulo: string;
  /** Código del caso de uso: "CU05" o "CU06 · CU07". */
  cu: string;
  /** Texto que sigue al código: "38 concentraciones significativas". */
  detalle?: ReactNode;
  /** Acciones de la pantalla, a la derecha del título. */
  acciones?: ReactNode;
  children: ReactNode;
}

interface Entrada {
  a: string;
  texto: string;
  cantidad: number;
  activa: (ruta: string, busqueda: string) => boolean;
}

/** Números de registro (C-0007, FI-2026-0042, PN-2026-0131, S-0472, OT-…) dentro de un texto. */
const NUMERO_REGISTRO = /\b((?:[A-Z]{1,2}|OT)-\d{4}(?:-\d{4})?)\b/g;

/**
 * El detalle de la barra va en Archivo con cifras tabulares; sólo los números
 * de registro que aparezcan en él van en Courier Prime.
 */
function conRegistros(detalle: ReactNode): ReactNode {
  if (typeof detalle !== 'string') return detalle;
  const partes = detalle.split(NUMERO_REGISTRO);
  return partes.map((p, i) =>
    i % 2 === 1 ? (
      <span key={i} className="registro">
        {p}
      </span>
    ) : (
      p
    ),
  );
}

export function Shell({ titulo, cu, detalle, acciones, children }: ShellProps) {
  const conteos = useConteos();
  const usuario = useUsuario();
  const { pathname, search } = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const idMenu = useId();
  const idUsuario = useId();

  useEffect(() => {
    document.title = `${titulo} · Punto Ciego`;
  }, [titulo]);

  useEffect(() => setMenuAbierto(false), [pathname, search]);

  const paquetes: { nombre: string; entradas: Entrada[] }[] = [
    {
      nombre: 'Siniestros',
      entradas: [
        { a: '/siniestros/cronicas', texto: 'Crónicas', cantidad: conteos.cronicas, activa: (r) => r.startsWith('/siniestros/cronicas') },
        { a: '/siniestros/revision', texto: 'En revisión', cantidad: conteos.enRevision, activa: (r) => r.startsWith('/siniestros/revision') },
      ],
    },
    {
      nombre: 'Priorización',
      entradas: [
        { a: '/priorizacion', texto: 'Lugares priorizados', cantidad: conteos.lugares, activa: (r) => r === '/priorizacion' },
        { a: '/priorizacion/fichas', texto: 'Fichas emitidas', cantidad: conteos.fichas, activa: (r) => r.startsWith('/priorizacion/fichas') },
      ],
    },
    {
      nombre: 'Reclamos',
      entradas: [
        {
          a: '/reclamos',
          texto: 'Desatendidos',
          cantidad: conteos.desatendidos,
          activa: (r, b) => r.startsWith('/reclamos') && !b.includes('vista=todos'),
        },
        { a: '/reclamos?vista=todos', texto: 'Todos', cantidad: conteos.reclamos, activa: (r, b) => r.startsWith('/reclamos') && b.includes('vista=todos') },
      ],
    },
  ];

  const restablecer = () => {
    restablecerDatos();
    avisar('Datos de demostración restablecidos', { tono: 'exito', detalle: 'Se volvió al estado inicial de la semilla.' });
  };

  return (
    <div className={css.shell}>
      <aside className={css.riel}>
        <div className={css.cabezaRiel}>
          <Link to="/priorizacion" className={css.marca}>
            <Icono nombre="marca" tamano={20} />
            <span>Punto Ciego</span>
          </Link>
          <span className={css.sinteticoPlegado}>
            Datos sintéticos
          </span>
          <button
            type="button"
            className={css.botonMenu}
            aria-expanded={menuAbierto}
            aria-controls={idMenu}
            onClick={() => setMenuAbierto((v) => !v)}
          >
            <Icono nombre={menuAbierto ? 'cerrar' : 'menu'} tamano={18} />
            <span>Menú</span>
          </button>
        </div>
        <div id={idMenu} className={[css.cuerpoRiel, menuAbierto && css.abierto].filter(Boolean).join(' ')}>
          <nav aria-label="Paquetes del sistema" className={css.nav}>
            {paquetes.map((p) => (
              <div key={p.nombre} className={css.paquete}>
                <p className={css.nombrePaquete}>{p.nombre}</p>
                <ul>
                  {p.entradas.map((e) => {
                    const activa = e.activa(pathname, search);
                    return (
                      <li key={e.a}>
                        <Link to={e.a} className={[css.entrada, activa && css.activa].filter(Boolean).join(' ')} aria-current={activa ? 'page' : undefined}>
                          <span>{e.texto}</span>
                          <span className={css.cantidad}>{miles(e.cantidad)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
          <div className={css.pieRiel}>
            <Link to="/reclamo" className={css.vecino}>
              <span>Formulario del vecino</span>
              <Icono nombre="externo" tamano={15} />
            </Link>
            <AvisoSintetico variante="riel" />
            <button type="button" className={css.restablecer} onClick={restablecer}>
              <Icono nombre="restablecer" tamano={15} />
              <span>Restablecer datos de demostración</span>
            </button>
          </div>
        </div>
      </aside>

      <div className={css.principal}>
        <header className={css.barra}>
          <div className={css.titulos}>
            <h1 className={css.titulo}>{titulo}</h1>
            <p className={css.cu}>
              {cu}
              {detalle && <> · {conRegistros(detalle)}</>}
            </p>
          </div>
          {acciones && <div className={css.acciones}>{acciones}</div>}
          <div className={css.usuario}>
            <label htmlFor={idUsuario} className="solo-lectores">
              Usuario de demostración
            </label>
            <Icono nombre="usuario" tamano={16} className={css.iconoUsuario} />
            <select id={idUsuario} className={css.selectUsuario} value={usuario.id} onChange={(e) => cambiarUsuario(e.target.value)}>
              {USUARIOS.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} · {u.cargo}
                </option>
              ))}
            </select>
          </div>
        </header>
        <main className={css.contenido} id="contenido">
          {children}
        </main>
      </div>
    </div>
  );
}

/**
 * Marco de la cara pública (el vecino, desde el teléfono): sin el riel del
 * organismo, una columna angosta y el aviso de datos sintéticos al pie.
 */
export function ShellPublico({ titulo, children }: { titulo: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${titulo} · Punto Ciego`;
  }, [titulo]);
  return (
    <div className={css.publico}>
      <header className={css.barraPublica}>
        <span className={css.marcaPublica}>
          <Icono nombre="marca" tamano={18} />
          <span>Punto Ciego</span>
        </span>
        <span className={css.areaPublica}>Área técnica de tránsito</span>
      </header>
      <main className={css.columnaPublica} id="contenido">
        {children}
      </main>
      <footer className={css.piePublico}>
        <AvisoSintetico variante="banda" />
      </footer>
    </div>
  );
}
