// Arena-Boden: Karomuster in zwei Grüntönen mit weichen Kachelfugen
shader_type spatial;

uniform vec4 farbe_a : source_color = vec4(0.49, 0.80, 0.36, 1.0);
uniform vec4 farbe_b : source_color = vec4(0.43, 0.74, 0.31, 1.0);
uniform vec4 fuge : source_color = vec4(0.36, 0.64, 0.27, 1.0);
uniform vec4 aussen : source_color = vec4(0.84, 0.70, 0.48, 1.0);
uniform float kachel = 1.6;
uniform vec2 halb_groesse = vec2(13.6, 20.0);

varying vec3 welt;

void vertex() {
	welt = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = welt.xz / kachel;
	vec2 z = floor(p);
	vec2 f = fract(p);
	float schach = mod(z.x + z.y, 2.0);
	vec3 c = mix(farbe_a.rgb, farbe_b.rgb, schach);
	float rand = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
	c = mix(fuge.rgb, c, smoothstep(0.0, 0.05, rand));
	vec2 d = abs(welt.xz) - halb_groesse;
	float draussen = step(0.0, max(d.x, d.y));
	c = mix(c, aussen.rgb, draussen);
	ALBEDO = c;
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
}

void light() {
	float s = smoothstep(0.35, 0.65, ATTENUATION);
	DIFFUSE_LIGHT += LIGHT_COLOR / PI * mix(0.45, 1.0, s) * clamp(dot(NORMAL, LIGHT), 0.0, 1.0);
}
