#!/usr/bin/env python3
"""
Benennt die Animations-Clips einer GLB-Datei der Reihe nach um.
Meshy liefert die Clips in der Reihenfolge der angefragten action_ids, mit Bibliotheksnamen
(z. B. "run_fast_2_inplace"). Das Spiel erwartet Idle, Run, Attack, Super, Victory, Hit, Dead.

Aufruf: python3 glb_clips_umbenennen.py eingabe.glb ausgabe.glb Idle,Run,Super,Victory,Hit,Dead,Attack
"""
import json
import struct
import sys


def lesen(pfad):
    daten = open(pfad, "rb").read()
    magie, version, _ = struct.unpack_from("<4sII", daten, 0)
    assert magie == b"glTF", "keine GLB-Datei"
    pos, json_chunk, bin_chunk = 12, None, None
    while pos < len(daten):
        laenge, typ = struct.unpack_from("<I4s", daten, pos)
        inhalt = daten[pos + 8: pos + 8 + laenge]
        if typ == b"JSON":
            json_chunk = json.loads(inhalt.decode("utf-8"))
        elif typ == b"BIN\x00":
            bin_chunk = inhalt
        pos += 8 + laenge
    return version, json_chunk, bin_chunk


def schreiben(pfad, version, gltf, binaer):
    j = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    j += b" " * ((4 - len(j) % 4) % 4)
    teile = [struct.pack("<I4s", len(j), b"JSON") + j]
    if binaer is not None:
        b = binaer + b"\x00" * ((4 - len(binaer) % 4) % 4)
        teile.append(struct.pack("<I4s", len(b), b"BIN\x00") + b)
    koerper = b"".join(teile)
    with open(pfad, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", version, 12 + len(koerper)) + koerper)


def main():
    if len(sys.argv) != 4:
        sys.exit(__doc__)
    ein, aus, namen = sys.argv[1], sys.argv[2], sys.argv[3].split(",")
    version, gltf, binaer = lesen(ein)
    anims = gltf.get("animations", [])
    print(f"{len(anims)} Clips gefunden: {[a.get('name') for a in anims]}")
    if len(anims) < len(namen):
        print(f"Warnung: {len(namen)} Namen, aber nur {len(anims)} Clips – nur die ersten werden umbenannt.")
    for a, n in zip(anims, namen):
        print(f"  {a.get('name')!r} → {n!r}")
        a["name"] = n
    schreiben(aus, version, gltf, binaer)
    print("Gespeichert:", aus)


if __name__ == "__main__":
    main()
