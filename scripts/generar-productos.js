// Agrega productos ficticios a la base de la aplicación, sin borrar datos ni medir rendimiento.
// Uso: npm run db:volumen (opcional: PRODUCTOS=1000 npm run db:volumen).
const { conectar, desconectar } = require('../src/db/conexion');
const config = require('../src/config');
const datos = require('../src/datos/ejemplo');
const { aDecimal } = require('../src/util/dinero');
const { alCambiarProducto } = require('../src/servicios/sincronizacion');
const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');

const PREFIJO = 'VOL-';
const PUBLICO = path.join(__dirname, '..', 'public');

async function generarProductos(db, {
  cantidad = 200000, lote = 5000, log = () => {},
  imagenesCompartidas = false,
  directorioImagenes = path.join(PUBLICO, 'img', 'productos', 'volumen'),
} = {}) {
  if (!Number.isSafeInteger(cantidad) || cantidad < 1 || !Number.isSafeInteger(lote) || lote < 1) {
    throw new Error('PRODUCTOS y el tamaño de lote deben ser enteros positivos.');
  }

  // Se reutilizan las referencias de la base inicializada; no se inventan ObjectId huérfanos.
  const categorias = await db.collection('categorias').find({ activa: true }).toArray();
  const bodegas = await db.collection('bodegas').find({ activa: true }).toArray();
  const porCategoria = new Map(categorias.map((c) => [c.slug, c._id]));
  const porBodega = new Map(datos.bodegas.map((b) => [b.clave, bodegas.find((existente) => existente.nombre === b.nombre)?._id]));
  const plantillas = datos.productos.filter((p) => p.activo !== false);
  if (plantillas.some((p) => !porCategoria.has(p.categoria) || (p.bodega && !porBodega.get(p.bodega)))) {
    throw new Error('Faltan categorías o bodegas activas de ejemplo. Inicializá una base de desarrollo con db:setup antes de generar volumen (db:setup borra los datos).');
  }
  const indices = await db.collection('productos').indexes();
  if (!indices.some((i) => i.unique && i.key.sku === 1 && Object.keys(i.key).length === 1)) {
    throw new Error('Falta el índice único de SKU. Ejecutá npm run db:init.');
  }

  let insertados = 0;
  const directoriosCreados = new Set();
  for (let inicio = 0; inicio < cantidad; inicio += lote) {
    const operaciones = [];
    for (let i = inicio; i < Math.min(inicio + lote, cantidad); i++) {
      const { categoria, bodega, imagen, precio, detalleVino, activo, ...plantilla } = plantillas[i % plantillas.length];
      const sku = `${PREFIJO}${String(i + 1).padStart(7, '0')}`;
      // Un archivo independiente por SKU. Subcarpetas de 1.000 archivos para facilitar su manejo.
      const carpeta = String(Math.floor(i / 1000)).padStart(3, '0');
      const nombreImagen = `${sku}${path.extname(imagen)}`;
      const directorio = path.join(directorioImagenes, carpeta);
      if (!imagenesCompartidas) {
        if (!directoriosCreados.has(directorio)) {
          await fs.mkdir(directorio, { recursive: true });
          directoriosCreados.add(directorio);
        }
        try {
          await fs.copyFile(path.join(PUBLICO, imagen), path.join(directorio, nombreImagen), constants.COPYFILE_EXCL);
        } catch (error) {
          if (error.code !== 'EEXIST') throw error;
        }
      }
      const rutaCopia = `/img/productos/volumen/${carpeta}/${nombreImagen}`;
      const rutaImagen = imagenesCompartidas ? imagen : rutaCopia;
      const producto = {
        ...plantilla,
        sku,
        nombre: `${plantilla.nombre} · muestra ${i + 1}`,
        categoriaId: porCategoria.get(categoria),
        imagenes: [rutaImagen],
        precio: aDecimal(3000 + (i * 7919) % 47001),
        stockActual: i % 61,
        activo: true,
        destacado: false,
      };
      if (bodega) producto.bodegaId = porBodega.get(bodega);
      if (detalleVino) producto.detalleVino = { ...detalleVino, graduacionAlcohol: aDecimal(detalleVino.graduacionAlcohol) };
      // SKU estables: ambos modos usan los mismos productos y conservan sus datos.
      operaciones.push({ updateOne: { filter: { sku }, update: { $setOnInsert: producto }, upsert: true } });
      // Cambia entre las dos rutas del generador; conserva imágenes personalizadas por el usuario.
      operaciones.push({ updateOne: {
        filter: { sku, $or: [{ imagenes: [imagen] }, { imagenes: [rutaCopia] }] },
        update: { $set: { imagenes: [rutaImagen] } },
      } });
    }
    const resultado = await db.collection('productos').bulkWrite(operaciones, { ordered: false });
    insertados += resultado.upsertedCount;
    log(`Procesados ${Math.min(inicio + lote, cantidad)}/${cantidad}; nuevos: ${insertados}`);
  }
  // Una sola sincronización al finalizar, también al reintentar una carga interrumpida.
  log('Actualizando los productos seleccionados de Inicio...');
  await alCambiarProducto(db);
  return { insertados, total: await db.collection('productos').countDocuments() };
}

async function ejecutarGenerador({ imagenesCompartidas = false } = {}) {
    try {
      const cantidad = process.env.PRODUCTOS === undefined ? 200000 : Number(process.env.PRODUCTOS);
      const db = await conectar();
      console.log(`Generando ${cantidad} productos en ${config.baseDatos}...`);
      console.log(imagenesCompartidas ? 'Imágenes compartidas: se reutilizan los 8 archivos originales.' : 'Imágenes individuales: se crea una copia por producto.');
      const resultado = await generarProductos(db, { cantidad, imagenesCompartidas, log: console.log });
      console.log(`Listo: ${resultado.insertados} productos nuevos; ${resultado.total} productos en total.`);
    } catch (error) {
      console.error('No se pudo completar la generación:', error.message);
      process.exitCode = 1;
    } finally {
      await desconectar();
    }
}

if (require.main === module) ejecutarGenerador();

module.exports = { generarProductos, ejecutarGenerador };
