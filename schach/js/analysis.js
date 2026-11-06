// Partie-Analyse: Bewertung jedes Zuges (wie bei großen Schachplattformen) + Coach-Texte.
import { Chess } from '../vendor/chess.js';
import { MATE } from './engine.js';
import { bookInfo } from './openings.js';

export const CLASSES = {
  brilliant:  { label: 'Brillant',       sym: '!!', color: '#1bc6c0', score: 100 },
  great:      { label: 'Großartig',      sym: '!',  color: '#5b9cf5', score: 100 },
  best:       { label: 'Bester Zug',     sym: '★',  color: '#7ec24a', score: 100 },
  excellent:  { label: 'Exzellent',      sym: '👍', color: '#94c85a', score: 90 },
  good:       { label: 'Gut',            sym: '✓',  color: '#9bb382', score: 75 },
  book:       { label: 'Buchzug',        sym: '📖', color: '#b5926a', score: 100 },
  inaccuracy: { label: 'Ungenauigkeit',  sym: '?!', color: '#f2c94c', score: 50 },
  mistake:    { label: 'Fehler',         sym: '?',  color: '#f2994a', score: 25 },
  miss:       { label: 'Verpasst',       sym: '✗',  color: '#ff7a8a', score: 20 },
  blunder:    { label: 'Patzer',         sym: '??', color: '#ef4444', score: 0 },
};
export const CLASS_ORDER = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'miss', 'blunder'];

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
const NAME = { p: 'Bauer', n: 'Springer', b: 'Läufer', r: 'Turm', q: 'Dame', k: 'König' };
const NAME_AKK = { p: 'den Bauern', n: 'den Springer', b: 'den Läufer', r: 'den Turm', q: 'die Dame', k: 'den König' };

const wp = cp => { const c = Math.max(-1500, Math.min(1500, cp)); return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * c)) - 1); };
const moveAcc = (before, after) => Math.max(0, Math.min(100, 103.1668 * Math.exp(-0.04354 * Math.max(0, before - after)) - 3.1669));

function material(fen, color) {
  let s = 0;
  for (const ch of fen.split(' ')[0]) {
    const lo = ch.toLowerCase();
    if (!VAL[lo]) continue;
    const isW = ch !== lo;
    s += (isW === (color === 'w') ? 1 : -1) * VAL[lo];
  }
  return s;
}
function nonPawnMaterial(fen) {
  let s = 0;
  for (const ch of fen.split(' ')[0]) { const lo = ch.toLowerCase(); if ('nbrq'.includes(lo)) s += VAL[lo]; }
  return s;
}
const uciMove = (ch, u) => { try { return ch.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] }); } catch { return null; } };

function sanLine(fen, pv, n) {
  const ch = new Chess(fen); const out = [];
  for (const u of pv.slice(0, n)) { const m = uciMove(ch, u); if (!m) break; out.push(m.san); }
  return out;
}

/** Materialverlauf entlang einer Variante: min/max/end aus Sicht von color */
function pvMaterial(fen, pv, plies, color) {
  const ch = new Chess(fen);
  let min = material(fen, color), max = min, end = min;
  for (const u of pv.slice(0, plies)) {
    if (!uciMove(ch, u)) break;
    end = material(ch.fen(), color);
    min = Math.min(min, end); max = Math.max(max, end);
  }
  // Am Ende einer Schlagabfolge kurz "ruhig" werden lassen: nur Ende nach Zug von color zählt
  return { min, max, end };
}

function lossPhrase(d) {
  if (d >= 8) return 'die Dame';
  if (d >= 4.5) return 'einen Turm';
  if (d >= 2.5) return 'eine Figur';
  if (d >= 1.5) return 'die Qualität';
  if (d >= 0.9) return 'einen Bauern';
  return null;
}

/** Hängende Figur nach einem Zug? (angegriffen und nicht ausreichend gedeckt) */
function hangingPiece(fen, color) {
  const ch = new Chess(fen);
  const opp = color === 'w' ? 'b' : 'w';
  let worst = null;
  for (const row of ch.board()) for (const p of row) {
    if (!p || p.color !== color || p.type === 'k' || p.type === 'p') continue;
    const att = ch.attackers(p.square, opp);
    if (!att.length) continue;
    const def = ch.attackers(p.square, color);
    const minAtt = Math.min(...att.map(s => VAL[ch.get(s).type] || 0.5));
    if (!def.length || minAtt < VAL[p.type]) {
      if (!worst || VAL[p.type] > VAL[worst.type]) worst = p;
    }
  }
  return worst;
}

/** Erkennt eine Gabel: gezogene Figur greift >= 2 wertvolle Figuren (oder König) an */
function forkInfo(fenAfter, to, color) {
  const ch = new Chess(fenAfter);
  const piece = ch.get(to);
  if (!piece) return null;
  const targets = [];
  const opp = color === 'w' ? 'b' : 'w';
  for (const row of ch.board()) for (const p of row) {
    if (!p || p.color !== opp) continue;
    if (VAL[p.type] < 3 && p.type !== 'k') continue;
    if (VAL[p.type] <= VAL[piece.type] && p.type !== 'k' && ch.attackers(p.square, opp).length) continue;
    if (ch.attackers(p.square, color).includes(to)) targets.push(p);
  }
  return targets.length >= 2 ? { piece: piece.type, targets } : null;
}

function bestIdea(fen, line, color) {
  if (!line || !line.pv?.length) return '';
  const ch = new Chess(fen);
  const m = uciMove(ch, line.pv[0]);
  if (!m) return '';
  if (line.mate && line.mate > 0) return line.mate === 1 ? `${m.san} setzt sofort matt` : `${m.san} führt zu Matt in ${line.mate}`;
  const before = material(fen, color);
  const mat = pvMaterial(fen, line.pv, 6, color);
  const gain = mat.end - before;
  const fork = forkInfo(ch.fen(), m.to, color);
  if (fork && gain >= 1.5) return `${m.san} ist eine Gabel (${NAME[fork.piece]} greift ${fork.targets.map(t => NAME[t.type]).join(' und ')} an) und gewinnt ${lossPhrase(gain) || 'Material'}`;
  if (gain >= 0.9) return `${m.san} gewinnt ${lossPhrase(gain)}${m.san.includes('+') ? ' mit Schach' : ''}`;
  if (m.flags.includes('k') || m.flags.includes('q')) return `${m.san} bringt den König in Sicherheit`;
  if (m.san.includes('+')) return `${m.san} mit Schach hält die Initiative`;
  return m.san;
}

/**
 * Analysiert eine Partie.
 * game: { startFen, moves:[uci], playerColor }
 * onProgress(done, total)
 */
export async function analyseGame(engine, game, { depth = 13, onProgress } = {}) {
  const ch = new Chess(game.startFen || undefined);
  const fens = [ch.fen()], sans = [], verbose = [];
  for (const u of game.moves) { const m = uciMove(ch, u); if (!m) break; sans.push(m.san); verbose.push(m); fens.push(ch.fen()); }

  // Engine-Bewertung jeder Stellung
  const evals = [];
  for (let i = 0; i < fens.length; i++) {
    const c = new Chess(fens[i]);
    if (c.isCheckmate()) evals.push({ lines: [{ score: -MATE, mate: 0, pv: [] }], terminal: 'mate' });
    else if (c.isDraw() || c.isStalemate()) evals.push({ lines: [{ score: 0, mate: null, pv: [] }], terminal: 'draw' });
    else evals.push(await engine.analyse(fens[i], { depth, multipv: 2 }));
    onProgress?.(i + 1, fens.length);
  }

  // Weiß-Sicht für Graph
  const whiteEval = evals.map((e, i) => {
    const s = e.lines[0]?.score ?? 0;
    return fens[i].split(' ')[1] === 'w' ? s : -s;
  });
  const whiteMate = evals.map((e, i) => {
    const m = e.lines[0]?.mate; if (m == null) return null;
    if (m === 0) return fens[i].split(' ')[1] === 'w' ? -0 : 0;
    return fens[i].split(' ')[1] === 'w' ? m : -m;
  });

  const book = bookInfo(sans);
  const moves = [];
  for (let i = 0; i < verbose.length; i++) {
    const m = verbose[i];
    const color = m.color;
    const A = evals[i], B = evals[i + 1];
    const uci = m.from + m.to + (m.promotion || '');
    const bestLine = A.lines[0];
    const bestStm = bestLine?.score ?? 0;
    let after = -(B.lines[0]?.score ?? 0);
    const isBest = A.best ? A.best === uci : bestLine?.pv[0] === uci;
    if (isBest) after = Math.max(after, bestStm);
    const wpBest = wp(bestStm), wpAfter = wp(after);
    const loss = Math.max(0, wpBest - wpAfter) / 100;
    const legalCount = new Chess(fens[i]).moves().length;
    let cls;
    if (i < book.depth) cls = 'book';
    else if (isBest || loss < 0.005) cls = 'best';
    else if (loss < 0.02) cls = 'excellent';
    else if (loss < 0.05) cls = 'good';
    else if (loss < 0.10) cls = 'inaccuracy';
    else if (loss < 0.20) cls = 'mistake';
    else cls = 'blunder';

    // Brillant / Großartig
    if ((cls === 'best' || cls === 'excellent') && i >= book.depth && legalCount > 1) {
      const matBefore = material(fens[i], color);
      const oppPv = B.lines[0]?.pv || [];
      const mat = pvMaterial(fens[i + 1], oppPv, 5, color);
      const hang = hangingPiece(fens[i + 1], color);
      const sacrificed = (mat.min <= matBefore - 2 && mat.end <= matBefore - 1) || (hang && hang.square === m.to && VAL[hang.type] >= 3 && !m.captured) || (hang && VAL[hang.type] >= 3 && hang.square !== m.to && mat.min <= matBefore - 2);
      if (sacrificed && wpAfter >= 50 && wpBest < 97 && !(m.promotion)) cls = 'brilliant';
      else if (A.lines[1]) {
        const wpSecond = wp(A.lines[1].score);
        const prev = verbose[i - 1];
        const trivialRecapture = prev && prev.captured && prev.to === m.to;
        if (wpBest - wpSecond >= 18 && wpAfter > 30 && wpAfter < 98 && !trivialRecapture) cls = 'great';
      }
    }
    // Verpasst: Gegner hat Fehler gemacht, Chance nicht genutzt
    const prevCls = moves[i - 1]?.cls;
    if ((cls === 'mistake' || cls === 'blunder' || cls === 'inaccuracy') && (prevCls === 'mistake' || prevCls === 'blunder' || prevCls === 'miss') && wpBest >= 65 && wpAfter < wpBest - 12 && wpAfter > 25) cls = 'miss';

    moves.push({
      ply: i, san: m.san, uci, color, from: m.from, to: m.to, cls,
      wpBefore: wpBest, wpAfter, loss, acc: cls === 'book' ? 100 : moveAcc(wpBest, wpAfter),
      best: bestLine?.pv[0] || null, bestSan: bestLine?.pv[0] ? sanLine(fens[i], bestLine.pv, 1)[0] : null,
      bestLine: bestLine ? sanLine(fens[i], bestLine.pv, 6) : [],
      replyLine: B.lines[0]?.pv ? sanLine(fens[i + 1], B.lines[0].pv, 5) : [],
      evalWhite: whiteEval[i + 1], mateWhite: whiteMate[i + 1],
      captured: m.captured, piece: m.piece,
    });
  }

  // Coach-Texte
  for (let i = 0; i < moves.length; i++) moves[i].comment = coachComment(moves, i, fens, evals);

  // Zusammenfassung pro Seite (Genauigkeit wie bei Lichess: volatilitätsgewichtetes + harmonisches Mittel)
  const wpWhite = whiteEval.map(v => wp(v));
  const win = Math.max(2, Math.min(8, Math.floor(moves.length / 10)));
  const weights = moves.map((_, i) => {
    const a = Math.max(0, Math.min(i, wpWhite.length - win)), seg = wpWhite.slice(a, a + win);
    const mu = seg.reduce((x, y) => x + y, 0) / seg.length;
    const sd = Math.sqrt(seg.reduce((x, y) => x + (y - mu) ** 2, 0) / seg.length);
    return Math.max(0.5, Math.min(12, sd));
  });
  const sides = {};
  for (const col of ['w', 'b']) {
    const mine = moves.filter(x => x.color === col);
    const counts = Object.fromEntries(CLASS_ORDER.map(k => [k, 0]));
    mine.forEach(x => counts[x.cls]++);
    const nonBook = mine.filter(x => x.cls !== 'book');
    const accs = nonBook.map(x => x.acc);
    const ws = nonBook.map(x => weights[x.ply]);
    const wmean = accs.length ? accs.reduce((a, b, k) => a + b * ws[k], 0) / ws.reduce((a, b) => a + b, 0) : 100;
    const harm = accs.length ? accs.length / accs.reduce((a, b) => a + 1 / Math.max(b, 1), 0) : 100;
    const accuracy = Math.round(((wmean + harm) / 2) * 10) / 10;
    // Phasen
    const phase = { opening: [], middlegame: [], endgame: [] };
    mine.forEach(x => {
      const npm = nonPawnMaterial(fens[x.ply]);
      const ph = x.ply < Math.max(16, book.depth + 4) && npm > 40 ? 'opening' : npm <= 26 ? 'endgame' : 'middlegame';
      phase[ph].push(x.acc);
    });
    const phaseAcc = Object.fromEntries(Object.entries(phase).map(([k, v]) => [k, v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null]));
    sides[col] = { counts, accuracy, phaseAcc, moves: mine.length };
  }

  return { fens, sans, moves, whiteEval, whiteMate, sides, opening: book.name, bookDepth: book.depth };
}

function evalText(cpWhite, mateWhite, color) {
  const s = color === 'w' ? cpWhite : -cpWhite;
  if (mateWhite != null && Math.abs(cpWhite) > MATE - 1000) return s > 0 ? 'du hast ein forciertes Matt' : 'dein Gegner hat ein forciertes Matt';
  if (s > 500) return 'du stehst auf Gewinn';
  if (s > 180) return 'du stehst klar besser';
  if (s > 60) return 'du stehst etwas besser';
  if (s > -60) return 'die Stellung ist ausgeglichen';
  if (s > -180) return 'du stehst etwas schlechter';
  if (s > -500) return 'du stehst klar schlechter';
  return 'die Stellung ist verloren';
}

function coachComment(moves, i, fens, evals) {
  const x = moves[i];
  const color = x.color;
  const fenBefore = fens[i], fenAfter = fens[i + 1];
  const bestLine = evals[i].lines[0];
  const reply = evals[i + 1].lines[0];
  const pick = arr => arr[(i * 7 + x.san.length) % arr.length];
  const idea = x.best && x.best !== x.uci ? bestIdea(fenBefore, bestLine, color) : '';
  const after = evalText(x.evalWhite, x.mateWhite, color);

  switch (x.cls) {
    case 'book':
      return pick(['Ein bewährter Eröffnungszug aus der Theorie.', 'Buchzug – so spielen es auch die Profis.', 'Theorie. Solide Eröffnungsarbeit.']);
    case 'brilliant': {
      const hang = hangingPiece(fenAfter, color);
      const what = hang ? NAME_AKK[hang.type] : 'Material';
      return `Brillant!! ${x.san} ist ein echtes Opfer: Du gibst ${what} her, aber der Gegner kann es nicht gefahrlos nehmen. Stand danach: ${after}. Genau solche Züge finden nur starke Spieler.`;
    }
    case 'great':
      return `Großartig! ${x.san} war der einzige Zug, der die Stellung hält – alle Alternativen wären deutlich schlechter gewesen. Stand danach: ${after}.`;
    case 'best': {
      if (new Chess(fenAfter).isCheckmate()) return `${x.san} – Schachmatt! Perfekt abgeschlossen.`;
      const fork = forkInfo(fenAfter, x.to, color);
      if (fork) return `Bester Zug! ${x.san} greift gleich ${fork.targets.map(t => NAME_AKK[t.type]).join(' und ')} an – eine Gabel.`;
      return pick([`${x.san} ist der beste Zug. Genau so hätte es die Engine gespielt.`, `Bester Zug! ${x.san} ist präzise.`, `Stark. ${x.san} ist die Nummer 1 der Engine.`]);
    }
    case 'excellent':
      return pick([`${x.san} ist exzellent – fast so gut wie der Engine-Zug ${x.bestSan}.`, `Sehr gut gespielt. ${x.san} hält alles unter Kontrolle.`]);
    case 'good':
      return `${x.san} ist ein guter Zug. Etwas genauer war ${idea && idea !== x.bestSan ? idea : x.bestSan}.`;
    case 'inaccuracy':
      return `Ungenauigkeit. ${x.san} ist spielbar, verschenkt aber etwas. ${idea ? (idea === x.bestSan ? `Besser war ${idea}.` : `Besser: ${idea}.`) : ''} Stand danach: ${after}.`;
    case 'mistake':
    case 'blunder':
    case 'miss': {
      let cons = '';
      if (reply?.mate && reply.mate > 0) cons = `Das erlaubt ${reply.mate === 1 ? 'ein sofortiges Matt' : `Matt in ${reply.mate}`} (${x.replyLine.slice(0, Math.min(3, x.replyLine.length)).join(' ')})`;
      else {
        const mat = pvMaterial(fenAfter, reply?.pv || [], 6, color);
        const lost = material(fenBefore, color) - mat.end;
        const hang = hangingPiece(fenAfter, color);
        const lp = lossPhrase(lost);
        if (lp) cons = `Nach ${x.replyLine[0] || 'der Antwort'} verlierst du ${lp}`;
        else if (hang) cons = `${NAME_AKK[hang.type][0].toUpperCase() + NAME_AKK[hang.type].slice(1)} auf ${hang.square} steht danach ungeschützt`;
        else cons = `Stand danach: ${after}`;
      }
      const head = x.cls === 'blunder' ? 'Patzer!' : x.cls === 'miss' ? 'Chance verpasst!' : 'Fehler.';
      const missTxt = x.cls === 'miss' ? ' Dein Gegner hatte gerade einen Fehler gemacht – hier gab es etwas zu holen.' : '';
      const better = idea && idea !== x.bestSan ? ` Besser: ${idea}.` : x.bestSan ? ` Besser war ${x.bestSan}.` : '';
      return `${head} ${x.san}.${missTxt} ${cons}.${better}`;
    }
  }
  return '';
}

/** Gesamtfazit des Coaches für den Spieler */
export function coachSummary(an, color, result) {
  const me = an.sides[color];
  const acc = me.accuracy;
  const c = me.counts;
  const parts = [];
  if (result === 1) parts.push(acc >= 85 ? 'Was für eine Partie! Ein verdienter, sauberer Sieg.' : acc >= 70 ? 'Gut gemacht – Sieg eingefahren!' : 'Sieg! Nicht immer schön, aber der Punkt zählt.');
  else if (result === 0.5) parts.push('Remis – eine geteilte Partie.');
  else parts.push(acc >= 80 ? 'Knapp verloren, aber du hast stark gespielt.' : 'Diesmal hat es nicht gereicht. Schauen wir uns an, woran es lag.');
  parts.push(`Deine Genauigkeit lag bei ${acc.toFixed(1)} %.`);
  if (c.brilliant) parts.push(`Du hast ${c.brilliant === 1 ? 'einen brillanten Zug' : c.brilliant + ' brillante Züge'} gefunden!`);
  if (c.great) parts.push(`${c.great === 1 ? 'Ein großartiger Zug' : c.great + ' großartige Züge'} in kritischen Momenten.`);
  const errors = c.blunder + c.miss;
  if (errors >= 2) parts.push(`${c.blunder} Patzer und ${c.mistake} Fehler haben dich viel gekostet.`);
  else if (c.blunder === 1) parts.push('Ein einziger Patzer hat die Partie stark beeinflusst.');
  // Wendepunkt
  const mine = an.moves.filter(x => x.color === color && x.cls !== 'book');
  const worst = mine.reduce((w, x) => (!w || x.loss > w.loss ? x : w), null);
  if (worst && worst.loss >= 0.15) parts.push(`Der Wendepunkt war Zug ${Math.floor(worst.ply / 2) + 1}${color === 'b' ? '…' : '.'} ${worst.san} – dort war ${worst.bestSan} richtig.`);
  // Tipps
  const tips = [];
  if (c.blunder + c.mistake >= 3) tips.push('Mach vor jedem Zug einen Sicherheits-Check: Welche meiner Figuren hängen? Welche Schachs, Schlagzüge und Drohungen hat mein Gegner?');
  const ph = me.phaseAcc;
  if (ph.opening != null && ph.opening < 70) tips.push('Eröffnung: Entwickle Springer und Läufer früh, kontrolliere das Zentrum und rochiere bald.');
  if (ph.endgame != null && ph.endgame < 70) tips.push('Endspiel: Aktiviere deinen König und schiebe Freibauern – im Endspiel ist der König eine starke Figur.');
  if (ph.middlegame != null && ph.middlegame < 65) tips.push('Mittelspiel: Suche nach Taktiken (Gabeln, Fesselungen, Abzüge) – der Puzzle-Modus trainiert genau das.');
  if (!tips.length) tips.push(acc >= 85 ? 'Weiter so – du spielst auf einem sehr hohen Niveau.' : 'Nimm dir in kritischen Stellungen mehr Zeit und vergleiche mehrere Kandidatenzüge.');
  return { text: parts.join(' '), tips };
}
