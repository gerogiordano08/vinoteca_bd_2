// Actualiza exclusivamente índices, conservando documentos y validadores.
const { conectar, desconectar } = require('../src/db/conexion');
const { prepararIndices } = require('../src/db/preparar-indices');

(async () => {
  try {
    const db = await conectar();
    console.log(`Actualizando índices de ${db.databaseName}...`);
    await prepararIndices(db, { log: console.log });
    console.log('Índices actualizados.');
  } catch (error) {
    console.error('No se pudieron actualizar los índices:', error.message);
    process.exitCode = 1;
  } finally {
    await desconectar();
  }
})();
