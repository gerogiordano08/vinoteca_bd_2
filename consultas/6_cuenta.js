// =============================================================================
// Pantallas MI CUENTA, MIS PEDIDOS, DETALLE DE PEDIDO y DIRECCIONES
// (src/vistas/cuenta.ejs, mis-pedidos.ejs, detalle-pedido.ejs y direcciones.ejs)
// Uso:  mongosh consultas/6_cuenta.js
// =============================================================================

if (typeof mostrar === 'undefined') load(__dirname + '/lib.js');

{
seccion('6 · MI CUENTA');

// -----------------------------------------------------------------------------
// 6.1 Datos de la cuenta. Las direcciones están embebidas en el usuario
// (pocas por usuario y siempre se leen junto con él).
// -----------------------------------------------------------------------------
mostrar('6.1 Cuenta y direcciones de Ana', () =>
  db.usuarios.findOne({ _id: IDS.ana }, { _id: 0, nombre: 1, apellido: 1, email: 1, telefono: 1, direcciones: 1 })
);

// -----------------------------------------------------------------------------
// 6.2 Mis pedidos, del más nuevo al más viejo (índice pedidos_de_usuario)
// -----------------------------------------------------------------------------
const pedidos = mostrar('6.2 Mis pedidos de cliente01', () =>
  db.pedidos.find({ usuarioId: IDS.cliente01 }, { _id: 0, numero: 1, creadoEn: 1, total: 1, estadoPedido: 1, 'direccionEntrega.tipo': 1 })
    .sort({ creadoEn: -1 })
);

// -----------------------------------------------------------------------------
// 6.3 Detalle de un pedido: ítems y dirección embebidos, con el precio histórico
// (no cambia aunque cambie el precio actual del producto).
// -----------------------------------------------------------------------------
mostrar(`6.3 Detalle del pedido ${pedidos[0].numero}`, () =>
  db.pedidos.findOne({ usuarioId: IDS.cliente01, numero: pedidos[0].numero }, { _id: 0, numero: 1, items: 1, direccionEntrega: 1, subtotal: 1, costoEnvio: 1, total: 1 })
);

// -----------------------------------------------------------------------------
// 6.4 Resumen de compras del cliente ($group sobre sus pedidos no cancelados)
// -----------------------------------------------------------------------------
mostrar('6.4 Resumen de compras de cliente01', () =>
  db.pedidos.aggregate([
    { $match: { usuarioId: IDS.cliente01, estadoPedido: { $ne: 'cancelado' } } },
    { $group: { _id: '$usuarioId', pedidos: { $sum: 1 }, gastado: { $sum: '$total' }, ultimaCompra: { $max: '$creadoEn' } } },
    { $project: { _id: 0 } },
  ])
);
}
