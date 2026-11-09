/** Acciones de la base: usuario de demostración y restablecimiento. */
import { USUARIOS } from '../../datos/usuarios';
import { restablecerDatos, useDemo } from '../store';

export { restablecerDatos };

export function cambiarUsuario(id: string): void {
  if (!USUARIOS.some((u) => u.id === id)) throw new Error(`Usuario de demostración desconocido: ${id}`);
  useDemo.setState({ usuarioId: id });
}
