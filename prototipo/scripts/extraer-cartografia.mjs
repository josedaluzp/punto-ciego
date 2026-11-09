#!/usr/bin/env node
/**
 * Extrae la cartografía de la provincia de Córdoba para la demo.
 *
 * Fuente: entregas/entrega-2/diseno-navegacion/datos/mapa.json (la misma de los
 * canvas de la Entrega 2 y de las figuras de la Entrega 3).
 *
 * Genera:
 *   src/datos/cartografia.json  contorno, vecinas, rutas con su referencia,
 *                               ciudades con lat/lon y departamento, capas
 *                               viales de la ciudad de Córdoba y los dos
 *                               ajustes lineales lat/lon <-> x/y.
 *   src/datos/cartografia-base.json  sólo los ajustes y las ciudades: lo que
 *                               usa el dominio al arrancar, sin el dibujo del
 *                               mapa (que se baja aparte, con el mapa).
 *   src/datos/postes.json       capa simulada de postes kilométricos: un poste
 *                               por kilómetro entre las progresivas de anclaje
 *                               de cada ruta, ajustado a la traza dibujada.
 *
 * Las coordenadas se redondean para mantener chico el JSON: un decimal en el
 * plano de la provincia (≈ 100 m), enteros en el plano de la ciudad (≈ 33 m) y
 * cinco decimales en lat/lon (≈ 1 m).
 *
 * Uso: node scripts/extraer-cartografia.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');
const FUENTE = resolve(RAIZ, '../entregas/entrega-2/diseno-navegacion/datos/mapa.json');
const mapa = JSON.parse(readFileSync(FUENTE, 'utf8'));
const prov = mapa.provincias.cordoba;
const ciudad = mapa.ciudades.cordoba;

// ── Ciudades de la provincia: coordenadas reales (centro urbano) ────────────
// Sirven de puntos de control del ajuste de la provincia y para ubicar por
// localidad cuando la progresiva no figura en la capa de postes.
const CIUDADES = {
  'Córdoba': { lat: -31.4135, lon: -64.1811, departamento: 'Capital' },
  'Río Cuarto': { lat: -33.1232, lon: -64.3493, departamento: 'Río Cuarto' },
  'Villa María': { lat: -32.4075, lon: -63.2402, departamento: 'General San Martín' },
  'Villa Carlos Paz': { lat: -31.4241, lon: -64.4978, departamento: 'Punilla' },
  'San Francisco': { lat: -31.4278, lon: -62.0827, departamento: 'San Justo' },
  'Alta Gracia': { lat: -31.6529, lon: -64.4283, departamento: 'Santa María' },
  'Río Tercero': { lat: -32.173, lon: -64.1141, departamento: 'Tercero Arriba' },
  'Jesús María': { lat: -30.9815, lon: -64.0942, departamento: 'Colón' },
  'Cruz del Eje': { lat: -30.7264, lon: -64.8077, departamento: 'Cruz del Eje' },
  'Bell Ville': { lat: -32.6259, lon: -62.6888, departamento: 'Unión' },
};

// Localidades intermedias usadas solo como anclas de progresiva (no se dibujan).
const ANCLAS = {
  'Río Primero': { lat: -31.3297, lon: -63.6197 },
  'Arroyito': { lat: -31.4199, lon: -63.05 },
  'Las Varillas': { lat: -31.8721, lon: -62.7194 },
  'General Deheza': { lat: -32.7562, lon: -63.7888 },
  'Almafuerte': { lat: -32.1928, lon: -64.2556 },
  'Sampacho': { lat: -33.3839, lon: -64.7214 },
  'Cosquín': { lat: -31.2451, lon: -64.4656 },
  'Villa del Totoral': { lat: -30.7036, lon: -64.0688 },
  'Coronel Moldes': { lat: -33.6228, lon: -64.5971 },
  'Vicuña Mackenna': { lat: -33.9183, lon: -64.3893 },
};

// Progresivas de anclaje por ruta (sintéticas, de demostración). Entre dos
// anclas consecutivas se interpola un poste por kilómetro. Fuera del primer y
// del último ancla la ruta no tiene postes cargados: la progresiva "no figura
// en la capa" y el sistema cae a la localidad con confianza baja (CU02 2.b).
const PROGRESIVAS = {
  'RN 9': [['Bell Ville', 460], ['Villa María', 520], ['Córdoba', 660], ['Jesús María', 700], ['Villa del Totoral', 735]],
  'RN 19': [['Córdoba', 110], ['Río Primero', 170], ['Arroyito', 250], ['San Francisco', 320]],
  'RN 158': [['San Francisco', 0], ['Las Varillas', 75], ['Villa María', 175], ['General Deheza', 235], ['Río Cuarto', 300]],
  'RN 36': [['Córdoba', 600], ['Almafuerte', 680], ['Río Cuarto', 770]],
  'RN 38': [['Villa Carlos Paz', 20], ['Cosquín', 45], ['Cruz del Eje', 130]],
  'RN 8': [['Río Cuarto', 600], ['Sampacho', 645]],
  'RN 35': [['Río Cuarto', 600], ['Coronel Moldes', 660], ['Vicuña Mackenna', 700]],
};

// ── utilidades ──────────────────────────────────────────────────────────────
const r1 = (v) => Math.round(v * 10) / 10;
const r5 = (v) => Math.round(v * 1e5) / 1e5;

function numeros(d) {
  return (d.match(/-?\d+\.?\d*/g) ?? []).map(Number);
}

/** Segmentos de un path "M x y L x y ..." como listas de puntos. */
function segmentos(d) {
  return d
    .split('M')
    .filter((s) => s.trim())
    .map((s) => {
      const n = numeros(s);
      const pts = [];
      for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
      return pts;
    });
}

function caja(d) {
  const n = numeros(d);
  const xs = n.filter((_, i) => i % 2 === 0);
  const ys = n.filter((_, i) => i % 2 === 1);
  return [r1(Math.min(...xs)), r1(Math.min(...ys)), r1(Math.max(...xs)), r1(Math.max(...ys))];
}

/** Ajuste lineal por mínimos cuadrados v = a·u + b. */
function ajuste(us, vs) {
  const n = us.length;
  const mu = us.reduce((a, b) => a + b, 0) / n;
  const mv = vs.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (us[i] - mu) * (vs[i] - mv);
    den += (us[i] - mu) ** 2;
  }
  const a = num / den;
  return { a, b: mv - a * mu };
}

// ── ajuste de la provincia con las 10 ciudades como puntos de control ──────
const control = prov.ciudades.map((c) => ({ ...c, ...CIUDADES[c.nombre] }));
for (const c of control) if (c.lat === undefined) throw new Error(`Falta lat/lon de ${c.nombre}`);
const fx = ajuste(control.map((c) => c.lon), control.map((c) => c.x));
const fy = ajuste(control.map((c) => c.lat), control.map((c) => c.y));
const proyProv = { ax: fx.a, bx: fx.b, ay: fy.a, by: fy.b };
const aProv = (lat, lon) => [proyProv.ax * lon + proyProv.bx, proyProv.ay * lat + proyProv.by];
const deProv = (x, y) => [(y - proyProv.by) / proyProv.ay, (x - proyProv.bx) / proyProv.ax];
const residuos = control.map((c) => {
  const [x, y] = aProv(c.lat, c.lon);
  return Math.hypot(x - c.x, y - c.y);
});
console.log(`Ajuste de la provincia: residuo máximo ${Math.max(...residuos).toFixed(2)} px`);

// ── ajuste de la ciudad con los dos casos de coordenada real (E2) ──────────
const reales = ciudad.marcas.filter((m) => m.lat != null);
const [ma, mb] = reales;
const proyCiudad = {
  ax: (ma.x - mb.x) / (ma.lon - mb.lon),
  bx: mb.x - mb.lon * ((ma.x - mb.x) / (ma.lon - mb.lon)),
  ay: (ma.y - mb.y) / (ma.lat - mb.lat),
  by: mb.y - mb.lat * ((ma.y - mb.y) / (ma.lat - mb.lat)),
};
console.log(
  `Ajuste de la ciudad: ${(proyCiudad.ax / 94.9).toFixed(1)} px/km en x, ${(-proyCiudad.ay / 111.2).toFixed(1)} px/km en y`,
);

// ── capas de la ciudad, redondeadas a enteros ───────────────────────────────
function redondearPath(d) {
  return segmentos(d)
    .map((pts) => {
      const out = [];
      for (const [x, y] of pts) {
        const p = [Math.round(x), Math.round(y)];
        const u = out[out.length - 1];
        if (!u || u[0] !== p[0] || u[1] !== p[1]) out.push(p);
      }
      return out;
    })
    .filter((pts) => pts.length > 1)
    .map((pts) => 'M' + pts.map((p) => p.join(' ')).join('L'))
    .join('');
}
const capas = {};
for (const k of ['a', 'b', 'c']) capas[k] = redondearPath(ciudad.capas[k] ?? '');

// ── postes kilométricos ─────────────────────────────────────────────────────
function lugar(nombre) {
  const c = CIUDADES[nombre] ?? ANCLAS[nombre];
  if (!c) throw new Error(`Ancla desconocida: ${nombre}`);
  return c;
}

/** Proyecta un punto sobre el segmento más cercano de la traza. */
function ajustarATraza(segs, x, y) {
  let mejor = null;
  for (const pts of segs) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy || 1e-9;
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / l2));
      const px = x1 + t * dx;
      const py = y1 + t * dy;
      const d = Math.hypot(px - x, py - y);
      if (!mejor || d < mejor.d) mejor = { x: px, y: py, d };
    }
  }
  return mejor;
}

const postes = {};
for (const ruta of prov.rutas) {
  const anclas = PROGRESIVAS[ruta.ref];
  if (!anclas) continue;
  const segs = segmentos(ruta.d);
  const lista = [];
  let desvioMax = 0;
  for (let i = 0; i + 1 < anclas.length; i++) {
    const [na, ka] = anclas[i];
    const [nb, kb] = anclas[i + 1];
    const a = lugar(na);
    const b = lugar(nb);
    for (let km = ka; km < kb || (i + 2 === anclas.length && km === kb); km++) {
      const t = (km - ka) / (kb - ka);
      const lat = a.lat + (b.lat - a.lat) * t;
      const lon = a.lon + (b.lon - a.lon) * t;
      const [x, y] = aProv(lat, lon);
      const p = ajustarATraza(segs, x, y);
      desvioMax = Math.max(desvioMax, p.d);
      const [plat, plon] = deProv(p.x, p.y);
      lista.push([km, r5(plat), r5(plon)]);
    }
  }
  postes[ruta.ref] = { desde: anclas[0][1], hasta: anclas[anclas.length - 1][1], postes: lista };
  console.log(`${ruta.ref}: ${lista.length} postes (km ${anclas[0][1]} a ${anclas.at(-1)[1]}), desvío máx. a la traza ${desvioMax.toFixed(1)} px`);
}

// ── salida ──────────────────────────────────────────────────────────────────
const cartografia = {
  fuente: 'entregas/entrega-2/diseno-navegacion/datos/mapa.json',
  proyeccion: {
    provincia: Object.fromEntries(Object.entries(proyProv).map(([k, v]) => [k, Math.round(v * 1e4) / 1e4])),
    ciudad: Object.fromEntries(Object.entries(proyCiudad).map(([k, v]) => [k, Math.round(v * 1e4) / 1e4])),
  },
  provincia: {
    nombre: prov.nombre,
    d: prov.d,
    caja: caja(prov.d),
    vecinas: prov.vecinas.map((v) => ({ nombre: v.nombre, d: v.d })),
    rutas: prov.rutas.map((r) => ({ ref: r.ref, nacional: r.nacional, d: r.d, lx: r.lx, ly: r.ly })),
    ciudades: control.map((c) => ({
      nombre: c.nombre,
      x: c.x,
      y: c.y,
      lat: c.lat,
      lon: c.lon,
      departamento: c.departamento,
    })),
  },
  ciudad: {
    nombre: ciudad.nombre,
    caja: [0, 0, 1000, 664],
    capas,
  },
};

const destino = resolve(RAIZ, 'src/datos/cartografia.json');
writeFileSync(destino, JSON.stringify(cartografia));
const base = { fuente: cartografia.fuente, proyeccion: cartografia.proyeccion, ciudades: cartografia.provincia.ciudades };
writeFileSync(resolve(RAIZ, 'src/datos/cartografia-base.json'), JSON.stringify(base));
writeFileSync(resolve(RAIZ, 'src/datos/postes.json'), JSON.stringify(postes));
console.log(`cartografia.json: ${(JSON.stringify(cartografia).length / 1024).toFixed(0)} KB`);
console.log(`postes.json: ${(JSON.stringify(postes).length / 1024).toFixed(0)} KB`);
