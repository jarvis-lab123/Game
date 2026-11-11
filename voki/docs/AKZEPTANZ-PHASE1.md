# Akzeptanzkriterien Phase 1 (Konzept §10) – Stand 11.11.2026

| Kriterium | Status | Beleg |
|---|---|---|
| `npm run build` ohne Fehler, `npm test` grün | ✅ | Build exit 0; Vitest 92/92 in 8 Dateien; CI-Build auf GitHub Actions grün |
| Unit-Tests: Normalisierung, Akzent, Artikel, Levenshtein, Rating, Rückwärtsplanung, Bereitschaft | ✅ | `src/lib/grade.test.ts`, `exam.test.ts`, `srs.test.ts`, `session.test.ts`, `src/db/queries.test.ts` |
| Import 190 Zeilen < 1 s, 190 Notes, je Richtung eine Card | ✅ | `repo.test.ts` (190 Notes / 380 Cards, < 1000 ms); im Browser 121–178 ms |
| Offline nach erstem Laden | ✅ | Playwright: Service Worker, Netz aus, Reload → App + Daten da (lokal **und** live auf GitHub Pages) |
| Installierbar als PWA (Manifest, Icons 192/512, SW) | ✅ | `manifest.webmanifest` standalone, 192/512/maskable, `sw.js` (Workbox) |
| Am PC komplett mit Tastatur bedienbar | ✅ | Playwright-Durchlauf nur Tastatur: Enter/1–4/Tippen/Abtippen/Esc; Fokusring sichtbar |
| 375 px (iPhone SE): nichts abgeschnitten | ✅ | Kein horizontaler Überlauf auf allen Screens; Live-Screenshot iPhone SE |
| Daten bleiben nach Reload erhalten | ✅ | IndexedDB + `navigator.storage.persist()`; Reload-Test |
| Deploy-Workflow → GitHub Pages; Link funktioniert | ✅ | https://jarvis-lab123.github.io/Game/voki/ live geprüft (iPhone-SE-Emulation, 0 Fehler) |
| Windows-Installer per Actions gebaut + als Release hochgeladen; startet, PC-Layout | ✅ / ⚠️ | Release `voki-v0.1.0` mit `Voki-Setup-0.1.0.msi` (gültige MSI, 2,5 MB, heruntergeladen und geprüft). Start unter Windows nur auf echtem PC prüfbar; Fenster 1200 px ≥ Breakpoint 900 px → PC-Layout. |
| Phase 2: Sync | – | Phase 2 |
| TSV-Export Anki/Loopky | – | Phase 2 (`loopky`-CLI nicht installiert) |

Zusätzlich: axe-core WCAG 2.2 A/AA ohne Verstösse (hell + dunkel), Code-Review durch separaten Reviewer, alle Critical/Important-Punkte behoben.
