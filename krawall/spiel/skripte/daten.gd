## Lädt alle Charaktere aus res://charaktere/<id>/charakter.json (+ model.glb)
## und hält die Auswahl zwischen Menü und Spiel.
extends Node

const ORDNER := "res://charaktere"
const KACHEL := 1.6

var charaktere: Array = []
var lehrer: Array = []          # Gegner im Schul-Modus (res://lehrer/<id>/charakter.json)
var gewaehlt_index := 0
var siege := 0

const STANDARD := {
	"name": "Unbekannt",
	"titel": "",
	"beschreibung": "",
	"werte": {"leben": 3600, "tempo": 1.0},
	"angriff": {"typ": "schuss", "name": "Angriff", "schaden": 400, "projektile": 1, "streuung": 0.0,
		"reichweite": 8.0, "projektil_tempo": 16.0, "nachladen": 1.4, "radius": 1.4, "farbe": "#FFD23F"},
	"super": {"typ": "sprint", "name": "Super", "schaden": 1000, "ladung_pro_treffer": 0.12,
		"reichweite": 7.0, "farbe": "#FF4D6D"},
	"modell_hoehe": 1.75,
	"seltenheit": "gewoehnlich",
}


func _ready() -> void:
	_eingaben()
	laden()


func laden() -> void:
	charaktere.clear()
	lehrer = _ordner_laden("res://lehrer")
	var alle: Array = _ordner_laden(ORDNER)
	# Eigene Charaktere haben Vorrang: Platzhalter nur, solange es keine echten gibt
	var echte := alle.filter(func(c): return not c.get("platzhalter", false) and c["modell"] != "")
	charaktere = echte if echte.size() > 0 else alle
	charaktere.sort_custom(func(a, b): return str(a["name"]) < str(b["name"]))
	var echte_lehrer := lehrer.filter(func(c): return not c.get("platzhalter", false) and c["modell"] != "")
	if echte_lehrer.size() > 0:
		lehrer = echte_lehrer


func _ordner_laden(ordner: String) -> Array:
	var alle: Array = []
	var dir := DirAccess.open(ordner)
	if dir == null:
		return alle
	for name in dir.get_directories():
		if name.begins_with("_"):
			continue
		var pfad := "%s/%s/charakter.json" % [ordner, name]
		if not FileAccess.file_exists(pfad):
			continue
		var roh = JSON.parse_string(FileAccess.get_file_as_string(pfad))
		if typeof(roh) != TYPE_DICTIONARY:
			push_warning("Fehler in %s – JSON prüfen" % pfad)
			continue
		var c: Dictionary = _mischen(STANDARD.duplicate(true), roh)
		c["id"] = name
		c["ordner"] = "%s/%s" % [ordner, name]
		var modell := "%s/%s/model.glb" % [ordner, name]
		c["modell"] = modell if ResourceLoader.exists(modell) else ""
		alle.append(c)
	return alle


func gewaehlt() -> Dictionary:
	return Konto.gewaehlter_charakter()


func charakter(id: String) -> Dictionary:
	for c in charaktere:
		if c["id"] == id:
			return c
	return {}


func _mischen(basis: Dictionary, neu: Dictionary) -> Dictionary:
	for k in neu:
		if basis.has(k) and typeof(basis[k]) == TYPE_DICTIONARY and typeof(neu[k]) == TYPE_DICTIONARY:
			basis[k] = _mischen(basis[k], neu[k])
		else:
			basis[k] = neu[k]
	return basis


func _eingaben() -> void:
	var tasten := {
		"hoch": [KEY_W, KEY_UP], "runter": [KEY_S, KEY_DOWN],
		"links": [KEY_A, KEY_LEFT], "rechts": [KEY_D, KEY_RIGHT],
		"auto_angriff": [KEY_SPACE], "super": [KEY_E, KEY_Q], "gadget": [KEY_F, KEY_R], "pause": [KEY_ESCAPE, KEY_P],
	}
	for aktion in tasten:
		if not InputMap.has_action(aktion):
			InputMap.add_action(aktion)
		for t in tasten[aktion]:
			var ev := InputEventKey.new()
			ev.physical_keycode = t
			InputMap.action_add_event(aktion, ev)
	for paar in [["angriff", MOUSE_BUTTON_LEFT], ["super", MOUSE_BUTTON_RIGHT], ["gadget", MOUSE_BUTTON_MIDDLE]]:
		if not InputMap.has_action(paar[0]):
			InputMap.add_action(paar[0])
		var m := InputEventMouseButton.new()
		m.button_index = paar[1]
		InputMap.action_add_event(paar[0], m)
	# Gamepad
	var achsen := [["links", JOY_AXIS_LEFT_X, -1.0], ["rechts", JOY_AXIS_LEFT_X, 1.0],
		["hoch", JOY_AXIS_LEFT_Y, -1.0], ["runter", JOY_AXIS_LEFT_Y, 1.0]]
	for a in achsen:
		var j := InputEventJoypadMotion.new()
		j.axis = a[1]
		j.axis_value = a[2]
		InputMap.action_add_event(a[0], j)
	for b in [["auto_angriff", JOY_BUTTON_A], ["super", JOY_BUTTON_B], ["gadget", JOY_BUTTON_X]]:
		var jb := InputEventJoypadButton.new()
		jb.button_index = b[1]
		InputMap.action_add_event(b[0], jb)
