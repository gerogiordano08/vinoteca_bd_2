const { esquemas } = require('./esquemas');
const { indices } = require('./indices');

/**
 * Crea las colecciones con su validador $jsonSchema (o lo actualiza si ya existen) y crea los índices.
 * Es idempotente: se puede ejecutar varias veces sin perder datos.
 */
async function prepararBase(db, { log = () => {} } = {}) {
  const existentes = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const [nombre, esquema] of Object.entries(esquemas)) {
    const opciones = { validator: { $jsonSchema: esquema }, validationLevel: 'strict', validationAction: 'error' };
    if (existentes.has(nombre)) {
      await db.command({ collMod: nombre, ...opciones });
      log(`Validador actualizado: ${nombre}`);
    } else {
      await db.createCollection(nombre, opciones);
      log(`Colección creada: ${nombre}`);
    }
  }

  for (const [nombre, lista] of Object.entries(indices)) {
    const coleccion = db.collection(nombre);
    for (const { key, ...opciones } of lista) {
      await coleccion.createIndex(key, opciones);
    }
    log(`Índices de ${nombre}: ${lista.map((i) => i.name).join(', ')}`);
  }
}

module.exports = { prepararBase };
