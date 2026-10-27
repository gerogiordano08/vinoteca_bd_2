# Rendimiento de los índices (mongosh)

Medición hecha como en la clase de índices, con [`rendimiento/medir.js`](../../rendimiento/medir.js):

```bash
mongosh rendimiento/medir.js
```

Para cada colección el script:

1. lista los índices con `getIndexes()`;
2. los elimina con `dropIndex()` y mide cada consulta **sin índices**;
3. los vuelve a crear con `createIndex()` (las mismas definiciones de `src/db/indices.js`) y mide **con índices**.

De cada consulta toma `explain("executionStats")`: `executionTimeMillis` (mediana de 5 ejecuciones), `totalDocsExamined` y el índice que eligió MongoDB en el plan ganador. Al terminar, los índices quedan creados igual que antes.

Medición del 23/10/2026, MongoDB 9.0.2, sobre la base creada con `mongosh db/setup.js`: **200.025 productos, 50.180 pedidos y 10.047 usuarios**. Los milisegundos dependen del equipo; los documentos examinados, no.

## Comandos de la clase

```js
const activas = db.categorias.find({ activa: true }).toArray().map(c => c._id)
db.productos.getIndexes()
db.productos.dropIndex("catalogo_categoria_destacados")
db.productos.find({ activo: true, categoriaId: { $in: activas } }).sort({ destacado: -1, nombre: 1, _id: 1 }).limit(12).explain("executionStats").executionStats.executionTimeMillis
db.productos.createIndex({ activo: 1, categoriaId: 1, destacado: -1, nombre: 1, _id: 1 }, { name: "catalogo_categoria_destacados" })
```

El filtro tiene que incluir `categoriaId`, como la consulta de la aplicación. El índice empieza por `activo` y `categoriaId`. Si se filtra solo por `activo`, MongoDB no puede usar el resto del índice para el orden y ordena en memoria (etapa `SORT`, unos 230 ms). Con `categoriaId: { $in: activas }` combina los recorridos ya ordenados de cada categoría (`SORT_MERGE`), examina 12 documentos y tarda alrededor de 1 ms.

## Resultados

| Consulta | Colección | Índice previsto | Índice que usó MongoDB | Sin índices | Con índices |
|---|---|---|---|---|---|
| — Todos los documentos (sin filtro) | `productos` | `ninguno` | ninguno (COLLSCAN) | 99 ms · 200.025 docs | 59 ms · 200.025 docs |
| 1.3 Destacados de Inicio | `productos` | `destacados_por_nombre` | destacados_por_nombre | 93 ms · 200.025 docs | 0 ms · 4 docs |
| 2.2 Catálogo, orden Destacados (12) | `productos` | `catalogo_categoria_destacados` | catalogo_categoria_destacados | 186 ms · 200.025 docs | 0 ms · 12 docs |
| 2.4 Vinos por nombre, página 2 | `productos` | `catalogo_categoria_nombre` | catalogo_categoria_nombre | 138 ms · 200.025 docs | 0 ms · 12 docs |
| 2.x Catálogo por precio ascendente (12) | `productos` | `catalogo_categoria_precio_asc` | catalogo_categoria_precio_asc | 177 ms · 200.025 docs | 0 ms · 12 docs |
| 2.5 Tintos Malbec entre $15.000 y $30.000 | `productos` | `filtro_color_varietal` | filtro_color_varietal | 107 ms · 200.025 docs | 29 ms · 16.671 docs |
| 2.7 Búsqueda por bodega, por nombre (12) | `productos` | `por_bodega` | por_bodega | 106 ms · 200.025 docs | 60 ms · 16.669 docs |
| 3.x Producto por SKU | `productos` | `sku_unico` | sku_unico | 75 ms · 200.025 docs | 0 ms · 1 docs |
| 2.6 Búsqueda de texto "copas" | `productos` | `busqueda_texto` | busqueda_texto | requiere el índice | 35 ms · 33.336 docs |
| — Todos los documentos (sin filtro) | `pedidos` | `ninguno` | ninguno (COLLSCAN) | 15 ms · 50.180 docs | 13 ms · 50.180 docs |
| 6.2 Mis pedidos de un cliente | `pedidos` | `pedidos_de_usuario` | pedidos_de_usuario | 16 ms · 50.180 docs | 0 ms · 1 docs |
| 6.3 Pedido por número | `pedidos` | `numero_unico` | numero_unico | 14 ms · 50.180 docs | 0 ms · 1 docs |
| adm Pedidos pendientes, más nuevos primero | `pedidos` | `pedidos_por_estado` | pedidos_por_estado | 22 ms · 50.180 docs | 0 ms · 20 docs |
| — Todos los documentos (sin filtro) | `usuarios` | `ninguno` | ninguno (COLLSCAN) | 2 ms · 10.047 docs | 2 ms · 10.047 docs |
| cta Iniciar sesión: usuario por email | `usuarios` | `email_unico` | email_unico | 4 ms · 10.047 docs | 0 ms · 1 docs |

## Qué se ve

- **Sin índices, todas las consultas recorren la colección entera** (COLLSCAN): 200.025 productos, 50.180 pedidos o 10.047 usuarios.
- **Con los índices compuestos del catálogo**, la primera página examina 12 documentos en lugar de 200.025. Como el índice ya está ordenado igual que la pantalla (por ejemplo `destacado`, `nombre`, `_id`), MongoDB lee las primeras 12 entradas y no ordena en memoria.
- **Los índices únicos** (`sku_unico`, `numero_unico`, `email_unico`) llevan cada búsqueda a un solo documento. Además impiden duplicados (ver `mongosh db/05_verificar.js`).
- **Filtro de color y varietal (2.5) y bodega (2.7):** el índice reduce la búsqueda a los 16.671 tintos Malbec o a los 16.669 productos de la bodega, pero después hay que ordenarlos, porque el índice no incluye el orden de la pantalla.
- **La búsqueda de texto (2.6) necesita su índice:** sin `busqueda_texto`, `$text` da error en lugar de recorrer la colección.
- **Una observación:** si se busca por bodega **sin orden ni límite**, MongoDB descarta `por_bodega`, elige `catalogo_categoria_nombre` y examina 200.024 documentos (unos 300 ms). Con `hint("por_bodega")` examina 16.669 (unos 24 ms). La pantalla siempre ordena y pagina, y en ese caso sí elige `por_bodega`. Por eso conviene medir la consulta tal como la hace la aplicación.

La revisión más detallada de los índices del catálogo (precio descendente, `$in` de categorías, tamaños) está en [indices.md](indices.md), y la comparación con 300.000 pedidos de `npm run rendimiento`, en [rendimiento.md](rendimiento.md).
