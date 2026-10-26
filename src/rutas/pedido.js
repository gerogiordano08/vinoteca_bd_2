const express = require('express');
const carritos = require('../servicios/carritos');
const pedidos = require('../servicios/pedidos');
const { ErrorDeValidacion } = require('../servicios/usuarios');
const { aNumero } = require('../util/dinero');
const { requiereSesion, avisar } = require('./comunes');

const router = express.Router();
router.use(requiereSesion);

async function datosDeFormulario(req) {
  const [carrito, usuario, tienda] = await Promise.all([
    carritos.obtenerDetallado(req.db, req.usuarioId),
    req.db.collection('usuarios').findOne({ _id: req.usuarioId }),
    req.db.collection('configuracion_tienda').findOne({}),
  ]);
  return { carrito, usuario, tienda, costoEnvio: aNumero(tienda && tienda.montoEnvioBase) };
}

router.get('/finalizar', async (req, res) => {
  const datos = await datosDeFormulario(req);
  if (!datos.carrito.items.length) return res.redirect('/carrito');
  res.render('finalizar', { titulo: 'Finalizar pedido', ...datos, valores: req.session.formularioPedido || {} });
  delete req.session.formularioPedido;
});

router.post('/confirmar', async (req, res) => {
  const b = req.body;
  const datos = {
    contacto: { nombre: (b.nombre || '').trim(), apellido: (b.apellido || '').trim(), email: (b.email || '').trim().toLowerCase(), telefono: (b.telefono || '').trim() },
    entrega: { tipo: b.entrega === 'envio' ? 'envio' : 'retiro', notas: (b.notas || '').trim().slice(0, 300) },
  };
  if (datos.entrega.tipo === 'envio') {
    // Dirección guardada en la cuenta o una nueva escrita en el formulario.
    const usuario = await req.db.collection('usuarios').findOne({ _id: req.usuarioId });
    const guardada = usuario && usuario.direcciones && usuario.direcciones[Number.parseInt(b.direccionGuardada, 10)];
    Object.assign(datos.entrega, guardada || {
      calleNumero: (b.calleNumero || '').trim(), localidad: (b.localidad || '').trim(),
      provincia: (b.provincia || '').trim(), codigoPostal: (b.codigoPostal || '').trim(),
    });
  }
  try {
    const pedido = await pedidos.confirmar(req.db, req.usuarioId, datos);
    res.redirect(`/pedido/confirmado/${pedido.numero}`);
  } catch (error) {
    if (!(error instanceof ErrorDeValidacion)) throw error;
    req.session.formularioPedido = b;
    avisar(req, 'error', error.message);
    if (/Mis pedidos/.test(error.message)) return res.redirect('/cuenta/pedidos');
    res.redirect(/carrito|stock|venta/i.test(error.message) ? '/carrito' : '/pedido/finalizar');
  }
});

router.get('/confirmado/:numero', async (req, res, next) => {
  const pedido = await pedidos.obtener(req.db, req.usuarioId, req.params.numero);
  if (!pedido) return next();
  res.render('confirmado', { titulo: 'Pedido confirmado', pedido });
});

module.exports = router;
