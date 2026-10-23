// Scripts de mongosh: crea una base con db/setup.js (sin carga masiva), corre las consultas por
// pantalla que escriben y comprueba los operadores de arreglos y que todo quede como estaba.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { MongoClient } = require('mongodb');

const RAIZ = path.join(__dirname, '..');
const BASE = 'vinoteca_test_mongosh';
const hayMongosh = !spawnSync('mongosh', ['--version']).error;
const opciones = { skip: hayMongosh ? false : 'mongosh no está instalado' };

let cliente;
let db;

function mongosh(script) {
  const r = spawnSync('mongosh', ['--quiet', process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017', script], {
    cwd: RAIZ,
    encoding: 'utf8',
    env: { ...process.env, MONGODB_DB: BASE, PRODUCTOS: '0', USUARIOS: '0', PEDIDOS: '0' },
  });
  assert.equal(r.status, 0, `${script} falló:\n${r.stdout}\n${r.stderr}`);
  return r.stdout;
}

const estado = async () => ({
  direcciones: (await db.collection('usuarios').findOne({ email: 'ana@example.com' })).direcciones,
  selecciones: await db.collection('inicio').find({ seleccionProductoIds: { $exists: true } }, { projection: { seleccionProductoIds: 1 } }).sort({ _id: 1 }).toArray(),
});

before(async () => {
  if (!hayMongosh) return;
  mongosh('db/setup.js');
  cliente = new MongoClient(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017');
  await cliente.connect();
  db = cliente.db(BASE);
});
after(async () => {
  if (!cliente) return;
  await db.dropDatabase();
  await cliente.close();
});

test('mongosh: $addToSet con $each no repite productos de la selección y se deshace', opciones, async () => {
  const antes = await estado();
  const salida = mongosh('consultas/1_inicio.js');
  const [, n, m] = salida.match(/1\.6 \$addToSet con \$each .*: (\d+) → (\d+) productos/) || [];
  assert.ok(n, salida);
  assert.equal(Number(m), Number(n) + 1, 'de los dos productos solo se agrega el que no estaba');
  assert.deepEqual(await estado(), antes);
});

test('mongosh: $push con $each agrega dos direcciones y $pop las quita', opciones, async () => {
  const antes = await estado();
  const salida = mongosh('consultas/6_cuenta.js');
  assert.match(salida, new RegExp(`cantidad: ${antes.direcciones.length + 2}, alias: \\[.*"Trabajo", "Casa de mis padres"\\]`));
  assert.deepEqual(await estado(), antes);
});

test('mongosh: la compra de prueba de 5_pedido.js se deshace', opciones, async () => {
  const stock = async () => (await db.collection('productos').findOne({ sku: 'VIN-MAL-RES' })).stockActual;
  const [stockAntes, pedidosAntes] = [await stock(), await db.collection('pedidos').countDocuments()];
  mongosh('consultas/5_pedido.js');
  assert.equal(await stock(), stockAntes);
  assert.equal(await db.collection('pedidos').countDocuments(), pedidosAntes);
});
