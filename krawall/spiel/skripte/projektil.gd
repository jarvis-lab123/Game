## Geradeaus fliegendes Geschoss oder Wurfgeschoss (Bogen, explodiert am Ziel).
class_name Projektil
extends Node3D

var quelle: Kaempfer
var arena: Node3D
var team := 0
var richtung := Vector3.FORWARD
var tempo := 16.0
var rest := 8.0
var schaden := 400.0
var farbe := Color.YELLOW
var radius := 0.22
var text := ""                   # z. B. eine Formel: wird statt der Kugel als fliegender Schriftzug gezeigt
var modell := ""                 # "schnecke", "kamera" … statt Kugel
var effekt := {}                 # z. B. {"dauer": 1.5, "faktor": 0.6} = verlangsamt Getroffene
var _drehung := Vector3.ZERO

# Wurf
var ist_wurf := false
var start := Vector3.ZERO
var ziel := Vector3.ZERO
var dauer := 0.8
var _t := 0.0
var explosions_radius := 1.4
var zerstoert_waende := false


func _ready() -> void:
	if text != "":
		var l := Label3D.new()
		l.text = text
		l.font = Effekte.SCHRIFT
		l.font_size = 110
		l.pixel_size = 0.0075
		l.outline_size = 22
		l.modulate = farbe
		l.outline_modulate = Color("#1B1424")
		l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		l.no_depth_test = false
		add_child(l)
		var tw := l.create_tween().set_loops()
		tw.tween_property(l, "scale", Vector3.ONE * 1.15, 0.12)
		tw.tween_property(l, "scale", Vector3.ONE * 0.9, 0.12)
		return
	if modell != "":
		var form := _modell_bauen(modell)
		add_child(form)
		_drehung = Vector3(randf_range(6, 10), randf_range(-4, 4), 0)
		if not ist_wurf and richtung.length() > 0.01:
			look_at(global_position + richtung, Vector3.UP)
		return
	var m := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = radius
	s.height = radius * 2.0
	s.radial_segments = 16
	s.rings = 8
	m.mesh = s
	m.material_override = Toon.farbig(farbe, 0.03, 0.6)
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	add_child(m)
	if not ist_wurf:
		m.scale = Vector3(1, 1, 1.6)
		if richtung.length() > 0.01:
			look_at(global_position + richtung, Vector3.UP)
	else:
		m.scale = Vector3.ONE * 1.5


func _physics_process(delta: float) -> void:
	if ist_wurf:
		_t += delta
		var f := clampf(_t / dauer, 0.0, 1.0)
		var p := start.lerp(ziel, f)
		p.y = lerpf(start.y, 0.3, f) + sin(f * PI) * 3.0
		global_position = p
		rotation.x += delta * 10.0
		if f >= 1.0:
			arena.explosion(quelle, team, ziel, explosions_radius, schaden, farbe, zerstoert_waende, effekt)
			queue_free()
		return
	if _drehung != Vector3.ZERO and get_child_count() > 0:
		get_child(0).rotation += _drehung * delta
	var schritt := richtung * tempo * delta
	var von := global_position
	var nach := von + schritt
	# Wände (Ebene 1)
	var q := PhysicsRayQueryParameters3D.create(von, nach + richtung * radius, 1)
	var treffer := get_world_3d().direct_space_state.intersect_ray(q)
	if treffer:
		Effekte.treffer(arena, treffer.position, farbe)
		queue_free()
		return
	# Kämpfer
	for k in arena.gegner_von(team):
		var p: Vector3 = k.global_position + Vector3(0, 1.0, 0)
		var naechster := Geometry3D.get_closest_point_to_segment(p, von, nach)
		var d := Vector2(naechster.x - p.x, naechster.z - p.z).length()
		if d < radius + k.trefferradius():
			k.schaden_nehmen(schaden, quelle, richtung * 2.0)
			if effekt.has("dauer"):
				k.effekt_setzen("langsam", float(effekt["dauer"]), float(effekt.get("faktor", 0.6)))
			if modell == "kamera":
				Effekte.blitzlicht(arena, naechster)
			Effekte.treffer(arena, naechster, farbe)
			Arena.ton("treffer")
			queue_free()
			return
	global_position = nach
	rest -= schritt.length()
	if rest <= 0.0:
		Effekte.treffer(arena, global_position, farbe.darkened(0.2))
		queue_free()



func _teil(form: Node3D, mesh: Mesh, farbe: Color, pos: Vector3, skala := Vector3.ONE) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	m.mesh = mesh
	m.material_override = Toon.farbig(farbe, 0.015)
	m.position = pos
	m.scale = skala
	form.add_child(m)
	return m


func _kugel(r: float) -> SphereMesh:
	var k := SphereMesh.new()
	k.radius = r
	k.height = r * 2.0
	k.radial_segments = 14
	k.rings = 7
	return k


## Kleine 3D-Geschosse aus Grundformen
func _modell_bauen(art: String) -> Node3D:
	var form := Node3D.new()
	match art:
		"schnecke":
			_teil(form, _kugel(0.2), Color("#A0522D"), Vector3(0, 0.12, 0.02))
			var spirale := TorusMesh.new()
			spirale.inner_radius = 0.08
			spirale.outer_radius = 0.13
			var sp := _teil(form, spirale, Color("#E9C46A"), Vector3(0.11, 0.12, 0.02))
			sp.rotation.z = PI / 2
			var koerper := CapsuleMesh.new()
			koerper.radius = 0.08
			koerper.height = 0.5
			var k := _teil(form, koerper, Color("#E8D28A"), Vector3(0, -0.02, 0.05))
			k.rotation.x = PI / 2
			for sx in [-1, 1]:
				var f := _teil(form, _kugel(0.035), Color("#E8D28A"), Vector3(sx * 0.05, 0.12, 0.3))
				f.scale = Vector3(1, 2.2, 1)
		"kamera":
			var box := BoxMesh.new()
			box.size = Vector3(0.36, 0.24, 0.2)
			_teil(form, box, Color("#2A2140"), Vector3.ZERO)
			var obj := CylinderMesh.new()
			obj.top_radius = 0.09
			obj.bottom_radius = 0.1
			obj.height = 0.16
			var o := _teil(form, obj, Color("#5E6578"), Vector3(0, 0, 0.16))
			o.rotation.x = PI / 2
			_teil(form, _kugel(0.05), Color("#9BE7FF"), Vector3(0, 0, 0.24))
			var blitz := BoxMesh.new()
			blitz.size = Vector3(0.1, 0.06, 0.06)
			_teil(form, blitz, Color("#FFFFFF"), Vector3(0.1, 0.15, 0))
		"kolben":
			# Erlenmeyerkolben mit grüner Flüssigkeit
			var glas := CylinderMesh.new()
			glas.top_radius = 0.06
			glas.bottom_radius = 0.2
			glas.height = 0.3
			_teil(form, glas, Color("#D6F4FF"), Vector3.ZERO)
			var fl := CylinderMesh.new()
			fl.top_radius = 0.12
			fl.bottom_radius = 0.18
			fl.height = 0.14
			var f := _teil(form, fl, Color("#7CFF5B"), Vector3(0, -0.07, 0))
			f.material_override = Toon.farbig(Color("#7CFF5B"), 0.0, 0.8)
			var hals := CylinderMesh.new()
			hals.top_radius = 0.06
			hals.bottom_radius = 0.06
			hals.height = 0.16
			_teil(form, hals, Color("#D6F4FF"), Vector3(0, 0.22, 0))
		"molotow":
			# große Flasche mit brennendem Lappen
			var fl2 := CylinderMesh.new()
			fl2.top_radius = 0.22
			fl2.bottom_radius = 0.24
			fl2.height = 0.6
			_teil(form, fl2, Color("#3A7D44"), Vector3.ZERO)
			var hals2 := CylinderMesh.new()
			hals2.top_radius = 0.08
			hals2.bottom_radius = 0.12
			hals2.height = 0.3
			_teil(form, hals2, Color("#3A7D44"), Vector3(0, 0.44, 0))
			var lappen := _teil(form, _kugel(0.12), Color("#E9D8A6"), Vector3(0, 0.62, 0))
			lappen.scale = Vector3(1, 1.4, 1)
			for i in 3:
				var fl3 := CylinderMesh.new()
				fl3.top_radius = 0.0
				fl3.bottom_radius = 0.12 - i * 0.02
				fl3.height = 0.35 + i * 0.1
				var flamme := _teil(form, fl3, Color("#FFB703") if i == 1 else Color("#FF5A1F"), Vector3(0.04 * (i - 1), 0.85 + i * 0.05, 0))
				flamme.material_override = Toon.farbig(Color("#FFB703") if i == 1 else Color("#FF5A1F"), 0.0, 1.4)
		_:
			_teil(form, _kugel(radius), farbe, Vector3.ZERO)
	return form
