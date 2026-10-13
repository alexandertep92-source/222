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
  };
  return {
    weapon: (id) => svg(weapons[id] || ''),
    tome: (id) => svg(tomes[id] || ''),
    misc: (id) => svg(misc[id] || ''),
    card: (c) => c.kind === 'newWeapon' || c.kind === 'weaponUp' ? svg(weapons[c.id] || '') : c.kind === 'tome' || c.kind === 'blessing' ? svg(tomes[c.id] || '') : svg(misc[c.kind] || ''),
  };
})();
