#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera la narración del video con una voz neural gratuita (edge-tts, el servicio de
lectura en voz alta de Microsoft Edge; no pide cuenta ni clave).

Narra lo mismo que se lee en pantalla: los subtítulos que escribe la grabación
(`decir('…')` en ../prototipo/demo/grabar.spec.ts) y los textos de las placas y de la
puesta en marcha (narracion.json). Antes de sintetizar adapta lo que no se lee bien en
voz alta (RN, km, Av., los números de reclamo y de ficha), sin cambiar el subtítulo.

Deja:
- public/voz/<id>.mp3, un audio por texto (se reutiliza si el texto no cambió);
- public/voz/voz.json, texto → {archivo, ms}, que usa Remotion;
- ../prototipo/demo/voz.json, texto → ms, que usa la grabación para esperar a que
  termine cada frase antes de seguir.

Requiere `pip install edge-tts==7.3.1`, ffprobe y conexión a internet.

Uso:
    python scripts/narrar.py
"""

import asyncio
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

import edge_tts

RAIZ = Path(__file__).resolve().parent.parent
GUION = RAIZ.parent / "prototipo" / "demo" / "grabar.spec.ts"
NARRACION = RAIZ / "narracion.json"
SALIDA = RAIZ / "public" / "voz"
DURACIONES_GRABACION = RAIZ.parent / "prototipo" / "demo" / "voz.json"

# Lo que la voz leería mal, en el orden en que se aplica.
PRONUNCIACION = [
    (r"\blos km\b", "los kilómetros"),
    (r"\bkm\b", "kilómetro"),
    (r"\bRN (\d+)", r"ruta nacional \1"),
    (r"\bAv\. ", "avenida "),
    (r"\bPN-2026-0*(\d+)", r"pe ene \1"),
    (r"\bFI-2026-0*(\d+)", r"efe i \1"),
    (r"\bsrc/(\w+)", r"la carpeta \1"),
    (r"\be2e\b", "la carpeta e dos e"),
    (r"\bREADME\b", "archivo de documentación"),
    (r"\bNode\.js\b", "Node"),
]


def para_leer(texto):
    for patron, reemplazo in PRONUNCIACION:
        texto = re.sub(patron, reemplazo, texto)
    return texto


def textos():
    guion = GUION.read_text(encoding="utf-8")
    dichos = [t.replace("\\'", "'") for t in re.findall(r"decir\('((?:[^'\\]|\\.)*)'\)", guion)]
    narracion = json.loads(NARRACION.read_text(encoding="utf-8"))
    return narracion["voz"], list(dict.fromkeys(list(narracion["placas"].values()) + narracion["puesta"] + dichos))


def duracion_ms(archivo):
    salida = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                             "-of", "default=nw=1:nk=1", str(archivo)],
                            check=True, capture_output=True, text=True).stdout
    return round(float(salida) * 1000)


async def sintetizar(voz, texto, archivo):
    await edge_tts.Communicate(para_leer(texto), voz).save(str(archivo))


async def main():
    voz, todos = textos()
    SALIDA.mkdir(parents=True, exist_ok=True)
    indice = {}
    nuevos = 0
    for texto in todos:
        # El nombre depende de la voz y de lo que se lee: un cambio en el texto o en la
        # pronunciación genera un audio nuevo; el resto se reutiliza.
        clave = hashlib.sha1(f"{voz}|{para_leer(texto)}".encode("utf-8")).hexdigest()[:16]
        archivo = SALIDA / f"{clave}.mp3"
        if not archivo.exists():
            await sintetizar(voz, texto, archivo)
            nuevos += 1
        indice[texto] = {"archivo": archivo.name, "ms": duracion_ms(archivo)}

    (SALIDA / "voz.json").write_text(json.dumps(indice, ensure_ascii=False, indent=1), encoding="utf-8")
    DURACIONES_GRABACION.write_text(
        json.dumps({t: v["ms"] for t, v in indice.items()}, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")
    total = sum(v["ms"] for v in indice.values()) / 1000
    print(f"{len(indice)} textos narrados ({nuevos} nuevos), {total / 60:.1f} minutos de voz.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
