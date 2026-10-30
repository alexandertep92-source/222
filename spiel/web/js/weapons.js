'use strict';
// Rumms! – Waffenverhalten und Geschosse der Spielfigur.

const Projectiles = { list: [], inst: {}, zones: [] };

function initWeaponVisuals() {
  const std = mat({ vertexColors: true, rough: 0.45, metal: 0.25 });
  const glow = new THREE.MeshBasicMaterial({ vertexColors: true });
  const R = Math.PI / 2;
  const I = (parts, m, cap) => new Instancer(mergeParts(parts), m, cap, false, true);
  const glowStd = (em) => mat({ vertexColors: true, rough: 0.35, metal: 0.4, emissive: em });
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
    // Ritter: Lanze (Schaft wird auf die Stoßlänge gestreckt) und Himmelshammer
    lanceShaft: I([
      { geo: GEO.cyl12, color: 0xd9b47a, pos: [0, 0, 0.5], scale: [0.11, 1, 0.11], rot: [R, 0, 0] },
    ], std, 12),
    lanceTip: I([
      { geo: GEO.cone12, color: 0xe8eef6, pos: [0, 0, 0.45], scale: [0.24, 0.9, 0.24], rot: [R, 0, 0] },
      { geo: GEO.cone12, color: 0xf4c542, pos: [0, 0, -0.1], scale: [0.42, 0.45, 0.42], rot: [-R, 0, 0] },
      { geo: GEO.oct, color: 0xe63946, pos: [0.22, 0.1, -0.35], scale: [0.04, 0.3, 0.5], flat: true },
    ], std, 12),
    hammer: I([
      { geo: GEO.rbox, color: 0xffcf4a, pos: [0, 0.32, 0], scale: [0.78, 0.44, 0.44] },
      { geo: GEO.rbox, color: 0xfff0a8, pos: [0, 0.32, 0], scale: [0.82, 0.12, 0.48] },
      { geo: GEO.cyl12, color: 0x8b5a2b, pos: [0, -0.2, 0], scale: [0.11, 0.9, 0.11] },
      { geo: GEO.ball1, color: 0xffcf4a, pos: [0, -0.66, 0], scale: [0.18, 0.18, 0.18] },
    ], glowStd(0x6a4a00), 48),
    // Jägerin: Falke und Dornen
    falcon: I([
      { geo: GEO.ball1, color: 0x8a5a38, pos: [0, 0, 0], scale: [0.42, 0.38, 0.8] },
      { geo: GEO.ball1, color: 0xf4f1ea, pos: [0, 0.12, 0.42], scale: [0.36, 0.34, 0.36] },
      { geo: GEO.cone12, color: 0xffc93c, pos: [0, 0.08, 0.66], scale: [0.1, 0.2, 0.1], rot: [R, 0, 0] },
      { geo: GEO.ball1, color: 0x15151f, pos: [-0.12, 0.18, 0.56], scale: [0.07, 0.08, 0.05] },
      { geo: GEO.ball1, color: 0x15151f, pos: [0.12, 0.18, 0.56], scale: [0.07, 0.08, 0.05] },
      { geo: GEO.ball1, color: 0x6a4028, pos: [-0.62, 0.05, 0], scale: [1.0, 0.07, 0.48], rot: [0, 0.25, 0.12] },
      { geo: GEO.ball1, color: 0x6a4028, pos: [0.62, 0.05, 0], scale: [1.0, 0.07, 0.48], rot: [0, -0.25, -0.12] },
      { geo: GEO.ball1, color: 0x3f2a1c, pos: [-1.0, 0.07, -0.1], scale: [0.4, 0.06, 0.36] },
      { geo: GEO.ball1, color: 0x3f2a1c, pos: [1.0, 0.07, -0.1], scale: [0.4, 0.06, 0.36] },
      { geo: GEO.cone12, color: 0x6a4028, pos: [0, 0, -0.5], scale: [0.36, 0.5, 0.08], rot: [-R, 0, 0] },
    ], std, 8),
    thorn: I([
      { geo: GEO.cone12, color: 0x3f7a2a, pos: [0, 0.8, 0], scale: [0.36, 1.6, 0.36] },
      { geo: GEO.cone12, color: 0x4f9a36, pos: [0.16, 0.7, 0.04], scale: [0.14, 0.6, 0.14], rot: [0, 0, -0.9] },
      { geo: GEO.cone12, color: 0x4f9a36, pos: [-0.14, 1.0, -0.04], scale: [0.12, 0.5, 0.12], rot: [0, 0, 0.9] },
      { geo: GEO.ball1, color: 0x8fd46a, pos: [0.16, 0.42, 0.12], scale: [0.3, 0.06, 0.18], rot: [0, 0.6, 0.3] },
      { geo: GEO.ball1, color: 0xff7aa8, pos: [0, 1.62, 0], scale: [0.16, 0.16, 0.16] },
    ], std, 140),
    // Magier: Schwarzes Loch und Arkanstrahl
    vortex: I([
      { geo: GEO.ball2, color: 0x12051f, scale: [1, 0.55, 1] },
      { geo: GEO.torus, color: 0xb07aff, scale: [2.0, 2.0, 1.2], rot: [R, 0, 0] },
      { geo: GEO.torus, color: 0xe8c8ff, scale: [1.3, 1.3, 0.8], rot: [R, 0, 0.3] },
    ], glow, 6),
    beam: new Instancer(GEO.box, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), 24, true),
    // Ninja: Kettensichel
    sickle: I([
      { geo: new THREE.TorusGeometry(0.55, 0.09, 6, 16, Math.PI * 0.9), color: 0xe4eaf1, pos: [0, 0, 0.1], rot: [R, 0, 0] },
      { geo: GEO.cyl12, color: 0xd94a4a, pos: [0.5, 0, -0.2], scale: [0.09, 0.6, 0.09], rot: [R, 0, 0] },
    ], std, 6),
    chainLink: I([{ geo: GEO.torus, color: 0x9aa3b5, scale: [0.28, 0.28, 0.28] }], std, 60),
    // Zwerg: Kanonenturm, Kanonenkugel, Spitzhacke
    turret: I([
      { geo: GEO.cyl12, color: 0x6a4428, pos: [0, 0.3, 0], scale: [1.1, 0.6, 1.1] },
      { geo: GEO.torus, color: 0xb3b9c4, pos: [0, 0.6, 0], scale: [1.05, 1.05, 0.8], rot: [R, 0, 0] },
      { geo: GEO.ball2, color: 0x8a6a4a, pos: [0, 0.75, 0], scale: [0.8, 0.6, 0.8] },
      { geo: GEO.cyl12, color: 0x2b2b38, pos: [0, 0.95, 0.45], scale: [0.32, 1.0, 0.32], rot: [R - 0.1, 0, 0] },
      { geo: GEO.torus, color: 0xffcf4a, pos: [0, 1.0, 0.92], scale: [0.4, 0.4, 0.5] },
    ], std, 6),
    cannonball: I([
      { geo: GEO.ball1, color: 0x2b2b38, scale: [0.5, 0.5, 0.5] },
      { geo: GEO.ball1, color: 0x6a6a80, pos: [-0.08, 0.1, 0.1], scale: [0.14, 0.1, 0.1] },
    ], std, 40),
    pickaxe: I([
      { geo: GEO.cyl12, color: 0x8b5a2b, pos: [0, -0.1, 0], scale: [0.1, 1.2, 0.1] },
      { geo: GEO.cone12, color: 0xb3b9c4, pos: [0, 0.48, 0.32], scale: [0.18, 0.7, 0.14], rot: [R + 0.25, 0, 0] },
      { geo: GEO.cone12, color: 0xb3b9c4, pos: [0, 0.48, -0.32], scale: [0.18, 0.7, 0.14], rot: [-R - 0.25, 0, 0] },
      { geo: GEO.rbox, color: 0xd9a04a, pos: [0, 0.48, 0], scale: [0.22, 0.24, 0.24] },
    ], std, 50),
  };
  EnemyShots.inst = new Instancer(GEO.ball1, new THREE.MeshBasicMaterial({ color: 0xffffff }), 400, true);
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

function explode(x, z, r, dmg, w, knock, color, quiet) {
  Grid.query(x, z, r, (e) => {
    const dx = e.x - x, dz = e.z - z, d = Math.hypot(dx, dz) || 1;
    damageEnemy(e, dmg, w, dx / d, dz / d, knock);
  });
  const gy = groundHeight(x, z);
  if (quiet) {
    ringFx(x, z, r, color, 0.25);
    sparkBurst(x, gy + 0.5, z, 6, color, 5, 0.35);
    smokeBurst(x, gy + 0.5, z, 2, 0x9a8f86, r * 0.8, 2);
    Sound.hit();
    return;
  }
  ringFx(x, z, r, color, 0.35);
  Effects.add('disc', x, z, { color, dur: 0.22, r0: r * 0.5, r1: r, op: 0.45, ease: true });
  spawnSpark(x, gy + 0.8, z, 0, 0, 0, 0.18, r * 2.4, 0xfff0c0, 0);
  sparkBurst(x, gy + 0.5, z, 14, color, 7, 0.45);
  smokeBurst(x, gy + 0.6, z, 6, 0x9a8f86, r * 0.9, 2.5);
  spawnBurst(x, gy + 0.5, z, 6, 0x6a5a4a, 6, 0.35);
  Sound.boom();
  G.shake = Math.min(1, G.shake + 0.12);
}

// Gegner, die eine Linie (Lanze, Strahl) berühren. t = Abstand entlang der Linie.
function lineQuery(x, z, dx, dz, len, wd, fn) {
  Grid.query(x + dx * len / 2, z + dz * len / 2, len / 2 + wd, (e) => {
    const ex = e.x - x, ez = e.z - z, t = ex * dx + ez * dz;
    if (t < -e.r || t > len + e.r) return;
    if (Math.abs(ex * dz - ez * dx) <= wd + e.r) fn(e, t);
  });
}
// Ziele mit möglichst vielen Gegnern drumherum (Pfeilregen, Ranken, Schwarzes Loch)
function densestTargets(range, area, n) {
  const p = G.player, cands = [];
  for (let i = 0; i < 10; i++) {
    const e = randomEnemy(p.x, p.z, range);
    if (!e) break;
    let c = 0;
    Grid.query(e.x, e.z, area, () => c++);
    cands.push({ e, c });
  }
  cands.sort((a, b) => b.c - a.c);
  const out = [];
  for (let k = 0; k < n && cands.length; k++) out.push(cands[Math.min(k, cands.length - 1)].e);
  return out;
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
    // Dichteste Gegnergruppe in Reichweite suchen
    const ts = densestTargets(st.range, st.area, st.amount);
    if (!ts.length) { w.timer = 0.2; return; }
    w.timer = st.cooldown;
    for (const c of ts) {
      const ticks = Math.round(4 * st.duration);
      Projectiles.zones.push({
        kind: 'rain', x: c.x, z: c.z, r: st.area, ticks, t: 0.35, interval: 0.25, w, dmg: st.damage,
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

  // ---- Ritter ----
  thrust(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const p = G.player, len = st.range * (0.7 + 0.3 * st.area), wd = 0.6 * st.area;
    const tgt = nearestEnemy(p.x, p.z, len + 0.5, null, true);
    if (!tgt) { w.timer = 0.1; return; }
    w.timer = st.cooldown;
    const base = Math.atan2(tgt.x - p.x, tgt.z - p.z);
    const offs = [0, 0.5, -0.5, 1.0, -1.0];
    for (let k = 0; k < Math.min(st.amount, offs.length); k++) {
      const a = base + offs[k], dx = Math.sin(a), dz = Math.cos(a);
      lineQuery(p.x, p.z, dx, dz, len, wd, (e) => {
        damageEnemy(e, st.damage, w, dx, dz, st.knockback);
        sparkBurst(e.x, e.y + e.h * 0.6, e.z, 3, 0xfff2c0, 4, 0.3);
      });
      Projectiles.list.push({ mode: 'thrust', kind: 'lanceTip', yaw: a, t: 0, T: 0.3, len, x: p.x, y: p.y, z: p.z, spin: 0 });
      Effects.beamList.push({ x: p.x + dx * len / 2, y: p.y + 1.0, z: p.z + dz * len / 2, yaw: a, pitch: 0, len, w: 0.22 * st.area, life: 0.16, max: 0.16, r: 1.8, g: 1.7, b: 1.3 });
    }
    p.swingT = 0.2; p.facing = base;
    Sound.swoosh();
  },

  spiral(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const p = G.player;
    if (!nearestEnemy(p.x, p.z, st.range + 2)) { w.timer = 0.2; return; }
    w.timer = st.cooldown;
    const n = st.amount, a0 = Math.random() * TAU, T = 1.7 * st.duration;
    for (let k = 0; k < n; k++) {
      const a = a0 + (k / n) * TAU;
      Projectiles.list.push({
        mode: 'spiral', kind: 'hammer', a, av: st.speed, t: 0, T, R1: w.def.range * (0.75 + 0.25 * st.area),
        x: p.x + Math.sin(a), y: p.y + 1, z: p.z + Math.cos(a), w, dmg: st.damage, r: 0.85 * st.area, size: st.area, knock: st.knockback, spin: 0,
      });
    }
    Sound.swoosh();
  },

  // ---- Jägerin ----
  pet(w, st, dt) {
    const pets = w.state.pets || (w.state.pets = []);
    const p = G.player;
    while (pets.length < st.amount) {
      const pr = { mode: 'pet', kind: 'falcon', w, x: p.x, y: p.y + 3, z: p.z, ph: pets.length * 2.1, state: 0, t: 0.4 + pets.length * 0.25, tgt: null, yaw: 0, pitch: 0, spin: 0, flap: Math.random() * 6, idx: pets.length };
      pets.push(pr); Projectiles.list.push(pr);
    }
    for (const pr of pets) {
      pr.cd = st.cooldown; pr.speed = st.speed; pr.dmg = st.damage; pr.r = 1.3 * st.area; pr.knock = st.knockback; pr.range = st.range;
    }
  },

  root(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const ts = densestTargets(st.range, st.area, st.amount);
    if (!ts.length) { w.timer = 0.2; return; }
    w.timer = st.cooldown;
    for (const c of ts) {
      const ticks = Math.round(5 * st.duration), interval = 0.4, r = st.area;
      const spikes = [];
      const n = Math.round(6 + r * 1.6);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r * 0.92;
        spikes.push({ x: c.x + Math.sin(a) * d, z: c.z + Math.cos(a) * d, s: rand(0.7, 1.25), yaw: Math.random() * TAU, tilt: rand(-0.25, 0.25), delay: Math.random() * 0.15 });
      }
      Projectiles.zones.push({ kind: 'root', x: c.x, z: c.z, r, ticks, t: 0.12, interval, w, dmg: st.damage, age: 0, life: 0.12 + ticks * interval + 0.2, spikes });
      Effects.add('ring', c.x, c.z, { color: 0x7cd36a, dur: 0.3 + ticks * interval, r0: r, r1: r, op: 0.55 });
      spawnBurst(c.x, groundHeight(c.x, c.z) + 0.3, c.z, 10, 0x6a8a3a, 5, 0.35);
    }
    Sound.stomp();
  },

  // ---- Magier ----
  vortex(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const ts = densestTargets(st.range, st.area, st.amount);
    if (!ts.length) { w.timer = 0.2; return; }
    w.timer = st.cooldown;
    for (const c of ts) {
      const life = 2.6 * st.duration;
      Projectiles.zones.push({ kind: 'vortex', x: c.x, z: c.z, r: st.area, age: 0, life, t: 0.3, interval: 0.3, w, dmg: st.damage });
      Effects.add('disc', c.x, c.z, { color: 0x1a0630, dur: life, r0: st.area * 0.6, r1: st.area * 1.1, op: 0.5 });
      Effects.add('ring', c.x, c.z, { color: 0xc58bff, dur: life, r0: st.area * 1.35, r1: st.area * 0.4, op: 0.6 });
    }
    Sound.whoom();
  },

  beam(w, st, dt) {
    const s = w.state, p = G.player;
    if (s.active > 0) {
      s.active -= dt;
      s.prevA = s.a; s.a += s.av * dt;
      for (let k = 0; k < s.n; k++) {
        const a = s.a + (k / s.n) * TAU, dx = Math.sin(a), dz = Math.cos(a);
        lineQuery(p.x, p.z, dx, dz, s.len, s.wd, (e) => {
          if (e.hitT[w.slot] > G.time) return;
          e.hitT[w.slot] = G.time + 0.2;
          damageEnemy(e, st.damage, w, dx, dz, 1.5);
        });
      }
      if (s.active <= 0) s.n = 0;
      return;
    }
    w.timer -= dt;
    if (w.timer > 0) return;
    const len = st.range * (0.8 + 0.2 * st.area);
    const tgt = nearestEnemy(p.x, p.z, len, null, true);
    if (!tgt) { w.timer = 0.15; return; }
    w.timer = st.cooldown;
    s.T = s.active = 1.5 * st.duration;
    s.a = s.prevA = Math.atan2(tgt.x - p.x, tgt.z - p.z) - 0.35;
    s.av = TAU / 1.5; s.n = st.amount; s.len = len; s.wd = 0.45 * st.area;
    Sound.hum();
  },

  // ---- Ninja ----
  smoke(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const p = G.player;
    if (!nearestEnemy(p.x, p.z, st.area + 4)) { w.timer = 0.2; return; }
    w.timer = st.cooldown;
    for (let k = 0; k < st.amount; k++) {
      const a = Math.random() * TAU, d = k === 0 ? 0 : rand(3, 5);
      const x = p.x + Math.sin(a) * d, z = p.z + Math.cos(a) * d, gh = groundHeight(x, z);
      Projectiles.zones.push({ kind: 'smoke', x, z, r: st.area, age: 0, life: 3.6 * st.duration, t: 0, interval: 0.5, w, dmg: st.damage, seed: Math.random() * 100 });
      smokeBurst(x, gh + 0.5, z, 12, 0x8a86a0, st.area * 0.7, 4);
      Effects.add('ring', x, z, { color: 0xb6b0d0, dur: 0.5, r0: st.area * 0.4, r1: st.area, op: 0.6, ease: true });
    }
    Sound.puff();
  },

  whirl(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const p = G.player;
    if (!nearestEnemy(p.x, p.z, st.area + 1)) { w.timer = 0.15; return; }
    w.timer = st.cooldown;
    const n = st.amount;
    for (let k = 0; k < n; k++) {
      const a0 = p.facing + (k / n) * TAU;
      Projectiles.list.push({ mode: 'whirl', kind: 'sickle', a0, ang: a0, pang: a0, t: 0, T: 0.55, R: st.area, curR: 0, pR: 0, x: p.x, y: p.y + 1, z: p.z, w, dmg: st.damage, knock: st.knockback, hit: new Set(), spin: 0 });
    }
    Effects.add('ring', p.x, p.z, { color: 0xdfe9ff, dur: 0.55, r0: st.area, r1: st.area, op: 0.3, follow: p });
    Sound.swoosh();
  },

  // ---- Zwerg ----
  turret(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const p = G.player;
    if (!nearestEnemy(p.x, p.z, st.range)) { w.timer = 0.3; return; }
    w.timer = st.cooldown;
    for (let k = 0; k < st.amount; k++) {
      const a = p.facing + (k % 2 ? -1 : 1) * (Math.PI / 2 + rand(-0.4, 0.4)) + (k > 1 ? Math.PI / 2 : 0);
      const x = p.x + Math.sin(a) * 2, z = p.z + Math.cos(a) * 2;
      Projectiles.list.push({
        mode: 'turret', kind: 'turret', x, z, y: groundHeight(x, z), life: 8 * st.duration, fireT: 0.4 + k * 0.15, yaw: p.facing, rise: 0, kick: 0,
        w, dmg: st.damage, range: st.range, speed: st.speed, area: st.area, knock: st.knockback, spin: 0,
      });
      smokeBurst(x, groundHeight(x, z) + 0.3, z, 6, 0xd8c9a8, 1.1, 2.5);
    }
    const ts = Projectiles.list.filter((pr) => pr.mode === 'turret' && pr.w === w && !pr.done);
    for (let i = 0; i < ts.length - st.amount * 2; i++) ts[i].life = 0;
    Sound.stomp();
  },

  toss(w, st, dt) {
    w.timer -= dt;
    if (w.timer > 0) return;
    const p = G.player;
    if (!nearestEnemy(p.x, p.z, st.range)) { w.timer = 0.15; return; }
    w.timer = st.cooldown;
    const h = handPos(), g = 26, T = 0.95;
    for (let k = 0; k < st.amount; k++) {
      const e = k === 0 ? nearestEnemy(p.x, p.z, st.range) : randomEnemy(p.x, p.z, st.range);
      let tx, tz;
      if (e) { tx = e.x + (e.vx || 0) * T * 0.5; tz = e.z + (e.vz || 0) * T * 0.5; } else {
        const a = p.facing + rand(-1, 1), d = rand(4, 8);
        tx = p.x + Math.sin(a) * d; tz = p.z + Math.cos(a) * d;
      }
      const dx = tx - h.x, dz = tz - h.z, ty = groundHeight(tx, tz) + 0.6;
      Projectiles.list.push({
        mode: 'toss', kind: 'pickaxe', x: h.x, y: h.y, z: h.z, vx: dx / T, vz: dz / T, vy: (ty - h.y) / T + 0.5 * g * T, g,
        w, dmg: st.damage, r: 0.8 * st.area, size: 0.9 + 0.3 * st.area, pierce: st.pierce, hit: [], knock: st.knockback, spin: k * 0.3, yaw: Math.atan2(dx, dz),
      });
    }
    Sound.swoosh();
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
          if (pr.explode > 0) { explode(pr.x, pr.z, pr.explode, pr.dmg, pr.w, pr.knock, pr.quiet ? 0xffb35a : 0xff7a2a, pr.quiet); pr.done = true; return; }
          const l = Math.hypot(pr.vx, pr.vz) || 1;
          damageEnemy(e, pr.dmg, pr.w, pr.vx / l, pr.vz / l, pr.knock);
          Sound.hit();
          if (--pr.pierce < 0) pr.done = true;
        });
        if (!pr.done && pr.life <= 0) {
          if (pr.explode > 0) explode(pr.x, pr.z, pr.explode, pr.dmg, pr.w, pr.knock, pr.quiet ? 0xffb35a : 0xff7a2a, pr.quiet);
          pr.done = true;
        }
        if (!pr.done && pushOutOfObstacles({ x: pr.x, z: pr.z }, 0.1, 1.0) && pr.kind !== 'fireball') pr.done = true;
        break;
      }
      case 'thrust':
        pr.t += dt;
        if (pr.t >= pr.T) pr.done = true;
        break;
      case 'spiral': {
        pr.t += dt;
        const k = pr.t / pr.T;
        if (k >= 1) { pr.done = true; sparkBurst(pr.x, pr.y, pr.z, 6, 0xffe27a, 3, 0.35); break; }
        pr.a += pr.av * dt;
        const R = lerp(1, pr.R1, k);
        pr.x = p.x + Math.sin(pr.a) * R; pr.z = p.z + Math.cos(pr.a) * R; pr.y = groundHeight(pr.x, pr.z) + 1.0;
        Grid.query(pr.x, pr.z, pr.r, (e) => {
          if (e.hitT[pr.w.slot] > G.time) return;
          e.hitT[pr.w.slot] = G.time + 0.35;
          const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
          damageEnemy(e, pr.dmg, pr.w, dx / d, dz / d, pr.knock);
          sparkBurst(e.x, e.y + e.h * 0.6, e.z, 3, 0xffe27a, 4, 0.3);
          Sound.hit();
        });
        break;
      }
      case 'pet': updatePet(pr, dt); break;
      case 'whirl': {
        pr.t += dt;
        const k = Math.min(1, pr.t / pr.T), ease = 1 - (1 - k) * (1 - k);
        pr.pang = pr.ang; pr.pR = pr.curR;
        pr.ang = pr.a0 + ease * TAU;
        pr.curR = pr.R * Math.min(1, 0.35 + k * 4);
        pr.x = p.x + Math.sin(pr.ang) * pr.curR; pr.z = p.z + Math.cos(pr.ang) * pr.curR;
        pr.y = groundHeight(pr.x, pr.z) + 1.0;
        const sweep = angleDiff(pr.pang, pr.ang);
        Grid.query(p.x, p.z, pr.curR, (e) => {
          if (pr.hit.has(e)) return;
          const ea = Math.atan2(e.x - p.x, e.z - p.z), da = angleDiff(pr.pang, ea);
          if (da < -0.25 || da > sweep + 0.25) return;
          pr.hit.add(e);
          damageEnemy(e, pr.dmg, pr.w, Math.sin(ea), Math.cos(ea), pr.knock);
          Sound.hit();
        });
        if (Math.random() < 0.8) spawnSpark(pr.x, pr.y, pr.z, 0, 0.5, 0, 0.25, 0.5, 0xdfe9ff, 0);
        if (k >= 1) pr.done = true;
        break;
      }
      case 'turret': {
        pr.life -= dt; pr.rise = Math.min(1, pr.rise + dt * 4); pr.kick *= Math.exp(-dt * 12);
        pr.y = groundHeight(pr.x, pr.z);
        const e = nearestEnemy(pr.x, pr.z, pr.range, null, true);
        if (e) pr.yaw += angleDiff(pr.yaw, Math.atan2(e.x - pr.x, e.z - pr.z)) * Math.min(1, dt * 12);
        pr.fireT -= dt;
        if (e && pr.fireT <= 0 && pr.rise >= 1) {
          pr.fireT = 0.55 / G.stats.attackSpeed;
          const a = pr.yaw, sx = pr.x + Math.sin(a) * 1.0, sz = pr.z + Math.cos(a) * 1.0;
          list.push({
            mode: 'straight', kind: 'cannonball', x: sx, y: pr.y + 1.0, z: sz, vx: Math.sin(a) * pr.speed, vz: Math.cos(a) * pr.speed, yaw: a,
            life: pr.range / pr.speed, dmg: pr.dmg, w: pr.w, r: 0.45, pierce: 0, hit: [], explode: 1.5 * pr.area, quiet: true, knock: pr.knock, spin: 0,
          });
          pr.kick = 1;
          smokeBurst(sx, pr.y + 1.0, sz, 2, 0xd8d0c4, 0.6, 1.5);
          spawnSpark(sx, pr.y + 1.0, sz, 0, 0, 0, 0.1, 1.2, 0xffd27a, 0);
          Sound.cannon();
        }
        if (pr.life <= 0) {
          pr.done = true;
          smokeBurst(pr.x, pr.y + 0.6, pr.z, 6, 0xd8c9a8, 1.1, 2.5);
          spawnBurst(pr.x, pr.y + 0.6, pr.z, 8, 0x6a4428, 5, 0.35);
        }
        break;
      }
      case 'toss': {
        pr.vy -= pr.g * dt;
        pr.x += pr.vx * dt; pr.z += pr.vz * dt; pr.y += pr.vy * dt;
        const gh = groundHeight(pr.x, pr.z);
        if (pr.y - gh < 2.4) {
          Grid.query(pr.x, pr.z, pr.r, (e) => {
            if (pr.done || pr.hit.includes(e)) return;
            pr.hit.push(e);
            const l = Math.hypot(pr.vx, pr.vz) || 1;
            damageEnemy(e, pr.dmg, pr.w, pr.vx / l, pr.vz / l, pr.knock);
            sparkBurst(e.x, e.y + e.h * 0.6, e.z, 3, 0xdfe6ee, 4, 0.3);
            Sound.hit();
            if (--pr.pierce < 0) pr.done = true;
          });
        }
        if (!pr.done && pr.vy < 0 && pr.y < gh + 0.15) {
          pr.done = true;
          spawnBurst(pr.x, gh + 0.2, pr.z, 5, 0x8a7a5a, 4, 0.3);
          smokeBurst(pr.x, gh + 0.2, pr.z, 2, 0xd8c9a8, 0.7, 1.5);
        }
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
  // Flächen: Pfeilregen, Ranken, Schwarzes Loch, Rauch
  const zones = Projectiles.zones;
  for (let i = zones.length - 1; i >= 0; i--) {
    const z = zones[i];
    if (z.kind !== 'rain') {
      if (updateZone(z, dt)) zones.splice(i, 1);
      continue;
    }
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

// Gibt true zurück, wenn die Fläche verschwinden soll.
function updateZone(z, dt) {
  z.age += dt;
  z.t -= dt;
  const tick = z.t <= 0;
  if (tick) z.t = z.interval;
  if (z.kind === 'root') {
    if (tick && z.ticks > 0) {
      z.ticks--;
      Grid.query(z.x, z.z, z.r, (e) => {
        damageEnemy(e, z.dmg, z.w, 0, 0, 0);
        if (e.boss) { e.slowT = 0.6; e.slow = 0.25; } else e.rootT = Math.max(e.rootT, z.interval + 0.15);
      });
    }
    return z.age >= z.life;
  }
  if (z.kind === 'vortex') {
    const R = z.r * 1.4;
    Grid.query(z.x, z.z, R, (e) => {
      if (e.boss) return;
      const dx = z.x - e.x, dz = z.z - e.z, d = Math.hypot(dx, dz) || 1;
      if (d < 0.35) return;
      const pull = Math.min((2.2 + 6 * (1 - d / R)) / Math.sqrt(e.mass) * dt, d - 0.3);
      e.x += (dx / d) * pull; e.z += (dz / d) * pull;
    });
    if (tick) Grid.query(z.x, z.z, z.r, (e) => damageEnemy(e, z.dmg, z.w, 0, 0, 0));
    if (z.age >= z.life) {
      // zum Schluss fällt der Strudel in sich zusammen und schleudert alles weg
      explode(z.x, z.z, z.r * 0.85, z.dmg * 3, z.w, 9, 0xc58bff);
      return true;
    }
    return false;
  }
  if (z.kind === 'smoke') {
    if (tick) {
      Grid.query(z.x, z.z, z.r, (e) => {
        damageEnemy(e, z.dmg, z.w, 0, 0, 0);
        if (e.boss) { e.slowT = 0.6; e.slow = 0.3; return; }
        if (e.confT <= 0) e.confA = Math.random() * TAU;
        e.confT = Math.max(e.confT, 1.3);
      });
    }
    return z.age >= z.life;
  }
  return true;
}

// Falke: kreist über dir, stößt auf einen Gegner herab und fliegt zurück
function updatePet(pr, dt) {
  const p = G.player;
  pr.flap += dt * (pr.state === 1 ? 5 : 13);
  if ((pr.x - p.x) ** 2 + (pr.z - p.z) ** 2 > 45 * 45) { pr.x = p.x; pr.z = p.z; pr.y = p.y + 4; pr.state = 0; }
  if (pr.state === 0) {
    pr.ph += dt * 1.7;
    const tx = p.x + Math.sin(pr.ph) * 1.9, tz = p.z + Math.cos(pr.ph) * 1.9, ty = p.y + 3.2 + Math.sin(pr.ph * 2) * 0.25;
    const k = Math.min(1, dt * 6);
    pr.x += (tx - pr.x) * k; pr.y += (ty - pr.y) * k; pr.z += (tz - pr.z) * k;
    pr.yaw = pr.ph + Math.PI / 2; pr.pitch = 0;
    pr.t -= dt;
    if (pr.t <= 0) {
      const e = pr.idx === 0 ? nearestEnemy(p.x, p.z, pr.range, null, true) : randomEnemy(p.x, p.z, pr.range, true);
      if (e) { pr.tgt = e; pr.state = 1; Sound.screech(); } else pr.t = 0.2;
    }
    return;
  }
  if (pr.state === 1) {
    let e = pr.tgt;
    if (!e || !e.alive) {
      e = pr.tgt = nearestEnemy(pr.x, pr.z, 8);
      if (!e) { pr.state = 2; return; }
    }
    const ty = e.y + e.h * 0.55, dx = e.x - pr.x, dy = ty - pr.y, dz = e.z - pr.z, d = Math.hypot(dx, dy, dz) || 1;
    const v = pr.speed * dt;
    pr.yaw = Math.atan2(dx, dz); pr.pitch = -Math.atan2(dy, Math.hypot(dx, dz)) * 0.7;
    if (d < v + e.r * 0.5 + 0.3) {
      Grid.query(e.x, e.z, pr.r, (o) => {
        const ox = o.x - pr.x, oz = o.z - pr.z, od = Math.hypot(ox, oz) || 1;
        damageEnemy(o, pr.dmg, pr.w, ox / od, oz / od, pr.knock);
      });
      sparkBurst(e.x, ty, e.z, 8, 0xffe0a0, 4, 0.35);
      for (let i = 0; i < 3; i++) spawnParticle(e.x, ty, e.z, rand(-2, 2), rand(2, 4), rand(-2, 2), 0.6, 0.18, 0.55, 0.38, 0.24, 6);
      Sound.hit();
      pr.state = 2;
    } else { pr.x += (dx / d) * v; pr.y += (dy / d) * v; pr.z += (dz / d) * v; }
    return;
  }
  // zurück zum Spieler
  const tx = p.x, ty = p.y + 3.2, tz = p.z;
  const dx = tx - pr.x, dy = ty - pr.y, dz = tz - pr.z, d = Math.hypot(dx, dy, dz) || 1;
  const v = pr.speed * 0.9 * dt;
  pr.yaw = Math.atan2(dx, dz); pr.pitch = -Math.atan2(dy, Math.hypot(dx, dz)) * 0.5;
  if (d < 2.2 || d < v) {
    pr.state = 0; pr.t = pr.cd; pr.ph = Math.atan2(pr.x - p.x, pr.z - p.z);
  } else { pr.x += (dx / d) * v; pr.y += (dy / d) * v; pr.z += (dz / d) * v; }
}

function renderProjectiles(a) {
  const inst = Projectiles.inst, glow = FX.glow;
  for (const k in inst) inst[k].begin();
  const p = G.player, ppx = ilerp(p.px, p.x, a), ppy = ilerp(p.py, p.y, a), ppz = ilerp(p.pz, p.z, a);
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
      case 'thrust': {
        const k = Math.min(1, (pr.t + FX.dt * a) / pr.T), ext = Math.sin(k * Math.PI);
        const dx = Math.sin(pr.yaw), dz = Math.cos(pr.yaw), cl = 1.0 + ext * (pr.len - 1.0);
        const sx = ppx + dx * 0.25, sy = ppy + 1.0, sz = ppz + dz * 0.25;
        inst.lanceShaft.add(sx, sy, sz, 0, pr.yaw, 0, 1, 1, cl);
        m.add(sx + dx * cl, sy, sz + dz * cl, 0, pr.yaw, 0, 1, 1, 1);
        glow.add(sx + dx * (cl + 0.5), sy, sz + dz * (cl + 0.5), 1.4 * ext + 0.2, 1, 0.95, 0.7, 0.5);
        break;
      }
      case 'spiral':
        m.add(x, y, z, 0.5, spin * 14, Math.sin(spin * 9) * 0.4, pr.size, pr.size, pr.size);
        glow.add(x, y + 0.2, z, 1.8 * pr.size, 1, 0.82, 0.35, 0.35);
        break;
      case 'pet': {
        const fl = Math.sin(pr.flap);
        m.add(x, y, z, pr.pitch, pr.yaw, fl * 0.12, 0.85 + Math.abs(fl) * 0.35 * (pr.state === 1 ? 0.3 : 1), 1, 1);
        if (pr.state === 1) glow.add(x, y, z, 1.2, 1, 0.85, 0.5, 0.25);
        break;
      }
      case 'whirl': {
        const ang = alerp(pr.pang, pr.ang, a), R = ilerp(pr.pR, pr.curR, a);
        const sx = Math.sin(ang), sz = Math.cos(ang), hy = ppy + 1.0;
        const bx = ppx + sx * R, bz = ppz + sz * R;
        m.add(bx, hy, bz, 0, ang + Math.PI / 2, 0, 1.3, 1.3, 1.3);
        glow.add(bx, hy, bz, 1.4, 0.85, 0.9, 1, 0.35);
        const links = 7;
        for (let i = 1; i < links; i++) {
          const f = i / links;
          inst.chainLink.add(ppx + sx * R * f, hy + Math.sin(f * Math.PI) * 0.15, ppz + sz * R * f, i % 2 ? Math.PI / 2 : 0, ang, 0, 1, 1, 1);
        }
        break;
      }
      case 'turret': {
        const s = Math.min(1, pr.rise) * (pr.life < 0.4 ? Math.max(0, pr.life / 0.4) : 1);
        const k = pr.kick || 0;
        m.add(pr.x - Math.sin(pr.yaw) * k * 0.15, pr.y - (1 - s) * 1.2, pr.z - Math.cos(pr.yaw) * k * 0.15, 0, pr.yaw, 0, 1, 1 + k * 0.06, 1);
        break;
      }
      case 'toss':
        m.add(x, y, z, spin * 14, pr.yaw, 0, pr.size, pr.size, pr.size);
        break;
    }
  }
  // Flächen mit eigenen Modellen
  for (const zn of Projectiles.zones) {
    if (zn.kind === 'root') {
      const ti = inst.thorn, end = smoothstep(zn.life - 0.3, zn.life, zn.age);
      for (const sp of zn.spikes) {
        const grow = smoothstep(sp.delay, sp.delay + 0.14, zn.age) * (1 - end);
        if (grow <= 0.01) continue;
        const s = sp.s * (0.6 + 0.4 * zn.r / 3.4);
        ti.add(sp.x, groundHeight(sp.x, sp.z) - 0.15, sp.z, sp.tilt, sp.yaw, 0, s, s * grow, s);
      }
    } else if (zn.kind === 'vortex') {
      const k = zn.age / zn.life, grow = Math.min(1, zn.age * 5) * (1 - smoothstep(0.85, 1, k) * 0.6);
      const gy = groundHeight(zn.x, zn.z), s = zn.r * 0.42 * grow;
      inst.vortex.add(zn.x, gy + 0.7, zn.z, 0, zn.age * 7, 0, s, s, s);
      glow.add(zn.x, gy + 0.7, zn.z, zn.r * 1.6 * grow, 0.55, 0.25, 0.9, 0.5);
      for (let i = 0; i < 10; i++) {
        const f = (zn.age * 0.9 + i / 10) % 1, an = i * 2.4 + zn.age * 5 + f * 3, rr = zn.r * 1.3 * (1 - f);
        glow.add(zn.x + Math.sin(an) * rr, gy + 0.3 + f * 0.5, zn.z + Math.cos(an) * rr, 0.6, 0.75, 0.5, 1, 0.8 * f);
      }
    } else if (zn.kind === 'smoke') {
      const fade = Math.min(1, zn.age * 4) * (1 - smoothstep(zn.life - 0.7, zn.life, zn.age));
      const gy = groundHeight(zn.x, zn.z);
      for (let i = 0; i < 12; i++) {
        const h = (zn.seed + i * 0.6180339) % 1, an = zn.seed + i * 2.4 + zn.age * (0.25 + h * 0.3) * (i % 2 ? 1 : -1);
        const rr = zn.r * (0.15 + 0.75 * h);
        const sz = zn.r * (0.85 + 0.3 * Math.sin(zn.age * 1.5 + i)) * fade;
        FX.soft.add(zn.x + Math.sin(an) * rr, gy + 0.5 + h * 0.9, zn.z + Math.cos(an) * rr, sz, 0.56, 0.54, 0.66, 0.55 * fade);
      }
    }
  }
  // Arkanstrahl
  for (const w of G.weapons) {
    const s = w.state;
    if (w.def.type !== 'beam' || !(s.active > 0) || !s.n) continue;
    const base = ilerp(s.prevA, s.a, a), el = s.T - s.active;
    const ramp = Math.min(1, el * 8, s.active * 8);
    for (let k = 0; k < s.n; k++) {
      const an = base + (k / s.n) * TAU, dx = Math.sin(an), dz = Math.cos(an);
      const cx = ppx + dx * s.len / 2, cy = ppy + 1.0, cz = ppz + dz * s.len / 2;
      inst.beam.add(cx, cy, cz, 0, an, 0, s.wd * 2.2 * ramp, 0.5 * ramp, s.len, 0.55, 0.25, 1.0);
      inst.beam.add(cx, cy, cz, 0, an, 0, s.wd * 0.7 * ramp, 0.2 * ramp, s.len, 1.2, 1.1, 1.3);
      for (let d = 1.5; d < s.len; d += 2.2) glow.add(ppx + dx * d, cy, ppz + dz * d, 1.1 * ramp, 0.7, 0.45, 1, 0.35);
      glow.add(ppx + dx * s.len, cy, ppz + dz * s.len, 2.2 * ramp, 0.85, 0.6, 1, 0.6);
      if (Math.random() < 0.5) spawnSpark(ppx + dx * s.len, cy, ppz + dz * s.len, rand(-1, 1), rand(0.5, 2), rand(-1, 1), 0.3, 0.45, 0xd9b8ff, 0);
    }
  }
  // Umlaufende Klingen und Auren hängen am (geglätteten) Spieler
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
