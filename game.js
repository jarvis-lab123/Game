'use strict';
(() => {
// ============================================================
//  LUMEN – Der letzte Funke
// ============================================================
const $ = s => document.querySelector(s);
const cv = $('#c'), ctx = cv.getContext('2d'), ui = $('#ui'), pauseBtn = $('#pauseBtn');
let W = 0, H = 0, DPR = 1;
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  cv.width = W * DPR; cv.height = H * DPR;
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
addEventListener('resize', resize); resize();

const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmtTime = s => { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
function hash(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function compact(arr, keep) { let j = 0; for (let i = 0; i < arr.length; i++) { const o = arr[i]; if (keep(o)) arr[j++] = o; } arr.length = j; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ============================================================
//  SAVE
// ============================================================
const SAVE_KEY = 'lumen_save_v1';
const defaultSave = () => ({ funken: 0, meta: {}, done: 0, best: {}, endlessBest: 0, lastDaily: '', streak: 0, totalKills: 0, runs: 0, muted: false, seenIntro: false, endingSeen: false });
let save = defaultSave();
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s) save = Object.assign(defaultSave(), s); } catch (e) { }
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { } }
const metaLvl = id => save.meta[id] || 0;

// ============================================================
//  AUDIO (pure synth, no assets)
// ============================================================
const Snd = {
  ac: null, master: null, last: {}, nextNote: 0, step: 0,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    try {
      this.ac = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ac.createGain(); this.master.gain.value = save.muted ? 0 : 0.45;
      this.master.connect(this.ac.destination);
      const len = this.ac.sampleRate * 0.5; this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ac = null; }
  },
  setMuted(m) { save.muted = m; persist(); if (this.master) this.master.gain.value = m ? 0 : 0.45; },
  tone(f, dur, type = 'sine', vol = 0.15, slide = 0, at = 0) {
    if (!this.ac || save.muted) return;
    const t = at || this.ac.currentTime;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.03);
  },
  noise(dur, vol = 0.15, freq = 1200, at = 0) {
    if (!this.ac || save.muted) return;
    const t = at || this.ac.currentTime;
    const s = this.ac.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur);
  },
  play(n, p = 0) {
    if (!this.ac || save.muted) return;
    const now = this.ac.currentTime, gap = { shoot: 0.07, hit: 0.03, kill: 0.035, gem: 0.025, zap: 0.08, coin: 0.05 }[n] || 0;
    if (gap && now - (this.last[n] || 0) < gap) return;
    this.last[n] = now;
    switch (n) {
      case 'shoot': this.tone(900, 0.06, 'triangle', 0.03, -400); break;
      case 'hit': this.noise(0.05, 0.05, 2500); break;
      case 'kill': this.tone(rand(260, 340), 0.09, 'triangle', 0.06, -160); break;
      case 'gem': this.tone(520 * Math.pow(2, Math.min(p, 30) / 12), 0.09, 'sine', 0.07); break;
      case 'coin': this.tone(1320, 0.05, 'square', 0.03); this.tone(1760, 0.08, 'square', 0.03, 0, now + 0.05); break;
      case 'hurt': this.tone(160, 0.25, 'sawtooth', 0.12, -90); this.noise(0.15, 0.1, 600); break;
      case 'nova': this.tone(220, 0.45, 'sine', 0.12, -150); this.noise(0.25, 0.05, 900); break;
      case 'zap': this.tone(1400, 0.12, 'square', 0.035, -1000); break;
      case 'boom': this.noise(0.35, 0.14, 500); this.tone(90, 0.3, 'sine', 0.14, -40); break;
      case 'level': [0, 4, 7, 12, 16].forEach((s, i) => this.tone(523 * Math.pow(2, s / 12), 0.22, 'triangle', 0.1, 0, now + i * 0.06)); break;
      case 'pick': this.tone(660, 0.08, 'triangle', 0.1); this.tone(990, 0.14, 'triangle', 0.1, 0, now + 0.07); break;
      case 'evo': [0, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(392 * Math.pow(2, s / 12), 0.35, 'sawtooth', 0.06, 0, now + i * 0.08)); break;
      case 'chest': [0, 4, 7, 11, 14].forEach((s, i) => this.tone(660 * Math.pow(2, s / 12), 0.18, 'square', 0.04, 0, now + i * 0.05)); break;
      case 'boss': this.tone(55, 1.6, 'sawtooth', 0.18, 20); this.noise(1.2, 0.12, 300); break;
      case 'warn': this.tone(440, 0.2, 'square', 0.06); this.tone(440, 0.2, 'square', 0.06, 0, now + 0.3); break;
      case 'die': this.tone(300, 1.2, 'sawtooth', 0.12, -250); break;
      case 'win': [0, 4, 7, 12, 7, 12, 16, 19, 24].forEach((s, i) => this.tone(392 * Math.pow(2, s / 12), 0.3, 'triangle', 0.1, 0, now + i * 0.09)); break;
      case 'click': this.tone(700, 0.04, 'triangle', 0.05); break;
      case 'combo': this.tone(880 * Math.pow(2, p / 12), 0.15, 'square', 0.04); break;
    }
  },
  music(th, intense) {
    if (!this.ac || save.muted) return;
    const now = this.ac.currentTime, beat = intense ? 0.16 : 0.2;
    if (this.nextNote < now) this.nextNote = now + 0.05;
    while (this.nextNote < now + 0.2) {
      const s = this.step++, sc = th.scale, root = th.root;
      const arp = [0, 2, 4, 2, 1, 3, 4, 3];
      const deg = arp[s % 8] + (Math.floor(s / 32) % 2 ? 1 : 0);
      const f = root * 2 * Math.pow(2, (sc[deg % sc.length] + 12 * Math.floor(deg / sc.length)) / 12);
      this.tone(f, beat * 1.6, 'triangle', intense ? 0.028 : 0.02, 0, this.nextNote);
      if (s % 8 === 0) this.tone(root / 2 * Math.pow(2, sc[Math.floor(s / 8) % 3 * 2 % sc.length] / 12), beat * 7, 'sine', 0.07, 0, this.nextNote);
      if (intense && s % 2 === 0) this.noise(0.04, 0.03, 4000, this.nextNote);
      this.nextNote += beat;
    }
  }
};

// ============================================================
//  DATA
// ============================================================
const CAST = {
  'Lumen': { c: '#ffd36b', i: 'L' },
  'Flimmer': { c: '#c9a7ff', i: 'F' },
  'Die Alte Eiche': { c: '#7dd87a', i: 'E' },
  'Der Moosgolem': { c: '#4f9a4a', i: 'M' },
  'Die Tiefenkönigin': { c: '#5ab8ff', i: 'T' },
  'Der Glutwurm': { c: '#ff8a3d', i: 'G' },
  'Der Spiegelritter': { c: '#d8e6ff', i: 'S' },
  'Umbra': { c: '#8a4dff', i: 'U' },
};
const INTRO = [
  ['', 'Einst leuchtete die Sonne über Aurelia. Dann kam die Nacht – und sie ging nie wieder.'],
  ['', 'Umbra, der Schattenkönig, verschlang das Licht und zerbrach es in fünf Scherben.'],
  ['', 'Nur ein einziger Funke blieb übrig. Klein. Zitternd. Stur.'],
  ['Flimmer', 'Hey! HEY, du! Du leuchtest ja! Weißt du, wie lange ich schon im Dunkeln gegen Wände fliege?'],
  ['Lumen', '…Wer bist du?'],
  ['Flimmer', 'Flimmer. Motte. Professionelle Lichtsucherin. Und du bist ab heute meine Lieblingslampe.'],
  ['Flimmer', 'Die Schatten riechen dich schon. Sammle ihre Scherben, werde heller – und hör NIE auf, dich zu bewegen!'],
];

const CHAPTERS = [
  {
    name: 'Der Flüsterwald', dur: 150, bg: '#0b1710', g1: '#10241a', accent: '#7dff9a', enemy: ['#2e6b39', '#3f8a45', '#1d4a28', '#5a9a3a'], eye: '#e4ffb8', bullet: '#b6ff7a', deco: 'forest', mote: '#d4ff8a', light: 'rgba(255,230,150,', scale: [0, 3, 5, 7, 10], root: 196,
    spawns: [['wisp', 10, 0], ['bat', 6, 25], ['brute', 3, 55], ['runner', 3, 95]],
    boss: { name: 'Der Moosgolem', hp: 3800, r: 46, color: '#3f7d3a', pats: ['chase', 'burst', 'chase', 'summon', 'burst'], minion: 'wisp', shape: 'square' },
    pre: [
      ['Flimmer', 'Der Flüsterwald. Früher sangen hier die Bäume. Jetzt flüstern sie nur noch … über dich.'],
      ['Die Alte Eiche', 'Kleiner Funke … der Moosgolem hält mein Herz gefangen. Befreie es, und ich zeige dir den Weg.'],
      ['Lumen', 'Ich bin nicht stark genug.'],
      ['Die Alte Eiche', 'Noch nicht. Überlebe, bis der Golem erwacht. Jede Scherbe macht dich heller.'],
    ],
    post: [
      ['Der Moosgolem', 'Grrrr … das Licht … es ist … warm …'],
      ['Die Alte Eiche', 'Mein Herz schlägt wieder. Nimm diese Wurzelscherbe – das erste Stück der Sonne.'],
      ['Flimmer', 'Das ERSTE? Ich dachte, das hier war das Finale!'],
      ['Die Alte Eiche', 'Folge dem Fluss hinab in die Versunkene Stadt. Und Funke … Umbra war nicht immer ein Schatten.'],
    ],
  },
  {
    name: 'Die Versunkene Stadt', dur: 170, bg: '#07121f', g1: '#0b1c30', accent: '#5ad0ff', enemy: ['#1f4f7a', '#2a6a9a', '#163a5c', '#3a8ab0'], eye: '#bff0ff', bullet: '#7fe0ff', deco: 'city', mote: '#9fe8ff', light: 'rgba(170,230,255,', scale: [0, 2, 3, 7, 8], root: 174.6,
    spawns: [['wisp', 9, 0], ['bat', 7, 10], ['spitter', 3, 35], ['brute', 3, 65], ['runner', 3, 100]],
    boss: { name: 'Die Tiefenkönigin', hp: 6000, r: 44, color: '#2a7ab8', pats: ['spiral', 'chase', 'summon', 'burst', 'chase'], minion: 'bat', shape: 'hex' },
    pre: [
      ['Flimmer', 'Wasser. Ich HASSE Wasser. Meine Flügel werden ganz schrumpelig.'],
      ['Lumen', 'Hier haben einmal Menschen gelebt.'],
      ['Die Tiefenkönigin', 'Und hier sind sie ertrunken, als das Licht erlosch. Ich habe sie alle … behalten.'],
      ['Die Tiefenkönigin', 'Bleib auch du, kleiner Funke. Für immer.'],
    ],
    post: [
      ['Die Tiefenkönigin', 'Sag … ist es oben noch dunkel?'],
      ['Lumen', 'Noch. Aber nicht mehr lange.'],
      ['Die Tiefenkönigin', 'Dann … bring ihnen den Morgen.'],
      ['Flimmer', 'Zwei Scherben! Wir sind quasi Helden. … Warte. Hast du auch das Gefühl, dass uns etwas folgt?'],
    ],
  },
  {
    name: 'Die Aschenwüste', dur: 190, bg: '#1a0c06', g1: '#2a140a', accent: '#ffa04d', enemy: ['#8a3a14', '#b04a1a', '#6a2a10', '#c8661e'], eye: '#ffe0a0', bullet: '#ffb060', deco: 'desert', mote: '#ffb060', light: 'rgba(255,200,140,', scale: [0, 1, 4, 5, 7, 8, 10], root: 164.8,
    spawns: [['runner', 6, 0], ['wisp', 8, 0], ['spitter', 4, 25], ['bat', 5, 40], ['brute', 4, 60]],
    boss: { name: 'Der Glutwurm', hp: 8500, r: 42, color: '#d0561a', pats: ['charge', 'burst', 'charge', 'spiral', 'summon'], minion: 'runner', shape: 'circle' },
    pre: [
      ['Flimmer', 'Heiß. Heiß. HEISS. Warum ist es hier so heiß, wenn die Sonne weg ist?!'],
      ['Lumen', 'Weil hier ein Stück von ihr brennt. Allein. Seit Jahren.'],
      ['Der Glutwurm', 'MEINS! Die Glut gehört MIR! Wer sie will, wird zu Asche!'],
    ],
    post: [
      ['Der Glutwurm', 'Ich … wollte doch nur … nicht mehr frieren …'],
      ['Lumen', 'Niemand muss mehr frieren.'],
      ['Flimmer', 'Drei Scherben. Du leuchtest anders jetzt. Heller. Fast wie …'],
      ['Flimmer', '… wie jemand, den ich früher mal kannte.'],
    ],
  },
  {
    name: 'Der Gläserne Himmel', dur: 210, bg: '#0c1020', g1: '#141a33', accent: '#cfe0ff', enemy: ['#5a6a9a', '#7a8ac0', '#3a4a7a', '#9ab0e0'], eye: '#ffffff', bullet: '#e0ecff', deco: 'sky', mote: '#ffffff', light: 'rgba(220,235,255,', scale: [0, 2, 4, 7, 9, 11], root: 220,
    spawns: [['bat', 8, 0], ['wisp', 6, 0], ['spitter', 4, 15], ['runner', 4, 30], ['brute', 4, 50]],
    boss: { name: 'Der Spiegelritter', hp: 11500, r: 40, color: '#b8c8f0', pats: ['charge', 'spiral', 'burst', 'charge', 'summon'], minion: 'spitter', shape: 'diamond' },
    pre: [
      ['Flimmer', 'Wir sind über den Wolken. Das ist entweder sehr gut oder sehr, sehr schlecht.'],
      ['Der Spiegelritter', 'Halt. Kein Licht passiert das Glastor.'],
      ['Lumen', 'Deine Rüstung … sie flackert wie meine Flamme.'],
      ['Der Spiegelritter', 'Weil ich DU bin. Der Teil von dir, der längst aufgegeben hat.'],
    ],
    post: [
      ['Der Spiegelritter', 'Du hast … nicht aufgegeben. Warum?'],
      ['Lumen', 'Weil jemand an mich geglaubt hat. Eine ziemlich nervige Motte.'],
      ['Flimmer', 'HEY! … aww.'],
      ['Flimmer', 'Lumen. Ich muss dir was sagen. Umbra … ich kenne ihn. Vor der Nacht war er —'],
      ['', 'Der Himmel zerbrach wie Glas. Der Weg ins Herz der Nacht lag offen.'],
    ],
  },
  {
    name: 'Das Herz der Nacht', dur: 230, bg: '#0c0616', g1: '#170a26', accent: '#b07aff', enemy: ['#4a2a7a', '#6a3aa0', '#2e1850', '#8a4dc8'], eye: '#ff7ad8', bullet: '#d08aff', deco: 'void', mote: '#c89aff', light: 'rgba(230,200,255,', scale: [0, 1, 3, 6, 7, 10], root: 146.8,
    spawns: [['wisp', 6, 0], ['bat', 6, 0], ['runner', 4, 10], ['spitter', 4, 20], ['brute', 5, 35]],
    boss: { name: 'Umbra', hp: 16000, r: 52, color: '#6a2ac8', pats: ['spiral', 'charge', 'burst', 'summon', 'chase', 'charge'], minion: 'bat', shape: 'star', final: true },
    pre: [
      ['Umbra', 'Da bist du ja, kleiner Funke. Mein letzter Rest.'],
      ['Lumen', 'Dein … Rest?'],
      ['Umbra', 'Ich WAR die Sonne. Ich brannte, bis ich leer war. Alle nahmen mein Licht – niemand gab je etwas zurück.'],
      ['Umbra', 'Also nahm ich es mir wieder. Alles. Nur du bist mir entwischt.'],
      ['Flimmer', 'Er war mal der Hellste von allen. Und der Einsamste.'],
      ['Lumen', 'Dann bin ich nicht hier, um dich zu besiegen. Ich bin hier, um dich nach Hause zu bringen.'],
      ['Umbra', 'DANN KOMM UND VERSUCH ES!'],
    ],
    post: [
      ['Umbra', 'Warum … ist es … so warm?'],
      ['Lumen', 'Weil du nicht mehr allein brennen musst.'],
      ['', 'Fünf Scherben. Ein Funke. Ein Schatten, der sich erinnerte, wie Licht sich anfühlt.'],
      ['', 'Und über Aurelia ging – zum ersten Mal seit tausend Nächten – die Sonne auf.'],
      ['Flimmer', '… Also. Gibt’s jetzt Frühstück?'],
      ['', 'ENDE. Doch die Ewige Nacht wartet noch auf die Mutigsten …'],
    ],
  },
];

const ETYPES = {
  wisp: { r: 9, hp: 10, spd: 68, dmg: 7, xp: 1, shape: 'circle' },
  bat: { r: 8, hp: 6, spd: 102, dmg: 5, xp: 1, shape: 'tri' },
  brute: { r: 17, hp: 50, spd: 42, dmg: 13, xp: 5, shape: 'square' },
  runner: { r: 10, hp: 16, spd: 62, dmg: 10, xp: 2, shape: 'diamond' },
  spitter: { r: 11, hp: 20, spd: 55, dmg: 7, xp: 3, shape: 'hex' },
};

const WEAPONS = {
  bolt: { name: 'Lichtpfeil', evoName: 'Sonnenspeer', icon: '➶', color: '#ffe9a8', evo: 'haste',
    d: ['Schießt Lichtpfeile auf den nächsten Feind.', '+1 Pfeil, mehr Schaden', 'Schneller, mehr Schaden', '+1 Pfeil, durchbohrt 1 Feind', '+1 Pfeil, schneller', 'ERWACHT: +2 Pfeile, durchbohrt 3, ×1,5 Schaden'] },
  orbit: { name: 'Funkenkreis', evoName: 'Sternenkrone', icon: '✺', color: '#ffb35a', evo: 'area',
    d: ['Funken kreisen schützend um dich.', '+1 Funke', 'Mehr Schaden, schneller', '+1 Funke', '+1 Funke, mehr Schaden', 'ERWACHT: 8 Funken, weiter Kreis, ×1,6 Schaden'] },
  nova: { name: 'Sonnenpuls', evoName: 'Sonnenherz', icon: '☀', color: '#fff0a0', evo: 'vital',
    d: ['Eine Lichtwelle stößt Feinde zurück.', 'Größerer Radius', 'Mehr Schaden', 'Häufiger', 'Größer, mehr Schaden', 'ERWACHT: riesiger Puls, jeder Treffer heilt dich'] },
  chain: { name: 'Kettenblitz', evoName: 'Donnerzorn', icon: 'ϟ', color: '#9fe8ff', evo: 'crit',
    d: ['Ein Blitz springt von Feind zu Feind.', '+1 Sprung', 'Mehr Schaden', '+2 Sprünge, häufiger', '+1 Sprung, mehr Schaden', 'ERWACHT: 2 Blitze gleichzeitig, +3 Sprünge'] },
  blade: { name: 'Mondsichel', evoName: 'Vollmond', icon: '☾', color: '#d8d0ff', evo: 'swift',
    d: ['Eine Sichel fliegt in Laufrichtung und kehrt zurück.', 'Mehr Schaden', '+1 Sichel', 'Mehr Schaden, häufiger', '+1 Sichel', 'ERWACHT: 6 Sicheln in alle Richtungen'] },
  meteor: { name: 'Sternenregen', evoName: 'Kometensturm', icon: '✧', color: '#ff9ad0', evo: 'might',
    d: ['Sterne stürzen auf deine Feinde.', '+1 Stern', 'Mehr Schaden, größer', '+1 Stern, häufiger', '+2 Sterne', 'ERWACHT: +4 Sterne, gewaltige Einschläge'] },
};
const PASSIVES = {
  might: { name: 'Glut', icon: '✦', color: '#ff8a5a', d: '+12 % Schaden' },
  haste: { name: 'Eile', icon: '⧗', color: '#8affc8', d: '−8 % Abklingzeit' },
  swift: { name: 'Federschritt', icon: '➹', color: '#aee0ff', d: '+10 % Lauftempo' },
  vital: { name: 'Herzlicht', icon: '♥', color: '#ff6b8a', d: '+20 max. Leben, heilt voll' },
  magnet: { name: 'Anziehung', icon: '◎', color: '#7ad0ff', d: '+35 % Sammelradius' },
  crit: { name: 'Scharfblick', icon: '◈', color: '#ffe066', d: '+7 % kritische Treffer' },
  regen: { name: 'Morgentau', icon: '❀', color: '#9aff9a', d: '+0,6 Leben pro Sekunde' },
  area: { name: 'Weite', icon: '◯', color: '#d0a0ff', d: '+12 % Flächengröße' },
};
const META = [
  { id: 'hp', name: 'Glühende Seele', d: '+10 max. Leben', max: 8, base: 25 },
  { id: 'dmg', name: 'Sonnenzorn', d: '+6 % Schaden', max: 8, base: 35 },
  { id: 'spd', name: 'Leichtfuß', d: '+4 % Tempo', max: 5, base: 30 },
  { id: 'mag', name: 'Sog', d: '+12 % Sammelradius', max: 5, base: 20 },
  { id: 'xp', name: 'Weisheit', d: '+8 % Erfahrung', max: 6, base: 40 },
  { id: 'greed', name: 'Gier', d: '+15 % Funken', max: 6, base: 45 },
  { id: 'armor', name: 'Rinde', d: '−1 erlittener Schaden', max: 4, base: 60 },
  { id: 'reroll', name: 'Schicksal', d: '+1 Neuwurf pro Lauf', max: 3, base: 70 },
  { id: 'card', name: 'Weitblick', d: '4 statt 3 Karten beim Aufstieg', max: 1, base: 450 },
  { id: 'revive', name: 'Phönixfeder', d: 'Einmal pro Lauf wiederbeleben', max: 1, base: 650 },
];
const metaCost = (m, l) => Math.round(m.base * Math.pow(1.55, l));
const affordable = () => META.some(m => metaLvl(m.id) < m.max && save.funken >= metaCost(m, metaLvl(m.id)));

// ============================================================
//  INPUT
// ============================================================
const keys = {};
const joy = { on: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 };
addEventListener('keydown', e => {
  keys[e.code] = true; Snd.init();
  onKey(e);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; joy.on = false; if (state === 'play') pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state === 'play') pauseGame(); });
cv.addEventListener('pointerdown', e => {
  Snd.init();
  if (state !== 'play' || joy.on) return;
  joy.on = true; joy.id = e.pointerId; joy.ox = joy.x = e.clientX; joy.oy = joy.y = e.clientY;
  try { cv.setPointerCapture(e.pointerId); } catch (_) { }
});
cv.addEventListener('pointermove', e => { if (joy.on && e.pointerId === joy.id) { joy.x = e.clientX; joy.y = e.clientY; } });
const joyEnd = e => { if (e.pointerId === joy.id) joy.on = false; };
cv.addEventListener('pointerup', joyEnd); cv.addEventListener('pointercancel', joyEnd);
pauseBtn.addEventListener('click', () => { Snd.play('click'); pauseGame(); });

function moveInput() {
  let x = 0, y = 0;
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  if (keys.KeyW || keys.ArrowUp) y -= 1;
  if (keys.KeyS || keys.ArrowDown) y += 1;
  if (joy.on) {
    let dx = joy.x - joy.ox, dy = joy.y - joy.oy; const d = Math.hypot(dx, dy), max = 55;
    if (d > max) { joy.ox = joy.x - dx / d * max; joy.oy = joy.y - dy / d * max; dx = joy.x - joy.ox; dy = joy.y - joy.oy; }
    if (d > 6) { x += dx / max; y += dy / max; }
  }
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  return [x, y];
}

// ============================================================
//  GAME STATE
// ============================================================
let state = 'menu';   // menu | dialog | play | levelup | pause | over
let G = null;
const CELL = 64;
const grid = new Map();
let qStamp = 0, uid = 0;
const gkey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);

function theme() {
  if (!G) return CHAPTERS[Math.min(save.done, 4)];
  if (G.mode === 'endless') return CHAPTERS[Math.floor(G.t / 150) % 5];
  return CHAPTERS[G.ch];
}
const xpNeed = l => Math.floor(5 + l * 2.4 + Math.pow(l, 1.5) * 0.65);

function newRun(mode, ch) {
  const p = { x: 0, y: 0, r: 13, hp: 100, maxHp: 100, inv: 0, dx: 1, dy: 0, level: 1, xp: 0, need: xpNeed(1), revives: metaLvl('revive'), moving: false, anim: 0 };
  G = {
    mode, ch, t: 0, p, weapons: [], passives: {}, st: {},
    enemies: [], shots: [], ebul: [], gems: [], pickups: [], parts: [], texts: [], rings: [], zaps: [], meteors: [], banners: [], motes: [],
    kills: 0, coins: 0, combo: 0, comboT: 0, bestCombo: 0, comboMs: 25, spawnAcc: 0, nextElite: 45, nextWave: 40,
    boss: null, bossDown: 0, bossWarned: false, nextBoss: mode === 'endless' ? 140 : CHAPTERS[ch].dur,
    shake: 0, slow: 1, hitstop: 0, flash: 0, hurtFlash: 0, rerolls: metaLvl('reroll'), pending: 0, gemChain: 0, gemChainT: 0,
    over: false, won: false, winT: 0, camx: 0, camy: 0, dmgDealt: 0,
  };
  recalc();
  p.hp = p.maxHp = G.st.maxHp;
  addWeapon('bolt');
  for (let i = 0; i < 40; i++) G.motes.push({ x: rand(-W, W), y: rand(-H, H), z: rand(0.3, 1), s: rand(0, TAU) });
}

function recalc() {
  const P = id => G.passives[id] || 0;
  const st = G.st;
  st.dmg = (1 + 0.12 * P('might')) * (1 + 0.06 * metaLvl('dmg'));
  st.cd = Math.max(0.4, 1 - 0.08 * P('haste'));
  st.spd = 175 * (1 + 0.1 * P('swift')) * (1 + 0.04 * metaLvl('spd'));
  st.mag = 90 * (1 + 0.35 * P('magnet')) * (1 + 0.12 * metaLvl('mag'));
  st.crit = 0.05 + 0.07 * P('crit');
  st.regen = 0.6 * P('regen');
  st.area = 1 + 0.12 * P('area');
  st.maxHp = 100 + 10 * metaLvl('hp') + 20 * P('vital');
  st.xp = 1 + 0.08 * metaLvl('xp');
  st.greed = 1 + 0.15 * metaLvl('greed');
  st.armor = metaLvl('armor');
  if (G.p.maxHp !== st.maxHp) { G.p.hp += st.maxHp - G.p.maxHp; G.p.maxHp = st.maxHp; }
}

function addWeapon(id) { G.weapons.push({ id, lvl: 1, cd: 0.3, a: 0 }); }

// ------------------------------------------------------------
//  Grid
// ------------------------------------------------------------
function buildGrid() {
  grid.clear();
  for (const e of G.enemies) {
    if (e.dead) continue;
    const x0 = Math.floor((e.x - e.r) / CELL), x1 = Math.floor((e.x + e.r) / CELL);
    const y0 = Math.floor((e.y - e.r) / CELL), y1 = Math.floor((e.y + e.r) / CELL);
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const k = gkey(cx, cy); let a = grid.get(k);
      if (!a) { a = []; grid.set(k, a); }
      a.push(e);
    }
  }
}
function query(x, y, r, fn) {
  const s = ++qStamp;
  const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
  const y0 = Math.floor((y - r) / CELL), y1 = Math.floor((y + r) / CELL);
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const a = grid.get(gkey(cx, cy)); if (!a) continue;
    for (let i = 0; i < a.length; i++) {
      const e = a[i]; if (e.qs === s || e.dead) continue; e.qs = s;
      if (fn(e) === true) return;
    }
  }
}
function nearestEnemy(x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const e of G.enemies) { if (e.dead) continue; const d = (e.x - x) ** 2 + (e.y - y) ** 2; if (d < bd) { bd = d; best = e; } }
  return best;
}

// ------------------------------------------------------------
//  Effects
// ------------------------------------------------------------
function burst(x, y, color, n, spd = 120, size = 3, life = 0.6) {
  for (let i = 0; i < n; i++) {
    if (G.parts.length > 650) return;
    const a = Math.random() * TAU, s = spd * (0.25 + Math.random());
    const l = life * (0.5 + Math.random() * 0.6);
    G.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: l, m: l, size: size * (0.6 + Math.random() * 0.8), color });
  }
}
function floatText(x, y, txt, color = '#fff', size = 14) {
  if (G.texts.length > 70) G.texts.shift();
  G.texts.push({ x: x + rand(-6, 6), y, txt, color, size, t: 0.75 });
}
function banner(text, sub = '', color = '#ffd36b', dur = 2.4) { G.banners.push({ text, sub, color, t: dur, m: dur }); }
function shake(v) { G.shake = Math.max(G.shake, v); }

// ------------------------------------------------------------
//  Enemies
// ------------------------------------------------------------
function enemyScale() {
  if (G.mode === 'endless') { const c = Math.floor(G.t / 150); return { hp: (1 + G.t / 55) * (1 + c * 0.4) * Math.pow(1.002, Math.max(0, G.t - 450)), dmg: (1 + G.t / 160) * Math.pow(1.0015, Math.max(0, G.t - 450)) }; }
  return { hp: (1 + G.t / 90) * (1 + G.ch * 0.3), dmg: (1 + G.ch * 0.18) * (1 + G.t / 400) };
}
function spawnPos(dist) {
  const a = Math.random() * TAU, d = dist || Math.max(W, H) * 0.62 + rand(20, 80);
  return [G.p.x + Math.cos(a) * d, G.p.y + Math.sin(a) * d];
}
function spawnEnemy(type, x, y, opts = {}) {
  const T = ETYPES[type], sc = enemyScale(), th = theme();
  if (x === undefined) [x, y] = spawnPos();
  const elite = !!opts.elite;
  const e = {
    id: ++uid, type, x, y, r: T.r * (elite ? 2.1 : 1), hp: T.hp * sc.hp * (elite ? 14 : 1), spd: T.spd * rand(0.9, 1.1) * (elite ? 0.85 : 1),
    dmg: T.dmg * sc.dmg * (elite ? 1.5 : 1), xp: T.xp * (elite ? 20 : 1) * (1 + Math.min(G.t, 1200) / 220), shape: T.shape, color: pick(th.enemy), eye: th.eye,
    kx: 0, ky: 0, flash: 0, t: rand(0, 5), st: 0, stT: rand(1, 2.5), elite, boss: false, dead: false, ho: -9, hb: -9, qs: 0, vx: 0, vy: 0,
  };
  e.maxHp = e.hp;
  G.enemies.push(e);
  return e;
}
function spawnTick(dt) {
  const th = theme();
  const cap = 260 + (G.mode === 'endless' ? 120 : G.ch * 25);
  let rate = (1.3 + G.t * 0.032) * (G.mode === 'endless' ? 1.1 : 1 + G.ch * 0.12);
  if (G.boss) rate *= 0.35;
  G.spawnAcc += rate * dt;
  const tl = G.mode === 'endless' ? (G.t % 150) + 60 : G.t;
  const table = th.spawns.filter(s => tl >= s[2]);
  const tw = table.reduce((a, s) => a + s[1], 0);
  while (G.spawnAcc >= 1) {
    G.spawnAcc -= 1;
    if (G.enemies.length >= cap) continue;
    let r = Math.random() * tw, ty = table[0][0];
    for (const s of table) { r -= s[1]; if (r <= 0) { ty = s[0]; break; } }
    spawnEnemy(ty);
  }
  if (G.t >= G.nextWave) {
    G.nextWave += 38;
    const n = 18 + Math.floor(G.t / 8), ty = pick(['wisp', 'bat']);
    const d = Math.max(W, H) * 0.55 + 40;
    for (let i = 0; i < n; i++) { const a = i / n * TAU; spawnEnemy(ty, G.p.x + Math.cos(a) * d, G.p.y + Math.sin(a) * d); }
    banner('SCHWARM!', 'Sie kreisen dich ein …', '#ff9a9a', 1.8);
    Snd.play('warn');
  }
  if (G.t >= G.nextElite && !G.boss) {
    G.nextElite += 50;
    spawnEnemy(pick(['brute', 'runner', 'spitter', 'wisp']), undefined, undefined, { elite: true });
    banner('ELITE', 'Besiege sie für eine Truhe!', '#ffd36b', 1.8);
  }
  // Boss timeline
  if (!G.boss && !G.won) {
    if (!G.bossWarned && G.t >= G.nextBoss - 5) { G.bossWarned = true; banner('Etwas Großes nähert sich …', '', '#ff7b8a', 3); Snd.play('warn'); }
    if (G.t >= G.nextBoss) spawnBoss();
  }
}
function spawnBoss() {
  const th = theme(), B = th.boss;
  const cycle = G.mode === 'endless' ? Math.floor(G.t / 150) : 0;
  const [x, y] = spawnPos(Math.min(W, H) * 0.45 + 60);
  const hp = B.hp * (G.mode === 'endless' ? (1 + cycle * 0.9) * 1.2 : 1);
  const b = {
    id: ++uid, type: 'boss', x, y, r: B.r, hp, maxHp: hp, spd: 58, dmg: 24 * (1 + G.ch * 0.15 + cycle * 0.3), xp: 150, shape: B.shape, color: B.color, eye: '#fff',
    kx: 0, ky: 0, flash: 0, t: 0, elite: false, boss: true, dead: false, ho: -9, hb: -9, qs: 0, def: B, pi: -1, pat: 'chase', pt: 2.5, ps: 0, pa: 0, cnt: 0, phase2: false, cdx: 0, cdy: 0,
  };
  G.enemies.push(b); G.boss = b;
  banner(B.name.toUpperCase(), 'erwacht!', '#ff5a6e', 3);
  shake(18); Snd.play('boss');
}
function enemyBullet(x, y, a, spd, dmg) {
  if (G.ebul.length > 400) return;
  G.ebul.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, r: 6, dmg, life: 7 });
}
function updateBoss(b, dt) {
  const p = G.p, th = theme(), B = b.def;
  const ang = Math.atan2(p.y - b.y, p.x - b.x);
  const rage = b.phase2 ? 1.35 : 1;
  if (B.final && !b.phase2 && b.hp < b.maxHp * 0.5) {
    b.phase2 = true; banner('UMBRA ENTFESSELT SEINE WUT', '', '#d08aff', 3); shake(20); Snd.play('boss');
    for (let i = 0; i < 24; i++) enemyBullet(b.x, b.y, i / 24 * TAU, 150, b.dmg * 0.6);
  }
  b.pt -= dt * rage;
  if (b.pt <= 0) {
    b.pi = (b.pi + 1) % B.pats.length; b.pat = B.pats[b.pi]; b.ps = 0; b.cnt = 0;
    b.pt = { chase: 2.6, burst: 2.4, spiral: 3.2, charge: 3.4, summon: 1.6 }[b.pat];
    if (b.pat === 'summon') {
      const n = 6 + G.ch * 2;
      for (let i = 0; i < n; i++) { const a = i / n * TAU; spawnEnemy(B.minion, b.x + Math.cos(a) * (b.r + 30), b.y + Math.sin(a) * (b.r + 30)); }
      burst(b.x, b.y, th.accent, 30, 200, 4);
    }
  }
  b.ps -= dt * rage;
  let vx = 0, vy = 0;
  switch (b.pat) {
    case 'chase': case 'summon': vx = Math.cos(ang) * b.spd * rage; vy = Math.sin(ang) * b.spd * rage; break;
    case 'burst':
      vx = Math.cos(ang) * b.spd * 0.3; vy = Math.sin(ang) * b.spd * 0.3;
      if (b.ps <= 0) {
        b.ps = 0.75; const n = 12 + G.ch * 2 + (b.phase2 ? 6 : 0), off = Math.random() * TAU;
        for (let i = 0; i < n; i++) enemyBullet(b.x, b.y, off + i / n * TAU, 125 + G.ch * 10, b.dmg * 0.5);
        Snd.play('zap'); b.flash = 0.1;
      }
      break;
    case 'spiral':
      b.pa += dt * 2.6 * rage;
      if (b.ps <= 0) {
        b.ps = 0.11; const arms = 3 + (G.ch >= 3 ? 1 : 0) + (b.phase2 ? 1 : 0);
        for (let i = 0; i < arms; i++) enemyBullet(b.x, b.y, b.pa + i / arms * TAU, 140, b.dmg * 0.45);
      }
      break;
    case 'charge':
      if (b.cnt === 0) { b.cnt = 1; b.ps = 0.8; b.cdx = Math.cos(ang); b.cdy = Math.sin(ang); b.tele = 0.8; }
      if (b.tele > 0) { b.tele -= dt * rage; if (b.tele <= 0) { b.dash = 0.55; Snd.play('boom'); shake(8); } }
      else if (b.dash > 0) { b.dash -= dt; vx = b.cdx * 560; vy = b.cdy * 560; if (Math.random() < 0.6) burst(b.x, b.y, B.color, 2, 60, 5); }
      else if (b.cnt < 3) { b.cnt++; const a2 = Math.atan2(p.y - b.y, p.x - b.x); b.cdx = Math.cos(a2); b.cdy = Math.sin(a2); b.tele = 0.55; }
      break;
  }
  b.x += (vx + b.kx) * dt; b.y += (vy + b.ky) * dt;
  b.kx *= 0.8; b.ky *= 0.8;
}
function updateEnemies(dt) {
  const p = G.p;
  for (const e of G.enemies) {
    if (e.dead) continue;
    e.t += dt; if (e.flash > 0) e.flash -= dt;
    if (e.boss) { updateBoss(e, dt); continue; }
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    let ux = dx / d, uy = dy / d, sp = e.spd;
    if (e.type === 'bat') { const w = Math.sin(e.t * 6) * 0.7; const px = -uy, py = ux; ux += px * w; uy += py * w; }
    else if (e.type === 'runner') {
      // 0 approach, 1 telegraph, 2 dash, 3 recover
      if (e.st === 0 && d < 230) { e.st = 1; e.stT = 0.55; e.cdx = ux; e.cdy = uy; }
      else if (e.st === 1) { sp = 0; e.stT -= dt; if (e.stT <= 0) { e.st = 2; e.stT = 0.45; } }
      else if (e.st === 2) { ux = e.cdx; uy = e.cdy; sp = e.spd * 5.5; e.stT -= dt; if (e.stT <= 0) { e.st = 3; e.stT = 1.3; } }
      else if (e.st === 3) { sp *= 0.5; e.stT -= dt; if (e.stT <= 0) e.st = 0; }
    } else if (e.type === 'spitter') {
      if (d < 180) { ux = -ux; uy = -uy; } else if (d < 250) sp = 0;
      e.stT -= dt;
      if (e.stT <= 0 && d < 420) { e.stT = rand(2, 2.8); enemyBullet(e.x, e.y, Math.atan2(dy, dx), 150, e.dmg); if (e.elite) { enemyBullet(e.x, e.y, Math.atan2(dy, dx) + 0.3, 150, e.dmg); enemyBullet(e.x, e.y, Math.atan2(dy, dx) - 0.3, 150, e.dmg); } }
    }
    e.vx = ux * sp; e.vy = uy * sp;
    e.x += (e.vx + e.kx) * dt; e.y += (e.vy + e.ky) * dt;
    const k = Math.pow(0.0015, dt); e.kx *= k; e.ky *= k;
    // cull far-away stragglers by relocating them ahead of the player
    if (d > Math.max(W, H) * 1.3 && !e.elite) {
      const mvx = G.p.dx, mvy = G.p.dy, a = Math.atan2(mvy, mvx) + rand(-0.8, 0.8), r = Math.max(W, H) * 0.62;
      e.x = p.x + Math.cos(a) * r; e.y = p.y + Math.sin(a) * r;
    }
  }
}
function separate() {
  for (const e of G.enemies) {
    if (e.dead || e.boss) continue;
    query(e.x, e.y, e.r, o => {
      if (o === e) return;
      const dx = e.x - o.x, dy = e.y - o.y, rr = e.r + o.r, d2 = dx * dx + dy * dy;
      if (d2 < rr * rr && d2 > 0.0001) {
        const d = Math.sqrt(d2), push = (rr - d) * (o.boss ? 1 : 0.5);
        e.x += dx / d * push; e.y += dy / d * push;
      }
    });
  }
}

function hurtEnemy(e, dmg, kx = 0, ky = 0, color) {
  if (e.dead) return;
  let d = dmg * G.st.dmg * rand(0.9, 1.1);
  const crit = Math.random() < G.st.crit;
  if (crit) d *= 2.2;
  d = Math.max(1, Math.round(d));
  e.hp -= d; e.flash = 0.08; G.dmgDealt += d;
  const kb = e.boss ? 0.05 : e.elite ? 0.3 : 1;
  e.kx += kx * kb; e.ky += ky * kb;
  if (crit) floatText(e.x, e.y - e.r, d + '!', '#ffe066', 19);
  else if (G.texts.length < 50 || e.boss) floatText(e.x, e.y - e.r, d, color || '#ffffff', 13);
  Snd.play('hit');
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  e.dead = true; G.kills++;
  const th = theme();
  burst(e.x, e.y, e.color, e.boss ? 80 : e.elite ? 30 : 8, e.boss ? 320 : 150, e.boss ? 6 : 3);
  burst(e.x, e.y, th.accent, e.boss ? 40 : 3, 100, 2);
  Snd.play('kill');
  G.combo++; G.comboT = 2.2; G.bestCombo = Math.max(G.bestCombo, G.combo);
  if (G.combo >= G.comboMs) {
    const cb = Math.min(8, Math.max(1, Math.round(G.comboMs / 25)));
    banner('COMBO ×' + G.comboMs, '+' + cb + ' Funken', '#ff9ad0', 1.4);
    G.coins += cb * G.st.greed;
    Snd.play('combo', Math.min(12, Math.log2(G.comboMs / 25) * 3));
    G.comboMs = G.comboMs < 100 ? G.comboMs + 25 : G.comboMs < 500 ? G.comboMs + 100 : G.comboMs + 250;
  }
  // drops
  if (e.boss) {
    for (let i = 0; i < 40; i++) dropGem(e.x + rand(-60, 60), e.y + rand(-60, 60), 8);
    for (let i = 0; i < 25; i++) G.pickups.push({ k: 'coin', x: e.x + rand(-70, 70), y: e.y + rand(-70, 70), v: 3 });
    G.pickups.push({ k: 'chest', x: e.x, y: e.y });
    bossDefeated(e);
    return;
  }
  dropGem(e.x, e.y, e.xp);
  if (e.elite) { G.pickups.push({ k: 'chest', x: e.x, y: e.y }); for (let i = 0; i < 6; i++) G.pickups.push({ k: 'coin', x: e.x + rand(-30, 30), y: e.y + rand(-30, 30), v: 1 }); return; }
  const r = Math.random();
  if (r < 0.045) G.pickups.push({ k: 'coin', x: e.x, y: e.y, v: 1 });
  else if (r < 0.057) G.pickups.push({ k: 'heart', x: e.x, y: e.y });
  else if (r < 0.0615) G.pickups.push({ k: 'magnet', x: e.x, y: e.y });
  else if (r < 0.0645) G.pickups.push({ k: 'bomb', x: e.x, y: e.y });
}
function dropGem(x, y, v) {
  if (G.gems.length > 420) { // merge into an existing gem to keep things fast
    const g = G.gems[Math.floor(Math.random() * G.gems.length)]; g.v += v; return;
  }
  G.gems.push({ x, y, v, mag: false, sp: 0, t: 0 });
}
function bossDefeated(b) {
  G.boss = null; G.bossDown++;
  shake(30); G.hitstop = 0.12; G.slow = 0.25; G.flash = 0.8;
  Snd.play('win');
  G.ebul.length = 0;
  if (G.mode === 'endless') {
    G.nextBoss = Math.floor(G.t / 150) * 150 + 140; if (G.nextBoss < G.t + 30) G.nextBoss += 150; G.bossWarned = false;
    banner('BOSS BESIEGT!', '+50 Funken', '#ffd36b', 3); G.coins += Math.round(50 * G.st.greed);
    return;
  }
  G.won = true; G.winT = 3.2;
  banner('SCHERBE GEBORGEN!', CHAPTERS[G.ch].name + ' ist befreit', '#ffd36b', 3.2);
  for (const e of G.enemies) if (!e.dead) { e.dead = true; burst(e.x, e.y, e.color, 6, 120, 3); }
  for (const g of G.gems) g.mag = true;
}

// ------------------------------------------------------------
//  Weapons
// ------------------------------------------------------------
function updateWeapons(dt) {
  const p = G.p, st = G.st;
  for (const w of G.weapons) {
    const l = w.lvl;
    w.cd -= dt;
    switch (w.id) {
      case 'bolt': {
        if (w.cd > 0) break;
        const tgt = G.boss && Math.hypot(G.boss.x - p.x, G.boss.y - p.y) < 480 ? G.boss : nearestEnemy(p.x, p.y, 520);
        if (!tgt) { w.cd = 0.1; break; }
        const n = 1 + (l >= 2) + (l >= 4) + (l >= 5) + (l >= 6 ? 2 : 0);
        const dmg = (12 + 5 * l) * (l >= 6 ? 1.5 : 1), pierce = l >= 6 ? 3 : l >= 4 ? 1 : 0;
        const base = Math.atan2(tgt.y - p.y, tgt.x - p.x);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * 0.14;
          G.shots.push({ k: 'bolt', x: p.x, y: p.y, vx: Math.cos(a) * 540, vy: Math.sin(a) * 540, r: 5 * (l >= 6 ? 1.5 : 1), dmg, pierce, life: 1.1, hit: new Set(), evo: l >= 6 });
        }
        Snd.play('shoot');
        w.cd = [0, 0.62, 0.58, 0.5, 0.46, 0.4, 0.34][l] * st.cd;
        break;
      }
      case 'orbit': {
        const n = [0, 2, 3, 3, 4, 5, 8][l], R = (62 + (l >= 6 ? 32 : 0)) * st.area, dmg = (7 + 3 * l) * (l >= 6 ? 1.6 : 1);
        w.a += dt * (2.6 + 0.25 * l);
        w.pos = [];
        for (let i = 0; i < n; i++) {
          const a = w.a + i / n * TAU, ox = p.x + Math.cos(a) * R, oy = p.y + Math.sin(a) * R, orr = 9 * st.area * (l >= 6 ? 1.3 : 1);
          w.pos.push([ox, oy, orr]);
          query(ox, oy, orr, e => {
            if (G.t - e.ho < 0.4) return;
            const dx = e.x - ox, dy = e.y - oy;
            if (dx * dx + dy * dy < (e.r + orr) ** 2) { e.ho = G.t; hurtEnemy(e, dmg, Math.cos(a + 1.57) * 180, Math.sin(a + 1.57) * 180); }
          });
        }
        break;
      }
      case 'nova': {
        if (w.cd > 0) break;
        const R = (85 + (l >= 2 ? 15 : 0) + (l >= 5 ? 20 : 0) + (l >= 6 ? 60 : 0)) * st.area, dmg = (14 + 8 * l) * (l >= 6 ? 1.4 : 1);
        let healed = 0;
        query(p.x, p.y, R, e => {
          const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
          if (d < R + e.r) { hurtEnemy(e, dmg, dx / d * 420, dy / d * 420, '#fff0a0'); if (l >= 6 && healed < 8) { healed++; } }
        });
        if (healed) heal(healed);
        G.rings.push({ x: p.x, y: p.y, r: 10, R, t: 0.4, m: 0.4, color: WEAPONS.nova.color, w: 10 });
        Snd.play('nova');
        w.cd = [0, 3.2, 3.0, 2.9, 2.4, 2.2, 1.8][l] * st.cd;
        break;
      }
      case 'chain': {
        if (w.cd > 0) break;
        const jumps = [0, 3, 4, 4, 6, 7, 10][l], dmg = 13 + 6 * l, casts = l >= 6 ? 2 : 1;
        let any = false;
        for (let c = 0; c < casts; c++) {
          let cur = c === 0 ? nearestEnemy(p.x, p.y, 400) : pick(G.enemies.filter(e => !e.dead && Math.abs(e.x - p.x) < 400 && Math.abs(e.y - p.y) < 400) || []);
          if (!cur) continue;
          any = true;
          const hit = new Set(), pts = [[p.x, p.y]];
          for (let j = 0; j <= jumps && cur; j++) {
            hit.add(cur); pts.push([cur.x, cur.y]);
            hurtEnemy(cur, dmg, 0, 0, '#9fe8ff');
            let best = null, bd = 180 * 180; const cx = cur.x, cy = cur.y;
            query(cx, cy, 180, e => { if (hit.has(e)) return; const d = (e.x - cx) ** 2 + (e.y - cy) ** 2; if (d < bd) { bd = d; best = e; } });
            cur = best;
          }
          G.zaps.push({ pts, t: 0.22 });
        }
        if (any) { Snd.play('zap'); w.cd = [0, 1.7, 1.6, 1.5, 1.3, 1.2, 1.0][l] * st.cd; } else w.cd = 0.2;
        break;
      }
      case 'blade': {
        if (w.cd > 0) break;
        const n = [0, 1, 1, 2, 2, 3, 6][l], dmg = (16 + 7 * l) * (l >= 6 ? 1.3 : 1);
        const base = l >= 6 ? w.a : Math.atan2(p.dy, p.dx);
        w.a += 0.5;
        for (let i = 0; i < n; i++) {
          const a = l >= 6 ? base + i / n * TAU : base + (i - (n - 1) / 2) * 0.45;
          G.shots.push({ k: 'blade', x: p.x, y: p.y, a, vx: 0, vy: 0, r: 15 * st.area, dmg, t: 0, rot: 0 });
        }
        Snd.play('shoot');
        w.cd = [0, 1.6, 1.5, 1.5, 1.25, 1.15, 1.1][l] * st.cd;
        break;
      }
      case 'meteor': {
        if (w.cd > 0) break;
        const n = [0, 2, 3, 3, 4, 6, 10][l], dmg = (22 + 10 * l) * (l >= 6 ? 1.3 : 1), R = (48 + (l >= 3 ? 10 : 0) + (l >= 6 ? 25 : 0)) * st.area;
        const near = G.enemies.filter(e => !e.dead && Math.abs(e.x - p.x) < W * 0.55 && Math.abs(e.y - p.y) < H * 0.55);
        for (let i = 0; i < n; i++) {
          const e = G.boss && i === 0 && near.includes(G.boss) ? G.boss : near.length ? pick(near) : null;
          const x = e ? e.x + rand(-20, 20) : p.x + rand(-250, 250), y = e ? e.y + rand(-20, 20) : p.y + rand(-200, 200);
          G.meteors.push({ x, y, t: 0.55 + i * 0.06, m: 0.55 + i * 0.06, R, dmg });
        }
        w.cd = [0, 2.6, 2.5, 2.3, 2.2, 2.0, 1.8][l] * st.cd;
        break;
      }
    }
  }
}
function updateShots(dt) {
  const p = G.p;
  for (const s of G.shots) {
    if (s.k === 'bolt') {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (Math.random() < 0.5) G.parts.length < 650 && G.parts.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 0.2, m: 0.2, size: s.r * 0.8, color: WEAPONS.bolt.color });
      query(s.x, s.y, s.r, e => {
        if (s.hit.has(e)) return;
        const dx = e.x - s.x, dy = e.y - s.y;
        if (dx * dx + dy * dy < (e.r + s.r) ** 2) {
          s.hit.add(e);
          const v = Math.hypot(s.vx, s.vy);
          hurtEnemy(e, s.dmg, s.vx / v * 160, s.vy / v * 160);
          if (s.pierce-- <= 0) { s.life = 0; return true; }
        }
      });
    } else if (s.k === 'blade') {
      s.t += dt; s.rot += dt * 16;
      if (s.t < 0.5) { const sp = 470 * (1 - s.t / 0.55); s.x += Math.cos(s.a) * sp * dt; s.y += Math.sin(s.a) * sp * dt; }
      else {
        const dx = p.x - s.x, dy = p.y - s.y, d = Math.hypot(dx, dy) || 1, sp = Math.min(650, 150 + (s.t - 0.5) * 900);
        s.x += dx / d * sp * dt; s.y += dy / d * sp * dt;
        if (d < 22 || s.t > 4) s.done = true;
      }
      query(s.x, s.y, s.r, e => {
        if (G.t - e.hb < 0.28) return;
        const dx = e.x - s.x, dy = e.y - s.y;
        if (dx * dx + dy * dy < (e.r + s.r) ** 2) { e.hb = G.t; hurtEnemy(e, s.dmg, dx * 4, dy * 4, '#d8d0ff'); }
      });
    }
  }
  compact(G.shots, s => s.k === 'bolt' ? s.life > 0 : !s.done);
  for (const m of G.meteors) {
    m.t -= dt;
    if (m.t <= 0) {
      query(m.x, m.y, m.R, e => { const dx = e.x - m.x, dy = e.y - m.y, d = Math.hypot(dx, dy) || 1; if (d < m.R + e.r) hurtEnemy(e, m.dmg, dx / d * 260, dy / d * 260, '#ff9ad0'); });
      G.rings.push({ x: m.x, y: m.y, r: 5, R: m.R, t: 0.3, m: 0.3, color: '#ff9ad0', w: 8 });
      burst(m.x, m.y, '#ffc0e0', 12, 180, 3, 0.5);
      shake(3); Snd.play('boom');
    }
  }
  compact(G.meteors, m => m.t > 0);
}

// ------------------------------------------------------------
//  Player
// ------------------------------------------------------------
function heal(n) {
  const p = G.p, before = p.hp;
  p.hp = Math.min(p.maxHp, p.hp + n);
  if (p.hp - before >= 1) floatText(p.x, p.y - 20, '+' + Math.round(p.hp - before), '#7dff9a', 14);
}
function hurtPlayer(dmg) {
  const p = G.p;
  if (p.inv > 0 || G.won || G.over) return;
  dmg = Math.max(1, Math.round(dmg - G.st.armor));
  p.hp -= dmg; p.inv = 0.55;
  G.hurtFlash = 0.35; shake(9); Snd.play('hurt');
  floatText(p.x, p.y - 22, '-' + dmg, '#ff5a6e', 17);
  burst(p.x, p.y, '#ff6b8a', 10, 150, 3);
  G.combo = Math.floor(G.combo / 2);
  if (p.hp <= 0) {
    if (p.revives > 0) {
      p.revives--; p.hp = p.maxHp * 0.6; p.inv = 2.5;
      banner('WIEDERGEBURT!', 'Die Phönixfeder verglüht', '#ffb13b', 2.5);
      query(p.x, p.y, 300, e => { const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1; hurtEnemy(e, 200, dx / d * 900, dy / d * 900); });
      G.ebul.length = 0; G.rings.push({ x: p.x, y: p.y, r: 10, R: 320, t: 0.6, m: 0.6, color: '#ffb13b', w: 16 });
      Snd.play('evo');
    } else {
      p.hp = 0; G.over = true; G.slow = 0.2; G.winT = 1.6;
      burst(p.x, p.y, '#ffd36b', 80, 260, 5, 1.4);
      Snd.play('die');
    }
  }
}
function updatePlayer(dt) {
  const p = G.p, [mx, my] = moveInput();
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) { p.dx = mx; p.dy = my; p.anim += dt; }
  if (!G.over) { p.x += mx * G.st.spd * dt; p.y += my * G.st.spd * dt; }
  if (p.inv > 0) p.inv -= dt;
  if (G.st.regen && p.hp < p.maxHp && !G.over) p.hp = Math.min(p.maxHp, p.hp + G.st.regen * dt);
  if (Math.random() < 0.6) G.parts.length < 650 && G.parts.push({ x: p.x + rand(-5, 5), y: p.y + rand(-5, 5), vx: -mx * 30 + rand(-15, 15), vy: -my * 30 + rand(-25, 5), life: 0.5, m: 0.5, size: rand(2, 4), color: '#ffcf6b' });
  // contacts
  if (!G.over) {
    query(p.x, p.y, p.r, e => {
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy < (e.r + p.r - 3) ** 2) { hurtPlayer(e.dmg); return true; }
    });
    for (const b of G.ebul) {
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      const dx = b.x - p.x, dy = b.y - p.y;
      if (dx * dx + dy * dy < (b.r + p.r - 4) ** 2) { hurtPlayer(b.dmg); b.life = 0; }
    }
  }
  compact(G.ebul, b => b.life > 0);
}
function updatePickups(dt) {
  const p = G.p, mag = G.st.mag;
  G.gemChainT -= dt; if (G.gemChainT <= 0) G.gemChain = 0;
  for (const g of G.gems) {
    g.t += dt;
    const dx = p.x - g.x, dy = p.y - g.y, d2 = dx * dx + dy * dy;
    if (!g.mag && d2 < mag * mag) g.mag = true;
    if (g.mag) {
      const d = Math.sqrt(d2) || 1; g.sp = Math.min(900, g.sp + 1400 * dt);
      g.x += dx / d * g.sp * dt; g.y += dy / d * g.sp * dt;
      if (d < p.r + 6) { g.dead = true; addXP(g.v); G.gemChain++; G.gemChainT = 0.35; Snd.play('gem', G.gemChain); }
    }
  }
  compact(G.gems, g => !g.dead);
  for (const k of G.pickups) {
    const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy) || 1;
    if (k.k === 'coin' && d < mag * 1.2 || k.pull) { k.pull = true; k.x += dx / d * 520 * dt; k.y += dy / d * 520 * dt; }
    if (d < p.r + 14) {
      k.dead = true;
      switch (k.k) {
        case 'coin': G.coins += k.v * G.st.greed; Snd.play('coin'); break;
        case 'heart': heal(30); Snd.play('pick'); burst(p.x, p.y, '#ff6b8a', 14, 120, 3); break;
        case 'magnet': for (const g of G.gems) g.mag = true; Snd.play('pick'); banner('SOG!', '', '#7ad0ff', 1); break;
        case 'bomb': {
          Snd.play('boom'); shake(20); G.flash = 0.5;
          for (const e of G.enemies) if (!e.dead && !e.boss && Math.abs(e.x - p.x) < W * 0.6 && Math.abs(e.y - p.y) < H * 0.6) hurtEnemy(e, 9999);
          G.rings.push({ x: p.x, y: p.y, r: 10, R: Math.max(W, H), t: 0.5, m: 0.5, color: '#fff', w: 20 });
          banner('SONNENBOMBE!', '', '#fff0a0', 1.2);
          break;
        }
        case 'chest': openChest(); break;
      }
    }
  }
  compact(G.pickups, k => !k.dead);
}
function addXP(v) {
  const p = G.p;
  p.xp += v * G.st.xp * (1 + Math.min(G.combo, 200) / 400);
  while (p.xp >= p.need) { p.xp -= p.need; p.level++; p.need = xpNeed(p.level); G.pending++; }
}
function openChest() {
  const opts = buildOptions(1);
  const o = opts[0];
  applyOption(o);
  const coins = Math.round(rand(8, 20) * G.st.greed); G.coins += coins;
  banner('TRUHE!', optLabel(o) + '  ·  +' + coins + ' Funken', '#ffd36b', 2.6);
  Snd.play('chest'); G.flash = 0.3;
  burst(G.p.x, G.p.y, '#ffd36b', 40, 260, 4);
}

// ------------------------------------------------------------
//  Level up
// ------------------------------------------------------------
function buildOptions(n) {
  const opts = [];
  for (const w of G.weapons) {
    if (w.lvl < 5) opts.push({ kind: 'w', id: w.id, wt: 3 });
    else if (w.lvl === 5 && (G.passives[WEAPONS[w.id].evo] || 0) >= 2) opts.push({ kind: 'w', id: w.id, wt: 8, evo: true });
  }
  if (G.weapons.length < 5) for (const id in WEAPONS) if (!G.weapons.find(w => w.id === id)) opts.push({ kind: 'w', id, wt: 2.6, isNew: true });
  const pc = Object.keys(G.passives).length;
  for (const id in PASSIVES) {
    const l = G.passives[id] || 0;
    if (l > 0 && l < 5) opts.push({ kind: 'p', id, wt: 2 });
    else if (l === 0 && pc < 5) opts.push({ kind: 'p', id, wt: 1.5, isNew: true });
  }
  const out = [];
  while (out.length < n && opts.length) {
    const tw = opts.reduce((a, o) => a + o.wt, 0);
    let r = Math.random() * tw, i = 0;
    for (; i < opts.length; i++) { r -= opts[i].wt; if (r <= 0) break; }
    out.push(opts.splice(Math.min(i, opts.length - 1), 1)[0]);
  }
  if (!out.length) out.push({ kind: 'heal' }, { kind: 'gold' });
  return out;
}
function optLabel(o) {
  if (o.kind === 'w') { const W_ = WEAPONS[o.id]; return o.evo ? W_.evoName : W_.name; }
  if (o.kind === 'p') return PASSIVES[o.id].name;
  return o.kind === 'heal' ? 'Heilung' : 'Funkenbeutel';
}
function applyOption(o) {
  if (o.kind === 'w') {
    const w = G.weapons.find(w => w.id === o.id);
    if (w) w.lvl++; else addWeapon(o.id);
    if (o.evo) { Snd.play('evo'); banner(WEAPONS[o.id].evoName.toUpperCase(), 'ist erwacht!', '#ffd36b', 2.6); G.flash = 0.5; }
  } else if (o.kind === 'p') {
    G.passives[o.id] = (G.passives[o.id] || 0) + 1;
    recalc();
    if (o.id === 'vital') G.p.hp = G.p.maxHp;
  } else if (o.kind === 'heal') heal(50);
  else G.coins += 25;
}
function showLevelUp() {
  state = 'levelup';
  joy.on = false;
  Snd.play('level');
  const n = 3 + metaLvl('card');
  const opts = buildOptions(n);
  const cards = opts.map((o, i) => {
    let icon, color, name, lvl, desc, cls = 'card';
    if (o.kind === 'w') {
      const D = WEAPONS[o.id], w = G.weapons.find(w => w.id === o.id), nl = w ? w.lvl + 1 : 1;
      icon = D.icon; color = D.color; name = o.evo ? D.evoName : D.name; desc = D.d[nl - 1];
      lvl = o.evo ? 'ERWACHEN' : w ? 'LV ' + nl : 'NEU'; if (o.evo) cls += ' evo'; else if (!w) cls += ' new';
      if (!o.evo && nl === 5) desc += ` <br><span style="color:#ffd36b">Erwacht mit ${PASSIVES[D.evo].name} ≥ 2</span>`;
    } else if (o.kind === 'p') {
      const D = PASSIVES[o.id], nl = (G.passives[o.id] || 0) + 1;
      icon = D.icon; color = D.color; name = D.name; desc = D.d; lvl = nl === 1 ? 'NEU' : 'LV ' + nl; cls += ' pas' + (nl === 1 ? ' new' : '');
    } else if (o.kind === 'heal') { icon = '♥'; color = '#ff6b8a'; name = 'Heilung'; desc = '+50 Leben'; lvl = 'EXTRA'; }
    else { icon = '✦'; color = '#ffd36b'; name = 'Funkenbeutel'; desc = '+25 Funken'; lvl = 'EXTRA'; }
    return `<button class="${cls}" data-a="pick" data-i="${i}"><div class="ci" style="color:${color}">${icon}</div><div class="cn">${esc(name)}</div><div class="cl">${lvl}</div><div class="cd">${desc}</div><div class="ck">Taste ${i + 1}</div></button>`;
  }).join('');
  ui.innerHTML = `<div class="overlay clear"><h2>AUFSTIEG!</h2><div class="sub">Level ${G.p.level - G.pending + 1} – wähle eine Gabe</div><div class="cards">${cards}</div>
    ${G.rerolls > 0 ? `<button class="btn alt small" data-a="reroll">🎲 Neuwurf (${G.rerolls}) · R</button>` : ''}</div>`;
  ui._opts = opts;
}
function chooseCard(i) {
  const o = ui._opts && ui._opts[i]; if (!o) return;
  applyOption(o);
  G.pending--;
  Snd.play('pick');
  // level-up shockwave
  const p = G.p;
  query(p.x, p.y, 140, e => { if (e.boss) return; const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1; e.kx += dx / d * 500; e.ky += dy / d * 500; });
  G.rings.push({ x: p.x, y: p.y, r: 10, R: 140, t: 0.35, m: 0.35, color: '#ffd36b', w: 6 });
  burst(p.x, p.y, '#ffd36b', 30, 220, 3);
  p.inv = Math.max(p.inv, 0.6);
  if (G.pending > 0) showLevelUp(); else resume();
}

// ------------------------------------------------------------
//  Update
// ------------------------------------------------------------
function update(dt) {
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  G.slow = Math.min(1, G.slow + dt * 0.8);
  const rdt = dt;
  dt *= G.slow;
  G.t += (G.won || G.over) ? 0 : dt;
  if (G.shake > 0) G.shake = Math.max(0, G.shake - rdt * 40);
  if (G.flash > 0) G.flash -= rdt;
  if (G.hurtFlash > 0) G.hurtFlash -= rdt;
  G.comboT -= dt; if (G.comboT <= 0) { G.combo = 0; G.comboMs = 25; }

  updatePlayer(dt);
  if (!G.over) updateWeapons(dt);
  if (!G.won && !G.over) spawnTick(dt);
  updateEnemies(dt);
  buildGrid();
  separate();
  updateShots(dt);
  updatePickups(dt);
  compact(G.enemies, e => !e.dead);

  for (const q of G.parts) { q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= 0.94; q.vy *= 0.94; q.life -= dt; }
  compact(G.parts, q => q.life > 0);
  for (const t of G.texts) { t.y -= 40 * dt; t.t -= dt; }
  compact(G.texts, t => t.t > 0);
  for (const r of G.rings) r.t -= dt; compact(G.rings, r => r.t > 0);
  for (const z of G.zaps) z.t -= dt; compact(G.zaps, z => z.t > 0);
  for (const b of G.banners) b.t -= rdt; compact(G.banners, b => b.t > 0);

  if (G.won || G.over) {
    G.winT -= rdt;
    if (G.won) { for (const g of G.gems) g.mag = true; for (const k of G.pickups) k.pull = true; }
    if (G.winT <= 0) { if (G.won) chapterWon(); else runLost(); }
    return;
  }
  if (G.pending > 0) showLevelUp();
}

// ============================================================
//  RENDER
// ============================================================
let menuT = 0;
function drawShape(shape, x, y, r, rot = 0) {
  ctx.beginPath();
  switch (shape) {
    case 'circle': ctx.arc(x, y, r, 0, TAU); break;
    case 'square': { const s = r * 0.9; ctx.roundRect ? ctx.roundRect(x - s, y - s, s * 2, s * 2, r * 0.35) : ctx.rect(x - s, y - s, s * 2, s * 2); break; }
    case 'tri': for (let i = 0; i < 3; i++) { const a = rot + i / 3 * TAU - Math.PI / 2; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2); } ctx.closePath(); break;
    case 'diamond': ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r * 1.2); ctx.lineTo(x - r, y); ctx.closePath(); break;
    case 'hex': for (let i = 0; i < 6; i++) { const a = rot + i / 6 * TAU; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y + Math.sin(a) * r); } ctx.closePath(); break;
    case 'star': for (let i = 0; i < 16; i++) { const a = rot + i / 16 * TAU, rr = i % 2 ? r * 0.72 : r * 1.12; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); break;
  }
}
function drawDeco(th, cx0, cy0, cx1, cy1, t) {
  const S = 170;
  for (let cx = cx0; cx <= cx1; cx++) for (let cy = cy0; cy <= cy1; cy++) {
    const h = hash(cx, cy); if (h > 0.42) continue;
    const x = cx * S + hash(cx + 11, cy) * S, y = cy * S + hash(cx, cy + 7) * S, v = hash(cx + 3, cy + 5);
    switch (th.deco) {
      case 'forest':
        if (v < 0.5) { // tree
          const r = 22 + v * 40;
          ctx.fillStyle = '#081209'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.arc(x + r * 0.6, y + r * 0.3, r * 0.7, 0, TAU); ctx.arc(x - r * 0.6, y + r * 0.35, r * 0.65, 0, TAU); ctx.fill();
          ctx.fillStyle = '#0f2414'; ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.25, r * 0.55, 0, TAU); ctx.fill();
        } else if (v < 0.8) { // glowing mushrooms
          const g = 0.5 + 0.5 * Math.sin(t * 2 + h * 30);
          for (let i = 0; i < 3; i++) { const mx = x + i * 9 - 9, my = y + (i % 2) * 6; ctx.fillStyle = '#1c2a1c'; ctx.fillRect(mx - 1, my, 2, 6); ctx.fillStyle = `rgba(160,255,140,${0.4 + g * 0.5})`; ctx.beginPath(); ctx.arc(mx, my, 4, Math.PI, 0); ctx.fill(); }
        } else { ctx.fillStyle = '#12281a'; ctx.beginPath(); ctx.ellipse(x, y, 30, 12, 0.3, 0, TAU); ctx.fill(); }
        break;
      case 'city':
        if (v < 0.45) { ctx.fillStyle = '#0e2238'; ctx.fillRect(x - 14, y - 40, 28, 60); ctx.fillStyle = '#132d48'; ctx.fillRect(x - 18, y - 44, 36, 8); ctx.fillRect(x - 18, y + 18, 36, 8); }
        else if (v < 0.75) { ctx.strokeStyle = '#11283f'; ctx.lineWidth = 3; ctx.strokeRect(x - 30, y - 30, 60, 60); ctx.beginPath(); ctx.moveTo(x - 30, y); ctx.lineTo(x + 30, y); ctx.stroke(); }
        else { const by = y - ((t * 30 + h * 400) % 120); ctx.strokeStyle = 'rgba(150,220,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, by, 4 + v * 5, 0, TAU); ctx.stroke(); }
        break;
      case 'desert':
        if (v < 0.4) { ctx.fillStyle = '#231008'; ctx.beginPath(); ctx.ellipse(x, y, 60 + v * 60, 18, 0, 0, TAU); ctx.fill(); }
        else if (v < 0.7) { ctx.fillStyle = '#301508'; ctx.beginPath(); ctx.moveTo(x - 18, y + 12); ctx.lineTo(x - 6, y - 16); ctx.lineTo(x + 14, y - 8); ctx.lineTo(x + 20, y + 12); ctx.fill(); }
        else { const g = 0.5 + 0.5 * Math.sin(t * 3 + h * 20); ctx.fillStyle = `rgba(255,120,40,${0.2 + g * 0.35})`; ctx.fillRect(x - 20, y, 40, 2); ctx.fillRect(x - 5, y - 8, 2, 16); }
        break;
      case 'sky':
        if (v < 0.5) { ctx.fillStyle = 'rgba(40,52,90,0.55)'; ctx.beginPath(); ctx.arc(x, y, 26, 0, TAU); ctx.arc(x + 28, y + 6, 20, 0, TAU); ctx.arc(x - 26, y + 8, 18, 0, TAU); ctx.fill(); }
        else { ctx.strokeStyle = `rgba(200,220,255,${0.15 + 0.2 * Math.sin(t + h * 10) ** 2})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, y - 20); ctx.lineTo(x + 12, y + 10); ctx.lineTo(x - 10, y + 16); ctx.closePath(); ctx.stroke(); }
        break;
      case 'void':
        if (v < 0.5) { ctx.strokeStyle = `rgba(160,90,255,${0.15 + 0.25 * (0.5 + 0.5 * Math.sin(t * 1.5 + h * 9))})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 30, y); ctx.lineTo(x - 8, y - 6); ctx.lineTo(x + 6, y + 8); ctx.lineTo(x + 34, y + 2); ctx.stroke(); }
        else { ctx.strokeStyle = 'rgba(120,60,200,0.25)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.moveTo(x, y - 10); ctx.lineTo(x, y + 10); ctx.moveTo(x - 10, y); ctx.lineTo(x + 10, y); ctx.stroke(); }
        break;
    }
  }
}
function drawPlayer(p, t) {
  const blink = p.inv > 0 && Math.floor(t * 20) % 2 === 0;
  if (G.over && G.p.hp <= 0) return;
  const r = p.r, bob = Math.sin(t * 5) * 1.5;
  const x = p.x, y = p.y + bob;
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2);
  g.addColorStop(0, 'rgba(255,220,130,0.55)'); g.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  if (blink) return;
  const g2 = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, r);
  g2.addColorStop(0, '#fffbe8'); g2.addColorStop(0.5, '#ffd36b'); g2.addColorStop(1, '#ff9a2a');
  ctx.fillStyle = g2; ctx.beginPath();
  // flame tip
  const fx = -p.dx * 10, fy = -p.dy * 10 - 6;
  ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI); ctx.quadraticCurveTo(x - r * 0.4 + fx * 0.3, y - r * 0.9 + fy * 0.3, x + fx, y - r - 6 + fy * 0.4 + Math.sin(t * 12) * 2);
  ctx.quadraticCurveTo(x + r * 0.4 + fx * 0.3, y - r * 0.9 + fy * 0.3, x + r, y); ctx.fill();
  // eyes
  ctx.fillStyle = '#3a1a00';
  const ex = p.dx * 3, ey = p.dy * 2, bl = (t % 3.2) < 0.12 ? 0.3 : 1;
  ctx.beginPath(); ctx.ellipse(x - 4 + ex, y + ey, 1.8, 2.6 * bl, 0, 0, TAU); ctx.ellipse(x + 4 + ex, y + ey, 1.8, 2.6 * bl, 0, 0, TAU); ctx.fill();
}
function drawEnemy(e, t) {
  const th = theme();
  const wob = e.boss ? 0 : Math.sin(e.t * 8) * 0.08;
  const r = e.r * (1 + wob);
  const rot = e.shape === 'tri' ? Math.atan2(G.p.y - e.y, G.p.x - e.x) + Math.PI / 2 : e.shape === 'star' ? e.t * 0.5 : 0;
  if (e.elite || e.boss) {
    ctx.globalCompositeOperation = 'lighter';
    const gg = ctx.createRadialGradient(e.x, e.y, r * 0.5, e.x, e.y, r * 2);
    gg.addColorStop(0, e.boss ? 'rgba(255,80,120,0.35)' : 'rgba(255,210,90,0.35)'); gg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(e.x, e.y, r * 2, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  // telegraph
  if (e.type === 'runner' && e.st === 1) {
    ctx.strokeStyle = 'rgba(255,90,110,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + e.cdx * 280, e.y + e.cdy * 280); ctx.stroke(); ctx.setLineDash([]);
  }
  if (e.boss && e.pat === 'charge' && e.tele > 0) {
    ctx.fillStyle = 'rgba(255,60,90,0.18)';
    ctx.save(); ctx.translate(e.x, e.y); ctx.rotate(Math.atan2(e.cdy, e.cdx)); ctx.fillRect(0, -e.r, 560 * 0.55, e.r * 2); ctx.restore();
  }
  ctx.fillStyle = e.flash > 0 && !e.boss ? '#ffffff' : e.color;
  drawShape(e.shape, e.x, e.y, r, rot); ctx.fill();
  if (e.boss && e.flash > 0) { ctx.globalAlpha = 0.45; ctx.fillStyle = '#fff'; ctx.fill(); ctx.globalAlpha = 1; }
  ctx.strokeStyle = e.elite ? '#ffd36b' : e.boss ? '#ffffff' : th.accent; ctx.globalAlpha = e.boss || e.elite ? 0.9 : 0.35; ctx.lineWidth = e.boss ? 3 : 1.5; ctx.stroke(); ctx.globalAlpha = 1;
  // eyes looking at player
  const a = Math.atan2(G.p.y - e.y, G.p.x - e.x), es = Math.max(1.6, r * 0.18), ed = r * 0.35;
  const lx = Math.cos(a) * r * 0.2, ly = Math.sin(a) * r * 0.2;
  ctx.fillStyle = e.boss ? '#ff4d6d' : e.eye;
  ctx.beginPath(); ctx.arc(e.x - ed + lx, e.y - r * 0.1 + ly, es, 0, TAU); ctx.arc(e.x + ed + lx, e.y - r * 0.1 + ly, es, 0, TAU); ctx.fill();
  if (e.boss) {
    // crown
    ctx.fillStyle = '#ffd36b';
    ctx.beginPath(); ctx.moveTo(e.x - r * 0.5, e.y - r * 0.85); for (let i = 0; i < 5; i++) { ctx.lineTo(e.x - r * 0.5 + i * r * 0.25, e.y - r * (i % 2 ? 0.95 : 1.3)); } ctx.lineTo(e.x + r * 0.5, e.y - r * 0.85); ctx.fill();
  }
  if (e.elite && e.hp < e.maxHp) { ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(e.x - r, e.y + r + 6, r * 2, 4); ctx.fillStyle = '#ffd36b'; ctx.fillRect(e.x - r, e.y + r + 6, r * 2 * e.hp / e.maxHp, 4); }
}
function render(dt) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  menuT += dt;
  if (!G) { drawMenuBg(dt); return; }
  const th = theme(), p = G.p, t = G.t + menuT * 0;
  const tt = performance.now() / 1000;
  // camera (smooth)
  G.camx = lerp(G.camx, p.x, 0.2); G.camy = lerp(G.camy, p.y, 0.2);
  const sx = G.shake ? rand(-G.shake, G.shake) : 0, sy = G.shake ? rand(-G.shake, G.shake) : 0;
  const ox = Math.round(W / 2 - G.camx + sx), oy = Math.round(H / 2 - G.camy + sy);
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.translate(ox, oy);
  const vx0 = G.camx - W / 2 - 80, vy0 = G.camy - H / 2 - 80, vx1 = G.camx + W / 2 + 80, vy1 = G.camy + H / 2 + 80;
  // ground dots
  ctx.fillStyle = th.g1;
  const gs = 48;
  for (let x = Math.floor(vx0 / gs) * gs; x < vx1; x += gs) for (let y = Math.floor(vy0 / gs) * gs; y < vy1; y += gs) {
    const h = hash(x / gs | 0, y / gs | 0);
    ctx.fillRect(x + h * 30, y + hash(y, x) * 30, 2 + h * 3, 2 + h * 3);
  }
  drawDeco(th, Math.floor(vx0 / 170) - 1, Math.floor(vy0 / 170) - 1, Math.floor(vx1 / 170), Math.floor(vy1 / 170), tt);
  const vis = (x, y, r) => x + r > vx0 && x - r < vx1 && y + r > vy0 && y - r < vy1;
  // meteors markers
  for (const m of G.meteors) {
    const k = 1 - m.t / m.m;
    ctx.strokeStyle = `rgba(255,154,208,${0.3 + k * 0.5})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.R, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(255,154,208,${k * 0.2})`; ctx.fill();
    const hy = m.y - (1 - k) * 500;
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(m.x + (1 - k) * 120, hy, 6, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,190,230,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(m.x + (1 - k) * 120, hy); ctx.lineTo(m.x + (1 - k) * 120 + 40, hy - 160); ctx.stroke();
  }
  // gems
  for (const g of G.gems) {
    if (!vis(g.x, g.y, 10)) continue;
    const c = g.v >= 20 ? '#ff5ad0' : g.v >= 5 ? '#6aff8a' : '#5ad8ff', s = g.v >= 20 ? 7 : g.v >= 5 ? 5.5 : 4.5;
    const b = Math.sin(g.t * 5 + g.x) * 1.5;
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(g.x, g.y - s + b); ctx.lineTo(g.x + s * 0.7, g.y + b); ctx.lineTo(g.x, g.y + s + b); ctx.lineTo(g.x - s * 0.7, g.y + b); ctx.fill();
  }
  // pickups
  for (const k of G.pickups) {
    if (!vis(k.x, k.y, 20)) continue;
    const b = Math.sin(tt * 4 + k.x) * 3;
    ctx.font = '900 18px Nunito, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (k.k === 'coin') { ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.arc(k.x, k.y + b, 5, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff6d0'; ctx.fillRect(k.x - 1, k.y + b - 3, 2, 6); }
    else if (k.k === 'heart') { ctx.fillStyle = '#ff6b8a'; ctx.fillText('♥', k.x, k.y + b); }
    else if (k.k === 'magnet') { ctx.fillStyle = '#7ad0ff'; ctx.fillText('◎', k.x, k.y + b); }
    else if (k.k === 'bomb') { ctx.fillStyle = '#fff0a0'; ctx.fillText('☀', k.x, k.y + b); }
    else if (k.k === 'chest') {
      ctx.fillStyle = 'rgba(255,211,107,0.25)'; ctx.beginPath(); ctx.arc(k.x, k.y + b, 22 + Math.sin(tt * 6) * 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#8a4a14'; ctx.fillRect(k.x - 12, k.y - 8 + b, 24, 17); ctx.fillStyle = '#ffd36b'; ctx.fillRect(k.x - 12, k.y - 2 + b, 24, 3); ctx.fillRect(k.x - 2, k.y - 3 + b, 4, 6);
    }
  }
  // enemies
  for (const e of G.enemies) if (vis(e.x, e.y, e.r * 2)) drawEnemy(e, tt);
  // shots
  for (const s of G.shots) {
    if (s.k === 'bolt') {
      const a = Math.atan2(s.vy, s.vx);
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(a);
      ctx.fillStyle = s.evo ? '#fff6c0' : WEAPONS.bolt.color; ctx.beginPath(); ctx.ellipse(0, 0, s.r * 2.4, s.r * 0.9, 0, 0, TAU); ctx.fill();
      ctx.restore();
    } else {
      ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.rot);
      ctx.fillStyle = '#e8e0ff'; ctx.beginPath(); ctx.arc(0, 0, s.r, 0.3, Math.PI * 1.7); ctx.arc(-s.r * 0.35, 0, s.r * 0.8, Math.PI * 1.6, 0.4, true); ctx.fill();
      ctx.restore();
    }
  }
  drawPlayer(p, tt);
  // orbit orbs
  for (const w of G.weapons) if (w.id === 'orbit' && w.pos) for (const [x, y, r] of w.pos) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,170,80,0.35)'; ctx.beginPath(); ctx.arc(x, y, r * 2, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = w.lvl >= 6 ? '#fff4c0' : '#ffc070'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }
  // enemy bullets
  ctx.fillStyle = th.bullet;
  for (const b of G.ebul) {
    if (!vis(b.x, b.y, 10)) continue;
    ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 1.8, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = '#fff';
  for (const b of G.ebul) { if (vis(b.x, b.y, 10)) { ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU); ctx.fill(); } }
  // particles
  ctx.globalCompositeOperation = 'lighter';
  for (const q of G.parts) {
    const a = q.life / q.m; ctx.globalAlpha = a; ctx.fillStyle = q.color;
    const s = q.size * (0.5 + a * 0.5); ctx.fillRect(q.x - s / 2, q.y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
  for (const r of G.rings) {
    const k = 1 - r.t / r.m, rad = lerp(r.r, r.R, 1 - Math.pow(1 - k, 3));
    ctx.strokeStyle = r.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = r.w * (1 - k) + 1;
    ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, TAU); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const z of G.zaps) {
    ctx.strokeStyle = '#bff4ff'; ctx.lineWidth = 3 * z.t / 0.22 + 1; ctx.globalAlpha = Math.min(1, z.t / 0.12);
    ctx.beginPath();
    for (let i = 0; i < z.pts.length; i++) {
      const [x, y] = z.pts[i];
      if (!i) { ctx.moveTo(x, y); continue; }
      const [px, py] = z.pts[i - 1];
      for (let s = 1; s <= 3; s++) ctx.lineTo(lerp(px, x, s / 4) + rand(-8, 8), lerp(py, y, s / 4) + rand(-8, 8));
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  // motes
  for (const m of G.motes) {
    let mx = ((m.x - G.camx * m.z) % W + W) % W, my = ((m.y - G.camy * m.z + Math.sin(tt * 0.5 + m.s) * 30) % H + H) % H;
    ctx.fillStyle = th.mote; ctx.globalAlpha = 0.25 + 0.35 * Math.sin(tt * 2 + m.s) ** 2;
    ctx.fillRect(mx + G.camx - W / 2, my + G.camy - H / 2, 2 * m.z + 1, 2 * m.z + 1);
  }
  ctx.globalAlpha = 1;
  // damage numbers
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const tx of G.texts) {
    ctx.globalAlpha = Math.min(1, tx.t * 3);
    ctx.font = `900 ${tx.size}px Nunito, sans-serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(tx.txt, tx.x, tx.y);
    ctx.fillStyle = tx.color; ctx.fillText(tx.txt, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // darkness – the light grows as Lumen levels up
  const lx = p.x + ox, ly = p.y + oy;
  const lr = 170 + Math.min(40, p.level) * 7;
  const dg = ctx.createRadialGradient(lx, ly, lr * 0.35, lx, ly, Math.max(W, H) * 0.75);
  dg.addColorStop(0, 'rgba(0,0,0,0)'); dg.addColorStop(0.45, 'rgba(0,0,5,0.35)'); dg.addColorStop(1, 'rgba(0,0,8,0.82)');
  ctx.fillStyle = dg; ctx.fillRect(0, 0, W, H);
  if (G.hurtFlash > 0) { ctx.fillStyle = `rgba(255,40,70,${G.hurtFlash * 0.6})`; ctx.fillRect(0, 0, W, H); }
  if (G.flash > 0) { ctx.fillStyle = `rgba(255,245,220,${Math.min(0.6, G.flash)})`; ctx.fillRect(0, 0, W, H); }
  if (p.hp < p.maxHp * 0.3 && !G.over) {
    const k = 0.25 + 0.2 * Math.sin(tt * 6);
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
    vg.addColorStop(0, 'rgba(255,0,40,0)'); vg.addColorStop(1, `rgba(255,0,40,${k})`); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  }
  drawHUD(th, tt);
}
function drawHUD(th, tt) {
  const p = G.p, top = 0;
  ctx.textBaseline = 'middle';
  // XP bar
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, top, W, 10);
  const xg = ctx.createLinearGradient(0, 0, W, 0); xg.addColorStop(0, '#5ad8ff'); xg.addColorStop(1, '#b98bff');
  ctx.fillStyle = xg; ctx.fillRect(0, top, W * clamp(p.xp / p.need, 0, 1), 10);
  // level
  ctx.font = '900 15px Nunito, sans-serif'; ctx.textAlign = 'left';
  ctx.fillStyle = '#fff'; ctx.fillText('LV ' + p.level, 14, 28);
  // HP
  const narrow = W < 640;
  const hw = narrow ? W - 62 - 120 : 200, hx = 62, hy = 21;
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(hx, hy, hw, 14);
  ctx.fillStyle = p.hp < p.maxHp * 0.3 ? '#ff4d6d' : '#ff6b8a'; ctx.fillRect(hx, hy, hw * clamp(p.hp / p.maxHp, 0, 1), 14);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.strokeRect(hx + 0.5, hy + 0.5, hw - 1, 13);
  ctx.font = '700 11px Nunito, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.fillText(Math.ceil(p.hp) + ' / ' + p.maxHp, hx + hw / 2, hy + 7.5);
  // weapons & passives
  let ix = 14;
  ctx.font = '18px Nunito, sans-serif';
  for (const w of G.weapons) {
    const D = WEAPONS[w.id];
    ctx.fillStyle = w.lvl >= 6 ? 'rgba(255,211,107,0.3)' : 'rgba(0,0,0,0.45)'; ctx.fillRect(ix, 44, 30, 30);
    ctx.fillStyle = D.color; ctx.textAlign = 'center'; ctx.fillText(D.icon, ix + 15, 58);
    ctx.font = '900 9px Nunito, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(w.lvl >= 6 ? '★' : w.lvl, ix + 25, 69); ctx.font = '18px Nunito, sans-serif';
    ix += 34;
  }
  ix = 14; ctx.font = '13px Nunito, sans-serif';
  for (const id in G.passives) {
    const D = PASSIVES[id];
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(ix, 78, 22, 22);
    ctx.fillStyle = D.color; ctx.fillText(D.icon, ix + 11, 89);
    ix += 25;
  }
  // timer / objective
  ctx.textAlign = 'center';
  let label;
  if (G.boss) label = G.boss.def.name;
  else if (G.mode === 'endless') label = fmtTime(G.t);
  else label = G.won ? 'Befreit!' : 'Boss in ' + fmtTime(G.nextBoss - G.t);
  ctx.font = '900 20px Nunito, sans-serif'; ctx.fillStyle = '#fff';
  if (narrow) { ctx.font = '900 17px Nunito, sans-serif'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.strokeText(label, W / 2 + 40, 118); ctx.fillText(label, W / 2 + 40, 118); }
  else ctx.fillText(label, W / 2, 30);
  ctx.font = '700 11px Nunito, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
  if (!narrow) ctx.fillText(G.mode === 'endless' ? 'EWIGE NACHT · Rekord ' + fmtTime(save.endlessBest) : th.name.toUpperCase(), W / 2, 50);
  // kills & coins
  ctx.textAlign = 'right'; ctx.font = '900 15px Nunito, sans-serif';
  ctx.fillStyle = '#ffd36b'; ctx.fillText('✦ ' + Math.floor(G.coins), W - 62, 30);
  ctx.fillStyle = '#fff'; ctx.fillText('☠ ' + G.kills, W - 62, 50);
  // combo
  if (G.combo >= 5) {
    const s = 1 + Math.min(0.6, G.combo / 300), pulse = 1 + (G.comboT > 2.0 ? (G.comboT - 2.0) * 1.5 : 0);
    ctx.save(); ctx.translate(W - 20, H * 0.32); ctx.scale(s * pulse, s * pulse);
    ctx.textAlign = 'right'; ctx.font = '900 26px Nunito, sans-serif';
    const hue = (G.combo * 3) % 360;
    ctx.fillStyle = `hsl(${hue},100%,72%)`; ctx.fillText(G.combo + '×', 0, 0);
    ctx.font = '900 11px Nunito, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText('COMBO', 0, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-60, 30, 60, 3); ctx.fillStyle = '#fff'; ctx.fillRect(-60, 30, 60 * clamp(G.comboT / 2.2, 0, 1), 3);
    ctx.restore();
  }
  // boss bar
  if (G.boss) {
    const bw = Math.min(520, W - 40), bx = (W - bw) / 2, by = H - 38;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx, by, bw, 14);
    const bg = ctx.createLinearGradient(bx, 0, bx + bw, 0); bg.addColorStop(0, '#ff4d6d'); bg.addColorStop(1, '#b98bff');
    ctx.fillStyle = bg; ctx.fillRect(bx, by, bw * clamp(G.boss.hp / G.boss.maxHp, 0, 1), 14);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, 13);
    ctx.font = '900 12px Cinzel, serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(G.boss.def.name.toUpperCase(), W / 2, by - 10);
    // offscreen arrow
    const dx = G.boss.x - G.p.x, dy = G.boss.y - G.p.y;
    if (Math.abs(dx) > W / 2 || Math.abs(dy) > H / 2) {
      const a = Math.atan2(dy, dx), ax = W / 2 + Math.cos(a) * (Math.min(W, H) / 2 - 40), ay = H / 2 + Math.sin(a) * (Math.min(W, H) / 2 - 40);
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a); ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-8, 9); ctx.fill(); ctx.restore();
    }
  }
  // banners
  let by = H * 0.3;
  for (const b of G.banners) {
    const k = b.t / b.m, a = Math.min(1, b.t * 2.5, (b.m - b.t) * 6);
    const sc = 1 + Math.max(0, (k - 0.85)) * 2;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, by); ctx.scale(sc, sc);
    ctx.textAlign = 'center'; ctx.font = `900 ${Math.min(40, W / 14)}px Cinzel, serif`;
    ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(b.text, 0, 0);
    ctx.fillStyle = b.color; ctx.fillText(b.text, 0, 0);
    if (b.sub) { ctx.font = '700 16px Nunito, sans-serif'; ctx.lineWidth = 4; ctx.strokeText(b.sub, 0, 30); ctx.fillStyle = '#fff'; ctx.fillText(b.sub, 0, 30); }
    ctx.restore();
    by += b.sub ? 70 : 50;
  }
  // joystick
  if (joy.on && state === 'play') {
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(joy.ox, joy.oy, 55, 0, TAU); ctx.stroke();
    ctx.fillStyle = 'rgba(255,211,107,0.5)'; ctx.beginPath(); ctx.arc(joy.x, joy.y, 22, 0, TAU); ctx.fill();
  }
}
function drawMenuBg(dt) {
  const th = CHAPTERS[Math.min(save.done, 4)];
  ctx.fillStyle = '#07060d'; ctx.fillRect(0, 0, W, H);
  const t = menuT;
  for (let i = 0; i < 90; i++) {
    const x = (hash(i, 1) * W + Math.sin(t * 0.3 + i) * 20) % W, y = (hash(i, 2) * H - t * (8 + hash(i, 3) * 20)) % H;
    ctx.fillStyle = i % 3 ? th.mote : '#ffd36b'; ctx.globalAlpha = 0.2 + 0.5 * Math.sin(t * 2 + i) ** 2;
    ctx.fillRect(x, (y + H) % H, 2, 2);
  }
  ctx.globalAlpha = 1;
  const cx = W / 2, cy = H * 0.5, r = Math.min(W, H) * 0.35;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, 'rgba(255,190,90,0.22)'); g.addColorStop(1, 'rgba(255,120,40,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

// ============================================================
//  SCREENS
// ============================================================
function setUI(html) { ui.innerHTML = html; ui._opts = null; }
function showPauseBtn(v) { pauseBtn.style.display = v ? 'block' : 'none'; }
function todayStr() { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }

function mainMenu() {
  state = 'menu'; G = null; showPauseBtn(false);
  const endlessOpen = save.done >= 1;
  setUI(`<div class="overlay" style="background:none">
    <div class="topbar"><span class="currency">${save.funken}</span><button class="btn alt small" data-a="mute">${save.muted ? '🔇' : '🔊'}</button></div>
    <h1 class="logo">LUMEN</h1><div class="tagline">Der letzte Funke</div>
    <div class="col" style="margin-top:22px">
      <button class="btn" data-a="go3d">✦ NEU: Sonnenflug 3D</button>
      <button class="btn" data-a="map">${save.done === 0 && !save.seenIntro ? 'Abenteuer beginnen' : 'Abenteuer'}</button>
      <button class="btn alt" data-a="shop">Seelenschmiede${affordable() ? '<span class="badge">!</span>' : ''}</button>
      <button class="btn alt" data-a="endless" ${endlessOpen ? '' : 'disabled'}>${endlessOpen ? '🌑 Ewige Nacht' : '🔒 Ewige Nacht (Kapitel I)'}</button>
    </div>
    <div class="keys">WASD / Pfeiltasten – oder einfach ziehen (Touch/Maus) · Angriffe laufen automatisch</div>
    <div class="credits">${save.runs} Läufe · ${save.totalKills} Schatten erlöst · Kapitel ${save.done}/5</div>
  </div>`);
  checkDaily();
}
function checkDaily() {
  const td = todayStr();
  if (save.lastDaily === td) return;
  const y = new Date(Date.now() - 864e5); const yd = y.getFullYear() + '-' + (y.getMonth() + 1) + '-' + y.getDate();
  save.streak = save.lastDaily === yd ? save.streak + 1 : 1;
  save.lastDaily = td;
  const amt = 30 + 20 * Math.min(save.streak, 7);
  save.funken += amt; persist();
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div style="font-family:Cinzel,serif;font-size:20px;color:var(--gold)">Tägliches Licht</div><div class="reward">+${amt} ✦</div><div class="muted">Serie: ${save.streak} ${save.streak === 1 ? 'Tag' : 'Tage'} ${'🔥'.repeat(Math.min(save.streak, 7))}<br>Komm morgen wieder für mehr!</div><button class="btn small" style="margin-top:10px" data-a="closeToast">Danke!</button>`;
  ui.appendChild(el);
  const cur = ui.querySelector('.currency'); if (cur) cur.textContent = save.funken;
}
function chapterMap() {
  state = 'menu'; G = null; showPauseBtn(false);
  const items = CHAPTERS.map((c, i) => {
    const locked = i > save.done, done = i < save.done, best = save.best[i];
    return `<button class="chap ${i === save.done ? 'next' : ''}" data-a="chapter" data-i="${i}" ${locked ? 'disabled' : ''}>
      <div class="orb" style="color:${c.accent};background:radial-gradient(circle at 35% 35%, #fff, ${c.accent} 45%, ${c.bg})"></div>
      <div><div class="t1">Kapitel ${['I', 'II', 'III', 'IV', 'V'][i]}</div><div class="t2">${locked ? '???' : c.name}</div>
      <div class="t3">${locked ? 'Noch verborgen' : done ? 'Befreit' + (best ? ' · Bestzeit ' + fmtTime(best) : '') : 'Boss: ' + c.boss.name + ' · ' + fmtTime(c.dur) + ' überleben'}</div></div>
      <div class="state">${locked ? '🔒' : done ? '☀' : '▶'}</div></button>`;
  }).join('');
  setUI(`<div class="overlay">
    <div class="topbar"><button class="btn alt small" data-a="menu">← Zurück</button><span class="currency">${save.funken}</span></div>
    <h2>Die Reise</h2><div class="sub">Fünf Scherben der Sonne. Eine nach der anderen.</div>
    <div class="chapters">${items}</div>
    ${save.done > 0 ? '<button class="btn alt small" data-a="intro">Prolog ansehen</button>' : ''}
  </div>`);
}
function shopScreen(back = 'menu') {
  state = 'menu'; showPauseBtn(false);
  const items = META.map(m => {
    const l = metaLvl(m.id), max = l >= m.max, cost = metaCost(m, l);
    return `<div class="item ${max ? 'max' : ''}"><div class="n">${m.name}</div><div class="d">${m.d}</div>
      <div class="pips">${Array.from({ length: m.max }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('')}</div>
      <button class="btn small" data-a="buy" data-id="${m.id}" ${max || save.funken < cost ? 'disabled' : ''}>${max ? 'MAXIMAL' : '✦ ' + cost}</button></div>`;
  }).join('');
  setUI(`<div class="overlay">
    <div class="topbar"><button class="btn alt small" data-a="${back}">← Zurück</button><span class="currency">${save.funken}</span></div>
    <h2>Seelenschmiede</h2><div class="sub">Dauerhafte Stärke für jeden neuen Versuch. Funken behältst du – auch wenn du fällst.</div>
    <div class="shop">${items}</div>
    ${back === 'menu' ? '' : '<button class="btn" data-a="retry">Nochmal!</button>'}
  </div>`);
}

// ------------------------------------------------------------
//  Dialog
// ------------------------------------------------------------
let dlg = null;
function showDialog(lines, done) {
  state = 'dialog'; showPauseBtn(false); joy.on = false;
  dlg = { lines, i: -1, done, typing: false, timer: null, full: '' };
  nextLine();
}
function nextLine() {
  if (!dlg) return;
  if (dlg.typing) { // finish current line
    clearInterval(dlg.timer); dlg.typing = false;
    const tx = ui.querySelector('.dtext'); if (tx) tx.textContent = dlg.full;
    return;
  }
  dlg.i++;
  if (dlg.i >= dlg.lines.length) { const d = dlg.done; dlg = null; d(); return; }
  const [who, text] = dlg.lines[dlg.i], c = CAST[who];
  setUI(`<div class="dlg-wrap" data-a="dlgnext"><div class="dlg ${who ? '' : 'narr'}">
      ${who ? `<div class="portrait" style="background:radial-gradient(circle at 35% 30%, #fff, ${c.c} 50%, ${c.c}55)">${c.i}</div>` : ''}
      <div style="flex:1">${who ? `<div class="dname" style="color:${c.c}">${esc(who)}</div>` : ''}<div class="dtext"></div><div class="dhint">Tippen / Leertaste ▸</div></div>
    </div></div><button class="btn alt small skip" data-a="dlgskip">Überspringen »</button>`);
  const tx = ui.querySelector('.dtext');
  dlg.full = text; dlg.typing = true;
  let n = 0;
  dlg.timer = setInterval(() => {
    n += 1; tx.textContent = text.slice(0, n);
    if (n % 3 === 0 && who) Snd.tone(who === 'Umbra' ? 110 : who === 'Flimmer' ? 900 : 440 + (n % 5) * 30, 0.03, 'triangle', 0.02);
    if (n >= text.length) { clearInterval(dlg.timer); dlg.typing = false; }
  }, 24);
}
function skipDialog() { if (!dlg) return; clearInterval(dlg.timer); const d = dlg.done; dlg = null; d(); }

// ------------------------------------------------------------
//  Flow
// ------------------------------------------------------------
function startChapter(i) {
  newRun('chapter', i);
  const go = () => {
    const pre = CHAPTERS[i].pre;
    showDialog(pre, () => { banner(CHAPTERS[i].name.toUpperCase(), 'Kapitel ' + ['I', 'II', 'III', 'IV', 'V'][i], CHAPTERS[i].accent, 3); resume(); });
  };
  if (i === 0 && !save.seenIntro) { save.seenIntro = true; persist(); showDialog(INTRO, go); }
  else go();
}
function startEndless() {
  newRun('endless', 0);
  banner('EWIGE NACHT', 'Wie lange hältst du durch?', '#b98bff', 3);
  resume();
}
function resume() { state = 'play'; setUI(''); showPauseBtn(true); last = performance.now(); }
function pauseGame() {
  if (state !== 'play') return;
  state = 'pause'; showPauseBtn(false); joy.on = false;
  const build = G.weapons.map(w => `<span style="color:${WEAPONS[w.id].color}">${WEAPONS[w.id].icon} ${w.lvl >= 6 ? WEAPONS[w.id].evoName : WEAPONS[w.id].name} ${w.lvl >= 6 ? '★' : w.lvl}</span>`).join('') +
    Object.keys(G.passives).map(id => `<span style="color:${PASSIVES[id].color}">${PASSIVES[id].icon} ${PASSIVES[id].name} ${G.passives[id]}</span>`).join('');
  const hints = G.weapons.filter(w => w.lvl === 5).map(w => `${WEAPONS[w.id].name} erwacht mit ${PASSIVES[WEAPONS[w.id].evo].name} ≥ 2`);
  setUI(`<div class="overlay"><h2>Pause</h2><div class="build">${build}</div>
    ${hints.length ? `<div class="muted">${hints.join('<br>')}</div>` : '<div class="muted">Tipp: Waffen auf Stufe 5 + passende Gabe auf Stufe 2 = ERWACHEN.</div>'}
    <div class="col"><button class="btn" data-a="resume">Weiter</button><button class="btn alt" data-a="mute">${save.muted ? '🔇 Ton aus' : '🔊 Ton an'}</button><button class="btn alt" data-a="quit">Aufgeben</button></div></div>`);
}
function awardRun(extra = 0) {
  const base = Math.floor(G.coins) + Math.floor(G.kills / 15) + extra;
  save.funken += base; save.totalKills += G.kills; save.runs++;
  persist();
  return base;
}
function statsHTML() {
  return `<div class="stats"><div>Zeit <b>${fmtTime(G.t)}</b></div><div>Level <b>${G.p.level}</b></div><div>Schatten <b>${G.kills}</b></div><div>Beste Combo <b>${G.bestCombo}</b></div></div>`;
}
function chapterWon() {
  const i = G.ch, first = save.done === i;
  const bonus = (60 + 40 * i) * (first ? 2 : 1);
  if (first) save.done = i + 1;
  if (!save.best[i] || G.t < save.best[i]) save.best[i] = Math.floor(G.t);
  const got = awardRun(bonus);
  state = 'over'; showPauseBtn(false);
  const results = () => {
    state = 'over';
    const next = i + 1 < 5;
    setUI(`<div class="overlay"><h2>${CHAPTERS[i].name} befreit!</h2>
      <div class="sub">${first ? 'Scherbe ' + (i + 1) + ' von 5 geborgen.' : 'Erneut befreit.'}</div>
      ${statsHTML()}
      <div class="reward">+${got} ✦ Funken</div>
      ${first && i === 0 ? '<div class="hint">🌑 Neu freigeschaltet: Ewige Nacht!</div>' : ''}
      <div class="col">
        ${next ? `<button class="btn" data-a="chapter" data-i="${i + 1}">Weiter: ${CHAPTERS[i + 1].name} ▸</button>` : '<button class="btn" data-a="endless">🌑 Ewige Nacht</button>'}
        <button class="btn alt" data-a="shop2">Seelenschmiede${affordable() ? '<span class="badge">!</span>' : ''}</button>
        <button class="btn alt" data-a="map">Karte</button>
      </div></div>`);
  };
  showDialog(CHAPTERS[i].post, results);
}
function runLost() {
  state = 'over'; showPauseBtn(false);
  let hint = '';
  if (G.mode === 'endless') {
    const rec = G.t > save.endlessBest; if (rec) save.endlessBest = Math.floor(G.t);
    hint = rec ? '🏆 NEUER REKORD!' : 'Rekord: ' + fmtTime(save.endlessBest) + ' – nur noch ' + fmtTime(save.endlessBest - G.t) + '!';
  } else if (G.boss) hint = `${G.boss.def.name} hatte nur noch ${Math.max(1, Math.ceil(G.boss.hp / G.boss.maxHp * 100))} % Leben!`;
  else hint = `Nur noch ${fmtTime(G.nextBoss - G.t)} bis zum Boss!`;
  const got = awardRun();
  setUI(`<div class="overlay"><h2 class="bad">Dein Licht erlischt …</h2>
    <div class="sub">${G.mode === 'endless' ? 'Die Ewige Nacht verschluckt dich.' : 'Aber ein Funke gibt nie auf.'}</div>
    ${statsHTML()}
    <div class="hint">${hint}</div>
    <div class="reward">+${got} ✦ Funken</div>
    <div class="col">
      <button class="btn" data-a="retry">Nochmal!</button>
      <button class="btn alt" data-a="shop2">Seelenschmiede${affordable() ? '<span class="badge">Upgrade bereit!</span>' : ''}</button>
      <button class="btn alt" data-a="map">Karte</button>
    </div></div>`);
}

// ------------------------------------------------------------
//  UI actions
// ------------------------------------------------------------
let lastRun = { mode: 'chapter', ch: 0 };
const actions = {
  map: () => { if (save.done === 0 && !save.seenIntro) startChapter(0); else chapterMap(); },
  menu: () => mainMenu(),
  go3d: () => { location.href = '3d/'; },
  shop: () => shopScreen('menu'),
  shop2: () => shopScreen('back2'),
  back2: () => chapterMap(),
  endless: () => { lastRun = { mode: 'endless', ch: 0 }; startEndless(); },
  chapter: b => { const i = +b.dataset.i; lastRun = { mode: 'chapter', ch: i }; startChapter(i); },
  retry: () => lastRun.mode === 'endless' ? startEndless() : startChapterQuick(lastRun.ch),
  intro: () => showDialog(INTRO, chapterMap),
  buy: b => {
    const m = META.find(m => m.id === b.dataset.id), l = metaLvl(m.id), c = metaCost(m, l);
    if (l >= m.max || save.funken < c) return;
    save.funken -= c; save.meta[m.id] = l + 1; persist(); Snd.play('level');
    const back = ui.querySelector('.topbar [data-a]').dataset.a;
    shopScreen(back);
  },
  mute: () => { Snd.setMuted(!save.muted); if (state === 'pause') { state = 'play'; pauseGame(); } else mainMenu(); },
  closeToast: b => { b.closest('.toast').remove(); },
  resume: () => resume(),
  quit: () => { G.over = true; runLost(); },
  pick: b => chooseCard(+b.dataset.i),
  reroll: () => { if (G.rerolls > 0) { G.rerolls--; showLevelUpNoSound(); } },
  dlgnext: () => nextLine(),
  dlgskip: () => skipDialog(),
};
function showLevelUpNoSound() { const m = save.muted; save.muted = true; showLevelUp(); save.muted = m; }
function startChapterQuick(i) {
  // retry skips the pre-chapter dialog – straight back into the action
  newRun('chapter', i);
  banner(CHAPTERS[i].name.toUpperCase(), 'Versuch Nr. ' + (save.runs + 1), CHAPTERS[i].accent, 2.5);
  resume();
}
ui.addEventListener('click', e => {
  Snd.init();
  const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
  e.stopPropagation();
  const a = b.dataset.a;
  if (a !== 'dlgnext' && a !== 'pick') Snd.play('click');
  if (actions[a]) actions[a](b);
});
function onKey(e) {
  if (state === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) { pauseGame(); return; }
  if (state === 'pause' && (e.code === 'Escape' || e.code === 'KeyP')) { resume(); return; }
  if (state === 'dialog' && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); nextLine(); return; }
  if (state === 'dialog' && e.code === 'Escape') { skipDialog(); return; }
  if (state === 'levelup') {
    const n = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }[e.code];
    if (n !== undefined) chooseCard(n);
    if (e.code === 'KeyR') actions.reroll();
  }
}

// ============================================================
//  LOOP
// ============================================================
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (state === 'play' && G) {
    update(dt);
    Snd.music(theme(), !!G.boss);
  }
  render(dt);
  requestAnimationFrame(frame);
}
mainMenu();
requestAnimationFrame(frame);

// debug / test hook
window.__lumen = { get G() { return G; }, get state() { return state; }, get save() { return save; }, update, actions, startChapter, startEndless, spawnBoss: () => spawnBoss() };
})();
