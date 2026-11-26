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
			arena.explosion(quelle, team, ziel, explosions_radius, schaden, farbe, zerstoert_waende)
			queue_free()
		return
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
		if d < radius + 0.45:
			k.schaden_nehmen(schaden, quelle, richtung * 2.0)
			Effekte.treffer(arena, naechster, farbe)
			Arena.ton("treffer")
			queue_free()
			return
	global_position = nach
	rest -= schritt.length()
	if rest <= 0.0:
		Effekte.treffer(arena, global_position, farbe.darkened(0.2))
		queue_free()
