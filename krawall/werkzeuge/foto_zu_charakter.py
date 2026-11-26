#!/usr/bin/env python3
"""
Krawall Crew – Foto → spielbarer 3D-Charakter (über die Meshy-API)

Ablauf (jeder Schritt wird in meshy_status.json gemerkt; ein erneuter Aufruf macht dort weiter):
  1. stil     Fotos aus charaktere/<id>/fotos/ → Comic-Figur als Ganzkörperbild (Meshy Image-to-Image)
  2. modell   Bild → texturiertes 3D-Modell in A-Pose (Meshy Image-to-3D)
  3. rig      Skelett einbauen (Meshy Rigging, Zweibeiner)
  4. anim     Animationen anwenden (Meshy Animation Library, eine Datei mit allen Clips)
  5. blender  Clips umbenennen (reines Python, kein Blender nötig) (Idle, Run, Attack, Super, Victory, Hit, Dead) → model.glb fürs Spiel

Aufruf:
  python3 foto_zu_charakter.py <id>                 alles bis zum Ende
  python3 foto_zu_charakter.py <id> --bis stil      nur das Comic-Bild machen (zum Anschauen)
  python3 foto_zu_charakter.py <id> --neu stil      ab einem Schritt neu machen (z. B. anderes Bild)

API-Schlüssel: Umgebungsvariable MESHY_API_KEY (msy_...).
In der Claude-Cloud-Umgebung setzt der Proxy den Schlüssel selbst ein, dort ist keine Variable nötig.
"""
import argparse
import base64
import io
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

BASIS = "https://api.meshy.ai/openapi/v1"
HIER = os.path.dirname(os.path.abspath(__file__))
CHAR_ORDNER = os.path.normpath(os.path.join(HIER, "..", "spiel", "charaktere"))
SCHRITTE = ["stil", "modell", "rig", "anim", "blender"]

# Meshy-Animationsbibliothek (biped). Clip-Namen in der Datei = Bibliotheksname.
STANDARD_ANIMATIONEN = {
    "Idle": 0,          # Idle
    "Run": 658,         # run_fast_2_inplace
    "Super": 397,       # 360_Power_Spin_Jump
    "Victory": 59,      # Victory_Cheer
    "Hit": 178,         # Hit_Reaction
    "Dead": 8,          # Dead
}
ANGRIFF_ANIMATION = {   # passend zum Angriffstyp
    "schuss": 232,      # Cowboy_Quick_Draw_Shooting
    "schrot": 232,
    "wurf": 421,        # Over_Shoulder_Throw
    "nahkampf": 96,     # Kung_Fu_Punch
}

STIL_PROMPT = (
    "Turn the person in the reference photos into a full-body 3D video game hero character, "
    "in the polished stylized look of a high-end cartoon battle-royale game: clean shapes, slightly "
    "heroic proportions (head about one sixth of body height), smooth skin, crisp readable details, "
    "vibrant colors, soft studio lighting. Keep the person clearly recognizable: same face shape, "
    "eyes, nose, eyebrows, mouth, hairstyle, hair color, skin tone, facial hair and glasses as in the photos. "
    "Standing straight in an A-pose, arms slightly away from the body, legs apart, facing the camera, "
    "full body from head to shoes visible, neutral friendly expression, plain white background, "
    "no text, no weapon in the hands."
)


# ---------------------------------------------------------------- HTTP
def schluessel():
    k = os.environ.get("MESHY_API_KEY", "").strip()
    return k or "msy_platzhalter_der_proxy_setzt_den_echten_schluessel_ein"


def anfrage(methode, pfad, daten=None):
    url = pfad if pfad.startswith("http") else BASIS + pfad
    body = json.dumps(daten).encode() if daten is not None else None
    req = urllib.request.Request(url, data=body, method=methode, headers={
        "Authorization": "Bearer " + schluessel(),
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.loads(r.read().decode() or "{}"), r.headers
    except urllib.error.HTTPError as e:
        text = e.read().decode(errors="replace")
        if e.code == 401:
            sys.exit("Meshy sagt 401: kein gültiger API-Schlüssel. Setze MESHY_API_KEY "
                     "(oder hinterlege den Schlüssel in der Cloud-Umgebung für api.meshy.ai).")
        if e.code == 402:
            sys.exit("Meshy sagt 402: nicht genug Credits auf dem Konto.\n" + text)
        sys.exit(f"Meshy-Fehler {e.code} bei {methode} {url}:\n{text}")


def warten(art, task_id, name):
    print(f"  … warte auf {name} ({art}/{task_id})", flush=True)
    letzte = -1
    while True:
        t, h = anfrage("GET", f"/{art}/{task_id}")
        st = t.get("status")
        p = t.get("progress", 0)
        if p != letzte:
            print(f"    {st} {p}%", flush=True)
            letzte = p
        if st == "SUCCEEDED":
            print(f"  ✓ {name} fertig (Credits: {t.get('consumed_credits', '?')})")
            return t
        if st in ("FAILED", "CANCELED", "EXPIRED"):
            sys.exit(f"  ✗ {name} {st}: {json.dumps(t.get('task_error'), ensure_ascii=False)}")
        time.sleep(max(3, int(h.get("Retry-After", 5) or 5)))


def laden(url, ziel):
    with urllib.request.urlopen(url, timeout=300) as r, open(ziel, "wb") as f:
        f.write(r.read())
    print("  ↓", os.path.relpath(ziel, HIER))


def als_data_uri(pfad, max_kante=1280):
    from PIL import Image, ImageOps
    bild = ImageOps.exif_transpose(Image.open(pfad)).convert("RGB")
    bild.thumbnail((max_kante, max_kante))
    puffer = io.BytesIO()
    bild.save(puffer, "JPEG", quality=90)
    return "data:image/jpeg;base64," + base64.b64encode(puffer.getvalue()).decode()


# ---------------------------------------------------------------- Schritte
def schritt_stil(c, st):
    fotos_ordner = os.path.join(c["ordner"], "fotos")
    fotos = sorted(f for f in os.listdir(fotos_ordner)
                   if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp", ".heic"))) if os.path.isdir(fotos_ordner) else []
    if not fotos:
        sys.exit(f"Keine Fotos in {fotos_ordner}. Lege 1–5 Fotos der Person hinein (Gesicht gut sichtbar, "
                 f"am besten eins von vorne und eins vom ganzen Körper).")
    extra = c["daten"].get("meshy", {}).get("stil_zusatz", "")
    kleidung = c["daten"].get("meshy", {}).get("kleidung", "")
    prompt = STIL_PROMPT
    if kleidung:
        prompt += " Outfit: " + kleidung + "."
    if extra:
        prompt += " " + extra
    print(f"  {len(fotos)} Foto(s): {', '.join(fotos[:5])}")
    t, _ = anfrage("POST", "/image-to-image", {
        "ai_model": c["daten"].get("meshy", {}).get("bild_modell", "nano-banana-pro"),
        "reference_image_urls": [als_data_uri(os.path.join(fotos_ordner, f)) for f in fotos[:5]],
        "prompt": prompt,
        "aspect_ratio": "3:4",
        "remove_background": True,
    })
    fertig = warten("image-to-image", t["result"], "Comic-Bild")
    url = fertig["image_urls"][0]
    laden(url, os.path.join(c["ordner"], "comic_bild.png"))
    st["stil"] = {"task": t["result"], "bild_url": url}


def schritt_modell(c, st):
    bild_pfad = os.path.join(c["ordner"], "comic_bild.png")
    quelle = als_data_uri(bild_pfad, 2048) if os.path.exists(bild_pfad) else st["stil"]["bild_url"]
    m = c["daten"].get("meshy", {})
    t, _ = anfrage("POST", "/image-to-3d", {
        "image_url": quelle,
        "ai_model": m.get("3d_modell", "latest"),
        "pose_mode": "a-pose",
        "should_texture": True,
        "enable_pbr": False,
        "should_remesh": True,
        "topology": "triangle",
        "target_polycount": int(m.get("polygone", 30000)),
        "origin_at": "bottom",
    })
    fertig = warten("image-to-3d", t["result"], "3D-Modell")
    laden(fertig["model_urls"]["glb"], os.path.join(c["ordner"], "meshy_modell.glb"))
    if fertig.get("thumbnail_url"):
        laden(fertig["thumbnail_url"], os.path.join(c["ordner"], "meshy_vorschau.png"))
    st["modell"] = {"task": t["result"]}


def schritt_rig(c, st):
    t, _ = anfrage("POST", "/rigging", {
        "input_task_id": st["modell"]["task"],
        "animation_type": "biped",
        "height_meters": float(c["daten"].get("meshy", {}).get("groesse_m", 1.75)),
    })
    fertig = warten("rigging", t["result"], "Rigging")
    laden(fertig["result"]["rigged_character_glb_url"], os.path.join(c["ordner"], "meshy_rig.glb"))
    st["rig"] = {"task": t["result"]}


def animations_liste(c):
    anim = dict(STANDARD_ANIMATIONEN)
    typ = c["daten"].get("angriff", {}).get("typ", "schuss")
    anim["Attack"] = ANGRIFF_ANIMATION.get(typ, 232)
    anim.update({k: int(v) for k, v in c["daten"].get("meshy", {}).get("animationen", {}).items()})
    return anim


def schritt_anim(c, st):
    anim = animations_liste(c)
    namen = list(anim.keys())
    ids = [anim[n] for n in namen]
    t, _ = anfrage("POST", "/animations", {"rig_task_id": st["rig"]["task"], "action_ids": ids})
    fertig = warten("animations", t["result"], "Animationen")
    laden(fertig["result"]["animation_glb_url"], os.path.join(c["ordner"], "meshy_animiert.glb"))
    st["anim"] = {"task": t["result"], "reihenfolge": namen, "ids": ids}


def schritt_blender(c, st):
    skript = os.path.join(HIER, "glb_clips_umbenennen.py")
    namen = st["anim"]["reihenfolge"]
    cmd = [sys.executable, skript, os.path.join(c["ordner"], "meshy_animiert.glb"),
           os.path.join(c["ordner"], "model.glb"), ",".join(namen)]
    print("  $", " ".join(os.path.relpath(x, HIER) if os.path.exists(x) else x for x in cmd))
    r = subprocess.run(cmd)
    if r.returncode != 0:
        sys.exit("Blender-Nachbearbeitung fehlgeschlagen.")
    st["blender"] = {"fertig": True}


# ---------------------------------------------------------------- Hauptprogramm
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("id", help="Ordnername des Charakters in spiel/charaktere/")
    ap.add_argument("--bis", choices=SCHRITTE, help="nach diesem Schritt anhalten")
    ap.add_argument("--neu", choices=SCHRITTE, help="ab diesem Schritt neu machen")
    a = ap.parse_args()

    ordner = os.path.join(CHAR_ORDNER, a.id)
    json_pfad = os.path.join(ordner, "charakter.json")
    if not os.path.exists(json_pfad):
        sys.exit(f"{json_pfad} fehlt. Lege zuerst den Charakter an: python3 neuer_charakter.py {a.id}")
    with open(json_pfad, encoding="utf-8") as f:
        daten = json.load(f)
    status_pfad = os.path.join(ordner, "meshy_status.json")
    st = json.load(open(status_pfad)) if os.path.exists(status_pfad) else {}
    if a.neu:
        for s in SCHRITTE[SCHRITTE.index(a.neu):]:
            st.pop(s, None)
    c = {"ordner": ordner, "daten": daten}
    funktionen = {"stil": schritt_stil, "modell": schritt_modell, "rig": schritt_rig,
                  "anim": schritt_anim, "blender": schritt_blender}
    for s in SCHRITTE:
        if s in st:
            print(f"[{s}] schon erledigt")
        else:
            print(f"[{s}] …")
            funktionen[s](c, st)
            with open(status_pfad, "w") as f:
                json.dump(st, f, indent=2, ensure_ascii=False)
        if a.bis == s:
            print(f"Angehalten nach Schritt '{s}'. Weiter mit: python3 foto_zu_charakter.py {a.id}")
            return
    print(f"\nFertig! {daten.get('name', a.id)} ist spielbereit: {os.path.relpath(os.path.join(ordner, 'model.glb'), HIER)}")


if __name__ == "__main__":
    main()
