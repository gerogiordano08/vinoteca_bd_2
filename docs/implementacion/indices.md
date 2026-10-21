# Revisión de índices del catálogo

Medición realizada el 20/10/2026 sobre `vinoteca`, MongoDB 9.0.4, con 200.025 productos (200.024 activos).

Se midió la búsqueda, ordenamiento y límite de 120 productos antes de los `$lookup` de presentación. Se ejecutó cada consulta dos veces con `explain("executionStats")` y se registró la segunda. Los tiempos son orientativos, dependen del equipo y de la caché, y no incluyen el conteo total, las opciones de filtro ni los `$lookup` de la respuesta completa. No se utilizó `hint`: son los planes elegidos por MongoDB.

Se verificó que las diez consultas devolvieran los mismos 120 identificadores en el mismo orden antes y después. Los conteos de las nueve colecciones permanecieron iguales. La actualización de índices no ejecuta escrituras sobre documentos.

## Cambios aplicados

| Colección | Índice nuevo | Campos |
| --- | --- | --- |
| productos | `catalogo_categoria_nombre` | `{ activo: 1, categoriaId: 1, nombre: 1, _id: 1 }` |
| productos | `catalogo_categoria_destacados` | `{ activo: 1, categoriaId: 1, destacado: -1, nombre: 1, _id: 1 }` |
| productos | `catalogo_categoria_precio_asc` | `{ activo: 1, categoriaId: 1, precio: 1, nombre: 1, _id: 1 }` |

El índice de precio reemplaza a `catalogo_categoria_precio`, que no cubría los desempates. Se retiraron también `carritos_por_producto`, `inicio_por_producto`, `inicio_por_categoria` y `catalogo_por_categoria`, que no aportan a las operaciones actuales: estas localizan un carrito concreto o actualizan todas las páginas, sin buscar por esos campos.

Se conservaron todos los índices únicos y los de búsqueda, bodega, color/varietal, pedidos por usuario y destacados de Inicio. También se conservó `pedidos_por_estado`: el informe de ventas mensuales efectivamente lo utiliza para excluir cancelados antes de agrupar. Su utilidad no se descartó por la ausencia de una pantalla que filtre por estado.

El total de índices de la base, incluyendo los nueve `_id_`, pasó de 28 a 26. El tamaño reportado de los índices de `productos` pasó de 35.53 MB a 57.05 MB: se reducen las lecturas a cambio de más almacenamiento y mantenimiento de índices en esa colección. Son tamaños observados en este momento, no una garantía de tamaño futuro.

## Resultados

| Consulta, primera página | Docs antes | Docs después | Claves después | `SORT` después | ms antes → después |
| --- | ---: | ---: | ---: | --- | ---: |
| Todo: destacados | 200.024 | 120 | 122 | No | 267 → 3 |
| Todo: nombre | 200.024 | 120 | 122 | No | 204 → 1 |
| Todo: precio ascendente | 200.024 | 120 | 122 | No | 239 → 3 |
| Todo: precio descendente | 200.024 | 120 | 200.024 | Sí | 252 → 171 |
| Vinos: nombre | 108.350 | 120 | 120 | No | 104 → 0 |
| Vinos: precio ascendente | 108.350 | 120 | 120 | No | 127 → 0 |
| Vinos: precio descendente | 108.350 | 120 | 108.350 | Sí | 145 → 98 |
| Tintos Malbec: nombre | 16.671 | 16.671 | 16.671 | Sí | 30 → 30 |
| Bodega: nombre | 25.004 | 25.004 | 25.004 | Sí | 43 → 44 |
| Texto: nombre | 66.678 | 66.678 | 33.339 | Sí | 36 → 32 |

Los índices nuevos resuelven el orden general por nombre, destacados y precio ascendente. Cuando se incluyen las tres categorías activas mediante `$in`, MongoDB combina sus recorridos ordenados: en esta medición examina 122 claves para recuperar 120 documentos.

## Límites y próximos experimentos

- **Precio descendente:** la consulta pide `{ precio: -1, nombre: 1, _id: 1 }`. Recorrer al revés el índice ascendente también invertiría los desempates. El plan actual sigue ordenando aparte y recorre 200.024 claves para la búsqueda general, aunque obtiene solo 120 documentos completos. Un posible siguiente experimento es un índice con el orden descendente exacto; no se creó en esta revisión.
- **Color/varietal, bodega y texto ordenados por nombre:** conservan índices útiles para el filtro, pero sus planes todavía ordenan los resultados. No se agregaron todas las combinaciones posibles.
- **Conteos y filtros disponibles:** contar todos los resultados y obtener colores/varietales son consultas distintas de la página de 120 productos y deben medirse por separado.
- **Páginas lejanas:** estas pruebas corresponden a la primera página. `$skip` tiene un costo creciente y no desaparece por agregar índices.
- **Sincronización:** se retiraron índices que el algoritmo actual no consulta. Si se cambia para actualizar solo los Inicios afectados, habrá que diseñar el índice para el nuevo filtro, considerando `seleccionProductoIds` para productos ocultos temporalmente por falta de stock.

## Aplicar y reproducir

```bash
npm run db:indices
```

El comando carga `.env`, crea los índices nuevos antes de retirar los anteriores y no cambia documentos ni validadores. Conserva índices adicionales agregados manualmente. Solo retira las cinco definiciones antiguas conocidas; si una tiene campos o restricciones diferentes, se detiene antes de modificar índices. Repetirlo es seguro. `db:init` utiliza la misma actualización de índices después de preparar los validadores.

Ejemplo de comprobación en mongosh, dentro de la base `vinoteca`:

```js
const activas = db.categorias.find({ activa: true }, { _id: 1 })
  .toArray().map(c => c._id);

db.productos.find({ activo: true, categoriaId: { $in: activas } })
  .sort({ nombre: 1, _id: 1 })
  .limit(120)
  .explain("executionStats");
```

Revisar `totalDocsExamined`, `totalKeysExamined`, `nReturned`, el índice elegido y si aparece una etapa `SORT`. Una etapa `SORT_MERGE` combina recorridos ya ordenados y no equivale a ordenar todos los resultados con `SORT`.
