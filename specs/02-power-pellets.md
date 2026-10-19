# SPEC 02 — Power pellets y modo asustado

> **Estado:** approved
> **Depende de:** SPEC 01
> **Fecha:** 2026-10-20
> **Objetivo:** Añadir 4 power pellets (uno por esquina) que asustan a los fantasmas durante 6 s efectivos, permitiendo a Pacman comerlos por 200/400/800/1600 puntos.

## Scope

**In:**

- 4 power pellets en las esquinas clásicas: (1,3), (26,3), (1,23), (26,23). Nuevo tile 4 (`'o'` en `MAZE_STR`).
- Comer un power pellet: +50 puntos, activa el modo asustado y pone en reversa a los fantasmas que están fuera.
- Modo asustado: 6 s (360 frames) de reloj efectivo; **el reloj se pausa** mientras haya fantasmas en fase `pen`. Los fantasmas que salen de la pen con el temporizador activo salen ya asustados.
- Fantasma asustado: huye (target = celda espejo de Pacman: `{ x: 27 - px, y: 30 - py }`) a velocidad `FRIGHT_SPEED = 0.07`. Aspecto azul con parpadeo blanco/azul los últimos 120 frames.
- Comer fantasma asustado: puntos en cadena 200/400/800/1600 (cadena por pellet, se reinicia con cada pellet nuevo). El fantasma pasa a fase `eyes` (`EYES_SPEED = 0.2`), vuelve a la pen por la puerta y revive saliendo de nuevo.
- Los power pellets cuentan para la victoria (se suman a `dotsRemaining`).

**Out of scope (para futuras specs):**

- Varios niveles y decaimiento del tiempo de asustado por nivel.
- Puntos flotantes sobre el fantasma comido.
- Sonido, fruta bonus, scatter/chase alternos.

## Data model

```js
// maze.js — nuevo char en MAZE_STR y parseTile
//   'o' -> 4 (power pellet). Colocado en (1,3), (26,3), (1,23), (26,23).

// game.js — constantes
const FRIGHT_FRAMES = 360; // 6 s de reloj efectivo
const FRIGHT_SPEED  = 0.07;
const EYES_SPEED    = 0.2;

// Estado de partida nuevo
{
  frightTimer: 0,   // frames restantes de modo asustado
  ghostChain: 0,    // fantasmas comidos con el pellet actual (0-4)
}

// Fantasma — fase extendida
{ phase: 'pen' | 'out' | 'eyes', frightened: false }
```

`dotsRemaining` pasa a contar tiles 2 **y** 4. `isWall` permite a la fase `eyes` cruzar la puerta (como `ghost-pen`).

## Implementation plan

1. `maze.js`: `parseTile` acepta `'o'` → 4 y se colocan los 4 pellets en las esquinas. Manual: la partida arranca sin errores.
2. `render.js`: dibujar tile 4 como círculo grande (radio ~7) parpadeante. Manual: se ven los 4 pellets.
3. `game.js`: comer pellet en `movePacman` (+50 puntos, `frightTimer = FRIGHT_FRAMES`, `ghostChain = 0`, asustar a los `out` con reversa inmediata) y decremento de `dotsRemaining`. Manual: pellets comibles, +50 en el HUD.
4. `game.js`: comportamiento asustado en `ghostTarget`/`moveGhost` (huida espejo + `FRIGHT_SPEED`) y temporizador que no corre con fantasmas en fase `pen`. Manual: los fantasmas huyen y se frenan.
5. `render.js`: fantasma asustado azul con parpadeo blanco/azul los últimos 120 frames. Manual: se ve el aviso de fin.
6. `game.js`: comer fantasma asustado — puntos `200 * 2^ghostChain`, fase `eyes` con autopiloto a la pen, revive con `phase: 'pen'` y `penTimer: 0` (sale asustado si queda temporizador). Manual: se come uno y vuelve.
7. Verificación final manual en navegador (checklist de abajo).

## Acceptance criteria

- [ ] Se ven 4 power pellets parpadeantes en (1,3), (26,3), (1,23) y (26,23).
- [ ] Comer un pellet da exactamente 50 puntos y asusta a los fantasmas fuera de la pen.
- [ ] Los fantasmas asustados dan media vuelta al activarse el modo y aumentan distancia con Pacman.
- [ ] Los fantasmas asustados son más lentos que Pacman (se les puede alcanzar).
- [ ] Comer 2 fantasmas con el mismo pellet da 200 y luego 400; con un pellet nuevo la cadena reinicia en 200.
- [ ] El fantasma comido se ve como ojos, entra por la puerta de la pen y revive saliendo de nuevo.
- [ ] Un fantasma que sale de la pen con temporizador activo sale asustado.
- [ ] El temporizador no avanza mientras haya fantasmas en fase `pen`.
- [ ] Un fantasma normal (no asustado) sigue matando a Pacman como antes.
- [ ] El nivel se gana solo tras comer todos los dots y los 4 pellets.
- [ ] Consola sin errores.

## Decisions

- **Sí:** 6 s con reloj pausado en la pen. Elegido por el usuario sobre duración fija.
- **Sí:** cadena 200/400/800/1600, reinicio por pellet. Fiel al arcade.
- **Sí:** ojos que vuelven a la pen y reviven. Fiel al arcade.
- **Sí:** esquinas clásicas del arcade. Cumplen "uno por lateral, arriba y abajo" y son simétricas.
- **Sí:** reversa inmediata al comer el pellet. Señal jugable clara.
- **No:** decaimiento por nivel. Solo existe 1 nivel.
- **No:** puntos flotantes ni congelación de frame al comer fantasma. Detalles cosméticos para otra spec.

## Risks

| Riesgo                                                         | Mitigación                                                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| La fase `eyes` puede romper colisiones o el conteo de victoria | `eyes` no colisiona con Pacman y solo usa la puerta como `ghost-pen`; se verifica en el checklist |
| Fantasmas asustados atrapados en callejones sin huida posible  | `decideGhost` ya acepta la reversa 180 como fallback                                              |

## What is **not** in this spec

- Multi-nivel, puntos flotantes, sonido, fruta bonus. Cada uno, si aterriza, en su propia spec.
