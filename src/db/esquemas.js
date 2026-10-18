// Validadores $jsonSchema de las nueve colecciones del modelo
// (docs/Modelo_Vinoteca_MongoDB_Diseno_Editorial_Actualizado.docx).
//
// El modelo deja pendiente la obligatoriedad general de los atributos. Acá solo se exigen los campos
// sin los cuales la aplicación no funciona; el resto se valida por tipo cuando está presente.
// Las decisiones que completan puntos pendientes del modelo están en docs/implementacion/decisiones.md.

const texto = { bsonType: 'string' };
const textoNoVacio = { bsonType: 'string', minLength: 1 };
const id = { bsonType: 'objectId' };
const fecha = { bsonType: 'date' };
const booleano = { bsonType: 'bool' };
const entero = { bsonType: 'int', minimum: 0 };
const importe = { bsonType: 'decimal' };
const arregloDeTexto = { bsonType: 'array', items: texto };

const detalleVino = {
  bsonType: 'object',
  properties: {
    color: texto,
    varietal: texto,
    cosecha: { bsonType: 'int' },
    origenProvincia: texto,
    origenZona: texto,
    contenidoMl: entero,
    graduacionAlcohol: importe,
    maridajes: arregloDeTexto,
    temperaturaServicio: texto,
    estiloEspumante: texto,
  },
};

const detalleAccesorio = {
  bsonType: 'object',
  properties: { material: texto, unidadVenta: texto, detalles: texto },
};

const direccion = {
  bsonType: 'object',
  properties: {
    alias: texto,
    calleNumero: texto,
    localidad: texto,
    provincia: texto,
    codigoPostal: texto,
    referencias: texto,
  },
};

// Subdocumentos compartidos de las colecciones de página (inicio y catalogo).
const usuarioCopia = {
  bsonType: ['object', 'null'],
  required: ['usuarioId'],
  properties: { usuarioId: id, nombre: texto, apellido: texto },
};

const tiendaCopia = {
  bsonType: 'object',
  properties: { configuracionId: id, nombreComercial: texto, logoUrl: texto, monedaBase: texto },
};

const carritoResumen = {
  bsonType: 'object',
  required: ['cantidadArticulos'],
  properties: { carritoId: id, cantidadArticulos: entero },
};

const categoriaCopia = {
  bsonType: 'object',
  properties: { categoriaId: id, nombre: texto, descripcion: texto, slug: texto },
};

const resumenProducto = {
  bsonType: 'object',
  required: ['productoId', 'nombre', 'precio'],
  properties: {
    productoId: id,
    nombre: texto,
    descripcionCorta: texto,
    precio: importe,
    imagen: texto,
    categoria: {
      bsonType: 'object',
      properties: { categoriaId: id, nombre: texto, slug: texto },
    },
    detalleVino: {
      bsonType: 'object',
      properties: { color: texto, origenProvincia: texto, contenidoMl: entero, varietal: texto },
    },
    detalleAccesorio: {
      bsonType: 'object',
      properties: { material: texto, unidadVenta: texto },
    },
    // Campos que agrega catalogo.productos[]:
    bodega: texto,
    disponible: booleano,
    destacado: booleano,
  },
};

// Un documento de página pertenece a un usuario registrado (usuario con datos, sin visitanteId)
// o a un visitante (usuario null y visitanteId), tal como define el modelo.
const propietarioDePagina = {
  oneOf: [
    { required: ['visitanteId'], properties: { usuario: { bsonType: 'null' } } },
    { not: { required: ['visitanteId'] }, properties: { usuario: { bsonType: 'object' } } },
  ],
};

const esquemas = {
  productos: {
    bsonType: 'object',
    required: ['sku', 'nombre', 'precio', 'categoriaId', 'tipoProducto', 'stockActual', 'activo'],
    properties: {
      sku: textoNoVacio,
      nombre: textoNoVacio,
      descripcion: texto,
      descripcionCorta: texto,
      precio: importe,
      categoriaId: id,
      bodegaId: id,
      tipoProducto: { enum: ['vino', 'espumante', 'accesorio'] },
      imagenes: arregloDeTexto,
      stockActual: entero,
      destacado: booleano,
      activo: booleano,
      detalleVino,
      detalleAccesorio,
    },
  },

  categorias: {
    bsonType: 'object',
    required: ['nombre', 'slug', 'activa'],
    properties: {
      nombre: textoNoVacio,
      slug: { bsonType: 'string', pattern: '^[a-z0-9-]+$' },
      descripcion: texto,
      imagenUrl: texto,
      activa: booleano,
    },
  },

  bodegas: {
    bsonType: 'object',
    required: ['nombre', 'activa'],
    properties: {
      nombre: textoNoVacio,
      descripcion: texto,
      provincia: texto,
      region: texto,
      logoUrl: texto,
      activa: booleano,
    },
  },

  usuarios: {
    bsonType: 'object',
    required: ['nombre', 'apellido', 'email', 'passwordHash', 'rol', 'activo', 'creadoEn'],
    properties: {
      nombre: textoNoVacio,
      apellido: textoNoVacio,
      email: { bsonType: 'string', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' },
      passwordHash: textoNoVacio,
      telefono: texto,
      rol: { enum: ['cliente', 'administrador'] },
      direcciones: { bsonType: 'array', items: direccion },
      activo: booleano,
      creadoEn: fecha,
    },
  },

  carritos: {
    bsonType: 'object',
    required: ['usuarioId', 'items', 'estado', 'actualizadoEn'],
    properties: {
      usuarioId: id,
      items: {
        bsonType: 'array',
        items: {
          bsonType: 'object',
          required: ['productoId', 'cantidad'],
          properties: { productoId: id, cantidad: { bsonType: 'int', minimum: 1 }, agregadoEn: fecha },
        },
      },
      actualizadoEn: fecha,
      estado: { enum: ['activo', 'convertido', 'abandonado'] },
    },
  },

  pedidos: {
    bsonType: 'object',
    required: ['numero', 'usuarioId', 'items', 'subtotal', 'total', 'estadoPedido', 'creadoEn'],
    properties: {
      numero: textoNoVacio,
      usuarioId: id,
      items: {
        bsonType: 'array',
        minItems: 1,
        items: {
          bsonType: 'object',
          required: ['productoId', 'nombre', 'precioUnitario', 'cantidad', 'subtotal'],
          properties: {
            productoId: id,
            nombre: texto,
            precioUnitario: importe,
            cantidad: { bsonType: 'int', minimum: 1 },
            subtotal: importe,
          },
        },
      },
      // Estructura definida en la implementación (el modelo la dejaba pendiente).
      direccionEntrega: {
        bsonType: 'object',
        required: ['tipo'],
        properties: {
          tipo: { enum: ['retiro', 'envio'] },
          calleNumero: texto,
          localidad: texto,
          provincia: texto,
          codigoPostal: texto,
          referencias: texto,
          notas: texto,
          contacto: {
            bsonType: 'object',
            properties: { nombre: texto, apellido: texto, email: texto, telefono: texto },
          },
        },
      },
      subtotal: importe,
      descuento: importe,
      costoEnvio: importe,
      total: importe,
      estadoPedido: { enum: ['pendiente', 'confirmado', 'listo_para_retirar', 'enviado', 'entregado', 'cancelado'] },
      creadoEn: fecha,
    },
  },

  configuracion_tienda: {
    bsonType: 'object',
    required: ['nombreComercial', 'monedaBase'],
    properties: {
      nombreComercial: textoNoVacio,
      logoUrl: texto,
      emailContacto: texto,
      telefonoContacto: texto,
      direccionComercial: {
        bsonType: 'object',
        properties: { calleNumero: texto, localidad: texto, provincia: texto, codigoPostal: texto, horario: texto },
      },
      monedaBase: textoNoVacio,
      retiroHabilitado: booleano,
      enviosHabilitados: booleano,
      montoEnvioBase: importe,
      redesSociales: {
        bsonType: 'object',
        properties: { instagram: texto, facebook: texto, whatsapp: texto },
      },
    },
  },

  inicio: {
    bsonType: 'object',
    required: ['usuario', 'tienda', 'carrito', 'categorias', 'presentacion', 'productosDestacados'],
    ...propietarioDePagina,
    properties: {
      visitanteId: texto,
      usuario: usuarioCopia,
      tienda: tiendaCopia,
      carrito: carritoResumen,
      categorias: { bsonType: 'array', items: categoriaCopia },
      presentacion: {
        bsonType: 'object',
        properties: { titulo: texto, descripcion: texto, imagenes: arregloDeTexto },
      },
      productosDestacados: { bsonType: 'array', maxItems: 4, items: resumenProducto },
    },
  },

  catalogo: {
    bsonType: 'object',
    required: ['usuario', 'tienda', 'carrito', 'categorias', 'opcionesFiltro', 'consulta', 'productos', 'paginacion'],
    ...propietarioDePagina,
    properties: {
      visitanteId: texto,
      usuario: usuarioCopia,
      tienda: tiendaCopia,
      carrito: carritoResumen,
      categorias: { bsonType: 'array', items: categoriaCopia },
      opcionesFiltro: {
        bsonType: 'object',
        properties: { colores: arregloDeTexto, varietales: arregloDeTexto },
      },
      consulta: {
        bsonType: 'object',
        properties: {
          texto,
          categoriaIds: { bsonType: 'array', items: id },
          colores: arregloDeTexto,
          varietales: arregloDeTexto,
          precioMinimo: importe,
          precioMaximo: importe,
          orden: { enum: ['destacados', 'precio_asc', 'precio_desc', 'nombre_asc'] },
        },
      },
      productos: { bsonType: 'array', items: resumenProducto },
      paginacion: {
        bsonType: 'object',
        required: ['paginaActual', 'productosPorPagina', 'totalProductos', 'totalPaginas'],
        properties: {
          paginaActual: { bsonType: 'int', minimum: 1 },
          productosPorPagina: { bsonType: 'int', minimum: 1 },
          totalProductos: entero,
          totalPaginas: entero,
        },
      },
    },
  },
};

module.exports = { esquemas, COLECCIONES: Object.keys(esquemas) };
