const { ObjectId } = require('mongodb');

/** Convierte un texto en ObjectId; devuelve null si no es válido (evita errores con URLs manipuladas). */
function aObjectId(valor) {
  if (valor instanceof ObjectId) return valor;
  return typeof valor === 'string' && ObjectId.isValid(valor) && valor.length === 24 ? new ObjectId(valor) : null;
}

module.exports = { aObjectId };
