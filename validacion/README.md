# Validación de la entrega

Pruebas de Playwright que comprueban, desde afuera, lo que recibe quien evalúa el
trabajo: la aplicación publicada, la carpeta pública de Drive y este repositorio.

```bash
cd validacion
npm install
npx playwright install chromium
npx playwright test
```

| Proyecto | Qué comprueba |
|---|---|
| `publicada`, `publicada-movil` | La app en https://punto-ciego-zeta.vercel.app, en escritorio (1440×900) y en teléfono (390×844): cada ruta carga con su encabezado y el aviso de datos sintéticos, sin errores de consola ni desborde, y la cadena central completa (crónica con alerta, inspección y cierre firmado, ficha, reclamo del vecino) |
| `enlaces` | La carpeta de Drive se abre sin sesión y lista el video, el código y el instructivo; el repositorio es público y tiene su README |
| `local`, `local-movil` | Lo mismo que `publicada`, contra una copia local: se activan con `CLON=<ruta a prototipo>` (con `npm install` hecho), que se compila y se sirve en el puerto 4393 |

Variables: `URL_APP`, `URL_DRIVE`, `URL_REPO`, `CLON` y `PUERTO_LOCAL`. En PowerShell
se definen con `$env:CLON = "..\prototipo"` antes del comando. El informe HTML queda en
`informe/`.
