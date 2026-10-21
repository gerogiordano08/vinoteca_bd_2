// Genera las ilustraciones SVG de public/img con el estilo de los bocetos de Figma.
// Uso: node scripts/generar-ilustraciones.js
const fs = require('node:fs');
const path = require('node:path');

const destino = path.join(__dirname, '..', 'public', 'img');
fs.mkdirSync(path.join(destino, 'productos'), { recursive: true });
fs.mkdirSync(path.join(destino, 'categorias'), { recursive: true });

const svg = (ancho, alto, contenido) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}">${contenido}</svg>\n`;

function botella({ cuerpo, tapa, etiqueta = '#f7f1e8', letra = '#7a2840' }) {
  return svg(80, 200, `
  <ellipse cx="40" cy="186" rx="34" ry="6" fill="#ddd2c4"/>
  <rect x="28" y="8" width="24" height="36" fill="${tapa}"/>
  <path d="M30 44h20v22c0 8 18 14 18 30v80a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V96c0-16 18-22 18-30z" fill="${cuerpo}"/>
  <rect x="16" y="102" width="48" height="56" fill="${etiqueta}"/>
  <line x1="24" y1="110" x2="56" y2="110" stroke="#c9b8a4" stroke-width="1.5"/>
  <line x1="24" y1="150" x2="56" y2="150" stroke="#c9b8a4" stroke-width="1.5"/>
  <text x="40" y="138" font-family="Georgia, serif" font-size="22" fill="${letra}" text-anchor="middle">V</text>`);
}

const archivos = {
  'productos/botella-tinto.svg': botella({ cuerpo: '#3d3f33', tapa: '#7a2840' }),
  'productos/botella-blanco.svg': botella({ cuerpo: '#8a8d5c', tapa: '#c9a35a' }),
  'productos/botella-rosado.svg': botella({ cuerpo: '#c98a93', tapa: '#7a2840' }),
  'productos/botella-espumante.svg': botella({ cuerpo: '#2f3a2c', tapa: '#c9a35a', etiqueta: '#fbf6ec' }),
  'productos/copa.svg': svg(80, 160, `
  <path d="M14 6h52l-3 48c-2 20-12 30-23 30S19 74 17 54z" fill="none" stroke="#a08466" stroke-width="3"/>
  <path d="M17.6 40h44.8l-1.2 14C59.5 70 51 78 40 78s-19.5-8-21.2-24z" fill="#9c5a6a"/>
  <line x1="40" y1="84" x2="40" y2="140" stroke="#a08466" stroke-width="3"/>
  <line x1="18" y1="142" x2="62" y2="142" stroke="#a08466" stroke-width="3" stroke-linecap="round"/>`),
  'productos/sacacorchos.svg': svg(80, 160, `
  <rect x="10" y="20" width="60" height="12" rx="6" fill="#7a2840"/>
  <rect x="34" y="30" width="12" height="40" rx="3" fill="#a08466"/>
  <path d="M40 70c-10 6 10 10 0 16s10 10 0 16 10 10 0 16 10 10 0 16" fill="none" stroke="#6d6467" stroke-width="3" stroke-linecap="round"/>`),
  'productos/decantador.svg': svg(100, 160, `
  <ellipse cx="50" cy="150" rx="40" ry="5" fill="#ddd2c4"/>
  <path d="M42 10h16v40c0 10 32 30 32 62 0 24-18 34-40 34S10 136 10 112c0-32 32-52 32-62z" fill="none" stroke="#a08466" stroke-width="3"/>
  <path d="M16 106c4-6 10-10 34-10s30 4 34 10c2 22-12 34-34 34S14 128 16 106z" fill="#9c5a6a"/>`),
  'productos/accesorio.svg': svg(80, 160, `
  <ellipse cx="40" cy="146" rx="28" ry="5" fill="#ddd2c4"/>
  <rect x="22" y="40" width="36" height="100" rx="8" fill="#3d3f33"/>
  <rect x="18" y="30" width="44" height="18" rx="4" fill="#7a2840"/>
  <rect x="30" y="14" width="20" height="18" rx="3" fill="#a08466"/>
  <rect x="26" y="80" width="28" height="30" fill="#f7f1e8"/>`),
  'logo.svg': svg(160, 40, `<text x="0" y="30" font-family="Georgia, serif" font-size="30" fill="#7a2840">vinoteca.</text>`),
  'favicon.svg': svg(32, 32, `<rect width="32" height="32" rx="6" fill="#7a2840"/><text x="16" y="23" font-family="Georgia, serif" font-size="20" fill="#fff" text-anchor="middle">v</text>`),
};
archivos['categorias/vinos.svg'] = archivos['productos/botella-tinto.svg'];
archivos['categorias/espumantes.svg'] = archivos['productos/botella-espumante.svg'];
archivos['categorias/accesorios.svg'] = archivos['productos/copa.svg'];

for (const [nombre, contenido] of Object.entries(archivos)) {
  fs.writeFileSync(path.join(destino, nombre), contenido.replace(/\n\s+/g, '\n'));
}
console.log(`${Object.keys(archivos).length} ilustraciones en public/img`);
