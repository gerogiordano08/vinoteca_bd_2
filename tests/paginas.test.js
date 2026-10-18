const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { baseDePrueba } = require('./ayuda');
const { obtenerInicio, obtenerCatalogo } = require('../src/servicios/paginas');
const { actualizarProducto } = require('../src/servicios/productos');
const usuarios = require('../src/servicios/usuarios');
const carritos = require('../src/servicios/carritos');
const { alCambiarCategoria, alCambiarBodega } = require('../src/servicios/sincronizacion');
const { aNumero } = require('../src/util/dinero');

let entorno;
let db;
let ana;
before(async () => {
  entorno = await baseDePrueba('paginas');
  db = entorno.db;
  ana = await db.collection('usuarios').findOne({ email: 'ana@example.com' });
});
after(async () => entorno.cerrar());

const visitante = { visitanteId: 'visitante-de-prueba' };

test('Inicio de visitante: usuario null, visitanteId y carrito en cero', async () => {
  const pagina = await obtenerInicio(db, visitante);
  assert.equal(pagina.usuario, null);
  assert.equal(pagina.visitanteId, 'visitante-de-prueba');
  assert.deepEqual(pagina.carrito, { cantidadArticulos: 0 });
  assert.equal(await db.collection('inicio').countDocuments(), 1);
});

test('Inicio de usuario registrado: copia de usuario y del carrito, sin visitanteId', async () => {
  const pagina = await obtenerInicio(db, { usuarioId: ana._id });
  assert.equal(pagina.usuario.nombre, 'Ana');
  assert.equal(pagina.visitanteId, undefined);
  assert.equal(pagina.carrito.cantidadArticulos, 2);
  assert.ok(pagina.carrito.carritoId);
});

test('destacados: hasta 4, activos, con stock y ordenados por nombre', async () => {
  const { productosDestacados } = await obtenerInicio(db, visitante);
  assert.deepEqual(productosDestacados.map((p) => p.nombre), ['Brut Nature', 'Chardonnay Joven', 'Copa de cristal', 'Malbec Reserva']);
});

test('Catálogo inicial: orden destacados y 24 productos en 2 páginas de 12', async () => {
  const pagina = await obtenerCatalogo(db, visitante, {});
  assert.equal(pagina.consulta.orden, 'destacados');
  assert.equal(pagina.paginacion.totalProductos, 24);
  assert.equal(pagina.paginacion.totalPaginas, 2);
  assert.equal(pagina.productos.length, 12);
  assert.ok(pagina.productos.slice(0, 4).every((p) => p.destacado));
});

test('Catálogo: filtros de color, varietal y precio', async () => {
  const pagina = await obtenerCatalogo(db, visitante, { color: 'Tinto', varietal: 'Malbec', precioMax: '15000' });
  assert.deepEqual(pagina.productos.map((p) => p.nombre), ['Malbec Clásico']);
  assert.ok(pagina.productos.every((p) => p.detalleVino.varietal === 'Malbec'));
});

test('Catálogo: orden por precio con desempate por nombre', async () => {
  const pagina = await obtenerCatalogo(db, visitante, { categoria: 'accesorios', orden: 'precio_asc' });
  const precios = pagina.productos.map((p) => aNumero(p.precio));
  assert.deepEqual(precios, [...precios].sort((a, b) => a - b));
});

test('Catálogo: búsqueda de texto y búsqueda por bodega', async () => {
  const porTexto = await obtenerCatalogo(db, visitante, { texto: 'copas' });
  assert.ok(porTexto.productos.some((p) => p.nombre === 'Set de 6 copas'));
  const porBodega = await obtenerCatalogo(db, visitante, { texto: 'Cerro Azul' });
  assert.ok(porBodega.productos.length > 0);
  assert.ok(porBodega.productos.every((p) => p.bodega === 'Bodega Cerro Azul'));
});

test('Catálogo conserva la última consulta y cambiar de página no la reemplaza', async () => {
  await obtenerCatalogo(db, visitante, { orden: 'nombre_asc' });
  const pagina2 = await obtenerCatalogo(db, visitante, { pagina: '2' });
  assert.equal(pagina2.consulta.orden, 'nombre_asc');
  assert.equal(pagina2.paginacion.paginaActual, 2);
  const sinParametros = await obtenerCatalogo(db, visitante, {});
  assert.equal(sinParametros.paginacion.paginaActual, 2);
  assert.equal(sinParametros.consulta.orden, 'nombre_asc');
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

test('sincronización: un precio nuevo saca al producto del rango de precios consultado', async () => {
  await obtenerCatalogo(db, visitante, { precioMax: '10000', orden: 'precio_asc' });
  const bonarda = await db.collection('productos').findOne({ sku: 'VIN-BON' });
  let doc = await db.collection('catalogo').findOne(visitante);
  assert.ok(doc.productos.some((p) => p.nombre === 'Bonarda'));
  await actualizarProducto(db, bonarda._id, { precio: 12500 });
  doc = await db.collection('catalogo').findOne(visitante);
  assert.ok(!doc.productos.some((p) => p.nombre === 'Bonarda'));
});

test('sincronización: desactivar una categoría la saca de la navegación y de los resultados', async () => {
  await obtenerCatalogo(db, visitante, { orden: 'destacados' });
  await db.collection('categorias').updateOne({ slug: 'accesorios' }, { $set: { activa: false } });
  await alCambiarCategoria(db);
  const doc = await db.collection('catalogo').findOne(visitante);
  assert.ok(!doc.categorias.some((c) => c.slug === 'accesorios'));
  assert.ok(!doc.productos.some((p) => p.categoria.slug === 'accesorios'));
  assert.equal(doc.paginacion.totalProductos, 17);
  await db.collection('categorias').updateOne({ slug: 'accesorios' }, { $set: { activa: true } });
  await alCambiarCategoria(db);
});

test('sincronización: renombrar una bodega actualiza los resultados del catálogo', async () => {
  await obtenerCatalogo(db, visitante, { texto: 'Viento Sur' });
  const bodega = await db.collection('bodegas').findOne({ nombre: 'Bodega Viento Sur' });
  await db.collection('bodegas').updateOne({ _id: bodega._id }, { $set: { nombre: 'Bodega Viento Sur Patagonia' } });
  await alCambiarBodega(db, bodega._id);
  const doc = await db.collection('catalogo').findOne(visitante);
  assert.ok(doc.productos.length > 0);
  assert.ok(doc.productos.every((p) => p.bodega === 'Bodega Viento Sur Patagonia'));
});
