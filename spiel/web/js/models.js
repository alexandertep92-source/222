'use strict';
// Rumms! – Figuren: Helden (Chibi-Stil), Gegner, Bosse, Sammelobjekte und Porträts.

const SKIN = 0xf3c5a0;

// Große Comic-Augen mit Glanzpunkt
function addEyes(head, y, z, spread, size, iris) {
  const white = mat({ color: 0xffffff, rough: 0.3 }), dark = mat({ color: iris || 0x1d1a2c, rough: 0.2 }), shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Group();
    e.position.set(sx * spread, y, z);
    part(e, GEO.ball2, white, size * 0.95, size * 1.2, size * 0.5, 0, 0, 0).castShadow = false;
    part(e, GEO.ball2, dark, size * 0.62, size * 0.82, size * 0.4, sx * size * 0.05, -size * 0.05, size * 0.12).castShadow = false;
    part(e, GEO.ball2, shine, size * 0.22, size * 0.22, size * 0.2, sx * size * 0.12 + size * 0.1, size * 0.14, size * 0.22).castShadow = false;
    head.add(e);
    eyes.push(e);
  }
  return eyes;
}

function buildHero(id) {
  const root = new THREE.Group();
  const rig = new THREE.Group(); root.add(rig);
  const pal = {
    knight: { body: 0x3f6fc4, legs: 0x4d5d75, arm: 0x8fa4c4, shoe: 0x4a3426 },
    archer: { body: 0x3f9e55, legs: 0x6b4a2b, arm: 0x4fb565, shoe: 0x5a3b22 },
    mage: { body: 0x7b4fd0, legs: 0x5c3aa0, arm: 0x8d62e0, shoe: 0x3b2a63 },
    ninja: { body: 0x2a3150, legs: 0x1f2438, arm: 0x343c60, shoe: 0x1a1d2b },
    dwarf: { body: 0xb5652a, legs: 0x5a3b22, arm: 0xc9773a, shoe: 0x3d2716 },
  }[id];
  const M = (color, o = {}) => mat(Object.assign({ color, rim: true }, o));
  const skin = M(SKIN, { rough: 0.6 }), bodyM = M(pal.body), legM = M(pal.legs), armM = M(pal.arm), shoeM = M(pal.shoe, { rough: 0.9 });
  const short = id === 'dwarf';
  const hipY = short ? 0.42 : 0.5;

  const legL = new THREE.Group(), legR = new THREE.Group();
  legL.position.set(-0.15, hipY, 0); legR.position.set(0.15, hipY, 0);
  for (const L of [legL, legR]) {
    part(L, GEO.capsule, legM, 0.24, short ? 0.16 : 0.22, 0.24, 0, -hipY * 0.5, 0);
    box(L, shoeM, 0.25, 0.15, 0.36, 0, -hipY + 0.07, 0.05);
  }
  rig.add(legL, legR);

  const bodyY = hipY + 0.32;
  const body = part(rig, GEO.capsule, bodyM, short ? 0.78 : 0.6, short ? 0.36 : 0.42, short ? 0.62 : 0.5, 0, bodyY, 0);
  const headY = bodyY + (short ? 0.62 : 0.7);
  const head = new THREE.Group(); head.position.set(0, headY, 0); rig.add(head);
  head.userData.baseY = headY;
  part(head, GEO.ball3, skin, 0.86, 0.82, 0.8, 0, 0, 0);
  const eyes = addEyes(head, 0.02, 0.33, 0.15, 0.17, id === 'mage' ? 0x2a5fd6 : null);
  const blush = new THREE.MeshBasicMaterial({ color: 0xff9aa8, transparent: true, opacity: 0.55, depthWrite: false });
  part(head, GEO.ball2, blush, 0.12, 0.07, 0.04, -0.25, -0.1, 0.32).castShadow = false;
  part(head, GEO.ball2, blush, 0.12, 0.07, 0.04, 0.25, -0.1, 0.32).castShadow = false;

  const shoulderY = bodyY + 0.24, sx = short ? 0.42 : 0.34;
  const armL = new THREE.Group(), armR = new THREE.Group();
  armL.position.set(-sx, shoulderY, 0); armR.position.set(sx, shoulderY, 0);
  for (const A of [armL, armR]) {
    part(A, GEO.capsule, armM, 0.19, 0.2, 0.19, 0, -0.2, 0);
    part(A, GEO.ball2, skin, 0.24, 0.24, 0.24, 0, -0.42, 0.02);
  }
  rig.add(armL, armR);
  let tool = null;

  if (id === 'knight') {
    const steel = M(0xcfd6e2, { metal: 0.45, rough: 0.35 }), red = M(0xe63946), gold = M(0xf4c542, { metal: 0.5, rough: 0.35 });
    part(head, GEO.ball3, steel, 0.94, 0.62, 0.9, 0, 0.16, -0.02);
    box(head, steel, 0.96, 0.12, 0.9, 0, 0.12, 0.02);
    part(head, GEO.ball2, red, 0.16, 0.5, 0.42, 0, 0.55, -0.08, -0.3, 0, 0);
    box(rig, gold, 0.62, 0.08, 0.52, 0, bodyY - 0.1, 0);
    part(rig, GEO.ball2, steel, 0.34, 0.24, 0.34, -sx, shoulderY + 0.04, 0);
    part(rig, GEO.ball2, steel, 0.34, 0.24, 0.34, sx, shoulderY + 0.04, 0);
    const shield = new THREE.Group(); shield.position.set(-0.12, -0.38, 0.12); armL.add(shield);
    box(shield, M(0x2f5fa8), 0.1, 0.62, 0.52, 0, 0, 0);
    box(shield, gold, 0.12, 0.5, 0.08, 0, 0, 0);
    box(shield, gold, 0.12, 0.08, 0.4, 0, 0.06, 0);
    tool = new THREE.Group(); tool.position.set(0, -0.44, 0.1); armR.add(tool);
    box(tool, M(0xe8eef6, { metal: 0.6, rough: 0.25 }), 0.07, 0.12, 0.95, 0, 0, 0.6);
    box(tool, gold, 0.36, 0.07, 0.09, 0, 0, 0.1);
    part(tool, GEO.ball2, M(0xe63946, { rough: 0.2 }), 0.1, 0.1, 0.1, 0, 0, -0.06);
  } else if (id === 'archer') {
    const hood = M(0x2e7d40), leather = M(0x8b5a2b), gold = M(0xd9a04a);
    part(head, GEO.ball3, hood, 0.96, 0.9, 0.9, 0, 0.06, -0.06);
    part(head, GEO.cone12, hood, 0.34, 0.55, 0.34, 0, 0.18, -0.48, -1.1, 0, 0);
    box(head, gold, 0.9, 0.08, 0.1, 0, 0.3, 0.3, -0.3, 0, 0);
    part(head, GEO.ball2, M(0xc8823a), 0.3, 0.55, 0.3, 0.32, -0.25, -0.15);
    box(rig, leather, 0.62, 0.1, 0.52, 0, bodyY - 0.08, 0);
    const quiver = new THREE.Group(); quiver.position.set(0.14, bodyY + 0.12, -0.32); quiver.rotation.z = 0.35; rig.add(quiver);
    part(quiver, GEO.cyl12, leather, 0.24, 0.62, 0.24, 0, 0, 0);
    for (let i = 0; i < 3; i++) part(quiver, GEO.cone12, M(0xffffff), 0.08, 0.16, 0.04, (i - 1) * 0.06, 0.4, 0);
    tool = new THREE.Group(); tool.position.set(0, -0.42, 0.08); armL.add(tool);
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.04, 6, 16, Math.PI), leather);
    bow.rotation.set(0, Math.PI / 2, Math.PI / 2); bow.castShadow = GFX.shadows; tool.add(bow);
    box(tool, M(0xf1e9d2), 0.02, 1.08, 0.02, 0, 0, 0);
  } else if (id === 'mage') {
    const hat = M(0x4b2a8f), star = M(0xffd166, { emissive: 0x6a4a00 }), beard = M(0xf4f1ea, { rough: 0.9 });
    // eigener Hut in einer Gruppe, damit ein freigeschalteter Hut ihn ersetzen kann
    const gear = new THREE.Group(); head.add(gear);
    part(gear, GEO.cyl12, hat, 1.18, 0.07, 1.18, 0, 0.27, 0);
    part(gear, GEO.cone12, hat, 0.7, 0.75, 0.7, 0, 0.66, -0.04, -0.12, 0, 0);
    part(gear, GEO.cone12, hat, 0.34, 0.45, 0.34, 0.1, 1.12, -0.18, -0.6, 0, -0.3);
    part(gear, GEO.oct, star, 0.16, 0.16, 0.06, 0.18, 0.5, 0.3, 0, 0, 0.6);
    root.userData.gear = gear;
    part(head, GEO.cone12, beard, 0.5, 0.62, 0.32, 0, -0.42, 0.26, Math.PI, 0, 0);
    part(rig, GEO.cone12, bodyM, 0.95, 0.6, 0.8, 0, hipY - 0.12, 0);
    box(rig, M(0xffd166), 0.62, 0.08, 0.52, 0, bodyY - 0.06, 0);
    tool = new THREE.Group(); tool.position.set(0, -0.42, 0.06); armR.add(tool);
    part(tool, GEO.cyl12, M(0x8b5a2b), 0.08, 1.7, 0.08, 0, 0.2, 0);
    part(tool, GEO.oct, M(0x7ff3ff, { emissive: 0x2ec8f0, emissiveIntensity: 1.6, rough: 0.1 }), 0.28, 0.4, 0.28, 0, 1.15, 0);
  } else if (id === 'ninja') {
    const mask = M(0x1c2236), red = M(0xe63946);
    part(head, GEO.ball3, mask, 0.9, 0.86, 0.84, 0, 0.02, -0.01);
    // Gesicht frei lassen: hautfarbener Streifen über den Augen
    part(head, GEO.ball3, skin, 0.84, 0.3, 0.83, 0, 0.03, 0.02);
    for (const e of eyes) e.position.z += 0.02;
    box(head, red, 0.92, 0.1, 0.86, 0, 0.24, 0);
    const tails = new THREE.Group(); tails.position.set(0, 0.24, -0.42); head.add(tails);
    box(tails, red, 0.07, 0.06, 0.5, 0.08, 0, -0.22, 0.25, 0.3, 0);
    box(tails, red, 0.07, 0.06, 0.45, -0.06, -0.04, -0.2, 0.4, -0.25, 0);
    box(rig, red, 0.64, 0.1, 0.52, 0, bodyY - 0.1, 0);
    const katana = new THREE.Group(); katana.position.set(0, bodyY + 0.15, -0.3); katana.rotation.z = 0.75; rig.add(katana);
    box(katana, M(0xdfe6ee, { metal: 0.6, rough: 0.25 }), 0.06, 1.05, 0.05, 0, 0.2, 0);
    box(katana, M(0x2b2b33), 0.08, 0.3, 0.07, 0, -0.42, 0);
    tool = katana;
    root.userData.tails = tails;
  } else if (id === 'dwarf') {
    const beard = M(0xe8762d, { rough: 0.95 }), helm = M(0xb3b9c4, { metal: 0.45, rough: 0.35 }), horn = M(0xf3ead2);
    part(head, GEO.ball2, beard, 0.75, 0.6, 0.4, 0, -0.3, 0.26);
    part(head, GEO.ball2, beard, 0.45, 0.4, 0.3, 0, -0.52, 0.3);
    part(head, GEO.ball2, beard, 0.3, 0.14, 0.12, -0.1, -0.1, 0.4, 0, 0, 0.3);
    part(head, GEO.ball2, beard, 0.3, 0.14, 0.12, 0.1, -0.1, 0.4, 0, 0, -0.3);
    part(head, GEO.ball3, helm, 0.92, 0.6, 0.9, 0, 0.16, -0.02);
    box(head, M(0xa47a3a), 0.94, 0.1, 0.9, 0, 0.12, 0);
    part(head, GEO.cone12, horn, 0.16, 0.48, 0.16, -0.48, 0.38, 0, 0, 0, 0.95);
    part(head, GEO.cone12, horn, 0.16, 0.48, 0.16, 0.48, 0.38, 0, 0, 0, -0.95);
    box(rig, M(0x5a3b22), 0.84, 0.13, 0.66, 0, bodyY - 0.14, 0);
    box(rig, M(0xffcf4a, { metal: 0.5, rough: 0.3 }), 0.2, 0.16, 0.08, 0, bodyY - 0.14, 0.34);
    part(rig, GEO.ball2, M(0x26262e, { rough: 0.4 }), 0.26, 0.26, 0.26, 0.4, bodyY - 0.22, 0.2);
    tool = new THREE.Group(); tool.position.set(0, -0.42, 0.06); armR.add(tool);
    part(tool, GEO.cyl12, M(0x8b5a2b), 0.08, 0.95, 0.08, 0, 0, 0.3, Math.PI / 2, 0, 0);
    box(tool, helm, 0.5, 0.18, 0.2, 0, 0, 0.72);
  }
  const mats = new Set();
  root.traverse((o) => { if (o.material && o.material.emissive) mats.add(o.material); });
  root.userData = Object.assign(root.userData || {}, { rig, legL, legR, armL, armR, head, body, eyes, tool, mats: [...mats], hipY });
  addOutline(root, 0.035);
  return root;
}

// ---------- Hüte (über Erfolge freigeschaltet) ----------
// Höhe der Hutkrempe über der Kopfmitte, passend zur Kopfbedeckung des Helden
const HAT_Y = { knight: 0.47, archer: 0.5, mage: 0.36, ninja: 0.45, dwarf: 0.46 };
function buildHat(id) {
  const g = new THREE.Group();
  const M = (color, o = {}) => mat(Object.assign({ color, rim: true }, o));
  const gold = M(0xffcf4a, { metal: 0.55, rough: 0.3, emissive: 0x3a2400 });
  if (id === 'crown') {
    part(g, GEO.cyl12, gold, 0.66, 0.2, 0.66, 0, 0.08, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      part(g, GEO.cone12, gold, 0.15, 0.26, 0.15, Math.sin(a) * 0.27, 0.3, Math.cos(a) * 0.27);
      part(g, GEO.ball1, M(i % 2 ? 0xff3b6b : 0x46c2ff, { rough: 0.1, emissive: i % 2 ? 0x500018 : 0x002850 }), 0.09, 0.09, 0.09, Math.sin(a + 0.63) * 0.33, 0.09, Math.cos(a + 0.63) * 0.33);
    }
  } else if (id === 'slime') {
    part(g, GEO.ball2, M(0x5fd34c, { rough: 0.3 }), 0.66, 0.5, 0.62, 0, 0.16, 0);
    part(g, GEO.ball1, M(0xb6ff9a, { rough: 0.2 }), 0.18, 0.1, 0.14, 0.12, 0.34, 0.1);
    for (const sx of [-1, 1]) {
      part(g, GEO.ball1, M(0xffffff, { rough: 0.3 }), 0.13, 0.15, 0.06, sx * 0.1, 0.2, 0.29);
      part(g, GEO.ball1, M(0x15151f, { rough: 0.2 }), 0.07, 0.09, 0.05, sx * 0.1, 0.19, 0.31);
    }
  } else if (id === 'tophat') {
    const black = M(0x22202a, { rough: 0.5 });
    part(g, GEO.cyl12, black, 0.95, 0.05, 0.95, 0, 0.02, 0);
    part(g, GEO.cyl12, black, 0.58, 0.62, 0.58, 0, 0.34, 0);
    part(g, GEO.cyl12, M(0xd9363e), 0.6, 0.12, 0.6, 0, 0.1, 0);
  } else if (id === 'witch') {
    const dark = M(0x1e1530, { rough: 0.6 });
    part(g, GEO.cyl12, dark, 1.0, 0.05, 1.0, 0, 0.02, 0);
    part(g, GEO.cone12, dark, 0.58, 0.8, 0.58, 0, 0.42, -0.03, -0.18, 0, 0);
    part(g, GEO.cone12, dark, 0.22, 0.36, 0.22, 0, 0.9, -0.16, -0.8, 0, 0);
    part(g, GEO.cyl12, M(0xb04ad9), 0.56, 0.1, 0.56, 0, 0.08, 0);
    box(g, gold, 0.14, 0.12, 0.04, 0, 0.08, 0.28);
  } else if (id === 'party') {
    part(g, GEO.cone12, M(0xff5fa2), 0.5, 0.75, 0.5, 0, 0.36, 0);
    part(g, GEO.cyl12, M(0x46c2ff), 0.42, 0.07, 0.42, 0, 0.14, 0);
    part(g, GEO.cyl12, M(0xffd84a), 0.24, 0.07, 0.24, 0, 0.42, 0);
    part(g, GEO.ball1, M(0xfff6c8), 0.18, 0.18, 0.18, 0, 0.76, 0);
  } else if (id === 'propeller') {
    part(g, GEO.ball2, M(0xd9363e), 0.7, 0.42, 0.7, 0, 0.02, 0);
    part(g, GEO.ball2, M(0xffd84a), 0.36, 0.2, 0.72, 0, 0.11, 0);
    part(g, GEO.ball2, M(0x46c2ff), 0.72, 0.2, 0.36, 0, 0.11, 0);
    part(g, GEO.cyl12, M(0x2b2b38), 0.05, 0.16, 0.05, 0, 0.26, 0);
    const spin = new THREE.Group(); spin.position.y = 0.34; g.add(spin);
    box(spin, M(0xffd84a), 0.7, 0.03, 0.12, 0, 0, 0, 0.25, 0, 0);
    box(spin, M(0x46c2ff), 0.12, 0.03, 0.7, 0, 0, 0, 0, 0, 0.25);
    part(spin, GEO.ball1, M(0xd9363e), 0.08, 0.08, 0.08, 0, 0.02, 0);
    g.userData.spin = spin;
  } else if (id === 'flowers') {
    part(g, GEO.torus, M(0x3f9e55), 0.68, 0.68, 0.68, 0, 0.04, 0, Math.PI / 2, 0, 0);
    const cols = [0xff7aa8, 0xffd84a, 0xffffff, 0xb08aff, 0xff9a4a, 0x7fd8ff];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      part(g, GEO.ball1, M(cols[i], { rough: 0.5 }), 0.17, 0.1, 0.17, Math.sin(a) * 0.34, 0.08, Math.cos(a) * 0.34);
      part(g, GEO.ball1, M(0xffe066), 0.06, 0.05, 0.06, Math.sin(a) * 0.34, 0.12, Math.cos(a) * 0.34);
    }
  } else if (id === 'mushroom') {
    part(g, GEO.cyl12, M(0xf7dfb8), 0.6, 0.06, 0.6, 0, 0.02, 0);
    part(g, GEO.ball2, M(0xe8423a, { rough: 0.5 }), 0.9, 0.5, 0.9, 0, 0.1, 0);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.3;
      part(g, GEO.ball1, M(0xfff4e0), 0.14, 0.07, 0.14, Math.sin(a) * 0.24, 0.27, Math.cos(a) * 0.24);
    }
    part(g, GEO.ball1, M(0xfff4e0), 0.14, 0.07, 0.14, 0, 0.35, 0);
  } else if (id === 'halo') {
    const glow = new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffd84a, emissiveIntensity: 1.6 });
    part(g, GEO.torus, glow, 0.6, 0.6, 0.45, 0, 0.32, 0, Math.PI / 2, 0, 0).castShadow = false;
  } else if (id === 'devil') {
    const red = M(0xd9282f, { rough: 0.4 });
    for (const sx of [-1, 1]) {
      part(g, GEO.cone12, red, 0.13, 0.3, 0.13, sx * 0.22, 0.08, 0.06, 0, 0, -sx * 0.45);
      part(g, GEO.cone12, red, 0.08, 0.18, 0.08, sx * 0.3, 0.26, 0.06, 0, 0, -sx * 0.9);
    }
  }
  return g;
}
// Setzt (oder entfernt) den Hut eines Heldenmodells
function attachHat(model, charId, hatId) {
  const u = model.userData;
  if (u.hat) { u.head.remove(u.hat); u.hat = null; }
  const on = !!hatId && hatId !== 'none' && !!HATS[hatId];
  if (u.gear) u.gear.visible = !on;
  if (!on) return;
  const h = buildHat(hatId);
  h.position.y = HAT_Y[charId] || 0.45;
  u.head.add(h);
  u.hat = h;
  addOutline(h, 0.035);
}

// ---------- Gegner (zusammengesetzte Geometrien für InstancedMesh) ----------
// Glied (Kapsel) von Punkt a nach Punkt b, z. B. Spinnenbeine
function limb(a, b, r, color) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], len = Math.hypot(...d);
  return { geo: GEO.cyl, color, pos: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], scale: [r, len, r], dir: d };
}
function enemyGeometry(type) {
  const W_ = 0xffffff, P = 0x15151f;
  // Gegner sind oft zu Hunderten im Bild: gröbere Kapseln reichen völlig
  const mp = (parts) => mergeParts(parts.map((q) => (q.geo === GEO.capsule ? Object.assign({}, q, { geo: GEO.capsuleLo }) : q)));
  const eyesAt = (y, z, sp, s) => [
    { geo: GEO.ball1, color: W_, pos: [-sp, y, z], scale: [s, s * 1.2, s * 0.5] },
    { geo: GEO.ball1, color: W_, pos: [sp, y, z], scale: [s, s * 1.2, s * 0.5] },
    { geo: GEO.ball1, color: P, pos: [-sp, y - s * 0.08, z + s * 0.14], scale: [s * 0.55, s * 0.7, s * 0.4] },
    { geo: GEO.ball1, color: P, pos: [sp, y - s * 0.08, z + s * 0.14], scale: [s * 0.55, s * 0.7, s * 0.4] },
  ];
  switch (type) {
    case 'slime': return mp([
      { geo: GEO.ball1, color: 0x5fd34c, pos: [0, 0.48, 0], scale: [1.3, 1.0, 1.3] },
      { geo: GEO.ball1, color: 0x4bbb3b, pos: [0, 0.18, 0], scale: [1.38, 0.38, 1.38] },
      { geo: GEO.ball1, color: 0xb6ff9a, pos: [0.22, 0.78, 0.18], scale: [0.36, 0.2, 0.3] },
      ...eyesAt(0.6, 0.56, 0.2, 0.22),
      { geo: GEO.ball1, color: 0x2a6b22, pos: [0, 0.36, 0.62], scale: [0.18, 0.06, 0.04] },
    ]);
    case 'skeleton': return mp([
      { geo: GEO.capsule, color: 0xe9e4d4, pos: [-0.15, 0.36, 0], scale: [0.16, 0.38, 0.16] },
      { geo: GEO.capsule, color: 0xe9e4d4, pos: [0.15, 0.36, 0], scale: [0.16, 0.38, 0.16] },
      { geo: GEO.capsule, color: 0xd8d2bf, pos: [0, 1.0, 0], scale: [0.5, 0.36, 0.34] },
      { geo: GEO.box, color: 0x8a8370, pos: [0, 1.04, 0.16], scale: [0.4, 0.05, 0.04] },
      { geo: GEO.box, color: 0x8a8370, pos: [0, 0.92, 0.16], scale: [0.36, 0.05, 0.04] },
      { geo: GEO.ball2, color: 0xf4f0e2, pos: [0, 1.58, 0.02], scale: [0.56, 0.52, 0.52] },
      { geo: GEO.rbox, color: 0xe9e4d4, pos: [0, 1.36, 0.08], scale: [0.36, 0.14, 0.32] },
      { geo: GEO.ball1, color: 0x1a1a22, pos: [-0.12, 1.6, 0.22], scale: [0.15, 0.17, 0.08] },
      { geo: GEO.ball1, color: 0x1a1a22, pos: [0.12, 1.6, 0.22], scale: [0.15, 0.17, 0.08] },
      { geo: GEO.ball1, color: 0xff5a3a, pos: [-0.12, 1.6, 0.25], scale: [0.05, 0.05, 0.03] },
      { geo: GEO.ball1, color: 0xff5a3a, pos: [0.12, 1.6, 0.25], scale: [0.05, 0.05, 0.03] },
      { geo: GEO.capsule, color: 0xe9e4d4, pos: [-0.34, 1.15, 0.26], scale: [0.12, 0.3, 0.12], rot: [Math.PI / 2, 0, 0] },
      { geo: GEO.capsule, color: 0xe9e4d4, pos: [0.34, 1.15, 0.26], scale: [0.12, 0.3, 0.12], rot: [Math.PI / 2, 0, 0] },
    ]);
    case 'bat': return mp([
      { geo: GEO.ball1, color: 0x5b3a7a, pos: [0, 0.35, 0], scale: [0.62, 0.56, 0.6] },
      { geo: GEO.ball1, color: 0x7a55a0, pos: [0, 0.25, 0.12], scale: [0.4, 0.3, 0.4] },
      { geo: GEO.cone12, color: 0x3f2757, pos: [-0.6, 0.42, 0], scale: [0.5, 0.85, 0.06], rot: [0, 0, 1.25] },
      { geo: GEO.cone12, color: 0x3f2757, pos: [0.6, 0.42, 0], scale: [0.5, 0.85, 0.06], rot: [0, 0, -1.25] },
      { geo: GEO.cone12, color: 0x5b3a7a, pos: [-0.16, 0.7, 0], scale: [0.14, 0.26, 0.1] },
      { geo: GEO.cone12, color: 0x5b3a7a, pos: [0.16, 0.7, 0], scale: [0.14, 0.26, 0.1] },
      { geo: GEO.ball1, color: 0xff3b3b, pos: [-0.11, 0.42, 0.27], scale: [0.12, 0.1, 0.05] },
      { geo: GEO.ball1, color: 0xff3b3b, pos: [0.11, 0.42, 0.27], scale: [0.12, 0.1, 0.05] },
      { geo: GEO.cone, color: 0xffffff, pos: [-0.05, 0.26, 0.28], scale: [0.04, 0.08, 0.04], rot: [Math.PI, 0, 0] },
      { geo: GEO.cone, color: 0xffffff, pos: [0.05, 0.26, 0.28], scale: [0.04, 0.08, 0.04], rot: [Math.PI, 0, 0] },
    ]);
    case 'spitter': return mp([
      { geo: GEO.capsule, color: 0x3c8f3a, pos: [0, 0.5, 0], scale: [0.3, 0.6, 0.3] },
      { geo: GEO.ball1, color: 0x4fae42, pos: [-0.38, 0.22, 0], scale: [0.6, 0.12, 0.3], rot: [0, 0, 0.35] },
      { geo: GEO.ball1, color: 0x4fae42, pos: [0.38, 0.22, 0], scale: [0.6, 0.12, 0.3], rot: [0, 0, -0.35] },
      { geo: GEO.ball1, color: 0x4fae42, pos: [0, 0.2, -0.36], scale: [0.3, 0.12, 0.55], rot: [0.35, 0, 0] },
      { geo: GEO.ball2, color: 0xe85d9c, pos: [0, 1.15, 0], scale: [0.85, 0.8, 0.85] },
      { geo: GEO.ball1, color: 0xffb3d6, pos: [-0.2, 1.38, 0.2], scale: [0.14, 0.1, 0.1] },
      { geo: GEO.ball1, color: 0xffb3d6, pos: [0.25, 1.3, -0.1], scale: [0.16, 0.1, 0.12] },
      { geo: GEO.torus, color: 0xb02a66, pos: [0, 1.1, 0.36], scale: [0.36, 0.36, 0.5] },
      { geo: GEO.ball1, color: 0x3a0a20, pos: [0, 1.1, 0.34], scale: [0.26, 0.26, 0.12] },
      ...eyesAt(1.42, 0.3, 0.17, 0.16),
    ]);
    case 'golem': return mp([
      { geo: GEO.dodeca, color: 0x7c7f86, pos: [-0.38, 0.45, 0], scale: [0.6, 0.95, 0.65], flat: true },
      { geo: GEO.dodeca, color: 0x7c7f86, pos: [0.38, 0.45, 0], scale: [0.6, 0.95, 0.65], flat: true },
      { geo: GEO.dodeca, color: 0x8e9199, pos: [0, 1.5, 0], scale: [1.75, 1.45, 1.25], flat: true },
      { geo: GEO.ball1, color: 0x5e9c46, pos: [0, 2.12, -0.05], scale: [1.4, 0.3, 1.0] },
      { geo: GEO.dodeca, color: 0x9a9da5, pos: [0, 2.25, 0.2], scale: [0.85, 0.7, 0.75], flat: true },
      { geo: GEO.ball1, color: 0xffb13a, pos: [-0.17, 2.28, 0.52], scale: [0.16, 0.1, 0.06] },
      { geo: GEO.ball1, color: 0xffb13a, pos: [0.17, 2.28, 0.52], scale: [0.16, 0.1, 0.06] },
      { geo: GEO.box, color: 0xff9a2a, pos: [0, 1.55, 0.62], scale: [0.08, 0.5, 0.04], rot: [0, 0, 0.4] },
      { geo: GEO.dodeca, color: 0x6c6f76, pos: [-1.0, 1.25, 0.1], scale: [0.55, 1.35, 0.6], flat: true },
      { geo: GEO.dodeca, color: 0x6c6f76, pos: [1.0, 1.25, 0.1], scale: [0.55, 1.35, 0.6], flat: true },
    ]);
    case 'ghost': return mp([
      { geo: GEO.cone12, color: 0xdff3ff, pos: [0, 0.62, 0], scale: [1.0, 1.25, 1.0], rot: [Math.PI, 0, 0] },
      { geo: GEO.ball2, color: 0xeef9ff, pos: [0, 1.25, 0], scale: [1.0, 0.92, 1.0] },
      { geo: GEO.ball1, color: 0x223344, pos: [-0.18, 1.32, 0.42], scale: [0.18, 0.24, 0.08] },
      { geo: GEO.ball1, color: 0x223344, pos: [0.18, 1.32, 0.42], scale: [0.18, 0.24, 0.08] },
      { geo: GEO.ball1, color: 0x223344, pos: [0, 1.05, 0.46], scale: [0.2, 0.14, 0.06] },
      { geo: GEO.capsule, color: 0xdff3ff, pos: [-0.5, 1.05, 0.15], scale: [0.14, 0.3, 0.14], rot: [0.8, 0, 0.4] },
      { geo: GEO.capsule, color: 0xdff3ff, pos: [0.5, 1.05, 0.15], scale: [0.14, 0.3, 0.14], rot: [0.8, 0, -0.4] },
    ]);
    case 'darkKnight': return mp([
      { geo: GEO.capsule, color: 0x2a2633, pos: [-0.2, 0.42, 0], scale: [0.28, 0.5, 0.3] },
      { geo: GEO.capsule, color: 0x2a2633, pos: [0.2, 0.42, 0], scale: [0.28, 0.5, 0.3] },
      { geo: GEO.capsule, color: 0x3a3447, pos: [0, 1.3, 0], scale: [0.9, 0.55, 0.55] },
      { geo: GEO.ball1, color: 0x4a4258, pos: [-0.55, 1.62, 0], scale: [0.45, 0.32, 0.5] },
      { geo: GEO.ball1, color: 0x4a4258, pos: [0.55, 1.62, 0], scale: [0.45, 0.32, 0.5] },
      { geo: GEO.cone12, color: 0x9c93ad, pos: [-0.62, 1.82, 0], scale: [0.1, 0.25, 0.1] },
      { geo: GEO.cone12, color: 0x9c93ad, pos: [0.62, 1.82, 0], scale: [0.1, 0.25, 0.1] },
      { geo: GEO.ball2, color: 0x2f2a3b, pos: [0, 2.02, 0], scale: [0.6, 0.6, 0.58] },
      { geo: GEO.rbox, color: 0xff2d2d, pos: [0, 2.04, 0.27], scale: [0.36, 0.07, 0.05] },
      { geo: GEO.cone12, color: 0xc9c2d6, pos: [-0.28, 2.4, 0], scale: [0.12, 0.42, 0.12], rot: [0, 0, 0.5] },
      { geo: GEO.cone12, color: 0xc9c2d6, pos: [0.28, 2.4, 0], scale: [0.12, 0.42, 0.12], rot: [0, 0, -0.5] },
      { geo: GEO.rbox, color: 0x9aa3b5, pos: [0.66, 1.2, 0.55], scale: [0.1, 0.1, 1.5] },
      { geo: GEO.rbox, color: 0x4a4258, pos: [0.66, 1.2, -0.1], scale: [0.36, 0.08, 0.1] },
    ]);
    case 'wisp': return mp([
      { geo: GEO.ball1, color: 0xd8feff, pos: [0, 0.32, 0], scale: [0.56, 0.56, 0.56] },
      { geo: GEO.ball1, color: 0x8ff3ff, pos: [0, 0.34, -0.22], scale: [0.42, 0.42, 0.5] },
      { geo: GEO.cone12, color: 0x5fdcff, pos: [0, 0.38, -0.55], scale: [0.36, 0.6, 0.36], rot: [-Math.PI / 2, 0, 0] },
      { geo: GEO.cone12, color: 0x9ff7ff, pos: [0, 0.6, -0.3], scale: [0.2, 0.4, 0.2], rot: [-0.9, 0, 0] },
      { geo: GEO.ball1, color: 0x153848, pos: [-0.1, 0.36, 0.25], scale: [0.09, 0.14, 0.05] },
      { geo: GEO.ball1, color: 0x153848, pos: [0.1, 0.36, 0.25], scale: [0.09, 0.14, 0.05] },
    ]);
    case 'bomber': return mp([
      { geo: GEO.capsule, color: 0xf3e6c8, pos: [0, 0.42, 0], scale: [0.5, 0.42, 0.5] },
      { geo: GEO.cyl12, color: 0xf7dfb8, pos: [0, 0.8, 0], scale: [1.02, 0.08, 1.02] },
      { geo: GEO.ball2, color: 0xe8423a, pos: [0, 0.92, 0], scale: [1.14, 0.72, 1.14] },
      { geo: GEO.ball1, color: 0xfff4e0, pos: [0.3, 1.1, 0.3], scale: [0.2, 0.1, 0.2] },
      { geo: GEO.ball1, color: 0xfff4e0, pos: [-0.36, 1.04, 0.1], scale: [0.17, 0.09, 0.17] },
      { geo: GEO.ball1, color: 0xfff4e0, pos: [0.05, 1.24, -0.28], scale: [0.22, 0.1, 0.22] },
      { geo: GEO.ball1, color: 0xfff4e0, pos: [-0.18, 1.02, -0.4], scale: [0.15, 0.08, 0.15] },
      { geo: GEO.ball1, color: 0xfff4e0, pos: [0.38, 1.0, -0.22], scale: [0.14, 0.08, 0.14] },
      { geo: GEO.cyl12, color: 0x4a3426, pos: [0, 1.38, 0], scale: [0.06, 0.24, 0.06], rot: [0.3, 0, 0] },
      ...eyesAt(0.52, 0.24, 0.11, 0.14),
      { geo: GEO.ball1, color: 0x6a2a1a, pos: [0, 0.32, 0.25], scale: [0.14, 0.07, 0.04] },
    ]);
    case 'bigSlime': return mp([
      { geo: GEO.ball2, color: 0x4a9cf0, pos: [0, 0.9, 0], scale: [2.2, 1.75, 2.2] },
      { geo: GEO.ball1, color: 0x3a82d6, pos: [0, 0.32, 0], scale: [2.32, 0.64, 2.32] },
      { geo: GEO.ball1, color: 0xc4e6ff, pos: [0.45, 1.45, 0.4], scale: [0.62, 0.32, 0.5] },
      { geo: GEO.ball1, color: 0x7cc0ff, pos: [-0.7, 1.2, -0.3], scale: [0.36, 0.3, 0.36] },
      { geo: GEO.ball1, color: 0x7cc0ff, pos: [0.6, 0.7, -0.62], scale: [0.3, 0.26, 0.3] },
      ...eyesAt(1.08, 0.95, 0.36, 0.36),
      { geo: GEO.ball1, color: 0x163a72, pos: [0, 0.66, 1.04], scale: [0.4, 0.13, 0.06] },
    ]);
    case 'boar': return mp([
      { geo: GEO.ball2, color: 0x7a4e30, pos: [0, 0.78, -0.12], scale: [1.12, 0.98, 1.6] },
      { geo: GEO.ball1, color: 0x4a2e1c, pos: [0, 1.2, -0.22], scale: [0.26, 0.38, 1.25] },
      { geo: GEO.ball2, color: 0x8a5a38, pos: [0, 0.8, 0.66], scale: [0.8, 0.72, 0.72] },
      { geo: GEO.cyl12, color: 0xd99a86, pos: [0, 0.68, 1.06], scale: [0.38, 0.16, 0.3], rot: [Math.PI / 2, 0, 0] },
      { geo: GEO.ball1, color: 0x5a2a20, pos: [-0.08, 0.68, 1.14], scale: [0.07, 0.09, 0.03] },
      { geo: GEO.ball1, color: 0x5a2a20, pos: [0.08, 0.68, 1.14], scale: [0.07, 0.09, 0.03] },
      { geo: GEO.cone12, color: 0xfff6e0, pos: [-0.24, 0.66, 1.0], scale: [0.09, 0.32, 0.09], rot: [0.45, 0, 0.45] },
      { geo: GEO.cone12, color: 0xfff6e0, pos: [0.24, 0.66, 1.0], scale: [0.09, 0.32, 0.09], rot: [0.45, 0, -0.45] },
      { geo: GEO.cone12, color: 0x5a3820, pos: [-0.32, 1.14, 0.56], scale: [0.2, 0.3, 0.1], rot: [0, 0, 0.45] },
      { geo: GEO.cone12, color: 0x5a3820, pos: [0.32, 1.14, 0.56], scale: [0.2, 0.3, 0.1], rot: [0, 0, -0.45] },
      { geo: GEO.ball1, color: 0x1a1a22, pos: [-0.2, 0.92, 0.98], scale: [0.1, 0.11, 0.05] },
      { geo: GEO.ball1, color: 0x1a1a22, pos: [0.2, 0.92, 0.98], scale: [0.1, 0.11, 0.05] },
      { geo: GEO.box, color: 0x2e1c12, pos: [-0.2, 1.03, 0.96], scale: [0.22, 0.05, 0.05], rot: [0, 0, -0.4] },
      { geo: GEO.box, color: 0x2e1c12, pos: [0.2, 1.03, 0.96], scale: [0.22, 0.05, 0.05], rot: [0, 0, 0.4] },
      { geo: GEO.capsule, color: 0x4a3020, pos: [-0.34, 0.24, 0.36], scale: [0.2, 0.2, 0.2] },
      { geo: GEO.capsule, color: 0x4a3020, pos: [0.34, 0.24, 0.36], scale: [0.2, 0.2, 0.2] },
      { geo: GEO.capsule, color: 0x4a3020, pos: [-0.34, 0.24, -0.62], scale: [0.2, 0.2, 0.2] },
      { geo: GEO.capsule, color: 0x4a3020, pos: [0.34, 0.24, -0.62], scale: [0.2, 0.2, 0.2] },
      { geo: GEO.cone12, color: 0x4a2e1c, pos: [0, 0.9, -0.95], scale: [0.08, 0.3, 0.08], rot: [-2.2, 0, 0] },
    ]);
    case 'frost': return mp([
      { geo: GEO.cone12, color: 0x4f97d8, pos: [0, 0.5, 0], scale: [0.88, 1.0, 0.88] },
      { geo: GEO.ball1, color: 0xe8fbff, pos: [0, 0.08, 0], scale: [0.92, 0.18, 0.92] },
      { geo: GEO.ball2, color: 0xcff2ff, pos: [0, 1.16, 0], scale: [0.74, 0.7, 0.72] },
      { geo: GEO.oct, color: 0x9fe6ff, pos: [0, 1.64, -0.02], scale: [0.24, 0.55, 0.24], flat: true },
      { geo: GEO.oct, color: 0x9fe6ff, pos: [-0.24, 1.52, 0], scale: [0.17, 0.38, 0.17], rot: [0, 0, 0.55], flat: true },
      { geo: GEO.oct, color: 0x9fe6ff, pos: [0.24, 1.52, 0], scale: [0.17, 0.38, 0.17], rot: [0, 0, -0.55], flat: true },
      { geo: GEO.cone12, color: 0xffffff, pos: [0, 0.86, 0.24], scale: [0.4, 0.42, 0.2], rot: [Math.PI, 0, 0] },
      ...eyesAt(1.2, 0.3, 0.13, 0.15),
      { geo: GEO.capsule, color: 0x4f97d8, pos: [0.38, 0.86, 0.16], scale: [0.14, 0.24, 0.14], rot: [0.9, 0, -0.35] },
      { geo: GEO.capsule, color: 0x4f97d8, pos: [-0.38, 0.86, 0.06], scale: [0.14, 0.24, 0.14], rot: [0.4, 0, 0.35] },
      { geo: GEO.oct, color: 0xf2fdff, pos: [0.44, 0.98, 0.46], scale: [0.22, 0.34, 0.22], flat: true },
    ]);
    case 'shaman': return mp([
      { geo: GEO.cone12, color: 0x7a5a3a, pos: [0, 0.48, 0], scale: [0.82, 0.96, 0.82] },
      { geo: GEO.ball1, color: 0xe9e4d4, pos: [0, 0.9, 0.24], scale: [0.3, 0.26, 0.12] },
      { geo: GEO.ball2, color: 0x7cc35a, pos: [0, 1.12, 0.02], scale: [0.72, 0.64, 0.68] },
      { geo: GEO.cone12, color: 0x6fb44f, pos: [-0.47, 1.16, 0], scale: [0.18, 0.52, 0.12], rot: [0, 0, 1.25] },
      { geo: GEO.cone12, color: 0x6fb44f, pos: [0.47, 1.16, 0], scale: [0.18, 0.52, 0.12], rot: [0, 0, -1.25] },
      { geo: GEO.ball1, color: 0x8fd46a, pos: [0, 1.04, 0.36], scale: [0.15, 0.2, 0.15] },
      ...eyesAt(1.2, 0.28, 0.14, 0.13),
      { geo: GEO.cyl12, color: 0x8b5a2b, pos: [0, 1.42, 0], scale: [0.62, 0.08, 0.6] },
      { geo: GEO.cone12, color: 0xe63946, pos: [0, 1.62, -0.12], scale: [0.11, 0.42, 0.06], rot: [-0.35, 0, 0] },
      { geo: GEO.cone12, color: 0xffd166, pos: [-0.16, 1.56, -0.1], scale: [0.1, 0.36, 0.06], rot: [-0.35, 0, 0.4] },
      { geo: GEO.cone12, color: 0x46c2ff, pos: [0.16, 1.56, -0.1], scale: [0.1, 0.36, 0.06], rot: [-0.35, 0, -0.4] },
      { geo: GEO.cyl12, color: 0x8b5a2b, pos: [0.46, 0.85, 0.22], scale: [0.07, 1.7, 0.07] },
      { geo: GEO.torus, color: 0x5a3b22, pos: [0.46, 1.74, 0.22], scale: [0.5, 0.5, 0.5] },
      { geo: GEO.ball1, color: 0x9dffa6, pos: [0.46, 1.74, 0.22], scale: [0.3, 0.3, 0.3] },
    ]);
    case 'shieldBearer': return mp([
      { geo: GEO.capsule, color: 0x4a4f5e, pos: [-0.24, 0.42, -0.05], scale: [0.3, 0.46, 0.3] },
      { geo: GEO.capsule, color: 0x4a4f5e, pos: [0.24, 0.42, -0.05], scale: [0.3, 0.46, 0.3] },
      { geo: GEO.capsule, color: 0x6a7388, pos: [0, 1.2, -0.1], scale: [0.95, 0.6, 0.66] },
      { geo: GEO.box, color: 0x8b5a2b, pos: [0, 0.95, -0.1], scale: [0.9, 0.14, 0.62] },
      { geo: GEO.ball2, color: 0x9aa3b5, pos: [0, 1.78, -0.08], scale: [0.62, 0.62, 0.6] },
      { geo: GEO.rbox, color: 0x22252e, pos: [0, 1.8, 0.2], scale: [0.36, 0.08, 0.08] },
      { geo: GEO.rbox, color: 0x22252e, pos: [0, 1.68, 0.21], scale: [0.08, 0.24, 0.08] },
      { geo: GEO.cone12, color: 0xe63946, pos: [0, 2.18, -0.14], scale: [0.12, 0.38, 0.32] },
      { geo: GEO.ball1, color: 0x9aa3b5, pos: [-0.56, 1.48, -0.05], scale: [0.42, 0.3, 0.46] },
      { geo: GEO.ball1, color: 0x9aa3b5, pos: [0.56, 1.48, -0.05], scale: [0.42, 0.3, 0.46] },
      { geo: GEO.rbox, color: 0xa8743a, pos: [0.08, 1.08, 0.62], scale: [1.2, 1.7, 0.16] },
      { geo: GEO.rbox, color: 0xc9d1d9, pos: [0.08, 1.8, 0.66], scale: [1.28, 0.13, 0.14] },
      { geo: GEO.rbox, color: 0xc9d1d9, pos: [0.08, 1.08, 0.66], scale: [1.28, 0.13, 0.14] },
      { geo: GEO.rbox, color: 0xc9d1d9, pos: [0.08, 0.36, 0.66], scale: [1.28, 0.13, 0.14] },
      { geo: GEO.ball1, color: 0xf4c542, pos: [0.08, 1.44, 0.72], scale: [0.32, 0.32, 0.12] },
      { geo: GEO.cyl12, color: 0x8b5a2b, pos: [-0.66, 1.3, 0.25], scale: [0.07, 2.4, 0.07] },
      { geo: GEO.cone12, color: 0xdfe6ee, pos: [-0.66, 2.66, 0.25], scale: [0.16, 0.44, 0.16] },
    ]);
    case 'spider': {
      const P = [];
      for (const sx of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const z = 0.32 - i * 0.2;
          const hip = [sx * 0.2, 0.42, z], knee = [sx * 0.62, 0.68, z * 1.35], foot = [sx * 0.98, 0.02, z * 1.75];
          P.push(limb(hip, knee, 0.08, 0x2a2233), limb(knee, foot, 0.07, 0x3a2f48));
        }
      }
      return mp([
        ...P,
        { geo: GEO.ball2, color: 0x3a2a48, pos: [0, 0.44, 0.18], scale: [0.52, 0.42, 0.52] },
        { geo: GEO.ball2, color: 0x2a1f36, pos: [0, 0.56, -0.42], scale: [0.85, 0.72, 0.95] },
        { geo: GEO.ball1, color: 0xd9363e, pos: [0, 0.9, -0.42], scale: [0.18, 0.08, 0.32] },
        { geo: GEO.ball1, color: 0x6a4a8a, pos: [0.2, 0.8, -0.2], scale: [0.12, 0.08, 0.12] },
        { geo: GEO.ball1, color: 0xff3b3b, pos: [-0.09, 0.55, 0.42], scale: [0.1, 0.1, 0.06] },
        { geo: GEO.ball1, color: 0xff3b3b, pos: [0.09, 0.55, 0.42], scale: [0.1, 0.1, 0.06] },
        { geo: GEO.ball1, color: 0xff6a5a, pos: [-0.18, 0.6, 0.38], scale: [0.06, 0.06, 0.04] },
        { geo: GEO.ball1, color: 0xff6a5a, pos: [0.18, 0.6, 0.38], scale: [0.06, 0.06, 0.04] },
        { geo: GEO.cone12, color: 0xf4f0e2, pos: [-0.08, 0.3, 0.4], scale: [0.06, 0.16, 0.06], rot: [Math.PI, 0, 0] },
        { geo: GEO.cone12, color: 0xf4f0e2, pos: [0.08, 0.3, 0.4], scale: [0.06, 0.16, 0.06], rot: [Math.PI, 0, 0] },
      ]);
    }
    case 'kobold': return mp([
      { geo: GEO.capsule, color: 0x5a3a90, pos: [-0.12, 0.17, 0], scale: [0.13, 0.15, 0.13] },
      { geo: GEO.capsule, color: 0x5a3a90, pos: [0.12, 0.17, 0], scale: [0.13, 0.15, 0.13] },
      { geo: GEO.capsule, color: 0x7a4fc0, pos: [0, 0.5, 0], scale: [0.36, 0.28, 0.3] },
      { geo: GEO.ball2, color: 0x9b6ae0, pos: [0, 0.96, 0.02], scale: [0.62, 0.56, 0.56] },
      { geo: GEO.cone12, color: 0x9b6ae0, pos: [-0.38, 1.02, 0], scale: [0.13, 0.42, 0.08], rot: [0, 0, 1.2] },
      { geo: GEO.cone12, color: 0x9b6ae0, pos: [0.38, 1.02, 0], scale: [0.13, 0.42, 0.08], rot: [0, 0, -1.2] },
      { geo: GEO.cone12, color: 0xffd166, pos: [-0.15, 1.24, -0.02], scale: [0.08, 0.24, 0.08], rot: [0, 0, 0.35] },
      { geo: GEO.cone12, color: 0xffd166, pos: [0.15, 1.24, -0.02], scale: [0.08, 0.24, 0.08], rot: [0, 0, -0.35] },
      { geo: GEO.ball1, color: 0xffe14a, pos: [-0.12, 1.0, 0.27], scale: [0.14, 0.1, 0.06] },
      { geo: GEO.ball1, color: 0xffe14a, pos: [0.12, 1.0, 0.27], scale: [0.14, 0.1, 0.06] },
      { geo: GEO.box, color: 0x1a1220, pos: [-0.12, 1.0, 0.3], scale: [0.03, 0.08, 0.02] },
      { geo: GEO.box, color: 0x1a1220, pos: [0.12, 1.0, 0.3], scale: [0.03, 0.08, 0.02] },
      { geo: GEO.box, color: 0xffffff, pos: [0, 0.82, 0.27], scale: [0.22, 0.04, 0.03] },
      { geo: GEO.capsule, color: 0x7a4fc0, pos: [0, 0.38, -0.32], scale: [0.05, 0.22, 0.05], rot: [1.1, 0, 0] },
      { geo: GEO.cone12, color: 0xd9363e, pos: [0, 0.55, -0.55], scale: [0.12, 0.16, 0.05], rot: [-0.5, 0, 0] },
      { geo: GEO.box, color: 0xdfe6ee, pos: [0.32, 0.5, 0.28], scale: [0.04, 0.04, 0.42] },
      { geo: GEO.box, color: 0x6a4428, pos: [0.32, 0.5, 0.04], scale: [0.06, 0.06, 0.14] },
    ]);
    case 'hedgehog': {
      const P = [];
      for (let i = 0; i < 22; i++) {
        const az = i * 2.39996, el = 0.2 + (i / 22) * 1.25;
        const d = [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
        if (d[2] > 0.4) continue;
        const c = [d[0] * 0.58, 0.5 + d[1] * 0.45, -0.05 + d[2] * 0.62];
        P.push({ geo: GEO.cone12, color: i % 3 ? 0xe8d29a : 0xb08a5a, pos: [c[0] + d[0] * 0.18, c[1] + d[1] * 0.18, c[2] + d[2] * 0.18], scale: [0.14, 0.46, 0.14], dir: d });
      }
      return mp([
        { geo: GEO.ball2, color: 0x7a5a3a, pos: [0, 0.5, -0.05], scale: [1.2, 0.95, 1.3] },
        ...P,
        { geo: GEO.ball1, color: 0xc9a07a, pos: [0, 0.42, 0.58], scale: [0.42, 0.34, 0.42] },
        { geo: GEO.ball1, color: 0x1a1a22, pos: [0, 0.45, 0.8], scale: [0.13, 0.11, 0.08] },
        { geo: GEO.ball1, color: 0x1a1a22, pos: [-0.17, 0.6, 0.52], scale: [0.09, 0.11, 0.05] },
        { geo: GEO.ball1, color: 0x1a1a22, pos: [0.17, 0.6, 0.52], scale: [0.09, 0.11, 0.05] },
        { geo: GEO.ball1, color: 0x5a3a22, pos: [-0.3, 0.08, 0.3], scale: [0.2, 0.14, 0.24] },
        { geo: GEO.ball1, color: 0x5a3a22, pos: [0.3, 0.08, 0.3], scale: [0.2, 0.14, 0.24] },
        { geo: GEO.ball1, color: 0x5a3a22, pos: [-0.3, 0.08, -0.35], scale: [0.2, 0.14, 0.24] },
        { geo: GEO.ball1, color: 0x5a3a22, pos: [0.3, 0.08, -0.35], scale: [0.2, 0.14, 0.24] },
      ]);
    }
    case 'lavaSlime': return mp([
      { geo: GEO.ball2, color: 0x3a2622, pos: [0, 0.62, 0], scale: [1.6, 1.22, 1.6] },
      { geo: GEO.ball1, color: 0x2a1a18, pos: [0, 0.22, 0], scale: [1.68, 0.45, 1.68] },
      { geo: GEO.ball1, color: 0xffa040, pos: [0, 1.12, 0], scale: [0.95, 0.3, 0.95] },
      { geo: GEO.ball1, color: 0xff6a1a, pos: [0.55, 0.85, 0.35], scale: [0.36, 0.12, 0.3], rot: [0.4, 0, -0.6] },
      { geo: GEO.ball1, color: 0xff6a1a, pos: [-0.6, 0.6, -0.25], scale: [0.3, 0.12, 0.42], rot: [0, 0, 0.9] },
      { geo: GEO.ball1, color: 0xff6a1a, pos: [0.2, 0.55, -0.7], scale: [0.4, 0.14, 0.2], rot: [-0.8, 0, 0] },
      { geo: GEO.ball1, color: 0xffd36a, pos: [-0.18, 0.78, 0.68], scale: [0.2, 0.22, 0.08] },
      { geo: GEO.ball1, color: 0xffd36a, pos: [0.18, 0.78, 0.68], scale: [0.2, 0.22, 0.08] },
      { geo: GEO.ball1, color: 0x1a0a08, pos: [-0.18, 0.76, 0.72], scale: [0.1, 0.12, 0.05] },
      { geo: GEO.ball1, color: 0x1a0a08, pos: [0.18, 0.76, 0.72], scale: [0.1, 0.12, 0.05] },
      { geo: GEO.ball1, color: 0xff8a2a, pos: [0, 0.5, 0.76], scale: [0.3, 0.08, 0.05] },
    ]);
    case 'troll': return mp([
      { geo: GEO.capsule, color: 0x5a6a4a, pos: [-0.38, 0.52, 0], scale: [0.44, 0.5, 0.44] },
      { geo: GEO.capsule, color: 0x5a6a4a, pos: [0.38, 0.52, 0], scale: [0.44, 0.5, 0.44] },
      { geo: GEO.ball2, color: 0x7a8a5a, pos: [0, 1.65, 0], scale: [1.75, 1.6, 1.3] },
      { geo: GEO.ball2, color: 0x9aa878, pos: [0, 1.5, 0.36], scale: [1.1, 1.1, 0.7] },
      { geo: GEO.rbox, color: 0x7a4f2a, pos: [0, 1.0, 0], scale: [1.25, 0.36, 1.0] },
      { geo: GEO.ball2, color: 0x7a8a5a, pos: [0, 2.6, 0.28], scale: [0.78, 0.68, 0.72] },
      { geo: GEO.ball1, color: 0x8a9a6a, pos: [0, 2.55, 0.66], scale: [0.26, 0.32, 0.26] },
      { geo: GEO.ball1, color: 0x1a1a22, pos: [-0.17, 2.72, 0.58], scale: [0.1, 0.09, 0.05] },
      { geo: GEO.ball1, color: 0x1a1a22, pos: [0.17, 2.72, 0.58], scale: [0.1, 0.09, 0.05] },
      { geo: GEO.box, color: 0x3a4a2a, pos: [-0.17, 2.82, 0.56], scale: [0.22, 0.06, 0.05], rot: [0, 0, -0.35] },
      { geo: GEO.box, color: 0x3a4a2a, pos: [0.17, 2.82, 0.56], scale: [0.22, 0.06, 0.05], rot: [0, 0, 0.35] },
      { geo: GEO.cone12, color: 0xf4f0e2, pos: [-0.15, 2.36, 0.58], scale: [0.07, 0.18, 0.07] },
      { geo: GEO.cone12, color: 0xf4f0e2, pos: [0.15, 2.36, 0.58], scale: [0.07, 0.18, 0.07] },
      { geo: GEO.cone12, color: 0x7a8a5a, pos: [-0.42, 2.65, 0.2], scale: [0.16, 0.32, 0.1], rot: [0, 0, 1.1] },
      { geo: GEO.cone12, color: 0x7a8a5a, pos: [0.42, 2.65, 0.2], scale: [0.16, 0.32, 0.1], rot: [0, 0, -1.1] },
      { geo: GEO.capsule, color: 0x6a7a4a, pos: [-1.05, 1.62, 0.1], scale: [0.42, 0.72, 0.42], rot: [0, 0, -0.25] },
      { geo: GEO.capsule, color: 0x6a7a4a, pos: [1.05, 1.62, 0.1], scale: [0.42, 0.72, 0.42], rot: [0, 0, 0.25] },
      { geo: GEO.ball2, color: 0x7a8a5a, pos: [-1.22, 0.86, 0.2], scale: [0.52, 0.52, 0.52] },
      { geo: GEO.ball2, color: 0x7a8a5a, pos: [1.22, 0.86, 0.2], scale: [0.52, 0.52, 0.52] },
      { geo: GEO.dodeca, color: 0x8a8478, pos: [1.22, 1.22, 0.42], scale: [0.85, 0.8, 0.8], flat: true },
    ]);
    case 'mimic': return mp([
      { geo: GEO.rbox, color: 0x8b5a2b, pos: [0, 0.42, 0], scale: [1.3, 0.8, 0.9] },
      { geo: GEO.rbox, color: 0xffcf4a, pos: [-0.5, 0.42, 0], scale: [0.12, 0.84, 0.94] },
      { geo: GEO.rbox, color: 0xffcf4a, pos: [0.5, 0.42, 0], scale: [0.12, 0.84, 0.94] },
      { geo: GEO.rbox, color: 0x9b6a35, pos: [0, 1.0, -0.22], scale: [1.32, 0.34, 0.92], rot: [-0.55, 0, 0] },
      { geo: GEO.rbox, color: 0xffcf4a, pos: [-0.5, 1.0, -0.22], scale: [0.12, 0.38, 0.96], rot: [-0.55, 0, 0] },
      { geo: GEO.rbox, color: 0xffcf4a, pos: [0.5, 1.0, -0.22], scale: [0.12, 0.38, 0.96], rot: [-0.55, 0, 0] },
      { geo: GEO.ball1, color: 0x5a0a1a, pos: [0, 0.82, 0.05], scale: [1.1, 0.12, 0.7] },
      { geo: GEO.ball1, color: 0xff7aa8, pos: [0, 0.86, 0.32], scale: [0.45, 0.12, 0.4] },
      ...[-0.42, -0.21, 0, 0.21, 0.42].map((x) => ({ geo: GEO.cone12, color: 0xfff6e0, pos: [x, 0.92, 0.38], scale: [0.1, 0.2, 0.1] })),
      ...[-0.32, -0.1, 0.12, 0.34].map((x) => ({ geo: GEO.cone12, color: 0xfff6e0, pos: [x, 1.08, 0.22], scale: [0.09, 0.2, 0.09], rot: [Math.PI - 0.55, 0, 0] })),
      { geo: GEO.ball1, color: 0xffffff, pos: [-0.26, 1.28, 0.06], scale: [0.2, 0.22, 0.12] },
      { geo: GEO.ball1, color: 0xffffff, pos: [0.26, 1.28, 0.06], scale: [0.2, 0.22, 0.12] },
      { geo: GEO.ball1, color: 0x15151f, pos: [-0.26, 1.27, 0.12], scale: [0.1, 0.13, 0.08] },
      { geo: GEO.ball1, color: 0x15151f, pos: [0.26, 1.27, 0.12], scale: [0.1, 0.13, 0.08] },
      { geo: GEO.rbox, color: 0xffcf4a, pos: [0, 0.55, 0.46], scale: [0.2, 0.22, 0.06] },
    ]);
  }
  return null;
}

// ---------- Bosse ----------
function buildBossModel(model) {
  const g = new THREE.Group();
  const parts = {};
  const M = (color, o = {}) => mat(Object.assign({ color, rim: 0.25 }, o));
  if (model === 'slimeKing') {
    parts.body = part(g, GEO.ball3, M(0x4fc63e, { rough: 0.3 }), 4.6, 3.6, 4.6, 0, 1.75, 0);
    part(g, GEO.ball3, M(0x3fa832, { rough: 0.4 }), 4.9, 1.0, 4.9, 0, 0.45, 0);
    part(g, GEO.ball2, M(0xb6ff9a, { rough: 0.2 }), 1.4, 0.8, 1.2, 0.9, 3.0, 0.8);
    const eyes = addEyes(g, 2.3, 2.05, 0.75, 0.75);
    parts.eyes = eyes;
    part(g, GEO.ball2, M(0x1f5a1a), 1.2, 0.35, 0.2, 0, 1.45, 2.1);
    const crown = new THREE.Group(); crown.position.set(0, 3.55, 0); g.add(crown);
    const gold = M(0xffcf4a, { metal: 0.55, rough: 0.3, emissive: 0x4a3000 });
    part(crown, GEO.cyl12, gold, 1.9, 0.5, 1.9, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      part(crown, GEO.cone12, gold, 0.4, 0.75, 0.4, Math.cos(a) * 0.85, 0.55, Math.sin(a) * 0.85);
      part(crown, GEO.ball2, M(i % 2 ? 0xff3b6b : 0x46c2ff, { rough: 0.1, emissive: i % 2 ? 0x600020 : 0x003060 }), 0.18, 0.18, 0.18, Math.cos(a) * 0.95, 0.05, Math.sin(a) * 0.95);
    }
  } else if (model === 'golemLord') {
    const stone = M(0x6f737c, { flat: true, rough: 0.95 }), stone2 = M(0x8a8e97, { flat: true, rough: 0.95 }), moss = M(0x5e9c46, { rough: 1 });
    const glow = new THREE.MeshStandardMaterial({ color: 0xffb13a, emissive: 0xff7a00, emissiveIntensity: 2.2 });
    part(g, GEO.dodeca, stone, 1.3, 2.0, 1.4, -0.85, 0.95, 0);
    part(g, GEO.dodeca, stone, 1.3, 2.0, 1.4, 0.85, 0.95, 0);
    parts.body = part(g, GEO.dodeca, stone2, 3.4, 2.8, 2.3, 0, 3.0, 0);
    part(g, GEO.ball2, moss, 2.9, 0.5, 1.9, 0, 4.25, -0.1);
    part(g, GEO.dodeca, stone2, 1.5, 1.2, 1.3, 0, 4.85, 0.35);
    part(g, GEO.ball2, glow, 0.32, 0.2, 0.1, -0.3, 4.9, 0.95);
    part(g, GEO.ball2, glow, 0.32, 0.2, 0.1, 0.3, 4.9, 0.95);
    part(g, GEO.box, glow, 0.14, 1.1, 0.06, 0.1, 3.1, 1.15, 0, 0, 0.3);
    part(g, GEO.box, glow, 0.1, 0.7, 0.06, -0.5, 2.7, 1.1, 0, 0, -0.5);
    const armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.set(-2.1, 3.8, 0); armR.position.set(2.1, 3.8, 0);
    for (const A of [armL, armR]) {
      part(A, GEO.dodeca, stone, 1.1, 2.9, 1.2, 0, -1.2, 0);
      part(A, GEO.dodeca, stone2, 1.5, 1.2, 1.5, 0, -2.8, 0.1);
    }
    g.add(armL, armR);
    parts.glowPts = [[-0.3, 4.9, 1.0], [0.3, 4.9, 1.0]];
    Object.assign(parts, { armL, armR });
  } else if (model === 'witch') {
    const robe = M(0x3b1f5c, { rough: 0.7 }), robe2 = M(0x5a2d8a, { rough: 0.7 }), skin = M(0x9bd46a, { rough: 0.6 });
    const hatM = M(0x1e1530, { rough: 0.6 }), band = M(0xb04ad9), gold = M(0xffcf4a, { metal: 0.5, rough: 0.3, emissive: 0x4a3000 });
    const hair = M(0x2a2a3a, { rough: 0.95 }), wood = M(0x6a4428, { rough: 0.9 });
    const eye = new THREE.MeshStandardMaterial({ color: 0xd9ff6a, emissive: 0xaaff33, emissiveIntensity: 2.4 });
    const orb = new THREE.MeshStandardMaterial({ color: 0xd9b8ff, emissive: 0xa050ff, emissiveIntensity: 2.6 });
    // Kleid: schwebt, unten ausgefranst
    parts.body = part(g, GEO.cone12, robe, 2.7, 3.1, 2.7, 0, 1.55, 0);
    part(g, GEO.cyl12, robe2, 2.75, 0.22, 2.75, 0, 0.1, 0);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      part(g, GEO.cone12, robe2, 0.45, 0.6, 0.45, Math.sin(a) * 1.15, -0.2, Math.cos(a) * 1.15, Math.PI, 0, 0);
    }
    part(g, GEO.capsule, robe, 1.15, 0.6, 0.95, 0, 2.95, 0);
    box(g, gold, 1.2, 0.14, 1.0, 0, 2.35, 0);
    const head = new THREE.Group(); head.position.set(0, 3.85, 0.05); g.add(head);
    part(head, GEO.ball3, skin, 1.3, 1.2, 1.2, 0, 0, 0);
    part(head, GEO.ball2, hair, 1.6, 1.35, 1.05, 0, -0.05, -0.3);
    part(head, GEO.capsule, hair, 0.32, 0.6, 0.3, -0.62, -0.75, -0.05);
    part(head, GEO.capsule, hair, 0.32, 0.6, 0.3, 0.62, -0.75, -0.05);
    part(head, GEO.cone12, skin, 0.24, 0.62, 0.24, 0, -0.05, 0.78, 1.35, 0, 0);
    part(head, GEO.ball1, M(0x6a9a44), 0.1, 0.1, 0.1, 0.08, 0.02, 0.88);
    part(head, GEO.ball2, eye, 0.26, 0.18, 0.1, -0.27, 0.17, 0.56, 0, 0, 0.25);
    part(head, GEO.ball2, eye, 0.26, 0.18, 0.1, 0.27, 0.17, 0.56, 0, 0, -0.25);
    box(head, M(0x1a1220), 0.36, 0.06, 0.06, -0.27, 0.32, 0.56, 0, 0, 0.35);
    box(head, M(0x1a1220), 0.36, 0.06, 0.06, 0.27, 0.32, 0.56, 0, 0, -0.35);
    part(head, GEO.ball1, M(0x2a1430), 0.46, 0.1, 0.1, 0, -0.38, 0.54);
    // Hut
    const hat = new THREE.Group(); hat.position.set(0, 0.45, -0.05); hat.rotation.x = -0.12; head.add(hat);
    part(hat, GEO.cyl12, hatM, 2.7, 0.1, 2.7, 0, 0, 0);
    part(hat, GEO.cone12, hatM, 1.35, 2.0, 1.35, 0, 1.0, 0);
    part(hat, GEO.cone12, hatM, 0.5, 0.9, 0.5, 0, 2.15, -0.25, -0.7, 0, 0);
    part(hat, GEO.cyl12, band, 1.3, 0.24, 1.3, 0, 0.2, 0);
    box(hat, gold, 0.34, 0.3, 0.08, 0, 0.2, 0.64);
    const armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.set(-0.75, 3.25, 0); armR.position.set(0.75, 3.25, 0);
    for (const A of [armL, armR]) {
      part(A, GEO.capsule, robe2, 0.42, 0.55, 0.42, 0, -0.5, 0.1);
      part(A, GEO.ball2, skin, 0.36, 0.36, 0.36, 0, -1.05, 0.18);
    }
    const staff = new THREE.Group(); staff.position.set(0, -1.05, 0.2); armR.add(staff);
    part(staff, GEO.cyl12, wood, 0.14, 3.8, 0.14, 0, 0.3, 0);
    part(staff, GEO.ball2, orb, 0.6, 0.6, 0.6, 0, 2.45, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU;
      part(staff, GEO.cone12, gold, 0.1, 0.5, 0.1, Math.sin(a) * 0.3, 2.3, Math.cos(a) * 0.3, Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
    }
    g.add(armL, armR);
    parts.glowPts = [[-0.27, 4.02, 0.65], [0.27, 4.02, 0.65]];
    parts.orbPt = [0.75, 3.6, 0.4];
    Object.assign(parts, { armL, armR, head, staff });
  } else if (model === 'finalBoss') {
    const skin = M(0x8e3b8f, { rough: 0.55 }), skin2 = M(0xa94ca8, { rough: 0.55 }), belly = M(0xe6a3c9, { rough: 0.6 }), dark = M(0x2a1a2e);
    const horn = M(0xf6efd8, { rough: 0.4 }), gold = M(0xffcf4a, { metal: 0.55, rough: 0.3, emissive: 0x4a3000 });
    const eye = new THREE.MeshStandardMaterial({ color: 0xfff26b, emissive: 0xffc800, emissiveIntensity: 2.5 });
    part(g, GEO.capsule, dark, 1.4, 1.1, 1.4, -1.0, 1.0, 0);
    part(g, GEO.capsule, dark, 1.4, 1.1, 1.4, 1.0, 1.0, 0);
    parts.body = part(g, GEO.ball3, skin, 4.6, 4.2, 3.6, 0, 3.9, 0);
    part(g, GEO.ball3, belly, 3.0, 2.8, 1.2, 0, 3.6, 1.35);
    part(g, GEO.cyl12, gold, 4.2, 0.45, 3.2, 0, 2.25, 0);
    part(g, GEO.ball2, gold, 0.7, 0.7, 0.3, 0, 2.25, 1.62);
    const head = new THREE.Group(); head.position.set(0, 6.5, 0.3); g.add(head);
    part(head, GEO.ball3, skin2, 2.6, 2.1, 2.2, 0, 0, 0);
    part(head, GEO.ball2, eye, 0.5, 0.32, 0.1, -0.55, 0.25, 1.02, 0, 0, -0.2);
    part(head, GEO.ball2, eye, 0.5, 0.32, 0.1, 0.55, 0.25, 1.02, 0, 0, 0.2);
    box(head, dark, 0.7, 0.12, 0.1, -0.55, 0.5, 1.0, 0, 0, -0.35);
    box(head, dark, 0.7, 0.12, 0.1, 0.55, 0.5, 1.0, 0, 0, 0.35);
    part(head, GEO.ball2, dark, 1.4, 0.4, 0.3, 0, -0.45, 0.95);
    part(head, GEO.cone12, horn, 0.22, 0.38, 0.22, -0.4, -0.32, 1.06, Math.PI, 0, 0);
    part(head, GEO.cone12, horn, 0.22, 0.38, 0.22, 0.4, -0.32, 1.06, Math.PI, 0, 0);
    part(head, GEO.cone12, horn, 0.5, 1.5, 0.5, -1.15, 1.05, 0, 0, 0, 0.55);
    part(head, GEO.cone12, horn, 0.5, 1.5, 0.5, 1.15, 1.05, 0, 0, 0, -0.55);
    const crown = new THREE.Group(); crown.position.set(0, 1.0, 0); head.add(crown);
    part(crown, GEO.cyl12, gold, 1.6, 0.45, 1.6, 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      part(crown, GEO.cone12, gold, 0.35, 0.65, 0.35, Math.cos(a) * 0.7, 0.5, Math.sin(a) * 0.7);
    }
    const armL = new THREE.Group(), armR = new THREE.Group();
    armL.position.set(-2.5, 5.2, 0); armR.position.set(2.5, 5.2, 0);
    for (const A of [armL, armR]) {
      part(A, GEO.capsule, skin2, 1.1, 1.8, 1.1, 0, -1.2, 0);
      part(A, GEO.ball2, skin, 1.0, 1.0, 1.0, 0, -2.5, 0);
    }
    const club = new THREE.Group(); club.position.set(0, -2.6, 0.4); armR.add(club);
    part(club, GEO.cyl12, M(0x7a4f2a), 0.45, 3.4, 0.45, 0, 0, 1.4, Math.PI / 2, 0, 0);
    part(club, GEO.dodeca, M(0x9b6b3d, { flat: true }), 1.9, 1.9, 2.3, 0, 0, 3.4);
    for (let i = 0; i < 6; i++) part(club, GEO.cone12, horn, 0.3, 0.6, 0.3, Math.cos(i) * 0.95, Math.sin(i) * 0.95, 3.4, Math.sin(i), 0, Math.cos(i));
    g.add(armL, armR);
    parts.glowPts = [[-0.55, 6.75, 1.35], [0.55, 6.75, 1.35]];
    Object.assign(parts, { armL, armR, head });
  }
  const mats = new Set();
  g.traverse((o) => { if (o.material && o.material.emissive) mats.add(o.material); });
  g.userData = { parts, mats: [...mats] };
  return g;
}

// ---------- Porträts für Menüs und HUD ----------
// Rendert jeden Helden einmal mit einem eigenen kleinen Renderer und speichert das Bild.
const Portraits = {};
function renderPortraits(only) {
  let r;
  try {
    const c = document.createElement('canvas');
    r = new THREE.WebGLRenderer({ canvas: c, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch (_) { return; }
  r.setSize(192, 192, false);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6a5a8a, 1.8));
  const key = new THREE.DirectionalLight(0xfff1d6, 3.2); key.position.set(2, 3, 4); scene.add(key);
  const back = new THREE.DirectionalLight(0x9fd0ff, 2.0); back.position.set(-3, 2, -3); scene.add(back);
  const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  for (const ch of CHARACTERS) {
    if (only && !only.includes(ch.id)) continue;
    const h = buildHero(ch.id);
    attachHat(h, ch.id, Profile.hats[ch.id]);
    h.rotation.y = -0.35;
    scene.add(h);
    const hy = h.userData.head.position.y, hat = h.userData.hat ? 1 : 0;
    cam.position.set(0.55, hy + 0.15 + hat * 0.1, 3.0 + hat * 0.35);
    cam.lookAt(0, hy - 0.12 + hat * 0.12, 0);
    r.render(scene, cam);
    Portraits[ch.id] = r.domElement.toDataURL('image/png');
    scene.remove(h);
  }
  r.dispose();
  if (r.forceContextLoss) r.forceContextLoss();
}
