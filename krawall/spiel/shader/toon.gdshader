// Krawall Crew – Comic/Toon-Shader: harte Licht/Schatten-Stufen, Randlicht, Glanzpunkt, Treffer-Blitz
shader_type spatial;
render_mode cull_back, depth_draw_opaque;

uniform vec4 farbe : source_color = vec4(1.0);
uniform sampler2D textur : source_color, filter_linear_mipmap, repeat_enable;
uniform bool hat_textur = false;
uniform float glanz : hint_range(0.0, 1.0) = 0.0;
uniform float rand_licht : hint_range(0.0, 1.0) = 0.22;
uniform float leuchten : hint_range(0.0, 2.0) = 0.0;
uniform float blitz : hint_range(0.0, 1.0) = 0.0;
uniform vec4 blitz_farbe : source_color = vec4(1.0);
uniform float saettigung = 1.12;

void fragment() {
	vec3 c = farbe.rgb;
	if (hat_textur) {
		c *= texture(textur, UV).rgb;
		// Texturen etwas kräftiger und flacher machen: wirkt gezeichneter
		float g = dot(c, vec3(0.299, 0.587, 0.114));
		c = mix(vec3(g), c, saettigung);
	}
	ALBEDO = mix(c, blitz_farbe.rgb, blitz * 0.7);
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
	float r = 1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	r = smoothstep(0.66, 0.72, r) * rand_licht;
	EMISSION = c * (r + leuchten) + blitz_farbe.rgb * blitz * 0.5;
}

void light() {
	float ndl = dot(NORMAL, LIGHT);
	float schatten = smoothstep(0.35, 0.65, ATTENUATION);
	// zwei Stufen: voller Schatten, Halbton, Licht
	float stufe = 0.45 * smoothstep(-0.22, -0.16, ndl) + 0.55 * smoothstep(0.10, 0.16, ndl);
	stufe *= mix(0.35, 1.0, schatten);
	DIFFUSE_LIGHT += LIGHT_COLOR / PI * stufe;
	if (glanz > 0.0) {
		vec3 h = normalize(VIEW + LIGHT);
		float s = smoothstep(0.955, 0.965, dot(NORMAL, h)) * glanz * schatten;
		SPECULAR_LIGHT += LIGHT_COLOR / PI * s;
	}
}
