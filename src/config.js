// Configuración por variables de entorno, con valores por defecto para trabajar en local.
// Para cambiarlos: copiar .env.example a .env y ejecutar con `node --env-file=.env ...`.
const config = {
  puerto: Number(process.env.PORT) || 3000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017',
  baseDatos: process.env.MONGODB_DB || 'vinoteca',
  secretoSesion: process.env.SESSION_SECRET || 'vinoteca-desarrollo-local',
  // Decisión del equipo pendiente en el modelo: cantidad de productos por página del catálogo.
  // Se eligen 12 (4 filas de 3): los 24 productos del boceto quedan en 2 páginas, como en Figma.
  productosPorPagina: Number(process.env.PRODUCTOS_POR_PAGINA) || 12,
  // Cantidad máxima de destacados en Inicio (definida en el modelo).
  maximoDestacados: 4,
};

module.exports = config;
