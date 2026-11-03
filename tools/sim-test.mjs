#!/usr/bin/env node
// Headless logic test: runs src/game.js with a fake platform (no canvas
// pixels, every 2D call swallowed), a fake HS wrapper and a fake profile, and
// plays whole levels through the real tap / drag / timer paths.
//   node tools/sim-test.mjs
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(here, '..', 'mukbang-bang', 'src', 'x.js'));
const { Game } = require('./game.js');
const D = require('./data.js');

let fails = 0;
function check(name, ok, info) { if (ok) console.log('✅', name); else { fails++; console.log('❌', name, info === undefined ? '' : JSON.stringify(info)); } }
const flush = () => new Promise(r => setTimeout(r, 0));

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
function fakeHs(profile) {
  const claims = [], ads = [];
  return {
    profile, claims, ads,
    claimLevelBonus() { claims.push('level_bonus'); profile.add('coins', 150); return REW.level_bonus; },
    claimFirstStream() { claims.push('first_stream'); profile.add('coins', 200); return REW.first_stream; },
    rewardsLevelBonus: () => REW.level_bonus, rewardsBonusCoins: () => REW.bonus_coins, rewardsFreeCoins: () => REW.free_coins, rewardsShare: () => REW.share, rewardsProfile: () => REW.tiktok_profile, rewardsShortcut: () => REW.tiktok_shortcut,
    shareAvailable: () => true, item: id => ({ name: id === 'coins' ? 'Coins' : id }),
    hasMissions: () => true, hasShare: () => true, hasAds: () => true, hasShop: () => true,
    canShowStreamEnd: () => true, showStreamEnd() { ads.push('stream_end'); return Promise.resolve({}); },
    canShowBonusCoins: () => true, showBonusCoins() { ads.push('bonus_coins'); profile.add('coins', 300); return Promise.resolve(REW.bonus_coins); },
    canShowFreeCoins: () => true, showFreeCoins() { ads.push('free_coins'); profile.add('coins', 200); return Promise.resolve(REW.free_coins); },
    profileMissionDone: () => false, shortcutMissionDone: () => false, startProfileMission() {}, startShortcutMission() {},
    canShare: () => true, share: () => Promise.resolve({}), shop: () => Promise.resolve([{ product_id: 1, name: 'Coin pouch', beans_cost: 10, items: { coins: 1000 } }]), buy: () => Promise.resolve({ ok: true, delivered: true }), on() {}
  };
}
const INIT = { level: 1, levels_done: 0, coins: 1000, streamer: 0, stars_json: '{}', run_json: '', streams: 0, best_viewers: 0, no_ads: 0, sound: true };

// run frames: dt seconds in 1/60 steps
function run(g, seconds) { const steps = Math.round(seconds * 60); for (let i = 0; i < steps; i++) { g.lastT = g.lastT || 1000; g.frame(g.lastT + 1000 / 60); } }
// tap a UI button by id: find it in the last frame's button list, then let promises settle
async function tap(g, p, id) { run(g, 1 / 60); const b = g.ui.buttons.find(b => b.id === id); if (!b) throw new Error('no button ' + id + ' in state ' + g.state + ' (have: ' + g.ui.buttons.map(b => b.id).join(',') + ')'); const x = (b.x + b.w / 2) * 390 / g.W, y = (b.y + b.h / 2) * 390 / g.W; p.touch('start', 1, x, y); p.touch('end', 1, x, y); await flush(); run(g, 1 / 60); }
// drag from logical (x0,y0) to (x1,y1), hold `hold` seconds, release
function drag(g, p, x0, y0, x1, y1, hold) { const k = 390 / g.W; p.touch('start', 2, x0 * k, y0 * k); run(g, 0.05); for (let i = 1; i <= 10; i++) { p.touch('move', 2, (x0 + (x1 - x0) * i / 10) * k, (y0 + (y1 - y0) * i / 10) * k); run(g, 0.02); } run(g, hold || 0); p.touch('end', 2, x1 * k, y1 * k); run(g, 0.05); }
async function scanAll(g, p) { const s = g.scannerRect(); for (const it of g.checkout.items) if (!it.scanned) drag(g, p, it.x, it.y, s.x + s.w / 2, s.y + s.h / 2, 0); }
function eatAll(g, p) { const m = g.mouth(); for (const it of g.run.items) if (!it.done) drag(g, p, it.hx, it.hy, m.x, m.y, 0.3 + D.bitesOf(D.FOOD_BY_ID[it.id]) * 0.72 + 0.3); }

// ── a whole level through the real input paths ──
async function playLevel(g, p, prof, n) {
  await tap(g, p, 'play');
  check('L' + n + ': market opens', g.state === 'market' && g.market.lv.n === n, g.state);
  const lv = g.market.lv;
  let guard = 0;
  while (g.market.basket.length < lv.basket && guard++ < 20) await tap(g, p, 'item' + (g.market.basket.length % 6));
  check('L' + n + ': basket full (' + lv.basket + ')', g.market.basket.length === lv.basket, g.market.basket);
  const total = g.marketTotal(); const coinsBefore = prof.get('coins');
  run(g, 1.0); // flies land
  await tap(g, p, 'confirm');
  check('L' + n + ': checkout opens', g.state === 'checkout', g.state);
  await scanAll(g, p);
  check('L' + n + ': all scanned, total right', g.checkout.done && g.checkout.total === total, { done: g.checkout.done, total: g.checkout.total, expected: total });
  check('L' + n + ': coins deducted', prof.get('coins') === coinsBefore - total, { now: prof.get('coins'), before: coinsBefore, total });
  check('L' + n + ': run saved to profile', prof.get('run_json').indexOf('"level":' + n) > 0, prof.get('run_json').slice(0, 60));
  run(g, 2.0); // "Thank you!" → stream
  check('L' + n + ': stream starts', g.state === 'stream', g.state);
  const coinsAtStream = prof.get('coins');
  eatAll(g, p);
  check('L' + n + ': every item eaten', g.run === null || g.run.items.every(it => it.done), g.run && g.run.items.map(it => it.eaten));
  check('L' + n + ': coins earned on the stream', prof.get('coins') > coinsAtStream, { now: prof.get('coins'), start: coinsAtStream });
  run(g, 2.5); // STREAM COMPLETE → result
  check('L' + n + ': result shown', g.state === 'result' && g.result.lv.n === n, g.state);
  check('L' + n + ': run cleared', prof.get('run_json') === '', prof.get('run_json'));
  check('L' + n + ': level advanced', prof.get('level') === n + 1 && prof.get('levels_done') === n, { level: prof.get('level'), done: prof.get('levels_done') });
  check('L' + n + ': profit ≥ spend (economy never traps the player)', g.result.coins >= total, { earned: g.result.coins, total });
  return g.result;
}

// ── test 1: first levels, bonus ad, interstitial pacing ──
{
  const p = fakePlatform(), prof = fakeProfile(INIT), hs = fakeHs(prof);
  const g = new Game(p, hs); g.hsReady = true;
  run(g, 0.5);
  check('boots at home', g.state === 'home');
  await playLevel(g, p, prof, 1);
  check('first_stream + level_bonus claimed once', hs.claims.join(',') === 'level_bonus,first_stream', hs.claims);
  check('stars saved', JSON.parse(prof.get('stars_json'))[1] >= 1, prof.get('stars_json'));
  await tap(g, p, 'bonus_ad');
  check('bonus ad shown from the result', hs.ads.indexOf('bonus_coins') >= 0, hs.ads);
  run(g, 0.1); check('bonus button gone after the ad', !g.ui.buttons.find(b => b.id === 'bonus_ad'));
  await tap(g, p, 'next');
  check('NEXT on level 1 shows no interstitial (ad-free levels)', hs.ads.indexOf('stream_end') < 0, hs.ads);
  check('NEXT opens level 2 market', g.state === 'market' && g.market.lv.n === 2, g.state);
  await tap(g, p, 'home');
  await playLevel(g, p, prof, 2); await tap(g, p, 'next'); await tap(g, p, 'home');
  await playLevel(g, p, prof, 3); await tap(g, p, 'next'); await tap(g, p, 'home');
  await playLevel(g, p, prof, 4);
  await tap(g, p, 'next');
  check('NEXT after level 4 shows the interstitial', hs.ads.filter(a => a === 'stream_end').length === 1, hs.ads);
  check('level_bonus claimed once per level', hs.claims.filter(c => c === 'level_bonus').length === 4, hs.claims);
  check('drinks shelf unlocked at level 2+', g.market.lv.cats.indexOf('drinks') >= 0, g.market.lv.cats);
  // No Ads bought → no interstitial
  prof.set('no_ads', 1); await tap(g, p, 'home'); await playLevel(g, p, prof, 5); await tap(g, p, 'next');
  check('No Ads skips the interstitial', hs.ads.filter(a => a === 'stream_end').length === 1, hs.ads);
}

// ── test 2: resume a stream after a restart (run_json), replay pays no second level bonus ──
{
  const p = fakePlatform(), prof = fakeProfile(INIT), hs = fakeHs(prof);
  const g = new Game(p, hs); g.hsReady = true;
  await tap(g, p, 'play');
  while (g.market.basket.length < g.market.lv.basket) await tap(g, p, 'item0');
  run(g, 1); await tap(g, p, 'confirm'); await scanAll(g, p); run(g, 2);
  const m = g.mouth();
  // bites, and the app dies WHILE the food is held at the mouth
  const k = 390 / g.W; p.touch('start', 2, g.run.items[0].hx * k, g.run.items[0].hy * k); run(g, 0.05);
  for (let i = 1; i <= 10; i++) { p.touch('move', 2, (g.run.items[0].hx + (m.x - g.run.items[0].hx) * i / 10) * k, (g.run.items[0].hy + (m.y - g.run.items[0].hy) * i / 10) * k); run(g, 0.02); }
  run(g, 1.0);
  const eatenBefore = g.run.items[0].eaten; const coinsBefore = prof.get('coins');
  check('bites taken before the "restart"', eatenBefore > 0, eatenBefore);
  check('run_json holds no transient drag state', prof.get('run_json').indexOf('"drag"') < 0 && prof.get('run_json').indexOf('"x"') < 0, prof.get('run_json'));
  const p2 = fakePlatform(); const g2 = new Game(p2, hs); g2.hsReady = true; run(g2, 0.1);
  check('run restored from the profile', !!g2.run && g2.run.items[0].eaten === eatenBefore, g2.run && g2.run.items[0]);
  check('coins kept', prof.get('coins') === coinsBefore);
  await tap(g2, p2, 'play'); check('PLAY resumes the stream', g2.state === 'stream', g2.state);
  check('restored items sit in their slots', g2.run.items.every(it => it.x === it.hx && it.y === it.hy && !it.drag), g2.run.items.map(it => [it.x, it.hx]));
  await tap(g2, p2, 'pause'); check('pause overlay', g2.state === 'pause');
  await tap(g2, p2, 'leave'); check('leave keeps run_json', prof.get('run_json') !== '' && g2.state === 'home');
  await tap(g2, p2, 'play'); eatAll(g2, p2); run(g2, 2.5);
  check('resumed stream finishes', g2.state === 'result', g2.state);
  const claimsAfterFirst = hs.claims.filter(c => c === 'level_bonus').length;
  await tap(g2, p2, 'replay'); check('REPLAY reopens level 1', g2.state === 'market' && g2.market.lv.n === 1);
  while (g2.market.basket.length < g2.market.lv.basket) await tap(g2, p2, 'item1'); run(g2, 1); await tap(g2, p2, 'confirm'); await scanAll(g2, p2); run(g2, 2);
  eatAll(g2, p2); run(g2, 2.5);
  check('replay pays no second level bonus', hs.claims.filter(c => c === 'level_bonus').length === claimsAfterFirst, hs.claims);
  check('replay keeps the level pointer', prof.get('level') === 2, prof.get('level'));
}

// ── test 3: can't overspend, "+" popup, free coins ad, shop, streamers lock, basket edit ──
{
  const p = fakePlatform(), prof = fakeProfile(Object.assign({}, INIT, { coins: 100 })), hs = fakeHs(prof);
  const g = new Game(p, hs); g.hsReady = true; run(g, 0.1);
  await tap(g, p, 'play'); await tap(g, p, 'item0');
  check('cannot buy with 100 coins', g.market.basket.length === 0 && g.toast && /Not enough/.test(g.toast.text), g.toast);
  await tap(g, p, 'coins'); check('coins popup opens from the market', g.state === 'coins');
  await tap(g, p, 'free_coins'); check('free coins ad shown', hs.ads.indexOf('free_coins') >= 0 && prof.get('coins') === 300, prof.get('coins'));
  await tap(g, p, 'hsshop'); await flush(); run(g, 0.1); check('shop lists products', g.state === 'hsshop' && g.shopItems && g.shopItems.length === 1, g.shopItems);
  await tap(g, p, 'buy1'); check('buy call resolves', g.adBusy === false);
  await tap(g, p, 'shop_back'); check('back returns to the market', g.state === 'market', g.state);
  await tap(g, p, 'home'); await tap(g, p, 'streamers'); await tap(g, p, 'str1');
  check('locked streamer stays locked', prof.get('streamer') === 0 && /Reach level 8/.test(g.toast.text), g.toast);
  prof.set('levels_done', 7); await tap(g, p, 'str1'); check('streamer unlocks at level 8', prof.get('streamer') === 1);
  await tap(g, p, 'home'); await tap(g, p, 'levels'); check('levels screen', g.state === 'levels');
  await tap(g, p, 'lvl1'); check('level 1 opens from the grid', g.state === 'market' && g.market.lv.n === 1);
  prof.set('coins', 5000);
  for (let i = 0; i < 5; i++) await tap(g, p, 'item0');
  check('basket capped at size', g.market.basket.length === g.market.lv.basket && /full/.test(g.toast.text), g.toast);
  run(g, 1); await tap(g, p, 'bk0'); check('tap a basket item removes it', g.market.basket.length === g.market.lv.basket - 1);
  await tap(g, p, 'cat_next'); check('shelf switches', g.market.cat === 1);
  // tap-to-scan at the checkout (no drag)
  await tap(g, p, 'item2'); run(g, 1); await tap(g, p, 'confirm');
  const it = g.checkout.items[0]; const kk = 390 / g.W; p.touch('start', 3, it.x * kk, it.y * kk); p.touch('end', 3, it.x * kk, it.y * kk); run(g, 1.0);
  check('tapping an item flies it to the scanner', it.scanned === true, it);
}

// ── test 4: pause/freeze and data sanity ──
{
  const p = fakePlatform(), prof = fakeProfile(INIT), hs = fakeHs(prof);
  const g = new Game(p, hs); g.hsReady = true; run(g, 0.1);
  g.freeze(true); const t0 = g.time; run(g, 1); check('frozen game does not advance', g.time === t0); g.freeze(false); run(g, 0.1); check('unfreeze resumes', g.time > t0);
  let ok = true; for (let n = 1; n <= D.LEVEL_COUNT; n++) { const lv = D.level(n); if (lv.cats.length < 2 || lv.basket < 3 || lv.basket > 6 || lv.goal3 <= lv.goal) ok = false; }
  check('30 levels well-formed', ok);
  check('level 1 affordable from 1000 coins', D.basketSize(1) * 150 <= 1000);
  let eco = true; for (const f of D.FOODS) { const earn = D.coinsPerBite(f) * D.bitesOf(f); if (earn < D.priceOf(f) * 1.5) eco = false; }
  check('every food pays back ≥ 1.5× its price', eco);
  check('36 foods, 6 per shelf', D.FOODS.length === 36 && D.CATS.every(c => D.foodsOf(c.id).length === 6));
}

console.log(fails ? ('\n' + fails + ' FAILED') : '\nall passed');
process.exit(fails ? 1 : 0);
