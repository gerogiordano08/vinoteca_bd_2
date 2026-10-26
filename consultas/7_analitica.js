// =============================================================================
// Reportes ANALÍTICOS: las 10 consultas avanzadas (consultas/avanzadas.js)
// Son las mismas que se ven en Compass como vistas consulta_01 … consulta_10.
// Uso:  mongosh consultas/7_analitica.js
// =============================================================================

if (typeof mostrar === 'undefined') load(__dirname + '/lib.js');

{
seccion('7 · REPORTES (consultas avanzadas)');
const consultas = require(require('path').join(__dirname, 'avanzadas.js'));
for (const c of consultas) {
  mostrar(`${c.titulo}  [${c.coleccion}]`, () => db.getCollection(c.coleccion).aggregate(c.pipeline), { limite: 6 });
}
}
