// =============================================================================
// 00 · Crea la base y sus 9 colecciones, todas con validación $jsonSchema
//
// Los validadores son los mismos que usa la aplicación (src/db/esquemas.js):
// validationLevel "strict" y validationAction "error", así MongoDB rechaza los
// documentos que no cumplen el esquema.
//
// Uso:  mongosh db/00_crear_db.js      ATENCIÓN: borra la base si ya existe.
// =============================================================================

if (typeof CONFIG === 'undefined') load(__dirname + '/config.js');
if (typeof titulo === 'undefined') load(__dirname + '/utilidades.js');

{
titulo(`00 · Crear la base "${CONFIG.dbName}"`);
db = db.getSiblingDB(CONFIG.dbName);
db.dropDatabase();

const { esquemas } = require(desdeRaiz('src', 'db', 'esquemas.js'));
for (const [nombre, esquema] of Object.entries(esquemas)) {
  db.createCollection(nombre, {
    validator: { $jsonSchema: esquema },
    validationLevel: 'strict',
    validationAction: 'error',
  });
  print(`    ${nombre.padEnd(22)} creada con $jsonSchema (${(esquema.required || []).length} campos obligatorios)`);
}
}
