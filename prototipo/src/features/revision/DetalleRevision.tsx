/**
 * CU03, pasos 2 a 5: una ubicación en revisión con el texto de la crónica,
 * el lugar extraído resaltado, el método, la confianza y el motivo; el mapa
 * con el marcador arrastrable (puntero o flechas) y, sobre ruta, la
 * corrección por progresiva con el campo de km y el croquis del tramo.
 */
import { useState, type FormEvent } from 'react';
import {
  coberturaPostes,
  enPlanoCiudad,
  formato,
  posicionPorProgresiva,
  progresivaMasCercana,
  type Cronica,
  type LatLon,
  type Siniestro,
  type Ubicacion,
} from '../../dominio';
import type { DecisionRevision } from '../../estado/acciones/revision';
import { Boton, CampoTexto, Croquis, IdentidadLugar, Mapa, MedidorConfianza, Registro, type Marcador } from '../../ui';
import {
  etiquetaMetodo,
  etiquetaPrecision,
  leerKm,
  motivoBajaConfianza,
  nombreLugar,
  partirResaltado,
} from './presentacion';
import css from './revision.module.css';

interface Correccion extends LatLon {
  km?: number;
}

interface Props {
  siniestro: Siniestro & { ubicacion: Ubicacion };
  cronica: Cronica | null;
  usuario: string;
  onDecidir: (decision: DecisionRevision) => void;
}

const redondear = (v: number) => Math.round(v * 1e6) / 1e6;
const MEDIO_CROQUIS_KM = 5;

/** Ventana del croquis de tramo, centrada en una progresiva y dentro de la capa. */
function ventanaEn(km: number, cob: { desde: number; hasta: number }): { desde: number; hasta: number } {
  const ancho = Math.min(2 * MEDIO_CROQUIS_KM, cob.hasta - cob.desde);
  const desde = Math.min(Math.max(Math.floor(km) - MEDIO_CROQUIS_KM, cob.desde), cob.hasta - ancho);
  return { desde, hasta: desde + ancho };
}

export function DetalleRevision({ siniestro: s, cronica, usuario, onDecidir }: Props) {
  const u = s.ubicacion;
  const nombre = nombreLugar(s);
  const vista = enPlanoCiudad(u) ? 'ciudad' : 'provincia';
  const ruta = u.ruta;
  const cob = ruta ? coberturaPostes(ruta) : null;
  const kmPropuesto = ruta && cob ? (u.km !== undefined && posicionPorProgresiva(ruta, u.km) ? u.km : progresivaMasCercana(ruta, u)?.km) : undefined;

  const [correccion, setCorreccion] = useState<Correccion | null>(null);
  const [centro, setCentro] = useState<LatLon>({ lat: u.lat, lon: u.lon });
  const [ventana, setVentana] = useState(() => (cob && kmPropuesto !== undefined ? ventanaEn(kmPropuesto, cob) : null));
  const [textoKm, setTextoKm] = useState('');
  const [errorKm, setErrorKm] = useState<string | undefined>();
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  const pos: Correccion = correccion ?? { lat: u.lat, lon: u.lon, km: kmPropuesto };

  /** Sobre una ruta con postes, toda corrección se apoya en la progresiva más cercana. */
  const corregirEn = (p: LatLon) => {
    if (ruta && cob) {
      const r = progresivaMasCercana(ruta, p);
      if (r) {
        setCorreccion({ lat: redondear(r.punto.lat), lon: redondear(r.punto.lon), km: r.km });
        if (ventana && (r.km < ventana.desde || r.km > ventana.hasta)) setVentana(ventanaEn(r.km, cob));
        return;
      }
    }
    setCorreccion({ lat: redondear(p.lat), lon: redondear(p.lon) });
  };

  const corregirEnKm = (km: number): boolean => {
    if (!ruta) return false;
    const p = posicionPorProgresiva(ruta, km);
    if (!p) return false;
    setCorreccion({ lat: redondear(p.lat), lon: redondear(p.lon), km });
    if (cob && ventana && (km < ventana.desde || km > ventana.hasta)) setVentana(ventanaEn(km, cob));
    return true;
  };

  const ubicarKm = (e: FormEvent) => {
    e.preventDefault();
    const km = leerKm(textoKm);
    if (km === null) {
      setErrorKm('Escribí la progresiva en kilómetros, por ejemplo 765,4.');
      return;
    }
    if (!corregirEnKm(km)) {
      setErrorKm(
        cob
          ? `La capa de postes de la ${ruta} va del km ${cob.desde} al ${cob.hasta}: el ${formato.km(km)} no figura.`
          : `La ${ruta} no tiene postes cargados.`,
      );
      return;
    }
    setErrorKm(undefined);
    const p = posicionPorProgresiva(ruta!, km)!;
    setCentro(p);
  };

  const marcadores: Marcador[] = [
    ...(correccion ? [{ id: 'propuesta', lat: u.lat, lon: u.lon, forma: 'pin' as const, tono: 'revision' as const, titulo: 'Coordenada propuesta por el servicio' }] : []),
    {
      id: 'posicion',
      lat: pos.lat,
      lon: pos.lon,
      forma: 'pin',
      tono: correccion ? 'carbon' : 'revision',
      titulo: correccion ? 'Posición corregida por el analista' : 'Coordenada propuesta por el servicio',
      arrastrable: true,
    },
  ];

  const [antes, lugar, despues] = cronica ? partirResaltado(cronica.texto, s) : ['', '', ''];
  const fatales = s.victimas.filter((v) => v.gravedad === 'fallecido');

  return (
    <article className={css.detalle} aria-labelledby="revision-lugar">
      <header className={css.cabeza}>
        <div className={css.nombre}>
          <IdentidadLugar ruta={ruta} calle={s.lugarExtraido?.calle} tamano={36} />
          <div>
            <h2 id="revision-lugar" className={css.h2}>
              {nombre}
            </h2>
            <p className={css.tenue}>
              <Registro>{s.id}</Registro> · {formato.fecha(s.fechaHecho)}
              {s.tipo && <> · {s.tipo}</>}
              {fatales.length > 0 && <> · {fatales.map((v) => formato.usuario(v.tipoUsuario)).join(', ')} fallecido</>}
            </p>
          </div>
        </div>
        <dl className={css.datos}>
          <div>
            <dt>Método</dt>
            <dd>{etiquetaMetodo(u.metodo)}</dd>
          </div>
          <div>
            <dt>Precisión</dt>
            <dd>{etiquetaPrecision(u.precision)}</dd>
          </div>
          <div className={css.confianza}>
            <dt>Confianza</dt>
            <dd>
              <MedidorConfianza valor={u.confianza} />
            </dd>
          </div>
        </dl>
      </header>

      {cronica ? (
        <figure className={css.cronica}>
          <blockquote className={css.cita}>
            «{antes}
            {lugar && <mark className={css.resaltado}>{lugar}</mark>}
            {despues}»
          </blockquote>
          <figcaption className={css.fuente}>
            {cronica.medio} · {formato.fecha(cronica.fechaPublicacion)}
          </figcaption>
        </figure>
      ) : (
        <p className={css.tenue}>Sin crónica de origen.</p>
      )}

      <div className={css.trabajo}>
        <section className={css.zonaMapa} aria-label="Corrección sobre el mapa">
          <div className={css.marcoMapa}>
            <Mapa
              key={s.id}
              vista={vista}
              etiqueta={`Mapa de ${vista === 'ciudad' ? 'la ciudad de Córdoba' : 'la provincia de Córdoba'} con la ubicación de ${nombre}`}
              marcadores={marcadores}
              encuadre={{ centro, radioKm: vista === 'ciudad' ? 1.2 : 28 }}
              rutaDestacada={ruta}
              onArrastrar={(id, p) => {
                if (id === 'posicion') corregirEn(p);
              }}
            />
          </div>
          {ruta && cob && ventana && pos.km !== undefined && (
            <Croquis
              modo="tramo"
              via={ruta}
              desde={ventana.desde}
              hasta={ventana.hasta}
              siniestros={[]}
              marcador={{
                posicion: pos.km,
                etiqueta: `Progresiva de la posición sobre la ${ruta}`,
                onMover: (km) => {
                  corregirEnKm(Math.round(km * 10) / 10);
                },
              }}
            />
          )}
        </section>

        <aside className={css.panel} aria-label="Revisión">
          <ul className={css.leyenda}>
            <li>
              <span className={`${css.punto} ${css.puntoPropuesta}`} aria-hidden="true" />
              Coordenada propuesta por el servicio
            </li>
            <li>
              <span className={`${css.punto} ${css.puntoCorregida}`} aria-hidden="true" />
              Posición corregida por el analista
            </li>
          </ul>

          <div className={css.motivo}>
            <p>{motivoBajaConfianza(s)}</p>
            <p className={css.tenue}>Hasta que se confirme, el siniestro no interviene en ningún cálculo.</p>
          </div>

          <div className={css.posicion}>
            <p className={css.rotulo}>{correccion ? 'Posición corregida' : 'Coordenada propuesta'}</p>
            <p className={css.cifras} data-prueba="posicion">
              {pos.lat.toFixed(5)}, {pos.lon.toFixed(5)}
              {pos.km !== undefined && (
                <>
                  {' · '}
                  <span className="registro">{formato.km(pos.km)}</span>
                </>
              )}
            </p>
            <p className={css.ayuda}>
              {ruta && cob
                ? 'Arrastrá el marcador o el de la progresiva del croquis; se apoya en el poste más cercano. Con el teclado: enfocalo y usá las flechas.'
                : 'Arrastrá el marcador hasta el lugar correcto. Con el teclado: enfocalo y usá las flechas (Mayúscula, paso largo).'}
            </p>
          </div>

          {ruta && cob && (
            <form className={css.formKm} onSubmit={ubicarKm} noValidate>
              <CampoTexto
                etiqueta="Progresiva (km)"
                registro
                inputMode="decimal"
                autoComplete="off"
                value={textoKm}
                onChange={(e) => {
                  setTextoKm(e.target.value);
                  setErrorKm(undefined);
                }}
                placeholder={`${cob.desde} a ${cob.hasta}`}
                ayuda={`Postes cargados de la ${ruta}: km ${cob.desde} a ${cob.hasta}.`}
                error={errorKm}
              />
              <Boton type="submit" tamano="chico">
                Ubicar en el km
              </Boton>
            </form>
          )}

          <div className={css.acciones}>
            {correccion ? (
              <>
                <Boton variante="primario" ancho icono="ok" onClick={() => onDecidir({ accion: 'corregir', ...correccion })}>
                  Confirmar posición corregida
                </Boton>
                <Boton ancho onClick={() => onDecidir({ accion: 'confirmar' })}>
                  Confirmar la propuesta
                </Boton>
                <Boton variante="fantasma" ancho tamano="chico" onClick={() => setCorreccion(null)}>
                  Volver a la propuesta
                </Boton>
              </>
            ) : (
              <Boton variante="primario" ancho icono="ok" onClick={() => onDecidir({ accion: 'confirmar' })}>
                Confirmar la propuesta
              </Boton>
            )}
            {confirmandoDescarte ? (
              <div className={css.descarte} role="group" aria-label="Confirmar el descarte">
                <p>El siniestro queda sin ubicación y fuera de todo cálculo.</p>
                <div className={css.filaBotones}>
                  <Boton tamano="chico" onClick={() => onDecidir({ accion: 'descartar' })} autoFocus>
                    Sí, descartar
                  </Boton>
                  <Boton variante="fantasma" tamano="chico" onClick={() => setConfirmandoDescarte(false)}>
                    Cancelar
                  </Boton>
                </div>
              </div>
            ) : (
              <Boton ancho onClick={() => setConfirmandoDescarte(true)}>
                Descartar ubicación
              </Boton>
            )}
            <p className={css.firma}>Queda registrado a nombre de {usuario}.</p>
          </div>
        </aside>
      </div>
    </article>
  );
}
