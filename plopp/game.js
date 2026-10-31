'use strict';
(() => {
// =============================================================
//  PLOPP – Daily Golf   (2D-Minigolf, Hochformat, Touch)
// =============================================================
const $ = s => document.querySelector(s);
const cv = $('#c'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(3, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  fitCamera();
}
addEventListener('resize', resize);

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hyp = Math.hypot;

// ---------------- Save ----------------
const KEY = 'plopp_v1';
const defSave = () => ({ coins: 0, lv: { stop: 1 }, best: {}, unlocked: 0, daily: {}, streak: 0, lastDaily: -1, muted: false, holes: 0, hio: 0 });
let save = defSave();
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) save = Object.assign(defSave(), s); } catch (e) {}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };

// ---------------- Sound (Synth) ----------------
const Snd = {
  ac: null,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  },
  tone(f, d, type = 'sine', v = .2, slide = 0) {
    if (!this.ac || save.muted) return;
    const t = this.ac.currentTime, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g).connect(this.ac.destination); o.start(t); o.stop(t + d + .02);
  },
  noise(d, v = .2, f = 1200) {
    if (!this.ac || save.muted) return;
    const len = Math.floor(this.ac.sampleRate * d), b = this.ac.createBuffer(1, len, this.ac.sampleRate), c = b.getChannelData(0);
    for (let i = 0; i < len; i++) c[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ac.createBufferSource(), fl = this.ac.createBiquadFilter(), g = this.ac.createGain();
    s.buffer = b; fl.type = 'lowpass'; fl.frequency.value = f; g.gain.value = v;
    s.connect(fl).connect(g).connect(this.ac.destination); s.start();
  },
  hit(p) { this.tone(420 + p * 300, .07, 'triangle', .25, -200); this.noise(.04, .15, 3000); },
  bounce(p) { this.tone(240 + p * 120, .05, 'square', .05 + p * .06, -60); },
  plop() { this.tone(700, .09, 'sine', .3, -500); setTimeout(() => this.tone(1040, .18, 'sine', .2, 300), 110); },
  splash() { this.noise(.45, .3, 900); },
  sand() { this.noise(.12, .12, 600); },
  power() { this.tone(520, .15, 'sine', .15, 500); },
  coin() { [880, 1320].forEach((f, i) => setTimeout(() => this.tone(f, .12, 'triangle', .15), i * 80)); },
};
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

// ---------------- Geometrie ----------------
const R = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
function RR(cx, cy, w, h, a) { // gedrehtes Rechteck um Mittelpunkt
  const c = Math.cos(a), s = Math.sin(a), hw = w / 2, hh = h / 2;
  return [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c]);
}
function inPoly(x, y, p) {
  let ins = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i], [xj, yj] = p[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
}
function closestOnSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1);
  return [ax + dx * t, ay + dy * t];
}
function distToPolyEdge(x, y, p) {
  let m = 1e9;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; const [cx, cy] = closestOnSeg(x, y, a[0], a[1], b[0], b[1]); m = Math.min(m, hyp(x - cx, y - cy)); }
  return m;
}
const inZone = (x, y, z) => z.c ? hyp(x - z.c[0], y - z.c[1]) < z.c[2] : inPoly(x, y, z.p);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// ---------------- Fähigkeiten ----------------
const SKILLS = [
  { id: 'stop', ic: '✋', name: 'Stopp', d: 'Hält den Ball sofort an. Perfekt, wenn er zu weit rollt.', cost: [0, 60, 150] },
  { id: 'hop', ic: '⤴️', name: 'Sprung', d: 'Der Ball hüpft über Wände, Wasser und Sand.', cost: [50, 120, 240] },
  { id: 'ghost', ic: '👻', name: 'Geist', d: 'Der Ball rollt kurz durch Wände hindurch.', cost: [80, 160, 300] },
  { id: 'turbo', ic: '⚡', name: 'Turbo', d: 'Schiesst den Ball mit mehr Tempo weiter.', cost: [60, 130, 260] },
  { id: 'magnet', ic: '🧲', name: 'Magnet', d: 'Das Loch zieht den Ball für den Rest des Schlags an.', cost: [120, 220, 380] },
  { id: 'aim', ic: '🎯', name: 'Umlenken', d: 'Ball anhalten und gratis neu zielen – ohne Extraschlag.', cost: [150, 260, 420] },
];
const SK = Object.fromEntries(SKILLS.map(s => [s.id, s]));
const lvl = id => save.lv[id] || 0;

// ---------------- Farben ----------------
const THEMES = [
  { bg: '#eef1ea', field: '#8cc56f', dark: '#79b35d', wall: '#fbfbf5', sh: '#5f9a48' },
  { bg: '#e8f0ee', field: '#6fbf9b', dark: '#5eab88', wall: '#fbfbf5', sh: '#4b8f70' },
  { bg: '#f1efe4', field: '#a9c25f', dark: '#97b04f', wall: '#fffdf3', sh: '#7f963c' },
  { bg: '#f3ece6', field: '#e0a77f', dark: '#d1956c', wall: '#fff8f1', sh: '#b97a54' },
  { bg: '#e9edf3', field: '#86a9d6', dark: '#7598c6', wall: '#fbfcff', sh: '#5d7fae' },
  { bg: '#efe9f1', field: '#b796cf', dark: '#a684bf', wall: '#fdfaff', sh: '#8a68a6' },
];
const COL = { water: '#5fb8dc', waterD: '#4ea6cb', sand: '#efdca2', sandD: '#e2cb88', ice: '#dff3f9', bump: '#ff8a65', ramp: '#ffcf5a', boost: '#ffe082' };

// ---------------- Löcher (Feld 100 x 160) ----------------
const HOLES = [
  { n: 'Erster Schlag', par: 2, o: R(22, 10, 56, 140), tee: [50, 136], cup: [50, 30], hint: 'Zurückziehen, zielen, loslassen' },
  { n: 'Über Bande', par: 2, o: R(15, 10, 70, 140), tee: [50, 136], cup: [50, 30], w: [R(28, 72, 44, 8)], hint: 'Spiel über die Bande' },
  { n: 'Knick', par: 3, o: [[10, 10], [90, 10], [90, 54], [46, 54], [46, 150], [10, 150]], tee: [28, 136], cup: [74, 30], hint: 'Rollt er zu weit? Tipp auf ✋' },
  { n: 'Sandkasten', par: 2, o: R(15, 10, 70, 140), tee: [50, 138], cup: [50, 26], z: [{ t: 'sand', c: [50, 82, 15] }, { t: 'sand', p: R(15, 40, 18, 22) }, { t: 'sand', p: R(67, 40, 18, 22) }] },
  { n: 'Der Teich', par: 3, o: R(10, 10, 80, 140), tee: [50, 138], cup: [50, 26], z: [{ t: 'water', p: R(10, 68, 33, 22) }, { t: 'water', p: R(57, 68, 33, 22) }], hint: 'Wasser kostet einen Strafschlag' },
  { n: 'Flipper', par: 2, o: R(15, 10, 70, 140), tee: [50, 138], cup: [50, 26], b: [[34, 60, 5], [66, 60, 5], [50, 84, 5], [34, 108, 5], [66, 108, 5]] },
  { n: 'Eisbahn', par: 3, o: R(15, 10, 70, 140), tee: [28, 138], cup: [70, 26], z: [{ t: 'ice', p: R(15, 40, 70, 80) }], w: [R(15, 96, 46, 5), R(39, 60, 46, 5)] },
  { n: 'Schräglage', par: 2, o: R(15, 10, 70, 140), tee: [50, 138], cup: [42, 26], z: [{ t: 'slope', p: R(15, 48, 70, 62), d: [1, 0], a: 55 }] },
  { n: 'Mühle', par: 3, o: [[10, 10], [90, 10], [90, 60], [62, 74], [62, 86], [90, 100], [90, 150], [10, 150], [10, 100], [38, 86], [38, 74], [10, 60]], tee: [50, 138], cup: [50, 26], m: [{ x: 50, y: 80, w: 9, h: 9, ax: 10, ay: 0, p: 2.2 }] },
  { n: 'Schanze', par: 3, o: R(20, 6, 60, 148), tee: [50, 142], cup: [50, 24], z: [{ t: 'water', p: R(20, 56, 60, 30) }, { t: 'ramp', p: R(40, 94, 20, 10), d: [0, -1] }], hint: 'Mit Tempo über die Schanze!' },
  { n: 'Spirale', par: 4, o: R(10, 10, 80, 140), tee: [80, 140], cup: [48, 75], w: [R(30, 55, 40, 4), R(66, 55, 4, 40), R(30, 91, 40, 4), R(10, 118, 55, 4)] },
  { n: 'Insel', par: 3, o: R(10, 10, 80, 140), tee: [50, 140], cup: [50, 42], z: [{ t: 'safe', c: [50, 42, 9] }, { t: 'safe', p: R(46, 42, 8, 30) }, { t: 'water', c: [50, 42, 25] }] },
  { n: 'Schikane', par: 3, o: R(15, 10, 70, 140), tee: [25, 140], cup: [26, 28], w: [R(15, 114, 50, 4), R(35, 84, 50, 4), R(15, 54, 50, 4)] },
  { n: 'Doppelmühle', par: 3, o: R(15, 10, 70, 140), tee: [50, 140], cup: [50, 24], m: [{ x: 50, y: 62, w: 30, h: 6, ax: 20, ay: 0, p: 3 }, { x: 50, y: 100, w: 30, h: 6, ax: -20, ay: 0, p: 2.4 }] },
  { n: 'Wüste', par: 3, o: [[10, 150], [10, 40], [30, 10], [90, 10], [90, 52], [46, 52], [46, 150]], tee: [28, 140], cup: [74, 28], z: [{ t: 'sand', c: [28, 84, 9] }, { t: 'sand', c: [58, 34, 7] }, { t: 'slope', p: R(10, 56, 36, 30), d: [0, 1], a: 35 }] },
  { n: 'Kanone', par: 2, o: R(15, 10, 70, 140), tee: [30, 140], cup: [30, 30], w: [R(15, 76, 54, 5)], z: [{ t: 'boost', p: R(69, 64, 16, 26), d: [0, -1], a: 420 }] },
  { n: 'Labyrinth', par: 4, o: R(10, 10, 80, 140), tee: [80, 142], cup: [22, 24], w: [R(10, 122, 62, 4), R(28, 96, 62, 4), R(10, 70, 62, 4), R(28, 44, 62, 4)], b: [[50, 109, 3.5], [50, 57, 3.5]] },
  { n: 'Finale', par: 3, o: R(10, 5, 80, 150), tee: [50, 146], cup: [50, 22], z: [{ t: 'water', p: R(10, 50, 80, 24) }, { t: 'ramp', p: R(42, 82, 16, 9), d: [0, -1] }, { t: 'slope', p: R(10, 98, 80, 28), d: [-1, 0], a: 45 }], b: [[30, 32, 5], [70, 32, 5]] },
];

// ---------------- Tagesloch-Generator ----------------
const DAY0 = Date.UTC(2026, 0, 1);
const dayNum = () => { const d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - DAY0) / 864e5) + 1; };
function genDaily(n) {
  const r = rng(n * 7919 + 1337), ri = (a, b) => a + r() * (b - a), pick = a => a[Math.floor(r() * a.length)];
  const T = [
    { o: R(12, 8, 76, 144), tee: [50, 140], cup: [ri(28, 72), 24], bend: 0 },
    { o: [[10, 8], [90, 8], [90, 58], [50, 58], [50, 152], [10, 152]], tee: [30, 140], cup: [72, 28], bend: 1 },
    { o: [[10, 8], [90, 8], [90, 58], [66, 72], [66, 88], [90, 102], [90, 152], [10, 152], [10, 102], [34, 88], [34, 72], [10, 58]], tee: [50, 140], cup: [50, 24], bend: 0 },
    { o: [[30, 8], [70, 8], [92, 40], [92, 120], [70, 152], [30, 152], [8, 120], [8, 40]], tee: [50, 140], cup: [ri(36, 64), 24], bend: 0 },
    { o: [[10, 8], [60, 8], [60, 60], [90, 60], [90, 152], [40, 152], [40, 100], [10, 100]], tee: [65, 140], cup: [35, 28], bend: 1 },
  ];
  const t = pick(T), mir = r() < .5;
  const mx = p => mir ? [100 - p[0], p[1]] : p;
  const h = { n: 'Tagesloch #' + n, daily: true, o: t.o.map(mx), tee: mx(t.tee), cup: mx(t.cup), w: [], z: [], b: [], m: [] };
  const placed = []; // {x,y,r} Hindernis-Inseln (müssen Abstand halten → immer lösbar)
  const okSpot = (x, y, rad, solid) => {
    if (!inPoly(x, y, h.o)) return false;
    if (hyp(x - h.tee[0], y - h.tee[1]) < rad + 14 || hyp(x - h.cup[0], y - h.cup[1]) < rad + 12) return false;
    if (distToPolyEdge(x, y, h.o) < rad + (solid ? 10 : 2)) return false;
    for (const p of placed) if (hyp(x - p.x, y - p.y) < rad + p.r + (solid && p.s ? 10 : 3)) return false;
    return true;
  };
  const kinds = ['wall', 'wall', 'wall', 'block', 'bump', 'bump', 'water', 'water', 'sand', 'sand', 'slope', 'ice', 'mover'];
  const count = 3 + Math.floor(r() * 4);
  let solids = 0;
  for (let k = 0; k < count; k++) {
    const kind = pick(kinds);
    for (let tries = 0; tries < 60; tries++) {
      const x = ri(14, 86), y = ri(36, 124);
      if (kind === 'wall') { const len = ri(18, 34), a = pick([0, 0, Math.PI / 2, ri(-.6, .6)]); const rad = len / 2 + 2; if (!okSpot(x, y, rad, 1)) continue; h.w.push(RR(x, y, len, 4.5, a)); placed.push({ x, y, r: rad, s: 1 }); solids++; break; }
      if (kind === 'block') { const s = ri(8, 13), rad = s * .72; if (!okSpot(x, y, rad, 1)) continue; h.w.push(RR(x, y, s, s, pick([0, Math.PI / 4]))); placed.push({ x, y, r: rad, s: 1 }); solids++; break; }
      if (kind === 'bump') { const s = ri(4, 6); if (!okSpot(x, y, s, 1)) continue; h.b.push([x, y, s]); placed.push({ x, y, r: s, s: 1 }); solids++; break; }
      if (kind === 'water') { const s = ri(7, 12); if (!okSpot(x, y, s, 1)) continue; h.z.push({ t: 'water', c: [x, y, s] }); placed.push({ x, y, r: s, s: 1 }); solids++; break; }
      if (kind === 'sand') { const s = ri(7, 12); if (!okSpot(x, y, s, 0)) continue; h.z.push({ t: 'sand', c: [x, y, s] }); placed.push({ x, y, r: s }); break; }
      if (kind === 'ice') { const s = ri(9, 14); if (!okSpot(x, y, s, 0)) continue; h.z.push({ t: 'ice', c: [x, y, s] }); placed.push({ x, y, r: s }); break; }
      if (kind === 'slope') { const ww = ri(22, 34), hh = ri(16, 26); if (!okSpot(x, y, Math.max(ww, hh) / 2, 0)) continue; h.z.push({ t: 'slope', p: R(x - ww / 2, y - hh / 2, ww, hh), d: pick([[1, 0], [-1, 0], [0, 1]]), a: ri(30, 50) }); placed.push({ x, y, r: Math.max(ww, hh) / 2 }); break; }
      if (kind === 'mover') { if (!okSpot(x, y, 14, 1)) continue; h.m.push({ x, y, w: 8, h: 8, ax: pick([10, -10]), ay: 0, p: ri(1.8, 3) }); placed.push({ x, y, r: 14, s: 1 }); solids++; break; }
    }
  }
  h.par = clamp(2 + t.bend + (solids >= 4 ? 1 : 0), 2, 5);
  h.theme = n % THEMES.length;
  return h;
}

// ---------------- Spielzustand ----------------
const BR = 2.1, CUP_R = 3.3, MAXV = 230;
let hole = null, holeIdx = -1, token = 0, mode = 'menu', theme = THEMES[0];
let ball = { x: 0, y: 0, vx: 0, vy: 0, z: 0 };
let state = 'idle'; // aim | roll | splash | sink | done
let strokes = 0, shotOrigin = [0, 0], charges = {}, effects = {}, freeShot = false, slowT = 0, stateT = 0, time = 0;
let segs = [], movers = [], parts = [], trail = [];
let drag = null; // {sx,sy,x,y}
const cam = { s: 1, ox: 0, oy: 0 };

function bbox(p) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, y] of p) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); } return [a, b, c, d]; }
function fitCamera() {
  if (!hole) return;
  const [x0, y0, x1, y1] = bbox(hole.o);
  const top = 78 + safeTop(), bot = 92 + safeBot();
  const aw = W - 24, ah = H - top - bot;
  cam.s = Math.min(aw / (x1 - x0 + 6), ah / (y1 - y0 + 6));
  cam.ox = W / 2 - (x0 + x1) / 2 * cam.s;
  cam.oy = top + ah / 2 - (y0 + y1) / 2 * cam.s;
}
function safeVal(v) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;height:' + v; document.body.appendChild(d); const h = d.offsetHeight; d.remove(); return h; }
let _st = null, _sb = null;
const safeTop = () => _st ?? (_st = safeVal('env(safe-area-inset-top,0px)'));
const safeBot = () => _sb ?? (_sb = safeVal('env(safe-area-inset-bottom,0px)'));
const toScreen = (x, y) => [cam.ox + x * cam.s, cam.oy + y * cam.s];
const toWorld = (x, y) => [(x - cam.ox) / cam.s, (y - cam.oy) / cam.s];

function loadHole(h, idx) {
  hole = h; holeIdx = idx; token++;
  hole.w = hole.w || []; hole.z = hole.z || []; hole.b = hole.b || []; hole.m = hole.m || [];
  theme = THEMES[h.theme ?? (idx % THEMES.length)];
  document.querySelector('meta[name=theme-color]').content = theme.bg;
  movers = hole.m.map(m => ({ ...m, cx: m.x, cy: m.y, vx: 0, vy: 0, ph: m.ph || 0 }));
  ball = { x: h.tee[0], y: h.tee[1], vx: 0, vy: 0, z: 0 };
  strokes = 0; shotOrigin = [...h.tee]; parts = []; trail = []; effects = {}; freeShot = false;
  charges = {};
  for (const s of SKILLS) charges[s.id] = h.daily ? 1 : lvl(s.id);
  state = 'aim'; stateT = 0; time = 0;
  fitCamera(); buildBar(); updHud();
  setHint(h.hint || (h.daily ? 'Ein Versuch zählt – viel Glück!' : ''));
}
function staticSegs() {
  const s = [];
  const add = (p, outer) => { for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s.push([a[0], a[1], b[0], b[1], outer]); } };
  add(hole.o, 1); for (const w of hole.w) add(w, 0);
  return s;
}

// ---------------- Physik ----------------
function moverPoly(m) { return R(m.cx - m.w / 2, m.cy - m.h / 2, m.w, m.h); }
function updMovers(dt) {
  for (const m of movers) {
    const k = TAU / m.p, s = Math.sin(time * k + m.ph), c = Math.cos(time * k + m.ph);
    m.cx = m.x + m.ax * s; m.cy = m.y + m.ay * s;
    m.vx = m.ax * k * c; m.vy = m.ay * k * c;
  }
}
function collideSeg(ax, ay, bx, by, mvx = 0, mvy = 0, rest = .72) {
  const [px, py] = closestOnSeg(ball.x, ball.y, ax, ay, bx, by);
  let nx = ball.x - px, ny = ball.y - py; const d = hyp(nx, ny);
  if (d >= BR || d < 1e-6) return;
  nx /= d; ny /= d; ball.x = px + nx * BR; ball.y = py + ny * BR;
  const rvx = ball.vx - mvx, rvy = ball.vy - mvy, vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    ball.vx -= (1 + rest) * vn * nx; ball.vy -= (1 + rest) * vn * ny;
    if (-vn > 15) { Snd.bounce(clamp(-vn / 200, 0, 1)); if (-vn > 80) buzz(8); }
  }
}
function insideSolid(x, y) {
  for (const w of hole.w) if (inPoly(x, y, w)) return w;
  for (const m of movers) { const p = moverPoly(m); if (inPoly(x, y, p)) return p; }
  return null;
}
function escapeSolid() {
  const p = insideSolid(ball.x, ball.y); if (!p) return;
  let best = null, bd = 1e9;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; const c = closestOnSeg(ball.x, ball.y, a[0], a[1], b[0], b[1]); const d = hyp(c[0] - ball.x, c[1] - ball.y); if (d < bd) { bd = d; best = c; } }
  const dx = best[0] - ball.x, dy = best[1] - ball.y, l = hyp(dx, dy) || 1;
  ball.x = best[0] + dx / l * (BR + .2); ball.y = best[1] + dy / l * (BR + .2);
}
function zonesAt(x, y) {
  const r = { water: false, sand: false, ice: false, safe: false, acc: [0, 0], ramp: null, boost: false };
  for (const z of hole.z) {
    if (!inZone(x, y, z)) continue;
    if (z.t === 'slope' || z.t === 'boost') { r.acc[0] += z.d[0] * z.a; r.acc[1] += z.d[1] * z.a; if (z.t === 'boost') r.boost = true; }
    else if (z.t === 'ramp') r.ramp = z;
    else r[z.t] = true;
  }
  if (r.safe) r.water = false;
  return r;
}
function startHop(dur, h) { effects.hop = { t: 0, dur, h }; }
let lowT = 0;
function step(h) {
  const air = ball.z > 0 || !!effects.hop;
  const zn = zonesAt(ball.x, ball.y);
  // Effekte
  if (effects.hop) {
    const e = effects.hop; e.t += h; const p = e.t / e.dur;
    ball.z = p >= 1 ? 0 : 4 * e.h * p * (1 - p);
    if (p >= 1) { delete effects.hop; ball.vx *= .5; ball.vy *= .5; escapeSolid(); Snd.bounce(.4); puff(ball.x, ball.y, '#ffffff', 5); }
  }
  if (effects.ghost) { effects.ghost.t -= h; if (effects.ghost.t <= 0 && !insideSolid(ball.x, ball.y)) delete effects.ghost; }
  let sp = hyp(ball.vx, ball.vy);
  // Reibung
  let k = .85, dec = 13;
  if (air) { k = .05; dec = 0; }
  else if (zn.sand) { k = 3.4; dec = 45; if (sp > 30 && Math.random() < .3) puff(ball.x, ball.y, COL.sandD, 1); }
  else if (zn.ice) { k = .18; dec = 2; }
  const ns = Math.max(0, sp * Math.exp(-k * h) - dec * h);
  if (sp > 0) { ball.vx *= ns / sp; ball.vy *= ns / sp; }
  if (!air) {
    ball.vx += zn.acc[0] * h; ball.vy += zn.acc[1] * h;
    if (zn.ramp && sp > 45) {
      const dot = (ball.vx * zn.ramp.d[0] + ball.vy * zn.ramp.d[1]) / (sp || 1);
      if (dot > .3) { startHop(clamp(58 / sp, .3, .7), 6 + sp / 30); Snd.power(); }
    }
  }
  if (effects.magnet && !air) {
    const dx = hole.cup[0] - ball.x, dy = hole.cup[1] - ball.y, d = hyp(dx, dy);
    if (d < 70 && d > .5) { const a = (110 + 40 * lvl('magnet')) / (1 + d * .03); ball.vx += dx / d * a * h; ball.vy += dy / d * a * h; }
  }
  // Cup-Sog nahe am Loch
  if (!air) {
    const dx = hole.cup[0] - ball.x, dy = hole.cup[1] - ball.y, d = hyp(dx, dy);
    if (d < CUP_R + 2 && d > .1) { ball.vx += dx / d * 60 * h; ball.vy += dy / d * 60 * h; }
  }
  ball.x += ball.vx * h; ball.y += ball.vy * h;
  // Kollisionen
  const passWalls = air || !!effects.ghost;
  for (const s of segs) if (s[4] || !passWalls) collideSeg(s[0], s[1], s[2], s[3]);
  if (!passWalls) {
    for (const m of movers) { const p = moverPoly(m); for (let i = 0; i < 4; i++) { const a = p[i], b = p[(i + 1) % 4]; collideSeg(a[0], a[1], b[0], b[1], m.vx, m.vy, .8); } }
  }
  if (!air) for (const [bx, by, br] of hole.b) {
    let nx = ball.x - bx, ny = ball.y - by; const d = hyp(nx, ny), md = br + BR;
    if (d < md && d > 1e-6) {
      nx /= d; ny /= d; ball.x = bx + nx * md; ball.y = by + ny * md;
      const vn = ball.vx * nx + ball.vy * ny;
      if (vn < 0) { ball.vx -= 2.15 * vn * nx; ball.vy -= 2.15 * vn * ny; const s2 = hyp(ball.vx, ball.vy); if (s2 < 60) { ball.vx += nx * 40; ball.vy += ny * 40; } Snd.tone(660, .08, 'triangle', .18, 300); buzz(10); bumpFx(bx, by, br); }
    }
  }
  if (air) return;
  // Loch
  const cd = hyp(ball.x - hole.cup[0], ball.y - hole.cup[1]);
  sp = hyp(ball.vx, ball.vy);
  if (cd < CUP_R) {
    if (sp < 100 || effects.magnet) { sink(); return; }
    if (cd < CUP_R * .7) { const a = (Math.random() - .5) * 1.2, c = Math.cos(a), s = Math.sin(a); const vx = ball.vx; ball.vx = (vx * c - ball.vy * s) * .7; ball.vy = (vx * s + ball.vy * c) * .7; Snd.bounce(.5); }
  }
  // Wasser
  if (zn.water) { splash(); return; }
  // Stillstand
  if (sp < 4) lowT += h; else lowT = 0;
  if ((sp < 2.2 && !zn.acc[0] && !zn.acc[1]) || lowT > .7) { ball.vx = ball.vy = 0; stopped(); }
}

function shoot(vx, vy, pw) {
  Snd.init();
  if (!freeShot) strokes++;
  freeShot = false;
  shotOrigin = [ball.x, ball.y];
  ball.vx = vx; ball.vy = vy; lowT = 0;
  effects = {};
  state = 'roll'; stateT = 0;
  Snd.hit(pw); buzz(12);
  setHint(''); updHud(); buildBar();
}
function stopped() {
  state = 'aim'; effects = {};
  const max = Math.max(hole.par + 5, 8);
  if (strokes >= max) { finish(false); return; }
  buildBar();
}
function sink() {
  state = 'sink'; stateT = 0; effects = {};
  ball.vx = ball.vy = 0; Snd.plop(); buzz([20, 40, 30]);
  for (let i = 0; i < 26; i++) { const a = Math.random() * TAU, s = 20 + Math.random() * 60; parts.push({ x: hole.cup[0], y: hole.cup[1], vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, max: 1, c: ['#fff', '#ffd54f', '#ff8a65', '#81d4fa'][i % 4], r: .9 + Math.random() }); }
  const tk = token; setTimeout(() => { if (tk === token && mode === 'play') finish(true); }, 750);
}
function splash() {
  state = 'splash'; stateT = 0; effects = {};
  ball.vx = ball.vy = 0; Snd.splash(); buzz(30);
  for (let i = 0; i < 16; i++) { const a = Math.random() * TAU, s = 10 + Math.random() * 35; parts.push({ x: ball.x, y: ball.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .7, max: .7, c: '#e8f7fd', r: .8 + Math.random() * .8 }); }
  parts.push({ ring: 1, x: ball.x, y: ball.y, life: .8, max: .8, c: '#e8f7fd' });
  toast('+1 Wasser');
  const tk = token;
  setTimeout(() => {
    if (tk !== token || mode !== 'play') return;
    strokes++; ball.x = shotOrigin[0]; ball.y = shotOrigin[1]; ball.z = 0;
    updHud(); stopped();
  }, 800);
}
function puff(x, y, c, n) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 5 + Math.random() * 15; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .45, max: .45, c, r: .6 + Math.random() * .6 }); } }
function bumpFx(x, y, r) { parts.push({ ring: 1, x, y, r0: r, life: .35, max: .35, c: COL.bump }); }

// ---------------- Fähigkeiten auslösen ----------------
function useSkill(id) {
  if (state !== 'roll' || !(charges[id] > 0)) { if (state === 'aim') setHint('Fähigkeiten wirken, während der Ball rollt'); return; }
  const L = hole.daily ? 1 : Math.max(1, lvl(id));
  const sp = hyp(ball.vx, ball.vy);
  if (id === 'stop') { ball.vx = ball.vy = 0; puff(ball.x, ball.y, '#ffffff', 6); Snd.tone(300, .12, 'square', .1, -150); }
  else if (id === 'hop') { if (effects.hop) return; startHop(.5 + .12 * L, 7 + 1.5 * L); if (sp < 40) { const s = sp || 1; ball.vx = ball.vx / s * 40; ball.vy = ball.vy / s * 40; } Snd.power(); }
  else if (id === 'ghost') { effects.ghost = { t: .9 + .4 * L }; Snd.tone(300, .4, 'sine', .15, 400); }
  else if (id === 'turbo') { const f = 1.35 + .15 * L; ball.vx *= f; ball.vy *= f; if (sp < 30) { const s = sp || 1; ball.vx = ball.vx / s * 90; ball.vy = ball.vy / s * 90; } Snd.tone(200, .25, 'sawtooth', .1, 600); puff(ball.x, ball.y, '#fff3c4', 8); }
  else if (id === 'magnet') { effects.magnet = true; Snd.tone(180, .5, 'sine', .15, 200); }
  else if (id === 'aim') { if (effects.hop) return; ball.vx = ball.vy = 0; effects = {}; freeShot = true; state = 'aim'; Snd.tone(880, .15, 'sine', .15, -300); setHint('Gratis-Schlag: neu zielen'); }
  else return;
  charges[id]--; buzz(15);
  if (id === 'stop') { lowT = 1; }
  buildBar();
}

// ---------------- Input ----------------
const DRAG_MAX = () => Math.min(W, H) * .38;
cv.addEventListener('pointerdown', e => {
  Snd.init();
  if (mode !== 'play' || state !== 'aim') return;
  drag = { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId };
  try { cv.setPointerCapture(e.pointerId); } catch (_) {}
});
cv.addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id) { drag.x = e.clientX; drag.y = e.clientY; } });
const endDrag = e => {
  if (!drag || e.pointerId !== drag.id) return;
  const a = aimVec(); drag = null;
  if (a && state === 'aim' && a.p > .04) shoot(a.dx * a.p * MAXV, a.dy * a.p * MAXV, a.p);
};
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', () => { drag = null; });
function aimVec() {
  if (!drag) return null;
  const dx = drag.sx - drag.x, dy = drag.sy - drag.y, l = hyp(dx, dy);
  if (l < 6) return null;
  return { dx: dx / l, dy: dy / l, p: clamp(l / DRAG_MAX(), 0, 1) };
}

// ---------------- Loop ----------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(.033, (now - last) / 1000); last = now;
  if (mode === 'play') update(dt);
  render();
  requestAnimationFrame(frame);
}
function update(dt) {
  time += dt; stateT += dt;
  updMovers(dt);
  if (state === 'roll') {
    const sp = hyp(ball.vx, ball.vy);
    const n = clamp(Math.ceil(sp * dt / (BR * .4)), 2, 40);
    for (let i = 0; i < n && state === 'roll'; i++) step(dt / n);
    if (state === 'roll') { trail.push([ball.x, ball.y - ball.z, effects.ghost ? 1 : effects.magnet ? 2 : 0]); if (trail.length > 18) trail.shift(); }
  } else if (trail.length) trail.shift();
  // Ball von Mühlen schieben, wenn er ruht
  if (state === 'aim' && movers.length) {
    const ox = ball.x, oy = ball.y;
    for (const m of movers) { const p = moverPoly(m); for (let i = 0; i < 4; i++) { const a = p[i], b = p[(i + 1) % 4]; collideSeg(a[0], a[1], b[0], b[1], 0, 0, 0); } }
    for (const s of segs) collideSeg(s[0], s[1], s[2], s[3], 0, 0, 0);
    ball.vx = ball.vy = 0;
    if (hyp(ball.x - ox, ball.y - oy) > .01 && zonesAt(ball.x, ball.y).water) splash();
  }
  for (const p of parts) { p.life -= dt; if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .92; p.vy *= .92; } }
  parts = parts.filter(p => p.life > 0);
}

// ---------------- Rendering ----------------
function path(p) { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); }
function zonePath(z) { if (z.c) { ctx.beginPath(); ctx.arc(z.c[0], z.c[1], z.c[2], 0, TAU); } else path(z.p); }
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = mode === 'play' ? theme.bg : '#eef1ea';
  ctx.fillRect(0, 0, W, H);
  if (mode !== 'play' || !hole) return;
  ctx.setTransform(DPR * cam.s, 0, 0, DPR * cam.s, DPR * cam.ox, DPR * cam.oy);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const SH = 1.6;
  // Feld-Schatten + Feld
  ctx.fillStyle = theme.sh; ctx.strokeStyle = theme.sh; ctx.lineWidth = 2.6; ctx.save(); ctx.translate(0, SH); path(hole.o); ctx.fill(); ctx.stroke(); ctx.restore();
  ctx.fillStyle = theme.field; path(hole.o); ctx.fill();
  ctx.save(); path(hole.o); ctx.clip();
  // dezente Streifen
  const stripes = () => { ctx.fillStyle = theme.dark; ctx.globalAlpha = .28; for (let y = -10; y < 170; y += 16) ctx.fillRect(-10, y, 120, 8); ctx.globalAlpha = 1; };
  stripes();
  // Zonen
  for (const z of hole.z) {
    if (z.t === 'safe') continue;
    if (z.t === 'water') {
      ctx.fillStyle = COL.waterD; zonePath(z); ctx.fill();
      ctx.save(); ctx.translate(0, .9); ctx.fillStyle = COL.water; zonePath(z); ctx.fill(); ctx.restore();
      ctx.save(); zonePath(z); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = .7;
      for (let i = 0; i < 6; i++) { const yy = 10 + i * 27 + Math.sin(time + i) * 2; ctx.beginPath(); for (let x = 0; x <= 100; x += 4) ctx.lineTo(x, yy + Math.sin(x * .25 + time * 2 + i) * .8); ctx.stroke(); }
      ctx.restore();
    } else if (z.t === 'sand') { ctx.fillStyle = COL.sandD; zonePath(z); ctx.fill(); ctx.save(); ctx.translate(0, .7); ctx.fillStyle = COL.sand; zonePath(z); ctx.fill(); ctx.restore(); }
    else if (z.t === 'ice') { ctx.fillStyle = COL.ice; zonePath(z); ctx.fill(); ctx.save(); zonePath(z); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = .8; for (let i = -160; i < 160; i += 14) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + 160, 160); ctx.stroke(); } ctx.restore(); }
    else if (z.t === 'slope' || z.t === 'boost' || z.t === 'ramp') {
      const isB = z.t !== 'slope';
      ctx.fillStyle = z.t === 'slope' ? 'rgba(0,0,0,.07)' : z.t === 'ramp' ? COL.ramp : COL.boost;
      zonePath(z); ctx.fill();
      ctx.save(); zonePath(z); ctx.clip();
      const [x0, y0, x1, y1] = z.c ? [z.c[0] - z.c[2], z.c[1] - z.c[2], z.c[0] + z.c[2], z.c[1] + z.c[2]] : bbox(z.p);
      const [dx, dy] = z.d, off = ((time * (isB ? 18 : 8)) % 8);
      ctx.strokeStyle = isB ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.35)'; ctx.lineWidth = isB ? 1.4 : 1.1;
      for (let gx = x0 + 4; gx < x1; gx += 8) for (let gy = y0 + 4; gy < y1; gy += 8) {
        const cx = gx + dx * (off - 4), cy = gy + dy * (off - 4);
        ctx.beginPath(); ctx.moveTo(cx - dx * 1.5 - dy * 1.8, cy - dy * 1.5 + dx * 1.8); ctx.lineTo(cx + dx * 1.5, cy + dy * 1.5); ctx.lineTo(cx - dx * 1.5 + dy * 1.8, cy - dy * 1.5 - dx * 1.8); ctx.stroke();
      }
      ctx.restore();
    }
  }
  for (const z of hole.z) if (z.t === 'safe') { ctx.save(); zonePath(z); ctx.clip(); ctx.fillStyle = theme.field; ctx.fillRect(-10, -10, 120, 180); stripes(); ctx.restore(); }
  ctx.restore();
  // Rand
  ctx.strokeStyle = theme.wall; ctx.lineWidth = 2.6; path(hole.o); ctx.stroke();
  // Loch
  const [cx, cy] = hole.cup;
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.arc(cx, cy, CUP_R + .9, 0, TAU); ctx.fill();
  ctx.fillStyle = '#2b3329'; ctx.beginPath(); ctx.arc(cx, cy, CUP_R, 0, TAU); ctx.fill();
  if (effects.magnet) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = .6; for (let i = 0; i < 3; i++) { const r = CUP_R + ((time * 14 + i * 7) % 21); ctx.globalAlpha = 1 - (r - CUP_R) / 21; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); } ctx.globalAlpha = 1; }
  // Wände
  const solids = hole.w.concat(movers.map(moverPoly));
  ctx.fillStyle = theme.sh; for (const w of solids) { ctx.save(); ctx.translate(0, SH); path(w); ctx.fill(); ctx.lineWidth = .6; ctx.strokeStyle = theme.sh; ctx.stroke(); ctx.restore(); }
  ctx.fillStyle = theme.wall; ctx.strokeStyle = theme.wall; ctx.lineWidth = .6;
  for (const w of solids) { path(w); ctx.fill(); ctx.stroke(); }
  // Bumper
  for (const [bx, by, br] of hole.b) {
    ctx.fillStyle = '#d96a48'; ctx.beginPath(); ctx.arc(bx, by + 1, br, 0, TAU); ctx.fill();
    ctx.fillStyle = COL.bump; ctx.beginPath(); ctx.arc(bx, by, br, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(bx, by, br * .45, 0, TAU); ctx.fill();
  }
  // Flagge
  if (state !== 'sink') {
    const near = hyp(ball.x - cx, ball.y - cy) < 14;
    ctx.globalAlpha = near ? .35 : 1;
    ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + 6, cy + 2); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx, cy - 14); ctx.stroke();
    const wv = Math.sin(time * 4) * .8;
    ctx.fillStyle = '#ff6b5a'; ctx.beginPath(); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx + 7, cy - 12 + wv); ctx.lineTo(cx, cy - 9.5); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Abschlag-Markierung
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(hole.tee[0], hole.tee[1], 1.2, 0, TAU); ctx.fill();
  // Zielhilfe
  const a = state === 'aim' ? aimVec() : null;
  if (a) drawAim(a);
  // Spur
  for (let i = 0; i < trail.length; i++) {
    const [tx, ty, k] = trail[i], f = i / trail.length;
    ctx.fillStyle = k === 1 ? 'rgba(200,220,255,' + f * .5 + ')' : k === 2 ? 'rgba(255,220,120,' + f * .5 + ')' : 'rgba(255,255,255,' + f * .35 + ')';
    ctx.beginPath(); ctx.arc(tx, ty, BR * f * .9, 0, TAU); ctx.fill();
  }
  // Ball
  if (state !== 'splash' || stateT < .05) {
    let s = 1, al = 1;
    if (state === 'sink') { s = Math.max(0, 1 - stateT * 2.2); ball.x += (cx - ball.x) * .25; ball.y += (cy - ball.y) * .25; }
    if (effects.ghost) al = .45 + Math.sin(time * 20) * .1;
    const z = ball.z;
    ctx.fillStyle = 'rgba(0,0,0,' + (0.22 - Math.min(.12, z * .01)) + ')';
    ctx.beginPath(); ctx.ellipse(ball.x + .5 + z * .25, ball.y + .9 + z * .35, BR * s * (1 + z * .02), BR * s * .8, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = al;
    const r = BR * s * (1 + z * .045);
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(ball.x, ball.y - z, r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.arc(ball.x + r * .25, ball.y - z + r * .25, r * .7, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Partikel
  for (const p of parts) {
    const f = p.life / p.max;
    if (p.ring) { ctx.strokeStyle = p.c; ctx.globalAlpha = f; ctx.lineWidth = .8; ctx.beginPath(); ctx.arc(p.x, p.y, (p.r0 || 1) + (1 - f) * 8, 0, TAU); ctx.stroke(); }
    else { ctx.fillStyle = p.c; ctx.globalAlpha = f; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (.5 + f * .5), 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
function rayHit(ox, oy, dx, dy, maxL) {
  let best = maxL, nrm = null;
  const walls = segs.concat(movers.flatMap(m => { const p = moverPoly(m); return p.map((a, i) => [a[0], a[1], p[(i + 1) % 4][0], p[(i + 1) % 4][1]]); }));
  for (const [ax, ay, bx, by] of walls) {
    // Segment um BR nach aussen versetzen: vereinfachte Kapsel-Probe
    const ex = bx - ax, ey = by - ay, den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    let nx = -ey, ny = ex; const nl = hyp(nx, ny); nx /= nl; ny /= nl;
    if (nx * dx + ny * dy > 0) { nx = -nx; ny = -ny; }
    const sx = ax + nx * BR, sy = ay + ny * BR;
    const t = ((sx - ox) * ey - (sy - oy) * ex) / den, u = ((sx - ox) * dy - (sy - oy) * dx) / den;
    if (t > .01 && t < best && u >= 0 && u <= 1) { best = t; nrm = [nx, ny]; }
  }
  for (const [bx, by, br] of hole.b) {
    const fx = ox - bx, fy = oy - by, rr = br + BR, b = fx * dx + fy * dy, c = fx * fx + fy * fy - rr * rr, disc = b * b - c;
    if (disc > 0) { const t = -b - Math.sqrt(disc); if (t > .01 && t < best) { best = t; const hx = ox + dx * t - bx, hy = oy + dy * t - by, l = hyp(hx, hy); nrm = [hx / l, hy / l]; } }
  }
  return { t: best, n: nrm };
}
function drawAim(a) {
  const L = 14 + a.p * 70;
  const col = a.p < .5 ? '#ffffff' : a.p < .85 ? '#fff1a8' : '#ffb199';
  const pts = [];
  let ox = ball.x, oy = ball.y, dx = a.dx, dy = a.dy, rem = L;
  for (let k = 0; k < 2 && rem > 0; k++) {
    const h = rayHit(ox, oy, dx, dy, rem);
    pts.push([ox, oy, ox + dx * h.t, oy + dy * h.t]);
    if (!h.n) break;
    ox += dx * h.t; oy += dy * h.t; rem = Math.min(rem - h.t, 24);
    const d = dx * h.n[0] + dy * h.n[1]; dx -= 2 * d * h.n[0]; dy -= 2 * d * h.n[1];
  }
  ctx.fillStyle = col;
  let acc = 0;
  for (const [x0, y0, x1, y1] of pts) {
    const len = hyp(x1 - x0, y1 - y0);
    for (let s = (4 - acc % 4) % 4; s < len; s += 4) { const t = s / len, g = (acc + s) / L; ctx.globalAlpha = 1 - g * .75; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, .95 - g * .4, 0, TAU); ctx.fill(); }
    acc += len;
  }
  ctx.globalAlpha = 1;
  // Kraftring
  ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.arc(ball.x, ball.y, BR + 3, 0, TAU); ctx.stroke();
  ctx.strokeStyle = col; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(ball.x, ball.y, BR + 3, -Math.PI / 2, -Math.PI / 2 + TAU * a.p); ctx.stroke();
}

// ---------------- UI ----------------
const hud = $('#hud'), bar = $('#bar'), hint = $('#hint'), toastEl = $('#toast');
let toastT = 0;
function toast(t) { toastEl.textContent = t; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), 1100); }
function setHint(t) { hint.textContent = t; hint.style.opacity = t ? 1 : 0; }
function updHud() {
  $('#hudTitle').textContent = hole.daily ? hole.n : 'Loch ' + (holeIdx + 1) + ' · ' + hole.n;
  $('#hudSub').textContent = 'Par ' + hole.par;
  $('#strokes').textContent = strokes;
}
function buildBar() {
  const avail = SKILLS.filter(s => hole.daily || lvl(s.id) > 0);
  bar.innerHTML = avail.map(s => {
    const n = charges[s.id] || 0, can = state === 'roll' && n > 0 && !(s.id === 'magnet' && effects.magnet);
    return `<button class="ab ${can ? '' : 'off'}" data-s="${s.id}" aria-label="${s.name}">${s.ic}<span class="n ${n ? '' : 'z'}">${n}</span></button>`;
  }).join('');
}
bar.addEventListener('pointerdown', e => { const b = e.target.closest('.ab'); if (!b) return; e.preventDefault(); Snd.init(); useSkill(b.dataset.s); });
let barState = '';
setInterval(() => { if (mode === 'play') { const k = state + JSON.stringify(effects.magnet || 0); if (k !== barState) { barState = k; buildBar(); } } }, 120);

const SCORE_NAMES = { '-4': 'Kondor', '-3': 'Albatros', '-2': 'Eagle', '-1': 'Birdie', '0': 'Par', '1': 'Bogey', '2': 'Doppel-Bogey', '3': 'Triple-Bogey' };
function scoreName(s, par) { if (s === 1) return 'Hole-in-One!'; const d = s - par; return SCORE_NAMES[d] || (d > 0 ? '+' + d : String(d)); }
function coinsFor(s, par) { if (s === 1) return 60; const d = s - par; return d <= -2 ? 40 : d === -1 ? 25 : d === 0 ? 15 : d === 1 ? 8 : 3; }
const fmtDiff = d => d === 0 ? 'E' : (d > 0 ? '+' + d : String(d));

function finish(holed) {
  if (state === 'done') return;
  state = 'done';
  const s = holed ? strokes : strokes + 1;
  let coins = 0, sub = s + (s === 1 ? ' Schlag' : ' Schläge') + ' · Par ' + hole.par;
  let first = false;
  if (hole.daily) {
    const n = dayNum();
    if (save.daily[n] == null) {
      first = true; save.daily[n] = s;
      save.streak = save.lastDaily === n - 1 ? save.streak + 1 : 1; save.lastDaily = n;
      coins = coinsFor(s, hole.par) * 2 + 10;
      sub += ' · 🔥 ' + save.streak + (save.streak === 1 ? ' Tag' : ' Tage');
    } else sub += ' · Übungsrunde';
  } else {
    const prev = save.best[holeIdx];
    coins = coinsFor(s, hole.par);
    if (prev != null && prev <= s) coins = Math.ceil(coins / 3);
    if (prev == null || s < prev) save.best[holeIdx] = s;
    if (holed && holeIdx >= save.unlocked) save.unlocked = Math.min(HOLES.length - 1, holeIdx + 1);
    if (holed && holeIdx === HOLES.length - 1) save.unlocked = HOLES.length;
  }
  if (!holed) coins = 0;
  save.coins += coins; save.holes++; if (holed && s === 1) save.hio++;
  persist();
  if (coins) setTimeout(() => Snd.coin(), 250);
  $('#rName').textContent = holed ? scoreName(s, hole.par) : 'Zu viele Schläge';
  $('#rName').style.color = holed && s <= hole.par ? 'var(--acc)' : holed ? 'var(--ink)' : '#d0743c';
  $('#rSub').textContent = sub;
  $('#rCoins').textContent = '+' + coins + ' 🪙';
  $('#rCoins').classList.toggle('hidden', !coins);
  const btns = [];
  if (hole.daily) {
    btns.push(`<button class="btn" data-a="share">Ergebnis teilen</button>`);
    btns.push(`<div class="row"><button class="btn g" data-a="retry">Nochmal üben</button><button class="btn g" data-a="home">Menü</button></div>`);
  } else {
    if (holed && holeIdx < HOLES.length - 1) btns.push(`<button class="btn" data-a="next">Nächstes Loch →</button>`);
    btns.push(`<div class="row"><button class="btn g" data-a="retry">Nochmal</button><button class="btn g" data-a="course">Übersicht</button></div>`);
  }
  $('#rBtns').innerHTML = btns.join('');
  $('#rBtns').dataset.s = s;
  $('#result').classList.remove('hidden');
}
$('#rBtns').addEventListener('click', async e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const a = b.dataset.a;
  if (a === 'share') {
    const n = dayNum(), s = save.daily[n] ?? +$('#rBtns').dataset.s, d = s - hole.par;
    const sq = Array.from({ length: Math.max(s, hole.par) }, (_, i) => i < s ? (s <= hole.par ? '🟩' : i < hole.par ? '🟨' : '🟥') : '⬜').join('');
    const txt = `⛳ Plopp – Tagesloch #${n}\n${scoreName(s, hole.par)} (${fmtDiff(d)})\n${sq}\n🔥 ${save.streak}`;
    let ok = false; try { if (navigator.share) { await navigator.share({ text: txt }); ok = true; } } catch (_) {} if (!ok) try { await navigator.clipboard.writeText(txt); b.textContent = 'Kopiert ✓'; } catch (_) { b.textContent = 'Teilen nicht möglich'; }
    return;
  }
  $('#result').classList.add('hidden');
  if (a === 'next') startHole(holeIdx + 1);
  else if (a === 'retry') hole.daily ? startDaily() : startHole(holeIdx);
  else if (a === 'course') showScreen('course');
  else showScreen('home');
});

function enterPlay() {
  mode = 'play';
  for (const id of ['home', 'course', 'shop']) $('#' + id).classList.add('hidden');
  hud.classList.remove('hidden'); bar.classList.remove('hidden');
}
function startHole(i) { enterPlay(); loadHole(JSON.parse(JSON.stringify(HOLES[i])), i); segs = staticSegs(); }
function startDaily(n) { enterPlay(); loadHole(genDaily(n || dayNum()), -1); segs = staticSegs(); }
$('#menuBtn').addEventListener('click', () => { $('#result').classList.add('hidden'); showScreen(hole && hole.daily ? 'home' : 'course'); });

// ---------------- Screens ----------------
const coinsHtml = () => `<div class="coins"><b>🪙</b> ${save.coins}</div>`;
function showScreen(name) {
  mode = 'menu'; drag = null; token++;
  hud.classList.add('hidden'); bar.classList.add('hidden'); setHint('');
  document.querySelector('meta[name=theme-color]').content = '#eef1ea';
  for (const id of ['home', 'course', 'shop']) $('#' + id).classList.toggle('hidden', id !== name);
  ({ home: renderHome, course: renderCourse, shop: renderShop })[name]();
}
function renderHome() {
  const n = dayNum(), done = save.daily[n];
  const streak = (save.lastDaily === n || save.lastDaily === n - 1) ? save.streak : 0;
  const total = Object.keys(save.best).length;
  const sumD = Object.entries(save.best).reduce((a, [i, s]) => a + s - HOLES[i].par, 0);
  $('#home').innerHTML = `<div class="wrap">
    <div class="top"><div style="flex:1"></div>${coinsHtml()}<button class="iconBtn" id="mute">${save.muted ? '🔇' : '🔊'}</button></div>
    <div class="logo">plopp<i></i></div>
    <div class="tag">Ein Loch am Tag. Ein Finger. Kein Stress.</div>
    <div class="card daily">
      <div class="k">Heute</div>
      <div class="t">Tagesloch #${n}</div>
      <div class="s">${done != null ? 'Geschafft: ' + scoreName(done, genDaily(n).par) + ' · ' + done + ' Schläge' : 'Neues Loch wartet · alle Fähigkeiten 1×'}${streak ? ' · 🔥 ' + streak : ''}</div>
      <button class="btn w" data-go="daily">${done != null ? 'Nochmal üben' : 'Spielen'}</button>
    </div>
    <div class="card"><button class="mi" data-go="course"><div class="ic">⛳</div><div class="tx"><b>Der Platz</b><span>18 Löcher · ${total}/18 gespielt${total ? ' · ' + fmtDiff(sumD) : ''}</span></div><div class="ar">›</div></button></div>
    <div class="card"><button class="mi" data-go="shop"><div class="ic">✨</div><div class="tx"><b>Fähigkeiten</b><span>${SKILLS.filter(s => lvl(s.id)).length}/6 freigeschaltet</span></div><div class="ar">›</div></button></div>
    <div class="card stat"><div><b>${save.holes}</b><span>Löcher</span></div><div><b>${save.hio}</b><span>Hole-in-One</span></div><div><b>${streak}</b><span>Serie</span></div></div>
  </div>`;
}
function renderCourse() {
  $('#course').innerHTML = `<div class="wrap">
    <div class="top"><button class="iconBtn" data-go="home">‹</button><h2>Der Platz</h2>${coinsHtml()}</div>
    <div class="grid">${HOLES.map((h, i) => {
      const b = save.best[i], lock = i > save.unlocked;
      const d = b != null ? b - h.par : null;
      return `<button class="hole ${lock ? 'lock' : ''}" data-hole="${i}" ${lock ? 'disabled' : ''}><b>${lock ? '🔒' : i + 1}</b><span class="${d == null ? '' : d < 0 ? 'u' : d > 0 ? 'o' : ''}">${lock ? '' : b != null ? b + ' · ' + fmtDiff(d) : 'Par ' + h.par}</span></button>`;
    }).join('')}</div>
    <p style="color:var(--soft);font-weight:600;font-size:13px;text-align:center;margin-top:18px">Fähigkeiten-Ladungen pro Loch = Stufe der Fähigkeit</p>
  </div>`;
}
function renderShop() {
  $('#shop').innerHTML = `<div class="wrap">
    <div class="top"><button class="iconBtn" data-go="home">‹</button><h2>Fähigkeiten</h2>${coinsHtml()}</div>
    ${SKILLS.map(s => {
      const L = lvl(s.id), max = L >= 3, cost = max ? 0 : s.cost[L], can = !max && save.coins >= cost;
      const lbl = max ? 'Max' : (L ? 'Stufe ' + (L + 1) : 'Freischalten') + ' · ' + cost + ' 🪙';
      return `<div class="card sk"><div class="ic">${s.ic}</div><div class="tx"><b>${s.name}</b><p>${s.d}</p>
        <div class="dots">${[0, 1, 2].map(i => `<i class="${i < L ? 'f' : ''}"></i>`).join('')}</div>
        <button class="sbtn ${can ? '' : 'dis'}" data-buy="${s.id}" ${can ? '' : 'disabled'}>${lbl}</button></div></div>`;
    }).join('')}
    <p style="color:var(--soft);font-weight:600;font-size:13px;text-align:center">Münzen gibt's für jedes Loch. Beim Tagesloch doppelt.<br>Jede Stufe = eine Ladung mehr pro Loch und stärkerer Effekt.</p>
  </div>`;
}
document.addEventListener('click', e => {
  const g = e.target.closest('[data-go]'), h = e.target.closest('[data-hole]'), b = e.target.closest('[data-buy]');
  if (e.target.closest('#mute')) { save.muted = !save.muted; persist(); renderHome(); return; }
  if (g) { Snd.init(); const v = g.dataset.go; v === 'daily' ? startDaily() : showScreen(v); }
  else if (h) { Snd.init(); startHole(+h.dataset.hole); }
  else if (b) { const s = SK[b.dataset.buy], L = lvl(s.id); if (L < 3 && save.coins >= s.cost[L]) { save.coins -= s.cost[L]; save.lv[s.id] = L + 1; persist(); Snd.coin(); buzz(20); renderShop(); } }
});

// Debug/Test-Hook
window.__plopp = { get state() { return state; }, get ball() { return ball; }, get strokes() { return strokes; }, get hole() { return hole; }, startHole, startDaily, shoot, useSkill, genDaily, HOLES, get save() { return save; },
  tick(n) { for (let i = 0; i < n && state === 'roll'; i++) update(1 / 60); },
  snap() { return JSON.stringify({ ball, strokes, time, state, charges }); },
  restore(j) { const o = JSON.parse(j); ball = o.ball; strokes = o.strokes; time = o.time; state = o.state; charges = o.charges; effects = {}; parts = []; },
  segsReady() { return segs.length; } };

resize();
showScreen('home');
requestAnimationFrame(frame);
})();
