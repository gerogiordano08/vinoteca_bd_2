// =============================================================================
// Pantallas FINALIZAR PEDIDO y CONFIRMACIÓN: escrituras
// (src/servicios/carritos.js, pedidos.js y sincronizacion.js)
//
// Hace una compra completa con la cuenta demo-tintos y al final la deshace,
// así la base queda como estaba y el script se puede repetir:
//   5.1 agregar al carrito       updateOne con upsert + $push / $set con $
//   5.2 copia en las páginas     updateMany sobre inicio y catalogo
//   5.3 confirmar el pedido      $inc condicional del stock + insertOne
//   5.4 deshacer                 deleteOne, $inc y restaurar el carrito
//
// Uso:  mongosh consultas/5_pedido.js
// =============================================================================

if (typeof mostrar === 'undefined') load(__dirname + '/lib.js');

{
seccion('5 · FINALIZAR PEDIDO (escrituras)');
const usuarioId = IDS.demoTintos;
const productoId = IDS.malbec;
const antes = {
  carrito: db.carritos.findOne({ usuarioId, estado: 'activo' }),
  stock: db.productos.findOne({ _id: productoId }).stockActual,
  inicio: db.inicio.findOne({ 'usuario.usuarioId': usuarioId }, { carrito: 1 }).carrito,
  catalogo: db.catalogo.findOne({ 'usuario.usuarioId': usuarioId }, { carrito: 1 }).carrito,
};

// -----------------------------------------------------------------------------
// 5.1 Agregar 2 Malbec Reserva al carrito.
// Un carrito activo por usuario (índice único parcial carrito_activo_unico):
// upsert lo crea si no existe. Si el producto ya estaba se suma con el operador
// posicional $, si no se agrega con $push.
// -----------------------------------------------------------------------------
const ahora = new Date();
db.carritos.updateOne(
  { usuarioId, estado: 'activo' },
  { $setOnInsert: { usuarioId, estado: 'activo', items: [] }, $set: { actualizadoEn: ahora } },
  { upsert: true }
);
const yaEsta = db.carritos.updateOne(
  { usuarioId, estado: 'activo', 'items.productoId': productoId },
  { $inc: { 'items.$.cantidad': 2 }, $set: { actualizadoEn: ahora } }
).modifiedCount;
if (!yaEsta) {
  db.carritos.updateOne(
    { usuarioId, estado: 'activo' },
    { $push: { items: { productoId, cantidad: 2, agregadoEn: ahora } } }
  );
}
const carrito = mostrar('5.1 Carrito después de agregar', () =>
  db.carritos.findOne({ usuarioId, estado: 'activo' }, { _id: 1, estado: 1, items: 1 })
);

// -----------------------------------------------------------------------------
// 5.2 Sincronización: Inicio y Catálogo guardan una copia del resumen del
// carrito (patrón de copia de datos); se actualiza en las dos colecciones.
// -----------------------------------------------------------------------------
const cantidad = carrito.items.reduce((t, i) => t + i.cantidad, 0);
for (const pagina of ['inicio', 'catalogo']) {
  db.getCollection(pagina).updateMany({ 'usuario.usuarioId': usuarioId }, { $set: { carrito: { carritoId: carrito._id, cantidadArticulos: cantidad } } });
}
mostrar('5.2 Copia del carrito en Inicio', () => db.inicio.findOne({ 'usuario.usuarioId': usuarioId }, { _id: 0, carrito: 1 }));

// -----------------------------------------------------------------------------
// 5.3 Confirmar el pedido.
// El stock se descuenta con una actualización condicional ({ stockActual: { $gte } }),
// atómica en cada documento: si no alcanza, modifiedCount es 0 y no se vende.
// El pedido guarda nombre y precio del momento de la compra (datos históricos).
// -----------------------------------------------------------------------------
const productos = db.productos.find({ _id: { $in: carrito.items.map((i) => i.productoId) } }).toArray();
const items = carrito.items.map((i) => {
  const p = productos.find((x) => x._id.equals(i.productoId));
  const subtotal = Decimal128.fromString((Number(p.precio.toString()) * i.cantidad).toFixed(2));
  return { productoId: p._id, nombre: p.nombre, precioUnitario: p.precio, cantidad: i.cantidad, subtotal };
});
const descontado = items.map((i) => db.productos.updateOne(
  { _id: i.productoId, activo: true, stockActual: { $gte: i.cantidad } },
  { $inc: { stockActual: -i.cantidad } }
).modifiedCount);
print(`\n▸ 5.3 Stock descontado en ${descontado.filter(Boolean).length} de ${items.length} productos`);

const ultimo = db.pedidos.aggregate([
  { $project: { n: { $toInt: { $substrCP: ['$numero', 2, 12] } } } }, { $sort: { n: -1 } }, { $limit: 1 },
]).toArray()[0];
const total = items.reduce((t, i) => t + Number(i.subtotal.toString()), 0);
const usuario = db.usuarios.findOne({ _id: usuarioId });
const pedido = {
  numero: `V-${ultimo.n + 1}`,
  usuarioId,
  items,
  direccionEntrega: { tipo: 'retiro', contacto: { nombre: usuario.nombre, apellido: usuario.apellido, email: usuario.email, telefono: usuario.telefono || '' } },
  subtotal: Decimal128.fromString(total.toFixed(2)),
  descuento: Decimal128.fromString('0.00'),
  costoEnvio: Decimal128.fromString('0.00'),
  total: Decimal128.fromString(total.toFixed(2)),
  estadoPedido: 'pendiente',
  creadoEn: new Date(),
};
const { insertedId } = db.pedidos.insertOne(pedido);
db.carritos.updateOne({ _id: carrito._id }, { $set: { estado: 'convertido', actualizadoEn: new Date() } });
mostrar('5.3 Pedido confirmado', () => db.pedidos.findOne({ _id: insertedId }, { _id: 0, numero: 1, 'items.nombre': 1, 'items.cantidad': 1, total: 1, estadoPedido: 1 }));
mostrar('5.3 Stock de Malbec Reserva', () => db.productos.findOne({ _id: productoId }, { _id: 0, nombre: 1, stockActual: 1 }));

// -----------------------------------------------------------------------------
// 5.4 Deshacer la compra de prueba
// -----------------------------------------------------------------------------
db.pedidos.deleteOne({ _id: insertedId });
items.forEach((i, k) => { if (descontado[k]) db.productos.updateOne({ _id: i.productoId }, { $inc: { stockActual: i.cantidad } }); });
db.carritos.deleteOne({ _id: carrito._id });
if (antes.carrito) db.carritos.insertOne(antes.carrito);
db.inicio.updateOne({ 'usuario.usuarioId': usuarioId }, { $set: { carrito: antes.inicio } });
db.catalogo.updateOne({ 'usuario.usuarioId': usuarioId }, { $set: { carrito: antes.catalogo } });
const despues = db.productos.findOne({ _id: productoId }).stockActual;
print(`\n▸ 5.4 Compra de prueba deshecha: stock ${despues} (antes ${antes.stock}), pedido ${pedido.numero} eliminado`);
}
