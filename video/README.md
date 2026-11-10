# Video de la demostración

Proyecto [Remotion](https://www.remotion.dev) que monta el video de la demostración de
Punto Ciego: placas de apertura, el capítulo de puesta en marcha (repositorio, README y
terminal) y un capítulo por caso de uso, con subtítulos sincronizados y una cámara que
acerca cada componente.

El video no se graba acá: las tomas las graba Playwright en `../prototipo/demo`, junto con
sus pistas de subtítulos y de cámara. Por eso hay que seguir este orden; sin las tomas, el
proyecto no compila (le faltan `public/tomas/*.json`).

```bash
# 1. Grabar las tomas (unos 9 minutos; deja prototipo/demo/salida/)
cd prototipo
npm install
npx playwright install chromium
npm run demo:grabar

# 2. Traer las tomas y renderizar (deja out/demo-punto-ciego.mp4)
cd ../video
npm install
npm run render
```

**Narración.** El video lleva una voz que lee cada subtítulo, generada con una voz neural
gratuita (edge-tts, `es-AR-TomasNeural`). `npm run voz` (necesita Python con
`pip install edge-tts==7.3.1`, ffprobe e internet) sintetiza un audio por texto en
`public/voz/` y escribe `../prototipo/demo/voz.json` con la duración de cada frase, que
la grabación usa para esperar a que termine antes de seguir. Si cambia algún subtítulo,
hay que correr `npm run voz` antes de grabar. Los textos de las placas y de la puesta en
marcha están en `narracion.json`.

- `npm run estudio` abre Remotion Studio para revisar el video cuadro por cuadro.
- `npm run traer` copia las tomas y convierte el README del prototipo a HTML; `render` y
  `estudio` lo corren solos.
- Para validar el guion sin esperar la grabación completa: `DEMO_RAPIDO=1 npm run
  demo:grabar` en bash, o `$env:DEMO_RAPIDO=1; npm run demo:grabar` en PowerShell.
