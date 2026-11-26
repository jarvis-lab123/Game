# Neuen Charakter anlegen

1. Ordner kopieren: `python3 werkzeuge/neuer_charakter.py <id>` (id = kleingeschrieben, ohne Leerzeichen, z. B. `max`)
2. **Fotos** der Person in `spiel/charaktere/<id>/fotos/` legen (1–5 Stück, `.jpg`/`.png`):
   - eins **von vorne**, Gesicht gut beleuchtet und scharf
   - am besten eins **vom ganzen Körper** (zeigt Statur und Kleidung)
   - optional eins von der Seite
3. `charakter.json` ausfüllen (Name, Angriff, Super, Kleidung – siehe unten)
4. Modell erzeugen: `python3 werkzeuge/foto_zu_charakter.py <id>`
   (mit `--bis stil` erst nur das Comic-Bild anschauen, dann ohne `--bis` weitermachen)
5. Godot öffnen und spielen. Der Charakter taucht automatisch in der Auswahl auf.

## Felder in charakter.json

| Feld | Bedeutung |
|---|---|
| `werte.leben` | Lebenspunkte (2800 = zerbrechlich, 3600 = normal, 5000 = Panzer) |
| `werte.tempo` | Laufgeschwindigkeit (0.85 langsam · 1.0 normal · 1.15 schnell) |
| `angriff.typ` | `schuss` (gerade Kugeln) · `schrot` (viele, kurze Reichweite) · `wurf` (Bogen über Wände, Explosion) · `nahkampf` (Schlag vor sich) |
| `angriff.projektile` / `streuung` | Anzahl Kugeln pro Schuss / Fächerwinkel in Grad |
| `angriff.reichweite` | in Metern (eine Kachel = 1.6 m). Nahkampf ≈ 2.5, Schrot ≈ 5, Schuss ≈ 8–10 |
| `angriff.nachladen` | Sekunden pro Munitionsbalken (3 Balken) |
| `angriff.radius` | Explosionsradius (nur bei `wurf`) |
| `super.typ` | `sprint` (Rempler nach vorne) · `salve` (Kugelring rundum) · `bombe` (Riesenwurf, zerstört Kisten) · `heilzone` (heilt Team) · `schild` (4 s weniger Schaden, schneller) |
| `super.ladung_pro_treffer` | wie schnell der Super lädt (0.1 = 10 Treffer) |
| `farbe` | Farbe der Geschosse/Effekte als Hex-Code |
| `meshy.kleidung` | Outfit-Beschreibung (englisch oder deutsch) für das Comic-Bild |
| `meshy.groesse_m` | Körpergröße der Person (für die Proportionen) |
| `meshy.animationen` | optional eigene Animationen aus der Meshy-Bibliothek, z. B. `{"Victory": 64}` |
