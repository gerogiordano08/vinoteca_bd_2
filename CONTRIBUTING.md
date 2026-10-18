# Cómo trabajamos en el repositorio

El objetivo es que los cambios de cada integrante no se pisen. La regla general es simple: **nadie trabaja directamente en `main`**. Cada tarea va en su rama y entra por pull request.

## 1. Antes de empezar una tarea

1. Fijate en [Issues](../../issues) que nadie la esté haciendo. Si no existe, creá un issue que describa la tarea.
2. Asignate el issue, así el resto sabe que lo tomaste.
3. Actualizá `main` y creá la rama desde ahí. El nombre de la rama es el número del issue más una descripción corta, como `1-disenar-bocetos-figma`:

```bash
git switch main
git pull
git switch -c 7-pantalla-mis-pedidos
```

## 2. Mientras trabajás

- Hacé commits chicos, con mensajes que digan qué cambia: `feat: agrega filtro por bodega`, `fix: corrige el total con envío`, `docs: explica el índice de texto`.
- Si `main` avanzó mientras trabajabas, traé esos cambios a tu rama antes de abrir el pull request:

```bash
git fetch origin
git merge origin/main     # resolvé los conflictos si aparecen, probá y hacé commit
```

- Subí tu rama a GitHub cuando quieras guardar el avance: `git push -u origin 7-pantalla-mis-pedidos`.

## 3. Pull request

1. Abrí el pull request de tu rama hacia `main`, con `Closes #7` en la descripción para que el issue se cierre al aprobarlo.
2. Si todavía no está terminado, abrilo como **borrador** (*draft*): así el resto ve en qué archivos estás trabajando.
3. Antes de pedir revisión, ejecutá `npm test` y probá la pantalla en el navegador.
4. Otro integrante lo revisa. Se combina con **Squash and merge** y después se borra la rama.

## 4. Archivos que conviene no editar a la vez

Algunos archivos no se pueden combinar automáticamente. Avisá en el issue antes de tocarlos:

| Archivo | Por qué |
| --- | --- |
| `docs/Modelo_Vinoteca_MongoDB_Diseno_Editorial_Actualizado.docx` | Es binario: si dos personas lo editan, una de las versiones se pierde. Para cambiar el modelo, proponé el cambio en el issue y que lo edite una sola persona. |
| `docs/diseno/figma/*` | Son exportaciones de Figma. Se regeneran desde el archivo de Figma, no se editan a mano. |
| `package-lock.json` | Lo genera npm. Si hay conflicto, quedate con la versión de `main` y ejecutá `npm install` de nuevo. |
| `docs/implementacion/rendimiento.md` | Lo genera `npm run rendimiento`. Si hay conflicto, volvé a ejecutar el comando. |

## 5. Base de datos

- Cada uno trabaja con su base local (`vinoteca`), que se crea con `npm run db:setup`. La base no se sube al repositorio.
- Si cambiás un validador o un índice, editá `src/db/esquemas.js` o `src/db/indices.js` y avisalo en el pull request: el resto tiene que ejecutar `npm run db:init`.
- Si cambiás los datos de ejemplo, el resto tiene que ejecutar `npm run db:seed`. Ojo: borra los datos de la base local.
- Los backups (`backups/`) y el archivo `.env` quedan solo en tu computadora.
