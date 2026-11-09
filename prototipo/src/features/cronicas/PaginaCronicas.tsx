/**
 * CU01 y CU02. `/siniestros/cronicas` muestra los siniestros registrados con
 * el método y la confianza de su ubicación; `?incorporar` abre «Incorporar
 * crónica»; `?siniestro=S-0472` selecciona un siniestro y muestra su detalle.
 */
import { Link, useSearchParams } from 'react-router-dom';
import { miles } from '../../dominio/formato';
import { useDemo } from '../../estado/store';
import { Shell, claseBoton } from '../../ui';
import { IncorporarCronica } from './IncorporarCronica';
import { ListaSiniestros } from './ListaSiniestros';

export function PaginaCronicas() {
  const [params, setParams] = useSearchParams();
  const cronicas = useDemo((e) => e.cronicas.length);
  const siniestros = useDemo((e) => e.siniestros.length);
  const incorporando = params.has('incorporar');
  const seleccionado = params.get('siniestro');

  const seleccionar = (id: string | null) => {
    const p = new URLSearchParams(params);
    if (id) p.set('siniestro', id);
    else p.delete('siniestro');
    setParams(p, { replace: true });
  };

  return (
    <Shell
      titulo={incorporando ? 'Incorporar crónica' : 'Siniestros registrados'}
      cu="CU01 · CU02"
      detalle={`${miles(siniestros)} siniestros · ${miles(cronicas)} crónicas`}
      acciones={
        incorporando ? (
          <Link to="/siniestros/cronicas" className={claseBoton('secundario')}>
            Volver a los siniestros
          </Link>
        ) : (
          <Link to="/siniestros/cronicas?incorporar" className={claseBoton('primario')}>
            Incorporar crónica
          </Link>
        )
      }
    >
      {incorporando ? <IncorporarCronica key="incorporar" /> : <ListaSiniestros seleccionado={seleccionado} onSeleccionar={seleccionar} />}
    </Shell>
  );
}
