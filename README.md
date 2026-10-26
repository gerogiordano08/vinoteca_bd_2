# vinoteca.

E-commerce de vinos, espumantes y accesorios con **Express** y **MongoDB**. Proyecto "Modelado e Implementación MongoDB" de Diseño de Bases de Datos II (Universidad de Mendoza, 2026, Ing. Fernando Zapata).

La aplicación implementa el modelo de datos del equipo (`docs/Modelo_Vinoteca_MongoDB_Diseno_Editorial_Actualizado.docx`) y las pantallas de los bocetos de Figma (`docs/diseno/figma`). **Los productos, bodegas, personas y pedidos son datos ficticios.**

## Qué cubre de la consigna

| Fase b de la consigna | Dónde está |
| --- | --- |
| Planteo de requisitos y de la solución | [docs/implementacion/requisitos-y-solucion.md](docs/implementacion/requisitos-y-solucion.md) |
| Modelado de la estructura de datos | Modelo del equipo (`docs/`), validadores en [src/db/esquemas.js](src/db/esquemas.js) y [decisiones de implementación](docs/implementacion/decisiones.md) |
| Implementación del modelo en MongoDB | 9 colecciones con `$jsonSchema` e índices: `npm run db:init`, o todo desde mongosh con `mongosh db/setup.js` ([ver abajo](#solo-con-mongosh-y-mongodb-compass)) |
| Carga de datos | 25 productos (24 a la venta), 42 usuarios, 180 pedidos y 6 carritos: `npm run db:seed` |
| Consultas avanzadas | 10 agregaciones con `$lookup`, `$unwind`, `$group`, `$project`, `$cond`, `$facet` y `$bucket`: [consultas/avanzadas.js](consultas/avanzadas.js) |
| Medición de desempeño (indización) | `explain("executionStats")` con y sin índice: [docs/implementacion/rendimiento.md](docs/implementacion/rendimiento.md) |
| Políticas de resguardo | `mongodump` / `mongorestore` con retención: [docs/implementacion/backup.md](docs/implementacion/backup.md) |

## Requisitos

- Node.js 20.19 o posterior (mínimo requerido por el driver de MongoDB; también permite usar `--env-file`).
- MongoDB Community Server 7 o posterior, corriendo en `mongodb://127.0.0.1:27017`.
- MongoDB Database Tools (`mongodump`, `mongorestore`, `mongoexport`) en el PATH, para el backup.
- Opcional: `mongosh` y MongoDB Compass para revisar la base.

## Cómo levantarlo

```bash
npm install
npm run db:setup     # crea colecciones, validadores e índices, y carga los datos de ejemplo
npm start            # http://localhost:3000
```

Cuentas de prueba (solo para desarrollo local):

| Correo | Contraseña | Rol |
| --- | --- | --- |
| `ana@example.com` | `vinoteca123` | cliente, con 2 productos en el carrito |
| `admin@vinoteca.test` | `admin2026` | administrador |
| `cliente01@ejemplo.test` … `cliente40@ejemplo.test` | `cliente2026` | clientes con pedidos históricos |

Para cambiar el puerto, la base o la cantidad de productos por página, copiá `.env.example` a `.env` y ejecutá `node --env-file=.env src/server.js`.

Los atajos `npm run consulta` y `npm run rendimiento` cargan `.env`. Los demás comandos de `package.json` actualmente no lo cargan automáticamente: usan las variables exportadas en la terminal o los valores predeterminados de `src/config.js`. Para esos scripts, si necesitás usar `.env`, ejecutalos directamente con `node --env-file=.env ruta/al/script.js`.

## Solo con mongosh y MongoDB Compass

Todo el trabajo con la base también se puede hacer sin Node.js, con los scripts de **mongosh** (desde la carpeta del proyecto) y revisando el resultado en **Compass** (`mongodb://localhost:27017`, base `vinoteca`):

```bash
mongosh db/setup.js            # crea la base desde cero: colecciones, datos, carga masiva, índices, vistas y verificación
mongosh consultas/todas.js     # todas las consultas de la aplicación, pantalla por pantalla
mongosh rendimiento/medir.js   # executionTimeMillis sin índices y con índices
```

`db/setup.js` **borra la base `vinoteca`** y la vuelve a crear en unos 15 segundos. Después se puede usar la aplicación (`npm start`) sobre esa misma base.

| Script | Qué hace |
| --- | --- |
| [`db/00_crear_db.js`](db/00_crear_db.js) | Crea las 9 colecciones con los validadores `$jsonSchema` de `src/db/esquemas.js` |
| [`db/01_datos.js`](db/01_datos.js) | Carga los datos de ejemplo de [`db/datos/`](db/datos/) (Extended JSON: conserva `ObjectId`, fechas y `Decimal128`) |
| [`db/02_datos_masivos.js`](db/02_datos_masivos.js) | Genera 200.000 productos, 10.000 usuarios y 50.000 pedidos, siempre los mismos (semilla fija) |
| [`db/03_indices.js`](db/03_indices.js) | Crea los índices de `src/db/indices.js`, después de la carga |
| [`db/04_vistas.js`](db/04_vistas.js) | Crea las vistas para Compass: `consulta_01` … `consulta_10` y `pagina_vinos` |
| [`db/05_verificar.js`](db/05_verificar.js) | Muestra el volumen, prueba que los validadores e índices únicos rechacen documentos inválidos y controla la integridad de las referencias |

Cada script también se puede correr solo, por ejemplo `mongosh db/05_verificar.js`. Las cantidades de la carga masiva están en [`db/config.js`](db/config.js); para una base chica, en PowerShell: `$env:PRODUCTOS=0; $env:USUARIOS=0; $env:PEDIDOS=0; mongosh db/setup.js`.

- **Consultas por pantalla:** [`consultas/1_inicio.js`](consultas/1_inicio.js) a [`consultas/7_analitica.js`](consultas/7_analitica.js), con los resultados reales en [docs/implementacion/consultas-por-pantalla.md](docs/implementacion/consultas-por-pantalla.md).
- **Rendimiento:** `getIndexes`, `dropIndex`, `createIndex` y `explain("executionStats")`, con los resultados en [docs/implementacion/rendimiento-mongosh.md](docs/implementacion/rendimiento-mongosh.md).
- **En Compass:** las vistas (ícono del ojo) muestran las 10 consultas avanzadas y la página de Vinos con un clic; en cada colección, **Validation** muestra el `$jsonSchema`, **Indexes** los índices y **Explain Plan** el plan de una consulta.
- **Backup:** los comandos `mongodump`, `mongorestore`, `mongoexport` y `mongoimport` están en [docs/implementacion/backup.md](docs/implementacion/backup.md).

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm start` / `npm run dev` | Inicia la aplicación (`dev` se reinicia al guardar). |
| `npm run db:init` | Actualiza validadores e índices; elimina páginas antiguas de visitantes o sin usuario existente. Conserva productos, usuarios y pedidos. |
| `npm run db:indices` | Actualiza solo los índices, sin modificar documentos ni validadores. |
| `npm run db:seed` | Borra y vuelve a cargar los datos de ejemplo. |
| `npm run db:paginas` | Agrega cinco cuentas de demostración con sus páginas de Inicio y Catálogo y distintos productos. No borra datos. |
| `npm run db:volumen:compartidas` | Genera hasta 200.000 productos reutilizando los 8 archivos de imagen originales. |
| `npm run db:volumen:copias` / `npm run db:volumen` | Genera hasta 200.000 productos con una copia de imagen independiente por producto. |
| `npm run consultas` | Ejecuta las 10 consultas avanzadas y muestra tablas. También: `mongosh vinoteca consultas/consultas.mongodb.js`. |
| `npm run consulta -- 3` | Ejecuta solo la consulta número 3 (del 1 al 10), usando la configuración de `.env`. |
| `npm run rendimiento` | Lee los índices activos de la base configurada en `.env`, los reproduce en una base temporal y compara consultas sobre datos sintéticos. Actualiza `docs/implementacion/rendimiento.md`. |
| `npm run backup` | Backup comprimido en `backups/` con retención y exportación JSON de productos. |
| `npm run restaurar` | Restaura el último backup en `${MONGODB_DB}_restaurada` (por defecto `vinoteca_restaurada`). Muestra conteos por colección e informa sobre el validador y los índices de productos; no compara los resultados contra el backup. |
| `npm test` | Pruebas automáticas sobre bases de prueba temporales. |

Los atajos se definen en la sección `scripts` de [package.json](package.json): la clave es el nombre que sigue a `npm run` y el valor es el comando que se ejecuta. Por ejemplo, `"consulta": "node --env-file=.env consultas/ejecutar.js"` permite usar `npm run consulta -- 3`. El separador `--` hace que npm pase el `3` como argumento al script.

## Consultas avanzadas

Las diez consultas están definidas en [consultas/avanzadas.js](consultas/avanzadas.js). Son agregaciones de lectura sobre la base existente: no generan datos ni modifican documentos.

```bash
# Ejecutar todas con los valores predeterminados o las variables de la terminal
npm run consultas

# Ejecutar todas cargando .env
node --env-file=.env scripts/consultas-avanzadas.js

# Ejecutar únicamente la consulta 3, cargando .env
npm run consulta -- 3

# Equivalente sin el atajo de npm
node --env-file=.env consultas/ejecutar.js 3
```

[consultas/ejecutar.js](consultas/ejecutar.js) acepta un único número del **1 al 10**, correspondiente a la tabla siguiente. Si falta el argumento o está fuera del rango, muestra un error sin ejecutar consultas. Ambos ejecutores de Node.js muestran los resultados en tablas; la consulta 10 muestra una tabla por cada resumen. También se pueden ejecutar todas desde `mongosh` con `mongosh vinoteca consultas/consultas.mongodb.js`; ese comando elige explícitamente la base `vinoteca` y no lee `.env`.

| N.º | Consulta | Qué calcula y cómo |
| --- | --- | --- |
| 1 | Ventas por mes | Agrupa los pedidos por año y mes, con zona horaria UTC−03:00. Cuenta pedidos, suma sus totales y calcula el ticket promedio como total dividido por cantidad de pedidos. Usa `$group` y `$project`, y ordena cronológicamente. |
| 2 | Los 5 productos más vendidos | Separa los ítems de cada pedido con `$unwind`, suma unidades e ingresos por producto y selecciona los cinco con más unidades (desempata por ingresos). Con `$lookup` obtiene su nombre y stock actuales. |
| 3 | Ingresos por categoría | Relaciona los ítems vendidos con `productos` y después con `categorias`, mediante dos `$lookup`. Suma unidades e ingresos por nombre de categoría y ordena por ingresos descendentes. |
| 4 | Ventas por bodega y provincia | Relaciona los ítems vendidos con su producto y bodega. Incluye los productos que tienen `bodegaId`, agrupa por nombre de bodega y provincia de esa bodega, y suma unidades e ingresos. La provincia no es la del comprador. |
| 5 | Los 5 clientes que más compraron | Agrupa pedidos por usuario y calcula cantidad de pedidos, importe total y fecha de última compra. Selecciona los cinco de mayor importe y obtiene nombre y apellido con `$lookup` a `usuarios`. |
| 6 | Control de stock con semáforo | Busca productos activos con stock menor a 10. Con `$switch` clasifica stock 0 como «Sin stock», menor a 6 como «Crítico» y el resto como «Bajo». Devuelve SKU, nombre, stock y nivel, ordenados por stock y nombre. |
| 7 | Retiro frente a envío | Agrupa los pedidos por `direccionEntrega.tipo`. Calcula cantidad, porcentaje sobre el total de pedidos considerados y suma de los totales por modalidad. Usa `$group`, `$unwind` y `$cond` para presentar los resultados. |
| 8 | Carritos abandonados | Selecciona los carritos cuyo estado ya es `abandonado`; no determina abandono por antigüedad. Cruza sus ítems con los precios actuales de `productos` y calcula cantidad de carritos, unidades y valor potencial de esos productos. |
| 9 | Precio histórico frente a actual | Calcula por producto el promedio de `items.precioUnitario` guardado en pedidos y lo compara con el precio actual de `productos`. Muestra la diferencia porcentual y los ocho productos con mayor precio actual. El promedio no está ponderado por cantidad de unidades; una diferencia negativa indica una baja. |
| 10 | Resumen del catálogo | Sobre productos activos, usa `$facet` para obtener tres resúmenes en una agregación: cantidad y stock por tipo; cantidad por color, cuando existe; y cantidad por rango de precio mediante `$bucket`. Los límites son 0, 10.000, 15.000, 20.000, 30.000 y 100.000; cada rango incluye el límite inferior y excluye el superior. Los valores fuera de esos rangos van a «Otros». |

Las consultas 1–5, 7 y 9 excluyen los pedidos `cancelado`, pero incluyen los demás estados: sus importes no equivalen necesariamente a pagos cobrados. Las que suman `items.subtotal` calculan ingresos de productos; las que suman `total` usan el total del pedido. La consulta 8 informa un valor potencial, no una pérdida de dinero confirmada.

Los cruces con productos, categorías, bodegas y usuarios usan los documentos actuales. Si falta el documento relacionado, los `$unwind` posteriores al `$lookup` descartan esa fila. Por eso, los datos históricos de los ítems y los datos actuales del catálogo cumplen funciones distintas; por ejemplo, la categoría de la consulta 3 es la categoría actual del producto.

Estos comandos muestran resultados de negocio. Para comparar planes de ejecución y documentos examinados con los índices actuales, usá `npm run rendimiento`, explicado más abajo; sus casos de prueba son distintos de estas diez agregaciones.

## Cómo está armado

La revisión de los índices del catálogo, con los planes y resultados antes y después sobre los 200.025 productos cargados, está en [docs/implementacion/indices.md](docs/implementacion/indices.md).

La [guía de índices](docs/implementacion/guia-indices.md) explica los 26 índices del esquema, cómo organizan las entradas, qué consultas resuelven y cómo funcionan la unicidad y la búsqueda de texto.

### Medir los índices actuales

Con `.env` configurado, ejecutá `npm run rendimiento`. Lee las definiciones de índices de `MONGODB_DB` (por defecto `vinoteca`) sin modificar esa base. **Borra y vuelve a crear `${MONGODB_DB}_rendimiento`**, donde genera 200.000 productos, 300.000 pedidos y datos auxiliares simplificados. Compara las consultas primero sin índices secundarios y después con los índices activos reproducidos, conservando sus nombres, campos, pesos y opciones. Al finalizar elimina la base temporal; `CONSERVAR=1` permite conservarla.

Para una ejecución más pequeña: `PRODUCTOS=5000 PEDIDOS=8000 npm run rendimiento`. El informe se escribe en `docs/implementacion/rendimiento.md`; podés elegir otro archivo con `REPORTE=/tmp/rendimiento.md`. Las consultas de prueba están definidas en el script; los índices se descubren en cada ejecución. El inventario informa cuáles eligió MongoDB y cuáles no utilizó en esos casos: esto último no demuestra que sean inútiles. No mide escrituras ni valida unicidad. Los índices ocultos, en construcción y TTL se informan pero no se reproducen; `_id_` está presente en ambas mediciones. `$text` se mide solo con índice porque lo necesita para ejecutarse.

### Cargar productos para consultas propias

Con la base de ejemplo ya inicializada y `.env` configurado para `vinoteca`, elegí una de las dos variantes:

```bash
# Imágenes guardadas una sola vez, compartidas entre los productos
node --env-file=.env scripts/generar-productos-compartidos.js

# Una copia de imagen por producto
node --env-file=.env scripts/generar-productos.js
```

Ambos comandos cargan `.env`, generan los mismos 200.000 productos adicionales en lotes de 5.000 y reutilizan las categorías y bodegas de ejemplo para que se puedan consultar desde la página. Los atajos `npm run db:volumen:compartidas` y `npm run db:volumen:copias` ejecutan esos mismos generadores, pero sin cargar `.env` automáticamente. Con los 25 productos originales, la colección queda con 200.025 documentos (200.024 activos). No generan pedidos ni ejecutan consultas de rendimiento ni cambian su informe. Actualizan las copias de productos de Inicio al finalizar; Catálogo obtiene los productos directamente al consultarlo.

`compartidas` reutiliza los 8 SVG originales sin crear archivos adicionales. `copias` crea 200.000 archivos en `public/img/productos/volumen/`, distribuidos en subcarpetas de 1.000. El contenido visual se repite, pero cada producto tiene su propio archivo y URL. MongoDB guarda la URL en ambos modos; los archivos están en el disco y quedan fuera de Git. `npm run db:volumen` sigue siendo un alias del modo `copias`.

Los SKU `VOL-0000001` a `VOL-0200000` están reservados para estos generadores. Repetir un comando completa los productos y archivos que falten sin duplicarlos ni sobrescribir archivos existentes. Cambiar de modo actualiza las rutas de imagen del generador conservando los demás datos y las imágenes personalizadas. El modo compartido no elimina copias ya creadas; por eso ejecutarlo después del modo copias no libera espacio de disco. Para una carga menor: `PRODUCTOS=1000 npm run db:volumen:compartidas` (también funciona con `copias`). La cantidad indica cuántos SKU del generador deben existir, no cuántos agregar en cada ejecución; reducirla no elimina productos ni archivos ya generados. El cambio de modo solo afecta a los SKU incluidos en esa cantidad.

`npm run db:seed` y `npm run db:setup` borran también estos productos, pero no eliminan sus archivos de imagen. La base se elige con `MONGODB_DB` (por defecto `vinoteca`); si lo definís en `.env`, recordá usar la ejecución directa con `--env-file`. Mantené una paginación acotada para navegar el catálogo.

### Cuentas de prueba con Inicio y Catálogo personalizados

Estas cinco cuentas permiten comparar cómo cambia la página según el usuario registrado. Cada una tiene su propio documento en `inicio` y otro en `catalogo`, vinculados a su usuario mediante `usuario.usuarioId`. Todas tienen rol `cliente` y comparten la contraseña de desarrollo **`paginas2026`**.

| Nombre | Correo para ingresar | Selección de Inicio y filtro inicial de Catálogo |
| --- | --- | --- |
| Tomás Tintos | `demo-tintos@vinoteca.test` | Vinos tintos |
| Blanca Blancos | `demo-blancos@vinoteca.test` | Vinos blancos |
| Rocío Rosados | `demo-rosados@vinoteca.test` | Vinos rosados |
| Emilia Espumantes | `demo-espumantes@vinoteca.test` | Espumantes |
| Alejo Accesorios | `demo-accesorios@vinoteca.test` | Accesorios |

Para crearlas en una base que ya tenga las categorías y productos de ejemplo:

```bash
npm run db:paginas

# Si necesitás cargar la conexión definida en .env
node --env-file=.env scripts/cargar-usuarios-personalizados.js
```

Para probarlas, iniciá sesión con uno de los correos y la contraseña indicada. Abrí Inicio (`/`) para ver su selección y Catálogo (`/catalogo`, sin parámetros) para ver el filtro guardado, inicialmente ordenado por nombre. Cerrá sesión y entrá con otra cuenta para comparar. Si cambiás los filtros del catálogo, se conserva la última consulta de esa cuenta; ejecutar nuevamente el generador restablece el filtro de demostración.

El documento de Catálogo conserva el filtro de su grupo, los datos de usuario y tienda y la configuración de paginación. Los productos se consultan directamente en cada visita y no se guardan dentro de ese documento. Inicio guarda hasta cuatro productos disponibles de ese grupo, junto con `seleccionProductoIds` para conservar esa selección al sincronizar precios, stock o categorías. Si un producto deja de estar disponible se oculta; si vuelve a estar disponible reaparece. Las páginas sin selección propia mantienen los destacados generales.

El comando reutiliza los productos existentes, incluidos los generados para volumen. Repetirlo reutiliza las cinco cuentas y restablece sus selecciones y filtros de demostración; no modifica otras cuentas ni sus páginas. Si una de esas direcciones de correo ya existe con otras credenciales o rol, se detiene sin reemplazarla. No genera productos, pedidos ni carritos. Para ver cada selección, iniciá sesión con la cuenta correspondiente y abrí `/` o `/catalogo` sin parámetros.

### Estructura

```
src/
  server.js, app.js, config.js
  db/            conexión, validadores $jsonSchema, índices y preparación de la base
  servicios/     lógica de negocio sobre MongoDB
    resumenes.js         subdocumentos que copian inicio y catalogo (secciones 8 y 9 del modelo)
    consultaCatalogo.js  búsqueda, filtros, orden y paginación
    paginas.js           documentos de inicio y catalogo por usuario; vistas públicas sin persistencia
    sincronizacion.js    actualización de las copias (sección 10 del modelo)
    carritos.js, pedidos.js, usuarios.js, productos.js
  rutas/         rutas de Express (tienda, carrito, pedido, cuenta)
  vistas/        plantillas EJS de cada pantalla de Figma
  datos/         datos de ejemplo
public/          estilos, scripts del navegador e ilustraciones SVG
scripts/         inicializar, cargar datos, consultas, rendimiento, backup y restauración
consultas/       consultas avanzadas (Node.js y mongosh)
tests/           pruebas con node:test
docs/            modelo, bocetos e implementación
```

**Cómo se usan las colecciones de página.** Solo se guardan documentos de `inicio` y `catalogo` para usuarios registrados. Cada documento exige `usuario.usuarioId` como ObjectId y la aplicación comprueba que ese usuario exista antes de guardar o devolver su página. El validador de MongoDB exige el tipo, pero no actúa como una clave foránea entre colecciones. Ambas colecciones conservan copias de tienda, usuario, carrito y categorías. Inicio guarda además los resúmenes de sus productos seleccionados. Catálogo guarda la consulta y `paginacion.paginaActual` / `productosPorPagina`, pero no productos, totales ni opciones de filtro: se calculan desde `productos` en cada lectura (las opciones de filtro, dos `distinct` costosos con mucho volumen, se reutilizan en memoria del servidor hasta un minuto, sin guardarse en la base). `sincronizacion.js` actualiza los metadatos compartidos y las copias de productos de Inicio; los cambios de precio, stock o bodega no recalculan catálogos guardados.

Los visitantes pueden navegar por Inicio y Catálogo sin iniciar sesión. Sus vistas se construyen en cada petición, no tienen documento propio en MongoDB ni crean usuarios invitados. Sus filtros y página actual viajan en la URL; al volver a `/catalogo` sin parámetros se muestra la consulta inicial. Los usuarios registrados conservan su última consulta guardada.

Para aplicar este cambio a una base existente, detené el servidor y ejecutá `npm run db:init` (o `node --env-file=.env scripts/inicializar-base.js` si usás una conexión personalizada). Elimina páginas de visitantes, páginas sin referencia válida y páginas cuyo usuario ya no existe, retira los índices de visitantes y actualiza los validadores. En Catálogo también elimina los campos derivados `productos`, `opcionesFiltro`, `paginacion.totalProductos` y `paginacion.totalPaginas`, conservando `_id`, usuario, metadatos, consulta y configuración; retira el índice obsoleto `catalogo_por_producto`. El nuevo validador impide volver a guardar esos campos. No ejecutes `db:setup` para esta migración: ese comando vuelve a cargar los datos de ejemplo. Después reiniciá el servidor.

## Trabajo en equipo

Antes de empezar una tarea, leé [CONTRIBUTING.md](CONTRIBUTING.md): cada tarea tiene un issue y una rama, y entra a `main` por pull request.
