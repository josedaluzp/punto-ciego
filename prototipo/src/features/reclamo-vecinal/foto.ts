/**
 * Fotografía optativa del reclamo (RF15). Nunca se sube a ningún lado: se
 * reduce en el navegador a una imagen chica (lado mayor de 640 px, JPEG) y se
 * guarda con el reclamo en el almacenamiento local de la demo, para que el
 * área técnica la vea en su bandeja.
 */
const LADO_MAX = 640;
const CALIDAD = 0.72;

export function esImagen(archivo: File): boolean {
  return archivo.type.startsWith('image/');
}

export async function reducirFoto(archivo: File): Promise<string> {
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    const escala = Math.min(1, LADO_MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * escala));
    const h = Math.max(1, Math.round(img.naturalHeight * escala));
    const lienzo = document.createElement('canvas');
    lienzo.width = w;
    lienzo.height = h;
    const ctx = lienzo.getContext('2d');
    if (!ctx) throw new Error('Sin contexto 2D');
    ctx.drawImage(img, 0, 0, w, h);
    return lienzo.toDataURL('image/jpeg', CALIDAD);
  } finally {
    URL.revokeObjectURL(url);
  }
}
