/**
 * CU06: emitir la ficha de una concentración. Incluye CU07: el sistema
 * recomienda las contramedidas del catálogo y el técnico elige cuáles van en
 * la ficha. Alternativos: la concentración ya tiene ficha (se ofrece
 * abrirla), no existe, o el catálogo no tiene contramedidas aplicables
 * (CU06 3.a: se emite sin recomendación, con aviso de catálogo incompleto).
 */
import { useId, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CATALOGO_CONTRAMEDIDAS } from '../../datos/contramedidas';
import { formato, nombreConcentracion, recomendarContramedidas, tipoViaDe } from '../../dominio';
import type { Concentracion } from '../../dominio';
import { emitirFicha, fichaDeConcentracion, proximoNumeroFicha, puedeEmitirFicha } from '../../estado/acciones/ficha';
import { hoy } from '../../estado/reloj';
import { useConcentraciones, useUsuario } from '../../estado/selectores';
import { useDemo } from '../../estado/store';
import { Boton, FilaFiltros, IdentidadLugar, Registro, RomboIndice, Shell, Tabla, Vacio, avisar, claseBoton, type Columna } from '../../ui';
import { Acta, DatosContramedida, RotuloDemostracion } from './Acta';
import { fechaFicha, siniestrosDeFicha } from './datos';
import { Busqueda } from './Busqueda';
import css from './ficha.module.css';

export function EmitirFicha() {
  const [params] = useSearchParams();
  const id = params.get('concentracion');
  return id ? <BorradorFicha id={id} /> : <ElegirConcentracion />;
}

// ── Elegir la concentración ─────────────────────────────────────────────────

function ElegirConcentracion() {
  const cs = useConcentraciones();
  const fichas = useDemo((e) => e.fichas);
  const [, setParams] = useSearchParams();
  const [busqueda, setBusqueda] = useState('');

  const conFicha = useMemo(() => new Map(fichas.map((f) => [f.concentracionId, f.numero])), [fichas]);
  const q = busqueda.trim().toLowerCase();
  const filas = cs.filter((c) => !q || `${c.id} ${nombreConcentracion(c)} ${c.localidad}`.toLowerCase().includes(q));

  const columnas: Columna<Concentracion>[] = [
    {
      clave: 'lugar',
      titulo: 'Lugar',
      render: (c) => (
        <span className={css.lugarFila}>
          <IdentidadLugar ruta={c.ruta} calle={c.calle} tamano={32} />
          <span>
            <span className={css.lugarNombre}>{nombreConcentracion(c)}</span>
            <span className={css.lugarSub}>
              <Registro tenue>{c.id}</Registro> · {c.localidad} · {c.tipoPredominante}
            </span>
          </span>
        </span>
      ),
      orden: (c) => nombreConcentracion(c),
    },
    { clave: 'indice', titulo: 'Índice', alinear: 'derecha', ancho: '76px', render: (c) => <RomboIndice valor={c.indice} />, orden: (c) => c.indice },
    { clave: 'siniestros', titulo: 'Sin.', tituloCompleto: 'Siniestros', alinear: 'derecha', ancho: '64px', render: (c) => c.siniestroIds.length, orden: (c) => c.siniestroIds.length, ocultarEnMovil: true },
    { clave: 'fallecidos', titulo: 'Fallec.', tituloCompleto: 'Fallecidos', alinear: 'derecha', ancho: '72px', render: (c) => c.fallecidos, orden: (c) => c.fallecidos, ocultarEnMovil: true },
    {
      clave: 'ficha',
      titulo: 'Ficha',
      ancho: '140px',
      render: (c) => {
        const n = conFicha.get(c.id);
        return n ? <Registro>{n}</Registro> : <span className={css.tenue}>sin ficha</span>;
      },
      orden: (c) => conFicha.get(c.id) ?? null,
    },
  ];

  return (
    <Shell titulo="Nueva ficha de intervención" cu="CU06 · CU07" detalle="elegir la concentración">
      <div className={css.listado}>
        <p className={css.intro}>
          Elegí la concentración para la que vas a emitir la ficha. Desde <Link to="/priorizacion">Lugares priorizados</Link> se llega
          con el lugar ya elegido.
        </p>
        <FilaFiltros conteo={<span aria-live="polite">{formato.plural(filas.length, 'concentración', 'concentraciones')}</span>}>
          <Busqueda etiqueta="Buscar concentración" placeholder="C-0021, RN 158, Colón…" valor={busqueda} onCambio={setBusqueda} />
        </FilaFiltros>
        <Tabla
          etiqueta="Concentraciones significativas 2021–2025"
          columnas={columnas}
          filas={filas}
          claveFila={(c) => c.id}
          onSeleccionar={(c) => setParams({ concentracion: c.id })}
          estadoFila={(c) => (conFicha.has(c.id) ? 'cerrado' : undefined)}
          vacio={
            <Vacio titulo="Ninguna concentración coincide con la búsqueda" accion={<Boton onClick={() => setBusqueda('')}>Limpiar la búsqueda</Boton>}>
              Probá con el número (C-0021), la ruta o la calle.
            </Vacio>
          }
        />
      </div>
    </Shell>
  );
}

// ── Borrador y emisión ──────────────────────────────────────────────────────

function BorradorFicha({ id }: { id: string }) {
  const cs = useConcentraciones();
  const fichas = useDemo((e) => e.fichas);
  const i = cs.findIndex((x) => x.id === id);
  const c = cs[i];

  if (!c) {
    return (
      <Shell titulo="Emitir ficha de intervención" cu="CU06 · CU07" detalle={id}>
        <Vacio
          titulo={`No hay una concentración ${id} entre las significativas de 2021–2025`}
          accion={
            <>
              <Link to="/priorizacion/fichas/nueva" className={claseBoton('primario')}>
                Elegir otra concentración
              </Link>
              <Link to="/priorizacion/fichas" className={claseBoton('secundario')}>
                Volver a las fichas emitidas
              </Link>
            </>
          }
        >
          Revisá el número o elegí el lugar en la lista.
        </Vacio>
      </Shell>
    );
  }

  const existente = fichaDeConcentracion(fichas, c.id);
  if (existente) {
    return (
      <Shell titulo="Emitir ficha de intervención" cu="CU06 · CU07" detalle={c.id}>
        <Vacio
          titulo={`${nombreConcentracion(c)} (${c.id}) ya tiene la ficha ${existente.numero}`}
          accion={
            <>
              <Link to={`/priorizacion/fichas/${existente.numero}`} className={claseBoton('primario')}>
                Abrir {existente.numero}
              </Link>
              <Link to="/priorizacion/fichas/nueva" className={claseBoton('secundario')}>
                Elegir otra concentración
              </Link>
            </>
          }
        >
          La emitió {existente.emitidaPor} el {fechaFicha(existente.fecha)}. Cada concentración queda asociada a su ficha: abrila para
          consultar la evidencia y las contramedidas.
        </Vacio>
      </Shell>
    );
  }

  return <Borrador c={c} puesto={{ n: i + 1, de: cs.length }} />;
}

function Borrador({ c, puesto }: { c: Concentracion; puesto: { n: number; de: number } }) {
  const fichas = useDemo((e) => e.fichas);
  const siniestros = useDemo((e) => e.siniestros);
  const cronicas = useDemo((e) => e.cronicas);
  const usuario = useUsuario();
  const navigate = useNavigate();
  const recomendadas = useMemo(() => recomendarContramedidas(c, CATALOGO_CONTRAMEDIDAS), [c]);
  const [elegidas, setElegidas] = useState<ReadonlySet<string>>(() => new Set(recomendadas.map((m) => m.id)));
  const [error, setError] = useState<string | null>(null);
  const idError = useId();
  const idRol = useId();

  const sins = siniestrosDeFicha(c.siniestroIds, siniestros, cronicas, c);
  const numero = proximoNumeroFicha(fichas);
  const puede = puedeEmitirFicha(usuario);

  const alternar = (id: string) => {
    setError(null);
    setElegidas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const emitir = () => {
    if (recomendadas.length > 0 && elegidas.size === 0) {
      setError('Elegí al menos una contramedida para incluir en la ficha.');
      return;
    }
    const f = emitirFicha(
      c,
      recomendadas.filter((m) => elegidas.has(m.id)).map((m) => m.id),
      usuario,
    );
    avisar(`Ficha ${f.numero} emitida`, {
      tono: 'exito',
      detalle: `${nombreConcentracion(c)} · registrada a nombre de ${usuario.nombre}`,
    });
    navigate(`/priorizacion/fichas/${f.numero}`, { replace: true });
  };

  return (
    <Shell titulo="Emitir ficha de intervención" cu="CU06 · CU07" detalle={c.id}>
      <div className={css.pagina}>
        <Acta
          borrador
          numero={
            <>
              Borrador · al emitirse, <Registro>{numero}</Registro>
            </>
          }
          registroDe={
            <>
              Se registra el <span className={css.cifra}>{formato.fecha(hoy())}</span> a nombre de <b>{usuario.nombre}</b> · {usuario.cargo}
            </>
          }
          concentracion={c}
          puesto={puesto}
          indice={c.indice}
          siniestros={sins}
          contramedidas={
            <section className={css.seccion} aria-labelledby="titulo-medidas">
              <h3 id="titulo-medidas" className={css.h3}>
                Contramedidas recomendadas · {tipoViaDe(c)} · {c.tipoPredominante}
              </h3>
              {recomendadas.length > 0 ? (
                <>
                  <p className={css.nota}>
                    Elegí cuáles incluir. Van ordenadas por factor de reducción (menor factor, mayor reducción) y por calificación del
                    estudio.
                  </p>
                  <ul className={css.medidas} aria-describedby={error ? idError : undefined}>
                    {recomendadas.map((m) => {
                      const on = elegidas.has(m.id);
                      return (
                        <li key={m.id}>
                          <label className={[css.medida, css.medidaElegible, on && css.medidaElegida].filter(Boolean).join(' ')}>
                            <input type="checkbox" checked={on} onChange={() => alternar(m.id)} className={css.casilla} />
                            <span className={css.medidaTexto}>
                              <DatosContramedida m={m} />
                            </span>
                            <span className={css.factor}>factor {formato.decimal(m.factor)}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </>
              ) : (
                <p className={css.avisoCatalogo} role="note">
                  El catálogo no contiene contramedidas para {tipoViaDe(c)} · {c.tipoPredominante}. La ficha se emite sin recomendación y
                  con un aviso de catálogo incompleto.
                </p>
              )}
              <RotuloDemostracion />
              <div className={css.emitir}>
                {error && (
                  <p id={idError} role="alert" className={css.error}>
                    {error}
                  </p>
                )}
                <div className={css.botones}>
                  <Boton variante="primario" icono="firma" onClick={emitir} disabled={!puede} aria-describedby={puede ? undefined : idRol}>
                    Emitir ficha {numero}
                  </Boton>
                  <Link to="/priorizacion/fichas" className={claseBoton('fantasma')}>
                    Cancelar
                  </Link>
                </div>
                {!puede && (
                  <p id={idRol} className={css.nota}>
                    Las fichas las emite el técnico de tránsito o el funcionario a cargo. {usuario.nombre} es {usuario.cargo.toLowerCase()}:
                    cambiá el usuario de demostración arriba para emitirla.
                  </p>
                )}
              </div>
            </section>
          }
        />
      </div>
    </Shell>
  );
}
