const { isDeepStrictEqual } = require('node:util');
const { indices } = require('./indices');

// Solo se retiran estas definiciones antiguas; los índices agregados manualmente se conservan.
const obsoletos = {
  productos: [{ name: 'catalogo_categoria_precio', key: { activo: 1, categoriaId: 1, precio: 1 } }],
  carritos: [{ name: 'carritos_por_producto', key: { 'items.productoId': 1 } }],
  inicio: [
    { name: 'inicio_por_producto', key: { 'productosDestacados.productoId': 1 } },
    { name: 'inicio_por_categoria', key: { 'categorias.categoriaId': 1 } },
  ],
  catalogo: [{ name: 'catalogo_por_categoria', key: { 'categorias.categoriaId': 1 } }],
};

/** Actualiza solo índices: crea los nuevos antes de retirar los sustituidos y no escribe documentos. */
async function prepararIndices(db, { log = () => {} } = {}) {
  const existentes = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name));
  if (Object.keys(indices).some(nombre => !existentes.has(nombre))) {
    throw new Error('Faltan colecciones de la aplicación. Ejecutá db:init antes de actualizar solo los índices.');
  }

  // Revisa las definiciones a retirar antes de modificar nada.
  for (const [nombre, lista] of Object.entries(obsoletos)) {
    const actuales = await db.collection(nombre).indexes();
    for (const esperado of lista) {
      const actual = actuales.find(i => i.name === esperado.name);
      if (actual && (!isDeepStrictEqual(actual.key, esperado.key) || actual.unique || actual.sparse || actual.partialFilterExpression)) {
        throw new Error(`El índice ${nombre}.${esperado.name} tiene una definición diferente; se conserva sin cambios.`);
      }
    }
  }

  for (const [nombre, lista] of Object.entries(indices)) {
    for (const { key, ...opciones } of lista) await db.collection(nombre).createIndex(key, opciones);
    log(`Índices de ${nombre}: ${lista.map(i => i.name).join(', ')}`);
  }
  for (const [nombre, lista] of Object.entries(obsoletos)) {
    const actuales = await db.collection(nombre).indexes();
    for (const { name } of lista) {
      if (!actuales.some(i => i.name === name)) continue;
      await db.collection(nombre).dropIndex(name);
      log(`Índice retirado: ${nombre}.${name}`);
    }
  }
}

module.exports = { prepararIndices };
