// Animiertes Schachbrett mit Ziehen & Tippen, Pfeilen, Markierungen und Umwandlungsauswahl.
const FILES = 'abcdefgh';

export class Board {
  constructor(root, opts = {}) {
    this.root = root;
    this.opts = opts;
    this.orientation = 'w';
    this.pieces = []; // {el, code:'wN', sq}
    this.chess = null;
    this.interactive = null; // 'w' | 'b' | null
    this.selected = null;
    this.lastMove = null;
    this.marker = null;
    root.classList.add('board');
    root.innerHTML = `
      <div class="b-squares"></div>
      <div class="b-hl"></div>
      <div class="b-pieces"></div>
      <svg class="b-arrows" viewBox="0 0 800 800"><defs></defs></svg>
      <div class="b-marks"></div>
      <div class="b-promo hidden"></div>`;
    this.sqLayer = root.querySelector('.b-squares');
    this.hlLayer = root.querySelector('.b-hl');
    this.pcLayer = root.querySelector('.b-pieces');
    this.arrowSvg = root.querySelector('.b-arrows');
    this.markLayer = root.querySelector('.b-marks');
    this.promoEl = root.querySelector('.b-promo');
    this.drawSquares();
    this.bindInput();
  }

  // ---------- Koordinaten ----------
  xy(sq) {
    const f = FILES.indexOf(sq[0]), r = +sq[1] - 1;
    return this.orientation === 'w' ? [f, 7 - r] : [7 - f, r];
  }
  sqAt(x, y) {
    const f = this.orientation === 'w' ? x : 7 - x;
    const r = this.orientation === 'w' ? 7 - y : y;
    if (f < 0 || f > 7 || r < 0 || r > 7) return null;
    return FILES[f] + (r + 1);
  }
  pointToSq(e) {
    const b = this.root.getBoundingClientRect();
    const x = Math.floor((e.clientX - b.left) / b.width * 8), y = Math.floor((e.clientY - b.top) / b.height * 8);
    return this.sqAt(x, y);
  }
  place(el, sq) { const [x, y] = this.xy(sq); el.style.transform = `translate(${x * 100}%, ${y * 100}%)`; }

  drawSquares() {
    let h = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const sq = this.sqAt(x, y);
      const light = (x + y) % 2 === 0;
      let coords = '';
      if (x === 0) coords += `<span class="c-rank">${sq[1]}</span>`;
      if (y === 7) coords += `<span class="c-file">${sq[0]}</span>`;
      h += `<div class="sq ${light ? 'l' : 'd'}">${coords}</div>`;
    }
    this.sqLayer.innerHTML = h;
  }

  setOrientation(c) {
    if (c === this.orientation) return;
    this.orientation = c;
    this.drawSquares();
    this.root.classList.add('no-anim');
    for (const p of this.pieces) this.place(p.el, p.sq);
    void this.root.offsetWidth;
    this.root.classList.remove('no-anim');
    this.renderHighlights();
    this.renderArrows();
    this.renderMarker();
  }

  // ---------- Stellung ----------
  setPosition(chess, { animate = true, lastMove = null } = {}) {
    this.chess = chess;
    this.lastMove = lastMove;
    this.selected = null;
    const target = new Map();
    for (const row of chess.board()) for (const p of row) if (p) target.set(p.square, p.color + p.type.toUpperCase());
    if (!animate) this.root.classList.add('no-anim');

    const old = this.pieces;
    const keep = [], unmatchedOld = [];
    const placed = new Set();
    for (const p of old) {
      if (target.get(p.sq) === p.code && !placed.has(p.sq)) { keep.push(p); placed.add(p.sq); }
      else unmatchedOld.push(p);
    }
    const need = [...target].filter(([sq]) => !placed.has(sq));
    const next = [...keep];
    for (const [sq, code] of need) {
      // passende alte Figur (gleicher Typ, am nächsten) bewegen
      let bi = -1, bd = 99;
      unmatchedOld.forEach((p, i) => {
        if (p.code !== code) return;
        const [ax, ay] = this.xy(p.sq), [bx, by] = this.xy(sq);
        const d = Math.abs(ax - bx) + Math.abs(ay - by);
        if (d < bd) { bd = d; bi = i; }
      });
      if (bi >= 0) {
        const p = unmatchedOld.splice(bi, 1)[0];
        p.sq = sq; this.place(p.el, sq);
        p.el.classList.add('moving');
        setTimeout(() => p.el.classList.remove('moving'), 260);
        next.push(p);
      } else {
        const el = document.createElement('div');
        el.className = `pc ${code}` + (animate ? ' appear' : '');
        this.place(el, sq);
        this.pcLayer.appendChild(el);
        next.push({ el, code, sq });
      }
    }
    for (const p of unmatchedOld) {
      if (animate) { p.el.classList.add('captured'); setTimeout(() => p.el.remove(), 320); }
      else p.el.remove();
    }
    this.pieces = next;
    if (!animate) { void this.root.offsetWidth; this.root.classList.remove('no-anim'); }
    this.renderHighlights();
  }

  setInteractive(color) { this.interactive = color; this.selected = null; this.renderHighlights(); }

  // ---------- Hervorhebungen ----------
  renderHighlights() {
    let h = '';
    const add = (sq, cls) => { const [x, y] = this.xy(sq); h += `<div class="hl ${cls}" style="transform:translate(${x * 100}%,${y * 100}%)"></div>`; };
    if (this.lastMove) { add(this.lastMove.from, 'last'); add(this.lastMove.to, 'last'); }
    if (this.chess && this.chess.inCheck()) {
      const k = this.chess.findPiece({ type: 'k', color: this.chess.turn() })[0];
      if (k) add(k, 'check');
    }
    if (this.flashSq) add(this.flashSq.sq, 'flash-' + this.flashSq.kind);
    if (this.hintSq) add(this.hintSq, 'hint');
    if (this.selected) {
      add(this.selected, 'sel');
      for (const m of this.chess.moves({ square: this.selected, verbose: true })) {
        add(m.to, m.captured ? 'cap' : 'dot');
      }
    }
    this.hlLayer.innerHTML = h;
  }

  flash(sq, kind) {
    this.flashSq = { sq, kind };
    this.renderHighlights();
    clearTimeout(this._ft);
    this._ft = setTimeout(() => { this.flashSq = null; this.renderHighlights(); }, 900);
  }
  setHint(sq) { this.hintSq = sq; this.renderHighlights(); }

  setArrows(arrows = []) { this.arrows = arrows; this.renderArrows(); }
  renderArrows() {
    const arrows = this.arrows || [];
    let defs = '', body = '';
    arrows.forEach((a, i) => {
      const [x1, y1] = this.xy(a.from), [x2, y2] = this.xy(a.to);
      const c = a.color || '#7ec24a';
      const sx = x1 * 100 + 50, sy = y1 * 100 + 50, ex = x2 * 100 + 50, ey = y2 * 100 + 50;
      const dx = ex - sx, dy = ey - sy, len = Math.hypot(dx, dy);
      const ux = dx / len, uy = dy / len;
      const tx = ex - ux * 30, ty = ey - uy * 30; // Spitze nicht bis zur Mitte
      defs += `<marker id="ah${i}" markerWidth="4" markerHeight="4" refX="2.05" refY="2" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L4,2 L0,4 z" fill="${c}"/></marker>`;
      body += `<line x1="${sx + ux * 18}" y1="${sy + uy * 18}" x2="${tx}" y2="${ty}" stroke="${c}" stroke-width="17" stroke-linecap="round" opacity="${a.opacity ?? 0.85}" marker-end="url(#ah${i})"/>`;
    });
    this.arrowSvg.innerHTML = `<defs>${defs}</defs>${body}`;
  }

  setMarker(sq, sym, color) { this.marker = sq ? { sq, sym, color } : null; this.renderMarker(); }
  renderMarker() {
    if (!this.marker) { this.markLayer.innerHTML = ''; return; }
    const [x, y] = this.xy(this.marker.sq);
    this.markLayer.innerHTML = `<div class="mark pop" style="left:${(x + 1) * 12.5}%;top:${y * 12.5}%;background:${this.marker.color}">${this.marker.sym}</div>`;
  }

  // ---------- Eingabe ----------
  bindInput() {
    let drag = null;
    this.root.addEventListener('pointerdown', e => {
      if (!this.interactive || !this.chess || e.button > 0) return;
      if (!this.promoEl.classList.contains('hidden')) return;
      const sq = this.pointToSq(e);
      if (!sq) return;
      const p = this.chess.get(sq);
      // Zielfeld anklicken
      if (this.selected && this.selected !== sq && this.isLegal(this.selected, sq)) {
        this.tryMove(this.selected, sq);
        return;
      }
      if (p && p.color === this.interactive && this.chess.turn() === this.interactive) {
        e.preventDefault();
        const already = this.selected === sq;
        this.selected = sq;
        this.renderHighlights();
        const piece = this.pieces.find(x => x.sq === sq);
        drag = { sq, piece, startX: e.clientX, startY: e.clientY, moved: false, already };
        this.root.setPointerCapture(e.pointerId);
      } else {
        this.selected = null;
        this.renderHighlights();
      }
    });
    this.root.addEventListener('pointermove', e => {
      if (!drag || !drag.piece) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5) return;
      drag.moved = true;
      const b = this.root.getBoundingClientRect();
      const s = b.width / 8;
      const x = (e.clientX - b.left - s / 2) / s, y = (e.clientY - b.top - s / 2) / s;
      drag.piece.el.classList.add('dragging');
      drag.piece.el.style.transform = `translate(${x * 100}%, ${y * 100}%) scale(1.15)`;
      const over = this.pointToSq(e);
      this.root.querySelectorAll('.hl.over').forEach(n => n.remove());
      if (over && this.isLegal(drag.sq, over)) {
        const [ox, oy] = this.xy(over);
        this.hlLayer.insertAdjacentHTML('beforeend', `<div class="hl over" style="transform:translate(${ox * 100}%,${oy * 100}%)"></div>`);
      }
    });
    const end = e => {
      if (!drag) return;
      const d = drag; drag = null;
      if (d.piece) d.piece.el.classList.remove('dragging');
      if (d.moved) {
        const to = this.pointToSq(e);
        if (to && to !== d.sq && this.isLegal(d.sq, to)) {
          this.root.classList.add('no-anim');
          this.place(d.piece.el, to);
          void this.root.offsetWidth;
          this.root.classList.remove('no-anim');
          this.tryMove(d.sq, to, true);
        } else {
          this.place(d.piece.el, d.sq);
          this.renderHighlights();
        }
      } else if (d.already) {
        this.selected = null; this.renderHighlights();
      }
    };
    this.root.addEventListener('pointerup', end);
    this.root.addEventListener('pointercancel', end);
    this.root.addEventListener('contextmenu', e => e.preventDefault());
  }

  isLegal(from, to) {
    return this.chess.moves({ square: from, verbose: true }).some(m => m.to === to);
  }

  async tryMove(from, to, dragged = false) {
    const moves = this.chess.moves({ square: from, verbose: true }).filter(m => m.to === to);
    if (!moves.length) return;
    let promotion;
    if (moves.some(m => m.promotion)) {
      promotion = await this.askPromotion(to, this.chess.turn());
      if (!promotion) { this.setPosition(this.chess, { animate: true, lastMove: this.lastMove }); return; }
    }
    this.selected = null;
    this.opts.onMove?.(from, to, promotion);
  }

  askPromotion(sq, color) {
    return new Promise(res => {
      const [x, y] = this.xy(sq);
      const down = y === 0;
      const opts = ['q', 'n', 'r', 'b'];
      this.promoEl.innerHTML = '<div class="promo-bg"></div>' + opts.map((t, i) =>
        `<button class="promo-opt pc ${color}${t.toUpperCase()}" data-t="${t}" style="left:${x * 12.5}%;top:${(down ? y + i : y - i) * 12.5}%;animation-delay:${i * 40}ms"></button>`).join('');
      this.promoEl.classList.remove('hidden');
      const done = t => { this.promoEl.classList.add('hidden'); this.promoEl.innerHTML = ''; res(t); };
      this.promoEl.querySelector('.promo-bg').onclick = () => done(null);
      this.promoEl.querySelectorAll('.promo-opt').forEach(b => b.onclick = ev => { ev.stopPropagation(); done(b.dataset.t); });
    });
  }
}
