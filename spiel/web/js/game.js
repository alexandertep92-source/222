'use strict';
// Rumms! – Spielablauf: Runde, Eingabe, Kamera, Gegnerwellen, Truhen, Schreine, Level-ups, Hauptschleife.

let G = null; // Zustand der laufenden Runde
const App = { state: 'loading', lastT: 0, menuT: 0, fps: 60, frameAcc: 0, frames: 0, autoQ: 0, acc: 0 };

// ---------- Bildschirm: Querformat erzwingen, auch wenn die App im Hochformat bleibt ----------
// Im erzwungenen Querformat wird #app um 90° gedreht. Alle Koordinaten im Spiel
// beziehen sich auf die gedrehte Fläche (View.w × View.h).
const View = {
  w: 1, h: 1, rot: 0, sw: 1, sh: 1,
  update() {
    const sw = window.innerWidth, sh = window.innerHeight;
    this.sw = sw; this.sh = sh;
    const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const mode = Settings.landscape || 'auto';
    let rot = 0;
    if (sh > sw * 1.05 && mode !== 'off' && (coarse || mode !== 'auto')) rot = mode === 'ccw' ? -90 : 90;
    this.rot = rot;
    const app = document.getElementById('app');
    if (rot) {
      this.w = sh; this.h = sw;
      app.style.width = `${sh}px`; app.style.height = `${sw}px`;
      app.style.transformOrigin = '0 0';
      app.style.transform = rot === 90 ? `translate(${sw}px, 0) rotate(90deg)` : `translate(0, ${sh}px) rotate(-90deg)`;
      app.classList.add('rotated');
    } else {
      this.w = sw; this.h = sh;
      app.style.width = ''; app.style.height = ''; app.style.transform = ''; app.style.transformOrigin = '';
      app.classList.remove('rotated');
    }
  },
  // Bildschirmpunkt → Punkt auf der (evtl. gedrehten) Spielfläche
  toGame(cx, cy) {
    if (this.rot === 90) return [cy, this.sw - cx];
    if (this.rot === -90) return [this.sh - cy, cx];
    return [cx, cy];
  },
  get portrait() { return this.h > this.w; },
};

// ---------- Eingabe ----------
const Input = {
  moveX: 0, moveY: 0, jumpPressed: false, jumpHeld: false, dashPressed: false,
  keys: new Set(),
  joy: { id: null, ox: 0, oy: 0, x: 0, y: 0, active: false },
  cam: { id: null, lx: 0, ly: 0 },
  touchUsed: false, bot: false,
  init(el) {
    el.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (App.state !== 'playing') return;
      if (e.code === 'Space') { this.jumpPressed = true; this.jumpHeld = true; e.preventDefault(); }
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyK') this.dashPressed = true;
      if (e.code === 'Escape' || e.code === 'KeyP') pauseGame();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); if (e.code === 'Space') this.jumpHeld = false; });
    window.addEventListener('blur', () => { this.keys.clear(); this.reset(); });
  },
  reset() {
    this.joy.active = false; this.joy.id = null; this.cam.id = null;
    this.moveX = this.moveY = 0; this.jumpHeld = false;
  },
  down(e) {
    if (App.state !== 'playing') return;
    if (e.pointerType === 'touch') this.touchUsed = true;
    const [gx, gy] = View.toGame(e.clientX, e.clientY);
    const w = View.w;
    if (gx < w * 0.45 && this.joy.id === null) {
      this.joy.id = e.pointerId; this.joy.active = true;
      this.joy.ox = clamp(gx, 70, w * 0.45); this.joy.oy = clamp(gy, 70, View.h - 60);
      this.joy.x = gx; this.joy.y = gy;
    } else if (this.cam.id === null) {
      this.cam.id = e.pointerId; this.cam.lx = gx; this.cam.ly = gy;
    }
    e.preventDefault();
  },
  move(e) {
    if (e.pointerId !== this.joy.id && e.pointerId !== this.cam.id) return;
    const [gx, gy] = View.toGame(e.clientX, e.clientY);
    if (e.pointerId === this.joy.id) {
      this.joy.x = gx; this.joy.y = gy;
      const R = 56, dx = gx - this.joy.ox, dy = gy - this.joy.oy, d = Math.hypot(dx, dy);
      if (d > R * 1.6) { this.joy.ox += (dx / d) * (d - R * 1.6); this.joy.oy += (dy / d) * (d - R * 1.6); }
      e.preventDefault();
    } else if (G) {
      const s = 0.0068 * Settings.sensitivity;
      G.camYawT -= (gx - this.cam.lx) * s;
      G.camPitchT = clamp(G.camPitchT + (gy - this.cam.ly) * s * 0.6, 0.18, 1.1);
      this.cam.lx = gx; this.cam.ly = gy;
      G.camTouched = 1.5;
      e.preventDefault();
    }
  },
  up(e) {
    if (e.pointerId === this.joy.id) { this.joy.id = null; this.joy.active = false; }
    if (e.pointerId === this.cam.id) this.cam.id = null;
  },
  update(dt) {
    let mx = 0, my = 0;
    if (this.joy.active) {
      const R = 56, dx = (this.joy.x - this.joy.ox) / R, dy = (this.joy.y - this.joy.oy) / R;
      const d = Math.hypot(dx, dy);
      // weiche Totzone; volle Geschwindigkeit schon kurz vor dem Rand
      if (d > 0.12) { const m = Math.min(1, (d - 0.12) / 0.72); const k = m / d; mx = dx * k; my = -dy * k; }
    }
    const K = this.keys;
    if (K.has('KeyW') || K.has('ArrowUp')) my += 1;
    if (K.has('KeyS') || K.has('ArrowDown')) my -= 1;
    if (K.has('KeyA') || K.has('ArrowLeft')) mx -= 1;
    if (K.has('KeyD') || K.has('ArrowRight')) mx += 1;
    if (G) {
      if (K.has('KeyQ')) { G.camYawT += dt * 2.4; G.camTouched = 1.5; }
      if (K.has('KeyE')) { G.camYawT -= dt * 2.4; G.camTouched = 1.5; }
    }
    if (this.bot && G) { const b = botMove(); mx = b[0]; my = b[1]; this.jumpHeld = true; }
    const l = Math.hypot(mx, my);
    if (l > 1) { mx /= l; my /= l; }
    this.moveX = mx; this.moveY = my;
  },
};

// ---------- Runde ----------
function newRunState(charDef) {
  return {
    state: 'playing', char: charDef, time: 0, timeScale: 1,
    stats: null, mods: { maxHp: 0, regen: 0, armor: 0, evasion: 0, speed: 0, damage: 0, attackSpeed: 0, area: 0, amount: 0, crit: 0, luck: 0, xpGain: 0, pickup: 0, gold: 0, jumps: 0 },
    player: null, weapons: [], tomes: {}, enemies: [], bosses: [], chests: [], shrines: [],
    level: 1, xp: 0, xpNeed: xpForLevel(1), pendingLevels: 0, rerolls: CONFIG.REROLLS,
    gold: 0, goldEarned: 0, kills: 0, totalDamage: 0, damageTaken: 0, chestsOpened: 0, bossesKilled: 0,
    spawnAcc: 0, nextHorde: 75, miniIdx: 0, finalSpawned: false, relocateT: 0, alive: 0,
    camYaw: 0, camYawT: 0, camPitch: 0.5, camPitchT: 0.5, camT: new THREE.Vector3(), camTouched: 0, shake: 0, camKick: 0, camFov: 60,
    look: new THREE.Vector2(),
    bossBar: null, choice: null, endT: 0, victory: false, god: false,
  };
}

function recalcStats() {
  const c = G.char.stats, m = G.mods, before = G.stats ? G.stats.maxHp : null;
  G.stats = {
    maxHp: c.maxHp + m.maxHp,
    regen: (c.regen || 0) + m.regen,
    armor: Math.min(0.7, (c.armor || 0) + m.armor),
    evasion: Math.min(0.6, (c.evasion || 0) + m.evasion),
    speed: c.speed * (1 + m.speed),
    damage: 1 + m.damage,
    attackSpeed: 1 + m.attackSpeed,
    area: 1 + (c.area || 0) + m.area,
    amount: m.amount,
    crit: 0.05 + (c.crit || 0) + m.crit,
    critDmg: 2,
    luck: m.luck,
    xpGain: 1 + (c.xpGain || 0) + m.xpGain,
    pickup: 3.2 * (1 + m.pickup),
    gold: 1 + m.gold,
    projSpeed: 1 + (c.projSpeed || 0),
    jumps: 1 + (c.jumps || 0) + m.jumps,
  };
  if (before !== null && G.stats.maxHp > before) G.player.hp += G.stats.maxHp - before;
  if (G.player) G.player.hp = Math.min(G.player.hp, G.stats.maxHp);
  for (const w of G.weapons) w.dirty = true;
}

function cleanupRun() {
  if (!G) return;
  clearWeaponVisuals();
  if (G.player) { W.scene.remove(G.player.model, G.player.shadow); }
  for (const b of G.bosses) W.scene.remove(b.mesh);
  for (const c of G.chests) W.scene.remove(c.mesh);
  for (const s of G.shrines) W.scene.remove(s.mesh);
  for (const it of Pickups.items) W.scene.remove(it.mesh);
  for (const w of EnemyShots.waves) W.scene.remove(w.mesh);
  Pickups.gems.length = 0; Pickups.coins.length = 0; Pickups.items.length = 0;
  EnemyShots.list.length = 0; EnemyShots.waves.length = 0; EnemyShots.rocks.length = 0;
  Particles.list.length = 0; Particles.sparks.length = 0; Particles.smoke.length = 0; Popups.list.length = 0;
  Effects.clear();
  for (const e of G.enemies) Enemies.pool.push(e);
  G.enemies.length = 0;
  G = null;
  for (const inst of Instancer.all) inst.mesh.count = 0;
}

function startRun(charId) {
  cleanupRun();
  hidePreview();
  const charDef = CHARACTERS.find((c) => c.id === charId) || CHARACTERS[0];
  // falls bereits ein Lauf aktiv war, Kamera und Takt zurücksetzen
  Settings.char = charDef.id; saveSettings();
  G = newRunState(charDef);
  G.player = createPlayer(charDef);
  recalcStats();
  G.player.hp = G.stats.maxHp;
  G.player.jumpsLeft = G.stats.jumps - 1;
  addWeapon(charDef.weapons[0]);
  placeChestsAndShrines();
  G.camT.set(0, G.player.y + 1.4, 0);
  App.acc = 0;
  Input.reset();
  UI.wipe();
  App.state = 'playing';
  Sound.init();
  Music.intensity = 0; Music.start();
  UI.showHud(true);
  UI.rebuildWeapons();
  UI.banner(`${charDef.title} ${charDef.name}`, 'Überlebe 15 Minuten und besiege den Endboss!', 2.6);
  requestWakeLock();
}

function addWeapon(id) {
  const w = newWeapon(id, G.weapons.length);
  G.weapons.push(w);
  computeWeaponStats(w);
  UI.rebuildWeapons();
}

function placeChestsAndShrines() {
  // Schreine sind Hindernisse nur für diese Runde: Liste auf die feste Deko zurücksetzen.
  if (W.baseObstacles === undefined) W.baseObstacles = W.obstacles.length;
  W.obstacles.length = W.baseObstacles;
  const H = CONFIG.MAP_HALF - 6, spots = [];
  const ok = (x, z, minD) => Math.hypot(x, z) > 16 && obstacleFree(x, z, 2.5) && spots.every((s) => Math.hypot(s[0] - x, s[1] - z) > minD);
  for (let i = 0; i < CONFIG.SHRINES; i++) {
    for (let t = 0; t < 80; t++) {
      const x = rand(-H, H), z = rand(-H, H);
      if (ok(x, z, 30)) {
        spots.push([x, z]);
        const mesh = buildShrine();
        mesh.position.set(x, groundHeight(x, z) - 0.1, z);
        W.scene.add(mesh);
        G.shrines.push({ x, z, mesh, charge: 0, used: false });
        addObstacle(x, z, 0.6, 99);
        for (let k = 0; k < 4; k++) {
          const a = (k / 4) * TAU + Math.PI / 4;
          addObstacle(x + Math.cos(a) * 3.4, z + Math.sin(a) * 3.4, 0.35, 99);
        }
        break;
      }
    }
  }
  for (let i = 0; i < CONFIG.CHESTS; i++) {
    for (let t = 0; t < 80; t++) {
      const x = rand(-H, H), z = rand(-H, H);
      if (ok(x, z, 16)) { spots.push([x, z]); spawnChest(x, z, false); break; }
    }
  }
  buildObstacleGrid();
}

function spawnChest(x, z, free, minRarity) {
  x = clamp(x, -CONFIG.MAP_HALF + 1, CONFIG.MAP_HALF - 1); z = clamp(z, -CONFIG.MAP_HALF + 1, CONFIG.MAP_HALF - 1);
  const mesh = buildChest(free);
  mesh.position.set(x, groundHeight(x, z), z);
  mesh.rotation.y = Math.random() * TAU;
  W.scene.add(mesh);
  const c = { x, z, mesh, free, minRarity: minRarity !== undefined ? minRarity : free ? 2 : 1, opened: false, openT: 0, hintT: 0 };
  G.chests.push(c);
  if (free) ringFx(x, z, 2.5, 0xc58bff, 0.6, 0.2);
  return c;
}
function respawnChest() {
  const p = G.player, H = CONFIG.MAP_HALF - 6;
  for (let t = 0; t < 60; t++) {
    const x = rand(-H, H), z = rand(-H, H);
    if (Math.hypot(x - p.x, z - p.z) > 35 && obstacleFree(x, z, 2.5) && G.chests.every((c) => Math.hypot(c.x - x, c.z - z) > 14)) { spawnChest(x, z, false); return; }
  }
}
function chestPrice() {
  return Math.round((CONFIG.CHEST_BASE_PRICE + CONFIG.CHEST_PRICE_STEP * G.chestsOpened) * (1 + 0.05 * G.time / 60));
}

function updateWorldObjects(dt) {
  const p = G.player;
  for (let i = G.chests.length - 1; i >= 0; i--) {
    const c = G.chests[i], u = c.mesh.userData;
    u.glow.material.opacity = c.opened ? 0 : 0.2 + Math.sin(G.time * 3 + i) * 0.07;
    if (c.opened) {
      c.openT += dt;
      u.lid.rotation.x = -Math.min(1, c.openT * 4) * 1.9;
      if (c.openT > 2.5) { c.mesh.position.y -= dt * 2; }
      if (c.openT > 4) { W.scene.remove(c.mesh); G.chests.splice(i, 1); }
      continue;
    }
    c.hintT -= dt;
    const d = Math.hypot(p.x - c.x, p.z - c.z);
    if (d < 1.9 && p.y - groundHeight(p.x, p.z) < 1.5) {
      const price = c.free ? 0 : chestPrice();
      if (G.gold >= price) {
        G.gold -= price;
        c.opened = true;
        if (!c.free) { G.chestsOpened++; respawnChest(); }
        Sound.chest();
        spawnBurst(c.x, groundHeight(c.x, c.z) + 1, c.z, 18, c.free ? 0xc58bff : 0xffd23f, 6, 0.5);
        openChoice('chest', c.minRarity);
        return;
      } else if (c.hintT <= 0) {
        c.hintT = 2.5;
        Sound.pick();
      }
    }
  }
  for (const s of G.shrines) {
    const u = s.mesh.userData;
    u.crystal.rotation.y += dt * (s.used ? 0.2 : 1.5);
    u.crystal.position.y = 2.7 + Math.sin(G.time * 2) * 0.15;
    if (s.used) continue;
    const d = Math.hypot(p.x - s.x, p.z - s.z);
    if (d < 3.4) s.charge = Math.min(1, s.charge + dt / 3);
    else s.charge = Math.max(0, s.charge - dt / 2);
    u.fill.scale.setScalar(Math.max(0.001, s.charge));
    if (s.charge >= 1) {
      s.used = true;
      u.crystalMat.color.set(0x77737f); u.crystalMat.emissive.set(0x111111); u.crystalMat.emissiveIntensity = 0.2;
      u.ring.material.opacity = 0.1; u.fill.visible = false;
      Sound.chest();
      ringFx(s.x, s.z, 6, 0xc58bff, 0.6, 0.2);
      spawnBurst(s.x, groundHeight(s.x, s.z) + 2.5, s.z, 24, 0xc58bff, 7, 0.5);
      openChoice('shrine', 1);
      return;
    }
  }
}

// ---------- Gegnerwellen ----------
function pickSpawnType() {
  let row = SPAWN_TABLE[0];
  for (const r of SPAWN_TABLE) if (G.time >= r.t) row = r;
  const keys = Object.keys(row.w);
  return weightedPick(keys, (k) => row.w[k]);
}
function spawnPos(minD, maxD) {
  const p = G.player, H = CONFIG.MAP_HALF;
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * TAU, d = rand(minD, maxD);
    const x = clamp(p.x + Math.sin(a) * d, -H, H), z = clamp(p.z + Math.cos(a) * d, -H, H);
    if (Math.hypot(x - p.x, z - p.z) > minD * 0.75) return [x, z];
  }
  return [clamp(p.x + minD, -H, H), p.z];
}
function updateSpawner(dt) {
  const t = G.time, m = t / 60, p = G.player;
  let alive = 0;
  for (const e of G.enemies) if (e.alive) alive++;
  G.alive = alive;
  let rate = spawnRate(Math.min(m, 15));
  if (t > CONFIG.ROUND_SECONDS) rate *= 1.35 + (t - CONFIG.ROUND_SECONDS) / 90;
  if (G.bosses.some((b) => b.alive && !b.def.final)) rate *= 0.45;
  G.spawnAcc += rate * dt;
  const eliteChance = t < 120 ? 0 : 0.012 + m * 0.0016;
  while (G.spawnAcc >= 1) {
    G.spawnAcc -= 1;
    if (alive >= CONFIG.MAX_ENEMIES) { G.spawnAcc = Math.min(G.spawnAcc, 3); break; }
    const [x, z] = spawnPos(26, 36);
    Enemies.spawn(pickSpawnType(), x, z, { elite: Math.random() < eliteChance });
    alive++;
  }
  // Gegner, die zu weit weg sind, wieder in die Nähe holen
  G.relocateT -= dt;
  if (G.relocateT <= 0) {
    G.relocateT = 0.5;
    for (const e of G.enemies) {
      if (!e.alive || e.elite) continue;
      if ((e.x - p.x) ** 2 + (e.z - p.z) ** 2 > 48 * 48) {
        const [x, z] = spawnPos(26, 34);
        e.x = x; e.z = z; e.kvx = e.kvz = 0;
      }
    }
  }
  // Horden
  if (t >= G.nextHorde && t < CONFIG.ROUND_SECONDS) {
    G.nextHorde += CONFIG.HORDE_EVERY;
    const type = pickSpawnType(), n = Math.min(14 + Math.floor(m * 2.5), 50);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      const x = clamp(p.x + Math.sin(a) * 21, -CONFIG.MAP_HALF, CONFIG.MAP_HALF), z = clamp(p.z + Math.cos(a) * 21, -CONFIG.MAP_HALF, CONFIG.MAP_HALF);
      Enemies.spawn(type, x, z);
    }
    UI.banner('Horde!', `${ENEMIES[type].name}-Schwarm kreist dich ein.`, 2);
    Sound.boss();
  }
  // Zwischenbosse
  const mb = CONFIG.MINI_BOSSES[G.miniIdx];
  if (mb && t >= mb.t) { G.miniIdx++; spawnBoss(mb.id); }
  // Endboss
  if (!G.finalSpawned && t >= CONFIG.ROUND_SECONDS) {
    G.finalSpawned = true;
    spawnBoss('finalBoss');
    Music.intensity = 3;
  }
  Music.intensity = t > CONFIG.ROUND_SECONDS ? 3 : t > 600 ? 2 : t > 180 ? 1 : 0;
}

// ---------- Level-ups, Truhen und Schreine: Kartenwahl ----------
function gainXp(v) {
  G.xp += v * G.stats.xpGain;
  while (G.xp >= G.xpNeed) {
    G.xp -= G.xpNeed;
    G.level++;
    G.xpNeed = xpForLevel(G.level);
    G.pendingLevels++;
  }
}

function rollRarity(minIdx) {
  const luck = G.stats.luck;
  const r = weightedPick(RARITIES.map((x, i) => i), (i) => (i < minIdx ? 0 : RARITIES[i].weight * Math.pow(1 + Math.min(luck, 1.2), i)));
  return r === null ? minIdx : r;
}

function fmtTomeValue(T, v) {
  if (T.int) return `+${v} ${T.label}`;
  if (T.fmt === 'flat') return `+${Math.round(v)} ${T.label}`;
  if (T.fmt === 'regen') return `+${v.toFixed(1).replace('.', ',')} ${T.label}`;
  return `+${Math.round(v * 100)} % ${T.label}`;
}

function buildCard(c, minRarity) {
  let ri = rollRarity(minRarity);
  if (c.kind === 'newWeapon') {
    const d = WEAPONS[c.id];
    return { kind: 'newWeapon', id: c.id, rarity: -1, icon: d.icon, title: d.name, sub: 'Neue Waffe', desc: d.desc };
  }
  if (c.kind === 'weaponUp') {
    const w = G.weapons.find((x) => x.id === c.id), d = w.def;
    const opts = d.upgrades.filter((key) => key !== 'amount' || (d.maxAmount && (d.amount || 1) + w.mods.amount < d.maxAmount));
    const key = pick(opts), U = WEAPON_UPGRADES[key];
    let value, text;
    if (U.int) {
      ri = Math.max(ri, U.minRarity || 0);
      value = key === 'amount' ? (ri >= 4 ? 2 : 1) : ri >= 3 ? 2 : 1;
      if (key === 'amount') value = Math.min(value, d.maxAmount - (d.amount || 1) - w.mods.amount);
      text = `+${value} ${U.label}`;
    } else {
      value = U.base * RARITIES[ri].mult;
      text = `+${Math.round(value * 100)} % ${U.label}`;
    }
    const max = w.level + 1 >= CONFIG.WEAPON_MAX_LEVEL ? ' (max.)' : '';
    return { kind: 'weaponUp', id: c.id, stat: key, value, rarity: ri, icon: d.icon, title: d.name, sub: `Stufe ${w.level} → ${w.level + 1}${max}`, desc: text };
  }
  const T = TOMES[c.id];
  let value;
  if (T.int) { ri = Math.max(ri, T.minRarity || 0); value = 1; } else value = T.base * RARITIES[ri].mult;
  const lvl = G.tomes[c.id] || 0;
  return {
    kind: c.kind, id: c.id, stat: T.stat, value, rarity: ri, icon: T.icon,
    title: c.kind === 'blessing' ? `Segen: ${T.label}` : T.name,
    sub: c.kind === 'blessing' ? 'Schreinsegen' : lvl ? `Stufe ${lvl} → ${lvl + 1}` : 'Neues Buch',
    desc: fmtTomeValue(T, value),
  };
}

function makeCards(source, minRarity) {
  const cands = [], ch = G.char;
  if (source !== 'shrine') {
    if (G.weapons.length < CONFIG.MAX_WEAPONS) {
      for (const id of ch.weapons) if (!G.weapons.some((w) => w.id === id)) cands.push({ kind: 'newWeapon', id, weight: source === 'chest' ? 1.5 : 2.6 });
    }
    for (const w of G.weapons) if (w.level < CONFIG.WEAPON_MAX_LEVEL) cands.push({ kind: 'weaponUp', id: w.id, weight: 1.6 });
    for (const id of Object.keys(TOMES)) {
      const T = TOMES[id], lvl = G.tomes[id] || 0;
      if (lvl < (T.max || TOME_MAX_LEVEL)) cands.push({ kind: 'tome', id, weight: T.int ? 0.22 : 0.55 });
    }
  } else {
    for (const id of Object.keys(TOMES)) if (!TOMES[id].int) cands.push({ kind: 'blessing', id, weight: 1 });
  }
  const out = [];
  while (out.length < 3 && cands.length) {
    const c = weightedPick(cands, (x) => x.weight);
    cands.splice(cands.indexOf(c), 1);
    const card = buildCard(c, minRarity);
    if (card) out.push(card);
  }
  if (!out.length) {
    out.push({ kind: 'gold', value: 25, rarity: 0, icon: '💰', title: 'Goldbeutel', sub: 'Alles maximiert', desc: '+25 Gold' });
    out.push({ kind: 'heal', value: 0.5, rarity: 0, icon: '🍖', title: 'Festmahl', sub: 'Alles maximiert', desc: 'Heilt 50 % deiner LP' });
  }
  return out;
}

function openChoice(source, minRarity = 0) {
  if (G.state !== 'playing') return;
  const p = G.player;
  G.state = 'choice';
  App.state = 'choice';
  Input.reset();
  G.choice = { source, minRarity, cards: makeCards(source, minRarity) };
  if (source === 'level') {
    Sound.levelUp();
    // Kleine Druckwelle: verschafft Luft beim Aufsteigen
    Grid.query(p.x, p.z, 5, (e) => {
      if (e.boss) return;
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz) || 1;
      e.kvx += (dx / d) * 14 / e.mass; e.kvz += (dz / d) * 14 / e.mass;
    });
    ringFx(p.x, p.z, 5, 0x46c2ff, 0.5, 0.2);
  }
  UI.showChoice(G.choice);
  if (App.autoPick) setTimeout(() => { if (G && G.choice) chooseCard(0); }, 30);
}

function applyCard(c) {
  switch (c.kind) {
    case 'newWeapon': addWeapon(c.id); break;
    case 'weaponUp': {
      const w = G.weapons.find((x) => x.id === c.id);
      w.mods[c.stat] += c.value; w.level++; w.dirty = true;
      break;
    }
    case 'tome':
      G.tomes[c.id] = (G.tomes[c.id] || 0) + 1;
      G.mods[c.stat] += c.value; recalcStats();
      break;
    case 'blessing': G.mods[c.stat] += c.value; recalcStats(); break;
    case 'gold': G.gold += c.value; break;
    case 'heal': healPlayer(G.stats.maxHp * c.value); break;
  }
  UI.rebuildWeapons();
}

function chooseCard(i) {
  if (!G || !G.choice) return;
  const c = G.choice.cards[i];
  if (!c) return;
  applyCard(c);
  closeChoice();
  Sound.pick();
}
function rerollChoice() {
  if (!G || !G.choice || G.rerolls <= 0) return;
  G.rerolls--;
  G.choice.cards = makeCards(G.choice.source, G.choice.minRarity);
  UI.showChoice(G.choice);
}
function skipChoice() {
  if (!G || !G.choice) return;
  G.gold += 8; G.goldEarned += 8;
  closeChoice();
}
function closeChoice() {
  if (G.choice.source === 'level') G.pendingLevels--;
  G.choice = null;
  UI.hideChoice();
  G.state = 'playing';
  App.state = 'playing';
}

// ---------- Pause, Ende ----------
function pauseGame() {
  if (App.state !== 'playing') return;
  App.state = 'paused';
  Input.reset();
  UI.showPause();
}
function resumeGame() {
  if (App.state !== 'paused') return;
  App.state = G.choice ? 'choice' : 'playing';
  UI.hidePause();
  App.lastT = performance.now();
}
function endRun(victory) {
  if (!G || G.state === 'ending' || G.state === 'over') return;
  G.state = 'ending'; G.victory = victory; G.endT = victory ? 2.2 : 1.4;
  App.state = 'ending';
  Input.reset();
  if (victory) Sound.win(); else Sound.lose();
  const rec = Store.get(RECORDS_KEY, {});
  const r = rec[G.char.id] || { best: 0, level: 0, kills: 0, wins: 0 };
  const survived = Math.min(G.time, CONFIG.ROUND_SECONDS);
  G.newBest = survived > r.best + 0.5 || (victory && !r.wins);
  r.best = Math.max(r.best, survived);
  r.level = Math.max(r.level, G.level);
  r.kills = Math.max(r.kills, G.kills);
  if (victory) { r.wins++; r.bestWin = r.bestWin ? Math.min(r.bestWin, G.time) : G.time; }
  rec[G.char.id] = r;
  Store.set(RECORDS_KEY, rec);
}
function quitToMenu() {
  Music.stop();
  cleanupRun();
  UI.showHud(false);
  App.state = 'title';
  UI.showScreen('title');
  showPreview();
}

// ---------- Kamera ----------
// Gefedert: folgt dem Spieler mit leichtem Vorausblick, Drehung und Neigung werden geglättet.
function updateCamera(dt, a) {
  const p = G.player, cam = W.camera;
  const portrait = View.portrait;
  const px = ilerp(p.px, p.x, a), py = ilerp(p.py, p.y, a), pz = ilerp(p.pz, p.z, a);
  if (Settings.autoCam && p.moving && G.camTouched <= 0 && Input.cam.id === null) {
    G.camYawT += angleDiff(G.camYawT, p.facing + Math.PI) * Math.min(1, dt * 1.2);
  }
  G.camTouched -= dt;
  const ky = 1 - Math.exp(-dt * 16);
  G.camYaw += angleDiff(G.camYaw, G.camYawT) * ky;
  G.camPitch += (G.camPitchT - G.camPitch) * ky;
  // Vorausblick in Laufrichtung, weich
  const lk = 1 - Math.exp(-dt * 3);
  G.look.x += (p.vx * 0.22 - G.look.x) * lk;
  G.look.y += (p.vz * 0.22 - G.look.y) * lk;
  const T = G.camT;
  const kxz = 1 - Math.exp(-dt * 12), ky2 = 1 - Math.exp(-dt * 6);
  T.x += (px + G.look.x - T.x) * kxz;
  T.z += (pz + G.look.y - T.z) * kxz;
  T.y += (py + 1.4 - T.y) * ky2;
  const bossNear = G.bosses.some((b) => b.alive && (b.x - p.x) ** 2 + (b.z - p.z) ** 2 < 900);
  const dist = (portrait ? 13.5 : 10.5) + (bossNear ? 2.5 : 0);
  const pitch = G.camPitch;
  let cx = T.x + Math.sin(G.camYaw) * Math.cos(pitch) * dist;
  let cz = T.z + Math.cos(G.camYaw) * Math.cos(pitch) * dist;
  let cy = T.y + Math.sin(pitch) * dist;
  cy = Math.max(cy, groundHeight(cx, cz) + 1.2);
  // Wackeln: weiches Rauschen statt Zufallssprüngen
  G.shake = Math.max(0, G.shake - dt * 1.6);
  if (G.shake > 0) {
    const s = G.shake * G.shake * 0.9, t = performance.now() / 1000;
    cx += (Math.sin(t * 37) + Math.sin(t * 23.3)) * 0.5 * s;
    cy += (Math.sin(t * 31.7) + Math.sin(t * 19.1)) * 0.5 * s;
    cz += (Math.sin(t * 29.3) + Math.sin(t * 41.9)) * 0.5 * s;
  }
  G.camKick = Math.max(0, G.camKick - dt * 3);
  const fovT = (portrait ? 68 : 58) + (p.dashT > 0 ? 8 : 0) + G.camKick * 4;
  G.camFov += (fovT - G.camFov) * (1 - Math.exp(-dt * 8));
  cam.fov = G.camFov;
  cam.position.set(cx, cy, cz);
  cam.lookAt(T.x, T.y + 0.5, T.z);
}

// ---------- Menüszene: alle Helden im Halbkreis, in der Auswahl nur der gewählte ----------
const Menu = { heroes: {}, pedestal: null, built: false };
function buildMenuScene() {
  if (Menu.built) return;
  Menu.built = true;
  const gh = groundHeight(0, 0);
  const ped = new THREE.Group();
  part(ped, GEO.cyl12, mat({ color: 0xcfc6b3, rough: 0.9 }), 2.6, 0.3, 2.6, 0, 0.15, 0).receiveShadow = true;
  part(ped, GEO.cyl12, mat({ color: 0xa79f8c, rough: 0.95 }), 3.1, 0.16, 3.1, 0, 0.05, 0).receiveShadow = true;
  ped.position.set(0, gh - 0.05, 0);
  W.scene.add(ped);
  Menu.pedestal = ped;
  CHARACTERS.forEach((c, i) => {
    const h = buildHero(c.id);
    W.scene.add(h);
    h.userData.slot = i;
    h.userData.phase = i * 1.3;
    Menu.heroes[c.id] = h;
  });
}
function showPreview() { buildMenuScene(); Menu.pedestal.visible = true; for (const id in Menu.heroes) Menu.heroes[id].visible = true; }
function hidePreview() {
  if (!Menu.built) return;
  Menu.pedestal.visible = false;
  for (const id in Menu.heroes) Menu.heroes[id].visible = false;
}
const menuSlimes = Array.from({ length: 7 }, (_, i) => ({ a: (i / 7) * TAU, r: 6.5 + (i % 3) * 1.6, s: 0.22 + (i % 4) * 0.05, ph: i * 1.7 }));
function updateMenuScene(dt) {
  App.menuT += dt;
  const t = App.menuT, cam = W.camera, gh = groundHeight(0, 0);
  const portrait = View.portrait;
  const select = App.state === 'select';
  if (select) {
    const d = portrait ? 7.2 : 5.4;
    cam.fov = portrait ? 58 : 48;
    cam.position.set(Math.sin(t * 0.15) * 0.6, gh + 2.0, d);
    cam.lookAt(portrait ? 0 : 1.6, gh + (portrait ? 0.5 : 1.15), 0);
  } else {
    cam.fov = portrait ? 66 : 52;
    const ang = Math.sin(t * 0.08) * 0.35;
    cam.position.set(Math.sin(ang) * 9.5, gh + 3.3, Math.cos(ang) * 9.5);
    cam.lookAt(portrait ? 0 : -2.2, gh + 1.25, 0);
  }
  const sel = UI.selected;
  CHARACTERS.forEach((c, i) => {
    const h = Menu.heroes[c.id];
    if (!h) return;
    const u = h.userData;
    let x, z, ry;
    if (select) {
      h.visible = c.id === sel;
      x = 0; z = 0; ry = Math.sin(t * 0.7) * 0.5;
    } else {
      h.visible = true;
      const a = (i - 2) * 0.42;
      x = Math.sin(a) * 4.2; z = -Math.cos(a) * 4.2 + 4.2 - (i === 2 ? 0 : 0.6);
      ry = -a * 0.6 + Math.sin(t * 0.6 + u.phase) * 0.25;
    }
    const y = select ? Menu.pedestal.position.y + 0.3 : groundHeight(x, z);
    // kleiner Freudensprung im Titelbild
    const hop = select ? 0 : Math.max(0, Math.sin(t * 2.2 + u.phase * 2.1)) ** 8 * 0.6;
    h.position.set(x, y + hop, z);
    h.rotation.y = ry;
    u.armR.rotation.x = Math.sin(t * 2 + u.phase) * 0.18 - (hop > 0.05 ? 0.8 : 0);
    u.armL.rotation.x = -Math.sin(t * 2 + u.phase) * 0.12;
    u.armL.rotation.z = hop > 0.05 ? -0.8 : 0; u.armR.rotation.z = hop > 0.05 ? 0.8 : 0;
    u.rig.scale.y = 1 + Math.sin(t * 2.6 + u.phase) * 0.02;
    u.head.position.y = u.head.userData.baseY + Math.sin(t * 2 + u.phase) * 0.025;
    const blink = ((t + u.phase) % 3.7) < 0.12;
    for (const e of u.eyes) e.scale.y = blink ? 0.12 : 1;
  });
  Menu.pedestal.visible = select;
  const inst = Enemies.inst.slime;
  inst.begin();
  for (const s of menuSlimes) {
    const a = s.a + t * s.s, x = Math.sin(a) * s.r, z = Math.cos(a) * s.r - 2;
    const b = Math.sin(t * 9 + s.ph);
    inst.add(x, groundHeight(x, z) + Math.max(0, Math.sin(t * 4.5 + s.ph)) * 0.5, z, 0, a + Math.PI / 2, 0, 1 - b * 0.07, 1 + b * 0.14, 1 - b * 0.07, 1, 1, 1);
  }
  inst.end();
  updateSun(0, 0);
  updateGrass(0, 0, -99);
}

function renderGameObjects(a, dt) {
  renderPlayer(a, dt);
  renderBosses(a);
  Enemies.render(a);
  renderPickups(a);
  renderProjectiles(a);
  renderEnemyShots(a);
  // Truhen und Schreine leuchten
  for (const c of G.chests) {
    if (c.opened) continue;
    if (Math.random() < 0.08) {
      const an = Math.random() * TAU;
      spawnSpark(c.x + Math.sin(an) * 0.8, groundHeight(c.x, c.z) + 0.4, c.z + Math.cos(an) * 0.8, 0, rand(1.2, 2.5), 0, 0.9, 0.35, c.free ? 0xd9b8ff : 0xffe27a, 0);
    }
  }
  for (const s of G.shrines) {
    if (s.used) continue;
    const y = groundHeight(s.x, s.z) + 2.8 + Math.sin(G.time * 2) * 0.15;
    FX.glow.add(s.x, y, s.z, 4 + s.charge * 3, 0.75, 0.5, 1, 0.45 + s.charge * 0.3);
  }
}

// ---------- Hauptschleife ----------
// Fester Takt (60 Schritte pro Sekunde) + Zwischenwerte beim Zeichnen = gleichmäßige Bewegung,
// egal ob das Handy mit 30, 60 oder 120 Bildern pro Sekunde läuft.
const SIM_DT = 1 / 60;
function savePrev() {
  const p = G.player;
  p.px = p.x; p.py = p.y; p.pz = p.z; p.pfacing = p.facing;
  for (const e of G.enemies) { e.px = e.x; e.py = e.y; e.pz = e.z; e.prot = e.rot; }
}
function step(h) {
  // Jedes System prüft erneut: Sieg, Niederlage oder eine Kartenwahl beenden den Schritt.
  const on = () => G.state === 'playing';
  if (on()) {
    G.time += h;
    updatePlayer(h);
  }
  Enemies.update(h);
  updateBosses(h);
  if (on()) updateWeapons(h); else updateProjectiles(h);
  if (on()) updateEnemyShots(h);
  if (on()) updatePickups(h);
  if (on()) updateWorldObjects(h);
  if (on()) updateSpawner(h);
  Enemies.removeDead();
}

function loop(now) {
  requestAnimationFrame(loop);
  let dt = (now - App.lastT) / 1000;
  App.lastT = now;
  if (!(dt > 0)) dt = 0;
  dt = Math.min(dt, 0.1);
  trackFps(dt);
  GFX.time += dt;
  GFX.timeUniform.value = GFX.time;
  FX.glow.begin(); FX.soft.begin();
  let alpha = 1, vdt = dt;
  if (G && (App.state === 'playing' || App.state === 'ending')) {
    Input.update(dt);
    const scale = App.state === 'ending' ? 0.3 : G.timeScale;
    vdt = dt * scale;
    App.acc += vdt;
    const maxSteps = Math.ceil(6 * Math.max(1, scale));
    let n = 0;
    while (App.acc >= SIM_DT && n < maxSteps && G && (G.state === 'playing' || G.state === 'ending')) {
      savePrev();
      step(SIM_DT);
      App.acc -= SIM_DT; n++;
      if (G.state === 'choice') { App.acc = 0; break; }
    }
    if (n >= maxSteps) App.acc = Math.min(App.acc, SIM_DT);
    alpha = clamp(App.acc / SIM_DT, 0, 1);
    if (G && G.state === 'playing' && G.pendingLevels > 0) openChoice('level', 0);
    if (G && App.state === 'ending') {
      G.endT -= dt;
      if (G.endT <= 0) { G.state = 'over'; App.state = 'over'; Music.stop(); UI.showGameOver(); }
    }
  } else if (G) vdt = 0;
  FX.dt = SIM_DT;
  if (G) {
    updateParticles(vdt);
    Effects.update(vdt);
    updatePopups(vdt);
    renderGameObjects(alpha, vdt);
    updateCamera(dt, alpha);
    const p = G.player;
    updateSun(ilerp(p.px, p.x, alpha), ilerp(p.pz, p.z, alpha));
    updateGrass(ilerp(p.px, p.x, alpha), ilerp(p.pz, p.z, alpha), p.y);
  } else {
    updateMenuScene(dt);
    updateParticles(dt);
  }
  moveClouds(dt);
  W.sky.position.copy(W.camera.position);
  W.camera.aspect = View.w / Math.max(1, View.h);
  W.camera.updateProjectionMatrix();
  const scaleU = W.renderer.getPixelRatio() * View.h / (2 * Math.tan((W.camera.fov * Math.PI) / 360));
  FX.glow.uniforms.scale.value = scaleU; FX.soft.uniforms.scale.value = scaleU;
  FX.glow.end(); FX.soft.end();
  renderFrame();
  Overlay.draw();
  if (G) UI.updateHud(dt);
}

// Passt die Auflösung an, wenn das Handy nicht hinterherkommt.
function trackFps(dt) {
  App.frameAcc += dt; App.frames++;
  if (App.frameAcc >= 1) {
    App.fps = App.frames / App.frameAcc;
    App.frameAcc = 0; App.frames = 0;
    if (App.state === 'playing' && G && G.timeScale === 1) {
      if (App.fps < 42 && App.autoQ > -0.45) { App.autoQ -= 0.12; applyResolution(); }
      else if (App.fps > 57 && App.autoQ < 0) { App.autoQ = Math.min(0, App.autoQ + 0.04); applyResolution(); }
    }
  }
}
function applyResolution() {
  View.update();
  const q = QUALITY[Settings.quality];
  const dpr = window.devicePixelRatio || 1;
  const pr = Math.max(0.5, Math.min(dpr, q.pixelRatio) * (1 + App.autoQ));
  W.renderer.setPixelRatio(pr);
  W.renderer.setSize(View.w, View.h, false);
  Post.resize(View.w, View.h, pr);
  Overlay.resize();
  if (typeof UI !== 'undefined' && UI.measureSafe) UI.measureSafe();
}

let wakeLock = null;
function requestWakeLock() {
  try {
    if (navigator.wakeLock && !wakeLock) navigator.wakeLock.request('screen').then((l) => { wakeLock = l; l.addEventListener('release', () => { wakeLock = null; }); }).catch(() => {});
  } catch (_) { /* nicht verfügbar */ }
}

// ---------- Übersichtsebene: Joystick, Zahlen, Minikarte ----------
const Overlay = {
  canvas: null, ctx: null, dpr: 1, v: new THREE.Vector3(),
  init(canvas) { this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.resize(); },
  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(View.w * this.dpr);
    this.canvas.height = Math.round(View.h * this.dpr);
  },
  project(x, y, z) {
    const v = this.v.set(x, y, z).project(W.camera);
    if (v.z > 1) return null;
    return [(v.x * 0.5 + 0.5) * View.w, (-v.y * 0.5 + 0.5) * View.h];
  },
  label(ctx, txt, x, y, size, fill) {
    ctx.font = `900 ${size}px Nunito, system-ui, sans-serif`;
    ctx.lineWidth = Math.max(3, size * 0.28); ctx.strokeStyle = 'rgba(20,14,40,0.9)';
    ctx.strokeText(txt, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(txt, x, y);
  },
  draw() {
    const ctx = this.ctx, W2 = View.w, H2 = View.h;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, W2, H2);
    if (!G) return;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const p = G.player;
    for (const c of G.chests) {
      if (c.opened || (c.x - p.x) ** 2 + (c.z - p.z) ** 2 > 26 * 26) continue;
      const s = this.project(c.x, groundHeight(c.x, c.z) + 2.0, c.z);
      if (!s) continue;
      const price = c.free ? 0 : chestPrice();
      this.label(ctx, c.free ? 'Gratis' : `${price} Gold`, s[0], s[1], 14, c.free ? '#e2c8ff' : G.gold >= price ? '#ffd23f' : '#ff9a9a');
    }
    for (const sh of G.shrines) {
      if (sh.used || sh.charge <= 0) continue;
      const s = this.project(sh.x, groundHeight(sh.x, sh.z) + 4.4, sh.z);
      if (!s) continue;
      ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(20,14,40,0.7)';
      ctx.beginPath(); ctx.arc(s[0], s[1], 17, 0, TAU); ctx.stroke();
      ctx.lineWidth = 5; ctx.strokeStyle = '#c58bff';
      ctx.beginPath(); ctx.arc(s[0], s[1], 17, -Math.PI / 2, -Math.PI / 2 + TAU * sh.charge); ctx.stroke();
    }
    // Schadenszahlen: springen kurz auf und schweben weg
    for (const n of Popups.list) {
      const s = this.project(n.x, n.y, n.z);
      if (!s) continue;
      const k = n.life / n.max, age = 1 - k;
      const pop = age < 0.12 ? 0.6 + (age / 0.12) * 0.75 : age < 0.22 ? 1.35 - ((age - 0.12) / 0.1) * 0.35 : 1;
      const size = (n.crit ? 21 : 15) * pop;
      ctx.globalAlpha = Math.min(1, k * 3);
      this.label(ctx, n.text, s[0], s[1], size, n.color);
    }
    ctx.globalAlpha = 1;
    // Boss außerhalb des Bildes: Pfeil am Rand
    const b = G.bossBar;
    if (b && b.alive) {
      const s = this.project(b.x, b.y + b.h * 0.5, b.z);
      const off = !s || s[0] < 0 || s[0] > W2 || s[1] < 0 || s[1] > H2;
      if (off) {
        const dx = b.x - p.x, dz = b.z - p.z, c = Math.cos(G.camYaw), sn = Math.sin(G.camYaw);
        const ang = Math.atan2(dx * c - dz * sn, -dx * sn - dz * c); // 0 = oben, positiv = rechts
        const x = W2 / 2 + Math.sin(ang) * (W2 / 2 - 40), y = H2 / 2 - Math.cos(ang) * (H2 / 2 - 50);
        const pulse = 1 + Math.sin(performance.now() / 120) * 0.12;
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(pulse, pulse);
        ctx.fillStyle = '#ff4d5a'; ctx.strokeStyle = 'rgba(20,14,40,0.9)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(14, 11); ctx.lineTo(-14, 11); ctx.closePath(); ctx.stroke(); ctx.fill();
        ctx.restore();
      }
    }
    // Joystick
    if (App.state === 'playing' || App.state === 'paused' || App.state === 'choice') {
      const j = Input.joy;
      const coarse = Input.touchUsed || UI.coarse;
      const drawStick = (ox, oy, kx, ky, alpha) => {
        const g = ctx.createRadialGradient(ox, oy, 10, ox, oy, 60);
        g.addColorStop(0, `rgba(27,21,48,${0.05 * alpha})`); g.addColorStop(1, `rgba(27,21,48,${0.35 * alpha})`);
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(ox, oy, 58, 0, TAU); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = `rgba(255,246,224,${0.5 * alpha})`;
        ctx.beginPath(); ctx.arc(ox, oy, 58, 0, TAU); ctx.stroke();
        const kg = ctx.createRadialGradient(kx - 8, ky - 8, 4, kx, ky, 28);
        kg.addColorStop(0, `rgba(255,236,150,${0.95 * alpha})`); kg.addColorStop(1, `rgba(230,160,20,${0.9 * alpha})`);
        ctx.fillStyle = kg;
        ctx.beginPath(); ctx.arc(kx, ky, 27, 0, TAU); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = `rgba(27,21,48,${0.8 * alpha})`; ctx.stroke();
      };
      if (j.active) {
        const dx = j.x - j.ox, dy = j.y - j.oy, d = Math.hypot(dx, dy), k = d > 56 ? 56 / d : 1;
        drawStick(j.ox, j.oy, j.ox + dx * k, j.oy + dy * k, 1);
      } else if (coarse) {
        const x = 112 + UI.safeLeft(), y = H2 - 108;
        drawStick(x, y, x, y, 0.4);
      }
    }
    this.drawMinimap(ctx, W2);
  },
  drawMinimap(ctx, W2) {
    const p = G.player, R = W2 < 700 ? 46 : 56;
    const cx = W2 - R - 14 - UI.safeRight(), cy = 66 + R;
    const scale = R / 62;
    const yaw = G.camYaw;
    const toMap = (x, z) => {
      const dx = x - p.x, dz = z - p.z;
      const c = Math.cos(yaw), s = Math.sin(yaw);
      return [(dx * c - dz * s) * scale, (dx * s + dz * c) * scale];
    };
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU);
    const bg = ctx.createRadialGradient(cx, cy, 4, cx, cy, R);
    bg.addColorStop(0, 'rgba(70,110,70,0.75)'); bg.addColorStop(1, 'rgba(27,21,48,0.8)');
    ctx.fillStyle = bg; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(27,21,48,0.95)'; ctx.stroke();
    ctx.clip();
    const H = CONFIG.MAP_HALF;
    ctx.strokeStyle = 'rgba(255,140,100,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath();
    [[-H, -H], [H, -H], [H, H], [-H, H]].forEach(([x, z], i) => { const m = toMap(x, z); if (i) ctx.lineTo(cx + m[0], cy + m[1]); else ctx.moveTo(cx + m[0], cy + m[1]); });
    ctx.closePath(); ctx.stroke();
    const dot = (x, z, r, col, edge) => {
      let [mx, my] = toMap(x, z);
      const d = Math.hypot(mx, my);
      if (d > R - r - 2) { if (!edge) return; mx *= (R - r - 2) / d; my *= (R - r - 2) / d; }
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + mx, cy + my, r, 0, TAU); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(20,14,40,0.8)'; ctx.stroke();
    };
    for (const e of G.enemies) if (e.alive && e.elite) dot(e.x, e.z, 2.5, '#ffb347', false);
    for (const s of G.shrines) if (!s.used) dot(s.x, s.z, 3.5, '#c58bff', true);
    const price = chestPrice();
    for (const c of G.chests) if (!c.opened) dot(c.x, c.z, 3.5, c.free ? '#d9b8ff' : G.gold >= price ? '#ffd23f' : '#a08a4a', true);
    for (const b of G.bosses) if (b.alive) dot(b.x, b.z, 5, '#ff4d5a', true);
    ctx.restore();
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.PI - (p.facing - yaw));
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(20,14,40,0.9)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.stroke(); ctx.fill();
    ctx.restore();
  },
};

// ---------- Testhilfe: einfacher Bot für automatische Probeläufe ----------
function botMove() {
  const p = G.player;
  let vx = 0, vz = 0;
  for (const e of G.enemies) {
    if (!e.alive) continue;
    const dx = p.x - e.x, dz = p.z - e.z, d2 = dx * dx + dz * dz;
    if (d2 < App.botRange) { const w = 2 / Math.max(d2, 0.3); vx += dx * w; vz += dz * w; }
  }
  // Ziel: Boss auf Abstand halten, sonst Truhen und Schreine ansteuern
  let tx = null, tz = null, keep = 0;
  const boss = G.bosses.find((b) => b.alive);
  if (boss) { tx = boss.x; tz = boss.z; keep = boss.r + 5; } else {
    let best = 1e9;
    const price = chestPrice();
    for (const c of G.chests) if (!c.opened && (c.free || G.gold >= price)) { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < best) { best = d; tx = c.x; tz = c.z; } }
    for (const s of G.shrines) if (!s.used) { const d = Math.hypot(s.x - p.x, s.z - p.z) + 10; if (d < best) { best = d; tx = s.x; tz = s.z; } }
  }
  if (tx !== null) {
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
    const k = keep ? clamp((d - keep) / 3, -1.5, 1) : 1;
    vx += (dx / d) * k * 0.8 + (dz / d) * 0.5 * (keep ? 1 : 0); vz += (dz / d) * k * 0.8 - (dx / d) * 0.5 * (keep ? 1 : 0);
  }
  const l = Math.hypot(vx, vz);
  if (l < 0.05) { vx = Math.sin(G.time * 0.3); vz = Math.cos(G.time * 0.3); }
  if (Math.random() < 0.01) Input.jumpPressed = true;
  if (Math.random() < 0.004) Input.dashPressed = true;
  // Schockwellen überspringen, wie es ein Mensch tun würde
  for (const w of EnemyShots.waves) { const d = Math.hypot(p.x - w.x, p.z - w.z); if (d - w.R > 0 && d - w.R < 1.6 && p.grounded) Input.jumpPressed = true; }
  const fx = -Math.sin(G.camYaw), fz = -Math.cos(G.camYaw), rx = -fz, rz = fx;
  return [vx * rx + vz * rz, vx * fx + vz * fz];
}

// ---------- Start ----------
function boot() {
  View.update();
  const canvas = document.getElementById('gl');
  initWorld(canvas);
  Grid.init();
  Enemies.init();
  initPickups();
  initParticles();
  Effects.init();
  initWeaponVisuals();
  Overlay.init(document.getElementById('overlay'));
  Input.init(document.getElementById('touch'));
  renderPortraits();
  applyResolution();
  window.addEventListener('resize', applyResolution);
  window.addEventListener('orientationchange', () => setTimeout(applyResolution, 200));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { pauseGame(); if (Sound.ctx && Sound.ctx.state === 'running') Sound.ctx.suspend(); } else if (Sound.ctx) Sound.ctx.resume();
  });
  UI.init();
  showPreview();
  App.state = 'title';
  UI.showScreen('title');
  App.lastT = performance.now();
  requestAnimationFrame(loop);
}

// Android-App: Zurück-Taste und Pausieren beim Verlassen
window.rummsBack = function () {
  if (App.state === 'playing') { pauseGame(); return true; }
  if (App.state === 'paused') { resumeGame(); return true; }
  return UI.back();
};
window.rummsPause = function () { pauseGame(); };

// Testschnittstelle (für automatische Probeläufe)
window.__rumms = {
  get G() { return G; }, App, Input,
  start: (id) => startRun(id),
  timeScale: (n) => { if (G) G.timeScale = n; },
  god: (on) => { if (G) G.god = on; },
  skipTo: (sec) => { if (G) { G.time = sec; G.nextHorde = sec + 30; while (G.miniIdx < CONFIG.MINI_BOSSES.length && CONFIG.MINI_BOSSES[G.miniIdx].t < sec) G.miniIdx++; } },
  autoPick: (on) => { App.autoPick = on; if (on && G && G.choice) chooseCard(0); },
  bot: (on) => { Input.bot = on; },
};
