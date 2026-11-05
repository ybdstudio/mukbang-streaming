'use strict';
// Bitmap art (assets/, made from docs/ART-REQUEST.md). Images load lazily the
// first time they are asked for; until an image has loaded, `get()` returns
// null and art.js draws its canvas fallback. All rectangles and anchors below
// are in 2x image pixels, copied from assets/manifest.json.
// Backgrounds are big (1080x2400), so only the two most recently used stay in memory.

const ROOT = 'assets/';
const BG_KEEP = 2;

let platform = null;
const imgs = {};      // path → loaded image
const asked = {};     // path → true once a load was started
let bgOrder = [];     // background paths, most recent last

function init(p) { platform = p && typeof p.loadImage === 'function' ? p : null; }
function enabled() { return !!platform; }

function request(path) {
  if (!platform || asked[path]) return;
  asked[path] = true;
  platform.loadImage(ROOT + path, function (im) { if (im && im.width) imgs[path] = im; else if (!im) asked[path] = 'failed'; });
}
// image if loaded, else null (and start loading it)
function get(path) {
  const im = imgs[path];
  if (im) return im;
  request(path);
  return null;
}
// background: same as get, plus eviction of older backgrounds
function getBg(path) {
  const i = bgOrder.indexOf(path);
  if (i !== bgOrder.length - 1) {
    if (i >= 0) bgOrder.splice(i, 1);
    bgOrder.push(path);
    while (bgOrder.length > BG_KEEP) { const old = bgOrder.shift(); delete imgs[old]; delete asked[old]; }
  }
  return get(path);
}
// Start loading everything small so the first screens do not flicker.
function preload() {
  if (!platform) return;
  const list = ['streamer/face_parts.png', 'ui/icons.png', 'ui/reactions.png', 'ui/avatars.png', 'ui/logo.png', 'ui/phone_stick.png',
    'store/shelf_board.png', 'store/basket.png', 'store/checkout_machine.png', 'store/conveyor.png', 'store/cashier_bear.png'];
  for (const id in STREAMERS) { list.push(STREAMERS[id].head, STREAMERS[id].body); }
  for (let i = 0; i < list.length; i++) request(list[i]);
}
function preloadFoods(foods) { for (let i = 0; i < foods.length; i++) { const f = foods[i]; for (let s = 0; s < f.bites; s++) request(foodPath(f.id, s)); } }

// ─── data from manifest.json ───
const FOOD_SIZE = 256;
function foodPath(id, stage) { return 'food/' + id + '_' + stage + '.png'; }

const STREAMERS = {
  luna: { head: 'streamer/luna_head.png', body: 'streamer/luna_body.png', headAnchor: [256, 350], neckOnHead: [256, 465], bodyAnchor: [256, 44], faceRadius: 160, mouth: [256, 408], eyes: [256, 320] },
  kiko: { head: 'streamer/kiko_head.png', body: 'streamer/kiko_body.png', headAnchor: [256, 350], neckOnHead: [256, 465], bodyAnchor: [256, 43], faceRadius: 160, mouth: [256, 408], eyes: [256, 320] },
  momo: { head: 'streamer/momo_head.png', body: 'streamer/momo_body.png', headAnchor: [256, 281], neckOnHead: [256, 386], bodyAnchor: [256, 43], faceRadius: 160, mouth: [256, 348], eyes: [256, 260] }
};
// face_parts.png: 4 columns x 5 rows of 240x120 cells. `at` = where the cell centre sits on Luna's head.
const FACE_IMG = 'streamer/face_parts.png';
const FACE_EYES_AT = [256, 320], FACE_MOUTH_AT = [256, 408], FACE_FX_AT = [420, 300];
const FACE = (function () {
  const names = ['eyes_open', 'eyes_blink', 'eyes_happy', 'eyes_x', 'eyes_squiggle', 'eyes_heart', 'eyes_wide', 'eyes_squint',
    'mouth_idle', 'mouth_open', 'mouth_chew_a', 'mouth_chew_b', 'mouth_yum', 'mouth_spicy', 'mouth_cold', 'mouth_sweet',
    'mouth_fizzy', 'mouth_sour', 'fx_sweat', 'fx_frost'];
  const out = {}; for (let i = 0; i < names.length; i++) out[names[i]] = { x: (i % 4) * 240, y: Math.floor(i / 4) * 120, w: 240, h: 120 };
  return out;
})();
// expression → eyes, mouth, optional fx
const EXPR = {
  idle: ['eyes_open', 'mouth_idle'], open: ['eyes_open', 'mouth_open'], chew: ['eyes_happy', 'mouth_chew_a'], yum: ['eyes_happy', 'mouth_yum'],
  spicy: ['eyes_x', 'mouth_spicy', 'fx_sweat'], cold: ['eyes_squiggle', 'mouth_cold', 'fx_frost'], sweet: ['eyes_heart', 'mouth_sweet'],
  fizzy: ['eyes_wide', 'mouth_fizzy'], sour: ['eyes_squint', 'mouth_sour']
};
// image px → logical units for a streamer drawn at scale 1 (face radius 160 px → 80)
const STREAMER_K = 0.5;

function grid(cell, cols, names) { const out = {}; for (let i = 0; i < names.length; i++) out[names[i]] = { x: (i % cols) * cell, y: Math.floor(i / cols) * cell, w: cell, h: cell }; return out; }
const ICONS = { image: 'ui/icons.png', frames: grid(96, 4, ['coin', 'star_on', 'star_off', 'heart', 'lock', 'eye', 'plus_coin']) };
const REACTIONS = { image: 'ui/reactions.png', frames: grid(64, 4, ['heart', 'like', 'star', 'laugh', 'love', 'cool', 'smile']) };
const AVATARS = { image: 'ui/avatars.png', frames: grid(72, 4, ['cat', 'dog', 'bunny', 'duck', 'bear', 'frog', 'pig']) };

const STORE = {
  bg: 'store/store_bg.jpg', shelf: 'store/shelf_board.png', cashier: 'store/cashier_bear.png',
  basket: { image: 'store/basket.png', w: 360, h: 200, rim: [76, 283], anchor: [180, 64] },
  machine: { image: 'store/checkout_machine.png', w: 864, h: 920, screen: [136, 248, 592, 352], slot: [256, 715, 352, 80] },
  conveyor: { image: 'store/conveyor.png', w: 1000, h: 240, slice: [40, 40, 920, 160] }
};
const UI = { logo: { image: 'ui/logo.png', w: 900, h: 420 }, phone: { image: 'ui/phone_stick.png', w: 200, h: 360, anchor: [100, 350] } };
const BG_W = 1080, BG_H = 2400;

// ─── art V4 (docs/ART-REQUEST-V4.md; delivered files only — anything else keeps the vector fallback) ───
// Small art lives in the main package (assets/), the big cooking layers in the TikTok subpackage "art4"
// (game.json → subpackages). Subpackage files are loaded on first need; until then: vector fallback.
const V4 = {};
['features/market.png', 'features/delivery.png', 'features/buffet.png', 'features/wardrobe.png', 'features/lock.png',
  'cook/deco_cocoa.png',
  'cook/deco_gold.png',
  'cook/deco_hearts.png',
  'cook/deco_pearls_d.png',
  'cook/deco_snow.png',
  'cook/deco_sprinkles.png',
  'cook/deco_stars.png',
  'cook/opt_boba_top_jelly_cubes.png',
  'cook/opt_boba_top_pearls.png',
  'cook/opt_boba_top_popping.png',
  'cook/opt_boba_top_pudding_t.png',
  'cook/opt_boba_top_red_bean.png',
  'cook/opt_broth_creamy.png',
  'cook/opt_broth_curry.png',
  'cook/opt_broth_miso.png',
  'cook/opt_broth_shoyu.png',
  'cook/opt_broth_spicy.png',
  'cook/opt_deco_cocoa.png',
  'cook/opt_deco_gold.png',
  'cook/opt_deco_hearts.png',
  'cook/opt_deco_pearls_d.png',
  'cook/opt_deco_snow.png',
  'cook/opt_deco_sprinkles.png',
  'cook/opt_deco_stars.png',
  'cook/opt_flavor_blueberry.png',
  'cook/opt_flavor_chocolate.png',
  'cook/opt_flavor_grape.png',
  'cook/opt_flavor_lemon.png',
  'cook/opt_flavor_mango.png',
  'cook/opt_flavor_matcha.png',
  'cook/opt_flavor_milk.png',
  'cook/opt_flavor_peach.png',
  'cook/opt_flavor_sakura.png',
  'cook/opt_flavor_soda.png',
  'cook/opt_flavor_strawberry.png',
  'cook/opt_mold_bunny.png',
  'cook/opt_mold_crown.png',
  'cook/opt_mold_dome.png',
  'cook/opt_mold_flower.png',
  'cook/opt_mold_heart.png',
  'cook/opt_mold_star.png',
  'cook/opt_ramen_top_chashu.png',
  'cook/opt_ramen_top_corn.png',
  'cook/opt_ramen_top_egg.png',
  'cook/opt_ramen_top_naruto.png',
  'cook/opt_ramen_top_nori.png',
  'cook/opt_ramen_top_scallion.png',
  'cook/opt_topping_blueberry_t.png',
  'cook/opt_topping_cherry.png',
  'cook/opt_topping_choco_stick.png',
  'cook/opt_topping_cream.png',
  'cook/opt_topping_gold_star.png',
  'cook/opt_topping_kiwi.png',
  'cook/opt_topping_mint.png',
  'cook/opt_topping_mochi.png',
  'cook/opt_topping_peach_t.png',
  'cook/opt_topping_sakura_t.png',
  'cook/opt_topping_strawberry_t.png',
  'cook/tool_bottle_pour_0.png',
  'cook/tool_bottle_pour_1.png',
  'cook/tool_bottle_pour_fill.png',
  'cook/tool_fan_0.png',
  'cook/tool_fan_1.png',
  'cook/tool_fire_0.png',
  'cook/tool_fire_1.png',
  'cook/tool_mixer_0.png',
  'cook/tool_mixer_1.png',
  'cook/tool_oven_0.png',
  'cook/tool_oven_1.png',
  'cook/tool_shaker_0.png',
  'cook/tool_shaker_1.png',
  'cook/tool_shaver_0.png',
  'cook/tool_shaver_1.png',
  'cook/top_blueberry_t.png',
  'cook/top_chashu.png',
  'cook/top_cherry.png',
  'cook/top_choco_stick.png',
  'cook/top_corn.png',
  'cook/top_cream.png',
  'cook/top_egg.png',
  'cook/top_gold_star.png',
  'cook/top_jelly_cubes.png',
  'cook/top_kiwi.png',
  'cook/top_mint.png',
  'cook/top_mochi.png',
  'cook/top_naruto.png',
  'cook/top_nori.png',
  'cook/top_peach_t.png',
  'cook/top_pearls.png',
  'cook/top_popping.png',
  'cook/top_pudding_t.png',
  'cook/top_red_bean.png',
  'cook/top_sakura_t.png',
  'cook/top_scallion.png',
  'cook/top_strawberry_t.png'
].forEach(function (p) { V4[p] = 'main'; });
[  'cook/bg_kitchen.jpg',
  'cook/jelly_bunny_detail.png',
  'cook/jelly_bunny_fill.png',
  'cook/jelly_bunny_out_detail.png',
  'cook/jelly_bunny_out_fill.png',
  'cook/jelly_crown_detail.png',
  'cook/jelly_crown_fill.png',
  'cook/jelly_crown_out_detail.png',
  'cook/jelly_crown_out_fill.png',
  'cook/jelly_dome_detail.png',
  'cook/jelly_dome_fill.png',
  'cook/jelly_dome_out_detail.png',
  'cook/jelly_dome_out_fill.png',
  'cook/jelly_flower_detail.png',
  'cook/jelly_flower_fill.png',
  'cook/jelly_flower_out_detail.png',
  'cook/jelly_flower_out_fill.png',
  'cook/jelly_heart_detail.png',
  'cook/jelly_heart_fill.png',
  'cook/jelly_heart_out_detail.png',
  'cook/jelly_heart_out_fill.png',
  'cook/jelly_star_detail.png',
  'cook/jelly_star_fill.png',
  'cook/jelly_star_out_detail.png',
  'cook/jelly_star_out_fill.png',
  'cook/mold_bunny.png',
  'cook/mold_crown.png',
  'cook/mold_dome.png',
  'cook/mold_flower.png',
  'cook/mold_heart.png',
  'cook/mold_star.png'
].forEach(function (p) { V4[p] = 'art4'; });
const SUB_ROOT = { art4: 'art4/' };
const sub = {};     // name → 'loading' | 'ok' | 'fail'
function subReady(name) {
  if (sub[name] === 'ok') return true;
  if (!sub[name] && platform) {
    if (typeof platform.loadSubpackage !== 'function') sub[name] = 'ok';
    else { sub[name] = 'loading'; platform.loadSubpackage(name, function (ok) { sub[name] = ok ? 'ok' : 'fail'; }); }
  }
  return sub[name] === 'ok';
}
function v4(path) {
  const pkg = V4[path]; if (!pkg) return null;
  if (pkg === 'main') return get(path);
  if (!subReady(pkg)) return null;
  const key = SUB_ROOT[pkg] + path; const im = imgs[key]; if (im) return im;
  if (platform && !asked[key]) { asked[key] = true; platform.loadImage(key, function (m) { if (m && m.width) imgs[key] = m; }); }
  return null;
}
// draw a V4 sprite centred at (x, y), `size` logical units wide; false if not (yet) available
function v4draw(ctx, path, x, y, size) { const im = v4(path); if (!im) return false; const h = size * im.height / im.width; ctx.drawImage(im, x - size / 2, y - h / 2, size, h); return true; }
function preloadV4(paths) { for (let i = 0; i < paths.length; i++) v4(paths[i]); }
// an offscreen canvas (tinting); null when the platform has none
function canvas(w, h) { if (!platform || typeof platform.createCanvas !== 'function') return null; const c = platform.createCanvas(); if (!c || !c.getContext) return null; c.width = w; c.height = h; return c; }

// ─── drawing helpers ───
// draw one atlas cell centred at (x, y) with size w x h
function cell(ctx, im, fr, x, y, w, h) { ctx.drawImage(im, fr.x, fr.y, fr.w, fr.h, x - w / 2, y - h / 2, w, h); }
function atlas(ctx, a, name, x, y, size) {
  const fr = a.frames[name]; if (!fr) return false;
  const im = get(a.image); if (!im) return false;
  cell(ctx, im, fr, x, y, size, size * fr.h / fr.w); return true;
}
// background that covers the screen width, top aligned (the stream table hides the bottom half)
function cover(ctx, im, W, H) {
  const s = Math.max(W / BG_W, H / BG_H); const w = BG_W * s, h = BG_H * s;
  ctx.drawImage(im, (W - w) / 2, 0, w, h);
}
// 9-slice: border pieces drawn at `k` px→units, centre stretched
function nine(ctx, im, sl, iw, ih, x, y, w, h, k) {
  const L = sl[0], T = sl[1], R = iw - sl[0] - sl[2], B = ih - sl[1] - sl[3];
  const l = L * k, t = T * k, r = R * k, b = B * k;
  const sx = [0, L, L + sl[2]], sw = [L, sl[2], R], dx = [x, x + l, x + w - r], dw = [l, w - l - r, r];
  const sy = [0, T, T + sl[3]], sh = [T, sl[3], B], dy = [y, y + t, y + h - b], dh = [t, h - t - b, b];
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) if (dw[i] > 0 && dh[j] > 0) ctx.drawImage(im, sx[i], sy[j], sw[i], sh[j], dx[i], dy[j], dw[i], dh[j]);
}

module.exports = {
  init, enabled, get, v4, v4draw, V4, preloadV4, subReady, canvas, getBg, preload, preloadFoods, foodPath, FOOD_SIZE, STREAMERS, STREAMER_K, FACE_IMG, FACE, FACE_EYES_AT, FACE_MOUTH_AT, FACE_FX_AT, EXPR,
  ICONS, REACTIONS, AVATARS, STORE, UI, BG_W, BG_H, cell, atlas, cover, nine
};
