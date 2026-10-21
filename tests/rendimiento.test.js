const { test } = require('node:test');
const assert = require('node:assert/strict');
const { baseDePrueba } = require('./ayuda');
const { buscarIndices, definicionIndice, comparar, informe } = require('../scripts/medir-rendimiento');

test('rendimiento descubre índices reales, respeta opciones y no altera el origen', async () => {
  const entorno = await baseDePrueba('medicion_indices');
  const { db } = entorno;
  const temporal = db.client.db(`${db.databaseName}_rendimiento`);
  try {
    await db.collection('productos').dropIndex('sku_unico');
    await db.collection('productos').createIndex({ sku: 1 }, { name: 'codigo_manual', unique: true });
    await db.collection('productos').createIndex({ tipoProducto: 1 }, { name: 'tipo_manual' });
    await db.collection('productos').createIndex({ stockActual: 1 }, { name: 'oculto', hidden: true });
    await db.collection('usuarios').createIndex({ nombre: 1 }, { name: 'nombre_es', collation: { locale: 'es', strength: 1 } });
    await db.collection('eventos').createIndex({ fecha: 1 }, { name: 'expiracion', expireAfterSeconds: 60 });
    const antes = await buscarIndices(db);
    const productosAntes = await db.collection('productos').find().sort({ _id: 1 }).toArray();

    const resultado = await comparar(db, temporal, { productos: 300, pedidos: 40, conservar: true });
    const copiados = await buscarIndices(temporal);
    for (const indice of antes.filter(i => !i.motivo)) {
      const copia = copiados.find(i => i.coleccion === indice.coleccion && i.name === indice.name);
      assert.ok(copia, `${indice.coleccion}.${indice.name}`);
      assert.deepEqual(definicionIndice(copia), definicionIndice(indice));
    }
    assert.ok(!copiados.some(i => i.name === 'oculto' || i.name === 'expiracion' || i.name === 'sku_unico'));
    assert.ok(copiados.some(i => i.name === 'tipo_manual'));
    const sku = resultado.filas.find(f => f.nombre === 'Producto por SKU');
    assert.equal(sku.sin.devueltos, 1);
    assert.match(sku.sin.plan, /COLLSCAN/);
    assert.ok(sku.con.indices.includes('codigo_manual'));
    for (const fila of resultado.filas.filter(f => f.sin)) {
      assert.deepEqual(fila.sin.indices, []);
      assert.equal(fila.sin.devueltos, fila.con.devueltos);
    }
    assert.equal(resultado.filas.find(f => f.nombre.startsWith('Búsqueda $text')).sin, null);
    assert.match(informe(resultado), /No aplica: \$text exige índice/);
    assert.match(informe(resultado), /tipo_manual/);
    assert.deepEqual(await buscarIndices(db), antes);
    assert.deepEqual(await db.collection('productos').find().sort({ _id: 1 }).toArray(), productosAntes);
    await assert.rejects(comparar(db, db), /distinta del origen/);
    await assert.rejects(comparar(db, temporal, { productos: -1 }), /enteros positivos/);
  } finally {
    await temporal.dropDatabase();
    await entorno.cerrar();
  }
});

test('rendimiento admite un solo producto y pedido, elimina la temporal y tolera no tener texto', async () => {
  const entorno = await baseDePrueba('medicion_minima');
  const { db } = entorno;
  const temporal = db.client.db(`${db.databaseName}_rendimiento`);
  try {
    await db.collection('productos').dropIndex('busqueda_texto');
    const resultado = await comparar(db, temporal, { productos: 1, pedidos: 1 });
    assert.ok(!resultado.filas.some(f => !f.sin));
    assert.equal(resultado.filas.find(f => f.nombre === 'Producto por SKU').con.devueltos, 1);
    assert.deepEqual(await temporal.listCollections().toArray(), []);
  } finally {
    await temporal.dropDatabase();
    await entorno.cerrar();
  }
});
