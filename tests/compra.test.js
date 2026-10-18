const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { baseDePrueba } = require('./ayuda');
const carritos = require('../src/servicios/carritos');
const pedidos = require('../src/servicios/pedidos');
const usuarios = require('../src/servicios/usuarios');
const { actualizarProducto } = require('../src/servicios/productos');
const { aNumero } = require('../src/util/dinero');

let entorno;
let db;
let ana;
const contacto = { nombre: 'Ana', apellido: 'Pérez', email: 'ana@example.com', telefono: '' };

before(async () => {
  entorno = await baseDePrueba('compra');
  db = entorno.db;
  ana = await db.collection('usuarios').findOne({ email: 'ana@example.com' });
});
after(async () => entorno.cerrar());

test('el carrito trae los precios actuales desde productos', async () => {
  const carrito = await carritos.obtenerDetallado(db, ana._id);
  assert.equal(carrito.cantidadArticulos, 2);
  assert.equal(carrito.subtotal, 26000);
});

test('agregar no supera el stock disponible', async () => {
  const cabernet = await db.collection('productos').findOne({ sku: 'VIN-CAB-FRA' }); // 6 unidades
  const cantidad = await carritos.agregar(db, ana._id, cabernet._id, 20);
  assert.equal(cantidad, 6);
  await carritos.quitar(db, ana._id, cabernet._id);
});

test('confirmar: guarda nombre y precio del momento, descuenta stock y convierte el carrito', async () => {
  const malbecAntes = await db.collection('productos').findOne({ sku: 'VIN-MAL-RES' });
  const pedido = await pedidos.confirmar(db, ana._id, { contacto, entrega: { tipo: 'retiro' } });

  assert.match(pedido.numero, /^V-\d+$/);
  assert.equal(aNumero(pedido.total), 26000);
  assert.equal(pedido.estadoPedido, 'pendiente');
  const malbecDespues = await db.collection('productos').findOne({ sku: 'VIN-MAL-RES' });
  assert.equal(malbecDespues.stockActual, malbecAntes.stockActual - 1);
  assert.equal(await db.collection('carritos').countDocuments({ usuarioId: ana._id, estado: 'activo' }), 0);

  // Datos históricos: si cambia el catálogo, el pedido no cambia.
  await actualizarProducto(db, malbecDespues._id, { precio: 25000, nombre: 'Malbec Reserva Especial' });
  const guardado = await pedidos.obtener(db, ana._id, pedido.numero);
  const item = guardado.items.find((i) => String(i.productoId) === String(malbecDespues._id));
  assert.equal(item.nombre, 'Malbec Reserva');
  assert.equal(aNumero(item.precioUnitario), 18500);
});

test('el envío suma montoEnvioBase de configuracion_tienda', async () => {
  const copa = await db.collection('productos').findOne({ sku: 'ACC-COP-CRI' });
  await carritos.agregar(db, ana._id, copa._id, 1);
  const pedido = await pedidos.confirmar(db, ana._id, {
    contacto,
    entrega: { tipo: 'envio', calleNumero: 'Belgrano 456', localidad: 'Godoy Cruz', provincia: 'Mendoza' },
  });
  assert.equal(aNumero(pedido.costoEnvio), 4500);
  assert.equal(aNumero(pedido.total), 7500 + 4500);
  assert.equal(pedido.direccionEntrega.tipo, 'envio');
});

test('sin stock suficiente no se registra el pedido y se devuelve lo descontado', async () => {
  const decantador = await db.collection('productos').findOne({ sku: 'ACC-DEC-VID' }); // 5 unidades
  const sacacorchos = await db.collection('productos').findOne({ sku: 'ACC-SAC-CLA' });
  await carritos.agregar(db, ana._id, sacacorchos._id, 1);
  await carritos.agregar(db, ana._id, decantador._id, 5);
  // Otra compra se lleva el stock antes de confirmar.
  await db.collection('productos').updateOne({ _id: decantador._id }, { $set: { stockActual: 2 } });
  const pedidosAntes = await db.collection('pedidos').countDocuments();
  const stockSacacorchos = (await db.collection('productos').findOne({ _id: sacacorchos._id })).stockActual;

  await assert.rejects(pedidos.confirmar(db, ana._id, { contacto, entrega: { tipo: 'retiro' } }), usuarios.ErrorDeValidacion);
  assert.equal(await db.collection('pedidos').countDocuments(), pedidosAntes);
  assert.equal((await db.collection('productos').findOne({ _id: sacacorchos._id })).stockActual, stockSacacorchos);
  assert.equal(await db.collection('carritos').countDocuments({ usuarioId: ana._id, estado: 'activo' }), 1);
});

test('registro, inicio de sesión y cambio de contraseña', async () => {
  const nuevo = await usuarios.registrar(db, { nombre: 'Lía', apellido: 'Sosa', email: 'LIA@ejemplo.test', password: 'clave-segura', confirmacion: 'clave-segura' });
  assert.equal(nuevo.email, 'lia@ejemplo.test');
  assert.ok(nuevo.passwordHash.startsWith('$2'));
  assert.ok(await usuarios.autenticar(db, 'lia@ejemplo.test', 'clave-segura'));
  assert.equal(await usuarios.autenticar(db, 'lia@ejemplo.test', 'otra'), null);
  await assert.rejects(usuarios.registrar(db, { nombre: 'Lía', apellido: 'Sosa', email: 'lia@ejemplo.test', password: 'clave-segura', confirmacion: 'clave-segura' }), /Ya existe/);
  await usuarios.cambiarContrasena(db, nuevo._id, { actual: 'clave-segura', nueva: 'clave-nueva-1', confirmacion: 'clave-nueva-1' });
  assert.ok(await usuarios.autenticar(db, 'lia@ejemplo.test', 'clave-nueva-1'));
});
