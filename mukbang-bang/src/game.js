'use strict';
// Game state machine. Platform-agnostic: it talks to `platform` (canvas,
// touches, time, vibration, audio context, offscreen canvases) and to `hs`
// (the HS kit wrapper from the entry file). All progress lives in the HS
// profile — this file never touches storage.
const U = require('./util.js');
const D = require('./data.js');
const A = require('./art.js');
const S = require('./sprites.js');
const UIM = require('./ui.js');
const AU = require('./audio.js');
const L = require('./levels.js');
const K = require('./catalog.js');
const SC = require('./scenes.js');
const ST = require('./stream.js');
const WR = require('./wardrobe.js');
const WS = require('./wardrobe-scene.js');
const AP = require('./autoplay.js');
const CK = require('./cook.js');
const R = require('./recipes.js');
const CA = require('./cookart.js');
const C = D.COLORS;

const DESIGN_W = 540;
const REACTIONS = ['heart', 'like', 'star', 'laugh', 'love', 'cool', 'smile'];
const AD_FREE_STREAMS = 3;       // rewarded extras (boost, surprise) appear from stream 3
const INTER_FROM = 1;            // interstitials from the end of stream 1 on; spacing = dashboard cooldown 30 s per place

class Game {
  constructor(platform, hs) {
    this.p = platform; this.hs = hs; this.profile = hs.profile;
    S.init(platform); S.preload(); R.setArt(CA);
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
    this.hearts = [];
    // a brand-new player starts inside the first livestream: the package is on the table (first tap < 3 s)
    if (!this.run && !(this.profile.get('streams') || 0) && this.curLevel() === 1) this.startStream(1);
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
  curLevel() { return U.clamp(this.profile.get('level') || 1, 1, L.LEVEL_COUNT); }
  stars() { try { return JSON.parse(this.profile.get('stars_json') || '{}'); } catch (e) { return {}; } }
  // ── level flow ──
  startLevel(n) { this.startStream(n); }
  // optional activities from the home screen — each ends in a one-food bonus stream
  modeOpen(id) { const m = L.modeOf(id); return !!m && Math.max(this.curLevel(), (this.profile.get('levels_done') || 0) + 1) >= m.unlock; }
  enterActivity(id) {
    const m = L.modeOf(id); if (!m) return;
    if (!this.modeOpen(id)) { this.audio.play('error'); this.showToast(m.name + ' opens at stream ' + m.unlock); return; }
    const lv = L.sideConfig(id, this.curLevel()); const coins = this.profile.get('coins') || 0;
    let min = 0;
    if (id === 'market') { min = 1e9; for (let i = 0; i < lv.market.shelves.length; i++) min = Math.min(min, D.CAT_BY_ID[lv.market.shelves[i]].price); }
    else if (id === 'delivery') { min = 1e9; for (let i = 0; i < lv.delivery.rest.length; i++) K.mainsOf(lv.delivery.rest[i]).forEach(function (d) { min = Math.min(min, d.price); }); }
    else if (id === 'buffet') min = lv.buffet.fee; else if (id === 'kitchen') min = K.RECIPE_BY_ID[lv.kitchen.recipe].price;
    if (coins < min) { this.audio.play('error'); this.showToast('Need ' + U.fmtCoins(min) + ' coins', 'Main streams are always free — earn more there!'); return; }
    this.flies.length = 0; this.trans = 0.3;
    if (id === 'delivery') this.enterDelivery(lv); else if (id === 'buffet') this.enterBuffet(lv); else if (id === 'kitchen') this.enterKitchen(lv);
    else { this.market = { lv: lv, cats: lv.market.shelves, pick: 99, cat: 0, basket: [], shake: 0 }; this.setState('market'); }
  }
  marketTotal() { let t = 0; for (let i = 0; i < this.market.basket.length; i++) t += K.dish(this.market.basket[i]).price; return t; }
  beginCheckout() {
    const m = this.market; const items = [];
    for (let i = 0; i < m.basket.length; i++) items.push({ id: m.basket[i], scanned: false, x: 0, y: 0, hx: 0, hy: 0, fly: null });
    this.checkout = { lv: m.lv, items: items, receipt: [], total: 0, done: false, thankT: 0, flash: 0, auto: true, autoT: 0.45 };
    this.layoutCheckout();
    this.setState('checkout');
  }
  layoutCheckout() {
    const c = this.checkout, W = this.W; const n = c.items.length;
    const y = this.machineRect().y + this.machineRect().h + 70;
    for (let i = 0; i < n; i++) { const it = c.items[i]; it.hx = W * (n === 1 ? 0.5 : 0.14 + 0.72 * i / (n - 1)); it.hy = y + (i % 2) * 26; if (!it.scanned && !it.fly) { it.x = it.hx; it.y = it.hy; } }
  }
  machineRect() { const top = this.top(); const w = Math.min(this.W * 0.9, this.H * 0.54 * 864 / 920); return { x: (this.W - w) / 2, y: top + 118, w: w, h: w * 920 / 864 }; }
  scanItem(it) {
    const c = this.checkout; if (it.scanned) return;
    it.scanned = true; const f = K.dish(it.id); const price = f.price;
    c.receipt.push({ name: f.name, price: price, it: it }); c.total += price; c.flash = 1;
    this.audio.play('beep'); this.vibrate('short');
    const r = this.machineRect(); this.spawnSparkles(r.x + r.w / 2, r.y + r.h * 0.84, 10);
    let left = 0; for (let i = 0; i < c.items.length; i++) if (!c.items[i].scanned) left++;
    if (!left) c.review = true; // everything is on the receipt: the player checks it, can put things back, then pays
  }
  payCheckout() {
    const c = this.checkout; if (!c || c.done || !c.review || !c.items.length) return;
    c.done = true; c.thankT = 0; this.audio.play('cash');
    this.profile.add('coins', -c.total);
    c.food = c.items[0].id; c.queue = c.items.slice(1).map(function (it) { return it.id; });
  }
  // put one receipt line back on the shelf (the basket shrinks too); an empty receipt returns to the shop
  removeCheckoutLine(i) {
    const c = this.checkout; if (!c || c.done) return; const line = c.receipt[i]; if (!line) return;
    c.receipt.splice(i, 1); c.total -= line.price; const k = c.items.indexOf(line.it); if (k >= 0) c.items.splice(k, 1);
    const m = this.market; if (m) { const b = m.basket.indexOf(line.it.id); if (b >= 0) m.basket.splice(b, 1); }
    this.audio.play('drop');
    if (!c.items.length) { this.setState('market'); this.showToast('Basket is empty', 'Pick something to stream!'); }
  }
  backToShop() { const c = this.checkout; if (!c || c.done) return; this.audio.play('whoosh', { gain: 0.5 }); this.setState('market'); }
  headPos() { return { x: this.W / 2, y: this.H * 0.305, s: Math.min(1, this.H / 1000) }; }
  mouth() { const h = this.headPos(); return A.mouthPos(h.x, h.y, h.s, this.face.bob || 0, this.streamerDef()); }
  setFace(expr, dur) { this.face.expr = expr; this.face.until = this.time + dur; this.face.t = 0; }
  // ── effects ──
  floatText(str, x, y, color, size, big) { this.floats.push({ str: str, x: x, y: y, color: color, size: size || 20, life: 0, max: big ? 1.6 : 1.1, big: !!big }); if (this.floats.length > 12) this.floats.shift(); }
  spawnReaction(kind) { const left = Math.random() < 0.5; const x = left ? this.W * (0.05 + Math.random() * 0.14) : this.W * (0.8 + Math.random() * 0.15); this.reactions.push({ kind: kind || REACTIONS[Math.floor(Math.random() * REACTIONS.length)], x: x, y: this.H * (0.55 + Math.random() * 0.25), vy: 70 + Math.random() * 60, sway: Math.random() * 6, life: 0, max: 2.2 + Math.random(), s: 12 + Math.random() * 8 }); if (this.reactions.length > 40) this.reactions.shift(); }
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
    if (this.autoplay && !this.frozen && this.state !== 'settings') this.autoTick(dt); // test build: autoplay acts on what was just drawn
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
    if (this.trans > 0) this.trans = Math.max(0, this.trans - dt);
    if (this.state === 'market') this.updateMarket(dt);
    else if (this.state === 'checkout') this.updateCheckout(dt);
    else if (this.sceneUpdate(dt)) { /* delivery / arrive / buffet / kitchen */ }
    else if (this.state === 'cook') this.updateCook(dt);
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
    if (c.auto && !c.done) { c.autoT -= dt; if (c.autoT <= 0) { c.autoT = 0.32; for (let i = 0; i < c.items.length; i++) { const it = c.items[i]; if (!it.scanned && !it.fly && !(this.drag && this.drag.item === it)) { this.flyToScanner(it); break; } } } }
    for (let i = 0; i < c.items.length; i++) { const it = c.items[i]; if (it.fly) { it.fly.t += dt * 2.5; const k = U.easeInOut(it.fly.t); it.x = U.lerp(it.fly.x0, it.fly.x1, k); it.y = U.lerp(it.fly.y0, it.fly.y1, k) - Math.sin(k * Math.PI) * 60; if (it.fly.t >= 1) { it.fly = null; this.scanItem(it); } } else if (this.drag && this.drag.item === it) { /* follows the finger */ } else if (!it.scanned) { it.x = U.damp(it.x, it.hx, 12, dt); it.y = U.damp(it.y, it.hy, 12, dt); } }
    if (c.review && c.autoPay && !c.done) this.payCheckout(); // auto-fill (preview links, tests) pays straight away
    if (c.done) { c.thankT += dt; if (c.thankT > 1.0 && this.state === 'checkout') this.startFoodStream(c.food, { side: 'market', cost: c.total, queue: c.queue }); }
  }
  // ── input ──
  onTouch(kind, id, cx, cy) {
    const sc = this.W / this.p.width(); const x = cx * sc, y = cy * sc;
    if (this.frozen) return;
    if (kind === 'start') {
      this.audio.unlock();
      if (this.cookTouch('start', id, x, y)) return;
      if (this.streamTouch('start', id, x, y)) return;
      if (this.sceneTouch('start', id, x, y)) return;
      if (this.state === 'checkout' && !this.checkout.done) { const it = this.hitCheckoutItem(x, y); if (it) { this.checkout.auto = false; this.drag = { id: id, item: it, ox: it.x - x, oy: it.y - y, sx: x, sy: y, moved: false }; this.audio.play('pop', { gain: 0.5 }); return; } }
      this.ui.touchStart(id, x, y);
    } else if (kind === 'move') {
      if (this.cookTouch('move', id, x, y)) return;
      if (this.streamTouch('move', id, x, y)) return;
      if (this.sceneTouch('move', id, x, y)) return;
      if (this.drag && this.drag.id === id && this.drag.item) { const d = this.drag; d.item.x = x + d.ox; d.item.y = y + d.oy; if (U.dist(x, y, d.sx, d.sy) > 12) d.moved = true; if (this.state === 'checkout') this.checkScanner(d.item); return; }
      this.ui.touchMove(id, x, y);
    } else {
      if (this.cookTouch('end', id, x, y)) return;
      if (this.streamTouch('end', id, x, y)) return;
      if (this.sceneTouch('end', id, x, y)) return;
      if (this.drag && this.drag.id === id && this.drag.item) { const d = this.drag; this.drag = null; if (d.item) d.item.drag = false; if (this.state === 'checkout' && !d.moved && !d.item.scanned) this.flyToScanner(d.item); else if (this.state === 'checkout') this.checkScanner(d.item); return; }
      const b = this.ui.touchEnd(id, x, y); if (b) this.tap(b.id);
    }
  }
  hitCheckoutItem(x, y) { const c = this.checkout; for (let i = c.items.length - 1; i >= 0; i--) { const it = c.items[i]; if (it.scanned || it.fly) continue; if (U.dist(x, y, it.x, it.y) < 56) return it; } return null; }
  scannerRect() { const r = this.machineRect(); return { x: r.x + r.w * 0.22, y: r.y + r.h * 0.72, w: r.w * 0.56, h: r.h * 0.3 }; }
  checkScanner(it) { if (it.scanned || it.fly) return; const s = this.scannerRect(); if (it.x > s.x && it.x < s.x + s.w && it.y > s.y && it.y < s.y + s.h) { this.drag = null; this.scanItem(it); } }
  flyToScanner(it) { const s = this.scannerRect(); it.fly = { t: 0, x0: it.x, y0: it.y, x1: s.x + s.w / 2, y1: s.y + s.h / 2 }; }
  tap(id) {
    const self = this, p = this.profile, hs = this.hs;
    this.audio.play('click', { gain: 0.6 });
    if (this.sceneTap(id)) return;
    if (this.cookTap(id)) return;
    switch (id) {
      case 'play': if (this.run) this.beginStream(); else this.startStream(this.curLevel()); break;
      case 'wardrobe': if (this.curLevel() < WR.OPEN_AT && (this.profile.get('levels_done') || 0) < WR.OPEN_AT) { this.audio.play('error'); this.showToast('Wardrobe opens after stream ' + WR.OPEN_AT); } else { this.wardTab = this.wardTab || 0; this.setState('wardrobe'); } break;
      case 'levels': this.levelPage = Math.floor((this.curLevel() - 1) / 15); this.setState('levels'); break;
      case 'page0': case 'page1': case 'page2': this.levelPage = +id.slice(4); break;
      case 'streamers': this.setState('streamers'); break;
      case 'home': this.setState('home'); break;
      case 'sound': p.set('sound', !p.get('sound')); this.audio.setMuted(!p.get('sound')); break;
      case 'settings': this.settingsFrom = this.state === 'pause' ? 'pause' : 'home'; this.setState('settings'); break;
      case 'settings_close': this.setState(this.settingsFrom === 'pause' && this.run ? 'pause' : 'home'); this.settingsFrom = null; break;
      case 'reset_progress': if (this.p.devTools) { if (this.resetArm && this.time - this.resetArm < 3) { this.resetArm = 0; this.resetProgress(); } else this.resetArm = this.time; } break;
      case 'auto_play': if (this.p.devTools) { this.autoplay = !this.autoplay; this.auto = null; this.showToast(this.autoplay ? 'AUTO PLAY ON' : 'AUTO PLAY OFF', this.autoplay ? 'close settings and watch' : ''); } break;
      case 'unlock_all': this.unlockAll(); break;
      case 'coins': this.popupFrom = this.state; this.setState('coins'); break;
      case 'coins_close': this.setState(this.popupFrom || 'home'); break;
      case 'free_coins': this.watchFreeCoins(); break;
      case 'hsshop': this.openShop(); break;
      case 'shop_back': this.setState(this.popupFrom && this.popupFrom !== 'coins' ? this.popupFrom : 'home'); break;
      case 'cat_prev': this.market.cat = (this.market.cat + this.market.cats.length - 1) % this.market.cats.length; this.audio.play('whoosh', { gain: 0.5 }); break;
      case 'cat_next': this.market.cat = (this.market.cat + 1) % this.market.cats.length; this.audio.play('whoosh', { gain: 0.5 }); break;
      case 'confirm': if (this.market.basket.length >= 1) this.beginCheckout(); break;
      case 'pay': this.payCheckout(); break;
      case 'to_shop': this.backToShop(); break;
      case 'gtip_ok': this.profile.set('tip_goal', 1); this.audio.play('pop'); break;
      case 'gtip_block': break;
      case 'mtip_ok': this.profile.set('tip_market', 1); this.audio.play('pop'); break;
      case 'mtip_block': break;
      case 'pause': if (this.state === 'stream') this.setState('pause'); break;
      case 'resume': this.setState('stream'); break;
      case 'leave': this.saveRun(); this.setState('home'); break;
      case 'bonus_ad': this.watchBonus(); break;
      case 'cook_go': if (this.state === 'stream' && this.run && this.run.phase === 'request') this.enterCook(); break;
      case 'fangift_ad': this.watchFanGift(); break;
      case 'gift_watch': this.watchFanGift(); break;
      case 'gift_no': if (this.run) this.run.giftAsk = false; break;
      case 'hype_ad': this.watchHype(); break;
      case 'req_home': if (this.run) this.saveRun(); this.setState('home'); break;
      case 'feat_block': break;
      case 'feat_ok': case 'feat_later': if (this.result) this.result.featureDone = true; break;
      case 'feat_go': if (this.result && this.result.feature) { const f = this.result.feature.f; this.result.featureDone = true; this.afterResultAd(function () { if (f.go === 'wardrobe') { self.wardTab = 0; self.setState('wardrobe'); } else if (f.go === 'streamers') self.setState('streamers'); else self.enterActivity(f.go.slice(5)); }); } break;
      case 'unlock_level_ad': this.watchUnlockLevel(); break;
      case 'surprise_ad': this.watchSurprise(); break;
      case 'boost_ad': this.watchBoost(); break;
      case 'fashion_ad': this.watchFashion(); break;
      case 'res_home': this.afterResultAd(function () { self.setState('home'); }); break;
      case 'res_main': this.afterResultAd(function () { self.startStream(self.curLevel()); }); break;
      case 'next': this.afterResultAd(function () { self.startStream(Math.min(L.LEVEL_COUNT, self.result.lv.n + 1)); }); break;
      case 'replay': this.afterResultAd(function () { self.startStream(self.result.lv.n); }); break;
      case 'share': this.popupFrom = this.state; this.popup = 'share'; this.setState('popup'); break;
      case 'mission_profile': this.popupFrom = this.state; this.popup = 'profile'; this.setState('popup'); break;
      case 'mission_shortcut': this.popupFrom = this.state; this.popup = 'shortcut'; this.setState('popup'); break;
      case 'popup_close': this.popup = null; this.setState(this.popupBack()); break;
      case 'popup_go':
        if (this.popup === 'share') hs.share().then(function (r) { if (r === null) self.showToast('Not shared'); self.popup = null; self.setState(self.popupBack()); });
        else if (this.popup === 'profile') hs.startProfileMission();
        else if (this.popup === 'shortcut') hs.startShortcutMission();
        if (this.popup !== 'share') { this.popup = null; this.setState(this.popupBack()); }
        break;
      default:
        if (id.indexOf('side_') === 0) { const mode = id.slice(5); if (this.state === 'result') this.afterResultAd(function () { self.enterActivity(mode); }); else this.enterActivity(mode); }
        else if (this.wardrobeTap(id)) { /* wardrobe */ }
        else if (id.indexOf('item') === 0) this.pickItem(+id.slice(4));
        else if (id.indexOf('bk') === 0) this.removeBasket(+id.slice(2));
        else if (id.indexOf('rml') === 0) this.removeCheckoutLine(+id.slice(3));
        else if (id.indexOf('lvl') === 0) this.startLevel(+id.slice(3));
        else if (id.indexOf('str') === 0) this.pickStreamer(+id.slice(3));
        else if (id.indexOf('buy') === 0) this.buy(id.slice(3));
    }
  }
  pickItem(i) {
    const m = this.market; const foods = D.foodsOf(m.cats[m.cat]); const f = foods[i]; if (!f) return;
    if (m.basket.length >= 12) { m.shake = 1; this.audio.play('error'); this.showToast('The basket is overflowing!', 'Tap GO to check out'); return; }
    const price = D.priceOf(f);
    if ((this.profile.get('coins') || 0) < this.marketTotal() + price) { m.shake = 1; this.audio.play('error'); this.showToast('Not enough coins', 'Tap + for more coins'); return; }
    m.basket.push(f.id); this.audio.play('pop');
    const pos = this.shelfPos(i); const b = this.basketRect();
    this.flies.push({ food: f, x0: pos.x, y0: pos.y, x1: b.x + b.w / 2, y1: b.y + b.h * 0.3, t: 0 });
  }
  removeBasket(i) { const m = this.market; if (i < m.basket.length) { m.basket.splice(i, 1); this.audio.play('drop'); } }
  pickStreamer(i) { const s = D.STREAMERS[i]; if (!s) return; if (this.run) { this.audio.play('error'); this.showToast('Finish the stream first'); return; } if (this.curLevel() < s.unlock && (this.profile.get('levels_done') || 0) + 1 < s.unlock) { this.audio.play('error'); this.showToast('Reach level ' + s.unlock + ' to unlock ' + s.name); return; } this.profile.set('streamer', i); this.audio.play('sweet'); }
  // ── ads (every showAd runs inside the tap that asked for it) ──
  // Measured, not assumed: every request / impression / completion / reward is counted per place
  // (profile ad_stats + a session log for "impressions in the last 5 minutes"). A null result = not shown.
  adStats() { try { return JSON.parse(this.profile.get('ad_stats') || '{}'); } catch (e) { return {}; } }
  adCount(place, key) { const st = this.adStats(); st[place] = st[place] || { req: 0, imp: 0, done: 0, grant: 0, fail: 0 }; st[place][key]++; this.profile.set('ad_stats', JSON.stringify(st)); }
  adRun(place, promise, after) {
    const self = this; this.adBusy = true; this.adCount(place, 'req');
    const t0 = this.clock();
    return promise.then(function (r) {
      self.adBusy = false;
      if (r === null || r === undefined) { self.adCount(place, 'fail'); after(null); return; }
      self.adCount(place, 'imp'); self.adCount(place, 'done'); (self.adLog = self.adLog || []).push(t0);
      let granted = false; for (const k in r) if (k.charAt(0) !== '$') granted = true; if (granted) self.adCount(place, 'grant');
      after(r);
    }, function () { self.adBusy = false; self.adCount(place, 'fail'); after(null); });
  }
  clock() { return this.wall !== undefined ? this.wall : this.time; }
  adsLast5min() { const now = this.clock(), log = this.adLog || []; let n = 0; for (let i = 0; i < log.length; i++) if (now - log[i] <= 300) n++; return n; }
  // interstitials (stream_end + cook_step) at least 30 s apart from each other; the dashboard cooldown is per place
  interGapOk() { return this.lastInter === undefined || this.clock() - this.lastInter >= 30; }
  noAds() { return (this.profile.get('no_ads') || 0) > 0; }
  afterResultAd(go) {
    const eligible = (this.profile.get('streams') || 0) >= INTER_FROM;
    if (this.noAds() || !eligible || this.adBusy || !this.interGapOk() || !this.hs.canShowStreamEnd()) { go(); return; }
    const self = this; this.adRun('stream_end', this.hs.showStreamEnd(), function (r) { if (r) self.lastInter = self.clock(); go(); });
  }
  watchBonus() {
    if (this.adBusy || !this.hs.canShowBonusCoins()) return;
    const self = this; this.result.bonusTaken = true;
    this.adRun('bonus_coins', this.hs.showBonusCoins(), function (r) { if (r === null) { self.result.bonusTaken = false; self.showToast('No ad right now'); } });
  }
  watchFreeCoins() {
    if (this.adBusy || !this.hs.canShowFreeCoins()) return;
    const self = this; this.adRun('free_coins', this.hs.showFreeCoins(), function (r) { if (r === null) self.showToast('No ad right now'); });
  }
  // surprise food: an ad that unlocks a rare-food bonus stream (home screen, never during a stream)
  canSurprise() { return this.hs.hasAds() && !this.run && this.curLevel() > AD_FREE_STREAMS && this.hs.canShowSurprise(); }
  watchSurprise() {
    if (this.adBusy || !this.canSurprise()) return;
    const self = this; this.adRun('surprise_food', this.hs.showSurprise(), function (r) {
      if (r === null) { self.showToast('No ad right now'); return; }
      const pool = ['golden_parfait', 'rainbow_crepe', 'sushi_set', 'seafood_boil', 'blue_moon', 'choco_ramen', 'pickle_icecream', 'wasabi_cake'];
      self.startFoodStream(pool[Math.floor(Math.random() * pool.length)], { side: 'surprise' }); self.showToast('SURPRISE FOOD!', 'A rare bonus stream');
    });
  }
  // viral boost: only while the package is still sealed (never interrupts eating)
  canBoost() { const r = this.run; return this.hs.hasAds() && r && r.phase === 'sealed' && !r.boosted && (this.profile.get('streams') || 0) >= AD_FREE_STREAMS && this.hs.canShowBoost(); }
  watchBoost() {
    if (this.adBusy || !this.canBoost()) return;
    const self = this; this.adRun('viral_boost', this.hs.showBoost(), function (r) {
      const run = self.run; if (r === null || !run) { if (r === null) self.showToast('No ad right now'); return; }
      run.boosted = true; const v = Math.round(run.goal * 0.25); run.viewers += v; run.peak = Math.max(run.peak, run.viewers);
      for (let i = 0; i < 10; i++) self.spawnHeart(true); self.floatText('VIRAL BOOST!  +' + U.fmtViewers(v), self.W / 2, self.H * 0.47, C.gold, 28, true); self.audio.play('levelup'); self.saveRun();
    });
  }
  // fan gift: a rewarded ad offered between pickups on the stream (never while chewing), once per stream
  watchFanGift() {
    const r = this.run; if (this.adBusy || !r || r.giftAd || r.phase === 'finale' || !this.canFanGift()) return;
    const self = this; r.giftAd = true; r.giftAsk = false; r.bal = null;
    const pv = this.adPreview(); // web preview: no SDK, pretend the ad played and pay the dashboard reward (300 coins)
    if (pv) this.showToast('AD PREVIEW', 'web build: no real ad');
    const pr = pv ? new Promise(function (ok) { setTimeout(function () { self.profile.add('coins', 300); ok({ coins: 300 }); }, 1200); }) : this.hs.showFanGift();
    this.adRun('fan_gift', pr, function (res) { if (self.run) self.run.giftAd = false; if (res === null) { self.showToast('No ad right now'); return; } self.spawnConfetti(self.W / 2, self.H * 0.3, 30); self.audio.play('cash'); for (let i = 0; i < 8; i++) self.spawnHeart(true); self.saveRun(); });
  }
  watchHype() {
    const r = this.run; if (this.adBusy || !r || r.hyped || r.phase !== 'open' || !this.canHype()) return;
    const self = this; r.hyped = true;
    this.adRun('extra_hype', this.hs.showHype(), function (res) {
      const run = self.run; if (!run) return; if (res === null) { run.hyped = false; self.showToast('No ad right now'); return; }
      const v = Math.round(run.goal * 0.5); self.addViewers(v); for (let i = 0; i < 12; i++) self.spawnHeart(true); self.floatText('EXTRA HYPE!  +' + U.fmtViewers(v), self.W / 2, self.H * 0.47, C.gold, 28, true); self.audio.play('levelup'); self.saveRun();
    });
  }
  // unlock the next locked level early (levels screen); the level bonus still pays once, when it is cleared
  __featureFor(n) { return ST.featureFor(n); }
  nextLockedLevel() { const n = this.curLevel() + 1; return n <= L.LEVEL_COUNT ? n : 0; }
  canUnlockLevel() { return this.hs.hasAds() && this.nextLockedLevel() > 0 && (this.profile.get('streams') || 0) >= 2 && this.hs.canShowUnlockLevel && this.hs.canShowUnlockLevel(); }
  watchUnlockLevel() {
    if (this.adBusy || !this.canUnlockLevel()) return; const n = this.nextLockedLevel();
    const self = this; this.adRun('unlock_level', this.hs.showUnlockLevel(), function (r) {
      if (r === null) { self.showToast('No ad right now'); return; }
      if (self.profile.get('level') < n) self.profile.set('level', n); self.run = null; self.saveRun(); self.audio.play('levelup'); self.spawnConfetti(self.W / 2, self.H * 0.4, 40); self.showToast('LEVEL ' + n + ' UNLOCKED!', L.level(n).title);
    });
  }
  // unlock a level-gift look early (wardrobe)
  canUnlockLook() { return this.hs.hasAds() && this.hs.canShowUnlockLook && this.hs.canShowUnlockLook(); }
  watchUnlockLook(id) {
    if (this.adBusy || !this.canUnlockLook()) return false;
    const self = this; this.adRun('unlock_look', this.hs.showUnlockLook(), function (r) {
      if (r === null) { self.showToast('No ad right now'); return; }
      WR.grant(self.profile, id); WR.equip(self.profile, self.streamerDef().id, id); self.audio.play('levelup'); self.spawnConfetti(self.W / 2, self.H * 0.3, 40); self.showToast('NEW LOOK: ' + WR.BY_ID[id].name.toUpperCase(), 'Unlocked early!');
    });
    return true;
  }
  // fashion reward: an ad that gives one wardrobe item you do not own yet (shop items only; level gifts stay level gifts)
  fashionPool() { const s = WR.state(this.profile), out = []; for (let i = 0; i < WR.ITEMS.length; i++) { const it = WR.ITEMS[i]; if (it.price > 0 && s.own.indexOf(it.id) < 0) out.push(it.id); } return out; }
  canFashion() { return this.hs.hasAds() && this.fashionPool().length > 0 && this.hs.canShowFashion(); }
  watchFashion() {
    if (this.adBusy || !this.canFashion()) return;
    const self = this; this.adRun('fashion_reward', this.hs.showFashion(), function (r) {
      if (r === null) { self.showToast('No ad right now'); return; }
      const pool = self.fashionPool(); if (!pool.length) return; const id = pool[Math.floor(Math.random() * pool.length)];
      WR.grant(self.profile, id); WR.equip(self.profile, self.streamerDef().id, id); self.showToast('NEW LOOK: ' + WR.BY_ID[id].name.toUpperCase(), 'Equipped!'); self.audio.play('levelup'); self.spawnConfetti(self.W / 2, self.H * 0.3, 40);
    });
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
      case 'popup': if (this.popupBack() === 'levels') this.drawLevels(); else this.drawHome(); this.drawPopup(); break;
      case 'wardrobe': this.drawWardrobe(); break;
      case 'cook': this.drawCook(); break;
      case 'settings': if (this.settingsFrom === 'pause' && this.run) this.drawStream(true); else this.drawHome(); this.drawSettings(); break;
      default: this.sceneDraw();
    }
    if (this.trans > 0) { ctx.globalAlpha = this.trans / 0.35; ctx.fillStyle = C.cream; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    this.drawConfetti(); this.drawFloats();
    if (this.toast) { const a = this.toast.life < 0.3 ? this.toast.life / 0.3 : this.toast.life > 2.2 ? (2.6 - this.toast.life) / 0.4 : 1; ctx.globalAlpha = Math.max(0, a); const ty = this.top() + 70; ui.panel(W / 2 - 180, ty, 360, this.toast.sub ? 64 : 50, C.cream, C.outline, 18); ui.label(this.toast.text, W / 2, ty + 25, 19, C.text); if (this.toast.sub) ui.label(this.toast.sub, W / 2, ty + 48, 14, C.textLight); ctx.globalAlpha = 1; }
    if (this.frozen) { ui.dim(0.5); ui.title('PAUSED', W / 2, H / 2, 44); }
    if (this.debug) ui.label('w' + this.p.width() + ' h' + this.p.height() + ' dpr' + this.p.dpr() + ' cw' + this.p.canvas.width + ' sc' + this.scale.toFixed(3) + ' H' + H, 10, H - 10, 14, '#000', 'left');
  }
  drawByName(s) { if (s === 'market') this.drawMarket(); else if (this.sceneIs(s)) { const st = this.state; this.state = s; this.sceneDraw(); this.state = st; } else if (s === 'stream') this.drawStream(); else if (s === 'result') { this.drawStream(true); this.drawResult(); } else if (s === 'levels') this.drawLevels(); else if (s === 'streamers') this.drawStreamers(); else this.drawHome(); }
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
    const lv = L.level(this.run && this.run.level ? this.run.level : this.curLevel());
    A.homeRoom(ctx, lv.view, this.p.createCanvas, W, H, this.scale, this.time);
    A.table(ctx, lv.view, W, H * 0.5, H);
    const hp = this.headPos(), sd = this.streamerDef(); A.streamer(ctx, sd, hp.x, hp.y + 30, hp.s, { expr: 'yum', t: this.time, bob: Math.sin(this.time * 1.6) * 4, look: WR.look(p, sd.id) });
    A.phoneStick(ctx, W * 0.1, H * 0.4, 0.9, this.time);
    // today's food waiting on the table
    if (this.run && !this.run.recipe) A.pack(ctx, K.dish(this.run.food), this.run.pack, W * 0.8, H * 0.555, 96, 'sealed', 0, 0, this.time); else R.draw(ctx, A, this.run && this.run.dish ? this.run.dish : lv.request, W * 0.8, H * 0.555, 84, { flipped: true, set: true, fill: 1, tops: 2, deco: 1 });
    this.drawReactions();
    const top = this.hud({});
    // game name: Mukbang ASMR. The old bitmap logo says "Mukbang Bang", so the title is drawn until the new logo art (ui/logo_asmr.png) ships
    const hasLogo = S.v4draw(ctx, 'ui/logo_asmr.png', W / 2, top + 168, 360);
    if (!hasLogo) { ui.title('MUKBANG', W / 2, top + 128, 60, C.white, C.pinkDark); ui.title('ASMR', W / 2, top + 192, 74, C.yellow, C.pinkDark);
      for (let k = 0; k < 3; k++) { const a = 0.5 + 0.5 * Math.sin(this.time * 4 - k); ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; for (const sx of [-1, 1]) { ctx.beginPath(); ctx.arc(W / 2 + sx * 112, top + 190, 12 + k * 9, sx > 0 ? -0.6 : Math.PI - 0.6, sx > 0 ? 0.6 : Math.PI + 0.6); ctx.stroke(); } } ctx.globalAlpha = 1; }
    // main button: straight into the eating
    const y0 = H * 0.585; const bw = W * 0.8, bx0 = W * 0.1;
    ui.label(this.run ? 'YOUR STREAM IS WAITING' : 'STREAM ' + lv.n + ' · ' + lv.title.toUpperCase(), W / 2, y0 - 16, 15, C.white, 'center', { stroke: 4 });
    const pulse = 1 + Math.sin(this.time * 4) * 0.025; ctx.save(); ctx.translate(W / 2, y0 + 40); ctx.scale(pulse, pulse); ctx.translate(-W / 2, -(y0 + 40));
    ui.button('play', bx0, y0, bw, 80, this.run ? 'RESUME MUKBANG' : 'START MUKBANG', { color: C.pink, dark: C.pinkDark, size: 30 }); ctx.restore();
    // optional activities
    let y = y0 + 94; const mw = (bw - 18) / 4;
    for (let i = 0; i < L.MODES.length; i++) { const m = L.MODES[i], open = this.modeOpen(m.id); ui.button('side_' + m.id, bx0 + i * (mw + 6), y, mw, 58, open ? m.short : '', { color: open ? m.color : '#e0d6d6', dark: open ? m.dark : '#bfb0b0', size: 14, radius: 16, sub: open ? '' : 'LV ' + m.unlock, icon: open ? null : function (c, w, h) { A.lock(c, w / 2, h / 2 - 6, 20); } }); }
    y += 70;
    const wOpen = Math.max(this.curLevel(), (p.get('levels_done') || 0)) >= WR.OPEN_AT;
    ui.button('levels', bx0, y, bw / 3 - 6, 54, 'LEVELS', { color: C.mint, dark: C.mintDark, size: 17 });
    ui.button('wardrobe', bx0 + bw / 3 + 3, y, bw / 3 - 6, 54, wOpen ? 'WARDROBE' : '', { color: wOpen ? C.lavender : '#e0d6d6', dark: wOpen ? C.lavenderDark : '#bfb0b0', size: 15, sub: wOpen ? '' : 'LV ' + WR.OPEN_AT, icon: wOpen ? null : function (c, w, h) { A.lock(c, w / 2, h / 2 - 6, 20); } });
    ui.button('streamers', bx0 + 2 * bw / 3 + 6, y, bw / 3 - 6, 54, 'STARS', { color: C.blue, dark: C.blueDark, size: 17 });
    y += 64;
    let shop = hs.hasShop();
    // the Beans store only sells No Ads: label it that way ("SHOP" is the supermarket); hidden once bought
    if (shop && this.noAds()) shop = false;
    if (shop) ui.button('hsshop', bx0, y, bw / 2 - 5, 48, '🚫 NO ADS', { color: C.yellow, dark: C.yellowDark, size: 16 });
    ui.button('settings', shop ? bx0 + bw / 2 + 5 : bx0, y, shop ? bw / 2 - 5 : bw, 48, 'SETTINGS', { color: C.lavender, dark: C.lavenderDark, size: 16 });
    this.drawTikTokRewards(y + 70); // Revisit / Launch / Share rewards right on the start screen (also on Levels)
    if (this.canSurprise()) ui.button('surprise_ad', W - 128, H * 0.47, 112, 52, '▶ SURPRISE', { color: C.yellow, dark: C.yellowDark, size: 14, sub: 'RARE FOOD', badge: true });
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
      const n = base + j + 1; if (n > L.LEVEL_COUNT) break; const x = gx + (j % cols) * (cw + 8), y = gy + Math.floor(j / cols) * (ch + 10);
      const open = n <= unlocked; const lvn = L.level(n); const bgi = lvn.view; const col = [C.blue, C.pink, C.lavender, C.yellow, C.mint][bgi], dk = [C.blueDark, C.pinkDark, C.lavenderDark, C.yellowDark, C.mintDark][bgi];
      ui.button('lvl' + n, x, y, cw, ch, open ? String(n) : '', { color: open ? col : '#e0d6d6', dark: open ? dk : '#bfb0b0', disabled: !open, size: 28, radius: 18, icon: open ? null : function (c, w, h) { A.lock(c, w / 2, h / 2, 26); } });
      if (open) { const s = st[n] || 0; for (let k = 0; k < 3; k++) A.uiStar(ctx, x + cw / 2 + (k - 1) * 18, y + ch - 16, 7, k < s, 'rgba(255,255,255,0.6)', 2); }
      else if (n === this.nextLockedLevel() && this.canUnlockLevel()) { A.rr(ctx, x + 6, y + ch - 30, cw - 12, 24, 12); ctx.fillStyle = C.blue; ctx.fill(); ui.label('▶ UNLOCK', x + cw / 2, y + ch - 18, 11, C.white); ui.hotspot('unlock_level_ad', x, y, cw, ch); }
    }
    const by = gy + 3 * (ch + 10) + 10;
    const pages = Math.ceil(L.LEVEL_COUNT / 15), pw = (W - 60 - (pages - 1) * 10) / pages;
    for (let i = 0; i < pages; i++) ui.button('page' + i, 30 + i * (pw + 10), by, pw, 52, (i * 15 + 1) + '–' + Math.min(L.LEVEL_COUNT, i * 15 + 15), { color: this.levelPage === i ? C.pink : C.blue, dark: this.levelPage === i ? C.pinkDark : C.blueDark, size: 17 });
    ui.label('Reach the viewer goal for 2 stars · tap hearts for 3', W / 2, by + 78, 14, C.text);
    this.drawTikTokRewards(by + 104);
  }
  // TikTok review rewards (Revisit / Launch / Share) — each card only while HSGame says the feature exists here
  drawTikTokRewards(y) {
    const ui = this.ui, ctx = this.ctx, W = this.W, hs = this.hs, cards = [];
    if (hs.hasMissions()) {
      if (!hs.profileMissionDone()) cards.push({ id: 'mission_profile', kind: 'profile', name: 'REVISIT', sub: 'REWARD', reward: hs.rewardsProfile(), badge: true });
      if (!hs.shortcutMissionDone()) cards.push({ id: 'mission_shortcut', kind: 'shortcut', name: 'LAUNCH', sub: 'REWARD', reward: hs.rewardsShortcut(), badge: true });
    }
    if (hs.hasShare() && hs.canShare()) cards.push({ id: 'share', kind: 'share', name: 'SHARE', sub: 'REWARD', reward: hs.rewardsShare(), badge: hs.shareAvailable() });
    if (!cards.length) return;
    ui.label('FREE REWARDS', W / 2, y, 15, C.white, 'center', { stroke: 4 });
    const n = cards.length, gap = 10, cw = Math.min(150, (W - 50 - gap * (n - 1)) / n), x0 = (W - (cw * n + gap * (n - 1))) / 2, cy = y + 16;
    const room = this.bottom() - cy - 10, compact = room < 128, chh = compact ? Math.max(50, Math.min(62, room)) : 128;
    if (compact) { // short screens: one row of slim chips (icon · name · reward)
      for (let i = 0; i < n; i++) { const c = cards[i], x = x0 + i * (cw + gap);
        ui.panel(x, cy, cw, chh, '#fff', c.kind === 'share' ? C.blueDark : C.pinkDark, 16, 3); this.missionIcon(c.kind, x + 26, cy + chh / 2, 17);
        ui.label(c.name, x + 48, cy + chh / 2 - 9, 13, C.text, 'left'); const coins = c.reward && c.reward.coins; if (coins) { A.coin(ctx, x + 54, cy + chh / 2 + 10, 6); ui.label('+' + coins, x + 63, cy + chh / 2 + 11, 11, C.goldDark, 'left'); }
        if (c.badge) { A.circle(ctx, x + cw - 6, cy + 6, 10, C.red, 2); ui.label('!', x + cw - 6, cy + 7, 13, C.white); }
        ui.hotspot(c.id, x, cy, cw, chh); }
      return; }
    for (let i = 0; i < n; i++) { const c = cards[i], x = x0 + i * (cw + gap), bob = c.badge ? Math.sin(this.time * 3 + i) * 2 : 0;
      ui.panel(x, cy + bob, cw, chh, '#fff', c.kind === 'share' ? C.blueDark : C.pinkDark, 20, 4);
      this.missionIcon(c.kind, x + cw / 2, cy + bob + 42, 30);
      ui.label(c.name, x + cw / 2, cy + bob + 86, 15, C.text); ui.label(c.sub, x + cw / 2, cy + bob + 102, 11, C.textLight);
      const coins = c.reward && c.reward.coins; if (coins) { A.coin(ctx, x + cw / 2 - 18, cy + bob + 118, 7); ui.label('+' + coins, x + cw / 2 - 8, cy + bob + 119, 12, C.goldDark, 'left'); }
      if (c.badge) { A.circle(ctx, x + cw - 8, cy + bob + 8, 13, C.red, 3); ui.label('!', x + cw - 8, cy + bob + 9, 16, C.white); }
      ui.hotspot(c.id, x, cy + bob, cw, chh); }
  }
  // code-drawn icons for the three TikTok rewards (r = radius of the round badge)
  missionIcon(kind, x, y, r) {
    const ctx = this.ctx; const bg = kind === 'share' ? '#bfe9ff' : kind === 'shortcut' ? '#fff0c2' : '#ffd6e6'; A.circle(ctx, x, y, r, bg, 3);
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = C.outline; ctx.lineWidth = 3;
    if (kind === 'profile') { // TikTok profile: a person, with a curved "come back" arrow
      A.circle(ctx, -2, -7, 7, '#fff', 2.5); ctx.beginPath(); ctx.moveTo(-15, 13); ctx.quadraticCurveTo(-2, -4, 11, 13); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = C.pinkDark; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(10, -8, 9, -2.4, 0.75); ctx.stroke();
      { const a = 0.75, ex = 10 + 9 * Math.cos(a), ey = -8 + 9 * Math.sin(a), tx = -Math.sin(a), ty = Math.cos(a), nx = Math.cos(a), ny = Math.sin(a); // arrowhead along the arc's tangent at its end
        ctx.fillStyle = C.pinkDark; ctx.beginPath(); ctx.moveTo(ex + tx * 7, ey + ty * 7); ctx.lineTo(ex + nx * 5.5, ey + ny * 5.5); ctx.lineTo(ex - nx * 5.5, ey - ny * 5.5); ctx.closePath(); ctx.fill(); }
    } else if (kind === 'shortcut') { // a phone home screen with the game icon and a plus
      A.rr(ctx, -12, -19, 24, 38, 6); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
      A.rr(ctx, -7, -10, 14, 14, 4); ctx.fillStyle = C.pink; ctx.fill(); ctx.lineWidth = 2; ctx.stroke(); A.heart(ctx, 0, -3, 4, '#fff', 0);
      A.circle(ctx, 12, 11, 8, C.green, 2.5); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(12, 7); ctx.lineTo(12, 15); ctx.moveTo(8, 11); ctx.lineTo(16, 11); ctx.stroke();
    } else { // share: a curved arrow out of a box
      A.rr(ctx, -14, -2, 22, 18, 5); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = C.blueDark; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-4, 8); ctx.quadraticCurveTo(-2, -12, 12, -12); ctx.stroke(); ctx.fillStyle = C.blueDark; ctx.beginPath(); ctx.moveTo(10, -19); ctx.lineTo(19, -12); ctx.lineTo(10, -5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
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
      if (open) A.streamer(ctx, s, x + cw / 2, y + chh * 0.33, cw / 95 * 0.36, { expr: cur === i ? 'yum' : 'idle', t: this.time, blink: this.face.blink, look: WR.look(p, s.id) });
      else { ctx.globalAlpha = 0.35; A.streamer(ctx, s, x + cw / 2, y + chh * 0.33, cw / 95 * 0.36, { expr: 'idle' }); ctx.globalAlpha = 1; A.lock(ctx, x + cw / 2, y + chh * 0.4, 40); }
      ctx.restore();
      ui.label(s.name, x + cw / 2, y + chh - 54, 22, C.text);
      ui.label(open ? (cur === i ? 'SELECTED' : 'TAP TO PICK') : 'LEVEL ' + s.unlock, x + cw / 2, y + chh - 26, 13, open ? C.pinkDark : C.textLight);
      ui.hotspot('str' + i, x, y, cw, chh);
    }
    ui.label('Dress them up in the WARDROBE!', W / 2, y + chh + 40, 15, C.text);
  }
  // ── MARKET ──
  // Shelf rows: two food rows, plus a locked preview row when a shelf is still to unlock. Spread over the free height.
  shelfGap() { const top = this.top(), bottom = this.bottom(); const rows = this.nextLockedCat() ? 3 : 2; const free = (bottom - 200) - (top + 322) - 110; return U.clamp(free / (rows - 1 || 1), 200, 270); }
  shelfPos(i) { const top = this.top(); const W = this.W; return { x: W * [0.2, 0.5, 0.8][i % 3], y: top + 322 + Math.floor(i / 3) * this.shelfGap() }; }
  nextLockedCat() { return null; } // V2: each level lists its own shelves
  basketRect() { const W = this.W, bottom = this.bottom(); return { x: W * 0.27, y: bottom - 150, w: W * 0.42, h: 92 }; }
  drawMarket() {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, m = this.market, lv = m.lv, p = this.profile;
    A.storeBackground(ctx, this.p.createCanvas, W, H, this.scale);
    const top = this.top();
    ui.button('home', 16, top + 14, 48, 48, '✕', { color: C.red, dark: '#c93b55', size: 24, radius: 16 });
    this.coinsHud(top);
    ui.title('SUPERMARKET', W / 2, top + 100, 40, C.white, C.pinkDark);
    // category header
    const catId = m.cats[m.cat], cat = D.CAT_BY_ID[catId];
    ui.panel(W * 0.2, top + 128, W * 0.6, 48, cat.color, C.outline, 24);
    ui.label(cat.name, W / 2, top + 153, 24, C.text);
    ui.button('cat_prev', W * 0.2 - 58, top + 128, 50, 48, '‹', { color: C.blue, dark: C.blueDark, size: 32, radius: 16 });
    ui.button('cat_next', W * 0.8 + 8, top + 128, 50, 48, '›', { color: C.blue, dark: C.blueDark, size: 32, radius: 16 });
    ui.label('PICK AS MANY AS YOU LIKE · EAT THEM ALL ON STREAM', W / 2, top + 194, 14, C.text);
    // shelves
    const foods = D.foodsOf(catId); const total = this.marketTotal(); const coins = p.get('coins') || 0;
    for (let row = 0; row < 2; row++) { const sp = this.shelfPos(row * 3); A.shelfBoard(ctx, 18, sp.y + 52, W - 36, 30, cat.dark); }
    const locked = this.nextLockedCat();
    if (locked) { // preview of the next shelf to unlock
      const sp = this.shelfPos(6); A.shelfBoard(ctx, 18, sp.y + 52, W - 36, 30, '#d9cfcf');
      const lf = D.foodsOf(locked.id); ctx.globalAlpha = 0.35; for (let i = 0; i < 3; i++) A.foodOn(ctx, lf[i], this.shelfPos(6 + i).x, sp.y + 62, 170, 0); ctx.globalAlpha = 1;
      A.lock(ctx, W / 2, sp.y - 10, 44);
      ui.panel(W / 2 - 120, sp.y + 70, 240, 30, '#fff', C.outline, 15, 3); ui.label(locked.name + '  ·  UNLOCKS AT LEVEL ' + locked.unlock, W / 2, sp.y + 85, 13, C.text);
    }
    const shake = Math.sin(this.time * 40) * m.shake * 6;
    for (let i = 0; i < foods.length; i++) {
      const f = foods[i]; const sp = this.shelfPos(i); const price = D.priceOf(f);
      const afford = coins >= total + price && m.basket.length < 12;
      ctx.globalAlpha = afford ? 1 : 0.55;
      A.foodOn(ctx, f, sp.x + (afford ? 0 : shake), sp.y + 62, 206, this.time);
      ctx.globalAlpha = 1;
      A.priceTag(ctx, sp.x, sp.y + 92, price, !afford);
      if (afford) ui.label('earns ~' + this.estimateEarn([f.id], price), sp.x, sp.y + 117, 12, C.greenDark || '#2f9c55', 'center', { stroke: 3, strokeColor: '#fff' });
      ui.hotspot('item' + i, sp.x - 84, sp.y - 130, 168, 224);
    }
    // bottom: portrait, basket, count + total
    const b = this.basketRect(); const bottom = this.bottom();
    A.rr(ctx, 20, bottom - 170, 88, 150, 16); ctx.fillStyle = '#5b9fff'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.outline; ctx.stroke();
    ctx.save(); A.rr(ctx, 26, bottom - 164, 76, 138, 12); ctx.clip(); ctx.fillStyle = '#ffe3ea'; ctx.fillRect(26, bottom - 164, 76, 138); A.streamer(ctx, this.streamerDef(), 64, bottom - 96, 0.3, { expr: 'yum' }); ctx.restore();
    A.rr(ctx, 36, bottom - 48, 56, 22, 11); ctx.fillStyle = '#ff4a5f'; ctx.fill(); ctx.strokeStyle = C.outline; ctx.lineWidth = 3; ctx.stroke(); ui.label('live', 64, bottom - 37, 13, C.white);
    A.basket(ctx, b.x, b.y, b.w, b.h);
    for (let i = 0; i < m.basket.length; i++) { const f = K.dish(m.basket[i]); const n = m.basket.length; const bx = b.x + b.w * (n === 1 ? 0.5 : 0.18 + 0.64 * i / (n - 1)); const z = n <= 2 ? 150 : n <= 4 ? 128 : n <= 7 ? 108 : 92; A.food(ctx, f, bx, b.y - z * 0.22 - (i % 2) * 12, z, 0, this.time); ui.hotspot('bk' + i, bx - z / 2, b.y - z * 0.72, z, z); }
    for (let i = 0; i < this.flies.length; i++) { const fl = this.flies[i]; const k = U.easeInOut(fl.t); A.food(ctx, fl.food, U.lerp(fl.x0, fl.x1, k), U.lerp(fl.y0, fl.y1, k) - Math.sin(k * Math.PI) * 120, U.lerp(150, 84, k), 0, this.time); }
    ui.panel(W - 150, bottom - 150, 130, 44, '#fff', C.outline, 14); ui.label('🛒', W - 130, bottom - 128, 18, C.text); ui.label(m.basket.length + (m.basket.length === 1 ? ' item' : ' items'), W - 74, bottom - 128, 17, C.text);
    ui.panel(W - 150, bottom - 98, 130, 44, '#fff', C.outline, 14); ui.label('Total', W - 126, bottom - 76, 15, C.text, 'left'); A.coin(ctx, W - 66, bottom - 76, 9); ui.label(String(total), W - 52, bottom - 76, 18, C.text, 'left');
    if (m.basket.length >= 1) { const pulse = 1 + Math.sin(this.time * 6) * 0.05; ctx.save(); ctx.translate(W - 85, bottom - 24); ctx.scale(pulse, pulse); ctx.translate(-(W - 85), -(bottom - 24)); ui.button('confirm', W - 150, bottom - 48, 130, 48, 'GO  ›', { color: C.green, dark: C.greenDark, size: 24 }); ctx.restore(); }
    else ui.label('pick anything!', W - 85, bottom - 24, 14, C.text);
    if (m.basket.length >= 1) { // what this order earns back on the stream
      const earn = this.estimateEarn(m.basket, total), prof = earn - total;
      ui.panel(W - 150, bottom - 214, 130, 58, '#e9fbe9', '#2f9c55', 14, 3);
      ui.label('STREAM EARNS', W - 85, bottom - 200, 11, '#2f9c55'); A.coin(ctx, W - 120, bottom - 178, 8); ui.label('~' + earn, W - 106, bottom - 178, 16, C.text, 'left');
      ui.label((prof >= 0 ? '+' : '') + prof, W - 28, bottom - 178, 14, prof >= 0 ? '#2f9c55' : '#d33', 'right');
    }
    if (!(this.profile.get('tip_market') || 0)) this.drawMarketTip();
  }
  // First visit: how the supermarket pays off (buy → eat live → every bite pays coins back).
  drawMarketTip() { // buy → eat live → more coins back: three big steps, one number each
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H; ui.dim(0.55); ui.hotspot('mtip_block', 0, 0, W, H);
    const f = K.dish('chili_noodle'), price = f ? D.priceOf(f) : 200, earn = this.estimateEarn(['chili_noodle'], price);
    const pw = W - 60, ph = 300, px = 30, py = H * 0.5 - ph / 2; ui.panel(px, py, pw, ph, '#fff7fb', C.pinkDark, 24, 4);
    const cols = [[px + pw * 0.17, 'BUY', '-' + price, '#d33'], [px + pw * 0.5, 'EAT LIVE', '♥', C.pink], [px + pw * 0.83, 'EARN', '+' + earn, '#2f9c55']];
    for (let i = 0; i < 3; i++) { const c = cols[i], y = py + 92; A.circle(ctx, c[0], y, 42, '#fff', 3); if (i === 1) A.heart(ctx, c[0], y + 2, 20, C.pink, 3); else { A.coin(ctx, c[0], y - 8, 16); ui.label(c[2], c[0], y + 22, 18, c[3]); } ui.label(c[1], c[0], y + 62, 16, C.text); if (i < 2) ui.label('›', (c[0] + cols[i + 1][0]) / 2, y, 34, C.pinkDark); }
    ui.title('+' + (earn - price) + ' PROFIT!', W / 2, py + 206, 34, C.white, '#2f9c55');
    ui.button('mtip_ok', W / 2 - 80, py + ph - 58, 160, 46, 'OK!', { color: C.green, dark: C.greenDark, size: 22 });
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
      const lh = Math.max(16, Math.min(24, (m.sh - 100) / Math.max(1, c.items.length))); let y = m.sy + 52;
      const rv = !!c.review, lx = m.sx + (rv ? 40 : 18);
      for (let i = 0; i < c.receipt.length; i++) { const line = c.receipt[i]; if (y > m.sy + m.sh - 50) break;
        if (rv) { const bs = Math.min(22, lh - 2); ui.button('rml' + i, m.sx + 12, y - bs / 2, bs, bs, '✕', { color: C.red, dark: '#c93b55', size: 12, radius: bs / 2 }); }
        ui.label(line.name + ' x1', lx, y, 14, C.text, 'left'); A.coin(ctx, m.sx + m.sw - 56, y, 7); ui.label(String(line.price), m.sx + m.sw - 16, y, 14, C.text, 'right'); y += lh; }
      ctx.strokeStyle = '#c9c0e8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(m.sx + 14, m.sy + m.sh - 44); ctx.lineTo(m.sx + m.sw - 14, m.sy + m.sh - 44); ctx.stroke();
      ui.label('Total', m.sx + 18, m.sy + m.sh - 22, 16, C.text, 'left'); A.coin(ctx, m.sx + m.sw - 62, m.sy + m.sh - 22, 8); ui.label(String(c.total), m.sx + m.sw - 16, m.sy + m.sh - 22, 18, C.text, 'right');
      if (c.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,' + c.flash * 0.6 + ')'; A.rr(ctx, m.px, m.py, m.pw, m.ph, 10); ctx.fill(); }
    }
    // conveyor + items
    const cy = r.y + r.h + 20; A.conveyor(ctx, 20, cy, W - 40, Math.min(120, this.bottom() - cy - 60));
    for (let i = 0; i < c.items.length; i++) { const it = c.items[i]; if (it.scanned) continue; const held = this.drag && this.drag.item === it; A.food(ctx, K.dish(it.id), it.x, it.y, held ? 100 : 86, 0, this.time); }
    if (!c.done && !c.review) { let left = 0; for (let i = 0; i < c.items.length; i++) if (!c.items[i].scanned) left++; ui.label(left ? (c.auto ? 'Scanning…  (drag to scan yourself)' : 'Drag each item onto the scanner  (' + left + ' left)') : '', W / 2, cy + Math.min(120, this.bottom() - cy - 60) + 30, 15, C.text); }
    if (!c.done && c.review) { // check the receipt: ✕ puts an item back, PAY starts the stream
      const ids = c.items.map(function (it) { return it.id; }), earn = this.estimateEarn(ids, c.total), prof = earn - c.total, coins = this.profile.get('coins') || 0;
      ui.panel(30, cy + 4, W - 60, 56, '#e9fbe9', '#2f9c55', 16, 3);
      ui.label('Tap ✕ to put an item back', W / 2, cy + 20, 13, C.textLight);
      ui.label('Stream earns ~' + earn + '   ·   profit ' + (prof >= 0 ? '+' : '') + prof, W / 2, cy + 42, 16, '#2f9c55');
      const by = cy + 74; ui.button('to_shop', 30, by, (W - 80) * 0.4, 56, '‹ SHOP', { color: '#8fd1ff', dark: '#4a9fd8', size: 20 });
      if (coins >= c.total) { const pulse = 1 + Math.sin(this.time * 6) * 0.04, bx = 50 + (W - 80) * 0.4, bw = (W - 80) * 0.6; ctx.save(); ctx.translate(bx + bw / 2, by + 28); ctx.scale(pulse, pulse); ctx.translate(-(bx + bw / 2), -(by + 28)); ui.button('pay', bx, by, bw, 56, 'PAY ' + c.total, { color: C.green, dark: C.greenDark, size: 22 }); ctx.restore(); }
      else ui.label('Not enough coins: put something back', 50 + (W - 80) * 0.7, by + 28, 13, '#d33');
    }
  }
  drawPause() {
    const ui = this.ui, W = this.W, H = this.H;
    ui.dim(0.5);
    ui.panel(W * 0.12, H * 0.3, W * 0.76, 366, C.cream, C.outline, 26);
    ui.title('PAUSED', W / 2, H * 0.3 + 50, 40);
    ui.button('resume', W * 0.2, H * 0.3 + 96, W * 0.6, 62, 'RESUME', { color: C.green, dark: C.greenDark, size: 24 });
    ui.button('leave', W * 0.2, H * 0.3 + 170, W * 0.6, 54, 'HOME (KEEP STREAM)', { color: C.blue, dark: C.blueDark, size: 16 });
    ui.button('sound', W * 0.2, H * 0.3 + 236, W * 0.6, 48, this.profile.get('sound') ? 'SOUND ON' : 'SOUND OFF', { color: C.lavender, dark: C.lavenderDark, size: 16 });
    ui.button('settings', W * 0.2, H * 0.3 + 296, W * 0.6, 48, 'SETTINGS', { color: C.yellow, dark: C.yellowDark, size: 16 });
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
    if (shop) { ui.button('hsshop', 60, y, W - 120, 58, 'REMOVE ADS', { color: C.yellow, dark: C.yellowDark, size: 20 }); y += 70; }
    if (!canFree && !shop) { ui.paragraph('Finish a stream to earn coins — every bite pays!', W / 2, y + 4, W - 140, 15, C.text); y += 30; }
    ui.button('coins_close', 60, y, W - 120, 50, 'CLOSE', { color: C.lavender, dark: C.lavenderDark, size: 18 });
  }
  // ── HS SHOP ──
  drawShop() {
    const ui = this.ui, W = this.W, H = this.H, p = this.profile;
    ui.dim(0.55);
    const top = this.top();
    ui.panel(24, top + 60, W - 48, H - top - 60 - 40, C.cream, C.outline, 26);
    ui.title('NO ADS', W / 2, top + 110, 40, C.white, C.goldDark);
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
  popupBack() { return this.popupFrom === 'levels' ? 'levels' : 'home'; }
  drawPopup() {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, hs = this.hs;
    ui.dim(0.5);
    const kind = this.popup; let title, steps, reward, go;
    if (kind === 'profile') { title = 'REVISIT REWARD'; go = 'GO'; reward = hs.rewardsProfile();
      steps = ['Open your TikTok Profile', 'Tap the menu ☰ and find "Recently used" mini games', 'Open Mukbang ASMR from there', 'Your reward is waiting in the game!']; }
    else if (kind === 'shortcut') { title = 'LAUNCH REWARD'; go = 'ADD'; reward = hs.rewardsShortcut();
      steps = ['Tap ADD below', 'Add Mukbang ASMR to your Home Screen', 'Launch the game from the new icon', 'Your reward is waiting in the game!']; }
    else { title = 'SHARE REWARD'; go = 'SHARE'; reward = hs.rewardsShare(); steps = ['Share Mukbang ASMR with your friends', 'Get a reward once a day']; }
    const ph = 210 + steps.length * 40 + 140, py = (H - ph) / 2;
    ui.panel(30, py, W - 60, ph, C.cream, C.outline, 26);
    ui.title(title, W / 2, py + 46, 30, C.white, C.pinkDark);
    this.missionIcon(kind, W / 2, py + 128, 48);
    let y = py + 206;
    for (let i = 0; i < steps.length; i++) { A.circle(ctx, 66, y, 13, C.pink, 2); ui.label(String(i + 1), 66, y + 1, 14, C.white); ui.label(steps[i], 88, y, 15, C.text, 'left'); y += 40; }
    const coins = reward && reward.coins; ui.panel(W / 2 - 110, y + 2, 220, 44, '#fff8d6', C.goldDark, 22, 3);
    if (coins) { A.coin(ctx, W / 2 - 64, y + 24, 12); ui.label('REWARD +' + coins, W / 2 - 46, y + 25, 18, C.goldDark, 'left'); } else ui.label(reward ? 'REWARD: ' + this.itemsText(reward) : 'No reward right now', W / 2, y + 25, 16, C.goldDark);
    ui.button('popup_go', 50, y + 62, (W - 110) / 2, 58, go, { color: C.pink, dark: C.pinkDark, size: 24 });
    ui.button('popup_close', 60 + (W - 110) / 2, y + 62, (W - 110) / 2, 58, 'LATER', { color: C.lavender, dark: C.lavenderDark, size: 20 });
  }

  // Settings: sound, and — only in the web / artifact build (platform.devTools) — a tester's "unlock all levels".
  // It only opens the levels: levels_done is untouched, so each first clear still pays its level bonus once.
  // test build only: back to a brand-new player (level 1, 500 coins, no looks, tutorials shown again)
  resetProgress() {
    const p = this.profile, D0 = { level: 1, levels_done: 0, coins: 500, streamer: 0, stars_json: '{}', run_json: '', streams: 0, best_viewers: 0, combo_best: 0, foods_json: '[]', wardrobe_json: '{}', ad_stats: '{}', tip_market: 0, tip_goal: 0 };
    for (const k in D0) p.set(k, D0[k]);
    this.run = null; this.ck = null; this.result = null; this.market = null; this.autoplay = false; this.auto = null; this.adLog = [];
    this.audio.play('whoosh'); this.setState('home'); this.showToast('PROGRESS RESET', 'Level 1 · 500 coins');
  }
  unlockAll() {
    if (!this.p.devTools) return;
    if ((this.profile.get('level') || 1) < L.LEVEL_COUNT) this.profile.set('level', L.LEVEL_COUNT);
    // the level opens Shop / Delivery / Buffet / Wardrobe / Kiko / Momo; the level-gift looks are granted too
    for (let i = 0; i < WR.ITEMS.length; i++) if (WR.ITEMS[i].gift) WR.grant(this.profile, WR.ITEMS[i].id);
    this.audio.play('levelup'); this.spawnConfetti(this.W / 2, this.H * 0.4, 40); this.showToast('All ' + L.LEVEL_COUNT + ' levels unlocked', 'Every activity, streamer and gift look too');
  }
  drawSettings() {
    const ui = this.ui, W = this.W, H = this.H, p = this.profile, dev = !!this.p.devTools;
    ui.dim(0.5);
    const ph = dev ? 470 : 240, py = (H - ph) / 2;
    ui.panel(40, py, W - 80, ph, C.cream, C.outline, 26);
    ui.title('SETTINGS', W / 2, py + 46, 32, C.white, C.pinkDark);
    let y = py + 88;
    ui.button('sound', 64, y, W - 128, 58, p.get('sound') ? 'SOUND ON' : 'SOUND OFF', { color: C.blue, dark: C.blueDark, size: 20 }); y += 72;
    if (dev) {
      const all = this.curLevel() >= L.LEVEL_COUNT;
      ui.button('unlock_all', 64, y, W - 128, 58, all ? 'ALL LEVELS UNLOCKED ✓' : 'UNLOCK ALL LEVELS', { color: all ? '#e0d6d6' : C.yellow, dark: all ? '#bfb0b0' : C.yellowDark, size: 19, disabled: all });
      y += 70; const armed = this.resetArm && this.time - this.resetArm < 3;
      ui.button('reset_progress', 64, y, W - 128, 58, armed ? 'TAP AGAIN TO RESET' : 'RESET PROGRESS', { color: armed ? C.red : '#e0d6d6', dark: armed ? '#c93b55' : '#bfb0b0', size: 19 });
      y += 70; ui.button('auto_play', 64, y, W - 128, 58, this.autoplay ? 'AUTO PLAY: ON' : 'AUTO PLAY: OFF', { color: this.autoplay ? C.green : C.blue, dark: this.autoplay ? C.greenDark : C.blueDark, size: 19 });
      ui.label('test build only — not in the TikTok version', W / 2, y + 72, 13, C.textLight); y += 90;
    }
    ui.button('settings_close', 64, y, W - 128, 52, 'CLOSE', { color: C.lavender, dark: C.lavenderDark, size: 18 });
  }
  // Browser-only QA helper: jump to a screen (#auto=<screen>[:level])
  //   home levels streamers settings wardrobe · stream sealed open chew react finale result · market checkout delivery arrive buffet kitchen cook
  autoDemo(kind, n) {
    n = n || 5; this.profile.set('coins', Math.max(5000, this.profile.get('coins') || 0));
    if (n > 1 && (this.profile.get('level') || 1) < n) { this.profile.set('level', n); this.profile.set('levels_done', n - 1); this.profile.set('streams', n - 1); }
    if (kind === 'home' || kind === 'levels' || kind === 'streamers' || kind === 'settings' || kind === 'wardrobe') { this.run = null; this.saveRun(); this.setState(kind === 'wardrobe' && this.curLevel() < WR.OPEN_AT ? 'home' : kind); return; }
    const sides = { market: 'market', checkout: 'market', delivery: 'delivery', arrive: 'delivery', buffet: 'buffet' };
    if (sides[kind]) {
      this.run = null; this.enterActivity(sides[kind]);
      if (kind === 'checkout' || kind === 'arrive') this.sceneAutoFill();
      return;
    }
    this.startStream(n); const r = this.run; const self = this;
    const step = function (secs) { for (let i = 0; i < secs * 60; i++) self.update(1 / 60); };
    if (kind === 'request' || kind === 'stream' || kind === 'sealed') { for (let i = 0; i < 3; i++) this.pushChat('idle'); return; }
    this.enterCook(); const k = this.ck;
    const cookTo = function (stop) { let g = 0; while (self.ck && self.ck.doneT < 0 && g++ < 30) { const st = self.curCookStep(); if (stop && st.t === stop) return true; if (st.t === 'pick') { const want = k.req[CK.SLOT_KEY[st.slot]]; self.cookTap('cko_' + (want && k.opts.some(function (o) { return o.id === want; }) ? want : k.opts[0].id)); self.cookTap('ck_ok'); } else if (st.t === 'pour') k.st.fill = 0.999, k.holdId = 1, step(0.1), k.holdId = null; else if (st.t === 'hold') k.prog = 0.999, k.holdId = 1, step(0.1), k.holdId = null; else if (st.t === 'flip') k.flipT = 0.59, step(0.1); else if (st.t === 'place') { k.st.tops = st.n - 1; const a = self.cookArea(); self.cookTouch('start', 1, a.x, a.y); } else if (st.t === 'shake') { k.st.deco = 0.999; const a = self.cookArea(); self.cookTouch('start', 1, a.x, a.y); self.cookTouch('move', 1, a.x + 40, a.y); } } return false; };
    if (kind === 'cook') { cookTo('pour'); return; }
    if (kind === 'cookpick') { return; }
    if (kind === 'cooktool') { cookTo('hold'); return; }
    if (kind === 'cooktop') { cookTo('place'); return; }
    cookTo(null); if (kind === 'perfect') { step(0.6); return; }
    step(2); if (kind === 'open') return;
    const feed = function () { const pp = self.platePos(r.pickups); self.carry = { tid: 9, x: pp.x, y: pp.y, drag: false, fx: pp.x, fy: pp.y, ft: 0, back: false }; r.phase = 'carry'; r.pt = 0; };
    feed(); step(0.5);
    if (kind === 'chew') { step(1.0); return; }
    step(2.0); if (kind === 'react') return;
    for (let k = 0; k < 2; k++) { step(1.0); feed(); step(0.5 + 2.3 + 1.5); }
    if (kind === 'finale') { step(1.3); return; }
    step(4.5);
  }
}

SC.install(Game);
ST.install(Game);
WS.install(Game);
AP.install(Game);
CK.install(Game);

module.exports = { Game };
