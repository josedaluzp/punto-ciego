# Punto Ciego

**Sistema de priorización de puntos negros viales y alerta de reclamos desatendidos.**
Prototipo del Trabajo Final de Grado de **Ingeniería en Software**, Universidad Siglo 21,
2026. Autor: José Paulino Da Luz Pereira. Tutora: Ing. Julieta Rabozzi.

Los organismos de la provincia de Córdoba publican cuántas personas mueren en el
tránsito, pero no dónde: la ubicación de cada hecho sólo existe descrita en el texto de
las crónicas periodísticas. Punto Ciego reconstruye esa ubicación, agrupa los siniestros
en concentraciones significativas, las ordena por un índice de riesgo, emite para cada
lugar una ficha con la contramedida recomendada y su respaldo bibliográfico, y alerta
cuando un reclamo vecinal quedó sin atender y después hubo un siniestro en ese mismo
punto.

Este prototipo implementa la **cadena central** del sistema completa, de la crónica al
cierre firmado del reclamo: **ubicar siniestros → priorizar concentraciones → emitir la
ficha → alertar el reclamo desatendido**. Corre por completo en el navegador, sin
servidor, sobre datos sintéticos de demostración.

## Qué implementa

Los once casos de uso del prototipo, que cubren los dieciocho requerimientos funcionales
del documento (Tablas 8 y 10 del TFG).

| Caso de uso | Pantalla | Requerimientos |
|---|---|---|
| CU01 Incorporar crónica de siniestro | `/siniestros/cronicas` | RF01 a RF03 |
| CU02 Georreferenciar siniestro | `/siniestros/cronicas` | RF04 a RF08 |
| CU03 Revisar ubicación de baja confianza | `/siniestros/revision` | RF09 |
| CU04 Actualizar concentraciones de riesgo | `/priorizacion` | RF10, RF11 |
| CU05 Consultar lugares priorizados | `/priorizacion` | RF12 |
| CU06 Emitir ficha de intervención | `/priorizacion/fichas` | RF13 |
| CU07 Recomendar contramedida | `/priorizacion/fichas` | RF14 |
| CU08 Presentar reclamo vecinal | `/reclamo` (teléfono, sin cuenta) | RF15 |
| CU09 Evaluar reclamos desatendidos | automático al confirmar un siniestro | RF16 |
| CU10 Consultar bandeja de reclamos desatendidos | `/reclamos` | RF17 |
| CU11 Registrar resolución del lugar | `/reclamos/:numero` | RF18 |

## Arquitectura

Aplicación web de una sola página en **TypeScript** con **React 18**, compilada con
**Vite**. El estado vive en un store de **zustand** persistido en el navegador
(`localStorage`, clave `punto-ciego:v1`); el botón «Restablecer datos de demostración»
del riel lo devuelve a la semilla.

El código se organiza en capas que dependen sólo hacia adentro:

- `src/dominio/`: las reglas del negocio (extracción, georreferenciación, concentraciones,
  índice de riesgo, contramedidas, alertas y cierre) como funciones puras, sin React y con
  pruebas propias.
- `src/estado/`: el store, los selectores y una acción por caso de uso, que combinan el
  dominio con el estado y registran quién hizo cada cosa.
- `src/ui/`: componentes compartidos (mapa, croquis, identidad visual de cada lugar,
  tabla, medidor de confianza) y los tokens de diseño.
- `src/features/`: una carpeta por pantalla.

**Relación con el sistema diseñado.** El documento diseña el sistema completo sobre un
servidor en Python con FastAPI y una base PostgreSQL con PostGIS (diagrama de
despliegue). El prototipo ejecuta el mismo dominio en el navegador para poder probarse
sin instalar un servidor: reemplaza la persistencia por el almacenamiento local, el
servicio estatal de normalización de direcciones por un nomenclador de calles local y la
capa de postes kilométricos por una copia local de esa capa. Todo registro se identifica
como sintético, como exige el requerimiento de trazabilidad.

## Calidad

- Más de 200 pruebas unitarias (Vitest) sobre el dominio, la semilla y las acciones.
- Pruebas de punta a punta (Playwright) de cada caso de uso y de la cadena completa, en
  escritorio (1440×900) y en teléfono (390×844). La de la cadena falla además ante
  cualquier error de consola o desborde horizontal.
- ESLint y TypeScript en modo estricto.

## Cómo correrlo

Requiere Node 20 o posterior.

```bash
cd prototipo
npm install
npm run dev          # http://localhost:5173
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo de Vite |
| `npm run build` | Chequeo de tipos (`tsc -b`) y compilación a `dist/` |
| `npm run preview` | Sirve `dist/` en http://localhost:4173 |
| `npm run lint` | ESLint y TypeScript estricto sin emitir |
| `npm run test` | Pruebas unitarias del dominio, la semilla y las acciones (Vitest) |
| `npm run e2e` | Pruebas de punta a punta (Playwright, Chromium a 1440×900 y a 390×844) |
| `npm run cartografia` | Regenera `src/datos/cartografia.json` y `src/datos/postes.json` desde `mapa.json` de la E2 |

La primera vez que se corren las pruebas de punta a punta hace falta el navegador:

```bash
npx playwright install chromium
```

`npm run e2e` compila y levanta `npm run preview` solo. Si ya hay un servidor en el
puerto 4173 lo reutiliza: conviene apagarlo para probar la última compilación.

Antes de abrir un PR: `npm run lint && npm run test && npm run build && npm run e2e`.

## Despliegue en Vercel

1. Importar el repositorio en Vercel.
2. **Root Directory: `prototipo`**. El framework se detecta como Vite.
3. Build command `npm run build`, output `dist` (ya están en `vercel.json`).
4. `vercel.json` reescribe toda ruta a `index.html`, así que las direcciones profundas
   (`/reclamos/PN-2026-0186`) funcionan al recargar.

No hay variables de entorno.

## Estructura

```
prototipo/
├─ demo/              grabación del video de la demostración (Playwright)
├─ docs/              especificación de construcción e inventario de la Entrega 2
├─ e2e/               pruebas de punta a punta, una por caso de uso y la cadena completa
├─ public/fotos/      fotografías ilustrativas (procedencia en docs/procedencia-fotos.md)
├─ scripts/           extracción de la cartografía de Córdoba desde la Entrega 2
└─ src/
   ├─ dominio/        reglas del negocio, funciones puras con pruebas (RF02 a RF18)
   ├─ datos/          semilla, nomenclador de calles, postes, catálogo, vías, usuarios
   ├─ estado/         store (zustand persistido), selectores, reloj y acciones
   │  └─ acciones/    una por caso de uso, más las compartidas
   ├─ ui/             componentes compartidos y tokens de diseño
   ├─ rutas/          tabla de rutas y catálogo de componentes
   └─ features/       una carpeta por pantalla: cronicas, revision, priorizacion,
                      ficha, reclamo-vecinal, bandeja
```

## Rutas

| Ruta | Pantalla | CU |
|---|---|---|
| `/` | redirige a `/priorizacion` | |
| `/siniestros/cronicas` | Lista de siniestros e «Incorporar crónica» | CU01, CU02 |
| `/siniestros/revision` | Ubicaciones en revisión, marcador arrastrable | CU03 |
| `/priorizacion` | Lugares priorizados: mapa, lista, croquis y actualización | CU04, CU05 |
| `/priorizacion/fichas`, `/priorizacion/fichas/:numero` | Fichas emitidas y ficha de intervención | CU06, CU07 |
| `/reclamo` | Reclamo del vecino desde el teléfono y comprobante | CU08 |
| `/reclamos`, `/reclamos?vista=todos`, `/reclamos/:numero` | Bandeja, detalle, inspección y cierre | CU09, CU10, CU11 |
| `/componentes` | Catálogo de los componentes compartidos (no figura en el riel) | |

## Usuarios de demostración

Las acciones quedan registradas a nombre del usuario elegido arriba a la derecha.

| Usuario | Rol | Puede |
|---|---|---|
| L. Ahumada | Analista de siniestralidad | Incorporar crónicas y revisar ubicaciones |
| R. Quiroga | Técnico de tránsito (usuario inicial) | Además, emitir fichas y agendar inspecciones |
| M. Ferreyra | Funcionario a cargo | Además, cerrar reclamos con su firma |

## Datos de demostración

La semilla (`src/datos/semilla.ts`) es determinista y no fija a mano ninguna cifra
calculada: redacta cada crónica a partir de la especificación del hecho y la hace
pasar por `extraerDeCronica` → `georreferenciar`, igual que una crónica real. Las
concentraciones salen de `agruparConcentraciones` + `indiceRiesgo`, y las alertas de
reproducir en orden cronológico presentaciones, cierres y siniestros con
`evaluarReclamosDesatendidos`. Lo único asignado por la semilla es el número de cada
concentración (C-0007…), que en el sistema real asigna la base de datos.

`src/datos/semilla.test.ts` verifica que la semilla reproduce las Figuras 15 a 21 del
documento:

- 38 concentraciones significativas en 2021–2025; las seis primeras con los valores
  de la Figura 17 (RN 9 km 694 a 695, índice 0,91; Av. Vélez Sarsfield al 1200, 0,88;
  RN 19 km 312 a 313, 0,79; Av. Amadeo Sabattini al 4700, 0,74; RN 158 km 170 a 171,
  0,66; Av. Colón al 5300, 0,61).
- FI-2026-0042 con sus cuatro siniestros (03/2022, 11/2023, 06/2024, 01/2025) y las
  contramedidas de factor 0,72, 0,81 y 0,88.
- Tres ubicaciones en revisión: Av. Circunvalación 0,41, Barrio Villa El Libertador
  0,22 y RN 36 km 790 0,55.
- Bandeja: 3 con alerta (PN-2026-0131, PN-2026-0186 en verificación, PN-2026-0204
  reabierto por cierre desmentido) y 29 abiertos sin alerta, entre ellos PN-2026-0157
  y el caso documentado de Agustín Piaggio al 1000.
- Cuatro crónicas de ejemplo sin incorporar (`CRONICAS_DE_EJEMPLO`): Sabattini
  (normalización, 0,86), Pablo Cabrera (dispara en vivo la alerta de PN-2026-0157),
  RN 158 km 214,6 (poste kilométrico) y una segunda crónica de Sabattini que se
  vincula a la primera (RF03).

«Hoy» en la demo es el **09/09/2026** (`FECHA_DEMO`), la fecha en que la bandeja de
la Figura 20 muestra sus días sin respuesta; las acciones se registran en esa fecha
con la hora real.

## Video de la demostración

`demo/grabar.spec.ts` recorre la aplicación completa con Playwright, a ritmo de
persona, y deja el video de cada toma con sus pistas de subtítulos y de cámara.
El proyecto Remotion de `../video` las monta en el video final.

```bash
npm run demo:grabar                        # tomas en demo/salida/ (unos 9 minutos)
DEMO_RAPIDO=1 npm run demo:grabar          # valida el guion sin pausas
cd ../video && npm install && npm run render
```

La primera versión del video, sólo con la cadena central, quedó en la etiqueta
`demo-video-v1`.

## Documentación del trabajo

- El documento final del TFG describe el problema, el relevamiento y el diseño del
  sistema completo: requerimientos, casos de uso, diagramas de secuencia, de clases y de
  despliegue, seguridad, costos y riesgos. Acompaña a este código en la entrega.
- Especificación de construcción del prototipo: [`docs/SPEC.md`](docs/SPEC.md).
- Comportamiento heredado del diseño de interfaces de la Entrega 2:
  [`docs/rea-inventario.md`](docs/rea-inventario.md).

## Referencia para el desarrollo

### Dominio (`src/dominio`, se importa desde `src/dominio`)

| Función | Para qué |
|---|---|
| `extraerDeCronica(texto, fechaPublicacion)` | RF02: lugar (con su posición en el texto), fecha del hecho, víctimas con tipo de usuario y gravedad, tipo de siniestro |
| `buscarDuplicado(extraido, texto, siniestros, cronicas)` | RF03: candidato `seguro` (vincular) o `dudoso` (decide el analista) |
| `cronicaPorUrl(url, cronicas)` | CU01 2.a: la dirección web ya fue incorporada |
| `clasificarPrecision(lugar)` | RF04 |
| `georreferenciar(lugar)` | RF05 a RF07: calle por normalización simulada, ruta por postes (nunca normalización), método y confianza |
| `UMBRAL_CONFIANZA`, `estadoPorConfianza`, `intervieneEnCalculos` | RF08 |
| `revisarUbicacion(u, decision, por, en)` | RF09: confirmar, corregir (manual, confianza 1) o descartar |
| `agruparConcentraciones(siniestros, registro?)` | RF10 + RF11: concentraciones significativas ordenadas por índice |
| `componentesRiesgo`, `indiceRiesgo` | RF11, sin reclamos |
| `nombreConcentracion(c)` | "RN 9 · km 694 a 695", "Av. Colón al 5300" |
| `recomendarContramedidas(c, catalogo)`, `reduccionEsperada` | RF14 |
| `evaluarReclamosDesatendidos(siniestro, reclamos, en?)` | RF16: alerta, reapertura con cierre desmentido, sin alerta si el reclamo es posterior |
| `ordenarBandeja(reclamos, hoy)`, `diasSinRespuesta`, `agendarInspeccion` | RF17 |
| `puedeCerrar(cierre)`, `cerrarReclamo`, `rolPuedeCerrar` | RF18 y CU11 |
| `siguienteNumero(prefijo, anio, existentes)` | PN-2026-0205, FI-2026-0043 |
| `posicionPorProgresiva`, `progresivaMasCercana`, `trazaTramo` | Capa de postes |
| `aProvincia`, `aCiudad`, `deProvincia`, `deCiudad` | Proyección de los dos planos |
| `formato.decimal`, `formato.fecha`, `formato.km`, `formato.porcentaje`… | Cifras en español de la Argentina |

### Estado (`src/estado`)

| Pieza | Para qué |
|---|---|
| `useDemo` | Store: `cronicas`, `siniestros`, `reclamos`, `fichas`, `registroConcentraciones`, `usuarioId` |
| `useConcentraciones(periodo?)`, `concentracionesDe(estado, periodo)` | Concentraciones derivadas (por defecto 2021–2025) |
| `useBandeja()`, `useConteos()`, `useUsuario()` | Bandeja ordenada, cantidades del riel, usuario actual |
| `hoy()`, `ahora()` | Reloj de la demo |
| `restablecerDatos()`, `cambiarUsuario(id)` | `acciones/base.ts` |
| `guardarUbicacion(siniestroId, ubicacion)` | `acciones/compartidas.ts`: guarda y, si queda confirmada, ejecuta CU09 y devuelve las alertas |
| `fijarNumerosConcentraciones(cs)` | Conserva el número de una concentración nueva al emitir su ficha |

### Componentes (`src/ui`, ver `/componentes`)

`Shell` y `ShellPublico`, `Mapa` (provincia o ciudad, marcadores punto/tramo/pin,
`onSeleccionar`, `onArrastrar`, `onClicMapa`, `encuadre`, acercar y alejar),
`Croquis` (tramo o cuadra, gestos por tipo, marcador arrastrable), `IdentidadLugar`,
`EscudoRuta`, `ChapaCalle`, `Mojon`, `RomboIndice`, `Boton` y `claseBoton`, `Select`,
`CampoTexto`, `AreaTexto`, `FilaFiltros`, `Tabla` (orden por encabezado, fila
seleccionada, `estadoFila` tiñe la fila), `ChipEstado`, `Registro`, `Vacio`,
`AvisoSintetico`, `MedidorConfianza`, `avisar()` y `Icono`. Tokens en `src/ui/tokens.css`.

### Convenciones

- Los cambios a `src/dominio/` llevan su prueba unitaria; los de una pantalla, su prueba
  de punta a punta en `e2e/`.
- Textos en español rioplatense, con los términos del documento y sin inventar datos
  reales.
- Animaciones con salida suave (`cubic-bezier(0.23,1,0.32,1)`, 140 a 220 ms), nada
  animado en acciones de teclado y respeto de `prefers-reduced-motion`.
- Antes de integrar: `npm run lint && npm run test && npm run build && npm run e2e` en verde.

### Decisiones de diseño que conviene conocer

- **Radio de la alerta: 50 m sobre calle y 500 m sobre ruta**, como fija la ficha de
  CU09 (Tabla 19). La especificación mencionaba 300 m; manda el documento.
- **Heridos graves.** La extracción también reconoce a los heridos de gravedad
  (`Victima.gravedad`) porque pesan 0,3 en la severidad del índice; la proporción de
  vulnerables se calcula sobre las víctimas fatales, como en la ficha.
- **Fecha de la ficha FI-2026-0042: 08/09/2026.** La Figura 18 dice 28/09, posterior
  al «hoy» que fija la bandeja (09/09); se adelantó para que la demo sea coherente.
- **El caso documentado va al final de la bandeja**: no tiene fecha de inicio y la
  bandeja ordena por antigüedad. La Figura 20 es un recorte de cinco filas.
- `Siniestro.origen` y `Reclamo.origen` (real o sintético) vienen del diccionario de
  datos; sólo el caso de Agustín Piaggio es `real`.
