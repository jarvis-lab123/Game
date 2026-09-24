// =====================================================================
//  LUMEN · SONNENFLUG
//  A 3D flight through five dying worlds. Everything – geometry, shaders,
//  music and sound – is generated at runtime. No assets needed.
// =====================================================================
import * as THREE from 'three';
import { EffectComposer } from './lib/postprocessing/EffectComposer.js';
import { RenderPass } from './lib/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './lib/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from './lib/postprocessing/ShaderPass.js';
import { OutputPass } from './lib/postprocessing/OutputPass.js';

const V3 = THREE.Vector3, Color = THREE.Color;
const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const fract = x => x - Math.floor(x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
if (isTouch) document.body.classList.add('touch');

// ---------------------------------------------------------------------
//  Save data
// ---------------------------------------------------------------------
const SAVE_KEY = 'lumen3d';
const save = Object.assign({ best: 0, bestEndless: 0, bestDist: 0, reached: 0, finished: false, quality: 'auto', muted: false, tut: false },
  (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) { return {}; } })());
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* private mode */ } };

// ---------------------------------------------------------------------
//  World constants & zones
// ---------------------------------------------------------------------
const ZL = 5000;              // length of one zone
const SEG = 12;               // generator step
const HALF_W = 30, MIN_Y = 2.4, MAX_Y = 30;
const PR = 0.9;               // player collision radius
const BOSS_AT = 1500;         // distance into zone V where Umbra appears
const VIEW = 720;             // how far ahead the world is built
const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

const ZONES = [
  { name: 'Flüsterwald', sub: 'Die Bäume erinnern sich an das Licht.',
    speed: 62, bpm: 104, prog: [[57, 0], [53, 1], [48, 1], [55, 1]], density: 1.05,
    skyTop: '#01080b', fog: '#0b2d26', glow: '#1f9a70', sun: '#c8ffe6', grid: '#1fe39a', rim: '#45ffb5', base: '#04130f', part: '#b4ffd0',
    fogD: 0.0034, stars: 0.5, aurora: 1, eclipse: 0, sunI: 0.7, M: 40, R: 0.6, W: -99, G: 0, C: 0,
    lines: [[0.3, 'lumen', 'Ich bin so klein … aber ich brenne noch.'], [0.66, 'umbra', 'Flieg nur, kleiner Funke. Jede Flamme erlischt.']] },
  { name: 'Versunkene Stadt', sub: 'Hier tranken sie einst Sonnenlicht aus dem Meer.',
    speed: 71, bpm: 112, prog: [[50, 0], [46, 1], [53, 1], [48, 1]], density: 1.0,
    skyTop: '#01030f', fog: '#0c1f4a', glow: '#2a60ff', sun: '#b0dcff', grid: '#3d9bff', rim: '#72ccff', base: '#050b1e', part: '#a8d8ff',
    fogD: 0.0035, stars: 0.8, aurora: 0, eclipse: 0, sunI: 0.6, M: 24, R: 0.4, W: 0.5, G: 0, C: 0,
    lines: [[0.3, 'lumen', 'Eine ganze Stadt … und kein einziges Fenster brennt mehr aus eigener Kraft.'], [0.66, 'umbra', 'Sie haben mich angefleht, als das Wasser stieg. Ich habe nur zugehört.']] },
  { name: 'Aschenwüste', sub: 'Was die Sonne verbrannte, hat die Nacht vergessen.',
    speed: 79, bpm: 118, prog: [[52, 0], [53, 1], [52, 0], [50, 1]], density: 1.1,
    skyTop: '#0e0303', fog: '#521c0b', glow: '#ff5a1a', sun: '#ffc080', grid: '#ff7a2e', rim: '#ffab4d', base: '#190803', part: '#ffc995',
    fogD: 0.0037, stars: 0.15, aurora: 0, eclipse: 0, sunI: 1.3, M: 26, R: 1.0, W: -99, G: 0, C: 0,
    lines: [[0.3, 'lumen', 'Hier ist die Sonne zerbrochen. Ich spüre ihre Scherben unter dem Sand.'], [0.66, 'umbra', 'Ich habe sie nicht getötet. Ich habe sie nur … ausgeatmet.']] },
  { name: 'Gläserner Himmel', sub: 'Über den Wolken ist der Himmel aus Glas.',
    speed: 86, bpm: 124, prog: [[53, 1], [55, 1], [57, 0], [48, 1]], density: 1.0,
    skyTop: '#0b0628', fog: '#4c3274', glow: '#ff7ad0', sun: '#ffe6f6', grid: '#d38cff', rim: '#9ff4ff', base: '#0d0922', part: '#ffd9f7',
    fogD: 0.0029, stars: 1, aurora: 0.6, eclipse: 0, sunI: 1.1, M: 30, R: 0.5, W: -99, G: -85, C: 1,
    lines: [[0.28, 'lumen', 'So hoch ist noch nie ein Funke geflogen.'], [0.62, 'umbra', 'Je höher du steigst, desto tiefer wirst du fallen.']] },
  { name: 'Herz der Nacht', sub: 'Er wartet auf dich.',
    speed: 82, bpm: 128, prog: [[48, 0], [44, 1], [41, 0], [43, 1]], density: 1.2,
    skyTop: '#000000', fog: '#12051d', glow: '#7a22c0', sun: '#d9a0ff', grid: '#9a3cff', rim: '#c77dff', base: '#06020b', part: '#dcb0ff',
    fogD: 0.0031, stars: 1, aurora: 0.35, eclipse: 1, sunI: 1.1, M: 46, R: 0.8, W: -99, G: 0, C: 0,
    lines: [[0.12, 'lumen', 'Es ist so kalt hier. Selbst mein Licht zittert.']] },
];
const DAWN = { skyTop: '#2f6fd6', fog: '#c98a5e', glow: '#ffb070', sun: '#fff4d6', grid: '#ffcf5a', rim: '#ffe2a0', base: '#24160a', part: '#fff0c0',
  fogD: 0.0024, stars: 0, aurora: 0, eclipse: 0, sunI: 1.5, bpm: 92, prog: [[50, 1], [57, 1], [59, 0], [55, 1]] };

const INTRO = [
  ['narr', 'Die Sonne ist zerbrochen. Seit tausend Nächten herrscht Umbra.', 4.2],
  ['narr', 'Von allem Licht der Welt ist nur ein Funke geblieben.', 3.8],
  ['lumen', 'Das bin ich. Und ich fliege, solange ich brenne.', 4.0],
];

const PAL_KEYS_C = ['skyTop', 'fog', 'glow', 'sun', 'grid', 'rim', 'base', 'part'];
const PAL_KEYS_N = ['fogD', 'stars', 'aurora', 'eclipse', 'sunI'];
function mkPal(z) { const p = {}; for (const k of PAL_KEYS_C) p[k] = new Color(z[k]); for (const k of PAL_KEYS_N) p[k] = z[k]; return p; }
const PALS = ZONES.map(mkPal), PAL_DAWN = mkPal(DAWN);

// ---------------------------------------------------------------------
//  Renderer, scene, camera, post
// ---------------------------------------------------------------------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.3, 4000);
camera.position.set(0, 14, 12);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.8, 0.45, 0.82);
composer.addPass(bloom);
const FinalShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uAberr: { value: 0.0015 }, uGlitch: { value: 0 }, uRadial: { value: 0 }, uVig: { value: 1 }, uGrain: { value: 0.045 }, uFlash: { value: new Color(0, 0, 0) } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uAberr, uGlitch, uRadial, uVig, uGrain; uniform vec3 uFlash; varying vec2 vUv;
    float h1(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      if (uGlitch > 0.01) {
        float band = floor(uv.y * 28.0 + floor(uTime * 24.0) * 3.0);
        float g = step(1.0 - uGlitch * 0.4, h1(vec2(band, floor(uTime * 30.0))));
        uv.x += (h1(vec2(band, 7.0)) - 0.5) * 0.09 * g * uGlitch;
      }
      vec2 c = uv - 0.5; float r2 = dot(c, c);
      vec2 off = c * uAberr * (1.0 + r2 * 5.0);
      vec3 col = vec3(0.0); float ws = 0.0;
      for (int i = 0; i < 6; i++) {
        float t = float(i) / 5.0;
        vec2 u2 = 0.5 + c * (1.0 - t * uRadial * 0.05 * (0.3 + r2 * 3.0));
        float w = 1.0 - t * 0.6;
        col += vec3(texture2D(tDiffuse, u2 + off).r, texture2D(tDiffuse, u2).g, texture2D(tDiffuse, u2 - off).b) * w; ws += w;
        if (uRadial < 0.02) break;
      }
      col /= ws;
      col *= 1.0 - uVig * smoothstep(0.12, 0.62, r2 * 1.6) * 0.7;
      col += uFlash;
      col += (h1(uv * vec2(1731.0, 977.0) + fract(uTime * 7.13) * 91.0) - 0.5) * uGrain;
      gl_FragColor = vec4(col, 1.0);
    }`,
};
const finalPass = new ShaderPass(FinalShader);
composer.addPass(new OutputPass());
composer.addPass(finalPass);
const FX = finalPass.uniforms;

// quality: 0 low, 1 medium, 2 high
let qLevel = save.quality === 'auto' ? (isTouch ? 1 : 2) : { low: 0, mid: 1, high: 2 }[save.quality] ?? 2;
let pixelRatio = 1;
function applyQuality() {
  const dpr = window.devicePixelRatio || 1;
  pixelRatio = [0.7, Math.min(dpr, 1.25), Math.min(dpr, 2)][qLevel];
  renderer.setPixelRatio(pixelRatio);
  composer.setPixelRatio(pixelRatio);
  onResize();
}
function onResize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  PU.uScale.value = h * pixelRatio * 0.5;
}
addEventListener('resize', onResize);

// ---------------------------------------------------------------------
//  Shared uniforms & GLSL
// ---------------------------------------------------------------------
const U = {
  uTime: { value: 0 }, uFog: { value: new Color() }, uFogD: { value: 0.0035 },
  uSkyTop: { value: new Color() }, uGlow: { value: new Color() }, uSun: { value: new Color() }, uSunDir: { value: new V3(0, 0.07, -1).normalize() },
  uGrid: { value: new Color() }, uRim: { value: new Color() }, uBase: { value: new Color() }, uPart: { value: new Color() },
  uStars: { value: 0 }, uAurora: { value: 0 }, uEclipse: { value: 0 }, uSunI: { value: 1 },
  uPlayer: { value: new V3() }, uPlayerCol: { value: new Color().setRGB(1.0, 0.7, 0.35) },
  uZM: { value: ZONES.map(z => z.M).concat([18]) }, uZR: { value: ZONES.map(z => z.R).concat([0.4]) },
  uZW: { value: ZONES.map(z => z.W).concat([0.3]) }, uZG: { value: ZONES.map(z => z.G).concat([0]) },
  uZC: { value: ZONES.map(z => z.C).concat([0.6]) },
  uZL: { value: ZL }, uCycle: { value: 0 }, uEnd: { value: 0 },
};
const pal = mkPal(ZONES[0]);
let palTarget = PALS[0];
function applyPal(p, k) {
  for (const key of PAL_KEYS_C) pal[key].lerp(p[key], k);
  for (const key of PAL_KEYS_N) pal[key] = lerp(pal[key], p[key], k);
  U.uSkyTop.value.copy(pal.skyTop); U.uFog.value.copy(pal.fog); U.uGlow.value.copy(pal.glow); U.uSun.value.copy(pal.sun);
  U.uGrid.value.copy(pal.grid); U.uRim.value.copy(pal.rim); U.uBase.value.copy(pal.base); U.uPart.value.copy(pal.part);
  U.uFogD.value = pal.fogD; U.uStars.value = pal.stars; U.uAurora.value = pal.aurora; U.uEclipse.value = pal.eclipse; U.uSunI.value = pal.sunI;
}

const GLSL_NOISE = `
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * noise(p); p = p * 2.03 + vec2(17.1, 9.7); a *= 0.5; } return v; }
`;
const GLSL_FOG = `
uniform vec3 uFog; uniform float uFogD;
vec3 applyFog(vec3 c, float d){ float f = 1.0 - exp(-pow(uFogD * d, 1.6)); return mix(c, uFog, clamp(f, 0.0, 1.0)); }
`;
const GLSL_ZONE = `
uniform float uZM[6]; uniform float uZR[6]; uniform float uZW[6]; uniform float uZG[6]; uniform float uZC[6];
uniform float uZL, uCycle, uEnd;
void zoneIdx(float z, out int p, out int c, out float t){
  float fz = max(-z, 0.0) / uZL; float zi = floor(fz); float f = fz - zi;
  t = smoothstep(0.0, 0.1, f);
  if (uCycle > 0.5) { c = int(mod(zi, 5.0)); p = int(mod(zi + 4.0, 5.0)); }
  else { c = int(min(zi, 4.0)); p = int(clamp(zi - 1.0, 0.0, 4.0)); if (zi > 4.5) t = 1.0; }
  if (zi < 0.5) t = 1.0;
}
float zoneF(float a, float b, float t, float e){ return mix(mix(a, b, t), e, uEnd); }
`;
const GLSL_HEIGHT = `
float terrainH(vec2 xz, out float W){
  int p, c; float t; zoneIdx(xz.y, p, c, t);
  float M = zoneF(uZM[p], uZM[c], t, uZM[5]);
  float R = zoneF(uZR[p], uZR[c], t, uZR[5]);
  float G = zoneF(uZG[p], uZG[c], t, uZG[5]);
  W = zoneF(uZW[p], uZW[c], t, uZW[5]);
  float ax = abs(xz.x);
  float side = smoothstep(34.0, 95.0, ax);
  float m = fbm(xz * 0.011);
  float rid = 1.0 - abs(noise(xz * 0.018) * 2.0 - 1.0);
  float h = side * (m * 1.3 + rid * 0.6) * M;
  h += (noise(xz * 0.06) - 0.5) * R * 3.0 - 3.0;
  h += R * 1.6 * sin(xz.x * 0.045 + xz.y * 0.021 + noise(xz * 0.01) * 6.0);
  return h + G;
}
`;
// JS mirror of the terrain (for placing decor on the ground)
function hashJ(x, y) { x = fract(x * 123.34); y = fract(y * 456.21); const d = x * (x + 45.32) + y * (y + 45.32); x += d; y += d; return fract(x * y); }
function noiseJ(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hashJ(ix, iy), hashJ(ix + 1, iy), ux), lerp(hashJ(ix, iy + 1), hashJ(ix + 1, iy + 1), ux), uy);
}
function fbmJ(x, y) { let v = 0, a = 0.5; for (let i = 0; i < 4; i++) { v += a * noiseJ(x, y); x = x * 2.03 + 17.1; y = y * 2.03 + 9.7; a *= 0.5; } return v; }
function zoneIdxJ(z) {
  const fz = Math.max(-z, 0) / ZL, zi = Math.floor(fz), f = fz - zi; let t = smooth(0, 0.1, f), c, p;
  if (U.uCycle.value > 0.5) { c = zi % 5; p = (zi + 4) % 5; } else { c = Math.min(zi, 4); p = clamp(zi - 1, 0, 4); if (zi > 4.5) t = 1; }
  if (zi < 0.5) t = 1;
  return [p, c, t];
}
function terrainJ(x, z) {
  const [p, c, t] = zoneIdxJ(z), e = U.uEnd.value, zf = (arr) => lerp(lerp(arr[p], arr[c], t), arr[5], e);
  const M = zf(U.uZM.value), R = zf(U.uZR.value), G = zf(U.uZG.value), W = zf(U.uZW.value);
  const side = smooth(34, 95, Math.abs(x));
  let h = side * (fbmJ(x * 0.011, z * 0.011) * 1.3 + (1 - Math.abs(noiseJ(x * 0.018, z * 0.018) * 2 - 1)) * 0.6) * M;
  h += (noiseJ(x * 0.06, z * 0.06) - 0.5) * R * 3 - 3;
  h += R * 1.6 * Math.sin(x * 0.045 + z * 0.021 + noiseJ(x * 0.01, z * 0.01) * 6);
  return Math.max(h + G, W);
}

// ---------------------------------------------------------------------
//  Materials
// ---------------------------------------------------------------------
function glowMat(pattern, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { ...U, uTint: { value: new Color(opts.tint ?? 0xffffff) }, uRimK: { value: opts.rimK ?? 1.6 } },
    defines: { PATTERN: pattern, ...(opts.bands ? { BANDS: 1 } : {}) },
    vertexShader: `
      varying vec3 vN; varying vec3 vW;
      void main(){
        vec4 lp = vec4(position, 1.0); mat3 m = mat3(modelMatrix);
        #ifdef USE_INSTANCING
          lp = instanceMatrix * lp; m = m * mat3(instanceMatrix);
        #endif
        vec4 w = modelMatrix * lp;
        vN = normalize(transpose(inverse(m)) * normal); vW = w.xyz;   // proper normal matrix (non-uniform scale)
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec3 uBase, uRim, uGrid, uPlayer, uPlayerCol, uTint; uniform float uTime, uRimK;
      varying vec3 vN; varying vec3 vW;
      ${GLSL_NOISE}${GLSL_FOG}
      void main(){
        vec3 N = normalize(vN); vec3 V = normalize(cameraPosition - vW);
        float fr = pow(1.0 - abs(dot(N, V)), 2.5);
        vec3 rim = uRim * uTint;
        vec3 col = uBase * (0.8 + 0.4 * N.y);
        col += rim * fr * uRimK;
        #if PATTERN == 1
          float side = 1.0 - abs(N.y);
          vec2 wp = vec2(vW.x + vW.z, vW.y) * vec2(0.55, 0.42);
          vec2 cell = floor(wp); vec2 f = fract(wp);
          float win = step(0.22, f.x) * step(f.x, 0.78) * step(0.28, f.y) * step(f.y, 0.72);
          float lit = step(0.64, hash(cell + 3.1));
          col += rim * win * lit * side * (0.7 + 0.3 * sin(uTime * 0.7 + cell.x));
        #elif PATTERN == 2
          float n = fbm(vec2(vW.y * 0.09 + vW.x * 0.04, vW.z * 0.05 + vW.x * 0.03) * 2.0);
          float vein = smoothstep(0.025, 0.0, abs(n - 0.5));
          col += rim * vein * (0.7 + 0.5 * sin(uTime * 2.0 + vW.y * 0.15));
        #elif PATTERN == 3
          col += rim * (0.05 + 0.5 * pow(fr, 0.8)) * 0.8;
          float facet = abs(dot(N, normalize(vec3(0.3, 1.0, 0.2))));
          col += uGrid * pow(facet, 10.0) * 0.9;
        #elif PATTERN == 4
          float n = fbm(vW.xy * 0.12 + vec2(vW.z * 0.05, uTime * 0.3));
          col = vec3(0.004, 0.0, 0.01) + rim * fr * uRimK * 1.3 + rim * smoothstep(0.62, 0.78, n) * 0.6;
        #endif
        #ifdef BANDS
          col += rim * smoothstep(0.94, 1.0, fract(vW.y * 0.08 - uTime * 0.35)) * 0.7 * (1.0 - abs(N.y));
        #endif
        vec3 L = uPlayer - vW; float dl = length(L);
        col += uPlayerCol * max(dot(N, L / dl), 0.0) * (4.0 / (1.0 + dl * dl * 0.05));
        col = applyFog(col, length(vW - cameraPosition));
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}
const M = {
  plain: glowMat(0, { bands: true }),
  windows: glowMat(1, { rimK: 1.2 }),
  veins: glowMat(2),
  crystal: glowMat(3, { rimK: 1.4 }),
  shadow: glowMat(4, { rimK: 1.3 }),
  canopy: glowMat(0, { rimK: 1.0, tint: 0x9fffd0 }),
};
function addMat(color, opacity = 1, extra = {}) {
  return new THREE.MeshBasicMaterial({ color: new Color().setRGB(...color), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, ...extra });
}
function glowTexture(stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const TEX_GLOW = glowTexture([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]);
function glowSprite(rgb, scale, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX_GLOW, color: new Color().setRGB(...rgb), transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(scale); return s;
}

// shared geometries
const G = {
  cyl: new THREE.CylinderGeometry(1, 1, 1, 14, 1),
  cone: new THREE.ConeGeometry(1, 1, 12, 1),
  pyr: new THREE.ConeGeometry(1, 1, 4, 1),
  box: new THREE.BoxGeometry(1, 1, 1),
  ico: new THREE.IcosahedronGeometry(1, 1),
  sph: new THREE.SphereGeometry(1, 24, 16),
  oct: new THREE.OctahedronGeometry(1, 0),
  stoneRing: new THREE.TorusGeometry(1, 0.14, 10, 40),
  hexRing: new THREE.TorusGeometry(1, 0.1, 4, 6),
  ring: new THREE.TorusGeometry(3.2, 0.2, 10, 48),
  gate: new THREE.TorusGeometry(40, 0.7, 8, 96),
  plane: new THREE.PlaneGeometry(1, 1),
};

// ---------------------------------------------------------------------
//  Sky, terrain, clouds
// ---------------------------------------------------------------------
const sky = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), new THREE.ShaderMaterial({
  uniforms: U, side: THREE.BackSide, depthWrite: false, depthTest: false,
  vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform vec3 uSkyTop, uFog, uGlow, uSun, uSunDir, uGrid; uniform float uStars, uAurora, uEclipse, uSunI, uTime;
    varying vec3 vDir;
    ${GLSL_NOISE}
    float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
    void main(){
      vec3 d = normalize(vDir); float h = d.y;
      vec3 col = mix(uFog, uSkyTop, smoothstep(-0.02, 0.5, h));
      float s = max(dot(d, uSunDir), 0.0);
      col += uGlow * (pow(s, 6.0) * 0.55 + pow(s, 60.0) * 0.9) * uSunI;
      float disc = smoothstep(0.9986, 0.9991, s);
      vec3 lit = col + uSun * disc * 6.0 * uSunI;
      float corona = smoothstep(0.9965, 0.9989, s) * (1.0 - disc);
      vec3 ecl = col * (1.0 - disc) + (uGlow * 5.0 + uSun * 2.5) * corona * (0.8 + 0.2 * sin(uTime * 3.0 + atan(d.x, d.y) * 12.0));
      col = mix(lit, ecl, uEclipse);
      if (uStars > 0.0) {
        vec3 p = d * 230.0; vec3 c = floor(p); vec3 f = fract(p) - 0.5;
        float r = hash3(c);
        if (r > 0.972) {
          float tw = 0.55 + 0.45 * sin(uTime * (2.0 + r * 4.0) + r * 100.0);
          col += vec3(1.0, 0.94, 0.88) * smoothstep(0.2, 0.0, length(f)) * tw * uStars * smoothstep(0.0, 0.3, h) * 2.2;
        }
      }
      if (uAurora > 0.0) {
        float az = atan(d.x, -d.z);
        float band = smoothstep(0.08, 0.3, h) * smoothstep(0.8, 0.35, h);
        float n = fbm(vec2(az * 3.0 + uTime * 0.03, h * 2.5 - uTime * 0.02));
        float streak = 0.55 + 0.45 * noise(vec2(az * 60.0, uTime * 0.3));
        col += uGrid * smoothstep(0.45, 0.8, n) * streak * band * uAurora * 0.9;
      }
      gl_FragColor = vec4(col, 1.0);
    }`,
}));
sky.renderOrder = -10; sky.frustumCulled = false;
scene.add(sky);

const TER_W = 900, TER_L = 1296;
const terrainGeo = new THREE.PlaneGeometry(TER_W, TER_L, 150, 216); terrainGeo.rotateX(-Math.PI / 2);
const terrain = new THREE.Mesh(terrainGeo, new THREE.ShaderMaterial({
  uniforms: U,
  vertexShader: `
    varying vec3 vW; varying float vH; varying float vWet;
    ${GLSL_NOISE}${GLSL_ZONE}${GLSL_HEIGHT}
    void main(){
      vec4 w = modelMatrix * vec4(position, 1.0);
      float W; float h = terrainH(w.xz, W);
      vWet = h < W ? 1.0 : 0.0;
      w.y = max(h, W); vH = h + 3.0; vW = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: `
    uniform vec3 uGrid, uBase, uRim, uGlow, uPlayer, uPlayerCol; uniform float uTime;
    varying vec3 vW; varying float vH; varying float vWet;
    ${GLSL_NOISE}${GLSL_FOG}
    void main(){
      float d = length(vW - cameraPosition);
      vec2 gp = vW.xz / 6.0; vec2 gw = fwidth(gp);
      vec2 g = abs(fract(gp - 0.5) - 0.5) / max(gw, vec2(1e-4));
      float line = 1.0 - min(min(g.x, g.y), 1.0);
      float fade = exp(-d * 0.0035);
      vec3 col = uBase * (0.6 + 0.02 * clamp(vH, 0.0, 60.0));
      col += uGrid * line * (0.25 + 1.1 * fade) * (1.0 - smoothstep(0.3, 1.0, max(gw.x, gw.y)));
      col += uRim * smoothstep(20.0, 75.0, vH) * 0.28;
      float pulse = smoothstep(0.965, 1.0, fract(vW.z * 0.004 + uTime * 0.3)) * (1.0 - smoothstep(30.0, 60.0, abs(vW.x)));
      col += uGrid * pulse * 0.7 * fade;
      float pd = length(vW - uPlayer);
      col += uPlayerCol * (0.5 / (1.0 + pd * pd * 0.02));
      if (vWet > 0.5) {
        vec3 wc = uBase * 0.35 + uGlow * 0.08;
        float sp = noise(vW.xz * vec2(0.08, 0.3) + vec2(0.0, uTime * 1.2)) * noise(vW.xz * 0.05 - uTime * 0.15);
        wc += uRim * smoothstep(0.5, 0.78, sp) * 0.9 * fade;
        wc += uGrid * line * 0.2 * fade;
        wc += uPlayerCol * (0.9 / (1.0 + pd * pd * 0.01));
        col = wc;
      }
      col = applyFog(col, d);
      gl_FragColor = vec4(col, 1.0);
    }`,
}));
terrain.frustumCulled = false;
scene.add(terrain);

const clouds = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1500, 1, 1).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
  uniforms: U, transparent: true, depthWrite: false,
  vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `
    uniform vec3 uGlow, uRim, uSkyTop; uniform float uTime;
    varying vec3 vW;
    ${GLSL_NOISE}${GLSL_FOG}${GLSL_ZONE}
    void main(){
      int p, c; float t; zoneIdx(vW.z, p, c, t);
      float C = zoneF(uZC[p], uZC[c], t, uZC[5]);
      if (C < 0.01) discard;
      vec2 q = vW.xz * 0.0055 + vec2(uTime * 0.012, uTime * 0.03);
      float n = fbm(q) + 0.5 * fbm(q * 3.1 - uTime * 0.04);
      float a = smoothstep(0.5, 1.0, n) * C;
      vec3 col = mix(uFog * 1.1 + uGlow * 0.3, vec3(1.0, 0.92, 1.0) * 1.1, smoothstep(0.75, 1.2, n));
      col += uRim * pow(max(0.0, n - 0.85), 2.0) * 3.0;
      col = applyFog(col, length(vW - cameraPosition) * 0.75);
      gl_FragColor = vec4(col, a);
    }`,
}));
clouds.frustumCulled = false;
scene.add(clouds);

// ---------------------------------------------------------------------
//  Particles: ambient motes, speed lines, bursts
// ---------------------------------------------------------------------
const PU = { uScale: { value: 400 } };
const MOTES = 1400, MBOX = 180;
const motes = (() => {
  const g = new THREE.BufferGeometry(), p = new Float32Array(MOTES * 3), s = new Float32Array(MOTES);
  for (let i = 0; i < MOTES; i++) { p[i * 3] = Math.random() * MBOX; p[i * 3 + 1] = Math.random() * MBOX; p[i * 3 + 2] = Math.random() * MBOX; s[i] = rand(0.5, 1.6); }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1));
  const m = new THREE.Points(g, new THREE.ShaderMaterial({
    uniforms: { ...U, ...PU, uCam: { value: new V3() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform vec3 uCam; uniform float uScale, uTime; attribute float aS; varying float vA;
      void main(){
        vec3 p = mod(position - uCam + vec3(0.0, 0.0, ${MBOX * 0.25}.0), ${MBOX}.0) - vec3(${MBOX / 2}.0, ${MBOX / 2}.0, ${MBOX * 0.75}.0);
        p.y += sin(uTime * 0.7 + aS * 30.0) * 0.8;
        vec4 mv = viewMatrix * vec4(uCam + p, 1.0);
        vA = smoothstep(${MBOX / 2}.0, 20.0, length(p)) * (0.5 + 0.5 * sin(uTime * 2.0 + aS * 50.0));
        gl_PointSize = aS * uScale * 0.06 / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uPart; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(uPart * 1.6, a); }`,
  }));
  m.frustumCulled = false; scene.add(m); return m;
})();

const LINES = 220;
const speedLines = (() => {
  const g = new THREE.BufferGeometry(), p = new Float32Array(LINES * 6), a = new Float32Array(LINES * 2);
  for (let i = 0; i < LINES; i++) {
    const ang = Math.random() * Math.PI * 2, r = rand(6, 26), x = Math.cos(ang) * r, y = Math.sin(ang) * r * 0.7, z = rand(0, 200);
    p.set([x, y, z, x, y, z], i * 6); a[i * 2] = 0; a[i * 2 + 1] = 1;
  }
  g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('aT', new THREE.BufferAttribute(a, 1));
  const m = new THREE.LineSegments(g, new THREE.ShaderMaterial({
    uniforms: { uCam: { value: new V3() }, uLen: { value: 10 }, uOp: { value: 0 }, uTravel: { value: 0 }, uCol: { value: new Color(1, 0.9, 0.7) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform vec3 uCam; uniform float uLen, uTravel; attribute float aT; varying float vA;
      void main(){
        vec3 p = position; p.z = mod(p.z + uTravel, 200.0) - 190.0; p.z += aT * uLen;
        vA = (1.0 - aT) * smoothstep(-190.0, -120.0, p.z) * smoothstep(12.0, 0.0, p.z);
        gl_Position = projectionMatrix * viewMatrix * vec4(uCam + p, 1.0);
      }`,
    fragmentShader: `uniform float uOp; uniform vec3 uCol; varying float vA; void main(){ gl_FragColor = vec4(uCol * 2.0, vA * uOp); }`,
  }));
  m.frustumCulled = false; scene.add(m); return m;
})();

class Burst {
  constructor(max) {
    this.max = max; this.n = 0; this.ps = [];
    const g = this.g = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3); this.col = new Float32Array(max * 3); this.sa = new Float32Array(max * 2);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSA', new THREE.BufferAttribute(this.sa, 2).setUsage(THREE.DynamicDrawUsage));
    this.mesh = new THREE.Points(g, new THREE.ShaderMaterial({
      uniforms: PU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      vertexShader: `uniform float uScale; attribute vec2 aSA; varying vec3 vC; varying float vA;
        void main(){ vC = color; vA = aSA.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSA.x * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vC, smoothstep(0.5, 0.0, d) * vA); }`,
    }));
    this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  emit(p, count, col, speed, size = 0.5, life = 0.8, opt = {}) {
    for (let i = 0; i < count; i++) {
      if (this.ps.length >= this.max) this.ps.shift();
      let dx = rand(-1, 1), dy = rand(-1, 1), dz = rand(-1, 1); const l = Math.hypot(dx, dy, dz) || 1;
      const sp = speed * rand(0.35, 1);
      this.ps.push({ x: p.x, y: p.y, z: p.z, vx: dx / l * sp + (opt.vx || 0), vy: dy / l * sp + (opt.vy || 0), vz: dz / l * sp + (opt.vz || 0),
        life: life * rand(0.6, 1.2), max: 0, r: col.r, g: col.g, b: col.b, s: size * rand(0.6, 1.4), drag: opt.drag ?? 2.2 });
      this.ps[this.ps.length - 1].max = this.ps[this.ps.length - 1].life;
    }
  }
  update(dt) {
    const ps = this.ps; let w = 0;
    for (let i = 0; i < ps.length; i++) {
      const q = ps[i]; q.life -= dt; if (q.life <= 0) continue;
      const k = Math.exp(-q.drag * dt); q.vx *= k; q.vy *= k; q.vz *= k;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      ps[w++] = q;
    }
    ps.length = w;
    for (let i = 0; i < w; i++) {
      const q = ps[i], t = q.life / q.max;
      this.pos[i * 3] = q.x; this.pos[i * 3 + 1] = q.y; this.pos[i * 3 + 2] = q.z;
      this.col[i * 3] = q.r; this.col[i * 3 + 1] = q.g; this.col[i * 3 + 2] = q.b;
      this.sa[i * 2] = q.s; this.sa[i * 2 + 1] = t * t;
    }
    this.g.setDrawRange(0, w);
    for (const a of ['position', 'color', 'aSA']) this.g.attributes[a].needsUpdate = true;
  }
  clear() { this.ps.length = 0; this.g.setDrawRange(0, 0); }
}
const burst = new Burst(2500);
const HDR = (r, g, b) => new Color().setRGB(r, g, b);
const C_GOLD = HDR(4, 2.6, 0.9), C_WHITE = HDR(3, 3, 3), C_RED = HDR(4, 0.5, 0.3), C_CYAN = HDR(1, 3, 4), C_VIOLET = HDR(2.4, 0.8, 4);

// ---------------------------------------------------------------------
//  Trails
// ---------------------------------------------------------------------
class Trail {
  constructor(n, width, rgb, op = 1, spacing = 0.22) {
    this.n = n; this.w = width; this.sp = spacing; this.buf = new Float32Array(n * 6); this.head = 0; this.count = 0;
    const g = this.g = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 6);
    const t = new Float32Array(n * 2), s = new Float32Array(n * 2), idx = [];
    for (let i = 0; i < n; i++) { t[i * 2] = t[i * 2 + 1] = i / (n - 1); s[i * 2] = -1; s[i * 2 + 1] = 1; }
    for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aT', new THREE.BufferAttribute(t, 1)); g.setAttribute('aS', new THREE.BufferAttribute(s, 1)); g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uCol: { value: HDR(...rgb) }, uOp: { value: op } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: `attribute float aT; attribute float aS; varying float vT; varying float vS; void main(){ vT = aT; vS = aS; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uCol; uniform float uOp; varying float vT; varying float vS; void main(){ float a = pow(1.0 - vT, 1.6) * (1.0 - vS * vS) * uOp; gl_FragColor = vec4(uCol, a); }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; scene.add(this.mesh);
  }
  push(x, y, z, rx, ry, rz) {
    const b = this.buf, P6 = this.pos;
    this.head = (this.head + this.n - 1) % this.n;
    let h = this.head * 6; b[h] = x; b[h + 1] = y; b[h + 2] = z; b[h + 3] = rx; b[h + 4] = ry; b[h + 5] = rz;
    this.count = Math.min(this.count + 1, this.n);
    for (let i = 0; i < this.n; i++) {
      const j = ((this.head + Math.min(i, this.count - 1)) % this.n) * 6, w = this.w * (1 - i / this.n), o = i * 6, zz = z + i * this.sp;
      P6[o] = b[j] - b[j + 3] * w; P6[o + 1] = b[j + 1] - b[j + 4] * w; P6[o + 2] = zz - b[j + 5] * w;
      P6[o + 3] = b[j] + b[j + 3] * w; P6[o + 4] = b[j + 1] + b[j + 4] * w; P6[o + 5] = zz + b[j + 5] * w;
    }
    this.g.attributes.position.needsUpdate = true;
  }
  reset() { this.count = 0; }
}

// ---------------------------------------------------------------------
//  Player
// ---------------------------------------------------------------------
const P = {
  pos: new V3(0, 12, 0), tgt: new THREE.Vector2(0, 12), vx: 0, vy: 0, bank: 0, pitch: 0,
  speed: 60, lives: 3, glut: 0.3, boosting: false, boostAmt: 0, inv: 0, slow: 1, alive: true, right: new V3(1, 0, 0),
};
const player = new THREE.Group();
const core = new THREE.Mesh(G.ico, new THREE.MeshBasicMaterial({ color: HDR(3, 2.3, 1.3) }));
core.scale.setScalar(0.5);
const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: HDR(1.8, 1.0, 0.3), wireframe: true, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
const wingShape = new THREE.Shape(); wingShape.moveTo(0.25, 0.25); wingShape.lineTo(2.3, -0.9); wingShape.lineTo(1.3, -0.25); wingShape.lineTo(0.25, -0.75); wingShape.closePath();
const wingGeo = new THREE.ShapeGeometry(wingShape); wingGeo.rotateX(-Math.PI / 2);
const wingMat = addMat([1.6, 1.0, 0.4], 0.6, { side: THREE.DoubleSide });
const wingR = new THREE.Mesh(wingGeo, wingMat), wingL = new THREE.Mesh(wingGeo, wingMat); wingL.scale.x = -1;
const halo = glowSprite([1.1, 0.8, 0.4], 2.4), halo2 = glowSprite([0.5, 0.3, 0.12], 6.5, 0.15);
player.add(core, shell, wingR, wingL, halo, halo2);
scene.add(player);
const trailC = new Trail(30, 0.45, [1.1, 0.6, 0.2], 0.7, 0.2);
const trailL = new Trail(40, 0.06, [2, 1.5, 0.8], 1, 0.2), trailR = new Trail(40, 0.06, [2, 1.5, 0.8], 1, 0.2);

// ---------------------------------------------------------------------
//  Pools & world objects
// ---------------------------------------------------------------------
const pools = {};
function take(key, make) {
  const p = pools[key] || (pools[key] = []);
  const m = p.pop() || make(); m.visible = true; if (!m.parent) scene.add(m);
  return m;
}
function give(key, m) { m.visible = false; (pools[key] || (pools[key] = [])).push(m); }
const mesh = (geo, mat) => () => new THREE.Mesh(geo, mat);

let obs = [];      // obstacles (collide)
let rings = [];    // collectible rings
let items = [];    // hearts
let gates = [];    // zone portals (decor)
let beams = [];    // lance fx

// --- shards (instanced) ---
const SHARDS = 360;
const shardIM = new THREE.InstancedMesh(G.oct, new THREE.MeshBasicMaterial({ color: 0xffffff }), SHARDS);
shardIM.frustumCulled = false; shardIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
scene.add(shardIM);
const shards = []; const shardFree = [];
for (let i = SHARDS - 1; i >= 0; i--) shardFree.push(i);
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _v = new V3(), _v2 = new V3();
const ZERO_M = new THREE.Matrix4().makeScale(0, 0, 0), _col = new Color(), C_SHARD = new Color().setRGB(3, 3, 3);
for (let i = 0; i < SHARDS; i++) { shardIM.setMatrixAt(i, ZERO_M); shardIM.setColorAt(i, HDR(2, 3, 3.4)); }
function spawnShard(x, y, z) {
  if (!shardFree.length) return;
  const i = shardFree.pop(); shards.push({ i, x, y, z, r: Math.random() * 6 });
  shardIM.setColorAt(i, _col.copy(pal.part).multiplyScalar(2.6).lerp(C_SHARD, 0.3));
  shardIM.instanceColor.needsUpdate = true;
}
function freeShard(k) { const s = shards[k]; shardIM.setMatrixAt(s.i, ZERO_M); shardFree.push(s.i); shards[k] = shards[shards.length - 1]; shards.pop(); }

// --- decor (instanced, no collision) ---
class Decor {
  constructor(parts, n) { this.n = n; this.i = 0; this.parts = parts.map(([geo, mat]) => { const im = new THREE.InstancedMesh(geo, mat, n); im.frustumCulled = false; for (let k = 0; k < n; k++) im.setMatrixAt(k, ZERO_M); scene.add(im); return im; }); }
  place(fn) { const i = this.i; this.i = (this.i + 1) % this.n; this.parts.forEach((im, k) => { fn(k, _m4); im.setMatrixAt(i, _m4); im.instanceMatrix.needsUpdate = true; }); }
  clear() { this.parts.forEach(im => { for (let k = 0; k < this.n; k++) im.setMatrixAt(k, ZERO_M); im.instanceMatrix.needsUpdate = true; }); }
}
const decor = [
  new Decor([[G.cyl, M.veins], [G.cone, M.canopy]], 260),
  new Decor([[G.box, M.windows]], 260),
  new Decor([[G.pyr, M.veins]], 200),
  new Decor([[G.oct, M.crystal]], 200),
  new Decor([[G.cone, M.shadow]], 220),
];
function placeDecor(zi, z) {
  const side = Math.random() < 0.5 ? -1 : 1, x = side * rand(48, 230), y0 = terrainJ(x, z);
  const set = (m, px, py, pz, sx, sy, sz, ry = 0, rx = 0) => m.compose(_v.set(px, py, pz), _q.setFromEuler(_e.set(rx, ry, 0)), _s.set(sx, sy, sz));
  if (zi === 0) { const r = rand(2.5, 7), h = rand(120, 190); decor[0].place((k, m) => k === 0 ? set(m, x, y0 + h / 2 - 5, z, r, h, r) : set(m, x, y0 + h * 0.62 + rand(0, 20), z, r * 5, h * 0.35, r * 5)); }
  else if (zi === 1) { const w = rand(10, 26), d = rand(10, 26), h = rand(30, 170); decor[1].place((k, m) => set(m, x, y0 + h / 2 - 2, z, w, h, d)); }
  else if (zi === 2) { const r = rand(10, 34), h = r * rand(1.2, 2.6); decor[2].place((k, m) => set(m, x, y0 + h / 2 - 4, z, r, h, r, rand(0, 3))); }
  else if (zi === 3) { const r = rand(6, 22); decor[3].place((k, m) => set(m, x, rand(-30, 70), z, r, r * rand(1.6, 2.6), r, rand(0, 6), rand(-0.4, 0.4))); }
  else { const r = rand(4, 12), h = rand(50, 170), up = Math.random() < 0.75; decor[4].place((k, m) => up ? set(m, x, y0 + h / 2 - 5, z, r, h, r) : set(m, x, 150 - h / 2, z, r, h, r, 0, Math.PI)); }
}

// ---------------------------------------------------------------------
//  Collision shapes (signed distance)
// ---------------------------------------------------------------------
function sdShape(s, p) {
  switch (s.k) {
    case 'sph': return Math.hypot(p.x - s.c.x, p.y - s.c.y, p.z - s.c.z) - s.r;
    case 'box': {
      const qx = Math.abs(p.x - s.c.x) - s.h.x, qy = Math.abs(p.y - s.c.y) - s.h.y, qz = Math.abs(p.z - s.c.z) - s.h.z;
      return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
    }
    case 'cyl': {
      const dx = Math.hypot(p.x - s.x, p.z - s.z) - s.r, dy = Math.abs(p.y - (s.y0 + s.y1) / 2) - (s.y1 - s.y0) / 2;
      return Math.min(Math.max(dx, dy), 0) + Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
    }
    case 'cone': { // tapers from r at base to 0 at tip. inv: base on top
      const t = s.inv ? clamp((s.y1 - p.y) / (s.y1 - s.y0), 0, 1) : clamp((p.y - s.y0) / (s.y1 - s.y0), 0, 1);
      const dx = (Math.hypot(p.x - s.x, p.z - s.z) - s.r * (1 - t)) * 0.9;
      const dy = p.y > s.y1 ? p.y - s.y1 : p.y < s.y0 ? s.y0 - p.y : 0;
      return dy > 0 ? Math.hypot(Math.max(dx, 0), dy) : dx;
    }
    case 'tor': return Math.hypot(Math.hypot(p.x - s.c.x, p.y - s.c.y) - s.R, p.z - s.c.z) - s.t;
  }
  return 1e9;
}

// ---------------------------------------------------------------------
//  Path & world generation
// ---------------------------------------------------------------------
const path = { arr: [], z0: 0 };
const gen = { tx: 0, ty: 12, tc: 0, ringCd: 6, chain: 0, shardRun: 8, shardGap: 0, peaceful: false, noObsUntil: 0, lastZone: -1, heartDone: {} };
function pathAt(z) {
  const a = path.arr, f = (path.z0 - z) / SEG; let i = Math.floor(f);
  if (i < 0) return a[0];
  if (i >= a.length - 1) return a[a.length - 1];
  const t = f - i; return { x: lerp(a[i].x, a[i + 1].x, t), y: lerp(a[i].y, a[i + 1].y, t) };
}
const genZ = () => path.z0 - (path.arr.length - 1) * SEG;
function zoneOf(z) {
  const zi = Math.floor(Math.max(-z, 0) / ZL);
  return run && !run.story ? zi % 5 : Math.min(zi, 4);
}
function cycleOf(z) { return Math.floor(Math.max(-z, 0) / ZL / 5); }

function pickX(clear, px) { for (let k = 0; k < 8; k++) { const x = rand(-40, 40); if (Math.abs(x - px) > clear) return x; } return null; }
function pickXY(clear, px, py) { for (let k = 0; k < 8; k++) { const x = rand(-34, 34), y = rand(3, 31); if (Math.hypot(x - px, y - py) > clear) return [x, y]; } return null; }
function pickYBar(clear, py) { for (let k = 0; k < 8; k++) { const y = rand(5, 27); if (Math.abs(y - py) > clear) return y; } return null; }

function addOb(o) { o.minD = 1e9; o.hit = false; o.passed = false; o.active = o.active ?? true; obs.push(o); return o; }

// obstacle factories: return an obstacle or null
const FACT = {
  // ---- I Flüsterwald
  tree(z, px) {
    const r = rand(1.3, 2.7), x = pickX(r + 5.5, px); if (x === null) return null;
    const t = take('trunk', mesh(G.cyl, M.veins)); t.scale.set(r, 100, r); t.position.set(x, 40, z); t.rotation.set(0, 0, 0);
    const c = take('canopy', mesh(G.cone, M.canopy)); const h = rand(22, 34); c.scale.set(r * rand(5, 7), h, r * rand(5, 7)); c.position.set(x, MAX_Y + 12 + h / 2 + rand(0, 10), z);
    return addOb({ meshes: [['trunk', t], ['canopy', c]], shapes: [{ k: 'cyl', x, z, r, y0: -10, y1: 90 }], zMin: z - r, zMax: z + r });
  },
  log(z, px, py) {
    const y = pickYBar(8, py); if (y === null) return null;
    const m = take('log', mesh(G.box, M.veins)); m.scale.set(100, 1.8, 2.4); m.position.set(0, y, z); m.rotation.set(0, 0, 0);
    return addOb({ meshes: [['log', m]], shapes: [{ k: 'box', c: new V3(0, y, z), h: new V3(50, 0.9, 1.2) }], zMin: z - 1.2, zMax: z + 1.2 });
  },
  spore(z, px, py) {
    const r = rand(1.6, 3), p = pickXY(r + 6, px, py); if (!p) return null;
    const m = take('spore', mesh(G.ico, M.crystal)); m.scale.setScalar(r); m.position.set(p[0], p[1], z);
    const c = new V3(p[0], p[1], z), ph = Math.random() * 6;
    return addOb({ meshes: [['spore', m]], shapes: [{ k: 'sph', c, r }], zMin: z - r, zMax: z + r,
      update(dt, t) { c.y = p[1] + Math.sin(t * 1.3 + ph) * 1.2; m.position.y = c.y; m.rotation.y += dt * 0.6; m.rotation.x += dt * 0.3; } });
  },
  // ---- II Versunkene Stadt
  tower(z, px) {
    const w = rand(3, 7), d = rand(3, 7), h = rand(16, 60), x = pickX(w / 2 + 5.5, px); if (x === null) return null;
    const m = take('tower', mesh(G.box, M.windows)); m.scale.set(w, h + 12, d); m.position.set(x, (h - 12) / 2, z); m.rotation.set(0, 0, 0);
    return addOb({ meshes: [['tower', m]], shapes: [{ k: 'box', c: new V3(x, (h - 12) / 2, z), h: new V3(w / 2, (h + 12) / 2, d / 2) }], zMin: z - d / 2, zMax: z + d / 2 });
  },
  arch(z, px, py) {
    const gap = rand(11, 15), pw = 3.2, lx = px - gap / 2 - pw / 2, rx = px + gap / 2 + pw / 2, by = Math.min(py + rand(7, 10), 44), H = by + 6;
    const L = take('tower', mesh(G.box, M.windows)), R = take('tower', mesh(G.box, M.windows)), B = take('beam', mesh(G.box, M.plain));
    L.scale.set(pw, H + 12, 4); L.position.set(lx, (H - 12) / 2, z); L.rotation.set(0, 0, 0);
    R.scale.set(pw, H + 12, 4); R.position.set(rx, (H - 12) / 2, z); R.rotation.set(0, 0, 0);
    B.scale.set(gap + pw * 2, 2.6, 4); B.position.set(px, by, z); B.rotation.set(0, 0, 0);
    return addOb({ meshes: [['tower', L], ['tower', R], ['beam', B]], zMin: z - 2, zMax: z + 2,
      shapes: [{ k: 'box', c: new V3(lx, (H - 12) / 2, z), h: new V3(pw / 2, (H + 12) / 2, 2) }, { k: 'box', c: new V3(rx, (H - 12) / 2, z), h: new V3(pw / 2, (H + 12) / 2, 2) }, { k: 'box', c: new V3(px, by, z), h: new V3(gap / 2 + pw, 1.3, 2) }] });
  },
  bridge(z, px, py) {
    const y = pickYBar(8.5, py); if (y === null) return null;
    const m = take('beam', mesh(G.box, M.plain)); m.scale.set(100, 2.4, 5); m.position.set(0, y, z); m.rotation.set(0, 0, 0);
    return addOb({ meshes: [['beam', m]], shapes: [{ k: 'box', c: new V3(0, y, z), h: new V3(50, 1.2, 2.5) }], zMin: z - 2.5, zMax: z + 2.5 });
  },
  // ---- III Aschenwüste
  obelisk(z, px) {
    const r = rand(2.2, 4.2), h = rand(30, 62), x = pickX(r + 5.5, px); if (x === null) return null;
    const m = take('obelisk', mesh(G.pyr, M.veins)); m.scale.set(r, h, r); m.position.set(x, h / 2 - 4, z); m.rotation.set(0, rand(0, 3), 0);
    return addOb({ meshes: [['obelisk', m]], shapes: [{ k: 'cone', x, z, r: r * 0.8, y0: -4, y1: h - 4 }], zMin: z - r, zMax: z + r });
  },
  stonering(z, px, py) {
    const R = rand(6.8, 8.2), t = R * 0.14;
    const m = take('stonering', mesh(G.stoneRing, M.veins)); m.scale.setScalar(R); m.position.set(px, py, z); m.rotation.set(0, 0, rand(0, 3));
    return addOb({ meshes: [['stonering', m]], shapes: [{ k: 'tor', c: new V3(px, py, z), R, t }], zMin: z - t, zMax: z + t, ring: true,
      update(dt) { m.rotation.z += dt * 0.4; } });
  },
  geyser(z, px) {
    const x = pickX(9, px); if (x === null) return null;
    const col = take('geyser', () => new THREE.Mesh(G.cyl, addMat([5, 1.6, 0.3], 0)));
    const mark = take('gmark', () => { const m = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), addMat([4, 1.2, 0.2], 0)); return m; });
    const gy = terrainJ(x, z) + 0.3;
    mark.position.set(x, gy, z); mark.scale.setScalar(3.5); col.position.set(x, 30, z); col.scale.set(2.2, 0.01, 2.2);
    const per = rand(2.2, 3), ph = Math.random() * per, sh = { k: 'cyl', x, z, r: 2.2, y0: -5, y1: 70 };
    const o = addOb({ meshes: [['geyser', col], ['gmark', mark]], shapes: [sh], zMin: z - 2.2, zMax: z + 2.2, active: false,
      update(dt, t) {
        const c = ((t + ph) % per) / per, on = c > 0.62;
        mark.material.opacity = on ? 1 : 0.15 + 0.85 * smooth(0.2, 0.62, c) * (0.6 + 0.4 * Math.sin(t * 30));
        const s = on ? Math.min(1, (c - 0.62) / 0.06) : 0;
        col.scale.set(2.2 * (0.6 + 0.4 * s), Math.max(0.01, 80 * s), 2.2 * (0.6 + 0.4 * s)); col.position.y = gy + 40 * s;
        col.material.opacity = on ? 0.85 : 0; o.active = on && s > 0.5;
      } });
    return o;
  },
  // ---- IV Gläserner Himmel
  crystal(z, px, py) {
    const r = rand(2, 4.8), p = pickXY(r * 1.3 + 6, px, py); if (!p) return null;
    const m = take('crystal', mesh(G.oct, M.crystal)); m.scale.set(r, r * 1.8, r); m.position.set(p[0], p[1], z); m.rotation.set(rand(0, 1), rand(0, 3), rand(-0.3, 0.3));
    const sp = rand(-0.8, 0.8);
    return addOb({ meshes: [['crystal', m]], shapes: [{ k: 'sph', c: new V3(p[0], p[1], z), r: r * 1.05 }], zMin: z - r, zMax: z + r, update(dt) { m.rotation.y += dt * sp; } });
  },
  glassgate(z, px, py) {
    const R = rand(7, 9), t = R * 0.1;
    const m = take('hexring', mesh(G.hexRing, M.crystal)); m.scale.setScalar(R); m.position.set(px, py, z); m.rotation.set(0, 0, rand(0, 3));
    const sp = rand(0.5, 1.2) * (Math.random() < 0.5 ? -1 : 1);
    return addOb({ meshes: [['hexring', m]], shapes: [{ k: 'tor', c: new V3(px, py, z), R: R * 0.93, t: t * 1.3 }], zMin: z - t, zMax: z + t, ring: true, update(dt) { m.rotation.z += dt * sp; } });
  },
  cluster(z, px, py) {
    const p = pickXY(15, px, py); if (!p) return null;
    const meshes = [], shapes = [];
    for (let i = 0; i < randi(4, 6); i++) {
      const r = rand(1, 2), x = p[0] + rand(-6, 6), y = clamp(p[1] + rand(-6, 6), 2, 34), zz = z + rand(-5, 5);
      if (Math.hypot(x - px, y - py) < r + 5) continue;
      const m = take('crystal', mesh(G.oct, M.crystal)); m.scale.set(r, r * 2, r); m.position.set(x, y, zz); m.rotation.set(rand(0, 3), rand(0, 3), 0);
      meshes.push(['crystal', m]); shapes.push({ k: 'sph', c: new V3(x, y, zz), r: r * 1.1 });
    }
    if (!meshes.length) return null;
    return addOb({ meshes, shapes, zMin: z - 7, zMax: z + 7 });
  },
  // ---- V Herz der Nacht
  void(z, px, py) {
    const r = rand(2, 3.4), A = rand(3, 9), p = pickXY(r + A + 5.5, px, py); if (!p) return null;
    const m = take('void', mesh(G.sph, M.shadow)); m.scale.setScalar(r);
    const c = new V3(p[0], p[1], z), ph = Math.random() * 6, f = rand(0.6, 1.2);
    m.position.copy(c);
    return addOb({ meshes: [['void', m]], shapes: [{ k: 'sph', c, r }], zMin: z - r, zMax: z + r,
      update(dt, t) { c.x = p[0] + Math.sin(t * f + ph) * A; m.position.x = c.x; } });
  },
  spike(z, px) {
    const r = rand(2, 4), h = rand(22, 46), x = pickX(r + 5.5, px); if (x === null) return null;
    const up = Math.random() < 0.6;
    const m = take('spike', mesh(G.cone, M.shadow)); m.scale.set(r, h, r);
    if (up) { m.position.set(x, h / 2 - 5, z); m.rotation.set(0, 0, 0); }
    else { m.position.set(x, 40 - h / 2, z); m.rotation.set(Math.PI, 0, 0); }
    return addOb({ meshes: [['spike', m]], shapes: [up ? { k: 'cone', x, z, r, y0: -5, y1: h - 5 } : { k: 'cone', x, z, r, y0: 40 - h, y1: 40, inv: true }], zMin: z - r, zMax: z + r });
  },
};
const ZONE_OBS = [
  [['tree', 6], ['log', 1.2], ['spore', 2.2]],
  [['tower', 6], ['arch', 1.1], ['bridge', 1]],
  [['obelisk', 4], ['stonering', 1.2], ['geyser', 2]],
  [['crystal', 5], ['glassgate', 1.3], ['cluster', 1.6]],
  [['void', 3], ['spike', 5], ['log', 0.4]],
];
function weighted(list) { let s = 0; for (const [, w] of list) s += w; let r = Math.random() * s; for (const [k, w] of list) { if ((r -= w) <= 0) return k; } return list[0][0]; }

function genSegment() {
  const last = path.arr[path.arr.length - 1];
  if (--gen.tc <= 0) { gen.tx = rand(-22, 22); gen.ty = rand(6, 24); gen.tc = randi(4, 10); }
  const x = lerp(last.x, gen.tx, 0.12), y = lerp(last.y, gen.ty, 0.12);
  path.arr.push({ x, y });
  const z = genZ();
  const zi = zoneOf(z), cyc = cycleOf(z), zStart = -Math.floor(Math.max(-z, 0) / ZL) * ZL, into = zStart - z, prog = into / ZL;
  const story = !run || run.story;

  // zone portal
  if (gen.lastZone !== -1 && Math.floor(-z / ZL) !== gen.lastZone && z < -1) spawnGate(zStart, zi);
  gen.lastZone = Math.floor(Math.max(-z, 0) / ZL);

  // decor
  const dn = [3, 3, 1.6, 1.6, 2.2][zi];
  for (let k = 0; k < dn; k++) if (k < Math.floor(dn) || Math.random() < dn % 1) placeDecor(zi, z + rand(-6, 6));

  const bossZone = story && zi === 4 && into > BOSS_AT - 150 && !gen.peaceful;
  // obstacles
  if (!gen.peaceful && !bossZone && z < gen.noObsUntil && into > (zi === 4 ? 520 : 260)) {
    const ramp = 0.45 + 0.55 * clamp(prog / 0.8, 0, 1);
    const d = ZONES[zi].density * ramp * (1 + 0.12 * cyc) * (menuMode() ? 0.8 : 1);
    const n = Math.floor(d) + (Math.random() < d % 1 ? 1 : 0);
    for (let k = 0; k < n; k++) {
      let type = weighted(ZONE_OBS[zi]);
      if ((type === 'log' || type === 'bridge') && prog < 0.2) type = ZONE_OBS[zi][0][0];
      FACT[type](z + rand(-4, 4), x, y);
    }
  }
  // rings
  if (!bossZone) {
    if (gen.chain > 0) { if (gen.chain % 2 === 0) spawnRing(x, y, z, false); gen.chain--; }
    else if (--gen.ringCd <= 0) {
      if (Math.random() < 0.4) gen.chain = 8; else spawnRing(x, y, z, false);
      gen.ringCd = randi(5, 9);
    }
  }
  // shards
  if (gen.shardRun > 0) {
    gen.shardRun--;
    for (let k = 0; k < 2; k++) {
      const zz = z + k * SEG / 2, a = zz * 0.09;
      if (gen.chain > 0) spawnShard(x + Math.cos(a) * 2.2, y + Math.sin(a) * 2.2, zz);
      else spawnShard(x + Math.sin(zz * 0.04) * 1.6, y, zz);
    }
    if (gen.shardRun === 0) gen.shardGap = randi(2, 6);
  } else if (--gen.shardGap <= 0) gen.shardRun = randi(8, 16);
  // heart
  const hk = Math.floor(-z / ZL);
  if (!gen.peaceful && prog > 0.5 && !gen.heartDone[hk] && !bossZone) { gen.heartDone[hk] = true; spawnHeart(x, y, z); }
}

function spawnRing(x, y, z, gold) {
  const key = gold ? 'gring' : 'ring';
  const g = take(key, () => {
    const grp = new THREE.Group();
    const t = new THREE.Mesh(G.ring, addMat(gold ? [4, 3.4, 2] : [3, 1.8, 0.5], 1));
    const disc = new THREE.Mesh(G.plane, new THREE.MeshBasicMaterial({ map: TEX_GLOW, color: gold ? HDR(0.9, 0.7, 0.4) : HDR(0.5, 0.3, 0.1), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    disc.scale.setScalar(gold ? 9 : 7);
    grp.add(t, disc); if (gold) { const s = glowSprite([1.6, 1.2, 0.6], 14, 0.6); grp.add(s); }
    return grp;
  });
  g.position.set(x, y, z); g.scale.setScalar(gold ? 1.25 : 1); g.rotation.set(0, 0, 0);
  g.children[0].material.opacity = 1; g.children[1].material.opacity = 0.5;
  rings.push({ g, key, x, y, z, gold, done: false, anim: -1 });
}
function spawnHeart(x, y, z) {
  const g = take('heart', () => { const grp = new THREE.Group(); const c = new THREE.Mesh(G.ico, new THREE.MeshBasicMaterial({ color: HDR(5, 1.2, 0.8) })); c.scale.setScalar(0.8); grp.add(c, glowSprite([3, 0.8, 0.5], 7)); return grp; });
  g.position.set(x, y, z);
  items.push({ g, x, y, z });
}
function spawnGate(z, zi) {
  const col = PALS[zi].rim.clone().multiplyScalar(3);
  const g = take('gate', () => { const grp = new THREE.Group(); grp.add(new THREE.Mesh(G.gate, addMat([1, 1, 1], 0.9)), new THREE.Mesh(new THREE.TorusGeometry(44, 0.3, 6, 6), addMat([1, 1, 1], 0.7))); return grp; });
  g.children[0].material.color.copy(col); g.children[1].material.color.copy(col);
  g.position.set(0, 18, z); gates.push({ g, z });
}

// ---------------------------------------------------------------------
//  Boss – Umbra
// ---------------------------------------------------------------------
const boss = { on: false, state: 'off', hp: 12, max: 12, phase: 1, t: 0, atk: 3, ringT: 3, dist: 700, x: 0, y: -80, hit: 0, crack: 0, lastWall: -9 };
const bossU = { ...U, uHit: { value: 0 }, uCrack: { value: 0 }, uOpen: { value: 1 } };
const bossGroup = new THREE.Group(); bossGroup.visible = false; scene.add(bossGroup);
const bossBody = new THREE.Mesh(new THREE.SphereGeometry(40, 72, 48), new THREE.ShaderMaterial({
  uniforms: bossU,
  vertexShader: `uniform float uTime; varying vec3 vN; varying vec3 vW; varying vec3 vP;
    void main(){ vP = normalize(position); vec3 p = position * (1.0 + 0.03 * sin(vP.y * 9.0 + uTime * 2.0) * sin(vP.x * 7.0 - uTime * 1.3));
      vec4 w = modelMatrix * vec4(p, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: `uniform vec3 uRim; uniform float uHit, uCrack, uTime; varying vec3 vN; varying vec3 vW; varying vec3 vP;
    ${GLSL_NOISE}
    void main(){
      vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
      float fr = pow(1.0 - max(dot(N, V), 0.0), 2.0);
      float n = fbm(vP.xy * 2.6 + vec2(uTime * 0.2, -uTime * 0.15)) + fbm(vP.yz * 2.0 - uTime * 0.1) * 0.5;
      vec3 col = vec3(0.006, 0.0, 0.012) + uRim * fr * 2.4 + uRim * smoothstep(0.92, 1.08, n) * 0.9;
      float cr = smoothstep(0.035, 0.0, abs(fbm(vP.xz * 4.0 + vP.y * 2.0) - 0.5)) * uCrack;
      col += vec3(5.0, 3.2, 1.2) * cr * (0.8 + 0.2 * sin(uTime * 20.0));
      col += vec3(3.0, 2.5, 3.2) * uHit * (0.25 + fr);
      gl_FragColor = vec4(col, 1.0);
    }`,
}));
const eye = new THREE.Group(); eye.position.set(0, 0, 28);
const eyeBall = new THREE.Mesh(new THREE.SphereGeometry(15, 48, 32), new THREE.ShaderMaterial({
  uniforms: bossU,
  vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform float uTime, uHit, uOpen, uCrack; varying vec3 vP; ${GLSL_NOISE}
    void main(){
      vec3 col = vec3(0.02, 0.0, 0.04);
      if (vP.z > 0.0) {
        vec2 uv = vP.xy; float r = length(uv); float ang = atan(uv.y, uv.x);
        float streak = 0.5 + 0.5 * sin(ang * 38.0 + noise(vec2(ang * 5.0, r * 7.0 + uTime)) * 5.0);
        vec3 irisC = mix(vec3(3.2, 0.5, 2.6), vec3(5.0, 3.4, 1.2), uCrack);
        float iris = smoothstep(0.8, 0.74, r);
        col = mix(vec3(0.05, 0.0, 0.08), irisC * (0.35 + 1.2 * streak * smoothstep(0.1, 0.75, r)), iris);
        col += irisC * smoothstep(0.92, 0.8, r) * smoothstep(0.7, 0.8, r) * 1.6;
        float pw = 0.08 * (1.0 + uHit * 1.2) * (1.0 - uv.y * uv.y);
        col = mix(col, vec3(0.0), step(abs(uv.x), pw) * step(r, 0.74));
        col = mix(col, vec3(0.015, 0.0, 0.03), step(uOpen * 0.98, abs(uv.y)));
      }
      col += vec3(3.0) * uHit * 0.35;
      gl_FragColor = vec4(col, 1.0);
    }`,
}));
eye.add(eyeBall);
const crown = new THREE.Group();
for (let i = 0; i < 14; i++) {
  const a = i / 14 * Math.PI * 2, dir = new V3(Math.cos(a), Math.sin(a), rand(-0.5, 0.2)).normalize();
  const s = new THREE.Mesh(G.cone, M.shadow); const len = rand(18, 40); s.scale.set(4, len, 4);
  s.position.copy(dir).multiplyScalar(38 + len / 2 - 6); s.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir); crown.add(s);
}
const orbiters = [];
for (let i = 0; i < 6; i++) { const o = new THREE.Mesh(G.oct, M.shadow); o.scale.set(4, 8, 4); orbiters.push(o); bossGroup.add(o); }
const bossHalo = glowSprite([1.4, 0.3, 2.4], 320, 0.55);
bossGroup.add(bossBody, eye, crown, bossHalo);

function startBoss() {
  boss.on = true; boss.state = 'enter'; boss.t = 0; boss.hp = boss.max; boss.phase = 1; boss.dist = 900; boss.y = -120; boss.atk = 2; boss.ringT = 2.5; boss.crack = 0;
  bossGroup.visible = true; bossGroup.scale.setScalar(1.35);
  $('#bossBar').classList.remove('hidden'); updateBossBar();
  A.roar(); shake(1.2); flash(HDR(0.4, 0, 0.6), 0.5);
  A.setMusic({ bpm: 136, prog: [[48, 0], [49, 1], [48, 0], [46, 1]], inten: 3 });
  caption('umbra', 'Endlich. Das letzte Licht der Welt kommt ganz von allein zu mir.', 4.5);
  later(3.5, () => mode === 'play' && hint('Flieg durch die <b>weißgoldenen Ringe</b> – jeder feuert eine Sonnenlanze auf Umbra!', 5));
}
function updateBossBar() { $('#bossFill').style.width = (boss.hp / boss.max * 100) + '%'; }
function bossAttack() {
  const ph = boss.phase, list = ph === 1 ? ['orbs', 'wall', 'orbs'] : ph === 2 ? ['orbs', 'wall', 'blade', 'orbs'] : ['spiral', 'wall', 'blade', 'orbs', 'blade2'];
  const a = pick(list), bz = P.pos.z - 205;
  if (a === 'orbs') { const n = 3 + ph; for (let i = 0; i < n; i++) later(i * 0.26, () => boss.on && boss.state === 'fight' && spawnOrb(P.pos.x + rand(-5, 5) * (i ? 1 : 0), P.pos.y + rand(-4, 4) * (i ? 1 : 0), 40 + ph * 8)); boss.atk = 2.6 - ph * 0.3; }
  else if (a === 'spiral') { for (let i = 0; i < 12; i++) later(i * 0.12, () => { if (!boss.on || boss.state !== 'fight') return; const ang = i * 0.95, r = 2 + i * 1.1; spawnOrb(P.pos.x + Math.cos(ang) * r, P.pos.y + Math.sin(ang) * r, 55); }); boss.atk = 3.2; }
  else if (a === 'wall') { spawnWall(bz, ph); boss.atk = 3.4 - ph * 0.3; boss.ringT = Math.max(boss.ringT, 2.2); }
  else if (a === 'blade') { spawnBlade(bz, false); boss.atk = 3; }
  else if (a === 'blade2') { spawnBlade(bz, true); spawnBlade(bz - 40, false); boss.atk = 3.4; }
  A.bossShot();
}
function spawnOrb(tx, ty, rel) {
  const m = take('orb', () => { const g = new THREE.Group(); const b = new THREE.Mesh(G.sph, M.shadow); b.scale.setScalar(1.9); g.add(b, glowSprite([2, 0.4, 3.2], 9, 0.9)); return g; });
  const sx = boss.x + rand(-6, 6), sy = boss.y + rand(-6, 6), sz = P.pos.z - boss.dist + 42;
  const c = new V3(sx, sy, sz), th = Math.max(0.6, (P.pos.z - sz) / (P.speed + rel));
  const vx = (clamp(tx, -HALF_W, HALF_W) - sx) / th, vy = (clamp(ty, MIN_Y, MAX_Y) - sy) / th;
  m.position.copy(c);
  const o = addOb({ meshes: [['orb', m]], shapes: [{ k: 'sph', c, r: 1.9 }], zMin: sz - 2, zMax: sz + 2, boss: true,
    update(dt) { c.x += vx * dt; c.y += vy * dt; c.z += rel * dt; m.position.copy(c); o.zMin = c.z - 2; o.zMax = c.z + 2; } });
}
function spawnWall(z, ph) {
  const gc = randi(1, 7), gr = randi(0, 2), meshes = [], shapes = [];
  for (let c = 0; c < 9; c++) for (let r = 0; r < 4; r++) {
    if ((c === gc || c === gc + 1) && (r === gr || r === gr + 1)) continue;
    const x = -32 + c * 8, y = 4 + r * 8;
    const m = take('wcube', mesh(G.box, M.shadow)); m.position.set(x, y, z); m.scale.setScalar(0.01); m.rotation.set(0, 0, 0);
    meshes.push(['wcube', m]); shapes.push({ k: 'box', c: new V3(x, y, z), h: new V3(3.9, 3.9, 2) });
  }
  const o = addOb({ meshes, shapes, zMin: z - 2, zMax: z + 2, active: false, boss: true, t: 0,
    update(dt) { o.t += dt; const s = smooth(0, 0.8, o.t); for (const [, m] of meshes) m.scale.set(7.8 * s, 7.8 * s, 4 * s); o.active = s > 0.85; } });
  spawnRing(-32 + (gc + 0.5) * 8, 4 + (gr + 0.5) * 8, z, true);
}
function spawnBlade(z, vertical) {
  const m = take('blade', () => new THREE.Mesh(G.box, addMat([3.5, 1.2, 5], 0.3)));
  const sh = { k: 'box', c: new V3(0, 16, z), h: vertical ? new V3(0.8, 22, 0.8) : new V3(45, 0.8, 0.8) };
  m.scale.set(vertical ? 1.6 : 90, vertical ? 44 : 1.6, 1.6); m.position.set(0, 16, z); m.rotation.set(0, 0, 0);
  const ph = Math.random() * 6, fr = 1.2 + boss.phase * 0.25;
  const o = addOb({ meshes: [['blade', m]], shapes: [sh], zMin: z - 1, zMax: z + 1, active: false, boss: true, t: 0,
    update(dt) {
      o.t += dt; const s = Math.sin(o.t * fr + ph);
      if (vertical) { sh.c.x = s * 24; m.position.x = sh.c.x; } else { sh.c.y = 16 + s * 13; m.position.y = sh.c.y; }
      const on = o.t > 0.7; o.active = on; m.material.opacity = on ? 1 : 0.15 + 0.15 * Math.sin(o.t * 40);
    } });
}
function fireLance() {
  const from = P.pos.clone(), to = new V3(boss.x, boss.y, P.pos.z - boss.dist + 30);
  const b = take('beam', () => { const g = new THREE.Group(); g.add(new THREE.Mesh(G.cyl, addMat([5, 3.4, 1.2], 1)), new THREE.Mesh(G.cyl, addMat([6, 6, 6], 1))); return g; });
  const d = to.clone().sub(from), len = d.length();
  b.position.copy(from).addScaledVector(d, 0.5); b.quaternion.setFromUnitVectors(new V3(0, 1, 0), d.normalize());
  b.children[0].scale.set(1.6, len, 1.6); b.children[1].scale.set(0.5, len, 0.5);
  beams.push({ b, t: 0, from, len });
  A.lance(); shake(0.5);
  later(0.18, () => {
    if (!boss.on || mode !== 'play') return;
    boss.hp--; boss.hit = 1; updateBossBar(); shake(0.9); flash(HDR(0.6, 0.45, 0.2), 0.35);
    burst.emit(to, 90, C_GOLD, 60, 3, 1.4, { drag: 1.2 });
    popup('TREFFER!', 'ring big');
    A.bossHurt();
    if (boss.hp <= 0) return startEnding();
    if (boss.hp <= 8 && boss.phase === 1) phaseUp(2, 'Was … was bist du? Kein Funke brennt so hell.');
    else if (boss.hp <= 4 && boss.phase === 2) phaseUp(3, 'Hör auf zu leuchten! HÖR AUF!');
  });
}
function phaseUp(p, line) {
  boss.phase = p; A.roar(); shake(1.4); caption('umbra', line, 4);
  A.setMusic({ bpm: 136 + (p - 1) * 6 });
  boss.atk = 2.2;
}
function updateBoss(dt) {
  if (!boss.on) return;
  boss.t += dt;
  if (boss.state === 'enter') {
    boss.dist = damp(boss.dist, 265, 0.9, dt); boss.y = damp(boss.y, 20, 0.9, dt);
    if (boss.t > 4.2) boss.state = 'fight';
  } else if (boss.state === 'fight') {
    boss.x = damp(boss.x, Math.sin(boss.t * 0.45) * 16, 2, dt); boss.y = damp(boss.y, 24 + Math.sin(boss.t * 0.7) * 7, 2, dt);
    boss.atk -= dt; if (boss.atk <= 0) bossAttack();
    boss.ringT -= dt;
    if (boss.ringT <= 0) { spawnRing(rand(-22, 22), rand(6, 26), P.pos.z - 205, true); boss.ringT = rand(2.6, 3.4) - boss.phase * 0.2; }
  } else if (boss.state === 'dying') {
    boss.x += (Math.random() - 0.5) * 3 * boss.crack; boss.y += (Math.random() - 0.5) * 3 * boss.crack;
  }
  boss.hit = Math.max(0, boss.hit - dt * 2.5);
  bossU.uHit.value = boss.hit; bossU.uCrack.value = boss.crack;
  bossU.uOpen.value = 0.35 + 0.65 * Math.abs(Math.sin(boss.t * 0.25 + 0.7)) ** 0.2;
  bossGroup.position.set(boss.x, boss.y, P.pos.z - boss.dist);
  eye.lookAt(P.pos);
  crown.rotation.z += dt * 0.15;
  orbiters.forEach((o, i) => { const a = boss.t * 0.6 + i / 6 * Math.PI * 2; o.position.set(Math.cos(a) * 66, Math.sin(a * 1.3) * 20, Math.sin(a) * 66); o.rotation.y += dt * 2; });
}

// ---------------------------------------------------------------------
//  Audio – a small procedural synth orchestra
// ---------------------------------------------------------------------
const A = (() => {
  let ctx = null, out, musicBus, duck, sfxBus, revIn, delayIn, noiseBuf, padFilter, windF, windG;
  const mus = { bpm: 96, prog: ZONES[0].prog, inten: 0, step: 0, next: 0 };
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function impulse(dur, dec) {
    const len = ctx.sampleRate * dur, b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, dec); }
    return b;
  }
  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    out = ctx.createGain(); out.gain.value = save.muted ? 0 : 0.85;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;
    out.connect(comp); comp.connect(ctx.destination);
    const conv = ctx.createConvolver(); conv.buffer = impulse(3.2, 2.6); revIn = ctx.createGain(); revIn.gain.value = 0.55; revIn.connect(conv); conv.connect(out);
    const dl = ctx.createDelay(1.5), fb = ctx.createGain(), dlf = ctx.createBiquadFilter();
    dl.delayTime.value = 0.43; fb.gain.value = 0.38; dlf.type = 'lowpass'; dlf.frequency.value = 2600;
    delayIn = ctx.createGain(); delayIn.connect(dl); dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(out); dlf.connect(revIn);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.8; musicBus.connect(out);
    duck = ctx.createGain(); duck.connect(musicBus);
    padFilter = ctx.createBiquadFilter(); padFilter.type = 'lowpass'; padFilter.frequency.value = 900; padFilter.Q.value = 0.7; padFilter.connect(duck);
    const padRev = ctx.createGain(); padRev.gain.value = 0.6; padFilter.connect(padRev); padRev.connect(revIn);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(out);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const ws = ctx.createBufferSource(); ws.buffer = noiseBuf; ws.loop = true;
    windF = ctx.createBiquadFilter(); windF.type = 'bandpass'; windF.frequency.value = 500; windF.Q.value = 0.7;
    windG = ctx.createGain(); windG.gain.value = 0; ws.connect(windF); windF.connect(windG); windG.connect(out); ws.start();
    mus.next = ctx.currentTime + 0.15;
    setInterval(sched, 25);
  }
  function sched() {
    if (!ctx || ctx.state !== 'running') return;
    if (mus.next < ctx.currentTime - 0.25) mus.next = ctx.currentTime + 0.05;
    while (mus.next < ctx.currentTime + 0.14) { step(mus.step, mus.next); mus.next += 60 / mus.bpm / 4; mus.step++; }
  }
  function env(g, t, a, peak, d, sus = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(sus, t + a + d); }
  function osc(type, f, t, dur, dest, peak, a = 0.005, detune = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; o.detune.value = detune;
    env(g, t, a, peak, dur); o.connect(g); g.connect(dest); o.start(t); o.stop(t + a + dur + 0.05); return g;
  }
  function noise(t, dur, dest, peak, ftype, freq, q = 1, a = 0.003) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; const f = ctx.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    const g = ctx.createGain(); env(g, t, a, peak, dur); s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + a + dur + 0.05); f.out = g; return f;
  }
  const chordOf = bar => { const ch = mus.prog[bar % mus.prog.length]; return { root: ch[0], tones: ch[1] ? [0, 4, 7, 11, 14] : [0, 3, 7, 10, 14] }; };
  function step(s, t) {
    const st = s % 16, bar = Math.floor(s / 16), { root, tones } = chordOf(bar), I = mus.inten, six = 60 / mus.bpm / 4;
    if (st === 0) for (const tn of [0, tones[1], 7, 12]) for (const dt of [-8, 8]) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(root + tn); o.detune.value = dt;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.016, t + 0.5); g.gain.setValueAtTime(0.016, t + six * 16 - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + six * 16 + 0.7);
      o.connect(g); g.connect(padFilter); o.start(t); o.stop(t + six * 16 + 0.8);
    }
    if (I >= 1 && st % 4 === 0) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.13);
      env(g, t, 0.002, 0.9, 0.34); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.4);
      duck.gain.cancelScheduledValues(t); duck.gain.setValueAtTime(0.3, t); duck.gain.linearRampToValueAtTime(1, t + 0.24);
    }
    if (I >= 1 && (st % 4 === 2 || (I >= 2 && (st === 7 || st === 15)))) {
      const n = root - 12 + (st === 15 ? 7 : st === 7 ? 12 : 0);
      const o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(n);
      f.type = 'lowpass'; f.Q.value = 7; f.frequency.setValueAtTime(1500 + mus.boost * 1500, t); f.frequency.exponentialRampToValueAtTime(160, t + 0.18);
      env(g, t, 0.004, 0.2, 0.2); o.connect(f); f.connect(g); g.connect(duck); o.start(t); o.stop(t + 0.3);
    }
    if (I >= 2 && st % 2 === 1) noise(t, st % 4 === 3 ? 0.05 : 0.025, musicBus, st % 4 === 3 ? 0.06 : 0.03, 'highpass', 7500);
    if (I >= 3 && (st === 4 || st === 12)) { const f = noise(t, 0.16, musicBus, 0.25, 'bandpass', 1500, 0.9); f.out.connect(revIn); }
    const every = I === 0 ? 2 : 1;
    if (st % every === 0) {
      const pat = [0, 1, 2, 3, 4, 3, 2, 1], idx = pat[(st / every | 0) % 8], oct = (bar % 2 && st >= 8) ? 24 : 12;
      const o = osc(I >= 3 ? 'square' : 'triangle', mtof(root + tones[idx] + oct), t, I === 0 ? 0.35 : 0.14, duck, I === 0 ? 0.05 : I >= 3 ? 0.018 : 0.035);
      const g = ctx.createGain(); g.gain.value = 0.5; o.connect(g); g.connect(delayIn);
    }
  }
  mus.boost = 0;
  const api = {
    init, get ready() { return !!ctx; },
    setMuted(m) { save.muted = m; persist(); if (out) out.gain.setTargetAtTime(m ? 0 : 0.85, ctx.currentTime, 0.05); },
    setMusic(o) { Object.assign(mus, o); },
    update(speed, boost) {
      if (!ctx) return; const t = ctx.currentTime; mus.boost = boost;
      padFilter.frequency.setTargetAtTime(700 + boost * 2600 + (mus.inten >= 3 ? 400 : 0), t, 0.2);
      windF.frequency.setTargetAtTime(300 + speed * 6 + boost * 900, t, 0.2);
      windG.gain.setTargetAtTime(speed > 1 ? 0.018 + speed * 0.00045 + boost * 0.05 : 0, t, 0.3);
    },
    chordNote(k) { const { root, tones } = chordOf(Math.floor(mus.step / 16)); return root + 24 + tones[k % 4] + 12 * (Math.floor(k / 4) % 2); },
    ring(k) { if (!ctx) return; const t = ctx.currentTime, n = api.chordNote(k); for (const [m, v] of [[0, 0.12], [12, 0.05], [19, 0.025]]) { const o = osc('sine', mtof(n + m), t, 1.0, sfxBus, v); const g = ctx.createGain(); g.gain.value = 0.5; o.connect(g); g.connect(revIn); } },
    gold() { if (!ctx) return; const t = ctx.currentTime; [0, 4, 7, 12].forEach((m, i) => osc('triangle', mtof(api.chordNote(0) + m), t + i * 0.05, 0.8, sfxBus, 0.07)); },
    shard() { if (!ctx) return; osc('triangle', mtof(api.chordNote(randi(0, 7)) + 12), ctx.currentTime, 0.09, sfxBus, 0.03); },
    near(pan) {
      if (!ctx) return; const t = ctx.currentTime, p = ctx.createStereoPanner(); p.pan.value = clamp(pan, -1, 1); p.connect(sfxBus);
      const f = noise(t, 0.35, p, 0.3, 'bandpass', 500, 2, 0.02); f.frequency.exponentialRampToValueAtTime(4000, t + 0.3);
    },
    hit() {
      if (!ctx) return; const t = ctx.currentTime; noise(t, 0.6, sfxBus, 0.6, 'lowpass', 900, 1);
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(28, t + 0.5);
      env(g, t, 0.004, 0.35, 0.5); o.connect(g); g.connect(sfxBus); g.connect(revIn); o.start(t); o.stop(t + 0.6);
    },
    boost() { if (!ctx) return; const t = ctx.currentTime, f = noise(t, 0.6, sfxBus, 0.14, 'bandpass', 300, 1.2, 0.05); f.frequency.exponentialRampToValueAtTime(5000, t + 0.5); },
    lance() {
      if (!ctx) return; const t = ctx.currentTime; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(1800, t + 0.25); env(g, t, 0.01, 0.12, 0.35); o.connect(g); g.connect(sfxBus); g.connect(revIn); o.start(t); o.stop(t + 0.5);
      api.gold();
    },
    bossHurt() { if (!ctx) return; const t = ctx.currentTime; noise(t, 1.2, sfxBus, 0.5, 'lowpass', 500, 1); noise(t, 0.8, revIn, 0.3, 'bandpass', 2400, 1); },
    bossShot() { if (!ctx) return; const t = ctx.currentTime; const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.4); env(g, t, 0.01, 0.08, 0.4); o.connect(g); g.connect(sfxBus); g.connect(revIn); o.start(t); o.stop(t + 0.5); },
    roar() {
      if (!ctx) return; const t = ctx.currentTime, f = ctx.createBiquadFilter(), g = ctx.createGain(), ws = ctx.createWaveShaper();
      const curve = new Float32Array(256); for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 4); } ws.curve = curve;
      f.type = 'lowpass'; f.frequency.setValueAtTime(200, t); f.frequency.linearRampToValueAtTime(900, t + 0.8); f.frequency.linearRampToValueAtTime(150, t + 2.4);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
      ws.connect(f); f.connect(g); g.connect(sfxBus); g.connect(revIn);
      for (const fr of [41, 43.5, 61.7, 82]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(fr, t); o.frequency.linearRampToValueAtTime(fr * 0.8, t + 2.5); o.connect(ws); o.start(t); o.stop(t + 2.7); }
    },
    gate() { if (!ctx) return; const t = ctx.currentTime, f = noise(t, 1.4, sfxBus, 0.18, 'bandpass', 200, 0.8, 0.3); f.frequency.exponentialRampToValueAtTime(3000, t + 1.2); [0, 7, 12, 16, 19].forEach((m, i) => osc('sine', mtof(api.chordNote(0) - 12 + m), t + 0.2 + i * 0.09, 1.6, revIn, 0.06)); },
    heart() { if (!ctx) return; const t = ctx.currentTime; [0, 4, 7, 12, 16].forEach((m, i) => osc('triangle', mtof(72 + m), t + i * 0.06, 0.5, sfxBus, 0.07)); },
    explode() { if (!ctx) return; const t = ctx.currentTime; noise(t, 4, sfxBus, 0.8, 'lowpass', 600, 0.7); noise(t, 3, revIn, 0.5, 'lowpass', 2500, 0.5); const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(18, t + 3); env(g, t, 0.01, 0.6, 3); o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + 3.2); },
    die() { if (!ctx) return; const t = ctx.currentTime; [0, -3, -7, -12].forEach((m, i) => osc('triangle', mtof(64 + m), t + i * 0.22, 0.9, revIn, 0.1)); noise(t, 1.5, sfxBus, 0.4, 'lowpass', 400); },
    click() { if (!ctx) return; osc('sine', 880, ctx.currentTime, 0.08, sfxBus, 0.05); },
    swell() { if (!ctx) return; const t = ctx.currentTime; [50, 57, 62, 66, 69, 74].forEach((m, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = mtof(m); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.03, t + 2 + i * 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 9); o.connect(g); g.connect(padFilter); o.start(t); o.stop(t + 9.2); }); },
  };
  return api;
})();

// ---------------------------------------------------------------------
//  HUD helpers
// ---------------------------------------------------------------------
const hud = $('#hud'), ui = $('#ui');
function popup(text, cls = '') {
  const box = $('#popups'); if (box.children.length > 3) box.firstChild.remove();
  const el = document.createElement('div'); el.className = 'pop ' + cls; el.textContent = text;
  el.style.top = (box.children.length * 38) + 'px';
  box.appendChild(el); el.addEventListener('animationend', () => el.remove());
}
let titleTimer = 0;
function titleCard(num, big, small, color = '#ffd479', dur = 4.2) {
  const t = $('#title'); t.style.setProperty('--tc', color);
  t.innerHTML = `<div class="num">${num}</div><div class="big">${big}</div><div class="small">${small}</div>`;
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
  clearTimeout(titleTimer); titleTimer = setTimeout(() => t.classList.remove('show'), dur * 1000);
}
const capQ = []; let capBusy = false, capTimer = 0;
function caption(who, text, dur = 4) { capQ.push([who, text, dur]); if (!capBusy) nextCaption(); }
function nextCaption() {
  const c = $('#caption'); const it = capQ.shift();
  if (!it) { capBusy = false; c.classList.remove('show'); return; }
  capBusy = true; const [who, text, dur] = it;
  c.className = who; c.innerHTML = `<div class="who">${who === 'lumen' ? 'LUMEN' : who === 'umbra' ? 'UMBRA' : ''}</div><div class="txt">${text}</div>`;
  void c.offsetWidth; c.classList.add('show');
  capTimer = setTimeout(() => { c.classList.remove('show'); capTimer = setTimeout(nextCaption, 650); }, dur * 1000);
}
function clearCaptions() { capQ.length = 0; clearTimeout(capTimer); capBusy = false; $('#caption').classList.remove('show'); }
let hintTimer = 0;
function hint(html, dur = 4) { const h = $('#hint'); h.innerHTML = html; h.classList.add('show'); clearTimeout(hintTimer); hintTimer = setTimeout(() => h.classList.remove('show'), dur * 1000); }
function renderLives() { $('#lives').innerHTML = [0, 1, 2].map(i => `<div class="flame ${i < P.lives ? '' : 'off'}"></div>`).join(''); }
let lastScoreTxt = '', lastMult = 0;

// ---------------------------------------------------------------------
//  Game state
// ---------------------------------------------------------------------
// game-time scheduler (respects pause & slow motion)
let timers = [];
function later(sec, fn) { timers.push({ t: gTime + sec, fn }); }
function runTimers() { if (!timers.length) return; const due = timers.filter(t => t.t <= gTime); timers = timers.filter(t => t.t > gTime); due.forEach(t => t.fn()); }
let mode = 'boot';   // boot | menu | play | paused | dying | ending | over
let run = null;
let timeScale = 1, tsTarget = 1, gTime = 0;
let shakeAmt = 0, glitch = 0, flashCol = new Color(0, 0, 0), fovKick = 0, cine = 0;
const menuMode = () => mode === 'menu' || mode === 'boot' || mode === 'over';
function shake(a) { shakeAmt = Math.max(shakeAmt, a); }
function flash(c, a = 1) { flashCol.copy(c).multiplyScalar(a); }

function clearWorld() {
  timers = [];
  for (const o of obs) for (const [k, m] of o.meshes) give(k, m);
  for (const r of rings) give(r.key, r.g);
  for (const it of items) give('heart', it.g);
  for (const g of gates) give('gate', g.g);
  for (const b of beams) give('beam', b.b);
  obs = []; rings = []; items = []; gates = []; beams = [];
  while (shards.length) freeShard(shards.length - 1);
  shardIM.instanceMatrix.needsUpdate = true;
  decor.forEach(d => d.clear());
  burst.clear();
  boss.on = false; boss.state = 'off'; bossGroup.visible = false; $('#bossBar').classList.add('hidden');
}
function resetWorld(z0, opts = {}) {
  clearWorld();
  P.pos.set(0, 12, z0); P.tgt.set(0, 12); P.vx = P.vy = P.bank = 0; P.alive = true; P.inv = 0; P.slow = 1; P.boostAmt = 0;
  path.arr = [{ x: 0, y: 12 }]; path.z0 = z0 + SEG * 4;
  for (let i = 0; i < 4; i++) path.arr.push({ x: 0, y: 12 });
  Object.assign(gen, { tx: 0, ty: 12, tc: 3, ringCd: 4, chain: 0, shardRun: 6, shardGap: 0, peaceful: !!opts.peaceful, noObsUntil: z0 - (opts.safe ?? 300), lastZone: Math.floor(Math.max(-z0, 0) / ZL), heartDone: {} });
  // pre-build decor behind & around the start so the world never looks empty
  const zi = zoneOf(z0);
  for (let z = z0 + 60; z > z0 - 40; z -= 4) placeDecor(zi, z);
  while (genZ() > z0 - VIEW) genSegment();
  trailC.reset(); trailL.reset(); trailR.reset();
  U.uEnd.value = 0;
  U.uSunDir.value.set(0, 0.07, -1).normalize();
  palTarget = PALS[zi]; applyPal(palTarget, 1);
  P.speed = ZONES[zi].speed;
  camera.position.set(0, 16, z0 + 14);
  player.visible = true;
}

function newRun(story, zone = 0) {
  clearCaptions(); $('#title').classList.remove('show'); $('#hint').classList.remove('show'); $('#popups').innerHTML = '';
  run = { story, zone, score: 0, zoneScore: 0, combo: 0, mult: 1, rings: 0, near: 0, shards: 0, maxCombo: 0, t: 0, lines: {}, zoneAt: zone, hits: 0 };
  U.uCycle.value = story ? 0 : 1;
  P.lives = 3; P.glut = 0.35;
  resetWorld(-zone * ZL - 1, { safe: zone === 0 ? 420 : 320 });
  enterZone(zone, true);
  renderLives(); buildProgress();
  hud.classList.remove('hidden'); $('#bossBar').classList.add('hidden');
  ui.innerHTML = '';
  mode = 'play'; tsTarget = timeScale = 1; cine = 0;
}
function enterZone(zi, first = false) {
  const z = ZONES[zi];
  run.zone = zi; run.zoneScore = run.score;
  palTarget = PALS[zi];
  A.setMusic({ bpm: z.bpm + (run.story ? 0 : cycleOf(P.pos.z) * 4), prog: z.prog, inten: zi >= 3 ? 3 : 2 });
  if (run.story) { if (zi > save.reached) { save.reached = zi; persist(); } }
  const col = '#' + new Color(ZONES[zi].rim).getHexString();
  const cyc = run.story ? '' : ` · Zyklus ${cycleOf(P.pos.z) + 1}`;
  if (first && run.story && zi === 0) {
    INTRO.forEach(([w, t, d]) => caption(w, t, d));
    later(12.5, () => { if (run && mode === 'play' && run.zone === 0) titleCard('KAPITEL I', z.name.toUpperCase(), z.sub, col); });
    if (!save.tut) {
      later(1.2, () => mode === 'play' && hint(isTouch ? 'Finger ziehen zum Steuern' : 'Steuern: <kbd>Maus</kbd> oder <kbd>WASD</kbd> / <kbd>Pfeiltasten</kbd>', 4));
      later(6.5, () => mode === 'play' && hint('Flieg durch die <b>goldenen Ringe</b> – jede Serie erhöht deinen Multiplikator', 4.5));
      later(17, () => mode === 'play' && hint(isTouch ? '<b>BOOST</b>-Knopf halten = Überlicht (verbraucht Glut)' : '<kbd>Leertaste</kbd> oder <kbd>Maustaste</kbd> halten = Boost (verbraucht Glut)', 4.5));
      later(24, () => mode === 'play' && hint('Knapp an Hindernissen vorbei = <b>Bonus</b>. Mutig sein lohnt sich.', 4));
      save.tut = true; persist();
    }
  } else {
    titleCard(run.story ? 'KAPITEL ' + ROMAN[zi] : 'ENDLOSFLUG' + cyc, z.name.toUpperCase(), z.sub, col);
    if (!first) { A.gate(); flash(new Color(ZONES[zi].rim), 0.25); fovKick += 8; }
  }
}
function buildProgress() {
  const pm = $('#progMarks');
  if (run.story) {
    const tot = 4 * ZL + BOSS_AT;
    pm.innerHTML = [1, 2, 3, 4].map(i => `<div class="mk" style="left:${i * ZL / tot * 100}%"></div>`).join('') + '<div class="dist"></div>';
  } else pm.innerHTML = '<div class="dist"></div>';
}

function addScore(v) { if (run && mode === 'play') run.score += v * run.mult; }
function setCombo(c) {
  run.combo = c; run.maxCombo = Math.max(run.maxCombo, c);
  const m = Math.min(8, 1 + Math.floor(c / 3));
  if (m !== run.mult) { run.mult = m; const el = $('#mult'); el.classList.add('bump'); setTimeout(() => el.classList.remove('bump'), 150); if (m > 1 && c > 0) popup('×' + m + ' MULTIPLIKATOR', 'ring'); }
}

function hitPlayer(o) {
  if (P.inv > 0 || !P.alive || mode !== 'play') return;
  o.hit = true; P.lives--; run.hits++; renderLives();
  P.inv = 1.8; P.slow = 0.45; shake(1.3); glitch = 1; flash(HDR(0.6, 0.02, 0.0), 0.8);
  setCombo(0); A.hit(); popup('AUTSCH!', 'hurt');
  burst.emit(P.pos, 70, C_RED, 30, 0.9, 0.9);
  burst.emit(P.pos, 40, C_GOLD, 20, 0.6, 0.7);
  if (navigator.vibrate) navigator.vibrate(120);
  if (P.lives <= 0) die();
}
function die() {
  P.alive = false; mode = 'dying'; tsTarget = 0.25; player.visible = false;
  burst.emit(P.pos, 260, C_GOLD, 40, 1.2, 2.2, { drag: 1.4 });
  burst.emit(P.pos, 120, C_WHITE, 22, 0.8, 1.6);
  A.die(); A.setMusic({ inten: 0 });
  setTimeout(() => showDeath(), 1900);
}
function nearMiss(o) {
  run.near++; addScore(250); P.glut = Math.min(1, P.glut + 0.07); fovKick += 5; shake(0.15);
  A.near(clamp((o.shapes[0].c ? o.shapes[0].c.x : o.shapes[0].x ?? 0) - P.pos.x, -1, 1) * -1);
  popup('KNAPP! +' + 250 * run.mult, 'near');
  burst.emit(P.pos, 16, C_CYAN, 14, 0.4, 0.5);
}
function threaded(o) {
  addScore(150); P.glut = Math.min(1, P.glut + 0.05); fovKick += 3;
  popup('MITTEN DURCH! +' + 150 * run.mult, 'near'); A.ring(run.combo + 2);
  burst.emit(P.pos, 24, C_CYAN, 16, 0.4, 0.5);
}

// ---------------------------------------------------------------------
//  Input
// ---------------------------------------------------------------------
const input = { keys: {}, mx: 0, my: 0, last: 'mouse', mouseBoost: false, touchId: null, tlx: 0, tly: 0, touchBoost: false, padBoost: false, moved: false };
addEventListener('keydown', e => {
  input.keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) input.last = 'key';
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyM') A.setMuted(!save.muted);
  if (e.code === 'Enter' && mode === 'menu') ui.querySelector('.btn.primary')?.click();
});
addEventListener('keyup', e => { input.keys[e.code] = false; });
addEventListener('blur', () => { input.keys = {}; input.mouseBoost = false; if (mode === 'play') togglePause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && mode === 'play') togglePause(); });
canvas.addEventListener('pointerdown', e => {
  A.init();
  if (e.pointerType === 'mouse') { if (e.button === 0) input.mouseBoost = true; input.last = 'mouse'; return; }
  if (input.touchId === null) { input.touchId = e.pointerId; input.tlx = e.clientX; input.tly = e.clientY; input.last = 'touch'; }
  else input.touchBoost = true;
});
addEventListener('pointermove', e => {
  if (e.pointerType === 'mouse') { input.mx = e.clientX / innerWidth * 2 - 1; input.my = -(e.clientY / innerHeight * 2 - 1); input.last = 'mouse'; input.moved = true; return; }
  if (e.pointerId === input.touchId && mode === 'play') {
    const kx = (HALF_W * 2) / (innerWidth * 0.6), ky = (MAX_Y - MIN_Y) / (innerHeight * 0.5);
    P.tgt.x = clamp(P.tgt.x + (e.clientX - input.tlx) * kx, -HALF_W, HALF_W);
    P.tgt.y = clamp(P.tgt.y - (e.clientY - input.tly) * ky, MIN_Y, MAX_Y);
    input.tlx = e.clientX; input.tly = e.clientY;
  }
});
const endPtr = e => {
  if (e.pointerType === 'mouse') { input.mouseBoost = false; return; }
  if (e.pointerId === input.touchId) input.touchId = null; else input.touchBoost = false;
};
addEventListener('pointerup', endPtr); addEventListener('pointercancel', endPtr);
const bb = $('#boostBtn');
bb.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); input.touchBoost = true; A.init(); });
bb.addEventListener('pointerup', e => { e.stopPropagation(); input.touchBoost = false; });
bb.addEventListener('pointerleave', () => { input.touchBoost = false; });
$('#pauseBtn').addEventListener('click', () => togglePause());
canvas.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('pointerdown', () => A.init());
addEventListener('keydown', () => A.init());

function readInput(dt) {
  const k = input.keys;
  const ax = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0);
  const ay = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0);
  let px = 0, py = 0; input.padBoost = false;
  const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g) : null;
  if (gp) {
    px = Math.abs(gp.axes[0]) > 0.15 ? gp.axes[0] : 0; py = Math.abs(gp.axes[1]) > 0.15 ? -gp.axes[1] : 0;
    input.padBoost = !!(gp.buttons[0]?.pressed || gp.buttons[7]?.pressed || gp.buttons[5]?.pressed);
    if (px || py) input.last = 'pad';
    if (gp.buttons[9]?.pressed && !input.padStart) togglePause();
    input.padStart = gp.buttons[9]?.pressed;
  }
  if (input.last === 'key' || input.last === 'pad') {
    P.tgt.x = clamp(P.tgt.x + (ax + px) * 40 * dt, -HALF_W, HALF_W);
    P.tgt.y = clamp(P.tgt.y + (ay + py) * 30 * dt, MIN_Y, MAX_Y);
  } else if (input.last === 'mouse' && input.moved) {
    P.tgt.x = clamp(input.mx * HALF_W * 1.15, -HALF_W, HALF_W);
    P.tgt.y = clamp(lerp(MIN_Y, MAX_Y, (input.my * 1.1 + 1) / 2), MIN_Y, MAX_Y);
  }
  return !!(k.Space || k.ShiftLeft || k.ShiftRight || input.mouseBoost || input.touchBoost || input.padBoost);
}

// ---------------------------------------------------------------------
//  Main update
// ---------------------------------------------------------------------
let wasBoost = false, autoPilot = false;
function update(dt, rdt) {
  gTime += dt;
  U.uTime.value = gTime;
  runTimers();
  const playing = mode === 'play';
  // ---- steering
  let wantBoost = false;
  if (playing && !autoPilot) wantBoost = readInput(rdt);
  else if (mode !== 'dying') { // autopilot (menu, ending)
    const a = pathAt(P.pos.z - 26); P.tgt.set(a.x, a.y);
  }
  const ox = P.pos.x, oy = P.pos.y;
  P.pos.x = damp(P.pos.x, P.tgt.x, 7, dt); P.pos.y = damp(P.pos.y, P.tgt.y, 7, dt);
  P.pos.x = clamp(P.pos.x, -HALF_W, HALF_W); P.pos.y = clamp(P.pos.y, MIN_Y, MAX_Y);
  P.vx = (P.pos.x - ox) / Math.max(dt, 1e-4); P.vy = (P.pos.y - oy) / Math.max(dt, 1e-4);
  P.bank = damp(P.bank, clamp(-P.vx * 0.035, -0.95, 0.95), 8, dt);
  P.pitch = damp(P.pitch, clamp(P.vy * 0.02, -0.5, 0.5), 8, dt);

  // ---- speed & boost
  const zi = zoneOf(P.pos.z);
  let base = mode === 'ending' || mode === 'over' ? 46 : (menuMode() ? 55 : ZONES[zi].speed * (run && !run.story ? 1 + 0.08 * cycleOf(P.pos.z) : 1));
  if (boss.on && boss.state !== 'off') base = 80;
  P.boosting = playing && wantBoost && P.glut > 0.02;
  if (P.boosting && !wasBoost) { A.boost(); fovKick += 6; }
  wasBoost = P.boosting;
  if (P.boosting) P.glut = Math.max(0, P.glut - dt * 0.22);
  P.boostAmt = damp(P.boostAmt, P.boosting ? 1 : 0, 5, dt);
  P.slow = damp(P.slow, 1, 1.2, dt);
  P.speed = damp(P.speed, base * (1 + 0.6 * P.boostAmt) * P.slow, 2.5, dt);
  if (mode !== 'dying') P.pos.z -= P.speed * dt;
  P.inv = Math.max(0, P.inv - dt);

  // ---- generation & housekeeping
  while (genZ() > P.pos.z - VIEW) genSegment();
  if ((path.z0 - P.pos.z) / SEG > 80) { path.arr.splice(0, 40); path.z0 -= 40 * SEG; }

  // ---- zone change
  if (run && (playing || mode === 'dying')) {
    if (zi !== run.zone) enterZone(zi);
    const zStart = -Math.floor(Math.max(-P.pos.z, 0) / ZL) * ZL, prog = (zStart - P.pos.z) / ZL;
    if (run.story || cycleOf(P.pos.z) === 0) ZONES[zi].lines.forEach(([at, who, txt], i) => { const key = Math.floor(-P.pos.z / ZL) + '-' + i; if (prog > at && !run.lines[key]) { run.lines[key] = 1; caption(who, txt, 4.5); } });
    if (run.story && zi === 4 && prog * ZL > BOSS_AT && !boss.on && mode === 'play') startBoss();
  } else if (menuMode() || mode === 'ending') {
    if (palTarget !== PAL_DAWN) palTarget = PALS[zi];
  }

  // ---- obstacles
  const pz = P.pos.z, camZ = camera.position.z;
  for (let i = obs.length - 1; i >= 0; i--) {
    const o = obs[i];
    if (o.update) o.update(dt, gTime);
    if (o.zMin > camZ + 30) { for (const [k, m] of o.meshes) give(k, m); obs[i] = obs[obs.length - 1]; obs.pop(); continue; }
    if (!P.alive || menuMode() || mode === 'ending') continue;
    if (pz > o.zMin - 4 && pz < o.zMax + 4) {
      o.inWin = true;
      if (o.active) {
        let d = 1e9; for (const s of o.shapes) d = Math.min(d, sdShape(s, P.pos));
        d -= PR; if (d < o.minD) o.minD = d;
        if (d < 0) hitPlayer(o);
      }
    } else if (o.inWin && !o.passed) {
      o.passed = true;
      if (!o.hit && playing) {
        const s = o.shapes[0];
        if (o.ring && Math.hypot(P.pos.x - s.c.x, P.pos.y - s.c.y) < s.R) threaded(o);
        else if (o.minD < 2.6) nearMiss(o);
      }
    }
  }

  // ---- rings
  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    if (r.anim >= 0) {
      // collected: the ring is sucked into the spark
      r.anim += dt * 3.2; const k = Math.min(1, r.anim);
      r.g.scale.setScalar((r.gold ? 1.25 : 1) * (1 - k * 0.85)); r.g.children[0].material.opacity = 1 - k; r.g.children[1].material.opacity = 0.5 * (1 - k);
      r.g.position.set(lerp(r.x, P.pos.x, k), lerp(r.y, P.pos.y, k), P.pos.z - 3 * (1 - k));
      if (r.anim >= 1) { give(r.key, r.g); rings[i] = rings[rings.length - 1]; rings.pop(); }
      continue;
    }
    r.g.rotation.z += dt * (r.gold ? 2 : 0.8);
    if (r.z > camZ + 20) { give(r.key, r.g); rings[i] = rings[rings.length - 1]; rings.pop(); continue; }
    if (!r.done && pz <= r.z) {
      r.done = true;
      const d = Math.hypot(P.pos.x - r.x, P.pos.y - r.y);
      if (d < 3.4 && P.alive) {
        r.anim = 0;
        burst.emit(P.pos, r.gold ? 60 : 26, r.gold ? C_WHITE : C_GOLD, r.gold ? 26 : 18, 0.6, 0.7);
        if (run && playing) {
          run.rings++; setCombo(run.combo + 1); addScore(100); P.glut = Math.min(1, P.glut + 0.12);
          A.ring(run.combo); flash(HDR(0.12, 0.08, 0.02), 1); fovKick += 2.5;
          if (r.gold) fireLance();
        } else if (mode === 'ending') A.ring(randi(0, 7));
      } else if (run && playing && !r.gold) {
        if (run.combo >= 3) popup('Serie gerissen', 'hurt');
        setCombo(0); r.g.children[0].material.opacity = 0.25;
      }
    }
  }

  // ---- shards
  const mag = P.boosting ? 11 : 7;
  for (let k = shards.length - 1; k >= 0; k--) {
    const s = shards[k];
    if (s.z > camZ + 10) { freeShard(k); continue; }
    const dx = P.pos.x - s.x, dy = P.pos.y - s.y, dz = P.pos.z - s.z, d = Math.hypot(dx, dy, dz);
    if (P.alive && mode !== 'dying' && d < mag && dz < 6) { const pull = Math.min(1, dt * 12); s.x += dx * pull; s.y += dy * pull; s.z += dz * pull; }
    if (P.alive && mode !== 'dying' && d < 1.8) {
      freeShard(k); burst.emit(_v.set(s.x, s.y, s.z), 5, C_CYAN, 8, 0.3, 0.35);
      if (run && playing) { run.shards++; addScore(10); P.glut = Math.min(1, P.glut + 0.022); A.shard(); }
      continue;
    }
    s.r += dt * 3;
    _q.setFromEuler(_e.set(0, s.r, 0.4));
    _m4.compose(_v.set(s.x, s.y + Math.sin(s.r * 1.3) * 0.2, s.z), _q, _s.set(0.45, 0.8, 0.45));
    shardIM.setMatrixAt(s.i, _m4);
  }
  shardIM.instanceMatrix.needsUpdate = true;

  // ---- hearts
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i]; it.g.rotation.y += dt * 2; it.g.position.y = it.y + Math.sin(gTime * 3) * 0.4;
    const d = it.g.position.distanceTo(P.pos);
    if (d < 2.4 && P.alive && playing) {
      if (P.lives < 3) { P.lives++; renderLives(); popup('+1 FLAMME', 'ring big'); } else { addScore(500); popup('+' + 500 * run.mult, 'ring'); }
      A.heart(); burst.emit(P.pos, 50, C_RED, 16, 0.6, 0.8); flash(HDR(0.4, 0.1, 0.05), 1);
      give('heart', it.g); items[i] = items[items.length - 1]; items.pop(); continue;
    }
    if (it.z > camZ + 20) { give('heart', it.g); items[i] = items[items.length - 1]; items.pop(); }
  }
  // ---- gates
  for (let i = gates.length - 1; i >= 0; i--) {
    const g = gates[i]; g.g.rotation.z += dt * 0.2; g.g.children[1].rotation.z -= dt * 0.5;
    if (g.z > camZ + 60) { give('gate', g.g); gates[i] = gates[gates.length - 1]; gates.pop(); }
  }
  // ---- lance beams
  for (let i = beams.length - 1; i >= 0; i--) {
    const b = beams[i]; b.t += dt * 2.2; b.b.position.z -= P.speed * dt;
    b.b.children.forEach(c => { c.material.opacity = Math.max(0, 1 - b.t); });
    b.b.children[0].scale.x = b.b.children[0].scale.z = 1.6 * (1 + b.t * 2);
    if (b.t >= 1) { give('beam', b.b); beams[i] = beams[beams.length - 1]; beams.pop(); }
  }

  updateBoss(dt);
  if (mode === 'ending') updateEnding(dt, rdt);

  // ---- score
  if (run && playing) {
    addScore(P.speed * dt * 0.1 * (P.boosting ? 2 : 1));
    run.t += dt;
  }
}

// ---------------------------------------------------------------------
//  Visual update (camera, player fx, palette)
// ---------------------------------------------------------------------
let camRoll = 0;
function updateVisuals(dt, rdt) {
  // player
  player.position.copy(P.pos);
  player.rotation.set(-P.pitch * 0.6, 0, P.bank);
  shell.rotation.x += dt * 1.6; shell.rotation.y += dt * 2.3;
  const pulse = 1 + Math.sin(gTime * 9) * 0.06 + P.boostAmt * 0.25;
  core.scale.setScalar(0.5 * pulse); shell.scale.setScalar(1 + P.boostAmt * 0.3);
  halo.scale.setScalar(2.4 * pulse + P.boostAmt * 2); halo2.material.opacity = 0.14 + P.boostAmt * 0.2;
  wingMat.opacity = 0.55 + P.boostAmt * 0.35;
  wingR.rotation.z = Math.sin(gTime * 3) * 0.08; wingL.rotation.z = -wingR.rotation.z;
  if (P.inv > 0 && P.alive) player.visible = Math.floor(P.inv * 14) % 2 === 0; else if (P.alive) player.visible = true;
  const cb = Math.cos(P.bank), sb = Math.sin(P.bank); P.right.set(cb, sb, 0);
  const tw = 1.2;
  if (P.alive) {
    trailC.push(P.pos.x, P.pos.y, P.pos.z + 0.4, cb, sb, 0);
    trailL.push(P.pos.x - cb * tw * 1.7, P.pos.y - sb * tw * 1.7, P.pos.z + 0.6, -sb, cb, 0);
    trailR.push(P.pos.x + cb * tw * 1.7, P.pos.y + sb * tw * 1.7, P.pos.z + 0.6, -sb, cb, 0);
  }
  trailC.mat.uniforms.uOp.value = 0.6 + P.boostAmt * 0.5;
  if (P.boosting && Math.random() < 0.6) burst.emit(_v.copy(P.pos).add(_v2.set(0, 0, 0.8)), 1, C_GOLD, 4, 0.35, 0.4, { vz: 10 });
  U.uPlayer.value.copy(P.pos);
  U.uPlayerCol.value.setRGB(1.0, 0.7, 0.35).multiplyScalar(P.alive ? 1 + P.boostAmt * 0.6 : 0);

  // camera
  const boostBack = P.boostAmt * 2.5, portrait = clamp((1.15 - camera.aspect) / 0.65, 0, 1);  // phones held upright see more of the corridor
  let tx = P.pos.x * 0.85, ty = P.pos.y * 0.8 + 4.2 + portrait * 2, tz = P.pos.z + 10.5 + boostBack + portrait * 5;
  let lx = P.pos.x * 0.75, ly = P.pos.y * 0.85 + 2.2, lz = P.pos.z - 30;
  if (menuMode()) { // cinematic attract camera
    const a = gTime * 0.12;
    tx = P.pos.x + Math.sin(a) * 16; ty = P.pos.y + 5 + Math.sin(a * 1.7) * 3; tz = P.pos.z + 16 + Math.cos(a) * 4;
    lx = P.pos.x * 0.6; ly = P.pos.y + 2; lz = P.pos.z - 40;
  }
  if (mode === 'ending' && cine > 0) {
    const a = cine * 0.35;
    tx = lerp(tx, P.pos.x + Math.sin(a) * 22, Math.min(1, cine * 0.4)); ty = lerp(ty, P.pos.y + 6 + cine * 0.8, Math.min(1, cine * 0.4)); tz = lerp(tz, P.pos.z + Math.cos(a) * 22, Math.min(1, cine * 0.4));
    lx = P.pos.x; ly = P.pos.y + 4 + cine; lz = lerp(lz, P.pos.z - 200, Math.min(1, cine * 0.2));
  }
  camera.position.x = damp(camera.position.x, tx, 4, rdt);
  camera.position.y = damp(camera.position.y, ty, 4, rdt);
  camera.position.z = menuMode() || mode === 'ending' ? damp(camera.position.z, tz, 5, rdt) : tz;
  shakeAmt = Math.max(0, shakeAmt - rdt * 2.2);
  const sh = shakeAmt * shakeAmt * 1.6;
  camera.position.x += (Math.random() - 0.5) * sh; camera.position.y += (Math.random() - 0.5) * sh;
  camera.lookAt(lx, ly, lz);
  camRoll = damp(camRoll, P.bank * 0.35, 5, rdt);
  camera.rotateZ(camRoll);
  fovKick = damp(fovKick, 0, 3, rdt);
  camera.fov = 68 + clamp((P.speed - 60) * 0.18, -4, 16) + fovKick + P.boostAmt * 8 + portrait * 22;
  camera.updateProjectionMatrix();

  // world anchoring
  sky.position.copy(camera.position);
  terrain.position.z = Math.round((P.pos.z - TER_L * 0.42) / 6) * 6;
  clouds.position.set(0, -9, P.pos.z - 550);
  motes.material.uniforms.uCam.value.copy(camera.position);
  const sl = speedLines.material.uniforms;
  sl.uCam.value.copy(camera.position); sl.uTravel.value = (sl.uTravel.value + P.speed * dt * 1.2) % 200;
  sl.uLen.value = 4 + P.speed * 0.12 + P.boostAmt * 14; sl.uOp.value = damp(sl.uOp.value, P.boostAmt * 0.9 + clamp((P.speed - 75) / 60, 0, 0.35), 5, rdt);
  sl.uCol.value.copy(pal.part);

  // palette
  applyPal(palTarget, 1 - Math.exp(-rdt * 0.6));

  // post
  glitch = Math.max(0, glitch - rdt * 2.2);
  flashCol.multiplyScalar(Math.exp(-rdt * 4));
  FX.uTime.value = gTime; FX.uGlitch.value = glitch; FX.uFlash.value.copy(flashCol);
  FX.uAberr.value = 0.0012 + P.boostAmt * 0.004 + glitch * 0.012;
  FX.uRadial.value = P.boostAmt * 1.0 + clamp((P.speed - 70) / 80, 0, 0.5);
  bloom.strength = 0.8 + P.boostAmt * 0.3;

  A.update(mode === 'play' || mode === 'ending' ? P.speed : P.speed * 0.4, P.boostAmt);
  burst.update(dt);
}

function updateHUD() {
  if (!run || hud.classList.contains('hidden')) return;
  const s = Math.floor(run.score).toLocaleString('de-DE');
  if (s !== lastScoreTxt) { $('#score').textContent = s; lastScoreTxt = s; }
  if (run.mult !== lastMult) { const el = $('#mult'); el.textContent = '×' + run.mult; el.classList.toggle('x1', run.mult === 1); lastMult = run.mult; }
  $('#glutFill').style.width = (P.glut * 100).toFixed(1) + '%';
  $('#glut').classList.toggle('boost', P.boosting);
  bb.classList.toggle('on', P.boosting);
  const dist = Math.floor(-P.pos.z);
  if (run.story) $('#progFill').style.width = clamp(dist / (4 * ZL + BOSS_AT) * 100, 0, 100) + '%';
  else $('#progFill').style.width = ((dist % ZL) / ZL * 100) + '%';
  const d = $('#progMarks .dist'); if (d) d.textContent = (dist / 1000).toFixed(1) + ' km';
}

// ---------------------------------------------------------------------
//  Ending
// ---------------------------------------------------------------------
let ending = null;
function startEnding() {
  mode = 'ending'; ending = { t: 0, stage: 0 };
  boss.state = 'dying'; tsTarget = 0.3;
  $('#bossBar').classList.add('hidden');
  clearCaptions(); caption('umbra', '… so warm … ich hatte vergessen, wie warm …', 4);
  A.setMusic({ inten: 0 }); A.roar();
  for (const o of obs) if (o.boss) o.active = false;
}
function updateEnding(dt, rdt) {
  const e = ending; e.t += rdt;
  if (e.stage === 0) {
    boss.crack = Math.min(1, e.t / 2.6); shake(0.4 + boss.crack * 0.6);
    bossGroup.scale.setScalar(1.35 * (1 + Math.sin(e.t * 40) * 0.02 * boss.crack));
    if (e.t > 2.6) { e.stage = 1; }
  } else if (e.stage === 1) {
    bossGroup.scale.setScalar(Math.max(0.02, bossGroup.scale.x - rdt * 2.2));
    if (bossGroup.scale.x <= 0.05) {
      e.stage = 2; e.t2 = 0;
      flash(HDR(2.4, 2.1, 1.6), 1); shake(2); A.explode(); A.swell();
      const bp = bossGroup.position.clone();
      burst.emit(bp, 500, C_GOLD, 140, 6, 3, { drag: 0.8 }); burst.emit(bp, 300, C_WHITE, 90, 4, 2.4, { drag: 0.9 });
      bossGroup.visible = false; boss.on = false;
      for (const o of obs) for (const [k, m] of o.meshes) give(k, m);
      obs = []; gen.peaceful = true;
      palTarget = PAL_DAWN; U.uEnd.value = 0;
      tsTarget = 1;
      A.setMusic({ bpm: DAWN.bpm, prog: DAWN.prog, inten: 0 });
      later(1.2, () => titleCard('EPILOG', 'DIE SONNE ERWACHT', 'Und mit ihr alles, was du berührt hast.', '#ffd479', 6));
      later(7, () => caption('lumen', 'Ich dachte, ich wäre der letzte Funke.', 4));
      later(11.5, () => caption('lumen', 'Aber vielleicht … war ich nur der erste.', 5));
    }
  } else if (e.stage === 2) {
    e.t2 += rdt; cine = e.t2;
    U.uEnd.value = Math.min(1, e.t2 / 6);
    U.uSunDir.value.set(0, lerp(0.07, 0.22, Math.min(1, e.t2 / 10)), -1).normalize();
    if (e.t2 > 18 && e.stage === 2) { e.stage = 3; showEnd(); }
  }
}

// ---------------------------------------------------------------------
//  Screens
// ---------------------------------------------------------------------
const qualityLabel = () => ({ auto: 'Auto', low: 'Niedrig', mid: 'Mittel', high: 'Hoch' })[save.quality];
function showMenu() {
  mode = 'menu'; run = null; hud.classList.add('hidden'); clearCaptions(); $('#title').classList.remove('show');
  U.uCycle.value = 0; gen.peaceful = false; tsTarget = 1; cine = 0;
  A.setMusic({ bpm: 92, prog: ZONES[0].prog, inten: 0 });
  ui.innerHTML = `<div class="screen">
    <div class="logo">LUMEN</div>
    <div class="sublogo">SONNENFLUG</div>
    <div class="tag">Die Sonne ist zerbrochen. Du bist der letzte Funke.<br>Flieg durch fünf sterbende Welten und hol dir das Licht zurück.</div>
    <div class="btns">
      <button class="btn primary" data-a="story">${save.reached > 0 ? 'Neue Reise' : 'Reise beginnen'}</button>
      ${save.reached > 0 ? `<button class="btn" data-a="cont">Weiter ab Kapitel ${ROMAN[save.reached]}<small>${ZONES[save.reached].name}</small></button>` : ''}
      <button class="btn" data-a="endless">Endlosflug<small>Alle Welten, immer schneller</small></button>
    </div>
    <div class="chips">
      <button class="chip" data-a="sound">${save.muted ? '🔇 Ton aus' : '🔊 Ton an'}</button>
      <button class="chip" data-a="quality">✦ Grafik: ${qualityLabel()}</button>
      <a class="chip" href="../">← Lumen 2D</a>
    </div>
    <div class="stats">${save.best ? `Rekord Reise <b>${Math.floor(save.best).toLocaleString('de-DE')}</b>` : ''}${save.best && save.bestEndless ? ' · ' : ''}${save.bestEndless ? `Rekord Endlos <b>${Math.floor(save.bestEndless).toLocaleString('de-DE')}</b> (${(save.bestDist / 1000).toFixed(1)} km)` : ''}${save.finished ? ' · ☀ Sonne gerettet' : ''}</div>
    <div class="keys">${isTouch ? 'Ziehen zum Steuern · BOOST-Knopf halten' : 'Maus / WASD steuern · Leertaste / Maustaste = Boost · Esc = Pause · M = Ton'} · Kopfhörer empfohlen 🎧</div>
  </div>`;
}
function showPause() {
  ui.innerHTML = `<div class="screen dim">
    <div class="h2">PAUSE</div>
    <div class="lead">${run.story ? 'Kapitel ' + ROMAN[run.zone] + ' · ' + ZONES[run.zone].name : 'Endlosflug · ' + (-P.pos.z / 1000).toFixed(1) + ' km'}</div>
    <div class="btns">
      <button class="btn primary" data-a="resume">Weiterfliegen</button>
      <button class="btn" data-a="sound">${save.muted ? '🔇 Ton aus' : '🔊 Ton an'}</button>
      <button class="btn" data-a="quality">Grafik: ${qualityLabel()}</button>
      <button class="btn" data-a="menu">Hauptmenü</button>
    </div></div>`;
}
function togglePause() {
  if (mode === 'play') { mode = 'paused'; $('#hint').classList.remove('show'); showPause(); }
  else if (mode === 'paused') { mode = 'play'; ui.innerHTML = ''; last = performance.now(); }
}
function statGrid() {
  return `<div class="statgrid">
    <div class="stat"><div class="v">${Math.floor(run.score).toLocaleString('de-DE')}</div><div class="l">Punkte</div></div>
    <div class="stat"><div class="v">${(-P.pos.z / 1000).toFixed(1)} km</div><div class="l">Strecke</div></div>
    <div class="stat"><div class="v">${run.rings}</div><div class="l">Ringe</div></div>
    <div class="stat"><div class="v">${run.near}</div><div class="l">Knapp vorbei</div></div>
    <div class="stat"><div class="v">${run.maxCombo}</div><div class="l">Beste Serie</div></div>
    <div class="stat"><div class="v">${run.shards}</div><div class="l">Lichtsplitter</div></div>
  </div>`;
}
function recordCheck() {
  let rec = false;
  if (run.story) { if (run.score > save.best) { save.best = run.score; rec = true; } }
  else { if (run.score > save.bestEndless) { save.bestEndless = run.score; rec = true; } save.bestDist = Math.max(save.bestDist, -P.pos.z); }
  persist(); return rec;
}
function showDeath() {
  mode = 'over'; hud.classList.add('hidden');
  const rec = recordCheck();
  const lines = ['Ein Funke, der fällt, ist noch nicht erloschen.', 'Umbra lacht. Noch.', 'Das Licht erinnert sich an dich.', 'Jeder Sonnenaufgang beginnt mit einem Versuch.'];
  ui.innerHTML = `<div class="screen dim">
    <div class="h2 dark">DEIN LICHT ERLISCHT</div>
    <div class="lead">${pick(lines)}</div>
    ${rec ? '<div class="newrec">✦ NEUER REKORD ✦</div>' : ''}
    ${statGrid()}
    <div class="btns">
      ${run.story ? `<button class="btn primary" data-a="retry">Weiter ab Kapitel ${ROMAN[run.zone]}<small>${ZONES[run.zone].name}</small></button>` : `<button class="btn primary" data-a="endless">Nochmal fliegen</button>`}
      <button class="btn" data-a="menu">Hauptmenü</button>
    </div></div>`;
}
function showEnd() {
  mode = 'over'; hud.classList.add('hidden');
  save.finished = true; const rec = recordCheck(); save.reached = 0; persist();
  ui.innerHTML = `<div class="screen dim" style="background:radial-gradient(ellipse at center, rgba(60,30,5,.2), rgba(20,10,5,.7))">
    <div class="h2">DIE SONNE IST ZURÜCK</div>
    <div class="lead">Du hast Umbra besiegt und die Welt aus der Nacht geholt. Danke fürs Fliegen, kleiner Funke.</div>
    ${rec ? '<div class="newrec">✦ NEUER REKORD ✦</div>' : ''}
    ${statGrid()}
    <div class="btns">
      <button class="btn primary" data-a="endless">Endlosflug starten</button>
      <button class="btn" data-a="menu">Hauptmenü</button>
    </div></div>`;
}

function fadeTo(fn) {
  const f = $('#fade'); f.classList.add('on');
  setTimeout(() => { fn(); f.classList.remove('on'); }, 600);
}
const actions = {
  story: () => fadeTo(() => { save.reached = 0; persist(); newRun(true, 0); }),
  cont: () => fadeTo(() => newRun(true, save.reached)),
  retry: () => fadeTo(() => { const z = run.zone, sc = run.zoneScore, st = { rings: run.rings, near: run.near, shards: run.shards, maxCombo: run.maxCombo, t: run.t }; newRun(true, z); run.score = sc; run.zoneScore = sc; Object.assign(run, st); }),
  endless: () => fadeTo(() => newRun(false, 0)),
  resume: () => togglePause(),
  menu: () => fadeTo(() => { resetWorld(0, { safe: 300 }); showMenu(); }),
  sound: b => { A.setMuted(!save.muted); b.textContent = save.muted ? '🔇 Ton aus' : '🔊 Ton an'; },
  quality: b => {
    const order = ['auto', 'high', 'mid', 'low']; save.quality = order[(order.indexOf(save.quality) + 1) % 4]; persist();
    qLevel = save.quality === 'auto' ? (isTouch ? 1 : 2) : { low: 0, mid: 1, high: 2 }[save.quality]; applyQuality();
    b.textContent = (b.classList.contains('chip') ? '✦ ' : '') + 'Grafik: ' + qualityLabel();
  },
};
ui.addEventListener('click', e => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  A.init(); A.click();
  actions[b.dataset.a]?.(b);
});

// ---------------------------------------------------------------------
//  Loop
// ---------------------------------------------------------------------
let last = performance.now(), fpsAcc = 0, fpsN = 0, fpsCheckT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const rdt = Math.min((now - last) / 1000, 0.05); last = now;
  timeScale = damp(timeScale, tsTarget, 3, rdt);
  const dt = rdt * timeScale;
  if (mode !== 'paused') {
    update(dt, rdt);
    updateVisuals(dt, rdt);
    updateHUD();
  }
  composer.render(rdt);
  // auto quality: step down if the device struggles
  if (save.quality === 'auto' && mode === 'play') {
    fpsAcc += rdt; fpsN++; fpsCheckT += rdt;
    if (fpsCheckT > 4) {
      const fps = fpsN / fpsAcc;
      if (fps < 40 && qLevel > 0) { qLevel--; applyQuality(); }
      fpsAcc = 0; fpsN = 0; fpsCheckT = 0;
    }
  }
}

// ---------------------------------------------------------------------
//  Boot
// ---------------------------------------------------------------------
applyQuality();
resetWorld(0, { safe: 300 });
showMenu();
requestAnimationFrame(t => { last = t; frame(t); });
setTimeout(() => $('#loading').classList.add('gone'), 400);

// debug hooks for automated testing
window.__lumen = { P, boss, bossGroup, camera, renderer, obs: () => obs, rings: () => rings, setAuto: v => { autoPilot = v; },
  // fast-forward the simulation (tests run in slow headless browsers)
  step(sec, dt = 1 / 60) { for (let t = 0; t < sec; t += dt) { timeScale = damp(timeScale, tsTarget, 3, dt); update(dt * timeScale, dt); updateVisuals(dt * timeScale, dt); } updateHUD(); }, get mode() { return mode; }, get run() { return run; }, newRun, startBoss, startEnding, jump: z => { resetWorld(z, { safe: 200 }); if (run) run.zone = zoneOf(z); } };
