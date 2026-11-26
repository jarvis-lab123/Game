"""
Krawall Crew – Arena-Objekte (Blender 5.x)

Baut alle Umgebungs-Objekte im selben runden Comic-Stil wie die Figuren und
exportiert sie als eine Datei: spiel/arena/objekte.glb
Jedes Objekt ist ein eigener Knoten (Name = Objekttyp), Godot klont sie in die Arena.

Aufruf:  python3 umgebung_bauen.py
"""
import math
import os
import random
import sys

import bpy  # zuerst!
import bmesh
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import charakter_bauen as cb  # noqa: E402  (Material-/Formhilfen wiederverwenden)

KACHEL = 1.6  # Größe einer Arena-Kachel in Metern (muss zu arena.gd passen)
ZIEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "spiel", "arena", "objekte.glb")


def gruppe(name, teile):
    """Teile zu einem Objekt verbinden (ohne Skelett)."""
    obs = [o for o, _ in teile]
    bpy.ops.object.select_all(action='DESELECT')
    for o in obs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = obs[0]
    if len(obs) > 1:
        bpy.ops.object.join()
    ob = obs[0]
    ob.name = name
    ob.data.name = name
    bpy.ops.object.material_slot_remove_unused()
    cb.TEILE.clear()
    return ob


def wand():
    k = KACHEL
    m_stein = cb.material("stein", "#8C93A8")
    m_stein2 = cb.material("stein_hell", "#A9B0C4")
    m_moos = cb.material("moos", "#6CC24A")
    cb.rundbox("block", Vector((0, 0, 0.62)), (k * 0.98, k * 0.98, 1.24), m_stein, "", rundung=0.12)
    # Steine-Muster: einzelne gerundete Ziegel auf der Oberfläche
    random.seed(3)
    for seite in range(4):
        rot = Matrix.Rotation(seite * math.pi / 2, 4, 'Z')
        q = Matrix.Rotation(seite * math.pi / 2, 3, 'Z').to_quaternion()
        for reihe in range(3):
            mitten = (-0.25, 0.25) if reihe % 2 == 0 else (0.0,)
            for x in mitten:
                p = rot @ Vector((x * k, -k * 0.49, 0.22 + reihe * 0.4))
                cb.rundbox("ziegel", p, (0.42 * k, 0.06, 0.32), m_stein2, "", rundung=0.35, rot=q)
    # Moos-Kappe oben
    cb.rundbox("moos", Vector((0, 0, 1.25)), (k * 1.0, k * 1.0, 0.14), m_moos, "", rundung=0.45)
    for i in range(5):
        a = random.uniform(0, 2 * math.pi)
        r = random.uniform(0.2, 0.55) * k
        cb.ellipsoid("moosbuckel", Vector((math.cos(a) * r * 0.8, math.sin(a) * r * 0.8, 1.32)),
                     (0.18, 0.18, 0.09), m_moos, "", segs=16, ringe=10)
    return gruppe("Wand", cb.TEILE[:])


def kiste():
    k = KACHEL
    m_holz = cb.material("holz", "#C98B4B")
    m_holz2 = cb.material("holz_dunkel", "#9A6431")
    m_metall = cb.material("metall", "#5E6578", glanz=True)
    g = k * 0.86
    cb.rundbox("kiste", Vector((0, 0, g / 2)), (g, g, g), m_holz, "", rundung=0.08)
    for seite in range(4):
        rot = Matrix.Rotation(seite * math.pi / 2, 3, 'Z').to_quaternion()
        R = rot.to_matrix()
        # Rahmen + Kreuzstrebe
        for z in (0.07, g - 0.07):
            cb.rundbox("leiste", R @ Vector((0, -g / 2, z)), (g * 1.0, 0.07, 0.14), m_holz2, "", rundung=0.4, rot=rot)
        for x in (-g / 2 + 0.07, g / 2 - 0.07):
            cb.rundbox("leiste", R @ Vector((x, -g / 2, g / 2)), (0.14, 0.07, g), m_holz2, "", rundung=0.4, rot=rot)
        diag = Matrix.Rotation(math.radians(45), 3, 'Y').to_quaternion()
        cb.rundbox("strebe", R @ Vector((0, -g / 2, g / 2)), (g * 1.18, 0.06, 0.12), m_holz2, "", rundung=0.4,
                   rot=rot @ diag)
    for x in (-1, 1):
        for y in (-1, 1):
            cb.ellipsoid("niete", Vector((x * g * 0.45, y * g * 0.45, g + 0.01)), (0.05, 0.05, 0.03), m_metall, "",
                         segs=10, ringe=6)
    return gruppe("Kiste", cb.TEILE[:])


def busch():
    k = KACHEL
    m1 = cb.material("busch", "#3FA34D")
    m2 = cb.material("busch_hell", "#5CC45E")
    m3 = cb.material("beere", "#FF5C8A", glanz=True)
    random.seed(7)
    pos = []
    for i in range(9):
        a = i * 2.4
        r = 0.18 + 0.32 * ((i * 37) % 10) / 10
        pos.append((math.cos(a) * r * k * 0.6, math.sin(a) * r * k * 0.6))
    for i, (x, y) in enumerate(pos):
        rr = random.uniform(0.38, 0.52)
        cb.ellipsoid("blatt", Vector((x, y, 0.42 + random.uniform(-0.05, 0.12))), (rr, rr, rr * 0.92),
                     m1 if i % 3 else m2, "", segs=20, ringe=12)
    for i in range(4):
        a = random.uniform(0, 2 * math.pi)
        cb.ellipsoid("beere", Vector((math.cos(a) * 0.55, math.sin(a) * 0.55, 0.75 + random.uniform(-0.1, 0.1))),
                     (0.06, 0.06, 0.06), m3, "", segs=10, ringe=6)
    return gruppe("Busch", cb.TEILE[:])


def wasser():
    k = KACHEL
    m = cb.material("wasser", "#4CC9F0", glanz=True)
    m2 = cb.material("wasser_rand", "#B8F2FF")
    cb.rundbox("wasser", Vector((0, 0, -0.06)), (k, k, 0.12), m, "", rundung=0.1)
    for i in range(2):
        cb.torus("welle", Vector((0.25 - i * 0.5, 0.2 - i * 0.4, 0.005)), 0.18, 0.018, m2, "", normale=(0, 0, 1),
                 skal=(1.4, 0.5))
    return gruppe("Wasser", cb.TEILE[:])


def baum():
    m_stamm = cb.material("stamm", "#8B5A2B")
    m_krone = cb.material("krone", "#2E9E4F")
    m_krone2 = cb.material("krone_hell", "#4CC468")
    cb.kapsel("stamm", (0, 0, 0), (0, 0, 1.6), 0.22, m_stamm, "", r2=0.16)
    for (x, y, z, r, m) in ((0, 0, 2.1, 0.95, m_krone), (0.45, 0.2, 1.75, 0.6, m_krone2),
                            (-0.5, -0.1, 1.85, 0.65, m_krone2), (0.0, -0.4, 2.6, 0.6, m_krone2)):
        cb.ellipsoid("krone", Vector((x, y, z)), (r, r, r * 0.9), m, "", segs=24, ringe=14)
    return gruppe("Baum", cb.TEILE[:])


def fels():
    m = cb.material("fels", "#7D8597")
    m2 = cb.material("fels_hell", "#9AA3B5")
    cb.ellipsoid("fels", Vector((0, 0, 0.25)), (0.6, 0.5, 0.45), m, "", segs=10, ringe=7)
    cb.ellipsoid("fels2", Vector((0.45, 0.25, 0.15)), (0.32, 0.3, 0.25), m2, "", segs=8, ringe=6)
    return gruppe("Fels", cb.TEILE[:])


def zaun():
    k = KACHEL
    m = cb.material("zaun", "#F4E1C1")
    m2 = cb.material("zaun_dunkel", "#D8BE95")
    for x in (-k * 0.35, 0, k * 0.35):
        cb.rundbox("latte", Vector((x, 0, 0.45)), (0.2, 0.1, 0.9), m, "", rundung=0.4)
        cb.ellipsoid("spitze", Vector((x, 0, 0.92)), (0.1, 0.05, 0.1), m, "", segs=12, ringe=8)
    for z in (0.3, 0.65):
        cb.rundbox("quer", Vector((0, 0.07, z)), (k, 0.06, 0.12), m2, "", rundung=0.4)
    return gruppe("Zaun", cb.TEILE[:])


def spawn_platte():
    k = KACHEL
    m = cb.material("platte", "#FFFFFF")
    ob = cb.ellipsoid("platte", Vector((0, 0, 0.02)), (k * 0.45, k * 0.45, 0.05), m, "", segs=32, ringe=8)
    return gruppe("Spawn", cb.TEILE[:])


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    cb.MATERIALIEN.clear()
    cb.TEILE.clear()
    objekte = []
    for i, fn in enumerate((wand, kiste, busch, wasser, baum, fels, zaun, spawn_platte)):
        ob = fn()
        ob.location.x = i * 3.0  # nur zur Übersicht in Blender; Godot setzt sie neu
        objekte.append(ob)
    os.makedirs(os.path.dirname(ZIEL), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(ZIEL), export_format='GLB', export_apply=True,
                              export_animations=False, export_yup=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(ZIEL.replace(".glb", ".blend")), compress=True)
    print("Arena-Objekte exportiert:", os.path.abspath(ZIEL))


if __name__ == "__main__":
    main()
