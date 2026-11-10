'use strict';
// V2 food-source scenes, installed onto Game.prototype (docs/GAME-DESIGN-V2.md §4):
//   delivery → arrive  · phone app: restaurant tabs, mains + optional sides, ORDER, scooter arrives
//   buffet             · pick portions with tongs onto the plate, pay the ticket, stream at the restaurant
//   kitchen            · recipe kit + optional toppings, 2–3 quick prep steps, stream the homemade dish
// Supermarket stays in game.js (market → checkout with auto-scan).
const U = require('./util.js');
const D = require('./data.js');
const A = require('./art.js');
const K = require('./catalog.js');
const C = D.COLORS;

const SCENES = ['delivery', 'arrive', 'buffet', 'kitchen'];
const ARRIVE_T = 2.4;

function install(Game) {
  const P = Game.prototype;
  P.sceneIs = function (s) { return SCENES.indexOf(s) >= 0; };

  // ── shared dispatch ──
  P.sceneUpdate = function (dt) {
    if (this.state === 'arrive') { this.updateArrive(dt); return true; }
    if (this.state === 'buffet') { this.updateBuffet(dt); return true; }
    if (this.state === 'kitchen') { this.updateKitchen(dt); return true; }
    return this.state === 'delivery';
  };
  P.sceneDraw = function () {
    if (this.state === 'delivery') this.drawDelivery();
    else if (this.state === 'arrive') this.drawArrive();
    else if (this.state === 'buffet') this.drawBuffet();
    else if (this.state === 'kitchen') this.drawKitchen();
  };
  P.sceneTouch = function (kind, id, x, y) {
    if (this.state === 'arrive' && kind === 'start') { this.arriveDone(); return true; }
    if (this.state === 'buffet') return this.buffetTouch(kind, id, x, y);
    if (this.state === 'kitchen') return this.kitchenTouch(kind, id, x, y);
    return false;
  };
  P.sceneTap = function (id) {
    if (id.indexOf('drest') === 0) { this.deliv.rest = +id.slice(5); this.audio.play('whoosh', { gain: 0.5 }); return true; }
    if (id.indexOf('dmain_') === 0) { this.toggleMain(id.slice(6)); return true; }
    if (id.indexOf('dside_') === 0) { this.toggleSide(id.slice(6)); return true; }
    if (id === 'dorder') { this.placeOrder(); return true; }
    if (id.indexOf('bst') === 0) { this.buf.st = +id.slice(3); this.audio.play('whoosh', { gain: 0.5 }); return true; }
    if (id.indexOf('bpl') === 0) { const i = +id.slice(3); if (i < this.buf.plate.length) { this.buf.plate.splice(i, 1); this.audio.play('drop'); } return true; }
    if (id === 'bgo') { this.buffetGo(); return true; }
    if (id.indexOf('ktop_') === 0) { this.toggleTopping(id.slice(5)); return true; }
    if (id === 'kgo') { this.kitStart(); return true; }
    if (id === 'krec') { const k = this.kit, list = k.lv.kitchen.recipes || [k.rec.id]; const i = (list.indexOf(k.rec.id) + 1) % list.length; k.rec = K.RECIPE_BY_ID[list[i]]; k.tops = []; this.audio.play('whoosh', { gain: 0.5 }); return true; }
    return false;
  };
  // QA / tests: complete the current food-source scene without input
  P.sceneAutoFill = function () {
    if (this.state === 'market') { const m = this.market; const foods = D.foodsOf(m.cats[0]); const foods2 = D.foodsOf(m.cats[Math.min(1, m.cats.length - 1)]); while (m.basket.length < (this.autoItems || 1)) m.basket.push((m.basket.length % 2 ? foods2 : foods)[m.basket.length % 6].id); this.beginCheckout(); this.checkout.autoPay = true; return; }
    if (this.state === 'delivery') { const d = this.deliv; const mains = this.deliveryMains(); for (let i = 0; d.mains.length < (this.autoItems || 1) && i < 20; i++) d.mains.push(mains[i % mains.length].id); this.placeOrder(); return; }
    if (this.state === 'buffet') { const b = this.buf; const items = this.buffetItems(); for (let i = 0; b.plate.length < (this.autoItems || 1) && i < 20; i++) b.plate.push(items[i % items.length].id); this.buffetGo(); return; }
    if (this.state === 'kitchen') { if (this.kit.phase === 'choose') this.kitStart(); const k = this.kit; while (k.phase === 'cook') { k.prog = 1; this.stepCheck(); } this.kitFinish(); }
  };

  // ════════ FOOD DELIVERY ════════
  P.enterDelivery = function (lv) { this.deliv = { lv: lv, rest: 0, mains: [], sides: [] }; this.setState('delivery'); };
  P.deliveryRests = function () { return this.deliv.lv.delivery.rest.map(K.restaurant); };
  P.deliveryMains = function () { const out = []; const rs = this.deliveryRests(); for (let i = 0; i < rs.length; i++) Array.prototype.push.apply(out, K.mainsOf(rs[i].id)); out.sort(function (a, b) { return a.price - b.price; }); return out; };
  P.deliveryTotal = function () { const d = this.deliv; let t = 0; for (let i = 0; i < d.mains.length; i++) t += K.dish(d.mains[i]).price; for (let i = 0; i < d.sides.length; i++) t += K.dish(d.sides[i]).price; return t; };
  P.toggleMain = function (id) {
    const d = this.deliv, need = d.lv.delivery.mains, i = d.mains.indexOf(id);
    if (i >= 0) { d.mains.splice(i, 1); this.audio.play('drop'); return; }
    if ((this.profile.get('coins') || 0) < this.deliveryTotal() + K.dish(id).price) { this.audio.play('error'); this.showToast('Not enough coins', 'Pick a cheaper dish'); return; }
    d.mains.push(id); this.audio.play('pop');
  };
  P.toggleSide = function (id) {
    const d = this.deliv, max = d.lv.delivery.sides, i = d.sides.indexOf(id);
    if (i >= 0) { d.sides.splice(i, 1); this.audio.play('drop'); return; }

    if ((this.profile.get('coins') || 0) < this.deliveryTotal() + K.dish(id).price) { this.audio.play('error'); this.showToast('Not enough coins'); return; }
    d.sides.push(id); this.audio.play('pop');
  };
  P.placeOrder = function () {
    const d = this.deliv; if (d.mains.length < 1) { this.audio.play('error'); this.showToast('Pick a main dish'); return; }
    const cost = this.deliveryTotal(); if ((this.profile.get('coins') || 0) < cost) { this.audio.play('error'); this.showToast('Not enough coins'); return; }
    this.profile.add('coins', -cost); this.audio.play('cash');
    d.cost = cost; d.t = 0; d.dinged = false; d.dropped = false;
    this.setState('arrive'); this.audio.play('whoosh');
  };
  P.updateArrive = function (dt) {
    const d = this.deliv; d.t += dt;
    if (d.t > 1.1 && !d.dinged) { d.dinged = true; this.audio.play('ding'); this.setFace('open', 1); }
    if (d.t > 1.6 && !d.dropped) { d.dropped = true; this.audio.play('drop'); this.vibrate('short'); }
    if (d.t >= ARRIVE_T) this.arriveDone();
  };
  P.arriveDone = function () {
    const d = this.deliv; if (this.state !== 'arrive') return;
    this.startFoodStream(d.mains[0], { side: 'delivery', cost: d.cost, queue: d.mains.slice(1).concat(d.sides) });
  };
  P.drawDelivery = function () {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, d = this.deliv, lv = d.lv;
    A.homeRoom(ctx, lv.view, this.p.createCanvas, W, H, this.scale, this.time); ui.dim(0.25);
    const top = this.top(), bottom = this.bottom();
    ui.button('home', 16, top + 14, 48, 48, '✕', { color: C.red, dark: '#c93b55', size: 24, radius: 16 });
    this.coinsHud(top);
    const px = 22, py = top + 72, pw = W - 44, ph = bottom - py - 12;
    A.rr(ctx, px, py, pw, ph, 38); ctx.fillStyle = '#3d3550'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.outline; ctx.stroke();
    const sx = px + 10, sy = py + 10, sw = pw - 20, sh = ph - 20;
    A.rr(ctx, sx, sy, sw, sh, 30); ctx.fillStyle = '#fff8f4'; ctx.fill();
    // app header
    A.rr(ctx, sx, sy, sw, 58, 30); ctx.fillStyle = C.pink; ctx.fill(); ctx.fillRect(sx, sy + 30, sw, 28);
    ui.label('YUMGO', sx + 24, sy + 30, 26, C.white, 'left', { stroke: 5 }); ui.label('delivery to: HOME  ·  LV ' + lv.n, sx + sw - 18, sy + 31, 13, C.white, 'right', { stroke: 3 });
    // restaurant tabs
    const rs = this.deliveryRests(); const tw = (sw - 20 - (rs.length - 1) * 6) / rs.length; let y = sy + 68;
    // tabs: the restaurant's signature dish + what it serves (the logo letters alone meant nothing)
    for (let i = 0; i < rs.length; i++) { const tx = sx + 10 + i * (tw + 6), on = d.rest === i;
      ui.button('drest' + i, tx, y, tw, 62, '', { color: on ? rs[i].color : '#efe6e6', dark: on ? rs[i].dark : '#cfc2c2', radius: 14 });
      const dd = K.dish(rs[i].dish); if (dd) A.food(ctx, dd, tx + tw / 2, y + 24, Math.min(42, tw * 0.6), 0, 0);
      ui.label(rs[i].tab || rs[i].icon, tx + tw / 2, y + 51, rs.length > 4 ? 11 : 12, on ? C.white : C.text, 'center', on ? { stroke: 3 } : null); }
    y += 72;
    // mains of the selected restaurant
    const r = rs[Math.min(d.rest, rs.length - 1)]; const mains = K.mainsOf(r.id); const coins = this.profile.get('coins') || 0;
    ui.label(r.name.toUpperCase() + '  ·  ORDER AS MUCH AS YOU LIKE', sx + 16, y + 8, 14, C.textLight, 'left'); y += 20;
    for (let i = 0; i < mains.length; i++) {
      const f = mains[i]; const on = d.mains.indexOf(f.id) >= 0; const ch = 112;
      ui.panel(sx + 10, y, sw - 20, ch, on ? '#eafff0' : '#fff', on ? C.greenDark : C.outline, 18, on ? 5 : 3);
      A.food(ctx, f, sx + 70, y + ch / 2 + 4, 96, 0, this.time);
      ui.label(f.name, sx + 132, y + 30, 19, C.text, 'left');
      ui.label(f.tags.slice(0, 3).join(' · ') + (f.heat ? '  ·  HOT x' + f.heat : ''), sx + 132, y + 56, 13, f.heat ? '#e0502a' : C.textLight, 'left');
      A.coin(ctx, sx + 142, y + 86, 10); ui.label(String(f.price), sx + 158, y + 87, 18, coins >= f.price ? C.text : C.red, 'left');
      ui.button('dmain_' + f.id, sx + sw - 120, y + 32, 96, 48, on ? '✓' : 'ADD', { color: on ? C.green : C.pink, dark: on ? C.greenDark : C.pinkDark, size: on ? 26 : 18, radius: 16 });
      y += ch + 8;
    }
    // sides
    if (lv.delivery.sides) {
      ui.label('ADD SIDES (OPTIONAL, MAX ' + lv.delivery.sides + ')', sx + 16, y + 10, 14, C.textLight, 'left'); y += 24;
      const sides = K.sides(); const cw = (sw - 20 - 12) / 3, chh = 82;
      for (let i = 0; i < sides.length; i++) {
        const f = sides[i], on = d.sides.indexOf(f.id) >= 0; const cx = sx + 10 + (i % 3) * (cw + 6), cy = y + Math.floor(i / 3) * (chh + 6);
        ui.panel(cx, cy, cw, chh, on ? '#eafff0' : '#fff', on ? C.greenDark : C.outline, 14, on ? 4 : 2);
        A.food(ctx, f, cx + 34, cy + chh / 2, 54, 0, this.time);
        ui.label(f.name, cx + 64, cy + 28, 12, C.text, 'left'); A.coin(ctx, cx + 72, cy + 54, 7); ui.label(String(f.price), cx + 84, cy + 55, 14, C.text, 'left');
        ui.hotspot('dside_' + f.id, cx, cy, cw, chh);
      }
      y += 2 * (chh + 6);
    }
    // footer: total + ORDER
    const fy = sy + sh - 74; const total = this.deliveryTotal(); const ready = d.mains.length >= 1;
    ctx.fillStyle = '#ffe9f0'; ctx.fillRect(sx, fy - 6, sw, 2);
    ui.label('ITEMS ' + (d.mains.length + d.sides.length), sx + 20, fy + 20, 15, C.text, 'left'); A.coin(ctx, sx + 30, fy + 46, 10); ui.label(U.fmtCoins(total), sx + 46, fy + 47, 20, C.text, 'left');
    if (ready) { const pulse = 1 + Math.sin(this.time * 6) * 0.04; ctx.save(); ctx.translate(sx + sw - 110, fy + 32); ctx.scale(pulse, pulse); ctx.translate(-(sx + sw - 110), -(fy + 32)); ui.button('dorder', sx + sw - 200, fy + 6, 180, 54, 'ORDER  ›', { color: C.green, dark: C.greenDark, size: 24 }); ctx.restore(); }
    else ui.label('pick a dish', sx + sw - 110, fy + 33, 15, C.textLight);
  };
  P.drawArrive = function () {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, d = this.deliv, lv = d.lv, t = d.t;
    A.homeRoom(ctx, lv.view, this.p.createCanvas, W, H, this.scale, this.time);
    const hp = this.headPos(); A.streamer(ctx, this.streamerDef(), hp.x, hp.y, hp.s, { expr: t > 1.1 ? 'yum' : 'open', t: this.time, bob: Math.sin(this.time * 6) * 4 });
    A.table(ctx, lv.view, W, H * 0.5, H);
    // scooter rides in from the right, stops, rides off
    const k = U.easeOutCubic(Math.min(1, t / 1.0)); const leave = Math.max(0, t - 1.7) * 900;
    A.scooter(ctx, U.lerp(W + 140, W * 0.68, k) + leave, H * 0.84, 1.1, this.time);
    if (t > 1.1) { const a = Math.min(1, (t - 1.1) * 4); ctx.globalAlpha = a; ui.title('DING DONG!', W / 2, H * 0.47, 40, C.white, C.pinkDark); ctx.globalAlpha = 1; }
    if (t > 1.2) { const bt = Math.min(1, (t - 1.2) / 0.5); const by = U.lerp(H * 0.4, H * 0.66, bt * bt) - Math.abs(Math.sin(bt * Math.PI * 2)) * 20 * (1 - bt); const rs = K.restaurant(K.dish(d.mains[0]).group); A.takeoutBox(ctx, W / 2, by, 150, rs ? rs.color : C.pink, rs ? rs.icon : 'GO', this.time); }
    ui.label('YOUR ORDER IS HERE!', W / 2, H * 0.56, 22, C.white, 'center', { stroke: 6 });
    ui.label('tap to skip', W / 2, this.bottom() - 30, 13, C.white, 'center', { stroke: 4 });
  };

  // ════════ BUFFET ════════
  P.enterBuffet = function (lv) { this.buf = { lv: lv, st: 0, plate: [], held: null, flies: [] }; this.setState('buffet'); };
  P.buffetStations = function () { return this.buf.lv.buffet.stations.map(K.station); };
  P.buffetItems = function () { const st = this.buffetStations()[this.buf.st]; return K.stationItems(st.id); };
  P.panRect = function (i) { const top = this.top(); const cw = (this.W - 48) / 3; const tabs = this.buf.lv.buffet.stations.length > 1 ? 52 : 0; return { x: 24 + (i % 3) * cw + 4, y: top + 150 + tabs + Math.floor(i / 3) * 132, w: cw - 8, h: 120 }; };
  P.plateGeo = function () { const W = this.W, b = this.bottom(); return { x: W / 2, y: b - 200, rx: Math.min(230, W * 0.44), ry: this.buf && this.plateSlots() > 3 ? 92 : 74 }; };
  P.plateSlots = function () { return Math.min(9, Math.max(this.buf.lv.buffet.slots, this.buf.plate.length + 1)); };
  P.plateSlot = function (i) { const g = this.plateGeo(), n = this.plateSlots(); const per = n <= 3 ? n : Math.ceil(n / 2); const row = Math.floor(i / per), col = i % per, cnt = row === 0 ? per : n - per; const sp = Math.min(96, (g.rx * 1.7) / Math.max(1, cnt)); return { x: g.x + (col - (cnt - 1) / 2) * sp, y: g.y + (n <= 3 ? -8 : row === 0 ? -34 : 34) }; };
  P.addToPlate = function (id, fx, fy) {
    const b = this.buf; if (b.plate.length >= 9) { this.audio.play('error'); this.showToast('Your plate is piled high!', "Tap LET'S EAT"); return; }
    const s = this.plateSlot(b.plate.length); b.plate.push(id); b.flies.push({ id: id, x0: fx, y0: fy, x1: s.x, y1: s.y, t: 0 }); this.audio.play('pop'); this.vibrate('short');
  };
  P.buffetBonus = function () {
    const b = this.buf; const tastes = []; let spicy = 0;
    for (let i = 0; i < b.plate.length; i++) { const d = K.dish(b.plate[i]); if (tastes.indexOf(d.taste) < 0) tastes.push(d.taste); if (d.taste === 'spicy') spicy++; }
    if (b.plate.length >= 3 && spicy === b.plate.length) return { v: 0.12, text: 'SPICY PLATE BONUS' };
    if (tastes.length >= 3) return { v: 0.1, text: 'VARIETY BONUS' };
    return { v: 0, text: '' };
  };
  P.buffetGo = function () {
    const b = this.buf, fee = b.lv.buffet.fee;
    if (b.plate.length < 1) { this.audio.play('error'); this.showToast('Put some food on your plate'); return; }
    if ((this.profile.get('coins') || 0) < fee) { this.audio.play('error'); this.showToast('Not enough coins'); return; }
    this.profile.add('coins', -fee); this.audio.play('cash');
    this.startFoodStream(b.plate[0], { side: 'buffet', cost: fee, loc: 'restaurant', queue: b.plate.slice(1) });
  };
  P.buffetTouch = function (kind, id, x, y) {
    const b = this.buf;
    if (kind === 'start') {
      const items = this.buffetItems();
      for (let i = 0; i < items.length; i++) { const r = this.panRect(i); if (x > r.x && x < r.x + r.w && y > r.y && y < r.y + r.h) { b.held = { tid: id, id: items[i].id, x: x, y: y, sx: x, sy: y, moved: false, from: r }; this.audio.play('click'); return true; } }
      return false;
    }
    if (!b.held || b.held.tid !== id) return false;
    if (kind === 'move') { b.held.x = x; b.held.y = y; if (U.dist(x, y, b.held.sx, b.held.sy) > 14) b.held.moved = true; return true; }
    const h = b.held; b.held = null; const g = this.plateGeo();
    if (!h.moved || (Math.abs(x - g.x) < g.rx + 30 && Math.abs(y - g.y) < g.ry + 60)) this.addToPlate(h.id, h.x, h.y); else this.audio.play('drop');
    return true;
  };
  P.updateBuffet = function (dt) { const b = this.buf; for (let i = b.flies.length - 1; i >= 0; i--) { const f = b.flies[i]; f.t += dt * 3; if (f.t >= 1) b.flies.splice(i, 1); } };
  P.drawBuffet = function () {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, b = this.buf, lv = b.lv, top = this.top(), bottom = this.bottom();
    A.restaurantBg(ctx, W, H, this.time); ui.dim(0.12);
    ui.button('home', 16, top + 14, 48, 48, '✕', { color: C.red, dark: '#c93b55', size: 24, radius: 16 });
    this.coinsHud(top);
    ui.title('BUFFET', W / 2, top + 100, 40, C.white, C.pinkDark);
    const sts = this.buffetStations(); let y = top + 128;
    if (sts.length > 1) { const tw = (W - 40 - (sts.length - 1) * 6) / sts.length; for (let i = 0; i < sts.length; i++) ui.button('bst' + i, 20 + i * (tw + 6), y, tw, 44, sts.length > 3 ? sts[i].name.split(' ')[0] : sts[i].name, { color: b.st === i ? sts[i].color : '#efe6e6', dark: b.st === i ? sts[i].dark : '#cfc2c2', size: sts.length > 3 ? 12 : 13, radius: 14 }); }
    else ui.label(sts[0].name.toUpperCase(), W / 2, y + 16, 18, C.white, 'center', { stroke: 5 });
    // counter with pans
    const items = this.buffetItems(); const r0 = this.panRect(0), r5 = this.panRect(5);
    A.rr(ctx, 14, r0.y - 14, W - 28, r5.y + r5.h - r0.y + 28, 22); ctx.fillStyle = '#c9c9d9'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.outline; ctx.stroke();
    for (let i = 0; i < items.length; i++) { const r = this.panRect(i); A.buffetPan(ctx, r.x, r.y, r.w, r.h, sts[b.st].color); if (!(b.held && b.held.id === items[i].id && b.held.moved)) A.food(ctx, items[i], r.x + r.w / 2, r.y + r.h / 2 - 6, 84, 0, this.time); ui.label(items[i].name, r.x + r.w / 2, r.y + r.h - 12, 11, C.text); if (items[i].heat) ui.label('HOT x' + items[i].heat, r.x + r.w - 10, r.y + 14, 10, '#e0502a', 'right'); }
    // plate
    const g = this.plateGeo();
    A.ellipse(ctx, g.x, g.y + 8, g.rx, g.ry, '#e9eef8', 0); A.ellipse(ctx, g.x, g.y, g.rx, g.ry, '#fff', 5); A.ellipse(ctx, g.x, g.y, g.rx * 0.82, g.ry * 0.72, '#f4f7ff', 0);
    const n = this.plateSlots();
    for (let i = 0; i < n; i++) { const s = this.plateSlot(i); if (i < b.plate.length) { const flying = b.flies.some(function (f) { return f.id === b.plate[i] && i === b.plate.length - 1 && f.t < 1; }); if (!flying) A.food(ctx, K.dish(b.plate[i]), s.x, s.y, 72, 0, this.time); ui.hotspot('bpl' + i, s.x - 34, s.y - 34, 68, 68); } else { ctx.setLineDash([6, 6]); ctx.strokeStyle = 'rgba(91,61,59,0.3)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(s.x, s.y, 26, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); } }
    for (let i = 0; i < b.flies.length; i++) { const f = b.flies[i], k = U.easeInOut(f.t); A.food(ctx, K.dish(f.id), U.lerp(f.x0, f.x1, k), U.lerp(f.y0, f.y1, k) - Math.sin(k * Math.PI) * 80, U.lerp(84, 72, k), 0, this.time); }
    // tongs: following the finger while picking, resting by the plate otherwise
    if (b.held) { A.food(ctx, K.dish(b.held.id), b.held.x, b.held.y + 6, 80, 0, this.time); A.tongs(ctx, b.held.x, b.held.y - 10, 1); }
    else A.tongs(ctx, W - 50, g.y + 40, 0.2);
    // info + go
    const bonus = this.buffetBonus();
    ui.label('PLATE ' + b.plate.length + (b.plate.length === 1 ? ' DISH' : ' DISHES') + (bonus.text ? '  ·  ' + bonus.text + '!' : ''), W / 2, g.y - g.ry - 18, 16, bonus.text ? C.yellow : C.white, 'center', { stroke: 5 });
    ui.label(b.plate.length ? 'drag with the tongs or tap a dish · tap the plate to put back' : 'TAP OR DRAG FOOD ONTO YOUR PLATE', W / 2, g.y - g.ry - 42, 13, C.white, 'center', { stroke: 4 });
    A.coin(ctx, 40, bottom - 40, 11); ui.label('TICKET ' + U.fmtCoins(lv.buffet.fee), 56, bottom - 39, 17, C.white, 'left', { stroke: 4 });
    if (b.plate.length >= 1) { const pulse = 1 + Math.sin(this.time * 6) * 0.04; ctx.save(); ctx.translate(W - 110, bottom - 40); ctx.scale(pulse, pulse); ctx.translate(-(W - 110), -(bottom - 40)); ui.button('bgo', W - 200, bottom - 68, 180, 56, "LET'S EAT  ›", { color: C.green, dark: C.greenDark, size: 22 }); ctx.restore(); }
  };

  // ════════ DIY KITCHEN ════════
  P.enterKitchen = function (lv) { const rec = K.RECIPE_BY_ID[lv.kitchen.recipe]; this.kit = { lv: lv, rec: rec, phase: 'choose', tops: [], step: 0, prog: 0, dots: [], turns: 0, ang: null, rub: null, holdId: null, drop: null, flash: 0, doneT: 0 }; this.setState('kitchen'); };
  P.kitTotal = function () { const k = this.kit; let t = k.rec.price; for (let i = 0; i < k.tops.length; i++) t += K.TOPPINGS[k.tops[i]][2]; return t; };
  P.toggleTopping = function (id) {
    const k = this.kit, i = k.tops.indexOf(id);
    if (i >= 0) { k.tops.splice(i, 1); this.audio.play('drop'); return; }
    if ((this.profile.get('coins') || 0) < this.kitTotal() + K.TOPPINGS[id][2]) { this.audio.play('error'); this.showToast('Not enough coins'); return; }
    k.tops.push(id); this.audio.play('pop');
  };
  P.kitStart = function () {
    const k = this.kit; if (k.phase !== 'choose') return;
    const cost = this.kitTotal(); if ((this.profile.get('coins') || 0) < cost) { this.audio.play('error'); this.showToast('Not enough coins'); return; }
    this.profile.add('coins', -cost); this.audio.play('cash'); k.cost = cost; k.phase = 'cook'; k.step = 0; k.prog = 0; this.trans = 0.25;
  };
  P.workArea = function () { return { x: this.W / 2, y: this.H * 0.47, r: Math.min(170, this.W * 0.33) }; };
  P.dropIcon = function () { const a = this.workArea(); return { x: 70, y: a.y + a.r + 70 }; };
  P.curStep = function () { const k = this.kit; return k.rec.steps[k.step]; };
  P.stepCheck = function () {
    const k = this.kit; if (k.phase !== 'cook' || k.prog < 1) return;
    this.audio.play('ding'); this.spawnSparkles(this.workArea().x, this.workArea().y, 14); k.flash = 0.4;
    k.step++; k.prog = 0; k.turns = 0; k.ang = null; k.rub = null; k.holdId = null; k.drop = null;
    if (k.step >= k.rec.steps.length) { k.phase = 'done'; k.doneT = 0; this.audio.play('levelup'); this.spawnConfetti(this.W / 2, this.H * 0.4, 40); }
  };
  P.kitFinish = function () {
    const k = this.kit; if (k.phase !== 'done') return; k.phase = 'gone';
    let dish = k.rec.dish; if (dish === 'mystery') { const pool = K.MYSTERY.rare.concat(K.MYSTERY.funny); dish = pool[Math.floor(Math.random() * pool.length)]; }
    this.startFoodStream(dish, { side: 'kitchen', cost: k.cost, toppings: k.tops.slice() });
    this.floatText('HOMEMADE!', this.W / 2, this.H * 0.47, C.gold, 30, true);
  };
  P.updateKitchen = function (dt) {
    const k = this.kit; k.flash = Math.max(0, k.flash - dt);
    if (k.phase === 'cook') { const st = this.curStep(); if (st.type === 'hold' && k.holdId !== null) { k.prog = Math.min(1, k.prog + dt / st.need); if (Math.random() < dt * 8) this.audio.play('fizz', { gain: 0.3, minGap: 0.2 }); this.stepCheck(); } }
    else if (k.phase === 'done') { k.doneT += dt; if (k.doneT > 1.2) this.kitFinish(); }
  };
  P.kitchenTouch = function (kind, id, x, y) {
    const k = this.kit; if (k.phase !== 'cook') return false;
    const a = this.workArea(), st = this.curStep(); const inArea = U.dist(x, y, a.x, a.y) < a.r + 30;
    if (kind === 'start') {
      if (st.type === 'drop') { const di = this.dropIcon(); if (U.dist(x, y, di.x, di.y) < 60) { k.drop = { tid: id, x: x, y: y }; this.audio.play('click'); return true; } return false; }
      if (!inArea) return false;
      if (st.type === 'tap') { const tp = k.tops.length ? K.TOPPINGS[k.tops[k.dots.length % k.tops.length]] : null; k.dots.push({ x: x - a.x, y: y - a.y, c: tp ? tp[1] : ['#ff5a74', '#ffd95e', '#5b6fe0', '#7ed37a'][k.dots.length % 4] }); k.prog = Math.min(1, k.prog + 1 / st.n); this.audio.play('pop', { rate: 1 + k.prog * 0.5 }); this.vibrate('short'); this.stepCheck(); }
      else if (st.type === 'rub') k.rub = { tid: id, x: x, y: y };
      else if (st.type === 'stir') k.ang = { tid: id, a: Math.atan2(y - a.y, x - a.x) };
      else if (st.type === 'hold') k.holdId = id;
      return true;
    }
    if (kind === 'move') {
      if (k.drop && k.drop.tid === id) { k.drop.x = x; k.drop.y = y; return true; }
      if (k.rub && k.rub.tid === id && st.type === 'rub') { const d = U.dist(x, y, k.rub.x, k.rub.y); k.rub.x = x; k.rub.y = y; if (inArea) { k.prog = Math.min(1, k.prog + d / st.need); if (Math.random() < d / 300) this.audio.play('lick', { gain: 0.4, minGap: 0.15 }); this.stepCheck(); } return true; }
      if (k.ang && k.ang.tid === id && st.type === 'stir') { const na = Math.atan2(y - a.y, x - a.x); let da = na - k.ang.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; k.ang.a = na; k.turns += Math.abs(da) / (Math.PI * 2); k.prog = Math.min(1, k.turns / st.need); if (Math.random() < 0.08) this.audio.play('slurp', { gain: 0.3, minGap: 0.25 }); this.stepCheck(); return true; }
      return false;
    }
    // end
    if (k.drop && k.drop.tid === id) { const dr = k.drop; k.drop = null; if (U.dist(dr.x, dr.y, a.x, a.y) < a.r) { k.prog = Math.min(1, k.prog + 1 / st.n); this.audio.play('drop'); this.spawnSparkles(a.x, a.y, 8); this.stepCheck(); } return true; }
    if (k.holdId === id) { k.holdId = null; return true; }
    if (k.rub && k.rub.tid === id) { k.rub = null; return true; }
    if (k.ang && k.ang.tid === id) { k.ang = null; return true; }
    return false;
  };
  P.drawKitchen = function () {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, k = this.kit, top = this.top(), bottom = this.bottom();
    A.kitchenBg(ctx, W, H);
    ui.button('home', 16, top + 14, 48, 48, '✕', { color: C.red, dark: '#c93b55', size: 24, radius: 16 });
    this.coinsHud(top);
    const dish = k.rec.dish === 'mystery' ? null : K.dish(k.rec.dish);
    if (k.phase === 'choose') {
      ui.title(k.rec.name.toUpperCase(), W / 2, top + 100, 34, C.white, C.pinkDark);
      if ((k.lv.kitchen.recipes || []).length > 1) ui.button('krec', W / 2 - 90, top + 122, 180, 36, 'OTHER RECIPE  ›', { color: C.mint, dark: C.mintDark, size: 14, radius: 14 }); else ui.label('COOKING', W / 2, top + 134, 14, C.text);
      const cy = top + 270; A.circle(ctx, W / 2, cy, 120, 'rgba(255,255,255,0.7)', 4);
      if (dish) A.food(ctx, dish, W / 2, cy, 190, 0, this.time); else A.mysteryBox(ctx, W / 2, cy, 170, this.time, 0, true);
      let y = cy + 140;
      ui.label('RECIPE KIT  ' + U.fmtCoins(k.rec.price) + ' coins', W / 2, y, 14, C.text); y += 30;
      ui.label('TOPPINGS (OPTIONAL) · EACH ADDS HYPE', W / 2, y, 14, C.textLight); y += 18;
      const tops = k.rec.toppings, cw = Math.min(118, (W - 40 - (tops.length - 1) * 8) / tops.length);
      const x0 = (W - (tops.length * cw + (tops.length - 1) * 8)) / 2;
      for (let i = 0; i < tops.length; i++) { const tp = K.TOPPINGS[tops[i]], on = k.tops.indexOf(tops[i]) >= 0, x = x0 + i * (cw + 8); ui.panel(x, y, cw, 86, on ? '#eafff0' : '#fff', on ? C.greenDark : C.outline, 16, on ? 4 : 2); A.circle(ctx, x + cw / 2, y + 28, 15, tp[1], 3); ui.label(tp[0], x + cw / 2, y + 56, 11, C.text); A.coin(ctx, x + cw / 2 - 12, y + 73, 6); ui.label(String(tp[2]), x + cw / 2 + 4, y + 74, 12, C.text, 'left'); ui.hotspot('ktop_' + tops[i], x, y, cw, 86); }
      y += 110;
      ui.button('kgo', W * 0.14, Math.min(y, bottom - 80), W * 0.72, 66, 'START COOKING  ·  ' + U.fmtCoins(this.kitTotal()), { color: C.pink, dark: C.pinkDark, size: 21 });
      return;
    }
    const a = this.workArea(); const nSteps = k.rec.steps.length; const st = k.phase === 'cook' ? this.curStep() : null;
    const overall = Math.min(1, (k.step + (k.phase === 'cook' ? k.prog : 0)) / nSteps);
    // step banner
    ui.panel(30, top + 72, W - 60, 76, C.cream, C.outline, 22);
    ui.label(k.phase === 'cook' ? 'STEP ' + (k.step + 1) + '/' + nSteps : k.rec.name.toUpperCase(), W / 2, top + 92, 13, C.textLight);
    ui.label(st ? st.text : 'TA-DA!', W / 2, top + 116, 24, C.pinkDark);
    if (st) ui.bar(60, top + 134, W - 120, 8, k.prog, C.green, 'rgba(0,0,0,0.08)');
    // work area: board, the dish taking shape
    A.circle(ctx, a.x, a.y + 10, a.r, '#fff', 5); A.circle(ctx, a.x, a.y + 10, a.r * 0.86, '#f6f0ea', 0);
    ctx.globalAlpha = 0.3 + 0.7 * overall; if (dish) A.food(ctx, dish, a.x, a.y, a.r * 1.35, 0, this.time); else A.mysteryBox(ctx, a.x, a.y, a.r * 1.1, this.time, 0, true); ctx.globalAlpha = 1;
    if (st && st.type === 'rub') { ctx.globalAlpha = 0.25 + 0.5 * k.prog; A.ellipse(ctx, a.x, a.y - a.r * 0.15, a.r * 0.55, a.r * 0.18, '#fff8ef', 0); ctx.globalAlpha = 1; }
    if (st && st.type === 'stir') { const ang = this.time * 2 + k.turns * Math.PI * 2; ctx.strokeStyle = 'rgba(201,162,124,0.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(a.x, a.y, a.r * 0.45, ang, ang + Math.PI * 1.2); ctx.stroke(); ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.strokeStyle = '#c49a6c'; ctx.beginPath(); ctx.moveTo(a.x + Math.cos(ang) * a.r * 0.4, a.y + Math.sin(ang) * a.r * 0.4); ctx.lineTo(a.x + Math.cos(ang) * a.r * 0.4 + 30, a.y + Math.sin(ang) * a.r * 0.4 - 90); ctx.stroke(); }
    if (st && st.type === 'hold') { const on = k.holdId !== null; ctx.fillStyle = on ? 'rgba(201,162,124,0.85)' : 'rgba(201,162,124,0.25)'; ctx.fillRect(a.x - 8, a.y - a.r - 40, 16, a.r + 20); A.rr(ctx, a.x - 40, a.y - a.r - 80, 80, 44, 12); ctx.fillStyle = '#ffd1e3'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = C.outline; ctx.stroke(); }
    for (let i = 0; i < k.dots.length; i++) { const dt = k.dots[i]; A.circle(ctx, a.x + U.clamp(dt.x, -a.r * 0.6, a.r * 0.6), a.y + U.clamp(dt.y, -a.r * 0.6, a.r * 0.6), 11, dt.c, 3); }
    if (st && st.type === 'drop') { const di = this.dropIcon(); const px = k.drop ? k.drop.x : di.x, py = k.drop ? k.drop.y : di.y + Math.sin(this.time * 4) * 4; A.circle(ctx, px, py, 40, '#fff0c2', 4); ui.label('DRAG', px, py - 4, 14, C.text); ui.label('IN', px, py + 14, 14, C.text); if (!k.drop) { ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 5; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.moveTo(px + 44, py - 20); ctx.lineTo(a.x - a.r * 0.5, a.y + a.r * 0.4); ctx.stroke(); ctx.setLineDash([]); } }
    // hint under the board
    const hint = !st ? '' : st.type === 'rub' ? 'rub back and forth on the food' : st.type === 'tap' ? 'tap on the food (' + Math.round(k.prog * st.n) + '/' + st.n + ')' : st.type === 'stir' ? 'draw circles around the bowl' : st.type === 'hold' ? 'press and hold on the bowl' : 'drag the ingredient into the bowl';
    if (hint) ui.label(hint, W / 2, a.y + a.r + 34, 16, C.text);
    if (k.phase === 'done') { const s = U.easeOutBack(Math.min(1, k.doneT * 2)); ctx.save(); ctx.translate(W / 2, a.y + a.r + 40); ctx.scale(s, s); ui.title('READY TO STREAM!', 0, 0, 32, C.white, C.pinkDark); ctx.restore(); }
    if (k.flash > 0) { ctx.globalAlpha = k.flash; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  };
}

module.exports = { install, SCENES };
