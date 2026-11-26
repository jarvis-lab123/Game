# Neuen Charakter anlegen

1. `python3 werkzeuge/neuer_charakter.py <id> "Anzeigename"` (id = klein, ohne Leerzeichen, z. B. `max`)
2. Schick Claude Fotos der Person (von vorne + Ganzkörper) und sag, wie sie kämpfen soll.
   Claude modelliert die Figur in Blender und stellt Aussehen und Fähigkeiten in `charakter.json` ein.
   Selbst geht's auch: `aussehen` in `charakter.json` anpassen und
   `python3 blender/charakter_bauen.py spiel/charaktere/<id>/charakter.json` ausführen.
3. Godot öffnen und spielen: Der Charakter taucht automatisch in Sammlung und Laptops auf.

Fotos in `fotos/` bleiben lokal und kommen nicht ins Git-Repo.

## Felder in charakter.json

| Feld | Bedeutung |
|---|---|
| `seltenheit` | `gewoehnlich` · `selten` · `episch` · `mythisch` · `legendaer` (bestimmt, wie oft er aus Laptops kommt) |
| `start` | `true` = jeder Spieler hat ihn von Anfang an |
| `werte.leben` | Lebenspunkte (2800 zerbrechlich · 3600 normal · 5000 Panzer) |
| `werte.tempo` | Laufgeschwindigkeit (0.85 langsam · 1.0 normal · 1.15 schnell) |
| `angriff.typ` | `schuss` (gerade) · `schrot` (Fächer, kurz) · `wurf` (Bogen über Wände) · `nahkampf` (Schlag) |
| `angriff.*` | `schaden`, `projektile`, `streuung` (Grad), `reichweite` (m, 1 Kachel = 1,6 m), `nachladen` (s pro Munition), `radius` (nur wurf), `farbe` |
| `super` | `{"typ": "...", "name": "...", "farbe": "#..."}` – Werte wie `schaden`, `reichweite`, `radius`, `dauer` optional |
| `gadgets` | Liste, der Spieler wählt eins in der Sammlung. Jedes 3× pro Match, 7 s Abklingzeit |
| `passive` | Liste, der Spieler wählt eins. Immer aktiv |

## Alle Fähigkeiten (Typ-Namen für charakter.json)

**Supers:** `sprint` (Rempler) · `salve` (Kugelring) · `bombe` (Riesenwurf, zerstört Kisten) · `heilzone` ·
`schild` (weniger Schaden) · `teleport` (Sprung über Wände mit Landeschaden) · `geschuetz` (Turm, der selbst schießt) ·
`wirbel` (zieht Gegner zusammen) · `brandbombe` (Molotow mit Feuerfeld) · `schweigen` (Silence) · `beschwoeren` (Begleiter) · `wut` (schneller, stärker, schneller nachladen) · `eisfeld` (verlangsamt) ·
`unsichtbar` (Tarnung, nächster Angriff +50 %)

**Gadgets:** `heiltrank` · `stosswelle` · `sprung` · `schutzblase` · `mine` · `turbo` · `munition` · `frost`

**Passive:** `vampir` · `dicke_haut` · `flink` · `schnelllader` · `letzte_kraft` · `schnelle_heilung` · `superlader` · `dornen`

Neue Fähigkeiten, die es noch nicht gibt, baut Claude in `spiel/skripte/faehigkeiten.gd` dazu.

## Extras für Angriff und Super

| Feld | Wirkung |
|---|---|
| `angriff.geschoss_text` | Liste von Texten: Geschosse fliegen als Schriftzug (z. B. Formeln `["x²", "π"]`) |
| `angriff.aufprall` | bei `wurf`: z. B. `{"zone": {"art": "gift", "radius": 1.3, "dauer": 2, "schaden": 300}}` (art: gift oder feuer) |
| `super.ruf` | Großer Schriftzug über dem Kopf beim Auslösen (z. B. `"PAPI TAG"`) |
| `super.bleibt_beim_angriff` | bei `unsichtbar`: Tarnung endet nicht beim Angreifen oder Getroffenwerden |
| `super.bonus` | bei `unsichtbar`: Schadensfaktor des nächsten Angriffs (1.0 = kein Bonus) |

## Aussehen (Auswahl, für den Blender-Modellierer)

- `proportionen`: `comic` (erwachsen) · `chibi`
- `kopfform`: `rund` · `oval` · `schmal` (länglich, schmaler Kiefer) · `eckig` · `breit`
- `augen.form`: `rund` · `mandel` · `lachend` · `muede`
- `nase`: `klein` · `knubbel` · `spitz` · `breit` · `lang`
- `mund`: `laecheln` · `grinsen` · `lachen` (breites D-Lachen mit Zähnen) · `neutral` · `frech`
- `haare.stil`: `glatze` · `buzz` · `buerste` · `kurz` · `stachel` · `locken` · `afro` · `lang` · `zopf` · `dutt` · `seitenscheitel` · `iro`
- `oberteil.stil`: `tshirt` · `hoodie` · `jacke` · `heizjacke` (Steppjacke mit glühenden Heizzonen) · `pulli` · `tanktop`
- `armbaender`: Liste `{"seite": "L"|"R", "farbe": "#…", "dicke": 0.01}`
- `waffe.stil`: `keine` · `blaster` · `ball` · `hammer` · `stab` · `buch` · `kreide`
