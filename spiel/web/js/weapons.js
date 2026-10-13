'use strict';
// Rumms! – Waffenverhalten und Geschosse der Spielfigur.

const Projectiles = { list: [], inst: {}, zones: [] };

function initWeaponVisuals() {
  const std = mat({ vertexColors: true, rough: 0.45, metal: 0.25 });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const R = Math.PI / 2;
  const I = (parts, m, cap) => new Instancer(mergeParts(parts), m, cap, false, true);
  Projectiles.inst = {
    arrow: I([
      { geo: GEO.cyl12, color: 0x9a6a3a, pos: [0, 0, -0.1], scale: [0.06, 1.0, 0.06], rot: [R, 0, 0] },
      { geo: GEO.cone12, color: 0xdfe6ee, pos: [0, 0, 0.5], scale: [0.17, 0.32, 0.17], rot: [R, 0, 0] },
      { geo: GEO.cone12, color: 0xffffff, pos: [0, 0.06, -0.52], scale: [0.04, 0.28, 0.18], rot: [-R, 0, 0] },
      { geo: GEO.cone12, color: 0xff5a5a, pos: [0, -0.06, -0.52], scale: [0.04, 0.28, 0.18], rot: [-R, 0, 0] },
    ], std, 260),
    knife: I([
      { geo: GEO.oct, color: 0xeef3f8, pos: [0, 0, 0.14], scale: [0.16, 0.04, 0.6], flat: true },
      { geo: GEO.capsule, color: 0x6a4428, pos: [0, 0, -0.26], scale: [0.09, 0.14, 0.09], rot: [R, 0, 0] },
      { geo: GEO.rbox, color: 0xc9a040, pos: [0, 0, -0.14], scale: [0.2, 0.05, 0.05] },
    ], std, 200),
    kunai: I([
      { geo: GEO.oct, color: 0x4a4f66, pos: [0, 0, 0.15], scale: [0.22, 0.06, 0.62], flat: true },
      { geo: GEO.cyl12, color: 0xd94a4a, pos: [0, 0, -0.25], scale: [0.06, 0.28, 0.06], rot: [R, 0, 0] },
      { geo: GEO.torus, color: 0xc9d1d9, pos: [0, 0, -0.45], scale: [0.14, 0.14, 0.14] },
    ], std, 200),
    fireball: I([
      { geo: GEO.ball1, color: 0xff7a1a, scale: [0.9, 0.9, 0.9] },
      { geo: GEO.ball1, color: 0xfff0a0, scale: [0.52, 0.52, 0.52], pos: [0, 0, 0.14] },
      { geo: GEO.cone12, color: 0xff3d1a, pos: [0, 0, -0.6], scale: [0.55, 0.8, 0.55], rot: [-R, 0, 0] },
    ], glow, 80),
    shield: I([
      { geo: GEO.cyl12, color: 0x2f5fa8, scale: [1.1, 0.14, 1.1] },
      { geo: GEO.torus, color: 0xf4c542, pos: [0, 0.02, 0], scale: [1.0, 1.0, 0.6], rot: [R, 0, 0] },
      { geo: GEO.ball1, color: 0xf4c542, pos: [0, 0.08, 0], scale: [0.36, 0.14, 0.36] },
    ], std, 40),
    dragon: I([
      { geo: new THREE.TorusGeometry(0.55, 0.11, 6, 18, Math.PI * 1.3), color: 0xe0303f, rot: [R, 0, 0] },
      { geo: GEO.oct, color: 0xffc93c, scale: [0.32, 0.32, 0.32], flat: true },
    ], std, 60),
    bomb: I([
      { geo: GEO.ball1, color: 0x2b2b38, scale: [0.78, 0.78, 0.78] },
      { geo: GEO.ball1, color: 0x6a6a80, pos: [-0.15, 0.18, 0.2], scale: [0.18, 0.12, 0.1] },
      { geo: GEO.cyl12, color: 0x8b5a2b, pos: [0, 0.44, 0], scale: [0.08, 0.2, 0.08] },
    ], std, 60),
    meteor: I([
      { geo: GEO.dodeca, color: 0xff5a1f, scale: [1.5, 1.5, 1.5], flat: true },
      { geo: GEO.dodeca, color: 0xffd36a, scale: [1.05, 1.05, 1.05], pos: [0, -0.3, 0], flat: true },
    ], glow, 40),
    mine: I([
      { geo: GEO.cyl12, color: 0x3a3a48, scale: [0.85, 0.2, 0.85] },
      { geo: GEO.torus, color: 0x8a8a9a, pos: [0, 0.06, 0], scale: [0.85, 0.85, 0.5], rot: [R, 0, 0] },
      { geo: GEO.ball1, color: 0xff3b3b, pos: [0, 0.14, 0], scale: [0.3, 0.2, 0.3] },
    ], std, 60),
    shuriken: I([
      { geo: GEO.oct, color: 0xe4eaf1, scale: [1.3, 0.06, 0.26], flat: true },
      { geo: GEO.oct, color: 0xe4eaf1, scale: [0.26, 0.06, 1.3], flat: true },
      { geo: GEO.oct, color: 0xb6c0cc, scale: [0.85, 0.07, 0.2], rot: [0, R / 2, 0], flat: true },
      { geo: GEO.oct, color: 0xb6c0cc, scale: [0.2, 0.07, 0.85], rot: [0, R / 2, 0], flat: true },
      { geo: GEO.cyl12, color: 0x3b3f52, scale: [0.24, 0.1, 0.24] },
    ], std, 16),
  };
  EnemyShots.inst = new Instancer(GEO.ball1, new THREE.MeshBasicMaterial({ color: 0xffffff }), 200, true);
}

function newWeapon(id, slot) {
  return {
    id, def: WEAPONS[id], slot, level: 1, timer: 0.4, dmg: 0, kills: 0, dirty: true, st: null, state: {},
    mods: { damage: 0, cooldown: 0, area: 0, speed: 0, duration: 0, knockback: 0, amount: 0, pierce: 0, bounces: 0 },
  };
}

function computeWeaponStats(w) {
  const d = w.def, m = w.mods, s = G.stats;
  w.st = {
    damage: d.damage * (1 + m.damage) * s.damage,
    cooldown: d.cooldown / ((1 + m.cooldown) * s.attackSpeed),
    area: (d.area || 1) * (1 + m.area) * s.area,
    explode: (d.explode || 0) * (1 + m.area) * s.area,
    amount: (d.amount || 1) + m.amount + s.amount,
    pierce: (d.pierce || 0) + m.pierce,
    speed: (d.speed || 0) * (1 + m.speed) * (d.type === 'orbit' ? 1 : s.projSpeed),
    duration: (d.duration || 1) * (1 + m.duration),
    knockback: (d.knockback || 2) * (1 + m.knockback),
    bounces: (d.bounces || 0) + m.bounces,
    range: d.range || 15,
  };
  w.dirty = false;
}

function handPos() {
  const p = G.player;
  return { x: p.x + Math.sin(p.facing) * 0.4, y: p.y + 1.1, z: p.z + Math.cos(p.facing) * 0.4 };
}

function explode(x, z, r, dmg, w, knock, color) {
  Grid.query(x, z, r, (e) => {
    const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz) || 1;
    damageEnemy(e, dmg, w, dx / d, dz / d, knock);
  });
  const gy = groundHeight(x, z);
  ringFx(x, z, r, color, 0.35);
  Effects.add('disc', x, z, { color, dur: 0.22, r0: r * 0.5, r1: r, op: 0.45, ease: true });
  spawnSpark(x, gy + 0.8, z, 0, 0, 0, 0.18, r * 2.4, 0xfff0c0, 0);
  sparkBurst(x, gy + 0.5, z, 14, color, 7, 0.45);
  smokeBurst(x, gy + 0.6, z, 6, 0x9a8f86, r * 0.9, 2.5);
  spawnBurst(x, gy + 0.5, z, 6, 0x6a5a4a, 6, 0.35);
  Sound.boom();
  G.shake = Math.min(1, G.shake + 0.12);
}

const WeaponTypes = {
  swing(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    w.timer = st.cooldown;
    const p = G.player;
    const tgt = nearestEnemy(p.x, p.z, st.area * 1.7);
    const base = tgt ? Math.atan2(tgt.x - p.x, tgt.z - p.z) : p.facing;
    const offs = [0, Math.PI, Math.PI / 2, -Math.PI / 2, Math.PI / 4, -Math.PI / 4];
    const n = Math.min(st.amount, offs.length), half = w.def.arc / 2 + 0.15;
    for (let k = 0; k < n; k++) {
      const a = base + offs[k];
      Grid.query(p.x, p.z, st.area, (e) => {
        const ea = Math.atan2(e.x - p.x, e.z - p.z);
        const close = (e.x - p.x) ** 2 + (e.z - p.z) ** 2 < (e.r + 0.8) ** 2;
        if (close || Math.abs(angleDiff(a, ea)) <= half) damageEnemy(e, st.damage, w, Math.sin(ea), Math.cos(ea), st.knockback);
      });
      slashFx(p.x, p.z, a, st.area, k === 0 ? 0xffffff : 0xcfe3ff);
    }
    p.swingT = 0.2;
    if (tgt) p.facing = base;
    Sound.swoosh();
  },

  aura(w, st, dt) {
    const p = G.player;
    if (!w.state.mesh) {
      const disc = new THREE.Mesh(Effects.geos.disc, new THREE.MeshBasicMaterial({ color: 0xffd65a, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending }));
      const ring = new THREE.Mesh(Effects.geos.ring, new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
      disc.renderOrder = ring.renderOrder = 1;
      W.scene.add(disc, ring);
      w.state.mesh = disc; w.state.ring = ring;
    }
    w.timer -= dt;
    if (w.timer > 0) return;
    w.timer = st.cooldown;
    Grid.query(p.x, p.z, st.area, (e) => {
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
      damageEnemy(e, st.damage, w, dx / d, dz / d, 1.2);
      e.slowT = 0.6; e.slow = e.boss ? w.def.slow / 2 : w.def.slow;
    });
  },

  boomerang(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const p = G.player;
    const tgt = nearestEnemy(p.x, p.z, st.range * 1.2, null, true);
    w.timer = st.cooldown;
    const base = tgt ? Math.atan2(tgt.x - p.x, tgt.z - p.z) : p.facing;
    const n = st.amount, kind = w.id === 'shieldThrow' ? 'shield' : 'dragon';
    for (let k = 0; k < n; k++) {
      const a = base + (n > 1 ? (k - (n - 1) / 2) * (TAU / Math.max(n, 5)) : 0);
      const h = handPos();
      Projectiles.list.push({
        mode: 'boomerang', kind, x: h.x, y: h.y, z: h.z, vx: Math.sin(a) * st.speed, vz: Math.cos(a) * st.speed,
        speed: st.speed, out: true, dist: 0, range: st.range, life: 6, dmg: st.damage, w, r: 0.6 * st.area,
        knock: st.knockback, spin: 0, size: st.area, yaw: a,
      });
    }
    Sound.swoosh();
  },

  projectile(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const p = G.player, d = w.def;
    let base;
    if (d.target === 'facing') base = p.facing;
    else {
      const tgt = nearestEnemy(p.x, p.z, st.range, null, true);
      if (!tgt) { w.timer = 0.1; return; }
      base = Math.atan2(tgt.x - p.x, tgt.z - p.z);
    }
    w.timer = st.cooldown;
    const n = st.amount, spread = d.spread || 0.12;
    const h = handPos();
    for (let k = 0; k < n; k++) {
      const a = base + (k - (n - 1) / 2) * spread + rand(-0.03, 0.03);
      Projectiles.list.push({
        mode: 'straight', kind: d.visual, x: h.x, y: h.y, z: h.z,
        vx: Math.sin(a) * st.speed, vz: Math.cos(a) * st.speed, yaw: a,
        life: st.range / st.speed, dmg: st.damage, w, r: d.visual === 'fireball' ? 0.6 : 0.4,
        pierce: st.pierce, hit: [], explode: st.explode, knock: st.knockback, spin: 0,
      });
    }
    Sound.shoot();
  },

  rain(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const p = G.player;
    // Dichteste Gegnergruppe in Reichweite suchen
    const cands = [];
    for (let i = 0; i < 10; i++) {
      const e = randomEnemy(p.x, p.z, st.range);
      if (!e) break;
      let c = 0;
      Grid.query(e.x, e.z, st.area, () => c++);
      cands.push({ e, c });
    }
    if (!cands.length) { w.timer = 0.2; return; }
    w.timer = st.cooldown;
    cands.sort((a, b) => b.c - a.c);
    for (let k = 0; k < st.amount; k++) {
      const c = cands[Math.min(k, cands.length - 1)].e;
      const ticks = Math.round(4 * st.duration);
      Projectiles.zones.push({
        x: c.x, z: c.z, r: st.area, ticks, t: 0.35, interval: 0.25, w, dmg: st.damage,
        fx: Effects.add('ring', c.x, c.z, { color: 0x9df59d, dur: 0.35 + ticks * 0.25, r0: st.area, r1: st.area, op: 0.6 }),
      });
    }
  },

  chain(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const p = G.player;
    const first = nearestEnemy(p.x, p.z, st.range, null, true);
    if (!first) { w.timer = 0.1; return; }
    w.timer = st.cooldown;
    for (let k = 0; k < st.amount; k++) {
      let cur = k === 0 ? first : randomEnemy(p.x, p.z, st.range, true);
      if (!cur) break;
      const hit = new Set();
      const h = handPos();
      const pts = [{ x: h.x, y: h.y + 0.6, z: h.z }];
      for (let b = 0; b <= st.bounces && cur; b++) {
        hit.add(cur);
        pts.push({ x: cur.x, y: cur.y + cur.h * 0.6, z: cur.z });
        const dx = cur.x - pts[pts.length - 2].x, dz = cur.z - pts[pts.length - 2].z, d = Math.hypot(dx, dz) || 1;
        damageEnemy(cur, st.damage, w, dx / d, dz / d, 1.5);
        cur = nearestEnemy(cur.x, cur.z, 7.5, hit);
      }
      beamFx(pts, 0x7fe9ff);
    }
    Sound.zap();
  },

  strike(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const p = G.player;
    if (!randomEnemy(p.x, p.z, st.range)) { w.timer = 0.2; return; }
    w.timer = st.cooldown;
    for (let k = 0; k < st.amount; k++) {
      const e = randomEnemy(p.x, p.z, st.range, true);
      if (!e) break;
      const T = 0.6 + k * 0.08;
      Projectiles.list.push({ mode: 'meteor', kind: 'meteor', tx: e.x, tz: e.z, t: 0, T, x: e.x, y: 30, z: e.z, w, dmg: st.damage, r: st.area, knock: st.knockback, spin: 0 });
      warnFx(e.x, e.z, st.area, T);
    }
  },

  orbit(w, st, dt) {
    const p = G.player;
    w.state.prevAngle = w.state.angle || 0;
    w.state.angle = w.state.prevAngle + st.speed * dt;
    const n = st.amount, R = st.area, size = 0.7 + 0.25 * (st.area / 3);
    w.state.n = n; w.state.R = R; w.state.size = size;
    for (let k = 0; k < n; k++) {
      const a = w.state.angle + (k / n) * TAU;
      const bx = p.x + Math.sin(a) * R, bz = p.z + Math.cos(a) * R;
      Grid.query(bx, bz, 0.55 * size, (e) => {
        if (e.hitT[w.slot] > G.time) return;
        e.hitT[w.slot] = G.time + st.cooldown;
        const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
        damageEnemy(e, st.damage, w, dx / d, dz / d, st.knockback);
        Sound.hit();
      });
    }
  },

  lob(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    w.timer = st.cooldown;
    const p = G.player;
    for (let k = 0; k < st.amount; k++) {
      const e = k === 0 ? nearestEnemy(p.x, p.z, st.range) : randomEnemy(p.x, p.z, st.range);
      let tx, tz;
      if (e) { tx = e.x + rand(-0.8, 0.8); tz = e.z + rand(-0.8, 0.8); } else {
        const a = p.facing + rand(-0.8, 0.8), d = rand(3, 7);
        tx = p.x + Math.sin(a) * d; tz = p.z + Math.cos(a) * d;
      }
      Projectiles.list.push({ mode: 'lob', kind: 'bomb', sx: p.x, sz: p.z, tx, tz, t: -k * 0.12, T: 0.65, x: p.x, y: p.y + 1, z: p.z, w, dmg: st.damage, r: st.area, knock: st.knockback, spin: 0 });
    }
    Sound.swoosh();
  },

  nova(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const p = G.player;
    if (!nearestEnemy(p.x, p.z, st.area + 1)) { w.timer = 0.15; return; }
    w.timer = st.cooldown;
    Grid.query(p.x, p.z, st.area, (e) => {
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
      damageEnemy(e, st.damage, w, dx / d, dz / d, st.knockback);
    });
    ringFx(p.x, p.z, st.area, 0xffa94d, 0.4, 0.15);
    Effects.add('disc', p.x, p.z, { color: 0xd9a066, dur: 0.3, r0: st.area * 0.3, r1: st.area, op: 0.4, ease: true });
    spawnBurst(p.x, p.y + 0.2, p.z, 16, 0xb08a5a, 9, 0.5);
    Sound.stomp();
    G.shake = Math.max(G.shake, 0.18);
  },

  mine(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    w.timer = st.cooldown;
    const p = G.player;
    for (let k = 0; k < st.amount; k++) {
      const a = Math.random() * TAU, d = k === 0 ? 0.3 : rand(1.5, 3.5);
      const x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d;
      Projectiles.list.push({ mode: 'mine', kind: 'mine', x, z, y: 0, arm: 0.6, life: 10 * st.duration, w, dmg: st.damage, r: st.area, knock: st.knockback, spin: 0 });
    }
    const mines = Projectiles.list.filter((pr) => pr.mode === 'mine' && !pr.done);
    const max = 10 + st.amount * 3;
    for (let i = 0; i < mines.length - max; i++) mines[i].life = 0;
  },
};

function updateWeapons(dt) {
  for (const w of G.weapons) {
    if (w.dirty || !w.st) computeWeaponStats(w);
    WeaponTypes[w.def.type](w, w.st, dt);
  }
  updateProjectiles(dt);
}

function updateProjectiles(dt) {
  const p = G.player, list = Projectiles.list;
  for (const pr of list) {
    if (pr.done) continue;
    pr.px = pr.x; pr.py = pr.y; pr.pz = pr.z;
    pr.spin += dt;
    switch (pr.mode) {
      case 'straight': {
        pr.x += pr.vx * dt; pr.z += pr.vz * dt; pr.life -= dt;
        pr.y = groundHeight(pr.x, pr.z) + 1.0;
        if (pr.kind === 'fireball' && Math.random() < 0.7) spawnSpark(pr.x, pr.y + rand(-0.2, 0.2), pr.z, rand(-0.6, 0.6), rand(0.2, 1), rand(-0.6, 0.6), 0.3, 0.7, 0xff7a1a, 0);
        Grid.query(pr.x, pr.z, pr.r, (e) => {
          if (pr.done || pr.hit.includes(e)) return;
          pr.hit.push(e);
          if (pr.explode > 0) { explode(pr.x, pr.z, pr.explode, pr.dmg, pr.w, pr.knock, 0xff7a2a); pr.done = true; return; }
          const l = Math.hypot(pr.vx, pr.vz) || 1;
          damageEnemy(e, pr.dmg, pr.w, pr.vx / l, pr.vz / l, pr.knock);
          Sound.hit();
          if (--pr.pierce < 0) pr.done = true;
        });
        if (!pr.done && pr.life <= 0) {
          if (pr.explode > 0) explode(pr.x, pr.z, pr.explode, pr.dmg, pr.w, pr.knock, 0xff7a2a);
          pr.done = true;
        }
        if (!pr.done && pushOutOfObstacles({ x: pr.x, z: pr.z }, 0.1, 1.0) && pr.kind !== 'fireball') pr.done = true;
        break;
      }
      case 'boomerang': {
        if (pr.out) {
          pr.x += pr.vx * dt; pr.z += pr.vz * dt;
          pr.dist += pr.speed * dt;
          if (pr.dist >= pr.range) pr.out = false;
        } else {
          const dx = p.x - pr.x, dz = p.z - pr.z, d = Math.hypot(dx, dz) || 1;
          pr.speed += dt * 12;
          pr.x += (dx / d) * pr.speed * dt; pr.z += (dz / d) * pr.speed * dt;
          if (d < 1.0) pr.done = true;
        }
        pr.y = groundHeight(pr.x, pr.z) + 1.0;
        pr.life -= dt;
        if (pr.life <= 0) pr.done = true;
        Grid.query(pr.x, pr.z, pr.r, (e) => {
          if (e.hitT[pr.w.slot] > G.time) return;
          e.hitT[pr.w.slot] = G.time + 0.3;
          const dx = e.x - pr.x, dz = e.z - pr.z, d = Math.hypot(dx, dz) || 1;
          damageEnemy(e, pr.dmg, pr.w, dx / d, dz / d, pr.knock);
          Sound.hit();
        });
        break;
      }
      case 'lob': {
        pr.t += dt;
        if (pr.t < 0) { pr.x = p.x; pr.z = p.z; pr.sx = p.x; pr.sz = p.z; pr.y = p.y + 1; break; }
        const k = Math.min(1, pr.t / pr.T);
        pr.x = lerp(pr.sx, pr.tx, k); pr.z = lerp(pr.sz, pr.tz, k);
        pr.y = lerp(groundHeight(pr.sx, pr.sz) + 1.2, groundHeight(pr.tx, pr.tz) + 0.3, k) + Math.sin(k * Math.PI) * 4;
        if (k >= 1) { explode(pr.tx, pr.tz, pr.r, pr.dmg, pr.w, pr.knock, 0xff8c42); pr.done = true; }
        break;
      }
      case 'meteor': {
        pr.t += dt;
        const k = Math.min(1, pr.t / pr.T), gh = groundHeight(pr.tx, pr.tz);
        pr.x = pr.tx + (1 - k) * 8; pr.z = pr.tz - (1 - k) * 5; pr.y = gh + (1 - k) * 24;
        if (Math.random() < 0.8) spawnSpark(pr.x + rand(-0.4, 0.4), pr.y + rand(0, 0.8), pr.z + rand(-0.4, 0.4), rand(-1, 1), 2, rand(-1, 1), 0.45, 0.9, 0xff8a2a, 0);
        if (Math.random() < 0.3) smokeBurst(pr.x, pr.y + 0.5, pr.z, 1, 0x5a4a44, 1.2, 0.3);
        if (k >= 1) { explode(pr.tx, pr.tz, pr.r, pr.dmg, pr.w, pr.knock, 0xff5a1f); G.shake = Math.max(G.shake, 0.22); pr.done = true; }
        break;
      }
      case 'fall': {
        pr.y -= 34 * dt;
        if (pr.y <= groundHeight(pr.x, pr.z) + 0.3) { pr.done = true; smokeBurst(pr.x, pr.y, pr.z, 1, 0xd8c9a8, 0.8, 0.8); }
        break;
      }
      case 'mine': {
        pr.arm -= dt; pr.life -= dt;
        pr.y = groundHeight(pr.x, pr.z) + 0.1;
        let trig = pr.life <= 0;
        if (pr.arm <= 0 && !trig) Grid.query(pr.x, pr.z, 1.2, () => { trig = true; });
        if (trig) { explode(pr.x, pr.z, pr.r, pr.dmg, pr.w, pr.knock, 0xff5a3a); pr.done = true; }
        break;
      }
    }
  }
  // Pfeilregen-Zonen
  const zones = Projectiles.zones;
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    z.t -= dt;
    if (z.t > 0) continue;
    z.t = z.interval; z.ticks--;
    Grid.query(z.x, z.z, z.r, (e) => damageEnemy(e, z.dmg, z.w, 0, 0, 0));
    for (let k = 0; k < 4; k++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * z.r;
      const x = z.x + Math.sin(a) * d, zz = z.z + Math.cos(a) * d;
      Projectiles.list.push({ mode: 'fall', kind: 'arrow', x, z: zz, y: groundHeight(x, zz) + 6 + Math.random() * 3, spin: 0 });
    }
    if (z.ticks <= 0) zones.splice(i, 1);
  }
  let w = 0;
  for (let i = 0; i < list.length; i++) if (!list[i].done) list[w++] = list[i];
  list.length = w;
}

function renderProjectiles(a) {
  const inst = Projectiles.inst, glow = FX.glow;
  for (const k in inst) inst[k].begin();
  for (const pr of Projectiles.list) {
    const m = inst[pr.kind];
    const x = pr.px === undefined ? pr.x : ilerp(pr.px, pr.x, a);
    const y = pr.py === undefined ? pr.y : ilerp(pr.py, pr.y, a);
    const z = pr.pz === undefined ? pr.z : ilerp(pr.pz, pr.z, a);
    const spin = pr.spin + FX.dt * a;
    switch (pr.mode) {
      case 'straight':
        m.add(x, y, z, 0, pr.yaw, 0, 1, 1, 1);
        if (pr.kind === 'fireball') glow.add(x, y, z, 3.2, 1, 0.45, 0.1, 0.7);
        else if (pr.kind === 'kunai') glow.add(x, y, z, 0.9, 0.7, 0.8, 1, 0.25);
        break;
      case 'boomerang': {
        const s = pr.size, dr = pr.kind === 'dragon';
        m.add(x, y, z, 0, spin * 18, 0, s, s, s);
        glow.add(x, y, z, 1.8 * s, dr ? 1 : 0.6, dr ? 0.4 : 0.75, dr ? 0.3 : 1, 0.3);
        break;
      }
      case 'lob':
        m.add(x, y, z, spin * 8, spin * 5, 0, 1, 1, 1);
        glow.add(x, y + 0.55, z, 0.8 + Math.random() * 0.4, 1, 0.8, 0.3, 0.9);
        break;
      case 'meteor':
        m.add(x, y, z, spin * 4, spin * 3, 0, 1, 1, 1);
        glow.add(x, y, z, 6, 1, 0.45, 0.12, 0.8);
        break;
      case 'fall': m.add(x, y, z, Math.PI / 2, 0, 0, 1, 1, 1); break;
      case 'mine': {
        const on = pr.arm <= 0 && Math.sin(pr.life * 12) > 0;
        m.add(x, y, z, 0, 0, 0, on ? 1.1 : 1, 1, on ? 1.1 : 1);
        if (on) glow.add(x, y + 0.2, z, 1.3, 1, 0.2, 0.15, 0.8);
        break;
      }
    }
  }
  // Umlaufende Klingen und Auren hängen am (geglätteten) Spieler
  const p = G.player, ppx = ilerp(p.px, p.x, a), ppy = ilerp(p.py, p.y, a), ppz = ilerp(p.pz, p.z, a);
  const si = inst.shuriken;
  for (const w of G.weapons) {
    if (w.def.type === 'orbit' && w.state.n) {
      const base = ilerp(w.state.prevAngle, w.state.angle, a);
      for (let k = 0; k < w.state.n; k++) {
        const an = base + (k / w.state.n) * TAU;
        const bx = ppx + Math.sin(an) * w.state.R, bz = ppz + Math.cos(an) * w.state.R;
        si.add(bx, ppy + 0.9, bz, 0.12, G.time * 18, 0, w.state.size, w.state.size, w.state.size);
        glow.add(bx, ppy + 0.9, bz, 1.1, 0.75, 0.85, 1, 0.22);
      }
    } else if (w.def.type === 'aura' && w.state.mesh && w.st) {
      const gh = groundHeight(ppx, ppz), pulse = 1 + Math.sin(G.time * 4) * 0.03, r = w.st.area * pulse;
      w.state.mesh.position.set(ppx, gh + 0.08, ppz);
      w.state.ring.position.set(ppx, gh + 0.1, ppz);
      w.state.mesh.scale.set(r, 1, r);
      w.state.ring.scale.set(r, 1, r);
      if (Math.random() < 0.35) {
        const an = Math.random() * TAU, d = Math.sqrt(Math.random()) * r;
        spawnSpark(ppx + Math.sin(an) * d, gh + 0.2, ppz + Math.cos(an) * d, 0, rand(1, 2.2), 0, 0.6, 0.3, 0xffe27a, 0);
      }
    }
  }
  for (const k in inst) inst[k].end();
}

function clearWeaponVisuals() {
  for (const w of G.weapons || []) {
    if (w.state.mesh) { W.scene.remove(w.state.mesh, w.state.ring); }
  }
  Projectiles.list.length = 0; Projectiles.zones.length = 0;
}
