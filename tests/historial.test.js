const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const { baseDePrueba } = require('./ayuda');
const { NOMBRE, OPCIONES, puntoDePrecio } = require('../src/db/historialPrecios');
const { actualizarProducto } = require('../src/servicios/productos');
const { aDecimal, aNumero } = require('../src/util/dinero');

let entorno;
let db;
before(async () => { entorno = await baseDePrueba('historial'); db = entorno.db; });
after(async () => entorno.cerrar());

const puntos = (productoId) => db.collection(NOMBRE).find({ productoId }).sort({ fecha: 1 }).toArray();

test('sin la serie temporal, cambiar un precio no crea la colección', async () => {
  const malbec = await db.collection('productos').findOne({ sku: 'VIN-MAL-RES' });
  assert.equal(await actualizarProducto(db, malbec._id, { precio: 19000 }), true);
  assert.equal((await db.listCollections({ name: NOMBRE }).toArray()).length, 0);
});

test('con la serie temporal, cada cambio de precio guarda un punto', async () => {
  await db.createCollection(NOMBRE, OPCIONES);
  const [info] = await db.listCollections({ name: NOMBRE }).toArray();
  assert.equal(info.type, 'timeseries');
  assert.ok((await db.collection(NOMBRE).indexes()).some((i) => i.name === 'productoId_1_fecha_1'));

  const copa = await db.collection('productos').findOne({ sku: 'ACC-COP-CRI' });
  await actualizarProducto(db, copa._id, { precio: 8100 });
  await actualizarProducto(db, copa._id, { precio: 8100 });          // mismo precio: no suma un punto
  await actualizarProducto(db, copa._id, { stockActual: 30 });       // no cambia el precio
  await actualizarProducto(db, copa._id, { precio: 8300 });
  const guardados = await puntos(copa._id);
  assert.deepEqual(guardados.map((p) => aNumero(p.precio)), [8100, 8300]);
  assert.ok(guardados.every((p) => p.origen === 'cambio' && p.fecha instanceof Date && p.precio._bsontype === 'Decimal128'));
});

test('los puntos se controlan al insertar (la serie temporal no admite $jsonSchema)', () => {
  assert.throws(() => puntoDePrecio('no-es-id', aDecimal(1)), TypeError);
  assert.throws(() => puntoDePrecio(new ObjectId(), 100), TypeError);
  assert.throws(() => puntoDePrecio(new ObjectId(), aDecimal(1), new Date('x')), TypeError);
  assert.equal(puntoDePrecio(new ObjectId(), aDecimal(1)).origen, 'cambio');
});
