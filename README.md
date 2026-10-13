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
