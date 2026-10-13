'use strict';
// Rumms! – Menüs, HUD und Dialoge (DOM).

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// Werte für die Balken in der Heldenauswahl (0–5)
const HERO_BARS = {
  knight: { Leben: 5, Tempo: 2, Reichweite: 1, Fläche: 3 },
  archer: { Leben: 2, Tempo: 4, Reichweite: 5, Fläche: 2 },
  mage: { Leben: 1, Tempo: 3, Reichweite: 4, Fläche: 5 },
  ninja: { Leben: 2, Tempo: 5, Reichweite: 3, Fläche: 2 },
  dwarf: { Leben: 4, Tempo: 1, Reichweite: 2, Fläche: 5 },
};

const UI = {
  coarse: false, screen: null, modalStack: [], hud: {}, cache: {}, safe: { l: 0, r: 0 },
  selected: null, bannerT: 0, quitArmed: false,

  init() {
    this.coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    document.body.classList.toggle('coarse', this.coarse);
    this.selected = Settings.char;
    const h = this.hud;
    h.root = $('#hud');
    h.xpFill = $('#xp-fill'); h.lvl = $('#lvl');
    h.hpFill = $('#hp-fill'); h.hpLag = $('#hp-lag'); h.hpText = $('#hp-text');
    h.gold = $('#gold'); h.kills = $('#kills');
    h.timer = $('#timer'); h.timerSub = $('#timer-sub');
    h.weapons = $('#weapons');
    h.boss = $('#bossbar'); h.bossName = $('#boss-name'); h.bossFill = $('#boss-fill');
    h.dash = $('#btn-dash'); h.portrait = $('#hud-portrait'); h.revive = $('#hud-revive');
    h.revive.innerHTML = Icons.misc('revive');
    $('#btn-jump').innerHTML = Icons.misc('jump') + '<span>Sprung</span>';
    $('#btn-dash').innerHTML = Icons.misc('dash') + '<span>Sprint</span>';

    const press = (el, fn, up) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
      if (up) {
        el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up); el.addEventListener('pointerleave', up);
      }
    };
    press($('#btn-jump'), () => { Input.jumpPressed = true; Input.jumpHeld = true; }, () => { Input.jumpHeld = false; });
    press($('#btn-dash'), () => { Input.dashPressed = true; });
    press($('#btn-pause'), () => pauseGame());

    const click = (sel, fn) => $(sel).addEventListener('click', (e) => { Sound.init(); fn(e); });
    click('#btn-play', () => this.showScreen('select'));
    click('#btn-settings', () => this.openModal('settings'));
    click('#btn-help', () => this.openModal('help'));
    click('#btn-shop', () => this.openModal('shop'));
    click('#btn-ach', () => this.openModal('ach'));
    click('#btn-rotate', () => this.cycleRotation());
    click('#btn-back', () => this.showScreen('title'));
    click('#btn-start', () => { this.tryFullscreen(); startRun(this.selected); });
    click('#btn-reroll', () => rerollChoice());
    click('#btn-skip', () => skipChoice());
    click('#btn-resume', () => resumeGame());
    click('#btn-pause-settings', () => this.openModal('settings'));
    click('#btn-quit', () => {
      if (!this.quitArmed) { this.quitArmed = true; $('#btn-quit').textContent = 'Wirklich aufgeben?'; return; }
      this.hidePause();
      endRun(false);
    });
    click('#btn-again', () => { const id = G ? G.char.id : this.selected; this.closeModal('over'); startRun(id); });
    click('#btn-heroes', () => { this.closeModal('over'); quitToMenu(); this.showScreen('select'); });
    click('#btn-menu', () => { this.closeModal('over'); quitToMenu(); });
    document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.closeModal(b.dataset.close)));

    this.buildHeroList();
    this.buildSettings();
    this.refreshTitle();
    this.measureSafe();
    window.addEventListener('resize', () => { this.measureSafe(); this.updateRotateHint(); });
    this.updateRotateHint();
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
  },

  measureSafe() {
    const probe = $('#safe-probe');
    if (!probe) return;
    const cs = getComputedStyle(probe);
    this.safe.l = parseFloat(cs.paddingLeft) || 0;
    this.safe.r = parseFloat(cs.paddingRight) || 0;
  },
  safeLeft() { return this.safe.l; },
  safeRight() { return this.safe.r; },

  // Hochformat-Hinweis bzw. Drehknopf im Titelbild
  updateRotateHint() {
    const realPortrait = window.innerHeight > window.innerWidth * 1.05;
    $('#btn-rotate').hidden = !(this.coarse && realPortrait);
    $('#rotate-hint').hidden = !(this.coarse && realPortrait && View.rot === 0 && App.state === 'title');
  },
  cycleRotation() {
    const order = ['auto', 'ccw', 'off'];
    const cur = Settings.landscape === 'auto' || !Settings.landscape ? 'auto' : Settings.landscape;
    Settings.landscape = order[(order.indexOf(cur) + 1) % order.length];
    saveSettings();
    applyResolution();
    this.syncSettings();
    this.updateRotateHint();
  },

  tryFullscreen() {
    if (!this.coarse) return;
    try {
      const el = document.documentElement;
      const req = el.requestFullscreen || el.webkitRequestFullscreen;
      if (req && !document.fullscreenElement) {
        const pr = req.call(el, { navigationUI: 'hide' });
        if (pr && pr.then) {
          pr.then(() => {
            if (View.rot !== 0) return;
            try { screen.orientation.lock('landscape').catch(() => {}); } catch (_) { /* egal */ }
          }).catch(() => {});
        }
      }
    } catch (_) { /* Vollbild nicht erlaubt */ }
  },

  // Kurzer Übergang (Kreis-Blende) beim Rundenstart
  wipe() {
    const w = $('#wipe');
    w.classList.remove('go'); void w.offsetWidth; w.classList.add('go');
    clearTimeout(this.wipeT);
    this.wipeT = setTimeout(() => w.classList.remove('go'), 900);
  },

  showScreen(name) {
    document.querySelectorAll('.screen').forEach((s) => { s.hidden = s.id !== `scr-${name}`; });
    this.screen = name;
    if (name === 'title') this.refreshTitle();
    if (name === 'title' || name === 'select') {
      App.state = name;
      showPreview();
      if (name === 'select') this.showHero(this.selected);
    }
    this.updateRotateHint();
  },

  openModal(name) {
    $('#banner').classList.remove('show');
    this.bannerT = 0;
    const m = $(`#modal-${name}`);
    m.hidden = false;
    if (!this.modalStack.includes(name)) this.modalStack.push(name);
    if (name === 'settings') this.syncSettings();
    if (name === 'shop') this.showShop();
    if (name === 'ach') this.showAch();
  },
  closeModal(name) {
    $(`#modal-${name}`).hidden = true;
    this.modalStack = this.modalStack.filter((n) => n !== name);
  },
  back() {
    const top = this.modalStack[this.modalStack.length - 1];
    if (top && top !== 'choice' && top !== 'over' && top !== 'pause') { this.closeModal(top); return true; }
    if (this.screen === 'select' && !G) { this.showScreen('title'); return true; }
    return false;
  },

  portraitImg(id, cls = '') {
    const src = Portraits[id];
    return src ? `<img class="portrait ${cls}" src="${src}" alt="">` : `<span class="portrait ${cls}">${CHARACTERS.find((c) => c.id === id).icon}</span>`;
  },

  // ---------- Heldenauswahl ----------
  buildHeroList() {
    const list = $('#hero-list');
    list.innerHTML = '';
    for (const c of CHARACTERS) {
      const b = document.createElement('button');
      b.className = 'hero-chip';
      b.dataset.id = c.id;
      b.style.setProperty('--hero', c.color);
      b.innerHTML = `${this.portraitImg(c.id)}<span class="hero-chip-name">${esc(c.name)}</span><span class="hero-chip-role">${esc(c.title)}</span>`;
      b.addEventListener('click', () => { Sound.init(); Sound.pick(); this.showHero(c.id); });
      list.appendChild(b);
    }
  },
  showHero(id) {
    const c = CHARACTERS.find((x) => x.id === id) || CHARACTERS[0];
    this.selected = c.id;
    Settings.char = c.id; saveSettings();
    document.querySelectorAll('.hero-chip').forEach((b) => b.classList.toggle('active', b.dataset.id === c.id));
    const rec = Store.get(RECORDS_KEY, {})[c.id];
    const recText = rec ? (rec.wins ? `${rec.wins}× gewonnen · Bestzeit ${fmtTime(rec.bestWin || CONFIG.ROUND_SECONDS)} · Stufe ${rec.level}` : `Längste Runde ${fmtTime(rec.best)} · Stufe ${rec.level}`) : 'Noch nicht gespielt';
    const weapons = c.weapons.map((wid, i) => {
      const w = WEAPONS[wid];
      return `<li><span class="wicon">${Icons.weapon(wid)}</span><span><b>${esc(w.name)}</b>${i === 0 ? ' <em>Start</em>' : ''}<small>${esc(w.desc)}</small></span></li>`;
    }).join('');
    const bars = Object.entries(HERO_BARS[c.id]).map(([k, v]) => `<div class="bar"><span>${k}</span><i style="--v:${v / 5}"></i></div>`).join('');
    const hats = this.hatList(), hat = Profile.hats[c.id] || 'none';
    const hatText = hats.length > 1 ? `Hut: ${hat === 'none' ? 'ohne' : HATS[hat].name}` : 'Hüte: über Erfolge';
    const nm = nightmareUnlocked() ? `<button id="btn-nm" class="btn ghost small nm${Profile.nightmare ? ' on' : ''}">Albtraum: ${Profile.nightmare ? 'an' : 'aus'}</button>` : '';
    const d = $('#hero-detail');
    d.style.setProperty('--hero', c.color);
    d.innerHTML = `
      <div class="hd-head"><h2>${esc(c.title)} ${esc(c.name)}</h2><span class="tag">${esc(c.difficulty)}</span></div>
      <p class="hd-desc">${esc(c.desc)}</p>
      <div class="bars">${bars}</div>
      <p class="hd-passive"><span class="label">Passiv</span> ${esc(c.passive)}</p>
      <ul class="hd-weapons">${weapons}</ul>
      <div class="hd-extra"><button id="btn-hat" class="btn ghost small"${hats.length > 1 ? '' : ' disabled'}>${Icons.misc('hat')}${esc(hatText)}</button>${nm}</div>
      <p class="hd-record"><span class="label">Rekord</span> ${esc(recText)}</p>`;
    d.classList.remove('swap'); void d.offsetWidth; d.classList.add('swap');
    $('#btn-hat').addEventListener('click', () => this.cycleHat(c.id));
    if (nm) $('#btn-nm').addEventListener('click', () => { Profile.nightmare = !Profile.nightmare; saveProfile(); Sound.pick(); this.showHero(c.id); });
    const nmOn = Profile.nightmare && nightmareUnlocked();
    $('#btn-start').textContent = nmOn ? 'Los geht\'s – Albtraum' : 'Los geht\'s';
    $('#btn-start').classList.toggle('nightmare', nmOn);
  },
  hatList() { return ['none', ...Object.keys(HATS).filter(hatUnlocked)]; },
  cycleHat(id) {
    const list = this.hatList();
    if (list.length < 2) return;
    const cur = Profile.hats[id] || 'none';
    const next = list[(list.indexOf(cur) + 1) % list.length];
    Profile.hats[id] = next; saveProfile();
    if (Menu.heroes[id]) attachHat(Menu.heroes[id], id, next);
    renderPortraits([id]);
    this.buildHeroList();
    this.showHero(id);
    Sound.pick();
  },

  // ---------- Werkstatt und Erfolge ----------
  refreshTitle() {
    $('#title-stars').innerHTML = `${Icons.misc('star')}${Profile.stars}`;
    $('#title-ach').textContent = `${ACHIEVEMENTS.filter((a) => Profile.ach[a.id]).length}/${ACHIEVEMENTS.length}`;
  },
  showShop() {
    $('#shop-stars').innerHTML = `${Icons.misc('star')}${Profile.stars}`;
    const list = $('#shop-list');
    list.innerHTML = SHOP.map((it) => {
      const lvl = Profile.shop[it.id] || 0, max = it.cost.length, cost = it.cost[lvl];
      const pips = Array.from({ length: max }, (_, i) => `<i class="${i < lvl ? 'on' : ''}"></i>`).join('');
      const btn = lvl >= max ? '<span class="maxed">Max.</span>'
        : `<button class="btn small buy" data-id="${it.id}"${Profile.stars < cost ? ' disabled' : ''}>${Icons.misc('star')}${cost}</button>`;
      return `<div class="shop-item${lvl >= max ? ' done' : ''}"><span class="wicon">${Icons[it.icon[0]](it.icon[1])}</span>`
        + `<div class="si-text"><b>${esc(it.name)}</b><small>${esc(it.desc)}${max > 1 ? ' pro Stufe' : ''}</small><span class="pips">${pips}</span></div>${btn}</div>`;
    }).join('');
    list.querySelectorAll('.buy').forEach((b) => b.addEventListener('click', () => this.buy(b.dataset.id)));
  },
  buy(id) {
    const it = SHOP.find((x) => x.id === id), lvl = Profile.shop[id] || 0, cost = it.cost[lvl];
    if (cost === undefined || Profile.stars < cost) return;
    Profile.stars -= cost; Profile.shop[id] = lvl + 1;
    saveProfile();
    Sound.chest(); vibrate(30);
    this.showShop(); this.refreshTitle();
  },
  showAch() {
    const rec = Store.get(RECORDS_KEY, {});
    const done = ACHIEVEMENTS.filter((a) => Profile.ach[a.id]).length;
    $('#ach-count').textContent = `${done} / ${ACHIEVEMENTS.length}`;
    $('#ach-list').innerHTML = ACHIEVEMENTS.map((a) => {
      const ok = !!Profile.ach[a.id];
      let prog = '';
      if (!ok && a.progress) {
        const [cur, max] = a.progress(Profile, rec);
        prog = `<span class="prog"><i style="--v:${Math.min(1, cur / max)}"></i><em>${Math.min(cur, max)} / ${max}</em></span>`;
      }
      const reward = [`${a.stars} Sterne`, a.hat ? `Hut: ${HATS[a.hat].name}` : '', a.extra || ''].filter(Boolean).join(' · ');
      return `<div class="ach${ok ? ' done' : ''}"><span class="ach-icon">${Icons.misc(ok ? 'check' : 'lock')}</span>`
        + `<div class="ach-text"><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>${prog}</div><span class="ach-reward">${esc(reward)}</span></div>`;
    }).join('');
  },

  // ---------- Einstellungen ----------
  buildSettings() {
    $('#set-quality').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      Settings.quality = b.dataset.q; saveSettings(); applyResolution(); this.syncSettings();
    }));
    $('#set-landscape').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      Settings.landscape = b.dataset.l; saveSettings(); applyResolution(); this.syncSettings(); this.updateRotateHint();
    }));
    for (const key of ['music', 'sfx', 'vibrate', 'numbers', 'autoCam']) {
      const el = $(`#set-${key}`);
      el.addEventListener('change', () => { Settings[key] = el.checked; saveSettings(); Sound.applySettings(); });
    }
    const sens = $('#set-sens');
    sens.addEventListener('input', () => { Settings.sensitivity = parseFloat(sens.value); saveSettings(); $('#sens-val').textContent = `${Math.round(Settings.sensitivity * 100)} %`; });
  },
  syncSettings() {
    $('#set-quality').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.q === Settings.quality));
    $('#set-landscape').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.l === (Settings.landscape || 'auto')));
    for (const key of ['music', 'sfx', 'vibrate', 'numbers', 'autoCam']) $(`#set-${key}`).checked = !!Settings[key];
    $('#set-sens').value = Settings.sensitivity;
    $('#sens-val').textContent = `${Math.round(Settings.sensitivity * 100)} %`;
  },

  // ---------- HUD ----------
  showHud(on) {
    this.hud.root.hidden = !on;
    document.querySelectorAll('.screen').forEach((s) => { s.hidden = true; });
    this.screen = null;
    this.cache = {};
    if (on && G) this.hud.portrait.innerHTML = this.portraitImg(G.char.id);
    if (!on) { this.hud.boss.hidden = true; }
    this.updateRotateHint();
  },
  set(key, el, value, fn) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    fn(el, value);
  },
  updateHud(dt) {
    const h = this.hud, p = G.player, s = G.stats;
    this.set('xp', h.xpFill, Math.round((G.xp / G.xpNeed) * 400) / 4, (el, v) => { el.style.width = `${v}%`; });
    this.set('lvl', h.lvl, G.level, (el, v) => {
      el.textContent = v;
      el.classList.remove('up'); void el.offsetWidth; el.classList.add('up');
    });
    const max = Math.round(s.maxHp), hp = Math.min(max, Math.ceil(p.hp));
    this.set('hp', h.hpFill, `${hp}/${max}`, (el) => {
      const w = `${clamp(hp / max, 0, 1) * 100}%`;
      el.style.width = w; h.hpLag.style.width = w;
      h.hpText.textContent = `${hp} / ${max}`;
      el.parentElement.classList.toggle('low', hp / max < 0.3);
    });
    this.set('gold', h.gold, Math.floor(G.gold), (el, v) => { el.textContent = v; });
    this.set('kills', h.kills, G.kills, (el, v) => { el.textContent = fmtNum(v); });
    this.set('rev', h.revive, G.revives, (el, v) => { el.hidden = !v; });
    const left = CONFIG.ROUND_SECONDS - G.time;
    const final = left <= 0;
    this.set('timer', h.timer, final ? `+${fmtTime(-left)}` : fmtTime(Math.ceil(left)), (el, v) => { el.textContent = v; el.classList.toggle('final', final); el.classList.toggle('soon', !final && left < 60); });
    let sub;
    if (final) sub = G.bosses.some((b) => b.def.final && b.alive) ? 'Endboss!' : '';
    else {
      const mb = CONFIG.MINI_BOSSES[G.miniIdx];
      sub = mb && mb.t - G.time < 30 ? `Zwischenboss in ${Math.ceil(mb.t - G.time)} s` : G.nightmare ? 'Albtraum · bis zum Endboss' : 'bis zum Endboss';
    }
    this.set('tsub', h.timerSub, sub, (el, v) => { el.textContent = v; });
    const b = G.bossBar;
    this.set('bossOn', h.boss, !!(b && b.alive), (el, v) => { el.hidden = !v; if (v) h.bossName.textContent = b.def.name; });
    if (b && b.alive) this.set('bossHp', h.bossFill, Math.round((b.hp / b.maxHp) * 1000), (el, v) => { el.style.width = `${Math.max(0, v / 10)}%`; });
    const cd = clamp(p.dashCd / DASH_CD, 0, 1);
    this.set('dash', h.dash, Math.round(cd * 40), (el, v) => { el.style.setProperty('--cd', v / 40); el.classList.toggle('cooling', v > 0); });
    for (const w of G.weapons) this.set(`w${w.slot}`, null, w.level, () => { const el = $(`#wslot-${w.slot} .wlvl`); if (el) el.textContent = w.level; });
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) $('#banner').classList.remove('show');
    }
  },
  rebuildWeapons() {
    if (!G) return;
    const el = this.hud.weapons;
    el.innerHTML = '';
    for (let i = 0; i < CONFIG.MAX_WEAPONS; i++) {
      const w = G.weapons[i];
      const d = document.createElement('div');
      d.className = 'wslot' + (w ? '' : ' empty');
      d.id = `wslot-${i}`;
      d.innerHTML = w ? `${Icons.weapon(w.id)}<b class="wlvl">${w.level}</b>` : '';
      el.appendChild(d);
    }
    for (const k of Object.keys(this.cache)) if (k[0] === 'w') delete this.cache[k];
  },
  banner(title, sub, dur) {
    const b = $('#banner');
    b.innerHTML = `<strong>${esc(title)}</strong>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    this.bannerT = dur;
  },
  hurtFlash() {
    const v = $('#vignette');
    v.classList.remove('hit');
    void v.offsetWidth;
    v.classList.add('hit');
  },

  // ---------- Kartenwahl ----------
  showChoice(choice) {
    const titles = {
      level: [`Stufe ${G.level - G.pendingLevels + 1}!`, 'Wähle eine Verbesserung'],
      chest: ['Truhe geöffnet!', 'Wähle deine Belohnung'],
      shrine: ['Schrein aktiviert!', 'Wähle einen Segen'],
    };
    const [t, s] = titles[choice.source];
    $('#choice-title').textContent = t;
    $('#choice-sub').textContent = s;
    $('#modal-choice').dataset.source = choice.source;
    const box = $('#choice-cards');
    box.innerHTML = '';
    choice.cards.forEach((c, i) => {
      const r = c.rarity >= 0 ? RARITIES[c.rarity] : null;
      const b = document.createElement('button');
      b.className = 'card' + (c.kind === 'newWeapon' ? ' new' : '') + (c.rarity >= 3 ? ' shiny' : '');
      b.style.setProperty('--rar', r ? r.color : '#ffcf33');
      b.innerHTML = `
        <span class="card-rar">${r ? esc(r.name) : 'Neue Waffe'}</span>
        <span class="card-icon">${Icons.card(c)}</span>
        <span class="card-title">${esc(c.title)}</span>
        <span class="card-sub">${esc(c.sub)}</span>
        <span class="card-desc">${esc(c.desc)}</span>`;
      b.style.animationDelay = `${i * 70}ms`;
      b.addEventListener('click', () => chooseCard(i));
      box.appendChild(b);
    });
    const rr = $('#btn-reroll');
    rr.textContent = `Neu würfeln (${G.rerolls})`;
    rr.disabled = G.rerolls <= 0;
    $('#btn-skip').textContent = 'Überspringen (+8 Gold)';
    this.openModal('choice');
  },
  hideChoice() { this.closeModal('choice'); },

  // ---------- Pause ----------
  showPause() {
    this.quitArmed = false;
    $('#btn-quit').textContent = 'Aufgeben';
    $('#pause-info').textContent = `${G.char.title} ${G.char.name} · ${fmtTime(G.time)} · Stufe ${G.level} · ${fmtNum(G.kills)} besiegt`;
    $('#pause-weapons').innerHTML = this.weaponRows();
    const tomes = Object.keys(G.tomes).map((id) => `<span class="tome" title="${esc(TOMES[id].name)}">${Icons.tome(id)}<b>${G.tomes[id]}</b></span>`).join('');
    $('#pause-tomes').innerHTML = tomes || '<span class="muted">Noch keine Bücher</span>';
    const s = G.stats;
    const stats = [
      ['Schaden', `${Math.round(s.damage * 100)} %`], ['Angriffstempo', `${Math.round(s.attackSpeed * 100)} %`],
      ['Fläche', `${Math.round(s.area * 100)} %`], ['Krit', fmtPct(s.crit)], ['Rüstung', fmtPct(s.armor)],
      ['Ausweichen', fmtPct(s.evasion)], ['Tempo', s.speed.toFixed(1).replace('.', ',')], ['Glück', fmtPct(s.luck)],
    ];
    $('#pause-stats').innerHTML = stats.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    this.openModal('pause');
  },
  hidePause() { this.closeModal('pause'); },
  weaponRows() {
    return G.weapons.map((w) => `<tr><td class="wicon">${Icons.weapon(w.id)}</td><td>${esc(w.def.name)}<small>Stufe ${w.level}</small></td><td class="num">${fmtNum(w.dmg)}</td><td class="num">${fmtNum(w.kills)}</td></tr>`).join('');
  },

  // ---------- Rundenende ----------
  showGameOver() {
    const win = G.victory;
    $('#over-title').textContent = win ? 'Sieg!' : 'Besiegt!';
    $('#over-title').classList.toggle('win', win);
    $('#over-hero').innerHTML = this.portraitImg(G.char.id, 'big');
    $('#over-sub').textContent = win
      ? `${G.char.title} ${G.char.name} hat den Großen Rummser bezwungen.`
      : G.time >= CONFIG.ROUND_SECONDS ? 'So knapp! Der Endboss war zu stark.' : `Durchgehalten: ${fmtTime(G.time)} von ${fmtTime(CONFIG.ROUND_SECONDS)}`;
    $('#over-best').hidden = !G.newBest;
    let rw = `<div class="reward stars">${Icons.misc('star')}<b>+${G.starsEarned}</b><span>Sterne${G.nightmare ? ' (Albtraum ×1,5)' : ''}</span></div>`;
    for (const a of G.newAch) {
      const extra = [`+${a.stars} Sterne`, a.hat ? `neuer Hut: ${HATS[a.hat].name}` : '', a.extra ? `${a.extra} freigeschaltet` : ''].filter(Boolean).join(' · ');
      rw += `<div class="reward ach">${Icons.misc('check')}<b>${esc(a.name)}</b><span>${esc(extra)}</span></div>`;
    }
    $('#over-rewards').innerHTML = rw;
    const stats = [
      ['Zeit', fmtTime(G.time)], ['Stufe', G.level], ['Besiegt', fmtNum(G.kills)],
      ['Schaden', fmtNum(G.totalDamage)], ['Gold', fmtNum(G.goldEarned)], ['Bosse', G.bossesKilled],
    ];
    $('#over-stats').innerHTML = stats.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
    $('#over-weapons').innerHTML = this.weaponRows();
    this.openModal('over');
  },
};
