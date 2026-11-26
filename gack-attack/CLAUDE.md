# Gack Attack

2D-Tower-Defense im Browser, Stil wie Bloons TD 6. Hoftiere verteidigen Omas Kekse gegen eine Waschbär-Bande.
Alles steckt in **einer Datei: `index.html`** (HTML + CSS + JS, Schriften als Base64 eingebettet, keine externen Abhängigkeiten, läuft offline per Doppelklick).

## Sprache & Ton
- Alle Texte im Spiel auf Deutsch, Du-Form, trockener Humor, leicht schwarz. Gegner "zerplatzen", nichts Blutiges im realistischen Sinn.
- Mit Arthur (dem Entwickler) direkt und kurz reden.

## Aufbau von index.html
Der JS-Code ist in Abschnitte mit Kommentar-Bannern `/* ============ NAME ============ */` gegliedert. Viele Funktionen stehen sehr kompakt auf einer Zeile.
- **Daten:** `MAPS` (6 Maps: hof, sumpf, alm, vulkan, mais, see; Wegpunkte `pts`, Theme `th`), `TD` (Tiere: `lv` = 3 Stufen, `evo` = 2 Evolutionen a/b), `ED` (Gegner), `PERKS` (Rezeptbuch-Karten), `META_UP` (Speisekammer), `ACH` (32 Erfolge), `DIFFS`.
- **Zustand:** `S` (aktuelles Spiel, `fresh()` baut es neu), `PK` (Effekte der gewählten Rezepte, `freshPK()`), `META` (dauerhaft, localStorage).
- **Zeichnen:** `DRAWT` (Tier-Sprites, von oben, Blick nach +x), `DRAWE` (Gegner-Sprites), `renderBG()` (Map-Hintergrund, einmal pro Map), `render()` (jeder Frame). Sprites werden in `sprite()` gecacht.
- **Logik:** `update(dt)`, `updateTower`, `FIRE` (Schuss pro Tier), `hurt()`, `kill()`, `buildWave(n)`, `startWave()`, `waveCleared()`.
- **Neue Systeme (v6):** Heldin Oma (`heroStats`, `heroXP`, `updOma`, `heroAbility`), Bienen (`updBees`, `updBeeSwarm`), Zitteraal (`updAal`, `boltPath`), Gold-Gans (`updGans`, `roundIncome`), Verpuffung (`verpuff`), Mythisch (`ascend`), Nacht-Licht (`drawNight`), Wellen-Vorschau (`renderPreview`), Rezeptbuch (`openCards`, `pickCard`), Speisekammer (`metaScreen`), Musik (`Music`, prozedural mit WebAudio).
- **Sound:** `Sfx.play('name')`, alles synthetisch per WebAudio, keine Audiodateien.
- **localStorage-Keys:** `gack5-ach`, `gack5-tot`, `gack5-best`, `gack5-mute`, `gack5-diff`, `gack6-meta`, `gack6-music`, `gack7-camp`, `gack7-mode`.

## Neu in v7 (Abschnitt `v7: ...` vor `LOOP`)
- **Nur PC:** `pcCheck()` zeigt `#pconly` auf Touch-Geräten und Fenstern unter 900×500.
- **Bosse:** `BOSSES` (Name, Spruch, 2 Phasen-Namen), `bossInit`, `bossIntro` (Szene mit Zoom/Letterbox, `S.cine`), `bossTick` (Phasen bei 66/33 %, Fähigkeiten pro Map), `bossPhase` (Schild 1,6 s), `bossDeath`. Neuer Endboss `ED.pate` = Don Kralle (`DRAWE.boss_pate`).
- **Endlos:** Map-Bildschirm Klassisch/Endlos (`MODE`, `gack7-mode`). Mutatoren `MUTS` ab Runde 10 alle 5 Runden (`mutHook`, `addMut`, `applyMuts`), Bosse alle 10, Don Kralle alle 25 Runden. Rekord in `BEST[map+'_e']`.
- **Kampagne:** `CAMP` (4 Kapitel × 3 Missionen mit `waves`, `allow`, `noEvo`, `muts`, `corn`, `lives`, `boss`, `pre`/`post`-Dialogen), Sprecher in `SPK`, Fortschritt `gack7-camp`. Regeln laufen über `S.rule`, `S.maxW` ersetzt `MAXW` im Spiel.
- **Juice:** `S.hitstop`, `camPunch`/`updCam`/`applyCam`, `drawOverlay` (Combo-Glühen, Herzschlag bei wenig Keksen, Boss-Namenskarte), `pop`/`ripple`-FX, `confetti`.
- Bestehende Funktionen werden am Ende des v7-Abschnitts umhüllt (`startMap`, `endScreen`, `win`, `show`, `showUp`, `selectShop`, `buildWave`, `spawnEnemy`, `titleScreen`, `mapScreen`).

## Neu in v8 (Abschnitt `v8: ...` nach v7)
- **Schwieriger:** `DIFFS` angehoben, neue Stufe Albtraum (ab Hof-Rang 5), größeres Wellenbudget, zusätzliche Gegner ab Runde 8 (außer Kampagne), Elite-Gegner (`makeElite`, `ELITE`) ab Runde 6.
- **Talente:** nach der Evolution 3 Stufen mit je 2 Ästen (`TAL`, `TALC`, `buyTal`, `talHTML`, Effekte in `stats`/`dmgMul`/`kill`-Hüllen).
- **Maps:** `mais` (Maisfeld bei Nacht, Boss Kasimir) und `see` (Badesee, Boss Balduin), freigeschaltet über Hof-Rang 3/6 oder die Kampagne (`MAPLV`, `mapOpen`). Kampagne hat jetzt 6 Kapitel und 18 Missionen.
- **Hof-Rang:** `META.xp`, `plv()`, `xpNeed`, Belohnungen pro Rang in `REWARDS`, EP und Rangaufstieg im Endscreen.
- **Speisekammer:** neu Omas Wutanfall, Opas Werkstatt, Talentschule, Kopfjäger.
- **Comic-FX:** Mündungsfeuer (`shotFx`, `muzzle`), Rückstoß in `drawTower`-Hülle, Treffer-Bursts (`hitFx`, `burst`), Geschoss-Spuren (`trails`), Raster am Bildrand (`halftone`).
- Test: `python tests/v8_test.py`.

## App (PWA)
- `manifest.webmanifest`, `sw.js` (Netz zuerst, sonst Cache) und `icons/` machen das Spiel über GitHub Pages in Chrome/Edge am PC installierbar. Bei neuen Dateien die Liste `FILES` in `sw.js` ergänzen und `CACHE` hochzählen.

## Steuerung
1–0 Tiere wählen, H Oma, Leertaste Welle/Tempo, U Upgrade, Q/E Oma-Fähigkeiten, R Omas Zorn, T Mähdrescher, Esc Pause/Abbrechen, Shift-Klick mehrere setzen.

## Testen
- Schnell: `index.html` im Browser öffnen.
- Dev-Modus: `index.html#dev` → 99'999 Mais, voller Zorn, `window.__G` gibt Zugriff auf `S`, `openCards`, `heroXP`, `startWave`, `endScreen`.
- v7-Test: `python tests/v7_test.py` (Kampagne, Dialog, Bosse aller Maps, Endlos, Endscreens).
- Trailer: `node trailer/record.js` und dann `trailer/make.sh` → `trailer/gack-attack-trailer.mp4`.
- Automatisch: `pip install playwright && playwright install chromium`, dann `python tests/play_test.py 2 a` (Map-Index 0–3, Präfix für Screenshots). Screenshots landen in `tests/screens/`. Nach jeder Änderung laufen lassen und auf `PAGEERR` prüfen.

## Bekannte offene Punkte
- Balance ab Runde 15 nur stichprobenartig getestet (v. a. Hart + Vulkan).
- Code ist eine einzige Datei mit langen Zeilen. Sinnvoller nächster Schritt: in Module aufteilen (z. B. `src/data.js`, `src/sprites.js`, `src/game.js`, `src/ui.js`) mit einem kleinen Build-Skript, das wieder eine einzelne `index.html` zum Weitergeben erzeugt.
- Bewusst nur PC. Handy ist gesperrt.
- Balance der Kampagne und von Don Kralle (7000 Basis-LP) nur grob getestet.

## Regeln für Änderungen
- Die fertige `index.html` muss immer offline per Doppelklick laufen. Keine CDN-Links, keine externen Dateien im Endprodukt.
- Grafikstil beibehalten: weiche Kugel-Shading-Formen (`ball()`), dunkle Konturen, satte Farben, Draufsicht.
- Neue Tiere brauchen: Eintrag in `TD` + `ORDER`, Sprite in `DRAWT`, Logik (`FIRE` oder eigene `upd…`), Zeile in `statRows`, ggf. Glow-Farbe in `drawTower`.
