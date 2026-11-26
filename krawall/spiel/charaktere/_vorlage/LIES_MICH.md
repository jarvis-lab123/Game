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
`wirbel` (zieht Gegner zusammen) · `wut` (schneller, stärker, schneller nachladen) · `eisfeld` (verlangsamt) ·
`unsichtbar` (Tarnung, nächster Angriff +50 %)

**Gadgets:** `heiltrank` · `stosswelle` · `sprung` · `schutzblase` · `mine` · `turbo` · `munition` · `frost`

**Passive:** `vampir` · `dicke_haut` · `flink` · `schnelllader` · `letzte_kraft` · `schnelle_heilung` · `superlader` · `dornen`

Neue Fähigkeiten, die es noch nicht gibt, baut Claude in `spiel/skripte/faehigkeiten.gd` dazu.
