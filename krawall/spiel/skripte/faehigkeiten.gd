## Bibliothek aller Spezial-Fähigkeiten: Supers, Gadgets und Passive.
## In charakter.json wird nur der "typ" angegeben (+ optional eigene Werte), der Rest kommt von hier.
class_name Faehigkeiten
extends RefCounted

# ---------------------------------------------------------------- Katalog
# name/beschreibung = Standardtexte (in charakter.json überschreibbar), weitere Felder = Standardwerte
const SUPERS := {
	"sprint": {"name": "Turbo-Rempler", "beschreibung": "Rast nach vorne und rammt alle Gegner im Weg weg.",
		"schaden": 1000, "reichweite": 7.0},
	"salve": {"name": "Rundum-Salve", "beschreibung": "Feuert einen Ring aus Geschossen in alle Richtungen.",
		"schaden": 1600, "reichweite": 7.0, "anzahl": 16},
	"bombe": {"name": "Mega-Bombe", "beschreibung": "Wirft eine Riesenbombe über Wände. Zerstört Kisten und schleudert Gegner weg.",
		"schaden": 1400, "reichweite": 8.0, "radius": 2.6},
	"heilzone": {"name": "Heilzone", "beschreibung": "Ein Kreis, der das eigene Team heilt und Gegnern schadet.",
		"schaden": 2400, "radius": 3.0, "dauer": 4.0},
	"schild": {"name": "Panzerhaut", "beschreibung": "Nimmt einige Sekunden viel weniger Schaden, wird schneller und heilt sich etwas.",
		"dauer": 4.0, "reduktion": 0.6},
	"teleport": {"name": "Meteor-Sprung", "beschreibung": "Springt über Wände zum Zielpunkt und macht beim Landen Flächenschaden.",
		"schaden": 900, "reichweite": 9.0, "radius": 2.2},
	"geschuetz": {"name": "Mini-Geschütz", "beschreibung": "Stellt ein Geschütz auf, das selbstständig auf Gegner schießt.",
		"schaden": 220, "reichweite": 7.0, "dauer": 8.0},
	"wirbel": {"name": "Wirbelsturm", "beschreibung": "Ein Wirbel am Zielpunkt zieht Gegner in die Mitte und schadet ihnen.",
		"schaden": 1200, "reichweite": 7.0, "radius": 3.0, "dauer": 2.5},
	"wut": {"name": "Wutausbruch", "beschreibung": "Ein paar Sekunden schneller, stärker und doppelt so schnelles Nachladen.",
		"dauer": 5.0},
	"eisfeld": {"name": "Eisfeld", "beschreibung": "Friert den Boden am Zielpunkt ein: Gegner darin werden stark verlangsamt.",
		"schaden": 600, "reichweite": 8.0, "radius": 3.2, "dauer": 4.0},
	"unsichtbar": {"name": "Tarnkappe", "beschreibung": "Wird unsichtbar. Der nächste Angriff macht 50 % mehr Schaden.",
		"dauer": 4.0},
	"beschwoeren": {"name": "Verstärkung", "beschreibung": "Ein Begleiter erscheint und kämpft eine Weile mit.",
		"begleiter": "", "dauer": 10.0},
}

const GADGETS := {
	"heiltrank": {"name": "Heiltrank", "beschreibung": "Heilt sofort 30 % des Lebens.", "menge": 0.3},
	"stosswelle": {"name": "Stoßwelle", "beschreibung": "Schubst alle Gegner in der Nähe weg.", "radius": 3.0, "schaden": 300},
	"sprung": {"name": "Hechtsprung", "beschreibung": "Ein schneller Sprung in Blickrichtung.", "weite": 4.5},
	"schutzblase": {"name": "Schutzblase", "beschreibung": "2 Sekunden fast unverwundbar.", "dauer": 2.0},
	"mine": {"name": "Krawall-Mine", "beschreibung": "Legt eine versteckte Mine, die bei Gegnern explodiert.", "schaden": 1000, "radius": 1.8},
	"turbo": {"name": "Turboschuhe", "beschreibung": "3 Sekunden 50 % schneller.", "dauer": 3.0},
	"munition": {"name": "Schnellmagazin", "beschreibung": "Lädt sofort die ganze Munition nach.",},
	"frost": {"name": "Frostatem", "beschreibung": "Verlangsamt Gegner in der Nähe.", "radius": 4.0, "dauer": 2.5},
}

const PASSIVE := {
	"vampir": {"name": "Vampir", "beschreibung": "Heilt sich um 15 % des verursachten Schadens.", "anteil": 0.15},
	"dicke_haut": {"name": "Dicke Haut", "beschreibung": "Nimmt immer 15 % weniger Schaden.", "anteil": 0.15},
	"flink": {"name": "Flinke Füße", "beschreibung": "Läuft 12 % schneller.", "anteil": 0.12},
	"schnelllader": {"name": "Schnelllader", "beschreibung": "Lädt Munition 25 % schneller nach.", "anteil": 0.25},
	"letzte_kraft": {"name": "Letzte Kraft", "beschreibung": "Unter 40 % Leben 30 % mehr Schaden.", "anteil": 0.3, "grenze": 0.4},
	"schnelle_heilung": {"name": "Zähes Ding", "beschreibung": "Heilt schon nach 1,5 s statt 3 s und doppelt so schnell.",},
	"superlader": {"name": "Superlader", "beschreibung": "Der Super lädt 30 % schneller.", "anteil": 0.3},
	"dornen": {"name": "Dornen", "beschreibung": "Wirft 15 % des erlittenen Schadens auf den Angreifer zurück.", "anteil": 0.15},
}

const GADGET_LADUNGEN := 3
const GADGET_ABKLINGZEIT := 7.0


## Vervollständigt einen Fähigkeits-Eintrag aus charakter.json mit den Standardwerten.
static func voll(art: String, eintrag) -> Dictionary:
	var katalog: Dictionary = {"super": SUPERS, "gadget": GADGETS, "passiv": PASSIVE}[art]
	var e: Dictionary = {}
	if typeof(eintrag) == TYPE_STRING:
		e = {"typ": eintrag}
	elif typeof(eintrag) == TYPE_DICTIONARY:
		e = eintrag.duplicate()
	var typ: String = e.get("typ", "")
	if typ in ["", "keiner"]:
		return {}
	if not katalog.has(typ):
		push_warning("Unbekannte %s-Fähigkeit '%s' – verfügbar: %s" % [art, typ, ", ".join(katalog.keys())])
		return {}
	var out: Dictionary = katalog[typ].duplicate()
	for k in e:
		out[k] = e[k]
	return out


## Liste aller Gadgets bzw. Passiven eines Charakters (akzeptiert "gadget"/"gadgets" und "passiv"/"passive").
static func liste(daten: Dictionary, art: String) -> Array:
	var roh: Array = []
	var mehrzahl := "gadgets" if art == "gadget" else "passive"
	if daten.has(mehrzahl) and typeof(daten[mehrzahl]) == TYPE_ARRAY:
		roh = daten[mehrzahl]
	elif daten.has(art):
		roh = [daten[art]]
	var out: Array = []
	for r in roh:
		var v := voll(art, r)
		if not v.is_empty():
			out.append(v)
	return out


# ---------------------------------------------------------------- Supers
static func super_ausfuehren(k: Kaempfer, s: Dictionary, richtung: Vector3, ziel: Vector3) -> void:
	var arena = k.arena
	var farbe := Color.html(s.get("farbe", "#FF4D6D"))
	var schaden := float(s.get("schaden", 0)) * k.schadens_faktor()
	var rw := float(s.get("reichweite", 7.0))
	if ziel == Vector3.INF:
		ziel = k.global_position + richtung * rw
	var weg := ziel - k.global_position
	weg.y = 0
	if weg.length() > rw:
		ziel = k.global_position + weg.normalized() * rw
	ziel.y = 0
	match s["typ"]:
		"sprint":
			k.sprint_starten(richtung, rw, schaden)
		"salve":
			var n := int(s.get("anzahl", 16))
			for i in n:
				var r := richtung.rotated(Vector3.UP, TAU * i / n)
				arena.projektil(k, k.global_position + Vector3(0, 1.0, 0) + r * 0.5, r, 15.0, rw, schaden / 4.0, farbe, 0.28)
		"bombe":
			arena.wurf(k, k.global_position + Vector3(0, 1.4, 0), ziel, schaden, float(s.get("radius", 2.6)), farbe, true)
		"heilzone":
			arena.heilzone(k, k.global_position, schaden, farbe, float(s.get("radius", 3.0)), float(s.get("dauer", 4.0)))
		"schild":
			k.effekt_setzen("schild", float(s.get("dauer", 4.0)), float(s.get("reduktion", 0.6)))
			k.effekt_setzen("turbo", float(s.get("dauer", 4.0)), 0.15)
			k.heilen(k.max_leben * 0.25)
			k.blase_zeigen(farbe, float(s.get("dauer", 4.0)))
		"teleport":
			k.springen_zu(ziel, 0.55, func():
				arena.explosion(k, k.team, k.global_position, float(s.get("radius", 2.2)), schaden, farbe, false))
		"geschuetz":
			var g := Geschuetz.new()
			g.besitzer = k
			g.schaden = float(s.get("schaden", 220)) * k.schadens_faktor()
			g.reichweite = rw
			g.dauer = float(s.get("dauer", 8.0))
			g.farbe = farbe
			arena.add_child(g)
			g.global_position = k.global_position + richtung * 1.2
		"wirbel":
			var w := Zone.new()
			w.art = "wirbel"
			w.besitzer = k
			w.radius = float(s.get("radius", 3.0))
			w.dauer = float(s.get("dauer", 2.5))
			w.schaden_gesamt = schaden
			w.farbe = farbe
			arena.add_child(w)
			w.global_position = ziel
		"eisfeld":
			var e := Zone.new()
			e.art = "eis"
			e.besitzer = k
			e.radius = float(s.get("radius", 3.2))
			e.dauer = float(s.get("dauer", 4.0))
			e.schaden_gesamt = schaden
			e.farbe = Color("#9BE7FF")
			arena.add_child(e)
			e.global_position = ziel
		"wut":
			var d := float(s.get("dauer", 5.0))
			k.effekt_setzen("wut", d, 1.0)
			k.blase_zeigen(Color("#FF3B30"), d, 0.15)
		"beschwoeren":
			begleiter_rufen(k, str(s.get("begleiter", "")), float(s.get("dauer", 10.0)), richtung)
		"unsichtbar":
			k.effekt_setzen("unsichtbar", float(s.get("dauer", 4.0)), 1.0)
			var bonus := float(s.get("bonus", 1.5))
			if bonus > 1.0:
				k.effekt_setzen("hinterhalt", float(s.get("dauer", 4.0)) + 1.0, bonus)
			Effekte.puff(arena, k.global_position + Vector3(0, 1, 0), Color(farbe.r, farbe.g, farbe.b))


## Begleiter (z. B. Herr Lascha) erscheint neben dem Beschwörer, kämpft für dessen Team und verschwindet wieder.
static func begleiter_rufen(k: Kaempfer, id: String, dauer: float, richtung: Vector3) -> void:
	var d: Dictionary = Daten.begleiter.get(id, {})
	if d.is_empty():
		push_warning("Begleiter '%s' fehlt in res://begleiter" % id)
		return
	var arena = k.arena
	var b := Kaempfer.new()
	b.name = "Begleiter_" + id
	arena.add_child(b)
	b.einrichten(d, k.team, false, arena, k.stufe)
	b.regeneration = false
	b.schadens_multiplikator = k.schadens_multiplikator
	b.ki_feuerpause = k.ki_feuerpause
	b.ansage_zeit = k.ansage_zeit
	var seite := richtung.cross(Vector3.UP).normalized()
	b.global_position = arena.freier_punkt(k.global_position + seite * 1.6)
	b.spawn_punkt = k.global_position
	b.blick = richtung
	arena.kaempfer.append(b)
	Effekte.puff(arena, b.global_position + Vector3(0, 0.8, 0), Color("#FFFFFF"))
	Effekte.ruf(b, str(d.get("name", id)).to_upper(), Color.html(d.get("ruf_farbe", "#4CC9F0")))
	Arena.ton("super")
	var weg := func():
		if is_instance_valid(b):
			arena.kaempfer.erase(b)
			if not b.tot:
				Effekte.puff(arena, b.global_position + Vector3(0, 0.8, 0), Color("#FFFFFF"))
			b.queue_free()
	b.ausgeschaltet.connect(func(_o, _t): arena.get_tree().create_timer(0.3).timeout.connect(weg), CONNECT_ONE_SHOT)
	arena.get_tree().create_timer(dauer).timeout.connect(weg)


# ---------------------------------------------------------------- Gadgets
static func gadget_ausfuehren(k: Kaempfer, g: Dictionary, richtung: Vector3) -> void:
	var arena = k.arena
	var farbe := Color.html(g.get("farbe", "#7CFFCB"))
	match g["typ"]:
		"heiltrank":
			k.heilen(k.max_leben * float(g.get("menge", 0.3)))
			Effekte.puff(arena, k.global_position + Vector3(0, 1, 0), Color("#7CFF5B"))
		"stosswelle":
			var r := float(g.get("radius", 3.0))
			Effekte.ring(arena, k.global_position, r, farbe)
			for gegner in arena.gegner_von(k.team):
				var d: Vector3 = gegner.global_position - k.global_position
				d.y = 0
				if d.length() < r:
					gegner.schaden_nehmen(float(g.get("schaden", 300)), k, d.normalized() * 14.0)
		"sprung":
			k.springen_zu(k.global_position + richtung * float(g.get("weite", 4.5)), 0.3, Callable(), true)
		"schutzblase":
			k.effekt_setzen("blase", float(g.get("dauer", 2.0)), 0.9)
			k.blase_zeigen(farbe, float(g.get("dauer", 2.0)))
		"mine":
			var m := Mine.new()
			m.besitzer = k
			m.schaden = float(g.get("schaden", 1000)) * k.schadens_faktor()
			m.radius = float(g.get("radius", 1.8))
			arena.add_child(m)
			m.global_position = k.global_position
		"turbo":
			k.effekt_setzen("turbo", float(g.get("dauer", 3.0)), 0.5)
			Effekte.ring(arena, k.global_position, 1.5, farbe)
		"munition":
			k.munition = Kaempfer.MAX_MUNITION
			Effekte.ring(arena, k.global_position, 1.2, Color("#FF9F1C"))
		"frost":
			var r2 := float(g.get("radius", 4.0))
			Effekte.ring(arena, k.global_position, r2, Color("#9BE7FF"))
			for gegner in arena.gegner_von(k.team):
				if gegner.global_position.distance_to(k.global_position) < r2:
					gegner.effekt_setzen("langsam", float(g.get("dauer", 2.5)), 0.5)
	Arena.ton("super")


# ---------------------------------------------------------------- Objekte, die Fähigkeiten in die Arena setzen
class Geschuetz extends Node3D:
	var besitzer: Kaempfer
	var schaden := 220.0
	var reichweite := 7.0
	var dauer := 8.0
	var farbe := Color.ORANGE
	var _t := 0.0
	var _schuss := 0.0
	var _kopf: Node3D

	func _ready() -> void:
		var fuss := MeshInstance3D.new()
		var zyl := CylinderMesh.new()
		zyl.top_radius = 0.3
		zyl.bottom_radius = 0.45
		zyl.height = 0.6
		fuss.mesh = zyl
		fuss.position.y = 0.3
		fuss.material_override = Toon.farbig(Color("#5E6578"), 0.02)
		add_child(fuss)
		_kopf = Node3D.new()
		_kopf.position.y = 0.85
		add_child(_kopf)
		var k := MeshInstance3D.new()
		var kugel := SphereMesh.new()
		kugel.radius = 0.35
		kugel.height = 0.6
		k.mesh = kugel
		k.material_override = Toon.farbig(farbe, 0.02)
		_kopf.add_child(k)
		var lauf := MeshInstance3D.new()
		var l := CylinderMesh.new()
		l.top_radius = 0.09
		l.bottom_radius = 0.09
		l.height = 0.5
		lauf.mesh = l
		lauf.rotation.x = PI / 2
		lauf.position.z = 0.35
		lauf.material_override = Toon.farbig(Color("#2A2140"), 0.02)
		_kopf.add_child(lauf)
		scale = Vector3.ONE * 0.2
		create_tween().tween_property(self, "scale", Vector3.ONE, 0.3).set_trans(Tween.TRANS_BACK)

	func _physics_process(delta: float) -> void:
		_t += delta
		_schuss -= delta
		if _t > dauer or besitzer == null or not is_instance_valid(besitzer):
			Effekte.puff(besitzer.arena if besitzer else get_parent(), global_position + Vector3(0, 0.5, 0), Color("#5E6578"))
			queue_free()
			return
		var bester: Kaempfer = null
		var beste := reichweite
		for g in besitzer.arena.gegner_von(besitzer.team):
			var d: float = g.global_position.distance_to(global_position)
			if d < beste and besitzer.arena.freie_sicht(global_position, g.global_position):
				beste = d
				bester = g
		if bester:
			var r: Vector3 = bester.global_position - global_position
			r.y = 0
			_kopf.rotation.y = lerp_angle(_kopf.rotation.y, atan2(r.x, r.z), 12.0 * delta)
			if _schuss <= 0.0:
				_schuss = 0.5
				besitzer.arena.projektil(besitzer, global_position + Vector3(0, 0.85, 0) + r.normalized() * 0.6,
					r.normalized(), 18.0, reichweite, schaden, farbe, 0.15)


class Mine extends Node3D:
	var besitzer: Kaempfer
	var schaden := 1000.0
	var radius := 1.8
	var _scharf := 0.6

	func _ready() -> void:
		add_to_group("minen")
		var m := MeshInstance3D.new()
		var s := SphereMesh.new()
		s.radius = 0.3
		s.height = 0.25
		m.mesh = s
		m.position.y = 0.08
		m.material_override = Toon.farbig(Color("#3A2E4F"), 0.02)
		add_child(m)
		var licht := MeshInstance3D.new()
		var l := SphereMesh.new()
		l.radius = 0.07
		l.height = 0.14
		licht.mesh = l
		licht.position.y = 0.2
		licht.material_override = Toon.farbig(Color("#FF4757"), 0.0, 1.5)
		add_child(licht)

	func _physics_process(delta: float) -> void:
		_scharf -= delta
		if besitzer == null or not is_instance_valid(besitzer) or besitzer.arena.vorbei:
			queue_free()
			return
		if _scharf > 0.0:
			return
		for g in besitzer.arena.gegner_von(besitzer.team):
			if g.global_position.distance_to(global_position) < 0.9:
				besitzer.arena.explosion(besitzer, besitzer.team, global_position, radius, schaden, Color("#FF9F1C"), false)
				queue_free()
				return

	## Minen sind für Gegner unsichtbar
	func fuer_spieler_sichtbar(spieler: Kaempfer) -> bool:
		return besitzer.team == spieler.team


class Zone extends Node3D:
	var art := "wirbel"   # wirbel | eis
	var besitzer: Kaempfer
	var radius := 3.0
	var dauer := 2.5
	var schaden_gesamt := 1000.0
	var farbe := Color.WHITE
	var _t := 0.0
	var _tick := 0.0
	var _scheibe: MeshInstance3D

	func _ready() -> void:
		_scheibe = MeshInstance3D.new()
		var z := CylinderMesh.new()
		z.top_radius = radius
		z.bottom_radius = radius
		z.height = 0.05
		z.radial_segments = 40
		_scheibe.mesh = z
		var c := farbe
		c.a = 0.4
		_scheibe.material_override = Toon.unschattiert(c, true)
		_scheibe.position.y = 0.04
		add_child(_scheibe)
		if art == "wirbel":
			for i in 3:
				var r := MeshInstance3D.new()
				var t := TorusMesh.new()
				t.inner_radius = radius * (0.35 + i * 0.2)
				t.outer_radius = t.inner_radius + 0.12
				r.mesh = t
				r.position.y = 0.4 + i * 0.6
				r.material_override = Toon.unschattiert(Color(1, 1, 1, 0.6), true)
				add_child(r)
		Effekte.ring(besitzer.arena, global_position, radius, farbe)

	func _physics_process(delta: float) -> void:
		_t += delta
		_tick -= delta
		rotation.y += delta * (9.0 if art == "wirbel" else 0.3)
		if _t > dauer or besitzer == null or not is_instance_valid(besitzer):
			queue_free()
			return
		for g in besitzer.arena.gegner_von(besitzer.team):
			var d: Vector3 = global_position - g.global_position
			d.y = 0
			if d.length() < radius:
				if art == "wirbel":
					g.zug(d.normalized() * 5.5)
				else:
					g.effekt_setzen("langsam", 0.3, 0.45)
		if _tick <= 0.0:
			_tick = 0.5
			var anteil := schaden_gesamt * 0.5 / dauer
			for g in besitzer.arena.gegner_von(besitzer.team):
				if g.global_position.distance_to(global_position) < radius:
					g.schaden_nehmen(anteil, besitzer)
