# SPEC 01 — Cuatro fantasmas con IA clásica arcade

> **Estado:** approved
> **Depende de:** nada
> **Fecha:** 2026-10-19
> **Objetivo:** Reemplazar los 2 fantasmas actuales por 4 con las personalidades clásicas del arcade (Blinky, Pinky, Inky, Clyde) y salida escalonada de la pen.

## Scope

**In:**

- 4 fantasmas con personalidad clásica: **blinky** persigue directo, **pinky** apunta 4 celdas delante de Pac-Man, **inky** flanquea usando la posición de blinky, **clyde** persigue si está lejos (distancia > 8) o se retira a su esquina si está cerca.
- Salida escalonada de la pen: cada fantasma sale unos 3 s después del anterior.
- 4 posiciones iniciales dentro de la pen en `maze.js`.
- La puerta (`-`) deja de ser transitable para un fantasma una vez que salió (evita reentrada).

**Out of scope (para futuras specs):**

- Ciclo scatter/chase alternos.
- Modo asustado / power pellets.
- Velocidades distintas por fantasma (todos usan `GHOST_SPEED`).
- Pathfinding (A\*): se mantiene la elección greedy por dirección del arcade.

## Data model

```js
// Entrada por fantasma en maze.js
const GHOST_STARTS = [
  { x: 14, y: 14, name: 'blinky' },
  { x: 13, y: 14, name: 'pinky'  },
  { x: 12, y: 14, name: 'inky'   },
  { x: 15, y: 14, name: 'clyde'  },
];

// Objeto fantasma en game.js
{
  name, x, y, dir, speed,
  phase: 'pen' | 'out',   // 'pen': esperando o acercandose a la puerta
  penTimer: 0,            // frames restantes para iniciar la salida
}
```

`render.js` ya tiene los 4 colores arcade (`GHOST_COLORS`); se les añade el `name` para mapear color por nombre y no por índice.

## Implementation plan

1. `maze.js`: sustituir `GHOST_STARTS` por las 4 entradas con `name`. Manual: la partida arranca y se ven 4 fantasmas quietos en la pen.
2. `game.js`: `createGame` inicializa los 4 con `phase: 'pen'` y `penTimer` escalonado (`i * 180` frames ≈ 3 s). Manual: siguen quietos, sin errores.
3. `game.js`: salida de la pen — al agotarse `penTimer`, el fantasma se autocpilota (horizontal hacia la col 13/14, luego sube por la puerta hasta la fila 11) y pasa a `phase: 'out'`. Desde `out`, la puerta cuenta como muro. Manual: salen uno a uno.
4. `game.js`: `decideGhost` con un target por personalidad (`blinky` → celda de Pac-Man; `pinky` → Pac-Man + 4 en su dirección; `inky` → reflejo de blinky sobre el punto 2 delante de Pac-Man; `clyde` → persigue o esquina inferior-izquierda). Elección greedy sin reversa, igual que el `hunter` actual. Se elimina el `kind` `random`.
5. `render.js`: color por `name`.
6. Verificación final manual en navegador (checklist de abajo).

## Acceptance criteria

- [ ] Al iniciar se ven 4 fantasmas de colores distintos (rojo, cyan, rosa, naranja) dentro de la pen.
- [ ] Salen de la pen uno a uno, ~3 s entre salidas, sin atravesar paredes.
- [ ] Ningún fantasma vuelve a entrar en la pen por la puerta.
- [ ] Blinky reduce distancia con Pac-Man en cruces abiertos.
- [ ] Pinky se sitúa delante de la dirección de marcha de Pac-Man.
- [ ] Clyde se acerca de lejos y se retira cuando está a ≤ 8 celdas.
- [ ] El resto del juego (dots, colisiones, vidas, victoria/derrota) funciona igual que antes.
- [ ] Consola sin errores.

## Decisions

- **Sí:** esquema clásico arcade. Elegido por el usuario sobre mantener `hunter`/`random`.
- **No:** scatter/chase y modo asustado. Sería otra spec entera.
- **Sí:** Inky dependiente de blinky. Fiel al arcade; aceptado explícitamente.
- **Sí:** misma velocidad para los 4. Simplicidad; los clásicos difieren solo en detalles finos.
- **No:** reproducir el bug clásico de Pinky al mirar arriba (overflow del objetivo). Simplificación sin impacto jugable.
- **Sí:** puerta como muro tras salir. Previene reentradas raras sin coste.

## Risks

| Riesgo                                             | Mitigación                                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Atascos en la pen al salir por el mismo hueco      | Salida escalonada y autopiloto simple; los fantasmas no colisionan entre sí (como el arcade) |
| 4 fantasmas persiguiendo = juego mucho más difícil | Comportamiento deseado; ya hay 3 vidas y reset de posiciones                                 |

## What is **not** in this spec

- Scatter/chase, power pellets, velocidades por fantasma, pathfinding. Cada uno, si aterriza, en su propia spec.
