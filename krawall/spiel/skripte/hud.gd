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
var modus := "arena"            # arena | schule
var _untertitel: Label
var _raum_label: Label
var _karte: Control
var _treffer_rand: TextureRect
var _boss: Control
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
var _gadget_anzeige: Control
var _gadget_knopf: Button


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
	_gadget_bauen()
	if modus == "schule":
		_schule_bauen()


func _process(_d: float) -> void:
	if arena == null:
		return
	if modus == "schule":
		var sch: Schule = arena
		var uebrig := sch.lehrer_uebrig()
		_punkte_blau.text = "✔ %d" % (sch.lehrer_gesamt - uebrig)
		_punkte_rot.text = str(uebrig)
		var g := int(arena.restzeit)
		_zeit.text = "%d:%02d" % [g / 60, g % 60]
		var n := sch.angreifer.filter(func(a): return is_instance_valid(a) and not a.tot).size()
		_untertitel.text = "Lehrer übrig: %d" % uebrig + ("   ·   im Kampf!" if n > 0 else "")
		_karte.queue_redraw()
		if _boss:
			_boss.queue_redraw()
	else:
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
	if _gadget_anzeige:
		_gadget_anzeige.queue_redraw()


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
	_untertitel = ziel
	ziel.set_anchors_preset(Control.PRESET_CENTER_TOP)
	ziel.position = Vector2(-300, 96)
	ziel.size = Vector2(600, 30)
	ziel.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(ziel)


func _hinweise() -> void:
	if DisplayServer.is_touchscreen_available():
		return
	var h := _label("WASD laufen · Maus zielen · Linksklick Angriff · Leertaste Auto-Ziel · Rechtsklick/E Super · F Gadget · Esc Pause", 20, Color.WHITE, 6)
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


func _schule_bauen() -> void:
	_raum_label = _label("", 46, Color.WHITE, 12)
	_raum_label.set_anchors_preset(Control.PRESET_CENTER_TOP)
	_raum_label.position = Vector2(-400, 135)
	_raum_label.size = Vector2(800, 60)
	_raum_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_raum_label.modulate.a = 0.0
	add_child(_raum_label)
	_karte = Control.new()
	_karte.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	_karte.position = Vector2(-310, 90)
	_karte.size = Vector2(290, 203)
	_karte.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_karte.draw.connect(_karte_zeichnen)
	add_child(_karte)
	_boss = Control.new()
	_boss.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_boss.position = Vector2(-330, -150)
	_boss.size = Vector2(660, 90)
	_boss.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_boss.draw.connect(_boss_zeichnen)
	add_child(_boss)


## Großer Lebensbalken des Lehrers, gegen den man gerade kämpft (mit Markierung der Wutphase)
func _boss_zeichnen() -> void:
	var sch: Schule = arena
	var l: Lehrer = null
	for a in sch.angreifer:
		if is_instance_valid(a) and not a.tot:
			l = a
			break
	if l == null:
		return
	var b := _boss.size.x
	var name := "%s  –  %s" % [l.daten["name"], l.daten.get("titel", "")]
	var fs := 30
	var tb := SCHRIFT.get_string_size(name, HORIZONTAL_ALIGNMENT_LEFT, -1, fs)
	_boss.draw_string_outline(SCHRIFT, Vector2((b - tb.x) / 2, 30), name, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, 10, DUNKEL)
	_boss.draw_string(SCHRIFT, Vector2((b - tb.x) / 2, 30), name, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color.WHITE)
	var r := Rect2(Vector2(0, 42), Vector2(b, 30))
	var sb := StyleBoxFlat.new()
	sb.bg_color = DUNKEL
	sb.set_corner_radius_all(14)
	_boss.draw_style_box(sb, r.grow(5))
	var sb2 := StyleBoxFlat.new()
	sb2.bg_color = Color("#3A2E4F")
	sb2.set_corner_radius_all(11)
	_boss.draw_style_box(sb2, r)
	var anteil := clampf(l.leben / l.max_leben, 0.0, 1.0)
	if anteil > 0.0:
		var sb3 := StyleBoxFlat.new()
		sb3.bg_color = Color("#FF4757") if anteil > 0.5 else Color("#FF9F1C").lerp(Color("#FF3B30"), 0.5 + 0.5 * sin(Time.get_ticks_msec() / 90.0))
		sb3.set_corner_radius_all(11)
		_boss.draw_style_box(sb3, Rect2(r.position, Vector2(maxf(b * anteil, 22), r.size.y)))
	_boss.draw_line(r.position + Vector2(b * 0.5, -4), r.position + Vector2(b * 0.5, r.size.y + 4), Color.WHITE, 3.0)
	var zahl := "%d / %d" % [int(ceil(l.leben)), int(l.max_leben)]
	var zb := SCHRIFT.get_string_size(zahl, HORIZONTAL_ALIGNMENT_LEFT, -1, 22)
	_boss.draw_string_outline(SCHRIFT, r.position + Vector2((b - zb.x) / 2, 23), zahl, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, 7, DUNKEL)
	_boss.draw_string(SCHRIFT, r.position + Vector2((b - zb.x) / 2, 23), zahl, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color.WHITE)


## "Silence": große Warnung mit Countdown – jetzt nicht angreifen!
func stille_warnung(dauer: float) -> void:
	var l := _label("", 64, Color("#FFFFFF"), 16)
	l.set_anchors_preset(Control.PRESET_CENTER)
	l.position = Vector2(-500, -170)
	l.size = Vector2(1000, 200)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	add_child(l)
	var hinter := ColorRect.new()
	hinter.color = Color(0.25, 0.05, 0.35, 0.28)
	hinter.set_anchors_preset(Control.PRESET_FULL_RECT)
	hinter.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(hinter)
	move_child(hinter, 0)
	var ende := Time.get_ticks_msec() / 1000.0 + dauer
	while Time.get_ticks_msec() / 1000.0 < ende and is_instance_valid(l) and not (arena and arena.vorbei):
		var rest := ende - Time.get_ticks_msec() / 1000.0
		l.text = "PSST! NICHT ANGREIFEN!\n%.1f" % rest
		l.scale = Vector2.ONE * (1.0 + 0.04 * sin(Time.get_ticks_msec() / 80.0))
		l.pivot_offset = l.size / 2
		await get_tree().process_frame
	if is_instance_valid(l):
		l.queue_free()
	if is_instance_valid(hinter):
		hinter.queue_free()


## Roter Bildschirmrand, wenn der Spieler getroffen wird (stärker bei viel Schaden)
func treffer_blitz(anteil: float) -> void:
	if _treffer_rand == null:
		_treffer_rand = TextureRect.new()
		var g := GradientTexture2D.new()
		var gr := Gradient.new()
		gr.set_color(0, Color(0.9, 0.1, 0.15, 0.0))
		gr.set_color(1, Color(0.9, 0.1, 0.15, 0.85))
		gr.add_point(0.55, Color(0.9, 0.1, 0.15, 0.0))
		g.gradient = gr
		g.fill = GradientTexture2D.FILL_RADIAL
		g.fill_from = Vector2(0.5, 0.5)
		g.fill_to = Vector2(1.05, 1.05)
		_treffer_rand.texture = g
		_treffer_rand.set_anchors_preset(Control.PRESET_FULL_RECT)
		_treffer_rand.stretch_mode = TextureRect.STRETCH_SCALE
		_treffer_rand.mouse_filter = Control.MOUSE_FILTER_IGNORE
		add_child(_treffer_rand)
		move_child(_treffer_rand, 0)
	_treffer_rand.modulate.a = clampf(0.35 + anteil * 3.0, 0.35, 1.0)
	var tw := create_tween()
	tw.tween_property(_treffer_rand, "modulate:a", 0.0, 0.45)


func raum_anzeigen(name: String) -> void:
	if _raum_label == null:
		return
	_raum_label.text = name.to_upper()
	var tw := create_tween()
	tw.tween_property(_raum_label, "modulate:a", 1.0, 0.2)
	tw.tween_interval(1.4)
	tw.tween_property(_raum_label, "modulate:a", 0.0, 0.5)


## Minikarte: Räume, du (grün), entdeckende Lehrer (gelb ?) und angreifende Lehrer (rot)
func _karte_zeichnen() -> void:
	var sch: Schule = arena
	var sk := _karte.size.x / Schule.BREITE
	_karte.draw_rect(Rect2(Vector2(-6, -6), _karte.size + Vector2(12, 12)), DUNKEL)
	for r in Schule.RAEUME:
		var a: Array = r["r"]
		var rect := Rect2(Vector2(a[0], a[1]) * sk, Vector2(a[2] - a[0], a[3] - a[1]) * sk)
		_karte.draw_rect(rect, Color.html(r["boden"][0]).darkened(0.1))
		_karte.draw_rect(rect, DUNKEL, false, 1.5)
	var plan_von := func(p: Vector3) -> Vector2:
		var q := p - Schule.URSPRUNG
		return Vector2(q.x, q.z) * sk
	for l in sch.lehrer_liste:
		if l.tot:
			continue
		var farbe := Color(0, 0, 0, 0)
		match l.zustand:
			"angriff", "alarm":
				farbe = ROT
			"warten", "suchen":
				farbe = Color("#FF9F1C")
			"misstrauisch":
				farbe = GOLD
			_:
				if l.global_position.distance_to(sch.spieler.global_position) < 14.0:
					farbe = Color(1, 1, 1, 0.8)
		if farbe.a > 0.0:
			_karte.draw_circle(plan_von.call(l.global_position), 4.0, farbe)
	if sch.spieler:
		var p: Vector2 = plan_von.call(sch.spieler.global_position)
		_karte.draw_circle(p, 6.0, DUNKEL)
		_karte.draw_circle(p, 4.5, GRUEN)


func _gadget_bauen() -> void:
	## Gadget: runder Knopf mit Ladungs-Punkten (am Handy antippbar, am PC Taste F)
	_gadget_anzeige = Control.new()
	_gadget_anzeige.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	var touch := DisplayServer.is_touchscreen_available()
	_gadget_anzeige.position = Vector2(-300, -150) if not touch else Vector2(-200, -470)
	_gadget_anzeige.size = Vector2(110, 110)
	_gadget_anzeige.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_gadget_anzeige.draw.connect(_gadget_zeichnen)
	add_child(_gadget_anzeige)
	if touch:
		_gadget_knopf = Button.new()
		_gadget_knopf.flat = true
		_gadget_knopf.set_anchors_preset(Control.PRESET_FULL_RECT)
		_gadget_knopf.pressed.connect(func():
			if arena and arena.spieler and arena.laeuft:
				arena.spieler.gadget_ausloesen(arena.spieler.blick))
		_gadget_anzeige.add_child(_gadget_knopf)
		_gadget_anzeige.mouse_filter = Control.MOUSE_FILTER_PASS


func _gadget_zeichnen() -> void:
	if arena == null or arena.spieler == null or arena.spieler.gadget_info.is_empty():
		return
	var k: Kaempfer = arena.spieler
	var m := Vector2(55, 55)
	var r := 46.0
	var bereit := k.gadget_bereit()
	_gadget_anzeige.draw_circle(m, r + 5, DUNKEL)
	_gadget_anzeige.draw_circle(m, r, Color("#2EC4B6") if bereit else Color("#3A2E4F"))
	var ab := k.gadget_abklingen()
	if ab > 0.0 and k.gadget_ladungen > 0:
		_gadget_anzeige.draw_arc(m, r - 6, -PI / 2, -PI / 2 + TAU * (1.0 - ab), 40, Color("#2EC4B6"), 8.0, true)
	var text := "F" if not DisplayServer.is_touchscreen_available() else "G"
	var fs := 34
	var tb := SCHRIFT.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs)
	_gadget_anzeige.draw_string_outline(SCHRIFT, m + Vector2(-tb.x / 2, 12), text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, 8, DUNKEL)
	_gadget_anzeige.draw_string(SCHRIFT, m + Vector2(-tb.x / 2, 12), text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color.WHITE)
	for i in Faehigkeiten.GADGET_LADUNGEN:
		var p := m + Vector2(-24 + i * 24, r + 16)
		_gadget_anzeige.draw_circle(p, 9, DUNKEL)
		_gadget_anzeige.draw_circle(p, 6, Color("#2EC4B6") if i < k.gadget_ladungen else Color("#4A3B63"))
	var name: String = k.gadget_info.get("name", "")
	var nb := SCHRIFT.get_string_size(name, HORIZONTAL_ALIGNMENT_LEFT, -1, 18)
	_gadget_anzeige.draw_string_outline(SCHRIFT, m + Vector2(-nb.x / 2, -r - 10), name, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, 6, DUNKEL)
	_gadget_anzeige.draw_string(SCHRIFT, m + Vector2(-nb.x / 2, -r - 10), name, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color.WHITE)


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
		var welt := kk.global_position + Vector3(0, kk.kopf_hoehe(), 0)
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


func ende(ergebnis: int, verdient := 0) -> void:
	_leisten.visible = false
	if _touch:
		_touch.visible = false
	_ende = _overlay()
	(_ende as ColorRect).color = Color(0.08, 0.05, 0.15, 0.25)
	var v: VBoxContainer = _ende.get_child(0).get_child(0)
	(_ende.get_child(0) as Control).offset_left = 700  # rechts neben der jubelnden Figur
	var text: String = {1: "SIEG!", -1: "NIEDERLAGE", 0: "UNENTSCHIEDEN"}[ergebnis]
	if modus == "schule":
		text = "SCHULE GEROCKT!" if ergebnis == 1 else "ERWISCHT!"
	var farbe: Color = {1: GOLD, -1: ROT, 0: Color.WHITE}[ergebnis]
	var t := _label(text, 120, farbe, 24)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	t.pivot_offset = Vector2(300, 70)
	v.add_child(t)
	var zeile := "%d : %d   ·   deine K.o.s: %d" % [arena.punkte[0], arena.punkte[1], arena.spieler.ko_zaehler]
	if modus == "schule":
		var sch: Schule = arena
		var g := int(arena.restzeit)
		zeile = "Lehrer besiegt: %d / %d   ·   Zeit %d:%02d" % [sch.lehrer_gesamt - sch.lehrer_uebrig(), sch.lehrer_gesamt, g / 60, g % 60]
	var s := _label(zeile, 34, Color.WHITE, 8)
	s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(s)
	var m := _label("+%d Münzen  (jetzt %d)" % [verdient, Konto.muenzen], 40, GOLD, 10)
	m.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(m)
	if _gadget_anzeige:
		_gadget_anzeige.visible = false
	v.add_child(_knopf("Nochmal!", Color("#FF9F1C"), func(): get_tree().reload_current_scene()))
	v.add_child(_knopf("Zum Menü", Color("#8E7DBE"), _zum_menue))
	t.scale = Vector2.ONE * 0.2
	var tw := create_tween()
	tw.tween_property(t, "scale", Vector2.ONE, 0.45).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
