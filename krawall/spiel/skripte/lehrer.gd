## Lehrer = Gegner in der Schule.
## Alltag: geht zu Aktivitäts-Plätzen (Tafel, Pult, Regal, Kaffeeküche …) und macht dort etwas.
## Wahrnehmung: Sichtkegel + Gehör. "?" = misstrauisch, "!" = entdeckt.
## Entdeckt: höchstens 3 Lehrer greifen gleichzeitig an, die anderen halten Abstand und warten.
## Verliert er dich aus den Augen: sucht an der letzten Stelle und kehrt dann in den Alltag zurück.
class_name Lehrer
extends Kaempfer

const GEH_TEMPO := 0.33          # Anteil der Lauf-Geschwindigkeit im Alltag
const UEBERRASCHUNG := 1.5       # Schadensfaktor, wenn der Lehrer dich noch nicht bemerkt hat

var zustand := "alltag"          # alltag · misstrauisch · alarm · angriff · warten · suchen
var verdacht := 0.0              # 0..1 (bei 1: entdeckt)
var sicht := 9.0
var sichtwinkel := 115.0
var raum_wahl: Array = []
var beute_heilung := 0.0
var heimraum := ""               # eigener Raum (pro Raum nur ein Lehrer)
var ulti_sekunden := 12.0         # im Kampf lädt die Ulti zusätzlich in dieser Zeit voll auf
var wut_text := "JETZT REICHT'S!"
var _wutphase := false
var _ausweichen_ab := 0.0
var zorn: Dictionary = {}        # {"nach": s Dauerkampf, "dauer": s, "faktor": 2.0, "text": "ANGRY MODE!"}
var _zornzeit := 0.0
var burnout: Dictionary = {}     # {"nach": s Dauerkampf, "dauer": s reglos, "text": "BURN OUT"}
var _kampfzeit := 0.0
var _dampf_timer := 0.0

var _platz: Dictionary = {}      # aktueller Aktivitätsplatz
var _platz_bis := 0.0
var _pfad_alltag: PackedVector3Array = []
var _zuletzt_gesehen := Vector3.ZERO
var _gesehen_zeit := -99.0
var _zustand_seit := 0.0
var _wahrnehmung_timer := 0.0
var _blase_label: Label3D
var _schau_winkel := 0.0


func lehrer_einrichten(info: Dictionary) -> void:
	sicht = float(info.get("sicht", 9.0))
	sichtwinkel = float(info.get("sichtwinkel", 115.0))
	raum_wahl = info.get("raeume", [])
	beute_heilung = float(info.get("beute_heilung", 0.0))
	burnout = info.get("burnout", {})
	zorn = info.get("zorn", {})
	wut_text = str(info.get("wut_text", wut_text))
	_blase_label = Label3D.new()
	_blase_label.font = Effekte.SCHRIFT
	_blase_label.font_size = 120
	_blase_label.outline_size = 24
	_blase_label.outline_modulate = Color("#1B1424")
	_blase_label.pixel_size = 0.006
	_blase_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_blase_label.no_depth_test = true
	_blase_label.position.y = kopf_hoehe() + 0.3
	add_child(_blase_label)


func ist_ahnungslos() -> bool:
	return zustand in ["alltag", "misstrauisch"]


func _zu(neu: String) -> void:
	if zustand == neu:
		return
	if zustand in ["angriff"] and neu != "angriff":
		arena.angriff_abmelden(self)
	zustand = neu
	_zustand_seit = zeit()
	einrasten = Vector3.INF
	if neu != "alltag":
		pose_setzen("")
		_platz = {}


# ---------------------------------------------------------------- Hauptschleife (aus Kaempfer._physics_process)
func _ki_denken(delta: float) -> void:
	var sp: Kaempfer = arena.spieler
	if _burnout_pruefen(delta):
		return
	_wahrnehmen(delta, sp)
	_blase_aktualisieren()
	match zustand:
		"alltag":
			_alltag(delta)
		"misstrauisch":
			bewegung = Vector3.ZERO
			_hinschauen(_zuletzt_gesehen)
			if verdacht <= 0.0:
				_zu("alltag")
		"alarm":
			bewegung = Vector3.ZERO
			_hinschauen(sp.global_position)
			if zeit() - _zustand_seit > 0.55:
				_zu("angriff" if arena.angriff_anmelden(self) else "warten")
		"angriff":
			if ulti_sekunden > 0.0:
				super_ladung = minf(1.0, super_ladung + delta / ulti_sekunden)
			_wut_pruefen()
			_zorn_pruefen(delta)
			if sp.tot:
				_zu("suchen")
				return
			super._ki_denken(delta)   # Kampf-KI aus Kaempfer: verfolgen, Abstand, schießen, Super, Gadget
			if zeit() - _gesehen_zeit > 5.0:
				_zu("suchen")
		"warten":
			_warten(sp)
		"suchen":
			_suchen(delta)


# ---------------------------------------------------------------- Burnout (z. B. Frau Rahn)
## Nach einer Weile Dauerkampf: Schriftzug, sie sackt zusammen und kann sich einige Sekunden nicht bewegen.
func _burnout_pruefen(delta: float) -> bool:
	if burnout.is_empty():
		return false
	if hat_effekt("betaeubt"):
		bewegung = Vector3.ZERO
		_dampf_timer -= delta
		if _dampf_timer <= 0.0:
			_dampf_timer = 0.35
			Effekte.dampf(arena, global_position + Vector3(randf_range(-0.2, 0.2), 1.7, randf_range(-0.2, 0.2)))
		return true
	if pose_ist_burnout:
		pose_ist_burnout = false
		pose_setzen("")
		_blase_label.visible = true
	if zustand == "angriff":
		_kampfzeit += delta
		if _kampfzeit >= float(burnout.get("nach", 12.0)):
			_kampfzeit = 0.0
			var dauer := float(burnout.get("dauer", 5.0))
			effekt_setzen("betaeubt", dauer, 1.0)
			bewegung = Vector3.ZERO
			pose_setzen("Sit")       # sackt erschöpft zu Boden
			pose_ist_burnout = true
			_blase_label.text = ""
			Effekte.ruf(self, str(burnout.get("text", "BURN OUT")), Color("#FF6B35"))
			Arena.ton("ko")
			return true
	else:
		_kampfzeit = maxf(0.0, _kampfzeit - delta * 0.5)
	return false


var pose_ist_burnout := false


# ---------------------------------------------------------------- Wahrnehmung
func _wahrnehmen(delta: float, sp: Kaempfer) -> void:
	_wahrnehmung_timer -= delta
	if _wahrnehmung_timer > 0.0:
		return
	_wahrnehmung_timer = 0.1
	var dt := 0.1
	if sp == null or sp.tot:
		verdacht = maxf(0.0, verdacht - dt * 0.4)
		return
	var zu := sp.global_position - global_position
	zu.y = 0
	var d := zu.length()
	var sieht := false
	if d < sicht:
		var vorne := Vector3(sin(modell.rotation.y), 0, cos(modell.rotation.y))
		var winkel := rad_to_deg(vorne.angle_to(zu.normalized())) if d > 0.01 else 0.0
		if (winkel < sichtwinkel * 0.5 or d < 2.2) and arena.freie_sicht(global_position, sp.global_position) and not sp.ist_unsichtbar():
			sieht = true
	if sieht:
		_zuletzt_gesehen = sp.global_position
		_gesehen_zeit = zeit()
		if ist_ahnungslos():
			# je näher, desto schneller wird der Verdacht zur Gewissheit
			verdacht += dt * (0.45 + 2.2 * (1.0 - d / sicht))
	elif ist_ahnungslos():
		verdacht = maxf(0.0, verdacht - dt * 0.25)
	if ist_ahnungslos():
		if verdacht >= 1.0:
			entdecken()
		elif verdacht >= 0.3 and zustand == "alltag":
			_zu("misstrauisch")


## Geräusch in der Nähe (Schüsse, Supers): Durch Wände hört man nur halb so weit.
func hoeren(pos: Vector3, reichweite: float) -> void:
	# im Kampf: ab und zu seitlich ausweichen, wenn der Spieler schießt
	if zustand == "angriff" and not tot and zeit() > _ausweichen_ab and not hat_effekt("betaeubt") \
			and global_position.distance_to(pos) < 12.0 and randf() < 0.3:
		_ausweichen_ab = zeit() + 2.5
		var weg := (global_position - pos).normalized().cross(Vector3.UP) * (1.0 if randf() < 0.5 else -1.0)
		springen_zu(global_position + weg * 2.4, 0.28, Callable(), true)
	if tot or not ist_ahnungslos():
		if zustand in ["suchen", "warten"]:
			_zuletzt_gesehen = pos
		return
	var d := global_position.distance_to(pos)
	if not arena.freie_sicht(global_position, pos):
		reichweite *= 0.5
	if d < reichweite:
		verdacht = maxf(verdacht, 0.55 + 0.4 * (1.0 - d / reichweite))
		_zuletzt_gesehen = pos
		if zustand == "alltag":
			_zu("misstrauisch")


func entdecken() -> void:
	if not ist_ahnungslos() and zustand != "suchen":
		return
	verdacht = 1.0
	_gesehen_zeit = zeit()
	_zu("alarm")
	alarm_animation()
	Arena.ton("zaehlen")


func schaden_nehmen(menge: float, quelle: Kaempfer, stoss := Vector3.ZERO, ladung := 1.0) -> void:
	if quelle and quelle.team != team and ist_ahnungslos() and not tot:
		menge *= UEBERRASCHUNG
		_zuletzt_gesehen = quelle.global_position
		super.schaden_nehmen(menge, quelle, stoss, ladung)
		if not tot:
			entdecken()
		return
	if quelle and quelle.team != team:
		_zuletzt_gesehen = quelle.global_position
		_gesehen_zeit = zeit()
		if zustand == "suchen":
			entdecken()
	super.schaden_nehmen(menge, quelle, stoss, ladung)


## Angry-Modus (z. B. Frau Gerometta): nach Dauerkampf einige Sekunden doppelter Schaden
func _zorn_pruefen(delta: float) -> void:
	if zorn.is_empty() or hat_effekt("zorn"):
		return
	_zornzeit += delta
	if _zornzeit >= float(zorn.get("nach", 10.0)):
		_zornzeit = 0.0
		var dauer := float(zorn.get("dauer", 6.0))
		effekt_setzen("zorn", dauer, float(zorn.get("faktor", 2.0)))
		blase_zeigen(Color("#FF1E3C"), dauer, 0.22)
		Effekte.ruf(self, str(zorn.get("text", "ANGRY MODE!")), Color("#FF1E3C"))
		Effekte.ring(arena, global_position, 3.0 * groesse_faktor() * 0.6, Color("#FF1E3C"))
		arena.wackeln(0.3)
		Arena.ton("super")


## Wutphase: einmal bei halbem Leben – Ruf, schneller und häufiger angreifen
func _wut_pruefen() -> void:
	if _wutphase or tot or leben > max_leben * 0.5:
		return
	_wutphase = true
	Effekte.ruf(self, wut_text, Color("#FF4757"))
	ki_feuerpause *= 0.7
	ansage_zeit *= 0.8
	effekt_setzen("turbo", 9999.0, 0.2)
	blase_zeigen(Color("#FF3B30"), 9999.0, 0.12)
	effekt_setzen("wut_glut", 9999.0, 1.0)


func _blase_aktualisieren() -> void:
	match zustand:
		"misstrauisch":
			_blase_label.text = "?"
			_blase_label.modulate = Color("#FFD23F")
		"alarm", "angriff":
			_blase_label.text = "!"
			_blase_label.modulate = Color("#FF4757")
		"warten":
			_blase_label.text = "!"
			_blase_label.modulate = Color("#FF9F1C")
		"suchen":
			_blase_label.text = "?"
			_blase_label.modulate = Color("#FF9F1C")
		_:
			_blase_label.text = ""
	var puls := 1.0 + 0.12 * sin(zeit() * 10.0)
	_blase_label.scale = Vector3.ONE * puls


# ---------------------------------------------------------------- Alltag
func _alltag(delta: float) -> void:
	if regeneration == false and leben < max_leben:
		leben = minf(max_leben, leben + max_leben * 0.06 * delta)
	if _platz.is_empty():
		_platz = arena.aktivitaet_waehlen(self)
		_pfad_alltag = arena.pfad(global_position, _platz["pos"])
		pose_setzen("")
		einrasten = Vector3.INF
		return
	var ziel: Vector3 = _platz["pos"]
	var flach := Vector3(ziel.x - global_position.x, 0, ziel.z - global_position.z)
	if _platz_bis == 0.0:
		# unterwegs zum Platz
		while _pfad_alltag.size() > 0 and Vector2(_pfad_alltag[0].x - global_position.x, _pfad_alltag[0].z - global_position.z).length() < 0.4:
			_pfad_alltag.remove_at(0)
		if flach.length() < 0.9:
			bewegung = Vector3.ZERO
			einrasten = Vector3(ziel.x, 0, ziel.z)
			_platz_bis = zeit() + randf_range(float(_platz.get("min", 6.0)), float(_platz.get("max", 15.0)))
			pose_setzen(_platz.get("anim", ""))
			arena.platz_belegen(_platz, self)
		elif _pfad_alltag.size() > 0:
			var r := _pfad_alltag[0] - global_position
			r.y = 0
			bewegung = r.normalized() * GEH_TEMPO
		else:
			bewegung = flach.normalized() * GEH_TEMPO
	else:
		# beim Platz: Tätigkeit ausführen, natürlich in Blickrichtung des Platzes
		bewegung = Vector3.ZERO
		var b: Vector3 = _platz.get("blick", Vector3.ZERO)
		if b != Vector3.ZERO:
			_schau_winkel = sin(zeit() * 0.4 + get_instance_id()) * (0.35 if _platz.get("anim", "") == "" else 0.08)
			zielen_auf(b.rotated(Vector3.UP, _schau_winkel))
		if zeit() > _platz_bis:
			arena.platz_freigeben(_platz)
			_platz = {}
			_platz_bis = 0.0
			einrasten = Vector3.INF
			pose_setzen("")


func _hinschauen(p: Vector3) -> void:
	var r := p - global_position
	r.y = 0
	if r.length() > 0.1:
		zielen_auf(r)


# ---------------------------------------------------------------- Warten (Platz frei für max. 3 Angreifer)
func _warten(sp: Kaempfer) -> void:
	## Kein Angriffsplatz frei: zurück in den eigenen Raum und dort abwarten (nicht mit mehreren um den Spieler stehen)
	if zeit() - _zustand_seit > 0.8 and int(zeit() * 2.0) % 2 == 0 and arena.freie_sicht(global_position, sp.global_position) \
			and global_position.distance_to(sp.global_position) < sicht and arena.angriff_anmelden(self):
		_zu("angriff")
		return
	var ziel: Vector3 = arena.raum_mitte(heimraum) if heimraum != "" else spawn_punkt
	var flach := Vector3(ziel.x - global_position.x, 0, ziel.z - global_position.z)
	if flach.length() > 1.5:
		if _ki_pfad.is_empty() or int(zeit() * 2.0) % 4 == 0:
			_ki_pfad = arena.pfad(global_position, ziel)
		while _ki_pfad.size() > 0 and Vector2(_ki_pfad[0].x - global_position.x, _ki_pfad[0].z - global_position.z).length() < 0.4:
			_ki_pfad.remove_at(0)
		var r := (_ki_pfad[0] if _ki_pfad.size() > 0 else ziel) - global_position
		r.y = 0
		bewegung = r.normalized() * 0.5
	else:
		bewegung = Vector3.ZERO
		_hinschauen(sp.global_position)
	if arena.freie_sicht(global_position, sp.global_position) and global_position.distance_to(sp.global_position) < sicht:
		_gesehen_zeit = zeit()
	elif zeit() - _gesehen_zeit > 6.0:
		verdacht = 0.0
		_zu("alltag")


# ---------------------------------------------------------------- Suchen
func _suchen(delta: float) -> void:
	var flach := Vector3(_zuletzt_gesehen.x - global_position.x, 0, _zuletzt_gesehen.z - global_position.z)
	if flach.length() > 1.0 and zeit() - _zustand_seit < 8.0:
		if _ki_pfad.is_empty() or int(zeit() * 3.0) % 3 == 0:
			_ki_pfad = arena.pfad(global_position, _zuletzt_gesehen)
		while _ki_pfad.size() > 0 and Vector2(_ki_pfad[0].x - global_position.x, _ki_pfad[0].z - global_position.z).length() < 0.4:
			_ki_pfad.remove_at(0)
		var r := (_ki_pfad[0] if _ki_pfad.size() > 0 else _zuletzt_gesehen) - global_position
		r.y = 0
		bewegung = r.normalized() * 0.6
	else:
		# umschauen
		bewegung = Vector3.ZERO
		zielen_auf(Vector3(sin(zeit() * 1.5), 0, cos(zeit() * 1.5)))
		if zeit() - _zustand_seit > 12.0:
			verdacht = 0.0
			_zu("alltag")
	# Wahrnehmung im Suchmodus: Sicht findet dich sofort wieder
	if zeit() - _gesehen_zeit < 0.15:
		entdecken()


func _ausschalten(taeter: Kaempfer) -> void:
	if zustand == "angriff":
		arena.angriff_abmelden(self)
	if not _platz.is_empty():
		arena.platz_freigeben(_platz)
	_blase_label.text = ""
	super._ausschalten(taeter)
