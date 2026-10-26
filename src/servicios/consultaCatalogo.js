// Búsqueda, filtros, orden y paginación del catálogo sobre la colección productos.
const { aDecimal, aNumero } = require('../util/dinero');
const { aObjectId } = require('../util/ids');
const { resumenProducto } = require('./resumenes');

const ORDENES = {
  destacados: { destacado: -1, nombre: 1, _id: 1 },
  precio_asc: { precio: 1, nombre: 1, _id: 1 },
  precio_desc: { precio: -1, nombre: 1, _id: 1 },
  nombre_asc: { nombre: 1, _id: 1 },
};

const ORDEN_COLORES = ['Tinto', 'Blanco', 'Rosado'];

const comoLista = (valor) => (valor === undefined || valor === '' ? [] : [].concat(valor)).map(String).filter(Boolean);

/**
 * Normaliza los parámetros de la URL (texto, categoria, color, varietal, precioMin, precioMax, orden)
 * a la estructura del subdocumento catalogo.consulta.
 */
async function consultaDesdeParametros(db, parametros) {
  const consulta = { orden: ORDENES[parametros.orden] ? parametros.orden : 'destacados' };
  const texto = String(parametros.texto || '').trim().slice(0, 100);
  if (texto) consulta.texto = texto;

  const slugs = comoLista(parametros.categoria);
  const ids = comoLista(parametros.categoriaId).map(aObjectId).filter(Boolean);
  if (slugs.length) {
    const encontradas = await db.collection('categorias').find({ slug: { $in: slugs } }, { projection: { _id: 1 } }).toArray();
    ids.push(...encontradas.map((c) => c._id));
  }
  if (ids.length) consulta.categoriaIds = ids;

  const colores = comoLista(parametros.color);
  if (colores.length) consulta.colores = colores;
  const varietales = comoLista(parametros.varietal);
  if (varietales.length) consulta.varietales = varietales;

  const minimo = Number(String(parametros.precioMin ?? '').replace(/[^\d.]/g, ''));
  const maximo = Number(String(parametros.precioMax ?? '').replace(/[^\d.]/g, ''));
  if (parametros.precioMin && Number.isFinite(minimo) && minimo > 0) consulta.precioMinimo = aDecimal(minimo);
  if (parametros.precioMax && Number.isFinite(maximo) && maximo > 0) consulta.precioMaximo = aDecimal(maximo);
  return consulta;
}

/** Filtro de MongoDB equivalente a una consulta del catálogo. Solo productos activos de categorías activas. */
async function filtroDeConsulta(db, consulta) {
  const activas = (await db.collection('categorias').find({ activa: true }, { projection: { _id: 1 } }).toArray()).map((c) => c._id);
  let categorias = activas;
  if (consulta.categoriaIds && consulta.categoriaIds.length) {
    const elegidas = new Set(consulta.categoriaIds.map(String));
    categorias = activas.filter((id) => elegidas.has(String(id)));
  }

  const filtro = {};
  if (consulta.texto) {
    // El cuadro de búsqueda acepta "Malbec, bodega o accesorio…": si el texto nombra una bodega,
    // se filtran sus productos; si no, se usa el índice de texto (en español, con raíces de palabras).
    const patron = new RegExp(consulta.texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const bodegas = consulta.texto.length >= 3
      ? await db.collection('bodegas').find({ nombre: patron }, { projection: { _id: 1 } }).toArray()
      : [];
    if (bodegas.length) filtro.bodegaId = { $in: bodegas.map((b) => b._id) };
    else filtro.$text = { $search: consulta.texto };
  }
  filtro.activo = true;
  filtro.categoriaId = { $in: categorias };
  if (consulta.colores && consulta.colores.length) filtro['detalleVino.color'] = { $in: consulta.colores };
  if (consulta.varietales && consulta.varietales.length) filtro['detalleVino.varietal'] = { $in: consulta.varietales };
  if (consulta.precioMinimo || consulta.precioMaximo) {
    filtro.precio = {};
    if (consulta.precioMinimo) filtro.precio.$gte = consulta.precioMinimo;
    if (consulta.precioMaximo) filtro.precio.$lte = consulta.precioMaximo;
  }
  return filtro;
}

/**
 * Ejecuta la consulta y devuelve los resúmenes de la página pedida y la paginación.
 * El total se cuenta con el mismo filtro; la página se arma con $sort, $skip, $limit y dos $lookup
 * que traen la categoría y la bodega solo de los productos de esa página.
 */
async function ejecutarConsulta(db, consulta, paginaPedida, productosPorPagina) {
  const filtro = await filtroDeConsulta(db, consulta);
  const orden = ORDENES[consulta.orden] || ORDENES.destacados;
  const total = await db.collection('productos').countDocuments(filtro);
  const totalPaginas = Math.max(1, Math.ceil(total / productosPorPagina));
  const paginaActual = Math.min(Math.max(1, Number.parseInt(paginaPedida, 10) || 1), totalPaginas);

  const resultados = await db
    .collection('productos')
    .aggregate([
      { $match: filtro },
      { $sort: orden },
      { $skip: (paginaActual - 1) * productosPorPagina },
      { $limit: productosPorPagina },
      { $lookup: { from: 'categorias', localField: 'categoriaId', foreignField: '_id', as: 'categoria' } },
      { $unwind: '$categoria' },
      { $lookup: { from: 'bodegas', localField: 'bodegaId', foreignField: '_id', as: 'bodega' } },
      { $set: { bodega: { $first: '$bodega' } } },
    ])
    .toArray();

  return {
    productos: resultados.map((p) => resumenProducto(p, p.categoria, { enCatalogo: true, bodega: p.bodega })),
    paginacion: { paginaActual, productosPorPagina, totalProductos: total, totalPaginas },
  };
}

// Los dos distinct recorren todos los productos activos (con 200.000 productos, unos 300 ms cada uno)
// y su resultado cambia muy poco: se guarda en memoria un minuto y se descarta al modificar
// productos o categorías desde la aplicación (sincronizacion.js).
const VIGENCIA_OPCIONES_MS = 60 * 1000;
const opcionesEnMemoria = new WeakMap();

function olvidarOpcionesDeFiltro(db) {
  opcionesEnMemoria.delete(db);
}

/** Colores y varietales disponibles para filtrar, obtenidos de los productos del catálogo. */
async function opcionesDeFiltro(db) {
  const guardadas = opcionesEnMemoria.get(db);
  if (guardadas && Date.now() - guardadas.hora < VIGENCIA_OPCIONES_MS) return guardadas.opciones;
  const opciones = await calcularOpcionesDeFiltro(db);
  opcionesEnMemoria.set(db, { hora: Date.now(), opciones });
  return opciones;
}

async function calcularOpcionesDeFiltro(db) {
  const activas = (await db.collection('categorias').find({ activa: true }, { projection: { _id: 1 } }).toArray()).map((c) => c._id);
  const base = { activo: true, categoriaId: { $in: activas } };
  const [colores, varietales] = await Promise.all([
    db.collection('productos').distinct('detalleVino.color', base),
    db.collection('productos').distinct('detalleVino.varietal', base),
  ]);
  const posicion = (c) => (ORDEN_COLORES.includes(c) ? ORDEN_COLORES.indexOf(c) : ORDEN_COLORES.length);
  colores.sort((a, b) => posicion(a) - posicion(b) || a.localeCompare(b, 'es'));
  varietales.sort((a, b) => a.localeCompare(b, 'es'));
  return { colores, varietales };
}

/** Parámetros de URL que reproducen una consulta guardada (para enlaces de paginación y filtros). */
function parametrosDeConsulta(consulta, categorias = []) {
  const p = new URLSearchParams();
  if (consulta.texto) p.set('texto', consulta.texto);
  for (const id of consulta.categoriaIds || []) {
    const c = categorias.find((cat) => String(cat.categoriaId) === String(id));
    if (c) p.append('categoria', c.slug);
  }
  for (const color of consulta.colores || []) p.append('color', color);
  for (const v of consulta.varietales || []) p.append('varietal', v);
  if (consulta.precioMinimo) p.set('precioMin', String(aNumero(consulta.precioMinimo)));
  if (consulta.precioMaximo) p.set('precioMax', String(aNumero(consulta.precioMaximo)));
  if (consulta.orden && consulta.orden !== 'destacados') p.set('orden', consulta.orden);
  return p;
}

module.exports = {
  ORDENES, consultaDesdeParametros, filtroDeConsulta, ejecutarConsulta, opcionesDeFiltro, olvidarOpcionesDeFiltro, parametrosDeConsulta,
};
