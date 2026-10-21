// Consultas avanzadas para mongosh. Desde la carpeta del proyecto:
//   mongosh vinoteca consultas/consultas.mongodb.js
// Las mismas consultas, con salida en tablas, se ejecutan con `npm run consultas`.
const consultas = require(require('path').resolve('consultas/avanzadas.js'));

for (const c of consultas) {
  print(`\n=== ${c.titulo} (${c.coleccion}) ===`);
  printjson(db.getCollection(c.coleccion).aggregate(c.pipeline).toArray());
}
