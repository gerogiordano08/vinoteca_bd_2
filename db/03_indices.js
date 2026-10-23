// =============================================================================
// 03 · Índices (se crean después de la carga, como se recomienda en clase)
//
// Son los mismos de la aplicación (src/db/indices.js): únicos, compuestos,
// parciales y de texto. La explicación de cada uno está en
// docs/implementacion/guia-indices.md y la medición en rendimiento/medir.js.
//
// Uso:  mongosh db/03_indices.js
// =============================================================================

if (typeof CONFIG === 'undefined') load(__dirname + '/config.js');
if (typeof titulo === 'undefined') load(__dirname + '/utilidades.js');

{
titulo('03 · Índices');
db = db.getSiblingDB(CONFIG.dbName);
const { indices } = require(desdeRaiz('src', 'db', 'indices.js'));
for (const [coleccion, lista] of Object.entries(indices)) {
  for (const { key, ...opciones } of lista) {
    const t = cronometro();
    db.getCollection(coleccion).createIndex(key, opciones);
    const tipo = [opciones.unique && 'único', opciones.partialFilterExpression && 'parcial',
      Object.values(key).includes('text') && 'texto', Object.keys(key).length > 1 && 'compuesto'].filter(Boolean).join(' ') || 'simple';
    print(`    ${`${coleccion}.${opciones.name}`.padEnd(42)} ${tipo.padEnd(16)} ${JSON.stringify(key)}  (${t()})`);
  }
}
}
