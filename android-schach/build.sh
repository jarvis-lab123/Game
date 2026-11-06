#!/usr/bin/env bash
# Baut Claude Chess als Android-App (APK) – ohne Android Studio.
# Benötigt (Ubuntu): apt-get install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 default-jdk
set -euo pipefail
cd "$(dirname "$0")"
SDK=/usr/lib/android-sdk/platforms/android-23/android.jar
VER=1
B=build
rm -rf "$B" && mkdir -p "$B/gen" "$B/obj" "$B/assets/www"
# App-Dateien (inkl. Stockfish-Engine) in die APK kopieren – Service Worker wird in der App nicht gebraucht
cp -r ../schach/index.html ../schach/style.css ../schach/js ../schach/vendor ../schach/engine ../schach/pieces ../schach/icons "$B/assets/www/"
aapt package -f -m -J "$B/gen" -M AndroidManifest.xml -S res -A "$B/assets" -I "$SDK" -0 wasm \
  --min-sdk-version 24 --target-sdk-version 29 --version-code "$VER" --version-name "1.$VER" \
  -F "$B/app.unsigned.apk"
javac --release 8 -nowarn -classpath "$SDK" -d "$B/obj" $(find src "$B/gen" -name '*.java') 2>&1 | grep -v 'warning' || true
dalvik-exchange --dex --output="$B/classes.dex" "$B/obj"
(cd "$B" && aapt add app.unsigned.apk classes.dex >/dev/null)
zipalign -f 4 "$B/app.unsigned.apk" "$B/app.aligned.apk"
[ -f claudechess.keystore ] || keytool -genkeypair -keystore claudechess.keystore -alias claudechess -keyalg RSA -keysize 2048 \
  -validity 10000 -storepass claudechess -keypass claudechess -dname "CN=Claude Chess, O=Game, C=CH" >/dev/null 2>&1
apksigner sign --ks claudechess.keystore --ks-key-alias claudechess --ks-pass pass:claudechess --key-pass pass:claudechess \
  --out "ClaudeChess.apk" "$B/app.aligned.apk"
apksigner verify "ClaudeChess.apk"
rm -rf "$B"
ls -la ClaudeChess.apk
