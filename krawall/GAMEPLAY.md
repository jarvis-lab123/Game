# 🎮 Krawall Crew – So funktioniert das Spiel

## Der Kreislauf

```
 Start mit 1 Kämpfer ──► Match spielen ──► Münzen verdienen ──► Laptop kaufen & öffnen
        ▲                                                              │
        └──────── neuer Kämpfer oder +1 Stufe ◄────────────────────────┘
```

1. **Am Anfang** hast du genau **einen Kämpfer** (in `charakter.json` mit `"start": true`) und **300 Münzen**.
2. **Matches** bringen Münzen: Sieg 60 · Unentschieden 40 · Niederlage 25, dazu +5 pro K.o.
3. Im **Laptop-Shop** kaufst du Laptops. Jeder Laptop enthält Münzen und mit einer bestimmten
   Wahrscheinlichkeit einen Kämpfer.
4. **Neuer Kämpfer:** Er ist freigeschaltet und spielbar. **Schon vorhanden:** Er steigt eine Stufe auf
   (+6 % Leben und Schaden pro Stufe, maximal Stufe 10). Auf Maximalstufe gibt es stattdessen Münzen.

Alles wird automatisch gespeichert.

## Seltenheiten

| Seltenheit | Farbe | Münzen bei Duplikat auf Maximalstufe |
|---|---|---|
| Gewöhnlich | grau | 20 |
| Selten | grün | 40 |
| Episch | lila | 80 |
| Mythisch | rot | 150 |
| Legendär | gold | 300 |

Die Seltenheit sagt nur, wie oft ein Kämpfer kommt, nicht wie stark er ist.

## Die Laptops (Wahrscheinlichkeit auf einen Kämpfer)

| | Alter Laptop | Gaming-Laptop | Super-Laptop |
|---|---|---|---|
| Preis | 100 | 300 | 800 |
| Münzen drin | 20–60 | 60–150 | 150–350 |
| Gewöhnlich | 22 % | 25 % | 10 % |
| Selten | 8 % | 20 % | 35 % |
| Episch | 2 % | 8 % | 25 % |
| Mythisch | 0,5 % | 2,5 % | 9 % |
| Legendär | 0,1 % | 0,6 % | 3 % |
| Nur Münzen | 67,4 % | 43,9 % | 18 % |

- **Garantie:** Nach 7 Laptops ohne Kämpfer ist im 8. sicher einer drin.
- Innerhalb einer Seltenheit kommen **Kämpfer, die du noch nicht hast, zuerst**.
- Gibt es von einer Seltenheit (noch) keinen Kämpfer, rutscht der Zug eine Stufe tiefer.
- Alle Zahlen stehen in `spiel/daten/boxen.json` und `spiel/daten/seltenheiten.json` und lassen sich frei ändern.

**Öffnen-Animation:** Der Laptop fällt herein. Nach dem Antippen ruckelt der Deckel und Funken sprühen.
Dann springt der Deckel auf, der Ladebalken klettert durch die Seltenheitsfarben (je seltener, desto
länger), der Bildschirm glitcht, eine Lichtsäule schießt hoch, und der Kämpfer wird aus dem Bildschirm
„heruntergeladen“.

## Ein Match: „Krawall“

- **3 gegen 3** (du + 2 Bots gegen 3 Bots), Kamera schräg von oben.
- **Ziel:** zuerst **10 K.o.s** fürs Team. Nach **2:30** gewinnt das Team mit mehr K.o.s.
- Wer K.o. geht, kommt nach **4 s** am eigenen Startpunkt zurück, mit **2 s Spawnschutz** (blinkt).
- **Leben regeneriert sich**, wenn du 3 s weder angreifst noch getroffen wirst.
- Die Bots sind ungefähr auf deiner Stufe und haben zufällige Gadgets und Passive.

### Die Arena
- **Mauern** blockieren alles. **Kisten** auch, gehen aber mit `bombe`-Supers kaputt.
- **Wasser** blockiert Laufen, Schüsse fliegen drüber.
- **Büsche:** Wer drinsteht, ist für Gegner unsichtbar, außer sie kommen auf unter 3 m heran oder
  er schießt bzw. wird getroffen.

## Die vier Fähigkeiten jedes Kämpfers

| | Wie | Steuerung (PC) |
|---|---|---|
| **Angriff** | 3 Munitionsbalken, laden sich nach | Linksklick (zielt zur Maus) · Leertaste = Auto-Ziel |
| **Super** | lädt sich durch **Treffer** auf (Kreis unten rechts) | Rechtsklick oder E |
| **Gadget** | **3× pro Match**, 7 s Abklingzeit | F (oder mittlere Maustaste) |
| **Passiv** | immer aktiv | – |

**Handy:** Links Laufen-Stick, rechts Angriffs-Stick (ziehen = zielen, tippen = Auto-Ziel), daneben
der Super-Knopf und darüber der Gadget-Knopf.

Welches Gadget und welches Passiv ein Kämpfer mitnimmt, wählst du in der **Sammlung**.
Die vollständige Liste aller Fähigkeiten steht in `spiel/charaktere/_vorlage/LIES_MICH.md`.

### Angriffstypen
- **schuss:** gerade Geschosse, auch mehrere im Fächer
- **schrot:** viele Kugeln, kurze Reichweite, aus der Nähe tödlich
- **wurf:** fliegt im Bogen über Wände, explodiert am Zielpunkt
- **nahkampf:** Schlag im Halbkreis vor dir

## Platzhalter

Die sieben Figuren Testi, Pixel, Kiki, Brocken, Funke, Nebel und Krone sind erfundene Test-Figuren, eine
oder mehrere pro Seltenheit. Sobald es eigene Kämpfer gibt, werden sie automatisch ausgeblendet.
