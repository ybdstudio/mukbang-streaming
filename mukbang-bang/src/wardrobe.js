'use strict';
// V3 Wardrobe (docs/GAME-DESIGN-V3.md §7): outfits, hair accessories, extras
// and themed looks. A secondary progression: items are level gifts or bought
// with coins; nothing here touches the eating loop.
// Overlays are drawn in "face units" relative to the head anchor, so they stay
// on the face while the streamer chews (the face parts swap, the head does not move).
const D = require('./data.js');
const C = D.COLORS;

// slot: outfit | hair | acc.  gift: level that gives it for free · price: coins (buy any time once the wardrobe is open)
const ITEMS = [
  { id: 'outfit_default', slot: 'outfit', name: 'My Sweater',    price: 0 },
  { id: 'outfit_mint',    slot: 'outfit', name: 'Mint Sweater',  price: 500,  body: 'luna', color: '#9fe3c9', dark: '#5fbf9f' },
  { id: 'outfit_bib',     slot: 'outfit', name: 'Mukbang Bib',   price: 800,  overlay: 'bib' },
  { id: 'outfit_sunny',   slot: 'outfit', name: 'Sunny Sweater', gift: 16,    body: 'kiko', color: '#ffd95e', dark: '#e0b52a' },
  { id: 'outfit_sakura',  slot: 'outfit', name: 'Sakura Sweater', gift: 24,   body: 'momo', color: '#ffb3c7', dark: '#e8759a' },
  { id: 'outfit_chef',    slot: 'outfit', name: 'Chef Apron',    gift: 27,    overlay: 'apron' },
  { id: 'outfit_star',    slot: 'outfit', name: 'Star Overalls', gift: 36,    overlay: 'overalls' },
  { id: 'hair_none',      slot: 'hair',   name: 'Nothing',       price: 0 },
  { id: 'hair_bow',       slot: 'hair',   name: 'Big Bow',       gift: 6 },
  { id: 'hair_star',      slot: 'hair',   name: 'Star Clip',     price: 300 },
  { id: 'hair_cat_ears',  slot: 'hair',   name: 'Cat Ears',      gift: 19 },
  { id: 'hair_beret',     slot: 'hair',   name: 'Red Beret',     price: 900 },
  { id: 'hair_flowers',   slot: 'hair',   name: 'Flower Crown',  gift: 29 },
  { id: 'hair_bunny_ears', slot: 'hair',  name: 'Bunny Ears',    gift: 34 },
  { id: 'hair_crown',     slot: 'hair',   name: 'Star Crown',    gift: 40 },
  { id: 'acc_none',       slot: 'acc',    name: 'Nothing',       price: 0 },
  { id: 'acc_blush',      slot: 'acc',    name: 'Heart Stickers', price: 400 },
  { id: 'acc_glasses_round', slot: 'acc', name: 'Round Glasses', gift: 13 },
  { id: 'acc_headphones', slot: 'acc',    name: 'Headphones',    gift: 22 },
  { id: 'acc_heart_glasses', slot: 'acc', name: 'Heart Glasses', gift: 31 },
  { id: 'acc_scarf',      slot: 'acc',    name: 'Cozy Scarf',    gift: 38 }
];
const BY_ID = {}; for (let i = 0; i < ITEMS.length; i++) BY_ID[ITEMS[i].id] = ITEMS[i];
const SLOTS = [{ id: 'outfit', name: 'OUTFITS' }, { id: 'hair', name: 'HAIR' }, { id: 'acc', name: 'EXTRAS' }];
const LOOKS = [
  { id: 'chef', name: 'CHEF LOOK', set: { outfit: 'outfit_chef', hair: 'hair_none', acc: 'acc_glasses_round' } },
  { id: 'kitty', name: 'KITTY LOOK', set: { outfit: 'outfit_sakura', hair: 'hair_cat_ears', acc: 'acc_blush' } },
  { id: 'superstar', name: 'SUPERSTAR', set: { outfit: 'outfit_star', hair: 'hair_crown', acc: 'acc_heart_glasses' } }
];
const OPEN_AT = 6; // the wardrobe opens with the level-6 gift

// ── profile state: wardrobe_json = { own: [...], eq: { luna: { outfit, hair, acc }, ... } } ──
function state(profile) { let s; try { s = JSON.parse(profile.get('wardrobe_json') || '{}'); } catch (e) { s = {}; } s.own = s.own || []; s.eq = s.eq || {}; return s; }
function save(profile, s) { profile.set('wardrobe_json', JSON.stringify(s)); }
function owns(s, id) { const it = BY_ID[id]; return !!it && (it.price === 0 && !it.gift || s.own.indexOf(id) >= 0); }
function look(profile, sid) { const s = state(profile); const e = s.eq[sid] || {}; return { outfit: e.outfit || 'outfit_default', hair: e.hair || 'hair_none', acc: e.acc || 'acc_none' }; }
function grant(profile, id) { const s = state(profile); if (BY_ID[id] && s.own.indexOf(id) < 0) { s.own.push(id); save(profile, s); return true; } return false; }
function equip(profile, sid, id) { const it = BY_ID[id]; const s = state(profile); if (!it || !owns(s, id)) return false; s.eq[sid] = s.eq[sid] || {}; s.eq[sid][it.slot] = id; save(profile, s); return true; }
// buy with coins (game currency, spent in the game — not an HS reward)
function buy(profile, id) { const it = BY_ID[id]; const s = state(profile); if (!it || !it.price || owns(s, id)) return 'no'; if ((profile.get('coins') || 0) < it.price) return 'coins'; profile.add('coins', -it.price); s.own.push(id); save(profile, s); return 'ok'; }

// ── drawing (in the caller's transform) ──
// F = face frame { cx, cy, r, ey }   B = body frame { nx, ny, bw }   ch = streamer data (hair colour)
function drawBody(ctx, A, lk, B) {
  const it = BY_ID[lk.outfit]; if (!it || !it.overlay) return;
  const x = B.nx, y = B.ny, w = B.bw, lw = w * 0.025;
  ctx.save(); ctx.lineJoin = 'round';
  if (it.overlay === 'apron') {
    ctx.beginPath(); ctx.moveTo(x - w * 0.22, y + w * 0.12); ctx.lineTo(x + w * 0.22, y + w * 0.12); ctx.lineTo(x + w * 0.3, y + w * 1.02); ctx.lineTo(x - w * 0.3, y + w * 1.02); ctx.closePath(); fs(ctx, '#ffffff', lw);
    A.rr(ctx, x - w * 0.12, y + w * 0.5, w * 0.24, w * 0.16, w * 0.04); fs(ctx, '#ffd1e3', lw * 0.7);
    ctx.lineWidth = lw * 1.4; ctx.strokeStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x - w * 0.2, y + w * 0.14); ctx.lineTo(x - w * 0.12, y - w * 0.02); ctx.moveTo(x + w * 0.2, y + w * 0.14); ctx.lineTo(x + w * 0.12, y - w * 0.02); ctx.stroke();
  } else if (it.overlay === 'bib') {
    ctx.beginPath(); ctx.moveTo(x - w * 0.24, y + w * 0.04); ctx.quadraticCurveTo(x, y + w * 0.2, x + w * 0.24, y + w * 0.04); ctx.lineTo(x + w * 0.22, y + w * 0.42); ctx.quadraticCurveTo(x, y + w * 0.62, x - w * 0.22, y + w * 0.42); ctx.closePath(); fs(ctx, '#ffffff', lw);
    ctx.lineWidth = lw * 1.2; ctx.strokeStyle = C.pink; ctx.setLineDash([w * 0.03, w * 0.025]); ctx.stroke(); ctx.setLineDash([]);
    A.text(ctx, 'YUM', x, y + w * 0.32, w * 0.11, C.pinkDark, 0);
  } else if (it.overlay === 'overalls') {
    A.rr(ctx, x - w * 0.3, y + w * 0.45, w * 0.6, w * 0.62, w * 0.08); fs(ctx, '#cdb0ff', lw);
    ctx.lineWidth = lw * 2.2; ctx.strokeStyle = '#a98ae6'; ctx.beginPath(); ctx.moveTo(x - w * 0.22, y + w * 0.47); ctx.lineTo(x - w * 0.16, y + w * 0.05); ctx.moveTo(x + w * 0.22, y + w * 0.47); ctx.lineTo(x + w * 0.16, y + w * 0.05); ctx.stroke();
    A.star(ctx, x, y + w * 0.68, w * 0.1, C.gold, lw * 0.8);
  }
  ctx.restore();
}
function drawHead(ctx, A, lk, F, ch, t) {
  const cx = F.cx, cy = F.cy, r = F.r, ey = F.ey, lw = r * 0.04;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // extras on the face first, hair accessories on top
  const acc = lk.acc;
  if (acc === 'acc_glasses_round' || acc === 'acc_heart_glasses') {
    for (let k = -1; k <= 1; k += 2) {
      const gx = cx + k * r * 0.4;
      if (acc === 'acc_glasses_round') { ctx.beginPath(); ctx.arc(gx, ey, r * 0.27, 0, Math.PI * 2); ctx.fillStyle = 'rgba(200,230,255,0.25)'; ctx.fill(); ctx.lineWidth = lw * 1.3; ctx.strokeStyle = C.outline; ctx.stroke(); }
      else { ctx.globalAlpha = 0.85; A.heart(ctx, gx, ey + r * 0.04, r * 0.24, '#ff7fa8', lw); ctx.globalAlpha = 1; }
    }
    ctx.lineWidth = lw * 1.2; ctx.strokeStyle = C.outline; ctx.beginPath(); ctx.moveTo(cx - r * 0.13, ey - r * 0.02); ctx.quadraticCurveTo(cx, ey - r * 0.1, cx + r * 0.13, ey - r * 0.02); ctx.stroke();
  } else if (acc === 'acc_headphones') {
    ctx.lineWidth = r * 0.12; ctx.strokeStyle = C.outline; ctx.beginPath(); ctx.arc(cx, cy, r * 1.16, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    ctx.lineWidth = r * 0.08; ctx.strokeStyle = '#ff9fc4'; ctx.beginPath(); ctx.arc(cx, cy, r * 1.16, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    for (let k = -1; k <= 1; k += 2) { A.ellipse(ctx, cx + k * r * 1.08, cy + r * 0.05, r * 0.2, r * 0.3, '#ff9fc4', lw); A.ellipse(ctx, cx + k * r * 1.1, cy + r * 0.05, r * 0.1, r * 0.18, '#fff3f7', 0); }
  } else if (acc === 'acc_blush') {
    for (let k = -1; k <= 1; k += 2) A.heart(ctx, cx + k * r * 0.6, ey + r * 0.38, r * 0.1, '#ff7fa8', lw * 0.6);
  } else if (acc === 'acc_scarf') {
    const ny = F.ny || cy + r * 0.95;
    A.rr(ctx, cx - r * 0.75, ny - r * 0.12, r * 1.5, r * 0.3, r * 0.14); fs(ctx, '#ff7a8a', lw);
    A.rr(ctx, cx + r * 0.25, ny + r * 0.05, r * 0.26, r * 0.55, r * 0.1); fs(ctx, '#ff7a8a', lw);
    ctx.lineWidth = lw; ctx.strokeStyle = '#fff3f7'; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(cx + i * r * 0.25, ny - r * 0.1); ctx.lineTo(cx + i * r * 0.25, ny + r * 0.16); ctx.stroke(); }
  }
  const hair = lk.hair; const hc = (ch && ch.hair) || '#cdb0ff';
  if (hair === 'hair_bow') { ctx.save(); ctx.translate(cx - r * 0.66, cy - r * 0.92); ctx.rotate(-0.35); A.ellipse(ctx, -r * 0.2, 0, r * 0.22, r * 0.15, '#ff5a8a', lw); A.ellipse(ctx, r * 0.2, 0, r * 0.22, r * 0.15, '#ff5a8a', lw); A.circle(ctx, 0, 0, r * 0.09, '#e8406f', lw * 0.8); ctx.restore(); }
  else if (hair === 'hair_star') { A.star(ctx, cx - r * 0.66, cy - r * 0.86, r * 0.2, C.gold, lw); }
  else if (hair === 'hair_cat_ears' || hair === 'hair_bunny_ears') {
    for (let k = -1; k <= 1; k += 2) {
      if (hair === 'hair_cat_ears') { ctx.beginPath(); ctx.moveTo(cx + k * r * 0.34, cy - r * 1.0); ctx.lineTo(cx + k * r * 0.74, cy - r * 1.42); ctx.lineTo(cx + k * r * 0.86, cy - r * 0.86); ctx.closePath(); fs(ctx, hc, lw); ctx.beginPath(); ctx.moveTo(cx + k * r * 0.46, cy - r * 1.0); ctx.lineTo(cx + k * r * 0.72, cy - r * 1.28); ctx.lineTo(cx + k * r * 0.78, cy - r * 0.95); ctx.closePath(); ctx.fillStyle = '#ffb3c7'; ctx.fill(); }
      else { ctx.save(); ctx.translate(cx + k * r * 0.32, cy - r * 1.28); ctx.rotate(k * 0.18); A.ellipse(ctx, 0, 0, r * 0.17, r * 0.5, '#ffffff', lw); A.ellipse(ctx, 0, r * 0.04, r * 0.08, r * 0.34, '#ffd1e3', 0); ctx.restore(); }
    }
  }
  else if (hair === 'hair_beret') { ctx.save(); ctx.translate(cx + r * 0.1, cy - r * 1.0); ctx.rotate(0.15); A.ellipse(ctx, 0, 0, r * 0.85, r * 0.3, '#ff5a5a', lw); A.circle(ctx, 0, -r * 0.3, r * 0.07, '#c93b3b', 0); ctx.restore(); }
  else if (hair === 'hair_flowers') { const cols = ['#ff9fc4', '#fff3b0', '#cdb0ff', '#9fe3c9', '#ffb199']; for (let i = 0; i < 5; i++) { const a = Math.PI * (1.15 + i * 0.175); const fx = cx + Math.cos(a) * r * 0.98, fy = cy + Math.sin(a) * r * 0.98; for (let p = 0; p < 5; p++) { const pa = p * Math.PI * 2 / 5; A.circle(ctx, fx + Math.cos(pa) * r * 0.08, fy + Math.sin(pa) * r * 0.08, r * 0.07, cols[i], lw * 0.5); } A.circle(ctx, fx, fy, r * 0.05, C.gold, 0); } }
  else if (hair === 'hair_crown') { const y0 = cy - r * 1.05, w = r * 0.7; ctx.beginPath(); ctx.moveTo(cx - w / 2, y0); ctx.lineTo(cx - w / 2, y0 - r * 0.3); ctx.lineTo(cx - w / 4, y0 - r * 0.14); ctx.lineTo(cx, y0 - r * 0.38); ctx.lineTo(cx + w / 4, y0 - r * 0.14); ctx.lineTo(cx + w / 2, y0 - r * 0.3); ctx.lineTo(cx + w / 2, y0); ctx.closePath(); fs(ctx, C.gold, lw); A.circle(ctx, cx, y0 - r * 0.1, r * 0.06, '#ff7fa8', 0); A.sparkle(ctx, cx + w * 0.7, y0 - r * 0.3 + Math.sin((t || 0) * 4) * r * 0.04, r * 0.08, '#fff'); }
  ctx.restore();
}
function fs(ctx, fill, lw) { ctx.fillStyle = fill; ctx.fill(); if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = C.outline; ctx.stroke(); } }

module.exports = { ITEMS, BY_ID, SLOTS, LOOKS, OPEN_AT, state, save, owns, look, grant, equip, buy, drawBody, drawHead };
