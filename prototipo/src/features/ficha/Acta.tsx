/**
 * La ficha de intervención como acta (RF13): encabezado con el número de
 * registro y la identidad del lugar, caracterización del sitio, croquis con
 * los siniestros numerados y su lista, y las contramedidas (RF14). Se usa
 * igual para el borrador que se va a emitir y para la ficha ya emitida.
 */
import type { ReactNode } from 'react';
import { componentesRiesgo, formato, nombreConcentracion, reduccionEsperada } from '../../dominio';
import type { Concentracion, Contramedida } from '../../dominio';
import { AvisoSintetico, Croquis, IdentidadLugar, Mojon, Registro, RomboIndice } from '../../ui';
import { ambitoEnTexto, fechaFicha, posicionEnTexto, textoBanquina, textoCalzada, type SiniestroFicha } from './datos';
import css from './ficha.module.css';

export interface ActaProps {
  /** Número de registro, o el que recibirá al emitirse. */
  numero: ReactNode;
  /** "Emitida el 08/09/2026 por R. Quiroga" o "Borrador…". */
  registroDe: ReactNode;
  concentracion: Concentracion;
  /** Puesto actual entre las significativas del período, si figura. */
  puesto?: { n: number; de: number };
  indice: number;
  siniestros: readonly SiniestroFicha[];
  contramedidas: ReactNode;
  borrador?: boolean;
  /** Cierre de una ficha emitida: quién, cuándo, folio y línea de firma. */
  cierre?: CierreActa;
}

export interface CierreActa {
  nombre: string;
  /** "Técnico de tránsito · Ingeniería de Tránsito", si se conoce. */
  rol?: string;
  /** ISO; con hora si la ficha la guarda. */
  fecha: string;
  folio: string;
}

export function Acta({ numero, registroDe, concentracion: c, puesto, indice, siniestros, contramedidas, borrador, cierre }: ActaProps) {
  const comp = componentesRiesgo(siniestros.map((s) => s.siniestro));
  const tramo = c.unidad === 'tramo';
  const delPredominante = siniestros.filter((s) => s.siniestro.tipo === c.tipoPredominante).length;

  return (
    <article className={[css.acta, borrador && css.borrador].filter(Boolean).join(' ')} aria-labelledby="titulo-acta" data-prueba="acta">
      <header className={css.cabeza}>
        <div className={css.renglonRegistro}>
          <p className={css.numeroActa}>{numero}</p>
          <p className={css.registroDe}>{registroDe}</p>
          <AvisoSintetico />
        </div>
        <div className={css.lugar}>
          <IdentidadLugar ruta={c.ruta} calle={c.calle} tamano={48} />
          <div className={css.lugarTexto}>
            <h2 id="titulo-acta" className={css.nombreLugar}>
              {nombreConcentracion(c)}
            </h2>
            <p className={css.ambito}>
              <Registro>{c.id}</Registro> · {ambitoEnTexto(c)}
              {puesto && (
                <>
                  {' '}
                  · puesto {puesto.n} de {puesto.de} por índice
                </>
              )}
            </p>
          </div>
          {tramo && c.kmDesde !== undefined && <Mojon km={c.kmDesde} />}
          <div className={css.indice}>
            <RomboIndice valor={indice} tamano="grande" />
            <span>Índice de riesgo</span>
          </div>
        </div>
      </header>

      <div className={css.cuerpo}>
        <div className={css.columna}>
          <section className={css.seccion} aria-labelledby="titulo-sitio">
            <h3 id="titulo-sitio" className={css.h3}>
              Caracterización del sitio
            </h3>
            <dl className={css.datos}>
              <div>
                <dt>Calzada</dt>
                <dd>{textoCalzada(c)}</dd>
              </div>
              <div>
                <dt>Carriles</dt>
                <dd>{c.via.carriles}</dd>
              </div>
              <div>
                <dt>Banquina</dt>
                <dd>{textoBanquina(c)}</dd>
              </div>
              <div className={css.ancho2}>
                <dt>Tipo predominante</dt>
                <dd>
                  {c.tipoPredominante}{' '}
                  <span className={css.tenue}>
                    ({delPredominante} de {siniestros.length})
                  </span>
                </dd>
              </div>
              <div>
                <dt>Siniestros</dt>
                <dd>{siniestros.length}</dd>
              </div>
              <div>
                <dt>Fallecidos</dt>
                <dd className={comp.fallecidos > 0 ? css.fatal : undefined}>{comp.fallecidos}</dd>
              </div>
              <div>
                <dt>Víctimas vulnerables</dt>
                <dd>
                  {formato.porcentaje(comp.vulnerables)}{' '}
                  {comp.fallecidos > 0 && (
                    <span className={css.tenue}>
                      ({comp.fallecidosVulnerables} de {comp.fallecidos})
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Heridos graves</dt>
                <dd>{comp.heridosGraves}</dd>
              </div>
            </dl>
            <p className={css.nota}>Vulnerables: peatones, ciclistas y motociclistas entre las víctimas fatales.</p>
          </section>

          <section className={css.seccion} aria-labelledby="titulo-siniestros">
            <h3 id="titulo-siniestros" className={css.h3}>
              Siniestros que componen {tramo ? 'el tramo' : 'el punto'}
            </h3>
            <Croquis
              modo={tramo ? 'tramo' : 'cuadra'}
              via={c.ruta ?? c.calle ?? ''}
              desde={tramo ? c.kmDesde! : (c.altura ?? 0) - 100}
              hasta={tramo ? c.kmHasta! : (c.altura ?? 0) + 100}
              sentido={tramo ? c.localidad : undefined}
              siniestros={siniestros.map((s) => ({
                numero: s.numero,
                posicion: s.posicion,
                tipo: s.siniestro.tipo,
                fatal: s.fatal,
                descripcion: `${formato.mesAnio(s.siniestro.fechaHecho)}, ${s.descripcion}`,
              }))}
            />
            <ol className={css.siniestros} aria-label="Lista de siniestros, en el orden del croquis">
              {siniestros.map((s) => (
                <li key={s.siniestro.id} className={css.siniestro}>
                  <span className={[css.num, s.fatal && css.numFatal].filter(Boolean).join(' ')} aria-hidden="true">
                    {s.numero}
                  </span>
                  <span className={`${css.cifra} ${css.fechaSin}`}>{formato.mesAnio(s.siniestro.fechaHecho)}</span>
                  <span className={css.descSin}>
                    <span>{s.descripcion}</span>
                    <small>{s.origen}</small>
                  </span>
                  <span className={`registro ${css.posSin}`}>{posicionEnTexto(c.unidad, s.posicion)}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className={css.columna}>{contramedidas}</div>
      </div>

      <footer>
        <p className={css.pieActa}>La ficha es un insumo para la decisión del funcionario a cargo y no la reemplaza.</p>
        {cierre && <Cierre {...cierre} />}
      </footer>
    </article>
  );
}

/** Bloque de cierre, como cierra un acta: emitida por, fecha y hora, folio y firma. */
function Cierre({ nombre, rol, fecha, folio }: CierreActa) {
  return (
    <dl className={css.cierre} aria-label="Cierre del acta">
      <div>
        <dt>Emitida por</dt>
        <dd>
          {nombre}
          {rol && <small>{rol}</small>}
        </dd>
      </div>
      <div>
        <dt>{fecha.length > 10 ? 'Fecha y hora' : 'Fecha'}</dt>
        <dd className={css.cifra}>{fechaFicha(fecha)}</dd>
      </div>
      <div>
        <dt>Folio</dt>
        <dd>
          <Registro>{folio}</Registro>
        </dd>
      </div>
      <div className={css.firma}>
        <dt className="solo-lectores">Firma</dt>
        <dd className={css.lineaFirma} aria-hidden="true" />
        <dd>
          <p>Firma de {nombre} · rotulado de demostración, sin firma real</p>
        </dd>
      </div>
    </dl>
  );
}

/** Calificación del estudio, de 1 a 5, dibujada. */
export function Estrellas({ valor }: { valor: number }) {
  return (
    <span className={css.estrellas} role="img" aria-label={`calificación ${valor} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M6 1l1.5 3.1 3.4.5-2.5 2.4.6 3.4L6 8.8 2.9 10.4l.6-3.4L1 4.6l3.5-.5z"
            className={i <= valor ? css.estrellaLlena : css.estrellaVacia}
          />
        </svg>
      ))}
    </span>
  );
}

/** Datos de una contramedida: reducción esperada, calificación y referencia. */
export function DatosContramedida({ m }: { m: Contramedida }) {
  return (
    <>
      <span className={css.nombreMedida}>{m.nombre}</span>
      <span className={css.lineaMedida}>
        reducción esperada {reduccionEsperada(m)} % · <Estrellas valor={m.calificacion} />
      </span>
      <span className={css.refMedida}>Referencia: {m.referencia}</span>
    </>
  );
}

export function RotuloDemostracion() {
  return (
    <p className={css.nota}>
      <b>Factores de demostración.</b> Los factores y sus referencias son sintéticos. En el sistema, cada factor y su referencia
      bibliográfica se toman del repositorio público de factores de modificación de choques al cargar el catálogo.
    </p>
  );
}

