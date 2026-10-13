'use strict';
// Rumms! – Spielwelt: Gelände, Teiche, Gras, Bäume, Ruinen, Hindernisse, Truhen und Schreine.

const W = {
  renderer: null, scene: null, camera: null,
  obstacles: [], obsGrid: null, obsCell: 8, obsN: 0,
  clouds: [], windMats: [],
};

function initWorld(canvas) {
  setupRenderer(canvas);
  const scene = new THREE.Scene();
  W.scene = scene;
  scene.fog = new THREE.Fog(new THREE.Color(0xc4e3f7), 60, 185);
  W.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 270);
  GFX.dotTex = softDotTexture();
  GFX.slashTex = slashTexture();
  setupLights(scene);
  W.sky = buildSkyDome(scene);
  buildClouds();
  buildTerrain();
  buildWater();
  buildDecorations();
  buildGrass();
  if (GFX.bloom) Post.init();
}

// ---------- Hilfen für Modelle aus Grundformen ----------
function part(g, geo, material, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, material);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  m.castShadow = GFX.shadows;
  g.add(m);
  return m;
}
const box = (g, material, w, h, d, x, y, z, rx, ry, rz) => part(g, GEO.rbox, material, w, h, d, x, y, z, rx, ry, rz);
const shape = part;

// Wolken: alle Wolkenballen in einem einzigen InstancedMesh
function buildClouds() {
  const cloudMat = mat({ color: 0xffffff, emissive: 0xb9cde0, emissiveIntensity: 0.55, rough: 1 });
  cloudMat.fog = false;
  const rng = mulberry32(77), puffs = [];
  for (let i = 0; i < 16; i++) {
    const n = 4 + Math.floor(rng() * 4);
    const a = rng() * TAU, d = 120 + rng() * 60;
    const cx = Math.cos(a) * d, cy = 62 + rng() * 25, cz = Math.sin(a) * d;
    for (let k = 0; k < n; k++) {
      const s = 8 + rng() * 9;
      puffs.push({ x: cx + (k - n / 2) * 7 + rng() * 4, y: cy + (rng() - 0.3) * 4, z: cz + (rng() - 0.5) * 8, sx: s * 1.3, sy: s * 0.75, sz: s, sp: 0.6 + (i % 5) * 0.2 });
    }
  }
  const m = new THREE.InstancedMesh(GEO.ball2, cloudMat, puffs.length);
  m.frustumCulled = false;
  W.scene.add(m);
  W.cloudMesh = m; W.cloudPuffs = puffs;
  moveClouds(0);
}
function moveClouds(dt) {
  const m = W.cloudMesh, d = Instancer.dummy;
  if (!m) return;
  W.cloudPuffs.forEach((p, i) => {
    p.x += p.sp * dt;
    if (p.x > 200) p.x = -200;
    d.position.set(p.x, p.y, p.z); d.rotation.set(0, 0, 0); d.scale.set(p.sx, p.sy, p.sz);
    d.updateMatrix();
    m.setMatrixAt(i, d.matrix);
  });
  m.instanceMatrix.needsUpdate = true;
}

// ---------- Gelände ----------
function groundColor(x, y, z, ny, c) {
  const WL = CONFIG.WATER_LEVEL;
  const n1 = Math.sin(x * 0.07 + Math.cos(z * 0.05) * 2.2) * 0.5 + 0.5;
  const n2 = Math.sin(z * 0.13 - x * 0.04 + Math.sin(x * 0.09)) * 0.5 + 0.5;
  c.setRGB(0, 0, 0);
  const deep = TC.grassDeep, mid = TC.grassMid, light = TC.grassLight;
  c.copy(deep).lerp(mid, n1);
  c.lerp(light, smoothstep(0.5, 4.5, y) * 0.65 + n2 * 0.15);
  if (Math.sin(x * 0.19) * Math.sin(z * 0.17) > 0.62) c.lerp(TC.meadow, 0.45);
  const d = Math.hypot(x, z);
  if (d < 8) c.lerp(TC.dirt, 0.45 * smoothstep(8, 3, d));
  const path = Math.abs(Math.sin(x * 0.035) * 30 - z);
  if (path < 2.6 && Math.max(Math.abs(x), Math.abs(z)) < CONFIG.MAP_HALF) c.lerp(TC.dirt, 0.75 * smoothstep(2.6, 0.8, path));
  if (y < WL + 0.45) c.lerp(TC.sand, smoothstep(WL + 0.45, WL + 0.05, y));
  if (y < WL - 0.1) c.lerp(TC.lakeBed, smoothstep(WL - 0.1, WL - 0.8, y));
  c.lerp(TC.rock, smoothstep(0.86, 0.7, ny) * 0.9);
  const e = Math.max(Math.abs(x), Math.abs(z));
  c.lerp(TC.rock, smoothstep(CONFIG.MAP_HALF + 14, CONFIG.MAP_HALF + 26, e) * 0.6);
  if (y > 15) c.lerp(TC.snow, smoothstep(15, 19, y));
  return c;
}
const TC = {
  grassDeep: new THREE.Color(0x3f8f34), grassMid: new THREE.Color(0x5cad3f), grassLight: new THREE.Color(0x92cc55),
  meadow: new THREE.Color(0xb8cf5c), dirt: new THREE.Color(0xc59a62), sand: new THREE.Color(0xe2cf96),
  lakeBed: new THREE.Color(0x6f8a5a), rock: new THREE.Color(0x8f8a7e), snow: new THREE.Color(0xf4f7fb),
};

function buildTerrain() {
  const half = CONFIG.WORLD_HALF, seg = 160;
  const geo = new THREE.PlaneGeometry(half * 2, half * 2, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal;
  const col = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    groundColor(p.getX(i), p.getY(i), p.getZ(i), nrm.getY(i), c);
    const v = 0.96 + (((Math.sin(i * 12.9898) * 43758.5453) % 1) + 1) % 1 * 0.06;
    col[i * 3] = c.r * v; col[i * 3 + 1] = c.g * v; col[i * 3 + 2] = c.b * v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = mat({ vertexColors: true, map: groundDetailTexture(), rough: 0.96 });
  const mesh = new THREE.Mesh(geo, m);
  mesh.receiveShadow = GFX.shadows;
  W.scene.add(mesh);
  W.terrain = mesh;
}

// ---------- Teiche ----------
function buildWater() {
  const WL = CONFIG.WATER_LEVEL, H = CONFIG.MAP_HALF + 6, cell = 1.6;
  const n = Math.ceil((H * 2) / cell);
  const pos = [], depth = [], idx = [];
  const vid = new Map();
  const vert = (i, j) => {
    const k = i * (n + 1) + j;
    if (vid.has(k)) return vid.get(k);
    const x = -H + i * cell, z = -H + j * cell;
    pos.push(x, WL, z); depth.push(WL - groundHeight(x, z));
    vid.set(k, pos.length / 3 - 1);
    return pos.length / 3 - 1;
  };
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const x = -H + i * cell, z = -H + j * cell;
      const lo = Math.min(groundHeight(x, z), groundHeight(x + cell, z), groundHeight(x, z + cell), groundHeight(x + cell, z + cell));
      if (lo > WL + 0.05) continue;
      const a = vert(i, j), b = vert(i + 1, j), c = vert(i, j + 1), d = vert(i + 1, j + 1);
      idx.push(a, c, b, b, c, d);
    }
  }
  if (!idx.length) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('depth', new THREE.Float32BufferAttribute(depth, 1));
  geo.setIndex(idx);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: Object.assign({}, THREE.UniformsLib.fog, { uTime: GFX.timeUniform, sunDir: { value: GFX.sunDir } }),
    vertexShader: `attribute float depth; varying float vDepth; varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main(){ vDepth = depth; vec4 wp = modelMatrix * vec4(position, 1.0); vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uTime; uniform vec3 sunDir; varying float vDepth; varying vec3 vWorld;
      #include <fog_pars_fragment>
      void main(){
        float d = vDepth;
        if (d < -0.02) discard;
        vec3 shallow = vec3(0.16, 0.55, 0.62), deep = vec3(0.03, 0.2, 0.36);
        vec3 c = mix(shallow, deep, smoothstep(0.0, 1.1, d));
        float w1 = sin(vWorld.x * 0.9 + uTime * 1.3) * sin(vWorld.z * 0.8 - uTime * 1.1);
        float w2 = sin((vWorld.x + vWorld.z) * 1.7 + uTime * 2.1) * 0.5;
        vec3 n = normalize(vec3((w1 + w2) * 0.09, 1.0, (w1 - w2) * 0.07));
        vec3 v = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        c = mix(c, vec3(0.3, 0.55, 0.82), fres * 0.45);
        float spec = pow(max(dot(reflect(-sunDir, n), v), 0.0), 90.0);
        c += vec3(1.0, 0.94, 0.8) * spec * 1.6;
        float foam = smoothstep(0.16, 0.0, d) * (0.65 + 0.35 * sin(uTime * 2.2 + vWorld.x * 2.1 + vWorld.z * 1.4));
        c = mix(c, vec3(0.95, 0.98, 1.0), foam * 0.85);
        float a = mix(0.5, 0.86, smoothstep(0.0, 0.9, d));
        gl_FragColor = vec4(c, max(a, foam) * smoothstep(-0.02, 0.04, d));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.renderOrder = 3;
  W.scene.add(mesh);
  W.water = mesh;
}
function inWater(x, z) { return groundHeight(x, z) < CONFIG.WATER_LEVEL - 0.05; }

// ---------- Gras: wandert mit dem Spieler mit, wiegt sich im Wind, weicht aus ----------
function buildGrass() {
  const count = QUALITY[Settings.quality].grass;
  if (!count) return;
  const size = Settings.quality === 'high' ? 58 : 48;
  const blade = new THREE.BufferGeometry();
  const bw = 0.11;
  const bp = [-bw, 0, 0, bw, 0, 0, -bw * 0.8, 0.4, 0, bw * 0.8, 0.4, 0, -bw * 0.45, 0.75, 0, bw * 0.45, 0.75, 0, 0, 1, 0];
  blade.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3));
  blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4, 4, 3, 5, 4, 5, 6]);
  const geo = new THREE.InstancedBufferGeometry();
  geo.index = blade.index;
  geo.setAttribute('position', blade.attributes.position);
  const off = new Float32Array(count * 2), scl = new Float32Array(count), ang = new Float32Array(count), tint = new Float32Array(count);
  const rng = mulberry32(99);
  let i = 0;
  while (i < count) {
    const cx = rng() * size, cz = rng() * size, n = 4 + Math.floor(rng() * 8), cr = 0.4 + rng() * 0.9, t = rng();
    for (let k = 0; k < n && i < count; k++, i++) {
      const a = rng() * TAU, r = Math.sqrt(rng()) * cr;
      off[i * 2] = cx + Math.cos(a) * r; off[i * 2 + 1] = cz + Math.sin(a) * r;
      scl[i] = 0.32 + rng() * 0.32; ang[i] = rng() * Math.PI; tint[i] = clamp(t + (rng() - 0.5) * 0.3, 0, 1);
    }
  }
  geo.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 2));
  geo.setAttribute('aScale', new THREE.InstancedBufferAttribute(scl, 1));
  geo.setAttribute('aAngle', new THREE.InstancedBufferAttribute(ang, 1));
  geo.setAttribute('aTint', new THREE.InstancedBufferAttribute(tint, 1));
  geo.instanceCount = count;
  const glslGround = `
    float groundH(vec2 p) {
      float x = p.x, z = p.y;
      float h = sin(x * 0.045) * cos(z * 0.05) * 2.4 + sin(x * 0.11 + 1.3) * sin(z * 0.09 + 0.7) * 1.1
        + sin((x + z) * 0.024) * 1.6 + cos(x * 0.021 - z * 0.033) * 1.4;
      h *= 0.25 + 0.75 * smoothstep(5.0, 26.0, length(p));
      float e = max(abs(x), abs(z));
      h += smoothstep(${(CONFIG.MAP_HALF - 2).toFixed(1)}, ${(CONFIG.MAP_HALF + 30).toFixed(1)}, e) * 20.0;
      float wl = ${CONFIG.WATER_LEVEL.toFixed(2)};
      if (h < wl) h = wl - (wl - h) * 0.3;
      return h;
    }`;
  const m = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, fog: true,
    uniforms: Object.assign({}, THREE.UniformsLib.fog, {
      uTime: GFX.timeUniform, uCenter: { value: new THREE.Vector2() }, uPlayer: { value: new THREE.Vector3(0, -99, 0) },
      uSize: { value: size }, uLight: { value: 1.0 },
    }),
    vertexShader: `uniform float uTime; uniform vec2 uCenter; uniform vec3 uPlayer; uniform float uSize;
      attribute vec2 aOffset; attribute float aScale; attribute float aAngle; attribute float aTint;
      varying float vH; varying float vTint; varying float vShade;
      #include <fog_pars_vertex>
      ${glslGround}
      void main(){
        vec2 rel = mod(aOffset - uCenter + uSize * 0.5, uSize) - uSize * 0.5;
        vec2 wp = uCenter + rel;
        float fade = smoothstep(uSize * 0.5, uSize * 0.5 - 7.0, length(rel));
        fade *= smoothstep(1.0, 2.6, abs(sin(wp.x * 0.035) * 30.0 - wp.y));
        fade *= smoothstep(6.0, 11.0, length(wp));
        float gh = groundH(wp);
        fade *= smoothstep(${(CONFIG.WATER_LEVEL + 0.1).toFixed(2)}, ${(CONFIG.WATER_LEVEL + 0.5).toFixed(2)}, gh);
        fade *= step(max(abs(wp.x), abs(wp.y)), ${(CONFIG.MAP_HALF + 3).toFixed(1)});
        float h = aScale * fade;
        float c = cos(aAngle), s = sin(aAngle);
        vec3 p = vec3(position.x * c * (0.4 + fade * 0.6), position.y * h, position.x * s * (0.4 + fade * 0.6));
        float bend = position.y * position.y;
        float wind = sin(uTime * 1.7 + wp.x * 0.33 + wp.y * 0.21) * 0.6 + sin(uTime * 3.3 + wp.x * 0.8) * 0.2;
        p.x += wind * 0.22 * bend * h;
        p.z += wind * 0.08 * bend * h;
        vec2 away = wp - uPlayer.xz; float ad = length(away);
        float push = smoothstep(1.3, 0.15, ad) * step(uPlayer.y - gh, 1.2);
        p.xz += (away / max(ad, 0.001)) * push * 0.5 * bend * h;
        p.y *= 1.0 - push * 0.45;
        vec3 world = vec3(wp.x, gh - 0.02, wp.y) + p;
        vH = position.y; vTint = aTint; vShade = 0.85 + 0.15 * sin(wp.x * 0.07 + cos(wp.y * 0.05) * 2.2);
        vec4 mvPosition = viewMatrix * vec4(world, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform float uLight; varying float vH; varying float vTint; varying float vShade;
      #include <fog_pars_fragment>
      void main(){
        vec3 base = mix(vec3(0.035, 0.14, 0.02), vec3(0.06, 0.2, 0.025), vTint);
        vec3 tip = mix(vec3(0.15, 0.4, 0.05), vec3(0.28, 0.5, 0.07), vTint);
        vec3 c = mix(base, tip, smoothstep(0.0, 1.0, vH)) * uLight * vShade;
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, m);
  mesh.frustumCulled = false;
  W.scene.add(mesh);
  W.grass = mesh;
}
function updateGrass(x, z, py) {
  if (!W.grass) return;
  const u = W.grass.material.uniforms;
  u.uCenter.value.set(x, z);
  u.uPlayer.value.set(x, py, z);
}

// ---------- Hindernisse ----------
function addObstacle(x, z, r, h) { W.obstacles.push({ x, z, r, h }); }

function buildObstacleGrid() {
  const cell = W.obsCell, n = Math.ceil((CONFIG.WORLD_HALF * 2) / cell);
  W.obsN = n;
  W.obsGrid = Array.from({ length: n * n }, () => []);
  W.obstacles.forEach((o, idx) => {
    const x0 = Math.floor((o.x - o.r + CONFIG.WORLD_HALF) / cell), x1 = Math.floor((o.x + o.r + CONFIG.WORLD_HALF) / cell);
    const z0 = Math.floor((o.z - o.r + CONFIG.WORLD_HALF) / cell), z1 = Math.floor((o.z + o.r + CONFIG.WORLD_HALF) / cell);
    for (let gx = x0; gx <= x1; gx++) for (let gz = z0; gz <= z1; gz++) {
      if (gx >= 0 && gz >= 0 && gx < n && gz < n) W.obsGrid[gz * n + gx].push(idx);
    }
  });
}

// Schiebt ein Objekt (x, z, Radius) aus Bäumen und Felsen heraus.
// feet: Höhe der Füße über dem Boden; wer höher springt als ein Fels, fliegt drüber.
function pushOutOfObstacles(o, radius, feet) {
  const cell = W.obsCell, n = W.obsN;
  const gx = Math.floor((o.x + CONFIG.WORLD_HALF) / cell), gz = Math.floor((o.z + CONFIG.WORLD_HALF) / cell);
  if (gx < 0 || gz < 0 || gx >= n || gz >= n) return false;
  const list = W.obsGrid[gz * n + gx];
  let hit = false;
  for (let i = 0; i < list.length; i++) {
    const ob = W.obstacles[list[i]];
    if (feet > ob.h) continue;
    const dx = o.x - ob.x, dz = o.z - ob.z, rr = ob.r + radius;
    const d2 = dx * dx + dz * dz;
    if (d2 < rr * rr && d2 > 1e-6) {
      const d = Math.sqrt(d2), push = (rr - d) / d;
      o.x += dx * push; o.z += dz * push; hit = true;
    }
  }
  return hit;
}

function obstacleFree(x, z, r) {
  for (const o of W.obstacles) if ((o.x - x) ** 2 + (o.z - z) ** 2 < (o.r + r) ** 2) return false;
  return true;
}

// ---------- Deko ----------
// Jede Deko-Art wird in Bereiche von 70 × 70 aufgeteilt, damit nur sichtbare Bereiche
// gezeichnet werden. Schatten werfen nur die Exemplare in der Nähe des Spielers
// (eigene, unsichtbare Kopie, die regelmäßig neu befüllt wird).
const DECO_CHUNK = 70;
const Deco = { types: [], lastX: 1e9, lastZ: 1e9 };
function decoMesh(geo, material, cap, shadow) {
  const t = { geo, material, cap, shadow: shadow && GFX.shadows, items: [], count: 0, shadowMesh: null };
  Deco.types.push(t);
  return t;
}
function decoAdd(t, x, y, z, ry, sx, sy, sz, color) {
  if (t.count >= t.cap) return;
  t.items.push({ x, y, z, ry, sx, sy, sz, c: color ? color.clone() : null });
  t.count++;
}
function decoFill(m, list) {
  const d = Instancer.dummy;
  list.forEach((it, i) => {
    d.position.set(it.x, it.y, it.z); d.rotation.set(0, it.ry, 0); d.scale.set(it.sx, it.sy, it.sz);
    d.updateMatrix();
    m.setMatrixAt(i, d.matrix);
    if (it.c) m.setColorAt(i, it.c);
  });
  m.count = list.length;
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
}
function finalizeDeco() {
  for (const t of Deco.types) {
    const buckets = new Map();
    for (const it of t.items) {
      const k = Math.floor((it.x + CONFIG.WORLD_HALF) / DECO_CHUNK) + '_' + Math.floor((it.z + CONFIG.WORLD_HALF) / DECO_CHUNK);
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(it);
    }
    for (const list of buckets.values()) {
      const m = new THREE.InstancedMesh(t.geo, t.material, list.length);
      decoFill(m, list);
      m.computeBoundingSphere();
      m.castShadow = false;
      W.scene.add(m);
    }
    if (t.shadow) {
      const sm = new THREE.InstancedMesh(t.geo, new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }), 140);
      sm.castShadow = true; sm.frustumCulled = false; sm.count = 0;
      sm.customDepthMaterial = undefined;
      W.scene.add(sm);
      t.shadowMesh = sm;
    }
  }
}
function updateDecoShadows(x, z) {
  if (!GFX.shadows || (x - Deco.lastX) ** 2 + (z - Deco.lastZ) ** 2 < 36) return;
  Deco.lastX = x; Deco.lastZ = z;
  for (const t of Deco.types) {
    if (!t.shadowMesh) continue;
    const near = [];
    for (const it of t.items) if ((it.x - x) ** 2 + (it.z - z) ** 2 < 46 * 46 && near.length < 140) near.push(it);
    decoFill(t.shadowMesh, near);
  }
}

function buildDecorations() {
  const rng = mulberry32(1337);
  const H = CONFIG.MAP_HALF, WL = CONFIG.WATER_LEVEL;
  const dry = (x, z, m = 0.35) => groundHeight(x, z) > WL + m;
  const free = (x, z, r) => Math.hypot(x, z) > 14 && obstacleFree(x, z, r) && dry(x, z);
  const vc = (o = {}) => mat(Object.assign({ vertexColors: true }, o));
  const tint = new THREE.Color();
  const jitter = (base) => tint.setRGB(base * (0.85 + rng() * 0.3), base * (0.88 + rng() * 0.24), base * (0.85 + rng() * 0.3));

  // Ruinen: Säulenkreise als Orientierungspunkte.
  const pillarGeo = mergeParts([
    { geo: GEO.rbox, color: 0xb3ab9a, pos: [0, 0.3, 0], scale: [1.6, 0.6, 1.6] },
    { geo: GEO.cyl12, color: 0xddd5c3, pos: [0, 2.25, 0], scale: [1.05, 3.5, 1.05] },
    { geo: GEO.cyl12, color: 0xcfc7b4, pos: [0, 0.75, 0], scale: [1.25, 0.3, 1.25] },
    { geo: GEO.rbox, color: 0xb3ab9a, pos: [0, 4.15, 0], scale: [1.5, 0.45, 1.5] },
    { geo: GEO.ball, color: 0x6fa34a, pos: [0.45, 4.42, 0.2], scale: [0.9, 0.35, 0.8] },
  ]);
  const ruins = [];
  for (let k = 0; k < 7; k++) {
    for (let tries = 0; tries < 60; tries++) {
      const x = (rng() * 2 - 1) * (H - 16), z = (rng() * 2 - 1) * (H - 16);
      if (Math.hypot(x, z) > 30 && dry(x, z, 1) && ruins.every((r) => Math.hypot(r[0] - x, r[1] - z) > 40)) { ruins.push([x, z]); break; }
    }
  }
  const pillarMat = vc({ rough: 0.9 });
  addWind(pillarMat, 0);
  const pillars = decoMesh(pillarGeo, pillarMat, ruins.length * 7, true);
  for (const [cx, cz] of ruins) {
    const n = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      if (rng() < 0.2) continue;
      const a = (i / n) * TAU, x = cx + Math.cos(a) * 6, z = cz + Math.sin(a) * 6;
      if (!dry(x, z)) continue;
      const broken = rng() < 0.4 ? 0.45 + rng() * 0.3 : 1;
      decoAdd(pillars, x, groundHeight(x, z) - 0.15, z, rng() * TAU, 1, broken, 1);
      addObstacle(x, z, 0.75, 4.2 * broken);
    }
  }
  W.ruins = ruins;

  // Bäume (wiegen sich im Wind)
  const pineGeo = mergeParts([
    { geo: GEO.cyl12, color: 0x7a4f2a, pos: [0, 0.9, 0], scale: [0.45, 1.8, 0.45] },
    { geo: GEO.cone12, color: 0x2c7a3f, pos: [0, 2.3, 0], scale: [2.8, 2.2, 2.8] },
    { geo: GEO.cone12, color: 0x379048, pos: [0, 3.4, 0], scale: [2.2, 2.0, 2.2] },
    { geo: GEO.cone12, color: 0x45a556, pos: [0, 4.4, 0], scale: [1.5, 1.7, 1.5] },
  ]);
  const roundGeo = mergeParts([
    { geo: GEO.cyl12, color: 0x86592f, pos: [0, 1.0, 0], scale: [0.5, 2.0, 0.5] },
    { geo: GEO.ball1, color: 0x4f9e3c, pos: [0, 2.9, 0], scale: [3.0, 2.5, 3.0] },
    { geo: GEO.ball1, color: 0x63b447, pos: [0.7, 3.5, 0.4], scale: [2.0, 1.7, 2.0] },
    { geo: GEO.ball1, color: 0x5aa842, pos: [-0.7, 3.3, -0.5], scale: [1.8, 1.6, 1.8] },
    { geo: GEO.ball1, color: 0x76c255, pos: [0.1, 4.0, -0.1], scale: [1.4, 1.2, 1.4] },
  ]);
  const bushGeo = mergeParts([
    { geo: GEO.ball1, color: 0x4f9e3c, pos: [0, 0.45, 0], scale: [1.4, 1.0, 1.3] },
    { geo: GEO.ball1, color: 0x63b447, pos: [0.5, 0.55, 0.2], scale: [0.9, 0.8, 0.9] },
    { geo: GEO.ball1, color: 0x5aa842, pos: [-0.45, 0.4, -0.25], scale: [0.9, 0.7, 0.8] },
  ]);
  const pineMat = vc({ rough: 0.9 }), roundMat = vc({ rough: 0.85 }), bushMat = vc({ rough: 0.85 });
  addWind(pineMat, 0.035); addWind(roundMat, 0.045); addWind(bushMat, 0.02);
  const pines = decoMesh(pineGeo, pineMat, 460, true);
  const rounds = decoMesh(roundGeo, roundMat, 220, true);
  const bushes = decoMesh(bushGeo, bushMat, 260, true);
  const placeTree = (x, z, collide) => {
    const s = 0.8 + rng() * 0.6, y = groundHeight(x, z) - 0.2;
    if (rng() < 0.55 || !collide) decoAdd(pines, x, y, z, rng() * TAU, s, s * (0.9 + rng() * 0.3), s, jitter(1));
    else decoAdd(rounds, x, y, z, rng() * TAU, s, s * (0.9 + rng() * 0.25), s, jitter(1));
    if (collide) addObstacle(x, z, 0.42 * s + 0.15, 99);
  };
  for (let k = 0; k < 16; k++) {
    const cx = (rng() * 2 - 1) * (H - 10), cz = (rng() * 2 - 1) * (H - 10);
    if (Math.hypot(cx, cz) < 28) continue;
    const n = 5 + Math.floor(rng() * 7);
    for (let i = 0; i < n; i++) {
      const x = cx + (rng() * 2 - 1) * 9, z = cz + (rng() * 2 - 1) * 9;
      if (Math.abs(x) < H - 3 && Math.abs(z) < H - 3 && free(x, z, 2.2)) placeTree(x, z, true);
    }
  }
  for (let i = 0; i < 100; i++) {
    const x = (rng() * 2 - 1) * (H - 4), z = (rng() * 2 - 1) * (H - 4);
    if (free(x, z, 3)) placeTree(x, z, true);
  }
  for (let i = 0; i < 280; i++) {
    const side = Math.floor(rng() * 4), t = (rng() * 2 - 1) * (CONFIG.WORLD_HALF - 6);
    const off = H + 6 + rng() * 26;
    const x = side === 0 ? off : side === 1 ? -off : t, z = side === 2 ? off : side === 3 ? -off : t;
    if (groundHeight(x, z) < 14) placeTree(x, z, false);
  }
  for (let i = 0; i < 400 && bushes.count < 240; i++) {
    const x = (rng() * 2 - 1) * (H - 3), z = (rng() * 2 - 1) * (H - 3);
    if (!free(x, z, 1.2)) continue;
    const s = 0.7 + rng() * 0.7;
    decoAdd(bushes, x, groundHeight(x, z) - 0.1, z, rng() * TAU, s, s * (0.8 + rng() * 0.4), s, jitter(1));
  }

  // Felsen (kleine kann man überspringen)
  const rockGeo = mergeParts([
    { geo: GEO.dodeca, color: 0x9a958a, pos: [0, 0.35, 0], scale: [2, 1.5, 1.8], flat: true },
    { geo: GEO.dodeca, color: 0x8a857a, pos: [0.6, 0.2, 0.4], scale: [1.1, 0.9, 1.0], flat: true },
    { geo: GEO.ball, color: 0x6fa34a, pos: [-0.1, 0.95, 0], scale: [1.3, 0.35, 1.1], flat: true },
  ]);
  const rockMat = vc({ rough: 0.95, flat: true });
  addWind(rockMat, 0);
  const rocks = decoMesh(rockGeo, rockMat, 90, true);
  for (let i = 0; i < 500 && rocks.count < 90; i++) {
    const x = (rng() * 2 - 1) * (H - 4), z = (rng() * 2 - 1) * (H - 4);
    const s = 0.5 + rng() * rng() * 1.6;
    if (!free(x, z, s + 1.5)) continue;
    decoAdd(rocks, x, groundHeight(x, z) - 0.15, z, rng() * TAU, s, s, s, jitter(1));
    addObstacle(x, z, s * 0.95, s * 1.1);
  }

  // Blumen, Pilze und Schilf (ohne Kollision)
  const flowerGeo = mergeParts([
    { geo: GEO.cone, color: 0x3f8f34, pos: [0, 0.2, 0], scale: [0.06, 0.4, 0.06] },
    { geo: GEO.ball, color: 0xffffff, pos: [0, 0.45, 0], scale: [0.32, 0.12, 0.32] },
    { geo: GEO.ball, color: 0xffd23f, pos: [0, 0.5, 0], scale: [0.13, 0.1, 0.13] },
  ]);
  const flowers = decoMesh(flowerGeo, vc({ rough: 0.7 }), 520, false);
  const fcols = [0xff6b9a, 0xffffff, 0xb28dff, 0xffd166, 0x6ec6ff, 0xff8a5a].map((h) => new THREE.Color(h));
  for (let i = 0; i < 160; i++) {
    const cx = (rng() * 2 - 1) * H, cz = (rng() * 2 - 1) * H;
    if (!dry(cx, cz, 0.5)) continue;
    const col = fcols[Math.floor(rng() * fcols.length)];
    for (let k = 0; k < 4; k++) {
      const x = cx + (rng() - 0.5) * 3, z = cz + (rng() - 0.5) * 3;
      decoAdd(flowers, x, groundHeight(x, z), z, rng() * TAU, 1, 0.8 + rng() * 0.5, 1, col);
    }
  }
  const shroomGeo = mergeParts([
    { geo: GEO.cyl12, color: 0xf3ead2, pos: [0, 0.18, 0], scale: [0.14, 0.36, 0.14] },
    { geo: GEO.ball1, color: 0xe2453f, pos: [0, 0.38, 0], scale: [0.42, 0.26, 0.42] },
    { geo: GEO.ball, color: 0xffffff, pos: [0.1, 0.48, 0.08], scale: [0.08, 0.05, 0.08] },
    { geo: GEO.ball, color: 0xffffff, pos: [-0.1, 0.46, -0.06], scale: [0.07, 0.05, 0.07] },
  ]);
  const shrooms = decoMesh(shroomGeo, vc({ rough: 0.6 }), 120, false);
  for (let i = 0; i < 60; i++) {
    const cx = (rng() * 2 - 1) * H, cz = (rng() * 2 - 1) * H;
    if (!dry(cx, cz)) continue;
    for (let k = 0; k < 2; k++) {
      const x = cx + (rng() - 0.5) * 1.5, z = cz + (rng() - 0.5) * 1.5, s = 0.7 + rng() * 0.8;
      decoAdd(shrooms, x, groundHeight(x, z), z, rng() * TAU, s, s, s);
    }
  }
  const reedGeo = mergeParts([
    { geo: GEO.cone, color: 0x5d8a3a, pos: [0, 0.6, 0], scale: [0.08, 1.2, 0.08] },
    { geo: GEO.cone, color: 0x6e9a42, pos: [0.15, 0.5, 0.05], scale: [0.07, 1.0, 0.07], rot: [0, 0, -0.15] },
    { geo: GEO.cone, color: 0x6e9a42, pos: [-0.12, 0.45, -0.05], scale: [0.07, 0.9, 0.07], rot: [0, 0, 0.18] },
    { geo: GEO.capsule, color: 0x7a5232, pos: [0, 1.15, 0], scale: [0.07, 0.12, 0.07] },
  ]);
  const reedMat = vc({ rough: 0.9 });
  addWind(reedMat, 0.12);
  const reeds = decoMesh(reedGeo, reedMat, 260, false);
  for (let i = 0; i < 8000 && reeds.count < 250; i++) {
    const x = (rng() * 2 - 1) * H, z = (rng() * 2 - 1) * H;
    const y = groundHeight(x, z);
    if (y < WL - 0.25 || y > WL + 0.35) continue;
    decoAdd(reeds, x, y - 0.1, z, rng() * TAU, 1, 0.8 + rng() * 0.6, 1);
  }

  finalizeDeco();
  buildObstacleGrid();
}

// ---------- Truhen und Schreine ----------
const ChestParts = {};
function buildChest(free) {
  const g = new THREE.Group();
  if (!ChestParts.mat) {
    ChestParts.mat = mat({ vertexColors: true, rough: 0.55, metal: 0.25, rim: 0.2 });
    ChestParts.glowGeo = new THREE.CylinderGeometry(0.9, 0.9, 7, 16, 1, true);
    const lidGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 16, 1, false, 0, Math.PI);
    const R = Math.PI / 2;
    const mk = (wood) => ({
      body: mergeParts([
        { geo: GEO.rbox, color: wood, pos: [0, 0.38, 0], scale: [1.3, 0.75, 0.9] },
        { geo: GEO.rbox, color: 0x3a2412, pos: [0, 0.78, 0], scale: [1.2, 0.08, 0.8] },
        { geo: GEO.rbox, color: 0xffcf4a, pos: [-0.42, 0.4, 0], scale: [0.14, 0.8, 0.96] },
        { geo: GEO.rbox, color: 0xffcf4a, pos: [0.42, 0.4, 0], scale: [0.14, 0.8, 0.96] },
      ]),
      lid: mergeParts([
        { geo: lidGeo, color: wood, pos: [0, 0, 0.45], scale: [0.9, 1.3, 0.9], rot: [0, 0, R] },
        { geo: lidGeo, color: 0xffcf4a, pos: [-0.42, 0, 0.45], scale: [0.92, 0.14, 0.92], rot: [0, 0, R] },
        { geo: lidGeo, color: 0xffcf4a, pos: [0.42, 0, 0.45], scale: [0.92, 0.14, 0.92], rot: [0, 0, R] },
        { geo: GEO.rbox, color: 0xffcf4a, pos: [0, -0.05, 0.93], scale: [0.24, 0.3, 0.1] },
      ]),
    });
    ChestParts.normal = mk(0xa0612d);
    ChestParts.free = mk(0x7c46d8);
  }
  const geos = free ? ChestParts.free : ChestParts.normal;
  const body = new THREE.Mesh(geos.body, ChestParts.mat); body.castShadow = GFX.shadows; g.add(body);
  const lid = new THREE.Group(); lid.position.set(0, 0.76, -0.45); g.add(lid);
  const lidMesh = new THREE.Mesh(geos.lid, ChestParts.mat); lidMesh.castShadow = GFX.shadows; lid.add(lidMesh);
  const glow = new THREE.Mesh(ChestParts.glowGeo,
    new THREE.MeshBasicMaterial({ color: free ? 0xc58bff : 0xffd75e, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
  glow.position.y = 3.5;
  g.add(glow);
  g.userData = { lid, glow };
  return g;
}

const ShrineParts = {};
function buildShrine() {
  const g = new THREE.Group();
  if (!ShrineParts.geo) {
    const parts = [
      { geo: GEO.cyl12, color: 0xa39b89, pos: [0, 0.2, 0], scale: [2.4, 0.4, 2.4] },
      { geo: GEO.cyl12, color: 0xc4bcaa, pos: [0, 1.05, 0], scale: [1.1, 1.4, 1.1] },
      { geo: GEO.cyl12, color: 0xa39b89, pos: [0, 1.85, 0], scale: [1.4, 0.25, 1.4] },
      { geo: GEO.ball1, color: 0x6fa34a, pos: [0.3, 0.42, 0.4], scale: [1.2, 0.3, 1.0] },
    ];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4, x = Math.cos(a) * 3.4, z = Math.sin(a) * 3.4;
      parts.push({ geo: GEO.rbox, color: 0xc4bcaa, pos: [x, 1.05, z], scale: [0.5, 2.3, 0.5] });
      parts.push({ geo: GEO.rbox, color: 0xa39b89, pos: [x, 2.3, z], scale: [0.7, 0.25, 0.7] });
    }
    ShrineParts.geo = mergeParts(parts);
    ShrineParts.mat = mat({ vertexColors: true, rough: 0.92 });
    ShrineParts.ringGeo = new THREE.RingGeometry(3.25, 3.6, 48);
    ShrineParts.fillGeo = new THREE.CircleGeometry(3.25, 48);
  }
  const base = new THREE.Mesh(ShrineParts.geo, ShrineParts.mat); base.castShadow = GFX.shadows; g.add(base);
  const crystalMat = new THREE.MeshStandardMaterial({ color: 0xc9a6ff, emissive: 0x7a3cf0, emissiveIntensity: 1.4, roughness: 0.2, flatShading: true });
  const crystal = part(g, GEO.oct, crystalMat, 0.9, 1.6, 0.9, 0, 2.9, 0);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xc58bff, transparent: true, opacity: 0.45, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ShrineParts.ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.12;
  g.add(ring);
  const fillMat = new THREE.MeshBasicMaterial({ color: 0xc58bff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  const fill = new THREE.Mesh(ShrineParts.fillGeo, fillMat);
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.14; fill.scale.setScalar(0.001);
  g.add(fill);
  g.userData = { crystal, crystalMat, ring, fill };
  return g;
}
