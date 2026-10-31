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
  W = innerWidth;
  H = innerHeight;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  _st = _sb = null;
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 300));
if (window.visualViewport) visualViewport.addEventListener('resize', resize);

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
const KEY = 'fairway_v2';
const defSave = () => ({ money: 0, earnings: 0, xp: 0, lvl: 1, sp: 1, at: { kraft: 0, praez: 0, spin: 0, putt: 0, nerven: 0 },
  gear: { driver: 0, woods: 0, irons: 0, wedges: 0, putter: 0 }, owned: { driver: [0], woods: [0], irons: [0], wedges: [0], putter: [0] },
  results: {}, tourOpen: 0, wins: 0, muted: false, rounds: 0, birdies: 0, eagles: 0, hio: 0, best: null,
  st: newSt(), hist: [], hcpHist: [] });
function newSt() { return { holes: 0, firN: 0, fir: 0, girN: 0, gir: 0, putts: 0, p1: 0, p3: 0, scrN: 0, scr: 0, sandN: 0, sandS: 0, chip: 0, pen: 0, drives: 0, driveSum: 0, driveMax: 0, proxN: 0, proxSum: 0, swings: 0, perfect: 0, par3: [0, 0], par4: [0, 0], par5: [0, 0], dist: { e: 0, b: 0, p: 0, bo: 0, d: 0 }, rounds9: 0, sum9: 0 }; }
let save = defSave();
try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) { const d = defSave(); save = Object.assign(d, s); save.at = Object.assign(d.at, s.at || {}); save.gear = Object.assign(d.gear, s.gear || {}); save.owned = Object.assign(d.owned, s.owned || {}); save.st = Object.assign(newSt(), s.st || {}); } } catch (e) {}
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
const buzz = ms => {
  try {
    const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
    if (H) { const m = Array.isArray(ms) ? 40 : ms; H.impact({ style: m >= 30 ? 'HEAVY' : m >= 15 ? 'MEDIUM' : 'LIGHT' }); return; }
    navigator.vibrate && navigator.vibrate(ms);
  } catch (e) {}
};

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
  { id: 'kraft', ic: '💪', n: 'Kraft', d: '+1,5 % Weite mit allen Schlägern pro Punkt.' },
  { id: 'praez', ic: '🎯', n: 'Präzision', d: 'Weniger Streuung und eine breitere „Perfekt“-Zone.' },
  { id: 'spin', ic: '🌀', n: 'Spin', d: 'Ab 2 Punkten Back- und Topspin. Mehr Punkte = stärkerer Effekt, ab 6 zieht der Ball auf dem Grün zurück.' },
  { id: 'putt', ic: '⛳', n: 'Putten', d: 'Längere Puttlinie mit Gefälle, das Loch schluckt schnellere Bälle.' },
  { id: 'nerven', ic: '🧊', n: 'Nerven', d: 'Der Schwungmeter läuft ruhiger, Timing wird leichter.' },
];
const AMAX = 10;
// Ausrüstung: 5 Modelle pro Slot (eigene Fantasienamen)
const GEAR = {
  driver: { n: 'Driver', ic: '🚀', clubs: ['D'], m: [
    { n: 'Rookie 460', p: 0, dist: 0, acc: 0 }, { n: 'Kestrel Speed', p: 600, dist: .03, acc: .02 }, { n: 'Basalt TX', p: 1800, dist: .055, acc: .04 },
    { n: 'Nordwind Pro', p: 4500, dist: .08, acc: .07 }, { n: 'Halcyon Tour', p: 10000, dist: .11, acc: .1 }] },
  woods: { n: 'Hölzer', ic: '🪵', clubs: ['3W'], m: [
    { n: 'Rookie 3', p: 0, dist: 0, acc: 0 }, { n: 'Kestrel 3+', p: 450, dist: .03, acc: .03 }, { n: 'Basalt F', p: 1400, dist: .05, acc: .05 },
    { n: 'Nordwind Fairway', p: 3600, dist: .07, acc: .08 }, { n: 'Halcyon Spoon', p: 8000, dist: .09, acc: .11 }] },
  irons: { n: 'Eisen', ic: '🗡️', clubs: ['5I', '7I', '9I'], m: [
    { n: 'Rookie Set', p: 0, dist: 0, acc: 0 }, { n: 'Forge CB', p: 700, dist: .02, acc: .04 }, { n: 'Forge MB', p: 2200, dist: .035, acc: .07 },
    { n: 'Glacier Blades', p: 5200, dist: .05, acc: .1 }, { n: 'Halcyon Irons', p: 11000, dist: .065, acc: .14 }] },
  wedges: { n: 'Wedges', ic: '🥄', clubs: ['PW', 'SW', 'LW'], m: [
    { n: 'Rookie Wedge', p: 0, dist: 0, acc: 0, spin: 0 }, { n: 'Grip 52/56', p: 500, dist: 0, acc: .04, spin: 1 }, { n: 'Raw Spin', p: 1600, dist: .01, acc: .07, spin: 1 },
    { n: 'Glacier Groove', p: 4000, dist: .015, acc: .1, spin: 2 }, { n: 'Halcyon Touch', p: 9000, dist: .02, acc: .13, spin: 3 }] },
  putter: { n: 'Putter', ic: '🎳', clubs: ['P'], m: [
    { n: 'Rookie Blade', p: 0, cap: 0, prev: 0 }, { n: 'Pendel 2', p: 400, cap: .1, prev: .08 }, { n: 'Mallet One', p: 1300, cap: .2, prev: .15 },
    { n: 'Stillwater', p: 3500, cap: .3, prev: .25 }, { n: 'Halcyon Milled', p: 8500, cap: .45, prev: .38 }] },
};
const slotOf = id => Object.keys(GEAR).find(k => GEAR[k].clubs.includes(id));
const gearM = slot => GEAR[slot].m[save.gear[slot] || 0];
const gearC = c => gearM(slotOf(c.id));
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
LIE.waste = { n: 'Waste Area', d: .85, s: 1.3, roll: .35, dec: 22 };
// Landschafts-Themen: Farben, Bäume, Gefahren, Höhenunterschiede, Wettertendenz
const BASEPAL = { deep: '#3f6f3c', rough: '#79b062', roughL: '#82b86a', cut: '#8cc46d', fw: '#9fd27a', fwL: '#a9d985', fringe: '#9dd078', green: '#b6e391', greenL: '#bee899', sand: '#f0e2b4', sandD: '#ddc98e', water: '#5ab4dc', waterD: '#4aa2cb', tree: '#3d8547', treeL: '#4f9354', treeS: 'rgba(20,50,25,.28)', tee: '#a9d985', waste: '#d9c99a', wasteD: '#c4b07c', forest: '#2f6e3a', beach: '#efe2bb' };
const THEMES = {
  park: { n: 'Parkland', ic: '🌳', grad: ['#26422f', '#1c2b22'], pal: {}, tree: 'oak', cols: ['#3d8547', '#468f4d', '#357a40'], deco: 'oak', decoD: 1, trees: 1, water: 1, waste: 0, ocean: 0, rocks: 0, elev: 9, wind: 1,
    wx: { sonnig: 4, 'bewölkt': 2, windig: 1, regen: 1, abend: 1 } },
  links: { n: 'Links', ic: '🌊', grad: ['#2f4a3d', '#1c2b22'], pal: { deep: '#6f8a52', rough: '#a3b76c', roughL: '#adc078', cut: '#b2c97f', fw: '#b9d38a', fwL: '#c2da95', fringe: '#b5d48a', green: '#c6e39b', greenL: '#cde8a4', sand: '#ece0b8', sandD: '#d8c896', water: '#3f8fb5', waterD: '#2f7aa0', tee: '#c2da95', forest: '#5f7a3a', waste: '#e2d6a8', wasteD: '#cdbf8c' },
    tree: 'gorse', cols: ['#6f8f35', '#7a9a3a'], deco: 'gorse', decoD: .7, trees: .55, water: .5, waste: .9, ocean: 1, rocks: 0, elev: 6, wind: 1.45,
    wx: { windig: 3, sturm: 2, 'bewölkt': 2, sonnig: 1, regen: 1 } },
  desert: { n: 'Wüste', ic: '🌵', grad: ['#4a3622', '#2a2118'], pal: { deep: '#c99a62', rough: '#d9b47c', roughL: '#e0bd88', cut: '#a7c977', fw: '#9fcf6e', fwL: '#a9d679', fringe: '#9ccd6c', green: '#b2e08a', greenL: '#bbe693', sand: '#f5dca8', sandD: '#e2c287', water: '#3fb2c4', waterD: '#2e9fb2', tee: '#a9d679', forest: '#9a7a48', waste: '#e7c690', wasteD: '#d4ae73', treeS: 'rgba(90,50,10,.25)' },
    tree: 'cactus', cols: ['#4f8f4a', '#5a9a52'], deco: 'cactus', decoD: .35, trees: .6, water: .45, waste: 1.4, ocean: 0, rocks: .6, elev: 10, wind: .9,
    wx: { hitze: 4, sonnig: 3, windig: 1, abend: 1 } },
  alpine: { n: 'Alpen', ic: '🏔️', grad: ['#24384a', '#1a2530'], pal: { deep: '#2f5338', rough: '#6fa565', roughL: '#78ad6e', cut: '#84ba72', fw: '#93c977', fwL: '#9dd182', fringe: '#93c876', green: '#aedd8a', greenL: '#b6e293', water: '#4fa8d8', waterD: '#3d93c4', forest: '#24503a', tee: '#9dd182' },
    tree: 'pine', cols: ['#2f6a43', '#2a6240', '#357248'], deco: 'pine', decoD: 1.2, trees: 1.15, water: .9, waste: 0, ocean: 0, rocks: 1, elev: 34, wind: 1.1,
    wx: { sonnig: 3, nebel: 2, 'bewölkt': 2, windig: 1, regen: 1 } },
  tropic: { n: 'Tropen', ic: '🌴', grad: ['#1f4a44', '#16302c'], pal: { deep: '#2c6e4c', rough: '#6cbf68', roughL: '#77c872', cut: '#80cf74', fw: '#8fe07a', fwL: '#9be784', fringe: '#90de78', green: '#a8ee8e', greenL: '#b2f297', sand: '#fbf4de', sandD: '#ecdfbd', water: '#2fc0cf', waterD: '#21a9b9', tee: '#9be784', forest: '#2a6a44', beach: '#fbf1d6' },
    tree: 'palm', cols: ['#3f9a4a', '#4aa552'], deco: 'palm', decoD: .9, trees: .8, water: 1.2, waste: 0, ocean: 1, rocks: 0, elev: 7, wind: 1,
    wx: { sonnig: 3, regen: 2, windig: 1, hitze: 1, abend: 1 } },
  autumn: { n: 'Herbstwald', ic: '🍂', grad: ['#4a3420', '#2a2018'], pal: { deep: '#4f5a30', rough: '#8aa85e', roughL: '#93b067', cut: '#9cbd6c', fw: '#a8cf7a', fwL: '#b1d684', fringe: '#a6cd77', green: '#bde48f', greenL: '#c4e898', forest: '#8a4f24', tee: '#b1d684' },
    tree: 'oak', cols: ['#d9772b', '#e3a52f', '#b8462e', '#c98c2a', '#7a8f3a', '#d65f2a'], deco: 'oak', decoD: 1.1, trees: 1.05, water: .8, waste: 0, ocean: 0, rocks: 0, elev: 14, wind: 1,
    wx: { 'bewölkt': 3, sonnig: 2, regen: 1, nebel: 1, windig: 1, abend: 1 } },
};
const WX = {
  sonnig: { ic: '☀️', n: 'Sonnig', w: [0, 12] },
  'bewölkt': { ic: '⛅', n: 'Bewölkt', w: [2, 16], tint: 'rgba(60,70,85,.10)' },
  windig: { ic: '💨', n: 'Windig', w: [12, 28], gust: .3 },
  sturm: { ic: '🌪️', n: 'Sturm', w: [24, 40], gust: .45, tint: 'rgba(50,60,75,.16)' },
  regen: { ic: '🌧️', n: 'Regen', w: [4, 18], rain: 1, tint: 'rgba(40,60,90,.14)' },
  nebel: { ic: '🌫️', n: 'Nebel', w: [0, 8], fog: 1 },
  hitze: { ic: '🔥', n: 'Hitze', w: [0, 10], carry: 1.04, roll: 1.25, tint: 'rgba(255,170,60,.07)' },
  abend: { ic: '🌇', n: 'Abendsonne', w: [0, 12], tint: 'rgba(255,130,50,.13)' },
};
const wxIc = x => (WX[x] || WX.sonnig).ic, wxN = x => (WX[x] || WX.sonnig).n;
function pickWx(th, r) { const t = THEMES[th].wx, ks = Object.keys(t), tot = ks.reduce((a, k) => a + t[k], 0); let v = r() * tot; for (const k of ks) { v -= t[k]; if (v <= 0) return k; } return ks[0]; }
// Plätze (Fantasienamen)
const COURSES = [
  { id: 'lakeside', n: 'Lakeside Golf Club', th: 'park', loc: 'Seenland', d: .15, lenF: .93 },
  { id: 'birkenhof', n: 'Golfpark Birkenhof', th: 'autumn', loc: 'Mittelgebirge', d: .22, lenF: .95 },
  { id: 'heideland', n: 'Heideland Links', th: 'links', loc: 'Nordheide', d: .28, lenF: .95 },
  { id: 'seewinkel', n: 'Seewinkel Links', th: 'links', loc: 'Küste Nord', d: .35, lenF: 1 },
  { id: 'kuestenwind', n: 'Küstenwind Dunes', th: 'links', loc: 'Westküste', d: .42, lenF: 1 },
  { id: 'steinbruch', n: 'Steinbruch Canyon', th: 'desert', loc: 'Rote Schlucht', d: .48, lenF: 1 },
  { id: 'alpensee', n: 'Alpensee Golf', th: 'alpine', loc: 'Hochtal', d: .54, lenF: 1.02 },
  { id: 'ahornhain', n: 'Ahornhain Country Club', th: 'autumn', loc: 'Ahorntal', d: .6, lenF: 1.04 },
  { id: 'coralbay', n: 'Coral Bay Resort', th: 'tropic', loc: 'Korallenbucht', d: .65, lenF: 1.04 },
  { id: 'desertrose', n: 'Desert Rose', th: 'desert', loc: 'Oase', d: .72, lenF: 1.06 },
  { id: 'highland', n: 'Highland Peaks', th: 'alpine', loc: 'Gipfelland', d: .8, lenF: 1.06 },
  { id: 'crown', n: 'The Crown National', th: 'park', loc: 'Königsforst', d: .92, lenF: 1.08 },
  { id: 'palmcove', n: 'Palm Cove', th: 'tropic', loc: 'Lagune', d: .4, lenF: .98 },
  { id: 'redmesa', n: 'Red Mesa', th: 'desert', loc: 'Tafelberge', d: .58, lenF: 1.03 },
];
const CRS = Object.fromEntries(COURSES.map(c => [c.id, c]));
const courseSeed = id => { let h = 2166136261; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % 1e9; };

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

function genHole(r, par, diff, wx = 'sonnig', opt = {}) {
  const ri = (a, b) => a + r() * (b - a), sgn = () => r() < .5 ? -1 : 1;
  const th = opt.th || 'park', T = THEMES[th], lf = opt.lenF || 1;
  const len = (par === 3 ? ri(95, 205) : par === 4 ? ri(285, 440) : ri(445, 565)) * (opt.straight || opt.water ? 1 : lf);
  let P;
  if (par === 3) P = [[0, 0], [ri(-6, 6), -len * .5], [ri(-22, 22), -len]];
  else if (par === 4) { const bend = r() < .75, t = ri(.56, .66), bx = bend ? sgn() * ri(22, 55) : ri(-8, 8); P = [[0, 0], [ri(-4, 4), -len * .3], [ri(-6, 6), -len * t], [bx, -len]]; }
  else if (opt.straight) P = [[0, 0], [0, -len * .33], [ri(-3, 3), -len * .66], [ri(-5, 5), -len]];
  else { const b1 = sgn() * ri(15, 40), b2 = b1 + sgn() * ri(15, 45); P = [[0, 0], [0, -len * .25], [b1 * .2, -len * .48], [b1, -len * .7], [b2, -len]]; }
  // Mittellinie + 45 m Verlängerung hinter dem Grün
  let C = resample(catmull(P), 4);
  const Lg = C[C.length - 1][2];
  { const a = C[C.length - 2], b = C[C.length - 1], dx = b[0] - a[0], dy = b[1] - a[1], l = hyp(dx, dy); for (let k = 1; k <= 11; k++) C.push([b[0] + dx / l * 4 * k, b[1] + dy / l * 4 * k, Lg + 4 * k]); }
  const h = { par, C, Lg, len: Math.round(Lg), diff, bunkers: [], water: [], trees: [], waste: [], th };
  h.elev = Math.round(ri(-1, 1) * T.elev * (par === 3 ? 1.2 : 1));
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
  { const W = WX[wx] || WX.sonnig, a = opt.windA != null ? opt.windA + ri(-.6, .6) : ri(0, TAU), v = ri(W.w[0], W.w[1]) * T.wind * (.85 + diff * .3);
    h.wind = { a, v: Math.round(v), a0: a, v0: v, gust: W.gust || 0 }; h.rain = !!W.rain; h.wx = wx; }
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
  if (!opt.noWater && (opt.water || r() < (.25 + diff * .55) * T.water)) {
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
  // Meer an einer Seite (Links/Tropen)
  if (T.ocean && !opt.noWater && r() < .7) {
    const side = sgn(), L = [], R = [];
    for (let ss = -30; ss <= Lg + 60; ss += 8) {
      const p = at(clamp(ss, 0, C[C.length - 1][2])), e = OBW * .62 + Math.sin(ss * .03 + 1) * 6 + Math.sin(ss * .09) * 2;
      const by = ss < 0 ? -ss : 0;
      L.push([p.x + p.nx * side * e, p.y + p.ny * side * e + by]); R.push([p.x + p.nx * side * (OBW + 90), p.y + p.ny * side * (OBW + 90) + by]);
    }
    const ocean = { p: L.concat(R.reverse()), ocean: 1, side };
    if (!inWater1(ocean, h.pin[0], h.pin[1]) && !inWater1(ocean, G.x, G.y) && !inE(G.x, G.y, h.fringe) && !inWater1(ocean, h.tee[0], h.tee[1])) h.water.push(ocean);
  }
  // Waste Areas (Sand-/Dünenflächen neben dem Fairway)
  if (T.waste) for (let ss = 60; ss < Lg - 25; ss += 30) for (const side of [-1, 1]) {
    if (r() > .32 * T.waste) continue;
    const p = at(ss), hw = Math.max(h.fwHalf(ss), 12), rx = ri(14, 30), ry = ri(6, 13), lat = hw + ry + ri(1, 8);
    if (lat > OBW - 4) continue;
    const e = { x: p.x + p.nx * side * lat, y: p.y + p.ny * side * lat, rx, ry, a: p.ang };
    if (nearGreen(e.x, e.y, ry + 3) || nearTee(e.x, e.y, 22) || h.water.some(w => inWater1(w, e.x, e.y))) continue;
    e.pts = ePts(e, 11).map(([x, y], i) => [x + Math.sin(i * 2.1) * 1.6, y + Math.cos(i * 1.7) * 1.6]);
    h.waste.push(e);
  }
  h.bunkers = h.bunkers.filter(b => !inE(h.pin[0], h.pin[1], b, 1.5) && !h.water.some(w => inWater1(w, b.x, b.y)));
  // Bäume
  for (let s = 18; s <= Lg + 30; s += 8) for (const side of [-1, 1]) {
    if (r() > (.38 + diff * .18) * T.trees) continue;
    const p = at(s), hw = Math.max(h.fwHalf(s), par === 3 ? 13 : 16), lat = hw + ri(8, 36);
    if (lat > OBW - 2) continue;
    const t = mkTree(T.tree, r, p.x + p.nx * side * lat + ri(-3, 3), p.y + p.ny * side * lat + ri(-3, 3), T);
    if (h.waste.some(e => inE(t.x, t.y, e))) continue;
    if (nearTee(t.x, t.y, 16) || nearGreen(t.x, t.y, 7) || h.water.some(w => inWater1(w, t.x, t.y)) || h.bunkers.some(b => inE(t.x, t.y, b, t.r + 1))) continue;
    if (fw && inPoly(t.x, t.y, fw.poly)) continue;
    if (h.trees.some(o => hyp(o.x - t.x, o.y - t.y) < o.r + t.r - 1.5)) continue;
    h.trees.push(t);
  }
  // Felsen (Alpen/Wüste)
  if (T.rocks) for (let k = 0; k < Math.round(ri(1, 4) * T.rocks); k++) {
    const ss = ri(40, Lg - 30), p = at(ss), side = sgn(), hw = Math.max(h.fwHalf(ss), 12), lat = hw + ri(3, 26);
    const t = mkTree('rock', r, p.x + p.nx * side * lat, p.y + p.ny * side * lat, T);
    if (nearGreen(t.x, t.y, 6) || nearTee(t.x, t.y, 18) || (fw && inPoly(t.x, t.y, fw.poly)) || h.water.some(w => inWater1(w, t.x, t.y)) || h.trees.some(o => hyp(o.x - t.x, o.y - t.y) < o.r + t.r)) continue;
    h.trees.push(t);
  }
  h.trees.sort((a, b) => a.y - b.y);
  h.deco = [];
  for (let s = -30; s <= Lg + 70; s += 7) for (const side of [-1, 1]) for (let k = 0; k < 2; k++) {
    if (r() > T.decoD) continue;
    const p = at(clamp(s, 0, C[C.length - 1][2])), lat = OBW + ri(2, 34) + k * 14;
    const t = mkTree(T.deco, r, p.x + p.nx * side * lat + ri(-4, 4), p.y + p.ny * side * lat + ri(-4, 4) + (s < 0 ? -s : 0), T, true);
    if (!h.water.some(w => inWater1(w, t.x, t.y))) h.deco.push(t);
  }
  for (let k = 0; k < 26 * T.decoD; k++) { const a = ri(0, TAU), rr2 = ri(OBW * .9, OBW + 40); const t = mkTree(T.deco, r, h.tee[0] + Math.cos(a) * rr2, h.tee[1] + Math.abs(Math.sin(a)) * rr2 + 10, T, true); if (!h.water.some(w => inWater1(w, t.x, t.y))) h.deco.push(t); }
  h.deco.sort((a, b) => a.y - b.y);
  // Grenzen für die Übersicht
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const [x, y] of C) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  h.box = [x0 - 30, y0 - 5, x1 + 30, y1 + 10];
  return h;
}
function mkTree(kind, r, x, y, T, deco) {
  const ri = (a, b) => a + r() * (b - a), col = T.cols[Math.floor(r() * T.cols.length)];
  const t = { x, y, k: kind, col: deco && kind === 'oak' ? (T.pal.forest || BASEPAL.forest) : col };
  if (kind === 'oak') { t.r = ri(3.3, 6.2) * (deco ? 1.2 : 1); t.h = ri(11, 21); }
  else if (kind === 'pine') { t.r = ri(3, 5.5) * (deco ? 1.15 : 1); t.h = ri(14, 24); if (deco) t.col = T.pal.forest; }
  else if (kind === 'palm') { t.r = ri(3.5, 5.5); t.h = ri(12, 18); }
  else if (kind === 'cactus') { t.r = ri(1.2, 2.2); t.h = ri(4, 7); }
  else if (kind === 'gorse') { t.r = ri(2.2, 4.5) * (deco ? 1.3 : 1); t.h = ri(2.5, 4); }
  else { t.r = ri(2, 4.2); t.h = ri(2, 5); t.col = ['#9a978d', '#a8a497', '#8c8a82'][Math.floor(r() * 3)]; t.k = 'rock'; }
  const n = kind === 'pine' ? 14 : kind === 'rock' ? 6 + Math.floor(r() * 2) : 6 + Math.floor(r() * 3), o = r() * TAU;
  t.poly = Array.from({ length: n }, (_, i) => { const a = o + i / n * TAU, rr2 = t.r * (kind === 'pine' ? (i % 2 ? .55 : 1) * (.9 + r() * .15) : (.82 + r() * .3)); return [Math.cos(a) * rr2, Math.sin(a) * rr2]; });
  t.top = [ri(-.25, .05) * t.r, ri(-.3, -.05) * t.r];
  if (kind === 'palm') t.fr = Array.from({ length: 7 }, (_, i) => o + i / 7 * TAU + ri(-.2, .2));
  if (kind === 'cactus') t.arms = [[ri(-1, 1), ri(-1, 1)], [ri(-1, 1), ri(-1, 1)]];
  if (kind === 'gorse') t.fl = Array.from({ length: 5 }, () => [ri(-.6, .6) * t.r, ri(-.6, .6) * t.r]);
  return t;
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
  for (const e of h.waste) if (inE(x, y, e)) return 'waste';
  return 'rough';
}

function genCourse(seed, diff, wx, th = 'park', nH = 9, lenF = 1) {
  const r = rng(seed), nine = () => { const p = [4, 4, 4, 4, 3, 3, 5, 5, 4]; for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; } return p; };
  const pars = nH === 18 ? nine().concat(nine()) : nine();
  const windA = r() * TAU, linksWind = th === 'links' || th === 'tropic';
  return pars.map((p, i) => genHole(rng(seed * 31 + i * 977 + 5), p, diff + (r() - .5) * .12, wx, { th, lenF, windA: linksWind ? windA : null }));
}
function courseHoles(id, nH, wx) { const c = CRS[id]; return genCourse(courseSeed(id), c.d, wx || 'sonnig', c.th, nH, c.lenF); }

// ---------------- Karriere ----------------
const TOURS = [
  { n: 'Amateur Tour', short: 'AM', skill: [.08, .55], purse: [900, 1100, 1300, 2000], d: [.15, .22, .3, .38],
    ev: ['Lakeside Open', 'Birkenhof Classic', 'Heideland Cup', 'Amateur Championship'], c: ['lakeside', 'birkenhof', 'heideland', 'seewinkel'] },
  { n: 'Challenge Tour', short: 'CT', skill: [-.05, .35], purse: [4000, 4800, 5500, 8000], d: [.42, .48, .54, .6],
    ev: ['Küstenwind Trophy', 'Steinbruch Invitational', 'Alpensee Open', 'Challenge Finale'], c: ['kuestenwind', 'steinbruch', 'alpensee', 'ahornhain'] },
  { n: 'World Tour', short: 'WT', skill: [-.25, .12], purse: [15000, 18000, 22000, 40000], d: [.65, .72, .8, .92],
    ev: ['Coral Bay Masters', 'Desert Rose Classic', 'Highland Championship', 'The Crown – Major'], c: ['coralbay', 'desertrose', 'highland', 'crown'] },
];
const WXS = ['sonnig', 'sonnig', 'windig', 'regen'];
const WXI = new Proxy({}, { get: (_, k) => wxIc(k) });
const evSeed = (t, e) => 1000 + t * 100 + e * 17;
const evWx = (t, e) => pickWx(CRS[TOURS[t].c[e]].th, rng(evSeed(t, e) + 3));
const NAMES_F = ['M. Berger', 'L. Novak', 'T. Okafor', 'J. Lindqvist', 'R. Sato', 'A. Moreau', 'K. Brandt', 'D. Rossi', 'S. Kowalski', 'E. Hansen', 'P. Duarte', 'N. Fischer', 'H. Tanaka', 'C. Walsh', 'O. Petrov', 'F. Meier', 'G. Alvarez', 'I. Svensson', 'B. Keller', 'V. Ivanova'];
const PAYOUT = [1, .6, .42, .3, .24, .19, .15, .12, .1, .08, .065, .05];
function genField(t, seed, holes) {
  const r = rng(seed + 99), names = NAMES_F.slice();
  for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
  const [lo, hi2] = TOURS[t].skill;
  return names.slice(0, 11).map(n => {
    const sk = lo + (hi2 - lo) * r();
    const sc = holes.map(h => { const g = (r() + r() + r() - 1.5) * 1.5; let d = Math.round(sk + (h.diff - .5) * .3 + g * .72); d = clamp(d, h.par === 5 ? -2 : -1, 3); return h.par + d; });
    return { n, sc };
  });
}
function board(upto) {
  const rows = round.field.map(o => ({ n: o.n, d: o.sc.slice(0, upto).reduce((a, s, i) => a + s - round.holes[i].par, 0) }));
  rows.push({ n: 'Du', you: true, d: totalDiff() });
  rows.sort((a, b) => a.d - b.d || (a.you ? -1 : b.you ? 1 : 0));
  rows.forEach(r => { const better = rows.filter(o => o.d < r.d).length, tie = rows.filter(o => o.d === r.d).length > 1; r.pos = (tie ? 'T' : '') + (better + 1); r.place = better + 1; });
  return rows;
}
function boardHtml(upto, full) {
  const rows = board(upto), me = rows.findIndex(r => r.you);
  let show = full ? rows : rows.slice(0, 5);
  if (!full && me >= 5) show = show.concat([{ gap: 1 }, rows[me]]);
  return `<table class="lb">${show.map(r => r.gap ? '<tr><td colspan="3" style="color:var(--soft)">…</td></tr>' : `<tr class="${r.you ? 'me' : ''}"><td>${r.pos}</td><td>${r.n}</td><td>${fmtD(r.d)}</td></tr>`).join('')}</table>`;
}
const xpNeed = l => Math.round(120 * Math.pow(l, 1.35));
function addXp(n) {
  save.xp += n; let ups = 0;
  while (save.xp >= xpNeed(save.lvl)) { save.xp -= xpNeed(save.lvl); save.lvl++; save.sp += save.lvl % 5 === 0 ? 2 : 1; ups++; }
  return ups;
}
const money = n => n.toLocaleString('de-DE') + ' $';
function nextEvent() {
  for (let t = 0; t <= Math.min(save.tourOpen, TOURS.length - 1); t++) for (let e = 0; e < 4; e++) if (!save.results[t + '-' + e]) return [t, e];
  return [Math.min(save.tourOpen, 2), 0];
}

// ---------------- Spielzustand ----------------
let mode = 'menu', round = null, hole = null, hi = 0;
let state = 'idle';  // aim | swing | flight | roll | putt | putting | wait | holed
let ball = { x: 0, y: 0, z: 0, vx: 0, vy: 0 }, strokes = 0, lie = 'tee';
let target = [0, 0], clubI = 0, shape = 0, spin = 0, overview = false;
let swing = null, flight = null, rollInfo = null, putDrag = null, parts = [], trail = [], stateT = 0, time = 0, ffwd = false;
const cam = { x: 0, y: 0, s: 3 }, camT = { x: 0, y: 0, s: 3 };
const stats = () => { const a = save.at; return { kraft: a.kraft, praez: a.praez, putt: a.putt, nerven: a.nerven, spin: Math.min(5, Math.floor(a.spin / 2) + (gearM('wedges').spin || 0)) }; };
const decOf = l => LIE[l].dec * (hole && hole.rain && (l === 'green' || l === 'fringe') ? 1.3 : 1);
const meterT = () => .9 * (1 + .035 * stats().nerven);
const wind = () => { const w = hole.wind; return [Math.cos(w.a) * w.v, Math.sin(w.a) * w.v]; };

function allowedClubs() {
  const dPin = hyp(hole.pin[0] - ball.x, hole.pin[1] - ball.y);
  return CLUBS.map((c, i) => i).filter(i => {
    const c = CLUBS[i];
    if (c.id === 'D') return lie === 'tee';
    if (c.putter) return false;
    if (lie === 'green') return false;
    return true;
  });
}
function elevAt(h, x, y) { return (h.elev || 0) * clamp(nearestPath(h, x, y).s / h.Lg, 0, 1.08); }
const elevDz = () => elevAt(hole, target[0], target[1]) - elevAt(hole, ball.x, ball.y);
const playsLike = () => hyp(target[0] - ball.x, target[1] - ball.y) + elevDz();
function carry(c, l = lie) {
  if (c.putter) return 30;
  let d = LIE[l].d; if (l === 'sand' && (c.id === 'SW' || c.id === 'LW')) d = .9;
  return c.c * (1 + .015 * stats().kraft + (gearC(c).dist || 0)) * d * ((hole && WX[hole.wx] && WX[hole.wx].carry) || 1);
}
function autoClub(dist) {
  if (hole && target) dist += elevDz();
  const al = allowedClubs().filter(i => !CLUBS[i].putter);
  for (let k = al.length - 1; k >= 0; k--) if (carry(CLUBS[al[k]]) >= dist * .98) return al[k];
  return al[0];
}
function maxRange() { const al = allowedClubs().filter(i => !CLUBS[i].putter); return carry(CLUBS[al[0]]); }

// ---------------- Runde / Loch ----------------
function startRound(m, opts = {}) {
  let label, wx, holes, cid, nH = 9;
  if (m === 'tour') {
    const { t, e } = opts; cid = TOURS[t].c[e]; nH = 18; wx = evWx(t, e); label = TOURS[t].ev[e]; round = { t, e };
    holes = courseHoles(cid, nH, wx);
  } else if (m === 'ctp' || m === 'ld') {
    const seed = (Math.random() * 1e9) | 0, r = rng(seed), ths = Object.keys(THEMES), th = ths[Math.floor(Math.random() * ths.length)];
    wx = pickWx(th, Math.random); if (wx === 'sturm' || wx === 'nebel') wx = 'windig';
    const h = m === 'ctp' ? genHole(r, 3, .55, wx, { water: Math.random() < .6, th }) : genHole(r, 5, .45, wx, { straight: true, noWater: true, th });
    h.wind.v = Math.min(h.wind.v, 22); h.wind.v0 = h.wind.v; h.wind.gust = 0;
    round = { mini: { kind: m, shots: [], max: 5 } };
    Object.assign(round, { mode: m, label: m === 'ctp' ? 'Closest to the Pin' : 'Longest Drive', wx, th, holes: [h], scores: [] });
    enterPlay(); startHole(0); return;
  } else if (m === 'match') {
    const c = save.cup, tier = CUPS[c.c].tier, pool = COURSES.filter(x => x.d >= [0, .38, .6][tier] - .05 && x.d <= [.4, .62, 1][tier]);
    cid = pool[Math.floor(Math.random() * pool.length)].id; wx = pickWx(CRS[cid].th, Math.random);
    label = CUPS[c.c].n; round = { opp: c.players[cupOpp()], ms: 0 };
    holes = genCourse((Math.random() * 1e9) | 0, CRS[cid].d, wx, CRS[cid].th, 9, CRS[cid].lenF);
  } else {
    cid = opts.course || COURSES[Math.floor(Math.random() * COURSES.length)].id; nH = opts.n || 9;
    wx = opts.wx || pickWx(CRS[cid].th, Math.random); label = CRS[cid].n; round = {};
    holes = courseHoles(cid, nH, wx);
  }
  Object.assign(round, { mode: m, label, wx, course: cid, th: CRS[cid].th, seed: courseSeed(cid), holes, scores: [] });
  if (m === 'tour') round.field = genField(round.t, evSeed(round.t, round.e), round.holes);
  let start = 0;
  if (opts.resume) { round.scores = opts.resume.scores.slice(); round.hs = opts.resume.hs || []; start = round.scores.length; }
  enterPlay(); startHole(start);
}
function saveCur() {
  if (!round || !['tour', 'free'].includes(round.mode)) return;
  save.cur = { mode: round.mode, t: round.t, e: round.e, course: round.course, n: round.holes.length, wx: round.wx, scores: round.scores.slice(), hs: round.hs || [] };
  persist();
}
function resumeRound() { const c = save.cur; if (!c) return; startRound(c.mode, c.mode === 'tour' ? { t: c.t, e: c.e, resume: c } : { course: c.course, n: c.n, wx: c.wx, resume: c }); }
let hs = {};
function startHole(i) {
  hi = i; hole = round.holes[i]; setPal(hole.th);
  hs = { teeDone: false, fir: null, gir: false, putts: 0, pen: 0, sand: false, chip: false, drive: null, prox: null, swings: 0, perfect: 0, teeClub: null };
  ball = { x: hole.tee[0], y: hole.tee[1], z: 0, vx: 0, vy: 0 };
  strokes = 0; shape = 0; spin = 0; overview = false; parts = []; trail = [];
  lie = 'tee'; cam.s = 0;
  setupShot();
  snapCam();
  const w = hole.wind;
  if (round.mini) intro(round.label, (round.mini.kind === 'ctp' ? 'Par 3 · ' + hole.len + ' m · 5 Bälle' : '5 Drives · nur Fairway zählt'), WXI[hole.wx] + (w.v ? ' ' + w.v + ' km/h' : ''));
  else intro(round.mode === 'match' && i >= 9 ? 'Stechen' : 'Loch ' + (i + 1), 'Par ' + hole.par + ' · ' + hole.len + ' m' + (Math.abs(hole.elev || 0) >= 4 ? (hole.elev > 0 ? ' · bergauf +' : ' · bergab −') + Math.abs(hole.elev) + ' m' : ''), (i === 0 ? round.label + ' · ' : '') + WXI[hole.wx] + ' ' + wxN(hole.wx) + (w.v ? ' · Wind ' + w.v + ' km/h' : ' · windstill') + (round.mode === 'match' ? ' · ' + msText(round.ms) : ''));
}
function setupShot() {
  { const w = hole.wind; if (w.gust) { w.v = Math.max(0, Math.round(w.v0 * (1 + (Math.random() - .5) * 2 * w.gust))); w.a = w.a0 + (Math.random() - .5) * .45; } }
  lie = lieAt(hole, ball.x, ball.y);
  if (hyp(ball.x - hole.tee[0], ball.y - hole.tee[1]) < 1) lie = 'tee';
  ball.z = 0; ball.vx = ball.vy = 0;
  const al = allowedClubs();
  if (lie === 'green' || lie === 'fringe') { autoPutt(); }
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
function enterPutt() { autoPutt(); }
function puttRings() {
  const m = hyp(hole.slope[0], hole.slope[1]), k = (1 + .05 * stats().putt + gearM('putter').cap) / (1 + m * .45) * (hole.rain ? .92 : 1);
  return [3.2 * k, 11 * k];
}
let ap = null;
function autoPutt() {
  overview = false;
  const [r1, r2] = puttRings(), [px, py] = hole.pin, d = hyp(ball.x - px, ball.y - py);
  const n = d <= r1 ? 1 : d <= r2 ? 2 : 3;
  hs.putts = n; hs.gir = strokes <= hole.par - 2; if (hs.prox == null) hs.prox = d;
  // Wegpunkte: jeder Putt landet im nächstinneren Ring
  const dx = (ball.x - px) / (d || 1), dy = (ball.y - py) / (d || 1), pts = [];
  const side = () => (Math.random() - .5) * 1.4;
  const near = (r, f) => { const a = side(), [ux, uy] = rot(dx, dy, a); let q = [px + ux * r * f, py + uy * r * f]; return q; };
  if (n === 3) pts.push(near(r2, .35 + Math.random() * .5));
  if (n >= 2) pts.push(near(r1, .25 + Math.random() * .6));
  pts.push([px, py]);
  ap = { pts, i: 0, t: 0, from: [ball.x, ball.y], dur: 0, wait: .9, n };
  state = 'autoputt';
  toast(n === 1 ? '1 Putt' : n + ' Putts', d.toFixed(1) + ' m zur Fahne', 1100);
  updHud(); updPanel();
}
function updAutoPutt(dt) {
  if (ap.wait > 0) { ap.wait -= dt; if (ap.wait <= 0) { ap.from = [ball.x, ball.y]; const to = ap.pts[ap.i]; ap.dur = .55 + hyp(to[0] - ball.x, to[1] - ball.y) * .07; ap.t = 0; strokes++; Snd.putt(); buzz(8); updHud(); } return; }
  ap.t += dt; const to = ap.pts[ap.i], u = Math.min(1, ap.t / ap.dur), e = 1 - Math.pow(1 - u, 2.2);
  const dx = to[0] - ap.from[0], dy = to[1] - ap.from[1], l = hyp(dx, dy) || 1;
  // Kurve durchs Gefälle
  const bend = (hole.slope[0] * -dy / l + hole.slope[1] * dx / l) * l * .12 * Math.sin(Math.PI * e);
  ball.x = ap.from[0] + dx * e + (-dy / l) * bend; ball.y = ap.from[1] + dy * e + (dx / l) * bend;
  if (u >= 1) {
    ap.i++;
    if (ap.i >= ap.pts.length) { holed(); return; }
    ap.wait = .5;
  }
}

// ---------------- Schwung ----------------
function startSwing() {
  if (state !== 'aim') return;
  Snd.init(); overview = false;
  state = 'swing'; swing = { ph: 'dir', t: 0, p: 0, a: 0, ph0: Math.random(), pt: clamp(playsLike() / carry(CLUBS[clubI]), .05, 1) };
  updPanel();
}
function swingTap() {
  if (state !== 'swing') return;
  if (swing.ph === 'dir') {
    swing.a = dirVal(); swing.ph = 'power'; swing.t = 0; Snd.tick(); buzz(8);
    if (Math.abs(swing.a) <= perfZone()) { swing.perfect = true; Snd.tone(1320, .08, 'triangle', .12); }
  } else if (swing.ph === 'power') { swing.p = swingVal(); swing.ph = 'done'; Snd.tick(); hitBall(); }
}
// Kraft: läuft hoch bis 110 % und wieder zurück
const swingVal = () => { const t = swing.t / meterT(); return t <= 1.1 ? t : Math.max(0, 2.2 - t); };
// Richtung: Linie pendelt gleichmässig zwischen -1 (links) und +1 (rechts)
const dirPeriod = () => 1.7 * (1 + .04 * stats().nerven);
function dirVal() { const x = ((swing.t / dirPeriod()) + swing.ph0) % 1; return x < .5 ? -1 + 4 * x : 3 - 4 * x; }
function perfZone() { return .1 + .012 * stats().praez; }
// maximale Abweichung der pendelnden Linie in Grad
function maxDev(c = CLUBS[clubI]) { return c.sp * LIE[lie].s * (1 - .035 * stats().praez - (gearC(c).acc || 0)) * 2.2; }

function hitBall() {
  const c = CLUBS[clubI], S = [ball.x, ball.y];
  const dist = Math.max(1, hyp(target[0] - S[0], target[1] - S[1]));
  let p = swing.p, a = clamp(swing.a, -1.3, 1.3);
  const perfect = Math.abs(a) <= perfZone();
  hs.swings++; if (perfect) hs.perfect++; if (lie === 'sand') hs.sand = true; if (strokes === 0) hs.teeClub = c.id;
  if (perfect) a = 0;
  // Überschwung: bis 3 % über Maximum harmlos, darüber wird es riskant (Glück + gute Linie helfen)
  const over = Math.max(0, p - 1), hard = Math.max(0, over - .03);
  let carryAct = carry(c) * (p <= 1 ? p : 1 + over * .55);
  let ovErr = 0;
  if (hard > 0) { const luck = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; ovErr = luck * hard * 120 * (perfect ? .45 : 1) + (perfect ? 0 : Math.sign(a || luck) * hard * 25); }
  if (spin) carryAct *= spin < 0 ? .98 : .97;
  let errDeg = a * maxDev(c) + ovErr;
  if (shape && !perfect) errDeg *= 1.1;
  const dx = (target[0] - S[0]) / dist, dy = (target[1] - S[1]) / dist;
  const [rx, ry] = rot(dx, dy, errDeg * Math.PI / 180);
  const air = .9 + carryAct / 105;
  const [wx, wy] = wind(), wk = .2 * air * (c.apex / 32);
  const L = [S[0] + rx * carryAct + wx * wk, S[1] + ry * carryAct + wy * wk];
  { const dz = elevAt(hole, L[0], L[1]) - elevAt(hole, S[0], S[1]); L[0] -= rx * dz; L[1] -= ry * dz; }
  const mid = [(S[0] + L[0]) / 2, (S[1] + L[1]) / 2], rgt = [-ry, rx], bow = -shape * carryAct * .11;
  const Cp = [mid[0] + rgt[0] * bow - wx * wk * .3, mid[1] + rgt[1] * bow - wy * wk * .3];
  strokes++;
  flight = { S, L, Cp, T: air, t: 0, apex: c.apex * clamp(.5 + p * .5, .5, 1.05) * (spin < 0 ? 1.08 : spin > 0 ? .9 : 1), carry: carryAct, club: c, shape, spin, origin: S };
  state = 'flight'; ffwd = false; trail = [];
  Snd.swing(p); buzz(15);
  const msg = perfect ? 'Perfekt!' : Math.abs(a) < .35 ? (a > 0 ? 'Leicht rechts' : 'Leicht links') : Math.abs(a) < .8 ? (a > 0 ? 'Push' : 'Pull') : (a > 0 ? 'Slice!' : 'Hook!');
  toast(hard > 0 ? (Math.abs(ovErr) < 2 ? 'Überschwung – sauber!' : 'Überschwung!') : msg, hard > 0 ? msg : over > 0 ? 'Volle Kraft' : null, 1000);
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
      Snd.tree(); buzz(25); toast('Baum!', null, 800); leafFx(t.x, t.y); shake = .35;
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
  Snd.land(); puffFx(ball.x, ball.y, l === 'sand' ? '#efe0b0' : 'rgba(255,255,255,.8)', l === 'sand' ? 10 : 5); parts.push({ ring: 1, x: ball.x, y: ball.y, r0: .3, grow: 2.5, life: .5, max: .5, c: 'rgba(255,255,255,.8)' });
  if (l === 'sand') Snd.sand();
  const [tx, ty] = [f.L[0] - f.Cp[0], f.L[1] - f.Cp[1]], tl = hyp(tx, ty) || 1;
  const sl = stats().spin;
  let rollD = f.carry * f.club.roll * LIE[l].roll * (f.shape < 0 ? 1.18 : f.shape > 0 ? .85 : 1);
  let dir = 1;
  if (f.spin < 0) { rollD *= Math.max(.05, 1 - .3 * Math.max(1, sl)); if (sl >= 3 && (l === 'green' || l === 'fringe')) { dir = -1; rollD = .8 + (sl - 2) * 1.2 + f.club.apex * .02; } }
  if (f.spin > 0) rollD *= 1 + .3 * Math.max(1, sl);
  if (hole.rain) rollD *= .6;
  rollD *= (WX[hole.wx] && WX[hole.wx].roll) || 1;
  const v0 = Math.sqrt(2 * decOf(l) * Math.max(0, rollD));
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
  if (round.mini) { toast('Wasser', 'Ball verloren', 1100); later(1100, () => miniShotDone(true)); return; }
  teeEval(true); hs.pen++;
  toast('Wasser', 'Strafschlag · Drop', 1200);
  later(1100, () => { ball.x = x; ball.y = y; afterStop(); });
}
function penaltyOB(f) {
  buzz(40); state = 'wait'; strokes++;
  if (round.mini) { toast('Aus!', 'Ball verloren', 1100); later(1100, () => miniShotDone(true)); return; }
  teeEval(true); hs.pen++;
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
  const dec = decOf(l);
  if (sp > 0) { const ns = Math.max(0, sp - dec * h); ball.vx *= ns / sp; ball.vy *= ns / sp; }
  if (l === 'green' && sp > .05) { ball.vx += hole.slope[0] * h; ball.vy += hole.slope[1] * h; }
  else if (l === 'green' && Math.hypot(...hole.slope) > .55) { ball.vx += hole.slope[0] * h * .5; ball.vy += hole.slope[1] * h * .5; }
  // Loch
  const dx = hole.pin[0] - ball.x, dy = hole.pin[1] - ball.y, d = hyp(dx, dy);
  sp = hyp(ball.vx, ball.vy);
  const capV = 1.7 + .07 * stats().putt + gearM('putter').cap;
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
function teeEval(pen) {
  if (hs.teeDone || round.mini) return; hs.teeDone = true;
  const l = lieAt(hole, ball.x, ball.y);
  if (hole.par >= 4) hs.fir = !pen && ['fairway', 'fringe', 'green'].includes(l);
  if (!pen && hs.teeClub === 'D') hs.drive = Math.round(hyp(ball.x - hole.tee[0], ball.y - hole.tee[1]));
}
function afterStop() {
  if (state === 'holed') return;
  state = 'wait';
  if (round.mini) { miniShotDone(false); return; }
  teeEval(false);
  const max = hole.par + 4;
  if (strokes >= max) { toast('Aufgehoben', 'Max. ' + max + ' Schläge', 1200); later(1100, () => holeDone(max)); return; }
  setupShot();
}

function holed() {
  if (state !== 'autoputt' && strokes > 1) { hs.chip = true; if (!round.mini) toast('Chip-in!', null, 1200); }
  state = 'holed'; ball.vx = ball.vy = 0; stateT = 0;
  Snd.plop(); buzz([20, 40, 30]);
  const d = strokes - hole.par;
  if (d < 0 || strokes === 1) later(250, () => Snd.good());
  for (let i = 0; i < 30; i++) { const a = Math.random() * TAU, s = 1 + Math.random() * 5; parts.push({ x: hole.pin[0], y: hole.pin[1], vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1.1, max: 1.1, c: ['#ffffff', '#ffd54f', '#ff8a65', '#81d4fa'][i % 4], r: .25 + Math.random() * .25 }); }
  if (round.mini) { later(900, () => miniShotDone(false, true)); return; }
  later(1000, () => holeDone(strokes));
}

// ---------------- Putten ----------------
function puttDragVec() {
  if (!putDrag) return null;
  const dx = putDrag.sx - putDrag.x, dy = putDrag.sy - putDrag.y, l = hyp(dx, dy);
  if (l < 8) return null;
  const p = clamp(l / (Math.min(W, H) * .6), 0, 1), dist = 26 * p * p + .3;
  return { dx: dx / l, dy: dy / l, p, v: Math.sqrt(2 * decOf('green') * dist) };
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
  const ph = state === 'aim' ? 222 : state === 'swing' ? 150 : 40;
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
  } else if (state === 'putt' || state === 'putting' || state === 'autoputt') {
    box([[bx, by], hole.pin], 6, 26);
  } else if (state === 'flight') {
    box([flight.S, flight.L, [bx, by]], 26, 60);
  } else if (state === 'roll') {
    box([[bx, by], flight ? flight.L : [bx, by], hole.pin].slice(0, hyp(hole.pin[0] - bx, hole.pin[1] - by) < 40 ? 3 : 2), 16, 40);
  } else if (state === 'holed') box([hole.pin], 6, 18);
}
function box(pts, pad, minW) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } fitTo(x0 - pad, y0 - pad, x1 + pad, y1 + pad, minW); }
function snapCam() { camGoal(); cam.x = camT.x; cam.y = camT.y; cam.s = camT.s; }
let shake = 0;
function updCam(dt) {
  if (shake > 0) { shake = Math.max(0, shake - dt); cam.x += (Math.random() - .5) * shake * 4 / Math.max(1, cam.s / 3); cam.y += (Math.random() - .5) * shake * 4 / Math.max(1, cam.s / 3); }
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
    if (swing.ph === 'power' && swing.t > meterT() * 2.2) { state = 'aim'; swing = null; updPanel(); toast('Abgebrochen', null, 700); }
  } else if (state === 'flight') updFlight(dt);
  else if (state === 'autoputt') updAutoPutt(dt);
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
const FONTS = 'Outfit,-apple-system,Segoe UI,Roboto,sans-serif';
let PAL = Object.assign({}, BASEPAL);
function setPal(th) { PAL = Object.assign({}, BASEPAL, (THEMES[th] || THEMES.park).pal); }
function ell(e, grow = 0) { ctx.beginPath(); ctx.ellipse(e.x, e.y, e.rx + grow, e.ry + grow, e.a, 0, TAU); }
function poly(p) { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); }
function ePts(e, n, grow = 0) { const out = []; for (let i = 0; i < n; i++) { const a = i / n * TAU, [x, y] = rot(Math.cos(a) * (e.rx + grow), Math.sin(a) * (e.ry + grow), e.a); out.push([e.x + x, e.y + y]); } return out; }
function ellP(e, grow = 0, n = 16) { poly(ePts(e, n, grow)); }
function waterPath(w) { if (w.e) ellP(w.e, 0, 18); else poly(w.p); }
const LX = -.55, LY = -.83; // Lichtrichtung (von oben links)
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255; const f = k >= 0 ? [255, 255, 255] : [0, 0, 0], t = Math.abs(k); r += (f[0] - r) * t; g += (f[1] - g) * t; b += (f[2] - b) * t; return `rgb(${r | 0},${g | 0},${b | 0})`; }
function treeShadow(t) {
  const ox = t.x + t.h * .18, oy = t.y + t.h * .26;
  ctx.beginPath();
  if (t.k === 'palm') { for (const a of t.fr) { const ex = ox + Math.cos(a) * t.r * 1.15, ey = oy + Math.sin(a) * t.r * 1.15; ctx.moveTo(ox, oy); ctx.lineTo(ex + Math.cos(a + 1.57) * .9, ey + Math.sin(a + 1.57) * .9); ctx.lineTo(ex, ey); ctx.closePath(); } }
  else t.poly.forEach(([x, y], i) => i ? ctx.lineTo(ox + x, oy + y) : ctx.moveTo(ox + x, oy + y));
  ctx.closePath(); ctx.fill();
}
function drawTree(t) {
  const pts = t.poly.map(([x, y]) => [t.x + x, t.y + y]);
  if (t.k === 'palm') {
    for (let i = 0; i < t.fr.length; i++) {
      const a = t.fr[i], ex = t.x + Math.cos(a) * t.r * 1.2, ey = t.y + Math.sin(a) * t.r * 1.2, nx = Math.cos(a + 1.57), ny = Math.sin(a + 1.57);
      const lit = -(Math.cos(a) * LX + Math.sin(a) * LY);
      ctx.fillStyle = shade(t.col, lit * .25);
      ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.quadraticCurveTo(t.x + Math.cos(a) * t.r * .6 + nx * 1.4, t.y + Math.sin(a) * t.r * .6 + ny * 1.4, ex, ey); ctx.quadraticCurveTo(t.x + Math.cos(a) * t.r * .6 - nx * .5, t.y + Math.sin(a) * t.r * .6 - ny * .5, t.x, t.y); ctx.fill();
    }
    ctx.fillStyle = '#7a5a34'; ctx.beginPath(); ctx.arc(t.x, t.y, .7, 0, TAU); ctx.fill();
    return;
  }
  if (t.k === 'cactus') {
    facet(t.x, t.y, pts, t.col, .3, t.top);
    for (const [ax, ay] of t.arms) { const x = t.x + ax * t.r * 1.5, y = t.y + ay * t.r * 1.5; ctx.fillStyle = shade(t.col, .12); ctx.beginPath(); ctx.arc(x, y, t.r * .45, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(t.x - t.r * .3, t.y - t.r * .3, t.r * .25, 0, TAU); ctx.fill();
    return;
  }
  facet(t.x, t.y, pts, t.col || PAL.tree, t.k === 'rock' ? .38 : .32, t.top);
  ctx.strokeStyle = 'rgba(10,30,15,.35)'; ctx.lineWidth = Math.max(.08, .8 / cam.s); poly(pts); ctx.stroke();
  if (t.k === 'gorse') { ctx.fillStyle = '#f2cf3a'; for (const [fx, fy] of t.fl) { ctx.beginPath(); ctx.arc(t.x + fx, t.y + fy, .35, 0, TAU); ctx.fill(); } }
}
function facet(cx, cy, pts, base, amt, top) {
  // Low-Poly: Fächer aus Dreiecken, Helligkeit nach Ausrichtung zur Lichtquelle
  const tx = cx + (top ? top[0] : 0), ty = cy + (top ? top[1] : 0);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy, l = hyp(mx, my) || 1;
    const d = -(mx / l * LX + my / l * LY);
    ctx.fillStyle = shade(base, -d * amt);
    ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = .08; ctx.stroke();
  }
}
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
  ctx.save(); ctx.beginPath(); hole.C.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.lineWidth = OBW * 2; ctx.strokeStyle = PAL.roughL; ctx.globalAlpha = .22; ctx.setLineDash([12, 12]); ctx.lineWidth = OBW * 2; ctx.lineCap = 'butt'; ctx.stroke(); ctx.restore();
  ctx.lineCap = 'round';
  // Höhenlinien (je 4 m eine Linie)
  if (Math.abs(hole.elev || 0) >= 4) {
    const n = Math.floor(Math.abs(hole.elev) / 4), up = hole.elev > 0;
    ctx.strokeStyle = up ? 'rgba(255,255,255,.16)' : 'rgba(20,40,20,.16)'; ctx.lineWidth = .6;
    for (let i = 1; i <= n; i++) {
      const p = pathAt(hole, hole.Lg * i / (n + 1)); ctx.beginPath();
      for (let k = -OBW; k <= OBW; k += 4) { const w = Math.sin(k * .07 + i) * 4; ctx.lineTo(p.x + p.nx * k + p.tx * w, p.y + p.ny * k + p.ty * w); }
      ctx.stroke();
    }
  }
  for (const e of hole.waste) {
    ctx.fillStyle = PAL.wasteD; poly(e.pts); ctx.fill();
    ctx.save(); ctx.translate(.3, .4); ctx.fillStyle = PAL.waste; poly(e.pts); ctx.fill(); ctx.restore();
    ctx.fillStyle = 'rgba(90,110,50,.45)'; for (let k = 0; k < 9; k++) { const a = k * 2.4, r2 = (k % 3 + 1) / 4; ctx.beginPath(); ctx.arc(e.x + Math.cos(a) * e.rx * r2 * .8, e.y + Math.sin(a) * e.ry * r2 * .8, .6, 0, TAU); ctx.fill(); }
  }
  // Deko-Wald ausserhalb der Spielbahn
  ctx.fillStyle = 'rgba(15,40,20,.3)';
  for (const t of hole.deco) treeShadow(t);
  for (const t of hole.deco) drawTree(t);
  // Fairway mit „first cut“
  if (hole.fw) {
    ctx.strokeStyle = PAL.cut; ctx.lineWidth = 4; poly(hole.fw.poly); ctx.stroke();
    ctx.fillStyle = PAL.fw; poly(hole.fw.poly); ctx.fill();
    ctx.strokeStyle = 'rgba(30,70,30,.22)'; ctx.lineWidth = Math.max(.12, .9 / cam.s); poly(hole.fw.poly); ctx.stroke();
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
    if (w.ocean) { ctx.strokeStyle = PAL.beach; ctx.lineWidth = 9; waterPath(w); ctx.stroke(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2; ctx.setLineDash([3, 2.5]); waterPath(w); ctx.stroke(); ctx.setLineDash([]); }
    ctx.fillStyle = PAL.waterD; waterPath(w); ctx.fill();
    ctx.save(); waterPath(w); ctx.clip(); ctx.fillStyle = PAL.water; ctx.translate(.6, .9); waterPath(w); ctx.fill(); ctx.restore();
    ctx.save(); waterPath(w); ctx.clip(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = .4;
    const c = w.e ? [w.e.x, w.e.y] : w.p[0];
    for (let k = -4; k <= 4; k++) { ctx.beginPath(); for (let x = -70; x <= 70; x += 3) ctx.lineTo(c[0] + x, c[1] + k * 5 + Math.sin(x * .3 + time * 1.5 + k) * .5); ctx.stroke(); }
    ctx.restore();
  }
  // Grün
  facet(hole.fringe.x, hole.fringe.y, ePts(hole.fringe, 14), PAL.fringe, .1);
  facet(hole.green.x, hole.green.y, ePts(hole.green, 14), PAL.green, .09, [hole.slope[0] * -3, hole.slope[1] * -3]);
  ctx.strokeStyle = 'rgba(30,80,30,.3)'; ctx.lineWidth = Math.max(.08, .9 / cam.s); poly(ePts(hole.green, 14)); ctx.stroke();
  // Gefälle auf dem Grün
  drawSlope();
  drawRings();
  // Bunker
  for (const b of hole.bunkers) { ctx.fillStyle = PAL.sandD; ellP(b, .5, 10); ctx.fill(); ctx.save(); ctx.translate(.25, .35); facet(b.x, b.y, ePts(b, 10), PAL.sand, -.12); ctx.restore(); }
  // Loch + Fahne
  const [pxn, pyn] = hole.pin, cupR = Math.max(CUP, 3.5 * px);
  ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.arc(pxn, pyn, cupR * 1.35, 0, TAU); ctx.fill();
  ctx.fillStyle = '#26302a'; ctx.beginPath(); ctx.arc(pxn, pyn, cupR, 0, TAU); ctx.fill();
  // Zielhilfe (unter Bäumen nicht nötig, aber unter Ball)
  if (state === 'aim' || state === 'swing') drawAim();
  // Ball-Schatten
  const br = Math.max(.22, 3 * px) * (1 + ball.z * .02);
  if (state !== 'holed' || stateT < .15) {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(ball.x + ball.z * .3 + .1 * br * 2, ball.y + ball.z * .45 + .15 * br * 2, br, br * .8, 0, 0, TAU); ctx.fill();
  }
  // Bäume (Schatten, dann Kronen)
  ctx.fillStyle = PAL.treeS;
  for (const t of hole.trees) treeShadow(t);
  for (const t of hole.trees) drawTree(t);
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
  { const g = ctx.createRadialGradient(W / 2, H * .45, Math.min(W, H) * .35, W / 2, H * .45, Math.max(W, H) * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(5,20,10,.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  const WXo = WX[hole.wx] || {};
  if (WXo.tint) { ctx.fillStyle = WXo.tint; ctx.fillRect(0, 0, W, H); }
  if (WXo.fog) { const [bx2, by2] = toScreen(ball.x, ball.y), g = ctx.createRadialGradient(bx2, by2, Math.min(W, H) * .18, bx2, by2, Math.max(W, H) * .7); g.addColorStop(0, 'rgba(226,232,232,0)'); g.addColorStop(1, 'rgba(226,232,232,.82)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
  if (hole.wx === 'sturm' || hole.wx === 'windig') {
    const [wx2, wy2] = wind(), wl = hyp(wx2, wy2) || 1; ctx.strokeStyle = 'rgba(255,255,255,' + (hole.wx === 'sturm' ? .22 : .12) + ')'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 26; i++) { const x = ((i * 151.3 + time * wx2 * 9) % (W + 80) + W + 80) % (W + 80) - 40, y = ((i * 97.7 + time * wy2 * 9) % (H + 80) + H + 80) % (H + 80) - 40; ctx.moveTo(x, y); ctx.lineTo(x + wx2 / wl * 26, y + wy2 / wl * 26); }
    ctx.stroke();
  }
  if (hole.rain) {
    ctx.strokeStyle = 'rgba(220,235,255,.35)'; ctx.lineWidth = 1.2; ctx.beginPath();
    for (let i = 0; i < 90; i++) { const x = ((i * 137.5 + time * 60) % (W + 40)) - 20, y = ((i * 89.3 + time * 520) % (H + 40)) - 20; ctx.moveTo(x, y); ctx.lineTo(x - 4, y + 14); }
    ctx.stroke();
  }
  if (state === 'aim' || state === 'swing') drawTargetLabel();
  drawRingLabels();
  if (state === 'swing') drawMeter();
  if (state === 'flight' || state === 'roll') drawFlightInfo();
}
function drawRings() {
  const [r1, r2] = puttRings(), [x, y] = hole.pin, px = 1 / cam.s;
  ctx.save(); ellP(hole.fringe, .2, 14); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = Math.max(.08, 1.3 * px); ctx.stroke();
  ctx.fillStyle = 'rgba(255,214,92,.38)'; ctx.beginPath(); ctx.arc(x, y, r1, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,214,92,.95)'; ctx.lineWidth = Math.max(.08, 1.5 * px); ctx.stroke();
  ctx.restore();
}
function drawRingLabels() {
  if (cam.s < 5 || round.mini) return;
  const [r1, r2] = puttRings(), [x, y] = hole.pin;
  ctx.font = '800 12px ' + FONTS; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const [r, t, c] of [[r1, '1 PUTT', '#ffd65c'], [r2, '2 PUTTS', '#ffffff']]) {
    const lx = x + r * .7071, ly = y + r * .7071; if (!inE(lx, ly, hole.fringe)) continue;
    const [sx, sy] = toScreen(lx, ly), w = ctx.measureText(t).width + 14;
    ctx.fillStyle = 'rgba(17,28,22,.82)'; rr(sx - w / 2, sy - 10, w, 20, 10); ctx.fill();
    ctx.fillStyle = c; ctx.fillText(t, sx, sy + .5);
  }
}
function drawSlope() {
  const g = hole.green, [sx, sy] = hole.slope, m = hyp(sx, sy); if (m < .05) return;
  const ux = sx / m, uy = sy / m;
  ctx.save(); ell(g); ctx.clip();
  ctx.strokeStyle = 'rgba(40,90,40,' + (.05 + m * .08) + ')'; ctx.lineWidth = .14;
  const off = (time * m * 1.2) % 3;
  for (let i = -16; i <= 16; i += 3) for (let j = -16; j <= 16; j += 3) {
    const cx = g.x + i + ux * off, cy = g.y + j + uy * off;
    ctx.beginPath(); ctx.moveTo(cx - ux * .3 - uy * .3, cy - uy * .3 + ux * .3); ctx.lineTo(cx + ux * .3, cy + uy * .3); ctx.lineTo(cx - ux * .3 + uy * .3, cy - uy * .3 - ux * .3); ctx.stroke();
  }
  ctx.restore();
}
function aimPath(off = 0) {
  const c = CLUBS[clubI], S = [ball.x, ball.y]; let d = hyp(target[0] - S[0], target[1] - S[1]) || 1;
  const [ux, uy] = rot((target[0] - S[0]) / d, (target[1] - S[1]) / d, off * Math.PI / 180);
  const L = [S[0] + ux * d, S[1] + uy * d];
  const rx = (L[0] - S[0]) / d, ry = (L[1] - S[1]) / d, mid = [(S[0] + L[0]) / 2, (S[1] + L[1]) / 2], bow = -shape * d * .11;
  return { S, L, Cp: [mid[0] - ry * bow, mid[1] + rx * bow], d, c };
}
function curAimOff() { if (state !== 'swing') return 0; return (swing.ph === 'dir' ? dirVal() : swing.perfect ? 0 : swing.a) * maxDev(); }
function drawAim() {
  const px = 1 / cam.s, md = maxDev(), base = aimPath(0);
  // Fächer der möglichen Abweichung
  const A = aimPath(-md).L, B = aimPath(md).L;
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(A[0], A[1]);
  const steps = 12; for (let i = 1; i <= steps; i++) { const L = aimPath(-md + 2 * md * i / steps).L; ctx.lineTo(L[0], L[1]); } ctx.closePath(); ctx.fill();
  // Perfekt-Zone
  const pz = perfZone() * md, P1 = aimPath(-pz).L, P2 = aimPath(pz).L;
  ctx.fillStyle = 'rgba(255,224,120,.22)'; ctx.beginPath(); ctx.moveTo(ball.x, ball.y); ctx.lineTo(P1[0], P1[1]); ctx.lineTo(P2[0], P2[1]); ctx.closePath(); ctx.fill();
  // aktuelle (pendelnde) Linie
  const { S, L, Cp, d } = aimPath(curAimOff());
  const live = state === 'swing' && swing.ph === 'dir';
  ctx.fillStyle = live ? '#fff4c2' : '#fff';
  const n = Math.max(6, Math.floor(d / (9 * px * 1.6)));
  for (let i = 1; i < n; i++) { const t = i / n, [x, y] = bez(S, Cp, L, t); ctx.globalAlpha = .4 + .6 * Math.sin(t * Math.PI); ctx.beginPath(); ctx.arc(x, y, Math.max(.25, 2.1 * px), 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  // Landepunkt
  ctx.strokeStyle = live ? '#fff4c2' : '#fff'; ctx.lineWidth = Math.max(.15, 2 * px);
  ctx.beginPath(); ctx.arc(L[0], L[1], 9 * px, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(L[0], L[1], 2.5 * px, 0, TAU); ctx.fill();
  if (live || state === 'aim') { ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([4 * px, 4 * px]); ctx.beginPath(); ctx.arc(base.L[0], base.L[1], 14 * px, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
}
function drawTargetLabel() {
  const [x, y] = toScreen(target[0], target[1]), d = Math.round(hyp(target[0] - ball.x, target[1] - ball.y)), dz = elevDz();
  const t = d + ' m' + (Math.abs(dz) >= 2 ? (dz > 0 ? '  ↗ ' : '  ↘ ') + 'spielt ' + Math.round(d + dz) : ''); ctx.font = '800 13px Outfit,-apple-system,Segoe UI,Roboto,sans-serif';
  const w = ctx.measureText(t).width + 16, yy = y - 30;
  ctx.fillStyle = 'rgba(31,42,34,.85)'; rr(x - w / 2, yy - 12, w, 24, 12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, yy + 1);
}
function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
function simPutt(a, tmax) {
  // Vorschau: gleiche Physik wie rollStep, aber ohne Effekte
  let x = ball.x, y = ball.y, vx = a.dx * a.v, vy = a.dy * a.v; const pts = [[x, y]]; const h = 1 / 60;
  for (let t = 0; t < tmax; t += h) {
    const l = lieAt(hole, x, y); const dec = decOf(l); let sp = hyp(vx, vy);
    if (sp > 0) { const ns = Math.max(0, sp - dec * h); vx *= ns / sp; vy *= ns / sp; }
    if (l === 'green' && sp > .05) { vx += hole.slope[0] * h; vy += hole.slope[1] * h; }
    x += vx * h; y += vy * h; pts.push([x, y]);
    if (hyp(vx, vy) < .04 || l === 'water' || l === 'ob') break;
  }
  return pts;
}
function drawPuttAim() {
  const a = puttDragVec(); if (!a) return;
  const px = 1 / cam.s, pl = .07 * stats().putt + gearM('putter').prev;
  const flat = a.v * a.v / (2 * decOf('green'));
  ctx.fillStyle = '#fff';
  if (pl > 0) {
    const pts = simPutt(a, 99), n = Math.max(2, Math.floor(pts.length * Math.min(1, pl)));
    for (let i = 4; i < n; i += 4) { ctx.globalAlpha = 1 - i / n * .7; ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], Math.max(.08, 1.8 * px), 0, TAU); ctx.fill(); }
  } else {
    const L = Math.min(flat, 40); for (let s = .6; s < L; s += Math.max(.35, 7 * px)) { ctx.globalAlpha = 1 - s / L * .7; ctx.beginPath(); ctx.arc(ball.x + a.dx * s, ball.y + a.dy * s, Math.max(.08, 1.8 * px), 0, TAU); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
}
function drawPuttLabel() {
  const a = puttDragVec(); if (!a) return;
  const flat = a.v * a.v / (2 * decOf('green'));
  const [x, y] = toScreen(ball.x, ball.y);
  ctx.font = '800 13px Outfit,-apple-system,Segoe UI,Roboto,sans-serif'; const t = flat.toFixed(1) + ' m'; const w = ctx.measureText(t).width + 16;
  ctx.fillStyle = 'rgba(31,42,34,.85)'; rr(x - w / 2, y + 22, w, 24, 12); ctx.fill(); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y + 35);
  // Kraftbalken am Finger
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(putDrag.sx, putDrag.sy); ctx.lineTo(putDrag.x, putDrag.y); ctx.stroke();
}
function drawMeter() {
  const sb = safeBot(), bw = Math.min(W - 48, 400), x0 = (W - bw) / 2, y0 = H - sb - 118;
  ctx.fillStyle = 'rgba(17,28,22,.9)'; rr(x0 - 16, y0 - 38, bw + 32, 112, 22); ctx.fill();
  ctx.font = '800 12px Outfit,-apple-system,Segoe UI,Roboto,sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const dir = swing.ph === 'dir';
  ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillText(dir ? '1 · RICHTUNG – tippen, wenn die Linie passt' : '2 · KRAFT – am Strich stoppen', x0, y0 - 20);
  if (swing.perfect && !dir) { ctx.textAlign = 'right'; ctx.fillStyle = '#ffe07a'; ctx.fillText('PERFEKT', x0 + bw, y0 - 20); }
  if (dir) {
    const cx = x0 + bw / 2, half = bw / 2 - 8, z = perfZone() * half;
    ctx.fillStyle = 'rgba(255,255,255,.1)'; rr(x0, y0, bw, 18, 9); ctx.fill();
    ctx.fillStyle = 'rgba(255,224,120,.55)'; rr(cx - z, y0, z * 2, 18, 4); ctx.fill();
    const nx = cx + dirVal() * half;
    ctx.fillStyle = '#fff'; rr(nx - 3, y0 - 5, 6, 28, 3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.textAlign = 'left'; ctx.fillText('links', x0, y0 + 38); ctx.textAlign = 'right'; ctx.fillText('rechts', x0 + bw, y0 + 38);
  } else {
    const full = bw / 1.1, pv = swing.ph === 'power' ? swingVal() : swing.p;
    ctx.fillStyle = 'rgba(255,255,255,.1)'; rr(x0, y0, bw, 22, 11); ctx.fill();
    ctx.fillStyle = 'rgba(242,193,78,.3)'; ctx.fillRect(x0 + full, y0, full * .03, 22);
    ctx.fillStyle = 'rgba(232,80,58,.28)'; ctx.fillRect(x0 + full * 1.03, y0, bw - full * 1.03, 22);
    const g = ctx.createLinearGradient(x0, 0, x0 + full, 0); g.addColorStop(0, '#2f7d4f'); g.addColorStop(1, '#7fd88f');
    ctx.fillStyle = pv > 1.03 ? '#e8503a' : pv > 1 ? '#f2c14e' : g; rr(x0, y0, Math.max(22, Math.min(bw, pv * full)), 22, 11); ctx.fill();
    ctx.fillStyle = '#fff'; rr(x0 + swing.pt * full - 2, y0 - 6, 4, 34, 2); ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText(Math.round(hyp(target[0] - ball.x, target[1] - ball.y)) + ' m', x0 + swing.pt * full, y0 + 40);
  }
}
function drawFlightInfo() {
  if (!flight) return;
  const d = Math.round(hyp(ball.x - flight.S[0], ball.y - flight.S[1]));
  ctx.font = '900 15px Outfit,-apple-system,Segoe UI,Roboto,sans-serif'; const t = d + ' m'; const w = ctx.measureText(t).width + 22;
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
  if (round.mini) {
    const m = round.mini, b = miniBest();
    $('#hTitle').textContent = round.label;
    $('#hSub').textContent = 'Ball ' + Math.min(m.max, m.shots.length + 1) + '/' + m.max + ' · ' + (m.kind === 'ctp' ? hyp(hole.pin[0] - ball.x, hole.pin[1] - ball.y).toFixed(0) + ' m zur Fahne' : 'Driver vom Abschlag');
    setScore(b == null ? '–' : m.kind === 'ctp' ? b.toFixed(1).replace('.', ',') + ' m' : b + ' m', 'BESTES');
    const w = hole.wind; $('#windT').textContent = WXI[hole.wx] + ' ' + w.v + ' km/h'; $('#wind i').style.transform = 'rotate(' + (w.a + Math.PI / 2) + 'rad)'; $('#wind i').style.opacity = w.v ? 1 : .2;
    return;
  }
  $('#hTitle').textContent = (round.mode === 'match' && hi >= 9 ? 'Stechen' : 'Loch ' + (hi + 1)) + ' · Par ' + hole.par + ' · ' + hole.len + ' m';
  const dPin = hyp(hole.pin[0] - ball.x, hole.pin[1] - ball.y);
  $('#hSub').textContent = (state === 'autoputt' ? 'Grün · ' + (ap.n === 1 ? '1 Putt' : ap.n + ' Putts') : (strokes === 0 ? 'Abschlag' : LIE[lie].n) + ' · ' + (dPin < 30 ? dPin.toFixed(1) : Math.round(dPin)) + ' m zur Fahne');
  if (round.mode === 'match') setScore(msText(round.ms), 'VS ' + round.opp.n.split(' ').pop().toUpperCase());
  else setScore(fmtD(totalDiff()), 'SCHLAG ' + (strokes + 1));
  const w = hole.wind; $('#windT').textContent = WXI[hole.wx] + ' ' + w.v + ' km/h' + (w.gust ? ' · Böen' : '');
  { const ez = Math.round((hole.elev || 0) - elevAt(hole, ball.x, ball.y)); if (Math.abs(ez) >= 3 && state !== 'autoputt') $('#hSub').textContent += ' · ' + (ez > 0 ? '↗ +' : '↘ −') + Math.abs(ez) + ' m'; }
  $('#wind i').style.transform = 'rotate(' + (w.a + Math.PI / 2) + 'rad)';
  $('#wind i').style.opacity = w.v ? 1 : .2;
}
function setScore(v, sub) {
  const el = $('#scoreT');
  if (el.textContent !== v) { el.textContent = v; const p = $('#score'); p.classList.remove('pop'); void p.offsetWidth; p.classList.add('pop'); }
  $('#strokeT').textContent = sub;
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
$('#spinSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; if (!stats().spin) { toast('Spin gesperrt', 'Spin-Skill auf 2 oder bessere Wedges', 1400); return; } spin = +b.dataset.sp; updPanel(); };
$('#swingBtn').onclick = () => startSwing();
$('#ovBtn').onclick = () => { overview = !overview; };
$('#menuBtn').onclick = () => showOv(`<div class="big" style="font-size:28px">Runde abbrechen?</div><div class="sub">${['tour', 'free'].includes(round.mode) ? 'Deine Runde wird gespeichert – du kannst sie im Menü später fortsetzen.' : 'Der Fortschritt dieser Runde geht verloren.'}</div>
  <div class="btns"><button class="btn" data-a="resume">Weiterspielen</button><button class="btn g" data-a="quit">Zum Menü</button></div>`);

function holeDone(score) {
  state = 'wait';
  round.scores[hi] = score; updHud();
  recordHole(score);
  if (round.mode === 'match') { matchHoleDone(score); return; }
  const d = score - hole.par;
  if (d === -1) save.birdies++; if (d <= -2) save.eagles++; if (score === 1) save.hio++;
  persist();
  if (d < 0) confetti(d <= -2 ? 70 : 35);
  const name = scoreName(score, hole.par);
  const last = hi === round.holes.length - 1;
  if (!last) saveCur();
  showOv(`<div class="big" style="color:${d < 0 ? 'var(--acc)' : d > 0 ? 'var(--warn)' : 'var(--ink)'}">${name}</div>
    <div class="sub">Loch ${hi + 1}/${round.holes.length} · ${score} ${score === 1 ? 'Schlag' : 'Schläge'} · Gesamt ${fmtD(totalDiff())}</div>
    ${round.field ? `<div class="lbh">Leaderboard nach ${hi + 1} ${hi ? 'Löchern' : 'Loch'}</div>` + boardHtml(hi + 1) : cardHtml()}
    <div class="btns"><button class="btn" data-a="${last ? 'finish' : 'next'}">${last ? 'Turnier abschliessen' : 'Loch ' + (hi + 2) + ' →'}</button></div>`);
}
const NAMES = { '-3': 'Albatros', '-2': 'Eagle', '-1': 'Birdie', '0': 'Par', '1': 'Bogey', '2': 'Doppel-Bogey', '3': 'Triple-Bogey' };
function scoreName(s, par) { if (s === 1) return 'Hole-in-One!'; const d = s - par; return NAMES[d] || (d > 0 ? '+' + d : String(d)); }
function sqClass(s, par) { const d = s - par; return d <= -2 ? 's-e' : d === -1 ? 's-b' : d === 0 ? 's-p' : d === 1 ? 's-o' : 's-d'; }
function scoreSym(s, par) {
  const d = s - par, cls = s === 1 ? 'ace' : d <= -2 ? 'eagle' : d === -1 ? 'birdie' : d === 0 ? 'par' : d === 1 ? 'bogey' : 'dbl';
  return `<span class="sy ${cls}">${s}</span>`;
}
function paperNine(a, b, lab) {
  const hs = round.holes.slice(a, b), sc = round.scores.slice(a, b), pt = hs.reduce((x, h) => x + h.par, 0), done = sc.filter(x => x != null);
  return `<div class="pn">
    <i class="lb rh">Loch</i>${hs.map((_, i) => `<i class="rh">${a + i + 1}</i>`).join('')}<i class="rh tt">${lab}</i>
    <i class="lb rp">Par</i>${hs.map(h => `<i class="rp">${h.par}</i>`).join('')}<i class="rp tt">${pt}</i>
    <i class="lb rs">Du</i>${hs.map((h, i) => `<i class="rs">${sc[i] == null ? '<span class="sy no">·</span>' : scoreSym(sc[i], h.par)}</i>`).join('')}<i class="rs tt"><b>${done.length ? done.reduce((x, y) => x + y, 0) : '–'}</b></i>
  </div>`;
}
const SC_LEGEND = '';
function cardHtml() {
  const n = round.holes.length, sc = round.scores, played = sc.filter(x => x != null).length;
  const sum = (x, y) => sc.slice(x, y).reduce((t, v) => t + (v || 0), 0), par = (x, y) => round.holes.slice(x, y).reduce((t, h) => t + h.par, 0);
  const tot = sum(0, n), toPar = sc.reduce((t, v, i) => t + (v == null ? 0 : v - round.holes[i].par), 0);
  const date = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const nines = n > 9 ? paperNine(0, 9, 'OUT') + paperNine(9, n, 'IN') : paperNine(0, n, 'Σ');
  const foot = n > 9
    ? `<div class="pf"><div><small>Out</small><b>${sum(0, 9) || '–'}</b></div><div><small>In</small><b>${sum(9, n) || '–'}</b></div><div class="all"><small>Gesamt</small><b>${played ? tot : '–'}</b><em>${played ? fmtD(toPar) : ''}</em></div></div>`
    : `<div class="pf two"><div><small>Par</small><b>${par(0, n)}</b></div><div class="all"><small>Gesamt</small><b>${played ? tot : '–'}</b><em>${played ? fmtD(toPar) : ''}</em></div></div>`;
  return `<div class="paper">
    <div class="ph"><b>Scorekarte</b><span>${round.label} · ${date}</span></div>
    <div class="pbody">${nines}</div>${foot}
    <div class="pl"><span><span class="sy eagle">2</span>Eagle</span><span><span class="sy birdie">3</span>Birdie</span><span><span class="sy par">4</span>Par</span><span><span class="sy bogey">5</span>Bogey</span><span><span class="sy dbl">6</span>Doppel+</span></div>
  </div>`;
}
function cardPart(a, b, lab) {
  const hs = round.holes.slice(a, b), sc = round.scores.slice(a, b), done = sc.filter(x => x != null).length;
  const cell = (s, h) => s == null ? '<td>·</td>' : `<td><span class="sq ${sqClass(s, h.par)}">${s}</span></td>`;
  return `<table class="sc"><tr><td>${lab}</td>${hs.map((_, i) => `<td>${a + i + 1}</td>`).join('')}<td class="tot">Σ</td></tr>
    <tr><td>Par</td>${hs.map(h => `<td>${h.par}</td>`).join('')}<td class="tot">${hs.reduce((x, h) => x + h.par, 0)}</td></tr>
    <tr><td>Du</td>${hs.map((h, i) => cell(sc[i], h)).join('')}<td class="tot">${done ? sc.reduce((x, y) => x + (y || 0), 0) : '–'}</td></tr></table>`;
}
function xpFor(s, par) { if (s === 1) return 150; const d = s - par; return d <= -2 ? 60 : d === -1 ? 30 : d === 0 ? 12 : d === 1 ? 4 : 1; }
function finishRound() {
  const tot = round.scores.reduce((a, b) => a + b, 0), par = round.holes.reduce((a, h) => a + h.par, 0), d = tot - par;
  let xp = round.scores.reduce((a, s, i) => a + xpFor(s, round.holes[i].par), 0), cash = 0, head = '', extra = '';
  save.rounds++;
  if (save.best == null || d < save.best) save.best = d;
  const rinfo = recordRound();
  if (round.mode === 'tour') {
    const { t, e } = round; delete save.cur; const rows = board(round.holes.length), me = rows.find(r => r.you), place = me.place;
    const purse = TOURS[t].purse[e];
    cash = Math.round(purse * (PAYOUT[place - 1] || .03) / 10) * 10;
    xp += Math.max(0, 13 - place) * 12 * (t + 1);
    const key = t + '-' + e, prev = save.results[key];
    if (!prev || place < prev.place) save.results[key] = { place, d };
    if (place === 1) { save.wins++; if (save.tourOpen < t + 1 && t + 1 < TOURS.length) { save.tourOpen = t + 1; extra = '🔓 ' + TOURS[t + 1].n + ' freigeschaltet!'; } }
    head = place === 1 ? 'Turniersieg!' : (me.pos[0] === 'T' ? 'Geteilter ' : '') + place + '. Platz';
    if (place === 1 && t === 2 && e === 3) extra = '👑 Du hast das Major gewonnen!';
  } else { delete save.cur; cash = round.scores.reduce((a, s, i) => a + xpFor(s, round.holes[i].par) * 3, 0); xp = Math.round(xp * .6); head = 'Runde beendet'; }
  save.money += cash; save.earnings += cash;
  const ups = addXp(xp); persist();
  if (round.mode === 'tour' && board(round.holes.length).find(r => r.you).place <= 3) confetti(board(round.holes.length).find(r => r.you).place === 1 ? 120 : 50);
  later(300, () => Snd.coin());
  if (ups) later(700, () => Snd.good());
  const btns = round.mode === 'tour'
    ? `<button class="btn" data-a="career">Weiter zur Karriere</button><button class="btn g" data-a="again">Turnier wiederholen</button>`
    : `<button class="btn" data-a="again">Nochmal spielen</button><button class="btn g" data-a="home">Zum Menü</button>`;
  const place = round.field ? board(round.holes.length).find(r => r.you) : null;
  showOv(`<div class="fin th-${round.th}"><div class="fin-k">${THEMES[round.th] ? THEMES[round.th].ic : ''} ${round.label} · ${round.holes.length} Loch · ${WXI[round.wx]} ${wxN(round.wx)}</div>
      <div class="fin-row"><div class="fin-big">${place ? (place.place === 1 ? '🏆' : place.place + '.') : fmtD(d)}</div>
      <div class="fin-tx"><b>${head}</b><span>${fmtD(d)} · ${tot} Schläge · Par ${par}</span>${extra ? `<em>${extra}</em>` : ''}</div></div></div>
    ${roundStatsHtml(rinfo)}
    ${round.field ? `<div class="fsec">Leaderboard</div>${boardHtml(round.holes.length, false)}` : ''}
    ${cardHtml()}
    <div class="chips"><span class="chip" data-count="${cash}" data-pre="+" data-suf=" $"></span><span class="chip xp" data-count="${xp}" data-pre="+" data-suf=" XP"></span>${ups ? `<span class="chip lv">Level ${save.lvl}! +${ups} Skillpunkt${ups > 1 ? 'e' : ''}</span>` : ''}</div>
    <div class="btns">${btns}</div>`);
}


// ---------------- Statistik & Handicap ----------------
function recordHole(score) {
  if (round.mini) return;
  const S = save.st, d = score - hole.par;
  round.hs = round.hs || []; round.hs[hi] = { ...hs, score, par: hole.par };
  S.holes++; S.swings += hs.swings; S.perfect += hs.perfect; S.pen += hs.pen;
  if (hole.par >= 4) { S.firN++; if (hs.fir) S.fir++; }
  S.girN++; if (hs.gir) S.gir++;
  S.putts += hs.putts; if (hs.putts === 1) S.p1++; if (hs.putts >= 3) S.p3++;
  if (!hs.gir) { S.scrN++; if (d <= 0) S.scr++; }
  if (hs.sand) { S.sandN++; if (d <= 0) S.sandS++; }
  if (hs.chip) S.chip++;
  if (hs.drive != null) { S.drives++; S.driveSum += hs.drive; S.driveMax = Math.max(S.driveMax, hs.drive); }
  if (hs.prox != null && hs.prox > .05) { S.proxN++; S.proxSum += hs.prox; }
  const k = 'par' + hole.par; S[k][0]++; S[k][1] += score;
  const dk = d <= -2 ? 'e' : d === -1 ? 'b' : d === 0 ? 'p' : d === 1 ? 'bo' : 'd'; S.dist[dk]++;
}
// Course Rating für 9 Löcher: Par + Schwierigkeit + Wetter
function courseRating(holes, wx) { const n = holes.length / 9, dAvg = holes.reduce((a, h) => a + h.diff, 0) / holes.length, wAvg = holes.reduce((a, h) => a + (h.wind.v0 || h.wind.v), 0) / holes.length, eAvg = holes.reduce((a, h) => a + Math.abs(h.elev || 0), 0) / holes.length; return holes.reduce((a, h) => a + h.par, 0) + n * (.2 + dAvg * 1.4 + wAvg * .025 + eAvg * .012 + (WX[wx] && WX[wx].rain ? .4 : 0) + (WX[wx] && WX[wx].fog ? .3 : 0)); }
// Handicap-Index nach WHS-Tabelle (beste X der letzten 20 Differenzen)
function hcpIndex(list = save.hist) {
  const ds = list.slice(-20).map(r => r.diff), n = ds.length; if (n < 3) return null;
  const tab = { 3: [1, -2], 4: [1, -1], 5: [1, 0], 6: [2, -1], 7: [2, 0], 8: [2, 0], 9: [3, 0], 10: [3, 0], 11: [3, 0], 12: [4, 0], 13: [4, 0], 14: [4, 0], 15: [5, 0], 16: [5, 0], 17: [6, 0], 18: [6, 0], 19: [7, 0], 20: [8, 0] };
  const [k, adj] = tab[n], best = ds.slice().sort((a, b) => a - b).slice(0, k);
  return clamp(Math.round((best.reduce((a, b) => a + b, 0) / k + adj) * 10) / 10, -5, 54);
}
const fmtH = v => v == null ? '–' : (v < 0 ? '+' + (-v).toFixed(1) : v.toFixed(1)).replace('.', ',');
function recordRound() {
  const n = round.holes.length; if (round.scores.length < n || (n !== 9 && n !== 18)) return null;
  const tot = round.scores.reduce((a, b) => a + b, 0), par = round.holes.reduce((a, h) => a + h.par, 0);
  const cr = courseRating(round.holes, round.wx), diff = Math.round((tot - cr) * (18 / n) * 10) / 10;
  const H = round.hs || [], fir = H.filter(h => h && h.par >= 4), rec = {
    t: Date.now(), l: round.label, wx: round.wx, s: tot, p: par, cr: Math.round(cr * 10) / 10, diff,
    n, fir: fir.filter(h => h.fir).length, firN: fir.length, gir: H.filter(h => h && h.gir).length, putts: H.reduce((a, h) => a + (h ? h.putts : 0), 0)
  };
  const before = hcpIndex();
  save.hist.push(rec); if (save.hist.length > 60) save.hist.shift();
  const after = hcpIndex();
  if (after != null) { save.hcpHist.push(after); if (save.hcpHist.length > 40) save.hcpHist.shift(); }
  save.st.rounds9 += n / 9; save.st.sum9 += tot - par;
  return { rec, before, after };
}
function roundStatsHtml(info) {
  if (!info) return '';
  const { rec, before, after } = info, ch = before != null && after != null ? after - before : null;
  return `<div class="rstat"><div><b>${rec.fir}/${rec.firN}</b><small>Fairways</small></div><div><b>${rec.gir}/${rec.n}</b><small>Grüns</small></div><div><b>${rec.putts}</b><small>Putts</small></div><div><b>${fmtH(rec.diff)}</b><small>HCP-Diff.</small></div></div>
    <div class="hcpline">Handicap <b>${fmtH(after)}</b>${ch ? ` <span class="${ch < 0 ? 'dn' : 'up'}">${ch < 0 ? '▼' : '▲'} ${Math.abs(ch).toFixed(1).replace('.', ',')}</span>` : after == null ? ` <span>(noch ${3 - save.hist.length} Runde${3 - save.hist.length === 1 ? '' : 'n'})</span>` : ''}</div>`;
}
const pct = (a, b) => b ? Math.round(a / b * 100) + ' %' : '–';
const avg = (a, b, d = 1) => b ? (a / b).toFixed(d).replace('.', ',') : '–';
function sparkline(vals) {
  if (vals.length < 2) return '<div class="nochart">Spiele mindestens 4 gewertete Runden für den Verlauf</div>';
  const w = 320, h = 90, mn = Math.min(...vals) - 1, mx = Math.max(...vals) + 1;
  const pts = vals.map((v, i) => [i / (vals.length - 1) * (w - 16) + 8, 8 + (v - mn) / (mx - mn) * (h - 24)]);
  const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = d + ` L ${pts[pts.length - 1][0]} ${h} L ${pts[0][0]} ${h} Z`;
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${w} ${h}" class="spark"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cc685" stop-opacity=".35"/><stop offset="1" stop-color="#5cc685" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#sg)"/><path d="${d}" fill="none" stroke="#5cc685" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" class="sline"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="4.5" fill="#9be07a"/></svg><div class="spk"><span>↑ besser · ↓ schlechter</span><span>${vals.length} Werte</span></div>`;
}
function renderStats() {
  const S = save.st, h = hcpIndex(), n = save.hist.length, prev = save.hcpHist.length > 1 ? save.hcpHist[save.hcpHist.length - 2] : null;
  const dist = S.dist, dt = dist.e + dist.b + dist.p + dist.bo + dist.d || 1;
  const bar = (k, lab, cl) => `<div class="drow"><span>${lab}</span><div class="dbar"><i class="${cl}" style="width:${dist[k] / dt * 100}%"></i></div><b>${dist[k]}</b></div>`;
  const row = (lab, v, sub) => `<div class="srow"><span>${lab}${sub ? `<small>${sub}</small>` : ''}</span><b>${v}</b></div>`;
  const recent = save.hist.slice(-8).reverse();
  const ds = save.hist.slice(-20).map(r => r.diff).sort((a, b) => a - b);
  const cut = n >= 3 ? ds[Math.min(ds.length, [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 8][Math.min(20, n)]) - 1] : null;
  $('#stats').innerHTML = `<div class="wrap">${back('Statistiken')}
    <div class="card hcpc"><div class="hl"><small>Handicap-Index</small><b>${fmtH(h)}</b>${h != null && prev != null && h !== prev ? `<span class="${h < prev ? 'dn' : 'up'}">${h < prev ? '▼' : '▲'} ${Math.abs(h - prev).toFixed(1).replace('.', ',')}</span>` : ''}
      <em>${h == null ? 'Nach 3 gewerteten Runden (Karriere oder Freies Spiel) bekommst du dein Handicap.' : 'Aus den besten ' + [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 6, 6, 7, 8][Math.min(20, n)] + ' von ' + Math.min(20, n) + ' Runden · 18-Loch-Wert'}</em></div>
      ${sparkline(save.hcpHist.slice(-20))}</div>
    <div class="sech">Übersicht</div>
    <div class="card sgrid"><div><b>${save.rounds}</b><small>Runden</small></div><div><b>${S.holes}</b><small>Löcher</small></div><div><b>${save.wins}</b><small>Turniersiege</small></div>
      <div><b>${save.cupWins || 0}</b><small>Cup-Siege</small></div><div><b>${save.best == null ? '–' : fmtD(save.best)}</b><small>Beste Runde</small></div><div><b>${S.rounds9 ? fmtD(Math.round(S.sum9 / S.rounds9 * 10) / 10).replace('.', ',') : '–'}</b><small>Ø pro 9 Loch</small></div></div>
    <div class="sech">Abschlag</div>
    <div class="card">${row('Fairways getroffen', pct(S.fir, S.firN), S.fir + ' von ' + S.firN)}${row('Ø Drive', S.drives ? Math.round(S.driveSum / S.drives) + ' m' : '–')}${row('Längster Drive', S.driveMax ? S.driveMax + ' m' : '–')}${row('Perfekte Schwünge', pct(S.perfect, S.swings), S.perfect + ' von ' + S.swings)}</div>
    <div class="sech">Annäherung</div>
    <div class="card">${row('Grüns in Regulation', pct(S.gir, S.girN), S.gir + ' von ' + S.girN)}${row('Ø Abstand zur Fahne', S.proxN ? avg(S.proxSum, S.proxN) + ' m' : '–', 'beim Erreichen des Grüns')}${row('Strafschläge', S.pen, avg(S.pen, S.holes / 9) + ' pro Runde')}</div>
    <div class="sech">Kurzes Spiel & Putten</div>
    <div class="card">${row('Putts pro Runde', avg(S.putts, S.holes / 9), avg(S.putts, S.holes, 2) + ' pro Loch')}${row('1-Putts', pct(S.p1, S.holes))}${row('3-Putts', pct(S.p3, S.holes))}${row('Scrambling', pct(S.scr, S.scrN), 'Par oder besser ohne GIR')}${row('Sand Saves', pct(S.sandS, S.sandN), S.sandS + ' von ' + S.sandN)}${row('Chip-ins', S.chip)}</div>
    <div class="sech">Scoring</div>
    <div class="card">${row('Ø Par 3', S.par3[0] ? avg(S.par3[1], S.par3[0], 2) : '–')}${row('Ø Par 4', S.par4[0] ? avg(S.par4[1], S.par4[0], 2) : '–')}${row('Ø Par 5', S.par5[0] ? avg(S.par5[1], S.par5[0], 2) : '–')}${row('Hole-in-One', save.hio)}
      <div class="dist">${bar('e', 'Eagle+', 'c-e')}${bar('b', 'Birdie', 'c-b')}${bar('p', 'Par', 'c-p')}${bar('bo', 'Bogey', 'c-o')}${bar('d', 'Doppel+', 'c-d')}</div></div>
    <div class="sech">Rekorde</div>
    <div class="card sgrid"><div><b>${save.records && save.records.ctp != null ? save.records.ctp.toFixed(1).replace('.', ',') + ' m' : '–'}</b><small>Closest to the Pin</small></div><div><b>${save.records && save.records.ld != null ? save.records.ld + ' m' : '–'}</b><small>Longest Drive</small></div><div><b>${money(save.earnings)}</b><small>Preisgeld</small></div></div>
    <div class="sech">Letzte Runden</div>
    ${recent.length ? `<div class="card rlist">${recent.map(r => `<div class="rr ${cut != null && r.diff <= cut ? 'cnt' : ''}"><div><b>${r.l}</b><small>${new Date(r.t).toLocaleDateString('de-DE')} · ${WXI[r.wx] || ''} · CR ${String(r.cr).replace('.', ',')} · FIR ${r.fir}/${r.firN} · ${r.n || 9} L · GIR ${r.gir}/${r.n || 9} · ${r.putts} Putts</small></div><span>${fmtD(r.s - r.p)}<small>${fmtH(r.diff)}</small></span></div>`).join('')}</div><p class="help">Grün markiert = zählt fürs Handicap</p>` : '<p class="help">Noch keine gewerteten Runden</p>'}
    <button class="btn g" id="resetStats" style="margin-top:8px">Statistik zurücksetzen</button>
  </div>`;
}

// ---------------- Effekte im UI ----------------
function intro(t, sub, sub2) {
  const el = $('#intro'); el.innerHTML = `<b>${t}</b><span>${sub}</span>${sub2 ? `<small>${sub2}</small>` : ''}`;
  el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
}
function confetti(n = 60) {
  const box = $('#confetti'), cols = ['#ffd65c', '#5cc685', '#ffffff', '#ef8a5b', '#7cc3ff'];
  for (let i = 0; i < n; i++) {
    const d = document.createElement('i');
    d.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-delay:${Math.random() * .4}s;animation-duration:${1.6 + Math.random() * 1.4}s;--dx:${(Math.random() - .5) * 160}px;--r:${Math.random() * 720 - 360}deg;width:${6 + Math.random() * 6}px;height:${8 + Math.random() * 8}px`;
    box.appendChild(d); setTimeout(() => d.remove(), 3500);
  }
}
function countUp(root) {
  root.querySelectorAll('[data-count]').forEach(el => {
    const end = +el.dataset.count, pre = el.dataset.pre || '', suf = el.dataset.suf || '', t0 = performance.now(), dur = 900;
    const fmt = v => pre + Math.round(v).toLocaleString('de-DE') + suf;
    const step = now => { const u = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - u, 3); el.textContent = fmt(end * e); if (u < 1) requestAnimationFrame(step); };
    el.textContent = fmt(0); requestAnimationFrame(step);
  });
}

// ---------------- Challenges: Closest to the Pin / Longest Drive ----------------
const MEDALS = { ctp: [2.5, 5, 9], ld: [262, 246, 232] };
const MREW = [[700, 90], [350, 60], [160, 35], [40, 12]];
function miniBest() { const v = round.mini.shots.filter(x => x != null); if (!v.length) return null; return round.mini.kind === 'ctp' ? Math.min(...v) : Math.max(...v); }
function miniShotDone(miss, holedIn) {
  const m = round.mini; let v = null, txt;
  if (m.kind === 'ctp') { v = miss ? null : holedIn ? 0 : hyp(ball.x - hole.pin[0], ball.y - hole.pin[1]); txt = v == null ? 'Daneben' : holedIn ? 'Hole-in-One!' : v.toFixed(1).replace('.', ',') + ' m'; if (holedIn) { save.hio++; confetti(80); } }
  else { const l = lieAt(hole, ball.x, ball.y); v = miss || !['fairway', 'fringe', 'green'].includes(l) ? null : Math.round(hyp(ball.x - hole.tee[0], ball.y - hole.tee[1])); txt = v == null ? (miss ? 'Daneben' : 'Nicht auf dem Fairway') : v + ' m'; }
  m.shots.push(v); state = 'wait';
  const best = miniBest(); const isBest = v != null && v === best;
  toast(txt, (isBest ? 'Neue Bestmarke · ' : '') + 'Ball ' + m.shots.length + '/' + m.max, 1400);
  updHud();
  later(1600, () => {
    if (m.shots.length >= m.max) { miniFinish(); return; }
    ball = { x: hole.tee[0], y: hole.tee[1], z: 0, vx: 0, vy: 0 }; strokes = 0; trail = []; flight = null; setupShot(); updHud();
  });
}
function miniFinish() {
  state = 'wait';
  const m = round.mini, k = m.kind, best = miniBest(), th = MEDALS[k];
  const medal = best == null ? 3 : k === 'ctp' ? (best <= th[0] ? 0 : best <= th[1] ? 1 : best <= th[2] ? 2 : 3) : (best >= th[0] ? 0 : best >= th[1] ? 1 : best >= th[2] ? 2 : 3);
  const [cash, xp] = MREW[medal];
  save.records = save.records || {};
  const rec = save.records[k], newRec = best != null && (rec == null || (k === 'ctp' ? best < rec : best > rec));
  if (newRec) save.records[k] = best;
  save.money += cash; save.earnings += cash; const ups = addXp(xp); save.rounds++; persist();
  if (medal === 0) confetti(90);
  later(300, () => Snd.coin());
  const fmtV = v => v == null ? '–' : k === 'ctp' ? v.toFixed(1).replace('.', ',') + ' m' : v + ' m';
  const mi = ['🥇', '🥈', '🥉', '🎯'][medal], mn = ['Gold', 'Silber', 'Bronze', 'Keine Medaille'][medal];
  showOv(`<div class="sub" style="margin:0">${round.label} ${WXI[round.wx]}</div><div class="medal">${mi}</div><div class="big">${mn}</div>
    <div class="sub">Bestes: ${fmtV(best)}${newRec ? ' · Neuer Rekord!' : rec != null ? ' · Rekord ' + fmtV(rec) : ''}</div>
    <div class="shots">${m.shots.map((v, i) => `<div class="${v === best && v != null ? 'b' : ''}"><small>Ball ${i + 1}</small><b>${fmtV(v)}</b></div>`).join('')}</div>
    <div class="hint2">${k === 'ctp' ? 'Gold ≤ 2,5 m · Silber ≤ 5 m · Bronze ≤ 9 m' : 'Gold ≥ 262 m · Silber ≥ 246 m · Bronze ≥ 232 m'}</div>
    <div class="chips"><span class="chip" data-count="${cash}" data-pre="+" data-suf=" $"></span><span class="chip xp" data-count="${xp}" data-pre="+" data-suf=" XP"></span>${ups ? `<span class="chip lv">Level ${save.lvl}!</span>` : ''}</div>
    <div class="btns"><button class="btn" data-a="mini">Nochmal</button><button class="btn g" data-a="home">Zum Menü</button></div>`);
}

// ---------------- Matchplay Cup (1 gegen 1, K.-o.-Baum) ----------------
const CUPS = [
  { n: 'Bronze Matchplay', tier: 0, prize: [150, 450, 900, 2200], need: 0 },
  { n: 'Silber Matchplay', tier: 1, prize: [700, 1800, 3600, 8000], need: 1 },
  { n: 'Gold Matchplay', tier: 2, prize: [2500, 6000, 12000, 28000], need: 2 },
];
const RNDN = ['Viertelfinale', 'Halbfinale', 'Finale'];
const msText = ms => ms > 0 ? ms + ' UP' : ms < 0 ? -ms + ' DN' : 'AS';
function startCup(c) {
  const t = CUPS[c].tier, [lo, hi2] = TOURS[t].skill, names = NAMES_F.slice().sort(() => Math.random() - .5);
  const players = [{ n: 'Du', you: true, sk: 0 }].concat(names.slice(0, 7).map(n => ({ n, sk: lo + (hi2 - lo) * Math.random() })));
  // gesetzt: Du gegen einen zufälligen Gegner, Rest gemischt
  const order = [0, 1, 2, 3, 4, 5, 6, 7];
  const rounds = [[[0, 1], [2, 3], [4, 5], [6, 7]].map(([a, b]) => ({ a: order[a], b: order[b], w: null, res: '' }))];
  save.cup = { c, players, rounds, r: 0, out: false, done: false };
  persist(); showScreen('cup');
}
function cupMyMatch() { const c = save.cup; return c.rounds[c.r].find(m => m.a === 0 || m.b === 0); }
function cupOpp() { const m = cupMyMatch(); return m.a === 0 ? m.b : m.a; }
function simOpp(h, sk) { const g = (Math.random() + Math.random() + Math.random() - 1.5) * 1.5; let d = Math.round(sk + (h.diff - .5) * .3 + g * .72); d = clamp(d, h.par === 5 ? -2 : -1, 3); return h.par + d; }
function matchHoleDone(score) {
  const o = simOpp(hole, round.opp.sk); round.oSc = round.oSc || []; round.oSc[hi] = o;
  const res = score < o ? 1 : score > o ? -1 : 0; round.ms += res;
  const n = hi + 1, rem = Math.max(0, 9 - n), decided = Math.abs(round.ms) > rem || (n >= 9 && round.ms !== 0);
  if (res > 0) { Snd.good(); confetti(25); }
  const head = res > 0 ? 'Loch gewonnen!' : res < 0 ? 'Loch verloren' : 'Loch geteilt';
  const opp = round.opp.n;
  let btn;
  if (decided) btn = `<button class="btn" data-a="mend">Match beenden</button>`;
  else if (n >= 9) { round.holes.push(genHole(rng(round.seed + n * 131), [4, 3, 4, 5][n % 4], round.holes[0].diff, round.wx, { th: round.th })); btn = `<button class="btn" data-a="mnext">Stechen – Extraloch →</button>`; }
  else btn = `<button class="btn" data-a="mnext">Loch ${n + 1} →</button>`;
  showOv(`<div class="big" style="color:${res > 0 ? 'var(--acc)' : res < 0 ? 'var(--warn)' : 'var(--ink)'}">${head}</div>
    <div class="vs"><div class="${res > 0 ? 'w' : ''}"><small>Du</small><b>${score}</b><em>${scoreName(score, hole.par)}</em></div><span>Loch ${n > 9 ? 'X' : n}</span><div class="${res < 0 ? 'w' : ''}"><small>${opp}</small><b>${o}</b><em>${scoreName(o, hole.par)}</em></div></div>
    <div class="mstat">${decided ? (round.ms > 0 ? 'Du gewinnst ' : opp + ' gewinnt ') + matchResult() : 'Stand: ' + msText(round.ms) + (rem ? ' · noch ' + rem + ' Löcher' : '')}</div>
    ${matchCard()}<div class="btns">${btn}</div>`);
}
function matchResult() { const n = round.scores.length, rem = Math.max(0, 9 - n), a = Math.abs(round.ms); return n > 9 ? 'am ' + n + '. Loch' : rem ? a + '&' + rem : a + ' UP'; }
function matchCard() {
  const hs = round.scores.map((s, i) => { const o = round.oSc[i], r = s < o ? 'w' : s > o ? 'l' : 'h'; return `<i class="${r}">${i >= 9 ? 'X' : i + 1}</i>`; }).join('');
  return `<div class="mcard">${hs}</div>`;
}
function simMatch(m, P) {
  const a = P[m.a], b = P[m.b], pa = 1 / (1 + Math.exp((a.sk - b.sk) * 7));
  m.w = Math.random() < pa ? m.a : m.b;
  const mg = 1 + Math.floor(Math.random() * 4), rest = Math.max(0, Math.min(mg - 1, 1 + Math.floor(Math.random() * 3)));
  m.res = rest ? mg + '&' + rest : mg + ' UP';
}
function nextRound(c) {
  const prev = c.rounds[c.r], nr = [];
  for (let i = 0; i < prev.length; i += 2) nr.push({ a: prev[i].w, b: prev[i + 1].w, w: null, res: '' });
  c.rounds.push(nr); c.r++;
}
function matchEnd() {
  const c = save.cup, m = cupMyMatch(), won = round.ms > 0;
  m.w = won ? 0 : cupOpp(); m.res = matchResult();
  c.rounds[c.r].forEach(x => { if (x !== m) simMatch(x, c.players); });
  let xp = 40 + (won ? 60 : 0) * (CUPS[c.c].tier + 1), cash = 0, msg;
  if (!won) {
    c.out = true; cash = CUPS[c.c].prize[c.r];
    while (c.rounds[c.r].length > 1) { nextRound(c); c.rounds[c.r].forEach(x => simMatch(x, c.players)); }
    msg = 'Aus im ' + RNDN[c.r_out = c.rounds.findIndex(r => r.includes(m))] + '. Preisgeld ' + money(cash);
  } else if (c.r === 2) { c.done = true; cash = CUPS[c.c].prize[3]; save.cupWins = (save.cupWins || 0) + 1; msg = '🏆 Cup gewonnen! Preisgeld ' + money(cash); }
  else { nextRound(c); msg = 'Weiter ins ' + RNDN[c.r] + '!'; }
  if (c.out || c.done) { c.cash = cash; save.money += cash; save.earnings += cash; }
  const ups = addXp(xp); save.rounds++; persist();
  if (won) { confetti(c.done ? 120 : 60); Snd.good(); }
  showOv(`<div class="sub" style="margin:0">${CUPS[c.c].n} · ${RNDN[c.out ? c.rounds.findIndex(r => r.includes(m)) : won && !c.done ? c.r - 1 : c.r]}</div>
    <div class="big" style="color:${won ? 'var(--acc)' : 'var(--warn)'}">${won ? 'Sieg ' + m.res : 'Niederlage'}</div>
    <div class="sub">${won ? 'gegen ' : 'gegen '}${round.opp.n}${won ? '' : ' · ' + m.res}</div>${matchCard()}
    <div class="sub">${msg}</div>
    <div class="chips">${cash ? `<span class="chip" data-count="${cash}" data-pre="+" data-suf=" $"></span>` : ''}<span class="chip xp" data-count="${xp}" data-pre="+" data-suf=" XP"></span>${ups ? `<span class="chip lv">Level ${save.lvl}!</span>` : ''}</div>
    <div class="btns"><button class="btn" data-a="cup">Zum Turnierbaum</button></div>`);
}
function renderCup() {
  const c = save.cup;
  if (!c) {
    $('#cup').innerHTML = `<div class="wrap">${back('Matchplay Cup')}
      <p class="help" style="text-align:left;margin:0 4px 14px">1 gegen 1, Loch für Loch. Wer ein Loch mit weniger Schlägen spielt, gewinnt es. Acht Spieler, K.-o.-System: Viertelfinale, Halbfinale, Finale.</p>
      ${CUPS.map((C, i) => { const lock = save.tourOpen < C.need; return `<div class="card ev ${lock ? 'lock' : ''}"><div class="no">${['🥉', '🥈', '🥇'][i]}</div><div class="tx"><b>${C.n}</b><span>${lock ? '🔒 Schalte die ' + TOURS[C.need].n + ' frei' : 'Siegprämie ' + money(C.prize[3])}</span></div><button class="sbtn ${lock ? 'dis' : ''}" data-cup="${i}" ${lock ? 'disabled' : ''}>Start</button></div>`; }).join('')}
    </div>`;
    return;
  }
  const P = c.players, nm = i => i == null ? '?' : P[i].n, col = (ms, ri) => `<div class="bcol"><h4>${RNDN[ri]}</h4>${ms.map(m => `<div class="bm ${m.a === 0 || m.b === 0 ? 'mine' : ''}">
      <div class="${m.w === m.a ? 'w' : m.w != null ? 'l' : ''}">${nm(m.a)}</div><div class="${m.w === m.b ? 'w' : m.w != null ? 'l' : ''}">${nm(m.b)}</div>${m.res ? `<small>${m.res}</small>` : ''}</div>`).join('')}</div>`;
  const cols = [0, 1, 2].map(ri => c.rounds[ri] ? col(c.rounds[ri], ri) : col(Array.from({ length: [4, 2, 1][ri] }, () => ({ a: null, b: null, w: null })), ri)).join('');
  const champ = c.rounds[2] && c.rounds[2][0].w != null ? P[c.rounds[2][0].w].n : null;
  let action;
  if (c.done) action = `<div class="card champ"><div class="medal">🏆</div><b>Du bist Cup-Sieger!</b><span>${money(c.cash)} Preisgeld</span></div><button class="btn" data-cupclose="1">Cup abschliessen</button>`;
  else if (c.out) action = `<div class="card champ"><b>${champ ? champ + ' gewinnt den Cup' : 'Ausgeschieden'}</b><span>Dein Preisgeld: ${money(c.cash || 0)}</span></div><button class="btn" data-cupclose="1">Cup abschliessen</button>`;
  else { const o = P[cupOpp()]; action = `<div class="card nextm"><small>${RNDN[c.r]}</small><div class="vsr"><b>Du</b><span>vs</span><b>${o.n}</b></div><span class="sk">Gegnerstärke ${'★'.repeat(o.sk < -.1 ? 3 : o.sk < .2 ? 2 : 1)}</span></div><button class="btn" data-go="match">Match starten</button>`; }
  $('#cup').innerHTML = `<div class="wrap">${back(CUPS[c.c].n)}<div class="bracket">${cols}</div>${action}</div>`;
}

let ovT = 0;
function showOv(html) { clearTimeout(ovT); const o = $('#ov'); o.classList.remove('closing'); $('#ovCard').innerHTML = html; o.classList.remove('hidden'); $('#ovCard').scrollTop = 0; countUp($('#ovCard')); }
function hideOv() {
  const o = $('#ov'); if (o.classList.contains('hidden')) return;
  if (window.__fwNoFx) { o.classList.add('hidden'); return; }
  o.classList.add('closing'); clearTimeout(ovT); ovT = setTimeout(() => { o.classList.add('hidden'); o.classList.remove('closing'); }, 230);
}
// Sanfte Blende zwischen Bildschirmen und Löchern
let curT = 0;
function curtain(fn) {
  if (window.__fwNoFx) { fn(); return; }
  const c = $('#curtain'); c.classList.add('on'); clearTimeout(curT);
  curT = setTimeout(() => { fn(); requestAnimationFrame(() => requestAnimationFrame(() => c.classList.remove('on'))); }, 280);
}
$('#ov').addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return; const a = b.dataset.a;
  hideOv();
  if (a === 'resume') return;
  if (a === 'finish') { finishRound(); return; }
  if (a === 'mend') { matchEnd(); return; }
  const r = round;
  curtain(() => {
    if (a === 'next' || a === 'mnext') startHole(hi + 1);
    else if (a === 'again') startRound(r.mode, r.mode === 'tour' ? { t: r.t, e: r.e } : r.mode === 'free' ? { course: r.course, n: r.holes.length } : {});
    else if (a === 'career') showScreen('career');
    else if (a === 'cup') showScreen('cup');
    else if (a === 'mini') startRound(r.mode);
    else if (a === 'play18' || a === 'play9') startRound('free', { course: selCourse, n: a === 'play18' ? 18 : 9 });
    else showScreen('home');
  });
});

function enterPlay() { mode = 'play'; $('#ios').classList.add('hidden'); SCREENS.forEach(id => $('#' + id).classList.add('hidden')); hud.classList.remove('hidden'); panel.classList.remove('hidden'); }

// ---------------- Menüs ----------------
const SCREENS = ['home', 'career', 'player', 'shop', 'cup', 'stats', 'courses'];
const logo = `<svg viewBox="0 0 40 40"><polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="#3b9a62"/><polygon points="20,2 36,11 20,20" fill="#4fb576"/><polygon points="4,29 20,20 20,38" fill="#2f7d4f"/><path d="M17 9v19" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/><path d="M17 9l9 3.5-9 3.5z" fill="#e8503a"/></svg>`;
const moneyHtml = () => `<div class="coins">${money(save.money)}</div>`;
const back = t => `<div class="top"><button class="pill ib" data-go="home">‹</button><h2>${t}</h2>${moneyHtml()}</div>`;
function showScreen(name) {
  mode = 'menu'; round = null; hole = null; timers = [];
  hud.classList.add('hidden'); panel.classList.add('hidden'); hideOv();
  SCREENS.forEach(id => $('#' + id).classList.toggle('hidden', id !== name));
  ({ home: renderHome, career: renderCareer, player: renderPlayer, shop: renderShop, cup: renderCup, stats: renderStats, courses: renderCourses })[name]();
  const el = $('#' + name); el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter'); el.scrollTop = 0;
}
function renderHome() {
  const [t, e] = nextEvent(), need = xpNeed(save.lvl);
  $('#home').innerHTML = `<div class="wrap">
    <div class="top"><div class="logo">${logo}<span>Fairway</span></div><div style="flex:1"></div>${moneyHtml()}<button class="pill ib" id="mute">${save.muted ? '🔇' : '🔊'}</button></div>
    <div class="card prof" data-go="stats"><div class="av">DU</div><div class="hcpb"><small>HCP</small><b>${fmtH(hcpIndex())}</b></div><div class="tx"><b>Level ${save.lvl}</b><span>${TOURS[Math.min(save.tourOpen, 2)].n} · ${save.wins} ${save.wins === 1 ? 'Sieg' : 'Siege'}</span>
      <div class="xpb"><i style="width:${Math.round(save.xp / need * 100)}%"></i></div><small>${save.xp} / ${need} XP${save.sp ? ` · <b class="spn">${save.sp} Skillpunkt${save.sp > 1 ? 'e' : ''}</b>` : ''}</small></div></div>
    ${save.cur ? `<div class="card resume th-${CRS[save.cur.course].th}"><div class="k">Laufende Runde</div><div class="t">${save.cur.mode === 'tour' ? TOURS[save.cur.t].ev[save.cur.e] : CRS[save.cur.course].n}</div>
      <div class="s">${THEMES[CRS[save.cur.course].th].ic} ${CRS[save.cur.course].n} · Loch ${save.cur.scores.length + 1}/${save.cur.n} · ${fmtD(save.cur.scores.reduce((a, x, i) => a + x, 0) - courseHoles(save.cur.course, save.cur.n).slice(0, save.cur.scores.length).reduce((a, h) => a + h.par, 0))}</div>
      <div class="row"><button class="btn w" data-resume="1">Fortsetzen</button><button class="btn g" data-drop="1" style="flex:.45">Verwerfen</button></div></div>` : ''}
    <div class="card hero th-${CRS[TOURS[t].c[e]].th}"><div class="k">${TOURS[t].n} · Turnier ${e + 1}/4 · 18 Loch</div><div class="t">${TOURS[t].ev[e]}</div>
      <div class="s">${THEMES[CRS[TOURS[t].c[e]].th].ic} ${CRS[TOURS[t].c[e]].n} · ${WXI[evWx(t, e)]} ${wxN(evWx(t, e))} · ${money(TOURS[t].purse[e])}</div>
      <button class="btn w" data-ev="${t}-${e}">Antreten</button></div>
    <div class="sech">Spielmodi</div>
    <div class="grid2">
      <button class="card tile t1" data-go="career"><span>🏆</span><b>Karriere</b><small>3 Touren · 12 Turniere</small></button>
      <button class="card tile t2" data-go="cup"><span>⚔️</span><b>Matchplay Cup</b><small>${save.cup && !save.cup.out && !save.cup.done ? RNDN[save.cup.r] + ' läuft' : '1 gegen 1 · K.-o.'}</small></button>
      <button class="card tile t3" data-go="ctp"><span>🎯</span><b>Closest to the Pin</b><small>Rekord ${save.records && save.records.ctp != null ? save.records.ctp.toFixed(1).replace('.', ',') + ' m' : '–'}</small></button>
      <button class="card tile t4" data-go="ld"><span>💥</span><b>Longest Drive</b><small>Rekord ${save.records && save.records.ld != null ? save.records.ld + ' m' : '–'}</small></button>
    </div>
    <button class="card wide" data-go="courses"><span>🗺️</span><div><b>Plätze · Freies Spiel</b><small>${COURSES.length} Plätze in ${Object.keys(THEMES).length} Landschaften · 9 oder 18 Loch</small></div><em>›</em></button>
    <div class="sech">Dein Spieler</div>
    <div class="grid2">
      <button class="card tile" data-go="player"><span>🏌️</span><b>Skills</b><small>${save.sp ? save.sp + (save.sp === 1 ? ' Punkt' : ' Punkte') + ' frei' : 'Werte ansehen'}</small>${save.sp ? '<i class="badge">' + save.sp + '</i>' : ''}</button>
      <button class="card tile" data-go="shop"><span>🛍️</span><b>Ausrüstung</b><small>Schläger kaufen</small></button>
    </div>
    <button class="card wide" data-go="stats"><span>📊</span><div><b>Statistiken & Handicap</b><small>HCP ${fmtH(hcpIndex())} · Fairways ${pct(save.st.fir, save.st.firN)} · GIR ${pct(save.st.gir, save.st.girN)} · ${avg(save.st.putts, save.st.holes / 9)} Putts</small></div><em>›</em></button>
    <div class="card stat"><div><b>${save.rounds}</b><span>Runden</span></div><div><b>${save.birdies}</b><span>Birdies</span></div><div><b>${money(save.earnings)}</b><span>Preisgeld</span></div></div>
    <p class="help">Ziel antippen · Schläger, Draw/Fade, Spin wählen · „Schlagen“<br>1. Tipp stoppt die pendelnde Linie · 2. Tipp stoppt die Kraft<br>Auf dem Grün: goldener Ring = 1 Putt, weisser Ring = 2, sonst 3</p>
    <p class="ver">Fairway · Version 1.5</p>
  </div>`;
}
function renderCareer() {
  $('#career').innerHTML = `<div class="wrap">${back('Karriere')}
    ${TOURS.map((T, t) => {
      const lock = t > save.tourOpen;
      return `<div class="tourh ${lock ? 'lock' : ''}"><b>${T.n}</b><span>${lock ? '🔒 Gewinne ein Turnier der ' + TOURS[t - 1].n : 'Spielerstärke ' + (t === 0 ? '★' : t === 1 ? '★★' : '★★★')}</span></div>
      ${T.ev.map((n, e) => { const r = save.results[t + '-' + e], wx = evWx(t, e);
        const C = CRS[T.c[e]];
        return `<div class="card ev ${lock ? 'lock' : ''}"><div class="no th-${C.th}">${r && r.place === 1 ? '🏆' : THEMES[C.th].ic}</div><div class="tx"><b>${n}</b><span>${C.n} · ${WXI[wx]} · ${money(T.purse[e])}${r ? ' · Bestes: ' + r.place + '. (' + fmtD(r.d) + ')' : ''}</span></div>
          <button class="sbtn ${lock ? 'dis' : ''}" data-ev="${t}-${e}" ${lock ? 'disabled' : ''}>Spielen</button></div>`; }).join('')}`;
    }).join('')}
  </div>`;
}
let selCourse = null;
const courseInfo = {};
function cInfo(id) { if (!courseInfo[id]) { const hs = courseHoles(id, 18); courseInfo[id] = { par: hs.reduce((a, h) => a + h.par, 0), len: hs.reduce((a, h) => a + h.len, 0), elev: Math.round(hs.reduce((a, h) => a + Math.abs(h.elev), 0) / 18), water: hs.filter(h => h.water.length).length }; } return courseInfo[id]; }
function renderCourses() {
  const byTh = Object.keys(THEMES).map(th => [th, COURSES.filter(c => c.th === th)]);
  $('#courses').innerHTML = `<div class="wrap">${back('Plätze')}
    <button class="card wide rnd" data-course="__rnd"><span>🎲</span><div><b>Zufälliger Platz</b><small>Überrasch mich – Platz und Wetter</small></div><em>›</em></button>
    ${byTh.map(([th, cs]) => `<div class="tourh"><b>${THEMES[th].ic} ${THEMES[th].n}</b><span>${{ park: 'Bäume, Teiche, faire Fairways', links: 'Meer, Dünen, viel Wind', desert: 'Kakteen, Sandflächen, Hitze', alpine: 'Kiefern, Felsen, grosse Höhen', tropic: 'Palmen, Meer, Regenschauer', autumn: 'Bunte Wälder, Nebel' }[th]}</span></div>
      ${cs.map(c => { const i = cInfo(c.id); return `<button class="card course th-${th}" data-course="${c.id}"><div class="cc"><b>${c.n}</b><small>${c.loc} · Par ${i.par} · ${(i.len / 1000).toFixed(1).replace('.', ',')} km · Ø ${i.elev} m Höhe</small></div><div class="stars">${'★'.repeat(1 + Math.round(c.d * 4))}<i>${'★'.repeat(5 - 1 - Math.round(c.d * 4))}</i></div></button>`; }).join('')}`).join('')}
  </div>`;
}
function renderPlayer() {
  const st = stats();
  $('#player').innerHTML = `<div class="wrap">${back('Spieler')}
    <div class="card prof" data-go="stats"><div class="av">DU</div><div class="hcpb"><small>HCP</small><b>${fmtH(hcpIndex())}</b></div><div class="tx"><b>Level ${save.lvl}</b><span>${save.sp} Skillpunkt${save.sp === 1 ? '' : 'e'} frei · pro Level +1 (alle 5 Level +2)</span></div></div>
    ${ATTRS.map(a => { const L = save.at[a.id], can = save.sp > 0 && L < AMAX;
      return `<div class="card sk"><div class="ic">${a.ic}</div><div class="tx"><div class="skh"><b>${a.n}</b><em>${L}/${AMAX}</em></div><p>${a.d}</p>
        <div class="dots">${Array.from({ length: AMAX }, (_, i) => `<i class="${i < L ? 'f' : ''}"></i>`).join('')}</div></div>
        <button class="plus ${can ? '' : 'dis'}" data-skill="${a.id}" ${can ? '' : 'disabled'}>+</button></div>`; }).join('')}
    <p class="help">Spin-Stufe aktuell: ${st.spin}/5 (aus Skill + Wedges)</p>
  </div>`;
}
function statLine(slot, m) {
  if (slot === 'putter') return `Gefühl +${Math.round(m.cap * 100)} · Linie +${Math.round(m.prev * 100)} %`;
  return `Weite +${Math.round(m.dist * 100)} % · Präzision +${Math.round(m.acc * 100)} %${m.spin ? ' · Spin +' + m.spin : ''}`;
}
function renderShop() {
  $('#shop').innerHTML = `<div class="wrap">${back('Ausrüstung')}
    ${Object.entries(GEAR).map(([slot, G]) => `<div class="tourh"><b>${G.ic} ${G.n}</b><span>${G.clubs.length > 1 ? G.clubs.join(' · ') : ''}</span></div>
      ${G.m.map((m, i) => { const own = save.owned[slot].includes(i), eq = save.gear[slot] === i, can = save.money >= m.p;
        const btn = eq ? `<button class="sbtn on" disabled>Im Bag</button>` : own ? `<button class="sbtn" data-equip="${slot}-${i}">Einpacken</button>` : `<button class="sbtn ${can ? '' : 'dis'}" data-buy="${slot}-${i}" ${can ? '' : 'disabled'}>${money(m.p)}</button>`;
        return `<div class="card ev gear ${eq ? 'eq' : ''}"><div class="no">${'★'.repeat(i + 1)}</div><div class="tx"><b>${m.n}</b><span>${statLine(slot, m)}</span></div>${btn}</div>`; }).join('')}`).join('')}
  </div>`;
}
document.addEventListener('click', e => {
  if (e.target.closest('#mute')) { save.muted = !save.muted; persist(); renderHome(); return; }
  const q = sel => e.target.closest(sel);
  const g = q('[data-go]'), ev = q('[data-ev]'), b = q('[data-buy]'), eq = q('[data-equip]'), sk = q('[data-skill]');
  const cu = q('[data-cup]'), cc = q('[data-cupclose]');
  if (q('#resetStats')) { if (q('#resetStats').dataset.ok) { save.st = newSt(); save.hist = []; save.hcpHist = []; persist(); renderStats(); } else { q('#resetStats').dataset.ok = 1; q('#resetStats').textContent = 'Wirklich zurücksetzen? Nochmal tippen'; } return; }
  const crs = q('[data-course]');
  if (crs) { Snd.init(); Snd.tick(); selCourse = crs.dataset.course === '__rnd' ? COURSES[Math.floor(Math.random() * COURSES.length)].id : crs.dataset.course; const C = CRS[selCourse], i = cInfo(selCourse);
    showOv(`<div class="sub" style="margin:0">${THEMES[C.th].ic} ${THEMES[C.th].n} · ${C.loc}</div><div class="big" style="font-size:30px">${C.n}</div><div class="sub">Par ${i.par} · ${(i.len / 1000).toFixed(1).replace('.', ',')} km · ${i.water} Löcher mit Wasser</div>
      <div class="btns"><button class="btn" data-a="play18">18 Loch spielen</button><button class="btn g" data-a="play9">9 Loch (Front Nine)</button><button class="btn g" data-a="resume">Abbrechen</button></div>`); return; }
  if (q('[data-resume]')) { Snd.init(); curtain(resumeRound); return; }
  if (q('[data-drop]')) { delete save.cur; persist(); renderHome(); return; }
  if (cu) { Snd.init(); startCup(+cu.dataset.cup); return; }
  if (cc) { save.cup = null; persist(); showScreen('cup'); return; }
  if (g) { Snd.init(); Snd.tick(); const v = g.dataset.go; if (['free', 'ctp', 'ld', 'match'].includes(v)) curtain(() => startRound(v)); else if (mode === 'play') curtain(() => showScreen(v)); else showScreen(v); }
  else if (ev) { Snd.init(); const [t, n] = ev.dataset.ev.split('-').map(Number); curtain(() => startRound('tour', { t, e: n })); }
  else if (b) { const [slot, i] = b.dataset.buy.split('-'), m = GEAR[slot].m[+i]; if (save.money >= m.p) { save.money -= m.p; save.owned[slot].push(+i); save.gear[slot] = +i; persist(); Snd.coin(); buzz(20); renderShop(); } }
  else if (eq) { const [slot, i] = eq.dataset.equip.split('-'); save.gear[slot] = +i; persist(); Snd.tick(); renderShop(); }
  else if (sk) { const id = sk.dataset.skill; if (save.sp > 0 && save.at[id] < AMAX) { save.sp--; save.at[id]++; persist(); Snd.coin(); buzz(15); renderPlayer(); } }
});

// Test-Hook
window.__fw = {
  get state() { return state; }, get ball() { return ball; }, get hole() { return hole; }, get strokes() { return strokes; }, get round() { return round; }, get lie() { return lie; }, get save() { return save; },
  get target() { return target; }, set target(v) { target = v; }, get club() { return clubI; }, set club(v) { clubI = v; },
  startRound, genCourse, lieAt, board, hcpIndex, renderStats, courseHoles, resume: () => resumeRound(), update, autoClub, carry: c => carry(CLUBS[c]),
  hit(p, a) { startSwing(); swing.p = p; swing.a = a; swing.ph = 'done'; hitBall(); },
  putt(dx, dy, v) { const l = hyp(dx, dy); doPutt({ dx: dx / l, dy: dy / l, v, p: 1 }); },
  run(maxT = 30) { for (let t = 0; t < maxT && !['aim', 'putt', 'wait', 'holed'].includes(state); t += 1 / 60) update(1 / 60); for (let i = 0; i < 200 && state === 'wait'; i++) { update(1 / 60); } },
  holeDone, finishRound, setupShot,
};

// iPhone/iPad in Safari (nicht installiert): Hinweis zum Installieren
(function iosHint() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches || window.Capacitor;
  let seen = 0; try { seen = +localStorage.getItem('fw_ios_hint') || 0; } catch (e) {}
  if (!ios || standalone || seen > 2 || location.protocol === 'file:' || window.self !== window.top) return;
  setTimeout(() => { if (mode === 'menu' && !$('#home').classList.contains('hidden')) $('#ios').classList.remove('hidden'); }, 1200);
  $('#iosX').onclick = () => { $('#ios').classList.add('hidden'); try { localStorage.setItem('fw_ios_hint', seen + 1); } catch (e) {} };
})();
resize();
showScreen('home');
requestAnimationFrame(frame);
})();
