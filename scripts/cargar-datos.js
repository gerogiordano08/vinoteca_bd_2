// Carga los datos de ejemplo. Borra el contenido de las nueve colecciones y lo vuelve a cargar.
// Uso: npm run db:seed   (o npm run db:setup para crear colecciones, índices y datos)
const bcrypt = require('bcryptjs');
const { conectar, desconectar } = require('../src/db/conexion');
const { prepararBase } = require('../src/db/preparar');
const { COLECCIONES } = require('../src/db/esquemas');
const { aDecimal, aNumero, multiplicar, sumar } = require('../src/util/dinero');
const { RONDAS } = require('../src/servicios/usuarios');
const datos = require('../src/datos/ejemplo');
const config = require('../src/config');

// Generador pseudoaleatorio con semilla fija: siempre produce los mismos pedidos.
function generador(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function cargar(db, { cantidadClientes = 40, cantidadPedidos = 180, log = () => {} } = {}) {
  await prepararBase(db);
  for (const nombre of COLECCIONES) await db.collection(nombre).deleteMany({});
  const azar = generador(20261018);
  const elegir = (lista) => lista[Math.floor(azar() * lista.length)];

  // Categorías y bodegas
  const categorias = await db.collection('categorias').insertMany(datos.categorias.map((c) => ({ ...c, imagenUrl: `/img/categorias/${c.slug}.svg` })));
  const idCategoria = Object.fromEntries(datos.categorias.map((c, i) => [c.slug, categorias.insertedIds[i]]));
  const bodegas = await db.collection('bodegas').insertMany(datos.bodegas.map(({ clave, ...b }) => ({ ...b, logoUrl: '/img/logo.svg', activa: true })));
  const idBodega = Object.fromEntries(datos.bodegas.map((b, i) => [b.clave, bodegas.insertedIds[i]]));

  // Productos
  const productos = datos.productos.map(({ categoria, bodega, imagen, precio, activo = true, detalleVino, ...p }) => {
    const doc = { ...p, precio: aDecimal(precio), categoriaId: idCategoria[categoria], imagenes: [imagen], activo };
    if (bodega) doc.bodegaId = idBodega[bodega];
    if (detalleVino) doc.detalleVino = { ...detalleVino, graduacionAlcohol: aDecimal(detalleVino.graduacionAlcohol) };
    return doc;
  });
  const insertados = await db.collection('productos').insertMany(productos);
  productos.forEach((p, i) => { p._id = insertados.insertedIds[i]; });
  log(`${productos.length} productos (${productos.filter((p) => p.activo).length} activos)`);

  // Tienda
  await db.collection('configuracion_tienda').insertOne({ ...datos.tienda, montoEnvioBase: aDecimal(datos.tienda.montoEnvioBase) });

  // Usuarios: cuentas de prueba y clientes generados
  const ahora = new Date('2026-10-18T12:00:00-03:00');
  const usuarios = [];
  for (const u of datos.usuarios) {
    const { password, ...resto } = u;
    usuarios.push({ ...resto, passwordHash: await bcrypt.hash(password, RONDAS), activo: true, creadoEn: new Date('2026-01-05T10:00:00-03:00') });
  }
  const hashGenerico = await bcrypt.hash('cliente2026', RONDAS);
  for (let i = 0; i < cantidadClientes; i++) {
    const nombre = elegir(datos.NOMBRES);
    const apellido = elegir(datos.APELLIDOS);
    const [localidad, provincia, codigoPostal] = elegir(datos.LOCALIDADES);
    usuarios.push({
      nombre, apellido,
      email: `cliente${String(i + 1).padStart(2, '0')}@ejemplo.test`,
      passwordHash: hashGenerico,
      telefono: `261 555-${String(1000 + i)}`,
      rol: 'cliente',
      direcciones: [{ alias: 'Casa', calleNumero: `Calle ${100 + i} ${Math.floor(azar() * 900) + 100}`, localidad, provincia, codigoPostal, referencias: '' }],
      activo: i % 13 !== 12,
      creadoEn: new Date(2026, Math.floor(azar() * 9), 1 + Math.floor(azar() * 27)),
    });
  }
  const insertadosUsuarios = await db.collection('usuarios').insertMany(usuarios);
  usuarios.forEach((u, i) => { u._id = insertadosUsuarios.insertedIds[i]; });
  const ana = usuarios[0];
  const clientes = usuarios.filter((u) => u.rol === 'cliente');
  log(`${usuarios.length} usuarios`);

  // Pedidos históricos (enero a octubre de 2026). Los precios de compra son los de ese momento:
  // los pedidos viejos guardan precios algo menores que los actuales (datos históricos).
  const vendibles = productos.filter((p) => p.activo);
  const estados = ['entregado', 'entregado', 'entregado', 'entregado', 'listo_para_retirar', 'enviado', 'confirmado', 'cancelado'];
  const pedidos = [];
  for (let i = 0; i < cantidadPedidos; i++) {
    const cliente = elegir(clientes);
    const creadoEn = new Date(2026, Math.floor(azar() * 9), 1 + Math.floor(azar() * 27), 10 + Math.floor(azar() * 10));
    const ajuste = 0.85 + 0.15 * (creadoEn.getMonth() / 9); // precios más bajos al principio del año
    const elegidos = new Map();
    const cantidadItems = 1 + Math.floor(azar() * 3);
    while (elegidos.size < cantidadItems) {
      const p = elegir(vendibles);
      elegidos.set(String(p._id), { p, cantidad: 1 + Math.floor(azar() * 3) });
    }
    const items = [...elegidos.values()].map(({ p, cantidad }) => {
      const precio = Math.round((aNumero(p.precio) * ajuste) / 100) * 100;
      return { productoId: p._id, nombre: p.nombre, precioUnitario: aDecimal(precio), cantidad, subtotal: aDecimal(multiplicar(precio, cantidad)) };
    });
    const envio = azar() < 0.4;
    const costoEnvio = envio ? 4500 : 0;
    const subtotal = sumar(...items.map((it) => it.subtotal));
    const direccion = cliente.direcciones[0];
    pedidos.push({
      numero: `V-${1001 + i}`,
      usuarioId: cliente._id,
      items,
      direccionEntrega: envio
        ? { tipo: 'envio', calleNumero: direccion.calleNumero, localidad: direccion.localidad, provincia: direccion.provincia, codigoPostal: direccion.codigoPostal, contacto: { nombre: cliente.nombre, apellido: cliente.apellido, email: cliente.email, telefono: cliente.telefono } }
        : { tipo: 'retiro', contacto: { nombre: cliente.nombre, apellido: cliente.apellido, email: cliente.email, telefono: cliente.telefono } },
      subtotal: aDecimal(subtotal),
      descuento: aDecimal(0),
      costoEnvio: aDecimal(costoEnvio),
      total: aDecimal(subtotal + costoEnvio),
      estadoPedido: elegir(estados),
      creadoEn,
    });
  }
  pedidos.sort((a, b) => a.creadoEn - b.creadoEn).forEach((p, i) => { p.numero = `V-${1001 + i}`; });
  await db.collection('pedidos').insertMany(pedidos);
  log(`${pedidos.length} pedidos`);

  // Carritos: el de Ana con los dos productos del boceto (Malbec Reserva y Copa de cristal) y algunos abandonados.
  const porSku = Object.fromEntries(productos.map((p) => [p.sku, p]));
  await db.collection('carritos').insertMany([
    {
      usuarioId: ana._id, estado: 'activo', actualizadoEn: ahora,
      items: [
        { productoId: porSku['VIN-MAL-RES']._id, cantidad: 1, agregadoEn: new Date('2026-10-18T11:40:00-03:00') },
        { productoId: porSku['ACC-COP-CRI']._id, cantidad: 1, agregadoEn: new Date('2026-10-18T11:42:00-03:00') },
      ],
    },
    ...clientes.slice(1, 6).map((c, i) => ({
      usuarioId: c._id, estado: 'abandonado', actualizadoEn: new Date(2026, 8, 1 + i * 4),
      items: [{ productoId: elegir(vendibles)._id, cantidad: 1, agregadoEn: new Date(2026, 8, 1 + i * 4) }],
    })),
  ]);
  log('6 carritos');
  // inicio y catalogo se guardan al entrar un usuario registrado; los visitantes no persisten páginas.
  return { productos: productos.length, usuarios: usuarios.length, pedidos: pedidos.length };
}

if (require.main === module) {
  (async () => {
    try {
      const db = await conectar();
      console.log(`Cargando datos de ejemplo en ${config.baseDatos}...`);
      await cargar(db, { log: (m) => console.log(`  ${m}`) });
      console.log('Listo. Cuentas de prueba: ana@example.com / vinoteca123 y admin@vinoteca.test / admin2026');
    } catch (error) {
      console.error('No se pudieron cargar los datos:', error);
      process.exitCode = 1;
    } finally {
      await desconectar();
    }
  })();
}

module.exports = { cargar };
