/** Rutas registradas; las recorre la prueba de humo (e2e/smoke.spec.ts). */
export const RUTAS = [
  '/siniestros/cronicas',
  '/siniestros/revision',
  '/priorizacion',
  '/priorizacion/fichas',
  '/priorizacion/fichas/FI-2026-0042',
  '/reclamo',
  '/reclamos',
  '/reclamos?vista=todos',
  '/reclamos/PN-2026-0186',
  '/componentes',
] as const;
