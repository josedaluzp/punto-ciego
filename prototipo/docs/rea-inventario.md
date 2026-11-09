# Inventario de comportamiento · canvas de la Entrega 2 → app Vite + React

Fecha: 23/10/2026. Fuente: `entregas/entrega-2/{diseno-navegacion,diseno-adhesion,diseno}` (copiados a `scratchpad/rea-target/`, sin `fuentes/` ni imágenes).
Contrastado contra RF01–RF18 de `entregas/entrega-3/contenido/11-descripcion-del-sistema.md`.

Marcas de procedencia de cada hallazgo:
- **[REA]**: lo extrajo `rea-agents` 6.7.0.
- **[MANUAL]**: salió de leer el HTML, el JS inline, los README, los `canvas.json` y `mapa.json`.

---

## 0. Qué hizo REA y qué no

| Corrida | Comando | Resultado | Salida cruda |
|---|---|---|---|
| 1 | `npx -y rea-agents@latest --help` | OK. Avisa `EBADENGINE`: pide node ≥22.19 y hay 22.18, pero corre igual. No hay comando para HTML estático local. `analyze-web-bundle`, `capture-browser-scenario` e `inspect-web-page` necesitan una página servida o CDP. | `rea-out/help.txt` |
| 2 | `analyze-javascript-application <rea-target> --json` (el flag `--json` funcionó) | Exit 0, pero **no analizó JS**: `parsed_javascript_files: 0`, `visited_ast_nodes: 0`. El grafo semántico quedó con 1 nodo y 0 relaciones. Clasificó cada `.dc.html` como `electron-renderer` (falso positivo) con `./support.js` como `not-found`. Limitación literal: *"diseno-navegacion/Main.plantilla.html has 1 inline JavaScript body starting at line 348 that was not analyzed"*. | `rea-out/analyze-js-app.json`, `.stderr.txt` |
| 3 | Mismo comando sobre el script inline extraído a `rea-target-js/navegacion-inline-1.js` | `parse_failures: 1`, *"JavaScript syntax could not be parsed."* La causa es el marcador de plantilla `const DATOS = /*DATOS*/;`. | `rea-out/analyze-js-inline.json` |
| 4 | Igual a la corrida 3, con el marcador cambiado por `null` | **Funcionó**: 4925 nodos AST, 2692 nodos semánticos, 2526 relaciones, 72 huellas de función, 0 fallas. | `rea-out/analyze-js-inline-patched.json`, resumen en `rea-out/rea-inline-digest.txt` |

**Lo que aportó REA [REA]**, solo de la corrida 4:
- Inventario de funciones: `navegar, estadoDeFila, verMapa, verBandeja, elegirFila, irPais, irProvincia, irCiudad, valsPais, origenPais, valsProvincia, casoRuta, relato, valsCiudad, valsBandeja, renderVals, acomodar, miles` y la clase `Component` (extiende `DCLogic`).
- Inventario de las 250 propiedades leídas o escritas, que coinciden con los `{{bindings}}` de la plantilla y los campos de `mapa.json` (marcas, evidencia, imagen, reclamo, bandeja, etc.).
- Relaciones: 13 `calls`, 214 `writes-property`, 349 `reads-property`, 2 `coerces` (`String`). Ningún `request`, timer, storage ni evento: confirma que el prototipo es 100 % en memoria, sin red ni persistencia.

**Lo que REA no puede aportar.** Los diez `.dc.html` de `diseno-adhesion/` y `diseno/` no tienen ningún script propio, ni `onClick` ni `{{}}`. Son maquetas estáticas que pinta el runtime `support.js`, que no está en el repo. REA no tiene nada que analizar ahí, y todo lo que sigue sobre esas pantallas es **[MANUAL]**. La semántica de interacción (qué clic cambia qué estado) también es manual: REA da el grafo, no la lectura.

---

## 1. Prototipo navegable · `diseno-navegacion/Main.plantilla.html` [MANUAL, con funciones confirmadas por REA]

Es un solo artboard de 1440×900 y el único canvas con lógica real.

### 1.1 Estado (`Component.state`)
```
vista: 'mapa' | 'bandeja'      bandejaSel: id | null
nivel: 'pais' | 'provincia' | 'ciudad'
prov: clave | null   ciudad: clave | null   caso: id marca | null   ruta: ref | null
paso: int (alterna la animación)   dir: 'in' | 'out'   origen: '% %' (transform-origin)
```

### 1.2 Pantallas y estados

**Estructura común**
- Barra superior: logo «Punto Ciego», pestañas Mapa / «Bandeja · 21», migas, contador «N alertas abiertas» y la leyenda «Área técnica».
- A la izquierda va el área principal de 1068×844: mapa o bandeja.
- A la derecha va el panel de detalle, compartido por las dos vistas.

**A. Nivel país**
- Muestra el SVG de las 24 provincias. El resto del país va en gris. Las 3 integradas (Córdoba, Buenos Aires, Chubut) tienen relleno azul y son clicables. Cada una lleva un rótulo con su nombre y «N reportes».
- El rótulo «Islas Malvinas» aparece solo en este nivel (Ley 26.651).
- Tarjetas de provincia ordenadas por reportes: nombre, «X de Y municipios», reportes, alertas por omisión y siniestros en ruta.
- Panel: «Cobertura del sistema / Argentina» con cinco cifras: reportes, alertas, siniestros en rutas, municipios integrados (6/29) y casos documentados (5). La lista «Provincias, por alertas abiertas» ordena por alertas y desempata por reportes.
- Referencias: provincia integrada y sin convenio. Pie: fuentes (Natural Earth) y «datos sintéticos».
- Botón «Exportar el estado de cobertura», **inerte** (sin handler).

**B. Nivel provincia**
- Dibuja las vecinas en gris, el contorno de la provincia, las rutas sin alerta en gris, las rutas con alerta en rojo y la ruta seleccionada en trazo grueso.
- Municipios: los integrados son un punto rojo de 13 px, clicable. Los no integrados son un punto hueco de 7 px y no hacen nada. Hay un halo si tienen alertas.
- Los rótulos de los municipios usan `acomodar()`, un algoritmo anti-colisión: los integrados se rotulan siempre y los demás solo si entran. El detalle dice «N reportes · N alertas» o «N reportes en espera».
- Los rótulos de ruta son como máximo 6, y los que tienen alerta se ponen siempre.
- Panel: nombre de la provincia y bajada con la cobertura. Cifras: reportes, alertas (desglosadas en urbanas y en ruta), siniestros en rutas, rutas con traza y documentados.
- Lista «Rutas, por siniestros registrados»: «RN 9 · nacional/provincial», con la sub «reclamo sin respuesta hace N días en el km K» o «sin reclamos abiertos», y los siniestros como valor.
- **Clic en una ruta de la lista** la selecciona o la deselecciona (toggle): resalta la traza y muestra el «caso de ruta» en el panel con «Reclamo desatendido en ruta», ref, km, jurisdicción, un relato y las cifras días, adhesiones y siniestros, todas con la etiqueta «prototipo». En el mapa, las rutas **no** son clicables.
- El botón dice «Emitir ficha de RN 9» con una ruta elegida y «Exportar el listado de rutas» sin ella. Los dos son **inertes**.

**C. Nivel ciudad**
- Dibuja la red vial OSM en 4 capas de jerarquía (a–d) y 6 marcas por ciudad.
- Marca: el color sale del estado, o rojo si tiene alerta. Las que tienen alerta llevan halo y una animación `pulso` de 2,4 s en bucle. La activa mide 16 px y el resto 12 px. Hay un rótulo «calle + ubicación» visible si la marca está activa o tiene alerta.
- **Clic en una marca o en una fila de la lista** pone `caso = id`. Al entrar a la ciudad se preselecciona `marcas[0]`.
- Panel, cifras: reportes acumulados, con alerta, en seguimiento, obras asentadas (`estado=intervenida`), documentados y sintéticos (seguimiento menos documentados).
- **Panel del caso**:
  - Estado, con color e id `PN-2026-xxxx`, calle, ubicación.
  - Rótulo «Caso documentado» o «Caso sintético».
  - Método y confianza, con coma decimal.
  - El relato se arma por reglas en `relato()`:
    - días conocidos o «sin fecha de inicio informada»;
    - adhesiones, si las hay;
    - alerta, con la frase «Desde el reporte se registraron N siniestros… Sin intervención asentada» y el singular cuando es 1;
    - variantes según el estado: intervenida, ficha-emitida, sin dato de siniestros o «todavía no se registraron siniestros».
  - Tres cifras (días sin respuesta, adhesiones, siniestros posteriores). Cada una lleva su **etiqueta de origen** «fuente», «prototipo» o vacía, y un null se muestra como «sin dato» en gris.
  - Nota al pie con `diasNota` y `siniestrosNota`.
- **Ficha de evidencia**, flotante sobre el mapa, arriba a la derecha:
  - Si el caso es documentado, la cabecera verde dice «Evidencia documental verificada» y muestra medio, fecha, titular, la cita `dice` y un enlace `https://`+url que abre en una pestaña nueva.
  - Si es sintético, dice «Reporte sintético del prototipo · sin nota de respaldo».
  - En los dos casos hay una foto de las 6 que existen, con la **leyenda quemada en una banda**: roja si `tipo=ilustracion` («FOTO ILUSTRATIVA · NO ES ESTE PUNTO»), gris si `tipo=vista` (KartaView, con fecha), más rótulo, crédito, autoría y nota.
- Lista «Reclamos priorizados»: calle, ubicación, días o «sin fecha de reclamo», siniestros posteriores o el estado, un badge DOC y «N adh.».
- Referencias de 4 colores: desatendido con siniestros, abierto sin siniestros, ficha emitida, obra asentada.
- Botón «Emitir ficha de intervención», **inerte**.

**D. Vista bandeja** (pestaña «Bandeja · 21»)
- Encabezado «Bandeja de omisiones» con el resumen «21 con alerta de 42 en seguimiento · 5 con evidencia documental» y el texto que explica el orden por omisión y no por riesgo.
- Columnas: Jurisdicción («Prov · ciudad» o «Prov · red nacional/provincial»), Punto reclamado (calle y ubicación), Estado, Días, Adhes., Siniestros y DOC.
- Se ven solo las **17 primeras** filas, sin scroll ni paginación. El pie dice «N casos más, ordenados detrás de estos».
- El orden **viene precalculado en `mapa.json`**: primero las filas con alerta, por siniestros desc y luego días desc; después las que no tienen alerta. La plantilla no ordena nada.
- **Clic en una fila** (`elegirFila`): marca la fila y, con `estadoDeFila`, deja el mapa apuntando a ese caso. Si es de ciudad, pone `nivel=ciudad` con prov, ciudad y caso. Si es de ruta, pone `nivel=provincia` con esa ruta. El panel derecho muestra entonces el caso, pero la ficha de evidencia y la foto **no se ven en la bandeja**, porque viven dentro del div del mapa.
- La pestaña «Bandeja» (`verBandeja`) entra con la fila guardada en `bandejaSel` o, si no hay, con la primera.
- La pestaña «Mapa» vuelve a la vista mapa y aterriza en la ciudad o provincia del caso elegido.
- En la bandeja, las migas se atenúan (opacidad 0,28) pero **siguen clicables**. Es un detalle que hay que decidir.

### 1.3 Transiciones y navegación
- `navegar()` incrementa `paso`, fija `dir` y `origen`. La animación es `zin1/zin2` (escala 0,84→1) o `zout1/zout2` (1,18→1), de 620 ms con `cubic-bezier(.16,.84,.24,1)`. Alterna los nombres para que se reinicie, y el `transform-origin` es el punto clicado, en %.
- Hacia adentro: país→provincia (clic en el path, el rótulo, la tarjeta o la fila) y provincia→ciudad (solo municipios integrados).
- Hacia afuera: miga «Argentina» (`irPais`, `out`, centro) y miga de provincia (`irProvincia`, `out` si se viene de ciudad). La miga de ciudad no es clicable.
- El contador de la barra cambia con el nivel: total del país, alertas de la provincia o alertas de la ciudad.
- No hay ruteo por URL, ni persistencia, ni teclado, ni foco accesible: todo es `onClick` sobre `span` y `div`.

### 1.4 Validaciones y reglas de negocio visibles
- Regla de alerta: `alerta = reclamo sin respuesta + siniestros posteriores > 0`. En los datos viene **como booleano precalculado**. Cuatro de los cinco documentados no la disparan.
- Consistencia de abajo hacia arriba (README): las alertas de ciudad y de ruta suman las de la provincia, y las provincias suman el país. Se cumple en los datos y no se calcula en la UI.
- Procedencia: un null se muestra como «sin dato» y nunca se rellena. Cada cifra de un documentado lleva su origen.
- Ruta por progresiva (km) y calle por altura. El método se informa en cada caso.

### 1.5 Forma de los datos · `datos/mapa.json` (714 KB) [MANUAL; claves confirmadas por REA]
```
total      {reportes:973, alertas:21, siniestros:1228, documentados:5, provincias:3, municipios:29, integradas:6}
malvinas   {x, y, nombre}                        vista {w:1000,h:664}   paisVista {w:470,h:940}
pais[24]   {nombre, d(svg path), cx, cy, clave?, reportes?, alertas?, siniestros?, documentados?}   // clave solo en las 3 integradas
provincias{cordoba|buenos-aires|chubut}:
  {nombre, d, reportes, alertas, alertasCiudades, alertasRutas, siniestros, documentados, integradas, municipios,
   vecinas[] {nombre, d},
   rutas[]   {ref:'RN 9', d, siniestros, nacional:bool, lx, ly, alerta:bool, reclamo?{km, dias, adhesiones, siniestros}},
   ciudades[]{nombre, x, y, integrada:bool, clave?, reportes, alertas, documentados}}
ciudades{cordoba|riocuarto|mardelplata|laplata|trelew|comodoro}:
  {nombre, provincia, capas{a,b,c,d}(svg paths por jerarquía), reportes, alertas, documentados, enSeguimiento,
   marcas[6] {id:'PN-2026-0157', calle, ubicacion, tipo:'calle'|'ruta', x, y, lat?, lon?,
              metodo(texto libre), confianza(0–1),
              estado:'desatendido'|'en-analisis'|'ficha-emitida'|'intervenida', alerta:bool,
              dias?, diasOrigen?, diasNota?, adhesiones?, adhesionesOrigen?, siniestros?, siniestrosOrigen?, siniestrosNota?,
              riesgo?(0–1), riesgoOrigen?,                       // presente pero NUNCA se muestra
              fuente:'documentada'|'sintetica',
              evidencia?{medio, fecha, titular, url(sin esquema), dice, foto},
              imagen{n:1..6, tipo:'ilustracion'|'vista', rotulo, credito, autoria, pagina, leyenda, nota},
              sinImagen?}}
bandeja[42] {nivel:'ciudad'|'ruta', prov, provNombre, ambito, clave, id, calle, ubicacion, tipo, estado, alerta,
             dias?, adhesiones?, siniestros?, fuente, jurisdiccion:'municipal'|'provincial'|'nacional'}
```
- Distribución de las 36 marcas: 22 desatendido, 5 ficha-emitida, 5 en-análisis, 4 intervenida. 15 tienen alerta. 31 son de calle y 5 de ruta. 5 documentadas y 31 sintéticas. 34 imágenes ilustrativas y 2 vistas reales. La confianza va de 0,55 a 0,99.
- La bandeja tiene 21 filas con alerta (15 de ciudad y 6 de ruta) y 21 sin alerta.
- `x, y` son coordenadas de dibujo en el viewBox 1000×664, no lat/lon. Solo los documentados y las dos vistas traen `lat` y `lon`.
- Los `d` son paths SVG ya proyectados y simplificados por `02-construir-mapa.py`. La app nueva puede reutilizarlos tal cual o pasarse a teselas con lat/lon (el diagrama de despliegue menciona un «servidor de teselas externo»).

---

## 2. Adhesión vecinal · `diseno-adhesion/*.dc.html` [MANUAL; maquetas estáticas, sin lógica]

Caso único en pantalla: **Av. Colón al 5300, Córdoba, PN-2026-0186**, sintético.

| # | Pantalla | Qué muestra | Interacciones dibujadas (ninguna funciona) | En alcance hoy |
|---|---|---|---|---|
| 1 | Lo que ve el vecino (390×844) | Foto con banda, «Reclamo abierto», dirección, id, fecha, «112 vecinos ya lo confirmaron», 111 días sin respuesta, desglose 87/15/10, línea de tiempo (reporte → 100 firmas → siniestro con crónica → hoy sin intervención) | «Confirmar que sigue así», «Sin crear cuenta» | Solo la **ficha pública del reclamo** (foto, estado, días, línea de tiempo) sirve de precedente. El contador y el desglose quedan **fuera** (adhesión) |
| 2 | Cómo está hoy (paso 1/3) | Opciones «Sigue igual» y «Está peor», aviso aparte «podría estar arreglado», foto opcional con fecha, coordenada y ±precisión del dispositivo, texto opcional de 400 caracteres con contador, «Se publica sin tu nombre» | Selección única, adjuntar o volver a sacar la foto, textarea, «Continuar» | La **foto opcional con metadatos** y la **descripción con contador** sirven de precedente para RF15. Las opciones de estado y el aviso de arreglo quedan **fuera** |
| 3 | Quién sos (paso 2/3) | Nombre, DNI, nacimiento, celular y domicilio, cada uno con su «para qué», «Vivís a 210 m», bloque Público/Municipio/Nunca, consentimiento de la Ley 25.326 | Campos de texto, checkbox, «Enviarme el código» | **Fuera, y además en contra** de RF15 y RNF01: el reclamo ya no pide datos personales |
| 4 | Verificación (paso 3/3) | Código de 5 dígitos por SMS, reenvío en 0:42, checklist (un DNI una firma, dígito verificador del CUIL, domicilio dentro del radio, celular, RENAPER no disponible) | Ingreso del código, reenvío, «Confirmar mi firma» | **Fuera** (SMS) |
| 5 | Comprobante | «Sos la firma 113», desglose, «Qué pasa ahora», número AD-2026-0186-113 con fecha y hora | Avisar a vecinos, Compartir el enlace, Ver el mapa, Otros puntos del barrio | Solo el **comprobante con número** sirve de precedente para CU08 paso 6. El resto queda fuera |
| 6 | Municipio (1440×900) | Migas Argentina › Córdoba › Córdoba › caso, «3 alertas abiertas», estado «Reclamo desatendido», badge «En verificación», contradicción avisos/firmas, desglose de adhesiones, mapa de dispersión (radio de 800 m, 400 m), rechazos (5 motivos con conteo), padrón enmascarado, «Cómo pesan estas firmas» | «Resolver», «Emitir ficha de intervención», «Descargar el padrón para auditoría» | La **cabecera del caso** y el acceso a «Resolver» sirven de precedente para CU10 y CU11. Desglose, padrón y rechazos quedan **fuera** |
| 7 | Resolver (cierre) | Firmante «M. Ferreyra · Ingeniería de Tránsito», resumen, **stepper de estados Abierto → En verificación (actual) → Cerrado con evidencia → Reabierto**, avisos de posible arreglo con distancia, contradicción, formulario de cierre | **Motivo** (radio: Obra ejecutada / No se constató el deterioro / Otra jurisdicción o duplicado). **Respaldo obligatorio** (N.º de orden de trabajo / Fotografía de la obra / Acta de inspección), «Hace falta al menos uno». **Botón deshabilitado** «Cerrar el reclamo · Falta adjuntar el respaldo» | **Precedente directo de RF18 y CU11.** La regla de reapertura a 90 días por adhesiones queda **fuera**. «Cierre desmentido por siniestro» y «el reloj no se reinicia» siguen **dentro** (RF16) |

Validaciones de formulario implícitas en las maquetas [MANUAL]:
- Límite de 400 caracteres en la descripción.
- Foto con sello de fecha, coordenada y precisión.
- Botón de cierre deshabilitado mientras no haya al menos un respaldo.
- Fuera de alcance: código de 5 dígitos, temporizador de reenvío, dígito verificador del CUIL, unicidad de DNI por reclamo, domicilio contra el nomenclador, tope de 5 envíos por conexión.

---

## 3. Tres direcciones de diseño · `diseno/*.dc.html` [MANUAL; maquetas estáticas]

`canvas.json` las presenta como alternativas: A = la alerta es la pantalla, B = mapa operativo, C = ficha como expediente. La nota de cierre propone combinar A como entrada y C como detalle. El prototipo navegable eligió mapa más bandeja.

| Dirección | Contenido | Interacciones dibujadas | Precedente para |
|---|---|---|---|
| **A · Bandeja de omisiones** (`Main.dc.html`) | Sidebar con «Trabajo» (Reclamos desatendidos 14, Puntos priorizados 63, Fichas emitidas 9, En observación 4) y «Fuentes» (Ingesta y confianza, Catálogo de contramedidas). KPIs: 14 alertas, 7 de más de 90 días, 19 siniestros posteriores, 203 días la más antigua. Tabla: ubicación con tipología de vía, días, adhesiones, siniestros «desde el reclamo» con gravedad (heridos o fatal), estado. Gráfico de distribución desatendido/intervenido. «Origen del dato»: crónicas 44, reclamos 312, confianza alta 76 % | Filtros «Antigüedad» y «Tipo de vía», navegación lateral | RF17 (bandeja), menú hacia RF01–RF09 (Ingesta y confianza) y RF14 (catálogo, solo consulta) |
| **B · Mapa operativo** (`DireccionB.dc.html`) | Pestañas Mapa, Listado y Seguimiento. **Filtros**: jerarquía de vía (4 valores), severidad (fatal, heridos graves), **confianza geográfica mínima 0,62**, **período 2021–2025**. Zoom +/−. Leyenda del índice de riesgo bajo/medio/alto. Punto elegido: id y lat/lon, 7 siniestros en 5 años, 86 % usuarios vulnerables, **índice 0,84**, confianza 0,91, cartel de reclamo desatendido, **contramedida sugerida con factor 0,71 y 4 de 5 estrellas, referencia FHWA CMF** | Filtros, zoom, pestañas, «Emitir ficha de intervención» | **RF12** (filtros y orden por índice), **RF11** (componentes del índice), RF07, RF14 |
| **C · Ficha como expediente** (`DireccionC.dc.html`) | Lista «Fichas en preparación, 5 de 14 alertas», «Emitidas este mes 9, 3 con obra asentada». Ficha imprimible: id, lat/lon, fecha de emisión. Secciones 1 · Motivo, 2 · Evidencia (siniestros 2021–25 por crónicas, confianza 0,91 a nivel cuadra vía Georef, estado de la calzada con 4 fotos, índice 0,84 percentil 96), 3 · Contramedida (factor, estrellas, referencia), 4 · Trazabilidad (reclamo → umbral → siniestros → obra pendiente), descargo legal, «pág. 1 de 1» | «Exportar PDF», «Emitir al organismo», selección en la lista | **RF13** y **RF14**, RNF02 (cada dato con su fuente) |

---

## 4. Correspondencia comportamiento → RF

Leyenda: ✅ precedente con comportamiento real (solo el navegable). ◐ precedente visual estático o parcial. ✗ sin precedente.

| RF | Precedente en los canvas | Grado |
|---|---|---|
| RF01 Incorporar crónica | Solo la forma de los datos: `evidencia{medio, fecha, titular, url, dice}` en los documentados; «Crónicas de prensa 44» en A. No hay pantalla de carga | ✗ (forma ◐) |
| RF02 Extraer lugar, fecha, víctimas y tipo de usuario | C: «7 hechos, 1 fatal · 6 con motociclista». B: «86 % usuarios vulnerables». No hay extracción | ✗ |
| RF03 Detectar duplicados | — | ✗ |
| RF04 Clasificar la precisión | `tipo: calle|ruta`, ubicación por altura o por km. C: «resuelto a nivel de cuadra». Faltan intersección, corredor y barrio | ◐ |
| RF05 Georef sobre calle | Texto de `metodo` («altura simulada sobre geocodificación urbana») y C: «Georef, capa urbana» | ◐ (solo rótulo) |
| RF06 Postes km sobre ruta | `metodo` «progresiva simulada sobre poste kilométrico» y `reclamo.km` en las rutas | ◐ (solo rótulo) |
| RF07 Método y confianza por ubicación | Navegable: `casoMetodo + confianza` en cada caso ✅. B y C: confianza 0,91. Los valores de `metodo` son texto libre y no los códigos del diccionario (normalización, poste, manual) | ✅ |
| RF08 Derivar a revisión bajo el umbral | B: filtro «confianza mínima 0,62». A: menú «Ingesta y confianza». En los datos hay confianzas de 0,55 y 0,60, por debajo de 0,7, y **se muestran igual** (contradice RF08) | ◐ / conflicto |
| RF09 Confirmar, corregir o descartar | — | ✗ |
| RF10 Concentraciones (punto o tramo de 1 km) | Hay `siniestros` agregados por ruta entera, sin tramo de 1 km ni significancia | ✗ |
| RF11 Índice de riesgo | `marca.riesgo` (0–1) está en los datos **pero el navegable nunca lo muestra**. B y C muestran 0,84 y sus componentes | ◐ |
| RF12 Consultar concentraciones por índice, en mapa y lista, con filtros | El navegable tiene mapa y lista por nivel ✅, pero ordena por alertas o siniestros y **no por índice**, y **no tiene filtros**. B tiene los filtros (tipo de vía, período, severidad, confianza) | ◐ |
| RF13 Emitir ficha | Botones «Emitir ficha…» inertes en el navegable. C trae la ficha completa (motivo, evidencia, contramedida, trazabilidad, PDF). **Falta la caracterización del sitio** (tipo de calzada, carriles, banquina) y el número de ficha y técnico emisor como registro | ◐ |
| RF14 Recomendar contramedidas | B y C: **una** contramedida con factor 0,71, 4/5 estrellas y referencia FHWA. RF14 pide una lista filtrada y ordenada por factor y calificación | ◐ |
| RF15 Reclamo vecinal sin cuenta ni datos personales, con lugar en el mapa, descripción y foto opcional | Formulario 2: foto opcional con fecha y coordenada, descripción con contador. Comprobante 5: número. **Faltan** marcar el lugar en el mapa (los canvas adhieren a un reclamo existente), el control anti-bot y el estado inicial «abierto». La pantalla 3 pide datos personales y **contradice** RF15 | ◐ |
| RF16 Alerta de reclamo desatendido y reapertura | Navegable: `alerta` booleano precalculado, mostrado con color, pulso, contador y relato ✅. **No se calcula**: no hay radio de 50 o 500 m ni comparación de fechas. Pantalla 7: texto de «cierre desmentido por siniestro» y del reloj que no se reinicia ◐ | ◐ |
| RF17 Bandeja ordenada por siniestros posteriores y días, y agendar inspección | Navegable: pestaña Bandeja ✅ con el orden correcto (precalculado), selección de fila sincronizada con el mapa. A y pantalla 6: badge «En verificación». **Falta la acción «agendar inspección»**, que pasa el reclamo a en verificación. CU10 2.a (sin alertas, ordenar por antigüedad) no está | ◐/✅ |
| RF18 Cierre con motivo, respaldo obligatorio y firma | Pantalla 7: los 3 motivos y los 3 respaldos **coinciden literalmente** con CU11, el botón está deshabilitado sin respaldo y hay firmante con nombre y área. Es estático | ◐ (muy fiel) |

---

## 5. Brechas

### 5.1 Comportamientos en los canvas que no tienen RF
1. **Drill-down geográfico país → provincia → ciudad** con migas, zoom animado desde el punto clicado y municipios integrados o sin convenio. Con el recorte a Córdoba, el nivel país, las otras dos provincias y el rótulo de Malvinas sobran. Si la app conserva un mapa país, aplica la Ley 26.651 (mapa bicontinental), que el README ya marca como incompleto.
2. **Estados de reclamo del navegable** (`desatendido / en-analisis / ficha-emitida / intervenida`) que **no coinciden** con el diccionario (`abierto / en verificación / cerrado / reabierto`) ni con el stepper de la pantalla 7. Hay que remapearlos. «Ficha emitida» como estado del reclamo e «intervenida/obra asentada» (seguimiento de si la obra funcionó) no tienen RF.
3. **Procedencia por cifra** («fuente / prototipo / sin dato») y **ficha de evidencia documental** con cita y enlace. RNF02 cubre marcar lo sintético, pero ningún RF exige la procedencia campo a campo ni el panel de evidencia.
4. **Foto con leyenda quemada, crédito, licencia y autoría** (ilustrativa o vista KartaView). Sin RF.
5. **Contadores de adhesiones** en la bandeja (columna «Adhes.»), el panel, el relato y las fichas de B y C («100 adhesiones», «umbral de 100»). **La adhesión quedó fuera de alcance**: la app nueva tiene que quitar esas columnas y frases o justificarlas.
6. **Avisos de posible arreglo**, desglose por verificación, padrón, rechazos, dispersión de domicilios, umbral de 100 firmas, notificación por SMS, compartir enlace y «ver, corregir o borrar mis datos». Todo es adhesión o SMS, **fuera**. Además, la regla de 90 días para reabrir por adhesiones que figura en la pantalla 7 y el README queda fuera.
7. **Pestañas Mapa/Bandeja sincronizadas** y **contador global de alertas en la barra** según el nivel: comportamiento de UI sin RF, deseable.
8. **Botones de exportación** (estado de cobertura, listado de rutas, padrón) y «Emitir al organismo». Sin RF. «Exportar PDF» encaja con «habilita su descarga» de CU06.
9. **Jurisdicción** municipal, provincial o nacional por fila de la bandeja (a quién le toca intervenir). Solo RNF07 lo trata como dato.
10. **KPIs y tablero** de A (puntos priorizados, fichas emitidas, en observación, distribución, origen del dato, «confianza alta 76 %») y «Fichas emitidas este mes» de C. Sin RF.
11. **Algoritmo de rótulos anti-colisión** (`acomodar`) y halos o pulsos de alerta: detalle de implementación que conviene preservar.

### 5.2 RF sin precedente en los canvas (hay que diseñarlos desde cero)
- **RF01, RF02, RF03**: no hay ninguna pantalla de crónicas (carga, extracción, duplicados). La única base es la forma de `evidencia`.
- **RF08 y RF09**: no hay cola de revisión ni marcador arrastrable. Peor aún, el navegable muestra casos con confianza 0,55 y 0,60 como si fueran válidos.
- **RF10 y RF11**: no hay concentraciones ni tramos de 1 km, y el índice no se calcula. `riesgo` existe en los datos y no se usa.
- **RF12**: faltan los filtros (ámbito, tipo de vía, período) y el orden por índice en el navegable. Solo B los dibuja.
- **RF13**: falta la caracterización del sitio (calzada, carriles, banquina) en todas las maquetas.
- **RF14**: falta la lista ordenada de contramedidas. Hoy hay una sola.
- **RF15**: falta marcar el lugar en el mapa para un **reclamo nuevo**, el anti-bot y el formulario sin datos personales.
- **RF16**: faltan el cálculo por radio y fechas y la reapertura automática. Solo hay booleano y texto.
- **RF17**: falta la acción «agendar inspección», que pasa a en verificación.
- Transversales (RNF03): login con 2FA y roles (analista, técnico, funcionario). Ningún canvas tiene autenticación; solo aparece el nombre del firmante en la pantalla 7 y «Área técnica» en la barra.

### 5.3 Datos: qué reutilizar de `mapa.json` para la app Córdoba
- Sirve tal cual: `provincias.cordoba` (contorno, 11 vecinas, 7 rutas con traza, 10 ciudades), `ciudades.cordoba` y `ciudades.riocuarto` (capas viales y 6 marcas cada una) y las filas de `bandeja` con `prov==='cordoba'`.
- Hay que agregar: `estado` mapeado al diccionario; `fecha_presentacion` (hoy hay `dias` relativos); siniestros posteriores como lista con su crónica, no solo un conteo; `riesgo` visible; ubicaciones en lat/lon para cálculos de radio.
- Hay que quitar: `adhesiones*` (o dejarlo como «sin dato» y documentarlo) y `pais` y `malvinas` si no hay nivel país.
