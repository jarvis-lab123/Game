// Offline cache so the installed app works without internet.
const CACHE = 'lumen-v2';
const FILES = ['./', 'index.html', 'style.css', 'game.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  '3d/', '3d/index.html', '3d/style3d.css', '3d/game3d.js', '3d/lib/three.module.min.js',
  '3d/lib/postprocessing/EffectComposer.js', '3d/lib/postprocessing/RenderPass.js', '3d/lib/postprocessing/ShaderPass.js',
  '3d/lib/postprocessing/UnrealBloomPass.js', '3d/lib/postprocessing/OutputPass.js', '3d/lib/postprocessing/MaskPass.js', '3d/lib/postprocessing/Pass.js',
  '3d/lib/shaders/CopyShader.js', '3d/lib/shaders/LuminosityHighPassShader.js', '3d/lib/shaders/OutputShader.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // network first (so updates arrive), cache as fallback when offline
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && new URL(e.request.url).origin === location.origin) { const c = r.clone(); caches.open(CACHE).then(k => k.put(e.request, c)); }
    return r;
  }).catch(() => caches.match(e.request)));
});
