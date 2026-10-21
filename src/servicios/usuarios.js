const bcrypt = require('bcryptjs');
const { alCambiarUsuario } = require('./sincronizacion');

const RONDAS = 10;
const normalizarEmail = (email) => String(email || '').trim().toLowerCase();

class ErrorDeValidacion extends Error {}

function validarDatosPersonales({ nombre, apellido, email }) {
  const errores = [];
  if (!String(nombre || '').trim()) errores.push('Ingresá tu nombre.');
  if (!String(apellido || '').trim()) errores.push('Ingresá tu apellido.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalizarEmail(email))) errores.push('Ingresá un correo electrónico válido.');
  return errores;
}

function validarContrasena(password, confirmacion) {
  const errores = [];
  if (String(password || '').length < 8) errores.push('La contraseña debe tener al menos 8 caracteres.');
  if (confirmacion !== undefined && password !== confirmacion) errores.push('Las contraseñas no coinciden.');
  return errores;
}

async function registrar(db, datos) {
  const errores = [...validarDatosPersonales(datos), ...validarContrasena(datos.password, datos.confirmacion)];
  if (errores.length) throw new ErrorDeValidacion(errores.join(' '));
  const documento = {
    nombre: datos.nombre.trim(),
    apellido: datos.apellido.trim(),
    email: normalizarEmail(datos.email),
    passwordHash: await bcrypt.hash(datos.password, RONDAS),
    rol: 'cliente',
    direcciones: [],
    activo: true,
    creadoEn: new Date(),
  };
  try {
    const { insertedId } = await db.collection('usuarios').insertOne(documento);
    return { _id: insertedId, ...documento };
  } catch (error) {
    if (error.code === 11000) throw new ErrorDeValidacion('Ya existe una cuenta con ese correo electrónico.');
    throw error;
  }
}

/** Devuelve el usuario si el correo y la contraseña son correctos y la cuenta está activa. */
async function autenticar(db, email, password) {
  const usuario = await db.collection('usuarios').findOne({ email: normalizarEmail(email), activo: true });
  if (!usuario) return null;
  return (await bcrypt.compare(String(password || ''), usuario.passwordHash)) ? usuario : null;
}

async function actualizarDatos(db, usuarioId, datos) {
  const errores = validarDatosPersonales(datos);
  if (errores.length) throw new ErrorDeValidacion(errores.join(' '));
  try {
    await db.collection('usuarios').updateOne(
      { _id: usuarioId },
      { $set: { nombre: datos.nombre.trim(), apellido: datos.apellido.trim(), email: normalizarEmail(datos.email), telefono: String(datos.telefono || '').trim() } },
    );
  } catch (error) {
    if (error.code === 11000) throw new ErrorDeValidacion('Ese correo electrónico ya está en uso.');
    throw error;
  }
  await alCambiarUsuario(db, usuarioId);
}

async function cambiarContrasena(db, usuarioId, { actual, nueva, confirmacion }) {
  const usuario = await db.collection('usuarios').findOne({ _id: usuarioId });
  if (!usuario || !(await bcrypt.compare(String(actual || ''), usuario.passwordHash))) {
    throw new ErrorDeValidacion('La contraseña actual no es correcta.');
  }
  const errores = validarContrasena(nueva, confirmacion);
  if (errores.length) throw new ErrorDeValidacion(errores.join(' '));
  await db.collection('usuarios').updateOne({ _id: usuarioId }, { $set: { passwordHash: await bcrypt.hash(nueva, RONDAS) } });
}

module.exports = { ErrorDeValidacion, normalizarEmail, registrar, autenticar, actualizarDatos, cambiarContrasena, RONDAS };
