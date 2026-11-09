/**
 * Detalle del reclamo (CU10 paso 4) y su resolución (CU11, RF18): estado,
 * descripción, fotografía, siniestros posteriores con su distancia y su
 * crónica de origen, croquis y mapa del lugar, historia completa, agendar la
 * inspección (CU10 4.a) y el cierre firmado con motivo y respaldo.
 */
import { useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { USUARIOS } from '../../datos/usuarios';
import { sumarDias } from '../../dominio/fechas';
import { fecha, fechaCorta, hora, plural, usuario as textoUsuario } from '../../dominio/formato';
import { enPlanoCiudad } from '../../dominio/proyeccion';
import { diasSinRespuesta, puedeCerrar, rolPuedeCerrar } from '../../dominio/reclamos';
import { MOTIVOS_CIERRE, type EntradaHistorial, type MotivoCierre, type Reclamo, type Respaldo, type Siniestro, type TipoRespaldo } from '../../dominio/tipos';
import { agendarInspeccionReclamo, cerrarReclamoFirmado, rolPuedeAgendar } from '../../estado/acciones/bandeja';
import { hoy } from '../../estado/reloj';
import { useUsuario } from '../../estado/selectores';
import { useDemo } from '../../estado/store';
import { Boton, CampoTexto, ChipEstado, Croquis, Icono, Mapa, Registro, Shell, Vacio, avisar, claseBoton, textoEstado, type Marcador } from '../../ui';
import { LugarReclamo } from './LugarReclamo';
import { alertaDesde, claveAlerta, cierreDesmentido, cuadraDelLugar, siniestrosPosteriores, type SiniestroPosterior } from './modelo';
import css from './Bandeja.module.css';

export function PaginaReclamoDetalle() {
  const { numero = '' } = useParams();
  const r = useDemo((e) => e.reclamos.find((x) => x.numero === numero));
  if (!r) {
    return (
      <Shell titulo="Reclamo inexistente" cu="CU10" detalle={numero}>
        <Vacio
          titulo={`No hay ningún reclamo con el número ${numero}`}
          accion={
            <Link to="/reclamos" className={claseBoton('primario')}>
              Volver a la bandeja
            </Link>
          }
        >
          Revisá el número o elegí el reclamo desde la bandeja.
        </Vacio>
      </Shell>
    );
  }
  return <Detalle r={r} />;
}

function Detalle({ r }: { r: Reclamo }) {
  const siniestros = useDemo((e) => e.siniestros);
  const cronicas = useDemo((e) => e.cronicas);
  const posteriores = useMemo(() => siniestrosPosteriores(r, siniestros, cronicas), [r, siniestros, cronicas]);
  const dias = diasSinRespuesta(r, hoy());
  const desmentido = cierreDesmentido(r);
  const desde = alertaDesde(r);
  const alerta = claveAlerta(r);

  const resumen = [
    r.fechaPresentacion ? `Presentado el ${fecha(r.fechaPresentacion)}` : 'Sin fecha de inicio informada',
    r.estado !== 'cerrado' && dias !== null ? `${plural(dias, 'día')} sin respuesta` : null,
    r.fechaPresentacion ? `${plural(r.siniestrosPosteriores.length, 'siniestro posterior', 'siniestros posteriores')} al reclamo` : null,
  ].filter(Boolean);

  return (
    <Shell titulo="Reclamo" cu="CU10 · CU11" detalle={r.numero}>
      <div className={css.detalle}>
        <div className={css.expediente}>
          <Link to="/reclamos" className={css.volver}>
            <Icono nombre="atras" tamano={15} />
            Bandeja de reclamos
          </Link>

          <header className={css.cabeza}>
            <div className={css.cabezaTexto}>
              <h2 className={css.nombre}>
                <span>{r.lugar}</span>
                <Registro>{r.numero}</Registro>
              </h2>
              <p className={css.resumen}>{resumen.join(' · ')}</p>
              <div className={css.chips}>
                <ChipEstado estado={r.estado} />
                <ChipEstado estado={alerta} />
                {r.origen === 'real' ? <ChipEstado estado="caso-documentado" /> : null}
              </div>
            </div>
          </header>

          <section className={css.bloque} aria-labelledby="t-estado">
            <h3 id="t-estado" className={css.h2}>
              Estado del reclamo
            </h3>
            <Estados r={r} />
            <p className={css.notaEstados}>
              La verificación la abre el técnico al agendar la inspección; el cierre lo firma el funcionario a cargo. El sistema sólo lo
              reabre si después del cierre se confirma un siniestro en el lugar, y conserva su fecha de presentación.
            </p>
            {desmentido && (
              <p className={css.desmentido} data-prueba="cierre-desmentido">
                <b>Cierre desmentido por siniestro.</b> {desmentido.por} lo cerró el {fecha(desmentido.en)} por {desmentido.motivo}
                {desmentido.respaldos.length > 0 && ` (respaldo: ${desmentido.respaldos.map((x) => `${x.tipo} ${x.referencia}`).join(', ')})`}, y
                un siniestro confirmado después del cierre lo reabrió sin reiniciar su antigüedad.
              </p>
            )}
          </section>

          <section className={css.bloque} aria-labelledby="t-desc">
            <h3 id="t-desc" className={css.h2}>
              Lo que reclamó el vecino
            </h3>
            <div className={css.descripcion}>
              <blockquote>«{r.descripcion}»</blockquote>
              {r.foto ? (
                <figure className={css.foto}>
                  <img src={r.foto} alt={`Fotografía adjunta al reclamo ${r.numero}`} width={640} height={400} />
                  <figcaption>Foto ilustrativa · no es este punto</figcaption>
                </figure>
              ) : !r.evidencia ? (
                <p className={css.previaNota}>El vecino no adjuntó fotografía (es optativa).</p>
              ) : null}
            </div>
            {r.evidencia && (
              <div className={css.evidencia}>
                <b>Evidencia documental verificada</b>
                <span>
                  {r.evidencia.medio}, {fecha(r.evidencia.fecha)}
                  {r.evidencia.titular && <>: «{r.evidencia.titular}»</>}
                </span>
                {r.evidencia.cita && <q>{r.evidencia.cita}</q>}
                {r.evidencia.url && (
                  <a href={r.evidencia.url} target="_blank" rel="noreferrer noopener">
                    Ver la nota y su fotografía en el medio
                  </a>
                )}
                <span>{r.evidencia.nota}</span>
              </div>
            )}
          </section>

          <section className={css.bloque} aria-labelledby="t-sin">
            <h3 id="t-sin" className={css.h2}>
              Siniestros posteriores al reclamo <span className={css.fecha}>· {r.fechaPresentacion ? posteriores.length : 's/d'}</span>
            </h3>
            {posteriores.length > 0 ? (
              <ol className={css.siniestros}>
                {posteriores.map((p) => (
                  <ItemSiniestro key={p.siniestro.id} p={p} />
                ))}
              </ol>
            ) : (
              <p className={css.previaNota}>
                {r.fechaPresentacion
                  ? 'Todavía no se confirmó ningún siniestro en el radio del reclamo después de su presentación.'
                  : 'La nota no informa siniestros en el punto y el reclamo no tiene fecha de inicio: no hay con qué compararlos.'}
              </p>
            )}
            {alerta !== 'sin-alerta' && dias !== null && desde && (
              <p className={css.aviso} role="note">
                El reclamo lleva <b>{plural(dias, 'día')} sin respuesta</b> y tiene una alerta de{' '}
                {alerta === 'cierre-desmentido' ? 'cierre desmentido' : 'reclamo desatendido'} desde el {fechaCorta(desde)}.
              </p>
            )}
          </section>

          <section className={css.bloque} aria-labelledby="t-lugar">
            <h3 id="t-lugar" className={css.h2}>
              El lugar
            </h3>
            <LugarReclamo r={r} />
            <div className={css.lugarMapa}>
              <CroquisReclamo r={r} posteriores={posteriores} />
              <MapaReclamo r={r} posteriores={posteriores} />
            </div>
          </section>

          <section className={css.bloque} aria-labelledby="t-hist">
            <h3 id="t-hist" className={css.h2}>
              Historia del reclamo
            </h3>
            <Historial entradas={r.historial} />
          </section>
        </div>

        <aside className={css.panel} aria-label="Resolver el reclamo">
          {r.estado === 'cerrado' ? <Resuelto r={r} /> : <Resolver key={r.numero} r={r} />}
        </aside>
      </div>
    </Shell>
  );
}

function Estados({ r }: { r: Reclamo }) {
  const orden = ['abierto', 'en-verificacion', 'cerrado'] as const;
  const actual = r.estado === 'reabierto' ? -1 : orden.indexOf(r.estado);
  return (
    <ol className={css.estados} aria-label="Estados del reclamo">
      {orden.map((e, i) => (
        <li key={e} style={{ display: 'contents' }}>
          {i > 0 && (
            <span className={css.flechaPaso} aria-hidden="true">
              <Icono nombre="flecha" tamano={14} />
            </span>
          )}
          <span
            className={[css.paso, i < actual && css.pasoHecho, i === actual && css.pasoActual].filter(Boolean).join(' ')}
            aria-current={i === actual ? 'step' : undefined}
          >
            {textoEstado(e)}
          </span>
        </li>
      ))}
      <li style={{ display: 'contents' }}>
        <span className={[css.paso, css.pasoReabierto, r.estado === 'reabierto' && css.pasoActual].filter(Boolean).join(' ')} aria-current={r.estado === 'reabierto' ? 'step' : undefined}>
          {textoEstado('reabierto')}
        </span>
      </li>
    </ol>
  );
}

function describirVictimas(s: Siniestro): string {
  if (s.victimas.length === 0) return 'sin víctimas graves informadas';
  return s.victimas.map((v) => `${textoUsuario(v.tipoUsuario)} ${v.gravedad === 'fallecido' ? 'fallecido' : 'herido de gravedad'}`).join(', ');
}

function ItemSiniestro({ p }: { p: SiniestroPosterior }) {
  const s = p.siniestro;
  const c = p.cronicas[0];
  return (
    <li className={css.siniestro}>
      <span className={css.fecha}>{fecha(s.fechaHecho)}</span>
      <span className={css.siniestroTexto}>
        <span>
          {s.tipo ? `${s.tipo[0]!.toUpperCase()}${s.tipo.slice(1)}` : 'Siniestro'}: {describirVictimas(s)}. Ubicación confirmada a{' '}
          <b>{p.distancia} m</b> del lugar reclamado.
        </span>
        {c && (
          <span className={css.siniestroSub}>
            Crónica de origen: {c.medio}, {fecha(c.fechaPublicacion)}
            {c.origen === 'sintetico' ? ' (sintética)' : ''} ·{' '}
            {/* La crónica sintética tiene una dirección de ejemplo que no existe: se abre dentro de la demo. */}
            {c.origen === 'sintetico' ? (
              <Link to={`/siniestros/cronicas?siniestro=${encodeURIComponent(s.id)}`}>ver la crónica</Link>
            ) : (
              <a href={c.url} target="_blank" rel="noreferrer noopener">
                ver la crónica
              </a>
            )}
          </span>
        )}
      </span>
    </li>
  );
}

function CroquisReclamo({ r, posteriores }: { r: Reclamo; posteriores: SiniestroPosterior[] }) {
  const cuadra = cuadraDelLugar(r.lugar);
  const sins = posteriores.map((p, i) => ({
    numero: i + 1,
    posicion: r.ruta ? (p.siniestro.ubicacion?.km ?? r.km ?? 0) : (p.siniestro.lugarExtraido?.altura ?? cuadra?.altura ?? 0),
    tipo: p.siniestro.tipo,
    fatal: p.siniestro.victimas.some((v) => v.gravedad === 'fallecido'),
    descripcion: `${fecha(p.siniestro.fechaHecho)} ${p.siniestro.tipo ?? 'siniestro'}`,
  }));
  if (r.ruta && r.km !== undefined) {
    return (
      <Croquis
        modo="tramo"
        via={r.ruta}
        desde={r.km - 0.5}
        hasta={r.km + 0.5}
        siniestros={sins}
        marcador={{ posicion: r.km, etiqueta: `Lugar reclamado, km ${r.km}` }}
      />
    );
  }
  if (cuadra && cuadra.altura > 0) {
    return (
      <Croquis
        modo="cuadra"
        via={cuadra.calle}
        desde={cuadra.altura - 100}
        hasta={cuadra.altura + 100}
        siniestros={sins}
        marcador={{ posicion: cuadra.altura, etiqueta: `Lugar reclamado, ${r.lugar}` }}
      />
    );
  }
  return <p className={css.previaNota}>Sin croquis: el lugar no tiene altura ni progresiva.</p>;
}

function MapaReclamo({ r, posteriores }: { r: Reclamo; posteriores: SiniestroPosterior[] }) {
  const plano = enPlanoCiudad(r) ? 'ciudad' : 'provincia';
  const marcadores: Marcador[] = [
    ...posteriores
      .filter((p) => p.siniestro.ubicacion)
      .map((p) => ({
        id: p.siniestro.id,
        lat: p.siniestro.ubicacion!.lat,
        lon: p.siniestro.ubicacion!.lon,
        forma: 'punto' as const,
        tono: 'riesgo' as const,
        tamano: 0.2,
        titulo: `Siniestro del ${fecha(p.siniestro.fechaHecho)}, a ${p.distancia} m`,
      })),
    {
      id: r.numero,
      lat: r.lat,
      lon: r.lon,
      forma: 'pin',
      tono: r.alerta && r.estado !== 'cerrado' ? 'alerta' : 'carbon',
      rotulo: r.numero,
      titulo: `Lugar reclamado, ${r.numero}`,
    },
  ];
  return (
    <div className={css.mapaDetalle}>
      <Mapa
        vista={plano}
        etiqueta={`Mapa del lugar reclamado ${r.lugar} y sus siniestros posteriores`}
        marcadores={marcadores}
        encuadre={{ centro: r, radioKm: plano === 'ciudad' ? 0.5 : 6 }}
        rutaDestacada={r.ruta}
        rotulos={plano === 'provincia'}
      />
    </div>
  );
}

function autorDe(h: EntradaHistorial): string {
  if (h.por) {
    const u = USUARIOS.find((x) => x.nombre === h.por);
    return u ? `${u.nombre} · ${u.cargo}` : h.por;
  }
  if (h.tipo === 'presentacion') return 'Vecino, sin datos personales';
  return 'Sistema (CU09)';
}

function Historial({ entradas }: { entradas: readonly EntradaHistorial[] }) {
  const orden = [...entradas].sort((a, b) => a.fecha.localeCompare(b.fecha));
  if (orden.length === 0) return <p className={css.previaNota}>Sin movimientos registrados: el caso documentado no fecha el inicio del reclamo.</p>;
  return (
    <ol className={css.historial} data-prueba="historial">
      {orden.map((h, i) => (
        <li key={i}>
          <span className={css.fecha}>
            {fecha(h.fecha)}
            {h.fecha.length > 10 && h.fecha.slice(11, 16) !== '00:00' ? ` ${hora(h.fecha)}` : ''}
          </span>
          <span>
            {h.texto} <span className={css.por}>· {autorDe(h)}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function Resuelto({ r }: { r: Reclamo }) {
  const c = r.cierre;
  if (!c) return null;
  const u = USUARIOS.find((x) => x.nombre === c.por);
  return (
    <section className={css.form} aria-labelledby="t-resuelto">
      <h3 id="t-resuelto" className={css.h2}>
        Resolución firmada
      </h3>
      <div className={css.resuelto} data-prueba="resolucion">
        <dl className={css.kv}>
          <dt>Motivo</dt>
          <dd>{c.motivo}</dd>
          <dt>Respaldo</dt>
          <dd>{c.respaldos.map((x) => `${x.tipo}: ${x.referencia}`).join(' · ')}</dd>
          <dt>Firmó</dt>
          <dd>{u ? `${u.nombre} · ${u.cargo}, ${u.area}` : c.por}</dd>
          <dt>Fecha</dt>
          <dd>
            <span className={css.fecha}>
              {fecha(c.en)} {hora(c.en)}
            </span>
          </dd>
        </dl>
      </div>
      <p className={css.notaEstados}>
        El reclamo queda archivado con toda su historia. Si se confirma un siniestro en el lugar después de este cierre, el sistema lo
        reabre como cierre desmentido.
      </p>
    </section>
  );
}

const RESPALDOS: readonly { tipo: TipoRespaldo; etiqueta: string; campo: string; ejemplo?: string }[] = [
  { tipo: 'orden de trabajo', etiqueta: 'Número de orden de trabajo', campo: 'N.º de orden de trabajo', ejemplo: 'p. ej. OT-2026-0912' },
  { tipo: 'fotografía de la obra', etiqueta: 'Fotografía de la obra terminada', campo: 'Archivo de la fotografía' },
  { tipo: 'acta de inspección', etiqueta: 'Acta de inspección en el lugar', campo: 'N.º de acta de inspección', ejemplo: 'p. ej. AI-2026-0311' },
];

const MOTIVO_TEXTO: Record<MotivoCierre, string> = {
  'obra ejecutada': 'Obra ejecutada',
  'deterioro no constatado': 'Deterioro no constatado',
  'otra jurisdicción o duplicado': 'Otra jurisdicción o duplicado',
};

type EstadoRespaldos = Record<TipoRespaldo, { marcado: boolean; referencia: string }>;
const RESPALDOS_VACIOS: EstadoRespaldos = {
  'orden de trabajo': { marcado: false, referencia: '' },
  'fotografía de la obra': { marcado: false, referencia: '' },
  'acta de inspección': { marcado: false, referencia: '' },
};

function Resolver({ r }: { r: Reclamo }) {
  const usuario = useUsuario();
  const puedeAgendar = rolPuedeAgendar(usuario.rol);
  const puedeFirmar = rolPuedeCerrar(usuario.rol);
  const [fechaInspeccion, setFechaInspeccion] = useState(() => sumarDias(hoy(), 6));
  const [motivo, setMotivo] = useState<MotivoCierre | ''>('');
  const [respaldos, setRespaldos] = useState<EstadoRespaldos>(RESPALDOS_VACIOS);
  const [intento, setIntento] = useState(false);

  const elegidos: Respaldo[] = RESPALDOS.filter((x) => respaldos[x.tipo].marcado).map((x) => ({ tipo: x.tipo, referencia: respaldos[x.tipo].referencia }));
  const validacion = puedeCerrar({ motivo: motivo || undefined, respaldos: elegidos });
  const fechaValida = /^\d{4}-\d{2}-\d{2}$/.test(fechaInspeccion) && fechaInspeccion >= hoy();

  const agendar = () => {
    try {
      const a = agendarInspeccionReclamo(r.numero, fechaInspeccion);
      avisar(`${r.numero} pasó a en verificación`, { tono: 'exito', detalle: `Inspección agendada para el ${fecha(a.inspeccionAgendada!.fecha)} por ${usuario.nombre}. Conserva su antigüedad.` });
    } catch (e) {
      avisar('No se pudo agendar la inspección', { tono: 'error', detalle: (e as Error).message });
    }
  };

  const cerrar = (ev: FormEvent) => {
    ev.preventDefault();
    setIntento(true);
    if (!validacion.ok || !puedeFirmar) return;
    try {
      cerrarReclamoFirmado(r.numero, motivo as MotivoCierre, elegidos);
      avisar(`${r.numero} cerrado`, { tono: 'exito', detalle: `Firmado por ${usuario.nombre} (${usuario.cargo}) por ${motivo}.` });
    } catch (e) {
      avisar('No se pudo cerrar el reclamo', { tono: 'error', detalle: (e as Error).message });
    }
  };

  const noCerrar = () => {
    setMotivo('');
    setRespaldos(RESPALDOS_VACIOS);
    setIntento(false);
    avisar('El reclamo no se cerró', { detalle: `Sigue ${textoEstado(r.estado)} y conserva su antigüedad.` });
  };

  const marcar = (tipo: TipoRespaldo, marcado: boolean) => setRespaldos((s) => ({ ...s, [tipo]: { ...s[tipo], marcado } }));
  const referir = (tipo: TipoRespaldo, referencia: string) => setRespaldos((s) => ({ ...s, [tipo]: { ...s[tipo], referencia } }));

  return (
    <>
      <section className={css.form} aria-labelledby="t-insp">
        <h3 id="t-insp" className={css.h2}>
          Inspección del lugar
        </h3>
        {r.estado === 'en-verificacion' && r.inspeccionAgendada ? (
          <p data-prueba="inspeccion">
            Agendada para el <span className={css.fecha}>{fecha(r.inspeccionAgendada.fecha)}</span> por {r.inspeccionAgendada.por}. El
            reclamo está en verificación y conserva su antigüedad.
          </p>
        ) : puedeAgendar ? (
          <div className={css.agenda}>
            <CampoTexto
              etiqueta="Fecha de la inspección"
              type="date"
              min={hoy()}
              value={fechaInspeccion}
              onChange={(e) => setFechaInspeccion(e.target.value)}
              error={fechaValida ? undefined : 'Elegí hoy o una fecha posterior.'}
            />
            <Boton icono="calendario" onClick={agendar} disabled={!fechaValida}>
              Agendar inspección
            </Boton>
          </div>
        ) : (
          <p className={css.explicacion}>
            Estás como {usuario.nombre} ({usuario.cargo}). La inspección la agenda el técnico de tránsito o el funcionario a cargo (CU10).
          </p>
        )}
      </section>

      <form className={css.form} onSubmit={cerrar} aria-labelledby="t-cierre" noValidate>
        <h3 id="t-cierre" className={css.h2}>
          Cerrar el reclamo
        </h3>
        {!puedeFirmar && (
          <p className={css.explicacion} data-prueba="sin-permiso">
            Estás como {usuario.nombre} ({usuario.cargo}). Sólo el funcionario a cargo registra el cierre de un reclamo (CU11): elegí{' '}
            <b>M. Ferreyra · Funcionario a cargo</b> en el selector de usuario de la barra para probarlo.
          </p>
        )}
        <fieldset className={css.form} disabled={!puedeFirmar}>
          <fieldset className={css.grupo}>
            <legend>Motivo</legend>
            {MOTIVOS_CIERRE.map((m) => (
              <label key={m} className={css.opcion}>
                <input type="radio" name="motivo" value={m} checked={motivo === m} onChange={() => setMotivo(m)} />
                {MOTIVO_TEXTO[m]}
              </label>
            ))}
          </fieldset>
          <fieldset className={css.grupo}>
            <legend>Respaldo · obligatorio, al menos uno</legend>
            {RESPALDOS.map((x) => (
              <div key={x.tipo}>
                <label className={css.opcion}>
                  <input type="checkbox" checked={respaldos[x.tipo].marcado} onChange={(e) => marcar(x.tipo, e.target.checked)} />
                  {x.etiqueta}
                </label>
                {respaldos[x.tipo].marcado &&
                  (x.tipo === 'fotografía de la obra' ? (
                    <CampoTexto
                      className={css.referencia}
                      etiqueta={x.campo}
                      type="file"
                      accept="image/*"
                      onChange={(e) => referir(x.tipo, e.target.files?.[0]?.name ?? '')}
                      ayuda={respaldos[x.tipo].referencia ? `Adjunta: ${respaldos[x.tipo].referencia}` : 'Se guarda el nombre del archivo.'}
                    />
                  ) : (
                    <CampoTexto
                      className={css.referencia}
                      etiqueta={x.campo}
                      registro
                      placeholder={x.ejemplo}
                      value={respaldos[x.tipo].referencia}
                      onChange={(e) => referir(x.tipo, e.target.value)}
                    />
                  ))}
              </div>
            ))}
          </fieldset>
        </fieldset>
        <div aria-live="polite" className={css.errores} data-prueba="errores-cierre">
          {puedeFirmar && (intento || motivo) && !validacion.ok && validacion.errores.map((e) => <p key={e}>{e}</p>)}
        </div>
        <p className={css.firma}>
          Queda registrado quién cerró, cuándo y con qué respaldo
          {puedeFirmar && (
            <>
              : firma <b>{usuario.nombre}</b>, {usuario.cargo}, {usuario.area}, el <span className={css.fecha}>{fecha(hoy())}</span>
            </>
          )}
          .
        </p>
        <div className={css.botones}>
          <Boton type="submit" variante="primario" icono="firma" disabled={!puedeFirmar || !validacion.ok}>
            Firmar y cerrar
          </Boton>
          {puedeFirmar && (motivo || elegidos.length > 0) && (
            <Boton variante="fantasma" onClick={noCerrar}>
              No cerrar
            </Boton>
          )}
        </div>
      </form>
    </>
  );
}
