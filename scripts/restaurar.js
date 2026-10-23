// Restauración de un backup hecho con scripts/backup.js (mongorestore).
//
//   node scripts/restaurar.js                     restaura el último backup en vinoteca_restaurada (prueba)
//   node scripts/restaurar.js <archivo> --sobre   reemplaza la base de trabajo (vinoteca) con ese backup
//
// Restaurar en otra base primero permite comprobar que la copia sirve sin tocar los datos actuales.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient } = require('mongodb');
const config = require('../src/config');
const { COLECCIONES } = require('../src/db/esquemas');

const CARPETA = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');

function ultimoBackup() {
  const copias = fs.existsSync(CARPETA) ? fs.readdirSync(CARPETA).filter((f) => f.endsWith('.archive.gz')).sort() : [];
  if (!copias.length) throw new Error('No hay backups en la carpeta backups/. Ejecutá primero: node scripts/backup.js');
  return path.join(CARPETA, copias[copias.length - 1]);
}

async function main() {
  const argumentos = process.argv.slice(2);
  const archivo = argumentos.find((a) => !a.startsWith('--')) || ultimoBackup();
  const destino = argumentos.includes('--sobre') ? config.baseDatos : `${config.baseDatos}_restaurada`;

  const r = spawnSync('mongorestore', [
    `--uri=${config.mongoUri}`, `--archive=${archivo}`, '--gzip', '--drop',
    `--nsFrom=${config.baseDatos}.*`, `--nsTo=${destino}.*`,
  ], { encoding: 'utf8' });
  if (r.error) throw new Error('No se encontró mongorestore. Instalá MongoDB Database Tools y agregalo al PATH.');
  if (r.status !== 0) throw new Error(`mongorestore terminó con error:\n${r.stderr}`);

  // Verificación: cantidad de documentos por colección en la base restaurada.
  const cliente = new MongoClient(config.mongoUri);
  await cliente.connect();
  const db = cliente.db(destino);
  console.log(`Restaurado ${path.basename(archivo)} en la base ${destino}:`);
  for (const nombre of COLECCIONES) console.log(`  ${nombre.padEnd(22)} ${await db.collection(nombre).countDocuments()}`);
  const [serie] = await db.listCollections({ name: 'historial_precios' }).toArray();
  if (serie) console.log(`  ${'historial_precios'.padEnd(22)} ${await db.collection('historial_precios').countDocuments()} (${serie.type})`);
  const validador = (await db.listCollections({ name: 'productos' }).toArray())[0];
  console.log(`  Validador $jsonSchema de productos: ${validador && validador.options.validator ? 'restaurado' : 'falta'}`);
  console.log(`  Índices de productos: ${(await db.collection('productos').indexes()).length}`);
  await cliente.close();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
