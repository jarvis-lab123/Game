# Voki – Vokabeltrainer

Lernt Vokabeln mit **Spaced Repetition (FSRS)**, lässt dich die Wörter **schreiben** statt nur umdrehen und rechnet **rückwärts vom Testdatum**, wie viel heute dran ist.

- **Handy (iPhone/Android):** https://jarvis-lab123.github.io/Game/voki/
- **PC (Windows):** https://github.com/jarvis-lab123/Game/releases/tag/voki-v0.1.0 → `Voki-Setup-0.1.0.msi`

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

## Prüfungsmodus

Beim Deck ein **Testdatum** setzen. Dann:
- Neue Wörter pro Tag = Rest ÷ (Tage bis Test − 2). Die **letzten 2 Tage nur Wiederholung**.
- **Prüfungsbereitschaft** = wie wahrscheinlich du die Wörter **am Testtag** noch weisst, getrennt für **Erkennen** (FR→DE) und **Schreiben** (DE→FR).
- In den **letzten 3 Tagen** kommen zusätzlich wackelige Wörter dran (zählen nicht doppelt für den Algorithmus).
- Nach dem Test geht das Deck automatisch zurück in den normalen Modus, die Wörter bleiben.

## Lernen

Neue Wörter: **Kennenlernen → Auswählen (4 Optionen) → selbst schreiben**. Erst wenn das Schreiben einmal klappt, kommt das Wort in die normale Wiederholung. Bei Fehlern siehst du farbig, welche Buchstaben falsch waren, und tippst die Lösung einmal ab.

**Bewertung beim Tippen:** Gross/Klein und Punkt am Ende egal. Nur Akzent falsch = „fast“ (bei „Akzente streng“ = falsch). Ein Tippfehler in langen Wörtern = „fast“. Falscher Artikel im Französisch (le/la) = falsch („Genus!“).

**PC-Tasten:** `Enter` prüfen/weiter · `Leertaste` umdrehen · `1`–`4` auswählen/bewerten · `Ctrl+Leertaste` Aussprache · `Alt`+Buchstabe Akzent (e → é → è → ê → ë) · `Esc` beenden.

## Backup

**Einstellungen → Backup herunterladen** speichert alles (inkl. Lernfortschritt) als JSON. Handy und PC haben **getrennte Speicher**; bis der Sync kommt (Phase 2), bringst du Daten per Backup auf das andere Gerät (**Backup laden …**). Voki erinnert dich wöchentlich.

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
