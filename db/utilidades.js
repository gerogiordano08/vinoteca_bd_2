// =============================================================================
// Auxiliares de los scripts de db/
// =============================================================================

// Raíz del proyecto, para leer los módulos de la aplicación (esquemas, índices y consultas).
globalThis.RAIZ = require('path').resolve(__dirname, '..');
globalThis.desdeRaiz = (...partes) => require('path').join(RAIZ, ...partes);

globalThis.titulo = (texto) => print(`\n── ${texto} ${'─'.repeat(Math.max(0, 72 - texto.length))}`);

globalThis.cronometro = () => {
  const inicio = Date.now();
  return () => {
    const s = (Date.now() - inicio) / 1000;
    return s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
  };
};

globalThis.miles = (n) => n.toLocaleString('es-AR');

// Inserta en lotes y muestra el avance. "crear(i)" devuelve el documento número i (desde 0).
globalThis.insertarEnLotes = (coleccion, cantidad, crear) => {
  for (let desde = 0; desde < cantidad; desde += CONFIG.lote) {
    const lote = [];
    for (let i = desde; i < Math.min(desde + CONFIG.lote, cantidad); i++) lote.push(crear(i));
    db.getCollection(coleccion).insertMany(lote, { ordered: false });
    if ((desde / CONFIG.lote) % 10 === 9 || desde + CONFIG.lote >= cantidad) {
      print(`    ${coleccion}: ${miles(Math.min(desde + CONFIG.lote, cantidad))} / ${miles(cantidad)}`);
    }
  }
};
