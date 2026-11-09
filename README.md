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
| [`video/`](video/) | El proyecto Remotion que monta el video de la demostración a partir de las tomas que graba `prototipo/demo` |

## Ponerlo en marcha

Requiere Node.js 20 o posterior.

```bash
cd prototipo
npm install
npm run dev          # http://localhost:5173
```

Las pruebas: `npm run test` (unitarias) y `npm run e2e` (de punta a punta, la primera
vez con `npx playwright install chromium`).
