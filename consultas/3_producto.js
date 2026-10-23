// =============================================================================
// Pantalla DETALLE DE PRODUCTO (src/vistas/producto.ejs · src/servicios/productos.js)
// Uso:  mongosh consultas/3_producto.js
// =============================================================================

if (typeof mostrar === 'undefined') load(__dirname + '/lib.js');

{
seccion('3 · DETALLE DE PRODUCTO');

// -----------------------------------------------------------------------------
// 3.1 Ficha de un vino: el detalle del vino está embebido (detalleVino) y la
// categoría y la bodega se traen con $lookup (están referenciadas).
// -----------------------------------------------------------------------------
mostrar('3.1 Ficha de Malbec Reserva', () =>
  db.productos.aggregate([
    { $match: { _id: IDS.malbec, activo: true } },
    { $lookup: { from: 'categorias', localField: 'categoriaId', foreignField: '_id', as: 'categoria' } },
    { $unwind: '$categoria' },
    { $match: { 'categoria.activa': true } },
    { $lookup: { from: 'bodegas', localField: 'bodegaId', foreignField: '_id', as: 'bodega' } },
    { $set: { bodega: { $first: '$bodega' } } },
    { $project: { _id: 0, nombre: 1, precio: 1, stockActual: 1, 'categoria.nombre': 1, 'bodega.nombre': 1, 'bodega.provincia': 1, detalleVino: 1 } },
  ])
);

// -----------------------------------------------------------------------------
// 3.2 Ficha de un accesorio: tiene detalleAccesorio en lugar de detalleVino
// (los productos comparten colección y cambian según tipoProducto).
// -----------------------------------------------------------------------------
mostrar('3.2 Ficha de Copa de cristal', () =>
  db.productos.findOne({ _id: IDS.copa, activo: true }, { _id: 0, nombre: 1, tipoProducto: 1, precio: 1, detalleAccesorio: 1 })
);

// -----------------------------------------------------------------------------
// 3.3 "Sin stock por el momento": disponibilidad calculada en la consulta
// -----------------------------------------------------------------------------
mostrar('3.3 Disponibilidad de los productos de ejemplo', () =>
  db.productos.aggregate([
    { $match: { sku: { $not: /^VOL-/ } } },
    { $project: { _id: 0, nombre: 1, stockActual: 1, disponible: { $and: ['$activo', { $gt: ['$stockActual', 0] }] } } },
    { $match: { disponible: false } },
  ])
);

// -----------------------------------------------------------------------------
// 3.4 Evolución del precio del Malbec Reserva, mes a mes (serie temporal).
// historial_precios es una colección de series temporales: se filtra por el
// metaField (productoId) y un rango del timeField (fecha), que resuelve el
// índice { productoId, fecha } que MongoDB crea solo, y $dateTrunc agrupa por mes.
// -----------------------------------------------------------------------------
if (db.getCollectionInfos({ name: 'historial_precios', type: 'timeseries' }).length) {
  mostrar('3.4 Precio del Malbec Reserva por mes (historial_precios)', () =>
    db.historial_precios.aggregate([
      { $match: { productoId: IDS.malbec, fecha: { $gte: ISODate('2025-10-01'), $lte: HOY } } },
      { $group: {
        _id: { $dateTrunc: { date: '$fecha', unit: 'month' } },
        minimo: { $min: '$precio' }, maximo: { $max: '$precio' }, puntos: { $sum: 1 },
      } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, mes: { $dateToString: { date: '$_id', format: '%Y-%m' } }, minimo: 1, maximo: 1, puntos: 1 } },
    ]),
  { limite: 12 });
} else {
  print('\n▸ 3.4 Sin historial_precios: crear la serie con mongosh db/06_historial_precios.js');
}
}
