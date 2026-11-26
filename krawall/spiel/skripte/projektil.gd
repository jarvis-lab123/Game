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
		_:
			_teil(form, _kugel(radius), farbe, Vector3.ZERO)
	return form
