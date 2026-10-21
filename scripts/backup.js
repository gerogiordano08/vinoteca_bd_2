// Resguardo de la base (clase "Migración y resguardo"): mongodump comprimido + retención.
//
//   node scripts/backup.js              copia completa en backups/vinoteca-AAAAMMDD-HHMMSS.archive.gz
//   node scripts/backup.js --exportar   además exporta el catálogo a JSON con mongoexport
//
// Política (docs/implementacion/backup.md): una copia diaria, se conservan las 7 últimas
// y las copias de los domingos durante 4 semanas.
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../src/config');

const CARPETA = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const DIARIAS = 7;
const SEMANALES = 4;

function sello(fecha = new Date()) {
  const d = (n) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}${d(fecha.getMonth() + 1)}${d(fecha.getDate())}-${d(fecha.getHours())}${d(fecha.getMinutes())}${d(fecha.getSeconds())}`;
}

function ejecutar(programa, argumentos) {
  const r = spawnSync(programa, argumentos, { encoding: 'utf8' });
  if (r.error) throw new Error(`No se encontró ${programa}. Instalá MongoDB Database Tools y agregalo al PATH.`);
  if (r.status !== 0) throw new Error(`${programa} terminó con error:\n${r.stderr}`);
  return r.stderr; // las herramientas de MongoDB informan el progreso por stderr
}

/** Conserva las copias diarias más nuevas y una por domingo de las últimas semanas. */
function aplicarRetencion() {
  const copias = fs.readdirSync(CARPETA)
    .filter((f) => /^vinoteca-\d{8}-\d{6}\.archive\.gz$/.test(f))
    .sort()
    .reverse();
  const conservar = new Set(copias.slice(0, DIARIAS));
  const semanas = new Set();
  for (const f of copias) {
    const [, a, m, d] = f.match(/^vinoteca-(\d{4})(\d{2})(\d{2})/);
    const fecha = new Date(Number(a), Number(m) - 1, Number(d));
    if (fecha.getDay() === 0 && semanas.size < SEMANALES && !semanas.has(f.slice(9, 17))) {
      semanas.add(f.slice(9, 17));
      conservar.add(f);
    }
  }
  const borradas = copias.filter((f) => !conservar.has(f));
  for (const f of borradas) fs.unlinkSync(path.join(CARPETA, f));
  return { conservadas: conservar.size, borradas: borradas.length };
}

function main() {
  fs.mkdirSync(CARPETA, { recursive: true });
  const archivo = path.join(CARPETA, `vinoteca-${sello()}.archive.gz`);
  ejecutar('mongodump', [`--uri=${config.mongoUri}`, `--db=${config.baseDatos}`, `--archive=${archivo}`, '--gzip']);
  const tamano = (fs.statSync(archivo).size / 1024).toFixed(1);
  console.log(`Backup completo: ${path.relative(process.cwd(), archivo)} (${tamano} KB)`);

  if (process.argv.includes('--exportar')) {
    const json = path.join(CARPETA, `productos-${sello()}.json`);
    ejecutar('mongoexport', [`--uri=${config.mongoUri}`, `--db=${config.baseDatos}`, '--collection=productos', `--out=${json}`, '--jsonArray', '--pretty']);
    console.log(`Exportación JSON: ${path.relative(process.cwd(), json)}`);
  }

  const { conservadas, borradas } = aplicarRetencion();
  console.log(`Retención: ${conservadas} copias conservadas, ${borradas} borradas.`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { aplicarRetencion, sello };
