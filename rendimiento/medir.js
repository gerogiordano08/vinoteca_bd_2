// =============================================================================
// Medición de rendimiento con executionTimeMillis (como en la clase de índices)
//
// Para cada colección:
//   1. getIndexes()   lista los índices
//   2. dropIndex()    elimina los índices de la aplicación (src/db/indices.js)
//   3. explain("executionStats")  → SIN índice
//   4. createIndex()  vuelve a crear los mismos índices
//   5. explain("executionStats")  → CON índice
//
// De cada consulta se toman executionTimeMillis (mediana de 5 ejecuciones) y
// totalDocsExamined. Conviene correrlo con la carga masiva (mongosh db/setup.js).
// Al terminar, los índices quedan creados igual que antes.
//
// Uso:  mongosh rendimiento/medir.js
// =============================================================================

load(__dirname + '/../db/config.js');
db = db.getSiblingDB(CONFIG.dbName);
const { indices } = require(require('path').resolve(__dirname, '..', 'src', 'db', 'indices.js'));

const activas = db.categorias.find({ activa: true }, { _id: 1 }).toArray().map((c) => c._id);
const vinos = db.categorias.findOne({ slug: 'vinos' })._id;
const calchaquies = db.bodegas.findOne({ nombre: /calchaqu/i })._id;
const CLIENTE = db.usuarios.findOne({ email: 'volumen05000@ejemplo.test' }) || db.usuarios.findOne({ email: 'cliente01@ejemplo.test' });
const NUMERO = db.pedidos.find({}, { numero: 1 }).sort({ creadoEn: -1 }).limit(1).toArray()[0].numero;
const base = { activo: true, categoriaId: { $in: activas } };

// Índices que usa el plan ganador (recorre las etapas: FETCH <- IXSCAN …)
const indicesDelPlan = (etapa) => {
  if (!etapa) return [];
  const propios = etapa.indexName ? [etapa.indexName] : [];
  const hijos = [etapa.inputStage, ...(etapa.inputStages || [])].flatMap(indicesDelPlan);
  return [...new Set([...propios, ...hijos])];
};

// executionTimeMillis (mediana de 5), documentos examinados e índice usado de una consulta
const medir = function (consulta) {
  const valores = [];
  let examinados = 0;
  let usado = [];
  for (let i = 0; i < 5; i++) {
    const e = consulta().explain('executionStats');
    valores.push(e.executionStats.executionTimeMillis);
    examinados = e.executionStats.totalDocsExamined;
    usado = indicesDelPlan(e.queryPlanner.winningPlan);
  }
  return { ms: valores.sort((a, b) => a - b)[2], docs: examinados, usado: usado.join(', ') || 'ninguno (COLLSCAN)' };
};

const listar = (coleccion) => print(`  ${coleccion}.getIndexes(): ${db.getCollection(coleccion).getIndexes().map((i) => i.name).join(', ')}`);
const eliminar = (coleccion) => indices[coleccion].forEach((i) => db.getCollection(coleccion).dropIndex(i.name));
const crear = (coleccion) => indices[coleccion].forEach(({ key, ...opciones }) => db.getCollection(coleccion).createIndex(key, opciones));

// -----------------------------------------------------------------------------
// Consultas de las pantallas (consultas/*.js) a medir
// -----------------------------------------------------------------------------
const COLECCIONES = [
  {
    nombre: 'productos',
    consultas: [
      ['—', 'Todos los documentos (sin filtro)', 'ninguno', () => db.productos.find()],
      ['1.3', 'Destacados de Inicio', 'destacados_por_nombre',
        () => db.productos.find({ destacado: true, activo: true, stockActual: { $gt: 0 } }).sort({ nombre: 1 })],
      ['2.2', 'Catálogo, orden Destacados (12)', 'catalogo_categoria_destacados',
        () => db.productos.find(base).sort({ destacado: -1, nombre: 1, _id: 1 }).limit(12)],
      ['2.4', 'Vinos por nombre, página 2', 'catalogo_categoria_nombre',
        () => db.productos.find({ activo: true, categoriaId: vinos }).sort({ nombre: 1, _id: 1 }).skip(12).limit(12)],
      ['2.x', 'Catálogo por precio ascendente (12)', 'catalogo_categoria_precio_asc',
        () => db.productos.find(base).sort({ precio: 1, nombre: 1, _id: 1 }).limit(12)],
      ['2.5', 'Tintos Malbec entre $15.000 y $30.000', 'filtro_color_varietal',
        () => db.productos.find({ ...base, 'detalleVino.color': 'Tinto', 'detalleVino.varietal': 'Malbec',
          precio: { $gte: NumberDecimal('15000'), $lte: NumberDecimal('30000') } })],
      ['2.7', 'Búsqueda por bodega, por nombre (12)', 'por_bodega',
        () => db.productos.find({ ...base, bodegaId: calchaquies }).sort({ nombre: 1, _id: 1 }).limit(12)],
      ['3.x', 'Producto por SKU', 'sku_unico',
        () => db.productos.find({ sku: 'VOL-0150000' })],
      ['2.6', 'Búsqueda de texto "copas"', 'busqueda_texto',
        () => db.productos.find({ ...base, $text: { $search: 'copas' } }), { requiereIndice: true }],
    ],
  },
  {
    nombre: 'pedidos',
    consultas: [
      ['—', 'Todos los documentos (sin filtro)', 'ninguno', () => db.pedidos.find()],
      ['6.2', 'Mis pedidos de un cliente', 'pedidos_de_usuario',
        () => db.pedidos.find({ usuarioId: CLIENTE._id }).sort({ creadoEn: -1 })],
      ['6.3', 'Pedido por número', 'numero_unico',
        () => db.pedidos.find({ numero: NUMERO })],
      ['adm', 'Pedidos pendientes, más nuevos primero', 'pedidos_por_estado',
        () => db.pedidos.find({ estadoPedido: 'pendiente' }).sort({ creadoEn: -1 }).limit(20)],
    ],
  },
  {
    nombre: 'usuarios',
    consultas: [
      ['—', 'Todos los documentos (sin filtro)', 'ninguno', () => db.usuarios.find()],
      ['cta', 'Iniciar sesión: usuario por email', 'email_unico',
        () => db.usuarios.find({ email: CLIENTE.email, activo: true })],
    ],
  },
];

// -----------------------------------------------------------------------------
// Medición
// -----------------------------------------------------------------------------
const resultados = [];
for (const c of COLECCIONES) {
  print(`\n=== ${c.nombre} (${db.getCollection(c.nombre).estimatedDocumentCount().toLocaleString('es-AR')} documentos)`);
  listar(c.nombre);

  eliminar(c.nombre);
  print('  índices eliminados →');
  listar(c.nombre);
  const sin = c.consultas.map(([, , , consulta, op = {}]) => (op.requiereIndice ? null : medir(consulta)));

  crear(c.nombre);
  print('  índices creados →');
  listar(c.nombre);
  const con = c.consultas.map(([, , , consulta]) => medir(consulta));

  c.consultas.forEach(([num, nombre, indice], i) => {
    const s = sin[i] ? `${String(sin[i].ms).padStart(4)} ms / ${String(sin[i].docs).padStart(7)} docs` : '  requiere el índice   ';
    print(`  ${num.padEnd(4)} ${nombre.padEnd(40)} sin: ${s}   con: ${String(con[i].ms).padStart(4)} ms / ${String(con[i].docs).padStart(7)} docs   usó: ${con[i].usado}`);
    resultados.push({ num, nombre, coleccion: c.nombre, indice, sin: sin[i], con: con[i] });
  });
}

print('\n\n| Consulta | Colección | Índice previsto | Índice que usó MongoDB | Sin índices | Con índices |');
print('|---|---|---|---|---|---|');
const celda = (r) => (r ? `${r.ms} ms · ${r.docs.toLocaleString('es-AR')} docs` : 'requiere el índice');
for (const r of resultados) {
  print(`| ${r.num} ${r.nombre} | \`${r.coleccion}\` | \`${r.indice}\` | ${r.con.usado} | ${celda(r.sin)} | ${celda(r.con)} |`);
}
