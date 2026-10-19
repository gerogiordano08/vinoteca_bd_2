// Colecciones de página del modelo (secciones 8, 9 y "Visitantes y cuentas").
// Solo se persisten páginas de usuarios registrados. Las vistas públicas se construyen al pedirlas.
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

/** Sin usuario no hay filtro de persistencia: nunca se consulta una página ajena. */
function filtroPropietario({ usuarioId } = {}) {
  return usuarioId ? { 'usuario.usuarioId': usuarioId } : null;
}

async function usuarioDePagina(db, propietario) {
  if (!propietario.usuarioId) return null;
  const usuario = await r.copiaUsuario(db, propietario.usuarioId);
  if (!usuario) throw new Error('La página debe pertenecer a un usuario existente.');
  return usuario;
}

async function bloquesComunes(db, propietario, usuario) {
  const [tienda, carrito, categorias] = await Promise.all([
    r.copiaTienda(db),
    r.resumenCarrito(db, propietario.usuarioId),
    r.copiaCategorias(db),
  ]);
  return { ...(usuario ? { usuario } : {}), tienda, carrito, categorias };
}

/** Inicio público sin persistencia; para registrados construye y guarda el documento si falta. */
async function obtenerInicio(db, propietario = {}) {
  const usuario = await usuarioDePagina(db, propietario);
  const coleccion = db.collection('inicio');
  const existente = usuario ? await coleccion.findOne(filtroPropietario(propietario)) : null;
  if (existente) return existente;

  const documento = {
    ...(await bloquesComunes(db, propietario, usuario)),
    presentacion: PRESENTACION,
    productosDestacados: await r.seleccionarDestacados(db),
  };
  if (!usuario) return documento;
  try {
    await coleccion.insertOne(documento);
  } catch (error) {
    // Dos pedidos simultáneos del mismo propietario: el índice único deja uno solo y se usa ese.
    if (error.code !== 11000) throw error;
  }
  return coleccion.findOne(filtroPropietario(propietario));
}

/**
 * Conserva la consulta y configuración del usuario, pero consulta productos en cada lectura.
 * Los resultados, totales y opciones de filtro solo forman parte de la respuesta para la vista.
 */
async function obtenerCatalogo(db, propietario = {}, parametros = {}) {
  const usuario = await usuarioDePagina(db, propietario);
  const coleccion = db.collection('catalogo');
  const filtro = filtroPropietario(propietario);
  const existente = usuario ? await coleccion.findOne(filtro) : null;
  const claves = Object.keys(parametros).filter((k) => parametros[k] !== undefined && parametros[k] !== '');
  const cambiaConsulta = claves.some((k) => k !== 'pagina');
  const consulta = cambiaConsulta || !existente ? await consultaDesdeParametros(db, parametros) : existente.consulta;
  const pagina = claves.length === 0 ? existente?.paginacion.paginaActual
    : cambiaConsulta && parametros.pagina === undefined ? 1 : parametros.pagina;
  const cantidad = existente?.paginacion.productosPorPagina ?? config.productosPorPagina;
  const [bloques, opciones, resultado] = await Promise.all([
    existente ? { usuario, tienda: existente.tienda, carrito: existente.carrito, categorias: existente.categorias }
      : bloquesComunes(db, propietario, usuario),
    opcionesDeFiltro(db),
    ejecutarConsulta(db, consulta, pagina, cantidad),
  ]);

  const documento = {
    ...bloques, consulta,
    paginacion: { paginaActual: resultado.paginacion.paginaActual, productosPorPagina: cantidad },
  };
  let id = existente?._id;
  // Volver sin parámetros no reescribe el documento, salvo que la página guardada ya no exista.
  if (usuario && (!existente || claves.length || pagina !== documento.paginacion.paginaActual)) {
    try {
      const escritura = await coleccion.replaceOne(filtro, documento, { upsert: true });
      id = escritura.upsertedId ?? id ?? (await coleccion.findOne(filtro, { projection: { _id: 1 } }))._id;
    } catch (error) {
      if (error.code !== 11000) throw error;
      // Dos primeras visitas simultáneas: conserva un documento por usuario.
      await coleccion.replaceOne(filtro, documento);
      id = (await coleccion.findOne(filtro, { projection: { _id: 1 } }))._id;
    }
  }
  return { ...(id ? { _id: id } : {}), ...documento, opcionesFiltro: opciones, ...resultado };
}

/** Texto de rango de precios para el formulario de filtros. */
function precioParaFormulario(valor) {
  return valor ? String(aNumero(valor)) : '';
}

module.exports = { PRESENTACION, filtroPropietario, obtenerInicio, obtenerCatalogo, precioParaFormulario };
