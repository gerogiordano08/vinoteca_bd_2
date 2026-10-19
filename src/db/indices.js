// Estrategia de indización (clase "Índices y rendimiento"): cada índice responde a una consulta
// concreta de la aplicación. La medición con explain("executionStats") está en scripts/medir-rendimiento.js.

const indices = {
  productos: [
    { key: { sku: 1 }, name: 'sku_unico', unique: true },
    // Catálogo: filtra por activo y categoría, y ordena o filtra por precio.
    { key: { activo: 1, categoriaId: 1, precio: 1 }, name: 'catalogo_categoria_precio' },
    // Inicio: destacados activos con stock, ordenados por nombre.
    { key: { destacado: 1, activo: 1, nombre: 1 }, name: 'destacados_por_nombre' },
    // Filtros del catálogo sobre el subdocumento detalleVino.
    { key: { 'detalleVino.color': 1, 'detalleVino.varietal': 1 }, name: 'filtro_color_varietal', sparse: true },
    { key: { bodegaId: 1 }, name: 'por_bodega', sparse: true },
    // Búsqueda del cuadro "Buscar un producto…": índice de texto en español con pesos.
    {
      key: { nombre: 'text', descripcionCorta: 'text', descripcion: 'text' },
      name: 'busqueda_texto',
      weights: { nombre: 10, descripcionCorta: 4, descripcion: 1 },
      default_language: 'spanish',
    },
  ],
  categorias: [{ key: { slug: 1 }, name: 'slug_unico', unique: true }],
  bodegas: [{ key: { nombre: 1 }, name: 'nombre_unico', unique: true }],
  usuarios: [{ key: { email: 1 }, name: 'email_unico', unique: true }],
  carritos: [
    // Un único carrito activo por usuario.
    {
      key: { usuarioId: 1 },
      name: 'carrito_activo_unico',
      unique: true,
      partialFilterExpression: { estado: 'activo' },
    },
    { key: { 'items.productoId': 1 }, name: 'carritos_por_producto' },
  ],
  pedidos: [
    { key: { numero: 1 }, name: 'numero_unico', unique: true },
    { key: { usuarioId: 1, creadoEn: -1 }, name: 'pedidos_de_usuario' },
    { key: { estadoPedido: 1, creadoEn: -1 }, name: 'pedidos_por_estado' },
  ],
  inicio: [
    // Un documento de Inicio por usuario registrado.
    {
      key: { 'usuario.usuarioId': 1 },
      name: 'inicio_por_usuario',
      unique: true,
      partialFilterExpression: { 'usuario.usuarioId': { $exists: true } },
    },
    // Sincronización: ubicar las copias afectadas por un cambio en productos o categorías.
    { key: { 'productosDestacados.productoId': 1 }, name: 'inicio_por_producto' },
    { key: { 'categorias.categoriaId': 1 }, name: 'inicio_por_categoria' },
  ],
  catalogo: [
    {
      key: { 'usuario.usuarioId': 1 },
      name: 'catalogo_por_usuario',
      unique: true,
      partialFilterExpression: { 'usuario.usuarioId': { $exists: true } },
    },
    { key: { 'categorias.categoriaId': 1 }, name: 'catalogo_por_categoria' },
  ],
};

module.exports = { indices };
