## Modus "Schule": Du läufst durch den Schulkomplex. Die Lehrer gehen ihrem Alltag nach, bis sie dich bemerken.
## Höchstens 3 greifen gleichzeitig an. Gewonnen, wenn alle Lehrer besiegt sind.
## Keine Regeneration – Leben gibt es nur durch besondere K.o.s (siehe daten/regeln.json).
class_name Schule
extends Arena

const Z := 0.5                    # Raster für die Wegfindung (m)
const WAND_H := 1.35              # Wände sind abgeschnitten (Puppenhaus-Ansicht von oben)
const WAND_D := 0.3
const BREITE := 80.0
const TIEFE := 56.0
const URSPRUNG := Vector3(-40, 0, -28)   # Plan-Koordinaten (0..80, 0..56) -> Welt

# ---------------------------------------------------------------- Raumplan (Meter, x nach rechts, z nach unten)
# typ bestimmt Möbel und Tätigkeiten. boden = Farben (a, b) und Kachelgröße.
const RAEUME := [
	{"id": "klasse_5a", "name": "Klasse 5a", "typ": "klasse", "r": [0, 0, 18, 24], "boden": ["#9CC5E8", "#8DB8DE", 1.0]},
	{"id": "klasse_7b", "name": "Klasse 7b", "typ": "klasse", "r": [18, 0, 36, 24], "boden": ["#A8D8B9", "#97CBA9", 1.0]},
	{"id": "halle", "name": "Eingangshalle", "typ": "halle", "r": [36, 0, 44, 24], "boden": ["#C9A77C", "#B8966B", 2.0]},
	{"id": "bibliothek", "name": "Bibliothek", "typ": "bibliothek", "r": [44, 0, 80, 24], "boden": ["#C99C6B", "#BE8F5D", 0.8]},
	{"id": "gang", "name": "Hauptgang", "typ": "gang", "r": [0, 24, 80, 30], "boden": ["#9FA8BC", "#8E97AC", 1.5]},
	{"id": "mensa", "name": "Mensa", "typ": "mensa", "r": [0, 30, 30, 56], "boden": ["#F2C6A0", "#EAB98E", 1.2]},
	{"id": "lehrerzimmer", "name": "Lehrerzimmer", "typ": "lehrerzimmer", "r": [30, 30, 46, 46], "boden": ["#B9A3D6", "#AD95CC", 1.0]},
	{"id": "sekretariat", "name": "Sekretariat", "typ": "sekretariat", "r": [30, 46, 46, 56], "boden": ["#F5B7C5", "#EFA6B7", 1.0]},
	{"id": "chemie", "name": "Chemieraum", "typ": "klasse", "r": [46, 30, 64, 56], "boden": ["#F0E3A0", "#E6D78E", 1.0]},
	{"id": "klasse_9c", "name": "Klasse 9c", "typ": "klasse", "r": [64, 30, 80, 56], "boden": ["#F2B5A0", "#E9A48E", 1.0]},
]
# Türöffnungen: Wand entlang x (bei z) oder entlang z (bei x), Mitte + Breite
const TUEREN := [
	{"z": 24, "mitte": 9, "breite": 2.6}, {"z": 24, "mitte": 27, "breite": 2.6},
	{"z": 24, "mitte": 40, "breite": 8.0},                                  # Halle offen zum Gang
	{"z": 24, "mitte": 52, "breite": 3.0}, {"z": 24, "mitte": 72, "breite": 3.0},
	{"z": 30, "mitte": 8, "breite": 3.6}, {"z": 30, "mitte": 22, "breite": 3.6},
	{"z": 30, "mitte": 38, "breite": 2.6}, {"z": 46, "mitte": 38, "breite": 2.4},
	{"z": 30, "mitte": 55, "breite": 2.6}, {"z": 30, "mitte": 72, "breite": 2.6},
	{"z": 0, "mitte": 40, "breite": 4.0},                                   # Haupteingang (außen, Spielerstart)
]

var regeln := {}
var lehrer_liste: Array = []
var lehrer_gesamt := 0
var angreifer: Array = []
var _plaetze: Array = []          # Aktivitätsplätze: {pos, blick, anim, raum, min, max, belegt}
var _moebel: Node
var _letzter_ko_zeit := -99.0
var _start_zeit := 0.0
var _aktueller_raum := ""
var _leben_uebrig := 1
var _beute: Array = []


func _ready() -> void:
	randomize()
	var r = JSON.parse_string(FileAccess.get_file_as_string("res://daten/regeln.json"))
	regeln = r.get("schule", {}) if typeof(r) == TYPE_DICTIONARY else {}
	_leben_uebrig = int(regeln.get("leben", 1))
	breite = int(BREITE / Z)
	hoehe = int(TIEFE / Z)
	_astar.region = Rect2i(0, 0, breite, hoehe)
	_astar.cell_size = Vector2.ONE
	_astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	_astar.update()
	_moebel = (load("res://schule/moebel.glb") as PackedScene).instantiate()
	_umgebung_schule()
	_raeume_bauen()
	_kamera_bauen()
	_spieler_erzeugen()
	_lehrer_erzeugen()
	hud = Hud.new()
	hud.arena = self
	hud.modus = "schule"
	add_child(hud)
	_ziel_anzeige_bauen()
	_start()


# ---------------------------------------------------------------- Koordinaten
func plan(x: float, z: float) -> Vector3:
	return URSPRUNG + Vector3(x, 0, z)


func kachel_von(p: Vector3) -> Vector2i:
	var q := p - URSPRUNG
	return Vector2i(floori(q.x / Z), floori(q.z / Z))


func kachel_mitte(c: int, r: int) -> Vector3:
	return URSPRUNG + Vector3((c + 0.5) * Z, 0, (r + 0.5) * Z)


func halb_groesse() -> Vector2:
	return Vector2(BREITE / 2.0, TIEFE / 2.0)


func ist_busch(_p: Vector3) -> bool:
	return false


func raum_bei(p: Vector3) -> Dictionary:
	var q := p - URSPRUNG
	for r in RAEUME:
		var a: Array = r["r"]
		if q.x >= a[0] and q.x < a[2] and q.z >= a[1] and q.z < a[3]:
			return r
	return {}


func _sperren(mitte: Vector3, groesse: Vector3, drehung := 0.0, rand := 0.25) -> void:
	## markiert ein (gedrehtes) Rechteck als unbegehbar für die Wegfindung
	var halb := Vector2(groesse.x, groesse.z) * 0.5 + Vector2(rand, rand)
	var ecken := []
	for sx in [-1, 1]:
		for sz in [-1, 1]:
			ecken.append(mitte + Vector3(sx * halb.x, 0, sz * halb.y).rotated(Vector3.UP, drehung))
	var mn := Vector3(1e9, 0, 1e9)
	var mx := Vector3(-1e9, 0, -1e9)
	for e in ecken:
		mn = Vector3(minf(mn.x, e.x), 0, minf(mn.z, e.z))
		mx = Vector3(maxf(mx.x, e.x), 0, maxf(mx.z, e.z))
	var a := kachel_von(mn)
	var b := kachel_von(mx)
	for c in range(a.x, b.x + 1):
		for r in range(a.y, b.y + 1):
			if _astar.region.has_point(Vector2i(c, r)):
				_astar.set_point_solid(Vector2i(c, r), true)


# ---------------------------------------------------------------- Umgebung, Wände, Böden
func _umgebung_schule() -> void:
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#8FD3FF")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#C4BEF0")
	env.ambient_light_energy = 0.65
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	env.glow_enabled = true
	env.glow_intensity = 0.3
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.1
	we.environment = env
	add_child(we)
	var sonne := DirectionalLight3D.new()
	sonne.rotation_degrees = Vector3(-62, -28, 0)
	sonne.light_color = Color("#FFF4E0")
	sonne.light_energy = 1.2
	sonne.shadow_enabled = true
	sonne.shadow_opacity = 0.7
	sonne.directional_shadow_max_distance = 40.0
	add_child(sonne)
	# Rasen um das Gebäude
	var rasen := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(220, 200)
	rasen.mesh = pm
	rasen.position.y = -0.02
	var bm := ShaderMaterial.new()
	bm.shader = preload("res://shader/boden.gdshader")
	bm.set_shader_parameter("kachel", 2.0)
	bm.set_shader_parameter("halb_groesse", Vector2(1000, 1000))
	rasen.material_override = bm
	add_child(rasen)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in 60:
		var p := Vector3(rng.randf_range(-70, 70), 0, rng.randf_range(-55, 55))
		if absf(p.x) < BREITE / 2 + 3 and absf(p.z) < TIEFE / 2 + 3:
			continue
		if absf(p.x) < 4 and p.z < 0:
			continue  # Weg zum Eingang frei
		_setze("Baum" if rng.randf() < 0.7 else "Fels", p, rng.randf() * TAU, rng.randf_range(0.9, 1.5))


func _raeume_bauen() -> void:
	var boden_shader := preload("res://shader/raumboden.gdshader")
	for r in RAEUME:
		var a: Array = r["r"]
		var b := MeshInstance3D.new()
		var box := BoxMesh.new()
		box.size = Vector3(a[2] - a[0], 0.08, a[3] - a[1])
		b.mesh = box
		var m := ShaderMaterial.new()
		m.shader = boden_shader
		m.set_shader_parameter("farbe_a", Color.html(r["boden"][0]))
		m.set_shader_parameter("farbe_b", Color.html(r["boden"][1]))
		m.set_shader_parameter("kachel", float(r["boden"][2]))
		b.material_override = m
		add_child(b)
		b.position = plan((a[0] + a[2]) / 2.0, (a[1] + a[3]) / 2.0) + Vector3(0, -0.035, 0)
		# Raumname auf dem Boden
		var schild := Label3D.new()
		schild.text = str(r["name"]).to_upper()
		schild.font = Effekte.SCHRIFT
		schild.font_size = 160
		schild.pixel_size = 0.01
		schild.modulate = Color(1, 1, 1, 0.35)
		schild.outline_size = 0
		schild.rotation_degrees = Vector3(-90, 0, 0)
		add_child(schild)
		schild.position = plan((a[0] + a[2]) / 2.0, (a[1] + a[3]) / 2.0) + Vector3(0, 0.02, 0)
		if r["typ"] == "gang":
			schild.position = plan(20, 27) + Vector3(0, 0.02, 0)
	_waende_bauen()
	for r in RAEUME:
		_moeblieren(r)


func _waende_bauen() -> void:
	# alle Raumkanten sammeln, gleiche Linien zusammenfassen, Türen herausschneiden
	var linien := {}   # "x@z" oder "z@x" -> Array von [von, bis]
	for r in RAEUME:
		var a: Array = r["r"]
		for kante in [["x", a[1], a[0], a[2]], ["x", a[3], a[0], a[2]], ["z", a[0], a[1], a[3]], ["z", a[2], a[1], a[3]]]:
			var schl := "%s@%s" % [kante[0], kante[1]]
			if not linien.has(schl):
				linien[schl] = []
			linien[schl].append([float(kante[2]), float(kante[3])])
	var innen := Toon.farbig(Color("#F6EEDF"), 0.02)
	var aussen := Toon.farbig(Color("#E9A86B"), 0.02)
	var kappe := Toon.farbig(Color("#3A2E4F"), 0.0)
	for schl in linien:
		var teile: Array = schl.split("@")
		var achse: String = teile[0]
		var lage := float(teile[1])
		var stuecke := _zusammenfassen(linien[schl])
		for t in TUEREN:
			if (achse == "x" and t.has("z") and float(t["z"]) == lage):
				stuecke = _ausschneiden(stuecke, float(t["mitte"]) - float(t["breite"]) / 2.0, float(t["mitte"]) + float(t["breite"]) / 2.0)
		var aussenwand := (achse == "x" and (lage == 0.0 or lage == TIEFE)) or (achse == "z" and (lage == 0.0 or lage == BREITE))
		for s in stuecke:
			var laenge: float = s[1] - s[0]
			if laenge < 0.05:
				continue
			var mitte_plan := Vector2((s[0] + s[1]) / 2.0, lage) if achse == "x" else Vector2(lage, (s[0] + s[1]) / 2.0)
			var groesse := Vector3(laenge + WAND_D, WAND_H, WAND_D) if achse == "x" else Vector3(WAND_D, WAND_H, laenge + WAND_D)
			var pos := plan(mitte_plan.x, mitte_plan.y) + Vector3(0, WAND_H / 2.0, 0)
			var w := MeshInstance3D.new()
			var bx := BoxMesh.new()
			bx.size = groesse
			w.mesh = bx
			w.material_override = aussen if aussenwand else innen
			add_child(w)
			w.position = pos
			# dunkle Schnittkante oben (Comic-Puppenhaus-Look)
			var k := MeshInstance3D.new()
			var kb := BoxMesh.new()
			kb.size = Vector3(groesse.x + 0.02, 0.06, groesse.z + 0.02)
			k.mesh = kb
			k.material_override = kappe
			add_child(k)
			k.position = pos + Vector3(0, WAND_H / 2.0 + 0.03, 0)
			_kollision(pos, Vector3(groesse.x, 2.0, groesse.z), 1)
			_sperren(pos, Vector3(groesse.x, 1, groesse.z), 0.0, 0.05)
			if aussenwand:
				_fenster(achse, lage, s)


func _fenster(achse: String, lage: float, s: Array) -> void:
	var glas := Toon.farbig(Color("#A8E1FF"), 0.02, 0.15)
	var x: float = s[0] + 2.0
	while x < s[1] - 1.5:
		var f := MeshInstance3D.new()
		var b := BoxMesh.new()
		b.size = Vector3(1.6, 0.55, WAND_D + 0.06) if achse == "x" else Vector3(WAND_D + 0.06, 0.55, 1.6)
		f.mesh = b
		f.material_override = glas
		add_child(f)
		f.position = (plan(x, lage) if achse == "x" else plan(lage, x)) + Vector3(0, 0.95, 0)
		x += 4.0


func _zusammenfassen(st: Array) -> Array:
	st.sort_custom(func(a, b): return a[0] < b[0])
	var out: Array = []
	for s in st:
		if out.size() > 0 and s[0] <= out[-1][1] + 0.01:
			out[-1][1] = maxf(out[-1][1], s[1])
		else:
			out.append([s[0], s[1]])
	return out


func _ausschneiden(st: Array, von: float, bis: float) -> Array:
	var out: Array = []
	for s in st:
		if bis <= s[0] or von >= s[1]:
			out.append(s)
			continue
		if von > s[0]:
			out.append([s[0], von])
		if bis < s[1]:
			out.append([bis, s[1]])
	return out


# ---------------------------------------------------------------- Möbel
func _moebel_setzen(name: String, x: float, z: float, drehung := 0.0, kollision := true) -> MeshInstance3D:
	var v: MeshInstance3D = _moebel.get_node_or_null(name)
	if v == null:
		push_warning("Möbel fehlt: " + name)
		return null
	if not v.has_meta("toon"):
		v.transform = Transform3D.IDENTITY
		Toon.anwenden(v, 0.015)
		v.set_meta("toon", true)
	var m: MeshInstance3D = v.duplicate()
	add_child(m)
	m.position = plan(x, z)
	m.rotation.y = drehung
	if kollision:
		var box: AABB = v.get_aabb()
		var mitte := m.position + (box.get_center() * Vector3(1, 0, 1)).rotated(Vector3.UP, drehung)
		var groesse := Vector3(box.size.x, 1.6, box.size.z)
		var sb := StaticBody3D.new()
		sb.collision_layer = 1
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = groesse
		cs.shape = bs
		sb.add_child(cs)
		add_child(sb)
		sb.position = mitte + Vector3(0, 0.8, 0)
		sb.rotation.y = drehung
		_sperren(mitte, groesse, drehung)
	return m


func _platz(x: float, z: float, blick: Vector3, anim: String, raum: String, minimum := 6.0, maximum := 15.0) -> void:
	_plaetze.append({"pos": plan(x, z), "blick": blick, "anim": anim, "raum": raum, "min": minimum, "max": maximum, "belegt": null})


func _moeblieren(r: Dictionary) -> void:
	var a: Array = r["r"]
	var x0: float = a[0]
	var z0: float = a[1]
	var x1: float = a[2]
	var z1: float = a[3]
	var w := x1 - x0
	var id: String = r["id"]
	var N := Vector3(0, 0, -1)
	var S := Vector3(0, 0, 1)
	var O := Vector3(1, 0, 0)
	var W := Vector3(-1, 0, 0)
	match r["typ"]:
		"klasse":
			var mx := (x0 + x1) / 2.0
			_moebel_setzen("Tafel", mx, z0 + 0.25)
			_moebel_setzen("Lehrerpult", mx, z0 + 2.6, PI)
			_moebel_setzen("Stuhl", mx - 0.3, z0 + 1.7, 0.0, false)
			_platz(mx - 0.3, z0 + 1.7, S, "Sit", id, 8, 18)                 # am Pult sitzen
			_platz(mx - 0.8, z0 + 1.0, N, "Talk", id, 6, 12)                # an die Tafel schreiben
			_platz(mx + 1.0, z0 + 3.6, S, "Talk", id, 6, 14)                # vor der Klasse reden
			var spalten := int((w - 3.0) / 3.0)
			for c in spalten:
				for rr in 4:
					var bx := x0 + 2.2 + c * ((w - 4.4) / maxf(spalten - 1, 1))
					var bz := z0 + 6.5 + rr * 3.6
					_moebel_setzen("Schulbank", bx, bz, PI)
					_moebel_setzen("Stuhl", bx, bz + 0.75, PI, false)
				_platz(x0 + 2.2 + c * ((w - 4.4) / maxf(spalten - 1, 1)) + 0.9, z0 + 9.0, W, "", id, 4, 8)  # durch die Reihen gehen
			_moebel_setzen("Buecherregal", x1 - 0.4, z0 + 12, -PI / 2)
			_platz(x1 - 1.3, z0 + 12, O, "Read", id, 6, 12)
			_moebel_setzen("Pflanze", x0 + 0.8, z0 + 0.8)
			_moebel_setzen("Pflanze", x1 - 0.8, z1 - 0.8)
			_moebel_setzen("Muelleimer", x0 + 0.7, z1 - 0.7)
			if id == "chemie":
				_moebel_setzen("Kopierer", x0 + 1.0, z0 + 3.5, PI / 2)
		"bibliothek":
			for reihe in 3:
				for spalte in 5:
					var bx := x0 + 4 + spalte * 3.2
					var bz := z0 + 3.5 + reihe * 4.6
					_moebel_setzen("Buecherregal", bx, bz)
					_moebel_setzen("Buecherregal", bx, bz + 0.5, PI)
					if (reihe + spalte) % 2 == 0:
						_platz(bx, bz + 1.6, N, "Read", id, 6, 14)
			for i in 3:
				var tx := x0 + 23 + (i % 2) * 6
				var tz := z0 + 4 + i * 6
				_moebel_setzen("Lesetisch", tx, tz)
				_moebel_setzen("Stuhl", tx, tz + 1.1, PI, false)
				_moebel_setzen("Stuhl", tx - 1.1, tz, PI / 2, false)
				_platz(tx, tz + 1.1, N, "Sit", id, 8, 18)
			_moebel_setzen("Lehrerpult", x1 - 4, z1 - 2.5, PI)      # Ausleihe
			_platz(x1 - 4, z1 - 3.4, S, "Talk", id, 6, 14)
			_moebel_setzen("Sitzsack", x1 - 2, z0 + 2, 0.0, false)
			_moebel_setzen("Sitzsack", x1 - 3.5, z0 + 1.6, 0.5, false)
			_moebel_setzen("Pflanze", x0 + 1, z1 - 1)
			_moebel_setzen("Pflanze", x1 - 1, z0 + 5)
		"mensa":
			_moebel_setzen("Theke", x0 + 1.0, (z0 + z1) / 2.0, PI / 2)
			_platz(x0 + 0.6, (z0 + z1) / 2.0 - 1.0, O, "Talk", id, 8, 16)   # Essensausgabe
			_platz(x0 + 0.6, (z0 + z1) / 2.0 + 1.2, O, "", id, 6, 12)
			for rr in 4:
				for c in 3:
					var tx := x0 + 7 + c * 7.5
					var tz := z0 + 4 + rr * 5.5
					_moebel_setzen("Mensatisch", tx, tz)
					_moebel_setzen("Bank", tx, tz - 0.9, 0.0, false)
					_moebel_setzen("Bank", tx, tz + 0.9, 0.0, false)
					if (rr + c) % 2 == 0:
						_platz(tx - 0.8, tz - 0.9, S, "Sit", id, 10, 20)
			_moebel_setzen("Getraenkeautomat", x1 - 1.0, z0 + 1.5, -PI / 2)
			_platz(x1 - 2.2, z0 + 1.5, O, "", id, 4, 8)
			_moebel_setzen("Muelleimer", x1 - 1.0, z1 - 1.0)
			_moebel_setzen("Pflanze", x0 + 1.0, z1 - 1.0)
		"lehrerzimmer":
			var mx2 := (x0 + x1) / 2.0
			var mz2 := (z0 + z1) / 2.0 + 0.5
			_moebel_setzen("Konferenztisch", mx2, mz2)
			for i in 3:
				_moebel_setzen("Stuhl", mx2 - 1.1 + i * 1.1, mz2 - 1.05, 0.0, false)
				_moebel_setzen("Stuhl", mx2 - 1.1 + i * 1.1, mz2 + 1.05, PI, false)
			_platz(mx2 - 1.1, mz2 - 1.05, S, "Sit", id, 10, 20)
			_platz(mx2 + 1.1, mz2 + 1.05, N, "Sit", id, 10, 20)
			_moebel_setzen("Kuechenzeile", x1 - 0.5, z0 + 4, -PI / 2)
			_platz(x1 - 1.4, z0 + 3.5, O, "Talk", id, 6, 12)                 # Kaffee
			_moebel_setzen("Sofa", x0 + 0.8, z1 - 3.5, PI / 2)
			_platz(x0 + 1.0, z1 - 3.5, O, "Sit", id, 10, 20)
			_moebel_setzen("Kopierer", x0 + 1.0, z0 + 1.5, PI / 2)
			_platz(x0 + 2.0, z0 + 1.5, W, "", id, 5, 10)
			_moebel_setzen("Pflanze", x1 - 0.8, z1 - 0.8)
			_moebel_setzen("Pinnwand", (x0 + x1) / 2.0 + 3, z0 + 0.25)
		"sekretariat":
			var mx3 := (x0 + x1) / 2.0
			_moebel_setzen("Lehrerpult", mx3, z0 + 5.5)
			_moebel_setzen("Stuhl", mx3 + 0.3, z0 + 6.4, PI, false)
			_platz(mx3 + 0.3, z0 + 6.4, N, "Sit", id, 10, 20)
			_moebel_setzen("Kopierer", x1 - 1.0, z1 - 1.5, -PI / 2)
			_platz(x1 - 2.0, z1 - 1.5, O, "", id, 5, 10)
			_moebel_setzen("Buecherregal", x0 + 0.4, z0 + 5, PI / 2)
			_moebel_setzen("Pflanze", x0 + 0.8, z1 - 0.8)
		"gang":
			var x := x0 + 1.5
			while x < x1 - 2:
				var frei := true
				for t in TUEREN:
					if absf(float(t["mitte"]) - x) < float(t["breite"]) / 2.0 + 1.2:
						frei = false
				if frei:
					if int(x) % 7 < 4:
						_moebel_setzen("Spinde", x + 0.8, z0 + 0.45)
					else:
						_moebel_setzen("Bank", x + 0.8, z1 - 0.45)
				x += 3.4
			for px in [6.0, 18.0, 33.0, 46.0, 62.0, 76.0]:
				_platz(px, (z0 + z1) / 2.0, N, "", id, 2, 5)     # Gang-Aufsicht: auf und ab gehen
			_moebel_setzen("Pinnwand", 33.0, z1 - 0.2, PI)
			_platz(33.0, z1 - 1.3, S, "Read", id, 5, 10)
			_moebel_setzen("Pflanze", x0 + 0.8, (z0 + z1) / 2.0)
			_moebel_setzen("Pflanze", x1 - 0.8, (z0 + z1) / 2.0)
		"halle":
			_moebel_setzen("Pinnwand", x0 + 0.2, z0 + 8, PI / 2)
			_moebel_setzen("Pinnwand", x1 - 0.2, z0 + 14, -PI / 2)
			_moebel_setzen("Getraenkeautomat", x1 - 0.8, z0 + 4, -PI / 2)
			_moebel_setzen("Pflanze", x0 + 0.8, z0 + 1.0)
			_moebel_setzen("Pflanze", x1 - 0.8, z0 + 1.0)
			_moebel_setzen("Bank", x0 + 0.5, z0 + 18, PI / 2, false)
			_platz(x0 + 1.3, z0 + 8, W, "Read", id, 5, 10)


# ---------------------------------------------------------------- Aktivitäten
func aktivitaet_waehlen(l: Lehrer) -> Dictionary:
	var frei := _plaetze.filter(func(p): return p["belegt"] == null)
	if frei.is_empty():
		return {"pos": l.global_position + Vector3(randf_range(-3, 3), 0, randf_range(-3, 3)), "blick": Vector3.ZERO, "anim": "", "min": 2, "max": 4}
	# meistens im eigenen Raum bleiben, manchmal woanders hin (Gang, Mensa, Lehrerzimmer …)
	var eigene := frei.filter(func(p): return l.raum_wahl.has(p["raum"]) or l.raum_wahl.has(_raumtyp(p["raum"])))
	var auswahl := eigene if eigene.size() > 0 and randf() < 0.75 else frei
	# nahe Plätze bevorzugen (natürlicher)
	auswahl.sort_custom(func(a, b): return a["pos"].distance_to(l.global_position) + randf() * 25.0 < b["pos"].distance_to(l.global_position) + randf() * 25.0)
	var p: Dictionary = auswahl[mini(randi() % 3, auswahl.size() - 1)]
	p["belegt"] = l
	return p


func _raumtyp(id: String) -> String:
	for r in RAEUME:
		if r["id"] == id:
			return r["typ"]
	return ""


func platz_belegen(p: Dictionary, l: Lehrer) -> void:
	p["belegt"] = l


func platz_freigeben(p: Dictionary) -> void:
	if p.has("belegt"):
		p["belegt"] = null


# ---------------------------------------------------------------- Spieler & Lehrer
func _spieler_erzeugen() -> void:
	var d: Dictionary = Daten.gewaehlt()
	var k := Kaempfer.new()
	k.name = "Spieler"
	add_child(k)
	var id: String = d.get("id", "")
	k.einrichten(d, 0, true, self, Konto.stufe(id), Konto.gewaehlt_gadget(id), Konto.gewaehlt_passiv(id))
	k.regeneration = false
	k.spawn_punkt = plan(40, 2.5)
	k.global_position = k.spawn_punkt
	k.blick = Vector3(0, 0, 1)
	k.ausgeschaltet.connect(_bei_ko)
	kaempfer.append(k)
	spieler = k


func _lehrer_erzeugen() -> void:
	var vorlagen: Array = Daten.lehrer
	if vorlagen.is_empty():
		push_warning("Keine Lehrer in res://lehrer gefunden")
		return
	var stufe := Konto.stufe(spieler.daten.get("id", ""))
	for v in vorlagen:
		var info: Dictionary = v.get("lehrer", {})
		for n in int(info.get("anzahl", 1)):
			var l := Lehrer.new()
			l.name = "%s_%d" % [v["id"], n]
			add_child(l)
			l.einrichten(v, 1, false, self, stufe, randi() % 4, randi() % 4)
			l.lehrer_einrichten(info)
			l.regeneration = false
			# Startplatz: freier Aktivitätsplatz in einem passenden Raum, weit genug vom Eingang
			var p := aktivitaet_waehlen(l)
			var start: Vector3 = p["pos"]
			if start.distance_to(spieler.global_position) < 14.0:
				platz_freigeben(p)
				p = aktivitaet_waehlen(l)
				start = p["pos"]
			platz_freigeben(p)
			l.global_position = freier_punkt(start + Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)))
			l.spawn_punkt = l.global_position
			l.modell.rotation.y = randf() * TAU
			l.ausgeschaltet.connect(_bei_ko)
			kaempfer.append(l)
			lehrer_liste.append(l)
	lehrer_gesamt = lehrer_liste.size()


func gegner_von(t: int) -> Array:
	return kaempfer.filter(func(k): return k.team != t and not k.tot)


func lehrer_uebrig() -> int:
	return lehrer_liste.filter(func(l): return not l.tot).size()


# ---------------------------------------------------------------- Max. 3 Angreifer
func angriff_anmelden(l: Lehrer) -> bool:
	angreifer = angreifer.filter(func(a): return is_instance_valid(a) and not a.tot and a.zustand in ["alarm", "angriff"])
	if l in angreifer:
		return true
	if angreifer.size() < int(regeln.get("max_angreifer", 3)):
		angreifer.append(l)
		return true
	return false


func angriff_abmelden(l: Lehrer) -> void:
	angreifer.erase(l)


func laerm(quelle: Kaempfer, pos: Vector3, reichweite: float) -> void:
	if quelle != spieler:
		return
	for l in lehrer_liste:
		if not l.tot:
			l.hoeren(pos, reichweite)


func vorruecken_punkt(_team: int) -> Vector3:
	return spieler.global_position if spieler else Vector3.ZERO


func sichtbar_fuer(ziel: Kaempfer, betrachter: Kaempfer) -> bool:
	if ziel.team == betrachter.team:
		return true
	if ziel.ist_unsichtbar():
		return ziel.global_position.distance_to(betrachter.global_position) < 1.8
	return true


## Heilung nur für Lehrer und über besondere K.o.s (dann mit erzwingen=true)
func heilung_erlaubt(k: Kaempfer) -> bool:
	return k != spieler


# ---------------------------------------------------------------- Ablauf
func _start() -> void:
	laeuft = false
	_start_zeit = Time.get_ticks_msec() / 1000.0
	for k in kaempfer:
		k.set_physics_process(false)
	hud.gross_text("BESIEGE ALLE %d LEHRER!" % lehrer_gesamt, 2.2)
	await get_tree().create_timer(1.6).timeout
	for k in kaempfer:
		k.set_physics_process(true)
	laeuft = true


func _process(delta: float) -> void:
	if laeuft:
		restzeit = Time.get_ticks_msec() / 1000.0 - _start_zeit   # hier: gespielte Zeit
	_spieler_steuern()
	_kamera_folgen(delta)
	if spieler and not spieler.tot:
		var r := raum_bei(spieler.global_position)
		var name: String = r.get("name", "")
		if name != _aktueller_raum and name != "":
			_aktueller_raum = name
			hud.raum_anzeigen(name)
		for b in _beute.duplicate():
			if not is_instance_valid(b):
				_beute.erase(b)
				continue
			if b.global_position.distance_to(spieler.global_position) < 1.2:
				spieler.heilen(spieler.max_leben * float(b.get_meta("menge")), true)
				Effekte.zahl(self, spieler.global_position + Vector3(0, 2.4, 0), int(spieler.max_leben * float(b.get_meta("menge"))), true)
				Effekte.puff(self, b.global_position, Color("#7CFF5B"))
				ton("super")
				_beute.erase(b)
				b.queue_free()


func _bei_ko(opfer: Kaempfer, taeter: Kaempfer) -> void:
	if vorbei:
		return
	if opfer == spieler:
		_leben_uebrig -= 1
		if _leben_uebrig <= 0:
			_ende_schule(false)
			return
		hud.gross_text("NOCH %d LEBEN" % _leben_uebrig, 1.5)
		for l in lehrer_liste:
			if not l.tot and l.zustand != "alltag":
				l.verdacht = 0.0
				l._zu("alltag")
		await get_tree().create_timer(3.0).timeout
		spieler.wiederbeleben(spieler.spawn_punkt)
		return
	# Lehrer besiegt
	hud.meldung(opfer, taeter)
	if taeter == spieler:
		spieler.ko_zaehler += 1
		_heil_kills(opfer)
	var l: Lehrer = opfer
	if l.beute_heilung > 0.0:
		_beute_fallen_lassen(opfer.global_position, l.beute_heilung)
	if lehrer_uebrig() == 0:
		_ende_schule(true)


## Besondere K.o.s, die heilen (Werte in daten/regeln.json)
func _heil_kills(opfer: Kaempfer) -> void:
	var t := Time.get_ticks_msec() / 1000.0
	var gruende: Array = []
	var menge := 0.0
	if spieler.zeit() - spieler.letzter_super < 3.0:
		menge += float(regeln.get("heilung_super_ko", 0.3))
		gruende.append("SUPER-K.O.")
	if t - _letzter_ko_zeit < float(regeln.get("doppel_ko_fenster", 4.0)):
		menge += float(regeln.get("heilung_doppel_ko", 0.35))
		gruende.append("DOPPEL-K.O.")
	var l: Lehrer = opfer
	if l.zustand in ["alltag", "misstrauisch"] or l.zeit() - l._zustand_seit < 1.2 and l.zustand == "alarm":
		menge += float(regeln.get("heilung_ueberraschungs_ko", 0.25))
		gruende.append("ÜBERRASCHUNGS-K.O.")
	_letzter_ko_zeit = t
	if menge > 0.0:
		var vorher := spieler.leben
		spieler.heilen(spieler.max_leben * menge, true)
		hud.gross_text("%s  +%d ❤" % [" + ".join(gruende), int(spieler.leben - vorher)], 1.4)
		Effekte.puff(self, spieler.global_position + Vector3(0, 1, 0), Color("#7CFF5B"))


func _beute_fallen_lassen(pos: Vector3, menge: float) -> void:
	var b := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = 0.28
	s.height = 0.4
	b.mesh = s
	b.material_override = Toon.farbig(Color("#7CFF5B"), 0.02, 0.6)
	b.set_meta("menge", menge)
	add_child(b)
	b.global_position = pos + Vector3(0, 0.5, 0)
	var l := Label3D.new()
	l.text = "+"
	l.font = Effekte.SCHRIFT
	l.font_size = 120
	l.outline_size = 20
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.pixel_size = 0.004
	l.position.y = 0.45
	b.add_child(l)
	var tw := b.create_tween().set_loops()
	tw.tween_property(b, "position:y", 0.8, 0.6).set_trans(Tween.TRANS_SINE)
	tw.tween_property(b, "position:y", 0.5, 0.6).set_trans(Tween.TRANS_SINE)
	_beute.append(b)


func _ende_schule(sieg: bool) -> void:
	if vorbei:
		return
	vorbei = true
	laeuft = false
	var verdient := Konto.match_belohnung(1 if sieg else -1, spieler.ko_zaehler)
	for k in kaempfer:
		k.bewegung = Vector3.ZERO
		k.set_physics_process(false)
	_ziel_anzeige.visible = false
	_ziel_kreis.visible = false
	if spieler.tot:
		spieler.wiederbeleben(spieler.global_position)
		spieler.set_physics_process(false)
	spieler.modell.rotation.y = 0.0
	if sieg:
		spieler.jubeln()
	else:
		spieler.stehen_bleiben()
	ton("sieg" if sieg else "ko")
	hud.ende(1 if sieg else -1, verdient)
