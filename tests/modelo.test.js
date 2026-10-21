const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { ObjectId } = require('mongodb');
const { baseDePrueba } = require('./ayuda');
const { aDecimal } = require('../src/util/dinero');
const { obtenerInicio, obtenerCatalogo } = require('../src/servicios/paginas');
const { prepararBase } = require('../src/db/preparar');

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

test('Inicio y Catálogo exigen usuario con ObjectId y rechazan visitanteId', async () => {
  for (const [nombre, obtener] of [['inicio', obtenerInicio], ['catalogo', obtenerCatalogo]]) {
    const vista = await obtener(db);
    const { productos, opcionesFiltro, ...base } = nombre === 'catalogo' ? { ...vista, paginacion: { paginaActual: 1, productosPorPagina: 12 } } : vista;
    for (const variante of [{}, { usuario: null }, { usuario: {} }, { usuario: { usuarioId: 'abc' } },
      { usuario: { usuarioId: new ObjectId() }, visitanteId: 'abc' }]) {
      await assert.rejects(db.collection(nombre).insertOne({ ...base, ...variante }), (error) => error.code === 121);
    }
  }
});

test('db:init elimina páginas antiguas sin usuario, conserva las registradas y retira índices de visitantes', async () => {
  const usuario = await db.collection('usuarios').findOne({ email: 'ana@example.com' });
  const validas = [];
  for (const [nombre, obtener] of [['inicio', obtenerInicio], ['catalogo', obtenerCatalogo]]) {
    await obtener(db, { usuarioId: usuario._id });
    const valida = await db.collection(nombre).findOne({ 'usuario.usuarioId': usuario._id });
    validas.push(valida);
    const { _id, ...base } = valida;
    await db.collection(nombre).insertMany([
      { ...base, usuario: null, visitanteId: 'antiguo' },
      { ...base, usuario: { usuarioId: new ObjectId() } },
      { ...base, usuario: {} },
    ], { bypassDocumentValidation: true });
    await db.collection(nombre).createIndex({ visitanteId: 1 }, {
      name: `${nombre}_por_visitante`, unique: true,
      partialFilterExpression: { visitanteId: { $exists: true } },
    });
  }
  // Simula un documento anterior con resultados y el índice que los acompañaba.
  await db.collection('catalogo').updateOne({ _id: validas[1]._id }, { $set: {
    productos: [], opcionesFiltro: { colores: [], varietales: [] },
    'paginacion.totalProductos': 24, 'paginacion.totalPaginas': 2,
  } }, { bypassDocumentValidation: true });
  await db.collection('catalogo').createIndex({ 'productos.productoId': 1 }, { name: 'catalogo_por_producto' });
  const productosAntes = await db.collection('productos').countDocuments();
  await prepararBase(db);
  await prepararBase(db);
  for (const [i, nombre] of ['inicio', 'catalogo'].entries()) {
    assert.deepEqual(await db.collection(nombre).find().toArray(), [validas[i]]);
    assert.ok(!(await db.collection(nombre).indexes()).some((indice) => indice.name === `${nombre}_por_visitante`));
  }
  assert.ok(!(await db.collection('catalogo').indexes()).some((i) => i.name === 'catalogo_por_producto'));
  assert.equal(await db.collection('productos').countDocuments(), productosAntes);
});

test('el validador de Catálogo impide persistir resultados y totales', async () => {
  const base = await db.collection('catalogo').findOne({});
  for (const cambios of [
    { productos: [] }, { opcionesFiltro: { colores: [] } },
    { 'paginacion.totalProductos': 24 }, { 'paginacion.totalPaginas': 2 },
  ]) {
    await assert.rejects(db.collection('catalogo').updateOne({ _id: base._id }, { $set: cambios }), (error) => error.code === 121);
  }
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
