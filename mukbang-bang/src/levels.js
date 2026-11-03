'use strict';
// V2: the 30 levels as data (docs/GAME-DESIGN-V2.md §6). One generic runner in
// game.js plays every level; nothing here is code per level.
//   mode: 'prestock' (food already on the table) · 'market' · 'delivery' · 'buffet' · 'kitchen'
//   loc:  'home' (window view = chapter background) · 'restaurant'
//   mech: stream mechanics switched on for this level
//   req:  fan requests { first: s, every: s }   mystery: gift boxes put on the table
//   challenge: optional bonus goal { combo: n } | { perfect: n } | { requests: n }
const D = require('./data.js');
const K = require('./catalog.js');

const CHAPTERS = [
  { n: 1, name: 'ROOKIE STREAMER', view: 0 },
  { n: 2, name: 'RISING STAR', view: 1 },
  { n: 3, name: 'VIRAL QUEEN', view: 2 },
  { n: 4, name: 'MUKBANG CELEBRITY', view: 3 },
  { n: 5, name: 'SUPERSTAR LIVE', view: 4 }
];
const ALL_SHELVES = ['noodles', 'snacks', 'drinks', 'cakes', 'icecream', 'fruit'];
const M_BASE = { combo: true };
function mech(o) { const m = Object.assign({}, M_BASE); for (const k in o) m[k] = o[k]; return m; }

// goal anchors (log-interpolated): 800 → 10K (L6) → 30K (L12) → 100K (L18) → 300K (L24) → 1M (L29) → 1.5M
const ANCHORS = [[1, 800], [6, 10000], [12, 30000], [18, 100000], [24, 300000], [29, 1000000], [30, 1500000]];
function goalOf(n) {
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const a = ANCHORS[i], b = ANCHORS[i + 1];
    if (n >= a[0] && n <= b[0]) { const t = (n - a[0]) / (b[0] - a[0]); const g = Math.exp(Math.log(a[1]) * (1 - t) + Math.log(b[1]) * t); const m = Math.pow(10, Math.max(0, Math.floor(Math.log10(g)) - 1)); return Math.round(g / m) * m; }
  }
  return 1500000;
}

const RAW = [
  // ── Chapter 1 — ROOKIE STREAMER ──
  { title: 'First Viral Bite', mode: 'prestock', sec: 35, prestock: ['cat_chips', 'honey_puffs', 'cheese_noodle'], mech: mech({}), intro: 'bite',
    unlocks: ['Your first livestream!'] },
  { title: 'Crunchy Combo', mode: 'delivery', sec: 50, delivery: { rest: ['chicken_joy'], mains: 1, sides: 2 }, mech: mech({}), intro: 'combo',
    unlocks: ['FOOD DELIVERY APP', 'Chicken Joy'] },
  { title: 'Too Spicy!', mode: 'buffet', sec: 55, buffet: { stations: ['hot'], slots: 3, fee: 300 }, mech: mech({ spice: true }), intro: 'spice',
    unlocks: ['BUFFET PASS', 'Hot Station'] },
  { title: 'Fans Choose My Food', mode: 'kitchen', sec: 60, kitchen: { recipe: 'decorate_cake', extras: ['peach_milk'] }, mech: mech({ spice: true, requests: true }), req: { first: 5, every: 12 }, intro: 'requests',
    unlocks: ['HOME KITCHEN', 'Cake shelf'] },
  { title: 'Mystery Box', mode: 'market', sec: 50, market: { shelves: ['noodles', 'snacks', 'drinks', 'cakes'], pick: 3 }, mystery: 1, mech: mech({ spice: true, requests: true }), req: { first: 10, every: 14 }, intro: 'mystery',
    unlocks: ['MYSTERY BOXES'] },
  { title: 'First 10K Fans', mode: 'buffet', sec: 60, buffet: { stations: ['hot', 'dessert'], slots: 4, fee: 340 }, mech: mech({ spice: true, requests: true }), req: { first: 8, every: 14 }, challenge: { combo: 10 },
    unlocks: ['Dessert & Ice Bar', '10K FANS TROPHY'] },
  // ── Chapter 2 — RISING STAR ──
  { title: 'Sweet vs Sour', mode: 'kitchen', sec: 65, kitchen: { recipe: 'custom_ramen', extras: ['gummy_bears', 'peach_milk'] }, mech: mech({ spice: true, requests: true }), req: { first: 6, every: 12 },
    unlocks: ['Recipe: Custom Ramen'] },
  { title: 'Meet Kiko', mode: 'delivery', sec: 65, delivery: { rest: ['chicken_joy', 'mamma_pizza'], mains: 2, sides: 2 }, mech: mech({ spice: true, requests: true }), req: { first: 8, every: 13 },
    unlocks: ['NEW STREAMER: KIKO', 'Mamma Pizza'] },
  { title: 'Make My Boba', mode: 'kitchen', sec: 70, kitchen: { recipe: 'make_boba', extras: ['melon_bowl', 'straw_plate'] }, mech: mech({ spice: true, requests: true }), req: { first: 6, every: 12 },
    unlocks: ['Recipe: Boba', 'Fruit shelf'] },
  { title: 'Frozen Face', mode: 'buffet', sec: 70, buffet: { stations: ['cold', 'dessert'], slots: 4, fee: 380 }, mech: mech({ spice: true, requests: true }), req: { first: 8, every: 12 },
    unlocks: ['Sushi & Cold Bar'] },
  { title: 'Perfect ASMR', mode: 'delivery', sec: 70, delivery: { rest: ['seoul_street', 'chicken_joy', 'mamma_pizza'], mains: 2, sides: 2 }, mech: mech({ spice: true, requests: true }), req: { first: 8, every: 13 }, challenge: { perfect: 6 },
    unlocks: ['Seoul Street'] },
  { title: 'First Fan Party', mode: 'market', sec: 75, market: { shelves: ALL_SHELVES, pick: 5 }, mystery: 1, mech: mech({ spice: true, requests: true }), req: { first: 5, every: 9 }, challenge: { requests: 3 },
    unlocks: ['Party haul'] },
  // ── Chapter 3 — VIRAL QUEEN ──
  { title: 'Hot or Cold?', mode: 'buffet', sec: 75, buffet: { stations: ['hotpot', 'cold', 'hot'], slots: 5, fee: 420 }, mech: mech({ spice: true, requests: true }), req: { first: 6, every: 11 },
    unlocks: ['Hotpot Corner'] },
  { title: 'Mystery Roulette', mode: 'delivery', sec: 75, delivery: { rest: ['tokyo_box', 'seoul_street', 'mamma_pizza'], mains: 2, sides: 2 }, mystery: 1, mech: mech({ spice: true, requests: true }), req: { first: 8, every: 12 },
    unlocks: ['Tokyo Box'] },
  { title: 'Rainbow Dessert', mode: 'kitchen', sec: 80, kitchen: { recipe: 'rainbow_dessert', extras: ['straw_swirl', 'soda_pop'] }, mech: mech({ spice: true, requests: true }), req: { first: 6, every: 11 },
    unlocks: ['Recipe: Rainbow Dessert'] },
  { title: 'Meet Momo', mode: 'delivery', sec: 80, delivery: { rest: ['mamma_pizza', 'tokyo_box', 'chicken_joy'], mains: 2, sides: 3 }, mech: mech({ spice: true, requests: true }), req: { first: 8, every: 12 },
    unlocks: ['NEW STREAMER: MOMO'] },
  { title: 'Double Trouble', mode: 'buffet', sec: 80, buffet: { stations: ['grill', 'hot', 'dessert'], slots: 5, fee: 460 }, mech: mech({ spice: true, requests: true }), req: { first: 6, every: 11 },
    unlocks: ['Grill Station'] },
  { title: '100K Celebration', mode: 'kitchen', sec: 85, kitchen: { recipe: 'party_plate', extras: ['soda_pop', 'rainbow_crepe'] }, mystery: 1, mech: mech({ spice: true, requests: true }), req: { first: 4, every: 8 }, challenge: { requests: 4 },
    unlocks: ['Recipe: Party Plate', '100K FANS TROPHY'] },
  // ── Chapter 4 — MUKBANG CELEBRITY ──
  { title: 'Cozy Night Live', mode: 'delivery', sec: 85, delivery: { rest: ['hot_boil', 'tokyo_box', 'seoul_street'], mains: 2, sides: 2 }, mech: mech({ spice: true, requests: true }), req: { first: 8, every: 12 },
    unlocks: ['Hot & Boil'] },
  { title: 'Speed Snack', mode: 'market', sec: 80, market: { shelves: ALL_SHELVES, pick: 6 }, mech: mech({ spice: true, requests: true }), req: { first: 5, every: 10 }, challenge: { combo: 15 },
    unlocks: [] },
  { title: 'Fan Order Rush', mode: 'delivery', sec: 90, delivery: { rest: ['chicken_joy', 'mamma_pizza', 'seoul_street', 'tokyo_box', 'hot_boil'], mains: 3, sides: 2 }, mech: mech({ spice: true, requests: true }), req: { first: 4, every: 7 }, challenge: { requests: 5 },
    unlocks: [] },
  { title: 'Super Spicy Battle', mode: 'buffet', sec: 90, buffet: { stations: ['lava', 'hot', 'cold'], slots: 5, fee: 520 }, mech: mech({ spice: true, requests: true }), req: { first: 6, every: 11 },
    unlocks: ['Lava Spicy Station'] },
  { title: 'Sweet Surprise', mode: 'kitchen', sec: 90, kitchen: { recipe: 'surprise_dessert', extras: ['banana_milk', 'straw_cake'] }, mystery: 1, mech: mech({ spice: true, requests: true }), req: { first: 6, every: 11 },
    unlocks: ['Recipe: Surprise Dessert'] },
  { title: 'Celebrity Collab', mode: 'delivery', sec: 95, delivery: { rest: ['hot_boil', 'tokyo_box', 'mamma_pizza'], mains: 2, sides: 3 }, mech: mech({ spice: true, requests: true }), req: { first: 6, every: 10 },
    unlocks: ['Seafood Boil'] },
  // ── Chapter 5 — SUPERSTAR LIVE ──
  { title: 'Neon City Debut', mode: 'buffet', sec: 100, buffet: { stations: ['hot', 'cold', 'hotpot', 'grill', 'lava', 'dessert'], slots: 6, fee: 560 }, mech: mech({ spice: true, requests: true }), req: { first: 6, every: 10 },
    unlocks: ['Every buffet station'] },
  { title: 'Mega Mystery Box', mode: 'market', sec: 100, market: { shelves: ALL_SHELVES, pick: 4 }, mystery: 3, mech: mech({ spice: true, requests: true }), req: { first: 6, every: 11 },
    unlocks: [] },
  { title: 'ASMR Master', mode: 'kitchen', sec: 105, kitchen: { recipe: 'crispy_fry', extras: ['cola', 'pickled_radish', 'cat_chips'] }, mech: mech({ spice: true, requests: true }), req: { first: 6, every: 10 }, challenge: { perfect: 15 },
    unlocks: ['Recipe: Crispy Fry'] },
  { title: 'Ultimate Food Mix', mode: 'delivery', sec: 110, delivery: { rest: ['chicken_joy', 'mamma_pizza', 'seoul_street', 'tokyo_box', 'hot_boil'], mains: 3, sides: 3 }, mystery: 1, mech: mech({ spice: true, requests: true }), req: { first: 6, every: 10 },
    unlocks: [] },
  { title: 'Million Viewer Race', mode: 'buffet', sec: 115, buffet: { stations: ['hot', 'cold', 'hotpot', 'grill', 'lava', 'dessert'], slots: 6, fee: 600 }, mystery: 1, mech: mech({ spice: true, requests: true }), req: { first: 4, every: 7 }, challenge: { requests: 6 },
    unlocks: [] },
  { title: 'Superstar Mukbang Finale', mode: 'delivery', sec: 120, delivery: { rest: ['chicken_joy', 'mamma_pizza', 'seoul_street', 'tokyo_box', 'hot_boil'], mains: 3, sides: 3 }, mystery: 2, mech: mech({ spice: true, requests: true }), req: { first: 5, every: 8 }, challenge: { combo: 25 },
    unlocks: ['SUPERSTAR TROPHY'] }
];

const LEVELS = [];
for (let i = 0; i < RAW.length; i++) {
  const r = RAW[i], n = i + 1, ch = Math.floor(i / 6);
  const goal = goalOf(n);
  const lv = Object.assign({}, r, { n: n, chapter: ch + 1, chapterName: CHAPTERS[ch].name, view: CHAPTERS[ch].view, bg: CHAPTERS[ch].view,
    loc: r.mode === 'buffet' ? 'restaurant' : 'home', goal: goal, goal3: Math.round(goal * 1.35 / Math.pow(10, Math.max(1, Math.floor(Math.log10(goal)) - 1))) * Math.pow(10, Math.max(1, Math.floor(Math.log10(goal)) - 1)),
    startViewers: Math.max(100, Math.round(goal * 0.25 / 100) * 100), mystery: r.mystery || 0 });
  lv.minCost = minCost(lv);
  lv.rounds = r.rounds || roundsFor(n);
  LEVELS.push(lv);
}
const LEVEL_COUNT = LEVELS.length;

// Extra stream rounds after the first table is cleared (later levels last longer through new
// activities, not more chewing). type: encore (more food from the same source) · mystery (gift
// boxes) · spicy (a hot challenge course + a drink) · rush (fan requests every few seconds)
function roundsFor(n) {
  if (n === 1) return [];
  if (n <= 4) return [{ type: 'encore', count: 2 }];
  if (n === 5) return [{ type: 'mystery', count: 2 }];
  if (n === 6) return [{ type: 'encore', count: 2 }, { type: 'spicy', count: 2 }];
  const twist = ['mystery', 'spicy', 'rush'][n % 3];
  if (n <= 12) return [{ type: 'encore', count: 3 }, { type: twist, count: 2 }];
  if (n <= 18) return [{ type: 'encore', count: 3 }, { type: twist, count: 3 }, { type: 'encore', count: 3 }];
  if (n <= 24) return [{ type: 'encore', count: 3 }, { type: twist, count: 3 }, { type: 'encore', count: 3 }, { type: ['rush', 'mystery', 'spicy'][n % 3], count: 3 }];
  return [{ type: 'encore', count: 3 }, { type: twist, count: 3 }, { type: 'encore', count: 3 }, { type: ['rush', 'mystery', 'spicy'][n % 3], count: 3 }, { type: 'encore', count: 3 }, { type: 'rush', count: 3 }];
}
// dishes a level's encore rounds can serve (its own food source)
function sourcePool(lv) {
  const out = [];
  if (lv.mode === 'market') { for (let i = 0; i < D.FOODS.length; i++) if (lv.market.shelves.indexOf(D.FOODS[i].cat) >= 0) out.push(D.FOODS[i].id); }
  else if (lv.mode === 'delivery') { for (let i = 0; i < lv.delivery.rest.length; i++) K.mainsOf(lv.delivery.rest[i]).forEach(function (d) { out.push(d.id); }); K.sides().forEach(function (d) { out.push(d.id); }); }
  else if (lv.mode === 'buffet') { for (let i = 0; i < lv.buffet.stations.length; i++) Array.prototype.push.apply(out, K.STATION_ITEMS[lv.buffet.stations[i]]); }
  else if (lv.mode === 'kitchen') { Array.prototype.push.apply(out, lv.kitchen.extras || []); const d = K.RECIPE_BY_ID[lv.kitchen.recipe].dish; if (d !== 'mystery') out.push(d); out.push('straw_cake', 'banana_milk', 'honey_puffs'); }
  else Array.prototype.push.apply(out, CARE_PACK.concat(['cheese_noodle', 'rainbow_candy']));
  return out;
}
const SPICY_COURSE = ['spicy_wings', 'tteokbokki', 'chili_noodle', 'kimchi_rice', 'mapo_tofu'];
const COOL_DRINKS = ['cola', 'iced_lemon_tea', 'peach_milk', 'milk_cooler'];

// cheapest way to play the level (what the player must be able to afford)
function minCost(lv) {
  if (lv.mode === 'prestock') return 0;
  if (lv.mode === 'market') { let p = 1e9; for (let i = 0; i < lv.market.shelves.length; i++) p = Math.min(p, D.CAT_BY_ID[lv.market.shelves[i]].price); return p * lv.market.pick; }
  if (lv.mode === 'delivery') { const ps = []; for (let i = 0; i < lv.delivery.rest.length; i++) { const ms = K.mainsOf(lv.delivery.rest[i]); for (let j = 0; j < ms.length; j++) ps.push(ms[j].price); } ps.sort(function (a, b) { return a - b; }); let s = 0; for (let i = 0; i < lv.delivery.mains; i++) s += ps[Math.min(i, ps.length - 1)]; return s; }
  if (lv.mode === 'buffet') return lv.buffet.fee;
  if (lv.mode === 'kitchen') return K.RECIPE_BY_ID[lv.kitchen.recipe].price;
  return 0;
}
function level(n) { return LEVELS[Math.max(1, Math.min(LEVEL_COUNT, n | 0)) - 1]; }
// The free "fan gift" when the player cannot afford the level: three cheap snacks, no shop.
const CARE_PACK = ['cat_chips', 'peach_milk', 'honey_puffs'];
// coin value used for bite pay when the food was free (L1, fan gift) — scales gently with the level
function nominalCost(n) { return 120 + 15 * n; }

module.exports = { LEVELS, LEVEL_COUNT, CHAPTERS, level, goalOf, minCost, CARE_PACK, nominalCost, roundsFor, sourcePool, SPICY_COURSE, COOL_DRINKS };
