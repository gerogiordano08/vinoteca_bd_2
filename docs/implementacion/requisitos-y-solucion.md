# Requisitos y solución propuesta

Primera parte de la fase b de la consigna del Ing. Zapata: planteo de las necesidades y de la solución.

## Problemática

Una vinoteca de Mendoza quiere vender por internet vinos, espumantes y accesorios. Necesita que cualquier persona pueda recorrer el catálogo y que quienes tienen cuenta puedan comprar, retirar en el local o recibir el pedido en su domicilio, y consultar después sus compras.

## Requisitos funcionales

| N.º | Requisito | Dónde se resuelve |
| --- | --- | --- |
| RF1 | Mostrar una página de inicio con categorías y hasta cuatro productos destacados. | Colección `inicio`, página `/` |
| RF2 | Buscar productos por texto o bodega, filtrar por categoría, tipo de vino, varietal y precio, ordenar y paginar. | Consulta directa a `productos`; `catalogo` conserva la consulta y configuración del usuario. |
| RF3 | Ver el detalle de un vino, espumante o accesorio, con su disponibilidad. | Colección `productos`, página `/productos/:id` |
| RF4 | Crear una cuenta, iniciar y cerrar sesión, y cambiar los datos personales y la contraseña. | Colección `usuarios`, páginas `/cuenta/*` |
| RF5 | Navegar como visitante sin persistir páginas; para agregar al carrito, pedir que inicie sesión o se registre. | Vistas públicas calculadas por petición; documentos de `inicio` y `catalogo` solo para usuarios registrados existentes. |
| RF6 | Mantener un carrito por usuario, con cantidades limitadas al stock. | Colección `carritos`, página `/carrito` |
| RF7 | Registrar el pedido con retiro en tienda o envío a domicilio, descontar stock y conservar el precio del momento. | Colección `pedidos`, páginas `/pedido/*` |
| RF8 | Consultar los pedidos y su estado. | Página `/cuenta/pedidos` |
| RF9 | Guardar direcciones de entrega. | `usuarios.direcciones`, página `/cuenta/direcciones` |
| RF10 | Conservar la última búsqueda del catálogo de cada persona. | Colección `catalogo` |

## Requisitos no funcionales

- **Lecturas rápidas en las páginas más visitadas.** Inicio conserva un documento personalizado. Catálogo guarda metadatos y consulta; sus productos, totales y opciones de filtro se obtienen mediante consultas a las colecciones de origen, donde se evalúa el rendimiento de los índices.
- **Integridad de los datos.** Cada colección tiene un validador `$jsonSchema`, y los índices únicos evitan SKU, correos, números de pedido y carritos activos duplicados.
- **Importes sin errores de redondeo.** Los precios y totales se guardan como `Decimal128`.
- **Datos históricos inalterables.** Un pedido no cambia aunque cambie el catálogo.
- **Seguridad básica.** Las contraseñas se guardan con hash bcrypt, la sesión usa cookie `httpOnly` y `sameSite`, y se regenera al iniciar sesión.
- **Resguardo y recuperación.** Hay backup comprimido con retención, y la restauración se prueba en otra base.

## Por qué MongoDB y por qué este modelo

El catálogo mezcla productos con atributos distintos: los vinos tienen varietal, cosecha y graduación, y los accesorios, material y unidad de venta. En un documento se guardan como subdocumentos opcionales (`detalleVino` o `detalleAccesorio`) sin columnas vacías.

El modelo del equipo combina dos estrategias que vimos en la clase de modelado:

- **Normalizado** en las colecciones principales (`productos`, `categorias`, `bodegas`, `usuarios`, `carritos`, `pedidos`, `configuracion_tienda`), que se relacionan por `ObjectId`. Son el origen de los datos.
- **Desnormalizado** en las colecciones de página (`inicio` y `catalogo`), que copian los metadatos compartidos de las páginas. Inicio guarda una selección resumida de productos; Catálogo conserva la consulta y configuración, sin duplicar los resultados. Se diseñaron a partir de la aplicación (los bocetos de Figma), como plantea el proceso de diseño de la clase.

El costo de copiar es mantener las copias al día: eso lo hace `src/servicios/sincronizacion.js` (sección 10 del modelo). Los pedidos copian a propósito el nombre y el precio, porque deben quedar como estaban al momento de la compra.

### Relaciones

| Relación | Cardinalidad | Resolución |
| --- | --- | --- |
| categoría → productos | 1 a muchos | `productos.categoriaId` (referencia) |
| bodega → productos | 1 a muchos | `productos.bodegaId` (referencia, opcional) |
| usuario → direcciones | 1 a muchos | arreglo embebido `usuarios.direcciones` |
| usuario → carrito activo | 1 a 1 | `carritos.usuarioId` con índice único parcial |
| carrito ↔ productos | muchos a muchos | `carritos.items[].productoId` |
| pedido ↔ productos | muchos a muchos | `pedidos.items[]` con copia de nombre y precio |
| usuario registrado → páginas | 1 a 0..1 por colección | `inicio` / `catalogo` con `usuario.usuarioId` obligatorio e índices únicos; visitantes sin persistencia |
