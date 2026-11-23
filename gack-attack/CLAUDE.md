# Gack Attack

2D-Tower-Defense im Browser, Stil wie Bloons TD 6. Hoftiere verteidigen Omas Kekse gegen eine Waschbär-Bande.
Alles steckt in **einer Datei: `index.html`** (HTML + CSS + JS, Schriften als Base64 eingebettet, keine externen Abhängigkeiten, läuft offline per Doppelklick).

## Sprache & Ton
- Alle Texte im Spiel auf Deutsch, Du-Form, trockener Humor, leicht schwarz. Gegner "zerplatzen", nichts Blutiges im realistischen Sinn.
- Mit Arthur (dem Entwickler) direkt und kurz reden.

## Aufbau von index.html
Der JS-Code ist in Abschnitte mit Kommentar-Bannern `/* ============ NAME ============ */` gegliedert. Viele Funktionen stehen sehr kompakt auf einer Zeile.
- **Daten:** `MAPS` (4 Maps: hof, sumpf, alm, vulkan; Wegpunkte `pts`, Theme `th`), `TD` (Tiere: `lv` = 3 Stufen, `evo` = 2 Evolutionen a/b), `ED` (Gegner), `PERKS` (Rezeptbuch-Karten), `META_UP` (Speisekammer), `ACH` (23 Erfolge), `DIFFS`.
- **Zustand:** `S` (aktuelles Spiel, `fresh()` baut es neu), `PK` (Effekte der gewählten Rezepte, `freshPK()`), `META` (dauerhaft, localStorage).
- **Zeichnen:** `DRAWT` (Tier-Sprites, von oben, Blick nach +x), `DRAWE` (Gegner-Sprites), `renderBG()` (Map-Hintergrund, einmal pro Map), `render()` (jeder Frame). Sprites werden in `sprite()` gecacht.
- **Logik:** `update(dt)`, `updateTower`, `FIRE` (Schuss pro Tier), `hurt()`, `kill()`, `buildWave(n)`, `startWave()`, `waveCleared()`.
- **Neue Systeme (v6):** Heldin Oma (`heroStats`, `heroXP`, `updOma`, `heroAbility`), Bienen (`updBees`, `updBeeSwarm`), Zitteraal (`updAal`, `boltPath`), Gold-Gans (`updGans`, `roundIncome`), Verpuffung (`verpuff`), Mythisch (`ascend`), Nacht-Licht (`drawNight`), Wellen-Vorschau (`renderPreview`), Rezeptbuch (`openCards`, `pickCard`), Speisekammer (`metaScreen`), Musik (`Music`, prozedural mit WebAudio).
- **Sound:** `Sfx.play('name')`, alles synthetisch per WebAudio, keine Audiodateien.
- **localStorage-Keys:** `gack5-ach`, `gack5-tot`, `gack5-best`, `gack5-mute`, `gack5-diff`, `gack6-meta`, `gack6-music`.

## Steuerung
1–0 Tiere wählen, H Oma, Leertaste Welle/Tempo, U Upgrade, Q/E Oma-Fähigkeiten, R Omas Zorn, T Mähdrescher, Esc Pause/Abbrechen, Shift-Klick mehrere setzen.

## Testen
- Schnell: `index.html` im Browser öffnen.
- Dev-Modus: `index.html#dev` → 99'999 Mais, voller Zorn, `window.__G` gibt Zugriff auf `S`, `openCards`, `heroXP`, `startWave`, `endScreen`.
- Automatisch: `pip install playwright && playwright install chromium`, dann `python tests/play_test.py 2 a` (Map-Index 0–3, Präfix für Screenshots). Screenshots landen in `tests/screens/`. Nach jeder Änderung laufen lassen und auf `PAGEERR` prüfen.

## Bekannte offene Punkte
- Balance ab Runde 15 nur stichprobenartig getestet (v. a. Hart + Vulkan).
- Code ist eine einzige Datei mit langen Zeilen. Sinnvoller nächster Schritt: in Module aufteilen (z. B. `src/data.js`, `src/sprites.js`, `src/game.js`, `src/ui.js`) mit einem kleinen Build-Skript, das wieder eine einzelne `index.html` zum Weitergeben erzeugt.
- Kein Touch-Feinschliff fürs Handy (Hover-Vorschau beim Platzieren fehlt auf Touch).

## Regeln für Änderungen
- Die fertige `index.html` muss immer offline per Doppelklick laufen. Keine CDN-Links, keine externen Dateien im Endprodukt.
- Grafikstil beibehalten: weiche Kugel-Shading-Formen (`ball()`), dunkle Konturen, satte Farben, Draufsicht.
- Neue Tiere brauchen: Eintrag in `TD` + `ORDER`, Sprite in `DRAWT`, Logik (`FIRE` oder eigene `upd…`), Zeile in `statRows`, ggf. Glow-Farbe in `drawTower`.
