const { aNumero, multiplicar, sumar } = require('../util/dinero');
const { alCambiarCarrito } = require('./sincronizacion');
const { ErrorDeValidacion } = require('./usuarios');

const MAXIMO_POR_PRODUCTO = 24;

/**
 * Carrito activo con los datos actuales de cada producto ($lookup a productos).
 * El modelo indica que los precios se obtienen de productos al consultar el carrito.
 */
async function obtenerDetallado(db, usuarioId) {
  const [carrito] = await db
    .collection('carritos')
    .aggregate([
      { $match: { usuarioId, estado: 'activo' } },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
      { $lookup: { from: 'productos', localField: 'items.productoId', foreignField: '_id', as: 'producto' } },
      { $unwind: '$producto' },
      { $sort: { 'items.agregadoEn': 1 } },
      { $group: { _id: '$_id', items: { $push: { cantidad: '$items.cantidad', agregadoEn: '$items.agregadoEn', producto: '$producto' } } } },
    ])
    .toArray();
  if (!carrito) return { _id: null, items: [], cantidadArticulos: 0, subtotal: 0, problemas: [] };

  const problemas = [];
  const items = carrito.items.map((item) => {
    const p = item.producto;
    const subtotal = multiplicar(p.precio, item.cantidad);
    let aviso = null;
    if (!p.activo) aviso = 'Este producto ya no está a la venta.';
    else if (p.stockActual === 0) aviso = 'Sin stock por el momento.';
    else if (item.cantidad > p.stockActual) aviso = `Solo quedan ${p.stockActual} unidades.`;
    if (aviso) problemas.push(`${p.nombre}: ${aviso}`);
    return { ...item, precioUnitario: aNumero(p.precio), subtotal, aviso };
  });
  return {
    _id: carrito._id,
    items,
    cantidadArticulos: items.reduce((t, i) => t + i.cantidad, 0),
    subtotal: sumar(...items.map((i) => i.subtotal)),
    problemas,
  };
}

async function productoVendible(db, productoId) {
  const producto = await db.collection('productos').findOne({ _id: productoId, activo: true });
  if (!producto) throw new ErrorDeValidacion('El producto no está disponible.');
  return producto;
}

/** Agrega un producto o suma cantidad si ya estaba. Crea el carrito activo si no existe. */
async function agregar(db, usuarioId, productoId, cantidad = 1) {
  const producto = await productoVendible(db, productoId);
  const pedida = Math.max(1, Math.min(MAXIMO_POR_PRODUCTO, Number.parseInt(cantidad, 10) || 1));
  const carritos = db.collection('carritos');
  const ahora = new Date();

  // Un carrito activo por usuario (índice único parcial carrito_activo_unico).
  await carritos.updateOne(
    { usuarioId, estado: 'activo' },
    { $setOnInsert: { usuarioId, estado: 'activo', items: [] }, $set: { actualizadoEn: ahora } },
    { upsert: true },
  );
  const carrito = await carritos.findOne({ usuarioId, estado: 'activo' });
  const actual = carrito.items.find((i) => String(i.productoId) === String(productoId));
  const nuevaCantidad = Math.min((actual ? actual.cantidad : 0) + pedida, producto.stockActual, MAXIMO_POR_PRODUCTO);
  if (nuevaCantidad < 1) throw new ErrorDeValidacion('No hay stock disponible de este producto.');

  if (actual) {
    await carritos.updateOne(
      { _id: carrito._id, 'items.productoId': productoId },
      { $set: { 'items.$.cantidad': nuevaCantidad, actualizadoEn: ahora } },
    );
  } else {
    await carritos.updateOne(
      { _id: carrito._id },
      { $push: { items: { productoId, cantidad: nuevaCantidad, agregadoEn: ahora } }, $set: { actualizadoEn: ahora } },
    );
  }
  await alCambiarCarrito(db, usuarioId);
  return nuevaCantidad;
}

async function cambiarCantidad(db, usuarioId, productoId, cantidad) {
  const nueva = Number.parseInt(cantidad, 10);
  if (!Number.isFinite(nueva) || nueva < 1) return quitar(db, usuarioId, productoId);
  const producto = await db.collection('productos').findOne({ _id: productoId });
  const limite = Math.max(1, Math.min(nueva, producto ? producto.stockActual : nueva, MAXIMO_POR_PRODUCTO));
  await db.collection('carritos').updateOne(
    { usuarioId, estado: 'activo', 'items.productoId': productoId },
    { $set: { 'items.$.cantidad': limite, actualizadoEn: new Date() } },
  );
  await alCambiarCarrito(db, usuarioId);
}

async function quitar(db, usuarioId, productoId) {
  await db.collection('carritos').updateOne(
    { usuarioId, estado: 'activo' },
    { $pull: { items: { productoId } }, $set: { actualizadoEn: new Date() } },
  );
  await alCambiarCarrito(db, usuarioId);
}

module.exports = { obtenerDetallado, agregar, cambiarCantidad, quitar, MAXIMO_POR_PRODUCTO };
