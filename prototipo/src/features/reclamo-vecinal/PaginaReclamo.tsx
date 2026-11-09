/**
 * CU08 Presentar reclamo vecinal (RF15), la cara pública: el vecino, desde el
 * teléfono, sin cuenta y sin datos personales, marca el lugar en el mapa (o
 * escribe la calle y la altura), describe el problema, adjunta una fotografía
 * optativa, supera el control contra envíos automatizados y recibe el
 * comprobante con el número de reclamo.
 *
 * Dos pasos y el comprobante. Un solo botón principal por paso; el foco pasa
 * al título de cada paso y, ante un error, al primer campo con problemas.
 */
import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import { NOMBRES_CALLES } from '../../dominio/normalizacion';
import { fecha as formatoFecha, hora as formatoHora } from '../../dominio/formato';
import type { Reclamo } from '../../dominio/tipos';
import { presentarReclamo } from '../../estado/acciones/reclamo-vecinal';
import { AreaTexto, Boton, CampoTexto, ChipEstado, IdentidadLugar, Icono, Mapa, Registro, ShellPublico, claseBoton, type Encuadre, type Marcador } from '../../ui';
import { esImagen, reducirFoto } from './foto';
import { DESCRIPCION_MAX, DESCRIPCION_MIN, describirPunto, ubicarDireccion, validarDescripcion, validarLugar, type LugarReclamo } from './lugar';
import css from './PaginaReclamo.module.css';

type Paso = 'lugar' | 'detalle' | 'comprobante';

/** Encuadre inicial: el área central de la ciudad de Córdoba. */
const ENCUADRE_INICIAL: Encuadre = { centro: { lat: -31.405, lon: -64.2 }, radioKm: 6 };
const ID_PIN = 'lugar-del-reclamo';

export function PaginaReclamo() {
  const [paso, setPaso] = useState<Paso>('lugar');
  const [lugar, setLugar] = useState<LugarReclamo | null>(null);
  const [descripcion, setDescripcion] = useState('');
  const [foto, setFoto] = useState<string | null>(null);
  const [control, setControl] = useState(false);
  const [reclamo, setReclamo] = useState<Reclamo | null>(null);

  // Nada se anima en acciones de teclado: el paso entra con movimiento sólo si se llegó con el puntero.
  const conPuntero = useRef(false);
  const [animar, setAnimar] = useState(false);
  const titulo = useRef<HTMLHeadingElement>(null);
  const primeraVez = useRef(true);

  const irA = (p: Paso) => {
    setAnimar(conPuntero.current);
    setPaso(p);
  };

  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    titulo.current?.focus();
    window.scrollTo({ top: 0 });
  }, [paso]);

  const reiniciar = () => {
    setLugar(null);
    setDescripcion('');
    setFoto(null);
    setControl(false);
    setReclamo(null);
    irA('lugar');
  };

  return (
    <ShellPublico titulo="Reclamo por un lugar peligroso">
      <div
        className={css.pagina}
        onPointerDownCapture={() => (conPuntero.current = true)}
        onKeyDownCapture={() => (conPuntero.current = false)}
      >
        <header className={css.cabecera}>
          <h1 className={css.h1}>{paso === 'comprobante' ? 'Reclamo registrado' : 'Reclamo por un lugar peligroso'}</h1>
          <p className={css.sub}>
            {paso === 'comprobante' ? 'Guardá el número como constancia.' : 'Sin crear una cuenta y sin datos personales.'}
          </p>
          {paso !== 'comprobante' && (
            <ol className={css.pasos} aria-label="Pasos del reclamo">
              <li aria-current={paso === 'lugar' ? 'step' : undefined}>1 · Dónde es</li>
              <li aria-current={paso === 'detalle' ? 'step' : undefined}>2 · Qué pasa</li>
            </ol>
          )}
        </header>

        <div key={paso} className={[css.paso, animar && css.entra].filter(Boolean).join(' ')}>
          {paso === 'lugar' && <PasoLugar titulo={titulo} lugar={lugar} onLugar={setLugar} onContinuar={() => irA('detalle')} />}
          {paso === 'detalle' && lugar && (
            <PasoDetalle
              titulo={titulo}
              lugar={lugar}
              descripcion={descripcion}
              onDescripcion={setDescripcion}
              foto={foto}
              onFoto={setFoto}
              control={control}
              onControl={setControl}
              onVolver={() => irA('lugar')}
              onEnviar={() => {
                const r = presentarReclamo({ ...lugar, descripcion, foto: foto ?? undefined });
                setReclamo(r);
                irA('comprobante');
              }}
            />
          )}
          {paso === 'comprobante' && reclamo && <Comprobante titulo={titulo} reclamo={reclamo} onOtro={reiniciar} />}
        </div>
      </div>
    </ShellPublico>
  );
}

// ── Paso 1: el lugar ────────────────────────────────────────────────────────

function PasoLugar({
  titulo,
  lugar,
  onLugar,
  onContinuar,
}: {
  titulo: RefObject<HTMLHeadingElement>;
  lugar: LugarReclamo | null;
  onLugar: (l: LugarReclamo) => void;
  onContinuar: () => void;
}) {
  const [encuadre, setEncuadre] = useState<Encuadre>(() => (lugar ? { centro: lugar, radioKm: 0.8 } : ENCUADRE_INICIAL));
  const [error, setError] = useState<string | undefined>();
  const [calle, setCalle] = useState('');
  const [altura, setAltura] = useState('');
  const [errorCalle, setErrorCalle] = useState<string | undefined>();
  const [errorAltura, setErrorAltura] = useState<string | undefined>();
  const [abierto, setAbierto] = useState(false);
  const idError = useId();
  const idLista = useId();
  const refError = useRef<HTMLParagraphElement>(null);
  const idCalle = useId();
  const idAltura = useId();

  const marcar = (l: LugarReclamo) => {
    onLugar(l);
    setError(undefined);
  };

  const ubicar = () => {
    const r = ubicarDireccion(calle, altura);
    if (!r.ok) {
      setErrorCalle(r.campo === 'calle' ? r.error : undefined);
      setErrorAltura(r.campo === 'altura' ? r.error : undefined);
      document.getElementById(r.campo === 'calle' ? idCalle : idAltura)?.focus();
      return;
    }
    setErrorCalle(undefined);
    setErrorAltura(undefined);
    marcar(r.lugar);
    setEncuadre({ centro: r.lugar, radioKm: 0.8 });
  };

  const continuar = () => {
    const e = validarLugar(lugar);
    if (e) {
      setError(e);
      // El mensaje se monta en este mismo turno; el foco va cuando ya está en el documento.
      requestAnimationFrame(() => refError.current?.focus());
      return;
    }
    onContinuar();
  };

  const marcadores: Marcador[] = lugar
    ? [{ id: ID_PIN, forma: 'pin', tono: 'carbon', lat: lugar.lat, lon: lugar.lon, titulo: `Lugar del reclamo: ${lugar.lugar}`, arrastrable: true }]
    : [];

  return (
    <section aria-labelledby="titulo-paso" className={css.seccion}>
      <h2 id="titulo-paso" ref={titulo} tabIndex={-1} className={css.h2}>
        Dónde es
      </h2>
      <p className={css.indicacion}>Tocá el mapa donde está el problema. Podés acercar con los botones y arrastrar el marcador.</p>

      <div className={[css.marcoMapa, error && css.marcoError].filter(Boolean).join(' ')}>
        <Mapa
          vista="ciudad"
          etiqueta="Mapa de la ciudad de Córdoba: tocá para marcar el lugar del reclamo"
          marcadores={marcadores}
          encuadre={encuadre}
          onClicMapa={(p) => marcar(describirPunto(p))}
          onArrastrar={(_, p) => marcar(describirPunto(p))}
          className={css.mapa}
        />
      </div>

      <div className={css.lugarElegido} aria-live="polite">
        {lugar ? (
          <>
            <IdentidadLugar calle={lugar.calle} tamano={32} />
            <p>
              <strong data-lugar>{lugar.lugar}</strong>
              <span className={css.tenue}> · {lugar.ambito}</span>
              <span className={css.ayudaLugar}>¿No es exacto? Arrastrá el marcador o tocá otro punto.</span>
            </p>
          </>
        ) : (
          <p className={css.tenue}>Todavía no marcaste el lugar.</p>
        )}
      </div>
      {error && (
        <p ref={refError} id={idError} tabIndex={-1} className={css.error} role="alert">
          <Icono nombre="alerta" tamano={16} />
          <span>{error}</span>
        </p>
      )}

      <details className={css.direccion} open={abierto} onToggle={(e) => setAbierto((e.currentTarget as HTMLDetailsElement).open)}>
        <summary>Prefiero escribir la calle y la altura</summary>
        <div className={css.camposDireccion}>
          <CampoTexto
            id={idCalle}
            etiqueta="Calle"
            list={idLista}
            autoComplete="off"
            value={calle}
            onChange={(e) => setCalle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                ubicar();
              }
            }}
            error={errorCalle}
            placeholder="Av. Colón"
          />
          <datalist id={idLista}>
            {NOMBRES_CALLES.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <CampoTexto
            id={idAltura}
            etiqueta="Altura"
            inputMode="numeric"
            autoComplete="off"
            value={altura}
            onChange={(e) => setAltura(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                ubicar();
              }
            }}
            error={errorAltura}
            placeholder="5300"
            className={css.campoAltura}
          />
          <Boton icono="ubicacion" onClick={ubicar} className={css.botonUbicar}>
            Ubicar en el mapa
          </Boton>
          <p className={css.notaServicio}>Se ubica con el servicio de normalización de direcciones (simulado en la demo).</p>
        </div>
      </details>

      <Boton variante="primario" ancho onClick={continuar} className={css.principal} aria-describedby={error ? idError : undefined}>
        Continuar
      </Boton>
    </section>
  );
}

// ── Paso 2: qué pasa ────────────────────────────────────────────────────────

function PasoDetalle({
  titulo,
  lugar,
  descripcion,
  onDescripcion,
  foto,
  onFoto,
  control,
  onControl,
  onVolver,
  onEnviar,
}: {
  titulo: RefObject<HTMLHeadingElement>;
  lugar: LugarReclamo;
  descripcion: string;
  onDescripcion: (v: string) => void;
  foto: string | null;
  onFoto: (v: string | null) => void;
  control: boolean;
  onControl: (v: boolean) => void;
  onVolver: () => void;
  onEnviar: () => void;
}) {
  const [errorDescripcion, setErrorDescripcion] = useState<string | undefined>();
  const [errorFoto, setErrorFoto] = useState<string | undefined>();
  const [errorControl, setErrorControl] = useState<string | undefined>();
  const [procesando, setProcesando] = useState(false);
  const idDescripcion = useId();
  const refControl = useRef<HTMLInputElement>(null);
  const idFoto = useId();
  const idControl = useId();

  const largo = descripcion.trim().length;

  const elegirFoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    if (!esImagen(archivo)) {
      setErrorFoto('Ese archivo no es una imagen. Elegí una foto (JPG, PNG o similar).');
      return;
    }
    setErrorFoto(undefined);
    setProcesando(true);
    try {
      onFoto(await reducirFoto(archivo));
    } catch {
      setErrorFoto('No pudimos abrir la foto. Probá con otra o enviá el reclamo sin foto.');
    } finally {
      setProcesando(false);
    }
  };

  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const ed = validarDescripcion(descripcion);
    // CU08 4.a (el control se comprueba después de la descripción, paso 4): si el control no se supera, el reclamo no se registra y se pide repetirlo.
    const ec = ed || control ? undefined : 'No pudimos comprobar que el envío no es automático. Marcá la casilla y enviá de nuevo; el reclamo todavía no se registró.';
    setErrorDescripcion(ed);
    setErrorControl(ec);
    if (ed) return document.getElementById(idDescripcion)?.focus();
    if (ec) return refControl.current?.focus();
    onEnviar();
  };

  return (
    <section aria-labelledby="titulo-paso" className={css.seccion}>
      <h2 id="titulo-paso" ref={titulo} tabIndex={-1} className={css.h2}>
        Qué pasa
      </h2>

      <div className={css.resumenLugar}>
        <IdentidadLugar calle={lugar.calle} tamano={32} />
        <p>
          <strong>{lugar.lugar}</strong>
          <span className={css.tenue}> · {lugar.ambito}</span>
        </p>
        <Boton variante="fantasma" tamano="chico" onClick={onVolver}>
          Cambiar
        </Boton>
      </div>

      <form noValidate onSubmit={enviar} className={css.formulario}>
        <AreaTexto
          id={idDescripcion}
          etiqueta="¿Qué pasa en el lugar?"
          value={descripcion}
          onChange={(e) => {
            onDescripcion(e.target.value);
            if (errorDescripcion && !validarDescripcion(e.target.value)) setErrorDescripcion(undefined);
          }}
          maxLength={DESCRIPCION_MAX}
          rows={4}
          placeholder="Por ejemplo: pozo grande en el carril derecho, las motos lo esquivan de golpe."
          error={errorDescripcion}
          ayuda={
            <span className={css.contador}>
              {largo < DESCRIPCION_MIN ? `Al menos ${DESCRIPCION_MIN} caracteres · llevás ${largo}` : `${largo} de ${DESCRIPCION_MAX}`}
            </span>
          }
        />

        <div className={css.foto}>
          <p className={css.etiqueta} id={`${idFoto}-et`}>
            Fotografía <span className={css.tenue}>· optativa</span>
          </p>
          {foto ? (
            <div className={css.vistaFoto}>
              <img src={foto} alt="Vista previa de la fotografía adjunta" className={css.miniatura} />
              <div className={css.accionesFoto}>
                <p className={css.tenue}>Fotografía adjunta. Queda en este teléfono hasta que envíes el reclamo.</p>
                <Boton variante="fantasma" tamano="chico" icono="cerrar" onClick={() => onFoto(null)}>
                  Quitar la foto
                </Boton>
              </div>
            </div>
          ) : (
            <label className={css.elegirFoto} aria-busy={procesando || undefined}>
              <input
                id={idFoto}
                type="file"
                accept="image/*"
                className="solo-lectores"
                onChange={elegirFoto}
                aria-describedby={errorFoto ? `${idFoto}-error` : `${idFoto}-ayuda`}
              />
              <Icono nombre="foto" tamano={18} />
              <span>{procesando ? 'Preparando la foto…' : 'Agregar una foto'}</span>
            </label>
          )}
          {errorFoto ? (
            <p id={`${idFoto}-error`} className={css.errorCampo}>
              {errorFoto}
            </p>
          ) : (
            !foto && (
              <p id={`${idFoto}-ayuda`} className={css.ayuda}>
                Si no podés sacarla, el reclamo se registra igual.
              </p>
            )
          )}
        </div>

        <div className={css.control}>
          <label className={css.casilla}>
            <input
              ref={refControl}
              type="checkbox"
              checked={control}
              onChange={(e) => {
                onControl(e.target.checked);
                if (e.target.checked) setErrorControl(undefined);
              }}
              aria-invalid={errorControl ? true : undefined}
              aria-describedby={errorControl ? `${idControl}-error` : `${idControl}-ayuda`}
            />
            <span>No soy un programa automático</span>
          </label>
          {errorControl ? (
            <p id={`${idControl}-error`} className={css.errorCampo} role="alert">
              {errorControl}
            </p>
          ) : (
            <p id={`${idControl}-ayuda`} className={css.ayuda}>
              Control contra envíos automatizados (simulado en la demo).
            </p>
          )}
        </div>

        <p className={css.privacidad}>
          <Icono nombre="ok" tamano={16} />
          <span>No te pedimos nombre, documento ni teléfono. El reclamo llega al área técnica con su número, su fecha y el lugar.</span>
        </p>

        <Boton type="submit" variante="primario" ancho cargando={procesando} className={css.principal}>
          Enviar reclamo
        </Boton>
      </form>
    </section>
  );
}

// ── Comprobante ─────────────────────────────────────────────────────────────

function Comprobante({ titulo, reclamo, onOtro }: { titulo: RefObject<HTMLHeadingElement>; reclamo: Reclamo; onOtro: () => void }) {
  const en = reclamo.historial[0]?.fecha ?? `${reclamo.fechaPresentacion}T00:00:00`;
  return (
    <section aria-labelledby="titulo-paso" className={css.seccion}>
      <div className={css.constancia} role="status">
        <h2 id="titulo-paso" ref={titulo} tabIndex={-1} className={css.etiquetaNumero}>
          Número de reclamo
        </h2>
        <p className={css.numero} data-numero>
          <Registro>{reclamo.numero}</Registro>
        </p>
        <p className={css.fechaHora}>
          {formatoFecha(en)} · {formatoHora(en)}
        </p>
      </div>

      <dl className={css.datos}>
        <div>
          <dt>Lugar</dt>
          <dd className={css.lugarComprobante}>
            <IdentidadLugar calle={reclamo.calle} tamano={28} />
            <span>
              <strong>{reclamo.lugar}</strong>
              <span className={css.tenue}> · {reclamo.ambito}</span>
            </span>
          </dd>
        </div>
        <div>
          <dt>Estado</dt>
          <dd>
            <ChipEstado estado="abierto" />
          </dd>
        </div>
        <div>
          <dt>Lo que contaste</dt>
          <dd className={css.descripcion}>{reclamo.descripcion}</dd>
        </div>
        <div>
          <dt>Fotografía</dt>
          <dd>{reclamo.foto ? <img src={reclamo.foto} alt="Fotografía adjunta al reclamo" className={css.miniatura} /> : <span className={css.tenue}>Sin fotografía</span>}</dd>
        </div>
      </dl>

      <h3 className={css.h3}>Qué pasa ahora</h3>
      <ol className={css.despues}>
        <li>El área técnica de tránsito recibe el reclamo en su bandeja, con este número.</li>
        <li>Si después de hoy se registra un siniestro en este lugar y el reclamo sigue sin atender, el sistema emite una alerta de reclamo desatendido.</li>
        <li>El reclamo sólo se cierra con la firma de un responsable y un respaldo documental, como una orden de trabajo o un acta de inspección.</li>
      </ol>

      <Boton ancho onClick={onOtro} className={css.principal}>
        Presentar otro reclamo
      </Boton>
      <Link to="/reclamos?vista=todos" className={`${claseBoton('fantasma')} ${css.enlaceDemo}`}>
        <span>Ver cómo lo recibe el organismo</span>
        <Icono nombre="flecha" tamano={16} />
      </Link>
    </section>
  );
}
