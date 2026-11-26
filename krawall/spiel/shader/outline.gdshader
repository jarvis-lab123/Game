// Comic-Umrisslinie (Inverted Hull): zweiter Durchgang, nach außen geschoben, nur Rückseiten
shader_type spatial;
render_mode unshaded, cull_front, depth_draw_opaque, shadows_disabled;

uniform vec4 linien_farbe : source_color = vec4(0.09, 0.07, 0.13, 1.0);
uniform float dicke = 0.016;

void vertex() {
	VERTEX += NORMAL * dicke;
}

void fragment() {
	ALBEDO = linien_farbe.rgb;
}
