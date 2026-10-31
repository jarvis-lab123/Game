# Fairway – iOS-App

Native iOS-Hülle (Capacitor 8, Swift Package Manager) für die Web-App aus `../fairway`.
Spiel, Schrift und Icons liegen in der App, sie läuft komplett offline. Auf dem iPhone gibt es echte Haptik (Taptic Engine).

| | |
|---|---|
| App-Name | Fairway |
| Bundle-ID | `com.jarvislab.fairway` (in Xcode änderbar) |
| Version | 1.1 |
| iOS | ab 15.0, iPhone und iPad, nur Hochformat |
| Icon / Splash | `ios/App/App/Assets.xcassets` |

## Bauen (auf einem Mac)

Voraussetzung: macOS mit Xcode 16 oder neuer, Node.js 20+.

```bash
cd fairway-ios
npm install
npm run sync        # kopiert ../fairway nach www/ und in das Xcode-Projekt
npm run open        # öffnet ios/App/App.xcodeproj in Xcode
```

In Xcode:
1. Projekt „App“ → Target „App“ → **Signing & Capabilities** → dein Team wählen.
2. Oben ein iPhone (per Kabel) oder einen Simulator wählen → ▶︎ **Run**.

## Im App Store veröffentlichen

1. Apple-Developer-Konto (99 $/Jahr) und in App Store Connect eine neue App mit derselben Bundle-ID anlegen.
2. Xcode: **Product → Archive** → **Distribute App** → **App Store Connect** → Upload.
3. In App Store Connect: Screenshots (6,7″ und 6,5″ iPhone), Beschreibung, Kategorie *Spiele → Sport*, Altersfreigabe 4+,
   Datenschutz: *keine Daten erfasst* (der Spielstand liegt nur lokal auf dem Gerät).
4. Über **TestFlight** zuerst selbst testen, dann zur Prüfung einreichen.

Nach Änderungen am Spiel in `../fairway` einfach `npm run sync` ausführen und neu bauen.
