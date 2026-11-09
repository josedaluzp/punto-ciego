/**
 * Resumen del lugar seleccionado (CU05 paso 5): croquis con los siniestros
 * numerados, sus datos, la fórmula del índice y la acción principal de la
 * pantalla, «Emitir ficha de intervención» (CU06).
 *
 * Navegación a la ficha: si la concentración ya tiene ficha, abre
 * `/priorizacion/fichas/<número>`; si no, va a
 * `/priorizacion/fichas/nueva?concentracion=<id>`, el borrador de la ficha
 * nueva para esa concentración (CU06).
 */
import { useNavigate } from 'react-router-dom';
import { nombreConcentracion } from '../../dominio/concentraciones';
import { decimal, fecha, km, mesAnio, plural, porcentaje, usuario } from '../../dominio/formato';
import { FRECUENCIA_REFERENCIA, PESO_HERIDO_GRAVE, PESOS, SEVERIDAD_REFERENCIA } from '../../dominio/riesgo';
import { USUARIOS_VULNERABLES, type Concentracion, type Ficha, type Siniestro, type TipoUsuario } from '../../dominio/tipos';
import { Boton, Croquis, IdentidadLugar, Mojon, Registro, RomboIndice } from '../../ui';
import css from './PaginaPriorizacion.module.css';

interface Props {
  c: Concentracion;
  rango: number;
  total: number;
  siniestros: readonly Siniestro[];
  ficha?: Ficha;
}

function contarPorTipo(tipos: readonly TipoUsuario[]): string {
  const cuenta = new Map<TipoUsuario, number>();
  for (const t of tipos) cuenta.set(t, (cuenta.get(t) ?? 0) + 1);
  return [...cuenta].map(([t, n]) => usuario(t, n)).join(', ');
}

function victimas(s: Siniestro): string {
  const fatales = s.victimas.filter((v) => v.gravedad === 'fallecido').map((v) => v.tipoUsuario);
  const graves = s.victimas.filter((v) => v.gravedad === 'herido-grave').length;
  const partes = [];
  if (fatales.length) partes.push(contarPorTipo(fatales));
  if (graves) partes.push(plural(graves, 'herido grave', 'heridos graves'));
  return partes.join(' · ');
}

export function PanelLugar({ c, rango, total, siniestros, ficha }: Props) {
  const navigate = useNavigate();
  const tramo = c.unidad === 'tramo';
  const porId = new Map(siniestros.map((s) => [s.id, s]));
  const propios = c.siniestroIds
    .map((id) => porId.get(id))
    .filter((s): s is Siniestro => s !== undefined)
    .sort((a, b) => a.fechaHecho.localeCompare(b.fechaHecho));
  const posicion = (s: Siniestro) => (tramo ? (s.ubicacion?.km ?? c.kmDesde ?? 0) : (s.lugarExtraido?.altura ?? c.altura ?? 0));
  const nombre = nombreConcentracion(c);
  const vulnerablesFatales = propios.flatMap((s) =>
    s.victimas.filter((v) => v.gravedad === 'fallecido' && USUARIOS_VULNERABLES.includes(v.tipoUsuario)).map((v) => v.tipoUsuario),
  );

  const emitir = () => {
    if (ficha) navigate(`/priorizacion/fichas/${ficha.numero}`);
    else navigate(`/priorizacion/fichas/nueva?concentracion=${encodeURIComponent(c.id)}`);
  };

  const resumen = [plural(propios.length, 'siniestro'), plural(c.fallecidos, 'fallecido'), vulnerablesFatales.length ? contarPorTipo(vulnerablesFatales) : null]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className={css.panel} aria-labelledby="lugar-seleccionado" data-prueba="lugar-seleccionado">
      <header className={css.panelCabecera}>
        <IdentidadLugar ruta={c.ruta} calle={c.calle} tamano={40} />
        <div className={css.panelTitulo}>
          <h2 id="lugar-seleccionado" className={css.h2}>
            {nombre}
          </h2>
          <p className={css.lugarSub}>
            <Registro>{c.id}</Registro> · {tramo ? 'tramo de 1 km sobre ruta' : 'punto sobre calle'} · {c.localidad} · rango {rango} de {total}
          </p>
        </div>
        {tramo && c.kmDesde !== undefined && <Mojon km={c.kmDesde} />}
        <RomboIndice valor={c.indice} tamano="grande" />
      </header>

      <div className={css.panelCuerpo}>
        <div className={css.croquis}>
          <Croquis
            modo={tramo ? 'tramo' : 'cuadra'}
            via={c.ruta ?? c.calle ?? c.localidad}
            desde={tramo ? c.kmDesde! : (c.altura ?? 0) - 100}
            hasta={tramo ? c.kmHasta! : (c.altura ?? 0) + 100}
            sentido={tramo ? c.localidad : undefined}
            siniestros={propios.map((s, i) => ({
              numero: i + 1,
              posicion: posicion(s),
              tipo: s.tipo,
              fatal: s.victimas.some((v) => v.gravedad === 'fallecido'),
              descripcion: `${mesAnio(s.fechaHecho)} ${s.tipo ?? 'tipo sin determinar'}, ${victimas(s)}`,
            }))}
          />
          <ol className={css.siniestros} aria-label="Siniestros del lugar">
            {propios.map((s, i) => {
              const fatal = s.victimas.some((v) => v.gravedad === 'fallecido');
              return (
                <li key={s.id} className={css.siniestro}>
                  <span className={css.numero} data-fatal={fatal || undefined} aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>{mesAnio(s.fechaHecho)}</span>
                  <span className={css.siniestroTexto}>
                    {s.tipo ?? 'tipo sin determinar'}
                    {victimas(s) && <span className={css.tenue}> · {victimas(s)}</span>}
                  </span>
                  {tramo ? <span className="registro">{km(posicion(s))}</span> : <span>al {posicion(s)}</span>}
                </li>
              );
            })}
          </ol>
        </div>

        <div className={css.datos}>
          <p className={css.resumen}>
            <b>{resumen}</b>
            <span className={css.tenue}>Los reclamos vecinales no intervienen en este orden.</span>
          </p>
          <dl className={css.kv}>
            <dt>Fallecidos</dt>
            <dd>{c.fallecidos}</dd>
            <dt>Heridos graves</dt>
            <dd>{c.heridosGraves}</dd>
            <dt>Vulnerables</dt>
            <dd>{porcentaje(c.vulnerables)}</dd>
          </dl>
          <p className={css.predominante}>
            Tipo predominante: <b>{c.tipoPredominante}</b> ({c.cantidadPredominante} de {propios.length})
          </p>
          <details className={css.formula}>
            <summary>Cómo se calcula el índice</summary>
            <p className={css.formulaLinea}>
              índice = {decimal(PESOS.severidad, 1)} · severidad + {decimal(PESOS.frecuencia, 1)} · frecuencia + {decimal(PESOS.vulnerables, 1)} · vulnerables
            </p>
            <p className={css.formulaLinea} data-prueba="formula-lugar">
              {decimal(c.indice)} = {decimal(PESOS.severidad, 1)} · {decimal(c.severidad)} + {decimal(PESOS.frecuencia, 1)} · {decimal(c.frecuencia)} +{' '}
              {decimal(PESOS.vulnerables, 1)} · {decimal(c.vulnerables)}
            </p>
            <ul className={css.formulaNotas}>
              <li>
                Severidad: fallecidos más {decimal(PESO_HERIDO_GRAVE, 1)} por herido grave, sobre {decimal(SEVERIDAD_REFERENCIA, 1)}.
              </li>
              <li>Frecuencia: siniestros del período, sobre {decimal(FRECUENCIA_REFERENCIA, 1)}.</li>
              <li>Vulnerables: proporción de víctimas fatales que eran peatones, ciclistas o motociclistas.</li>
              <li>Los reclamos vecinales no intervienen en el índice. Referencias calibradas sobre datos sintéticos.</li>
            </ul>
          </details>
          <div className={css.accion}>
            {ficha && (
              <p className={css.tenue} data-prueba="ficha-vigente">
                Ficha vigente <Registro>{ficha.numero}</Registro>, emitida el {fecha(ficha.fecha)}.
              </p>
            )}
            <Boton variante="primario" onClick={emitir} ancho>
              Emitir ficha de intervención
            </Boton>
          </div>
        </div>
      </div>
    </section>
  );
}
