'use strict';
// Rumms! – Spieldaten: Helden, Waffen, Bücher, Gegner, Bosse.
// Alle Zahlen hier sind Balancing-Werte; die Logik steckt in den anderen Dateien.

const CONFIG = {
  ROUND_SECONDS: 15 * 60, // 15 Minuten pro Runde (Megabonk: 10)
  MAP_HALF: 104,          // begehbarer Bereich: -MAP_HALF … +MAP_HALF
  WATER_LEVEL: -3.3,      // Teiche in den Senken
  WORLD_HALF: 140,        // Gelände inkl. Randgebirge
  MAX_ENEMIES: 400,
  MAX_WEAPONS: 4,
  WEAPON_MAX_LEVEL: 12,
  REROLLS: 3,
  MINI_BOSSES: [
    { t: 5 * 60, id: 'slimeKing' },
    { t: 10 * 60, id: 'golemLord' },
    { t: 12.5 * 60, id: 'witch' },
  ],
  HORDE_EVERY: 90,
  CHESTS: 16,
  SHRINES: 8,
  CHEST_BASE_PRICE: 15,
  CHEST_PRICE_STEP: 10,
};

// Gegner werden mit der Zeit stärker (m = Minuten seit Rundenbeginn).
function enemyHpScale(m) { return 1.32 + 0.3 * m + 0.104 * m * m; }
function enemyDmgScale(m) { return 1.21 + 0.143 * m; }
function spawnRate(m) { return 1.8 + 0.78 * m + 0.048 * m * m; } // Gegner pro Sekunde
function xpForLevel(l) { return Math.floor(6 + 5 * l + 0.48 * l * l); }

const RARITIES = [
  { id: 'common', name: 'Gewöhnlich', color: '#d7d2e6', mult: 1.0, weight: 62 },
  { id: 'uncommon', name: 'Ungewöhnlich', color: '#5ee08a', mult: 1.3, weight: 24 },
  { id: 'rare', name: 'Selten', color: '#46c2ff', mult: 1.6, weight: 10 },
  { id: 'epic', name: 'Episch', color: '#c58bff', mult: 2.0, weight: 3.4 },
  { id: 'legendary', name: 'Legendär', color: '#ffc93c', mult: 2.6, weight: 0.9 },
];

// Werte, die eine Waffen-Verbesserung erhöhen kann. base × Seltenheits-Multiplikator.
const WEAPON_UPGRADES = {
  damage: { label: 'Schaden', base: 0.2 },
  cooldown: { label: 'Angriffstempo', base: 0.09 },
  area: { label: 'Größe', base: 0.12 },
  speed: { label: 'Tempo', base: 0.14 },
  duration: { label: 'Dauer', base: 0.15 },
  knockback: { label: 'Rückstoß', base: 0.25 },
  amount: { label: 'Anzahl', int: true, minRarity: 2 },
  pierce: { label: 'Durchschlag', int: true, minRarity: 1 },
  bounces: { label: 'Sprünge', int: true, minRarity: 1 },
};

// type bestimmt das Verhalten (weapons.js). Jede Heldin / jeder Held hat fünf eigene Waffen,
// von denen bis zu vier gleichzeitig getragen werden.
const WEAPONS = {
  // Ritter
  sword: {
    name: 'Schwert', icon: '⚔️', type: 'swing',
    desc: 'Schlägt in einem weiten Bogen zu und schleudert Gegner weg.',
    damage: 18, cooldown: 1.0, area: 4.0, arc: 2.5, knockback: 9, amount: 1,
    upgrades: ['damage', 'damage', 'cooldown', 'area', 'amount', 'knockback'], maxAmount: 4,
  },
  holyCircle: {
    name: 'Heiliger Kreis', icon: '✨', type: 'aura',
    desc: 'Ein leuchtender Kreis verbrennt und verlangsamt Gegner um dich herum.',
    damage: 6, cooldown: 0.5, area: 3.2, slow: 0.35,
    upgrades: ['damage', 'damage', 'cooldown', 'area'],
  },
  shieldThrow: {
    name: 'Schildwurf', icon: '🛡️', type: 'boomerang',
    desc: 'Wirft einen Schild, der alles auf dem Hin- und Rückweg trifft.',
    damage: 20, cooldown: 2.0, area: 1.1, range: 12, speed: 17, amount: 1, knockback: 5,
    upgrades: ['damage', 'damage', 'cooldown', 'amount', 'area', 'speed'], maxAmount: 4,
  },
  lance: {
    name: 'Lanzenstoß', type: 'thrust',
    desc: 'Stößt eine lange Lanze nach vorn und durchbohrt alle Gegner in einer Linie.',
    damage: 26, cooldown: 1.5, area: 1.0, range: 8, amount: 1, knockback: 7,
    upgrades: ['damage', 'damage', 'cooldown', 'area', 'amount', 'knockback'], maxAmount: 4,
  },
  hammers: {
    name: 'Himmelshämmer', type: 'spiral',
    desc: 'Goldene Hämmer drehen sich in einer Spirale nach außen und treffen alles auf ihrem Weg.',
    damage: 16, cooldown: 3.2, area: 1.0, amount: 3, duration: 1, speed: 4.2, range: 11, knockback: 5,
    upgrades: ['damage', 'damage', 'cooldown', 'amount', 'area', 'duration'], maxAmount: 7,
  },
  // Jägerin
  longbow: {
    name: 'Langbogen', icon: '🏹', type: 'projectile', visual: 'arrow',
    desc: 'Schießt durchschlagende Pfeile auf den nächsten Gegner.',
    damage: 14, cooldown: 0.85, speed: 32, pierce: 2, amount: 1, range: 28, spread: 0.1,
    target: 'nearest', knockback: 2,
    upgrades: ['damage', 'damage', 'cooldown', 'amount', 'pierce', 'speed'], maxAmount: 6,
  },
  arrowRain: {
    name: 'Pfeilregen', icon: '🌧️', type: 'rain',
    desc: 'Lässt Pfeile auf die größte Gegnergruppe in der Nähe regnen.',
    damage: 10, cooldown: 3.0, area: 3.8, duration: 1, amount: 1, range: 20,
    upgrades: ['damage', 'damage', 'cooldown', 'area', 'amount', 'duration'], maxAmount: 4,
  },
  knives: {
    name: 'Wurfmesser', icon: '🔪', type: 'projectile', visual: 'knife',
    desc: 'Wirft schnell Messer in Laufrichtung.',
    damage: 8, cooldown: 0.5, speed: 28, pierce: 1, amount: 2, range: 17, spread: 0.2,
    target: 'facing', knockback: 1.5,
    upgrades: ['damage', 'damage', 'cooldown', 'amount', 'pierce', 'speed'], maxAmount: 7,
  },
  falcon: {
    name: 'Falke', type: 'pet',
    desc: 'Ein treuer Falke stößt auf Gegner herab und kehrt danach zu dir zurück.',
    damage: 17, cooldown: 0.8, amount: 1, speed: 21, range: 22, area: 1.0, knockback: 3,
    upgrades: ['damage', 'damage', 'cooldown', 'amount', 'speed', 'area'], maxAmount: 4,
  },
  vines: {
    name: 'Dornenranken', type: 'root',
    desc: 'Dornen schießen aus dem Boden, halten Gegner fest und stechen zu.',
    damage: 8, cooldown: 4.2, area: 3.4, duration: 1, amount: 1, range: 17,
    upgrades: ['damage', 'damage', 'cooldown', 'area', 'amount', 'duration'], maxAmount: 4,
  },
  // Magier
  lightning: {
    name: 'Blitzstab', icon: '⚡', type: 'chain',
    desc: 'Ein Blitz springt von Gegner zu Gegner.',
    damage: 14, cooldown: 1.25, bounces: 3, range: 15, amount: 1,
    upgrades: ['damage', 'damage', 'cooldown', 'bounces', 'amount'], maxAmount: 4,
  },
  fireball: {
    name: 'Feuerball', icon: '🔥', type: 'projectile', visual: 'fireball',
    desc: 'Ein Feuerball, der beim Aufprall explodiert.',
    damage: 18, cooldown: 1.6, speed: 16, pierce: 0, explode: 2.7, amount: 1, range: 24,
    target: 'nearest', knockback: 4,
    upgrades: ['damage', 'damage', 'cooldown', 'amount', 'area', 'speed'], maxAmount: 5,
  },
  meteor: {
    name: 'Meteor', icon: '☄️', type: 'strike',
    desc: 'Ruft Meteore vom Himmel auf zufällige Gegner herab.',
    damage: 42, cooldown: 3.6, area: 3.3, amount: 1, range: 22, knockback: 8,
    upgrades: ['damage', 'damage', 'cooldown', 'amount', 'area'], maxAmount: 5,
  },
  vortex: {
    name: 'Schwarzes Loch', type: 'vortex',
    desc: 'Ein Strudel aus dunkler Magie saugt Gegner an und zermalmt sie.',
    damage: 9, cooldown: 5.5, area: 4.2, duration: 1, amount: 1, range: 16,
    upgrades: ['damage', 'damage', 'cooldown', 'area', 'duration', 'amount'], maxAmount: 3,
  },
  arcaneBeam: {
    name: 'Arkanstrahl', type: 'beam',
    desc: 'Ein Lichtstrahl dreht sich einmal um dich und brennt sich durch alle Gegner.',
    damage: 13, cooldown: 3.6, area: 1.0, range: 11, duration: 1, amount: 1,
    upgrades: ['damage', 'damage', 'cooldown', 'duration', 'amount', 'area'], maxAmount: 3,
  },
  // Ninja
  shuriken: {
    name: 'Shuriken', icon: '✴️', type: 'orbit',
    desc: 'Wurfsterne kreisen um dich und zerschneiden alles in der Nähe.',
    damage: 12, cooldown: 0.4, area: 3.0, speed: 3.4, amount: 2, knockback: 2,
    upgrades: ['damage', 'damage', 'amount', 'area', 'speed'], maxAmount: 7,
  },
  kunai: {
    name: 'Kunai', icon: '🗡️', type: 'projectile', visual: 'kunai',
    desc: 'Blitzschnelle Kunai auf den nächsten Gegner.',
    damage: 9, cooldown: 0.38, speed: 36, pierce: 0, amount: 1, range: 20, spread: 0.08,
    target: 'nearest', knockback: 1,
    upgrades: ['damage', 'damage', 'cooldown', 'amount', 'pierce', 'speed'], maxAmount: 6,
  },
  dragonBlade: {
    name: 'Drachenklinge', icon: '🐉', type: 'boomerang',
    desc: 'Zwei Klingen fliegen hinaus und kehren zurück.',
    damage: 15, cooldown: 1.8, area: 1.3, range: 13, speed: 20, amount: 2, knockback: 3,
    upgrades: ['damage', 'damage', 'cooldown', 'amount', 'area', 'speed'], maxAmount: 6,
  },
  smokeBomb: {
    name: 'Rauchbombe', type: 'smoke',
    desc: 'Eine Rauchwolke verwirrt Gegner: Sie irren umher, greifen nicht an und nehmen Schaden.',
    damage: 7, cooldown: 6, area: 3.8, duration: 1, amount: 1,
    upgrades: ['damage', 'damage', 'cooldown', 'area', 'duration', 'amount'], maxAmount: 3,
  },
  kusarigama: {
    name: 'Kettensichel', type: 'whirl',
    desc: 'Eine Sichel an einer Kette wirbelt in einem weiten Kreis um dich herum.',
    damage: 21, cooldown: 2.2, area: 5.2, amount: 1, knockback: 7,
    upgrades: ['damage', 'damage', 'cooldown', 'area', 'amount', 'knockback'], maxAmount: 3,
  },
  // Zwerg
  bombs: {
    name: 'Bomben', icon: '💣', type: 'lob',
    desc: 'Wirft Bomben, die in einem großen Radius explodieren.',
    damage: 24, cooldown: 1.55, area: 3.1, amount: 1, range: 14, knockback: 7,
    upgrades: ['damage', 'damage', 'cooldown', 'amount', 'area'], maxAmount: 5,
  },
  quake: {
    name: 'Erdbeben', icon: '🌋', type: 'nova',
    desc: 'Eine Schockwelle stößt alle Gegner um dich herum weg.',
    damage: 17, cooldown: 2.8, area: 6.5, knockback: 14,
    upgrades: ['damage', 'damage', 'cooldown', 'area', 'knockback'],
  },
  mines: {
    name: 'Minen', icon: '🧨', type: 'mine',
    desc: 'Legt Minen, die hochgehen, sobald Gegner darauf treten.',
    damage: 38, cooldown: 2.2, area: 3.5, amount: 1, duration: 14, knockback: 9,
    upgrades: ['damage', 'damage', 'cooldown', 'amount', 'area', 'duration'], maxAmount: 5,
  },
  turret: {
    name: 'Kanonenturm', type: 'turret',
    desc: 'Baut einen Kanonenturm, der eine Weile selbstständig auf Gegner feuert.',
    damage: 13, cooldown: 9, duration: 1, amount: 1, range: 18, speed: 22, area: 1.0, knockback: 3,
    upgrades: ['damage', 'damage', 'cooldown', 'duration', 'amount', 'area'], maxAmount: 3,
  },
  pickaxe: {
    name: 'Spitzhacken', type: 'toss',
    desc: 'Wirft Spitzhacken hoch in die Luft, die beim Herunterfallen alles durchschlagen.',
    damage: 22, cooldown: 1.4, amount: 1, area: 1.0, pierce: 3, range: 11, knockback: 5,
    upgrades: ['damage', 'damage', 'cooldown', 'amount', 'pierce', 'area'], maxAmount: 6,
  },
};

// Bücher (Tomes): gelten für alle Waffen und den Helden.
const TOMES = {
  might: { name: 'Buch der Stärke', icon: '💪', stat: 'damage', base: 0.08, fmt: 'pct', label: 'Schaden' },
  haste: { name: 'Buch der Eile', icon: '⏱️', stat: 'attackSpeed', base: 0.06, fmt: 'pct', label: 'Angriffstempo' },
  size: { name: 'Buch der Größe', icon: '🔮', stat: 'area', base: 0.1, fmt: 'pct', label: 'Fläche' },
  amount: { name: 'Buch der Menge', icon: '➕', stat: 'amount', int: true, minRarity: 3, max: 2, label: 'Projektil' },
  swift: { name: 'Buch der Schnelligkeit', icon: '👟', stat: 'speed', base: 0.06, fmt: 'pct', label: 'Lauftempo' },
  vitality: { name: 'Buch der Vitalität', icon: '❤️', stat: 'maxHp', base: 18, fmt: 'flat', label: 'Max-LP' },
  regen: { name: 'Buch der Erholung', icon: '💚', stat: 'regen', base: 0.5, fmt: 'regen', label: 'LP pro Sekunde' },
  armor: { name: 'Buch des Schutzes', icon: '🪖', stat: 'armor', base: 0.045, fmt: 'pct', label: 'Rüstung' },
  evasion: { name: 'Buch der Flinkheit', icon: '💨', stat: 'evasion', base: 0.04, fmt: 'pct', label: 'Ausweichen' },
  crit: { name: 'Buch der Präzision', icon: '🎯', stat: 'crit', base: 0.05, fmt: 'pct', label: 'Krit-Chance', max: 6 },
  luck: { name: 'Buch des Glücks', icon: '🍀', stat: 'luck', base: 0.07, fmt: 'pct', label: 'Glück', max: 5 },
  wisdom: { name: 'Buch der Weisheit', icon: '📘', stat: 'xpGain', base: 0.1, fmt: 'pct', label: 'Erfahrung', max: 5 },
  magnet: { name: 'Buch des Magnetismus', icon: '🧲', stat: 'pickup', base: 0.22, fmt: 'pct', label: 'Sammelradius', max: 5 },
  greed: { name: 'Buch der Gier', icon: '💰', stat: 'gold', base: 0.15, fmt: 'pct', label: 'Gold', max: 5 },
  feather: { name: 'Buch der Feder', icon: '🪶', stat: 'jumps', int: true, minRarity: 3, max: 2, label: 'Luftsprung' },
};
const TOME_MAX_LEVEL = 8;

const CHARACTERS = [
  {
    id: 'knight', name: 'Bruno', title: 'Ritter', icon: '🛡️', color: '#5b8def',
    desc: 'Robust und gern mittendrin. Haut alles weg, was ihm zu nahe kommt.',
    weapons: ['sword', 'holyCircle', 'shieldThrow', 'lance', 'hammers'],
    stats: { maxHp: 135, speed: 6.6, armor: 0.08 },
    passive: '+35 Max-LP, +8 % Rüstung', difficulty: 'Leicht',
  },
  {
    id: 'archer', name: 'Lyra', title: 'Jägerin', icon: '🏹', color: '#3fae5a',
    desc: 'Trifft aus großer Entfernung und lässt es Pfeile regnen.',
    weapons: ['longbow', 'arrowRain', 'knives', 'falcon', 'vines'],
    stats: { maxHp: 100, speed: 7.2, crit: 0.15, projSpeed: 0.15 },
    passive: '+10 % Krit-Chance, +15 % Projektiltempo', difficulty: 'Mittel',
  },
  {
    id: 'mage', name: 'Zappo', title: 'Magier', icon: '🧙', color: '#9b5de5',
    desc: 'Zerbrechlich, aber seine Blitze und Meteore räumen ganze Horden ab.',
    weapons: ['lightning', 'fireball', 'meteor', 'vortex', 'arcaneBeam'],
    stats: { maxHp: 90, speed: 6.9, xpGain: 0.2, area: 0.1 },
    passive: '+20 % Erfahrung, +10 % Fläche', difficulty: 'Schwer',
  },
  {
    id: 'ninja', name: 'Kenji', title: 'Ninja', icon: '🥷', color: '#2b2d42',
    desc: 'Der Schnellste von allen. Springt doppelt und weicht Treffern aus.',
    weapons: ['shuriken', 'kunai', 'dragonBlade', 'smokeBomb', 'kusarigama'],
    stats: { maxHp: 90, speed: 7.9, jumps: 1, evasion: 0.08 },
    passive: 'Doppelsprung, +15 % Tempo, +8 % Ausweichen', difficulty: 'Mittel',
  },
  {
    id: 'dwarf', name: 'Grumbel', title: 'Zwerg', icon: '⛏️', color: '#e07a2f',
    desc: 'Langsam, zäh und laut. Alles explodiert irgendwann.',
    weapons: ['bombs', 'quake', 'mines', 'turret', 'pickaxe'],
    stats: { maxHp: 120, speed: 6.3, area: 0.15, regen: 0.6 },
    passive: '+15 % Fläche, +0,6 LP/s Regeneration', difficulty: 'Leicht',
  },
];

// h: Körperhöhe, fly: Flughöhe über dem Boden, mass: Widerstand gegen Rückstoß.
// Besondere Fähigkeiten: ranged (Fernkampf), keep (hält Abstand), swarm (kommt im Schwarm),
// fuse (explodiert neben dir), split (zerfällt in kleine Gegner), charge (Ansturm),
// heal (heilt andere Gegner), shield (blockt Treffer von vorn).
const ENEMIES = {
  slime: { name: 'Schleim', hp: 9, speed: 2.8, dmg: 6, xp: 1, r: 0.6, h: 1.0, mass: 1 },
  skeleton: { name: 'Knochenkerl', hp: 18, speed: 3.3, dmg: 8, xp: 2, r: 0.55, h: 1.8, mass: 1 },
  wisp: { name: 'Irrlicht', hint: 'Kommen im Schwarm und fliegen Schlangenlinien.', hp: 5, speed: 6.0, dmg: 5, xp: 1, r: 0.4, h: 0.6, fly: 1.1, mass: 0.4, swarm: [5, 7], noElite: true },
  bat: { name: 'Fledermaus', hp: 8, speed: 4.9, dmg: 5, xp: 1, r: 0.5, h: 0.7, fly: 1.4, mass: 0.6 },
  bomber: {
    name: 'Knallpilz', hint: 'Blinkt er, lauf weg – er explodiert! Abgeschossen sprengt er seine Freunde.', hp: 14, speed: 3.9, dmg: 6, xp: 2, r: 0.55, h: 1.3, mass: 0.9, noElite: true,
    fuse: { range: 2.3, time: 0.85, r: 3.0, dmg: 22 },
  },
  spitter: {
    name: 'Spucker', hp: 24, speed: 2.5, dmg: 7, xp: 3, r: 0.65, h: 1.5, mass: 1.2,
    ranged: { range: 13, keep: 8, cd: 3.4, speed: 10, dmg: 9, color: 0xff6ab0 },
  },
  bigSlime: { name: 'Riesenschleim', hint: 'Zerfällt in drei kleine Schleime.', hp: 50, speed: 2.2, dmg: 12, xp: 4, r: 1.05, h: 1.8, mass: 2.4, split: { into: 'slime', n: 3 } },
  boar: {
    name: 'Keiler', hint: 'Scharrt er mit „!“, weich zur Seite aus!', hp: 42, speed: 3.0, dmg: 13, xp: 4, r: 0.8, h: 1.3, mass: 2.2,
    charge: { min: 4.5, max: 15, windup: 0.75, speed: 16, time: 0.85, cd: 4.5 },
  },
  golem: { name: 'Steinklotz', hp: 95, speed: 2.2, dmg: 16, xp: 8, r: 1.15, h: 2.4, mass: 4 },
  frost: {
    name: 'Frostwicht', hint: 'Seine Eiskugeln verlangsamen dich.', hp: 30, speed: 2.6, dmg: 7, xp: 4, r: 0.6, h: 1.6, mass: 1.1,
    ranged: { range: 15, keep: 9, cd: 3.4, speed: 12, dmg: 6, color: 0x8fe3ff, slow: 0.35, slowT: 2 },
  },
  shaman: {
    name: 'Goblin-Schamane', hint: 'Heilt alle Gegner um sich herum – zuerst ausschalten!', hp: 55, speed: 2.7, dmg: 9, xp: 6, r: 0.6, h: 1.6, mass: 1.2, keep: 10, noHorde: true,
    heal: { r: 8, cd: 3.2, pct: 0.25 },
  },
  ghost: { name: 'Geist', hp: 34, speed: 4.1, dmg: 10, xp: 4, r: 0.6, h: 1.6, fly: 0.35, phase: true, mass: 0.8 },
  shieldBearer: { name: 'Schildträger', hint: 'Blockt Treffer von vorn. Flächenschaden von oben trifft voll.', hp: 100, speed: 2.5, dmg: 18, xp: 9, r: 0.85, h: 2.2, mass: 3.5, shield: 0.65 },
  darkKnight: { name: 'Schattenritter', hp: 150, speed: 3.2, dmg: 22, xp: 12, r: 0.8, h: 2.2, mass: 3 },
  spider: {
    name: 'Riesenspinne', hint: 'Springt dich aus der Entfernung an – im letzten Moment ausweichen!',
    hp: 16, speed: 4.3, dmg: 9, xp: 2, r: 0.6, h: 0.9, mass: 0.9,
    pounce: { min: 3.5, max: 9, cd: 3.2, time: 0.55, height: 2.0 },
  },
  kobold: {
    name: 'Kobold', hint: 'Teleportiert sich plötzlich direkt neben dich.',
    hp: 22, speed: 3.6, dmg: 10, xp: 3, r: 0.5, h: 1.3, mass: 0.8, blink: { cd: 4.5, min: 8 },
  },
  hedgehog: {
    name: 'Stacheligel', hint: 'Schießt Stacheln in alle Richtungen – drüberspringen!',
    hp: 40, speed: 2.4, dmg: 10, xp: 4, r: 0.75, h: 1.1, mass: 1.6, spikes: { cd: 3.8, n: 10, speed: 9, dmg: 8, range: 11 },
  },
  lavaSlime: {
    name: 'Lavaschleim', hint: 'Hinterlässt brennende Pfützen – nicht hineinlaufen!',
    hp: 45, speed: 2.6, dmg: 12, xp: 4, r: 0.8, h: 1.3, mass: 1.8, trail: { every: 0.5, r: 1.2, life: 3.2, dmg: 7 },
  },
  troll: {
    name: 'Felsentroll', hint: 'Wirft Felsbrocken – raus aus dem roten Kreis!',
    hp: 160, speed: 2.0, dmg: 20, xp: 12, r: 1.1, h: 2.9, mass: 4.5, lob: { range: 18, min: 5, cd: 4.5, dmg: 16 },
  },
  mimic: {
    name: 'Mimik', hint: 'Diese Truhe beißt! Besiegt lässt sie viel Gold fallen.',
    hp: 90, speed: 5.0, dmg: 14, xp: 10, r: 0.8, h: 1.3, mass: 2.5, gold: 25, noElite: true, noHorde: true, mimic: { wake: 7 },
  },
};

// Gegner-Mischung: [ab Sekunde, Gewicht beim Auftauchen, Gewicht am Ende, Ende (Standard 13:40)].
// Dazwischen wird das Gewicht gleichmäßig angepasst, damit sich die Horde nach und nach verändert.
const SPAWN_MIX = {
  slime: [0, 10, 0, 420],
  skeleton: [15, 3, 2.5],
  wisp: [80, 0.8, 0.4],
  bat: [110, 4, 2.5],
  spider: [130, 2.2, 1.8],
  bomber: [160, 1.8, 2.2],
  mimic: [160, 0.2, 0.25],
  spitter: [210, 1.8, 1.5],
  bigSlime: [210, 1.1, 1.2],
  kobold: [230, 1.5, 1.6],
  boar: [270, 1.3, 2],
  hedgehog: [300, 1.2, 1.5],
  golem: [340, 1.2, 2.4],
  frost: [340, 1.1, 1.5],
  lavaSlime: [380, 1.1, 1.5],
  shaman: [420, 0.6, 0.9],
  ghost: [490, 2.5, 3],
  troll: [520, 0.9, 1.4],
  shieldBearer: [570, 1.1, 1.8],
  darkKnight: [660, 2, 3],
};
function spawnWeights(t) {
  const out = {};
  for (const id in SPAWN_MIX) {
    const [from, w0, w1, to = 820] = SPAWN_MIX[id];
    if (t < from) continue;
    const k = Math.min(1, (t - from) / Math.max(1, to - from));
    const w = w0 + (w1 - w0) * k;
    if (w > 0.01) out[id] = w;
  }
  return out;
}


const BOSSES = {
  slimeKing: {
    name: 'Schleimkönig', hp: 3200, speed: 3.0, dmg: 18, r: 2.3, h: 3.6, xp: 160, gold: 100,
    attacks: ['slam', 'summon', 'slam'], model: 'slimeKing',
  },
  golemLord: {
    name: 'Golemfürst', hp: 20000, speed: 2.8, dmg: 34, r: 2.5, h: 5.2, xp: 400, gold: 200,
    attacks: ['slam', 'charge', 'rocks', 'charge'], model: 'golemLord',
  },
  witch: {
    name: 'Hexe Morla', hp: 60000, speed: 4.4, dmg: 36, r: 1.5, h: 4.6, xp: 600, gold: 260,
    attacks: ['spiral', 'homing', 'blink', 'puddles', 'summon', 'spiral', 'blink', 'homing'], model: 'witch',
    hover: true, keep: 10, summon: ['skeleton', 'wisp', 'ghost'],
  },
  finalBoss: {
    name: 'Der Große Rummser', hp: 100000, speed: 3.4, dmg: 42, r: 3.0, h: 7, xp: 0, gold: 0,
    attacks: ['slam', 'charge', 'burst', 'rocks', 'summon', 'burst'], model: 'finalBoss', final: true,
  },
};

// ---------- Freischaltbares ----------
// Sterne gibt es am Ende jeder Runde und für Erfolge. In der Werkstatt werden sie gegen
// dauerhafte Verbesserungen getauscht, die für alle Helden gelten.
const SHOP = [
  { id: 'might', name: 'Kraft', desc: '+5 % Schaden', icon: ['tome', 'might'], stat: 'damage', per: 0.05, cost: [10, 20, 35, 55, 80] },
  { id: 'vitality', name: 'Lebenskraft', desc: '+10 Max-LP', icon: ['tome', 'vitality'], stat: 'maxHp', per: 10, cost: [8, 16, 28, 44, 64] },
  { id: 'swift', name: 'Flinke Füße', desc: '+3 % Lauftempo', icon: ['tome', 'swift'], stat: 'speed', per: 0.03, cost: [12, 26, 45] },
  { id: 'magnet', name: 'Magnet', desc: '+12 % Sammelradius', icon: ['tome', 'magnet'], stat: 'pickup', per: 0.12, cost: [8, 18, 32] },
  { id: 'luck', name: 'Glückspilz', desc: '+4 % Glück', icon: ['tome', 'luck'], stat: 'luck', per: 0.04, cost: [15, 30, 50] },
  { id: 'wisdom', name: 'Weisheit', desc: '+5 % Erfahrung', icon: ['tome', 'wisdom'], stat: 'xpGain', per: 0.05, cost: [12, 25, 42] },
  { id: 'gold', name: 'Startkapital', desc: '+15 Gold zu Beginn', icon: ['misc', 'gold'], stat: 'startGold', per: 15, cost: [10, 22, 38] },
  { id: 'reroll', name: 'Glückswürfel', desc: '+1 Neuwürfeln pro Runde', icon: ['misc', 'dice'], stat: 'rerolls', per: 1, cost: [25, 60] },
  { id: 'revive', name: 'Zweites Leben', desc: 'Einmal pro Runde mit halben LP wieder aufstehen', icon: ['misc', 'revive'], stat: 'revive', per: 1, cost: [120] },
];

// Kosmetische Hüte, freigeschaltet über Erfolge
const HATS = {
  crown: { name: 'Krone' },
  slime: { name: 'Schleimhut' },
  tophat: { name: 'Zylinder' },
  witch: { name: 'Hexenhut' },
  party: { name: 'Partyhut' },
  propeller: { name: 'Propellermütze' },
  flowers: { name: 'Blumenkranz' },
  mushroom: { name: 'Pilzkappe' },
  halo: { name: 'Heiligenschein' },
  devil: { name: 'Teufelshörner' },
};

// run: Zusammenfassung der gerade beendeten Runde, prof: Spielerprofil, rec: Rekorde je Held
const ACHIEVEMENTS = [
  { id: 'firstWin', name: 'Erster Sieg', desc: 'Gewinne eine Runde.', stars: 20, hat: 'crown', extra: 'Albtraum-Modus', check: (run) => run.victory },
  { id: 'slimeKing', name: 'Schleimbezwinger', desc: 'Besiege den Schleimkönig.', stars: 5, hat: 'slime', check: (run) => run.bosses.includes('slimeKing') },
  { id: 'golemLord', name: 'Steinbrecher', desc: 'Besiege den Golemfürsten.', stars: 10, hat: 'tophat', check: (run) => run.bosses.includes('golemLord') },
  { id: 'witch', name: 'Hexenjäger', desc: 'Besiege Hexe Morla.', stars: 15, hat: 'witch', check: (run) => run.bosses.includes('witch') },
  { id: 'kills', name: 'Rummsmaschine', desc: 'Besiege 1000 Gegner in einer Runde.', stars: 10, hat: 'party', check: (run) => run.kills >= 1000 },
  { id: 'level', name: 'Überflieger', desc: 'Erreiche Stufe 60 in einer Runde.', stars: 15, hat: 'propeller', check: (run) => run.level >= 60 },
  { id: 'shrines', name: 'Pilger', desc: 'Nutze 5 Schreine in einer Runde.', stars: 10, hat: 'flowers', check: (run) => run.shrines >= 5 },
  {
    id: 'bombers', name: 'Pilzsammler', desc: 'Besiege insgesamt 250 Knallpilze.', stars: 10, hat: 'mushroom',
    check: (run, prof) => (prof.totals.bomber || 0) >= 250, progress: (prof) => [prof.totals.bomber || 0, 250],
  },
  {
    id: 'allHeroes', name: 'Heldenhaft', desc: 'Gewinne mit allen fünf Helden.', stars: 40, hat: 'halo',
    check: (run, prof, rec) => CHARACTERS.every((c) => rec[c.id] && rec[c.id].wins),
    progress: (prof, rec) => [CHARACTERS.filter((c) => rec[c.id] && rec[c.id].wins).length, CHARACTERS.length],
  },
  { id: 'nightmare', name: 'Albtraumbezwinger', desc: 'Gewinne im Albtraum-Modus.', stars: 50, hat: 'devil', check: (run) => run.victory && run.nightmare },
];

// Albtraum-Modus (nach dem ersten Sieg): stärkere Gegner, mehr Sterne
const NIGHTMARE = { hp: 1.75, dmg: 1.3, rate: 1.2, elite: 1.8, bossHp: 1.5, bossDmg: 1.2, stars: 1.5 };
