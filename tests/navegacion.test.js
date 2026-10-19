const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { baseDePrueba } = require('./ayuda');
const { conectar, desconectar } = require('../src/db/conexion');
const { crearApp } = require('../src/app');
const { prepararBase } = require('../src/db/preparar');

test('navegación pública, sesión registrada y sesión de un usuario eliminado', async () => {
  const entorno = await baseDePrueba('navegacion');
  const { db } = entorno;
  let servidor;
  try {
    await conectar(db.databaseName);
    servidor = crearApp().listen(0, '127.0.0.1');
    await once(servidor, 'listening');
    const base = `http://127.0.0.1:${servidor.address().port}`;
    const usuariosAntes = await db.collection('usuarios').countDocuments();
    for (const ruta of ['/', '/catalogo?orden=nombre_asc&pagina=2']) {
      const respuesta = await fetch(base + ruta);
      assert.equal(respuesta.status, 200);
      assert.ok((await respuesta.text()).includes('Malbec'));
    }
    assert.equal(await db.collection('inicio').countDocuments(), 0);
    assert.equal(await db.collection('catalogo').countDocuments(), 0);
    assert.equal(await db.collection('usuarios').countDocuments(), usuariosAntes);

    const ingreso = await fetch(`${base}/cuenta/ingresar`, {
      method: 'POST', redirect: 'manual',
      body: new URLSearchParams({ email: 'ana@example.com', password: 'vinoteca123' }),
    });
    assert.equal(ingreso.status, 302);
    const cookie = ingreso.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
    assert.ok(cookie.includes('vinoteca.sid='));
    await ingreso.text();
    for (const ruta of ['/', '/catalogo?orden=nombre_asc&pagina=2']) {
      const respuesta = await fetch(base + ruta, { headers: { Cookie: cookie } });
      assert.equal(respuesta.status, 200);
      await respuesta.text();
    }
    const ana = await db.collection('usuarios').findOne({ email: 'ana@example.com' });
    for (const nombre of ['inicio', 'catalogo']) {
      const pagina = await db.collection(nombre).findOne({ 'usuario.usuarioId': ana._id });
      assert.ok(pagina);
      assert.equal(pagina.visitanteId, undefined);
    }
    assert.equal((await db.collection('catalogo').findOne({ 'usuario.usuarioId': ana._id })).paginacion.paginaActual, 2);

    await db.collection('usuarios').deleteOne({ _id: ana._id });
    await prepararBase(db);
    for (const ruta of ['/', '/catalogo']) {
      const respuesta = await fetch(base + ruta, { headers: { Cookie: cookie } });
      assert.equal(respuesta.status, 200);
      await respuesta.text();
    }
    assert.equal(await db.collection('inicio').countDocuments(), 0);
    assert.equal(await db.collection('catalogo').countDocuments(), 0);
  } finally {
    if (servidor) await new Promise((resolver, rechazar) => servidor.close((error) => error ? rechazar(error) : resolver()));
    await desconectar();
    await entorno.cerrar();
  }
});
