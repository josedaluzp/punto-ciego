import { useEffect, useState } from 'react';
import { AbsoluteFill, cancelRender, continueRender, delayRender, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { Encabezado, useEntrada } from './comunes';
import { Narracion, segundosDe, TEXTOS } from './voz';
import { C, PAPEL, REGISTRO, UI } from './estilo';

/**
 * Capítulo 00, armado en Remotion: el repositorio con su README y la puesta en
 * marcha local con los pasos del instructivo (descomprimir, instalar, iniciar),
 * hasta la aplicación abierta en el navegador.
 *
 * La salida de `npm install` es la real del ZIP de la entrega; la de Vite
 * reproduce su formato con la versión del proyecto (8.3.7).
 */

const [S_REPOSITORIO, S_DOMINIO, S_TERMINAL, S_NAVEGADOR] = TEXTOS.puesta;

/**
 * Cada tramo dura lo que su animación y su narración necesitan; los subtítulos (los
 * mismos textos que se narran) arrancan cuando terminó el anterior.
 */
const RESPIRO = 0.8;
const INICIO_DOMINIO = Math.max(10, 0.6 + segundosDe(S_REPOSITORIO) + RESPIRO);
const TRAMOS = {
  repositorio: Math.max(20, INICIO_DOMINIO + segundosDe(S_DOMINIO) + RESPIRO),
  terminal: Math.max(21, 0.5 + segundosDe(S_TERMINAL) + RESPIRO),
  navegador: Math.max(11, 0.5 + segundosDe(S_NAVEGADOR) + 2),
};
export const DURACION_PUESTA = (fps: number) => Math.round((TRAMOS.repositorio + TRAMOS.terminal + TRAMOS.navegador) * fps);

const SUBTITULOS: { s: number; texto: string }[] = [
  { s: 0.6, texto: S_REPOSITORIO },
  { s: INICIO_DOMINIO, texto: S_DOMINIO },
  { s: TRAMOS.repositorio + 0.5, texto: S_TERMINAL },
  { s: TRAMOS.repositorio + TRAMOS.terminal + 0.5, texto: S_NAVEGADOR },
];

/** Árbol del proyecto (prototipo/), con las carpetas de src desplegadas. */
const ARBOL: { nombre: string; nivel: number; carpeta?: boolean; destacar?: number; nota?: string }[] = [
  { nombre: 'demo', nivel: 0, carpeta: true, nota: 'grabación de este video' },
  { nombre: 'docs', nivel: 0, carpeta: true },
  { nombre: 'e2e', nivel: 0, carpeta: true, destacar: INICIO_DOMINIO + 3.5, nota: 'pruebas de punta a punta' },
  { nombre: 'public', nivel: 0, carpeta: true },
  { nombre: 'scripts', nivel: 0, carpeta: true },
  { nombre: 'src', nivel: 0, carpeta: true },
  { nombre: 'datos', nivel: 1, carpeta: true, nota: 'semilla de demostración' },
  { nombre: 'dominio', nivel: 1, carpeta: true, destacar: INICIO_DOMINIO + 0.5, nota: 'reglas del negocio' },
  { nombre: 'estado', nivel: 1, carpeta: true },
  { nombre: 'features', nivel: 1, carpeta: true, destacar: INICIO_DOMINIO + 2, nota: 'una carpeta por pantalla' },
  { nombre: 'rutas', nivel: 1, carpeta: true },
  { nombre: 'ui', nivel: 1, carpeta: true, nota: 'componentes compartidos' },
  { nombre: 'App.tsx', nivel: 1 },
  { nombre: 'main.tsx', nivel: 1 },
  { nombre: 'index.html', nivel: 0 },
  { nombre: 'package.json', nivel: 0 },
  { nombre: 'playwright.config.ts', nivel: 0 },
  { nombre: 'README.md', nivel: 0 },
  { nombre: 'vite.config.ts', nivel: 0 },
];

const RUTA = 'PS C:\\Users\\evaluador\\Descargas';
/** Cada línea aparece en el segundo `s` (relativo al tramo); los comandos se tipean. */
const TERMINAL: { s: number; texto: string; comando?: boolean; tenue?: boolean; prompt?: string }[] = [
  { s: 0.8, prompt: `${RUTA}>`, texto: 'Expand-Archive codigo-fuente-punto-ciego.zip -DestinationPath .', comando: true },
  { s: 4.2, prompt: `${RUTA}>`, texto: 'cd punto-ciego', comando: true },
  { s: 6.0, prompt: `${RUTA}\\punto-ciego>`, texto: 'npm install', comando: true },
  { s: 8.6, texto: 'added 166 packages in 6s', tenue: true },
  { s: 10.2, prompt: `${RUTA}\\punto-ciego>`, texto: 'npm run dev', comando: true },
  { s: 12.2, texto: '> punto-ciego-prototipo@0.1.0 dev', tenue: true },
  { s: 12.4, texto: '> vite', tenue: true },
  { s: 13.4, texto: '  VITE v8.3.7  ready in 412 ms' },
  { s: 13.6, texto: '  ➜  Local:   http://localhost:5173/' },
  { s: 13.7, texto: '  ➜  Network: use --host to expose', tenue: true },
];

const Ventana: React.FC<{ titulo: string; oscura?: boolean; children: React.ReactNode; style?: React.CSSProperties }> = ({ titulo, oscura, children, style }) => (
  <div style={{ border: `1px solid ${C.linea}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 60px -24px rgba(20,30,60,.45)', background: oscura ? '#141a29' : C.papel, display: 'flex', flexDirection: 'column', ...style }}>
    <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 18px', background: oscura ? '#1d2436' : '#eef0f4', borderBottom: `1px solid ${oscura ? '#2a3247' : C.linea}` }}>
      {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: '50%', background: c }} />)}
      <span style={{ marginLeft: 14, fontFamily: REGISTRO, fontSize: 19, color: oscura ? '#9aa3b8' : C.tenue }}>{titulo}</span>
    </div>
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>{children}</div>
  </div>
);

const ESTILO_README = `
.readme { font-family: ${UI}; color: #1f2328; font-size: 21px; line-height: 1.55; padding: 30px 46px; }
.readme h1 { font-size: 38px; border-bottom: 1px solid #d0d7de; padding-bottom: 10px; margin: 0 0 18px; }
.readme h2 { font-size: 29px; border-bottom: 1px solid #d0d7de; padding-bottom: 8px; margin: 34px 0 14px; }
.readme h3 { font-size: 24px; margin: 26px 0 10px; }
.readme code { font-family: ${REGISTRO}; font-size: 19px; background: #eff1f3; padding: 2px 6px; border-radius: 5px; }
.readme pre { background: #f6f8fa; padding: 16px 20px; border-radius: 8px; }
.readme pre code { background: none; padding: 0; }
.readme table { border-collapse: collapse; margin: 12px 0; font-size: 19px; }
.readme th, .readme td { border: 1px solid #d0d7de; padding: 6px 12px; text-align: left; }
.readme a { color: #0969da; text-decoration: none; }
.readme ul { padding-left: 28px; }
`;

function useReadme() {
  const [html, setHtml] = useState<string | null>(null);
  const [espera] = useState(() => delayRender('README'));
  useEffect(() => {
    fetch(staticFile('tomas/readme.html'))
      .then((r) => r.text())
      .then((t) => {
        setHtml(t);
        continueRender(espera);
      })
      .catch((e) => cancelRender(e));
  }, [espera]);
  return html;
}

const Repositorio: React.FC<{ s: number }> = ({ s }) => {
  const readme = useReadme();
  const desplazamiento = interpolate(s, [3, TRAMOS.repositorio - 1], [0, 2600], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <Ventana titulo="punto-ciego · código fuente" style={{ width: 1536, height: 820, ...useEntrada(0) }}>
      <div style={{ display: 'flex', height: '100%' }}>
        <div style={{ width: 430, borderRight: `1px solid ${C.linea}`, padding: '22px 0', fontFamily: REGISTRO, fontSize: 21, background: '#fafbfc' }}>
          {ARBOL.map((a) => {
            const luz = a.destacar !== undefined ? interpolate(s, [a.destacar, a.destacar + 0.4, a.destacar + 3.5, a.destacar + 4], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : 0;
            return (
              <div key={a.nombre + a.nivel} style={{ padding: `5px 18px 5px ${22 + a.nivel * 26}px`, display: 'flex', gap: 10, alignItems: 'baseline', background: `rgba(200,16,46,${0.12 * luz})`, color: a.carpeta ? C.tinta : C.tenue }}>
                <span>{a.carpeta ? '▸' : ' '}</span>
                <span style={{ fontWeight: a.carpeta ? 700 : 400 }}>{a.nombre}{a.carpeta ? '/' : ''}</span>
                {a.nota && <span style={{ fontFamily: UI, fontSize: 15, color: luz > 0.5 ? C.rojo : C.tenue }}>{a.nota}</span>}
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <style>{ESTILO_README}</style>
          {readme && <div className="readme" style={{ transform: `translateY(${-desplazamiento}px)` }} dangerouslySetInnerHTML={{ __html: readme }} />}
        </div>
      </div>
    </Ventana>
  );
};

const Terminal: React.FC<{ s: number }> = ({ s }) => (
  <Ventana titulo="Windows PowerShell" oscura style={{ width: 1536, height: 820, ...useEntrada(0) }}>
    <div style={{ padding: '26px 30px', fontFamily: REGISTRO, fontSize: 25, lineHeight: 1.65, color: '#e6e9f0' }}>
      {TERMINAL.filter((l) => s >= l.s).map((l, i) => {
        const letras = l.comando ? Math.floor((s - l.s) * 26) : l.texto.length;
        const escribiendo = l.comando && letras < l.texto.length;
        return (
          <div key={i} style={{ color: l.tenue ? '#8b93a7' : l.texto.includes('VITE') ? '#a5b4fc' : '#e6e9f0', whiteSpace: 'pre' }}>
            {l.prompt && <span style={{ color: '#7dd3a8' }}>{l.prompt} </span>}
            {l.texto.slice(0, letras)}
            {escribiendo && <span style={{ background: '#e6e9f0' }}> </span>}
          </div>
        );
      })}
    </div>
  </Ventana>
);

const Navegador: React.FC<{ s: number }> = ({ s }) => {
  const escribir = 'localhost:5173';
  const letras = Math.floor(interpolate(s, [0.4, 1.6], [0, escribir.length], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  const carga = interpolate(s, [1.9, 2.6], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ width: 1536, border: `1px solid ${C.linea}`, borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 60px -24px rgba(20,30,60,.45)', ...useEntrada(0) }}>
      <div style={{ height: 50, display: 'flex', alignItems: 'center', gap: 16, padding: '0 18px', background: '#eef0f4', borderBottom: `1px solid ${C.linea}` }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: '50%', background: c }} />)}
        </div>
        <div style={{ flex: 1, height: 32, borderRadius: 16, background: '#fff', border: `1px solid ${C.linea}`, display: 'flex', alignItems: 'center', padding: '0 18px', fontFamily: UI, fontSize: 19, color: C.tinta }}>
          {s < 2.6 ? escribir.slice(0, letras) : 'localhost:5173/priorizacion'}
        </div>
      </div>
      <div style={{ height: 864, background: C.papel, position: 'relative' }}>
        <Img src={staticFile('tomas/escritorio-inicio.png')} style={{ width: '100%', height: '100%', opacity: carga }} />
      </div>
    </div>
  );
};

export const PuestaEnMarcha: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = frame / fps;
  const tramo = s < TRAMOS.repositorio ? 'repositorio' : s < TRAMOS.repositorio + TRAMOS.terminal ? 'terminal' : 'navegador';
  const vigente = SUBTITULOS.filter((x) => x.s <= s).at(-1);
  const opacidad = vigente ? interpolate(s - vigente.s, [0, 0.35], [0, 1], { extrapolateRight: 'clamp' }) : 0;
  const navegador = tramo === 'navegador';
  return (
    <AbsoluteFill style={{ ...PAPEL, padding: '24px 192px 0' }}>
      <Encabezado n={0} c={{ titulo: 'Puesta en marcha', casos: 'repositorio · instructivo' }} />
      {SUBTITULOS.map((x) => <Narracion key={x.s} texto={x.texto} desde={x.s} />)}
      <div style={{ marginTop: 16, height: navegador ? 916 : 836, position: 'relative' }}>
        {tramo === 'repositorio' && <Repositorio s={s} />}
        {tramo === 'terminal' && <Terminal s={s - TRAMOS.repositorio} />}
        {navegador && (
          <div style={{ transform: 'scale(0.9)', transformOrigin: 'top center' }}>
            <Navegador s={s - TRAMOS.repositorio - TRAMOS.terminal} />
          </div>
        )}
      </div>
      {!navegador && (
        <div style={{ marginTop: 14, minHeight: 76, fontFamily: UI, fontSize: 28, lineHeight: 1.35, color: C.tinta, maxWidth: 1536, opacity: opacidad }}>{vigente?.texto}</div>
      )}
      {navegador && (
        <div style={{ position: 'absolute', left: 192, right: 192, bottom: 30, fontFamily: UI, fontSize: 28, lineHeight: 1.35, color: C.tinta, opacity: opacidad }}>{vigente?.texto}</div>
      )}
    </AbsoluteFill>
  );
};
