// Raumboden: zweifarbige Kacheln mit weichen Fugen (Farben pro Raum)
shader_type spatial;

uniform vec4 farbe_a : source_color = vec4(0.8);
uniform vec4 farbe_b : source_color = vec4(0.7);
uniform float kachel = 1.0;

varying vec3 welt;

void vertex() {
	welt = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = welt.xz / kachel;
	vec2 z = floor(p);
	vec2 f = fract(p);
	vec3 c = mix(farbe_a.rgb, farbe_b.rgb, mod(z.x + z.y, 2.0));
	float rand = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
	c = mix(c * 0.88, c, smoothstep(0.0, 0.04, rand));
	ALBEDO = c * 0.82;
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
}

void light() {
	float s = smoothstep(0.35, 0.65, ATTENUATION);
	DIFFUSE_LIGHT += LIGHT_COLOR / PI * mix(0.5, 1.0, s) * clamp(dot(NORMAL, LIGHT), 0.0, 1.0);
}
