## Spiel-Oberfläche: Punktestand, Zeit, Lebensbalken, Munition, Super, Touch-Steuerung, Pause, Ende.
class_name Hud
extends CanvasLayer

const SCHRIFT := preload("res://schrift/LilitaOne-Regular.ttf")
const BLAU := Color("#3DA5FF")
const ROT := Color("#FF4757")
const GRUEN := Color("#7CFF5B")
const DUNKEL := Color("#1B1424")
const GOLD := Color("#FFD23F")

var arena: Arena
var stick_bewegung := Vector2.ZERO
var stick_ziel := Vector2.ZERO

var _leisten: Control
var _punkte_blau: Label
var _punkte_rot: Label
var _zeit: Label
var _gross: Label
var _meldungen: VBoxContainer
var _pause: Control
var _ende: Control
var _touch: Control
var _stick_links: TouchStick
var _stick_angriff: TouchStick
var _stick_super: TouchStick
var _super_knopf_desktop: Control


func _ready() -> void:
	layer = 5
	_leisten = Control.new()
	_leisten.set_anchors_preset(Control.PRESET_FULL_RECT)
	_leisten.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_leisten.draw.connect(_leisten_zeichnen)
	add_child(_leisten)
	_kopfleiste()
	_gross = _label("", 120, Color.WHITE, 22)
	_gross.set_anchors_preset(Control.PRESET_CENTER)
	_gross.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_gross.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_gross.position = Vector2(-400, -120)
	_gross.size = Vector2(800, 200)
	_gross.pivot_offset = Vector2(400, 100)
	add_child(_gross)
	_meldungen = VBoxContainer.new()
	_meldungen.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_meldungen.position = Vector2(-420, 20)
	_meldungen.size = Vector2(400, 300)
	_meldungen.alignment = BoxContainer.ALIGNMENT_BEGIN
	_meldungen.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_meldungen)
	_touch_steuerung()
	_hinweise()


func _process(_d: float) -> void:
	if arena == null:
		return
	_punkte_blau.text = str(arena.punkte[0])
	_punkte_rot.text = str(arena.punkte[1])
	var s := int(ceil(arena.restzeit))
	_zeit.text = "%d:%02d" % [s / 60, s % 60]
	_zeit.add_theme_color_override("font_color", ROT if s <= 15 else Color.WHITE)
	stick_bewegung = _stick_links.wert if _stick_links else Vector2.ZERO
	stick_ziel = Vector2.ZERO
	if _stick_angriff and _stick_angriff.gezogen():
		stick_ziel = _stick_angriff.wert.normalized()
	elif _stick_super and _stick_super.gezogen():
		stick_ziel = _stick_super.wert.normalized()
	if _stick_super:
		_stick_super.ladung = arena.spieler.super_ladung if arena.spieler else 0.0
	_leisten.queue_redraw()
	if _super_knopf_desktop:
		_super_knopf_desktop.queue_redraw()


func zielt_mit_stick() -> bool:
	return stick_ziel.length() > 0.1


func maus_ueber_knopf() -> bool:
	return (_pause and _pause.visible) or (_ende and _ende.visible)


# ---------------------------------------------------------------- Aufbau
func _label(text: String, groesse: int, farbe: Color, rand := 10) -> Label:
	var l := Label.new()
	l.text = text
	var ls := LabelSettings.new()
	ls.font = SCHRIFT
	ls.font_size = groesse
	ls.font_color = farbe
	ls.outline_size = rand
	ls.outline_color = DUNKEL
	ls.shadow_size = 0
	ls.shadow_color = Color(0, 0, 0, 0.35)
	ls.shadow_offset = Vector2(0, 4)
	l.label_settings = ls
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _plakette(farbe: Color) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = farbe
	sb.set_corner_radius_all(18)
	sb.border_color = DUNKEL
	sb.set_border_width_all(5)
	sb.content_margin_left = 22
	sb.content_margin_right = 22
	sb.content_margin_top = 2
	sb.content_margin_bottom = 2
	sb.shadow_color = Color(0, 0, 0, 0.3)
	sb.shadow_size = 0
	sb.shadow_offset = Vector2(0, 5)
	p.add_theme_stylebox_override("panel", sb)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return p


func _kopfleiste() -> void:
	var box := HBoxContainer.new()
	box.set_anchors_preset(Control.PRESET_CENTER_TOP)
	box.position = Vector2(-230, 14)
	box.size = Vector2(460, 80)
	box.add_theme_constant_override("separation", 12)
	box.alignment = BoxContainer.ALIGNMENT_CENTER
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var pb := _plakette(BLAU)
	_punkte_blau = _label("0", 54, Color.WHITE, 12)
	pb.add_child(_punkte_blau)
	var pz := _plakette(Color("#2A2140"))
	_zeit = _label("2:30", 44, Color.WHITE, 10)
	pz.add_child(_zeit)
	var pr := _plakette(ROT)
	_punkte_rot = _label("0", 54, Color.WHITE, 12)
	pr.add_child(_punkte_rot)
	box.add_child(pb)
	box.add_child(pz)
	box.add_child(pr)
	add_child(box)
	var ziel := _label("Zuerst %d K.o.s gewinnt" % Arena.SIEG_KOS, 22, Color.WHITE, 6)
	ziel.set_anchors_preset(Control.PRESET_CENTER_TOP)
	ziel.position = Vector2(-150, 96)
	ziel.size = Vector2(300, 30)
	ziel.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(ziel)


func _hinweise() -> void:
	if DisplayServer.is_touchscreen_available():
		return
	var h := _label("WASD laufen · Maus zielen · Linksklick Angriff · Leertaste Auto-Ziel · Rechtsklick/E Super · Esc Pause", 20, Color.WHITE, 6)
	h.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	h.position = Vector2(-560, -40)
	h.size = Vector2(1120, 30)
	h.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(h)
	# Super-Anzeige unten rechts
	_super_knopf_desktop = Control.new()
	_super_knopf_desktop.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_super_knopf_desktop.position = Vector2(-170, -190)
	_super_knopf_desktop.size = Vector2(140, 140)
	_super_knopf_desktop.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_super_knopf_desktop.draw.connect(func():
		var l: float = arena.spieler.super_ladung if arena and arena.spieler else 0.0
		TouchStick.super_kreis(_super_knopf_desktop, Vector2(70, 70), 62.0, l, SCHRIFT))
	add_child(_super_knopf_desktop)


func _touch_steuerung() -> void:
	if not DisplayServer.is_touchscreen_available():
		return
	_touch = Control.new()
	_touch.set_anchors_preset(Control.PRESET_FULL_RECT)
	_touch.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_touch)
	_stick_links = TouchStick.new()
	_stick_links.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	_stick_links.position = Vector2(40, -340)
	_stick_links.size = Vector2(320, 320)
	_touch.add_child(_stick_links)
	_stick_angriff = TouchStick.new()
	_stick_angriff.art = "angriff"
	_stick_angriff.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_stick_angriff.position = Vector2(-330, -330)
	_stick_angriff.size = Vector2(300, 300)
	_stick_angriff.losgelassen.connect(func(w, gezielt): arena.touch_angriff(w, gezielt, false))
	_touch.add_child(_stick_angriff)
	_stick_super = TouchStick.new()
	_stick_super.art = "super"
	_stick_super.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	_stick_super.position = Vector2(-520, -250)
	_stick_super.size = Vector2(190, 190)
	_stick_super.losgelassen.connect(func(w, gezielt): arena.touch_angriff(w, gezielt, true))
	_touch.add_child(_stick_super)


# ---------------------------------------------------------------- Lebensbalken über den Köpfen
func _leisten_zeichnen() -> void:
	if arena == null or arena.kamera() == null:
		return
	var cam := arena.kamera()
	for k in arena.kaempfer:
		var kk: Kaempfer = k
		if kk.tot or not kk.modell.visible:
			continue
		var welt := kk.global_position + Vector3(0, 2.25, 0)
		if cam.is_position_behind(welt):
			continue
		var p := cam.unproject_position(welt)
		var b := 112.0
		var h := 20.0
		var farbe := GRUEN if kk.ist_spieler else (BLAU if kk.team == 0 else ROT)
		# Name
		var name := str(kk.daten["name"])
		var fs := 22
		var tb := SCHRIFT.get_string_size(name, HORIZONTAL_ALIGNMENT_LEFT, -1, fs)
		_leisten.draw_string_outline(SCHRIFT, p + Vector2(-tb.x / 2, -h - 8), name, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, 8, DUNKEL)
		_leisten.draw_string(SCHRIFT, p + Vector2(-tb.x / 2, -h - 8), name, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color.WHITE)
		# Balken
		var r := Rect2(p + Vector2(-b / 2, -h), Vector2(b, h))
		_runde_box(r.grow(3), DUNKEL, 9)
		_runde_box(r, Color("#3A2E4F"), 7)
		var anteil := clampf(kk.leben / kk.max_leben, 0.0, 1.0)
		if anteil > 0.0:
			_runde_box(Rect2(r.position, Vector2(maxf(b * anteil, 10), h)), farbe, 7)
			_runde_box(Rect2(r.position + Vector2(3, 2), Vector2(maxf(b * anteil - 6, 4), 5)), farbe.lightened(0.45), 3)
		var zahl := str(int(ceil(kk.leben)))
		var zb := SCHRIFT.get_string_size(zahl, HORIZONTAL_ALIGNMENT_LEFT, -1, 18)
		_leisten.draw_string_outline(SCHRIFT, r.position + Vector2((b - zb.x) / 2, 16), zahl, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, 6, DUNKEL)
		_leisten.draw_string(SCHRIFT, r.position + Vector2((b - zb.x) / 2, 16), zahl, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color.WHITE)
		# Munition (nur eigener Kämpfer)
		if kk.ist_spieler:
			var mb := (b - 8) / 3.0
			for i in 3:
				var mr := Rect2(r.position + Vector2(i * (mb + 4), h + 6), Vector2(mb, 10))
				_runde_box(mr.grow(2), DUNKEL, 5)
				var f := clampf(kk.munition - i, 0.0, 1.0)
				_runde_box(mr, Color("#4A3B63"), 4)
				if f > 0.0:
					_runde_box(Rect2(mr.position, Vector2(mb * f, 10)), Color("#FF9F1C") if f >= 1.0 else Color("#B86F10"), 4)


func _runde_box(r: Rect2, farbe: Color, radius: float) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = farbe
	sb.set_corner_radius_all(int(radius))
	sb.anti_aliasing = true
	_leisten.draw_style_box(sb, r)


# ---------------------------------------------------------------- Meldungen
func gross_text(text: String, dauer: float) -> void:
	_gross.text = text
	_gross.scale = Vector2.ONE * 0.3
	_gross.modulate.a = 1.0
	var tw := create_tween()
	tw.tween_property(_gross, "scale", Vector2.ONE, 0.25).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_interval(dauer - 0.4)
	tw.tween_property(_gross, "modulate:a", 0.0, 0.15)


func meldung(opfer: Kaempfer, taeter: Kaempfer) -> void:
	var text := "%s wurde ausgeschaltet!" % opfer.daten["name"]
	if taeter:
		text = "%s ➜ %s" % [taeter.daten["name"], opfer.daten["name"]]
	var l := _label(text, 26, BLAU.lightened(0.3) if (taeter and taeter.team == 0) else ROT.lightened(0.3), 8)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	_meldungen.add_child(l)
	var tw := l.create_tween()
	tw.tween_interval(3.0)
	tw.tween_property(l, "modulate:a", 0.0, 0.4)
	tw.tween_callback(l.queue_free)
	if opfer == arena.spieler:
		gross_text("K.O.!", 1.2)
	elif taeter == arena.spieler:
		gross_text("ERWISCHT!", 0.9)


# ---------------------------------------------------------------- Pause & Ende
func _knopf(text: String, farbe: Color, aktion: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_override("font", SCHRIFT)
	b.add_theme_font_size_override("font_size", 42)
	b.add_theme_color_override("font_color", Color.WHITE)
	b.add_theme_color_override("font_outline_color", DUNKEL)
	b.add_theme_constant_override("outline_size", 10)
	for zustand in ["normal", "hover", "pressed", "focus"]:
		var sb := StyleBoxFlat.new()
		sb.bg_color = farbe.lightened(0.12) if zustand == "hover" else (farbe.darkened(0.15) if zustand == "pressed" else farbe)
		sb.set_corner_radius_all(20)
		sb.border_color = DUNKEL
		sb.set_border_width_all(6)
		sb.content_margin_left = 40
		sb.content_margin_right = 40
		sb.content_margin_top = 10
		sb.content_margin_bottom = 14
		sb.shadow_color = Color(0, 0, 0, 0.35)
		sb.shadow_offset = Vector2(0, 6)
		sb.shadow_size = 1
		b.add_theme_stylebox_override(zustand, sb)
	b.pressed.connect(aktion)
	b.custom_minimum_size = Vector2(320, 0)
	return b


func _overlay() -> Control:
	var c := ColorRect.new()
	c.color = Color(0.08, 0.05, 0.15, 0.55)
	c.set_anchors_preset(Control.PRESET_FULL_RECT)
	var zentrum := CenterContainer.new()
	zentrum.set_anchors_preset(Control.PRESET_FULL_RECT)
	c.add_child(zentrum)
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 24)
	zentrum.add_child(v)
	add_child(c)
	return c


func pause_umschalten() -> void:
	if _pause == null:
		_pause = _overlay()
		_pause.process_mode = Node.PROCESS_MODE_ALWAYS
		var v: VBoxContainer = _pause.get_child(0).get_child(0)
		var t := _label("PAUSE", 110, GOLD, 22)
		t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(t)
		v.add_child(_knopf("Weiter", Color("#2EC4B6"), pause_umschalten))
		v.add_child(_knopf("Zum Menü", Color("#8E7DBE"), _zum_menue))
		_pause.visible = false
	_pause.visible = not _pause.visible
	get_tree().paused = _pause.visible


func _zum_menue() -> void:
	get_tree().paused = false
	get_tree().change_scene_to_file("res://szenen/menue.tscn")


func ende(ergebnis: int) -> void:
	_leisten.visible = false
	if _touch:
		_touch.visible = false
	_ende = _overlay()
	(_ende as ColorRect).color = Color(0.08, 0.05, 0.15, 0.25)
	var v: VBoxContainer = _ende.get_child(0).get_child(0)
	(_ende.get_child(0) as Control).offset_left = 700  # rechts neben der jubelnden Figur
	var text: String = {1: "SIEG!", -1: "NIEDERLAGE", 0: "UNENTSCHIEDEN"}[ergebnis]
	var farbe: Color = {1: GOLD, -1: ROT, 0: Color.WHITE}[ergebnis]
	var t := _label(text, 120, farbe, 24)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.pivot_offset = Vector2(300, 70)
	v.add_child(t)
	var s := _label("%d : %d   ·   deine K.o.s: %d" % [arena.punkte[0], arena.punkte[1], arena.spieler.ko_zaehler], 34, Color.WHITE, 8)
	s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(s)
	v.add_child(_knopf("Nochmal!", Color("#FF9F1C"), func(): get_tree().reload_current_scene()))
	v.add_child(_knopf("Zum Menü", Color("#8E7DBE"), _zum_menue))
	t.scale = Vector2.ONE * 0.2
	var tw := create_tween()
	tw.tween_property(t, "scale", Vector2.ONE, 0.45).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
