// =============================================================================
// 04 · Vistas para MongoDB Compass
//
// Cada vista guarda una agregación y Compass la muestra como una colección más
// (con el ícono del ojo): se abre y se ve el resultado, sin escribir código.
//
//   consulta_01 … consulta_10   las 10 consultas avanzadas (consultas/avanzadas.js)
//   pagina_vinos               la página de Vinos del catálogo, en el orden "Destacados"
//
// Uso:  mongosh db/04_vistas.js   (se puede repetir: recrea las vistas)
// =============================================================================

if (typeof CONFIG === 'undefined') load(__dirname + '/config.js');
if (typeof titulo === 'undefined') load(__dirname + '/utilidades.js');

{
titulo('04 · Vistas para Compass');
db = db.getSiblingDB(CONFIG.dbName);

const crearVista = (nombre, sobre, pipeline) => {
  if (db.getCollectionInfos({ name: nombre }).length) db.getCollection(nombre).drop();
  db.createView(nombre, sobre, pipeline);
  print(`    ${nombre.padEnd(40)} sobre ${sobre}`);
};

const NOMBRES = ['ventas_por_mes', 'productos_mas_vendidos', 'ingresos_por_categoria', 'ventas_por_bodega', 'mejores_clientes',
  'semaforo_de_stock', 'retiro_vs_envio', 'carritos_abandonados', 'precio_historico_vs_actual', 'resumen_del_catalogo'];
const consultas = require(desdeRaiz('consultas', 'avanzadas.js'));
consultas.forEach((c, i) => crearVista(`consulta_${String(i + 1).padStart(2, '0')}_${NOMBRES[i]}`, c.coleccion, c.pipeline));

// Página de Vinos: mismos criterios que la tienda (src/servicios/consultaCatalogo.js).
// Arranca en la categoría por su slug, así no depende de un ObjectId fijo.
crearVista('pagina_vinos', 'categorias', [
  { $match: { slug: 'vinos', activa: true } },
  { $lookup: {
    from: 'productos', let: { categoria: '$_id' }, as: 'producto',
    pipeline: [
      { $match: { activo: true, $expr: { $eq: ['$categoriaId', '$$categoria'] } } },
      { $sort: { destacado: -1, nombre: 1, _id: 1 } },
    ],
  } },
  { $unwind: '$producto' },
  { $replaceWith: { $mergeObjects: ['$producto', { categoria: '$nombre' }] } },
  { $lookup: { from: 'bodegas', localField: 'bodegaId', foreignField: '_id', as: 'bodega' } },
  { $project: {
    _id: 1, sku: 1, nombre: 1, categoria: 1,
    bodega: { $first: '$bodega.nombre' }, provinciaBodega: { $first: '$bodega.provincia' },
    color: '$detalleVino.color', varietal: '$detalleVino.varietal', cosecha: '$detalleVino.cosecha',
    contenidoMl: '$detalleVino.contenidoMl', precio: 1, stockActual: 1,
    disponible: { $gt: ['$stockActual', 0] }, destacado: 1, imagen: { $first: '$imagenes' },
  } },
]);
}
