# ADR-001: Eine Codebasis, offline-first, Tauri + PWA

**Status:** Accepted · **Datum:** 2026-11-11 · **Entscheider:** Arthur

## Context
Zwei Geräte (Windows-PC, Handy), 0 CHF, Test in 7 Tagen. Die App muss ohne Internet laufen (Tram), Lernfortschritt darf nie verloren gehen.

## Decision
- **Eine** Vite/React/TS-Codebasis. PWA-Build (`base=/game/voki/`) für GitHub Pages, Tauri-2-Build (`base=./`) für `.msi`.
- **Dexie (IndexedDB) ist die Hauptquelle.** Kein Server in Phase 1, JSON-Backup als Sicherung.
- `src/lib` = reine Funktionen ohne DOM/DB (Vitest), `src/db` = Schema + Repository, `src/platform` = Erkennung Tauri/Browser (Phase 2: Tray, Dateidialog), `src/ui` = Screens.
- **Sync (Phase 2)** über Supabase: jede Zeile bekommt `updatedAt` + `deviceId`, last-write-wins pro Datensatz; `logs` append-only (Union per id). Dafür trägt das Schema `updatedAt` bereits ab Phase 1.

## Options Considered
| | A: PWA + Tauri (gewählt) | B: Electron + PWA | C: nur PWA |
|---|---|---|---|
| Komplexität | mittel (Rust-Toolchain nur in CI) | mittel | niedrig |
| Grösse PC | ~10 MB | ~150 MB | 0 |
| Kosten | 0 | 0 | 0 |
| Echte Windows-App | ja (Tray, Autostart in Phase 2) | ja | nein |

## Trade-off
Tauri nutzt WebView2: IndexedDB der Tauri-App und der PWA sind **getrennte** Speicher, deshalb Backup bzw. Sync nötig. Akzeptiert, Sync kommt in Phase 2.

## Consequences
- Logik einmal testen, auf beiden Plattformen identisch.
- Bis Phase 2: Datenübertrag PC↔Handy nur per JSON-Backup.
