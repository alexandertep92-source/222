'use strict';
// Rumms! – Spieldaten: Helden, Waffen, Bücher, Gegner, Bosse.
// Alle Zahlen hier sind Balancing-Werte; die Logik steckt in den anderen Dateien.

const CONFIG = {
  ROUND_SECONDS: 15 * 60, // 15 Minuten pro Runde (Megabonk: 10)
  MAP_HALF: 104,          // begehbarer Bereich: -MAP_HALF … +MAP_HALF
  WATER_LEVEL: -3.3,      // Teiche in den Senken
  WORLD_HALF: 140,        // Gelände inkl. Randgebirge
  MAX_ENEMIES: 280,
  MAX_WEAPONS: 3,
  WEAPON_MAX_LEVEL: 12,
  REROLLS: 3,
  MINI_BOSSES: [
    { t: 5 * 60, id: 'slimeKing' },
    { t: 10 * 60, id: 'golemLord' },
  ],
  HORDE_EVERY: 90,
  CHESTS: 16,
  SHRINES: 8,
  CHEST_BASE_PRICE: 15,
  CHEST_PRICE_STEP: 10,
};

// Gegner werden mit der Zeit stärker (m = Minuten seit Rundenbeginn).
function enemyHpScale(m) { return 1 + 0.2 * m + 0.075 * m * m; }
function enemyDmgScale(m) { return 1 + 0.1 * m; }
function spawnRate(m) { return 1.1 + 0.5 * m + 0.032 * m * m; } // Gegner pro Sekunde
function xpForLevel(l) { return Math.floor(5 + 4 * l + 0.4 * l * l); }

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

// type bestimmt das Verhalten (weapons.js). Jede Heldin / jeder Held hat drei eigene Waffen.
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
    weapons: ['sword', 'holyCircle', 'shieldThrow'],
    stats: { maxHp: 135, speed: 6.6, armor: 0.08 },
    passive: '+35 Max-LP, +8 % Rüstung', difficulty: 'Leicht',
  },
  {
    id: 'archer', name: 'Lyra', title: 'Jägerin', icon: '🏹', color: '#3fae5a',
    desc: 'Trifft aus großer Entfernung und lässt es Pfeile regnen.',
    weapons: ['longbow', 'arrowRain', 'knives'],
    stats: { maxHp: 100, speed: 7.2, crit: 0.15, projSpeed: 0.15 },
    passive: '+10 % Krit-Chance, +15 % Projektiltempo', difficulty: 'Mittel',
  },
  {
    id: 'mage', name: 'Zappo', title: 'Magier', icon: '🧙', color: '#9b5de5',
    desc: 'Zerbrechlich, aber seine Blitze und Meteore räumen ganze Horden ab.',
    weapons: ['lightning', 'fireball', 'meteor'],
    stats: { maxHp: 90, speed: 6.9, xpGain: 0.2, area: 0.1 },
    passive: '+20 % Erfahrung, +10 % Fläche', difficulty: 'Schwer',
  },
  {
    id: 'ninja', name: 'Kenji', title: 'Ninja', icon: '🥷', color: '#2b2d42',
    desc: 'Der Schnellste von allen. Springt doppelt und weicht Treffern aus.',
    weapons: ['shuriken', 'kunai', 'dragonBlade'],
    stats: { maxHp: 90, speed: 7.9, jumps: 1, evasion: 0.08 },
    passive: 'Doppelsprung, +15 % Tempo, +8 % Ausweichen', difficulty: 'Mittel',
  },
  {
    id: 'dwarf', name: 'Grumbel', title: 'Zwerg', icon: '⛏️', color: '#e07a2f',
    desc: 'Langsam, zäh und laut. Alles explodiert irgendwann.',
    weapons: ['bombs', 'quake', 'mines'],
    stats: { maxHp: 120, speed: 6.3, area: 0.15, regen: 0.6 },
    passive: '+15 % Fläche, +0,6 LP/s Regeneration', difficulty: 'Leicht',
  },
];

// h: Körperhöhe, fly: Flughöhe über dem Boden, mass: Widerstand gegen Rückstoß.
const ENEMIES = {
  slime: { name: 'Schleim', hp: 9, speed: 2.8, dmg: 6, xp: 1, r: 0.6, h: 1.0, mass: 1 },
  skeleton: { name: 'Knochenkerl', hp: 18, speed: 3.3, dmg: 8, xp: 2, r: 0.55, h: 1.8, mass: 1 },
  bat: { name: 'Fledermaus', hp: 8, speed: 4.9, dmg: 5, xp: 1, r: 0.5, h: 0.7, fly: 1.4, mass: 0.6 },
  spitter: {
    name: 'Spucker', hp: 24, speed: 2.5, dmg: 7, xp: 3, r: 0.65, h: 1.5, mass: 1.2,
    ranged: { range: 13, keep: 8, cd: 3.4, speed: 10, dmg: 9 },
  },
  golem: { name: 'Steinklotz', hp: 95, speed: 2.2, dmg: 16, xp: 8, r: 1.15, h: 2.4, mass: 4 },
  ghost: { name: 'Geist', hp: 34, speed: 4.1, dmg: 10, xp: 4, r: 0.6, h: 1.6, fly: 0.35, phase: true, mass: 0.8 },
  darkKnight: { name: 'Schattenritter', hp: 150, speed: 3.2, dmg: 22, xp: 12, r: 0.8, h: 2.2, mass: 3 },
};

// Welche Gegner ab wann erscheinen (Sekunden) und wie häufig.
const SPAWN_TABLE = [
  { t: 0, w: { slime: 10 } },
  { t: 40, w: { slime: 8, skeleton: 4 } },
  { t: 100, w: { slime: 6, skeleton: 5, bat: 4 } },
  { t: 200, w: { slime: 4, skeleton: 5, bat: 4, spitter: 2 } },
  { t: 320, w: { slime: 3, skeleton: 5, bat: 4, spitter: 2, golem: 1.4 } },
  { t: 470, w: { slime: 2, skeleton: 5, bat: 4, spitter: 2, golem: 2, ghost: 3 } },
  { t: 640, w: { skeleton: 4, bat: 3, spitter: 2, golem: 2.4, ghost: 3, darkKnight: 2 } },
  { t: 820, w: { skeleton: 3, bat: 3, spitter: 2, golem: 3, ghost: 3, darkKnight: 3 } },
];

const BOSSES = {
  slimeKing: {
    name: 'Schleimkönig', hp: 3200, speed: 3.0, dmg: 18, r: 2.3, h: 3.6, xp: 160, gold: 60,
    attacks: ['slam', 'summon', 'slam'], model: 'slimeKing',
  },
  golemLord: {
    name: 'Golemfürst', hp: 20000, speed: 2.8, dmg: 34, r: 2.5, h: 5.2, xp: 400, gold: 120,
    attacks: ['slam', 'charge', 'rocks', 'charge'], model: 'golemLord',
  },
  finalBoss: {
    name: 'Der Große Rummser', hp: 100000, speed: 3.4, dmg: 42, r: 3.0, h: 7, xp: 0, gold: 0,
    attacks: ['slam', 'charge', 'burst', 'rocks', 'summon', 'burst'], model: 'finalBoss', final: true,
  },
};
