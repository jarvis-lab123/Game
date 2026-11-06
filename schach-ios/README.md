# Claude Chess – iOS-App

Eine native iOS-Hülle (Capacitor 8, Swift Package Manager) für die Web-App aus `../schach`.
Die Stockfish-Engine, die Figuren und die Puzzles liegen in der App, deshalb läuft sie komplett offline. Auf dem iPhone gibt es echte Haptik (Taptic Engine) bei Zügen, Schlagzügen, Schach und gelösten Puzzles.

| | |
|---|---|
| App-Name | Claude Chess |
| Bundle-ID | `com.jarvislab.claudechess` (in Xcode änderbar) |
| Version | 1.0 |
| iOS | ab 15.0, iPhone und iPad, nur Hochformat |
| Icon / Splash | `ios/App/App/Assets.xcassets` |

## Bauen (auf einem Mac)

Voraussetzung: macOS mit Xcode 16 oder neuer, Node.js 20+.

```bash
cd schach-ios
npm install
npm run sync        # kopiert ../schach nach www/ und in das Xcode-Projekt
npm run open        # öffnet das Projekt in Xcode
```

In Xcode:
1. Projekt „App“ → Target „App“ → **Signing & Capabilities** → dein Team wählen. Eine kostenlose Apple-ID reicht, um die App auf dein eigenes iPhone zu spielen (sie läuft dann 7 Tage und muss danach neu installiert werden).
2. Das iPhone per Kabel anschließen, oben auswählen → ▶︎ **Run**.
3. Beim ersten Mal auf dem iPhone: Einstellungen → Allgemein → VPN & Geräteverwaltung → dem Entwickler vertrauen. Außerdem unter Datenschutz & Sicherheit den **Entwicklermodus** einschalten.

## Im App Store veröffentlichen

1. Apple-Developer-Konto (99 $/Jahr) und in App Store Connect eine neue App mit derselben Bundle-ID anlegen.
2. Xcode: **Product → Archive** → **Distribute App** → **App Store Connect** → Upload.
3. In App Store Connect: Screenshots (6,7″ und 6,5″ iPhone), Beschreibung, Kategorie *Spiele → Brettspiele*, Altersfreigabe 4+.
   Datenschutz: *keine Daten erfasst* (Rang, Puzzles und Partien liegen nur lokal auf dem Gerät).
   Hinweis: Stockfish steht unter der GPLv3. Bei einer Veröffentlichung muss der Quellcode verfügbar sein, dafür reicht dieses öffentliche Repo.
4. Über **TestFlight** zuerst selbst testen, dann zur Prüfung einreichen.

Nach Änderungen an der App in `../schach` einfach `npm run sync` ausführen und neu bauen.
