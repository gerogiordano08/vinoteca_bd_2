// Construcción de los subdocumentos que las colecciones de página (inicio y catalogo) copian de las
// colecciones principales. Cada función corresponde a una tabla de la sección "8 y 9" del modelo.
const config = require('../config');

async function copiaTienda(db) {
  const t = await db.collection('configuracion_tienda').findOne({});
  if (!t) return { nombreComercial: 'vinoteca', monedaBase: 'ARS' };
  return { configuracionId: t._id, nombreComercial: t.nombreComercial, logoUrl: t.logoUrl, monedaBase: t.monedaBase };
}

async function copiaUsuario(db, usuarioId) {
  if (!usuarioId) return null;
  const u = await db.collection('usuarios').findOne({ _id: usuarioId }, { projection: { nombre: 1, apellido: 1 } });
  return u ? { usuarioId: u._id, nombre: u.nombre, apellido: u.apellido } : null;
}

/** Resumen del carrito activo para la cabecera. Se omite carritoId si no hay carrito activo. */
async function resumenCarrito(db, usuarioId) {
  if (!usuarioId) return { cantidadArticulos: 0 };
  const carrito = await db.collection('carritos').findOne({ usuarioId, estado: 'activo' });
  if (!carrito) return { cantidadArticulos: 0 };
  const cantidadArticulos = carrito.items.reduce((total, item) => total + item.cantidad, 0);
  return { carritoId: carrito._id, cantidadArticulos };
}

/** Categorías activas para la navegación, en el orden en que se cargaron (Vinos, Espumantes, Accesorios). */
async function copiaCategorias(db) {
  const lista = await db.collection('categorias').find({ activa: true }).sort({ _id: 1 }).toArray();
  return lista.map((c) => ({ categoriaId: c._id, nombre: c.nombre, descripcion: c.descripcion, slug: c.slug }));
}

/**
 * Resumen de producto compartido por inicio.productosDestacados[] y catalogo.productos[].
 * En el catálogo agrega bodega, disponible y destacado, y detalleVino incluye el varietal.
 */
function resumenProducto(producto, categoria, { enCatalogo = false, bodega = null } = {}) {
  const resumen = {
    productoId: producto._id,
    nombre: producto.nombre,
    descripcionCorta: producto.descripcionCorta,
    precio: producto.precio,
    imagen: (producto.imagenes && producto.imagenes[0]) || '/img/productos/accesorio.svg',
    categoria: { categoriaId: categoria._id, nombre: categoria.nombre, slug: categoria.slug },
  };
  if (producto.detalleVino) {
    const { color, origenProvincia, contenidoMl, varietal } = producto.detalleVino;
    resumen.detalleVino = { color, origenProvincia, contenidoMl };
    if (enCatalogo) resumen.detalleVino.varietal = varietal;
  }
  if (producto.detalleAccesorio) {
    const { material, unidadVenta } = producto.detalleAccesorio;
    resumen.detalleAccesorio = { material, unidadVenta };
  }
  if (enCatalogo) {
    if (bodega) resumen.bodega = bodega.nombre;
    resumen.disponible = esDisponible(producto, categoria);
    resumen.destacado = Boolean(producto.destacado);
  }
  return resumen;
}

/** Regla de disponibilidad (pendiente en el modelo; definida en docs/implementacion/decisiones.md). */
function esDisponible(producto, categoria) {
  return Boolean(producto.activo && producto.stockActual > 0 && (!categoria || categoria.activa));
}

/**
 * Selección de destacados del modelo: hasta cuatro productos con destacado = true, activo = true,
 * stockActual > 0 y categoría activa, ordenados por nombre y luego por _id.
 */
async function seleccionarDestacados(db) {
  const productos = await db
    .collection('productos')
    .aggregate([
      { $match: { destacado: true, activo: true, stockActual: { $gt: 0 } } },
      { $lookup: { from: 'categorias', localField: 'categoriaId', foreignField: '_id', as: 'categoria' } },
      { $unwind: '$categoria' },
      { $match: { 'categoria.activa': true } },
      { $sort: { nombre: 1, _id: 1 } },
      { $limit: config.maximoDestacados },
    ])
    .toArray();
  return productos.map((p) => resumenProducto(p, p.categoria));
}

module.exports = { copiaTienda, copiaUsuario, resumenCarrito, copiaCategorias, resumenProducto, esDisponible, seleccionarDestacados };
