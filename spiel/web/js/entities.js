'use strict';
// Rumms! – Spielfigur, Gegner, Sammelobjekte, Partikel, Effekte und Schadenszahlen.

// Zeichnet viele gleiche Objekte mit einem einzigen Draw-Call.
class Instancer {
  constructor(geo, mat, cap, colored) {
    this.mesh = new THREE.InstancedMesh(geo, mat, cap);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
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
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
Instancer.all = [];
Instancer.dummy = new THREE.Object3D();
Instancer.dummy.rotation.order = 'YXZ';

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
          if (e.alive) {
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
function createPlayer(charDef) {
  const model = buildHero(charDef.id);
  W.scene.add(model);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  W.scene.add(shadow);
  return {
    x: 0, z: 0, y: groundHeight(0, 0), vx: 0, vz: 0, vy: 0,
    facing: 0, grounded: true, jumpsLeft: 1, coyote: 0, jumpBuffer: 0,
    hp: 100, iframes: 0, dashT: 0, dashCd: 0, dashX: 0, dashZ: 1,
    moving: false, animT: 0, flash: 0, swingT: 0,
    model, shadow,
  };
}

function updatePlayer(dt) {
  const p = G.player, s = G.stats, inp = Input;
  // Bewegung relativ zur Kamera
  const fx = -Math.sin(G.camYaw), fz = -Math.cos(G.camYaw);
  const rx = -fz, rz = fx;
  let mx = rx * inp.moveX + fx * inp.moveY, mz = rz * inp.moveX + fz * inp.moveY;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  p.moving = ml > 0.05;
  const tx = mx * s.speed, tz = mz * s.speed;
  const accel = p.grounded ? 40 : 18;
  p.vx += clamp(tx - p.vx, -accel * dt, accel * dt);
  p.vz += clamp(tz - p.vz, -accel * dt, accel * dt);
  if (p.moving) p.facing += angleDiff(p.facing, Math.atan2(mx, mz)) * Math.min(1, dt * 14);

  // Sprinten (Dash)
  p.dashCd -= dt;
  if (inp.dashPressed) {
    inp.dashPressed = false;
    if (p.dashCd <= 0) {
      p.dashT = 0.22; p.dashCd = 1.8;
      const dx = p.moving ? mx / Math.max(ml, 0.01) : Math.sin(p.facing), dz = p.moving ? mz / Math.max(ml, 0.01) : Math.cos(p.facing);
      const l = Math.hypot(dx, dz) || 1;
      p.dashX = dx / l; p.dashZ = dz / l;
      Sound.dash();
      spawnBurst(p.x, p.y + 0.4, p.z, 8, 0xffffff, 4, 0.35);
    }
  }
  let vx = p.vx, vz = p.vz;
  if (p.dashT > 0) {
    p.dashT -= dt;
    vx = p.dashX * s.speed * 3.2; vz = p.dashZ * s.speed * 3.2;
    if (Math.random() < 0.6) spawnParticle(p.x, p.y + 0.5, p.z, rand(-1, 1), rand(0, 1), rand(-1, 1), 0.3, 0.2, 0.9, 0.9, 1);
  }

  // Springen mit Pufferzeit und Koyote-Zeit
  p.jumpBuffer -= dt; p.coyote -= dt;
  if (inp.jumpPressed) { inp.jumpPressed = false; p.jumpBuffer = 0.14; }
  if (p.jumpBuffer > 0) {
    if (p.grounded || p.coyote > 0) {
      p.vy = 10.5; p.grounded = false; p.coyote = 0; p.jumpBuffer = 0; p.jumpsLeft = s.jumps - 1;
      Sound.jump();
    } else if (p.jumpsLeft > 0) {
      p.vy = 9.5; p.jumpsLeft--; p.jumpBuffer = 0;
      Sound.jump();
      spawnBurst(p.x, p.y, p.z, 10, 0xffffff, 3, 0.4);
    }
  }
  p.vy -= 28 * dt;
  p.x += vx * dt; p.z += vz * dt; p.y += p.vy * dt;

  const H = CONFIG.MAP_HALF;
  p.x = clamp(p.x, -H, H); p.z = clamp(p.z, -H, H);
  let gh = groundHeight(p.x, p.z);
  pushOutOfObstacles(p, 0.45, p.y - gh);
  gh = groundHeight(p.x, p.z);
  if (p.y <= gh) {
    if (!p.grounded && p.vy < -12) spawnBurst(p.x, gh + 0.1, p.z, 8, 0xd9c49a, 3, 0.35);
    p.y = gh; p.vy = 0; p.grounded = true; p.jumpsLeft = s.jumps - 1;
  } else if (p.grounded && p.y - gh < 0.35 && p.vy <= 0) {
    p.y = gh; p.vy = 0; // Hügel hinunterlaufen ohne abzuheben
  } else {
    if (p.grounded) p.coyote = 0.1;
    p.grounded = false;
  }

  // Regeneration, Unverwundbarkeit
  if (s.regen > 0 && p.hp < s.maxHp) p.hp = Math.min(s.maxHp, p.hp + s.regen * dt);
  p.iframes -= dt;
  p.flash -= dt;
  p.swingT -= dt;

  // Animation
  const speed = Math.hypot(vx, vz);
  p.animT += dt * (4 + speed * 1.4);
  const u = p.model.userData, m = p.model;
  m.position.set(p.x, p.y, p.z);
  m.rotation.y = p.facing;
  const sw = p.grounded ? Math.sin(p.animT) * Math.min(1, speed / 4) * 0.8 : 0.5;
  u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
  u.armL.rotation.x = -sw * 0.7;
  u.armR.rotation.x = p.swingT > 0 ? -2.2 * (p.swingT / 0.2) : sw * 0.7;
  if (!p.grounded) { u.armL.rotation.z = -0.6; u.armR.rotation.z = 0.6; } else { u.armL.rotation.z = 0; u.armR.rotation.z = 0; }
  u.head.position.y += ((p.grounded ? Math.abs(Math.sin(p.animT)) * 0.05 : 0) - (u.head.position.y - u.head.userData.baseY)) * 0.5;
  const blink = p.iframes > 0 && Math.floor(p.iframes * 20) % 2 === 0;
  m.visible = !blink || p.iframes < 0.05;
  for (const mat of u.mats) {
    if (!mat.userData.baseEmissive) mat.userData.baseEmissive = mat.emissive.clone();
    if (p.flash > 0) mat.emissive.setRGB(0.8, 0.1, 0.1); else mat.emissive.copy(mat.userData.baseEmissive);
  }
  p.shadow.position.set(p.x, gh + 0.06, p.z);
  const sh = clamp(1 - (p.y - gh) / 6, 0.4, 1);
  p.shadow.scale.setScalar(sh);
}

function hurtPlayer(amount) {
  const p = G.player;
  if (p.iframes > 0 || p.dashT > 0 || G.god || G.state !== 'playing') return;
  if (Math.random() < G.stats.evasion) {
    p.iframes = 0.3;
    addText(p.x, p.y + 2.2, p.z, 'Ausgewichen!', '#9fe8ff');
    return;
  }
  const dmg = amount * (1 - G.stats.armor);
  p.hp -= dmg; p.iframes = 0.6; p.flash = 0.15;
  G.damageTaken += dmg;
  Sound.hurt(); vibrate(35);
  UI.hurtFlash();
  addNumber(p.x, p.y + 2.2, p.z, dmg, false, '#ff5a6a');
  if (p.hp <= 0) { p.hp = 0; endRun(false); }
}

function healPlayer(amount) {
  const p = G.player, before = p.hp;
  p.hp = Math.min(G.stats.maxHp, p.hp + amount);
  if (p.hp - before >= 1) addText(p.x, p.y + 2.3, p.z, `+${Math.round(p.hp - before)}`, '#5ee08a');
}

// ---------- Gegner ----------
const Enemies = {
  inst: {}, shadows: null, pool: [],
  init() {
    for (const id of Object.keys(ENEMIES)) {
      const ghost = id === 'ghost';
      const mat = new THREE.MeshLambertMaterial({
        vertexColors: true, flatShading: true,
        transparent: ghost, opacity: ghost ? 0.78 : 1,
      });
      this.inst[id] = new Instancer(enemyGeometry(id), mat, CONFIG.MAX_ENEMIES + 60, true);
    }
    this.shadows = new Instancer(new THREE.CircleGeometry(0.5, 12).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }), CONFIG.MAX_ENEMIES + 80);
  },
  spawn(typeId, x, z, opts = {}) {
    const def = ENEMIES[typeId];
    const m = G.time / 60;
    const e = this.pool.pop() || { hitT: new Float32Array(4) };
    const elite = !!opts.elite;
    const hpMul = enemyHpScale(m) * (elite ? 5 : 1) * (opts.hpMul || 1);
    Object.assign(e, {
      type: typeId, def, x, z, y: groundHeight(x, z) + (def.fly || 0),
      kvx: 0, kvz: 0, vy: 0, yOff: 0,
      hp: def.hp * hpMul, maxHp: def.hp * hpMul,
      r: def.r * (elite ? 1.5 : 1), h: def.h * (elite ? 1.5 : 1), scale: elite ? 1.5 : 1,
      speed: def.speed * (1 + Math.min(m, 15) * 0.012) * (elite ? 0.9 : 1) * rand(0.92, 1.08),
      dmg: def.dmg * enemyDmgScale(m) * (elite ? 1.5 : 1),
      xp: def.xp * (1 + m * 0.05) * (elite ? 6 : 1),
      mass: def.mass * (elite ? 3 : 1),
      elite, boss: false, alive: true, dying: false, dyingT: 0, dead: false,
      rot: 0, flash: 0, slowT: 0, slow: 0, spin: 0,
      shootT: def.ranged ? rand(1, def.ranged.cd) : 0,
      phase: Math.random() * TAU,
    });
    e.hitT.fill(0);
    G.enemies.push(e);
    return e;
  },
  update(dt) {
    const p = G.player, list = G.enemies, t = G.time;
    Grid.rebuild(list);
    const H = CONFIG.MAP_HALF + 2;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.dying) {
        e.dyingT -= dt;
        e.x += e.kvx * dt; e.z += e.kvz * dt;
        e.vy -= 30 * dt; e.yOff += e.vy * dt; e.spin += dt * 14;
        if (e.dyingT <= 0) e.dead = true;
        continue;
      }
      const dx = p.x - e.x, dz = p.z - e.z;
      const d = Math.hypot(dx, dz) || 0.001;
      let mx = dx / d, mz = dz / d;
      if (e.slowT > 0) e.slowT -= dt;
      let sp = e.speed * (e.slowT > 0 ? 1 - e.slow : 1);
      const rg = e.def.ranged;
      if (rg) {
        if (d < rg.keep) { mx = -mx * 0.5; mz = -mz * 0.5; } else if (d < rg.keep + 2.5) sp *= 0.1;
        e.shootT -= dt;
        if (e.shootT <= 0 && d < rg.range) {
          e.shootT = rg.cd * rand(0.85, 1.15);
          fireEnemyOrb(e.x, e.y + 1.1, e.z, dx / d, dz / d, rg.speed, rg.dmg * enemyDmgScale(t / 60), 0xff6ab0);
        }
      }
      e.rot += angleDiff(e.rot, Math.atan2(dx, dz)) * Math.min(1, dt * 8);
      e.x += (mx * sp + e.kvx) * dt;
      e.z += (mz * sp + e.kvz) * dt;
      const decay = Math.exp(-6 * dt);
      e.kvx *= decay; e.kvz *= decay;
      if (e.flash > 0) e.flash -= dt;
    }
    // Gegner schieben sich gegenseitig weg, damit sie nicht in einem Punkt verschmelzen.
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      if (!a.alive || a.def.fly) continue;
      const gx = Grid.idx(a.x), gz = Grid.idx(a.z);
      for (let oz = -1; oz <= 1; oz++) {
        for (let ox = -1; ox <= 1; ox++) {
          const cx = gx + ox, cz = gz + oz;
          if (cx < 0 || cz < 0 || cx >= Grid.n || cz >= Grid.n) continue;
          let j = Grid.head[cz * Grid.n + cx];
          while (j !== -1) {
            if (j > i) {
              const b = list[j];
              if (b.alive && !b.def.fly) {
                const dx = b.x - a.x, dz = b.z - a.z, rr = a.r + b.r;
                const d2 = dx * dx + dz * dz;
                if (d2 < rr * rr && d2 > 1e-6) {
                  const d = Math.sqrt(d2), ov = (rr - d) / d * 0.5;
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
    // Kollision mit Spieler, Hindernissen und Rand; Höhe; Kontaktschaden
    const pr = 0.45;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      const dx = e.x - p.x, dz = e.z - p.z, rr = e.r + pr;
      const d2 = dx * dx + dz * dz;
      if (!e.def.phase) pushOutOfObstacles(e, e.r * 0.8, 0);
      e.x = clamp(e.x, -H, H); e.z = clamp(e.z, -H, H);
      const gh = groundHeight(e.x, e.z);
      e.y = gh + (e.def.fly ? e.def.fly + Math.sin(t * 3 + e.phase) * 0.3 : 0);
      if (d2 < rr * rr) {
        const ey0 = e.y, ey1 = e.y + e.h;
        if (p.y < ey1 - 0.05 && p.y + 1.7 > ey0) {
          hurtPlayer(e.dmg);
          if (!e.def.fly) {
            const d = Math.sqrt(d2) || 0.01, push = (rr - d) / d;
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
  render() {
    const t = G.time;
    for (const k in this.inst) this.inst[k].begin();
    const sh = this.shadows, useShadows = QUALITY[Settings.quality].shadows;
    sh.begin();
    for (const e of G.enemies) {
      const inst = this.inst[e.type];
      let sx = e.scale, sy = e.scale, sz = e.scale, y = e.y, tilt = 0, roll = 0;
      if (e.type === 'slime') {
        const b = Math.sin(t * 9 + e.phase);
        sy *= 1 + b * 0.14; sx *= 1 - b * 0.07; sz *= 1 - b * 0.07;
      } else if (e.type === 'bat') {
        sx *= 0.8 + Math.abs(Math.sin(t * 16 + e.phase)) * 0.4;
      } else if (e.type === 'ghost') {
        y += Math.sin(t * 2 + e.phase) * 0.2;
      } else {
        y += Math.abs(Math.sin(t * 8 + e.phase)) * 0.12;
        roll = Math.sin(t * 8 + e.phase) * 0.08;
      }
      if (e.dying) {
        const k = Math.max(0, e.dyingT / 0.35);
        y += e.yOff; tilt = e.spin; sx *= k; sy *= k; sz *= k;
      }
      let r = 1, g = 1, b = 1;
      if (e.flash > 0) { r = g = b = 4; } else if (e.elite) { r = 1.5; g = 1.2; b = 0.45; }
      inst.add(e.x, y, e.z, tilt, e.rot, roll, sx, sy, sz, r, g, b);
      if (useShadows && !e.dying) {
        const s = e.r * 2.1;
        sh.add(e.x, groundHeight(e.x, e.z) + 0.05, e.z, 0, 0, 0, s, 1, s);
      }
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
  const dealt = Math.min(dmg, Math.max(0, e.hp));
  e.hp -= dmg;
  e.flash = 0.09;
  if (w) w.dmg += dealt;
  G.totalDamage += dealt;
  if (knock && !e.boss) {
    const k = knock / e.mass;
    e.kvx += dirX * k; e.kvz += dirZ * k;
  }
  addNumber(e.x, e.y + e.h + 0.2, e.z, dmg, crit);
  if (e.hp <= 0) killEnemy(e, w, dirX, dirZ);
}

function killEnemy(e, w, dx, dz) {
  e.alive = false;
  if (w) w.kills++;
  if (e.boss) { onBossKilled(e); return; }
  G.kills++;
  e.dying = true; e.dyingT = 0.35;
  e.vy = 6 + Math.random() * 4; e.yOff = 0;
  const l = Math.hypot(dx || 0, dz || 0) || 1;
  e.kvx = ((dx || 0) / l) * 7 + rand(-2, 2); e.kvz = ((dz || 0) / l) * 7 + rand(-2, 2);
  Sound.bonk();
  const col = { slime: 0x6fdc5a, skeleton: 0xe9e4d4, bat: 0x5b3a7a, spitter: 0xe85d9c, golem: 0x8e9199, ghost: 0xdff3ff, darkKnight: 0x3a3447 }[e.type];
  spawnBurst(e.x, e.y + e.h * 0.5, e.z, e.elite ? 16 : 5, col, 5, 0.45);
  dropXp(e.x, e.z, e.xp);
  const m = G.time / 60;
  if (Math.random() < 0.09 || e.elite) dropCoins(e.x, e.z, e.elite ? 20 : 1 + Math.floor(m / 3));
  if (Math.random() < 0.012) dropItem(e.x, e.z, 'food');
  else if (Math.random() < 0.0035) dropItem(e.x, e.z, 'magnet');
  if (e.elite) spawnChest(e.x, e.z, true);
}

// ---------- Gegner-Geschosse und Gefahren ----------
const EnemyShots = { list: [], inst: null, waves: [], rocks: [] };
function fireEnemyOrb(x, y, z, dx, dz, speed, dmg, color) {
  EnemyShots.list.push({ x, y, z, vx: dx * speed, vz: dz * speed, life: 5, dmg, r: 0.35, color: new THREE.Color(color) });
}
function updateEnemyShots(dt) {
  const p = G.player, list = EnemyShots.list;
  for (let i = list.length - 1; i >= 0; i--) {
    const s = list[i];
    s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt;
    const gh = groundHeight(s.x, s.z);
    if (s.low) s.y = gh + 0.55;
    let hit = false;
    const dx = s.x - p.x, dz = s.z - p.z;
    if (dx * dx + dz * dz < (s.r + 0.45) ** 2 && p.y < s.y + s.r && p.y + 1.7 > s.y - s.r) { hurtPlayer(s.dmg); hit = true; }
    if (hit || s.life <= 0 || s.y < gh - 0.2) list.splice(i, 1);
  }
  // Schockwellen (Bosse): überspringen!
  for (let i = EnemyShots.waves.length - 1; i >= 0; i--) {
    const w = EnemyShots.waves[i];
    w.R += w.speed * dt;
    const d = Math.hypot(p.x - w.x, p.z - w.z);
    const feet = p.y - groundHeight(p.x, p.z);
    if (!w.hit && Math.abs(d - w.R) < 0.9 && feet < 0.9) { w.hit = true; hurtPlayer(w.dmg); }
    w.mesh.scale.set(w.R, 1, w.R);
    w.mesh.position.set(w.x, groundHeight(w.x, w.z) + 0.3, w.z);
    w.mesh.material.opacity = 0.75 * (1 - w.R / w.maxR);
    if (w.R >= w.maxR) { W.scene.remove(w.mesh); w.mesh.material.dispose(); EnemyShots.waves.splice(i, 1); }
  }
  // Fallende Felsbrocken
  for (let i = EnemyShots.rocks.length - 1; i >= 0; i--) {
    const r = EnemyShots.rocks[i];
    r.t += dt;
    if (r.t >= r.T) {
      if (Math.hypot(p.x - r.tx, p.z - r.tz) < r.r + 0.4 && p.y - groundHeight(p.x, p.z) < 2) hurtPlayer(r.dmg);
      ringFx(r.tx, r.tz, r.r, 0x9a8a78, 0.35);
      spawnBurst(r.tx, groundHeight(r.tx, r.tz) + 0.3, r.tz, 10, 0x8a8478, 6, 0.6);
      Sound.boom();
      r.warn.done = true;
      EnemyShots.rocks.splice(i, 1);
    }
  }
}
function addShockwave(x, z, maxR, speed, dmg) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xff7b3a, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.Mesh(Effects.wallGeo, mat);
  W.scene.add(mesh);
  EnemyShots.waves.push({ x, z, R: 0.5, maxR, speed, dmg, hit: false, mesh });
}
function addRock(sx, sz, tx, tz, dmg) {
  const T = 1.1;
  EnemyShots.rocks.push({ sx, sz, tx, tz, t: 0, T, dmg, r: 2.2, warn: warnFx(tx, tz, 2.2, T) });
}
function renderEnemyShots() {
  const inst = EnemyShots.inst;
  inst.begin();
  for (const s of EnemyShots.list) inst.add(s.x, s.y, s.z, 0, 0, 0, s.r * 2, s.r * 2, s.r * 2, s.color.r * 1.6, s.color.g * 1.6, s.color.b * 1.6);
  inst.end();
  const ri = Effects.rockInst;
  ri.begin();
  for (const r of EnemyShots.rocks) {
    const k = r.t / r.T;
    const x = lerp(r.sx, r.tx, k), z = lerp(r.sz, r.tz, k);
    const y = lerp(groundHeight(r.sx, r.sz) + 5, groundHeight(r.tx, r.tz), k) + Math.sin(k * Math.PI) * 9;
    ri.add(x, y, z, k * 6, k * 4, 0, 1.4, 1.4, 1.4);
  }
  ri.end();
}

// ---------- Sammelobjekte ----------
const Pickups = { gems: [], coins: [], items: [], gemInst: null, coinInst: null, itemMeshes: [] };
const GEM_TIERS = [
  { max: 3, color: new THREE.Color(0x3ee0ff), size: 0.42 },
  { max: 10, color: new THREE.Color(0x5ee08a), size: 0.55 },
  { max: 40, color: new THREE.Color(0xff4d6d), size: 0.7 },
  { max: Infinity, color: new THREE.Color(0xc58bff), size: 0.9 },
];
function dropXp(x, z, value) {
  const list = Pickups.gems;
  if (list.length >= 520) {
    // Zu viele Kristalle: Wert auf einen bestehenden übertragen
    const g = list[Math.floor(Math.random() * list.length)];
    g.v += value;
    return;
  }
  list.push({ x: x + rand(-0.3, 0.3), z: z + rand(-0.3, 0.3), v: value, att: false, sp: 0, t: Math.random() * 10 });
}
function dropCoins(x, z, value) {
  value = value * G.stats.gold;
  const n = Math.min(5, Math.max(1, Math.round(value / 4)));
  for (let i = 0; i < n; i++) {
    if (Pickups.coins.length > 220) { G.gold += value / n; continue; }
    Pickups.coins.push({ x: x + rand(-0.6, 0.6), z: z + rand(-0.6, 0.6), v: value / n, att: false, sp: 0, t: Math.random() * 10, vy: rand(4, 7), y: 0.5 });
  }
}
function dropItem(x, z, kind) {
  const mesh = kind === 'food' ? Pickups.foodModel.clone() : Pickups.magnetModel.clone();
  W.scene.add(mesh);
  Pickups.items.push({ x, z, kind, att: false, sp: 0, t: 0, mesh, life: 60 });
}
function initPickups() {
  Pickups.gemInst = new Instancer(GEO.oct, new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x333333, flatShading: true }), 560, true);
  Pickups.coinInst = new Instancer(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 10).rotateX(Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0xffd23f, emissive: 0x6a4a00, flatShading: true }), 240);
  const food = new THREE.Group();
  shape(food, GEO.sphere, heroMat(0xb5562d), 0.7, 0.55, 0.55, 0.15, 0, 0);
  shape(food, GEO.cyl, heroMat(0xf6efd8), 0.12, 0.6, 0.12, -0.35, 0, 0, 0, 0, Math.PI / 2);
  shape(food, GEO.sphere, heroMat(0xf6efd8), 0.22, 0.22, 0.22, -0.65, 0.06, 0);
  Pickups.foodModel = food;
  const mag = new THREE.Group();
  const tor = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.12, 6, 12, Math.PI), heroMat(0xe63946));
  tor.rotation.z = Math.PI; mag.add(tor);
  box(mag, heroMat(0xdfe6ee), 0.24, 0.2, 0.24, -0.35, 0.05, 0);
  box(mag, heroMat(0xdfe6ee), 0.24, 0.2, 0.24, 0.35, 0.05, 0);
  Pickups.magnetModel = mag;
}
function updatePickups(dt) {
  const p = G.player, R = G.stats.pickup, R2 = R * R;
  const py = p.y + 0.8;
  const step = (o, collectR) => {
    const dx = p.x - o.x, dz = p.z - o.z, d2 = dx * dx + dz * dz;
    if (!o.att && d2 < R2) o.att = true;
    if (o.att) {
      o.sp = Math.min(o.sp + dt * 40, 38);
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
    g.t += dt;
    if (step(g, 0.8)) {
      gainXp(g.v);
      Sound.xp();
      gems[i] = gems[gems.length - 1]; gems.pop();
    }
  }
  const coins = Pickups.coins;
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.t += dt;
    if (c.vy !== 0) { c.vy -= 20 * dt; c.y += c.vy * dt; if (c.y <= 0.4) { c.y = 0.4; c.vy = 0; } }
    if (step(c, 0.8)) {
      G.gold += c.v; G.goldEarned += c.v;
      Sound.coin();
      coins[i] = coins[coins.length - 1]; coins.pop();
    }
  }
  const items = Pickups.items;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.t += dt; it.life -= dt;
    const got = step(it, 0.9);
    it.mesh.position.set(it.x, groundHeight(it.x, it.z) + 0.7 + Math.sin(it.t * 3) * 0.15, it.z);
    it.mesh.rotation.y = it.t * 2;
    if (got) {
      if (it.kind === 'food') { healPlayer(G.stats.maxHp * 0.3); Sound.pick(); }
      else { for (const g of gems) g.att = true; for (const c of coins) c.att = true; Sound.pick(); UI.banner('Magnet!', 'Alle Kristalle fliegen zu dir.', 1.2); }
    }
    if (got || it.life <= 0) { W.scene.remove(it.mesh); items.splice(i, 1); }
  }
}
function renderPickups() {
  const gi = Pickups.gemInst, t = G.time;
  gi.begin();
  for (const g of Pickups.gems) {
    let tier = GEM_TIERS[0];
    for (const tt of GEM_TIERS) { if (g.v < tt.max) { tier = tt; break; } }
    const c = tier.color;
    gi.add(g.x, groundHeight(g.x, g.z) + 0.45 + Math.sin(g.t * 3) * 0.12, g.z, 0, g.t * 2, 0, tier.size, tier.size * 1.3, tier.size, c.r, c.g, c.b);
  }
  gi.end();
  const ci = Pickups.coinInst;
  ci.begin();
  for (const c of Pickups.coins) ci.add(c.x, groundHeight(c.x, c.z) + c.y + Math.sin(c.t * 4) * 0.08, c.z, 0, c.t * 4, 0, 1, 1, 1);
  ci.end();
}

// ---------- Partikel ----------
const Particles = { list: [], inst: null };
function initParticles() {
  Particles.inst = new Instancer(GEO.box, new THREE.MeshBasicMaterial({ color: 0xffffff }), 520, true);
}
const _pc = new THREE.Color();
function spawnParticle(x, y, z, vx, vy, vz, life, size, r, g, b, grav = 0) {
  const max = QUALITY[Settings.quality].particles;
  if (Particles.list.length >= max) return;
  Particles.list.push({ x, y, z, vx, vy, vz, life, max: life, size, r, g, b, grav });
}
function spawnBurst(x, y, z, n, color, speed, size) {
  _pc.set(color);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, u = Math.random();
    spawnParticle(x, y, z, Math.cos(a) * speed * u, rand(0.5, 1.2) * speed, Math.sin(a) * speed * u,
      rand(0.3, 0.6), size * rand(0.5, 1), _pc.r, _pc.g, _pc.b, 18);
  }
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
    const s = p.size * (p.life / p.max);
    inst.add(p.x, p.y, p.z, p.life * 5, p.life * 7, 0, s, s, s, p.r, p.g, p.b);
  }
  inst.end();
}

// ---------- Flächeneffekte (Ringe, Hiebe, Warnkreise, Blitze) ----------
const Effects = {
  list: [], pools: {}, beams: null, beamList: [], rockInst: null,
  init() {
    this.geos = {
      ring: new THREE.RingGeometry(0.82, 1, 40).rotateX(-Math.PI / 2),
      disc: new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2),
      slash: new THREE.RingGeometry(0.3, 1, 20, 1, -Math.PI / 2 - 1.3, 2.6).rotateX(-Math.PI / 2),
    };
    this.wallGeo = new THREE.CylinderGeometry(1, 1, 0.9, 48, 1, true);
    this.beams = new Instancer(GEO.box, new THREE.MeshBasicMaterial({ color: 0xffffff }), 260, true);
    this.rockInst = new Instancer(GEO.dodeca, heroMat(0x8a8478), 32);
  },
  get(kind) {
    const pool = this.pools[kind] || (this.pools[kind] = []);
    let m = pool.find((x) => !x.visible);
    if (!m) {
      m = new THREE.Mesh(this.geos[kind], new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
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
    m.material.opacity = fx.op * (fx.fadeIn ? Math.min(1, k * 3) : 1 - k);
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
function slashFx(x, z, angle, r, color) {
  return Effects.add('slash', x, z, { color, dur: 0.2, r0: r * 0.7, r1: r, op: 0.85, rot: angle, y: 0.9, ease: true });
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
        len, w: 0.16, life: 0.16, max: 0.16, r: _pc.r * 1.5, g: _pc.g * 1.5, b: _pc.b * 1.5,
      });
      px = nx; py = ny; pz = nz;
    }
  }
}

// ---------- Schadenszahlen und Texte ----------
const Popups = { list: [] };
function addNumber(x, y, z, val, crit, color) {
  if (!Settings.numbers && !color) return;
  const max = QUALITY[Settings.quality].numbers;
  if (Popups.list.length >= max) Popups.list.shift();
  Popups.list.push({ x: x + rand(-0.3, 0.3), y, z, text: fmtNum(Math.max(1, val)), crit, color: color || (crit ? '#ffd23f' : '#ffffff'), life: 0.7, max: 0.7 });
}
function addText(x, y, z, text, color) {
  Popups.list.push({ x, y, z, text, crit: true, color, life: 1.1, max: 1.1 });
}
function updatePopups(dt) {
  for (let i = Popups.list.length - 1; i >= 0; i--) {
    const p = Popups.list[i];
    p.life -= dt; p.y += dt * 1.6;
    if (p.life <= 0) Popups.list.splice(i, 1);
  }
}
