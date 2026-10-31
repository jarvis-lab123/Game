// Kopiert die Web-App aus ../fairway nach ./www (ohne Service Worker – in der App nicht nötig)
const fs = require('fs'), path = require('path');
const src = path.join(__dirname, '..', '..', 'fairway'), dst = path.join(__dirname, '..', 'www');
fs.rmSync(dst, { recursive: true, force: true });
const skip = new Set(['standalone.html', 'sw.js']);
(function copy(a, b) {
  fs.mkdirSync(b, { recursive: true });
  for (const f of fs.readdirSync(a)) {
    if (skip.has(f)) continue;
    const s = path.join(a, f), d = path.join(b, f);
    fs.statSync(s).isDirectory() ? copy(s, d) : fs.copyFileSync(s, d);
  }
})(src, dst);
console.log('Web-App nach www/ kopiert');
