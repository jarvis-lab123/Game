# active-memory handoff: Krawall Crew (3D-Comic-Schulspiel)

**Handoff #1** · 2026-11-27 · Lineage: #1 (2026-11-27): Spiel von Null gebaut (Blender-Generator + Godot), Schulmodus mit 6 echten Lehrern, Browser-Version veröffentlicht, Balancing (Ausweichen, Ultis, Cookie-Heilung), Kosten für Online-/PC-App durchgerechnet

## 0. Instructions for Claude (read first)

You are continuing work from a previous chat. That chat is gone; this file is the complete context and the source of truth.

1. Read this whole file before replying.
2. Follow sections 3 (Style), 4 (Hard rules) and 5 (Corrections) in every reply, for the rest of this chat. They override your defaults.
3. Use the values in section 8 exactly. Never round, re-estimate, or "correct" them.
4. Do not suggest anything listed in section 7 (Changed / rejected) again unless the user brings it up.
5. Code word: None active. If the user types /amcodeword, start every reply with the phrase they choose (default "Yes Boss!").
6. Your first reply: at most 5 lines covering the goal, the current state, and the next step (section 11). Mention any files from section 13 that were not attached. Ask the questions in section 12 if there are any. End with "Ready to continue with <next step>?" Then wait for the user's go.

## 1. Mission
- **Goal:** Eigenes 3D-Comic-Spiel „Krawall Crew“ (Brawl-Stars-artig, „Fortnite-Qualität“-Look), gebaut mit Blender + Godot. Schulmodus: Spieler läuft durch einen Schulkomplex und besiegt die Lehrer, die der User vorgibt (nach Fotos in Blender modelliert, Fähigkeiten genau nach User-Beschreibung).
- **Done looks like:** Spielbar im Browser-Link; jeder Lehrer gut wiedererkennbar und mit genau den beschriebenen Fähigkeiten; spannende, nicht zu leichte Kämpfe.
- **Why it matters / context:** Der User spielt es „nur ab und zu“ zum Ausprobieren; überlegt jetzt, es online als Multiplayer / richtige PC-App zu machen.

## 2. About the user (as relevant to this work)
- Schreibt auf Deutsch, locker, mit vielen Tippfehlern; kurze Nachrichten.
- Lehrer im Spiel sind echte Lehrer der eigenen Schule (Fotos kommen vom User).
- Windows-PC, hat kein Godot; die `.exe` ließ sich nicht öffnen („Gar nichts“) → spielt über den Browser-Link (Claude-Artifact).
- Keine Programmierkenntnisse nötig/erwartet; Claude baut alles.

## 3. Style & communication
- **Language:** Alle Antworten auf Deutsch.
- **Tone:** freundlich, direkt, konkret.
- **Reply length:** kompakt; Fähigkeiten/Änderungen als kurze Liste mit Fettdruck; am Ende Link zum Spielen.
- **Formatting:** Überschriften/Fett/Listen ok, Tabellen für Zahlen; Bilder (Modell-Vorschau, Ingame-Screenshots) per SendUserFile mitschicken.
- **Working style:** Neue Lehrer: Foto beschreiben (Haare, Brille, Kleidung, Figur) → Fähigkeiten umsetzen → Blender-Modell → im Spiel testen (Screenshots) → Web bauen → Artifact veröffentlichen → commit/push → kurz berichten. Ehrlich sagen, was geschätzt ist (z. B. Farben bei S/W-Foto).
- **Avoid:** Nachfragen bei klaren Wünschen; Wünsche moralisch bewerten (User beschreibt Lehrer normal/realistisch); Dinge „vereinfachen“, die der User genau beschrieben hat.

## 4. Hard rules (word for word)
1. „lass uns nochmal um ändern nicht aus ki bildern du baust es einfach so gut wie möglich in blender“ (Charaktere nur im Blender-Generator, keine KI-Bild-zu-3D/Meshy)
2. „mach nicht das zielen mit der maus und angriff soll mit lertaste sein un schreibe welche die taste die ult ist mach nur lehrer die ich reinmache rein“
3. „1 lehrer pro klassen zimmer mehr nicht“ (dazu: max. 1 Lehrer greift gleichzeitig an)
4. „mache die heilung nicht einfach so sonder nur durch ein cookie in der mensa“
5. „Du sollst die doch einfach nur realistischer machen… wie auf dem Foto“ (Aussehen realistisch nach Foto, nicht Chibi/Karikatur)
6. Gewinnen erst, wenn alle Lehrer besiegt sind; alle Räume müssen betretbar sein.

## 5. Corrections log
| # | Claude did | The user wanted |
|---|---|---|
| 1 | Chibi-Proportionen | „zu unrealistisch… wie in einem wirklich gut gezeichnetem comic“ → Erwachsenen-Comic-Proportionen |
| 2 | KI Foto-zu-3D (Meshy) | nur in Blender bauen |
| 3 | Truhe/Box als Lootbox | „Klapp computer“ (Laptop, der sich mit krasser Animation öffnet), kein Box-PC |
| 4 | Gerometta „hässlicher“ abgelehnt | war normale Beschreibung: realistischer, Falten, unfreundlicher, breiter, normale Größe, keine Sonnenbrille |
| 5 | 2–3 Lehrer gleichzeitig, One-Shots | 1 Lehrer pro Raum, 1 Angreifer, längere spannende Kämpfe |
| 6 | Maus-Zielen, Platzhalter-Lehrer | Leertaste Angriff (Auto-Ziel), Ulti-Taste anzeigen (E), nur echte Lehrer |
| 7 | Manche Räume nicht betretbar, Ulti zu selten | alle Räume betretbar, Ulti öfter (später zu oft → #11) |
| 8 | Lüthi schwarz-weiß wie Foto | in Farbe, „dunkel blonde harre“ |
| 9 | Osinga zu schwach | stärker, Ulti „oper“, Angriff = Sprechblase wie Giftwolke, Englischlehrerin |
| 10 | Angriffe leicht auszuweichen | schwerer bei allen; Mouscho/Gerometta waren ok, „bischen scwiriger“ |
| 11 | Ultis „durchgehend“ (Zeit-Aufladen 12 s + Flächen-Ticks luden mit) | deutlich seltener (Weber besonders) |
| 12 | automatische Regeneration eingebaut | Heilen NUR durch Cookie in der Mensa |
| 13 | Windows-`.exe` geliefert | spielt im Browser-Link |

## 6. Decisions
| Decision | Why |
|---|---|
| Steuerung: WASD laufen · LEERTASTE Angriff (Auto-Ziel nächster Gegner, roter Ring) · E Ulti · F Gadget · Esc/P Pause | User-Regel #2 |
| Schulmodus 80×56 m, Räume: Mensa, Bibliothek, Klassenzimmer, Lehrerzimmer, Chemieraum, Gänge, Eingangshalle | User-Design |
| Lehrer: Alltag → misstrauisch → Alarm → Angriff; Rückzug ins Heimraum | natürliches Verhalten (User) |
| Fortschritt: Start mit 1 Charakter, neue aus Laptops ziehen (Seltenheiten) | User |
| Heilung nur Cookies (2 in Mensa, 40 %, 30 s Respawn); Heil-K.o.s, Heiltrank, Regeneration aus | User-Regel #4 |
| Lehrer-Ulti: Mindestpause 20 s, Zeit-Aufladen 35 s, Treffer laden 50 %, Flächen-Ticks 10 % | „alle haben durchgehend ihre ulti“ |
| Angriffe: Warnung 0,22 s, KI zielt vor (Ansage+Flugzeit), Wurf-Flug 0,15 + Weite/32 s | Ausweichen war zu leicht |
| Multiplayer-Empfehlung (nur Vorschlag, nicht entschieden): Variante A privat ~8 €/Monat | Claude-Vorschlag |

## 7. Changed / rejected
- Chibi → Comic-Erwachsenenproportionen (unrealistisch)
- ❌ Meshy / KI Foto-zu-3D (User will nur Blender)
- Truhe/Box → Klapp-Laptop
- 3v3-Arena → Schulmodus gegen Lehrer
- max. 3 Angreifer → max. 1 Angreifer, 1 Lehrer pro Raum
- Maus-Zielen → Leertaste Auto-Ziel
- Platzhalter-Lehrer → nur User-Lehrer
- Heilung über besondere K.o.s / Regeneration bis 60 % / Heiltrank → nur Cookie in der Mensa
- Lehrer-Ulti alle 12 s → Mindestpause 20 s / 35 s Laden
- Angriffs-Warnung 0,5 s → 0,22 s; Wurf-Flug 0,45+Weite/18 → 0,15+Weite/32
- Lüthi schwarz/S-W → dunkelblond, dunkelblaues Hemd
- Osinga Sprechblase als Schuss → Wurf, der zur lila „Laber“-Giftwolke platzt
- ❌ `.exe` für Windows (öffnete sich nicht, SmartScreen o. ä.)

## 8. Data & facts (exact)
**Repo / Deploy**
- Repo `jarvis-lab123/Game`, Branch `claude/dreamy-bohr-c46q36`, Ordner `krawall/`, letzter Commit `8fe99c7`
- Artifact: slug `f3ac0998-ae77-4fbc-9d91-a107f733d9c5`, URL https://claude.ai/artifact/X6CckSGLGiaiCGoR1guPhE, letzte Version `1795767563-1722`
- Publish-Dateien: index.html, index.js, index.wasm.gz.b64.txt, index.pck.teil0–3.b64.txt (aktuell 4 Teile; wenn weniger → überzählige mit `remove` löschen)
- Cloud-Env „Spiele (Game + Yeswebseite)“ `env_01XSc4zPffg4chpJMKFUAvea` (Setup: bpy + Godot)
- Tools: Godot 4.5.1 (GL Compatibility), Blender 5.3 als Python-Modul (`pip install bpy`)

**Regeln `spiel/daten/regeln.json` → "schule"**
| Schlüssel | Wert |
|---|---|
| leben | 1 |
| max_angreifer | 1 |
| heilung_super_ko / doppel_ko / ueberraschungs_ko | 0 / 0 / 0 |
| lehrer_schaden | 0.55 |
| spieler_leben | 1.5 |
| lehrer_leben | 2.0 |
| lehrer_feuerpause | [0.9, 1.6] |
| lehrer_ausflug_chance | 0.15 |
| angriff_ansage | 0.22 |
| lehrer_ulti_sekunden | 35.0 |
| lehrer_ulti_mindestpause | 20.0 |
| lehrer_ulti_ladung | 0.5 |
| cookie_heilung | 0.4 |
| cookie_neu_nach | 30.0 |

**Lehrer** (`spiel/lehrer/<id>/charakter.json`)
| id | Name | Titel | Leben/Tempo | Angriff | Ulti |
|---|---|---|---|---|---|
| mouscho | Herr Mouscho | Mathelehrer | 3400 / 1.0 | Formelwurf, schuss 3 Proj., Tempo 24, Streuung 20, 360 | „PAPI TAG“: 5 s unsichtbar, greift weiter an; Heizjacke |
| rahn | Frau Rahn | (Feld „Carolina Rahn“) | 4400 / 0.88 | Schneckenwurf, wurf r 1.7, 480, verlangsamt | Herr Lascha erscheint, wirft Kameras (schwach); BURN OUT nach 12 s Kampf 5 s reglos; rundlich, watschelt |
| gerometta | Frau Gerometta | Französischlehrerin | 5200 / 0.85 | Vokabelwurf (frz. Wörter), schuss 3 Proj., Tempo 22, Streuung 24, 336 | „SILENCE !“ 4 s: wer angreift, ist sofort K.o.; ANGRY MODE nach 10 s Kampf 6 s doppelter Schaden |
| weber | Herr Weber | Chemielehrer | 3500 / 1.0 | Chemikalien (Kolben), wurf r 1.7, 420 + Giftpfütze | „MOLOTOW!“ Brandflasche + Feuerfeld 4,5 s; ladung_pro_treffer 0.1 |
| luethi | Herr Lüthi | Geografielehrer (geraten) | 3400 / 1.02 | Giftregen-Wolke, wurf r 1.8, 260 + Regen-Zone | „CO₂-ALARM!“ CO₂-Wolke 6 s folgt ihm; 1 % pro Ulti: ganze Schule wird Wüste bis Spielende |
| osinga | Frau Osinga | Englischlehrerin | 4400 / 1.05 | „Boring Lecture“: engl. Sprechblase (wurf r 1.9, 420) → lila Laber-Giftwolke (r 2.0, 3,5 s, 900, müde/langsam, „Zzz“) | „SNOWBALL!“ 10 s Schwein: Tempo-Bonus 1.8, Panzer 0.5, Biss 1100 (r 1.9), heilt 35 % des Biss-Schadens |
- Begleiter: `spiel/begleiter/lascha` (Platzhalter-Aussehen, wirft Kameras)
- Spieler-Platzhalter: testi (Start), pixel, kiki, brocken, funke, nebel, krone
- Laptops (`boxen.json`): Alter Laptop 100 / Gaming-Laptop 300 / Super-Laptop 800 Coins

**Kosten Online/PC-App (zuletzt genannt)**
- Hetzner CX23 ~5,99 €/Monat netto (~7,13 € mit 19 % MwSt.), oft ausverkauft; Domain ~10–15 €/Jahr (Schätzung); Let's Encrypt 0 €
- Supabase Free 0 € / Pro 25 $/Monat (Supabase-Host bereits verbunden: njxrigikjupkgaunzmta.supabase.co)
- Windows-Signatur: Azure Artifact Signing ~10 $/Monat (nicht bestätigt) oder klassisches Zertifikat ~200–400 €/Jahr (Schätzung)
- Steam Direct 100 $ einmalig pro Spiel (zurück ab 1.000 $ Umsatz), 30 % Valve-Anteil; itch.io 0 €
- Varianten: A privat ~90–100 €/Jahr · B + Signatur ~210–220 €/Jahr · C Steam ~300–600 € im 1. Jahr
- Hinweis gegeben: öffentlich/Steam nicht mit echten Lehrern (Recht am eigenen Bild); Konten/Steam-Verkauf brauchen 18+ bzw. Eltern

## 9. People, terms & names
- **People:** Herr Mouscho, Frau (Carolina) Rahn, Herr Lascha (Begleiter, noch kein Foto), Frau Gerometta, Herr Weber, Herr Lüthi, Frau Osinga = echte Lehrer (Gegner)
- **Terms & nicknames:** Ulti = Super-Fähigkeit (Taste E); „Papi Tag“; „Snowball“ = Osingas Schwein; Laptop = Lootbox; „Krawall Crew“ = Spielname
- **Names in use:**
  - Generator: `krawall/blender/charakter_bauen.py <json> [--keine-vorschau]` → model.glb, model.blend, preview.png
  - Weitere: `blender/umgebung_bauen.py`, `blender/schule_bauen.py`, `werkzeuge/web_bauen.sh` (→ `krawall/web/`), `werkzeuge/neuer_charakter.py`
  - Skripte `spiel/skripte/`: daten.gd, konto.gd, kaempfer.gd, lehrer.gd, schule.gd, arena.gd, faehigkeiten.gd (SUPERS, Zone-Arten wirbel/eis/feuer/gift/regen/co2/laber, class Schwein), projektil.gd (Modelle schnecke/kamera/kolben/molotow/wolke/sprechblase), effekte.gd (zzz, ruf, puff…), hud.gd, menue.gd, toon.gd (Materialien „falte*“/„fein*“ ohne Umriss)
  - Generator-Optionen neu: haare „tolle“, haare dutt `straehnen`, hemd `streifen: false`, pulli `blumen`/`blumenfarbe`, brille `dicke`/`groesse`, waffe „wolke“
  - Docs: `krawall/README.md`, `krawall/GAMEPLAY.md`

## 10. Work state
| Item | Status | Version / location | Notes |
|---|---|---|---|
| Browser-Version | final (live) | Artifact-Version `1795767563-1722` | nach jeder Änderung `web_bauen.sh` + publish_files |
| 6 Lehrer | fertig | `spiel/lehrer/*` | Lüthi-/Osinga-Augen- & Kleidungsfarben teils geschätzt |
| Herr Lascha | Platzhalter | `spiel/begleiter/lascha` | Foto fehlt |
| Cookie-Heilung | fertig, getestet (20 % → 60 %) | schule.gd `_cookie_setzen`, `_cookies_pruefen` | |
| Ulti-Häufigkeit | fertig, getestet (≤3 pro 60 s je Lehrer) | kaempfer.gd `ulti_mindestpause`, `ulti_ladung_faktor` | |
| Ausweichen schwerer | fertig | kaempfer.gd KI-Vorhalt, arena.gd `wurf_dauer` | |
| Multiplayer / PC-App | nicht begonnen | – | nur Kosten/Aufwand erklärt |

Test-Tipps: Ingame-Screenshots mit `xvfb-run -a godot --rendering-driver opengl3 -s res://_t.gd`; nach neuen Modellen/Klassen erst `godot --headless --import`; `kaempfer.zeit()` ist Echtzeit → Zeit-Tests nicht mit `--fixed-fps` messen; Test-Skript `_t.gd` danach löschen. Achtung: `lehrer.gd` überschreibt `schaden_nehmen(menge, quelle, stoss, ladung)` – Signatur muss zur Basis passen.

## 11. Next steps
1. **Next action:** Den User fragen, ob er Variante A (privater Online-Koop, ~8 €/Monat) umsetzen will; wenn ja, mit einem 2-Spieler-Koop-Prototyp planen (Godot High-Level-Multiplayer über WebSocket, Server steuert Lehrer, Beitritt per Raum-Code).
2. Weitere Lehrer nach Foto + Beschreibung einbauen (gleicher Ablauf wie in Abschnitt 3).
3. Herrn Lascha bauen, sobald ein Foto kommt.
4. Balancing nach User-Feedback anpassen (Werte in regeln.json / charakter.json).

## 12. Open questions ⚠️
- Multiplayer: Variante A (privat), B (+ Windows-Signatur) oder C (Steam) – oder erst mal nicht?
- Sollen besondere K.o.s wieder heilen dürfen? (Aktuell 0 wegen „nur durch ein cookie“.)
- Herr Lüthis Fach: „Geografielehrer“ ist geraten – stimmt das? Hemdfarbe (dunkelblau) und Augenfarben (Lüthi, Osinga) sind geschätzt.
- Foto von Herrn Lascha fehlt noch.

## 13. Re-attach checklist
- [ ] Fotos neuer Lehrer (falls weitere kommen): für Aussehen.
- [ ] Foto von Herrn Lascha: für das echte Modell.
- Alles andere liegt im Repo `jarvis-lab123/Game`, Branch `claude/dreamy-bohr-c46q36`.

---
<sub>Audit: 13/13 sections · 6 rules · 13 corrections · 60+ data points · secrets removed: none found · generated by active-memory</sub>
