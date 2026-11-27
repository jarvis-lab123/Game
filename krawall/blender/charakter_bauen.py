"""
Krawall Crew – Charakter-Generator für Blender (5.x)

Baut aus einer charakter.json eine runde, cleane Comic-Figur:
  * Mesh aus weichen Grundformen (keine harten Kanten, Toon-tauglich)
  * Skelett mit 18 Knochen und starrer Gewichtung (sauber für Low-Poly-Toon)
  * Animationen: Idle, Run, Attack, Super, Victory, Hit
  * Export als model.glb (direkt von Godot lesbar) + preview.png

Aufruf (Blender als Python-Modul):
    python3 charakter_bauen.py ../charaktere/<id>/charakter.json [--keine-vorschau]
oder mit installiertem Blender:
    blender -b -P charakter_bauen.py -- ../charaktere/<id>/charakter.json

Alle Maße in Metern, Blender: Z oben, Figur schaut nach -Y.
"""
import json
import math
import random
import os
import sys

import bpy  # muss vor bmesh/mathutils importiert werden
import bmesh
from mathutils import Matrix, Vector

# ---------------------------------------------------------------- Standardwerte
STANDARD_AUSSEHEN = {
    "proportionen": "comic",         # comic (erwachsen, ca. 6 Köpfe groß) | chibi (großer Kopf, kindlich)
    "hautfarbe": "#F2C29B",
    "koerperbau": "normal",          # schmal | normal | kraeftig
    "groesse": 1.0,                   # 0.85 – 1.15
    "kopfform": "rund",              # rund | oval | eckig | breit
    "kopfgroesse": 1.0,
    "augen": {"farbe": "#5B3A1E", "groesse": 1.0, "abstand": 1.0, "form": "rund"},  # rund | mandel | muede
    "augenbrauen": {"dicke": 1.0, "winkel": 0.0, "farbe": None},  # winkel in Grad: + = ernst/böse, - = freundlich
    "nase": "klein",                 # klein | knubbel | spitz | breit
    "mund": "laecheln",              # laecheln | grinsen | neutral | frech
    "ohren": 1.0,
    "sommersprossen": False,
    "wangenroete": True,
    "haare": {"stil": "kurz", "farbe": "#3B2414", "pony": True, "scheitel": "keiner"},
    # stil: glatze | buzz | kurz | stachel | locken | afro | lang | zopf | dutt | seitenscheitel | iro
    "bart": {"stil": "keiner", "farbe": None},  # keiner | stoppeln | kinnbart | vollbart | schnauzer
    "brille": {"stil": "keine", "farbe": "#222222"},  # keine | rund | eckig | sonnenbrille
    "kopfbedeckung": {"stil": "keine", "farbe": "#D63A3A"},  # keine | cap | cap_hinten | muetze | stirnband
    "kopfhoerer": {"an": False, "farbe": "#222222"},
    "oberteil": {"stil": "tshirt", "farbe": "#3A7BD5", "farbe2": "#FFFFFF", "nummer": None},
    # stil: tshirt | hoodie | jacke | pulli | tanktop
    "hose": {"stil": "lang", "farbe": "#2E3A59"},  # lang | kurz
    "schuhe": {"farbe": "#F5F5F5", "sohle": "#E04848"},
    "handschuhe": {"an": False, "farbe": "#333333"},
    "kette": {"an": False, "farbe": "#F2C94C"},
    "waffe": {"stil": "blaster", "farbe": "#FFB703", "farbe2": "#333333"},
    # stil: keine | blaster | ball | hammer | stab | buch
}


def zusammenfuehren(basis, neu):
    out = dict(basis)
    for k, v in (neu or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = zusammenfuehren(out[k], v)
        else:
            out[k] = v
    return out


# ---------------------------------------------------------------- Farben/Material
def srgb_zu_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexfarbe(h, a=1.0):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4))
    return (srgb_zu_linear(r), srgb_zu_linear(g), srgb_zu_linear(b), a)


def abdunkeln(h, f):
    h = h.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return "#%02X%02X%02X" % (int(r * f), int(g * f), int(b * f))


MATERIALIEN = {}


def material(name, farbe, rau=0.65, glanz=False, leuchten=False):
    """Ein Material pro Farbe/Rolle. Godot ersetzt es durch den Toon-Shader und liest die Farbe."""
    key = name
    if key in MATERIALIEN:
        return MATERIALIEN[key]
    m = bpy.data.materials.new(name)
    if not m.node_tree:
        m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = hexfarbe(farbe)
    bsdf.inputs["Roughness"].default_value = 0.25 if glanz else rau
    if leuchten:
        bsdf.inputs["Emission Color"].default_value = hexfarbe(farbe)
        bsdf.inputs["Emission Strength"].default_value = 1.0
    m.diffuse_color = hexfarbe(farbe)
    MATERIALIEN[key] = m
    return m


# ---------------------------------------------------------------- Mesh-Bausteine
TEILE = []  # (obj, knochen)


def _bm_zu_objekt(bm, name, mat, knochen, glatt=True, mods=()):
    # geschlossene Formen: Normalen konsistent nach außen (sonst fehlen Flächen im Spiel)
    if all(e.is_manifold for e in bm.edges):
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for typ, params in mods:
        md = ob.modifiers.new(typ.lower(), typ)
        for k, v in params.items():
            setattr(md, k, v)
    if ob.modifiers:
        dg = bpy.context.evaluated_depsgraph_get()
        neu = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
        ob.modifiers.clear()
        alt = ob.data
        ob.data = neu
        bpy.data.meshes.remove(alt)
    if glatt:
        ob.data.shade_smooth()
    else:
        ob.data.shade_smooth()
        ob.data.set_sharp_from_angle(angle=math.radians(40))
    ob.data.materials.append(mat)
    TEILE.append((ob, knochen))
    return ob


def _ausrichtung(richtung):
    """Rotationsmatrix, die lokale +Z auf 'richtung' dreht."""
    r = Vector(richtung).normalized()
    return Vector((0, 0, 1)).rotation_difference(r).to_matrix().to_4x4()


def ellipsoid(name, mitte, radien, mat, knochen, rot=None, segs=32, ringe=20, verformen=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=ringe, radius=1.0)
    if verformen:
        for v in bm.verts:
            v.co = verformen(v.co.copy())
    M = Matrix.Translation(mitte)
    if rot is not None:
        M = M @ (rot if isinstance(rot, Matrix) else rot.to_matrix().to_4x4())
    M = M @ Matrix.Diagonal((*radien, 1.0))
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return _bm_zu_objekt(bm, name, mat, knochen)


def kapsel(name, p1, p2, r1, mat, knochen, r2=None, segs=24, ringe=16, abflachen=1.0):
    """Weiche Kapsel von p1 nach p2 (Radius r1 unten, r2 oben)."""
    r2 = r1 if r2 is None else r2
    p1, p2 = Vector(p1), Vector(p2)
    L = (p2 - p1).length
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=ringe, radius=1.0)
    for v in bm.verts:
        if v.co.z >= 0:
            v.co = Vector((v.co.x * r2, v.co.y * r2 * abflachen, v.co.z * r2 + L))
        else:
            v.co = Vector((v.co.x * r1, v.co.y * r1 * abflachen, v.co.z * r1))
    M = Matrix.Translation(p1) @ _ausrichtung(p2 - p1)
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return _bm_zu_objekt(bm, name, mat, knochen)


def torus(name, mitte, R, r, mat, knochen, normale=(0, -1, 0), segs=32, rsegs=10, skal=(1, 1)):
    bm = bmesh.new()
    ringe = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        ring = []
        for j in range(rsegs):
            b = 2 * math.pi * j / rsegs
            x = (R + r * math.cos(b)) * math.cos(a) * skal[0]
            y = (R + r * math.cos(b)) * math.sin(a) * skal[1]
            z = r * math.sin(b)
            ring.append(bm.verts.new((x, y, z)))
        ringe.append(ring)
    for i in range(segs):
        for j in range(rsegs):
            a, b = ringe[i][j], ringe[(i + 1) % segs][j]
            c, d = ringe[(i + 1) % segs][(j + 1) % rsegs], ringe[i][(j + 1) % rsegs]
            bm.faces.new((a, b, c, d))
    M = Matrix.Translation(mitte) @ _ausrichtung(normale)
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _bm_zu_objekt(bm, name, mat, knochen)


def rundbox(name, mitte, groesse, mat, knochen, rundung=0.3, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    M = Matrix.Translation(mitte)
    if rot is not None:
        M = M @ rot.to_matrix().to_4x4()
    M = M @ Matrix.Diagonal((*groesse, 1.0))
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    w = min(groesse) * rundung
    return _bm_zu_objekt(bm, name, mat, knochen, glatt=False,
                         mods=[("BEVEL", {"width": w, "segments": 5, "limit_method": 'NONE'})])


def schale(name, mitte, radien, mat, knochen, alpha_max, dicke=0.03, nphi=56, nt=18,
           von_unten=False, phi_bereich=None, unterteilen=1, versatz=None):
    """
    Kugelschalen-Ausschnitt (für Haare, Bart, Mützen, Kapuzen).
    alpha_max(phi) = Polarwinkel (Rad) ab Pol, bis wohin die Schale reicht.
    phi = 0 vorne (-Y), +pi/2 links (+X), pi hinten.
    """
    cx, cy, cz = mitte
    rx, ry, rz = radien
    bm = bmesh.new()
    voll = phi_bereich is None
    p0, p1 = (0.0, 2 * math.pi) if voll else phi_bereich
    n_phi = nphi if voll else nphi + 1
    pol = bm.verts.new((cx, cy, cz + (-rz if von_unten else rz)))
    gitter = []
    for i in range(n_phi):
        phi = p0 + (p1 - p0) * i / (nphi)
        am = alpha_max(phi)
        spalte = []
        for j in range(1, nt + 1):
            a = am * j / nt
            sx = math.sin(a) * math.sin(phi)
            sy = -math.sin(a) * math.cos(phi)
            sz = math.cos(a) * (-1 if von_unten else 1)
            off = versatz(phi, a) if versatz else 0.0
            spalte.append(bm.verts.new((cx + rx * sx * (1 + off), cy + ry * sy * (1 + off), cz + rz * sz * (1 + off))))
        gitter.append(spalte)
    spalten = n_phi if voll else n_phi - 1
    for i in range(spalten):
        A, B = gitter[i], gitter[(i + 1) % n_phi]
        f = bm.faces.new((pol, A[0], B[0]) if not von_unten else (pol, B[0], A[0]))
        for j in range(nt - 1):
            q = (A[j], A[j + 1], B[j + 1], B[j])
            bm.faces.new(q if not von_unten else tuple(reversed(q)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mods = [("SOLIDIFY", {"thickness": dicke, "offset": 1.0, "use_even_offset": True})]
    if unterteilen:
        mods.append(("SUBSURF", {"levels": unterteilen, "render_levels": unterteilen}))
    return _bm_zu_objekt(bm, name, mat, knochen, mods=mods)


def rohr(name, punkte, radien, mat, knochen, segs=12, abflachen=1.0, glatt_teilen=2):
    """Glatte Röhre entlang einer Punktliste (für Mund, Brauen, Kordeln, Schnurrbart)."""
    pts = [Vector(p) for p in punkte]
    if isinstance(radien, (int, float)):
        radien = [radien] * len(pts)
    # Punkte verfeinern (Catmull-Rom), damit die Röhre rund verläuft
    def cr(p0, p1, p2, p3, t):
        return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
    fein, fr = [], []
    n = len(pts)
    for i in range(n - 1):
        p0, p1, p2, p3 = pts[max(i - 1, 0)], pts[i], pts[i + 1], pts[min(i + 2, n - 1)]
        for k in range(4):
            t = k / 4
            fein.append(cr(p0, p1, p2, p3, t))
            fr.append(radien[i] + (radien[i + 1] - radien[i]) * t)
    fein.append(pts[-1])
    fr.append(radien[-1])
    bm = bmesh.new()
    ringe = []
    oben = Vector((0, 0, 1))
    for i, p in enumerate(fein):
        t = (fein[min(i + 1, len(fein) - 1)] - fein[max(i - 1, 0)]).normalized()
        q = oben - t * oben.dot(t)
        if q.length < 1e-4:
            q = Vector((1, 0, 0)) - t * t.x
        q.normalize()
        b = t.cross(q)
        ring = []
        for j in range(segs):
            w = 2 * math.pi * j / segs
            off = (q * math.cos(w) * abflachen + b * math.sin(w)) * fr[i]
            ring.append(bm.verts.new(p + off))
        ringe.append(ring)
    for i in range(len(ringe) - 1):
        for j in range(segs):
            bm.faces.new((ringe[i][j], ringe[i][(j + 1) % segs], ringe[i + 1][(j + 1) % segs], ringe[i + 1][j]))
    # runde Enden
    for ende, nachbar in ((0, 1), (len(fein) - 1, len(fein) - 2)):
        t = (fein[ende] - fein[nachbar]).normalized()
        spitze = bm.verts.new(fein[ende] + t * fr[ende] * 0.8)
        ring = ringe[ende]
        for j in range(segs):
            f = (ring[j], ring[(j + 1) % segs], spitze)
            bm.faces.new(f if ende != 0 else tuple(reversed(f)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return _bm_zu_objekt(bm, name, mat, knochen,
                         mods=[("SUBSURF", {"levels": 1, "render_levels": 1})] if glatt_teilen else ())


def kegel(name, basis, spitze, r, mat, knochen, segs=16):
    basis, spitze = Vector(basis), Vector(spitze)
    L = (spitze - basis).length
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r, radius2=r * 0.12, depth=L)
    bmesh.ops.translate(bm, vec=(0, 0, L / 2), verts=bm.verts)
    M = Matrix.Translation(basis) @ _ausrichtung(spitze - basis)
    bmesh.ops.transform(bm, matrix=M, verts=bm.verts)
    return _bm_zu_objekt(bm, name, mat, knochen, mods=[("SUBSURF", {"levels": 1, "render_levels": 1})])


# ---------------------------------------------------------------- Figur
class Figur:
    def __init__(self, a):
        self.a = a
        self.comic = a.get("proportionen", "comic") == "comic"
        bau = {"schmal": 0.86, "normal": 1.0, "kraeftig": 1.18, "rundlich": 1.42}[a["koerperbau"]]
        if self.comic:
            bau *= 0.82          # schlanker: alle Breiten (Rumpf, Arme, Beine, Hände) skalieren mit bau
        self.bau = bau
        g = a["groesse"]
        self.g = g
        kg = a["kopfgroesse"]
        form = {"rund": (0.37, 0.34, 0.35), "oval": (0.34, 0.33, 0.38), "schmal": (0.315, 0.335, 0.40),
                "eckig": (0.37, 0.34, 0.35), "breit": (0.40, 0.35, 0.34)}[a["kopfform"]]
        self.fuss_z = 0.0
        if self.comic:
            # Erwachsene Comic-Proportionen (ca. 6 Köpfe): Kopf wird im Chibi-Maßstab gebaut und danach verkleinert
            self.knie_z = 0.50 * g
            self.huefte_z = 0.95 * g
            self.brust_z = 1.33 * g
            self.schulter = Vector((0.27 * bau * (0.9 if a.get("figur") == "weiblich" else 1.0), 0.0, 1.40 * g))
            self.hals_z = 1.47 * g
            self.arm_ell = Vector((0.05, 0.0, -0.30 * g))
            self.arm_hand = Vector((0.02, -0.02, -0.27 * g))
            self.kopf_faktor = 0.5 * kg
            kg_bau = 1.0
        else:
            # Chibi: großer Kopf, kurzer Körper
            self.knie_z = 0.30 * g
            self.huefte_z = 0.60 * g
            self.brust_z = 1.02 * g
            self.schulter = Vector((0.27 * bau, 0.0, 1.03 * g))
            self.hals_z = 1.10 * g
            self.arm_ell = Vector((0.07, 0.0, -0.22 * g))
            self.arm_hand = Vector((0.035, -0.02, -0.20 * g))
            self.kopf_faktor = 1.0
            kg_bau = kg
        self.kopf_r = Vector(form) * kg_bau
        self.kopf_m = Vector((0, 0, self.hals_z + self.kopf_r.z * 1.02))
        # endgültiger Kopf (nach dem Skalieren)
        self.kopf_ziel_m = Vector((0, 0, self.hals_z + self.kopf_r.z * self.kopf_faktor * 0.98))
        self.bein_x = 0.12 * bau
        if self.comic:
            # realistischere Augen: kleiner und etwas enger, wenn nicht ausdrücklich anders gewünscht
            au = a["augen"]
            au["groesse"] = au.get("groesse", 1.0) * 0.72
            au["abstand"] = au.get("abstand", 1.0) * 0.95

        fg = "fein_" if a.get("feines_gesicht") else ""
        self.m = {
            "haut_fein": material(fg + "haut_gesicht" if fg else "haut", a["hautfarbe"], rau=0.55),
            "haut": material("haut", a["hautfarbe"], rau=0.55),
            "haut_dunkel": material("haut_dunkel", abdunkeln(a["hautfarbe"], 0.82), rau=0.6),
            "wange": material(fg + "wange", a.get("wangenfarbe", "#F0857A"), rau=0.7),
            "weiss": material(fg + "augenweiss", "#FFFFFF", rau=0.3),
            "iris": material(fg + "iris", a["augen"]["farbe"], glanz=True),
            "pupille": material(fg + "pupille", "#111111", glanz=True),
            "glanzpunkt": material(fg + "glanzpunkt", "#FFFFFF", leuchten=True),
            "mund": material(fg + "mund", a.get("mundfarbe", "#5A1E1E"), rau=0.5),
            "zaehne": material("zaehne", "#FFFFFF", rau=0.4),
            "haare": material("haare", a["haare"]["farbe"], rau=0.5),
            "haare2": material("haare2", a["haare"].get("farbe2") or a["haare"]["farbe"], rau=0.5),
            "brauen": material(fg + "brauen", a["augenbrauen"]["farbe"] or abdunkeln(a["haare"]["farbe"], 0.85), rau=0.6),
            "bart": material("bart", a["bart"]["farbe"] or a["haare"]["farbe"], rau=0.6),
            "oberteil": material("oberteil", a["oberteil"]["farbe"]),
            "oberteil2": material("oberteil2", a["oberteil"]["farbe2"]),
            "hose": material("hose", a["hose"]["farbe"]),
            "schuh": material("schuh", a["schuhe"]["farbe"], rau=0.45),
            "sohle": material("sohle", a["schuhe"]["sohle"], rau=0.45),
        }

    def kopf_skalieren(self, ab_index):
        """Alle Kopfteile (ab TEILE[ab_index]) auf die endgültige Kopfgröße bringen und an den Hals setzen."""
        f = self.kopf_faktor
        if f == 1.0:
            return
        alt = self.kopf_m.copy()
        neu = self.kopf_ziel_m.copy()
        for ob, _ in TEILE[ab_index:]:
            for v in ob.data.vertices:
                v.co = neu + (v.co - alt) * f
        self.kopf_r = self.kopf_r * f
        self.kopf_m = neu

    def rumpf_y(self, z):
        """Vorderseite des Rumpfes (y-Wert) auf Höhe z (Superellipsoid-Näherung)."""
        m_, ry, rz = self._rumpf
        t = min(abs((z - m_.z) / rz), 0.999)
        return -(ry * (1 - t ** (2 / 0.82)) ** (0.82 / 2))

    # --- Hilfen am Kopf
    def kopf_verformung(self, v):
        """Form des Kopfes auf der Einheitskugel (wird für Kopf UND Gesichtsteile benutzt)."""
        form = self.a["kopfform"]
        if form == "eckig":
            return Vector((math.copysign(abs(v.x) ** 0.8, v.x), v.y, math.copysign(abs(v.z) ** 0.85, v.z)))
        if form == "schmal":
            x, y, z = v.x, v.y, v.z
            if z < 0:
                x *= 1 - 0.24 * (-z) ** 1.3          # Kiefer läuft schmal zu
                if y < 0:
                    y *= 1 + 0.10 * (-z)              # Kinn etwas nach vorne
            else:
                x *= 1 + 0.03 * (1 - z)               # Wangenknochen/Schläfen
            return Vector((x, y, z))
        if v.z < 0:  # Standard: Wangen etwas voller, Kinn runder
            return Vector((v.x * (1 + 0.06 * v.z), v.y, v.z * 0.98))
        return v

    def kopf_punkt(self, x_rel, z_rel, raus=0.0):
        """Punkt auf der (verformten) Kopfoberfläche vorne. x_rel/z_rel in Bruchteilen des Radius."""
        rx, ry, rz = self.kopf_r

        def flaeche(xr, zr):
            s_ = 1 - xr ** 2 - zr ** 2
            u = Vector((xr, -math.sqrt(max(s_, 0.0)), zr))
            d = self.kopf_verformung(u)
            return Vector((d.x * rx, d.y * ry, d.z * rz))
        p = flaeche(x_rel, z_rel)
        e = 0.02
        tx = flaeche(min(x_rel + e, 0.99), z_rel) - flaeche(max(x_rel - e, -0.99), z_rel)
        tz = flaeche(x_rel, min(z_rel + e, 0.99)) - flaeche(x_rel, max(z_rel - e, -0.99))
        n = tz.cross(tx).normalized()
        if n.y > 0:
            n = -n
        return self.kopf_m + p + n * raus, n

    def auf_kopf(self, x_rel, z_rel, raus=0.0):
        p, n = self.kopf_punkt(x_rel, z_rel, raus)
        rot = Vector((0, -1, 0)).rotation_difference(n)
        return p, rot

    # ------------------------------------------------------------ Körper
    def koerper(self):
        a, m, bau, g = self.a, self.m, self.bau, self.g
        stil = a["oberteil"]["stil"]
        ober = m["oberteil"]

        # Rumpf: leicht kastig-runde Form, oben breiter
        def rumpf_form(v):
            t = (v.z + 1) / 2  # 0 unten, 1 oben
            breite = 0.86 + 0.20 * t
            sgn = lambda x: math.copysign(abs(x) ** 0.82, x)
            return Vector((sgn(v.x) * breite, sgn(v.y), sgn(v.z) * 1.0))
        rumpf_h = (self.hals_z - self.huefte_z) * 0.5 + 0.02
        rumpf_m = Vector((0, 0.0, self.huefte_z + rumpf_h + 0.02))
        self._rumpf = (rumpf_m, 0.17 * bau, rumpf_h)
        ellipsoid("rumpf", rumpf_m, (0.25 * bau, 0.17 * bau, rumpf_h), ober, "spine",
                  verformen=rumpf_form)
        # Brust gehört zum Brustknochen (oberer Teil, damit er mitschwingt)
        ellipsoid("brust", rumpf_m + Vector((0, -0.005, rumpf_h * 0.45)), (0.245 * bau, 0.165 * bau, rumpf_h * 0.6),
                  ober, "chest", verformen=rumpf_form)

        # Hals
        kapsel("hals", (0, 0, self.hals_z - 0.06), (0, 0, self.hals_z + 0.08), 0.075 * bau, m["haut"], "neck")

        if stil == "tanktop":
            # Schultern frei
            pass
        if stil in ("hoodie",):
            # Kapuze liegt im Nacken als dicker Wulst
            torus("kapuze", Vector((0, 0.05, self.hals_z - 0.01)), 0.13 * bau, 0.055 * bau, ober, "chest",
                  normale=(0, 0.35, 1), skal=(1.15, 1.0))
            # Bauchtasche
            tz = self.huefte_z + 0.16
            rundbox("tasche", Vector((0, self.rumpf_y(tz) + 0.004, tz)), (0.24 * bau, 0.035, 0.11),
                    material("tasche", abdunkeln(a["oberteil"]["farbe"], 0.85)), "spine", rundung=0.4)
            # Kordeln
            for sx in (-1, 1):
                y0 = self.rumpf_y(self.hals_z - 0.06) - 0.012
                y1 = self.rumpf_y(self.brust_z - 0.14) - 0.012
                rohr("kordel", [(sx * 0.05, y0, self.hals_z - 0.06), (sx * 0.055, (y0 + y1) / 2 - 0.01, self.brust_z - 0.06),
                                (sx * 0.06, y1, self.brust_z - 0.14)], 0.013, m["oberteil2"], "chest")
        elif stil == "jacke":
            # offene Jacke: Innenshirt-Streifen + Reissverschluss-Kanten
            rundbox("innenshirt", Vector((0, -0.16 * bau, (self.huefte_z + self.hals_z) / 2)),
                    (0.11 * bau, 0.04, (self.hals_z - self.huefte_z) * 0.82), m["oberteil2"], "chest", rundung=0.45)
            torus("kragen", Vector((0, 0.0, self.hals_z - 0.03)), 0.11 * bau, 0.035 * bau, ober, "chest",
                  normale=(0, 0.1, 1), skal=(1.1, 1.0))
        elif stil == "heizjacke":
            # selbstbeheizte Steppjacke: offen über dem Shirt, Steppnähte, glühende Heizzonen, Akku-Knopf
            heiz = material("heizung", a["oberteil"].get("heizfarbe", "#FF7A1A"), leuchten=True)
            naht = material("steppnaht", abdunkeln(a["oberteil"]["farbe"], 0.72))
            mitte_z = (self.huefte_z + self.hals_z) / 2
            hoehe_r = (self.hals_z - self.huefte_z) * 0.84
            rundbox("innenshirt", Vector((0, self.rumpf_y(mitte_z) + 0.012, mitte_z)), (0.12 * bau, 0.035, hoehe_r),
                    m["oberteil2"], "chest", rundung=0.45)
            for sx in (1, -1):
                kapsel("reissverschluss", (sx * 0.065 * bau, self.rumpf_y(self.huefte_z + 0.08) + 0.004, self.huefte_z + 0.08),
                       (sx * 0.065 * bau, self.rumpf_y(self.hals_z - 0.08) + 0.004, self.hals_z - 0.08), 0.008,
                       material("zipper", "#C9D3E6", glanz=True), "chest")
            # Steppnähte rundherum
            for i in range(4):
                z = self.huefte_z + 0.1 + i * (self.hals_z - self.huefte_z - 0.16) / 3.5
                torus(f"stepp{i}", Vector((0, 0, z)), 0.205 * bau / 0.82 * (0.92 + 0.08 * i / 3), 0.012, naht,
                      "spine" if i < 2 else "chest", normale=(0, 0, 1), skal=(1.0, 0.72))
            # Heizzonen: Brust links/rechts und Rücken
            for sx in (1, -1):
                z = self.brust_z - 0.04
                ellipsoid("heizzone", Vector((sx * 0.12 * bau, self.rumpf_y(z) + 0.004, z)), (0.05, 0.012, 0.06), heiz, "chest")
            zb = self.brust_z - 0.08
            ellipsoid("heizzone_ruecken", Vector((0, -self.rumpf_y(zb) - 0.004, zb)), (0.11, 0.012, 0.1), heiz, "chest")
            # Akku-Knopf mit LED auf der linken Brust
            zk = self.brust_z + 0.06
            kn = Vector((0.13 * bau, self.rumpf_y(zk) - 0.004, zk))
            ellipsoid("heizknopf", kn, (0.028, 0.012, 0.028), material("knopf_schwarz", "#15151A"), "chest", segs=16, ringe=8)
            ellipsoid("heiz_led", kn + Vector((0, -0.008, 0.0)), (0.01, 0.006, 0.01), heiz, "chest", segs=10, ringe=6)
            # hoher Stehkragen
            torus("kragen", Vector((0, 0.01, self.hals_z - 0.01)), 0.1 * bau / 0.82 * 0.82, 0.035, ober, "chest",
                  normale=(0, 0.15, 1), skal=(1.12, 1.0))
            torus("kragen2", Vector((0, 0.01, self.hals_z + 0.035)), 0.095 * bau / 0.82 * 0.82, 0.03, ober, "neck",
                  normale=(0, 0.15, 1), skal=(1.12, 1.0))
        elif stil == "hemd":
            # Hemd mit Kragen, Knopfleiste und (optional) Längsstreifen
            streifen = material("hemdstreifen", a["oberteil"]["farbe2"])
            mit_streifen = a["oberteil"].get("streifen", True)
            for sx in (1, -1):
                kragen_a = Vector((sx * 0.02, self.rumpf_y(self.hals_z - 0.05) - 0.01, self.hals_z - 0.02))
                kragen_b = Vector((sx * 0.09 * bau / 0.82, self.rumpf_y(self.hals_z - 0.09) + 0.005, self.hals_z - 0.1))
                rohr("kragenspitze", [kragen_a + Vector((sx * 0.03, 0.02, 0.02)), kragen_a, kragen_a + (kragen_b - kragen_a) * 0.6],
                     [0.012, 0.016, 0.008], ober, "chest", abflachen=0.4)
            torus("kragen", Vector((0, 0.0, self.hals_z - 0.02)), 0.085 * bau, 0.025, ober, "chest", normale=(0, 0.1, 1))
            for i in range(5):
                zk = self.hals_z - 0.12 - i * (self.hals_z - self.huefte_z - 0.18) / 4
                ellipsoid("knopf", Vector((0, self.rumpf_y(zk) - 0.004, zk)), (0.012, 0.006, 0.012), streifen, "chest" if i < 3 else "spine",
                          segs=10, ringe=6)
            for j in range(-3, 4):
                if j == 0 or not mit_streifen:
                    continue
                x = j * 0.045 * bau / 0.82
                pkt = []
                for t in range(6):
                    zz = self.huefte_z + 0.1 + t * (self.hals_z - self.huefte_z - 0.2) / 5
                    pkt.append(Vector((x, self.rumpf_y(zz) * (1 - (x / (0.25 * bau)) ** 2 * 0.5) - 0.002 - 0.028 * (t / 5) ** 1.5, zz)))
                rohr("streifen", pkt, 0.006, streifen, "chest" if j % 2 else "spine", abflachen=0.4, glatt_teilen=0)
        elif stil == "trainingsjacke":
            # geschlossene Trainingsjacke: Stehkragen, Reißverschluss, helles Bauch-/Bruststück, dünne Paspeln
            o = a["oberteil"]
            panel_m = material("jacke_panel", o.get("panel", "#F2F2F0"))
            paspel = material("fein_paspel", o.get("paspel", "#C9DB6B"))
            cut = self.brust_z - 0.03       # Oberkante des hellen Stücks
            bz_m = rumpf_m.z + rumpf_h * 0.45
            def vorne(z):
                # vorderste Fläche aus Rumpf UND Brust (die Brust steht weiter vor)
                t = min(abs((z - bz_m) / (rumpf_h * 0.6)), 0.999)
                yb = -(0.165 * bau * (1 - t ** (2 / 0.82)) ** (0.82 / 2)) - 0.005
                return min(self.rumpf_y(z), yb)
            def panel_form(v):
                p = rumpf_form(v)
                z = rumpf_m.z + p.z * rumpf_h
                vorne = v.y < -0.2
                if z > cut or not vorne or z < self.huefte_z + 0.13:
                    return Vector((p.x * 0.93, p.y * 0.9, p.z))
                return p
            ellipsoid("jacke_panel", rumpf_m, (0.25 * bau * 1.012, 0.17 * bau * 1.04, rumpf_h * 1.0), panel_m, "spine",
                      verformen=panel_form)
            # Paspel entlang der Oberkante des hellen Stücks
            pkt = []
            for i in range(9):
                x = -0.2 * bau + i * 0.4 * bau / 8
                f = 1 - (x / (0.25 * bau)) ** 2 * 0.55
                pkt.append(Vector((x, vorne(cut) * f - 0.012, cut + 0.004)))
            rohr("paspel_quer", pkt, 0.011, paspel, "chest", abflachen=0.5, glatt_teilen=1)
            # Paspeln von der Schulter schräg zur Mitte
            for sx in (1, -1):
                a0 = Vector((sx * 0.19 * bau, vorne(self.hals_z - 0.07) * 0.8 - 0.012, self.hals_z - 0.05))
                a1 = Vector((sx * 0.14 * bau, vorne(self.brust_z + 0.03) - 0.012, self.brust_z + 0.03))
                a2 = Vector((sx * 0.09 * bau, vorne(cut) - 0.012, cut + 0.004))
                rohr("paspel_schraeg", [a0, a1, a2], 0.011, paspel, "chest", abflachen=0.5, glatt_teilen=1)
            # Reißverschluss (geschlossen) mit Zipper
            zip_m = material("zipper_dunkel", o.get("zipper", "#3A3A42"), glanz=True)
            zs = []
            for i in range(6):
                zz = self.huefte_z + 0.08 + i * (self.hals_z - 0.04 - self.huefte_z - 0.08) / 5
                zs.append(Vector((0, vorne(zz) - 0.012, zz)))
            rohr("reissverschluss", zs, 0.007, zip_m, "chest", glatt_teilen=1)
            rundbox("zipper", Vector((0, vorne(self.hals_z - 0.1) - 0.02, self.hals_z - 0.12)), (0.018, 0.01, 0.04),
                    material("zipper_hell", "#C9D3E6", glanz=True), "chest", rundung=0.4)
            # Stehkragen
            torus("kragen", Vector((0, 0.01, self.hals_z - 0.01)), 0.085 * bau, 0.032, ober, "chest",
                  normale=(0, 0.15, 1), skal=(1.12, 1.0))
            torus("kragen2", Vector((0, 0.01, self.hals_z + 0.03)), 0.08 * bau, 0.026, ober, "neck",
                  normale=(0, 0.15, 1), skal=(1.12, 1.0))
        elif stil == "pulli":
            torus("kragen", Vector((0, 0.0, self.hals_z - 0.035)), 0.085 * bau, 0.03, m["oberteil2"], "chest",
                  normale=(0, 0.1, 1))
            if a["oberteil"].get("blumen"):
                # aufgenähte Strickblumen (5 Blütenblätter + Mitte), Ton in Ton
                bm = material("fein_blume", a["oberteil"].get("blumenfarbe", a["oberteil"]["farbe2"]))
                bm2 = material("fein_blumenmitte", abdunkeln(a["oberteil"].get("blumenfarbe", a["oberteil"]["farbe2"]), 0.85))
                hoehe = self.hals_z - self.huefte_z
                for fx, fz, gr in ((-0.13, 0.62, 1.0), (-0.06, 0.45, 0.85), (-0.15, 0.32, 0.9), (0.12, 0.66, 0.9),
                                   (0.16, 0.5, 0.8), (0.05, 0.3, 0.75), (-0.02, 0.72, 0.7)):
                    x = fx * bau / 0.82
                    zz = self.huefte_z + fz * hoehe
                    mitte = Vector((x, self.rumpf_y(zz) * (1 - (x / (0.25 * bau)) ** 2 * 0.5) - 0.006, zz))
                    r = 0.022 * gr
                    for i in range(5):
                        w = i * math.tau / 5 + 0.3
                        ellipsoid("blütenblatt", mitte + Vector((math.cos(w) * r * 1.3, 0, math.sin(w) * r * 1.3)),
                                  (r, r * 0.45, r * 0.7), bm, "chest" if fz > 0.45 else "spine", segs=10, ringe=6,
                                  rot=Matrix.Rotation(-w, 4, 'Y'))
                    ellipsoid("blütenmitte", mitte + Vector((0, -0.004, 0)), (r * 0.55, r * 0.4, r * 0.55), bm2,
                              "chest" if fz > 0.45 else "spine", segs=10, ringe=6)
        else:
            torus("kragen", Vector((0, 0.0, self.hals_z - 0.04)), 0.085 * bau, 0.022, m["oberteil2"], "chest",
                  normale=(0, 0.12, 1))

        # Streifen unten am Oberteil (Bündchen)
        torus("buendchen", Vector((0, 0, self.huefte_z + 0.07)), 0.175 * bau, 0.03,
              m["oberteil2"] if stil != "tshirt" else ober, "spine", normale=(0, 0, 1), skal=(1.12, 0.86))

        # Nummer auf der Brust (als einfache Plakette)
        if a["oberteil"].get("nummer") not in (None, ""):
            rundbox("brustlogo", Vector((0.0, -0.17 * bau, self.brust_z - 0.06)), (0.11, 0.02, 0.11),
                    m["oberteil2"], "chest", rundung=0.5)

        # Kette
        if a["kette"]["an"]:
            km = material("kette", a["kette"]["farbe"], glanz=True)
            torus("kette", Vector((0, -0.03, self.hals_z - 0.07)), 0.12 * bau, 0.012, km, "chest",
                  normale=(0, -0.45, 1), skal=(1.0, 1.2))
            ellipsoid("anhaenger", Vector((0, -0.175 * bau, self.brust_z - 0.06)), (0.03, 0.015, 0.035), km, "chest")

        # Brustbeutel: kleine Tasche an einer Kordel um den Hals
        bb = a.get("brustbeutel", {})
        if bb.get("an"):
            bm = material("brustbeutel", bb.get("farbe", "#16161A"))
            zc = self.brust_z - 0.17
            yb = self.rumpf_y(zc) - 0.035
            rundbox("beutel", Vector((0, yb, zc)), (0.1, 0.045, 0.15), bm, "chest", rundung=0.35)
            rundbox("beutel_klappe", Vector((0, yb - 0.022, zc + 0.05)), (0.098, 0.012, 0.05),
                    material("brustbeutel_klappe", abdunkeln(bb.get("farbe", "#16161A"), 0.7)), "chest", rundung=0.4)
            km = material("fein_kordel", bb.get("kordel", "#1E1E24"))
            for sx in (1, -1):
                rohr("kordel", [Vector((sx * 0.04, yb + 0.005, zc + 0.075)),
                                Vector((sx * 0.07, self.rumpf_y(self.brust_z + 0.02) - 0.012, self.brust_z + 0.02)),
                                Vector((sx * 0.085, -0.02, self.hals_z - 0.04)),
                                Vector((sx * 0.06, 0.07, self.hals_z - 0.02)), Vector((0, 0.09, self.hals_z - 0.02))],
                     0.005, km, "chest", glatt_teilen=1)

        # Becken / Hose oben
        hose = m["hose"]
        if a["koerperbau"] == "rundlich":
            # runder Bauch und weiche Hüften
            zb = self.huefte_z + (self.brust_z - self.huefte_z) * 0.35
            ellipsoid("bauch", Vector((0, self.rumpf_y(zb) + 0.09, zb)), (0.2 * bau, 0.13 * bau, 0.2), ober, "spine")
        if a.get("figur") == "weiblich":
            # dezente weibliche Silhouette: Brust und etwas breitere Hüfte
            for sx in (1, -1):
                zb = self.brust_z - 0.03
                ellipsoid("brust_w", Vector((sx * 0.075 * bau / 0.82, self.rumpf_y(zb) + 0.035, zb)), (0.075, 0.055, 0.07), ober, "chest")
        breit_h = 1.12 if a.get("figur") == "weiblich" else 1.0
        ellipsoid("becken", Vector((0, 0, self.huefte_z + 0.02)), (0.215 * bau * breit_h, 0.15 * bau, 0.11), hose, "hips",
                  verformen=lambda v: Vector((math.copysign(abs(v.x) ** 0.85, v.x), v.y, v.z)))

        # Beine
        for seite, sx in (("L", 1), ("R", -1)):
            x = sx * self.bein_x
            oben = Vector((x, 0, self.huefte_z))
            knie = Vector((x * 1.03, 0, self.knie_z))
            fuss = Vector((x * 1.05, 0, 0.11))
            bd = (1.18 if self.comic else 1.0) * (1.2 if a["koerperbau"] == "rundlich" else 1.0)
            kapsel(f"oberschenkel.{seite}", knie, oben, 0.085 * bau * bd, hose, f"thigh.{seite}", r2=0.095 * bau * bd)
            unter_mat = hose if a["hose"]["stil"] == "lang" else m["haut"]
            kapsel(f"unterschenkel.{seite}", fuss, knie, 0.07 * bau * bd, unter_mat, f"shin.{seite}", r2=0.08 * bau * bd)
            if a["hose"]["stil"] == "kurz":
                torus(f"hosensaum.{seite}", knie + Vector((0, 0, 0.06)), 0.085 * bau, 0.025, hose, f"thigh.{seite}",
                      normale=(0, 0, 1))
            else:
                torus(f"hosensaum.{seite}", fuss + Vector((0, 0, 0.04)), 0.075 * bau, 0.02, hose, f"shin.{seite}",
                      normale=(0, 0, 1))
            # Schuh: runder Sneaker
            schuh_m = Vector((x * 1.05, -0.045, 0.075))
            ellipsoid(f"schuh.{seite}", schuh_m, (0.105 * bau, 0.17, 0.085), m["schuh"], f"foot.{seite}",
                      verformen=lambda v: Vector((v.x, v.y, v.z * (0.8 if v.z < 0 else 1.0) - (0.25 * max(0, -v.y) * max(v.z, 0)))))
            ellipsoid(f"sohle.{seite}", schuh_m + Vector((0, 0, -0.045)), (0.11 * bau, 0.178, 0.04), m["sohle"],
                      f"foot.{seite}")
            # Schnürung als kleine Wülste
            for k in range(2):
                kapsel(f"schnuer.{seite}{k}", schuh_m + Vector((-0.035, -0.07 + k * 0.04, 0.07 - k * 0.01)),
                       schuh_m + Vector((0.035, -0.07 + k * 0.04, 0.07 - k * 0.01)), 0.012, m["oberteil2"], f"foot.{seite}")

        # Arme
        lang = stil in ("hoodie", "jacke", "pulli", "heizjacke", "hemd", "trainingsjacke")
        for seite, sx in (("L", 1), ("R", -1)):
            s = Vector((sx * self.schulter.x, 0, self.schulter.z))
            ell = s + Vector((sx * self.arm_ell.x, self.arm_ell.y, self.arm_ell.z))
            hand = ell + Vector((sx * self.arm_hand.x, self.arm_hand.y, self.arm_hand.z))
            arm_r = 0.065 * bau
            ellipsoid(f"schulter.{seite}", s + Vector((sx * 0.01, 0, -0.01)), (0.075 * bau, 0.075 * bau, 0.07 * bau),
                      m["haut"] if stil == "tanktop" else ober, f"upper_arm.{seite}")
            kapsel(f"oberarm.{seite}", ell, s, arm_r, m["haut"] if stil == "tanktop" else ober, f"upper_arm.{seite}",
                   r2=arm_r * 1.12)
            if stil == "tshirt":
                torus(f"aermel.{seite}", s + (ell - s) * 0.55, arm_r * 1.12, 0.02, ober, f"upper_arm.{seite}",
                      normale=(ell - s))
            if stil == "heizjacke":
                for t_ in (0.35, 0.7):
                    torus(f"armstepp.{seite}", s + (ell - s) * t_, arm_r * 1.02, 0.011,
                          material("steppnaht", abdunkeln(a["oberteil"]["farbe"], 0.72)), f"upper_arm.{seite}", normale=(ell - s))
            kapsel(f"unterarm.{seite}", hand, ell, arm_r * 0.88, ober if lang else m["haut"], f"forearm.{seite}",
                   r2=arm_r * 0.98)
            if stil == "trainingsjacke":
                pm = material("fein_paspel", a["oberteil"].get("paspel", "#C9DB6B"))
                aus = Vector((sx, 0, 0))
                rohr(f"armpaspel_o.{seite}", [s + aus * arm_r * 1.1 + Vector((0, 0, 0.05)), ell + aus * arm_r * 1.02],
                     0.011, pm, f"upper_arm.{seite}", glatt_teilen=0)
                rohr(f"armpaspel_u.{seite}", [ell + aus * arm_r * 0.98, hand + (ell - hand) * 0.15 + aus * arm_r * 0.86],
                     0.011, pm, f"forearm.{seite}", glatt_teilen=0)
            if lang:
                torus(f"armbund.{seite}", hand + (ell - hand) * 0.12, arm_r * 0.85, 0.022, m["oberteil2"],
                      f"forearm.{seite}", normale=(ell - hand))
            # Hand: Fäustling-artig, groß und rund (Comic)
            hmat = material("handschuh", a["handschuhe"]["farbe"]) if a["handschuhe"]["an"] else m["haut"]
            hm = hand + Vector((0, 0, -0.055))
            if self.comic:
                # flache Handfläche (zeigt zum Körper) + vier Finger + Daumen
                ellipsoid(f"hand.{seite}", hm, (0.032, 0.05, 0.055), hmat, f"hand.{seite}")
                for i in range(4):
                    fy = -0.03 + i * 0.02
                    laenge = 0.075 - abs(i - 1.3) * 0.01
                    kapsel(f"finger.{seite}{i}", hm + Vector((0, fy, -0.035)), hm + Vector((-sx * 0.006, fy * 1.08, -0.035 - laenge)),
                           0.0125, hmat, f"hand.{seite}")
            else:
                ellipsoid(f"hand.{seite}", hm, (0.07 * bau, 0.075 * bau, 0.08 * bau), hmat, f"hand.{seite}")
            kapsel(f"daumen.{seite}", hm + Vector((-sx * 0.01, -0.05, 0.02)), hm + Vector((-sx * 0.0, -0.085, -0.02)),
                   0.026 * bau, hmat, f"hand.{seite}")
            self.hand_punkt = getattr(self, "hand_punkt", {})
            self.hand_punkt[seite] = hm
            for ab in a.get("armbaender", []):
                if ab.get("seite", "R") == seite:
                    handgelenk = hand + (ell - hand) * 0.1
                    torus(f"armband.{seite}", handgelenk, arm_r * 0.92, float(ab.get("dicke", 0.01)),
                          material("armband_" + ab.get("farbe", "#5A3A22")[1:], ab.get("farbe", "#5A3A22")),
                          f"forearm.{seite}", normale=(ell - hand))

    # ------------------------------------------------------------ Kopf
    def kopf(self):
        a, m = self.a, self.m
        km, kr = self.kopf_m, self.kopf_r

        ellipsoid("kopf", km, tuple(kr), m["haut"], "head", segs=48, ringe=32, verformen=self.kopf_verformung)

        # Ohren
        for sx in (1, -1):
            o = a["ohren"]
            p = km + Vector((sx * kr.x * 0.97, 0.02, -0.02))
            ellipsoid("ohr", p, (0.045 * o, 0.06 * o, 0.08 * o), m["haut"], "head")
            ellipsoid("ohr_innen", p + Vector((sx * 0.012, -0.012, 0)), (0.025 * o, 0.035 * o, 0.05 * o),
                      m["haut_dunkel"], "head")

        # Augen
        au = a["augen"]
        gr, ab = au["groesse"], au["abstand"]
        form = au["form"]
        h_skal = {"rund": 1.0, "mandel": 0.78, "muede": 0.7, "lachend": 0.62}[form]
        # lachende Augen: unten flach (Wange drückt hoch), oben rund
        aug_form = (lambda v: Vector((v.x, v.y, v.z * 0.35 if v.z < 0 else v.z))) if form == "lachend" else None
        for sx in (1, -1):
            xr, zr = sx * 0.34 * ab, 0.02
            p, rot = self.auf_kopf(xr, zr, raus=-0.012)
            R = rot.to_matrix().to_4x4()
            ellipsoid("auge", p, (0.072 * gr, 0.035, 0.088 * gr * h_skal), m["weiss"], "head", rot=R, verformen=aug_form)
            p2, rot2 = self.auf_kopf(xr * 0.97, zr + (0.015 if form == "lachend" else -0.02), raus=0.010)
            ih = min(1.0, h_skal + 0.12) if form != "lachend" else h_skal * 0.95
            ellipsoid("iris", p2, (0.05 * gr, 0.02, 0.06 * gr * ih), m["iris"], "head",
                      rot=rot2.to_matrix().to_4x4(), verformen=aug_form)
            p3, rot3 = self.auf_kopf(xr * 0.97, zr - 0.025, raus=0.018)
            ellipsoid("pupille", p3, (0.027 * gr, 0.012, 0.033 * gr), m["pupille"], "head", rot=rot3.to_matrix().to_4x4())
            p4, rot4 = self.auf_kopf(xr * 0.97 + 0.045 * gr, zr + 0.06 * gr, raus=0.026)
            ellipsoid("glanz", p4, (0.013 * gr, 0.008, 0.015 * gr), m["glanzpunkt"], "head", rot=rot4.to_matrix().to_4x4())
            if form in ("mandel", "lachend"):
                # Lidlinie: dunkler Bogen über dem Auge (Comic-Wimpernstrich)
                bogen = []
                for i in range(7):
                    t = i / 6 * 2 - 1
                    bogen.append(self.kopf_punkt(xr + t * 0.2 * gr, zr + 0.088 * gr * h_skal / self.kopf_r.z * (1 - 0.55 * t * t) + 0.012,
                                                 raus=0.022)[0])
                rohr("lidlinie", bogen, [0.006, 0.009, 0.011, 0.011, 0.011, 0.009, 0.006], m["pupille"], "head", abflachen=0.6)
                if form == "lachend":
                    # untere Lachfalte unter dem Auge
                    falte = [self.kopf_punkt(xr + t * 0.14 * gr, zr - 0.15 * gr + 0.04 * t * t, raus=0.006)[0] for t in (-1, -0.5, 0, 0.5, 1)]
                    rohr("lachfalte", falte, [0.003, 0.006, 0.007, 0.006, 0.003], m["haut_dunkel"], "head", abflachen=0.5)
            if form == "muede":
                # Oberlid
                p5, rot5 = self.auf_kopf(xr, zr + 0.13, raus=0.0)
                ellipsoid("lid", p5, (0.078 * gr, 0.038, 0.045 * gr), m["haut_fein"], "head", rot=rot5.to_matrix().to_4x4())

            # Augenbraue: gebogene Kapsel
            br = a["augenbrauen"]
            w = math.radians(br.get("winkel", 0.0)) * sx
            d = 0.018 * br.get("dicke", 1.0)
            innen = Vector((sx * 0.16 * ab, 0.30 - 0.3 * math.sin(w)))
            aussen = Vector((sx * 0.50 * ab, 0.30 + 0.3 * math.sin(w)))
            pi, _ = self.kopf_punkt(innen.x, innen.y, raus=0.014)
            pa, _ = self.kopf_punkt(aussen.x, aussen.y, raus=0.012)
            pmid, _ = self.kopf_punkt((innen.x + aussen.x) / 2, (innen.y + aussen.y) / 2 + 0.035, raus=0.018)
            rohr("braue", [pi, pmid, pa], [d * 1.05, d * 1.15, d * 0.6], m["brauen"], "head", abflachen=0.6)

        # Falten, Tränensäcke, Doppelkinn, Warze (für ältere oder fiese Figuren)
        if a.get("falten"):
            fm = material("falte", abdunkeln(a["hautfarbe"], 0.8), rau=0.7)   # "falte*" = im Spiel ohne Umrisslinie
            fk = 0.65 if a.get("falten") == "leicht" else 1.0
            for i, zz in enumerate((0.62, 0.70, 0.78)):
                stirn = [self.kopf_punkt(t * (0.38 - i * 0.05), zz + 0.03 * (1 - t * t), raus=0.003)[0] for t in (-1, -0.5, 0, 0.5, 1)]
                rohr("stirnfalte", stirn, [0.004 * fk, 0.007 * fk, 0.008 * fk, 0.007 * fk, 0.004 * fk], fm, "head", abflachen=0.5)
            for sx in (1, -1):
                xa = sx * (0.34 * a["augen"]["abstand"] + 0.22)
                for k in range(3):
                    kraehe = [self.kopf_punkt(xa, 0.05 - k * 0.07, raus=0.003)[0],
                              self.kopf_punkt(xa + sx * 0.1, 0.08 - k * 0.11, raus=0.002)[0]]
                    rohr("kraehenfuss", kraehe, [0.004 * fk, 0.002 * fk], fm, "head", abflachen=0.5)
                sack = [self.kopf_punkt(sx * (0.34 * a["augen"]["abstand"] + t * 0.13), -0.17 - 0.03 * (1 - t * t), raus=0.006)[0]
                        for t in (-1, -0.5, 0, 0.5, 1)]
                rohr("traenensack", sack, [0.004 * fk, 0.009 * fk, 0.011 * fk, 0.009 * fk, 0.004 * fk], fm, "head", abflachen=0.5)
                naso = [self.kopf_punkt(sx * (0.2 + 0.1 * t), -0.22 - 0.2 * t, raus=0.004)[0] for t in (0, 0.33, 0.66, 1)]
                rohr("nasolabial", naso, [0.004 * fk, 0.008 * fk, 0.008 * fk, 0.004 * fk], fm, "head", abflachen=0.5)
        if a.get("doppelkinn"):
            pk, rk = self.auf_kopf(0.0, -0.9, raus=-0.02)
            ellipsoid("doppelkinn", pk + Vector((0, 0.02, -0.045)), (0.2, 0.15, 0.09), m["haut"], "head",
                      rot=rk.to_matrix().to_4x4())
        if a.get("warze"):
            wp, _ = self.kopf_punkt(0.2, -0.05, raus=0.015)
            ellipsoid("warze", wp, (0.022, 0.022, 0.02), material("warze", "#8B5A3C"), "head", segs=12, ringe=8)
        # Wangen
        if a["wangenroete"]:
            for sx in (1, -1):
                p, rot = self.auf_kopf(sx * 0.55, -0.25, raus=-0.004)
                ellipsoid("wange", p, (0.045, 0.008, 0.026), m["wange"], "head", rot=rot.to_matrix().to_4x4())
        if a["sommersprossen"]:
            fm = material("sommersprossen", abdunkeln(a["hautfarbe"], 0.7))
            for sx in (1, -1):
                for (dx, dz) in ((0.40, -0.12), (0.48, -0.18), (0.34, -0.2), (0.52, -0.08), (0.44, -0.25)):
                    p, rot = self.auf_kopf(sx * dx, dz, raus=0.001)
                    ellipsoid("fleck", p, (0.008, 0.004, 0.008), fm, "head", rot=rot.to_matrix().to_4x4(), segs=8, ringe=6)

        # Nase
        nase = a["nase"]
        p, rot = self.auf_kopf(0.0, -0.17, raus=0.0)
        R = rot.to_matrix().to_4x4()
        if nase == "klein":
            ellipsoid("nase", p, (0.03, 0.028, 0.026), m["haut_fein"], "head", rot=R)
        elif nase == "gerade":
            # schmale, gerade Nase (Jugendlicher): Rücken + kleine Spitze, ohne Umriss-Ringe
            oben, _ = self.kopf_punkt(0.0, 0.06, raus=0.002)
            spitze, _ = self.kopf_punkt(0.0, -0.19, raus=0.038)
            kapsel("nasenruecken", oben, spitze, 0.016, m["haut_fein"], "head", r2=0.024)
            ellipsoid("nasenspitze", spitze + Vector((0, 0, -0.004)), (0.028, 0.026, 0.024), m["haut_fein"], "head")
            for sx in (1, -1):
                pf, _ = self.kopf_punkt(sx * 0.085, -0.22, raus=0.014)
                ellipsoid("nasenfluegel", pf, (0.019, 0.018, 0.016), m["haut_fein"], "head")
        elif nase == "knubbel":
            ellipsoid("nase", p, (0.045, 0.042, 0.04), m["haut"], "head", rot=R)
        elif nase == "breit":
            ellipsoid("nase", p, (0.058, 0.035, 0.034), m["haut"], "head", rot=R)
            for sx in (1, -1):
                ellipsoid("nasenfluegel", p + Vector((sx * 0.04, 0.008, -0.01)), (0.022, 0.02, 0.02), m["haut"], "head")
        elif nase == "haken":
            # große Hakennase: hoher Rücken, Höcker, nach unten gebogene Spitze
            oben, _ = self.kopf_punkt(0.0, 0.14, raus=0.004)
            hoecker, _ = self.kopf_punkt(0.0, -0.02, raus=0.06)
            spitze, _ = self.kopf_punkt(0.0, -0.24, raus=0.085)
            rohr("hakennase", [oben, hoecker, spitze], [0.03, 0.042, 0.04], m["haut"], "head", glatt_teilen=1)
            ellipsoid("nasenspitze", spitze + Vector((0, 0.004, -0.022)), (0.045, 0.04, 0.05), m["haut"], "head")
            for sx in (1, -1):
                pf, _ = self.kopf_punkt(sx * 0.12, -0.27, raus=0.025)
                ellipsoid("nasenfluegel", pf, (0.03, 0.026, 0.026), m["haut"], "head")
        elif nase == "lang":
            # gerader, langer Nasenrücken mit runder Spitze und Nasenflügeln
            oben, _ = self.kopf_punkt(0.0, 0.12, raus=0.004)
            spitze, n_sp = self.kopf_punkt(0.0, -0.2, raus=0.056)
            kapsel("nasenruecken", oben, spitze, 0.024, m["haut"], "head", r2=0.032)
            ellipsoid("nasenspitze", spitze + Vector((0, 0, -0.006)), (0.036, 0.034, 0.033), m["haut"], "head")
            for sx in (1, -1):
                pf, _ = self.kopf_punkt(sx * 0.11, -0.24, raus=0.02)
                ellipsoid("nasenfluegel", pf, (0.026, 0.024, 0.022), m["haut"], "head")
            ps, _ = self.kopf_punkt(0.0, -0.27, raus=0.045)
            for sx in (1, -1):
                ellipsoid("nasenloch", ps + Vector((sx * 0.022, 0.004, 0.0)), (0.011, 0.008, 0.006), m["haut_dunkel"], "head")
        else:  # spitz
            ellipsoid("nase", p + Vector((0, 0, 0.01)), (0.03, 0.055, 0.04), m["haut"], "head", rot=R,
                      verformen=lambda v: Vector((v.x * (1 - 0.4 * max(0, -v.y)), v.y, v.z)))

        # Mund
        mund = a["mund"]
        pts = []
        breite = {"laecheln": 0.24, "grinsen": 0.30, "neutral": 0.18, "frech": 0.22, "lachen": 0.34, "grimmig": 0.22}[mund]
        kurve = {"laecheln": 0.10, "grinsen": 0.12, "neutral": 0.0, "frech": 0.06, "lachen": 0.14, "grimmig": -0.09}[mund]
        n = 7
        for i in range(n):
            t = i / (n - 1) * 2 - 1  # -1..1
            x = t * breite
            z = -0.42 + kurve * (t * t)
            if mund == "frech":
                z += 0.05 * max(t, 0)
            pts.append(self.kopf_punkt(x, z, raus=0.004)[0])
        dicke = 0.017
        if mund == "lachen":
            # breites D-Lachen: oben gerade Zahnreihe, unten runder Bogen, Mundwinkel hoch
            pm, rotm = self.auf_kopf(0.0, -0.47, raus=-0.010)
            Rm = rotm.to_matrix().to_4x4()
            ellipsoid("mund_offen", pm, (0.135, 0.03, 0.075), m["mund"], "head", rot=Rm,
                      verformen=lambda v: Vector((v.x, v.y, (v.z * 0.12 if v.z > 0 else v.z) + 0.55 * v.x * v.x)))
            pz, rotz = self.auf_kopf(0.0, -0.435, raus=-0.002)
            ellipsoid("zaehne", pz, (0.115, 0.022, 0.026), m["zaehne"], "head", rot=rotz.to_matrix().to_4x4(),
                      verformen=lambda v: Vector((v.x, v.y, v.z + 0.5 * v.x * v.x)))
            pzu, rotzu = self.auf_kopf(0.0, -0.56, raus=-0.006)
            ellipsoid("zunge", pzu, (0.06, 0.02, 0.025), material("zunge", "#D9646E"), "head", rot=rotzu.to_matrix().to_4x4())
            for sx in ((1, -1) if a.get("lachfalten", True) else ()):
                # Lachfalten an den Mundwinkeln
                falte = [self.kopf_punkt(sx * (0.40 + 0.02 * t), -0.33 - 0.09 * t, raus=0.004)[0] for t in (0, 0.5, 1, 1.5)]
                rohr("mundfalte", falte, [0.004, 0.007, 0.007, 0.004], m["haut_dunkel"], "head", abflachen=0.5)
        elif mund == "grinsen":
            # offener Mund mit Zähnen
            pm, rotm = self.auf_kopf(0.0, -0.49, raus=-0.012)
            ellipsoid("mund_offen", pm, (0.10, 0.03, 0.055), m["mund"], "head", rot=rotm.to_matrix().to_4x4(),
                      verformen=lambda v: Vector((v.x, v.y, v.z if v.z < 0 else v.z * 0.25)))
            pz, rotz = self.auf_kopf(0.0, -0.44, raus=-0.002)
            ellipsoid("zaehne", pz, (0.085, 0.022, 0.02), m["zaehne"], "head", rot=rotz.to_matrix().to_4x4())
        else:
            rr = [dicke * (0.55 + 0.45 * math.sin(math.pi * i / (n - 1))) for i in range(n)]
            rohr("mund", pts, rr, m["mund"], "head", abflachen=0.8)

    # ------------------------------------------------------------ Haare
    def haare(self):
        a, m = self.a, self.m
        h = a["haare"]
        stil = h["stil"]
        km, kr = self.kopf_m, self.kopf_r
        hm = m["haare"]
        if stil == "glatze":
            return
        skal = 1.012
        R = (kr.x * skal, kr.y * skal, kr.z * skal)

        def haarlinie(vorne, seite, hinten, koteletten=0.0):
            """Haaransatz: vorne Stirn, seitlich über dem Ohr, hinten Nacken; Koteletten vor dem Ohr."""
            def f(phi):
                c = math.cos(phi)
                w = (1 - c) / 2
                basis = vorne + (hinten - vorne) * w
                s = math.sin(phi) ** 2
                wert = basis + (seite - basis) * s * 0.85
                d = abs(math.atan2(math.sin(phi), math.cos(phi)))  # 0..pi
                wert += koteletten * math.exp(-((d - math.radians(62)) / math.radians(9)) ** 2)
                return wert
            return f

        def weich_versatz(staerke):
            return lambda phi, a_: staerke * math.sin(a_) ** 2 * (0.6 + 0.4 * math.cos(phi) ** 2)

        if stil == "buzz":
            schale("haare", km, (kr.x * 1.01, kr.y * 1.01, kr.z * 1.01), hm, "head",
                   haarlinie(math.radians(62), math.radians(92), math.radians(118), math.radians(12)), dicke=0.012)
            return

        if stil == "geheimratsecken":
            # kurzes Haar, hohe Stirn, an den Schläfen tief zurückweichend
            basis = haarlinie(math.radians(24), math.radians(82), math.radians(112), math.radians(14))

            def linie(phi):
                d = abs(math.atan2(math.sin(phi), math.cos(phi)))
                ecke = math.radians(26) * math.exp(-((d - math.radians(42)) / math.radians(16)) ** 2)
                return max(math.radians(10), basis(phi) - ecke)
            schale("haare", km, (kr.x * 1.01, kr.y * 1.01, kr.z * 1.01), hm, "head", linie, dicke=0.016,
                   versatz=lambda phi, a_: 0.015 * math.sin(min(a_ / math.radians(50), 1.0) * math.pi))
            return

        if stil == "pixie":
            # Pixie: Seiten/Nacken kurz, oben Volumen, langer Pony schwungvoll zur Seite über die Stirn
            sgn = -1 if h.get("pony_richtung", "rechts") == "rechts" else 1   # rechts = zur rechten Gesichtshälfte der Figur
            schale("haare", km, (kr.x * 1.012, kr.y * 1.012, kr.z * 1.012), hm, "head",
                   haarlinie(math.radians(46), math.radians(80), math.radians(110), math.radians(10)), dicke=0.02,
                   versatz=lambda phi, a_: 0.06 * math.sin(min(a_ / math.radians(55), 1.0) * math.pi) * (0.7 + 0.3 * math.cos(phi)))
            hm2 = m["haare2"]
            # geschwungene Pony-Strähnen (flache Röhren entlang der Kopfoberfläche)
            for i, (dx, dz, mat) in enumerate(((0.0, 0.0, hm), (0.08, 0.05, hm2), (-0.06, -0.05, hm), (0.14, 0.1, hm),
                                              (0.04, -0.1, hm2), (-0.1, 0.06, hm))):
                bahn = [(-sgn * 0.42 + dx, 0.88 + dz * 0.3), (-sgn * 0.1 + dx, 0.74 + dz), (sgn * 0.28 + dx * 0.5, 0.56 + dz),
                        (sgn * 0.55, 0.40 + dz * 0.8), (sgn * 0.7, 0.22 + dz * 0.6)]
                pkt = [self.kopf_punkt(max(min(x, 0.95), -0.95), min(z, 0.97), raus=0.045 - 0.006 * j)[0] for j, (x, z) in enumerate(bahn)]
                rohr("strähne", pkt, [0.055, 0.06, 0.05, 0.035, 0.015], mat, "head", abflachen=0.45)
            return

        if stil == "buerste":
            # Bürstenschnitt: eine Schicht, Seiten anliegend, oben vorne etwas Volumen
            schale("haare", km, (kr.x * 1.012, kr.y * 1.012, kr.z * 1.012), hm, "head",
                   haarlinie(math.radians(50), math.radians(84), math.radians(112), math.radians(14)), dicke=0.016,
                   versatz=lambda phi, a_: 0.035 * math.sin(min(a_ / math.radians(55), 1.0) * math.pi) * (0.6 + 0.4 * math.cos(phi)))
            return

        if stil == "tolle":
            # kurze Seiten, oben länger und vorne nach oben/hinten gestylt (kleine Tolle)
            schale("haare", km, (kr.x * 1.012, kr.y * 1.012, kr.z * 1.012), hm, "head",
                   haarlinie(math.radians(48), math.radians(84), math.radians(112), math.radians(14)), dicke=0.016,
                   versatz=lambda phi, a_: (0.025 + 0.13 * max(0.0, math.cos(phi)) ** 2)
                   * math.sin(min(a_ / math.radians(50), 1.0) * math.pi) ** 0.7)
            return

        if stil in ("kurz", "stachel", "seitenscheitel", "iro", "locken", "lang", "zopf", "dutt", "seitenpony"):
            vorne = math.radians(54)
            seite = math.radians(80 if stil != "lang" else 92)
            schale("haare", km, R, hm, "head",
                   haarlinie(vorne, seite, math.radians(116), math.radians(22)),
                   dicke=0.035, versatz=weich_versatz(0.035))

        if stil == "seitenpony":
            # voller Pony, schräg zur Seite, etwas zerzaust; optional Spikes oben und Mullet hinten
            sgn = -1 if h.get("richtung", "links") == "links" else 1     # links/rechts aus Sicht des Betrachters
            rnd = random.Random(h.get("seed", 7))
            ellipsoid("haar_volumen", km + Vector((0, -kr.y * 0.05, kr.z * 0.55)), (kr.x * 0.92, kr.y * 0.9, kr.z * 0.5), hm, "head")
            ende = h.get("pony_ende", 0.34)
            pm = material("fein_haare", h["farbe"], rau=0.5)   # Strähnen ohne Umriss, damit der Pony weich wirkt
            for i, x0 in enumerate((-0.62, -0.42, -0.22, -0.02, 0.18, 0.38, 0.58)):
                x0 = x0 * -sgn + rnd.uniform(-0.05, 0.05)
                lauf = 0.22 + 0.04 * i + rnd.uniform(-0.06, 0.06)
                xe = x0 + sgn * lauf
                ze = ende - 0.06 * (1 - abs(xe)) + (0.05 if abs(xe) > 0.55 else 0.0) + rnd.uniform(-0.05, 0.04)
                p0, _ = self.kopf_punkt(x0 * 0.9, 0.86, raus=0.03)
                p1, _ = self.kopf_punkt((x0 + xe) / 2, (0.86 + ze) / 2 + 0.06, raus=0.05 + rnd.uniform(0, 0.015))
                p2, _ = self.kopf_punkt(xe, ze, raus=0.035)
                rohr("ponysträhne", [p0, p1, p2], [0.06, 0.055, 0.008], pm, "head", abflachen=0.42, glatt_teilen=1)
            # Spikes: kleine spitze Büschel oben, in leicht verschiedene Richtungen (zerzaust)
            for i in range(int(h.get("spikes", 0))):
                xr = rnd.uniform(-0.7, 0.7)
                zr = rnd.uniform(0.72, 0.99)
                fuss, n = self.kopf_punkt(xr, zr, raus=0.04)
                kipp = Vector((rnd.uniform(-0.9, 0.9), rnd.uniform(-0.8, 0.3), rnd.uniform(-0.3, 0.0)))
                richtung = (n + kipp).normalized()
                laenge = rnd.uniform(0.05, 0.095)
                mitte = fuss + richtung * laenge * 0.55 + Vector((rnd.uniform(-0.01, 0.01), 0, 0))
                spitze = fuss + richtung * laenge
                rohr("spike", [fuss - n * 0.02, mitte, spitze], [0.04, 0.026, 0.003], hm, "head", abflachen=0.7, glatt_teilen=1)
            if h.get("mullet"):
                # Mullet: Seiten kurz, hinten lange Haare bis in den Nacken, unten spitze, zerzauste Enden
                ellipsoid("mullet", km + Vector((0, kr.y * 0.52, -kr.z * 0.58)), (kr.x * 0.84, kr.y * 0.52, kr.z * 0.9), hm, "head",
                          verformen=lambda v: Vector((v.x * (1 + 0.14 * max(0.0, -v.z)), v.y * (1 + 0.1 * max(0.0, -v.z)), v.z)))
                for i in range(9):
                    t = i / 8 * 2 - 1
                    x = t * kr.x * 0.85
                    oben = km + Vector((x * 0.9, kr.y * 0.75, -kr.z * 0.9))
                    tief = -kr.z * (1.5 + rnd.uniform(-0.08, 0.12) - 0.15 * abs(t))
                    unten = km + Vector((x * 1.08 + t * 0.03, kr.y * (0.9 + rnd.uniform(0, 0.12)), tief))
                    rohr("mullet_spitze", [oben, unten], [0.05, 0.003], hm, "head", abflachen=0.55, glatt_teilen=0)
            return

        if stil == "afro":
            # Afro: große Wolke oben/hinten, vorne über der Stirn abgeflacht, damit das Gesicht frei bleibt
            def afro_form(v):
                v = v * (1 + 0.05 * math.sin(v.x * 9) * math.sin(v.y * 9) * math.sin(v.z * 9))
                if v.y < 0:  # vorne
                    v.y *= 0.55
                    v.z = v.z * 0.9 + 0.12
                return v
            ellipsoid("afro", km + Vector((0, kr.y * 0.32, kr.z * 0.42)), (kr.x * 1.38, kr.y * 1.3, kr.z * 1.05), hm, "head",
                      verformen=afro_form)
            return

        if stil == "locken":
            # Viele kleine Kugeln auf der Kappe (Fibonacci-Verteilung)
            N = 70
            for i in range(N):
                t = (i + 0.5) / N
                alpha = math.acos(1 - t * 1.25)  # nur obere Kappe
                phi = i * math.pi * (3 - math.sqrt(5))
                if alpha > math.radians(100) or (math.cos(phi) > 0.5 and alpha > math.radians(72)):
                    continue
                d = Vector((math.sin(alpha) * math.sin(phi), -math.sin(alpha) * math.cos(phi), math.cos(alpha)))
                p = km + Vector((d.x * R[0] * 1.06, d.y * R[1] * 1.06, d.z * R[2] * 1.06))
                rr = 0.055 + 0.015 * ((i * 7) % 3) / 2
                ellipsoid("locke", p, (rr, rr, rr), hm, "head", segs=12, ringe=8)
            return

        if stil == "stachel":
            # Reihen dicker, weicher Stacheln, die nach hinten-oben stehen (Comic-Look)
            reihen = [(18, 3, 0.0), (42, 6, 0.5), (68, 7, 0.0), (92, 6, 0.5)]
            for alpha_g, anzahl, versatz_ in reihen:
                alpha = math.radians(alpha_g)
                for i in range(anzahl):
                    phi = math.radians(-150 + (i + versatz_ + 0.5) * 300 / anzahl) + math.pi
                    if alpha_g >= 68 and math.cos(phi) > 0.45:
                        continue  # nicht ins Gesicht
                    d = Vector((math.sin(alpha) * math.sin(phi), -math.sin(alpha) * math.cos(phi), math.cos(alpha)))
                    basis = km + Vector((d.x * R[0] * 0.92, d.y * R[1] * 0.92, d.z * R[2] * 0.92))
                    rich = (d + Vector((0, 0.9, 0.55))).normalized()
                    laenge = 0.17 + 0.05 * ((i * 5 + alpha_g) % 3) / 2
                    kegel("stachel", basis, basis + rich * laenge, 0.105, hm, "head")
            # Pony: drei Stacheln, die über die Stirn nach vorne fallen
            for x, z in ((-0.36, 0.66), (0.0, 0.74), (0.34, 0.68)):
                b, n = self.kopf_punkt(x, z, raus=-0.01)
                kegel("pony_stachel", b, b + (n * 0.6 + Vector((x * 0.5, -0.25, -0.75))).normalized() * 0.16, 0.085, hm, "head")
            return

        if stil == "iro":
            for i in range(8):
                alpha = math.radians(-50 + i * 17)
                d = Vector((0, -math.sin(alpha), math.cos(alpha)))
                basis = km + Vector((0, d.y * R[1], d.z * R[2]))
                kegel("iro", basis, basis + d * 0.17, 0.07, hm, "head")
            return

        # Pony / Strähnen
        if h.get("pony", True) and stil in ("kurz", "lang", "zopf", "dutt", "seitenscheitel"):
            scheitel = h.get("scheitel", "keiner")
            if stil == "seitenscheitel" or scheitel in ("links", "rechts"):
                sgn = 1 if scheitel != "rechts" else -1
                # Große geschwungene Tolle zur Seite
                p, n = self.kopf_punkt(-sgn * 0.1, 0.72, raus=0.04)
                ellipsoid("tolle", p, (0.25, 0.13, 0.09), hm, "head",
                          rot=Vector((0, -1, 0)).rotation_difference(n).to_matrix().to_4x4() @ Matrix.Rotation(sgn * 0.35, 4, 'Y'))
            else:
                for i, x in enumerate((-0.42, -0.14, 0.14, 0.42)):
                    p, n = self.kopf_punkt(x, 0.62 - abs(x) * 0.3, raus=0.03)
                    rot = Vector((0, -1, 0)).rotation_difference(n).to_matrix().to_4x4() @ Matrix.Rotation(-x * 0.9, 4, 'Y')
                    ellipsoid("straehne", p, (0.105, 0.06, 0.12), hm, "head", rot=rot,
                              verformen=lambda v: Vector((v.x * (1 - 0.55 * max(0.0, -v.z)), v.y, v.z)))

        if stil == "lang":
            # Hinterkopf-Mähne bis zu den Schultern
            ellipsoid("maehne", km + Vector((0, kr.y * 0.35, -kr.z * 0.55)), (kr.x * 1.02, kr.y * 0.72, kr.z * 0.95), hm,
                      "head", verformen=lambda v: Vector((v.x * (1 + 0.15 * max(0.0, -v.z)), v.y, v.z)))
            for sx in (1, -1):
                kapsel("seitensträhne", km + Vector((sx * kr.x * 0.86, -kr.y * 0.15, -kr.z * 0.95)),
                       km + Vector((sx * kr.x * 0.95, -kr.y * 0.05, kr.z * 0.15)), 0.06, hm, "head", r2=0.075)
        elif stil == "zopf":
            p = km + Vector((0, kr.y * 1.0, kr.z * 0.15))
            ellipsoid("zopfgummi", p, (0.05, 0.04, 0.05), material("gummi", a["oberteil"]["farbe2"]), "head")
            kapsel("zopf", p + Vector((0, 0.15, -0.38)), p + Vector((0, 0.04, -0.02)), 0.06, hm, "head", r2=0.085)
        elif stil == "dutt":
            ellipsoid("dutt", km + Vector((0, kr.y * 0.4, kr.z * 1.02)), (0.13, 0.13, 0.11), hm, "head")
            if h.get("straehnen"):
                # lose Strähnen, die an den Schläfen heraushängen
                for sx in (1, -1):
                    a1, _ = self.kopf_punkt(sx * 0.78, 0.5, raus=0.02)
                    a2, _ = self.kopf_punkt(sx * 0.9, 0.05, raus=0.04)
                    a3, _ = self.kopf_punkt(sx * 0.86, -0.35, raus=0.05)
                    rohr("lose_strähne", [a1, a2, a3], [0.02, 0.016, 0.008], m.get("haare2", hm), "head", abflachen=0.3)

    def bart(self):
        a, m = self.a, self.m
        stil = a["bart"]["stil"]
        if stil == "keiner":
            return
        km, kr = self.kopf_m, self.kopf_r
        bm_ = m["bart"]
        if stil == "stoppeln":
            bm_ = material("stoppeln", abdunkeln(a["hautfarbe"], 0.72), rau=0.8)
        if stil in ("vollbart", "stoppeln"):
            def grenze(phi):
                # vorne bis über den Mund hinaus, hinten nur bis zum Ohr
                c = math.cos(phi)
                if c < -0.05:
                    return 0.0
                return math.radians(62 + 18 * c)
            schale("bart", km, (kr.x * 1.01, kr.y * 1.01, kr.z * 1.01), bm_, "head", grenze,
                   dicke=0.035 if stil == "vollbart" else 0.006, von_unten=True,
                   versatz=(lambda phi, a_: 0.05 * math.sin(a_) * max(0.0, math.cos(phi))) if stil == "vollbart" else None)
        if stil == "kinnbart":
            p, rot = self.auf_kopf(0.0, -0.78, raus=0.0)
            ellipsoid("kinnbart", p, (0.08, 0.05, 0.07), bm_, "head", rot=rot.to_matrix().to_4x4())
        if stil in ("schnauzer", "vollbart", "kinnbart"):
            for sx in (1, -1):
                p1, _ = self.kopf_punkt(sx * 0.02, -0.30, raus=0.018)
                p2, _ = self.kopf_punkt(sx * 0.26, -0.38, raus=0.012)
                kapsel("schnauzer", p1, p2, 0.026, bm_, "head", r2=0.016, abflachen=0.7)

    def accessoires(self):
        a, m = self.a, self.m
        km, kr = self.kopf_m, self.kopf_r
        br = a["brille"]
        if br["stil"] != "keine":
            gm = material("fein_brille" if br["stil"] == "rund" else "brille", br["farbe"], glanz=True)
            for sx in (1, -1):
                p, n = self.kopf_punkt(sx * 0.34 * a["augen"]["abstand"], 0.02, raus=0.05)
                if br["stil"] == "eckig":
                    rundbox("glas_rahmen", p, (0.17, 0.02, 0.12), gm, "head", rundung=0.25,
                            rot=Vector((0, -1, 0)).rotation_difference(n))
                    rundbox("glas", p + n * 0.004, (0.15, 0.012, 0.10), material("glas", "#BFE3FF"), "head",
                            rundung=0.25, rot=Vector((0, -1, 0)).rotation_difference(n))
                elif br["stil"] == "sonnenbrille":
                    rundbox("sonnenglas", p, (0.18, 0.025, 0.12), material("sonnenglas", "#151515", glanz=True), "head",
                            rundung=0.45, rot=Vector((0, -1, 0)).rotation_difference(n))
                else:
                    torus("brillenrand", p, br.get("groesse", 0.085), br.get("dicke", 0.012), gm, "head", normale=n)
                # Bügel
                pb = km + Vector((sx * kr.x * 1.0, -kr.y * 0.25, 0.01))
                kapsel("buegel", p + Vector((sx * 0.08, 0.02, 0)), pb + Vector((0, 0.18, 0)), 0.011, gm, "head")
            pl, _ = self.kopf_punkt(-0.1, 0.03, raus=0.06)
            pr, _ = self.kopf_punkt(0.1, 0.03, raus=0.06)
            kapsel("steg", pl, pr, 0.011, gm, "head")

        kb = a["kopfbedeckung"]
        if kb["stil"] != "keine":
            cm = material("kopfbedeckung", kb["farbe"])
            cm2 = material("kopfbedeckung2", abdunkeln(kb["farbe"], 0.8))
            R = (kr.x * 1.07, kr.y * 1.07, kr.z * 1.07)
            if kb["stil"] in ("cap", "cap_hinten"):
                schale("cap", km + Vector((0, 0, 0.02)), R, cm, "head", lambda phi: math.radians(70 + 8 * (1 - math.cos(phi)) / 2),
                       dicke=0.03)
                ellipsoid("cap_knopf", km + Vector((0, 0, R[2] + 0.04)), (0.03, 0.03, 0.02), cm2, "head")
                sgn = -1 if kb["stil"] == "cap" else 1
                schirm_m = km + Vector((0, sgn * (R[1] + 0.07), kr.z * 0.32))
                ellipsoid("schirm", schirm_m, (0.24, 0.17, 0.022), cm2, "head",
                          rot=Matrix.Rotation(math.radians(-8 * sgn), 4, 'X'),
                          verformen=lambda v: Vector((v.x, v.y, v.z - 0.6 * v.x * v.x)))
            elif kb["stil"] == "muetze":
                schale("muetze", km + Vector((0, 0, 0.03)), (R[0], R[1], R[2] * 1.15), cm, "head",
                       lambda phi: math.radians(76), dicke=0.04)
                torus("muetzenrand", km + Vector((0, 0, kr.z * 0.28)), kr.x * 1.04, 0.045, cm2, "head",
                      normale=(0, 0, 1), skal=(1.0, kr.y / kr.x))
                ellipsoid("bommel", km + Vector((0, 0, R[2] * 1.2 + 0.07)), (0.08, 0.08, 0.08), cm2, "head")
            elif kb["stil"] == "stirnband":
                torus("stirnband", km + Vector((0, 0, kr.z * 0.42)), kr.x * 0.95, 0.04, cm, "head", normale=(0, 0, 1),
                      skal=(1.0, kr.y / kr.x))

        if a.get("ohrringe"):
            om = material("ohrring", a["ohrringe"].get("farbe", "#FFFFFF"), glanz=True)
            for sx in (1, -1):
                ellipsoid("ohrstecker", km + Vector((sx * kr.x * 0.99, -0.005, -0.10)), (0.018, 0.018, 0.018), om, "head",
                          segs=12, ringe=8)

        if a["kopfhoerer"]["an"]:
            hm = material("kopfhoerer", a["kopfhoerer"]["farbe"])
            for sx in (1, -1):
                ellipsoid("muschel", km + Vector((sx * kr.x * 1.04, 0.02, 0.0)), (0.05, 0.09, 0.1), hm, "head")
            schale("buegel_kh", km, (kr.x * 1.12, kr.y * 0.35, kr.z * 1.12), hm, "head",
                   lambda phi: math.radians(85), dicke=0.03, nphi=24, unterteilen=0,
                   phi_bereich=(math.radians(60), math.radians(120)))
            schale("buegel_kh2", km, (kr.x * 1.12, kr.y * 0.35, kr.z * 1.12), hm, "head",
                   lambda phi: math.radians(85), dicke=0.03, nphi=24, unterteilen=0,
                   phi_bereich=(math.radians(240), math.radians(300)))

    def schal(self):
        """Großer Loop-Schal mit Fleckenmuster (am Hals/Brustkorb)."""
        sch = self.a.get("schal")
        if not sch:
            return
        m1 = material("schal", sch.get("farbe", "#2E4A7D"))
        m2 = material("schal_muster", sch.get("farbe2", "#C9D6EA"))
        bau = self.bau
        schlaufen = [  # (Mitte, R, r, Normale, Skalierung, Knochen)
            (Vector((0, 0.0, self.hals_z - 0.02)), 0.085 + 0.07 * bau, 0.05, (0, 0.2, 1), (1.12, 0.95), "neck"),
            (Vector((0, -0.02, self.hals_z - 0.085)), 0.1 + 0.09 * bau, 0.055, (0, 0.38, 1), (1.12, 0.92), "chest"),
            (Vector((0.03, self.rumpf_y(self.brust_z) - 0.035, self.brust_z - 0.02)), 0.075, 0.045, (0.2, -0.7, 0.5), (1.0, 1.25), "chest"),
        ]
        random.seed(5)
        for c, R, r, n, sk, kn in schlaufen:
            torus("schal", c, R, r, m1, kn, normale=n, skal=sk, segs=28, rsegs=12)
            M = Matrix.Translation(c) @ _ausrichtung(n)
            for i in range(14):
                a_ = random.uniform(0, 2 * math.pi)
                b_ = random.uniform(-1.6, 1.6)   # nur außen sichtbare Seite
                lp = Vector(((R + r * math.cos(b_)) * math.cos(a_) * sk[0], (R + r * math.cos(b_)) * math.sin(a_) * sk[1],
                             r * math.sin(b_)))
                ln = Vector((math.cos(b_) * math.cos(a_), math.cos(b_) * math.sin(a_), math.sin(b_)))
                wp = M @ lp
                wn = (M.to_3x3() @ ln).normalized()
                rot = Vector((0, 0, 1)).rotation_difference(wn).to_matrix().to_4x4()
                gr = random.uniform(0.012, 0.02)
                ellipsoid("schalfleck", wp - wn * 0.001, (gr * 1.4, gr, 0.004), m2, kn, rot=rot, segs=10, ringe=6)

    def waffe(self):
        a = self.a
        w = a["waffe"]
        if w["stil"] == "keine":
            return
        start = len(TEILE)
        self._waffe_bauen(w)
        if self.comic:
            hm = self.hand_punkt["R"]
            for ob, _ in TEILE[start:]:
                for v in ob.data.vertices:
                    v.co = hm + (v.co - hm) * 0.7

    def _waffe_bauen(self, w):
        hm = self.hand_punkt["R"]
        m1 = material("waffe", w["farbe"], glanz=True)
        m2 = material("waffe2", w["farbe2"])
        k = "hand.R"
        if w["stil"] == "blaster":
            rundbox("blaster_koerper", hm + Vector((0, -0.14, 0.05)), (0.13, 0.32, 0.15), m1, k, rundung=0.45)
            kapsel("blaster_lauf", hm + Vector((0, -0.28, 0.07)), hm + Vector((0, -0.44, 0.07)), 0.05, m2, k)
            torus("blaster_ring", hm + Vector((0, -0.42, 0.07)), 0.058, 0.02, m1, k, normale=(0, -1, 0))
            ellipsoid("blaster_tank", hm + Vector((0, -0.08, 0.18)), (0.07, 0.11, 0.07), m2, k)
            rundbox("blaster_griff", hm + Vector((0, -0.02, -0.03)), (0.07, 0.08, 0.13), m2, k, rundung=0.45)
        elif w["stil"] == "ball":
            ellipsoid("ball", hm + Vector((0, -0.09, 0.02)), (0.1, 0.1, 0.1), m1, k)
            torus("ballstreifen", hm + Vector((0, -0.09, 0.02)), 0.098, 0.01, m2, k, normale=(1, 0, 0))
        elif w["stil"] == "hammer":
            kapsel("stiel", hm + Vector((0, 0, -0.08)), hm + Vector((0, 0, 0.42)), 0.025, m2, k)
            rundbox("hammerkopf", hm + Vector((0, 0, 0.48)), (0.26, 0.15, 0.15), m1, k, rundung=0.35)
        elif w["stil"] == "stab":
            kapsel("stab", hm + Vector((0, 0, -0.3)), hm + Vector((0, 0, 0.45)), 0.022, m2, k)
            ellipsoid("kristall", hm + Vector((0, 0, 0.52)), (0.06, 0.06, 0.09), material("kristall", w["farbe"], leuchten=True), k)
        elif w["stil"] == "stift":
            # Kugelschreiber (etwas übergroß, damit man ihn sieht): Schaft, Griffzone, Spitze, Clip
            met = material("stift_metall", "#D9DEE8", glanz=True)
            kapsel("stift_schaft", hm + Vector((0, -0.04, -0.1)), hm + Vector((0, -0.04, 0.3)), 0.028, m1, k)
            kapsel("stift_griff", hm + Vector((0, -0.04, -0.1)), hm + Vector((0, -0.04, 0.02)), 0.031, m2, k)
            kapsel("stift_spitze", hm + Vector((0, -0.04, -0.18)), hm + Vector((0, -0.04, -0.1)), 0.006, met, k, r2=0.028)
            rundbox("stift_clip", hm + Vector((0, -0.073, 0.22)), (0.012, 0.014, 0.12), met, k, rundung=0.4)
        elif w["stil"] == "buch":
            rundbox("buch", hm + Vector((0, -0.08, 0.02)), (0.05, 0.16, 0.2), m1, k, rundung=0.2)
        elif w["stil"] == "kolben":
            kapsel("kolbenhals", hm + Vector((0, -0.07, 0.06)), hm + Vector((0, -0.07, 0.14)), 0.02, material("glas_kolben", "#D6F4FF", glanz=True), k)
            ellipsoid("kolbenbauch", hm + Vector((0, -0.07, 0.02)), (0.06, 0.06, 0.05), material("glas_kolben", "#D6F4FF", glanz=True), k)
            ellipsoid("chemikalie", hm + Vector((0, -0.07, 0.005)), (0.052, 0.052, 0.03), material("chemikalie", "#7CFF5B", leuchten=True), k)
        elif w["stil"] == "schnecke":
            ellipsoid("schneckenhaus", hm + Vector((0, -0.09, 0.05)), (0.05, 0.06, 0.06), m1, k)
            torus("spirale", hm + Vector((0, -0.09, 0.05)), 0.03, 0.009, m2, k, normale=(1, 0, 0))
            kapsel("schneckenkoerper", hm + Vector((0, -0.04, 0.0)), hm + Vector((0, -0.17, 0.0)), 0.022,
                   material("schneckenhaut", "#E8D28A"), k)
            for sx in (-1, 1):
                kapsel("fuehler", hm + Vector((sx * 0.01, -0.16, 0.01)), hm + Vector((sx * 0.02, -0.19, 0.06)), 0.005,
                       material("schneckenhaut", "#E8D28A"), k)
        elif w["stil"] == "kamera":
            rundbox("kamera", hm + Vector((0, -0.08, 0.04)), (0.12, 0.08, 0.08), m1, k, rundung=0.3)
            kapsel("objektiv", hm + Vector((0, -0.11, 0.04)), hm + Vector((0, -0.16, 0.04)), 0.028, m2, k)
        elif w["stil"] == "wolke":
            # kleine Regenwolke, die über der Hand schwebt, mit grünen Gifttropfen
            wm = material("wolke", w["farbe"])
            for dx, dz, r in ((0.0, 0.22, 0.07), (-0.06, 0.2, 0.05), (0.06, 0.2, 0.05), (0.02, 0.26, 0.05)):
                ellipsoid("wolke", hm + Vector((dx, -0.06, dz)), (r, r * 0.9, r * 0.85), wm, k)
            gift = material("gifttropfen", w["farbe2"], leuchten=True)
            for dx, dz in ((-0.04, 0.12), (0.0, 0.09), (0.04, 0.13)):
                ellipsoid("tropfen", hm + Vector((dx, -0.06, dz)), (0.01, 0.01, 0.018), gift, k, segs=8, ringe=6)
        elif w["stil"] == "kreide":
            kapsel("kreide", hm + Vector((0, -0.04, -0.02)), hm + Vector((0, -0.16, 0.03)), 0.022, m1, k)


# ---------------------------------------------------------------- Skelett
def skelett_bauen(f):
    arm = bpy.data.armatures.new("Skelett")
    ob = bpy.data.objects.new("Skelett", arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    eb = arm.edit_bones
    g = f.g
    vorne = Vector((0, -1, 0))

    def knochen(name, kopf, schwanz, eltern=None):
        b = eb.new(name)
        b.head, b.tail = Vector(kopf), Vector(schwanz)
        b.align_roll(vorne if abs((b.tail - b.head).normalized().y) < 0.9 else Vector((0, 0, 1)))
        if eltern:
            b.parent = eb[eltern]
        return b

    knochen("root", (0, 0, 0), (0, 0, 0.25))
    knochen("hips", (0, 0, f.huefte_z), (0, 0, f.huefte_z + 0.14), "root")
    knochen("spine", (0, 0, f.huefte_z + 0.14), (0, 0, f.brust_z - 0.12), "hips")
    knochen("chest", (0, 0, f.brust_z - 0.12), (0, 0, f.hals_z - 0.04), "spine")
    knochen("neck", (0, 0, f.hals_z - 0.04), (0, 0, f.hals_z + 0.08), "chest")
    knochen("head", (0, 0, f.hals_z + 0.08), (0, 0, f.kopf_m.z + f.kopf_r.z), "neck")
    for seite, sx in (("L", 1), ("R", -1)):
        s = Vector((sx * f.schulter.x, 0, f.schulter.z))
        ell = s + Vector((sx * f.arm_ell.x, f.arm_ell.y, f.arm_ell.z))
        hand = ell + Vector((sx * f.arm_hand.x, f.arm_hand.y, f.arm_hand.z))
        knochen(f"upper_arm.{seite}", s, ell, "chest")
        knochen(f"forearm.{seite}", ell, hand, f"upper_arm.{seite}")
        knochen(f"hand.{seite}", hand, hand + Vector((0, 0, -0.12)), f"forearm.{seite}")
        x = sx * f.bein_x
        knochen(f"thigh.{seite}", (x, 0, f.huefte_z), (x * 1.03, 0, f.knie_z), "hips")
        knochen(f"shin.{seite}", (x * 1.03, 0, f.knie_z), (x * 1.05, 0, 0.11), f"thigh.{seite}")
        knochen(f"foot.{seite}", (x * 1.05, 0, 0.11), (x * 1.05, -0.17, 0.05), f"shin.{seite}")
    bpy.ops.object.mode_set(mode='OBJECT')
    return ob


def zusammenbauen(skelett):
    # Jedes Teil bekommt eine Vertex-Gruppe mit 100 % auf seinen Knochen, dann alles zu einem Mesh
    for ob, k in TEILE:
        vg = ob.vertex_groups.new(name=k)
        vg.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
    bpy.ops.object.select_all(action='DESELECT')
    for ob, _ in TEILE:
        ob.select_set(True)
    haupt = TEILE[0][0]
    bpy.context.view_layer.objects.active = haupt
    bpy.ops.object.join()
    haupt.name = "Figur"
    haupt.data.name = "Figur"
    # doppelte Materialslots zusammenlegen
    bpy.ops.object.material_slot_remove_unused()
    md = haupt.modifiers.new("Skelett", 'ARMATURE')
    md.object = skelett
    haupt.parent = skelett
    return haupt


# ---------------------------------------------------------------- Animationen
def animationen(skelett, f=None):
    D = math.radians
    pb = skelett.pose.bones
    for b in pb:
        b.rotation_mode = 'XYZ'
    skelett.animation_data_create()
    aktionen = []

    def neu(name, frames):
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        skelett.animation_data.action = act
        for b in pb:
            b.rotation_euler = (0, 0, 0)
            b.location = (0, 0, 0)
        for fr, pose in frames:
            for b in pb:
                b.rotation_euler = (0, 0, 0)
                b.location = (0, 0, 0)
            for name_b, werte in pose.items():
                b = pb[name_b]
                if "r" in werte:
                    b.rotation_euler = tuple(D(x) for x in werte["r"])
                if "l" in werte:
                    b.location = werte["l"]
            for b in pb:
                b.keyframe_insert("rotation_euler", frame=fr, group=b.name)
                b.keyframe_insert("location", frame=fr, group=b.name)
        act.frame_range = (frames[0][0], frames[-1][0])
        aktionen.append(act)
        return act

    # Hinweis: +X dreht Gliedmaßen nach vorne, Wirbelsäule nach vorne. +Z hebt den linken Arm seitlich.
    arme_ruhe = {"upper_arm.L": {"r": (0, 0, 6)}, "upper_arm.R": {"r": (0, 0, -6)},
                 "forearm.L": {"r": (14, 0, 0)}, "forearm.R": {"r": (14, 0, 0)}}

    def mit(*dicts):
        out = {}
        for d in dicts:
            for k, v in d.items():
                out[k] = dict(out.get(k, {}), **v)
        return out

    neu("Idle", [
        (0, mit(arme_ruhe, {"hips": {"l": (0, 0, 0)}, "chest": {"r": (0, 0, 0)}, "head": {"r": (0, 0, 0)}})),
        (20, mit(arme_ruhe, {"hips": {"l": (0, -0.02, 0)}, "chest": {"r": (-3, 0, 0)}, "head": {"r": (3, 0, 0)},
                             "upper_arm.L": {"r": (0, 0, 10)}, "upper_arm.R": {"r": (0, 0, -10)},
                             "thigh.L": {"r": (4, 0, 0)}, "shin.L": {"r": (-8, 0, 0)},
                             "thigh.R": {"r": (4, 0, 0)}, "shin.R": {"r": (-8, 0, 0)}, "foot.L": {"r": (4, 0, 0)},
                             "foot.R": {"r": (4, 0, 0)}})),
        (40, mit(arme_ruhe, {"hips": {"l": (0, 0, 0)}, "chest": {"r": (0, 0, 0)}, "head": {"r": (0, 0, 0)}})),
    ])

    def lauf(phase):
        s = 1 if phase == 0 else -1
        return {
            "hips": {"l": (0, 0.0, 0)}, "spine": {"r": (12, 0, 0)}, "head": {"r": (-8, 0, 0)},
            "chest": {"r": (0, -10 * s, 0)},
            "thigh.L": {"r": (45 * s, 0, 0)}, "thigh.R": {"r": (-45 * s, 0, 0)},
            "shin.L": {"r": (-15 if s > 0 else -75, 0, 0)}, "shin.R": {"r": (-75 if s > 0 else -15, 0, 0)},
            "foot.L": {"r": (-10 * s, 0, 0)}, "foot.R": {"r": (10 * s, 0, 0)},
            "upper_arm.L": {"r": (-45 * s, 0, 10)}, "upper_arm.R": {"r": (45 * s, 0, -10)},
            "forearm.L": {"r": (60, 0, 0)}, "forearm.R": {"r": (60, 0, 0)},
        }

    def lauf_mitte(phase):
        p = lauf(phase)
        p = {k: dict(v) for k, v in p.items()}
        for k in ("thigh.L", "thigh.R", "upper_arm.L", "upper_arm.R", "foot.L", "foot.R"):
            r = p[k]["r"]
            p[k]["r"] = (r[0] * 0.1, r[1], r[2])
        p["chest"]["r"] = (0, 0, 0)
        p["hips"]["l"] = (0, 0.07, 0)
        p["shin.L"]["r"] = (-50, 0, 0)
        p["shin.R"]["r"] = (-50, 0, 0)
        return p

    watscheln = bool(f and f.a.get("gang") == "watscheln")

    def schwank(pose, s_, staerke=1.0):
        """Seitliches Wiegen von Oberkörper und Hüfte (für einen schwankenden Gang)."""
        if not watscheln:
            return pose
        p_ = {k: dict(v) for k, v in pose.items()}
        sp = p_.get("spine", {}).get("r", (0, 0, 0))
        p_.setdefault("spine", {})["r"] = (sp[0], sp[1], sp[2] + 9 * s_ * staerke)
        hp = p_.get("hips", {}).get("r", (0, 0, 0))
        p_.setdefault("hips", {})["r"] = (hp[0], hp[1] + 6 * s_ * staerke, hp[2] - 6 * s_ * staerke)
        hd = p_.get("head", {}).get("r", (0, 0, 0))
        p_.setdefault("head", {})["r"] = (hd[0], hd[1], hd[2] - 5 * s_ * staerke)
        for arm, sx in (("upper_arm.L", 1), ("upper_arm.R", -1)):
            r = p_.get(arm, {}).get("r", (0, 0, 0))
            p_.setdefault(arm, {})["r"] = (r[0], r[1], r[2] + 10 * sx)   # Arme etwas abgespreizt
        return p_

    neu("Run", [(0, schwank(lauf(0), 1)), (5, schwank(lauf_mitte(0), 0)), (10, schwank(lauf(1), -1)),
                (15, schwank(lauf_mitte(1), 0)), (20, schwank(lauf(0), 1))])

    neu("Attack", [
        (0, arme_ruhe),
        (4, mit(arme_ruhe, {"upper_arm.R": {"r": (-40, 0, -25)}, "forearm.R": {"r": (80, 0, 0)},
                            "chest": {"r": (0, 25, 0)}, "spine": {"r": (-5, 0, 0)}})),
        (8, mit(arme_ruhe, {"upper_arm.R": {"r": (95, 0, -5)}, "forearm.R": {"r": (5, 0, 0)},
                            "chest": {"r": (8, -20, 0)}, "spine": {"r": (10, 0, 0)},
                            "upper_arm.L": {"r": (-20, 0, 15)}})),
        (12, mit(arme_ruhe, {"upper_arm.R": {"r": (75, 0, -5)}, "forearm.R": {"r": (15, 0, 0)},
                             "chest": {"r": (4, -10, 0)}})),
        (18, arme_ruhe),
    ])

    neu("Super", [
        (0, arme_ruhe),
        (6, {"hips": {"l": (0, -0.12, 0)}, "spine": {"r": (25, 0, 0)},
             "thigh.L": {"r": (50, 0, 0)}, "thigh.R": {"r": (50, 0, 0)},
             "shin.L": {"r": (-90, 0, 0)}, "shin.R": {"r": (-90, 0, 0)}, "foot.L": {"r": (40, 0, 0)},
             "foot.R": {"r": (40, 0, 0)},
             "upper_arm.L": {"r": (-50, 0, 20)}, "upper_arm.R": {"r": (-50, 0, -20)}}),
        (14, {"root": {"r": (0, 180, 0), "l": (0, 0.45, 0)}, "spine": {"r": (-10, 0, 0)},
              "thigh.L": {"r": (30, 0, 0)}, "shin.L": {"r": (-60, 0, 0)},
              "upper_arm.L": {"r": (0, 0, 160)}, "upper_arm.R": {"r": (0, 0, -160)}}),
        (22, {"root": {"r": (0, 360, 0), "l": (0, 0.0, 0)}, "hips": {"l": (0, -0.1, 0)},
              "thigh.L": {"r": (40, 0, 0)}, "thigh.R": {"r": (40, 0, 0)},
              "shin.L": {"r": (-80, 0, 0)}, "shin.R": {"r": (-80, 0, 0)},
              "upper_arm.L": {"r": (0, 0, 70)}, "upper_arm.R": {"r": (0, 0, -70)}}),
        (30, mit(arme_ruhe, {"root": {"r": (0, 360, 0)}})),
    ])

    neu("Victory", [
        (0, {"upper_arm.L": {"r": (0, 0, 150)}, "upper_arm.R": {"r": (0, 0, -150)},
             "forearm.L": {"r": (20, 0, 0)}, "forearm.R": {"r": (20, 0, 0)}, "head": {"r": (-10, 0, 0)}}),
        (8, {"hips": {"l": (0, 0.18, 0)}, "upper_arm.L": {"r": (0, 0, 165)}, "upper_arm.R": {"r": (0, 0, -165)},
             "thigh.L": {"r": (20, 0, 0)}, "shin.L": {"r": (-50, 0, 0)}, "head": {"r": (-15, 0, 10)}}),
        (16, {"upper_arm.L": {"r": (0, 0, 150)}, "upper_arm.R": {"r": (0, 0, -150)},
              "forearm.L": {"r": (20, 0, 0)}, "forearm.R": {"r": (20, 0, 0)}, "head": {"r": (-10, 0, 0)}}),
        (24, {"hips": {"l": (0, 0.18, 0)}, "upper_arm.L": {"r": (0, 0, 165)}, "upper_arm.R": {"r": (0, 0, -165)},
              "thigh.R": {"r": (20, 0, 0)}, "shin.R": {"r": (-50, 0, 0)}, "head": {"r": (-15, 0, -10)}}),
        (32, {"upper_arm.L": {"r": (0, 0, 150)}, "upper_arm.R": {"r": (0, 0, -150)},
              "forearm.L": {"r": (20, 0, 0)}, "forearm.R": {"r": (20, 0, 0)}, "head": {"r": (-10, 0, 0)}}),
    ])

    neu("Hit", [
        (0, arme_ruhe),
        (3, mit(arme_ruhe, {"spine": {"r": (-18, 0, 0)}, "head": {"r": (-15, 0, 0)},
                            "upper_arm.L": {"r": (-20, 0, 30)}, "upper_arm.R": {"r": (-20, 0, -30)}})),
        (10, arme_ruhe),
    ])

    # --- Alltag (für Lehrer-Verhalten): Gehen, Sitzen, Lesen, Reden, Erschrecken
    def geh(phase):
        s_ = 1 if phase == 0 else -1
        return {"spine": {"r": (3, 0, 0)}, "chest": {"r": (0, -5 * s_, 0)},
                "thigh.L": {"r": (24 * s_, 0, 0)}, "thigh.R": {"r": (-24 * s_, 0, 0)},
                "shin.L": {"r": (-8 if s_ > 0 else -30, 0, 0)}, "shin.R": {"r": (-30 if s_ > 0 else -8, 0, 0)},
                "upper_arm.L": {"r": (-20 * s_, 0, 6)}, "upper_arm.R": {"r": (20 * s_, 0, -6)},
                "forearm.L": {"r": (18, 0, 0)}, "forearm.R": {"r": (18, 0, 0)}}

    def geh_mitte(phase):
        p_ = {k: dict(v) for k, v in geh(phase).items()}
        for k in ("thigh.L", "thigh.R", "upper_arm.L", "upper_arm.R"):
            r = p_[k]["r"]
            p_[k]["r"] = (r[0] * 0.1, r[1], r[2])
        p_["hips"] = {"l": (0, 0.025, 0)}
        p_["shin.L"]["r"] = (-20, 0, 0)
        p_["shin.R"]["r"] = (-20, 0, 0)
        return p_

    neu("Walk", [(0, schwank(geh(0), 1, 1.3)), (8, schwank(geh_mitte(0), 0)), (16, schwank(geh(1), -1, 1.3)),
                 (24, schwank(geh_mitte(1), 0)), (32, schwank(geh(0), 1, 1.3))])

    sitz_tief = (f.huefte_z - 0.5) if f else 0.15
    sitz = {"hips": {"l": (0, -sitz_tief, 0)}, "spine": {"r": (4, 0, 0)},
            "thigh.L": {"r": (88, 0, 4)}, "thigh.R": {"r": (88, 0, -4)},
            "shin.L": {"r": (-88, 0, 0)}, "shin.R": {"r": (-88, 0, 0)}, "foot.L": {"r": (0, 0, 0)},
            "upper_arm.L": {"r": (25, 0, 8)}, "upper_arm.R": {"r": (25, 0, -8)},
            "forearm.L": {"r": (55, 0, 0)}, "forearm.R": {"r": (55, 0, 0)}}
    sitz2 = mit(sitz, {"spine": {"r": (7, 0, 0)}, "head": {"r": (6, 8, 0)}, "chest": {"r": (2, 0, 0)}})
    neu("Sit", [(0, sitz), (30, sitz2), (60, sitz)])

    lesen = {"spine": {"r": (6, 0, 0)}, "head": {"r": (22, 0, 0)},
             "upper_arm.L": {"r": (35, 0, 12)}, "upper_arm.R": {"r": (35, 0, -12)},
             "forearm.L": {"r": (75, 0, -20)}, "forearm.R": {"r": (75, 0, 20)}}
    neu("Read", [(0, lesen), (40, mit(lesen, {"head": {"r": (24, -10, 0)}, "hips": {"l": (0, -0.01, 0)}})),
                 (80, mit(lesen, {"head": {"r": (22, 10, 0)}})), (120, lesen)])

    reden = mit(arme_ruhe, {"upper_arm.R": {"r": (40, 0, -15)}, "forearm.R": {"r": (60, 0, 0)}})
    neu("Talk", [(0, reden),
                 (10, mit(reden, {"upper_arm.R": {"r": (60, 0, -25)}, "forearm.R": {"r": (40, 0, 0)}, "head": {"r": (-5, 8, 0)}})),
                 (20, mit(reden, {"upper_arm.L": {"r": (30, 0, 20)}, "forearm.L": {"r": (50, 0, 0)}, "head": {"r": (5, -6, 0)}})),
                 (30, mit(reden, {"upper_arm.R": {"r": (55, 0, -10)}, "head": {"r": (-3, 0, 0)}})),
                 (40, reden)])

    neu("Alarm", [
        (0, arme_ruhe),
        (4, {"hips": {"l": (0, 0.12, 0)}, "spine": {"r": (-12, 0, 0)}, "head": {"r": (-15, 0, 0)},
             "upper_arm.L": {"r": (-10, 0, 70)}, "upper_arm.R": {"r": (-10, 0, -70)},
             "forearm.L": {"r": (40, 0, 0)}, "forearm.R": {"r": (40, 0, 0)}}),
        (10, mit(arme_ruhe, {"spine": {"r": (10, 0, 0)}, "upper_arm.L": {"r": (30, 0, 10)}, "upper_arm.R": {"r": (30, 0, -10)}})),
        (16, arme_ruhe),
    ])

    # Alle Aktionen als NLA-Spuren ablegen (damit der glTF-Export jede einzeln findet)
    skelett.animation_data.action = None
    for b in pb:
        b.rotation_euler = (0, 0, 0)
        b.location = (0, 0, 0)
    for act in aktionen:
        tr = skelett.animation_data.nla_tracks.new()
        tr.name = act.name
        st = tr.strips.new(act.name, int(act.frame_range[0]), act)
        tr.mute = True
    return aktionen


# ---------------------------------------------------------------- Vorschau
def vorschau(pfad, figur_hoehe):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 48
    try:
        sc.cycles.use_denoising = True
    except Exception:
        pass
    sc.render.resolution_x = 900
    sc.render.resolution_y = 1100
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    # Comic-Linien
    sc.render.use_freestyle = True
    sc.render.line_thickness_mode = 'ABSOLUTE'
    sc.render.line_thickness = 2.2
    vl = sc.view_layers[0]
    vl.use_freestyle = True
    ls = vl.freestyle_settings.linesets[0] if vl.freestyle_settings.linesets else vl.freestyle_settings.linesets.new("Linien")
    ls.select_by_visibility = True
    ls.select_silhouette = True
    ls.select_border = True
    ls.select_crease = False
    if ls.linestyle is None:
        ls.linestyle = bpy.data.linestyles.new("Comic")
    ls.linestyle.color = (0.08, 0.06, 0.1)
    # Welt
    w = bpy.data.worlds.new("Welt")
    sc.world = w
    w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs[0].default_value = hexfarbe("#BFE6FF")
    bg.inputs[1].default_value = 0.9
    # Boden
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=1.4, fill_type='NGON', location=(0, 0, 0.001))
    boden = bpy.context.active_object
    boden.data.materials.append(material("boden", "#7FD36E"))
    # Licht
    sonne = bpy.data.lights.new("Sonne", 'SUN')
    sonne.energy = 3.5
    sonne.angle = math.radians(8)
    so = bpy.data.objects.new("Sonne", sonne)
    so.rotation_euler = (math.radians(50), math.radians(10), math.radians(-35))
    sc.collection.objects.link(so)
    # Kamera
    cam = bpy.data.cameras.new("Kamera")
    cam.lens = 50
    co = bpy.data.objects.new("Kamera", cam)
    sc.collection.objects.link(co)
    ziel = Vector((0, 0, figur_hoehe * 0.52))
    co.location = ziel + Vector((1.5, -3.6, 0.9))
    co.rotation_euler = (ziel - co.location).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = co
    sc.render.filepath = pfad
    bpy.ops.render.render(write_still=True)


# ---------------------------------------------------------------- Hauptprogramm
def main():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else argv[1:]
    if not argv:
        print(__doc__)
        sys.exit(1)
    json_pfad = os.path.abspath(argv[0])
    mit_vorschau = "--keine-vorschau" not in argv
    ordner = os.path.dirname(json_pfad)
    with open(json_pfad, encoding="utf-8") as fh:
        daten = json.load(fh)
    aussehen = zusammenfuehren(STANDARD_AUSSEHEN, daten.get("aussehen", {}))

    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATERIALIEN.clear()
    TEILE.clear()

    f = Figur(aussehen)
    f.koerper()
    kopf_start = len(TEILE)
    f.kopf()
    f.haare()
    f.bart()
    f.accessoires()
    f.kopf_skalieren(kopf_start)
    f.schal()
    f.waffe()
    skelett = skelett_bauen(f)
    figur = zusammenbauen(skelett)
    animationen(skelett, f)
    hoehe = f.kopf_m.z + f.kopf_r.z
    print(f"Figur: {len(figur.data.vertices)} Vertices, {len(figur.data.materials)} Materialien, Höhe {hoehe:.2f} m")

    glb = os.path.join(ordner, "model.glb")
    bpy.ops.object.select_all(action='DESELECT')
    skelett.select_set(True)
    figur.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=glb, export_format='GLB', use_selection=True, export_apply=True,
        export_animations=True, export_animation_mode='NLA_TRACKS', export_force_sampling=True,
        export_frame_range=False, export_yup=True, export_skins=True, export_def_bones=False,
        export_optimize_animation_size=True,
    )
    print("Exportiert:", glb)
    blend = os.path.join(ordner, "model.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    print("Gespeichert:", blend)
    if mit_vorschau:
        vorschau(os.path.join(ordner, "preview.png"), hoehe)
        print("Vorschau:", os.path.join(ordner, "preview.png"))


if __name__ == "__main__":
    main()
