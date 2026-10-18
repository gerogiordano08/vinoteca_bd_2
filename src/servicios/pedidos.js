const { aDecimal, aNumero, multiplicar, sumar } = require('../util/dinero');
const { alCambiarCarrito, alCambiarProducto } = require('./sincronizacion');
const { ErrorDeValidacion } = require('./usuarios');

const ESTADOS = {
  pendiente: 'Pendiente',
  confirmado: 'Confirmado',
  listo_para_retirar: 'Listo para retirar',
  enviado: 'Enviado',
  entregado: 'Entregado',
  cancelado: 'Cancelado',
};

/** Próximo número de pedido con el formato del boceto (V-1024). */
async function proximoNumero(db) {
  const [ultimo] = await db
    .collection('pedidos')
    .aggregate([
      { $project: { n: { $toInt: { $substrCP: ['$numero', 2, 12] } } } },
      { $sort: { n: -1 } },
      { $limit: 1 },
    ])
    .toArray();
  return `V-${(ultimo ? ultimo.n : 1000) + 1}`;
}

function validarEntrega({ contacto, entrega }, tienda) {
  const errores = [];
  if (!contacto.nombre || !contacto.apellido) errores.push('Completá tu nombre y apellido.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contacto.email || '')) errores.push('Ingresá un correo electrónico válido.');
  if (entrega.tipo === 'envio') {
    if (!tienda.enviosHabilitados) errores.push('Los envíos no están habilitados.');
    if (!entrega.calleNumero || !entrega.localidad) errores.push('Completá la dirección de entrega.');
  } else if (entrega.tipo === 'retiro') {
    if (!tienda.retiroHabilitado) errores.push('El retiro en tienda no está habilitado.');
  } else {
    errores.push('Elegí una forma de entrega.');
  }
  return errores;
}

/**
 * Convierte el carrito activo en un pedido.
 *
 * 1. Verifica de nuevo precios y stock contra productos (el modelo lo pide al confirmar la compra).
 * 2. Descuenta el stock con una actualización condicional por producto ({ stockActual: { $gte } }),
 *    que es atómica en cada documento. Si un producto ya no alcanza, devuelve lo descontado.
 *    La instancia local no es un replica set, así que no hay transacciones multidocumento.
 * 3. Guarda el pedido con el nombre y el precio del momento de la compra (datos históricos).
 * 4. Marca el carrito como convertido y sincroniza las copias de inicio y catalogo.
 */
async function confirmar(db, usuarioId, datos) {
  const tienda = (await db.collection('configuracion_tienda').findOne({})) || {};
  const errores = validarEntrega(datos, tienda);
  if (errores.length) throw new ErrorDeValidacion(errores.join(' '));

  const carrito = await db.collection('carritos').findOne({ usuarioId, estado: 'activo' });
  if (!carrito || !carrito.items.length) throw new ErrorDeValidacion('Tu carrito está vacío.');

  const ids = carrito.items.map((i) => i.productoId);
  const productos = await db.collection('productos').find({ _id: { $in: ids } }).toArray();
  const porId = new Map(productos.map((p) => [String(p._id), p]));

  const items = carrito.items.map((item) => {
    const p = porId.get(String(item.productoId));
    if (!p || !p.activo) throw new ErrorDeValidacion('Un producto de tu carrito ya no está a la venta. Revisá el carrito.');
    return {
      productoId: p._id,
      nombre: p.nombre,
      precioUnitario: aDecimal(aNumero(p.precio)),
      cantidad: item.cantidad,
      subtotal: aDecimal(multiplicar(p.precio, item.cantidad)),
    };
  });

  // Descuento de stock con compensación si algún producto no alcanza.
  const descontados = [];
  for (const item of items) {
    const { modifiedCount } = await db.collection('productos').updateOne(
      { _id: item.productoId, activo: true, stockActual: { $gte: item.cantidad } },
      { $inc: { stockActual: -item.cantidad } },
    );
    if (!modifiedCount) {
      for (const d of descontados) {
        await db.collection('productos').updateOne({ _id: d.productoId }, { $inc: { stockActual: d.cantidad } });
      }
      throw new ErrorDeValidacion(`No hay stock suficiente de ${item.nombre}. Ajustá la cantidad en el carrito.`);
    }
    descontados.push(item);
  }

  const subtotal = sumar(...items.map((i) => i.subtotal));
  const costoEnvio = datos.entrega.tipo === 'envio' ? aNumero(tienda.montoEnvioBase) : 0;
  const descuento = 0;
  const { contacto, entrega } = datos;
  const direccionEntrega = { tipo: entrega.tipo, contacto };
  if (entrega.tipo === 'envio') {
    Object.assign(direccionEntrega, {
      calleNumero: entrega.calleNumero,
      localidad: entrega.localidad,
      provincia: entrega.provincia || '',
      codigoPostal: entrega.codigoPostal || '',
      referencias: entrega.referencias || '',
    });
  }
  if (entrega.notas) direccionEntrega.notas = entrega.notas;

  const pedido = {
    usuarioId,
    items,
    direccionEntrega,
    subtotal: aDecimal(subtotal),
    descuento: aDecimal(descuento),
    costoEnvio: aDecimal(costoEnvio),
    total: aDecimal(sumar(subtotal, costoEnvio) - descuento),
    estadoPedido: 'pendiente',
    creadoEn: new Date(),
  };

  // El número es único (índice numero_unico); si dos compras coinciden se reintenta con el siguiente.
  for (let intento = 0; intento < 5; intento++) {
    pedido.numero = await proximoNumero(db);
    try {
      await db.collection('pedidos').insertOne(pedido);
      break;
    } catch (error) {
      if (error.code !== 11000 || intento === 4) {
        for (const d of descontados) {
          await db.collection('productos').updateOne({ _id: d.productoId }, { $inc: { stockActual: d.cantidad } });
        }
        throw error;
      }
      delete pedido._id;
    }
  }

  await db.collection('carritos').updateOne({ _id: carrito._id }, { $set: { estado: 'convertido', actualizadoEn: new Date() } });
  await alCambiarCarrito(db, usuarioId);
  await alCambiarProducto(db);
  return pedido;
}

async function listar(db, usuarioId) {
  return db.collection('pedidos').find({ usuarioId }).sort({ creadoEn: -1 }).toArray();
}

async function obtener(db, usuarioId, numero) {
  return db.collection('pedidos').findOne({ usuarioId, numero: String(numero).toUpperCase() });
}

module.exports = { ESTADOS, proximoNumero, confirmar, listar, obtener };
