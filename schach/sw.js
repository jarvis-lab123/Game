// Offline-Cache für Claude Chess: Netz zuerst, sonst Cache (Engine & Figuren werden beim ersten Start gespeichert)
const CACHE = 'claudechess-v1';
const FILES = ['./', 'index.html', 'style.css', 'manifest.webmanifest',
  'js/app.js', 'js/engine.js', 'js/board.js', 'js/ranks.js', 'js/analysis.js', 'js/openings.js', 'js/sound.js', 'js/puzzles.js',
  'vendor/chess.js', 'engine/stockfish-19-lite-single.js', 'engine/stockfish-19-lite-single.wasm',
  ...['K', 'Q', 'R', 'B', 'N', 'P'].flatMap(p => ['w' + p, 'b' + p]).map(p => `pieces/${p}.svg`),
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== CACHE).map(n => caches.delete(n))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); return r; }).catch(() => caches.match(e.request)));
});
