# AGENTS.md

Proyecto educativo: clon de Pac-Man en Vanilla JS (sin framework, sin build). README y código en español.

## Ejecutar y verificar

- No hay `package.json`, ni build, ni tests. Para probar: servir `src/` con un servidor estático (p. ej. `npx serve src` o la extensión Live Server) y abrir en el navegador.
- Verificación = manual en el navegador. No inventes comandos de test/lint que no existen.

## Arquitectura

- Sin módulos ES: los archivos JS comparten globals y se cargan por orden en `src/index.html` (`maze.js` → `game.js` → `render.js` → `main.js`). Un archivo nuevo debe añadirse como `<script>` ANTES de quien lo use.
- Dependencias entre globals: `main.js` usa `createGame`/`update` (de `game.js`) y `draw` (de `render.js`); `game.js` usa el laberinto de `maze.js`.
- El laberinto vive en `src/js/maze.js` como 31 strings de 28 caracteres (`#` pared, `.` dot, espacio transitable, `-` puerta del pen) que se parsean a números. Canvas de 560×620 = celdas de 20px (28×31). Editar el laberinto ahí, no en render.

## Convenciones

- Comentarios y textos de UI en español, sin tildes en los comentarios del código.
- Estilo de espaciado peculiar: espacios dentro de los paréntesis de llamadas — `createGame( arg )`. Seguirlo en código nuevo.
- El proyecto sigue Spec Driven Development: hay una skill `spec` instalada en `.agents/skills/` (ver `skills-lock.json`). Para features nuevas, trabajar con la spec antes de codificar.
