#!/usr/bin/env bash
# Baut Lumen.exe (Windows, x64) aus dem Spiel im Repo-Hauptordner.
# Voraussetzung: Go >= 1.22. Läuft auch unter Linux/macOS (Cross-Compile).
set -euo pipefail
cd "$(dirname "$0")"
ROOT=../..
ICON=$(base64 -w0 "$ROOT/icons/icon-192.png" 2>/dev/null || base64 -i "$ROOT/icons/icon-192.png")
{
  echo '<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">'
  echo '<title>Lumen – Der letzte Funke</title>'
  echo "<link rel=\"icon\" href=\"data:image/png;base64,$ICON\">"
  echo '<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Nunito:wght@400;700;900&display=swap" rel="stylesheet">'
  echo '<style>'; cat "$ROOT/style.css"; echo '</style></head><body>'
  echo '<canvas id="c"></canvas><button id="pauseBtn" aria-label="Pause">❚❚</button><div id="ui"></div>'
  echo '<script>'; cat "$ROOT/game.js"; echo '</script></body></html>'
} > index.html
go run github.com/tc-hib/go-winres@latest make --arch amd64
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags "-H windowsgui -s -w" -o Lumen.exe .
echo "Fertig: desktop/windows/Lumen.exe"
