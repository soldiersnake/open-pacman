// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

const FRIGHT_FRAMES = 360;  // 6 s de reloj efectivo de modo asustado
const FRIGHT_SPEED  = 0.07; // fantasma asustado, mas lento que Pacman
const EYES_SPEED    = 0.2;  // ojos volviendo a la pen

const PEN_EXIT_ROW = 11;      // fila a la que se llega tras cruzar la puerta
const PEN_EXIT_DELAY = 180;   // frames (3 s) entre salidas de la pen
const CLYDE_CORNER = { x: 1, y: 29 };  // esquina inferior izquierda
const CLYDE_SHY_DIST = 8;     // a esta distancia o menos, Clyde huye

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 || v === 4 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    grid,
    frightTimer: 0, // frames restantes de modo asustado
    ghostChain: 0,  // fantasmas comidos con el pellet actual (0-4)
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g, i ) => ( {
      name: g.name,
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      phase: 'pen',
      penTimer: i * PEN_EXIT_DELAY,
      frightened: false,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman y ghost-out: bloqueado por pared (1) y puerta (3).
//   La puerta la cruza el autopiloto de la pen y los ojos (eyes).
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor !== 'ghost-pen' && actor !== 'eyes' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

// Distancia positiva hasta el siguiente centro de celda avanzando en el signo
// dado desde la coordenada a. Toma cualquier velocidad del actor.
function distToNextCenter( a, sign ) {
  if ( sign > 0 ) return Math.floor( a + 1e-9 ) + 1 - a;
  return a - ( Math.ceil( a - 1e-9 ) - 1 );
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Logica al llegar a un centro de celda: giro pendiente, comer y si no
  // puede seguir, se detiene (devuelve false).
  const atCenter = () => {
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot (2) o power pellet (4).
    const tile = grid[ p.y ][ p.x ];
    if ( tile === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    } else if ( tile === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 50;
      game.dotsRemaining--;
      // Asustar a los fantasmas fuera de la pen, con reversa inmediata.
      game.frightTimer = FRIGHT_FRAMES;
      game.ghostChain = 0;
      game.ghosts.forEach( ( g ) => {
        if ( g.phase !== 'out' ) return;
        g.frightened = true;
        g.dir = OPPOSITE[ g.dir ];
      } );
    }
    return canMove( grid, p.x, p.y, p.dir, 'pacman' );
  };

  let dist = p.speed;
  // Si arranca alineado a un centro, procesar esa celda primero.
  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );
    if ( !atCenter() ) return;
  }
  // Avanzar decidiendo en CADA centro cruzado, indep. de caer exacto en
  // centros: soporta velocidades que no dividen a 1 (ej. FRIGHT_SPEED).
  while ( dist > 1e-9 ) {
    const d = DIRS[ p.dir ];
    const axis = d.x !== 0 ? 'x' : 'y';
    const sign = d.x !== 0 ? d.x : d.y;
    const step = Math.min( dist, distToNextCenter( p[ axis ], sign ) );
    p[ axis ] += sign * step;
    dist -= step;
    wrapTunnel( p, width );
    if ( aligned( p[ axis ] ) && aligned( p[ axis === 'x' ? 'y' : 'x' ] ) ) {
      p[ axis ] = Math.round( p[ axis ] );
      if ( !atCenter() ) return;
    }
  }
}

// Celda objetivo segun la personalidad de cada fantasma (clasico arcade).
function ghostTarget( game, g ) {
  const grid = game.grid;
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const d = DIRS[ p.dir ];

  // Ojos: autopiloto a la puerta de la pen.
  if ( g.phase === 'eyes' ) return { x: 13, y: 14 };
  // Asustado: huye a la celda espejo de Pacman.
  if ( g.frightened ) return { x: 27 - px, y: 30 - py };

  if ( g.name === 'blinky' ) return { x: px, y: py };
  if ( g.name === 'pinky' ) return { x: px + d.x * 4, y: py + d.y * 4 };
  if ( g.name === 'inky' ) {
    // Reflejo de blinky sobre el punto 2 celdas delante de Pacman.
    const blinky = game.ghosts.find( ( o ) => o.name === 'blinky' );
    const ax = px + d.x * 2;
    const ay = py + d.y * 2;
    const bx = blinky ? Math.round( blinky.x ) : ax;
    const by = blinky ? Math.round( blinky.y ) : ay;
    return { x: ax * 2 - bx, y: ay * 2 - by };
  }
  // clyde: persigue de lejos, se retira a su esquina de cerca.
  const dist = Math.abs( px - g.x ) + Math.abs( py - g.y );
  if ( dist > CLYDE_SHY_DIST ) return { x: px, y: py };
  return CLYDE_CORNER;
}

function decideGhost( game, g, actor ) {
  const grid = game.grid;
  const target = ghostTarget( game, g );

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, actor )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ OPPOSITE[ g.dir ] ];

  // Eleccion greedy: minimiza distancia Manhattan al objetivo.
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const dist = Math.abs( g.x + d.x - target.x ) + Math.abs( g.y + d.y - target.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

// Fase 'pen': espera su turno y luego autopiloto hasta salir por la puerta.
function moveGhostPen( game, g ) {
  if ( g.penTimer > 0 ) {
    g.penTimer--;
    return;
  }
  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( g.y <= PEN_EXIT_ROW ) {
      g.phase = 'out';
      // Sale asustado si el temporizador de asustado sigue activo.
      g.frightened = game.frightTimer > 0;
      return;
    }
    // Centrarse en la columna de la puerta (13 o 14) y luego subir.
    const doorCol = g.x <= 13 ? 13 : 14;
    if ( g.x !== doorCol ) g.dir = g.x < doorCol ? 'right' : 'left';
    else g.dir = 'up';
  }
  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
}

// BFS corto: primera direccion del camino mas corto de (x,y) a (tx,ty).
// Usado por los ojos, que deben llegar a la pen sin perderse en bucles greedy.
function nextStepBFS( grid, x, y, tx, ty, actor ) {
  const W = grid[ 0 ].length;
  const key = ( a, b ) => b * W + a;
  const start = key( x, y );
  const goal = key( tx, ty );
  if ( start === goal ) return null;
  const prev = new Map( [ [ start, start ] ] );
  const queue = [ start ];
  // BFS puede hacer pop infinito con el tunel: pasar del goal corta la busqueda
  // y las celdas fuera del mapa son muro para isWall, asi que acota por si solo.
  while ( queue.length ) {
    const cur = queue.shift();
    if ( cur === goal ) break;
    const cx = cur % W;
    const cy = Math.floor( cur / W );
    for ( const d of Object.values( DIRS ) ) {
      const nx = cx + d.x;
      const ny = cy + d.y;
      if ( isWall( grid, nx, ny, actor ) ) continue;
      const k = key( nx, ny );
      if ( prev.has( k ) ) continue;
      prev.set( k, cur );
      queue.push( k );
    }
  }
  if ( !prev.has( goal ) ) return null;
  let cur = goal;
  while ( prev.get( cur ) !== start ) cur = prev.get( cur );
  const nx = cur % W;
  const ny = Math.floor( cur / W );
  for ( const [ name, d ] of Object.entries( DIRS ) ) {
    if ( x + d.x === nx && y + d.y === ny ) return name;
  }
  return null;
}

// Fase 'eyes': ojos volviendo a la pen. Autopiloto (BFS) a la puerta y revive.
function moveGhostEyes( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  // Al llegar a un centro: revivir si esta en la pen, o seguir el BFS.
  const atCenter = () => {
    if ( ( g.x === 13 || g.x === 14 ) && g.y >= 13 && g.y <= 15 ) {
      g.phase = 'pen';
      g.penTimer = 0;
      g.frightened = false;
      return 'revive';
    }
    const step = nextStepBFS( grid, g.x, g.y, 13, 14, 'eyes' );
    if ( step ) g.dir = step;
    return canMove( grid, g.x, g.y, g.dir, 'eyes' );
  };

  let dist = EYES_SPEED;
  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( atCenter() !== true ) return;
  }
  // Avanzar decidiendo en cada centro cruzado (toma cualquier velocidad).
  while ( dist > 1e-9 ) {
    const d = DIRS[ g.dir ];
    const axis = d.x !== 0 ? 'x' : 'y';
    const sign = d.x !== 0 ? d.x : d.y;
    const step = Math.min( dist, distToNextCenter( g[ axis ], sign ) );
    g[ axis ] += sign * step;
    dist -= step;
    wrapTunnel( g, width );
    if ( aligned( g[ axis ] ) && aligned( g[ axis === 'x' ? 'y' : 'x' ] ) ) {
      g[ axis ] = Math.round( g[ axis ] );
      if ( atCenter() !== true ) return;
    }
  }
}

function moveGhost( game, g ) {
  if ( g.phase === 'pen' ) {
    moveGhostPen( game, g );
    return;
  }
  if ( g.phase === 'eyes' ) {
    moveGhostEyes( game, g );
    return;
  }

  const grid = game.grid;
  const width = grid[ 0 ].length;

  const speed = g.frightened ? FRIGHT_SPEED : g.speed;

  // Al llegar a un centro: elegir direccion y comprobar que es posible.
  const atCenter = () => {
    decideGhost( game, g, 'ghost-out' );
    return canMove( grid, g.x, g.y, g.dir, 'ghost-out' );
  };

  let dist = speed;
  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    if ( !atCenter() ) return;
  }
  // Avanzar decidiendo en CADA centro cruzado: soporta velocidades que no
  // dividen a 1 (ej. FRIGHT_SPEED = 0.07) sin atravesar paredes ni salirse.
  while ( dist > 1e-9 ) {
    const d = DIRS[ g.dir ];
    const axis = d.x !== 0 ? 'x' : 'y';
    const sign = d.x !== 0 ? d.x : d.y;
    const step = Math.min( dist, distToNextCenter( g[ axis ], sign ) );
    g[ axis ] += sign * step;
    dist -= step;
    wrapTunnel( g, width );
    if ( aligned( g[ axis ] ) && aligned( g[ axis === 'x' ? 'y' : 'x' ] ) ) {
      g[ axis ] = Math.round( g[ axis ] );
      if ( !atCenter() ) return;
    }
  }
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    g.x = GHOST_STARTS[ i ].x;
    g.y = GHOST_STARTS[ i ].y;
    g.dir = 'up';
    g.phase = 'pen';
    g.penTimer = i * PEN_EXIT_DELAY;
    g.frightened = false;
  } );
  // Al morir Pacman se desactiva el modo asustado.
  game.frightTimer = 0;
  game.ghostChain = 0;
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  // Reloj de modo asustado: se pausa mientras haya fantasmas en la pen.
  if ( game.frightTimer > 0 ) {
    const anyPen = game.ghosts.some( ( g ) => g.phase === 'pen' );
    if ( !anyPen ) game.frightTimer--;
    if ( game.frightTimer === 0 ) {
      game.ghosts.forEach( ( g ) => { g.frightened = false; } );
      game.ghostChain = 0;
    }
  }

  for ( const g of game.ghosts ) {
    if ( !collides( game.pacman, g ) ) continue;
    if ( g.phase === 'eyes' ) continue;
    if ( g.frightened ) {
      // Comer fantasma asustado: puntos en cadena 200/400/800/1600.
      game.score += 200 * Math.pow( 2, game.ghostChain );
      game.ghostChain = Math.min( game.ghostChain + 1, 3 );
      g.phase = 'eyes';
      g.frightened = false;
      continue;
    }
    game.lives--;
    if ( game.lives <= 0 ) {
      game.state = 'lost';
      return;
    }
    resetPositions( game );
    break;
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
