// Kleines Eröffnungsbuch: Name + Zugfolge (SAN). Wird für "Buchzug"-Erkennung,
// Eröffnungsnamen und Abwechslung bei den Bots verwendet.
export const OPENINGS = [
  ['Italienische Partie', 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O'],
  ['Italienisch: Giuoco Pianissimo', 'e4 e5 Nf3 Nc6 Bc4 Bc5 d3 Nf6 O-O d6 c3 O-O'],
  ['Zweispringerspiel', 'e4 e5 Nf3 Nc6 Bc4 Nf6 d3 Be7 O-O O-O'],
  ['Zweispringerspiel: Fegatello-Idee', 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Na5 Bb5+ c6'],
  ['Spanische Partie', 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O'],
  ['Spanisch: Berliner Verteidigung', 'e4 e5 Nf3 Nc6 Bb5 Nf6 O-O Nxe4 d4 Nd6 Bxc6 dxc6 dxe5 Nf5'],
  ['Spanisch: Abtauschvariante', 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6 dxc6 O-O f6'],
  ['Schottische Partie', 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Nf6 Nxc6 bxc6 e5 Qe7'],
  ['Russische Verteidigung', 'e4 e5 Nf3 Nf6 Nxe5 d6 Nf3 Nxe4 d4 d5 Bd3'],
  ['Vierspringerspiel', 'e4 e5 Nf3 Nc6 Nc3 Nf6 Bb5 Bb4 O-O O-O d3 d6'],
  ['Königsgambit', 'e4 e5 f4 exf4 Nf3 g5 h4 g4 Ne5'],
  ['Wiener Partie', 'e4 e5 Nc3 Nf6 f4 d5 fxe5 Nxe4 Nf3'],
  ['Philidor-Verteidigung', 'e4 e5 Nf3 d6 d4 Nf6 Nc3 Nbd7 Bc4 Be7 O-O O-O'],
  ['Sizilianisch: Najdorf', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6 Be3 e5 Nb3 Be6'],
  ['Sizilianisch: Drachen', 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6 Be3 Bg7 f3 O-O Qd2 Nc6'],
  ['Sizilianisch: Scheveninger', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nf6 Nc3 d6 Be2 Be7 O-O O-O'],
  ['Sizilianisch: Sveshnikov', 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5 Ndb5 d6 Bg5 a6 Na3 b5'],
  ['Sizilianisch: Taimanow', 'e4 c5 Nf3 e6 d4 cxd4 Nxd4 Nc6 Nc3 Qc7 Be2 a6 O-O Nf6'],
  ['Sizilianisch: Alapin', 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6'],
  ['Sizilianisch: Rossolimo', 'e4 c5 Nf3 Nc6 Bb5 g6 O-O Bg7 Re1 Nf6'],
  ['Sizilianisch: Geschlossen', 'e4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 d3 d6 f4'],
  ['Französische Verteidigung', 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7'],
  ['Französisch: Winawer', 'e4 e6 d4 d5 Nc3 Bb4 e5 c5 a3 Bxc3+ bxc3 Ne7'],
  ['Französisch: Vorstoßvariante', 'e4 e6 d4 d5 e5 c5 c3 Nc6 Nf3 Qb6 a3'],
  ['Französisch: Tarrasch', 'e4 e6 d4 d5 Nd2 Nf6 e5 Nfd7 Bd3 c5 c3 Nc6'],
  ['Caro-Kann', 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7'],
  ['Caro-Kann: Vorstoßvariante', 'e4 c6 d4 d5 e5 Bf5 Nf3 e6 Be2 c5 Be3'],
  ['Skandinavische Verteidigung', 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5'],
  ['Pirc-Verteidigung', 'e4 d6 d4 Nf6 Nc3 g6 Be3 Bg7 Qd2 c6 f3'],
  ['Aljechin-Verteidigung', 'e4 Nf6 e5 Nd5 d4 d6 Nf3 Bg4 Be2 e6 O-O'],
  ['Damengambit abgelehnt', 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6'],
  ['Damengambit angenommen', 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6'],
  ['Slawische Verteidigung', 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4'],
  ['Halbslawisch', 'd4 d5 c4 c6 Nf3 Nf6 Nc3 e6 e3 Nbd7 Bd3 dxc4 Bxc4 b5'],
  ['Londoner System', 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O'],
  ['Londoner System gegen Königsindisch', 'd4 Nf6 Bf4 g6 e3 Bg7 Nf3 O-O Be2 d6 h3'],
  ['Königsindische Verteidigung', 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7'],
  ['Grünfeld-Indisch', 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5 e4 Nxc3 bxc3 Bg7 Nf3 c5'],
  ['Nimzowitsch-Indisch', 'd4 Nf6 c4 e6 Nc3 Bb4 Qc2 O-O a3 Bxc3+ Qxc3 d5'],
  ['Damenindisch', 'd4 Nf6 c4 e6 Nf3 b6 g3 Ba6 b3 Bb4+ Bd2 Be7'],
  ['Katalanisch', 'd4 Nf6 c4 e6 g3 d5 Bg2 Be7 Nf3 O-O O-O dxc4 Qc2 a6'],
  ['Holländische Verteidigung', 'd4 f5 g3 Nf6 Bg2 e6 Nf3 Be7 O-O O-O c4 d6'],
  ['Benoni', 'd4 Nf6 c4 c5 d5 e6 Nc3 exd5 cxd5 d6 e4 g6 Nf3 Bg7'],
  ['Wolga-Gambit', 'd4 Nf6 c4 c5 d5 b5 cxb5 a6 bxa6 Bxa6 Nc3 d6'],
  ['Englische Eröffnung', 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6'],
  ['Englisch: Symmetrievariante', 'c4 c5 Nc3 Nc6 g3 g6 Bg2 Bg7 Nf3 Nf6 O-O O-O'],
  ['Réti-Eröffnung', 'Nf3 d5 c4 e6 g3 Nf6 Bg2 Be7 O-O O-O b3'],
  ['Königsindischer Angriff', 'Nf3 d5 g3 Nf6 Bg2 c6 O-O Bg4 d3 Nbd7 Nbd2 e5 e4'],
  ['Bird-Eröffnung', 'f4 d5 Nf3 Nf6 e3 g6 Be2 Bg7 O-O O-O'],
  ['Larsen-Eröffnung', 'b3 e5 Bb2 Nc6 e3 d5 Bb5 Bd6'],
  ['Ponziani', 'e4 e5 Nf3 Nc6 c3 Nf6 d4 Nxe4 d5 Ne7'],
  ['Mittelgambit', 'e4 e5 d4 exd4 Qxd4 Nc6 Qe3 Nf6 Nc3 Bb4'],
  ['Evansgambit', 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4 Bxb4 c3 Ba5 d4 exd4 O-O'],
  ['Moderne Verteidigung', 'e4 g6 d4 Bg7 Nc3 d6 Be3 a6 Qd2 b5'],
  ['Trompowsky-Angriff', 'd4 Nf6 Bg5 Ne4 Bf4 c5 f3 Qa5+ c3 Nf6'],
  ['Colle-System', 'd4 d5 Nf3 Nf6 e3 e6 Bd3 c5 c3 Nc6 Nbd2 Bd6 O-O O-O'],
];

let TRIE = null;
function build(Chess) {
  TRIE = { next: {}, name: null };
  for (const [name, line] of OPENINGS) {
    let node = TRIE;
    for (const san of line.split(' ')) {
      node.next[san] ??= { next: {}, name: null, count: 0 };
      node = node.next[san];
      node.count++;
      if (!node.name) node.name = name;
    }
  }
}

/** Liefert für eine Zugfolge (SAN) wie lange sie im Buch bleibt + Eröffnungsname */
export function bookInfo(sans) {
  if (!TRIE) build();
  let node = TRIE, depth = 0, name = null;
  for (const san of sans) {
    const n = node.next[san];
    if (!n) break;
    node = n; depth++; name = n.name;
  }
  return { depth, name };
}

/** Zufälliger Buchzug (gewichtet nach Häufigkeit) oder null */
export function bookMove(sans) {
  if (!TRIE) build();
  let node = TRIE;
  for (const san of sans) { node = node.next[san]; if (!node) return null; }
  const opts = Object.entries(node.next);
  if (!opts.length) return null;
  const total = opts.reduce((s, [, n]) => s + n.count, 0);
  let r = Math.random() * total;
  for (const [san, n] of opts) { r -= n.count; if (r <= 0) return san; }
  return opts[0][0];
}
