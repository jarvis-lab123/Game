## Ersetzt die Materialien importierter Modelle durch Toon-Shader + Comic-Umriss.
class_name Toon
extends RefCounted

const TOON := preload("res://shader/toon.gdshader")
const LINIE := preload("res://shader/outline.gdshader")

static var _cache := {}


## Wandelt alle MeshInstance3D unter `wurzel` um. Gibt die erzeugten Materialien zurück
## (eigene Kopien, wenn `eigen` = true, damit z. B. der Treffer-Blitz pro Figur funktioniert).
static func anwenden(wurzel: Node, linie := 0.016, eigen := false) -> Array:
	var mats: Array = []
	var liste: Array = wurzel.find_children("*", "MeshInstance3D", true, false)
	if wurzel is MeshInstance3D:
		liste.push_front(wurzel)
	for mi in liste:
		var m: MeshInstance3D = mi
		if m.mesh == null:
			continue
		for i in m.mesh.get_surface_count():
			var alt := m.get_active_material(i)
			var neu := material_aus(alt, linie, eigen)
			m.set_surface_override_material(i, neu)
			if not mats.has(neu):
				mats.append(neu)
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return mats


static func material_aus(alt: Material, linie := 0.016, eigen := false) -> ShaderMaterial:
	var farbe := Color.WHITE
	var tex: Texture2D = null
	var glanz := 0.0
	var leuchten := 0.0
	var name := ""
	if alt is BaseMaterial3D:
		var b: BaseMaterial3D = alt
		farbe = b.albedo_color
		tex = b.albedo_texture
		glanz = clampf(1.0 - b.roughness, 0.0, 1.0) if b.roughness < 0.4 else 0.0
		if b.emission_enabled and b.emission.get_luminance() > 0.05:
			leuchten = 0.8
		name = b.resource_name
	var schluessel := "%s|%s|%s|%s|%s" % [farbe.to_html(), str(tex), glanz, leuchten, linie]
	if not eigen and _cache.has(schluessel):
		return _cache[schluessel]
	var m := ShaderMaterial.new()
	m.shader = TOON
	m.resource_name = name
	m.set_shader_parameter("farbe", farbe)
	if tex:
		m.set_shader_parameter("textur", tex)
		m.set_shader_parameter("hat_textur", true)
	m.set_shader_parameter("glanz", glanz)
	m.set_shader_parameter("leuchten", leuchten)
	if linie > 0.0 and leuchten == 0.0:
		var l := ShaderMaterial.new()
		l.shader = LINIE
		l.set_shader_parameter("dicke", linie)
		m.next_pass = l
	if not eigen:
		_cache[schluessel] = m
	return m


## Einfaches einfarbiges Toon-Material (für Effekte, Projektile usw.)
static func farbig(farbe: Color, linie := 0.0, leuchten := 0.0) -> ShaderMaterial:
	var schluessel := "f|%s|%s|%s" % [farbe.to_html(), linie, leuchten]
	if _cache.has(schluessel):
		return _cache[schluessel]
	var m := ShaderMaterial.new()
	m.shader = TOON
	m.set_shader_parameter("farbe", farbe)
	m.set_shader_parameter("leuchten", leuchten)
	if linie > 0.0:
		var l := ShaderMaterial.new()
		l.shader = LINIE
		l.set_shader_parameter("dicke", linie)
		m.next_pass = l
	_cache[schluessel] = m
	return m


static func unschattiert(farbe: Color, transparent := false) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = farbe
	if transparent or farbe.a < 1.0:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	return m
