// =============================================================================
// 05 · Verificación de la base
//
//  1. Cantidad de documentos y espacio por colección
//  2. Los validadores y los índices únicos rechazan documentos inválidos
//  3. Integridad de las referencias (MongoDB no tiene claves foráneas: se
//     controla juntando los _id referenciados y buscándolos con $in)
//
// Uso:  mongosh db/05_verificar.js
// =============================================================================

if (typeof CONFIG === 'undefined') load(__dirname + '/config.js');
if (typeof titulo === 'undefined') load(__dirname + '/utilidades.js');

{
db = db.getSiblingDB(CONFIG.dbName);
const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;
const COLECCIONES = ['productos', 'categorias', 'bodegas', 'usuarios', 'carritos', 'pedidos', 'configuracion_tienda', 'inicio', 'catalogo'];

// -----------------------------------------------------------------------------
titulo('05 · 1. Volumen');
print(`    ${'colección'.padEnd(22)}${'documentos'.padStart(12)}${'datos'.padStart(11)}${'en disco'.padStart(11)}${'índices'.padStart(11)}`);
for (const c of COLECCIONES) {
  const s = db.getCollection(c).aggregate([{ $collStats: { storageStats: {} } }]).toArray()[0].storageStats;
  print(`    ${c.padEnd(22)}${miles(db.getCollection(c).estimatedDocumentCount()).padStart(12)}${mb(s.size).padStart(11)}${mb(s.storageSize).padStart(11)}${mb(s.totalIndexSize).padStart(11)}`);
}

// -----------------------------------------------------------------------------
titulo('05 · 2. Validación de esquemas e índices únicos');
let fallas = 0;
const debeFallar = (descripcion, fn) => {
  try {
    fn();
    fallas++;
    print(`    ✗ SE ACEPTÓ: ${descripcion}`);
  } catch (e) {
    print(`    ✓ rechazado: ${descripcion}  (${e.codeName ?? e.code ?? 'error'})`);
  }
};
const { _id: _p, ...producto } = db.productos.findOne({ sku: 'VIN-MAL-RES' });
const { _id: _u, ...usuario } = db.usuarios.findOne({ email: 'ana@example.com' });
const { _id: _c, ...carrito } = db.carritos.findOne({ estado: 'activo' });
const { _id: _i, ...inicio } = db.inicio.findOne();
const { _id: _k, ...catalogo } = db.catalogo.findOne();
const { _id: _o, ...pedido } = db.pedidos.findOne();

debeFallar('producto con precio numérico en lugar de Decimal128', () => db.productos.insertOne({ ...producto, sku: 'PRUEBA-1', precio: 18500 }));
debeFallar('producto con tipoProducto inexistente', () => db.productos.insertOne({ ...producto, sku: 'PRUEBA-2', tipoProducto: 'cerveza' }));
debeFallar('producto sin sku (campo obligatorio)', () => { const { sku, ...sinSku } = producto; db.productos.insertOne(sinSku); });
debeFallar('pedido con estado inexistente', () => db.pedidos.insertOne({ ...pedido, numero: 'V-PRUEBA', estadoPedido: 'perdido' }));
debeFallar('SKU repetido (índice único sku_unico)', () => db.productos.insertOne({ ...producto }));
debeFallar('email repetido (índice único email_unico)', () => db.usuarios.insertOne({ ...usuario }));
debeFallar('segundo carrito activo del mismo usuario (índice parcial)', () => db.carritos.insertOne({ ...carrito }));
debeFallar('página de Inicio de un visitante (visitanteId)', () => db.inicio.insertOne({ ...inicio, visitanteId: 'abc', usuario: { usuarioId: new ObjectId() } }));
debeFallar('Catálogo que guarda copias de productos', () => db.catalogo.insertOne({ ...catalogo, usuario: { usuarioId: new ObjectId() }, productos: [] }));

// -----------------------------------------------------------------------------
titulo('05 · 3. Integridad de referencias');
const revisar = (descripcion, n) => {
  if (n) fallas++;
  print(`    ${n === 0 ? '✓' : '✗'} ${descripcion}: ${miles(n)} sin referencia válida`);
};
// $group junta los _id referenciados sin repetir; después se cuentan los que existen con $in.
const faltantes = (coleccion, campo, destino, previas = []) => {
  const ids = db.getCollection(coleccion).aggregate([...previas, { $match: { [campo]: { $exists: true } } }, { $group: { _id: `$${campo}` } }])
    .toArray().map((d) => d._id);
  return ids.length - db.getCollection(destino).countDocuments({ _id: { $in: ids } });
};
revisar('productos.categoriaId → categorias', faltantes('productos', 'categoriaId', 'categorias'));
revisar('productos.bodegaId → bodegas', faltantes('productos', 'bodegaId', 'bodegas'));
revisar('pedidos.usuarioId → usuarios', faltantes('pedidos', 'usuarioId', 'usuarios'));
revisar('pedidos.items.productoId → productos', faltantes('pedidos', 'items.productoId', 'productos', [{ $unwind: '$items' }]));
revisar('carritos.usuarioId → usuarios', faltantes('carritos', 'usuarioId', 'usuarios'));
revisar('carritos.items.productoId → productos', faltantes('carritos', 'items.productoId', 'productos', [{ $unwind: '$items' }]));
revisar('inicio.usuario.usuarioId → usuarios', faltantes('inicio', 'usuario.usuarioId', 'usuarios'));
revisar('catalogo.usuario.usuarioId → usuarios', faltantes('catalogo', 'usuario.usuarioId', 'usuarios'));

print(fallas ? `\n    ✗ ${fallas} controles fallaron` : '\n    ✓ Todos los controles pasaron');
}
