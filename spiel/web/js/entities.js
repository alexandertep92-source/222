'use strict';
// Rumms! – Spielfigur, Gegner, Sammelobjekte, Partikel, Effekte und Schadenszahlen.
// Die Simulation läuft in festen Schritten (60 pro Sekunde); gezeichnet wird mit
// Zwischenwerten (px/py/pz = Position im letzten Schritt), damit alles flüssig wirkt.

// Zeichnet viele gleiche Objekte mit einem einzigen Draw-Call.
class Instancer {
  constructor(geo, material, cap, colored, shadow) {
    this.mesh = new THREE.InstancedMesh(geo, material, cap);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.castShadow = !!shadow && GFX.shadows;
    this.cap = cap; this.n = 0;
    if (colored) {
      this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
      this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
    }
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    W.scene.add(this.mesh);
    Instancer.all.push(this);
  }
  begin() { this.n = 0; }
  add(x, y, z, rx, ry, rz, sx, sy, sz, r, g, b) {
    if (this.n >= this.cap) return;
    const d = Instancer.dummy;
    d.position.set(x, y, z); d.rotation.set(rx, ry, rz); d.scale.set(sx, sy, sz);
    d.updateMatrix();
    this.mesh.setMatrixAt(this.n, d.matrix);
    if (r !== undefined && this.mesh.instanceColor) {
      const a = this.mesh.instanceColor.array, i = this.n * 3;
      a[i] = r; a[i + 1] = g; a[i + 2] = b;
    }
    this.n++;
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0; // leere Meshes kosten sonst trotzdem einen Draw-Call
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
Instancer.all = [];
Instancer.dummy = new THREE.Object3D();
Instancer.dummy.rotation.order = 'YXZ';
const ilerp = (a, b, t) => a + (b - a) * t;
const alerp = (a, b, t) => a + angleDiff(a, b) * t;

// ---------- Raster für schnelle Nachbarsuche ----------
const Grid = {
  cell: 2.5, n: 0, head: null, next: null,
  init() {
    this.n = Math.ceil((CONFIG.WORLD_HALF * 2) / this.cell);
    this.head = new Int32Array(this.n * this.n);
    this.next = new Int32Array(4096);
  },
  idx(v) { return clamp(Math.floor((v + CONFIG.WORLD_HALF) / this.cell), 0, this.n - 1); },
  rebuild(list) {
    this.head.fill(-1);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      const c = this.idx(e.z) * this.n + this.idx(e.x);
      this.next[i] = this.head[c]; this.head[c] = i;
    }
  },
  // Ruft fn(e) für jeden lebenden Gegner (und Boss) auf, dessen Körper den Kreis berührt.
  query(x, z, r, fn) {
    const R = r + 1.3;
    const x0 = this.idx(x - R), x1 = this.idx(x + R), z0 = this.idx(z - R), z1 = this.idx(z + R);
    const list = G.enemies;
    for (let gz = z0; gz <= z1; gz++) {
      for (let gx = x0; gx <= x1; gx++) {
        let i = this.head[gz * this.n + gx];
        while (i !== -1) {
          const e = list[i];
          if (e && e.alive) {
            const dx = e.x - x, dz = e.z - z, rr = r + e.r;
            if (dx * dx + dz * dz <= rr * rr) fn(e);
          }
          i = this.next[i];
        }
      }
    }
    for (const b of G.bosses) {
      if (!b.alive) continue;
      const dx = b.x - x, dz = b.z - z, rr = r + b.r;
      if (dx * dx + dz * dz <= rr * rr) fn(b);
    }
  },
};

// preferBoss: Bosse in Reichweite werden bei jedem zweiten Schuss bevorzugt,
// damit Fernkampfwaffen nicht nur die Schwärme um den Boss herum treffen.
function nearestEnemy(x, z, maxR, exclude, preferBoss) {
  if (preferBoss && Math.random() < 0.5) {
    for (const b of G.bosses) {
      if (b.alive && (b.x - x) ** 2 + (b.z - z) ** 2 < (maxR + b.r) ** 2) return b;
    }
  }
  let best = null, bd = maxR * maxR;
  const consider = (e) => {
    if (!e.alive || (exclude && exclude.has(e))) return;
    const d = (e.x - x) ** 2 + (e.z - z) ** 2;
    if (d < bd) { bd = d; best = e; }
  };
  G.enemies.forEach(consider);
  G.bosses.forEach(consider);
  return best;
}
function randomEnemy(x, z, maxR, preferStrong) {
  const c = [];
  const consider = (e) => { if (e.alive && (e.x - x) ** 2 + (e.z - z) ** 2 < maxR * maxR) c.push(e); };
  G.enemies.forEach(consider);
  G.bosses.forEach(consider);
  if (!c.length) return null;
  if (preferStrong && Math.random() < 0.4) {
    const strong = c.filter((e) => e.boss || e.elite);
    if (strong.length) return pick(strong);
  }
  return pick(c);
}

// ---------- Spielfigur ----------
const DASH_TIME = 0.26, DASH_CD = 1.6;
function createPlayer(charDef) {
  const model = buildHero(charDef.id);
  W.scene.add(model);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.visible = !GFX.shadows;
  W.scene.add(shadow);
  const y = groundHeight(0, 0);
  return {
    x: 0, z: 0, y, px: 0, pz: 0, py: y, vx: 0, vz: 0, vy: 0,
    facing: 0, pfacing: 0, grounded: true, jumpsLeft: 1, coyote: 0, jumpBuffer: 0,
    hp: 100, iframes: 0, dashT: 0, dashCd: 0, dashX: 0, dashZ: 1,
    moving: false, flash: 0, swingT: 0, landK: 0, wet: false, splashT: 0, slowT: 0, slowAmt: 0,
    animT: 0, blinkT: 2, airArm: 0, lean: 0,
    model, shadow,
  };
}

function updatePlayer(dt) {
  const p = G.player, s = G.stats, inp = Input;
  // Eingabe relativ zur Kamera
  const fx = -Math.sin(G.camYaw), fz = -Math.cos(G.camYaw);
  const rx = -fz, rz = fx;
  let mx = rx * inp.moveX + fx * inp.moveY, mz = rz * inp.moveX + fz * inp.moveY;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  p.moving = ml > 0.05;
  const gh0 = groundHeight(p.x, p.z);
  p.wet = gh0 < CONFIG.WATER_LEVEL - 0.1 && p.y < CONFIG.WATER_LEVEL + 0.2;
  if (p.slowT > 0) p.slowT -= dt;
  const speed = s.speed * (p.wet ? 0.8 : 1) * (p.slowT > 0 ? 1 - p.slowAmt : 1);
  const tx = mx * speed, tz = mz * speed;
  // Beschleunigen und Bremsen als Vektor: weiche Kurven, schnelles Umdrehen
  let accel;
  if (!p.moving) accel = p.grounded ? 58 : 14;
  else {
    const vl = Math.hypot(p.vx, p.vz), dot = vl > 0.1 ? (p.vx * tx + p.vz * tz) / (vl * speed) : 1;
    accel = p.grounded ? (dot < 0 ? 95 : 62) : 28;
  }
  const dvx = tx - p.vx, dvz = tz - p.vz, dl = Math.hypot(dvx, dvz), step = accel * dt;
  if (dl <= step) { p.vx = tx; p.vz = tz; } else { p.vx += (dvx / dl) * step; p.vz += (dvz / dl) * step; }
  if (p.moving) p.facing += angleDiff(p.facing, Math.atan2(mx, mz)) * Math.min(1, dt * 15);

  // Sprint: kräftiger Start, sanft auslaufend
  p.dashCd -= dt;
  if (inp.dashPressed) {
    inp.dashPressed = false;
    if (p.dashCd <= 0) {
      p.dashT = DASH_TIME; p.dashCd = DASH_CD;
      let dx = p.moving ? mx : Math.sin(p.facing), dz = p.moving ? mz : Math.cos(p.facing);
      const l = Math.hypot(dx, dz) || 1;
      p.dashX = dx / l; p.dashZ = dz / l;
      p.facing = Math.atan2(p.dashX, p.dashZ);
      Sound.dash();
      smokeBurst(p.x, p.y + 0.3, p.z, 6, 0xf2ead8, 0.9, 2.5);
      G.camKick = 1;
    }
  }
  let vx = p.vx, vz = p.vz;
  if (p.dashT > 0) {
    const k = 1 - p.dashT / DASH_TIME;
    const mult = lerp(3.7, 1.3, 1 - (1 - k) * (1 - k));
    vx = p.dashX * speed * mult; vz = p.dashZ * speed * mult;
    p.dashT -= dt;
    if (p.dashT <= 0) { p.vx = p.dashX * speed * 1.15; p.vz = p.dashZ * speed * 1.15; }
    if (Math.random() < 0.7) spawnSpark(p.x - p.dashX * 0.3, p.y + rand(0.3, 1.3), p.z - p.dashZ * 0.3, -p.dashX * 3, 0, -p.dashZ * 3, 0.25, 0.35, 0xbfe9ff, 0);
  }

  // Springen mit Pufferzeit, Koyote-Zeit und variabler Höhe (kurz tippen = kleiner Hüpfer)
  p.jumpBuffer -= dt; p.coyote -= dt;
  if (inp.jumpPressed) { inp.jumpPressed = false; p.jumpBuffer = 0.15; }
  if (p.jumpBuffer > 0) {
    if (p.grounded || p.coyote > 0) {
      p.vy = 10.2; p.grounded = false; p.coyote = 0; p.jumpBuffer = 0; p.jumpsLeft = s.jumps - 1;
      Sound.jump();
      if (p.wet) splash(p.x, p.z, 8); else smokeBurst(p.x, p.y + 0.1, p.z, 4, 0xe9dcbc, 0.6, 1.5);
    } else if (p.jumpsLeft > 0) {
      p.vy = 9.4; p.jumpsLeft--; p.jumpBuffer = 0;
      Sound.jump();
      sparkBurst(p.x, p.y + 0.2, p.z, 10, 0xffffff, 3, 0.35);
    }
  }
  let grav = p.vy > 0 ? (inp.jumpHeld ? 25 : 50) : 40;
  if (!p.grounded && Math.abs(p.vy) < 1.8) grav *= 0.55;
  const vyBefore = p.vy;
  p.vy = Math.max(p.vy - grav * dt, -24);
  p.x += vx * dt; p.z += vz * dt; p.y += p.vy * dt;

  const H = CONFIG.MAP_HALF;
  p.x = clamp(p.x, -H, H); p.z = clamp(p.z, -H, H);
  let gh = groundHeight(p.x, p.z);
  pushOutOfObstacles(p, 0.45, p.y - gh);
  gh = groundHeight(p.x, p.z);
  if (p.y <= gh) {
    if (!p.grounded) {
      p.landK = clamp(-vyBefore / 16, 0.25, 1);
      if (vyBefore < -8) { if (p.wet) splash(p.x, p.z, 10); else smokeBurst(p.x, gh + 0.1, p.z, 7, 0xe9dcbc, 1.0, 2.2); }
    }
    p.y = gh; p.vy = 0; p.grounded = true; p.jumpsLeft = s.jumps - 1;
  } else if (p.grounded && p.y - gh < 0.5 && p.vy <= 0) {
    p.y = gh; p.vy = 0; // Hügel hinunterlaufen ohne abzuheben
  } else {
    if (p.grounded) p.coyote = 0.11;
    p.grounded = false;
  }
  if (p.wet && p.moving && p.grounded) {
    p.splashT -= dt;
    if (p.splashT <= 0) { p.splashT = 0.12; splash(p.x, p.z, 2); }
  }

  if (s.regen > 0 && p.hp < s.maxHp) p.hp = Math.min(s.maxHp, p.hp + s.regen * dt);
  p.iframes -= dt;
  p.flash -= dt;
  p.swingT -= dt;
}

// Nur Darstellung: Modell an die (interpolierte) Position setzen und animieren.
function renderPlayer(a, dt) {
  const p = G.player, s = G.stats, m = p.model, u = m.userData;
  const x = ilerp(p.px, p.x, a), y = ilerp(p.py, p.y, a), z = ilerp(p.pz, p.z, a);
  m.position.set(x, y, z);
  m.rotation.y = alerp(p.pfacing, p.facing, a);
  const dashing = p.dashT > 0;
  const hs = dashing ? s.speed * 2 : Math.hypot(p.vx, p.vz);
  const run = clamp(hs / s.speed, 0, 1.4);
  p.animT += dt * (2 + hs * 1.75);
  const t = G.time;
  const sw = Math.sin(p.animT);
  const legSw = p.grounded ? sw * 0.85 * Math.min(run, 1) : 0;
  u.legL.rotation.x = p.grounded ? legSw : -0.5;
  u.legR.rotation.x = p.grounded ? -legSw : 0.3;
  p.airArm += ((p.grounded ? 0 : 1) - p.airArm) * Math.min(1, dt * 10);
  u.armL.rotation.x = -legSw * 0.8;
  u.armL.rotation.z = -p.airArm * 0.9;
  u.armR.rotation.z = p.airArm * 0.9;
  if (p.swingT > 0) {
    const k = p.swingT / 0.2;
    u.armR.rotation.x = -2.6 * Math.sin(k * Math.PI);
  } else u.armR.rotation.x = legSw * 0.8;
  // Körper: Wippen, Vorlehnen, Landen (Stauchen), Sprung (Strecken), Atmen
  p.lean += ((dashing ? 0.45 : 0.16 * Math.min(run, 1)) - p.lean) * Math.min(1, dt * 10);
  u.rig.rotation.x = p.lean;
  p.landK *= Math.exp(-dt * 9);
  let sy = 1 - p.landK * 0.28, sxz = 1 + p.landK * 0.18;
  if (!p.grounded && p.vy > 3) { sy *= 1.08; sxz *= 0.95; }
  if (run < 0.1 && p.grounded) sy *= 1 + Math.sin(t * 2.6) * 0.018;
  u.rig.scale.set(sxz, sy, sxz);
  u.rig.position.y = p.grounded ? Math.abs(sw) * 0.08 * Math.min(run, 1) : 0;
  u.head.position.y = u.head.userData.baseY + Math.sin(p.animT * 2) * 0.02 * Math.min(run, 1);
  // Blinzeln
  p.blinkT -= dt;
  const blink = p.blinkT < 0.12;
  if (p.blinkT < 0) p.blinkT = 2.2 + Math.random() * 3;
  for (const e of u.eyes) e.scale.y = blink ? 0.12 : 1;
  if (u.tails) u.tails.rotation.x = 0.4 * Math.min(run, 1) + Math.sin(t * 13) * 0.15;
  const flick = p.iframes > 0 && p.iframes < 0.55 && Math.floor(p.iframes * 18) % 2 === 0;
  m.visible = !flick;
  for (const mt of u.mats) {
    if (!mt.userData.baseEmissive) mt.userData.baseEmissive = mt.emissive.clone();
    if (p.flash > 0) mt.emissive.setRGB(0.9, 0.12, 0.12);
    else if (p.slowT > 0) mt.emissive.setRGB(0.06, 0.2, 0.4);
    else mt.emissive.copy(mt.userData.baseEmissive);
  }
  if (p.slowT > 0 && Math.random() < 0.4) spawnSpark(x + rand(-0.45, 0.45), y + rand(0.2, 1.6), z + rand(-0.45, 0.45), 0, -0.6, 0, 0.5, 0.32, 0xbff4ff, 0);
  const gh = groundHeight(x, z);
  if (p.shadow.visible) {
    p.shadow.position.set(x, gh + 0.06, z);
    p.shadow.scale.setScalar(clamp(1 - (y - gh) / 6, 0.4, 1));
  }
}

function hurtPlayer(amount, src) {
  const p = G.player;
  if (p.iframes > 0 || p.dashT > 0 || G.god || G.state !== 'playing') return;
  if (Math.random() < G.stats.evasion) {
    p.iframes = 0.3;
    addText(p.x, p.y + 2.3, p.z, 'Ausgewichen!', '#9fe8ff');
    return;
  }
  const dmg = amount * (1 - G.stats.armor);
  p.hp -= dmg; p.iframes = 0.6; p.flash = 0.15;
  G.damageTaken += dmg;
  if (src) G.hurtBy[src] = (G.hurtBy[src] || 0) + dmg;
  G.shake = Math.min(1, G.shake + 0.35);
  Sound.hurt(); vibrate(35);
  UI.hurtFlash();
  addNumber(p.x, p.y + 2.3, p.z, dmg, false, '#ff5a6a');
  sparkBurst(p.x, p.y + 1, p.z, 8, 0xff5a6a, 4, 0.35);
  if (p.hp <= 0) { p.hp = 0; endRun(false); }
}

function healPlayer(amount) {
  const p = G.player, before = p.hp;
  p.hp = Math.min(G.stats.maxHp, p.hp + amount);
  if (p.hp - before >= 1) {
    addText(p.x, p.y + 2.4, p.z, `+${Math.round(p.hp - before)}`, '#5ee08a');
    sparkBurst(p.x, p.y + 1, p.z, 14, 0x5ee08a, 3, 0.4);
  }
}

// ---------- Gegner ----------
const ENEMY_COLORS = {
  slime: 0x6fdc5a, skeleton: 0xe9e4d4, bat: 0x7a55a0, spitter: 0xe85d9c, golem: 0x8e9199, ghost: 0xdff3ff, darkKnight: 0x4a4258,
  wisp: 0x8ff7ff, bomber: 0xe8423a, bigSlime: 0x5aa9ff, boar: 0x8a5a38, frost: 0x9fe6ff, shaman: 0x7cc35a, shieldBearer: 0x9aa3b5,
};
// Punkt im Gegner-Modell (lokal ox/oy/oz) in Weltkoordinaten
const _wp = { x: 0, y: 0, z: 0 };
function enemyPoint(x, y, z, rot, s, ox, oy, oz) {
  const c = Math.cos(rot), sn = Math.sin(rot);
  _wp.x = x + (ox * c + oz * sn) * s; _wp.y = y + oy * s; _wp.z = z + (-ox * sn + oz * c) * s;
  return _wp;
}
const Enemies = {
  inst: {}, shadows: null, pool: [], queue: [],
  init() {
    for (const id of Object.keys(ENEMIES)) {
      const ghost = id === 'ghost', wisp = id === 'wisp';
      const rough = id === 'slime' || id === 'bigSlime' ? 0.32 : id === 'golem' ? 0.95 : 0.7;
      const m = wisp ? new THREE.MeshBasicMaterial({ vertexColors: true })
        : mat({ vertexColors: true, rim: 0.3, rough, transparent: ghost, opacity: ghost ? 0.8 : 1 });
      this.inst[id] = new Instancer(enemyGeometry(id), m, CONFIG.MAX_ENEMIES + 60, true, !ghost && !wisp && Settings.quality === 'high');
    }
    this.shadows = new Instancer(new THREE.CircleGeometry(0.5, 14).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }), CONFIG.MAX_ENEMIES + 80);
  },
  spawn(typeId, x, z, opts = {}) {
    const def = ENEMIES[typeId];
    const m = G.time / 60;
    const e = this.pool.pop() || { hitT: new Float32Array(4) };
    const elite = !!opts.elite;
    const hpMul = enemyHpScale(m) * (elite ? 5 : 1) * (opts.hpMul || 1);
    const y = groundHeight(x, z) + (def.fly || 0);
    Object.assign(e, {
      type: typeId, def, x, z, y, px: x, pz: z, py: y, prot: 0,
      vx: 0, vz: 0, kvx: 0, kvz: 0, vy: 0, yOff: 0, ay: 0, avy: 0,
      hp: def.hp * hpMul, maxHp: def.hp * hpMul,
      r: def.r * (elite ? 1.5 : 1), h: def.h * (elite ? 1.5 : 1), scale: elite ? 1.5 : 1,
      speed: def.speed * (1 + Math.min(m, 15) * 0.012) * (elite ? 0.9 : 1) * rand(0.92, 1.08),
      dmg: def.dmg * enemyDmgScale(m) * (elite ? 1.5 : 1),
      xp: def.xp * (1 + m * 0.05) * (elite ? 6 : 1),
      mass: def.mass * (elite ? 3 : 1),
      elite, boss: false, alive: true, dying: false, dyingT: 0, dead: false,
      rot: 0, flash: 0, slowT: 0, slow: 0, spin: 0, hitAt: -9, landAt: -9,
      spawnT: opts.instant ? 0 : 0.5,
      shootT: def.ranged ? rand(1, def.ranged.cd) : 0,
      phase: Math.random() * TAU,
      fuseT: 0, warn: null, mode: 0, modeT: 0, cdx: 0, cdz: 1,
      chargeCd: def.charge ? rand(1, def.charge.cd) : 0,
      healT: def.heal ? rand(1.5, def.heal.cd) : 0,
      rootT: 0, confT: 0, confA: 0,
    });
    e.hitT.fill(0);
    G.enemies.push(e);
    if (!opts.instant && (x - G.player.x) ** 2 + (z - G.player.z) ** 2 < 45 * 45) smokeBurst(x, y + 0.2, z, 3, 0x9a8f7a, 1.2, 1.2);
    return e;
  },
  update(dt) {
    const p = G.player, list = G.enemies, t = G.time;
    // Riesenschleime zerfallen in kleine Schleime (gesammelt, damit keine Liste während einer Schleife wächst)
    if (this.queue.length) {
      for (const q of this.queue) {
        for (let k = 0; k < q.n && list.length < CONFIG.MAX_ENEMIES + 40; k++) {
          const a = (k / q.n) * TAU + Math.random();
          const c = this.spawn(q.type, q.x + Math.sin(a) * 0.4, q.z + Math.cos(a) * 0.4, { instant: true, hpMul: 0.8 });
          c.kvx = Math.sin(a) * 5; c.kvz = Math.cos(a) * 5; c.avy = 6.5; c.ay = 0.001;
        }
      }
      this.queue.length = 0;
    }
    Grid.rebuild(list);
    const H = CONFIG.MAP_HALF + 2, pr = 0.45;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dying) {
        e.dyingT -= dt;
        e.x += e.kvx * dt; e.z += e.kvz * dt;
        e.vy -= 30 * dt; e.yOff += e.vy * dt; e.spin += dt * 14;
        e.y = groundHeight(e.x, e.z) + (e.def.fly || 0) + Math.max(e.yOff, -0.5);
        if (e.dyingT <= 0) e.dead = true;
        continue;
      }
      if (e.spawnT > 0) e.spawnT -= dt;
      if (e.flash > 0) e.flash -= dt;
      if (e.slowT > 0) e.slowT -= dt;
      // Durch die Luft geschleudert (Rumms!): keine Steuerung bis zur Landung
      if (e.ay > 0 || e.avy > 0) {
        e.avy -= 32 * dt; e.ay += e.avy * dt;
        e.x += e.kvx * dt; e.z += e.kvz * dt;
        e.spin += dt * 9;
        const d2 = Math.exp(-1.5 * dt); e.kvx *= d2; e.kvz *= d2;
        if (e.ay <= 0) { e.ay = 0; e.avy = 0; e.landAt = t; e.vx = e.vz = 0; e.spin = 0; }
        continue;
      }
      const def = e.def;
      const dx = p.x - e.x, dz = p.z - e.z;
      const d = Math.hypot(dx, dz) || 0.001;
      let mx = dx / d, mz = dz / d, face = Math.atan2(dx, dz);
      const slowK = e.slowT > 0 ? 1 - e.slow : 1;
      let sp = e.speed * slowK * (e.spawnT > 0 ? 0.25 : 1);
      // kurz vor dem Spieler abbremsen statt hineinzudrängen (kein Zittern)
      const rr = e.r + pr;
      if (!def.fly) sp *= smoothstep(rr * 0.8, rr * 1.6, d) * 0.85 + 0.15;
      // Knallpilz: Zündschnur läuft, dann Rumms
      const fu = def.fuse;
      if (fu) {
        if (e.fuseT > 0) {
          e.fuseT -= dt; sp *= 0.12;
          if (e.fuseT <= 0) { bomberBlast(e); continue; }
        } else if (d < fu.range && e.spawnT <= 0 && e.confT <= 0) {
          e.fuseT = fu.time;
          e.warn = warnFx(e.x, e.z, fu.r * e.scale, fu.time);
          e.warn.follow = e;
          Sound.fuse();
        }
      }
      if (e.rootT > 0) { e.rootT -= dt; sp = 0; }
      if (e.confT > 0) {
        // verwirrt (Rauchbombe): irrt umher, greift nicht an
        e.confT -= dt;
        if (Math.random() < dt * 1.5) e.confA = Math.random() * TAU;
        mx = Math.sin(e.confA); mz = Math.cos(e.confA); face = e.confA;
        sp = e.rootT > 0 ? 0 : e.speed * 0.5 * slowK;
        e.mode = 0;
      } else {
        const rg = def.ranged, keep = rg ? rg.keep : def.keep;
        if (keep) {
          if (d < keep) { mx = -mx * 0.5; mz = -mz * 0.5; } else if (d < keep + 2.5) sp *= 0.1;
        }
        if (rg) {
          e.shootT -= dt;
          if (e.shootT <= 0 && d < rg.range) {
            e.shootT = rg.cd * rand(0.85, 1.15);
            fireEnemyOrb(e.x, e.y + 1.1, e.z, dx / d, dz / d, rg.speed, rg.dmg * enemyDmgScale(t / 60), rg.color, rg.slow, rg.slowT);
            e.hitAt = t - 0.05;
          }
        }
        // Irrlichter fliegen in Schlangenlinien
        if (def.swarm) {
          const w = Math.sin(t * 3.2 + e.phase) * 0.75;
          mx += (-dz / d) * w; mz += (dx / d) * w;
        }
        // Schamane heilt die Gegner um sich herum
        const hl = def.heal;
        if (hl && e.spawnT <= 0) {
          e.healT -= dt;
          if (e.healT <= 0) { e.healT = hl.cd * rand(0.9, 1.1); shamanHeal(e, hl); }
        }
        // Keiler: scharren, dann geradeaus losstürmen
        const ch = def.charge;
        if (ch) {
          e.chargeCd -= dt;
          if (e.mode === 1) {
            e.modeT -= dt; sp = 0;
            if (Math.random() < 0.3) smokeBurst(e.x - Math.sin(e.rot) * 0.7, e.y + 0.1, e.z - Math.cos(e.rot) * 0.7, 1, 0xd8c9a8, 0.7, 1.2);
            if (e.modeT <= 0) { e.mode = 2; e.modeT = ch.time; e.cdx = Math.sin(e.rot); e.cdz = Math.cos(e.rot); Sound.charge(); }
          } else if (e.mode === 0 && e.chargeCd <= 0 && d > ch.min && d < ch.max && e.spawnT <= 0 && e.rootT <= 0) {
            e.mode = 1; e.modeT = ch.windup;
            addText(e.x, e.y + e.h + 0.7, e.z, '!', '#ff6a3a');
          }
        }
      }
      if (e.mode === 2) {
        e.modeT -= dt;
        const cs = e.rootT > 0 ? 0 : def.charge.speed * slowK;
        e.vx = e.cdx * cs; e.vz = e.cdz * cs;
        if (Math.random() < 0.5) smokeBurst(e.x - e.cdx * 0.8, e.y + 0.15, e.z - e.cdz * 0.8, 1, 0xd8c9a8, 0.8, 1.5);
        if (e.modeT <= 0 || e.rootT > 0) { e.mode = 0; e.chargeCd = def.charge.cd * rand(0.8, 1.2); }
      } else {
        const k = Math.min(1, dt * 7);
        e.vx += (mx * sp - e.vx) * k; e.vz += (mz * sp - e.vz) * k;
        e.rot += angleDiff(e.rot, face) * Math.min(1, dt * (e.mode === 1 ? 12 : 7));
      }
      e.x += (e.vx + e.kvx) * dt;
      e.z += (e.vz + e.kvz) * dt;
      const decay = Math.exp(-6 * dt);
      e.kvx *= decay; e.kvz *= decay;
    }
    // Gegner schieben sich gegenseitig weg (weich, damit nichts zittert)
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive || a.def.fly || a.ay > 0) continue;
      const gx = Grid.idx(a.x), gz = Grid.idx(a.z);
      for (let oz = -1; oz <= 1; oz++) {
        for (let ox = -1; ox <= 1; ox++) {
          const cx = gx + ox, cz = gz + oz;
          if (cx < 0 || cz < 0 || cx >= Grid.n || cz >= Grid.n) continue;
          let j = Grid.head[cz * Grid.n + cx];
          while (j !== -1) {
            if (j > i) {
              const b = list[j];
              if (b.alive && !b.def.fly && b.ay <= 0) {
                const dx = b.x - a.x, dz = b.z - a.z, rr = a.r + b.r;
                const d2 = dx * dx + dz * dz;
                if (d2 < rr * rr && d2 > 1e-6) {
                  const d = Math.sqrt(d2), ov = (rr - d) / d * 0.35;
                  const wa = b.mass / (a.mass + b.mass), wb = 1 - wa;
                  a.x -= dx * ov * wa; a.z -= dz * ov * wa;
                  b.x += dx * ov * wb; b.z += dz * ov * wb;
                }
              }
            }
            j = Grid.next[j];
          }
        }
      }
    }
    // Hindernisse, Rand, Höhe und Kontaktschaden
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      if (!e.def.phase) pushOutOfObstacles(e, e.r * 0.8, e.ay);
      e.x = clamp(e.x, -H, H); e.z = clamp(e.z, -H, H);
      const gh = groundHeight(e.x, e.z);
      e.y = gh + e.ay + (e.def.fly ? e.def.fly + Math.sin(t * 3 + e.phase) * 0.3 : 0);
      if (e.ay > 0 || e.spawnT > 0 || e.confT > 0) continue;
      const dx = e.x - p.x, dz = e.z - p.z, rr = e.r + pr;
      const d2 = dx * dx + dz * dz;
      if (d2 < (rr + 0.12) * (rr + 0.12)) {
        if (p.y < e.y + e.h - 0.05 && p.y + 1.7 > e.y) {
          hurtPlayer(e.mode === 2 ? e.dmg * 1.4 : e.dmg, e.type);
          if (!e.def.fly && d2 < rr * rr * 0.8) {
            const d = Math.sqrt(d2) || 0.01, push = (rr * 0.9 - d) / d * 0.3;
            e.x += dx * push; e.z += dz * push;
          }
        }
      }
    }
  },
  removeDead() {
    const list = G.enemies;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dead) this.pool.push(e); else list[w++] = e;
    }
    if (w !== list.length) {
      list.length = w;
      Grid.rebuild(list); // Indizes im Raster passen sonst nicht mehr zur Liste
    }
  },
  render(a) {
    const t = G.time;
    for (const k in this.inst) this.inst[k].begin();
    const sh = this.shadows, blob = Settings.quality !== 'high';
    sh.begin();
    for (const e of G.enemies) {
      const inst = this.inst[e.type];
      const x = ilerp(e.px, e.x, a), z = ilerp(e.pz, e.z, a);
      let y = ilerp(e.py, e.y, a);
      let sx = e.scale, sy = e.scale, sz = e.scale, tilt = 0, roll = 0;
      const moveK = clamp(Math.hypot(e.vx, e.vz) / Math.max(e.speed, 0.1), 0, 1);
      const ty = e.type, rot = ilerp(e.prot, e.rot, a);
      let r = 1, g = 1, b = 1;
      if (ty === 'slime' || ty === 'bigSlime') {
        const big = ty === 'bigSlime', bb = Math.sin(t * (big ? 6 : 9) + e.phase);
        sy *= 1 + bb * 0.14; sx *= 1 - bb * 0.07; sz *= 1 - bb * 0.07;
        y += Math.max(0, bb) * (big ? 0.2 : 0.12) * moveK;
      } else if (ty === 'bat') {
        sx *= 0.75 + Math.abs(Math.sin(t * 16 + e.phase)) * 0.45;
      } else if (ty === 'ghost') {
        y += Math.sin(t * 2 + e.phase) * 0.2;
        tilt = 0.15;
      } else if (ty === 'wisp') {
        y += Math.sin(t * 5 + e.phase) * 0.15;
        roll = Math.sin(t * 3.2 + e.phase) * 0.4; tilt = 0.15;
        if (!e.dying) FX.glow.add(x, y + 0.32, z, 1.7, 0.45, 0.95, 1, 0.5);
      } else {
        const fast = e.mode === 2 ? 2.2 : 1;
        const st = t * (6 + e.speed * 1.5) * fast + e.phase;
        y += Math.abs(Math.sin(st)) * 0.12 * Math.max(moveK, e.mode === 2 ? 1 : 0);
        roll = Math.sin(st) * 0.1 * moveK;
        tilt = e.mode === 2 ? 0.28 : 0.08 * moveK;
        if (e.mode === 1) {
          roll = Math.sin(t * 34) * 0.07; tilt = -0.12;
          const pu = 0.5 + 0.5 * Math.sin(t * 22);
          r = 1.3 + pu * 0.6; g = b = 0.75;
        }
        if (ty === 'bomber' && !e.dying) {
          const wp = enemyPoint(x, y, z, rot, e.scale, 0, 1.52, 0.05);
          if (e.fuseT > 0) {
            const k = 1 - e.fuseT / e.def.fuse.time, s2 = 1 + k * 0.35 + Math.sin(t * 40) * 0.04 * k;
            sx *= s2; sy *= s2; sz *= s2;
            if (Math.sin(t * (14 + k * 34)) > 0) { r = 2.3; g = b = 1.1; }
            FX.glow.add(wp.x, wp.y, wp.z, 0.9 + Math.random() * 0.5, 1, 0.6, 0.2, 0.95);
          } else FX.glow.add(wp.x, wp.y, wp.z, 0.45 + Math.random() * 0.2, 1, 0.7, 0.3, 0.7);
        } else if (ty === 'frost' && !e.dying) {
          const wp = enemyPoint(x, y, z, rot, e.scale, 0.44, 0.98, 0.46);
          FX.glow.add(wp.x, wp.y, wp.z, 1.0, 0.55, 0.9, 1, 0.45);
        } else if (ty === 'shaman' && !e.dying) {
          const wp = enemyPoint(x, y, z, rot, e.scale, 0.46, 1.74, 0.22);
          FX.glow.add(wp.x, wp.y, wp.z, 1.3 + Math.exp(-(t - e.hitAt) * 4) * 2, 0.45, 1, 0.5, 0.55);
        }
      }
      if (e.confT > 0 && !e.dying) {
        const ca = t * 6 + e.phase;
        FX.glow.add(x + Math.sin(ca) * 0.4, y + e.h + 0.25, z + Math.cos(ca) * 0.4, 0.4, 1, 0.9, 0.4, 0.9);
        FX.glow.add(x - Math.sin(ca) * 0.4, y + e.h + 0.25, z - Math.cos(ca) * 0.4, 0.4, 1, 0.9, 0.4, 0.9);
      }
      // Treffer: kurz zusammenquetschen; Landung: abfedern; Auftauchen: aus dem Boden wachsen
      const hk = Math.exp(-(t - e.hitAt) * 14), lk = Math.exp(-(t - e.landAt) * 10);
      const q = hk * 0.22 + lk * 0.3;
      sy *= 1 - q; sx *= 1 + q * 0.6; sz *= 1 + q * 0.6;
      if (e.spawnT > 0) {
        const k = 1 - e.spawnT / 0.5, s = 1 - (1 - k) * (1 - k);
        y -= (1 - s) * e.h * 0.7; sx *= s; sy *= s; sz *= s;
      }
      if (e.ay > 0) { tilt = e.spin; }
      if (e.dying) {
        const k = Math.max(0, e.dyingT / 0.35);
        tilt = e.spin; sx *= k; sy *= k; sz *= k;
      }
      if (e.flash > 0) { r = g = b = 2.4; } else if (e.elite) { r *= 1.5; g *= 1.2; b *= 0.45; }
      inst.add(x, y, z, tilt, rot, roll, sx, sy, sz, r, g, b);
      if (blob && !e.dying) {
        const s = e.r * 2.1;
        sh.add(x, groundHeight(x, z) + 0.05, z, 0, 0, 0, s, 1, s);
      }
      if (e.elite && !e.dying) FX.glow.add(x, y + e.h * 0.6, z, e.r * 3.2, 1, 0.75, 0.2, 0.18);
    }
    for (const k in this.inst) this.inst[k].end();
    sh.end();
  },
};

function damageEnemy(e, amount, w, dirX, dirZ, knock) {
  if (!e.alive) return;
  let dmg = amount * rand(0.9, 1.1);
  const crit = Math.random() < G.stats.crit;
  if (crit) dmg *= G.stats.critDmg;
  // Schildträger blocken alles, was von vorn kommt (Flächenschaden von oben trifft voll)
  let blocked = false;
  if (e.def.shield && !e.boss && e.ay <= 0 && e.confT <= 0 && (dirX || dirZ)) {
    if (dirX * Math.sin(e.rot) + dirZ * Math.cos(e.rot) < -0.3) {
      dmg *= 1 - e.def.shield; knock = (knock || 0) * 0.35; blocked = true;
      if (Math.random() < 0.35) sparkBurst(e.x + Math.sin(e.rot) * 0.75 * e.scale, e.y + 1.1 * e.scale, e.z + Math.cos(e.rot) * 0.75 * e.scale, 3, 0xdfe9ff, 4, 0.3);
    }
  }
  const dealt = Math.min(dmg, Math.max(0, e.hp));
  e.hp -= dmg;
  e.flash = 0.08;
  e.hitAt = G.time;
  if (w) w.dmg += dealt;
  G.totalDamage += dealt;
  if (knock && !e.boss) {
    const k = knock / e.mass;
    e.kvx += dirX * k; e.kvz += dirZ * k;
    if (k >= 8 && !e.def.fly && e.ay <= 0) { e.avy = Math.min(3.5 + k * 0.45, 10); e.ay = 0.001; }
  }
  addNumber(e.x, e.y + e.h + 0.2, e.z, dmg, crit, blocked && Settings.numbers ? '#a9bccf' : undefined);
  if (crit) sparkBurst(e.x, e.y + e.h * 0.6, e.z, 4, 0xffd23f, 4, 0.3);
  if (e.hp <= 0) killEnemy(e, w, dirX, dirZ);
}

function killEnemy(e, w, dx, dz) {
  e.alive = false;
  if (w) w.kills++;
  if (e.boss) { onBossKilled(e); return; }
  G.kills++;
  if (e.warn) { e.warn.done = true; e.warn = null; }
  const sd = e.def.split;
  if (sd) Enemies.queue.push({ type: sd.into, n: sd.n + (e.elite ? 3 : 0), x: e.x, z: e.z });
  // Ein abgeschossener Knallpilz explodiert mitten in seinen Freunden
  if (e.def.fuse) EnemyShots.blasts.push({ x: e.x, z: e.z, r: e.def.fuse.r * e.scale, dmg: e.maxHp * 1.2 });
  e.dying = true; e.dyingT = 0.35;
  e.vy = 6 + Math.random() * 4; e.yOff = e.ay;
  const l = Math.hypot(dx || 0, dz || 0) || 1;
  e.kvx = ((dx || 0) / l) * 7 + rand(-2, 2); e.kvz = ((dz || 0) / l) * 7 + rand(-2, 2);
  Sound.bonk();
  const col = ENEMY_COLORS[e.type];
  const cy = e.y + e.h * 0.5;
  spawnBurst(e.x, cy, e.z, e.elite ? 14 : 5, col, 5, 0.38);
  smokeBurst(e.x, cy, e.z, e.elite ? 6 : 2, 0xf4efe6, 1.2, 2);
  sparkBurst(e.x, cy, e.z, e.elite ? 10 : 3, 0xfff2b0, 5, 0.3);
  dropXp(e.x, e.z, e.xp);
  const m = G.time / 60;
  if (Math.random() < 0.09 || e.elite) dropCoins(e.x, e.z, e.elite ? 20 : 1 + Math.floor(m / 3));
  if (Math.random() < 0.012) dropItem(e.x, e.z, 'food');
  else if (Math.random() < 0.0035) dropItem(e.x, e.z, 'magnet');
  if (e.elite) spawnChest(e.x, e.z, true);
}

function bomberBlast(e) {
  const fu = e.def.fuse, r = fu.r * e.scale, p = G.player, gy = groundHeight(e.x, e.z);
  if ((p.x - e.x) ** 2 + (p.z - e.z) ** 2 < (r + 0.3) ** 2 && p.y - gy < 2.5) hurtPlayer(fu.dmg * enemyDmgScale(G.time / 60), 'bomber');
  e.alive = false; e.dead = true;
  if (e.warn) { e.warn.done = true; e.warn = null; }
  ringFx(e.x, e.z, r, 0xff5a3a, 0.35);
  Effects.add('disc', e.x, e.z, { color: 0xff7a3a, dur: 0.25, r0: r * 0.4, r1: r, op: 0.5, ease: true });
  spawnSpark(e.x, gy + 0.8, e.z, 0, 0, 0, 0.18, r * 2.4, 0xffe0a0, 0);
  sparkBurst(e.x, gy + 0.6, e.z, 14, 0xff7a3a, 7, 0.45);
  smokeBurst(e.x, gy + 0.6, e.z, 6, 0x8a7a70, r * 0.9, 2.5);
  spawnBurst(e.x, gy + 0.6, e.z, 6, 0xe8423a, 6, 0.35);
  Sound.boom();
  G.shake = Math.min(1, G.shake + 0.15);
}

function shamanHeal(e, hl) {
  Grid.query(e.x, e.z, hl.r, (o) => {
    if (o === e || o.boss || o.hp >= o.maxHp) return;
    o.hp = Math.min(o.maxHp, o.hp + o.maxHp * hl.pct);
    spawnSpark(o.x, o.y + o.h + 0.2, o.z, 0, 2.2, 0, 0.6, 0.55, 0x7dff8a, 0);
  });
  ringFx(e.x, e.z, hl.r, 0x7dff8a, 0.6, 0.15);
  if ((e.x - G.player.x) ** 2 + (e.z - G.player.z) ** 2 < 400) Sound.heal();
  const wp = enemyPoint(e.x, e.y, e.z, e.rot, e.scale, 0.46, 1.74, 0.22);
  sparkBurst(wp.x, wp.y, wp.z, 6, 0x9dffa6, 3, 0.35);
  e.hitAt = G.time - 0.05;
}

// ---------- Gegner-Geschosse und Gefahren ----------
const EnemyShots = { list: [], inst: null, waves: [], rocks: [], blasts: [] };
function fireEnemyOrb(x, y, z, dx, dz, speed, dmg, color, slow, slowT) {
  EnemyShots.list.push({ x, y, z, px: x, py: y, pz: z, vx: dx * speed, vz: dz * speed, life: 5, dmg, r: 0.35, color: new THREE.Color(color || 0xff6ab0), slow: slow || 0, slowT: slowT || 0 });
}
function updateEnemyShots(dt) {
  const p = G.player, list = EnemyShots.list;
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    s.px = s.x; s.py = s.y; s.pz = s.z;
    s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt;
    const gh = groundHeight(s.x, s.z);
    if (s.low) s.y = gh + 0.55;
    let hit = false;
    const dx = s.x - p.x, dz = s.z - p.z;
    if (dx * dx + dz * dz < (s.r + 0.45) ** 2 && p.y < s.y + s.r && p.y + 1.7 > s.y - s.r) {
      hurtPlayer(s.dmg, s.slow ? 'frost' : 'spitter'); hit = true;
      if (s.slow && p.dashT <= 0) { p.slowT = Math.max(p.slowT, s.slowT); p.slowAmt = s.slow; }
    }
    if (hit || s.life <= 0 || s.y < gh - 0.2) {
      sparkBurst(s.x, s.y, s.z, 5, s.color.getHex(), 3, 0.3);
      list.splice(i, 1);
    }
  }
  // Explosionen abgeschossener Knallpilze (Kettenreaktion im nächsten Schritt)
  if (EnemyShots.blasts.length) {
    const bl = EnemyShots.blasts;
    EnemyShots.blasts = [];
    for (const b of bl) explode(b.x, b.z, b.r, b.dmg, null, 6, 0xff6a3a);
  }
  // Schockwellen (Bosse): überspringen!
  for (let i = EnemyShots.waves.length - 1; i >= 0; i--) {
    const w = EnemyShots.waves[i];
    w.R += w.speed * dt;
    const d = Math.hypot(p.x - w.x, p.z - w.z);
    const feet = p.y - groundHeight(p.x, p.z);
    if (!w.hit && Math.abs(d - w.R) < 0.9 && feet < 0.9) { w.hit = true; hurtPlayer(w.dmg, 'boss'); }
    w.mesh.scale.set(w.R, 1, w.R);
    w.mesh.position.set(w.x, groundHeight(w.x, w.z) + 0.3, w.z);
    w.mesh.material.opacity = 0.8 * (1 - w.R / w.maxR);
    if (w.R >= w.maxR) { W.scene.remove(w.mesh); w.mesh.material.dispose(); EnemyShots.waves.splice(i, 1); }
  }
  // Fallende Felsbrocken
  for (let i = EnemyShots.rocks.length - 1; i >= 0; i--) {
    const r = EnemyShots.rocks[i];
    r.t += dt;
    if (r.t >= r.T) {
      if (Math.hypot(p.x - r.tx, p.z - r.tz) < r.r + 0.4 && p.y - groundHeight(p.x, p.z) < 2) hurtPlayer(r.dmg, 'boss');
      ringFx(r.tx, r.tz, r.r, 0x9a8a78, 0.35);
      spawnBurst(r.tx, groundHeight(r.tx, r.tz) + 0.3, r.tz, 10, 0x8a8478, 6, 0.55);
      smokeBurst(r.tx, groundHeight(r.tx, r.tz) + 0.4, r.tz, 6, 0xc9bfae, 2, 3);
      Sound.boom();
      G.shake = Math.min(1, G.shake + 0.2);
      r.warn.done = true;
      EnemyShots.rocks.splice(i, 1);
    }
  }
}
function addShockwave(x, z, maxR, speed, dmg) {
  const m = new THREE.MeshBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
  const mesh = new THREE.Mesh(Effects.wallGeo, m);
  W.scene.add(mesh);
  EnemyShots.waves.push({ x, z, R: 0.5, maxR, speed, dmg, hit: false, mesh });
}
function addRock(sx, sz, tx, tz, dmg) {
  const T = 1.1;
  EnemyShots.rocks.push({ sx, sz, tx, tz, t: 0, T, dmg, r: 2.2, warn: warnFx(tx, tz, 2.2, T) });
}
function renderEnemyShots(a) {
  const inst = EnemyShots.inst;
  inst.begin();
  for (const s of EnemyShots.list) {
    const x = ilerp(s.px, s.x, a), y = ilerp(s.py, s.y, a), z = ilerp(s.pz, s.z, a);
    inst.add(x, y, z, 0, 0, 0, s.r * 2, s.r * 2, s.r * 2, s.color.r * 2.2, s.color.g * 2.2, s.color.b * 2.2);
    FX.glow.add(x, y, z, 1.6, s.color.r, s.color.g, s.color.b, 0.55);
  }
  inst.end();
  const ri = Effects.rockInst;
  ri.begin();
  for (const r of EnemyShots.rocks) {
    const k = Math.min(1, (r.t + FX.dt * a) / r.T);
    const x = lerp(r.sx, r.tx, k), z = lerp(r.sz, r.tz, k);
    const y = lerp(groundHeight(r.sx, r.sz) + 5, groundHeight(r.tx, r.tz), k) + Math.sin(k * Math.PI) * 9;
    ri.add(x, y, z, k * 6, k * 4, 0, 1.4, 1.4, 1.4);
  }
  ri.end();
}

// ---------- Sammelobjekte ----------
const Pickups = { gems: [], coins: [], items: [], gemInst: null, coinInst: null };
const GEM_TIERS = [
  { max: 3, color: new THREE.Color(0x3ee0ff), size: 0.42 },
  { max: 10, color: new THREE.Color(0x5ee08a), size: 0.55 },
  { max: 40, color: new THREE.Color(0xff4d6d), size: 0.7 },
  { max: Infinity, color: new THREE.Color(0xc58bff), size: 0.9 },
];
function dropXp(x, z, value) {
  const list = Pickups.gems;
  if (list.length >= 520) {
    const g = list[Math.floor(Math.random() * list.length)];
    g.v += value;
    return;
  }
  const gx = x + rand(-0.3, 0.3), gz = z + rand(-0.3, 0.3);
  list.push({ x: gx, z: gz, px: gx, pz: gz, v: value, att: false, sp: 0, t: Math.random() * 10, pop: 0.35 });
}
function dropCoins(x, z, value) {
  value = value * G.stats.gold;
  const n = Math.min(5, Math.max(1, Math.round(value / 4)));
  for (let i = 0; i < n; i++) {
    if (Pickups.coins.length > 220) { G.gold += value / n; continue; }
    const cx = x + rand(-0.6, 0.6), cz = z + rand(-0.6, 0.6);
    Pickups.coins.push({ x: cx, z: cz, px: cx, pz: cz, v: value / n, att: false, sp: 0, t: Math.random() * 10, vy: rand(4, 7), y: 0.5, py: 0.5 });
  }
}
function dropItem(x, z, kind) {
  const mesh = kind === 'food' ? Pickups.foodModel.clone() : Pickups.magnetModel.clone();
  W.scene.add(mesh);
  Pickups.items.push({ x, z, px: x, pz: z, kind, att: false, sp: 0, t: 0, mesh, life: 60 });
}
function initPickups() {
  const gemMat = GFX.hq ? new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x404040, roughness: 0.15, metalness: 0.1, flatShading: true })
    : new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x404040, flatShading: true });
  Pickups.gemInst = new Instancer(GEO.oct, gemMat, 560, true);
  const coinGeo = mergeParts([
    { geo: GEO.cyl12, color: 0xffd23f, scale: [0.6, 0.08, 0.6], rot: [Math.PI / 2, 0, 0] },
    { geo: GEO.cyl12, color: 0xffe680, pos: [0, 0, 0.045], scale: [0.4, 0.02, 0.4], rot: [Math.PI / 2, 0, 0] },
  ]);
  Pickups.coinInst = new Instancer(coinGeo, mat({ vertexColors: true, metal: 0.5, rough: 0.3, emissive: 0x4a3400 }), 240);
  const food = new THREE.Group();
  shape(food, GEO.ball2, mat({ color: 0xb5562d, rough: 0.6, rim: true }), 0.7, 0.55, 0.55, 0.15, 0, 0);
  shape(food, GEO.capsule, mat({ color: 0xf6efd8 }), 0.12, 0.3, 0.12, -0.35, 0, 0, 0, 0, Math.PI / 2);
  shape(food, GEO.ball2, mat({ color: 0xf6efd8 }), 0.2, 0.2, 0.2, -0.62, 0.07, 0);
  shape(food, GEO.ball2, mat({ color: 0xf6efd8 }), 0.2, 0.2, 0.2, -0.62, -0.07, 0);
  Pickups.foodModel = food;
  const mag = new THREE.Group();
  const tor = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 8, 16, Math.PI), mat({ color: 0xe63946, rough: 0.4, rim: true }));
  tor.rotation.z = Math.PI; mag.add(tor);
  box(mag, mat({ color: 0xdfe6ee, metal: 0.6, rough: 0.3 }), 0.24, 0.2, 0.24, -0.35, 0.05, 0);
  box(mag, mat({ color: 0xdfe6ee, metal: 0.6, rough: 0.3 }), 0.24, 0.2, 0.24, 0.35, 0.05, 0);
  Pickups.magnetModel = mag;
}
function updatePickups(dt) {
  const p = G.player, R = G.stats.pickup, R2 = R * R;
  const move = (o, collectR) => {
    o.px = o.x; o.pz = o.z;
    const dx = p.x - o.x, dz = p.z - o.z, d2 = dx * dx + dz * dz;
    if (!o.att && d2 < R2) o.att = true;
    if (o.att) {
      o.sp = Math.min(o.sp + dt * 42, 40);
      const d = Math.sqrt(d2) || 0.01;
      const mv = Math.min(d, o.sp * dt);
      o.x += (dx / d) * mv; o.z += (dz / d) * mv;
      return d < collectR;
    }
    return false;
  };
  const gems = Pickups.gems;
  for (let i = gems.length - 1; i >= 0; i--) {
    const g = gems[i];
    g.t += dt; if (g.pop > 0) g.pop -= dt;
    if (move(g, 0.8)) {
      gainXp(g.v);
      Sound.xp();
      const tier = gemTier(g.v);
      sparkBurst(p.x, p.y + 1, p.z, 2, tier.color.getHex(), 2, 0.25);
      gems[i] = gems[gems.length - 1]; gems.pop();
    }
  }
  const coins = Pickups.coins;
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.t += dt; c.py = c.y;
    if (c.vy !== 0) { c.vy -= 20 * dt; c.y += c.vy * dt; if (c.y <= 0.45) { c.y = 0.45; c.vy = 0; } }
    if (move(c, 0.8)) {
      G.gold += c.v; G.goldEarned += c.v;
      Sound.coin();
      sparkBurst(p.x, p.y + 1, p.z, 2, 0xffd23f, 2, 0.25);
      coins[i] = coins[coins.length - 1]; coins.pop();
    }
  }
  const items = Pickups.items;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.t += dt; it.life -= dt;
    const got = move(it, 0.9);
    if (got) {
      if (it.kind === 'food') { healPlayer(G.stats.maxHp * 0.3); Sound.pick(); }
      else { for (const g of gems) g.att = true; for (const c of coins) c.att = true; Sound.pick(); UI.banner('Magnet!', 'Alle Kristalle fliegen zu dir.', 1.2); }
    }
    if (got || it.life <= 0) { W.scene.remove(it.mesh); items.splice(i, 1); }
  }
}
function gemTier(v) {
  for (const tt of GEM_TIERS) if (v < tt.max) return tt;
  return GEM_TIERS[GEM_TIERS.length - 1];
}
function renderPickups(a) {
  const gi = Pickups.gemInst, t = G.time;
  gi.begin();
  for (const g of Pickups.gems) {
    const tier = gemTier(g.v), c = tier.color;
    const x = ilerp(g.px, g.x, a), z = ilerp(g.pz, g.z, a);
    const pop = g.pop > 0 ? Math.sin((1 - g.pop / 0.35) * Math.PI) * 0.8 : 0;
    const y = groundHeight(x, z) + 0.5 + Math.sin(g.t * 3) * 0.12 + pop;
    gi.add(x, y, z, 0, g.t * 2, 0, tier.size, tier.size * 1.35, tier.size, c.r * 1.3, c.g * 1.3, c.b * 1.3);
    FX.glow.add(x, y, z, tier.size * 2.4, c.r, c.g, c.b, 0.32);
  }
  gi.end();
  const ci = Pickups.coinInst;
  ci.begin();
  for (const c of Pickups.coins) {
    const x = ilerp(c.px, c.x, a), z = ilerp(c.pz, c.z, a), y = groundHeight(x, z) + ilerp(c.py, c.y, a) + Math.sin(c.t * 4) * 0.08;
    ci.add(x, y, z, 0, c.t * 4, 0, 1, 1, 1);
    if (Math.sin(c.t * 5) > 0.97) FX.glow.add(x + 0.15, y + 0.2, z, 0.6, 1, 0.9, 0.5, 0.8);
  }
  ci.end();
  for (const it of Pickups.items) {
    const x = ilerp(it.px, it.x, a), z = ilerp(it.pz, it.z, a), y = groundHeight(x, z) + 0.75 + Math.sin(it.t * 3) * 0.15;
    it.mesh.position.set(x, y, z);
    it.mesh.rotation.y = it.t * 2;
    const c = it.kind === 'food' ? [1, 0.55, 0.4] : [1, 0.3, 0.35];
    FX.glow.add(x, y, z, 2.4, c[0], c[1], c[2], 0.3);
  }
}

// ---------- Partikel: Splitter (3D), Funken (leuchtend) und Rauch (weich) ----------
const Particles = { list: [], inst: null, sparks: [], smoke: [] };
const FX = { glow: null, soft: null, dt: 1 / 60 };
function initParticles() {
  Particles.inst = new Instancer(GEO.rbox, mat({ color: 0xffffff, rough: 0.7 }), 520, true);
  const q = QUALITY[Settings.quality];
  FX.glow = new PointCloud(q.glow, true);
  FX.soft = new PointCloud(400, false);
}
const _pc = new THREE.Color();
function spawnParticle(x, y, z, vx, vy, vz, life, size, r, g, b, grav = 0) {
  const max = QUALITY[Settings.quality].particles;
  if (Particles.list.length >= max) return;
  Particles.list.push({ x, y, z, vx, vy, vz, life, max: life, size, r, g, b, grav, rx: Math.random() * 6, ry: Math.random() * 6 });
}
function spawnBurst(x, y, z, n, color, speed, size) {
  _pc.set(color);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, u = Math.random();
    spawnParticle(x, y, z, Math.cos(a) * speed * u, rand(0.5, 1.2) * speed, Math.sin(a) * speed * u,
      rand(0.35, 0.65), size * rand(0.5, 1), _pc.r, _pc.g, _pc.b, 18);
  }
}
function spawnSpark(x, y, z, vx, vy, vz, life, size, color, grav = 6) {
  if (Particles.sparks.length >= 600) return;
  _pc.set(color);
  Particles.sparks.push({ x, y, z, vx, vy, vz, life, max: life, size, r: _pc.r, g: _pc.g, b: _pc.b, grav });
}
function sparkBurst(x, y, z, n, color, speed, size) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, u = rand(0.3, 1);
    spawnSpark(x, y, z, Math.cos(a) * speed * u, rand(0.2, 1.1) * speed, Math.sin(a) * speed * u, rand(0.25, 0.55), size * rand(0.7, 1.3), color, 9);
  }
}
function smokeBurst(x, y, z, n, color, size, speed) {
  _pc.set(color);
  for (let i = 0; i < n; i++) {
    if (Particles.smoke.length >= 380) return;
    const a = Math.random() * TAU, u = Math.random();
    Particles.smoke.push({ x, y, z, vx: Math.cos(a) * speed * u, vy: rand(0.3, 1.2), vz: Math.sin(a) * speed * u,
      life: rand(0.45, 0.8), max: 0.8, size: size * rand(0.7, 1.2), r: _pc.r, g: _pc.g, b: _pc.b });
  }
}
function splash(x, z, n) {
  const y = CONFIG.WATER_LEVEL + 0.05;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, u = rand(0.5, 1.5);
    spawnSpark(x, y, z, Math.cos(a) * u, rand(2, 4.5), Math.sin(a) * u, rand(0.3, 0.5), 0.3, 0xd8f4ff, 14);
  }
  if (n > 3) Effects.add('ring', x, z, { color: 0xe8f8ff, dur: 0.5, r0: 0.3, r1: 1.4, op: 0.6, ease: true, y: CONFIG.WATER_LEVEL - groundHeight(x, z) + 0.04 });
}
function updateParticles(dt) {
  const list = Particles.list, inst = Particles.inst;
  inst.begin();
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    p.life -= dt;
    if (p.life <= 0) { list[i] = list[list.length - 1]; list.pop(); continue; }
    p.vy -= p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const gh = groundHeight(p.x, p.z);
    if (p.y < gh + 0.05) { p.y = gh + 0.05; p.vy *= -0.35; p.vx *= 0.6; p.vz *= 0.6; }
    const s = p.size * Math.min(1, (p.life / p.max) * 2);
    p.rx += dt * 8; p.ry += dt * 6;
    inst.add(p.x, p.y, p.z, p.rx, p.ry, 0, s, s, s, p.r, p.g, p.b);
  }
  inst.end();
  const sp = Particles.sparks;
  for (let i = sp.length - 1; i >= 0; i--) {
    const p = sp[i];
    p.life -= dt;
    if (p.life <= 0) { sp[i] = sp[sp.length - 1]; sp.pop(); continue; }
    p.vy -= p.grav * dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const k = p.life / p.max;
    FX.glow.add(p.x, p.y, p.z, p.size * (0.5 + k * 0.7), p.r, p.g, p.b, Math.min(1, k * 1.6));
  }
  const sm = Particles.smoke;
  for (let i = sm.length - 1; i >= 0; i--) {
    const p = sm[i];
    p.life -= dt;
    if (p.life <= 0) { sm[i] = sm[sm.length - 1]; sm.pop(); continue; }
    const drag = Math.exp(-3 * dt);
    p.vx *= drag; p.vz *= drag; p.vy *= drag;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const k = p.life / p.max;
    FX.soft.add(p.x, p.y, p.z, p.size * (1.6 - k * 0.8), p.r, p.g, p.b, Math.min(0.55, k * 0.9));
  }
}

// ---------- Flächeneffekte (Ringe, Hiebe, Warnkreise, Blitze) ----------
function arcGeometry(inner, outer, start, length, segs) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const u = i / segs, a = start + u * length;
    const c = Math.cos(a), s = Math.sin(a);
    pos.push(c * inner, 0, s * inner, c * outer, 0, s * outer);
    uv.push(u, 0, u, 1);
    if (i < segs) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
const Effects = {
  list: [], pools: {}, beams: null, beamList: [], rockInst: null,
  init() {
    this.geos = {
      ring: new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2),
      disc: new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2),
      // Bogen nach vorne (+z), 2,6 rad breit
      slash: arcGeometry(0.25, 1, Math.PI / 2 - 1.3, 2.6, 24),
    };
    this.wallGeo = new THREE.CylinderGeometry(1, 1, 0.9, 64, 1, true);
    this.beams = new Instancer(GEO.box, new THREE.MeshBasicMaterial({ color: 0xffffff }), 260, true);
    this.rockInst = new Instancer(GEO.dodeca, mat({ color: 0x8a8478, flat: true }), 32, false, true);
  },
  get(kind) {
    const pool = this.pools[kind] || (this.pools[kind] = []);
    let m = pool.find((x) => !x.visible);
    if (!m) {
      const opts = { transparent: true, depthWrite: false, side: THREE.DoubleSide };
      if (kind === 'slash') { opts.map = GFX.slashTex; opts.blending = THREE.AdditiveBlending; }
      m = new THREE.Mesh(this.geos[kind], new THREE.MeshBasicMaterial(opts));
      m.renderOrder = 2;
      W.scene.add(m);
      pool.push(m);
    }
    m.visible = true;
    return m;
  },
  add(kind, x, z, opts) {
    const m = this.get(kind);
    m.material.color.set(opts.color);
    const fx = Object.assign({ mesh: m, x, z, t: 0, dur: 0.3, r0: 1, r1: 1, op: 0.7, rot: 0, y: 0.12, follow: null }, opts);
    m.rotation.set(0, fx.rot, 0);
    this.list.push(fx);
    this.place(fx, 0);
    return fx;
  },
  place(fx, k) {
    const m = fx.mesh;
    let x = fx.x, z = fx.z;
    if (fx.follow) { x = fx.follow.x; z = fx.follow.z; }
    const r = lerp(fx.r0, fx.r1, fx.ease ? 1 - (1 - k) * (1 - k) : k);
    m.scale.set(r, 1, r);
    m.position.set(x, groundHeight(x, z) + fx.y, z);
    m.material.opacity = fx.op * (fx.fadeIn ? Math.min(1, k * 3) : 1 - k * k);
  },
  update(dt) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const fx = this.list[i];
      fx.t += dt;
      const k = Math.min(1, fx.t / fx.dur);
      if (fx.done || k >= 1) { fx.mesh.visible = false; this.list.splice(i, 1); continue; }
      this.place(fx, k);
    }
    const b = this.beams;
    b.begin();
    for (let i = this.beamList.length - 1; i >= 0; i--) {
      const s = this.beamList[i];
      s.life -= dt;
      if (s.life <= 0) { this.beamList.splice(i, 1); continue; }
      const k = s.life / s.max;
      b.add(s.x, s.y, s.z, s.pitch, s.yaw, 0, s.w * k, s.w * k, s.len, s.r, s.g, s.b);
      FX.glow.add(s.x, s.y, s.z, 1.2 * k + 0.3, s.r * 0.5, s.g * 0.5, s.b * 0.6, 0.5 * k);
    }
    b.end();
  },
  clear() {
    for (const fx of this.list) fx.mesh.visible = false;
    this.list.length = 0; this.beamList.length = 0;
  },
};
function ringFx(x, z, r, color, dur = 0.3, from = 0.3) {
  return Effects.add('ring', x, z, { color, dur, r0: r * from, r1: r, op: 0.85, ease: true });
}
function warnFx(x, z, r, dur) {
  return Effects.add('disc', x, z, { color: 0xff3b3b, dur, r0: r * 0.2, r1: r, op: 0.45, fadeIn: true, y: 0.1 });
}
function slashFx(x, z, angle, r, color, y = 0.9) {
  return Effects.add('slash', x, z, { color, dur: 0.22, r0: r * 0.75, r1: r * 1.05, op: 1, rot: angle, y, ease: true });
}
// Zackiger Blitz zwischen Punkten
function beamFx(points, color) {
  _pc.set(color);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    let px = a.x, py = a.y, pz = a.z;
    const segs = 3;
    for (let s = 1; s <= segs; s++) {
      const k = s / segs;
      let nx = lerp(a.x, b.x, k), ny = lerp(a.y, b.y, k), nz = lerp(a.z, b.z, k);
      if (s < segs) { nx += rand(-0.5, 0.5); ny += rand(-0.4, 0.4); nz += rand(-0.5, 0.5); }
      const dx = nx - px, dy = ny - py, dz = nz - pz, len = Math.hypot(dx, dy, dz);
      Effects.beamList.push({
        x: (px + nx) / 2, y: (py + ny) / 2, z: (pz + nz) / 2,
        yaw: Math.atan2(dx, dz), pitch: -Math.atan2(dy, Math.hypot(dx, dz)),
        len, w: 0.14, life: 0.18, max: 0.18, r: _pc.r * 2, g: _pc.g * 2, b: _pc.b * 2,
      });
      px = nx; py = ny; pz = nz;
    }
    sparkBurst(b.x, b.y, b.z, 3, color, 3, 0.3);
  }
}

// ---------- Schadenszahlen und Texte ----------
const Popups = { list: [] };
function addNumber(x, y, z, val, crit, color) {
  if (!Settings.numbers && !color) return;
  const max = QUALITY[Settings.quality].numbers;
  if (Popups.list.length >= max) Popups.list.shift();
  Popups.list.push({ x: x + rand(-0.3, 0.3), y, z, vx: rand(-0.8, 0.8), text: fmtNum(Math.max(1, val)) + (crit ? '!' : ''), crit, color: color || (crit ? '#ffcf33' : '#ffffff'), life: 0.75, max: 0.75 });
}
function addText(x, y, z, text, color) {
  Popups.list.push({ x, y, z, vx: 0, text, crit: true, color, life: 1.1, max: 1.1 });
}
function updatePopups(dt) {
  for (let i = Popups.list.length - 1; i >= 0; i--) {
    const p = Popups.list[i];
    p.life -= dt; p.y += dt * (0.6 + 2.2 * (p.life / p.max)); p.x += p.vx * dt;
    if (p.life <= 0) Popups.list.splice(i, 1);
  }
}
