const express = require('express');
const carritos = require('../servicios/carritos');
const { ErrorDeValidacion } = require('../servicios/usuarios');
const { aObjectId } = require('../util/ids');
const { requiereSesion, avisar, destinoSeguro } = require('./comunes');

const router = express.Router();

// El modelo pide iniciar sesión o registrarse para agregar artículos; no se crean usuarios ficticios.
router.use(requiereSesion);

router.get('/', async (req, res) => {
  const carrito = await carritos.obtenerDetallado(req.db, req.usuarioId);
  res.render('carrito', { titulo: 'Tu carrito', carrito });
});

router.post('/agregar', async (req, res) => {
  const productoId = aObjectId(req.body.productoId);
  if (!productoId) return res.redirect('/catalogo');
  try {
    await carritos.agregar(req.db, req.usuarioId, productoId, req.body.cantidad);
    avisar(req, 'exito', 'Agregamos el producto a tu carrito.');
  } catch (error) {
    if (!(error instanceof ErrorDeValidacion)) throw error;
    avisar(req, 'error', error.message);
  }
  res.redirect(destinoSeguro(req.body.volverA, '/carrito'));
});

router.post('/:productoId/cantidad', async (req, res) => {
  const productoId = aObjectId(req.params.productoId);
  if (productoId) {
    const actual = Number.parseInt(req.body.cantidad, 10) || 1;
    const cambio = req.body.accion === 'sumar' ? 1 : req.body.accion === 'restar' ? -1 : 0;
    await carritos.cambiarCantidad(req.db, req.usuarioId, productoId, actual + cambio);
  }
  res.redirect('/carrito');
});

router.post('/:productoId/quitar', async (req, res) => {
  const productoId = aObjectId(req.params.productoId);
  if (productoId) await carritos.quitar(req.db, req.usuarioId, productoId);
  res.redirect('/carrito');
});

module.exports = router;
