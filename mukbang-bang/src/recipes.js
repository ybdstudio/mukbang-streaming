'use strict';
// V4 cooking (docs/GAME-DESIGN-V4.md): recipes made of quick steps with CHOICES
// (mould / flavour / topping / decoration / container), modelled on the
// reference video: pick a mould ✓ → pick a flavour ✓ → pour → cool with the
// fan → flip onto the plate → pick a topping ✓ → place it → pick a decoration ✓
// → shake → "PERFECT!" → the dish is served as 3 portions on the stream.
// Also the vector renderer for a cooked dish (fallback until bitmap art).

// ── options per slot ── [id, name, colour, unlock level, extra]
const OPT = {
  mold:   [['dome', 'Dome', '#ffd1e3', 1], ['star', 'Star', '#fff0c2', 1], ['heart', 'Heart', '#ffc2d6', 1], ['flower', 'Flower', '#d9d4ff', 1], ['bunny', 'Bunny', '#e9fbf3', 12], ['crown', 'Crown', '#fff3b0', 25]],
  flavor: [['strawberry', 'Strawberry', '#ff4a5f', 1, 'sweet'], ['mango', 'Mango', '#ffb830', 1, 'sweet'], ['matcha', 'Matcha', '#7ec46a', 1, 'savory'], ['grape', 'Grape', '#9b5fe0', 1, 'sour'], ['blueberry', 'Blueberry', '#5b7be8', 6, 'sour'], ['peach', 'Peach', '#ff9f8a', 9, 'sweet'], ['chocolate', 'Chocolate', '#7a4b2f', 14, 'sweet'], ['milk', 'Milk', '#fff3e6', 18, 'sweet'], ['sakura', 'Sakura', '#ffb3cf', 22, 'sweet'], ['lemon', 'Lemon', '#ffe34d', 28, 'sour'], ['soda', 'Soda', '#7fd4ff', 33, 'fizzy']],
  broth:  [['shoyu', 'Shoyu', '#b5651d', 1, 'savory'], ['miso', 'Miso', '#e0a83a', 1, 'savory'], ['spicy', 'Spicy', '#e8402a', 1, 'spicy'], ['creamy', 'Creamy', '#f6e8d0', 1, 'savory'], ['curry', 'Curry', '#d98a1a', 26, 'spicy']],
  topping: [['cherry', 'Cherry', '#e8203a', 1], ['strawberry_t', 'Strawberry', '#ff4a5f', 1], ['blueberry_t', 'Blueberry', '#4a5fd8', 1], ['mint', 'Mint Leaf', '#4fbf6a', 1], ['cream', 'Cream', '#fff8ef', 5], ['kiwi', 'Kiwi', '#8fd44a', 8], ['peach_t', 'Peach', '#ffb39a', 11], ['mochi', 'Mochi', '#ffe6f0', 15], ['choco_stick', 'Choco Stick', '#6b3f24', 20], ['sakura_t', 'Sakura', '#ff9fc4', 24], ['gold_star', 'Gold Star', '#ffd23f', 30]],
  ramen_top: [['egg', 'Soft Egg', '#ffd95e', 1], ['chashu', 'Chashu', '#c9805a', 1], ['scallion', 'Scallion', '#5fbf5a', 1], ['naruto', 'Naruto', '#ffffff', 1], ['corn', 'Corn', '#ffe066', 16], ['nori', 'Nori', '#2f4a3a', 21]],
  boba_top: [['pearls', 'Pearls', '#3d2a24', 1], ['jelly_cubes', 'Jelly Cubes', '#9fe37a', 1], ['pudding_t', 'Pudding', '#ffd27a', 1], ['red_bean', 'Red Bean', '#9a3a3a', 1], ['popping', 'Popping Boba', '#ff8fb3', 19]],
  deco:   [['sprinkles', 'Sprinkles', '#ff9fc4', 1], ['hearts', 'Hearts', '#ff5a8a', 1], ['stars', 'Stars', '#ffd23f', 1], ['pearls_d', 'Sugar Pearls', '#ffffff', 1], ['snow', 'Snow Sugar', '#eef6ff', 10], ['gold', 'Gold Flakes', '#ffcc33', 16], ['cocoa', 'Cocoa Dust', '#7a4b2f', 20]],
  cup:    [['pink', 'Pink', '#ffc2d6', 1], ['mint_c', 'Mint', '#bff0dd', 1], ['lavender', 'Lavender', '#ddd0ff', 1], ['lemon_c', 'Lemon', '#fff0a8', 1], ['sky', 'Sky', '#c8e8ff', 13]],
  shape:  [['ring', 'Ring', '#f3c58b', 1], ['heart_d', 'Heart', '#f3c58b', 1], ['star_d', 'Star', '#f3c58b', 1], ['bear', 'Bear', '#f3c58b', 1]]
};
const OPT_BY = {}; for (const s in OPT) { OPT_BY[s] = {}; for (let i = 0; i < OPT[s].length; i++) { const o = OPT[s][i]; OPT_BY[s][o[0]] = { id: o[0], name: o[1], color: o[2], unlock: o[3], taste: o[4] || null, slot: s }; } }
function opt(slot, id) { return OPT_BY[slot] && OPT_BY[slot][id] || null; }
function options(slot, level) { return OPT[slot].filter(function (o) { return o[3] <= level; }).map(function (o) { return OPT_BY[slot][o[0]]; }); }

// ── recipes: steps ──
//   pick  { slot }            — 4 choices in the bottom tray, tap one, ✓ to confirm
//   pour  { from: slot }      — hold the bottle over the mould until it is full
//   hold  { tool, text }      — hold the tool (fan / fire / mixer / shaver) until the bar fills
//   flip                      — tap to unmould onto the plate
//   place { n }               — tap the dish n times to place the chosen topping
//   shake                     — rub back and forth to shake the decoration on
const RECIPES = {
  jelly:   { name: 'Jelly', make: 'MAKE JELLY', taste: 'flavor', sound: 'soft', container: 'mold', steps: [{ t: 'pick', slot: 'mold' }, { t: 'pick', slot: 'flavor' }, { t: 'pour', from: 'flavor' }, { t: 'hold', tool: 'fan', text: 'COOL IT DOWN' }, { t: 'flip' }, { t: 'pick', slot: 'topping' }, { t: 'place', n: 3 }, { t: 'pick', slot: 'deco' }, { t: 'shake' }] },
  pudding: { name: 'Pudding', make: 'MAKE PUDDING', taste: 'flavor', sound: 'soft', container: 'mold', steps: [{ t: 'pick', slot: 'mold' }, { t: 'pick', slot: 'flavor' }, { t: 'pour', from: 'flavor' }, { t: 'hold', tool: 'fan', text: 'CHILL IT' }, { t: 'flip' }, { t: 'pick', slot: 'topping' }, { t: 'place', n: 2 }, { t: 'pick', slot: 'deco' }, { t: 'shake' }] },
  cupcake: { name: 'Cupcake', make: 'BAKE CUPCAKES', taste: 'flavor', sound: 'soft', container: 'cup', steps: [{ t: 'pick', slot: 'cup' }, { t: 'hold', tool: 'oven', text: 'BAKE IT' }, { t: 'pick', slot: 'flavor' }, { t: 'pour', from: 'flavor', text: 'PIPE THE FROSTING' }, { t: 'pick', slot: 'topping' }, { t: 'place', n: 2 }, { t: 'pick', slot: 'deco' }, { t: 'shake' }] },
  boba:    { name: 'Boba Tea', make: 'MAKE BOBA', taste: 'flavor', sound: 'gulp', container: 'cup', steps: [{ t: 'pick', slot: 'cup' }, { t: 'pick', slot: 'boba_top' }, { t: 'place', n: 3, text: 'DROP IN THE TOPPING' }, { t: 'pick', slot: 'flavor' }, { t: 'pour', from: 'flavor' }, { t: 'hold', tool: 'shaker', text: 'SHAKE IT UP' }, { t: 'pick', slot: 'deco' }, { t: 'shake' }] },
  ramen:   { name: 'Ramen', make: 'COOK RAMEN', taste: 'broth', sound: 'slurp', container: 'bowl', steps: [{ t: 'pick', slot: 'cup' }, { t: 'pick', slot: 'broth' }, { t: 'pour', from: 'broth' }, { t: 'hold', tool: 'fire', text: 'BOIL THE NOODLES' }, { t: 'pick', slot: 'ramen_top' }, { t: 'place', n: 3 }, { t: 'pick', slot: 'deco' }, { t: 'shake', text: 'SPRINKLE IT' }] },
  parfait: { name: 'Parfait', make: 'MAKE A PARFAIT', taste: 'flavor', sound: 'lick', container: 'glass', steps: [{ t: 'pick', slot: 'flavor' }, { t: 'pour', from: 'flavor' }, { t: 'hold', tool: 'mixer', text: 'WHIP THE CREAM' }, { t: 'pick', slot: 'topping' }, { t: 'place', n: 3 }, { t: 'pick', slot: 'deco' }, { t: 'shake' }] },
  donut:   { name: 'Donut', make: 'FRY DONUTS', taste: 'flavor', sound: 'bite', container: 'donut', steps: [{ t: 'pick', slot: 'shape' }, { t: 'hold', tool: 'fire', text: 'FRY IT GOLDEN' }, { t: 'pick', slot: 'flavor' }, { t: 'pour', from: 'flavor', text: 'DIP IN THE GLAZE' }, { t: 'pick', slot: 'topping' }, { t: 'place', n: 2 }, { t: 'pick', slot: 'deco' }, { t: 'shake' }] },
  bingsu:  { name: 'Bingsu', make: 'MAKE BINGSU', taste: 'cold', sound: 'lick', container: 'bowl', steps: [{ t: 'pick', slot: 'cup' }, { t: 'hold', tool: 'shaver', text: 'SHAVE THE ICE' }, { t: 'pick', slot: 'flavor' }, { t: 'pour', from: 'flavor', text: 'DRIZZLE THE SYRUP' }, { t: 'pick', slot: 'topping' }, { t: 'place', n: 3 }, { t: 'pick', slot: 'deco' }, { t: 'shake' }] }
};
// the taste the streamer reacts to
function tasteOf(dish) { const r = RECIPES[dish.recipe]; if (r.taste === 'cold') return 'cold'; const o = r.taste === 'broth' ? opt('broth', dish.broth) : opt('flavor', dish.flavor); return (o && o.taste) || 'sweet'; }
function colorOf(dish) { const r = RECIPES[dish.recipe]; const o = r.taste === 'broth' ? opt('broth', dish.broth) : opt('flavor', dish.flavor); return o ? o.color : '#ff9fc4'; }
function toppingSlot(recipe) { return recipe === 'ramen' ? 'ramen_top' : recipe === 'boba' ? 'boba_top' : 'topping'; }
function dishName(dish) { const r = RECIPES[dish.recipe]; const o = r.taste === 'broth' ? opt('broth', dish.broth) : opt('flavor', dish.flavor); return (o ? o.name + ' ' : '') + r.name; }

// ── renderer: vector, with art V4 layers when they are loaded (setArt, see cookart.js) ──
let ART = null;
function setArt(a) { ART = a; }
// st: { fill 0..1, set bool (jelly set), flipped bool, tops n placed, deco 0..1, portion bool (small, plated) }
function draw(ctx, A, dish, x, y, size, st) {
  st = st || {}; const R = RECIPES[dish.recipe]; const s = size / 100; const col = colorOf(dish);
  const OUT = '#5b3d3b';
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const fs = function (fill, lw) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke(); } };
  const plate = function () { A.ellipse(ctx, 0, 34, 50, 13, '#e9f3ff', 4); A.ellipse(ctx, 0, 33, 38, 8, '#f8fbff', 0); };
  const tops = st.tops === undefined ? 3 : st.tops, deco = st.deco === undefined ? 1 : st.deco;
  const topOpt = opt(toppingSlot(dish.recipe), dish.topping), decoOpt = opt('deco', dish.deco);
  const drawTop = function (tx, ty, k) { if (!topOpt) return; if (ART && ART.top(ctx, topOpt.id, tx, ty, 24 * (k || 1))) return; const c = topOpt.color, id = topOpt.id, r = 7 * (k || 1);
    if (id === 'cherry') { ctx.strokeStyle = '#4a7a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, ty - r); ctx.quadraticCurveTo(tx + 4, ty - r * 2.2, tx + 8, ty - r * 2.4); ctx.stroke(); A.circle(ctx, tx, ty, r, c, 2.5); A.circle(ctx, tx - r * 0.35, ty - r * 0.35, r * 0.28, 'rgba(255,255,255,0.7)', 0); }
    else if (id === 'mint') { ctx.save(); ctx.translate(tx, ty); ctx.rotate(-0.5); A.ellipse(ctx, -4, 0, 7, 3.5, c, 2); A.ellipse(ctx, 4, 0, 7, 3.5, c, 2); ctx.restore(); }
    else if (id === 'cream') { A.circle(ctx, tx, ty, r * 1.2, c, 2.5); A.circle(ctx, tx, ty - r, r * 0.8, c, 2.5); }
    else if (id === 'choco_stick') { ctx.save(); ctx.translate(tx, ty); ctx.rotate(0.4); A.rr(ctx, -2.5, -14, 5, 22, 2); fs(c, 2); ctx.restore(); }
    else if (id === 'gold_star') A.star(ctx, tx, ty, r * 1.2, c, 2);
    else if (id === 'sakura_t') { for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; A.circle(ctx, tx + Math.cos(a) * r * 0.6, ty + Math.sin(a) * r * 0.6, r * 0.5, c, 1.5); } }
    else if (id === 'egg') { A.ellipse(ctx, tx, ty, r * 1.4, r, '#fff', 2.5); A.circle(ctx, tx, ty, r * 0.6, c, 0); }
    else if (id === 'chashu') { A.circle(ctx, tx, ty, r * 1.3, c, 2.5); A.circle(ctx, tx, ty, r * 0.7, '#f3c9a8', 0); }
    else if (id === 'scallion') { for (let i = 0; i < 3; i++) A.circle(ctx, tx + (i - 1) * 5, ty + (i % 2) * 3, 2.5, c, 1); }
    else if (id === 'naruto') { A.circle(ctx, tx, ty, r * 1.1, '#fff', 2.5); ctx.strokeStyle = '#ff7fa8'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tx, ty, r * 0.5, 0, Math.PI * 1.6); ctx.stroke(); }
    else if (id === 'nori') { A.rr(ctx, tx - 6, ty - 12, 12, 18, 2); fs(c, 2); }
    else if (id === 'pearls' || id === 'red_bean' || id === 'popping') { for (let i = 0; i < 3; i++) A.circle(ctx, tx + (i - 1) * 6, ty + (i % 2) * 4, 3.5, c, 1.2); }
    else if (id === 'jelly_cubes' || id === 'pudding_t') { A.rr(ctx, tx - 5, ty - 5, 10, 10, 2); fs(c, 1.5); }
    else { A.circle(ctx, tx, ty, r, c, 2.5); A.circle(ctx, tx - r * 0.35, ty - r * 0.35, r * 0.28, 'rgba(255,255,255,0.6)', 0); }
  };
  const drawDeco = function (cx, cy, w, h) { if (!decoOpt || deco <= 0) return; if (ART && ART.deco(ctx, decoOpt.id, cx, cy, w, h, deco)) return; const n = Math.round(12 * deco); for (let i = 0; i < n; i++) { const px = cx + ((i * 37) % 100 / 100 - 0.5) * w, py = cy + ((i * 61) % 100 / 100 - 0.5) * h; const id = decoOpt.id;
    if (id === 'hearts') A.heart(ctx, px, py, 3, decoOpt.color, 0); else if (id === 'stars' || id === 'gold') A.star(ctx, px, py, 2.6, decoOpt.color, 0); else if (id === 'sprinkles') { ctx.save(); ctx.translate(px, py); ctx.rotate(i); ctx.fillStyle = ['#ff7fa8', '#7fd4ff', '#ffe066', '#9fe37a'][i % 4]; ctx.fillRect(-3, -1, 6, 2.2); ctx.restore(); } else A.circle(ctx, px, py, 1.8, decoOpt.color, 0); } };
  const moldPath = function (m, w, h, oy) { ctx.beginPath();
    if (m === 'star') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? w * 0.6 : w; ctx.lineTo(Math.cos(a) * rr, oy + Math.sin(a) * h * 0.55 + h * 0.15); } ctx.closePath(); }
    else if (m === 'heart') { ctx.moveTo(0, oy + h * 0.55); ctx.bezierCurveTo(-w * 1.3, oy - h * 0.1, -w * 0.5, oy - h * 0.75, 0, oy - h * 0.3); ctx.bezierCurveTo(w * 0.5, oy - h * 0.75, w * 1.3, oy - h * 0.1, 0, oy + h * 0.55); }
    else if (m === 'flower') { for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.moveTo(Math.cos(a) * w * 0.5 + w * 0.45, oy + Math.sin(a) * h * 0.4); ctx.arc(Math.cos(a) * w * 0.5, oy + Math.sin(a) * h * 0.4, w * 0.45, 0, Math.PI * 2); } }
    else if (m === 'bunny') { ctx.ellipse(0, oy + h * 0.1, w, h * 0.45, 0, 0, Math.PI * 2); ctx.moveTo(-w * 0.2, oy - h * 0.3); ctx.ellipse(-w * 0.4, oy - h * 0.55, w * 0.22, h * 0.4, -0.2, 0, Math.PI * 2); ctx.moveTo(w * 0.6, oy - h * 0.55); ctx.ellipse(w * 0.4, oy - h * 0.55, w * 0.22, h * 0.4, 0.2, 0, Math.PI * 2); }
    else if (m === 'crown') { ctx.moveTo(-w, oy + h * 0.5); ctx.lineTo(-w, oy - h * 0.3); ctx.lineTo(-w * 0.5, oy); ctx.lineTo(0, oy - h * 0.5); ctx.lineTo(w * 0.5, oy); ctx.lineTo(w, oy - h * 0.3); ctx.lineTo(w, oy + h * 0.5); ctx.closePath(); }
    else { ctx.moveTo(-w, oy + h * 0.5); ctx.quadraticCurveTo(-w, oy - h * 0.7, 0, oy - h * 0.7); ctx.quadraticCurveTo(w, oy - h * 0.7, w, oy + h * 0.5); ctx.closePath(); } };
  const c = R.container;
  const cupCol = (opt('cup', dish.cup) || { color: dish.recipe === 'boba' ? '#c8e8ff' : '#ffc2d6' }).color;
  if (c !== 'mold' && ART && ART.dish && ART.dish(ctx, dish, st, col, { cup: cupCol, tops: tops, deco: deco, drawTop: drawTop, drawDeco: drawDeco })) { ctx.restore(); return; }
  const jl = c === 'mold' && ART ? ART.jelly(ctx, dish, st, col, shade(col, 0.25), plate) : null;
  if (jl) {
    if (st.flipped && jl.top !== undefined) { // sprinkles over the top face, toppings resting in it (their base on the surface)
      const ty = jl.top, ww = jl.w; drawDeco(0, ty + 9, ww * 0.62, 12);
      for (let i = 0; i < Math.min(tops, 3); i++) drawTop([0, -ww * 0.2, ww * 0.2][i], ty + [1, 6, 6][i], 1);
    }
  } else if (c === 'mold') {
    // before flip: the mould (container) with liquid; after flip: the set jelly on a plate
    if (!st.flipped) {
      ctx.save(); ctx.scale(1, -1); moldPath(dish.mold || 'dome', 38, 50, 4); ctx.restore(); fs('rgba(255,255,255,0.85)', 4);
      if (st.fill > 0) { ctx.save(); ctx.scale(1, -1); moldPath(dish.mold || 'dome', 38, 50, 4); ctx.restore(); ctx.save(); ctx.clip(); ctx.fillStyle = st.set ? col : shade(col, 0.25); ctx.globalAlpha = st.set ? 1 : 0.85; ctx.fillRect(-50, 32 - 60 * st.fill, 100, 80); ctx.restore(); ctx.globalAlpha = 1; }
      ctx.save(); ctx.scale(1, -1); moldPath(dish.mold || 'dome', 38, 50, 4); ctx.restore(); fs(null, 4);
    } else {
      plate();
      moldPath(dish.mold || 'dome', 36, 48, 0); fs(col, 4);
      moldPath(dish.mold || 'dome', 36, 48, 0); ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-30, -30, 14, 60); ctx.fillStyle = 'rgba(0,0,0,0.08)'; ctx.fillRect(10, -30, 30, 70); ctx.restore();
      if (dish.recipe === 'pudding') { ctx.save(); moldPath(dish.mold || 'dome', 36, 48, 0); ctx.clip(); ctx.fillStyle = '#9a5a1a'; ctx.fillRect(-50, -40, 100, 16); ctx.restore(); }
      drawDeco(0, -2, 52, 34);
      for (let i = 0; i < Math.min(tops, 3); i++) drawTop([0, -14, 14][i], -30 + [0, 8, 8][i], 1);
    }
  } else if (c === 'cup' && dish.recipe === 'cupcake') {
    const cc = (opt('cup', dish.cup) || { color: '#ffc2d6' }).color;
    ctx.beginPath(); ctx.moveTo(-28, 0); ctx.lineTo(28, 0); ctx.lineTo(20, 36); ctx.lineTo(-20, 36); ctx.closePath(); fs(cc, 4);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 10, 2); ctx.lineTo(i * 7, 34); ctx.stroke(); }
    if (st.set !== false) { A.ellipse(ctx, 0, -2, 32, 14, '#e8b267', 4); }
    if (st.fill > 0) { const k = st.fill; A.ellipse(ctx, 0, -8, 30 * k + 2, 14 * k + 2, col, 4); if (k > 0.5) A.ellipse(ctx, 0, -20, 22 * k, 12 * k, col, 4); if (k > 0.8) A.circle(ctx, 0, -32, 10, col, 4); drawDeco(0, -16, 50, 30); for (let i = 0; i < Math.min(tops, 2); i++) drawTop(i ? 10 : -6, -38 + i * 8, 1); }
  } else if (c === 'cup') { // boba
    const cc = (opt('cup', dish.cup) || { color: '#c8e8ff' }).color;
    ctx.beginPath(); ctx.moveTo(-28, -38); ctx.lineTo(28, -38); ctx.lineTo(22, 40); ctx.lineTo(-22, 40); ctx.closePath(); fs('rgba(255,255,255,0.85)', 4);
    ctx.save(); ctx.beginPath(); ctx.moveTo(-28, -38); ctx.lineTo(28, -38); ctx.lineTo(22, 40); ctx.lineTo(-22, 40); ctx.closePath(); ctx.clip();
    if (st.fill > 0) { ctx.fillStyle = shade(col, 0.15); ctx.fillRect(-30, 40 - 74 * st.fill, 60, 80); }
    for (let i = 0; i < Math.min(tops, 3) * 3; i++) drawTop(-14 + (i % 3) * 14, 32 - Math.floor(i / 3) * 6, 0.8);
    if (deco > 0 && decoOpt) { ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(-30, -38, 60, 10 * deco); drawDeco(0, -33, 40, 6); }
    ctx.restore();
    A.rr(ctx, -30, 0, 60, 8, 3); fs(cc, 3);
    ctx.lineWidth = 7; ctx.strokeStyle = shade(cc, -0.3); ctx.beginPath(); ctx.moveTo(8, -20); ctx.lineTo(16, -56); ctx.stroke();
  } else if (c === 'bowl') {
    const cc = (opt('cup', dish.cup) || { color: '#ffc2d6' }).color;
    ctx.beginPath(); ctx.moveTo(-46, -4); ctx.quadraticCurveTo(-44, 40, 0, 40); ctx.quadraticCurveTo(44, 40, 46, -4); ctx.closePath(); fs(cc, 4);
    if (dish.recipe === 'bingsu') { if (st.set !== false) { ctx.beginPath(); ctx.moveTo(-40, -4); ctx.quadraticCurveTo(-30, -46, 0, -46); ctx.quadraticCurveTo(30, -46, 40, -4); ctx.closePath(); fs('#f4fbff', 4); if (st.fill > 0) { ctx.save(); ctx.clip(); ctx.globalAlpha = 0.85; ctx.fillStyle = col; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(-24 + i * 12, -30 + (i % 2) * 8, 10, 22 * st.fill, 0.3, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); ctx.globalAlpha = 1; } drawDeco(0, -26, 50, 26); for (let i = 0; i < Math.min(tops, 3); i++) drawTop([0, -16, 16][i], -46 + [0, 10, 10][i], 1); } }
    else { // ramen
      A.ellipse(ctx, 0, -4, 46, 12, shade(cc, -0.1), 4);
      if (st.fill > 0) { A.ellipse(ctx, 0, -4, 40 * Math.min(1, st.fill + 0.2), 9, col, 0); }
      if (st.set) noodles(ctx, 0, -6, 34, 7);
      for (let i = 0; i < Math.min(tops, 3); i++) drawTop([-18, 6, 22][i], [-8, -10, -4][i], 1.1);
      drawDeco(0, -6, 60, 10);
      ctx.lineWidth = 5; ctx.strokeStyle = '#c49a6c'; ctx.beginPath(); ctx.moveTo(10, -16); ctx.lineTo(44, -52); ctx.moveTo(18, -14); ctx.lineTo(50, -46); ctx.stroke();
    }
  } else if (c === 'glass') { // parfait
    ctx.beginPath(); ctx.moveTo(-26, -40); ctx.lineTo(26, -40); ctx.lineTo(14, 22); ctx.lineTo(-14, 22); ctx.closePath(); fs('rgba(255,255,255,0.9)', 4);
    A.rr(ctx, -4, 22, 8, 12, 2); fs('#fff', 3); A.ellipse(ctx, 0, 36, 20, 5, '#fff', 3);
    ctx.save(); ctx.beginPath(); ctx.moveTo(-26, -40); ctx.lineTo(26, -40); ctx.lineTo(14, 22); ctx.lineTo(-14, 22); ctx.closePath(); ctx.clip();
    const lv = st.fill || 0; for (let i = 0; i < 4; i++) { if (lv * 4 > i) { ctx.fillStyle = i % 2 ? '#fff8ef' : shade(col, i * 0.1); ctx.fillRect(-30, 22 - (i + 1) * 15, 60, 15); } } ctx.restore();
    if (st.set) { A.circle(ctx, -10, -44, 12, '#fff8ef', 3); A.circle(ctx, 10, -44, 12, '#fff8ef', 3); A.circle(ctx, 0, -54, 11, '#fff8ef', 3); }
    drawDeco(0, -46, 40, 16); for (let i = 0; i < Math.min(tops, 3); i++) drawTop([0, -14, 14][i], -62 + [0, 8, 8][i], 1);
  } else if (c === 'donut') {
    plate(); const sh = dish.shape || 'ring';
    const ring = function (fill, lw, k) { ctx.beginPath(); if (sh === 'heart_d') { ctx.moveTo(0, 26 * k); ctx.bezierCurveTo(-56 * k, -4 * k, -24 * k, -38 * k, 0, -16 * k); ctx.bezierCurveTo(24 * k, -38 * k, 56 * k, -4 * k, 0, 26 * k); } else if (sh === 'star_d') { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = (i % 2 ? 22 : 40) * k; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); } else if (sh === 'bear') { ctx.arc(0, 0, 34 * k, 0, Math.PI * 2); ctx.moveTo(-14 * k, -30 * k); ctx.arc(-24 * k, -30 * k, 12 * k, 0, Math.PI * 2); ctx.moveTo(34 * k, -30 * k); ctx.arc(24 * k, -30 * k, 12 * k, 0, Math.PI * 2); } else ctx.arc(0, 0, 38 * k, 0, Math.PI * 2); fs(fill, lw); };
    ring(st.set === false ? '#f6dcae' : '#e0a060', 4, 1);
    if (st.fill > 0) { ctx.globalAlpha = Math.min(1, st.fill * 1.5); ring(col, 0, 0.86); ctx.globalAlpha = 1; }
    if (sh === 'ring') { A.circle(ctx, 0, 0, 12, '#e9f3ff', 4); }
    drawDeco(0, 0, 60, 50); for (let i = 0; i < Math.min(tops, 2); i++) drawTop(i ? 18 : -16, i ? -14 : -18, 1);
  }
  ctx.restore();
}
// golden instant noodles: wavy strands with a darker edge so they read as noodles at any size
function noodles(ctx, x, y, w, n, len) {
  len = len === undefined ? 1 : len;
  for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? '#ffd23f' : '#d99a1a'; ctx.lineWidth = pass ? 3.4 : 5.6; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) { const sx = x - w + (i + 0.5) * (2 * w / n); ctx.beginPath(); ctx.moveTo(sx - 6, y + 2);
      for (let k = 1; k <= 4; k++) ctx.quadraticCurveTo(sx - 6 + k * 3 - 1.5, y + (k % 2 ? -7 : 5) * len, sx - 6 + k * 3, y + 1); ctx.stroke(); }
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < n; i += 2) { ctx.beginPath(); ctx.arc(x - w + (i + 0.5) * (2 * w / n) - 3, y - 3, 1.4, 0, Math.PI * 2); ctx.fill(); }
}
// a bite on chopsticks: golden noodles hanging from the tips; `left` 0..1 = how much is still there
function noodleBite(ctx, x, y, s, left, broth) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100); ctx.lineCap = 'round';
  ctx.strokeStyle = '#5b3d3b'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(60, -78); ctx.moveTo(6, -24); ctx.lineTo(68, -68); ctx.stroke();
  ctx.strokeStyle = '#d9a86c'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-6, -30); ctx.lineTo(60, -78); ctx.moveTo(6, -24); ctx.lineTo(68, -68); ctx.stroke();
  const L = 70 * Math.max(0, left);
  if (L > 2) for (let pass = 0; pass < 2; pass++) {
    ctx.strokeStyle = pass ? '#ffd23f' : '#d99a1a'; ctx.lineWidth = pass ? 4.2 : 7;
    for (let i = 0; i < 6; i++) { const ox = -16 + i * 6.5; ctx.beginPath(); ctx.moveTo(ox * 0.4, -26); ctx.bezierCurveTo(ox - 8, -26 + L * 0.3, ox + 8, -26 + L * 0.65, ox + (i % 2 ? 4 : -4), -26 + L); ctx.stroke(); }
  }
  if (L > 2 && broth) { ctx.fillStyle = broth; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(-2, -24 + L + 6, 4, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; }
  ctx.restore();
}
function shade(hex, amt) { let h = hex.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; const n = parseInt(h, 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; const f = function (c) { return Math.round(Math.max(0, Math.min(255, amt > 0 ? c + (255 - c) * amt : c * (1 + amt)))); }; return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1); }
// an option's little icon in the tray
function drawOption(ctx, A, slot, o, x, y, r) {
  if (slot === 'mold') { ctx.save(); ctx.translate(x, y); const k = r / 40; ctx.scale(k, k); draw(ctx, A, { recipe: 'jelly', mold: o.id, flavor: 'strawberry' }, 0, 6, 64, { flipped: true, tops: 0, deco: 0 }); ctx.restore(); return; }
  if (slot === 'flavor' || slot === 'broth') { A.rr(ctx, x - r * 0.35, y - r * 0.9, r * 0.7, r * 0.4, r * 0.1); ctx.fillStyle = '#f3e1c8'; ctx.fill(); ctx.beginPath(); ctx.moveTo(x - r * 0.25, y - r * 0.5); ctx.lineTo(x - r * 0.7, y); ctx.quadraticCurveTo(x - r * 0.7, y + r * 0.9, x, y + r * 0.9); ctx.quadraticCurveTo(x + r * 0.7, y + r * 0.9, x + r * 0.7, y); ctx.lineTo(x + r * 0.25, y - r * 0.5); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#5b3d3b'; ctx.stroke(); A.circle(ctx, x, y + r * 0.35, r * 0.48, o.color, 0); A.circle(ctx, x - r * 0.18, y + r * 0.2, r * 0.12, 'rgba(255,255,255,0.7)', 0); return; }
  if (slot === 'cup') { ctx.beginPath(); ctx.moveTo(x - r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 0.6, y - r * 0.6); ctx.lineTo(x + r * 0.45, y + r * 0.7); ctx.lineTo(x - r * 0.45, y + r * 0.7); ctx.closePath(); ctx.fillStyle = o.color; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#5b3d3b'; ctx.stroke(); return; }
  if (slot === 'shape') { ctx.save(); ctx.translate(x, y); const k = r / 46; ctx.scale(k, k); draw(ctx, A, { recipe: 'donut', shape: o.id, flavor: 'strawberry' }, 0, 0, 80, { set: true, fill: 0, tops: 0, deco: 0 }); ctx.restore(); return; }
  if (slot === 'deco') { A.circle(ctx, x, y, r * 0.75, '#fff', 3); ctx.save(); ctx.translate(x, y); for (let i = 0; i < 7; i++) { const a = i * 0.9, d = (i % 3) * r * 0.18; if (o.id === 'hearts') A.heart(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.12, o.color, 0); else if (o.id === 'stars' || o.id === 'gold') A.star(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.12, o.color, 0); else if (o.id === 'sprinkles') { ctx.save(); ctx.rotate(a); ctx.fillStyle = ['#ff7fa8', '#7fd4ff', '#ffe066', '#9fe37a'][i % 4]; ctx.fillRect(d - 4, -1.5, 8, 3); ctx.restore(); } else A.circle(ctx, Math.cos(a) * d, Math.sin(a) * d, r * 0.07, o.color === '#ffffff' || o.color === '#eef6ff' ? '#c8d8f0' : o.color, 0); } ctx.restore(); return; }
  // toppings
  ctx.save(); ctx.translate(x, y); ctx.scale(r / 10, r / 10); drawTopOnly(ctx, A, slot, o); ctx.restore();
}
function drawTopOnly(ctx, A, slot, o) {
  const c = o.color, id = o.id;
  if (id === 'cherry') { A.circle(ctx, 0, 1, 6, c, 1.5); ctx.strokeStyle = '#4a7a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -5); ctx.quadraticCurveTo(3, -9, 6, -9); ctx.stroke(); }
  else if (id === 'mint' || id === 'scallion') { A.ellipse(ctx, -3, 0, 5, 2.5, c, 1.2); A.ellipse(ctx, 3, 0, 5, 2.5, c, 1.2); }
  else if (id === 'choco_stick' || id === 'nori') { A.rr(ctx, -2, -8, 4, 16, 1.5); ctx.fillStyle = c; ctx.fill(); }
  else if (id === 'gold_star') A.star(ctx, 0, 0, 7, c, 1.2);
  else if (id === 'egg') { A.ellipse(ctx, 0, 0, 8, 6, '#fff', 1.5); A.circle(ctx, 0, 0, 3.5, c, 0); }
  else if (id === 'naruto') { A.circle(ctx, 0, 0, 7, '#fff', 1.5); ctx.strokeStyle = '#ff7fa8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 1.6); ctx.stroke(); }
  else if (id === 'pearls' || id === 'red_bean' || id === 'popping') { for (let i = 0; i < 3; i++) A.circle(ctx, (i - 1) * 4.5, (i % 2) * 3, 2.8, c, 0.8); }
  else if (id === 'jelly_cubes' || id === 'pudding_t') { A.rr(ctx, -5, -5, 10, 10, 2); ctx.fillStyle = c; ctx.fill(); }
  else if (id === 'sakura_t') { for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; A.circle(ctx, Math.cos(a) * 3.5, Math.sin(a) * 3.5, 3, c, 0.8); } }
  else A.circle(ctx, 0, 0, 6.5, c, 1.5);
}

module.exports = { setArt, noodleBite, shade, OPT, OPT_BY, opt, options, RECIPES, tasteOf, colorOf, toppingSlot, dishName, draw, drawOption };
