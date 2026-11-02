# ✦ LUMEN – Der letzte Funke

Ein 2D-Story-Action-Roguelite für den Browser. Du bist **Lumen**, der letzte Funke einer zerbrochenen Sonne.
Überlebe Horden von Schatten, werde mit jedem Level heller und hol dir die fünf Sonnenscherben von Umbra, dem Schattenkönig, zurück.

## Spielen

`index.html` im Browser öffnen. Kein Build und keine Installation nötig, alles läuft offline (Grafik und Sound werden live erzeugt).

Oder lokal starten: `npx serve .`

**Steuerung:** WASD / Pfeiltasten · auf Handy/Tablet: irgendwo hinziehen (virtueller Joystick) · angegriffen wird automatisch
`1`–`4` Karte wählen · `R` Neuwurf · `Esc`/`P` Pause · `Leertaste` Dialog weiter

## Was drin ist

- **Story in 5 Kapiteln** mit Dialogen, Cliffhangern und einem Twist-Finale: Flüsterwald, Versunkene Stadt, Aschenwüste, Gläserner Himmel, Herz der Nacht
- **5 Bosse** mit eigenen Angriffsmustern (Kugelringe, Spiralen, Sturmangriffe, Beschwörungen), der Endboss hat eine zweite Phase
- **6 Waffen + 8 Gaben**, jedes Level-up bietet 3 Karten zur Wahl
- **Erwachen:** Waffe auf Stufe 5 + passende Gabe auf Stufe 2 ergibt eine goldene Superwaffe (z. B. Lichtpfeil + Eile = *Sonnenspeer*)
- **Combos, Truhen von Elite-Gegnern, Schwarm-Wellen, Sonnenbomben, Sog-Magnete**
- **Seelenschmiede:** Funken bleiben dir auch, wenn du stirbst, und werden in dauerhafte Upgrades gesteckt
- **Ewige Nacht:** Endlosmodus mit Rekordjagd (wird nach Kapitel I freigeschaltet)
- **Tägliches Licht:** Login-Belohnung mit Serien-Bonus
- Dein Lichtradius wächst mit deinem Level. Du wirst buchstäblich heller.
- Automatischer Spielstand im Browser (localStorage)

## Dateien

| Datei | Inhalt |
|---|---|
| `index.html` | Grundgerüst |
| `style.css` | Menüs, Karten, Dialoge |
| `game.js` | Die ganze Spiellogik, das Rendering (Canvas) und der Synth-Sound (WebAudio) |

## Als App installieren

Das Spiel ist eine installierbare Web-App (PWA) und läuft nach der Installation auch offline.

1. Auf GitHub unter **Settings → Pages → Source** die Option **GitHub Actions** wählen. Danach veröffentlicht der Workflow `.github/workflows/pages.yml` das Spiel bei jedem Push.
2. Die Pages-Adresse (`https://<user>.github.io/Game/`) auf dem Handy öffnen.
   - **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“
   - **Android (Chrome):** Menü ⋮ → „App installieren“
3. Lumen startet dann im Vollbild mit eigenem Icon, wie eine normale App.

## Windows-App

`desktop/windows/` enthält eine kleine native Windows-App (Go + Microsoft WebView2, etwa 7 MB, ohne Browserfenster).
Bauen mit `desktop/windows/build.sh`. Das Ergebnis ist `desktop/windows/Lumen.exe`.
Der Spielstand liegt unter `%LOCALAPPDATA%\Lumen`.

---

# ⛳ Alpine Grand Slam (Handy-App)

Das 3D-Golfspiel *Alpine Grand Slam* liegt im Ordner `alpine/` und ist fürs Handy im **Querformat** optimiert:
kompaktes Spiel-HUD, Schwung per Finger ziehen, Vollbild mit Querformat-Sperre und ein „Handy drehen“-Hinweis im Hochformat.
Three.js und die Schriften liegen mit im Ordner, deshalb läuft die App nach dem ersten Start auch offline.

**Neu in Version 25 – Ryder Cup (Grand Slam 4):** eine neue Story in rund 30 Minuten, komplett im Matchplay.
Kapitel 1–2 sind die *Matchplay-Edition* (Matchplay-WM in Crans-Montana und Andermatt, K.-o. bis zum Finale gegen Tyler Voss),
Kapitel 3–4 die *Ryder-Cup-Edition* in Rom: Vierball mit Mila oder Kai, dann das Sonntags-Einzel, das den Cup entscheidet.
Loch für Loch zählt (2 UP, Dormie, 3&2, Extraloch), Entscheidungen verändern Partner, Startposition und Dialoge.

**Neu in Version 26 – Die Weltreise (Grand Slam 5):** rund zwei Stunden Story auf den Spuren eines Tagebuchs von 1974.
13 neue Plätze auf sechs Kontinenten (Lavaux, Island, Leopard Creek, Marrakech, Fuji, Halong-Bucht, Bali, Cape Kidnappers,
Tasmanien, Patagonien, Hawaii, Arosa, Aletschgletscher) mit acht neuen Landschaften (Weinberge, Vulkan, Savanne, Oase,
Kirschblüten, Karstfelsen, Anden, Lava). Neue Spielformen: Skins Game, Scramble mit Partnerin, Sturm, Monsun und ein
Matchplay-Finale auf dem Gletscher. Fünf Entscheidungen verändern Dialoge, Fähigkeiten und den Epilog.

**Neu in Version 27 – Die Krone (Grand Slam 6, das grosse Finale):** rund fünf Stunden Story, in der alle bisherigen
Geschichten zusammenlaufen. Die Alpine Crown von 1926 soll eingeschmolzen werden – nur wer die Legenden-Saison besteht,
kann sie retten. 28 Turniere in 9 Kapiteln auf 9 neuen Plätzen (Kandersteg, Gleneagles, Valderrama, Royal County Down,
Yas Links, Jeju, Thimphu, Ushuaia, Jungfraujoch), 9 Spielformen (Zählspiel, Matchplay, Skins, Scramble, Vierball,
Stableford, Closest to the Pin, Longest Drive, Putting-Duell) und 9 Erfolge mit dauerhaften Boni. Mentoren aus allen
Teilen kehren zurück: Leon Walter, Jannik, Mila, Valentin, Lena, Sepp, Kai, Nora, Tyler, Rafael, Noa, Hana Kim und mehr.

**Installieren** (nachdem GitHub Pages wie oben eingerichtet ist):

1. Auf dem Handy `https://jarvis-lab123.github.io/Game/alpine/` öffnen.
2. **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“. **Android (Chrome):** Menü ⋮ → „App installieren“.
3. Die App „Grand Slam“ startet im Vollbild und im Querformat.

| Datei | Inhalt |
|---|---|
| `alpine/index.html` | Das ganze Spiel (Story, 3D-Plätze, Physik) inkl. Handy-Layout (`v24 Handy · Querformat`) |
| `alpine/manifest.webmanifest`, `alpine/sw.js` | App-Installation (Querformat, Vollbild) und Offline-Cache |
| `alpine/vendor/three/` | Three.js 0.169 (nur die benutzten Module, MIT-Lizenz) |
| `alpine/fonts/` | Saira Condensed, Libre Franklin, Caveat (SIL Open Font License) |

## Android-App (ohne Store, ohne Hosting)

`android/build.sh` baut `android/AlpineGrandSlam.apk`: eine Vollbild-App im Querformat, die das Spiel komplett offline aus der App lädt.
Benötigt nur Ubuntu-Pakete: `apt-get install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 default-jdk`.
Die Datei `android/grandslam.keystore` signiert alle Versionen gleich, damit Updates über die alte App installiert werden können (der Spielstand bleibt erhalten).

---

# ⛳ Plopp – Daily Golf (Handy, Hochformat)

Schlichtes 2D-Minigolf im Ordner `plopp/`. Ein Finger: zurückziehen, zielen, loslassen.

- **Tagesloch:** jeden Tag ein neues, zufällig erzeugtes Loch (für alle gleich, immer lösbar). Nur der erste Versuch zählt, mit Serie 🔥 und Ergebnis zum Teilen.
- **Der Platz:** 18 handgebaute Löcher mit Sand, Wasser, Eis, Hängen, Schanzen, Bumpern und beweglichen Mühlen.
- **6 Fähigkeiten**, einsetzbar während der Ball rollt: ✋ Stopp · ⤴️ Sprung · 👻 Geist · ⚡ Turbo · 🧲 Magnet · 🎯 Umlenken.
  Mit Münzen freischalten und bis Stufe 3 verbessern (mehr Ladungen pro Loch, stärkerer Effekt). Beim Tagesloch hat jeder alle Fähigkeiten 1×.

**Installieren:** `https://jarvis-lab123.github.io/Game/plopp/` auf dem Handy öffnen → „Zum Home-Bildschirm“ (iPhone) bzw. „App installieren“ (Android). Läuft danach offline.

---

# 🏌️ Fairway – Golf-Karriere (Handy, Hochformat) · Version 1.8

2D-Golf von oben im Low-Poly-Stil im Ordner `fairway/`: Ballflug mit Höhe, Wind, Wetter, Bäume, Bunker, Wasser, Aus und Putt-Ringe auf geneigten Grüns.

**Plätze & Landschaften:** 24 Plätze (Par 72, je 18 Löcher) in 11 Landschaften – Parkland, Links, Wüste, Alpen, Tropen, Herbstwald, Winterland, Vulkan (Lava!), Kirschblüte, Savanne und Heide. Jeder Platz hat Signature-Löcher: Inselgrün, Schlucht-Carry, Halbinsel-Grün oder angreifbares kurzes Par 4. Dazu fallende Blüten, Laub, Schnee und Glutfunken.
Lochlängen von 100 m (Par 3) bis 570 m (Par 5), bergauf/bergab mit „spielt wie“-Distanz und Höhenlinien.
**Wetter:** sonnig, bewölkt, windig, Sturm (mit Böen), Regen, Nebel, Hitze, Abendsonne – je nach Landschaft unterschiedlich häufig.

**Spielmodi**
- **Karriere:** Amateur Tour → Challenge Tour → Continental Tour → World Tour → Grand Slam (4 Majors), je 4 Turniere über 18 Löcher (Runde wird gespeichert und lässt sich fortsetzen) gegen 11 Gegner mit Live-Leaderboard und Preisgeld. Finale: das Major „The Crown“.
- **Matchplay Cup:** 1 gegen 1, Loch für Loch, K.-o.-Turnierbaum mit 8 Spielern (Viertelfinale, Halbfinale, Finale, Stechen bei Gleichstand). Bronze, Silber und Gold Cup.
- **Closest to the Pin:** 5 Bälle auf ein Par 3, Medaillen nach Abstand zur Fahne.
- **Longest Drive:** 5 Drives, nur das Fairway zählt.
- **Plätze / Freies Spiel:** jeden Platz mit 9 oder 18 Löchern spielen.

**Lebendige Plätze:** Tiere je Landschaft (Enten, Rehe, Hasen, Schafe, Füchse, Steinböcke, Kamele, Giraffen, Zebras, Flamingos, Kraniche, Schildkröten …), die vor deinem Ball flüchten, und Vogelschwärme mit Schatten. Turniere mit Zuschauern und Tribüne, Jubel bei Birdies.
**Nachtgolf:** Wetterlage „Nacht · Flutlicht“ mit Lichtkegeln, Sternen und Nordlicht im Winterland.
**Caddie Ole:** Tipps zu Wind, Hindernissen, Höhe und Lage. **Erfolge:** 22 Abzeichen mit Prämien. **Bälle & Spuren:** Gold, Neon, Eis, Feuer, Regenbogen, Galaxie.

**Erlebnis:** Live-Platz im Menü-Hintergrund, Kameraflug über jedes Loch, Spur des letzten Schlags, Klangkulisse (Wind, Meer, Vögel, Grillen, Publikum), Scorekarte im klassischen TV-Stil (unter Par rot).

**Schwierigkeit:** Leicht, Normal, Profi, Legende (Schwungtempo, Streuung, Wind, Putt-Ringe, Gegner, Preisgeld).

**Fortschritt:** XP und Level mit Skillpunkten (Kraft, Präzision, Spin, Putten, Nerven), Ausrüstung (Driver, Hölzer, Eisen, Wedges, Putter in je 5 Modellen).

**Steuerung:** Ziel antippen → Schläger, Draw/Fade, Spin wählen → „Schlagen“ → 1. Tipp stoppt die pendelnde Richtungslinie, 2. Tipp stoppt die Kraft. Auf dem Grün: goldener Ring = 1 Putt, weisser Ring = 2 Putts, Rest = 3 Putts (werden automatisch gespielt).

**Veröffentlichen / Installieren:** `fairway/` ist eine fertige Web-App (PWA) mit Manifest, Offline-Cache, Schrift „Outfit“ (SIL OFL) und App-Icons (`icons/`, inkl. maskable und 1024 px für Stores).
**Aufs iPhone (ohne Mac, ohne App Store):**
1. In **Safari** `https://jarvis-lab123.github.io/Game/fairway/` öffnen.
2. Unten auf **Teilen** tippen → **„Zum Home-Bildschirm“** → **Hinzufügen**.
3. Fairway startet dann vom Home-Bildschirm im Vollbild mit eigenem Icon und Startbild, auch offline. Der Spielstand bleibt auf dem Handy gespeichert.
`fairway/standalone.html` ist dieselbe App als Einzeldatei (Schrift und Icon eingebettet).

**Statistiken & Handicap:** Handicap-Index nach WHS-Logik (beste 8 der letzten 20 Runden, Course Rating je Platz und Wetter), Verlauf als Grafik, Fairways, GIR, Putts, 1-/3-Putts, Scrambling, Sand Saves, Chip-ins, Drive-Längen, Abstand zur Fahne, perfekte Schwünge, Score-Verteilung und die letzten Runden.

## iOS-App

`fairway-ios/` ist das fertige Xcode-Projekt (Capacitor) mit Icon, Splash, Haptik und Hochformat-Sperre.
Bauen und Veröffentlichen auf einem Mac: siehe `fairway-ios/README.md`.

## Tagwerk – Fokus-Tagesplan

Eine Aufgabe zur Zeit, Abfahrts-Countdown, ablaufender Kreis, gedrückt halten zum Abhaken, kleine Belohnungen dazwischen.

**Installieren:** In **Safari** `https://jarvis-lab123.github.io/Game/tagwerk/` öffnen → Teilen → „Zum Home-Bildschirm“.

Neuer Tag: nur das `DAY`-Objekt oben im Script von `tagwerk/index.html` ändern.
