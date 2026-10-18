// Sección 10 del modelo, "Datos compartidos y sincronización": las colecciones principales son el
// origen de los datos y inicio/catalogo guardan copias. Cada función se llama después de modificar
// el dato de origen y actualiza solo las copias afectadas.
const r = require('./resumenes');
const { opcionesDeFiltro } = require('./consultaCatalogo');
const { recalcularCatalogo } = require('./paginas');

const PAGINAS = ['inicio', 'catalogo'];

/** usuarios → usuario (usuarioId, nombre y apellido) de ambas páginas. */
async function alCambiarUsuario(db, usuarioId) {
  const usuario = await r.copiaUsuario(db, usuarioId);
  if (!usuario) return;
  await Promise.all(
    PAGINAS.map((p) => db.collection(p).updateMany({ 'usuario.usuarioId': usuarioId }, { $set: { usuario } })),
  );
}

/** carritos → carrito (carritoId y suma de cantidades) de ambas páginas del usuario. */
async function alCambiarCarrito(db, usuarioId) {
  const carrito = await r.resumenCarrito(db, usuarioId);
  await Promise.all(
    PAGINAS.map((p) => db.collection(p).updateMany({ 'usuario.usuarioId': usuarioId }, { $set: { carrito } })),
  );
}

/** configuracion_tienda → tienda de ambas páginas, de todos los usuarios y visitantes. */
async function alCambiarTienda(db) {
  const tienda = await r.copiaTienda(db);
  await Promise.all(PAGINAS.map((p) => db.collection(p).updateMany({}, { $set: { tienda } })));
}

/** Recalcula la selección de destacados y reemplaza sus copias en todos los documentos de Inicio. */
async function actualizarDestacados(db) {
  const productosDestacados = await r.seleccionarDestacados(db);
  await db.collection('inicio').updateMany({}, { $set: { productosDestacados } });
}

/** Recalcula resultados, paginación y opciones de filtro de los documentos de Catálogo indicados. */
async function actualizarCatalogos(db, filtro = {}) {
  const opcionesFiltro = await opcionesDeFiltro(db);
  await db.collection('catalogo').updateMany(filtro, { $set: { opcionesFiltro } });
  const documentos = await db.collection('catalogo').find(filtro).toArray();
  for (const documento of documentos) await recalcularCatalogo(db, documento);
}

/**
 * productos → resúmenes de ambas páginas, destacados de Inicio y resultados del Catálogo.
 * Un cambio de precio, stock, estado o datos visibles puede hacer que un producto entre o salga
 * de los destacados o de los resultados de una consulta, así que se recalculan.
 */
async function alCambiarProducto(db) {
  await actualizarDestacados(db);
  await actualizarCatalogos(db);
}

/** categorias → lista de categorías de ambas páginas y categoría dentro de los resúmenes. */
async function alCambiarCategoria(db) {
  const categorias = await r.copiaCategorias(db);
  await Promise.all(PAGINAS.map((p) => db.collection(p).updateMany({}, { $set: { categorias } })));
  // Activar o desactivar una categoría cambia qué productos se muestran.
  await actualizarDestacados(db);
  await actualizarCatalogos(db);
}

/** bodegas.nombre → bodega dentro de catalogo.productos[]. */
async function alCambiarBodega(db, bodegaId) {
  const bodega = await db.collection('bodegas').findOne({ _id: bodegaId });
  if (!bodega) return;
  const productos = await db.collection('productos').find({ bodegaId }, { projection: { _id: 1 } }).toArray();
  const ids = productos.map((p) => p._id);
  if (!ids.length) return;
  await db.collection('catalogo').updateMany(
    { 'productos.productoId': { $in: ids } },
    { $set: { 'productos.$[p].bodega': bodega.nombre } },
    { arrayFilters: [{ 'p.productoId': { $in: ids } }] },
  );
}

module.exports = { alCambiarUsuario, alCambiarCarrito, alCambiarTienda, alCambiarProducto, alCambiarCategoria, alCambiarBodega, actualizarDestacados, actualizarCatalogos };
