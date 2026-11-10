'use strict';
// V2 food catalogs — one per food source. Every food the stream can eat is
// a "dish" with the same shape, so the stream code never cares where it came from:
//   { id, src, group, name, taste, heat, tags[], bites, price, c1, c2, c3, shape, art, sprite }
// src:   'market' (supermarket, data.js FOODS) · 'delivery' · 'buffet' · 'kitchen' · 'mystery'
// shape: vector fallback drawer in art.js (dishVec) for foods without bitmap art yet
// art:   true when assets/food/<sprite || id>_<stage>.png exists (see docs/ART-REQUEST-V2.md)
const D = require('./data.js');

const TAG_OF_CAT = { noodles: ['noodle', 'slurpy'], snacks: ['crunchy'], drinks: ['drink'], cakes: ['dessert'], icecream: ['dessert', 'cold'], fruit: ['fruit'] };
const DISHES = {};
function add(d) { d.tags = d.tags || []; if (d.taste && d.tags.indexOf(d.taste) < 0) d.tags.push(d.taste); if (d.heat === undefined) d.heat = d.taste === 'spicy' ? 2 : 0; DISHES[d.id] = d; return d; }

// ── Supermarket: the 36 packaged foods from data.js (bitmap art exists) ──
for (let i = 0; i < D.FOODS.length; i++) {
  const f = D.FOODS[i], cat = D.CAT_BY_ID[f.cat];
  add({ id: f.id, src: 'market', group: f.cat, name: f.name, taste: f.taste, tags: TAG_OF_CAT[f.cat].slice(), bites: cat.bites, price: cat.price, c1: f.c1, c2: f.c2, c3: f.c3, label: f.label, v: f.v, cat: f.cat, shape: 'market', art: true, sound: cat.sound });
}

// ── Food Delivery: 5 fictional restaurants, mains + sides (no supermarket item here) ──
const RESTAURANTS = [
  { id: 'chicken_joy',  name: 'Chicken Joy',  color: '#ffb84d', dark: '#d6841a', unlock: 2,  icon: 'CJ', tab: 'CHICKEN', dish: 'kfc_chicken' },
  { id: 'mamma_pizza',  name: 'Mamma Pizza',  color: '#ff7a6b', dark: '#c93b2d', unlock: 8,  icon: 'MP', tab: 'PIZZA', dish: 'pizza' },
  { id: 'seoul_street', name: 'Seoul Street', color: '#ff8fb3', dark: '#d85e8e', unlock: 11, icon: 'SS', tab: 'KOREAN', dish: 'tteokbokki' },
  { id: 'tokyo_box',    name: 'Tokyo Box',    color: '#8fd1ff', dark: '#4a9fd8', unlock: 14, icon: 'TB', tab: 'SUSHI', dish: 'sushi_set' },
  { id: 'hot_boil',     name: 'Hot & Boil',   color: '#ff6b4a', dark: '#c93b1d', unlock: 19, icon: 'HB', tab: 'HOTPOT', dish: 'mini_hotpot' }
];
const MAINS = [
  ['kfc_chicken',  'chicken_joy',  'Korean Fried Chicken', 'savory', 0, ['crunchy', 'fried'], 5, 320, '#e8973a', '#ffd27a', '#b5651d', 'box'],
  ['cheese_burger','chicken_joy',  'Cheese Burger',        'savory', 0, ['fried'],            4, 280, '#e8a25a', '#ffd95e', '#7a4b2f', 'burger'],
  ['pizza',        'mamma_pizza',  'Pepperoni Pizza',      'savory', 0, ['cheesy'],           5, 360, '#ffcf6b', '#ff5a4a', '#d99a12', 'pizza'],
  ['pasta',        'mamma_pizza',  'Creamy Pasta',         'savory', 0, ['noodle', 'slurpy'], 4, 340, '#fff0c2', '#ffd27a', '#e0b52a', 'bowl'],
  ['tteokbokki',   'seoul_street', 'Tteokbokki',           'spicy',  2, ['chewy'],            4, 380, '#ff4a3a', '#ffe9d6', '#c93b1d', 'bowl'],
  ['dumplings',    'seoul_street', 'Dumplings',            'savory', 0, ['chewy'],            4, 330, '#fff4e0', '#f3dfc4', '#c9a27c', 'plate'],
  ['sushi_set',    'tokyo_box',    'Sushi Set',            'cold',   0, ['fresh'],            5, 450, '#ff8a65', '#ffffff', '#2f2f2f', 'tray'],
  ['curry_rice',   'tokyo_box',    'Curry Rice',           'spicy',  1, ['rice'],             4, 400, '#e8a23a', '#ffffff', '#b5651d', 'plate'],
  ['mini_hotpot',  'hot_boil',     'Mini Hotpot',          'spicy',  2, ['slurpy'],           5, 520, '#ff5a3a', '#ffd27a', '#c93b1d', 'pot'],
  ['seafood_boil', 'hot_boil',     'Seafood Boil',         'spicy',  3, ['messy'],            5, 600, '#ff7a4a', '#ffd27a', '#c93b1d', 'pot']
];
const SIDES = [
  ['cola',           'Cola',           'fizzy',  0, ['drink'],   2,  80, '#7a3d2f', '#ffffff', '#ff4a5f', 'cup'],
  ['fries',          'Fries',          'savory', 0, ['crunchy'], 2,  90, '#ffd95e', '#ff5a4a', '#e0b52a', 'fries'],
  ['cheese_sticks',  'Cheese Sticks',  'savory', 0, ['crunchy', 'cheesy'], 2, 110, '#ffc94d', '#fff0c2', '#d99a12', 'plate'],
  ['pickled_radish', 'Pickled Radish', 'sour',   0, ['fresh'],   2,  60, '#fff9b0', '#ffffff', '#d6c21a', 'bowl'],
  ['miso_soup',      'Miso Soup',      'savory', 0, ['drink'],   2,  90, '#d9b48a', '#9fd47a', '#a67a4a', 'bowl'],
  ['mochi',          'Mochi',          'sweet',  0, ['dessert', 'chewy'], 2, 120, '#ffd1e3', '#b7e3a1', '#fff', 'plate']
];
for (let i = 0; i < MAINS.length; i++) { const m = MAINS[i]; add({ id: m[0], src: 'delivery', group: m[1], kind: 'main', name: m[2], taste: m[3], heat: m[4], tags: m[5].slice(), bites: m[6], price: m[7], c1: m[8], c2: m[9], c3: m[10], shape: m[11], art: false, sound: m[5].indexOf('crunchy') >= 0 ? 'crunch' : m[5].indexOf('slurpy') >= 0 ? 'slurp' : 'bite' }); }
for (let i = 0; i < SIDES.length; i++) { const m = SIDES[i]; add({ id: m[0], src: 'delivery', group: 'sides', kind: 'side', name: m[1], taste: m[2], heat: m[3], tags: m[4].slice(), bites: m[5], price: m[6], c1: m[7], c2: m[8], c3: m[9], shape: m[10], art: false, sound: m[4].indexOf('drink') >= 0 ? 'gulp' : m[4].indexOf('crunchy') >= 0 ? 'crunch' : 'soft' }); }

// ── Buffet: stations of plated portions (the dessert bar reuses supermarket art) ──
const STATIONS = [
  { id: 'hot',     name: 'Hot Station',      color: '#ffb199', dark: '#c93b1d', unlock: 3 },
  { id: 'dessert', name: 'Dessert & Ice Bar', color: '#ffd1e3', dark: '#e8759a', unlock: 6 },
  { id: 'cold',    name: 'Sushi & Cold Bar', color: '#bfe9ff', dark: '#4a9fd8', unlock: 10 },
  { id: 'hotpot',  name: 'Hotpot Corner',    color: '#ffd27a', dark: '#c99b1a', unlock: 13 },
  { id: 'grill',   name: 'Grill Station',    color: '#f3c58b', dark: '#a67a4a', unlock: 17 }
  // { id: 'lava', … } Lava Spicy station hidden: its art is not finished (Codex foods V4 stopped at 276/304). Dishes stay defined for old saves.
];
const PORTIONS = {
  hot:    [['spicy_wings', 'Spicy Wings', 'spicy', 2, ['fried', 'crunchy'], '#ff5a3a', '#ffd27a', '#a8231a', 'plate'], ['kimchi_rice', 'Kimchi Fried Rice', 'spicy', 1, ['rice'], '#ff7a4a', '#fff0c2', '#c93b1d', 'bowl'], ['mapo_tofu', 'Mapo Tofu', 'spicy', 2, [], '#ff5a3a', '#fff4e0', '#a8231a', 'bowl'], ['fried_shrimp', 'Fried Shrimp', 'savory', 0, ['fried', 'crunchy'], '#ffb84d', '#ff8a65', '#d6841a', 'plate'], ['spring_rolls', 'Spring Rolls', 'savory', 0, ['crunchy'], '#f3c58b', '#9fd47a', '#c48a4a', 'plate'], ['iced_lemon_tea', 'Iced Lemon Tea', 'cold', 0, ['drink'], '#ffd95e', '#fff9d6', '#d6ad10', 'cup']],
  dessert: null, // filled below from the supermarket cakes + ice cream
  cold:   [['salmon_nigiri', 'Salmon Nigiri', 'cold', 0, ['fresh'], '#ff8a65', '#ffffff', '#2f2f2f', 'tray'], ['cold_soba', 'Cold Soba', 'cold', 0, ['noodle', 'slurpy'], '#b8a88a', '#bfe9ff', '#6b5a46', 'bowl'], ['tamago', 'Tamago', 'sweet', 0, [], '#ffe066', '#ffffff', '#d4ac1c', 'tray'], ['seaweed_salad', 'Seaweed Salad', 'sour', 0, ['fresh'], '#6fcf8e', '#ffffff', '#2f9c55', 'bowl'], ['ice_jelly', 'Ice Jelly', 'cold', 0, ['dessert'], '#bfe9ff', '#ffffff', '#4a9fd8', 'cup'], ['melon_slice', 'Melon Slice', 'sweet', 0, ['fruit', 'fresh'], '#9fe37a', '#ffb3a1', '#5fa23d', 'plate']],
  hotpot: [['beef_slices', 'Beef Slices', 'savory', 0, [], '#ff8a8a', '#ffffff', '#c94a4a', 'plate'], ['mushroom_mix', 'Mushroom Mix', 'savory', 0, [], '#d9b48a', '#f3dfc4', '#a67a4a', 'bowl'], ['fish_balls', 'Fish Balls', 'savory', 0, ['chewy'], '#fff4e0', '#ffd27a', '#c9a27c', 'skewer'], ['corn_cob', 'Corn Cob', 'sweet', 0, [], '#ffd95e', '#9fd47a', '#d4ac1c', 'plate'], ['udon_bowl', 'Udon Bowl', 'savory', 0, ['noodle', 'slurpy'], '#fff8e1', '#d9b48a', '#c9a27c', 'bowl'], ['spicy_broth', 'Spicy Broth', 'spicy', 2, ['drink', 'slurpy'], '#ff5a3a', '#ffd27a', '#a8231a', 'cup']],
  grill:  [['mini_steak', 'Mini Steak', 'savory', 0, [], '#a0522d', '#9fd47a', '#6b3a1e', 'plate'], ['yakitori', 'Yakitori', 'savory', 0, [], '#c97a3a', '#9fd47a', '#7a4b2f', 'skewer'], ['sausage', 'Sausage', 'savory', 0, [], '#e8735a', '#ffd95e', '#a8432d', 'skewer'], ['garlic_bread', 'Garlic Bread', 'savory', 0, ['crunchy'], '#ffd27a', '#9fd47a', '#c99b1a', 'plate'], ['grilled_squid', 'Grilled Squid', 'spicy', 1, ['chewy'], '#ffb199', '#ff5a3a', '#c96a4a', 'skewer'], ['sparkling_soda', 'Sparkling Soda', 'fizzy', 0, ['drink'], '#8fd1ff', '#ffffff', '#4a9fd8', 'cup']],
  lava:   [['ghost_wings', 'Ghost Pepper Wings', 'spicy', 3, ['fried', 'crunchy'], '#c9231a', '#ffd27a', '#7a1010', 'plate'], ['fire_noodles', 'Fire Noodles', 'spicy', 3, ['noodle', 'slurpy'], '#ff3a2a', '#ffd27a', '#a8231a', 'bowl'], ['lava_ricecake', 'Lava Rice Cake', 'spicy', 2, ['chewy'], '#ff4a3a', '#fff4e0', '#a8231a', 'skewer'], ['chili_dumplings', 'Chili Dumplings', 'spicy', 2, ['chewy'], '#ff8a6b', '#fff4e0', '#c93b1d', 'plate'], ['volcano_curry', 'Volcano Curry', 'spicy', 3, ['rice'], '#c94a1a', '#ffffff', '#7a2d10', 'plate'], ['milk_cooler', 'Milk Cooler', 'cold', 0, ['drink'], '#ffffff', '#ffd1e3', '#c9c9c9', 'cup']]
};
const STATION_ITEMS = {};
for (const st in PORTIONS) {
  if (!PORTIONS[st]) continue;
  STATION_ITEMS[st] = [];
  for (let i = 0; i < PORTIONS[st].length; i++) { const p = PORTIONS[st][i]; add({ id: p[0], src: 'buffet', group: st, name: p[1], taste: p[2], heat: p[3], tags: p[4].slice(), bites: 3, price: 0, c1: p[5], c2: p[6], c3: p[7], shape: p[8], art: false, sound: p[4].indexOf('crunchy') >= 0 ? 'crunch' : p[4].indexOf('drink') >= 0 ? 'gulp' : p[4].indexOf('slurpy') >= 0 ? 'slurp' : 'bite' }); STATION_ITEMS[st].push(p[0]); }
}
STATION_ITEMS.dessert = ['straw_cake', 'choco_mousse', 'rainbow_crepe', 'mint_choc', 'straw_swirl', 'mango_sorbet'];

// ── DIY Kitchen: recipes (prep steps) → finished dishes. Ramen / boba / cake reuse supermarket art. ──
// step types: rub (drag back and forth), tap (n taps), stir (circles), hold (keep pressed), drop (drag an ingredient in)
const RECIPES = [
  { id: 'decorate_cake', name: 'Decorate a Cake', unlock: 4, price: 220, dish: 'diy_cake', toppings: ['strawberry', 'blueberry', 'cream_swirl', 'sprinkles'],
    steps: [{ type: 'rub', text: 'Spread the cream!', need: 1400 }, { type: 'tap', text: 'Tap to add toppings!', n: 5 }, { type: 'rub', text: 'Shake on sprinkles!', need: 900 }] },
  { id: 'custom_ramen', name: 'Custom Ramen', unlock: 7, price: 240, dish: 'diy_ramen', toppings: ['egg', 'green_onion', 'cheese_slice', 'chili_flakes'],
    steps: [{ type: 'drop', text: 'Drop the noodles in!', n: 1 }, { type: 'stir', text: 'Stir it round!', need: 2 }, { type: 'tap', text: 'Add toppings!', n: 4 }] },
  { id: 'make_boba', name: 'Make My Boba', unlock: 9, price: 230, dish: 'diy_boba', toppings: ['pearls', 'cream_foam', 'strawberry_jelly', 'mango_jelly'],
    steps: [{ type: 'hold', text: 'Hold to pour the tea!', need: 1.4 }, { type: 'tap', text: 'Add the pearls!', n: 4 }, { type: 'rub', text: 'Shake it up!', need: 1200 }] },
  { id: 'rainbow_dessert', name: 'Rainbow Dessert', unlock: 15, price: 300, dish: 'diy_parfait', toppings: ['strawberry', 'kiwi', 'blueberry', 'sprinkles', 'cream_swirl'],
    steps: [{ type: 'tap', text: 'Stack 5 rainbow layers!', n: 5 }, { type: 'rub', text: 'Cream on top!', need: 1000 }, { type: 'tap', text: 'Decorate!', n: 3 }] },
  { id: 'party_plate', name: 'Party Plate', unlock: 18, price: 320, dish: 'diy_bento', toppings: ['tamagoyaki', 'karaage', 'broccoli', 'octo_sausage'],
    steps: [{ type: 'tap', text: 'Fill every box!', n: 5 }, { type: 'drop', text: 'Add the rice ball!', n: 1 }, { type: 'tap', text: 'Make it cute!', n: 3 }] },
  { id: 'surprise_dessert', name: 'Surprise Dessert', unlock: 23, price: 300, dish: 'mystery', toppings: ['sprinkles', 'cream_swirl', 'blueberry'],
    steps: [{ type: 'drop', text: 'Add the secret ingredient!', n: 2 }, { type: 'stir', text: 'Mix it!', need: 2 }, { type: 'hold', text: 'Hold to bake!', need: 1.6 }] },
  { id: 'crispy_fry', name: 'Crispy Fry', unlock: 27, price: 340, dish: 'diy_crispy', toppings: ['lemon', 'dip_sauce', 'chili_flakes'],
    steps: [{ type: 'drop', text: 'Dip in batter!', n: 2 }, { type: 'hold', text: 'Hold to fry!', need: 1.8 }, { type: 'rub', text: 'Shake off the oil!', need: 900 }] }
];
const RECIPE_BY_ID = {}; for (let i = 0; i < RECIPES.length; i++) RECIPE_BY_ID[RECIPES[i].id] = RECIPES[i];
const TOPPINGS = {
  strawberry: ['Strawberry', '#ff5a74', 25], blueberry: ['Blueberry', '#5b6fe0', 25], cream_swirl: ['Cream', '#fff8ef', 20], sprinkles: ['Sprinkles', '#ffd95e', 20], kiwi: ['Kiwi', '#9fe37a', 25],
  egg: ['Soft Egg', '#ffd95e', 30], green_onion: ['Green Onion', '#7ed37a', 20], cheese_slice: ['Cheese', '#ffc94d', 30], chili_flakes: ['Chili Flakes', '#ff4a3a', 20],
  pearls: ['Pearls', '#3d2f2f', 25], cream_foam: ['Cream Foam', '#fff8ef', 25], strawberry_jelly: ['Berry Jelly', '#ff7fa8', 30], mango_jelly: ['Mango Jelly', '#ffc83d', 30],
  tamagoyaki: ['Tamagoyaki', '#ffe066', 30], karaage: ['Karaage', '#d6841a', 35], broccoli: ['Broccoli', '#5fbf5a', 20], octo_sausage: ['Octo Sausage', '#ff7a6b', 30],
  lemon: ['Lemon', '#fff36b', 20], dip_sauce: ['Dip Sauce', '#c93b1d', 25]
};
// finished DIY dishes (diy_cake / diy_ramen / diy_boba use existing supermarket sprites)
add({ id: 'diy_cake',    src: 'kitchen', group: 'decorate_cake', name: 'My Decorated Cake', taste: 'sweet',  tags: ['dessert'],          bites: 4, price: 0, c1: '#fff5f7', c2: '#ff6f91', c3: '#f4b6c6', shape: 'market', cat: 'cakes', v: 0, art: true, sprite: 'straw_cake', sound: 'soft' });
add({ id: 'diy_ramen',   src: 'kitchen', group: 'custom_ramen',  name: 'My Custom Ramen',   taste: 'savory', tags: ['noodle', 'slurpy'], bites: 4, price: 0, c1: '#ffc94d', c2: '#ffe9a8', c3: '#d99a12', label: 'MINE', shape: 'market', cat: 'noodles', v: 1, art: true, sprite: 'cheese_noodle', sound: 'slurp' });
add({ id: 'diy_boba',    src: 'kitchen', group: 'make_boba',     name: 'My Boba',           taste: 'sweet',  tags: ['drink'],            bites: 3, price: 0, c1: '#c9a27c', c2: '#efe1d2', c3: '#8a6440', label: 'BOBA', shape: 'market', cat: 'drinks', v: 4, art: true, sprite: 'bubble_tea', sound: 'gulp' });
add({ id: 'diy_parfait', src: 'kitchen', group: 'rainbow_dessert', name: 'Rainbow Parfait', taste: 'sweet',  tags: ['dessert', 'cold'],  bites: 4, price: 0, c1: '#ff9ecf', c2: '#9fe3c9', c3: '#ffd95e', shape: 'parfait', art: false, sound: 'soft' });
add({ id: 'diy_bento',   src: 'kitchen', group: 'party_plate',   name: 'Party Bento',       taste: 'savory', tags: ['rice'],             bites: 5, price: 0, c1: '#ffffff', c2: '#ffe066', c3: '#ff7a6b', shape: 'bento', art: false, sound: 'bite' });
add({ id: 'diy_crispy',  src: 'kitchen', group: 'crispy_fry',    name: 'Crispy Tempura',    taste: 'savory', tags: ['fried', 'crunchy'], bites: 4, price: 0, c1: '#ffd27a', c2: '#fff4cf', c3: '#d6941e', shape: 'plate', art: false, sound: 'crunch' });

// ── Mystery box: authored outcome pools ──
add({ id: 'choco_ramen',     src: 'mystery', group: 'funny', name: 'Chocolate Ramen',  taste: 'sweet', tastes: ['sweet', 'savory'], tags: ['noodle', 'slurpy', 'funny'], bites: 3, price: 0, c1: '#6b4a37', c2: '#ffd27a', c3: '#3d2f2f', shape: 'bowl', art: false, sound: 'slurp' });
add({ id: 'pickle_icecream', src: 'mystery', group: 'funny', name: 'Pickle Ice Cream', taste: 'sour',  tastes: ['sour', 'cold'],    tags: ['dessert', 'cold', 'funny'], bites: 3, price: 0, c1: '#9fe37a', c2: '#fff8ef', c3: '#5fa23d', shape: 'cup', art: false, sound: 'lick' });
add({ id: 'wasabi_cake',     src: 'mystery', group: 'funny', name: 'Wasabi Cake',      taste: 'spicy', tastes: ['spicy', 'sweet'],  tags: ['dessert', 'funny'], heat: 2, bites: 3, price: 0, c1: '#b7e3a1', c2: '#fff8ef', c3: '#5fa23d', shape: 'plate', art: false, sound: 'soft' });
add({ id: 'golden_parfait',  src: 'mystery', group: 'rare',  name: 'Golden Parfait',   taste: 'sweet', tags: ['dessert', 'rare'], bites: 3, price: 0, c1: '#ffd95e', c2: '#fff8ef', c3: '#d6940e', shape: 'parfait', art: false, sound: 'soft' });
const MYSTERY = {
  // kind → candidate dish ids (Delicious draws from the level's own pool at run time)
  spicy: ['spicy_wings', 'mapo_tofu', 'chili_noodle', 'tteokbokki'],
  frozen: ['blue_moon', 'mint_choc', 'ice_jelly', 'mango_sorbet'],
  rare: ['golden_parfait', 'rainbow_crepe', 'straw_cake'],
  funny: ['choco_ramen', 'pickle_icecream', 'wasabi_cake'],
  weights: [['delicious', 45], ['spicy', 20], ['frozen', 15], ['rare', 12], ['funny', 8]]
};

function dish(id) { return DISHES[id] || null; }
function restaurant(id) { for (let i = 0; i < RESTAURANTS.length; i++) if (RESTAURANTS[i].id === id) return RESTAURANTS[i]; return null; }
function station(id) { for (let i = 0; i < STATIONS.length; i++) if (STATIONS[i].id === id) return STATIONS[i]; return null; }
function mainsOf(rest) { const out = []; for (const k in DISHES) if (DISHES[k].src === 'delivery' && DISHES[k].group === rest) out.push(DISHES[k]); return out; }
function sides() { const out = []; for (const k in DISHES) if (DISHES[k].kind === 'side') out.push(DISHES[k]); return out; }
function stationItems(st) { return (STATION_ITEMS[st] || []).map(dish); }

// Request tags the chat can ask for, with the line it shows.
const REQUESTS = {
  spicy: 'EAT THE SPICY ONE!', cold: 'TRY SOMETHING COLD!', sweet: 'SWEET TIME!', sour: 'SOMETHING SOUR!',
  crunchy: 'WE WANT CRUNCHY!', drink: 'DRINK SOMETHING!', noodle: 'NOODLE SLURP!', dessert: 'DESSERT NOW!', fried: 'FRIED FOOD PLS!', chewy: 'SOMETHING CHEWY!'
};

module.exports = { DISHES, dish, RESTAURANTS, restaurant, mainsOf, sides, STATIONS, station, stationItems, STATION_ITEMS, RECIPES, RECIPE_BY_ID, TOPPINGS, MYSTERY, REQUESTS };
