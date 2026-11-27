## Hauptmenü: Start · Kämpfer-Sammlung · Box-Shop · Box öffnen
## Hintergrund ist eine 3D-Bühne (Figur auf Podest bzw. Truhe), darüber die Oberfläche.
extends Control

const SCHRIFT := preload("res://schrift/LilitaOne-Regular.ttf")
const DUNKEL := Color("#1B1424")
const GOLD := Color("#FFD23F")

var _bildschirm := "start"
var _ebene: Control              # wechselnder Inhalt
var _muenz_label: Label
var _buehne: Node3D
var _kamera: Camera3D
var _figur_halter: Node3D
var _figur: Node3D
var _podest: MeshInstance3D
var _truhe: Node3D               # der Laptop (Name aus Box-Zeiten)
var _deckel: Node3D
var _truhe_mats: Array = []
var _schirm_mat: ShaderMaterial
var _schirm_text: Label3D
var _wackeln := 0.0
var _kamera_basis := Vector3.ZERO
var _zeit := 0.0
var _ansicht_id := ""            # in der Sammlung angeklickter Charakter
var _oeffnet := false


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var bg := TextureRect.new()
	var g := GradientTexture2D.new()
	var gr := Gradient.new()
	gr.set_color(0, Color("#FFB347"))
	gr.set_color(1, Color("#FF5E8A"))
	g.gradient = gr
	g.fill_to = Vector2(1, 1)
	bg.texture = g
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.stretch_mode = TextureRect.STRETCH_SCALE
	add_child(bg)
	_buehne_bauen()
	_ebene = Control.new()
	_ebene.set_anchors_preset(Control.PRESET_FULL_RECT)
	_ebene.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_ebene)
	_kopfleiste()
	zeigen("start")


# ---------------------------------------------------------------- 3D-Bühne
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
	_kamera = Camera3D.new()
	_kamera.fov = 34
	_buehne.add_child(_kamera)
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
	env.glow_enabled = true
	env.glow_intensity = 0.5
	var we := WorldEnvironment.new()
	we.environment = env
	_buehne.add_child(we)
	_podest = MeshInstance3D.new()
	var zyl := CylinderMesh.new()
	zyl.top_radius = 0.8
	zyl.bottom_radius = 0.88
	zyl.height = 0.3
	_podest.mesh = zyl
	_podest.position.y = -0.15
	_podest.material_override = Toon.farbig(Color("#FFE8A3"), 0.02)
	_buehne.add_child(_podest)
	_figur_halter = Node3D.new()
	_buehne.add_child(_figur_halter)
	# Laptop aus der Blender-Datei (Unterteil + aufklappbarer Deckel)
	var objekte: Node = (load("res://arena/objekte.glb") as PackedScene).instantiate()
	_truhe = Node3D.new()
	_buehne.add_child(_truhe)
	for name in ["Laptop", "LaptopDeckel"]:
		var n: MeshInstance3D = objekte.get_node(name)
		objekte.remove_child(n)
		n.transform = Transform3D.IDENTITY
		_truhe_mats.append_array(Toon.anwenden(n, 0.018, true))
		if name == "Laptop":
			_truhe.add_child(n)
		else:
			_deckel = Node3D.new()
			_deckel.position = Vector3(0, 0.16, -0.55)   # Scharnier hinten oben
			_truhe.add_child(_deckel)
			_deckel.add_child(n)
	objekte.queue_free()
	# Bildschirm (Innenseite des Deckels)
	var schirm := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(1.46, 0.88)
	schirm.mesh = q
	schirm.position = Vector3(0, -0.016, 0.56)
	schirm.rotation_degrees = Vector3(90, 0, 0)
	_schirm_mat = ShaderMaterial.new()
	_schirm_mat.shader = preload("res://shader/bildschirm.gdshader")
	schirm.material_override = _schirm_mat
	_deckel.add_child(schirm)
	_schirm_text = Label3D.new()
	_schirm_text.font = SCHRIFT
	_schirm_text.font_size = 96
	_schirm_text.pixel_size = 0.0022
	_schirm_text.outline_size = 16
	_schirm_text.outline_modulate = DUNKEL
	_schirm_text.position = Vector3(0, -0.03, 0.66)
	_schirm_text.rotation_degrees = Vector3(90, 0, 0)
	_deckel.add_child(_schirm_text)
	_truhe.visible = false


func _kamera_auf(figur_links: bool) -> void:
	if figur_links:
		_kamera.position = Vector3(1.55, 1.25, 5.4)
		_kamera.look_at(Vector3(1.55, 0.95, 0))
	else:
		_kamera.position = Vector3(0, 1.9, 4.6)
		_kamera.look_at(Vector3(0, 0.55, 0))


func _figur_zeigen(c: Dictionary, gesperrt := false) -> void:
	if _figur:
		_figur.queue_free()
		_figur = null
	var pfad: String = c.get("modell", "")
	if pfad == "":
		return
	_figur = (load(pfad) as PackedScene).instantiate()
	_figur_halter.add_child(_figur)
	var mats := Toon.anwenden(_figur, 0.014, gesperrt)
	if gesperrt:
		for m in mats:
			(m as ShaderMaterial).set_shader_parameter("blitz", 1.0)
			(m as ShaderMaterial).set_shader_parameter("blitz_farbe", Color("#2A2140"))
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
	_wackeln = maxf(0.0, _wackeln - d * 1.5)
	_kamera.h_offset = randf_range(-1, 1) * _wackeln * 0.15
	_kamera.v_offset = randf_range(-1, 1) * _wackeln * 0.15
	if _figur_halter and _bildschirm != "oeffnen":
		_figur_halter.rotation.y = sin(_zeit * 0.6) * 0.5
	if _truhe and _truhe.visible and not _oeffnet and _bildschirm == "oeffnen" and _truhe.position.y == 0.0:
		_truhe.rotation.y = sin(_zeit * 1.2) * 0.12


# ---------------------------------------------------------------- Bausteine
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


func _stil(farbe: Color, radius := 24, rand := 7) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = farbe
	sb.set_corner_radius_all(radius)
	sb.border_color = DUNKEL
	sb.set_border_width_all(rand)
	sb.content_margin_left = 24
	sb.content_margin_right = 24
	sb.content_margin_top = 8
	sb.content_margin_bottom = 12
	sb.shadow_color = Color(0, 0, 0, 0.35)
	sb.shadow_offset = Vector2(0, 7)
	sb.shadow_size = 1
	return sb


func _knopf(text: String, farbe: Color, groesse: int, aktion: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_override("font", SCHRIFT)
	b.add_theme_font_size_override("font_size", groesse)
	b.add_theme_color_override("font_outline_color", DUNKEL)
	b.add_theme_color_override("font_disabled_color", Color(1, 1, 1, 0.5))
	b.add_theme_constant_override("outline_size", 12)
	b.add_theme_stylebox_override("normal", _stil(farbe))
	b.add_theme_stylebox_override("hover", _stil(farbe.lightened(0.12)))
	b.add_theme_stylebox_override("pressed", _stil(farbe.darkened(0.15)))
	b.add_theme_stylebox_override("focus", _stil(farbe))
	b.add_theme_stylebox_override("disabled", _stil(farbe.darkened(0.45)))
	b.pressed.connect(aktion)
	return b


func _panel(farbe: Color, radius := 26) -> PanelContainer:
	var p := PanelContainer.new()
	var sb := _stil(farbe, radius, 6)
	sb.content_margin_left = 22
	sb.content_margin_right = 22
	sb.content_margin_top = 16
	sb.content_margin_bottom = 18
	p.add_theme_stylebox_override("panel", sb)
	return p


func _kopfleiste() -> void:
	var logo := _label("KRAWALL CREW", 78, GOLD, 22)
	logo.position = Vector2(40, 18)
	logo.rotation = -0.04
	add_child(logo)
	var m := _panel(Color("#2A2140"), 22)
	m.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	m.position = Vector2(-300, 26)
	m.custom_minimum_size = Vector2(260, 0)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	var muenze := Control.new()
	muenze.custom_minimum_size = Vector2(44, 44)
	muenze.draw.connect(func():
		muenze.draw_circle(Vector2(22, 24), 21, DUNKEL)
		muenze.draw_circle(Vector2(22, 24), 17, GOLD)
		muenze.draw_circle(Vector2(22, 24), 10, Color("#F7B32B")))
	h.add_child(muenze)
	_muenz_label = _label(str(Konto.muenzen), 42, Color.WHITE, 10)
	h.add_child(_muenz_label)
	m.add_child(h)
	add_child(m)


func _muenzen_aktualisieren() -> void:
	_muenz_label.text = str(Konto.muenzen)


func _seltenheits_farbe(c: Dictionary) -> Color:
	return Color.html(Konto.seltenheit(c.get("seltenheit", "gewoehnlich"))["farbe"])


# ---------------------------------------------------------------- Bildschirme
func zeigen(name: String) -> void:
	_bildschirm = name
	for k in _ebene.get_children():
		k.queue_free()
	_truhe.visible = false
	_truhe.position = Vector3.ZERO
	_podest.visible = true
	_figur_halter.visible = true
	_muenzen_aktualisieren()
	match name:
		"start":
			_start()
		"kaempfer":
			_kaempfer()
		"boxen":
			_boxen()


func _start() -> void:
	_kamera_auf(true)
	var c := Daten.gewaehlt()
	_figur_zeigen(c)
	var info := VBoxContainer.new()
	info.position = Vector2(70, 600)
	info.add_theme_constant_override("separation", 0)
	var nm := _label(str(c["name"]).to_upper(), 64, Color.WHITE, 16)
	var selt := Konto.seltenheit(c.get("seltenheit", "gewoehnlich"))
	var zeile := _label("%s · Stufe %d" % [selt["name"], Konto.stufe(c["id"])], 32, _seltenheits_farbe(c), 9)
	info.add_child(nm)
	info.add_child(zeile)
	_ebene.add_child(info)
	var rechts := VBoxContainer.new()
	rechts.set_anchors_preset(Control.PRESET_RIGHT_WIDE)
	rechts.offset_left = -620
	rechts.offset_right = -60
	rechts.offset_top = 170
	rechts.offset_bottom = -60
	rechts.alignment = BoxContainer.ALIGNMENT_END
	rechts.add_theme_constant_override("separation", 22)
	_ebene.add_child(rechts)
	var stats := _label("Siege: %d   ·   K.o.s: %d   ·   Kämpfer: %d / %d" % [Konto.statistik["siege"], Konto.statistik["kos"],
		_anzahl_besitz(), Daten.charaktere.size()], 28, Color.WHITE, 8)
	stats.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	rechts.add_child(stats)
	rechts.add_child(_knopf("KÄMPFER", Color("#8E7DBE"), 54, func(): zeigen("kaempfer")))
	var boxen_knopf := _knopf("LAPTOPS", Color("#FF9F1C"), 54, func(): zeigen("boxen"))
	rechts.add_child(boxen_knopf)
	# Kartenauswahl: Klick wechselt zur nächsten Karte
	var karten := Schule.alle_karten()
	if karten.size() > 0:
		var akt := Schule.karte_laden(Konto.karte)
		var karten_info := _label(str(akt.get("info", "")), 22, Color(1, 1, 1, 0.85), 6)
		karten_info.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		karten_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		karten_info.custom_minimum_size = Vector2(560, 0)
		var karten_knopf: Button
		karten_knopf = _knopf("KARTE: %s  ▶" % str(akt.get("name", "")).to_upper(), Color("#3A7BD5"), 40, func():
			var ids: Array = karten.map(func(k): return k["id"])
			var i := (ids.find(Schule.karte_laden(Konto.karte)["id"]) + 1) % ids.size()
			Konto.karte = ids[i]
			Schule.karte_id = ids[i]
			Konto.speichern()
			karten_knopf.text = "KARTE: %s  ▶" % str(karten[i]["name"]).to_upper()
			karten_info.text = str(karten[i].get("info", "")))
		rechts.add_child(karten_info)
		rechts.add_child(karten_knopf)
	var spiel := _knopf("KÄMPFEN!", Color("#2EC4B6"), 80, _starten)
	spiel.custom_minimum_size = Vector2(0, 140)
	rechts.add_child(spiel)


func _anzahl_besitz() -> int:
	return Daten.charaktere.filter(func(c): return Konto.besitzt(c["id"])).size()


func _zurueck_knopf() -> void:
	var z := _knopf("◀ Zurück", Color("#8E7DBE"), 36, func(): zeigen("start"))
	z.position = Vector2(40, 140)
	_ebene.add_child(z)


# ---------------------------------------------------------------- Kämpfer-Sammlung
func _kaempfer() -> void:
	_kamera_auf(true)
	_zurueck_knopf()
	if _ansicht_id == "" or Daten.charakter(_ansicht_id).is_empty():
		_ansicht_id = Daten.gewaehlt()["id"]
	var c := Daten.charakter(_ansicht_id)
	_figur_zeigen(c, not Konto.besitzt(_ansicht_id))
	# Karten-Raster rechts oben
	var rahmen := ScrollContainer.new()
	rahmen.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	rahmen.position = Vector2(-880, 125)
	rahmen.size = Vector2(840, 260)
	rahmen.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_ebene.add_child(rahmen)
	var raster := GridContainer.new()
	raster.columns = 5
	raster.add_theme_constant_override("h_separation", 12)
	raster.add_theme_constant_override("v_separation", 12)
	rahmen.add_child(raster)
	var sortiert: Array = Daten.charaktere.duplicate()
	sortiert.sort_custom(func(a, b):
		var ra := Konto.seltenheit_rang(a.get("seltenheit", "")); var rb := Konto.seltenheit_rang(b.get("seltenheit", ""))
		return ra < rb if ra != rb else str(a["name"]) < str(b["name"]))
	for ch in sortiert:
		raster.add_child(_karte(ch))
	# Details unten rechts
	var det := _panel(Color("#2A2140", 0.92))
	det.anchor_left = 1.0
	det.anchor_right = 1.0
	det.anchor_top = 0.0
	det.anchor_bottom = 1.0
	det.offset_left = -880
	det.offset_right = -40
	det.offset_top = 400
	det.offset_bottom = -20
	_ebene.add_child(det)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 3)
	det.add_child(v)
	var besitzt := Konto.besitzt(c["id"])
	var selt := Konto.seltenheit(c.get("seltenheit", "gewoehnlich"))
	var kopf := HBoxContainer.new()
	kopf.add_child(_label(str(c["name"]).to_upper(), 40, Color.WHITE, 11))
	var s := _label("  %s%s" % [selt["name"], ("  ·  Stufe %d" % Konto.stufe(c["id"])) if besitzt else "  ·  GESPERRT"], 28, _seltenheits_farbe(c), 8)
	kopf.add_child(s)
	v.add_child(kopf)
	var a: Dictionary = c["angriff"]
	var sup := Faehigkeiten.voll("super", c["super"])
	v.add_child(_label("❤ %d Leben   ✦ %s: %d Schaden (%s)" % [int(float(c["werte"]["leben"]) * (1.0 + Kaempfer.STUFEN_BONUS * (Konto.stufe(c["id"]) - 1))),
		a["name"], int(a["schaden"]), a["typ"]], 22, Color.WHITE, 7))
	if not sup.is_empty():
		var sl := _label("★ SUPER – %s: %s" % [sup["name"], sup["beschreibung"]], 20, GOLD, 6)
		sl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		sl.custom_minimum_size = Vector2(790, 0)
		v.add_child(sl)
	for art in ["gadget", "passiv"]:
		var liste := Faehigkeiten.liste(c, art)
		if liste.is_empty():
			continue
		var titel := "GADGET (3× pro Match)" if art == "gadget" else "PASSIV (immer aktiv)"
		v.add_child(_label(titel, 22, Color("#7CFFCB") if art == "gadget" else Color("#FFB3C7"), 6))
		var zeile := HBoxContainer.new()
		zeile.add_theme_constant_override("separation", 10)
		var gewaehlt := Konto.gewaehlt_gadget(c["id"]) if art == "gadget" else Konto.gewaehlt_passiv(c["id"])
		for i in liste.size():
			var f: Dictionary = liste[i]
			var aktiv := i == gewaehlt
			var b := _knopf(f["name"], Color("#2EC4B6") if aktiv else Color("#4A3B63"), 19, func():
				Konto.waehlen(c["id"], art, i)
				zeigen("kaempfer"))
			b.tooltip_text = f["beschreibung"]
			b.disabled = not besitzt
			zeile.add_child(b)
		v.add_child(zeile)
		var beschr := _label(liste[clampi(gewaehlt, 0, liste.size() - 1)]["beschreibung"], 18, Color(1, 1, 1, 0.85), 5)
		v.add_child(beschr)
	if besitzt:
		var w := _knopf("✔ AUSGEWÄHLT" if Konto.gewaehlt == c["id"] else "AUSWÄHLEN", Color("#2EC4B6"), 26, func():
			Konto.gewaehlt = c["id"]
			Konto.speichern()
			zeigen("kaempfer"))
		w.disabled = Konto.gewaehlt == c["id"]
		v.add_child(w)
	else:
		v.add_child(_label("Diesen Kämpfer bekommst du aus Laptops.", 24, Color.WHITE, 7))


func _karte(c: Dictionary) -> Control:
	var besitzt := Konto.besitzt(c["id"])
	var farbe := _seltenheits_farbe(c)
	var b := Button.new()
	b.custom_minimum_size = Vector2(156, 122)
	var sb := _stil(farbe if besitzt else farbe.darkened(0.6), 18, 6 if c["id"] != _ansicht_id else 10)
	if c["id"] == _ansicht_id:
		sb.border_color = Color.WHITE
	b.add_theme_stylebox_override("normal", sb)
	b.add_theme_stylebox_override("hover", _stil(farbe.lightened(0.2) if besitzt else farbe.darkened(0.4), 18, 6))
	b.add_theme_stylebox_override("pressed", sb)
	b.add_theme_stylebox_override("focus", sb)
	b.pressed.connect(func():
		_ansicht_id = c["id"]
		zeigen("kaempfer"))
	var v := VBoxContainer.new()
	v.set_anchors_preset(Control.PRESET_FULL_RECT)
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(v)
	var gross := _label(str(c["name"]).left(1).to_upper() if besitzt else "?", 42, Color.WHITE, 10)
	gross.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	gross.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(gross)
	var n := _label(str(c["name"]), 24, Color.WHITE, 7)
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	n.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(n)
	var st := _label(("Stufe %d" % Konto.stufe(c["id"])) if besitzt else "gesperrt", 18, Color.WHITE, 5)
	st.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	st.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(st)
	return b


# ---------------------------------------------------------------- Box-Shop
func _boxen() -> void:
	_zurueck_knopf()
	_figur_halter.visible = false
	_podest.visible = false
	var reihe := HBoxContainer.new()
	reihe.set_anchors_preset(Control.PRESET_CENTER)
	reihe.position = Vector2(-760, -250)
	reihe.add_theme_constant_override("separation", 30)
	_ebene.add_child(reihe)
	for b in Konto.boxen:
		var farbe := Color.html(b["farbe"])
		var p := _panel(farbe.darkened(0.35))
		p.custom_minimum_size = Vector2(480, 560)
		var v := VBoxContainer.new()
		v.add_theme_constant_override("separation", 10)
		p.add_child(v)
		var t := _label(b["name"].to_upper(), 50, Color.WHITE, 14)
		t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(t)
		var m := _label("%d – %d Münzen drin" % [b["muenzen"][0], b["muenzen"][1]], 24, GOLD, 7)
		m.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(m)
		v.add_child(_label("Chance auf einen Kämpfer:", 24, Color.WHITE, 7))
		var summe := 0.0
		for s in Konto.seltenheiten:
			var pr := float(b["chancen"].get(s["id"], 0.0))
			summe += pr
			if pr <= 0.0:
				continue
			var z := HBoxContainer.new()
			var n := _label(s["name"], 26, Color.html(s["farbe"]), 8)
			n.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			z.add_child(n)
			z.add_child(_label("%s %%" % str(pr), 26, Color.WHITE, 8))
			v.add_child(z)
		var rest := HBoxContainer.new()
		var rn := _label("Nur Münzen", 24, Color(1, 1, 1, 0.75), 7)
		rn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		rest.add_child(rn)
		rest.add_child(_label("%s %%" % str(snappedf(maxf(0.0, 100.0 - summe), 0.1)), 24, Color(1, 1, 1, 0.75), 7))
		v.add_child(rest)
		var platz := Control.new()
		platz.size_flags_vertical = Control.SIZE_EXPAND_FILL
		v.add_child(platz)
		var kauf := _knopf("ÖFFNEN  ·  %d" % b["preis"], Color("#2EC4B6"), 40, func(): _box_oeffnen(b["id"]))
		kauf.disabled = not Konto.kann_kaufen(b["id"])
		v.add_child(kauf)
		reihe.add_child(p)
	var hinweis := _label("Garantie: Spätestens jeder %d. Laptop enthält einen Kämpfer. Neue Kämpfer kommen bevorzugt, doppelte geben +1 Stufe (+6 %% Leben & Schaden)." % int(Konto.regeln.get("garantie_nach", 8)), 24, Color.WHITE, 7)
	hinweis.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	hinweis.position = Vector2(-760, -80)
	hinweis.size = Vector2(1520, 40)
	hinweis.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_ebene.add_child(hinweis)


# ---------------------------------------------------------------- Laptop öffnen
## Ablauf: 1) Laptop fällt herein  2) Antippen  3) Deckel ruckelt, Funken aus dem Spalt
## 4) Deckel springt auf, Bildschirm lädt (Balken klettert durch die Seltenheitsfarben)
## 5) Glitch + Lichtsäule + Explosion  6) Kämpfer wird aus dem Bildschirm "heruntergeladen"
func _box_oeffnen(box_id: String) -> void:
	var b := Konto.box(box_id)
	var e := Konto.box_oeffnen(box_id)
	if e.is_empty():
		return
	_bildschirm = "oeffnen"
	_oeffnet = false
	for k in _ebene.get_children():
		k.queue_free()
	_muenz_label.text = str(Konto.muenzen - e["muenzen"] - e["duplikat_muenzen"])
	_figur_halter.visible = false
	_podest.visible = false
	if _figur:
		_figur.queue_free()
		_figur = null
	_figur_halter.position = Vector3.ZERO
	_kamera.position = Vector3(0, 2.3, 4.2)
	_kamera.look_at(Vector3(0, 0.45, 0))
	_truhe.visible = true
	_truhe.rotation = Vector3.ZERO
	_truhe.scale = Vector3.ONE
	_truhe.position = Vector3(0, 5, 0)
	_deckel.rotation = Vector3.ZERO
	_schirm_mat.set_shader_parameter("an", 0.0)
	_schirm_mat.set_shader_parameter("fortschritt", 0.0)
	_schirm_mat.set_shader_parameter("glitch", 0.0)
	_schirm_mat.set_shader_parameter("blitz", 0.0)
	_schirm_text.text = ""
	var stufen_farbe := Color.html(b["farbe"])
	for m in _truhe_mats:
		var sm: ShaderMaterial = m
		if sm.resource_name == "pc_gehaeuse":
			sm.set_shader_parameter("farbe", stufen_farbe)
		sm.set_shader_parameter("blitz", 0.0)
	# 1) Reinfallen mit Drehung und Aufprall
	var tw := create_tween()
	tw.set_parallel(true)
	tw.tween_property(_truhe, "position:y", 0.0, 0.55).set_trans(Tween.TRANS_BOUNCE).set_ease(Tween.EASE_OUT)
	tw.tween_property(_truhe, "rotation:y", 0.0, 0.55).from(-TAU).set_ease(Tween.EASE_OUT)
	tw.chain().tween_callback(func():
		_wackeln = 0.25
		Effekte.ring(_buehne, Vector3.ZERO, 2.0, Color.WHITE, 0.3)
		Arena.ton("explosion"))
	var tipp := _label("Tippen zum Hochfahren!", 54, Color.WHITE, 14)
	tipp.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	tipp.position = Vector2(-400, -150)
	tipp.size = Vector2(800, 80)
	tipp.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_ebene.add_child(tipp)
	var name_l := _label(str(b["name"]).to_upper(), 44, stufen_farbe.lightened(0.3), 12)
	name_l.set_anchors_preset(Control.PRESET_CENTER_TOP)
	name_l.position = Vector2(-400, 120)
	name_l.size = Vector2(800, 60)
	name_l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_ebene.add_child(name_l)
	var flaeche := Button.new()
	flaeche.flat = true
	flaeche.set_anchors_preset(Control.PRESET_FULL_RECT)
	_ebene.add_child(flaeche)
	flaeche.pressed.connect(func():
		flaeche.queue_free()
		tipp.queue_free()
		name_l.queue_free()
		_enthuellen(e, box_id), CONNECT_ONE_SHOT)


func _schirm(text: String, farbe: Color) -> void:
	_schirm_text.text = text
	_schirm_text.modulate = farbe


func _funken(von: Vector3, farbe: Color, anzahl: int, kraft := 1.5) -> void:
	for i in anzahl:
		var k := MeshInstance3D.new()
		var sp := SphereMesh.new()
		sp.radius = randf_range(0.03, 0.07)
		sp.height = sp.radius * 2.0
		sp.radial_segments = 8
		sp.rings = 4
		k.mesh = sp
		k.material_override = Toon.farbig(farbe.lightened(snappedf(randf() * 0.4, 0.1)), 0.0, 1.5)
		_buehne.add_child(k)
		k.position = von
		var ziel := von + Vector3(randf_range(-1, 1), randf_range(0.3, 1.5), randf_range(-0.6, 1)) * kraft
		var t := k.create_tween()
		t.set_parallel(true)
		t.tween_property(k, "position", ziel, randf_range(0.35, 0.7)).set_ease(Tween.EASE_OUT).set_trans(Tween.TRANS_QUAD)
		t.tween_property(k, "scale", Vector3.ONE * 0.01, 0.7).set_ease(Tween.EASE_IN)
		t.chain().tween_callback(k.queue_free)


func _lichtsaeule(farbe: Color) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var z := CylinderMesh.new()
	z.top_radius = 0.75
	z.bottom_radius = 0.45
	z.height = 6.0
	z.cap_top = false
	z.cap_bottom = false
	m.mesh = z
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.albedo_color = Color(farbe.r, farbe.g, farbe.b, 0.55)
	m.material_override = mat
	_buehne.add_child(m)
	m.position = Vector3(0, 3.2, -0.1)
	m.scale = Vector3(0.05, 1, 0.05)
	return m


func _enthuellen(e: Dictionary, box_id: String) -> void:
	_oeffnet = true
	_truhe.rotation = Vector3.ZERO
	var hat_kaempfer: bool = e["charakter"] != ""
	var c := Daten.charakter(e["charakter"]) if hat_kaempfer else {}
	var rang := Konto.seltenheit_rang(e["seltenheit"]) if hat_kaempfer else -1
	var farbe := Color.html(Konto.seltenheit(e["seltenheit"])["farbe"]) if hat_kaempfer else GOLD
	# 3) Deckel ruckelt, Funken quellen aus dem Spalt
	for i in 6:
		var t := create_tween()
		t.tween_property(_deckel, "rotation:x", randf_range(-0.12, -0.3), 0.06)
		t.tween_property(_deckel, "rotation:x", -0.02, 0.07)
		_truhe.rotation.z = randf_range(-0.05, 0.05)
		_funken(Vector3(0, 0.2, 0.3), Color("#7CFFCB"), 3, 0.8)
		Arena.ton("zaehlen")
		await t.finished
	_truhe.rotation.z = 0.0
	# 4) Deckel springt auf, Bildschirm fährt hoch
	var auf := create_tween()
	auf.tween_property(_deckel, "rotation:x", -1.83, 0.45).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	_wackeln = 0.3
	Arena.ton("super")
	_funken(Vector3(0, 0.3, 0), Color.WHITE, 14, 1.6)
	await auf.finished
	_schirm_mat.set_shader_parameter("an", 1.0)
	_schirm("BOOTE ...", Color.WHITE)
	await get_tree().create_timer(0.4).timeout
	# Ladebalken: klettert durch alle Seltenheitsfarben bis zur gezogenen (Spannung!)
	var stufen: Array = Konto.seltenheiten.slice(0, maxi(rang, 0) + 1) if hat_kaempfer else []
	var dauer := 0.9 + 0.45 * maxi(rang, 0)
	var start_z := Time.get_ticks_msec()
	while true:
		var f := clampf((Time.get_ticks_msec() - start_z) / 1000.0 / dauer, 0.0, 1.0)
		var idx := mini(int(f * stufen.size()), stufen.size() - 1) if stufen.size() > 0 else -1
		var bf := Color.html(stufen[idx]["farbe"]) if idx >= 0 else GOLD
		_schirm_mat.set_shader_parameter("farbe", bf)
		_schirm_mat.set_shader_parameter("fortschritt", f)
		_schirm_mat.set_shader_parameter("glitch", f * f * 0.6)
		_schirm("LADE %d %%" % int(f * 100.0), bf)
		_truhe.position.x = randf_range(-1, 1) * 0.03 * f
		_truhe.position.z = randf_range(-1, 1) * 0.03 * f
		_wackeln = maxf(_wackeln, f * 0.12)
		if randf() < 0.25:
			_funken(Vector3(randf_range(-0.6, 0.6), 0.2, randf_range(-0.2, 0.4)), bf, 2, 0.6 + f)
		if f >= 1.0:
			break
		await get_tree().process_frame
	_truhe.position = Vector3.ZERO
	# 5) Glitch – Blitz – BOOM
	_schirm_mat.set_shader_parameter("glitch", 1.0)
	_schirm("!!!", Color.WHITE)
	await get_tree().create_timer(0.25).timeout
	_schirm_mat.set_shader_parameter("blitz", 1.0)
	for m in _truhe_mats:
		(m as ShaderMaterial).set_shader_parameter("blitz_farbe", farbe)
		(m as ShaderMaterial).set_shader_parameter("blitz", 0.9)
	_wackeln = 0.6
	Arena.ton("explosion")
	Arena.ton("sieg" if hat_kaempfer else "super")
	var saeule := _lichtsaeule(farbe)
	var breite := 1.0 + 0.4 * maxi(rang, 0)
	create_tween().tween_property(saeule, "scale", Vector3(breite, 1, breite), 0.25).set_trans(Tween.TRANS_BACK)
	for i in 3:
		Effekte.ring(_buehne, Vector3(0, 0.05 + i * 0.12, 0), 1.3 + i * 0.6, farbe if i % 2 == 0 else Color.WHITE, 0.35 + i * 0.1)
	_funken(Vector3(0, 0.8, 0.2), farbe, 30 + 10 * maxi(rang, 0), 2.5)
	create_tween().tween_method(func(v: float):
		for m in _truhe_mats:
			(m as ShaderMaterial).set_shader_parameter("blitz", v)
		_schirm_mat.set_shader_parameter("blitz", v), 0.9, 0.0, 0.8)
	await get_tree().create_timer(0.35).timeout
	# 6) Ergebnis
	var v := VBoxContainer.new()
	v.anchor_left = 1.0
	v.anchor_right = 1.0
	v.offset_left = -720
	v.offset_right = -40
	v.offset_top = 150
	v.offset_bottom = 620
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	_ebene.add_child(v)
	if hat_kaempfer:
		_schirm("DOWNLOAD!", farbe)
		# Kämpfer wird aus dem Bildschirm "heruntergeladen": Scan-Ring fährt hoch, Figur fliegt nach vorne
		_figur_halter.visible = true
		_figur_halter.rotation.y = 0.0
		_figur_halter.position = Vector3(0, 0.6, -0.35)
		_figur_zeigen(c)
		_figur_halter.scale = Vector3(0.05, 0.05, 0.05)
		var scan := MeshInstance3D.new()
		var tr := TorusMesh.new()
		tr.inner_radius = 0.55
		tr.outer_radius = 0.62
		scan.mesh = tr
		scan.material_override = Toon.unschattiert(farbe.lightened(0.3))
		_buehne.add_child(scan)
		scan.position = Vector3(1.25, 0.0, 1.0)
		var t6 := create_tween()
		t6.set_parallel(true)
		t6.tween_property(_figur_halter, "position", Vector3(1.25, 0.0, 1.0), 0.55).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		t6.tween_property(_figur_halter, "scale", Vector3.ONE, 0.55).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		t6.tween_property(scan, "position:y", 2.0, 0.7).set_delay(0.3)
		t6.tween_property(scan, "scale", Vector3(1.3, 1, 1.3), 0.7).set_delay(0.3)
		t6.chain().tween_callback(scan.queue_free)
		var aps := _figur.find_children("*", "AnimationPlayer", true, false) if _figur else []
		if aps.size() > 0 and (aps[0] as AnimationPlayer).has_animation("Victory"):
			(aps[0] as AnimationPlayer).get_animation("Victory").loop_mode = Animation.LOOP_LINEAR
			(aps[0] as AnimationPlayer).play("Victory")
		# Kamera fährt zurück und zeigt Laptop + Kämpfer links, Text rechts
		var k_von := _kamera.position
		create_tween().tween_method(func(f: float):
			_kamera.position = k_von.lerp(Vector3(2.4, 1.5, 6.8), f)
			_kamera.look_at(Vector3(0, 0.45, 0).lerp(Vector3(2.2, 0.9, 0.3), f)), 0.0, 1.0, 0.6)
		var kopf := "NEUER KÄMPFER!" if e["neu"] else ("STUFE %d!" % e["stufe"] if e["duplikat_muenzen"] == 0 else "MAXIMALSTUFE – +%d MÜNZEN" % e["duplikat_muenzen"])
		var k := _label(kopf, 50, Color.WHITE, 14)
		k.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(k)
		var n := _label(str(c.get("name", "?")).to_upper(), 96, farbe, 22)
		n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		n.pivot_offset = Vector2(340, 55)
		v.add_child(n)
		var s := _label(Konto.seltenheit(e["seltenheit"])["name"] + ("  ·  Garantie!" if e["garantie"] else ""), 36, farbe, 10)
		s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(s)
		n.scale = Vector2.ONE * 0.2
		create_tween().tween_property(n, "scale", Vector2.ONE, 0.5).set_trans(Tween.TRANS_ELASTIC).set_ease(Tween.EASE_OUT)
	else:
		_schirm("MÜNZEN!", GOLD)
		_funken(Vector3(0, 0.6, 0.3), GOLD, 40, 2.0)
		var k2 := _label("Nur Münzen dieses Mal …", 50, Color.WHITE, 14)
		k2.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(k2)
		var p := _label("Noch %d Laptop(s) bis zur Garantie" % maxi(0, int(Konto.regeln.get("garantie_nach", 8)) - Konto.pech_zaehler), 30, Color.WHITE, 8)
		p.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(p)
	var mz := _label("+%d Münzen" % (e["muenzen"] + e["duplikat_muenzen"]), 46, GOLD, 12)
	mz.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(mz)
	_muenzen_aktualisieren()
	create_tween().tween_property(saeule, "scale", Vector3(0.01, 1, 0.01), 0.8).set_delay(0.6)
	get_tree().create_timer(1.5).timeout.connect(saeule.queue_free)
	var knoepfe := HBoxContainer.new()
	knoepfe.anchor_left = 1.0
	knoepfe.anchor_right = 1.0
	knoepfe.anchor_top = 1.0
	knoepfe.anchor_bottom = 1.0
	knoepfe.offset_left = -720
	knoepfe.offset_right = -40
	knoepfe.offset_top = -150
	knoepfe.alignment = BoxContainer.ALIGNMENT_CENTER
	knoepfe.add_theme_constant_override("separation", 20)
	_ebene.add_child(knoepfe)
	knoepfe.add_child(_knopf("Weiter", Color("#8E7DBE"), 32, func():
		_oeffnet = false
		zeigen("boxen")))
	var nochmal := _knopf("Noch einer (%d)" % Konto.box(box_id)["preis"], Color("#FF9F1C"), 32, func(): _box_oeffnen(box_id))
	nochmal.disabled = not Konto.kann_kaufen(box_id)
	knoepfe.add_child(nochmal)
	if hat_kaempfer and e["neu"]:
		knoepfe.add_child(_knopf("Ansehen", Color("#2EC4B6"), 32, func():
			_oeffnet = false
			_ansicht_id = c["id"]
			zeigen("kaempfer")))


# ---------------------------------------------------------------- Start
func _unhandled_input(e: InputEvent) -> void:
	if _bildschirm == "start" and e.is_action_pressed("ui_accept"):
		_starten()
	elif e.is_action_pressed("pause") and _bildschirm != "start" and _bildschirm != "oeffnen":
		zeigen("start")


func _starten() -> void:
	if Daten.charaktere.is_empty():
		return
	get_tree().change_scene_to_file("res://szenen/schule.tscn")
