// =============================================================================
// 01 · Datos de ejemplo
//
// db/datos/*.json tiene los documentos de la carga de ejemplo de la aplicación
// (npm run db:seed y npm run db:paginas) en Extended JSON canónico, así se
// conservan los tipos: ObjectId, Date y Decimal128 para precios y totales.
//
//   25 productos (24 a la venta) · 3 categorías · 5 bodegas · 47 usuarios
//   180 pedidos · 6 carritos · 5 páginas de Inicio y 5 de Catálogo
//
// Los documentos pasan por el validador $jsonSchema de cada colección.
// Uso:  mongosh db/01_datos.js   (después de 00_crear_db.js)
// =============================================================================

if (typeof CONFIG === 'undefined') load(__dirname + '/config.js');
if (typeof titulo === 'undefined') load(__dirname + '/utilidades.js');

{
titulo('01 · Datos de ejemplo');
db = db.getSiblingDB(CONFIG.dbName);
const fs = require('fs');

// Primero las colecciones referenciadas, después las que guardan sus _id.
const orden = ['configuracion_tienda', 'categorias', 'bodegas', 'productos', 'usuarios', 'carritos', 'pedidos', 'inicio', 'catalogo'];
for (const nombre of orden) {
  const documentos = EJSON.parse(fs.readFileSync(desdeRaiz('db', 'datos', `${nombre}.json`), 'utf8'), { relaxed: false });
  db.getCollection(nombre).insertMany(documentos);
  print(`    ${nombre.padEnd(22)} ${String(documentos.length).padStart(4)} documentos`);
}
print('    Cuentas: ana@example.com / vinoteca123 · admin@vinoteca.test / admin2026 · demo-…@vinoteca.test / paginas2026');
}
