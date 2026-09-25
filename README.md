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
