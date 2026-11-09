/**
 * CU03 Revisar ubicación de baja confianza (RF08, RF09), Figura 16.
 *
 * A la izquierda, las ubicaciones que quedaron por debajo del umbral; a la
 * derecha, la elegida con su crónica y el mapa para confirmarla, corregirla o
 * descartarla. Al confirmar o corregir corren CU04 (las concentraciones se
 * recalculan) y CU09 (las alertas que emita se avisan y se enlazan).
 */
import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { formato, nombreConcentracion, UMBRAL_CONFIANZA, type AlertaEmitida, type Siniestro, type Ubicacion } from '../../dominio';
import { resolverRevision, type DecisionRevision } from '../../estado/acciones/revision';
import { concentracionesDe, useUsuario } from '../../estado/selectores';
import { useDemo } from '../../estado/store';
import { avisar, ChipEstado, claseBoton, IdentidadLugar, Registro, Shell, Vacio } from '../../ui';
import { DetalleRevision } from './DetalleRevision';
import { cronicaDe, etiquetaPrecision, momento, nombreLugar, resultadoRevision, resumenMotivo, type ResultadoRevision } from './presentacion';
import css from './revision.module.css';

type ConUbicacion = Siniestro & { ubicacion: Ubicacion };

/** Período que incluye los hechos de 2026, para decir en qué concentración entra el siniestro. */
const PERIODO_COMPLETO = { desde: 2021, hasta: 2026 };

interface Ultima {
  siniestroId: string;
  nombre: string;
  resultado: ResultadoRevision;
  alertas: AlertaEmitida[];
}

const VERBO: Record<ResultadoRevision, string> = {
  confirmada: 'confirmada',
  corregida: 'corregida y confirmada',
  descartada: 'descartada',
};

/** Escudo de ruta o chapa de calle del lugar, en el tamaño de la lista. */
function IdentidadDe({ s }: { s: ConUbicacion }) {
  return (
    <span className={css.itemIdentidad}>
      <IdentidadLugar ruta={s.ubicacion.ruta ?? s.lugarExtraido?.ruta} calle={s.lugarExtraido?.calle} tamano={28} />
    </span>
  );
}

function textoAlerta(a: AlertaEmitida): string {
  return a.tipo === 'cierre-desmentido' ? `Cierre desmentido por siniestro: ${a.reclamo}` : `Alerta de reclamo desatendido: ${a.reclamo}`;
}

export function PaginaRevision() {
  const siniestros = useDemo((e) => e.siniestros);
  const cronicas = useDemo((e) => e.cronicas);
  const registro = useDemo((e) => e.registroConcentraciones);
  const usuario = useUsuario();
  const [elegido, setElegido] = useState<string | null>(null);
  const [ultima, setUltima] = useState<Ultima | null>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);

  const pendientes = useMemo(
    () =>
      siniestros
        .filter((s): s is ConUbicacion => s.ubicacion?.estado === 'en-revision')
        .sort((a, b) => a.fechaHecho.localeCompare(b.fechaHecho) || a.id.localeCompare(b.id)),
    [siniestros],
  );
  const revisadas = useMemo(
    () =>
      siniestros
        .filter((s): s is ConUbicacion => !!s.ubicacion?.revisadaEn && resultadoRevision(s.ubicacion) !== null)
        .sort((a, b) => b.ubicacion.revisadaEn!.localeCompare(a.ubicacion.revisadaEn!))
        .slice(0, 6),
    [siniestros],
  );
  const sel = pendientes.find((s) => s.id === elegido) ?? pendientes[0] ?? null;

  /** Concentración que integra el último siniestro confirmado (CU04), si es significativa. */
  const concentracion = useMemo(() => {
    if (!ultima || ultima.resultado === 'descartada') return null;
    return concentracionesDe({ siniestros, registroConcentraciones: registro }, PERIODO_COMPLETO).find((c) => c.siniestroIds.includes(ultima.siniestroId)) ?? null;
  }, [ultima, siniestros, registro]);

  const decidir = (s: ConUbicacion, decision: DecisionRevision) => {
    const nombre = nombreLugar(s);
    const alertas = resolverRevision(s.id, decision, usuario.nombre);
    const resultado: ResultadoRevision = decision.accion === 'descartar' ? 'descartada' : decision.accion === 'corregir' ? 'corregida' : 'confirmada';
    setUltima({ siniestroId: s.id, nombre, resultado, alertas });
    setElegido(null);
    avisar(`Ubicación ${VERBO[resultado]}: ${nombre}`, {
      tono: resultado === 'descartada' ? 'info' : 'exito',
      detalle: `Registrada a nombre de ${usuario.nombre}.`,
    });
    for (const a of alertas) {
      avisar(textoAlerta(a), {
        tono: 'alerta',
        detalle: `Siniestro confirmado a ${Math.round(a.distancia)} m, posterior a la presentación. Ya figura en la bandeja.`,
      });
    }
    // El foco va al resultado: el elemento que lo tenía ya no existe.
    requestAnimationFrame(() => resultadoRef.current?.focus());
  };

  const detalle = `${formato.plural(pendientes.length, 'pendiente')} · umbral ${formato.decimal(UMBRAL_CONFIANZA)}`;

  return (
    <Shell titulo="Ubicaciones en revisión" cu="CU03" detalle={detalle}>
      <div className={css.pagina}>
        <section className={css.lista} aria-label="Ubicaciones pendientes de revisión">
          <h2 className={css.titLista}>
            Pendientes <span className={css.cuenta}>· {pendientes.length}</span>
          </h2>
          {pendientes.length > 0 ? (
            <ul className={css.items}>
              {pendientes.map((s) => {
                const activo = s.id === sel?.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={[css.item, activo && css.itemSel].filter(Boolean).join(' ')}
                      aria-current={activo ? 'true' : undefined}
                      onClick={() => setElegido(s.id)}
                    >
                      <IdentidadDe s={s} />
                      <span className={css.itemTexto}>
                        <span className={css.itemNombre}>{nombreLugar(s)}</span>
                        <span className={css.itemMotivo}>{resumenMotivo(s)}</span>
                        <span className={css.itemPie}>
                          <ChipEstado estado="en-revision">{etiquetaPrecision(s.ubicacion.precision)}</ChipEstado>
                          <span className={css.cifras} aria-label={`confianza ${formato.decimal(s.ubicacion.confianza)}`}>
                            {formato.decimal(s.ubicacion.confianza)}
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={css.listaVacia}>Ninguna ubicación espera revisión.</p>
          )}

          {revisadas.length > 0 && (
            <section className={css.revisadas} aria-labelledby="titulo-revisadas">
              <h2 id="titulo-revisadas" className={css.titLista}>
                Últimas revisiones
              </h2>
              <ul className={css.items} data-prueba="revisadas">
                {revisadas.map((s) => {
                  const r = resultadoRevision(s.ubicacion)!;
                  return (
                    <li key={s.id} className={[css.revisada, r === 'descartada' ? css.revisadaDescartada : css.revisadaConfirmada].join(' ')}>
                      <IdentidadDe s={s} />
                      <span className={css.itemTexto}>
                        <span className={css.itemNombre}>{nombreLugar(s)}</span>
                        <span className={css.itemMotivo}>
                          {r === 'descartada' ? 'Descartada' : r === 'corregida' ? 'Corregida a mano · confianza 1,00' : 'Propuesta confirmada'}
                        </span>
                        <span className={css.itemFirma}>
                          {s.ubicacion.revisadaPor} · {momento(s.ubicacion.revisadaEn!)}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </section>

        <div className={css.principal}>
          <div ref={resultadoRef} tabIndex={-1} className={css.resultadoFoco} role="status" aria-live="polite">
            {ultima && (
              <div
                className={[css.resultado, ultima.alertas.length > 0 ? css.resultadoAlerta : ultima.resultado === 'descartada' ? css.resultadoNeutro : css.resultadoOk].join(' ')}
                data-prueba="resultado"
              >
                <p className={css.resultadoTitulo}>
                  Ubicación de {ultima.nombre} {VERBO[ultima.resultado]} por {usuario.nombre}.
                </p>
                {ultima.resultado === 'descartada' ? (
                  <p>El siniestro queda sin ubicación y no participa de los cálculos.</p>
                ) : concentracion ? (
                  <p>
                    Ya interviene en los cálculos: con el período 2021–2026 integra la concentración <Registro>{concentracion.id}</Registro> ·{' '}
                    {nombreConcentracion(concentracion)}. <Link to="/priorizacion">Ver lugares priorizados</Link>
                  </p>
                ) : (
                  <p>
                    Ya interviene en los cálculos; por ahora no forma parte de ninguna concentración significativa.{' '}
                    <Link to="/priorizacion">Ver lugares priorizados</Link>
                  </p>
                )}
                {ultima.alertas.length > 0 && (
                  <ul className={css.alertas}>
                    {ultima.alertas.map((a) => (
                      <li key={a.reclamo}>
                        {textoAlerta(a)}, a {Math.round(a.distancia)} m.{' '}
                        <Link to={`/reclamos/${a.reclamo}`}>Abrir {a.reclamo}</Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {sel ? (
            <DetalleRevision
              key={sel.id}
              siniestro={sel}
              cronica={cronicaDe(sel, cronicas)}
              usuario={usuario.nombre}
              onDecidir={(d) => decidir(sel, d)}
            />
          ) : (
            <Vacio
              titulo="No quedan ubicaciones en revisión"
              accion={
                <Link to="/siniestros/cronicas" className={claseBoton('secundario')}>
                  Ir a las crónicas
                </Link>
              }
            >
              <p>
                Cada crónica que se ubique con una confianza menor a {formato.decimal(UMBRAL_CONFIANZA)} aparece acá y queda fuera de todo
                cálculo hasta que alguien la confirme, la corrija o la descarte.
              </p>
            </Vacio>
          )}
        </div>
      </div>
    </Shell>
  );
}
