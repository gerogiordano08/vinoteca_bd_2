# Política de resguardo

Requisito de la consigna: implementar políticas de resguardo. Usa las herramientas de la clase "Migración y resguardo": `mongodump`, `mongorestore` y `mongoexport`.

## Qué se resguarda

La base completa, `vinoteca`: las nueve colecciones del modelo con sus validadores e índices, la serie temporal `historial_precios` (se restaura como serie temporal) y la vista `pagina_vinos`. `mongodump` guarda los datos en BSON, así que conserva tipos como `Decimal128`, `ObjectId` y fechas sin pérdida. Por eso se usa para el backup. `mongoexport` genera JSON legible y sirve para revisar o migrar datos, pero no reemplaza al backup.

## Frecuencia y retención

| Copia | Cuándo | Cuántas se conservan |
| --- | --- | --- |
| Diaria | Todos los días a las 3:00 (fuera del horario de la tienda) | Las 7 últimas |
| Semanal | La del domingo | 4 semanas |
| Antes de un cambio grande | Antes de cargar datos o modificar el modelo | Se guarda aparte, a mano |

Con esto se puede volver a cualquier día de la última semana o a cualquier domingo del último mes. La retención la aplica `scripts/backup.js` en cada ejecución.

## Cómo se hace

```bash
npm run backup        # mongodump comprimido + exportación JSON de productos
npm run restaurar     # restaura el último backup en vinoteca_restaurada y cuenta documentos
node scripts/restaurar.js backups/vinoteca-AAAAMMDD-HHMMSS.archive.gz --sobre   # reemplaza la base de trabajo
```

Comandos equivalentes de la clase:

```bash
mongodump --db=vinoteca --archive=backups/vinoteca.archive.gz --gzip
mongorestore --archive=backups/vinoteca.archive.gz --gzip --drop --nsFrom="vinoteca.*" --nsTo="vinoteca_restaurada.*"
mongoexport --db=vinoteca --collection=productos --out=productos.json --jsonArray
mongoimport --db=vinoteca --collection=productos --file=productos.json --jsonArray
```

## Automatizarlo en Windows

Para que la copia diaria corra sola, se programa con el Programador de tareas:

```powershell
schtasks /Create /SC DAILY /ST 03:00 /TN "Vinoteca backup" /TR "node C:\ruta\al\proyecto\scripts\backup.js"
```

## Prueba de restauración

Un backup que nunca se restauró no garantiza nada. Una vez por mes, o después de cambiar el modelo, se ejecuta `npm run restaurar`. El script restaura en una base aparte (`vinoteca_restaurada`), cuenta los documentos de cada colección y verifica que estén el validador y los índices. Después esa base se borra.

## Fuera del equipo

La carpeta `backups/` no se sube al repositorio (está en `.gitignore`). La copia semanal conviene llevarla a otro lugar, por ejemplo una carpeta de la nube del equipo. En producción, MongoDB Atlas ofrece backups continuos, con recuperación a un punto en el tiempo, y snapshots del proveedor (clase "Cloud").
