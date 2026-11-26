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
	_blase_label = Label3D.new()
	_blase_label.font = Effekte.SCHRIFT
	_blase_label.font_size = 120
	_blase_label.outline_size = 24
	_blase_label.outline_modulate = Color("#1B1424")
	_blase_label.pixel_size = 0.006
	_blase_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_blase_label.no_depth_test = true
	_blase_label.position.y = 2.75
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


func schaden_nehmen(menge: float, quelle: Kaempfer, stoss := Vector3.ZERO) -> void:
	if quelle and quelle.team != team and ist_ahnungslos() and not tot:
		menge *= UEBERRASCHUNG
		_zuletzt_gesehen = quelle.global_position
		super.schaden_nehmen(menge, quelle, stoss)
		if not tot:
			entdecken()
		return
	if quelle and quelle.team != team:
		_zuletzt_gesehen = quelle.global_position
		_gesehen_zeit = zeit()
		if zustand == "suchen":
			entdecken()
	super.schaden_nehmen(menge, quelle, stoss)


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
	if zeit() - _zustand_seit > 0.8 and arena.angriff_anmelden(self):
		_zu("angriff")
		return
	var zu := sp.global_position - global_position
	zu.y = 0
	var d := zu.length()
	_hinschauen(sp.global_position)
	var wunsch := reichweite() + 3.5
	if d < wunsch - 1.0:
		bewegung = -zu.normalized() * 0.6
	elif d > wunsch + 3.0:
		var p: PackedVector3Array = arena.pfad(global_position, sp.global_position)
		bewegung = ((p[0] - global_position) * Vector3(1, 0, 1)).normalized() * 0.6 if p.size() > 0 else Vector3.ZERO
	else:
		bewegung = zu.normalized().cross(Vector3.UP) * 0.35 * (1.0 if int(zeit() / 3.0) % 2 == 0 else -1.0)
	if arena.freie_sicht(global_position, sp.global_position):
		_gesehen_zeit = zeit()
	elif zeit() - _gesehen_zeit > 6.0:
		_zu("suchen")


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
