const { aDecimal } = require('../util/dinero');
const { alCambiarProducto } = require('./sincronizacion');
const { registrarPrecio } = require('../db/historialPrecios');

/**
 * Detalle de un producto activo, con su categoría y bodega ($lookup). Se busca por el productoId
 * que guardan los resúmenes de inicio y catalogo.
 */
async function obtenerDetalle(db, productoId) {
  if (!productoId) return null;
  const [producto] = await db
    .collection('productos')
    .aggregate([
      { $match: { _id: productoId, activo: true } },
      { $lookup: { from: 'categorias', localField: 'categoriaId', foreignField: '_id', as: 'categoria' } },
      { $unwind: '$categoria' },
      { $match: { 'categoria.activa': true } },
      { $lookup: { from: 'bodegas', localField: 'bodegaId', foreignField: '_id', as: 'bodega' } },
      { $set: { bodega: { $first: '$bodega' } } },
    ])
    .toArray();
  return producto || null;
}

/**
 * Convierte el texto detalleAccesorio.detalles ("Capacidad: 450 ml; Cuidado: Lavado a mano")
 * en filas de la tabla Características del boceto.
 */
function filasDeDetalles(detalles) {
  if (!detalles) return [];
  return detalles
    .split(';')
    .map((parte) => parte.split(':'))
    .filter((par) => par.length >= 2)
    .map(([clave, ...valor]) => ({ clave: clave.trim(), valor: valor.join(':').trim() }));
}

const CAMPOS_EDITABLES = ['nombre', 'descripcion', 'descripcionCorta', 'precio', 'stockActual', 'destacado', 'activo'];

/**
 * Modifica un producto y sincroniza las copias de inicio y catalogo.
 * Si cambia el precio, guarda un punto en la serie temporal historial_precios (si existe).
 * Es la operación que usaría la pantalla de administración (pendiente de diseño en Figma).
 */
async function actualizarProducto(db, productoId, cambios) {
  const set = {};
  for (const campo of CAMPOS_EDITABLES) {
    if (cambios[campo] === undefined) continue;
    set[campo] = campo === 'precio' ? aDecimal(cambios[campo]) : cambios[campo];
  }
  if (!Object.keys(set).length) return false;
  const anterior = set.precio ? await db.collection('productos').findOne({ _id: productoId }, { projection: { precio: 1 } }) : null;
  const { matchedCount } = await db.collection('productos').updateOne({ _id: productoId }, { $set: set });
  if (matchedCount) await alCambiarProducto(db);
  if (matchedCount && anterior && String(anterior.precio) !== String(set.precio)) {
    await registrarPrecio(db, productoId, set.precio);
  }
  return matchedCount === 1;
}

module.exports = { obtenerDetalle, filasDeDetalles, actualizarProducto };
