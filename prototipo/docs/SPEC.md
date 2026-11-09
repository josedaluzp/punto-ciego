# Punto Ciego · demo de la Entrega 4 · especificación de construcción

Fuente de verdad funcional: `entregas/entrega-3/contenido/11-descripcion-del-sistema.md`
(RF01–RF18, CU01–CU11, fichas de casos de uso, diccionario de datos, clases).
Producto: `PRODUCT.md`. Dirección visual: `.impeccable/surfaces/prototipo-src-main-tsx.md`
(contrato de dirección "Acta y croquis", con la lista de lugares tomada de la dirección B).
Comportamiento heredado de la E2: `prototipo/docs/rea-inventario.md`.

## Stack

- `prototipo/` en la raíz del repo. Vite + React 18 + TypeScript estricto. react-router-dom
  (BrowserRouter; `vercel.json` con rewrite SPA). Sin backend.
- Estado: un store único (zustand o useSyncExternalStore propio) persistido en
  `localStorage` bajo `punto-ciego:v1`, con **semilla determinista** y acción
  "Restablecer datos de demostración" visible en el riel.
- Mapa: SVG propio a partir de `entregas/entrega-2/diseno-navegacion/datos/mapa.json`
  (provincia de Córdoba: `provincias.cordoba` y ciudad `ciudades.cordoba`). Un script
  `scripts/extraer-cartografia.mjs` genera `src/datos/cartografia.json` (solo Córdoba).
  Proyección lat/lon ↔ x/y documentada en `src/dominio/proyeccion.ts` (ajuste lineal por
  eje con los puntos de control reales, como `entregas/entrega-3/scripts/interfaces.py`).
- Fuentes: Archivo y Courier Prime autoalojadas (`@fontsource/archivo`, `@fontsource/courier-prime`).
- Tests: Vitest para dominio (`src/dominio/**/*.test.ts`), Playwright para e2e
  (`e2e/*.spec.ts`, Chromium, desktop 1440×900 y móvil 390×844). `npm run test`,
  `npm run e2e`, `npm run build`, `npm run lint` (eslint + tsc --noEmit) deben pasar.

## Rutas y paquetes (el riel las agrupa así)

| Ruta | Pantalla | CU | Dueño |
|---|---|---|---|
| `/` | redirige a `/priorizacion` | | base |
| `/siniestros/cronicas` | Lista de siniestros e "Incorporar crónica" | CU01, CU02 | feat/cronicas |
| `/siniestros/revision` | Ubicaciones en revisión, mapa con marcador arrastrable | CU03 | feat/revision |
| `/priorizacion` | Lugares priorizados: mapa + lista + croquis | CU04, CU05 | feat/priorizacion |
| `/priorizacion/fichas` y `/priorizacion/fichas/:numero` | Fichas emitidas y ficha de intervención | CU06, CU07 | feat/ficha |
| `/reclamo` | Vecino, móvil: presentar reclamo y comprobante | CU08 | feat/reclamo-vecinal |
| `/reclamos` y `/reclamos/:numero` | Bandeja de desatendidos, detalle, agendar inspección, cierre | CU09 (superficie), CU10, CU11 | feat/bandeja |

`/reclamo` no lleva el riel del organismo (es la cara pública). Selector de usuario de
demostración en la barra: L. Ahumada (Analista de siniestralidad), R. Quiroga (Técnico de
tránsito), M. Ferreyra (Funcionario a cargo). Quién hace cada acción queda registrado.

## Dominio (`src/dominio/`, puro, con tests) — lo construye la base

Tipos según el diagrama de clases de la E3:
- `Cronica { id, medio, fechaPublicacion, url, texto, siniestroId }`
- `Siniestro { id, fechaHecho, lugarExtraido, victimas: {tipoUsuario}[], tipo, cronicaIds[] , ubicacion }`
- `Ubicacion { metodo: 'normalizacion'|'poste'|'localidad'|'manual', precision: 'cuadra'|'interseccion'|'ruta-progresiva'|'corredor'|'barrio', confianza: 0..1, x, y, lat, lon, ruta?, km?, estado: 'confirmada'|'en-revision'|'descartada'|'pendiente', revisadaPor?, revisadaEn? }`
- `Concentracion { id 'C-0007', unidad: 'punto'|'tramo', siniestroIds, indice, fallecidos, vulnerables, tipoPredominante, via: {calzada, carriles, banquina}, ruta?, kmDesde?, kmHasta?, calle?, altura?, localidad }`
- `Contramedida { id, nombre, tipoVia: 'calle'|'ruta', tipoSiniestro, factor, calificacion 1..5, referencia }` (catálogo precargado, factores rotulados "de demostración").
- `Ficha { numero 'FI-2026-0042', concentracionId, fecha, emitidaPor, contramedidaIds }`
- `Reclamo { numero 'PN-2026-0131', fechaPresentacion, x, y, lat, lon, descripcion, foto?, estado: 'abierto'|'en-verificacion'|'cerrado'|'reabierto', alerta: boolean, siniestrosPosteriores: id[], inspeccionAgendada?, cierre?: {motivo, respaldos[], por, en}, historial: {fecha, texto, por?}[] }`

Funciones (todas con tests):
- `extraerDeCronica(texto, fechaPublicacion)` → lugar, fecha del hecho, fallecidos, tipo de usuario por víctima, tipo de siniestro (reglas sobre el español de las crónicas: "ruta nacional 9, a la altura del kilómetro 694", "Av. Colón al 5300", "en la intersección de X y Y", "barrio X", nombres de usuario: motociclista, peatón, ciclista, conductor, acompañante). RF02.
- `buscarDuplicado(extraido, siniestros)` → fecha igual ±1 día, lugar equivalente, similitud de texto (Jaccard de tokens ≥ 0,35). RF03.
- `clasificarPrecision(lugar)` RF04; `georreferenciar(lugar)` RF05/RF06: calle o intersección → servicio de normalización **simulado** (gazetteer local de calles de Córdoba con alturas; ver `src/datos/calles.json`); ruta con progresiva → capa de postes kilométricos (`src/datos/postes.json`, interpolada a lo largo de la geometría de la ruta), **nunca** el servicio de normalización; sin poste → localidad con confianza baja. Devuelve método y confianza. RF07.
- `UMBRAL_CONFIANZA = 0.70`; por debajo → `en-revision` y fuera de todo cálculo. RF08.
- `agruparConcentraciones(siniestrosConfirmados)` RF10: punto urbano por radio de 150 m; ruta por tramo de 1 km de progresiva; conserva solo las significativas (≥ 2 siniestros y prueba de Poisson contra la tasa media del ámbito, p < 0,05; documentar la fórmula en el código).
- `indiceRiesgo(c)` RF11 = 0,5·severidad + 0,3·frecuencia + 0,2·vulnerables, normalizado 0..1; **no** recibe reclamos.
- `recomendarContramedidas(concentracion, catalogo)` RF14: filtra por tipo de vía y tipo predominante, ordena por factor ascendente.
- `evaluarReclamosDesatendidos(siniestroConfirmado, reclamos)` RF16: radio 300 m; siniestro posterior a la presentación; reclamo abierto, en verificación o reabierto → alerta; reclamo cerrado antes del siniestro → reabierto conservando la fecha original, alerta "cierre desmentido". Se ejecuta al confirmar una ubicación (CU02 y CU03).
- `ordenarBandeja(reclamos)` RF17: siniestros posteriores desc, días sin respuesta desc.
- `puedeCerrar(cierre)` RF18: motivo + ≥ 1 respaldo.

## Semilla (`src/datos/semilla.ts`)

Determinista, provincia de Córdoba, 2021–2025. Debe reproducir lo que muestra el
documento (Figuras 15 a 21 de `entregas/entrega-3/interfaces/*.png`): las 6 primeras
concentraciones de la tabla de Priorización con sus valores (RN 9 km 694–695 índice 0,91,
etc.), la ficha FI-2026-0042 con sus 4 siniestros y 3 contramedidas (bandas sonoras 0,72;
pavimentación de banquina 0,81; demarcación de bordes 0,88), las 3 ubicaciones en revisión
(Av. Circunvalación 0,41; Barrio Villa El Libertador 0,22; RN 36 km 790 0,55) y la bandeja
(PN-2026-0131 Av. Rafael Núñez al 2200, PN-2026-0186 Av. Colón al 5300 en verificación,
PN-2026-0204 RN 36 km 612 reabierto con cierre desmentido, PN-2026-0157, el caso
documentado de Agustín Piaggio al 1000). Total 38 concentraciones significativas.
Además, 2–3 **crónicas de ejemplo sin incorporar** listas para pegar en CU01, una de las
cuales cae a menos de 300 m de un reclamo abierto, para que la demo dispare la alerta en
vivo. Todo rotulado "Datos sintéticos de demostración"; solo el caso documentado de la E2
conserva su evidencia real.

## Componentes compartidos (`src/ui/`) — los construye la base

`Shell` (riel + barra + aviso sintético + selector de usuario + restablecer), `Mapa`
(provincia y ciudad, capas, marcadores, `onMarkerDrag`, zoom a un lugar), `Croquis`
(tramo de ruta por progresiva o cuadra urbana por altura, siniestros numerados con el
gesto de su tipo, rótulo "posición ilustrativa"), `IdentidadLugar` (escudo de ruta
nacional/provincial, chapa de calle, mojón KM), `RomboIndice`, `Boton`, `Select`,
`Tabla` (encabezados ordenables, fila seleccionada con borde interior, estado que tiñe
la fila), `Chip de estado`, `Vacío`, `Toast`. Tokens en `src/ui/tokens.css`.

## Reglas para los agentes de features

- Cada feature trabaja **solo** en `src/features/<feature>/`, sus tests en
  `e2e/<feature>.spec.ts` y, si hace falta, agrega acciones al store en
  `src/estado/acciones/<feature>.ts`. Cambios a `src/ui/`, `src/dominio/` o al router se
  justifican en el PR y se mantienen mínimos.
- La página de cada ruta ya existe como marcador en la base; el feature la reemplaza.
- Copia en español rioplatense, términos del documento, sin inventar datos reales.
- Antes de editar UI: leer `C:\Users\PC\.claude\skills\impeccable\reference\craft-floor.md`
  y respetar el contrato de dirección. Animación según Emil Kowalski: ease-out
  `cubic-bezier(0.23,1,0.32,1)`, 140–220 ms, `scale(0.97)` al presionar, nada animado en
  acciones de teclado, `prefers-reduced-motion`.
- Antes del PR: `npm run lint && npm run test && npm run build && npm run e2e` en verde.
