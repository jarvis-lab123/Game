#!/usr/bin/env python3
"""Legt einen neuen Charakter-Ordner aus der Vorlage an.  Aufruf: python3 neuer_charakter.py <id> ["Anzeigename"]"""
import json
import os
import re
import shutil
import sys

HIER = os.path.dirname(os.path.abspath(__file__))
CHARS = os.path.normpath(os.path.join(HIER, "..", "spiel", "charaktere"))

if len(sys.argv) < 2:
    sys.exit(__doc__)
cid = sys.argv[1].strip().lower()
if not re.fullmatch(r"[a-z0-9_-]+", cid) or cid.startswith("_"):
    sys.exit("Die id darf nur a-z, 0-9, _ und - enthalten (z. B. max oder lisa_b).")
ziel = os.path.join(CHARS, cid)
if os.path.exists(ziel):
    sys.exit(f"{ziel} gibt es schon.")
shutil.copytree(os.path.join(CHARS, "_vorlage"), ziel)
os.remove(os.path.join(ziel, "LIES_MICH.md"))
os.makedirs(os.path.join(ziel, "fotos"), exist_ok=True)
pfad = os.path.join(ziel, "charakter.json")
d = json.load(open(pfad, encoding="utf-8"))
d["name"] = sys.argv[2] if len(sys.argv) > 2 else cid.capitalize()
json.dump(d, open(pfad, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
print(f"Angelegt: {ziel}\n→ Fotos nach {os.path.join(ziel, 'fotos')} legen, charakter.json ausfüllen,\n"
      f"→ dann: python3 werkzeuge/foto_zu_charakter.py {cid}")
