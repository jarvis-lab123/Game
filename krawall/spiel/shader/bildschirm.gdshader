// Laptop-Bildschirm: Scanlines, Ladebalken, Glitch, weißer Blitz
shader_type spatial;
render_mode unshaded, cull_disabled;

uniform vec4 farbe : source_color = vec4(0.49, 1.0, 0.8, 1.0);
uniform float fortschritt : hint_range(0.0, 1.0) = 0.0;
uniform float glitch : hint_range(0.0, 1.0) = 0.0;
uniform float blitz : hint_range(0.0, 1.0) = 0.0;
uniform float an : hint_range(0.0, 1.0) = 0.0;

float rnd(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

void fragment() {
	vec2 uv = UV;
	// Glitch: Zeilen versetzen
	float zeile = floor(uv.y * 40.0);
	uv.x += (rnd(vec2(zeile, floor(TIME * 20.0))) - 0.5) * 0.15 * glitch * step(0.6, rnd(vec2(zeile * 3.1, floor(TIME * 13.0))));
	vec3 c = vec3(0.07, 0.05, 0.16);
	// Raster im Hintergrund
	vec2 g = fract(uv * vec2(16.0, 10.0) + vec2(0.0, TIME * 0.3));
	float raster = step(0.95, max(g.x, g.y));
	c += farbe.rgb * raster * 0.18 * an;
	// Ladebalken
	vec2 b = (uv - vec2(0.12, 0.72)) / vec2(0.76, 0.1);
	if (b.x > 0.0 && b.x < 1.0 && b.y > 0.0 && b.y < 1.0) {
		c = vec3(0.16, 0.12, 0.3);
		if (b.x < fortschritt) {
			float streifen = step(0.5, fract((b.x * 12.0) - TIME * 3.0 + b.y));
			c = farbe.rgb * (0.85 + 0.15 * streifen);
		}
	}
	// Rand des Balkens
	vec2 r = abs(b - 0.5);
	if (max(r.x, r.y) > 0.5 && max(r.x - 0.03, r.y - 0.2) < 0.5) {
		c = mix(c, vec3(1.0), an);
	}
	// Scanlines + Flimmern
	c *= 0.85 + 0.15 * sin(uv.y * 400.0 + TIME * 10.0);
	c += vec3(rnd(uv * 100.0 + TIME)) * 0.06 * glitch;
	c = mix(vec3(0.03, 0.02, 0.06), c, an);
	c = mix(c, vec3(1.0), blitz);
	ALBEDO = c;
	EMISSION = c * 0.6;
}
