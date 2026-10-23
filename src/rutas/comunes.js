/** Exige sesión iniciada; si no, guarda a dónde volver y manda a iniciar sesión. */
function requiereSesion(req, res, next) {
  if (req.usuarioId) return next();
  // Después de iniciar sesión se vuelve a la página (no al formulario POST, que no tiene vista).
  req.session.volverA = req.method === 'GET' ? req.originalUrl : destinoSeguro(req.body && req.body.volverA, '/');
  req.session.mensaje = { tipo: 'aviso', texto: 'Para continuar, iniciá sesión o creá una cuenta.' };
  return res.redirect('/cuenta/ingresar');
}

function avisar(req, tipo, texto) {
  req.session.mensaje = { tipo, texto };
}

/**
 * Vuelve solo a rutas internas de la tienda (evita redirecciones abiertas a otros sitios).
 * Los navegadores leen "/\otro-sitio" como "//otro-sitio", por eso tampoco se aceptan barras invertidas.
 */
function destinoSeguro(destino, porDefecto = '/') {
  return typeof destino === 'string' && destino.startsWith('/') && !destino.startsWith('//') && !destino.includes('\\')
    ? destino : porDefecto;
}

module.exports = { requiereSesion, avisar, destinoSeguro };
