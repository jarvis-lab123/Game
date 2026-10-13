#!/usr/bin/env bash
# Baut Alpine Grand Slam als Android-App (APK) – ohne Android Studio.
# Benötigt (Ubuntu): apt-get install aapt apksigner zipalign dalvik-exchange android-sdk-platform-23 default-jdk
set -euo pipefail
cd "$(dirname "$0")"
SDK=/usr/lib/android-sdk/platforms/android-23/android.jar
VER=27
B=build
rm -rf "$B" && mkdir -p "$B/gen" "$B/obj" "$B/assets/www"
# Spiel-Dateien in die App kopieren
cp -r ../alpine/vendor ../alpine/fonts ../alpine/icons "$B/assets/www/"
# In der App gibt es keinen Service Worker (alles liegt schon lokal)
sed "s/'serviceWorker' in navigator&&location.protocol==='https:'/'serviceWorker' in navigator\&\&!\/AlpineApp\/.test(navigator.userAgent)\&\&location.protocol==='https:'/" ../alpine/index.html > "$B/assets/www/index.html"
grep -q 'AlpineApp' "$B/assets/www/index.html"
aapt package -f -m -J "$B/gen" -M AndroidManifest.xml -S res -A "$B/assets" -I "$SDK" \
  --min-sdk-version 24 --target-sdk-version 29 --version-code "$VER" --version-name "$VER" \
  -F "$B/app.unsigned.apk"
javac --release 8 -nowarn -classpath "$SDK" -d "$B/obj" $(find src "$B/gen" -name '*.java') 2>&1 | grep -v 'warning' || true
dalvik-exchange --dex --output="$B/classes.dex" "$B/obj"
(cd "$B" && aapt add app.unsigned.apk classes.dex >/dev/null)
zipalign -f 4 "$B/app.unsigned.apk" "$B/app.aligned.apk"
[ -f grandslam.keystore ] || keytool -genkeypair -keystore grandslam.keystore -alias grandslam -keyalg RSA -keysize 2048 \
  -validity 10000 -storepass grandslam -keypass grandslam -dname "CN=Alpine Grand Slam, O=Game, C=CH" >/dev/null 2>&1
apksigner sign --ks grandslam.keystore --ks-key-alias grandslam --ks-pass pass:grandslam --key-pass pass:grandslam \
  --out "AlpineGrandSlam.apk" "$B/app.aligned.apk"
apksigner verify "AlpineGrandSlam.apk"
ls -la AlpineGrandSlam.apk
