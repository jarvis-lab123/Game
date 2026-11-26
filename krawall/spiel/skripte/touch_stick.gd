## Virtueller Joystick für Touchscreens (Bewegen, Zielen+Angriff, Super).
class_name TouchStick
extends Control

signal losgelassen(richtung: Vector2, gezielt: bool)

var art := "bewegung"      # bewegung | angriff | super
var wert := Vector2.ZERO
var ladung := 0.0
var _finger := -1
var _mitte := Vector2.ZERO
var _knopf := Vector2.ZERO
var _max_weg := 0.0

const SCHRIFT := preload("res://schrift/LilitaOne-Regular.ttf")


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP


func gezogen() -> bool:
	return _finger >= 0 and art != "bewegung" and wert.length() > 0.25


func _ruhe_mitte() -> Vector2:
	return size / 2.0


func _gui_input(e: InputEvent) -> void:
	if e is InputEventScreenTouch:
		var t: InputEventScreenTouch = e
		if t.pressed and _finger < 0:
			if art == "super" and ladung < 1.0:
				return
			_finger = t.index
			_mitte = t.position if art == "bewegung" else _ruhe_mitte()
			_knopf = t.position
			_max_weg = minf(size.x, size.y) * 0.32
			_aktualisieren()
		elif not t.pressed and t.index == _finger:
			var w := wert
			_finger = -1
			wert = Vector2.ZERO
			if art != "bewegung":
				losgelassen.emit(w.normalized() if w.length() > 0.25 else Vector2.ZERO, w.length() > 0.25)
		queue_redraw()
	elif e is InputEventScreenDrag:
		var d: InputEventScreenDrag = e
		if d.index == _finger:
			_knopf = d.position
			_aktualisieren()
			queue_redraw()


func _aktualisieren() -> void:
	var v := _knopf - _mitte
	if v.length() > _max_weg:
		v = v.normalized() * _max_weg
	wert = v / maxf(_max_weg, 1.0)


func _process(_d: float) -> void:
	if art == "super":
		queue_redraw()


func _draw() -> void:
	var m := _mitte if _finger >= 0 else _ruhe_mitte()
	var r := minf(size.x, size.y) * 0.36
	if art == "super":
		super_kreis(self, m, r, ladung, SCHRIFT)
		if _finger >= 0:
			draw_circle(m + wert * r, r * 0.4, Color(1, 0.85, 0.2, 0.9))
		return
	var farbe := Color(1, 1, 1, 0.22) if art == "bewegung" else Color(1, 0.62, 0.11, 0.35)
	draw_circle(m, r, farbe)
	draw_arc(m, r, 0, TAU, 48, Color(0.1, 0.08, 0.15, 0.6), 5.0, true)
	draw_circle(m + wert * r * 0.9, r * 0.42, Color(1, 1, 1, 0.75) if art == "bewegung" else Color("#FF9F1C"))


static func super_kreis(ziel: CanvasItem, m: Vector2, r: float, ladung: float, schrift: Font) -> void:
	var bereit := ladung >= 1.0
	ziel.draw_circle(m, r + 6, Color("#1B1424"))
	ziel.draw_circle(m, r, Color("#3A2E4F"))
	if ladung > 0.0:
		ziel.draw_arc(m, r - 8, -PI / 2, -PI / 2 + TAU * ladung, 48, Color("#FFD23F"), 14.0, true)
	if bereit:
		var puls := 0.5 + 0.5 * sin(Time.get_ticks_msec() / 150.0)
		ziel.draw_circle(m, r - 18, Color("#FFD23F").lerp(Color("#FFF3B0"), puls))
	var text := "SUPER"
	var fs := int(r * 0.42)
	var tb := schrift.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs)
	ziel.draw_string_outline(schrift, m + Vector2(-tb.x / 2, fs * 0.35), text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, 8, Color("#1B1424"))
	ziel.draw_string(schrift, m + Vector2(-tb.x / 2, fs * 0.35), text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color.WHITE)
