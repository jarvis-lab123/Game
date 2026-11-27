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
	"stifte": {"name": "Dreifach-Stift", "beschreibung": "Schießt drei riesige Stifte gleichzeitig nach vorne – geradeaus, links und rechts.",
		"schaden": 1300, "reichweite": 9.0, "anzahl": 3, "winkel": 22},
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
	"schweigen": {"name": "Silence", "beschreibung": "Alle Gegner in der Nähe verstummen: Wer jetzt angreift, ist sofort K.o.",
		"dauer": 4.0, "reichweite": 14.0},
	"brandbombe": {"name": "Molotow-Cocktail", "beschreibung": "Wirft eine große Brandflasche: Explosion und ein Feuerfeld, das mehrere Sekunden brennt.",
		"schaden": 700, "reichweite": 9.0, "radius": 2.4, "feuer_schaden": 1600, "feuer_dauer": 4.5, "feuer_radius": 3.2},
	"verwandeln": {"name": "Verwandlung", "beschreibung": "Verwandelt sich für ein paar Sekunden in ein rasend schnelles Tier, das zubeißt.",
		"tier": "schwein", "dauer": 7.0, "biss_schaden": 650, "tempo_bonus": 1.2},
	"co2_wolke": {"name": "CO₂-Wolke", "beschreibung": "Eine dicke CO₂-Wolke hüllt den Werfer ein und wandert mit: Gegner darin nehmen Schaden und werden langsamer. Selten wird die Map zur Wüste.",
		"schaden": 1400, "dauer": 6.0, "radius": 3.6, "wueste_chance": 0.01},
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
		"stifte":
			var n := int(s.get("anzahl", 3))
			var w := deg_to_rad(float(s.get("winkel", 22)))
			for i in n:
				var r := richtung.rotated(Vector3.UP, lerpf(-w, w, float(i) / maxf(n - 1, 1)) if n > 1 else 0.0)
				arena.projektil(k, k.global_position + Vector3(0, 1.0, 0) + r * 0.6, r, 17.0, rw, schaden, farbe, 0.45, "", "stift_gross")
			Effekte.ruf(k, "STIFTE RAUS!", farbe)
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
		"brandbombe":
			arena.wurf(k, k.global_position + Vector3(0, 1.4, 0), ziel, schaden, float(s.get("radius", 2.4)), farbe, false,
				"molotow", {"zone": {"art": "feuer", "radius": float(s.get("feuer_radius", 3.2)),
				"dauer": float(s.get("feuer_dauer", 4.5)), "schaden": float(s.get("feuer_schaden", 1600))}})
		"schweigen":
			var d := float(s.get("dauer", 4.0))
			Effekte.ring(arena, k.global_position, float(s.get("reichweite", 14.0)), farbe, 0.6)
			for g in arena.gegner_von(k.team):
				if g.global_position.distance_to(k.global_position) <= float(s.get("reichweite", 14.0)):
					g.effekt_setzen("verstummt", d, 1.0)
					g.verstummt_von = k
					if g.ist_spieler and arena.hud and arena.hud.has_method("stille_warnung"):
						arena.hud.stille_warnung(d)
		"verwandeln":
			var biss := {"typ": "nahkampf", "name": "Biss", "schaden": float(s.get("biss_schaden", 650)),
				"reichweite": float(s.get("biss_reichweite", 1.7)), "nachladen": 0.6, "farbe": s.get("farbe", "#FF8FB8"),
				"heilt": float(s.get("biss_heilt", 0.0))}
			k.verwandeln(str(s.get("tier", "schwein")), float(s.get("dauer", 7.0)), biss, float(s.get("tempo_bonus", 1.2)),
				float(s.get("panzer", 0.0)))
		"co2_wolke":
			var z := Zone.new()
			z.art = "co2"
			z.besitzer = k
			z.radius = float(s.get("radius", 3.6))
			z.dauer = float(s.get("dauer", 6.0))
			z.schaden_gesamt = schaden
			z.farbe = Color("#8A8F94")
			z.folgt = k
			arena.add_child(z)
			z.global_position = Vector3(k.global_position.x, 0, k.global_position.z)
			if randf() < float(s.get("wueste_chance", 0.01)) and arena.has_method("wueste_machen"):
				arena.wueste_machen(k)
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
	var folgt: Node3D = null        # co2: Zone wandert mit (z. B. mit dem Lehrer)
	var _tropfen: Array = []

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
		if art == "feuer" or art == "gift":
			# Flammen bzw. Säureblasen, die flackern
			for i in (14 if art == "feuer" else 9):
				var w := randf() * TAU
				var rr := sqrt(randf()) * radius * 0.85
				var f := MeshInstance3D.new()
				if art == "feuer":
					var kg := CylinderMesh.new()
					kg.top_radius = 0.0
					kg.bottom_radius = randf_range(0.18, 0.32)
					kg.height = randf_range(0.6, 1.2)
					f.mesh = kg
					f.material_override = Toon.farbig(Color("#FFB703") if i % 3 == 0 else Color("#FF5A1F"), 0.0, 1.4)
					f.position = Vector3(cos(w) * rr, kg.height / 2.0, sin(w) * rr)
				else:
					var kb := SphereMesh.new()
					kb.radius = randf_range(0.08, 0.16)
					kb.height = kb.radius * 2.0
					f.mesh = kb
					f.material_override = Toon.farbig(Color("#B6FF7A"), 0.0, 0.9)
					f.position = Vector3(cos(w) * rr, 0.08, sin(w) * rr)
				f.set_meta("basis", f.position)
				f.set_meta("phase", randf() * TAU)
				f.add_to_group("zonen_deko")
				add_child(f)
		if art == "regen":
			# grünliche Wolke schwebt über der Stelle, giftiger Regen fällt
			var wolke := Node3D.new()
			wolke.position.y = 3.0
			add_child(wolke)
			for i in 9:
				var w := TAU * i / 9.0
				var b := MeshInstance3D.new()
				var kb := SphereMesh.new()
				kb.radius = randf_range(0.45, 0.75) * radius / 1.6
				kb.height = kb.radius * 2.0
				b.mesh = kb
				b.material_override = Toon.farbig(Color("#5F6E5A") if i % 2 else Color("#71806A"), 0.02)
				b.position = Vector3(cos(w) * radius * 0.55, randf_range(-0.15, 0.25), sin(w) * radius * 0.55)
				wolke.add_child(b)
			for i in 22:
				var d := MeshInstance3D.new()
				var tz := CylinderMesh.new()
				tz.top_radius = 0.04
				tz.bottom_radius = 0.04
				tz.height = 0.3
				d.mesh = tz
				d.material_override = Toon.farbig(Color("#9DFF6A"), 0.0, 0.9)
				var w2 := randf() * TAU
				var rr := sqrt(randf()) * radius * 0.85
				d.position = Vector3(cos(w2) * rr, randf_range(0.1, 2.7), sin(w2) * rr)
				add_child(d)
				_tropfen.append(d)
		if art == "laber":
			# einschläfernde Laber-Giftwolke: blass-lila Nebel mit "Zzz" und Mini-Sprechblasen
			for i in 12:
				var w := TAU * i / 12.0
				var b := MeshInstance3D.new()
				var kb := SphereMesh.new()
				kb.radius = randf_range(0.35, 0.6) * radius / 1.8
				kb.height = kb.radius * 2.0
				b.mesh = kb
				b.material_override = Toon.unschattiert(Color(0.78, 0.68, 0.95, 0.5), true)
				var rr := radius * randf_range(0.3, 0.85)
				b.position = Vector3(cos(w) * rr, randf_range(0.3, 1.3), sin(w) * rr)
				b.set_meta("basis", b.position)
				b.set_meta("phase", randf() * TAU)
				add_child(b)
			for i in 4:
				var l := Label3D.new()
				l.text = ["Zzz", "blah", "zzz", "yawn"][i]
				l.font = Effekte.SCHRIFT
				l.font_size = 70
				l.pixel_size = 0.008
				l.outline_size = 14
				l.modulate = Color("#E9DDFF")
				l.outline_modulate = Color("#3A2E4F")
				l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
				var w2 := TAU * i / 4.0 + 0.4
				l.position = Vector3(cos(w2) * radius * 0.5, 1.4 + i * 0.2, sin(w2) * radius * 0.5)
				l.set_meta("basis", l.position)
				l.set_meta("phase", randf() * TAU)
				add_child(l)
		if art == "co2":
			# dicke graue CO2-Wolke um den Lehrer
			for i in 16:
				var w := TAU * i / 16.0
				var b := MeshInstance3D.new()
				var kb := SphereMesh.new()
				kb.radius = randf_range(0.55, 0.95)
				kb.height = kb.radius * 2.0
				b.mesh = kb
				var g := randf_range(0.42, 0.6)
				b.material_override = Toon.unschattiert(Color(g, g, g * 1.02, 0.55), true)
				var rr := radius * randf_range(0.45, 0.95)
				b.position = Vector3(cos(w) * rr, randf_range(0.4, 2.0), sin(w) * rr)
				b.set_meta("basis", b.position)
				b.set_meta("phase", randf() * TAU)
				add_child(b)
			var schild := Label3D.new()
			schild.text = "CO₂"
			schild.font_size = 96
			schild.outline_size = 18
			schild.modulate = Color("#E6E6E6")
			schild.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			schild.position.y = 3.2
			schild.set_meta("phase", 0.0)
			add_child(schild)
		Effekte.ring(besitzer.arena, global_position, radius, farbe)

	func _physics_process(delta: float) -> void:
		_t += delta
		_tick -= delta
		if folgt != null and is_instance_valid(folgt):
			global_position = Vector3(folgt.global_position.x, 0, folgt.global_position.z)
		rotation.y += delta * (9.0 if art == "wirbel" else 0.3)
		for d in _tropfen:
			d.position.y -= delta * 7.0
			if d.position.y < 0.05:
				d.position.y = 2.7
		if art == "co2" or art == "laber":
			for b in get_children():
				if b.has_meta("basis"):
					var ph: float = b.get_meta("phase") + _t * 1.7
					b.position = b.get_meta("basis") + Vector3(0, 0.25 * sin(ph), 0)
		if (art == "regen" or art == "co2" or art == "laber") and _t > dauer - 0.5:
			scale = Vector3.ONE * maxf(0.01, (dauer - _t) * 2.0)
		if art == "feuer" or art == "gift":
			for f in get_children():
				if f.has_meta("phase"):
					var ph: float = f.get_meta("phase") + _t * (11.0 if art == "feuer" else 4.0)
					if art == "feuer":
						f.scale = Vector3(1, 0.75 + 0.35 * sin(ph), 1)
					else:
						f.position = f.get_meta("basis") + Vector3(0, fmod(ph * 0.08, 0.5), 0)
			if _t > dauer - 0.5:
				scale = Vector3.ONE * maxf(0.01, (dauer - _t) * 2.0)
		if _t > dauer or besitzer == null or not is_instance_valid(besitzer):
			queue_free()
			return
		for g in besitzer.arena.gegner_von(besitzer.team):
			var d: Vector3 = global_position - g.global_position
			d.y = 0
			if d.length() < radius:
				if art == "wirbel":
					g.zug(d.normalized() * 5.5)
				elif art == "laber":
					g.effekt_setzen("langsam", 0.8, 0.45)
					Effekte.zzz(g, 0.8)
				else:
					g.effekt_setzen("langsam", 0.3, 0.45)
		if _tick <= 0.0:
			_tick = 0.5
			var anteil := schaden_gesamt * 0.5 / dauer
			for g in besitzer.arena.gegner_von(besitzer.team):
				if g.global_position.distance_to(global_position) < radius:
					g.schaden_nehmen(anteil, besitzer, Vector3.ZERO, 0.1)   # Flächen-Ticks laden die Ulti kaum



## Snowball: rosa Comic-Schwein (Frau Osingas Verwandlung). Beine trippeln, Ringelschwanz wackelt.
class Schwein extends Node3D:
	var _beine: Array = []
	var _schwanz: Node3D
	var _koerper: Node3D
	var _t := 0.0

	func _teil(mesh: Mesh, farbe: Color, pos: Vector3, eltern: Node3D = null, linie := 0.03) -> MeshInstance3D:
		var m := MeshInstance3D.new()
		m.mesh = mesh
		m.material_override = Toon.farbig(farbe, linie)
		m.position = pos
		(eltern if eltern else _koerper).add_child(m)
		return m

	func _kugel(r: float) -> SphereMesh:
		var k := SphereMesh.new()
		k.radius = r
		k.height = r * 2.0
		return k

	func _ready() -> void:
		var rosa := Color("#FF8FBC")
		var dunkel := Color("#E8608F")
		_koerper = Node3D.new()
		add_child(_koerper)
		var bauch := _teil(_kugel(0.5), rosa, Vector3(0, 0.72, 0))
		bauch.scale = Vector3(0.95, 0.85, 1.3)
		var kopf := _teil(_kugel(0.36), rosa, Vector3(0, 0.98, 0.62))
		var ruessel := CylinderMesh.new()
		ruessel.top_radius = 0.16
		ruessel.bottom_radius = 0.18
		ruessel.height = 0.16
		var r := _teil(ruessel, dunkel, Vector3(0, 0.92, 0.98))
		r.rotation.x = PI / 2
		for sx in [-1, 1]:
			var loch := _teil(_kugel(0.035), Color("#7A2E4A"), Vector3(sx * 0.06, 0.93, 1.065), null, 0.0)
			loch.scale = Vector3(1, 1.5, 0.5)
			var auge := _teil(_kugel(0.06), Color("#1B1424"), Vector3(sx * 0.15, 1.1, 0.9), null, 0.0)
			var glanz := _teil(_kugel(0.02), Color.WHITE, Vector3(sx * 0.15 + 0.02, 1.13, 0.95), null, 0.0)
			glanz.scale = Vector3.ONE
			auge.scale = Vector3(1, 1.2, 0.8)
			var ohr := CylinderMesh.new()
			ohr.top_radius = 0.0
			ohr.bottom_radius = 0.13
			ohr.height = 0.24
			var o := _teil(ohr, dunkel, Vector3(sx * 0.22, 1.3, 0.55))
			o.rotation = Vector3(0.5, 0, sx * -0.5)
			o.scale = Vector3(1, 1, 0.45)
			var wange := _teil(_kugel(0.07), Color("#FF7FA8"), Vector3(sx * 0.24, 0.92, 0.85), null, 0.0)
			wange.scale = Vector3(1, 0.6, 0.4)
		for bx in [-1, 1]:
			for bz in [-1, 1]:
				var bein := CylinderMesh.new()
				bein.top_radius = 0.1
				bein.bottom_radius = 0.09
				bein.height = 0.42
				var b := _teil(bein, rosa, Vector3(bx * 0.26, 0.24, bz * 0.38), self)
				var huf := _teil(_kugel(0.095), Color("#8C4A5E"), Vector3(0, -0.2, 0), b, 0.02)
				huf.scale = Vector3(1, 0.6, 1)
				b.set_meta("phase", 0.0 if bx * bz > 0 else PI)
				_beine.append(b)
		_schwanz = Node3D.new()
		_schwanz.position = Vector3(0, 0.85, -0.66)
		_koerper.add_child(_schwanz)
		var t := TorusMesh.new()
		t.inner_radius = 0.06
		t.outer_radius = 0.1
		var tm := _teil(t, dunkel, Vector3(0, 0.05, -0.05), _schwanz)
		tm.rotation.x = PI / 2
		var name_l := Label3D.new()
		name_l.text = "SNOWBALL"
		name_l.font = Effekte.SCHRIFT
		name_l.font_size = 72
		name_l.pixel_size = 0.008
		name_l.outline_size = 16
		name_l.modulate = Color("#FFD1E3")
		name_l.outline_modulate = Color("#5A1E36")
		name_l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		name_l.position.y = 1.75
		add_child(name_l)
		scale = Vector3.ONE * 0.01
		create_tween().tween_property(self, "scale", Vector3.ONE * 0.8, 0.35).set_trans(Tween.TRANS_BACK)

	func _process(delta: float) -> void:
		_t += delta
		var k := get_parent() as CharacterBody3D
		var v := Vector2(k.velocity.x, k.velocity.z) if k else Vector2.ZERO
		var schnell := clampf(v.length() / 6.0, 0.0, 1.0)
		for b in _beine:
			b.rotation.x = sin(_t * 22.0 + float(b.get_meta("phase"))) * 0.7 * schnell
		_koerper.position.y = absf(sin(_t * 22.0)) * 0.08 * schnell
		_schwanz.rotation.z = sin(_t * 14.0) * 0.6
		if k and k.get("modell"):
			rotation.y = k.modell.rotation.y
