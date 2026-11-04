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
const V4 = {};
['features/market.png', 'features/delivery.png', 'features/buffet.png', 'features/wardrobe.png', 'features/lock.png',
  'cook/opt_mold_dome.png', 'cook/opt_mold_star.png', 'cook/opt_mold_heart.png', 'cook/opt_mold_flower.png', 'cook/opt_mold_bunny.png', 'cook/opt_mold_crown.png'
].forEach(function (p) { V4[p] = true; });
function v4(path) { return V4[path] ? get(path) : null; }
// draw a V4 sprite centred at (x, y), `size` logical units wide; false if not (yet) available
function v4draw(ctx, path, x, y, size) { const im = v4(path); if (!im) return false; const h = size * im.height / im.width; ctx.drawImage(im, x - size / 2, y - h / 2, size, h); return true; }

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
  init, enabled, get, v4, v4draw, V4, getBg, preload, preloadFoods, foodPath, FOOD_SIZE, STREAMERS, STREAMER_K, FACE_IMG, FACE, FACE_EYES_AT, FACE_MOUTH_AT, FACE_FX_AT, EXPR,
  ICONS, REACTIONS, AVATARS, STORE, UI, BG_W, BG_H, cell, atlas, cover, nine
};
