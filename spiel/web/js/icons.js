'use strict';
// Rumms! – Eigene Symbole (SVG) für Waffen, Bücher und Knöpfe, damit alles einheitlich aussieht.

const Icons = (() => {
  const O = '#1b1530';
  const svg = (body) => `<svg class="ico" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
  // Linie mit dunkler Kontur
  const ln = (x1, y1, x2, y2, c, w) => `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${O}" stroke-width="${w + 4}" stroke-linecap="round"/><path d="M${x1} ${y1}L${x2} ${y2}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  const st = (d, c, w) => `<path d="${d}" fill="none" stroke="${O}" stroke-width="${w + 4}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const pa = (d, c) => `<path d="${d}" fill="${c}" stroke="${O}" stroke-width="3" stroke-linejoin="round"/>`;
  const ci = (x, y, r, c) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${O}" stroke-width="3"/>`;
  const hl = (d) => `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2.2" stroke-linecap="round"/>`;
  const star = (x, y, r, c) => pa(`M${x} ${y - r}L${x + r * 0.28} ${y - r * 0.28}L${x + r} ${y}L${x + r * 0.28} ${y + r * 0.28}L${x} ${y + r}L${x - r * 0.28} ${y + r * 0.28}L${x - r} ${y}L${x - r * 0.28} ${y - r * 0.28}Z`, c);

  const weapons = {
    sword: ln(40, 8, 18, 30, '#eef3f8', 5) + hl('M36 13L22 27') + ln(13, 24, 24, 35, '#f4c542', 4) + ln(18, 30, 10, 38, '#8b5a2b', 4) + ci(9, 39, 3.5, '#e63946'),
    holyCircle: `<ellipse cx="24" cy="30" rx="17" ry="9" fill="none" stroke="${O}" stroke-width="9"/><ellipse cx="24" cy="30" rx="17" ry="9" fill="none" stroke="#ffe27a" stroke-width="5"/>` + star(24, 15, 10, '#fff6c8') + star(38, 9, 5, '#ffe27a') + star(10, 12, 4, '#ffe27a'),
    shieldThrow: pa('M24 5L40 11Q40 32 24 43Q8 32 8 11Z', '#3a6fc4') + pa('M24 11L34 15Q34 29 24 37Q14 29 14 15Z', '#2a55a0') + ln(24, 15, 24, 33, '#f4c542', 3) + ln(17, 21, 31, 21, '#f4c542', 3) + hl('M13 14Q13 24 18 30'),
    longbow: st('M15 5Q40 24 15 43', '#9a6a3a', 4) + `<path d="M15 5L15 43" stroke="#f1e9d2" stroke-width="1.8"/>` + ln(8, 24, 36, 24, '#c9a46a', 3) + pa('M45 24L36 18.5L36 29.5Z', '#dfe6ee') + pa('M5 20L11 24L5 28Z', '#ff5a5a'),
    arrowRain: pa('M10 18Q10 8 20 9Q24 3 31 7Q41 6 40 15Q44 21 36 22H14Q7 22 10 18Z', '#dfe8f5') + [12, 22, 32].map((x, i) => ln(x + 4, 25 + i * 2, x, 38 + i * 2, '#c9a46a', 2.5) + pa(`M${x - 2} ${40 + i * 2}L${x - 1} ${33 + i * 2}L${x + 4} ${37 + i * 2}Z`, '#dfe6ee')).join(''),
    knives: ln(9, 39, 31, 17, '#eef3f8', 5) + ln(9, 39, 15, 33, '#6a4428', 6) + ln(39, 39, 17, 17, '#eef3f8', 5) + ln(39, 39, 33, 33, '#6a4428', 6) + hl('M27 21L20 28'),
    lightning: pa('M29 3L11 27H23L17 45L38 17H26L33 3Z', '#ffe066') + hl('M28 7L18 23'),
    fireball: pa('M24 44Q8 42 9 28Q10 18 19 11Q18 20 24 21Q22 10 32 4Q30 14 37 20Q42 28 37 37Q32 44 24 44Z', '#ff7a1a') + pa('M24 41Q15 40 16 31Q17 25 22 22Q22 28 27 29Q27 24 31 21Q35 29 32 35Q29 41 24 41Z', '#ffd84a'),
    meteor: st('M8 8L26 24', '#ffb13a', 9) + st('M5 18L22 30', '#ff7a1a', 6) + st('M18 5L30 20', '#ff7a1a', 6) + ci(31, 31, 11, '#8a6a5a') + ci(27, 28, 3, '#6a4e42') + ci(35, 35, 2.5, '#6a4e42') + hl('M24 25Q28 22 33 23'),
    shuriken: pa('M24 3L29 19L45 24L29 29L24 45L19 29L3 24L19 19Z', '#e4eaf1') + ci(24, 24, 4.5, '#3b3f52') + hl('M24 8L26.5 18'),
    kunai: pa('M24 3L31 20L24 28L17 20Z', '#5a6078') + hl('M24 7L28 19') + ln(24, 30, 24, 38, '#d94a4a', 4) + `<circle cx="24" cy="42" r="4" fill="none" stroke="${O}" stroke-width="5"/><circle cx="24" cy="42" r="4" fill="none" stroke="#c9d1d9" stroke-width="2.5"/>`,
    dragonBlade: pa('M8 30Q12 8 36 6Q22 14 22 27Q22 38 40 42Q16 46 8 30Z', '#e0303f') + hl('M13 27Q16 14 29 9') + pa('M32 30L36 26L40 30L36 34Z', '#ffc93c'),
    bombs: ci(22, 29, 14, '#2b2b38') + hl('M14 24Q16 19 21 18') + st('M31 18Q34 10 39 9', '#8b5a2b', 3) + star(41, 8, 6, '#ffd84a'),
    quake: pa('M3 34L13 30L22 35L31 29L45 33V45H3Z', '#b07a46') + st('M21 35L24 40L20 45', '#5a3b22', 2) + pa('M10 21L16 18L18 24L12 26Z', '#8f8a7e') + pa('M30 14L37 13L36 20L30 20Z', '#8f8a7e') + pa('M21 8L25 7L25 12L21 12Z', '#8f8a7e'),
    mines: pa('M5 33Q24 20 43 33Q24 41 5 33Z', '#3a3a48') + pa('M17 29Q24 16 31 29Q24 32 17 29Z', '#ff3b3b') + hl('M21 25Q23 22 26 22') + ln(7, 33, 3, 37, '#8a8a9a', 2) + ln(41, 33, 45, 37, '#8a8a9a', 2),
    // neue Waffen
    lance: ln(6, 42, 32, 16, '#d9b47a', 4) + pa('M44 4L30 13L35 18Z', '#e8eef6') + hl('M41 7L33 13') + pa('M11 29L22 25L19 36Z', '#f4c542') + pa('M30 16L21 11L26 21Z', '#e63946'),
    hammers: st('M8 30Q6 12 22 8Q38 6 40 20', '#fff0a8', 2.5) + `<circle cx="40" cy="20" r="2" fill="#fff6c8"/>` + ln(12, 42, 27, 27, '#8b5a2b', 4.5) + pa('M20 16L32 12L38 30L26 34Z', '#ffcf4a') + hl('M23 18L30 15'),
    falcon: pa('M24 22Q15 9 3 13Q11 17 13 24Q18 27 24 32Q30 27 35 24Q37 17 45 13Q33 9 24 22Z', '#8a5a38') + pa('M24 28L20 40L24 37L28 40Z', '#6a4028') + ci(24, 19, 5.5, '#f4f1ea') + pa('M22 22L24 27L26 22Z', '#ffc93c') + `<circle cx="22" cy="18" r="1.3" fill="${O}"/><circle cx="26" cy="18" r="1.3" fill="${O}"/>`,
    vines: st('M12 45Q12 33 22 30Q33 27 30 17Q28 10 20 12', '#3f9e55', 4.5) + pa('M15 36L9 33L14 31Z', '#8fd46a') + pa('M27 27L33 30L31 24Z', '#8fd46a') + pa('M30 18L36 15L32 13Z', '#8fd46a') + pa('M18 13Q12 4 22 3Q26 9 18 13Z', '#7cd36a') + ci(34, 38, 4, '#ff7aa8') + ci(34, 38, 1.6, '#ffe066'),
    vortex: ci(24, 24, 18, '#2a0f45') + st('M24 24m-2 0a2 2 0 1 1 4 0a5 5 0 1 1 -10 0a8.5 8.5 0 1 1 17 0a12 12 0 1 1 -24 0', '#c58bff', 2.6) + ci(24, 24, 3, '#12051f'),
    arcaneBeam: `<path d="M13 35L44 6" stroke="${O}" stroke-width="11" stroke-linecap="round"/><path d="M13 35L44 6" stroke="#a46bff" stroke-width="7" stroke-linecap="round"/><path d="M13 35L44 6" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/>` + ci(11, 37, 7.5, '#c58bff') + hl('M8 35Q9 32 12 32') + star(36, 26, 5, '#fff6c8') + star(30, 8, 3.5, '#e8c8ff'),
    smokeBomb: pa('M8 26Q4 18 12 15Q14 7 23 9Q30 4 36 11Q45 11 43 20Q47 28 39 30H13Q6 31 8 26Z', '#b6b0d0') + pa('M15 22Q14 17 19 17Q22 13 27 16', '#d8d4ea') + ci(23, 35, 9, '#2b2d42') + hl('M18 32Q19 29 22 28') + st('M28 28Q31 24 35 25', '#8b5a2b', 2.5) + star(36, 24, 4, '#ffd84a'),
    kusarigama: `<path d="M8 41Q13 30 23 28" fill="none" stroke="${O}" stroke-width="6" stroke-dasharray="3.5 2.5"/><path d="M8 41Q13 30 23 28" fill="none" stroke="#9aa3b5" stroke-width="3" stroke-dasharray="3.5 2.5"/>` + ln(22, 31, 30, 22, '#d94a4a', 4) + pa('M28 24Q28 7 45 5Q35 11 33 26Z', '#e4eaf1') + hl('M31 20Q32 11 40 8') + ci(7, 42, 3.5, '#9aa3b5'),
    turret: pa('M8 42L12 28H36L40 42Z', '#6a4428') + ln(14, 34, 34, 34, '#b3b9c4', 2) + ci(24, 25, 8, '#8a6a4a') + `<path d="M24 24L44 14" stroke="${O}" stroke-width="10" stroke-linecap="round"/><path d="M24 24L44 14" stroke="#2b2b38" stroke-width="6" stroke-linecap="round"/>` + ci(44, 14, 2.6, '#ffcf4a') + hl('M19 22Q21 19 24 19'),
    pickaxe: ln(12, 42, 31, 17, '#8b5a2b', 4.5) + pa('M13 13Q28 1 44 16Q36 13 31 17Q27 13 13 13Z', '#b3b9c4') + hl('M18 12Q27 7 37 11') + ci(30, 16, 3, '#d9a04a'),
  };

  const book = (cover, sym) => pa('M11 6H37Q41 6 41 10V40Q41 43 38 43H12Q7 43 7 38V10Q7 6 11 6Z', cover)
    + pa('M11 35H40V43H12Q7 43 7 39Q7 35 11 35Z', '#fff6e0') + `<path d="M12 39H38" stroke="#c9bfe0" stroke-width="1.5"/>` + hl('M12 10V30') + sym;
  const tomes = {
    might: book('#d9363e', pa('M24 11L33 22H28V31H20V22H15Z', '#fff2d0')),
    haste: book('#1fa4c8', ci(24, 21, 9, '#fff6e0') + `<path d="M24 21V15M24 21L28 24" stroke="${O}" stroke-width="2.6" stroke-linecap="round"/>`),
    size: book('#8a4fd6', ci(24, 21, 4, '#fff6e0') + `<circle cx="24" cy="21" r="9.5" fill="none" stroke="#fff6e0" stroke-width="2.5" stroke-dasharray="4 3"/>`),
    amount: book('#e8822c', ln(24, 13, 24, 29, '#fff6e0', 4) + ln(16, 21, 32, 21, '#fff6e0', 4)),
    swift: book('#19a38a', pa('M14 26Q16 14 30 12Q25 18 34 18Q30 26 14 26Z', '#fff6e0') + `<path d="M14 30H22M12 25H17" stroke="#fff6e0" stroke-width="2.5" stroke-linecap="round"/>`),
    vitality: book('#e8476a', pa('M24 31Q12 23 13 16Q15 10 20 11Q23 12 24 15Q25 12 28 11Q33 10 35 16Q36 23 24 31Z', '#fff2f4')),
    regen: book('#3fae5a', pa('M21 12H27V18H33V24H27V30H21V24H15V18H21Z', '#fff6e0')),
    armor: book('#5d7aa8', pa('M24 11L33 14Q33 25 24 31Q15 25 15 14Z', '#e6edf7')),
    evasion: book('#5cc3e8', st('M14 16H28Q33 16 32 20', '#fff6e0', 2.5) + st('M12 22H31', '#fff6e0', 2.5) + st('M15 28H26Q30 28 30 25', '#fff6e0', 2.5)),
    crit: book('#f0a020', `<circle cx="24" cy="21" r="9" fill="none" stroke="#fff6e0" stroke-width="2.6"/><circle cx="24" cy="21" r="4" fill="#fff6e0"/>`),
    luck: book('#2f9a48', ci(20, 17, 4.5, '#9be86e') + ci(28, 17, 4.5, '#9be86e') + ci(20, 25, 4.5, '#9be86e') + ci(28, 25, 4.5, '#9be86e')),
    wisdom: book('#2a3f8f', star(24, 21, 10, '#ffe066')),
    magnet: book('#7a8094', st('M17 13V21Q17 29 24 29Q31 29 31 21V13', '#e63946', 4.5) + `<path d="M15 13H19M29 13H33" stroke="#fff6e0" stroke-width="4"/>`),
    greed: book('#c9932a', ci(24, 21, 9, '#ffd84a') + `<circle cx="24" cy="21" r="5" fill="none" stroke="#c9932a" stroke-width="2.4"/>`),
    feather: book('#7fb7e8', pa('M31 11Q34 22 20 31Q18 22 31 11Z', '#fff6e0') + `<path d="M16 34L28 16" stroke="${O}" stroke-width="2"/>`),
  };
  const misc = {
    gold: ci(24, 24, 15, '#ffd84a') + `<circle cx="24" cy="24" r="9" fill="none" stroke="#c9932a" stroke-width="3"/>` + hl('M14 19Q17 12 24 11'),
    heal: pa('M30 12Q40 14 38 24Q36 32 27 30L16 41Q12 44 9 41Q6 38 10 35L13 33Q9 30 12 27L21 19Q19 11 30 12Z', '#c9653a') + ci(10, 38, 3, '#fff6e0'),
    jump: pa('M24 7L39 24H30V40H18V24H9Z', '#1b1530'),
    dash: pa('M8 10L22 24L8 38L8 30L14 24L8 18Z', '#1b1530') + pa('M24 10L38 24L24 38L24 30L30 24L24 18Z', '#1b1530'),
    star: pa('M24 4L29.5 17L43.5 18L32.8 27.2L36.2 41L24 33.5L11.8 41L15.2 27.2L4.5 18L18.5 17Z', '#ffd84a') + hl('M20 18L24 9'),
    dice: pa('M10 14L24 7L38 14L38 32L24 40L10 32Z', '#fff6e0') + `<path d="M10 14L24 21L38 14M24 21V40" fill="none" stroke="${O}" stroke-width="2.5"/>` + ci(24, 13.5, 2.2, O) + ci(16, 25, 2.2, O) + ci(19, 31, 2.2, O) + ci(29, 25, 2.2, O) + ci(33, 31, 2.2, O),
    revive: pa('M24 42Q8 31 8 19Q8 10 16 9Q21 9 24 14Q27 9 32 9Q40 10 40 19Q40 31 24 42Z', '#ff5a7a') + pa('M21 15H27V21H33V27H27V33H21V27H15V21H21Z', '#fff6e0') + hl('M12 17Q13 13 17 13'),
    lock: pa('M11 22H37V42H11Z', '#9aa3b5') + st('M16 22V15Q16 7 24 7Q32 7 32 15V22', '#9aa3b5', 4) + ci(24, 31, 3, O),
    check: st('M10 25L20 35L39 13', '#5ee08a', 6),
    hat: pa('M6 36Q24 30 42 36Q24 42 6 36Z', '#2b2b38') + pa('M14 35L18 12Q24 9 30 12L34 35Q24 32 14 35Z', '#2b2b38') + pa('M15 29Q24 26 33 29L34 34Q24 31 14 34Z', '#d9363e'),
  };
  return {
    weapon: (id) => svg(weapons[id] || ''),
    tome: (id) => svg(tomes[id] || ''),
    misc: (id) => svg(misc[id] || ''),
    card: (c) => c.kind === 'newWeapon' || c.kind === 'weaponUp' ? svg(weapons[c.id] || '') : c.kind === 'tome' || c.kind === 'blessing' ? svg(tomes[c.id] || '') : svg(misc[c.kind] || ''),
  };
})();
