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
    part(head, GEO.cyl12, hat, 1.18, 0.07, 1.18, 0, 0.27, 0);
    part(head, GEO.cone12, hat, 0.7, 0.75, 0.7, 0, 0.66, -0.04, -0.12, 0, 0);
    part(head, GEO.cone12, hat, 0.34, 0.45, 0.34, 0.1, 1.12, -0.18, -0.6, 0, -0.3);
    part(head, GEO.oct, star, 0.16, 0.16, 0.06, 0.18, 0.5, 0.3, 0, 0, 0.6);
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
  return root;
}

// ---------- Gegner (zusammengesetzte Geometrien für InstancedMesh) ----------
function enemyGeometry(type) {
  const W_ = 0xffffff, P = 0x15151f;
  const eyesAt = (y, z, sp, s) => [
    { geo: GEO.ball1, color: W_, pos: [-sp, y, z], scale: [s, s * 1.2, s * 0.5] },
    { geo: GEO.ball1, color: W_, pos: [sp, y, z], scale: [s, s * 1.2, s * 0.5] },
    { geo: GEO.ball1, color: P, pos: [-sp, y - s * 0.08, z + s * 0.14], scale: [s * 0.55, s * 0.7, s * 0.4] },
    { geo: GEO.ball1, color: P, pos: [sp, y - s * 0.08, z + s * 0.14], scale: [s * 0.55, s * 0.7, s * 0.4] },
  ];
  switch (type) {
    case 'slime': return mergeParts([
      { geo: GEO.ball1, color: 0x5fd34c, pos: [0, 0.48, 0], scale: [1.3, 1.0, 1.3] },
      { geo: GEO.ball1, color: 0x4bbb3b, pos: [0, 0.18, 0], scale: [1.38, 0.38, 1.38] },
      { geo: GEO.ball1, color: 0xb6ff9a, pos: [0.22, 0.78, 0.18], scale: [0.36, 0.2, 0.3] },
      ...eyesAt(0.6, 0.56, 0.2, 0.22),
      { geo: GEO.ball1, color: 0x2a6b22, pos: [0, 0.36, 0.62], scale: [0.18, 0.06, 0.04] },
    ]);
    case 'skeleton': return mergeParts([
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
    case 'bat': return mergeParts([
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
    case 'spitter': return mergeParts([
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
    case 'golem': return mergeParts([
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
    case 'ghost': return mergeParts([
      { geo: GEO.cone12, color: 0xdff3ff, pos: [0, 0.62, 0], scale: [1.0, 1.25, 1.0], rot: [Math.PI, 0, 0] },
      { geo: GEO.ball2, color: 0xeef9ff, pos: [0, 1.25, 0], scale: [1.0, 0.92, 1.0] },
      { geo: GEO.ball1, color: 0x223344, pos: [-0.18, 1.32, 0.42], scale: [0.18, 0.24, 0.08] },
      { geo: GEO.ball1, color: 0x223344, pos: [0.18, 1.32, 0.42], scale: [0.18, 0.24, 0.08] },
      { geo: GEO.ball1, color: 0x223344, pos: [0, 1.05, 0.46], scale: [0.2, 0.14, 0.06] },
      { geo: GEO.capsule, color: 0xdff3ff, pos: [-0.5, 1.05, 0.15], scale: [0.14, 0.3, 0.14], rot: [0.8, 0, 0.4] },
      { geo: GEO.capsule, color: 0xdff3ff, pos: [0.5, 1.05, 0.15], scale: [0.14, 0.3, 0.14], rot: [0.8, 0, -0.4] },
    ]);
    case 'darkKnight': return mergeParts([
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
function renderPortraits() {
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
    const h = buildHero(ch.id);
    h.rotation.y = -0.35;
    scene.add(h);
    const hy = h.userData.head.position.y;
    cam.position.set(0.55, hy + 0.15, 3.0);
    cam.lookAt(0, hy - 0.12, 0);
    r.render(scene, cam);
    Portraits[ch.id] = r.domElement.toDataURL('image/png');
    scene.remove(h);
  }
  r.dispose();
  if (r.forceContextLoss) r.forceContextLoss();
}
