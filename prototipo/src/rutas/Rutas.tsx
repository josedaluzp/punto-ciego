/**
 * Todas las rutas de la demo (SPEC, "Rutas y paquetes"). Cada feature
 * reemplaza el contenido de su página en `src/features/<feature>/`; la tabla
 * de rutas es de la base.
 */
import { lazy, Suspense } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { Shell, Vacio, claseBoton } from '../ui';

// Cada pantalla va en su propio chunk (KT-06): la primera carga baja sólo la ruta pedida.
const PaginaBandeja = lazy(() => import('../features/bandeja/PaginaBandeja').then((m) => ({ default: m.PaginaBandeja })));
const PaginaReclamoDetalle = lazy(() => import('../features/bandeja/PaginaReclamoDetalle').then((m) => ({ default: m.PaginaReclamoDetalle })));
const PaginaCronicas = lazy(() => import('../features/cronicas/PaginaCronicas').then((m) => ({ default: m.PaginaCronicas })));
const PaginaFicha = lazy(() => import('../features/ficha/PaginaFicha').then((m) => ({ default: m.PaginaFicha })));
const PaginaFichas = lazy(() => import('../features/ficha/PaginaFichas').then((m) => ({ default: m.PaginaFichas })));
const PaginaPriorizacion = lazy(() => import('../features/priorizacion/PaginaPriorizacion').then((m) => ({ default: m.PaginaPriorizacion })));
const PaginaReclamo = lazy(() => import('../features/reclamo-vecinal/PaginaReclamo').then((m) => ({ default: m.PaginaReclamo })));
const PaginaRevision = lazy(() => import('../features/revision/PaginaRevision').then((m) => ({ default: m.PaginaRevision })));
const Catalogo = lazy(() => import('./Catalogo').then((m) => ({ default: m.Catalogo })));

export function Rutas() {
  return (
    <Suspense fallback={null}>
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
    </Suspense>
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
