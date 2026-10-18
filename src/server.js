const config = require('./config');
const { conectar, desconectar } = require('./db/conexion');
const { crearApp } = require('./app');

(async () => {
  try {
    await conectar();
  } catch (error) {
    console.error(`No se pudo conectar a MongoDB en ${config.mongoUri}. ¿Está iniciado el servicio?`);
    console.error(error.message);
    process.exit(1);
  }
  const servidor = crearApp().listen(config.puerto, () => {
    console.log(`Vinoteca en http://localhost:${config.puerto} (base ${config.baseDatos})`);
  });
  const cerrar = () => servidor.close(() => desconectar().then(() => process.exit(0)));
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
})();
