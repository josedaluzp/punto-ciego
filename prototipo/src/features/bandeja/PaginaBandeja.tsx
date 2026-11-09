/**
 * CU10 Consultar bandeja de reclamos desatendidos (RF17) y la superficie de
 * CU09: las alertas que emite la confirmación de un siniestro aparecen acá al
 * instante, porque la bandeja se deriva del store.
 *
 * Orden por omisión (`ordenarBandeja`), no por riesgo: primero los reclamos
 * con alerta por siniestros posteriores y días sin respuesta; después los
 * abiertos sin alerta por antigüedad (2.a).
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { enPlanoCiudad, type Plano } from '../../dominio/proyeccion';
import { diasSinRespuesta, ordenarBandeja } from '../../dominio/reclamos';
import { fecha, fechaCorta, plural } from '../../dominio/formato';
import type { EstadoReclamo, Reclamo } from '../../dominio/tipos';
import { hoy } from '../../estado/reloj';
import { useDemo } from '../../estado/store';
import {
  ChipEstado,
  FilaFiltros,
  Mapa,
  Select,
  Shell,
  Tabla,
  Vacio,
  claseBoton,
  textoEstado,
  type Columna,
  type Marcador,
} from '../../ui';
import { LugarReclamo } from './LugarReclamo';
import { claveAlerta, cierreDesmentido, estadoFila } from './modelo';
import css from './Bandeja.module.css';

type FiltroEstado = 'todos' | EstadoReclamo;

const sinDato = (r: Reclamo) => r.fechaPresentacion === null;

export function PaginaBandeja() {
  const [params, setParams] = useSearchParams();
  const navegar = useNavigate();
  const todos = params.get('vista') === 'todos';
  const filtro = (params.get('estado') ?? 'todos') as FiltroEstado;
  const reclamos = useDemo((e) => e.reclamos);
  const siniestros = useDemo((e) => e.siniestros);
  const dia = hoy();

  const enBandeja = useMemo(() => ordenarBandeja(reclamos, dia), [reclamos, dia]);
  const filas = useMemo(() => {
    if (!todos) return enBandeja;
    const lista = ordenarBandeja(reclamos, dia, { incluirCerrados: true });
    return filtro === 'todos' ? lista : lista.filter((r) => r.estado === filtro);
  }, [todos, filtro, enBandeja, reclamos, dia]);

  const conAlerta = enBandeja.filter((r) => r.alerta).length;
  const [sel, setSel] = useState<string | null>(null);
  const elegido = filas.find((r) => r.numero === sel) ?? filas[0] ?? null;

  const [plano, setPlano] = useState<Plano>('ciudad');
  useEffect(() => {
    if (elegido) setPlano(enPlanoCiudad(elegido) ? 'ciudad' : 'provincia');
    // Al elegir otro reclamo el mapa salta al plano que lo contiene.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegido?.numero]);

  const elegir = (r: Reclamo) => {
    setSel(r.numero);
    // En pantalla angosta la vista previa queda lejos: se abre el reclamo.
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches) navegar(`/reclamos/${r.numero}`);
  };

  const cambiarVista = (v: string) => {
    const p = new URLSearchParams(params);
    if (v === 'todos') p.set('vista', 'todos');
    else {
      p.delete('vista');
      p.delete('estado');
    }
    setParams(p);
  };
  const cambiarFiltro = (v: string) => {
    const p = new URLSearchParams(params);
    if (v === 'todos') p.delete('estado');
    else p.set('estado', v);
    setParams(p);
  };

  const marcadores = useMemo<Marcador[]>(() => {
    const visibles = filas.filter((r) => (plano === 'ciudad' ? enPlanoCiudad(r) : true));
    const ms: Marcador[] = [];
    for (const r of visibles) {
      if (!r.alerta || r.estado === 'cerrado') continue;
      for (const id of r.siniestrosPosteriores) {
        const s = siniestros.find((x) => x.id === id);
        if (!s?.ubicacion) continue;
        ms.push({
          id: `s|${r.numero}|${id}`,
          lat: s.ubicacion.lat,
          lon: s.ubicacion.lon,
          forma: 'punto',
          tono: 'riesgo',
          tamano: 0,
          titulo: `Siniestro del ${fecha(s.fechaHecho)}, posterior a ${r.numero}`,
        });
      }
    }
    for (const r of visibles) {
      const alerta = r.alerta && r.estado !== 'cerrado';
      ms.push({
        id: r.numero,
        lat: r.lat,
        lon: r.lon,
        forma: 'punto',
        tono: alerta ? 'alerta' : r.estado === 'en-verificacion' ? 'carbon' : 'tenue',
        tamano: alerta ? 0.75 : 0.2,
        rotulo: r.numero === elegido?.numero ? r.numero : undefined,
        titulo: `${r.numero}, ${r.lugar}: ${textoEstado(claveAlerta(r))}`,
      });
    }
    return ms;
  }, [filas, siniestros, plano, elegido?.numero]);

  const columnas: Columna<Reclamo>[] = [
    {
      clave: 'reclamo',
      titulo: 'Reclamo',
      render: (r) => <LugarReclamo r={r} />,
      orden: todos ? (r) => r.numero : undefined,
    },
    {
      clave: 'presentado',
      titulo: 'Presentado',
      render: (r) => (r.fechaPresentacion ? <span className={css.fecha}>{fecha(r.fechaPresentacion)}</span> : <span className={css.sd}>s/d</span>),
      orden: todos ? (r) => r.fechaPresentacion : undefined,
      ocultarEnMovil: true,
    },
    {
      clave: 'dias',
      titulo: 'Días',
      tituloCompleto: 'Días sin respuesta',
      alinear: 'derecha',
      render: (r) => {
        if (r.estado === 'cerrado') return <span className={css.sd}>—</span>;
        const d = diasSinRespuesta(r, dia);
        return d === null ? <span className={css.sd}>s/d</span> : d;
      },
      orden: todos ? (r) => (r.estado === 'cerrado' ? null : diasSinRespuesta(r, dia)) : undefined,
    },
    {
      clave: 'siniestros',
      titulo: (
        <>
          Sin.<span className={css.ocultableTexto}> posteriores</span>
        </>
      ),
      tituloCompleto: 'Siniestros posteriores al reclamo',
      alinear: 'derecha',
      render: (r) =>
        sinDato(r) ? <span className={css.sd}>s/d</span> : <b className={r.siniestrosPosteriores.length ? css.cifraAlerta : css.cifraCero}>{r.siniestrosPosteriores.length}</b>,
      orden: todos ? (r) => r.siniestrosPosteriores.length : undefined,
    },
    {
      clave: 'alerta',
      titulo: 'Alerta',
      render: (r) => <ChipEstado estado={claveAlerta(r)} />,
      ocultarEnMovil: true,
    },
    {
      clave: 'estado',
      titulo: 'Estado',
      render: (r) => <span className={css.estado}>{textoEstado(r.estado)}</span>,
      orden: todos ? (r) => r.estado : undefined,
    },
  ];

  const titulo = todos ? 'Todos los reclamos' : 'Bandeja de reclamos desatendidos';
  const detalle = todos
    ? `${plural(filas.length, 'reclamo')}${filtro !== 'todos' ? ` ${textoEstado(filtro)}` : ''}`
    : `${conAlerta} con alerta · ${enBandeja.length - conAlerta} abiertos sin alerta`;

  return (
    <Shell titulo={titulo} cu="CU10" detalle={detalle}>
      <FilaFiltros
        conteo={
          todos
            ? 'Incluye los cerrados · ordenable por encabezado'
            : conAlerta > 0
              ? 'Ordena por siniestros posteriores y días sin respuesta, no por el riesgo del lugar'
              : 'No hay reclamos con alerta: abiertos por antigüedad'
        }
      >
        <Select
          etiqueta="Vista"
          enLinea
          valor={todos ? 'todos' : 'desatendidos'}
          onCambio={cambiarVista}
          opciones={[
            { valor: 'desatendidos', texto: 'Desatendidos primero' },
            { valor: 'todos', texto: 'Todos los reclamos' },
          ]}
        />
        {todos && (
          <Select
            etiqueta="Estado"
            enLinea
            valor={filtro}
            onCambio={cambiarFiltro}
            opciones={[
              { valor: 'todos', texto: 'Todos' },
              { valor: 'abierto', texto: 'Abierto' },
              { valor: 'en-verificacion', texto: 'En verificación' },
              { valor: 'reabierto', texto: 'Reabierto' },
              { valor: 'cerrado', texto: 'Cerrado' },
            ]}
          />
        )}
      </FilaFiltros>

      <div className={css.trabajo}>
        <section className={css.lista} aria-label="Reclamos">
          <Tabla
            key={todos ? 'todos' : 'bandeja'}
            etiqueta={titulo}
            columnas={columnas}
            filas={filas}
            claveFila={(r) => r.numero}
            seleccionada={elegido?.numero ?? null}
            onSeleccionar={elegir}
            estadoFila={estadoFila}
            vacio={
              <Vacio titulo="No hay reclamos en este estado">
                Elegí otro estado en el filtro, o volvé a la bandeja de desatendidos.
              </Vacio>
            }
            pie={
              !todos && (
                <>
                  Rojo: reclamo con alerta (un siniestro confirmado después de su presentación). Ámbar rayado: en verificación sin
                  alerta. La alerta la emite el sistema al confirmar la ubicación de un siniestro (CU09).
                </>
              )
            }
          />
        </section>

        <aside className={css.lateral} aria-label="Reclamo elegido">
          <div className={css.mapaCaja}>
            <Mapa
              key={plano}
              vista={plano}
              etiqueta={`Mapa de ${plano === 'ciudad' ? 'la ciudad' : 'la provincia'} de Córdoba con los reclamos y los siniestros posteriores`}
              marcadores={marcadores}
              seleccionado={elegido?.numero ?? null}
              onSeleccionar={(id) => setSel(id.startsWith('s|') ? id.split('|')[1]! : id)}
              leyenda={
                <span className={css.leyenda}>
                  <span><span aria-hidden="true" className={css.ptoAlerta} /> con alerta</span>
                  <span><span aria-hidden="true" className={css.ptoSiniestro} /> siniestro posterior</span>
                  <span><span aria-hidden="true" className={css.ptoVerif} /> en verificación</span>
                  <span><span aria-hidden="true" className={css.ptoTenue} /> sin alerta</span>
                </span>
              }
            />
            <div className={css.planos} role="group" aria-label="Plano del mapa">
              {(['ciudad', 'provincia'] as const).map((p) => (
                <button key={p} type="button" className={css.plano} aria-pressed={plano === p} onClick={() => setPlano(p)}>
                  {p === 'ciudad' ? 'Ciudad' : 'Provincia'}
                </button>
              ))}
            </div>
          </div>
          {elegido ? <VistaPrevia r={elegido} /> : null}
        </aside>
      </div>
    </Shell>
  );
}

function VistaPrevia({ r }: { r: Reclamo }) {
  const desmentido = cierreDesmentido(r);
  const historial = [...r.historial].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return (
    <section className={css.previa} aria-live="polite" aria-label={`Vista previa de ${r.numero}`}>
      <div className={css.previaCabeza}>
        <h2 className={css.previaTitulo}>{r.lugar}</h2>
        <ChipEstado estado={claveAlerta(r)} />
      </div>
      {r.foto ? (
        <figure className={css.previaFoto}>
          <img src={r.foto} alt={`Fotografía adjunta al reclamo ${r.numero}`} width={640} height={360} loading="lazy" />
          <figcaption>Foto ilustrativa · no es este punto</figcaption>
        </figure>
      ) : r.evidencia ? (
        <p className={css.previaNota}>
          Caso documentado: {r.evidencia.medio}, {fecha(r.evidencia.fecha)}. La fotografía es del medio y se cita, no se reproduce.
        </p>
      ) : (
        <p className={css.previaNota}>El vecino no adjuntó fotografía.</p>
      )}
      {desmentido && (
        <p className={css.desmentido}>
          Cierre desmentido: lo cerró {desmentido.por} el {fecha(desmentido.en)} por {desmentido.motivo}, y un siniestro posterior lo reabrió.
        </p>
      )}
      <ol className={css.cronologia}>
        {historial.map((h, i) => (
          <li key={i} className={h.tipo === 'siniestro' || h.tipo === 'alerta' || h.tipo === 'reapertura' ? css.hitoAlerta : undefined}>
            <span className={css.fecha}>{fechaCorta(h.fecha)}</span> {h.texto}
          </li>
        ))}
        {r.estado !== 'cerrado' && (
          <li className={css.hitoHoy}>
            <span className={css.fecha}>hoy</span> Sin intervención registrada
          </li>
        )}
      </ol>
      <Link to={`/reclamos/${r.numero}`} className={`${claseBoton('primario')} ${css.abrir}`}>
        Abrir {r.numero}
      </Link>
    </section>
  );
}
