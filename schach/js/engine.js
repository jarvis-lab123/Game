// Stockfish-Anbindung (UCI über Web Worker). Alle Befehle laufen nacheinander in einer Warteschlange.
const MATE = 100000;

export class Engine {
  constructor(path = 'engine/stockfish-19-lite-single.js') {
    this.path = path;
    this.worker = null;
    this.listeners = new Set();
    this.chain = Promise.resolve();
    this.readyP = null;
  }

  start() {
    if (this.readyP) return this.readyP;
    this.worker = new Worker(this.path);
    this.worker.onmessage = e => {
      const line = typeof e.data === 'string' ? e.data : String(e.data);
      for (const l of [...this.listeners]) l(line);
    };
    this.readyP = (async () => {
      await this.waitFor('uci', l => l === 'uciok');
      this.post('setoption name Hash value 32');
      await this.isReady();
    })();
    return this.readyP;
  }

  post(cmd) { this.worker.postMessage(cmd); }

  waitFor(cmd, test) {
    return new Promise(res => {
      const fn = l => { if (test(l)) { this.listeners.delete(fn); res(l); } };
      this.listeners.add(fn);
      if (cmd) this.post(cmd);
    });
  }

  isReady() { return this.waitFor('isready', l => l === 'readyok'); }

  // Führt eine Aufgabe exklusiv aus (kein anderer Befehl dazwischen)
  run(task) {
    const p = this.chain.then(() => this.start()).then(task);
    this.chain = p.catch(() => {});
    return p;
  }

  setOptions(opts) {
    return this.run(async () => {
      for (const [k, v] of Object.entries(opts)) this.post(`setoption name ${k} value ${v}`);
      await this.isReady();
    });
  }

  newGame() {
    return this.run(async () => { this.post('ucinewgame'); await this.isReady(); });
  }

  /**
   * Analysiert eine Stellung.
   * Rückgabe: { lines: [{ score, mate, pv:[uci], depth }], best }
   * score ist immer aus Sicht der Seite am Zug (Matt = ±MATE).
   */
  analyse(fen, { depth = 0, movetime = 0, multipv = 1, nodes = 0, onInfo = null } = {}) {
    return this.run(async () => {
      this.post(`setoption name MultiPV value ${multipv}`);
      await this.isReady();
      const lines = [];
      const onLine = l => {
        if (!l.startsWith('info ') || !l.includes(' pv ')) return;
        const mp = +(l.match(/ multipv (\d+)/) || [0, 1])[1];
        const sc = l.match(/ score (cp|mate) (-?\d+)/);
        if (!sc) return;
        const d = +(l.match(/ depth (\d+)/) || [0, 0])[1];
        const pv = l.split(' pv ')[1].trim().split(/\s+/);
        let score, mate = null;
        if (sc[1] === 'cp') score = +sc[2];
        else { mate = +sc[2]; score = mate > 0 ? MATE - mate : -MATE - mate; if (mate === 0) score = -MATE; }
        lines[mp - 1] = { score, mate, pv, depth: d };
        if (mp === 1 && onInfo) onInfo(lines[0], l);
      };
      this.listeners.add(onLine);
      this.post(`position fen ${fen}`);
      let go = 'go';
      if (depth) go += ` depth ${depth}`;
      if (movetime) go += ` movetime ${movetime}`;
      if (nodes) go += ` nodes ${nodes}`;
      if (!depth && !movetime && !nodes) go += ' depth 12';
      const bm = await this.waitFor(go, l => l.startsWith('bestmove'));
      this.listeners.delete(onLine);
      const best = bm.split(' ')[1];
      return { lines: lines.filter(Boolean), best: best === '(none)' ? null : best };
    });
  }

  stop() { if (this.worker) this.post('stop'); }
}

export { MATE };
