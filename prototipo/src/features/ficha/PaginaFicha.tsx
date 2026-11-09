/**
 * CU06 y CU07: la ficha de intervención.
 *
 * - `/priorizacion/fichas/FI-2026-0042` muestra una ficha emitida.
 * - `/priorizacion/fichas/nueva?concentracion=C-0021` arma el borrador de la
 *   ficha de esa concentración para emitirla (así llega desde la priorización).
 * - `/priorizacion/fichas/nueva` sin concentración pide elegirla.
 */
import { Link, useParams } from 'react-router-dom';
import { CATALOGO_CONTRAMEDIDAS } from '../../datos/contramedidas';
import { USUARIOS } from '../../datos/usuarios';
import { formato, recomendarContramedidas, tipoViaDe } from '../../dominio';
import type { Contramedida } from '../../dominio';
import { useConcentraciones } from '../../estado/selectores';
import { useDemo } from '../../estado/store';
import { Boton, Registro, Shell, Vacio, claseBoton } from '../../ui';
import { Acta, DatosContramedida, RotuloDemostracion } from './Acta';
import { fechaFicha, siniestrosDeFicha } from './datos';
import { EmitirFicha } from './EmitirFicha';
import css from './ficha.module.css';

export function PaginaFicha() {
  const { numero = '' } = useParams();
  if (numero === 'nueva') return <EmitirFicha />;
  return <VerFicha numero={numero} />;
}

function VolverALista({ primario }: { primario?: boolean }) {
  return (
    <Link to="/priorizacion/fichas" className={claseBoton(primario ? 'primario' : 'secundario')}>
      Volver a las fichas emitidas
    </Link>
  );
}

function VerFicha({ numero }: { numero: string }) {
  const ficha = useDemo((e) => e.fichas.find((f) => f.numero === numero));
  const siniestros = useDemo((e) => e.siniestros);
  const cronicas = useDemo((e) => e.cronicas);
  const cs = useConcentraciones();

  if (!ficha) {
    return (
      <Shell titulo="Ficha de intervención" cu="CU06 · CU07" detalle={numero || '—'}>
        <Vacio titulo={`No existe la ficha ${numero}`} accion={<VolverALista primario />}>
          Revisá el número: las fichas se numeran FI-año-número, por ejemplo FI-2026-0042.
        </Vacio>
      </Shell>
    );
  }

  const i = cs.findIndex((x) => x.id === ficha.concentracionId);
  const c = cs[i];
  if (!c) {
    return (
      <Shell titulo="Ficha de intervención" cu="CU06 · CU07" detalle={ficha.numero}>
        <Vacio titulo={`La concentración ${ficha.concentracionId} de la ficha ${ficha.numero} ya no figura entre las significativas`} accion={<VolverALista primario />}>
          Puede pasar si se corrigieron o descartaron ubicaciones de sus siniestros. Restablecé los datos de demostración para volver a la semilla.
        </Vacio>
      </Shell>
    );
  }

  const sins = siniestrosDeFicha(ficha.siniestroIds, siniestros, cronicas, c);
  const medidas = ficha.contramedidaIds
    .map((id) => CATALOGO_CONTRAMEDIDAS.find((m) => m.id === id))
    .filter((m): m is Contramedida => !!m);
  const recomendadas = recomendarContramedidas(c, CATALOGO_CONTRAMEDIDAS);
  const emisor = USUARIOS.find((u) => u.nombre === ficha.emitidaPor);

  return (
    <Shell
      titulo="Ficha de intervención"
      cu="CU06 · CU07"
      detalle={ficha.numero}
      acciones={
        <>
          <Link to="/priorizacion/fichas" className={claseBoton('fantasma', 'chico')}>
            Fichas emitidas
          </Link>
          <Boton tamano="chico" icono="descarga" onClick={() => window.print()}>
            Imprimir o guardar en PDF
          </Boton>
        </>
      }
    >
      <div className={css.pagina}>
        <Acta
          numero={
            <>
              Ficha <Registro>{ficha.numero}</Registro>
            </>
          }
          registroDe={
            <>
              Emitida el <span className={css.cifra}>{fechaFicha(ficha.fecha)}</span> por <b>{ficha.emitidaPor}</b>
            </>
          }
          concentracion={c}
          puesto={{ n: i + 1, de: cs.length }}
          indice={ficha.indice}
          siniestros={sins}
          cierre={{
            nombre: ficha.emitidaPor,
            rol: emisor && `${emisor.cargo} · ${emisor.area}`,
            fecha: ficha.fecha,
            folio: ficha.numero,
          }}
          contramedidas={
            <section className={css.seccion} aria-labelledby="titulo-medidas">
              <h3 id="titulo-medidas" className={css.h3}>
                Contramedidas recomendadas · {tipoViaDe(c)} · {c.tipoPredominante}
              </h3>
              {medidas.length > 0 ? (
                <ol className={css.medidas}>
                  {medidas.map((m) => (
                    <li key={m.id} className={css.medida}>
                      <span className={css.medidaTexto}>
                        <DatosContramedida m={m} />
                      </span>
                      <span className={css.factor}>factor {formato.decimal(m.factor)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={css.avisoCatalogo} role="note">
                  Emitida sin recomendación: el catálogo no contiene contramedidas para {tipoViaDe(c)} · {c.tipoPredominante}. Catálogo
                  incompleto.
                </p>
              )}
              {recomendadas.length > medidas.length && medidas.length > 0 && (
                <p className={css.nota}>
                  El catálogo recomendaba {formato.plural(recomendadas.length, 'contramedida')}; {ficha.emitidaPor} incluyó{' '}
                  {medidas.length}.
                </p>
              )}
              <RotuloDemostracion />
            </section>
          }
        />
      </div>
    </Shell>
  );
}
