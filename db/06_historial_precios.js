// =============================================================================
// 06 · Serie temporal historial_precios
//
// Colección de series temporales (MongoDB 5.0 o posterior) con un punto por precio:
//   { fecha, productoId, precio, origen }
//   timeField: fecha · metaField: productoId · granularity: hours
//
// Se carga con el precio que se cobró cada día por cada producto (sale de los
// ítems de los pedidos) más el precio actual de los productos de ejemplo. Desde
// entonces, la aplicación agrega un punto cada vez que cambia un precio.
//
// MongoDB no admite validadores $jsonSchema en las series temporales: los tipos
// se controlan al insertar (src/db/historialPrecios.js, puntoDePrecio).
//
// Uso:  mongosh db/06_historial_precios.js   (se puede repetir: recrea la colección)
// =============================================================================

if (typeof CONFIG === 'undefined') load(__dirname + '/config.js');
if (typeof titulo === 'undefined') load(__dirname + '/utilidades.js');

{
titulo('06 · Serie temporal historial_precios');
db = db.getSiblingDB(CONFIG.dbName);
const { NOMBRE, OPCIONES, PIPELINE_DESDE_PEDIDOS, puntoDePrecio } = require(desdeRaiz('src', 'db', 'historialPrecios.js'));
const tiempo = cronometro();

if (db.getCollectionInfos({ name: NOMBRE }).length) db.getCollection(NOMBRE).drop();
db.createCollection(NOMBRE, OPCIONES);
const historial = db.getCollection(NOMBRE);

// Precios cobrados: un punto por producto y por día con ventas.
const ventas = db.pedidos.aggregate(PIPELINE_DESDE_PEDIDOS, { allowDiskUse: true }).toArray();
for (let i = 0; i < ventas.length; i += CONFIG.lote) historial.insertMany(ventas.slice(i, i + CONFIG.lote), { ordered: false });

// Precio actual de los productos de ejemplo (los de la carga masiva no tienen historia).
const actuales = db.productos.find({ sku: { $not: /^VOL-/ } }, { precio: 1 }).toArray()
  .map((p) => puntoDePrecio(p._id, p.precio, CONFIG.hoy, 'actual'));
historial.insertMany(actuales);

const info = db.getCollectionInfos({ name: NOMBRE })[0];
print(`    ${NOMBRE} creada como "${info.type}" ${JSON.stringify(info.options.timeseries)}`);
print(`    ${miles(ventas.length)} precios de ventas + ${actuales.length} precios actuales = ${miles(historial.countDocuments())} puntos (${tiempo()})`);
print(`    índice creado por MongoDB: ${historial.getIndexes().map((i) => `${i.name} ${JSON.stringify(i.key)}`).join(', ')}`);

// Consulta típica de una serie temporal: un producto en un rango de fechas.
const malbec = db.productos.findOne({ sku: 'VIN-MAL-RES' }, { _id: 1 })._id;
const rango = { productoId: malbec, fecha: { $gte: ISODate('2026-07-01'), $lt: ISODate('2026-10-01') } };
const plan = JSON.stringify(historial.find(rango).explain('executionStats'));
const indice = (plan.match(/"indexName":"([^"]+)"/) || [])[1] || 'ninguno';
const examinados = (plan.match(/"totalDocsExamined":(\d+)/) || [])[1];
print(`    Malbec Reserva de julio a septiembre: ${historial.countDocuments(rango)} puntos; usa ${indice} y examina ${examinados} buckets`);
}
