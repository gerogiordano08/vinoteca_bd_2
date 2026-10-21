# vinoteca.

E-commerce de vinos, espumantes y accesorios con **Express** y **MongoDB**. Proyecto "Modelado e Implementación MongoDB" de Diseño de Bases de Datos II (Universidad de Mendoza, 2026, Ing. Fernando Zapata).

La aplicación implementa el modelo de datos del equipo (`docs/Modelo_Vinoteca_MongoDB_Diseno_Editorial_Actualizado.docx`) y las pantallas de los bocetos de Figma (`docs/diseno/figma`). **Los productos, bodegas, personas y pedidos son datos ficticios.**

## Qué cubre de la consigna

| Fase b de la consigna | Dónde está |
| --- | --- |
| Planteo de requisitos y de la solución | [docs/implementacion/requisitos-y-solucion.md](docs/implementacion/requisitos-y-solucion.md) |
| Modelado de la estructura de datos | Modelo del equipo (`docs/`), validadores en [src/db/esquemas.js](src/db/esquemas.js) y [decisiones de implementación](docs/implementacion/decisiones.md) |
| Implementación del modelo en MongoDB | 9 colecciones con `$jsonSchema` e índices: `npm run db:init` |
| Carga de datos | 25 productos (24 a la venta), 42 usuarios, 180 pedidos y 6 carritos: `npm run db:seed` |
| Consultas avanzadas | 10 agregaciones con `$lookup`, `$unwind`, `$group`, `$project`, `$cond`, `$facet` y `$bucket`: [consultas/avanzadas.js](consultas/avanzadas.js) |
| Medición de desempeño (indización) | `explain("executionStats")` con y sin índice: [docs/implementacion/rendimiento.md](docs/implementacion/rendimiento.md) |
| Políticas de resguardo | `mongodump` / `mongorestore` con retención: [docs/implementacion/backup.md](docs/implementacion/backup.md) |

## Requisitos

- Node.js 20 o posterior.
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

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm start` / `npm run dev` | Inicia la aplicación (`dev` se reinicia al guardar). |
| `npm run db:init` | Actualiza validadores e índices; elimina páginas antiguas de visitantes o sin usuario existente. Conserva productos, usuarios y pedidos. |
| `npm run db:indices` | Carga `.env` y actualiza solo los índices, sin modificar documentos ni validadores. |
| `npm run db:seed` | Borra y vuelve a cargar los datos de ejemplo. |
| `npm run db:paginas` | Agrega cinco cuentas de demostración con sus páginas de Inicio y Catálogo y distintos productos. No borra datos. |
| `npm run db:volumen:compartidas` | Genera hasta 200.000 productos reutilizando los 8 archivos de imagen originales. |
| `npm run db:volumen:copias` / `npm run db:volumen` | Genera hasta 200.000 productos con una copia de imagen independiente por producto. |
| `npm run consultas` | Ejecuta las 10 consultas avanzadas y muestra tablas. También: `mongosh vinoteca consultas/consultas.mongodb.js`. |
| `npm run rendimiento` | Mide consultas con y sin índice sobre 200.000 productos y 300.000 pedidos en una base aparte, y actualiza `docs/implementacion/rendimiento.md`. |
| `npm run backup` | Backup comprimido en `backups/` con retención y exportación JSON de productos. |
| `npm run restaurar` | Restaura el último backup en `vinoteca_restaurada` y verifica conteos, validador e índices. |
| `npm test` | Pruebas automáticas sobre bases de prueba temporales. |

## Cómo está armado

La revisión de los índices del catálogo, con los planes y resultados antes y después sobre los 200.025 productos cargados, está en [docs/implementacion/indices.md](docs/implementacion/indices.md).

La [guía de índices](docs/implementacion/guia-indices.md) explica los 26 índices del esquema, cómo organizan las entradas, qué consultas resuelven y cómo funcionan la unicidad y la búsqueda de texto.

### Cargar productos para consultas propias

Con la base de ejemplo ya inicializada y `.env` configurado para `vinoteca`, elegí una de las dos variantes:

```bash
# Imágenes guardadas una sola vez, compartidas entre los productos
npm run db:volumen:compartidas

# Una copia de imagen por producto
npm run db:volumen:copias
```

Ambos comandos cargan `.env`, generan los mismos 200.000 productos adicionales en lotes de 5.000 y reutilizan las categorías y bodegas de ejemplo para que se puedan consultar desde la página. Con los 25 productos originales, la colección queda con 200.025 documentos (200.024 activos). No generan pedidos ni ejecutan consultas de rendimiento ni cambian su informe. Actualizan las copias de productos de Inicio al finalizar; Catálogo obtiene los productos directamente al consultarlo.

`compartidas` reutiliza los 8 SVG originales sin crear archivos adicionales. `copias` crea 200.000 archivos en `public/img/productos/volumen/`, distribuidos en subcarpetas de 1.000. El contenido visual se repite, pero cada producto tiene su propio archivo y URL. MongoDB guarda la URL en ambos modos; los archivos están en el disco y quedan fuera de Git. `npm run db:volumen` sigue siendo un alias del modo `copias`.

Los SKU `VOL-0000001` a `VOL-0200000` están reservados para estos generadores. Repetir un comando completa los productos y archivos que falten sin duplicarlos ni sobrescribir archivos existentes. Cambiar de modo actualiza las rutas de imagen del generador conservando los demás datos y las imágenes personalizadas. El modo compartido no elimina copias ya creadas; por eso ejecutarlo después del modo copias no libera espacio de disco. Para una carga menor: `PRODUCTOS=1000 npm run db:volumen:compartidas` (también funciona con `copias`). La cantidad indica cuántos SKU del generador deben existir, no cuántos agregar en cada ejecución; reducirla no elimina productos ni archivos ya generados. El cambio de modo solo afecta a los SKU incluidos en esa cantidad.

`npm run db:seed` y `npm run db:setup` borran también estos productos, pero no eliminan sus archivos de imagen. El comando anterior usa la base indicada en `MONGODB_DB` de `.env`; mantené una paginación acotada para navegar el catálogo.

### Cinco usuarios con páginas diferentes

`npm run db:paginas` crea las cuentas siguientes (contraseña de desarrollo: `paginas2026`) y un documento de Inicio y otro de Catálogo por cuenta:

| Cuenta | Selección |
| --- | --- |
| `demo-tintos@vinoteca.test` | Vinos tintos |
| `demo-blancos@vinoteca.test` | Vinos blancos |
| `demo-rosados@vinoteca.test` | Vinos rosados |
| `demo-espumantes@vinoteca.test` | Espumantes |
| `demo-accesorios@vinoteca.test` | Accesorios |

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

**Cómo se usan las colecciones de página.** Solo se guardan documentos de `inicio` y `catalogo` para usuarios registrados. Cada documento exige `usuario.usuarioId` como ObjectId y la aplicación comprueba que ese usuario exista antes de guardar o devolver su página. El validador de MongoDB exige el tipo, pero no actúa como una clave foránea entre colecciones. Ambas colecciones conservan copias de tienda, usuario, carrito y categorías. Inicio guarda además los resúmenes de sus productos seleccionados. Catálogo guarda la consulta y `paginacion.paginaActual` / `productosPorPagina`, pero no productos, totales ni opciones de filtro: se calculan desde `productos` en cada lectura. `sincronizacion.js` actualiza los metadatos compartidos y las copias de productos de Inicio; los cambios de precio, stock o bodega no recalculan catálogos guardados.

Los visitantes pueden navegar por Inicio y Catálogo sin iniciar sesión. Sus vistas se construyen en cada petición, no tienen documento propio en MongoDB ni crean usuarios invitados. Sus filtros y página actual viajan en la URL; al volver a `/catalogo` sin parámetros se muestra la consulta inicial. Los usuarios registrados conservan su última consulta guardada.

Para aplicar este cambio a una base existente, detené el servidor y ejecutá `npm run db:init` (o `node --env-file=.env scripts/inicializar-base.js` si usás una conexión personalizada). Elimina páginas de visitantes, páginas sin referencia válida y páginas cuyo usuario ya no existe, retira los índices de visitantes y actualiza los validadores. En Catálogo también elimina los campos derivados `productos`, `opcionesFiltro`, `paginacion.totalProductos` y `paginacion.totalPaginas`, conservando `_id`, usuario, metadatos, consulta y configuración; retira el índice obsoleto `catalogo_por_producto`. El nuevo validador impide volver a guardar esos campos. No ejecutes `db:setup` para esta migración: ese comando vuelve a cargar los datos de ejemplo. Después reiniciá el servidor.

## Trabajo en equipo

Antes de empezar una tarea, leé [CONTRIBUTING.md](CONTRIBUTING.md): cada tarea tiene un issue y una rama, y entra a `main` por pull request.
