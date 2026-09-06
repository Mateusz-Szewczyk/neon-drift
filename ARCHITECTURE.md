# NEON DRIFT — Technical Architecture

This document is the implementation blueprint for NEON DRIFT, derived from
`GAME_SPEC.md`. It is authoritative for structure, data shapes, math, and
system design. Follow it directly when writing code.

---

## 1. File / Module Layout

**Decision: single `game.js` file, ES5/ES2020-flavored vanilla JS, NOT split
into `src/*.js` ES modules.**

### Layout

```
neon-drift/
  index.html       # markup, canvas element, meta tags, font link, favicon
  style.css        # full-viewport layout, HUD overlay DOM styling, screens
  game.js          # entire game: state machine, entities, loop, rendering
  README.md
  .gitignore
```

### Justification (simplicity vs. maintainability)

Weighed splitting into `<script type="module" src="./src/main.js">` with
`src/{state.js, entities.js, spawner.js, render.js, input.js, math.js}`
against a single file. Arguments for splitting: better separation of
concerns, easier to navigate in a larger codebase, unit-testable modules.
Arguments against, which win here:

- **Deploy simplicity is a hard requirement.** The spec explicitly wants
  "static detection" on Vercel with zero config and a single `game.js`
  reference is the path of least surprise (no MIME-type issues with
  `type="module"` on odd static hosts, no relative-import path bugs, no
  CORS-on-`file://` restriction — ES modules refuse to load via
  `file://` in most browsers, which breaks the spec's "just open
  index.html" local-run path entirely). A single classic `<script>` tag
  works with `file://` out of the box, which matters because the spec's
  Definition-of-Done explicitly allows "just opening index.html".
- **Project size doesn't justify the overhead.** This is a single-screen
  arcade game with one core loop, ~5 entity types, and no reusable library
  surface. Total code is expected to land around 800–1400 lines — well
  within "one file is fine" territory. Splitting this size of project adds
  navigation overhead (jumping between files) without a real payoff.
- **No build step means no bundling benefit.** Module splitting only pays
  off with tooling (bundler, tree-shaking) or a large team. Here every
  extra file is an extra network request in production (no HTTP/2 push
  guarantee on all static hosts) and an extra thing that can have a typo'd
  relative path.
- **Internal organization still matters**, so instead of file-splitting we
  use **section-splitting within `game.js`** via clearly banner-commented
  regions, top-to-bottom, in dependency order:

  ```js
  // === 1. CONSTANTS & CONFIG ===========================================
  // === 2. UTILITY / MATH HELPERS =======================================
  // === 3. STATE MACHINE =================================================
  // === 4. ENTITY FACTORIES & POOLS ======================================
  // === 5. INPUT HANDLING =================================================
  // === 6. SPAWN SYSTEM ===================================================
  // === 7. UPDATE (per-entity simulation step) ============================
  // === 8. COLLISION DETECTION ============================================
  // === 9. RENDERING (background, road, entities, HUD, particles) ========
  // === 10. GAME LOOP (rAF, delta-time) ===================================
  // === 11. PERSISTENCE (localStorage) =====================================
  // === 12. BOOTSTRAP =====================================================
  ```

  Each region is a set of top-level `function`s/`const` objects — no
  classes required (see §3 data structures — plain object literals + pool
  arrays are enough and avoid `this`-binding foot-guns in callback-heavy
  code). This gives 90% of the navigability of file-splitting with 0% of
  the deployment/CORS risk.
- **If the project later grows** (e.g. adding levels, a level editor, or a
  build step for minification), the section banners are exactly the seams
  along which to extract `src/*.js` files later — this structure doesn't
  paint us into a corner, it defers the cost until it's actually earned.

`index.html` stays a thin shell: canvas, HUD DOM overlay (score/combo/best
score/buttons are real DOM elements positioned via CSS over the canvas —
cheaper and crisper for text than drawing HUD text on canvas every frame,
and DOM naturally handles the button tap targets/accessibility), meta tags,
Google Fonts link, and `<script src="./game.js" defer></script>` (classic
script, not module).

---

## 2. Game State Machine

### States

```
BOOT → START_SCREEN → PLAYING ⇄ PAUSED
                          ↓
                      GAME_OVER → (restart) → PLAYING
                          ↑___________________|
        START_SCREEN ← (via "menu"/back, optional) 
```

Represented as a single string constant, not an enum object graph (keep it
simple):

```js
const GameState = Object.freeze({
  BOOT: 'BOOT',
  START_SCREEN: 'START_SCREEN',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAME_OVER: 'GAME_OVER',
});

let currentState = GameState.BOOT;
```

### Transition table

| From | Event | To | Side effects |
|---|---|---|---|
| BOOT | assets/fonts ready (or immediately, no real assets to load) | START_SCREEN | read `localStorage` best score into `bestScore`; size canvas |
| START_SCREEN | tap/click/key anywhere on canvas or start button | PLAYING | `resetRun()` (see below); start spawn timers; record `lastFrameTime = performance.now()` |
| PLAYING | `visibilitychange` → `document.hidden === true` | PAUSED | store `pausedAt = performance.now()`; stop calling update logic (rAF keeps ticking but update is skipped) |
| PAUSED | `visibilitychange` → `document.hidden === false` | PLAYING | compute `pauseDuration`, shift all internal "start time" references forward so ramp/spawn timers don't jump; reset `lastFrameTime = performance.now()` to avoid one huge delta |
| PLAYING | player-orb collides with obstacle AND no shield | GAME_OVER | trigger screen shake + red flash + particle burst; freeze-frame ~300ms (short timeout/state flag) before showing Game Over screen; write `bestScore` to `localStorage` if beaten; stop spawn timers |
| GAME_OVER | tap "Restart" | PLAYING | `resetRun()` then start immediately (no intermediate START_SCREEN hop, per spec: "resets all state instantly back into a fresh run without a page reload") |
| GAME_OVER | tap "Menu"/back (optional, not required by spec but cheap to add) | START_SCREEN | `resetRun()` without immediately starting |

Boot never repeats. PAUSED is only reachable from PLAYING via visibility
change (no explicit pause button in spec — keep scope tight). The renderer
still draws every rAF tick regardless of state (so PAUSED shows a frozen
frame, START_SCREEN shows its own screen, etc.) — only the *simulation
update* is gated by state.

### `resetRun()` — what resets on (re)start

Every one of these is reset to its initial value; nothing carries over
between runs except `bestScore` (persisted) and canvas geometry (recomputed
independently on resize, not on run reset):

- `player` object reset to center lane (`laneIndex = 1`), `x` snapped to
  that lane's resting x, `tiltAngle = 0`, `shieldActive = false`,
  `invulnerableUntil = 0`.
- `score = 0`, `combo = 0`, `distanceTraveled = 0`.
- `elapsedTime = 0` (drives difficulty ramp — restart from 0, not from
  where the last run ended).
- `scrollSpeed = BASE_SPEED`.
- `activePowerUp = null`, `powerUpEndsAt = 0`.
- All entity pools cleared: obstacles, shards, particles, power-up
  pickups — every pooled object's `active` flag set to `false` (pool
  arrays themselves are NOT reallocated, see §8 performance).
- Spawn system: `nextSpawnAt = 0` (spawn immediately-ish on run start,
  with a short initial grace delay e.g. 1.2s so the player isn't hit in
  the first second), `spawnInterval = BASE_SPAWN_INTERVAL`.
- Screen effects: `shakeMagnitude = 0`, `flashAlpha = 0`, `slowMoFactor = 1`.
- `gameOverFreezeUntil = 0`.

---

## 3. Core Data Structures

Plain object literals created by factory functions, not ES `class`. Reason:
these are simulation records mutated every frame in tight loops — plain
objects with monomorphic shape (always create with every field present,
even if `null`/`0`) keep V8's hidden-class optimization happy and avoid
`class` boilerplate for objects with no real behavior beyond data + a
handful of free functions that operate on them.

### Lane geometry constant (shared by many structures)

```js
const LANE_COUNT = 3;              // 0 = left, 1 = center, 2 = right
```

### Player

```js
function createPlayer() {
  return {
    laneIndex: 1,          // 0..2, current target lane
    x: 0,                  // current screen x (eased toward lane target x)
    y: 0,                  // fixed screen y near bottom (recomputed on resize)
    targetX: 0,            // resting x of laneIndex, recomputed on resize/lane change
    tiltAngle: 0,           // radians, visual lean during lane change
    radius: 16,             // base glow-orb radius in CSS px (scaled by DPR at draw time)
    pulsePhase: 0,          // radians, advances every frame for idle pulse animation
    shieldActive: false,
    invulnerableUntil: 0,   // performance.now() timestamp; collisions ignored until then
    trail: [],              // ring buffer of {x, y, alpha} for fading trail particles
  };
}
```

### Obstacle

```js
function createObstacle() {
  return {
    active: false,          // pool liveness flag
    lane: 0,                 // 0..2
    z: 1.0,                  // depth: 1.0 = far spawn plane, 0.0 = at player plane
    kind: 'wall',            // 'wall' | 'triangle' | ... (visual variant)
    colorIndex: 0,           // picks accent color per lane for contrast
    hit: false,               // set true the frame it registers a collision (avoid double-trigger)
  };
}
```

### Shard (collectible)

```js
function createShard() {
  return {
    active: false,
    lane: 0,
    z: 1.0,
    rotation: 0,             // radians, spins for visual flair
    magnetized: false,       // true while Magnet power-up pulls it toward player lane
    magnetLaneBlend: 0,      // 0..1, interpolates visual x from spawn lane toward player lane
    collected: false,
  };
}
```

### Power-up pickup (world entity, distinct from the "currently held/active" state)

```js
function createPowerUp() {
  return {
    active: false,
    lane: 0,
    z: 1.0,
    type: 'shield',          // 'shield' | 'magnet' | 'slowmo'
    rotation: 0,
  };
}
```

Currently-active power-up (single slot, per spec "only one held at a
time, auto-apply on pickup"):

```js
let activePowerUp = null;    // 'shield' | 'magnet' | 'slowmo' | null
let powerUpEndsAt = 0;       // performance.now() timestamp; shield ignores this (consumed on hit, not timed)
```

### Particle (shared pool for collision bursts, sparkle, trail, combo pop text)

```js
function createParticle() {
  return {
    active: false,
    x: 0, y: 0,
    vx: 0, vy: 0,
    life: 0,                 // seconds remaining
    maxLife: 0,               // seconds, for alpha = life/maxLife fade
    size: 2,
    color: '#ffffff',
    kind: 'spark',            // 'spark' | 'star' | 'comboText'
    text: '',                 // used when kind === 'comboText'
  };
}
```

### Pools

```js
const obstaclePool = Array.from({ length: 24 }, createObstacle);
const shardPool     = Array.from({ length: 40 }, createShard);
const powerUpPool   = Array.from({ length: 6 },  createPowerUp);
const particlePool  = Array.from({ length: 200 }, createParticle);
```

Sizes are generous upper bounds derived from max on-screen density at max
speed (see §8); pools never grow at runtime.

---

## 4. Game Loop & Perspective Math

### Loop skeleton

```js
let lastFrameTime = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (lastFrameTime === 0) lastFrameTime = now;
  let dt = (now - lastFrameTime) / 1000; // seconds
  lastFrameTime = now;
  dt = Math.min(dt, 1 / 15);             // clamp to avoid spiral-of-death on tab-resume/lag spikes

  if (currentState === GameState.PLAYING) {
    update(dt, now);
  }
  render(now); // always render, every state, for a responsive frozen/menu frame
}
requestAnimationFrame(frame);
```

`dt` clamping (max ~66ms, i.e. floor 15fps equivalent step) is essential:
without it, the tab-visibility resume transition (§7) or any long GC pause
would otherwise feed a multi-second `dt` into position updates and teleport
every entity, or worse, skip collision windows.

### Coordinate model

- All simulation math happens in **CSS pixels** (logical viewport size),
  not device pixels. DPR scaling is applied once via canvas transform
  (§8), so game logic never has to think about DPR.
- `canvasWidth`, `canvasHeight` = `window.innerWidth`, `window.innerHeight`
  (or the canvas's CSS-computed size), recomputed on `resize`.
- The road/track only occupies a portion of screen width — define a road
  half-width in CSS px so lanes don't stretch edge-to-edge on wide
  viewports: `roadHalfWidthNear = min(canvasWidth * 0.42, 260)` (near/bottom
  edge of the road) — tune constant, but keep the "near" formula in code as
  a single named constant so it's tunable in one place.

### Vanishing point & horizon

```js
const HORIZON_Y_RATIO = 0.42;       // horizon line at 42% down the screen
let horizonY = canvasHeight * HORIZON_Y_RATIO;
let vanishX  = canvasWidth / 2;      // vanishing point x = screen center
let vanishY  = horizonY;             // vanishing point y = horizon line
```

Recomputed every `resize`.

### z-depth → screen-y and scale mapping

Every scrolling entity (obstacle/shard/power-up) has a normalized depth
`z ∈ [0, 1]`: `z = 1` is the far spawn plane (just below the horizon,
tiny), `z = 0` is the near/player plane (bottom of screen, full scale).
Depth decreases every frame as the entity approaches:

```js
z -= scrollSpeed * dt * Z_SPEED_SCALE;   // Z_SPEED_SCALE converts world-speed units into z/second
```

Entity removed (returned to pool) once `z < -0.05` (a little past the
player plane, so it visibly passes under/past before disappearing).

To sell perspective, do NOT lerp `z` linearly into screen-y — use an
**easing curve so far things bunch up near the horizon and near things
move fast**, matching real perspective (objects at constant world-speed
appear to accelerate as they approach camera). Use inverse-distance
projection, the standard pseudo-3D "outrun" formula:

```js
// perspective depth factor: maps z (1=far, 0=near) to a projective scale.
// Using a simple camera-distance model: screen scale ~ 1 / distance.
// distance(z) interpolates from FAR_DISTANCE (z=1) to NEAR_DISTANCE (z=0).
const FAR_DISTANCE  = 30;   // arbitrary world-units, far clip
const NEAR_DISTANCE = 1;    // world-units at player plane

function depthToDistance(z) {
  return NEAR_DISTANCE + z * (FAR_DISTANCE - NEAR_DISTANCE);
}

function projectScale(z) {
  const distance = depthToDistance(z);
  // Scale relative to the near plane's own distance, so scale(z=0) === 1.
  return NEAR_DISTANCE / distance;
}

function projectScreenY(z) {
  const scale = projectScale(z);
  // screen-y interpolates from horizonY (scale→0 far away) to canvasHeight (scale=1, near)
  // using the same inverse relationship so y-motion visually matches scale growth.
  return horizonY + (canvasHeight - horizonY) * scale;
}
```

This gives the characteristic outrun feel: an obstacle spawned at `z=1`
sits right at the horizon (tiny, `scale ≈ NEAR_DISTANCE/FAR_DISTANCE ≈
0.033`), and as `z` approaches `0` both scale and screen-y accelerate
toward their max — exactly the "grows slowly then rushes past" look
described in the spec's visual style.

### Lane x-position as a function of screen width AND depth

Lanes must also converge toward `vanishX` at the horizon (so the road
narrows into the vanishing point) and spread to their full width at the
near plane. Define lane offsets as fractions of the *near-plane* road
half-width, then scale that offset by the same `projectScale(z)` used for
depth, and blend the origin from `vanishX` (far) to true lane x (near):

```js
// laneIndex 0,1,2 -> offset -1, 0, +1 lane-units from center
function laneOffsetUnits(laneIndex) {
  return laneIndex - (LANE_COUNT - 1) / 2;  // -1, 0, +1 for 3 lanes
}

// Full-scale (near plane, z=0) x position of a lane, ignoring depth:
function laneNearX(laneIndex) {
  const laneWidth = (roadHalfWidthNear * 2) / LANE_COUNT;
  return canvasWidth / 2 + laneOffsetUnits(laneIndex) * laneWidth;
}

// Perspective-corrected x for an entity at given lane + depth z:
function projectLaneX(laneIndex, z) {
  const scale = projectScale(z);          // 0..1, 1 = near plane
  const nearX = laneNearX(laneIndex);
  // Interpolate from vanishX (at scale=0 i.e. far) to nearX (at scale=1 i.e. near)
  return vanishX + (nearX - vanishX) * scale;
}
```

This single function (`projectLaneX`) is used both for spawning obstacles
at their lane and for drawing lane-divider grid lines (draw each divider
as a sequence of short segments at increasing `z` from `0` to `1`,
connecting `projectLaneX(laneEdge, z), projectScreenY(z)` points — this
naturally produces the converging-lines road grid described in the spec).

### Player's own screen x (lane switching, not depth-scrolling)

The player doesn't move in z (always at the near plane, `z ≈ 0`), it only
changes `laneIndex`. On lane-change input, set `player.targetX =
laneNearX(newLaneIndex)` and ease current `player.x` toward it every frame
(critically-damped lerp, not instant snap, so it reads as a "drift"):

```js
const LANE_CHANGE_EASE = 10; // higher = snappier
player.x += (player.targetX - player.x) * Math.min(1, LANE_CHANGE_EASE * dt);
player.tiltAngle = clamp((player.targetX - player.x) * -0.02, -0.35, 0.35);
```

`player.y` is fixed at a constant screen-space position near the bottom,
e.g. `player.y = canvasHeight * 0.86` (recomputed on resize).

### Road grid scroll (visual only, no z on the grid itself)

Horizontal "rung" lines crossing the road (the classic outrun scanline
floor) are drawn at a set of z-values that continuously animate:
`gridZOffsets[i] = (baseOffsetI + elapsedScrollDistance) % 1` for a fixed
number of rungs (e.g. 10), each rendered via `projectScreenY(z)` — this
reuses the exact same projection function as entities, guaranteeing visual
consistency between the road and the obstacles moving on it.

---

## 5. Collision Detection

**Not pixel-perfect.** Uses lane index equality + a z-depth "hit window"
band near the player's plane — cheap, deterministic, and forgiving in a
way that matches player expectations for an arcade game (near-miss visuals
can slightly overlap without being unfair).

```js
const HIT_WINDOW_NEAR = -0.02;  // z slightly past the player plane
const HIT_WINDOW_FAR  =  0.10;  // z slightly before the player plane

function checkCollisions(now) {
  if (now < player.invulnerableUntil) return;

  for (const obstacle of obstaclePool) {
    if (!obstacle.active || obstacle.hit) continue;
    if (obstacle.lane !== player.laneIndex) continue;
    if (obstacle.z < HIT_WINDOW_NEAR || obstacle.z > HIT_WINDOW_FAR) continue;

    obstacle.hit = true;
    handleObstacleHit(obstacle, now);
    break; // one collision per frame is enough
  }

  for (const shard of shardPool) {
    if (!shard.active || shard.collected) continue;
    if (shard.lane !== player.laneIndex) continue;
    if (shard.z < HIT_WINDOW_NEAR || shard.z > HIT_WINDOW_FAR) continue;
    shard.collected = true;
    handleShardPickup(shard);
  }

  for (const powerUp of powerUpPool) {
    if (!powerUp.active) continue;
    if (powerUp.lane !== player.laneIndex) continue;
    if (powerUp.z < HIT_WINDOW_NEAR || powerUp.z > HIT_WINDOW_FAR) continue;
    activatePowerUp(powerUp.type, now);
    powerUp.active = false;
  }
}
```

`handleObstacleHit`:

```js
function handleObstacleHit(obstacle, now) {
  if (player.shieldActive) {
    player.shieldActive = false;
    activePowerUp = null;
    player.invulnerableUntil = now + 800; // brief invuln flash so it can't double-hit next obstacle instantly
    obstacle.active = false; // "destroyed"
    spawnBurstParticles(player.x, player.y, '#00f0ff', 18);
    combo = 0; // still a near-miss-adjacent event visually, but spec says combo resets only on unshielded collision (see below)
    return;
  }
  triggerGameOver(now);
}
```

Note on combo: per spec, "combo only resets on collision" — a shielded hit
IS a collision event even though it isn't fatal, so resetting combo there
is a defensible reading; if product wants shield hits to preserve combo,
flip that one line — call this out as a single, isolated tunable.

Why lane+window instead of pixel/AABB: entities are perspective-scaled and
their true canvas-space bounding boxes change every frame; comparing
lane index (an integer, already the source of truth for gameplay position)
plus a z-band around the player plane is O(1) per entity, has zero
per-frame allocation, and naturally scales its "forgiveness" window
correctly across all screen sizes since it's expressed in the same
normalized z-space as everything else — no separate tuning needed per
device/resolution.

---

## 6. Spawn Pattern System

Data-driven pattern library. Each pattern is a fixed-shape descriptor of
what occupies each of the 3 lanes at one spawn "row" (a single z=1 spawn
event). **Every pattern in the library is hand-authored to guarantee at
least one lane is `null`/open** — this is enforced both by construction
(hand-checked list) AND by a runtime assertion in dev mode, not just by
convention, so a future bad edit is caught immediately.

```js
// Each entry: array of length LANE_COUNT.
// null = open lane. 'obstacle' | 'shard' | 'powerup' fills that lane's cell.
const SPAWN_PATTERNS = [
  ['obstacle', null,       null      ],
  [null,       'obstacle', null      ],
  [null,       null,       'obstacle'],
  ['obstacle', null,       'obstacle'], // pinch, center lane always open
  ['shard',    'shard',    'shard'   ], // all-clear reward row
  ['obstacle', 'shard',    null      ],
  [null,       'shard',    'obstacle'],
  ['obstacle', null,       'shard'   ],
  ['shard',    null,       'obstacle'],
  [null,       null,       null      ], // breather row (nothing spawns, just empty tick)
];

function assertPatternsAreFair() {
  for (const pattern of SPAWN_PATTERNS) {
    const openLanes = pattern.filter((cell) => cell !== 'obstacle').length;
    if (openLanes < 1) {
      throw new Error('Unfair spawn pattern: no open lane — ' + JSON.stringify(pattern));
    }
  }
}
```

Power-ups are NOT part of the per-row pattern table (they're rare, ~1 per
8–14s per spec) — they're spawned via a separate independent timer that,
when it fires, overrides one randomly chosen open (non-`'obstacle'`) lane
of the *next* spawn row with a power-up, so they never conflict with the
fairness guarantee (they only ever replace a shard or empty cell, never an
obstacle cell).

### Spawn tick logic

```js
let nextSpawnAt = 0;

function updateSpawning(now, elapsedTime) {
  if (now < nextSpawnAt) return;

  const pattern = SPAWN_PATTERNS[Math.floor(Math.random() * SPAWN_PATTERNS.length)];
  for (let lane = 0; lane < LANE_COUNT; lane++) {
    const cell = pattern[lane];
    if (cell === 'obstacle') spawnObstacle(lane);
    else if (cell === 'shard') spawnShard(lane);
  }

  maybeSpawnPowerUp(pattern, now);

  const spawnInterval = computeSpawnInterval(elapsedTime);
  nextSpawnAt = now + spawnInterval;
}

function computeSpawnInterval(elapsedTime) {
  const t = Math.min(elapsedTime, DIFFICULTY_RAMP_CAP_SECONDS);
  return lerp(BASE_SPAWN_INTERVAL, MIN_SPAWN_INTERVAL, t / DIFFICULTY_RAMP_CAP_SECONDS);
}
```

`spawnObstacle(lane)` / `spawnShard(lane)` pull the first inactive entry
from the relevant pool (linear scan — pools are small, see §8), set
`z = 1.0`, `lane`, and any per-kind visual randomization
(`colorIndex`, `kind` for obstacles; nothing extra for shards beyond
`rotation = 0`).

### Difficulty ramp (speed)

Exactly per spec formula, implemented as:

```js
const BASE_SPEED = 220;              // world-units/sec at t=0
const SPEED_RAMP_FACTOR = 6;         // units/sec gained per second survived
const MAX_SPEED = 620;               // cap

function updateDifficulty(elapsedTime) {
  scrollSpeed = Math.min(MAX_SPEED, BASE_SPEED + elapsedTime * SPEED_RAMP_FACTOR);
}
```

Slow-Mo power-up multiplies the *effective* speed used for z-decrement and
visual scroll (not the stored `scrollSpeed`, so the ramp calculation stays
independent of temporary effects):

```js
const effectiveSpeed = scrollSpeed * (activePowerUp === 'slowmo' ? 0.6 : 1);
```

---

## 7. Persistence & Visibility Handling

### Best score (`localStorage`)

```js
const BEST_SCORE_KEY = 'neonDriftBestScore';

function loadBestScore() {
  const raw = localStorage.getItem(BEST_SCORE_KEY);
  const parsed = raw ? parseInt(raw, 10) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

function saveBestScoreIfBeaten(finalScore) {
  if (finalScore > bestScore) {
    bestScore = finalScore;
    try {
      localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
    } catch (e) {
      // localStorage may be unavailable (private mode / quota) — fail silently,
      // best score just won't persist across sessions; never let this crash the game.
    }
  }
}
```

Wrap `localStorage` reads similarly in try/catch at boot (Safari private
mode and some embedded webviews can throw on access, not just on write).
`isNewBest` flag for the "NEW BEST!" badge is computed once at the moment
of transition into `GAME_OVER` (compare `finalScore > bestScoreBeforeThisRun`,
captured before calling `saveBestScoreIfBeaten`, so the comparison isn't
against the just-updated value).

### `visibilitychange` pause

```js
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (currentState === GameState.PLAYING) {
      currentState = GameState.PAUSED;
      pausedAt = performance.now();
    }
  } else {
    if (currentState === GameState.PAUSED) {
      const now = performance.now();
      const pauseDuration = now - pausedAt;
      // Shift all now()-based timestamps forward by pauseDuration so nothing
      // "fires immediately" or thinks a huge amount of time passed:
      nextSpawnAt += pauseDuration;
      powerUpEndsAt += pauseDuration;
      player.invulnerableUntil += pauseDuration;
      gameOverFreezeUntil += pauseDuration;
      lastFrameTime = now; // prevent one giant dt on resume
      currentState = GameState.PLAYING;
    }
  }
});
```

Key subtlety: `elapsedTime` (used for difficulty ramp) is accumulated as
`elapsedTime += dt` inside `update()`, and since `update()` is skipped
entirely while `currentState !== PLAYING`, it automatically does not
advance during the pause — no separate correction needed for it. Only the
absolute-timestamp-based fields (`nextSpawnAt`, timers compared against
`performance.now()`) need the explicit shift shown above.

The rAF loop itself is never cancelled/restarted for pause — it keeps
calling `render()` every frame (cheap, and lets the frozen game frame stay
visibly correct/composited, e.g. behind an OS task-switcher thumbnail)
but skips `update()`/`checkCollisions()` while not `PLAYING`.

---

## 8. Performance Approach

### Object pooling / zero per-frame allocation

- All obstacles/shards/power-ups/particles come from the fixed-size pools
  defined in §3, created once at boot. "Spawning" = flipping `active =
  true` and resetting fields on an existing pooled object found via linear
  scan (`pool.find(e => !e.active)`craft as a plain `for` loop, not
  `.find()`, to avoid the closure-allocation and iterator overhead of
  array methods in the hot path — see below).
- **Avoid these allocation sources in the hot loop** (update/render, called
  every frame):
  - No `array.map/filter/forEach` with arrow-function closures inside
    `update()`/`render()` — use indexed `for` loops. `.filter()` in
    particular allocates a brand-new array every call; never call it per
    frame.
  - No object literals created per frame for things like `{x, y}` return
    values from projection math — either inline the two scalar values as
    separate return values via out-parameters (mutate a shared scratch
    object) or just compute x and y with two separate function calls
    where cheap.
  - No template-literal string building per frame for HUD (`score:
    ${score}`) inside the render loop — since HUD text lives in real DOM
    elements (per §1), only touch `element.textContent` when the
    underlying number actually changes (cache last-rendered value, skip
    the DOM write if unchanged — DOM writes are far more expensive than
    canvas draws).
  - Particle trail ring buffer (`player.trail`) is a fixed-length array
    pre-filled with placeholder objects at boot; "pushing" a new trail
    point means overwriting the oldest slot's fields in place (circular
    index), never `array.push()`/`shift()`.
- Pool linear scans are fine performance-wise at these sizes (max ~24
  obstacles / 40 shards / 200 particles) — no need for free-lists or
  object headers; O(n) scan of small arrays every spawn tick (which itself
  is throttled to every `spawnInterval`, not every frame) is negligible.

### `devicePixelRatio` handling

Set up once at boot and on every `resize`:

```js
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight;

  canvas.width = Math.round(canvasWidth * dpr);
  canvas.height = Math.round(canvasHeight * dpr);
  canvas.style.width = canvasWidth + 'px';
  canvas.style.height = canvasHeight + 'px';

  const ctx2d = canvas.getContext('2d');
  ctx2d.setTransform(dpr, 0, 0, dpr, 0, 0); // single transform call; all draw calls use CSS-px coordinates thereafter

  horizonY = canvasHeight * HORIZON_Y_RATIO;
  vanishX = canvasWidth / 2;
  vanishY = horizonY;
  player.y = canvasHeight * 0.86;
  player.x = player.targetX = laneNearX(player.laneIndex);
}

window.addEventListener('resize', resizeCanvas);
window.addEventListener('orientationchange', resizeCanvas);
resizeCanvas(); // initial call at boot
```

Using `setTransform` (absolute, not `scale()` which compounds) means
`resizeCanvas` can be called repeatedly (e.g. on every `resize` event
during a drag-resize) without ever needing to reset the transform first —
each call fully replaces it.

### Other perf notes

- Cap and reuse `ctx.shadowBlur`/`ctx.shadowColor` glow effects
  deliberately: glow via `shadowBlur` is GPU/CPU-costly per shape; batch
  same-color glowing shapes together where feasible (draw all cyan shards
  in one shadowColor-set block) to minimize context-state churn, and keep
  blur radius modest (spec wants polish, not a bloom pass over the whole
  frame — reserve heavy glow for the player orb, sun, and a handful of
  near-plane entities; skip/reduce blur on tiny far-plane entities where
  it's imperceptible and gate it, e.g. `if (scale > 0.3) applyGlow()`).
- `requestAnimationFrame` naturally caps to display refresh rate; the
  delta-time scaling in §4 already decouples simulation speed from frame
  rate, so no manual frame-skipping logic is needed beyond the `dt` clamp.
- Touch/pointer event listeners use `{ passive: true }` where they don't
  need `preventDefault` (tap-zone detection), and `{ passive: false }`
  only where `preventDefault()` is required to stop iOS rubber-band
  scroll during swipes on the canvas — narrow the non-passive listener
  scope to just the canvas element, not `document`, to keep the rest of
  the page's scroll performance (e.g. Game Over screen's DOM buttons)
  unaffected.

---

## Summary of Key Constants (single source of truth, define once near top of `game.js`)

```js
LANE_COUNT = 3
HORIZON_Y_RATIO = 0.42
BASE_SPEED = 220
SPEED_RAMP_FACTOR = 6
MAX_SPEED = 620
DIFFICULTY_RAMP_CAP_SECONDS = 60
BASE_SPAWN_INTERVAL = 1.1   // seconds
MIN_SPAWN_INTERVAL  = 0.55  // seconds
HIT_WINDOW_NEAR = -0.02
HIT_WINDOW_FAR  =  0.10
FAR_DISTANCE  = 30
NEAR_DISTANCE = 1
```

Any future balance tuning should touch only this block.
