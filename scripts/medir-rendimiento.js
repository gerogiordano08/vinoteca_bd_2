// Medición del desempeño con y sin índices (clase "Índices y rendimiento": explain("executionStats")).
//
// Con 25 productos cualquier consulta es instantánea, así que la medición usa una base aparte
// (vinoteca_rendimiento) con volumen: 200.000 productos y 300.000 pedidos con la misma estructura
// del modelo. Lee los índices reales y los reproduce en la base temporal; el origen solo se lee.
//
// Uso: npm run rendimiento   (opcional: PRODUCTOS=50000 PEDIDOS=80000 npm run rendimiento)
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient, ObjectId } = require('mongodb');
const config = require('../src/config');
const { aDecimal } = require('../src/util/dinero');

const CANT_USUARIOS = 20000;
const LOTE = 10000;

const VARIETALES = ['Malbec', 'Cabernet Sauvignon', 'Chardonnay', 'Bonarda', 'Syrah', 'Torrontés', 'Pinot Noir', 'Merlot'];
const COLORES = ['Tinto', 'Blanco', 'Rosado'];
const PALABRAS = ['reserva', 'clásico', 'joven', 'roble', 'altura', 'gran', 'especial', 'selección', 'cosecha', 'tardía'];

function azar(semilla) {
  let s = semilla;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

function cantidad(valor, defecto) {
  const n = valor === undefined ? defecto : Number(valor);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error('Las cantidades deben ser enteros positivos.');
  return n;
}

async function cargarVolumen(db, productos, pedidos) {
  const r = azar(7);
  await db.dropDatabase();
  const categorias = [new ObjectId(), new ObjectId(), new ObjectId()];
  const usuarios = Array.from({ length: CANT_USUARIOS }, () => new ObjectId());
  const bodegas = Array.from({ length: 30 }, () => new ObjectId());
  await db.collection('categorias').insertMany(categorias.map((_id, i) => ({ _id, slug: `categoria-${i}`, nombre: `Categoría ${i}` })));
  await db.collection('bodegas').insertMany(bodegas.map((_id, i) => ({ _id, nombre: `Bodega ${i}` })));
  await db.collection('usuarios').insertMany(usuarios.map((_id, i) => ({ _id, email: `usuario${i}@prueba.invalid`, nombre: `Usuario ${i}` })));
  await db.collection('carritos').insertMany(usuarios.map(usuarioId => ({ usuarioId, estado: 'activo', items: [] })));
  for (const nombre of ['inicio', 'catalogo']) {
    await db.collection(nombre).insertMany(usuarios.map(usuarioId => ({ usuario: { usuarioId, nombre: 'Usuario de prueba' } })));
  }

  process.stdout.write(`Cargando ${productos} productos`);
  for (let i = 0; i < productos; i += LOTE) {
    const lote = [];
    for (let j = i; j < Math.min(i + LOTE, productos); j++) {
      const varietal = VARIETALES[Math.floor(r() * VARIETALES.length)];
      const palabra = PALABRAS[Math.floor(r() * PALABRAS.length)];
      lote.push({
        sku: `P-${String(j).padStart(7, '0')}`,
        nombre: `${varietal} ${palabra} ${j}`,
        descripcionCorta: `Vino ${palabra} de ejemplo número ${j}`,
        descripcion: `Descripción del vino ${varietal} ${palabra}`,
        bodegaId: bodegas[j % bodegas.length],
        precio: aDecimal(3000 + Math.floor(r() * 47000)),
        categoriaId: categorias[Math.floor(r() * 3)],
        tipoProducto: 'vino',
        stockActual: Math.floor(r() * 60),
        destacado: r() < 0.01,
        activo: r() < 0.95,
        detalleVino: { color: COLORES[Math.floor(r() * 3)], varietal, contenidoMl: 750 },
      });
    }
    await db.collection('productos').insertMany(lote, { ordered: false });
    process.stdout.write('.');
  }
  process.stdout.write(`\nCargando ${pedidos} pedidos`);
  const inicio = new Date('2025-01-01').getTime();
  for (let i = 0; i < pedidos; i += LOTE) {
    const lote = [];
    for (let j = i; j < Math.min(i + LOTE, pedidos); j++) {
      lote.push({
        numero: `V-${100000 + j}`,
        usuarioId: usuarios[Math.floor(r() * CANT_USUARIOS)],
        items: [{ productoId: new ObjectId(), nombre: 'x', precioUnitario: aDecimal(10000), cantidad: 1, subtotal: aDecimal(10000) }],
        total: aDecimal(10000 + Math.floor(r() * 50000)),
        estadoPedido: ['pendiente', 'confirmado', 'entregado', 'cancelado'][Math.floor(r() * 4)],
        creadoEn: new Date(inicio + Math.floor(r() * 650) * 86400000),
      });
    }
    await db.collection('pedidos').insertMany(lote, { ordered: false });
    process.stdout.write('.');
  }
  process.stdout.write('\n');
  // Un usuario que efectivamente tiene pedidos.
  const { usuarioId } = await db.collection('pedidos').findOne({}, { skip: Math.min(1234, pedidos - 1) });
  return { categoria: categorias[1], usuario: usuarioId, bodega: bodegas[0], sku: `P-${String(Math.min(123456, productos - 1)).padStart(7, '0')}` };
}

/** Resumen de explain("executionStats"): plan ganador, documentos y claves examinados, tiempo. */
function resumir(explain) {
  const s = explain.executionStats;
  const etapas = [];
  const indices = new Set();
  (function recorrer(n) {
    if (!n || typeof n !== 'object') return;
    if (n.stage) etapas.push(n.stage + (n.indexName ? ` (${n.indexName})` : ''));
    if (n.indexName) indices.add(n.indexName);
    Object.values(n).forEach(v => { if (v && typeof v === 'object') recorrer(v); });
  })(explain.queryPlanner.winningPlan.queryPlan || explain.queryPlanner.winningPlan);
  return { plan: etapas.reverse().join(' → '), indices: [...indices], devueltos: s.nReturned, docsExaminados: s.totalDocsExamined, clavesExaminadas: s.totalKeysExamined, ms: s.executionTimeMillis };
}

async function medir(db, { coleccion, filtro, orden, limite = 0 }) {
  let cursor = db.collection(coleccion).find(filtro);
  if (orden) cursor = cursor.sort(orden);
  if (limite) cursor = cursor.limit(limite);
  // Se ejecuta dos veces y se toma la segunda, con los datos ya en memoria.
  await cursor.clone().explain('executionStats');
  return resumir(await cursor.explain('executionStats'));
}

// listIndexes devuelve los campos de texto como _fts/_ftsx, no como createIndex los recibe.
function definicionIndice(indice) {
  const key = {};
  for (const [campo, valor] of Object.entries(indice.key)) {
    if (campo === '_fts') {
      for (const texto of Object.keys(indice.weights)) key[texto] = 'text';
    } else if (campo !== '_ftsx') key[campo] = valor;
  }
  const opciones = {};
  for (const campo of ['name', 'unique', 'sparse', 'partialFilterExpression', 'collation',
    'weights', 'default_language', 'language_override', 'textIndexVersion',
    '2dsphereIndexVersion', 'bits', 'min', 'max', 'bucketSize', 'wildcardProjection']) {
    if (indice[campo] !== undefined) opciones[campo] = indice[campo];
  }
  return { key, opciones };
}

async function buscarIndices(db) {
  const inventario = [];
  for (const { name, type } of await db.listCollections().toArray()) {
    if (type !== 'collection' || name.startsWith('system.')) continue;
    for (const indice of await db.collection(name).indexes()) {
      const motivo = indice.name === '_id_' ? 'Automático; se conserva en ambas mediciones'
        : indice.hidden ? 'Oculto; no participa en consultas'
          : indice.buildUUID ? 'En construcción'
            : indice.expireAfterSeconds !== undefined ? 'TTL; no se reproduce para evitar borrar datos de prueba' : null;
      inventario.push({ coleccion: name, ...indice, motivo });
    }
  }
  return inventario;
}

function crearCasos({ categoria, usuario, bodega, sku }) {
  const casos = [];
  const agregar = (nombre, coleccion, filtro, orden, limite = 0) => casos.push({ nombre, consulta: { coleccion, filtro, orden, limite } });
  const filtro = { activo: true, categoriaId: categoria };
  agregar('Catálogo por nombre', 'productos', filtro, { nombre: 1, _id: 1 }, config.productosPorPagina);
  agregar('Catálogo por destacados', 'productos', filtro, { destacado: -1, nombre: 1, _id: 1 }, config.productosPorPagina);
  agregar('Catálogo por precio ascendente hasta $10.000', 'productos', { ...filtro, precio: { $lte: aDecimal(10000) } }, { precio: 1, nombre: 1, _id: 1 }, config.productosPorPagina);
  agregar('Catálogo por precio descendente', 'productos', filtro, { precio: -1, nombre: 1, _id: 1 }, config.productosPorPagina);
  agregar('Producto por SKU', 'productos', { sku });
  agregar('Inicio: destacados con stock', 'productos', { destacado: true, activo: true, stockActual: { $gt: 0 } }, { nombre: 1 }, config.maximoDestacados);
  agregar('Vinos rosados Pinot Noir', 'productos', { 'detalleVino.color': 'Rosado', 'detalleVino.varietal': 'Pinot Noir' });
  agregar('Productos de una bodega', 'productos', { bodegaId: bodega });
  agregar('Búsqueda por regex (misma consulta en ambas mediciones)', 'productos', { nombre: { $regex: 'tardía', $options: 'i' } });
  agregar('Pedidos de un usuario', 'pedidos', { usuarioId: usuario }, { creadoEn: -1 });
  agregar('Pedidos confirmados recientes', 'pedidos', { estadoPedido: 'confirmado' }, { creadoEn: -1 }, 20);
  agregar('Pedido por número', 'pedidos', { numero: 'V-100000' });
  agregar('Categoría por slug', 'categorias', { slug: 'categoria-1' });
  agregar('Bodega por nombre', 'bodegas', { nombre: 'Bodega 0' });
  agregar('Usuario por email', 'usuarios', { email: 'usuario0@prueba.invalid' });
  agregar('Carrito activo del usuario', 'carritos', { usuarioId: usuario, estado: 'activo' });
  for (const coleccion of ['inicio', 'catalogo']) agregar(`Página ${coleccion} del usuario`, coleccion, { 'usuario.usuarioId': usuario });
  return casos;
}

async function comparar(dbOrigen, db, { productos = 200000, pedidos = 300000, conservar = false } = {}) {
  // La base temporal se borra: rechazar nombres que puedan apuntar al origen antes de tocarla.
  if (db.databaseName === dbOrigen.databaseName || !db.databaseName.endsWith('_rendimiento')) {
    throw new Error('La base temporal debe ser distinta del origen y terminar en _rendimiento.');
  }
  productos = cantidad(productos);
  pedidos = cantidad(pedidos);
  const inventario = await buscarIndices(dbOrigen);
  if (!inventario.length) throw new Error('La base de origen no tiene colecciones con índices. Inicializala antes de medir.');
  let iniciada = false;
  try {
    iniciada = true;
    const datos = await cargarVolumen(db, productos, pedidos);
    const casos = crearCasos(datos);
    const filas = [];
    // Todas las consultas primero SIN índices secundarios; después se crea el conjunto completo.
    for (const caso of casos) filas.push({ ...caso, sin: await medir(db, caso.consulta) });
    for (const indice of inventario.filter(i => !i.motivo)) {
      const { key, opciones } = definicionIndice(indice);
      try {
        await db.collection(indice.coleccion).createIndex(key, opciones);
      } catch (error) {
        throw new Error(`No se pudo reproducir ${indice.coleccion}.${indice.name}: ${error.message}`, { cause: error });
      }
    }
    for (const fila of filas) {
      fila.con = await medir(db, fila.consulta);
      if (fila.sin.devueltos !== fila.con.devueltos) throw new Error(`Cambió la cantidad de resultados: ${fila.nombre}`);
    }
    // $text exige índice: no se puede presentar una regex como su equivalente sin índice.
    const texto = inventario.find(i => !i.motivo && i.coleccion === 'productos' && i.weights);
    if (texto) {
      const prefijos = Object.keys(texto.key).slice(0, Object.keys(texto.key).indexOf('_fts'));
      const filtro = { $text: { $search: 'tardía' } };
      const muestra = await db.collection('productos').findOne();
      for (const campo of prefijos) {
        const valor = campo.split('.').reduce((v, c) => v?.[c], muestra);
        if (valor === undefined) throw new Error(`Falta un dato de prueba para el prefijo de texto ${campo}`);
        filtro[campo] = valor;
      }
      const consulta = { coleccion: 'productos', filtro };
      filas.push({ nombre: 'Búsqueda $text: tardía (requiere índice)', consulta, sin: null, con: await medir(db, consulta) });
    }
    return { origen: dbOrigen.databaseName, temporal: db.databaseName, productos, pedidos, inventario, filas };
  } finally {
    if (iniciada && !conservar) await db.dropDatabase();
  }
}

function informe({ origen, temporal, productos, pedidos, inventario, filas }) {
  const celda = valor => String(valor).replaceAll('|', '\\|').replaceAll('\n', ' ');
  return [
    '# Medición de rendimiento con índices', '',
    `Generado el ${new Date().toLocaleString('es-AR')}. Índices leídos de \`${origen}\` al iniciar la ejecución.`,
    `Base temporal: \`${temporal}\`, ${productos} productos y ${pedidos} pedidos sintéticos; además 20.000 usuarios, carritos y páginas, 3 categorías y 30 bodegas simplificadas (sin validadores). No copia documentos del origen.`,
    'Todas las consultas se miden primero solo con el índice automático `_id_`; luego se reproducen juntos los índices activos y MongoDB elige el plan, sin forzarlo con `hint`. Se ejecuta cada explain dos veces y se informa la segunda.',
    'Las consultas representan casos del proyecto y siguen definidas en el script; las definiciones y los nombres de los índices se consultan en MongoDB. Un índice nuevo puede no ser elegido. No se prueban restricciones de unicidad ni rendimiento de escrituras.', '',
    '| Consulta | Plan sin secundarios | Docs | Devueltos | ms | Plan con índices activos | Docs | Claves | Devueltos | ms |',
    '| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |',
    ...filas.map(f => `| ${celda(f.nombre)} | ${celda(f.sin?.plan || 'No aplica: $text exige índice')} | ${f.sin?.docsExaminados ?? '—'} | ${f.sin?.devueltos ?? '—'} | ${f.sin?.ms ?? '—'} | ${celda(f.con.plan)} | ${f.con.docsExaminados} | ${f.con.clavesExaminadas} | ${f.con.devueltos} | ${f.con.ms} |`), '',
    '## Inventario leído y cobertura', '',
    '| Colección | Índice | Definición leída | Estado en la prueba |',
    '| --- | --- | --- | --- |',
    ...inventario.map(i => {
      const usos = filas.filter(f => f.consulta.coleccion === i.coleccion && f.con.indices.includes(i.name)).map(f => f.nombre);
      return `| ${celda(i.coleccion)} | ${celda(i.name)} | ${celda(JSON.stringify({ key: i.key, ...definicionIndice(i).opciones }))} | ${celda(i.motivo || (usos.length ? `Elegido en: ${usos.join('; ')}` : 'Reproducido, no elegido por estas consultas; no demuestra que sea inútil'))} |`;
    }), '',
    '`COLLSCAN` recorre documentos; `IXSCAN` recorre entradas del índice; `FETCH` lee documentos y `SORT` ordena aparte. Los tiempos dependen del equipo y de los datos sintéticos: compará también documentos y claves examinados. Las colecciones pequeñas pueden preferir COLLSCAN.', '',
  ].join('\n');
}

async function main() {
  const productos = cantidad(process.env.PRODUCTOS, 200000);
  const pedidos = cantidad(process.env.PEDIDOS, 300000);
  const cliente = new MongoClient(config.mongoUri);
  try {
    await cliente.connect();
    const resultado = await comparar(cliente.db(config.baseDatos), cliente.db(`${config.baseDatos}_rendimiento`), {
      productos, pedidos, conservar: process.env.CONSERVAR === '1',
    });
    const salida = path.resolve(process.env.REPORTE || path.join(__dirname, '..', 'docs', 'implementacion', 'rendimiento.md'));
    fs.mkdirSync(path.dirname(salida), { recursive: true });
    fs.writeFileSync(salida, informe(resultado));
    console.log(`\nResultados en ${path.relative(process.cwd(), salida)}`);
  } finally {
    await cliente.close();
  }
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { buscarIndices, definicionIndice, comparar, informe };
