/**
 * Extracción de los datos de una crónica (RF02).
 *
 * Reglas sobre el español de las crónicas policiales de los medios de
 * Córdoba. No es un modelo de lenguaje: reconoce las formas con que los medios
 * nombran el lugar ("ruta nacional 9, a la altura del kilómetro 694",
 * "avenida Colón al 5300", "en la intersección de X y Y", "barrio X"), la
 * fecha del hecho relativa a la publicación ("anoche", "el sábado", "el 12 de
 * septiembre"), las víctimas fatales y heridas de gravedad con su tipo de
 * usuario, y el tipo de siniestro por sus palabras clave.
 */
import { diaSemana, sumarDias, esFechaValida } from './fechas';
import { claveCalle, normalizar } from './texto';
import { normalizarRuta } from './postes';
import { buscarCalle } from './normalizacion';
import type { LugarExtraido, TipoSiniestro, TipoUsuario, Victima } from './tipos';
import cartografia from '../datos/cartografia-base.json';

export interface Extraccion {
  lugar: LugarExtraido | null;
  fechaHecho: string;
  victimas: Victima[];
  fallecidos: number;
  heridosGraves: number;
  /** Muertes mencionadas sin un tipo de usuario reconocible. */
  fallecidosSinTipo: number;
  tipo: TipoSiniestro | null;
}

// ── Lugar ───────────────────────────────────────────────────────────────────

const MAY = 'A-ZÁÉÍÓÚÜÑ';
const MIN = 'a-záéíóúüñ';
/** Una palabra con mayúscula inicial: "Colón", "B.", "O'Higgins". */
const PALABRA = `(?:[${MAY}]\\.|[${MAY}](?:'[${MAY}])?[${MIN}]+)`;
/** Nombre propio de varias palabras con conectores: "Cerro de las Rosas". */
const NOMBRE = `${PALABRA}(?:\\s+(?:(?:de|del|la|las|los|el)\\s+)*${PALABRA})*`;
const TIPO_VIA = '([Aa]venida|[Aa]v\\.|[Bb]ulevar|[Bb]v\\.|[Cc]alle|[Pp]asaje)';

const RE_RUTA = /\b(?:ruta\s+(?:(nacional|provincial|nac\.|prov\.)\s*)?|r(n|p)\s*)(?:n(?:[°º]|ro\.?|úmero)\s*)?(\d{1,3})\b/gi;
const RE_KM = /\b(?:kil[oó]metro|km\.?)\s*(\d{1,4}(?:[.,]\d+)?)/gi;
const RE_INTERSECCION = new RegExp(
  `(?:[Ii]ntersecci[oó]n de|[Ee]squina de|[Cc]ruce de)\\s+(?:la\\s+|las\\s+)?(?:${TIPO_VIA}\\s+)?(${NOMBRE})\\s+y\\s+(?:${TIPO_VIA}\\s+)?(${NOMBRE})`,
);
const RE_CUADRA = new RegExp(`(?:${TIPO_VIA}\\s+)?(${NOMBRE})\\s+al\\s+(\\d{2,5})(?!\\d)`);
const RE_CORREDOR = new RegExp(
  `${TIPO_VIA}\\s+(${NOMBRE})(?:\\s*,?\\s*(?:a la altura de(?:l)?|frente al?|cerca de(?:l)?)\\s+(?:[Bb]arrio\\s+)?(${NOMBRE}))?`,
);
const RE_BARRIO = new RegExp(`(?<![A-Za-z])[Bb]arrio\\s+(${NOMBRE})`);

const LOCALIDADES: readonly string[] = [
  ...cartografia.ciudades.map((c) => c.nombre),
  'Río Primero',
  'Arroyito',
  'Las Varillas',
  'General Deheza',
  'Almafuerte',
  'Sampacho',
  'Cosquín',
  'Villa del Totoral',
  'Coronel Moldes',
  'Vicuña Mackenna',
  'Juárez Celman',
];

/**
 * Sin prefijo de vía, el nombre capturado puede arrastrar palabras de la
 * oración ("Vecinos de Agustín Piaggio"). Se recorta por la izquierda hasta
 * el sufijo que el nomenclador reconoce tal cual; si ninguno, queda como está.
 */
function recortarNombre(nombre: string): string {
  const palabras = nombre.split(/\s+/);
  for (let i = 0; i < palabras.length; i++) {
    if (/^(de|del|la|las|los|el)$/.test(palabras[i]!)) continue;
    const cand = palabras.slice(i).join(' ');
    const c = buscarCalle(cand);
    if (c && claveCalle(c.nombre) === claveCalle(cand)) return cand;
  }
  return nombre;
}

function prefijoCalle(tipo: string | undefined, nombreCrudo: string): string {
  const nombre = tipo ? nombreCrudo : recortarNombre(nombreCrudo);
  const t = (tipo ?? '').toLowerCase();
  if (t.startsWith('av')) return `Av. ${nombre}`;
  if (t.startsWith('bv') || t.startsWith('bul')) return `Bv. ${nombre}`;
  return nombre;
}

function localidadMencionada(texto: string, excluir: string[] = []): string | undefined {
  const n = normalizar(texto);
  let mejor: { nombre: string; pos: number } | undefined;
  for (const l of LOCALIDADES) {
    if (excluir.includes(l)) continue;
    const re = new RegExp(`\\b${normalizar(l)}\\b`);
    const m = re.exec(n);
    // "provincia de Córdoba" no ubica nada.
    if (m && !(l === 'Córdoba' && /provincia de $/.test(n.slice(Math.max(0, m.index - 13), m.index)))) {
      if (!mejor || m.index < mejor.pos) mejor = { nombre: l, pos: m.index };
    }
  }
  return mejor?.nombre;
}

/** Reconoce el lugar del hecho. Prioridad: ruta con progresiva, intersección, cuadra, corredor, barrio. */
export function extraerLugar(texto: string): LugarExtraido | null {
  // Ruta, con la progresiva antes o después de la mención de la ruta.
  const [mr] = texto.matchAll(RE_RUTA);
  if (mr) {
    const tipo = (mr[1] ?? mr[2] ?? 'n').toLowerCase().startsWith('p') ? 'RP' : 'RN';
    const ruta = normalizarRuta(`${tipo} ${mr[3]}`);
    const ini = mr.index!;
    const fin = ini + mr[0].length;
    let mejor: { km: number; inicio: number; fin: number } | null = null;
    for (const mk of texto.matchAll(RE_KM)) {
      const d = mk.index! >= fin ? mk.index! - fin : ini - (mk.index! + mk[0].length);
      if (d >= 0 && d <= 90) {
        const km = Number(mk[1]!.replace(',', '.'));
        const cand = { km, inicio: Math.min(ini, mk.index!), fin: Math.max(fin, mk.index! + mk[0].length) };
        if (!mejor || Math.abs(cand.inicio - ini) < Math.abs(mejor.inicio - ini)) mejor = cand;
      }
    }
    const localidad = localidadMencionada(texto);
    if (mejor) {
      return { texto: texto.slice(mejor.inicio, mejor.fin), inicio: mejor.inicio, fin: mejor.fin, ruta, km: mejor.km, localidad };
    }
    return { texto: texto.slice(ini, fin), inicio: ini, fin, ruta, localidad };
  }

  const mi = RE_INTERSECCION.exec(texto);
  if (mi) {
    return {
      texto: mi[0],
      inicio: mi.index,
      fin: mi.index + mi[0].length,
      calle: prefijoCalle(mi[1], mi[2]!),
      calle2: prefijoCalle(mi[3], mi[4]!),
    };
  }

  const mc = RE_CUADRA.exec(texto);
  if (mc) {
    const barrio = RE_BARRIO.exec(texto)?.[1];
    const desplazamiento = mc[1] ? 0 : mc[0].indexOf(recortarNombre(mc[2]!));
    return {
      texto: mc[0].slice(desplazamiento),
      inicio: mc.index + desplazamiento,
      fin: mc.index + mc[0].length,
      calle: prefijoCalle(mc[1], mc[2]!),
      altura: Number(mc[3]),
      barrio,
    };
  }

  const mo = RE_CORREDOR.exec(texto);
  if (mo) {
    return {
      texto: mo[0],
      inicio: mo.index,
      fin: mo.index + mo[0].length,
      calle: prefijoCalle(mo[1], mo[2]!),
      barrio: mo[3] ?? RE_BARRIO.exec(texto)?.[1],
    };
  }

  const mb = RE_BARRIO.exec(texto);
  if (mb) {
    return { texto: mb[0], inicio: mb.index, fin: mb.index + mb[0].length, barrio: mb[1] };
  }

  const localidad = localidadMencionada(texto);
  if (localidad) {
    const i = normalizar(texto).indexOf(normalizar(localidad));
    return { texto: texto.slice(i, i + localidad.length), inicio: i, fin: i + localidad.length, localidad };
  }
  return null;
}

// ── Fecha del hecho ─────────────────────────────────────────────────────────

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];

/** Fecha del hecho a partir del texto y la fecha de publicación. */
export function extraerFecha(texto: string, fechaPublicacion: string): string {
  const n = normalizar(texto);
  const pub = fechaPublicacion.slice(0, 10);

  const exp = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(n);
  if (exp) {
    const iso = `${exp[3]}-${exp[2]!.padStart(2, '0')}-${exp[1]!.padStart(2, '0')}`;
    if (esFechaValida(iso)) return iso;
  }
  const larga = new RegExp(`\\b(\\d{1,2}) de (${MESES.join('|')})(?: de (\\d{4}))?`).exec(n);
  if (larga) {
    const mes = MESES.indexOf(larga[2]!) + 1;
    let anio = larga[3] ? Number(larga[3]) : Number(pub.slice(0, 4));
    let iso = `${anio}-${String(mes).padStart(2, '0')}-${larga[1]!.padStart(2, '0')}`;
    if (!larga[3] && iso > pub) {
      anio -= 1;
      iso = `${anio}-${String(mes).padStart(2, '0')}-${larga[1]!.padStart(2, '0')}`;
    }
    if (esFechaValida(iso)) return iso;
  }
  if (/\b(anteayer|antes de ayer|anteanoche)\b/.test(n)) return sumarDias(pub, -2);
  if (/\b(anoche|ayer)\b/.test(n)) return sumarDias(pub, -1);
  const dia = new RegExp(`\\b(?:el|del|este|el pasado|la (?:madrugada|manana|tarde|noche) del)\\s+(${DIAS.join('|')})\\b`).exec(n);
  if (dia) {
    const objetivo = DIAS.indexOf(dia[1]!);
    const atras = (diaSemana(pub) - objetivo + 7) % 7;
    return sumarDias(pub, -atras);
  }
  return pub;
}

// ── Víctimas ────────────────────────────────────────────────────────────────

// Estas expresiones se aplican sobre el texto normalizado (sin tildes, en
// minúsculas): `\b` de JavaScript no reconoce las vocales acentuadas.
const RE_MUERTE = /\b(murio|murieron|muere|mueren|fallecio|fallecieron|perdio la vida|perdieron la vida|sin vida|victimas? fatal(?:es)?)\b/;
const RE_GRAVE = /\b(herid[oa]s? de gravedad|heridos? graves?|gravemente herid[oa]s?|en grave estado|en estado grave|lesiones graves)\b/;
const RE_ILESO = /\b(ilesos?|ilesas?|heridas leves|heridos leves|lesiones leves|herid[oa]s? leves?)\b/;
const RE_USUARIO =
  /\b(?:(un|una|el|la|los|las|su|sus|otro|otra|dos|tres|cuatro|cinco|\d+)\s+)?(?:joven(?:es)?\s+)?(motociclistas?|peaton|peatones|peatonas?|ciclistas?|conductor(?:es|as?)?|automovilistas?|acompanantes?|pasajer[oa]s?)\b/g;

const NUMEROS: Record<string, number> = { dos: 2, tres: 3, cuatro: 4, cinco: 5 };

function tipoDe(palabra: string): TipoUsuario {
  const p = normalizar(palabra);
  if (p.startsWith('moto')) return 'motociclista';
  if (p.startsWith('peat')) return 'peaton';
  if (p.startsWith('cicl')) return 'ciclista';
  if (p.startsWith('acomp') || p.startsWith('pasaj')) return 'acompanante';
  return 'conductor';
}

function usuariosEn(fragmento: string): { tipo: TipoUsuario; cantidad: number }[] {
  const out: { tipo: TipoUsuario; cantidad: number }[] = [];
  for (const m of fragmento.matchAll(RE_USUARIO)) {
    const cuant = (m[1] ?? '').toLowerCase();
    const plural = /s$/i.test(m[2]!) && !/^(peat[oó]n)$/i.test(m[2]!);
    const cantidad = NUMEROS[cuant] ?? (/^\d+$/.test(cuant) ? Number(cuant) : plural ? 2 : 1);
    out.push({ tipo: tipoDe(m[2]!), cantidad });
  }
  return out;
}

type Clase = 'fatal' | 'grave' | 'ileso' | null;

function claseDe(original: string): Clase {
  const clausula = normalizar(original);
  if (RE_ILESO.test(clausula)) return 'ileso';
  if (RE_MUERTE.test(clausula)) return 'fatal';
  if (RE_GRAVE.test(clausula)) return 'grave';
  return null;
}

/** Víctimas fatales y heridas de gravedad, con el tipo de usuario de cada una. */
export function extraerVictimas(texto: string): { victimas: Victima[]; fallecidosSinTipo: number } {
  const victimas: Victima[] = [];
  let muertesSinUsuario = 0;
  const oraciones = texto.split(/(?<=[.!?])\s+/);
  for (const oracion of oraciones) {
    const clausulas = oracion.split(/[,;:]|\s+y\s+(?=(?:el|la|los|las|su|sus|un|una|otro|otra)\b)/i);
    let anterior: Clase = null;
    for (const c of clausulas) {
      const usuarios = usuariosEn(normalizar(c));
      let clase = claseDe(c);
      // "murieron el conductor y su acompañante": la segunda cláusula hereda.
      if (clase === null && usuarios.length > 0 && (anterior === 'fatal' || anterior === 'grave')) {
        clase = /^\s*(?:el|la|los|las|su|sus|un|una|otro|otra)\b/i.test(c) ? anterior : null;
      }
      if (clase === 'fatal' || clase === 'grave') {
        const gravedad = clase === 'fatal' ? 'fallecido' : 'herido-grave';
        for (const u of usuarios) for (let i = 0; i < u.cantidad; i++) victimas.push({ tipoUsuario: u.tipo, gravedad });
        if (clase === 'fatal' && usuarios.length === 0) muertesSinUsuario++;
      }
      if (clase !== null) anterior = clase;
    }
  }
  const fatalesConTipo = victimas.filter((v) => v.gravedad === 'fallecido').length;
  return { victimas, fallecidosSinTipo: fatalesConTipo === 0 ? Math.min(1, muertesSinUsuario) : 0 };
}

// ── Tipo de siniestro ───────────────────────────────────────────────────────

const REGLAS_TIPO: [RegExp, TipoSiniestro][] = [
  [/atropell/, 'atropello de peatón'],
  [/choque frontal|de frente|frontalmente|frontal/, 'choque frontal'],
  [/\bgir(o|ar|aba)\b|\bdobl(o|ar|aba)\b/, 'choque en giro'],
  [/de atras|desde atras|por detras|por alcance|desde el fondo/, 'choque por alcance'],
  [/despist|salida de calzada|se salio|banquina|volc|cuneta|contra un arbol|contra una columna/, 'salida de calzada'],
  [/\bcay(o|eron)\b|caida/, 'caída de motociclista'],
  [/choc|colisi|embisti|impact/, 'choque lateral'],
];

export function extraerTipo(texto: string): TipoSiniestro | null {
  const n = normalizar(texto);
  for (const [re, tipo] of REGLAS_TIPO) if (re.test(n)) return tipo;
  return null;
}

// ── Punto de entrada ────────────────────────────────────────────────────────

/** RF02: lugar, fecha del hecho, víctimas fatales y tipo de usuario de cada una. */
export function extraerDeCronica(texto: string, fechaPublicacion: string): Extraccion {
  const { victimas, fallecidosSinTipo } = extraerVictimas(texto);
  return {
    lugar: extraerLugar(texto),
    fechaHecho: extraerFecha(texto, fechaPublicacion),
    victimas,
    fallecidos: victimas.filter((v) => v.gravedad === 'fallecido').length + fallecidosSinTipo,
    heridosGraves: victimas.filter((v) => v.gravedad === 'herido-grave').length,
    fallecidosSinTipo,
    tipo: extraerTipo(texto),
  };
}
