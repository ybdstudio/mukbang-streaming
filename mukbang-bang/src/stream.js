'use strict';
// V3 livestream (docs/GAME-DESIGN-V3.md §3): ONE food per stream.
//   sealed ─tap/drag→ opening ─→ open ─tap or drag a portion to the mouth→ chew (3 bites) ─→ react
//     └─ ×3 pickups (9 bites) ─→ empty ─→ finale ("VIRAL!") ─→ result
// Relaxed: no timers to beat. Optional extras: tap floating hearts, tap a fan gift.
// Installed onto Game.prototype.
const U = require('./util.js');
const D = require('./data.js');
const A = require('./art.js');
const K = require('./catalog.js');
const L = require('./levels.js');
const WR = require('./wardrobe.js');
const R = require('./recipes.js');
const S = require('./sprites.js');
const CA = require('./cookart.js');
const C = D.COLORS;

const PICKUPS = 3, BITES = 3;
// features that open with progress: previewed 2 streams before, then a "NEW!" popup with GO NOW
const FEATURES = L.MODES.map(function (m) { return { id: 'mode:' + m.id, at: m.unlock, name: m.name, color: m.color, dark: m.dark, go: 'side_' + m.id,
    desc: { market: 'Shop for snacks and eat them on a bonus stream', delivery: 'Order from restaurants and eat the delivery live', buffet: 'Stream from a buffet restaurant' }[m.id] }; })
  .concat([{ id: 'wardrobe', at: WR.OPEN_AT, name: 'WARDROBE', color: '#cdb0ff', dark: '#a98ae6', go: 'wardrobe', desc: 'Dress up your streamer: outfits, hair and extras' }])
  .concat(D.STREAMERS.filter(function (s) { return s.unlock > 1; }).map(function (s) { return { id: 'streamer:' + s.id, at: s.unlock, name: s.name.toUpperCase(), color: s.top, dark: s.topDark, go: 'streamers', desc: 'A new streamer joins the channel', streamer: s }; }))
  .sort(function (a, b) { return a.at - b.at; });
function featureFor(reached) {
  for (let i = 0; i < FEATURES.length; i++) if (FEATURES[i].at === reached) return { kind: 'open', f: FEATURES[i] };
  for (let i = 0; i < FEATURES.length; i++) { const rem = FEATURES[i].at - reached; if (rem === 2 || (rem === 1 && FEATURES[i].at <= 3)) return { kind: 'preview', f: FEATURES[i], rem: rem }; }
  return null;
}
const T = { opening: 0.75, carry: 0.45, bite: 0.85, firstBite: 0.2, react: 1.5, empty: 1.0, finale: 2.8 };
const CHEW = T.firstBite + T.bite * (BITES - 1) + 0.55;  // whole chew sequence
const MOUTH_R = 92;
const HEART_BOOST = 0.025, GIFT_BOOST = 0.06, EVENT_BOOST = 0.05, FINALE_BOOST = 0.08;
const BEAT = [
  { title: 'FIRST TASTE!', mult: 0.85, chat: 'bite', react: 6 },
  { title: 'FANS GOING WILD!', mult: 1.0, chat: 'bite', react: 12 },
  { title: 'LAST BITE!', mult: 1.15, chat: 'finish', react: 18 }
];
const TASTE_LINE = { crunch: 'SO CRUNCHY!', slurp: 'SLURRRP!', gulp: 'SO REFRESHING!', soft: 'SO FLUFFY!', lick: 'SO CREAMY!', bite: 'SO TASTY!', fizz: 'FIZZY!' };

function install(Game) {
  const P = Game.prototype;

  // ── starting a stream ──
  // V4: a level starts on the stream with the viewer's request; the dish is cooked first (cook.js), then eaten
  P.startStream = function (n) { CA.preload(); const lv = L.level(n); this.sessionLevels++; this.trans = 0.3; this.newRun({ level: lv.n, food: null, recipe: lv.recipe, request: lv.request, pack: 'plates', phase: 'request', loc: 'home', view: lv.view, cost: 0, cpb: lv.cpb, event: lv.event }); this.beginStream(); };
  // activities end here: one chosen food, a bonus stream that never advances the level
  // the next food of a multi-item order (supermarket basket, delivery, buffet plate)
  P.nextQueued = function () {
    const r = this.run, p = this.profile; let book; try { book = JSON.parse(p.get('foods_json') || '[]'); } catch (e) { book = []; }
    if (book.indexOf(r.food) < 0) { book.push(r.food); p.set('foods_json', JSON.stringify(book)); }
    const d = K.dish(r.queue.shift()) || K.dish('cat_chips');
    r.food = d.id; r.pack = L.packOf(d); r.pickups = 0; r.bites = 0; r.pt = 0; r.phase = 'sealed'; r.served = (r.served || 1) + 1; r.toppings = null;
    r.banner = { text: 'NEXT UP!', sub: d.name.toUpperCase() + (r.queue.length ? '  ·  ' + r.queue.length + ' MORE' : '  ·  LAST ONE'), t: 0 };
    this.audio.play('whoosh'); this.setFace('open', 0.8); this.pushChat('idle'); this.saveRun();
  };
  P.startFoodStream = function (foodId, o) {
    o = o || {}; const d = K.dish(foodId) || K.dish('cat_chips'); const reached = this.curLevel(); const lv = L.level(reached);
    const nItems = 1 + ((o.queue && o.queue.length) || 0);
    const cpb = Math.max(4, Math.round(Math.max((o.cost || 0) / nItems, 60 + 10 * reached) * 1.35 / (PICKUPS * BITES)));
    this.newRun({ level: 0, side: o.side || 'free', food: d.id, pack: L.packOf(d), loc: o.loc || 'home', view: lv.view, cost: o.cost || 0, cpb: cpb, event: L.EVENTS[1 + Math.floor(Math.random() * (L.EVENTS.length - 1))], toppings: o.toppings || null, goalLevel: reached, queue: (o.queue || []).slice() });
    this.trans = 0.3; this.beginStream();
  };
  P.newRun = function (o) {
    const lv = L.level(o.level || o.goalLevel || 1);
    const goal = o.level ? lv.goal : Math.round(lv.goal * 0.8), start = o.level ? lv.startViewers : Math.round(lv.startViewers * 0.8);
    this.run = { v: o.recipe ? 4 : 3, level: o.level || 0, side: o.side || null, food: o.food, recipe: o.recipe || null, request: o.request || null, dish: o.dish || null, perfect: false, pack: o.pack, loc: o.loc, view: o.view, event: o.event, toppings: o.toppings || null,
      cost: o.cost || 0, cpb: o.cpb, goal: goal, goal3: Math.round(goal * 1.3), start: start, hu: Math.max(1, (goal - start) * 1.0 / (PICKUPS * BITES)),
      viewers: start, peak: start, coins: 0, pickups: 0, bites: 0, phase: o.phase || 'sealed', pt: 0, hearts: 0, gift: null, giftTaken: false, eventDone: false, t: 0, finaleDone: false, queue: (o.queue || []).slice(), served: 1 };
    // bonus streams with several foods: viewer goal grows with the order
    if (this.run.queue.length) { const k = 1 + this.run.queue.length * 0.6; this.run.goal = Math.round(goal * k); this.run.goal3 = Math.round(this.run.goal * 1.3); this.run.hu = Math.max(1, (this.run.goal - start) / (PICKUPS * BITES * (1 + this.run.queue.length))); }
    this.saveRun();
  };
  P.beginStream = function () {
    const r = this.run; r.t = 0; r.pt = 0; this.carry = null; r.zoom = 0; r.banner = null;
    if (r.phase === 'opening') r.phase = 'open';
    if (r.phase === 'carry' || r.phase === 'react') r.phase = r.pickups >= PICKUPS ? 'empty' : 'open';
    if (r.phase === 'chew') r.pt = T.firstBite + T.bite * r.bites - 0.01; // resume the chew where the save left it
    this.reactions.length = 0; this.chat.length = 0; this.floats.length = 0; this.confetti.length = 0; this.hearts = [];
    this.face = { expr: 'idle', until: 0, blink: false, blinkT: 2, t: 0 };
    this.pushChat('idle');
    this.setState('stream');
  };
  // the food being eaten as a dish-like record (cooked V4 dish or a catalog food)
  P.runFood = function () {
    const r = this.run; if (!r.recipe) return K.dish(r.food);
    const d = r.dish || r.request, col = R.colorOf(d), rc = R.RECIPES[r.recipe];
    return { id: r.recipe, name: R.dishName(d), taste: R.tasteOf(d), sound: rc.sound, c1: col, c3: col, tags: [], bites: 3 };
  };
  P.platePos = function (i) { const W = this.W, H = this.H; return { x: W * [0.24, 0.5, 0.76][i], y: H * (i === 1 ? 0.7 : 0.655), size: Math.min(150, W * 0.27) }; };
  P.nextPlate = function () { return this.run.pickups; }; // plates are eaten left → right
  P.streamLevel = function () { const r = this.run; return L.level(r.level || r.goalLevel || this.curLevel()); };
  P.packPos = function () { return { x: this.W / 2, y: this.H * 0.665, size: Math.min(250, this.W * 0.46) }; };

  // ── save / resume (run_json v3; older runs are dropped — the level itself is kept) ──
  P.saveRun = function () {
    const r = this.run; if (!r) { this.profile.set('run_json', ''); return; }
    const o = {}; const keys = ['v', 'level', 'side', 'food', 'recipe', 'request', 'dish', 'perfect', 'giftAd', 'hyped', 'hotStart', 'pack', 'loc', 'view', 'event', 'toppings', 'cost', 'cpb', 'goal', 'goal3', 'start', 'hu', 'viewers', 'peak', 'coins', 'pickups', 'bites', 'phase', 'hearts', 'giftTaken', 'eventDone', 'goalLevel', 'ms', 'queue', 'served'];
    for (let i = 0; i < keys.length; i++) o[keys[i]] = r[keys[i]];
    o.viewers = Math.round(o.viewers); o.peak = Math.round(o.peak);
    this.profile.set('run_json', JSON.stringify(o));
  };
  P.restoreRun = function () {
    try {
      const r = JSON.parse(this.profile.get('run_json') || 'null');
      if (!r) return;
      const ok = (r.v === 3 && K.dish(r.food)) || (r.v === 4 && R.RECIPES[r.recipe]);
      if (!ok) { this.profile.set('run_json', ''); return; } // V1/V2 multi-food runs: start the level fresh
      if (r.v === 4 && !r.dish) r.phase = 'request'; // closed while cooking: cook again
      r.t = 0; r.pt = 0; this.run = r;
    } catch (e) { this.run = null; this.profile.set('run_json', ''); }
  };

  // ── input ──
  P.streamTouch = function (kind, id, x, y) {
    const r = this.run; if (!r || this.state !== 'stream') return false;
    if (kind === 'start') {
      // optional extras first: hearts, the fan gift
      for (let i = this.hearts.length - 1; i >= 0; i--) { const h = this.hearts[i]; if (!h.taken && U.dist(x, y, h.x, h.y) < 40) { this.tapHeart(h); return true; } }
      if (r.gift && !r.giftTaken && U.dist(x, y, r.gift.x, r.gift.y) < 60) { this.tapGift(); return true; }
      let pk = this.packPos(); let onPack = Math.abs(x - pk.x) < pk.size * 0.55 && Math.abs(y - pk.y) < pk.size * 0.55;
      if (r.recipe) { onPack = false; for (let i = r.pickups; i < PICKUPS; i++) { const pp = this.platePos(i); if (U.dist(x, y, pp.x, pp.y) < pp.size * 0.6) onPack = true; } }
      if (onPack && r.phase === 'sealed') { this.openPack(); return true; }
      if (onPack && r.phase === 'open') { if (r.recipe) { const pp = this.platePos(r.pickups); x = pp.x; y = pp.y; } this.carry = { tid: id, x: x, y: y, sx: x, sy: y, moved: false, drag: true }; r.phase = 'carry'; r.pt = 0; this.audio.play('pop', { gain: 0.5 }); return true; }
      return false;
    }
    const c = this.carry; if (!c || c.tid !== id || !c.drag) return false;
    if (kind === 'move') { c.x = x; c.y = y; if (U.dist(x, y, c.sx, c.sy) > 14) c.moved = true; const m = this.mouth(); if (U.dist(x, y, m.x, m.y) < MOUTH_R) this.deliver(); return true; }
    // release: a tap flies the portion to the mouth; a short drag that missed flies it back
    c.drag = false; c.fx = c.x; c.fy = c.y; c.ft = 0; c.back = c.moved;
    if (c.back) this.audio.play('drop', { gain: 0.5 });
    return true;
  };
  P.openPack = function () { const r = this.run; r.phase = 'opening'; r.pt = 0; this.audio.play(L.PACK_INFO[r.pack].sound === 'ding' ? 'ding' : L.PACK_INFO[r.pack].sound, { gain: 1.1 }); this.vibrate('short'); this.setFace('open', 1); this.pushChat('idle'); this.saveRun(); };
  P.deliver = function () { const r = this.run; if (r.phase !== 'carry') return; this.carry = null; r.phase = 'chew'; r.pt = 0; r.bites = 0; this.setFace(r.dish && r.dish.recipe === 'boba' ? 'sip' : 'open', r.dish && r.dish.recipe === 'boba' ? 1 : 0.3); this.saveRun(); };
  P.tapHeart = function (h) { const r = this.run; h.taken = true; r.hearts++; const v = Math.round(r.goal * HEART_BOOST); this.addViewers(v); this.floatText('+' + U.fmtViewers(v), h.x, h.y - 20, C.pink, 18); this.spawnSparkles(h.x, h.y, 8); this.audio.play('like', { gain: 0.6 }); };
  P.tapGift = function () { const r = this.run; r.giftTaken = true; const coins = r.cpb * 4, v = Math.round(r.goal * GIFT_BOOST); r.coins += coins; this.profile.add('coins', coins); this.addViewers(v); this.floatText('FAN GIFT  +' + coins, r.gift.x, r.gift.y - 50, C.gold, 22, true); this.spawnConfetti(r.gift.x, r.gift.y, 24); this.audio.play('cash'); r.gift = null; this.saveRun(); };
  // viewer milestones inside one stream: GOAL (2★) → GOAL 3★ → then +40 % each; the bar always aims at the next one
  P.milestone = function (i) { const r = this.run; return i <= 0 ? r.goal : i === 1 ? r.goal3 : Math.round(r.goal3 * Math.pow(1.4, i - 1)); };
  P.addViewers = function (v) {
    const r = this.run; r.viewers += v; r.peak = Math.max(r.peak, r.viewers); r.ms = r.ms || 0;
    while (r.peak >= this.milestone(r.ms)) {
      const n = r.ms; r.ms++; const bonus = r.cpb * (n + 1); r.coins += bonus; this.profile.add('coins', bonus);
      const label = n === 0 ? 'GOAL REACHED! ★★' : n === 1 ? 'SUPER GOAL! ★★★' : 'NEW RECORD GOAL!';
      r.banner = { t: 0, text: label, sub: 'NEXT GOAL ' + U.fmtViewers(this.milestone(r.ms)) + '  ·  +' + bonus };
      this.audio.play('levelup', { gain: 0.7 }); this.spawnConfetti(this.W / 2, this.top() + 78, 26);
    }
  };

  // ── one bite of the current pickup ──
  P.biteNow = function () {
    const r = this.run, d = this.runFood(), beat = BEAT[Math.min(r.pickups, PICKUPS - 1)];
    const taste = d.tastes ? d.tastes[r.bites % d.tastes.length] : d.taste;
    const hype = Math.round(r.hu * beat.mult * [0.9, 1.0, 1.1][r.bites] * (0.9 + 0.1 * D.TASTES[taste].mult) * (0.95 + Math.random() * 0.1));
    this.addViewers(hype); r.coins += r.cpb; this.profile.add('coins', r.cpb);
    const sipping = r.dish && r.dish.recipe === 'boba';
    this.setFace(sipping ? 'sip' : r.bites % 2 ? 'chew' : D.TASTES[taste].face, sipping ? 2 : 0.7);
    this.audio.play(d.sound || 'bite', { rate: 0.9 + Math.random() * 0.25, gain: 0.85 + r.pickups * 0.2 });
    if (taste === 'spicy') this.audio.play('fire', { gain: 0.6 }); else if (taste === 'cold') this.audio.play('shiver', { gain: 0.6 }); else if (taste === 'fizzy') this.audio.play('fizz', { gain: 0.6 }); else if (taste === 'sour') this.audio.play('sour', { gain: 0.6 }); else if (taste === 'sweet') this.audio.play('sweet', { gain: 0.4 });
    this.vibrate('short');
    const m = this.mouth();
    this.floatText('+' + U.fmtViewers(hype), m.x + 76, m.y - 30, C.white, 20); this.floatText('+' + r.cpb, m.x - 80, m.y - 40, C.gold, 18, true);
    for (let i = 0; i < 2 + r.pickups * 2; i++) this.spawnReaction();
    this.spawnCrumbs(m.x, m.y + 18, d);
    if (Math.random() < 0.55) this.pushChat(Math.random() < 0.5 ? taste : 'bite');
    r.bites++;
    this.saveRun();
  };
  P.spawnCrumbs = function (x, y, d) { for (let i = 0; i < 6; i++) this.confetti.push({ x: x + (Math.random() - 0.5) * 30, y: y, vx: (Math.random() - 0.5) * 160, vy: -60 - Math.random() * 120, life: 0, max: 0.7, color: i % 2 ? d.c1 : d.c3, r: 2.5 + Math.random() * 2.5, rot: 0, spin: 4 }); };
  // the emotional beat after each pickup
  P.pickupDone = function () {
    const r = this.run, d = this.runFood(), k = r.pickups, beat = BEAT[Math.min(k, PICKUPS - 1)];
    r.pickups++; r.bites = 0; r.phase = 'react'; r.pt = 0;
    const W = this.W, H = this.H;
    r.banner = { text: beat.title, sub: k === 0 ? (TASTE_LINE[d.sound] || 'SO GOOD!') : k === 1 ? U.fmtViewers(r.viewers) + ' WATCHING!' : 'ONE MORE…', t: 0 };
    this.setFace(k === 0 ? D.TASTES[d.taste].face : 'yum', T.react);
    for (let i = 0; i < beat.react; i++) this.spawnReaction(i % 3 ? null : 'heart');
    for (let i = 0; i <= k; i++) this.pushChat(i === 0 ? beat.chat : 'idle');
    this.audio.play(k === 0 ? 'ding' : 'like', { gain: 0.8 });
    if (k === 1) this.fanEvent();
    if (k === 1) for (let i = 0; i < 4; i++) this.spawnHeart(true);
    this.saveRun();
  };
  // the level's fan event (automatic, or optional to tap)
  P.fanEvent = function () {
    const r = this.run; if (r.eventDone) return; r.eventDone = true; const W = this.W, H = this.H; const ev = r.event;
    if (ev === 'hearts') { for (let i = 0; i < 8; i++) this.spawnHeart(true); this.floatText('HEART RAIN! TAP THEM!', W / 2, H * 0.47, C.pink, 24, true); }
    else if (ev === 'gift') { r.gift = { x: W * 0.84, y: H * 0.6, t: 0 }; this.floatText('A FAN SENT A GIFT!', W / 2, H * 0.47, C.gold, 24, true); this.audio.play('confetti'); }
    else if (ev === 'superchat') { const c = r.cpb * 3; r.coins += c; this.profile.add('coins', c); this.addViewers(Math.round(r.goal * EVENT_BOOST)); r.superchat = { t: 0, coins: c }; this.audio.play('cash'); }
    else if (ev === 'wave') { for (let i = 0; i < 6; i++) this.pushChat(['bite', 'idle', 'milestone'][i % 3], U.fmtViewers(r.viewers)); this.addViewers(Math.round(r.goal * EVENT_BOOST)); this.floatText('CHAT IS EXPLODING!', W / 2, H * 0.47, C.white, 24, true); }
    else if (ev === 'spotlight') { r.zoom = 1.6; this.addViewers(Math.round(r.goal * EVENT_BOOST * 1.2)); this.floatText('TRENDING #1', W / 2, H * 0.44, C.gold, 34, true); this.audio.play('levelup', { gain: 0.6 }); }
    else if (ev === 'duet') { r.duet = { t: 0, avatar: D.AVATARS[Math.floor(Math.random() * D.AVATARS.length)] }; for (let i = 0; i < 6; i++) this.spawnHeart(true); this.addViewers(Math.round(r.goal * EVENT_BOOST)); this.floatText('A FAN JOINED THE STREAM!', W / 2, H * 0.47, C.white, 22, true); }
  };
  P.spawnHeart = function (burst) { const W = this.W, H = this.H; const left = Math.random() < 0.5; this.hearts.push({ x: left ? W * (0.07 + Math.random() * 0.14) : W * (0.79 + Math.random() * 0.14), y: H * (0.6 + Math.random() * 0.22) + (burst ? 0 : 40), vy: 34 + Math.random() * 22, life: 0, max: 4.2, sway: Math.random() * 6, taken: false }); };

  // ── update ──
  P.updateStream = function (dt) {
    const r = this.run; if (!r) return; r.t += dt; r.pt += dt;
    if (r.zoom > 0) r.zoom = Math.max(0, r.zoom - dt);
    if (r.banner) { r.banner.t += dt; if (r.banner.t > 1.6) r.banner = null; }
    if (r.superchat) { r.superchat.t += dt; if (r.superchat.t > 3) r.superchat = null; }
    if (r.duet) { r.duet.t += dt; if (r.duet.t > 4) r.duet = null; }
    if (r.gift) r.gift.t += dt;
    // floating hearts (tappable bonus) while eating
    for (let i = this.hearts.length - 1; i >= 0; i--) { const h = this.hearts[i]; h.life += dt; h.y -= h.vy * dt; if (h.life > h.max || h.taken) this.hearts.splice(i, 1); }
    if ((r.phase === 'chew' || r.phase === 'react') && Math.random() < dt * 0.9) this.spawnHeart(false);
    // ambient
    this.ambT = (this.ambT || 0) - dt; if (this.ambT < 0) { this.spawnReaction(); this.ambT = 0.4 + Math.random() * 0.8; }
    this.chatT = (this.chatT || 0) - dt; if (this.chatT < 0) { this.pushChat('idle'); this.chatT = 2.6 + Math.random() * 2.4; }
    if (r.viewers > r.start && r.phase !== 'finale') r.viewers = Math.max(r.start, r.viewers - r.viewers * 0.002 * dt);
    switch (r.phase) {
      case 'opening': if (r.pt >= T.opening) { r.phase = 'open'; r.pt = 0; this.setFace('yum', 0.8); this.spawnSparkles(this.packPos().x, this.packPos().y, 16); this.pushChat('bite'); this.saveRun(); } break;
      case 'carry': {
        const c = this.carry; if (!c) { r.phase = 'open'; break; }
        if (!c.drag) {
          c.ft += dt / T.carry; const pk = this.packPos(), m = this.mouth(); const k = U.easeInOut(Math.min(1, c.ft));
          const home = r.recipe ? this.platePos(r.pickups) : pk; const tx = c.back ? home.x : m.x, ty = c.back ? home.y - 20 : m.y;
          c.x = U.lerp(c.fx, tx, k); c.y = U.lerp(c.fy, ty, k) - Math.sin(k * Math.PI) * (c.back ? 30 : 60);
          if (c.ft >= 1) { if (c.back) { this.carry = null; r.phase = 'open'; } else this.deliver(); }
        }
        const m = this.mouth(); if (this.carry && U.dist(this.carry.x, this.carry.y, m.x, m.y) < MOUTH_R * 0.6 && this.face.expr !== 'open') this.face.expr = 'open';
        break;
      }
      case 'chew': {
        const want = r.pt < T.firstBite ? 0 : Math.min(BITES, 1 + Math.floor((r.pt - T.firstBite) / T.bite));
        while (r.bites < want) this.biteNow();
        if (r.pt >= CHEW) this.pickupDone();
        break;
      }
      case 'react': if (r.pt >= T.react) { r.pt = 0; if (r.pickups >= PICKUPS) { r.phase = 'empty'; this.audio.play('pop'); this.floatText('ALL GONE!', this.packPos().x, this.packPos().y - 90, C.white, 26, true); } else r.phase = 'open'; this.saveRun(); } break;
      case 'empty': if (r.pt >= T.empty) {
        if (!r.recipe && r.queue && r.queue.length) { this.nextQueued(); break; }   // more food in the order: open the next one
        r.phase = 'finale'; r.pt = 0; this.viralFinish(); } break;
      case 'finale': if (r.pt >= T.finale) this.finishRun(); break;
    }
  };
  P.viralFinish = function () {
    const r = this.run, W = this.W, H = this.H;
    let bonus = r.cpb * 3;
    if (r.recipe && r.level) { const lv = L.level(r.level); r.mission = Math.round(lv.reward * (r.perfect ? 1.5 : 1)); bonus += r.mission; }
    r.coins += bonus; this.profile.add('coins', bonus);
    this.addViewers(Math.round(r.goal * (FINALE_BOOST + (r.perfect ? 0.12 : 0))));
    r.banner = { text: r.mission ? 'MISSION COMPLETE!' : 'VIRAL!', sub: U.fmtViewers(r.peak) + ' VIEWERS  ·  +' + bonus + ' COINS', t: 0, big: true };
    this.setFace('yum', T.finale); this.audio.play('win'); this.spawnConfetti(W / 2, H * 0.4, 80); this.vibrate('long');
    for (let i = 0; i < 20; i++) this.spawnReaction(i % 2 ? 'heart' : null);
    this.pushChat('milestone', U.fmtViewers(r.peak)); this.pushChat('finish');
    this.saveRun();
  };

  // ── result ──
  P.finishRun = function () {
    const r = this.run, p = this.profile; if (!r) return;
    let stars = r.peak >= r.goal3 ? 3 : r.peak >= r.goal ? 2 : 1; if (r.perfect && stars < 3) stars++; // matching the request is worth a star
    p.add('streams', 1);
    if (r.peak > (p.get('best_viewers') || 0)) p.set('best_viewers', Math.round(r.peak));
    const fid = r.recipe || r.food;
    const res = { side: r.side, food: r.food, dish: r.dish, perfect: r.perfect, mission: r.mission || 0, stars: stars, peak: Math.round(r.peak), goal: r.goal, coins: r.coins, hearts: r.hearts, gift: r.giftTaken, unlocks: [], firstClear: false, bonusTaken: false, t: 0 };
    // collection: every food eaten once is in the food book
    let book; try { book = JSON.parse(p.get('foods_json') || '[]'); } catch (e) { book = []; }
    if (book.indexOf(fid) < 0) { book.push(fid); p.set('foods_json', JSON.stringify(book)); res.unlocks.push('FOOD BOOK: ' + (r.recipe ? R.RECIPES[r.recipe].name : K.dish(r.food).name).toUpperCase()); }
    if (r.level) {
      const lv = L.level(r.level); res.lv = lv;
      const st = this.stars(); if (stars > (st[lv.n] || 0)) st[lv.n] = stars; p.set('stars_json', JSON.stringify(st));
      res.firstClear = lv.n > (p.get('levels_done') || 0);
      if (res.firstClear) {
        p.set('levels_done', lv.n); this.hs.claimLevelBonus();
        for (let i = 0; i < lv.unlocks.length; i++) { const u = lv.unlocks[i];
          if (u.indexOf('look:') === 0) { const it = WR.BY_ID[u.slice(5)]; if (it && WR.grant(p, it.id)) res.unlocks.push('NEW LOOK: ' + it.name.toUpperCase()); }
          else if (u.indexOf('mode:') === 0) res.unlocks.push('NEW ACTIVITY: ' + L.modeOf(u.slice(5)).name);
          else if (u.indexOf('streamer:') === 0) res.unlocks.push('NEW STREAMER: ' + u.slice(9).toUpperCase());
          else if (u === 'wardrobe') res.unlocks.push('WARDROBE OPEN!');
        }
        if (lv.n < L.LEVEL_COUNT) { const nx = L.level(lv.n + 1); for (let i = 0; i < nx.news.length && i < 1; i++) res.unlocks.push('NEXT: ' + nx.news[i]); }
      }
      if (res.firstClear && lv.n < L.LEVEL_COUNT) res.feature = featureFor(lv.n + 1);
      if (lv.n >= (p.get('level') || 1)) p.set('level', Math.min(L.LEVEL_COUNT, lv.n + 1));
    }
    if ((p.get('streams') || 0) === 1) this.hs.claimFirstStream();
    this.result = res; this.run = null; this.saveRun(); this.hearts = [];
    if (res.unlocks.length) this.audio.play('levelup');
    this.setState('result');
  };

  // ── drawing ──
  P.drawStream = function (still) {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, r = this.run;
    const lv = r ? this.streamLevel() : (this.result && this.result.lv) || L.level(this.curLevel());
    const loc = r ? r.loc : 'home', view = r ? r.view : lv.view;
    const zoom = r && r.zoom > 0 ? 1 + 0.06 * Math.sin(Math.min(1, r.zoom / 1.6) * Math.PI) : 1;
    ctx.save(); if (zoom !== 1) { ctx.translate(W / 2, H * 0.35); ctx.scale(zoom, zoom); ctx.translate(-W / 2, -H * 0.35); }
    if (loc === 'restaurant') A.restaurantBg(ctx, W, H, this.time); else A.homeRoom(ctx, view, this.p.createCanvas, W, H, this.scale, this.time);
    const hp = this.headPos(); const fc = this.face; const sd = this.streamerDef();
    A.streamer(ctx, sd, hp.x, hp.y, hp.s, { expr: fc.expr, t: fc.t, blink: fc.blink, bob: fc.bob + (r && r.phase === 'chew' && !(r.dish && r.dish.recipe === 'boba') ? Math.sin(r.pt * 14) * 3 : 0), look: WR.look(this.profile, sd.id) });
    A.table(ctx, view, W, H * 0.5, H);
    A.phoneStick(ctx, W * 0.08, H * 0.38, 0.85, this.time);
    ctx.restore();
    if (r) {
      let pk = this.packPos(); const d = this.runFood();
      const ph = r.phase, e = Math.min(1, r.pickups / PICKUPS);
      const glow = (ph === 'sealed' || ph === 'open') && !still;
      if (r.recipe) {
        // V4: the cooked dish, served as 3 portions on plates (eaten left → right)
        const served = !!r.dish && ph !== 'request';
        for (let i = 0; i < PICKUPS; i++) {
          const pp = this.platePos(i); const eaten = served && i < r.pickups; const molded = r.dish && R.RECIPES[r.dish.recipe] && R.RECIPES[r.dish.recipe].container === 'mold'; if (!CA.sprite(ctx, eaten ? 'stream/serve_plate_empty_crumbs.png' : 'stream/serve_plate.png', pp.x, pp.y + pp.size * (molded ? 0.4 : 0.31), pp.size * 1.05)) { A.ellipse(ctx, pp.x, pp.y + pp.size * 0.32, pp.size * 0.48, pp.size * 0.13, '#e9f3ff', 4); A.ellipse(ctx, pp.x, pp.y + pp.size * 0.31, pp.size * 0.36, pp.size * 0.08, '#f8fbff', 0); }
          if (!served || i < r.pickups) continue;
          const ramen = r.dish.recipe === 'ramen', cur = i === r.pickups && (this.carry || ph === 'chew');
          if (cur && !ramen) continue;   // that portion is in her hands / at her mouth
          if (cur && ramen) { R.draw(ctx, A, r.dish, pp.x, pp.y, pp.size, { flipped: true, set: ph !== 'chew' || r.bites < 2, fill: 1, tops: ph === 'chew' ? Math.max(0, 2 - r.bites) : 2, deco: 1 }); continue; }
          const bob = glow && i === r.pickups ? Math.sin(this.time * 4) * 3 : 0;
          if (glow && i === r.pickups) { ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.time * 5); A.circle(ctx, pp.x, pp.y, pp.size * 0.5, '#fff8d0', 0); ctx.globalAlpha = 1; }
          R.draw(ctx, A, r.dish, pp.x, pp.y + bob, pp.size, { flipped: true, set: true, fill: 1, tops: 3, deco: 1, plate: !S.v4('stream/serve_plate.png') });
        }
        pk = this.platePos(1);
        if (this.carry && r.dish) this.drawBite(r.dish, this.carry.x, this.carry.y, 100, 0);
        // eaten bite by bite at her mouth
        if (ph === 'chew' && r.dish) { const m = this.mouth(), b = Math.min(3, r.bites);
          if (r.dish.recipe === 'boba') { // the cup is raised so the straw tip touches her lips; the tea level drops with each sip
            const t = this.time, sz = 190, sq = 1 + Math.sin(t * 9) * 0.015; this.drawBite(r.dish, m.x + 18, m.y + sz * 0.62, sz * sq, Math.min(2.6, r.bites + (r.pt % T.bite) / T.bite * 0.9));
            for (let i = 0; i < 3; i++) { const ph2 = (t * 1.5 + i / 3) % 1; ctx.globalAlpha = 1 - ph2; A.circle(ctx, m.x + 30 + i * 8, m.y + sz * 0.95 - ph2 * sz * 0.4, 3.5, '#3d2a24', 0); } ctx.globalAlpha = 1;
          } else this.drawBite(r.dish, m.x + 4, m.y + 112 + Math.sin(r.pt * 14) * 2, 150, b); }
        if (ph === 'request' && !still) this.drawRequest();
      } else {
        const state = ph === 'sealed' ? 'sealed' : ph === 'opening' ? 'opening' : (ph === 'empty' || ph === 'finale') ? 'empty' : 'open';
        if (glow) { ctx.globalAlpha = 0.25 + 0.15 * Math.sin(this.time * 5); A.circle(ctx, pk.x, pk.y, pk.size * 0.55, '#fff8d0', 0); ctx.globalAlpha = 1; }
        A.pack(ctx, d, r.pack, pk.x, pk.y + (glow ? Math.sin(this.time * 3) * 3 : 0), pk.size, state, ph === 'opening' ? r.pt / T.opening : 0, e, this.time, r.toppings);
        for (let i = 0; i < PICKUPS; i++) { const px = pk.x + (i - 1) * 34, py = pk.y + pk.size * 0.5 + 18; A.circle(ctx, px, py, 11, i < r.pickups ? C.pink : 'rgba(255,255,255,0.85)', 3); if (i < r.pickups) A.heart(ctx, px, py + 1, 5, '#fff', 0); }
        if (this.carry) A.portion(ctx, d, this.carry.x, this.carry.y, 110, this.time);
      }
      // mouth target while carrying
      if (ph === 'carry' && this.carry && this.carry.drag) { const m = this.mouth(); const a = 0.4 + 0.25 * Math.sin(this.time * 8); ctx.strokeStyle = 'rgba(255,255,255,' + a + ')'; ctx.lineWidth = 5; ctx.setLineDash([10, 10]); ctx.beginPath(); ctx.arc(m.x, m.y, MOUTH_R - 10, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      // hints
      if (!still) {
        if (ph === 'sealed') ui.label('TAP · ' + L.PACK_INFO[r.pack].open + '!', W / 2, pk.y - pk.size * 0.62, 20, C.white, 'center', { stroke: 6 });
        else if (ph === 'open') ui.label(r.pickups === 0 ? 'TAP OR DRAG A PLATE TO HER MOUTH' : 'NEXT ONE!  (' + (r.pickups + 1) + '/' + PICKUPS + ')', W / 2, pk.y - pk.size * 0.62 - (r.recipe ? 10 : 0), r.pickups === 0 ? 17 : 20, C.white, 'center', { stroke: 6 });
        const hypeOk = ph === 'open' && r.pickups === PICKUPS - 1 && !r.hyped && this.canHype();
        if (hypeOk) this.drawHypeBtn(); else if (ph === 'open' && r.pickups >= 1 && !r.giftAd && this.canFanGift()) this.drawFanGiftBtn();
      }
      // fan gift
      if (r.gift && !r.giftTaken) { const g = r.gift; const drop = Math.min(1, g.t * 2.5); A.mysteryBox(ctx, g.x, U.lerp(-60, g.y, U.easeOutCubic(drop)), 90, this.time, 0, true); if (drop >= 1) ui.label('TAP!', g.x, g.y + 56, 15, C.white, 'center', { stroke: 4 }); }
    }
    this.drawReactions();
    // tappable hearts
    for (let i = 0; i < (this.hearts || []).length; i++) { const h = this.hearts[i]; const a = h.life < 0.3 ? h.life / 0.3 : h.life > h.max - 0.6 ? (h.max - h.life) / 0.6 : 1; ctx.globalAlpha = Math.max(0, a); const hx = h.x + Math.sin(h.life * 2 + h.sway) * 10; h.x += 0; A.reaction(ctx, 'heart', hx, h.y, 20 + Math.sin(this.time * 6 + h.sway) * 2); ctx.globalAlpha = 1; }
    // chat
    const chatY = this.bottom() - 38;
    const maxChat = r && r.phase === 'request' ? 2 : 3; // the request screen keeps room for HOME / SHOP / WARDROBE
    for (let i = this.chat.length - 1, k = 0; i >= 0 && k < maxChat; i--, k++) {
      const c = this.chat[i]; const a = c.life < 0.25 ? c.life / 0.25 : 1; ctx.globalAlpha = a * (k === 2 ? 0.6 : 1);
      const y = chatY - k * 60 + (1 - a) * 20; const tw = ui.measure(c.text, 21) + 34;
      A.avatar(ctx, c.avatar, 46, y, 25); ui.panel(80, y - 24, Math.min(tw, W - 100), 48, 'rgba(255,255,255,0.94)', C.outline, 18, 3); ui.label(c.text, 97, y + 1, 21, C.text, 'left');
    }
    ctx.globalAlpha = 1;
    const top = this.hud({ viewers: r ? U.fmtViewers(r.viewers) : U.fmtViewers(this.result ? this.result.peak : 0) });
    if (r && !still) ui.button('pause', W - 56, top + 70, 40, 40, 'II', { color: C.lavender, dark: C.lavenderDark, size: 16, radius: 20 });
    if (!r) return;
    if (!still && this.canBoost()) ui.button('boost_ad', W - 150, H * 0.47, 136, 56, '▶ VIRAL BOOST', { color: C.yellow, dark: C.yellowDark, size: 15, sub: '+25% VIEWERS', badge: true });
    { const ms = r.ms || 0, lo = ms ? this.milestone(ms - 1) : r.start, hi = this.milestone(ms), t = Math.max(0, Math.min(1, (r.peak - lo) / Math.max(1, hi - lo)));
      ui.bar(W / 2 - 92, top + 70, 184, 16, t, ms >= 2 ? C.gold : ms === 1 ? C.green : C.pink);
      ui.label((ms === 0 ? 'GOAL ' : ms === 1 ? '3★ GOAL ' : 'GOAL ' + (ms + 1) + ' · ') + U.fmtViewers(hi), W / 2 + 108, top + 79, 11, C.white, 'left', { stroke: 3 });
      for (let k = 0; k < Math.min(ms, 5); k++) A.star(ctx, W / 2 - 100 - k * 14, top + 78, 6, C.gold, 1.5); }
    ui.label(r.level ? 'STREAM ' + r.level + ' · ' + this.streamLevel().title.toUpperCase() : L.modeOf(r.side) ? L.modeOf(r.side).name + ' STREAM' : 'BONUS STREAM', W / 2, top + 100, 12, C.white, 'center', { stroke: 4 });
    // superchat banner / duet bubble
    if (r.superchat) { const a = Math.min(1, r.superchat.t * 4, (3 - r.superchat.t) * 3); ctx.globalAlpha = Math.max(0, a); ui.panel(40, top + 120, W - 80, 52, '#ffd95e', C.goldDark, 20, 4); ui.label('SUPER CHAT  +' + r.superchat.coins + '  ·  "you are the best!!"', W / 2, top + 146, 16, C.text); ctx.globalAlpha = 1; }
    if (r.duet) { const a = Math.min(1, r.duet.t * 3, (4 - r.duet.t) * 2); ctx.globalAlpha = Math.max(0, a); ui.panel(W - 140, top + 130, 120, 120, '#fff', C.outline, 18, 4); A.avatar(ctx, r.duet.avatar, W - 80, top + 182, 38); ui.label('FAN DUET', W - 80, top + 236, 12, C.pinkDark); ctx.globalAlpha = 1; }
    // beat banner
    if (r.banner && !still) { const b = r.banner; const k = U.easeOutBack(Math.min(1, b.t * 3)); const a = b.big ? 1 : Math.min(1, (1.6 - b.t) * 3); ctx.globalAlpha = Math.max(0, a); ctx.save(); ctx.translate(W / 2, H * 0.47); ctx.scale(k, k); ui.title(b.text, 0, 0, b.big ? 64 : 36, b.big ? C.yellow : C.white, C.pinkDark, (W - 36) / Math.max(0.01, k)); if (b.sub) ui.label(b.sub, 0, b.big ? 48 : 34, b.big ? 20 : 18, C.white, 'center', { stroke: 5 }); ctx.restore(); ctx.globalAlpha = 1; }
  };
  // the viewer's request (start of every level) and the big MAKE button
  P.drawRequest = function () {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, r = this.run, req = r.request, lv = L.level(r.level), top = this.top();
    const y = top + 116, a = Math.min(1, r.t * 3); ctx.globalAlpha = a;
    ui.panel(18, y, W - 36, 150, '#ffffff', C.lavenderDark, 26, 5); A.rr(ctx, 18, y, W - 36, 40, 18); ctx.fillStyle = '#efe4ff'; ctx.fill();
    ui.label('VIEWER REQUEST', W / 2, y + 21, 20, C.lavenderDark);
    A.avatar(ctx, D.AVATARS[r.level % D.AVATARS.length], 62, y + 96, 28);
    R.draw(ctx, A, req, W * 0.33, y + 96, 100, { flipped: true, set: true, fill: 1, tops: 1, deco: 0 });
    ui.label(R.dishName(req), W * 0.66, y + 80, 24, C.text); const ts = R.opt(R.toppingSlot(req.recipe), req.topping); ui.label('+ ' + (ts ? ts.name : ''), W * 0.66, y + 110, 18, C.textLight);
    A.coin(ctx, W - 92, y + 130, 11); ui.label(String(lv.reward), W - 74, y + 131, 18, C.goldDark, 'left');
    ctx.globalAlpha = 1;
    const by = this.bottom() - 262, pulse = 1 + Math.sin(this.time * 5) * 0.04;
    ctx.save(); ctx.translate(W / 2, by + 36); ctx.scale(pulse, pulse); ctx.translate(-W / 2, -(by + 36));
    if (CA.panel(ctx, 'cook/btn_make.png', W * 0.18, by, W * 0.64, 72)) { ui.label(R.RECIPES[r.recipe].make, W / 2, by + 38, 26, C.white, 'center', { stroke: 6 }); ui.hotspot('cook_go', W * 0.18, by, W * 0.64, 72); } else ui.button('cook_go', W * 0.18, by, W * 0.64, 72, R.RECIPES[r.recipe].make, { color: C.yellow, dark: C.yellowDark, size: 26 }); ctx.restore();
    this.drawLeaveRow();
    if (r.level === 1 && (this.profile.get('streams') || 0) === 0) { const fx = W * 0.7 + Math.sin(this.time * 4) * 6, fy = by + 60 + Math.cos(this.time * 4) * 6; A.circle(ctx, fx, fy, 16, 'rgba(255,255,255,0.85)', 3); ui.label('TAP!', fx, fy + 30, 14, C.white, 'center', { stroke: 4 }); }
  };
  P.canFanGift = function () { return this.hs.hasAds() && this.hs.canShowFanGift && this.hs.canShowFanGift() && (this.profile.get('streams') || 0) >= 2; };
  // extra hype: before the stream ends (last plate) an opt-in ad pushes the viewers up for the finale
  P.canHype = function () { const r = this.run; return this.hs.hasAds() && r && !!r.recipe && !r.side && this.hs.canShowHype && (this.profile.get('streams') || 0) >= 2 && this.hs.canShowHype(); };
  P.drawHypeBtn = function () {
    const ui = this.ui, ctx = this.ctx, W = this.W, top = this.top(), y = top + 120;
    ui.panel(24, y, W - 150, 54, '#fff3c4', C.goldDark, 20, 3); A.star(ctx, 52, y + 27, 15, C.gold, 3); ui.label('LAST PLATE! Go viral?', 80, y + 20, 13, C.text, 'left'); ui.label('+50% viewers for the finale', 80, y + 39, 12, C.pinkDark, 'left');
    ui.button('hype_ad', W - 170, y + 6, 120, 42, '▶ HYPE', { color: C.pink, dark: C.pinkDark, size: 17 });
  };
  // one portion with `bites` (0..3) taken: noodles on chopsticks get shorter, drinks go down, everything else loses a bite
  P.drawBite = function (dish, x, y, size, bites) {
    const ctx = this.ctx, left = 1 - bites / BITES;
    if (bites >= BITES) return;
    // art V4 bites (spoon / hand / chopsticks, 3 states) when loaded
    if (dish.recipe !== 'boba' && CA.bite(ctx, dish.recipe, R.colorOf(dish), Math.min(2, Math.floor(bites)), x, y + size * 0.18, size * 1.35)) return;
    if (dish.recipe === 'ramen') { const b = R.opt('broth', dish.broth); R.noodleBite(ctx, x, y + size * 0.2, size * 1.15, left, b ? b.color : null); return; }
    const st = { flipped: true, set: true, fill: 1, tops: 3, deco: 1 };
    if (dish.recipe === 'boba') { st.fill = Math.max(0.12, left); st.deco = bites ? 0 : 1; R.draw(ctx, A, dish, x, y, size, st); return; }
    const N = 360; if (!this.biteCv) this.biteCv = S.canvas(N, N);
    const cv = this.biteCv, bx = cv && cv.getContext ? cv.getContext('2d') : null;
    if (!bx) { R.draw(ctx, A, dish, x, y, size * (0.4 + 0.6 * left), st); return; }
    bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalCompositeOperation = 'source-over'; bx.clearRect(0, 0, N, N);
    R.draw(bx, A, dish, N / 2, N * 0.53, N * 0.7, st);
    // bite marks: each one a scalloped half-moon out of the top (right first, then left)
    bx.globalCompositeOperation = 'destination-out';
    const BITE = [[0.7, 0.3], [0.28, 0.32]];
    for (let k = 0; k < bites && k < BITE.length; k++) { const cx = BITE[k][0] * N, cy = BITE[k][1] * N, rr = N * 0.17;
      bx.beginPath(); bx.arc(cx, cy, rr, 0, Math.PI * 2); for (let j = -2; j <= 2; j++) { const a = Math.PI / 2 + j * 0.42; bx.moveTo(cx + Math.cos(a) * rr * 1.05 + rr * 0.2, cy + Math.sin(a) * rr * 1.05); bx.arc(cx + Math.cos(a) * rr * 1.05, cy + Math.sin(a) * rr * 1.05, rr * 0.2, 0, Math.PI * 2); } bx.fill(); }
    bx.globalCompositeOperation = 'source-over';
    const k = size / (N * 0.7); ctx.drawImage(cv, x - N / 2 * k, y - N * 0.53 * k, N * k, N * k);
  };
  P.drawFanGiftBtn = function () {
    const ui = this.ui, ctx = this.ctx, W = this.W, top = this.top(), y = top + 120;
    ui.panel(24, y, W - 150, 54, '#ffe6f0', C.pinkDark, 20, 3); A.avatar(ctx, 'bear', 52, y + 27, 17); ui.label('I have a gift for you!', 80, y + 20, 13, C.text, 'left'); const g = this.hs.rewardsFanGift ? this.hs.rewardsFanGift() : null; ui.label(g ? this.itemsText(g) : '', 80, y + 39, 12, C.goldDark, 'left');
    ui.button('fangift_ad', W - 170, y + 6, 120, 42, '▶ GET', { color: C.green, dark: C.greenDark, size: 17 });
  };
  P.drawFeature = function (fe) {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, f = fe.f, open = fe.kind === 'open';
    ui.dim(0.35); ui.hotspot('feat_block', 0, 0, W, H);
    const pw = W - 70, ph2 = 330, px = 35, py = H * 0.5 - ph2 / 2, s = U.easeOutBack(Math.min(1, ((this.result && this.result.t) || 1) * 2 - 1.2));
    ctx.save(); ctx.translate(W / 2, py + ph2 / 2); ctx.scale(Math.max(0.01, s), Math.max(0.01, s)); ctx.translate(-W / 2, -(py + ph2 / 2));
    ui.panel(px, py, pw, ph2, '#fff', f.dark, 28, 5);
    A.rr(ctx, px, py, pw, 50, 24); ctx.fillStyle = f.color; ctx.fill();
    ui.title(open ? 'NEW FEATURE!' : 'COMING SOON', W / 2, py + 27, 26, C.white, f.dark);
    // icon
    const ix = W / 2, iy = py + 118;
    if (f.streamer) A.streamer(ctx, f.streamer, ix, iy + 6, 0.32, { expr: 'yum', t: this.time, blink: 0 });
    else {
      const key = f.id.indexOf('mode:') === 0 ? f.id.slice(5) : f.id;
      if (!S.v4draw(ctx, 'features/' + key + '.png', ix, iy, 128)) { A.circle(ctx, ix, iy, 48, f.color, 5); A.star(ctx, ix, iy, 26, '#fff', 3); }
      if (!open && !S.v4draw(ctx, 'features/lock.png', ix + 40, iy + 34, 40)) A.lock(ctx, ix + 34, iy + 30, 22);
    }
    for (let i = 0; i < 6; i++) { const a = this.time * 1.5 + i * 1.05; A.star(ctx, ix + Math.cos(a) * 72, iy + Math.sin(a) * 50, 6, C.gold, 1); }
    ui.title(f.name, W / 2, py + 196, 30, C.white, f.dark);
    ui.label(f.desc, W / 2, py + 228, 14, C.text);
    ui.label(open ? 'Open now from the home screen' : 'Opens in ' + fe.rem + ' stream' + (fe.rem > 1 ? 's' : '') + '!', W / 2, py + 250, 13, open ? C.greenDark : C.pinkDark);
    if (open) { ui.button('feat_go', px + 20, py + ph2 - 70, pw / 2 - 26, 54, 'GO NOW', { color: C.green, dark: C.greenDark, size: 20 }); ui.button('feat_later', W / 2 + 6, py + ph2 - 70, pw / 2 - 26, 54, 'LATER', { color: C.lavender, dark: C.lavenderDark, size: 20 }); }
    else ui.button('feat_ok', W / 2 - 80, py + ph2 - 70, 160, 54, 'OK!', { color: f.color, dark: f.dark, size: 22 });
    ctx.restore();
  };
  // the request screen: you may leave the stream room (the request waits)
  P.drawLeaveRow = function () {
    const ui = this.ui, W = this.W, y = this.bottom() - 178, items = [['req_home', 'HOME', C.lavender, C.lavenderDark]];
    if (this.modeOpen('market')) items.push(['side_market', 'SHOP', '#ffd7a3', '#f0a860']);
    if (this.curLevel() >= WR.OPEN_AT || (this.profile.get('levels_done') || 0) >= WR.OPEN_AT) items.push(['wardrobe', 'WARDROBE', '#cdb0ff', '#a98ae6']);
    if (items.length < 2 && (this.profile.get('streams') || 0) === 0 && !this.p.devTools) return;
    const bw = Math.min(130, (W * 0.64 - (items.length - 1) * 8) / items.length), x0 = W / 2 - (items.length * bw + (items.length - 1) * 8) / 2;
    for (let i = 0; i < items.length; i++) ui.button(items[i][0], x0 + i * (bw + 8), y, bw, 42, items[i][1], { color: items[i][2], dark: items[i][3], size: 14, radius: 14 });
  };
  P.drawResult = function () {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, res = this.result, hs = this.hs;
    ui.dim(0.4);
    const ph = 300 + res.unlocks.length * 26; const py = Math.max(this.top() + 100, H * 0.12);
    ui.panel(24, py, W - 48, ph, C.cream, C.outline, 26);
    ui.title(res.stars >= 3 ? 'SUPER VIRAL!' : res.stars >= 2 ? 'VIRAL STREAM!' : 'GREAT STREAM!', W / 2, py + 46, 36, C.white, C.pinkDark);
    ui.label(res.lv ? 'STREAM ' + res.lv.n + ' · ' + res.lv.title.toUpperCase() : (L.modeOf(res.side) ? L.modeOf(res.side).name : 'BONUS') + ' STREAM', W / 2, py + 76, 13, C.textLight);
    for (let k = 0; k < 3; k++) { const on = k < res.stars; const sc = on ? U.easeOutBack(Math.min(1, Math.max(0, res.t * 2 - k * 0.5))) : 1; ctx.save(); ctx.translate(W / 2 + (k - 1) * 70, py + 116); ctx.scale(sc, sc); A.uiStar(ctx, 0, 0, 28, on, '#e8e0e0', 4); ctx.restore(); }
    if (res.dish) R.draw(ctx, A, res.dish, W / 2 - 150, py + 116, 70, { flipped: true, set: true, fill: 1, tops: 3, deco: 1 }); else A.food(ctx, K.dish(res.food), W / 2 - 150, py + 116, 70, 0, this.time);

    ui.label('PEAK ' + U.fmtViewers(res.peak) + '  (goal ' + U.fmtViewers(res.goal) + ')', W / 2, py + 166, 20, C.text);
    ui.label(res.mission ? 'MISSION +' + res.mission + (res.perfect ? '  ·  PERFECT MATCH ★' : '') : 'hearts tapped ' + res.hearts + (res.gift ? '  ·  fan gift ✓' : ''), W / 2, py + 192, 13, res.mission ? C.pinkDark : C.textLight);
    A.coin(ctx, W / 2 - 60, py + 226, 12); ui.label('+' + U.fmtCoins(res.coins), W / 2 + 8, py + 226, 26, C.goldDark);
    let y = py + 258;
    if (res.firstClear) { const rb = hs.rewardsLevelBonus(); if (rb) { ui.label('LEVEL BONUS  ' + this.itemsText(rb), W / 2, y, 15, C.pinkDark); y += 24; } }
    for (let i = 0; i < res.unlocks.length; i++) { ui.label('★ ' + res.unlocks[i], W / 2, y, 15, C.greenDark); y += 26; }
    if (res.stars < 3) ui.label('tip: tap the floating hearts for 3 stars', W / 2, py + ph - 14, 12, C.textLight);
    y = py + ph + 14;
    if (res.feature && !res.featureDone && res.t > 0.6) { this.drawFeature(res.feature); return; }
    const bonus = hs.rewardsBonusCoins();
    if (hs.hasAds() && hs.canShowBonusCoins() && bonus && !res.bonusTaken) { ui.button('bonus_ad', 40, y, W - 80, 56, '▶  WATCH AD:  ' + this.itemsText(bonus), { color: C.blue, dark: C.blueDark, size: 17 }); y += 68; }
    if (res.lv) {
      const canNext = res.lv.n < L.LEVEL_COUNT;
      ui.button(canNext ? 'next' : 'replay', 40, y, W - 80, 70, canNext ? 'NEXT STREAM  ›' : 'STREAM AGAIN', { color: C.pink, dark: C.pinkDark, size: 26 }); y += 84;
      ui.button('replay', 40, y, (W - 90) / 2, 56, 'REPLAY', { color: C.mint, dark: C.mintDark, size: 20 });
    } else {
      ui.button('side_' + res.side, 40, y, W - 80, 64, 'AGAIN  ›', { color: C.pink, dark: C.pinkDark, size: 24 }); y += 78;
      ui.button('res_main', 40, y, (W - 90) / 2, 56, 'MAIN STREAM', { color: C.mint, dark: C.mintDark, size: 17 });
    }
    ui.button('res_home', 50 + (W - 90) / 2, y, (W - 90) / 2, 56, 'HOME', { color: C.lavender, dark: C.lavenderDark, size: 20 });
  };
}

module.exports = { install, FEATURES, featureFor, PICKUPS, BITES, T, MOUTH_R, CHEW };
