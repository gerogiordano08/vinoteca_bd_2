// =============================================================================
// Ejecuta todas las consultas, pantalla por pantalla.
// Uso (desde la carpeta del proyecto):  mongosh consultas/todas.js
// =============================================================================

load(__dirname + '/lib.js');
for (const script of ['1_inicio.js', '2_catalogo.js', '3_producto.js', '4_carrito.js', '5_pedido.js', '6_cuenta.js', '7_analitica.js']) {
  load(`${__dirname}/${script}`);
}
