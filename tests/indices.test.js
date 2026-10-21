const { test } = require('node:test');
const assert = require('node:assert/strict');
const { baseDePrueba } = require('./ayuda');
const { prepararIndices } = require('../src/db/preparar-indices');

test('migra índices sin modificar documentos, conserva índices ajenos y admite reintentos', async () => {
  const entorno = await baseDePrueba('indices');
  const { db } = entorno;
  try {
    const antiguos = [
      ['productos', 'catalogo_categoria_precio', { activo: 1, categoriaId: 1, precio: 1 }],
      ['carritos', 'carritos_por_producto', { 'items.productoId': 1 }],
      ['inicio', 'inicio_por_producto', { 'productosDestacados.productoId': 1 }],
      ['inicio', 'inicio_por_categoria', { 'categorias.categoriaId': 1 }],
      ['catalogo', 'catalogo_por_categoria', { 'categorias.categoriaId': 1 }],
    ];
    for (const [nombre, name, key] of antiguos) await db.collection(nombre).createIndex(key, { name });
    await db.collection('productos').createIndex({ tipoProducto: 1 }, { name: 'indice_manual' });
    const nombres = (await db.listCollections({}, { nameOnly: true }).toArray()).map(c => c.name);
    const datosAntes = {};
    const unicosAntes = {};
    for (const nombre of nombres) {
      datosAntes[nombre] = await db.collection(nombre).find().sort({ _id: 1 }).toArray();
      unicosAntes[nombre] = (await db.collection(nombre).indexes()).filter(i => i.unique);
    }
    await prepararIndices(db);
    await prepararIndices(db);
    for (const [nombre, name] of antiguos) {
      assert.ok(!(await db.collection(nombre).indexes()).some(i => i.name === name));
    }
    assert.ok((await db.collection('productos').indexes()).some(i => i.name === 'indice_manual'));
    assert.ok((await db.collection('pedidos').indexes()).some(i => i.name === 'pedidos_por_estado'));
    for (const nombre of nombres) {
      assert.deepEqual(await db.collection(nombre).find().sort({ _id: 1 }).toArray(), datosAntes[nombre]);
      assert.deepEqual((await db.collection(nombre).indexes()).filter(i => i.unique), unicosAntes[nombre]);
    }

    // Los tres índices pueden resolver el orden completo para una categoría concreta.
    const categoria = await db.collection('categorias').findOne({ slug: 'vinos' });
    const casos = [
      ['catalogo_categoria_nombre', { nombre: 1, _id: 1 }],
      ['catalogo_categoria_destacados', { destacado: -1, nombre: 1, _id: 1 }],
      ['catalogo_categoria_precio_asc', { precio: 1, nombre: 1, _id: 1 }],
    ];
    for (const [indice, orden] of casos) {
      const e = await db.collection('productos').find({ activo: true, categoriaId: categoria._id }).sort(orden).limit(12).hint(indice).explain('executionStats');
      const etapas = [];
      function recorrer(n) {
        if (!n || typeof n !== 'object') return;
        if (n.stage) etapas.push(n.stage);
        Object.values(n).forEach(v => { if (v && typeof v === 'object') recorrer(v); });
      }
      recorrer(e.queryPlanner.winningPlan);
      assert.ok(!etapas.includes('SORT'), `${indice} requiere ordenar aparte`);
      assert.equal(e.executionStats.nReturned, 12);
    }

    // No elimina por nombre un índice que alguien redefinió con otros campos.
    await db.collection('inicio').createIndex({ 'presentacion.titulo': 1 }, { name: 'inicio_por_producto' });
    await assert.rejects(prepararIndices(db), /definición diferente/);
    assert.ok((await db.collection('inicio').indexes()).some(i => i.name === 'inicio_por_producto'));
  } finally {
    await entorno.cerrar();
  }
});
