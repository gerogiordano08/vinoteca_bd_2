// Datos de ejemplo para cargar la base. Toman los productos, precios y textos de los bocetos de Figma
// (docs/diseno/figma) y los completan hasta los 24 productos que muestra el catálogo.
// Son datos ficticios: bodegas, personas y correos inventados.

const IMG = {
  tinto: '/img/productos/botella-tinto.svg',
  blanco: '/img/productos/botella-blanco.svg',
  rosado: '/img/productos/botella-rosado.svg',
  espumante: '/img/productos/botella-espumante.svg',
  copa: '/img/productos/copa.svg',
  sacacorchos: '/img/productos/sacacorchos.svg',
  decantador: '/img/productos/decantador.svg',
  accesorio: '/img/productos/accesorio.svg',
};

const categorias = [
  { slug: 'vinos', nombre: 'Vinos', descripcion: 'Tintos, blancos y rosados', activa: true },
  { slug: 'espumantes', nombre: 'Espumantes', descripcion: 'Para brindar y compartir', activa: true },
  { slug: 'accesorios', nombre: 'Accesorios', descripcion: 'Para servir y conservar', activa: true },
];

const bodegas = [
  { clave: 'ejemplo', nombre: 'Bodega de ejemplo', provincia: 'Mendoza', region: 'Valle de Uco', descripcion: 'Bodega familiar de altura.' },
  { clave: 'alamos', nombre: 'Finca Los Álamos', provincia: 'Mendoza', region: 'Luján de Cuyo', descripcion: 'Viñedos antiguos de la primera zona.' },
  { clave: 'cerro', nombre: 'Bodega Cerro Azul', provincia: 'San Juan', region: 'Valle de Pedernal', descripcion: 'Vinos de clima frío y suelos calcáreos.' },
  { clave: 'calchaqui', nombre: 'Viñas Calchaquíes', provincia: 'Salta', region: 'Valles Calchaquíes', descripcion: 'Viñedos de gran altura en Cafayate.' },
  { clave: 'patagonia', nombre: 'Bodega Viento Sur', provincia: 'Neuquén', region: 'Patagonia', descripcion: 'Vinos patagónicos de perfil fresco.' },
];

// precio en pesos; stockActual en unidades.
const productos = [
  // --- Vinos ---
  {
    sku: 'VIN-MAL-RES', nombre: 'Malbec Reserva', categoria: 'vinos', bodega: 'ejemplo', tipoProducto: 'vino',
    precio: 18500, stockActual: 12, destacado: true, imagen: IMG.tinto,
    descripcionCorta: 'Un Malbec de perfil frutado, pensado para acompañar tus encuentros.',
    descripcion: 'Malbec de altura con doce meses de crianza en barrica. Notas de ciruela, violetas y un final suave.',
    detalleVino: { color: 'Tinto', varietal: 'Malbec', cosecha: 2023, origenProvincia: 'Mendoza', origenZona: 'Valle de Uco', contenidoMl: 750, graduacionAlcohol: 14, maridajes: ['Carnes rojas', 'Pastas', 'Quesos duros'], temperaturaServicio: '16 a 18 °C' },
  },
  {
    sku: 'VIN-CAB-SAU', nombre: 'Cabernet Sauvignon', categoria: 'vinos', bodega: 'alamos', tipoProducto: 'vino',
    precio: 17800, stockActual: 15, destacado: false, imagen: IMG.tinto,
    descripcionCorta: 'Tinto estructurado, con notas de pimiento y frutos negros.',
    descripcion: 'Cabernet Sauvignon de viñedos de Luján de Cuyo, con taninos firmes y buena guarda.',
    detalleVino: { color: 'Tinto', varietal: 'Cabernet Sauvignon', cosecha: 2022, origenProvincia: 'Mendoza', origenZona: 'Luján de Cuyo', contenidoMl: 750, graduacionAlcohol: 13.8, maridajes: ['Asado', 'Cordero'], temperaturaServicio: '17 a 18 °C' },
  },
  {
    sku: 'VIN-CHA-JOV', nombre: 'Chardonnay Joven', categoria: 'vinos', bodega: 'ejemplo', tipoProducto: 'vino',
    precio: 14200, stockActual: 18, destacado: true, imagen: IMG.blanco,
    descripcionCorta: 'Blanco fresco y frutado, ideal para el aperitivo.',
    descripcion: 'Chardonnay sin paso por madera, con notas de durazno blanco y buena acidez.',
    detalleVino: { color: 'Blanco', varietal: 'Chardonnay', cosecha: 2024, origenProvincia: 'Mendoza', origenZona: 'Tupungato', contenidoMl: 750, graduacionAlcohol: 13, maridajes: ['Pescados', 'Ensaladas'], temperaturaServicio: '8 a 10 °C' },
  },
  {
    sku: 'VIN-MAL-CLA', nombre: 'Malbec Clásico', categoria: 'vinos', bodega: 'alamos', tipoProducto: 'vino',
    precio: 9800, stockActual: 40, destacado: false, imagen: IMG.tinto,
    descripcionCorta: 'El Malbec de todos los días, amable y frutado.',
    descripcion: 'Malbec joven de Maipú, sin crianza, para disfrutar en cualquier comida.',
    detalleVino: { color: 'Tinto', varietal: 'Malbec', cosecha: 2024, origenProvincia: 'Mendoza', origenZona: 'Maipú', contenidoMl: 750, graduacionAlcohol: 13.5, maridajes: ['Pizzas', 'Empanadas'], temperaturaServicio: '15 a 17 °C' },
  },
  {
    sku: 'VIN-BON', nombre: 'Bonarda', categoria: 'vinos', bodega: 'cerro', tipoProducto: 'vino',
    precio: 8900, stockActual: 25, destacado: false, imagen: IMG.tinto,
    descripcionCorta: 'Tinto ligero y especiado, muy fácil de tomar.',
    descripcion: 'Bonarda de San Juan con notas de frutos rojos y un toque de pimienta.',
    detalleVino: { color: 'Tinto', varietal: 'Bonarda', cosecha: 2024, origenProvincia: 'San Juan', origenZona: 'Valle de Tulum', contenidoMl: 750, graduacionAlcohol: 13.2, maridajes: ['Embutidos', 'Pastas'], temperaturaServicio: '15 a 16 °C' },
  },
  {
    sku: 'VIN-TOR', nombre: 'Torrontés', categoria: 'vinos', bodega: 'calchaqui', tipoProducto: 'vino',
    precio: 9500, stockActual: 22, destacado: false, imagen: IMG.blanco,
    descripcionCorta: 'Blanco aromático del norte, floral y refrescante.',
    descripcion: 'Torrontés de Cafayate con notas de jazmín y cítricos.',
    detalleVino: { color: 'Blanco', varietal: 'Torrontés', cosecha: 2024, origenProvincia: 'Salta', origenZona: 'Cafayate', contenidoMl: 750, graduacionAlcohol: 13, maridajes: ['Comida picante', 'Sushi'], temperaturaServicio: '8 a 10 °C' },
  },
  {
    sku: 'VIN-SYR', nombre: 'Syrah', categoria: 'vinos', bodega: 'cerro', tipoProducto: 'vino',
    precio: 11200, stockActual: 14, destacado: false, imagen: IMG.tinto,
    descripcionCorta: 'Tinto intenso con notas de aceituna negra y especias.',
    descripcion: 'Syrah del Valle de Pedernal, con crianza breve en roble.',
    detalleVino: { color: 'Tinto', varietal: 'Syrah', cosecha: 2023, origenProvincia: 'San Juan', origenZona: 'Valle de Pedernal', contenidoMl: 750, graduacionAlcohol: 14, maridajes: ['Carnes de caza', 'Guisos'], temperaturaServicio: '16 a 18 °C' },
  },
  {
    sku: 'VIN-PIN-NOI', nombre: 'Pinot Noir', categoria: 'vinos', bodega: 'patagonia', tipoProducto: 'vino',
    precio: 16900, stockActual: 9, destacado: false, imagen: IMG.tinto,
    descripcionCorta: 'Tinto delicado y elegante de la Patagonia.',
    descripcion: 'Pinot Noir de San Patricio del Chañar con notas de cereza y tierra húmeda.',
    detalleVino: { color: 'Tinto', varietal: 'Pinot Noir', cosecha: 2023, origenProvincia: 'Neuquén', origenZona: 'San Patricio del Chañar', contenidoMl: 750, graduacionAlcohol: 13.5, maridajes: ['Salmón', 'Hongos'], temperaturaServicio: '14 a 16 °C' },
  },
  {
    sku: 'VIN-ROS-MAL', nombre: 'Rosado de Malbec', categoria: 'vinos', bodega: 'ejemplo', tipoProducto: 'vino',
    precio: 10400, stockActual: 16, destacado: false, imagen: IMG.rosado,
    descripcionCorta: 'Rosado seco y vibrante, para tardes de verano.',
    descripcion: 'Rosado de Malbec de prensado directo, con notas de frutilla y pomelo rosado.',
    detalleVino: { color: 'Rosado', varietal: 'Malbec', cosecha: 2024, origenProvincia: 'Mendoza', origenZona: 'Valle de Uco', contenidoMl: 750, graduacionAlcohol: 12.5, maridajes: ['Tapeo', 'Ensaladas'], temperaturaServicio: '8 a 10 °C' },
  },
  {
    sku: 'VIN-SAU-BLA', nombre: 'Sauvignon Blanc', categoria: 'vinos', bodega: 'patagonia', tipoProducto: 'vino',
    precio: 12600, stockActual: 11, destacado: false, imagen: IMG.blanco,
    descripcionCorta: 'Blanco herbal y cítrico, de acidez marcada.',
    descripcion: 'Sauvignon Blanc patagónico con notas de ruda y lima.',
    detalleVino: { color: 'Blanco', varietal: 'Sauvignon Blanc', cosecha: 2024, origenProvincia: 'Neuquén', origenZona: 'Patagonia', contenidoMl: 750, graduacionAlcohol: 12.8, maridajes: ['Mariscos', 'Quesos de cabra'], temperaturaServicio: '7 a 9 °C' },
  },
  {
    sku: 'VIN-CAB-FRA', nombre: 'Cabernet Franc Gran Reserva', categoria: 'vinos', bodega: 'alamos', tipoProducto: 'vino',
    precio: 32500, stockActual: 6, destacado: false, imagen: IMG.tinto,
    descripcionCorta: 'Tinto de guarda, complejo y especiado.',
    descripcion: 'Cabernet Franc con dieciocho meses en barrica francesa. Edición numerada.',
    detalleVino: { color: 'Tinto', varietal: 'Cabernet Franc', cosecha: 2021, origenProvincia: 'Mendoza', origenZona: 'Gualtallary', contenidoMl: 750, graduacionAlcohol: 14.5, maridajes: ['Carnes asadas', 'Quesos estacionados'], temperaturaServicio: '17 a 18 °C' },
  },
  {
    sku: 'VIN-BLE-ALT', nombre: 'Blend de Altura', categoria: 'vinos', bodega: 'calchaqui', tipoProducto: 'vino',
    precio: 24800, stockActual: 8, destacado: false, imagen: IMG.tinto,
    descripcionCorta: 'Corte de Malbec, Cabernet y Tannat de los Valles Calchaquíes.',
    descripcion: 'Blend de viñedos a más de 2.000 metros, intenso y fresco a la vez.',
    detalleVino: { color: 'Tinto', varietal: 'Blend', cosecha: 2022, origenProvincia: 'Salta', origenZona: 'Cafayate', contenidoMl: 750, graduacionAlcohol: 14.2, maridajes: ['Locro', 'Carnes rojas'], temperaturaServicio: '16 a 18 °C' },
  },
  {
    // Sin stock: se muestra en el catálogo como no disponible.
    sku: 'VIN-MER', nombre: 'Merlot', categoria: 'vinos', bodega: 'patagonia', tipoProducto: 'vino',
    precio: 10900, stockActual: 0, destacado: false, imagen: IMG.tinto,
    descripcionCorta: 'Tinto redondo y suave, con notas de ciruela madura.',
    descripcion: 'Merlot del Alto Valle de Río Negro.',
    detalleVino: { color: 'Tinto', varietal: 'Merlot', cosecha: 2023, origenProvincia: 'Río Negro', origenZona: 'Alto Valle', contenidoMl: 750, graduacionAlcohol: 13.2, maridajes: ['Pollo', 'Pastas'], temperaturaServicio: '15 a 17 °C' },
  },
  {
    // Inactivo: no se vende ni aparece en el catálogo (24 productos visibles).
    sku: 'VIN-MAL-LIM', nombre: 'Malbec Edición Limitada 2019', categoria: 'vinos', bodega: 'ejemplo', tipoProducto: 'vino',
    precio: 45000, stockActual: 2, destacado: true, activo: false, imagen: IMG.tinto,
    descripcionCorta: 'Edición discontinuada.',
    descripcion: 'Partida limitada retirada de la venta.',
    detalleVino: { color: 'Tinto', varietal: 'Malbec', cosecha: 2019, origenProvincia: 'Mendoza', origenZona: 'Valle de Uco', contenidoMl: 750, graduacionAlcohol: 14.5, maridajes: ['Carnes rojas'], temperaturaServicio: '17 a 18 °C' },
  },
  // --- Espumantes ---
  {
    sku: 'ESP-BRU-NAT', nombre: 'Brut Nature', categoria: 'espumantes', bodega: 'ejemplo', tipoProducto: 'espumante',
    precio: 21000, stockActual: 10, destacado: true, imagen: IMG.espumante,
    descripcionCorta: 'Espumante seco de burbuja fina, elaborado por método tradicional.',
    descripcion: 'Corte de Chardonnay y Pinot Noir con veinticuatro meses sobre borras.',
    detalleVino: { color: 'Blanco', varietal: 'Chardonnay', cosecha: 2022, origenProvincia: 'Mendoza', origenZona: 'Tupungato', contenidoMl: 750, graduacionAlcohol: 12.5, maridajes: ['Ostras', 'Aperitivos'], temperaturaServicio: '6 a 8 °C', estiloEspumante: 'Brut Nature' },
  },
  {
    sku: 'ESP-EXT-BRU', nombre: 'Extra Brut', categoria: 'espumantes', bodega: 'alamos', tipoProducto: 'espumante',
    precio: 16500, stockActual: 13, destacado: false, imagen: IMG.espumante,
    descripcionCorta: 'Espumante equilibrado, ideal para brindar.',
    descripcion: 'Extra Brut de método Charmat largo, fresco y frutado.',
    detalleVino: { color: 'Blanco', varietal: 'Chardonnay', cosecha: 2023, origenProvincia: 'Mendoza', origenZona: 'Luján de Cuyo', contenidoMl: 750, graduacionAlcohol: 12, maridajes: ['Entradas', 'Postres frutales'], temperaturaServicio: '6 a 8 °C', estiloEspumante: 'Extra Brut' },
  },
  {
    sku: 'ESP-BRU-ROS', nombre: 'Brut Rosé', categoria: 'espumantes', bodega: 'patagonia', tipoProducto: 'espumante',
    precio: 18900, stockActual: 7, destacado: false, imagen: IMG.espumante,
    descripcionCorta: 'Espumante rosado con aromas de frutos rojos.',
    descripcion: 'Brut Rosé de Pinot Noir patagónico.',
    detalleVino: { color: 'Rosado', varietal: 'Pinot Noir', cosecha: 2023, origenProvincia: 'Neuquén', origenZona: 'Patagonia', contenidoMl: 750, graduacionAlcohol: 12, maridajes: ['Salmón', 'Frutillas'], temperaturaServicio: '6 a 8 °C', estiloEspumante: 'Brut' },
  },
  {
    sku: 'ESP-DUL-NAT', nombre: 'Dulce Natural', categoria: 'espumantes', bodega: 'cerro', tipoProducto: 'espumante',
    precio: 9900, stockActual: 20, destacado: false, imagen: IMG.espumante,
    descripcionCorta: 'Espumante dulce y aromático, para el postre.',
    descripcion: 'Espumante de Moscatel de Alejandría, de baja graduación.',
    detalleVino: { color: 'Blanco', varietal: 'Moscatel', cosecha: 2024, origenProvincia: 'San Juan', origenZona: 'Valle de Tulum', contenidoMl: 750, graduacionAlcohol: 9.5, maridajes: ['Postres', 'Frutas'], temperaturaServicio: '5 a 7 °C', estiloEspumante: 'Dulce' },
  },
  // --- Accesorios ---
  {
    sku: 'ACC-COP-CRI', nombre: 'Copa de cristal', categoria: 'accesorios', tipoProducto: 'accesorio',
    precio: 7500, stockActual: 24, destacado: true, imagen: IMG.copa,
    descripcionCorta: 'Para disfrutar cada aroma.',
    descripcion: 'Copa de cristal transparente, ideal para servir vinos tintos y blancos.',
    detalleAccesorio: { material: 'Cristal', unidadVenta: '1 unidad', detalles: 'Capacidad: 450 ml; Cuidado: Lavado a mano' },
  },
  {
    sku: 'ACC-SAC-CLA', nombre: 'Sacacorchos clásico', categoria: 'accesorios', tipoProducto: 'accesorio',
    precio: 6200, stockActual: 30, destacado: false, imagen: IMG.sacacorchos,
    descripcionCorta: 'Sacacorchos de doble palanca, firme y duradero.',
    descripcion: 'Sacacorchos de acero con apertura en dos tiempos y abridor de chapitas.',
    detalleAccesorio: { material: 'Acero', unidadVenta: '1 unidad', detalles: 'Mecanismo: Doble palanca; Incluye: Cortacápsulas' },
  },
  {
    sku: 'ACC-DEC-VID', nombre: 'Decantador de vidrio', categoria: 'accesorios', tipoProducto: 'accesorio',
    precio: 24500, stockActual: 5, destacado: false, imagen: IMG.decantador,
    descripcionCorta: 'Oxigena el vino y realza sus aromas.',
    descripcion: 'Decantador de vidrio soplado de base ancha.',
    detalleAccesorio: { material: 'Vidrio', unidadVenta: '1 unidad', detalles: 'Capacidad: 1.500 ml; Cuidado: Lavado a mano' },
  },
  {
    sku: 'ACC-SET-COP', nombre: 'Set de 6 copas', categoria: 'accesorios', tipoProducto: 'accesorio',
    precio: 39900, stockActual: 6, destacado: false, imagen: IMG.copa,
    descripcionCorta: 'Seis copas de cristal en caja de regalo.',
    descripcion: 'Set de copas universales de cristal para tintos, blancos y espumantes.',
    detalleAccesorio: { material: 'Cristal', unidadVenta: 'Caja de 6 unidades', detalles: 'Capacidad: 450 ml; Cuidado: Apto lavavajillas' },
  },
  {
    sku: 'ACC-TAP-VAC', nombre: 'Tapón al vacío', categoria: 'accesorios', tipoProducto: 'accesorio',
    precio: 3900, stockActual: 50, destacado: false, imagen: IMG.accesorio,
    descripcionCorta: 'Conserva el vino abierto por más días.',
    descripcion: 'Tapones con bomba de vacío para conservar botellas abiertas.',
    detalleAccesorio: { material: 'Silicona y acero', unidadVenta: 'Pack de 2', detalles: 'Uso: Botellas de 750 ml' },
  },
  {
    sku: 'ACC-ENF-BOT', nombre: 'Enfriador de botellas', categoria: 'accesorios', tipoProducto: 'accesorio',
    precio: 14800, stockActual: 9, destacado: false, imagen: IMG.accesorio,
    descripcionCorta: 'Mantiene la temperatura ideal en la mesa.',
    descripcion: 'Enfriador de doble pared de acero inoxidable.',
    detalleAccesorio: { material: 'Acero inoxidable', unidadVenta: '1 unidad', detalles: 'Capacidad: 1 botella; Cuidado: Lavado a mano' },
  },
  {
    sku: 'ACC-AIR-VIN', nombre: 'Aireador de vino', categoria: 'accesorios', tipoProducto: 'accesorio',
    precio: 8700, stockActual: 0, destacado: false, imagen: IMG.accesorio,
    descripcionCorta: 'Airea el vino al servirlo, sin esperas.',
    descripcion: 'Aireador de acrílico con base antigoteo.',
    detalleAccesorio: { material: 'Acrílico', unidadVenta: '1 unidad', detalles: 'Uso: Vinos tintos jóvenes' },
  },
];

const tienda = {
  nombreComercial: 'vinoteca',
  logoUrl: '/img/logo.svg',
  emailContacto: 'contacto@vinoteca.test',
  telefonoContacto: '261 400-0000',
  direccionComercial: { calleNumero: 'Av. San Martín 1234', localidad: 'Ciudad de Mendoza', provincia: 'Mendoza', codigoPostal: '5500', horario: 'Lunes a sábado de 10 a 20 h' },
  monedaBase: 'ARS',
  retiroHabilitado: true,
  enviosHabilitados: true,
  montoEnvioBase: 4500,
  redesSociales: { instagram: 'https://instagram.com/vinoteca.ejemplo', whatsapp: 'https://wa.me/5492614000000' },
};

// Cuentas de prueba (contraseñas de ejemplo para desarrollo local; ver README).
const usuarios = [
  { nombre: 'Ana', apellido: 'Pérez', email: 'ana@example.com', password: 'vinoteca123', telefono: '261 555-0101', rol: 'cliente',
    direcciones: [{ alias: 'Casa', calleNumero: 'Belgrano 456', localidad: 'Godoy Cruz', provincia: 'Mendoza', codigoPostal: '5501', referencias: 'Portón negro' }] },
  { nombre: 'Administración', apellido: 'Vinoteca', email: 'admin@vinoteca.test', password: 'admin2026', telefono: '261 400-0000', rol: 'administrador', direcciones: [] },
];

const NOMBRES = ['Lucía', 'Martín', 'Sofía', 'Joaquín', 'Valentina', 'Tomás', 'Camila', 'Facundo', 'Julieta', 'Nicolás', 'Florencia', 'Agustín', 'Micaela', 'Santiago', 'Paula', 'Ignacio', 'Carolina', 'Matías', 'Rocío', 'Bruno'];
const APELLIDOS = ['Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Romero', 'Sosa', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Acosta', 'Benítez', 'Medina', 'Herrera', 'Suárez', 'Aguirre', 'Giménez', 'Molina'];
const LOCALIDADES = [['Ciudad de Mendoza', 'Mendoza', '5500'], ['Godoy Cruz', 'Mendoza', '5501'], ['Guaymallén', 'Mendoza', '5519'], ['Luján de Cuyo', 'Mendoza', '5507'], ['Maipú', 'Mendoza', '5515'], ['San Juan', 'San Juan', '5400']];

module.exports = { categorias, bodegas, productos, tienda, usuarios, NOMBRES, APELLIDOS, LOCALIDADES };
