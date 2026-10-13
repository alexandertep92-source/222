'use strict';
// Rumms! – Zwischenbosse (5:00, 10:00, 12:30) und der Endboss nach 15 Minuten.

function spawnBoss(id) {
  const def = BOSSES[id], p = G.player;
  let x = 0, z = 0;
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * TAU;
    x = clamp(p.x + Math.sin(a) * 24, -CONFIG.MAP_HALF + 4, CONFIG.MAP_HALF - 4);
    z = clamp(p.z + Math.cos(a) * 24, -CONFIG.MAP_HALF + 4, CONFIG.MAP_HALF - 4);
    if (Math.hypot(x - p.x, z - p.z) > 16) break;
  }
  const mesh = buildBossModel(def.model);
  W.scene.add(mesh);
  const hp = def.hp * (G.nightmare ? NIGHTMARE.bossHp : 1);
  const b = {
    boss: true, id, def, x, z, y: groundHeight(x, z), r: def.r, h: def.h,
    hp, maxHp: hp, speed: def.speed, dmg: def.dmg * enemyDmgScale(G.time / 60) * 0.7 * (G.nightmare ? NIGHTMARE.bossDmg : 1),
    mass: 999, alive: true, dying: false, deathT: 0,
    state: 'walk', stateT: 0, atkCd: 3, atkIdx: 0, rot: Math.atan2(p.x - x, p.z - z),
    flash: 0, slowT: 0, slow: 0, hitT: new Float32Array(4), lift: 0, enraged: false,
    mesh, sx: 0, sz: 0, tx: 0, tz: 0, cx: 0, cz: 0, waves: 0, phase: 0,
    px: x, pz: z, pvy: groundHeight(x, z), prot: 0, hitAt: -9, emitT: 0, circle: Math.random() < 0.5 ? -1 : 1,
  };
  b.prot = b.rot;
  G.bosses.push(b);
  G.bossBar = b;
  Sound.boss();
  G.shake = Math.max(G.shake, 0.4);
  vibrate(120);
  ringFx(x, z, 6, 0xff3b3b, 0.8, 0.1);
  UI.banner(def.name, def.final ? 'Besiege ihn, um die Runde zu gewinnen!' : 'Ein Zwischenboss ist erschienen.', 3);
  return b;
}

function startBossAttack(b) {
  const atk = b.def.attacks[b.atkIdx++ % b.def.attacks.length];
  const p = G.player;
  b.state = atk; b.stateT = 0; b.waves = 0; b.emitT = 0;
  if (atk === 'slam') {
    const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz) || 1, j = Math.min(d, 12);
    b.sx = b.x; b.sz = b.z; b.tx = b.x + (dx / d) * j; b.tz = b.z + (dz / d) * j;
    warnFx(b.tx, b.tz, b.r + 1.5, 1.0);
  } else if (atk === 'charge') {
    Sound.boss();
  }
}

function updateBosses(dt) {
  const p = G.player;
  for (let i = G.bosses.length - 1; i >= 0; i--) {
    const b = G.bosses[i];
    if (b.dying) {
      b.deathT += dt;
      b.mesh.position.y = b.y - b.deathT * 3;
      b.mesh.rotation.z = Math.sin(b.deathT * 20) * 0.1;
      b.mesh.scale.setScalar(Math.max(0.01, 1 - b.deathT * 0.6));
      if (Math.random() < 0.5) spawnBurst(b.x + rand(-2, 2), b.y + rand(1, b.h), b.z + rand(-2, 2), 4, 0xffc93c, 6, 0.6);
      if (b.deathT > 1.5) { W.scene.remove(b.mesh); G.bosses.splice(i, 1); }
      continue;
    }
    b.px = b.x; b.pz = b.z; b.pvy = b.y + b.lift; b.prot = b.rot;
    const dx = p.x - b.x, dz = p.z - b.z, d = Math.hypot(dx, dz) || 1;
    b.stateT += dt;
    if (b.slowT > 0) b.slowT -= dt;
    if (b.flash > 0) b.flash -= dt;
    const slow = b.slowT > 0 ? 1 - b.slow : 1;
    if (!b.enraged && b.hp < b.maxHp * 0.5) {
      b.enraged = true; b.speed *= 1.2;
      UI.banner(`${b.def.name} wird wütend!`, '', 1.6);
      Sound.boss();
    }
    const cdMul = b.enraged ? 0.65 : 1;
    let lift = b.def.hover ? 0.9 + Math.sin(G.time * 2) * 0.25 : 0;
    const face = (rate) => { b.rot += angleDiff(b.rot, Math.atan2(dx, dz)) * Math.min(1, dt * rate); };
    switch (b.state) {
      case 'walk':
        face(4);
        if (b.def.keep) {
          // Abstand halten und seitlich um den Spieler kreisen
          const want = b.def.keep;
          let mx = (-dz / d) * 0.7 * b.circle, mz = (dx / d) * 0.7 * b.circle;
          if (d > want + 3) { mx += dx / d; mz += dz / d; } else if (d < want - 3) { mx -= dx / d; mz -= dz / d; }
          if (Math.random() < dt * 0.15) b.circle *= -1;
          b.x += mx * b.speed * slow * dt; b.z += mz * b.speed * slow * dt;
        } else if (d > b.r + 0.4) { b.x += (dx / d) * b.speed * slow * dt; b.z += (dz / d) * b.speed * slow * dt; }
        b.atkCd -= dt;
        if (b.atkCd <= 0) startBossAttack(b);
        break;
      case 'slam': {
        const T = 1.0, k = Math.min(1, b.stateT / T);
        lift = Math.sin(k * Math.PI) * 4.5;
        b.x = lerp(b.sx, b.tx, k); b.z = lerp(b.sz, b.tz, k);
        if (k >= 1) {
          addShockwave(b.x, b.z, 26, 12, b.dmg * 0.6);
          if (d < b.r + 1.6 && p.y - groundHeight(p.x, p.z) < 1) hurtPlayer(b.dmg, 'boss');
          ringFx(b.x, b.z, b.r + 3, 0xd9a066, 0.5, 0.2);
          spawnBurst(b.x, b.y + 0.3, b.z, 24, 0xb08a5a, 10, 0.8);
          Sound.stomp(); vibrate(60);
          G.shake = Math.max(G.shake, 0.5);
          b.state = 'walk'; b.atkCd = rand(2.0, 3.0) * cdMul;
        }
        break;
      }
      case 'charge': {
        if (b.stateT < 0.85) {
          face(6);
          b.flash = Math.sin(b.stateT * 30) > 0 ? 0.05 : 0;
          b.cx = Math.sin(b.rot); b.cz = Math.cos(b.rot);
        } else if (b.stateT < 1.95) {
          const sp = 17 * slow;
          b.x += b.cx * sp * dt; b.z += b.cz * sp * dt;
          if (Math.random() < 0.6) spawnParticle(b.x, b.y + 0.3, b.z, rand(-2, 2), rand(1, 3), rand(-2, 2), 0.5, 0.6, 0.75, 0.65, 0.5, 8);
        } else { b.state = 'walk'; b.atkCd = rand(1.8, 2.8) * cdMul; }
        break;
      }
      case 'burst': {
        face(3);
        if (b.stateT > 0.4 + b.waves * 0.5 && b.waves < 3) {
          const n = 16, off = b.waves * 0.2;
          for (let k = 0; k < n; k++) {
            const a = off + (k / n) * TAU;
            fireEnemyOrb(b.x + Math.sin(a) * b.r, groundHeight(b.x, b.z) + 0.55, b.z + Math.cos(a) * b.r, Math.sin(a), Math.cos(a), 8, b.dmg * 0.45, 0xff7b3a);
            EnemyShots.list[EnemyShots.list.length - 1].low = true;
          }
          b.waves++;
          Sound.zap();
        }
        if (b.stateT > 1.9) { b.state = 'walk'; b.atkCd = rand(2.0, 3.0) * cdMul; }
        break;
      }
      case 'rocks': {
        face(4);
        if (b.stateT > 0.35 && b.waves === 0) {
          b.waves = 1;
          const n = b.def.final ? 6 : 4;
          for (let k = 0; k < n; k++) {
            const a = Math.random() * TAU, r = k === 0 ? 0 : rand(2, 7);
            addRock(b.x, b.z, p.x + Math.sin(a) * r + p.vx * 0.6, p.z + Math.cos(a) * r + p.vz * 0.6, b.dmg * 0.7);
          }
        }
        if (b.stateT > 1.2) { b.state = 'walk'; b.atkCd = rand(1.8, 2.6) * cdMul; }
        break;
      }
      case 'summon': {
        if (b.stateT > 0.5 && b.waves === 0) {
          b.waves = 1;
          const n = b.def.final ? 10 : b.def.summon ? 8 : 6;
          for (let k = 0; k < n; k++) {
            const a = (k / n) * TAU;
            const x = b.x + Math.sin(a) * (b.r + 3), z = b.z + Math.cos(a) * (b.r + 3);
            Enemies.spawn(b.def.summon ? pick(b.def.summon) : pickSpawnType(), clamp(x, -CONFIG.MAP_HALF, CONFIG.MAP_HALF), clamp(z, -CONFIG.MAP_HALF, CONFIG.MAP_HALF));
          }
          ringFx(b.x, b.z, b.r + 3, 0xc58bff, 0.5, 0.3);
        }
        if (b.stateT > 1.0) { b.state = 'walk'; b.atkCd = rand(1.5, 2.5) * cdMul; }
        break;
      }
      // ---- Hexe Morla ----
      case 'spiral': {
        // Drei Arme aus niedrigen Kugeln drehen sich nach außen: drüberspringen oder durch die Lücken
        face(2);
        if (b.stateT > 0.3 && b.stateT < 2.3) {
          b.emitT += dt;
          while (b.emitT >= 0.09) {
            b.emitT -= 0.09;
            for (let k = 0; k < 3; k++) {
              const a = b.stateT * 2.6 * b.circle + (k / 3) * TAU;
              fireEnemyOrb(b.x + Math.sin(a) * b.r, groundHeight(b.x, b.z) + 0.55, b.z + Math.cos(a) * b.r, Math.sin(a), Math.cos(a), 7.5, b.dmg * 0.35, 0xb06aff);
              EnemyShots.list[EnemyShots.list.length - 1].low = true;
            }
          }
          if (Math.random() < dt * 8) Sound.zap();
        }
        if (b.stateT > 2.6) { b.state = 'walk'; b.atkCd = rand(1.6, 2.4) * cdMul; }
        break;
      }
      case 'homing': {
        // Verfolgende Totenköpfe: wegrennen oder mit Sprint ausweichen
        face(4);
        if (b.stateT > 0.5 && b.waves === 0) {
          b.waves = 1;
          for (let k = 0; k < 3; k++) {
            const a = b.rot + (k - 1) * 0.8;
            fireEnemyOrb(b.x + Math.sin(a) * 1.6, b.y + lift + 3.2, b.z + Math.cos(a) * 1.6, Math.sin(a), Math.cos(a), 6.4, b.dmg * 0.55, 0x9dff5a);
            const sh = EnemyShots.list[EnemyShots.list.length - 1];
            sh.homing = 4.2; sh.r = 0.55; sh.life = 6.5;
          }
          Sound.whoom();
        }
        if (b.stateT > 1.0) { b.state = 'walk'; b.atkCd = rand(1.2, 2.0) * cdMul; }
        break;
      }
      case 'blink': {
        // verschwindet in einer Rauchwolke und taucht woanders wieder auf
        if (b.stateT >= 0.45 && b.waves === 0) {
          b.waves = 1;
          smokeBurst(b.x, b.y + 2, b.z, 10, 0x6a4a8a, 2.2, 3);
          const a = Math.random() * TAU, r = rand(8, 11), H = CONFIG.MAP_HALF - 4;
          b.x = clamp(p.x + Math.sin(a) * r, -H, H); b.z = clamp(p.z + Math.cos(a) * r, -H, H);
          b.px = b.x; b.pz = b.z;
          smokeBurst(b.x, groundHeight(b.x, b.z) + 2, b.z, 10, 0x6a4a8a, 2.2, 3);
          ringFx(b.x, b.z, 3, 0xc58bff, 0.4, 0.2);
          Sound.whoom();
        }
        if (b.stateT > 0.9) { b.state = 'walk'; b.atkCd = 0.5; }
        break;
      }
      case 'puddles': {
        face(4);
        if (b.stateT > 0.4 && b.waves === 0) {
          b.waves = 1;
          for (let k = 0; k < 3; k++) {
            const a = Math.random() * TAU, r = k === 0 ? 0 : rand(2.5, 5);
            addPoison(p.x + Math.sin(a) * r + p.vx * 0.4, p.z + Math.cos(a) * r + p.vz * 0.4, 2.6, b.dmg * 0.22);
          }
          Sound.puff();
        }
        if (b.stateT > 1.0) { b.state = 'walk'; b.atkCd = rand(1.5, 2.3) * cdMul; }
        break;
      }
      default: b.state = 'walk';
    }
    const H = CONFIG.MAP_HALF;
    b.x = clamp(b.x, -H, H); b.z = clamp(b.z, -H, H);
    b.y = groundHeight(b.x, b.z);
    b.lift = lift;
    // Berührung
    const ddx = p.x - b.x, ddz = p.z - b.z, dd = Math.hypot(ddx, ddz) || 0.01;
    if (b.state !== 'blink' && dd < b.r + 0.45 && p.y < b.y + lift + b.h * 0.85 && p.y + 1.7 > b.y + lift) {
      hurtPlayer(b.state === 'charge' ? b.dmg * 1.2 : b.dmg, 'boss');
      const push = (b.r + 0.45 - dd);
      p.x += (ddx / dd) * push; p.z += (ddz / dd) * push;
    }
    b.phase += dt * (b.state === 'charge' && b.stateT > 0.85 ? 14 : 5);
  }
}

// Darstellung mit Zwischenwerten (flüssig auch bei 90/120 Hz)
function renderBosses(a) {
  for (const b of G.bosses) {
    if (b.dying) continue;
    const m = b.mesh, parts = m.userData.parts;
    m.position.set(ilerp(b.px, b.x, a), ilerp(b.pvy, b.y + b.lift, a), ilerp(b.pz, b.z, a));
    m.rotation.y = alerp(b.prot, b.rot, a);
    const hk = Math.exp(-(G.time - b.hitAt) * 16) * 0.05;
    if (b.def.model === 'slimeKing') {
      const s = Math.sin(b.phase * 1.5);
      m.scale.set(1 - s * 0.05 + hk, 1 + s * 0.08 + (b.state === 'slam' ? 0.15 : 0) - hk, 1 - s * 0.05 + hk);
      for (const e of parts.eyes) e.scale.y = Math.sin(G.time * 0.7) > 0.985 ? 0.15 : 1;
    } else if (b.def.model === 'witch') {
      const casting = b.state !== 'walk' && b.state !== 'blink';
      parts.armR.rotation.x = casting ? -1.25 + Math.sin(G.time * 12) * 0.08 : -0.3 - Math.sin(b.phase) * 0.2;
      parts.armL.rotation.x = Math.sin(b.phase) * 0.3;
      parts.armL.rotation.z = casting ? -0.7 : -0.15;
      m.rotation.z = Math.sin(b.phase * 0.7) * 0.05;
      let s = 1;
      if (b.state === 'blink') { const t = b.stateT; s = Math.max(0.02, t < 0.45 ? 1 - t / 0.45 : Math.min(1, (t - 0.45) / 0.45)); }
      m.scale.set((1 + hk) * s, (1 - hk) * s, (1 + hk) * s);
      m.updateMatrixWorld();
      parts.staff.localToWorld(_bv.set(0, 2.45, 0));
      FX.glow.add(_bv.x, _bv.y, _bv.z, (casting ? 4.5 : 3) * s, 0.75, 0.45, 1, 0.75);
      if (Math.random() < 0.35) spawnSpark(_bv.x + rand(-0.4, 0.4), _bv.y, _bv.z + rand(-0.4, 0.4), 0, rand(0.5, 1.5), 0, 0.6, 0.4, 0xc58bff, 0);
    } else {
      if (parts.armL) parts.armL.rotation.x = Math.sin(b.phase) * 0.4;
      if (parts.armR) parts.armR.rotation.x = b.state === 'slam' ? -2.4 * Math.sin(Math.min(1, b.stateT) * Math.PI) : -Math.sin(b.phase) * 0.4;
      m.rotation.z = Math.sin(b.phase) * 0.04;
      m.scale.set(1 + hk, 1 - hk, 1 + hk);
    }
    if (parts.glowPts) {
      m.updateMatrixWorld();
      for (const g of parts.glowPts) {
        _bv.set(g[0], g[1], g[2]).applyMatrix4(m.matrixWorld);
        if (b.def.model === 'witch') FX.glow.add(_bv.x, _bv.y, _bv.z, 1.2, 0.75, 1, 0.3, 0.8);
        else FX.glow.add(_bv.x, _bv.y, _bv.z, 1.6, 1, 0.75, 0.2, 0.7);
      }
    }
    for (const mt of m.userData.mats) {
      if (!mt.userData.baseEmissive) mt.userData.baseEmissive = mt.emissive.clone();
      if (b.flash > 0) mt.emissive.setRGB(0.35, 0.35, 0.35);
      else if (b.state === 'charge' && b.stateT < 0.85) mt.emissive.setRGB(0.7, 0.05, 0.05);
      else mt.emissive.copy(mt.userData.baseEmissive);
    }
  }
}
const _bv = new THREE.Vector3();

function onBossKilled(b) {
  b.alive = false; b.dying = true; b.deathT = 0;
  G.bossesKilled++;
  G.bossIds.push(b.id);
  if (G.bossBar === b) G.bossBar = G.bosses.find((o) => o.alive && o !== b) || null;
  Sound.stomp(); Sound.chest();
  G.shake = Math.max(G.shake, 0.6);
  vibrate(200);
  spawnBurst(b.x, b.y + 2, b.z, 40, 0xffc93c, 12, 0.8);
  if (b.def.final) {
    UI.banner('Sieg!', `${b.def.name} ist gefallen.`, 3);
    endRun(true);
    return;
  }
  dropXp(b.x, b.z, b.def.xp);
  dropCoins(b.x, b.z, b.def.gold);
  spawnChest(b.x + 2, b.z, true, 3);
  UI.banner(`${b.def.name} besiegt!`, 'Eine epische Truhe ist erschienen.', 2.5);
}
