/** CU04: resultado de «Actualizar concentraciones», con fecha, hora y diferencias. */
import type { ReactNode } from 'react';
import { decimal, fecha, hora, plural } from '../../dominio/formato';
import type { ResultadoActualizacion } from '../../estado/acciones/priorizacion';
import { Icono, Registro } from '../../ui';
import { sinCambios } from './diferencias';
import css from './PaginaPriorizacion.module.css';

const MAX_LINEAS = 6;

export function PanelActualizacion({ resultado, onCerrar }: { resultado: ResultadoActualizacion; onCerrar: () => void }) {
  const { calculo, anterior, diferencias: d } = resultado;
  const otroPeriodo = anterior && (anterior.periodo.desde !== calculo.periodo.desde || anterior.periodo.hasta !== calculo.periodo.hasta);

  const lineas: { clave: string; texto: ReactNode }[] = [
    ...d.nuevas.map((l) => ({
      clave: `n-${l.clave}`,
      texto: (
        <>
          <b>Nueva:</b> <Registro>{l.id}</Registro> {l.nombre}, índice {decimal(l.indice)}, puesto {l.rango}
        </>
      ),
    })),
    ...d.cambiaron.map(({ lugar: l, antes, rangoAntes }) => ({
      clave: `c-${l.clave}`,
      texto: (
        <>
          <b>Cambió:</b> <Registro>{l.id}</Registro> {l.nombre}, índice de {decimal(antes)} a {decimal(l.indice)}
          {rangoAntes !== l.rango && `, puesto de ${rangoAntes} a ${l.rango}`}
        </>
      ),
    })),
    ...d.retiradas.map((l) => ({
      clave: `r-${l.clave}`,
      texto: (
        <>
          <b>Dejó de ser significativa:</b> <Registro>{l.id}</Registro> {l.nombre}
        </>
      ),
    })),
  ];

  return (
    <section className={css.actualizacion} aria-label="Resultado de la actualización" role="status" data-prueba="actualizacion">
      <div className={css.actualizacionTexto}>
        <p>
          <b>
            Concentraciones actualizadas el {fecha(calculo.en)} a las {hora(calculo.en)}
          </b>{' '}
          por {calculo.por}: {plural(calculo.lugares.length, 'concentración significativa', 'concentraciones significativas')} entre {calculo.periodo.desde} y{' '}
          {calculo.periodo.hasta}.
        </p>
        <p className={css.tenue}>
          {anterior ? (
            <>
              Respecto del cálculo del {fecha(anterior.en)} a las {hora(anterior.en)}
              {otroPeriodo && ` (período ${anterior.periodo.desde} a ${anterior.periodo.hasta})`}:{' '}
              {sinCambios(d)
                ? 'sin cambios.'
                : [
                    d.nuevas.length && plural(d.nuevas.length, 'nueva', 'nuevas'),
                    d.cambiaron.length && plural(d.cambiaron.length, 'con otro índice', 'con otro índice'),
                    d.retiradas.length && plural(d.retiradas.length, 'retirada', 'retiradas'),
                    d.reordenadas && plural(d.reordenadas, 'cambió de puesto', 'cambiaron de puesto'),
                  ]
                    .filter(Boolean)
                    .join(', ') + '.'}
            </>
          ) : (
            'Primer cálculo registrado.'
          )}
        </p>
        {lineas.length > 0 && (
          <ul className={css.cambios}>
            {lineas.slice(0, MAX_LINEAS).map((l) => (
              <li key={l.clave}>{l.texto}</li>
            ))}
            {lineas.length > MAX_LINEAS && <li className={css.tenue}>y {lineas.length - MAX_LINEAS} más.</li>}
          </ul>
        )}
      </div>
      <button type="button" className={css.cerrar} onClick={onCerrar} aria-label="Cerrar el resultado de la actualización">
        <Icono nombre="cerrar" tamano={16} />
      </button>
    </section>
  );
}
