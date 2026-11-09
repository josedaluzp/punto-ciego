/** Componentes compartidos de la demo. Ver el catálogo en la ruta /componentes. */
export { Shell, ShellPublico, type ShellProps } from './Shell';
export { Mapa } from './MapaDiferido';
export type { MapaProps, Marcador, FormaMarcador, TonoMarcador, Encuadre } from './Mapa';
export { Croquis, type CroquisProps, type SiniestroCroquis } from './Croquis';
export { IdentidadLugar, EscudoRuta, ChapaCalle, Mojon, RomboIndice } from './IdentidadLugar';
export { Boton, type BotonProps, type VarianteBoton } from './Boton';
export { claseBoton } from './claseBoton';
export { Select, CampoTexto, AreaTexto, FilaFiltros, type Opcion } from './Campos';
export { Tabla, type Columna, type EstadoFila, type TablaProps } from './Tabla';
export { ChipEstado, Registro, Vacio, AvisoSintetico } from './Estado';
export { textoEstado, type ClaveEstado } from './estados';
export { MedidorConfianza } from './MedidorConfianza';
export { Avisos } from './Toast';
export { avisar, descartarAviso, useAvisos, type TonoAviso } from './avisos';
export { Icono, type NombreIcono } from './Icono';
