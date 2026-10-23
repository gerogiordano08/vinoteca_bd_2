# Consultas por pantalla (mongosh)

Todas las consultas que hace la aplicación, ordenadas por pantalla, escritas para **mongosh** con los operadores vistos en clase (`find`, `sort`, `skip`, `limit`, `distinct`, `countDocuments`, `aggregate` con `$match`, `$group`, `$lookup`, `$unwind`, `$project`, `$sum`, y escrituras con `updateOne`, `insertOne` y `deleteOne`, más los operadores de arreglos de la clase "Gestionando arrays": `$push` con `$each`, `$addToSet`, `$pop` y `$pull`). Son equivalentes a las que ejecuta el código de `src/servicios/`.

```bash
mongosh consultas/todas.js          # todas las pantallas
mongosh consultas/2_catalogo.js     # una sola pantalla
```

Los resultados de abajo son reales, sobre la base creada con `mongosh db/setup.js` (200.025 productos, 10.047 usuarios y 50.180 pedidos). Los tiempos que muestra cada script son orientativos; la medición formal con `explain` está en [rendimiento-mongosh.md](rendimiento-mongosh.md).

| Archivo | Pantalla | Colecciones |
| --- | --- | --- |
| [`consultas/1_inicio.js`](../../consultas/1_inicio.js) | Inicio | `configuracion_tienda` `categorias` `productos` `carritos` `inicio` |
| [`consultas/2_catalogo.js`](../../consultas/2_catalogo.js) | Catálogo | `productos` `bodegas` `catalogo` |
| [`consultas/3_producto.js`](../../consultas/3_producto.js) | Detalle de producto | `productos` `categorias` `bodegas` |
| [`consultas/4_carrito.js`](../../consultas/4_carrito.js) | Carrito | `carritos` `productos` `configuracion_tienda` |
| [`consultas/5_pedido.js`](../../consultas/5_pedido.js) | Finalizar pedido y confirmación (escrituras) | `carritos` `productos` `pedidos` `inicio` `catalogo` |
| [`consultas/6_cuenta.js`](../../consultas/6_cuenta.js) | Mi cuenta, Mis pedidos, Detalle de pedido y Direcciones | `usuarios` `pedidos` |
| [`consultas/7_analitica.js`](../../consultas/7_analitica.js) | Reportes: las 10 consultas avanzadas | `pedidos` `productos` `carritos` `usuarios` `categorias` `bodegas` |

Los documentos de ejemplo se buscan por sus claves naturales (email, SKU, slug) en [`consultas/lib.js`](../../consultas/lib.js), así las consultas no dependen de ObjectId fijos.

## 1 · Inicio

| N.º | Qué muestra | Cómo |
| --- | --- | --- |
| 1.1 | Cabecera y pie con los datos de la tienda | `findOne` sobre el único documento de `configuracion_tienda` |
| 1.2 | Menú de categorías | `find({ activa: true })` ordenado por `_id` |
| 1.3 | "Una selección para empezar" | `aggregate`: `$match` destacados con stock, `$lookup` a `categorias`, `$match` categoría activa, `$sort` por nombre, `$limit: 4` |
| 1.4 | Contador "Carrito (n)" | `$sum` de `items.cantidad` del carrito activo |
| 1.5 | Inicio guardado de un usuario | `findOne` en `inicio` por `usuario.usuarioId` (índice único `inicio_por_usuario`) |
| 1.6 | Agregar productos a la selección propia (escritura, se deshace) | `$addToSet` con `$each`: agrega dos productos de una vez y omite el que ya estaba. Busca la página por posición del arreglo (`'seleccionProductoIds.2': { $exists: false }`) para no pasar de 4 |

```text
▸ 1.3 Productos destacados   (4 resultados, 3 ms)
    { nombre: "Brut Nature", precio: 21000.00, detalleVino: { color: "Blanco" }, categoria: { nombre: "Espumantes" } }
    { nombre: "Chardonnay Joven", precio: 14200.00, detalleVino: { color: "Blanco" }, categoria: { nombre: "Vinos" } }
    { nombre: "Copa de cristal", precio: 7500.00, categoria: { nombre: "Accesorios" } }
    { nombre: "Malbec Reserva", precio: 18500.00, detalleVino: { color: "Tinto" }, categoria: { nombre: "Vinos" } }

▸ 1.4 Artículos en el carrito de Ana   (1 resultado, 1 ms)
    { cantidadArticulos: 2 }

▸ 1.5 Inicio personalizado de demo-tintos   (1 ms)
    { usuario: { usuarioId: …6b84e1, nombre: "Tomás", apellido: "Tintos" }, carrito: { cantidadArticulos: 0 }, productosDestacados: [{ nombre: "Blend de Altura", precio: 24800.00 }, { nombre: "Bonarda", precio: 8900.00 }, { nombre: "Cabernet Franc Gran Reserva", precio: 32500.00 }, { nombre: "Cabernet Sauvignon", precio: 17800.00 }] }

▸ 1.6 $addToSet con $each en la selección de Rocío: 1 → 2 productos (se agregó Brut Nature; el que ya estaba no se repitió)
    deshecho: la selección vuelve a tener 1, como antes
```

La página de Inicio de un usuario registrado es un solo documento con copias de la tienda, el carrito, las categorías y los productos: se arma con una lectura. Los visitantes ven la versión pública, que no se guarda.

`$addToSet` es el operador indicado para `seleccionProductoIds` porque el validador exige que no haya repetidos (`uniqueItems`): con `$push` un producto elegido dos veces haría fallar la escritura.

## 2 · Catálogo

| N.º | Qué muestra | Cómo |
| --- | --- | --- |
| 2.1 | Opciones del filtro (colores y varietales) | `distinct` sobre `detalleVino.color` y `detalleVino.varietal` |
| 2.2 | Primera página, orden "Destacados" | `aggregate`: `$match`, `$sort { destacado: -1, nombre: 1, _id: 1 }`, `$skip`, `$limit: 12` y `$lookup` a `bodegas` solo de esos 12 |
| 2.3 | Total para la paginación | `countDocuments` con el mismo filtro |
| 2.4 | Categoría Vinos, página 2 por nombre | `find(...).sort({ nombre: 1, _id: 1 }).skip(12).limit(12)` |
| 2.5 | Filtros combinados: tintos Malbec de $15.000 a $30.000 | `$in` sobre `detalleVino.color` y `.varietal`, rango con `NumberDecimal` |
| 2.6 | Búsqueda de texto | `$text: { $search: "copas" }` (índice de texto en español: "copas" encuentra "copa") |
| 2.7 | Búsqueda por bodega | se buscan las bodegas cuyo nombre coincide y después sus productos con `bodegaId: { $in }` |
| 2.8 | Última búsqueda guardada de un usuario | `findOne` en `catalogo`: se guarda la consulta y la página, no los productos |

```text
▸ 2.2 Primera página (orden Destacados)   (12 resultados, 3 ms)
    { nombre: "Brut Nature", destacado: true, precio: 21000.00, bodega: "Bodega de ejemplo" }
    { nombre: "Chardonnay Joven", destacado: true, precio: 14200.00, bodega: "Bodega de ejemplo" }
    { nombre: "Copa de cristal", destacado: true, precio: 7500.00 }
    { nombre: "Malbec Reserva", destacado: true, precio: 18500.00, bodega: "Bodega de ejemplo" }
    { nombre: "Aireador de vino", destacado: false, precio: 8700.00 }
    { nombre: "Aireador de vino · muestra 100008", destacado: false, precio: 38584.00 }
    …

▸ 2.3 Total de productos para la paginación   (47 ms)
    { totalProductos: 200024 }

▸ 2.5 Tintos Malbec de $15.000 a $30.000   (12 resultados, 5 ms)
    { nombre: "Malbec Reserva · muestra 149665", stockActual: 31, destacado: false, precio: 15000.00, detalleVino: { color: "Tinto", varietal: "Malbec" } }
    { nombre: "Malbec Clásico · muestra 36148", stockActual: 35, destacado: false, precio: 15003.00, detalleVino: { color: "Tinto", varietal: "Malbec" } }
    …

▸ 2.6 Búsqueda "copas"   (12 resultados, 65 ms)
    { nombre: "Copa de cristal", precio: 7500.00 }
    { nombre: "Copa de cristal · muestra 100002", precio: 38071.00 }
    …

▸ 2.8 Catálogo guardado de demo-tintos   (1 ms)
    { usuario: { nombre: "Tomás" }, consulta: { orden: "nombre_asc", categoriaIds: […ee22f2], colores: ["Tinto"] }, paginacion: { paginaActual: 1, productosPorPagina: 12 } }
```

En Compass, la vista `pagina_vinos` muestra la categoría Vinos con el mismo orden y los mismos datos de cada tarjeta (108.350 vinos).

## 3 · Detalle de producto

| N.º | Qué muestra | Cómo |
| --- | --- | --- |
| 3.1 | Ficha de un vino | `aggregate`: `$match` por `_id`, `$lookup` a `categorias` y `bodegas`. El detalle del vino está embebido (`detalleVino`) |
| 3.2 | Ficha de un accesorio | `findOne`: los accesorios tienen `detalleAccesorio` en lugar de `detalleVino` |
| 3.3 | Aviso "Sin stock por el momento" | `$project` con `disponible: { $and: ['$activo', { $gt: ['$stockActual', 0] }] }` |
| 3.4 | Evolución del precio por mes | Serie temporal `historial_precios`: `$match` por `productoId` (metaField) y rango de `fecha` (timeField), `$group` por `$dateTrunc: { unit: 'month' }` con `$min`, `$max` y `$sum` |

```text
▸ 3.2 Ficha de Copa de cristal   (2 ms)
    { nombre: "Copa de cristal", tipoProducto: "accesorio", detalleAccesorio: { material: "Cristal", unidadVenta: "1 unidad", detalles: "Capacidad: 450 ml; Cuidado: Lavado a mano" }, precio: 7500.00 }

▸ 3.3 Disponibilidad de los productos de ejemplo   (3 resultados, 155 ms)
    { nombre: "Merlot", stockActual: 0, disponible: false }
    { nombre: "Malbec Edición Limitada 2019", stockActual: 2, disponible: false }
    { nombre: "Aireador de vino", stockActual: 0, disponible: false }
```

"Malbec Edición Limitada 2019" tiene stock pero está inactivo: no se vende.

```text
▸ 3.4 Precio del Malbec Reserva por mes (historial_precios)   (12 resultados, 5 ms)
    { minimo: 17900.00, maximo: 18200.00, puntos: 31, mes: "2025-10" }
    { minimo: 17600.00, maximo: 18200.00, puntos: 31, mes: "2025-12" }
    …
    { minimo: 17600.00, maximo: 18500.00, puntos: 31, mes: "2026-09" }
```

`historial_precios` es una **colección de series temporales** (`timeField: fecha`, `metaField: productoId`, `granularity: hours`), creada por `db/06_historial_precios.js` con 8.785 puntos: el precio cobrado cada día en los pedidos y el precio actual. MongoDB guarda los puntos de cada producto agrupados en *buckets* comprimidos y crea solo el índice `productoId_1_fecha_1`: la consulta de julio a septiembre del Malbec devuelve 93 puntos examinando 7 buckets. Los 18.500 de septiembre son el precio actual.

## 4 · Carrito

| N.º | Qué muestra | Cómo |
| --- | --- | --- |
| 4.1 | Ítems con precio y stock actuales | `$unwind` de los ítems y `$lookup` a `productos`: el carrito guarda solo `productoId` y `cantidad` |
| 4.2 | Subtotal | `$group` con `$sum` de `$multiply: [precio, cantidad]` (en Decimal128) |
| 4.3 | Formas de entrega y costo de envío | `findOne` en `configuracion_tienda` |

```text
▸ 4.1 Ítems del carrito con precio y stock actuales   (2 resultados, 2 ms)
    { producto: "Malbec Reserva", cantidad: 1, precioUnitario: 18500.00, subtotal: 18500.00, stockActual: 12 }
    { producto: "Copa de cristal", cantidad: 1, precioUnitario: 7500.00, subtotal: 7500.00, stockActual: 24 }

▸ 4.2 Subtotal del carrito   (1 resultado, 2 ms)
    { articulos: 2, subtotal: 26000.00 }
```

## 5 · Finalizar pedido (escrituras)

El script hace una compra completa con la cuenta `demo-tintos` y al final la deshace, así la base queda como estaba y se puede repetir.

| N.º | Operación | Cómo |
| --- | --- | --- |
| 5.1 | Agregar al carrito | `updateOne` con `upsert` (un carrito activo por usuario, índice único parcial) y después `$inc` con el operador posicional `$` o `$push` |
| 5.2 | Copia del carrito en las páginas | `updateMany` sobre `inicio` y `catalogo` (patrón de copia de datos) |
| 5.3 | Confirmar el pedido | `updateOne` condicional `{ stockActual: { $gte: cantidad } }` con `$inc` negativo, `insertOne` del pedido con el precio del momento y carrito marcado `convertido` |
| 5.4 | Deshacer la compra de prueba | `deleteOne`, `$inc` positivo y restauración del carrito |

```text
▸ 5.1 Carrito después de agregar   (0 ms)
    { _id: …09f6b4, estado: "activo", items: [{ productoId: …ee22fa, cantidad: 2, agregadoEn: 2026-10-23 10:29 }] }

▸ 5.2 Copia del carrito en Inicio   (0 ms)
    { carrito: { carritoId: …09f6b4, cantidadArticulos: 2 } }

▸ 5.3 Stock descontado en 1 de 1 productos

▸ 5.3 Pedido confirmado   (1 ms)
    { numero: "V-150001", items: [{ nombre: "Malbec Reserva", cantidad: 2 }], total: 37000.00, estadoPedido: "pendiente" }

▸ 5.3 Stock de Malbec Reserva   (1 ms)
    { nombre: "Malbec Reserva", stockActual: 10 }

▸ 5.4 Compra de prueba deshecha: stock 12 (antes 12), pedido V-150001 eliminado
```

La actualización condicional del stock es atómica en cada documento. El MongoDB local no es un replica set, así que no hay transacciones multidocumento: si un producto no alcanza, se devuelve lo descontado (ver [decisiones.md](decisiones.md)).

## 6 · Mi cuenta

| N.º | Qué muestra | Cómo |
| --- | --- | --- |
| 6.1 | Datos y direcciones | `findOne` en `usuarios`: las direcciones están embebidas |
| 6.2 | Mis pedidos | `find({ usuarioId }).sort({ creadoEn: -1 })` (índice `pedidos_de_usuario`) |
| 6.3 | Detalle de un pedido | `findOne` por `usuarioId` y `numero`: ítems y dirección embebidos, con el precio histórico |
| 6.4 | Resumen de compras | `$group` con `$sum` y `$max` sobre los pedidos no cancelados |
| 6.5 | Agregar y quitar direcciones (escrituras, se deshacen) | `$push` con `$each` agrega dos direcciones en una operación; `$pop: { direcciones: 1 }` quita la última (con `-1`, la primera) |

```text
▸ 6.2 Mis pedidos de cliente01   (6 resultados, 1 ms)
    { numero: "V-1171", direccionEntrega: { tipo: "envio" }, total: 101300.00, estadoPedido: "cancelado", creadoEn: 2026-09-16 18:00 }
    { numero: "V-1130", direccionEntrega: { tipo: "retiro" }, total: 68100.00, estadoPedido: "entregado", creadoEn: 2026-07-22 17:00 }
    …

▸ 6.3 Detalle del pedido V-1171   (2 ms)
    { numero: "V-1171", items: [{ productoId: …ee230c, nombre: "Copa de cristal", precioUnitario: 7400.00, cantidad: 1, subtotal: 7400.00 }, { productoId: …ee2305, nombre: "Blend de Altura", precioUnitario: 24400.00, cantidad: 3, subtotal: 73200.00 }, …

▸ 6.4 Resumen de compras de cliente01   (1 resultado, 2 ms)
    { pedidos: 3, gastado: 119900.00, ultimaCompra: 2026-07-22 17:00 }

▸ 6.5 Direcciones de Ana después de $push con $each   (1 resultado, 2 ms)
    { cantidad: 3, alias: ["Casa", "Trabajo", "Casa de mis padres"] }

▸ 6.5 $pop: 1 dos veces quitó las dos últimas: quedan 1 (antes 1)
```

En 6.3 la copa figura a $7.400, el precio de cuando se compró; hoy cuesta $7.500.

En la aplicación, quitar una dirección cualquiera (no solo la última) se hace con `$unset` de la posición y `$pull` de los nulos (`src/rutas/cuenta.js`). `tests/consultas-mongosh.test.js` corre estos scripts sobre una base de prueba y comprueba que las escrituras de 1.6, 5 y 6.5 dejan todo como estaba.

## 7 · Reportes

Las 10 consultas avanzadas de [`consultas/avanzadas.js`](../../consultas/avanzadas.js), explicadas en el [README](../../README.md#consultas-avanzadas). En Compass están como vistas `consulta_01` … `consulta_10`. Resultados con la carga masiva:

```text
▸ 3. Ingresos por categoría (dos $lookup encadenados)  [pedidos]   (3 resultados)
    { unidades: 96003, categoria: "Vinos", ingresos: 1323798900 }
    { unidades: 55250, categoria: "Accesorios", ingresos: 772435500 }
    { unidades: 22695, categoria: "Espumantes", ingresos: 359992300 }

▸ 5. Los 5 clientes que más compraron ($lookup a usuarios)  [pedidos]   (5 resultados)
    { pedidos: 11, cliente: "Romero, Paula", gastado: 928800, ultimaCompra: "16/09/2026" }
    { pedidos: 11, cliente: "Molina, Tomás", gastado: 909800, ultimaCompra: "28/09/2026" }
    …

▸ 8. Carritos abandonados y su valor a precios actuales  [carritos]   (1 resultado)
    { carritos: 5, articulos: 5, valorPerdido: 90800 }
```

Las consultas 3 y 4 hacen un `$lookup` por cada ítem vendido, así que con la carga masiva tardan algunos segundos (4 y 10 s en esta PC).
