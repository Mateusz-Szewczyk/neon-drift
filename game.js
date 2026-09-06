// ============================================================================
// NEON DRIFT — game.js
// Single-file vanilla JS Canvas2D game. See ARCHITECTURE.md for the design
// this file implements section-by-section (banners below mirror that doc).
// ============================================================================

(function () {
  'use strict';

  // === 1. CONSTANTS & CONFIG ===============================================

  var LANE_COUNT = 3;
  var HORIZON_Y_RATIO = 0.42;
  var BASE_SPEED = 220;
  var SPEED_RAMP_FACTOR = 6;
  var MAX_SPEED = 620;
  var DIFFICULTY_RAMP_CAP_SECONDS = 60;
  var BASE_SPAWN_INTERVAL = 1.1;
  var MIN_SPAWN_INTERVAL = 0.55;
  var HIT_WINDOW_NEAR = -0.02;
  var HIT_WINDOW_FAR = 0.10;
  var FAR_DISTANCE = 30;
  var NEAR_DISTANCE = 1;
  var Z_SPEED_SCALE = 0.0016; // converts world-speed units into z/second
  var LANE_CHANGE_EASE = 10;
  var BEST_SCORE_KEY = 'neonDriftBestScore';
  var INITIAL_GRACE_SECONDS = 1.2;
  var POWERUP_MIN_INTERVAL = 8;
  var POWERUP_MAX_INTERVAL = 14;
  var MAGNET_DURATION_MS = 5000;
  var SLOWMO_DURATION_MS = 4000;
  var SHIELD_INVULN_MS = 800;

  var GameState = Object.freeze({
    BOOT: 'BOOT',
    START_SCREEN: 'START_SCREEN',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAME_OVER: 'GAME_OVER'
  });

  var SPAWN_PATTERNS = [
    ['obstacle', null, null],
    [null, 'obstacle', null],
    [null, null, 'obstacle'],
    ['obstacle', null, 'obstacle'],
    ['shard', 'shard', 'shard'],
    ['obstacle', 'shard', null],
    [null, 'shard', 'obstacle'],
    ['obstacle', null, 'shard'],
    ['shard', null, 'obstacle'],
    [null, null, null]
  ];

  (function assertPatternsAreFair() {
    for (var i = 0; i < SPAWN_PATTERNS.length; i++) {
      var pattern = SPAWN_PATTERNS[i];
      var openLanes = 0;
      for (var j = 0; j < pattern.length; j++) {
        if (pattern[j] !== 'obstacle') openLanes++;
      }
      if (openLanes < 1) {
        throw new Error('Unfair spawn pattern: no open lane — ' + JSON.stringify(pattern));
      }
    }
  })();

  var OBSTACLE_KINDS = [
    { kind: 'wall', color: '#ff2d95' },
    { kind: 'wall', color: '#ff9d00' },
    { kind: 'triangle', color: '#ff003c' }
  ];

  // === 2. UTILITY / MATH HELPERS ============================================

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function randRange(a, b) { return a + Math.random() * (b - a); }
  function randInt(a, b) { return Math.floor(randRange(a, b + 1)); }
  function lerpColor(hexA, hexB, t) {
    var a = hexToRgb(hexA), b = hexToRgb(hexB);
    var r = Math.round(lerp(a.r, b.r, t));
    var g = Math.round(lerp(a.g, b.g, t));
    var bl = Math.round(lerp(a.b, b.b, t));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }
  function hexToRgb(hex) {
    hex = hex.replace('#', '');
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16)
    };
  }
  function formatNumber(n) {
    return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  // === 3. STATE MACHINE ======================================================

  var currentState = GameState.BOOT;
  var pausedAt = 0;

  var canvas, ctx;
  var canvasWidth = 0, canvasHeight = 0;
  var horizonY = 0, vanishX = 0, vanishY = 0;
  var roadHalfWidthNear = 0;

  var bestScore = 0;
  var score = 0;
  var combo = 0;
  var displayedScore = -1;
  var displayedBest = -1;
  var displayedCombo = -2;

  var elapsedTime = 0;
  var scrollSpeed = BASE_SPEED;
  var distanceScrolled = 0; // accumulated for grid scroll animation

  var activePowerUp = null; // 'shield' | 'magnet' | 'slowmo' | null
  var powerUpEndsAt = 0;
  var powerUpDuration = 0;

  var lastFrameTime = 0;

  var nextSpawnAt = 0;
  var spawnInterval = BASE_SPAWN_INTERVAL;
  var nextPowerUpAt = 0;

  var shakeUntil = 0;
  var shakeStart = 0;
  var shakeDuration = 0;
  var shakeMagnitude = 0;
  var flashAlpha = 0;
  var flashStart = 0;
  var flashDuration = 0;
  var flashPeak = 0;
  var timeScale = 1;
  var gameOverFreezeUntil = 0;
  var pendingGameOver = false;

  var isNewBest = false;

  // === 4. ENTITY FACTORIES & POOLS ==========================================

  function createPlayer() {
    return {
      laneIndex: 1,
      x: 0,
      y: 0,
      targetX: 0,
      tiltAngle: 0,
      radius: 16,
      pulsePhase: 0,
      shieldActive: false,
      invulnerableUntil: 0,
      invulnPulseStart: 0,
      trail: []
    };
  }

  function createObstacle() {
    return { active: false, lane: 0, z: 1.0, kind: 'wall', color: '#ff2d95', hit: false, seed: 0 };
  }

  function createShard() {
    return {
      active: false, lane: 0, z: 1.0, rotation: 0,
      magnetized: false, magnetLaneBlend: 0, collected: false,
      collectedAt: 0, sparkleTimer: 0
    };
  }

  function createPowerUp() {
    return { active: false, lane: 0, z: 1.0, type: 'shield', rotation: 0 };
  }

  function createParticle() {
    return {
      active: false, x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 0, size: 2, color: '#ffffff',
      kind: 'spark', text: '', scale: 1, colorA: '', colorB: ''
    };
  }

  var player = createPlayer();
  var obstaclePool = [];
  var shardPool = [];
  var powerUpPool = [];
  var particlePool = [];
  for (var _i = 0; _i < 24; _i++) obstaclePool.push(createObstacle());
  for (var _j = 0; _j < 40; _j++) shardPool.push(createShard());
  for (var _k = 0; _k < 6; _k++) powerUpPool.push(createPowerUp());
  for (var _l = 0; _l < 200; _l++) particlePool.push(createParticle());

  var TRAIL_LENGTH = 24;
  for (var _t = 0; _t < TRAIL_LENGTH; _t++) {
    player.trail.push({ x: 0, y: 0, alpha: 0, size: 0, active: false, life: 0, maxLife: 0.45, colorT: 0 });
  }
  var trailIndex = 0;
  var trailEmitAccumulator = 0;

  // Star field
  var stars = [];
  function initStars() {
    var area = canvasWidth * canvasHeight;
    var count = Math.min(180, Math.max(40, Math.round((area / (390 * 844)) * 80)));
    stars = [];
    for (var i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * canvasWidth,
        y: Math.random() * (horizonY * 0.9),
        radius: 0.6 + Math.random() * Math.random() * 1.0,
        baseAlpha: 0.4 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
        twinkleSpeed: randRange(0.0015, 0.004)
      });
    }
  }

  // Sun scanline shimmer phases
  var sunBandPhases = [];
  for (var _sb = 0; _sb < 9; _sb++) {
    sunBandPhases.push({ phase: Math.random() * Math.PI * 2, freq: randRange(0.0005, 0.0012) });
  }

  // Combo popup texts (lightweight canvas-drawn floaters)
  var comboPopups = [];
  function spawnComboPopup(x, y, points, tier) {
    comboPopups.push({
      x: x, y: y, points: points, tier: tier,
      startTime: performance.now(), life: 780
    });
  }

  // === 5. INPUT HANDLING =====================================================

  var touchStartX = 0, touchStartY = 0, touchActive = false;
  var SWIPE_THRESHOLD = 40;

  function handleLaneInput(direction) {
    // direction: -1 left, +1 right, 0 = center/activate
    if (currentState === GameState.START_SCREEN) {
      startGame();
      return;
    }
    if (currentState === GameState.GAME_OVER) return;
    if (currentState !== GameState.PLAYING) return;

    if (direction === -1) {
      changeLane(-1);
    } else if (direction === 1) {
      changeLane(1);
    } else {
      activateHeldPowerUp();
    }
  }

  function changeLane(delta) {
    var newLane = clamp(player.laneIndex + delta, 0, LANE_COUNT - 1);
    if (newLane === player.laneIndex) return;
    player.laneIndex = newLane;
    player.targetX = laneNearX(newLane);
  }

  function activateHeldPowerUp() {
    // Per spec, power-ups auto-apply on pickup; a center tap with nothing
    // held is just a neutral no-op tap.
  }

  function setupInput() {
    canvas.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      touchActive = true;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    canvas.addEventListener('touchmove', function (e) {
      e.preventDefault(); // stop iOS rubber-band scroll during swipes
    }, { passive: false });

    canvas.addEventListener('touchend', function (e) {
      if (!touchActive) return;
      touchActive = false;
      e.preventDefault(); // avoid a trailing synthetic click double-firing input
      var touch = e.changedTouches[0];
      var dx = touch.clientX - touchStartX;
      var dy = touch.clientY - touchStartY;
      if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
        handleLaneInput(dx > 0 ? 1 : -1);
      } else if (Math.abs(dy) > SWIPE_THRESHOLD && dy < 0) {
        handleLaneInput(0);
      } else {
        // Tap: use tap-zone (left/middle/right third of width)
        var x = touch.clientX;
        if (x < canvasWidth / 3) handleLaneInput(-1);
        else if (x > (canvasWidth * 2) / 3) handleLaneInput(1);
        else handleLaneInput(0);
      }
    }, { passive: false });

    canvas.addEventListener('click', function (e) {
      // Mouse fallback for desktop testing: tap zones.
      var x = e.clientX;
      if (x < canvasWidth / 3) handleLaneInput(-1);
      else if (x > (canvasWidth * 2) / 3) handleLaneInput(1);
      else handleLaneInput(0);
    });

    window.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { handleLaneInput(-1); }
      else if (e.key === 'ArrowRight') { handleLaneInput(1); }
      else if (e.key === 'ArrowUp' || e.key === ' ') { e.preventDefault(); handleLaneInput(0); }
    });
  }

  // === 6. SPAWN SYSTEM =======================================================

  function findInactive(pool) {
    for (var i = 0; i < pool.length; i++) {
      if (!pool[i].active) return pool[i];
    }
    return null;
  }

  function spawnObstacle(lane) {
    var o = findInactive(obstaclePool);
    if (!o) return;
    var variant = OBSTACLE_KINDS[randInt(0, OBSTACLE_KINDS.length - 1)];
    o.active = true;
    o.lane = lane;
    o.z = 1.0;
    o.kind = variant.kind;
    o.color = variant.color;
    o.hit = false;
    o.seed = Math.random() * 1000;
  }

  function spawnShard(lane) {
    var s = findInactive(shardPool);
    if (!s) return;
    s.active = true;
    s.lane = lane;
    s.z = 1.0;
    s.rotation = 0;
    s.magnetized = false;
    s.magnetLaneBlend = 0;
    s.collected = false;
    s.sparkleTimer = 0;
  }

  function spawnPowerUp(lane, type) {
    var p = findInactive(powerUpPool);
    if (!p) return;
    p.active = true;
    p.lane = lane;
    p.z = 1.0;
    p.type = type;
    p.rotation = 0;
  }

  function maybeSpawnPowerUp(pattern, now) {
    if (now < nextPowerUpAt) return;
    var openLanes = [];
    for (var lane = 0; lane < LANE_COUNT; lane++) {
      if (pattern[lane] !== 'obstacle') openLanes.push(lane);
    }
    if (openLanes.length === 0) return;
    var lane = openLanes[randInt(0, openLanes.length - 1)];
    var types = ['shield', 'magnet', 'slowmo'];
    var type = types[randInt(0, types.length - 1)];
    spawnPowerUp(lane, type);
    nextPowerUpAt = now + randRange(POWERUP_MIN_INTERVAL, POWERUP_MAX_INTERVAL) * 1000;
  }

  function computeSpawnInterval(elapsed) {
    var t = Math.min(elapsed, DIFFICULTY_RAMP_CAP_SECONDS);
    return lerp(BASE_SPAWN_INTERVAL, MIN_SPAWN_INTERVAL, t / DIFFICULTY_RAMP_CAP_SECONDS);
  }

  function updateSpawning(now, elapsed) {
    if (now < nextSpawnAt) return;
    var pattern = SPAWN_PATTERNS[randInt(0, SPAWN_PATTERNS.length - 1)];
    for (var lane = 0; lane < LANE_COUNT; lane++) {
      var cell = pattern[lane];
      if (cell === 'obstacle') spawnObstacle(lane);
      else if (cell === 'shard') spawnShard(lane);
    }
    maybeSpawnPowerUp(pattern, now);
    spawnInterval = computeSpawnInterval(elapsed);
    nextSpawnAt = now + spawnInterval * 1000;
  }

  // === 7. UPDATE (per-entity simulation step) ===============================

  function depthToDistance(z) {
    return NEAR_DISTANCE + z * (FAR_DISTANCE - NEAR_DISTANCE);
  }
  function projectScale(z) {
    var distance = depthToDistance(z);
    return NEAR_DISTANCE / distance;
  }
  function projectScreenY(z) {
    var scale = projectScale(z);
    return horizonY + (canvasHeight - horizonY) * scale;
  }
  function laneOffsetUnits(laneIndex) {
    return laneIndex - (LANE_COUNT - 1) / 2;
  }
  function laneNearX(laneIndex) {
    var laneWidth = (roadHalfWidthNear * 2) / LANE_COUNT;
    return canvasWidth / 2 + laneOffsetUnits(laneIndex) * laneWidth;
  }
  function projectLaneX(laneIndex, z) {
    var scale = projectScale(z);
    var nearX = laneNearX(laneIndex);
    return vanishX + (nearX - vanishX) * scale;
  }
  // Blended lane x for magnetized shards: interpolate between spawn lane
  // and the player's lane, then project.
  function projectBlendedLaneX(fromLane, toLane, blend, z) {
    var scale = projectScale(z);
    var nearFrom = laneNearX(fromLane);
    var nearTo = laneNearX(toLane);
    var nearX = lerp(nearFrom, nearTo, blend);
    return vanishX + (nearX - vanishX) * scale;
  }

  function updatePlayer(dt) {
    player.x += (player.targetX - player.x) * Math.min(1, LANE_CHANGE_EASE * dt);
    player.tiltAngle = clamp((player.targetX - player.x) * -0.02, -0.35, 0.35);
    player.pulsePhase += dt;

    // Emit trail particles (~30/sec at 60fps -> throttle via accumulator)
    trailEmitAccumulator += dt;
    var emitInterval = 1 / 30;
    while (trailEmitAccumulator >= emitInterval) {
      trailEmitAccumulator -= emitInterval;
      var slot = player.trail[trailIndex];
      slot.x = player.x + randRange(-3, 3);
      slot.y = player.y + randRange(-3, 3);
      slot.alpha = 0.8;
      slot.size = 4;
      slot.active = true;
      slot.life = 0;
      slot.maxLife = 0.45;
      trailIndex = (trailIndex + 1) % player.trail.length;
    }

    for (var i = 0; i < player.trail.length; i++) {
      var p = player.trail[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) { p.active = false; continue; }
      var t = p.life / p.maxLife;
      p.size = lerp(4, 0.5, t);
      p.alpha = 0.8 * Math.pow(1 - t, 1.5);
      p.colorT = t;
    }
  }

  function updateEntities(dt, effectiveSpeed) {
    var zDelta = effectiveSpeed * dt * Z_SPEED_SCALE;

    for (var i = 0; i < obstaclePool.length; i++) {
      var o = obstaclePool[i];
      if (!o.active) continue;
      o.z -= zDelta;
      if (o.z < -0.05) o.active = false;
    }

    for (var j = 0; j < shardPool.length; j++) {
      var s = shardPool[j];
      if (!s.active) continue;
      s.z -= zDelta;
      s.rotation += dt * 2.5;
      if (activePowerUp === 'magnet' && !s.collected) {
        s.magnetized = true;
      }
      if (s.magnetized) {
        s.magnetLaneBlend = Math.min(1, s.magnetLaneBlend + dt * 3);
      }
      s.sparkleTimer += dt * 1000;
      if (s.sparkleTimer >= 200) {
        s.sparkleTimer = 0;
        emitShardSparkle(s);
      }
      if (s.collected) {
        // scale-up + fade handled in render via elapsed time since collectedAt
        if (performance.now() - s.collectedAt > 120) s.active = false;
      } else if (s.z < -0.05) {
        s.active = false;
      }
    }

    for (var k = 0; k < powerUpPool.length; k++) {
      var pu = powerUpPool[k];
      if (!pu.active) continue;
      pu.z -= zDelta;
      pu.rotation += dt * 1.5;
      if (pu.z < -0.05) pu.active = false;
    }

    for (var m = 0; m < particlePool.length; m++) {
      var pt = particlePool[m];
      if (!pt.active) continue;
      pt.life -= dt;
      if (pt.life <= 0) { pt.active = false; continue; }
      pt.x += pt.vx * dt * 1000;
      pt.y += pt.vy * dt * 1000;
      pt.vx *= Math.pow(0.96, dt * 60);
      pt.vy *= Math.pow(0.96, dt * 60);
    }
  }

  function emitShardSparkle(shard) {
    var x = projectLaneX(shard.lane, shard.z);
    var y = projectScreenY(shard.z);
    for (var i = 0; i < 2; i++) {
      var p = findInactive(particlePool);
      if (!p) return;
      var angle = Math.random() * Math.PI * 2;
      var speed = randRange(0.02, 0.05);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * speed * 16.6;
      p.vy = Math.sin(angle) * speed * 16.6;
      p.life = 0.3; p.maxLife = 0.3;
      p.size = 1.5;
      p.color = '#ffffff';
      p.kind = 'spark';
    }
  }

  function spawnBurstParticles(x, y, colorList, count, speedRange, lifeMs, sizeRange) {
    for (var i = 0; i < count; i++) {
      var p = findInactive(particlePool);
      if (!p) return;
      var angle = Math.random() * Math.PI * 2;
      var speed = randRange(speedRange[0], speedRange[1]);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * speed * 16.6;
      p.vy = Math.sin(angle) * speed * 16.6 - 0.05 * 16.6;
      p.life = lifeMs / 1000;
      p.maxLife = lifeMs / 1000;
      p.size = randRange(sizeRange[0], sizeRange[1]);
      p.color = colorList[randInt(0, colorList.length - 1)];
      p.kind = 'spark';
    }
  }

  function updateDifficulty(elapsed) {
    scrollSpeed = Math.min(MAX_SPEED, BASE_SPEED + elapsed * SPEED_RAMP_FACTOR);
  }

  function updatePowerUpTimer(now) {
    if (activePowerUp && activePowerUp !== 'shield') {
      if (now >= powerUpEndsAt) {
        activePowerUp = null;
      }
    }
  }

  function update(dt, now) {
    var scaledDt = dt * timeScale;
    elapsedTime += scaledDt;
    updateDifficulty(elapsedTime);
    var effectiveSpeed = scrollSpeed * (activePowerUp === 'slowmo' ? 0.6 : 1);
    distanceScrolled += effectiveSpeed * scaledDt;
    score += scaledDt * 20; // +distance-based score over time

    updateSpawning(now, elapsedTime);
    updatePlayer(scaledDt);
    updateEntities(scaledDt, effectiveSpeed);
    updatePowerUpTimer(now);
    checkCollisions(now);

    // Decay screen shake / flash timers handled in render via timestamps.
    if (timeScale < 1 && now >= gameOverFreezeUntil && pendingGameOver) {
      pendingGameOver = false;
      timeScale = 1;
      enterGameOver(now);
    }
  }

  // === 8. COLLISION DETECTION ================================================

  function checkCollisions(now) {
    if (now < player.invulnerableUntil) return;
    if (pendingGameOver) return; // already ending the run, ignore further hits

    for (var i = 0; i < obstaclePool.length; i++) {
      var o = obstaclePool[i];
      if (!o.active || o.hit) continue;
      if (o.lane !== player.laneIndex) continue;
      if (o.z < HIT_WINDOW_NEAR || o.z > HIT_WINDOW_FAR) continue;
      o.hit = true;
      handleObstacleHit(o, now);
      break;
    }

    for (var j = 0; j < shardPool.length; j++) {
      var s = shardPool[j];
      if (!s.active || s.collected) continue;
      if (s.lane !== player.laneIndex) continue;
      if (s.z < HIT_WINDOW_NEAR || s.z > HIT_WINDOW_FAR) continue;
      s.collected = true;
      s.collectedAt = now;
      handleShardPickup(s);
    }

    for (var k = 0; k < powerUpPool.length; k++) {
      var pu = powerUpPool[k];
      if (!pu.active) continue;
      if (pu.lane !== player.laneIndex) continue;
      if (pu.z < HIT_WINDOW_NEAR || pu.z > HIT_WINDOW_FAR) continue;
      activatePowerUpFn(pu.type, now);
      pu.active = false;
    }
  }

  function handleObstacleHit(obstacle, now) {
    if (player.shieldActive) {
      player.shieldActive = false;
      activePowerUp = null;
      player.invulnerableUntil = now + SHIELD_INVULN_MS;
      player.invulnPulseStart = now;
      obstacle.active = false;
      spawnBurstParticles(player.x, player.y, ['#4f9dff', '#ffffff'], 14, [0.08, 0.18], 350, [2, 4]);
      triggerFlash(0.35, 150);
      combo = 0;
      return;
    }
    triggerGameOver(now, obstacle);
  }

  function handleShardPickup(shard) {
    combo += 1;
    var points = 10 * Math.max(1, combo);
    score += points;
    var x = projectLaneX(shard.lane, shard.z);
    var y = projectScreenY(shard.z);
    spawnBurstParticles(x, y, ['#00f0ff', '#00f0ff', '#ffffff'], 10, [0.08, 0.18], 350, [2, 4]);
    spawnComboPopup(x, y, points, combo);
  }

  function activatePowerUpFn(type, now) {
    activePowerUp = type;
    if (type === 'shield') {
      player.shieldActive = true;
      powerUpEndsAt = 0;
      powerUpDuration = 0;
    } else if (type === 'magnet') {
      powerUpEndsAt = now + MAGNET_DURATION_MS;
      powerUpDuration = MAGNET_DURATION_MS;
    } else if (type === 'slowmo') {
      powerUpEndsAt = now + SLOWMO_DURATION_MS;
      powerUpDuration = SLOWMO_DURATION_MS;
    }
  }

  function triggerFlash(peakAlpha, durationMs) {
    flashStart = performance.now();
    flashDuration = durationMs;
    flashPeak = peakAlpha;
  }

  function triggerShake(magnitude, durationMs) {
    shakeStart = performance.now();
    shakeDuration = durationMs;
    shakeMagnitude = magnitude;
  }

  function triggerGameOver(now, obstacle) {
    triggerShake(10, 380);
    triggerFlash(0.55, 250);
    spawnBurstParticles(player.x, player.y, ['#ff003c', '#ff003c', '#ff003c', '#ff2d95', '#ff2d95', '#ffffff'], 26, [0.15, 0.4], 500, [2, 5]);
    timeScale = 0.05;
    gameOverFreezeUntil = now + 300;
    pendingGameOver = true;
  }

  function enterGameOver(now) {
    currentState = GameState.GAME_OVER;
    var finalScore = Math.floor(score);
    isNewBest = finalScore > bestScore;
    saveBestScoreIfBeaten(finalScore);
    showGameOverScreen(finalScore);
  }

  // === 9. RENDERING ==========================================================

  function renderBackground(now) {
    // Sky gradient
    var skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, '#0a0118');
    skyGrad.addColorStop(0.45, '#1a0a3d');
    skyGrad.addColorStop(0.78, '#3d0f5c');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvasWidth, horizonY + 2);

    // Ground fill below horizon (base, grid drawn on top)
    ctx.fillStyle = '#0a0118';
    ctx.fillRect(0, horizonY, canvasWidth, canvasHeight - horizonY);

    renderStars(now);
    renderMountains();
    renderSun(now);
    renderSpeedLines(now);
    renderGrid(now);
  }

  var lastStarUpdateTime = 0;
  function renderStars(now) {
    var starDt = lastStarUpdateTime === 0 ? 0 : (now - lastStarUpdateTime);
    lastStarUpdateTime = now;
    ctx.save();
    for (var i = 0; i < stars.length; i++) {
      var st = stars[i];
      var alpha = st.baseAlpha * (0.6 + 0.4 * Math.sin(now * st.twinkleSpeed + st.phase));
      st.y += 0.02 * (1 - st.y / horizonY) * starDt;
      if (st.y > horizonY) st.y = 0;
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.fillStyle = '#f5f0ff';
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function renderMountains() {
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#1a0a2e';
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    var segments = 8;
    for (var i = 0; i <= segments; i++) {
      var x = (canvasWidth / segments) * i;
      var y = horizonY - (Math.sin(i * 1.7) * 0.5 + 0.5) * horizonY * 0.12;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(canvasWidth, horizonY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function renderSun(now) {
    var radius = canvasWidth * 0.28;
    var cx = canvasWidth / 2;
    var cy = horizonY - radius * 0.15;

    // Outer bloom
    ctx.save();
    ctx.shadowBlur = 60;
    ctx.shadowColor = '#ff2d95';
    ctx.fillStyle = 'rgba(255,45,149,0.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Main sun gradient
    var grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, '#ff9d00');
    grad.addColorStop(0.5, '#ff5f6d');
    grad.addColorStop(1, '#ff2d95');
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Scanline bands clipped to sun circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#0a0118';
    for (var i = 0; i < 9; i++) {
      var phaseObj = sunBandPhases[i];
      var opacity = 1.0 + 0.08 * Math.sin(now * phaseObj.freq + phaseObj.phase);
      var bandHeight = radius * 0.045;
      var y = cy - radius + radius * (0.55 + 0.055 * i + 0.008 * i * i);
      ctx.globalAlpha = clamp(opacity, 0, 1);
      ctx.fillRect(cx - radius, y, radius * 2, bandHeight);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    ctx.restore();
  }

  function renderSpeedLines(now) {
    if (scrollSpeed <= 0.75 * MAX_SPEED) return;
    var t = (scrollSpeed - 0.75 * MAX_SPEED) / (0.25 * MAX_SPEED);
    var alpha = lerp(0.08, 0.22, clamp(t, 0, 1));
    var cx = vanishX, cy = vanishY;
    ctx.save();
    ctx.strokeStyle = 'rgba(245,240,255,' + alpha + ')';
    for (var i = 0; i < 12; i++) {
      var angle = (i / 12) * Math.PI * 2;
      var baseLength = Math.max(canvasWidth, canvasHeight) * 0.6;
      var length = baseLength * (0.9 + 0.1 * Math.sin(now * 0.01 + i));
      ctx.lineWidth = 1 + (i % 2);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length * 0.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function renderGrid(now) {
    var N = 14;
    var rungSpacingUnit = 1 / N;
    var scrollFrac = (distanceScrolled * 0.0006) % rungSpacingUnit;

    // Horizontal rung lines
    for (var n = 1; n <= N; n++) {
      var frac = n / N - scrollFrac;
      if (frac <= 0) frac += 1;
      if (frac > 1) frac -= 1;
      var y = horizonY + (canvasHeight - horizonY) * Math.pow(frac, 2.2);
      var alpha = lerp(0.08, 1.0, frac);
      var width = lerp(0.5, 3, frac);
      var color = lerpColor('#7b2ff7', '#00f0ff', frac);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      if (frac > 0.3) {
        ctx.shadowBlur = lerp(0, 10, frac);
        ctx.shadowColor = '#00f0ff';
      }
      var leftX = projectLaneXAtFrac(-1, frac);
      var rightX = projectLaneXAtFrac(1, frac);
      ctx.beginPath();
      ctx.moveTo(leftX, y);
      ctx.lineTo(rightX, y);
      ctx.stroke();
      ctx.restore();
    }

    // Vertical rails: outer edges (-1.5,+1.5 lane units) + 2 lane dividers (-0.5,+0.5)
    var rails = [-1.5, -0.5, 0.5, 1.5];
    for (var r = 0; r < rails.length; r++) {
      var isDivider = (r === 1 || r === 2);
      ctx.save();
      ctx.strokeStyle = isDivider ? '#00f0ff' : '#7b2ff7';
      for (var seg = 0; seg < N; seg++) {
        if (isDivider && seg % 2 === 0) continue; // dashed effect for dividers
        var f0 = seg / N;
        var f1 = (seg + 1) / N;
        var y0 = horizonY + (canvasHeight - horizonY) * Math.pow(f0, 2.2);
        var y1 = horizonY + (canvasHeight - horizonY) * Math.pow(f1, 2.2);
        var x0 = projectLaneXAtFrac(rails[r], f0);
        var x1 = projectLaneXAtFrac(rails[r], f1);
        var segAlpha = lerp(0.08, 1.0, f1);
        ctx.globalAlpha = segAlpha;
        ctx.lineWidth = lerp(0.5, isDivider ? 3.5 : 3, f1);
        ctx.shadowBlur = isDivider ? lerp(2, 14, f1) : lerp(0, 10, f1);
        ctx.shadowColor = isDivider ? '#00f0ff' : '#7b2ff7';
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Horizon line
    ctx.save();
    ctx.strokeStyle = '#ff2d95';
    ctx.shadowBlur = 24;
    ctx.shadowColor = '#ff2d95';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(canvasWidth, horizonY);
    ctx.stroke();
    ctx.restore();
  }

  // laneUnit: -1.5=left edge, -0.5/0.5=dividers, 1.5=right edge; frac: 0(far)..1(near)
  function projectLaneXAtFrac(laneUnit, frac) {
    var z = 1 - frac; // frac 0 = far(z=1), frac 1 = near(z=0)
    var scale = projectScale(z);
    var laneWidth = (roadHalfWidthNear * 2) / LANE_COUNT;
    var nearX = canvasWidth / 2 + laneUnit * laneWidth;
    return vanishX + (nearX - vanishX) * scale;
  }

  function easeSpawnScale(z) {
    var elapsedFraction = clamp(1 - z, 0, 1);
    return Math.pow(elapsedFraction, 1.8);
  }

  function renderObstacles(now) {
    for (var i = 0; i < obstaclePool.length; i++) {
      var o = obstaclePool[i];
      if (!o.active) continue;
      var s = easeSpawnScale(o.z);
      if (s <= 0.001) continue;
      var x = projectLaneX(o.lane, o.z);
      var y = projectScreenY(o.z);
      var bob = (1 - s) * Math.sin(now * 0.003 + o.seed) * 2;
      y += bob;

      var laneWidth = (roadHalfWidthNear * 2) / LANE_COUNT;
      var fullW = laneWidth * 0.24 * 4; // "24% of lane width" tuned wider for visibility of barrier
      var fullH = canvasHeight * 0.10;
      var w = lerp(fullW * 0.06, fullW, s);
      var h = lerp(fullH * 0.06, fullH, s);

      ctx.save();
      ctx.lineWidth = lerp(1, 3.5, s);
      if (s > 0.3) {
        ctx.shadowBlur = lerp(4, 22, s);
        ctx.shadowColor = o.color;
      }
      ctx.strokeStyle = o.color;
      ctx.fillStyle = 'rgba(26,1,24,0.85)';

      if (o.kind === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(x, y - h / 2);
        ctx.lineTo(x - w / 2, y + h / 2);
        ctx.lineTo(x + w / 2, y + h / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.rect(x - w / 2, y - h / 2, w, h);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function renderShards(now) {
    for (var i = 0; i < shardPool.length; i++) {
      var sh = shardPool[i];
      if (!sh.active) continue;
      var s = easeSpawnScale(sh.z);
      if (s <= 0.001 && !sh.collected) continue;

      var x;
      if (sh.magnetized) {
        x = projectBlendedLaneX(sh.lane, player.laneIndex, sh.magnetLaneBlend, sh.z);
      } else {
        x = projectLaneX(sh.lane, sh.z);
      }
      var y = projectScreenY(sh.z);

      var pickScale = 1;
      var alpha = 1;
      if (sh.collected) {
        var elapsed = performance.now() - sh.collectedAt;
        var t = clamp(elapsed / 120, 0, 1);
        pickScale = lerp(1.0, 1.6, t);
        alpha = 1 - t;
      }

      var size = 18 * s * pickScale;
      if (size <= 0.001) continue;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(sh.rotation);
      if (s > 0.3) {
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#00f0ff';
      }
      var grad = ctx.createRadialGradient(0, 0, 0, 0, 0, size / 2);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#00f0ff');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(size / 2, 0);
      ctx.lineTo(0, size / 2);
      ctx.lineTo(-size / 2, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  var POWERUP_COLORS = { shield: '#4f9dff', magnet: '#ff2d95', slowmo: '#ffd23f' };

  function renderPowerUps(now) {
    for (var i = 0; i < powerUpPool.length; i++) {
      var pu = powerUpPool[i];
      if (!pu.active) continue;
      var s = easeSpawnScale(pu.z);
      if (s <= 0.001) continue;
      var x = projectLaneX(pu.lane, pu.z);
      var y = projectScreenY(pu.z);
      var size = 20 * s;
      var color = POWERUP_COLORS[pu.type] || '#ffffff';

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(pu.rotation);
      if (s > 0.3) {
        ctx.shadowBlur = 16;
        ctx.shadowColor = color;
      }
      ctx.strokeStyle = color;
      ctx.fillStyle = 'rgba(10,1,24,0.6)';
      ctx.lineWidth = 2;

      if (pu.type === 'shield') {
        drawPolygon(0, 0, size / 2, 6);
      } else if (pu.type === 'slowmo') {
        drawHourglass(size);
      } else {
        drawHorseshoe(size);
      }
      ctx.restore();
    }
  }

  function drawPolygon(cx, cy, r, sides) {
    ctx.beginPath();
    for (var i = 0; i <= sides; i++) {
      var angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
      var px = cx + Math.cos(angle) * r;
      var py = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawHourglass(size) {
    var h = size / 2;
    ctx.beginPath();
    ctx.moveTo(-h, -h);
    ctx.lineTo(h, -h);
    ctx.lineTo(-h, h);
    ctx.lineTo(h, h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function drawHorseshoe(size) {
    var r = size / 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI * 0.15, Math.PI * 0.85, false);
    ctx.stroke();
  }

  function renderParticles() {
    for (var i = 0; i < particlePool.length; i++) {
      var p = particlePool[i];
      if (!p.active) continue;
      var t = 1 - p.life / p.maxLife;
      var alpha = t >= 0.6 ? lerp(1, 0, (t - 0.6) / 0.4) : 1;
      ctx.save();
      ctx.globalAlpha = clamp(alpha, 0, 1);
      ctx.shadowBlur = 12;
      ctx.shadowColor = p.color;
      ctx.fillStyle = p.color;
      var size = p.size * (1 - t);
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0, size), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function renderPlayerTrail() {
    for (var i = 0; i < player.trail.length; i++) {
      var p = player.trail[i];
      if (!p.active) continue;
      var color = lerpColor('#00f0ff', '#7b2ff7', p.colorT || 0);
      ctx.save();
      ctx.globalAlpha = clamp(p.alpha, 0, 1);
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#00f0ff';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function renderPlayer(now) {
    var x = player.x, y = player.y;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(player.tiltAngle);

    // Invulnerability pulsing ring
    if (now < player.invulnerableUntil) {
      var elapsedInv = now - player.invulnPulseStart;
      var pulseT = (elapsedInv % 600) / 600;
      var ringScale = pulseT < 0.5 ? lerp(1.0, 1.3, pulseT / 0.5) : lerp(1.3, 1.0, (pulseT - 0.5) / 0.5);
      ctx.save();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = '#4f9dff';
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#4f9dff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 20 * ringScale, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Outer glow
    ctx.shadowColor = '#ff2d95';
    ctx.shadowBlur = 28;
    ctx.fillStyle = 'rgba(255,45,149,0.35)';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    // Mid glow
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'rgba(0,240,255,0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();

    // Core with idle pulse
    var coreRadius = 6 + Math.sin(now * 0.004) * 1.2;
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, coreRadius, 0, Math.PI * 2);
    ctx.fill();

    // Shield indicator ring
    if (player.shieldActive) {
      ctx.strokeStyle = '#4f9dff';
      ctx.shadowBlur = 16;
      ctx.shadowColor = '#4f9dff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function renderComboPopups(now) {
    for (var i = comboPopups.length - 1; i >= 0; i--) {
      var c = comboPopups[i];
      var elapsed = now - c.startTime;
      if (elapsed > c.life) { comboPopups.splice(i, 1); continue; }

      var scale, alpha, yOffset;
      if (elapsed < 180) {
        if (elapsed < 100) {
          var t1 = elapsed / 100;
          scale = lerp(0, 1.15, easeOutBack(t1));
        } else {
          var t2 = (elapsed - 100) / 80;
          scale = lerp(1.15, 1.0, t2);
        }
        alpha = 1;
        yOffset = 0;
      } else {
        var floatT = (elapsed - 180) / 600;
        floatT = clamp(floatT, 0, 1);
        yOffset = -40 * (1 - Math.pow(1 - floatT, 2));
        scale = 1.0;
        if (elapsed < 400) alpha = 1;
        else alpha = clamp(1 - (elapsed - 400) / 380, 0, 1);
      }

      var size = clamp(20 + (c.tier - 1) * 2, 20, 34);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(c.x, c.y + yOffset);
      ctx.scale(scale, scale);
      ctx.font = '700 ' + size + 'px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#00f0ff';
      ctx.fillStyle = '#00f0ff';
      ctx.fillText('+' + c.points, 0, 0);
      ctx.restore();
    }
  }

  function easeOutBack(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  function renderFlash(now) {
    if (flashDuration <= 0) return;
    var elapsed = now - flashStart;
    if (elapsed > flashDuration) {
      flashOverlayEl.style.background = 'rgba(255,0,60,0)';
      flashDuration = 0; // stop future per-frame DOM writes until next trigger
      return;
    }
    var t = elapsed / flashDuration;
    var alpha = flashPeak * Math.pow(1 - t, 3);
    flashOverlayEl.style.background = 'rgba(255,0,60,' + alpha + ')';
  }

  function getShakeOffset(now) {
    if (shakeDuration <= 0) return { x: 0, y: 0 };
    var elapsed = now - shakeStart;
    if (elapsed > shakeDuration) return { x: 0, y: 0 };
    var decay = 1 - elapsed / shakeDuration;
    var t = elapsed;
    return {
      x: shakeMagnitude * Math.sin(t * 0.08) * decay,
      y: shakeMagnitude * Math.cos(t * 0.11) * decay
    };
  }

  function render(now) {
    if (!ctx) return;
    var shake = getShakeOffset(now);
    ctx.save();
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    ctx.translate(shake.x, shake.y);

    renderBackground(now);
    renderPlayerTrail();
    renderObstacles(now);
    renderShards(now);
    renderPowerUps(now);
    renderParticles();
    renderPlayer(now);
    renderComboPopups(now);

    ctx.restore();
    renderFlash(now);
    updateHudDom();
    updatePowerUpBadge(now);
  }

  // === 10. GAME LOOP (rAF, delta-time) ======================================

  function frame(now) {
    requestAnimationFrame(frame);
    if (lastFrameTime === 0) lastFrameTime = now;
    var dt = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    dt = Math.min(dt, 1 / 15);

    if (currentState === GameState.PLAYING) {
      update(dt, now);
    }
    render(now);
  }

  // === 11. PERSISTENCE (localStorage) =======================================

  function loadBestScore() {
    try {
      var raw = localStorage.getItem(BEST_SCORE_KEY);
      var parsed = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(parsed) ? parsed : 0;
    } catch (e) {
      return 0;
    }
  }

  function saveBestScoreIfBeaten(finalScore) {
    if (finalScore > bestScore) {
      bestScore = finalScore;
      try {
        localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
      } catch (e) {
        // localStorage unavailable (private mode / quota) — fail silently.
      }
    }
  }

  // === DOM / HUD wiring ======================================================

  var startScreenEl, gameOverScreenEl, hudEl, hudScoreEl, hudBestEl,
      hudComboBlockEl, hudComboEl, startBestLabelEl, finalScoreEl,
      gameOverBestEl, newBestBadgeEl, restartBtnEl, shareBtnEl,
      powerUpBadgeEl, powerUpIconEl, powerUpRingEl, flashOverlayEl, tapToStartEl;

  var POWERUP_ICON_GLYPH = { shield: '\u2B22', magnet: '\u2E43', slowmo: '\u231B' };
  var RING_CIRCUMFERENCE = 2 * Math.PI * 19;

  function cacheDom() {
    startScreenEl = document.getElementById('start-screen');
    gameOverScreenEl = document.getElementById('game-over-screen');
    hudEl = document.getElementById('hud');
    hudScoreEl = document.getElementById('hud-score');
    hudBestEl = document.getElementById('hud-best');
    hudComboBlockEl = document.getElementById('hud-combo-block');
    hudComboEl = document.getElementById('hud-combo');
    startBestLabelEl = document.getElementById('start-best-label');
    finalScoreEl = document.getElementById('final-score');
    gameOverBestEl = document.getElementById('game-over-best');
    newBestBadgeEl = document.getElementById('new-best-badge');
    restartBtnEl = document.getElementById('restart-btn');
    shareBtnEl = document.getElementById('share-btn');
    powerUpBadgeEl = document.getElementById('powerup-badge');
    powerUpIconEl = document.getElementById('powerup-icon');
    powerUpRingEl = document.getElementById('powerup-ring-progress');
    flashOverlayEl = document.getElementById('flash-overlay');
    tapToStartEl = document.querySelector('.tap-to-start');
  }

  function updateHudDom() {
    var scoreInt = Math.floor(score);
    if (scoreInt !== displayedScore) {
      displayedScore = scoreInt;
      hudScoreEl.textContent = formatNumber(scoreInt);
    }
    if (bestScore !== displayedBest) {
      displayedBest = bestScore;
      hudBestEl.textContent = 'Best ' + formatNumber(bestScore);
      startBestLabelEl.textContent = 'Best ' + formatNumber(bestScore);
    }
    if (combo !== displayedCombo) {
      displayedCombo = combo;
      if (combo >= 2) {
        hudComboBlockEl.classList.remove('hidden');
        hudComboEl.textContent = 'x' + combo;
      } else {
        hudComboBlockEl.classList.add('hidden');
      }
    }
  }

  function updatePowerUpBadge(now) {
    if (!activePowerUp) {
      powerUpBadgeEl.classList.add('hidden');
      return;
    }
    powerUpBadgeEl.classList.remove('hidden');
    powerUpIconEl.textContent = POWERUP_ICON_GLYPH[activePowerUp] || '';
    var color = POWERUP_COLORS[activePowerUp] || '#ffffff';
    powerUpBadgeEl.style.borderColor = color;
    powerUpRingEl.style.stroke = color;

    if (activePowerUp === 'shield') {
      powerUpRingEl.style.strokeDashoffset = 0;
    } else {
      var remaining = clamp((powerUpEndsAt - now) / powerUpDuration, 0, 1);
      powerUpRingEl.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - remaining));
    }
  }

  function showGameOverScreen(finalScore) {
    finalScoreEl.textContent = formatNumber(finalScore);
    gameOverBestEl.textContent = 'Best ' + formatNumber(bestScore);
    if (isNewBest) {
      newBestBadgeEl.classList.remove('hidden');
      newBestBadgeEl.classList.remove('pop-in');
      void newBestBadgeEl.offsetWidth; // restart animation
      newBestBadgeEl.classList.add('pop-in');
    } else {
      newBestBadgeEl.classList.add('hidden');
    }
    hudEl.classList.add('hidden');
    gameOverScreenEl.classList.remove('hidden');
    // Delay visible class one frame so the CSS opacity transition plays,
    // and hold for the 300ms freeze-frame + fade window per design spec.
    requestAnimationFrame(function () {
      gameOverScreenEl.classList.add('visible');
    });
  }

  function hideGameOverScreen() {
    gameOverScreenEl.classList.add('hidden');
    gameOverScreenEl.classList.remove('visible');
  }

  // === 12. BOOTSTRAP =========================================================

  function resetRun() {
    player.laneIndex = 1;
    player.targetX = laneNearX(1);
    player.x = player.targetX;
    player.tiltAngle = 0;
    player.shieldActive = false;
    player.invulnerableUntil = 0;

    score = 0;
    combo = 0;
    distanceScrolled = 0;
    elapsedTime = 0;
    scrollSpeed = BASE_SPEED;
    activePowerUp = null;
    powerUpEndsAt = 0;

    for (var i = 0; i < obstaclePool.length; i++) obstaclePool[i].active = false;
    for (var j = 0; j < shardPool.length; j++) shardPool[j].active = false;
    for (var k = 0; k < powerUpPool.length; k++) powerUpPool[k].active = false;
    for (var m = 0; m < particlePool.length; m++) particlePool[m].active = false;
    for (var t = 0; t < player.trail.length; t++) player.trail[t].active = false;
    comboPopups.length = 0;

    nextSpawnAt = performance.now() + INITIAL_GRACE_SECONDS * 1000;
    spawnInterval = BASE_SPAWN_INTERVAL;
    nextPowerUpAt = performance.now() + randRange(POWERUP_MIN_INTERVAL, POWERUP_MAX_INTERVAL) * 1000;

    shakeMagnitude = 0;
    shakeDuration = 0;
    flashAlpha = 0;
    flashDuration = 0;
    timeScale = 1;
    gameOverFreezeUntil = 0;
    pendingGameOver = false;
  }

  function startGame() {
    resetRun();
    currentState = GameState.PLAYING;
    lastFrameTime = performance.now();
    startScreenEl.classList.add('hidden');
    hideGameOverScreen();
    hudEl.classList.remove('hidden');
  }

  function restartGame() {
    resetRun();
    currentState = GameState.PLAYING;
    lastFrameTime = performance.now();
    hideGameOverScreen();
    hudEl.classList.remove('hidden');
  }

  function shareScore() {
    var text = 'I scored ' + formatNumber(Math.floor(score)) + ' points in NEON DRIFT! Best: ' + formatNumber(bestScore) + '.';
    var revert = function () {
      shareBtnEl.classList.remove('is-copied');
      shareBtnEl.textContent = 'Share';
    };
    var showCopied = function () {
      shareBtnEl.textContent = 'Copied!';
      shareBtnEl.classList.add('is-copied');
      setTimeout(revert, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(showCopied, function () {
        // Clipboard write failed (permissions) — fail silently, no crash.
      });
    }
  }

  function resizeCanvas() {
    var dpr = window.devicePixelRatio || 1;
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;

    canvas.width = Math.round(canvasWidth * dpr);
    canvas.height = Math.round(canvasHeight * dpr);
    canvas.style.width = canvasWidth + 'px';
    canvas.style.height = canvasHeight + 'px';

    ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    horizonY = canvasHeight * HORIZON_Y_RATIO;
    vanishX = canvasWidth / 2;
    vanishY = horizonY;
    roadHalfWidthNear = Math.min(canvasWidth * 0.42, 260);

    player.y = canvasHeight * 0.86;
    player.x = player.targetX = laneNearX(player.laneIndex);

    initStars();
  }

  function setupVisibilityHandling() {
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (currentState === GameState.PLAYING) {
          currentState = GameState.PAUSED;
          pausedAt = performance.now();
        }
      } else {
        if (currentState === GameState.PAUSED) {
          var now = performance.now();
          var pauseDuration = now - pausedAt;
          nextSpawnAt += pauseDuration;
          nextPowerUpAt += pauseDuration;
          powerUpEndsAt += pauseDuration;
          player.invulnerableUntil += pauseDuration;
          player.invulnPulseStart += pauseDuration;
          gameOverFreezeUntil += pauseDuration;
          flashStart += pauseDuration;
          shakeStart += pauseDuration;
          lastFrameTime = now;
          currentState = GameState.PLAYING;
        }
      }
    });
  }

  function setupButtons() {
    restartBtnEl.addEventListener('click', function (e) {
      e.stopPropagation();
      restartGame();
    });
    shareBtnEl.addEventListener('click', function (e) {
      e.stopPropagation();
      shareScore();
    });

    ['touchstart', 'mousedown'].forEach(function (evt) {
      restartBtnEl.addEventListener(evt, function () { restartBtnEl.classList.add('is-pressed'); }, { passive: true });
      shareBtnEl.addEventListener(evt, function () { shareBtnEl.classList.add('is-pressed'); }, { passive: true });
    });
    ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(function (evt) {
      restartBtnEl.addEventListener(evt, function () { restartBtnEl.classList.remove('is-pressed'); }, { passive: true });
      shareBtnEl.addEventListener(evt, function () { shareBtnEl.classList.remove('is-pressed'); }, { passive: true });
    });

    startScreenEl.addEventListener('touchstart', function () {
      if (tapToStartEl) tapToStartEl.classList.add('pressed');
    }, { passive: true });
    startScreenEl.addEventListener('touchend', function (e) {
      e.preventDefault(); // suppress the trailing synthetic click so we don't double-start
      if (tapToStartEl) tapToStartEl.classList.remove('pressed');
      startGame();
    }, { passive: false });
    startScreenEl.addEventListener('click', function () {
      startGame();
    });
  }

  function boot() {
    canvas = document.getElementById('game-canvas');
    cacheDom();
    bestScore = loadBestScore();
    displayedBest = -1;

    resizeCanvas();
    setupInput();
    setupButtons();
    setupVisibilityHandling();

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);

    currentState = GameState.START_SCREEN;
    updateHudDom();

    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
