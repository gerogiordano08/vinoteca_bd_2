// Uso: node --env-file=.env consultas/ejecutar.js 3
// Atajo: npm run consulta -- 3
const { conectar, desconectar } = require('../src/db/conexion');
const consultas = require('./avanzadas');

async function main() {
  const argumentos = process.argv.slice(2);
  const numero = Number(argumentos[0]);
  if (argumentos.length !== 1 || !Number.isInteger(numero) || numero < 1 || numero > consultas.length) {
    throw new Error(`Indicá un número del 1 al ${consultas.length}. Ejemplo: npm run consulta -- 3`);
  }

  try {
    const consulta = consultas[numero - 1];
    const db = await conectar();
    const resultado = await db.collection(consulta.coleccion).aggregate(consulta.pipeline).toArray();
    console.log(`\n${consulta.titulo}  [${consulta.coleccion}]`);
    if (resultado.length === 1 && Object.values(resultado[0]).every(Array.isArray)) {
      for (const [faceta, filas] of Object.entries(resultado[0])) {
        console.log(`  ${faceta}`);
        console.table(filas);
      }
    } else {
      console.table(resultado);
    }
  } finally {
    await desconectar();
  }
}

main().catch(error => {
  console.error('Error al ejecutar la consulta:', error.message);
  process.exitCode = 1;
});
