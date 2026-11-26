# 🎮 Krawall Crew – So funktioniert das Spiel

## Der Kreislauf

```
 Start mit 1 Kämpfer ──► Schule stürmen ──► Münzen verdienen ──► Laptop kaufen & öffnen
        ▲                                                              │
        └──────── neuer Kämpfer oder +1 Stufe ◄────────────────────────┘
```

1. **Am Anfang** hast du genau **einen Kämpfer** (in `charakter.json` mit `"start": true`) und **300 Münzen**.
2. **Einsätze** bringen Münzen: geschafft 60 · verloren 25, dazu +5 pro besiegtem Lehrer.
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

## Ein Einsatz: die Schule

Du betrittst die Schule durch den Haupteingang. Der Komplex hat Klassenzimmer (5a, 7b, 9c, Chemieraum),
Bibliothek, Hauptgang, Eingangshalle, Mensa, Lehrerzimmer und Sekretariat.

- **Ziel:** Besiege **alle Lehrer**. Erst dann hast du gewonnen. Rechts oben steht, wie viele noch übrig sind.
- **Ein Leben:** Gehst du K.o., ist der Einsatz verloren (einstellbar in `spiel/daten/regeln.json`).
- **Keine Regeneration.** Leben gibt es nur durch **besondere K.o.s**:
  - **Super-K.o.** (Lehrer mit dem Super besiegt): +30 %
  - **Doppel-K.o.** (zwei Lehrer innerhalb von 4 s): +35 %
  - **Überraschungs-K.o.** (Lehrer besiegt, bevor er dich richtig bemerkt hat): +25 %
  - **Beute:** Manche Lehrer lassen etwas fallen (grüne Kugel mit +), z. B. die Mensa-Chefin oder der Hausmeister.
  - Heil-Gadgets und Heil-Passive des Spielers wirken in der Schule nicht.

### Wie sich die Lehrer verhalten
- **Alltag:** Jeder Lehrer hat Lieblingsräume und geht dort natürlich von Platz zu Platz. Er sitzt am Pult,
  schreibt an die Tafel, redet vor der Klasse, liest am Regal, trinkt Kaffee im Lehrerzimmer, isst in der
  Mensa oder geht im Gang auf und ab. Ab und zu wandert er auch in andere Räume.
- **Sehen:** Lehrer sehen nur nach vorne (Sichtkegel, ca. 9–11 m) und nicht durch Wände.
  Bist du sehr nah (2 m), merken sie dich auch von hinten.
- **Hören:** Schüsse und Supers sind laut. Lehrer in der Nähe hören sie, durch Wände nur halb so weit.
- **? gelb = misstrauisch:** Der Lehrer bleibt stehen und schaut in deine Richtung. Bleibst du in seiner Sicht,
  wird daraus ein Alarm, aus der Nähe schneller.
- **! rot = entdeckt:** Er erschrickt und greift an.
- **Pro Raum höchstens ein Lehrer.** Jeder Lehrer hat einen eigenen Heimraum und besucht andere Räume nur,
  wenn dort gerade niemand ist.
- **Nur ein Lehrer greift gleichzeitig an.** Weitere, die dich entdecken (! orange), ziehen sich in ihren Raum
  zurück und warten, bis der Kampf vorbei ist.
- **Suchen:** Verliert ein Lehrer dich 5 s aus den Augen, sucht er an der letzten Stelle, schaut sich um und
  kehrt danach in seinen Alltag zurück.
- **Überraschungsangriff:** Der erste Treffer auf einen ahnungslosen Lehrer macht **50 % mehr Schaden**.
  Anschleichen lohnt sich.

### Der Kampf
- **Angriffe werden angekündigt:** Kurz vor jedem Lehrerangriff erscheint eine rote Fläche am Boden
  (Schusslinie, Zielkreis oder Halbkreis). Wer rechtzeitig ausweicht, wird nicht getroffen.
- **Lehrer weichen aus:** Schießt du auf sie, springen sie manchmal zur Seite.
- **Wutphase:** Bei halbem Leben ruft der Lehrer „JETZT REICHT'S!“, glüht rot, läuft schneller und greift öfter an.
- **Bosskampf-Balken:** Unten zeigt ein großer Balken Name und Leben deines aktuellen Gegners (Strich = Wutphase).
- **Balance:** Lehrer haben doppeltes Leben, machen 55 % Schaden und schießen langsamer; du hast in der
  Schule 50 % mehr Leben. Ein Duell dauert etwa eine halbe Minute. Alle Werte in `spiel/daten/regeln.json`.
- **Roter Bildschirmrand** = du wurdest getroffen.

### Minikarte
Rechts oben: du (grün), Lehrer in der Nähe (weiß), misstrauisch (gelb), wartend oder suchend (orange),
angreifend (rot).

### Die Lehrer
| Lehrer | Revier | Angriff | Super | Besonderes |
|---|---|---|---|---|
| **Herr Mouscho** (echt) | Klassenzimmer, Lehrerzimmer | Formelwurf (fliegende Formeln) | **„Papi Tag“**: 5 s unsichtbar, greift dabei weiter an | trägt seine Heizjacke |
| **Frau Rahn** (echt) | Klassen, Lehrerzimmer, Bibliothek | Schneckenwurf (Bogen, Schleim verlangsamt) | **Herr Lascha** erscheint und wirft Kameras (10 s, schwach) | **BURN OUT**: nach 12 s Dauerkampf 5 s reglos, schwankender Gang |
| **Frau Gerometta** (echt) | Klassenzimmer | Vokabelwurf (fliegende französische Wörter) | **SILENCE !**: 4 s „PSST! NICHT ANGREIFEN!“ – wer angreift, ist sofort K.o. | **ANGRY MODE**: nach 10 s Dauerkampf 6 s doppelter Schaden |

Eigene Lehrer kommen nach `spiel/lehrer/<id>/charakter.json` (Format wie bei Kämpfern, zusätzlich
`"lehrer": {"anzahl", "raeume", "sicht", "sichtwinkel", "beute_heilung"}`).

## Die vier Fähigkeiten jedes Kämpfers

| | Wie | Steuerung (PC) |
|---|---|---|
| **Angriff** | 3 Munitionsbalken, laden sich nach. Zielt automatisch auf den nächsten Lehrer (roter Ring) | **Leertaste** |
| **Ulti (Super)** | lädt sich durch **Treffer** auf (Kreis „ULTI“ unten rechts) | **E** |
| **Gadget** | **3× pro Einsatz**, 7 s Abklingzeit | **F** |
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

Die Kämpfer Testi, Pixel, Kiki, Brocken, Funke, Nebel und Krone sind erfundene Test-Figuren und verschwinden,
sobald es eigene Kämpfer gibt. Lehrer gibt es nur die echten, die eingebracht wurden.

Der alte 3-gegen-3-Modus („Arena“, `szenen/spiel.tscn`) steckt noch im Projekt, wird aber vom Menü
nicht mehr gestartet.
