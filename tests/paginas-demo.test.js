const { test } = require('node:test');
const assert = require('node:assert/strict');
const { baseDePrueba } = require('./ayuda');
const { cargarPaginas, PERFILES, PASSWORD } = require('../scripts/cargar-usuarios-personalizados');
const { autenticar } = require('../src/servicios/usuarios');
const { obtenerInicio, obtenerCatalogo } = require('../src/servicios/paginas');
const { actualizarProducto } = require('../src/servicios/productos');
const { alCambiarCategoria } = require('../src/servicios/sincronizacion');
const { aNumero } = require('../src/util/dinero');

test('cinco cuentas con páginas distintas, repetibles y sincronizadas sin modificar cuentas ajenas', async () => {
  const entorno = await baseDePrueba('paginas_demo');
  const { db } = entorno;
  try {
    const usuariosAntes = await db.collection('usuarios').countDocuments();
    const productosAntes = await db.collection('productos').countDocuments();
    const ana = await db.collection('usuarios').findOne({ email: 'ana@example.com' });
    const inicioAna = await obtenerInicio(db, { usuarioId: ana._id });
    await obtenerCatalogo(db, { usuarioId: ana._id });
    const catalogoAna = await db.collection('catalogo').findOne({ 'usuario.usuarioId': ana._id });

    await db.collection('categorias').updateOne({ slug: 'espumantes' }, { $set: { activa: false } });
    await assert.rejects(cargarPaginas(db), /Falta la categoría/);
    assert.equal(await db.collection('usuarios').countDocuments(), usuariosAntes);
    await db.collection('categorias').updateOne({ slug: 'espumantes' }, { $set: { activa: true } });

    const resultados = await cargarPaginas(db);
    assert.equal(resultados.length, 5);
    assert.equal(await db.collection('usuarios').countDocuments(), usuariosAntes + 5);
    assert.equal(await db.collection('productos').countDocuments(), productosAntes);
    assert.equal(await db.collection('inicio').countDocuments(), 6);
    assert.equal(await db.collection('catalogo').countDocuments(), 6);
    const idsInicio = new Set();
    const idsCatalogo = new Set();
    for (const perfil of PERFILES) {
      const usuario = await autenticar(db, perfil.email, PASSWORD);
      assert.ok(usuario);
      const inicio = await obtenerInicio(db, { usuarioId: usuario._id });
      const catalogo = await obtenerCatalogo(db, { usuarioId: usuario._id });
      assert.ok(inicio.productosDestacados.length > 0 && inicio.productosDestacados.length <= 4);
      assert.ok(catalogo.productos.length > 0);
      assert.deepEqual(new Set(inicio.productosDestacados.map((p) => String(p.productoId))), new Set(inicio.seleccionProductoIds.map(String)));
      for (const p of inicio.productosDestacados) {
        assert.ok(!idsInicio.has(String(p.productoId)));
        idsInicio.add(String(p.productoId));
      }
      for (const p of catalogo.productos) {
        assert.equal(p.categoria.slug, perfil.parametros.categoria);
        if (perfil.parametros.color) assert.equal(p.detalleVino.color, perfil.parametros.color);
        assert.ok(!idsCatalogo.has(String(p.productoId)));
        idsCatalogo.add(String(p.productoId));
      }
    }
    assert.deepEqual(await cargarPaginas(db), resultados);
    assert.equal(await db.collection('usuarios').countDocuments(), usuariosAntes + 5);
    assert.deepEqual(await db.collection('inicio').findOne({ _id: inicioAna._id }), inicioAna);
    assert.deepEqual(await db.collection('catalogo').findOne({ _id: catalogoAna._id }), catalogoAna);

    const blanco = await db.collection('inicio').findOne({ 'usuario.usuarioId': resultados[1].usuarioId });
    const productoId = blanco.productosDestacados[0].productoId;
    await actualizarProducto(db, productoId, { precio: 12345 });
    let actualizado = await obtenerInicio(db, { usuarioId: resultados[1].usuarioId });
    assert.equal(aNumero(actualizado.productosDestacados.find((p) => p.productoId.equals(productoId)).precio), 12345);
    assert.ok(actualizado.productosDestacados.every((p) => blanco.seleccionProductoIds.some((id) => id.equals(p.productoId))));
    await actualizarProducto(db, productoId, { stockActual: 0 });
    actualizado = await obtenerInicio(db, { usuarioId: resultados[1].usuarioId });
    assert.ok(!actualizado.productosDestacados.some((p) => p.productoId.equals(productoId)));
    await actualizarProducto(db, productoId, { stockActual: 10 });
    assert.ok((await obtenerInicio(db, { usuarioId: resultados[1].usuarioId })).productosDestacados.some((p) => p.productoId.equals(productoId)));

    await db.collection('categorias').updateOne({ slug: 'espumantes' }, { $set: { activa: false } });
    await alCambiarCategoria(db);
    const espumantes = { usuarioId: resultados[3].usuarioId };
    assert.equal((await obtenerInicio(db, espumantes)).productosDestacados.length, 0);
    assert.equal((await obtenerCatalogo(db, espumantes)).productos.length, 0);
  } finally {
    await entorno.cerrar();
  }
});
