'use strict';
// Rumms! – Hilfsfunktionen, Gelände, Geometrie, Speicher und Ton.

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function weightedPick(items, weightOf) {
  let total = 0;
  for (const it of items) total += weightOf(it);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const it of items) {
    r -= weightOf(it);
    if (r <= 0) return it;
  }
  return items[items.length - 1];
}
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace('.', ',') + ' Mio.';
  if (n >= 1e4) return Math.round(n / 1e3) + 'k';
  return String(Math.round(n));
}
function fmtPct(v) { return `${Math.round(v * 100)} %`; }

// Deterministischer Zufall, damit die Welt immer gleich aussieht.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Gelände ----------
// Sanfte Hügel, flache Lichtung in der Mitte, Gebirge am Rand.
function groundHeight(x, z) {
  let h = Math.sin(x * 0.045) * Math.cos(z * 0.05) * 2.4
    + Math.sin(x * 0.11 + 1.3) * Math.sin(z * 0.09 + 0.7) * 1.1
    + Math.sin((x + z) * 0.024) * 1.6
    + Math.cos(x * 0.021 - z * 0.033) * 1.4;
  const d = Math.hypot(x, z);
  h *= 0.25 + 0.75 * smoothstep(5, 26, d);
  const e = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(CONFIG.MAP_HALF - 2, CONFIG.MAP_HALF + 30, e) * 20;
  // Teiche flach halten, damit man hindurchwaten kann
  const wl = CONFIG.WATER_LEVEL;
  if (h < wl) h = wl - (wl - h) * 0.3;
  return h;
}

// ---------- Geometrie ----------
// Fügt mehrere einfache Formen zu einer Geometrie mit Vertex-Farben zusammen,
// damit ein Gegnertyp als ein einziges InstancedMesh gezeichnet werden kann.
// Teile sind glatt schattiert; flat: true ergibt Facetten (Felsen, Kristalle).
function mergeParts(parts) {
  const pos = [], nor = [], col = [];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const c = new THREE.Color();
  for (const p of parts) {
    let g = p.geo.clone();
    e.set(...(p.rot || [0, 0, 0]));
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(...(p.pos || [0, 0, 0])), q, new THREE.Vector3(...(p.scale || [1, 1, 1])));
    g.applyMatrix4(m);
    if (g.index) g = g.toNonIndexed();
    if (p.flat) g.computeVertexNormals();
    c.set(p.color);
    const pa = g.attributes.position.array, na = g.attributes.normal.array;
    for (let i = 0; i < pa.length; i += 3) {
      pos.push(pa[i], pa[i + 1], pa[i + 2]);
      nor.push(na[i], na[i + 1], na[i + 2]);
      col.push(c.r, c.g, c.b);
    }
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}
const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  rbox: roundedBox(1, 1, 1, 0.18, 2),
  ball1: new THREE.IcosahedronGeometry(0.5, 1),
  ball2: new THREE.IcosahedronGeometry(0.5, 2),
  ball3: new THREE.IcosahedronGeometry(0.5, 3),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 4, 10),
  cyl12: new THREE.CylinderGeometry(0.5, 0.5, 1, 12),
  cone12: new THREE.ConeGeometry(0.5, 1, 12),
  torus: new THREE.TorusGeometry(0.5, 0.15, 8, 20),
  sphere: new THREE.IcosahedronGeometry(0.5, 1),
  ball: new THREE.IcosahedronGeometry(0.5, 0),
  cone: new THREE.ConeGeometry(0.5, 1, 7),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  oct: new THREE.OctahedronGeometry(0.5, 0),
  dodeca: new THREE.DodecahedronGeometry(0.5, 0),
  tetra: new THREE.TetrahedronGeometry(0.5, 0),
};

// Würfel mit abgerundeten Kanten (für Spielzeug-Optik)
function roundedBox(w, h, d, r, seg) {
  const g = new THREE.BoxGeometry(w, h, d, seg + 2, seg + 2, seg + 2);
  const p = g.attributes.position, v = new THREE.Vector3(), inner = new THREE.Vector3();
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    inner.set(clamp(v.x, -hw, hw), clamp(v.y, -hh, hh), clamp(v.z, -hd, hd));
    v.sub(inner);
    if (v.lengthSq() > 0) v.setLength(r);
    p.setXYZ(i, inner.x + v.x, inner.y + v.y, inner.z + v.z);
  }
  g.computeVertexNormals();
  return g;
}

// ---------- Speicher ----------
const Store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? Object.assign(Array.isArray(fallback) ? [] : {}, fallback, JSON.parse(v)) : fallback;
    } catch (_) { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) { /* privat / blockiert */ }
  },
};
const SETTINGS_KEY = 'rumms.settings.v1';
const RECORDS_KEY = 'rumms.records.v1';
const Settings = Store.get(SETTINGS_KEY, {
  quality: 'mid', music: true, sfx: true, vibrate: true, numbers: true,
  sensitivity: 1, autoCam: false, char: 'knight', landscape: 'auto',
});
function saveSettings() { Store.set(SETTINGS_KEY, Settings); }
// Fortschritt über Runden hinweg: Sterne, Werkstatt, Erfolge, Hüte
const PROFILE_KEY = 'rumms.profile.v1';
const Profile = Store.get(PROFILE_KEY, { stars: 0, starsTotal: 0, shop: {}, ach: {}, hats: {}, totals: {}, nightmare: false });
function saveProfile() { Store.set(PROFILE_KEY, Profile); }
const QUALITY = {
  low: { pixelRatio: 0.85, particles: 160, numbers: 24, grass: 0, glow: 500 },
  mid: { pixelRatio: 1.5, particles: 300, numbers: 40, grass: 4200, glow: 1200 },
  high: { pixelRatio: 2, particles: 480, numbers: 60, grass: 8000, glow: 1800 },
};

// ---------- Ton ----------
// Alle Geräusche werden mit der Web-Audio-API erzeugt, es gibt keine Audiodateien.
const Sound = {
  ctx: null, master: null, sfxGain: null, musicGain: null, noiseBuf: null,
  last: {}, xpCombo: 0, xpComboT: 0,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (_) { return; }
    const ctx = this.ctx;
    this.master = ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(ctx.destination);
    this.sfxGain = ctx.createGain(); this.sfxGain.connect(this.master);
    this.musicGain = ctx.createGain(); this.musicGain.connect(this.master);
    this.applySettings();
    const len = ctx.sampleRate * 0.5;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    Music.init();
  },
  applySettings() {
    if (!this.ctx) return;
    this.sfxGain.gain.value = Settings.sfx ? 0.55 : 0;
    this.musicGain.gain.value = Settings.music ? 0.32 : 0;
  },
  ok(name, gap) {
    if (!this.ctx || !Settings.sfx) return false;
    const t = this.ctx.currentTime;
    if (this.last[name] && t - this.last[name] < gap) return false;
    this.last[name] = t;
    return true;
  },
  tone(type, f0, f1, dur, vol, delay = 0) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(this.sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, freq, q = 1, type = 'bandpass', delay = 0, freqEnd) {
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxGain);
    s.start(t); s.stop(t + dur + 0.02);
  },
  bonk() { if (this.ok('bonk', 0.05)) { this.tone('sine', 420, 90, 0.12, 0.35); this.noise(0.04, 0.25, 2500, 2); } },
  hit() { if (this.ok('hit', 0.045)) this.noise(0.06, 0.2, 1800 + Math.random() * 900, 3); },
  shoot() { if (this.ok('shoot', 0.06)) this.tone('triangle', 900, 500, 0.07, 0.12); },
  zap() { if (this.ok('zap', 0.08)) { this.tone('sawtooth', 1400, 300, 0.12, 0.1); this.noise(0.1, 0.12, 4000, 1, 'highpass'); } },
  boom() { if (this.ok('boom', 0.07)) { this.noise(0.45, 0.5, 900, 0.7, 'lowpass', 0, 80); this.tone('sine', 120, 40, 0.3, 0.4); } },
  swoosh() { if (this.ok('swoosh', 0.08)) this.noise(0.16, 0.22, 600, 1.5, 'bandpass', 0, 2400); },
  jump() { if (this.ok('jump', 0.05)) this.tone('sine', 300, 620, 0.12, 0.2); },
  dash() { if (this.ok('dash', 0.1)) this.noise(0.2, 0.3, 300, 1, 'bandpass', 0, 3000); },
  hurt() { if (this.ok('hurt', 0.12)) { this.tone('square', 220, 90, 0.2, 0.18); this.noise(0.12, 0.2, 500, 1); } },
  coin() { if (this.ok('coin', 0.05)) { this.tone('square', 1320, 1320, 0.05, 0.08); this.tone('square', 1760, 1760, 0.1, 0.08, 0.05); } },
  xp() {
    if (!this.ok('xp', 0.035)) return;
    const t = this.ctx.currentTime;
    this.xpCombo = t - this.xpComboT < 0.5 ? Math.min(this.xpCombo + 1, 18) : 0;
    this.xpComboT = t;
    const f = 660 * Math.pow(2, this.xpCombo / 12);
    this.tone('sine', f, f, 0.09, 0.14);
  },
  levelUp() {
    if (!this.ok('lvl', 0.2)) return;
    [523, 659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.18, 0.2, i * 0.07));
  },
  chest() {
    if (!this.ok('chest', 0.2)) return;
    [392, 523, 659, 784, 1046, 1318].forEach((f, i) => this.tone('square', f, f, 0.12, 0.08, i * 0.05));
  },
  pick() { if (this.ok('pick', 0.05)) this.tone('triangle', 700, 1000, 0.08, 0.15); },
  boss() {
    if (!this.ok('boss', 1)) return;
    this.tone('sawtooth', 70, 50, 1.6, 0.35); this.tone('sawtooth', 105, 75, 1.6, 0.2);
    this.noise(1.2, 0.25, 200, 0.5, 'lowpass');
  },
  fuse() { if (this.ok('fuse', 0.15)) this.noise(0.6, 0.12, 5000, 2, 'highpass', 0, 7000); },
  charge() { if (this.ok('charge', 0.25)) { this.tone('sawtooth', 160, 70, 0.28, 0.12); this.noise(0.25, 0.18, 300, 1, 'lowpass'); } },
  heal() { if (this.ok('heal', 0.4)) { this.tone('sine', 520, 880, 0.25, 0.08); } },
  screech() { if (this.ok('screech', 0.5)) { this.tone('sawtooth', 2400, 1500, 0.18, 0.05); this.tone('sine', 2000, 1200, 0.2, 0.06); } },
  whoom() { if (this.ok('whoom', 0.3)) { this.tone('sine', 90, 45, 0.7, 0.3); this.noise(0.6, 0.15, 250, 1, 'lowpass', 0, 90); } },
  hum() { if (this.ok('hum', 0.3)) { this.tone('sawtooth', 180, 240, 0.5, 0.07); this.tone('sine', 360, 480, 0.5, 0.08); } },
  puff() { if (this.ok('puff', 0.2)) this.noise(0.4, 0.3, 700, 0.8, 'lowpass', 0, 200); },
  cannon() { if (this.ok('cannon', 0.08)) { this.tone('sine', 160, 60, 0.15, 0.25); this.noise(0.12, 0.2, 1200, 1, 'lowpass', 0, 300); } },
  stomp() { if (this.ok('stomp', 0.2)) { this.noise(0.5, 0.6, 400, 0.5, 'lowpass', 0, 50); this.tone('sine', 80, 30, 0.5, 0.5); } },
  win() { [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.2, i * 0.12)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.35, 0.2, i * 0.22)); },
};

// Einfache Hintergrundmusik: Bass, Akkorde und Schlagzeug, wird mit der Zeit intensiver.
const Music = {
  playing: false, step: 0, nextT: 0, timer: 0, intensity: 0,
  bpm: 128,
  bass: [45, 45, 52, 45, 48, 48, 43, 43, 41, 41, 48, 41, 43, 43, 50, 47],
  lead: [69, 0, 72, 0, 76, 74, 72, 0, 67, 0, 69, 72, 71, 0, 67, 0],
  init() { /* Kontext wird von Sound erstellt */ },
  start() {
    if (!Sound.ctx || this.playing) return;
    this.playing = true; this.step = 0; this.nextT = Sound.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 60);
  },
  stop() { this.playing = false; clearInterval(this.timer); },
  midi(n) { return 440 * Math.pow(2, (n - 69) / 12); },
  note(type, freq, t, dur, vol) {
    const ctx = Sound.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(Sound.musicGain); o.start(t); o.stop(t + dur + 0.05);
  },
  drum(kind, t) {
    const ctx = Sound.ctx;
    if (kind === 'kick') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.7, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g); g.connect(Sound.musicGain); o.start(t); o.stop(t + 0.2);
    } else {
      const s = ctx.createBufferSource(); s.buffer = Sound.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kind === 'hat' ? 7000 : 1500;
      const g = ctx.createGain(); const d = kind === 'hat' ? 0.04 : 0.14;
      g.gain.setValueAtTime(kind === 'hat' ? 0.12 : 0.3, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
      s.connect(f); f.connect(g); g.connect(Sound.musicGain); s.start(t); s.stop(t + d + 0.02);
    }
  },
  schedule() {
    if (!this.playing || !Sound.ctx) return;
    const ctx = Sound.ctx, stepDur = 60 / this.bpm / 4;
    if (this.nextT < ctx.currentTime - 0.5) this.nextT = ctx.currentTime + 0.05; // nach Pause
    while (this.nextT < ctx.currentTime + 0.2) {
      const s = this.step % 16, t = this.nextT, bar = Math.floor(this.step / 16) % 4;
      const tr = bar === 2 ? 3 : bar === 3 ? -2 : 0;
      if (s % 2 === 0) this.note('triangle', this.midi(this.bass[s] + tr), t, stepDur * 1.8, 0.22);
      if (s % 4 === 0) this.drum('kick', t);
      if (this.intensity >= 1 && (s === 4 || s === 12)) this.drum('snare', t);
      if (this.intensity >= 1 && s % 2 === 1) this.drum('hat', t);
      if (this.intensity >= 2 && this.lead[s]) this.note('square', this.midi(this.lead[s] + tr), t, stepDur * 1.5, 0.05);
      if (this.intensity >= 3 && s % 4 === 2) this.drum('kick', t);
      this.nextT += stepDur; this.step++;
    }
  },
};

function vibrate(ms) {
  if (!Settings.vibrate) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch (_) { /* nicht unterstützt */ }
}
