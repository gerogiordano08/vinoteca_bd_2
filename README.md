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
| `npm run db:init` | Crea o actualiza colecciones, validadores e índices sin borrar datos. |
| `npm run db:seed` | Borra y vuelve a cargar los datos de ejemplo. |
| `npm run consultas` | Ejecuta las 10 consultas avanzadas y muestra tablas. También: `mongosh vinoteca consultas/consultas.mongodb.js`. |
| `npm run rendimiento` | Mide consultas con y sin índice sobre 200.000 productos y 300.000 pedidos en una base aparte, y actualiza `docs/implementacion/rendimiento.md`. |
| `npm run backup` | Backup comprimido en `backups/` con retención y exportación JSON de productos. |
| `npm run restaurar` | Restaura el último backup en `vinoteca_restaurada` y verifica conteos, validador e índices. |
| `npm test` | 27 pruebas automáticas sobre bases de prueba temporales. |

## Cómo está armado

```
src/
  server.js, app.js, config.js
  db/            conexión, validadores $jsonSchema, índices y preparación de la base
  servicios/     lógica de negocio sobre MongoDB
    resumenes.js         subdocumentos que copian inicio y catalogo (secciones 8 y 9 del modelo)
    consultaCatalogo.js  búsqueda, filtros, orden y paginación
    paginas.js           documentos de inicio y catalogo por usuario o visitante
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

**Cómo se usan las colecciones de página.** Inicio y Catálogo se muestran leyendo un único documento de `inicio` o `catalogo` del usuario o del visitante. Ese documento guarda copias de la tienda, el usuario, el carrito, las categorías y los productos. Cuando cambia un dato de origen (un precio, el stock, el nombre de un usuario, el carrito), `sincronizacion.js` actualiza solo las copias afectadas. Así, un precio nuevo puede sacar a un producto del rango de precios que alguien estaba consultando.

## Trabajo en equipo

Antes de empezar una tarea, leé [CONTRIBUTING.md](CONTRIBUTING.md): cada tarea tiene un issue y una rama, y entra a `main` por pull request.
