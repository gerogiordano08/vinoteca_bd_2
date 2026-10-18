// Medición del desempeño con y sin índices (clase "Índices y rendimiento": explain("executionStats")).
//
// Con 25 productos cualquier consulta es instantánea, así que la medición usa una base aparte
// (vinoteca_rendimiento) con volumen: 200.000 productos y 300.000 pedidos con la misma estructura
// del modelo. La base real no se toca. Los resultados se guardan en docs/implementacion/rendimiento.md.
//
// Uso: npm run rendimiento   (opcional: PRODUCTOS=50000 PEDIDOS=80000 npm run rendimiento)
const fs = require('node:fs');
const path = require('node:path');
const { MongoClient, ObjectId } = require('mongodb');
const config = require('../src/config');
const { aDecimal } = require('../src/util/dinero');

const CANT_PRODUCTOS = Number(process.env.PRODUCTOS) || 200000;
const CANT_PEDIDOS = Number(process.env.PEDIDOS) || 300000;
const CANT_USUARIOS = 20000;
const LOTE = 10000;

const VARIETALES = ['Malbec', 'Cabernet Sauvignon', 'Chardonnay', 'Bonarda', 'Syrah', 'Torrontés', 'Pinot Noir', 'Merlot'];
const COLORES = ['Tinto', 'Blanco', 'Rosado'];
const PALABRAS = ['reserva', 'clásico', 'joven', 'roble', 'altura', 'gran', 'especial', 'selección', 'cosecha', 'tardía'];

function azar(semilla) {
  let s = semilla;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

async function cargarVolumen(db) {
  const r = azar(7);
  await db.dropDatabase();
  const categorias = [new ObjectId(), new ObjectId(), new ObjectId()];
  const usuarios = Array.from({ length: CANT_USUARIOS }, () => new ObjectId());

  process.stdout.write(`Cargando ${CANT_PRODUCTOS} productos`);
  for (let i = 0; i < CANT_PRODUCTOS; i += LOTE) {
    const lote = [];
    for (let j = i; j < Math.min(i + LOTE, CANT_PRODUCTOS); j++) {
      const varietal = VARIETALES[Math.floor(r() * VARIETALES.length)];
      const palabra = PALABRAS[Math.floor(r() * PALABRAS.length)];
      lote.push({
        sku: `P-${String(j).padStart(7, '0')}`,
        nombre: `${varietal} ${palabra} ${j}`,
        descripcionCorta: `Vino ${palabra} de ejemplo número ${j}`,
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
  process.stdout.write(`\nCargando ${CANT_PEDIDOS} pedidos`);
  const inicio = new Date('2025-01-01').getTime();
  for (let i = 0; i < CANT_PEDIDOS; i += LOTE) {
    const lote = [];
    for (let j = i; j < Math.min(i + LOTE, CANT_PEDIDOS); j++) {
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
  const { usuarioId } = await db.collection('pedidos').findOne({}, { skip: 1234 });
  return { categoria: categorias[1], usuario: usuarioId };
}

/** Resumen de explain("executionStats"): plan ganador, documentos y claves examinados, tiempo. */
function resumir(explain) {
  const s = explain.executionStats;
  const etapas = [];
  (function recorrer(n) {
    if (!n) return;
    etapas.push(n.stage + (n.indexName ? ` (${n.indexName})` : ''));
    recorrer(n.inputStage);
    (n.inputStages || []).forEach(recorrer);
  })(explain.queryPlanner.winningPlan.queryPlan || explain.queryPlanner.winningPlan);
  return { plan: etapas.reverse().join(' → '), devueltos: s.nReturned, docsExaminados: s.totalDocsExamined, clavesExaminadas: s.totalKeysExamined, ms: s.executionTimeMillis };
}

async function medir(db, { coleccion, filtro, orden, limite = 0 }) {
  let cursor = db.collection(coleccion).find(filtro);
  if (orden) cursor = cursor.sort(orden);
  if (limite) cursor = cursor.limit(limite);
  // Se ejecuta dos veces y se toma la segunda, con los datos ya en memoria.
  await cursor.clone().explain('executionStats');
  return resumir(await cursor.explain('executionStats'));
}

(async () => {
  const cliente = new MongoClient(config.mongoUri);
  await cliente.connect();
  const db = cliente.db('vinoteca_rendimiento');
  try {
    const { categoria, usuario } = await cargarVolumen(db);

    const casos = [
      {
        nombre: 'Catálogo: productos activos de una categoría hasta $ 10.000, ordenados por precio',
        consulta: { coleccion: 'productos', filtro: { activo: true, categoriaId: categoria, precio: { $lte: aDecimal(10000) } }, orden: { precio: 1 }, limite: 12 },
        indice: { coleccion: 'productos', key: { activo: 1, categoriaId: 1, precio: 1 }, name: 'catalogo_categoria_precio' },
      },
      {
        nombre: 'Búsqueda por código: un producto por SKU (índice único, igual que email_unico al iniciar sesión)',
        consulta: { coleccion: 'productos', filtro: { sku: 'P-0123456' } },
        indice: { coleccion: 'productos', key: { sku: 1 }, name: 'sku_unico', unique: true },
      },
      {
        nombre: 'Mis pedidos: pedidos de un usuario, del más nuevo al más viejo',
        consulta: { coleccion: 'pedidos', filtro: { usuarioId: usuario }, orden: { creadoEn: -1 } },
        indice: { coleccion: 'pedidos', key: { usuarioId: 1, creadoEn: -1 }, name: 'pedidos_de_usuario' },
      },
      {
        nombre: 'Filtro del catálogo: todos los vinos rosados de Pinot Noir (subdocumento detalleVino)',
        consulta: { coleccion: 'productos', filtro: { 'detalleVino.color': 'Rosado', 'detalleVino.varietal': 'Pinot Noir' } },
        indice: { coleccion: 'productos', key: { 'detalleVino.color': 1, 'detalleVino.varietal': 1 }, name: 'filtro_color_varietal' },
      },
    ];

    const filas = [];
    for (const caso of casos) {
      const sin = await medir(db, caso.consulta);
      const { coleccion, key, ...opciones } = caso.indice;
      await db.collection(coleccion).createIndex(key, opciones);
      const con = await medir(db, caso.consulta);
      filas.push({ caso: caso.nombre, indice: caso.indice.name, sin, con });
      console.log(`\n${caso.nombre}\n  sin índice: ${sin.plan} · ${sin.docsExaminados} docs · ${sin.ms} ms\n  con ${caso.indice.name}: ${con.plan} · ${con.docsExaminados} docs · ${con.ms} ms`);
    }

    // Búsqueda: expresión regular sin índice de texto frente a $text con el índice busqueda_texto.
    const regex = await medir(db, { coleccion: 'productos', filtro: { nombre: { $regex: 'tardía', $options: 'i' } } });
    await db.collection('productos').createIndex({ nombre: 'text', descripcionCorta: 'text' }, { name: 'busqueda_texto', default_language: 'spanish' });
    const texto = await medir(db, { coleccion: 'productos', filtro: { $text: { $search: 'tardía' } } });
    filas.push({ caso: 'Búsqueda "tardía": $regex sin índice frente a $text con índice de texto', indice: 'busqueda_texto', sin: regex, con: texto });
    console.log(`\nBúsqueda de texto\n  $regex: ${regex.plan} · ${regex.docsExaminados} docs · ${regex.ms} ms\n  $text: ${texto.plan} · ${texto.docsExaminados} docs · ${texto.ms} ms`);

    const md = [
      '# Medición de rendimiento con índices',
      '',
      `Generado por \`npm run rendimiento\` el ${new Date().toLocaleString('es-AR')}, sobre MongoDB ${(await db.admin().serverInfo()).version}.`,
      `Base de prueba \`vinoteca_rendimiento\`: ${CANT_PRODUCTOS.toLocaleString('es-AR')} productos y ${CANT_PEDIDOS.toLocaleString('es-AR')} pedidos con la estructura del modelo.`,
      'Cada consulta se ejecuta con `explain("executionStats")` antes y después de crear el índice. Los tiempos dependen del equipo; lo importante es la cantidad de documentos examinados y el plan.',
      '',
      '| Consulta | Índice | Plan sin índice | Docs examinados | ms | Plan con índice | Docs examinados | Claves examinadas | ms |',
      '| --- | --- | --- | ---: | ---: | --- | ---: | ---: | ---: |',
      ...filas.map((f) => `| ${f.caso} | \`${f.indice}\` | ${f.sin.plan} | ${f.sin.docsExaminados.toLocaleString('es-AR')} | ${f.sin.ms} | ${f.con.plan} | ${f.con.docsExaminados.toLocaleString('es-AR')} | ${f.con.clavesExaminadas.toLocaleString('es-AR')} | ${f.con.ms} |`),
      '',
      '**Cómo leerlo.** `COLLSCAN` recorre toda la colección; `IXSCAN` recorre solo las entradas del índice que cumplen el filtro y después `FETCH` trae esos documentos. Cuando el índice también resuelve el orden, desaparece la etapa `SORT` en memoria.',
      '',
    ].join('\n');
    const salida = path.join(__dirname, '..', 'docs', 'implementacion', 'rendimiento.md');
    fs.mkdirSync(path.dirname(salida), { recursive: true });
    fs.writeFileSync(salida, md);
    console.log(`\nResultados en ${path.relative(process.cwd(), salida)}`);
  } finally {
    if (!process.env.CONSERVAR) await db.dropDatabase();
    await cliente.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
