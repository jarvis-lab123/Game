// Offline-Cache: nach dem ersten Start läuft Alpine Grand Slam ohne Internet.
const CACHE = 'ags-v29-1';
const FILES = [
  './',
  'index.html',
  'manifest.webmanifest',
  'fonts/caveat-latin-600-normal.woff2',
  'fonts/caveat-latin-700-normal.woff2',
  'fonts/caveat-latin-ext-600-normal.woff2',
  'fonts/caveat-latin-ext-700-normal.woff2',
  'fonts/fonts.css',
  'fonts/libre-franklin-latin-400-normal.woff2',
  'fonts/libre-franklin-latin-500-normal.woff2',
  'fonts/libre-franklin-latin-600-normal.woff2',
  'fonts/libre-franklin-latin-700-normal.woff2',
  'fonts/libre-franklin-latin-ext-400-normal.woff2',
  'fonts/libre-franklin-latin-ext-500-normal.woff2',
  'fonts/libre-franklin-latin-ext-600-normal.woff2',
  'fonts/libre-franklin-latin-ext-700-normal.woff2',
  'fonts/saira-condensed-latin-500-normal.woff2',
  'fonts/saira-condensed-latin-600-normal.woff2',
  'fonts/saira-condensed-latin-700-normal.woff2',
  'fonts/saira-condensed-latin-800-normal.woff2',
  'fonts/saira-condensed-latin-ext-500-normal.woff2',
  'fonts/saira-condensed-latin-ext-600-normal.woff2',
  'fonts/saira-condensed-latin-ext-700-normal.woff2',
  'fonts/saira-condensed-latin-ext-800-normal.woff2',
  'icons/apple-touch-icon.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'vendor/three/addons/loaders/GLTFLoader.js',
  'vendor/three/addons/math/SimplexNoise.js',
  'vendor/three/addons/objects/Sky.js',
  'vendor/three/addons/postprocessing/EffectComposer.js',
  'vendor/three/addons/postprocessing/GTAOPass.js',
  'vendor/three/addons/postprocessing/MaskPass.js',
  'vendor/three/addons/postprocessing/OutputPass.js',
  'vendor/three/addons/postprocessing/Pass.js',
  'vendor/three/addons/postprocessing/RenderPass.js',
  'vendor/three/addons/postprocessing/ShaderPass.js',
  'vendor/three/addons/postprocessing/UnrealBloomPass.js',
  'vendor/three/addons/shaders/CopyShader.js',
  'vendor/three/addons/shaders/GTAOShader.js',
  'vendor/three/addons/shaders/LuminosityHighPassShader.js',
  'vendor/three/addons/shaders/OutputShader.js',
  'vendor/three/addons/shaders/PoissonDenoiseShader.js',
  'vendor/three/addons/utils/BufferGeometryUtils.js',
  'vendor/three/three.module.js',
];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('ags-') && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Seite: zuerst Netz (Updates kommen an), sonst Cache. Bibliotheken/Schriften/Icons: zuerst Cache.
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(fetch(req).then(r => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then(k => k.put('index.html', c)); } return r; })
      .catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); }
    return r;
  })));
});
