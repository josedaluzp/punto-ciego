/**
 * Almacenamiento de los stores persistidos (`createJSONStorage`).
 *
 * Sin `localStorage` (pre-render en Node) tira un error en vez de devolver
 * `undefined`: así `createJSONStorage` no arma un almacenamiento roto y
 * `persist` queda inactivo. Desde Node 25 `localStorage` existe como global
 * pero vale `undefined` si no se pasa `--localstorage-file`, y el build de
 * Vercel (Node 26) se caía al pre-renderizar.
 */
export function almacenamientoNavegador(): Storage {
  const almacenamiento = globalThis.localStorage as Storage | undefined;
  if (!almacenamiento) throw new Error('localStorage no está disponible');
  return almacenamiento;
}
