# VOKI – Konzept & Spezifikation

> Vokabel-Trainer für Arthur (Gymnasium Basel, Englisch + Französisch).
> Ziel: Vokabeln **wirklich behalten**, nicht nur bis zum Test stopfen – und trotzdem pünktlich zum Testdatum sitzen.
> Plattform: **zwei Apps, ein Code** – eine **Windows-Desktop-App** (.exe, Tauri) und eine **Handy-App** (installierbare PWA für iPhone + Android, optional zusätzlich Android-APK). Fortschritt wird zwischen beiden **synchronisiert**.
> Kosten: **0 CHF** – alle Libraries Open Source, Tauri gratis, Hosting auf GitHub Pages gratis, Sync über Supabase Free Tier gratis.

---

## 1. Das Problem, das die App lösen muss

- Französisch-Vokabeln „gehen einfach nicht rein": viel gelernt, trotzdem Note 2 (60 von 190 Wörtern gesessen).
- Englisch-Vokitests haben **zwei Teile**: Wortschatz (erkennen/verstehen) **und Schreiben** (korrekt schreiben können). Reines Karteikarten-Umdrehen trainiert nur Teil 1.
- Lernen passiert zu spät und zu geblockt („alles am Vorabend").

**Antwort der App:**
1. **Spaced Repetition (FSRS)** statt Wiederholen nach Gefühl.
2. **Aktives Abrufen** statt Durchlesen: jede Karte ist eine Mini-Prüfung.
3. **Schreiben ist Pflicht**: Der Tipp-Modus ist der Hauptmodus, nicht ein Extra.
4. **Prüfungsmodus**: Die App rechnet rückwärts vom Testdatum und sagt jeden Tag genau, wie viel heute dran ist.
5. **Problemwörter** werden erkannt und extra behandelt (Eselsbrücke, Extra-Drill).

---

## 2. Tech-Stack

| Bereich | Wahl | Warum |
|---|---|---|
| Framework | **Vite + React + TypeScript** | schnell, Standard, Claude Code kennt es perfekt |
| Styling | **Tailwind CSS** + eigene Design-Tokens | sauberes, professionelles Design ohne viel CSS |
| Animation | **Framer Motion** | Karten-Flip, Feedback-Animationen |
| Speicher | **IndexedDB via Dexie.js** | lokal, offline, schnell, grosse Datenmengen |
| Algorithmus | **ts-fsrs** (FSRS v5/v6) | aktueller Stand der Forschung, besser als SM-2 (Anki-Standard) |
| Offline/Install | **vite-plugin-pwa** | App-Icon auf Handy & PC, funktioniert ohne Internet |
| Audio | **Web Speech API** (`speechSynthesis`, `SpeechRecognition`) | Aussprache fr-FR / en-GB gratis, ohne API-Key |
| Charts | **Recharts** | Statistiken |
| Tests | **Vitest** | Algorithmus- und Bewertungslogik absichern |
| Hosting | **GitHub Pages** (GitHub Actions Deploy) | gratis, Handy-Zugriff per Link |
| PC-App | **Tauri 2** | echte Windows-App (.exe/.msi), winzig (~10 MB statt 150 MB bei Electron), nutzt denselben React-Code |
| Handy-App | **PWA** (+ optional **Capacitor** für Android-APK) | PWA läuft auf iPhone UND Android, „Zum Home-Bildschirm" = App-Icon. Native iPhone-App geht nicht: braucht Mac + 99 USD/Jahr Apple-Account |
| Sync | **Supabase** (Free Tier) | PC und Handy haben denselben Stand; Login per Magic-Link-Mail |

---

## 2b. Architektur: zwei Apps, ein Code

```
voki/
├─ src/              ← gemeinsamer React-Code (UI + Logik), 100 % geteilt
│  ├─ lib/           ← reine Logik: Bewertung, FSRS, Prüfungsplanung, Sync (getestet)
│  ├─ db/            ← Dexie-Schema
│  ├─ platform/      ← dünne Adapter: desktop.ts / mobile.ts (Dateidialog, Benachrichtigungen, Fenster)
│  └─ ui/
├─ src-tauri/        ← Windows-App-Hülle
├─ android/          ← optional, Capacitor (nur falls Android-Handy)
└─ .github/workflows ← Deploy PWA + Build Windows-Installer als Release
```

**Unterschiede pro Plattform (der Rest ist identisch):**

| | PC-App (Tauri) | Handy-App (PWA) |
|---|---|---|
| Layout | breit: Seitenleiste + Karte + Statistik daneben | eine Spalte, Bottom-Navigation |
| Eingabe | Tastatur-Shortcuts, Alt-Akzente | Akzent-Leiste über der Tastatur, Wischgesten (links = nochmal, rechts = gut im Umdreh-Modus) |
| Stärke | Vokabeln importieren und bearbeiten, Statistik, Probetest | tägliche 15-Min-Session unterwegs (Tram, Pause) |
| Extras | Autostart-Option, Tray-Icon mit „X fällig" | Erinnerung (Web-Push, falls unterstützt), Vibration bei richtig/falsch |
| Installation | `.msi`-Installer aus GitHub Releases | Link öffnen → „Zum Home-Bildschirm" |

**Sync (Supabase):**
- Login einmal pro Gerät per Magic Link (E-Mail), kein Passwort.
- Lokal bleibt Dexie die Hauptquelle (offline zuerst). Sync bei App-Start, nach jeder Session und alle 5 Min, wenn online.
- Tabellen 1:1 wie Dexie, jede Zeile mit `updatedAt` + `deviceId`. Konflikte: **neuester gewinnt** pro Datensatz; ReviewLogs werden nur angehängt (nie überschrieben), damit kein Lernfortschritt verloren geht.
- Row Level Security: jeder sieht nur seine eigenen Daten.
- Ohne Login funktioniert alles lokal weiter (JSON-Backup als Fallback).

---

## 3. Datenmodell (Dexie)

```ts
Deck {
  id: string
  name: string              // "Englisch Unit 4", "Franz Dossier 3"
  language: 'en' | 'fr' | 'other'
  examDate?: string         // ISO-Datum, aktiviert Prüfungsmodus
  directions: ('toTarget' | 'toNative')[]   // DE→FR, FR→DE oder beide
  strictAccents: boolean    // Testmodus: Akzentfehler = falsch
  createdAt: string
  archived: boolean
}

Note {                      // ein Vokabel-Eintrag
  id: string
  deckId: string
  term: string              // Fremdwort, z.B. "la boulangerie"
  translation: string       // "die Bäckerei" (mehrere Lösungen mit ";" trennen)
  example?: string          // Beispielsatz in der Fremdsprache
  gender?: 'm' | 'f' | 'n' | 'pl'
  plural?: string
  notes?: string            // Grammatik-Hinweis
  mnemonic?: string         // Eselsbrücke (selbst geschrieben)
  tags: string[]
}

Card {                      // eine Lernrichtung einer Note = eine Karte
  id: string
  noteId: string
  deckId: string
  direction: 'toTarget' | 'toNative'
  stage: 'new' | 'intro' | 'mc' | 'type' | 'review'   // Lernleiter, siehe 5.2
  fsrs: FSRSCard            // State aus ts-fsrs (due, stability, difficulty, reps, lapses, …)
  leech: boolean
  suspended: boolean
}

ReviewLog {
  id, cardId, deckId, timestamp, mode, rating, typedAnswer?, correct, durationMs
}

Settings {
  dailyMinutesGoal: number  // Standard 15
  newCardsPerDayDefault: number  // Standard 15
  desiredRetention: number  // Standard 0.90
  theme: 'system' | 'light' | 'dark'
  ttsVoiceEn?: string
  ttsVoiceFr?: string
}
```

Wichtig: **Richtungen sind getrennte Karten** mit eigenem FSRS-State. „Erkennen" (FR→DE) ist leichter als „Produzieren" (DE→FR); die App darf das nicht vermischen.

---

## 4. Import & Export

### 4.1 Import
1. **Einfügen (TSV/CSV)**: Textfeld, Spalten automatisch erkennen (Tab, `;`, `,`). Vorschau-Tabelle, Spalten per Dropdown zuordnen, Duplikate markieren.
2. **Datei-Import**: `.tsv`, `.csv`, `.txt`, `.json` (eigenes Backup-Format).
3. **Foto → Claude → TSV**: In der App gibt es einen Button „Prompt für Claude kopieren". Arthur fotografiert die Vokabelliste aus dem Buch, schickt Foto + diesen Prompt an Claude im Chat und kopiert das Ergebnis zurück. Der Prompt (in der App hinterlegt):

```
Wandle die Vokabelliste auf dem Foto in TSV um (Tab-getrennt), ohne Kopfzeile, eine Vokabel pro Zeile.
Spalten: Fremdwort<TAB>Deutsch<TAB>Beispielsatz<TAB>Genus(m/f/n/pl oder leer)<TAB>Notiz
- Französische Nomen IMMER mit Artikel (le/la/l'/les), bei l' das Genus in Spalte 4.
- Mehrere deutsche Bedeutungen mit ";" trennen.
- Fehlt ein Beispielsatz, schreib einen kurzen, einfachen (max. 8 Wörter).
- Gib NUR die TSV-Zeilen aus, keinen Kommentar.
```

### 4.2 Export
- **JSON-Backup** (alles inkl. Lernfortschritt) – manuell + automatische Erinnerung jede Woche.
- **TSV-Export pro Deck** (kompatibel mit Anki / Loopky / anderen Karteikarten-Apps).

---

## 5. Lernlogik (das Herz der App)

### 5.1 Tagessession
- Startseite zeigt: **„Heute: 12 Wiederholungen + 15 neue · ca. 14 Min"**.
- Reihenfolge in der Session: fällige Wiederholungen zuerst, neue Karten dazwischen gestreut (nicht alle am Schluss).
- Karten aus verschiedenen Decks werden **gemischt** (Interleaving), ausser Arthur wählt ein Deck explizit.
- Session-Länge nach Zeit (Standard 15 Min), nicht nach Kartenzahl. Danach: „Fertig für heute" + optional „Noch 5 Min?".
- Rückstand-Bremse: Wenn > 150 fällige Karten, keine neuen Karten, bis der Stau abgebaut ist (ausser Prüfungsmodus erzwingt es).

### 5.2 Lernleiter für neue Karten
Eine neue Vokabel geht diese Stufen durch, bevor sie in die normale FSRS-Wiederholung kommt:

1. **Intro**: Wort + Übersetzung + Beispielsatz + Audio. Feld für eigene Eselsbrücke. Kein Bewerten.
2. **Multiple Choice**: 4 Optionen, Ablenker aus demselben Deck (gleiche Wortart/Genus bevorzugt). Leichter Einstieg.
3. **Tippen**: Wort selbst schreiben. Erst wenn das **einmal richtig** klappt → Stufe `review`, erster FSRS-Eintrag.

Fehler auf Stufe 2 oder 3 → Karte kommt 3–5 Karten später in derselben Session nochmal.

### 5.3 Abfragemodi (für Wiederholungen)
| Modus | Was passiert | Bewertung |
|---|---|---|
| **Tippen** (Standard) | Frage zeigen → Antwort tippen | automatisch, siehe 5.4 |
| **Umdrehen** | Karte flippen, selbst bewerten (Nochmal / Schwer / Gut / Leicht) | manuell |
| **Hören** | Audio wird vorgelesen → tippen, was man hört | automatisch |
| **Sprechen** | Wort sehen → laut sagen → Spracherkennung prüft (nur Chrome/Edge; sonst ausgeblendet) | automatisch, grosszügig |
| **Multiple Choice** | nur für Stufe 2 und Problemwort-Drill | automatisch |

### 5.4 Automatische Bewertung beim Tippen
Vergleich nach Normalisierung (trimmen, Mehrfach-Leerzeichen, Gross/Klein egal, Satzzeichen am Ende egal). Mehrere gültige Lösungen (durch `;` getrennt) werden alle akzeptiert.

| Ergebnis | FSRS-Rating |
|---|---|
| Exakt richtig, schnell (< 8 s) | **Good** (Leicht nur, wenn Arthur aktiv „war zu leicht" drückt) |
| Exakt richtig, langsam (≥ 8 s) | **Good** |
| Nur Akzent-/Apostroph-Fehler (é/e, à/a, ç/c) | **Hard**, Fehler wird markiert (bei `strictAccents` → **Again**) |
| Tippfehler mit Levenshtein-Distanz 1 bei Wörtern ≥ 6 Buchstaben | **Hard** + Hinweis „fast!" |
| Falscher/fehlender Artikel (le statt la) | **Again**, Hinweis „Genus!" (das ist im Franz-Test ein Fehler) |
| Falsch | **Again** |

- Nach jedem Fehler: korrekte Lösung gross anzeigen, **Differenz farbig hervorheben** (welche Buchstaben falsch), Audio abspielen, Arthur muss die richtige Lösung **einmal abtippen**, bevor es weitergeht (Korrektur-Abschreiben verankert besser).
- Override-Button „Ich hatte recht" (z.B. Synonym) → Rating wird auf Good korrigiert, Synonym optional zur Note hinzufügen.

### 5.4b Hinweis-Leiter beim Tippen
Statt sofort aufzugeben, kann Arthur stufenweise Hinweise holen (Taste `H` / Button 💡):
1. Anzahl Buchstaben + Artikel (`la _ _ _ _ _ _ _ _ _ _ _`)
2. Erster Buchstabe
3. Beispielsatz mit Lücke
Jeder genutzte Hinweis senkt das Rating um eine Stufe (Good → Hard; ab Hinweis 2 → Again). So lernt man trotzdem, ohne dass FSRS getäuscht wird.

### 5.4c Selbsteinschätzung (Kalibrierung)
Im Probetest gibt Arthur vor jeder Antwort an: „sicher / unsicher". Die Auswertung zeigt danach, wo er sich **überschätzt** (sicher, aber falsch). Diese Wörter kommen ins Fehlerheft. Gegen das Gefühl „ich kann das eh".

### 5.5 Akzent-Hilfe
- Leiste mit Sonderzeichen über der Tastatur: `é è ê ë à â ç î ï ô û ù œ æ « »`.
- PC-Shortcut: Buchstabe + `Alt` durchläuft Varianten (e → é → è → ê → ë).

### 5.6 FSRS-Einstellungen
- `ts-fsrs` mit Standard-Parametern, `request_retention = 0.90`, `maximum_interval = 365`, `enable_fuzz = true`.
- Ab ~1000 ReviewLogs: Button „Algorithmus auf mich optimieren" (FSRS-Optimizer, falls in der JS-Version verfügbar; sonst Phase 3).

### 5.7 Problemwörter (Leeches)
- Karte hat ≥ 4 Lapses → `leech = true`, Badge 🔥 „Problemwort".
- Beim nächsten Erscheinen: Pflicht-Pause mit „Schreib dir eine Eselsbrücke" (Feld vorbefüllt mit Tipp, z.B. Ähnlichkeit zu Englisch/Deutsch).
- Eigene Rubrik **Fehlerheft**: alle Problemwörter + letzte Falsch-Antworten, eigener Drill (MC → Tippen).

---

## 6. Prüfungsmodus (Killer-Feature)

Arthur setzt beim Deck ein **Testdatum**. Ab dann:

1. **Rückwärtsplanung**: Neue Karten pro Tag = `ceil(ungelernte Karten / (Tage bis Test − 2))`. Die letzten 2 Tage sind **nur Wiederholung**, keine neuen Wörter.
   - Beispiel: 190 Wörter, 14 Tage → 16 neue/Tag.
   - Zu wenig Zeit (> 40 neue/Tag nötig) → rote Warnung + Vorschlag „Heute 2 Sessions".
2. **Bereitschafts-Anzeige**: „Prüfungsbereitschaft 72 %" = durchschnittliche FSRS-Abrufwahrscheinlichkeit (Retrievability) aller Karten **am Testtag**, berechnet aus Stabilität. Pro Richtung getrennt anzeigen („Erkennen 85 % · Schreiben 64 %").
3. **Vor-Test-Boost** (letzte 3 Tage): Karten, deren Retrievability am Testtag < 85 % liegt, werden vorgezogen, auch wenn sie laut FSRS noch nicht fällig sind. Diese Zusatz-Reviews werden geloggt, verfälschen aber die Stabilität nicht (als `Manual`/Cram-Rating behandeln oder separat führen).
4. **Generalprobe**: Button „Probetest" → 20 zufällige Karten, nur Tippen, `strictAccents` an, keine Hilfe, Note am Schluss nach Schweizer Skala (1–6, linear: 6 bei 100 %, 4 bei 60 %), wie ein echter Vokitest.
5. **Nach dem Test**: Deck geht automatisch zurück in den normalen Modus (Wörter nicht löschen! Langzeitbehalten ist der Punkt).
6. Countdown auf der Startseite: „🇫🇷 Franz Voki in 15 Tagen · 34 % bereit".

---

## 7. Screens

1. **Heute** (Startseite): Tagesaufgabe, Start-Button riesig, Countdown(s) zu Tests, Streak, Bereitschaftsbalken pro Testdeck.
2. **Session**: Vollbild, eine Karte, Fortschrittsbalken oben, Timer dezent. PC-Shortcuts: `Enter` prüfen/weiter, `Space` umdrehen, `1–4` bewerten, `Ctrl+Space` Audio.
3. **Decks**: Liste mit Kartenzahl, fällig, neu, Testdatum. Deck öffnen → Wortliste (suchen, bearbeiten, sperren), Einstellungen.
4. **Import**: siehe Abschnitt 4.
5. **Fehlerheft**: Problemwörter + Drill.
6. **Statistik**: Aktivitäts-Heatmap (wie GitHub), Vorhersage fälliger Karten 30 Tage, Trefferquote pro Deck und Richtung, gelernte Wörter gesamt.
7. **Einstellungen**: Ziele, Retention, Stimmen, Theme, Backup/Restore.

---

## 8. Design

- **Professionell, ruhig, kein Comic-Stil.** Vorbild: Linear / Things / Apple-Apps.
- Mobile first, aber am PC ebenfalls gut (max. Breite der Lernkarte ~640 px, zentriert).
- Dark + Light Mode, systemabhängig.
- Schrift: Inter (UI) + grosse Schrift auf der Karte (≥ 32 px für das Wort).
- Farben: neutrales Grau/Weiss, ein Akzent (Blau). Feedback: Grün (richtig), Orange (fast/Akzent), Rot (falsch) – dezent, nicht schreiend.
- Flaggen-Emoji/Farbcode pro Sprache (🇬🇧 / 🇫🇷) für schnelle Orientierung.
- Animationen kurz (150–250 ms): Karten-Flip, sanftes Wackeln bei falsch, kleiner Haken bei richtig. Respektiert `prefers-reduced-motion`.
- Touch-Ziele ≥ 44 px. Kontraste nach WCAG AA.

---

## 9. Phasenplan

### Phase 1 – MVP (Ziel: vor dem Englisch-Voki am 18.11. nutzbar)
- Projekt-Setup mit Ordnerstruktur aus 2b, PWA, Deploy auf GitHub Pages
- Responsive Layout: Handy-Layout und PC-Layout (Breakpoint 900 px)
- Tauri-Hülle + Windows-Installer-Build per GitHub Actions (Release)
- Decks + Notes + Cards (Dexie)
- Import per Einfügen (TSV) + Foto-Prompt-Button
- Lernleiter (Intro → MC → Tippen)
- Tipp-Modus mit automatischer Bewertung + Umdreh-Modus
- FSRS via ts-fsrs
- Prüfungsmodus: Testdatum, Rückwärtsplanung, Countdown, Bereitschafts-%
- Akzent-Leiste
- JSON-Backup Export/Import
- Startseite „Heute"

### Phase 2 – vor dem Franz-Voki am 26.11.
- Audio (TTS), Hör-Modus
- Problemwörter + Fehlerheft
- Probetest mit Note
- Vor-Test-Boost
- Statistik-Screen
- TSV-Export
- **Sync PC ↔ Handy über Supabase** (siehe 2b)
- Hinweis-Leiter + Selbsteinschätzung im Probetest
- PC: Tray-Icon „X fällig"; Handy: Wischgesten, Vibration

### Phase 3 – später
- Sprech-Modus (SpeechRecognition)
- Android-APK via Capacitor (nur falls Android-Handy)
- Push-Erinnerung
- FSRS-Parameter-Optimierung
- Konjugations-Karten (Verb + Person → Form) für Französisch

---

## 10. Akzeptanzkriterien (Claude Code muss das prüfen)

- [ ] `npm run build` läuft ohne Fehler, `npm test` grün.
- [ ] Unit-Tests für: Antwort-Normalisierung, Akzent-Erkennung, Artikel-Erkennung, Levenshtein-Logik, Rating-Zuordnung, Rückwärtsplanung im Prüfungsmodus, Bereitschafts-Berechnung.
- [ ] Import von 190 Zeilen TSV dauert < 1 s, erzeugt 190 Notes und pro gewählter Richtung je eine Card.
- [ ] App funktioniert offline nach dem ersten Laden (Flugmodus-Test).
- [ ] Installierbar als PWA (Manifest, Icons 192/512, Service Worker).
- [ ] Am PC komplett mit Tastatur bedienbar.
- [ ] Auf 375 px Breite (iPhone SE) nichts abgeschnitten.
- [ ] Daten bleiben nach Reload erhalten.
- [ ] Deploy-Workflow pusht automatisch auf GitHub Pages; Link funktioniert auf dem Handy.
- [ ] Windows-Installer (`.msi`) wird per GitHub Actions gebaut und als Release hochgeladen; App startet unter Windows und nutzt das PC-Layout.
- [ ] Ab Phase 2: Eine Session am Handy ist nach Sync auf dem PC sichtbar, und umgekehrt. Offline gemachte Reviews gehen nicht verloren.
- [ ] TSV-Export lässt sich in Anki bzw. Loopky importieren (mit dem `loopky`-CLI testen, falls verfügbar).

---

## 11. Plugins & Skills, die Claude Code verwenden MUSS

Vor dem Start: `/plugin` bzw. die Skill-Liste prüfen. Fehlt eines, sag Arthur, welches er installieren soll, und mach mit den verfügbaren weiter.

| Wann | Plugin / Skill | Wofür |
|---|---|---|
| Start | **superpowers:brainstorming** | Konzept kurz gegenchecken, Lücken finden (max. 3 Rückfragen, dann bauen) |
| Start | **superpowers:writing-plans** | Umsetzungsplan pro Phase |
| Start | **engineering:architecture** / **engineering:system-design** | Architektur aus 2b bestätigen (geteilter Code, Sync-Konzept) |
| Lernlogik | **learning-framework:spaced-repetition**, **:active-recall**, **:interleaving**, **:chunking** | Lernleiter, Session-Mix und Kartenlogik nach Lernforschung prüfen |
| Lernlogik | **education-agent-skills:spaced-practice-scheduler**, **:retrieval-practice-generator**, **:progressive-hint-ladder**, **:confidence-calibration-check**, **:error-analysis-protocol**, **:cognitive-load-analyser** | Prüfungsplanung, Hinweis-Leiter, Selbsteinschätzung, Fehlerheft, Screens nicht überladen |
| Doku | **Context7** (MCP) | aktuelle Docs für ts-fsrs, Dexie, Tauri 2, vite-plugin-pwa, Supabase holen, bevor du sie benutzt |
| Bauen | **superpowers:test-driven-development** | Tests für `src/lib/` zuerst |
| Bauen | **superpowers:subagent-driven-development** / **:dispatching-parallel-agents** | unabhängige Teile parallel (z. B. Import-Screen + Statistik) |
| Bauen | **frontend-design** | professionelles UI nach Abschnitt 8 |
| Design | **design-skills:interaction-design**, **design:ux-copy** / **design-skills:ux-writing** | Animationen, Gesten, kurze deutsche Texte in der App |
| Design-Check | **ui-design-review:review** → **ui-design-review:polish**, **ui-design-review:compare** | jeden Haupt-Screen reviewen, polieren, mit Anki/Duolingo vergleichen |
| Design-Check | **design:accessibility-review** / **design-skills:accessibility-audit** | Kontraste, Touch-Ziele, Tastatur |
| Debugging | **superpowers:systematic-debugging** | bei jedem Bug statt Rumprobieren |
| Qualität | **engineering:testing-strategy**, **engineering:code-review**, **superpowers:requesting-code-review** | Testabdeckung + Review vor jedem Phasen-Abschluss |
| Export | **loopky** | TSV-Export gegen das Loopky-Format testen |
| Abschluss | **engineering:deploy-checklist**, **superpowers:verification-before-completion**, **superpowers:finishing-a-development-branch** | vor „fertig" alles beweisen: Build, Tests, Deploy, Installer |
| Doku | **engineering:documentation** | README: Installation PC + Handy, Import, Sync einrichten |
| Lernen (optional) | **learn** (`/learn:speed` als Standard) | Arthur kann jederzeit `/learn:why` oder `/learn:explain` fragen, ohne dass der Build langsamer wird |

Bewusst **nicht** verwendet: swiftui-app-design (native iPhone-App braucht einen Mac), Figma (kein Account nötig, frontend-design reicht), Nibomo/MasterKi (fremde Apps, Voki ersetzt sie). Alles andere (Buchhaltung, Sales, Legal …) hat mit einer Lern-App nichts zu tun.
