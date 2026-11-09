import type { Reclamo } from '../../dominio/tipos';
import { ChipEstado, IdentidadLugar, Mojon, Registro } from '../../ui';
import { cuadraDelLugar } from './modelo';
import css from './Bandeja.module.css';

/** Identidad del lugar reclamado: escudo de ruta o chapa de calle, mojón, número y ámbito. */
export function LugarReclamo({ r }: { r: Reclamo }) {
  const cuadra = cuadraDelLugar(r.lugar);
  return (
    <div className={css.lugar}>
      <IdentidadLugar ruta={r.ruta} calle={cuadra?.calle} tamano={34} />
      <div className={css.lugarTexto}>
        <p className={css.lugarNombre}>
          <span>{r.lugar}</span>
          {r.origen === 'real' && <ChipEstado estado="caso-documentado" />}
        </p>
        <p className={css.lugarSub}>
          <Registro>{r.numero}</Registro>
          <span aria-hidden="true"> · </span>
          <span>{r.evidencia ? `${r.evidencia.medio.split(',')[0]} · sin fecha de inicio` : r.ambito}</span>
        </p>
      </div>
      {r.km !== undefined && <Mojon km={r.km} />}
    </div>
  );
}
