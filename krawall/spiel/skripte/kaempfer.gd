## Ein Kämpfer in der Arena – vom Spieler oder von der KI gesteuert.
class_name Kaempfer
extends CharacterBody3D

signal ausgeschaltet(opfer: Kaempfer, taeter: Kaempfer)

const MAX_MUNITION := 3
const TEMPO_BASIS := 5.0
const REGEN_WARTEZEIT := 3.0

var daten: Dictionary
var team := 0
var ist_spieler := false
var arena: Node3D

var max_leben := 3600.0
var leben := 3600.0
var munition := 3.0
var super_ladung := 0.0
var tot := false
var im_busch := false
var sichtbar_fuer_gegner := true
var ko_zaehler := 0

var bewegung := Vector3.ZERO      # gewünschte Richtung (Länge 0..1), von Spieler/KI gesetzt
var blick := Vector3(0, 0, 1)
var _blick_ziel_zeit := 0.0
var _letzter_schaden := -99.0
var _letzter_angriff := -99.0
var _schild_bis := 0.0
var _sprint_bis := 0.0
var _sprint_richtung := Vector3.ZERO
var _sprint_getroffen: Array = []
var _rueckstoss := Vector3.ZERO
var _blitz := 0.0
var _quetsch := 0.0

var modell: Node3D
var _figur: Node3D
var _anim: AnimationPlayer
var _baum: AnimationTree
var _mats: Array = []
var _ring: MeshInstance3D
var _schild_kugel: MeshInstance3D

# KI
var ki := false
var _ki_timer := 0.0
var _ki_ziel: Kaempfer
var _ki_pfad: PackedVector3Array = []
var _ki_seite := 1.0
var _ki_seitenwechsel := 0.0
var _ki_schuss_pause := 0.0
var spawn_punkt := Vector3.ZERO


func einrichten(d: Dictionary, t: int, spieler: bool, a: Node3D) -> void:
	daten = d
	team = t
	ist_spieler = spieler
	ki = not spieler
	arena = a
	max_leben = float(d["werte"]["leben"])
	leben = max_leben
	collision_layer = 2
	collision_mask = 1 | 4
	var form := CollisionShape3D.new()
	var kapsel := CapsuleShape3D.new()
	kapsel.radius = 0.42
	kapsel.height = 1.7
	form.shape = kapsel
	form.position.y = 0.85
	add_child(form)
	motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	_modell_laden()
	_team_ring()


func _modell_laden() -> void:
	modell = Node3D.new()
	add_child(modell)
	var pfad: String = daten.get("modell", "")
	if pfad != "" and ResourceLoader.exists(pfad):
		_figur = (load(pfad) as PackedScene).instantiate()
	else:
		_figur = _ersatzfigur()
	modell.add_child(_figur)
	# auf Spielgröße skalieren
	var box := _gesamt_box(_figur)
	if box.size.y > 0.01:
		var s: float = float(daten.get("modell_hoehe", 1.75)) / box.size.y
		_figur.scale = Vector3.ONE * s
		_figur.position.y = -box.position.y * s
	_mats = Toon.anwenden(_figur, 0.016 / maxf(_figur.scale.x, 0.01), true)
	var aps := _figur.find_children("*", "AnimationPlayer", true, false)
	if aps.size() > 0:
		_anim = aps[0]
		_animationen_einrichten()


func _ersatzfigur() -> Node3D:
	var n := Node3D.new()
	var k := MeshInstance3D.new()
	var c := CapsuleMesh.new()
	c.radius = 0.4
	c.height = 1.6
	k.mesh = c
	k.position.y = 0.8
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color.html(daten["angriff"].get("farbe", "#FFD23F"))
	k.material_override = mat
	n.add_child(k)
	return n


func _gesamt_box(wurzel: Node3D) -> AABB:
	var box := AABB()
	var erste := true
	for mi in wurzel.find_children("*", "MeshInstance3D", true, false):
		var m: MeshInstance3D = mi
		var b: AABB = m.get_aabb()
		var tr: Transform3D = wurzel.global_transform.affine_inverse() * m.global_transform if m.is_inside_tree() else _relativ(wurzel, m)
		b = tr * b
		box = b if erste else box.merge(b)
		erste = false
	return box


func _relativ(wurzel: Node3D, n: Node3D) -> Transform3D:
	var t := Transform3D.IDENTITY
	var k: Node = n
	while k != null and k != wurzel:
		if k is Node3D:
			t = (k as Node3D).transform * t
		k = k.get_parent()
	return t


func _animationen_einrichten() -> void:
	for n in ["Idle", "Run", "Victory"]:
		if _anim.has_animation(n):
			_anim.get_animation(n).loop_mode = Animation.LOOP_LINEAR
	for n in ["Attack", "Super", "Hit", "Dead"]:
		if _anim.has_animation(n):
			_anim.get_animation(n).loop_mode = Animation.LOOP_NONE
	if not (_anim.has_animation("Idle") and _anim.has_animation("Run")):
		if _anim.has_animation("Idle"):
			_anim.play("Idle")
		return
	var bt := AnimationNodeBlendTree.new()
	var idle := AnimationNodeAnimation.new()
	idle.animation = "Idle"
	var lauf := AnimationNodeAnimation.new()
	lauf.animation = "Run"
	var mix := AnimationNodeBlend2.new()
	bt.add_node("idle", idle, Vector2(0, 0))
	bt.add_node("lauf", lauf, Vector2(0, 150))
	bt.add_node("bewegung", mix, Vector2(200, 50))
	bt.connect_node("bewegung", 0, "idle")
	bt.connect_node("bewegung", 1, "lauf")
	var letzter := "bewegung"
	var x := 400
	# Angriff nur im Oberkörper (Beine laufen weiter)
	if _anim.has_animation("Attack"):
		var att := AnimationNodeAnimation.new()
		att.animation = "Attack"
		var ts := AnimationNodeTimeScale.new()
		var shot := AnimationNodeOneShot.new()
		shot.fadein_time = 0.06
		shot.fadeout_time = 0.15
		shot.filter_enabled = true
		var sk_liste := _figur.find_children("*", "Skeleton3D", true, false)
		if sk_liste.size() > 0:
			var sk: Skeleton3D = sk_liste[0]
			var basis_pfad := str(_anim.get_node(_anim.root_node).get_path_to(sk))
			for i in sk.get_bone_count():
				var bn := sk.get_bone_name(i).to_lower()
				var oben := false
				for teil in ["arm", "hand", "shoulder", "clavicle", "spine", "chest", "neck", "head", "finger", "thumb", "index", "middle", "ring", "pinky"]:
					if bn.contains(teil):
						oben = true
				if oben:
					shot.set_filter_path(NodePath(basis_pfad + ":" + sk.get_bone_name(i)), true)
		bt.add_node("angriff_anim", att, Vector2(x, 200))
		bt.add_node("angriff_tempo", ts, Vector2(x + 100, 200))
		bt.add_node("angriff", shot, Vector2(x + 200, 50))
		bt.connect_node("angriff_tempo", 0, "angriff_anim")
		bt.connect_node("angriff", 0, letzter)
		bt.connect_node("angriff", 1, "angriff_tempo")
		letzter = "angriff"
		x += 300
	for paar in [["Super", "super"], ["Hit", "treffer"]]:
		if _anim.has_animation(paar[0]):
			var a := AnimationNodeAnimation.new()
			a.animation = paar[0]
			var ts2 := AnimationNodeTimeScale.new()
			var s := AnimationNodeOneShot.new()
			s.fadein_time = 0.08
			s.fadeout_time = 0.2
			bt.add_node(paar[1] + "_anim", a, Vector2(x, 200))
			bt.add_node(paar[1] + "_tempo", ts2, Vector2(x + 100, 200))
			bt.add_node(paar[1], s, Vector2(x + 200, 50))
			bt.connect_node(paar[1] + "_tempo", 0, paar[1] + "_anim")
			bt.connect_node(paar[1], 0, letzter)
			bt.connect_node(paar[1], 1, paar[1] + "_tempo")
			letzter = paar[1]
			x += 300
	bt.connect_node("output", 0, letzter)
	_baum = AnimationTree.new()
	_baum.tree_root = bt
	_figur.add_child(_baum)
	_baum.anim_player = _baum.get_path_to(_anim)
	_baum.active = true
	# Abspieltempo so wählen, dass lange Clips flott wirken
	_tempo_setzen("angriff", "Attack", 0.55)
	_tempo_setzen("super", "Super", 1.0)
	_tempo_setzen("treffer", "Hit", 0.4)


func _tempo_setzen(knoten: String, anim: String, ziel_dauer: float) -> void:
	if _anim.has_animation(anim):
		var l := _anim.get_animation(anim).length
		_baum.set("parameters/%s_tempo/scale" % knoten, clampf(l / ziel_dauer, 1.0, 4.0))


func _team_ring() -> void:
	_ring = MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = 0.5
	t.outer_radius = 0.64
	t.rings = 32
	_ring.mesh = t
	_ring.scale = Vector3(1, 0.15, 1)
	_ring.position.y = 0.04
	var farbe := Color("#3DA5FF") if team == 0 else Color("#FF4757")
	if ist_spieler:
		farbe = Color("#7CFF5B")
	_ring.material_override = Toon.unschattiert(farbe)
	_ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_ring)


func zeit() -> float:
	return Time.get_ticks_msec() / 1000.0


# ---------------------------------------------------------------- Ablauf
func _physics_process(delta: float) -> void:
	if tot or arena == null:
		return
	var t := zeit()
	if ki:
		_ki_denken(delta)
	# Munition laden
	var nachladen := float(daten["angriff"]["nachladen"])
	munition = minf(MAX_MUNITION, munition + delta / maxf(nachladen, 0.2))
	# Regeneration
	if t - _letzter_schaden > REGEN_WARTEZEIT and t - _letzter_angriff > REGEN_WARTEZEIT and leben < max_leben:
		leben = minf(max_leben, leben + max_leben * 0.13 * delta)
	# Bewegung
	var tempo := TEMPO_BASIS * float(daten["werte"]["tempo"])
	if t < _schild_bis:
		tempo *= 1.15
	var v := bewegung.limit_length(1.0) * tempo
	if t < _sprint_bis:
		v = _sprint_richtung * 17.0
		_sprint_treffer()
	v += _rueckstoss
	_rueckstoss = _rueckstoss.move_toward(Vector3.ZERO, 30.0 * delta)
	velocity = Vector3(v.x, 0, v.z)
	move_and_slide()
	position.y = 0.0
	# Blickrichtung
	var richtung := blick
	if t > _blick_ziel_zeit and bewegung.length() > 0.1:
		richtung = bewegung.normalized()
		blick = richtung
	var ziel_winkel := atan2(richtung.x, richtung.z)
	modell.rotation.y = lerp_angle(modell.rotation.y, ziel_winkel, minf(1.0, 16.0 * delta))
	# Animation
	if _baum:
		var lauf := clampf(velocity.length() / tempo, 0.0, 1.0)
		var alt: float = _baum.get("parameters/bewegung/blend_amount")
		_baum.set("parameters/bewegung/blend_amount", lerpf(alt, lauf, minf(1.0, 12.0 * delta)))
	# Comic-Effekte: Blitz und Quetschen
	if _blitz > 0.0:
		_blitz = maxf(0.0, _blitz - delta * 6.0)
		for m in _mats:
			(m as ShaderMaterial).set_shader_parameter("blitz", _blitz)
	_quetsch = maxf(0.0, _quetsch - delta * 5.0)
	var q := sin(_quetsch * PI) * 0.18
	modell.scale = Vector3(1.0 + q, 1.0 - q, 1.0 + q)
	if _schild_kugel:
		_schild_kugel.visible = t < _schild_bis
	# Busch
	var war_im_busch := im_busch
	im_busch = arena.ist_busch(global_position)
	if im_busch != war_im_busch and ist_spieler:
		for m in _mats:
			(m as ShaderMaterial).set_shader_parameter("leuchten", 0.25 if im_busch else 0.0)


func zielen_auf(richtung: Vector3) -> void:
	richtung.y = 0
	if richtung.length() > 0.01:
		blick = richtung.normalized()
		_blick_ziel_zeit = zeit() + 0.45


# ---------------------------------------------------------------- Kampf
func reichweite() -> float:
	return float(daten["angriff"]["reichweite"])


func kann_angreifen() -> bool:
	return not tot and munition >= 1.0


func angreifen(richtung: Vector3, ziel_punkt := Vector3.INF) -> void:
	if not kann_angreifen():
		return
	richtung.y = 0
	if richtung.length() < 0.01:
		richtung = blick
	richtung = richtung.normalized()
	munition -= 1.0
	_letzter_angriff = zeit()
	zielen_auf(richtung)
	if _baum and _anim.has_animation("Attack"):
		_baum.set("parameters/angriff/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
	var a: Dictionary = daten["angriff"]
	var farbe := Color.html(a["farbe"])
	var start := global_position + Vector3(0, 1.0, 0) + richtung * 0.5
	match a["typ"]:
		"schuss", "schrot":
			var n := int(a["projektile"])
			var streu := deg_to_rad(float(a["streuung"]))
			for i in n:
				var w := 0.0
				if n > 1:
					w = lerpf(-streu / 2.0, streu / 2.0, float(i) / float(n - 1))
				if a["typ"] == "schrot":
					w += randf_range(-0.04, 0.04)
				arena.projektil(self, start, richtung.rotated(Vector3.UP, w), float(a["projektil_tempo"]),
					reichweite(), float(a["schaden"]), farbe, 0.22 if a["typ"] == "schuss" else 0.16)
			Arena.ton("schuss")
		"wurf":
			var ziel := ziel_punkt
			if ziel == Vector3.INF:
				ziel = global_position + richtung * reichweite()
			var weg := ziel - global_position
			weg.y = 0
			if weg.length() > reichweite():
				ziel = global_position + weg.normalized() * reichweite()
			arena.wurf(self, start, ziel, float(a["schaden"]), float(a["radius"]), farbe, false)
			Arena.ton("wurf")
		"nahkampf":
			await get_tree().create_timer(0.12).timeout
			if tot:
				return
			Effekte.schlag(arena, global_position + Vector3(0, 0.9, 0) + richtung * 1.2, richtung, farbe)
			for k in arena.gegner_von(team):
				var d: Vector3 = k.global_position - global_position
				d.y = 0
				if d.length() < reichweite() and d.normalized().dot(richtung) > 0.35:
					k.schaden_nehmen(float(a["schaden"]), self, richtung * 6.0)
			Arena.ton("schlag")


func super_bereit() -> bool:
	return not tot and super_ladung >= 1.0


func super_ausloesen(richtung: Vector3, ziel_punkt := Vector3.INF) -> void:
	if not super_bereit():
		return
	super_ladung = 0.0
	richtung.y = 0
	if richtung.length() < 0.01:
		richtung = blick
	richtung = richtung.normalized()
	zielen_auf(richtung)
	_letzter_angriff = zeit()
	if _baum and _anim.has_animation("Super"):
		_baum.set("parameters/super/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
	var s: Dictionary = daten["super"]
	var farbe := Color.html(s["farbe"])
	var schaden := float(s["schaden"])
	Arena.ton("super")
	Effekte.super_blitz(arena, global_position, farbe)
	match s["typ"]:
		"sprint":
			_sprint_richtung = richtung
			_sprint_bis = zeit() + float(s.get("reichweite", 7.0)) / 17.0
			_sprint_getroffen.clear()
		"salve":
			for i in 16:
				var r := richtung.rotated(Vector3.UP, TAU * i / 16.0)
				arena.projektil(self, global_position + Vector3(0, 1.0, 0) + r * 0.5, r, 15.0,
					float(s.get("reichweite", 7.0)), schaden / 4.0, farbe, 0.28)
		"bombe":
			var ziel := ziel_punkt
			var rw := float(s.get("reichweite", 8.0))
			if ziel == Vector3.INF:
				ziel = global_position + richtung * rw
			var weg := ziel - global_position
			weg.y = 0
			if weg.length() > rw:
				ziel = global_position + weg.normalized() * rw
			arena.wurf(self, global_position + Vector3(0, 1.4, 0), ziel, schaden, 2.6, farbe, true)
		"heilzone":
			arena.heilzone(self, global_position, schaden, farbe)
		"schild":
			_schild_bis = zeit() + 4.0
			leben = minf(max_leben, leben + max_leben * 0.25)
			if _schild_kugel == null:
				_schild_kugel = MeshInstance3D.new()
				var k := SphereMesh.new()
				k.radius = 1.1
				k.height = 2.2
				_schild_kugel.mesh = k
				_schild_kugel.position.y = 0.9
				var c := farbe
				c.a = 0.25
				_schild_kugel.material_override = Toon.unschattiert(c, true)
				add_child(_schild_kugel)


func _sprint_treffer() -> void:
	for k in arena.gegner_von(team):
		if k in _sprint_getroffen:
			continue
		if k.global_position.distance_to(global_position) < 1.3:
			_sprint_getroffen.append(k)
			k.schaden_nehmen(float(daten["super"]["schaden"]), self, _sprint_richtung * 14.0)
	# an Wänden stoppen
	if get_slide_collision_count() > 0:
		_sprint_bis = 0.0


func super_laden(menge: float) -> void:
	super_ladung = minf(1.0, super_ladung + menge)


func schaden_nehmen(menge: float, quelle: Kaempfer, stoss := Vector3.ZERO) -> void:
	if tot:
		return
	if zeit() < _schild_bis:
		menge *= 0.4
	leben -= menge
	_letzter_schaden = zeit()
	_blitz = 1.0
	_quetsch = 1.0
	_rueckstoss += stoss
	Effekte.zahl(arena, global_position + Vector3(0, 2.1, 0), int(menge), quelle != null and quelle.ist_spieler)
	if quelle and quelle != self:
		quelle.super_laden(float(quelle.daten["super"]["ladung_pro_treffer"]))
	if _baum and _anim.has_animation("Hit") and randf() < 0.5:
		_baum.set("parameters/treffer/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
	if leben <= 0.0:
		leben = 0.0
		_ausschalten(quelle)


func heilen(menge: float) -> void:
	if tot:
		return
	leben = minf(max_leben, leben + menge)


func _ausschalten(taeter: Kaempfer) -> void:
	tot = true
	_sprint_bis = 0.0
	Effekte.puff(arena, global_position + Vector3(0, 0.8, 0), Color("#FFFFFF"))
	Arena.ton("ko")
	visible = false
	set_physics_process(false)
	collision_layer = 0
	ausgeschaltet.emit(self, taeter)


func wiederbeleben(punkt: Vector3) -> void:
	global_position = punkt
	leben = max_leben
	munition = MAX_MUNITION
	tot = false
	visible = true
	collision_layer = 2
	_rueckstoss = Vector3.ZERO
	_ki_pfad.clear()
	set_physics_process(true)
	Effekte.puff(arena, punkt + Vector3(0, 0.5, 0), Color("#FFF3B0"))


func jubeln() -> void:
	if _baum:
		_baum.active = false
	if _anim and _anim.has_animation("Victory"):
		_anim.play("Victory")


# ---------------------------------------------------------------- KI
func _ki_denken(delta: float) -> void:
	_ki_timer -= delta
	_ki_schuss_pause -= delta
	_ki_seitenwechsel -= delta
	if _ki_seitenwechsel <= 0.0:
		_ki_seite = -_ki_seite
		_ki_seitenwechsel = randf_range(0.8, 2.0)
	if _ki_timer <= 0.0:
		_ki_timer = randf_range(0.2, 0.35)
		_ki_ziel = _ki_naechster_gegner()
		var ziel_punkt := _ki_wunschpunkt()
		_ki_pfad = arena.pfad(global_position, ziel_punkt)
	# dem Pfad folgen
	var richtung := Vector3.ZERO
	while _ki_pfad.size() > 0 and Vector2(_ki_pfad[0].x - global_position.x, _ki_pfad[0].z - global_position.z).length() < 0.35:
		_ki_pfad.remove_at(0)
	if _ki_pfad.size() > 0:
		richtung = _ki_pfad[0] - global_position
		richtung.y = 0
	bewegung = richtung.normalized() if richtung.length() > 0.05 else Vector3.ZERO
	# angreifen
	if _ki_ziel and is_instance_valid(_ki_ziel) and not _ki_ziel.tot:
		var zu: Vector3 = _ki_ziel.global_position - global_position
		zu.y = 0
		var d := zu.length()
		var typ: String = daten["angriff"]["typ"]
		var sicht: bool = typ == "wurf" or arena.freie_sicht(global_position, _ki_ziel.global_position)
		if d < reichweite() * 0.95 and sicht and munition >= 1.0 and _ki_schuss_pause <= 0.0:
			# Vorhalten + etwas Ungenauigkeit
			var flug := d / maxf(float(daten["angriff"]["projektil_tempo"]), 1.0)
			var vorhalt: Vector3 = _ki_ziel.global_position + _ki_ziel.velocity * flug * 0.7 - global_position
			vorhalt = vorhalt.rotated(Vector3.UP, randf_range(-0.12, 0.12))
			angreifen(vorhalt, _ki_ziel.global_position + _ki_ziel.velocity * 0.4)
			_ki_schuss_pause = randf_range(0.45, 0.9)
		if super_bereit() and d < float(daten["super"].get("reichweite", 7.0)) * 0.9 and sicht:
			super_ausloesen(zu, _ki_ziel.global_position)


func _ki_naechster_gegner() -> Kaempfer:
	var bester: Kaempfer = null
	var beste_d := 1e9
	for k in arena.gegner_von(team):
		if not arena.sichtbar_fuer(k, self):
			continue
		var d: float = k.global_position.distance_to(global_position)
		if d < beste_d:
			beste_d = d
			bester = k
	return bester


func _ki_wunschpunkt() -> Vector3:
	if _ki_ziel == null:
		# Richtung Mitte / Gegnerseite vorrücken
		return arena.vorruecken_punkt(team) + Vector3(randf_range(-3, 3), 0, randf_range(-2, 2))
	var zu: Vector3 = _ki_ziel.global_position - global_position
	zu.y = 0
	var d := zu.length()
	var rw := reichweite()
	if leben < max_leben * 0.3 and d < rw * 1.3:
		return spawn_punkt  # zurückziehen
	if d > rw * 0.8:
		return _ki_ziel.global_position
	var seitlich := zu.normalized().cross(Vector3.UP) * _ki_seite * 2.0
	if d < rw * 0.45:
		return global_position - zu.normalized() * 2.5 + seitlich
	return global_position + seitlich
