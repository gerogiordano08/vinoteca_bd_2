# Guía de los índices de la vinoteca

Esta guía explica los índices definidos en [src/db/indices.js](../../src/db/indices.js), su organización y las consultas que ayudan a resolver. El esquema actual define **18 índices propios**. MongoDB agrega un índice `_id_` en cada una de las nueve colecciones: **27 índices en total** en una base inicializada sin índices manuales adicionales.

Los resultados medidos antes y después del cambio están en [indices.md](indices.md). Esta guía explica su funcionamiento; no reemplaza la medición con `explain`.

## 1. Qué guarda un índice

Un índice común guarda los valores de sus campos junto con referencias que permiten localizar los documentos originales. No copia todo el producto ni guarda solamente el punto donde un valor cambia de `false` a `true`.

Por ejemplo, para `{ activo: 1, categoriaId: 1, nombre: 1, _id: 1 }`, las entradas pueden imaginarse así:

```text
(false, categoría A, "Bonarda", id1) → documento 1
(false, categoría B, "Copa",    id2) → documento 2
(true,  categoría A, "Bonarda", id3) → documento 3
(true,  categoría A, "Malbec",  id4) → documento 4
(true,  categoría B, "Copa",    id5) → documento 5
```

Es una representación conceptual, no el formato físico exacto de MongoDB. Las entradas están organizadas mediante un árbol B-tree: sus nodos permiten elegir ramas y descartar rangos enteros. Por eso tener una entrada por documento no obliga a leer todas las entradas para encontrar una coincidencia.

Si se busca `activo: true` y `categoriaId: A`, MongoDB puede localizar ese tramo. Dentro de él, los nombres ya están ordenados. Si un producto cambia alguno de los campos indexados, MongoDB mantiene automáticamente el índice correspondiente.

### Cómo leer una definición

- `1`: orden ascendente.
- `-1`: orden descendente.
- El orden de los campos determina la organización del índice.
- `unique: true`: impide que dos documentos tengan la misma clave indexada.
- `partialFilterExpression`: incluye solo documentos que cumplen una condición.
- `sparse: true`: omite documentos donde faltan los campos indexados, según las reglas del índice.
- `"text"`: indexa términos del texto para consultas con `$text`.

Un índice compuesto **ordena primero por el primer campo, luego por el segundo y así sucesivamente**. Decir que “agrupa por categoría” significa que las categorías iguales quedan juntas por ese orden; no ejecuta una operación `$group`.

## 2. El índice automático `_id_`: uno por colección

```js
{ _id: 1 }
```

Existe en `productos`, `categorias`, `bodegas`, `usuarios`, `carritos`, `pedidos`, `inicio`, `catalogo` y `configuracion_tienda`.

Permite localizar un documento por identificador e impide repetir un `_id` dentro de una misma colección. También ayuda en los `$lookup` que buscan por el `_id` de la colección relacionada.

Ejemplo:

```js
db.productos.findOne({ _id: ObjectId("507f1f77bcf86cd799439011") });
```

La unicidad es por colección: no crea una regla de integridad referencial entre colecciones. `configuracion_tienda` tiene únicamente este índice; no necesita un índice adicional para leer su único documento actual.

## 3. Índices de `productos`

### `sku_unico`

```js
{ sku: 1 } // unique: true
```

Organiza los productos por SKU y permite localizar uno por su código:

```js
db.productos.findOne({ sku: "VIN-MAL-RES" });
```

Además, MongoDB rechaza una inserción o modificación que intente usar el SKU de otro producto, con un error `E11000 duplicate key`. La regla funciona también al escribir directamente desde Compass.

No debe confundirse con `$jsonSchema`: el validador exige que el SKU exista y sea texto no vacío; el índice único exige que no se repita entre productos. Un SKU con el mismo valor en el mismo documento no constituye un duplicado entre documentos.

### `catalogo_categoria_nombre`

```js
{ activo: 1, categoriaId: 1, nombre: 1, _id: 1 }
```

Ordena primero por estado activo/inactivo, después por categoría, después por nombre y finalmente por identificador.

Al fijar `activo: true` y una categoría, el tramo correspondiente ya está ordenado por nombre. `_id` desempata productos con nombres iguales, dando un orden estable para paginar. El índice incluye también productos inactivos: `activo` es una clave, no un filtro parcial.

No organiza todos los productos globalmente por nombre, independientemente de los campos anteriores. En el catálogo general se consultan varias categorías activas con `$in`; en la medición realizada MongoDB combinó sus recorridos ordenados sin una etapa `SORT` adicional.

### `catalogo_categoria_destacados`

```js
{ activo: 1, categoriaId: 1, destacado: -1, nombre: 1, _id: 1 }
```

Dentro de cada combinación de estado y categoría, coloca primero los productos con `destacado: true`, seguidos por los demás. Luego ordena por nombre e identificador ascendentes.

Sirve al orden “destacados” del Catálogo, que muestra tanto destacados como no destacados. No es un índice que contenga únicamente productos destacados.

### `catalogo_categoria_precio_asc`

```js
{ activo: 1, categoriaId: 1, precio: 1, nombre: 1, _id: 1 }
```

Dentro del estado y categoría consultados, organiza por precio de menor a mayor. Si dos productos tienen el mismo precio, desempata por nombre y después por `_id`. Puede ayudar también a seleccionar rangos de precio cuando se utilizan los campos anteriores.

El orden descendente del catálogo es `{ precio: -1, nombre: 1, _id: 1 }`. Recorrer este índice al revés también invertiría nombre e identificador; por eso no resuelve ese orden mixto y para él existe el índice siguiente.

### `catalogo_categoria_precio_desc`

```js
{ activo: 1, categoriaId: 1, precio: -1, nombre: 1, _id: 1 }
```

Dentro del estado y categoría, organiza por precio de mayor a menor y desempata por nombre e identificador ascendentes: exactamente el orden “Mayor precio” del Catálogo. Sin él, MongoDB ordenaba en memoria todos los productos activos (etapa `SORT` sobre 200.024 claves, unos 280 ms); con él lee solo los 12 de la página (6 ms). Ver [indices.md](indices.md#precio-descendente-índice-agregado).

### `destacados_por_nombre`

```js
{ destacado: 1, activo: 1, nombre: 1 }
```

Organiza primero por destacado, después por activo y después por nombre. Ayuda a localizar los destacados activos utilizados para construir el Inicio general.

La selección de Inicio comprueba además stock y categoría activa, y desempata por `_id`. Esas condiciones no quedan resueltas completamente por este índice. Tampoco debe asumirse que elimina el ordenamiento de toda la agregación, que incluye `$lookup` y otras etapas.

Las páginas de Inicio con selección personalizada buscan sus productos por `_id` y pueden aprovechar el índice automático `_id_`.

### `filtro_color_varietal`

```js
{ "detalleVino.color": 1, "detalleVino.varietal": 1 } // sparse: true
```

Ordena primero por color y después por varietal. Conceptualmente:

```text
Blanco → Chardonnay → referencia al producto
Blanco → Torrontés  → referencia al producto
Rosado → Malbec     → referencia al producto
Tinto  → Bonarda    → referencia al producto
Tinto  → Malbec     → referencia al producto
```

Sirve para buscar un color solo, o color y varietal juntos. Para buscar únicamente un varietal, sus entradas están repartidas entre los colores; no ofrece el mismo acceso directo que un índice que empiece por varietal.

Es un índice compuesto `sparse`: incluye documentos donde existe al menos uno de esos campos y omite aquellos donde faltan ambos. No incluye `activo`, categoría ni el orden por nombre; esas condiciones pueden requerir trabajo adicional.

### `por_bodega`

```js
{ bodegaId: 1 } // sparse: true
```

Localiza los productos relacionados con una bodega. Al buscar un nombre de bodega, primero se obtienen sus identificadores y después se consultan los productos por `bodegaId`.

Omite documentos sin `bodegaId`, como los accesorios que no tienen bodega. Indexa el identificador, no el nombre de la bodega, y no resuelve por sí solo el orden por nombre de producto.

### `busqueda_texto`

```js
{ nombre: "text", descripcionCorta: "text", descripcion: "text" }
// default_language: "spanish"
// weights: { nombre: 10, descripcionCorta: 4, descripcion: 1 }
```

Permite buscar palabras dentro de esos tres campos mediante `$text`:

```js
db.productos.find({ $text: { $search: "Malbec" } });
```

Su funcionamiento conceptual es asociar términos con los documentos que los contienen:

```text
malbec  → productos A y B
reserva → productos A y C
joven   → producto B
```

La implementación real separa términos y aplica reglas lingüísticas, como reducción de ciertas terminaciones a una raíz común y eliminación de palabras de escaso significado para la búsqueda. No almacena necesariamente las palabras tal como aparecen en el texto. Un documento puede producir varias entradas porque contiene varios términos.

Una coincidencia en `nombre` tiene más peso en la relevancia que una en `descripcionCorta` o `descripcion`. Los pesos no significan que un campo siempre produzca un puntaje exactamente diez veces mayor: intervienen otros factores del cálculo.

El catálogo actual usa el orden elegido por el usuario; no ordena automáticamente por relevancia. Tampoco hay autocompletado: buscar `"Mal"` no equivale a buscar cualquier palabra que comience por esas letras. Si se escriben varias palabras sin exigir una frase, `$text` normalmente busca documentos que coincidan con cualquiera de esos términos.

MongoDB puede mostrar este índice con claves internas `_fts` y `_ftsx`. Es la representación del mismo índice de texto, no dos índices adicionales.

## 4. Índices de las demás colecciones

### `categorias.slug_unico`

```js
{ slug: 1 } // unique: true
```

Localiza una categoría por un identificador legible como `vinos`, `espumantes` o `accesorios`. Impide guardar dos categorías con el mismo slug.

### `bodegas.nombre_unico`

```js
{ nombre: 1 } // unique: true
```

Permite localizar nombres exactos y evita nombres duplicados según la comparación del índice. No tiene configurada una colación que ignore mayúsculas: nombres que solo difieren por mayúsculas no quedan necesariamente considerados iguales.

La búsqueda del catálogo por un fragmento del nombre usa una expresión regular sin anclar. No debe confundirse la utilidad de la restricción única con una garantía de que esa búsqueda parcial aproveche eficientemente el índice.

### `usuarios.email_unico`

```js
{ email: 1 } // unique: true
```

Localiza cuentas por correo e impide repetir un correo con el mismo valor. La aplicación normaliza los correos a minúsculas antes de guardarlos; el índice por sí solo no realiza esa normalización.

### `carritos.carrito_activo_unico`

```js
{ usuarioId: 1 }
// unique: true
// partialFilterExpression: { estado: "activo" }
```

Incluye únicamente carritos activos. Dentro de ese conjunto, `usuarioId` no puede repetirse: una persona puede tener un solo carrito activo, pero varios carritos convertidos o abandonados.

También permite encontrar rápidamente su carrito con `{ usuarioId: ..., estado: "activo" }`. Una búsqueda de todos los carritos históricos del usuario no tiene la misma cobertura, porque el índice omite los que ya no están activos.

### `pedidos.numero_unico`

```js
{ numero: 1 } // unique: true
```

Localiza un pedido por su número e impide que se repita, aunque los pedidos pertenezcan a usuarios diferentes. No genera automáticamente el siguiente número ni garantiza que la numeración sea consecutiva.

### `pedidos.pedidos_de_usuario`

```js
{ usuarioId: 1, creadoEn: -1 }
```

Organiza primero por usuario y luego por fecha descendente. Al buscar los pedidos de una persona, su tramo ya queda del más reciente al más antiguo.

No es un orden cronológico global entre todos los usuarios: las fechas están ordenadas dentro del tramo de cada persona.

### `pedidos.pedidos_por_estado`

```js
{ estadoPedido: 1, creadoEn: -1 }
```

Organiza primero por estado y después por fecha descendente dentro de cada estado. Permite localizar tramos de estados y excluir estados en determinadas consultas.

Se comprobó que el informe de ventas mensuales lo utiliza para excluir cancelados antes de agrupar. El índice no calcula ventas ni totales, y no garantiza por sí solo un orden global por fecha si se consultan varios estados a la vez.

### `inicio.inicio_por_usuario`

```js
{ "usuario.usuarioId": 1 }
// unique: true
// partialFilterExpression: { "usuario.usuarioId": { $exists: true } }
```

Localiza el documento de Inicio de cada usuario e impide que tenga dos documentos de Inicio. Es parcial: solo incluye documentos donde existe ese campo; el validador actual exige además que esté presente y sea un ObjectId.

El índice no comprueba la existencia del usuario en `usuarios`. Esa relación se comprueba en la aplicación y se revisa al preparar la base.

### `catalogo.catalogo_por_usuario`

```js
{ "usuario.usuarioId": 1 }
// unique: true
// partialFilterExpression: { "usuario.usuarioId": { $exists: true } }
```

Localiza la consulta y configuración guardadas para cada usuario e impide que tenga dos documentos de Catálogo. Tiene las mismas condiciones de unicidad y alcance que el índice de Inicio.

No busca productos dentro del catálogo: el documento guarda consulta, metadatos y configuración; los productos se obtienen directamente desde `productos` y utilizan sus propios índices.

## 5. Qué puede y qué no puede resolver un índice

- Un índice compuesto puede atender varias consultas que aprovechen sus campos iniciales. No es necesario duplicarlo con un índice individual para cada campo.
- Un filtro sobre un campo que aparece al final de un compuesto no tiene necesariamente la misma eficiencia que uno sobre el primer campo.
- Si casi todos los documentos cumplen el filtro, todavía puede ser necesario recorrer muchas entradas.
- Filtrar, ordenar, contar todos los resultados y consultar una página son trabajos diferentes. Un índice puede ayudar a uno sin resolver todos.
- `1` y `-1` organizan las entradas del índice; no reordenan físicamente los documentos de la colección según todos esos campos.
- Un índice ocupa espacio y se mantiene al escribir datos. Conviene justificarlo con consultas y mediciones, en lugar de crear todas las combinaciones posibles.

## 6. Cómo comprobar los índices

Consultar los instalados, por colección, desde mongosh:

```js
db.productos.getIndexes();
```

Medir una consulta real:

```js
const categoria = db.categorias.findOne({ slug: "vinos" });

db.productos.find({ activo: true, categoriaId: categoria._id })
  .sort({ nombre: 1, _id: 1 })
  .limit(120)
  .explain("executionStats");
```

Revisar el índice elegido, `nReturned`, `totalDocsExamined`, `totalKeysExamined` y la presencia de una etapa `SORT`. Examinar pocas claves y pocos documentos para devolver los resultados suele ser una señal útil. El tiempo puede variar con el equipo y la caché.

Para aplicar los índices definidos en el proyecto:

```bash
npm run db:indices
```

Este comando sí modifica índices. Su implementación está en [preparar-indices.js](../../src/db/preparar-indices.js); crea los nuevos antes de retirar las definiciones antiguas conocidas, conserva índices manuales adicionales y no modifica documentos.

## Referencias

- [MongoDB: estructura y función de los índices](https://www.mongodb.com/docs/manual/indexes/).
- [Índices compuestos y prefijos](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-compound/).
- [Índices únicos](https://www.mongodb.com/docs/manual/core/index-unique/).
- [Índices parciales](https://www.mongodb.com/docs/manual/core/index-partial/).
- [Índices sparse](https://www.mongodb.com/docs/manual/core/index-sparse/).
- [Propiedades de los índices de texto](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/text-index-properties/).
- [Operador `$text`](https://www.mongodb.com/docs/manual/reference/operator/query/text/).
- [Pesos de relevancia](https://www.mongodb.com/docs/manual/core/indexes/index-types/index-text/control-text-search-results/).
