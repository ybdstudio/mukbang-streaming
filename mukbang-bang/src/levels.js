'use strict';
// V3: 40 livestreams, ONE food per stream (docs/GAME-DESIGN-V3.md §4).
// Each stream: open the package → 3 pickups × 3 bites → viral finish.
// Levels only decide WHICH food, which fan event, and what unlocks — the
// eating itself is the same relaxed loop every time.
const D = require('./data.js');
const K = require('./catalog.js');

const CHAPTERS = [
  { n: 1, name: 'SNACK ROOKIE', view: 0 },
  { n: 2, name: 'SWEET TOOTH', view: 1 },
  { n: 3, name: 'RISING STAR', view: 2 },
  { n: 4, name: 'COZY NIGHTS', view: 3 },
  { n: 5, name: 'SUPERSTAR', view: 4 },
  { n: 6, name: 'MUKBANG LEGEND', view: 2 }
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
//   hearts: floating hearts to tap (always on) · gift: a fan gift box drops (tap for coins)
//   superchat: a big donation banner (auto) · wave: the chat floods (auto viewer surge)
//   spotlight: "TRENDING #1" camera zoom (auto) · duet: a fan joins the call (auto, then hearts burst)
const EVENTS = ['hearts', 'gift', 'superchat', 'wave', 'spotlight', 'duet'];

// [food id, title, fan event, unlocks...]  unlock ids: food: is automatic; mode:<id>, look:<wardrobe id>, streamer:<id>, wardrobe
const RAW = [
  // Ch.1 SNACK ROOKIE
  ['cat_chips',      'First Crunch',          'hearts',    []],
  ['honey_puffs',    'Honey Puff Pop',        'hearts',    []],
  ['cheese_noodle',  'Slurp Time',            'gift',      ['mode:market']],
  ['soda_pop',       'Fizzy Fun',             'gift',      []],
  ['straw_cake',     'Cake Day',              'superchat', []],
  ['rainbow_candy',  'Rainbow Crunch',        'gift',      ['wardrobe', 'look:hair_bow']],
  ['peach_milk',     'Peachy Sip',            'wave',      ['mode:delivery']],
  ['chili_noodle',   'Too Spicy!',            'superchat', []],
  // Ch.2 SWEET TOOTH
  ['mint_choc',      'Brain Freeze',          'wave',      []],
  ['kfc_chicken',    'Crispy Chicken Party',  'gift',      ['streamer:kiko']],
  ['matcha_roll',    'Matcha Moment',         'spotlight', ['mode:buffet']],
  ['gummy_bears',    'Sour Squad',            'superchat', []],
  ['bubble_tea',     'Boba Break',            'wave',      ['look:acc_glasses_round']],
  ['seaweed_crisps', 'Ocean Crunch',          'gift',      []],
  ['banana_milk',    'Banana Milk Bliss',     'spotlight', ['mode:kitchen']],
  ['pizza',          'Pizza Night',           'duet',      ['look:outfit_sunny']],
  // Ch.3 RISING STAR
  ['melon_bowl',     'Melon Jelly',           'wave',      []],
  ['choco_pretzel',  'Pretzel Twist',         'gift',      []],
  ['tteokbokki',     'Fire Rice Cakes',       'superchat', ['look:hair_cat_ears']],
  ['blue_moon',      'Blue Moon Scoop',       'spotlight', ['streamer:momo']],
  ['mango_cheese',   'Mango Cheesecake',      'duet',      []],
  ['berry_smoothie', 'Berry Blast',           'wave',      ['look:acc_headphones']],
  ['sushi_set',      'Sushi Platter',         'gift',      []],
  ['sakura_noodle',  'Sakura Slurp',          'spotlight', ['look:outfit_sakura']],
  // Ch.4 COZY NIGHTS
  ['sea_noodle',     'Seafood Cup',           'wave',      []],
  ['choco_mousse',   'Midnight Mousse',       'duet',      []],
  ['cheese_burger',  'Burger Bite',           'gift',      ['look:outfit_chef']],
  ['straw_swirl',    'Strawberry Swirl',      'superchat', []],
  ['dumplings',      'Dumpling Feast',        'wave',      ['look:hair_flowers']],
  ['rainbow_crepe',  'Rainbow Crepe',         'spotlight', []],
  ['mini_hotpot',    'Hotpot for One',        'duet',      ['look:acc_heart_glasses']],
  ['cookie_cream',   'Cookies & Cream',       'gift',      []],
  // Ch.5 SUPERSTAR
  ['bean_noodle',    'Black Bean Slurp',      'wave',      []],
  ['grape_bunch',    'Grape Pop',             'spotlight', ['look:hair_bunny_ears']],
  ['curry_rice',     'Curry Comfort',         'duet',      []],
  ['mango_sorbet',   'Mango Sorbet',          'superchat', ['look:outfit_star']],
  ['seafood_boil',   'Seafood Boil Mania',    'duet',      []],
  ['berry_tart',     'Berry Tart',            'gift',      ['look:acc_scarf']],
  ['choco_sundae',   'Sundae Supreme',        'spotlight', []],
  ['golden_parfait', 'Superstar Finale',      'duet',      ['look:hair_crown']],
  // Ch.6 MUKBANG LEGEND (encore chapter: rarer foods, funnier reactions)
  ['shroom_noodle',  'Forest Noodles',        'wave',      []],
  ['matcha_latte',   'Matcha Latte Art',      'spotlight', []],
  ['spicy_wings',    'Wing Challenge',        'superchat', []],
  ['mango_cubes',    'Mango Party',           'gift',      []],
  ['pasta',          'Creamy Pasta Twirl',    'duet',      []],
  ['choco_ramen',    'Chocolate Ramen?!',     'wave',      []],
  ['straw_plate',    'Strawberry Field',      'spotlight', []],
  ['mochi',          'Mochi Stretch',         'gift',      []],
  ['pickle_icecream','Pickle Ice Cream?!',    'superchat', []],
  ['berry_mix',      'Legend Finale',         'duet',      []]
];
const LEVEL_COUNT = RAW.length;

// viewer goal: 500 → ~2M (log curve), start = 30 %
function goalOf(n) { const g = 500 * Math.pow(4000, (n - 1) / (LEVEL_COUNT - 1)); const m = Math.pow(10, Math.max(1, Math.floor(Math.log10(g)) - 1)); return Math.round(g / m) * m; }
function roundTo(v) { const m = Math.pow(10, Math.max(1, Math.floor(Math.log10(v)) - 1)); return Math.round(v / m) * m; }

const LEVELS = [];
const seenTastes = {}, seenPacks = {}, seenSounds = {};
for (let i = 0; i < RAW.length; i++) {
  const r = RAW[i], n = i + 1, ch = Math.min(CHAPTERS.length - 1, Math.floor(i / PER_CHAPTER));
  const d = K.dish(r[0]); if (!d) throw new Error('levels: unknown food ' + r[0]);
  const pack = packOf(d);
  const goal = goalOf(n);
  // what is new in this stream (shown before / after it)
  const news = [];
  if (!seenPacks[pack]) { seenPacks[pack] = 1; if (n > 1) news.push('NEW PACKAGE: ' + PACK_INFO[pack].open); }
  if (!seenTastes[d.taste]) { seenTastes[d.taste] = 1; if (n > 1) news.push('NEW REACTION: ' + D.TASTES[d.taste].name.toUpperCase() + ' FACE'); }
  if (!seenSounds[d.sound]) { seenSounds[d.sound] = 1; if (n > 1) news.push('NEW ASMR SOUND'); }
  LEVELS.push({
    n: n, chapter: ch + 1, chapterName: CHAPTERS[ch].name, view: CHAPTERS[ch].view, bg: CHAPTERS[ch].view, loc: 'home',
    title: r[1], food: d.id, pack: pack, event: r[2], unlocks: r[3], news: news,
    goal: goal, goal3: roundTo(goal * 1.3), startViewers: roundTo(goal * 0.3),
    cpb: 6 + 2 * n // coins per bite
  });
}
function level(n) { return LEVELS[Math.max(1, Math.min(LEVEL_COUNT, n | 0)) - 1]; }

// ── optional activities (home screen) ──
// Each one ends in a single-food bonus stream; it never advances the level.
const MODES = [
  { id: 'market',   name: 'SUPERMARKET', short: 'SHOP',   unlock: 3,  color: '#ffd7a3', dark: '#f0a860' },
  { id: 'delivery', name: 'DELIVERY',    short: 'ORDER',  unlock: 7,  color: '#ff8fb3', dark: '#d85e8e' },
  { id: 'buffet',   name: 'BUFFET',      short: 'BUFFET', unlock: 11, color: '#ffb199', dark: '#c93b1d' },
  { id: 'kitchen',  name: 'COOKING',     short: 'COOK',   unlock: 15, color: '#9fe3c9', dark: '#5fbf9f' }
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

module.exports = { LEVELS, LEVEL_COUNT, CHAPTERS, PER_CHAPTER, EVENTS, PACK_INFO, MODES, modeOf, level, goalOf, packOf, sideConfig, unlockLevel };
