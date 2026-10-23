// Sección 10 del modelo, "Datos compartidos y sincronización": las colecciones principales son el
// origen de los datos y inicio/catalogo guardan copias. Cada función se llama después de modificar
// el dato de origen y actualiza solo las copias afectadas.
const r = require('./resumenes');
const { olvidarOpcionesDeFiltro } = require('./consultaCatalogo');

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

/** Actualiza destacados generales y selecciones propias sin mezclar los productos de las páginas. */
async function actualizarDestacados(db) {
  const productosDestacados = await r.seleccionarDestacados(db);
  await db.collection('inicio').updateMany({ seleccionProductoIds: { $exists: false } }, { $set: { productosDestacados } });
  const paginas = db.collection('inicio').find({ seleccionProductoIds: { $exists: true } }, { projection: { seleccionProductoIds: 1 } });
  for await (const pagina of paginas) {
    const seleccion = await r.seleccionarDestacados(db, pagina.seleccionProductoIds);
    await db.collection('inicio').updateOne({ _id: pagina._id }, { $set: { productosDestacados: seleccion } });
  }
}

/** Los productos solo tienen copias persistidas en Inicio; Catálogo los consulta directamente. */
async function alCambiarProducto(db) {
  olvidarOpcionesDeFiltro(db);
  await actualizarDestacados(db);
}

/** categorias → lista de categorías de ambas páginas y categoría dentro de los resúmenes. */
async function alCambiarCategoria(db) {
  const categorias = await r.copiaCategorias(db);
  await Promise.all(PAGINAS.map((p) => db.collection(p).updateMany({}, { $set: { categorias } })));
  // Activar o desactivar una categoría cambia qué productos se muestran.
  olvidarOpcionesDeFiltro(db);
  await actualizarDestacados(db);
}

// Las bodegas se consultan directamente al construir los resultados del Catálogo.
module.exports = { alCambiarUsuario, alCambiarCarrito, alCambiarTienda, alCambiarProducto, alCambiarCategoria, actualizarDestacados };
