const express = require('express');
const { obtenerInicio, obtenerCatalogo, precioParaFormulario } = require('../servicios/paginas');
const { parametrosDeConsulta } = require('../servicios/consultaCatalogo');
const { obtenerDetalle, filasDeDetalles } = require('../servicios/productos');
const { aObjectId } = require('../util/ids');

const router = express.Router();
const PARAMETROS_CATALOGO = ['texto', 'categoria', 'color', 'varietal', 'precioMin', 'precioMax', 'orden', 'pagina'];

// Inicio: un único documento de la colección inicio por usuario o visitante.
router.get('/', async (req, res) => {
  const pagina = await obtenerInicio(req.db, req.propietario);
  res.locals.carrito = pagina.carrito;
  res.render('inicio', { titulo: 'Inicio', pagina });
});

// Catálogo: búsqueda, filtros, orden y paginación guardados en la colección catalogo.
router.get('/catalogo', async (req, res) => {
  const parametros = {};
  for (const clave of PARAMETROS_CATALOGO) if (req.query[clave] !== undefined) parametros[clave] = req.query[clave];
  if (req.query.limpiar) {
    // "Limpiar filtros": vuelve a la consulta inicial (orden destacados, sin filtros).
    parametros.orden = 'destacados';
  }
  const pagina = await obtenerCatalogo(req.db, req.propietario, parametros);
  res.locals.carrito = pagina.carrito;
  res.locals.busqueda = pagina.consulta.texto || '';

  const seleccion = {
    categorias: new Set((pagina.consulta.categoriaIds || []).map(String)),
    colores: new Set(pagina.consulta.colores || []),
    varietales: new Set(pagina.consulta.varietales || []),
    precioMin: precioParaFormulario(pagina.consulta.precioMinimo),
    precioMax: precioParaFormulario(pagina.consulta.precioMaximo),
  };
  const base = parametrosDeConsulta(pagina.consulta, pagina.categorias);
  const enlacePagina = (n) => {
    const p = new URLSearchParams(base);
    p.set('pagina', String(n));
    return `/catalogo?${p}`;
  };
  res.render('catalogo', { titulo: 'Catálogo', pagina, seleccion, enlacePagina });
});

router.get('/productos/:id', async (req, res, next) => {
  const producto = await obtenerDetalle(req.db, aObjectId(req.params.id));
  if (!producto) return next();
  res.render('producto', { titulo: producto.nombre, producto, filasAccesorio: filasDeDetalles(producto.detalleAccesorio && producto.detalleAccesorio.detalles) });
});

router.get('/ayuda', async (req, res) => {
  const tienda = await req.db.collection('configuracion_tienda').findOne({});
  res.render('ayuda', { titulo: 'Ayuda y contacto', tienda });
});

module.exports = router;
