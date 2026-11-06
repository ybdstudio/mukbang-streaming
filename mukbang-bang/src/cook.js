'use strict';
// V4 cooking scene (installed onto Game.prototype), modelled on the reference video:
// step pips on top · the dish in the middle · 4 choices in the bottom tray + a green ✓ ·
// pour by holding · hold the tool (fan / fire / oven / mixer / shaker / shaver) ·
// tap to flip the mould · tap to place toppings · rub to shake the decoration ·
// "PERFECT!" when the dish matches the viewer request → served on the stream.
const U = require('./util.js');
const D = require('./data.js');
const A = require('./art.js');
const R = require('./recipes.js');
const L = require('./levels.js');
const S = require('./sprites.js');
const CA = require('./cookart.js');
const C = D.COLORS;
// tray icon: the V4 sprite when delivered (cook/opt_<slot>_<id>.png), else the vector option
function optIcon(ctx, slot, o, x, y, r) { if (!S.v4draw(ctx, 'cook/opt_' + slot + '_' + o.id + '.png', x, y, r * 2.5)) R.drawOption(ctx, A, slot, o, x, y, r); }

const POUR_T = 2.0, HOLD_T = 2.0, FLIP_T = 0.6, SHAKE_NEED = 1100, DONE_T = 1.7;
const SLOT_KEY = { mold: 'mold', flavor: 'flavor', broth: 'broth', topping: 'topping', ramen_top: 'topping', boba_top: 'topping', deco: 'deco', ramen_deco: 'deco', cup: 'cup', shape: 'shape' };
const RARE_SLOTS = { flavor: 1, broth: 1, topping: 1, ramen_top: 1, boba_top: 1, deco: 1, ramen_deco: 1 };
const PICK_TEXT = { mold: 'PICK A MOULD', flavor: 'PICK A FLAVOUR', broth: 'PICK THE BROTH', topping: 'PICK A TOPPING', ramen_top: 'PICK A TOPPING', boba_top: 'PICK A TOPPING', deco: 'PICK A DECORATION', ramen_deco: 'PICK A SEASONING', cup: 'PICK A CUP', shape: 'PICK A SHAPE' };

function install(Game) {
  const P = Game.prototype;
  P.enterCook = function () {
    const r = this.run, lv = L.level(r.level), rc = R.RECIPES[lv.recipe];
    this.ck = { lv: lv, rc: rc, req: lv.request, dish: { recipe: lv.recipe }, step: 0, sel: null, prog: 0, st: { fill: 0, set: false, flipped: false, tops: 0, deco: 0 }, holdId: null, rub: null, flipT: -1, doneT: -1, t: 0, perfect: false, opts: null, rare: null, rareKey: null, rareUsed: false, stepAd: false, serveAsk: false };
    CA.preload(this.ck.dish); this.trans = 0.4; this.audio.play('whoosh'); this.prepStep(); this.setState('cook');
  };
  P.curCookStep = function () { const k = this.ck; return k.rc.steps[k.step]; };
  // the 4 choices for a pick step (always contains the requested one)
  P.prepStep = function () {
    const k = this.ck, st = this.curCookStep(); k.sel = null; k.prog = 0; k.opts = null;
    if (st && st.t === 'pick') {
      const all = R.options(st.slot, k.lv.n); const key = SLOT_KEY[st.slot]; const want = k.req[key];
      let pick = all.slice(); if (pick.length > 4) { const w = pick.filter(function (o) { return o.id === want; }); const rest = pick.filter(function (o) { return o.id !== want; }); for (let i = rest.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = rest[i]; rest[i] = rest[j]; rest[j] = t; } pick = w.concat(rest.slice(0, 4 - w.length)); pick.sort(function (a, b) { return all.indexOf(a) - all.indexOf(b); }); }
      k.opts = pick;
      // one rare choice behind an opt-in ad (a later-level option, else one not shown) — once per dish, never in the first streams
      k.rare = null;
      if (!k.rareUsed && RARE_SLOTS[st.slot] && this.canRare()) {
        const all2 = R.OPT[st.slot].map(function (o) { return R.OPT_BY[st.slot][o[0]]; });
        const later = all2.filter(function (o) { return o.unlock > k.lv.n; }); const unseen = all2.filter(function (o) { return pick.indexOf(o) < 0; });
        const pool = later.length ? later : unseen; if (pool.length) k.rare = pool[Math.floor(Math.random() * pool.length)];
      }
    }
  };
  P.cookNext = function () {
    const k = this.ck; k.step++; k.fxT = this.time; this.audio.play('ding', { gain: 0.6 }); this.spawnSparkles(this.W / 2, this.H * 0.45, 10);
    if (k.step >= k.rc.steps.length) { k.doneT = 0; k.doneAt = k.t; const key = k.rc.taste === 'broth' ? 'broth' : 'flavor'; k.perfect = (k.dish[key] === k.req[key] || k.rareKey === key) && (k.dish.topping === k.req.topping || k.rareKey === 'topping') && (function () { const cs = L.containerSlot(k.req.recipe); return !cs || !k.req[cs] || k.dish[cs] === k.req[cs] || k.rareKey === cs; })(); this.audio.play(k.perfect ? 'levelup' : 'win'); this.spawnConfetti(this.W / 2, this.H * 0.35, 60); return; }
    this.prepStep();
  };
  P.cookTap = function (id) {
    const k = this.ck; if (!k || this.state !== 'cook') return false;
    if (id.indexOf('cko_') === 0) { const st = this.curCookStep(); if (!st || st.t !== 'pick') return true; const oid = id.slice(4); k.sel = oid; k.dish[SLOT_KEY[st.slot]] = oid; this.audio.play('pop'); this.vibrate('short'); return true; }
    if (id === 'ck_ok') { if (!k.sel) return true; const mid = k.step >= 2 && !k.stepAd; this.cookNext(); if (mid) this.cookStepAd(); return true; }
    if (id === 'ck_serve') { if (k.serveAsk) this.cookServed(); return true; }
    if (id === 'ck_hot') { this.watchServe(); return true; }
    if (id === 'ck_rare') { this.watchRare(); return true; }
    return false;
  };
  // rare choice: the viewers love a rare ingredient — it counts as what they asked for
  // interstitial between cooking steps: once per dish, at a ✓ in the middle of the recipe (a tap, a natural pause)
  P.cookStepAd = function () {
    const k = this.ck; k.stepAd = true;
    if (this.noAds() || this.adBusy || (this.profile.get('streams') || 0) < 4 || !this.hs.hasAds() || !this.hs.canShowCookStep || !this.hs.canShowCookStep()) return;
    this.adRun('cook_step', this.hs.showCookStep(), function () {});
  };
  // serve: after PERFECT the player taps SERVE, or watches an ad for a HOT START (+40% viewers when the stream resumes)
  P.canServe = function () { return this.hs.hasAds() && this.hs.canShowServe && (this.profile.get('streams') || 0) >= 2 && this.hs.canShowServe(); };
  P.watchServe = function () {
    const k = this.ck; if (!k || !k.serveAsk || this.adBusy || !this.canServe()) return;
    const self = this; this.adRun('serve_bonus', this.hs.showServe(), function (r) {
      if (self.ck !== k) return;
      if (r === null) { self.showToast('No ad right now'); return; }
      self.cookServed(true);
    });
  };
  P.canRare = function () { return this.hs.hasAds() && this.hs.canShowRare && (this.profile.get('streams') || 0) >= 3 && this.hs.canShowRare(); };
  P.watchRare = function () {
    const k = this.ck; if (!k || !k.rare || k.rareUsed || this.adBusy || !this.canRare()) return;
    const self = this, st = this.curCookStep(), o = k.rare, key = SLOT_KEY[st.slot];
    this.adRun('rare_choice', this.hs.showRare(), function (r) {
      if (r === null) { self.showToast('No ad right now'); return; }
      if (self.ck !== k || self.curCookStep() !== st) return;
      k.rareUsed = true; k.rareKey = key; k.sel = o.id; k.dish[key] = o.id; k.opts = k.opts.concat([o]); k.rare = null;
      self.audio.play('levelup'); self.spawnConfetti(self.W / 2, self.H * 0.4, 30); self.showToast('RARE ' + o.name.toUpperCase() + '!', 'The viewers will love it');
    });
  };
  P.cookArea = function () { return { x: this.W / 2, y: this.H * 0.6, r: Math.min(150, this.W * 0.3) }; };
  P.toolPos = function () { const a = this.cookArea(); return { x: a.x + a.r * 1.05, y: a.y - a.r * 0.55 }; };
  P.cookTouch = function (kind, id, x, y) {
    const k = this.ck; if (!k || this.state !== 'cook' || k.doneT >= 0) return false;
    const st = this.curCookStep(); if (!st) return false; const a = this.cookArea(); const inA = U.dist(x, y, a.x, a.y) < a.r + 40; const tp = this.toolPos(); const onTool = U.dist(x, y, tp.x, tp.y) < 70;
    if (kind === 'start') {
      // hold anywhere: on the dish, the bottle, the tool or just the screen (only the top bar is excluded)
      if ((st.t === 'pour' || st.t === 'hold') && (inA || onTool || y > this.top() + 70)) { k.holdId = id; return true; }
      if (st.t === 'flip' && inA && k.flipT < 0) { k.flipT = 0; this.audio.play('whoosh'); return true; }
      if (st.t === 'place' && inA) { k.st.tops = Math.min(st.n, k.st.tops + 1); this.audio.play('pop', { rate: 1 + k.st.tops * 0.15 }); this.vibrate('short'); this.spawnSparkles(x, y, 5); if (k.st.tops >= st.n) this.cookNext(); return true; }
      if (st.t === 'shake' && inA) { k.rub = { tid: id, x: x, y: y }; return true; }
      return false;
    }
    if (kind === 'move') { if (k.rub && k.rub.tid === id) { const d = U.dist(x, y, k.rub.x, k.rub.y); k.rub.x = x; k.rub.y = y; k.st.deco = Math.min(1, k.st.deco + d / SHAKE_NEED); if (Math.random() < d / 400) this.audio.play('fizz', { gain: 0.25, minGap: 0.12 }); if (k.st.deco >= 1) { k.rub = null; this.cookNext(); } return true; } return k.holdId === id; }
    if (k.holdId === id) { k.holdId = null; return true; }
    if (k.rub && k.rub.tid === id) { k.rub = null; return true; }
    return false;
  };
  P.updateCook = function (dt) {
    const k = this.ck; if (!k) return; k.t += dt;
    if (k.doneT >= 0) { k.doneT += dt; if (k.doneT >= DONE_T && !k.serveAsk) { if (this.canServe()) k.serveAsk = true; else this.cookServed(); } return; }
    const st = this.curCookStep(); if (!st) return;
    if (st.t === 'pour' && k.holdId !== null) { k.st.fill = Math.min(1, k.st.fill + dt / POUR_T); if (Math.random() < dt * 6) this.audio.play('gulp', { gain: 0.25, minGap: 0.2 }); if (k.st.fill >= 1) { k.holdId = null; this.cookNext(); } }
    if (st.t === 'hold' && k.holdId !== null) { k.prog = Math.min(1, k.prog + dt / HOLD_T); if (Math.random() < dt * 5) this.audio.play(st.tool === 'fire' || st.tool === 'oven' ? 'fire' : st.tool === 'fan' ? 'shiver' : 'fizz', { gain: 0.25, minGap: 0.25 }); if (k.prog >= 1) { k.holdId = null; k.st.set = true; this.cookNext(); } }
    if (st.t === 'flip' && k.flipT >= 0) { k.flipT += dt; if (k.flipT >= FLIP_T) { k.flipT = -1; k.st.flipped = true; this.audio.play('drop'); this.vibrate('short'); this.cookNext(); } }
  };
  // the dish is ready → back to the stream, served as 3 portions
  P.cookServed = function (hot) {
    const k = this.ck; const r = this.run; if (!k) return; this.ck = null;
    r.dish = Object.assign({}, k.dish); r.perfect = k.perfect; r.phase = 'open'; r.pt = 0;
    if (r.quest && r.quest.id === 'fast' && (k.doneAt === undefined ? k.t : k.doneAt) <= r.quest.secs) r.quest.got = 1;
    if (hot) { r.hotStart = true; this.addViewers(Math.round(r.goal * 0.4)); for (let i = 0; i < 10; i++) this.spawnHeart(true); this.floatText('HOT START!  +' + U.fmtViewers(Math.round(r.goal * 0.4)), this.W / 2, this.H * 0.4, C.gold, 28, true); this.audio.play('levelup'); }
    this.trans = 0.4; this.saveRun(); this.setState('stream');
    this.floatText(k.perfect ? 'JUST LIKE THEY ASKED!' : 'SERVED!', this.W / 2, this.H * 0.47, C.gold, 26, true);
    this.setFace('open', 1.2); for (let i = 0; i < 3; i++) this.pushChat('bite');
  };
  // ── drawing ──
  P.drawCook = function () {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, k = this.ck, top = this.top(), bottom = this.bottom();
    if (!k) return;
    if (!CA.kitchenBg(ctx, W, H)) A.kitchenBg(ctx, W, H);
    this.coinsHud(top);
    const steps = k.rc.steps, st = this.curCookStep();
    // step pips (bunnies in the video)
    const pw = Math.min(30, (W - 160) / steps.length);
    for (let i = 0; i < steps.length; i++) { const px = 24 + i * pw + pw / 2, py = top + 40; if (CA.sprite(ctx, i < k.step ? 'cook/pip_on.png' : 'cook/pip_off.png', px, py, pw * (i === k.step ? 1.05 : 0.9))) continue; A.circle(ctx, px, py, pw * 0.4, i < k.step ? C.pink : i === k.step ? '#fff' : 'rgba(255,255,255,0.6)', 3); if (i < k.step) A.heart(ctx, px, py + 1, pw * 0.18, '#fff', 0); }
    // request reminder
    const req = k.req; if (!CA.panel(ctx, 'cook/request_card.png', W / 2 - 200, top + 68, 400, 78)) ui.panel(W / 2 - 200, top + 68, 400, 78, '#fff7fb', C.pinkDark, 18, 3);
    R.draw(ctx, A, req, W / 2 - 152, top + 107, 62, { flipped: true, set: true, fill: 1, tops: 1, deco: 0 });
    ui.label('VIEWER WANTS: ' + R.dishName(req).toUpperCase(), W / 2 + 30, top + 94, 16, C.text); const ts = R.opt(R.toppingSlot(req.recipe), req.topping); ui.label(R.containerText(req) + 'with ' + (ts ? ts.name : ''), W / 2 + 30, top + 122, 15, C.textLight);
    // instruction
    const text = k.doneT >= 0 ? '' : !st ? '' : st.t === 'pick' ? PICK_TEXT[st.slot] : st.t === 'pour' ? (st.text || 'HOLD TO POUR') : st.t === 'hold' ? st.text + ' · HOLD!' : st.t === 'flip' ? 'TAP TO FLIP IT OUT!' : st.t === 'place' ? (st.text || 'TAP TO ADD TOPPINGS') + ' (' + k.st.tops + '/' + st.n + ')' : 'RUB TO SPRINKLE!';
    if (text) { // a solid pill so the step stands out over the jars / tray behind it
      let fs = 24; while (fs > 16 && ui.measure(text, fs) > W - 90) fs--;
      const tw = ui.measure(text, fs) + 44, th = fs + 22, cy = top + 176, pulse = 1 + 0.035 * Math.sin(this.time * 5);
      ctx.save(); ctx.translate(W / 2, cy); ctx.scale(pulse, pulse);
      A.rr(ctx, -tw / 2, -th / 2 + 4, tw, th, th / 2); ctx.fillStyle = 'rgba(91,61,59,0.28)'; ctx.fill();
      A.rr(ctx, -tw / 2, -th / 2, tw, th, th / 2); ctx.fillStyle = '#e8508a'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.restore();
      ui.label(text, W / 2, cy + 1, fs * pulse, C.white, 'center', { stroke: 4 });
    }
    if (this.run && this.run.quest && this.run.quest.id === 'fast') { const q = this.run.quest, used = k.doneAt !== undefined ? k.doneAt : k.t, left = Math.max(0, Math.ceil(q.secs - used)), ok = used <= q.secs;
      const txt = '★ ' + q.text + (k.doneAt !== undefined ? (ok ? '  ✓' : '  ✗') : '  ·  ' + left + ' s'); const w = ui.measure(txt, 13) + 30; ui.panel(W / 2 - w / 2, top + 206, w, 28, ok ? '#fff8d6' : '#f4eef0', ok ? C.goldDark : '#bfb0b0', 14, 2); ui.label(txt, W / 2, top + 220, 13, ok ? (left <= 5 && k.doneAt === undefined ? '#d33' : C.text) : C.textLight); }
    // the dish
    const a = this.cookArea(); const flipping = k.flipT >= 0;
    A.ellipse(ctx, a.x, a.y + a.r * 0.62, a.r * 0.95, a.r * 0.2, 'rgba(91,61,59,0.12)', 0);
    if (flipping) { const t = k.flipT / FLIP_T; ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(Math.PI * t); ctx.translate(-a.x, -a.y); R.draw(ctx, A, k.dish, a.x, a.y, a.r * 1.9, k.st); ctx.restore(); }
    else R.draw(ctx, A, k.dish, a.x, a.y, a.r * 1.9, k.st);
    // pour stream / tool
    if (st && st.t === 'pour') { const fo = R.opt(st.from, k.dish[SLOT_KEY[st.from]]); const bx = a.x + a.r * 0.6, by = a.y - a.r * 1.05; const pouring = k.holdId !== null; let sp = CA.bottle(ctx, fo ? fo.color : '#ff9fc4', bx + 34, by - 30, 300, pouring); if (!sp) { ctx.save(); ctx.translate(bx, by); ctx.rotate(pouring ? -0.9 : -0.3); R.drawOption(ctx, A, st.from === 'broth' ? 'broth' : 'flavor', fo || { color: '#ff9fc4' }, 0, 0, 34); ctx.restore(); sp = { x: bx - 26, y: by + 10 }; } if (pouring && fo) { this.drawPour(sp.x, sp.y, a.x + 6, a.y - a.r * 0.18, fo.color); CA.fx(ctx, 'fx_pour', this.time * 10, a.x + 6, a.y - a.r * 0.32, 70, fo.color, 0.95); } ui.bar(a.x - 80, a.y + a.r + 26, 160, 12, k.st.fill, C.pink, 'rgba(255,255,255,0.7)'); }
    if (st && st.t === 'hold' && k.holdId !== null) { const hot = st.tool === 'fire' || st.tool === 'oven', cold = st.tool === 'fan' || st.tool === 'shaver';
      if (hot || cold) CA.fx(ctx, hot ? 'fx_steam' : 'fx_cold', this.time * 8, a.x, a.y - a.r * 0.55, a.r * 1.3, null, 0.9); }
    if (k.fxT !== undefined && this.time - k.fxT < 0.5) CA.fx(ctx, 'fx_sparkle', (this.time - k.fxT) * 8, a.x + a.r * 0.4, a.y - a.r * 0.5, a.r * 0.9, null, 1);
    if (st && st.t === 'hold') { const tp = this.toolPos(); this.drawTool(st.tool, tp.x, tp.y, k.holdId !== null); ui.bar(a.x - 80, a.y + a.r + 26, 160, 12, k.prog, st.tool === 'fire' || st.tool === 'oven' ? '#ff7a3a' : C.blue, 'rgba(255,255,255,0.7)'); }
    if (st && st.t === 'shake') { ui.bar(a.x - 80, a.y + a.r + 26, 160, 12, k.st.deco, C.yellow, 'rgba(255,255,255,0.7)'); const ds = R.decoSlot(k.dish.recipe), dop = R.opt(ds, k.dish.deco); if (dop) { const sx = a.x + Math.sin(this.time * 8) * 26, sy = a.y - a.r * 1.22; ctx.save(); ctx.translate(sx, sy); ctx.rotate((ds === 'deco' ? Math.PI * 0.85 : -0.35) + Math.sin(this.time * 8) * 0.3); optIcon(ctx, ds, dop, 0, 0, ds === 'deco' ? 92 : 54); ctx.restore(); } }
    if (st && (st.t === 'place' || st.t === 'flip' || st.t === 'shake') && !k.holdId) { const p = 0.4 + 0.3 * Math.sin(this.time * 6); ctx.strokeStyle = 'rgba(255,255,255,' + p + ')'; ctx.lineWidth = 5; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.arc(a.x, a.y, a.r * 0.9, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
    // bottom tray for choices + ✓
    if (st && st.t === 'pick' && k.opts) {
      const n = k.opts.length, cw = Math.min(110, (W - 40 - (n - 1) * 10) / n), x0 = (W - (n * cw + (n - 1) * 10)) / 2, ty = bottom - 150;
      if (!CA.panel(ctx, 'cook/tray.png', 10, ty - 14, W - 20, 150)) { A.rr(ctx, 10, ty - 14, W - 20, 150, 26); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill(); }
      const rare = k.rare; const n2 = n + (rare ? 1 : 0); const cw2 = Math.min(110, (W - 40 - (n2 - 1) * 10) / n2), x02 = (W - (n2 * cw2 + (n2 - 1) * 10)) / 2;
      for (let i = 0; i < n; i++) { const o = k.opts[i], cw = cw2, x = x02 + i * (cw + 10), on = k.sel === o.id; if (!CA.panel(ctx, on ? 'cook/card_selected.png' : 'cook/card.png', x, ty, cw, 112)) ui.panel(x, ty, cw, 112, on ? '#eafff0' : '#fff', on ? C.greenDark : C.pink, 18, on ? 5 : 3); optIcon(ctx, st.slot, o, x + cw / 2, ty + 46, 30); ui.label(o.name, x + cw / 2, ty + 96, 12, C.text); ui.hotspot('cko_' + o.id, x, ty, cw, 112); }
      if (rare) { const x = x02 + n * (cw2 + 10), gl = 0.5 + 0.5 * Math.sin(this.time * 5); const art = CA.panel(ctx, 'cook/card_rare.png', x, ty, cw2, 112); if (!art) ui.panel(x, ty, cw2, 112, '#fff6d6', C.goldDark, 18, 4); optIcon(ctx, st.slot, rare, x + cw2 / 2, ty + 46, 30); if (!art) A.star(ctx, x + cw2 - 14, ty + 14, 9 + gl * 2, C.gold, 2); if (!CA.sprite(ctx, 'cook/badge_rare.png', x + cw2 / 2, ty + 93, Math.min(cw2 - 8, 80))) { A.rr(ctx, x + 8, ty + 80, cw2 - 16, 26, 13); ctx.fillStyle = C.blue; ctx.fill(); ui.label('▶ RARE', x + cw2 / 2, ty + 94, 12, C.white); } ui.hotspot('ck_rare', x, ty, cw2, 112); }
      if (k.sel) { const pulse = 1 + Math.sin(this.time * 6) * 0.06; ctx.save(); ctx.translate(a.x + a.r + 20, a.y + a.r * 0.4); ctx.scale(pulse, pulse); if (!CA.sprite(ctx, 'cook/ok.png', 0, 0, 74)) { A.circle(ctx, 0, 0, 34, C.green, 4); ctx.strokeStyle = '#fff'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-4, 11); ctx.lineTo(15, -12); ctx.stroke(); } ctx.restore(); ui.hotspot('ck_ok', a.x + a.r - 16, a.y + a.r * 0.4 - 36, 72, 72); }
    }
    // done: PERFECT! / YUMMY!
    if (k.doneT >= 0) {
      const t = k.doneT; ui.dim(Math.min(0.35, t)); const s = U.easeOutBack(Math.min(1, t * 2.5));
      ctx.save(); ctx.translate(W / 2, H * 0.24); ctx.scale(s, s); if (!CA.sprite(ctx, k.perfect ? 'cook/banner_perfect.png' : 'cook/banner_yummy.png', 0, 0, 360)) { A.rr(ctx, -170, -44, 340, 88, 40); ctx.fillStyle = C.pink; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.pinkDark; ctx.stroke(); ui.title(k.perfect ? 'PERFECT!' : 'YUMMY!', 0, 2, 46, C.white, C.pinkDark); } ctx.restore();
      ui.label(k.perfect ? 'exactly what the viewer asked for!' : 'not what they asked, but it looks so good!', W / 2, H * 0.24 + 66, 15, C.white, 'center', { stroke: 4 });
      if (k.serveAsk) { const by = H * 0.24 + 100; ui.button('ck_serve', W * 0.12, by, W * 0.36, 64, 'SERVE', { color: C.yellow, dark: C.yellowDark, size: 22 }); ui.button('ck_hot', W * 0.52, by, W * 0.36, 64, '▶ HOT START', { color: C.pink, dark: C.pinkDark, size: 18 }); ui.label('+40% viewers when you go live', W * 0.7, by + 82, 13, C.white, 'center', { stroke: 4 }); }
      R.draw(ctx, A, k.dish, a.x, a.y, a.r * 1.9, k.st);  // the finished dish above the dim, exactly where it was made
    }
  };
  // a syrupy pour: a tapered, gently wobbling ribbon with a glossy highlight, falling drops and a splash ring
  P.drawPour = function (x0, y0, x1, y1, color) {
    const ctx = this.ctx, t = this.time, N = 14, pts = [];
    for (let i = 0; i <= N; i++) { const u = i / N; // leaves the spout sideways, then gravity bends it down
      const bx = x0 + (x1 - x0) * (2 * u - u * u), by = y0 + (y1 - y0) * u * u, wob = Math.sin(t * 9 - u * 7) * 2.5 * u;
      const w = 26 * (1 - u) + 15 * u + Math.sin(t * 13 + u * 11) * 1.6 + (u > 0.85 ? (u - 0.85) * 60 : 0); pts.push([bx + wob, by, w]); }
    const dark = R.shade(color, -0.25), light = R.shade(color, 0.45);
    ctx.save(); ctx.lineJoin = 'round';
    ctx.beginPath(); for (let i = 0; i <= N; i++) ctx.lineTo(pts[i][0] - pts[i][2] / 2, pts[i][1]); for (let i = N; i >= 0; i--) ctx.lineTo(pts[i][0] + pts[i][2] / 2, pts[i][1]); ctx.closePath();
    ctx.fillStyle = color; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = dark; ctx.stroke();
    ctx.beginPath(); for (let i = 1; i < N; i++) ctx.lineTo(pts[i][0] - pts[i][2] * 0.15, pts[i][1]); ctx.lineWidth = 1.8; ctx.strokeStyle = light; ctx.globalAlpha = 0.85; ctx.stroke(); ctx.globalAlpha = 1;
    // splash where it lands
    const r = 10 + Math.sin(t * 10) * 2; ctx.beginPath(); ctx.ellipse(x1, y1, r * 1.8, r * 0.55, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.globalAlpha = 0.9; ctx.fill(); ctx.globalAlpha = 1; ctx.lineWidth = 2; ctx.strokeStyle = dark; ctx.stroke();
    for (let i = 0; i < 4; i++) { const ph = (t * 1.6 + i / 4) % 1, ax = x1 + (i % 2 ? 1 : -1) * (8 + ph * 26), ay = y1 - Math.sin(ph * Math.PI) * 20; ctx.globalAlpha = 1 - ph; ctx.beginPath(); ctx.arc(ax, ay, 3.2 * (1 - ph * 0.5), 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
    // drops dripping beside the stream
    for (let i = 0; i < 2; i++) { const ph = (t * 1.2 + i * 0.5) % 1, dx = x0 + (x1 - x0) * ph * ph + (i ? 7 : -6), dy = y0 + (y1 - y0) * ph; ctx.globalAlpha = 0.9 * (1 - ph * 0.6); ctx.beginPath(); ctx.ellipse(dx, dy, 2.6, 3.6, 0, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill(); }
    ctx.globalAlpha = 1; ctx.restore();
  };
  P.drawTool = function (tool, x, y, on) {
    const ctx = this.ctx, t = this.time;
    if (CA.tool(ctx, tool, x + (on ? Math.sin(t * 40) * 2 : 0), y + (on ? Math.cos(t * 33) * 2 : 0), 200, on && (Math.floor(t * 6) % 2 === 0 || tool !== 'fan'))) return;
    ctx.save(); ctx.translate(x, y);
    if (tool === 'fan') { A.circle(ctx, 0, 0, 48, '#fff', 4); const sp = on ? t * 18 : t * 2; for (let i = 0; i < 3; i++) { ctx.save(); ctx.rotate(sp + i * 2.094); A.ellipse(ctx, 0, -22, 13, 20, ['#cdb0ff', '#9fe37a', '#8fd1ff'][i], 3); ctx.restore(); } A.circle(ctx, 0, 0, 8, C.pink, 3); A.rr(ctx, -6, 46, 12, 30, 5); ctx.fillStyle = '#fff'; ctx.fill(); if (on) for (let i = 0; i < 5; i++) { const px = -60 - ((t * 120 + i * 30) % 120), py = (i - 2) * 16; ctx.globalAlpha = 0.7; A.star(ctx, px, py, 5, '#bfe9ff', 0); ctx.globalAlpha = 1; } }
    else if (tool === 'fire' || tool === 'oven') { A.rr(ctx, -46, 10, 92, 30, 10); ctx.fillStyle = '#6b6b7a'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#5b3d3b'; ctx.stroke(); const h = on ? 34 : 12; for (let i = -2; i <= 2; i++) { const fx = i * 16, fh = h + Math.sin(t * 14 + i) * 6; ctx.beginPath(); ctx.moveTo(fx - 8, 10); ctx.quadraticCurveTo(fx - 9, 10 - fh * 0.6, fx, 10 - fh); ctx.quadraticCurveTo(fx + 9, 10 - fh * 0.6, fx + 8, 10); ctx.closePath(); ctx.fillStyle = on ? 'rgba(255,140,40,0.95)' : 'rgba(120,170,255,0.9)'; ctx.fill(); } A.text(ctx, tool === 'oven' ? 'OVEN' : 'FIRE', 0, 28, 13, '#fff', 0); }
    else { // mixer / shaker / shaver
      const wob = on ? Math.sin(t * 30) * 6 : 0; ctx.translate(wob, 0);
      A.rr(ctx, -26, -46, 52, 76, 14); ctx.fillStyle = tool === 'shaver' ? '#bfe9ff' : tool === 'mixer' ? '#ffd1e3' : '#fff0c2'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#5b3d3b'; ctx.stroke();
      A.circle(ctx, 0, -10, 12, '#fff', 3); A.text(ctx, tool.toUpperCase(), 0, 20, 11, '#5b3d3b', 0);
      if (on) for (let i = 0; i < 4; i++) A.circle(ctx, -40 + Math.random() * 80, 40 + Math.random() * 20, 3, '#fff', 0);
    }
    ctx.restore();
    this.ui.label(on ? '' : 'HOLD', x, y + 90, 14, C.white, 'center', { stroke: 4 });
  };
}

module.exports = { install, SLOT_KEY };
