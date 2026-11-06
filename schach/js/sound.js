// Kleine Klangkulisse, live mit WebAudio erzeugt (keine Audiodateien nötig).
let ctx = null;
export const sound = { on: true };

function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function knock(t, freq, dur, vol, noise = 0.6) {
  const c = ac(); if (!c) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = Math.pow(1 - i / len, 6);
    d[i] = (Math.sin(2 * Math.PI * freq * i / c.sampleRate) * (1 - noise) + (Math.random() * 2 - 1) * noise) * env;
  }
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq * 6;
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(c.destination);
  src.start(c.currentTime + t);
}

function tone(t, freq, dur, vol = 0.12, type = 'sine') {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  const s = c.currentTime + t;
  g.gain.setValueAtTime(0, s);
  g.gain.linearRampToValueAtTime(vol, s + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, s + dur);
  o.connect(g).connect(c.destination);
  o.start(s); o.stop(s + dur + 0.05);
}

export function play(name) {
  if (!sound.on) return;
  switch (name) {
    case 'move': knock(0, 190, 0.09, 0.9, 0.45); break;
    case 'capture': knock(0, 140, 0.07, 1, 0.7); knock(0.05, 240, 0.1, 0.8, 0.5); break;
    case 'castle': knock(0, 190, 0.08, 0.8, 0.45); knock(0.11, 210, 0.08, 0.8, 0.45); break;
    case 'check': knock(0, 190, 0.09, 0.9, 0.45); tone(0.02, 880, 0.18, 0.07, 'triangle'); break;
    case 'promote': tone(0, 660, 0.14, 0.1); tone(0.08, 990, 0.2, 0.1); break;
    case 'illegal': tone(0, 160, 0.15, 0.08, 'square'); break;
    case 'start': [523, 659, 784].forEach((f, i) => tone(i * 0.08, f, 0.3, 0.07)); break;
    case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => tone(i * 0.1, f, 0.45, 0.08, 'triangle')); break;
    case 'lose': [392, 330, 262].forEach((f, i) => tone(i * 0.16, f, 0.5, 0.07)); break;
    case 'draw': [440, 440].forEach((f, i) => tone(i * 0.18, f, 0.3, 0.06)); break;
    case 'correct': tone(0, 784, 0.15, 0.09, 'triangle'); tone(0.09, 1175, 0.25, 0.09, 'triangle'); break;
    case 'wrong': tone(0, 220, 0.25, 0.08, 'sawtooth'); break;
    case 'rankup': [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone(i * 0.09, f, 0.5, 0.075, 'triangle')); break;
    case 'rankdown': [659, 523, 392].forEach((f, i) => tone(i * 0.15, f, 0.4, 0.06)); break;
    case 'click': tone(0, 1200, 0.04, 0.03); break;
  }
}
