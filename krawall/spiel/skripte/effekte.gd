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


## Großer Schriftzug über dem Kopf (z. B. der Name eines Ultis: "PAPI TAG")
static func ruf(kaempfer: Node3D, text: String, farbe: Color) -> void:
	var l := Label3D.new()
	l.text = text
	l.font = SCHRIFT
	l.font_size = 200
	l.outline_size = 40
	l.pixel_size = 0.009
	l.modulate = farbe.lightened(0.25)
	l.outline_modulate = Color("#1B1424")
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.render_priority = 20
	l.outline_render_priority = 19
	kaempfer.add_child(l)
	var h: float = kaempfer.kopf_hoehe() + 0.8 if kaempfer.has_method("kopf_hoehe") else 3.0
	l.position = Vector3(0, h, 0)
	l.scale = Vector3.ONE * 0.1
	var tw := l.create_tween()
	tw.tween_property(l, "scale", Vector3.ONE * 1.25, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(l, "scale", Vector3.ONE, 0.12)
	tw.tween_property(l, "rotation:z", 0.08, 0.1)
	tw.tween_property(l, "rotation:z", -0.08, 0.1)
	tw.tween_property(l, "rotation:z", 0.0, 0.1)
	tw.tween_interval(0.8)
	tw.set_parallel(true)
	tw.tween_property(l, "modulate:a", 0.0, 0.35)
	tw.tween_property(l, "outline_modulate:a", 0.0, 0.35)
	tw.tween_property(l, "position:y", h + 0.6, 0.35)
	tw.chain().tween_callback(l.queue_free)


## Schleimpfütze am Boden (z. B. nach einem Schneckenwurf)
static func pfuetze(eltern: Node3D, pos: Vector3, radius: float, farbe: Color, dauer: float) -> void:
	var m := MeshInstance3D.new()
	var z := CylinderMesh.new()
	z.top_radius = radius
	z.bottom_radius = radius
	z.height = 0.03
	z.radial_segments = 24
	m.mesh = z
	var c := farbe
	c.a = 0.55
	m.material_override = Toon.unschattiert(c, true)
	m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	eltern.add_child(m)
	m.global_position = Vector3(pos.x, 0.03, pos.z)
	m.scale = Vector3(0.3, 1, 0.3)
	var tw := m.create_tween()
	tw.tween_property(m, "scale", Vector3.ONE, 0.2).set_trans(Tween.TRANS_BACK)
	tw.tween_interval(dauer)
	tw.tween_property(m, "scale", Vector3(0.01, 1, 0.01), 0.4)
	tw.tween_callback(m.queue_free)


## Weißer Kamerablitz
static func blitzlicht(eltern: Node3D, pos: Vector3) -> void:
	var l := OmniLight3D.new()
	l.light_color = Color.WHITE
	l.light_energy = 6.0
	l.omni_range = 4.0
	eltern.add_child(l)
	l.global_position = pos + Vector3(0, 0.5, 0)
	var k := _kugel(eltern, pos, 0.35, Color.WHITE)
	var tw := l.create_tween()
	tw.set_parallel(true)
	tw.tween_property(l, "light_energy", 0.0, 0.25)
	tw.tween_property(k, "scale", Vector3.ONE * 2.5, 0.2)
	tw.chain().tween_callback(func():
		l.queue_free()
		k.queue_free())


## Kleine graue Dampfwolke, die aufsteigt (Erschöpfung, Überhitzung …)
static func dampf(eltern: Node3D, pos: Vector3) -> void:
	var k := _kugel(eltern, pos, randf_range(0.12, 0.2), Color("#B8B8C8"))
	var tw := k.create_tween()
	tw.set_parallel(true)
	tw.tween_property(k, "global_position", pos + Vector3(randf_range(-0.3, 0.3), 0.9, randf_range(-0.3, 0.3)), 0.9)
	tw.tween_property(k, "scale", Vector3.ONE * 1.8, 0.9)
	tw.chain().tween_callback(k.queue_free)


## Müde: "Zzz" steigt über dem Kopf auf (z. B. nach Frau Osingas langweiliger Sprechblase)
static func zzz(k: Node3D, dauer: float) -> void:
	if k.has_node("Zzz"):
		k.get_node("Zzz").set_meta("bis", Time.get_ticks_msec() / 1000.0 + dauer)
		return
	var halter := Node3D.new()
	halter.name = "Zzz"
	halter.set_meta("bis", Time.get_ticks_msec() / 1000.0 + dauer)
	k.add_child(halter)
	var h: float = k.kopf_hoehe() if k.has_method("kopf_hoehe") else 2.2
	for i in 3:
		var l := Label3D.new()
		l.text = "Z" if i == 0 else "z"
		l.font = SCHRIFT
		l.font_size = 90 - i * 18
		l.pixel_size = 0.008
		l.outline_size = 14
		l.modulate = Color("#B9A8FF")
		l.outline_modulate = Color("#2A1F45")
		l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		l.position = Vector3(-0.5 - i * 0.22, h - 0.2 + i * 0.3, 0)
		halter.add_child(l)
		var tw := l.create_tween().set_loops()
		tw.tween_property(l, "position:y", l.position.y + 0.25, 0.6).set_delay(i * 0.2)
		tw.tween_property(l, "position:y", l.position.y, 0.6)
	var t := halter.create_tween().set_loops()
	t.tween_interval(0.2)
	t.tween_callback(func():
		if Time.get_ticks_msec() / 1000.0 > float(halter.get_meta("bis")):
			halter.queue_free())
