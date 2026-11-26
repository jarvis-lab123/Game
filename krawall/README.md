# 💥 KRAWALL CREW

3D-Arena-Brawler im Comic-Stil: 3 gegen 3, schräg von oben, kurze schnelle Runden.
Alle Kämpfer sind **echte Personen**, die du selbst einbringst: aus Fotos wird ein
wiedererkennbarer, animierter Comic-Charakter.

![Spielszene](doku/spiel.png)

## Spielen

1. [Godot 4.5](https://godotengine.org/download) installieren
2. In Godot **Importieren** → `krawall/spiel/project.godot` wählen → **F5**

**Steuerung (PC):** WASD laufen · Maus zielen · Linksklick Angriff · Leertaste Auto-Ziel ·
Rechtsklick/E Super · Esc Pause. Gamepad geht auch.
**Handy/Tablet:** links Bewegungs-Stick, rechts Angriffs-Stick (ziehen = zielen, tippen = Auto-Ziel),
daneben der Super-Knopf.

**Modus „Krawall“:** Wer zuerst 10 K.o.s schafft, gewinnt (sonst nach 2:30 das Team mit mehr K.o.s).
Büsche verstecken dich, Kisten gehen mit Bomben-Supers kaputt, Wasser blockiert Laufen, aber nicht Schüsse.
Leben regeneriert sich, wenn du 3 s weder triffst noch getroffen wirst.

## Eigenen Charakter einbauen (Foto → 3D)

```
python3 werkzeuge/neuer_charakter.py max "Max"
# Fotos nach spiel/charaktere/max/fotos/ legen, charakter.json ausfüllen
python3 werkzeuge/foto_zu_charakter.py max --bis stil   # erst das Comic-Bild prüfen
python3 werkzeuge/foto_zu_charakter.py max              # dann 3D, Rig, Animationen
```

Der Ablauf über die [Meshy-API](https://docs.meshy.ai):
1. **Comic-Bild:** Fotos → Ganzkörper-Figur im Comic-Spielstil, Gesicht bleibt erkennbar
2. **3D-Modell:** Bild → texturiertes Modell in A-Pose
3. **Rig:** Skelett automatisch
4. **Animationen:** Idle, Rennen, Angriff (passend zum Angriffstyp), Super, Jubeln, Treffer, K.o.
5. **Fertig:** `model.glb` liegt im Charakter-Ordner. Godot färbt es mit dem Toon-Shader comichaft ein.

Jeder Schritt wird in `meshy_status.json` gemerkt. Bricht etwas ab, macht ein erneuter Aufruf dort weiter.
`--neu stil` macht ab einem Schritt alles neu (z. B. wenn dir das Comic-Bild nicht gefällt).

**API-Schlüssel:** `export MESHY_API_KEY=msy_...` (Konto auf meshy.ai → Developers → API Keys).
In der Claude-Cloud-Umgebung „Spiele“ hinterlegst du den Schlüssel einmal als Netzwerk-Secret für
`api.meshy.ai`, dann braucht es keine Variable.

Alle Felder von `charakter.json` erklärt `spiel/charaktere/_vorlage/LIES_MICH.md`.
Fotos und Meshy-Zwischenstände werden **nicht** ins Git-Repo übernommen (`.gitignore`).

## Ordner

| Ordner | Inhalt |
|---|---|
| `spiel/` | Godot-Projekt (GL Compatibility: PC, Web, Handy) |
| `spiel/skripte/` | `arena.gd` Match & Karte · `kaempfer.gd` Kämpfer + Bot-KI · `hud.gd` Oberfläche · `menue.gd` Auswahl · `toon.gd` Comic-Materialien |
| `spiel/shader/` | Toon-Shader (Stufen-Licht, Randlicht), Umrisslinien, Boden |
| `spiel/charaktere/` | ein Ordner pro Charakter (`charakter.json` + `model.glb`) |
| `spiel/arena/objekte.glb` | Mauern, Kisten, Büsche, Wasser, Bäume, Zaun (aus Blender) |
| `blender/umgebung_bauen.py` | baut die Arena-Objekte in Blender neu |
| `blender/charakter_bauen.py` | Generator für Platzhalter-Figuren (z. B. „Testi“) ohne Fotos |
| `werkzeuge/` | Foto→3D-Pipeline, Charakter anlegen, GLB-Clips umbenennen |

Blender-Skripte laufen mit installiertem Blender (`blender -b -P skript.py -- …`) oder mit dem
Python-Modul `pip install bpy` (`python3 skript.py …`).

Schrift: [Lilita One](spiel/schrift/OFL.txt) (SIL Open Font License).
