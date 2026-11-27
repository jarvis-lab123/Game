"""
Krawall Crew – Schulmöbel (Blender 5.x)

Baut alle Möbel für den Schulkomplex im runden Comic-Stil und exportiert sie nach
spiel/schule/moebel.glb. Jedes Möbelstück ist ein eigener Knoten (Name = Typ).
Konvention: Ursprung = Bodenmitte, "vorne" = -Y (in Godot +Z).

Aufruf:  python3 schule_bauen.py
"""
import math
import os
import random
import sys

import bpy  # zuerst!
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import charakter_bauen as cb  # noqa: E402
from umgebung_bauen import gruppe  # noqa: E402

ZIEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "spiel", "schule", "moebel.glb")
V = Vector
M = cb.material


def rot_z(grad):
    return Matrix.Rotation(math.radians(grad), 3, 'Z').to_quaternion()


def tischbeine(breite, tiefe, hoehe, mat, dicke=0.035):
    for x in (-breite / 2 + 0.06, breite / 2 - 0.06):
        for y in (-tiefe / 2 + 0.06, tiefe / 2 - 0.06):
            cb.kapsel("bein", (x, y, 0.02), (x, y, hoehe - 0.02), dicke, mat, "")


def schulbank():
    holz = M("tisch_holz", "#E9B872")
    metall = M("metall_blau", "#3D5A80")
    cb.rundbox("platte", V((0, 0, 0.74)), (1.2, 0.6, 0.05), holz, "", rundung=0.4)
    tischbeine(1.2, 0.6, 0.72, metall)
    cb.rundbox("ablage", V((0, 0.05, 0.55)), (1.05, 0.45, 0.03), metall, "", rundung=0.4)
    # Kram auf dem Tisch
    cb.rundbox("heft", V((-0.25, -0.05, 0.775)), (0.3, 0.22, 0.015), M("heft_rot", "#FF6B6B"), "", rundung=0.3, rot=rot_z(8))
    cb.kapsel("stift", (0.15, -0.1, 0.78), (0.32, -0.02, 0.78), 0.008, M("stift_gelb", "#FFD23F"), "")
    return gruppe("Schulbank", cb.TEILE[:])


def stuhl():
    sitz = M("stuhl_sitz", "#FF9F1C")
    metall = M("metall_blau", "#3D5A80")
    cb.rundbox("sitz", V((0, 0, 0.45)), (0.42, 0.42, 0.04), sitz, "", rundung=0.4)
    cb.rundbox("lehne", V((0, 0.2, 0.75)), (0.4, 0.04, 0.3), sitz, "", rundung=0.4)
    for x in (-0.17, 0.17):
        for y in (-0.17, 0.17):
            cb.kapsel("bein", (x, y, 0.02), (x, y, 0.43), 0.018, metall, "")
        cb.kapsel("holm", (x, 0.19, 0.45), (x, 0.2, 0.62), 0.016, metall, "")
    return gruppe("Stuhl", cb.TEILE[:])


def lehrerpult():
    holz = M("pult_holz", "#A0522D")
    hell = M("tisch_holz", "#E9B872")
    cb.rundbox("platte", V((0, 0, 0.78)), (1.7, 0.8, 0.06), hell, "", rundung=0.3)
    cb.rundbox("korpus", V((0.55, 0, 0.38)), (0.55, 0.74, 0.74), holz, "", rundung=0.15)
    cb.rundbox("blende", V((0, -0.38, 0.5)), (1.6, 0.04, 0.5), holz, "", rundung=0.2)
    cb.kapsel("bein", (-0.78, -0.33, 0.02), (-0.78, -0.33, 0.75), 0.035, holz, "")
    cb.kapsel("bein", (-0.78, 0.33, 0.02), (-0.78, 0.33, 0.75), 0.035, holz, "")
    # Bücherstapel, Apfel, Globus, Kaffeetasse
    for i, f in enumerate(("#3A7BD5", "#2EC4B6", "#FF6B6B")):
        cb.rundbox("buch", V((-0.55, 0.12, 0.83 + i * 0.05)), (0.32, 0.24, 0.045), M(f"buch{i}", f), "", rundung=0.3, rot=rot_z(i * 9))
    cb.ellipsoid("apfel", V((-0.2, -0.15, 0.86)), (0.05, 0.05, 0.05), M("apfel", "#E63946"), "", segs=16, ringe=10)
    cb.kapsel("stiel", (-0.2, -0.15, 0.9), (-0.19, -0.15, 0.94), 0.006, M("stiel", "#6B4226"), "")
    cb.ellipsoid("globus", V((0.55, 0.15, 1.02)), (0.13, 0.13, 0.13), M("globus", "#4CC9F0"), "", segs=20, ringe=12)
    cb.torus("globus_ring", V((0.55, 0.15, 1.02)), 0.15, 0.01, M("metall_gold", "#F2C94C", glanz=True), "", normale=(1, 0, 0.3))
    cb.kapsel("globus_fuss", (0.55, 0.15, 0.81), (0.55, 0.15, 0.88), 0.03, M("metall_gold", "#F2C94C", glanz=True), "")
    cb.kapsel("tasse", (0.15, -0.1, 0.81), (0.15, -0.1, 0.9), 0.045, M("tasse", "#FFFFFF"), "")
    return gruppe("Lehrerpult", cb.TEILE[:])


def tafel():
    gruen = M("tafel", "#2F5D50")
    rahmen = M("tafel_rahmen", "#A0522D")
    kreide = M("kreide", "#F4F1EA")
    cb.rundbox("rahmen", V((0, 0, 1.45)), (3.4, 0.08, 1.3), rahmen, "", rundung=0.3)
    cb.rundbox("flaeche", V((0, -0.045, 1.45)), (3.2, 0.02, 1.15), gruen, "", rundung=0.1)
    cb.rundbox("ablage", V((0, -0.1, 0.83)), (3.0, 0.12, 0.04), rahmen, "", rundung=0.4)
    for x in (-1.2, -1.05, 0.9):
        cb.kapsel("kreidestueck", (x, -0.1, 0.86), (x + 0.07, -0.1, 0.86), 0.012, kreide, "")
    # Kreide-Gekritzel: Formel und Kreise
    cb.rohr("gekritzel", [(-1.3, -0.058, 1.75), (-1.0, -0.058, 1.85), (-0.7, -0.058, 1.72), (-0.4, -0.058, 1.83)], 0.012, kreide, "", glatt_teilen=0)
    cb.rohr("gekritzel2", [(-1.3, -0.058, 1.45), (-0.2, -0.058, 1.45)], 0.012, kreide, "", glatt_teilen=0)
    cb.torus("kreis", V((0.8, -0.058, 1.5)), 0.3, 0.012, kreide, "", normale=(0, -1, 0))
    cb.rohr("pfeil", [(0.2, -0.058, 1.2), (0.45, -0.058, 1.35)], 0.012, kreide, "", glatt_teilen=0)
    return gruppe("Tafel", cb.TEILE[:])


def buecherregal():
    holz = M("regal_holz", "#8B5A2B")
    farben = ["#E63946", "#3A7BD5", "#2EC4B6", "#FFD23F", "#8E7DBE", "#FF9F1C", "#5BE37A", "#F4F1EA"]
    cb.rundbox("korpus_l", V((-0.98, 0, 0.7)), (0.06, 0.45, 1.4), holz, "", rundung=0.3)
    cb.rundbox("korpus_r", V((0.98, 0, 0.7)), (0.06, 0.45, 1.4), holz, "", rundung=0.3)
    cb.rundbox("rueckwand", V((0, 0.2, 0.7)), (2.0, 0.04, 1.4), holz, "", rundung=0.2)
    random.seed(11)
    for i in range(4):
        z = 0.05 + i * 0.44
        cb.rundbox("brett", V((0, 0, z)), (2.0, 0.45, 0.05), holz, "", rundung=0.3)
        if i == 3:
            continue
        x = -0.92
        while x < 0.88:
            b = random.uniform(0.05, 0.1)
            h = random.uniform(0.24, 0.36)
            f = random.choice(farben)
            neig = random.random() < 0.1
            cb.rundbox("buch", V((x + b / 2, -0.02, z + 0.03 + h / 2)), (b, 0.3, h), M("buch_" + f[1:], f), "",
                       rundung=0.25, rot=Matrix.Rotation(math.radians(12), 3, 'Y').to_quaternion() if neig else None)
            x += b + 0.008
    return gruppe("Buecherregal", cb.TEILE[:])


def lesetisch():
    holz = M("tisch_holz", "#E9B872")
    cb.ellipsoid("platte", V((0, 0, 0.74)), (0.65, 0.65, 0.035), holz, "", segs=40, ringe=6)
    cb.kapsel("fuss", (0, 0, 0.05), (0, 0, 0.72), 0.06, M("metall_blau", "#3D5A80"), "")
    cb.ellipsoid("teller", V((0, 0, 0.03)), (0.3, 0.3, 0.03), M("metall_blau", "#3D5A80"), "", segs=24, ringe=6)
    cb.rundbox("offenes_buch", V((0.15, -0.1, 0.77)), (0.36, 0.26, 0.02), M("buch_seiten", "#F4F1EA"), "", rundung=0.3, rot=rot_z(-15))
    cb.ellipsoid("lampe_fuss", V((-0.3, 0.2, 0.78)), (0.07, 0.07, 0.02), M("lampe", "#2EC4B6"), "", segs=16, ringe=6)
    cb.kapsel("lampe_arm", (-0.3, 0.2, 0.78), (-0.2, 0.15, 1.05), 0.012, M("lampe", "#2EC4B6"), "")
    cb.ellipsoid("lampe_schirm", V((-0.17, 0.12, 1.03)), (0.09, 0.09, 0.06), M("lampe", "#2EC4B6"), "", segs=16, ringe=8)
    return gruppe("Lesetisch", cb.TEILE[:])


def mensatisch():
    platte = M("mensa_tisch", "#F4F1EA")
    metall = M("metall_grau", "#8C93A8")
    cb.rundbox("platte", V((0, 0, 0.74)), (3.0, 0.9, 0.05), platte, "", rundung=0.4)
    tischbeine(3.0, 0.9, 0.72, metall)
    # Tabletts mit Essen
    for i, x in enumerate((-1.0, 0.0, 1.0)):
        y = -0.2 if i % 2 == 0 else 0.2
        cb.rundbox("tablett", V((x, y, 0.775)), (0.42, 0.3, 0.02), M("tablett", "#FF9F1C"), "", rundung=0.4)
        cb.ellipsoid("teller", V((x - 0.06, y, 0.79)), (0.11, 0.11, 0.015), M("tasse", "#FFFFFF"), "", segs=20, ringe=6)
        cb.ellipsoid("essen", V((x - 0.06, y, 0.81)), (0.07, 0.07, 0.03), M("essen", "#E9B872"), "", segs=12, ringe=6)
        cb.ellipsoid("erbsen", V((x - 0.02, y + 0.04, 0.81)), (0.04, 0.03, 0.02), M("erbsen", "#5BE37A"), "", segs=10, ringe=6)
        cb.kapsel("becher", (x + 0.12, y, 0.79), (x + 0.12, y, 0.88), 0.035, M("becher", "#4CC9F0"), "")
    return gruppe("Mensatisch", cb.TEILE[:])


def bank():
    holz = M("bank_holz", "#C98B4B")
    metall = M("metall_grau", "#8C93A8")
    cb.rundbox("sitz", V((0, 0, 0.45)), (3.0, 0.35, 0.05), holz, "", rundung=0.4)
    for x in (-1.3, 0, 1.3):
        cb.rundbox("fuss", V((x, 0, 0.22)), (0.06, 0.3, 0.44), metall, "", rundung=0.4)
    return gruppe("Bank", cb.TEILE[:])


def theke():
    korpus = M("theke", "#3D5A80")
    platte = M("metall_hell", "#D9DEE8", glanz=True)
    glas = M("glas", "#BFE3FF")
    cb.rundbox("korpus", V((0, 0, 0.48)), (4.0, 0.9, 0.96), korpus, "", rundung=0.1)
    cb.rundbox("platte", V((0, 0, 0.98)), (4.1, 1.0, 0.05), platte, "", rundung=0.3)
    cb.rundbox("spuckschutz", V((0, -0.1, 1.3)), (3.8, 0.03, 0.45), glas, "", rundung=0.3)
    speisen = ["#E9B872", "#5BE37A", "#E63946", "#FFD23F", "#F4F1EA"]
    for i, f in enumerate(speisen):
        x = -1.6 + i * 0.8
        cb.rundbox("wanne", V((x, 0.15, 1.02)), (0.65, 0.45, 0.06), platte, "", rundung=0.3)
        cb.ellipsoid("speise", V((x, 0.15, 1.05)), (0.27, 0.18, 0.05), M("speise_" + f[1:], f), "", segs=16, ringe=8)
    cb.rundbox("schild", V((0, -0.46, 0.75)), (1.4, 0.03, 0.25), M("schild_gelb", "#FFD23F"), "", rundung=0.4)
    return gruppe("Theke", cb.TEILE[:])


def getraenkeautomat():
    korpus = M("automat", "#E63946")
    glas = M("automat_glas", "#BFE3FF")
    cb.rundbox("korpus", V((0, 0, 0.8)), (0.9, 0.7, 1.6), korpus, "", rundung=0.12)
    cb.rundbox("fenster", V((-0.12, -0.36, 0.95)), (0.55, 0.03, 1.0), glas, "", rundung=0.2)
    for r in range(4):
        for c in range(3):
            f = ["#FFD23F", "#2EC4B6", "#8E7DBE"][c]
            cb.kapsel("dose", (-0.3 + c * 0.18, -0.33, 0.55 + r * 0.24), (-0.3 + c * 0.18, -0.33, 0.68 + r * 0.24), 0.04, M("dose_" + f[1:], f), "")
    cb.rundbox("bedienfeld", V((0.3, -0.36, 1.0)), (0.18, 0.03, 0.5), M("pc_dunkel", "#2A2140"), "", rundung=0.3)
    cb.rundbox("ausgabe", V((0, -0.36, 0.25)), (0.6, 0.04, 0.18), M("pc_dunkel", "#2A2140"), "", rundung=0.3)
    return gruppe("Getraenkeautomat", cb.TEILE[:])


def sofa():
    stoff = M("sofa", "#8E7DBE")
    stoff2 = M("sofa_kissen", "#B8AEE0")
    cb.rundbox("basis", V((0, 0, 0.25)), (2.0, 0.9, 0.4), stoff, "", rundung=0.35)
    cb.rundbox("lehne", V((0, 0.33, 0.62)), (2.0, 0.25, 0.6), stoff, "", rundung=0.45)
    for sx in (-1, 1):
        cb.rundbox("armlehne", V((sx * 0.92, 0, 0.5)), (0.2, 0.9, 0.38), stoff, "", rundung=0.45)
    for x in (-0.45, 0.45):
        cb.rundbox("kissen", V((x, -0.05, 0.5)), (0.8, 0.7, 0.14), stoff2, "", rundung=0.5)
    cb.rundbox("deko", V((0.6, 0.18, 0.72)), (0.3, 0.12, 0.3), M("kissen_gelb", "#FFD23F"), "", rundung=0.5, rot=rot_z(15))
    return gruppe("Sofa", cb.TEILE[:])


def kuechenzeile():
    korpus = M("kueche", "#F4F1EA")
    platte = M("kueche_platte", "#5E6578")
    cb.rundbox("korpus", V((0, 0, 0.44)), (2.4, 0.6, 0.88), korpus, "", rundung=0.1)
    cb.rundbox("platte", V((0, 0, 0.9)), (2.45, 0.65, 0.05), platte, "", rundung=0.3)
    for x in (-0.9, -0.3, 0.3, 0.9):
        cb.kapsel("griff", (x - 0.1, -0.31, 0.75), (x + 0.1, -0.31, 0.75), 0.012, platte, "")
    # Kaffeemaschine + Tassen
    cb.rundbox("kaffeemaschine", V((-0.7, 0.05, 1.15)), (0.35, 0.35, 0.45), M("kaffeemaschine", "#2A2140"), "", rundung=0.3)
    cb.kapsel("kanne", (-0.7, -0.08, 0.94), (-0.7, -0.08, 1.06), 0.07, M("glas", "#BFE3FF"), "")
    cb.ellipsoid("kaffee", V((-0.7, -0.08, 0.97)), (0.065, 0.065, 0.03), M("kaffee", "#5A3A22"), "", segs=12, ringe=6)
    for i, f in enumerate(("#E63946", "#FFFFFF", "#2EC4B6")):
        cb.kapsel("tasse", (0.1 + i * 0.16, 0.0, 0.94), (0.1 + i * 0.16, 0.0, 1.02), 0.04, M("tasse_" + f[1:], f), "")
    cb.rundbox("mikrowelle", V((0.85, 0.08, 1.07)), (0.5, 0.35, 0.3), M("metall_grau", "#8C93A8"), "", rundung=0.2)
    return gruppe("Kuechenzeile", cb.TEILE[:])


def kopierer():
    korpus = M("kopierer", "#D9DEE8")
    dunkel = M("pc_dunkel", "#2A2140")
    cb.rundbox("korpus", V((0, 0, 0.5)), (1.0, 0.7, 1.0), korpus, "", rundung=0.12)
    cb.rundbox("deckel", V((0, 0.05, 1.03)), (0.9, 0.55, 0.06), dunkel, "", rundung=0.3)
    cb.rundbox("display", V((0.3, -0.3, 1.02)), (0.25, 0.12, 0.04), M("display", "#7CFFCB", leuchten=True), "", rundung=0.3)
    for z in (0.3, 0.55):
        cb.rundbox("fach", V((0, -0.36, z)), (0.8, 0.04, 0.18), dunkel, "", rundung=0.3)
    cb.rundbox("papier", V((-0.15, -0.1, 1.1)), (0.3, 0.42, 0.05), M("papier", "#FFFFFF"), "", rundung=0.2, rot=rot_z(10))
    return gruppe("Kopierer", cb.TEILE[:])


def spinde():
    farben = ["#3A7BD5", "#2EC4B6", "#3A7BD5", "#2EC4B6"]
    griff = M("metall_hell", "#D9DEE8", glanz=True)
    for i, f in enumerate(farben):
        x = -0.6 + i * 0.4
        mat = M("spind_" + f[1:], f)
        cb.rundbox("spind", V((x, 0, 0.75)), (0.38, 0.5, 1.5), mat, "", rundung=0.1)
        for k in range(3):
            cb.rundbox("schlitz", V((x, -0.255, 1.3 - k * 0.06)), (0.22, 0.01, 0.025), M("pc_dunkel", "#2A2140"), "", rundung=0.4)
        cb.kapsel("griff", (x + 0.13, -0.27, 0.75), (x + 0.13, -0.27, 0.9), 0.015, griff, "")
    cb.rundbox("aufkleber", V((-0.2, -0.255, 1.0)), (0.12, 0.01, 0.12), M("pc_sticker", "#FF5E8A"), "", rundung=0.5)
    return gruppe("Spinde", cb.TEILE[:])


def pflanze():
    topf = M("topf", "#C1633B")
    blatt = M("pflanze", "#3FA34D")
    blatt2 = M("pflanze_hell", "#5CC45E")
    cb.kapsel("topf", (0, 0, 0.05), (0, 0, 0.4), 0.2, topf, "", r2=0.24)
    cb.ellipsoid("erde", V((0, 0, 0.5)), (0.22, 0.22, 0.04), M("erde", "#5A3A22"), "", segs=16, ringe=6)
    random.seed(4)
    for i in range(7):
        a = i * 0.9
        r = random.uniform(0.1, 0.25)
        cb.ellipsoid("blatt", V((math.cos(a) * r, math.sin(a) * r, 0.75 + random.uniform(0, 0.4))),
                     (0.16, 0.08, 0.28), blatt if i % 2 else blatt2, "",
                     rot=Matrix.Rotation(a, 4, 'Z') @ Matrix.Rotation(0.5, 4, 'X'), segs=14, ringe=10)
    return gruppe("Pflanze", cb.TEILE[:])


def muelleimer():
    cb.kapsel("eimer", (0, 0, 0.05), (0, 0, 0.6), 0.2, M("muell", "#2EC4B6"), "", r2=0.23)
    cb.torus("rand", V((0, 0, 0.75)), 0.2, 0.025, M("metall_grau", "#8C93A8"), "", normale=(0, 0, 1))
    cb.ellipsoid("papierknaeuel", V((0.05, 0, 0.82)), (0.07, 0.07, 0.06), M("papier", "#FFFFFF"), "", segs=8, ringe=6)
    return gruppe("Muelleimer", cb.TEILE[:])


def sitzsack():
    cb.ellipsoid("sack", V((0, 0, 0.3)), (0.5, 0.5, 0.32), M("sitzsack", "#FF5E8A"), "",
                 verformen=lambda v: V((v.x, v.y, v.z * (0.7 if v.z > 0.3 else 1.0) - 0.15 * max(0.0, v.y) * max(0.0, v.z))))
    return gruppe("Sitzsack", cb.TEILE[:])


def konferenztisch():
    platte = M("pult_holz", "#A0522D")
    cb.rundbox("platte", V((0, 0, 0.76)), (3.2, 1.4, 0.06), platte, "", rundung=0.5)
    tischbeine(3.0, 1.2, 0.74, M("metall_grau", "#8C93A8"))
    for i, x in enumerate((-1.0, 0.2, 1.1)):
        cb.rundbox("papier", V((x, -0.3 + 0.3 * (i % 2), 0.8)), (0.3, 0.4, 0.01), M("papier", "#FFFFFF"), "", rundung=0.2, rot=rot_z(i * 12))
    cb.kapsel("tasse", (0.6, 0.3, 0.8), (0.6, 0.3, 0.88), 0.045, M("tasse_e63946", "#E63946"), "")
    cb.ellipsoid("kekse", V((-0.3, 0.2, 0.8)), (0.16, 0.16, 0.02), M("tasse", "#FFFFFF"), "", segs=16, ringe=6)
    for k in range(5):
        cb.ellipsoid("keks", V((-0.3 + math.cos(k) * 0.08, 0.2 + math.sin(k) * 0.08, 0.83)), (0.035, 0.035, 0.012), M("keks", "#C98B4B"), "", segs=10, ringe=4)
    return gruppe("Konferenztisch", cb.TEILE[:])


def pinnwand():
    cb.rundbox("kork", V((0, 0, 1.4)), (1.4, 0.05, 0.9), M("kork", "#C98B4B"), "", rundung=0.3)
    zettel = ["#FFD23F", "#FF5E8A", "#4CC9F0", "#5BE37A", "#FFFFFF"]
    random.seed(2)
    for i, f in enumerate(zettel):
        cb.rundbox("zettel", V((-0.5 + i * 0.25, -0.035, 1.4 + random.uniform(-0.25, 0.25))), (0.2, 0.01, 0.24),
                   M("zettel_" + f[1:], f), "", rundung=0.2,
                   rot=Matrix.Rotation(math.radians(random.uniform(-10, 10)), 3, 'Y').to_quaternion())
    return gruppe("Pinnwand", cb.TEILE[:])


# ---------------------------------------------------------------- Turnhalle
def basketballkorb():
    """Korb an der Wand: Ständer, Brett, Ring mit Netz. Vorne = -Y."""
    metall = M("metall_blau", "#3D5A80")
    cb.rundbox("fuss", V((0, 0.25, 0.06)), (0.9, 0.7, 0.12), metall, "", rundung=0.4)
    cb.kapsel("mast", (0, 0.3, 0.1), (0, 0.3, 2.6), 0.07, metall, "")
    cb.kapsel("arm", (0, 0.3, 2.5), (0, -0.05, 2.75), 0.05, metall, "")
    cb.rundbox("brett", V((0, -0.1, 2.85)), (1.4, 0.05, 0.9), M("brett_weiss", "#F4F1EA"), "", rundung=0.25)
    cb.rundbox("feld", V((0, -0.13, 2.72)), (0.55, 0.01, 0.4), M("brett_rot", "#E63946"), "", rundung=0.2)
    orange = M("korb_orange", "#FF7A1A")
    cb.torus("ring", V((0, -0.42, 2.5)), 0.24, 0.018, orange, "", normale=(0, 0, 1))
    netz = M("netz", "#F4F1EA")
    for i in range(10):
        a = i / 10 * math.tau
        cb.kapsel("netz", (math.cos(a) * 0.23, -0.42 + math.sin(a) * 0.23, 2.49),
                  (math.cos(a) * 0.14, -0.42 + math.sin(a) * 0.14, 2.15), 0.008, netz, "")
    return gruppe("Basketballkorb", cb.TEILE[:])


def turnmatte():
    blau = M("matte_blau", "#3A7BD5")
    cb.rundbox("matte", V((0, 0, 0.1)), (2.0, 1.0, 0.2), blau, "", rundung=0.5)
    for x in (-0.85, 0.85):
        cb.rundbox("griff", V((x, -0.5, 0.12)), (0.18, 0.03, 0.05), M("matte_griff", "#2A2140"), "", rundung=0.5)
    return gruppe("Turnmatte", cb.TEILE[:])


def kasten():
    holz = M("kasten_holz", "#E9B872")
    kante = M("kasten_kante", "#C98B4B")
    for i in range(4):
        w = 1.3 - i * 0.07
        cb.rundbox("teil", V((0, 0, 0.13 + i * 0.25)), (w, 0.6 - i * 0.03, 0.24), holz if i % 2 == 0 else kante, "", rundung=0.25)
    cb.rundbox("leder", V((0, 0, 1.06)), (1.12, 0.52, 0.1), M("leder", "#F4F1EA"), "", rundung=0.6)
    for x in (-0.35, 0.35):
        cb.rundbox("griffloch", V((x, -0.29, 0.6)), (0.22, 0.02, 0.07), M("pc_dunkel", "#2A2140"), "", rundung=0.6)
    return gruppe("Kasten", cb.TEILE[:])


def ballwagen():
    metall = M("metall_grau", "#8C93A8")
    cb.rundbox("korb", V((0, 0, 0.55)), (0.9, 0.6, 0.06), metall, "", rundung=0.3)
    for x in (-0.42, 0.42):
        for y in (-0.27, 0.27):
            cb.kapsel("stange", (x, y, 0.12), (x, y, 0.95), 0.02, metall, "")
            cb.ellipsoid("rad", V((x, y, 0.07)), (0.06, 0.06, 0.06), M("pc_dunkel", "#2A2140"), "", segs=12, ringe=8)
    random.seed(8)
    farben = ["#FF7A1A", "#FF7A1A", "#F4F1EA", "#E63946", "#3A7BD5", "#FFD23F"]
    for i in range(9):
        x = -0.28 + (i % 3) * 0.28
        y = -0.15 + (i // 3 % 2) * 0.3
        z = 0.74 + (i // 6) * 0.2 + random.uniform(-0.02, 0.03)
        f = farben[i % len(farben)]
        cb.ellipsoid("ball", V((x, y, z)), (0.12, 0.12, 0.12), M("ball_" + f[1:], f), "", segs=16, ringe=10)
    return gruppe("Ballwagen", cb.TEILE[:])


def sprossenwand():
    holz = M("tisch_holz", "#E9B872")
    for x in (-0.55, 0.55):
        cb.rundbox("holm", V((x, 0, 1.3)), (0.08, 0.1, 2.6), holz, "", rundung=0.4)
    for i in range(12):
        cb.kapsel("sprosse", (-0.52, 0, 0.2 + i * 0.2), (0.52, 0, 0.2 + i * 0.2), 0.022, holz, "")
    return gruppe("Sprossenwand", cb.TEILE[:])


# ---------------------------------------------------------------- Musikraum
def klavier():
    schwarz = M("klavier", "#1E1A2B", glanz=True)
    cb.rundbox("korpus", V((0, 0.12, 0.7)), (1.5, 0.45, 1.3), schwarz, "", rundung=0.12)
    cb.rundbox("tastenbrett", V((0, -0.2, 0.74)), (1.42, 0.3, 0.06), schwarz, "", rundung=0.2)
    cb.rundbox("tasten", V((0, -0.22, 0.785)), (1.3, 0.22, 0.03), M("tasten", "#F4F1EA"), "", rundung=0.2)
    for i in range(18):
        if i % 7 in (2, 6):
            continue
        cb.rundbox("schwarze", V((-0.6 + i * 0.07, -0.17, 0.81)), (0.035, 0.12, 0.03), schwarz, "", rundung=0.3)
    for x in (-0.65, 0.65):
        cb.kapsel("bein", (x, -0.25, 0.02), (x, -0.25, 0.7), 0.04, schwarz, "")
    cb.rundbox("noten", V((0, -0.08, 1.05)), (0.5, 0.03, 0.32), M("papier", "#FFFFFF"), "", rundung=0.2,
               rot=Matrix.Rotation(math.radians(-12), 3, 'X').to_quaternion())
    cb.rundbox("hocker", V((0, -0.75, 0.45)), (0.6, 0.35, 0.08), M("hocker", "#8B2F3A"), "", rundung=0.4)
    for x in (-0.24, 0.24):
        cb.kapsel("hockerbein", (x, -0.75, 0.02), (x, -0.75, 0.42), 0.03, schwarz, "")
    return gruppe("Klavier", cb.TEILE[:])


def schlagzeug():
    rot = M("trommel_rot", "#C8263D", glanz=True)
    weiss = M("trommel_fell", "#F4F1EA")
    gold = M("metall_gold", "#F2C94C", glanz=True)
    metall = M("metall_hell", "#D9DEE8", glanz=True)
    # große Trommel (liegt)
    cb.kapsel("bass", (0, -0.15, 0.32), (0, 0.15, 0.32), 0.3, rot, "", abflachen=1.0)
    cb.ellipsoid("bassfell", V((0, -0.16, 0.32)), (0.27, 0.02, 0.27), weiss, "", segs=20, ringe=8)
    for x, z, r in ((-0.45, 0.62, 0.18), (0.45, 0.6, 0.2), (-0.2, 0.75, 0.13), (0.2, 0.75, 0.13)):
        cb.kapsel("trommel", (x, 0, z - 0.1), (x, 0, z + 0.05), r, rot, "")
        cb.ellipsoid("fell", V((x, 0, z + 0.06)), (r * 0.95, r * 0.95, 0.015), weiss, "", segs=16, ringe=6)
        cb.kapsel("staender", (x, 0, 0.02), (x, 0, z - 0.1), 0.015, metall, "")
    for x in (-0.75, 0.75):
        cb.kapsel("beckenstaender", (x, 0.2, 0.02), (x, 0.2, 1.05), 0.015, metall, "")
        cb.ellipsoid("becken", V((x, 0.2, 1.07)), (0.24, 0.24, 0.015), gold, "", segs=20, ringe=6)
    cb.kapsel("hocker", (0, 0.65, 0.02), (0, 0.65, 0.45), 0.03, metall, "")
    cb.ellipsoid("sitz", V((0, 0.65, 0.48)), (0.18, 0.18, 0.05), M("pc_dunkel", "#2A2140"), "", segs=16, ringe=6)
    return gruppe("Schlagzeug", cb.TEILE[:])


def notenstaender():
    metall = M("metall_grau", "#8C93A8")
    for a in (0, 2.1, 4.2):
        cb.kapsel("fuss", (0, 0, 0.3), (math.cos(a) * 0.25, math.sin(a) * 0.25, 0.01), 0.012, metall, "")
    cb.kapsel("stange", (0, 0, 0.28), (0, 0, 1.1), 0.014, metall, "")
    cb.rundbox("pult", V((0, -0.03, 1.2)), (0.5, 0.02, 0.32), metall, "", rundung=0.2,
               rot=Matrix.Rotation(math.radians(-25), 3, 'X').to_quaternion())
    cb.rundbox("noten", V((0, -0.05, 1.21)), (0.42, 0.01, 0.28), M("papier", "#FFFFFF"), "", rundung=0.2,
               rot=Matrix.Rotation(math.radians(-25), 3, 'X').to_quaternion())
    return gruppe("Notenstaender", cb.TEILE[:])


def gitarre():
    """Gitarre auf Ständer."""
    holz = M("gitarre", "#E08A3C", glanz=True)
    cb.ellipsoid("bauch_u", V((0, 0, 0.42)), (0.22, 0.08, 0.2), holz, "", segs=20, ringe=12)
    cb.ellipsoid("bauch_o", V((0, 0, 0.66)), (0.16, 0.07, 0.14), holz, "", segs=20, ringe=12)
    cb.ellipsoid("loch", V((0, -0.075, 0.56)), (0.06, 0.01, 0.06), M("pc_dunkel", "#2A2140"), "", segs=12, ringe=6)
    cb.rundbox("hals", V((0, -0.02, 0.98)), (0.06, 0.04, 0.5), M("pult_holz", "#A0522D"), "", rundung=0.3)
    cb.rundbox("kopf", V((0, -0.02, 1.27)), (0.09, 0.04, 0.14), M("pult_holz", "#A0522D"), "", rundung=0.3)
    metall = M("metall_grau", "#8C93A8")
    cb.kapsel("staender", (-0.15, 0.1, 0.02), (0, 0.06, 0.3), 0.012, metall, "")
    cb.kapsel("staender", (0.15, 0.1, 0.02), (0, 0.06, 0.3), 0.012, metall, "")
    return gruppe("Gitarre", cb.TEILE[:])


# ---------------------------------------------------------------- Pausenhof & Eingangshalle
def tischtennisplatte():
    gruen = M("tt_platte", "#2E7D5B")
    weiss = M("tt_linie", "#F4F1EA")
    stein = M("beton", "#A7AEBF")
    cb.rundbox("platte", V((0, 0, 0.74)), (2.74, 1.52, 0.06), gruen, "", rundung=0.2)
    cb.rundbox("linie_l", V((0, 0, 0.775)), (2.7, 0.03, 0.005), weiss, "", rundung=0.1)
    cb.rundbox("rand1", V((0, 0.74, 0.775)), (2.74, 0.03, 0.005), weiss, "", rundung=0.1)
    cb.rundbox("rand2", V((0, -0.74, 0.775)), (2.74, 0.03, 0.005), weiss, "", rundung=0.1)
    cb.rundbox("netz", V((0, 0, 0.86)), (0.03, 1.6, 0.16), M("netz_dunkel", "#2A2140"), "", rundung=0.2)
    for x in (-0.9, 0.9):
        cb.rundbox("fuss", V((x, 0, 0.36)), (0.25, 1.1, 0.72), stein, "", rundung=0.2)
    return gruppe("Tischtennisplatte", cb.TEILE[:])


def pokalvitrine():
    holz = M("pult_holz", "#A0522D")
    glas = M("glas", "#BFE3FF")
    gold = M("metall_gold", "#F2C94C", glanz=True)
    cb.rundbox("sockel", V((0, 0, 0.3)), (1.6, 0.5, 0.6), holz, "", rundung=0.2)
    cb.rundbox("dach", V((0, 0, 2.0)), (1.6, 0.5, 0.1), holz, "", rundung=0.3)
    for x in (-0.78, 0.78):
        cb.rundbox("seite", V((x, 0, 1.3)), (0.05, 0.5, 1.4), holz, "", rundung=0.3)
    cb.rundbox("glasboden", V((0, 0, 1.3)), (1.5, 0.45, 0.03), glas, "", rundung=0.3)
    for i, (x, z, s) in enumerate(((-0.45, 0.6, 1.0), (0.05, 0.6, 1.3), (0.5, 0.6, 0.9), (-0.3, 1.32, 0.8), (0.35, 1.32, 1.1))):
        cb.kapsel("pokalfuss", (x, 0, z), (x, 0, z + 0.08 * s), 0.07 * s, M("pokal_sockel", "#2A2140"), "")
        cb.kapsel("pokalstiel", (x, 0, z + 0.08 * s), (x, 0, z + 0.2 * s), 0.025 * s, gold, "")
        cb.kapsel("pokalschale", (x, 0, z + 0.2 * s), (x, 0, z + 0.38 * s), 0.05 * s, gold, "", r2=0.1 * s)
    cb.rundbox("scheibe", V((0, -0.24, 1.3)), (1.52, 0.02, 1.4), glas, "", rundung=0.1)
    return gruppe("Pokalvitrine", cb.TEILE[:])


def gruppentisch():
    """Zwei zusammengeschobene Bänke für Gruppenarbeit (quadratisch)."""
    holz = M("tisch_holz", "#E9B872")
    metall = M("metall_blau", "#3D5A80")
    cb.rundbox("platte", V((0, 0, 0.74)), (1.3, 1.3, 0.05), holz, "", rundung=0.4)
    tischbeine(1.3, 1.3, 0.72, metall)
    cb.rundbox("plakat", V((0.1, 0.05, 0.775)), (0.6, 0.45, 0.01), M("plakat", "#FFFFFF"), "", rundung=0.2, rot=rot_z(-10))
    for i, f in enumerate(("#E63946", "#3A7BD5", "#5BE37A")):
        cb.kapsel("filzer", (-0.4 + i * 0.07, -0.35, 0.78), (-0.3 + i * 0.07, -0.42, 0.78), 0.012, M("filzer_" + f[1:], f), "")
    return gruppe("Gruppentisch", cb.TEILE[:])


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    cb.MATERIALIEN.clear()
    cb.TEILE.clear()
    bauer = (schulbank, stuhl, lehrerpult, tafel, buecherregal, lesetisch, mensatisch, bank, theke,
             getraenkeautomat, sofa, kuechenzeile, kopierer, spinde, pflanze, muelleimer, sitzsack,
             konferenztisch, pinnwand, basketballkorb, turnmatte, kasten, ballwagen, sprossenwand,
             klavier, schlagzeug, notenstaender, gitarre, tischtennisplatte, pokalvitrine, gruppentisch)
    for i, fn in enumerate(bauer):
        ob = fn()
        ob.location = ((i % 5) * 4.5, (i // 5) * 3.5, 0)
    os.makedirs(os.path.dirname(ZIEL), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(ZIEL), export_format='GLB', export_apply=True,
                              export_animations=False, export_yup=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(ZIEL.replace(".glb", ".blend")), compress=True)
    print("Schulmöbel exportiert:", os.path.abspath(ZIEL))


if __name__ == "__main__":
    main()
