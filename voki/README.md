# Voki – Vokabeltrainer

Lernt Vokabeln mit **Spaced Repetition (FSRS)**, lässt dich die Wörter **schreiben** statt nur umdrehen und rechnet **rückwärts vom Testdatum**, wie viel heute dran ist.

- **Handy (iPhone/Android):** https://jarvis-lab123.github.io/Game/voki/
- **PC (Windows):** https://github.com/jarvis-lab123/Game/releases/tag/voki-v0.2.0 → `Voki-Setup-0.2.0.msi`

## Installieren

**iPhone:** Link oben in **Safari** öffnen → Teilen-Symbol → **„Zum Home-Bildschirm“**.
**Android:** Link in **Chrome** öffnen → Menü ⋮ → **„App installieren“**.
Danach funktioniert Voki auch **ohne Internet** (Tram, Flugmodus).

**Windows:** `.msi` herunterladen und doppelklicken. Kommt „Der Computer wurde durch Windows geschützt“: **Weitere Informationen → Trotzdem ausführen** (die App ist nicht kostenpflichtig signiert). Alternativ läuft Voki am PC auch einfach im Browser über den Link oben.

## Vokabeln importieren (2 Minuten)

1. In Voki: **Import → „Prompt für Claude kopieren“**.
2. Vokabelliste im Buch fotografieren, Foto + Prompt an Claude schicken.
3. Claudes Antwort (TSV-Zeilen) kopieren, in Voki bei **Einfügen** einfügen, Vorschau prüfen, **„… Wörter importieren“**.

Format (Tab-getrennt): `Fremdwort  Deutsch  Beispielsatz  Genus  Notiz`. Mehrere Bedeutungen mit `;` trennen, z. B. `die Bäckerei; der Bäcker`. Teile in Klammern sind optional: `(sich) erinnern`.

## Lernen

**Heute → Lernen starten:** Du wählst, wie viel Zeit du hast (5–40 Min) und wie du üben willst. Voki packt genau so viel hinein und teilt es in **Gruppen à max. 5 neue Wörter** (kurze Pause dazwischen).

| Modus | So geht's |
|---|---|
| **Tippen** | Wie im Test. Automatische Bewertung (Akzente, Tippfehler, Genus). Bei Fehlern: Lösung farbig, einmal abtippen. 💡 Hinweis-Leiter: Satz mit Lücke → Buchstabenzahl → erster Buchstabe (jeder Hinweis senkt die Bewertung). |
| **Handschrift** | Mit Finger/Stift aufs Feld schreiben oder „Lieber auf Papier“, dann Lösung zeigen und selbst bewerten: Falsch · Fast · Richtig. |
| **Hören** | Voki spricht das Fremdwort, du tippst die Bedeutung. |
| **Umdrehen** | Schnell durch: Karte umdrehen, Nochmal/Schwer/Gut/Leicht – oder wischen (links = nochmal, rechts = gut). |

Neue Wörter: **Kennenlernen → Auswählen → selbst schreiben**. **Was sitzt?** Voki erkennt pro Wort *sitzt · lernt · wackelt · neu* (aus Gedächtnisstärke und deinen letzten Antworten) und zeigt es auf „Heute“ und im Deck.

**Eselsbrücken:** Beim neuen Wort und in **Üben → Eselsbrücken** schlägt Voki Merkhilfen vor (Genus-Regeln wie *-tion = la*, Wortteile wie *-erie = Laden*, ähnliche Wörter im Deutschen oder deinem Englisch-Deck). Dazu: eigener Satz, Emoji, eigene Skizze. Für viele Wörter: „Prompt kopieren“ → an Claude → Antwort einfügen. Problemwörter (4× vergessen) verlangen eine Eselsbrücke, bevor es weitergeht.

**Üben:** *Fehlerheft* (nach Ursache sortiert: nicht gewusst · Genus · Akzente/Tippfehler · überschätzt) mit Drill · *Probetest*: 20 Wörter, Akzente streng, vor jeder Antwort „sicher/unsicher“, am Schluss Note (6 = alles, 4 = 60 %) und deine Selbsteinschätzung.

**PC-Tasten:** `Enter` prüfen/weiter · `Leertaste` umdrehen · `1`–`4` auswählen/bewerten · `Ctrl+Leertaste` Aussprache · `Alt`+Buchstabe Akzent (e → é → è → ê → ë) · `S`/`U` sicher/unsicher im Probetest · `Esc` beenden. Die PC-App sitzt im Tray („Voki – 12 fällig“); Fenster schliessen = in den Tray.

## Prüfungsmodus

Beim Deck ein **Testdatum** setzen. Dann:
- Neue Wörter pro Tag = Rest ÷ (Tage bis Test − 2). Die **letzten 2 Tage nur Wiederholung** (spät importierte Wörter kommen trotzdem noch dran).
- **Prüfungsbereitschaft** = wie wahrscheinlich du die Wörter **am Testtag** noch weisst, getrennt für **Erkennen** und **Schreiben**.
- In den **letzten 3 Tagen** kommen wackelige Wörter zusätzlich dran.

## Sync PC ↔ Handy (gratis, ohne Login)

Läuft über ein **privates GitHub-Gist** in deinem GitHub-Konto.

1. Am PC: **Einstellungen → Sync → „Token erstellen“**. GitHub öffnet sich mit dem Häkchen **gist** schon gesetzt. Ablaufdatum wählen (z. B. „No expiration“ oder 1 Jahr), **Generate token**, Token kopieren.
2. In Voki einfügen → **Sync einschalten**. Voki zeigt einen **Sync-Code** (und QR-Code).
3. Am Handy: Voki öffnen → **Mehr → Sync → „Ich habe schon einen Sync-Code“** → Code einfügen (z. B. dir selbst per Nachricht schicken und kopieren) → **Verbinden**.

Danach synchronisieren beide automatisch (beim Start, nach jeder Session, alle 5 Min). Offline geht alles weiter; nichts geht verloren, der neueste Stand gewinnt. **Den Sync-Code nicht teilen** – er enthält deinen Token. Der Token steckt nicht im Backup.

## Backup

**Einstellungen → Backup herunterladen** speichert alles (inkl. Lernfortschritt) als JSON, zusätzlich zum Sync. Voki erinnert dich wöchentlich.

**TSV-Export:** im Deck unten „TSV exportieren“ (für Anki & Co.).

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:5173/Game/voki/
npm test           # Vitest (Bewertung, FSRS, Prüfungsplanung, Import, Backup)
npm run build      # PWA nach dist/
npm run tauri build -- --bundles msi   # Windows-Installer (auf Windows, Rust nötig)
```

Aufbau: `src/lib` reine, getestete Logik · `src/db` Dexie (IndexedDB) · `src/platform` Browser/Tauri-Adapter · `src/ui` Screens · `src-tauri` Windows-Hülle. Deploys: `.github/workflows/pages.yml` (PWA) und `voki-windows.yml` (.msi als Release).
Konzept: [`docs/VOKI_KONZEPT.md`](docs/VOKI_KONZEPT.md) · Plan: [`docs/plans/`](docs/plans/) · Architektur: [`docs/ADR-001-architektur.md`](docs/ADR-001-architektur.md)
