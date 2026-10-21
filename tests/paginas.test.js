const { ObjectId } = require('mongodb');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { baseDePrueba } = require('./ayuda');
const { obtenerInicio, obtenerCatalogo } = require('../src/servicios/paginas');
const { actualizarProducto } = require('../src/servicios/productos');
const usuarios = require('../src/servicios/usuarios');
const carritos = require('../src/servicios/carritos');
const { alCambiarCategoria } = require('../src/servicios/sincronizacion');
const { aNumero } = require('../src/util/dinero');

let entorno;
let db;
let ana;
let registrado;
before(async () => {
  entorno = await baseDePrueba('paginas');
  db = entorno.db;
  ana = await db.collection('usuarios').findOne({ email: 'ana@example.com' });
  registrado = { usuarioId: ana._id };
});
after(async () => entorno.cerrar());

const visitante = {};

test('Inicio público: no guarda un documento ni crea un usuario invitado', async () => {
  const cantidadUsuarios = await db.collection('usuarios').countDocuments();
  const pagina = await obtenerInicio(db, visitante);
  assert.equal(pagina.usuario, undefined);
  assert.equal(pagina.visitanteId, undefined);
  assert.deepEqual(pagina.carrito, { cantidadArticulos: 0 });
  assert.equal(await db.collection('inicio').countDocuments(), 0);
  assert.equal(await db.collection('usuarios').countDocuments(), cantidadUsuarios);
});

test('Catálogo público: filtra y pagina desde la URL sin persistir consultas', async () => {
  const segunda = await obtenerCatalogo(db, visitante, { orden: 'nombre_asc', pagina: '2' });
  assert.equal(segunda.paginacion.paginaActual, 2);
  assert.equal(segunda.consulta.orden, 'nombre_asc');
  const filtrada = await obtenerCatalogo(db, visitante, { color: 'Tinto', varietal: 'Malbec', precioMax: '15000' });
  assert.deepEqual(filtrada.productos.map((p) => p.nombre), ['Malbec Clásico']);
  const inicial = await obtenerCatalogo(db, visitante);
  assert.equal(inicial.paginacion.paginaActual, 1);
  assert.equal(inicial.consulta.orden, 'destacados');
  assert.equal(inicial.usuario, undefined);
  assert.equal(await db.collection('catalogo').countDocuments(), 0);
});

test('rechaza usuarios inexistentes antes de guardar o devolver una página', async () => {
  const inexistente = { usuarioId: new ObjectId() };
  await assert.rejects(obtenerInicio(db, inexistente), /usuario existente/);
  await assert.rejects(obtenerCatalogo(db, inexistente), /usuario existente/);
  assert.equal(await db.collection('inicio').countDocuments(), 0);
  assert.equal(await db.collection('catalogo').countDocuments(), 0);
});

test('Inicio de usuario registrado: copia de usuario y del carrito, sin visitanteId', async () => {
  const pagina = await obtenerInicio(db, { usuarioId: ana._id });
  assert.equal(pagina.usuario.nombre, 'Ana');
  assert.equal(pagina.visitanteId, undefined);
  assert.equal(pagina.carrito.cantidadArticulos, 2);
  assert.ok(pagina.carrito.carritoId);
});

test('destacados: hasta 4, activos, con stock y ordenados por nombre', async () => {
  const { productosDestacados } = await obtenerInicio(db, registrado);
  assert.deepEqual(productosDestacados.map((p) => p.nombre), ['Brut Nature', 'Chardonnay Joven', 'Copa de cristal', 'Malbec Reserva']);
});

test('Catálogo inicial: orden destacados y 24 productos en 2 páginas de 12', async () => {
  const pagina = await obtenerCatalogo(db, registrado, {});
  assert.equal(pagina.consulta.orden, 'destacados');
  assert.equal(pagina.paginacion.totalProductos, 24);
  assert.equal(pagina.paginacion.totalPaginas, 2);
  assert.equal(pagina.productos.length, 12);
  assert.ok(pagina.productos.slice(0, 4).every((p) => p.destacado));
});

test('Catálogo: filtros de color, varietal y precio', async () => {
  const pagina = await obtenerCatalogo(db, registrado, { color: 'Tinto', varietal: 'Malbec', precioMax: '15000' });
  assert.deepEqual(pagina.productos.map((p) => p.nombre), ['Malbec Clásico']);
  assert.ok(pagina.productos.every((p) => p.detalleVino.varietal === 'Malbec'));
});

test('Catálogo: orden por precio con desempate por nombre', async () => {
  const pagina = await obtenerCatalogo(db, registrado, { categoria: 'accesorios', orden: 'precio_asc' });
  const precios = pagina.productos.map((p) => aNumero(p.precio));
  assert.deepEqual(precios, [...precios].sort((a, b) => a - b));
});

test('Catálogo: búsqueda de texto y búsqueda por bodega', async () => {
  const porTexto = await obtenerCatalogo(db, registrado, { texto: 'copas' });
  assert.ok(porTexto.productos.some((p) => p.nombre === 'Set de 6 copas'));
  const porBodega = await obtenerCatalogo(db, registrado, { texto: 'Cerro Azul' });
  assert.ok(porBodega.productos.length > 0);
  assert.ok(porBodega.productos.every((p) => p.bodega === 'Bodega Cerro Azul'));
});

test('Catálogo conserva la última consulta y cambiar de página no la reemplaza', async () => {
  await obtenerCatalogo(db, registrado, { orden: 'nombre_asc' });
  const pagina2 = await obtenerCatalogo(db, registrado, { pagina: '2' });
  assert.equal(pagina2.consulta.orden, 'nombre_asc');
  assert.equal(pagina2.paginacion.paginaActual, 2);
  const sinParametros = await obtenerCatalogo(db, registrado, {});
  assert.equal(sinParametros.paginacion.paginaActual, 2);
  assert.equal(sinParametros.consulta.orden, 'nombre_asc');
});

test('Catálogo persiste consulta y configuración, sin productos, totales ni opciones derivadas', async () => {
  const vista = await obtenerCatalogo(db, registrado, { orden: 'nombre_asc' });
  const guardado = await db.collection('catalogo').findOne({ 'usuario.usuarioId': ana._id });
  assert.equal(guardado.productos, undefined);
  assert.equal(guardado.opcionesFiltro, undefined);
  assert.deepEqual(guardado.paginacion, { paginaActual: 1, productosPorPagina: 12 });
  assert.equal(vista.productos.length, 12);
  assert.equal(vista.paginacion.totalProductos, 24);
  const sinParametros = await obtenerCatalogo(db, registrado);
  assert.deepEqual(sinParametros.productos, vista.productos);
  assert.deepEqual(await db.collection('catalogo').findOne({ _id: guardado._id }), guardado);
});

test('sincronización: cambiar el nombre del usuario actualiza sus páginas', async () => {
  await obtenerCatalogo(db, { usuarioId: ana._id }, {});
  await usuarios.actualizarDatos(db, ana._id, { nombre: 'Ana María', apellido: 'Pérez', email: 'ana@example.com', telefono: '' });
  const inicio = await db.collection('inicio').findOne({ 'usuario.usuarioId': ana._id });
  const catalogo = await db.collection('catalogo').findOne({ 'usuario.usuarioId': ana._id });
  assert.equal(inicio.usuario.nombre, 'Ana María');
  assert.equal(catalogo.usuario.nombre, 'Ana María');
});

test('sincronización: agregar al carrito actualiza el resumen de ambas páginas', async () => {
  const copa = await db.collection('productos').findOne({ sku: 'ACC-COP-CRI' });
  await carritos.agregar(db, ana._id, copa._id, 2);
  const inicio = await db.collection('inicio').findOne({ 'usuario.usuarioId': ana._id });
  const catalogo = await db.collection('catalogo').findOne({ 'usuario.usuarioId': ana._id });
  assert.equal(inicio.carrito.cantidadArticulos, 4);
  assert.equal(catalogo.carrito.cantidadArticulos, 4);
});

test('sincronización: un producto sin stock sale de los destacados de todas las páginas', async () => {
  const brut = await db.collection('productos').findOne({ sku: 'ESP-BRU-NAT' });
  await actualizarProducto(db, brut._id, { stockActual: 0 });
  for (const doc of await db.collection('inicio').find().toArray()) {
    assert.ok(!doc.productosDestacados.some((p) => String(p.productoId) === String(brut._id)));
  }
  await actualizarProducto(db, brut._id, { stockActual: 10 });
});

test('Catálogo consulta precios actuales sin sincronizar resultados guardados', async () => {
  await obtenerCatalogo(db, registrado, { precioMax: '10000', orden: 'precio_asc' });
  const bonarda = await db.collection('productos').findOne({ sku: 'VIN-BON' });
  let doc = await obtenerCatalogo(db, registrado);
  assert.ok(doc.productos.some((p) => p.nombre === 'Bonarda'));
  const antes = await db.collection('catalogo').findOne({ 'usuario.usuarioId': ana._id });
  await actualizarProducto(db, bonarda._id, { precio: 12500 });
  assert.deepEqual(await db.collection('catalogo').findOne({ _id: antes._id }), antes);
  doc = await obtenerCatalogo(db, registrado);
  assert.ok(!doc.productos.some((p) => p.nombre === 'Bonarda'));
});

test('sincronización: desactivar una categoría la saca de la navegación y de los resultados', async () => {
  await obtenerCatalogo(db, registrado, { orden: 'destacados' });
  await db.collection('categorias').updateOne({ slug: 'accesorios' }, { $set: { activa: false } });
  await alCambiarCategoria(db);
  const doc = await obtenerCatalogo(db, registrado);
  assert.ok(!doc.categorias.some((c) => c.slug === 'accesorios'));
  assert.ok(!doc.productos.some((p) => p.categoria.slug === 'accesorios'));
  assert.equal(doc.paginacion.totalProductos, 17);
  await db.collection('categorias').updateOne({ slug: 'accesorios' }, { $set: { activa: true } });
  await alCambiarCategoria(db);
});

test('Catálogo consulta la bodega actual sin sincronizar copias', async () => {
  await obtenerCatalogo(db, registrado, { texto: 'Viento Sur' });
  const bodega = await db.collection('bodegas').findOne({ nombre: 'Bodega Viento Sur' });
  await db.collection('bodegas').updateOne({ _id: bodega._id }, { $set: { nombre: 'Bodega Viento Sur Patagonia' } });
  const doc = await obtenerCatalogo(db, registrado);
  assert.ok(doc.productos.length > 0);
  assert.ok(doc.productos.every((p) => p.bodega === 'Bodega Viento Sur Patagonia'));
});
