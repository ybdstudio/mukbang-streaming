'use strict';
// Game state machine. Platform-agnostic: it talks to `platform` (canvas,
// touches, time, vibration, audio context, offscreen canvases) and to `hs`
// (the HS kit wrapper from the entry file). All progress lives in the HS
// profile — this file never touches storage.
const U = require('./util.js');
const D = require('./data.js');
const A = require('./art.js');
const UIM = require('./ui.js');
const AU = require('./audio.js');
const C = D.COLORS;

const DESIGN_W = 540;
const REACTIONS = ['heart', 'like', 'star', 'laugh', 'love', 'cool', 'smile'];
const AD_FREE_LEVELS = 3;        // Q4a: interstitials start after level 3
const BITE_GAP = 0.72;           // seconds between bites while the food is held at the mouth
const MOUTH_RADIUS = 92;

class Game {
  constructor(platform, hs) {
    this.p = platform; this.hs = hs; this.profile = hs.profile;
    this.ctx = platform.ctx; this.ui = new UIM.UI(this.ctx);
    this.audio = new AU.Audio(platform.createAudioContext);
    this.W = DESIGN_W; this.H = 960; this.scale = 1;
    this.state = 'home'; this.prevState = 'home'; this.frozen = false; this.lastT = 0; this.time = 0;
    this.toast = null; this.popup = null; this.hsReady = false; this.adBusy = false;
    this.shopItems = null; this.shopLoading = false;
    this.market = null; this.checkout = null; this.run = null; this.drag = null; this.result = null;
    this.floats = []; this.reactions = []; this.confetti = []; this.chat = []; this.flies = [];
    this.face = { expr: 'idle', until: 0, blink: false, blinkT: 2.5, t: 0 };
    this.levelPage = 0; this.sessionLevels = 0;
    this.resize();
    const self = this;
    platform.onResize(function () { self.resize(); });
    platform.onTouch(this.onTouch.bind(this));
    this.audio.setMuted(!this.profile.get('sound'));
    this.restoreRun();
  }
  // ── plumbing ──
  resize() { const p = this.p; this.scale = p.width() * p.dpr() / DESIGN_W; this.W = DESIGN_W; this.H = Math.round(p.height() / p.width() * DESIGN_W); this.ui.W = this.W; this.ui.H = this.H; }
  freeze(on) { this.frozen = on; if (on) { this.audio.suspend(); this.ui.clearTouches(); this.drag = null; } else this.audio.resume(); }
  onGiven(items, from) { this.showToast(this.itemsText(items), from === 'share' ? 'Thanks for sharing!' : ''); if (this.state === 'popup') { this.popup = null; this.setState('home'); } }
  itemsText(items) { const parts = []; for (const k in items) { if (k.charAt(0) === '$') continue; const it = this.hs.item(k); parts.push('+' + U.fmtCoins(items[k]) + ' ' + (it && it.name ? it.name : k)); } return parts.join('  '); }
  showToast(text, sub) { if (!text) return; this.toast = { text: text, sub: sub || '', life: 0 }; }
  setState(s) { this.prevState = this.state; this.state = s; this.ui.clearTouches(); this.drag = null; }
  vibrate(kind) { this.p.vibrate(kind); }
  top() { return this.p.safeTop() * (this.W / this.p.width()) + 10; }
  bottom() { return this.H - this.p.safeBottom() * (this.W / this.p.width()); }
  streamerDef() { return D.STREAMERS[U.clamp(this.profile.get('streamer') || 0, 0, D.STREAMERS.length - 1)]; }
  curLevel() { return U.clamp(this.profile.get('level') || 1, 1, D.LEVEL_COUNT); }
  stars() { try { return JSON.parse(this.profile.get('stars_json') || '{}'); } catch (e) { return {}; } }
  // ── the run (a level in progress) persists in the profile so a closed app resumes the stream ──
  saveRun() {
    if (!this.run) { this.profile.set('run_json', ''); return; }
    const items = []; for (let i = 0; i < this.run.items.length; i++) { const it = this.run.items[i]; items.push({ id: it.id, eaten: it.eaten, done: !!it.done }); }
    this.profile.set('run_json', JSON.stringify({ level: this.run.level, items: items, viewers: Math.round(this.run.viewers), peak: Math.round(this.run.peak), coins: this.run.coins, ms: this.run.ms }));
  }
  restoreRun() {
    try {
      const r = JSON.parse(this.profile.get('run_json') || 'null');
      if (r && r.items && r.items.length) { const lv = D.level(r.level); this.run = { level: lv.n, lv: lv, items: r.items, viewers: r.viewers || lv.startViewers, peak: r.peak || r.viewers || lv.startViewers, coins: r.coins || 0, ms: r.ms || 0, t: 0, endT: -1, chatT: 1, reactT: 0 }; }
    } catch (e) { this.run = null; }
  }
  // ── level flow ──
  startLevel(n) {
    const lv = D.level(n);
    this.market = { lv: lv, cat: 0, basket: [], shake: 0 };
    this.flies.length = 0; this.sessionLevels++;
    this.setState('market');
  }
  marketTotal() { let t = 0; for (let i = 0; i < this.market.basket.length; i++) t += D.priceOf(D.FOOD_BY_ID[this.market.basket[i]]); return t; }
  beginCheckout() {
    const m = this.market; const items = [];
    for (let i = 0; i < m.basket.length; i++) items.push({ id: m.basket[i], scanned: false, x: 0, y: 0, hx: 0, hy: 0, fly: null });
    this.checkout = { lv: m.lv, items: items, receipt: [], total: 0, done: false, thankT: 0, flash: 0 };
    this.layoutCheckout();
    this.setState('checkout');
  }
  layoutCheckout() {
    const c = this.checkout, W = this.W; const n = c.items.length;
    const y = this.machineRect().y + this.machineRect().h + 70;
    for (let i = 0; i < n; i++) { const it = c.items[i]; it.hx = W * (n === 1 ? 0.5 : 0.14 + 0.72 * i / (n - 1)); it.hy = y + (i % 2) * 26; if (!it.scanned && !it.fly) { it.x = it.hx; it.y = it.hy; } }
  }
  machineRect() { const top = this.top(); return { x: this.W * 0.1, y: top + 118, w: this.W * 0.8, h: Math.min(460, this.H * 0.4) }; }
  scanItem(it) {
    const c = this.checkout; if (it.scanned) return;
    it.scanned = true; const f = D.FOOD_BY_ID[it.id]; const price = D.priceOf(f);
    c.receipt.push({ name: f.name, price: price }); c.total += price; c.flash = 1;
    this.audio.play('beep'); this.vibrate('short');
    const r = this.machineRect(); this.spawnSparkles(r.x + r.w / 2, r.y + r.h * 0.84, 10);
    let left = 0; for (let i = 0; i < c.items.length; i++) if (!c.items[i].scanned) left++;
    if (!left) {
      c.done = true; c.thankT = 0; this.audio.play('cash');
      this.profile.add('coins', -c.total);
      const items = []; for (let i = 0; i < c.items.length; i++) items.push({ id: c.items[i].id, eaten: 0 });
      const lv = c.lv;
      this.run = { level: lv.n, lv: lv, items: items, viewers: lv.startViewers, peak: lv.startViewers, coins: 0, ms: 0, t: 0, endT: -1, chatT: 1.2, reactT: 0 };
      this.saveRun();
    }
  }
  beginStream() {
    const r = this.run; r.lv = D.level(r.level); r.t = 0; r.endT = -1; r.chatT = 1.0; r.reactT = 0;
    for (let i = 0; i < r.items.length; i++) { const it = r.items[i]; it.drag = false; it.x = it.y = undefined; }
    this.reactions.length = 0; this.chat.length = 0; this.floats.length = 0; this.confetti.length = 0;
    this.face = { expr: 'idle', until: 0, blink: false, blinkT: 2, t: 0 };
    this.layoutStream();
    this.pushChat('idle');
    this.setState('stream');
  }
  layoutStream() {
    const r = this.run, W = this.W, H = this.H, n = r.items.length;
    const rows = n <= 3 ? [[0, 1, 2].slice(0, n)] : [[0, 1, 2], [3, 4, 5].slice(0, n - 3)];
    const y1 = H * 0.615, y2 = H * 0.78;
    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri]; const cnt = row.length;
      for (let k = 0; k < cnt; k++) { const it = r.items[row[k]]; if (!it) continue; const xs = cnt === 1 ? [0.5] : cnt === 2 ? [0.34, 0.66] : [0.26, 0.5, 0.74]; it.hx = W * xs[k]; it.hy = ri === 0 ? y1 : y2; if (!it.drag || it.x === undefined) { it.x = it.hx; it.y = it.hy; } }
    }
  }
  headPos() { return { x: this.W / 2, y: this.H * 0.305, s: Math.min(1, this.H / 1000) }; }
  mouth() { const h = this.headPos(); return A.mouthPos(h.x, h.y, h.s, this.face.bob || 0); }
  bite(it) {
    const r = this.run, f = D.FOOD_BY_ID[it.id], cat = D.CAT_BY_ID[f.cat], taste = D.TASTES[f.taste];
    it.eaten++;
    const hype = Math.round(D.hypePerBite(f) * (0.85 + Math.random() * 0.3));
    const coins = D.coinsPerBite(f);
    r.viewers += hype; r.peak = Math.max(r.peak, r.viewers); r.coins += coins;
    this.profile.add('coins', coins);
    this.setFace(taste.face, 0.8);
    this.audio.play(cat.sound, { rate: 0.9 + Math.random() * 0.25 });
    if (f.taste === 'spicy') this.audio.play('fire'); else if (f.taste === 'cold') this.audio.play('shiver'); else if (f.taste === 'fizzy') this.audio.play('fizz'); else if (f.taste === 'sour') this.audio.play('sour'); else if (f.taste === 'sweet') this.audio.play('sweet', { gain: 0.6 });
    this.vibrate('short');
    const m = this.mouth();
    this.floatText('+' + U.fmtViewers(hype), m.x + 70, m.y - 30, C.white, 20);
    this.floatText('+' + coins, m.x - 80, m.y - 40, C.gold, 18, true);
    for (let i = 0; i < 6; i++) this.spawnReaction();
    if (Math.random() < 0.6) this.pushChat(Math.random() < 0.5 ? f.taste : 'bite');
    this.checkMilestones();
    if (it.eaten >= cat.bites) {
      it.done = true; this.drag = null;
      this.spawnSparkles(it.x, it.y, 14); this.floatText('Yum!', it.x, it.y - 40, C.pink, 26);
      this.audio.play('pop'); this.pushChat('finish');
      let left = 0; for (let i = 0; i < r.items.length; i++) if (!r.items[i].done) left++;
      if (!left) { r.endT = 0; this.setFace('yum', 9); this.audio.play('win'); this.spawnConfetti(this.W / 2, this.H * 0.4, 50); }
    }
    this.saveRun();
  }
  checkMilestones() {
    const r = this.run;
    while (r.ms < D.MILESTONES.length && r.viewers >= D.MILESTONES[r.ms]) {
      const m = D.MILESTONES[r.ms]; r.ms++;
      const tip = Math.round(m / 20); r.coins += tip; this.profile.add('coins', tip);
      this.floatText(U.fmtViewers(m) + ' VIEWERS!', this.W / 2, this.H * 0.47, C.gold, 34, true);
      this.floatText('tips +' + tip, this.W / 2, this.H * 0.47 + 36, C.white, 20);
      this.audio.play('ding'); this.spawnConfetti(this.W / 2, this.H * 0.45, 30);
      this.pushChat('milestone', U.fmtViewers(m));
    }
  }
  setFace(expr, dur) { this.face.expr = expr; this.face.until = this.time + dur; this.face.t = 0; }
  finishRun() {
    const r = this.run, p = this.profile, lv = r.lv;
    const stars = r.peak >= lv.goal3 ? 3 : r.peak >= lv.goal ? 2 : 1;
    const st = this.stars(); const before = st[lv.n] || 0; if (stars > before) st[lv.n] = stars; p.set('stars_json', JSON.stringify(st));
    p.add('streams', 1);
    if (r.peak > (p.get('best_viewers') || 0)) p.set('best_viewers', Math.round(r.peak));
    const firstClear = lv.n > (p.get('levels_done') || 0);
    if (firstClear) { p.set('levels_done', lv.n); this.hs.claimLevelBonus(); }
    if (lv.n >= (p.get('level') || 1)) p.set('level', Math.min(D.LEVEL_COUNT, lv.n + 1));
    if ((p.get('streams') || 0) === 1) this.hs.claimFirstStream();
    const unlocks = [];
    if (firstClear && lv.n < D.LEVEL_COUNT) { const sh = D.newShelfAt(lv.n + 1); if (sh) unlocks.push('NEW SHELF: ' + sh.name); for (let i = 0; i < D.STREAMERS.length; i++) if (D.STREAMERS[i].unlock === lv.n + 1) unlocks.push('NEW STREAMER: ' + D.STREAMERS[i].name.toUpperCase()); }
    this.result = { lv: lv, stars: stars, peak: Math.round(r.peak), coins: r.coins, firstClear: firstClear, unlocks: unlocks, bonusTaken: false, t: 0 };
    this.run = null; this.saveRun();
    if (unlocks.length) this.audio.play('levelup');
    this.setState('result');
  }
  // ── effects ──
  floatText(str, x, y, color, size, big) { this.floats.push({ str: str, x: x, y: y, color: color, size: size || 20, life: 0, max: big ? 1.6 : 1.1, big: !!big }); if (this.floats.length > 12) this.floats.shift(); }
  spawnReaction() { const left = Math.random() < 0.5; const x = left ? this.W * (0.05 + Math.random() * 0.14) : this.W * (0.8 + Math.random() * 0.15); this.reactions.push({ kind: REACTIONS[Math.floor(Math.random() * REACTIONS.length)], x: x, y: this.H * (0.55 + Math.random() * 0.25), vy: 70 + Math.random() * 60, sway: Math.random() * 6, life: 0, max: 2.2 + Math.random(), s: 12 + Math.random() * 8 }); if (this.reactions.length > 40) this.reactions.shift(); }
  spawnSparkles(x, y, n) { for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 120; this.confetti.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0, max: 0.5 + Math.random() * 0.3, color: ['#fff', C.gold, C.pink][i % 3], r: 3 + Math.random() * 3, spark: true }); } }
  spawnConfetti(x, y, n) { const cols = [C.pink, C.gold, C.mint, C.blue, C.lavender, '#fff']; for (let i = 0; i < n; i++) this.confetti.push({ x: x + (Math.random() - 0.5) * 120, y: y, vx: (Math.random() - 0.5) * 300, vy: -150 - Math.random() * 250, life: 0, max: 1.4 + Math.random() * 0.8, color: cols[i % cols.length], r: 5 + Math.random() * 4, rot: Math.random() * 6, spin: (Math.random() - 0.5) * 10 }); }
  pushChat(kind, arg) {
    const pool = D.CHAT[kind] || D.CHAT.idle; let txt = pool[Math.floor(Math.random() * pool.length)]; if (arg) txt = txt.replace('{n}', arg);
    this.chat.push({ avatar: D.AVATARS[Math.floor(Math.random() * D.AVATARS.length)], text: txt, life: 0 }); if (this.chat.length > 4) this.chat.shift();
    this.audio.play('blip', { gain: 0.5, minGap: 0.3 });
  }
  // ── main loop ──
  frame(now) {
    if (this.p.poll) this.p.poll();
    const dt = Math.min(0.05, Math.max(0.001, (now - (this.lastT || now)) / 1000)); this.lastT = now;
    this.ui.begin(dt);
    if (!this.frozen) this.update(dt);
    this.draw(dt);
  }
  update(dt) {
    this.time += dt;
    if (this.toast) { this.toast.life += dt; if (this.toast.life > 2.6) this.toast = null; }
    for (let i = this.floats.length - 1; i >= 0; i--) { const f = this.floats[i]; f.life += dt; f.y -= dt * (f.big ? 10 : 45); if (f.life > f.max) this.floats.splice(i, 1); }
    for (let i = this.reactions.length - 1; i >= 0; i--) { const r = this.reactions[i]; r.life += dt; r.y -= r.vy * dt; if (r.life > r.max) this.reactions.splice(i, 1); }
    for (let i = this.confetti.length - 1; i >= 0; i--) { const c = this.confetti[i]; c.life += dt; c.vy += (c.spark ? 300 : 500) * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vx *= 1 - 1.5 * dt; if (c.rot !== undefined) c.rot += c.spin * dt; if (c.life > c.max) this.confetti.splice(i, 1); }
    for (let i = this.chat.length - 1; i >= 0; i--) this.chat[i].life += dt;
    // face: blink + expression timeout
    const fc = this.face; fc.t += dt; fc.bob = Math.sin(this.time * 1.6) * 4;
    if (fc.until && this.time > fc.until && fc.expr !== 'open') { fc.expr = 'idle'; fc.until = 0; }
    fc.blinkT -= dt; if (fc.blinkT < 0) { fc.blink = !fc.blink; fc.blinkT = fc.blink ? 0.12 : 2 + Math.random() * 3; }
    if (this.state === 'market') this.updateMarket(dt);
    else if (this.state === 'checkout') this.updateCheckout(dt);
    else if (this.state === 'stream') this.updateStream(dt);
    else if (this.state === 'result') this.result.t += dt;
    else if (this.state === 'home') { if (Math.random() < dt * 0.8) this.spawnReaction(); }
  }
  updateMarket(dt) {
    const m = this.market; m.shake = Math.max(0, m.shake - dt * 4);
    for (let i = this.flies.length - 1; i >= 0; i--) { const f = this.flies[i]; f.t += dt * 2.2; if (f.t >= 1) { this.flies.splice(i, 1); this.audio.play('drop'); } }
  }
  updateCheckout(dt) {
    const c = this.checkout; c.flash = Math.max(0, c.flash - dt * 3);
    for (let i = 0; i < c.items.length; i++) { const it = c.items[i]; if (it.fly) { it.fly.t += dt * 2.5; const k = U.easeInOut(it.fly.t); it.x = U.lerp(it.fly.x0, it.fly.x1, k); it.y = U.lerp(it.fly.y0, it.fly.y1, k) - Math.sin(k * Math.PI) * 60; if (it.fly.t >= 1) { it.fly = null; this.scanItem(it); } } else if (this.drag && this.drag.item === it) { /* follows the finger */ } else if (!it.scanned) { it.x = U.damp(it.x, it.hx, 12, dt); it.y = U.damp(it.y, it.hy, 12, dt); } }
    if (c.done) { c.thankT += dt; if (c.thankT > 1.6) this.beginStream(); }
  }
  updateStream(dt) {
    const r = this.run; r.t += dt;
    // items drift home when not held
    for (let i = 0; i < r.items.length; i++) { const it = r.items[i]; if (it.done) continue; if (this.drag && this.drag.item === it) continue; it.x = U.damp(it.x, it.hx, 14, dt); it.y = U.damp(it.y, it.hy, 14, dt); }
    // feeding: held at the mouth → bites on a timer
    if (this.drag && this.drag.item && !this.drag.item.done) {
      const d = this.drag, m = this.mouth(); const near = U.dist(d.item.x, d.item.y, m.x, m.y) < MOUTH_RADIUS;
      if (near) { if (this.face.expr === 'idle') this.face.expr = 'open'; d.biteT -= dt; if (d.biteT <= 0) { this.bite(d.item); d.biteT = BITE_GAP; } }
      else { d.biteT = Math.min(d.biteT, 0.25); if (this.face.expr === 'open') this.face.expr = 'idle'; }
    } else if (this.face.expr === 'open') this.face.expr = 'idle';
    // viewers drift: slowly decay toward a floor when nobody eats (keeps the number alive)
    if (r.endT < 0) { const floor = r.lv.startViewers; if (r.viewers > floor) r.viewers = Math.max(floor, r.viewers - r.viewers * 0.004 * dt); }
    // ambient reactions & chat
    r.reactT -= dt; if (r.reactT < 0) { this.spawnReaction(); r.reactT = 0.35 + Math.random() * 0.7; }
    r.chatT -= dt; if (r.chatT < 0) { this.pushChat('idle'); r.chatT = 2.5 + Math.random() * 2.5; }
    if (r.endT >= 0) { r.endT += dt; if (r.endT > 2.0) this.finishRun(); }
  }
  // ── input ──
  onTouch(kind, id, cx, cy) {
    const sc = this.W / this.p.width(); const x = cx * sc, y = cy * sc;
    if (this.frozen) return;
    if (kind === 'start') {
      this.audio.unlock();
      if (this.state === 'stream' && this.run && this.run.endT < 0) { const it = this.hitStreamItem(x, y); if (it) { this.drag = { id: id, item: it, ox: it.x - x, oy: it.y - y, biteT: 0.22, sx: x, sy: y, moved: false }; it.drag = true; this.audio.play('pop', { gain: 0.5 }); return; } }
      if (this.state === 'checkout' && !this.checkout.done) { const it = this.hitCheckoutItem(x, y); if (it) { this.drag = { id: id, item: it, ox: it.x - x, oy: it.y - y, sx: x, sy: y, moved: false }; this.audio.play('pop', { gain: 0.5 }); return; } }
      this.ui.touchStart(id, x, y);
    } else if (kind === 'move') {
      if (this.drag && this.drag.id === id) { const d = this.drag; d.item.x = x + d.ox; d.item.y = y + d.oy; if (U.dist(x, y, d.sx, d.sy) > 12) d.moved = true; if (this.state === 'checkout') this.checkScanner(d.item); return; }
      this.ui.touchMove(id, x, y);
    } else {
      if (this.drag && this.drag.id === id) { const d = this.drag; this.drag = null; if (d.item) d.item.drag = false; if (this.state === 'checkout' && !d.moved && !d.item.scanned) this.flyToScanner(d.item); else if (this.state === 'checkout') this.checkScanner(d.item); return; }
      const b = this.ui.touchEnd(id, x, y); if (b) this.tap(b.id);
    }
  }
  hitStreamItem(x, y) { const r = this.run; for (let i = r.items.length - 1; i >= 0; i--) { const it = r.items[i]; if (it.done) continue; if (U.dist(x, y, it.x, it.y) < 64) return it; } return null; }
  hitCheckoutItem(x, y) { const c = this.checkout; for (let i = c.items.length - 1; i >= 0; i--) { const it = c.items[i]; if (it.scanned || it.fly) continue; if (U.dist(x, y, it.x, it.y) < 56) return it; } return null; }
  scannerRect() { const r = this.machineRect(); return { x: r.x + r.w * 0.22, y: r.y + r.h * 0.72, w: r.w * 0.56, h: r.h * 0.3 }; }
  checkScanner(it) { if (it.scanned || it.fly) return; const s = this.scannerRect(); if (it.x > s.x && it.x < s.x + s.w && it.y > s.y && it.y < s.y + s.h) { this.drag = null; this.scanItem(it); } }
  flyToScanner(it) { const s = this.scannerRect(); it.fly = { t: 0, x0: it.x, y0: it.y, x1: s.x + s.w / 2, y1: s.y + s.h / 2 }; }
  tap(id) {
    const self = this, p = this.profile, hs = this.hs;
    this.audio.play('click', { gain: 0.6 });
    switch (id) {
      case 'play': if (this.run) this.beginStream(); else this.startLevel(this.curLevel()); break;
      case 'levels': this.levelPage = Math.floor((this.curLevel() - 1) / 15); this.setState('levels'); break;
      case 'page0': case 'page1': this.levelPage = +id.slice(4); break;
      case 'streamers': this.setState('streamers'); break;
      case 'home': this.setState('home'); break;
      case 'sound': p.set('sound', !p.get('sound')); this.audio.setMuted(!p.get('sound')); break;
      case 'coins': this.popupFrom = this.state; this.setState('coins'); break;
      case 'coins_close': this.setState(this.popupFrom || 'home'); break;
      case 'free_coins': this.watchFreeCoins(); break;
      case 'hsshop': this.openShop(); break;
      case 'shop_back': this.setState(this.popupFrom && this.popupFrom !== 'coins' ? this.popupFrom : 'home'); break;
      case 'cat_prev': this.market.cat = (this.market.cat + this.market.lv.cats.length - 1) % this.market.lv.cats.length; this.audio.play('whoosh', { gain: 0.5 }); break;
      case 'cat_next': this.market.cat = (this.market.cat + 1) % this.market.lv.cats.length; this.audio.play('whoosh', { gain: 0.5 }); break;
      case 'confirm': if (this.market.basket.length >= this.market.lv.basket) this.beginCheckout(); break;
      case 'pause': if (this.state === 'stream') this.setState('pause'); break;
      case 'resume': this.setState('stream'); break;
      case 'leave': this.saveRun(); this.setState('home'); break;
      case 'bonus_ad': this.watchBonus(); break;
      case 'next': this.afterResultAd(function () { self.startLevel(Math.min(D.LEVEL_COUNT, self.result.lv.n + 1)); }); break;
      case 'replay': this.afterResultAd(function () { self.startLevel(self.result.lv.n); }); break;
      case 'share': this.popup = 'share'; this.setState('popup'); break;
      case 'mission_profile': this.popup = 'profile'; this.setState('popup'); break;
      case 'mission_shortcut': this.popup = 'shortcut'; this.setState('popup'); break;
      case 'popup_close': this.popup = null; this.setState('home'); break;
      case 'popup_go':
        if (this.popup === 'share') hs.share().then(function (r) { if (r === null) self.showToast('Not shared'); self.popup = null; self.setState('home'); });
        else if (this.popup === 'profile') hs.startProfileMission();
        else if (this.popup === 'shortcut') hs.startShortcutMission();
        if (this.popup !== 'share') { this.popup = null; this.setState('home'); }
        break;
      default:
        if (id.indexOf('item') === 0) this.pickItem(+id.slice(4));
        else if (id.indexOf('bk') === 0) this.removeBasket(+id.slice(2));
        else if (id.indexOf('lvl') === 0) this.startLevel(+id.slice(3));
        else if (id.indexOf('str') === 0) this.pickStreamer(+id.slice(3));
        else if (id.indexOf('buy') === 0) this.buy(id.slice(3));
    }
  }
  pickItem(i) {
    const m = this.market; const foods = D.foodsOf(m.lv.cats[m.cat]); const f = foods[i]; if (!f) return;
    if (m.basket.length >= m.lv.basket) { m.shake = 1; this.audio.play('error'); this.showToast('Basket is full', 'Tap the green button'); return; }
    const price = D.priceOf(f);
    if ((this.profile.get('coins') || 0) < this.marketTotal() + price) { m.shake = 1; this.audio.play('error'); this.showToast('Not enough coins', 'Tap + for more coins'); return; }
    m.basket.push(f.id); this.audio.play('pop');
    const pos = this.shelfPos(i); const b = this.basketRect();
    this.flies.push({ food: f, x0: pos.x, y0: pos.y, x1: b.x + b.w / 2, y1: b.y + b.h * 0.3, t: 0 });
  }
  removeBasket(i) { const m = this.market; if (i < m.basket.length) { m.basket.splice(i, 1); this.audio.play('drop'); } }
  pickStreamer(i) { const s = D.STREAMERS[i]; if (!s) return; if (this.curLevel() < s.unlock && (this.profile.get('levels_done') || 0) + 1 < s.unlock) { this.audio.play('error'); this.showToast('Reach level ' + s.unlock + ' to unlock ' + s.name); return; } this.profile.set('streamer', i); this.audio.play('sweet'); }
  // ── ads (every showAd runs inside the tap that asked for it) ──
  afterResultAd(go) {
    const self = this; const noAds = (this.profile.get('no_ads') || 0) > 0;
    const eligible = this.result && this.result.lv.n > AD_FREE_LEVELS;
    if (noAds || !eligible || this.adBusy || !this.hs.canShowStreamEnd()) { go(); return; }
    this.adBusy = true;
    this.hs.showStreamEnd().then(function () { self.adBusy = false; go(); }, function () { self.adBusy = false; go(); });
  }
  watchBonus() {
    if (this.adBusy || !this.hs.canShowBonusCoins()) return;
    const self = this; this.adBusy = true; this.result.bonusTaken = true;
    this.hs.showBonusCoins().then(function (r) { self.adBusy = false; if (r === null) { self.result.bonusTaken = false; self.showToast('No ad right now'); } }, function () { self.adBusy = false; self.result.bonusTaken = false; });
  }
  watchFreeCoins() {
    if (this.adBusy || !this.hs.canShowFreeCoins()) return;
    const self = this; this.adBusy = true;
    this.hs.showFreeCoins().then(function (r) { self.adBusy = false; if (r === null) self.showToast('No ad right now'); }, function () { self.adBusy = false; });
  }
  openShop() {
    const self = this; this.setState('hsshop'); this.shopLoading = true; this.shopItems = null;
    this.hs.shop().then(function (list) { self.shopLoading = false; self.shopItems = list || []; }, function () { self.shopLoading = false; self.shopItems = []; });
  }
  buy(pid) {
    const self = this; if (this.adBusy) return; this.adBusy = true;
    this.hs.buy(pid).then(function (r) { self.adBusy = false; if (r && r.ok && !r.delivered) self.showToast('Paid — arrives at next start'); else if (r && !r.ok) self.showToast(r.error || 'Purchase cancelled'); }, function () { self.adBusy = false; });
  }
  // ── drawing ──
  draw(dt) {
    const ctx = this.ctx, ui = this.ui, W = this.W, H = this.H;
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    switch (this.state) {
      case 'home': this.drawHome(); break;
      case 'levels': this.drawLevels(); break;
      case 'streamers': this.drawStreamers(); break;
      case 'market': this.drawMarket(); break;
      case 'checkout': this.drawCheckout(); break;
      case 'stream': this.drawStream(); break;
      case 'pause': this.drawStream(); this.drawPause(); break;
      case 'result': this.drawStream(true); this.drawResult(); break;
      case 'coins': this.drawByName(this.popupFrom); this.drawCoinsPopup(); break;
      case 'hsshop': this.drawByName(this.popupFrom && this.popupFrom !== 'coins' ? this.popupFrom : 'home'); this.drawShop(); break;
      case 'popup': this.drawHome(); this.drawPopup(); break;
    }
    this.drawConfetti(); this.drawFloats();
    if (this.toast) { const a = this.toast.life < 0.3 ? this.toast.life / 0.3 : this.toast.life > 2.2 ? (2.6 - this.toast.life) / 0.4 : 1; ctx.globalAlpha = Math.max(0, a); const ty = this.top() + 70; ui.panel(W / 2 - 180, ty, 360, this.toast.sub ? 64 : 50, C.cream, C.outline, 18); ui.label(this.toast.text, W / 2, ty + 25, 19, C.text); if (this.toast.sub) ui.label(this.toast.sub, W / 2, ty + 48, 14, C.textLight); ctx.globalAlpha = 1; }
    if (this.frozen) { ui.dim(0.5); ui.title('PAUSED', W / 2, H / 2, 44); }
    if (this.debug) ui.label('w' + this.p.width() + ' h' + this.p.height() + ' dpr' + this.p.dpr() + ' cw' + this.p.canvas.width + ' sc' + this.scale.toFixed(3) + ' H' + H, 10, H - 10, 14, '#000', 'left');
  }
  drawByName(s) { if (s === 'market') this.drawMarket(); else if (s === 'stream') this.drawStream(); else if (s === 'result') { this.drawStream(true); this.drawResult(); } else if (s === 'levels') this.drawLevels(); else if (s === 'streamers') this.drawStreamers(); else this.drawHome(); }
  drawConfetti() { const ctx = this.ctx; for (let i = 0; i < this.confetti.length; i++) { const c = this.confetti[i]; const a = 1 - c.life / c.max; ctx.globalAlpha = Math.max(0, a); if (c.spark) A.sparkle(ctx, c.x, c.y, c.r * 1.6, c.color); else { ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.fillStyle = c.color; ctx.fillRect(-c.r, -c.r * 0.6, c.r * 2, c.r * 1.2); ctx.restore(); } } ctx.globalAlpha = 1; }
  drawFloats() { const ctx = this.ctx, ui = this.ui; for (let i = 0; i < this.floats.length; i++) { const f = this.floats[i]; const a = f.life < 0.15 ? f.life / 0.15 : f.life > f.max - 0.4 ? (f.max - f.life) / 0.4 : 1; ctx.globalAlpha = Math.max(0, a); const sc = f.big ? U.easeOutBack(Math.min(1, f.life * 3)) : 1; ctx.save(); ctx.translate(f.x, f.y); ctx.scale(sc, sc); ui.label(f.str, 0, 0, f.size, f.color, 'center', { stroke: f.size * 0.3 }); ctx.restore(); } ctx.globalAlpha = 1; }
  drawReactions() { const ctx = this.ctx; for (let i = 0; i < this.reactions.length; i++) { const r = this.reactions[i]; const a = r.life < 0.2 ? r.life / 0.2 : r.life > r.max - 0.6 ? (r.max - r.life) / 0.6 : 1; ctx.globalAlpha = Math.max(0, a); A.reaction(ctx, r.kind, r.x + Math.sin(r.life * 3 + r.sway) * 12, r.y, r.s); } ctx.globalAlpha = 1; }
  hud(opts) {
    // profile badge · LIVE · coins (+)
    const ui = this.ui, ctx = this.ctx, W = this.W, top = this.top(); opts = opts || {};
    const ch = this.streamerDef();
    A.profileBadge(ctx, ch, 58, top + 44, 36, this.curLevel());
    if (opts.viewers !== undefined) A.livePill(ctx, W / 2 - 92, top + 18, 184, 46, opts.viewers, 1);
    this.coinsHud(top);
    return top;
  }
  coinsHud(top) { const ui = this.ui, ctx = this.ctx, W = this.W; const coins = U.fmtCoins(this.profile.get('coins') || 0); const w = Math.max(150, this.ui.measure(coins, 22) + 112); A.coinPill(ctx, W - 20 - w, top + 18, w, 44, coins); ui.button('coins', W - 58, top + 14, 42, 42, '+', { color: C.green, dark: C.greenDark, size: 28, radius: 21 }); }
  // ── HOME ──
  drawHome() {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, hs = this.hs, p = this.profile;
    const lv = D.level(this.run ? this.run.level : this.curLevel());
    A.background(ctx, lv.bg, this.p.createCanvas, W, H, this.scale); A.backgroundLive(ctx, lv.bg, W, H, this.time);
    A.table(ctx, lv.bg, W, H * 0.5, H);
    const hp = this.headPos(); A.streamer(ctx, this.streamerDef(), hp.x, hp.y + 30, hp.s, { expr: 'yum', t: this.time, bob: Math.sin(this.time * 1.6) * 4 });
    A.phoneStick(ctx, W * 0.1, H * 0.4, 0.9, this.time);
    this.drawReactions();
    const top = this.hud({});
    ui.title('MUKBANG', W / 2, top + 130, 60, C.white, C.pinkDark);
    ui.title('BANG', W / 2, top + 190, 72, C.yellow, C.pinkDark);
    ui.label('shop · scan · eat live', W / 2, top + 236, 18, C.white, 'center', { stroke: 5 });
    // TikTok review buttons (HSGame decides whether they exist on this platform)
    let bx = 16; const by = top + 100;
    if (hs.hasMissions()) {
      if (!hs.profileMissionDone()) { ui.button('mission_profile', bx, by, 96, 44, 'ENTRY', { size: 14, badge: true, sub: 'REWARD', color: C.lavender, dark: C.lavenderDark }); bx += 104; }
      if (!hs.shortcutMissionDone()) { ui.button('mission_shortcut', bx, by, 96, 44, 'LAUNCH', { size: 14, badge: true, sub: 'REWARD', color: C.lavender, dark: C.lavenderDark }); bx += 104; }
    }
    if (hs.hasShare() && hs.canShare()) { ui.button('share', bx, by, 96, 44, 'SHARE', { size: 14, badge: hs.shareAvailable(), sub: 'FRIENDS', color: C.blue, dark: C.blueDark }); bx += 104; }
    // menu
    const y0 = H * 0.6; const bw = W * 0.76, bx0 = W * 0.12;
    const playText = this.run ? 'RESUME STREAM' : (this.curLevel() > D.LEVEL_COUNT ? 'ALL DONE' : 'PLAY  LEVEL ' + this.curLevel());
    ui.button('play', bx0, y0, bw, 76, playText, { color: C.pink, dark: C.pinkDark, size: 28 });
    ui.button('levels', bx0, y0 + 90, bw / 2 - 6, 60, 'LEVELS', { color: C.mint, dark: C.mintDark, size: 22, sub: D.LEVEL_COUNT + ' STREAMS' });
    ui.button('streamers', bx0 + bw / 2 + 6, y0 + 90, bw / 2 - 6, 60, 'STREAMERS', { color: C.lavender, dark: C.lavenderDark, size: 20, sub: 'PICK YOUR STAR' });
    const shop = hs.hasShop();
    if (shop) ui.button('hsshop', bx0, y0 + 164, bw / 2 - 6, 56, 'SHOP', { color: C.yellow, dark: C.yellowDark, size: 20 });
    ui.button('sound', shop ? bx0 + bw / 2 + 6 : bx0, y0 + 164, shop ? bw / 2 - 6 : bw, 56, p.get('sound') ? 'SOUND ON' : 'SOUND OFF', { color: C.blue, dark: C.blueDark, size: 20 });
    const best = p.get('best_viewers') || 0;
    if (best) ui.label('BEST STREAM  ' + U.fmtViewers(best) + ' VIEWERS', W / 2, y0 + 246, 15, C.white, 'center', { stroke: 4 });
  }
  // ── LEVELS ──
  drawLevels() {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, p = this.profile;
    A.storeBackground(ctx, this.p.createCanvas, W, H, this.scale); ui.dim(0.15);
    const top = this.top();
    ui.button('home', 16, top + 14, 48, 48, '✕', { color: C.red, dark: '#c93b55', size: 24, radius: 16 });
    this.coinsHud(top);
    ui.title('LEVELS', W / 2, top + 100, 44);
    const unlocked = this.curLevel(), st = this.stars();
    const cols = 5, cw = (W - 50 - (cols - 1) * 8) / cols, ch = 84, gx = 25, gy = top + 140;
    const base = this.levelPage * 15;
    for (let j = 0; j < 15; j++) {
      const n = base + j + 1; const x = gx + (j % cols) * (cw + 8), y = gy + Math.floor(j / cols) * (ch + 10);
      const open = n <= unlocked; const bgi = D.level(n).bg; const col = [C.blue, C.pink, C.lavender, C.yellow, C.mint][bgi], dk = [C.blueDark, C.pinkDark, C.lavenderDark, C.yellowDark, C.mintDark][bgi];
      ui.button('lvl' + n, x, y, cw, ch, open ? String(n) : '', { color: open ? col : '#e0d6d6', dark: open ? dk : '#bfb0b0', disabled: !open, size: 28, radius: 18, icon: open ? null : function (c, w, h) { A.lock(c, w / 2, h / 2, 26); } });
      if (open) { const s = st[n] || 0; for (let k = 0; k < 3; k++) A.star(ctx, x + cw / 2 + (k - 1) * 18, y + ch - 16, 7, k < s ? C.gold : 'rgba(255,255,255,0.6)', 2); }
    }
    const by = gy + 3 * (ch + 10) + 10;
    ui.button('page0', W * 0.12, by, W * 0.36, 52, 'LEVELS 1–15', { color: this.levelPage === 0 ? C.pink : C.blue, dark: this.levelPage === 0 ? C.pinkDark : C.blueDark, size: 17 });
    ui.button('page1', W * 0.52, by, W * 0.36, 52, 'LEVELS 16–30', { color: this.levelPage === 1 ? C.pink : C.blue, dark: this.levelPage === 1 ? C.pinkDark : C.blueDark, size: 17 });
    ui.label('Reach the viewer goal for 2 stars · beat it by 35% for 3', W / 2, by + 78, 14, C.text);
  }
  // ── STREAMERS ──
  drawStreamers() {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, p = this.profile;
    A.storeBackground(ctx, this.p.createCanvas, W, H, this.scale); ui.dim(0.15);
    const top = this.top();
    ui.button('home', 16, top + 14, 48, 48, '✕', { color: C.red, dark: '#c93b55', size: 24, radius: 16 });
    this.coinsHud(top);
    ui.title('STREAMERS', W / 2, top + 100, 44);
    const cur = p.get('streamer') || 0; const reach = Math.max(this.curLevel(), (p.get('levels_done') || 0) + 1);
    const cw = (W - 60) / 3 - 8, chh = Math.min(330, H * 0.36), y = top + 150;
    for (let i = 0; i < D.STREAMERS.length; i++) {
      const s = D.STREAMERS[i]; const x = 30 + i * (cw + 12); const open = reach >= s.unlock;
      ui.panel(x, y, cw, chh, open ? '#fff' : '#eee', cur === i ? C.gold : C.outline, 22, cur === i ? 6 : 4);
      ctx.save(); A.rr(ctx, x + 4, y + 4, cw - 8, chh - 8, 18); ctx.clip();
      if (open) A.streamer(ctx, s, x + cw / 2, y + chh * 0.36, cw / 95 * 0.42, { expr: cur === i ? 'yum' : 'idle', t: this.time, blink: this.face.blink });
      else { ctx.globalAlpha = 0.35; A.streamer(ctx, s, x + cw / 2, y + chh * 0.36, cw / 95 * 0.42, { expr: 'idle' }); ctx.globalAlpha = 1; A.lock(ctx, x + cw / 2, y + chh * 0.4, 40); }
      ctx.restore();
      ui.label(s.name, x + cw / 2, y + chh - 54, 22, C.text);
      ui.label(open ? (cur === i ? 'SELECTED' : 'TAP TO PICK') : 'LEVEL ' + s.unlock, x + cw / 2, y + chh - 26, 13, open ? C.pinkDark : C.textLight);
      ui.hotspot('str' + i, x, y, cw, chh);
    }
    ui.label('Every streamer eats the same — pick your favourite face.', W / 2, y + chh + 40, 14, C.text);
  }
  // ── MARKET ──
  // Shelf rows: two food rows, plus a locked preview row when a shelf is still to unlock. Spread over the free height.
  shelfGap() { const top = this.top(), bottom = this.bottom(); const rows = this.nextLockedCat() ? 3 : 2; const free = (bottom - 200) - (top + 270) - 110; return U.clamp(free / (rows - 1 || 1), 180, 230); }
  shelfPos(i) { const top = this.top(); const W = this.W; return { x: W * [0.2, 0.5, 0.8][i % 3], y: top + 270 + Math.floor(i / 3) * this.shelfGap() }; }
  nextLockedCat() { const lv = this.market ? this.market.lv : null; if (!lv) return null; for (let i = 0; i < D.CATS.length; i++) if (D.CATS[i].unlock > lv.n) return D.CATS[i]; return null; }
  basketRect() { const W = this.W, bottom = this.bottom(); return { x: W * 0.27, y: bottom - 150, w: W * 0.42, h: 92 }; }
  drawMarket() {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, m = this.market, lv = m.lv, p = this.profile;
    A.storeBackground(ctx, this.p.createCanvas, W, H, this.scale);
    const top = this.top();
    ui.button('home', 16, top + 14, 48, 48, '✕', { color: C.red, dark: '#c93b55', size: 24, radius: 16 });
    this.coinsHud(top);
    ui.title('SUPERMARKET', W / 2, top + 100, 40, C.white, C.pinkDark);
    // category header
    const catId = lv.cats[m.cat], cat = D.CAT_BY_ID[catId];
    ui.panel(W * 0.2, top + 128, W * 0.6, 48, cat.color, C.outline, 24);
    ui.label(cat.name, W / 2, top + 153, 24, C.text);
    ui.button('cat_prev', W * 0.2 - 58, top + 128, 50, 48, '‹', { color: C.blue, dark: C.blueDark, size: 32, radius: 16 });
    ui.button('cat_next', W * 0.8 + 8, top + 128, 50, 48, '›', { color: C.blue, dark: C.blueDark, size: 32, radius: 16 });
    ui.label('LEVEL ' + lv.n + '  ·  GOAL ' + U.fmtViewers(lv.goal) + ' VIEWERS  ·  PICK ' + lv.basket, W / 2, top + 194, 14, C.text);
    // shelves
    const foods = D.foodsOf(catId); const total = this.marketTotal(); const coins = p.get('coins') || 0;
    for (let row = 0; row < 2; row++) { const sp = this.shelfPos(row * 3); A.shelfBoard(ctx, 18, sp.y + 52, W - 36, 30, cat.dark); }
    const locked = this.nextLockedCat();
    if (locked) { // preview of the next shelf to unlock
      const sp = this.shelfPos(6); A.shelfBoard(ctx, 18, sp.y + 52, W - 36, 30, '#d9cfcf');
      const lf = D.foodsOf(locked.id); ctx.globalAlpha = 0.35; for (let i = 0; i < 3; i++) A.food(ctx, lf[i], this.shelfPos(6 + i).x, sp.y, 100, 0, 0); ctx.globalAlpha = 1;
      A.lock(ctx, W / 2, sp.y - 10, 44);
      ui.panel(W / 2 - 120, sp.y + 70, 240, 30, '#fff', C.outline, 15, 3); ui.label(locked.name + '  ·  UNLOCKS AT LEVEL ' + locked.unlock, W / 2, sp.y + 85, 13, C.text);
    }
    const shake = Math.sin(this.time * 40) * m.shake * 6;
    for (let i = 0; i < foods.length; i++) {
      const f = foods[i]; const sp = this.shelfPos(i); const price = D.priceOf(f);
      const afford = coins >= total + price && m.basket.length < lv.basket;
      ctx.globalAlpha = afford ? 1 : 0.55;
      A.food(ctx, f, sp.x + (afford ? 0 : shake), sp.y, 112, 0, this.time);
      ctx.globalAlpha = 1;
      A.priceTag(ctx, sp.x, sp.y + 92, price, !afford);
      ui.hotspot('item' + i, sp.x - 56, sp.y - 60, 112, 150);
    }
    // bottom: portrait, basket, count + total
    const b = this.basketRect(); const bottom = this.bottom();
    A.rr(ctx, 20, bottom - 170, 88, 150, 16); ctx.fillStyle = '#5b9fff'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.outline; ctx.stroke();
    ctx.save(); A.rr(ctx, 26, bottom - 164, 76, 138, 12); ctx.clip(); ctx.fillStyle = '#ffe3ea'; ctx.fillRect(26, bottom - 164, 76, 138); A.streamer(ctx, this.streamerDef(), 64, bottom - 96, 0.3, { expr: 'yum' }); ctx.restore();
    A.rr(ctx, 36, bottom - 48, 56, 22, 11); ctx.fillStyle = '#ff4a5f'; ctx.fill(); ctx.strokeStyle = C.outline; ctx.lineWidth = 3; ctx.stroke(); ui.label('live', 64, bottom - 37, 13, C.white);
    A.basket(ctx, b.x, b.y, b.w, b.h);
    for (let i = 0; i < m.basket.length; i++) { const f = D.FOOD_BY_ID[m.basket[i]]; const n = m.basket.length; const bx = b.x + b.w * (n === 1 ? 0.5 : 0.18 + 0.64 * i / (n - 1)); A.food(ctx, f, bx, b.y + 8 - (i % 2) * 10, 60, 0, this.time); ui.hotspot('bk' + i, bx - 30, b.y - 30, 60, 60); }
    for (let i = 0; i < this.flies.length; i++) { const fl = this.flies[i]; const k = U.easeInOut(fl.t); A.food(ctx, fl.food, U.lerp(fl.x0, fl.x1, k), U.lerp(fl.y0, fl.y1, k) - Math.sin(k * Math.PI) * 120, U.lerp(112, 60, k), 0, this.time); }
    ui.panel(W - 150, bottom - 150, 130, 44, '#fff', C.outline, 14); ui.label('🛒', W - 130, bottom - 128, 18, C.text); ui.label(m.basket.length + ' / ' + lv.basket, W - 78, bottom - 128, 20, C.text);
    ui.panel(W - 150, bottom - 98, 130, 44, '#fff', C.outline, 14); ui.label('Total', W - 126, bottom - 76, 15, C.text, 'left'); A.coin(ctx, W - 66, bottom - 76, 9); ui.label(String(total), W - 52, bottom - 76, 18, C.text, 'left');
    if (m.basket.length >= lv.basket) { const pulse = 1 + Math.sin(this.time * 6) * 0.05; ctx.save(); ctx.translate(W - 85, bottom - 24); ctx.scale(pulse, pulse); ctx.translate(-(W - 85), -(bottom - 24)); ui.button('confirm', W - 150, bottom - 48, 130, 48, 'GO  ›', { color: C.green, dark: C.greenDark, size: 24 }); ctx.restore(); }
    else ui.label(lv.basket - m.basket.length + ' more to pick', W - 85, bottom - 24, 14, C.text);
  }
  // ── CHECKOUT ──
  drawCheckout() {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, c = this.checkout;
    A.storeBackground(ctx, this.p.createCanvas, W, H, this.scale);
    const top = this.top();
    ui.button('home', 16, top + 14, 48, 48, '✕', { color: C.red, dark: '#c93b55', size: 24, radius: 16 });
    this.coinsHud(top);
    ui.title('CHECKOUT', W / 2, top + 100, 40, C.white, C.pinkDark);
    const r = this.machineRect(); const m = A.machine(ctx, r.x, r.y, r.w, r.h);
    // screen
    if (c.done) {
      ui.label('Thank you!', m.sx + m.sw / 2, m.sy + 34, 26, C.pinkDark);
      A.cashier(ctx, m.sx + m.sw / 2, m.sy + m.sh * 0.6, Math.min(1, m.sh / 220));
      ui.label('See you on the stream!', m.sx + m.sw / 2, m.sy + m.sh - 20, 14, C.textLight);
    } else {
      ui.label('Total', m.sx + m.sw / 2, m.sy + 26, 22, C.pinkDark);
      let y = m.sy + 60; const lh = 24;
      for (let i = 0; i < c.receipt.length; i++) { const line = c.receipt[i]; if (y > m.sy + m.sh - 60) break; ui.label(line.name + ' x1', m.sx + 18, y, 14, C.text, 'left'); A.coin(ctx, m.sx + m.sw - 56, y, 7); ui.label(String(line.price), m.sx + m.sw - 16, y, 14, C.text, 'right'); y += lh; }
      ctx.strokeStyle = '#c9c0e8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.sx + 14, m.sy + m.sh - 44); ctx.lineTo(m.sx + m.sw - 14, m.sy + m.sh - 44); ctx.stroke();
      ui.label('Total', m.sx + 18, m.sy + m.sh - 22, 16, C.text, 'left'); A.coin(ctx, m.sx + m.sw - 62, m.sy + m.sh - 22, 8); ui.label(String(c.total), m.sx + m.sw - 16, m.sy + m.sh - 22, 18, C.text, 'right');
      if (c.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + c.flash * 0.6 + ')'; A.rr(ctx, m.px, m.py, m.pw, m.ph, 10); ctx.fill(); }
    }
    // conveyor + items
    const cy = r.y + r.h + 20; A.conveyor(ctx, 20, cy, W - 40, Math.min(120, this.bottom() - cy - 60));
    for (let i = 0; i < c.items.length; i++) { const it = c.items[i]; if (it.scanned) continue; const held = this.drag && this.drag.item === it; A.food(ctx, D.FOOD_BY_ID[it.id], it.x, it.y, held ? 100 : 86, 0, this.time); }
    if (!c.done) { let left = 0; for (let i = 0; i < c.items.length; i++) if (!c.items[i].scanned) left++; ui.label(left ? 'Drag each item onto the scanner  (' + left + ' left)' : '', W / 2, cy + Math.min(120, this.bottom() - cy - 60) + 30, 15, C.text); }
  }
  // ── STREAM ──
  drawStream(still) {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, r = this.run;
    const lv = r ? r.lv : (this.result ? this.result.lv : D.level(this.curLevel()));
    A.background(ctx, lv.bg, this.p.createCanvas, W, H, this.scale); A.backgroundLive(ctx, lv.bg, W, H, this.time);
    // streamer behind the table
    const hp = this.headPos(); const fc = this.face;
    A.streamer(ctx, this.streamerDef(), hp.x, hp.y, hp.s, { expr: fc.expr, t: fc.t, blink: fc.blink, bob: fc.bob });
    A.table(ctx, lv.bg, W, H * 0.5, H);
    A.phoneStick(ctx, W * 0.08, H * 0.38, 0.85, this.time);
    if (r) {
      // items on the table (held one drawn last, bigger)
      let held = null;
      for (let i = 0; i < r.items.length; i++) { const it = r.items[i]; if (it.done) continue; if (this.drag && this.drag.item === it) { held = it; continue; } const f = D.FOOD_BY_ID[it.id]; A.food(ctx, f, it.x, it.y, 124, it.eaten / D.bitesOf(f), this.time); }
      if (held) { const f = D.FOOD_BY_ID[held.id]; const m = this.mouth(); const near = U.dist(held.x, held.y, m.x, m.y) < MOUTH_RADIUS; ctx.save(); if (near) { ctx.translate(held.x, held.y); ctx.rotate(Math.sin(this.time * 25) * 0.08); ctx.translate(-held.x, -held.y); } A.food(ctx, f, held.x, held.y, 136, held.eaten / D.bitesOf(f), this.time); ctx.restore(); }
      // mouth hint for the first bites
      if (!still && r.endT < 0 && this.drag && !this.drag.item.done) { const m = this.mouth(); const a = 0.35 + 0.25 * Math.sin(this.time * 8); ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 5; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.arc(m.x, m.y, MOUTH_RADIUS - 10, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      if (!still && r.t < 6 && r.endT < 0 && !this.drag) ui.label('DRAG FOOD TO THE MOUTH', W / 2, H * 0.52, 20, C.white, 'center', { stroke: 6 });
    }
    this.drawReactions();
    // chat
    const chatY = this.bottom() - 30;
    for (let i = this.chat.length - 1, k = 0; i >= 0 && k < 3; i--, k++) {
      const c = this.chat[i]; const a = c.life < 0.25 ? c.life / 0.25 : 1; ctx.globalAlpha = a * (k === 2 ? 0.55 : 1);
      const y = chatY - k * 46 + (1 - a) * 20; const tw = ui.measure(c.text, 15) + 26;
      A.avatar(ctx, c.avatar, 40, y, 18);
      ui.panel(66, y - 18, Math.min(tw, W - 90), 36, 'rgba(255,255,255,0.92)', C.outline, 14, 3);
      ui.label(c.text, 79, y + 1, 15, C.text, 'left');
    }
    ctx.globalAlpha = 1;
    const top = this.hud({ viewers: r ? U.fmtViewers(r.viewers) : U.fmtViewers(this.result ? this.result.peak : 0) });
    if (r && !still) ui.button('pause', W - 56, top + 70, 40, 40, 'II', { color: C.lavender, dark: C.lavenderDark, size: 16, radius: 20 });
    // goal bar
    if (r) { const t = r.peak / lv.goal3; ui.bar(W / 2 - 92, top + 70, 184, 16, Math.min(1, t), t >= 1 ? C.gold : t >= lv.goal / lv.goal3 ? C.green : C.pink); const gx = W / 2 - 92 + 184 * (lv.goal / lv.goal3); ctx.fillStyle = C.outline; ctx.fillRect(gx - 1, top + 66, 3, 24); ui.label('GOAL ' + U.fmtViewers(lv.goal), W / 2, top + 98, 12, C.white, 'center', { stroke: 4 }); }
    if (r && r.endT >= 0 && !still) { const k = U.easeOutBack(Math.min(1, r.endT * 2)); ctx.save(); ctx.translate(W / 2, H * 0.47); ctx.scale(k, k); ui.title('STREAM COMPLETE!', 0, 0, 40, C.white, C.pinkDark); ctx.restore(); }
  }
  drawPause() {
    const ui = this.ui, W = this.W, H = this.H;
    ui.dim(0.5);
    ui.panel(W * 0.12, H * 0.3, W * 0.76, 300, C.cream, C.outline, 26);
    ui.title('PAUSED', W / 2, H * 0.3 + 50, 40);
    ui.button('resume', W * 0.2, H * 0.3 + 96, W * 0.6, 62, 'RESUME', { color: C.green, dark: C.greenDark, size: 24 });
    ui.button('leave', W * 0.2, H * 0.3 + 170, W * 0.6, 54, 'HOME (KEEP STREAM)', { color: C.blue, dark: C.blueDark, size: 16 });
    ui.button('sound', W * 0.2, H * 0.3 + 236, W * 0.6, 48, this.profile.get('sound') ? 'SOUND ON' : 'SOUND OFF', { color: C.lavender, dark: C.lavenderDark, size: 16 });
  }
  // ── RESULT ──
  drawResult() {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, res = this.result, hs = this.hs;
    ui.dim(0.4);
    const ph = 330 + res.unlocks.length * 26; const py = Math.max(this.top() + 110, H * 0.14);
    ui.panel(24, py, W - 48, ph, C.cream, C.outline, 26);
    ui.title('STREAM OVER!', W / 2, py + 46, 40, C.white, C.pinkDark);
    for (let k = 0; k < 3; k++) { const on = k < res.stars; const sc = on ? U.easeOutBack(Math.min(1, Math.max(0, res.t * 2 - k * 0.5))) : 1; ctx.save(); ctx.translate(W / 2 + (k - 1) * 70, py + 112); ctx.scale(sc, sc); A.star(ctx, 0, 0, 28, on ? C.gold : '#e8e0e0', 4); ctx.restore(); }
    ui.label('PEAK VIEWERS', W / 2, py + 160, 14, C.textLight);
    ui.label(U.fmtViewers(res.peak) + '   (goal ' + U.fmtViewers(res.lv.goal) + ')', W / 2, py + 184, 24, C.text);
    ui.label('COINS EARNED', W / 2, py + 222, 14, C.textLight);
    A.coin(ctx, W / 2 - 60, py + 248, 12); ui.label('+' + U.fmtCoins(res.coins), W / 2 + 8, py + 248, 26, C.goldDark);
    let y = py + 282;
    if (res.firstClear) { const rb = hs.rewardsLevelBonus(); if (rb) { ui.label('LEVEL BONUS  ' + this.itemsText(rb), W / 2, y, 15, C.pinkDark); y += 26; } }
    for (let i = 0; i < res.unlocks.length; i++) { ui.label('★ ' + res.unlocks[i], W / 2, y, 16, C.greenDark); y += 26; }
    y = py + ph + 16;
    const bonus = hs.rewardsBonusCoins();
    if (hs.hasAds() && hs.canShowBonusCoins() && bonus && !res.bonusTaken) { ui.button('bonus_ad', 40, y, W - 80, 56, '▶  WATCH AD:  ' + this.itemsText(bonus), { color: C.blue, dark: C.blueDark, size: 17 }); y += 68; }
    const canNext = res.lv.n < D.LEVEL_COUNT;
    ui.button(canNext ? 'next' : 'replay', 40, y, W - 80, 70, canNext ? 'NEXT STREAM  ›' : 'STREAM AGAIN', { color: C.pink, dark: C.pinkDark, size: 26 }); y += 84;
    ui.button('replay', 40, y, (W - 90) / 2, 56, 'REPLAY', { color: C.mint, dark: C.mintDark, size: 20 });
    ui.button('home', 50 + (W - 90) / 2, y, (W - 90) / 2, 56, 'HOME', { color: C.lavender, dark: C.lavenderDark, size: 20 });
  }
  // ── COINS popup ──
  drawCoinsPopup() {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, hs = this.hs;
    ui.dim(0.5);
    const free = hs.rewardsFreeCoins(); const canFree = hs.hasAds() && hs.canShowFreeCoins() && free; const shop = hs.hasShop();
    const ph = 190 + (canFree ? 70 : 0) + (shop ? 70 : 0) + (!canFree && !shop ? 30 : 0); const py = (H - ph) / 2;
    ui.panel(40, py, W - 80, ph, C.cream, C.outline, 26);
    A.coin(ctx, W / 2, py + 50, 26); ui.title('NEED COINS?', W / 2, py + 100, 30, C.white, C.goldDark);
    let y = py + 136;
    if (canFree) { ui.button('free_coins', 60, y, W - 120, 58, '▶  WATCH AD:  ' + this.itemsText(free), { color: C.blue, dark: C.blueDark, size: 17 }); y += 70; }
    if (shop) { ui.button('hsshop', 60, y, W - 120, 58, 'OPEN SHOP', { color: C.yellow, dark: C.yellowDark, size: 20 }); y += 70; }
    if (!canFree && !shop) { ui.paragraph('Finish a stream to earn coins — every bite pays!', W / 2, y + 4, W - 140, 15, C.text); y += 30; }
    ui.button('coins_close', 60, y, W - 120, 50, 'CLOSE', { color: C.lavender, dark: C.lavenderDark, size: 18 });
  }
  // ── HS SHOP ──
  drawShop() {
    const ui = this.ui, W = this.W, H = this.H, p = this.profile;
    ui.dim(0.55);
    const top = this.top();
    ui.panel(24, top + 60, W - 48, H - top - 60 - 40, C.cream, C.outline, 26);
    ui.title('SHOP', W / 2, top + 110, 40, C.white, C.goldDark);
    let y = top + 160;
    if (this.shopLoading) ui.label('LOADING…', W / 2, y + 30, 20, C.text);
    else if (!this.shopItems || !this.shopItems.length) ui.label('NOTHING FOR SALE YET', W / 2, y + 30, 20, C.text);
    else for (let i = 0; i < this.shopItems.length && i < 6; i++) {
      const it = this.shopItems[i]; const ownedNoAds = it.items && it.items.no_ads && (p.get('no_ads') || 0) > 0;
      ui.panel(40, y, W - 80, 84, '#fff', C.outline, 18, 3);
      ui.label(it.name || ('Item ' + it.product_id), 56, y + 26, 19, C.text, 'left');
      ui.label(it.description || this.itemsText(it.items || {}), 56, y + 56, 13, C.textLight, 'left');
      const price = it.price || (it.beans_cost + ' Beans');
      if (ownedNoAds) ui.label('OWNED', W - 60, y + 42, 18, C.goldDark, 'right');
      else ui.button('buy' + it.product_id, W - 196, y + 16, 140, 50, price, { color: C.yellow, dark: C.yellowDark, size: 17 });
      y += 96;
    }
    ui.button('shop_back', 40, H - 40 - 70, W - 80, 54, 'BACK', { color: C.lavender, dark: C.lavenderDark, size: 20 });
  }
  // TikTok review popups: numbered steps + the reward (label from the dashboard), one "GO" button.
  drawPopup() {
    const ui = this.ui, W = this.W, H = this.H, hs = this.hs;
    ui.dim(0.5);
    const kind = this.popup; let title, steps, reward;
    if (kind === 'profile') { title = 'ENTRY REWARD'; steps = ['Go to your TikTok profile', 'Open "TikTok Minis"', 'Open Mukbang Bang from there', 'Come back and get the reward']; reward = hs.rewardsProfile(); }
    else if (kind === 'shortcut') { title = 'LAUNCH REWARD'; steps = ['Tap "GO"', 'Add Mukbang Bang to your home screen', 'Open the game from the new icon', 'Get the reward']; reward = hs.rewardsShortcut(); }
    else { title = 'SHARE'; steps = ['Share the game with friends', 'Get a reward once a day']; reward = hs.rewardsShare(); }
    const ph = 120 + steps.length * 38 + 150, py = (H - ph) / 2;
    ui.panel(30, py, W - 60, ph, C.cream, C.outline, 26);
    ui.title(title, W / 2, py + 46, 30, C.white, C.pinkDark);
    let y = py + 100;
    for (let i = 0; i < steps.length; i++) { ui.label((i + 1) + '.  ' + steps[i], 54, y, 17, C.text, 'left'); y += 38; }
    ui.label(reward ? 'REWARD:  ' + this.itemsText(reward) : 'REWARD: none right now', W / 2, y + 10, 17, C.goldDark);
    ui.button('popup_go', 50, y + 44, (W - 110) / 2, 58, 'GO', { color: C.pink, dark: C.pinkDark, size: 24 });
    ui.button('popup_close', 60 + (W - 110) / 2, y + 44, (W - 110) / 2, 58, 'LATER', { color: C.lavender, dark: C.lavenderDark, size: 20 });
  }
  // Browser-only QA helper: jump to a screen with sample data (#auto=market|checkout|stream|result|levels|streamers)
  autoDemo(kind, n) {
    n = n || 5;
    if (kind === 'home') return;
    if (kind === 'levels' || kind === 'streamers') { this.setState(kind); return; }
    this.startLevel(n); const foods = D.foodsOf(this.market.lv.cats[0]); const foods2 = D.foodsOf(this.market.lv.cats[Math.min(1, this.market.lv.cats.length - 1)]);
    if (kind === 'market') return;
    for (let i = 0; i < this.market.lv.basket; i++) this.market.basket.push((i % 2 ? foods2 : foods)[i % 6].id);
    this.beginCheckout(); if (kind === 'checkout') return;
    for (let i = 0; i < this.checkout.items.length; i++) this.scanItem(this.checkout.items[i]);
    this.beginStream(); if (kind === 'stream') { for (let i = 0; i < 5; i++) this.pushChat('idle'); this.run.viewers = 3200; this.run.peak = 3200; return; }
    for (let i = 0; i < this.run.items.length; i++) { const it = this.run.items[i]; while (!it.done) this.bite(it); }
    this.finishRun();
  }
}

module.exports = { Game };
