const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const { baseDePrueba } = require('./ayuda');
const { aDecimal } = require('../src/util/dinero');

let entorno;
let db;
before(async () => { entorno = await baseDePrueba('modelo'); db = entorno.db; });
after(async () => entorno.cerrar());

test('crea las nueve colecciones del modelo con validador', async () => {
  const colecciones = await db.listCollections().toArray();
  const nombres = colecciones.map((c) => c.name).sort();
  assert.deepEqual(nombres, ['bodegas', 'carritos', 'catalogo', 'categorias', 'configuracion_tienda', 'inicio', 'pedidos', 'productos', 'usuarios']);
  for (const c of colecciones) assert.ok(c.options.validator.$jsonSchema, `${c.name} sin $jsonSchema`);
});

test('el validador rechaza un producto con precio que no es Decimal128', async () => {
  const categoria = await db.collection('categorias').findOne({});
  await assert.rejects(
    db.collection('productos').insertOne({ sku: 'X-1', nombre: 'X', precio: 100, categoriaId: categoria._id, tipoProducto: 'vino', stockActual: 1, activo: true }),
    (error) => error.code === 121,
  );
});

test('el validador rechaza un tipo de producto fuera de vino, espumante o accesorio', async () => {
  const categoria = await db.collection('categorias').findOne({});
  await assert.rejects(
    db.collection('productos').insertOne({ sku: 'X-2', nombre: 'X', precio: aDecimal(100), categoriaId: categoria._id, tipoProducto: 'cerveza', stockActual: 1, activo: true }),
    (error) => error.code === 121,
  );
});

test('un documento de página no puede tener visitanteId y usuario a la vez', async () => {
  const base = { tienda: {}, carrito: { cantidadArticulos: 0 }, categorias: [], presentacion: {}, productosDestacados: [] };
  await assert.rejects(
    db.collection('inicio').insertOne({ ...base, visitanteId: 'abc', usuario: { usuarioId: new ObjectId(), nombre: 'A', apellido: 'B' } }),
    (error) => error.code === 121,
  );
  await db.collection('inicio').insertOne({ ...base, visitanteId: 'abc', usuario: null });
  await db.collection('inicio').deleteMany({ visitanteId: 'abc' });
});

test('el sku y el email son únicos', async () => {
  const producto = await db.collection('productos').findOne({});
  const { _id, ...copia } = producto;
  await assert.rejects(db.collection('productos').insertOne(copia), (error) => error.code === 11000);
  const usuario = await db.collection('usuarios').findOne({});
  const { _id: idUsuario, ...copiaUsuario } = usuario;
  await assert.rejects(db.collection('usuarios').insertOne(copiaUsuario), (error) => error.code === 11000);
});

test('solo puede haber un carrito activo por usuario', async () => {
  const carrito = await db.collection('carritos').findOne({ estado: 'activo' });
  await assert.rejects(
    db.collection('carritos').insertOne({ usuarioId: carrito.usuarioId, estado: 'activo', items: [], actualizadoEn: new Date() }),
    (error) => error.code === 11000,
  );
  // En cambio, puede tener varios convertidos o abandonados.
  await db.collection('carritos').insertOne({ usuarioId: carrito.usuarioId, estado: 'abandonado', items: [], actualizadoEn: new Date() });
});

test('se cargan 24 productos activos, como el catálogo del boceto', async () => {
  assert.equal(await db.collection('productos').countDocuments({ activo: true }), 24);
});
