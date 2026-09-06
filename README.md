# NEON DRIFT

A synthwave/outrun-styled endless "lane drifter" arcade game for the browser.
Drift a glowing neon orb down an infinite retro highway toward a sunset
horizon, dodging obstacles, collecting cyan shards for score + combo, and
grabbing power-ups (Shield, Magnet, Slow-Mo). One hit without a shield ends
the run. Speed ramps up the longer you survive. Built mobile-first for
one-thumb portrait play, fully responsive to any viewport.

## Controls

- **Touch**: swipe left/right to change lanes, swipe up to activate a held
  power-up. Tap zones also work identically — left third / middle third /
  right third of the screen.
- **Keyboard**: `ArrowLeft` / `ArrowRight` to change lanes, `ArrowUp` or
  `Space` to activate a held power-up.
- **Mouse** (desktop testing): click the left/middle/right third of the
  canvas, same as tap zones.

## How to run locally

No build step, no dependencies. Just serve the folder as static files and
open it in a browser (opening `index.html` directly via `file://` also
works since the game uses a classic `<script>` tag, not ES modules):

```bash
# Any static server works, e.g.:
npx serve .
# or
python -m http.server 8123
```

Then visit `http://localhost:<port>/`.

## Tech stack

- Plain HTML5 + CSS3 + vanilla JavaScript (ES5/ES2020-flavored, no modules).
- Canvas 2D API for all game rendering (parallax starfield, outrun sun with
  scanlines, perspective grid road, glow effects via `shadowBlur` and radial
  gradients, particle bursts/trails).
- HUD (score, combo, power-up badge) is a DOM overlay for crisp text at any
  device pixel ratio; the canvas underneath renders the game world.
- Fonts: [Orbitron](https://fonts.google.com/specimen/Orbitron) (display) and
  [Rajdhani](https://fonts.google.com/specimen/Rajdhani) (HUD/body), loaded
  via Google Fonts `<link>` — the only external dependency.
- Best score persisted via `localStorage`.
- No npm dependencies required to run.

## Deployment

This is a static site — deploy as-is to [Vercel](https://vercel.com) with
zero configuration (static file detection picks up `index.html` at the repo
root automatically).

## Files

- `index.html` — markup, canvas element, meta tags, font link, HUD overlay.
- `style.css` — layout, HUD/screen styling, button states, responsive rules.
- `game.js` — entire game: state machine, entities, spawn system, collision
  detection, rendering, input handling, persistence.
