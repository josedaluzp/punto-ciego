/**
 * Ubicación de un siniestro (CU02, RF04 a RF08): precisión, método,
 * confianza contra el umbral, estado, mapa y croquis del lugar. Lo usan el
 * resultado de «Incorporar crónica» y el detalle de la lista.
 */
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { enPlanoCiudad, formato, UMBRAL_CONFIANZA } from '../../dominio';
import type { Reclamo, Siniestro, Ubicacion } from '../../dominio/tipos';
import { useDemo } from '../../estado/store';
import { ChipEstado, Croquis, Icono, Mapa, MedidorConfianza, Registro, type SiniestroCroquis } from '../../ui';
import { TEXTO_ESTADO_UBICACION, TEXTO_METODO, TEXTO_PRECISION, nombreLugar } from './textos';
import css from './Cronicas.module.css';

export function FilaDato({ termino, children }: { termino: string; children: ReactNode }) {
  return (
    <div className={css.dato}>
      <dt>{termino}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Método, precisión, confianza y estado de la ubicación, como lista de definiciones. */
export function DatosUbicacion({ u }: { u: Ubicacion | null }) {
  if (!u) {
    return (
      <dl className={css.datos}>
        <FilaDato termino="Ubicación">Sin ubicación</FilaDato>
      </dl>
    );
  }
  return (
    <dl className={css.datos}>
      <FilaDato termino="Nivel de precisión">{TEXTO_PRECISION[u.precision]}</FilaDato>
      <FilaDato termino="Método">{TEXTO_METODO[u.metodo]}</FilaDato>
      {u.nomenclatura && <FilaDato termino="Resultado">{u.nomenclatura}</FilaDato>}
      <FilaDato termino="Confianza">
        <MedidorConfianza valor={u.confianza} />
      </FilaDato>
      <FilaDato termino="Coordenada">
        {u.lat.toFixed(5)}, {u.lon.toFixed(5)}
      </FilaDato>
      {u.revisadaPor && (
        <FilaDato termino="Revisada">
          {u.revisadaPor} · {formato.fecha(u.revisadaEn ?? '')}
        </FilaDato>
      )}
    </dl>
  );
}

/** Aviso de lo que significa el estado para los cálculos (RF08). */
export function AvisoEstado({ u }: { u: Ubicacion | null }) {
  if (u?.estado === 'confirmada') {
    return (
      <p className={`${css.aviso} ${css.avisoConfirmado}`}>
        <Icono nombre="ok" tamano={16} />
        <span>
          La confianza alcanza el umbral de {formato.decimal(UMBRAL_CONFIANZA)}: la ubicación queda confirmada y entra en el cálculo de
          concentraciones.
        </span>
      </p>
    );
  }
  if (u?.estado === 'descartada') {
    return (
      <p className={css.aviso}>
        <span>La ubicación fue descartada: el siniestro no participa de ningún cálculo.</span>
      </p>
    );
  }
  return (
    <div className={`${css.aviso} ${css.avisoRevision}`} role="note">
      <Icono nombre="alerta" tamano={16} />
      <span>
        {u
          ? `Confianza ${formato.decimal(u.confianza)}, por debajo del umbral de ${formato.decimal(UMBRAL_CONFIANZA)}: la ubicación queda en revisión y no interviene en ningún cálculo hasta que un analista la confirme o la corrija.`
          : 'El siniestro no tiene ubicación y no interviene en ningún cálculo.'}{' '}
        <Link to="/siniestros/revision">Ir a ubicaciones en revisión</Link>
      </span>
    </div>
  );
}

/** Reclamos que este siniestro dejó en la bandeja de desatendidos (CU09). */
export function ReclamosAlertados({ siniestroId }: { siniestroId: string }) {
  const reclamos = useDemo((e) => e.reclamos);
  const alertados = useMemo(() => reclamos.filter((r) => r.alertas.some((a) => a.siniestroId === siniestroId)), [reclamos, siniestroId]);
  if (alertados.length === 0) return null;
  return (
    <div className={`${css.aviso} ${css.avisoAlerta}`} role="note">
      <Icono nombre="alerta" tamano={16} />
      <div>
        {alertados.map((r) => (
          <p key={r.numero}>
            <TextoAlerta reclamo={r} siniestroId={siniestroId} />
          </p>
        ))}
        <p>
          <Link to="/reclamos">Ver la bandeja de reclamos desatendidos</Link>
        </p>
      </div>
    </div>
  );
}

function TextoAlerta({ reclamo, siniestroId }: { reclamo: Reclamo; siniestroId: string }) {
  const a = reclamo.alertas.find((x) => x.siniestroId === siniestroId)!;
  const tipo = a.tipo === 'cierre-desmentido' ? 'Cierre desmentido por siniestro' : 'Alerta de reclamo desatendido';
  return (
    <>
      <b>{tipo}:</b>{' '}
      <Link to={`/reclamos/${reclamo.numero}`}>
        <Registro>{reclamo.numero}</Registro>
      </Link>
      , {reclamo.lugar}, presentado hace {formato.plural(a.diasSinRespuesta, 'día')} al momento del siniestro.
    </>
  );
}

/** Mapa acercado al lugar: la ciudad de Córdoba para calles, la provincia para rutas. */
export function MapaUbicacion({ siniestro }: { siniestro: Siniestro }) {
  const u = siniestro.ubicacion;
  if (!u) return null;
  const ciudad = !u.ruta && enPlanoCiudad(u);
  const tono = u.estado === 'confirmada' ? 'confirmado' : u.estado === 'descartada' ? 'tenue' : 'revision';
  return (
    <div className={css.mapa}>
      <Mapa
        vista={ciudad ? 'ciudad' : 'provincia'}
        etiqueta={`Mapa con la ubicación del siniestro ${siniestro.id}`}
        encuadre={{ centro: { lat: u.lat, lon: u.lon }, radioKm: ciudad ? 1.4 : 28 }}
        rutaDestacada={u.ruta}
        marcadores={[
          {
            id: siniestro.id,
            lat: u.lat,
            lon: u.lon,
            forma: 'pin',
            tono,
            titulo: `Siniestro ${siniestro.id}, ${nombreLugar(siniestro.lugarExtraido)}`,
            rotulo: siniestro.id,
          },
        ]}
        leyenda={<span>{ciudad ? 'Ciudad de Córdoba' : 'Provincia de Córdoba'} · posición propuesta por el sistema</span>}
      />
    </div>
  );
}

/**
 * Croquis del tramo de 1 km o de la cuadra, con los siniestros confirmados
 * del mismo lugar para dar contexto; el incorporado va seleccionado.
 */
export function CroquisUbicacion({ siniestro }: { siniestro: Siniestro }) {
  const todos = useDemo((e) => e.siniestros);
  const u = siniestro.ubicacion;
  const l = siniestro.lugarExtraido;
  const dibujo = useMemo(() => {
    if (!u || !l) return null;
    if (u.ruta && u.km !== undefined && u.metodo !== 'localidad') {
      const desde = Math.floor(u.km);
      const hasta = desde + 1;
      const vecinos = todos.filter(
        (s) => s.id === siniestro.id || (s.ubicacion?.estado === 'confirmada' && s.ubicacion.ruta === u.ruta && s.ubicacion.km !== undefined && s.ubicacion.km >= desde && s.ubicacion.km <= hasta),
      );
      return { modo: 'tramo' as const, via: u.ruta, desde, hasta, sentido: l.localidad, vecinos, pos: (s: Siniestro) => s.ubicacion!.km! };
    }
    if (l.calle && l.altura !== undefined && !l.calle2) {
      const desde = Math.max(0, Math.floor(l.altura / 100) * 100 - 100);
      const hasta = desde + 300;
      const vecinos = todos.filter(
        (s) =>
          s.id === siniestro.id ||
          enCuadra(s, l.calle!, desde, hasta),
      );
      return { modo: 'cuadra' as const, via: l.calle, desde, hasta, sentido: undefined, vecinos, pos: (s: Siniestro) => s.lugarExtraido!.altura! };
    }
    return null;
  }, [todos, siniestro.id, u, l]);

  if (!dibujo) return null;
  const ordenados = [...dibujo.vecinos].sort((a, b) => a.fechaHecho.localeCompare(b.fechaHecho));
  const datos: SiniestroCroquis[] = ordenados.map((s, i) => ({
    numero: i + 1,
    posicion: dibujo.pos(s),
    tipo: s.tipo,
    fatal: s.victimas.some((v) => v.gravedad === 'fallecido'),
    descripcion: `${formato.fecha(s.fechaHecho)} ${s.tipo ?? 'tipo sin determinar'}${s.id === siniestro.id ? ', este siniestro' : ''}`,
  }));
  const propio = datos[ordenados.findIndex((s) => s.id === siniestro.id)]!;
  const otros = datos.length - 1;
  return (
    <figure className={css.croquis}>
      <figcaption className={css.croquisTitulo}>
        <b>Croquis del {dibujo.modo === 'tramo' ? 'tramo' : 'lugar'}</b>
        <span>
          {dibujo.modo === 'tramo'
            ? `${dibujo.via} · km ${dibujo.desde} a ${dibujo.hasta}`
            : `${dibujo.via} del ${dibujo.desde} al ${dibujo.hasta}`}
          {' · '}
          {otros === 0 ? 'sin otros siniestros confirmados' : `${formato.plural(otros, 'otro siniestro confirmado', 'otros siniestros confirmados')}`} · este siniestro es el n.º{' '}
          {propio.numero}
        </span>
      </figcaption>
      <Croquis modo={dibujo.modo} via={dibujo.via} desde={dibujo.desde} hasta={dibujo.hasta} sentido={dibujo.sentido} siniestros={datos} seleccionado={propio.numero} />
    </figure>
  );
}

function enCuadra(s: Siniestro, calle: string, desde: number, hasta: number): boolean {
  const ls = s.lugarExtraido;
  if (s.ubicacion?.estado !== 'confirmada' || !ls || ls.calle !== calle || ls.calle2 || ls.altura === undefined) return false;
  return ls.altura >= desde && ls.altura <= hasta;
}

/** Chip del estado de la ubicación. */
export function ChipUbicacion({ u, corto }: { u: Ubicacion | null; corto?: boolean }) {
  if (!u) return <ChipEstado estado="pendiente">Sin ubicación</ChipEstado>;
  return <ChipEstado estado={u.estado}>{corto ? TEXTO_ESTADO_UBICACION[u.estado] : undefined}</ChipEstado>;
}
