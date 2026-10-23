// =============================================================================
// Pantalla CARRITO (src/vistas/carrito.ejs · src/servicios/carritos.js)
// Uso:  mongosh consultas/4_carrito.js
// =============================================================================

if (typeof mostrar === 'undefined') load(__dirname + '/lib.js');

{
seccion('4 · CARRITO');

// -----------------------------------------------------------------------------
// 4.1 Carrito de Ana con los datos actuales de cada producto.
// El carrito guarda solo productoId y cantidad: precio y stock salen de
// productos al consultarlo ($unwind de los ítems + $lookup).
// -----------------------------------------------------------------------------
mostrar('4.1 Ítems del carrito con precio y stock actuales', () =>
  db.carritos.aggregate([
    { $match: { usuarioId: IDS.ana, estado: 'activo' } },
    { $unwind: '$items' },
    { $lookup: { from: 'productos', localField: 'items.productoId', foreignField: '_id', as: 'producto' } },
    { $unwind: '$producto' },
    { $sort: { 'items.agregadoEn': 1 } },
    { $project: {
      _id: 0, producto: '$producto.nombre', cantidad: '$items.cantidad', precioUnitario: '$producto.precio',
      subtotal: { $multiply: ['$producto.precio', '$items.cantidad'] }, stockActual: '$producto.stockActual',
    } },
  ])
);

// -----------------------------------------------------------------------------
// 4.2 Subtotal del carrito ($group suma los subtotales en Decimal128)
// -----------------------------------------------------------------------------
mostrar('4.2 Subtotal del carrito', () =>
  db.carritos.aggregate([
    { $match: { usuarioId: IDS.ana, estado: 'activo' } },
    { $unwind: '$items' },
    { $lookup: { from: 'productos', localField: 'items.productoId', foreignField: '_id', as: 'producto' } },
    { $unwind: '$producto' },
    { $group: { _id: '$_id', articulos: { $sum: '$items.cantidad' }, subtotal: { $sum: { $multiply: ['$producto.precio', '$items.cantidad'] } } } },
    { $project: { _id: 0 } },
  ])
);

// -----------------------------------------------------------------------------
// 4.3 Costo de envío (configuración de la tienda) para "Envío a domicilio"
// -----------------------------------------------------------------------------
mostrar('4.3 Formas de entrega habilitadas', () =>
  db.configuracion_tienda.findOne({}, { _id: 0, retiroHabilitado: 1, enviosHabilitados: 1, montoEnvioBase: 1 })
);
}
