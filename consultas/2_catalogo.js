// =============================================================================
// Pantalla CATÁLOGO (src/vistas/catalogo.ejs · src/servicios/consultaCatalogo.js)
// Búsqueda, filtros, orden y paginación sobre productos (12 por página).
// Uso:  mongosh consultas/2_catalogo.js
// =============================================================================

if (typeof mostrar === 'undefined') load(__dirname + '/lib.js');

{
seccion('2 · CATÁLOGO');
const activas = categoriasActivas();
const base = { activo: true, categoriaId: { $in: activas } };
const tarjeta = { _id: 0, nombre: 1, precio: 1, stockActual: 1, destacado: 1, 'detalleVino.color': 1, 'detalleVino.varietal': 1 };

// -----------------------------------------------------------------------------
// 2.1 Opciones del filtro: colores y varietales que existen en el catálogo
// -----------------------------------------------------------------------------
mostrar('2.1 Colores para filtrar', () => db.productos.distinct('detalleVino.color', base), { limite: 10 });
mostrar('2.1 Varietales para filtrar', () => db.productos.distinct('detalleVino.varietal', base), { limite: 10 });

// -----------------------------------------------------------------------------
// 2.2 Primera página, orden "Destacados": destacados primero, después por nombre.
// $lookup a bodegas solo para los 12 productos de la página.
// -----------------------------------------------------------------------------
mostrar('2.2 Primera página (orden Destacados)', () =>
  db.productos.aggregate([
    { $match: base },
    { $sort: { destacado: -1, nombre: 1, _id: 1 } },
    { $skip: 0 },
    { $limit: 12 },
    { $lookup: { from: 'bodegas', localField: 'bodegaId', foreignField: '_id', as: 'bodega' } },
    { $project: { _id: 0, nombre: 1, precio: 1, destacado: 1, bodega: { $first: '$bodega.nombre' } } },
  ])
, { limite: 12 });

// -----------------------------------------------------------------------------
// 2.3 Paginación: total de productos con el mismo filtro
// -----------------------------------------------------------------------------
mostrar('2.3 Total de productos para la paginación', () => ({ totalProductos: db.productos.countDocuments(base) }));

// -----------------------------------------------------------------------------
// 2.4 Categoría Vinos, segunda página por nombre (skip 12)
// -----------------------------------------------------------------------------
mostrar('2.4 Vinos, página 2 por nombre', () =>
  db.productos.find({ activo: true, categoriaId: IDS.vinos }, tarjeta).sort({ nombre: 1, _id: 1 }).skip(12).limit(12)
);

// -----------------------------------------------------------------------------
// 2.5 Filtros combinados: tintos Malbec entre $15.000 y $30.000, más baratos primero.
// Los precios son Decimal128: se comparan con NumberDecimal.
// -----------------------------------------------------------------------------
mostrar('2.5 Tintos Malbec de $15.000 a $30.000', () =>
  db.productos.find({
    ...base, 'detalleVino.color': { $in: ['Tinto'] }, 'detalleVino.varietal': { $in: ['Malbec'] },
    precio: { $gte: NumberDecimal('15000'), $lte: NumberDecimal('30000') },
  }, tarjeta).sort({ precio: 1, nombre: 1, _id: 1 }).limit(12)
);

// -----------------------------------------------------------------------------
// 2.6 Búsqueda de texto (índice busqueda_texto, en español): "copas" encuentra "copa"
// -----------------------------------------------------------------------------
mostrar('2.6 Búsqueda "copas"', () =>
  db.productos.find({ ...base, $text: { $search: 'copas' } }, { _id: 0, nombre: 1, precio: 1 }).sort({ nombre: 1, _id: 1 }).limit(12)
);

// -----------------------------------------------------------------------------
// 2.7 Búsqueda por bodega: si el texto nombra una bodega se filtran sus productos
// -----------------------------------------------------------------------------
const bodegas = db.bodegas.find({ nombre: /calchaqu/i }, { _id: 1 }).toArray().map((b) => b._id);
mostrar('2.7 Búsqueda "Calchaquíes" (productos de esa bodega)', () =>
  db.productos.find({ ...base, bodegaId: { $in: bodegas } }, { _id: 0, nombre: 1, precio: 1 }).sort({ nombre: 1, _id: 1 }).limit(12)
);

// -----------------------------------------------------------------------------
// 2.8 Última búsqueda guardada de un usuario (colección catalogo).
// Se guarda la consulta y la página, no los productos: se consultan al abrirla.
// -----------------------------------------------------------------------------
mostrar('2.8 Catálogo guardado de demo-tintos', () =>
  db.catalogo.findOne({ 'usuario.usuarioId': IDS.demoTintos }, { _id: 0, 'usuario.nombre': 1, consulta: 1, paginacion: 1 })
);
}
