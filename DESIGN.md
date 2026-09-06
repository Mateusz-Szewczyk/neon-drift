# NEON DRIFT — Visual & UX Design Document

This document is the authoritative, implementation-ready visual spec. It extends
the "Visual Style" section of `GAME_SPEC.md` with exact values. Every color is a
hex code, every size a number, every animation has timing + easing. No value
here should need designer judgment calls at code time.

---

## 1. Color Palette

### 1.1 Core roles

| Role | Hex | Notes |
|---|---|---|
| Background base (void) | `#0a0118` | Canvas clear color / body background |
| Background gradient top | `#0a0118` | Sky gradient stop 0% |
| Background gradient mid | `#1a0a3d` | Sky gradient stop 45% |
| Background gradient horizon | `#3d0f5c` | Sky gradient stop 78% (just above sun) |
| Sun gradient stop 1 (top/outer) | `#ff9d00` | Sun radial gradient 0% |
| Sun gradient stop 2 | `#ff5f6d` | Sun radial gradient 45% |
| Sun gradient stop 3 (bottom/inner) | `#ff2d95` | Sun radial gradient 100% |
| Sun scanline color | `#0a0118` | Bands drawn AT background color to cut gaps out of sun |
| Grid line — near (bright) | `#00f0ff` | Full alpha 1.0 at bottom of screen |
| Grid line — far (dim) | `#7b2ff7` | Alpha fades to 0.08 near vanishing point |
| Horizon glow line | `#ff2d95` | 2px line at vanishing-point horizon, shadowBlur 24 |
| Lane divider glow | `#00f0ff` | Same as near grid, but drawn brighter/thicker |
| Mountain/city silhouette | `#1a0a2e` | Flat fill, 40% opacity over background |
| Mountain silhouette accent lights | `#ff2d95` at 30% opacity | Random 1-2px "window" dots |
| Player core | `#ffffff` | Innermost fill — hot white core reads as "energy" |
| Player glow ring 1 | `#00f0ff` | Primary glow (cyan) |
| Player glow ring 2 | `#ff2d95` | Secondary outer glow (magenta), used in shadowBlur layering |
| Player trail particles | `#00f0ff` → fade to `#7b2ff7` | Interpolated over particle lifetime |
| Obstacle — lane barrier (standard) | `#ff2d95` | Magenta neon outline, dark fill `#1a0118` at 85% |
| Obstacle — wall-with-gap | `#ff9d00` | Orange/amber, signals "requires precision" |
| Obstacle — triangle/spike variant | `#ff003c` | Hot red-magenta, most dangerous-looking variant |
| Shard | `#00f0ff` core, `#ffffff` sparkle | Cyan diamond, white sparkle particles |
| Power-up: Shield (hexagon) | `#4f9dff` | Cool blue |
| Power-up: Magnet (horseshoe) | `#ff2d95` | Hot pink |
| Power-up: Slow-Mo (hourglass) | `#ffd23f` | Yellow |
| HUD text primary | `#f5f0ff` | Off-white, used for score/labels |
| HUD text secondary (best score, subtitle) | `#b9a6e8` | Muted lavender, 70% opacity feel |
| Combo popup text | `#00f0ff` | Cyan, scales with combo tier (see §4.7) |
| Danger / red flash | `#ff003c` | Full-screen flash overlay on collision |
| Danger / red flash (vignette pulse) | `#ff003c` at 25% opacity ring | Persistent low-HP-style edge glow (optional, only during brief post-hit invuln) |
| Button primary fill | `#ff2d95` → `#7b2ff7` gradient | 135deg, used for Restart |
| Button secondary fill (Share) | transparent, `#00f0ff` border | Outline style to differentiate from primary CTA |

### 1.2 CSS custom properties (paste into `:root`)

```css
:root {
  --c-bg: #0a0118;
  --c-bg-mid: #1a0a3d;
  --c-bg-horizon: #3d0f5c;
  --c-sun-1: #ff9d00;
  --c-sun-2: #ff5f6d;
  --c-sun-3: #ff2d95;
  --c-grid-near: #00f0ff;
  --c-grid-far: #7b2ff7;
  --c-horizon-line: #ff2d95;
  --c-mountain: #1a0a2e;
  --c-player-core: #ffffff;
  --c-player-glow-1: #00f0ff;
  --c-player-glow-2: #ff2d95;
  --c-obstacle-barrier: #ff2d95;
  --c-obstacle-wall: #ff9d00;
  --c-obstacle-spike: #ff003c;
  --c-shard: #00f0ff;
  --c-powerup-shield: #4f9dff;
  --c-powerup-magnet: #ff2d95;
  --c-powerup-slowmo: #ffd23f;
  --c-text: #f5f0ff;
  --c-text-dim: #b9a6e8;
  --c-combo: #00f0ff;
  --c-danger: #ff003c;
}
```

---

## 2. Typography

### 2.1 Google Fonts link (paste into `<head>`)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet">
```

- **Orbitron** — display/headline font. Geometric, wide, sci-fi tech feel. Used for the title logo, game-over headline, and combo popup numbers.
- **Rajdhani** — condensed technical sans, more legible at small sizes. Used for HUD numbers/labels, body copy, buttons. (Avoids Orbitron's readability problems below ~20px.)

### 2.2 Exact type scale

| Element | Font | Weight | Size (px @ 390 width) | Letter-spacing | Color | Text-shadow (glow) |
|---|---|---|---|---|---|---|
| Title logo "NEON DRIFT" | Orbitron | 900 | 48px (line-height 1.0), two lines stacked or one line with `clamp(38px, 11vw, 56px)` | 0.06em | `#f5f0ff` | `0 0 8px #ff2d95, 0 0 24px #ff2d95, 0 0 48px #00f0ff` |
| Start screen subtitle ("TAP TO START") | Rajdhani | 600 | 18px | 0.25em, uppercase | `#00f0ff` | `0 0 6px #00f0ff, 0 0 16px #00f0ff` |
| Best score label (start screen) | Rajdhani | 500 | 14px | 0.08em, uppercase | `#b9a6e8` | none |
| HUD score (main number) | Orbitron | 700 | 28px | 0.02em | `#f5f0ff` | `0 0 6px #00f0ff, 0 0 14px #00f0ff` |
| HUD "SCORE" micro-label | Rajdhani | 600 | 11px | 0.2em, uppercase | `#b9a6e8` | none |
| HUD best-score (small, under score) | Rajdhani | 500 | 12px | 0.05em | `#b9a6e8` | none |
| Combo multiplier (top-right, "x3") | Orbitron | 700 | 22px | 0 | `#00f0ff` | `0 0 8px #00f0ff` |
| Combo popup float (on pickup, "+30") | Orbitron | 700 | 20-34px depending on tier (see §4.7) | 0 | `#00f0ff` | `0 0 10px #00f0ff, 0 0 20px #ffffff` |
| Game-over headline "GAME OVER" | Orbitron | 900 | 34px | 0.05em, uppercase | `#ff003c` | `0 0 10px #ff003c, 0 0 30px #ff2d95` |
| Game-over final score value | Orbitron | 900 | 44px | 0 | `#f5f0ff` | `0 0 10px #00f0ff, 0 0 26px #00f0ff` |
| "NEW BEST!" badge | Orbitron | 700 | 16px | 0.1em, uppercase | `#0a0118` on `#ffd23f` chip bg | `0 0 12px #ffd23f` (on badge, not text) |
| Button label (Restart / Share) | Rajdhani | 700 | 17px | 0.1em, uppercase | `#f5f0ff` | none (glow comes from button shell, see §5) |

Fallback stack for both: `'Orbitron', 'Rajdhani', 'Arial Narrow', sans-serif` for headline elements, `'Rajdhani', 'Arial Narrow', sans-serif` for body/HUD, so a slow font load never shows default serif.

---

## 3. Layout & Composition (390×844 base, responsive)

All positions given as percentages of viewport (or `vh`/`vw`/`svh`) so they scale; pixel equivalents shown are computed at the 390×844 reference viewport. Use `100svh`/`100dvh` for the outer container to dodge mobile browser chrome jumps.

### 3.1 Start screen

- Full-bleed canvas background already rendering the parallax scene (sun + grid + stars) behind a semi-transparent overlay `rgba(10,1,24,0.35)` so UI text pops.
- Vertical stack, centered horizontally, using flex column, `justify-content: center`, gap `24px`, contained in a wrapper positioned `top: 0; height: 100%`.
- Title logo block: centered at **38% from top** (≈321px). Two-line layout: "NEON" / "DRIFT" or single line depending on width; use `text-align:center`.
- Idle sun/grid animation continues to play behind (not frozen) — sells "this is a live game."
- Subtitle "TAP TO START": **58% from top** (≈490px), with the pulse animation from §5.1.
- Best score line: **66% from top** (≈557px), format: `BEST 1,240`.
- Bottom safe-area padding: reserve **bottom 6% (≈50px)** empty for iOS home-indicator clearance (`env(safe-area-inset-bottom)` added).
- No canvas HUD elements visible pre-game.

### 3.2 In-game HUD

Canvas renders the game world full-bleed; HUD is an absolutely-positioned DOM overlay (`pointer-events: none` except buttons) OR drawn directly to canvas — spec assumes DOM overlay div for crisp text at any DPR, canvas underneath.

- **Score block** — top-left.
  - Position: `top: 5% (≈42px); left: 4% (≈16px)`.
  - "SCORE" micro-label directly above the number, 2px gap.
  - Best-score small line directly below main score, 4px gap, format `BEST 1,240`.
- **Combo block** — top-right, mirrored.
  - Position: `top: 5% (≈42px); right: 4% (≈16px)`, `text-align: right`.
  - Shows only when combo ≥ 2 (combo 1 = no multiplier shown, avoid clutter); fades in/out over 150ms.
  - Format: `x3` with a small "COMBO" micro-label above it identical styling to SCORE label.
- **Active power-up icon** — top-center.
  - Position: `top: 4% (≈34px)` horizontally centered, `width: 44px height: 44px` circular badge.
  - Circular badge background: `rgba(10,1,24,0.6)` with `1.5px` border colored per power-up (`--c-powerup-*`), `border-radius: 50%`.
  - Icon glyph centered inside at 22px.
  - Radial-progress ring: an SVG `<circle>` stroke-dasharray depleting clockwise, 3px stroke, same power-up color, drawn as a ring inset 2px from badge edge. Updates every frame via `stroke-dashoffset = circumference * (1 - remaining/total)`.
  - Hidden entirely (opacity 0, scale 0.8, 150ms transition) when no power-up held.
- **Touch zone dividers (dev/debug only, NOT shown in production)** — omit visually; only tap-zone thresholds at 33%/66% width matter logically, no visual line.
- **Lane guide**: none needed as separate HUD; lane dividers are part of the 3D grid render (see §4.2).
- Safe area: keep all HUD text inside `top: max(5%, env(safe-area-inset-top) + 8px)`.

### 3.3 Game-over screen

- Full-screen overlay panel, `position: fixed; inset: 0`, background `rgba(10,1,24,0.82)` with `backdrop-filter: blur(6px)` (graceful no-op on unsupported browsers), fades in over 220ms ease-out, appears 300ms after the freeze-frame from §4.9.
- Content stack centered vertically at **container `justify-content:center`**, horizontal padding `24px`.
- Order top→bottom with `18px` gaps:
  1. "GAME OVER" headline — appears at **~22% from top** (≈186px) conceptually (achieved via flex centering + this being first child).
  2. "NEW BEST!" badge (only if beaten) — pill shape, `padding: 6px 16px`, `border-radius: 999px`, background `#ffd23f`, appears with a small pop-in scale animation (see §5.4), positioned directly under headline.
  3. Final score value (large number) with "SCORE" micro-label above it.
  4. Best score line below it, smaller, format `BEST 1,240`.
  5. Button row: **Restart** (primary, filled) then **Share** (secondary, outline) — stacked vertically on narrow viewports (`<480px` width) with `14px` gap, side-by-side (`gap:16px`, row) on wider viewports.
  6. Buttons sit at **~72-85% from top**, comfortably in one-thumb reach zone (bottom third of screen), min tap target `52px` height, full-width up to `320px` max-width, centered.
- Bottom safe-area padding `env(safe-area-inset-bottom) + 24px` under button row.

### 3.4 Responsive rule of thumb

- All font sizes above use `clamp(min, vw-based, max)` in actual CSS, e.g. title logo: `clamp(34px, 11vw, 56px)`; HUD score: `clamp(22px, 6.5vw, 30px)`. The px values in the tables are the value AT 390px width (used as the `vw`-computed midpoint), max caps prevent runaway scale on tablets/desktop.
- Canvas resize listener recomputes lane x-positions as fractions of canvas width (lanes at 25%/50%/75% of width) so gameplay geometry is resolution-independent, matching the "recompute canvas size & lane geometry on resize" requirement in the spec.

---

## 4. Particle & Glow Effect Recipes

### 4.1 Player glow (canvas)

Rendered every frame at player's screen (x, y):

- Draw order: outer glow → mid glow → core.
- Outer glow: `ctx.shadowColor = '#ff2d95'; ctx.shadowBlur = 28;` draw a filled circle radius `14px` color `rgba(255,45,149,0.35)`.
- Mid glow: `ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 20;` filled circle radius `10px` color `rgba(0,240,255,0.55)`.
- Core: `ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 12;` filled circle (or diamond via rotated square) radius `6px` color `#ffffff`.
- Idle pulse: core radius oscillates `6px ± 1.2px` via `radius = 6 + Math.sin(t * 0.004) * 1.2` (t = performance.now()).
- Lane-change tilt: player sprite rotates `±12deg` over `160ms` (ease-out-quad) toward the direction of travel, then eases back to `0deg` over `140ms` once lane-change completes.
- Alternative radial-gradient version (if not using shadowBlur for perf): `ctx.createRadialGradient(x,y,0,x,y,16)` with stops `0.0 → #ffffff`, `0.25 → #00f0ff`, `0.6 → rgba(255,45,149,0.4)`, `1.0 → rgba(255,45,149,0)`.

### 4.2 Player particle trail

- Emit 1 particle per frame while moving (throttle to every 2nd frame at >120fps devices via delta-time accumulator, target ~30 particles/sec at 60fps).
- Spawn at player position with `±3px` random jitter.
- Initial radius: `4px`, initial color `#00f0ff`, initial alpha `0.8`.
- Velocity: inherits `-scrollSpeed * 0.3` on the y-axis (drifts backward relative to camera), `0` on x (or slight jitter `±0.2px/frame`).
- Lifetime: `450ms`. Over lifetime: radius shrinks `4px → 0.5px`, color interpolates `#00f0ff → #7b2ff7`, alpha fades `0.8 → 0` (linear fade, or `alpha = 0.8 * (1 - t/lifetime)^1.5` for a faster tail-off).
- Rendered with `ctx.shadowBlur = 8; ctx.shadowColor = '#00f0ff'`.

### 4.3 Sun rendering (scanline bands)

- Sun is a circle, radius = `28% of canvas width`, center at `x = 50% canvas width`, `y = horizon_y - radius * 0.15` (sits mostly above horizon, slightly cut off).
- Fill with radial gradient: `createRadialGradient(cx, cy, 0, cx, cy, radius)`, stops: `0.0 → #ff9d00`, `0.5 → #ff5f6d`, `1.0 → #ff2d95`.
- Scanlines: **9 horizontal bands**, drawn AFTER the gradient fill, in background color `#0a0118`, each band height = `radius * 0.045` (≈ proportional gaps), with increasing vertical gap between bands as you go down (classic outrun look): band `i` (0-indexed, 0=top) is positioned at `y = cy - radius + radius * (0.55 + 0.055*i + 0.008*i*i)` — i.e. quadratically increasing spacing — clipped to the sun's circular path (`ctx.save(); ctx.clip(sunCirclePath); ctx.fillRect(...); ctx.restore();`).
- Sun sits statically (no vertical bob) but scanline bands may shimmer: each band's opacity oscillates independently `1.0 ± 0.08` at a random per-band frequency `0.5-1.2Hz`, subtle, barely perceptible (sells "energy" without being distracting).
- Sun overall has a soft outer bloom: draw one extra circle radius `radius * 1.15` BEFORE the main sun, color `rgba(255,45,149,0.15)`, `ctx.shadowBlur = 60; ctx.shadowColor = '#ff2d95'`.

### 4.4 Grid floor (perspective)

- Vanishing point: `x = 50% canvas width`, `y = horizon_y` (horizon_y ≈ `38% of canvas height` from top).
- Horizontal "rung" lines: draw ~14 lines total. Their y-positions use an exponential/inverse-perspective spacing so they compress near horizon and spread near camera: `y_n = horizon_y + (canvasHeight - horizon_y) * (n / N)^2.2` for `n = 1..N` (N=14). This gives dense far lines, sparse near lines (correct perspective feel).
- Each rung line scrolls: offset all `y_n` by `(scrollOffset % rungSpacingUnit)` each frame recomputed from accumulated distance, so lines appear to move toward camera continuously.
- Rung line color/opacity by depth: `alpha = lerp(0.08, 1.0, n/N)` (far = 0.08, near = 1.0), color interpolates `--c-grid-far (#7b2ff7)` at far to `--c-grid-near (#00f0ff)` at near.
- Rung line width: `0.5px` at farthest to `3px` at nearest, interpolated same as alpha.
- Vertical "rail" lines (lane dividers + outer edges): 4 verticals (left edge, 2 lane dividers, right edge) converging from vanishing point to bottom-left/right screen edges at the two outer rails; lane-divider verticals converge to `x = 33%` and `66%` of canvas width at the BOTTOM, `x = 50%` (vanishing point) at horizon.
  - Lane dividers rendered as **dashed** lines: dash pattern computed per-segment so dash LENGTH scales with proximity (far dashes ≈ `4px` long / `8px` gap, near dashes ≈ `28px` long / `20px` gap) — approximate by drawing the vertical as a series of short segments matching the rung intervals, alternating drawn/skipped.
  - Lane divider color: `#00f0ff` with `ctx.shadowBlur = 14; ctx.shadowColor = '#00f0ff';` at near segments, shadowBlur fading to `2` at far segments.
  - Outer rail lines: `#7b2ff7`, no dash, same depth-based width/alpha falloff as rung lines, shadowBlur `10 → 0`.
- Horizon line itself: solid `2px` line at `y = horizon_y`, full canvas width, color `#ff2d95`, `ctx.shadowBlur = 24; ctx.shadowColor = '#ff2d95'`.

### 4.5 Star field

- Density: **80 stars** on a canvas ≈390×844 (scale count by `canvasArea / (390*844) * 80`, cap at 180 for large desktop viewports).
- Distributed in the sky region only: `y` from `0` to `horizon_y * 0.9` (stay above the sun/mountains).
- Each star: radius `0.6-1.6px` (random per star, weighted toward smaller — `radius = 0.6 + Math.random()^2 * 1.0`), color `#f5f0ff` at base alpha `0.4-0.9` (random per star).
- Twinkle: each star has an independent phase offset; alpha modulates as `baseAlpha * (0.6 + 0.4 * Math.sin(t * twinkleSpeed + phase))` where `twinkleSpeed` is random per star in range `0.0015-0.004` (ms-based `t`).
- Slow drift: stars drift downward/toward horizon at `0.02px/ms * (1 - y/horizon_y)` (parallax: stars nearer horizon drift faster, distant zenith stars barely move), wrapping back to top when they pass horizon_y.
- No shadowBlur on stars (keep cheap — 80-180 of them); only use `globalAlpha`.

### 4.6 Obstacle rendering

- Base shape scaled by perspective factor `s` (0 = just spawned at horizon, 1 = at camera/hit-line), using same easing as grid: `s = (elapsedFraction)^1.8` (ease-in, accelerates near camera — sells speed).
- Screen size at full scale (`s=1`): lane-barrier width = `24% of lane width`, height `10% of canvas height`. At `s=0`: scaled to `6%` of full size (a speck near horizon).
- Rendering: stroke-only neon outline, `lineWidth = lerp(1, 3.5, s)`, `ctx.shadowBlur = lerp(4, 22, s)`, `ctx.shadowColor` = obstacle's assigned color, fill interior with `rgba(26,1,24,0.85)` (near-black translucent so glow reads against grid).
- Colors: standard barrier `#ff2d95`, wall-with-gap `#ff9d00`, spike/triangle variant `#ff003c` (see palette table).
- Slight vertical bob on far-spawned obstacles for liveliness: `y_offset = sin(t*0.003 + seed) * 2px`, damped to 0 as `s` approaches 1 (stop bobbing once close, for readability/fairness).

### 4.7 Shard + sparkle

- Shard shape: diamond (rotated square), size at full scale `18px` (scales with perspective same curve as obstacles: `s^1.8`).
- Rotation: continuous spin, `rotation = t * 0.0025` (rad/ms) — roughly one full turn every ~2.5s.
- Core color `#00f0ff`, fill with radial gradient center `#ffffff` → edge `#00f0ff`, `ctx.shadowBlur = 16; ctx.shadowColor = '#00f0ff'`.
- Sparkle particles: emit **2 particles every 200ms** while on-screen (not tied to pickup), small `1.5px` radius, color `#ffffff`, spawned at random point on shard's perimeter, velocity outward `0.02-0.05px/ms` radial from shard center, lifetime `300ms`, fade `1.0 → 0` alpha linear.
- Pickup burst: on collection, emit **10 particles** instantly, radius `2-4px`, color `#00f0ff` (70%) / `#ffffff` (30%), velocity `0.08-0.18px/ms` in random directions (360°), lifetime `350ms`, fade out, plus the shard scales up `1.0 → 1.6` and fades out over `120ms` (ease-out) instead of just vanishing.

### 4.8 Collision particle burst (obstacle hit)

- Emit **26 particles** at point of impact (player position).
- Color mix: 50% `#ff003c` (danger red), 30% `#ff2d95` (magenta), 20% `#ffffff` (hot sparks).
- Radius: `2-5px` random.
- Velocity: `0.15-0.4px/ms`, random angle full 360°, with slight upward bias (`vy -= 0.05px/ms`) for a more explosive "burst" feel rather than flat spread.
- Gravity-like drag: velocity multiplied by `0.96` per frame (16.6ms reference) so particles decelerate naturally.
- Lifetime: `500ms`, radius shrinks to `0`, alpha fades `1.0 → 0` starting at `60%` of lifetime (stays bright/solid at first, then fades — reads more "energetic").
- `ctx.shadowBlur = 12` on each particle, `ctx.shadowColor` = particle's own color.

### 4.9 Screen shake, red flash, freeze-frame (on collision without shield)

- **Screen shake**: duration `380ms`, magnitude curve = decaying sine: `offsetX = magnitude * Math.sin(t * 0.08) * decay`, `offsetY = magnitude * Math.cos(t * 0.11) * decay`, where `decay = 1 - (elapsed/duration)` (linear decay to 0), `magnitude = 10px` at `t=0`. Apply via `ctx.translate(offsetX, offsetY)` before world render each frame during the shake window.
- **Red flash**: a full-canvas (or full-screen DOM) overlay `rgba(255,0,60, alpha)`. Alpha spikes to `0.55` instantly on impact frame, then decays over `250ms` using ease-out cubic: `alpha = 0.55 * (1 - t/250)^3`.
- **Freeze-frame / slow-mo**: immediately on impact, set game `timeScale = 0.05` (near-frozen, not fully 0 so shake/particles still barely animate) for `300ms` of real time, then transition to Game Over screen (fade in per §3.3). This matches spec's "~300ms freeze-frame".
- Combined sequence timeline: `t=0` impact → shake+flash+particles start, timeScale drops → `t=300ms` timeScale resumes irrelevant (game over triggers) → `t=300ms+220ms fade` Game Over panel fully visible.
- **Shielded hit** (different, less severe): white flash only, alpha `0.35`, decay `150ms`, no screen shake, no freeze-frame, obstacle destroyed with its own small particle burst (14 particles, `#4f9dff` + white, same physics as §4.8 scaled down), brief player invulnerability glow ring (`#4f9dff`, pulsing scale `1.0→1.3→1.0` over `600ms`, 2 pulses) around player.

### 4.10 Combo number pop + float

- On shard pickup with combo ≥ 2 (or every pickup if you want constant feedback — recommend showing on every pickup, more juice): spawn a floating text element at the pickup's screen position (or fixed near HUD combo block — recommend AT PICKUP POSITION on canvas for better juice/association, using a lightweight DOM span or canvas-drawn text).
- Text content: `+{points}` (e.g. `+30`), color `#00f0ff`, font Orbitron 700.
- Size scaling by combo tier: base `20px`, `+2px` per combo tier above 1, capped at `34px` (tier 8+).
- **Pop-in**: scale `0 → 1.15 → 1.0` over first `180ms`: `0-100ms` scale 0→1.15 (ease-out-back, overshoot), `100-180ms` settle 1.15→1.0 (ease-in-out).
- **Float + fade**: from `t=180ms` to `t=780ms` (600ms duration), translate Y upward `-40px` total using ease-out-quad (`y = -40 * (1-(1-p)^2)` where p = progress 0-1), alpha fades `1.0 → 0` starting at `t=400ms` (stays fully visible for first ~220ms of the float, then fades over remaining ~380ms).
- Total lifetime: `780ms`, then removed/destroyed.
- Easing reference (cubic-bezier approximations if using CSS transitions instead of manual tween): pop-in = `cubic-bezier(0.34, 1.56, 0.64, 1)` (back-out), float = `cubic-bezier(0.22, 1, 0.36, 1)` (quad/expo-out).

### 4.11 Speed lines (high-speed effect)

- Activate when `currentSpeed > 0.75 * maxSpeed`.
- Draw **12 thin streaks** radiating from screen center (or from vanishing point, `y = horizon_y`, `x = 50%`) outward to the four corners/edges.
- Each streak: `1-2px` width, color `rgba(245,240,255, alpha)` where `alpha` scales with how far over the 0.75 threshold current speed is (`0.08` at threshold, up to `0.22` at max speed).
- Streaks pulse length slightly: `length = baseLength * (0.9 + 0.1*sin(t*0.01 + i))`.
- Kept subtle — this is a background accent, must never obscure obstacles/shards (render BEHIND the grid/obstacles, only in the sky region, or as a very low-alpha full-screen radial-line overlay under everything else except the base background).

### 4.12 Chromatic vignette

- Static (non-animated) radial vignette overlay, always present: `ctx.createRadialGradient` centered on canvas, inner stop transparent at `60%` radius, outer stop `rgba(10,1,24,0.55)` at `100%` radius — subtle framing, drawn once per frame as the last compositing step (or as a CSS `box-shadow: inset` / radial-gradient div overlay for zero perf cost — recommended: CSS overlay, not canvas, since it never changes shape).
- Optional very subtle color-fringe: two 1px-offset copies of the vignette edge in `rgba(255,45,149,0.04)` and `rgba(0,240,255,0.04)` offset ±1px horizontally — purely a nice-to-have, skip if perf-constrained.

---

## 5. Button & UI Element Styling

### 5.1 "TAP TO START" prompt (start screen)

- Not a button (no hard edges) — plain text with a breathing pulse to invite interaction.
- Animation: `opacity` and `text-shadow` intensity both pulse on a `1.6s` ease-in-out infinite loop: `opacity: 1.0 → 0.55 → 1.0`, glow blur radius `16px → 8px → 16px` (i.e. animate the two larger text-shadow blur values between those bounds).
- CSS:
```css
.tap-to-start {
  font: 600 18px 'Rajdhani', sans-serif;
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: var(--c-grid-near);
  animation: pulse 1.6s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; text-shadow: 0 0 6px var(--c-grid-near), 0 0 16px var(--c-grid-near); }
  50%      { opacity: 0.55; text-shadow: 0 0 4px var(--c-grid-near), 0 0 8px var(--c-grid-near); }
}
```
- Tap feedback: whole start screen listens for tap; on tap, prompt itself scales `1.0 → 0.92` over `80ms` then game transition begins.

### 5.2 Restart button (primary)

- Shape: `border-radius: 12px`, `min-height: 52px`, `padding: 14px 32px`, `width: 100%` up to `max-width: 320px`.
- Fill: `linear-gradient(135deg, #ff2d95 0%, #7b2ff7 100%)`.
- Border: `1.5px solid rgba(255,255,255,0.25)` (subtle rim light).
- Text: Rajdhani 700 17px, uppercase, `letter-spacing: 0.1em`, color `#f5f0ff`.
- Box-shadow (glow): `0 0 16px rgba(255,45,149,0.55), 0 4px 12px rgba(0,0,0,0.4)`.
- **Hover** (desktop/mouse, progressive enhancement only): `transform: translateY(-2px); box-shadow: 0 0 24px rgba(255,45,149,0.75), 0 6px 16px rgba(0,0,0,0.45);` transition `150ms ease-out`.
- **Active/pressed** (critical for mobile touch feedback): `transform: scale(0.96) translateY(1px); box-shadow: 0 0 10px rgba(255,45,149,0.4), 0 2px 6px rgba(0,0,0,0.3);` filter `brightness(0.92)`, transition `80ms ease-out` (snappier than hover, feels responsive to tap).
- Implementation note: bind pressed state to `:active` CSS pseudo-class AND `touchstart`/`touchend` JS toggle of a `.is-pressed` class (some mobile browsers delay/skip `:active`), whichever fires first wins, both map to the same visual rule above.

```css
.btn-primary {
  min-height: 52px; padding: 14px 32px; border-radius: 12px;
  background: linear-gradient(135deg, #ff2d95 0%, #7b2ff7 100%);
  border: 1.5px solid rgba(255,255,255,0.25);
  font: 700 17px 'Rajdhani', sans-serif; letter-spacing: 0.1em; text-transform: uppercase;
  color: #f5f0ff;
  box-shadow: 0 0 16px rgba(255,45,149,0.55), 0 4px 12px rgba(0,0,0,0.4);
  transition: transform 150ms ease-out, box-shadow 150ms ease-out, filter 80ms ease-out;
}
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 0 24px rgba(255,45,149,0.75), 0 6px 16px rgba(0,0,0,0.45); }
.btn-primary:active, .btn-primary.is-pressed {
  transform: scale(0.96) translateY(1px);
  box-shadow: 0 0 10px rgba(255,45,149,0.4), 0 2px 6px rgba(0,0,0,0.3);
  filter: brightness(0.92);
  transition: transform 80ms ease-out, box-shadow 80ms ease-out, filter 80ms ease-out;
}
```

### 5.3 Share button (secondary, outline)

- Same box model as primary (`min-height: 52px`, `border-radius: 12px`, up to `max-width: 320px`).
- Fill: `rgba(10,1,24,0.4)` (near-transparent, lets background show through).
- Border: `1.5px solid #00f0ff`.
- Text: Rajdhani 700 17px, uppercase, `letter-spacing: 0.1em`, color `#00f0ff`.
- Box-shadow (glow): `0 0 12px rgba(0,240,255,0.35)`.
- **Hover**: border/text brighten via `filter: brightness(1.2)`, box-shadow `0 0 18px rgba(0,240,255,0.55)`.
- **Active/pressed**: `transform: scale(0.96); background: rgba(0,240,255,0.12); box-shadow: 0 0 8px rgba(0,240,255,0.25);` — fill briefly tints cyan to confirm the tap registered, `80ms ease-out`.
- **Copied confirmation state** (after successful clipboard write): label swaps to "COPIED!" for `1400ms`, border/text color shifts to `#ffd23f` (yellow, matches success/positive accent) during that window, then reverts.

```css
.btn-secondary {
  min-height: 52px; padding: 14px 32px; border-radius: 12px;
  background: rgba(10,1,24,0.4);
  border: 1.5px solid #00f0ff;
  font: 700 17px 'Rajdhani', sans-serif; letter-spacing: 0.1em; text-transform: uppercase;
  color: #00f0ff;
  box-shadow: 0 0 12px rgba(0,240,255,0.35);
  transition: filter 150ms ease-out, box-shadow 150ms ease-out, transform 80ms ease-out, background 80ms ease-out;
}
.btn-secondary:hover { filter: brightness(1.2); box-shadow: 0 0 18px rgba(0,240,255,0.55); }
.btn-secondary:active, .btn-secondary.is-pressed {
  transform: scale(0.96);
  background: rgba(0,240,255,0.12);
  box-shadow: 0 0 8px rgba(0,240,255,0.25);
}
.btn-secondary.is-copied { color: #ffd23f; border-color: #ffd23f; box-shadow: 0 0 12px rgba(255,210,63,0.45); }
```

### 5.4 "NEW BEST!" badge pop-in

- Appears (if applicable) `150ms` after the game-over panel starts fading in.
- Animation: scale `0 → 1.2 → 1.0` over `320ms`: `0-200ms` ease-out-back (overshoot to 1.2), `200-320ms` ease-in-out settle to 1.0. Paired with opacity `0 → 1` over the first `120ms` only.
- Idle state after pop-in: gentle glow pulse, `box-shadow` blur `10px ↔ 16px` over `1.2s` ease-in-out infinite (same technique as §5.1, slower/subtler).

### 5.5 Tap zones (in-game touch targets)

- Left 33% / middle 33% / right 33% of viewport width, full height, invisible (no visual chrome — a visible overlay would clutter the neon scene).
- Optional micro-feedback: on tap, a very brief (`120ms`) radial ripple at the tap point, `rgba(245,240,255,0.25)` expanding circle `0 → 60px` radius, fading out, purely as a "yes, I heard you" touch confirmation without adding permanent UI chrome.

---

## 6. Rationale — Why This Reads as Polished Synthwave, Not Generic

1. **Layered depth over flat color.** Every element (sun, grid, player, obstacles, shards) uses at minimum a 2-3-stop gradient or multi-layer shadowBlur rather than a single flat fill — flat neon-on-black is what makes amateur synthwave art look like a CSS demo. Depth comes from graduated glow radii (12/20/28px rings) and interpolated far→near color/alpha, not from any single "neon" filter.
2. **Perspective math, not a static image.** The grid and obstacles use an actual exponential/power-curve perspective function (`^1.8`, `^2.2`) rather than linear scaling — real outrun games (and this genre's visual DNA) rely on that nonlinear compression near the horizon; linear scaling reads instantly as "flat scrolling background," not "3D road."
3. **Restrained, purposeful palette.** Only 3 hue families (magenta/pink, cyan, purple) plus one warm accent (orange/yellow sun + slow-mo) are used everywhere — every obstacle, power-up, and UI element pulls from this same 4-hue system rather than introducing arbitrary new colors, which is what makes a palette feel "designed" instead of "default game-jam rainbow."
4. **Motion has decay curves, not on/off toggles.** Screen shake, red flash, combo pop, and badge pop all use explicit easing/decay math (ease-out-back overshoot, cubic decay, sine-based shake with linear decay) instead of instantly appearing/disappearing — professional game feel is almost entirely about *how things stop*, not just that they move.
5. **Consistent glow logic tied to depth/importance, not decoration.** ShadowBlur values scale with both "how close to camera" (perspective) and "how important" (player > shards > obstacles > UI chrome), so the eye is guided exactly where gameplay needs attention — glow here is a readability tool as much as an aesthetic one, which is the difference between "looks neon" and "looks like a neon *game*."
