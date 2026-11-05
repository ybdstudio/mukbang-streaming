'use strict';
// Art V4 for cooking (docs/ART-REQUEST-V4.md §2): jelly / pudding layers (mould · neutral fill tinted by the
// flavour · untinted detail), topping pieces, sprinkles, kitchen background. Every function returns false when
// its art is not (yet) loaded, and the caller keeps the vector drawing — the game never waits for art.
const S = require('./sprites.js');

const U = 150;            // a 600 px layer = 150 dish units (recipes.draw works in 100-unit dishes)
const TINT_N = 400;       // tinted copies are cached at 400 px
const OUT_BOUNDS = {      // unmoulded jelly: content box in the 600 px layer (detail-registration.json)
  dome: [117, 140, 366, 320], star: [112, 135, 375, 335], heart: [84, 138, 432, 351],
  flower: [119, 155, 358, 318], bunny: [123, 118, 353, 362], crown: [109, 162, 381, 288]
};
const cache = {}; let order = [];

// grey layer × colour, alpha kept (multiply, then the layer's own alpha). Pudding: a caramel cap on top.
function tinted(path, color, cap) {
  const key = path + '|' + color + '|' + (cap || ''); if (cache[key]) return cache[key];
  const im = S.v4(path); if (!im) return null;
  const c = S.canvas(TINT_N, TINT_N); if (!c) return null; const x = c.getContext('2d'); if (!x) return null;
  x.drawImage(im, 0, 0, TINT_N, TINT_N);
  x.globalCompositeOperation = 'multiply'; x.fillStyle = color; x.fillRect(0, 0, TINT_N, TINT_N);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(im, 0, 0, TINT_N, TINT_N);
  if (cap) { const k = TINT_N / 600; x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(138,74,24,0.9)'; x.fillRect(0, 0, TINT_N, (cap[1] + cap[3] * 0.24) * k); }
  x.globalCompositeOperation = 'source-over';
  cache[key] = c; order.push(key); if (order.length > 18) delete cache[order.shift()];
  return c;
}
// dessert plate seen from the front (vector until Codex's serve plate arrives)
function servePlate(ctx, x, y, w) {
  ctx.lineWidth = 4; ctx.strokeStyle = '#5b3d3b';
  ctx.fillStyle = '#e4eefc'; ctx.beginPath(); ctx.ellipse(x, y + 3, w, w * 0.26, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f8fbff'; ctx.beginPath(); ctx.ellipse(x, y, w * 0.78, w * 0.17, 0, 0, Math.PI * 2); ctx.fill();
}
function layer(ctx, im, alpha, oy) { if (!im) return; ctx.globalAlpha = alpha; ctx.drawImage(im, -U / 2, -U / 2 + (oy || 0), U, U); ctx.globalAlpha = 1; }

// jelly / pudding in its mould (before the flip) or unmoulded on the plate (after)
function jelly(ctx, dish, st, col, darker, plate) {
  const m = dish.mold || 'dome', p = 'cook/jelly_' + m;
  if (!st.flipped) {
    const mold = S.v4('cook/mold_' + m + '.png'), det = S.v4(p + '_detail.png'); if (!mold || !det) return false;
    const fill = st.fill > 0 ? tinted(p + '_fill.png', st.set ? col : darker, null) : null; if (st.fill > 0 && !fill) return false;
    layer(ctx, mold, 1, -4);
    if (fill) { const a = Math.min(1, st.fill * 1.25) * (st.set ? 1 : 0.88); layer(ctx, fill, a, -4); layer(ctx, det, a, -4); }
    return true;
  }
  const det = S.v4(p + '_out_detail.png'), b = OUT_BOUNDS[m] || OUT_BOUNDS.dome;
  const body = tinted(p + '_out_fill.png', col, dish.recipe === 'pudding' ? b : null); if (!det || !body) return false;
  // a plate wider than the jelly, a soft contact shadow, the jelly's front edge resting on the plate's surface
  const K = 0.86, oy = 39 - (b[1] + b[3] - 300) * U * K / 600;
  if (st.plate !== false) servePlate(ctx, 0, 40, 64);
  ctx.globalAlpha = 0.18; ctx.fillStyle = '#5b3d3b'; ctx.beginPath(); ctx.ellipse(0, 39, (b[2] / 2) * U * K / 600, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.save(); ctx.scale(K, K); layer(ctx, body, 1, oy / K); layer(ctx, det, 1, oy / K); ctx.restore();
  return true;
}
// ── the other 6 recipes (ART-REQUEST-V4-NEXT §1): every layer on the same 600 px canvas ──
// content box of each layer, [x, y, w, h] px (qa.json) — used for bottom-up reveals and topping spots
const BOX = { boba_tea_fill: [201, 232, 198, 225], parfait_layers_fill: [207, 280, 186, 119], parfait_layers_cream: [205, 240, 190, 119] };
function L(name) { return S.v4('cook/' + name + '.png'); }
function T(name, color) { return tinted('cook/' + name + '.png', color, null); }
// a layer revealed from its bottom up to `frac`
function reveal(ctx, im, frac, box, alpha) {
  if (!im || frac <= 0) return; const y1 = box[1] + box[3], y0 = y1 - box[3] * Math.min(1, frac);
  ctx.save(); ctx.beginPath(); ctx.rect(-U / 2, (y0 - 300) * U / 600, U, (y1 - y0) * U / 600 + 2); ctx.clip(); layer(ctx, im, alpha === undefined ? 1 : alpha, 0); ctx.restore();
}
// grows from a bottom point (cream swirl, glaze): k 0..1
function grow(ctx, im, k, by, alpha) { if (!im || k <= 0) return; const s = 0.55 + 0.45 * Math.min(1, k); ctx.save(); ctx.translate(0, by); ctx.scale(s, s); ctx.translate(0, -by); layer(ctx, im, Math.min(1, k * 1.4) * (alpha === undefined ? 1 : alpha), 0); ctx.restore(); }
const SHAPE = { ring: 'ring', heart_d: 'heart_d', star_d: 'star_d', bear: 'bear' };
// returns false (→ vector) unless every layer the recipe needs is loaded
function dish(ctx, d, st, col, h) {
  const r = d.recipe, cup = h.cup, fill = st.fill || 0, set = st.set !== false, tops = h.tops, deco = h.deco;
  const need = function (names) { for (let i = 0; i < names.length; i++) if (!L(names[i])) return false; return true; };
  if (r === 'cupcake') {
    if (!need(['cupcake_liner_fill', 'cupcake_liner_detail', 'cupcake_batter', 'cupcake_base', 'cupcake_cream_fill', 'cupcake_cream_detail'])) return false;
    const lf = T('cupcake_liner_fill', cup), cf = fill > 0 ? T('cupcake_cream_fill', col) : null; if (!lf || (fill > 0 && !cf)) return false;
    layer(ctx, lf, 1, 0); layer(ctx, L('cupcake_liner_detail'), 1, 0); layer(ctx, L(set ? 'cupcake_base' : 'cupcake_batter'), 1, 0);
    if (fill > 0) { grow(ctx, cf, fill, 2); grow(ctx, L('cupcake_cream_detail'), fill, 2); h.drawDeco(0, -20, 46, 28); for (let i = 0; i < Math.min(tops, 2); i++) h.drawTop(i ? 9 : -6, i ? -30 : -38, 1); }
    return true;
  }
  if (r === 'boba') {
    if (!need(['boba_cup_back', 'boba_tea_fill', 'boba_cup_front', 'boba_band_fill', 'boba_band_detail', 'boba_foam'])) return false;
    const tf = T('boba_tea_fill', col), bf = T('boba_band_fill', cup); if (!tf || !bf) return false;
    layer(ctx, L('boba_cup_back'), 1, 0);
    for (let i = 0; i < Math.min(tops, 3) * 3; i++) h.drawTop(-14 + (i % 3) * 14, 34 - Math.floor(i / 3) * 6, 0.75);
    reveal(ctx, tf, fill, BOX.boba_tea_fill, 0.92);
    if (deco > 0 && fill > 0.6) { layer(ctx, L('boba_foam'), Math.min(1, deco * 1.5), 0); h.drawDeco(0, -15, 40, 6); }
    layer(ctx, L('boba_cup_front'), 1, 0); layer(ctx, bf, 1, 0); layer(ctx, L('boba_band_detail'), 1, 0);
    return true;
  }
  if (r === 'ramen') {
    if (!need(['ramen_bowl_fill', 'ramen_bowl_detail', 'ramen_broth_fill', 'ramen_noodles', 'ramen_chopsticks', 'ramen_steam'])) return false;
    const bw = T('ramen_bowl_fill', cup), br = fill > 0 ? T('ramen_broth_fill', col) : null; if (!bw || (fill > 0 && !br)) return false;
    layer(ctx, bw, 1, 0); layer(ctx, L('ramen_bowl_detail'), 1, 0);
    if (br) layer(ctx, br, Math.min(1, fill * 1.3), 0);
    if (st.set) { layer(ctx, L('ramen_noodles'), 1, 0); }
    for (let i = 0; i < Math.min(tops, 3); i++) h.drawTop([-18, 4, 22][i], [-1, -4, 1][i], 1.15);
    h.drawDeco(0, 2, 60, 10);
    layer(ctx, L('ramen_chopsticks'), 1, 0);
    if (st.set) layer(ctx, L('ramen_steam'), 0.55 + 0.25 * Math.sin(Date.now() / 300), 0);
    return true;
  }
  if (r === 'parfait') {
    if (!need(['parfait_glass_back', 'parfait_layers_fill', 'parfait_layers_cream', 'parfait_cream_top', 'parfait_glass_front'])) return false;
    const lf = T('parfait_layers_fill', col); if (!lf) return false;
    layer(ctx, L('parfait_glass_back'), 1, 0);
    reveal(ctx, lf, fill, BOX.parfait_layers_fill); reveal(ctx, L('parfait_layers_cream'), fill, BOX.parfait_layers_cream);
    if (st.set) layer(ctx, L('parfait_cream_top'), 1, 0);
    layer(ctx, L('parfait_glass_front'), 1, 0);
    if (st.set) { h.drawDeco(0, -26, 40, 14); for (let i = 0; i < Math.min(tops, 3); i++) h.drawTop([0, -12, 12][i], -36 + [0, 6, 6][i], 1); }
    return true;
  }
  if (r === 'donut') {
    const sh = SHAPE[d.shape] || 'ring', p = 'donut_' + sh;
    if (!need([p, p + '_dough', p + '_glaze_fill', p + '_glaze_detail', 'donut_plate'])) return false;
    const gf = fill > 0 ? T(p + '_glaze_fill', col) : null; if (fill > 0 && !gf) return false;
    if (st.plate !== false) layer(ctx, L('donut_plate'), 1, 0);
    layer(ctx, L(set ? p : p + '_dough'), 1, 0);
    if (gf) { layer(ctx, gf, Math.min(1, fill * 1.3), 0); layer(ctx, L(p + '_glaze_detail'), Math.min(1, fill * 1.3), 0); }
    h.drawDeco(0, -4, 56, 50); for (let i = 0; i < Math.min(tops, 2); i++) h.drawTop(i ? 18 : -16, i ? -14 : -20, 1);
    return true;
  }
  if (r === 'bingsu') {
    if (!need(['bingsu_bowl_fill', 'bingsu_bowl_detail', 'bingsu_snow', 'bingsu_syrup_fill', 'bingsu_syrup_detail'])) return false;
    const bw = T('bingsu_bowl_fill', cup), sy = fill > 0 ? T('bingsu_syrup_fill', col) : null; if (!bw || (fill > 0 && !sy)) return false;
    layer(ctx, bw, 1, 0); layer(ctx, L('bingsu_bowl_detail'), 1, 0);
    if (set) { layer(ctx, L('bingsu_snow'), 1, 0);
      if (sy) { layer(ctx, sy, Math.min(1, fill * 1.3), 0); layer(ctx, L('bingsu_syrup_detail'), Math.min(1, fill * 1.3), 0); }
      h.drawDeco(0, -18, 50, 26); for (let i = 0; i < Math.min(tops, 3); i++) h.drawTop([0, -14, 14][i], -36 + [0, 9, 9][i], 1); }
    return true;
  }
  return false;
}
// one topping piece, `size` dish units wide
function top(ctx, id, x, y, size) { return S.v4draw(ctx, 'cook/top_' + id + '.png', x, y, size); }
// sprinkles over a w × h area; amount 0..1 fades them in
function deco(ctx, id, x, y, w, h, amount) {
  const im = S.v4('cook/deco_' + id + '.png'); if (!im) return false;
  ctx.globalAlpha = Math.max(0, Math.min(1, amount)); ctx.drawImage(im, x - w * 0.6, y - h * 0.6, w * 1.2, h * 1.2); ctx.globalAlpha = 1; return true;
}
// kitchen background: cover, with the counter top (row 1404 of 2340) at 60 % of the screen
function kitchenBg(ctx, W, H) {
  const im = S.v4('cook/bg_kitchen.jpg'); if (!im) return false;
  const s = Math.max(W / 1080, H / 2340), w = 1080 * s, y0 = Math.min(0, H * 0.6 - 1404 * s);
  ctx.drawImage(im, (W - w) / 2, y0, w, 2340 * s); return true;
}
// a tool sprite (2 frames: idle / working)
function tool(ctx, id, x, y, size, on) { return S.v4draw(ctx, 'cook/tool_' + id + '_' + (on ? 1 : 0) + '.png', x, y, size); }
// the pouring bottle, mirrored so the spout points at the dish; returns the spout position or null
function bottle(ctx, color, x, y, size, pouring) {
  const im = S.v4('cook/tool_bottle_pour_' + (pouring ? 1 : 0) + '.png'); if (!im) return null;
  const fill = tinted('cook/tool_bottle_pour_fill.png', color, null);
  ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1); ctx.drawImage(im, -size / 2, -size / 2, size, size); if (fill) ctx.drawImage(fill, -size / 2, -size / 2, size, size); ctx.restore();
  return { x: x - size * 64 / 240, y: y + size * 38 / 240 };
}
// UI sprites: 9-slice panels and plain sprites (manifest.next.fragment.json)
const SLICE = { 'cook/tray.png': [520, 160, [40, 40, 440, 80]], 'cook/card.png': [220, 224, [40, 40, 140, 144]], 'cook/card_selected.png': [220, 224, [40, 40, 140, 144]],
  'cook/card_rare.png': [220, 224, [40, 40, 140, 144]], 'cook/request_card.png': [660, 116, [40, 40, 580, 36]], 'cook/btn_make.png': [480, 120, [60, 48, 360, 24]] };
function panel(ctx, path, x, y, w, h) { const im = S.v4(path), sl = SLICE[path]; if (!im || !sl) return false; S.nine(ctx, im, sl[2], sl[0], sl[1], x, y, w, h, 0.5); return true; }
function sprite(ctx, path, x, y, w) { return S.v4draw(ctx, path, x, y, w); }
// start loading what a recipe will need (the art4 subpackage first)
function preload(dish) {
  const list = ['cook/bg_kitchen.jpg', 'cook/tool_bottle_pour_0.png', 'cook/tool_bottle_pour_1.png', 'cook/tool_bottle_pour_fill.png'];
  ['dome', 'star', 'heart', 'flower', 'bunny', 'crown'].forEach(function (m) { list.push('cook/mold_' + m + '.png', 'cook/jelly_' + m + '_fill.png', 'cook/jelly_' + m + '_detail.png', 'cook/jelly_' + m + '_out_fill.png', 'cook/jelly_' + m + '_out_detail.png'); });
  for (const k in S.V4) if (S.V4[k] === 'art4' || k.indexOf('cook/') === 0 || k.indexOf('stream/') === 0) list.push(k);
  S.preloadV4(list);
}

module.exports = { panel, sprite, dish, jelly, top, deco, kitchenBg, tool, bottle, tinted, preload };
