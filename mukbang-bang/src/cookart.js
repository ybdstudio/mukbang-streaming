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
  servePlate(ctx, 0, 40, 64);
  ctx.globalAlpha = 0.18; ctx.fillStyle = '#5b3d3b'; ctx.beginPath(); ctx.ellipse(0, 39, (b[2] / 2) * U * K / 600, 6, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  ctx.save(); ctx.scale(K, K); layer(ctx, body, 1, oy / K); layer(ctx, det, 1, oy / K); ctx.restore();
  return true;
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
// start loading what a recipe will need (the art4 subpackage first)
function preload(dish) {
  const list = ['cook/bg_kitchen.jpg', 'cook/tool_bottle_pour_0.png', 'cook/tool_bottle_pour_1.png', 'cook/tool_bottle_pour_fill.png'];
  ['dome', 'star', 'heart', 'flower', 'bunny', 'crown'].forEach(function (m) { list.push('cook/mold_' + m + '.png', 'cook/jelly_' + m + '_fill.png', 'cook/jelly_' + m + '_detail.png', 'cook/jelly_' + m + '_out_fill.png', 'cook/jelly_' + m + '_out_detail.png'); });
  S.preloadV4(list);
}

module.exports = { jelly, top, deco, kitchenBg, tool, bottle, tinted, preload };
