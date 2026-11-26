## Comic-Effekte: Schadenszahlen, Treffer-Sterne, Puffwolken, Explosionsringe.
class_name Effekte
extends RefCounted

const SCHRIFT := preload("res://schrift/LilitaOne-Regular.ttf")


static func zahl(eltern: Node3D, pos: Vector3, wert: int, vom_spieler: bool) -> void:
	var l := Label3D.new()
	l.text = str(wert)
	l.font = SCHRIFT
	l.font_size = 72
	l.outline_size = 18
	l.pixel_size = 0.006
	l.modulate = Color("#FFE14D") if vom_spieler else Color("#FFFFFF")
	l.outline_modulate = Color("#1B1424")
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.render_priority = 10
	l.outline_render_priority = 9
	eltern.add_child(l)
	l.global_position = pos + Vector3(randf_range(-0.3, 0.3), 0, 0)
	l.scale = Vector3.ONE * 0.4
	var tw := l.create_tween()
	tw.set_parallel(true)
	tw.tween_property(l, "scale", Vector3.ONE * 1.15, 0.12).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "global_position:y", pos.y + 1.0, 0.7).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "modulate:a", 0.0, 0.25).set_delay(0.5)
	tw.tween_property(l, "outline_modulate:a", 0.0, 0.25).set_delay(0.5)
	tw.chain().tween_callback(l.queue_free)


static func _kugel(eltern: Node3D, pos: Vector3, r: float, farbe: Color) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = r
	s.height = r * 2.0
	s.radial_segments = 16
	s.rings = 8
	m.mesh = s
	m.material_override = Toon.farbig(farbe, 0.02, 0.35)
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	eltern.add_child(m)
	m.global_position = pos
	return m


static func treffer(eltern: Node3D, pos: Vector3, farbe: Color) -> void:
	for i in 6:
		var k := _kugel(eltern, pos, 0.1, farbe.lightened(0.3))
		var r := Vector3(randf_range(-1, 1), randf_range(0.2, 1.2), randf_range(-1, 1)).normalized() * randf_range(0.6, 1.2)
		var tw := k.create_tween()
		tw.set_parallel(true)
		tw.tween_property(k, "global_position", pos + r, 0.25).set_ease(Tween.EASE_OUT)
		tw.tween_property(k, "scale", Vector3.ONE * 0.05, 0.25)
		tw.chain().tween_callback(k.queue_free)


static func puff(eltern: Node3D, pos: Vector3, farbe: Color) -> void:
	for i in 9:
		var k := _kugel(eltern, pos, randf_range(0.25, 0.4), farbe)
		var r := Vector3(randf_range(-1, 1), randf_range(0.0, 1.0), randf_range(-1, 1)).normalized() * randf_range(0.6, 1.3)
		k.scale = Vector3.ONE * 0.3
		var tw := k.create_tween()
		tw.set_parallel(true)
		tw.tween_property(k, "global_position", pos + r, 0.4).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUAD)
		tw.tween_property(k, "scale", Vector3.ONE, 0.18).set_trans(Tween.TRANS_BACK)
		tw.chain().tween_property(k, "scale", Vector3.ONE * 0.01, 0.25)
		tw.chain().tween_callback(k.queue_free)


static func ring(eltern: Node3D, pos: Vector3, radius: float, farbe: Color, dauer := 0.35) -> void:
	var m := MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = 0.85
	t.outer_radius = 1.0
	t.rings = 40
	m.mesh = t
	m.material_override = Toon.unschattiert(farbe)
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	eltern.add_child(m)
	m.global_position = pos + Vector3(0, 0.08, 0)
	m.scale = Vector3(0.1, 0.2, 0.1)
	var tw := m.create_tween()
	tw.tween_property(m, "scale", Vector3(radius, 0.2, radius), dauer).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_CUBIC)
	tw.tween_property(m, "scale", Vector3(radius * 1.05, 0.01, radius * 1.05), 0.12)
	tw.tween_callback(m.queue_free)


static func explosion(eltern: Node3D, pos: Vector3, radius: float, farbe: Color) -> void:
	ring(eltern, pos, radius, farbe.lightened(0.2))
	for i in 12:
		var k := _kugel(eltern, pos + Vector3(0, 0.3, 0), randf_range(0.3, 0.55), farbe if i % 2 else Color("#FFF3B0"))
		var r := Vector3(randf_range(-1, 1), randf_range(0.1, 0.9), randf_range(-1, 1)).normalized() * radius * randf_range(0.4, 0.8)
		k.scale = Vector3.ONE * 0.2
		var tw := k.create_tween()
		tw.set_parallel(true)
		tw.tween_property(k, "global_position", pos + r, 0.35).set_ease(Tween.EASE_OUT)
		tw.tween_property(k, "scale", Vector3.ONE, 0.15).set_trans(Tween.TRANS_BACK)
		tw.chain().tween_property(k, "scale", Vector3.ONE * 0.01, 0.3)
		tw.chain().tween_callback(k.queue_free)


static func schlag(eltern: Node3D, pos: Vector3, richtung: Vector3, farbe: Color) -> void:
	for i in 5:
		var w := lerpf(-0.9, 0.9, i / 4.0)
		var p := pos + richtung.rotated(Vector3.UP, w) * 0.6
		var k := _kugel(eltern, p, 0.18, farbe)
		var tw := k.create_tween()
		tw.tween_property(k, "scale", Vector3.ONE * 0.01, 0.25).set_delay(i * 0.02)
		tw.tween_callback(k.queue_free)


static func super_blitz(eltern: Node3D, pos: Vector3, farbe: Color) -> void:
	ring(eltern, pos, 2.2, farbe, 0.3)
