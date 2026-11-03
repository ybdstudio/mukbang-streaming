'use strict';
// All game content: food catalogue, categories, tastes, levels, streamers,
// backgrounds and the live-chat lines. Pure data — no platform calls.

// How a taste changes the stream: hype multiplier, the streamer's face, a chat flavour.
const TASTES = {
  savory: { mult: 1.0,  face: 'chew',  name: 'Savory' },
  spicy:  { mult: 1.6,  face: 'spicy', name: 'Spicy' },
  sweet:  { mult: 1.15, face: 'sweet', name: 'Sweet' },
  cold:   { mult: 1.4,  face: 'cold',  name: 'Cold' },
  fizzy:  { mult: 1.25, face: 'fizzy', name: 'Fizzy' },
  sour:   { mult: 1.3,  face: 'sour',  name: 'Sour' }
};

// Categories = shelves in the supermarket. `unlock` = the level that opens the shelf.
const CATS = [
  { id: 'noodles',  name: 'NOODLES',   unlock: 1, price: 200, bites: 4, sound: 'slurp',  color: '#ffd7a3', dark: '#f0a860' },
  { id: 'snacks',   name: 'SNACKS',    unlock: 1, price: 150, bites: 3, sound: 'crunch', color: '#ffe08a', dark: '#f2b544' },
  { id: 'drinks',   name: 'DRINKS',    unlock: 2, price: 150, bites: 3, sound: 'gulp',   color: '#bfe9ff', dark: '#6fc3ef' },
  { id: 'cakes',    name: 'CAKES',     unlock: 4, price: 300, bites: 4, sound: 'soft',   color: '#ffd1e3', dark: '#f58cb3' },
  { id: 'icecream', name: 'ICE CREAM', unlock: 6, price: 250, bites: 3, sound: 'lick',   color: '#d9d4ff', dark: '#9f93f0' },
  { id: 'fruit',    name: 'FRUIT',     unlock: 9, price: 200, bites: 3, sound: 'bite',   color: '#c9f2c0', dark: '#7ed37a' }
];

// 36 foods: 6 per shelf. c1/c2/c3 = palette for the drawer in art.js, `v` = variant shape.
const FOODS = [
  // noodles (cup)
  { id: 'chili_noodle',   cat: 'noodles', name: 'Chili Noodle',   taste: 'spicy',  c1: '#ff6b4a', c2: '#ffb199', c3: '#c93b1d', label: 'CHILI',  v: 0 },
  { id: 'cheese_noodle',  cat: 'noodles', name: 'Cheese Noodle',  taste: 'savory', c1: '#ffc94d', c2: '#ffe9a8', c3: '#d99a12', label: 'CHEESE', v: 1 },
  { id: 'shroom_noodle',  cat: 'noodles', name: 'Mushroom Noodle', taste: 'savory', c1: '#d9b48a', c2: '#f3dfc4', c3: '#a67a4a', label: 'SHROOM', v: 2 },
  { id: 'sakura_noodle',  cat: 'noodles', name: 'Sakura Noodle',  taste: 'sweet',  c1: '#ff9fc4', c2: '#ffd6e6', c3: '#d85e8e', label: 'SAKURA', v: 3 },
  { id: 'sea_noodle',     cat: 'noodles', name: 'Seafood Noodle', taste: 'savory', c1: '#6fc9e8', c2: '#c4ecf7', c3: '#2f8cb0', label: 'OCEAN',  v: 4 },
  { id: 'bean_noodle',    cat: 'noodles', name: 'Black Bean Noodle', taste: 'savory', c1: '#6b5a66', c2: '#b8a8b3', c3: '#3d2f3a', label: 'BEAN',  v: 5 },
  // snacks (bag)
  { id: 'cat_chips',      cat: 'snacks', name: 'Cat Chips',       taste: 'savory', c1: '#ffb84d', c2: '#fff0c2', c3: '#d6841a', label: 'CHIPS',  v: 0 },
  { id: 'rainbow_candy',  cat: 'snacks', name: 'Rainbow Candy',   taste: 'sweet',  c1: '#8fd4ff', c2: '#ffffff', c3: '#4a9fd8', label: 'CANDY',  v: 1 },
  { id: 'honey_puffs',    cat: 'snacks', name: 'Honey Puffs',     taste: 'sweet',  c1: '#ffd36b', c2: '#fff4cf', c3: '#d39a1f', label: 'PUFFS',  v: 2 },
  { id: 'seaweed_crisps', cat: 'snacks', name: 'Seaweed Crisps',  taste: 'savory', c1: '#6fcf8e', c2: '#d4f5de', c3: '#2f9c55', label: 'CRISPS', v: 3 },
  { id: 'choco_pretzel',  cat: 'snacks', name: 'Choco Pretzels',  taste: 'sweet',  c1: '#b57c5a', c2: '#f0d9c8', c3: '#7a4b2f', label: 'PRETZ',  v: 4 },
  { id: 'gummy_bears',    cat: 'snacks', name: 'Gummy Bears',     taste: 'sour',   c1: '#ff7fa8', c2: '#ffe0eb', c3: '#d84a7b', label: 'GUMMY',  v: 5 },
  // drinks (bottle / carton / cup)
  { id: 'peach_milk',     cat: 'drinks', name: 'Peach Milk',      taste: 'sweet',  c1: '#ffb3c7', c2: '#fff0f4', c3: '#e8759a', label: 'PEACH',  v: 0 },
  { id: 'banana_milk',    cat: 'drinks', name: 'Banana Milk',     taste: 'sweet',  c1: '#ffe066', c2: '#fff9d6', c3: '#d4ac1c', label: 'NANA',   v: 1 },
  { id: 'matcha_latte',   cat: 'drinks', name: 'Matcha Latte',    taste: 'savory', c1: '#9ed47a', c2: '#e9f7dc', c3: '#5fa23d', label: 'MATCHA', v: 2 },
  { id: 'soda_pop',       cat: 'drinks', name: 'Soda Pop',        taste: 'fizzy',  c1: '#ff6f91', c2: '#ffd9e2', c3: '#d13d63', label: 'SODA',   v: 3 },
  { id: 'bubble_tea',     cat: 'drinks', name: 'Bubble Tea',      taste: 'sweet',  c1: '#c9a27c', c2: '#efe1d2', c3: '#8a6440', label: 'BOBA',   v: 4 },
  { id: 'berry_smoothie', cat: 'drinks', name: 'Berry Smoothie',  taste: 'sour',   c1: '#b878e8', c2: '#ecdcfa', c3: '#7a3fb3', label: 'BERRY',  v: 5 },
  // cakes (slice on plate)
  { id: 'straw_cake',     cat: 'cakes', name: 'Strawberry Cake',  taste: 'sweet',  c1: '#fff5f7', c2: '#ff6f91', c3: '#f4b6c6', label: '', v: 0 },
  { id: 'matcha_roll',    cat: 'cakes', name: 'Matcha Roll',      taste: 'sweet',  c1: '#b7e3a1', c2: '#fff8e1', c3: '#78b85e', label: '', v: 1 },
  { id: 'choco_mousse',   cat: 'cakes', name: 'Choco Mousse',     taste: 'sweet',  c1: '#8a5a3c', c2: '#d9a877', c3: '#5a3622', label: '', v: 2 },
  { id: 'mango_cheese',   cat: 'cakes', name: 'Mango Cheesecake', taste: 'sour',   c1: '#ffd16b', c2: '#fff4d0', c3: '#e2a21a', label: '', v: 3 },
  { id: 'berry_tart',     cat: 'cakes', name: 'Berry Tart',       taste: 'sour',   c1: '#f3c58b', c2: '#7a4fb8', c3: '#c48a4a', label: '', v: 4 },
  { id: 'rainbow_crepe',  cat: 'cakes', name: 'Rainbow Crepe',    taste: 'sweet',  c1: '#fff', c2: '#ff9ecf', c3: '#ffc36b', label: '', v: 5 },
  // ice cream (cup / cone)
  { id: 'mint_choc',      cat: 'icecream', name: 'Mint Choc',     taste: 'cold',   c1: '#a8ecd5', c2: '#6b4a37', c3: '#5ac79f', label: 'MINT',   v: 0 },
  { id: 'choco_sundae',   cat: 'icecream', name: 'Choco Sundae',  taste: 'cold',   c1: '#8a5a3c', c2: '#fff', c3: '#5a3622', label: 'CHOCO', v: 1 },
  { id: 'straw_swirl',    cat: 'icecream', name: 'Strawberry Swirl', taste: 'cold', c1: '#ffb3c7', c2: '#fff0f4', c3: '#e8759a', label: 'BERRY', v: 2 },
  { id: 'mango_sorbet',   cat: 'icecream', name: 'Mango Sorbet',  taste: 'cold',   c1: '#ffcf5c', c2: '#fff4cf', c3: '#e0a21a', label: 'MANGO', v: 3 },
  { id: 'cookie_cream',   cat: 'icecream', name: 'Cookie Cream',  taste: 'cold',   c1: '#f3f3f3', c2: '#3b2f2f', c3: '#c9c9c9', label: 'COOKIE', v: 4 },
  { id: 'blue_moon',      cat: 'icecream', name: 'Blue Moon',     taste: 'cold',   c1: '#8fd1ff', c2: '#ffffff', c3: '#4a9fd8', label: 'MOON',   v: 5 },
  // fruit (bowl / plate)
  { id: 'melon_bowl',     cat: 'fruit', name: 'Melon Jelly Bowl', taste: 'sweet',  c1: '#ff6f7d', c2: '#7ed37a', c3: '#2f2f2f', label: '', v: 0 },
  { id: 'straw_plate',    cat: 'fruit', name: 'Strawberry Plate', taste: 'sour',   c1: '#ff5a74', c2: '#ffffff', c3: '#5fbf5a', label: '', v: 1 },
  { id: 'mango_cubes',    cat: 'fruit', name: 'Mango Cubes',      taste: 'sweet',  c1: '#ffc83d', c2: '#fff6d8', c3: '#e39a10', label: '', v: 2 },
  { id: 'grape_bunch',    cat: 'fruit', name: 'Grape Bunch',      taste: 'sour',   c1: '#a66ee6', c2: '#ffffff', c3: '#6a3fa8', label: '', v: 3 },
  { id: 'pine_sticks',    cat: 'fruit', name: 'Pineapple Sticks', taste: 'sour',   c1: '#ffd84a', c2: '#fff7cf', c3: '#d6ad10', label: '', v: 4 },
  { id: 'berry_mix',      cat: 'fruit', name: 'Berry Mix',        taste: 'sweet',  c1: '#5b6fe0', c2: '#ffffff', c3: '#ff5a74', label: '', v: 5 }
];
const FOOD_BY_ID = {}; for (let i = 0; i < FOODS.length; i++) FOOD_BY_ID[FOODS[i].id] = FOODS[i];
const CAT_BY_ID = {}; for (let i = 0; i < CATS.length; i++) CAT_BY_ID[CATS[i].id] = CATS[i];
function foodsOf(catId) { const out = []; for (let i = 0; i < FOODS.length; i++) if (FOODS[i].cat === catId) out.push(FOODS[i]); return out; }
function priceOf(food) { return CAT_BY_ID[food.cat].price; }
function bitesOf(food) { return CAT_BY_ID[food.cat].bites; }
// Per bite: viewers gained and coins earned. Spend S on an item → earn about 1.8·S·tasteMult back.
function hypePerBite(food) { return Math.round(priceOf(food) * 0.6 * TASTES[food.taste].mult); }
function coinsPerBite(food) { return Math.round(priceOf(food) * 1.8 * TASTES[food.taste].mult / bitesOf(food)); }

// ─── levels ───
const LEVEL_COUNT = 30;
const BACKGROUNDS = [
  { id: 'park',   name: 'Sunny Park',    cloth: '#bfe9ff', clothDark: '#8fd3f5', table: '#8fd3f5' },
  { id: 'beach',  name: 'Sunset Beach',  cloth: '#ffe0ea', clothDark: '#ffbfd3', table: '#ffbfd3' },
  { id: 'sakura', name: 'Sakura River',  cloth: '#e3d7ff', clothDark: '#c8b5ff', table: '#c8b5ff' },
  { id: 'room',   name: 'Cozy Room',     cloth: '#fff0c2', clothDark: '#ffd98a', table: '#ffd98a' },
  { id: 'city',   name: 'Neon City',     cloth: '#d4f5de', clothDark: '#9fe3b4', table: '#9fe3b4' }
];
function basketSize(n) { return n <= 3 ? 3 : n <= 8 ? 4 : n <= 15 ? 5 : 6; }
function level(n) {
  n = Math.max(1, Math.min(LEVEL_COUNT, n | 0));
  const basket = basketSize(n);
  const cats = []; for (let i = 0; i < CATS.length; i++) if (CATS[i].unlock <= n) cats.push(CATS[i].id);
  const startViewers = 400 + n * 300;
  const goal = Math.round((startViewers + basket * 520) / 100) * 100;
  return { n: n, basket: basket, bg: Math.floor((n - 1) / 6) % BACKGROUNDS.length, cats: cats, startViewers: startViewers, goal: goal, goal3: Math.round(goal * 1.35 / 100) * 100 };
}
// A shelf unlocked exactly at this level (for the "NEW SHELF" toast), or null.
function newShelfAt(n) { for (let i = 0; i < CATS.length; i++) if (CATS[i].unlock === n) return CATS[i]; return null; }

// ─── streamers ───
const STREAMERS = [
  { id: 'luna', name: 'Luna', unlock: 1,  hair: '#cdb0ff', hairDark: '#a98ae6', skin: '#ffe6d6', top: '#9fe3c9', topDark: '#5fbf9f', style: 'buns',  acc: 'bow',   accColor: '#ff7fa8', eye: '#4a3340' },
  { id: 'kiko', name: 'Kiko', unlock: 10,  hair: '#ffa552', hairDark: '#e07f2a', skin: '#ffe3cf', top: '#ffd95e', topDark: '#e0b52a', style: 'bob',   acc: 'star',  accColor: '#ffe066', eye: '#3d2b2b' },
  { id: 'momo', name: 'Momo', unlock: 20, hair: '#4f5fae', hairDark: '#36427f', skin: '#ffe9dc', top: '#ffb3c7', topDark: '#e8759a', style: 'long',  acc: 'beret', accColor: '#b878e8', eye: '#2f2f4a' }
];

// ─── live chat ───
const AVATARS = ['cat', 'dog', 'bunny', 'duck', 'bear', 'frog', 'pig'];
const CHAT = {
  idle: [
    'I can hear it from here!', 'okay now I am hungry', 'save some for me!!', 'ASMR level 100',
    'my stomach is growling', 'first time here, love it', 'best stream ever', 'I need this recipe',
    'share a bite pls', 'the sound!!!', 'you make it look so good', 'sending hearts!!',
    'eat the spicy one!!', 'legend', 'chef\'s kiss', 'that bite was perfect', 'hello from Korea!',
    'can you do a crunch sound', 'I just ate but I want more', 'this is my dinner now'
  ],
  bite: ['that crunch tho', 'did you just inhale that', 'mmm that looks amazing', 'one more bite!!', 'perfect bite', 'the slurp!!', 'I felt that', 'so satisfying'],
  spicy: ['is it spicy?!', 'FIRE FIRE FIRE', 'drink some milk!!', 'your face lol', 'too hot too hot', 'spicy queen'],
  cold: ['brain freeze incoming', 'brrrrr', 'so cold so good', 'ice ice baby', 'cold but worth it'],
  sweet: ['so sweet so cute', 'sugar rush!', 'that frosting!!', 'sweet tooth activated', 'cute AND tasty'],
  fizzy: ['the fizz!!', 'bubbles everywhere', 'did it tickle your nose', 'pop pop pop'],
  sour: ['that face lol', 'sour power', 'my cheeks hurt just watching', 'pucker up!'],
  savory: ['umami overload', 'noodle time!!', 'the broth looks so rich', 'that cheese pull'],
  finish: ['another one!!', 'all gone already?!', 'clean plate club', 'nothing left wow'],
  milestone: ['we hit {n} viewers!!', '{n} people watching!', 'tell your friends, {n} strong', 'trending at {n}!']
};
const MILESTONES = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000];

const COLORS = {
  outline: '#5b3d3b', cream: '#fff8ef', pink: '#ff9fc4', pinkDark: '#e8759a', mint: '#9fe3c9', mintDark: '#5fbf9f',
  yellow: '#ffd95e', yellowDark: '#e0b52a', blue: '#8fd1ff', blueDark: '#4a9fd8', lavender: '#cdb0ff', lavenderDark: '#a98ae6',
  red: '#ff5a74', green: '#7ed37a', greenDark: '#4daa4a', white: '#ffffff', text: '#5b3d3b', textLight: '#8a6d6b', gold: '#ffc83d', goldDark: '#d6940e'
};

module.exports = { TASTES, CATS, FOODS, FOOD_BY_ID, CAT_BY_ID, foodsOf, priceOf, bitesOf, hypePerBite, coinsPerBite, LEVEL_COUNT, BACKGROUNDS, level, basketSize, newShelfAt, STREAMERS, AVATARS, CHAT, MILESTONES, COLORS };
