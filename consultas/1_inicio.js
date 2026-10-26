// =============================================================================
// Pantalla INICIO (src/vistas/inicio.ejs · src/servicios/paginas.js y resumenes.js)
// Uso:  mongosh consultas/1_inicio.js
// =============================================================================

if (typeof mostrar === 'undefined') load(__dirname + '/lib.js');

{
seccion('1 · INICIO');

// -----------------------------------------------------------------------------
// 1.1 Cabecera y pie: datos de la tienda (un único documento)
// -----------------------------------------------------------------------------
mostrar('1.1 Datos de la tienda', () =>
  db.configuracion_tienda.findOne({}, { _id: 0, nombreComercial: 1, logoUrl: 1, monedaBase: 1, telefonoContacto: 1, 'direccionComercial.horario': 1 })
);

// -----------------------------------------------------------------------------
// 1.2 Navegación: categorías activas, en el orden en que se cargaron
// -----------------------------------------------------------------------------
mostrar('1.2 Categorías del menú', () =>
  db.categorias.find({ activa: true }, { nombre: 1, slug: 1, descripcion: 1 }).sort({ _id: 1 })
);

// -----------------------------------------------------------------------------
// 1.3 "Una selección para empezar": hasta 4 destacados activos, con stock y de
// categoría activa, ordenados por nombre. $lookup trae la categoría y el
// segundo $match descarta las categorías desactivadas.
// -----------------------------------------------------------------------------
mostrar('1.3 Productos destacados', () =>
  db.productos.aggregate([
    { $match: { destacado: true, activo: true, stockActual: { $gt: 0 } } },
    { $lookup: { from: 'categorias', localField: 'categoriaId', foreignField: '_id', as: 'categoria' } },
    { $unwind: '$categoria' },
    { $match: { 'categoria.activa': true } },
    { $sort: { nombre: 1, _id: 1 } },
    { $limit: 4 },
    { $project: { _id: 0, nombre: 1, precio: 1, 'categoria.nombre': 1, 'detalleVino.color': 1 } },
  ])
);

// -----------------------------------------------------------------------------
// 1.4 Contador "Carrito (n)" de la cabecera: suma de cantidades del carrito activo
// -----------------------------------------------------------------------------
mostrar('1.4 Artículos en el carrito de Ana', () =>
  db.carritos.aggregate([
    { $match: { usuarioId: IDS.ana, estado: 'activo' } },
    { $project: { _id: 0, cantidadArticulos: { $sum: '$items.cantidad' } } },
  ])
);

// -----------------------------------------------------------------------------
// 1.5 Página guardada de un usuario registrado (colección inicio).
// Un documento por usuario (índice único inicio_por_usuario) con copias de
// tienda, carrito, categorías y productos: la pantalla se arma con una lectura.
// -----------------------------------------------------------------------------
mostrar('1.5 Inicio personalizado de demo-tintos', () =>
  db.inicio.findOne(
    { 'usuario.usuarioId': IDS.demoTintos },
    { _id: 0, usuario: 1, 'carrito.cantidadArticulos': 1, 'productosDestacados.nombre': 1, 'productosDestacados.precio': 1 }
  )
);

// -----------------------------------------------------------------------------
// 1.6 Selección propia de productos (escritura, se deshace al final).
// seleccionProductoIds no admite repetidos (uniqueItems en el validador) y tiene
// como máximo 4. $addToSet con $each agrega varios productos de una vez y omite
// los que ya están: no hace falta leer el arreglo antes para evitar duplicados.
// 'seleccionProductoIds.2': { $exists: false } busca por posición del arreglo
// una página con 2 productos o menos, así entran los nuevos sin pasar de 4.
// -----------------------------------------------------------------------------
const pagina = db.inicio.findOne(
  { seleccionProductoIds: { $exists: true }, 'seleccionProductoIds.2': { $exists: false } },
  { 'usuario.nombre': 1, seleccionProductoIds: 1 }
);
if (!pagina) {
  print('\n▸ 1.6 No hay una página con 2 productos elegidos o menos: se omite.');
} else {
  const elegidos = pagina.seleccionProductoIds;
  const nuevo = db.productos.findOne(
    { activo: true, destacado: true, stockActual: { $gt: 0 }, _id: { $nin: elegidos } },
    { _id: 1, nombre: 1 }
  );
  db.inicio.updateOne(
    { _id: pagina._id },
    { $addToSet: { seleccionProductoIds: { $each: [nuevo._id, elegidos[0]] } } }   // elegidos[0] ya está
  );
  const despues = db.inicio.findOne({ _id: pagina._id }).seleccionProductoIds;
  print(`\n▸ 1.6 $addToSet con $each en la selección de ${pagina.usuario.nombre}: ${elegidos.length} → ${despues.length} productos`
    + ` (se agregó ${nuevo.nombre}; el que ya estaba no se repitió)`);

  // La aplicación recalcula productosDestacados después (sincronizacion.js); acá se deshace.
  db.inicio.updateOne({ _id: pagina._id }, { $set: { seleccionProductoIds: elegidos } });
  print(`    deshecho: la selección vuelve a tener ${db.inicio.findOne({ _id: pagina._id }).seleccionProductoIds.length}, como antes`);
}
}
