// Consultas avanzadas del proyecto (clase "Gestión de datos": aggregate, $match, $group, $sum,
// $project, $cond, $lookup). Cada consulta responde una pregunta del negocio.
// Se ejecutan con `npm run consultas` o desde mongosh: mongosh vinoteca consultas/consultas.mongodb.js

const noCancelados = { $match: { estadoPedido: { $ne: 'cancelado' } } };

module.exports = [
  {
    titulo: '1. Ventas por mes: pedidos, facturación y ticket promedio',
    coleccion: 'pedidos',
    pipeline: [
      noCancelados,
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$creadoEn', timezone: '-03:00' } }, pedidos: { $sum: 1 }, facturado: { $sum: '$total' } } },
      { $project: { _id: 0, mes: '$_id', pedidos: 1, facturado: { $toDouble: '$facturado' }, ticketPromedio: { $round: [{ $divide: [{ $toDouble: '$facturado' }, '$pedidos'] }, 0] } } },
      { $sort: { mes: 1 } },
    ],
  },
  {
    titulo: '2. Los 5 productos más vendidos, con su stock actual ($unwind + $lookup)',
    coleccion: 'pedidos',
    pipeline: [
      noCancelados,
      { $unwind: '$items' },
      { $group: { _id: '$items.productoId', unidades: { $sum: '$items.cantidad' }, ingresos: { $sum: '$items.subtotal' } } },
      { $sort: { unidades: -1, ingresos: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'productos', localField: '_id', foreignField: '_id', as: 'producto' } },
      { $unwind: '$producto' },
      { $project: { _id: 0, producto: '$producto.nombre', unidades: 1, ingresos: { $toDouble: '$ingresos' }, stockActual: '$producto.stockActual' } },
    ],
  },
  {
    titulo: '3. Ingresos por categoría (dos $lookup encadenados)',
    coleccion: 'pedidos',
    pipeline: [
      noCancelados,
      { $unwind: '$items' },
      { $lookup: { from: 'productos', localField: 'items.productoId', foreignField: '_id', as: 'p' } },
      { $unwind: '$p' },
      { $lookup: { from: 'categorias', localField: 'p.categoriaId', foreignField: '_id', as: 'c' } },
      { $unwind: '$c' },
      { $group: { _id: '$c.nombre', unidades: { $sum: '$items.cantidad' }, ingresos: { $sum: '$items.subtotal' } } },
      { $project: { _id: 0, categoria: '$_id', unidades: 1, ingresos: { $toDouble: '$ingresos' } } },
      { $sort: { ingresos: -1 } },
    ],
  },
  {
    titulo: '4. Ventas de vinos por bodega y provincia',
    coleccion: 'pedidos',
    pipeline: [
      noCancelados,
      { $unwind: '$items' },
      { $lookup: { from: 'productos', localField: 'items.productoId', foreignField: '_id', as: 'p' } },
      { $unwind: '$p' },
      { $match: { 'p.bodegaId': { $exists: true } } },
      { $lookup: { from: 'bodegas', localField: 'p.bodegaId', foreignField: '_id', as: 'b' } },
      { $unwind: '$b' },
      { $group: { _id: { bodega: '$b.nombre', provincia: '$b.provincia' }, botellas: { $sum: '$items.cantidad' }, ingresos: { $sum: '$items.subtotal' } } },
      { $project: { _id: 0, bodega: '$_id.bodega', provincia: '$_id.provincia', botellas: 1, ingresos: { $toDouble: '$ingresos' } } },
      { $sort: { ingresos: -1 } },
    ],
  },
  {
    titulo: '5. Los 5 clientes que más compraron ($lookup a usuarios)',
    coleccion: 'pedidos',
    pipeline: [
      noCancelados,
      { $group: { _id: '$usuarioId', pedidos: { $sum: 1 }, gastado: { $sum: '$total' }, ultimaCompra: { $max: '$creadoEn' } } },
      { $sort: { gastado: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'usuarios', localField: '_id', foreignField: '_id', as: 'u' } },
      { $unwind: '$u' },
      { $project: { _id: 0, cliente: { $concat: ['$u.apellido', ', ', '$u.nombre'] }, pedidos: 1, gastado: { $toDouble: '$gastado' }, ultimaCompra: { $dateToString: { format: '%d/%m/%Y', date: '$ultimaCompra', timezone: '-03:00' } } } },
    ],
  },
  {
    titulo: '6. Control de stock con semáforo ($project + $cond / $switch)',
    coleccion: 'productos',
    pipeline: [
      { $match: { activo: true, stockActual: { $lt: 10 } } },
      {
        $project: {
          _id: 0, sku: 1, nombre: 1, stockActual: 1,
          nivel: { $switch: { branches: [{ case: { $eq: ['$stockActual', 0] }, then: 'Sin stock' }, { case: { $lt: ['$stockActual', 6] }, then: 'Crítico' }], default: 'Bajo' } },
        },
      },
      { $sort: { stockActual: 1, nombre: 1 } },
    ],
  },
  {
    titulo: '7. Retiro en tienda frente a envío a domicilio',
    coleccion: 'pedidos',
    pipeline: [
      noCancelados,
      { $group: { _id: '$direccionEntrega.tipo', pedidos: { $sum: 1 }, costoEnvio: { $sum: '$costoEnvio' }, facturado: { $sum: '$total' } } },
      { $group: { _id: null, total: { $sum: '$pedidos' }, tipos: { $push: '$$ROOT' } } },
      { $unwind: '$tipos' },
      { $project: { _id: 0, entrega: { $cond: [{ $eq: ['$tipos._id', 'envio'] }, 'Envío a domicilio', 'Retiro en tienda'] }, pedidos: '$tipos.pedidos', porcentaje: { $round: [{ $multiply: [{ $divide: ['$tipos.pedidos', '$total'] }, 100] }, 1] }, facturado: { $toDouble: '$tipos.facturado' } } },
    ],
  },
  {
    titulo: '8. Carritos abandonados y su valor a precios actuales',
    coleccion: 'carritos',
    pipeline: [
      { $match: { estado: 'abandonado' } },
      { $unwind: '$items' },
      { $lookup: { from: 'productos', localField: 'items.productoId', foreignField: '_id', as: 'p' } },
      { $unwind: '$p' },
      { $group: { _id: '$_id', actualizadoEn: { $first: '$actualizadoEn' }, articulos: { $sum: '$items.cantidad' }, valor: { $sum: { $multiply: ['$p.precio', '$items.cantidad'] } } } },
      { $group: { _id: null, carritos: { $sum: 1 }, articulos: { $sum: '$articulos' }, valorPerdido: { $sum: '$valor' } } },
      { $project: { _id: 0, carritos: 1, articulos: 1, valorPerdido: { $toDouble: '$valorPerdido' } } },
    ],
  },
  {
    titulo: '9. Precio histórico (pedidos.items) frente a precio actual (productos)',
    coleccion: 'pedidos',
    pipeline: [
      noCancelados,
      { $unwind: '$items' },
      { $group: { _id: '$items.productoId', nombre: { $first: '$items.nombre' }, precioPromedioVendido: { $avg: '$items.precioUnitario' } } },
      { $lookup: { from: 'productos', localField: '_id', foreignField: '_id', as: 'p' } },
      { $unwind: '$p' },
      { $project: { _id: 0, producto: '$nombre', vendidoA: { $round: [{ $toDouble: '$precioPromedioVendido' }, 0] }, precioActual: { $toDouble: '$p.precio' }, aumento: { $concat: [{ $toString: { $round: [{ $multiply: [{ $subtract: [{ $divide: [{ $toDouble: '$p.precio' }, { $toDouble: '$precioPromedioVendido' }] }, 1] }, 100] }, 1] } }, ' %'] } } },
      { $sort: { precioActual: -1 } },
      { $limit: 8 },
    ],
  },
  {
    titulo: '10. Resumen del catálogo en una sola consulta ($facet y $bucket)',
    coleccion: 'productos',
    pipeline: [
      { $match: { activo: true } },
      {
        $facet: {
          porTipo: [{ $group: { _id: '$tipoProducto', productos: { $sum: 1 }, stock: { $sum: '$stockActual' } } }, { $sort: { _id: 1 } }],
          porColor: [{ $match: { 'detalleVino.color': { $exists: true } } }, { $group: { _id: '$detalleVino.color', productos: { $sum: 1 } } }, { $sort: { productos: -1 } }],
          rangosDePrecio: [{ $bucket: { groupBy: { $toDouble: '$precio' }, boundaries: [0, 10000, 15000, 20000, 30000, 100000], default: 'Otros', output: { productos: { $sum: 1 } } } }],
        },
      },
    ],
  },
];
