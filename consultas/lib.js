// =============================================================================
// Auxiliares de los scripts de consultas por pantalla (consultas/1_inicio.js …)
// =============================================================================

if (typeof CONFIG === 'undefined') load(__dirname + '/../db/config.js');

db = db.getSiblingDB(CONFIG.dbName);
globalThis.HOY = CONFIG.hoy;
globalThis.haceDias = (n) => new Date(HOY.getTime() - n * 24 * 3600 * 1000);

// Documentos de ejemplo que usan las consultas, buscados por sus claves naturales.
const porEmail = (email) => db.usuarios.findOne({ email }, { _id: 1 })._id;
const porSku = (sku) => db.productos.findOne({ sku }, { _id: 1 })._id;
globalThis.IDS = {
  ana: porEmail('ana@example.com'),                 // cliente con 2 productos en el carrito
  cliente01: porEmail('cliente01@ejemplo.test'),    // cliente con pedidos históricos
  demoTintos: porEmail('demo-tintos@vinoteca.test'),// cuenta con Inicio y Catálogo personalizados
  malbec: porSku('VIN-MAL-RES'),                    // Malbec Reserva (vino destacado)
  copa: porSku('ACC-COP-CRI'),                      // Copa de cristal (accesorio)
  vinos: db.categorias.findOne({ slug: 'vinos' })._id,
};
globalThis.categoriasActivas = () => db.categorias.find({ activa: true }, { _id: 1 }).toArray().map((c) => c._id);

// --- Salida ------------------------------------------------------------------
globalThis.seccion = (texto) => print(`\n${'═'.repeat(78)}\n  ${texto}\n${'═'.repeat(78)}`);

// Formato compacto: ObjectId abreviado, Decimal128 como número, fechas legibles.
const corto = function (v) {
  if (v === null || v === undefined) return String(v);
  if (v._bsontype === 'ObjectId') return `…${v.toHexString().slice(-6)}`;
  if (v._bsontype === 'Decimal128') return v.toString();
  if (v instanceof Date) return v.toISOString().slice(0, 16).replace('T', ' ');
  if (Array.isArray(v)) return `[${v.map(corto).join(', ')}]`;
  if (typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${k}: ${corto(x)}`).join(', ')} }`;
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'number' && !Number.isInteger(v)) return String(Math.round(v * 100) / 100);
  return String(v);
};
globalThis.linea = (doc, max = 170) => {
  const s = corto(doc);
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
};

// Ejecuta una consulta, mide el tiempo y muestra el resultado.
//   mostrar("Título", () => db.coleccion.find(...), { limite: 5 })
// El tiempo es orientativo; la medición formal está en rendimiento/medir.js (explain).
globalThis.mostrar = function (titulo, consulta, { limite = 5, ancho = 170 } = {}) {
  const t0 = Date.now();
  let r = consulta();
  if (r && typeof r.toArray === 'function') r = r.toArray();
  const ms = Date.now() - t0;
  if (Array.isArray(r)) {
    print(`\n▸ ${titulo}   (${r.length} ${r.length === 1 ? 'resultado' : 'resultados'}, ${ms} ms)`);
    r.slice(0, limite).forEach((d) => print(`    ${linea(d, ancho)}`));
    if (r.length > limite) print(`    … y ${miles(r.length - limite)} más`);
  } else {
    print(`\n▸ ${titulo}   (${ms} ms)`);
    print(`    ${r === null ? 'sin resultados' : linea(r, ancho * 3)}`);
  }
  return r;
};
globalThis.miles = globalThis.miles || ((n) => n.toLocaleString('es-AR'));
