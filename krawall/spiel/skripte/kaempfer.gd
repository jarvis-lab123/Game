## Ein Kämpfer in der Arena – vom Spieler oder von der KI gesteuert.
## Fähigkeiten: Angriff (3 Munition) · Super (lädt durch Treffer) · Gadget (3x pro Match) · Passiv (immer an)
class_name Kaempfer
extends CharacterBody3D

signal ausgeschaltet(opfer: Kaempfer, taeter: Kaempfer)

const MAX_MUNITION := 3
const TEMPO_BASIS := 5.0
const REGEN_WARTEZEIT := 3.0
const SPAWNSCHUTZ := 2.0
const STUFEN_BONUS := 0.06   # +6 % Leben und Schaden pro Stufe über 1

var daten: Dictionary
var team := 0
var ist_spieler := false
var arena: Node3D
var stufe := 1

var max_leben := 3600.0
var leben := 3600.0
var munition := 3.0
var super_ladung := 0.0
var tot := false
var im_busch := false
var ko_zaehler := 0
var schaden_gesamt := 0.0

var super_info: Dictionary = {}
var gadget_info: Dictionary = {}
var passiv_info: Dictionary = {}
var gadget_ladungen := 0
var _gadget_bereit_ab := 0.0

var bewegung := Vector3.ZERO      # gewünschte Richtung (Länge 0..1), von Spieler/KI gesetzt
var blick := Vector3(0, 0, 1)
var _blick_ziel_zeit := 0.0
var _letzter_schaden := -99.0
var _letzter_angriff := -99.0
var _sprint_bis := 0.0
var _sprint_richtung := Vector3.ZERO
var _sprint_schaden := 0.0
var _sprint_getroffen: Array = []
var _rueckstoss := Vector3.ZERO
var _zug := Vector3.ZERO
var _springt := false
var _blitz := 0.0
var _quetsch := 0.0
var _effekte := {}   # name -> [bis, wert]

var modell: Node3D
var _figur: Node3D
var _anim: AnimationPlayer
var _baum: AnimationTree
var _mats: Array = []
var _ring: MeshInstance3D
var _blase: MeshInstance3D
var _posen: Array = []
var regeneration := true        # Arena-Modus: ja · Schule: nein (nur über besondere K.o.s)
var letzter_super := -99.0
var einrasten := Vector3.INF
var schadens_multiplikator := 1.0   # Balance (z. B. Lehrer in der Schule schwächer)
var ki_feuerpause := Vector2(0.45, 0.9)   # Sekunden zwischen KI-Schüssen (min, max)
var ansage_zeit := 0.0           # > 0: KI zeigt Angriffe vorher als rote Markierung an (Ausweichen möglich)
var _ansage_laeuft := false     # wenn gesetzt: gleitet ohne Kollision dorthin (Sitzplatz)

# KI
var ki := false
var _ki_timer := 0.0
var _ki_ziel: Kaempfer
var _ki_pfad: PackedVector3Array = []
var _ki_seite := 1.0
var _ki_seitenwechsel := 0.0
var _ki_schuss_pause := 0.0
var spawn_punkt := Vector3.ZERO


func einrichten(d: Dictionary, t: int, spieler: bool, a: Node3D, st := 1, gadget_index := 0, passiv_index := 0) -> void:
	daten = d
	team = t
	ist_spieler = spieler
	ki = not spieler
	arena = a
	stufe = maxi(st, 1)
	max_leben = float(d["werte"]["leben"]) * (1.0 + STUFEN_BONUS * (stufe - 1))
	leben = max_leben
	super_info = Faehigkeiten.voll("super", d["super"])
	var gs := Faehigkeiten.liste(d, "gadget")
	var ps := Faehigkeiten.liste(d, "passiv")
	gadget_info = gs[clampi(gadget_index, 0, gs.size() - 1)] if gs.size() > 0 else {}
	passiv_info = ps[clampi(passiv_index, 0, ps.size() - 1)] if ps.size() > 0 else {}
	gadget_ladungen = Faehigkeiten.GADGET_LADUNGEN if not gadget_info.is_empty() else 0
	collision_layer = 2
	collision_mask = 1 | 4
	var form := CollisionShape3D.new()
	var kapsel := CapsuleShape3D.new()
	var gf := groesse_faktor()
	kapsel.radius = 0.42 * minf(gf, 1.5)          # Riesen bleiben schmal genug für Türen
	kapsel.height = maxf(1.7 * gf, kapsel.radius * 2.0 + 0.1)
	form.shape = kapsel
	form.position.y = kapsel.height / 2.0
	add_child(form)
	motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	_modell_laden()
	_team_ring()
	effekt_setzen("spawnschutz", SPAWNSCHUTZ, 1.0)


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
	for n in ["Idle", "Run", "Victory", "Walk", "Sit", "Read", "Talk"]:
		if _anim.has_animation(n):
			_anim.get_animation(n).loop_mode = Animation.LOOP_LINEAR
	for n in ["Attack", "Super", "Hit", "Dead", "Alarm"]:
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
	# Fortbewegung: Stehen – Gehen – Rennen (BlendSpace nach Geschwindigkeit)
	var raum := AnimationNodeBlendSpace1D.new()
	raum.min_space = 0.0
	raum.max_space = 1.0
	raum.add_blend_point(idle, 0.0)
	if _anim.has_animation("Walk"):
		var geh := AnimationNodeAnimation.new()
		geh.animation = "Walk"
		raum.add_blend_point(geh, 0.35)
	raum.add_blend_point(lauf, 1.0)
	bt.add_node("bewegung", raum, Vector2(200, 50))
	# Haltung: normal bewegen oder Alltags-Posen (Sitzen, Lesen, Reden)
	var pose := AnimationNodeTransition.new()
	pose.xfade_time = 0.3
	pose.add_input("lauf")
	bt.add_node("pose", pose, Vector2(400, 50))
	bt.connect_node("pose", 0, "bewegung")
	var i_pose := 1
	for n in ["Sit", "Read", "Talk"]:
		if _anim.has_animation(n):
			pose.add_input(n)
			var an := AnimationNodeAnimation.new()
			an.animation = n
			bt.add_node("pose_" + n, an, Vector2(200, 150 + i_pose * 80))
			bt.connect_node("pose", i_pose, "pose_" + n)
			_posen.append(n)
			i_pose += 1
	var letzter := "pose"
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
	for paar in [["Super", "super"], ["Hit", "treffer"], ["Alarm", "alarm"]]:
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
	_tempo_setzen("alarm", "Alarm", 0.5)


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


## 1.0 = normale Größe (1,75 m). Frau Gerometta z. B. 3.0
func groesse_faktor() -> float:
	return float(daten.get("modell_hoehe", 1.75)) / 1.75


func kopf_hoehe() -> float:
	return float(daten.get("modell_hoehe", 1.75)) + 0.45


func trefferradius() -> float:
	return 0.45 * minf(groesse_faktor(), 1.6)


func zeit() -> float:
	return Time.get_ticks_msec() / 1000.0



# ---------------------------------------------------------------- Statuseffekte & Passiv
func effekt_setzen(name: String, dauer: float, wert := 1.0) -> void:
	var bis := zeit() + dauer
	if _effekte.has(name) and _effekte[name][0] > bis and _effekte[name][1] == wert:
		return
	_effekte[name] = [bis, wert]


func effekt(name: String, standard := 0.0) -> float:
	if _effekte.has(name) and _effekte[name][0] > zeit():
		return _effekte[name][1]
	return standard


func hat_effekt(name: String) -> bool:
	return _effekte.has(name) and _effekte[name][0] > zeit()


func passiv(typ: String) -> float:
	## Wert ("anteil") der Passiv-Fähigkeit, falls dieser Kämpfer sie hat, sonst 0
	if passiv_info.get("typ", "") == typ:
		return float(passiv_info.get("anteil", 1.0))
	return 0.0


func schadens_faktor() -> float:
	var f := (1.0 + STUFEN_BONUS * (stufe - 1)) * schadens_multiplikator * effekt("zorn", 1.0)
	if hat_effekt("wut"):
		f *= 1.3
	if passiv("letzte_kraft") > 0.0 and leben < max_leben * float(passiv_info.get("grenze", 0.4)):
		f *= 1.0 + passiv("letzte_kraft")
	return f


func tempo() -> float:
	var t := TEMPO_BASIS * float(daten["werte"]["tempo"]) * (1.0 + passiv("flink"))
	t *= 1.0 + effekt("turbo")
	if hat_effekt("wut"):
		t *= 1.4
	t *= effekt("langsam", 1.0)
	return t


func ist_unsichtbar() -> bool:
	return hat_effekt("unsichtbar")


# ---------------------------------------------------------------- Ablauf
func _physics_process(delta: float) -> void:
	if tot or arena == null:
		return
	var t := zeit()
	if ki:
		_ki_denken(delta)
	# Munition laden
	var nachladen := float(daten["angriff"]["nachladen"]) / (1.0 + passiv("schnelllader"))
	if hat_effekt("wut"):
		nachladen *= 0.5
	munition = minf(MAX_MUNITION, munition + delta / maxf(nachladen, 0.2))
	# Regeneration
	var warte := REGEN_WARTEZEIT
	var rate := 0.13
	if passiv_info.get("typ", "") == "schnelle_heilung":
		warte = 1.5
		rate = 0.26
	if regeneration and t - _letzter_schaden > warte and t - _letzter_angriff > warte and leben < max_leben:
		leben = minf(max_leben, leben + max_leben * rate * delta)
	# Bewegung
	if einrasten != Vector3.INF:
		# auf einen Platz gleiten (z. B. auf den Stuhl), ohne Kollision
		global_position = global_position.move_toward(einrasten, 1.6 * delta)
		velocity = Vector3.ZERO
	elif not _springt:
		var v := bewegung.limit_length(1.0) * tempo() * (0.0 if hat_effekt("betaeubt") else 1.0)
		if t < _sprint_bis:
			v = _sprint_richtung * 17.0
			_sprint_treffer()
		v += _rueckstoss + _zug
		_rueckstoss = _rueckstoss.move_toward(Vector3.ZERO, 30.0 * delta)
		_zug = Vector3.ZERO
		velocity = Vector3(v.x, 0, v.z)
		move_and_slide()
		position.y = 0.0
	# Blickrichtung
	var richtung := blick
	if t > _blick_ziel_zeit and bewegung.length() > 0.1:
		richtung = bewegung.normalized()
		blick = richtung
	modell.rotation.y = lerp_angle(modell.rotation.y, atan2(richtung.x, richtung.z), minf(1.0, 16.0 * delta))
	# Animation
	if _baum:
		var lauf := clampf(velocity.length() / maxf(TEMPO_BASIS * float(daten["werte"]["tempo"]), 0.1), 0.0, 1.0)
		var alt: float = _baum.get("parameters/bewegung/blend_position")
		_baum.set("parameters/bewegung/blend_position", lerpf(alt, lauf, minf(1.0, 12.0 * delta)))
	# Comic-Effekte: Blitz, Quetschen, Spawnschutz-Blinken, Tarnung
	if _blitz > 0.0:
		_blitz = maxf(0.0, _blitz - delta * 6.0)
		for m in _mats:
			(m as ShaderMaterial).set_shader_parameter("blitz", _blitz)
	_quetsch = maxf(0.0, _quetsch - delta * 5.0)
	var q := sin(_quetsch * PI) * 0.18
	modell.scale = Vector3(1.0 + q, 1.0 - q, 1.0 + q)
	if _blase:
		_blase.visible = hat_effekt("schild") or hat_effekt("blase") or hat_effekt("wut") or hat_effekt("wut_glut") or hat_effekt("zorn")
	im_busch = arena.ist_busch(global_position)
	var glimmen := 0.0
	if ist_spieler and (im_busch or ist_unsichtbar()):
		glimmen = 0.3
	if hat_effekt("spawnschutz"):
		glimmen = 0.4 if int(t * 8.0) % 2 == 0 else 0.0
	for m in _mats:
		(m as ShaderMaterial).set_shader_parameter("leuchten", glimmen)


## Alltags-Pose: "" = normal bewegen, sonst "Sit", "Read", "Talk" (falls das Modell sie hat)
func pose_setzen(name: String) -> void:
	if _baum == null:
		return
	var ziel := name if name in _posen else "lauf"
	if _baum.get("parameters/pose/current_state") != ziel:
		_baum.set("parameters/pose/transition_request", ziel)


func alarm_animation() -> void:
	if _baum and _anim.has_animation("Alarm"):
		_baum.set("parameters/alarm/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)


func zielen_auf(richtung: Vector3) -> void:
	richtung.y = 0
	if richtung.length() > 0.01:
		blick = richtung.normalized()
		_blick_ziel_zeit = zeit() + 0.45


func zug(kraft: Vector3) -> void:
	_zug += kraft


func springen_zu(ziel: Vector3, dauer: float, bei_landung: Callable = Callable(), nur_frei := false) -> void:
	## Sprung im Bogen (über Wände). nur_frei = am Hindernis vorher stoppen (Gadget-Sprung)
	if tot or _springt:
		return
	ziel.y = 0
	if nur_frei:
		var q := PhysicsRayQueryParameters3D.create(global_position + Vector3(0, 0.8, 0), ziel + Vector3(0, 0.8, 0), 1 | 4)
		var hit := get_world_3d().direct_space_state.intersect_ray(q)
		if hit:
			var p: Vector3 = hit.position
			ziel = Vector3(p.x, 0, p.z) - (ziel - global_position).normalized() * 0.5
	else:
		ziel = arena.freier_punkt(ziel)
	_springt = true
	zielen_auf(ziel - global_position)
	var start := global_position
	var tw := create_tween()
	tw.tween_method(func(f: float):
		var p := start.lerp(ziel, f)
		p.y = sin(f * PI) * (2.5 if not nur_frei else 0.8)
		global_position = p, 0.0, 1.0, dauer)
	tw.tween_callback(func():
		global_position = Vector3(ziel.x, 0, ziel.z)
		_springt = false
		_quetsch = 1.0
		Effekte.ring(arena, global_position, 1.4, Color.WHITE, 0.25)
		if bei_landung.is_valid():
			bei_landung.call())


func sprint_starten(richtung: Vector3, weite: float, schaden: float) -> void:
	_sprint_richtung = richtung
	_sprint_bis = zeit() + weite / 17.0
	_sprint_schaden = schaden
	_sprint_getroffen.clear()


func blase_zeigen(farbe: Color, _dauer: float, alpha := 0.25) -> void:
	if _blase == null:
		_blase = MeshInstance3D.new()
		var k := SphereMesh.new()
		k.radius = 1.1
		k.height = 2.2
		_blase.mesh = k
		_blase.position.y = 0.9
		add_child(_blase)
	var c := farbe
	c.a = alpha
	_blase.material_override = Toon.unschattiert(c, true)


# ---------------------------------------------------------------- Kampf
func reichweite() -> float:
	return float(daten["angriff"]["reichweite"])


func kann_angreifen() -> bool:
	return not tot and munition >= 1.0 and not _springt and not hat_effekt("betaeubt")


func angreifen(richtung: Vector3, ziel_punkt := Vector3.INF) -> void:
	if _regelbruch_pruefen():
		return
	if not kann_angreifen():
		return
	richtung.y = 0
	if richtung.length() < 0.01:
		richtung = blick
	richtung = richtung.normalized()
	munition -= 1.0
	_letzter_angriff = zeit()
	pose_setzen("")
	if arena.has_method("laerm"):
		arena.laerm(self, global_position, 11.0)
	_effekte.erase("spawnschutz")
	_tarnung_beenden()
	zielen_auf(richtung)
	if _baum and _anim.has_animation("Attack"):
		_baum.set("parameters/angriff/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
	var a: Dictionary = daten["angriff"]
	var farbe := Color.html(a["farbe"])
	var start := global_position + Vector3(0, 1.0, 0) + richtung * 0.5
	var schaden := float(a["schaden"]) * schadens_faktor() * effekt("hinterhalt", 1.0)
	_effekte.erase("hinterhalt")
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
				var texte: Array = a.get("geschoss_text", [])
				arena.projektil(self, start, richtung.rotated(Vector3.UP, w), float(a["projektil_tempo"]),
					reichweite(), schaden, farbe, 0.22 if a["typ"] == "schuss" else 0.16,
					str(texte[randi() % texte.size()]) if texte.size() > 0 else "",
					str(a.get("geschoss_modell", "")), a.get("verlangsamt", {}))
			Arena.ton("schuss")
		"wurf":
			var ziel := ziel_punkt
			if ziel == Vector3.INF:
				ziel = global_position + richtung * reichweite()
			var weg := ziel - global_position
			weg.y = 0
			if weg.length() > reichweite():
				ziel = global_position + weg.normalized() * reichweite()
			arena.wurf(self, start, ziel, schaden, float(a["radius"]), farbe, false,
				str(a.get("geschoss_modell", "")), a.get("verlangsamt", {}))
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
					k.schaden_nehmen(schaden, self, richtung * 6.0)
			Arena.ton("schlag")


## Rote Warnung am Boden (Linie/Fächer, Zielkreis oder Halbkreis), dann wird genau dorthin angegriffen.
func _angriff_ankuendigen(richtung: Vector3, ziel: Vector3) -> void:
	if _ansage_laeuft or not kann_angreifen():
		return
	_ansage_laeuft = true
	richtung.y = 0
	richtung = richtung.normalized() if richtung.length() > 0.01 else blick
	zielen_auf(richtung)
	var a: Dictionary = daten["angriff"]
	var marke := MeshInstance3D.new()
	var farbe := Color(1.0, 0.15, 0.2, 0.0)
	match a["typ"]:
		"wurf":
			var weg := ziel - global_position
			weg.y = 0
			if weg.length() > reichweite():
				ziel = global_position + weg.normalized() * reichweite()
			var r := float(a.get("radius", 1.4))
			var z := CylinderMesh.new()
			z.top_radius = r
			z.bottom_radius = r
			z.height = 0.02
			z.radial_segments = 32
			marke.mesh = z
			arena.add_child(marke)
			marke.global_position = Vector3(ziel.x, 0.04, ziel.z)
		"nahkampf":
			var z2 := CylinderMesh.new()
			z2.top_radius = reichweite()
			z2.bottom_radius = reichweite()
			z2.height = 0.02
			marke.mesh = z2
			arena.add_child(marke)
			marke.global_position = global_position + Vector3(0, 0.04, 0) + richtung * reichweite() * 0.35
			marke.scale = Vector3(1, 1, 0.6)
			marke.rotation.y = atan2(richtung.x, richtung.z)
		_:
			var q := QuadMesh.new()
			var breite := 0.5 + deg_to_rad(float(a.get("streuung", 0))) * reichweite() * 0.6
			q.size = Vector2(breite, reichweite())
			q.center_offset = Vector3(0, reichweite() / 2.0, 0)
			q.orientation = PlaneMesh.FACE_Y
			marke.mesh = q
			arena.add_child(marke)
			marke.global_position = global_position + Vector3(0, 0.05, 0)
			marke.rotation.y = atan2(richtung.x, richtung.z)
	var mat := Toon.unschattiert(farbe, true)
	marke.material_override = mat
	var tw := marke.create_tween()
	tw.tween_property(mat, "albedo_color:a", 0.5, ansage_zeit * 0.8)
	await get_tree().create_timer(ansage_zeit).timeout
	if is_instance_valid(marke):
		marke.queue_free()
	_ansage_laeuft = false
	if not tot and not hat_effekt("betaeubt"):
		angreifen(richtung, ziel)


## "Silence": Wer verstummt ist und trotzdem angreift, ist sofort K.o.
var verstummt_von: Kaempfer = null


func _regelbruch_pruefen() -> bool:
	if tot or not hat_effekt("verstummt"):
		return false
	Effekte.ruf(self, "ZU LAUT!", Color("#FF4757"))
	Arena.ton("ko")
	leben = 0.0
	_effekte.erase("spawnschutz")
	_ausschalten(verstummt_von if is_instance_valid(verstummt_von) else null)
	return true


func _tarnung_beenden() -> void:
	if super_info.get("bleibt_beim_angriff", false):
		return
	if hat_effekt("unsichtbar"):
		_effekte.erase("unsichtbar")


func super_bereit() -> bool:
	return not tot and super_ladung >= 1.0 and not _springt and not super_info.is_empty() and not hat_effekt("betaeubt")


func super_ausloesen(richtung: Vector3, ziel_punkt := Vector3.INF) -> void:
	if _regelbruch_pruefen():
		return
	if not super_bereit():
		return
	super_ladung = 0.0
	richtung.y = 0
	if richtung.length() < 0.01:
		richtung = blick
	richtung = richtung.normalized()
	zielen_auf(richtung)
	_letzter_angriff = zeit()
	_effekte.erase("spawnschutz")
	if _baum and _anim.has_animation("Super"):
		_baum.set("parameters/super/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
	Arena.ton("super")
	Effekte.super_blitz(arena, global_position, Color.html(super_info.get("farbe", "#FF4D6D")))
	if super_info.get("ruf", "") != "":
		Effekte.ruf(self, str(super_info["ruf"]), Color.html(super_info.get("farbe", "#FFD23F")))
	letzter_super = zeit()
	pose_setzen("")
	if arena.has_method("laerm"):
		arena.laerm(self, global_position, 14.0)
	Faehigkeiten.super_ausfuehren(self, super_info, richtung, ziel_punkt)


func gadget_bereit() -> bool:
	return not tot and gadget_ladungen > 0 and zeit() >= _gadget_bereit_ab and not _springt and not hat_effekt("betaeubt")


func gadget_abklingen() -> float:
	## 0 = bereit, 1 = gerade benutzt
	return clampf((_gadget_bereit_ab - zeit()) / Faehigkeiten.GADGET_ABKLINGZEIT, 0.0, 1.0)


func gadget_ausloesen(richtung: Vector3) -> void:
	if _regelbruch_pruefen():
		return
	if not gadget_bereit():
		return
	gadget_ladungen -= 1
	_gadget_bereit_ab = zeit() + Faehigkeiten.GADGET_ABKLINGZEIT
	richtung.y = 0
	if richtung.length() < 0.01:
		richtung = blick
	Faehigkeiten.gadget_ausfuehren(self, gadget_info, richtung.normalized())


func _sprint_treffer() -> void:
	for k in arena.gegner_von(team):
		if k in _sprint_getroffen:
			continue
		if k.global_position.distance_to(global_position) < 1.3:
			_sprint_getroffen.append(k)
			k.schaden_nehmen(_sprint_schaden, self, _sprint_richtung * 14.0)
	if get_slide_collision_count() > 0:
		_sprint_bis = 0.0


func super_laden(menge: float) -> void:
	super_ladung = minf(1.0, super_ladung + menge * (1.0 + passiv("superlader")))


func schaden_nehmen(menge: float, quelle: Kaempfer, stoss := Vector3.ZERO) -> void:
	if tot or hat_effekt("spawnschutz"):
		return
	menge *= 1.0 - effekt("schild")
	menge *= 1.0 - effekt("blase")
	menge *= 1.0 - passiv("dicke_haut")
	leben -= menge
	_letzter_schaden = zeit()
	if ist_spieler and arena.hud and arena.hud.has_method("treffer_blitz"):
		arena.hud.treffer_blitz(menge / max_leben)
	_blitz = 1.0
	_quetsch = 1.0
	_rueckstoss += stoss * (0.2 if hat_effekt("blase") else 1.0)
	_tarnung_beenden()
	Effekte.zahl(arena, global_position + Vector3(0, kopf_hoehe() - 0.2, 0), int(menge), quelle != null and quelle.ist_spieler)
	if quelle and quelle != self and is_instance_valid(quelle):
		quelle.schaden_gesamt += menge
		quelle.super_laden(float(quelle.super_info.get("ladung_pro_treffer", 0.12)))
		if quelle.passiv("vampir") > 0.0:
			quelle.heilen(menge * quelle.passiv("vampir"))
		if passiv("dornen") > 0.0 and not quelle.tot:
			quelle.leben = maxf(1.0, quelle.leben - menge * passiv("dornen"))
	if _baum and _anim.has_animation("Hit") and randf() < 0.5:
		_baum.set("parameters/treffer/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
	if leben <= 0.0:
		leben = 0.0
		_ausschalten(quelle)


func heilen(menge: float, erzwingen := false) -> void:
	if tot:
		return
	if not erzwingen and arena and arena.has_method("heilung_erlaubt") and not arena.heilung_erlaubt(self):
		return
	leben = minf(max_leben, leben + menge)


func _ausschalten(taeter: Kaempfer) -> void:
	tot = true
	_sprint_bis = 0.0
	_effekte.clear()
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
	_springt = false
	_ki_pfad.clear()
	effekt_setzen("spawnschutz", SPAWNSCHUTZ, 1.0)
	set_physics_process(true)
	Effekte.puff(arena, punkt + Vector3(0, 0.5, 0), Color("#FFF3B0"))


func stehen_bleiben() -> void:
	if _baum:
		_baum.active = false
	if _anim and _anim.has_animation("Idle"):
		_anim.play("Idle")


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
			if ansage_zeit > 0.0:
				_angriff_ankuendigen(vorhalt, _ki_ziel.global_position + _ki_ziel.velocity * 0.4)
			else:
				angreifen(vorhalt, _ki_ziel.global_position + _ki_ziel.velocity * 0.4)
			_ki_schuss_pause = randf_range(ki_feuerpause.x, ki_feuerpause.y)
		if super_bereit() and d < float(super_info.get("reichweite", 7.0)) * 0.9 and sicht:
			super_ausloesen(zu, _ki_ziel.global_position)
		if gadget_bereit() and _ki_gadget_sinnvoll(d):
			gadget_ausloesen(zu if gadget_info.get("typ") != "sprung" else -zu if leben < max_leben * 0.35 else zu)
	elif gadget_bereit() and gadget_info.get("typ") == "heiltrank" and leben < max_leben * 0.4:
		gadget_ausloesen(blick)


func _ki_gadget_sinnvoll(d: float) -> bool:
	match gadget_info.get("typ", ""):
		"heiltrank":
			return leben < max_leben * 0.45
		"stosswelle", "frost":
			return d < 3.0
		"schutzblase":
			return leben < max_leben * 0.5 and zeit() - _letzter_schaden < 0.3
		"sprung":
			return leben < max_leben * 0.35 or d > reichweite() * 1.2
		"mine":
			return d < 4.0
		"turbo":
			return leben < max_leben * 0.35
		"munition":
			return munition < 1.0
	return false


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
