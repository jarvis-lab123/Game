## Hauptmenü mit 3D-Charakterauswahl (drehende Figur, Werte, Kämpfen-Knopf).
extends Control

const SCHRIFT := preload("res://schrift/LilitaOne-Regular.ttf")
const DUNKEL := Color("#1B1424")

var _buehne: Node3D
var _figur_halter: Node3D
var _figur: Node3D
var _name: Label
var _titel: Label
var _info: Label
var _platzhalter_hinweis: Label
var _zeit := 0.0


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	# Hintergrund: Farbverlauf
	var bg := TextureRect.new()
	var g := GradientTexture2D.new()
	var gr := Gradient.new()
	gr.set_color(0, Color("#FFB347"))
	gr.set_color(1, Color("#FF5E8A"))
	g.gradient = gr
	g.fill_from = Vector2(0, 0)
	g.fill_to = Vector2(1, 1)
	bg.texture = g
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.stretch_mode = TextureRect.STRETCH_SCALE
	add_child(bg)
	_buehne_bauen()
	_oberflaeche()
	_zeigen()


func _buehne_bauen() -> void:
	var svc := SubViewportContainer.new()
	svc.stretch = true
	svc.set_anchors_preset(Control.PRESET_FULL_RECT)
	svc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(svc)
	var sv := SubViewport.new()
	sv.transparent_bg = true
	sv.msaa_3d = Viewport.MSAA_4X
	sv.own_world_3d = true
	svc.add_child(sv)
	_buehne = Node3D.new()
	sv.add_child(_buehne)
	var cam := Camera3D.new()
	cam.position = Vector3(1.55, 1.25, 5.4)
	cam.fov = 34
	_buehne.add_child(cam)
	cam.look_at(Vector3(1.55, 0.95, 0))
	var licht := DirectionalLight3D.new()
	licht.rotation_degrees = Vector3(-40, 30, 0)
	licht.light_energy = 1.3
	licht.shadow_enabled = true
	_buehne.add_child(licht)
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#C9B8F0")
	env.ambient_light_energy = 0.65
	var we := WorldEnvironment.new()
	we.environment = env
	_buehne.add_child(we)
	# Podest
	var podest := MeshInstance3D.new()
	var zyl := CylinderMesh.new()
	zyl.top_radius = 0.8
	zyl.bottom_radius = 0.88
	zyl.height = 0.3
	podest.mesh = zyl
	podest.position.y = -0.15
	podest.material_override = Toon.farbig(Color("#FFE8A3"), 0.02)
	_buehne.add_child(podest)
	_figur_halter = Node3D.new()
	_buehne.add_child(_figur_halter)


func _label(text: String, groesse: int, farbe: Color, rand := 10) -> Label:
	var l := Label.new()
	l.text = text
	var ls := LabelSettings.new()
	ls.font = SCHRIFT
	ls.font_size = groesse
	ls.font_color = farbe
	ls.outline_size = rand
	ls.outline_color = DUNKEL
	ls.shadow_color = Color(0, 0, 0, 0.3)
	ls.shadow_offset = Vector2(0, 5)
	l.label_settings = ls
	return l


func _knopf(text: String, farbe: Color, groesse: int, aktion: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_override("font", SCHRIFT)
	b.add_theme_font_size_override("font_size", groesse)
	b.add_theme_color_override("font_outline_color", DUNKEL)
	b.add_theme_constant_override("outline_size", 12)
	for zustand in ["normal", "hover", "pressed", "focus"]:
		var sb := StyleBoxFlat.new()
		sb.bg_color = farbe.lightened(0.12) if zustand == "hover" else (farbe.darkened(0.15) if zustand == "pressed" else farbe)
		sb.set_corner_radius_all(24)
		sb.border_color = DUNKEL
		sb.set_border_width_all(7)
		sb.content_margin_left = 34
		sb.content_margin_right = 34
		sb.content_margin_top = 8
		sb.content_margin_bottom = 14
		sb.shadow_color = Color(0, 0, 0, 0.35)
		sb.shadow_offset = Vector2(0, 8)
		sb.shadow_size = 1
		b.add_theme_stylebox_override(zustand, sb)
	b.pressed.connect(aktion)
	return b


func _oberflaeche() -> void:
	var logo := _label("KRAWALL CREW", 104, Color("#FFD23F"), 26)
	logo.position = Vector2(60, 30)
	logo.rotation = -0.04
	add_child(logo)
	var rechts := VBoxContainer.new()
	rechts.set_anchors_preset(Control.PRESET_RIGHT_WIDE)
	rechts.offset_left = -720
	rechts.offset_right = -60
	rechts.offset_top = 170
	rechts.offset_bottom = -60
	rechts.add_theme_constant_override("separation", 14)
	add_child(rechts)
	_name = _label("", 96, Color.WHITE, 22)
	_titel = _label("", 38, Color("#FFF3B0"), 10)
	_info = _label("", 30, Color.WHITE, 9)
	_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_info.custom_minimum_size = Vector2(640, 0)
	rechts.add_child(_name)
	rechts.add_child(_titel)
	rechts.add_child(_info)
	var wahl := HBoxContainer.new()
	wahl.add_theme_constant_override("separation", 16)
	wahl.add_child(_knopf("◀", Color("#8E7DBE"), 48, func(): _wechseln(-1)))
	wahl.add_child(_knopf("▶", Color("#8E7DBE"), 48, func(): _wechseln(1)))
	rechts.add_child(wahl)
	var spiel := _knopf("KÄMPFEN!", Color("#2EC4B6"), 70, _starten)
	spiel.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	spiel.position = Vector2(-560, -190)
	spiel.size = Vector2(500, 130)
	add_child(spiel)
	_platzhalter_hinweis = _label("Platzhalter-Figur – deine eigenen Charaktere ersetzen sie automatisch.", 24, Color.WHITE, 7)
	_platzhalter_hinweis.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_platzhalter_hinweis.position = Vector2(40, -60)
	add_child(_platzhalter_hinweis)
	var siege := _label("Siege: %d" % Daten.siege, 34, Color.WHITE, 9)
	siege.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	siege.position = Vector2(-240, 40)
	add_child(siege)


func _wechseln(r: int) -> void:
	if Daten.charaktere.is_empty():
		return
	Daten.gewaehlt_index = posmod(Daten.gewaehlt_index + r, Daten.charaktere.size())
	_zeigen()


func _zeigen() -> void:
	var c: Dictionary = Daten.gewaehlt()
	_name.text = str(c["name"]).to_upper()
	_titel.text = str(c.get("titel", ""))
	var a: Dictionary = c["angriff"]
	var s: Dictionary = c["super"]
	_info.text = "%s\n\n❤ Leben: %d\n✦ Angriff: %s (%d Schaden)\n★ Super: %s" % [
		c.get("beschreibung", ""), int(c["werte"]["leben"]), a["name"], int(a["schaden"]), s["name"]]
	_platzhalter_hinweis.visible = c.get("platzhalter", false)
	if _figur:
		_figur.queue_free()
	var pfad: String = c.get("modell", "")
	if pfad == "":
		_figur = null
		return
	_figur = (load(pfad) as PackedScene).instantiate()
	_figur_halter.add_child(_figur)
	Toon.anwenden(_figur, 0.014)
	# auf 1.75 m skalieren
	var box := AABB()
	var erste := true
	for mi in _figur.find_children("*", "MeshInstance3D", true, false):
		var b: AABB = (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
		box = b if erste else box.merge(b)
		erste = false
	if box.size.y > 0.01:
		var sk := float(c.get("modell_hoehe", 1.75)) / box.size.y
		_figur.scale = Vector3.ONE * sk
		_figur.position.y = -box.position.y * sk
	var aps := _figur.find_children("*", "AnimationPlayer", true, false)
	if aps.size() > 0:
		var ap: AnimationPlayer = aps[0]
		var anim := "Idle" if ap.has_animation("Idle") else "Victory"
		if ap.has_animation(anim):
			ap.get_animation(anim).loop_mode = Animation.LOOP_LINEAR
			ap.play(anim)
	_figur_halter.scale = Vector3.ONE * 0.3
	create_tween().tween_property(_figur_halter, "scale", Vector3.ONE, 0.35).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)


func _process(d: float) -> void:
	_zeit += d
	if _figur_halter:
		_figur_halter.rotation.y = sin(_zeit * 0.6) * 0.5


func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("links"):
		_wechseln(-1)
	elif e.is_action_pressed("rechts"):
		_wechseln(1)
	elif e.is_action_pressed("ui_accept"):
		_starten()


func _starten() -> void:
	if Daten.charaktere.is_empty():
		return
	get_tree().change_scene_to_file("res://szenen/spiel.tscn")
