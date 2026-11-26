// Kopiert das Spiel (eine index.html + Icons) nach desktop/www, das Tauri einpackt.
const fs = require('fs'), path = require('path');
const src = path.resolve(__dirname, '..'), out = path.join(__dirname, 'www');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });
let html = fs.readFileSync(path.join(src, 'index.html'), 'utf8');
// In der App braucht es keinen Service Worker und kein Web-Manifest.
html = html.replace(/<link rel="manifest"[^>]*>\n?/, '').replace(/<script>if\('serviceWorker'[^<]*<\/script>\n?/, '');
fs.writeFileSync(path.join(out, 'index.html'), html);
for (const f of ['icon-192.png', 'icon-512.png']) fs.copyFileSync(path.join(src, 'icons', f), path.join(out, 'icons', f));
console.log('www bereit:', fs.readdirSync(out));
