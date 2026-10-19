const { test } = require('node:test');
const assert = require('node:assert/strict');
const { baseDePrueba } = require('./ayuda');
const { generarProductos: generar } = require('../scripts/generar-productos');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const datos = require('../src/datos/ejemplo');
const { obtenerCatalogo } = require('../src/servicios/paginas');
const { obtenerDetalle } = require('../src/servicios/productos');

test('volumen: conserva datos, admite reintentos y actualiza el catálogo con productos navegables', async () => {
  const entorno = await baseDePrueba('volumen');
  const { db } = entorno;
  const directorioImagenes = await fs.mkdtemp(path.join(os.tmpdir(), 'vinoteca-imagenes-'));
  const generarProductos = (base, opciones) => generar(base, { ...opciones, directorioImagenes });
  const archivo = (ruta) => path.join(directorioImagenes, ruta.replace('/img/productos/volumen/', ''));
  try {
    const originales = await db.collection('productos').find({}).sort({ sku: 1 }).toArray();
    const pedidosAntes = await db.collection('pedidos').countDocuments();
    const usuario = await db.collection('usuarios').findOne({ email: 'ana@example.com' });
    const propietario = { usuarioId: usuario._id };
    await obtenerCatalogo(db, propietario);

    assert.deepEqual(await generarProductos(db, { cantidad: 30, lote: 7, imagenesCompartidas: true }), { insertados: 30, total: 55 });
    assert.deepEqual(await fs.readdir(directorioImagenes), []);
    const compartidos = await db.collection('productos').find({ sku: /^VOL-/ }).sort({ sku: 1 }).toArray();
    assert.equal(new Set(compartidos.map((p) => p.imagenes[0])).size, 8);
    assert.equal((await obtenerCatalogo(db, propietario)).paginacion.totalProductos, 54);
    assert.deepEqual(await generarProductos(db, { cantidad: 30, lote: 7 }), { insertados: 0, total: 55 });
    const pagina = await obtenerCatalogo(db, propietario);
    assert.equal(pagina.paginacion.totalProductos, 54);
    const generados = await db.collection('productos').find({ sku: /^VOL-/ }).toArray();
    assert.equal(generados.length, 30);
    assert.equal(new Set(generados.map((p) => p.sku)).size, 30);
    assert.equal(new Set(generados.map((p) => p.imagenes[0])).size, 30);
    const plantillas = datos.productos.filter((p) => p.activo !== false);
    for (const producto of generados) {
      const detalle = await obtenerDetalle(db, producto._id);
      assert.ok(detalle);
      assert.ok(detalle.imagenes[0]);
      assert.equal(detalle.precio._bsontype, 'Decimal128');
      if (detalle.bodegaId) assert.ok(detalle.bodega);
      const numero = Number(producto.sku.slice(4));
      const original = path.join(__dirname, '..', 'public', plantillas[(numero - 1) % plantillas.length].imagen);
      assert.deepEqual(await fs.readFile(archivo(producto.imagenes[0])), await fs.readFile(original));
      assert.notEqual((await fs.stat(archivo(producto.imagenes[0]))).ino, (await fs.stat(original)).ino);
    }
    const filtrado = await obtenerCatalogo(db, propietario, { texto: 'muestra' });
    assert.equal(filtrado.paginacion.totalProductos, 30);
    assert.ok(filtrado.productos.every((p) => p.imagen));

    // Un reintento no sobrescribe cambios hechos sobre un producto ya generado.
    await db.collection('productos').updateOne({ sku: 'VOL-0000001' }, { $set: { stockActual: 999 } });
    const primero = await db.collection('productos').findOne({ sku: 'VOL-0000001' });
    const rutaPrimero = archivo(primero.imagenes[0]);
    const imagenAntes = await fs.stat(rutaPrimero);
    // Simula un producto de la versión anterior y un archivo perdido durante una carga parcial.
    await db.collection('productos').updateOne({ sku: primero.sku }, { $set: { imagenes: [plantillas[0].imagen] } });
    const segundo = await db.collection('productos').findOne({ sku: 'VOL-0000002' });
    await fs.unlink(archivo(segundo.imagenes[0]));
    assert.deepEqual(await generarProductos(db, { cantidad: 30, lote: 11 }), { insertados: 0, total: 55 });
    const reintentado = await db.collection('productos').findOne({ sku: 'VOL-0000001' });
    assert.equal(reintentado.stockActual, 999);
    assert.deepEqual(reintentado.imagenes, primero.imagenes);
    assert.equal((await fs.stat(rutaPrimero)).mtimeMs, imagenAntes.mtimeMs);
    await fs.access(archivo(segundo.imagenes[0]));
    assert.deepEqual(await generarProductos(db, { cantidad: 35 }), { insertados: 5, total: 60 });
    assert.deepEqual(await db.collection('productos').find({ sku: { $not: /^VOL-/ } }).sort({ sku: 1 }).toArray(), originales);
    assert.equal(await db.collection('pedidos').countDocuments(), pedidosAntes);

    // Cambiar de modo vuelve a compartir las imágenes, conserva archivos y respeta personalizaciones.
    await db.collection('productos').updateOne({ sku: 'VOL-0000035' }, { $set: { imagenes: ['/img/personalizada.svg'] } });
    const antesDeCompartir = await db.collection('productos').find({ sku: /^VOL-/ }).sort({ sku: 1 }).toArray();
    assert.deepEqual(await generarProductos(db, { cantidad: 35, imagenesCompartidas: true }), { insertados: 0, total: 60 });
    const despuesDeCompartir = await db.collection('productos').find({ sku: /^VOL-/ }).sort({ sku: 1 }).toArray();
    for (let i = 0; i < despuesDeCompartir.length; i++) {
      const { imagenes, ...resto } = despuesDeCompartir[i];
      const { imagenes: imagenesAnteriores, ...restoAnterior } = antesDeCompartir[i];
      assert.deepEqual(resto, restoAnterior);
      assert.deepEqual(imagenes, i === 34 ? ['/img/personalizada.svg'] : [plantillas[i % plantillas.length].imagen]);
      await fs.access(archivo(imagenesAnteriores[0] === '/img/personalizada.svg'
        ? '/img/productos/volumen/000/VOL-0000035.svg' : imagenesAnteriores[0]));
    }
    const paginaCompartida = await obtenerCatalogo(db, propietario);
    assert.ok(paginaCompartida.productos.every((p) => !p.imagen.includes('/volumen/')));

    await assert.rejects(generarProductos(db, { cantidad: 0 }), /enteros positivos/);
    await assert.rejects(generarProductos(db, { cantidad: 1.5 }), /enteros positivos/);
    await db.collection('categorias').updateOne({ slug: 'vinos' }, { $set: { activa: false } });
    await assert.rejects(generarProductos(db, { cantidad: 40 }), /Faltan categorías/);
    assert.equal(await db.collection('productos').countDocuments(), 60);
  } finally {
    await entorno.cerrar();
    await fs.rm(directorioImagenes, { recursive: true, force: true });
  }
});
