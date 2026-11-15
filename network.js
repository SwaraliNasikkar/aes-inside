/**
 * ============================================================================
 * AES INSIDE — Interactive Living Network Canvas (network.js)
 * ============================================================================
 * Features:
 *  - ~90 glowing nodes on desktop (~60 on mobile), drifting slowly
 *  - Distance-faded connections within 140px
 *  - Cursor acts as a magnetic node pulling nearby nodes with brighter cyan lines
 *  - Exposes window.networkPulse(color, mode) for AES step ripples, SubBytes
 *    flicker, AddRoundKey amber flash, and Avalanche chain-reaction waves
 *  - Retina DPR scaling, tab-visibility pause, and prefers-reduced-motion support
 * ============================================================================
 */
(function (global) {
  'use strict';

  const canvas = document.getElementById('network-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COLORS = {
    cyan: { r: 92, g: 225, b: 255 },
    magenta: { r: 255, g: 61, b: 139 },
    amber: { r: 255, g: 181, b: 71 }
  };

  let width = window.innerWidth;
  let height = window.innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  const LINK_DIST = 140;
  const MOUSE_RADIUS = 175;
  const BASE_ALPHA = 0.35; // Low opacity behind glass panels for crisp readability

  let nodes = [];
  let mouse = { x: -9999, y: -9999, active: false };
  let animId = null;
  let isHidden = document.hidden;

  // Active visual effects
  let ripple = null;        // { radius, maxRadius, color, speed, thickness }
  let flickerTimer = 0;     // SubBytes subtle network flicker
  let flashEffect = null;   // { color, alpha } for AddRoundKey
  let chainQueue = [];      // Avalanche node-to-node magenta propagation

  function parseColor(color) {
    if (!color) return COLORS.magenta;
    const c = String(color).toLowerCase();
    if (c.includes('ff3d8b') || c === 'magenta') return COLORS.magenta;
    if (c.includes('ffb547') || c === 'amber') return COLORS.amber;
    return COLORS.cyan;
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const targetCount = width < 768 ? 60 : 90;
    if (nodes.length !== targetCount) {
      initNodes(targetCount);
    }
    if (prefersReducedMotion) drawFrame();
  }

  function initNodes(count) {
    nodes = [];
    for (let i = 0; i < count; i++) {
      nodes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.42,
        vy: (Math.random() - 0.5) * 0.42,
        r: 1.6 + Math.random() * 1.8,
        energy: 0, // 0..1 glow boost from chain reaction or ripple
        energyColor: COLORS.cyan
      });
    }
  }

  /**
   * Public pulse hook called by app.js whenever an AES step or Avalanche event occurs.
   * @param {string} color - Hex or named color (#FF3D8B, #FFB547, #5CE1FF)
   * @param {'step'|'subbytes'|'addroundkey'|'avalanche'} mode
   */
  function networkPulse(color = '#FF3D8B', mode = 'step') {
    if (prefersReducedMotion) return;
    const rgb = parseColor(color);

    if (mode === 'subbytes') {
      flickerTimer = 18;
    } else if (mode === 'addroundkey') {
      flashEffect = { color: COLORS.amber, alpha: 0.72 };
    } else if (mode === 'avalanche') {
      // Trigger a magenta chain reaction spreading node-to-node from near center
      const cx = width * 0.5;
      const cy = height * 0.48;
      let seedIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < nodes.length; i++) {
        const d = Math.hypot(nodes[i].x - cx, nodes[i].y - cy);
        if (d < bestDist) {
          bestDist = d;
          seedIdx = i;
        }
      }
      nodes[seedIdx].energy = 1;
      nodes[seedIdx].energyColor = COLORS.magenta;
      chainQueue = [{ idx: seedIdx, ttl: 5 }];
    }

    // Outward ripple from center stage along lines
    ripple = {
      x: width * 0.5,
      y: height * 0.46,
      radius: 20,
      maxRadius: Math.hypot(width, height) * 0.65,
      speed: mode === 'avalanche' ? 14 : 11,
      color: rgb
    };
  }

  function updatePhysics() {
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];

      // Gentle magnetic pull toward cursor
      if (mouse.active) {
        const dx = mouse.x - n.x;
        const dy = mouse.y - n.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 18 && dist < MOUSE_RADIUS) {
          const pull = (1 - dist / MOUSE_RADIUS) * 0.022;
          n.vx += (dx / dist) * pull;
          n.vy += (dy / dist) * pull;
        }
      }

      // Clamp velocity so drift remains calm
      const speed = Math.hypot(n.vx, n.vy);
      if (speed > 0.95) {
        n.vx = (n.vx / speed) * 0.95;
        n.vy = (n.vy / speed) * 0.95;
      }

      n.x += n.vx;
      n.y += n.vy;

      // Soft boundary bounce
      if (n.x < 0) { n.x = 0; n.vx *= -1; }
      else if (n.x > width) { n.x = width; n.vx *= -1; }
      if (n.y < 0) { n.y = 0; n.vy *= -1; }
      else if (n.y > height) { n.y = height; n.vy *= -1; }

      // Decay energy
      if (n.energy > 0) {
        n.energy = Math.max(0, n.energy - 0.018);
      }
    }

    // Advance outward stage ripple
    if (ripple) {
      ripple.radius += ripple.speed;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        const d = Math.hypot(n.x - ripple.x, n.y - ripple.y);
        if (Math.abs(d - ripple.radius) < 38) {
          n.energy = Math.max(n.energy, 0.85);
          n.energyColor = ripple.color;
        }
      }
      if (ripple.radius > ripple.maxRadius) {
        ripple = null;
      }
    }

    // Advance Avalanche chain reaction across connected neighbors
    if (chainQueue.length > 0) {
      const nextWave = [];
      for (let q = 0; q < chainQueue.length; q++) {
        const item = chainQueue[q];
        if (item.ttl <= 0) continue;
        const src = nodes[item.idx];
        for (let j = 0; j < nodes.length; j++) {
          if (j === item.idx || nodes[j].energy > 0.45) continue;
          const d = Math.hypot(nodes[j].x - src.x, nodes[j].y - src.y);
          if (d < LINK_DIST * 1.15) {
            nodes[j].energy = 1;
            nodes[j].energyColor = COLORS.magenta;
            if (nextWave.length < 24) {
              nextWave.push({ idx: j, ttl: item.ttl - 1 });
            }
          }
        }
      }
      chainQueue = nextWave;
    }

    if (flickerTimer > 0) flickerTimer--;
    if (flashEffect) {
      flashEffect.alpha -= 0.03;
      if (flashEffect.alpha <= 0) flashEffect = null;
    }
  }

  function drawFrame() {
    ctx.clearRect(0, 0, width, height);

    const flickerMod = flickerTimer > 0 ? (0.45 + Math.random() * 0.85) : 1;

    // 1. Connect nearby nodes
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.hypot(dx, dy);
        if (dist < LINK_DIST) {
          const proximity = 1 - dist / LINK_DIST;
          const boost = Math.max(a.energy, b.energy);
          let col = boost > 0.15 ? (a.energy >= b.energy ? a.energyColor : b.energyColor) : COLORS.cyan;
          let alpha = proximity * (BASE_ALPHA + boost * 0.45) * flickerMod;

          if (flashEffect) {
            col = flashEffect.color;
            alpha = Math.min(0.85, alpha + flashEffect.alpha * proximity * 0.45);
          }

          ctx.strokeStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha.toFixed(3)})`;
          ctx.lineWidth = boost > 0.25 ? 1.4 : 0.85;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // 2. Cursor connections (brighter ice-cyan)
      if (mouse.active && !prefersReducedMotion) {
        const md = Math.hypot(a.x - mouse.x, a.y - mouse.y);
        if (md < MOUSE_RADIUS) {
          const mProx = 1 - md / MOUSE_RADIUS;
          ctx.strokeStyle = `rgba(92, 225, 255, ${(mProx * 0.65).toFixed(3)})`;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    }

    // 3. Draw nodes
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const col = n.energy > 0.15 ? n.energyColor : COLORS.cyan;
      const alpha = Math.min(0.95, (BASE_ALPHA + 0.15 + n.energy * 0.6) * flickerMod);

      ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha.toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + n.energy * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Draw subtle expanding ripple ring
    if (ripple) {
      const fade = Math.max(0, 1 - ripple.radius / ripple.maxRadius);
      ctx.strokeStyle = `rgba(${ripple.color.r}, ${ripple.color.g}, ${ripple.color.b}, ${(fade * 0.26).toFixed(3)})`;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(ripple.x, ripple.y, ripple.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function loop() {
    if (isHidden || prefersReducedMotion) return;
    updatePhysics();
    drawFrame();
    animId = requestAnimationFrame(loop);
  }

  // Event listeners
  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  }, { passive: true });

  window.addEventListener('mouseout', () => {
    mouse.active = false;
  });

  document.addEventListener('visibilitychange', () => {
    isHidden = document.hidden;
    if (isHidden && animId) {
      cancelAnimationFrame(animId);
      animId = null;
    } else if (!isHidden && !prefersReducedMotion && !animId) {
      loop();
    }
  });

  // Expose public trigger
  global.networkPulse = networkPulse;

  // Boot
  resize();
  if (prefersReducedMotion) {
    drawFrame(); // Static dots only
  } else {
    loop();
  }
})(window);
