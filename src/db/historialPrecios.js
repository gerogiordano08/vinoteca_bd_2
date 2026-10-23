// Colección de series temporales historial_precios (clase "Gestión de datos": colecciones de
// series temporales). Cada documento es un precio de un producto en un momento:
//   { fecha: Date, productoId: ObjectId, precio: Decimal128, origen: 'venta' | 'actual' | 'cambio' }
// timeField es la fecha y metaField el producto: MongoDB agrupa internamente los puntos de un mismo
// producto en "buckets" ordenados por tiempo, los comprime y crea solo el índice { productoId, fecha }.
//
// No se usa $jsonSchema: MongoDB no admite validadores en colecciones de series temporales
// ("option not supported on a time-series collection: validator"). Los datos se controlan al
// insertarlos (registrarPrecio). Sin dependencias, para poder usarlo también desde mongosh.

const NOMBRE = 'historial_precios';

const OPCIONES = {
  timeseries: { timeField: 'fecha', metaField: 'productoId', granularity: 'hours' },
};

// Puntos iniciales a partir de los pedidos: el precio que se cobró cada día por cada producto.
const PIPELINE_DESDE_PEDIDOS = [
  { $unwind: '$items' },
  { $group: {
    _id: { productoId: '$items.productoId', dia: { $dateTrunc: { date: '$creadoEn', unit: 'day' } } },
    precio: { $max: '$items.precioUnitario' },
  } },
  { $project: { _id: 0, fecha: '$_id.dia', productoId: '$_id.productoId', precio: 1, origen: 'venta' } },
];

const esDecimal = (v) => v && v._bsontype === 'Decimal128';
const esObjectId = (v) => v && v._bsontype === 'ObjectId';

/** Documento de un punto de la serie, o un error si los tipos no son los esperados. */
function puntoDePrecio(productoId, precio, fecha = new Date(), origen = 'cambio') {
  if (!esObjectId(productoId)) throw new TypeError('productoId debe ser un ObjectId');
  if (!esDecimal(precio)) throw new TypeError('precio debe ser Decimal128');
  if (!(fecha instanceof Date) || Number.isNaN(fecha.getTime())) throw new TypeError('fecha inválida');
  return { fecha, productoId, precio, origen };
}

/**
 * Guarda un punto (driver de Node). Solo si la colección ya existe como serie temporal:
 * insertar en una que no existe la crearía como colección común.
 */
async function registrarPrecio(db, productoId, precio, fecha = new Date()) {
  const [info] = await db.listCollections({ name: NOMBRE }, { nameOnly: false }).toArray();
  if (!info || info.type !== 'timeseries') return false;
  await db.collection(NOMBRE).insertOne(puntoDePrecio(productoId, precio, fecha));
  return true;
}

module.exports = { NOMBRE, OPCIONES, PIPELINE_DESDE_PEDIDOS, puntoDePrecio, registrarPrecio };
