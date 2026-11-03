#!/usr/bin/env node
// Headless test + progression simulation for Mukbang Bang V2.
// Runs src/game.js with a fake platform (every 2D call swallowed), a fake HS
// wrapper and a fake profile, and plays levels through the real tap / drag /
// timer paths. Bot personas estimate HUMAN play time: game time that passes
// while the bot acts (holding food at the mouth, animations) + a per-persona
// think/reaction cost for every interaction. Bot wall-clock is never counted.
//   node tools/sim-test.mjs            → checks + 5-persona 30-level report
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readdirSync, statSync } from 'node:fs';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '..', 'mukbang-bang', 'src', 'x.js'));
const { Game } = require('./game.js');
const D = require('./data.js');
const L = require('./levels.js');
const K = require('./catalog.js');
const M = require('./mech.js');
const S = require('./sprites.js');

let fails = 0;
function check(name, ok, info) { if (ok) console.log('✅', name); else { fails++; console.log('❌', name, info === undefined ? '' : JSON.stringify(info).slice(0, 400)); } }
const flush = () => new Promise(r => setTimeout(r, 0));
// deterministic randomness for every test
function seed(s) { let x = s >>> 0; Math.random = function () { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── fakes ──
function fakeCtx() {
  const ctx = {};
  const noop = () => ctx;
  return new Proxy(ctx, { get(t, k) { if (k === 'measureText') return () => ({ width: 50 }); if (k === 'createLinearGradient') return () => ({ addColorStop() {} }); if (k === 'canvas') return { width: 390, height: 844 }; if (typeof k === 'symbol') return undefined; return (k in t) ? t[k] : noop; }, set(t, k, v) { t[k] = v; return true; } });
}
function fakePlatform() {
  let touch = null;
  return {
    ctx: fakeCtx(), canvas: { width: 390, height: 844 }, poll() {},
    width: () => 390, height: () => 844, dpr: () => 1, safeTop: () => 44, safeBottom: () => 20,
    onTouch: h => { touch = h; }, onResize() {}, vibrate() {},
    createAudioContext: () => null, createCanvas: () => ({ getContext: fakeCtx, width: 0, height: 0 }),
    touch: (k, id, x, y) => touch(k, id, x, y)
  };
}
function fakeProfile(init) {
  const data = Object.assign({}, init);
  return { get: k => data[k], set(k, v) { data[k] = v; }, add(k, v) { data[k] = (data[k] || 0) + v; }, update(o) { Object.assign(data, o); }, on() {}, data };
}
const REW = { level_bonus: { coins: 150 }, first_stream: { coins: 200 }, bonus_coins: { coins: 300 }, free_coins: { coins: 200 }, share: { coins: 100 }, tiktok_profile: { coins: 300 }, tiktok_shortcut: { coins: 300 } };
// adMode: 'ok' (ad plays and pays) · 'null' (no fill / closed early) · 'reject' (SDK error)
function fakeHs(profile, adMode) {
  const claims = [], ads = [];
  const ad = (place, reward) => { ads.push(place); if (adMode === 'reject') return Promise.reject(new Error('sdk')); if (adMode === 'null') return Promise.resolve(null); if (reward) profile.add('coins', reward.coins); return Promise.resolve(reward || {}); };
  return {
    profile, claims, ads,
    claimLevelBonus() { claims.push('level_bonus'); profile.add('coins', 150); return REW.level_bonus; },
    claimFirstStream() { claims.push('first_stream'); profile.add('coins', 200); return REW.first_stream; },
    rewardsLevelBonus: () => REW.level_bonus, rewardsBonusCoins: () => REW.bonus_coins, rewardsFreeCoins: () => REW.free_coins, rewardsShare: () => REW.share, rewardsProfile: () => REW.tiktok_profile, rewardsShortcut: () => REW.tiktok_shortcut,
    shareAvailable: () => true, item: id => ({ name: id === 'coins' ? 'Coins' : id }),
    hasMissions: () => true, hasShare: () => true, hasAds: () => true, hasShop: () => true,
    canShowStreamEnd: () => true, showStreamEnd() { return ad('stream_end', null); },
    canShowBonusCoins: () => true, showBonusCoins() { return ad('bonus_coins', REW.bonus_coins); },
    canShowFreeCoins: () => true, showFreeCoins() { return ad('free_coins', REW.free_coins); },
    profileMissionDone: () => false, shortcutMissionDone: () => false, startProfileMission() {}, startShortcutMission() {},
    canShare: () => true, share: () => Promise.resolve({}), shop: () => Promise.resolve([{ product_id: 1, name: 'Coin pouch', beans_cost: 10, items: { coins: 1000 } }]), buy: () => Promise.resolve({ ok: true, delivered: true }), on() {}
  };
}
const INIT = { level: 1, levels_done: 0, coins: 500, streamer: 0, stars_json: '{}', run_json: '', streams: 0, best_viewers: 0, combo_best: 0, no_ads: 0, sound: true };

// ── input helpers (logical coordinates; the fake screen is 390 px wide) ──
function run(g, seconds) { const steps = Math.round(seconds * 60); for (let i = 0; i < steps; i++) { g.lastT = g.lastT || 1000; g.frame(g.lastT + 1000 / 60); } }
function K390(g) { return 390 / g.W; }
function hasBtn(g, id) { run(g, 1 / 60); return !!g.ui.buttons.find(b => b.id === id); }
async function tap(g, p, id) { run(g, 1 / 60); const b = g.ui.buttons.find(b => b.id === id); if (!b) throw new Error('no button ' + id + ' in state ' + g.state + ' (have: ' + g.ui.buttons.map(b => b.id).join(',') + ')'); const k = K390(g), x = (b.x + b.w / 2) * k, y = (b.y + b.h / 2) * k; p.touch('start', 1, x, y); p.touch('end', 1, x, y); await flush(); run(g, 1 / 60); }
function touchAt(g, p, x, y) { const k = K390(g); p.touch('start', 3, x * k, y * k); run(g, 0.03); p.touch('end', 3, x * k, y * k); run(g, 0.03); }
function drag(g, p, x0, y0, x1, y1, hold) { const k = K390(g); p.touch('start', 2, x0 * k, y0 * k); run(g, 0.05); for (let i = 1; i <= 10; i++) { p.touch('move', 2, (x0 + (x1 - x0) * i / 10) * k, (y0 + (y1 - y0) * i / 10) * k); run(g, 0.02); } run(g, hold || 0); p.touch('end', 2, x1 * k, y1 * k); run(g, 0.05); }

// ── personas: how a human of this kind plays (seconds / probabilities) ──
const PERSONAS = {
  beginner: { think: 3.0, tapT: 1.0, dragT: 1.4, perfect: 0.15, req: 0.4, spiceCare: false, pause: [0.4, 3.4], toppings: 0, sides: 0, skipArrive: false, read: 3.5, adBonus: false },
  average:  { think: 2.0, tapT: 0.7, dragT: 1.0, perfect: 0.45, req: 0.75, spiceCare: true, pause: [0.2, 1.6], toppings: 1, sides: 1, skipArrive: false, read: 2.5, adBonus: false },
  skilled:  { think: 1.2, tapT: 0.5, dragT: 0.7, perfect: 0.9, req: 1.0, spiceCare: true, pause: [0.1, 0.6], toppings: 2, sides: 2, skipArrive: true, read: 1.5, adBonus: false },
  adUser:   { think: 2.0, tapT: 0.7, dragT: 1.0, perfect: 0.45, req: 0.75, spiceCare: true, pause: [0.2, 1.6], toppings: 1, sides: 1, skipArrive: false, read: 2.5, adBonus: true, adSec: 30 },
  noAds:    { think: 2.0, tapT: 0.7, dragT: 1.0, perfect: 0.45, req: 0.75, spiceCare: true, pause: [0.2, 1.6], toppings: 1, sides: 1, skipArrive: false, read: 2.5, adBonus: false, noAds: true }
};
function bot(name) { return Object.assign({ name: name, clock: 0, acts: 0, care: 0, ads: 0, minCoins: 1e9, at: {} }, PERSONAS[name]); }
// human time: game time that passes + interaction overhead
function wait(g, b, s) { run(g, s); b.clock += s; }
async function btap(g, p, b, id) { await tap(g, p, id); b.clock += b.tapT; b.acts++; }
function rnd(a, c) { return a + Math.random() * (c - a); }

// ── one level, any food source, through real inputs ──
async function playLevel(g, p, prof, b, opts) {
  opts = opts || {};
  if (g.state === 'result') await btap(g, p, b, 'home');
  if (g.state === 'home') await btap(g, p, b, 'play');
  const sc = g.state === 'stream' ? g.run.lv : g.state === 'market' ? g.market.lv : (g.state === 'delivery' || g.state === 'arrive') ? g.deliv.lv : g.state === 'buffet' ? g.buf.lv : g.state === 'kitchen' ? g.kit.lv : g.state === 'care' ? g.care.lv : null;
  const n = sc ? sc.n : g.curLevel();
  if (g.state === 'care') { b.care++; b.clock += b.think; await btap(g, p, b, 'care_take'); }
  const lv = L.level(n); b.minCoins = Math.min(b.minCoins, prof.get('coins'));
  if (g.state !== 'stream') b.clock += b.think; // look at the food source screen
  if (g.state === 'market') {
    const m = g.market; let cheap = 0; for (let i = 1; i < m.cats.length; i++) if (D.CAT_BY_ID[m.cats[i]].price < D.CAT_BY_ID[m.cats[cheap]].price) cheap = i;
    for (let i = 0; i < cheap; i++) await btap(g, p, b, 'cat_next');
    let guard = 0; while (m.basket.length < m.pick && guard++ < 20) await btap(g, p, b, 'item' + (m.basket.length % 6));
    if (!opts.quiet) check('L' + n + ' market: basket filled', m.basket.length === m.pick, m.basket);
    wait(g, b, 0.8); await btap(g, p, b, 'confirm');
    let t = 0; while (g.state === 'checkout' && t++ < 400) wait(g, b, 0.05);
  } else if (g.state === 'delivery') {
    const d = g.deliv; const mains = g.deliveryMains(); const rests = d.lv.delivery.rest;
    for (let i = 0; d.mains.length < d.lv.delivery.mains && i < 10; i++) { const f = mains[i % mains.length]; const ri = rests.indexOf(f.group); if (d.rest !== ri) await btap(g, p, b, 'drest' + ri); if (d.mains.indexOf(f.id) < 0) await btap(g, p, b, 'dmain_' + f.id); }
    const sideOrder = ['cola', 'pickled_radish', 'fries'];
    for (let i = 0; i < Math.min(b.sides, d.lv.delivery.sides); i++) { const id = sideOrder[i]; if (prof.get('coins') > g.deliveryTotal() + K.dish(id).price + 50) await btap(g, p, b, 'dside_' + id); }
    if (!opts.quiet) check('L' + n + ' delivery: mains picked', d.mains.length === d.lv.delivery.mains, d.mains);
    await btap(g, p, b, 'dorder');
    if (!opts.quiet) check('L' + n + ' delivery: order placed → arrive', g.state === 'arrive', g.state);
    if (b.skipArrive) { wait(g, b, 0.6); touchAt(g, p, g.W / 2, g.H / 2); b.acts++; } else wait(g, b, 2.6);
  } else if (g.state === 'buffet') {
    const bf = g.buffet || g.buf; const sts = bf.lv.buffet.stations;
    for (let i = 0; bf.plate.length < bf.lv.buffet.slots && i < 20; i++) {
      if (sts.length > 1 && i % 2 === 1) { const st = (bf.st + 1) % sts.length; await btap(g, p, b, 'bst' + st); }
      const r = g.panRect(i % 6); if (b.name === 'skilled' || i % 2) drag(g, p, r.x + r.w / 2, r.y + r.h / 2, g.plateGeo().x, g.plateGeo().y, 0); else touchAt(g, p, r.x + r.w / 2, r.y + r.h / 2);
      b.clock += b.dragT; b.acts++; wait(g, b, 0.2);
    }
    if (!opts.quiet) check('L' + n + ' buffet: plate filled', bf.plate.length === bf.lv.buffet.slots, bf.plate);
    await btap(g, p, b, 'bgo');
  } else if (g.state === 'kitchen') {
    const k = g.kit; for (let i = 0; i < Math.min(b.toppings, k.rec.toppings.length); i++) await btap(g, p, b, 'ktop_' + k.rec.toppings[i]);
    await btap(g, p, b, 'kgo');
    await cook(g, p, b);
    if (!opts.quiet) check('L' + n + ' kitchen: every prep step done', k.phase === 'done' || k.phase === 'gone' || g.state === 'stream', k.phase);
    let t = 0; while (g.state === 'kitchen' && t++ < 100) wait(g, b, 0.05);
  }
  if (!opts.quiet) check('L' + n + ' (' + lv.mode + '): stream starts', g.state === 'stream', g.state);
  await eatStream(g, p, b);
  wait(g, b, 2.4);
  if (!opts.quiet) check('L' + n + ': result shown', g.state === 'result' && g.result.lv.n === n, g.state);
  b.clock += b.read;
  const res = g.result;
  if (b.adBonus && hasBtn(g, 'bonus_ad')) { await btap(g, p, b, 'bonus_ad'); b.clock += b.adSec; b.ads++; }
  return res;
}
// prep steps through touches in the work area
async function cook(g, p, b) {
  const k = g.kit, kk = K390(g); let guard = 0;
  while (k.phase === 'cook' && guard++ < 20) {
    const st = g.curStep(), a = g.workArea();
    if (st.type === 'tap') { for (let i = 0; i < st.n && k.phase === 'cook'; i++) { touchAt(g, p, a.x + rnd(-60, 60), a.y + rnd(-40, 40)); b.clock += b.tapT * 0.6; b.acts++; } }
    else if (st.type === 'rub') { p.touch('start', 4, a.x * kk, a.y * kk); let x = a.x, dir = 1, gg = 0; while (k.phase === 'cook' && g.curStep() === st && gg++ < 400) { x += dir * 40; if (Math.abs(x - a.x) > 100) dir = -dir; p.touch('move', 4, x * kk, a.y * kk); wait(g, b, 0.016); } p.touch('end', 4, x * kk, a.y * kk); b.acts++; b.clock += b.dragT * 0.5; }
    else if (st.type === 'stir') { p.touch('start', 4, (a.x + 80) * kk, a.y * kk); let ang = 0, gg = 0; while (k.phase === 'cook' && g.curStep() === st && gg++ < 400) { ang += 0.25; p.touch('move', 4, (a.x + Math.cos(ang) * 80) * kk, (a.y + Math.sin(ang) * 80) * kk); wait(g, b, 0.016); } p.touch('end', 4, a.x * kk, a.y * kk); b.acts++; b.clock += b.dragT * 0.5; }
    else if (st.type === 'hold') { p.touch('start', 4, a.x * kk, a.y * kk); let gg = 0; while (k.phase === 'cook' && g.curStep() === st && gg++ < 400) wait(g, b, 0.05); p.touch('end', 4, a.x * kk, a.y * kk); b.acts++; b.clock += b.tapT; }
    else if (st.type === 'drop') { for (let i = 0; i < st.n && k.phase === 'cook'; i++) { const di = g.dropIcon(); drag(g, p, di.x, di.y, a.x, a.y, 0); b.clock += 0.25 + b.dragT; b.acts++; } }
    b.clock += b.think * 0.3; // read the next step
  }
}
// feed everything: open boxes / gifts, answer requests, manage spice
async function eatStream(g, p, b) {
  const r = g.run; let guard = 0;
  while (g.state === 'stream' && g.run && g.run.endT < 0 && guard++ < 200) {
    const items = g.run.items.filter(it => !it.done);
    const closed = items.find(it => (it.boxed || it.mystery) && !(it.open > 0));
    if (closed) { touchAt(g, p, closed.x, closed.y); b.acts++; b.clock += b.tapT; wait(g, b, 0.5); continue; }
    const ready = items.filter(it => !it.boxed && !it.mystery);
    if (!ready.length) { wait(g, b, 0.2); continue; }
    const mech = g.run.mech; let pick = ready[0];
    if (mech.req && Math.random() < b.req) { const hit = ready.find(it => K.dish(it.id).tags.indexOf(mech.req.tag) >= 0); if (hit) pick = hit; }
    else if (b.spiceCare && mech.spice > 70) { const cool = ready.find(it => { const d = K.dish(it.id); return d.tags.indexOf('drink') >= 0 || d.taste === 'cold'; }); if (cool) pick = cool; else { const mild = ready.find(it => K.dish(it.id).taste !== 'spicy'); if (mild) pick = mild; } }
    const m = g.mouth(), perfect = Math.random() < b.perfect, a = Math.random() * Math.PI * 2;
    const tx = m.x + (perfect ? 0 : Math.cos(a) * 62), ty = m.y + (perfect ? 0 : Math.sin(a) * 62);
    const d = K.dish(pick.id); const left = d.bites - pick.eaten;
    const t0 = g.time; drag(g, p, pick.x, pick.y, tx, ty, 0.3 + left * 0.72 + 0.2); b.clock += (g.time - t0) + b.dragT * 0.4; b.acts++;
    wait(g, b, rnd(b.pause[0], b.pause[1]));
  }
}

// ═════════ unit checks: mechanics (pure logic) ═════════
seed(1);
{
  const lv = L.level(6);
  const mk = (sid) => new M.Mech(lv, sid, Math.random);
  // combo builds, breaks after a gap, Momo keeps it longer after cold food
  let m = mk('luna'); const chips = K.dish('cat_chips'); for (let i = 0; i < 6; i++) { m.bite(chips, 70); m.update(0.7, []); }
  check('combo builds with consecutive bites', m.combo === 6, m.combo);
  let ev = m.update(3, []); check('combo resets after a 2.5 s gap', m.combo === 0 && ev.some(e => e.type === 'comboLost'), { c: m.combo, ev });
  const momo = mk('momo'); momo.bite(K.dish('mint_choc'), 70); momo.update(3.0, []); check('Momo: cold food keeps the combo for 3.5 s', momo.combo === 1);
  const luna2 = mk('luna'); luna2.bite(K.dish('mint_choc'), 70); luna2.update(3.0, []); check('others: combo gone after 3 s', luna2.combo === 0);
  // perfect + Luna bonus, Kiko sweet bonus
  const a = mk('luna').bite(chips, 10), b = mk('kiko').bite(chips, 10);
  check('perfect bite inside the inner mouth', a.perfect && !mk('luna').bite(chips, 70).perfect);
  check('Luna: perfect bites give +15% viewers', Math.abs(a.hypeMult / b.hypeMult - 1.15) < 1e-9, [a.hypeMult, b.hypeMult]);
  check('Kiko: sweet food +20% coins', mk('kiko').bite(K.dish('rainbow_candy'), 70).coinMult === 1.2 && mk('luna').bite(K.dish('rainbow_candy'), 70).coinMult === 1);
  // spice: fire, overflow is funny not fatal, drinks cool down
  m = mk('luna'); const ghost = K.dish('ghost_wings'); let hot = false, fire = false;
  for (let i = 0; i < 4; i++) { const r = m.bite(ghost, 70); if (r.events.some(e => e.type === 'tooHot')) hot = true; if (r.events.some(e => e.type === 'onFire')) fire = true; }
  check('spice: ON FIRE above 60', fire);
  check('spice overflow → TOO HOT, combo reset, meter back to 40, no fail', hot && m.combo <= 1 && m.spice <= 82, { combo: m.combo, spice: m.spice });
  const before = m.spice; m.bite(K.dish('cola'), 70); check('drinks cool the spice meter', m.spice < before - 30, [before, m.spice]);
  // fan requests: appear only for food on the table, time out, pay when matched
  m = mk('luna'); ev = m.update(lv.req.first + 0.1, ['spicy', 'crunchy']); const rq = ev.find(e => e.type === 'request');
  check('fan request appears for a tag on the table', rq && ['spicy', 'crunchy'].indexOf(rq.tag) >= 0, ev);
  ev = m.update(10.5, ['spicy', 'crunchy']); check('missed request times out without a penalty', ev.some(e => e.type === 'reqMissed') && m.reqMissed === 1);
  m.update(lv.req.every + 0.1, ['spicy']); const res = m.bite(K.dish('spicy_wings'), 70); const done = res.events.find(e => e.type === 'reqDone');
  check('answered request gives a viewer boost (8% of goal)', done && done.boost === Math.round(lv.goal * 0.08), done);
  check('no request when nothing on the table matches', mk('luna').newRequest([]) === null);
  // mystery: every outcome reachable, pity rule
  m = mk('luna'); const kinds = {}; let three = false; for (let i = 0; i < 3000; i++) { const o = m.mystery(['cat_chips']); kinds[o.kind] = (kinds[o.kind] || 0) + 1; if (!K.dish(o.id)) three = 'missing ' + o.id; }
  const h = m.mysteryHistory; for (let i = 2; i < h.length; i++) if (h[i] === 'delicious' && h[i - 1] === 'delicious' && h[i - 2] === 'delicious') three = true;
  check('mystery: all 5 outcomes occur', ['delicious', 'spicy', 'frozen', 'rare', 'funny'].every(k => kinds[k] > 0), kinds);
  check('mystery: never 3 "delicious" in a row, every result is a real dish', three === false, three);
  // challenge
  m = mk('luna'); let ch = false; for (let i = 0; i < 10; i++) if (m.bite(chips, 70).events.some(e => e.type === 'challenge')) ch = true;
  check('challenge (combo 10) completes once', ch && m.challengeDone);
}
// ═════════ data checks ═════════
{
  check('30 levels, 5 chapters of 6', L.LEVEL_COUNT === 30 && L.LEVELS.every((l, i) => l.chapter === Math.floor(i / 6) + 1));
  const first4 = L.LEVELS.slice(0, 4).map(l => l.mode);
  check('all four food sources open within levels 1–4 (L1 starts in the stream)', first4.join() === 'prestock,delivery,buffet,kitchen', first4);
  check('goals rise every level (800 → 1.5M)', L.LEVELS.every((l, i) => i === 0 || l.goal > L.LEVELS[i - 1].goal) && L.level(1).goal === 800 && L.level(30).goal === 1500000);
  check('buffet levels stream in the restaurant, the rest at home', L.LEVELS.every(l => (l.mode === 'buffet') === (l.loc === 'restaurant')));
  let bad = []; for (const l of L.LEVELS) { const ids = []; if (l.prestock) ids.push(...l.prestock); if (l.kitchen) ids.push(...(l.kitchen.extras || [])); if (l.delivery) for (const r of l.delivery.rest) if (!K.restaurant(r)) bad.push(r); if (l.buffet) for (const s of l.buffet.stations) if (!K.station(s)) bad.push(s); if (l.kitchen && !K.RECIPE_BY_ID[l.kitchen.recipe]) bad.push(l.kitchen.recipe); for (const id of ids) if (!K.dish(id)) bad.push(id); }
  check('every level references real dishes / restaurants / stations / recipes', !bad.length, bad);
  const delivIds = Object.keys(K.DISHES).filter(k => K.DISHES[k].src === 'delivery'); check('delivery catalog is separate from the supermarket (16 dishes, none shared)', delivIds.length === 16 && delivIds.every(id => !D.FOOD_BY_ID[id]), delivIds.length);
  const stepTypes = new Set(); K.RECIPES.forEach(r => r.steps.forEach(s => stepTypes.add(s.type))); check('DIY uses all five prep step types', ['rub', 'tap', 'stir', 'hold', 'drop'].every(t => stepTypes.has(t)), [...stepTypes]);
  check('every dish is eatable (bites, taste, tags)', Object.values(K.DISHES).every(d => d.bites >= 2 && D.TASTES[d.taste] && d.tags.length));
}

// ═════════ flow checks ═════════
seed(2);
{ // first session starts inside the L1 stream; L1 → L2 delivery; ad-free first chapter
  const p = fakePlatform(), prof = fakeProfile(INIT), hs = fakeHs(prof, 'ok'); const g = new Game(p, hs); g.hsReady = true; run(g, 0.2);
  check('new player starts inside the level 1 livestream', g.state === 'stream' && g.run.level === 1 && g.run.items.length === 3, g.state);
  check('the first interaction is available at once (food on the table, no menus)', g.run.items.every(it => !it.boxed && !it.mystery));
  const b = bot('average'); await playLevel(g, p, prof, b);
  check('first_stream + level_bonus claimed', hs.claims.join(',') === 'level_bonus,first_stream', hs.claims);
  check('level 1 earns coins with free food', g.result.coins > 0 && prof.get('coins') > 500, prof.get('coins'));
  await tap(g, p, 'next'); check('NEXT → level 2 food delivery', g.state === 'delivery' && g.deliv.lv.n === 2, g.state);
  check('no interstitial in chapter 1', hs.ads.indexOf('stream_end') < 0);
  await playLevel(g, p, prof, b); check('delivery boxes were opened and eaten', g.result.lv.n === 2);
  for (let n = 3; n <= 7; n++) { await tap(g, p, 'next'); await playLevel(g, p, prof, b, { quiet: n !== 3 && n !== 4 }); }
  check('no interstitial through level 6', hs.ads.filter(a => a === 'stream_end').length === 0, hs.ads);
  check('level_bonus once per level', hs.claims.filter(c => c === 'level_bonus').length === 7, hs.claims);
  // replay: no second level bonus
  await tap(g, p, 'replay'); check('REPLAY after level 7 shows the interstitial (tap-triggered)', hs.ads.filter(a => a === 'stream_end').length === 1, hs.ads); check('REPLAY reopens the same level', (g.kit && g.kit.lv.n === 7) || g.state === 'care', g.state);
  await playLevel(g, p, prof, b, { quiet: true }); check('replay pays no second level bonus', hs.claims.filter(c => c === 'level_bonus').length === 7, hs.claims);
  await tap(g, p, 'next'); check('NEXT after level 7 shows the next interstitial', hs.ads.filter(a => a === 'stream_end').length === 2, hs.ads);
  await playLevel(g, p, prof, b, { quiet: true });
  // No Ads
  prof.set('no_ads', 1); const adsBefore = hs.ads.length; await tap(g, p, 'next'); check('No Ads: NEXT shows no interstitial', hs.ads.length === adsBefore, hs.ads);
}
seed(3);
{ // ad callbacks that fail never block progression; the bonus button comes back
  for (const mode of ['null', 'reject']) {
    const p = fakePlatform(), prof = fakeProfile(Object.assign({}, INIT, { level: 7, levels_done: 6, streams: 6, coins: 3000 })), hs = fakeHs(prof, mode); const g = new Game(p, hs); g.hsReady = true; run(g, 0.1);
    const b = bot('average'); await playLevel(g, p, prof, b, { quiet: true });
    const c0 = prof.get('coins'); await tap(g, p, 'bonus_ad'); run(g, 0.1);
    check('ad ' + mode + ': no reward added, bonus button available again', prof.get('coins') === c0 && hasBtn(g, 'bonus_ad'));
    await tap(g, p, 'next'); check('ad ' + mode + ': NEXT still goes on to the next level', g.state !== 'result' && (g.deliv ? g.deliv.lv.n === 8 : true), g.state);
  }
}
seed(4);
{ // low coins → free fan gift, never a softlock
  const p = fakePlatform(), prof = fakeProfile(Object.assign({}, INIT, { level: 8, levels_done: 7, streams: 7, coins: 20 })), hs = fakeHs(prof, 'ok'); const g = new Game(p, hs); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'play'); check('cannot afford level 8 → fan gift popup', g.state === 'care', g.state);
  await tap(g, p, 'care_take'); check('fan gift starts a free stream', g.state === 'stream' && g.run.cost === 0);
  const b = bot('average'); await eatStream(g, p, b); run(g, 2.5);
  check('fan gift stream pays coins and clears the level', g.state === 'result' && prof.get('coins') > 20 && prof.get('levels_done') === 8, prof.get('coins'));
}
seed(8);
{ // encore rounds: a later level keeps going with new food after the first table is cleared
  const p = fakePlatform(), prof = fakeProfile(Object.assign({}, INIT, { level: 13, levels_done: 12, streams: 12, coins: 5000 })), hs = fakeHs(prof, 'ok'); const g = new Game(p, hs); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'play'); g.sceneAutoFill(); for (let i = 0; i < 60 && g.state !== 'stream'; i++) run(g, 0.1);
  const lv = g.run.lv; check('level 13 has ' + lv.rounds.length + ' extra rounds queued', g.run.queue.length === lv.rounds.length && lv.rounds.length >= 3);
  const b = bot('skilled'); let seen = 0; const saveRound = () => { seen = Math.max(seen, g.run ? g.run.round : seen); };
  for (let k = 0; k < 6 && g.state === 'stream'; k++) { const before = g.run.round; const ready = g.run.items.filter(it => !it.done); for (const it of ready) { if (it.boxed || it.mystery) { touchAt(g, p, it.x, it.y); run(g, 0.6); } const m = g.mouth(); drag(g, p, it.x, it.y, m.x, m.y, 0.3 + K.dish(it.id).bites * 0.72); saveRound(); if (!g.run) break; } run(g, 1.2); saveRound(); }
  check('every round was played before the stream ended', seen === lv.rounds.length, { seen, rounds: lv.rounds.length });
  run(g, 3); check('…then the result', g.state === 'result', g.state);
}
seed(5);
{ // stream resume (v2: delivery boxes + partial bites; v1 legacy json)
  const p = fakePlatform(), prof = fakeProfile(Object.assign({}, INIT, { level: 2, levels_done: 1, streams: 1, coins: 2000 })), hs = fakeHs(prof, 'ok'); const g = new Game(p, hs); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'play'); g.sceneAutoFill(); run(g, 3);
  check('delivery food arrives boxed', g.state === 'stream' && g.run.items.every(it => it.boxed));
  const it = g.run.items[0]; touchAt(g, p, it.x, it.y); run(g, 0.6); const m = g.mouth(); drag(g, p, it.x, it.y, m.x, m.y, 0.3 + 0.72 * 2);
  const saved = JSON.parse(prof.get('run_json'));
  check('run_json v2 keeps mode, bites, closed boxes and queued rounds', saved.v === 2 && saved.mode === 'delivery' && saved.items[0].eaten >= 2 && saved.items.slice(1).every(x => x.boxed) && saved.queue.length === L.level(2).rounds.length, saved);
  const g2 = new Game(fakePlatform(), hs); g2.hsReady = true; run(g2, 0.1);
  check('restart → RESUME restores the same stream', g2.run && g2.run.mode === 'delivery' && g2.run.items[0].eaten === saved.items[0].eaten && g2.run.cpb === saved.cpb && JSON.stringify(g2.run.queue) === JSON.stringify(saved.queue), g2.run && g2.run.items);
  const legacy = fakeProfile(Object.assign({}, INIT, { level: 3, streams: 2, run_json: JSON.stringify({ level: 3, items: [{ id: 'chili_noodle', eaten: 1, done: false }, { id: 'soda_pop', eaten: 0, done: false }], viewers: 3000, peak: 3200, coins: 50, ms: 3 }) }));
  const g3 = new Game(fakePlatform(), fakeHs(legacy, 'ok')); g3.hsReady = true; run(g3, 0.1);
  check('a V1 run_json (supermarket) still resumes', g3.run && g3.run.items.length === 2 && g3.run.items[0].eaten === 1 && g3.run.ms === 0, g3.run && g3.run.items);
  await tap(g3, g3.p, 'play'); check('…and plays to the end', g3.state === 'stream'); await eatStream(g3, g3.p, bot('skilled')); run(g3, 2.5); check('legacy run finishes', g3.state === 'result');
}
seed(6);
{ // mystery box in the stream: tap to open → real dish; spicy outcome timer; rare is gold
  const p = fakePlatform(), prof = fakeProfile(Object.assign({}, INIT, { level: 5, levels_done: 4, streams: 4, coins: 3000 })), hs = fakeHs(prof, 'ok'); const g = new Game(p, hs); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'play'); g.sceneAutoFill(); for (let i = 0; i < 60 && g.state !== 'stream'; i++) run(g, 0.1);
  const box = g.run.items.find(x => x.mystery); check('level 5 puts a mystery box on the table', !!box);
  touchAt(g, p, box.x, box.y); run(g, 0.6); check('tapping the box reveals a real dish', !box.mystery && !!K.dish(box.id) && !!box.kind, box);
  const outs = {}; for (let i = 0; i < 40; i++) { const fake = { id: 'mystery', mystery: true, eaten: 0, x: 100, y: 600 }; g.run.items.push(fake); g.finishOpen(fake); outs[fake.kind] = (outs[fake.kind] || 0) + 1; if (fake.kind === 'spicy' && !(fake.challengeT > 0)) outs.badSpicy = 1; if (fake.kind === 'rare' && !fake.gold) outs.badRare = 1; g.run.items.pop(); }
  check('stream mystery: spicy has an 8 s challenge, rare is golden', !outs.badSpicy && !outs.badRare, outs);
}
seed(7);
{ // packaging + art
  let bytes = 0; (function walk(d) { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p); else bytes += statSync(p).size; } })(join(here, '..', 'mukbang-bang'));
  check('TikTok main package ≤ 4 MB (' + (bytes / 1048576).toFixed(2) + ' MB)', bytes <= 4 * 1024 * 1024);
  const gameDir = join(here, '..', 'mukbang-bang'); const missing = [];
  for (const d of Object.values(K.DISHES)) if (d.art !== false) for (let i = 0; i < d.bites; i++) if (!existsSync(join(gameDir, 'assets', S.foodPath(d.sprite || d.id, i)))) missing.push(S.foodPath(d.sprite || d.id, i));
  check('every dish marked art:true has all its frames on disk', !missing.length, missing.slice(0, 5));
  const p = fakePlatform(); const asked = [], miss2 = [];
  p.loadImage = (path, done) => { asked.push(path); if (!existsSync(join(gameDir, path))) { miss2.push(path); done(null); } else done({ width: 256, height: 256 }); };
  const prof = fakeProfile(INIT), g = new Game(p, fakeHs(prof, 'ok')); g.hsReady = true; run(g, 0.2);
  await eatStream(g, p, bot('skilled')); run(g, 2.5);
  check('sprite path: level 1 plays with bitmap art, nothing missing requested', g.state === 'result' && asked.length > 10 && !miss2.length, miss2);
  const hh = g.headPos(), mm = g.mouth(); check('sprite path: mouth sits below the head centre', mm.y > hh.y && mm.y - hh.y < 60);
}

// ═════════ progression simulation: 5 personas × 30 levels ═════════
const MARKS = [3, 6, 12, 18, 24, 30];
const report = [];
for (const name of Object.keys(PERSONAS)) {
  seed(100 + name.length);
  const prof = fakeProfile(INIT); if (PERSONAS[name].noAds) prof.set('no_ads', 1);
  const p = fakePlatform(), hs = fakeHs(prof, 'ok'), g = new Game(p, hs); g.hsReady = true; run(g, 0.1);
  const b = bot(name); let stars = 0, blocked = '';
  const lvTimes = [];
  for (let n = 1; n <= 30; n++) {
    const t0 = b.clock;
    try { const res = await playLevel(g, p, prof, b, { quiet: true }); stars += res.stars; if (res.lv.n !== n) blocked = 'L' + n + ' played L' + res.lv.n; } catch (e) { blocked = 'L' + n + ': ' + e.message; break; }
    lvTimes.push(b.clock - t0);
    if (MARKS.indexOf(n) >= 0) b.at[n] = b.clock;
    if (n < 30) { const adsBefore = hs.ads.filter(a => a === 'stream_end').length; await btap(g, p, b, 'next'); if (hs.ads.filter(a => a === 'stream_end').length > adsBefore) { b.clock += 5; b.ads++; } }
    b.minCoins = Math.min(b.minCoins, prof.get('coins'));
  }
  report.push({ name, b, stars, blocked, coins: prof.get('coins'), lvTimes, interstitials: hs.ads.filter(a => a === 'stream_end').length, rewarded: hs.ads.filter(a => a !== 'stream_end').length });
  check(name + ': completes all 30 levels without a blocker', !blocked && prof.get('levels_done') === 30, blocked || prof.get('levels_done'));
}
const fmt = s => { const m = Math.floor(s / 60), r = Math.round(s % 60); return m + "'" + (r < 10 ? '0' : '') + r + '"'; };
console.log('\n── Progression simulation (estimated HUMAN time = game time while acting + per-persona think/tap costs) ──');
console.log('persona    ' + MARKS.map(n => ('L' + n).padStart(8)).join('') + '   taps/drags  stars  min coins  end coins  fan gifts  interst.  rewarded');
for (const r of report) console.log(r.name.padEnd(10) + ' ' + MARKS.map(n => (r.b.at[n] ? fmt(r.b.at[n]) : '—').padStart(8)).join('') + String(r.b.acts).padStart(13) + String(r.stars).padStart(7) + String(r.b.minCoins).padStart(11) + String(r.coins).padStart(11) + String(r.b.care).padStart(11) + String(r.interstitials).padStart(10) + String(r.rewarded).padStart(10));
const avg = report.find(r => r.name === 'average');
console.log('average: seconds per level (incl. food source + result): ' + avg.lvTimes.map(t => Math.round(t)).join(' '));
console.log('design targets (GAME-DESIGN-V2 §6.3, owner accepted ~44′ and longer): L6 ≈ 6′ · L12 ≈ 14′ · L18 ≈ 22′ · L24 ≈ 32′ · L30 ≈ 44′');

console.log(fails ? ('\n' + fails + ' FAILED') : '\nall passed');
process.exit(fails ? 1 : 0);
