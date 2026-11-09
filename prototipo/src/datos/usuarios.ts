/** Usuarios de demostración (personas ficticias). Quién hace cada acción queda registrado. */
import type { Usuario } from '../dominio/tipos';

export const USUARIOS: readonly Usuario[] = [
  { id: 'lahumada', nombre: 'L. Ahumada', rol: 'analista', cargo: 'Analista de siniestralidad', area: 'Observatorio de Siniestralidad' },
  { id: 'rquiroga', nombre: 'R. Quiroga', rol: 'tecnico', cargo: 'Técnico de tránsito', area: 'Ingeniería de Tránsito' },
  { id: 'mferreyra', nombre: 'M. Ferreyra', rol: 'funcionario', cargo: 'Funcionario a cargo', area: 'Ingeniería de Tránsito' },
];

export const USUARIO_PREDETERMINADO = 'rquiroga';

export function usuarioPorId(id: string): Usuario {
  return USUARIOS.find((u) => u.id === id) ?? USUARIOS[1]!;
}
