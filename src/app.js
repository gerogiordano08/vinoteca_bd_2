const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const config = require('./config');
const { obtenerBase } = require('./db/conexion');
const { resumenCarrito } = require('./servicios/resumenes');
const vistas = require('./util/vistas');

function crearApp() {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, 'vistas'));
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' });
    next();
  });
  app.use(express.static(path.join(__dirname, '..', 'public'), { maxAge: '1h' }));
  app.use(express.urlencoded({ extended: false, limit: '20kb' }));
  app.use(
    session({
      name: 'vinoteca.sid',
      secret: config.secretoSesion,
      resave: false,
      saveUninitialized: false,
      cookie: { httpOnly: true, sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 7 },
    }),
  );

  // Identificación del modelo: usuario registrado o sesión de visitante (visitanteId).
  app.use(async (req, res, next) => {
    try {
      const db = obtenerBase();
      req.db = db;
      if (!req.session.usuarioId && !req.session.visitanteId) req.session.visitanteId = crypto.randomUUID();
      req.usuarioId = req.session.usuarioId ? vistas.aId(req.session.usuarioId) : null;
      req.propietario = req.usuarioId ? { usuarioId: req.usuarioId } : { visitanteId: req.session.visitanteId };

      res.locals.v = vistas;
      res.locals.sesion = req.session.usuarioId ? { nombre: req.session.nombre, rol: req.session.rol } : null;
      res.locals.rutaActual = req.path;
      res.locals.busqueda = '';
      res.locals.mensaje = req.session.mensaje || null;
      delete req.session.mensaje;
      res.locals.carrito = await resumenCarrito(db, req.usuarioId);
      next();
    } catch (error) {
      next(error);
    }
  });

  app.use('/', require('./rutas/tienda'));
  app.use('/carrito', require('./rutas/carrito'));
  app.use('/pedido', require('./rutas/pedido'));
  app.use('/cuenta', require('./rutas/cuenta'));

  app.use((req, res) => res.status(404).render('error', { titulo: 'Página no encontrada', detalle: 'La página que buscás no existe o se movió.' }));
  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).render('error', { titulo: 'Algo salió mal', detalle: 'No pudimos completar la operación. Probá de nuevo en unos minutos.' });
  });
  return app;
}

module.exports = { crearApp };
