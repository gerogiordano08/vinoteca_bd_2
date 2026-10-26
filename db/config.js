// =============================================================================
// Configuración de los scripts de mongosh (db/, consultas/ y rendimiento/).
//
// Las cantidades de la carga masiva se pueden cambiar con variables de entorno,
// por ejemplo en PowerShell:   $env:PRODUCTOS = 1000; mongosh db/setup.js
// =============================================================================

const numero = (nombre, valor) => {
  const texto = process.env[nombre];
  return texto === undefined || texto === '' ? valor : Number(texto);
};

globalThis.CONFIG = {
  // Base de la aplicación (la misma que usa src/config.js).
  dbName: process.env.MONGODB_DB || 'vinoteca',

  // Carga masiva (db/02_datos_masivos.js). Con 0 no se genera esa parte.
  masivos: {
    productos: numero('PRODUCTOS', 200000), // copias de los productos de ejemplo, SKU VOL-0000001…
    usuarios: numero('USUARIOS', 10000),    // clientes sintéticos, volumen00001@ejemplo.test…
    pedidos: numero('PEDIDOS', 50000),      // pedidos de esos clientes, números V-100001…
  },
  lote: 5000,

  // "Hoy" para las consultas que miran un período: el último día de los datos de ejemplo.
  hoy: ISODate('2026-09-30T23:59:59Z'),
};
