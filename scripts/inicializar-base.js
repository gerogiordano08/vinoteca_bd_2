// Crea las nueve colecciones con validación $jsonSchema y sus índices.
// Uso: npm run db:init
const { conectar, desconectar } = require('../src/db/conexion');
const { prepararBase } = require('../src/db/preparar');
const config = require('../src/config');

(async () => {
  try {
    const db = await conectar();
    console.log(`Base: ${config.baseDatos} (${config.mongoUri})`);
    await prepararBase(db, { log: (m) => console.log(`  ${m}`) });
    console.log('Listo.');
  } catch (error) {
    console.error('No se pudo inicializar la base:', error.message);
    process.exitCode = 1;
  } finally {
    await desconectar();
  }
})();
