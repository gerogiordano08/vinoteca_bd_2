// =============================================================================
// 02 · Carga masiva, para medir los índices con volumen
//
//   productos  copias de los 24 productos a la venta, SKU VOL-0000001…
//              (mismas reglas que npm run db:volumen:compartidas: nombre "· muestra N",
//               precio 3000 + (i·7919) mod 47001, stock i mod 61, imagen compartida)
//   usuarios   clientes sintéticos volumen00001@ejemplo.test…
//   pedidos    pedidos de esos clientes, números V-100001…, entre oct-2025 y sep-2026
//
// Las cuentas de prueba (Ana, cliente01…, demo-…) no reciben pedidos masivos.
// Los datos son siempre los mismos: el generador pseudoaleatorio usa una semilla fija.
// Cantidades en db/config.js (o variables PRODUCTOS, USUARIOS y PEDIDOS).
// Uso:  mongosh db/02_datos_masivos.js   (después de 01_datos.js)
// =============================================================================

if (typeof CONFIG === 'undefined') load(__dirname + '/config.js');
if (typeof titulo === 'undefined') load(__dirname + '/utilidades.js');

{
titulo('02 · Carga masiva');
db = db.getSiblingDB(CONFIG.dbName);
const { productos: cantProductos, usuarios: cantUsuarios, pedidos: cantPedidos } = CONFIG.masivos;
const DIA = 24 * 3600 * 1000;

// --- productos ---------------------------------------------------------------
const plantillas = db.productos.find({ activo: true }).sort({ _id: 1 }).toArray();
insertarEnLotes('productos', cantProductos, (i) => {
  const { _id, ...p } = plantillas[i % plantillas.length];
  const sku = `VOL-${String(i + 1).padStart(7, '0')}`;
  return {
    ...p,
    sku,
    nombre: `${p.nombre.split(' · muestra ')[0]} · muestra ${i + 1}`,
    precio: Decimal128.fromString((3000 + (i * 7919) % 47001).toFixed(2)),
    stockActual: i % 61,
    activo: true,
    destacado: false,
  };
});

// --- usuarios ----------------------------------------------------------------
// Se copia un cliente de ejemplo (misma estructura y contraseña de desarrollo: cliente2026).
const modelo = db.usuarios.findOne({ email: 'cliente01@ejemplo.test' });
const { NOMBRES, APELLIDOS } = require(desdeRaiz('src', 'datos', 'ejemplo.js'));
const idsUsuarios = [];
insertarEnLotes('usuarios', cantUsuarios, (i) => {
  const _id = new ObjectId();
  idsUsuarios.push(_id);
  const n = String(i + 1).padStart(5, '0');
  return {
    ...modelo,
    _id,
    email: `volumen${n}@ejemplo.test`,
    // Todas las combinaciones de nombre y apellido antes de repetir una.
    nombre: NOMBRES[i % NOMBRES.length],
    apellido: APELLIDOS[Math.floor(i / NOMBRES.length) % APELLIDOS.length],
    creadoEn: new Date(Date.UTC(2025, 6, 1) + (i % 450) * DIA),
  };
});

// --- pedidos -----------------------------------------------------------------
// Cada pedido copia los ítems y totales de un pedido de ejemplo (precios históricos válidos)
// y cambia número, cliente, contacto, estado y fecha.
if (cantPedidos > 0 && idsUsuarios.length === 0) {
  throw new Error('Para generar pedidos masivos hacen falta usuarios masivos (USUARIOS > 0).');
}
const modelos = db.pedidos.find().sort({ numero: 1 }).toArray();
const usuarios = db.usuarios.find({ _id: { $in: idsUsuarios } }, { nombre: 1, apellido: 1, email: 1 }).toArray();
const ESTADOS = ['entregado', 'entregado', 'entregado', 'enviado', 'listo_para_retirar', 'confirmado', 'pendiente', 'cancelado'];
const desde = Date.UTC(2025, 9, 1, 12);
// Generador pseudoaleatorio (mulberry32) con semilla fija: cada corrida da los mismos pedidos.
let semilla = 20261023;
const azar = (n) => {
  semilla = (semilla + 0x6D2B79F5) | 0;
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return Math.floor((((t ^ (t >>> 14)) >>> 0) / 4294967296) * n);
};
insertarEnLotes('pedidos', cantPedidos, (i) => {
  const { _id, ...p } = modelos[azar(modelos.length)];
  const u = usuarios[azar(usuarios.length)];
  return {
    ...p,
    numero: `V-${100001 + i}`,
    usuarioId: u._id,
    direccionEntrega: { ...p.direccionEntrega, contacto: { ...p.direccionEntrega.contacto, nombre: u.nombre, apellido: u.apellido, email: u.email } },
    estadoPedido: ESTADOS[azar(ESTADOS.length)],
    creadoEn: new Date(desde + azar(365) * DIA + azar(10) * 3600 * 1000),
  };
});
print(`    Total: ${miles(db.productos.estimatedDocumentCount())} productos, ${miles(db.usuarios.estimatedDocumentCount())} usuarios y ${miles(db.pedidos.estimatedDocumentCount())} pedidos`);
}
