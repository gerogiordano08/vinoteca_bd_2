// Cinco cuentas de demostración con Inicio y Catálogo distintos. No borra datos ni genera volumen.
// Uso: npm run db:paginas
const { conectar, desconectar } = require('../src/db/conexion');
const config = require('../src/config');
const usuarios = require('../src/servicios/usuarios');
const { obtenerInicio, obtenerCatalogo } = require('../src/servicios/paginas');
const { consultaDesdeParametros, filtroDeConsulta } = require('../src/servicios/consultaCatalogo');
const { seleccionarDestacados } = require('../src/servicios/resumenes');

const PASSWORD = 'paginas2026';
const PERFILES = [
  { nombre: 'Tomás', apellido: 'Tintos', email: 'demo-tintos@vinoteca.test', parametros: { categoria: 'vinos', color: 'Tinto', orden: 'nombre_asc' } },
  { nombre: 'Blanca', apellido: 'Blancos', email: 'demo-blancos@vinoteca.test', parametros: { categoria: 'vinos', color: 'Blanco', orden: 'nombre_asc' } },
  { nombre: 'Rocío', apellido: 'Rosados', email: 'demo-rosados@vinoteca.test', parametros: { categoria: 'vinos', color: 'Rosado', orden: 'nombre_asc' } },
  { nombre: 'Emilia', apellido: 'Espumantes', email: 'demo-espumantes@vinoteca.test', parametros: { categoria: 'espumantes', orden: 'nombre_asc' } },
  { nombre: 'Alejo', apellido: 'Accesorios', email: 'demo-accesorios@vinoteca.test', parametros: { categoria: 'accesorios', orden: 'nombre_asc' } },
];

async function cargarPaginas(db, { log = () => {} } = {}) {
  // Verifica los cinco grupos y las cuentas existentes antes de escribir.
  const planes = [];
  for (const perfil of PERFILES) {
    const categoria = await db.collection('categorias').findOne({ slug: perfil.parametros.categoria, activa: true });
    if (!categoria) throw new Error(`Falta la categoría activa ${perfil.parametros.categoria}.`);
    const consulta = await consultaDesdeParametros(db, perfil.parametros);
    const filtro = await filtroDeConsulta(db, consulta);
    const productos = await db.collection('productos').find({ ...filtro, stockActual: { $gt: 0 } }, { projection: { _id: 1 } }).sort({ sku: 1 }).limit(4).toArray();
    if (!productos.length) throw new Error(`No hay productos disponibles para ${perfil.apellido}. No se crearon cuentas.`);
    const existente = await db.collection('usuarios').findOne({ email: perfil.email });
    if (existente && (!(await usuarios.autenticar(db, perfil.email, PASSWORD)) || existente.rol !== 'cliente')) {
      throw new Error(`La cuenta ${perfil.email} ya existe con otras credenciales o rol; no se modificó.`);
    }
    planes.push({ perfil, existente, seleccionProductoIds: productos.map((p) => p._id) });
  }

  const resultado = [];
  for (const { perfil, existente, seleccionProductoIds } of planes) {
    const usuario = existente || await usuarios.registrar(db, { ...perfil, password: PASSWORD });
    const propietario = { usuarioId: usuario._id };
    const inicio = await obtenerInicio(db, propietario);
    const productosDestacados = await seleccionarDestacados(db, seleccionProductoIds);
    await db.collection('inicio').updateOne({ _id: inicio._id }, { $set: { seleccionProductoIds, productosDestacados } });
    const catalogo = await obtenerCatalogo(db, propietario, perfil.parametros);
    resultado.push({ email: perfil.email, usuarioId: usuario._id, inicioId: inicio._id, catalogoId: catalogo._id,
      productosInicio: productosDestacados.length, productosCatalogo: catalogo.productos.length,
      totalCatalogo: catalogo.paginacion.totalProductos });
    log(`${perfil.email}: Inicio con ${productosDestacados.length} productos; Catálogo con ${catalogo.paginacion.totalProductos} resultados.`);
  }
  return resultado;
}

if (require.main === module) {
  (async () => {
    try {
      const db = await conectar();
      console.log(`Cargando cinco usuarios y sus páginas en ${config.baseDatos}...`);
      await cargarPaginas(db, { log: console.log });
      console.log(`Listo. Contraseña de las cinco cuentas de demostración: ${PASSWORD}`);
    } catch (error) {
      console.error('No se pudieron cargar las páginas:', error.message);
      process.exitCode = 1;
    } finally {
      await desconectar();
    }
  })();
}

module.exports = { cargarPaginas, PERFILES, PASSWORD };
