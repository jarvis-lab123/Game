'use strict';
(() => {
// =============================================================
//  FAIRWAY – Tägliches Golf  (2D von oben, Hochformat, Touch)
//  Einheiten: Meter, Sekunden, km/h
// =============================================================
const $ = s => document.querySelector(s);
const cv = $('#c'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(3, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  _st = _sb = null;
}
addEventListener('resize', resize);

const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const hyp = Math.hypot;
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function safeVal(v) { const d = document.createElement('div'); d.style.cssText = 'position:fixed;visibility:hidden;height:' + v; document.body.appendChild(d); const h = d.offsetHeight; d.remove(); return h; }
let _st = null, _sb = null;
const safeTop = () => _st ?? (_st = safeVal('env(safe-area-inset-top,0px)'));
const safeBot = () => _sb ?? (_sb = safeVal('env(safe-area-inset-bottom,0px)'));

// ---------------- Speicher ----------------
const KEY = 'fairway_v1';
const defSave = () => ({ coins: 0, at: { kraft: 0, praez: 0, spin: 0, putt: 0 }, daily: {}, streak: 0, lastDaily: -1, career: {}, muted: false, rounds: 0, birdies: 0, eagles: 0, hio: 0, best: null });
let save = defSave();
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) { save = Object.assign(defSave(), s); save.at = Object.assign(defSave().at, s.at || {}); } } catch (e) {}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };

// ---------------- Sound ----------------
const Snd = {
  ac: null,
  init() { if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; } try { this.ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} },
  tone(f, d, type = 'sine', v = .2, slide = 0, delay = 0) {
    if (!this.ac || save.muted) return;
    const t = this.ac.currentTime + delay, o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + d);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
    o.connect(g).connect(this.ac.destination); o.start(t); o.stop(t + d + .02);
  },
  noise(d, v = .2, f = 1200, f2 = 0) {
    if (!this.ac || save.muted) return;
    const len = Math.floor(this.ac.sampleRate * d), b = this.ac.createBuffer(1, len, this.ac.sampleRate), c = b.getChannelData(0);
    for (let i = 0; i < len; i++) c[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = this.ac.createBufferSource(), fl = this.ac.createBiquadFilter(), g = this.ac.createGain();
    s.buffer = b; fl.type = 'bandpass'; fl.frequency.setValueAtTime(f, this.ac.currentTime); if (f2) fl.frequency.exponentialRampToValueAtTime(f2, this.ac.currentTime + d);
    g.gain.value = v; s.connect(fl).connect(g).connect(this.ac.destination); s.start();
  },
  tick() { this.tone(900, .03, 'square', .05); },
  swing(p) { this.noise(.22, .25, 500, 2500); setTimeout(() => { this.tone(1300 + p * 300, .05, 'triangle', .3, -600); this.noise(.05, .25, 3500); }, 140); },
  land() { this.noise(.09, .2, 300); },
  tree() { this.noise(.25, .3, 800); this.tone(160, .1, 'square', .1, -60); },
  putt() { this.tone(1500, .04, 'triangle', .22, -900); },
  plop() { this.tone(500, .08, 'sine', .3, -300); this.tone(320, .1, 'sine', .25, -120, .08); },
  splash() { this.noise(.5, .35, 700, 200); },
  sand() { this.noise(.18, .2, 1500, 600); },
  good() { [660, 880, 1320].forEach((f, i) => this.tone(f, .16, 'triangle', .15, 0, i * .09)); },
  coin() { [990, 1480].forEach((f, i) => this.tone(f, .12, 'triangle', .13, 0, i * .08)); },
};
const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

// ---------------- Geometrie ----------------
function inPoly(x, y, p) { let ins = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { const xi = p[i][0], yi = p[i][1], xj = p[j][0], yj = p[j][1]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) ins = !ins; } return ins; }
function inE(x, y, e, grow = 0) { const c = Math.cos(e.a), s = Math.sin(e.a), dx = x - e.x, dy = y - e.y, lx = dx * c + dy * s, ly = -dx * s + dy * c, rx = e.rx + grow, ry = e.ry + grow; return (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry) <= 1; }
function closestOnSeg(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1; const t = clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1); return [ax + dx * t, ay + dy * t, t]; }
function bez(a, c, b, t) { const u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; }
const rot = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

// ---------------- Schläger & Werte ----------------
const CLUBS = [
  { id: 'D', n: 'Driver', c: 212, apex: 30, roll: .15, sp: 4.6 },
  { id: '3W', n: 'Holz 3', c: 192, apex: 29, roll: .12, sp: 4.0 },
  { id: '5I', n: 'Eisen 5', c: 165, apex: 30, roll: .085, sp: 3.4 },
  { id: '7I', n: 'Eisen 7', c: 143, apex: 32, roll: .06, sp: 3.0 },
  { id: '9I', n: 'Eisen 9', c: 122, apex: 34, roll: .045, sp: 2.6 },
  { id: 'PW', n: 'Pitching Wedge', c: 104, apex: 35, roll: .035, sp: 2.3 },
  { id: 'SW', n: 'Sand Wedge', c: 80, apex: 36, roll: .025, sp: 2.1 },
  { id: 'LW', n: 'Lob Wedge', c: 56, apex: 38, roll: .015, sp: 2.0 },
  { id: 'P', n: 'Putter', putter: true },
];
const ATTRS = [
  { id: 'kraft', ic: '💪', n: 'Kraft', d: '+3 % Weite mit allen Schlägern pro Stufe.' },
  { id: 'praez', ic: '🎯', n: 'Präzision', d: 'Weniger Streuung und eine breitere „Perfekt“-Zone im Schwung.' },
  { id: 'spin', ic: '🌀', n: 'Spin', d: 'Schaltet Back- und Topspin frei. Höhere Stufe = mehr Wirkung, ab Stufe 3 zieht der Ball auf dem Grün zurück.' },
  { id: 'putt', ic: '⛳', n: 'Putten', d: 'Zeigt die Putt-Linie inkl. Gefälle (länger pro Stufe) und das Loch „schluckt“ schnellere Bälle.' },
];
const COSTS = [60, 130, 220, 340, 500];
const DAILY_STATS = { kraft: 1, praez: 1, spin: 1, putt: 1 };
const LIE = {
  tee: { n: 'Abschlag', d: 1, s: .9, roll: 1, dec: 7 },
  fairway: { n: 'Fairway', d: 1, s: 1, roll: 1, dec: 7 },
  fringe: { n: 'Vorgrün', d: .97, s: 1, roll: .7, dec: 4.5 },
  green: { n: 'Grün', d: 1, s: 1, roll: .75, dec: 2.4 },
  rough: { n: 'Rough', d: .82, s: 1.45, roll: .3, dec: 16 },
  sand: { n: 'Bunker', d: .65, s: 1.6, roll: 0, dec: 45 },
  water: { n: 'Wasser', d: 1, s: 1, roll: 0, dec: 99 },
  ob: { n: 'Aus', d: 1, s: 1, roll: 0, dec: 99 },
};
const CUP = .3, OBW = 62;

// ---------------- Platz-Generator ----------------
function catmull(P, steps = 16) {
  const out = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || P[i + 1];
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => .5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(P[P.length - 1]);
  return out;
}
function resample(pts, step) {
  const out = [[pts[0][0], pts[0][1], 0]]; let acc = 0, need = step;
  for (let i = 1; i < pts.length; i++) {
    let [ax, ay] = pts[i - 1]; const [bx, by] = pts[i]; let seg = hyp(bx - ax, by - ay);
    while (seg >= need) { const t = need / seg; ax += (bx - ax) * t; ay += (by - ay) * t; seg -= need; acc += need; out.push([ax, ay, acc]); need = step; }
    need -= seg; acc += seg;
  }
  const l = pts[pts.length - 1], lo = out[out.length - 1]; const d = hyp(l[0] - lo[0], l[1] - lo[1]);
  if (d > .5) out.push([l[0], l[1], lo[2] + d]);
  return out;
}

function genHole(r, par, diff) {
  const ri = (a, b) => a + r() * (b - a), sgn = () => r() < .5 ? -1 : 1;
  const len = par === 3 ? ri(118, 182) : par === 4 ? ri(300, 392) : ri(458, 528);
  let P;
  if (par === 3) P = [[0, 0], [ri(-6, 6), -len * .5], [ri(-22, 22), -len]];
  else if (par === 4) { const bend = r() < .75, t = ri(.56, .66), bx = bend ? sgn() * ri(22, 55) : ri(-8, 8); P = [[0, 0], [ri(-4, 4), -len * .3], [ri(-6, 6), -len * t], [bx, -len]]; }
  else { const b1 = sgn() * ri(15, 40), b2 = b1 + sgn() * ri(15, 45); P = [[0, 0], [0, -len * .25], [b1 * .2, -len * .48], [b1, -len * .7], [b2, -len]]; }
  // Mittellinie + 45 m Verlängerung hinter dem Grün
  let C = resample(catmull(P), 4);
  const Lg = C[C.length - 1][2];
  { const a = C[C.length - 2], b = C[C.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], l = hyp(dx, dy); for (let k = 1; k <= 11; k++) C.push([b[0] + dx / l * 4 * k, b[1] + dy / l * 4 * k, Lg + 4 * k]); }
  const h = { par, C, Lg, len: Math.round(Lg), diff, bunkers: [], water: [], trees: [] };
  const at = s => pathAt(h, s);
  // Fairway
  const ph = [ri(0, 9), ri(0, 9), ri(0, 9)];
  let fw = null;
  if (par > 3 || r() < .6) {
    const s0 = par === 3 ? Lg - ri(34, 44) : ri(62, 96), s1 = Lg - (par === 3 ? 8 : 12);
    const base = par === 3 ? ri(15, 20) : ri(27, 35) - diff * 5;
    const L = [], R = [], hws = [];
    for (let s = s0; s <= s1 + .1; s += 5) {
      const p = at(s), u = clamp((s - s0) / 22, 0, 1), v = clamp((s1 - s) / 14, 0, 1);
      const taper = Math.sqrt(Math.min(u, v)) * .7 + .3;
      const hw = (base / 2 + Math.sin(s * .031 + ph[0]) * 2.5) * taper;
      const off = Math.sin(s * .019 + ph[1]) * 4 + Math.sin(s * .05 + ph[2]) * 1.5;
      const cx = p.x + p.nx * off, cy = p.y + p.ny * off;
      L.push([cx + p.nx * hw, cy + p.ny * hw]); R.push([cx - p.nx * hw, cy - p.ny * hw]); hws.push([s, hw, off]);
    }
    fw = { poly: L.concat(R.reverse()), s0, s1, hws };
  }
  h.fw = fw;
  h.fwHalf = s => { if (!fw || s < fw.s0 || s > fw.s1) return 0; const i = clamp(Math.round((s - fw.s0) / 5), 0, fw.hws.length - 1); return fw.hws[i][1] + Math.abs(fw.hws[i][2]); };
  // Grün
  const G = at(Lg);
  h.green = { x: G.x, y: G.y, rx: ri(10, 14), ry: ri(9, 12.5), a: ri(0, Math.PI) };
  h.fringe = { ...h.green, rx: h.green.rx + 2.6, ry: h.green.ry + 2.6 };
  { const a = ri(0, TAU), k = Math.sqrt(r()) * .6, [ox, oy] = rot(Math.cos(a) * h.green.rx * k, Math.sin(a) * h.green.ry * k, h.green.a); h.pin = [G.x + ox, G.y + oy]; }
  { const a = ri(0, TAU), m = ri(.3, .55 + diff * .6); h.slope = [Math.cos(a) * m, Math.sin(a) * m]; }
  h.tee = [C[0][0], C[0][1]];
  // Wind
  { const a = ri(0, TAU), v = ri(0, 6 + diff * 24); h.wind = { a, v: Math.round(v) }; }
  const nearGreen = (x, y, m) => inE(x, y, h.fringe, m);
  const nearTee = (x, y, m) => hyp(x - h.tee[0], y - h.tee[1]) < m;
  // Grünbunker
  const nb = clamp(1 + Math.floor(r() * (1 + diff * 2.4)), 1, 3);
  for (let i = 0; i < nb; i++) {
    const ang = ri(0, TAU), [ex, ey] = rot(Math.cos(ang) * (h.fringe.rx + .5), Math.sin(ang) * (h.fringe.ry + .5), h.green.a);
    const l = hyp(ex, ey), ux = ex / l, uy = ey / l, bry = ri(2.6, 4), brx = ri(4.5, 8);
    const b = { x: G.x + ex + ux * (bry + .3), y: G.y + ey + uy * (bry + .3), rx: brx, ry: bry, a: Math.atan2(uy, ux) + Math.PI / 2 };
    if (!h.bunkers.some(o => hyp(o.x - b.x, o.y - b.y) < 9)) h.bunkers.push(b);
  }
  // Fairwaybunker
  if (par > 3) {
    const nf = Math.floor(r() * (1.3 + diff * 1.8));
    for (let i = 0; i < Math.min(2, nf); i++) {
      const s = ri(190, 232), p = at(s), side = sgn(), hw = h.fwHalf(s) || 14;
      h.bunkers.push({ x: p.x + p.nx * side * (hw + ri(-2, 3)), y: p.y + p.ny * side * (hw + ri(-2, 3)), rx: ri(7, 11), ry: ri(3.2, 5), a: p.ang });
    }
  }
  // Wasser
  if (r() < .25 + diff * .55) {
    const kind = par === 3 ? 'front' : par === 4 ? (r() < .5 ? 'creek' : 'side') : (r() < .5 ? 'creek' : 'gside');
    if (kind === 'front') { const s = Lg - h.green.ry - ri(10, 16), p = at(s); h.water.push({ e: { x: p.x, y: p.y, rx: ri(15, 24), ry: ri(4.5, 7), a: p.ang + Math.PI / 2 } }); }
    else if (kind === 'creek') {
      const s = par === 4 ? Lg - ri(75, 110) : ri(250, 295), p = at(s), th = ri(6, 9), poly = [];
      for (let k = -OBW - 6; k <= OBW + 6; k += 6) poly.push([p.x + p.nx * k + p.tx * (th / 2 + Math.sin(k * .2) * 1.2), p.y + p.ny * k + p.ty * (th / 2 + Math.sin(k * .2) * 1.2)]);
      for (let k = OBW + 6; k >= -OBW - 6; k -= 6) poly.push([p.x + p.nx * k - p.tx * (th / 2 + Math.cos(k * .17) * 1.2), p.y + p.ny * k - p.ty * (th / 2 + Math.cos(k * .17) * 1.2)]);
      h.water.push({ p: poly });
    } else if (kind === 'side') { const s = ri(140, 250), p = at(s), side = sgn(), rx = ri(14, 24), ry = ri(7, 11), hw = h.fwHalf(s) || 14; h.water.push({ e: { x: p.x + p.nx * side * (hw + ry * .6), y: p.y + p.ny * side * (hw + ry * .6), rx, ry, a: p.ang } }); }
    else { const p = at(Lg - 2), side = sgn(), rx = ri(12, 18), ry = ri(6, 9); h.water.push({ e: { x: p.x + p.nx * side * (h.fringe.rx + ry + 3), y: p.y + p.ny * side * (h.fringe.rx + ry + 3), rx, ry, a: p.ang } }); }
    // Sicherheit: Wasser darf Grün/Fahne/Abschlag nicht bedecken
    h.water = h.water.filter(w => !inWater1(w, h.pin[0], h.pin[1]) && !inWater1(w, h.tee[0], h.tee[1]) && !inWater1(w, G.x, G.y));
  }
  h.bunkers = h.bunkers.filter(b => !inE(h.pin[0], h.pin[1], b, 1.5) && !h.water.some(w => inWater1(w, b.x, b.y)));
  // Bäume
  for (let s = 18; s <= Lg + 30; s += 8) for (const side of [-1, 1]) {
    if (r() > .38 + diff * .18) continue;
    const p = at(s), hw = Math.max(h.fwHalf(s), par === 3 ? 13 : 16), lat = hw + ri(8, 36);
    if (lat > OBW - 2) continue;
    const t = { x: p.x + p.nx * side * lat + ri(-3, 3), y: p.y + p.ny * side * lat + ri(-3, 3), r: ri(3.3, 6.2), h: ri(11, 21) };
    if (nearTee(t.x, t.y, 16) || nearGreen(t.x, t.y, 7) || h.water.some(w => inWater1(w, t.x, t.y)) || h.bunkers.some(b => inE(t.x, t.y, b, t.r + 1))) continue;
    if (fw && inPoly(t.x, t.y, fw.poly)) continue;
    if (h.trees.some(o => hyp(o.x - t.x, o.y - t.y) < o.r + t.r - 1.5)) continue;
    h.trees.push(t);
  }
  h.trees.sort((a, b) => a.y - b.y);
  // Grenzen für die Übersicht
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of C) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  h.box = [x0 - 30, y0 - 5, x1 + 30, y1 + 10];
  return h;
}
function inWater1(w, x, y) { return w.e ? inE(x, y, w.e) : inPoly(x, y, w.p); }
function pathAt(h, s) {
  const C = h.C; s = clamp(s, 0, C[C.length - 1][2]);
  let i = 1; while (i < C.length - 1 && C[i][2] < s) i++;
  const a = C[i - 1], b = C[i], t = clamp((s - a[2]) / ((b[2] - a[2]) || 1), 0, 1);
  const tx = b[0] - a[0], ty = b[1] - a[1], l = hyp(tx, ty) || 1;
  return { x: a[0] + tx * t, y: a[1] + ty * t, tx: tx / l, ty: ty / l, nx: -ty / l, ny: tx / l, ang: Math.atan2(ty, tx) };
}
function nearestPath(h, x, y) {
  let best = 1e9, bs = 0; const C = h.C;
  for (let i = 1; i < C.length; i++) { const a = C[i - 1], b = C[i]; const [px, py, t] = closestOnSeg(x, y, a[0], a[1], b[0], b[1]); const d = hyp(x - px, y - py); if (d < best) { best = d; bs = a[2] + (b[2] - a[2]) * t; } }
  return { d: best, s: bs };
}
function lieAt(h, x, y) {
  const np = nearestPath(h, x, y);
  if (np.d > OBW || np.s > h.Lg + 40 || (np.s < 1 && hyp(x - h.tee[0], y - h.tee[1]) > 25)) return 'ob';
  for (const w of h.water) if (inWater1(w, x, y)) return 'water';
  for (const b of h.bunkers) if (inE(x, y, b)) return 'sand';
  if (inE(x, y, h.green)) return 'green';
  if (inE(x, y, h.fringe)) return 'fringe';
  if (hyp(x - h.tee[0], y - h.tee[1]) < 5) return 'tee';
  if (h.fw && inPoly(x, y, h.fw.poly)) return 'fairway';
  return 'rough';
}

function genCourse(seed, diff) {
  const r = rng(seed);
  const pars = [4, 4, 4, 4, 3, 3, 5, 5, 4];
  for (let i = pars.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pars[i], pars[j]] = [pars[j], pars[i]]; }
  return pars.map((p, i) => genHole(rng(seed * 31 + i * 977 + 5), p, diff));
}

// ---------------- Modi ----------------
const DAY0 = Date.UTC(2026, 0, 1);
const dayNum = () => { const d = new Date(); return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - DAY0) / 864e5) + 1; };
const TOUR = [
  { n: 'Clubmeisterschaft', d: .15, cut: 4, prize: 50, seed: 1101 },
  { n: 'Regionalliga', d: .3, cut: 2, prize: 80, seed: 2203 },
  { n: 'Amateur Open', d: .45, cut: 1, prize: 120, seed: 3307 },
  { n: 'Challenge Tour', d: .6, cut: 0, prize: 170, seed: 4409 },
  { n: 'Pro Tour Classic', d: .75, cut: -1, prize: 240, seed: 5501 },
  { n: 'Das Major', d: .92, cut: -3, prize: 360, seed: 6607 },
];

// ---------------- Spielzustand ----------------
let mode = 'menu', round = null, hole = null, hi = 0;
let state = 'idle';  // aim | swing | flight | roll | putt | putting | wait | holed
let ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0 }, strokes = 0, lie = 'tee';
let target = [0, 0], clubI = 0, shape = 0, spin = 0, overview = false;
let swing = null, flight = null, rollInfo = null, putDrag = null, parts = [], trail = [], stateT = 0, time = 0, ffwd = false;
const cam = { x: 0, y: 0, s: 3 }, camT = { x: 0, y: 0, s: 3 };
const stats = () => round && round.mode === 'daily' ? DAILY_STATS : save.at;
const wind = () => { const w = hole.wind; return [Math.cos(w.a) * w.v, Math.sin(w.a) * w.v]; };

function allowedClubs() {
  const dPin = hyp(hole.pin[0] - ball.x, hole.pin[1] - ball.y);
  return CLUBS.map((c, i) => i).filter(i => {
    const c = CLUBS[i];
    if (c.id === 'D') return lie === 'tee';
    if (c.putter) return lie === 'green' || lie === 'fringe' || (lie === 'fairway' && dPin < 30);
    if (lie === 'green') return false;
    return true;
  });
}
function carry(c, l = lie) {
  if (c.putter) return 30;
  let d = LIE[l].d; if (l === 'sand' && (c.id === 'SW' || c.id === 'LW')) d = .9;
  return c.c * (1 + .03 * stats().kraft) * d;
}
function autoClub(dist) {
  const al = allowedClubs().filter(i => !CLUBS[i].putter);
  for (let k = al.length - 1; k >= 0; k--) if (carry(CLUBS[al[k]]) >= dist * .98) return al[k];
  return al[0];
}
function maxRange() { const al = allowedClubs().filter(i => !CLUBS[i].putter); return carry(CLUBS[al[0]]); }

// ---------------- Runde / Loch ----------------
function startRound(m, opts = {}) {
  let seed, diff, label;
  if (m === 'daily') { const n = opts.n || dayNum(); seed = n * 7919 + 17; diff = .45 + .25 * (((n * 37) % 7) / 6); label = 'Tagesrunde #' + n; round = { n }; }
  else if (m === 'tour') { const t = TOUR[opts.i]; seed = t.seed; diff = t.d; label = t.n; round = { ti: opts.i }; }
  else { seed = (Math.random() * 1e9) | 0; diff = .4; label = 'Training'; round = {}; }
  Object.assign(round, { mode: m, label, holes: genCourse(seed, diff), scores: [] });
  enterPlay(); startHole(0);
}
function startHole(i) {
  hi = i; hole = round.holes[i];
  ball = { x: hole.tee[0], y: hole.tee[1], z: 0, vx: 0, vy: 0 };
  strokes = 0; shape = 0; spin = 0; overview = false; parts = []; trail = [];
  lie = 'tee'; cam.s = 0;
  setupShot();
  snapCam();
  const w = hole.wind;
  toast('Loch ' + (i + 1), 'Par ' + hole.par + ' · ' + hole.len + ' m' + (w.v ? ' · Wind ' + w.v + ' km/h' : ''), 1600);
}
function setupShot() {
  lie = lieAt(hole, ball.x, ball.y);
  if (hyp(ball.x - hole.tee[0], ball.y - hole.tee[1]) < 1) lie = 'tee';
  ball.z = 0; ball.vx = ball.vy = 0;
  const al = allowedClubs();
  if (lie === 'green' || (lie === 'fringe')) { clubI = al.find(i => CLUBS[i].putter); enterPutt(); }
  else {
    state = 'aim';
    const dPin = hyp(hole.pin[0] - ball.x, hole.pin[1] - ball.y), mr = maxRange();
    if (dPin <= mr) target = [...hole.pin];
    else {
      const s0 = nearestPath(hole, ball.x, ball.y).s; let s = Math.min(hole.Lg, s0 + mr), p = pathAt(hole, s);
      while (hyp(p.x - ball.x, p.y - ball.y) > mr * .97 && s > s0) { s -= 3; p = pathAt(hole, s); }
      target = [p.x, p.y];
    }
    clubI = autoClub(hyp(target[0] - ball.x, target[1] - ball.y));
  }
  updHud(); updPanel();
}
function enterPutt() { state = 'putt'; overview = false; updHud(); updPanel(); }

// ---------------- Schwung ----------------
function startSwing() {
  if (state !== 'aim') return;
  Snd.init(); overview = false;
  state = 'swing'; swing = { ph: 'power', t: 0, p: 0, a: 0, pt: clamp(hyp(target[0] - ball.x, target[1] - ball.y) / carry(CLUBS[clubI]), .05, 1) };
  updPanel();
}
function swingTap() {
  if (state !== 'swing') return;
  if (swing.ph === 'power') { swing.p = swingVal(); swing.ph = 'acc'; swing.t = 0; Snd.tick(); buzz(8); }
  else if (swing.ph === 'acc') { swing.a = accVal(); swing.ph = 'done'; Snd.tick(); hitBall(); }
}
const swingVal = () => { const t = swing.t / .9; return t <= 1.1 ? t : Math.max(0, 2.2 - t); };
const accVal = () => 1.15 - swing.t * 2.4;
function perfZone() { return .07 + .02 * stats().praez; }

function hitBall() {
  const c = CLUBS[clubI], S = [ball.x, ball.y];
  const dist = Math.max(1, hyp(target[0] - S[0], target[1] - S[1]));
  let p = swing.p, a = clamp(swing.a, -1.3, 1.3);
  const perfect = Math.abs(a) <= perfZone();
  if (perfect) a = 0;
  const over = Math.max(0, p - 1);
  let carryAct = carry(c) * (p <= 1 ? p : 1 + over * .45);
  if (spin) carryAct *= spin < 0 ? .98 : .97;
  let errDeg = a * c.sp * LIE[lie].s * (1 - .07 * stats().praez) * 2.2 + (over ? Math.sign(a || (Math.random() - .5)) * over * 25 : 0);
  if (shape && !perfect) errDeg *= 1.1;
  const dx = (target[0] - S[0]) / dist, dy = (target[1] - S[1]) / dist;
  const [rx, ry] = rot(dx, dy, errDeg * Math.PI / 180);
  const air = .9 + carryAct / 105;
  const [wx, wy] = wind(), wk = .2 * air * (c.apex / 32);
  const L = [S[0] + rx * carryAct + wx * wk, S[1] + ry * carryAct + wy * wk];
  const mid = [(S[0] + L[0]) / 2, (S[1] + L[1]) / 2], rgt = [-ry, rx], bow = -shape * carryAct * .11;
  const Cp = [mid[0] + rgt[0] * bow - wx * wk * .3, mid[1] + rgt[1] * bow - wy * wk * .3];
  strokes++;
  flight = { S, L, Cp, T: air, t: 0, apex: c.apex * clamp(.5 + p * .5, .5, 1.05) * (spin < 0 ? 1.08 : spin > 0 ? .9 : 1), carry: carryAct, club: c, shape, spin, origin: S };
  state = 'flight'; ffwd = false; trail = [];
  Snd.swing(p); buzz(15);
  const msg = perfect ? 'Perfekt!' : Math.abs(a) < .35 ? (a > 0 ? 'Leicht rechts' : 'Leicht links') : Math.abs(a) < .8 ? (a > 0 ? 'Push' : 'Pull') : (a > 0 ? 'Slice!' : 'Hook!');
  toast(msg, over > .02 ? 'Überschwung' : null, 900);
  updHud(); updPanel();
}

// ---------------- Flug & Rollen ----------------
function updFlight(dt) {
  const f = flight; f.t += dt * (ffwd ? 3 : 1);
  const p = Math.min(1, f.t / f.T);
  const [x, y] = bez(f.S, f.Cp, f.L, p);
  const z = f.apex * 4 * p * (1 - p);
  // Bäume
  for (const t of hole.trees) {
    if (z < t.h && hyp(x - t.x, y - t.y) < t.r * .85) {
      const [px, py] = bez(f.S, f.Cp, f.L, Math.max(0, p - .02)), dx = x - px, dy = y - py, l = hyp(dx, dy) || 1;
      ball.x = x - dx / l * (t.r + 1.2); ball.y = y - dy / l * (t.r + 1.2); ball.z = 0;
      Snd.tree(); buzz(25); toast('Baum!', null, 800); leafFx(t.x, t.y);
      startRoll(-dx / l * 3, -dy / l * 3);
      return;
    }
  }
  ball.x = x; ball.y = y; ball.z = z;
  trail.push([x, y - 0, z]); if (trail.length > 40) trail.shift();
  if (p >= 1) land();
}
function land() {
  const f = flight; ball.z = 0;
  const l = lieAt(hole, ball.x, ball.y);
  if (hyp(ball.x - hole.pin[0], ball.y - hole.pin[1]) < CUP * 1.2 && l !== 'water') { holed(); return; }
  if (l === 'water') { penaltyWater(f); return; }
  if (l === 'ob') { penaltyOB(f); return; }
  Snd.land(); puffFx(ball.x, ball.y, l === 'sand' ? '#efe0b0' : 'rgba(255,255,255,.8)', l === 'sand' ? 10 : 5);
  if (l === 'sand') Snd.sand();
  const [tx, ty] = [f.L[0] - f.Cp[0], f.L[1] - f.Cp[1]], tl = hyp(tx, ty) || 1;
  const sl = stats().spin;
  let rollD = f.carry * f.club.roll * LIE[l].roll * (f.shape < 0 ? 1.18 : f.shape > 0 ? .85 : 1);
  let dir = 1;
  if (f.spin < 0) { rollD *= Math.max(.05, 1 - .3 * Math.max(1, sl)); if (sl >= 3 && (l === 'green' || l === 'fringe')) { dir = -1; rollD = .8 + (sl - 2) * 1.2 + f.club.apex * .02; } }
  if (f.spin > 0) rollD *= 1 + .3 * Math.max(1, sl);
  const v0 = Math.sqrt(2 * LIE[l].dec * Math.max(0, rollD));
  bounce = { t: 0, h: Math.min(3, f.carry * .012) };
  startRoll(tx / tl * v0 * dir, ty / tl * v0 * dir);
}
let bounce = null;
function startRoll(vx, vy) { ball.vx = vx; ball.vy = vy; state = 'roll'; stateT = 0; rollInfo = { lowT: 0, from: flight ? flight.S : [ball.x, ball.y], origin: flight ? flight.origin : [ball.x, ball.y] }; }
function penaltyWater(f) {
  Snd.splash(); buzz(40); splashFx(ball.x, ball.y);
  state = 'wait'; strokes++;
  // Drop: entlang der Flugbahn zurück bis trocken
  const [sx, sy] = f.S; let x = ball.x, y = ball.y; const dx = sx - x, dy = sy - y, l = hyp(dx, dy) || 1;
  for (let k = 0; k < l; k += 1) { x = ball.x + dx / l * k; y = ball.y + dy / l * k; const li = lieAt(hole, x, y); if (li !== 'water' && li !== 'ob') { x += dx / l * 2.5; y += dy / l * 2.5; break; } }
  toast('Wasser', 'Strafschlag · Drop', 1200);
  later(1100, () => { ball.x = x; ball.y = y; afterStop(); });
}
function penaltyOB(f) {
  buzz(40); state = 'wait'; strokes++;
  toast('Aus!', 'Strafschlag · nochmal von vorne', 1300);
  later(1200, () => { ball.x = f.origin[0]; ball.y = f.origin[1]; afterStop(); });
}
let timers = [];
function later(ms, fn) { timers.push({ at: time + ms / 1000, fn, tk: round }); }
function runTimers() { const due = timers.filter(t => t.at <= time); if (!due.length) return; timers = timers.filter(t => t.at > time); for (const t of due) if (t.tk === round && mode === 'play') t.fn(); }

function rollStep(h) {
  const l = lieAt(hole, ball.x, ball.y);
  if (l === 'water') { ball.vx = ball.vy = 0; penaltyWater({ S: rollInfo.from || [ball.x, ball.y + 5] }); return; }
  if (l === 'ob') { penaltyOB({ origin: rollInfo.origin || [hole.tee[0], hole.tee[1]] }); return; }
  let sp = hyp(ball.vx, ball.vy);
  const dec = LIE[l].dec;
  if (sp > 0) { const ns = Math.max(0, sp - dec * h); ball.vx *= ns / sp; ball.vy *= ns / sp; }
  if (l === 'green' && sp > .05) { ball.vx += hole.slope[0] * h; ball.vy += hole.slope[1] * h; }
  else if (l === 'green' && Math.hypot(...hole.slope) > .55) { ball.vx += hole.slope[0] * h * .5; ball.vy += hole.slope[1] * h * .5; }
  // Loch
  const dx = hole.pin[0] - ball.x, dy = hole.pin[1] - ball.y, d = hyp(dx, dy);
  sp = hyp(ball.vx, ball.vy);
  const capV = 1.7 + .15 * stats().putt;
  if (d < CUP + .12 && d > .01 && sp < capV * 1.4) { ball.vx += dx / d * 3 * h; ball.vy += dy / d * 3 * h; }
  ball.x += ball.vx * h; ball.y += ball.vy * h;
  const d2 = hyp(hole.pin[0] - ball.x, hole.pin[1] - ball.y);
  if (d2 < CUP) {
    if (sp < capV) { holed(); return; }
    if (d2 < CUP * .55 && !rollInfo.lipped) { rollInfo.lipped = true; const a = (Math.random() - .5) * 1.4; [ball.vx, ball.vy] = rot(ball.vx * .55, ball.vy * .55, a); Snd.tone(700, .05, 'triangle', .15); toast('Lip-out!', null, 700); }
  } else rollInfo.lipped = false;
  // Bäume beim Rollen
  for (const t of hole.trees) { const tx = ball.x - t.x, ty = ball.y - t.y, td = hyp(tx, ty); if (td < t.r * .6) { ball.x = t.x + tx / td * t.r * .6; ball.y = t.y + ty / td * t.r * .6; const vn = (ball.vx * tx + ball.vy * ty) / td; if (vn < 0) { ball.vx -= 1.4 * vn * tx / td; ball.vy -= 1.4 * vn * ty / td; } } }
  if (hyp(ball.vx, ball.vy) < .04) { ball.vx = ball.vy = 0; afterStop(); }
}
function afterStop() {
  if (state === 'holed') return;
  state = 'wait';
  const max = hole.par + 4;
  if (strokes >= max) { toast('Aufgehoben', 'Max. ' + max + ' Schläge', 1200); later(1100, () => holeDone(max)); return; }
  setupShot();
}

function holed() {
  state = 'holed'; ball.vx = ball.vy = 0; stateT = 0;
  Snd.plop(); buzz([20, 40, 30]);
  const d = strokes - hole.par;
  if (d < 0 || strokes === 1) later(250, () => Snd.good());
  for (let i = 0; i < 30; i++) { const a = Math.random() * TAU, s = 1 + Math.random() * 5; parts.push({ x: hole.pin[0], y: hole.pin[1], vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.1, max: 1.1, c: ['#ffffff', '#ffd54f', '#ff8a65', '#81d4fa'][i % 4], r: .25 + Math.random() * .25 }); }
  later(1000, () => holeDone(strokes));
}

// ---------------- Putten ----------------
function puttDragVec() {
  if (!putDrag) return null;
  const dx = putDrag.sx - putDrag.x, dy = putDrag.sy - putDrag.y, l = hyp(dx, dy);
  if (l < 8) return null;
  const p = clamp(l / (Math.min(W, H) * .6), 0, 1), dist = 26 * p * p + .3;
  return { dx: dx / l, dy: dy / l, p, v: Math.sqrt(2 * LIE.green.dec * dist) };
}
function doPutt(a) {
  strokes++; Snd.putt(); buzz(10);
  rollInfo = { lowT: 0, from: [ball.x, ball.y], origin: [ball.x, ball.y] };
  ball.vx = a.dx * a.v; ball.vy = a.dy * a.v; state = 'putting'; stateT = 0; bounce = null;
  updHud(); updPanel();
}

// ---------------- Input ----------------
let aimDrag = false;
cv.addEventListener('pointerdown', e => {
  Snd.init();
  if (mode !== 'play') return;
  if (state === 'swing') { swingTap(); return; }
  if (state === 'flight') { ffwd = true; return; }
  if (state === 'aim') { aimDrag = true; setTarget(e.clientX, e.clientY); try { cv.setPointerCapture(e.pointerId); } catch (_) {} return; }
  if (state === 'putt') { putDrag = { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, id: e.pointerId }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} }
});
cv.addEventListener('pointermove', e => {
  if (aimDrag && state === 'aim') setTarget(e.clientX, e.clientY);
  if (putDrag && e.pointerId === putDrag.id) { putDrag.x = e.clientX; putDrag.y = e.clientY; }
});
const up = e => {
  aimDrag = false;
  if (putDrag && e.pointerId === putDrag.id) { const a = puttDragVec(); putDrag = null; if (a && state === 'putt' && a.p > .03) doPutt(a); }
};
cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', () => { aimDrag = false; putDrag = null; });
addEventListener('keydown', e => {
  if (mode !== 'play') return;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (state === 'aim') startSwing(); else if (state === 'swing') swingTap(); else if (state === 'flight') ffwd = true; }
});
function toWorld(sx, sy) { return [(sx - W / 2) / cam.s + cam.x, (sy - H / 2) / cam.s + cam.y]; }
function toScreen(x, y) { return [(x - cam.x) * cam.s + W / 2, (y - cam.y) * cam.s + H / 2]; }
function setTarget(sx, sy) {
  let [x, y] = toWorld(sx, sy);
  const dx = x - ball.x, dy = y - ball.y, d = hyp(dx, dy), mr = maxRange();
  if (d < 3) return;
  if (d > mr) { x = ball.x + dx / d * mr; y = ball.y + dy / d * mr; }
  target = [x, y];
  clubI = autoClub(Math.min(d, mr));
  updPanel();
}

// ---------------- Kamera ----------------
function viewRect() {
  const top = safeTop() + 112 + (state === 'aim' || state === 'swing' ? 30 : 0);
  const ph = state === 'aim' ? 222 : state === 'putt' || state === 'putting' ? 96 : 40;
  const bot = H - safeBot() - ph;
  return { x0: 10, y0: top, x1: W - 10, y1: Math.max(top + 100, bot) };
}
function fitTo(x0, y0, x1, y1, minW) {
  const v = viewRect(), w = Math.max(x1 - x0, minW), h = Math.max(y1 - y0, minW * .6);
  const s = Math.min((v.x1 - v.x0) / w, (v.y1 - v.y0) / h);
  // Mittelpunkt so setzen, dass Box im View-Rechteck zentriert ist
  const cxs = (v.x0 + v.x1) / 2, cys = (v.y0 + v.y1) / 2;
  camT.s = s; camT.x = (x0 + x1) / 2 - (cxs - W / 2) / s; camT.y = (y0 + y1) / 2 - (cys - H / 2) / s;
}
function camGoal() {
  if (!hole) return;
  if (overview) { const b = hole.box; fitTo(b[0], b[1], b[2], b[3], 80); return; }
  const bx = ball.x, by = ball.y;
  if (state === 'aim' || state === 'swing') {
    const pts = [[bx, by], target];
    const dPin = hyp(hole.pin[0] - bx, hole.pin[1] - by);
    if (dPin < maxRange() * 1.25) pts.push(hole.pin);
    box(pts, 22, 60);
  } else if (state === 'putt' || state === 'putting') {
    box([[bx, by], hole.pin], 5, 24);
  } else if (state === 'flight') {
    box([flight.S, flight.L, [bx, by]], 26, 60);
  } else if (state === 'roll') {
    box([[bx, by], flight ? flight.L : [bx, by], hole.pin].slice(0, hyp(hole.pin[0] - bx, hole.pin[1] - by) < 40 ? 3 : 2), 16, 40);
  } else if (state === 'holed') box([hole.pin], 6, 18);
}
function box(pts, pad, minW) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } fitTo(x0 - pad, y0 - pad, x1 + pad, y1 + pad, minW); }
function snapCam() { camGoal(); cam.x = camT.x; cam.y = camT.y; cam.s = camT.s; }
function updCam(dt) {
  camGoal();
  if (!cam.s) { snapCam(); return; }
  const k = 1 - Math.exp(-dt * (state === 'flight' ? 3 : 4.5));
  cam.x = lerp(cam.x, camT.x, k); cam.y = lerp(cam.y, camT.y, k);
  cam.s = Math.exp(lerp(Math.log(cam.s), Math.log(camT.s), k));
}

// ---------------- Loop ----------------
let last = performance.now();
function frame(now) {
  const dt = Math.min(.04, (now - last) / 1000); last = now;
  if (mode === 'play' && hole) update(dt);
  render();
  requestAnimationFrame(frame);
}
function update(dt) {
  time += dt; stateT += dt; runTimers();
  if (state === 'swing') {
    swing.t += dt;
    if (swing.ph === 'power' && swing.t > .9 * 2.2) { state = 'aim'; swing = null; updPanel(); toast('Abgebrochen', null, 700); }
    else if (swing.ph === 'acc' && accVal() < -1.3) { swing.a = -1.3; swing.ph = 'done'; hitBall(); }
  } else if (state === 'flight') updFlight(dt);
  else if (state === 'roll' || state === 'putting') {
    if (bounce) { bounce.t += dt; ball.z = bounce.h * Math.max(0, Math.sin(Math.min(1, bounce.t / .35) * Math.PI)); if (bounce.t > .35) { bounce = null; ball.z = 0; } }
    const n = 8; for (let i = 0; i < n && (state === 'roll' || state === 'putting'); i++) rollStep(dt / n);
  }
  if (state !== 'flight' && trail.length) trail.shift();
  for (const p of parts) { p.life -= dt; if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= .93; p.vy *= .93; } }
  parts = parts.filter(p => p.life > 0);
  updCam(dt);
}

// ---------------- Effekte ----------------
function puffFx(x, y, c, n) { for (let i = 0; i < n; i++) { const a = Math.random() * TAU, s = 1 + Math.random() * 4; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .5, max: .5, c, r: .25 + Math.random() * .3 }); } }
function splashFx(x, y) { for (let i = 0; i < 18; i++) { const a = Math.random() * TAU, s = 1 + Math.random() * 6; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .7, max: .7, c: '#e8f7fd', r: .3 + Math.random() * .4 }); } parts.push({ ring: 1, x, y, r0: .5, grow: 5, life: .8, max: .8, c: '#e8f7fd' }); }
function leafFx(x, y) { for (let i = 0; i < 12; i++) { const a = Math.random() * TAU, s = 2 + Math.random() * 5; parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: .8, max: .8, c: i % 2 ? '#5f9e4d' : '#87c06a', r: .4 + Math.random() * .4 }); } }

// ---------------- Rendering ----------------
const PAL = { deep: '#5f9952', rough: '#79b062', roughL: '#82b86a', fw: '#9fd27a', fwL: '#a9d985', fringe: '#9dd078', green: '#b6e391', greenL: '#bee899', sand: '#f0e2b4', sandD: '#ddc98e', water: '#5ab4dc', waterD: '#4aa2cb', tree: '#3f7f45', treeL: '#4f9354', treeS: 'rgba(20,50,25,.28)', tee: '#a9d985' };
function ell(e, grow = 0) { ctx.beginPath(); ctx.ellipse(e.x, e.y, e.rx + grow, e.ry + grow, e.a, 0, TAU); }
function poly(p) { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); }
function waterPath(w) { if (w.e) ell(w.e); else poly(w.p); }
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = mode === 'play' ? PAL.deep : '#f2f0e8'; ctx.fillRect(0, 0, W, H);
  if (mode !== 'play' || !hole) return;
  const s = cam.s;
  ctx.setTransform(DPR * s, 0, 0, DPR * s, DPR * (W / 2 - cam.x * s), DPR * (H / 2 - cam.y * s));
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const px = 1 / s; // ein Bildschirmpixel in Metern
  // Spielbahn (Rough-Korridor)
  ctx.strokeStyle = PAL.rough; ctx.lineWidth = OBW * 2;
  ctx.beginPath(); hole.C.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
  // Mähmuster im Rough
  ctx.save(); ctx.beginPath(); hole.C.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.lineWidth = OBW * 2; ctx.strokeStyle = PAL.roughL; ctx.globalAlpha = .45; ctx.setLineDash([12, 12]); ctx.lineWidth = OBW * 2; ctx.lineCap = 'butt'; ctx.stroke(); ctx.restore();
  ctx.lineCap = 'round';
  // Fairway
  if (hole.fw) {
    ctx.fillStyle = PAL.fw; poly(hole.fw.poly); ctx.fill();
    ctx.save(); poly(hole.fw.poly); ctx.clip();
    ctx.fillStyle = PAL.fwL; const b = hole.box;
    for (let y = Math.floor(b[1] / 16) * 16; y < b[3]; y += 16) ctx.fillRect(b[0], y, b[2] - b[0], 8);
    ctx.restore();
  }
  // Abschlag
  ctx.fillStyle = PAL.tee; ctx.save(); ctx.translate(hole.tee[0], hole.tee[1]); ctx.rotate(pathAt(hole, 2).ang + Math.PI / 2); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-5, -4, 10, 8, 1.5) : ctx.rect(-5, -4, 10, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3.2, -2.5, .45, 0, TAU); ctx.arc(3.2, -2.5, .45, 0, TAU); ctx.fill(); ctx.restore();
  // Wasser
  for (const w of hole.water) {
    ctx.fillStyle = PAL.waterD; waterPath(w); ctx.fill();
    ctx.save(); waterPath(w); ctx.clip(); ctx.fillStyle = PAL.water; ctx.translate(.6, .9); waterPath(w); ctx.fill(); ctx.restore();
    ctx.save(); waterPath(w); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = .4;
    const c = w.e ? [w.e.x, w.e.y] : w.p[0];
    for (let k = -4; k <= 4; k++) { ctx.beginPath(); for (let x = -70; x <= 70; x += 3) ctx.lineTo(c[0] + x, c[1] + k * 5 + Math.sin(x * .3 + time * 1.5 + k) * .5); ctx.stroke(); }
    ctx.restore();
  }
  // Grün
  ctx.fillStyle = PAL.fringe; ell(hole.fringe); ctx.fill();
  ctx.fillStyle = PAL.green; ell(hole.green); ctx.fill();
  ctx.save(); ell(hole.green); ctx.clip(); ctx.fillStyle = PAL.greenL; for (let k = -20; k < 20; k += 2) { ctx.fillRect(hole.green.x - 20, hole.green.y + k * 1.5, 40, 1.5); } ctx.restore();
  // Gefälle auf dem Grün
  drawSlope();
  // Bunker
  for (const b of hole.bunkers) { ctx.fillStyle = PAL.sandD; ell(b, .5); ctx.fill(); ctx.fillStyle = PAL.sand; ctx.save(); ctx.translate(.25, .35); ell(b, 0); ctx.fill(); ctx.restore(); }
  // Loch + Fahne
  const [pxn, pyn] = hole.pin, cupR = Math.max(CUP, 3.5 * px);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.arc(pxn, pyn, cupR * 1.35, 0, TAU); ctx.fill();
  ctx.fillStyle = '#26302a'; ctx.beginPath(); ctx.arc(pxn, pyn, cupR, 0, TAU); ctx.fill();
  // Zielhilfe (unter Bäumen nicht nötig, aber unter Ball)
  if (state === 'aim' || state === 'swing') drawAim();
  if (state === 'putt') drawPuttAim();
  // Ball-Schatten
  const br = Math.max(.22, 3 * px) * (1 + ball.z * .02);
  if (state !== 'holed' || stateT < .15) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(ball.x + ball.z * .3 + .1 * br * 2, ball.y + ball.z * .45 + .15 * br * 2, br, br * .8, 0, 0, TAU); ctx.fill();
  }
  // Bäume (Schatten, dann Kronen)
  ctx.fillStyle = PAL.treeS;
  for (const t of hole.trees) { ctx.beginPath(); ctx.ellipse(t.x + t.h * .18, t.y + t.h * .26, t.r, t.r * .9, 0, 0, TAU); ctx.fill(); }
  for (const t of hole.trees) {
    ctx.fillStyle = PAL.tree; ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.treeL; ctx.beginPath(); ctx.arc(t.x - t.r * .22, t.y - t.r * .25, t.r * .62, 0, TAU); ctx.fill();
  }
  // Fahne
  const fl = 30 * px, near = hyp(ball.x - pxn, ball.y - pyn) < 6 && state !== 'aim';
  if (state !== 'holed') {
    ctx.globalAlpha = near ? .35 : 1;
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = Math.max(.15, 1.5 * px); ctx.beginPath(); ctx.moveTo(pxn, pyn); ctx.lineTo(pxn + fl * .35, pyn + fl * .25); ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(.15, 1.6 * px); ctx.beginPath(); ctx.moveTo(pxn, pyn); ctx.lineTo(pxn, pyn - fl); ctx.stroke();
    const [wx, wy] = wind(), wv = hyp(wx, wy), wd = wv ? Math.sign(wx || 1) : 1;
    const flap = Math.sin(time * (3 + wv * .2)) * fl * .04;
    ctx.fillStyle = '#e8503a'; ctx.beginPath(); ctx.moveTo(pxn, pyn - fl); ctx.lineTo(pxn + wd * fl * .5, pyn - fl * .87 + flap); ctx.lineTo(pxn, pyn - fl * .72); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Spur
  for (let i = 0; i < trail.length; i++) { const [tx, ty, tz] = trail[i], f = i / trail.length; ctx.fillStyle = 'rgba(255,255,255,' + f * .5 + ')'; ctx.beginPath(); ctx.arc(tx, ty - tz * .55, br * f * .8, 0, TAU); ctx.fill(); }
  // Ball
  if (state !== 'holed' || stateT < .15) {
    const by = ball.y - ball.z * .55;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ball.x, by, br, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = Math.max(.04, .8 * px); ctx.stroke();
  }
  // Partikel
  for (const p of parts) {
    const f = p.life / p.max;
    ctx.globalAlpha = Math.min(1, f * 1.5);
    if (p.ring) { ctx.strokeStyle = p.c; ctx.lineWidth = .3; ctx.beginPath(); ctx.arc(p.x, p.y, p.r0 + (1 - f) * p.grow, 0, TAU); ctx.stroke(); }
    else { ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // Bildschirm-Overlays
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  if (state === 'aim' || state === 'swing') drawTargetLabel();
  if (state === 'putt' && putDrag) drawPuttLabel();
  if (state === 'swing') drawMeter();
  if (state === 'flight' || state === 'roll') drawFlightInfo();
}
function drawSlope() {
  const g = hole.green, [sx, sy] = hole.slope, m = hyp(sx, sy); if (m < .05) return;
  const ux = sx / m, uy = sy / m;
  ctx.save(); ell(g); ctx.clip();
  ctx.strokeStyle = 'rgba(40,90,40,' + (.08 + m * .12) + ')'; ctx.lineWidth = .14;
  const off = (time * m * 1.2) % 3;
  for (let i = -16; i <= 16; i += 3) for (let j = -16; j <= 16; j += 3) {
    const cx = g.x + i + ux * off, cy = g.y + j + uy * off;
    ctx.beginPath(); ctx.moveTo(cx - ux * .3 - uy * .3, cy - uy * .3 + ux * .3); ctx.lineTo(cx + ux * .3, cy + uy * .3); ctx.lineTo(cx - ux * .3 + uy * .3, cy - uy * .3 - ux * .3); ctx.stroke();
  }
  ctx.restore();
}
function aimPath() {
  const c = CLUBS[clubI], S = [ball.x, ball.y], L = target, d = hyp(L[0] - S[0], L[1] - S[1]) || 1;
  const rx = (L[0] - S[0]) / d, ry = (L[1] - S[1]) / d, mid = [(S[0] + L[0]) / 2, (S[1] + L[1]) / 2], bow = -shape * d * .11;
  return { S, L, Cp: [mid[0] - ry * bow, mid[1] + rx * bow], d, c };
}
function drawAim() {
  const { S, L, Cp, d, c } = aimPath(), px = 1 / cam.s;
  // Bogen
  ctx.fillStyle = 'rgba(255,255,255,.95)';
  const n = Math.max(6, Math.floor(d / (9 * px * 1.6)));
  for (let i = 1; i < n; i++) { const t = i / n, [x, y] = bez(S, Cp, L, t); ctx.globalAlpha = .35 + .65 * Math.sin(t * Math.PI); ctx.beginPath(); ctx.arc(x, y, Math.max(.25, 1.9 * px), 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  // Streukreis
  const spread = Math.tan(c.sp * LIE[lie].s * (1 - .07 * stats().praez) * .55 * Math.PI / 180) * d + 1;
  ctx.fillStyle = 'rgba(255,255,255,.16)'; ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = Math.max(.12, 1.2 * px);
  ctx.beginPath(); ctx.ellipse(L[0], L[1], spread, spread * .75 + 1, Math.atan2(L[1] - S[1], L[0] - S[0]) + Math.PI / 2, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.lineWidth = Math.max(.15, 2 * px); ctx.strokeStyle = '#fff';
  const k = 6 * px; ctx.beginPath(); ctx.moveTo(L[0] - k, L[1]); ctx.lineTo(L[0] + k, L[1]); ctx.moveTo(L[0], L[1] - k); ctx.lineTo(L[0], L[1] + k); ctx.stroke();
}
function drawTargetLabel() {
  const [x, y] = toScreen(target[0], target[1]), d = Math.round(hyp(target[0] - ball.x, target[1] - ball.y));
  const t = d + ' m'; ctx.font = '800 13px -apple-system,Segoe UI,Roboto,sans-serif';
  const w = ctx.measureText(t).width + 16, yy = y - 30;
  ctx.fillStyle = 'rgba(31,42,34,.85)'; rr(x - w / 2, yy - 12, w, 24, 12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, yy + 1);
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function simPutt(a, tmax) {
  // Vorschau: gleiche Physik wie rollStep, aber ohne Effekte
  let x = ball.x, y = ball.y, vx = a.dx * a.v, vy = a.dy * a.v; const pts = [[x, y]]; const h = 1 / 60;
  for (let t = 0; t < tmax; t += h) {
    const l = lieAt(hole, x, y); const dec = LIE[l].dec; let sp = hyp(vx, vy);
    if (sp > 0) { const ns = Math.max(0, sp - dec * h); vx *= ns / sp; vy *= ns / sp; }
    if (l === 'green' && sp > .05) { vx += hole.slope[0] * h; vy += hole.slope[1] * h; }
    x += vx * h; y += vy * h; pts.push([x, y]);
    if (hyp(vx, vy) < .04 || l === 'water' || l === 'ob') break;
  }
  return pts;
}
function drawPuttAim() {
  const a = puttDragVec(); if (!a) return;
  const px = 1 / cam.s, pl = stats().putt;
  const flat = a.v * a.v / (2 * LIE.green.dec);
  ctx.fillStyle = '#fff';
  if (pl > 0) {
    const pts = simPutt(a, 99), n = Math.max(2, Math.floor(pts.length * Math.min(1, .2 * pl + .1)));
    for (let i = 4; i < n; i += 4) { ctx.globalAlpha = 1 - i / n * .7; ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], Math.max(.08, 1.8 * px), 0, TAU); ctx.fill(); }
  } else {
    const L = Math.min(flat, 40); for (let s = .6; s < L; s += Math.max(.35, 7 * px)) { ctx.globalAlpha = 1 - s / L * .7; ctx.beginPath(); ctx.arc(ball.x + a.dx * s, ball.y + a.dy * s, Math.max(.08, 1.8 * px), 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
function drawPuttLabel() {
  const a = puttDragVec(); if (!a) return;
  const flat = a.v * a.v / (2 * LIE.green.dec);
  const [x, y] = toScreen(ball.x, ball.y);
  ctx.font = '800 13px -apple-system,Segoe UI,Roboto,sans-serif'; const t = flat.toFixed(1) + ' m'; const w = ctx.measureText(t).width + 16;
  ctx.fillStyle = 'rgba(31,42,34,.85)'; rr(x - w / 2, y + 22, w, 24, 12); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y + 35);
  // Kraftbalken am Finger
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(putDrag.sx, putDrag.sy); ctx.lineTo(putDrag.x, putDrag.y); ctx.stroke();
}
function drawMeter() {
  const sb = safeBot(), bw = Math.min(W - 40, 420), x0 = (W - bw) / 2, y0 = H - sb - 150;
  ctx.fillStyle = 'rgba(255,255,255,.95)'; rr(x0 - 14, y0 - 34, bw + 28, 132, 20); ctx.fill();
  ctx.font = '800 12px -apple-system,Segoe UI,Roboto,sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = '#7b8378';
  ctx.fillText(swing.ph === 'power' ? 'KRAFT – tippen zum Stoppen' : 'GENAUIGKEIT – tippen in der Mitte', x0, y0 - 17);
  // Kraft
  const full = bw / 1.1, pv = swing.ph === 'power' ? swingVal() : swing.p;
  ctx.fillStyle = '#eef0ea'; rr(x0, y0, bw, 22, 11); ctx.fill();
  ctx.fillStyle = pv > 1 ? '#c8643b' : '#2f7d4f'; rr(x0, y0, Math.max(22, pv * full), 22, 11); ctx.fill();
  ctx.fillStyle = 'rgba(200,100,59,.18)'; ctx.fillRect(x0 + full, y0, bw - full, 22);
  ctx.fillStyle = '#1f2a22'; ctx.fillRect(x0 + swing.pt * full - 1.5, y0 - 5, 3, 32);
  ctx.textAlign = 'center'; ctx.fillStyle = '#7b8378'; ctx.fillText(Math.round(hyp(target[0] - ball.x, target[1] - ball.y)) + ' m', x0 + swing.pt * full, y0 + 36);
  // Genauigkeit
  const ay = y0 + 52, cx = x0 + bw / 2, half = bw / 2 / 1.3;
  ctx.fillStyle = '#eef0ea'; rr(x0, ay, bw, 14, 7); ctx.fill();
  const z = perfZone() * half;
  ctx.fillStyle = '#b9e3a0'; ctx.fillRect(cx - z, ay, z * 2, 14);
  ctx.fillStyle = '#1f2a22'; ctx.fillRect(cx - 1, ay - 3, 2, 20);
  if (swing.ph === 'acc' || swing.ph === 'done') { const av = swing.ph === 'acc' ? accVal() : swing.a; const nx = cx + clamp(av, -1.3, 1.3) * half; ctx.fillStyle = '#c8643b'; ctx.beginPath(); ctx.moveTo(nx, ay - 2); ctx.lineTo(nx - 6, ay - 11); ctx.lineTo(nx + 6, ay - 11); ctx.fill(); ctx.fillRect(nx - 1.5, ay, 3, 14); }
}
function drawFlightInfo() {
  if (!flight) return;
  const d = Math.round(hyp(ball.x - flight.S[0], ball.y - flight.S[1]));
  ctx.font = '900 15px -apple-system,Segoe UI,Roboto,sans-serif'; const t = d + ' m'; const w = ctx.measureText(t).width + 22;
  const y = H - safeBot() - 40;
  ctx.fillStyle = 'rgba(31,42,34,.8)'; rr(W / 2 - w / 2, y - 15, w, 30, 15); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, W / 2, y + 1);
}

// ---------------- UI ----------------
const hud = $('#hud'), panel = $('#panel');
let toastT = 0;
function toast(t, sub, ms = 1000) { const el = $('#toast'); el.innerHTML = t + (sub ? '<small>' + sub + '</small>' : ''); el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), ms); }
const fmtD = d => d === 0 ? 'E' : d > 0 ? '+' + d : '−' + (-d);
function totalDiff() { let d = 0; round.scores.forEach((s, i) => d += s - round.holes[i].par); return d; }
function updHud() {
  if (!hole) return;
  $('#hTitle').textContent = 'Loch ' + (hi + 1) + ' · Par ' + hole.par + ' · ' + hole.len + ' m';
  const dPin = hyp(hole.pin[0] - ball.x, hole.pin[1] - ball.y);
  $('#hSub').textContent = (strokes === 0 ? 'Abschlag' : LIE[lie].n) + ' · ' + (dPin < 30 ? dPin.toFixed(1) : Math.round(dPin)) + ' m zur Fahne';
  $('#scoreT').textContent = fmtD(totalDiff());
  $('#strokeT').textContent = 'SCHLAG ' + (strokes + 1);
  const w = hole.wind; $('#windT').textContent = w.v + ' km/h';
  $('#wind i').style.transform = 'rotate(' + (w.a + Math.PI / 2) + 'rad)';
  $('#wind i').style.opacity = w.v ? 1 : .2;
}
function updPanel() {
  if (!hole) return;
  const aim = state === 'aim', putt = state === 'putt';
  $('#aimCard').classList.toggle('hidden', !aim);
  $('#puttCard').classList.toggle('hidden', !putt);
  panel.classList.toggle('hidden', !(aim || putt));
  if (aim) {
    const c = CLUBS[clubI];
    $('#clubN').textContent = c.n;
    $('#clubD').textContent = 'max. ' + Math.round(carry(c)) + ' m' + (lie === 'rough' ? ' (Rough)' : lie === 'sand' ? ' (Bunker)' : '');
    document.querySelectorAll('#shapeSeg button').forEach(b => b.classList.toggle('on', +b.dataset.sh === shape));
    const sl = stats().spin; $('#spinSeg').classList.toggle('lock', !sl);
    document.querySelectorAll('#spinSeg button').forEach(b => { b.classList.toggle('on', +b.dataset.sp === spin); });
  }
  if (putt) {
    const al = allowedClubs(); $('#chipBtn').classList.toggle('hidden', !(lie === 'fringe' || lie === 'fairway'));
    $('#puttT').textContent = 'Zurückziehen und loslassen zum Putten';
  }
}
$('#cPrev').onclick = () => cycleClub(1);
$('#cNext').onclick = () => cycleClub(-1);
function cycleClub(dir) {
  const al = allowedClubs(); let k = al.indexOf(clubI); k = clamp(k + dir, 0, al.length - 1); const ni = al[k];
  if (CLUBS[ni].putter) { clubI = ni; enterPutt(); return; }
  clubI = ni;
  const d = hyp(target[0] - ball.x, target[1] - ball.y) || 1, nd = carry(CLUBS[clubI]);
  const dPin = hyp(hole.pin[0] - ball.x, hole.pin[1] - ball.y);
  const useD = nd >= dPin ? Math.min(nd, d) : nd;
  target = [ball.x + (target[0] - ball.x) / d * useD, ball.y + (target[1] - ball.y) / d * useD];
  updPanel();
}
$('#chipBtn').onclick = () => { state = 'aim'; const al = allowedClubs().filter(i => !CLUBS[i].putter); target = [...hole.pin]; clubI = autoClub(hyp(target[0] - ball.x, target[1] - ball.y)); if (!al.includes(clubI)) clubI = al[al.length - 1]; updPanel(); };
$('#shapeSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; shape = +b.dataset.sh; updPanel(); };
$('#spinSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (!stats().spin) { toast('Spin gesperrt', 'Im Pro-Shop freischalten', 1200); return; } spin = +b.dataset.sp; updPanel(); };
$('#swingBtn').onclick = () => startSwing();
$('#ovBtn').onclick = () => { overview = !overview; };
$('#menuBtn').onclick = () => showOv(`<div class="big" style="font-size:28px">Runde abbrechen?</div><div class="sub">${round.mode === 'daily' ? 'Die Tagesrunde zählt erst, wenn du alle 9 Löcher spielst.' : 'Der Fortschritt dieser Runde geht verloren.'}</div>
  <div class="btns"><button class="btn" data-a="resume">Weiterspielen</button><button class="btn g" data-a="quit">Zum Menü</button></div>`);

function holeDone(score) {
  state = 'wait';
  round.scores[hi] = score; updHud();
  const d = score - hole.par;
  if (d === -1) save.birdies++; if (d <= -2) save.eagles++; if (score === 1) save.hio++;
  persist();
  const name = scoreName(score, hole.par);
  const last = hi === round.holes.length - 1;
  showOv(`<div class="big" style="color:${d < 0 ? 'var(--acc)' : d > 0 ? 'var(--warn)' : 'var(--ink)'}">${name}</div>
    <div class="sub">Loch ${hi + 1} · ${score} ${score === 1 ? 'Schlag' : 'Schläge'} · Gesamt ${fmtD(totalDiff())}</div>
    ${cardHtml()}
    <div class="btns"><button class="btn" data-a="${last ? 'finish' : 'next'}">${last ? 'Runde abschliessen' : 'Loch ' + (hi + 2) + ' →'}</button></div>`);
}
const NAMES = { '-3': 'Albatros', '-2': 'Eagle', '-1': 'Birdie', '0': 'Par', '1': 'Bogey', '2': 'Doppel-Bogey', '3': 'Triple-Bogey' };
function scoreName(s, par) { if (s === 1) return 'Hole-in-One!'; const d = s - par; return NAMES[d] || (d > 0 ? '+' + d : String(d)); }
function sqClass(s, par) { const d = s - par; return d <= -2 ? 's-e' : d === -1 ? 's-b' : d === 0 ? 's-p' : d === 1 ? 's-o' : 's-d'; }
function cardHtml() {
  const hs = round.holes;
  const cell = (i) => { const s = round.scores[i]; return s == null ? '<td>·</td>' : `<td><span class="sq ${sqClass(s, hs[i].par)}">${s}</span></td>`; };
  return `<table class="sc"><tr><td>Loch</td>${hs.map((_, i) => `<td>${i + 1}</td>`).join('')}</tr>
    <tr><td>Par</td>${hs.map(h => `<td>${h.par}</td>`).join('')}</tr>
    <tr><td>Du</td>${hs.map((_, i) => cell(i)).join('')}</tr></table>`;
}
function coinsFor(s, par) { if (s === 1) return 80; const d = s - par; return d <= -2 ? 40 : d === -1 ? 18 : d === 0 ? 8 : d === 1 ? 3 : 1; }
function finishRound() {
  const tot = round.scores.reduce((a, b) => a + b, 0), par = round.holes.reduce((a, h) => a + h.par, 0), d = tot - par;
  let coins = round.scores.reduce((a, s, i) => a + coinsFor(s, round.holes[i].par), 0), extra = '', first = false;
  save.rounds++;
  if (round.mode === 'daily') {
    const n = round.n;
    if (save.daily[n] == null) { first = true; save.daily[n] = { s: round.scores.slice(), p: round.holes.map(h => h.par) }; save.streak = save.lastDaily === n - 1 ? save.streak + 1 : 1; save.lastDaily = n; coins = coins * 2 + 20; extra = '🔥 Serie: ' + save.streak + (save.streak === 1 ? ' Tag' : ' Tage'); }
    else { coins = Math.ceil(coins / 3); extra = 'Übungsrunde – gewertet ist deine erste'; }
  } else if (round.mode === 'tour') {
    const t = TOUR[round.ti], made = d <= t.cut, prev = save.career[round.ti];
    if (made) { coins += prev && prev.made ? Math.round(t.prize / 4) : t.prize; extra = '🏆 Ziel geschafft (' + fmtD(t.cut) + ')' + (prev && prev.made ? '' : ' · Preisgeld ' + t.prize); }
    else extra = 'Ziel verpasst: ' + fmtD(t.cut) + ' oder besser';
    if (!prev || d < prev.best) save.career[round.ti] = { best: d, made: made || !!(prev && prev.made) };
    else if (made) save.career[round.ti].made = true;
  } else coins = Math.ceil(coins / 2);
  if (save.best == null || d < save.best) save.best = d;
  save.coins += coins; persist();
  later(300, () => Snd.coin());
  const btns = round.mode === 'daily'
    ? `<button class="btn" data-a="share">Ergebnis teilen</button><button class="btn g" data-a="home">Zum Menü</button>`
    : `<button class="btn" data-a="again">Nochmal spielen</button><button class="btn g" data-a="${round.mode === 'tour' ? 'career' : 'home'}">${round.mode === 'tour' ? 'Zur Tour' : 'Zum Menü'}</button>`;
  showOv(`<div class="sub" style="margin:0">${round.label}</div><div class="big">${fmtD(d)} <span style="font-size:22px;color:var(--soft)">(${tot})</span></div>
    <div class="sub">${extra}</div>${cardHtml()}<div class="chip">+${coins} Münzen</div><div class="btns">${btns}</div>`);
}
function shareText() {
  const n = round.n, rec = save.daily[n] || { s: round.scores, p: round.holes.map(h => h.par) };
  const tot = rec.s.reduce((a, b) => a + b, 0), par = rec.p.reduce((a, b) => a + b, 0);
  const em = rec.s.map((s, i) => { const d = s - rec.p[i]; return d <= -2 ? '🟦' : d === -1 ? '🟩' : d === 0 ? '⬜' : d === 1 ? '🟧' : '🟥'; }).join('');
  return `⛳ Fairway – Tagesrunde #${n}\n${fmtD(tot - par)} (${tot})\n${em}\n🔥 ${save.streak}`;
}
function showOv(html) { $('#ovCard').innerHTML = html; $('#ov').classList.remove('hidden'); }
function hideOv() { $('#ov').classList.add('hidden'); }
$('#ov').addEventListener('click', async e => {
  const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
  if (a === 'share') { const t = shareText(); let ok = false; try { if (navigator.share) { await navigator.share({ text: t }); ok = true; } } catch (_) {} if (!ok) try { await navigator.clipboard.writeText(t); b.textContent = 'Kopiert ✓'; } catch (_) { b.textContent = 'Teilen nicht möglich'; } return; }
  hideOv();
  if (a === 'resume') return;
  if (a === 'next') startHole(hi + 1);
  else if (a === 'finish') finishRound();
  else if (a === 'again') startRound(round.mode, round.mode === 'tour' ? { i: round.ti } : {});
  else if (a === 'career') showScreen('career');
  else showScreen('home');
});

function enterPlay() { mode = 'play'; ['home', 'career', 'shop'].forEach(id => $('#' + id).classList.add('hidden')); hud.classList.remove('hidden'); panel.classList.remove('hidden'); }

// ---------------- Menüs ----------------
const logo = `<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="19" fill="#2f7d4f"/><path d="M17 8v22" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><path d="M17 8l10 4-10 4z" fill="#e8503a"/><ellipse cx="20" cy="30.5" rx="7" ry="2.2" fill="#1f2a22" opacity=".35"/></svg>`;
const coinsHtml = () => `<div class="coins">🪙 ${save.coins}</div>`;
function showScreen(name) {
  mode = 'menu'; round = null; hole = null; timers = [];
  hud.classList.add('hidden'); panel.classList.add('hidden'); hideOv();
  ['home', 'career', 'shop'].forEach(id => $('#' + id).classList.toggle('hidden', id !== name));
  ({ home: renderHome, career: renderCareer, shop: renderShop })[name]();
}
function renderHome() {
  const n = dayNum(), rec = save.daily[n];
  const streak = (save.lastDaily === n || save.lastDaily === n - 1) ? save.streak : 0;
  let st = 'Neuer Platz · 9 Löcher · gleiche Ausrüstung für alle';
  if (rec) { const t = rec.s.reduce((a, b) => a + b, 0), p = rec.p.reduce((a, b) => a + b, 0); st = 'Gespielt: ' + fmtD(t - p) + ' (' + t + ')'; }
  const made = TOUR.filter((_, i) => save.career[i] && save.career[i].made).length;
  $('#home').innerHTML = `<div class="wrap">
    <div class="top"><div style="flex:1"></div>${coinsHtml()}<button class="pill ib" id="mute">${save.muted ? '🔇' : '🔊'}</button></div>
    <div class="logo">${logo}Fairway</div>
    <div class="tag">Jeden Tag ein neuer Platz. Neun Löcher. Ein Versuch.</div>
    <div class="card daily"><div class="k">Heute${streak ? ' · 🔥 ' + streak : ''}</div><div class="t">Tagesrunde #${n}</div><div class="s">${st}</div>
      <button class="btn w" data-go="daily">${rec ? 'Nochmal üben' : 'Abschlagen'}</button></div>
    <div class="card"><button class="mi" data-go="career"><div class="ic">🏆</div><div class="tx"><b>Karriere</b><span>${made}/${TOUR.length} Turniere geschafft</span></div><div class="ar">›</div></button></div>
    <div class="card"><button class="mi" data-go="train"><div class="ic">🏌️</div><div class="tx"><b>Training</b><span>Zufälliger Platz mit deinen Werten</span></div><div class="ar">›</div></button></div>
    <div class="card"><button class="mi" data-go="shop"><div class="ic">🛍️</div><div class="tx"><b>Pro-Shop</b><span>Kraft, Präzision, Spin, Putten</span></div><div class="ar">›</div></button></div>
    <div class="card stat"><div><b>${save.rounds}</b><span>Runden</span></div><div><b>${save.birdies}</b><span>Birdies</span></div><div><b>${save.best == null ? '–' : fmtD(save.best)}</b><span>Bestes</span></div></div>
    <p style="color:var(--soft);font-size:12.5px;font-weight:600;text-align:center;line-height:1.5">Ziel antippen · „Schlagen“ · 1. Tipp = Kraft, 2. Tipp = Genauigkeit<br>Auf dem Grün: zurückziehen und loslassen</p>
  </div>`;
}
function renderCareer() {
  $('#career').innerHTML = `<div class="wrap"><div class="top"><button class="pill ib" data-go="home">‹</button><h2>Karriere</h2>${coinsHtml()}</div>
    ${TOUR.map((t, i) => {
      const r = save.career[i], lock = i > 0 && !(save.career[i - 1] && save.career[i - 1].made);
      return `<div class="card ev ${lock ? 'lock' : ''}"><div class="no">${lock ? '🔒' : r && r.made ? '✓' : i + 1}</div><div class="tx"><b>${t.n}</b><span>Ziel ${fmtD(t.cut)} · Preisgeld ${t.prize}${r ? ' · Bestes ' + fmtD(r.best) : ''}</span></div>
        <button class="sbtn ${lock ? 'dis' : ''}" data-tour="${i}" ${lock ? 'disabled' : ''}>Spielen</button></div>`;
    }).join('')}
    <p style="color:var(--soft);font-size:13px;font-weight:600;text-align:center">Jedes Turnier ist ein fester 9-Loch-Platz. Schaffe das Ziel, um das nächste freizuschalten.<br>Wind, Wasser und Gefälle werden von Turnier zu Turnier härter.</p></div>`;
}
function renderShop() {
  $('#shop').innerHTML = `<div class="wrap"><div class="top"><button class="pill ib" data-go="home">‹</button><h2>Pro-Shop</h2>${coinsHtml()}</div>
    ${ATTRS.map(a => {
      const L = save.at[a.id], max = L >= 5, cost = max ? 0 : COSTS[L], can = !max && save.coins >= cost;
      return `<div class="card sk"><div class="ic">${a.ic}</div><div class="tx"><b>${a.n}</b><p>${a.d}</p><div class="dots">${[0, 1, 2, 3, 4].map(i => `<i class="${i < L ? 'f' : ''}"></i>`).join('')}</div>
        <button class="sbtn ${can ? '' : 'dis'}" data-buy="${a.id}" ${can ? '' : 'disabled'}>${max ? 'Maximal' : 'Stufe ' + (L + 1) + ' · ' + cost + ' 🪙'}</button></div></div>`;
    }).join('')}
    <p style="color:var(--soft);font-size:13px;font-weight:600;text-align:center">Gilt für Karriere und Training. In der Tagesrunde spielen alle mit derselben Ausrüstung (Stufe 1).</p></div>`;
}
document.addEventListener('click', e => {
  if (e.target.closest('#mute')) { save.muted = !save.muted; persist(); renderHome(); return; }
  const g = e.target.closest('[data-go]'), t = e.target.closest('[data-tour]'), b = e.target.closest('[data-buy]');
  if (g) { Snd.init(); const v = g.dataset.go; if (v === 'daily') startRound('daily'); else if (v === 'train') startRound('train'); else showScreen(v); }
  else if (t) { Snd.init(); startRound('tour', { i: +t.dataset.tour }); }
  else if (b) { const id = b.dataset.buy, L = save.at[id]; if (L < 5 && save.coins >= COSTS[L]) { save.coins -= COSTS[L]; save.at[id] = L + 1; persist(); Snd.coin(); buzz(20); renderShop(); } }
});

// Test-Hook
window.__fw = {
  get state() { return state; }, get ball() { return ball; }, get hole() { return hole; }, get strokes() { return strokes; }, get round() { return round; }, get lie() { return lie; }, get save() { return save; },
  get target() { return target; }, set target(v) { target = v; }, get club() { return clubI; }, set club(v) { clubI = v; },
  startRound, genCourse, lieAt, update, autoClub, carry: c => carry(CLUBS[c]),
  hit(p, a) { startSwing(); swing.p = p; swing.a = a; swing.ph = 'done'; hitBall(); },
  putt(dx, dy, v) { const l = hyp(dx, dy); doPutt({ dx: dx / l, dy: dy / l, v, p: 1 }); },
  run(maxT = 30) { for (let t = 0; t < maxT && !['aim', 'putt', 'wait', 'holed'].includes(state); t += 1 / 60) update(1 / 60); for (let i = 0; i < 200 && state === 'wait'; i++) { update(1 / 60); } },
  holeDone, finishRound, setupShot,
};

resize();
showScreen('home');
requestAnimationFrame(frame);
})();
