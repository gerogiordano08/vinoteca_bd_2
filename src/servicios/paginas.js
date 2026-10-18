// Colecciones de página del modelo (secciones 8, 9 y "Visitantes y cuentas").
// Cada documento guarda la página completa de un usuario registrado o de una sesión de visitante,
// para que mostrar Inicio o Catálogo sea leer un único documento.
const config = require('../config');
const { aNumero } = require('../util/dinero');
const r = require('./resumenes');
const { consultaDesdeParametros, ejecutarConsulta, opcionesDeFiltro } = require('./consultaCatalogo');

// Contenido propio de Inicio (bloque "presentacion"); los rótulos fijos quedan en la interfaz.
const PRESENTACION = {
  titulo: 'Un buen vino. Un gran momento.',
  descripcion: 'Encontrá tu próxima botella y todo para disfrutarla. Un catálogo simple, con sabores para cada ocasión.',
  imagenes: ['/img/productos/botella-tinto.svg', '/img/productos/copa.svg'],
};

/** Propietario de una página: { usuarioId } para cuentas registradas o { visitanteId } para visitantes. */
function filtroPropietario({ usuarioId, visitanteId }) {
  return usuarioId ? { 'usuario.usuarioId': usuarioId } : { visitanteId };
}

async function bloquesComunes(db, propietario) {
  const [usuario, tienda, carrito, categorias] = await Promise.all([
    r.copiaUsuario(db, propietario.usuarioId),
    r.copiaTienda(db),
    r.resumenCarrito(db, propietario.usuarioId),
    r.copiaCategorias(db),
  ]);
  const bloques = { usuario, tienda, carrito, categorias };
  // Registrados: se omite visitanteId. Visitantes: usuario null y visitanteId.
  if (!propietario.usuarioId) bloques.visitanteId = propietario.visitanteId;
  return bloques;
}

/** Devuelve el documento de Inicio del propietario; si no existe, lo construye y lo guarda. */
async function obtenerInicio(db, propietario) {
  const coleccion = db.collection('inicio');
  const existente = await coleccion.findOne(filtroPropietario(propietario));
  if (existente) return existente;

  const documento = {
    ...(await bloquesComunes(db, propietario)),
    presentacion: PRESENTACION,
    productosDestacados: await r.seleccionarDestacados(db),
  };
  try {
    await coleccion.insertOne(documento);
  } catch (error) {
    // Dos pedidos simultáneos del mismo propietario: el índice único deja uno solo y se usa ese.
    if (error.code !== 11000) throw error;
  }
  return coleccion.findOne(filtroPropietario(propietario));
}

/**
 * Devuelve el documento de Catálogo del propietario.
 * - Sin parámetros: muestra la última consulta guardada (el modelo conserva la última consulta).
 * - Con parámetros de búsqueda, filtros u orden: reemplaza la consulta y vuelve a la página 1.
 * - Con solo "pagina": recalcula la página de la misma consulta.
 */
async function obtenerCatalogo(db, propietario, parametros = {}) {
  const coleccion = db.collection('catalogo');
  const filtro = filtroPropietario(propietario);
  const existente = await coleccion.findOne(filtro);
  const claves = Object.keys(parametros).filter((k) => parametros[k] !== undefined && parametros[k] !== '');
  const cambiaConsulta = claves.some((k) => k !== 'pagina');

  if (existente && claves.length === 0) return existente;

  const consulta = cambiaConsulta || !existente ? await consultaDesdeParametros(db, parametros) : existente.consulta;
  const pagina = cambiaConsulta ? 1 : parametros.pagina;
  const [bloques, opciones, resultado] = await Promise.all([
    bloquesComunes(db, propietario),
    opcionesDeFiltro(db),
    ejecutarConsulta(db, consulta, pagina, config.productosPorPagina),
  ]);

  const documento = { ...bloques, opcionesFiltro: opciones, consulta, ...resultado };
  await coleccion.replaceOne(filtro, documento, { upsert: true });
  return coleccion.findOne(filtro);
}

/** Recalcula los resultados de un documento de Catálogo con su consulta guardada (sincronización). */
async function recalcularCatalogo(db, documento) {
  const resultado = await ejecutarConsulta(db, documento.consulta, documento.paginacion.paginaActual, documento.paginacion.productosPorPagina);
  await db.collection('catalogo').updateOne({ _id: documento._id }, { $set: resultado });
}

/**
 * Al iniciar sesión se pasan a usar los documentos del usuario registrado.
 * Los documentos del visitante dejan de usarse y se eliminan.
 */
async function descartarPaginasDeVisitante(db, visitanteId) {
  if (!visitanteId) return;
  await Promise.all([db.collection('inicio').deleteMany({ visitanteId }), db.collection('catalogo').deleteMany({ visitanteId })]);
}

/** Texto de rango de precios para el formulario de filtros. */
function precioParaFormulario(valor) {
  return valor ? String(aNumero(valor)) : '';
}

module.exports = { PRESENTACION, filtroPropietario, obtenerInicio, obtenerCatalogo, recalcularCatalogo, descartarPaginasDeVisitante, precioParaFormulario };
