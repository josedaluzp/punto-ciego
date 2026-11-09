/**
 * CU05 Consultar lugares priorizados (RF12) y CU04 Actualizar concentraciones
 * de riesgo (RF10, RF11). Pantalla principal de la demo (Figura 17): mapa de
 * la provincia a la izquierda, lista ordenada por índice a la derecha y, debajo,
 * el croquis del lugar seleccionado con «Emitir ficha de intervención».
 *
 * Estado en la dirección: `?lugar=C-0007` elige el lugar (la ficha vuelve con
 * «Ver en el mapa»), y `ambito`, `via`, `desde`, `hasta`, `usuario` guardan los
 * filtros, así que volver atrás desde la ficha conserva la consulta.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ANIOS_DISPONIBLES, PERIODO_PREDETERMINADO } from '../../datos/semilla';
import { nombreConcentracion } from '../../dominio/concentraciones';
import { decimal, fecha, hora, porcentaje } from '../../dominio/formato';
import { actualizarConcentraciones, registrarCalculoInicial, useUltimoCalculo, type ResultadoActualizacion } from '../../estado/acciones/priorizacion';
import { useConcentraciones, useUsuario, type Periodo } from '../../estado/selectores';
import { useDemo } from '../../estado/store';
import { Boton, FilaFiltros, IdentidadLugar, Mapa, Mojon, RomboIndice, Select, Shell, Tabla, Vacio, type Columna, type Marcador } from '../../ui';
import { filtrarLugares, viasDisponibles, VIA_TODAS, type Filtros, type LugarPriorizado, type UsuarioVulnerable } from './filtros';
import { PanelActualizacion } from './PanelActualizacion';
import { PanelLugar } from './PanelLugar';
import css from './PaginaPriorizacion.module.css';

const ANIO_MIN = ANIOS_DISPONIBLES[0];
const ANIO_MAX = ANIOS_DISPONIBLES[ANIOS_DISPONIBLES.length - 1]!;

const OPCIONES_AMBITO = [
  { valor: 'todo', texto: 'Provincia de Córdoba' },
  { valor: 'rutas', texto: 'Sólo rutas' },
  { valor: 'calles', texto: 'Sólo calles' },
];

const OPCIONES_USUARIO = [
  { valor: 'todos', texto: 'Todos los usuarios' },
  { valor: 'peaton', texto: 'Peatones' },
  { valor: 'ciclista', texto: 'Ciclistas' },
  { valor: 'motociclista', texto: 'Motociclistas' },
];

const OPCIONES_ANIO = ANIOS_DISPONIBLES.map((a) => ({
  valor: String(a),
  texto: String(a),
}));

function anioDe(v: string | null, porDefecto: number): number {
  const n = Number(v);
  return Number.isInteger(n) && n >= ANIO_MIN && n <= ANIO_MAX ? n : porDefecto;
}

function leerFiltros(p: URLSearchParams): Filtros & { periodo: Periodo } {
  const ambito = (['todo', 'rutas', 'calles'] as const).find((a) => a === p.get('ambito')) ?? 'todo';
  const usuario = (['todos', 'peaton', 'ciclista', 'motociclista'] as const).find((u) => u === p.get('usuario')) ?? 'todos';
  let desde = anioDe(p.get('desde'), PERIODO_PREDETERMINADO.desde);
  let hasta = anioDe(p.get('hasta'), PERIODO_PREDETERMINADO.hasta);
  if (desde > hasta) [desde, hasta] = [hasta, desde];
  return {
    ambito,
    usuario,
    via: p.get('via') ?? VIA_TODAS,
    periodo: { desde, hasta },
  };
}

export function PaginaPriorizacion() {
  const [params, setParams] = useSearchParams();
  const filtros = leerFiltros(params);
  const { desde, hasta } = filtros.periodo;
  const periodo = useMemo(() => ({ desde, hasta }), [desde, hasta]);

  const concentraciones = useConcentraciones(periodo);
  const siniestros = useDemo((e) => e.siniestros);
  const fichas = useDemo((e) => e.fichas);
  const usuario = useUsuario();
  const ultimo = useUltimoCalculo((e) => e.ultimo);
  const [resultado, setResultado] = useState<ResultadoActualizacion | null>(null);
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const listaRef = useRef<HTMLDivElement>(null);

  const vias = useMemo(() => viasDisponibles(concentraciones, filtros.ambito), [concentraciones, filtros.ambito]);
  const via = vias.includes(filtros.via) ? filtros.via : VIA_TODAS;
  const lugares = useMemo(
    () =>
      filtrarLugares(concentraciones, siniestros, {
        ambito: filtros.ambito,
        via,
        usuario: filtros.usuario,
      }),
    [concentraciones, siniestros, filtros.ambito, via, filtros.usuario],
  );

  const pedido = params.get('lugar');
  const actual: LugarPriorizado | undefined = lugares.find((l) => l.c.id === pedido) ?? lugares[0];
  const sel = actual?.c.id ?? null;

  // CU04: el primer cálculo queda registrado al abrir la pantalla por primera vez.
  useEffect(() => {
    if (concentraciones.length > 0) registrarCalculoInicial(concentraciones, periodo, usuario.nombre);
  }, [concentraciones, periodo, usuario.nombre]);

  const cambiar = useCallback(
    (cambios: Record<string, string | null>) => {
      setParams(
        (p) => {
          const n = new URLSearchParams(p);
          for (const [k, v] of Object.entries(cambios)) {
            if (v === null) n.delete(k);
            else n.set(k, v);
          }
          return n;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const seleccionar = useCallback((id: string) => cambiar({ lugar: id }), [cambiar]);

  // La fila elegida (desde el mapa o con el teclado) queda a la vista dentro de la lista, sin mover la página.
  useEffect(() => {
    const cont = listaRef.current?.querySelector<HTMLElement>(':scope > div');
    const fila = cont?.querySelector<HTMLElement>('tr[aria-selected="true"]');
    if (!cont || !fila) return;
    const cabecera = cont.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    const arriba = fila.offsetTop - cabecera;
    const abajo = fila.offsetTop + fila.offsetHeight;
    if (arriba < cont.scrollTop) cont.scrollTop = arriba;
    else if (abajo > cont.scrollTop + cont.clientHeight) cont.scrollTop = abajo - cont.clientHeight;
  }, [sel]);

  // Flechas arriba y abajo recorren la lista y eligen el lugar, sin animación.
  const alTeclearLista = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    const fila = (e.target as HTMLElement).closest('tbody tr');
    if (!fila) return;
    const filas = [...fila.parentElement!.querySelectorAll<HTMLTableRowElement>('tr')];
    const i = filas.indexOf(fila as HTMLTableRowElement);
    const j = e.key === 'Home' ? 0 : e.key === 'End' ? filas.length - 1 : i + (e.key === 'ArrowDown' ? 1 : -1);
    const destino = filas[j];
    if (!destino || j === i) return;
    e.preventDefault();
    destino.focus({ preventScroll: true });
    const id = destino.querySelector<HTMLElement>('[data-lugar]')?.dataset.lugar;
    if (id) seleccionar(id);
  };

  const actualizar = () => {
    const r = actualizarConcentraciones(concentraciones, periodo, usuario.nombre);
    setResultado(r);
  };

  const columnas: Columna<LugarPriorizado>[] = [
    {
      clave: 'rango',
      titulo: '#',
      tituloCompleto: 'Puesto por índice',
      alinear: 'derecha',
      ancho: '2.5rem',
      render: (l) => (
        <span className={css.rango} data-lugar={l.c.id}>
          {l.rango}
        </span>
      ),
    },
    {
      clave: 'lugar',
      titulo: 'Lugar',
      render: ({ c }) => (
        <div className={css.lugar}>
          <IdentidadLugar ruta={c.ruta} calle={c.calle} tamano={36} />
          <div className={css.lugarTexto}>
            <p className={css.lugarNombre}>{nombreConcentracion(c)}</p>
            <p className={css.lugarSub}>
              {c.tipoPredominante} · {c.localidad}
            </p>
          </div>
          {c.unidad === 'tramo' && c.kmDesde !== undefined && (
            <span className={css.mojon}>
              <Mojon km={c.kmDesde} />
            </span>
          )}
        </div>
      ),
    },
    {
      clave: 'unidad',
      titulo: 'Unidad',
      render: ({ c }) => c.unidad,
      ocultarEnMovil: true,
    },
    {
      clave: 'fal',
      titulo: 'Fallec.',
      tituloCompleto: 'Fallecidos',
      alinear: 'derecha',
      render: ({ c }) => c.fallecidos,
    },
    {
      clave: 'vul',
      titulo: 'Vulner.',
      tituloCompleto: 'Vulnerables',
      alinear: 'derecha',
      render: ({ c }) => porcentaje(c.vulnerables),
      ocultarEnMovil: true,
    },
    {
      clave: 'indice',
      titulo: 'Índice',
      tituloCompleto: 'Índice de riesgo',
      alinear: 'derecha',
      render: ({ c }) => <RomboIndice valor={c.indice} tamano="chico" />,
    },
  ];

  // El mapa pinta en orden: los de mayor índice y el elegido quedan encima de los demás.
  const marcadores: Marcador[] = lugares
    .map(({ c, rango }, i): Marcador => ({
      id: c.id,
      lat: c.lat,
      lon: c.lon,
      forma: c.unidad === 'tramo' ? 'tramo' : 'punto',
      tono: 'riesgo',
      tamano: c.indice,
      rotulo: i < 6 || c.id === sel ? String(rango) : undefined,
      titulo: `${rango}. ${nombreConcentracion(c)}, índice ${decimal(c.indice)}`,
      ruta: c.ruta,
      kmDesde: c.kmDesde,
      kmHasta: c.kmHasta,
    }))
    .reverse()
    .sort((a, b) => Number(a.id === sel) - Number(b.id === sel));

  const total = concentraciones.length;
  const filtrado = lugares.length !== total;
  const periodoAmplio = desde === ANIO_MIN && hasta === ANIO_MAX;
  const ficha = actual ? [...fichas].reverse().find((f) => f.concentracionId === actual.c.id) : undefined;

  return (
    <Shell
      titulo="Lugares priorizados"
      cu="CU05"
      detalle="orden por índice de riesgo"
      acciones={
        <Boton variante="secundario" tamano="chico" icono="restablecer" onClick={actualizar}>
          Actualizar concentraciones
        </Boton>
      }
    >
      <FilaFiltros
        conteo={
          <span aria-live="polite" data-prueba="conteo">
            {filtrado ? `${lugares.length} de ${total}` : total} concentraciones significativas
          </span>
        }
      >
        <Select
          etiqueta="Ámbito"
          etiquetaVisible
          enLinea
          valor={filtros.ambito}
          opciones={OPCIONES_AMBITO}
          onCambio={(v) => cambiar({ ambito: v === 'todo' ? null : v, via: null, lugar: null })}
        />
        <Select
          etiqueta="Vía"
          etiquetaVisible
          enLinea
          valor={via}
          opciones={[
            {
              valor: VIA_TODAS,
              texto: filtros.ambito === 'rutas' ? 'Todas las rutas' : filtros.ambito === 'calles' ? 'Todas las calles' : 'Calles y rutas',
            },
            ...vias.map((v) => ({ valor: v, texto: v })),
          ]}
          onCambio={(v) => cambiar({ via: v === VIA_TODAS ? null : v, lugar: null })}
        />
        <span className={css.periodo} role="group" aria-label="Período">
          <Select
            etiqueta="Período"
            enLinea
            aria-label="Período desde"
            valor={String(desde)}
            opciones={OPCIONES_ANIO}
            onCambio={(v) =>
              cambiar({
                desde: v,
                hasta: Number(v) > hasta ? v : String(hasta),
                lugar: null,
              })
            }
          />
          <Select
            etiqueta="a"
            enLinea
            aria-label="Período hasta"
            valor={String(hasta)}
            opciones={OPCIONES_ANIO}
            onCambio={(v) =>
              cambiar({
                hasta: v,
                desde: Number(v) < desde ? v : String(desde),
                lugar: null,
              })
            }
          />
        </span>
        <Select
          etiqueta="Usuario vulnerable"
          etiquetaVisible
          enLinea
          valor={filtros.usuario}
          opciones={OPCIONES_USUARIO}
          onCambio={(v) =>
            cambiar({
              usuario: (v as UsuarioVulnerable) === 'todos' ? null : v,
              lugar: null,
            })
          }
        />
      </FilaFiltros>

      {resultado && <PanelActualizacion resultado={resultado} onCerrar={() => setResultado(null)} />}

      {lugares.length === 0 ? (
        <div className={css.vacio}>
          <Vacio
            titulo="Ningún lugar cumple el filtro"
            accion={
              periodoAmplio ? (
                <Boton
                  variante="primario"
                  onClick={() =>
                    cambiar({
                      ambito: null,
                      via: null,
                      usuario: null,
                      lugar: null,
                    })
                  }
                >
                  Quitar los filtros de ámbito, vía y usuario
                </Boton>
              ) : (
                <Boton
                  variante="primario"
                  onClick={() =>
                    cambiar({
                      desde: String(ANIO_MIN),
                      hasta: String(ANIO_MAX),
                      lugar: null,
                    })
                  }
                >
                  Ampliar el período a {ANIO_MIN} a {ANIO_MAX}
                </Boton>
              )
            }
          >
            {periodoAmplio
              ? 'No hay concentraciones significativas con esta combinación de ámbito, vía y usuario.'
              : `No hay concentraciones significativas entre ${desde} y ${hasta} con estos filtros. Probá ampliar el período: con más años, más agrupamientos superan la prueba de significancia.`}
          </Vacio>
        </div>
      ) : (
        <div className={css.trabajo}>
          <section className={css.lista} aria-label="Lista ordenada por índice de riesgo" ref={listaRef} onKeyDown={alTeclearLista}>
            <Tabla
              etiqueta="Concentraciones ordenadas por índice de riesgo"
              columnas={columnas}
              filas={lugares}
              claveFila={(l) => l.c.id}
              seleccionada={sel}
              onSeleccionar={(l) => seleccionar(l.c.id)}
            />
          </section>

          {actual && <PanelLugar c={actual.c} rango={actual.rango} total={total} siniestros={siniestros} ficha={ficha} />}

          <section className={css.mapa} aria-label="Mapa de la provincia" data-abierto={mapaAbierto || undefined}>
            <button type="button" className={css.alternarMapa} aria-expanded={mapaAbierto} onClick={() => setMapaAbierto((a) => !a)}>
              {mapaAbierto ? 'Ocultar el mapa' : 'Ver en el mapa de la provincia'}
            </button>
            <div className={css.mapaLienzo}>
              <Mapa
                vista="provincia"
                etiqueta="Mapa de la provincia de Córdoba con las concentraciones priorizadas"
                marcadores={marcadores}
                seleccionado={sel}
                onSeleccionar={seleccionar}
                leyenda={<Leyenda />}
              />
            </div>
          </section>
        </div>
      )}

      {ultimo && (
        <p className={css.calculo} data-prueba="ultimo-calculo">
          Último cálculo: {fecha(ultimo.en)} a las {hora(ultimo.en)} · {ultimo.por} · {ultimo.lugares.length} concentraciones ({ultimo.periodo.desde} a{' '}
          {ultimo.periodo.hasta})
        </p>
      )}
    </Shell>
  );
}

function Leyenda() {
  return (
    <ul className={css.leyenda}>
      <li>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <circle cx="7" cy="7" r="5.5" fill="var(--rojo)" />
        </svg>
        punto sobre calle
      </li>
      <li>
        <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
          <rect x="1" y="5" width="16" height="4" rx="1" fill="var(--rojo)" />
        </svg>
        tramo de 1 km sobre ruta
      </li>
      <li className={css.leyendaNota}>tamaño según índice de riesgo</li>
    </ul>
  );
}
