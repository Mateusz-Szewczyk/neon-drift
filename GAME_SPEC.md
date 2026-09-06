# NEON DRIFT — Game Design Spec

A vertical mobile-first browser arcade game. Single static site, zero backend,
zero build step (plain HTML + CSS + JS, Canvas 2D rendering) so it deploys to
Vercel as a static site with nothing but `index.html` (+ optional separate
css/js files referenced relatively).

## Concept
Synthwave/outrun aesthetic endless "lane drifter". You are a glowing neon orb
racing down an infinite retro highway toward a sunset horizon. Obstacles
(barriers, walls with gaps) scroll toward the player; you drift between 3
lanes to dodge them, grab neon shards for score + combo multiplier, and grab
power-ups. Speed ramps up over time. One hit without a shield = game over.
Short session, "one more run" loop, designed for one-thumb portrait play.

## Visual Style (must be genuinely polished, not a placeholder look)
- Full-viewport canvas, portrait orientation, dark background `#0a0118`.
- Synthwave palette: hot magenta `#ff2d95`, cyan `#00f0ff`, purple `#7b2ff7`,
  orange/yellow sun gradient `#ff9d00 -> #ff2d95`, off-white UI text `#f5f0ff`.
- Background: parallax layers — (1) static gradient sky, (2) a large sun circle
  low on the horizon with horizontal scanline bands cut across it (classic
  outrun sun), slow-drifting stars/particles above, (3) horizon line with a
  glowing grid floor using perspective (lines converging to a vanishing point,
  scrolling toward camera to sell speed), (4) faint parallax mountain/city
  silhouette on the horizon in dark purple.
- Road: 3 lanes on the grid, lane dividers as glowing dashed lines using
  perspective scaling (near = wide/bright, far = thin/dim).
- Player: a glowing orb/diamond shape with a soft radial glow (canvas shadowBlur
  or manual radial gradient), a fading particle trail behind it, tilts slightly
  when changing lanes, subtle idle pulse animation.
- Obstacles: neon-outlined geometric barriers (rectangles/triangles) in
  contrasting colors per lane, rendered with glow, scale up as they approach
  (perspective).
- Shards: small rotating glowing diamonds, cyan, with sparkle particles.
- Power-ups: distinct glowing icon-shapes — Shield (hexagon, blue), Magnet
  (horseshoe, pink), Slow-Mo (hourglass, yellow).
- Effects: screen shake + white flash + particle burst on collision; combo
  number pops and floats up on shard pickup; subtle chromatic vignette;
  speed lines radiating from center at high speed.
- Typography: a bold condensed/tech font stack (e.g. `'Orbitron', 'Audiowide',
  sans-serif` — load from Google Fonts via `<link>`), neon text-shadow glow on
  headings and HUD.
- UI screens: Start screen (title logo w/ glow, "TAP TO START", best score),
  in-game HUD (score top-left, combo top-right, best score small under score),
  Game Over screen (final score, best score, "NEW BEST!" badge if applicable,
  restart button, share button that copies a text summary to clipboard).
- Must look great on a phone screen (390x844-ish) as primary target, but
  scale/responsive to any viewport (resize listener, recompute canvas size &
  lane geometry on resize/orientation change).

## Controls (touch-first, mobile browser)
- Tap left third of screen / swipe left / ArrowLeft key → move one lane left.
- Tap right third of screen / swipe right / ArrowRight key → move one lane right.
- Tap center / swipe up / ArrowUp / Space → activate held power-up (if any) or
  just a neutral tap (no dash needed — keep controls dead simple: this is a
  LANE-SWITCH ONLY game, no jump, to keep one-thumb play flawless).
- Swipe detection: simple touchstart/touchend delta threshold, plus fallback
  tap zones (left 33% / middle 33% / right 33% of width) so both swipe AND tap
  work identically.
- No pinch/zoom: set `<meta name="viewport" content="width=device-width,
  initial-scale=1, maximum-scale=1, user-scalable=no">` and `touch-action: none`
  on canvas to prevent scroll/zoom interfering.
- Prevent default touch scrolling/bounce (iOS rubber-banding) on the game view.

## Core Loop & Mechanics
- 3 lanes. Player starts center lane.
- Obstacles and shards spawn in a row pattern ahead (off-screen far/small) and
  scroll toward camera, growing per a perspective easing curve, removed once
  past camera.
- Spawn logic: pick a random "pattern" each spawn tick from a small pattern
  library (e.g. one lane blocked, two lanes blocked leaving one safe lane,
  alternating, all clear with just shards) so it's always fair — never spawn
  a pattern with all 3 lanes blocked.
- Difficulty ramp: base scroll speed increases smoothly with elapsed survival
  time (e.g. speed = base + min(cap, time * rampFactor)); spawn interval
  shortens slightly with speed. Cap max speed so it stays fair/playable.
- Score: +1 per distance tick (time survived) + shard pickups add points
  scaled by current combo multiplier (e.g. 10 * combo). Combo increments per
  shard collected without missing/hitting obstacle, resets on collision or if
  a shard batch is missed (design choice: combo only resets on collision, to
  keep it forgiving and satisfying — increments are the reward signal).
- Collision: obstacle in the player's current lane at the player's screen
  z-position within a hit window → game over (unless shield active, in which
  case shield consumes itself, obstacle is destroyed with a particle burst,
  brief invulnerability flash).
- Power-ups (spawn rarely, ~1 every 8-14s):
  - Shield: absorbs one hit.
  - Magnet: pulls shards in all 3 lanes toward player for ~5s (visually bends
    shard paths toward player lane).
  - Slow-Mo: temporarily reduces effective scroll speed ~40% for ~4s, giving
    breathing room (also just feels great, not only defensive).
  - Only one power-up held at a time (a small icon shows in HUD with a
    depleting radial-progress ring); picking a new one replaces it if unused,
    or just also fine to auto-apply on pickup — pick auto-apply-on-pickup with
    a HUD icon+timer for whichever is currently active, simplest and clear.
- Game over on unshielded collision: screen shake, red flash, particles,
  short slow-mo freeze-frame (~300ms) then Game Over screen.
- Best score persisted in `localStorage` (`neonDriftBestScore`). Show
  "NEW BEST!" if beaten.
- Restart resets all state instantly back into a fresh run without a page
  reload.

## Technical Requirements
- Plain HTML5 + CSS3 + vanilla JS (ES modules fine), Canvas 2D API only — no
  build tooling, no npm dependencies required to run (keeps Vercel deploy to
  "serve static files", zero config).
- Single `index.html` at repo root referencing `./style.css` and `./game.js`
  (or `./src/...`), so `vercel.json` can be minimal/absent (static detection).
- `requestAnimationFrame` game loop with delta-time scaling (not frame-locked)
  so speed is consistent across devices/refresh rates.
- Object pooling or simple array filtering for obstacles/shards/particles —
  keep it performant on mid-range phones (target smooth 60fps, avoid
  allocating garbage every frame where easy to avoid).
- Handle `devicePixelRatio` for crisp canvas rendering on high-DPI phone
  screens.
- Pause game loop (or at least stop spawning/scoring) on `visibilitychange`
  when tab/app is backgrounded, resume cleanly.
- No external JS libraries/CDNs except the Google Fonts stylesheet link (and
  optionally a font preconnect). Everything else self-contained so it works
  fully offline once loaded and has no dependency risk.
- Add a minimal PWA-ish touch: `<meta name="theme-color" content="#0a0118">`,
  a simple inline favicon (data URI or tiny svg) — no full manifest/service
  worker required, keep scope tight.
- Include a short `README.md`: what the game is, controls, how to run locally
  (e.g. `npx serve` or just opening index.html), tech stack, and a note that
  it's deployed on Vercel as a static site.
- Add `.gitignore` (node artifacts even though unused, editor files, OS junk).
- Test locally before considering done: serve the folder with a simple static
  server and verify in a headless/real browser that (a) the start screen
  renders, (b) tapping/clicking starts the run and the player/obstacles/HUD
  render and animate, (c) no console errors. Fix any errors found.

## Naming
- Game title shown in UI: **NEON DRIFT**
- Repo/project name: `neon-drift`

## Definition of done
- `index.html`, `style.css`, `game.js`, `README.md`, `.gitignore` committed.
- Opening `index.html` in a browser (or via local static server) shows the
  neon start screen immediately, is fully playable start-to-game-over-to-restart,
  looks visually polished per the style section above (glow effects, parallax,
  particles — not flat/plain), and has zero console errors during a full
  playthrough.
