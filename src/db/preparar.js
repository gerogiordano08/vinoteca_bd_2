const { esquemas } = require('./esquemas');
const { prepararIndices } = require('./preparar-indices');

/**
 * Crea las colecciones con su validador $jsonSchema (o lo actualiza si ya existen) y crea los índices.
 * Es idempotente. Elimina páginas derivadas antiguas sin usuario válido, conservando los datos de negocio.
 */
async function prepararBase(db, { log = () => {} } = {}) {
  const existentes = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name));

  for (const nombre of ['inicio', 'catalogo']) {
    if (!existentes.has(nombre)) continue;
    const coleccion = db.collection(nombre);
    const sinUsuario = coleccion.aggregate([
      { $lookup: { from: 'usuarios', localField: 'usuario.usuarioId', foreignField: '_id', as: 'usuarioRelacionado' } },
      { $match: { $or: [
        { visitanteId: { $exists: true } },
        { 'usuario.usuarioId': { $not: { $type: 'objectId' } } },
        { 'usuarioRelacionado.0': { $exists: false } },
      ] } },
      { $project: { _id: 1 } },
    ]);
    let eliminadas = 0;
    let lote = [];
    for await (const pagina of sinUsuario) {
      lote.push(pagina._id);
      if (lote.length === 500) {
        eliminadas += (await coleccion.deleteMany({ _id: { $in: lote } })).deletedCount;
        lote = [];
      }
    }
    if (lote.length) eliminadas += (await coleccion.deleteMany({ _id: { $in: lote } })).deletedCount;
    log(`Páginas de ${nombre} sin usuario válido eliminadas: ${eliminadas}`);
    const indiceVisitante = `${nombre}_por_visitante`;
    if ((await coleccion.indexes()).some((i) => i.name === indiceVisitante)) {
      await coleccion.dropIndex(indiceVisitante);
    }
  }

  for (const [nombre, esquema] of Object.entries(esquemas)) {
    const opciones = { validator: { $jsonSchema: esquema }, validationLevel: 'strict', validationAction: 'error' };
    if (existentes.has(nombre)) {
      await db.command({ collMod: nombre, ...opciones });
      log(`Validador actualizado: ${nombre}`);
    } else {
      await db.createCollection(nombre, opciones);
      log(`Colección creada: ${nombre}`);
    }
    if (nombre === 'catalogo') {
      // Primero se actualiza el validador: el anterior exigía estos campos.
      const migracion = await db.collection(nombre).updateMany({}, { $unset: {
        productos: '', opcionesFiltro: '', 'paginacion.totalProductos': '', 'paginacion.totalPaginas': '',
      } });
      log(`Catálogos sin copias de resultados migrados: ${migracion.modifiedCount}`);
      if ((await db.collection(nombre).indexes()).some((i) => i.name === 'catalogo_por_producto')) {
        await db.collection(nombre).dropIndex('catalogo_por_producto');
      }
    }
  }

  await prepararIndices(db, { log });
}

module.exports = { prepararBase };
