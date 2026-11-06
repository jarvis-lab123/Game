import { Chess } from '../vendor/chess.js';
import { Engine, MATE } from './engine.js';
import { Board } from './board.js';
import { RANKS, RP_MAX, rankOf, pointsFor, eloFromAccuracy, rankForElo, configureBot, botMove } from './ranks.js';
import { analyseGame, coachSummary, CLASSES, CLASS_ORDER } from './analysis.js';
import { bookInfo } from './openings.js';
import { play, sound } from './sound.js';
import { PUZZLES } from './puzzles.js';

// ================= Zustand =================
const KEY = 'claudechess.v1';
const DEFAULT = {
  placed: false, rank: 1, rp: 0, bestRank: 1, beatClaude: false,
  puzzleRating: 800, puzzleStreak: 0, puzzleBestStreak: 0, sprintBest: 0, solved: {}, puzzlesDone: 0,
  stats: { games: 0, wins: 0, draws: 0, losses: 0 },
  history: [], current: null,
  settings: { theme: 'walnut', sound: true, depth: 13, color: 'random', evalbar: true },
};
let S = load();
function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) return { ...DEFAULT, ...s, settings: { ...DEFAULT.settings, ...s.settings }, stats: { ...DEFAULT.stats, ...s.stats } }; } catch {}
  return structuredClone(DEFAULT);
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { // Speicher voll: alte Analysen entfernen
  S.history.forEach((h, i) => { if (i > 5) delete h.an; }); try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} } }
sound.on = S.settings.sound;
document.documentElement.dataset.theme = S.settings.theme;

const playEng = new Engine();
const anaEng = new Engine();
playEng.start(); anaEng.start();

const $ = (s, r = document) => r.querySelector(s);
const app = $('#app');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const wpOf = cp => 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * Math.max(-1500, Math.min(1500, cp)))) - 1);

// ================= UI-Bausteine =================
function emblem(rankId, size = 64, extra = '') {
  const r = rankOf(rankId);
  const id = 'g' + rankId + Math.random().toString(36).slice(2, 6);
  const inner = r.boss
    ? `<path d="M50 24 L56 44 L76 50 L56 56 L50 76 L44 56 L24 50 L44 44 Z" fill="#fff" opacity=".95"/>`
    : `<text x="50" y="62" text-anchor="middle" font-size="${rankId >= 10 ? 30 : 34}" font-weight="900" fill="#fff" font-family="inherit" style="paint-order:stroke" stroke="rgba(0,0,0,.25)" stroke-width="3">${rankId}</text>`;
  const wings = rankId >= 11 ? `<path d="M10 40 Q2 55 14 70 L22 60 Z M90 40 Q98 55 86 70 L78 60 Z" fill="url(#${id})" opacity=".85"/>` : '';
  const crown = rankId >= 13 ? `<path d="M34 12 L40 20 L50 8 L60 20 L66 12 L64 26 L36 26 Z" fill="#ffd76a" stroke="#b8860b" stroke-width="1.5"/>` : '';
  return `<svg class="emblem ${r.boss ? 'boss' : ''} ${extra}" width="${size}" height="${size}" viewBox="0 0 100 100" aria-label="Rang ${rankId}">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${r.color}"/><stop offset="1" stop-color="${r.color2}"/></linearGradient></defs>
    ${wings}
    <path d="M50 14 L82 30 L82 64 L50 90 L18 64 L18 30 Z" fill="url(#${id})" stroke="rgba(255,255,255,.55)" stroke-width="2.5"/>
    <path d="M50 22 L74 34 L74 61 L50 81 L26 61 L26 34 Z" fill="none" stroke="rgba(255,255,255,.25)" stroke-width="1.5"/>
    ${inner}${crown}
  </svg>`;
}

function totalPoints() { return (S.rank - 1) * RP_MAX + Math.max(0, Math.min(RP_MAX, S.rp)); }

function modal(html, { cls = '', dismiss = true } = {}) {
  const m = $('#modal');
  m.innerHTML = `<div class="modal-bg"></div><div class="modal-card ${cls}">${html}</div>`;
  m.classList.add('show');
  if (dismiss) $('.modal-bg', m).onclick = closeModal;
  return $('.modal-card', m);
}
function closeModal() { const m = $('#modal'); m.classList.remove('show'); m.innerHTML = ''; }

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

function confetti(colors = ['#ff8a5c', '#ffd76a', '#7ec24a', '#5b9cf5', '#f472b6', '#1bc6c0']) {
  const c = $('#confetti'); const ctx = c.getContext('2d');
  c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio;
  const P = Array.from({ length: 160 }, () => ({ x: Math.random() * c.width, y: -Math.random() * c.height * 0.5, vx: (Math.random() - .5) * 6, vy: 3 + Math.random() * 6, r: 4 + Math.random() * 7, a: Math.random() * 6, va: (Math.random() - .5) * .3, col: colors[Math.floor(Math.random() * colors.length)] }));
  let f = 0;
  (function tick() {
    ctx.clearRect(0, 0, c.width, c.height);
    for (const p of P) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.06; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.col;
      ctx.fillRect(-p.r * devicePixelRatio / 2, -p.r * devicePixelRatio / 4, p.r * devicePixelRatio, p.r * devicePixelRatio / 2); ctx.restore();
    }
    if (++f < 260) requestAnimationFrame(tick); else ctx.clearRect(0, 0, c.width, c.height);
  })();
}

function topbar(title, back = 'home', right = '') {
  return `<header class="topbar"><button class="icon-btn" data-go="${back}" aria-label="Zurück">‹</button><h2>${title}</h2><div class="tb-right">${right}</div></header>`;
}
function bindNav(root = app) {
  root.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { play('click'); go(b.dataset.go); });
}

function go(screen, arg) {
  stopTimers();
  window.scrollTo(0, 0);
  ({ home, ranks: ranksScreen, puzzles: puzzleScreen, history: historyScreen, settings: settingsScreen, onboarding, free: freeScreen }[screen] || home)(arg);
}
let timers = [];
function stopTimers() { timers.forEach(clearInterval); timers = []; document.onkeydown = null; }

// ================= Startseite =================
function home() {
  if (!S.placed) return onboarding();
  const r = rankOf(S.rank);
  const pct = Math.max(0, Math.min(100, S.rp));
  const cur = S.current;
  app.innerHTML = `
  <div class="screen home">
    <header class="brand">
      <div class="logo"><span class="spark">✦</span> Claude <b>Chess</b></div>
      <button class="icon-btn" data-go="settings" aria-label="Einstellungen">⚙︎</button>
    </header>

    <section class="rank-card" style="--c1:${r.color};--c2:${r.color2}">
      <div class="rank-glow"></div>
      <div class="rank-top">
        ${emblem(S.rank, 92, 'float')}
        <div class="rank-info">
          <div class="muted small">Dein Rang</div>
          <div class="rank-name">${esc(r.tier)}</div>
          <div class="rank-sub">Rang ${S.rank} / 15 · ca. ${r.elo} Elo</div>
        </div>
      </div>
      <div class="rp-row"><span>${S.rank === 15 && S.beatClaude ? 'Claude Chess besiegt 👑' : 'Rangpunkte'}</span><b>${pct} / ${RP_MAX}</b></div>
      <div class="bar"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div class="rank-foot"><span>Gesamt: <b>${totalPoints()}</b> / ${15 * RP_MAX} Punkte</span><button class="link" data-go="ranks">Alle Ränge ›</button></div>
    </section>

    ${cur ? `<button class="big-btn resume" id="resume"><span class="bb-icon">⏵</span><span><b>Partie fortsetzen</b><small>gegen ${esc(rankOf(cur.rank).bot)} · Zug ${Math.floor(cur.ucis.length / 2) + 1}</small></span></button>` : ''}

    <section class="opponent card">
      <div class="opp-avatar" style="--c1:${r.color};--c2:${r.color2}">${r.avatar}</div>
      <div class="opp-text">
        <div class="muted small">Nächster Gegner</div>
        <div class="opp-name">${esc(r.bot)} <span class="elo">${r.boss ? '∞' : r.elo}</span></div>
        <div class="muted small">${esc(r.style)}</div>
      </div>
    </section>

    <div class="color-pick" role="radiogroup" aria-label="Farbe">
      ${[['w', '♔ Weiß'], ['random', '⚄ Zufall'], ['b', '♚ Schwarz']].map(([v, l]) => `<button class="chip ${S.settings.color === v ? 'on' : ''}" data-color="${v}">${l}</button>`).join('')}
    </div>
    <button class="big-btn primary" id="playRanked"><span class="bb-icon">⚔</span><span><b>Ranglisten-Partie</b><small>Sieg +32…50 · Niederlage −6…22 Punkte</small></span></button>

    <div class="grid2">
      <button class="tile" data-go="puzzles"><span class="tile-ic">🧩</span><b>Puzzles</b><small>Wertung ${Math.round(S.puzzleRating)}</small></button>
      <button class="tile" data-go="free"><span class="tile-ic">♞</span><b>Freies Spiel</b><small>Mit Hinweisen</small></button>
      <button class="tile" data-go="history"><span class="tile-ic">📈</span><b>Analysen</b><small>${S.history.length} Partien</small></button>
      <button class="tile" data-go="ranks"><span class="tile-ic">🏆</span><b>Ränge</b><small>Bester: ${rankOf(S.bestRank).tier}</small></button>
    </div>
    <div class="stats-line muted small">${S.stats.games} Partien · ${S.stats.wins} Siege · ${S.stats.draws} Remis · ${S.stats.losses} Niederlagen</div>
  </div>`;
  bindNav();
  app.querySelectorAll('[data-color]').forEach(b => b.onclick = () => { S.settings.color = b.dataset.color; save(); home(); });
  $('#playRanked').onclick = () => {
    if (S.current && !confirm('Die laufende Partie wird als Niederlage gewertet. Neue Partie starten?')) return;
    if (S.current) forfeitCurrent();
    startGame({ mode: 'ranked', rank: S.rank });
  };
  if (cur) $('#resume').onclick = () => startGame(cur);
}

function forfeitCurrent() {
  const c = S.current; S.current = null;
  if (c && c.mode === 'ranked') { applyPoints(0, null); S.stats.games++; S.stats.losses++; }
  save();
}

// ================= Einstufung =================
function onboarding() {
  app.innerHTML = `
  <div class="screen onboarding">
    <div class="ob-hero">
      <div class="ob-logo"><span class="spark big">✦</span></div>
      <h1>Claude <b>Chess</b></h1>
      <p>15 Ränge. Vom ersten Zug bis zur stärksten Schach-KI.<br>Nach jeder Partie analysiert dein Coach jeden Zug.</p>
    </div>
    <div class="ladder-preview">${RANKS.map(r => `<div class="lp" title="${esc(r.tier)}">${emblem(r.id, 34)}</div>`).join('')}</div>
    <div class="card">
      <h3>Wie gut spielst du schon?</h3>
      <p class="muted small">Danach spielst du eine Einstufungspartie. Aus deiner Genauigkeit und dem Ergebnis berechnen wir deinen Start-Rang.</p>
      <div class="ob-opts">
        ${[[2, '🌱', 'Anfänger', 'Ich kenne die Regeln'], [4, '♟', 'Gelegenheitsspieler', 'Ich spiele ab und zu'], [7, '♞', 'Vereinsspieler', 'Ich kenne Eröffnungen & Taktik'], [10, '♛', 'Experte', 'Turnierspieler, 1800+']]
          .map(([rk, ic, t, d]) => `<button class="ob-opt" data-rk="${rk}"><span class="ob-ic">${ic}</span><span><b>${t}</b><small>${d}</small></span><span class="chev">›</span></button>`).join('')}
      </div>
    </div>
  </div>`;
  app.querySelectorAll('.ob-opt').forEach(b => b.onclick = () => {
    const rk = +b.dataset.rk;
    const r = rankOf(rk);
    modal(`<div class="center">
      <div class="opp-avatar xl" style="--c1:${r.color};--c2:${r.color2}">${r.avatar}</div>
      <h3>Einstufungspartie</h3>
      <p>Du spielst gegen <b>${esc(r.bot)}</b> (ca. ${r.elo} Elo). Gib einfach dein Bestes – es zählt vor allem, <b>wie genau</b> du spielst.</p>
      <button class="big-btn primary" id="obGo"><span class="bb-icon">⚔</span><span><b>Los geht's</b></span></button></div>`);
    $('#obGo').onclick = () => { closeModal(); startGame({ mode: 'placement', rank: rk }); };
  });
}

// ================= Partie =================
let G = null; // laufende Partie

function startGame(cfg) {
  const color = cfg.playerColor || (S.settings.color === 'random' || cfg.mode === 'placement' ? (Math.random() < 0.5 ? 'w' : 'b') : S.settings.color);
  const chess = new Chess(cfg.startFen || undefined);
  const sans = [];
  for (const u of cfg.ucis || []) { const m = chess.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); sans.push(m.san); }
  G = { mode: cfg.mode, rank: cfg.rank, playerColor: color, chess, sans, ucis: [...(cfg.ucis || [])], startFen: cfg.startFen || null, over: false, token: Math.random(), hints: 0, undos: 0 };
  if (G.mode !== 'free') { S.current = { mode: G.mode, rank: G.rank, playerColor: color, ucis: G.ucis, startFen: G.startFen }; save(); }
  gameScreen();
  configureBot(playEng, G.rank).then(() => {
    play('start');
    nextTurn();
  });
}

function gameScreen() {
  const r = rankOf(G.rank);
  const free = G.mode === 'free';
  const title = G.mode === 'placement' ? 'Einstufung' : free ? 'Freies Spiel' : `Rang ${G.rank} · ${r.tier}`;
  app.innerHTML = `
  <div class="screen game">
    ${topbar(title, 'home', `<button class="icon-btn" id="flip" aria-label="Brett drehen">⇅</button>`)}
    <div class="game-layout">
      <div class="board-col">
        <div class="player-strip opp">
          <div class="opp-avatar sm ${G.rank === 15 ? 'boss-ring' : ''}" style="--c1:${r.color};--c2:${r.color2}">${r.avatar}</div>
          <div class="ps-name"><b>${esc(r.bot)}</b> <span class="elo">${r.boss ? '∞' : r.elo}</span><div class="captured" id="capOpp"></div></div>
          <div class="thinking" id="thinking"><span></span><span></span><span></span></div>
        </div>
        <div class="board-wrap">
          ${free && S.settings.evalbar ? `<div class="evalbar" id="evalbar"><div class="eb-fill"></div><span class="eb-label">0.0</span></div>` : ''}
          <div id="board"></div>
        </div>
        <div class="player-strip me">
          <div class="opp-avatar sm me-av">${S.placed ? emblem(S.rank, 30) : '🙂'}</div>
          <div class="ps-name"><b>Du</b> ${S.placed ? `<span class="elo">${rankOf(S.rank).tier}</span>` : ''}<div class="captured" id="capMe"></div></div>
          <div class="status" id="status"></div>
        </div>
      </div>
      <div class="side-col">
        <div class="opening-name muted small" id="opening"></div>
        <div class="movelist" id="moves"></div>
        <div class="engine-info muted small" id="engInfo"></div>
        <div class="actions">
          ${free ? `<button class="btn" id="hint">💡 Hinweis</button><button class="btn" id="undo">↶ Zurück</button>` : ''}
          <button class="btn danger" id="resign">⚑ Aufgeben</button>
        </div>
      </div>
    </div>
  </div>`;
  bindNav();
  const board = new Board($('#board'), { onMove: onPlayerMove });
  G.board = board;
  board.setOrientation(G.playerColor);
  const last = G.chess.history({ verbose: true }).slice(-1)[0];
  board.setPosition(G.chess, { animate: false, lastMove: last ? { from: last.from, to: last.to } : null });
  $('#flip').onclick = () => board.setOrientation(board.orientation === 'w' ? 'b' : 'w');
  $('#resign').onclick = () => {
    if (G.over) return;
    if (!confirm('Wirklich aufgeben?')) return;
    endGame(G.playerColor === 'w' ? '0-1' : '1-0', 'Aufgabe');
  };
  if (free) {
    $('#hint').onclick = showHint;
    $('#undo').onclick = undoMove;
  }
  renderMoves(); renderCaptured();
  // Zurück-Knopf: laufende Partie bleibt gespeichert
  $('.topbar [data-go]').onclick = () => { G.token = -1; playEng.stop(); go('home'); };
}

function renderMoves() {
  const el = $('#moves'); if (!el) return;
  let h = '';
  for (let i = 0; i < G.sans.length; i += 2) {
    h += `<div class="mv-row"><span class="mv-n">${i / 2 + 1}.</span><span class="mv">${esc(G.sans[i])}</span><span class="mv">${esc(G.sans[i + 1] || '')}</span></div>`;
  }
  el.innerHTML = h || '<div class="muted small center">Noch keine Züge</div>';
  el.scrollTop = el.scrollHeight;
  const bi = bookInfo(G.sans);
  $('#opening').textContent = bi.name ? '📖 ' + bi.name : '';
}

function renderCaptured() {
  const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9 };
  const start = { p: 8, n: 2, b: 2, r: 2, q: 1 };
  const cnt = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } };
  for (const row of G.chess.board()) for (const p of row) if (p && p.type !== 'k') cnt[p.color][p.type]++;
  let mat = { w: 0, b: 0 };
  const capStr = col => { // Figuren, die col geschlagen hat
    const opp = col === 'w' ? 'b' : 'w';
    let s = '';
    for (const t of ['q', 'r', 'b', 'n', 'p']) { const n = Math.max(0, start[t] - cnt[opp][t]); for (let i = 0; i < n; i++) s += `<i class="cp pc ${opp}${t.toUpperCase()}"></i>`; }
    return s;
  };
  for (const c of ['w', 'b']) for (const t in VAL) mat[c] += cnt[c][t] * VAL[t];
  const me = G.playerColor, opp = me === 'w' ? 'b' : 'w';
  const diff = mat[me] - mat[opp];
  const cm = $('#capMe'), co = $('#capOpp');
  if (cm) cm.innerHTML = capStr(me) + (diff > 0 ? `<span class="adv">+${diff}</span>` : '');
  if (co) co.innerHTML = capStr(opp) + (diff < 0 ? `<span class="adv">+${-diff}</span>` : '');
}

function moveSound(m) {
  if (G.chess.inCheck()) play('check');
  else if (m.promotion) play('promote');
  else if (m.flags.includes('k') || m.flags.includes('q')) play('castle');
  else if (m.captured) play('capture');
  else play('move');
}

function applyMove(uci) {
  const m = G.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  G.sans.push(m.san); G.ucis.push(uci);
  if (S.current && G.mode !== 'free') { S.current.ucis = G.ucis; save(); }
  G.board.setPosition(G.chess, { animate: true, lastMove: { from: m.from, to: m.to } });
  G.board.setArrows([]);
  moveSound(m);
  renderMoves(); renderCaptured();
  return m;
}

function onPlayerMove(from, to, promotion) {
  if (!G || G.over || G.chess.turn() !== G.playerColor) return;
  applyMove(from + to + (promotion || ''));
  nextTurn();
}

function checkEnd() {
  const c = G.chess;
  if (c.isCheckmate()) return [c.turn() === 'w' ? '0-1' : '1-0', 'Schachmatt'];
  if (c.isStalemate()) return ['1/2-1/2', 'Patt'];
  if (c.isInsufficientMaterial()) return ['1/2-1/2', 'Ungenügendes Material'];
  if (c.isThreefoldRepetition()) return ['1/2-1/2', 'Dreifache Stellungswiederholung'];
  if (c.isDrawByFiftyMoves()) return ['1/2-1/2', '50-Züge-Regel'];
  return null;
}

async function nextTurn() {
  if (!G || G.over) return;
  const end = checkEnd();
  if (end) return endGame(...end);
  updateEvalBar();
  if (G.chess.turn() === G.playerColor) {
    G.board.setInteractive(G.playerColor);
    setStatus('Du bist am Zug');
    $('#thinking')?.classList.remove('on');
    return;
  }
  G.board.setInteractive(null);
  setStatus('');
  $('#thinking')?.classList.add('on');
  const token = G.token;
  const t0 = performance.now();
  const r = rankOf(G.rank);
  const info = $('#engInfo');
  const onInfo = r.sf ? (line) => { if (info && G.rank >= 13) info.textContent = `${r.bot} rechnet: Tiefe ${line.depth} · ${line.pv.length} Halbzüge Variante`; } : null;
  let res;
  try {
    // onInfo nur für starke Bots (Anzeige der Rechentiefe)
    res = r.sf && onInfo ? await botMoveWithInfo(r, onInfo) : await botMove(playEng, G.chess, G.rank, G.sans);
  } catch (e) { console.error(e); return; }
  if (!G || token !== G.token || G.over) return;
  const minDelay = r.weak ? 350 + Math.random() * 600 : 250;
  const el = performance.now() - t0;
  if (el < minDelay) await sleep(minDelay - el);
  if (!G || token !== G.token || G.over) return;
  if (info) info.textContent = '';
  $('#thinking')?.classList.remove('on');
  if (!res || !res.uci) return;
  applyMove(res.uci);
  nextTurn();
}

async function botMoveWithInfo(r, onInfo) {
  const cfg = r.sf;
  if (G.sans.length < (cfg.book || 0)) {
    const b = await botMove(playEng, G.chess, G.rank, G.sans);
    if (b.book) return b;
    return b;
  }
  const res = await playEng.analyse(G.chess.fen(), { movetime: cfg.movetime, multipv: 1, onInfo });
  return { uci: res.best };
}

function setStatus(t) { const s = $('#status'); if (s) s.textContent = t; }

async function updateEvalBar() {
  const bar = $('#evalbar'); if (!bar || !G) return;
  const fen = G.chess.fen();
  const res = await anaEng.analyse(fen, { depth: 11 });
  if (!G || G.chess.fen() !== fen) return;
  const l = res.lines[0]; if (!l) return;
  const white = fen.split(' ')[1] === 'w' ? l.score : -l.score;
  setEvalBar(bar, white, l.mate != null ? (fen.split(' ')[1] === 'w' ? l.mate : -l.mate) : null, G.board.orientation);
}

function setEvalBar(bar, white, mateW, orient) {
  const pct = wpOf(white);
  bar.classList.toggle('flipped', orient === 'b');
  bar.querySelector('.eb-fill').style.height = pct + '%';
  const lab = bar.querySelector('.eb-label');
  lab.textContent = mateW != null && Math.abs(white) > MATE - 1000 ? (mateW === 0 ? '#' : 'M' + Math.abs(mateW)) : (Math.abs(white / 100)).toFixed(1);
  lab.classList.toggle('dark', white < 0);
}

async function showHint() {
  if (G.over || G.chess.turn() !== G.playerColor) return;
  G.hints++;
  const btn = $('#hint'); btn.disabled = true; btn.textContent = '💡 …';
  const res = await anaEng.analyse(G.chess.fen(), { depth: 16 });
  btn.disabled = false; btn.textContent = '💡 Hinweis';
  if (!res.best || G.chess.turn() !== G.playerColor) return;
  G.board.setArrows([{ from: res.best.slice(0, 2), to: res.best.slice(2, 4), color: '#5b9cf5' }]);
}

function undoMove() {
  if (G.over || G.ucis.length < 1) return;
  G.token = Math.random(); playEng.stop();
  const n = G.chess.turn() === G.playerColor ? 2 : 1;
  for (let i = 0; i < n && G.ucis.length; i++) { G.chess.undo(); G.ucis.pop(); G.sans.pop(); }
  G.undos++;
  const last = G.chess.history({ verbose: true }).slice(-1)[0];
  G.board.setPosition(G.chess, { animate: true, lastMove: last ? { from: last.from, to: last.to } : null });
  G.board.setArrows([]);
  $('#thinking')?.classList.remove('on');
  renderMoves(); renderCaptured();
  setTimeout(nextTurn, 200);
}

// ================= Partie-Ende, Analyse, Punkte =================
async function endGame(result, reason) {
  if (G.over) return;
  G.over = true; G.token = -1;
  playEng.stop();
  G.board.setInteractive(null);
  $('#thinking')?.classList.remove('on');
  const me = G.playerColor;
  const score = result === '1/2-1/2' ? 0.5 : (result === '1-0') === (me === 'w') ? 1 : 0;
  play(score === 1 ? 'win' : score === 0.5 ? 'draw' : 'lose');
  if (score === 1) confetti();
  const r = rankOf(G.rank);
  const head = score === 1 ? (G.rank === 15 ? 'Du hast Claude Chess besiegt!' : 'Sieg!') : score === 0.5 ? 'Remis' : 'Niederlage';
  const mode = G.mode;
  if (mode !== 'free') S.current = null;
  save();

  const record = { id: Date.now(), date: new Date().toISOString(), mode, rank: G.rank, bot: r.bot, playerColor: me, result, reason, score, moves: [...G.ucis], startFen: G.startFen };
  const card = modal(`
    <div class="result ${score === 1 ? 'win' : score === 0.5 ? 'draw' : 'loss'}">
      <div class="res-icon">${score === 1 ? '🏆' : score === 0.5 ? '🤝' : '🛡'}</div>
      <h2>${head}</h2>
      <div class="muted">${esc(reason)} · ${result}</div>
      <div class="an-progress" id="anProg">
        <div class="coach-row"><span class="coach-av">✦</span><span id="anText">Dein Coach analysiert die Partie …</span></div>
        <div class="bar"><div class="bar-fill" id="anBar" style="width:0%"></div></div>
      </div>
      <div id="resBody"></div>
    </div>`, { dismiss: false });

  const an = await analyseGame(anaEng, { startFen: G.startFen, moves: G.ucis }, {
    depth: S.settings.depth,
    onProgress: (d, t) => { const b = $('#anBar'); if (b) b.style.width = (d / t * 100) + '%'; const tx = $('#anText'); if (tx) tx.textContent = `Dein Coach analysiert Zug ${Math.ceil(d / 2)} von ${Math.ceil(t / 2)} …`; },
  });
  record.an = an;
  const acc = an.sides[me].accuracy;
  record.accuracy = acc; record.oppAccuracy = an.sides[me === 'w' ? 'b' : 'w'].accuracy;
  const perf = eloFromAccuracy(acc);
  record.perf = perf;
  let extra = '';

  if (mode === 'ranked') {
    S.stats.games++; S.stats[score === 1 ? 'wins' : score === 0.5 ? 'draws' : 'losses']++;
    const before = { rank: S.rank, rp: S.rp };
    const delta = applyPoints(score, acc);
    record.delta = delta;
    record.rankChange = lastRankChange;
    extra = pointsBlock(before, delta);
  } else if (mode === 'placement') {
    let est = perf;
    if (score === 1) est = Math.max(est, r.elo + 150);
    else if (score === 0.5) est = Math.max(est, r.elo - 50);
    else est = Math.min(est, r.elo + 100);
    if (G.ucis.length < 20 && score === 0) est = Math.min(est, r.elo - 200);
    const nr = rankForElo(est);
    S.placed = true; S.rank = nr; S.rp = 30; S.bestRank = Math.max(S.bestRank, nr);
    S.puzzleRating = Math.max(600, Math.min(2000, est));
    record.delta = 0;
    extra = `<div class="placed">${emblem(nr, 110, 'reveal')}<div class="muted small">Deine Einstufung</div><div class="rank-name">${esc(rankOf(nr).tier)}</div><div class="muted">Rang ${nr} von 15 · geschätzte Spielstärke ≈ ${est} Elo</div></div>`;
    setTimeout(() => { play('rankup'); confetti(); }, 300);
  }
  S.history.unshift(record);
  S.history = S.history.slice(0, 40);
  S.history.forEach((h, i) => { if (i >= 15) delete h.an; });
  save();

  $('#anProg').remove();
  $('#resBody').innerHTML = `
    <div class="acc-duo">
      <div><div class="acc-big" style="color:${accColor(acc)}">${acc.toFixed(1)}</div><div class="muted small">Deine Genauigkeit</div></div>
      <div><div class="acc-big dim">${record.oppAccuracy.toFixed(1)}</div><div class="muted small">${esc(r.bot)}</div></div>
    </div>
    <div class="muted small">Spielstärke dieser Partie ≈ <b>${perf}</b> Elo</div>
    ${extra}
    <div class="res-actions">
      <button class="big-btn primary" id="toReview"><span class="bb-icon">✦</span><span><b>Coach-Analyse ansehen</b><small>Jeder Zug bewertet & erklärt</small></span></button>
      <div class="row2">
        <button class="btn" id="again">${mode === 'free' ? 'Nochmal' : 'Nächste Partie'}</button>
        <button class="btn" id="toHome">Startseite</button>
      </div>
    </div>`;
  $('#toReview').onclick = () => { closeModal(); reviewScreen(record); };
  $('#again').onclick = () => { closeModal(); mode === 'free' ? startGame({ mode: 'free', rank: G.rank, playerColor: S.settings.color === 'random' ? null : S.settings.color }) : startGame({ mode: 'ranked', rank: S.rank }); };
  $('#toHome').onclick = () => { closeModal(); go('home'); };
  if (record.rankChange) setTimeout(() => rankChangeFx(record.rankChange), 900);
}

function accColor(a) { return a >= 90 ? '#7ec24a' : a >= 80 ? '#94c85a' : a >= 70 ? '#f2c94c' : a >= 55 ? '#f2994a' : '#ef4444'; }

let lastRankChange = null;
function applyPoints(score, acc) {
  const delta = pointsFor(score, acc, S.rank);
  S.rp += delta;
  lastRankChange = null;
  if (S.rp >= RP_MAX) {
    if (S.rank < 15) { S.rank++; S.rp = 20; lastRankChange = { dir: 'up', rank: S.rank }; S.bestRank = Math.max(S.bestRank, S.rank); }
    else { S.rp = RP_MAX; if (!S.beatClaude) { S.beatClaude = true; lastRankChange = { dir: 'champion', rank: 15 }; } }
  } else if (S.rp < 0) {
    if (S.rank > 1) { S.rank--; S.rp = 70; lastRankChange = { dir: 'down', rank: S.rank }; }
    else S.rp = 0;
  }
  return delta;
}

function pointsBlock(before, delta) {
  const r = rankOf(S.rank);
  return `<div class="points ${delta >= 0 ? 'up' : 'down'}">
    <div class="pts-delta">${delta >= 0 ? '+' : ''}${delta} <small>Rangpunkte</small></div>
    <div class="pts-rank">${emblem(S.rank, 40)}<div><b>${esc(r.tier)}</b><div class="bar"><div class="bar-fill anim" style="--w:${Math.max(0, S.rp)}%"></div></div><div class="muted small">${S.rp} / ${RP_MAX}</div></div></div>
  </div>`;
}

function rankChangeFx(rc) {
  const r = rankOf(rc.rank);
  const fx = document.createElement('div');
  fx.className = 'rank-fx ' + rc.dir;
  fx.style.setProperty('--c1', r.color); fx.style.setProperty('--c2', r.color2);
  const title = rc.dir === 'up' ? 'Aufgestiegen!' : rc.dir === 'down' ? 'Abgestiegen' : 'Claude Chess besiegt!';
  const sub = rc.dir === 'champion' ? 'Du hast die höchste Punktzahl erreicht und die stärkste Stufe bezwungen. Legendär.' : rc.dir === 'up' ? `Willkommen in ${r.tier}. Dein nächster Gegner: ${r.bot}.` : `Zurück nach ${r.tier}. Hol dir den Rang zurück!`;
  fx.innerHTML = `<div class="rfx-rays"></div><div class="rfx-inner">${rc.dir === 'champion' ? '<div class="crown">👑</div>' : ''}${emblem(rc.rank, 150, 'reveal')}<h1>${title}</h1><div class="rfx-tier">${esc(r.tier)}</div><p>${esc(sub)}</p><button class="big-btn primary"><span><b>Weiter</b></span></button></div>`;
  document.body.appendChild(fx);
  play(rc.dir === 'down' ? 'rankdown' : 'rankup');
  if (rc.dir !== 'down') { confetti([r.color, r.color2, '#ffffff', '#ffd76a']); if (rc.dir === 'champion') setTimeout(() => confetti(), 1200); }
  fx.querySelector('button').onclick = () => fx.remove();
}

// ================= Coach-Analyse =================
function reviewScreen(rec) {
  if (!rec.an) return reanalyse(rec);
  const an = rec.an;
  const me = rec.playerColor, opp = me === 'w' ? 'b' : 'w';
  const r = rankOf(rec.rank);
  const sum = coachSummary(an, me, rec.score);
  let ply = 0; // 0 = Startstellung, n = nach Zug n
  let showBest = true;

  app.innerHTML = `
  <div class="screen review">
    ${topbar('Coach-Analyse', 'history', `<button class="icon-btn" id="flip" aria-label="Brett drehen">⇅</button>`)}
    <div class="game-layout">
      <div class="board-col">
        <div class="board-wrap">
          <div class="evalbar" id="evalbar"><div class="eb-fill"></div><span class="eb-label">0.0</span></div>
          <div id="board"></div>
        </div>
        <div class="coach-bubble" id="coach"></div>
        <div class="nav-row">
          <button class="btn icon" id="first">⏮</button><button class="btn icon" id="prev">◀</button>
          <button class="btn icon" id="bestT" title="Besten Zug zeigen">★</button>
          <button class="btn icon" id="next">▶</button><button class="btn icon" id="last">⏭</button>
        </div>
        <div class="nav-row">
          <button class="btn small" id="prevErr">‹ Fehler</button>
          <button class="btn small" id="nextErr">Fehler ›</button>
        </div>
      </div>
      <div class="side-col">
        <div class="card summary">
          <div class="sum-head">
            <div class="sum-player"><div class="opp-avatar sm me-av">${emblem(S.rank, 30)}</div><div><b>Du</b><div class="acc-big" style="color:${accColor(an.sides[me].accuracy)}">${an.sides[me].accuracy.toFixed(1)}</div></div></div>
            <div class="sum-vs muted">Genauigkeit</div>
            <div class="sum-player right"><div><b>${esc(r.bot)}</b><div class="acc-big dim">${an.sides[opp].accuracy.toFixed(1)}</div></div><div class="opp-avatar sm" style="--c1:${r.color};--c2:${r.color2}">${r.avatar}</div></div>
          </div>
          <div class="perf muted small">Spielstärke dieser Partie ≈ <b>${eloFromAccuracy(an.sides[me].accuracy)}</b> · Gegner ≈ <b>${eloFromAccuracy(an.sides[opp].accuracy)}</b>${an.opening ? ` · 📖 ${esc(an.opening)}` : ''}</div>
          <div class="graph" id="graph"></div>
          <div class="coach-sum"><span class="coach-av">✦</span><div><p>${esc(sum.text)}</p>${sum.tips.map(t => `<p class="tip">💡 ${esc(t)}</p>`).join('')}</div></div>
          <table class="cls-table">
            ${CLASS_ORDER.map(k => `<tr><td class="ct-n">${an.sides[me].counts[k]}</td><td><span class="cls-badge" style="background:${CLASSES[k].color}">${CLASSES[k].sym}</span> ${CLASSES[k].label}</td><td class="ct-n dim">${an.sides[opp].counts[k]}</td></tr>`).join('')}
          </table>
          <div class="phases">${['opening', 'middlegame', 'endgame'].map(p => { const v = an.sides[me].phaseAcc[p]; return `<div class="phase"><div class="muted small">${{ opening: 'Eröffnung', middlegame: 'Mittelspiel', endgame: 'Endspiel' }[p]}</div><div class="ph-v" style="color:${v == null ? 'inherit' : accColor(v)}">${v == null ? '–' : v >= 85 ? '👍' : v >= 65 ? '👌' : '👎'}</div><div class="muted small">${v == null ? '' : v + ' %'}</div></div>`; }).join('')}</div>
        </div>
        <div class="movelist review-moves" id="moves"></div>
      </div>
    </div>
  </div>`;
  bindNav();
  const board = new Board($('#board'), {});
  board.setOrientation(me);
  $('#flip').onclick = () => { board.setOrientation(board.orientation === 'w' ? 'b' : 'w'); update(false); };

  // Zugliste
  let mh = '';
  for (let i = 0; i < an.moves.length; i += 2) {
    const cell = j => { const x = an.moves[j]; if (!x) return '<span class="mv"></span>'; const c = CLASSES[x.cls]; return `<span class="mv cls-${x.cls}" data-ply="${j + 1}"><i class="dotc" style="background:${c.color}" title="${c.label}">${['book', 'best', 'excellent', 'good'].includes(x.cls) ? '' : c.sym}</i>${esc(x.san)}</span>`; };
    mh += `<div class="mv-row"><span class="mv-n">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}</div>`;
  }
  $('#moves').innerHTML = mh;
  $('#moves').querySelectorAll('[data-ply]').forEach(e => e.onclick = () => { ply = +e.dataset.ply; update(); });

  // Bewertungsgraph
  drawGraph($('#graph'), an, me, p => { ply = p; update(); });

  function update(animate = true) {
    const ch = new Chess(an.fens[ply]);
    const x = an.moves[ply - 1];
    board.setPosition(ch, { animate, lastMove: x ? { from: x.from, to: x.to } : null });
    if (x) { const c = CLASSES[x.cls]; board.setMarker(x.to, c.sym, c.color); } else board.setMarker(null);
    // Pfeil: bester Zug in der Stellung VOR dem Zug (wenn nicht gespielt)
    const arrows = [];
    if (showBest && x && x.best && x.best !== x.uci && !['book', 'best'].includes(x.cls)) arrows.push({ from: x.best.slice(0, 2), to: x.best.slice(2, 4), color: '#7ec24a', opacity: 0.8 });
    board.setArrows(arrows);
    const white = ply === 0 ? 20 : an.whiteEval[ply];
    const mw = ply === 0 ? null : an.whiteMate[ply];
    setEvalBar($('#evalbar'), white, mw, board.orientation);
    // Coach-Blase
    const co = $('#coach');
    if (!x) co.innerHTML = `<span class="coach-av">✦</span><div><b>Startstellung</b><p>Tippe auf ▶ oder einen Zug, um die Partie mit deinem Coach durchzugehen.</p></div>`;
    else {
      const c = CLASSES[x.cls];
      const who = x.color === me ? 'Dein Zug' : esc(r.bot);
      const ev = mw != null && Math.abs(white) > MATE - 1000 ? (mw === 0 ? 'Matt' : (white > 0 ? '+M' : '−M') + Math.abs(mw)) : (white >= 0 ? '+' : '−') + Math.abs(white / 100).toFixed(1);
      co.innerHTML = `<span class="coach-av" style="background:${c.color}">${c.sym}</span><div><div class="cb-head"><b style="color:${c.color}">${Math.floor((ply - 1) / 2) + 1}${x.color === 'w' ? '.' : '…'} ${esc(x.san)} – ${c.label}</b><span class="cb-eval">${ev}</span></div><div class="muted small">${who}</div><p>${esc(x.comment)}</p>${x.bestLine.length && !['book', 'best'].includes(x.cls) ? `<p class="small muted">Engine-Variante: ${esc(x.bestLine.join(' '))}</p>` : ''}</div>`;
      co.classList.remove('pop'); void co.offsetWidth; co.classList.add('pop');
      if (animate) {
        const prevCh = new Chess(an.fens[ply - 1]);
        const mm = prevCh.move(x.san);
        if (mm) { if (ch.inCheck()) play('check'); else if (mm.captured) play('capture'); else play('move'); }
      }
    }
    $('#moves').querySelectorAll('.mv.cur').forEach(e => e.classList.remove('cur'));
    const cur = $(`#moves [data-ply="${ply}"]`); if (cur) { cur.classList.add('cur'); const box = $('#moves'); const t = cur.offsetTop - box.offsetTop; if (t < box.scrollTop || t > box.scrollTop + box.clientHeight - 30) box.scrollTop = t - box.clientHeight / 2; }
    $('#graph .g-cursor')?.setAttribute('x1', ply * (600 / Math.max(1, an.moves.length)));
    $('#graph .g-cursor')?.setAttribute('x2', ply * (600 / Math.max(1, an.moves.length)));
  }
  const N = an.moves.length;
  const isErr = k => ['inaccuracy', 'mistake', 'blunder', 'miss', 'brilliant', 'great'].includes(k);
  $('#first').onclick = () => { ply = 0; update(false); };
  $('#prev').onclick = () => { if (ply > 0) { ply--; update(false); } };
  $('#next').onclick = () => { if (ply < N) { ply++; update(); } };
  $('#last').onclick = () => { ply = N; update(false); };
  $('#bestT').onclick = () => { showBest = !showBest; $('#bestT').classList.toggle('on', showBest); update(false); };
  $('#bestT').classList.add('on');
  $('#nextErr').onclick = () => { for (let p = ply + 1; p <= N; p++) { const x = an.moves[p - 1]; if (x.color === me && isErr(x.cls)) { ply = p; return update(); } } toast('Keine weiteren Schlüsselmomente'); };
  $('#prevErr').onclick = () => { for (let p = ply - 1; p >= 1; p--) { const x = an.moves[p - 1]; if (x.color === me && isErr(x.cls)) { ply = p; return update(false); } } toast('Keine früheren Schlüsselmomente'); };
  document.onkeydown = e => { if (e.key === 'ArrowRight') $('#next').click(); if (e.key === 'ArrowLeft') $('#prev').click(); if (e.key === 'Home') $('#first').click(); if (e.key === 'End') $('#last').click(); };
  update(false);
}

function drawGraph(el, an, me, onPick) {
  const W = 600, H = 120, n = Math.max(1, an.moves.length);
  const ys = [20, ...an.whiteEval.slice(1)].map(v => H - (wpOf(v) / 100) * H);
  let d = `M0 ${H} `;
  ys.forEach((y, i) => { d += `L${(i * W / n).toFixed(1)} ${y.toFixed(1)} `; });
  d += `L${W} ${H} Z`;
  let line = '';
  ys.forEach((y, i) => { line += `${i ? 'L' : 'M'}${(i * W / n).toFixed(1)} ${y.toFixed(1)} `; });
  let dots = '';
  an.moves.forEach((x, i) => {
    if (!['brilliant', 'great', 'blunder', 'mistake', 'miss', 'inaccuracy'].includes(x.cls)) return;
    dots += `<circle cx="${((i + 1) * W / n).toFixed(1)}" cy="${ys[i + 1].toFixed(1)}" r="${x.color === me ? 5 : 3.5}" fill="${CLASSES[x.cls].color}" stroke="#111" stroke-width="1.2" opacity="${x.color === me ? 1 : .6}"/>`;
  });
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <rect width="${W}" height="${H}" fill="#2a2a33"/>
    <path d="${d}" fill="#e9e6df"/>
    <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="#888" stroke-width="1" stroke-dasharray="4 4" opacity=".6"/>
    <path d="${line}" fill="none" stroke="#ff8a5c" stroke-width="1.5" opacity=".7"/>
    <line class="g-cursor" x1="0" y1="0" x2="0" y2="${H}" stroke="#ff8a5c" stroke-width="2"/>
    ${dots}
  </svg>`;
  const svg = el.querySelector('svg');
  const pick = e => { const b = svg.getBoundingClientRect(); const p = Math.round((e.clientX - b.left) / b.width * n); onPick(Math.max(0, Math.min(n, p))); };
  svg.addEventListener('pointerdown', e => { pick(e); svg.setPointerCapture(e.pointerId); svg.onpointermove = pick; });
  svg.addEventListener('pointerup', () => svg.onpointermove = null);
}

async function reanalyse(rec) {
  modal(`<div class="center"><div class="coach-row"><span class="coach-av">✦</span><span id="anText">Analyse wird erstellt …</span></div><div class="bar"><div class="bar-fill" id="anBar" style="width:0%"></div></div></div>`, { dismiss: false });
  rec.an = await analyseGame(anaEng, { startFen: rec.startFen, moves: rec.moves }, { depth: S.settings.depth, onProgress: (d, t) => { const b = $('#anBar'); if (b) b.style.width = (d / t * 100) + '%'; } });
  save(); closeModal(); reviewScreen(rec);
}

// ================= Verlauf =================
function historyScreen() {
  app.innerHTML = `<div class="screen">${topbar('Analysen')}
    <div class="list">${S.history.length ? S.history.map((h, i) => {
      const r = rankOf(h.rank);
      const res = h.score === 1 ? 'win' : h.score === 0.5 ? 'draw' : 'loss';
      const d = new Date(h.date);
      return `<button class="hist-item" data-i="${i}">
        <div class="opp-avatar sm" style="--c1:${r.color};--c2:${r.color2}">${r.avatar}</div>
        <div class="hi-main"><b>${esc(r.bot)}</b> <span class="muted small">${h.mode === 'ranked' ? 'Rang ' + h.rank : h.mode === 'placement' ? 'Einstufung' : 'Frei'}</span>
          <div class="muted small">${d.toLocaleDateString('de-DE')} · ${h.reason} · ${Math.ceil(h.moves.length / 2)} Züge</div></div>
        <div class="hi-right"><span class="res-pill ${res}">${res === 'win' ? 'Sieg' : res === 'draw' ? 'Remis' : 'Niederl.'}</span>
          <div class="small" style="color:${accColor(h.accuracy || 0)}">${h.accuracy != null ? h.accuracy.toFixed(1) + ' %' : ''}</div>
          ${h.delta ? `<div class="small ${h.delta > 0 ? 'pos' : 'neg'}">${h.delta > 0 ? '+' : ''}${h.delta}</div>` : ''}</div>
      </button>`;
    }).join('') : '<div class="empty muted">Noch keine Partien. Spiel deine erste Ranglisten-Partie!</div>'}</div></div>`;
  bindNav();
  app.querySelectorAll('.hist-item').forEach(b => b.onclick = () => reviewScreen(S.history[+b.dataset.i]));
}

// ================= Ränge =================
function ranksScreen() {
  app.innerHTML = `<div class="screen">${topbar('Die 15 Ränge')}
    <p class="muted small pad">Sammle ${RP_MAX} Rangpunkte, um aufzusteigen. Fällst du unter 0, steigst du ab. Erreichst du auf Rang 15 die volle Punktzahl, hast du Claude Chess besiegt.</p>
    <div class="ladder">${[...RANKS].reverse().map(r => {
      const state = r.id === S.rank ? 'cur' : r.id < S.rank ? 'done' : 'locked';
      return `<div class="ladder-item ${state} ${r.boss ? 'boss' : ''}" style="--c1:${r.color};--c2:${r.color2}">
        ${emblem(r.id, 54)}
        <div class="li-main"><b>${esc(r.tier)}</b> <span class="muted small">Rang ${r.id}</span>
          <div class="small">${r.avatar} ${esc(r.bot)} · ${r.boss ? 'maximale Stärke' : 'ca. ' + r.elo + ' Elo'}</div>
          <div class="muted small">${esc(r.style)}</div>
          ${state === 'cur' ? `<div class="bar sm"><div class="bar-fill" style="width:${S.rp}%"></div></div>` : ''}</div>
        <div class="li-state">${state === 'done' ? '✓' : state === 'cur' ? '●' : '🔒'}</div>
        ${state !== 'locked' ? `<button class="btn small li-play" data-rk="${r.id}">Üben</button>` : ''}
      </div>`;
    }).join('')}</div></div>`;
  bindNav();
  app.querySelectorAll('.li-play').forEach(b => b.onclick = () => startGame({ mode: 'free', rank: +b.dataset.rk }));
}

// ================= Freies Spiel =================
function freeScreen() {
  app.innerHTML = `<div class="screen">${topbar('Freies Spiel')}
    <p class="muted small pad">Spiele ohne Punkte gegen jeden Bot bis zu deinem besten Rang – mit Hinweisen, Zug zurück und Bewertungsbalken.</p>
    <div class="list">${RANKS.map(r => {
      const open = r.id <= Math.max(S.bestRank, S.rank) + 1;
      return `<button class="hist-item ${open ? '' : 'locked'}" data-rk="${r.id}" ${open ? '' : 'disabled'}>
        ${emblem(r.id, 40)}<div class="hi-main"><b>${r.avatar} ${esc(r.bot)}</b> <span class="muted small">${esc(r.tier)}</span><div class="muted small">${r.boss ? 'maximale Stärke' : 'ca. ' + r.elo + ' Elo'}</div></div>
        <div class="hi-right">${open ? '›' : '🔒'}</div></button>`;
    }).join('')}</div></div>`;
  bindNav();
  app.querySelectorAll('.hist-item:not(.locked)').forEach(b => b.onclick = () => startGame({ mode: 'free', rank: +b.dataset.rk }));
}

// ================= Einstellungen =================
function settingsScreen() {
  const st = S.settings;
  const themes = [['walnut', 'Walnuss'], ['ocean', 'Ozean'], ['emerald', 'Turnier'], ['night', 'Nacht'], ['coral', 'Koralle']];
  app.innerHTML = `<div class="screen">${topbar('Einstellungen')}
    <div class="card settings">
      <h3>Brett</h3>
      <div class="theme-row">${themes.map(([k, l]) => `<button class="theme-sw ${st.theme === k ? 'on' : ''}" data-theme="${k}"><span class="sw" data-t="${k}"></span>${l}</button>`).join('')}</div>
      <label class="set-row"><span>Klänge</span><input type="checkbox" id="sSound" ${st.sound ? 'checked' : ''}></label>
      <label class="set-row"><span>Bewertungsbalken im freien Spiel</span><input type="checkbox" id="sEval" ${st.evalbar ? 'checked' : ''}></label>
      <h3>Coach-Analyse</h3>
      <label class="set-row"><span>Analysetiefe</span><select id="sDepth">${[[11, 'Schnell'], [13, 'Standard'], [16, 'Gründlich'], [19, 'Maximal']].map(([v, l]) => `<option value="${v}" ${st.depth == v ? 'selected' : ''}>${l} (Tiefe ${v})</option>`).join('')}</select></label>
      <h3>Fortschritt</h3>
      <button class="btn" id="replace">Neu einstufen</button>
      <button class="btn danger" id="reset">Alles zurücksetzen</button>
      <p class="muted small credits">Engine: Stockfish 19 (GPLv3) via stockfish.js · Regeln: chess.js (BSD) · Figuren: Colin M.L. Burnett (CC BY-SA 3.0) · Puzzles: selbst mit Stockfish erzeugt.</p>
    </div></div>`;
  bindNav();
  app.querySelectorAll('[data-theme]').forEach(b => b.onclick = () => { st.theme = b.dataset.theme; document.documentElement.dataset.theme = st.theme; save(); settingsScreen(); });
  $('#sSound').onchange = e => { st.sound = sound.on = e.target.checked; save(); };
  $('#sEval').onchange = e => { st.evalbar = e.target.checked; save(); };
  $('#sDepth').onchange = e => { st.depth = +e.target.value; save(); };
  $('#replace').onclick = () => { if (confirm('Neue Einstufungspartie spielen? Dein Rang wird neu berechnet.')) { S.placed = false; S.current = null; save(); go('onboarding'); } };
  $('#reset').onclick = () => { if (confirm('Wirklich ALLES löschen (Rang, Puzzles, Verlauf)?')) { localStorage.removeItem(KEY); S = load(); go('home'); } };
}

// ================= Puzzles =================
let P = null;
function puzzleScreen(mode = 'train') {
  app.innerHTML = `<div class="screen puzzle">
    ${topbar('Puzzles', 'home', `<div class="seg"><button class="${mode === 'train' ? 'on' : ''}" data-pm="train">Training</button><button class="${mode === 'sprint' ? 'on' : ''}" data-pm="sprint">Sprint</button></div>`)}
    <div class="game-layout">
      <div class="board-col">
        <div class="pz-head">
          <div class="pz-stat"><div class="muted small">${mode === 'sprint' ? 'Zeit' : 'Wertung'}</div><div class="pz-v" id="pzRating">${mode === 'sprint' ? '3:00' : Math.round(S.puzzleRating)}</div></div>
          <div class="pz-prompt" id="pzPrompt">…</div>
          <div class="pz-stat"><div class="muted small">${mode === 'sprint' ? 'Gelöst' : 'Serie'}</div><div class="pz-v" id="pzStreak">${mode === 'sprint' ? 0 : S.puzzleStreak}🔥</div></div>
        </div>
        <div class="board-wrap"><div id="board"></div></div>
        <div class="pz-feedback" id="pzFb"></div>
      </div>
      <div class="side-col">
        <div class="card pz-info" id="pzInfo"></div>
        <div class="actions">
          ${mode === 'train' ? `<button class="btn" id="pzHint">💡 Hinweis</button><button class="btn" id="pzSol">👁 Lösung</button>` : `<div id="pzLives" class="lives"></div>`}
          <button class="btn primary" id="pzNext">Weiter ›</button>
        </div>
        <div class="muted small pad" id="pzMeta">${mode === 'sprint' ? `Sprint: 3 Minuten, 3 Leben. Die Puzzles werden immer schwerer. Rekord: <b>${S.sprintBest}</b>` : `${Object.keys(S.solved).length} von ${PUZZLES.length} Puzzles gelöst · Beste Serie: ${S.puzzleBestStreak}`}</div>
      </div>
    </div></div>`;
  bindNav();
  app.querySelectorAll('[data-pm]').forEach(b => b.onclick = () => go('puzzles', b.dataset.pm));
  const board = new Board($('#board'), { onMove: puzzleMove });
  P = { mode, board, cur: null, idx: 0, chess: null, failed: false, done: false, solvedCount: 0, lives: 3, sprintRating: 500, seen: new Set() };
  if (mode === 'sprint') {
    P.end = Date.now() + 180000;
    renderLives();
    timers.push(setInterval(() => {
      const left = Math.max(0, P.end - Date.now());
      const el = $('#pzRating'); if (el) el.textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
      if (left <= 0) sprintOver();
    }, 250));
    $('#pzNext').onclick = () => nextPuzzle();
  } else {
    $('#pzNext').onclick = () => nextPuzzle();
    $('#pzHint').onclick = () => { if (!P.cur || P.done) return; const u = P.cur.moves[P.idx]; P.board.setHint(u.slice(0, 2)); if (!P.failed) { P.failed = true; ratePuzzle(0); } };
    $('#pzSol').onclick = showSolution;
  }
  nextPuzzle();
}

function renderLives() { const l = $('#pzLives'); if (l) l.innerHTML = [0, 1, 2].map(i => `<span class="${i < P.lives ? 'on' : ''}">♥</span>`).join(''); }

function pickPuzzle() {
  const target = P.mode === 'sprint' ? P.sprintRating : S.puzzleRating;
  let pool = [];
  for (let w = 120; w < 3000 && pool.length < 6; w += 120) pool = PUZZLES.filter(p => Math.abs(p.rating - target) <= w && !P.seen.has(p.id) && (P.mode === 'sprint' || !S.solved[p.id]));
  if (!pool.length) pool = PUZZLES.filter(p => !P.seen.has(p.id));
  if (!pool.length) { P.seen.clear(); pool = PUZZLES; }
  return pool[Math.floor(Math.random() * pool.length)];
}

async function nextPuzzle() {
  if (P.over) return;
  const pz = pickPuzzle();
  P.cur = pz; P.idx = 0; P.failed = false; P.done = false; P.seen.add(pz.id);
  P.chess = new Chess(pz.fen);
  const playerColor = P.chess.turn() === 'w' ? 'b' : 'w';
  P.color = playerColor;
  P.board.setOrientation(playerColor);
  P.board.setPosition(P.chess, { animate: false });
  P.board.setArrows([]); P.board.setHint(null); P.board.setMarker(null);
  P.board.setInteractive(null);
  $('#pzFb').innerHTML = '';
  $('#pzFb').className = 'pz-feedback';
  $('#pzPrompt').innerHTML = `<span class="turn-dot ${playerColor}"></span>${playerColor === 'w' ? 'Weiß' : 'Schwarz'} am Zug`;
  $('#pzInfo').innerHTML = `<div class="muted small">Puzzle #${pz.id}</div><div><b>Finde den besten Zug!</b></div><div class="muted small">${P.mode === 'train' ? `Schwierigkeit ≈ ${pz.rating}` : ''}</div>`;
  const token = P.token = Math.random();
  await sleep(550);
  if (token !== P.token) return;
  puzzleAuto(pz.moves[0]);
  P.idx = 1;
  P.board.setInteractive(playerColor);
}

function puzzleAuto(uci) {
  const m = P.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
  P.board.setPosition(P.chess, { animate: true, lastMove: { from: m.from, to: m.to } });
  if (P.chess.inCheck()) play('check'); else if (m.captured) play('capture'); else play('move');
}

async function puzzleMove(from, to, promotion) {
  if (!P || P.done || P.chess.turn() !== P.color) return;
  const uci = from + to + (promotion || '');
  const expected = P.cur.moves[P.idx];
  const test = new Chess(P.chess.fen());
  const tm = test.move({ from, to, promotion });
  const ok = uci === expected || (tm && test.isCheckmate());
  P.board.setHint(null);
  if (!ok) {
    play('wrong');
    P.board.flash(to, 'wrong');
    P.board.setPosition(P.chess, { animate: true, lastMove: P.chess.history({ verbose: true }).slice(-1).map(m => ({ from: m.from, to: m.to }))[0] });
    $('#pzFb').className = 'pz-feedback bad'; $('#pzFb').innerHTML = '✗ Nicht ganz. Versuch es nochmal!';
    if (P.mode === 'sprint') {
      P.lives--; renderLives();
      if (P.lives <= 0) return sprintOver();
      P.done = true; setTimeout(nextPuzzle, 700); return;
    }
    if (!P.failed) { P.failed = true; ratePuzzle(0); }
    return;
  }
  const m = P.chess.move({ from, to, promotion });
  P.board.setPosition(P.chess, { animate: true, lastMove: { from: m.from, to: m.to } });
  if (P.chess.inCheck()) play('check'); else if (m.captured) play('capture'); else play('move');
  P.board.flash(to, 'right');
  P.idx++;
  if (P.idx >= P.cur.moves.length || P.chess.isCheckmate()) return puzzleSolved();
  $('#pzFb').className = 'pz-feedback good'; $('#pzFb').innerHTML = '✓ Richtig! Weiter so …';
  P.board.setInteractive(null);
  const token = P.token;
  await sleep(450);
  if (token !== P.token) return;
  puzzleAuto(P.cur.moves[P.idx]);
  P.idx++;
  P.board.setInteractive(P.color);
}

function ratePuzzle(score) {
  const pr = P.cur.rating, ur = S.puzzleRating;
  const e = 1 / (1 + Math.pow(10, (pr - ur) / 400));
  const k = S.puzzlesDone < 20 ? 40 : 24;
  const d = Math.round(k * (score - e));
  S.puzzleRating = Math.max(100, ur + d);
  S.puzzlesDone++;
  if (score === 0) S.puzzleStreak = 0;
  save();
  const el = $('#pzRating'); if (el && P.mode === 'train') { el.textContent = Math.round(S.puzzleRating); el.insertAdjacentHTML('beforeend', `<span class="delta ${d >= 0 ? 'pos' : 'neg'}">${d >= 0 ? '+' : ''}${d}</span>`); }
}

function puzzleSolved() {
  P.done = true;
  P.board.setInteractive(null);
  play('correct');
  const pz = P.cur;
  if (P.mode === 'sprint') {
    P.solvedCount++; P.sprintRating += 70;
    $('#pzStreak').textContent = P.solvedCount + '🔥';
    $('#pzFb').className = 'pz-feedback good'; $('#pzFb').innerHTML = '✓ Gelöst!';
    setTimeout(nextPuzzle, 500);
    return;
  }
  if (!P.failed) { ratePuzzle(1); S.puzzleStreak++; S.puzzleBestStreak = Math.max(S.puzzleBestStreak, S.puzzleStreak); S.solved[pz.id] = 1; save(); }
  $('#pzStreak').textContent = S.puzzleStreak + '🔥';
  $('#pzFb').className = 'pz-feedback good';
  $('#pzFb').innerHTML = P.failed ? '✓ Gelöst (mit Hilfe)' : `✓ Perfekt gelöst!`;
  $('#pzInfo').innerHTML = `<div class="muted small">Puzzle #${pz.id} · ≈ ${pz.rating}</div><div><b>Gelöst!</b></div><div class="themes">${pz.themes.map(t => `<span class="chip sm">${esc(t)}</span>`).join('')}</div>`;
  if (!P.failed && S.puzzleStreak && S.puzzleStreak % 5 === 0) confetti();
  const meta = $('#pzMeta'); if (meta) meta.textContent = `${Object.keys(S.solved).length} von ${PUZZLES.length} Puzzles gelöst · Beste Serie: ${S.puzzleBestStreak}`;
}

async function showSolution() {
  if (!P.cur || P.done) return;
  if (!P.failed) { P.failed = true; ratePuzzle(0); }
  P.done = true; P.board.setInteractive(null);
  const token = P.token;
  while (P.idx < P.cur.moves.length) {
    const u = P.cur.moves[P.idx];
    P.board.setArrows([{ from: u.slice(0, 2), to: u.slice(2, 4), color: '#7ec24a' }]);
    await sleep(700);
    if (token !== P.token) return;
    puzzleAuto(u); P.idx++;
    await sleep(500);
  }
  P.board.setArrows([]);
  $('#pzInfo').innerHTML = `<div class="muted small">Puzzle #${P.cur.id}</div><div><b>Lösung gezeigt</b></div><div class="themes">${P.cur.themes.map(t => `<span class="chip sm">${esc(t)}</span>`).join('')}</div>`;
}

function sprintOver() {
  if (P.over) return;
  P.over = true; P.done = true; stopTimers();
  P.board.setInteractive(null);
  const rec = P.solvedCount > S.sprintBest;
  if (rec) { S.sprintBest = P.solvedCount; save(); confetti(); play('win'); } else play('draw');
  modal(`<div class="center"><div class="res-icon">⏱</div><h2>Sprint vorbei</h2><div class="acc-big">${P.solvedCount}</div><div class="muted">gelöste Puzzles${rec ? ' · Neuer Rekord!' : ` · Rekord: ${S.sprintBest}`}</div>
    <div class="row2"><button class="btn primary" id="sAgain">Nochmal</button><button class="btn" id="sHome">Fertig</button></div></div>`);
  $('#sAgain').onclick = () => { closeModal(); go('puzzles', 'sprint'); };
  $('#sHome').onclick = () => { closeModal(); go('puzzles', 'train'); };
}

// ================= Start =================
window.__cc = { get G() { return G; }, get P() { return P; }, get S() { return S; } }; // für Tests/Debugging
go('home');
if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !/ClaudeChessApp/.test(navigator.userAgent)) navigator.serviceWorker.register('sw.js').catch(() => {});

// Zurück-Taste der Android-App: eine Ebene zurück; false = App schliessen
window.ccBack = () => {
  const fx = document.querySelector('.rank-fx'); if (fx) { fx.remove(); return true; }
  const m = $('#modal');
  if (m.classList.contains('show')) { const bg = $('.modal-bg', m); if (bg && bg.onclick) closeModal(); return true; }
  const back = $('.topbar [data-go]'); if (back) { back.click(); return true; }
  return false;
};
