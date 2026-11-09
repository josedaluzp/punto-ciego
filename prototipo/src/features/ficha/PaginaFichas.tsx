/**
 * Fichas emitidas: número, fecha, lugar, índice, quién la emitió y sus
 * contramedidas, con búsqueda y filtros. Cada fila abre su ficha. Desde acá
 * también se emite una nueva eligiendo la concentración.
 */
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CATALOGO_CONTRAMEDIDAS } from '../../datos/contramedidas';
import { formato, nombreConcentracion } from '../../dominio';
import type { Concentracion, Ficha } from '../../dominio';
import { hoy } from '../../estado/reloj';
import { useConcentraciones } from '../../estado/selectores';
import { useDemo } from '../../estado/store';
import { Boton, FilaFiltros, IdentidadLugar, Registro, RomboIndice, Select, Shell, Tabla, Vacio, claseBoton, type Columna } from '../../ui';
import { Busqueda } from './Busqueda';
import css from './ficha.module.css';

interface Fila {
  ficha: Ficha;
  c: Concentracion | undefined;
  lugar: string;
}

const NOMBRE_MEDIDA = new Map(CATALOGO_CONTRAMEDIDAS.map((m) => [m.id, m.nombre]));

export function PaginaFichas() {
  const fichas = useDemo((e) => e.fichas);
  const cs = useConcentraciones();
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState('');
  const [emisor, setEmisor] = useState('');
  const [via, setVia] = useState('');

  const filas: Fila[] = useMemo(() => {
    const porId = new Map(cs.map((c) => [c.id, c]));
    return fichas.map((ficha) => {
      const c = porId.get(ficha.concentracionId);
      return { ficha, c, lugar: c ? nombreConcentracion(c) : `Concentración ${ficha.concentracionId}` };
    });
  }, [fichas, cs]);

  const emisores = [...new Set(fichas.map((f) => f.emitidaPor))].sort();
  const q = busqueda.trim().toLowerCase();
  const visibles = filas.filter(
    (f) =>
      (!q || `${f.ficha.numero} ${f.ficha.concentracionId} ${f.lugar} ${f.c?.localidad ?? ''}`.toLowerCase().includes(q)) &&
      (!emisor || f.ficha.emitidaPor === emisor) &&
      (!via || (via === 'ruta' ? f.c?.unidad === 'tramo' : f.c?.unidad === 'punto')),
  );
  const filtrando = !!(q || emisor || via);
  const limpiar = () => {
    setBusqueda('');
    setEmisor('');
    setVia('');
  };

  const columnas: Columna<Fila>[] = [
    {
      clave: 'numero',
      titulo: 'Número',
      ancho: '150px',
      render: (f) => (
        <Link to={`/priorizacion/fichas/${f.ficha.numero}`} className={`registro ${css.enlaceNumero}`} onClick={(e) => e.stopPropagation()}>
          {f.ficha.numero}
        </Link>
      ),
      orden: (f) => f.ficha.numero,
    },
    { clave: 'fecha', titulo: 'Fecha', ancho: '108px', render: (f) => <span className={css.cifra}>{formato.fecha(f.ficha.fecha)}</span>, orden: (f) => f.ficha.fecha, ocultarEnMovil: true },
    {
      clave: 'lugar',
      titulo: 'Lugar',
      render: (f) => (
        <span className={css.lugarFila}>
          <IdentidadLugar ruta={f.c?.ruta} calle={f.c?.calle} tamano={32} />
          <span>
            <span className={css.lugarNombre}>{f.lugar}</span>
            <span className={css.lugarSub}>
              <Registro tenue>{f.ficha.concentracionId}</Registro>
              {f.c && <> · {f.c.localidad}</>}
            </span>
          </span>
        </span>
      ),
      orden: (f) => f.lugar,
    },
    { clave: 'indice', titulo: 'Índice', alinear: 'derecha', ancho: '76px', render: (f) => <RomboIndice valor={f.ficha.indice} />, orden: (f) => f.ficha.indice },
    { clave: 'emisor', titulo: 'Emitida por', ancho: '130px', render: (f) => f.ficha.emitidaPor, orden: (f) => f.ficha.emitidaPor, ocultarEnMovil: true },
    {
      clave: 'medidas',
      titulo: 'Contramedidas',
      render: (f) =>
        f.ficha.contramedidaIds.length === 0 ? (
          <span className={css.tenue}>sin recomendación</span>
        ) : (
          <span className={css.medidasFila}>
            <span>{NOMBRE_MEDIDA.get(f.ficha.contramedidaIds[0]!)}</span>
            {f.ficha.contramedidaIds.length > 1 && <span className={css.tenue}> y {f.ficha.contramedidaIds.length - 1} más</span>}
          </span>
        ),
      orden: (f) => f.ficha.contramedidaIds.length,
      ocultarEnMovil: true,
    },
  ];

  return (
    <Shell
      titulo="Fichas emitidas"
      cu="CU06 · CU07"
      detalle={formato.plural(fichas.length, 'ficha')}
      acciones={
        <Link to="/priorizacion/fichas/nueva" className={claseBoton('primario', 'chico')}>
          Nueva ficha
        </Link>
      }
    >
      <div className={css.listado}>
        <FilaFiltros
          conteo={
            <span aria-live="polite">
              {filtrando ? `${visibles.length} de ${formato.plural(fichas.length, 'ficha')}` : formato.plural(fichas.length, 'ficha')}
            </span>
          }
        >
          <Busqueda etiqueta="Buscar ficha" placeholder="FI-2026-0042, RN 9, C-0007…" valor={busqueda} onCambio={setBusqueda} />
          <Select
            etiqueta="Emitida por"
            enLinea
            valor={emisor}
            onCambio={setEmisor}
            opciones={[{ valor: '', texto: 'Todos' }, ...emisores.map((n) => ({ valor: n, texto: n }))]}
          />
          <Select
            etiqueta="Tipo de vía"
            enLinea
            valor={via}
            onCambio={setVia}
            opciones={[
              { valor: '', texto: 'Todas' },
              { valor: 'ruta', texto: 'Ruta' },
              { valor: 'calle', texto: 'Calle' },
            ]}
          />
        </FilaFiltros>
        <Tabla
          etiqueta="Fichas de intervención emitidas"
          columnas={columnas}
          filas={visibles}
          claveFila={(f) => f.ficha.numero}
          onSeleccionar={(f) => navigate(`/priorizacion/fichas/${f.ficha.numero}`)}
          ordenInicial={{ clave: 'numero', sentido: 'desc' }}
          vacio={
            fichas.length === 0 ? (
              <Vacio
                titulo="Todavía no se emitió ninguna ficha"
                accion={
                  <Link to="/priorizacion/fichas/nueva" className={claseBoton('primario')}>
                    Emitir la primera
                  </Link>
                }
              >
                Las fichas se emiten desde los lugares priorizados o con «Nueva ficha».
              </Vacio>
            ) : (
              <Vacio titulo="Ninguna ficha coincide con los filtros" accion={<Boton onClick={limpiar}>Limpiar los filtros</Boton>}>
                Buscá por número de ficha, de concentración, ruta o calle.
              </Vacio>
            )
          }
        />
        <p className={css.notaPagina}>
          Cada ficha registra la fecha de emisión y quién la emitió. En la demo, «hoy» es el{' '}
          <span className={css.cifra}>{formato.fecha(hoy())}</span>.
        </p>
      </div>
    </Shell>
  );
}
