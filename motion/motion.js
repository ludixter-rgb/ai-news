'use strict';
// Motion Study 01 — every frame is a pure function of time t (seconds).
// No keyframes, no assets besides fonts. 15s · 60fps · 1920×1080 · 120 BPM.

const W = 1920, H = 1080, FPS = 60, DUR = 15, BEAT = 0.5, TAU = Math.PI * 2;

// ─── palette ──────────────────────────────────────────────────────────────
const C = { ink: '#0B0B12', paper: '#F2EEE4', red: '#FF3D1F', blue: '#2B45FF', yel: '#FFC400' };
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const CR = Object.fromEntries(Object.entries(C).map(([k, v]) => [k, hex(v)]));
const PAL = [C.red, C.blue, C.yel, C.paper];
const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// ─── math ─────────────────────────────────────────────────────────────────
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const E = {
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: t => { const c1 = 1.9, c3 = c1 + 1; return t <= 0 ? 0 : 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inBack: t => { const c1 = 1.9, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
};
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function h3(x, y, z) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const a = h3(xi, yi, zi), b = h3(xi + 1, yi, zi), c = h3(xi, yi + 1, zi), d = h3(xi + 1, yi + 1, zi);
  const e = h3(xi, yi, zi + 1), f = h3(xi + 1, yi, zi + 1), g = h3(xi, yi + 1, zi + 1), k = h3(xi + 1, yi + 1, zi + 1);
  return lerp(lerp(lerp(a, b, u), lerp(c, d, u), v), lerp(lerp(e, f, u), lerp(g, k, u), v), w) * 2 - 1;
}
function curl(x, y, z) {
  const e = 0.02;
  return [
    (noise3(x, y + e, z) - noise3(x, y - e, z)) / (2 * e),
    -(noise3(x + e, y, z) - noise3(x - e, y, z)) / (2 * e),
  ];
}

// ─── canvases ─────────────────────────────────────────────────────────────
const mk = (w = W, h = H) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const out = document.getElementById('c');
const octx = out.getContext('2d');
const SC = mk(), sg = SC.getContext('2d');          // scene
const TMP = mk(), tg = TMP.getContext('2d');        // scene-within-scene (transitions)
const FR = mk(), fg = FR.getContext('2d');          // post-chroma frame
const ACC = mk(), ag = ACC.getContext('2d');        // motion-blur accumulator
const CH = [mk(), mk(), mk()].map(c => ({ c, g: c.getContext('2d') }));

function bg(g, col) { g.fillStyle = col; g.fillRect(-200, -200, W + 400, H + 400); }
function circle(g, x, y, r) { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, TAU); }
const font = (px, fam = 'Archivo Black') => `${px}px "${fam}"`;

// ─── timeline ─────────────────────────────────────────────────────────────
const HITS = [1.0, 1.5, 4.0, 6.5, 8.5, 9.0, 11.5, 13.5, 14.0, 14.5];
const hit = (t, dec = 7) => HITS.reduce((s, h) => s + (t >= h ? Math.exp(-(t - h) * dec) : 0), 0);
const beatPulse = (t, k = 9) => Math.exp(-(((t % BEAT) + BEAT) % BEAT) * k);
const LABELS = [[0, '00  ORIGIN'], [1.5, '01  KINETIC TYPE'], [4, '02  GEOMETRY'], [6.5, '03  PARTICLES'],
  [9, '04  VELOCITY'], [11.5, '05  CONSTRUCTION'], [13.5, '06  SIGNATURE']];

// scramble-resolve text: characters flicker through glyphs, then lock in one by one
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>';
function scramble(str, t, t0, per = 0.018, flick = 0.12) {
  let s = '';
  for (let i = 0; i < str.length; i++) {
    const lock = t0 + i * per + flick;
    if (t < t0 + i * per) break;
    if (str[i] === ' ' || t >= lock) s += str[i];
    else s += GLYPHS[Math.floor(h3(i, Math.floor(t * 40), 7) * GLYPHS.length)];
  }
  return s;
}

// ═══ SCENE 0 · ORIGIN (0 – 1.5) ═══════════════════════════════════════════
const BURST = (() => {
  const r = mulberry32(11);
  return Array.from({ length: 84 }, (_, i) => ({
    a: (i / 84) * TAU + (r() - 0.5) * 0.05, len: 500 + r() * 900, dur: 0.35 + r() * 0.35,
    w: 3 + r() * 9, c: PAL[i % 4],
  }));
})();
function s0(g, t) {
  bg(g, C.ink);
  const cx = W / 2, cy = H / 2;
  // anticipation: rings collapse into the dot
  for (let i = 0; i < 4; i++) {
    const p = inv(0.2 + i * 0.1, 1.0, t);
    if (p > 0 && p < 1) {
      g.strokeStyle = rgba(CR.paper, 0.1 + 0.7 * p);
      g.lineWidth = 1 + 3 * p;
      circle(g, cx, cy, lerp(900 - i * 120, 12, E.inExpo(p))); g.stroke();
    }
  }
  if (t < 1.0) {
    let r = 14 * E.outBack(inv(0.05, 0.4, t));
    r *= 1 + 0.25 * Math.sin(t * 70) * E.inCubic(inv(0.55, 1.0, t)) - 0.35 * E.inExpo(inv(0.8, 1.0, t));
    g.fillStyle = C.paper; circle(g, cx, cy, r); g.fill();
    return;
  }
  const lt = t - 1.0;
  // flash disc
  g.fillStyle = rgba(CR.paper, 1 - inv(0, 0.18, lt));
  circle(g, cx, cy, 60 + 400 * E.outExpo(inv(0, 0.18, lt))); g.fill();
  // shockwaves
  for (let k = 0; k < 3; k++) {
    const p = inv(k * 0.05, 0.7 + k * 0.08, lt);
    if (p <= 0 || p >= 1) continue;
    g.strokeStyle = [C.red, C.yel, C.blue][k];
    g.lineWidth = 60 * Math.pow(1 - p, 2.2);
    circle(g, cx, cy, E.outExpo(p) * (1250 - k * 180)); g.stroke();
  }
  // radial burst
  g.lineCap = 'round';
  for (const b of BURST) {
    const head = E.outExpo(inv(0, b.dur, lt)), tail = E.outExpo(inv(0.06, b.dur + 0.12, lt));
    if (tail >= 0.999) continue;
    const r0 = 40 + tail * b.len, r1 = 40 + head * b.len;
    g.strokeStyle = b.c; g.lineWidth = b.w * (1 - tail);
    g.beginPath();
    g.moveTo(cx + Math.cos(b.a) * r0, cy + Math.sin(b.a) * r0);
    g.lineTo(cx + Math.cos(b.a) * r1, cy + Math.sin(b.a) * r1); g.stroke();
  }
  // iris opens into scene 1
  const ip = E.inOutCubic(inv(0.2, 0.5, lt));
  if (ip > 0) { g.fillStyle = C.red; circle(g, cx, cy, ip * 1120); g.fill(); }
}

// ═══ SCENE 1 · KINETIC TYPE (1.5 – 4.0) ══════════════════════════════════
const WORDS = [
  { w: 'EVERY', t: 1.5, bg: C.red, fg: C.ink, max: 400 },
  { w: 'FRAME', t: 2.0, bg: C.ink, fg: C.paper, max: 400 },
  { w: 'IS', t: 2.5, bg: C.paper, fg: C.ink, max: 620 },
  { w: 'A', t: 2.75, bg: C.yel, fg: C.ink, max: 760 },
  { w: 'DECISION.', t: 3.0, bg: C.blue, fg: C.paper, max: 400 },
];
function wordLayout(g, wd) {
  g.font = font(wd.max);
  const size = Math.min(wd.max, (wd.max * W * 0.84) / g.measureText(wd.w).width);
  g.font = font(size);
  const xs = []; for (let i = 0; i < wd.w.length; i++) xs.push(g.measureText(wd.w.slice(0, i)).width);
  return { size, xs, total: g.measureText(wd.w).width };
}
function drawWord(g, wd, t) {
  const lt = t - wd.t, L = wordLayout(g, wd), { size, xs, total } = L;
  const x0 = W / 2 - total / 2, base = H / 2 + size * 0.36;
  const drop = wd.w.startsWith('DEC');
  g.save();
  const z = 1 + 0.05 * lt;                       // continuous push-in
  g.translate(W / 2, H / 2); g.scale(z, z); g.translate(-W / 2, -H / 2);
  g.beginPath();
  g.rect(-W, base - size * 0.86, W * 3, drop ? H * 2 : size * 0.96); g.clip();
  const dys = [];
  for (let i = 0; i < wd.w.length; i++) {
    const p = drop ? E.outBack(inv(0, 0.42, lt - i * 0.04)) : E.outExpo(inv(0, 0.5, lt - i * 0.035));
    dys.push(p <= 0 ? null : (1 - p) * size * (drop ? -1.1 : 1.05));
  }
  if (drop) {                                   // echo trail
    const e = E.outExpo(inv(0.32, 0.7, lt));
    if (e > 0) {
      g.lineWidth = 3; g.lineJoin = 'round';
      for (let k = 7; k >= 1; k--) {
        g.strokeStyle = rgba(k % 2 ? CR.yel : CR.red, 1 - k / 9);
        const o = e * k * 13;
        for (let i = 0; i < wd.w.length; i++) if (dys[i] !== null) g.strokeText(wd.w[i], x0 + xs[i] + o, base + dys[i] + o);
      }
    }
  }
  g.fillStyle = wd.fg;
  for (let i = 0; i < wd.w.length; i++) if (dys[i] !== null) g.fillText(wd.w[i], x0 + xs[i], base + dys[i]);
  g.restore();
}
function s1(g, t) {
  let k = 0; while (k + 1 < WORDS.length && t >= WORDS[k + 1].t) k++;
  const cur = WORDS[k];
  if (k > 0) { const pv = WORDS[k - 1]; bg(g, pv.bg); drawWord(g, pv, t); } else bg(g, cur.bg);
  const p = k === 0 ? 1 : E.outExpo(inv(0, 0.24, t - cur.t));
  g.save();
  g.beginPath();
  switch (k % 4) {
    case 1: g.rect(0, H * (1 - p), W, H * p); break;
    case 2: g.rect(0, 0, W * p, H); break;
    case 3: g.rect(0, 0, W, H * p); break;
    default: g.rect(W * (1 - p), 0, W * p, H);
  }
  g.clip(); bg(g, cur.bg); drawWord(g, cur, t);
  g.restore();
}
// DECISION shatters into strips that fly apart, revealing the grid scene below
function stripOut(g, src, t) {
  const n = 18, h = H / n, jit = inv(3.55, 3.72, t);
  for (let k = 0; k < n; k++) {
    const dir = k % 2 ? 1 : -1;
    const jx = (h3(k, Math.floor(t * 30), 3) - 0.5) * 90 * jit * (1 - inv(3.8, 3.9, t));
    const ex = dir * E.inExpo(inv(3.7 + (k % 6) * 0.018, 3.98, t)) * W * 1.15;
    g.drawImage(src, 0, k * h, W, h + 1, jx + ex, k * h, W, h + 1);
  }
}

// ═══ SCENE 2 · GEOMETRY (4.0 – 6.5) ══════════════════════════════════════
const GX = 10, GY = 6, CELL = 120;
const STAGE_COL = [CR.paper, CR.red, CR.yel, CR.blue, CR.paper, CR.red];
function s2cam(t) {
  const lt = t - 4;
  return {
    rot: -0.16 + 0.16 * E.inOutCubic(clamp(lt / 2.5)),
    zoom: lerp(1.4, 1.0, E.outExpo(clamp(lt / 1.3))) + 0.1 * E.inCubic(clamp((lt - 1.4) / 1.1)),
  };
}
function shapeR(s, th, rot) {
  const poly = (n, sc) => {
    const seg = TAU / n; const a = (((th - rot) % seg) + seg) % seg;
    return (sc * Math.cos(Math.PI / n)) / Math.cos(a - Math.PI / n);
  };
  switch (s) {
    case 1: return poly(4, 0.98);
    case 2: return poly(3, 1.12);
    case 3: return 0.5 + 0.55 * Math.pow(Math.abs(Math.cos(2.5 * (th - rot))), 2.2);
    default: return 0.8;
  }
}
function cellState(i, j, t) {
  const lt = t - 4, d = Math.hypot(i, j);
  const w = lt - d * 0.05;
  let sv = 0; for (const st of [0.5, 1.0, 1.5, 2.0]) sv += E.inOutExpo(inv(st, st + 0.32, w));
  const a = Math.min(Math.floor(sv), 4), f = sv - a, cb = (i + j) & 1;
  const pop = E.outBack(inv(0, 0.45, lt + 0.12 - d * 0.035));
  const shrink = E.inOutExpo(inv(5.95 + d * 0.015, 6.25 + d * 0.015, t));
  const col = mixc(STAGE_COL[a + cb], STAGE_COL[Math.min(a + 1 + cb, 5)], f);
  return { d, sv, a, f, cb, pop, shrink, col, w };
}
function cellScreen(i, j, cam) {
  const x = i * CELL * cam.zoom, y = j * CELL * cam.zoom, c = Math.cos(cam.rot), s = Math.sin(cam.rot);
  return [W / 2 + x * c - y * s, H / 2 + x * s + y * c];
}
function s2(g, t) {
  bg(g, C.ink);
  const lt = t - 4, cam = s2cam(t), bp = t >= 4 ? beatPulse(t, 7) : 0;
  // ripples on each beat
  for (let b = 0; b < 5; b++) {
    const p = inv(b * 0.5, b * 0.5 + 1.1, lt);
    if (p <= 0 || p >= 1) continue;
    g.strokeStyle = rgba(CR.paper, 0.35 * (1 - p)); g.lineWidth = 2 + 10 * (1 - p);
    circle(g, W / 2, H / 2, E.outExpo(p) * 1400); g.stroke();
  }
  const N = 40;
  for (let j = -GY; j <= GY; j++) for (let i = -GX; i <= GX; i++) {
    const st = cellState(i, j, t);
    if (st.pop <= 0) continue;
    const [sx, sy] = cellScreen(i, j, cam);
    const wave = 0.86 + 0.14 * Math.sin(st.d * 0.9 - lt * 7);
    const full = 46 * cam.zoom * st.pop * wave * (1 + 0.16 * bp * Math.exp(-st.d * 0.15));
    const R = lerp(full, 4 * cam.zoom, st.shrink);
    const rot = cam.rot + (st.sv * Math.PI) / 2 * (st.cb ? 1 : -1) - Math.PI / 2;
    const sA = st.a, sB = Math.min(st.a + 1, 4), f = st.shrink > 0 ? 0 : st.f;
    g.fillStyle = rgba(st.col);
    g.beginPath();
    for (let k = 0; k < N; k++) {
      const th = (k / N) * TAU;
      const rr = st.shrink > 0.5 ? 0.8 : lerp(shapeR(sA, th, rot), shapeR(sB, th, rot), f);
      const x = sx + Math.cos(th) * rr * R, y = sy + Math.sin(th) * rr * R;
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath(); g.fill();
  }
}

// ═══ SCENE 3 · PARTICLES (6.5 – 9.0) ═════════════════════════════════════
const NP = 4200;
const P = {
  x: new Float32Array(NP), y: new Float32Array(NP), vx: new Float32Array(NP), vy: new Float32Array(NP),
  tx: new Float32Array(NP), ty: new Float32Array(NP), r: new Float32Array(NP), c: new Uint8Array(NP),
  simT: -1, exploded: false, ready: false,
};
const PCOL = [C.paper, C.red, C.yel, C.blue];
function buildTargets() {
  const c = mk(), g = c.getContext('2d');
  g.fillStyle = '#fff'; g.font = font(330); g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('MOTION', W / 2, H / 2 - 20);
  const d = g.getImageData(0, 0, W, H).data, pts = [];
  for (let y = 0; y < H; y += 5) for (let x = 0; x < W; x += 5) if (d[(y * W + x) * 4 + 3] > 128) pts.push([x, y]);
  const r = mulberry32(5);
  for (let i = pts.length - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); [pts[i], pts[k]] = [pts[k], pts[i]]; }
  for (let i = 0; i < NP; i++) { const p = pts[i % pts.length]; P.tx[i] = p[0] + (r() - 0.5) * 3; P.ty[i] = p[1] + (r() - 0.5) * 3; }
}
function resetParticles() {
  const r = mulberry32(99), cam = s2cam(6.5);
  const cells = [];
  for (let j = -GY; j <= GY; j++) for (let i = -GX; i <= GX; i++) cells.push([i, j]);
  for (let n = 0; n < NP; n++) {
    const [i, j] = cells[n % cells.length], [sx, sy] = cellScreen(i, j, cam);
    P.x[n] = sx + (r() - 0.5) * 6; P.y[n] = sy + (r() - 0.5) * 6;
    const dx = sx - W / 2, dy = sy - H / 2, dl = Math.hypot(dx, dy) + 1;
    P.vx[n] = (dx / dl) * 60 * r(); P.vy[n] = (dy / dl) * 60 * r();
    P.r[n] = r();
    P.c[n] = r() < 0.62 ? ((i + j) & 1 ? 1 : 0) : 2 + (n % 2);
  }
  P.simT = 6.5; P.exploded = false;
}
function stepParticles(t, dt) {
  const flow = 1 - inv(7.3, 7.8, t);
  const K = E.inCubic(inv(7.3, 7.7, t)) * 280, D = 2 * Math.sqrt(K) * 0.72;
  const shimmer = inv(7.9, 8.2, t);
  if (t >= 8.5 && !P.exploded) {
    P.exploded = true;
    for (let i = 0; i < NP; i++) {
      const dx = P.x[i] - W / 2, dy = P.y[i] - H / 2, dl = Math.hypot(dx, dy) + 1, s = 700 + P.r[i] * 2600;
      P.vx[i] += (dx / dl) * s - (dy / dl) * 500; P.vy[i] += (dy / dl) * s + (dx / dl) * 500;
    }
  }
  for (let i = 0; i < NP; i++) {
    let ax = 0, ay = 0;
    if (P.exploded) { ax = -P.vx[i] * 0.5; ay = -P.vy[i] * 0.5; }
    else {
      if (flow > 0) {
        const [cx, cy] = curl(P.x[i] * 0.0021, P.y[i] * 0.0021, t * 0.45 + P.c[i] * 0.07);
        ax += (cx * 620 - P.vx[i]) * 3.5 * flow; ay += (cy * 620 - P.vy[i]) * 3.5 * flow;
      }
      if (K > 0) {
        const ox = Math.sin(t * 9 + P.r[i] * TAU) * 2.2 * shimmer, oy = Math.cos(t * 7 + P.r[i] * 40) * 2.2 * shimmer;
        ax += (P.tx[i] + ox - P.x[i]) * K - P.vx[i] * D; ay += (P.ty[i] + oy - P.y[i]) * K - P.vy[i] * D;
      }
    }
    P.vx[i] += ax * dt; P.vy[i] += ay * dt; P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt;
  }
}
function simTo(t) {
  if (!P.ready) { buildTargets(); P.ready = true; }
  if (P.simT < 0 || t < P.simT - 1e-6) resetParticles();
  const dt = 1 / 480;
  while (P.simT + dt <= t) { stepParticles(P.simT, dt); P.simT += dt; }
}
function drawParticles(g, t) {
  simTo(t);
  const fade = 1 - inv(8.8, 9.15, t);
  g.save(); g.globalCompositeOperation = 'lighter'; g.lineCap = 'round';
  for (let pass = 0; pass < 2; pass++) {
    g.lineWidth = pass ? 3.2 : 8; g.globalAlpha = (pass ? 0.95 : 0.12) * fade;
    for (let c = 0; c < 4; c++) {
      g.strokeStyle = PCOL[c]; g.beginPath();
      for (let i = 0; i < NP; i++) {
        if (P.c[i] !== c) continue;
        const k = P.exploded ? 0.03 : t < 7.5 ? 0.04 : 0.02;
        g.moveTo(P.x[i] - P.vx[i] * k - 0.01, P.y[i] - P.vy[i] * k); g.lineTo(P.x[i], P.y[i]);
      }
      g.stroke();
    }
  }
  g.restore();
}
function s3(g, t) {
  bg(g, C.ink);
  const pre = inv(8.65, 9.0, t);
  if (pre > 0) { g.save(); g.globalAlpha = pre; s4(g, t, true); g.restore(); }
  drawParticles(g, t);
  const cap = 'N=4200  ·  ONE CURL FIELD  ·  SPRING K=280';
  const ca = inv(7.6, 7.8, t) * (1 - inv(8.4, 8.5, t));
  if (ca > 0) {
    g.font = font(22, 'JB'); g.textAlign = 'center'; g.fillStyle = rgba(CR.paper, 0.75 * ca);
    g.fillText(scramble(cap, t, 7.6, 0.012), W / 2, H / 2 + 230); g.textAlign = 'left';
  }
}

// ═══ SCENE 4 · VELOCITY (9.0 – 11.5) ═════════════════════════════════════
const pathX = z => Math.sin(z * 0.23) * 0.55 + Math.sin(z * 0.071) * 0.45;
const pathY = z => Math.cos(z * 0.19) * 0.35;
const SPEED = (() => { const r = mulberry32(3); return Array.from({ length: 140 }, () => ({ a: r() * TAU, ph: r(), l: 0.1 + r() * 0.3, w: 1 + r() * 2.5 })); })();
function s4(g, t, underlay = false) {
  const lt = t - 9;
  const camZ = lt * 7 + Math.max(0, lt) ** 3 * 1.15;
  const surge = E.inCubic(inv(10.3, 11.5, t));
  if (!underlay) bg(g, C.ink);
  const bp = t >= 9 && t < 11.5 ? beatPulse(t, 8) : 0;
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(surge * 1.7 + Math.sin(t * 0.9) * 0.1);
  const f = 560, camX = pathX(camZ), camY = pathY(camZ);
  const i0 = Math.floor(camZ) + 1, n = 6;
  const rings = [];
  for (let i = i0 + 46; i >= i0; i--) {
    const z = i - camZ; if (z < 0.06) continue;
    const s = f / z, cx = (pathX(i) - camX) * s, cy = (pathY(i) - camY) * s;
    const rot = i * 0.13 + t * 0.5 + surge * i * 0.06;
    const v = []; for (let k = 0; k < n; k++) { const a = rot + (k / n) * TAU; v.push([cx + Math.cos(a) * s, cy + Math.sin(a) * s]); }
    const fog = Math.pow(clamp(1 - z / 46), 1.7) * clamp((z - 0.06) / 0.5);
    rings.push({ i, z, s, v, fog });
  }
  g.lineJoin = 'round';
  for (let r = 0; r < rings.length; r++) {
    const R = rings[r], nx = rings[r + 1];
    if (nx && nx.i === R.i - 1) {                        // longitudinal struts
      g.strokeStyle = rgba(CR.paper, 0.28 * R.fog); g.lineWidth = Math.min(8, 0.9 * R.s / 90);
      g.beginPath();
      for (let k = 0; k < n; k++) { g.moveTo(R.v[k][0], R.v[k][1]); g.lineTo(nx.v[k][0], nx.v[k][1]); }
      g.stroke();
    }
    const col = hex(PAL[((R.i % 4) + 4) % 4]);
    const band = R.i % 3 === 0;
    g.beginPath();
    R.v.forEach((p, k) => (k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath();
    if (band) {
      const inner = 0.8 - 0.1 * bp;
      const cx = R.v.reduce((s, p) => s + p[0], 0) / n, cy = R.v.reduce((s, p) => s + p[1], 0) / n;
      for (let k = n - 1; k >= 0; k--) { const x = cx + (R.v[k][0] - cx) * inner, y = cy + (R.v[k][1] - cy) * inner; k === n - 1 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.closePath();
      g.fillStyle = rgba(mixc(col, CR.paper, bp * 0.6), R.fog); g.fill('evenodd');
    } else {
      g.strokeStyle = rgba(col, R.fog * 0.9); g.lineWidth = Math.min(48, (R.s / 70) * (1 + bp)); g.stroke();
    }
  }
  // speed lines
  const sp = 0.8 + lt * 0.5 + surge * 3;
  g.lineCap = 'round';
  for (const L of SPEED) {
    const u = (((t * sp + L.ph) % 1) + 1) % 1, r0 = u * u * 1500, r1 = r0 + L.l * r0 * (1 + surge * 2);
    g.strokeStyle = rgba(CR.paper, 0.55 * u * (underlay ? 0.5 : 1)); g.lineWidth = L.w * u;
    g.beginPath(); g.moveTo(Math.cos(L.a) * r0, Math.sin(L.a) * r0); g.lineTo(Math.cos(L.a) * r1, Math.sin(L.a) * r1); g.stroke();
  }
  g.restore();
  // core glow
  const gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, 260 + 200 * bp);
  gr.addColorStop(0, rgba(CR.paper, 0.35 + 0.4 * surge)); gr.addColorStop(1, rgba(CR.paper, 0));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (!underlay) { g.fillStyle = rgba(CR.paper, E.inExpo(inv(11.15, 11.5, t))); g.fillRect(-200, -200, W + 400, H + 400); }
}

// ═══ SCENE 5 · CONSTRUCTION (11.5 – 13.5) ════════════════════════════════
function arcTo(g, x, y, r, a0, p) { g.beginPath(); g.arc(x, y, r, a0, a0 + TAU * p); }
function s5(g, t) {
  const lt = t - 11.5;
  bg(g, C.paper);
  const cx = W / 2, cy = H / 2 - 40, R = 250;
  const col = E.inExpo(inv(1.6, 2.0, lt));
  const ant = Math.sin(Math.PI * inv(1.38, 1.6, lt)) * 0.06;
  const sc = Math.max(0.0001, (1 + ant) * (1 - col));
  const solid = E.inOutCubic(inv(0.9, 1.3, lt));
  const guide = lerp(1, 0.22, solid);
  const ink = a => rgba(CR.ink, a);
  g.save(); g.translate(cx, cy); g.rotate(-col * 1.2); g.scale(sc, sc);
  g.lineCap = 'round';
  // crosshair + ruler ticks
  const hx = E.outExpo(inv(0.0, 0.7, lt)) * 1100, vy = E.outExpo(inv(0.06, 0.76, lt)) * 700;
  g.strokeStyle = ink(0.3 * guide); g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(-hx, 0); g.lineTo(hx, 0); g.moveTo(0, -vy); g.lineTo(0, vy); g.stroke();
  g.beginPath();
  for (let x = 40; x < hx; x += 40) { const h = x % 200 === 0 ? 14 : 6; g.moveTo(x, -h); g.lineTo(x, h); g.moveTo(-x, -h); g.lineTo(-x, h); }
  for (let y = 40; y < vy; y += 40) { const w = y % 200 === 0 ? 14 : 6; g.moveTo(-w, y); g.lineTo(w, y); g.moveTo(-w, -y); g.lineTo(w, -y); }
  g.stroke();
  // dashed construction circles
  g.setLineDash([6, 12]); g.lineDashOffset = -t * 80;
  g.strokeStyle = ink(0.45 * guide); g.lineWidth = 2;
  arcTo(g, 0, 0, R * 1.36, Math.PI, E.inOutCubic(inv(0.15, 0.8, lt))); g.stroke();
  arcTo(g, 0, 0, R * 0.5, 0, E.inOutCubic(inv(0.3, 0.8, lt))); g.stroke();
  g.setLineDash([]);
  // solid disc (sweep reveal)
  if (solid > 0) {
    g.fillStyle = C.ink; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + TAU * solid); g.closePath(); g.fill();
  }
  // main circle draw-on
  g.strokeStyle = C.ink; g.lineWidth = 3;
  arcTo(g, 0, 0, R, -Math.PI / 2, E.inOutCubic(inv(0.05, 0.62, lt))); g.stroke();
  // triangle
  const V = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6].map(a => [Math.cos(a) * R, Math.sin(a) * R]);
  const tri = solid > 0 ? E.outExpo(inv(1.05, 1.4, lt)) : 0;
  if (tri > 0) {
    g.save(); g.beginPath(); g.rect(-R, R - 2 * R * tri, 2 * R, 2 * R * tri + 10); g.clip();
    g.fillStyle = C.red; g.beginPath(); V.forEach((p, k) => (k ? g.lineTo(...p) : g.moveTo(...p))); g.closePath(); g.fill();
    g.restore();
  }
  const tp = E.inOutCubic(inv(0.25, 0.85, lt)) * 3;
  g.strokeStyle = solid > 0.5 ? C.paper : C.ink; g.lineWidth = 3;
  g.beginPath(); g.moveTo(...V[0]);
  for (let k = 0; k < 3; k++) {
    const e = clamp(tp - k); if (e <= 0) break;
    const a = V[k], b = V[(k + 1) % 3]; g.lineTo(lerp(a[0], b[0], e), lerp(a[1], b[1], e));
  }
  g.stroke();
  // annotations
  const an = inv(0.7, 0.9, lt) * guide;
  if (an > 0) {
    g.font = font(18, 'JB'); g.fillStyle = ink(0.8 * an); g.strokeStyle = ink(0.7 * an); g.lineWidth = 1.5;
    g.beginPath(); g.arc(V[0][0], V[0][1], 46, Math.PI / 3, (2 * Math.PI) / 3); g.stroke();
    g.textAlign = 'center'; g.fillText('60°', V[0][0], V[0][1] + 78);
    ['A', 'B', 'C'].forEach((l, k) => { const [x, y] = V[k]; g.fillText(l, x * 1.16, y * 1.16 + 6); });
    const da = -0.62, ex = Math.cos(da) * R, ey = Math.sin(da) * R, dp = E.outExpo(inv(0.72, 1.0, lt));
    g.beginPath(); g.moveTo(0, 0); g.lineTo(ex * dp, ey * dp); g.stroke();
    g.save(); g.translate(ex * 0.55, ey * 0.55); g.rotate(da); g.fillText(scramble('r = 250', t, 12.25, 0.02), 0, -12); g.restore();
    g.textAlign = 'left';
  }
  // vertex nodes
  V.forEach(([x, y], k) => {
    const p = E.outBack(inv(0.55 + k * 0.06, 0.85 + k * 0.06, lt));
    if (p <= 0) return;
    g.fillStyle = C.paper; g.strokeStyle = C.ink; g.lineWidth = 2.5; circle(g, x, y, 8 * p); g.fill(); g.stroke();
  });
  // orbiting satellites
  [C.blue, C.yel, C.red].forEach((c, k) => {
    const p = E.outBack(inv(1.0 + k * 0.07, 1.3 + k * 0.07, lt));
    if (p <= 0) return;
    const a = -Math.PI / 2 + (k * TAU) / 3 + E.inOutCubic(inv(1.0, 2.0, lt)) * TAU * 0.75;
    g.fillStyle = c; circle(g, Math.cos(a) * R * 1.36, Math.sin(a) * R * 1.36, 15 * p); g.fill();
  });
  g.restore();
  if (col > 0.85) { g.fillStyle = C.ink; circle(g, cx, cy, 12); g.fill(); }
  // typed code line
  const code = 'frame(t) => pixels;   // no keyframes were harmed';
  const n = Math.floor(clamp((lt - 0.3) / 1.0) * code.length);
  const ta = 1 - inv(1.5, 1.7, lt);
  if (ta > 0 && lt > 0.3) {
    g.font = font(24, 'JB'); g.fillStyle = ink(0.85 * ta); g.textAlign = 'left';
    const full = g.measureText(code).width, x = W / 2 - full / 2, y = H - 150;
    g.fillText(code.slice(0, n), x, y);
    if (Math.floor(t * 4) % 2 === 0 || n < code.length) g.fillRect(x + g.measureText(code.slice(0, n)).width + 3, y - 20, 12, 26);
  }
}

// ═══ SCENE 6 · SIGNATURE (13.5 – 15.0) ═══════════════════════════════════
function s6(g, t) {
  bg(g, C.paper);
  const lt = t - 13.5;
  if (lt < 0.1) { g.fillStyle = C.ink; circle(g, W / 2, H / 2 - 40, 12 * (1 - inv(0.05, 0.1, lt))); g.fill(); }
  // skewed panel stack sweeps across
  const cols = [C.red, C.yel, C.blue, C.ink];
  cols.forEach((c, k) => {
    const p = E.inOutExpo(inv(k * 0.06, k * 0.06 + 0.32, lt));
    if (p <= 0) return;
    const x = p * (W + 500) - 250;
    g.fillStyle = c; g.beginPath(); g.moveTo(-300, 0); g.lineTo(x + 250, 0); g.lineTo(x - 250, H); g.lineTo(-300, H); g.closePath(); g.fill();
  });
  if (lt < 0.5) return;
  const et = t - 14.0, pulse = t >= 14.5 ? Math.exp(-(t - 14.5) * 10) : 0;
  const word = 'CLAUDE', size = 250;
  g.save();
  g.font = font(size);
  const total = g.measureText(word).width, x0 = W / 2 - total / 2, base = H / 2 + 40;
  g.translate(W / 2, base - size * 0.35); g.scale(1 + 0.025 * pulse + 0.02 * et, 1 + 0.025 * pulse + 0.02 * et); g.translate(-W / 2, -(base - size * 0.35));
  g.save(); g.beginPath(); g.rect(0, base - size * 0.8, W, size * 0.84); g.clip();
  g.fillStyle = C.paper;
  for (let i = 0; i < word.length; i++) {
    const p = E.outExpo(inv(0, 0.55, et - i * 0.04));
    if (p <= 0) continue;
    g.fillText(word[i], x0 + g.measureText(word.slice(0, i)).width, base + (1 - p) * size);
  }
  g.restore();
  // accent bar
  const bw = E.outExpo(inv(0.18, 0.7, et)) * total;
  g.fillStyle = pulse > 0.3 ? C.paper : C.red; g.fillRect(x0, base + 36, bw, 14);
  g.fillStyle = C.yel; g.fillRect(x0 + bw, base + 36, 14 * inv(0.18, 0.3, et) * (1 - inv(0.6, 0.7, et)), 14);
  g.font = font(24, 'JB'); g.fillStyle = rgba(CR.paper, 0.8);
  g.fillText(scramble('MOTION STUDY NO.01  ·  900 FRAMES  ·  0 KEYFRAMES', t, 14.2, 0.008), x0, base + 100);
  g.restore();
  // iris close back to a single point
  const ir = E.inExpo(inv(14.7, 14.95, t));
  if (ir > 0) {
    g.save(); g.fillStyle = '#000'; g.beginPath(); g.rect(-200, -200, W + 400, H + 400);
    g.arc(W / 2, H / 2, Math.max(0.1, (1 - ir) * 1150), 0, TAU, true); g.fill('evenodd');
    g.strokeStyle = C.paper; g.lineWidth = 3; circle(g, W / 2, H / 2, (1 - ir) * 1150); g.stroke();
    g.restore();
    if (ir > 0.97 && t < 14.985) { g.fillStyle = C.paper; circle(g, W / 2, H / 2, 6); g.fill(); }
  }
}

// ═══ compositor ══════════════════════════════════════════════════════════
function drawScene(g, t) {
  if (t < 1.5) s0(g, t);
  else if (t < 4.0) {
    if (t < 3.55) s1(g, t);
    else { s2(g, t); tg.setTransform(1, 0, 0, 1, 0, 0); s1(tg, t); stripOut(g, TMP, t); }
  } else if (t < 6.5) s2(g, t);
  else if (t < 9.0) s3(g, t);
  else if (t < 11.5) s4(g, t);
  else if (t < 13.5) s5(g, t);
  else s6(g, t);
}
function caAmount(t) {
  let a = hit(t, 9) * 14;
  if (t > 3.55 && t < 4.0) a += 10 * inv(3.55, 3.75, t);
  if (t >= 6.5 && t < 9) a += 2;
  if (t >= 9 && t < 11.5) a += 3 + 16 * E.inCubic(inv(10.3, 11.4, t)) + 5 * beatPulse(t, 10);
  return a;
}
function chroma(dst, src, amt) {
  dst.globalCompositeOperation = 'source-over';
  if (amt < 0.35) { dst.drawImage(src, 0, 0); return; }
  const tints = ['#f00', '#0f0', '#00f'];
  CH.forEach((ch, k) => {
    ch.g.globalCompositeOperation = 'copy'; ch.g.drawImage(src, 0, 0);
    ch.g.globalCompositeOperation = 'multiply'; ch.g.fillStyle = tints[k]; ch.g.fillRect(0, 0, W, H);
  });
  dst.fillStyle = '#000'; dst.fillRect(0, 0, W, H);
  dst.globalCompositeOperation = 'lighter';
  [1 + (amt * 4) / W, 1 + (amt * 2) / W, 1].forEach((s, k) => dst.drawImage(CH[k].c, (W - W * s) / 2, (H - H * s) / 2, W * s, H * s));
  dst.globalCompositeOperation = 'source-over';
}
function renderSub(t) {
  const amp = 22 * hit(t, 10) + (t > 10.5 && t < 11.5 ? 6 * inv(10.5, 11.5, t) : 0);
  const dx = noise3(t * 35, 0.5, 1) * amp, dy = noise3(0.5, t * 35, 2) * amp;
  sg.setTransform(1, 0, 0, 1, dx, dy);
  sg.globalAlpha = 1; sg.globalCompositeOperation = 'source-over';
  drawScene(sg, t);
  sg.setTransform(1, 0, 0, 1, 0, 0);
  chroma(fg, SC, caAmount(t));
}
const GRAIN = [0, 1, 2].map(s => {
  const c = mk(256, 256), g = c.getContext('2d'), d = g.createImageData(256, 256), r = mulberry32(s + 40);
  for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
  g.putImageData(d, 0, 0); return octx.createPattern(c, 'repeat');
});
function hud(g, t) {
  const a = inv(0.3, 0.7, t) * (1 - inv(14.55, 14.75, t));
  if (a <= 0) return;
  g.save(); g.globalCompositeOperation = 'difference'; g.globalAlpha = a;
  g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.font = font(18, 'JB');
  const m = 48, L = 26;
  g.beginPath();
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
    g.moveTo(x, y + L * sy); g.lineTo(x, y); g.lineTo(x + L * sx, y);
  });
  g.stroke();
  const fr = Math.min(899, Math.floor(t * FPS));
  const tc = `00:${String(Math.floor(t)).padStart(2, '0')}:${String(Math.floor((t % 1) * FPS)).padStart(2, '0')}`;
  g.textBaseline = 'middle';
  g.fillText(scramble('CLAUDE / MOTION STUDY 01', t, 0.3, 0.02), m + 40, m + 12);
  g.textAlign = 'right'; g.fillText(`${tc}   FR ${String(fr).padStart(3, '0')}`, W - m - 40, m + 12);
  let li = 0; while (li + 1 < LABELS.length && t >= LABELS[li + 1][0]) li++;
  g.textAlign = 'left'; g.fillText(scramble(LABELS[li][1], t, LABELS[li][0], 0.02, 0.1), m + 40, H - m - 12);
  g.textAlign = 'right'; g.fillText('120 BPM', W - m - 40 - 4 * 22 - 16, H - m - 12);
  const bi = Math.floor(t / BEAT) % 4;
  for (let k = 0; k < 4; k++) {
    const x = W - m - 40 - (3 - k) * 22 - 12;
    k === bi ? g.fillRect(x, H - m - 20, 14, 14) : g.strokeRect(x + 1, H - m - 19, 12, 12);
  }
  // progress hairline
  g.fillRect(m + 40, H - m + 14, (W - 2 * m - 80) * (t / DUR), 2);
  g.restore();
}
function finish(g, t, seed) {
  hud(g, t);
  g.save();
  g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.09;
  const ox = Math.floor(h3(seed, 1, 1) * 256), oy = Math.floor(h3(seed, 2, 1) * 256);
  g.translate(-ox, -oy); g.fillStyle = GRAIN[seed % 3]; g.fillRect(0, 0, W + 256, H + 256);
  g.restore();
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
}
// Render a frame with temporal supersampling (true motion blur, 180° shutter).
function renderFrame(f, sub = 4) {
  const t = f / FPS;
  if (f >= DUR * FPS - 1) { octx.fillStyle = '#000'; octx.fillRect(0, 0, W, H); return; }
  if (sub <= 1) { renderSub(t); octx.drawImage(FR, 0, 0); }
  else {
    for (let k = 0; k < sub; k++) {
      renderSub(t + ((k + 0.5) / sub - 0.5) * (0.5 / FPS));
      ag.globalAlpha = 1 / (k + 1); ag.drawImage(FR, 0, 0);
    }
    ag.globalAlpha = 1; octx.drawImage(ACC, 0, 0);
  }
  finish(octx, t, f);
}

// ═══ SOUNDTRACK · synthesized, beat-locked to the picture ════════════════
function buildAudio(ctx, T0 = 0) {
  const r = mulberry32(2026), sr = ctx.sampleRate;
  const at = x => T0 + x;
  const master = ctx.createGain(); master.gain.value = 0.9;
  master.gain.setValueAtTime(0.9, at(14.6)); master.gain.linearRampToValueAtTime(0, at(15));
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.ratio.value = 5; comp.attack.value = 0.002; comp.release.value = 0.12; comp.knee.value = 6;
  master.connect(comp); comp.connect(ctx.destination);
  const ir = ctx.createBuffer(2, sr * 2.6, sr);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / d.length, 3.2); }
  const rev = ctx.createConvolver(); rev.buffer = ir; const revG = ctx.createGain(); revG.gain.value = 0.5; rev.connect(revG); revG.connect(master);
  const nb = ctx.createBuffer(1, sr * 2, sr); { const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = r() * 2 - 1; }
  function bus(node, { v = 1, wet = 0, pan = 0 } = {}) {
    const p = ctx.createStereoPanner(); p.pan.value = pan; const g = ctx.createGain(); g.gain.value = v;
    node.connect(g); g.connect(p); p.connect(master);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(rev); }
    return p;
  }
  function envG(t0, a, peak, d) {
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at(t0));
    g.gain.linearRampToValueAtTime(peak, at(t0 + a)); g.gain.exponentialRampToValueAtTime(0.0001, at(t0 + a + d)); return g;
  }
  function noise(t0, dur) { const s = ctx.createBufferSource(); s.buffer = nb; s.loop = true; s.start(at(t0), r() * 1.5); s.stop(at(t0 + dur)); return s; }
  function osc(type, f, t0, dur) { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(at(t0)); o.stop(at(t0 + dur)); return o; }
  function filt(type, f, q = 0.7) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; }

  const kick = (t0, v = 1) => {
    const o = osc('sine', 150, t0, 0.5); o.frequency.setValueAtTime(170, at(t0)); o.frequency.exponentialRampToValueAtTime(44, at(t0 + 0.12));
    const g = envG(t0, 0.002, v, 0.42); o.connect(g); bus(g);
    const n = noise(t0, 0.02), hp = filt('highpass', 2500), g2 = envG(t0, 0.001, 0.3 * v, 0.015); n.connect(hp); hp.connect(g2); bus(g2);
  };
  const clap = (t0, v = 0.5) => {
    const n = noise(t0, 0.4), bp = filt('bandpass', 1500, 1.2), g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at(t0));
    [0, 0.011, 0.022].forEach(o => { g.gain.setValueAtTime(v, at(t0 + o)); g.gain.exponentialRampToValueAtTime(v * 0.3, at(t0 + o + 0.009)); });
    g.gain.setValueAtTime(v, at(t0 + 0.03)); g.gain.exponentialRampToValueAtTime(0.0001, at(t0 + 0.26));
    n.connect(bp); bp.connect(g); bus(g, { wet: 0.35 });
  };
  const hat = (t0, v = 0.16, d = 0.04) => { const n = noise(t0, d + 0.02), hp = filt('highpass', 8000), g = envG(t0, 0.001, v, d); n.connect(hp); hp.connect(g); bus(g, { pan: (r() - 0.5) * 0.6 }); };
  const bass = (t0, f, dur, v = 0.35) => {
    const o = osc('sawtooth', f, t0, dur + 0.05), s = osc('sine', f / 2, t0, dur + 0.05), lp = filt('lowpass', 800, 4);
    lp.frequency.setValueAtTime(1400, at(t0)); lp.frequency.exponentialRampToValueAtTime(160, at(t0 + dur));
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at(t0)); g.gain.linearRampToValueAtTime(v, at(t0 + 0.06));
    g.gain.setValueAtTime(v, at(t0 + dur - 0.03)); g.gain.linearRampToValueAtTime(0.0001, at(t0 + dur));
    const sg2 = ctx.createGain(); sg2.gain.value = 0.9; o.connect(lp); lp.connect(g); s.connect(sg2); sg2.connect(g); bus(g);
  };
  const pluck = (t0, f, v = 0.18, pan = 0, wet = 0.4) => {
    const o = osc('square', f, t0, 0.5), lp = filt('lowpass', 4000, 2);
    lp.frequency.setValueAtTime(5000, at(t0)); lp.frequency.exponentialRampToValueAtTime(500, at(t0 + 0.18));
    const g = envG(t0, 0.002, v, 0.3); o.connect(lp); lp.connect(g); bus(g, { pan, wet });
  };
  const bell = (t0, f, v = 0.12, pan = 0) => {
    const o = osc('sine', f, t0, 2), m = osc('sine', f * 3.5, t0, 2), mg = ctx.createGain(); mg.gain.value = f * 1.5;
    mg.gain.exponentialRampToValueAtTime(1, at(t0 + 1)); m.connect(mg); mg.connect(o.frequency);
    const g = envG(t0, 0.003, v, 1.6); o.connect(g); bus(g, { pan, wet: 0.7 });
  };
  const riser = (t0, t1, v = 0.35) => {
    const n = noise(t0, t1 - t0), bp = filt('bandpass', 300, 3);
    bp.frequency.setValueAtTime(250, at(t0)); bp.frequency.exponentialRampToValueAtTime(9000, at(t1));
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at(t0)); g.gain.exponentialRampToValueAtTime(v, at(t1 - 0.02)); g.gain.linearRampToValueAtTime(0, at(t1));
    n.connect(bp); bp.connect(g); bus(g, { wet: 0.4 });
    const o = osc('sawtooth', 110, t0, t1 - t0); o.frequency.exponentialRampToValueAtTime(880, at(t1));
    const lp = filt('lowpass', 2000), g2 = ctx.createGain(); g2.gain.setValueAtTime(0.0001, at(t0)); g2.gain.exponentialRampToValueAtTime(v * 0.25, at(t1 - 0.02)); g2.gain.linearRampToValueAtTime(0, at(t1));
    o.connect(lp); lp.connect(g2); bus(g2, { wet: 0.3 });
  };
  const impact = (t0, v = 0.9) => {
    kick(t0, v);
    const s = osc('sine', 80, t0, 1.6); s.frequency.exponentialRampToValueAtTime(28, at(t0 + 1.2));
    const g = envG(t0, 0.005, v * 0.8, 1.3); s.connect(g); bus(g);
    const n = noise(t0, 1.8), lp = filt('lowpass', 7000); lp.frequency.exponentialRampToValueAtTime(180, at(t0 + 1.5));
    const g2 = envG(t0, 0.002, v * 0.45, 1.6); n.connect(lp); lp.connect(g2); bus(g2, { wet: 0.6 });
  };
  const whoosh = (t0, d, v = 0.25, p0 = -0.8, p1 = 0.8) => {
    const n = noise(t0, d), bp = filt('bandpass', 400, 1.5);
    bp.frequency.setValueAtTime(350, at(t0)); bp.frequency.exponentialRampToValueAtTime(4500, at(t0 + d * 0.6)); bp.frequency.exponentialRampToValueAtTime(600, at(t0 + d));
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at(t0)); g.gain.linearRampToValueAtTime(v, at(t0 + d * 0.6)); g.gain.linearRampToValueAtTime(0.0001, at(t0 + d));
    const p = ctx.createStereoPanner(); p.pan.setValueAtTime(p0, at(t0)); p.pan.linearRampToValueAtTime(p1, at(t0 + d));
    n.connect(bp); bp.connect(g); g.connect(p); p.connect(master); const w = ctx.createGain(); w.gain.value = 0.3; g.connect(w); w.connect(rev);
  };
  const tick = (t0, f = 2400, v = 0.08, pan = 0) => { const o = osc('sine', f, t0, 0.05), g = envG(t0, 0.001, v, 0.035); o.connect(g); bus(g, { pan, wet: 0.15 }); };

  const A = 110, notes = { A: 110, F: 87.31, C: 130.81, G: 98, D: 146.83, E: 82.41 };
  const penta = [220, 261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880];

  // 00 ORIGIN
  bell(0.1, 880, 0.1); riser(0.05, 1.0, 0.4);
  [0.35, 0.55, 0.7, 0.8, 0.87, 0.92, 0.96].forEach((x, i) => tick(x, 1600 + i * 250, 0.06));
  impact(1.0, 1); whoosh(1.15, 0.4, 0.3);
  // 01 KINETIC TYPE
  for (let b = 1.5; b < 4.0; b += 0.5) kick(b, 0.95);
  [2.0, 3.0].forEach(x => clap(x));
  WORDS.forEach(wd => { for (let i = 0; i < wd.w.length; i++) tick(wd.t + i * 0.035 + 0.05, 1800 + i * 180, 0.07, (i / wd.w.length - 0.5)); });
  [[1.5, 'A'], [2.0, 'A'], [2.5, 'F'], [3.0, 'C'], [3.5, 'G']].forEach(([t0, n]) => { bass(t0, notes[n], 0.24); bass(t0 + 0.25, notes[n] * 2, 0.22, 0.25); });
  whoosh(3.3, 0.35, 0.2);
  for (let x = 3.55; x < 3.95; x += 0.03) tick(x, x * 1000 % 2 > 1 ? 1200 : 700, 0.07, (r() - 0.5) * 1.6);
  riser(3.5, 4.0, 0.3);
  // 02 GEOMETRY
  impact(4.0, 0.9);
  for (let b = 4.0; b < 6.5; b += 0.5) { kick(b, 0.95); hat(b + 0.25); }
  clap(5.0); clap(6.0);
  for (let s = 0; s < 20; s++) { const t0 = 4.0 + s * 0.125; pluck(t0, penta[(s * 3) % 7 + (s % 4 === 3 ? 3 : 0)], 0.1, s % 2 ? 0.4 : -0.4); }
  [[4.0, 'A'], [4.5, 'A'], [5.0, 'F'], [5.5, 'F'], [6.0, 'C']].forEach(([t0, n]) => { bass(t0, notes[n], 0.24); bass(t0 + 0.25, notes[n], 0.22, 0.3); });
  for (let k = 0; k < 8; k++) pluck(5.95 + k * 0.05, penta[10 - k], 0.07, 0, 0.6);
  // 03 PARTICLES
  impact(6.5, 0.7); whoosh(6.4, 0.6, 0.3, 0.8, -0.8);
  for (let b = 6.5; b < 8.5; b += 0.5) { kick(b, 0.9); hat(b + 0.25, 0.14); hat(b + 0.125, 0.06); hat(b + 0.375, 0.06); }
  [[6.5, 'G'], [7.0, 'G'], [7.5, 'A'], [8.0, 'A']].forEach(([t0, n]) => bass(t0, notes[n], 0.45, 0.3));
  for (let s = 0; s < 36; s++) bell(6.6 + r() * 1.6, penta[5 + Math.floor(r() * 6)] * 2, 0.025, r() * 1.6 - 0.8);
  { const o = osc('sine', 220, 7.3, 0.7); o.frequency.exponentialRampToValueAtTime(880, at(7.8)); const g = envG(7.3, 0.4, 0.08, 0.3); o.connect(g); bus(g, { wet: 0.6 }); }
  [440, 523.25, 659.25, 987.77].forEach((f, i) => bell(7.8 + i * 0.03, f, 0.08, (i - 1.5) * 0.4));
  impact(8.5, 0.6); riser(8.5, 9.0, 0.35);
  for (let k = 0; k < 8; k++) clap(8.5 + k * 0.0625, 0.12 + k * 0.03);
  // 04 VELOCITY
  impact(9.0, 1);
  for (let b = 9.0; b < 11.5; b += 0.5) { kick(b, 1); for (let s = 1; s < 4; s++) hat(b + s * 0.125, s === 2 ? 0.16 : 0.07); }
  [9.5, 10.5].forEach(x => clap(x, 0.55));
  for (let e = 0; e < 20; e++) { const t0 = 9.0 + e * 0.125, n = [notes.A, notes.A, notes.C, notes.D][Math.floor(e / 4) % 4]; bass(t0, n * (e % 2 ? 2 : 1), 0.11, 0.3); }
  riser(10.4, 11.5, 0.5);
  { let x = 10.5, step = 0.125; while (x < 11.45) { clap(x, 0.1 + (x - 10.5) * 0.35); x += step; if (x > 11.0) step = 0.0625; if (x > 11.25) step = 0.03125; } }
  // 05 CONSTRUCTION — breakdown
  impact(11.5, 0.8);
  [220, 261.63, 329.63, 392, 493.88].forEach((f, i) => {
    [-6, 6].forEach(dt => {
      const o = osc('sawtooth', f, 11.5, 2.2); o.detune.value = dt; const lp = filt('lowpass', 900);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at(11.5)); g.gain.linearRampToValueAtTime(0.035, at(11.9)); g.gain.linearRampToValueAtTime(0.0001, at(13.55));
      o.connect(lp); lp.connect(g); bus(g, { wet: 0.7, pan: (i - 2) * 0.25 });
    });
  });
  [11.5, 11.56, 11.75, 12.05, 12.11, 12.17].forEach((x, i) => tick(x, 2800 - i * 200, 0.06));
  [12.5, 12.57, 12.64].forEach((x, i) => pluck(x, [659.25, 783.99, 880][i], 0.12, (i - 1) * 0.6, 0.6));
  for (let i = 0; i < 44; i++) tick(11.8 + i * (1.0 / 44), 3200 + r() * 1400, 0.018, 0.3);
  bell(12.4, 440, 0.06); bell(12.9, 329.63, 0.05);
  riser(12.9, 13.5, 0.3);
  // 06 SIGNATURE
  impact(13.5, 0.8);
  [0, 0.06, 0.12, 0.18].forEach((o, k) => whoosh(13.45 + o, 0.36, 0.18, -0.9 + k * 0.3, 0.9));
  kick(13.75, 0.8);
  impact(14.0, 1);
  [110, 220, 261.63, 329.63, 440].forEach((f, i) => {
    const o = osc('sawtooth', f, 14.0, 1.0), lp = filt('lowpass', 3000); lp.frequency.exponentialRampToValueAtTime(300, at(14.9));
    const g = envG(14.0, 0.005, 0.06, 0.95); o.connect(lp); lp.connect(g); bus(g, { wet: 0.6, pan: (i - 2) * 0.3 });
  });
  for (let i = 0; i < 6; i++) tick(14.05 + i * 0.04, 2000 + i * 200, 0.06, (i - 2.5) * 0.3);
  impact(14.5, 0.9); clap(14.5, 0.5); bell(14.5, 880, 0.08);
  whoosh(14.65, 0.3, 0.2, 0.5, 0);
}
async function renderAudioWav() {
  const sr = 48000, ctx = new OfflineAudioContext(2, sr * DUR, sr);
  buildAudio(ctx, 0);
  const buf = await ctx.startRendering();
  const n = buf.length, L = buf.getChannelData(0), R = buf.getChannelData(1);
  const dv = new DataView(new ArrayBuffer(44 + n * 4));
  const w = (o, s) => [...s].forEach((ch, i) => dv.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVE'); w(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true); dv.setUint32(24, sr, true);
  dv.setUint32(28, sr * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const norm = peak > 0.98 ? 0.98 / peak : 1;
  for (let i = 0; i < n; i++) {
    dv.setInt16(44 + i * 4, clamp(L[i] * norm, -1, 1) * 32767, true);
    dv.setInt16(46 + i * 4, clamp(R[i] * norm, -1, 1) * 32767, true);
  }
  const bytes = new Uint8Array(dv.buffer); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// ═══ bootstrap ═══════════════════════════════════════════════════════════
window.ready = Promise.all(['100px "Archivo Black"', '24px "JB"'].map(f => document.fonts.load(f)));
window.renderFrame = renderFrame;
window.frameDataURL = (f, sub) => { renderFrame(f, sub); return out.toDataURL('image/png'); };
window.renderAudioWav = renderAudioWav;

if (!new URLSearchParams(location.search).has('render')) {
  // live preview: click to play with sound, loops
  let start = null, actx = null;
  window.ready.then(() => { renderFrame(0, 1); });
  const loop = now => {
    if (start === null) return;
    const t = ((actx ? actx.currentTime - start : (now / 1000 - start)) % DUR + DUR) % DUR;
    renderFrame(Math.floor(t * FPS), 1);
    requestAnimationFrame(loop);
  };
  out.addEventListener('click', async () => {
    await window.ready;
    actx = actx || new AudioContext();
    start = actx.currentTime + 0.05;
    for (let k = 0; k < 4; k++) buildAudio(actx, start + k * DUR);
    requestAnimationFrame(loop);
  });
}
