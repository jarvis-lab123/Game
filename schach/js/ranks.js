// Die 15 Ränge, ihre Bots und wie stark diese spielen.
import { bookMove } from './openings.js';

export const RANKS = [
  { id: 1,  tier: 'Holz',        bot: 'Kiesel',   elo: 400,  color: '#a47551', color2: '#6b4a2f', avatar: '🐣', style: 'Zieht gern, was gerade schön aussieht.',
    weak: { depth: 1, multipv: 10, temp: 320, blunder: 0.38, book: 0 } },
  { id: 2,  tier: 'Stein',       bot: 'Bruno',    elo: 600,  color: '#9aa0a6', color2: '#5f6368', avatar: '🐢', style: 'Kennt die Regeln, übersieht aber gern Figuren.',
    weak: { depth: 2, multipv: 8, temp: 220, blunder: 0.22, book: 2 } },
  { id: 3,  tier: 'Bronze',      bot: 'Mila',     elo: 800,  color: '#cd7f32', color2: '#8a4f1d', avatar: '🦊', style: 'Schlägt gern zurück, plant aber kaum.',
    weak: { depth: 3, multipv: 6, temp: 150, blunder: 0.13, book: 4 } },
  { id: 4,  tier: 'Eisen',       bot: 'Theo',     elo: 1000, color: '#7d8a99', color2: '#3f4954', avatar: '🦉', style: 'Entwickelt seine Figuren und lauert auf Fehler.',
    weak: { depth: 4, multipv: 5, temp: 90, blunder: 0.07, book: 6 } },
  { id: 5,  tier: 'Silber',      bot: 'Greta',    elo: 1200, color: '#c9d1d9', color2: '#7b8794', avatar: '🐺', style: 'Solide und taktisch wach.',
    weak: { depth: 6, multipv: 4, temp: 45, blunder: 0.03, book: 8 } },
  { id: 6,  tier: 'Gold',        bot: 'Viktor',   elo: 1400, color: '#f5c542', color2: '#b8860b', avatar: '🦁', style: 'Greift an, sobald du eine Lücke lässt.',
    sf: { elo: 1320, movetime: 600, book: 10 } },
  { id: 7,  tier: 'Platin',      bot: 'Nora',     elo: 1600, color: '#5fd4c4', color2: '#1f8a7c', avatar: '🐆', style: 'Positionell sauber, bestraft lose Figuren.',
    sf: { elo: 1500, movetime: 700, book: 10 } },
  { id: 8,  tier: 'Smaragd',     bot: 'Kasimir',  elo: 1800, color: '#34c77b', color2: '#12784a', avatar: '🐍', style: 'Ein Taktiker, der Kombinationen liebt.',
    sf: { elo: 1700, movetime: 800, book: 12 } },
  { id: 9,  tier: 'Saphir',      bot: 'Selin',    elo: 2000, color: '#4f8cff', color2: '#1d4fbf', avatar: '🦅', style: 'Klubspielerin mit eisernem Endspiel.',
    sf: { elo: 1900, movetime: 900, book: 12 } },
  { id: 10, tier: 'Rubin',       bot: 'Ragnar',   elo: 2200, color: '#ff4d6d', color2: '#a3112e', avatar: '🐉', style: 'Kandidatenmeister. Kein Fehler bleibt ungestraft.',
    sf: { elo: 2150, movetime: 1000, book: 14 } },
  { id: 11, tier: 'Diamant',     bot: 'Ivana',    elo: 2400, color: '#a5f3fc', color2: '#38bdf8', avatar: '💎', style: 'Internationale Meisterin. Präzise bis zum Schluss.',
    sf: { elo: 2400, movetime: 1200, book: 14 } },
  { id: 12, tier: 'Meister',     bot: 'Orion',    elo: 2600, color: '#c084fc', color2: '#7e22ce', avatar: '🌌', style: 'Großmeister-Niveau. Sieht fünf Züge weiter als du.',
    sf: { elo: 2650, movetime: 1300, book: 14 } },
  { id: 13, tier: 'Großmeister', bot: 'Titan',    elo: 2850, color: '#fb923c', color2: '#c2410c', avatar: '🗿', style: 'Weltspitze. Jeder Zug ein Problem.',
    sf: { elo: 2950, movetime: 1500, book: 16 } },
  { id: 14, tier: 'Legende',     bot: 'Nexus',    elo: 3100, color: '#f472b6', color2: '#9d174d', avatar: '🤖', style: 'Volle Engine-Stärke. Menschen gewinnen hier fast nie.',
    sf: { elo: 0, movetime: 1500, book: 16 } },
  { id: 15, tier: 'Claude Chess', bot: 'Claude Chess', elo: 3600, color: '#ff8a5c', color2: '#d4561f', avatar: '✦', style: 'Die stärkste Stufe: volle Stockfish-19-Kraft und lange Bedenkzeit. Unbesiegt.',
    sf: { elo: 0, movetime: 3500, book: 8 }, boss: true },
];

export const RP_MAX = 100; // Rangpunkte pro Rang

export const rankOf = id => RANKS[Math.max(1, Math.min(15, id)) - 1];

/** Punkte für ein Ergebnis */
export function pointsFor(result, accuracy, rankId) {
  // result: 1 = Sieg, 0.5 = Remis, 0 = Niederlage
  const acc = accuracy ?? 60;
  if (result === 1) return Math.round(32 + Math.max(0, (acc - 70)) * 0.6);       // 32 … 50
  if (result === 0.5) return Math.round(8 + Math.max(0, acc - 75) * 0.3);         // 8 … 15
  const base = rankId === 15 ? 12 : 22;
  return -Math.round(Math.max(6, base - Math.max(0, acc - 70) * 0.5));          // -22 … -6
}

/** Elo-Schätzung aus Genauigkeit (grob, angelehnt an typische Werte von Online-Plattformen) */
export function eloFromAccuracy(acc) {
  const pts = [[0, 100], [40, 250], [50, 400], [60, 650], [70, 1000], [78, 1350], [84, 1700], [89, 2050], [93, 2400], [96, 2750], [98.5, 3150], [100, 3500]];
  for (let i = 1; i < pts.length; i++) {
    if (acc <= pts[i][0]) {
      const [a0, e0] = pts[i - 1], [a1, e1] = pts[i];
      return Math.round(e0 + (e1 - e0) * (acc - a0) / (a1 - a0));
    }
  }
  return 3500;
}

export function rankForElo(elo) {
  let r = 1;
  for (const k of RANKS) if (elo >= k.elo - 100) r = k.id;
  return Math.min(r, 12);
}

/** Konfiguriert die Spiel-Engine für einen Rang */
export async function configureBot(engine, rank) {
  const r = rankOf(rank);
  if (r.sf && r.sf.elo) {
    await engine.setOptions({ 'UCI_LimitStrength': 'true', 'UCI_Elo': r.sf.elo, 'Skill Level': 20 });
  } else {
    await engine.setOptions({ 'UCI_LimitStrength': 'false', 'Skill Level': 20 });
  }
  await engine.newGame();
}

/** Berechnet den Bot-Zug. Gibt { uci } zurück. */
export async function botMove(engine, chess, rankId, sanHistory) {
  const r = rankOf(rankId);
  const cfg = r.weak || r.sf;
  // Eröffnungsbuch für Abwechslung
  if (sanHistory.length < (cfg.book || 0)) {
    const san = bookMove(sanHistory);
    if (san) {
      const m = chess.moves({ verbose: true }).find(x => x.san === san);
      if (m) return { uci: m.from + m.to + (m.promotion || ''), book: true };
    }
  }
  const fen = chess.fen();
  if (r.sf) {
    const res = await engine.analyse(fen, { movetime: cfg.movetime, multipv: 1 });
    return { uci: res.best };
  }
  // Schwache Bots: mehrere Kandidaten, gewichtet ausgewählt, mit gelegentlichen Zufallszügen
  const w = r.weak;
  const legal = chess.moves({ verbose: true });
  if (Math.random() < w.blunder && legal.length > 1) {
    // "menschlicher" Fehler: lieber Schlagzüge und Schachs als komplett zufällig
    const juicy = legal.filter(m => m.captured || m.san.includes('+'));
    const pool = juicy.length && Math.random() < 0.5 ? juicy : legal;
    const m = pool[Math.floor(Math.random() * pool.length)];
    return { uci: m.from + m.to + (m.promotion || '') };
  }
  const res = await engine.analyse(fen, { depth: w.depth, multipv: Math.min(w.multipv, legal.length) });
  const lines = res.lines.filter(l => l && l.pv && l.pv[0]);
  if (!lines.length) return { uci: res.best };
  // Matt in 1 sehen auch Anfänger meistens
  if (lines[0].mate === 1 && Math.random() < 0.5 + rankId * 0.1) return { uci: lines[0].pv[0] };
  const top = lines[0].score;
  const weights = lines.map(l => Math.exp(-(top - Math.max(l.score, top - 3000)) / w.temp));
  const sum = weights.reduce((a, b) => a + b, 0);
  let x = Math.random() * sum;
  for (let i = 0; i < lines.length; i++) { x -= weights[i]; if (x <= 0) return { uci: lines[i].pv[0] }; }
  return { uci: lines[0].pv[0] };
}
