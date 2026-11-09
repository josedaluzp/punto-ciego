/**
 * Catálogo de los componentes de la base, con datos de la semilla. Sirve de
 * referencia a las features y de banco de prueba (arrastre, orden de tabla,
 * avisos). No figura en el riel.
 */
import { useMemo, useState } from 'react';
import { nombreConcentracion } from '../dominio/concentraciones';
import { decimal, km, mesAnio, porcentaje } from '../dominio/formato';
import type { LatLon } from '../dominio/geo';
import type { Concentracion } from '../dominio/tipos';
import { useConcentraciones } from '../estado/selectores';
import { useDemo } from '../estado/store';
import {
  AreaTexto,
  Boton,
  CampoTexto,
  ChipEstado,
  Croquis,
  FilaFiltros,
  IdentidadLugar,
  Mapa,
  MedidorConfianza,
  Mojon,
  Registro,
  RomboIndice,
  Select,
  Shell,
  Tabla,
  Vacio,
  avisar,
  type Columna,
  type Marcador,
} from '../ui';
import css from './Catalogo.module.css';

export function Catalogo() {
  const concentraciones = useConcentraciones();
  const siniestros = useDemo((e) => e.siniestros);
  const [sel, setSel] = useState<string>('C-0007');
  const [vista, setVista] = useState<'provincia' | 'ciudad'>('provincia');
  const inicial = useMemo<LatLon>(() => ({ lat: -31.3571, lon: -64.1712 }), []);
  const [pin, setPin] = useState<LatLon>({ lat: -31.3571, lon: -64.1712 });
  const [km694, setKm694] = useState(694.5);

  const c = concentraciones.find((x) => x.id === sel) ?? concentraciones[0];

  const marcadores: Marcador[] = concentraciones.map((x, i) => ({
    id: x.id,
    lat: x.lat,
    lon: x.lon,
    forma: x.unidad === 'tramo' ? 'tramo' : 'punto',
    tono: 'riesgo',
    tamano: x.indice,
    rotulo: i < 6 ? String(i + 1) : undefined,
    titulo: `${i + 1}. ${nombreConcentracion(x)}, índice ${decimal(x.indice)}`,
    ruta: x.ruta,
    kmDesde: x.kmDesde,
    kmHasta: x.kmHasta,
  }));

  const columnas: Columna<Concentracion>[] = [
    { clave: 'id', titulo: 'N.º', render: (x) => <Registro>{x.id}</Registro>, orden: (x) => x.id },
    {
      clave: 'lugar',
      titulo: 'Lugar',
      render: (x) => (
        <div className={css.lugar}>
          <IdentidadLugar ruta={x.ruta} calle={x.calle} tamano={36} />
          <div>
            <p className={css.lugarNombre}>{nombreConcentracion(x)}</p>
            <p className={css.lugarSub}>
              {x.tipoPredominante} · {x.localidad}
            </p>
          </div>
          {x.kmDesde !== undefined && <Mojon km={x.kmDesde} />}
        </div>
      ),
    },
    { clave: 'unidad', titulo: 'Unidad', render: (x) => x.unidad, ocultarEnMovil: true },
    { clave: 'sin', titulo: 'Sin.', tituloCompleto: 'Siniestros', alinear: 'derecha', render: (x) => x.siniestroIds.length, orden: (x) => x.siniestroIds.length, ocultarEnMovil: true },
    { clave: 'fal', titulo: 'Fallec.', tituloCompleto: 'Fallecidos', alinear: 'derecha', render: (x) => x.fallecidos, orden: (x) => x.fallecidos },
    { clave: 'vul', titulo: 'Vulner.', tituloCompleto: 'Vulnerables', alinear: 'derecha', render: (x) => porcentaje(x.vulnerables), orden: (x) => x.vulnerables, ocultarEnMovil: true },
    { clave: 'indice', titulo: 'Índice', alinear: 'derecha', render: (x) => <RomboIndice valor={x.indice} tamano="chico" />, orden: (x) => x.indice },
  ];

  const sinsC = c ? c.siniestroIds.map((id) => siniestros.find((s) => s.id === id)!).filter(Boolean) : [];

  return (
    <Shell titulo="Catálogo de componentes" cu="Base" detalle="piezas compartidas con datos de la semilla">
      <FilaFiltros conteo="Ordenado por índice de riesgo · los reclamos no intervienen">
        <Select
          etiqueta="Vista del mapa"
          enLinea
          valor={vista}
          onCambio={(v) => setVista(v as 'provincia' | 'ciudad')}
          opciones={[
            { valor: 'provincia', texto: 'Provincia de Córdoba' },
            { valor: 'ciudad', texto: 'Ciudad de Córdoba' },
          ]}
        />
      </FilaFiltros>

      <div className={css.trabajo}>
        <section className={css.mapa} aria-label="Mapa">
          {vista === 'provincia' ? (
            <Mapa
              vista="provincia"
              etiqueta="Mapa de la provincia de Córdoba con las concentraciones priorizadas"
              marcadores={marcadores}
              seleccionado={sel}
              onSeleccionar={setSel}
              leyenda={<span>Barra: tramo de 1 km sobre ruta · punto: calle · tamaño según índice</span>}
            />
          ) : (
            <Mapa
              vista="ciudad"
              etiqueta="Mapa de la ciudad de Córdoba con un marcador arrastrable"
              encuadre={{ centro: inicial, radioKm: 2.5 }}
              marcadores={[{ id: 'pin', ...pin, forma: 'pin', tono: 'carbon', titulo: 'Posición corregida', arrastrable: true }]}
              onArrastrar={(_, p) => setPin(p)}
              leyenda={
                <span className="registro" data-prueba="posicion-pin">
                  {pin.lat.toFixed(5)}, {pin.lon.toFixed(5)}
                </span>
              }
            />
          )}
        </section>

        <section className={css.lista} aria-label="Concentraciones">
          <Tabla
            etiqueta="Concentraciones priorizadas"
            columnas={columnas}
            filas={concentraciones.slice(0, 12)}
            claveFila={(x) => x.id}
            seleccionada={sel}
            onSeleccionar={(x) => setSel(x.id)}
            estadoFila={(x) => (x.id === 'C-0025' ? 'alerta' : x.id === 'C-0021' ? 'revision' : undefined)}
            pie="Filas teñidas sólo como muestra de estado: alerta (C-0025) y revisión (C-0021)."
          />
        </section>

        {c && (
          <section className={css.croquis} aria-label="Croquis del lugar seleccionado">
            <div className={css.croquisDibujo}>
              <p className={css.croquisTitulo}>
                <b>Croquis · {nombreConcentracion(c)}</b>
                <span>{c.siniestroIds.length} siniestros</span>
              </p>
              <Croquis
                modo={c.unidad === 'tramo' ? 'tramo' : 'cuadra'}
                via={c.ruta ?? c.calle ?? ''}
                desde={c.unidad === 'tramo' ? c.kmDesde! : (c.altura ?? 0) - 100}
                hasta={c.unidad === 'tramo' ? c.kmHasta! : (c.altura ?? 0) + 100}
                sentido={c.unidad === 'tramo' ? c.localidad : undefined}
                caracterizacion={c.via}
                siniestros={sinsC.map((s, i) => ({
                  numero: i + 1,
                  posicion: c.unidad === 'tramo' ? s.ubicacion!.km! : (s.lugarExtraido?.altura ?? c.altura ?? 0),
                  tipo: s.tipo,
                  fatal: s.victimas.some((v) => v.gravedad === 'fallecido'),
                  descripcion: `${mesAnio(s.fechaHecho)} ${s.tipo ?? ''}`,
                }))}
              />
            </div>
            <div className={css.croquisDatos}>
              <RomboIndice valor={c.indice} tamano="grande" />
              <dl className={css.kv}>
                <dt>Fallecidos</dt>
                <dd>{c.fallecidos}</dd>
                <dt>Vulnerables</dt>
                <dd>{porcentaje(c.vulnerables)}</dd>
                <dt>Predominante</dt>
                <dd>{c.tipoPredominante}</dd>
              </dl>
              <Boton variante="primario" onClick={() => avisar(`Ficha de ${c.id}: la emite feat/ficha`, { detalle: 'Aviso de muestra del catálogo.' })}>
                Emitir ficha de intervención
              </Boton>
            </div>
          </section>
        )}
      </div>

      <div className={css.muestras}>
        <section className={css.muestra}>
          <h2 className={css.h2}>Croquis con marcador arrastrable</h2>
          <Croquis
            modo="tramo"
            via="RN 9"
            desde={694}
            hasta={695}
            sentido="Jesús María"
            siniestros={[]}
            marcador={{ posicion: km694, etiqueta: 'Progresiva corregida', onMover: setKm694 }}
          />
          <p className="registro" data-prueba="km-croquis">
            {km(km694)}
          </p>
        </section>
        <section className={css.muestra}>
          <h2 className={css.h2}>Estados</h2>
          <div className={css.fila}>
            {(['abierto', 'en-verificacion', 'cerrado', 'reabierto', 'desatendido', 'cierre-desmentido', 'confirmada', 'en-revision', 'caso-documentado', 'vulnerable'] as const).map((e) => (
              <ChipEstado key={e} estado={e} />
            ))}
          </div>
          <MedidorConfianza valor={0.86} />
          <MedidorConfianza valor={0.41} />
        </section>
        <section className={css.muestra}>
          <h2 className={css.h2}>Botones y avisos</h2>
          <div className={css.fila}>
            <Boton variante="primario" onClick={() => avisar('Ubicación confirmada', { tono: 'exito' })}>
              Primario
            </Boton>
            <Boton onClick={() => avisar('Datos guardados')}>Secundario</Boton>
            <Boton variante="peligro" onClick={() => avisar('Alerta de reclamo desatendido: PN-2026-0157', { tono: 'alerta', detalle: '90 días sin respuesta' })}>
              Peligro
            </Boton>
            <Boton variante="fantasma" icono="descarga">
              Fantasma
            </Boton>
            <Boton disabled>Deshabilitado</Boton>
          </div>
        </section>
        <section className={css.muestra}>
          <h2 className={css.h2}>Campos</h2>
          <CampoTexto etiqueta="Dirección web" registro placeholder="https://medio-local.example/…" />
          <AreaTexto etiqueta="Texto de la crónica" rows={3} ayuda="El sistema extrae los datos y ubica el hecho." />
          <Vacio titulo="Ningún lugar cumple el filtro">Probá ampliar el período.</Vacio>
        </section>
      </div>
    </Shell>
  );
}
