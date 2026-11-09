/**
 * Siniestros registrados (CU01 paso 7, RF07): cada uno con su lugar, el
 * método y la confianza de su ubicación. El estado de la ubicación tiñe la
 * fila: verde confirmada, ámbar rayado en revisión, tenue descartada.
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ANIOS_DISPONIBLES } from '../../datos/semilla';
import { anio } from '../../dominio/fechas';
import { decimal, fecha, miles, plural } from '../../dominio/formato';
import { UMBRAL_CONFIANZA } from '../../dominio/georreferenciacion';
import { USUARIOS_VULNERABLES, type Siniestro } from '../../dominio/tipos';
import { useDemo } from '../../estado/store';
import {
  Boton,
  ChipEstado,
  FilaFiltros,
  IdentidadLugar,
  Mojon,
  Registro,
  Select,
  Tabla,
  Vacio,
  claseBoton,
  type Columna,
} from '../../ui';
import {
  TEXTO_METODO_CORTO,
  ambitoLugar,
  estadoFilaUbicacion,
  nombreLugar,
  resumenVictimas,
} from './textos';
import { AvisoEstado, ChipUbicacion, CroquisUbicacion, DatosUbicacion, FilaDato, MapaUbicacion, ReclamosAlertados } from './UbicacionSiniestro';
import css from './Cronicas.module.css';

const TODOS = 'todos';
/** Filas por tanda: la lista crece con «Mostrar más» en lugar de pintar los 471 de una vez. */
const TANDA = 50;

const OPCIONES_ESTADO = [
  { valor: TODOS, texto: 'Todos los estados' },
  { valor: 'confirmada', texto: 'Confirmada' },
  { valor: 'en-revision', texto: 'En revisión' },
  { valor: 'descartada', texto: 'Descartada' },
];
const OPCIONES_METODO = [
  { valor: TODOS, texto: 'Todos los métodos' },
  { valor: 'normalizacion', texto: 'Servicio de normalización' },
  { valor: 'poste', texto: 'Poste kilométrico' },
  { valor: 'localidad', texto: 'Localidad' },
  { valor: 'manual', texto: 'Corrección manual' },
];
const OPCIONES_VIA = [
  { valor: TODOS, texto: 'Calle y ruta' },
  { valor: 'calle', texto: 'Calle' },
  { valor: 'ruta', texto: 'Ruta' },
];
const OPCIONES_ANIO = [{ valor: TODOS, texto: 'Todos los años' }, ...[...ANIOS_DISPONIBLES].reverse().map((a) => ({ valor: String(a), texto: String(a) }))];

const COLUMNAS: readonly Columna<Siniestro>[] = [
  {
    clave: 'id',
    titulo: 'Siniestro',
    tituloCompleto: 'Siniestro y fecha del hecho',
    ancho: '96px',
    render: (s) => (
      <span className={css.idFila}>
        <Registro>{s.id}</Registro>
        <span className={css.fechaFila}>{fecha(s.fechaHecho)}</span>
      </span>
    ),
  },
  {
    clave: 'lugar',
    titulo: 'Lugar',
    render: (s) => {
      const l = s.lugarExtraido;
      const amb = ambitoLugar(l);
      return (
        <span className={css.lugarFila}>
          <IdentidadLugar ruta={l?.ruta} calle={l?.calle} tamano={30} />
          <span className={css.lugarTextos}>
            <span className={l?.ruta ? `${css.lugarNombre} ${css.sinCorte}` : css.lugarNombre}>{l?.ruta ?? nombreLugar(l)}</span>
            {amb && <span className={css.lugarSub}>{amb}</span>}
          </span>
          {l?.km !== undefined && <Mojon km={l.km} />}
        </span>
      );
    },
  },
  {
    clave: 'victimas',
    titulo: 'Víctimas',
    ancho: '200px',
    ocultarEnMovil: true,
    render: (s) => {
      const v = resumenVictimas(s);
      return (
        <span className={css.victimasFila}>
          {v.fatales && <span className={css.fatal}>{v.fatales}</span>}
          {v.graves && <span className={css.lugarSub}>{v.graves}, herido grave</span>}
          {!v.fatales && !v.graves && <span className={css.lugarSub}>sin tipo de usuario</span>}
        </span>
      );
    },
  },
  {
    clave: 'confianza',
    titulo: (
      <>
        <span className={css.soloAncho}>Método y confianza</span>
        <span className={css.soloAngosto}>Confianza</span>
      </>
    ),
    tituloCompleto: 'Método y confianza de la ubicación',
    render: (s) => (s.ubicacion ? <ConfianzaFila metodo={TEXTO_METODO_CORTO[s.ubicacion.metodo]} valor={s.ubicacion.confianza} /> : <span className={css.lugarSub}>Sin ubicación</span>),
  },
  {
    clave: 'estado',
    titulo: 'Estado',
    ancho: '112px',
    ocultarEnMovil: true,
    render: (s) => <ChipUbicacion u={s.ubicacion} corto />,
  },
];

/** Confianza en una línea: método, cifra y una barra fina con la marca del umbral. El medidor completo queda en el detalle. */
function ConfianzaFila({ metodo, valor }: { metodo: string; valor: number }) {
  const supera = valor >= UMBRAL_CONFIANZA;
  return (
    <span className={css.confianzaFila}>
      <span className={css.confianzaLinea}>
        <span className={css.lugarSub}>{metodo}</span>
        <b>{decimal(valor)}</b>
      </span>
      <span
        className={css.barraFila}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={valor}
        aria-label={`Confianza ${decimal(valor)}, umbral ${decimal(UMBRAL_CONFIANZA)}`}
      >
        <span className={supera ? css.rellenoSupera : css.rellenoBajo} style={{ width: `${valor * 100}%` }} />
        <span className={css.marcaUmbral} style={{ left: `${UMBRAL_CONFIANZA * 100}%` }} />
      </span>
    </span>
  );
}

export function ListaSiniestros({ seleccionado, onSeleccionar }: { seleccionado: string | null; onSeleccionar: (id: string | null) => void }) {
  const siniestros = useDemo((e) => e.siniestros);
  const [estado, setEstado] = useState(TODOS);
  const [metodo, setMetodo] = useState(TODOS);
  const [via, setVia] = useState(TODOS);
  const [anioSel, setAnio] = useState(TODOS);
  const [limite, setLimite] = useState(TANDA);

  const filas = useMemo(
    () =>
      siniestros
        .filter((s) => {
        const u = s.ubicacion;
        if (estado !== TODOS && (u?.estado ?? 'en-revision') !== estado && !(estado === 'en-revision' && u?.estado === 'pendiente')) return false;
        if (metodo !== TODOS && u?.metodo !== metodo) return false;
        if (via !== TODOS && (s.lugarExtraido?.ruta ? 'ruta' : 'calle') !== via) return false;
        if (anioSel !== TODOS && anio(s.fechaHecho) !== Number(anioSel)) return false;
        return true;
      })
      // Los más recientes primero; a igual fecha, el último registrado.
      .sort((a, b) => b.fechaHecho.localeCompare(a.fechaHecho) || b.id.localeCompare(a.id)),
    [siniestros, estado, metodo, via, anioSel],
  );
  const visibles = filas.slice(0, limite);
  const restantes = filas.length - visibles.length;

  const sel = seleccionado ? siniestros.find((s) => s.id === seleccionado) ?? null : null;
  const hayFiltros = [estado, metodo, via, anioSel].some((v) => v !== TODOS);
  const limpiar = () => {
    setEstado(TODOS);
    setMetodo(TODOS);
    setVia(TODOS);
    setAnio(TODOS);
    setLimite(TANDA);
  };

  return (
    <div className={css.pantallaLista}>
      <FilaFiltros conteo={`${miles(filas.length)} de ${plural(siniestros.length, 'siniestro')}`}>
        <Select etiqueta="Estado de la ubicación" enLinea valor={estado} onCambio={(v) => { setEstado(v); setLimite(TANDA); }} opciones={OPCIONES_ESTADO} />
        <Select etiqueta="Método" enLinea valor={metodo} onCambio={(v) => { setMetodo(v); setLimite(TANDA); }} opciones={OPCIONES_METODO} />
        <Select etiqueta="Vía" enLinea valor={via} onCambio={(v) => { setVia(v); setLimite(TANDA); }} opciones={OPCIONES_VIA} />
        <Select etiqueta="Año del hecho" enLinea valor={anioSel} onCambio={(v) => { setAnio(v); setLimite(TANDA); }} opciones={OPCIONES_ANIO} />
      </FilaFiltros>
      <div className={css.trabajoLista}>
        <section className={css.lista} aria-label="Siniestros registrados">
          <Tabla
            etiqueta="Siniestros registrados, con el método y la confianza de su ubicación"
            columnas={COLUMNAS}
            filas={visibles}
            claveFila={(s) => s.id}
            seleccionada={seleccionado}
            onSeleccionar={(s) => onSeleccionar(s.id === seleccionado ? null : s.id)}
            estadoFila={(s) => estadoFilaUbicacion(s.ubicacion?.estado)}
            pie={
              restantes > 0 ? (
                <div className={css.pieLista}>
                  <span>
                    {miles(visibles.length)} de {miles(filas.length)}, del más reciente al más antiguo
                  </span>
                  <Boton variante="secundario" tamano="chico" onClick={() => setLimite((l) => l + TANDA)}>
                    Mostrar {Math.min(TANDA, restantes)} más
                  </Boton>
                </div>
              ) : undefined
            }
            vacio={
              <Vacio
                titulo="Ningún siniestro coincide con los filtros"
                accion={
                  hayFiltros ? (
                    <Boton variante="secundario" onClick={limpiar}>
                      Quitar los filtros
                    </Boton>
                  ) : undefined
                }
              >
                Probá con otro estado, método, vía o año.
              </Vacio>
            }
          />
        </section>
        <aside className={[css.detalle, sel && css.detalleAbierto].filter(Boolean).join(' ')} aria-label="Detalle del siniestro" aria-live="polite">
          {sel ? (
            <DetalleSiniestro s={sel} onCerrar={() => onSeleccionar(null)} />
          ) : (
            <Vacio
              titulo="Elegí un siniestro de la lista"
              accion={
                <Link to="/siniestros/cronicas?incorporar" className={claseBoton('secundario')}>
                  Incorporar crónica
                </Link>
              }
            >
              Vas a ver sus crónicas, el método con que se ubicó, su confianza contra el umbral de 0,70 y el croquis del lugar. Para sumar un hecho, incorporá su
              crónica.
            </Vacio>
          )}
        </aside>
      </div>
    </div>
  );
}

function DetalleSiniestro({ s, onCerrar }: { s: Siniestro; onCerrar: () => void }) {
  const cronicas = useDemo((e) => e.cronicas);
  const propias = cronicas.filter((c) => c.siniestroId === s.id);
  const v = resumenVictimas(s);
  return (
    <div className={css.detalleCuerpo}>
      <div className={css.cabezaPanel}>
        <h2 className={css.tituloSeccion}>
          Siniestro <Registro>{s.id}</Registro>
        </h2>
        <ChipUbicacion u={s.ubicacion} />
        <Boton variante="fantasma" tamano="chico" icono="cerrar" onClick={onCerrar} className={css.cerrarDetalle}>
          Cerrar
        </Boton>
      </div>
      <p className={css.lugarResultado}>
        <IdentidadLugar ruta={s.lugarExtraido?.ruta} calle={s.lugarExtraido?.calle} tamano={32} />
        <b>{nombreLugar(s.lugarExtraido)}</b>
        {s.lugarExtraido?.km !== undefined && <Mojon km={s.lugarExtraido.km} />}
      </p>
      <dl className={css.datos}>
        <FilaDato termino="Fecha del hecho">
          {fecha(s.fechaHecho)}
        </FilaDato>
        <FilaDato termino="Víctimas fatales">
          {v.fatales ?? 'Ninguna con tipo de usuario'}
          {s.victimas.some((x) => x.gravedad === 'fallecido' && USUARIOS_VULNERABLES.includes(x.tipoUsuario)) && (
            <>
              {' '}
              <ChipEstado estado="vulnerable" />
            </>
          )}
        </FilaDato>
        {v.graves && <FilaDato termino="Heridos graves">{v.graves}</FilaDato>}
        <FilaDato termino="Tipo de siniestro">{s.tipo ? s.tipo[0]!.toUpperCase() + s.tipo.slice(1) : 'Sin determinar'}</FilaDato>
      </dl>
      <DatosUbicacion u={s.ubicacion} />
      <AvisoEstado u={s.ubicacion} />
      <ReclamosAlertados siniestroId={s.id} />
      <MapaUbicacion siniestro={s} />
      <CroquisUbicacion siniestro={s} />
      <h3 className={css.subtitulo}>{plural(propias.length, 'crónica')} de origen</h3>
      <ul className={css.cronicas}>
        {propias.map((c) => (
          <li key={c.id}>
            <p>
              <Registro>{c.id}</Registro> · {c.medio} · publicada el {fecha(c.fechaPublicacion)}
              {c.incorporadaPor && (
                <span className={css.lugarSub}>
                  {' '}
                  · incorporada por {c.incorporadaPor} el {fecha(c.incorporadaEn ?? '')}
                </span>
              )}
            </p>
            <p className={css.url}>
              {c.url}
            </p>
            <p className={css.citaCronica}>{c.texto}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
