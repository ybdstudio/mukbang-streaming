'use strict';
// V4: 40 levels. Each = a viewer request → COOK the dish (choices) → eat it on the
// stream as 3 portions × 3 bites → viral finish (docs/GAME-DESIGN-V4.md).
// Packaged foods (packOf / PACK_INFO) are still used by the optional activities.
const D = require('./data.js');
const K = require('./catalog.js');

const CHAPTERS = [
  { n: 1, name: 'FIRST KITCHEN', view: 0 },
  { n: 2, name: 'SWEET TOOTH', view: 1 },
  { n: 3, name: 'RISING STAR', view: 2 },
  { n: 4, name: 'COZY NIGHTS', view: 3 },
  { n: 5, name: 'SUPERSTAR', view: 4 }
];
const PER_CHAPTER = 8;

// How each food is presented on the table and how it opens.
//   bag (tear the top) · cup (peel the lid) · bottle (pop the cap) · box (lift the lid) · dome (lift the cloche)
function packOf(d) {
  if (d.src === 'market') return { noodles: 'cup', snacks: 'bag', drinks: 'bottle', cakes: 'dome', icecream: 'cup', fruit: 'dome' }[d.cat];
  if (d.src === 'delivery') return d.shape === 'cup' ? 'bottle' : 'box';
  return 'dome';
}
const PACK_INFO = {
  bag:    { open: 'TEAR IT OPEN', verb: 'tear', sound: 'crunch' },
  cup:    { open: 'PEEL THE LID', verb: 'peel', sound: 'slurp' },
  bottle: { open: 'POP IT OPEN',  verb: 'pop',  sound: 'fizz' },
  box:    { open: 'OPEN THE BOX', verb: 'lid',  sound: 'pop' },
  dome:   { open: 'LIFT THE LID', verb: 'dome', sound: 'ding' }
};

// fan events (no timing pressure: everything is optional or automatic)
const EVENTS = ['hearts', 'gift', 'superchat', 'wave', 'spotlight', 'duet'];

// V4: every level = a viewer request for ONE dish you cook first, then eat on the stream.
// [recipe, fan event, extra unlocks]. Choice unlocks (new moulds, flavours, toppings…) come from recipes.js.
const R = require('./recipes.js');
const RAW = [
  // Ch.1 SNACK ROOKIE → "FIRST KITCHEN"
  ['jelly', 'hearts', []], ['jelly', 'gift', []], ['pudding', 'gift', ['mode:market']], ['cupcake', 'superchat', []],
  ['boba', 'wave', []], ['jelly', 'gift', ['wardrobe', 'look:hair_bow']], ['ramen', 'superchat', ['mode:delivery']], ['pudding', 'wave', []],
  // Ch.2
  ['parfait', 'spotlight', []], ['cupcake', 'gift', ['streamer:kiko']], ['boba', 'duet', ['mode:buffet']], ['donut', 'superchat', []],
  ['ramen', 'wave', ['look:acc_glasses_round']], ['jelly', 'gift', []], ['bingsu', 'spotlight', []], ['parfait', 'duet', ['look:outfit_sunny']],
  // Ch.3
  ['donut', 'wave', []], ['pudding', 'gift', []], ['ramen', 'superchat', ['look:hair_cat_ears']], ['boba', 'spotlight', ['streamer:momo']],
  ['cupcake', 'duet', []], ['bingsu', 'wave', ['look:acc_headphones']], ['jelly', 'gift', []], ['parfait', 'spotlight', ['look:outfit_sakura']],
  // Ch.4
  ['ramen', 'wave', []], ['donut', 'duet', []], ['pudding', 'gift', ['look:outfit_chef']], ['boba', 'superchat', []],
  ['bingsu', 'wave', ['look:hair_flowers']], ['cupcake', 'spotlight', []], ['ramen', 'duet', ['look:acc_heart_glasses']], ['jelly', 'gift', []],
  // Ch.5
  ['parfait', 'wave', []], ['donut', 'spotlight', ['look:hair_bunny_ears']], ['boba', 'duet', []], ['bingsu', 'superchat', ['look:outfit_star']],
  ['ramen', 'duet', []], ['cupcake', 'gift', ['look:acc_scarf']], ['pudding', 'spotlight', []], ['jelly', 'duet', ['look:hair_crown']]
];
const LEVEL_COUNT = RAW.length;

// viewer goal: 500 → ~1M (log curve), start = 30 %
function goalOf(n) { const g = 500 * Math.pow(2000, (n - 1) / (LEVEL_COUNT - 1)); const m = Math.pow(10, Math.max(1, Math.floor(Math.log10(g)) - 1)); return Math.round(g / m) * m; }
function roundTo(v) { const m = Math.pow(10, Math.max(1, Math.floor(Math.log10(v)) - 1)); return Math.round(v / m) * m; }
const SLOT_NAME = { mold: 'MOULD', flavor: 'FLAVOUR', broth: 'BROTH', topping: 'TOPPING', ramen_top: 'RAMEN TOPPING', boba_top: 'BOBA TOPPING', deco: 'DECORATION', ramen_deco: 'SEASONING', cup: 'CUP', shape: 'DONUT SHAPE' };
// the request: the newest flavour + topping the player can pick at this level (shows off what just unlocked)
function requestFor(recipe, n, i) {
  const rc = R.RECIPES[recipe], fslot = rc.taste === 'broth' ? 'broth' : 'flavor', tslot = R.toppingSlot(recipe);
  const fs = R.options(fslot, n), ts = R.options(tslot, n);
  // something that just unlocked at this level wins; otherwise rotate through what is open (L1: strawberry + cherry)
  const fresh = function (list) { for (let k = 0; k < list.length; k++) if (list[k].unlock === n && n > 1) return list[k]; return null; };
  const f = fresh(fs) || fs[(i * 3) % fs.length], t = fresh(ts) || ts[(i * 5) % ts.length];
  const req = { recipe: recipe }; req[fslot] = f.id; req.topping = t.id;
  return req;
}
const LEVELS = [];
const seenRecipes = {};
for (let i = 0; i < RAW.length; i++) {
  const r = RAW[i], n = i + 1, ch = Math.min(CHAPTERS.length - 1, Math.floor(i / PER_CHAPTER));
  const goal = goalOf(n), rc = R.RECIPES[r[0]];
  const news = [];
  if (!seenRecipes[r[0]]) { seenRecipes[r[0]] = 1; if (n > 1) news.push('NEW RECIPE: ' + rc.name.toUpperCase()); }
  for (const slot in R.OPT) for (let k = 0; k < R.OPT[slot].length; k++) { const o = R.OPT[slot][k]; if (o[3] === n && n > 1) news.push('NEW ' + SLOT_NAME[slot] + ': ' + o[1].toUpperCase()); }
  const req = requestFor(r[0], n, i);
  LEVELS.push({
    n: n, chapter: ch + 1, chapterName: CHAPTERS[ch].name, view: CHAPTERS[ch].view, bg: CHAPTERS[ch].view, loc: 'home',
    recipe: r[0], request: req, title: R.dishName(req), event: r[1], unlocks: r[2], news: news,
    goal: goal, goal3: roundTo(goal * 1.3), startViewers: roundTo(goal * 0.3),
    cpb: 6 + 2 * n, reward: 100 + 20 * n // coins per bite · request reward (bigger when the dish matches the request)
  });
}
function level(n) { return LEVELS[Math.max(1, Math.min(LEVEL_COUNT, n | 0)) - 1]; }

// ── optional activities (home screen) ──
// Each one ends in a single-food bonus stream; it never advances the level.
const MODES = [
  { id: 'market',   name: 'SUPERMARKET', short: 'SHOP',   unlock: 3,  color: '#ffd7a3', dark: '#f0a860' },
  { id: 'delivery', name: 'DELIVERY',    short: 'ORDER',  unlock: 7,  color: '#ff8fb3', dark: '#d85e8e' },
  { id: 'buffet',   name: 'BUFFET',      short: 'BUFFET', unlock: 11, color: '#ffb199', dark: '#c93b1d' }
];
function modeOf(id) { for (let i = 0; i < MODES.length; i++) if (MODES[i].id === id) return MODES[i]; return null; }
// level an unlock id is granted at
function unlockLevel(id) { for (let i = 0; i < LEVELS.length; i++) if (LEVELS[i].unlocks.indexOf(id) >= 0) return LEVELS[i].n; return 0; }
// The activity's "level" config, sized for ONE food, based on how far the player is.
function sideConfig(mode, reached) {
  const base = { n: Math.max(1, Math.min(LEVEL_COUNT, reached)), side: mode, chapter: 1, view: level(reached).view, bg: level(reached).view, loc: mode === 'buffet' ? 'restaurant' : 'home', title: modeOf(mode).name };
  if (mode === 'market') { const sh = []; for (let i = 0; i < D.CATS.length; i++) if (D.CATS[i].unlock <= Math.max(2, Math.ceil(reached / 3))) sh.push(D.CATS[i].id); base.market = { shelves: sh.length ? sh : ['snacks'], pick: 1 }; }
  if (mode === 'delivery') base.delivery = { rest: K.RESTAURANTS.filter(function (r) { return r.unlock <= Math.max(2, Math.round(reached * 0.6)); }).map(function (r) { return r.id; }), mains: 1, sides: 0 };
  if (mode === 'buffet') base.buffet = { stations: K.STATIONS.filter(function (s) { return s.unlock <= Math.max(3, Math.round(reached * 0.6)); }).map(function (s) { return s.id; }), slots: 1, fee: 120 + 8 * reached };
  if (mode === 'kitchen') { const rs = K.RECIPES.filter(function (r) { return r.unlock <= Math.max(4, Math.round(reached * 0.75)); }); base.kitchen = { recipes: rs.map(function (r) { return r.id; }), recipe: rs[rs.length - 1].id, extras: [] }; }
  return base;
}

module.exports = { LEVELS, LEVEL_COUNT, CHAPTERS, PER_CHAPTER, EVENTS, PACK_INFO, MODES, modeOf, level, goalOf, packOf, sideConfig, unlockLevel, SLOT_NAME };
