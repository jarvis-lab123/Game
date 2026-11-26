## Ein Match "Krawall": 3 gegen 3, wer zuerst 10 K.o.s schafft (oder nach Ablauf der Zeit vorne liegt), gewinnt.
class_name Arena
extends Node3D

const K := 1.6               # Kachelgröße (muss zu blender/umgebung_bauen.py passen)
const SIEG_KOS := 10
const SPIELZEIT := 150.0
const WIEDERBELEBEN := 4.0

# Karte: obere Hälfte + Mittelreihe, untere Hälfte wird gespiegelt (r → b)
# .  Boden   #  Mauer   K  Kiste (zerstörbar)   B  Busch   W  Wasser   r/b  Startpunkte
const KARTE_OBEN := [
	"..BB....r....BB..",
	"..BB..r...r..BB..",
	".................",
	"..##...KKK...##..",
	"..##.........##..",
	"BB.....BBB.....BB",
	"BB..K..BBB..K..BB",
	"....K.......K....",
	"....K..WWW..K....",
	"..BB...WWW...BB..",
	"..BB.........BB..",
	"...##.......##...",
	"BB.....###.....BB",
]

var karte: Array[String] = []
var breite := 0
var hoehe := 0
var kaempfer: Array = []
var spieler: Kaempfer
var punkte := [0, 0]
var restzeit := SPIELZEIT
var laeuft := false
var vorbei := false

var _astar := AStarGrid2D.new()
var _busch := {}
var _kisten := {}
var _spawns := [[], []]
var _vorlagen := {}
var _kamera: Camera3D
var _kamera_ziel := Vector3.ZERO
var _wackeln := 0.0
var _ziel_anzeige: MeshInstance3D
var _ziel_kreis: MeshInstance3D
var hud: Hud

static var _toene := {}
static var _ton_spieler: Array = []


func _ready() -> void:
	randomize()
	_karte_aufbauen()
	_umgebung()
	_objekte_setzen()
	_kamera_bauen()
	_kaempfer_erzeugen()
	hud = Hud.new()
	hud.arena = self
	add_child(hud)
	_ziel_anzeige_bauen()
	_countdown()


# ---------------------------------------------------------------- Karte
func _karte_aufbauen() -> void:
	karte.clear()
	for z in KARTE_OBEN:
		karte.append(z)
	for i in range(KARTE_OBEN.size() - 2, -1, -1):
		karte.append((KARTE_OBEN[i] as String).replace("r", "b"))
	hoehe = karte.size()
	breite = karte[0].length()
	for z in karte:
		assert(z.length() == breite, "Kartenzeile hat falsche Länge: " + z)
	_astar.region = Rect2i(0, 0, breite, hoehe)
	_astar.cell_size = Vector2.ONE
	_astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	_astar.update()
	for r in hoehe:
		for c in breite:
			var ch := karte[r][c]
			if ch in ["#", "K", "W"]:
				_astar.set_point_solid(Vector2i(c, r), true)
			if ch == "B":
				_busch[Vector2i(c, r)] = true
			if ch == "r":
				_spawns[1].append(kachel_mitte(c, r))
			if ch == "b":
				_spawns[0].append(kachel_mitte(c, r))


func kachel_mitte(c: int, r: int) -> Vector3:
	return Vector3((c - (breite - 1) / 2.0) * K, 0, (r - (hoehe - 1) / 2.0) * K)


func kachel_von(p: Vector3) -> Vector2i:
	return Vector2i(roundi(p.x / K + (breite - 1) / 2.0), roundi(p.z / K + (hoehe - 1) / 2.0))


func halb_groesse() -> Vector2:
	return Vector2(breite * K / 2.0, hoehe * K / 2.0)


func ist_busch(p: Vector3) -> bool:
	return _busch.has(kachel_von(p))


func _umgebung() -> void:
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("#8FD3FF")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("#B9B4F0")
	env.ambient_light_energy = 0.62
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	env.glow_enabled = true
	env.glow_intensity = 0.35
	env.glow_bloom = 0.05
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.12
	we.environment = env
	add_child(we)
	var sonne := DirectionalLight3D.new()
	sonne.rotation_degrees = Vector3(-58, -32, 0)
	sonne.light_color = Color("#FFF4E0")
	sonne.light_energy = 1.25
	sonne.shadow_enabled = true
	sonne.shadow_opacity = 0.75
	sonne.directional_shadow_max_distance = 45.0
	sonne.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	add_child(sonne)
	# Boden
	var boden := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(120, 120)
	boden.mesh = pm
	var bm := ShaderMaterial.new()
	bm.shader = preload("res://shader/boden.gdshader")
	bm.set_shader_parameter("kachel", K)
	bm.set_shader_parameter("halb_groesse", halb_groesse())
	boden.material_override = bm
	add_child(boden)
	# unsichtbare Außenwände
	var hg := halb_groesse()
	for w in [[Vector3(0, 1, -hg.y - 0.5), Vector3(hg.x * 2 + 2, 2, 1)], [Vector3(0, 1, hg.y + 0.5), Vector3(hg.x * 2 + 2, 2, 1)],
			[Vector3(-hg.x - 0.5, 1, 0), Vector3(1, 2, hg.y * 2 + 2)], [Vector3(hg.x + 0.5, 1, 0), Vector3(1, 2, hg.y * 2 + 2)]]:
		_kollision(w[0], w[1], 1)


func _kollision(pos: Vector3, groesse: Vector3, ebene: int) -> StaticBody3D:
	var sb := StaticBody3D.new()
	sb.collision_layer = ebene
	sb.collision_mask = 0
	var cs := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = groesse
	cs.shape = box
	sb.add_child(cs)
	add_child(sb)
	sb.position = pos
	return sb


func _vorlage(name: String) -> MeshInstance3D:
	if _vorlagen.is_empty():
		var szene: Node = (load("res://arena/objekte.glb") as PackedScene).instantiate()
		for n in szene.get_children():
			if n is MeshInstance3D:
				var mi: MeshInstance3D = n
				mi.transform = Transform3D.IDENTITY
				Toon.anwenden(mi, 0.02)
				_vorlagen[n.name] = mi
	return _vorlagen.get(name)


func _setze(name: String, pos: Vector3, drehung := 0.0, skala := 1.0) -> MeshInstance3D:
	var v := _vorlage(name)
	if v == null:
		return null
	var m: MeshInstance3D = v.duplicate()
	add_child(m)
	m.position = pos
	m.rotation.y = drehung
	m.scale = Vector3.ONE * skala
	return m


func _objekte_setzen() -> void:
	for r in hoehe:
		for c in breite:
			var p := kachel_mitte(c, r)
			match karte[r][c]:
				"#":
					_setze("Wand", p)
					_kollision(p + Vector3(0, 0.7, 0), Vector3(K, 1.4, K), 1)
				"K":
					var vis := _setze("Kiste", p, randi_range(0, 3) * PI / 2)
					var sb := _kollision(p + Vector3(0, 0.7, 0), Vector3(K * 0.86, 1.4, K * 0.86), 1)
					_kisten[Vector2i(c, r)] = [vis, sb]
				"B":
					_setze("Busch", p, randf() * TAU, randf_range(0.95, 1.1))
				"W":
					_setze("Wasser", p)
					_kollision(p + Vector3(0, 0.5, 0), Vector3(K, 1.0, K), 4)
				"r", "b":
					var sp := _setze("Spawn", p)
					if sp:
						for i in sp.mesh.get_surface_count():
							sp.set_surface_override_material(i, Toon.farbig(Color("#FF8FA0") if karte[r][c] == "r" else Color("#8FD0FF"), 0.02))
	# Rand-Deko: Zaun um die Arena, Bäume und Felsen außen herum
	var hg := halb_groesse()
	var x := -hg.x + K / 2.0
	while x < hg.x:
		_setze("Zaun", Vector3(x, 0, -hg.y - 0.3))
		_setze("Zaun", Vector3(x, 0, hg.y + 0.3), PI)
		x += K
	var z := -hg.y + K / 2.0
	while z < hg.y:
		_setze("Zaun", Vector3(-hg.x - 0.3, 0, z), PI / 2)
		_setze("Zaun", Vector3(hg.x + 0.3, 0, z), -PI / 2)
		z += K
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	for i in 70:
		var seite := rng.randi_range(0, 3)
		var p := Vector3.ZERO
		match seite:
			0: p = Vector3(rng.randf_range(-hg.x - 10, hg.x + 10), 0, -hg.y - rng.randf_range(2, 9))
			1: p = Vector3(rng.randf_range(-hg.x - 10, hg.x + 10), 0, hg.y + rng.randf_range(2.5, 9))
			2: p = Vector3(-hg.x - rng.randf_range(2, 9), 0, rng.randf_range(-hg.y - 8, hg.y + 8))
			3: p = Vector3(hg.x + rng.randf_range(2, 9), 0, rng.randf_range(-hg.y - 8, hg.y + 8))
		_setze("Baum" if rng.randf() < 0.65 else "Fels", p, rng.randf() * TAU, rng.randf_range(0.9, 1.4))


func kiste_zerstoeren(kachel: Vector2i) -> void:
	if not _kisten.has(kachel):
		return
	var teile: Array = _kisten[kachel]
	_kisten.erase(kachel)
	Effekte.puff(self, kachel_mitte(kachel.x, kachel.y) + Vector3(0, 0.6, 0), Color("#C98B4B"))
	for t in teile:
		if is_instance_valid(t):
			t.queue_free()
	_astar.set_point_solid(kachel, false)


# ---------------------------------------------------------------- Kämpfer
func _kaempfer_erzeugen() -> void:
	var liste: Array = Daten.charaktere
	var eigene: Dictionary = Daten.gewaehlt()
	for team in 2:
		for i in 3:
			var d: Dictionary
			if team == 0 and i == 0:
				d = eigene
			else:
				d = liste[randi() % liste.size()] if liste.size() > 0 else Daten.STANDARD
			var k := Kaempfer.new()
			k.name = "%s_%d_%d" % [d.get("id", "k"), team, i]
			add_child(k)
			var ist_sp := team == 0 and i == 0
			var id: String = d.get("id", "")
			if ist_sp:
				k.einrichten(d, team, true, self, Konto.stufe(id), Konto.gewaehlt_gadget(id), Konto.gewaehlt_passiv(id))
			else:
				# Bots: ungefähr auf der Stufe des Spielers, mit zufälligem Gadget/Passiv
				var st := clampi(Konto.stufe(eigene.get("id", "")) + randi_range(-1, 1), 1, int(Konto.regeln.get("max_stufe", 10)))
				k.einrichten(d, team, false, self, st, randi() % 4, randi() % 4)
			k.spawn_punkt = _spawns[team][i % _spawns[team].size()]
			k.global_position = k.spawn_punkt
			k.blick = Vector3(0, 0, -1) if team == 0 else Vector3(0, 0, 1)
			k.modell.rotation.y = atan2(k.blick.x, k.blick.z)
			k.ausgeschaltet.connect(_bei_ko)
			kaempfer.append(k)
			if k.ist_spieler:
				spieler = k


func gegner_von(team: int) -> Array:
	return kaempfer.filter(func(k): return k.team != team and not k.tot)


func team_von(team: int) -> Array:
	return kaempfer.filter(func(k): return k.team == team and not k.tot)


func sichtbar_fuer(ziel: Kaempfer, betrachter: Kaempfer) -> bool:
	if ziel.team == betrachter.team:
		return true
	if ziel.ist_unsichtbar():
		return ziel.global_position.distance_to(betrachter.global_position) < 1.8
	if not ziel.im_busch:
		return true
	if ziel.global_position.distance_to(betrachter.global_position) < 3.2:
		return true
	return ziel.zeit() - ziel._letzter_angriff < 1.0 or ziel.zeit() - ziel._letzter_schaden < 0.6


func freie_sicht(a: Vector3, b: Vector3) -> bool:
	var q := PhysicsRayQueryParameters3D.create(a + Vector3(0, 1, 0), b + Vector3(0, 1, 0), 1)
	return get_world_3d().direct_space_state.intersect_ray(q).is_empty()


func pfad(von: Vector3, nach: Vector3) -> PackedVector3Array:
	var a := _frei(kachel_von(von))
	var b := _frei(kachel_von(nach))
	var punkte_2d := _astar.get_id_path(a, b, true)
	var out := PackedVector3Array()
	for i in range(1, punkte_2d.size()):
		out.append(kachel_mitte(punkte_2d[i].x, punkte_2d[i].y))
	if punkte_2d.size() <= 1:
		out.append(Vector3(nach.x, 0, nach.z))
	return out


func _frei(p: Vector2i) -> Vector2i:
	p.x = clampi(p.x, 0, breite - 1)
	p.y = clampi(p.y, 0, hoehe - 1)
	if not _astar.is_point_solid(p):
		return p
	for r in range(1, 4):
		for dx in range(-r, r + 1):
			for dy in range(-r, r + 1):
				var q := p + Vector2i(dx, dy)
				if _astar.region.has_point(q) and not _astar.is_point_solid(q):
					return q
	return p


func vorruecken_punkt(team: int) -> Vector3:
	return Vector3(randf_range(-6, 6), 0, -5.0 if team == 0 else 5.0)


# ---------------------------------------------------------------- Angriffe
func projektil(quelle: Kaempfer, start: Vector3, richtung: Vector3, tempo: float, weite: float, schaden: float,
		farbe: Color, radius: float) -> void:
	var p := Projektil.new()
	p.quelle = quelle
	p.arena = self
	p.team = quelle.team
	p.richtung = richtung
	p.tempo = tempo
	p.rest = weite
	p.schaden = schaden
	p.farbe = farbe
	p.radius = radius
	p.position = start
	add_child(p)


func wurf(quelle: Kaempfer, start: Vector3, ziel: Vector3, schaden: float, radius: float, farbe: Color, gross: bool) -> void:
	var p := Projektil.new()
	p.quelle = quelle
	p.arena = self
	p.team = quelle.team
	p.ist_wurf = true
	p.start = start
	p.ziel = Vector3(ziel.x, 0, ziel.z)
	p.dauer = 0.45 + start.distance_to(ziel) / 18.0
	p.schaden = schaden
	p.farbe = farbe
	p.radius = 0.32 if gross else 0.22
	p.explosions_radius = radius
	p.zerstoert_waende = gross
	p.position = start
	add_child(p)


func explosion(quelle: Kaempfer, team: int, pos: Vector3, radius: float, schaden: float, farbe: Color, zerstoert: bool) -> void:
	Effekte.explosion(self, pos, radius, farbe)
	ton("explosion")
	wackeln(0.35 if zerstoert else 0.15)
	for k in gegner_von(team):
		var d: Vector3 = k.global_position - pos
		d.y = 0
		if d.length() < radius + 0.4:
			var stoss := d.normalized() * (10.0 if zerstoert else 3.0) if d.length() > 0.01 else Vector3.ZERO
			k.schaden_nehmen(schaden, quelle, stoss)
	if zerstoert:
		for kachel in _kisten.keys():
			if kachel_mitte(kachel.x, kachel.y).distance_to(pos) < radius + K * 0.5:
				kiste_zerstoeren(kachel)


func freier_punkt(p: Vector3) -> Vector3:
	## nächster begehbarer Punkt (für Sprünge, die nicht in Wänden landen dürfen)
	var hg := halb_groesse()
	p.x = clampf(p.x, -hg.x + 0.6, hg.x - 0.6)
	p.z = clampf(p.z, -hg.y + 0.6, hg.y - 0.6)
	var k := kachel_von(p)
	if _astar.region.has_point(k) and not _astar.is_point_solid(k):
		return Vector3(p.x, 0, p.z)
	var f := _frei(k)
	return kachel_mitte(f.x, f.y)


func heilzone(quelle: Kaempfer, pos: Vector3, menge: float, farbe: Color, radius := 3.0, dauer := 4.0) -> void:
	var zone := MeshInstance3D.new()
	var zyl := CylinderMesh.new()
	zyl.top_radius = radius
	zyl.bottom_radius = radius
	zyl.height = 0.06
	zone.mesh = zyl
	var c := farbe
	c.a = 0.35
	zone.material_override = Toon.unschattiert(c, true)
	add_child(zone)
	zone.global_position = pos + Vector3(0, 0.05, 0)
	Effekte.ring(self, pos, radius, farbe, 0.4)
	var schritte := maxi(1, int(dauer / 0.5))
	for schritt in schritte:
		if not is_instance_valid(quelle):
			break
		for k in team_von(quelle.team):
			if k.global_position.distance_to(pos) < radius:
				k.heilen(menge / schritte)
		for k in gegner_von(quelle.team):
			if k.global_position.distance_to(pos) < radius:
				k.schaden_nehmen(menge / (schritte * 3.0), quelle)
		await get_tree().create_timer(0.5).timeout
	zone.queue_free()


# ---------------------------------------------------------------- Ablauf
func _countdown() -> void:
	laeuft = false
	for k in kaempfer:
		k.set_physics_process(false)
	for text in ["3", "2", "1", "KRAWALL!"]:
		hud.gross_text(text, 0.7)
		ton("zaehlen" if text.length() == 1 else "super")
		await get_tree().create_timer(0.75).timeout
	for k in kaempfer:
		k.set_physics_process(true)
	laeuft = true


func _bei_ko(opfer: Kaempfer, taeter: Kaempfer) -> void:
	if vorbei:
		return
	var team_punkt := 1 - opfer.team
	punkte[team_punkt] += 1
	if taeter:
		taeter.ko_zaehler += 1
	hud.meldung(opfer, taeter)
	if opfer == spieler:
		wackeln(0.5)
	if punkte[team_punkt] >= SIEG_KOS:
		_ende()
		return
	await get_tree().create_timer(WIEDERBELEBEN).timeout
	if vorbei:
		return
	var sp: Array = _spawns[opfer.team]
	opfer.wiederbeleben(sp[randi() % sp.size()])


func _ende() -> void:
	vorbei = true
	laeuft = false
	var ergebnis := 0  # 1 Sieg, -1 Niederlage, 0 unentschieden
	if punkte[0] > punkte[1]:
		ergebnis = 1
	elif punkte[1] > punkte[0]:
		ergebnis = -1
	if ergebnis == 1:
		Daten.siege += 1
	var verdient := Konto.match_belohnung(ergebnis, spieler.ko_zaehler)
	for k in kaempfer:
		k.bewegung = Vector3.ZERO
		k.set_physics_process(false)
	_ziel_anzeige.visible = false
	_ziel_kreis.visible = false
	Engine.time_scale = 0.35
	await get_tree().create_timer(0.5 * 0.35).timeout
	Engine.time_scale = 1.0
	if spieler.tot:
		spieler.wiederbeleben(spieler.global_position)
		spieler.set_physics_process(false)
	spieler.modell.rotation.y = 0.0
	if ergebnis >= 0:
		spieler.jubeln()
	ton("sieg" if ergebnis == 1 else "ko")
	hud.ende(ergebnis, verdient)


func _process(delta: float) -> void:
	if laeuft:
		restzeit -= delta
		if restzeit <= 0.0:
			restzeit = 0.0
			_ende()
	_spieler_steuern()
	_kamera_folgen(delta)
	# Busch-Sichtbarkeit aus Sicht des Spielers
	for k in kaempfer:
		if not k.tot and spieler:
			k.modell.visible = sichtbar_fuer(k, spieler)
			k._ring.visible = k.modell.visible
	# gegnerische Minen sind unsichtbar
	if spieler:
		for m in get_tree().get_nodes_in_group("minen"):
			m.visible = m.fuer_spieler_sichtbar(spieler)


# ---------------------------------------------------------------- Spieler
var _maus_ziel := Vector3.ZERO
var _touch_aktiv := false


var steuerung_aktiv := true      # false = Spieler wird nicht von Eingaben gesteuert (z. B. für Tests)


func _spieler_steuern() -> void:
	if spieler == null or vorbei or not steuerung_aktiv:
		return
	var v := Input.get_vector("links", "rechts", "hoch", "runter")
	if hud.stick_bewegung.length() > 0.05:
		v = hud.stick_bewegung
		_touch_aktiv = true
	spieler.bewegung = Vector3(v.x, 0, v.y) if laeuft else Vector3.ZERO
	# Maus auf Bodenebene
	var mp := get_viewport().get_mouse_position()
	var ursprung := _kamera.project_ray_origin(mp)
	var strahl := _kamera.project_ray_normal(mp)
	if absf(strahl.y) > 0.001:
		_maus_ziel = ursprung + strahl * (-ursprung.y / strahl.y)
	var zur_maus := _maus_ziel - spieler.global_position
	zur_maus.y = 0
	# Zielanzeige
	var zielend := hud.zielt_mit_stick()
	var richtung := zur_maus
	var ziel_punkt := _maus_ziel
	if zielend:
		richtung = Vector3(hud.stick_ziel.x, 0, hud.stick_ziel.y)
		ziel_punkt = spieler.global_position + richtung * spieler.reichweite()
	_ziel_anzeige_aktualisieren(richtung, ziel_punkt, (not _touch_aktiv or zielend) and laeuft and not spieler.tot)
	if not laeuft or spieler.tot:
		return
	if Input.is_action_just_pressed("angriff") and not hud.maus_ueber_knopf():
		spieler.angreifen(zur_maus, _maus_ziel)
	if Input.is_action_just_pressed("auto_angriff"):
		_auto_angriff()
	if Input.is_action_just_pressed("super"):
		spieler.super_ausloesen(zur_maus, _maus_ziel)
	if Input.is_action_just_pressed("gadget"):
		spieler.gadget_ausloesen(zur_maus if not _touch_aktiv else spieler.blick)


func _auto_angriff(ist_super := false) -> void:
	var bester: Kaempfer = null
	var beste_d := spieler.reichweite() * 1.1
	for k in gegner_von(spieler.team):
		if not sichtbar_fuer(k, spieler):
			continue
		var d: float = k.global_position.distance_to(spieler.global_position)
		if d < beste_d:
			beste_d = d
			bester = k
	var richtung := spieler.blick
	var ziel := Vector3.INF
	if bester:
		richtung = bester.global_position - spieler.global_position
		ziel = bester.global_position
	if ist_super:
		spieler.super_ausloesen(richtung, ziel)
	else:
		spieler.angreifen(richtung, ziel)


## Vom HUD aufgerufen (Touch): Zielen losgelassen
func touch_angriff(richtung: Vector2, gezielt: bool, ist_super: bool) -> void:
	if not laeuft or spieler.tot:
		return
	if not gezielt:
		_auto_angriff(ist_super)
		return
	var r := Vector3(richtung.x, 0, richtung.y)
	var ziel := spieler.global_position + r * spieler.reichweite()
	if ist_super:
		spieler.super_ausloesen(r, ziel)
	else:
		spieler.angreifen(r, ziel)


func _ziel_anzeige_bauen() -> void:
	_ziel_anzeige = MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(0.5, 1.0)
	q.center_offset = Vector3(0, 0.5, 0)
	q.orientation = PlaneMesh.FACE_Y
	_ziel_anzeige.mesh = q
	_ziel_anzeige.material_override = Toon.unschattiert(Color(1, 1, 1, 0.28), true)
	_ziel_anzeige.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_ziel_anzeige)
	_ziel_kreis = MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = 0.92
	t.outer_radius = 1.0
	_ziel_kreis.mesh = t
	_ziel_kreis.material_override = Toon.unschattiert(Color(1, 1, 1, 0.5), true)
	add_child(_ziel_kreis)


func _ziel_anzeige_aktualisieren(richtung: Vector3, ziel: Vector3, an: bool) -> void:
	var typ: String = spieler.daten["angriff"]["typ"]
	_ziel_anzeige.visible = an and typ != "wurf" and richtung.length() > 0.1
	_ziel_kreis.visible = an and typ == "wurf"
	if not an:
		return
	var p := spieler.global_position
	if _ziel_anzeige.visible:
		var r := richtung.normalized()
		_ziel_anzeige.global_position = p + Vector3(0, 0.06, 0)
		_ziel_anzeige.rotation = Vector3(0, atan2(r.x, r.z), 0)
		var breite_ := 0.45 + deg_to_rad(float(spieler.daten["angriff"]["streuung"])) * spieler.reichweite() * 0.5
		_ziel_anzeige.scale = Vector3(breite_ / 0.5, 1, spieler.reichweite())
	if _ziel_kreis.visible:
		var weg := ziel - p
		weg.y = 0
		if weg.length() > spieler.reichweite():
			weg = weg.normalized() * spieler.reichweite()
		var rad := float(spieler.daten["angriff"]["radius"])
		_ziel_kreis.global_position = p + weg + Vector3(0, 0.08, 0)
		_ziel_kreis.scale = Vector3(rad, 0.2, rad)


# ---------------------------------------------------------------- Kamera
func _kamera_bauen() -> void:
	_kamera = Camera3D.new()
	_kamera.fov = 40.0
	add_child(_kamera)
	_kamera.current = true


func _kamera_folgen(delta: float) -> void:
	if spieler:
		var ziel := spieler.global_position
		var hg := halb_groesse()
		ziel.x = clampf(ziel.x, -hg.x + 7.0, hg.x - 7.0)
		ziel.z = clampf(ziel.z, -hg.y + 3.0, hg.y - 6.0)
		_kamera_ziel = _kamera_ziel.lerp(ziel, minf(1.0, 5.0 * delta)) if _kamera_ziel != Vector3.ZERO else ziel
	var versatz := Vector3(0, 17.0, 10.5)
	if vorbei and spieler:
		versatz = Vector3(-1.2, 5.0, 6.5)
		_kamera_ziel = _kamera_ziel.lerp(spieler.global_position + Vector3(0, 1.1, 0), minf(1.0, 3.0 * delta))
	var w := Vector3(randf_range(-1, 1), randf_range(-1, 1), 0) * _wackeln * 0.4
	_wackeln = maxf(0.0, _wackeln - delta * 2.5)
	_kamera.global_position = _kamera.global_position.lerp(_kamera_ziel + versatz, minf(1.0, 8.0 * delta)) + w
	if _kamera.global_position.distance_to(_kamera_ziel + versatz) > 30.0:
		_kamera.global_position = _kamera_ziel + versatz
	_kamera.look_at(_kamera_ziel + Vector3(0, 0.5 if vorbei else 0.0, 0), Vector3.UP)


func kamera() -> Camera3D:
	return _kamera


func wackeln(staerke: float) -> void:
	_wackeln = maxf(_wackeln, staerke)


func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("pause") and not vorbei:
		hud.pause_umschalten()


# ---------------------------------------------------------------- Sound (synthetisch, keine Dateien nötig)
static func ton(art: String) -> void:
	var baum := Engine.get_main_loop() as SceneTree
	if baum == null or baum.root == null:
		return
	if _toene.is_empty():
		_toene_erzeugen()
	if not _toene.has(art):
		return
	if _ton_spieler.is_empty():
		for i in 8:
			var p := AudioStreamPlayer.new()
			p.volume_db = -8.0
			baum.root.add_child.call_deferred(p)
			_ton_spieler.append(p)
		return
	for p in _ton_spieler:
		var ap: AudioStreamPlayer = p
		if is_instance_valid(ap) and ap.is_inside_tree() and not ap.playing:
			ap.stream = _toene[art]
			ap.pitch_scale = randf_range(0.93, 1.07)
			ap.play()
			return


static func _toene_erzeugen() -> void:
	_toene["schuss"] = _synth(0.12, func(t, f): return _quadrat(t, lerpf(880, 330, f)) * (1.0 - f) * 0.5)
	_toene["treffer"] = _synth(0.09, func(t, f): return (randf() * 2.0 - 1.0) * (1.0 - f) * 0.6 + sin(t * TAU * 180) * (1.0 - f) * 0.4)
	_toene["wurf"] = _synth(0.25, func(t, f): return (randf() * 2.0 - 1.0) * sin(f * PI) * 0.3)
	_toene["schlag"] = _synth(0.15, func(t, f): return (randf() * 2.0 - 1.0) * (1.0 - f) * 0.5 + sin(t * TAU * 120) * (1.0 - f) * 0.5)
	_toene["explosion"] = _synth(0.5, func(t, f): return (randf() * 2.0 - 1.0) * pow(1.0 - f, 2.0) * 0.8 + sin(t * TAU * lerpf(90, 40, f)) * (1.0 - f) * 0.5)
	_toene["ko"] = _synth(0.45, func(t, f): return _quadrat(t, lerpf(520, 110, f)) * (1.0 - f) * 0.4)
	_toene["super"] = _synth(0.4, func(t, f): return (_quadrat(t, lerpf(300, 1200, f)) * 0.3 + sin(t * TAU * lerpf(600, 2400, f)) * 0.3) * (1.0 - f * 0.7))
	_toene["zaehlen"] = _synth(0.15, func(t, f): return _quadrat(t, 660) * (1.0 - f) * 0.35)
	_toene["sieg"] = _synth(0.9, func(t, f):
		var noten := [523.25, 659.25, 783.99, 1046.5]
		var i := mini(int(f * 4.0), 3)
		return _quadrat(t, noten[i]) * 0.3 * (1.0 - fmod(f * 4.0, 1.0) * 0.6))


static func _quadrat(t: float, frequenz: float) -> float:
	return 1.0 if fmod(t * frequenz, 1.0) < 0.5 else -1.0


static func _synth(dauer: float, fn: Callable) -> AudioStreamWAV:
	var rate := 22050
	var n := int(dauer * rate)
	var bytes := PackedByteArray()
	bytes.resize(n * 2)
	for i in n:
		var t := float(i) / rate
		var v := clampf(float(fn.call(t, float(i) / n)), -1.0, 1.0)
		bytes.encode_s16(i * 2, int(v * 24000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = rate
	w.stereo = false
	w.data = bytes
	return w
