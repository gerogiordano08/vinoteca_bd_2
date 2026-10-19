// Mismos productos que generar-productos.js, reutilizando los archivos de imagen originales.
// Uso: npm run db:volumen:compartidas
const { ejecutarGenerador } = require('./generar-productos');

if (require.main === module) ejecutarGenerador({ imagenesCompartidas: true });
