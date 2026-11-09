/**
 * Todas las rutas de la demo (SPEC, "Rutas y paquetes"). Cada feature
 * reemplaza el contenido de su página en `src/features/<feature>/`; la tabla
 * de rutas es de la base.
 */
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { PaginaBandeja } from '../features/bandeja/PaginaBandeja';
import { PaginaReclamoDetalle } from '../features/bandeja/PaginaReclamoDetalle';
import { PaginaCronicas } from '../features/cronicas/PaginaCronicas';
import { PaginaFicha } from '../features/ficha/PaginaFicha';
import { PaginaFichas } from '../features/ficha/PaginaFichas';
import { PaginaPriorizacion } from '../features/priorizacion/PaginaPriorizacion';
import { PaginaReclamo } from '../features/reclamo-vecinal/PaginaReclamo';
import { PaginaRevision } from '../features/revision/PaginaRevision';
import { Shell, Vacio, claseBoton } from '../ui';
import { Catalogo } from './Catalogo';

export function Rutas() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/priorizacion" replace />} />
      <Route path="/siniestros" element={<Navigate to="/siniestros/cronicas" replace />} />
      <Route path="/siniestros/cronicas" element={<PaginaCronicas />} />
      <Route path="/siniestros/revision" element={<PaginaRevision />} />
      <Route path="/priorizacion" element={<PaginaPriorizacion />} />
      <Route path="/priorizacion/fichas" element={<PaginaFichas />} />
      <Route path="/priorizacion/fichas/:numero" element={<PaginaFicha />} />
      <Route path="/reclamo" element={<PaginaReclamo />} />
      <Route path="/reclamos" element={<PaginaBandeja />} />
      <Route path="/reclamos/:numero" element={<PaginaReclamoDetalle />} />
      <Route path="/componentes" element={<Catalogo />} />
      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  );
}

function NoEncontrada() {
  return (
    <Shell titulo="Página inexistente" cu="—">
      <Vacio
        titulo="Esta dirección no corresponde a ninguna pantalla de la demo"
        accion={
          <Link to="/priorizacion" className={claseBoton('primario')}>
            Ir a los lugares priorizados
          </Link>
        }
      >
        Revisá la dirección o elegí una pantalla en el riel.
      </Vacio>
    </Shell>
  );
}
