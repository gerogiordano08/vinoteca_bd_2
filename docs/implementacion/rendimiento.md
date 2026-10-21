# Medición de rendimiento con índices

Generado el 21/10/2026, 09:19:28. Índices leídos de `vinoteca` al iniciar la ejecución.
Base temporal: `vinoteca_rendimiento`, 200000 productos y 300000 pedidos sintéticos; además 20.000 usuarios, carritos y páginas, 3 categorías y 30 bodegas simplificadas (sin validadores). No copia documentos del origen.
Todas las consultas se miden primero solo con el índice automático `_id_`; luego se reproducen juntos los índices activos y MongoDB elige el plan, sin forzarlo con `hint`. Se ejecuta cada explain dos veces y se informa la segunda.
Las consultas representan casos del proyecto y siguen definidas en el script; las definiciones y los nombres de los índices se consultan en MongoDB. Un índice nuevo puede no ser elegido. No se prueban restricciones de unicidad ni rendimiento de escrituras.

| Consulta | Plan sin secundarios | Docs | Devueltos | ms | Plan con índices activos | Docs | Claves | Devueltos | ms |
| --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: |
| Catálogo por nombre | COLLSCAN → SORT | 200000 | 120 | 57 | IXSCAN (catalogo_categoria_nombre) → FETCH → LIMIT | 120 | 120 | 120 | 0 |
| Catálogo por destacados | COLLSCAN → SORT | 200000 | 120 | 63 | IXSCAN (catalogo_categoria_destacados) → FETCH → LIMIT | 120 | 120 | 120 | 0 |
| Catálogo por precio ascendente hasta $10.000 | COLLSCAN → SORT | 200000 | 120 | 55 | IXSCAN (catalogo_categoria_precio_asc) → FETCH → LIMIT | 120 | 120 | 120 | 0 |
| Catálogo por precio descendente | COLLSCAN → SORT | 200000 | 120 | 63 | IXSCAN (catalogo_categoria_precio_asc) → SORT → FETCH | 120 | 60968 | 120 | 58 |
| Producto por SKU | COLLSCAN | 200000 | 1 | 25 | EXPRESS_IXSCAN (sku_unico) | 1 | 1 | 1 | 0 |
| Inicio: destacados con stock | COLLSCAN → SORT | 200000 | 4 | 51 | IXSCAN (destacados_por_nombre) → FETCH → LIMIT | 4 | 4 | 4 | 0 |
| Vinos rosados Pinot Noir | COLLSCAN | 200000 | 8681 | 46 | IXSCAN (filtro_color_varietal) → FETCH | 8681 | 8681 | 8681 | 3 |
| Productos de una bodega | COLLSCAN | 200000 | 6667 | 28 | IXSCAN (por_bodega) → FETCH | 6667 | 6667 | 6667 | 2 |
| Búsqueda por regex (misma consulta en ambas mediciones) | COLLSCAN | 200000 | 20508 | 49 | COLLSCAN | 200000 | 0 | 20508 | 50 |
| Pedidos de un usuario | COLLSCAN → SORT | 300000 | 115 | 41 | IXSCAN (pedidos_de_usuario) → FETCH | 115 | 115 | 115 | 0 |
| Pedidos confirmados recientes | COLLSCAN → SORT | 300000 | 20 | 51 | IXSCAN (pedidos_por_estado) → FETCH → LIMIT | 20 | 20 | 20 | 0 |
| Pedido por número | COLLSCAN | 300000 | 1 | 35 | EXPRESS_IXSCAN (numero_unico) | 1 | 1 | 1 | 0 |
| Categoría por slug | COLLSCAN | 3 | 1 | 0 | EXPRESS_IXSCAN (slug_unico) | 1 | 1 | 1 | 0 |
| Bodega por nombre | COLLSCAN | 30 | 1 | 0 | EXPRESS_IXSCAN (nombre_unico) | 1 | 1 | 1 | 0 |
| Usuario por email | COLLSCAN | 20000 | 1 | 2 | EXPRESS_IXSCAN (email_unico) | 1 | 1 | 1 | 0 |
| Carrito activo del usuario | COLLSCAN | 20000 | 1 | 3 | IXSCAN (carrito_activo_unico) → FETCH | 1 | 1 | 1 | 0 |
| Página inicio del usuario | COLLSCAN | 20000 | 1 | 2 | EXPRESS_IXSCAN (inicio_por_usuario) | 1 | 1 | 1 | 0 |
| Página catalogo del usuario | COLLSCAN | 20000 | 1 | 2 | EXPRESS_IXSCAN (catalogo_por_usuario) | 1 | 1 | 1 | 0 |
| Búsqueda $text: tardía (requiere índice) | No aplica: $text exige índice | — | — | — | IXSCAN (busqueda_texto) → FETCH → TEXT_MATCH (busqueda_texto) | 20508 | 20508 | 20508 | 11 |

## Inventario leído y cobertura

| Colección | Índice | Definición leída | Estado en la prueba |
| --- | --- | --- | --- |
| pedidos | _id_ | {"key":{"_id":1},"name":"_id_"} | Automático; se conserva en ambas mediciones |
| pedidos | numero_unico | {"key":{"numero":1},"name":"numero_unico","unique":true} | Elegido en: Pedido por número |
| pedidos | pedidos_de_usuario | {"key":{"usuarioId":1,"creadoEn":-1},"name":"pedidos_de_usuario"} | Elegido en: Pedidos de un usuario |
| pedidos | pedidos_por_estado | {"key":{"estadoPedido":1,"creadoEn":-1},"name":"pedidos_por_estado"} | Elegido en: Pedidos confirmados recientes |
| inicio | _id_ | {"key":{"_id":1},"name":"_id_"} | Automático; se conserva en ambas mediciones |
| inicio | inicio_por_usuario | {"key":{"usuario.usuarioId":1},"name":"inicio_por_usuario","unique":true,"partialFilterExpression":{"usuario.usuarioId":{"$exists":true}}} | Elegido en: Página inicio del usuario |
| carritos | _id_ | {"key":{"_id":1},"name":"_id_"} | Automático; se conserva en ambas mediciones |
| carritos | carrito_activo_unico | {"key":{"usuarioId":1},"name":"carrito_activo_unico","unique":true,"partialFilterExpression":{"estado":"activo"}} | Elegido en: Carrito activo del usuario |
| categorias | _id_ | {"key":{"_id":1},"name":"_id_"} | Automático; se conserva en ambas mediciones |
| categorias | slug_unico | {"key":{"slug":1},"name":"slug_unico","unique":true} | Elegido en: Categoría por slug |
| bodegas | _id_ | {"key":{"_id":1},"name":"_id_"} | Automático; se conserva en ambas mediciones |
| bodegas | nombre_unico | {"key":{"nombre":1},"name":"nombre_unico","unique":true} | Elegido en: Bodega por nombre |
| productos | _id_ | {"key":{"_id":1},"name":"_id_"} | Automático; se conserva en ambas mediciones |
| productos | sku_unico | {"key":{"sku":1},"name":"sku_unico","unique":true} | Elegido en: Producto por SKU |
| productos | destacados_por_nombre | {"key":{"destacado":1,"activo":1,"nombre":1},"name":"destacados_por_nombre"} | Elegido en: Inicio: destacados con stock |
| productos | filtro_color_varietal | {"key":{"detalleVino.color":1,"detalleVino.varietal":1},"name":"filtro_color_varietal","sparse":true} | Elegido en: Vinos rosados Pinot Noir |
| productos | por_bodega | {"key":{"bodegaId":1},"name":"por_bodega","sparse":true} | Elegido en: Productos de una bodega |
| productos | busqueda_texto | {"key":{"_fts":"text","_ftsx":1},"name":"busqueda_texto","weights":{"descripcion":1,"descripcionCorta":4,"nombre":10},"default_language":"spanish","language_override":"language","textIndexVersion":3} | Elegido en: Búsqueda $text: tardía (requiere índice) |
| productos | catalogo_categoria_nombre | {"key":{"activo":1,"categoriaId":1,"nombre":1,"_id":1},"name":"catalogo_categoria_nombre"} | Elegido en: Catálogo por nombre |
| productos | catalogo_categoria_destacados | {"key":{"activo":1,"categoriaId":1,"destacado":-1,"nombre":1,"_id":1},"name":"catalogo_categoria_destacados"} | Elegido en: Catálogo por destacados |
| productos | catalogo_categoria_precio_asc | {"key":{"activo":1,"categoriaId":1,"precio":1,"nombre":1,"_id":1},"name":"catalogo_categoria_precio_asc"} | Elegido en: Catálogo por precio ascendente hasta $10.000; Catálogo por precio descendente |
| catalogo | _id_ | {"key":{"_id":1},"name":"_id_"} | Automático; se conserva en ambas mediciones |
| catalogo | catalogo_por_usuario | {"key":{"usuario.usuarioId":1},"name":"catalogo_por_usuario","unique":true,"partialFilterExpression":{"usuario.usuarioId":{"$exists":true}}} | Elegido en: Página catalogo del usuario |
| configuracion_tienda | _id_ | {"key":{"_id":1},"name":"_id_"} | Automático; se conserva en ambas mediciones |
| usuarios | _id_ | {"key":{"_id":1},"name":"_id_"} | Automático; se conserva en ambas mediciones |
| usuarios | email_unico | {"key":{"email":1},"name":"email_unico","unique":true} | Elegido en: Usuario por email |

`COLLSCAN` recorre documentos; `IXSCAN` recorre entradas del índice; `FETCH` lee documentos y `SORT` ordena aparte. Los tiempos dependen del equipo y de los datos sintéticos: compará también documentos y claves examinados. Las colecciones pequeñas pueden preferir COLLSCAN.
