#!/bin/bash
# Baut die Browser-Version nach krawall/web/ und bereitet sie für den Claude-Artefakt-Host vor:
# index.wasm -> gzip -> Base64-Text, index.pck -> Base64-Teile (je < 20 MB), Lader-Skript in index.html.
set -e
HIER="$(cd "$(dirname "$0")" && pwd)"
WEB="$HIER/../web"
rm -rf "$WEB" && mkdir -p "$WEB"
cd "$HIER/../spiel"
godot --headless --path . --export-release "Web" ../web/index.html >/dev/null 2>&1
cd "$WEB"
sed -i 's/"ensureCrossOriginIsolationHeaders":true/"ensureCrossOriginIsolationHeaders":false/' index.html
python3 - "$HIER/web_lader.html" <<'PY'
import base64, gzip, sys, re
lader = open(sys.argv[1]).read()
open('index.wasm.gz.b64.txt', 'w').write(base64.b64encode(gzip.compress(open('index.wasm', 'rb').read(), 9)).decode())
pck = open('index.pck', 'rb').read()
teile = []
for i in range(0, len(pck), 10_000_000):
    name = f'index.pck.teil{len(teile)}.b64.txt'
    open(name, 'w').write(base64.b64encode(pck[i:i + 10_000_000]).decode())
    teile.append(name)
lader = re.sub(r"const PCK_TEILE = \[.*?\];", "const PCK_TEILE = [" + ", ".join(f"'{t}'" for t in teile) + "];", lader)
s = open('index.html').read()
s = s.replace('<script src="index.js"></script>', lader + '<script src="index.js"></script>', 1)
open('index.html', 'w').write(s)
print("Teile:", teile)
PY
echo "Fertig: $WEB"
