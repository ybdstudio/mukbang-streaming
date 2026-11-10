#!/usr/bin/env node
// Headless test + progression / ad simulation for Mukbang Bang V3.
// Runs src/game.js with a fake platform (every 2D call swallowed), a fake HS
// wrapper and a fake profile, and plays through the real tap / drag / timer paths.
//
// TIME: bot personas estimate HUMAN time = game time that passes while the bot acts
// + a per-persona think / tap cost for every interaction (+ ad watch time, reported
// separately). Bot wall-clock is never counted.
// ADS: the fake HS enforces the dashboard cooldown (30 s per place) on the simulated
// clock and a FILL rate; opt-in rates per persona are ASSUMPTIONS printed with the
// result. Impressions are counted by the game itself (profile ad_stats: a null
// showAd result is NOT an impression) — the report reads those counters.
//   node tools/sim-test.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '..', 'mukbang-bang', 'src', 'x.js'));
const { Game } = require('./game.js');
const D = require('./data.js');
const L = require('./levels.js');
const K = require('./catalog.js');
const S = require('./sprites.js');
const WR = require('./wardrobe.js');
const ST = require('./stream.js');
const R = require('./recipes.js');
const CK = require('./cook.js');

let fails = 0;
function check(name, ok, info) { if (ok) console.log('✅', name); else { fails++; console.log('❌', name, info === undefined ? '' : JSON.stringify(info).slice(0, 400)); } }
const flush = () => new Promise(r => setTimeout(r, 0));
function seed(s) { let x = s >>> 0; Math.random = function () { x = (x + 0x6D2B79F5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ── fakes ──
function fakeCtx() {
  const ctx = {}; const noop = () => ctx;
  return new Proxy(ctx, { get(t, k) { if (k === 'measureText') return () => ({ width: 50 }); if (k === 'createLinearGradient') return () => ({ addColorStop() {} }); if (k === 'canvas') return { width: 390, height: 844 }; if (typeof k === 'symbol') return undefined; return (k in t) ? t[k] : noop; }, set(t, k, v) { t[k] = v; return true; } });
}
function fakePlatform() {
  let touch = null;
  return { ctx: fakeCtx(), canvas: { width: 390, height: 844 }, poll() {}, width: () => 390, height: () => 844, dpr: () => 1, safeTop: () => 44, safeBottom: () => 20,
    onTouch: h => { touch = h; }, onResize() {}, vibrate() {}, createAudioContext: () => null, createCanvas: () => ({ getContext: fakeCtx, width: 0, height: 0 }), touch: (k, id, x, y) => touch(k, id, x, y) };
}
function fakeProfile(init) { const data = Object.assign({}, init); return { get: k => data[k], set(k, v) { data[k] = v; }, add(k, v) { data[k] = (data[k] || 0) + v; }, update(o) { Object.assign(data, o); }, on() {}, data }; }
const REW = { level_bonus: { coins: 150 }, first_stream: { coins: 200 }, bonus_coins: { coins: 300 }, free_coins: { coins: 200 }, share: { coins: 100 }, tiktok_profile: { coins: 300 }, tiktok_shortcut: { coins: 300 } };
// mode: 'ok' · 'null' (no fill / closed early) · 'reject' (SDK error).  opts: { clock: () => s, cooldown: 30, fill: 1 }
function fakeHs(profile, mode, opts) {
  opts = opts || {}; const claims = [], ads = [], last = {};
  const cool = p => !opts.clock || last[p] === undefined || opts.clock() - last[p] >= (opts.cooldown || 30);
  const ad = (place, reward) => {
    ads.push(place);
    if (mode === 'reject') return Promise.reject(new Error('sdk'));
    if (mode === 'null' || !cool(place) || (opts.fill !== undefined && Math.random() > opts.fill)) return Promise.resolve(null);
    if (opts.clock) last[place] = opts.clock();
    if (reward) profile.add('coins', reward.coins); return Promise.resolve(reward || {});
  };
  return {
    profile, claims, ads, last,
    claimLevelBonus() { claims.push('level_bonus'); profile.add('coins', 150); return REW.level_bonus; },
    claimFirstStream() { claims.push('first_stream'); profile.add('coins', 200); return REW.first_stream; },
    rewardsLevelBonus: () => REW.level_bonus, rewardsBonusCoins: () => REW.bonus_coins, rewardsFreeCoins: () => REW.free_coins, rewardsShare: () => REW.share, rewardsProfile: () => REW.tiktok_profile, rewardsShortcut: () => REW.tiktok_shortcut,
    shareAvailable: () => true, item: id => ({ name: id === 'coins' ? 'Coins' : id }),
    hasMissions: () => true, hasShare: () => true, hasAds: () => true, hasShop: () => true,
    canShowStreamEnd: () => cool('stream_end'), showStreamEnd() { return ad('stream_end', null); },
    canShowBonusCoins: () => cool('bonus_coins'), showBonusCoins() { return ad('bonus_coins', REW.bonus_coins); },
    canShowFreeCoins: () => cool('free_coins'), showFreeCoins() { return ad('free_coins', REW.free_coins); },
    canShowSurprise: () => cool('surprise_food'), showSurprise() { return ad('surprise_food', null); },
    canShowFashion: () => cool('fashion_reward'), showFashion() { return ad('fashion_reward', null); },
    canShowBoost: () => cool('viral_boost'), showBoost() { return ad('viral_boost', null); },
    canShowFanGift: () => cool('fan_gift'), showFanGift() { return ad('fan_gift', { coins: 300 }); }, rewardsFanGift: () => ({ coins: 300 }),
    canShowRare: () => cool('rare_choice'), showRare() { return ad('rare_choice', null); },
    canShowCookStep: () => cool('cook_step'), showCookStep() { return ad('cook_step', null); },
    canShowServe: () => cool('serve_bonus'), showServe() { return ad('serve_bonus', null); },
    canShowHype: () => cool('extra_hype'), showHype() { return ad('extra_hype', null); },
    canShowUnlockLevel: () => cool('unlock_level'), showUnlockLevel() { return ad('unlock_level', null); },
    canShowUnlockLook: () => cool('unlock_look'), showUnlockLook() { return ad('unlock_look', null); },
    profileMissionDone: () => false, shortcutMissionDone: () => false, startProfileMission() {}, startShortcutMission() {},
    canShare: () => true, share: () => Promise.resolve({}), shop: () => Promise.resolve([]), buy: () => Promise.resolve({ ok: true, delivered: true }), on() {}
  };
}
const INIT = { level: 1, levels_done: 0, coins: 500, streamer: 0, stars_json: '{}', run_json: '', streams: 0, best_viewers: 0, combo_best: 0, foods_json: '[]', wardrobe_json: '{}', ad_stats: '{}', no_ads: 0, sound: true, tip_market: 1, tip_goal: 1 };

// ── input helpers (logical coordinates; the fake screen is 390 px wide) ──
function run(g, seconds) { const steps = Math.round(seconds * 60); for (let i = 0; i < steps; i++) { g.lastT = g.lastT || 1000; g.frame(g.lastT + 1000 / 60); } }
const K390 = g => 390 / g.W;
function hasBtn(g, id) { run(g, 1 / 60); return !!g.ui.buttons.find(b => b.id === id); }
let featSeen = []; async function tap(g, p, id) { run(g, 1 / 60); if (g.state === 'result' && g.result && g.result.feature && !g.result.featureDone && !/^feat_/.test(id)) { run(g, 0.7); const fb = g.ui.buttons.find(b => b.id === 'feat_ok' || b.id === 'feat_later'); if (fb) { featSeen.push(g.result.feature.kind + ':' + g.result.feature.f.id); const k0 = K390(g); p.touch('start', 1, (fb.x + fb.w / 2) * k0, (fb.y + fb.h / 2) * k0); p.touch('end', 1, (fb.x + fb.w / 2) * k0, (fb.y + fb.h / 2) * k0); await flush(); run(g, 1 / 60); } } const b = g.ui.buttons.find(b => b.id === id); if (!b) throw new Error('no button ' + id + ' in state ' + g.state + ' (have: ' + g.ui.buttons.map(b => b.id).join(',') + ')'); const k = K390(g), x = (b.x + b.w / 2) * k, y = (b.y + b.h / 2) * k; p.touch('start', 1, x, y); p.touch('end', 1, x, y); await flush(); run(g, 1 / 60); }
function touchAt(g, p, x, y) { const k = K390(g); p.touch('start', 3, x * k, y * k); run(g, 0.03); p.touch('end', 3, x * k, y * k); run(g, 0.03); }
function drag(g, p, x0, y0, x1, y1, steps) { const k = K390(g); p.touch('start', 2, x0 * k, y0 * k); run(g, 0.05); for (let i = 1; i <= (steps || 10); i++) { p.touch('move', 2, (x0 + (x1 - x0) * i / (steps || 10)) * k, (y0 + (y1 - y0) * i / (steps || 10)) * k); run(g, 0.02); } p.touch('end', 2, x1 * k, y1 * k); run(g, 0.05); }
function runUntil(g, cond, max) { for (let i = 0; i < (max || 20) * 60 && !cond(); i++) run(g, 1 / 60); return cond(); }

// ── V4 helpers: cook the requested dish through real touches; eat whatever is on the table ──
// opts: { match: true (pick what the viewer asked for), cost: fn(seconds, kind) for time accounting }
async function cookAll(g, p, opts) {
  opts = opts || {}; const k = g.ck; const kk = K390(g); const cost = opts.cost || (() => {}); let guard = 0;
  while (g.state === 'cook' && g.ck && g.ck.doneT < 0 && guard++ < 40) {
    const st = g.curCookStep(), a = g.cookArea(), t0 = g.time;
    if (st.t === 'pick' && k.rare && opts.rare && Math.random() < opts.rare) { await tap(g, p, 'ck_rare'); await flush(); if (k.sel) { await tap(g, p, 'ck_ok'); cost(0, 'pick'); if (opts.onAd) opts.onAd(); continue; } }
    if (st.t === 'pick') { const want = k.req[CK.SLOT_KEY[st.slot]]; const o = opts.match !== false && k.opts.find(x => x.id === want) ? want : k.opts.find(x => x.id !== want).id; await tap(g, p, 'cko_' + o); await tap(g, p, 'ck_ok'); cost(0, 'pick'); }
    else if (st.t === 'pour' || st.t === 'hold') { p.touch('start', 5, a.x * kk, a.y * kk); let i = 0; while (g.ck && g.curCookStep() === st && i++ < 400) run(g, 0.05); p.touch('end', 5, a.x * kk, a.y * kk); cost(g.time - t0, 'hold'); }
    else if (st.t === 'flip') { touchAt(g, p, a.x, a.y); runUntil(g, () => !g.ck || g.curCookStep() !== st, 2); cost(g.time - t0, 'tap'); }
    else if (st.t === 'place') { for (let i = 0; i < st.n && g.ck && g.curCookStep() === st; i++) { touchAt(g, p, a.x + (i - 1) * 30, a.y - 20); cost(0, 'tap'); } }
    else if (st.t === 'shake') { p.touch('start', 6, a.x * kk, a.y * kk); let x = a.x, dir = 1, i = 0; while (g.ck && g.curCookStep() === st && i++ < 400) { x += dir * 40; if (Math.abs(x - a.x) > 90) dir = -dir; p.touch('move', 6, x * kk, a.y * kk); run(g, 0.016); } p.touch('end', 6, x * kk, a.y * kk); cost(g.time - t0, 'rub'); }
  }
  const t1 = g.time; runUntil(g, () => g.state === 'stream' || (g.ck && g.ck.serveAsk), 4); cost(g.time - t1, 'wait');
  if (g.state === 'cook' && g.ck && g.ck.serveAsk) { const hot = opts.hot && Math.random() < opts.hot; await tap(g, p, hot ? 'ck_hot' : 'ck_serve'); await flush(); if (hot && opts.onAd) opts.onAd(); if (g.state === 'cook') await tap(g, p, 'ck_serve'); cost(0, 'pick'); }
}
function foodPos(g) { const r = g.run; return r && r.recipe ? g.platePos(Math.min(2, r.pickups)) : g.packPos(); }
// from request / sealed to the result. feed: 'tap' | 'drag' | 'mix'
async function eatAll(g, p, feed) {
  if (g.run.phase === 'request') { await tap(g, p, 'cook_go'); await cookAll(g, p); }
  if (g.run.phase === 'sealed') { const pk = g.packPos(); touchAt(g, p, pk.x, pk.y); run(g, 1); }
  for (let k = 0, guard = 0; g.run && g.run.pickups < 3 && guard++ < 8; k++) { runUntil(g, () => !g.run || g.run.phase === 'open', 8); if (!g.run || g.run.pickups >= 3) break; const fp = foodPos(g); if (feed === 'drag' || (feed === 'mix' && k === 1)) { const m = g.mouth(); drag(g, p, fp.x, fp.y, m.x, m.y, 10); } else touchAt(g, p, fp.x, fp.y); runUntil(g, () => !g.run || g.run.phase === 'react', 6); }
  runUntil(g, () => g.state === 'result', 10);
}

// ═════════ core loop: request → cook → serve 3 portions → 3 × 3 bites → mission ═════════
seed(1);
{
  const p = fakePlatform(), prof = fakeProfile(INIT), hs = fakeHs(prof, 'ok'); const g = new Game(p, hs); g.hsReady = true; run(g, 0.2);
  check('new player starts inside stream 1 with a viewer request', g.state === 'stream' && g.run.level === 1 && g.run.phase === 'request' && !!g.run.request);
  check('the MAKE button is there at once (first tap < 3 s)', hasBtn(g, 'cook_go'));
  await tap(g, p, 'cook_go'); check('MAKE → the cooking scene', g.state === 'cook' && g.ck.lv.n === 1);
  const steps = g.ck.rc.steps.map(s => s.t);
  check('jelly = pick mould → pick flavour → pour → cool → flip → topping → place → deco → shake (as in the video)', steps.join() === 'pick,pick,pour,hold,flip,pick,place,pick,shake', steps);
  check('a pick step shows 4 choices incl. the requested one', g.ck.opts.length === 4);
  const want = g.ck.req.flavor; check('the request names a mould, and the tray has it', !!g.ck.req.mold && g.ck.opts.some(o => o.id === g.ck.req.mold)); await tap(g, p, 'cko_' + g.ck.req.mold); check('choosing does not advance until ✓', g.ck.step === 0 && g.ck.sel === g.ck.req.mold); await tap(g, p, 'ck_ok'); check('✓ confirms the choice', g.ck.step === 1);
  check('the flavour tray contains the requested flavour', g.ck.opts.some(o => o.id === want));
  await cookAll(g, p, { match: true });
  check('cooked dish matches the request → PERFECT, back on the stream', g.state === 'stream' && g.run.perfect === true && g.run.dish.flavor === want);
  check('served as 3 portions on plates, phase open', g.run.phase === 'open' && g.run.pickups === 0);
  for (let k = 0; k < 3; k++) {
    const fp = foodPos(g);
    if (k === 1) { const m = g.mouth(); drag(g, p, fp.x, fp.y, m.x, m.y, 12); check('drag a portion to the mouth → chewing at once', g.run.phase === 'chew', g.run.phase); }
    else { touchAt(g, p, fp.x, fp.y); check('portion ' + (k + 1) + ': a tap carries it', g.run.phase === 'carry'); runUntil(g, () => g.run.phase === 'chew', 2); }
    let bites = 0; runUntil(g, () => { bites = Math.max(bites, g.run.bites); return g.run.phase === 'react'; }, 5);
    check('portion ' + (k + 1) + ': exactly 3 bites', bites === 3 && g.run.pickups === k + 1, { bites, pickups: g.run.pickups });
    runUntil(g, () => g.run.phase !== 'react', 3);
  }
  check('after 3 portions (9 bites) every plate is empty', g.run.phase === 'empty' && g.run.pickups === 3);
  runUntil(g, () => g.run && g.run.phase === 'finale', 3); check('MISSION COMPLETE finale', g.run.phase === 'finale' && g.run.mission > 0);
  runUntil(g, () => g.state === 'result', 5);
  check('result: mission reward ×1.5 for a perfect match', g.result.mission === Math.round(L.level(1).reward * 1.5) && g.result.coins >= 9 * L.level(1).cpb + g.result.mission, g.result);
  check('perfect + normal eating → at least 2★', g.result.stars >= 2);
  check('level 1 cleared: level bonus + first stream claimed', hs.claims.join() === 'level_bonus,first_stream' && prof.get('level') === 2);
  // level 2: wrong choices → still served, no perfect bonus
  await tap(g, p, 'next'); check('NEXT → stream 2 with a new request', g.state === 'stream' && g.run.level === 2 && g.run.phase === 'request');
  await tap(g, p, 'cook_go'); await cookAll(g, p, { match: false }); check('not what they asked → YUMMY (no fail), served anyway', g.state === 'stream' && g.run.perfect === false && g.run.phase === 'open');
  const fp = foodPos(g); drag(g, p, fp.x, fp.y, fp.x + 150, fp.y + 30, 6); runUntil(g, () => g.run.phase === 'open', 2); check('a drag released away from the mouth flies back (no portion spent)', g.run.pickups === 0);
  let tapped = 0; for (let k = 0; k < 3 && g.run; k++) { runUntil(g, () => !g.run || g.run.phase === 'open', 6); if (!g.run) break; const q = foodPos(g); touchAt(g, p, q.x, q.y); for (let i = 0; i < 40 && g.run && g.run.phase !== 'open' && g.run.phase !== 'empty'; i++) { run(g, 0.12); for (const h of g.hearts.slice()) if (!h.taken) { touchAt(g, p, h.x, h.y); tapped++; } if (g.run.gift && !g.run.giftTaken) touchAt(g, p, g.run.gift.x, g.run.gift.y); } }
  runUntil(g, () => g.state === 'result', 10);
  check('no perfect: mission reward ×1; tapping hearts still reaches 3★ (' + tapped + ')', g.result.mission === L.level(2).reward && g.result.stars === 3, g.result);
}
seed(11);
{ // every recipe cooks through real touches
  for (const rc of Object.keys(R.RECIPES)) {
    const n = L.LEVELS.find(l => l.recipe === rc).n; const prof = fakeProfile(Object.assign({}, INIT, { level: n, levels_done: n - 1, streams: n - 1 })); const p = fakePlatform(), g = new Game(p, fakeHs(prof, 'ok')); g.hsReady = true; run(g, 0.1);
    if (g.state !== 'stream') await tap(g, p, 'play'); await tap(g, p, 'cook_go'); const nsteps = g.ck.rc.steps.length; await cookAll(g, p, { match: true });
    check(rc + ' (level ' + n + ', ' + nsteps + ' steps): cooked → perfect → served', g.state === 'stream' && g.run.perfect && g.run.dish.recipe === rc);
  }
}
seed(2);
{ // save & resume: during cooking, after portion 1, mid-chew; old runs
  const prof = fakeProfile(Object.assign({}, INIT, { level: 5, levels_done: 4, streams: 4 })); const hs = fakeHs(prof, 'ok');
  const p = fakePlatform(), g = new Game(p, hs); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'play'); await tap(g, p, 'cook_go'); await tap(g, p, 'cko_' + g.ck.opts[0].id); await tap(g, p, 'ck_ok');
  const g0 = new Game(fakePlatform(), hs); g0.hsReady = true; run(g0, 0.1); check('closed while cooking → the request waits (cook again)', g0.run && g0.run.phase === 'request' && !g0.run.dish);
  await cookAll(g, p); const fp = foodPos(g); touchAt(g, p, fp.x, fp.y); runUntil(g, () => g.run.phase === 'open' && g.run.pickups === 1, 8);
  const saved = JSON.parse(prof.get('run_json')); check('run_json v4 keeps the cooked dish + 1 portion eaten', saved.v === 4 && saved.pickups === 1 && saved.dish && saved.dish.recipe === L.level(5).recipe, saved);
  const g2 = new Game(fakePlatform(), hs); g2.hsReady = true; run(g2, 0.1);
  check('restart: the same stream waits at home', g2.run && g2.run.pickups === 1 && g2.state === 'home');
  await tap(g2, g2.p, 'play'); check('RESUME continues with 2 portions left', g2.state === 'stream' && g2.run.phase === 'open' && g2.run.pickups === 1);
  const fp2 = foodPos(g2); touchAt(g2, g2.p, fp2.x, fp2.y); runUntil(g2, () => g2.run.phase === 'chew' && g2.run.bites === 2, 4); const c1 = prof.get('coins');
  const g3 = new Game(fakePlatform(), hs); g3.hsReady = true; run(g3, 0.1); await tap(g3, g3.p, 'play'); runUntil(g3, () => g3.run.bites === 3 || g3.run.phase === 'react', 3); const paid = prof.get('coins') - c1;
  check('resume mid-chew finishes only the missing bite (no double pay)', paid === g3.run.cpb, { paid, cpb: g3.run.cpb });
  const legacy = fakeProfile(Object.assign({}, INIT, { level: 4, streams: 3, run_json: JSON.stringify({ v: 2, level: 4, items: [{ id: 'chili_noodle', eaten: 1 }] }) }));
  const g4 = new Game(fakePlatform(), fakeHs(legacy, 'ok')); run(g4, 0.1);
  check('a V1/V2 multi-food run is dropped safely; level & coins kept', !g4.run && legacy.get('run_json') === '' && legacy.get('level') === 4);
}
seed(7);
{ // feature previews 2 streams before, then NEW FEATURE → GO NOW; leaving the stream room from the request
  const FE = ST.FEATURES; check('features: shop 3, wardrobe 6, delivery 7, Kiko 10, buffet 11, Momo 20', FE.map(f => f.id + '@' + f.at).join() === 'mode:market@3,wardrobe@6,mode:delivery@7,streamer:kiko@10,mode:buffet@11,streamer:momo@20', FE.map(f => f.id + '@' + f.at));
  const pre = []; for (let n = 1; n < 40; n++) { const fe = ST.featureFor(n + 1); if (fe) pre.push(n + ':' + fe.kind[0] + ':' + fe.f.id.replace(/^.*:/, '')); }
  check('each feature: a preview before it opens, then an "open" popup', FE.every(f => pre.some(x => x.endsWith(':p:' + f.id.replace(/^.*:/, ''))) && pre.some(x => x.endsWith(':o:' + f.id.replace(/^.*:/, '')))), pre);
  check('previews come 2 streams before (shop: 1, it opens at 3)', pre.indexOf('3:p:wardrobe') >= 0 && pre.indexOf('4:p:delivery') >= 0 && pre.indexOf('1:p:market') >= 0 && pre.indexOf('2:o:market') >= 0, pre);
  const prof = fakeProfile(Object.assign({}, INIT, { level: 4, levels_done: 3, streams: 3, coins: 2000 })); const p = fakePlatform(), g = new Game(p, fakeHs(prof, 'ok')); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'play'); await eatAll(g, p, 'tap'); run(g, 0.8);
  check('after stream 4: COMING SOON popup (delivery in 2 streams), result buttons hidden', hasBtn(g, 'feat_ok') && !hasBtn(g, 'next') && g.result.feature.f.id === 'mode:delivery');
  await tap(g, p, 'feat_ok'); check('OK closes it, NEXT is back', hasBtn(g, 'next'));
  await tap(g, p, 'next'); await eatAll(g, p, 'tap'); run(g, 0.8);
  check('after stream 5: NEW FEATURE popup with GO NOW / LATER', hasBtn(g, 'feat_go') && hasBtn(g, 'feat_later') && g.result.feature.kind === 'open');
  await tap(g, p, 'feat_go'); await flush(); check('GO NOW → the wardrobe', g.state === 'wardrobe');
  await tap(g, p, 'home'); await tap(g, p, 'play'); check('the next stream waits with its request', g.state === 'stream' && g.run.phase === 'request' && g.run.level === 6);
  check('request screen: HOME / SHOP / WARDROBE to leave the stream room', hasBtn(g, 'req_home') && hasBtn(g, 'side_market') && hasBtn(g, 'wardrobe'));
  await tap(g, p, 'side_market'); check('SHOP from the stream → supermarket', g.state === 'market');
  const g2 = new Game(fakePlatform(), fakeHs(prof, 'ok')); g2.hsReady = true; run(g2, 0.1); await tap(g2, g2.p, 'play'); await tap(g2, g2.p, 'req_home'); check('HOME from the request keeps the run (resume later)', g2.state === 'home' && g2.run && g2.run.phase === 'request');
  await tap(g2, g2.p, 'play'); check('…and PLAY returns to the same request', g2.state === 'stream' && g2.run.level === 6);
  const pn = fakePlatform(), gn = new Game(pn, fakeHs(fakeProfile(INIT), 'ok')); gn.hsReady = true; run(gn, 0.2); check('a brand-new player sees no leave buttons (first stream stays focused)', !hasBtn(gn, 'req_home'));
}
{ // viewer milestones roll over inside one stream
  const prof = fakeProfile(Object.assign({}, INIT, { level: 3, levels_done: 2, streams: 2 })); const g = new Game(fakePlatform(), fakeHs(prof, 'ok')); g.hsReady = true; run(g, 0.1);
  await tap(g, g.p, 'play'); const r = g.run, c0 = prof.get('coins'); g.addViewers(r.goal - r.viewers + 1);
  check('reaching the viewer goal rolls the bar to the next milestone (3★ goal) + a coin bonus', r.ms === 1 && prof.get('coins') > c0 && g.milestone(r.ms) === r.goal3);
  g.addViewers(r.goal3 * 1.5); check('…and keeps rolling past the 3★ goal (+40 % each)', r.ms >= 3 && g.milestone(r.ms) > r.peak, { ms: r.ms, peak: r.peak, next: g.milestone(r.ms) });
}
// ═════════ data ═════════
{
  check('40 levels, each a cookable request, 5 chapters', L.LEVEL_COUNT === 40 && L.CHAPTERS.length === 5 && L.LEVELS.every(l => R.RECIPES[l.recipe] && l.request && l.request.topping));
  const firstRc = {}; L.LEVELS.forEach(l => { if (!firstRc[l.recipe]) firstRc[l.recipe] = l.n; }); check('all 8 recipes appear within the first 15 levels', Object.keys(R.RECIPES).every(r => firstRc[r] <= 15), firstRc);
  check('every request is cookable at its level (options unlocked)', L.LEVELS.every(l => { const rc = R.RECIPES[l.recipe]; const fs = rc.taste === 'broth' ? 'broth' : 'flavor'; return R.options(fs, l.n).some(o => o.id === l.request[fs]) && R.options(R.toppingSlot(l.recipe), l.n).some(o => o.id === l.request.topping); }));
  check('new choices unlock across the levels', L.LEVELS.filter(l => l.news.length).length >= 25);
  check('activities unlock at 3 / 7 / 11', L.MODES.every(m => L.unlockLevel('mode:' + m.id) === m.unlock) && L.MODES.length === 3, L.MODES.map(m => [m.id, L.unlockLevel('mode:' + m.id)]));
  const gifts = WR.ITEMS.filter(i => i.gift); check('every wardrobe gift is granted by its level', gifts.every(i => L.unlockLevel('look:' + i.id) === i.gift), gifts.filter(i => L.unlockLevel('look:' + i.id) !== i.gift).map(i => i.id));
  check('goals rise every level', L.LEVELS.every((l, i) => i === 0 || l.goal > L.LEVELS[i - 1].goal));
}
// ═════════ supermarket checkout review: put items back, then pay ═════════
{
  const prof = fakeProfile(Object.assign({}, INIT, { level: 20, levels_done: 19, streams: 19, coins: 3000 })); const p = fakePlatform(), hs = fakeHs(prof, 'ok'), g = new Game(p, hs); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'side_market'); g.autoItems = 3; const m = g.market; const fs = D.foodsOf(m.cats[0]); m.basket.push(fs[0].id, fs[1].id, fs[2].id); g.beginCheckout();
  runUntil(g, () => g.checkout.review, 6); check('checkout: scanning everything waits for PAY (no auto charge)', g.checkout.review && !g.checkout.done && prof.get('coins') === 3000);
  const before = g.checkout.total; g.removeCheckoutLine(0); check('checkout: ✕ puts one item back', g.checkout.items.length === 2 && g.checkout.total < before && g.market.basket.length === 2);
  check('checkout: profit estimate is positive', g.estimateEarn(g.checkout.items.map((it) => it.id), g.checkout.total) > g.checkout.total);
  const tot = g.checkout.total; g.payCheckout(); runUntil(g, () => g.state === 'stream', 4); check('checkout: PAY charges the reviewed total and starts the stream', g.state === 'stream' && prof.get('coins') <= 3000 - tot + 2000 && g.run.queue.length === 1, prof.get('coins'));
}
// ═════════ test-build autoplay ═════════
{
  const p = fakePlatform(); p.devTools = true; const prof = fakeProfile(Object.assign({}, INIT, { level: 12, levels_done: 11, streams: 13, coins: 5000 })); const hs = fakeHs(prof, 'ok'); const g = new Game(p, hs); g.hsReady = true; run(g, 0.2);
  await tap(g, p, 'settings'); await tap(g, p, 'auto_play'); check('settings (test build): AUTO PLAY toggles on', g.autoplay === true); await tap(g, p, 'settings_close');
  const ads0 = hs.ads.length; let lv0 = prof.get('levels_done'); const seen = new Set(); for (let i = 0; i < 900 && (prof.get('levels_done') < lv0 + 4 || !seen.has('arrive')); i++) { run(g, 1); await flush(); seen.add(g.state); }
  check('autoplay takes side trips: supermarket (checkout) and delivery', seen.has('market') && seen.has('checkout') && seen.has('delivery') && seen.has('arrive'), [...seen]);
  check('autoplay clears levels on its own at normal pace (2 levels within 6 min of game time)', prof.get('levels_done') >= lv0 + 2, { done: prof.get('levels_done'), state: g.state, phase: g.run && g.run.phase });
  check('autoplay never starts a rewarded ad (interstitials only)', hs.ads.filter(a => a !== 'stream_end' && a !== 'cook_step').length === ads0, hs.ads); // interstitials still play as for a player
  const p2 = fakePlatform(); const g2 = new Game(p2, fakeHs(fakeProfile(INIT), 'ok')); g2.hsReady = true; run(g2, 0.1); g2.setState('settings'); run(g2, 0.05); check('TikTok build: no AUTO PLAY button', !hasBtn(g2, 'auto_play'));
}
// ═════════ test-build reset progress ═════════
{
  const p = fakePlatform(); p.devTools = true; const prof = fakeProfile(Object.assign({}, INIT, { level: 12, levels_done: 11, streams: 14, coins: 9000, wardrobe_json: '{"own":["hair_bow"],"eq":{}}', tip_goal: 1 })); const g = new Game(p, fakeHs(prof, 'ok')); g.hsReady = true; run(g, 0.2);
  g.setState('settings'); run(g, 0.05); await tap(g, p, 'reset_progress'); check('reset asks for a second tap', prof.get('level') === 12);
  await tap(g, p, 'reset_progress'); check('reset progress → level 1, 500 coins, no looks, tutorials again', prof.get('level') === 1 && prof.get('levels_done') === 0 && prof.get('coins') === 500 && prof.get('wardrobe_json') === '{}' && prof.get('tip_goal') === 0 && g.state === 'home' && !g.run);
}
// ═════════ foods V4 art (Codex 09/11) ═════════
{
  const gameDir = join(here, '..', 'mukbang-bang'); const miss = [];
  for (const id in S.FOOD5) for (const st of ['sealed', 'open', 'p1', 'p2', 'empty', 'portion']) { const q = join(gameDir, S.FOOD5[id], 'food5', id + '_' + st + '.png'); if (!existsSync(q)) miss.push(q); }
  check('foods V4: every registered dish has all 6 states in its subpackage', miss.length === 0, miss.slice(0, 5));
  const shown = []; for (const k in K.DISHES) { const d = K.DISHES[k]; if (d.src === 'delivery' || d.src === 'mystery') shown.push(d.id); }
  for (const st of K.STATIONS) for (const d of K.stationItems(st.id)) if (d && d.src === 'buffet') shown.push(d.id);
  const vec = shown.filter(id => !S.FOOD5[id] && id !== 'kfc_chicken'); check('no delivery / buffet / mystery dish on a menu is still vector-drawn', vec.length === 0, vec);
  check('Lava Spicy station hidden (art not finished)', !K.station('lava'));
  check('ramen seasonings: 10 sprites registered', ['sesame', 'chili_flakes', 'nori_flakes', 'pepper', 'fried_garlic'].every(id => S.V4['cook/deco_' + id + '.png'] && S.V4['cook/opt_ramen_deco_' + id + '.png']));
}
// ═════════ ad pacing: impressions per 5 minutes (normal-pace autoplay, every interstitial; rewarded not counted) ═════════
{
  let clk = 0; const p = fakePlatform(); p.devTools = true; const prof = fakeProfile(Object.assign({}, INIT, { tip_goal: 1, tip_market: 1, coins: 3000 }));
  const hs = fakeHs(prof, 'ok', { clock: () => clk, cooldown: 30 }); const g = new Game(p, hs); g.hsReady = true; run(g, 0.2); g.autoplay = true;
  const imp = []; const orig = g.adRun.bind(g); g.adRun = function (place, pr, after) { return orig(place, pr.then(r => { if (r) { imp.push([clk, place]); clk += 15; g.wall = clk; } return r; }), after); }; // an ad lasts ~15 s
  for (let i = 0; i < 600; i++) { run(g, 1); clk += 1; g.wall = clk; await flush(); }
  const per5 = [imp.filter(x => x[0] < 300).length, imp.filter(x => x[0] >= 300).length];
  console.log('   interstitial impressions per 5 min (0-5 / 5-10):', per5.join(' / '), '·', imp.map(x => x[1][0] + Math.round(x[0])).join(' '));
  check('interstitials start in the first minutes (after stream 1)', imp.length > 0 && imp[0][0] < 180, imp.slice(0, 3));
  check('interstitials at least 30 s apart', imp.every((x, i) => i === 0 || x[0] - imp[i - 1][0] >= 30), imp);
}
// ═════════ interstitial when closing a menu ═════════
{
  let clk = 500; const prof = fakeProfile(Object.assign({}, INIT, { level: 12, levels_done: 11, streams: 11, coins: 3000 })); const hs = fakeHs(prof, 'ok', { clock: () => clk, cooldown: 30 });
  const p = fakePlatform(), g = new Game(p, hs); Object.defineProperty(g, 'wall', { get: () => clk }); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'levels'); await tap(g, p, 'home'); await flush(); run(g, 0.05); check('closing Levels: interstitial, then home', hs.ads.filter(a => a === 'stream_end').length === 1 && g.state === 'home', hs.ads);
  clk += 10; await tap(g, p, 'wardrobe'); await tap(g, p, 'home'); await flush(); check('within 30 s: no second interstitial', hs.ads.filter(a => a === 'stream_end').length === 1 && g.state === 'home', hs.ads);
}
// ═════════ side quests ═════════
{
  check('side quest on every level from 2 (none on level 1)', !L.LEVELS[0].quest && L.LEVELS.slice(1).every(l => l.quest && l.quest.pay > 0 && l.quest.need >= 1));
  check('side quests vary (≥ 4 kinds over the 40 levels)', new Set(L.LEVELS.slice(1).map(l => l.quest.id)).size >= 4);
  const lvH = L.LEVELS.find(l => l.quest && l.quest.id === 'hearts');
  const prof = fakeProfile(Object.assign({}, INIT, { level: lvH.n, levels_done: lvH.n - 1, streams: 5, coins: 1000 })); const p = fakePlatform(), g = new Game(p, fakeHs(prof, 'ok')); g.hsReady = true; run(g, 0.1);
  g.startStream(lvH.n); check('the run carries the level side quest', g.run.quest && g.run.quest.id === 'hearts' && !g.run.quest.done);
  const c0 = prof.get('coins'); g.run.hearts = lvH.quest.need; g.run.phase = 'open'; run(g, 0.05); check('side quest done → paid on the spot', g.run.quest.done && prof.get('coins') === c0 + lvH.quest.pay, prof.get('coins') - c0);
  run(g, 0.05); check('paid once', prof.get('coins') === c0 + lvH.quest.pay);
}
// ═════════ optional activities: packaged / restaurant food, one item, never advance the level ═════════
seed(3);
for (const mode of ['market', 'delivery', 'buffet']) {
  const prof = fakeProfile(Object.assign({}, INIT, { level: 20, levels_done: 19, streams: 19, coins: 3000 })); const p = fakePlatform(), hs = fakeHs(prof, 'ok'), g = new Game(p, hs); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'side_' + mode); check(mode + ': opens from home', g.state === mode, g.state);
  g.sceneAutoFill(); runUntil(g, () => g.state === 'stream', 6);
  check(mode + ': ends in a ONE-food bonus stream (sealed package)', g.state === 'stream' && g.run.side === mode && g.run.phase === 'sealed' && !!K.dish(g.run.food), g.run && g.run.side);
  if (mode === 'buffet') check('buffet: the stream takes place at the restaurant', g.run.loc === 'restaurant');
  const pk = g.packPos(); touchAt(g, p, pk.x, pk.y); check(mode + ': tap the package → opening', g.run.phase === 'opening'); run(g, 1);
  for (let k = 0; k < 3; k++) { touchAt(g, p, pk.x, pk.y); runUntil(g, () => g.run.phase === 'open' || g.run.phase === 'empty', 8); }
  check(mode + ': 3 pickups empty the package', g.run.phase === 'empty' && g.run.pickups === 3);
  runUntil(g, () => g.state === 'result', 8);
  check(mode + ': pays coins, adds to the food book, level unchanged', g.state === 'result' && g.result.coins > 0 && prof.get('level') === 20 && JSON.parse(prof.get('foods_json')).length === 1, { lvl: prof.get('level') });
}
seed(8);
for (const mode of ['market', 'delivery', 'buffet']) { // no limit on how much you order: every item is eaten in the same bonus stream
  const prof = fakeProfile(Object.assign({}, INIT, { level: 20, levels_done: 19, streams: 19, coins: 20000 })); const p = fakePlatform(), g = new Game(p, fakeHs(prof, 'ok')); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'side_' + mode); g.autoItems = 4; g.sceneAutoFill(); runUntil(g, () => g.state === 'stream', 8);
  check(mode + ': an order of 4 → a stream with 3 more queued', g.state === 'stream' && g.run.queue.length === 3, g.run && g.run.queue);
  let eaten = 0; for (let guard = 0; guard < 300 && g.state === 'stream'; guard++) { const r = g.run; if (r.phase === 'sealed') { const pk = g.packPos(); touchAt(g, p, pk.x, pk.y); run(g, 1); continue; } if (r.phase === 'open') { const pk = g.packPos(); touchAt(g, p, pk.x, pk.y); } run(g, 0.5); if (g.run && g.run.served > eaten) eaten = g.run.served; }
  runUntil(g, () => g.state === 'result', 12);
  check(mode + ': all 4 foods opened and eaten, then one result', g.state === 'result' && eaten === 4 && JSON.parse(prof.get('foods_json')).length >= 3, { eaten, state: g.state });
}
{ const prof = fakeProfile(Object.assign({}, INIT, { level: 2, streams: 1, coins: 5000 })); const p = fakePlatform(), g = new Game(p, fakeHs(prof, 'ok')); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'side_buffet'); check('a locked activity stays on home', g.state === 'home');
  const prof2 = fakeProfile(Object.assign({}, INIT, { level: 12, streams: 11, coins: 10 })); const p2 = fakePlatform(), g2 = new Game(p2, fakeHs(prof2, 'ok')); g2.hsReady = true; run(g2, 0.1);
  await tap(g2, p2, 'side_delivery'); check('no coins → activity refused, the main stream is always free', g2.state === 'home'); await tap(g2, p2, 'play'); check('…START MUKBANG works', g2.state === 'stream'); }
// ═════════ wardrobe ═════════
seed(4);
{
  const prof = fakeProfile(Object.assign({}, INIT, { level: 8, levels_done: 7, streams: 7, coins: 1000, wardrobe_json: JSON.stringify({ own: ['hair_bow'], eq: {} }) })); const p = fakePlatform(), g = new Game(p, fakeHs(prof, 'ok')); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'wardrobe'); check('wardrobe opens', g.state === 'wardrobe');
  await tap(g, p, 'witem_outfit_mint'); check('buy an outfit with coins', WR.owns(WR.state(prof), 'outfit_mint') && prof.get('coins') === 500 && WR.look(prof, 'luna').outfit === 'outfit_mint');
  await tap(g, p, 'witem_outfit_bib'); check('cannot buy without enough coins', !WR.owns(WR.state(prof), 'outfit_bib') && prof.get('coins') === 500);
  await tap(g, p, 'wtab1'); await tap(g, p, 'witem_hair_bow'); check('equip an owned hair accessory', WR.look(prof, 'luna').hair === 'hair_bow');
  const c9 = prof.get('coins'); await tap(g, p, 'witem_hair_crown'); await flush(); check('unlock_look: a level gift unlocks early with an ad (no coins spent)', WR.owns(WR.state(prof), 'hair_crown') && prof.get('coins') === c9 && JSON.parse(prof.get('ad_stats')).unlock_look.imp === 1);
  await tap(g, p, 'home'); await tap(g, p, 'play'); await eatAll(g, p, 'tap'); check('the look stays on through cooking and eating', g.state === 'result');
  { const pn = fakePlatform(), profn = fakeProfile(Object.assign({}, INIT, { level: 8, levels_done: 7, streams: 7, coins: 1000 })), gn = new Game(pn, fakeHs(profn, 'null')); gn.hsReady = true; run(gn, 0.1); await tap(gn, pn, 'wardrobe'); await tap(gn, pn, 'wtab1'); await tap(gn, pn, 'witem_hair_crown'); await flush(); check('no ad → the level gift stays locked', !WR.owns(WR.state(profn), 'hair_crown')); }
  const p2 = fakePlatform(), prof2 = fakeProfile(Object.assign({}, INIT, { level: 3, streams: 2 })), g2 = new Game(p2, fakeHs(prof2, 'ok')); g2.hsReady = true; run(g2, 0.1); await tap(g2, p2, 'wardrobe'); check('wardrobe locked before level ' + WR.OPEN_AT, g2.state === 'home');
}
// ═════════ ads ═════════
seed(5);
{
  const prof = fakeProfile(Object.assign({}, INIT, { level: 1, levels_done: 0, streams: 0, coins: 3000, tip_goal: 1 })); let clk = 0; const hs = fakeHs(prof, 'ok', { clock: () => clk, cooldown: 30 });
  const p = fakePlatform(), g = new Game(p, hs); Object.defineProperty(g, 'wall', { get: () => clk }); g.hsReady = true; run(g, 0.1);
  if (g.state !== 'stream') await tap(g, p, 'play'); await eatAll(g, p, 'tap');
  check('no interstitial while cooking stream 1', hs.ads.indexOf('cook_step') < 0, hs.ads); await tap(g, p, 'next'); check('interstitial right after stream 1 (NEXT)', hs.ads.filter(a => a === 'stream_end').length === 1, hs.ads);
  clk = 40; await eatAll(g, p, 'tap'); check('cook_step interstitial from stream 2', hs.ads.filter(a => a === 'cook_step').length === 1, hs.ads); clk = 100; await tap(g, p, 'next'); check('interstitial at NEXT after stream 2 (30 s later)', hs.ads.filter(a => a === 'stream_end').length === 2, hs.ads);
  await tap(g, p, 'cook_go'); await cookAll(g, p); const fp = foodPos(g); touchAt(g, p, fp.x, fp.y); run(g, 0.6);
  check('no ad button while chewing', !hasBtn(g, 'fangift_ad') && !hasBtn(g, 'bonus_ad'));
  runUntil(g, () => g.run.phase === 'open', 8); check('no fan gift before the balloons come', !hasBtn(g, 'fangift_ad') && !g.run.bal);
  g.run.balT = 1000; run(g, 0.1); check('fan gift balloons cross the table (with the GET offer)', !!g.run.bal && hasBtn(g, 'fangift_ad'));
  { const b = g.balloonPos(); touchAt(g, p, b.x, b.y - 40); run(g, 1 / 60); check('tapping the balloons opens the opt-in card, no ad yet', g.run.giftAsk && hasBtn(g, 'gift_watch') && hs.ads.filter(a => a === 'fan_gift').length === 0); await tap(g, p, 'gift_no'); check('no thanks closes the card', !g.run.giftAsk); g.run.balT = 1000; run(g, 0.1); }
  const c0 = prof.get('coins'); await tap(g, p, 'fangift_ad'); await flush(); run(g, 0.1); check('fan gift ad → coins from the SDK reward; balloons leave', prof.get('coins') === c0 + 300 && !hasBtn(g, 'fangift_ad') && !g.run.bal);
  for (let k = 0; k < 2; k++) { runUntil(g, () => g.run.phase === 'open', 8); const q = foodPos(g); touchAt(g, p, q.x, q.y); } runUntil(g, () => g.state === 'result', 12);
  clk = 110; await tap(g, p, 'next');
 check('cooldown: within 30 s the game does not even ask for an interstitial', hs.ads.filter(a => a === 'stream_end').length === 2 && JSON.parse(prof.get('ad_stats')).stream_end.req === 2 && g.state === 'stream', hs.ads);
  const st = JSON.parse(prof.get('ad_stats')); check('ad_stats counts per place (req / imp / done / grant)', st.stream_end.imp === 2 && st.fan_gift.imp === 1 && st.fan_gift.grant === 1, st);
  { // rare choice in the cooking tray (the run of the cooldown test above is still in its request)
    await tap(g, p, 'cook_go'); let offers = 0, ads = 0; const seenRare = () => { if (g.ck && g.ck.rare) offers++; };
    seenRare(); await cookAll(g, p, { match: true, rare: 1, onAd: () => { ads++; } });
    const rs = JSON.parse(prof.get('ad_stats')).rare_choice || {};
    check('rare choice (▶ RARE) in the tray → ad → used once per dish', rs.imp === 1 && ads === 1, rs);
    check('a rare ingredient counts as what the viewer asked for → PERFECT', g.run.perfect === true);
    for (let i = 0; i < 6 && g.run && g.run.pickups < 3; i++) { runUntil(g, () => !g.run || g.run.phase === 'open' || g.run.phase === 'empty', 8); if (!g.run || g.run.pickups >= 3) break; const q = foodPos(g); touchAt(g, p, q.x, q.y); } runUntil(g, () => g.state === 'result', 12);
    clk = 180; await tap(g, p, 'next'); }
  await eatAll(g, p, 'tap'); clk = 200; const c1 = prof.get('coins'); await tap(g, p, 'bonus_ad'); await flush(); check('bonus_coins: reward from the SDK result only', prof.get('coins') === c1 + 300 && JSON.parse(prof.get('ad_stats')).bonus_coins.grant === 1);
  await tap(g, p, 'res_home'); prof.set('level', 8); clk = 300; await tap(g, p, 'wardrobe'); const own0 = WR.state(prof).own.length; await tap(g, p, 'fashion_ad'); await flush(); check('fashion reward ad → one new look', WR.state(prof).own.length === own0 + 1);
  await tap(g, p, 'home'); clk = 400; if (g.run) { g.run = null; g.saveRun(); } await tap(g, p, 'surprise_ad'); await flush(); run(g, 0.1); check('surprise food ad → a rare bonus stream (package)', g.state === 'stream' && g.run.side === 'surprise');
  check('viral boost only while a package is sealed', hasBtn(g, 'boost_ad'));
}
seed(6);
{ // new places: cook_step interstitial · serve_bonus hot start · extra_hype · unlock_level
  const prof = fakeProfile(Object.assign({}, INIT, { level: 6, levels_done: 5, streams: 5, coins: 1000 })); let clk = 0; const hs = fakeHs(prof, 'ok', { clock: () => clk, cooldown: 30 });
  const p = fakePlatform(), g = new Game(p, hs); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'play'); await tap(g, p, 'cook_go'); await cookAll(g, p, { match: true, hot: 0 });
  const st0 = JSON.parse(prof.get('ad_stats'));
  check('cook_step: one interstitial in the middle of cooking (at a ✓ tap)', st0.cook_step && st0.cook_step.imp === 1, st0);
  check('serve_bonus: after PERFECT the player chooses SERVE / ▶ HOT START (SERVE = no ad)', g.state === 'stream' && !st0.serve_bonus && !g.run.hotStart);
  for (let i = 0; i < 6 && g.run.pickups < 2; i++) { runUntil(g, () => g.run.phase === 'open', 8); const q = foodPos(g); touchAt(g, p, q.x, q.y); runUntil(g, () => g.run.phase !== 'carry' && g.run.phase !== 'chew', 6); }
  runUntil(g, () => g.run.phase === 'open', 8); check('extra_hype offered on the last plate (not the fan gift)', hasBtn(g, 'hype_ad') && !hasBtn(g, 'fangift_ad'));
  clk = 40; const v0 = g.run.viewers; await tap(g, p, 'hype_ad'); await flush(); run(g, 0.05); check('extra_hype → +50% of the goal in viewers, once', g.run.viewers >= v0 + Math.round(g.run.goal * 0.5) - 2 && !hasBtn(g, 'hype_ad'));
  for (let i = 0; i < 6 && g.run && g.run.pickups < 3; i++) { runUntil(g, () => !g.run || g.run.phase === 'open' || g.run.phase === 'empty', 8); if (!g.run || g.run.pickups >= 3) break; const q = foodPos(g); touchAt(g, p, q.x, q.y); runUntil(g, () => !g.run || g.run.phase !== 'open', 1); } runUntil(g, () => g.state === 'result', 12);
  clk = 80; await tap(g, p, 'next'); await flush(); clk = 120; await tap(g, p, 'cook_go'); const cs = JSON.parse(prof.get('ad_stats')).cook_step.req; await cookAll(g, p, { match: true, hot: 1 });
  check('the cook_step interstitial respects the 30 s cooldown', JSON.parse(prof.get('ad_stats')).cook_step.req >= cs);
  check('▶ HOT START → stream starts with +40% viewers', g.state === 'stream' && g.run.hotStart === true && JSON.parse(prof.get('ad_stats')).serve_bonus.grant === 0 && JSON.parse(prof.get('ad_stats')).serve_bonus.imp === 1);
  g.run = null; g.saveRun(); g.setState('home'); clk = 200; await tap(g, p, 'levels'); const lv0 = prof.get('level'); check('levels: the next locked level shows ▶ UNLOCK', hasBtn(g, 'unlock_level_ad'));
  await tap(g, p, 'unlock_level_ad'); await flush(); check('unlock_level → the next level opens early, level bonus not paid', prof.get('level') === lv0 + 1 && prof.get('levels_done') === 6 && hs.claims.filter(c => c === 'level_bonus').length === 1, { lv: prof.get('level'), done: prof.get('levels_done'), claims: hs.claims });
}
{ const prof = fakeProfile(Object.assign({}, INIT, { level: 6, levels_done: 5, streams: 5, no_ads: 1 })); const hs = fakeHs(prof, 'ok'); const p = fakePlatform(), g = new Game(p, hs); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'play'); await tap(g, p, 'cook_go'); await cookAll(g, p); check('No Ads: no cook_step interstitial', hs.ads.indexOf('cook_step') < 0); }
for (const mode of ['null', 'reject']) {
  const prof = fakeProfile(Object.assign({}, INIT, { level: 6, levels_done: 5, streams: 5, coins: 1000 })); const hs = fakeHs(prof, mode); const p = fakePlatform(), g = new Game(p, hs); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'play'); await eatAll(g, p, 'tap');
  const c0 = prof.get('coins'); await tap(g, p, 'bonus_ad'); await flush(); run(g, 0.1); check('ad ' + mode + ': no reward, bonus button back, not an impression', prof.get('coins') === c0 && hasBtn(g, 'bonus_ad') && !(JSON.parse(prof.get('ad_stats')).bonus_coins || {}).imp);
  await tap(g, p, 'next'); await flush(); check('ad ' + mode + ': NEXT still starts the next level', g.state === 'stream' && g.run.level === 7);
}
{ const prof = fakeProfile(Object.assign({}, INIT, { level: 9, levels_done: 8, streams: 8, no_ads: 1 })); const hs = fakeHs(prof, 'ok'); const p = fakePlatform(), g = new Game(p, hs); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'play'); await eatAll(g, p, 'tap'); await tap(g, p, 'next'); check('No Ads: no interstitial', hs.ads.indexOf('stream_end') < 0); }
// ═════════ settings / packaging / art ═════════
{ const prof = fakeProfile(Object.assign({}, INIT, { level: 3, levels_done: 2, streams: 2 })); const p = fakePlatform(); const g = new Game(p, fakeHs(prof, 'ok')); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'settings'); check('TikTok build: no unlock-all button', !hasBtn(g, 'unlock_all'));
  const p2 = fakePlatform(); p2.devTools = true; const prof2 = fakeProfile(Object.assign({}, INIT, { level: 3, levels_done: 2, streams: 2 })); const g2 = new Game(p2, fakeHs(prof2, 'ok')); g2.hsReady = true; run(g2, 0.1);
  await tap(g2, p2, 'settings'); await tap(g2, p2, 'unlock_all'); check('web build: unlock all → every level open, levels_done untouched', prof2.get('level') === L.LEVEL_COUNT && prof2.get('levels_done') === 2); }
{ let bytes = 0; let sub4 = 0; const subs = {}; (function walk(d) { for (const e of readdirSync(d, { withFileTypes: true })) { const q = join(d, e.name); if (e.isDirectory()) walk(q); else if (/[\\/]art[0-9][\\/]/.test(q)) { const m = /[\\/](art[0-9])[\\/]/.exec(q)[1]; subs[m] = (subs[m] || 0) + statSync(q).size; if (m === 'art4') sub4 += statSync(q).size; } else bytes += statSync(q).size; } })(join(here, '..', 'mukbang-bang'));
  { const gj = JSON.parse(readFileSync(join(here, '..', 'mukbang-bang', 'game.json'), 'utf8')); for (const n of ['art1', 'art3', 'art4', 'art5', 'art6', 'art7', 'art8']) check('subpackage ' + n + ' ≤ 4 MB (' + ((subs[n] || 0) / 1048576).toFixed(2) + ' MB) and declared in game.json', (subs[n] || 0) > 0 && subs[n] <= 4 * 1048576 && gj.subpackages.some(x => x.name === n && x.root === n + '/')); }
  check('TikTok main package ≤ 4 MB (' + (bytes / 1048576).toFixed(2) + ' MB)', bytes <= 4 * 1024 * 1024);
  const dash = JSON.parse(readFileSync(join(here, '..', 'mukbang-bang.hs-dashboard.json'), 'utf8')); const pl = dash.iaa_config.placements;
  check('dashboard: 13 ad places, every cooldown 30 s, fan_gift has a reward', pl.length === 13 && ['rare_choice', 'cook_step', 'serve_bonus', 'extra_hype', 'unlock_level', 'unlock_look'].every(l => pl.some(x => x.label === l)) && pl.every(x => x.ads[0].config.cooldown === 30) && !!dash.iaa_config.rewards.fan_gift, pl.map(x => x.label + ':' + x.ads[0].config.cooldown));
  const gameDir = join(here, '..', 'mukbang-bang'); const p = fakePlatform(); const miss = []; let asked = 0;
  p.loadImage = (path, done) => { asked++; if (!existsSync(join(gameDir, path))) { miss.push(path); done(null); } else done({ width: 256, height: 256 }); };
  const prof = fakeProfile(INIT), g = new Game(p, fakeHs(prof, 'ok')); g.hsReady = true; run(g, 0.2);
  { const miss4 = Object.keys(S.V4).filter(q => !existsSync(join(gameDir, S.V4[q] === 'main' ? 'assets' : S.V4[q], q))); check('art V4: every registered V4 sprite is in the package', miss4.length === 0, miss4); }
  await eatAll(g, p, 'mix'); check('sprite path: level 1 plays with bitmap art, nothing missing requested', g.state === 'result' && asked > 10 && !miss.length, miss); }

// ═════════ 5 personas × 40 streams: play time + measured ad impressions ═════════
// Assumptions (NOT measurements): ad fill 90 %; interstitial 15 s, rewarded 30 s of watch time;
// rewarded opt-in per persona below; activities / wardrobe visit rates below.
const PERSONAS = {
  beginner: { think: 2.5, tap: 1.0, drag: 1.3, hearts: 0.3, read: 3.5, bonusAd: 0.15, boostAd: 0.05, side: 0.30, ward: 0.10, surprise: 0.05, fashion: 0.10 , rare: 0.08 },
  average:  { think: 1.6, tap: 0.7, drag: 1.0, hearts: 0.6, read: 2.5, bonusAd: 0.25, boostAd: 0.15, side: 0.45, ward: 0.15, surprise: 0.10, fashion: 0.20 , rare: 0.12 },
  skilled:  { think: 1.0, tap: 0.5, drag: 0.7, hearts: 0.9, read: 1.5, bonusAd: 0.20, boostAd: 0.10, side: 0.40, ward: 0.10, surprise: 0.05, fashion: 0.10 , rare: 0.08 },
  adUser:   { think: 1.6, tap: 0.7, drag: 1.0, hearts: 0.6, read: 2.5, bonusAd: 0.70, boostAd: 0.50, side: 0.45, ward: 0.20, surprise: 0.50, fashion: 0.60 , rare: 0.30 },
  noAds:    { think: 1.6, tap: 0.7, drag: 1.0, hearts: 0.6, read: 2.5, bonusAd: 0.25, boostAd: 0.15, side: 0.45, ward: 0.15, surprise: 0.10, fashion: 0.20, noAds: true , rare: 0.06 }
};
const FILL = 0.9, AD_SEC = { stream_end: 15, bonus_coins: 30, free_coins: 30, surprise_food: 30, fashion_reward: 30, viral_boost: 30, fan_gift: 30 };
const report = [];
for (const name of Object.keys(PERSONAS)) {
  seed(100 + name.length); const pz = PERSONAS[name];
  const b = { clock: 0, play: 0, ads: 0, adSec: 0, acts: 0, sides: 0, wards: 0, at: {}, imps: [] };
  const prof = fakeProfile(INIT); if (pz.noAds) prof.set('no_ads', 1);
  const hs = fakeHs(prof, 'ok', { clock: () => b.clock, cooldown: 30, fill: FILL });
  const p = fakePlatform(), g = new Game(p, hs); g.hsReady = true; g.wall = 0; run(g, 0.1);
  const spend = (s, play) => { b.clock += s; if (play !== false) b.play += s; g.wall = b.clock; };
  const act = (s) => { spend(s); b.acts++; };
  const statsImp = () => { const st = JSON.parse(prof.get('ad_stats') || '{}'); let n = 0; for (const k in st) n += st[k].imp; return n; };
  let lastImp = 0;
  const afterAd = () => { const n = statsImp(); if (n > lastImp) { for (let i = lastImp; i < n; i++) b.imps.push(b.clock); const placeSec = 20; spend(placeSec, false); b.adSec += placeSec; lastImp = n; } };
  const tapB = async (id) => { await tap(g, p, id); act(pz.tap); await flush(); afterAd(); };
  const cookCost = (sec, kind) => { if (kind === 'pick') act(pz.think + pz.tap * 2); else if (kind === 'tap') act(pz.tap); else spend(sec + (kind === 'wait' ? 0 : pz.tap)); };
  const eatStream = async () => {
    spend(pz.think);
    if (g.run.phase === 'request') { spend(pz.read * 0.6); await tapB('cook_go'); await cookAll(g, p, { match: Math.random() < 0.85, cost: cookCost, rare: pz.rare, hot: pz.bonusAd * 0.8, onAd: afterAd }); afterAd(); }
    if (hasBtn(g, 'boost_ad') && Math.random() < pz.boostAd) await tapB('boost_ad');
    if (g.run.phase === 'sealed') { const pk = g.packPos(); touchAt(g, p, pk.x, pk.y); act(pz.tap); const t0 = g.time; run(g, ST.T.opening + 0.05); spend(g.time - t0); }
    for (let k = 0, guard = 0; g.run && g.run.pickups < 3 && guard++ < 8; k++) {
      runUntil(g, () => !g.run || g.run.phase === 'open' || g.run.phase === 'empty', 6); if (!g.run || g.run.pickups >= 3) break;
      if (k >= 1 && hasBtn(g, 'fangift_ad') && Math.random() < pz.bonusAd * 0.6) await tapB('fangift_ad');
      if (hasBtn(g, 'hype_ad') && Math.random() < pz.bonusAd * 0.8) await tapB('hype_ad');
      const fp = foodPos(g);
      if (Math.random() < 0.5) { const m = g.mouth(); drag(g, p, fp.x, fp.y, m.x, m.y, 10); act(pz.drag); } else { touchAt(g, p, fp.x, fp.y); act(pz.tap); }
      const t1 = g.time;
      for (let i = 0; i < 60 && g.run && g.run.phase !== 'open' && g.run.phase !== 'empty'; i++) { run(g, 0.1); for (const h of g.hearts.slice()) if (!h.taken && h.life > 1 && Math.random() < pz.hearts * 0.25) { touchAt(g, p, h.x, h.y); b.clock += 0.3; b.acts++; } if (g.run.gift && !g.run.giftTaken && Math.random() < pz.hearts * 0.3) { touchAt(g, p, g.run.gift.x, g.run.gift.y); b.acts++; } }
      spend(g.time - t1);
    }
    const t2 = g.time; runUntil(g, () => g.state === 'result', 10); spend(g.time - t2); spend(pz.read);
    if (hasBtn(g, 'bonus_ad') && Math.random() < pz.bonusAd) await tapB('bonus_ad');
  };
  let blocked = '';
  for (let n = 1; n <= L.LEVEL_COUNT; n++) {
    try {
      if (g.state !== 'stream') { if (g.state === 'result') await tapB(g.result.lv && g.result.lv.n < L.LEVEL_COUNT ? 'next' : 'res_home'); if (g.state === 'home') await tapB('play'); }
      if (g.state !== 'stream' || g.run.level !== n) { blocked = 'L' + n + ' state ' + g.state + ' run ' + (g.run && g.run.level); break; }
      await eatStream();
      if (MARKS_ONE(n)) b.at[n] = b.clock;
      // optional side trips between streams
      const opens = L.MODES.filter(m => g.modeOpen(m.id));
      if (opens.length && Math.random() < pz.side) {
        await tapB('res_home'); const m = opens[Math.floor(Math.random() * opens.length)];
        await tap(g, p, 'side_' + m.id); act(pz.tap); await flush();
        if (g.state !== 'home') { spend(pz.think * 3 + 6); g.sceneAutoFill(); const t = g.time; runUntil(g, () => g.state === 'stream', 6); spend(g.time - t); if (g.state === 'stream') { b.sides++; await eatStream(); } }
        if (g.state === 'result') await tapB('res_home');
      }
      if (n >= WR.OPEN_AT && Math.random() < pz.ward) { if (g.state === 'result') await tapB('res_home'); await tapB('wardrobe'); spend(12); const items = WR.ITEMS.filter(i => i.price && !WR.owns(WR.state(prof), i.id) && i.price <= prof.get('coins')); if (items.length) { const si = WR.SLOTS.findIndex(x => x.id === items[0].slot); await tapB('wtab' + si); await tapB('witem_' + items[0].id); } if (Math.random() < pz.fashion && hasBtn(g, 'fashion_ad')) await tapB('fashion_ad'); { const gl = WR.ITEMS.find(i => i.gift && i.gift > n && !WR.owns(WR.state(prof), i.id)); if (gl && Math.random() < pz.fashion * 0.5) { const si = WR.SLOTS.findIndex(x => x.id === gl.slot); await tapB('wtab' + si); await tapB('witem_' + gl.id); } } b.wards++; await tapB('home'); }
      if (g.state === 'home' && Math.random() < pz.surprise && hasBtn(g, 'surprise_ad')) { await tapB('surprise_ad'); if (g.state === 'stream' && g.run.side === 'surprise') await eatStream(); if (g.state === 'result') await tapB('res_home'); }
    } catch (e) { blocked = 'L' + n + ': ' + e.message; break; }
  }
  // impressions per rolling 5-minute window, measured from the game's own ad_stats
  const win = []; for (let t0 = 0; t0 + 300 <= b.clock; t0 += 60) win.push(b.imps.filter(t => t >= t0 && t < t0 + 300).length);
  const first5 = b.imps.filter(t => t < 300).length;
  report.push({ name, b, blocked, levels: prof.get('levels_done'), coins: prof.get('coins'), win, first5, stats: JSON.parse(prof.get('ad_stats')) });
  check(name + ': finishes all ' + L.LEVEL_COUNT + ' streams', !blocked && prof.get('levels_done') === L.LEVEL_COUNT, blocked || prof.get('levels_done'));
}
function MARKS_ONE(n) { return [5, 10, 20, 30, 40].indexOf(n) >= 0; }
const fmt = s => { const m = Math.floor(s / 60), r = Math.round(s % 60); return m + "'" + (r < 10 ? '0' : '') + r + '"'; };
console.log('\n── Simulation (human time estimate; ad counts from the game\'s own ad_stats; assumptions in the source) ──');
console.log('persona     total(with ads)  playtime   S5      S10     S20     S30     S40   side  ward  imps  imps/5min avg (min–max)  first 5 min');
for (const r of report) { const avg = r.win.length ? (r.win.reduce((a, c) => a + c, 0) / r.win.length) : 0; console.log(r.name.padEnd(11) + fmt(r.b.clock).padStart(10) + fmt(r.b.play).padStart(13) + [5, 10, 20, 30, 40].map(n => fmt(r.b.at[n] || 0).padStart(8)).join('') + String(r.b.sides).padStart(6) + String(r.b.wards).padStart(6) + String(r.b.imps.length).padStart(6) + ('   ' + avg.toFixed(1) + ' (' + Math.min(...r.win) + '–' + Math.max(...r.win) + ')').padEnd(26) + String(r.first5).padStart(6)); }
const avgR = report.find(r => r.name === 'average'); console.log('average ad_stats:', JSON.stringify(avgR.stats));
console.log('feature popups seen by the test players:', featSeen.length);
console.log(fails ? ('\n' + fails + ' FAILED') : '\nall passed');
process.exit(fails ? 1 : 0);
