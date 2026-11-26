## Lädt alle Charaktere aus res://charaktere/<id>/charakter.json (+ model.glb)
## und hält die Auswahl zwischen Menü und Spiel.
extends Node

const ORDNER := "res://charaktere"
const KACHEL := 1.6

var charaktere: Array = []
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
}


func _ready() -> void:
	_eingaben()
	laden()


func laden() -> void:
	charaktere.clear()
	var dir := DirAccess.open(ORDNER)
	if dir == null:
		push_error("Ordner %s fehlt" % ORDNER)
		return
	var alle: Array = []
	for name in dir.get_directories():
		if name.begins_with("_"):
			continue
		var pfad := "%s/%s/charakter.json" % [ORDNER, name]
		if not FileAccess.file_exists(pfad):
			continue
		var roh = JSON.parse_string(FileAccess.get_file_as_string(pfad))
		if typeof(roh) != TYPE_DICTIONARY:
			push_warning("Fehler in %s – JSON prüfen" % pfad)
			continue
		var c: Dictionary = _mischen(STANDARD.duplicate(true), roh)
		c["id"] = name
		c["ordner"] = "%s/%s" % [ORDNER, name]
		var modell := "%s/%s/model.glb" % [ORDNER, name]
		c["modell"] = modell if ResourceLoader.exists(modell) else ""
		alle.append(c)
	# Eigene Charaktere haben Vorrang: Platzhalter nur, solange es keine echten gibt
	var echte := alle.filter(func(c): return not c.get("platzhalter", false) and c["modell"] != "")
	charaktere = echte if echte.size() > 0 else alle
	charaktere.sort_custom(func(a, b): return str(a["name"]) < str(b["name"]))
	gewaehlt_index = clampi(gewaehlt_index, 0, maxi(charaktere.size() - 1, 0))


func gewaehlt() -> Dictionary:
	return charaktere[gewaehlt_index] if charaktere.size() > 0 else STANDARD


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
		"auto_angriff": [KEY_SPACE], "super": [KEY_E, KEY_Q], "pause": [KEY_ESCAPE, KEY_P],
	}
	for aktion in tasten:
		if not InputMap.has_action(aktion):
			InputMap.add_action(aktion)
		for t in tasten[aktion]:
			var ev := InputEventKey.new()
			ev.physical_keycode = t
			InputMap.action_add_event(aktion, ev)
	for paar in [["angriff", MOUSE_BUTTON_LEFT], ["super", MOUSE_BUTTON_RIGHT]]:
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
	for b in [["auto_angriff", JOY_BUTTON_A], ["super", JOY_BUTTON_B]]:
		var jb := InputEventJoypadButton.new()
		jb.button_index = b[1]
		InputMap.action_add_event(b[0], jb)
