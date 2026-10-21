const express = require('express');
const usuarios = require('../servicios/usuarios');
const pedidos = require('../servicios/pedidos');
const { requiereSesion, avisar, destinoSeguro } = require('./comunes');

const router = express.Router();
const { ErrorDeValidacion } = usuarios;

/** Inicia la sesión del usuario. Se regenera el id de sesión para evitar fijación de sesión. */
function iniciarSesion(req, usuario) {
  const volverA = req.session.volverA;
  return new Promise((resolver, rechazar) => {
    req.session.regenerate(async (error) => {
      if (error) return rechazar(error);
      req.session.usuarioId = String(usuario._id);
      req.session.nombre = usuario.nombre;
      req.session.rol = usuario.rol;
      resolver(volverA);
    });
  });
}

router.get('/ingresar', (req, res) => {
  if (req.usuarioId) return res.redirect('/cuenta');
  res.render('ingresar', { titulo: 'Iniciar sesión', email: '' });
});

router.post('/ingresar', async (req, res) => {
  const usuario = await usuarios.autenticar(req.db, req.body.email, req.body.password);
  if (!usuario) {
    res.locals.mensaje = { tipo: 'error', texto: 'El correo o la contraseña no son correctos.' };
    return res.status(401).render('ingresar', { titulo: 'Iniciar sesión', email: req.body.email || '' });
  }
  const volverA = await iniciarSesion(req, usuario);
  avisar(req, 'exito', `Hola, ${usuario.nombre}.`);
  res.redirect(destinoSeguro(volverA, '/'));
});

router.get('/crear', (req, res) => res.render('crear-cuenta', { titulo: 'Crear cuenta', valores: {} }));

router.post('/crear', async (req, res) => {
  try {
    const usuario = await usuarios.registrar(req.db, req.body);
    const volverA = await iniciarSesion(req, usuario);
    avisar(req, 'exito', 'Tu cuenta quedó creada.');
    res.redirect(destinoSeguro(volverA, '/'));
  } catch (error) {
    if (!(error instanceof ErrorDeValidacion)) throw error;
    res.locals.mensaje = { tipo: 'error', texto: error.message };
    const { password, confirmacion, ...valores } = req.body;
    res.status(400).render('crear-cuenta', { titulo: 'Crear cuenta', valores });
  }
});

router.get('/recuperar', (req, res) => res.render('recuperar', { titulo: 'Recuperar contraseña', enviado: false }));
router.post('/recuperar', (req, res) => res.render('recuperar', { titulo: 'Recuperar contraseña', enviado: true }));

router.post('/salir', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('vinoteca.sid');
    res.redirect('/');
  });
});

// Desde acá, páginas de la cuenta (requieren sesión).
router.use(requiereSesion);

router.get('/', async (req, res) => {
  const usuario = await req.db.collection('usuarios').findOne({ _id: req.usuarioId });
  res.render('cuenta', { titulo: 'Configuración de cuenta', seccion: 'configuracion', usuario });
});

router.post('/datos', async (req, res) => {
  try {
    await usuarios.actualizarDatos(req.db, req.usuarioId, req.body);
    req.session.nombre = req.body.nombre.trim();
    avisar(req, 'exito', 'Guardamos tus datos.');
  } catch (error) {
    if (!(error instanceof ErrorDeValidacion)) throw error;
    avisar(req, 'error', error.message);
  }
  res.redirect('/cuenta');
});

router.post('/contrasena', async (req, res) => {
  try {
    await usuarios.cambiarContrasena(req.db, req.usuarioId, req.body);
    avisar(req, 'exito', 'Actualizamos tu contraseña.');
  } catch (error) {
    if (!(error instanceof ErrorDeValidacion)) throw error;
    avisar(req, 'error', error.message);
  }
  res.redirect('/cuenta');
});

router.get('/direcciones', async (req, res) => {
  const usuario = await req.db.collection('usuarios').findOne({ _id: req.usuarioId });
  res.render('direcciones', { titulo: 'Direcciones', seccion: 'direcciones', usuario });
});

router.post('/direcciones', async (req, res) => {
  const b = req.body;
  const direccion = {
    alias: (b.alias || '').trim() || 'Dirección', calleNumero: (b.calleNumero || '').trim(), localidad: (b.localidad || '').trim(),
    provincia: (b.provincia || '').trim(), codigoPostal: (b.codigoPostal || '').trim(), referencias: (b.referencias || '').trim(),
  };
  if (!direccion.calleNumero || !direccion.localidad) {
    avisar(req, 'error', 'Completá la calle, el número y la localidad.');
  } else {
    // $push sobre el arreglo de direcciones del usuario (clase "Gestionando arrays").
    await req.db.collection('usuarios').updateOne({ _id: req.usuarioId }, { $push: { direcciones: direccion } });
    avisar(req, 'exito', 'Agregamos la dirección.');
  }
  res.redirect('/cuenta/direcciones');
});

router.post('/direcciones/:indice/quitar', async (req, res) => {
  const indice = Number.parseInt(req.params.indice, 10);
  if (Number.isInteger(indice) && indice >= 0) {
    // $unset del elemento y $pull de los nulos: quita una posición del arreglo sin reescribirlo entero.
    await req.db.collection('usuarios').updateOne({ _id: req.usuarioId }, { $unset: { [`direcciones.${indice}`]: 1 } });
    await req.db.collection('usuarios').updateOne({ _id: req.usuarioId }, { $pull: { direcciones: null } });
  }
  res.redirect('/cuenta/direcciones');
});

router.get('/pedidos', async (req, res) => {
  const lista = await pedidos.listar(req.db, req.usuarioId);
  res.render('mis-pedidos', { titulo: 'Mis pedidos', seccion: 'pedidos', pedidos: lista, estados: pedidos.ESTADOS });
});

router.get('/pedidos/:numero', async (req, res, next) => {
  const pedido = await pedidos.obtener(req.db, req.usuarioId, req.params.numero);
  if (!pedido) return next();
  res.render('detalle-pedido', { titulo: `Pedido #${pedido.numero}`, seccion: 'pedidos', pedido, estados: pedidos.ESTADOS });
});

module.exports = router;
