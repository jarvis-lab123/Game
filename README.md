# ☀ LUMEN – Sonnenflug (3D)

**Neu:** ein eigenständiges 3D-Flugerlebnis im Ordner [`3d/`](3d/). Starten: `3d/index.html` öffnen oder im 2D-Hauptmenü auf **„✦ NEU: Sonnenflug 3D“** tippen.

Du bist der letzte Funke einer zerbrochenen Sonne und fliegst in rasantem Tempo durch fünf sterbende Welten, bis zu Umbra, dem Schattenkönig.

- **5 Welten, fließend ineinander übergehend:** Flüsterwald (Riesenbäume, Nordlichter), Versunkene Stadt (Wolkenkratzer im Meer), Aschenwüste (Obelisken, Steinringe, Lavafontänen), Gläserner Himmel (die Welt fällt weg, du fliegst über den Wolken durch Kristallfelder) und Herz der Nacht (Sonnenfinsternis, Schattendornen)
- **Bossfinale gegen Umbra:** ein riesiges Auge mit Dornenkrone, Schattenkugeln, Mauern mit Lücke, Klingen und Spiralsalven in 3 Phasen. Du triffst ihn, indem du durch die weißgoldenen Ringe fliegst, denn jeder Ring feuert eine Sonnenlanze.
- **Epilog:** Die Sonne erwacht, die Welt wird golden. Der Twist wird hier nicht verraten.
- **Flow-Mechaniken:** goldene Ringe für Serien und Multiplikator bis ×8, *Knapp vorbei*-Boni, *Mitten durch* bei Steinringen und Glastoren, Glut-Boost mit Überlicht-Effekt, Flammenherzen für Extraleben
- **Look:** eigene Shader (unendliches Terrain, Himmel mit Sternen, Nordlicht und Sonnenfinsternis, Wolkenmeer, Wasser), Bloom, chromatische Aberration, Radial-Blur beim Boost, Leuchtspuren, Partikel und Kamerawackeln
- **Sound:** Der komplette Soundtrack wird live synthetisiert (Pads, Bass, Arpeggios, Drums mit Sidechain). Jede Welt hat eigenes Tempo und eigene Akkorde, und die Ringe spielen Töne passend zum aktuellen Akkord. Kopfhörer empfohlen.
- **Endlosflug:** alle Welten im Kreis, jede Runde schneller, mit eigener Rekordliste
- **Checkpoints:** Nach dem Tod geht es am Anfang des aktuellen Kapitels weiter, auch nach einem Neuladen.

**Steuerung:** Maus bewegen oder WASD/Pfeiltasten · **Leertaste/Maustaste halten = Boost** · Esc/P Pause · M Ton
Handy: Finger ziehen, BOOST-Knopf halten · Gamepad: linker Stick, A/RT = Boost

Läuft komplett offline. Three.js liegt lokal unter `3d/lib/` (MIT-Lizenz).

---

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
| `3d/game3d.js` | Sonnenflug 3D: Welt, Shader, Boss, Musik-Synth |
| `3d/lib/` | Three.js r170 + Postprocessing (lokal eingebunden, damit es offline läuft) |

## Als App installieren

Das Spiel ist eine installierbare Web-App (PWA) und läuft nach der Installation auch offline.

1. Auf GitHub unter **Settings → Pages → Source** die Option **GitHub Actions** wählen. Danach veröffentlicht der Workflow `.github/workflows/pages.yml` das Spiel bei jedem Push.
2. Die Pages-Adresse (`https://<user>.github.io/Game/`) auf dem Handy öffnen.
   - **iPhone (Safari):** Teilen → „Zum Home-Bildschirm“
   - **Android (Chrome):** Menü ⋮ → „App installieren“
3. Lumen startet dann im Vollbild mit eigenem Icon, wie eine normale App.
