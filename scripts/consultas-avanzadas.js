// Ejecuta las consultas avanzadas de consultas/avanzadas.js y muestra los resultados en tablas.
// Uso: npm run consultas
const { conectar, desconectar } = require('../src/db/conexion');
const consultas = require('../consultas/avanzadas');

(async () => {
  try {
    const db = await conectar();
    for (const c of consultas) {
      const resultado = await db.collection(c.coleccion).aggregate(c.pipeline).toArray();
      console.log(`\n${c.titulo}  [${c.coleccion}]`);
      if (resultado.length === 1 && Object.values(resultado[0]).every(Array.isArray)) {
        for (const [faceta, filas] of Object.entries(resultado[0])) {
          console.log(`  ${faceta}`);
          console.table(filas);
        }
      } else {
        console.table(resultado);
      }
    }
  } catch (error) {
    console.error('Error al ejecutar las consultas:', error.message);
    process.exitCode = 1;
  } finally {
    await desconectar();
  }
})();
