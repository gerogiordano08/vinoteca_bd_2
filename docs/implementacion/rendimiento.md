# Medición de rendimiento con índices

Generado por `npm run rendimiento` el 18/10/2026, 07:50:42, sobre MongoDB 9.0.2.
Base de prueba `vinoteca_rendimiento`: 200.000 productos y 300.000 pedidos con la estructura del modelo.
Cada consulta se ejecuta con `explain("executionStats")` antes y después de crear el índice. Los tiempos dependen del equipo; lo importante es la cantidad de documentos examinados y el plan.

| Consulta | Índice | Plan sin índice | Docs examinados | ms | Plan con índice | Docs examinados | Claves examinadas | ms |
| --- | --- | --- | ---: | ---: | --- | ---: | ---: | ---: |
| Catálogo: productos activos de una categoría hasta $ 10.000, ordenados por precio | `catalogo_categoria_precio` | COLLSCAN → SORT | 200.000 | 91 | IXSCAN (catalogo_categoria_precio) → FETCH → LIMIT | 12 | 12 | 0 |
| Búsqueda por código: un producto por SKU (índice único, igual que email_unico al iniciar sesión) | `sku_unico` | COLLSCAN | 200.000 | 66 | EXPRESS_IXSCAN (sku_unico) | 1 | 1 | 0 |
| Mis pedidos: pedidos de un usuario, del más nuevo al más viejo | `pedidos_de_usuario` | COLLSCAN → SORT | 300.000 | 105 | IXSCAN (pedidos_de_usuario) → FETCH | 115 | 115 | 0 |
| Filtro del catálogo: todos los vinos rosados de Pinot Noir (subdocumento detalleVino) | `filtro_color_varietal` | COLLSCAN | 200.000 | 76 | IXSCAN (filtro_color_varietal) → FETCH | 8.681 | 8.681 | 8 |
| Búsqueda "tardía": $regex sin índice frente a $text con índice de texto | `busqueda_texto` | COLLSCAN | 200.000 | 99 | IXSCAN (busqueda_texto) → FETCH → TEXT_MATCH (busqueda_texto) | 20.508 | 20.508 | 27 |

**Cómo leerlo.** `COLLSCAN` recorre toda la colección; `IXSCAN` recorre solo las entradas del índice que cumplen el filtro y después `FETCH` trae esos documentos. Cuando el índice también resuelve el orden, desaparece la etapa `SORT` en memoria.
