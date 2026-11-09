/**
 * CU01 Incorporar crónica de siniestro (RF01 a RF03) y su resultado de CU02
 * (RF04 a RF08). A la izquierda se carga la crónica; a la derecha, lo que
 * extrajo el sistema, para que el analista lo confirme o lo corrija, y los
 * duplicados. Al incorporar, el mismo lado muestra cómo quedó ubicado el
 * siniestro: método, precisión, confianza contra el umbral, mapa y croquis.
 */
import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import {
  buscarDuplicado,
  clasificarPrecision,
  cronicaPorUrl,
  extraerDeCronica,
  extraerLugar,
  fechas,
  formato,
  TIPOS_SINIESTRO,
  USUARIOS_VULNERABLES,
  type CandidatoDuplicado,
  type TipoSiniestro,
  type TipoUsuario,
  type Victima,
} from '../../dominio';
import { incorporarCronica, type DecisionDuplicado, type ResultadoIncorporacion } from '../../estado/acciones/cronicas';
import { hoy } from '../../estado/reloj';
import { useUsuario } from '../../estado/selectores';
import { useDemo } from '../../estado/store';
import { avisar, Boton, CampoTexto, ChipEstado, IdentidadLugar, Mojon, Registro, Select, Vacio } from '../../ui';
import { TextoCronica } from './TextoCronica';
import { EJEMPLOS, TEXTO_PRECISION, nombreLugar } from './textos';
import { AvisoEstado, ChipUbicacion, CroquisUbicacion, DatosUbicacion, FilaDato, MapaUbicacion, ReclamosAlertados } from './UbicacionSiniestro';
import css from './Cronicas.module.css';


interface Entrada {
  url: string;
  medio: string;
  fechaPublicacion: string;
  texto: string;
}

interface Correcciones {
  lugarTexto?: string;
  fechaHecho?: string;
  victimas?: Victima[];
  tipo?: TipoSiniestro | null;
}

const VACIA: Entrada = { url: '', medio: '', fechaPublicacion: '', texto: '' };

const OPCIONES_USUARIO: { valor: TipoUsuario; texto: string }[] = [
  { valor: 'peaton', texto: 'Peatón' },
  { valor: 'ciclista', texto: 'Ciclista' },
  { valor: 'motociclista', texto: 'Motociclista' },
  { valor: 'conductor', texto: 'Conductor' },
  { valor: 'acompanante', texto: 'Acompañante' },
];

const OPCIONES_GRAVEDAD = [
  { valor: 'fallecido', texto: 'Fatal' },
  { valor: 'herido-grave', texto: 'Herido grave' },
];

const OPCIONES_TIPO = [{ valor: '', texto: 'Sin determinar' }, ...TIPOS_SINIESTRO.map((t) => ({ valor: t, texto: t[0]!.toUpperCase() + t.slice(1) }))];

function validar(e: Entrada): Partial<Record<keyof Entrada, string>> {
  const errores: Partial<Record<keyof Entrada, string>> = {};
  if (!/^https?:\/\/\S+\.\S+/.test(e.url.trim())) errores.url = 'Ingresá la dirección web completa de la nota, con https://.';
  if (!e.medio.trim()) errores.medio = 'Indicá el medio que publicó la crónica.';
  if (!fechas.esFechaValida(e.fechaPublicacion)) errores.fechaPublicacion = 'Indicá la fecha de publicación.';
  else if (e.fechaPublicacion > hoy()) errores.fechaPublicacion = `La fecha de publicación no puede ser posterior a hoy (${formato.fecha(hoy())}).`;
  if (e.texto.trim().length < 40) errores.texto = 'Pegá el texto completo de la crónica: hace falta para extraer los datos.';
  return errores;
}

export function IncorporarCronica() {
  const usuario = useUsuario();
  const cronicas = useDemo((e) => e.cronicas);
  const siniestros = useDemo((e) => e.siniestros);
  const [entrada, setEntrada] = useState<Entrada>(VACIA);
  const [ejemplo, setEjemplo] = useState('');
  const [corr, setCorr] = useState<Correcciones>({});
  const [decision, setDecision] = useState<'vincular' | 'nuevo' | null>(null);
  const [intentado, setIntentado] = useState(false);
  const [resultado, setResultado] = useState<ResultadoIncorporacion | null>(null);
  const tituloResultado = useRef<HTMLHeadingElement>(null);

  const fechaOk = fechas.esFechaValida(entrada.fechaPublicacion);
  const extraccion = useMemo(
    () => (entrada.texto.trim().length > 0 && fechaOk ? extraerDeCronica(entrada.texto, entrada.fechaPublicacion) : null),
    [entrada.texto, entrada.fechaPublicacion, fechaOk],
  );

  // Lo confirmado: lo extraído, con las correcciones del analista encima.
  const lugarCorregido = corr.lugarTexto !== undefined;
  const lugar = lugarCorregido ? extraerLugar(corr.lugarTexto!) : (extraccion?.lugar ?? null);
  const fechaHecho = corr.fechaHecho ?? extraccion?.fechaHecho ?? '';
  const victimas = corr.victimas ?? extraccion?.victimas ?? [];
  const tipo = corr.tipo !== undefined ? corr.tipo : (extraccion?.tipo ?? null);
  const precision = clasificarPrecision(lugar);

  const repetida = useMemo(() => (entrada.url.trim() && !resultado ? cronicaPorUrl(entrada.url, cronicas) : null), [entrada.url, cronicas, resultado]);
  const duplicado: CandidatoDuplicado | null = useMemo(
    () => (extraccion && fechas.esFechaValida(fechaHecho) && !resultado ? buscarDuplicado({ fechaHecho, lugar }, entrada.texto, siniestros, cronicas) : null),
    [extraccion, fechaHecho, lugar, entrada.texto, siniestros, cronicas, resultado],
  );

  const errores = validar(entrada);
  if (repetida) errores.url = undefined;
  const errorFecha = extraccion && !fechas.esFechaValida(fechaHecho) ? 'Indicá la fecha del hecho.' : undefined;
  const hayErrores = Object.values(errores).some(Boolean) || !!errorFecha;
  const ve = (k: keyof Entrada) => (intentado ? errores[k] : undefined);

  useEffect(() => {
    if (resultado) tituloResultado.current?.focus();
  }, [resultado]);

  const cambiarEntrada = (parcial: Partial<Entrada>) => {
    setEntrada((e) => ({ ...e, ...parcial }));
    if (parcial.texto !== undefined || parcial.fechaPublicacion !== undefined) {
      setCorr({});
      setDecision(null);
    }
  };

  const cargarEjemplo = (titulo: string) => {
    setEjemplo(titulo);
    const ej = EJEMPLOS.find((x) => x.titulo === titulo);
    if (!ej) return;
    setEntrada({ url: ej.url, medio: ej.medio, fechaPublicacion: ej.fechaPublicacion, texto: ej.texto });
    setCorr({});
    setDecision(null);
    setIntentado(false);
  };

  const reiniciar = () => {
    setEntrada(VACIA);
    setEjemplo('');
    setCorr({});
    setDecision(null);
    setIntentado(false);
    setResultado(null);
  };

  const decisionFinal: DecisionDuplicado | null = !duplicado
    ? { tipo: 'nuevo' }
    : duplicado.nivel === 'seguro' || decision === 'vincular'
      ? { tipo: 'vincular', siniestroId: duplicado.siniestro.id }
      : decision === 'nuevo'
        ? { tipo: 'nuevo' }
        : null;

  const enviar = (ev: FormEvent) => {
    ev.preventDefault();
    setIntentado(true);
    if (repetida || hayErrores || !decisionFinal) return;
    const r = incorporarCronica(entrada, { lugar, fechaHecho, victimas, tipo }, decisionFinal, usuario.nombre);
    setResultado(r);
    const u = r.siniestro.ubicacion;
    if (r.vinculada) {
      avisar(`Crónica ${r.cronica.id} vinculada a ${r.siniestro.id}`, { tono: 'exito', detalle: 'No se creó un siniestro nuevo.' });
    } else if (u?.estado === 'confirmada') {
      avisar(`Siniestro ${r.siniestro.id} incorporado`, { tono: 'exito', detalle: `Ubicación confirmada, confianza ${formato.decimal(u.confianza)}.` });
    } else {
      avisar(`Siniestro ${r.siniestro.id} en revisión`, {
        tono: 'info',
        detalle: `Confianza ${formato.decimal(u?.confianza ?? 0)}, por debajo del umbral: queda fuera de los cálculos hasta su revisión.`,
      });
    }
    for (const a of r.alertas) {
      avisar(`${a.tipo === 'cierre-desmentido' ? 'Cierre desmentido' : 'Alerta de reclamo desatendido'} · ${a.reclamo}`, {
        tono: 'alerta',
        detalle: `El siniestro ${r.siniestro.id} ocurrió a ${Math.round(a.distancia)} m del reclamo, presentado antes. Pasó a la bandeja de desatendidos.`,
      });
    }
  };

  const ejemploActual = EJEMPLOS.find((x) => x.titulo === ejemplo);
  const bloqueado = resultado !== null;

  return (
    <form className={css.incorporar} onSubmit={enviar} noValidate>
      <section className={css.carga} aria-labelledby="titulo-carga">
        <h2 id="titulo-carga" className={css.tituloSeccion}>
          Crónica
        </h2>
        <fieldset className={css.fieldset} disabled={bloqueado}>
          <Select
            etiqueta="Cargar una crónica de ejemplo"
            etiquetaVisible
            valor={ejemplo}
            onCambio={cargarEjemplo}
            opciones={[{ valor: '', texto: 'Elegí una crónica sintética…' }, ...EJEMPLOS.map((e) => ({ valor: e.titulo, texto: e.titulo }))]}
          />
          {ejemploActual && <p className={css.proposito}>{ejemploActual.proposito}</p>}
          <CampoTexto
            etiqueta="Dirección web"
            type="url"
            inputMode="url"
            autoComplete="off"
            value={entrada.url}
            onChange={(e) => cambiarEntrada({ url: e.target.value })}
            placeholder="https://"
            error={ve('url')}
          />
          {repetida && <UrlRepetida cronicaId={repetida.id} siniestroId={repetida.siniestroId} fecha={repetida.fechaPublicacion} />}
          <div className={css.dosCampos}>
            <CampoTexto etiqueta="Medio" value={entrada.medio} onChange={(e) => cambiarEntrada({ medio: e.target.value })} error={ve('medio')} />
            <CampoTexto
              etiqueta="Fecha de publicación"
              type="date"
              max={hoy()}
              value={entrada.fechaPublicacion}
              onChange={(e) => cambiarEntrada({ fechaPublicacion: e.target.value })}
              error={ve('fechaPublicacion')}
            />
          </div>
          <TextoCronica
            valor={entrada.texto}
            onCambio={(t) => cambiarEntrada({ texto: t })}
            resaltado={!lugarCorregido && extraccion?.lugar?.inicio !== undefined ? { inicio: extraccion.lugar.inicio, fin: extraccion.lugar.fin! } : null}
            error={ve('texto')}
          />
        </fieldset>
      </section>

      <section className={css.extraccion} aria-labelledby="titulo-extraccion" aria-live="polite">
        {resultado ? (
          <Resultado r={resultado} tituloRef={tituloResultado} onOtra={reiniciar} />
        ) : !extraccion ? (
          <>
            <h2 id="titulo-extraccion" className={css.tituloSeccion}>
              Lo que extrajo el sistema
            </h2>
            <Vacio titulo="Todavía no hay texto para analizar">
              Pegá el texto de una crónica con su fecha de publicación, o elegí una de las crónicas de ejemplo. El sistema extrae el lugar, la fecha del
              hecho, las víctimas y el tipo de siniestro, y vos confirmás o corregís cada dato antes de incorporarla.
            </Vacio>
          </>
        ) : (
          <>
            <div className={css.cabezaPanel}>
              <h2 id="titulo-extraccion" className={css.tituloSeccion}>
                Lo que extrajo el sistema
              </h2>
              <span className={css.notaPanel}>Confirmá o corregí cada dato</span>
            </div>
            <dl className={css.datos}>
              <FilaDato termino="Lugar">
                <CampoLugar
                  valor={corr.lugarTexto ?? extraccion.lugar?.texto ?? ''}
                  onCambio={(v) => setCorr((c) => ({ ...c, lugarTexto: v }))}
                  onRestaurar={lugarCorregido ? () => setCorr(({ lugarTexto: _, ...c }) => c) : undefined}
                  reconocido={lugar}
                />
              </FilaDato>
              <FilaDato termino="Nivel de precisión">{precision ? TEXTO_PRECISION[precision] : 'Sin lugar reconocible: la ubicación irá a revisión'}</FilaDato>
              <FilaDato termino="Fecha del hecho">
                <CampoTexto
                  etiqueta="Fecha del hecho"
                  className={css.campoCompacto}
                  type="date"
                  max={hoy()}
                  value={fechaHecho}
                  onChange={(e) => setCorr((c) => ({ ...c, fechaHecho: e.target.value }))}
                  error={errorFecha}
                  ayuda={`Publicada el ${formato.fecha(entrada.fechaPublicacion)}; la fecha sale de las referencias del texto («ayer», «el sábado»).`}
                />
              </FilaDato>
              <FilaDato termino="Víctimas">
                <EditorVictimas victimas={victimas} sinTipo={extraccion.fallecidosSinTipo} onCambio={(v) => setCorr((c) => ({ ...c, victimas: v }))} />
              </FilaDato>
              <FilaDato termino="Tipo de siniestro">
                <Select
                  etiqueta="Tipo de siniestro"
                  className={css.campoCompacto}
                  valor={tipo ?? ''}
                  onCambio={(v) => setCorr((c) => ({ ...c, tipo: (v || null) as TipoSiniestro | null }))}
                  opciones={OPCIONES_TIPO}
                />
              </FilaDato>
              <FilaDato termino="Duplicados">
                <Duplicado candidato={duplicado} decision={decision} onDecidir={setDecision} />
              </FilaDato>
            </dl>
          </>
        )}
        {!resultado && (
          <div className={css.barraAccion}>
            <Boton type="submit" variante="primario" icono={decisionFinal?.tipo === 'vincular' ? 'documento' : 'ubicacion'} disabled={!!repetida}>
              {decisionFinal?.tipo === 'vincular' ? `Vincular la crónica a ${decisionFinal.siniestroId}` : 'Incorporar crónica'}
            </Boton>
            <p className={css.notaAccion}>
              {repetida
                ? 'Esta dirección web ya está registrada.'
                : intentado && duplicado?.nivel === 'dudoso' && !decision
                  ? 'Elegí si vinculás la crónica o creás un siniestro nuevo.'
                  : intentado && hayErrores
                    ? 'Revisá los datos marcados.'
                    : 'El sistema crea el siniestro y lo ubica según el tipo de vía.'}
            </p>
          </div>
        )}
      </section>
    </form>
  );
}

function UrlRepetida({ cronicaId, siniestroId, fecha }: { cronicaId: string; siniestroId: string; fecha: string }) {
  return (
    <p className={`${css.aviso} ${css.avisoRevision}`} role="alert">
      <span>
        Esta dirección web ya fue incorporada: crónica <Registro>{cronicaId}</Registro>, publicada el {formato.fecha(fecha)}, del siniestro{' '}
        <Link to={`/siniestros/cronicas?siniestro=${siniestroId}`}>
          <Registro>{siniestroId}</Registro>
        </Link>
        . No se registra dos veces.
      </span>
    </p>
  );
}

function CampoLugar({
  valor,
  onCambio,
  onRestaurar,
  reconocido,
}: {
  valor: string;
  onCambio: (v: string) => void;
  onRestaurar?: () => void;
  reconocido: ReturnType<typeof extraerLugar>;
}) {
  const id = useId();
  return (
    <div className={css.campoLugar}>
      <label htmlFor={id} className="solo-lectores">
        Lugar
      </label>
      <input
        id={id}
        className={css.entradaLugar}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        placeholder="avenida Colón al 5300 · ruta nacional 9, kilómetro 694"
        aria-describedby={`${id}-lectura`}
        aria-invalid={valor.trim() && !reconocido ? true : undefined}
      />
      <p id={`${id}-lectura`} className={css.lecturaLugar}>
        {reconocido ? (
          <>
            <IdentidadLugar ruta={reconocido.ruta} calle={reconocido.calle} tamano={28} />
            <b>{nombreLugar(reconocido)}</b>
            {reconocido.km !== undefined && <Mojon km={reconocido.km} />}
          </>
        ) : (
          <span className={css.error}>No se reconoce un lugar. Escribilo como en la crónica: «avenida Colón al 5300» o «ruta nacional 9, kilómetro 694».</span>
        )}
      </p>
      {onRestaurar && (
        <button type="button" className={css.enlaceBoton} onClick={onRestaurar}>
          Corregido por el analista · volver a lo extraído
        </button>
      )}
    </div>
  );
}

function EditorVictimas({ victimas, sinTipo, onCambio }: { victimas: Victima[]; sinTipo: number; onCambio: (v: Victima[]) => void }) {
  const cambiar = (i: number, v: Partial<Victima>) => onCambio(victimas.map((x, j) => (j === i ? { ...x, ...v } : x)));
  return (
    <div className={css.victimas}>
      {victimas.length === 0 && <p className={css.ayuda}>La crónica no nombra víctimas con su tipo de usuario.</p>}
      <ul className={css.listaVictimas}>
        {victimas.map((v, i) => (
          <li key={i} className={css.victima}>
            <Select etiqueta={`Tipo de usuario de la víctima ${i + 1}`} valor={v.tipoUsuario} onCambio={(t) => cambiar(i, { tipoUsuario: t as TipoUsuario })} opciones={OPCIONES_USUARIO} />
            <Select
              etiqueta={`Gravedad de la víctima ${i + 1}`}
              valor={v.gravedad}
              onCambio={(g) => cambiar(i, { gravedad: g as Victima['gravedad'] })}
              opciones={OPCIONES_GRAVEDAD}
            />
            {USUARIOS_VULNERABLES.includes(v.tipoUsuario) ? <ChipEstado estado="vulnerable" /> : <span />}
            <Boton variante="fantasma" tamano="chico" onClick={() => onCambio(victimas.filter((_, j) => j !== i))} aria-label={`Quitar la víctima ${i + 1}`}>
              Quitar
            </Boton>
          </li>
        ))}
      </ul>
      {sinTipo > 0 && (
        <p className={css.ayuda}>
          El texto menciona {formato.plural(sinTipo, 'víctima fatal', 'víctimas fatales')} sin tipo de usuario: agregala con su tipo si la crónica lo
          permite.
        </p>
      )}
      <Boton variante="fantasma" tamano="chico" icono="mas" onClick={() => onCambio([...victimas, { tipoUsuario: 'peaton', gravedad: 'fallecido' }])}>
        Agregar víctima
      </Boton>
    </div>
  );
}

function Duplicado({
  candidato,
  decision,
  onDecidir,
}: {
  candidato: CandidatoDuplicado | null;
  decision: 'vincular' | 'nuevo' | null;
  onDecidir: (d: 'vincular' | 'nuevo') => void;
}) {
  const nombre = useId();
  if (!candidato) return <span>Ninguno con la misma fecha y el mismo lugar</span>;
  const s = candidato.siniestro;
  const resumen = (
    <span className={css.candidato}>
      <Registro>{s.id}</Registro> · {formato.fecha(s.fechaHecho)} · {nombreLugar(s.lugarExtraido)} · {formato.plural(s.cronicaIds.length, 'crónica')} · similitud de
      textos {formato.decimal(candidato.similitud)}
    </span>
  );
  if (candidato.nivel === 'seguro') {
    return (
      <div className={css.duplicado} data-nivel="seguro">
        <p>
          <b>La crónica refiere a un siniestro ya registrado.</b> Misma fecha, mismo lugar y textos semejantes: se vincula a él en lugar de crear uno
          nuevo.
        </p>
        {resumen}
      </div>
    );
  }
  return (
    <fieldset className={css.duplicado} data-nivel="dudoso">
      <legend>
        <b>Coincidencia dudosa.</b> Misma fecha y mismo lugar, pero los textos se parecen poco. Decidí vos.
      </legend>
      {resumen}
      <label className={css.opcion}>
        <input type="radio" name={nombre} checked={decision === 'vincular'} onChange={() => onDecidir('vincular')} />
        Vincular la crónica a <Registro>{s.id}</Registro>
      </label>
      <label className={css.opcion}>
        <input type="radio" name={nombre} checked={decision === 'nuevo'} onChange={() => onDecidir('nuevo')} />
        Es otro hecho: crear un siniestro nuevo
      </label>
    </fieldset>
  );
}

function Resultado({ r, tituloRef, onOtra }: { r: ResultadoIncorporacion; tituloRef: RefObject<HTMLHeadingElement>; onOtra: () => void }) {
  // El siniestro vivo del store: si otra pantalla lo revisa, se ve actualizado.
  const s = useDemo((e) => e.siniestros.find((x) => x.id === r.siniestro.id)) ?? r.siniestro;
  const u = s.ubicacion;
  return (
    <div className={css.resultado}>
      <div className={css.cabezaPanel}>
        <h2 id="titulo-extraccion" ref={tituloRef} tabIndex={-1} className={css.tituloSeccion}>
          {r.vinculada ? (
            <>
              Crónica <Registro>{r.cronica.id}</Registro> vinculada a <Registro>{s.id}</Registro>
            </>
          ) : (
            <>
              Siniestro <Registro>{s.id}</Registro> incorporado
            </>
          )}
        </h2>
        <ChipUbicacion u={u} />
      </div>
      <p className={css.lugarResultado}>
        <IdentidadLugar ruta={s.lugarExtraido?.ruta} calle={s.lugarExtraido?.calle} tamano={32} />
        <b>{nombreLugar(s.lugarExtraido)}</b>
        {s.lugarExtraido?.km !== undefined && <Mojon km={s.lugarExtraido.km} />}
        <span className={css.tenue}>
          · hecho del {formato.fecha(s.fechaHecho)} · {formato.plural(s.cronicaIds.length, 'crónica')}
        </span>
      </p>
      {r.vinculada && (
        <p className={css.aviso}>
          <span>La crónica se agregó al siniestro existente (RF03). Su ubicación no cambia y no se creó un siniestro nuevo.</span>
        </p>
      )}
      <DatosUbicacion u={u} />
      <AvisoEstado u={u} />
      <ReclamosAlertados siniestroId={s.id} />
      <MapaUbicacion siniestro={s} />
      <CroquisUbicacion siniestro={s} />
      <p className={css.notaRuta}>
        Sobre ruta, la coordenada sale del poste kilométrico de la progresiva; el servicio de normalización no se consulta para rutas.
      </p>
      <div className={css.barraAccion}>
        <Boton variante="primario" icono="mas" onClick={onOtra}>
          Incorporar otra crónica
        </Boton>
        <Link to={`/siniestros/cronicas?siniestro=${s.id}`} className={css.enlace}>
          Ver {s.id} en la lista de siniestros
        </Link>
      </div>
    </div>
  );
}
