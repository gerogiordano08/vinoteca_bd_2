// =============================================================================
// Crea la base "vinoteca" completa, desde cero, solo con mongosh:
//
//   00_crear_db.js        9 colecciones con validación $jsonSchema
//   01_datos.js           datos de ejemplo (db/datos/*.json)
//   02_datos_masivos.js   carga masiva (cantidades en config.js)
//   03_indices.js         índices
//   04_vistas.js          vistas para MongoDB Compass
//   05_verificar.js       volumen, validación e integridad de referencias
//   06_historial_precios.js  serie temporal de precios (colección time series)
//
// Uso (desde la carpeta del proyecto):
//   mongosh db/setup.js
// Sin carga masiva (más rápido):
//   PowerShell:  $env:PRODUCTOS=0; $env:USUARIOS=0; $env:PEDIDOS=0; mongosh db/setup.js
//
// ATENCIÓN: borra la base "vinoteca" si ya existe. Después se puede usar la
// aplicación (npm start) y MongoDB Compass sobre la misma base.
// =============================================================================

load(__dirname + '/config.js');
load(__dirname + '/utilidades.js');

const total = cronometro();
for (const script of ['00_crear_db.js', '01_datos.js', '02_datos_masivos.js', '03_indices.js', '04_vistas.js', '05_verificar.js', '06_historial_precios.js']) {
  load(`${__dirname}/${script}`);
}
print(`\nBase "${CONFIG.dbName}" lista en ${total()}.`);
