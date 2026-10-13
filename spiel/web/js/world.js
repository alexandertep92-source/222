'use strict';
// Rumms! – 3D-Welt: Renderer, Licht, Gelände, Deko, Hindernisse und alle Modelle.

const W = {
  renderer: null, scene: null, camera: null,
  obstacles: [], obsGrid: null, obsCell: 8, obsN: 0,
  clouds: [],
};

function initWorld(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: Settings.quality !== 'low', powerPreference: 'high-performance',
  });
  renderer.setClearColor(0x8fd0ff);
  W.renderer = renderer;

  const scene = new THREE.Scene();
  W.scene = scene;
  const horizon = new THREE.Color(0xbfe6ff);
  scene.fog = new THREE.Fog(horizon, 45, 150);
  W.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 420);

  scene.add(new THREE.HemisphereLight(0xdff1ff, 0x55703a, 1.9));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.6);
  sun.position.set(40, 80, 25);
  scene.add(sun);

  buildSky();
  buildTerrain();
  buildDecorations();
}

function buildSky() {
  const geo = new THREE.SphereGeometry(380, 24, 12);
  const col = [], pos = geo.attributes.position;
  const top = new THREE.Color(0x4aa3f0), mid = new THREE.Color(0x9fd6ff), bot = new THREE.Color(0xd8f0ff);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 380;
    if (y > 0.15) c.copy(mid).lerp(top, smoothstep(0.15, 0.8, y)); else c.copy(bot).lerp(mid, smoothstep(-0.1, 0.15, y));
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.renderOrder = -1;
  W.scene.add(sky);
  W.sky = sky;

  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x99aabb, flatShading: true, fog: false });
  const rng = mulberry32(77);
  for (let i = 0; i < 14; i++) {
    const g = new THREE.Group();
    const n = 3 + Math.floor(rng() * 3);
    for (let k = 0; k < n; k++) {
      const m = new THREE.Mesh(GEO.ball, cloudMat);
      const s = 10 + rng() * 10;
      m.scale.set(s * 1.4, s * 0.6, s);
      m.position.set((k - n / 2) * 9 + rng() * 4, rng() * 3, rng() * 6);
      g.add(m);
    }
    const a = rng() * TAU, d = 120 + rng() * 140;
    g.position.set(Math.cos(a) * d, 70 + rng() * 40, Math.sin(a) * d);
    g.userData.speed = 0.6 + rng() * 0.8;
    W.scene.add(g);
    W.clouds.push(g);
  }
}

function buildTerrain() {
  const half = CONFIG.WORLD_HALF, seg = 140;
  let geo = new THREE.PlaneGeometry(half * 2, half * 2, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) p.setY(i, groundHeight(p.getX(i), p.getZ(i)));
  geo = geo.toNonIndexed();
  geo.computeVertexNormals();
  const pa = geo.attributes.position.array;
  const col = new Float32Array(pa.length);
  const grassA = new THREE.Color(0x67c24a), grassB = new THREE.Color(0x4fa83e), grassC = new THREE.Color(0x8ed45a);
  const dirt = new THREE.Color(0xc9a46a), rock = new THREE.Color(0x8c8577), snow = new THREE.Color(0xf4f7fb);
  const c = new THREE.Color();
  for (let i = 0; i < pa.length; i += 9) {
    const x = (pa[i] + pa[i + 3] + pa[i + 6]) / 3, y = (pa[i + 1] + pa[i + 4] + pa[i + 7]) / 3, z = (pa[i + 2] + pa[i + 5] + pa[i + 8]) / 3;
    const n = Math.sin(x * 0.18 + Math.cos(z * 0.13) * 2) + Math.sin(z * 0.21 - x * 0.05);
    c.copy(grassA).lerp(grassB, clamp(n * 0.5 + 0.5, 0, 1));
    if (Math.sin(x * 0.7) * Math.sin(z * 0.6) > 0.55) c.lerp(grassC, 0.5);
    const d = Math.hypot(x, z);
    if (d < 9) c.lerp(dirt, 0.55 * (1 - d / 9));
    const path = Math.abs(Math.sin(x * 0.035) * 30 - z);
    if (path < 2.2 && Math.max(Math.abs(x), Math.abs(z)) < CONFIG.MAP_HALF) c.lerp(dirt, 0.7 * (1 - path / 2.2));
    const e = Math.max(Math.abs(x), Math.abs(z));
    c.lerp(rock, smoothstep(CONFIG.MAP_HALF + 1, CONFIG.MAP_HALF + 9, e));
    if (y > 19) c.lerp(snow, smoothstep(19, 24, y));
    const v = 0.94 + ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1 * 0.08;
    for (let k = 0; k < 3; k++) { col[i + k * 3] = c.r * v; col[i + k * 3 + 1] = c.g * v; col[i + k * 3 + 2] = c.b * v; }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  W.scene.add(mesh);
  W.terrain = mesh;
}

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

function buildDecorations() {
  const rng = mulberry32(1337);
  const H = CONFIG.MAP_HALF;
  const lam = (opts) => new THREE.MeshLambertMaterial(Object.assign({ vertexColors: true, flatShading: true }, opts));
  const dummy = new THREE.Object3D();
  const free = (x, z, r) => Math.hypot(x, z) > 14 && obstacleFree(x, z, r);

  // Ruinen: Säulenkreise als Orientierungspunkte.
  const pillarGeo = mergeParts([
    { geo: GEO.box, color: 0xb9b2a3, pos: [0, 0.25, 0], scale: [1.5, 0.5, 1.5] },
    { geo: GEO.cyl, color: 0xd8d1c0, pos: [0, 2.2, 0], scale: [1, 3.6, 1] },
    { geo: GEO.box, color: 0xb9b2a3, pos: [0, 4.15, 0], scale: [1.4, 0.4, 1.4] },
  ]);
  const ruins = [];
  for (let k = 0; k < 7; k++) {
    for (let tries = 0; tries < 50; tries++) {
      const x = (rng() * 2 - 1) * (H - 16), z = (rng() * 2 - 1) * (H - 16);
      if (Math.hypot(x, z) > 30 && ruins.every((r) => Math.hypot(r[0] - x, r[1] - z) > 40)) { ruins.push([x, z]); break; }
    }
  }
  const pillars = new THREE.InstancedMesh(pillarGeo, lam(), ruins.length * 7);
  let pc = 0;
  for (const [cx, cz] of ruins) {
    const n = 5 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      if (rng() < 0.2) continue;
      const a = (i / n) * TAU, x = cx + Math.cos(a) * 6, z = cz + Math.sin(a) * 6;
      const broken = rng() < 0.4 ? 0.45 + rng() * 0.3 : 1;
      dummy.position.set(x, groundHeight(x, z) - 0.1, z);
      dummy.rotation.set(0, rng() * TAU, 0);
      dummy.scale.set(1, broken, 1);
      dummy.updateMatrix();
      pillars.setMatrixAt(pc++, dummy.matrix);
      addObstacle(x, z, 0.75, 4.2 * broken);
    }
  }
  pillars.count = pc;
  W.scene.add(pillars);
  W.ruins = ruins;

  // Bäume
  const pineGeo = mergeParts([
    { geo: GEO.cyl, color: 0x7a4f2a, pos: [0, 0.8, 0], scale: [0.5, 1.6, 0.5] },
    { geo: GEO.cone, color: 0x2f8a46, pos: [0, 2.4, 0], scale: [2.6, 2.4, 2.6] },
    { geo: GEO.cone, color: 0x3aa356, pos: [0, 3.6, 0], scale: [2.0, 2.0, 2.0] },
    { geo: GEO.cone, color: 0x4dbb63, pos: [0, 4.6, 0], scale: [1.3, 1.5, 1.3] },
  ]);
  const roundGeo = mergeParts([
    { geo: GEO.cyl, color: 0x86592f, pos: [0, 1.0, 0], scale: [0.55, 2.0, 0.55] },
    { geo: GEO.ball, color: 0x5cb84a, pos: [0, 2.9, 0], scale: [3.0, 2.6, 3.0] },
    { geo: GEO.ball, color: 0x74cc58, pos: [0.6, 3.6, 0.3], scale: [1.8, 1.6, 1.8] },
  ]);
  const pines = new THREE.InstancedMesh(pineGeo, lam(), 420);
  const rounds = new THREE.InstancedMesh(roundGeo, lam(), 200);
  let pn = 0, rn = 0;
  const placeTree = (x, z, collide) => {
    const s = 0.8 + rng() * 0.6;
    dummy.position.set(x, groundHeight(x, z) - 0.2, z);
    dummy.rotation.set(0, rng() * TAU, 0);
    dummy.scale.set(s, s * (0.9 + rng() * 0.3), s);
    dummy.updateMatrix();
    if (rng() < 0.55 || !collide) { if (pn < 420) pines.setMatrixAt(pn++, dummy.matrix); } else if (rn < 200) rounds.setMatrixAt(rn++, dummy.matrix);
    if (collide) addObstacle(x, z, 0.45 * s + 0.15, 99);
  };
  // Wäldchen
  for (let k = 0; k < 16; k++) {
    const cx = (rng() * 2 - 1) * (H - 10), cz = (rng() * 2 - 1) * (H - 10);
    if (Math.hypot(cx, cz) < 28) continue;
    const n = 5 + Math.floor(rng() * 7);
    for (let i = 0; i < n; i++) {
      const x = cx + (rng() * 2 - 1) * 9, z = cz + (rng() * 2 - 1) * 9;
      if (Math.abs(x) < H - 3 && Math.abs(z) < H - 3 && free(x, z, 2.2)) placeTree(x, z, true);
    }
  }
  for (let i = 0; i < 90; i++) {
    const x = (rng() * 2 - 1) * (H - 4), z = (rng() * 2 - 1) * (H - 4);
    if (free(x, z, 3)) placeTree(x, z, true);
  }
  // Bäume auf dem Randgebirge (nur Kulisse)
  for (let i = 0; i < 260; i++) {
    const side = Math.floor(rng() * 4), t = (rng() * 2 - 1) * (CONFIG.WORLD_HALF - 6);
    const off = H + 6 + rng() * 26;
    const x = side === 0 ? off : side === 1 ? -off : t, z = side === 2 ? off : side === 3 ? -off : t;
    if (groundHeight(x, z) < 19) placeTree(x, z, false);
  }
  pines.count = pn; rounds.count = rn;
  W.scene.add(pines, rounds);

  // Felsen (kleine kann man überspringen)
  const rockGeo = mergeParts([
    { geo: GEO.dodeca, color: 0x9a9488, pos: [0, 0.35, 0], scale: [2, 1.5, 1.8] },
    { geo: GEO.dodeca, color: 0x8a8478, pos: [0.6, 0.2, 0.4], scale: [1.1, 0.9, 1.0] },
  ]);
  const rocks = new THREE.InstancedMesh(rockGeo, lam(), 90);
  let rc = 0;
  for (let i = 0; i < 400 && rc < 90; i++) {
    const x = (rng() * 2 - 1) * (H - 4), z = (rng() * 2 - 1) * (H - 4);
    const s = 0.5 + rng() * rng() * 1.6;
    if (!free(x, z, s + 1.5)) continue;
    dummy.position.set(x, groundHeight(x, z) - 0.15, z);
    dummy.rotation.set(0, rng() * TAU, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    rocks.setMatrixAt(rc++, dummy.matrix);
    addObstacle(x, z, s * 0.95, s * 1.1);
  }
  rocks.count = rc;
  W.scene.add(rocks);

  // Gras und Blumen (ohne Kollision)
  const tuftGeo = mergeParts([
    { geo: GEO.cone, color: 0x3f9b39, pos: [0, 0.25, 0], scale: [0.18, 0.55, 0.18] },
    { geo: GEO.cone, color: 0x4fae42, pos: [0.15, 0.2, 0.05], scale: [0.15, 0.45, 0.15], rot: [0, 0, -0.4] },
    { geo: GEO.cone, color: 0x4fae42, pos: [-0.13, 0.2, -0.05], scale: [0.15, 0.4, 0.15], rot: [0, 0, 0.4] },
  ]);
  const tufts = new THREE.InstancedMesh(tuftGeo, lam(), 900);
  for (let i = 0; i < 900; i++) {
    const x = (rng() * 2 - 1) * H, z = (rng() * 2 - 1) * H;
    const s = 0.8 + rng() * 0.8;
    dummy.position.set(x, groundHeight(x, z), z);
    dummy.rotation.set(0, rng() * TAU, 0); dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
  }
  W.scene.add(tufts);

  const flowerGeo = mergeParts([
    { geo: GEO.cyl, color: 0x3f9b39, pos: [0, 0.2, 0], scale: [0.05, 0.4, 0.05] },
    { geo: GEO.ball, color: 0xffffff, pos: [0, 0.45, 0], scale: [0.28, 0.2, 0.28] },
    { geo: GEO.ball, color: 0xffe066, pos: [0, 0.52, 0], scale: [0.12, 0.1, 0.12] },
  ]);
  const flowers = new THREE.InstancedMesh(flowerGeo, lam(), 360);
  const fcols = [0xff6b9a, 0xffffff, 0xb28dff, 0xffd166, 0x6ec6ff].map((h) => new THREE.Color(h));
  for (let i = 0; i < 360; i++) {
    const cx = (rng() * 2 - 1) * H, cz = (rng() * 2 - 1) * H;
    const x = cx + rng() * 2, z = cz + rng() * 2;
    dummy.position.set(x, groundHeight(x, z), z);
    dummy.rotation.set(0, rng() * TAU, 0); dummy.scale.setScalar(0.9 + rng() * 0.6);
    dummy.updateMatrix();
    flowers.setMatrixAt(i, dummy.matrix);
    flowers.setColorAt(i, fcols[Math.floor(rng() * fcols.length)]);
  }
  W.scene.add(flowers);

  buildObstacleGrid();
}

// ---------- Helden ----------
function heroMat(color, extra) {
  return new THREE.MeshLambertMaterial(Object.assign({ color, flatShading: true }, extra));
}
function box(g, mat, w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(GEO.box, mat);
  m.scale.set(w, h, d); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  g.add(m);
  return m;
}
function shape(g, geo, mat, sx, sy, sz, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  g.add(m);
  return m;
}

// Klotzige Figuren: Blickrichtung ist +z.
function buildHero(id) {
  const g = new THREE.Group();
  const skin = heroMat(0xf2c39b), dark = heroMat(0x222233), white = heroMat(0xffffff);
  const pal = {
    knight: { body: 0x6f8fb8, legs: 0x4d5d75, arm: 0x8aa2c2 },
    archer: { body: 0x3f9e55, legs: 0x6b4a2b, arm: 0x4fb565 },
    mage: { body: 0x7b4fd0, legs: 0x5c3aa0, arm: 0x8d62e0 },
    ninja: { body: 0x2a2f45, legs: 0x1f2233, arm: 0x343a55 },
    dwarf: { body: 0xb5652a, legs: 0x5a3b22, arm: 0xc9773a },
  }[id];
  const bodyM = heroMat(pal.body), legM = heroMat(pal.legs), armM = heroMat(pal.arm);
  const short = id === 'dwarf';
  const ly = short ? 0.24 : 0.32;
  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.17, ly * 2, 0); legR.position.set(0.17, ly * 2, 0);
  box(legL, legM, 0.24, ly * 2, 0.26, 0, -ly, 0);
  box(legR, legM, 0.24, ly * 2, 0.26, 0, -ly, 0);
  g.add(legL, legR);
  const by = ly * 2 + (short ? 0.32 : 0.38);
  const body = box(g, bodyM, short ? 0.78 : 0.62, short ? 0.64 : 0.76, 0.4, 0, by, 0);
  const hy = by + (short ? 0.32 : 0.38) + 0.27;
  const head = new THREE.Group(); head.position.set(0, hy, 0); g.add(head);
  head.userData.baseY = hy;
  box(head, skin, 0.52, 0.52, 0.5, 0, 0, 0);
  box(head, dark, 0.08, 0.1, 0.02, -0.12, 0.04, 0.26);
  box(head, dark, 0.08, 0.1, 0.02, 0.12, 0.04, 0.26);
  const armL = new THREE.Group(), armR = new THREE.Group();
  const ay = by + 0.28, ax = (short ? 0.39 : 0.31) + 0.11;
  armL.position.set(-ax, ay, 0); armR.position.set(ax, ay, 0);
  box(armL, armM, 0.2, 0.62, 0.22, 0, -0.27, 0);
  box(armR, armM, 0.2, 0.62, 0.22, 0, -0.27, 0);
  box(armL, skin, 0.18, 0.14, 0.2, 0, -0.62, 0);
  box(armR, skin, 0.18, 0.14, 0.2, 0, -0.62, 0);
  g.add(armL, armR);

  if (id === 'knight') {
    const steel = heroMat(0xc4ccd8), red = heroMat(0xe63946), gold = heroMat(0xf4c542);
    box(head, steel, 0.6, 0.42, 0.58, 0, 0.12, 0);
    box(head, dark, 0.44, 0.06, 0.04, 0, 0.04, 0.3);
    box(head, red, 0.08, 0.3, 0.4, 0, 0.46, -0.04);
    box(g, steel, 0.7, 0.2, 0.46, 0, by + 0.32, 0);
    box(armL, heroMat(0x2f5fa8), 0.08, 0.62, 0.54, -0.12, -0.42, 0.06);
    box(armL, gold, 0.09, 0.14, 0.14, -0.13, -0.42, 0.06);
    box(armR, steel, 0.08, 0.95, 0.12, 0, -0.95, 0.36, Math.PI / 2.4, 0, 0);
    box(armR, gold, 0.3, 0.06, 0.1, 0, -0.68, 0.14);
  } else if (id === 'archer') {
    const hood = heroMat(0x2e7d40), wood = heroMat(0x8b5a2b), str = heroMat(0xf1e9d2);
    box(head, hood, 0.58, 0.3, 0.56, 0, 0.2, -0.02);
    shape(head, GEO.cone, hood, 0.4, 0.5, 0.4, 0, 0.35, -0.22, -0.9, 0, 0);
    box(head, heroMat(0xd9a04a), 0.54, 0.1, 0.1, 0, 0.3, 0.22);
    box(g, wood, 0.22, 0.7, 0.2, 0.12, by + 0.1, -0.3, 0, 0, 0.25);
    box(g, heroMat(0xe8d8b0), 0.06, 0.2, 0.06, 0.18, by + 0.5, -0.32);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.04, 4, 10, Math.PI), wood);
    bow.position.set(0, -0.6, 0.2); bow.rotation.set(0, Math.PI / 2, Math.PI / 2);
    armL.add(bow);
    box(armL, str, 0.02, 1.0, 0.02, 0, -0.6, 0.2);
  } else if (id === 'mage') {
    const hat = heroMat(0x4b2a8f), star = heroMat(0xffd166, { emissive: 0x806010 });
    box(g, bodyM, 0.7, 0.5, 0.48, 0, ly * 1.2, 0);
    shape(head, GEO.cyl, hat, 0.95, 0.06, 0.95, 0, 0.27, 0);
    shape(head, GEO.cone, hat, 0.6, 0.8, 0.6, 0, 0.68, -0.05, -0.2, 0, 0);
    box(head, star, 0.1, 0.1, 0.04, 0.12, 0.5, 0.2, 0, 0, 0.7);
    box(head, white, 0.4, 0.34, 0.1, 0, -0.26, 0.24);
    box(armR, heroMat(0x8b5a2b), 0.07, 1.6, 0.07, 0, -0.5, 0.12);
    shape(armR, GEO.sphere, heroMat(0x6ef2ff, { emissive: 0x2aa6c8 }), 0.3, 0.3, 0.3, 0, 0.38, 0.12);
  } else if (id === 'ninja') {
    const mask = heroMat(0x1c1f30), red = heroMat(0xe63946), blade = heroMat(0xdfe6ee);
    box(head, mask, 0.56, 0.26, 0.54, 0, -0.12, 0.01);
    box(head, mask, 0.56, 0.14, 0.54, 0, 0.22, 0.01);
    box(head, red, 0.58, 0.08, 0.56, 0, 0.12, 0);
    box(head, red, 0.06, 0.06, 0.4, 0.12, 0.12, -0.42, 0.3, 0.3, 0);
    box(head, red, 0.06, 0.06, 0.4, -0.06, 0.08, -0.44, 0.5, -0.2, 0);
    box(g, blade, 0.06, 1.1, 0.06, 0, by + 0.25, -0.26, 0, 0, 0.7);
    box(g, red, 0.66, 0.1, 0.42, 0, by - 0.2, 0);
  } else if (id === 'dwarf') {
    const beard = heroMat(0xe8762d), helm = heroMat(0xa7adb8), horn = heroMat(0xf3ead2);
    box(head, beard, 0.56, 0.42, 0.14, 0, -0.26, 0.24);
    box(head, beard, 0.36, 0.2, 0.12, 0, -0.5, 0.24);
    shape(head, GEO.sphere, helm, 0.62, 0.42, 0.62, 0, 0.22, 0);
    shape(head, GEO.cone, horn, 0.14, 0.4, 0.14, -0.34, 0.38, 0, 0, 0, 0.9);
    shape(head, GEO.cone, horn, 0.14, 0.4, 0.14, 0.34, 0.38, 0, 0, 0, -0.9);
    box(g, heroMat(0x5a3b22), 0.82, 0.12, 0.44, 0, by - 0.18, 0);
    shape(g, GEO.sphere, heroMat(0x2b2b33), 0.26, 0.26, 0.26, 0.3, by - 0.3, 0.22);
    box(armR, heroMat(0x8b5a2b), 0.07, 0.9, 0.07, 0, -0.75, 0.18, 1.2, 0, 0);
    box(armR, helm, 0.5, 0.12, 0.12, 0, -0.75, 0.55);
  }
  const mats = new Set();
  g.traverse((o) => { if (o.material) mats.add(o.material); });
  g.userData = { legL, legR, armL, armR, head, body, mats: [...mats], baseY: 0 };
  return g;
}

// ---------- Gegner (zusammengesetzte Geometrien für InstancedMesh) ----------
function enemyGeometry(type) {
  const eye = 0xffffff, pupil = 0x15151f;
  switch (type) {
    case 'slime': return mergeParts([
      { geo: GEO.sphere, color: 0x6fdc5a, pos: [0, 0.45, 0], scale: [1.25, 0.95, 1.25] },
      { geo: GEO.sphere, color: 0x9bf07f, pos: [0.15, 0.7, 0.1], scale: [0.45, 0.3, 0.45] },
      { geo: GEO.box, color: eye, pos: [-0.2, 0.6, 0.55], scale: [0.18, 0.22, 0.06] },
      { geo: GEO.box, color: eye, pos: [0.2, 0.6, 0.55], scale: [0.18, 0.22, 0.06] },
      { geo: GEO.box, color: pupil, pos: [-0.2, 0.57, 0.59], scale: [0.09, 0.12, 0.03] },
      { geo: GEO.box, color: pupil, pos: [0.2, 0.57, 0.59], scale: [0.09, 0.12, 0.03] },
    ]);
    case 'skeleton': return mergeParts([
      { geo: GEO.box, color: 0xe9e4d4, pos: [-0.15, 0.35, 0], scale: [0.14, 0.7, 0.14] },
      { geo: GEO.box, color: 0xe9e4d4, pos: [0.15, 0.35, 0], scale: [0.14, 0.7, 0.14] },
      { geo: GEO.box, color: 0xd8d2bf, pos: [0, 1.0, 0], scale: [0.5, 0.6, 0.28] },
      { geo: GEO.box, color: 0x8a8370, pos: [0, 1.0, 0.15], scale: [0.4, 0.06, 0.02] },
      { geo: GEO.box, color: 0x8a8370, pos: [0, 0.88, 0.15], scale: [0.4, 0.06, 0.02] },
      { geo: GEO.box, color: 0xf2eedf, pos: [0, 1.55, 0.02], scale: [0.46, 0.44, 0.44] },
      { geo: GEO.box, color: 0x1a1a22, pos: [-0.11, 1.58, 0.25], scale: [0.12, 0.12, 0.02] },
      { geo: GEO.box, color: 0x1a1a22, pos: [0.11, 1.58, 0.25], scale: [0.12, 0.12, 0.02] },
      { geo: GEO.box, color: 0xe9e4d4, pos: [-0.33, 1.15, 0.25], scale: [0.12, 0.12, 0.55] },
      { geo: GEO.box, color: 0xe9e4d4, pos: [0.33, 1.15, 0.25], scale: [0.12, 0.12, 0.55] },
    ]);
    case 'bat': return mergeParts([
      { geo: GEO.sphere, color: 0x5b3a7a, pos: [0, 0.35, 0], scale: [0.55, 0.5, 0.55] },
      { geo: GEO.box, color: 0x3f2757, pos: [-0.55, 0.42, 0], scale: [0.7, 0.04, 0.45], rot: [0, 0, 0.3] },
      { geo: GEO.box, color: 0x3f2757, pos: [0.55, 0.42, 0], scale: [0.7, 0.04, 0.45], rot: [0, 0, -0.3] },
      { geo: GEO.cone, color: 0x5b3a7a, pos: [-0.14, 0.66, 0], scale: [0.12, 0.2, 0.12] },
      { geo: GEO.cone, color: 0x5b3a7a, pos: [0.14, 0.66, 0], scale: [0.12, 0.2, 0.12] },
      { geo: GEO.box, color: 0xff3b3b, pos: [-0.1, 0.42, 0.26], scale: [0.08, 0.06, 0.03] },
      { geo: GEO.box, color: 0xff3b3b, pos: [0.1, 0.42, 0.26], scale: [0.08, 0.06, 0.03] },
    ]);
    case 'spitter': return mergeParts([
      { geo: GEO.cyl, color: 0x3c8f3a, pos: [0, 0.45, 0], scale: [0.35, 0.9, 0.35] },
      { geo: GEO.box, color: 0x4fae42, pos: [-0.3, 0.3, 0], scale: [0.5, 0.06, 0.25], rot: [0, 0, 0.4] },
      { geo: GEO.box, color: 0x4fae42, pos: [0.3, 0.3, 0], scale: [0.5, 0.06, 0.25], rot: [0, 0, -0.4] },
      { geo: GEO.sphere, color: 0xe85d9c, pos: [0, 1.1, 0], scale: [0.8, 0.75, 0.8] },
      { geo: GEO.cyl, color: 0x5a1035, pos: [0, 1.1, 0.33], scale: [0.36, 0.1, 0.36], rot: [Math.PI / 2, 0, 0] },
      { geo: GEO.ball, color: 0xffd6ea, pos: [0, 1.45, 0], scale: [0.25, 0.2, 0.25] },
    ]);
    case 'golem': return mergeParts([
      { geo: GEO.box, color: 0x7c7f86, pos: [-0.38, 0.45, 0], scale: [0.5, 0.9, 0.55] },
      { geo: GEO.box, color: 0x7c7f86, pos: [0.38, 0.45, 0], scale: [0.5, 0.9, 0.55] },
      { geo: GEO.box, color: 0x8e9199, pos: [0, 1.45, 0], scale: [1.5, 1.2, 1.0] },
      { geo: GEO.box, color: 0x5e9c46, pos: [0, 2.08, 0], scale: [1.4, 0.12, 0.9] },
      { geo: GEO.box, color: 0x9a9da5, pos: [0, 2.2, 0.15], scale: [0.7, 0.55, 0.6] },
      { geo: GEO.box, color: 0xffa630, pos: [-0.16, 2.24, 0.46], scale: [0.14, 0.1, 0.04] },
      { geo: GEO.box, color: 0xffa630, pos: [0.16, 2.24, 0.46], scale: [0.14, 0.1, 0.04] },
      { geo: GEO.box, color: 0x6c6f76, pos: [-0.98, 1.2, 0.1], scale: [0.45, 1.3, 0.5] },
      { geo: GEO.box, color: 0x6c6f76, pos: [0.98, 1.2, 0.1], scale: [0.45, 1.3, 0.5] },
    ]);
    case 'ghost': return mergeParts([
      { geo: GEO.cone, color: 0xdff3ff, pos: [0, 0.65, 0], scale: [1.0, 1.3, 1.0], rot: [Math.PI, 0, 0] },
      { geo: GEO.sphere, color: 0xeef9ff, pos: [0, 1.25, 0], scale: [0.95, 0.85, 0.95] },
      { geo: GEO.box, color: 0x223344, pos: [-0.17, 1.3, 0.42], scale: [0.14, 0.2, 0.04] },
      { geo: GEO.box, color: 0x223344, pos: [0.17, 1.3, 0.42], scale: [0.14, 0.2, 0.04] },
      { geo: GEO.box, color: 0x223344, pos: [0, 1.05, 0.44], scale: [0.18, 0.1, 0.04] },
    ]);
    case 'darkKnight': return mergeParts([
      { geo: GEO.box, color: 0x2a2633, pos: [-0.2, 0.42, 0], scale: [0.26, 0.84, 0.3] },
      { geo: GEO.box, color: 0x2a2633, pos: [0.2, 0.42, 0], scale: [0.26, 0.84, 0.3] },
      { geo: GEO.box, color: 0x3a3447, pos: [0, 1.28, 0], scale: [0.9, 0.9, 0.5] },
      { geo: GEO.box, color: 0x4a4258, pos: [-0.6, 1.6, 0], scale: [0.4, 0.3, 0.55] },
      { geo: GEO.box, color: 0x4a4258, pos: [0.6, 1.6, 0], scale: [0.4, 0.3, 0.55] },
      { geo: GEO.box, color: 0x2f2a3b, pos: [0, 1.98, 0], scale: [0.55, 0.55, 0.52] },
      { geo: GEO.box, color: 0xff2d2d, pos: [0, 2.0, 0.27], scale: [0.36, 0.06, 0.02] },
      { geo: GEO.cone, color: 0xc9c2d6, pos: [-0.3, 2.35, 0], scale: [0.12, 0.4, 0.12], rot: [0, 0, 0.5] },
      { geo: GEO.cone, color: 0xc9c2d6, pos: [0.3, 2.35, 0], scale: [0.12, 0.4, 0.12], rot: [0, 0, -0.5] },
      { geo: GEO.box, color: 0x9aa3b5, pos: [0.65, 1.2, 0.5], scale: [0.1, 0.1, 1.5] },
    ]);
  }
  return null;
}

// ---------- Bosse ----------
function buildBossModel(model) {
  const g = new THREE.Group();
  const parts = {};
  if (model === 'slimeKing') {
    shape(g, GEO.sphere, heroMat(0x56cc45), 4.6, 3.6, 4.6, 0, 1.75, 0);
    shape(g, GEO.sphere, heroMat(0x8ff06e), 1.5, 1.0, 1.5, 0.7, 3.0, 0.4);
    box(g, heroMat(0xffffff), 0.6, 0.7, 0.1, -0.7, 2.3, 2.1);
    box(g, heroMat(0xffffff), 0.6, 0.7, 0.1, 0.7, 2.3, 2.1);
    box(g, heroMat(0x15151f), 0.3, 0.36, 0.08, -0.7, 2.2, 2.17);
    box(g, heroMat(0x15151f), 0.3, 0.36, 0.08, 0.7, 2.2, 2.17);
    const crown = new THREE.Group(); crown.position.set(0, 3.55, 0); g.add(crown);
    const gold = heroMat(0xffc93c, { emissive: 0x5a3c00 });
    shape(crown, GEO.cyl, gold, 1.8, 0.5, 1.8, 0, 0, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      shape(crown, GEO.cone, gold, 0.4, 0.7, 0.4, Math.cos(a) * 0.8, 0.55, Math.sin(a) * 0.8);
    }
    shape(crown, GEO.oct, heroMat(0xff3b6b, { emissive: 0x601020 }), 0.35, 0.45, 0.35, 0, 0.1, 0.9);
    parts.body = g.children[0];
  } else if (model === 'golemLord') {
    const stone = heroMat(0x6f737c), stone2 = heroMat(0x8a8e97), moss = heroMat(0x5e9c46), glow = heroMat(0xff8a1f, { emissive: 0xff6a00 });
    box(g, stone, 1.0, 1.8, 1.1, -0.8, 0.9, 0);
    box(g, stone, 1.0, 1.8, 1.1, 0.8, 0.9, 0);
    const body = box(g, stone2, 3.0, 2.4, 1.9, 0, 3.0, 0);
    box(g, moss, 2.9, 0.25, 1.8, 0, 4.25, 0);
    box(g, stone2, 1.3, 1.0, 1.1, 0, 4.8, 0.3);
    box(g, glow, 0.3, 0.18, 0.05, -0.3, 4.85, 0.86);
    box(g, glow, 0.3, 0.18, 0.05, 0.3, 4.85, 0.86);
    box(g, glow, 0.9, 0.9, 0.05, 0, 3.1, 0.96);
    const armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.set(-2.0, 3.8, 0); armR.position.set(2.0, 3.8, 0);
    box(armL, stone, 0.9, 2.8, 1.0, 0, -1.2, 0); box(armL, stone2, 1.2, 0.9, 1.2, 0, -2.7, 0.1);
    box(armR, stone, 0.9, 2.8, 1.0, 0, -1.2, 0); box(armR, stone2, 1.2, 0.9, 1.2, 0, -2.7, 0.1);
    g.add(armL, armR);
    Object.assign(parts, { armL, armR, body });
  } else if (model === 'finalBoss') {
    const skin = heroMat(0x8e3b8f), skin2 = heroMat(0xa94ca8), belly = heroMat(0xe6a3c9), dark = heroMat(0x2a1a2e);
    const horn = heroMat(0xf6efd8), gold = heroMat(0xffc93c, { emissive: 0x5a3c00 }), eye = heroMat(0xfff26b, { emissive: 0xffd000 });
    box(g, dark, 1.3, 2.0, 1.3, -1.0, 1.0, 0);
    box(g, dark, 1.3, 2.0, 1.3, 1.0, 1.0, 0);
    const body = shape(g, GEO.sphere, skin, 4.4, 4.0, 3.4, 0, 3.9, 0);
    shape(g, GEO.sphere, belly, 2.8, 2.6, 1.0, 0, 3.6, 1.35);
    box(g, gold, 4.0, 0.4, 3.0, 0, 2.3, 0);
    const head = new THREE.Group(); head.position.set(0, 6.4, 0.3); g.add(head);
    box(head, skin2, 2.4, 1.9, 2.0, 0, 0, 0);
    box(head, eye, 0.5, 0.3, 0.06, -0.55, 0.25, 1.01);
    box(head, eye, 0.5, 0.3, 0.06, 0.55, 0.25, 1.01);
    box(head, dark, 1.4, 0.3, 0.06, 0, -0.45, 1.01);
    box(head, horn, 0.2, 0.3, 0.06, -0.45, -0.25, 1.03);
    box(head, horn, 0.2, 0.3, 0.06, 0.45, -0.25, 1.03);
    shape(head, GEO.cone, horn, 0.5, 1.4, 0.5, -1.1, 1.1, 0, 0, 0, 0.5);
    shape(head, GEO.cone, horn, 0.5, 1.4, 0.5, 1.1, 1.1, 0, 0, 0, -0.5);
    const crown = new THREE.Group(); crown.position.set(0, 1.1, 0); head.add(crown);
    shape(crown, GEO.cyl, gold, 1.6, 0.4, 1.6, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      shape(crown, GEO.cone, gold, 0.35, 0.6, 0.35, Math.cos(a) * 0.7, 0.45, Math.sin(a) * 0.7);
    }
    const armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.set(-2.4, 5.2, 0); armR.position.set(2.4, 5.2, 0);
    box(armL, skin2, 1.0, 2.8, 1.0, 0, -1.2, 0);
    box(armR, skin2, 1.0, 2.8, 1.0, 0, -1.2, 0);
    // Die große Keule
    const club = new THREE.Group(); club.position.set(0, -2.6, 0.4); armR.add(club);
    box(club, heroMat(0x7a4f2a), 0.4, 0.4, 3.4, 0, 0, 1.4);
    shape(club, GEO.dodeca, heroMat(0x9b6b3d), 1.8, 1.8, 2.2, 0, 0, 3.4);
    for (let i = 0; i < 5; i++) shape(club, GEO.cone, horn, 0.3, 0.6, 0.3, Math.cos(i) * 0.9, Math.sin(i) * 0.9, 3.4, Math.sin(i), 0, Math.cos(i));
    g.add(armL, armR);
    Object.assign(parts, { armL, armR, head, body });
  }
  const mats = new Set();
  g.traverse((o) => { if (o.material) mats.add(o.material); });
  g.userData = { parts, mats: [...mats] };
  return g;
}

// ---------- Truhen und Schreine ----------
// Truhen werden oft neu erzeugt: Materialien und Geometrie einmal anlegen und teilen.
const ChestParts = {};
function buildChest(free) {
  const g = new THREE.Group();
  if (!ChestParts.band) {
    ChestParts.band = heroMat(0xffc93c, { emissive: 0x3a2800 });
    ChestParts.wood = heroMat(0x9a5b2b);
    ChestParts.woodFree = heroMat(0x7a3fd0);
    ChestParts.glowGeo = new THREE.CylinderGeometry(0.9, 0.9, 6, 12, 1, true);
  }
  const wood = free ? ChestParts.woodFree : ChestParts.wood, band = ChestParts.band;
  box(g, wood, 1.3, 0.8, 0.9, 0, 0.4, 0);
  box(g, band, 1.34, 0.12, 0.94, 0, 0.62, 0);
  box(g, band, 0.12, 0.84, 0.94, -0.4, 0.4, 0);
  box(g, band, 0.12, 0.84, 0.94, 0.4, 0.4, 0);
  const lid = new THREE.Group(); lid.position.set(0, 0.8, -0.45); g.add(lid);
  box(lid, wood, 1.3, 0.36, 0.9, 0, 0.18, 0.45);
  box(lid, band, 0.22, 0.24, 0.06, 0, 0.0, 0.92);
  const glow = new THREE.Mesh(ChestParts.glowGeo,
    new THREE.MeshBasicMaterial({ color: free ? 0xc58bff : 0xffd75e, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }));
  glow.position.y = 3;
  g.add(glow);
  g.userData = { lid, glow };
  return g;
}

function buildShrine() {
  const g = new THREE.Group();
  const stone = heroMat(0xb9b2a3), stone2 = heroMat(0x9c9586);
  shape(g, GEO.cyl, stone2, 2.2, 0.4, 2.2, 0, 0.2, 0);
  shape(g, GEO.cyl, stone, 0.9, 1.5, 0.9, 0, 1.1, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + Math.PI / 4;
    box(g, stone, 0.45, 2.2, 0.45, Math.cos(a) * 3.4, 1.0, Math.sin(a) * 3.4);
  }
  const crystalMat = new THREE.MeshLambertMaterial({ color: 0xb48cff, emissive: 0x6a3cc8, flatShading: true });
  const crystal = shape(g, GEO.oct, crystalMat, 0.9, 1.5, 0.9, 0, 2.7, 0);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xc58bff, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.3, 3.6, 40), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08;
  g.add(ring);
  const fillMat = new THREE.MeshBasicMaterial({ color: 0xc58bff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
  const fill = new THREE.Mesh(new THREE.CircleGeometry(3.3, 40), fillMat);
  fill.rotation.x = -Math.PI / 2; fill.position.y = 0.1; fill.scale.setScalar(0.001);
  g.add(fill);
  g.userData = { crystal, crystalMat, ring, fill };
  return g;
}
