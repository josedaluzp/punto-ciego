# Punto Ciego

**Sistema de priorización de puntos negros viales y alerta de reclamos desatendidos.**

Prototipo del Trabajo Final de Grado de **Ingeniería en Software**, Universidad Siglo 21,
2026. Autor: José Paulino Da Luz Pereira. Tutora: Ing. Julieta Rabozzi.

Los organismos de la provincia de Córdoba publican cuántas personas mueren en el
tránsito, pero no dónde. Punto Ciego reconstruye la ubicación de cada siniestro a partir
de las crónicas periodísticas, prioriza los lugares de mayor riesgo, emite para cada uno
una ficha de intervención con la contramedida recomendada y alerta cuando un reclamo
vecinal quedó sin atender y después hubo un siniestro en ese mismo punto.

**Probarlo en línea:** https://punto-ciego-zeta.vercel.app (datos sintéticos de
demostración, sin registro).

## Contenido

| Carpeta | Qué contiene |
|---|---|
| [`prototipo/`](prototipo/) | La aplicación: casos de uso, arquitectura, pruebas y cómo correrla en su [README](prototipo/README.md) |
| [`video/`](video/) | El proyecto Remotion que monta el video de la demostración ([README](video/README.md)) |
| [`validacion/`](validacion/) | Pruebas de Playwright que validan la app publicada, la carpeta de Drive y este repositorio ([README](validacion/README.md)) |

## Ponerlo en marcha

Requiere Node.js 20 o posterior.

```bash
cd prototipo
npm install
npm run dev          # http://localhost:5173
```

## Probarlo

Desde `prototipo/`:

```bash
npm run lint                        # ESLint y TypeScript estricto
npm run test                        # pruebas unitarias (Vitest)
npm run build                       # compilación a dist/
npx playwright install chromium     # sólo la primera vez
npm run e2e                         # pruebas de punta a punta (Playwright)
```

`npm run e2e` compila y sirve la app en el puerto 4173, y reutiliza un servidor que ya
esté escuchando ahí. Si ese puerto lo ocupa otro proyecto, conviene elegir otro con
`PUERTO_E2E=4391 npm run e2e` (bash) o `$env:PUERTO_E2E=4391; npm run e2e` (PowerShell).

`npm run cartografia` regenera la cartografía desde los datos de la Entrega 2, que no
forman parte de este repositorio; los archivos que produce ya están incluidos.
