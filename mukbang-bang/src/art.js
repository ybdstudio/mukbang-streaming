'use strict';
// Everything on screen is vector-drawn here: kawaii foods (with an "eaten"
// fraction), the streamers with their faces, backgrounds (cached), store
// props, reactions, chat avatars. No image files.
const U = require('./util.js');
const D = require('./data.js');
const C = D.COLORS;
const OUT = C.outline;
const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}
function fillStroke(ctx, fill, lw, stroke) { if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = stroke || OUT; ctx.lineJoin = 'round'; ctx.stroke(); } }
function circle(ctx, x, y, r, fill, lw, stroke) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); fillStroke(ctx, fill, lw, stroke); }
function ellipse(ctx, x, y, rx, ry, fill, lw, stroke) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); fillStroke(ctx, fill, lw, stroke); }
function shade(hex, amt) { // lighten (amt>0) or darken (amt<0) a #rrggbb
  let h = hex.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16); let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = function (c) { return Math.round(U.clamp(amt > 0 ? c + (255 - c) * amt : c * (1 + amt), 0, 255)); };
  r = f(r); g = f(g); b = f(b);
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function text(ctx, str, x, y, size, color, stroke, align) {
  ctx.font = 'bold ' + Math.round(size) + 'px sans-serif'; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  if (stroke) { ctx.lineWidth = stroke; ctx.strokeStyle = OUT; ctx.strokeText(str, x, y); }
  ctx.fillStyle = color; ctx.fillText(str, x, y);
}

// ─── small icons ───
function coin(ctx, x, y, r) { circle(ctx, x, y, r, C.gold, Math.max(2, r * 0.22)); circle(ctx, x, y, r * 0.62, C.goldDark, 0); text(ctx, '$', x, y + r * 0.05, r * 1.1, C.gold, 0); }
function star(ctx, x, y, r, fill, lw) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5; const rad = i % 2 ? r * 0.48 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  ctx.closePath(); fillStroke(ctx, fill, lw === undefined ? r * 0.18 : lw);
}
function heart(ctx, x, y, s, fill, lw) {
  ctx.beginPath(); ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.4, y - s * 0.1, x - s * 0.7, y - s * 1.1, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.1, x + s * 1.4, y - s * 0.1, x, y + s * 0.9); ctx.closePath();
  fillStroke(ctx, fill, lw === undefined ? s * 0.22 : lw);
}
function eyeIcon(ctx, x, y, r, color) { ctx.beginPath(); ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x, y - r * 1.1, x + r, y); ctx.quadraticCurveTo(x, y + r * 1.1, x - r, y); ctx.closePath(); ctx.fillStyle = color || '#fff'; ctx.fill(); circle(ctx, x, y, r * 0.42, OUT, 0); }
function sparkle(ctx, x, y, s, color) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.closePath(); ctx.fillStyle = color || '#fff'; ctx.fill(); }
function lock(ctx, x, y, s) { rr(ctx, x - s * 0.5, y - s * 0.1, s, s * 0.8, s * 0.18); fillStroke(ctx, C.goldDark, s * 0.12); ctx.beginPath(); ctx.arc(x, y - s * 0.2, s * 0.3, Math.PI, 0); ctx.lineWidth = s * 0.14; ctx.strokeStyle = OUT; ctx.stroke(); circle(ctx, x, y + 0.3 * s, s * 0.1, OUT, 0); }

// ─── reactions floating over the stream ───
function reaction(ctx, kind, x, y, s) {
  if (kind === 'heart') { heart(ctx, x, y, s, C.red); return; }
  if (kind === 'star') { star(ctx, x, y, s, C.gold); return; }
  if (kind === 'like') { circle(ctx, x, y, s, C.blue, s * 0.18); rr(ctx, x - s * 0.55, y - s * 0.05, s * 0.3, s * 0.55, s * 0.08); fillStroke(ctx, '#fff', 0); rr(ctx, x - s * 0.2, y - s * 0.1, s * 0.65, s * 0.6, s * 0.15); fillStroke(ctx, '#fff', 0); rr(ctx, x - s * 0.15, y - s * 0.55, s * 0.28, s * 0.55, s * 0.14); fillStroke(ctx, '#fff', 0); return; }
  // faces
  circle(ctx, x, y, s, C.gold, s * 0.16);
  if (kind === 'laugh') { ctx.lineWidth = s * 0.14; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.arc(x - s * 0.36, y - s * 0.2, s * 0.2, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(x + s * 0.36, y - s * 0.2, s * 0.2, Math.PI, 0); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y + s * 0.15, s * 0.45, 0, Math.PI); ctx.closePath(); fillStroke(ctx, OUT, 0); ctx.beginPath(); ctx.arc(x, y + s * 0.35, s * 0.25, 0, Math.PI); fillStroke(ctx, C.red, 0); }
  else if (kind === 'love') { heart(ctx, x - s * 0.36, y - s * 0.2, s * 0.26, C.red, 0); heart(ctx, x + s * 0.36, y - s * 0.2, s * 0.26, C.red, 0); ctx.beginPath(); ctx.arc(x, y + s * 0.2, s * 0.4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = s * 0.14; ctx.strokeStyle = OUT; ctx.stroke(); }
  else if (kind === 'cool') { rr(ctx, x - s * 0.75, y - s * 0.4, s * 0.65, s * 0.4, s * 0.1); fillStroke(ctx, OUT, 0); rr(ctx, x + s * 0.1, y - s * 0.4, s * 0.65, s * 0.4, s * 0.1); fillStroke(ctx, OUT, 0); ctx.beginPath(); ctx.arc(x, y + s * 0.2, s * 0.4, 0.2 * Math.PI, 0.8 * Math.PI); ctx.lineWidth = s * 0.14; ctx.strokeStyle = OUT; ctx.stroke(); }
  else { circle(ctx, x - s * 0.33, y - s * 0.15, s * 0.13, OUT, 0); circle(ctx, x + s * 0.33, y - s * 0.15, s * 0.13, OUT, 0); ctx.beginPath(); ctx.arc(x, y + s * 0.15, s * 0.42, 0.15 * Math.PI, 0.85 * Math.PI); ctx.lineWidth = s * 0.14; ctx.strokeStyle = OUT; ctx.stroke(); }
}

// ─── chat avatars (animal faces in a circle) ───
function avatar(ctx, kind, x, y, r) {
  const col = { cat: '#ffc98a', dog: '#d9b48a', bunny: '#fff', duck: '#ffe066', bear: '#c99b6a', frog: '#9fe37a', pig: '#ffb3c7' }[kind] || '#fff';
  const lw = Math.max(2, r * 0.14);
  circle(ctx, x, y, r, '#fff', lw);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r - lw / 2, 0, TAU); ctx.clip();
  // ears / head shape
  if (kind === 'cat') { ctx.beginPath(); ctx.moveTo(x - r * 0.7, y - r * 0.2); ctx.lineTo(x - r * 0.55, y - r * 0.95); ctx.lineTo(x - r * 0.1, y - r * 0.5); ctx.closePath(); fillStroke(ctx, col, lw * 0.7); ctx.beginPath(); ctx.moveTo(x + r * 0.7, y - r * 0.2); ctx.lineTo(x + r * 0.55, y - r * 0.95); ctx.lineTo(x + r * 0.1, y - r * 0.5); ctx.closePath(); fillStroke(ctx, col, lw * 0.7); }
  if (kind === 'bear' || kind === 'pig') { circle(ctx, x - r * 0.55, y - r * 0.55, r * 0.3, col, lw * 0.7); circle(ctx, x + r * 0.55, y - r * 0.55, r * 0.3, col, lw * 0.7); }
  if (kind === 'bunny') { ellipse(ctx, x - r * 0.3, y - r * 0.8, r * 0.18, r * 0.5, col, lw * 0.7); ellipse(ctx, x + r * 0.3, y - r * 0.8, r * 0.18, r * 0.5, col, lw * 0.7); }
  circle(ctx, x, y + r * 0.05, r * 0.72, col, lw * 0.7);
  if (kind === 'dog') { ellipse(ctx, x - r * 0.62, y - r * 0.05, r * 0.2, r * 0.42, shade(col, -0.25), lw * 0.7); ellipse(ctx, x + r * 0.62, y - r * 0.05, r * 0.2, r * 0.42, shade(col, -0.25), lw * 0.7); }
  if (kind === 'frog') { circle(ctx, x - r * 0.35, y - r * 0.5, r * 0.22, col, lw * 0.7); circle(ctx, x + r * 0.35, y - r * 0.5, r * 0.22, col, lw * 0.7); circle(ctx, x - r * 0.35, y - r * 0.5, r * 0.09, OUT, 0); circle(ctx, x + r * 0.35, y - r * 0.5, r * 0.09, OUT, 0); }
  else { circle(ctx, x - r * 0.26, y - r * 0.05, r * 0.09, OUT, 0); circle(ctx, x + r * 0.26, y - r * 0.05, r * 0.09, OUT, 0); }
  if (kind === 'duck') { ellipse(ctx, x, y + r * 0.22, r * 0.3, r * 0.16, '#ff9f4a', lw * 0.6); }
  else if (kind === 'pig') { ellipse(ctx, x, y + r * 0.22, r * 0.3, r * 0.2, shade(col, -0.15), lw * 0.6); circle(ctx, x - r * 0.1, y + r * 0.22, r * 0.05, OUT, 0); circle(ctx, x + r * 0.1, y + r * 0.22, r * 0.05, OUT, 0); }
  else { ctx.beginPath(); ctx.arc(x, y + r * 0.18, r * 0.16, 0.1 * Math.PI, 0.9 * Math.PI); ctx.lineWidth = lw * 0.6; ctx.strokeStyle = OUT; ctx.stroke(); }
  circle(ctx, x - r * 0.42, y + r * 0.18, r * 0.11, 'rgba(255,120,150,0.5)', 0); circle(ctx, x + r * 0.42, y + r * 0.18, r * 0.11, 'rgba(255,120,150,0.5)', 0);
  ctx.restore();
}

// ─── foods ───
// Draws `food` centred at (x, y) in a box of `size`; `e` = eaten fraction 0..1.
function food(ctx, f, x, y, size, e, t) {
  e = U.clamp(e || 0, 0, 1); t = t || 0;
  ctx.save(); ctx.translate(x, y); const s = size / 100; ctx.scale(s, s);
  const lw = 4;
  switch (f.cat) {
    case 'noodles': drawCup(ctx, f, e, lw, t); break;
    case 'snacks': drawBag(ctx, f, e, lw); break;
    case 'drinks': drawDrink(ctx, f, e, lw); break;
    case 'cakes': drawCake(ctx, f, e, lw); break;
    case 'icecream': drawIce(ctx, f, e, lw); break;
    case 'fruit': drawFruit(ctx, f, e, lw); break;
  }
  ctx.restore();
}
// cup noodle: body 60 wide at top, 46 at bottom, 62 tall; noodle mound on top
function drawCup(ctx, f, e, lw, t) {
  const top = -10, bot = 50;
  ctx.beginPath(); ctx.moveTo(-34, top); ctx.lineTo(34, top); ctx.lineTo(26, bot); ctx.lineTo(-26, bot); ctx.closePath(); fillStroke(ctx, f.c2, lw);
  // label band
  ctx.save(); ctx.beginPath(); ctx.moveTo(-34, top); ctx.lineTo(34, top); ctx.lineTo(26, bot); ctx.lineTo(-26, bot); ctx.closePath(); ctx.clip();
  ctx.fillStyle = f.c1; ctx.fillRect(-40, 8, 80, 24);
  ctx.fillStyle = f.c3; ctx.fillRect(-40, 30, 80, 4);
  text(ctx, f.label, 0, 20, 11, '#fff', 2.5);
  // little mascot ears on the band
  circle(ctx, -22, 40, 4, f.c3, 0); circle(ctx, 22, 40, 4, f.c3, 0);
  ctx.restore();
  // rim
  ellipse(ctx, 0, top, 34, 9, shade(f.c2, -0.1), lw);
  ellipse(ctx, 0, top, 29, 6, f.c3 === '#3d2f3a' ? '#5a4a56' : '#ffb15c', 0);
  // noodle mound shrinks as eaten
  const m = 1 - e;
  if (m > 0.02) {
    ctx.save(); ctx.translate(0, top); ctx.scale(1, m);
    ellipse(ctx, 0, -8, 30, 16, f.v === 5 ? '#4a3a46' : '#ffd36b', lw);
    ctx.lineWidth = 2.5; ctx.strokeStyle = f.v === 5 ? '#2a2026' : '#e8a93a';
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(i * 10 - 8, -4); ctx.quadraticCurveTo(i * 10 - 4, -18, i * 10, -10); ctx.quadraticCurveTo(i * 10 + 4, -2, i * 10 + 8, -14); ctx.stroke(); }
    // toppings by variant
    if (f.v === 0) { circle(ctx, -12, -14, 5, '#ff4a3a', 2); circle(ctx, 10, -10, 5, '#ff4a3a', 2); circle(ctx, 0, -20, 4, '#7ed37a', 2); }
    if (f.v === 1) { ellipse(ctx, 0, -14, 12, 7, '#fff2b3', 2); ellipse(ctx, 0, -14, 6, 4, '#ffcf40', 0); }
    if (f.v === 2) { circle(ctx, -12, -14, 7, '#c9a27c', 2); circle(ctx, 10, -12, 6, '#c9a27c', 2); }
    if (f.v === 3) { circle(ctx, -12, -14, 6, '#ffb3c7', 2); circle(ctx, 10, -12, 6, '#ffb3c7', 2); circle(ctx, 0, -20, 3, '#ff6f91', 0); }
    if (f.v === 4) { circle(ctx, -11, -13, 6, '#ffd6e6', 2); circle(ctx, -11, -13, 3, '#ff6f91', 0); circle(ctx, 10, -12, 6, '#ffd6e6', 2); circle(ctx, 10, -12, 3, '#ff6f91', 0); }
    if (f.v === 5) { circle(ctx, -10, -14, 4, '#2a2026', 0); circle(ctx, 8, -12, 4, '#2a2026', 0); circle(ctx, 0, -18, 3, '#7ed37a', 0); }
    ctx.restore();
    // steam
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
    for (let i = -1; i <= 1; i++) { const ph = t * 2 + i; ctx.beginPath(); ctx.moveTo(i * 14, top - 24 * m); ctx.quadraticCurveTo(i * 14 + Math.sin(ph) * 5, top - 36 * m, i * 14, top - 46 * m); ctx.stroke(); }
  }
}
// snack bag
function drawBag(ctx, f, e, lw) {
  const w = 62, h = 76, x0 = -31, y0 = -38;
  rr(ctx, x0, y0 + 6, w, h - 12, 8); fillStroke(ctx, f.c1, lw);
  // crimped seals
  const seal = function (yy) { ctx.beginPath(); ctx.moveTo(x0, yy + 6); for (let i = 0; i <= 8; i++) ctx.lineTo(x0 + i * (w / 8), yy + (i % 2 ? 0 : 6)); ctx.lineTo(x0 + w, yy + 6); ctx.closePath(); fillStroke(ctx, shade(f.c1, -0.2), lw); };
  seal(y0); seal(y0 + h - 6);
  if (e > 0) { // torn open top
    ctx.beginPath(); ctx.moveTo(x0 + 8, y0 + 6); ctx.lineTo(x0 + 18, y0 - 2); ctx.lineTo(x0 + 28, y0 + 8); ctx.lineTo(x0 + 40, y0 - 4); ctx.lineTo(x0 + 52, y0 + 6); fillStroke(ctx, f.c2, lw);
  }
  // window with contents
  rr(ctx, -20, -8, 40, 30, 6); fillStroke(ctx, f.c2, lw * 0.7);
  ctx.save(); rr(ctx, -20, -8, 40, 30, 6); ctx.clip();
  const level = 22 - 30 * (1 - e); // contents fill from bottom
  const cols = f.v === 1 ? ['#ff6f91', '#ffd95e', '#7ed37a', '#8fd1ff', '#b878e8'] : f.v === 5 ? ['#ff6f91', '#ffd95e', '#7ed37a', '#ff9f4a'] : f.v === 3 ? ['#2f9c55', '#6fcf8e'] : f.v === 4 ? ['#7a4b2f', '#b57c5a'] : f.v === 2 ? ['#ffb84d', '#ffd36b'] : ['#ffb84d', '#ffd36b', '#f2a43c'];
  for (let i = 0; i < 9; i++) { const cx = -14 + (i % 3) * 14, cy = 18 - Math.floor(i / 3) * 10; if (cy < level) continue; if (f.v === 1 || f.v === 5) circle(ctx, cx, cy, 5, cols[i % cols.length], 2); else { ctx.beginPath(); ctx.ellipse(cx, cy, 7, 4, (i % 2) * 0.6, 0, TAU); fillStroke(ctx, cols[i % cols.length], 2); } }
  ctx.restore();
  // label
  rr(ctx, -24, -32, 48, 18, 6); fillStroke(ctx, f.c3, lw * 0.7); text(ctx, f.label, 0, -23, 11, '#fff', 2);
  // mascot: little face at bottom
  circle(ctx, 0, 30, 6, '#fff', 2); circle(ctx, -2, 29, 1.2, OUT, 0); circle(ctx, 2, 29, 1.2, OUT, 0);
}
// drinks: carton (v0,1), cup+straw (v2,4,5), bottle (v3)
function drawDrink(ctx, f, e, lw) {
  const level = 1 - e;
  if (f.v === 0 || f.v === 1) { // carton
    ctx.beginPath(); ctx.moveTo(-24, -14); ctx.lineTo(-20, -36); ctx.lineTo(20, -36); ctx.lineTo(24, -14); ctx.lineTo(24, 44); ctx.lineTo(-24, 44); ctx.closePath(); fillStroke(ctx, f.c2, lw);
    ctx.fillStyle = f.c1; ctx.fillRect(-24, -2, 48, 24); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.strokeRect(-24, -2, 48, 24);
    text(ctx, f.label, 0, 10, 11, '#fff', 2.5);
    // gauge window
    rr(ctx, 12, -10, 8, 50, 3); fillStroke(ctx, '#fff', 2); ctx.fillStyle = f.c1; ctx.fillRect(13, -9 + 48 * (1 - level), 6, 48 * level);
    rr(ctx, -6, -44, 12, 10, 3); fillStroke(ctx, '#fff', lw * 0.6); // straw
    rr(ctx, 8, -46, 5, 16, 2); fillStroke(ctx, f.c3, 2);
    circle(ctx, -8, 32, 5, '#fff', 2); circle(ctx, -9.5, 31, 1.2, OUT, 0); circle(ctx, -6.5, 31, 1.2, OUT, 0);
  } else if (f.v === 3) { // can
    rr(ctx, -22, -38, 44, 82, 10); fillStroke(ctx, f.c1, lw);
    ellipse(ctx, 0, -36, 20, 6, '#d9d9d9', lw * 0.7); rr(ctx, -5, -40, 10, 4, 2); fillStroke(ctx, '#aaa', 1.5);
    rr(ctx, -22, -8, 44, 30, 6); fillStroke(ctx, f.c2, 0); text(ctx, f.label, 0, 7, 12, f.c3, 0);
    circle(ctx, 0, -20, 8, '#fff', 2); circle(ctx, -3, -21, 1.5, OUT, 0); circle(ctx, 3, -21, 1.5, OUT, 0);
    // bubbles / level
    ctx.save(); rr(ctx, -22, -38, 44, 82, 10); ctx.clip(); ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-22, -38, 44, 82 * e); ctx.restore();
  } else { // cup with lid and straw
    ctx.beginPath(); ctx.moveTo(-26, -28); ctx.lineTo(26, -28); ctx.lineTo(20, 44); ctx.lineTo(-20, 44); ctx.closePath(); fillStroke(ctx, 'rgba(255,255,255,0.75)', lw);
    ctx.save(); ctx.beginPath(); ctx.moveTo(-26, -28); ctx.lineTo(26, -28); ctx.lineTo(20, 44); ctx.lineTo(-20, 44); ctx.closePath(); ctx.clip();
    ctx.fillStyle = f.c1; ctx.fillRect(-30, 44 - 70 * level, 60, 70 * level);
    if (f.v === 4) { for (let i = 0; i < 6; i++) circle(ctx, -14 + (i % 3) * 14, 36 - Math.floor(i / 3) * 10, 4, '#3b2a2a', 0); }
    if (f.v === 2) { ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-30, 44 - 70 * level, 60, 12); }
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(-20, -20, 7, 60);
    ctx.restore();
    rr(ctx, -30, -34, 60, 10, 4); fillStroke(ctx, f.c2, lw * 0.7); // lid
    ctx.save(); ctx.translate(8, -34); ctx.rotate(0.18); rr(ctx, -4, -24, 8, 28, 3); fillStroke(ctx, f.c3, 2); ctx.restore();
    text(ctx, f.label, 0, 20, 10, f.c3, 0);
    if (f.v === 5) { circle(ctx, -14, -40, 6, '#ff5a74', 2); } // strawberry on smoothie
  }
}
// cake slice on a plate — seen from the side; the slice shrinks from the right as eaten
function drawCake(ctx, f, e, lw) {
  ellipse(ctx, 0, 36, 44, 12, '#fff', lw); ellipse(ctx, 0, 36, 34, 7, '#eef3ff', 0);
  const w = 56 * (1 - e * 0.92); if (w < 4) return;
  const x0 = -28, h = 48, y0 = -12;
  if (f.v === 5) { // rainbow crepe layers
    const cols = ['#ff9ecf', '#ffc36b', '#fff28a', '#b7e3a1', '#8fd1ff', '#cdb0ff'];
    for (let i = 0; i < 6; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(x0, y0 + i * 8, w, 8); }
    ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.strokeRect(x0, y0, w, h);
  } else if (f.v === 1) { // matcha roll: cylinder with swirl
    rr(ctx, x0, y0, w, h, 10); fillStroke(ctx, f.c1, lw); ctx.save(); rr(ctx, x0, y0, w, h, 10); ctx.clip(); ctx.strokeStyle = f.c2; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x0 + 28, y0 + 24, 16, 0, Math.PI * 1.7); ctx.stroke(); ctx.beginPath(); ctx.arc(x0 + 28, y0 + 24, 7, 0, Math.PI * 1.5); ctx.stroke(); ctx.restore();
  } else {
    // layered wedge: 3 cake layers + cream
    const layers = f.v === 2 ? ['#5a3622', '#8a5a3c', '#d9a877', '#8a5a3c'] : f.v === 3 ? ['#f3c58b', '#fff4d0', '#fff4d0', '#ffd16b'] : f.v === 4 ? ['#f3c58b', '#f3c58b', '#fff4d0', '#7a4fb8'] : ['#fff5f7', '#ff6f91', '#fff5f7', '#f4b6c6'];
    const lh = h / layers.length;
    for (let i = 0; i < layers.length; i++) { ctx.fillStyle = layers[layers.length - 1 - i]; ctx.fillRect(x0, y0 + i * lh, w, lh); }
    ctx.strokeStyle = OUT; ctx.lineWidth = lw; ctx.strokeRect(x0, y0, w, h);
    // top frosting
    rr(ctx, x0 - 2, y0 - 6, w + 4, 10, 5); fillStroke(ctx, f.v === 2 ? '#5a3622' : f.v === 3 ? '#ffd16b' : f.v === 4 ? '#7a4fb8' : '#fff5f7', lw * 0.7);
  }
  // topping on the left end (stays until the slice is gone)
  if (f.v === 0 || f.v === 4) { circle(ctx, x0 + 12, y0 - 14, 8, '#ff5a74', 2.5); circle(ctx, x0 + 10, y0 - 17, 1.5, '#ffe9a8', 0); ctx.beginPath(); ctx.moveTo(x0 + 12, y0 - 22); ctx.lineTo(x0 + 6, y0 - 26); ctx.lineTo(x0 + 14, y0 - 28); ctx.closePath(); fillStroke(ctx, C.green, 2); }
  if (f.v === 2 || f.v === 1) { circle(ctx, x0 + 12, y0 - 12, 6, '#ff3b5c', 2.5); ctx.beginPath(); ctx.moveTo(x0 + 12, y0 - 18); ctx.quadraticCurveTo(x0 + 16, y0 - 28, x0 + 20, y0 - 26); ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.stroke(); }
  if (f.v === 3) { ellipse(ctx, x0 + 12, y0 - 12, 10, 5, '#ffcf5c', 2.5); }
  if (f.v === 5) { circle(ctx, x0 + 10, y0 - 12, 7, '#fff', 2.5); circle(ctx, x0 + 10, y0 - 12, 3, '#ff6f91', 0); }
}
// ice cream: cup (v0,1,3,4) or cone (v2,5); scoops shrink as eaten
function drawIce(ctx, f, e, lw) {
  const m = 1 - e * 0.95;
  if (f.v === 2 || f.v === 5) {
    ctx.beginPath(); ctx.moveTo(-22, 0); ctx.lineTo(22, 0); ctx.lineTo(0, 48); ctx.closePath(); fillStroke(ctx, '#e8b267', lw);
    ctx.strokeStyle = '#c48a3a'; ctx.lineWidth = 2; for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(-22 + (i + 2) * 11, 0); ctx.lineTo(0 + i * 3, 46); ctx.stroke(); }
    if (m > 0.05) { ctx.save(); ctx.translate(0, 0); ctx.scale(m, m);
      if (f.v === 2) { ctx.beginPath(); ctx.moveTo(-24, 0); ctx.quadraticCurveTo(-26, -24, -14, -28); ctx.quadraticCurveTo(-18, -44, -4, -44); ctx.quadraticCurveTo(0, -62, 8, -46); ctx.quadraticCurveTo(22, -46, 16, -30); ctx.quadraticCurveTo(28, -22, 24, 0); ctx.closePath(); fillStroke(ctx, f.c1, lw); circle(ctx, 2, -56, 6, '#ff3b5c', 2.5); }
      else { circle(ctx, 0, -14, 24, f.c1, lw); circle(ctx, -8, -36, 16, f.c2, lw); circle(ctx, 10, -34, 14, f.c1, lw); for (let i = 0; i < 5; i++) circle(ctx, -14 + i * 7, -14 + (i % 2) * 8, 2.5, ['#ff6f91', '#ffd95e', '#7ed37a', '#b878e8', '#fff'][i], 0); }
      ctx.restore(); }
  } else {
    ctx.beginPath(); ctx.moveTo(-30, -6); ctx.lineTo(30, -6); ctx.lineTo(24, 44); ctx.lineTo(-24, 44); ctx.closePath(); fillStroke(ctx, f.c3 === '#5ac79f' ? '#d4f5e8' : shade(f.c1, 0.55), lw);
    ctx.fillStyle = f.c1; ctx.fillRect(-28, 16, 56, 12); text(ctx, f.label, 0, 22, 10, '#fff', 2);
    ellipse(ctx, 0, -6, 30, 8, '#fff', lw * 0.7);
    if (m > 0.05) { ctx.save(); ctx.translate(0, -8); ctx.scale(m, m);
      circle(ctx, -12, -12, 17, f.c1, lw); circle(ctx, 12, -12, 17, f.v === 1 ? f.c2 : f.c1, lw); circle(ctx, 0, -28, 17, f.v === 4 ? f.c1 : f.c2, lw);
      if (f.v === 0 || f.v === 4) { for (let i = 0; i < 6; i++) circle(ctx, -14 + (i % 3) * 14, -32 + Math.floor(i / 3) * 14, 2.5, f.c2 === '#3b2f2f' ? '#3b2f2f' : '#6b4a37', 0); }
      if (f.v === 1) { ctx.fillStyle = '#5a3622'; ctx.beginPath(); ctx.moveTo(-10, -40); ctx.quadraticCurveTo(0, -30, 12, -40); ctx.quadraticCurveTo(14, -20, 0, -18); ctx.quadraticCurveTo(-14, -20, -10, -40); ctx.fill(); circle(ctx, 0, -46, 5, '#ff3b5c', 2.5); }
      if (f.v === 3) { ellipse(ctx, 6, -40, 8, 4, '#ffd16b', 2); }
      if (f.v === 5) { star(ctx, 0, -44, 7, '#fff', 2); }
      ctx.restore(); }
  }
}
// fruit: watermelon bowl (v0), plates (others); pieces vanish as eaten
function drawFruit(ctx, f, e, lw) {
  const n = 6, left = Math.ceil(n * (1 - e));
  if (f.v === 0) {
    ctx.beginPath(); ctx.arc(0, 0, 36, 0, Math.PI); ctx.closePath(); fillStroke(ctx, C.green, lw);
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI); ctx.closePath(); fillStroke(ctx, '#fff', 0);
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI); ctx.closePath(); fillStroke(ctx, f.c1, 0);
    ellipse(ctx, 0, 0, 36, 10, '#ffb3c7', lw);
    const cols = ['#ffd95e', '#7ed37a', '#8fd1ff', '#ff6f91', '#b878e8', '#ff9f4a'];
    for (let i = 0; i < left; i++) { const cx = -20 + (i % 3) * 20, cy = -8 - Math.floor(i / 3) * 12; rr(ctx, cx - 7, cy - 7, 14, 14, 3); fillStroke(ctx, cols[i], 2); }
    circle(ctx, 0, 14, 5, OUT, 0); circle(ctx, -14, 10, 3, OUT, 0); circle(ctx, 14, 10, 3, OUT, 0);
    return;
  }
  ellipse(ctx, 0, 20, 44, 14, '#fff', lw); ellipse(ctx, 0, 20, 34, 8, '#eef9ff', 0);
  for (let i = 0; i < left; i++) {
    const cx = -24 + (i % 3) * 24, cy = 8 - Math.floor(i / 3) * 18;
    if (f.v === 1) { ctx.beginPath(); ctx.moveTo(cx, cy + 10); ctx.quadraticCurveTo(cx - 12, cy - 4, cx, cy - 10); ctx.quadraticCurveTo(cx + 12, cy - 4, cx, cy + 10); ctx.closePath(); fillStroke(ctx, f.c1, 2.5); ctx.beginPath(); ctx.moveTo(cx - 6, cy - 9); ctx.lineTo(cx, cy - 4); ctx.lineTo(cx + 6, cy - 9); ctx.closePath(); fillStroke(ctx, f.c3, 1.5); circle(ctx, cx - 3, cy + 1, 1, '#ffe9a8', 0); circle(ctx, cx + 3, cy + 3, 1, '#ffe9a8', 0); }
    else if (f.v === 2) { rr(ctx, cx - 8, cy - 8, 16, 16, 3); fillStroke(ctx, f.c1, 2.5); ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fillRect(cx - 6, cy - 6, 5, 5); }
    else if (f.v === 3) { circle(ctx, cx, cy, 8, f.c1, 2.5); circle(ctx, cx - 3, cy - 3, 2, 'rgba(255,255,255,0.5)', 0); }
    else if (f.v === 4) { rr(ctx, cx - 6, cy - 12, 12, 24, 3); fillStroke(ctx, f.c1, 2.5); ctx.strokeStyle = f.c3; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 6, cy - 4); ctx.lineTo(cx + 6, cy + 4); ctx.moveTo(cx - 6, cy + 4); ctx.lineTo(cx + 6, cy - 4); ctx.stroke(); }
    else { circle(ctx, cx, cy, 7, i % 2 ? f.c1 : f.c3, 2.5); circle(ctx, cx - 2, cy - 2, 1.5, 'rgba(255,255,255,0.6)', 0); }
  }
  if (f.v === 3) { ctx.strokeStyle = '#5a7a3a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(4, -26); ctx.stroke(); }
}

// ─── streamers ───
// (x, y) = head centre, s = scale (1 → head radius 95). state: { expr, t, blink, bob }
function streamer(ctx, ch, x, y, s, st) {
  st = st || {}; const expr = st.expr || 'idle'; const t = st.t || 0;
  ctx.save(); ctx.translate(x, y + (st.bob || 0)); ctx.scale(s, s);
  const R = 95, lw = 5;
  const tint = expr === 'spicy' ? 0.3 : 0;
  // body
  const bodyY = R * 0.72;
  rr(ctx, -R * 1.05, bodyY, R * 2.1, R * 1.55, R * 0.42); fillStroke(ctx, ch.top, lw);
  // arms resting on the table
  ellipse(ctx, -R * 0.95, bodyY + R * 0.95, R * 0.34, R * 0.6, ch.top, lw);
  ellipse(ctx, R * 0.95, bodyY + R * 0.95, R * 0.34, R * 0.6, ch.top, lw);
  circle(ctx, -R * 1.0, bodyY + R * 1.5, R * 0.26, ch.skin, lw);
  circle(ctx, R * 1.0, bodyY + R * 1.5, R * 0.26, ch.skin, lw);
  // collar
  ctx.beginPath(); ctx.moveTo(-R * 0.35, bodyY); ctx.lineTo(0, bodyY + R * 0.3); ctx.lineTo(R * 0.35, bodyY); ctx.closePath(); fillStroke(ctx, ch.skin, lw * 0.7);
  // hair back
  if (ch.style === 'buns') { circle(ctx, -R * 0.95, -R * 0.75, R * 0.36, ch.hair, lw); circle(ctx, R * 0.95, -R * 0.75, R * 0.36, ch.hair, lw); circle(ctx, 0, R * 0.02, R * 1.06, ch.hair, lw); }
  else if (ch.style === 'bob') { rr(ctx, -R * 1.1, -R * 1.05, R * 2.2, R * 2.3, R * 0.9); fillStroke(ctx, ch.hair, lw); }
  else { rr(ctx, -R * 1.12, -R * 1.0, R * 2.24, R * 3.0, R * 0.9); fillStroke(ctx, ch.hair, lw); ctx.fillStyle = ch.hairDark; ctx.fillRect(-R * 1.0, R * 1.2, R * 0.25, R * 0.7); ctx.fillRect(R * 0.75, R * 1.2, R * 0.25, R * 0.7); }
  // head
  circle(ctx, 0, 0, R, ch.skin, lw);
  if (expr === 'cold') { ctx.fillStyle = 'rgba(120,170,255,0.25)'; ctx.beginPath(); ctx.arc(0, 0, R - 2, 0, TAU); ctx.fill(); }
  if (tint) { ctx.fillStyle = 'rgba(255,60,60,' + tint + ')'; ctx.beginPath(); ctx.arc(0, 0, R - 2, 0, TAU); ctx.fill(); }
  // bangs: scalloped cap
  ctx.beginPath(); ctx.moveTo(-R * 0.98, -R * 0.1);
  ctx.arc(0, 0, R * 0.995, Math.PI * 1.03, Math.PI * 1.97);
  const sc = 5; for (let i = 0; i < sc; i++) { const x0 = R * 0.98 - i * (R * 1.96 / sc), x1 = x0 - R * 1.96 / sc; ctx.quadraticCurveTo((x0 + x1) / 2, -R * 0.1 + R * 0.42, x1, -R * 0.12); }
  ctx.closePath(); fillStroke(ctx, ch.hair, lw);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(-R * 0.3, -R * 0.62, R * 0.28, R * 0.08, -0.3, 0, TAU); ctx.fill();
  // accessory
  if (ch.acc === 'bow') { ctx.save(); ctx.translate(R * 0.62, -R * 0.78); ctx.rotate(0.3); ellipse(ctx, -R * 0.18, 0, R * 0.2, R * 0.13, ch.accColor, lw * 0.7); ellipse(ctx, R * 0.18, 0, R * 0.2, R * 0.13, ch.accColor, lw * 0.7); circle(ctx, 0, 0, R * 0.08, shade(ch.accColor, -0.2), lw * 0.6); ctx.restore(); }
  if (ch.acc === 'star') { star(ctx, R * 0.6, -R * 0.72, R * 0.2, ch.accColor, lw * 0.6); }
  if (ch.acc === 'beret') { ctx.save(); ctx.translate(0, -R * 0.78); ctx.rotate(-0.12); ellipse(ctx, 0, 0, R * 1.0, R * 0.36, ch.accColor, lw); ellipse(ctx, 0, -R * 0.08, R * 0.88, R * 0.26, ch.accColor, 0); circle(ctx, 0, -R * 0.36, R * 0.07, shade(ch.accColor, -0.3), 0); ctx.restore(); }
  // blush
  const blush = expr === 'idle' || expr === 'open' ? 0.45 : 0.75;
  ctx.fillStyle = 'rgba(255,120,150,' + blush + ')';
  ellipse(ctx, -R * 0.58, R * 0.22, R * 0.17, R * 0.1, 'rgba(255,120,150,' + blush + ')', 0); ellipse(ctx, R * 0.58, R * 0.22, R * 0.17, R * 0.1, 'rgba(255,120,150,' + blush + ')', 0);
  // eyes
  const ex = R * 0.38, ey = -R * 0.02;
  const eyeOpen = function (sx) { ellipse(ctx, sx * ex, ey, R * 0.13, R * 0.17, ch.eye, 0); circle(ctx, sx * ex - R * 0.04, ey - R * 0.06, R * 0.045, '#fff', 0); circle(ctx, sx * ex + R * 0.03, ey + R * 0.05, R * 0.02, '#fff', 0); };
  const eyeHappy = function (sx) { ctx.beginPath(); ctx.arc(sx * ex, ey + R * 0.06, R * 0.14, Math.PI * 1.1, Math.PI * 1.9); ctx.lineWidth = lw; ctx.strokeStyle = ch.eye; ctx.lineCap = 'round'; ctx.stroke(); };
  const eyeLine = function (sx) { ctx.beginPath(); ctx.moveTo(sx * ex - R * 0.13, ey); ctx.lineTo(sx * ex + R * 0.13, ey); ctx.lineWidth = lw; ctx.strokeStyle = ch.eye; ctx.lineCap = 'round'; ctx.stroke(); };
  const eyeX = function (sx) { ctx.lineWidth = lw; ctx.strokeStyle = ch.eye; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx * ex - R * 0.11, ey - R * 0.11); ctx.lineTo(sx * ex + R * 0.11, ey + R * 0.11); ctx.moveTo(sx * ex + R * 0.11, ey - R * 0.11); ctx.lineTo(sx * ex - R * 0.11, ey + R * 0.11); ctx.stroke(); };
  const eyeWide = function (sx) { circle(ctx, sx * ex, ey, R * 0.17, '#fff', lw * 0.8, ch.eye); circle(ctx, sx * ex, ey + R * 0.02, R * 0.07, ch.eye, 0); };
  const eyeSquiggle = function (sx) { ctx.lineWidth = lw; ctx.strokeStyle = ch.eye; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx * ex - R * 0.13, ey); for (let i = 1; i <= 4; i++) ctx.lineTo(sx * ex - R * 0.13 + i * R * 0.065, ey + (i % 2 ? -R * 0.05 : R * 0.05)); ctx.stroke(); };
  for (let sx = -1; sx <= 1; sx += 2) {
    if (expr === 'idle' || expr === 'open') { if (st.blink) eyeLine(sx); else eyeOpen(sx); }
    else if (expr === 'chew' || expr === 'yum') eyeHappy(sx);
    else if (expr === 'spicy') eyeX(sx);
    else if (expr === 'cold') eyeSquiggle(sx);
    else if (expr === 'sweet') heart(ctx, sx * ex, ey, R * 0.15, C.red, lw * 0.5);
    else if (expr === 'fizzy') eyeWide(sx);
    else if (expr === 'sour') eyeLine(sx);
    else eyeOpen(sx);
  }
  // mouth
  const my = R * 0.42;
  ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.lineCap = 'round';
  if (expr === 'idle') { ctx.beginPath(); ctx.arc(0, my - R * 0.08, R * 0.14, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
  else if (expr === 'open') { ellipse(ctx, 0, my + R * 0.04, R * 0.2, R * 0.24, '#7a2d3a', lw); ellipse(ctx, 0, my + R * 0.16, R * 0.12, R * 0.08, '#ff7a8a', 0); }
  else if (expr === 'chew') { const ch2 = Math.sin(t * 22) * R * 0.04; ellipse(ctx, 0, my, R * 0.1 + Math.abs(ch2), R * 0.06 + Math.abs(ch2) * 0.5, '#7a2d3a', lw * 0.8); ellipse(ctx, -R * 0.72, R * 0.3, R * 0.1, R * 0.12, ch.skin, lw * 0.6); ellipse(ctx, R * 0.72, R * 0.3, R * 0.1, R * 0.12, ch.skin, lw * 0.6); }
  else if (expr === 'yum') { ctx.beginPath(); ctx.arc(0, my - R * 0.1, R * 0.2, 0.1 * Math.PI, 0.9 * Math.PI); ctx.closePath(); fillStroke(ctx, '#7a2d3a', lw); ctx.beginPath(); ctx.ellipse(0, my + R * 0.06, R * 0.1, R * 0.06, 0, 0, TAU); ctx.fillStyle = '#ff7a8a'; ctx.fill(); }
  else if (expr === 'spicy') {
    ellipse(ctx, 0, my + R * 0.02, R * 0.22, R * 0.26, '#7a2d3a', lw);
    // fire from the mouth
    ctx.save(); ctx.translate(0, my); const fl = 1 + Math.sin(t * 30) * 0.15;
    ctx.beginPath(); ctx.moveTo(-R * 0.18, 0); ctx.quadraticCurveTo(-R * 0.4, R * 0.5 * fl, -R * 0.1, R * 0.95 * fl); ctx.quadraticCurveTo(0, R * 0.55 * fl, R * 0.1, R * 0.95 * fl); ctx.quadraticCurveTo(R * 0.4, R * 0.5 * fl, R * 0.18, 0); ctx.closePath(); fillStroke(ctx, '#ff7a2a', lw * 0.8);
    ctx.beginPath(); ctx.moveTo(-R * 0.08, 0); ctx.quadraticCurveTo(-R * 0.18, R * 0.35 * fl, 0, R * 0.6 * fl); ctx.quadraticCurveTo(R * 0.18, R * 0.35 * fl, R * 0.08, 0); ctx.closePath(); ctx.fillStyle = '#ffe066'; ctx.fill(); ctx.restore();
    // sweat drops
    for (let i = 0; i < 3; i++) { const dx = [-R * 0.85, R * 0.85, -R * 0.7][i], dy = [-R * 0.3, -R * 0.1, R * 0.5][i] + (t * 60 + i * 20) % 20; ctx.beginPath(); ctx.moveTo(dx, dy - 9); ctx.quadraticCurveTo(dx + 7, dy + 3, dx, dy + 7); ctx.quadraticCurveTo(dx - 7, dy + 3, dx, dy - 9); fillStroke(ctx, '#8fd1ff', 2); }
  }
  else if (expr === 'cold') { ctx.beginPath(); ctx.moveTo(-R * 0.22, my); for (let i = 1; i <= 6; i++) ctx.lineTo(-R * 0.22 + i * R * 0.073, my + (i % 2 ? -R * 0.07 : R * 0.07)); ctx.stroke(); for (let i = 0; i < 2; i++) { const sx = i ? 1 : -1; ctx.beginPath(); ctx.moveTo(sx * R * 1.1, -R * 0.2); ctx.lineTo(sx * R * 1.25, -R * 0.1); ctx.moveTo(sx * R * 1.1, R * 0.2); ctx.lineTo(sx * R * 1.25, R * 0.3); ctx.lineWidth = 3; ctx.strokeStyle = '#4a9fd8'; ctx.stroke(); } }
  else if (expr === 'sweet') { ctx.beginPath(); ctx.arc(0, my - R * 0.1, R * 0.18, 0.1 * Math.PI, 0.9 * Math.PI); ctx.closePath(); fillStroke(ctx, '#7a2d3a', lw); }
  else if (expr === 'fizzy') { ellipse(ctx, 0, my + R * 0.02, R * 0.1, R * 0.13, '#7a2d3a', lw); for (let i = 0; i < 3; i++) sparkle(ctx, [-R * 0.8, R * 0.85, R * 0.6][i], [-R * 0.5, -R * 0.4, R * 0.6][i], R * 0.08 + Math.sin(t * 12 + i) * R * 0.03, '#fff'); }
  else if (expr === 'sour') { circle(ctx, 0, my + R * 0.02, R * 0.07, '#7a2d3a', lw); ctx.beginPath(); ctx.moveTo(-R * 0.2, my - R * 0.1); ctx.lineTo(-R * 0.1, my); ctx.moveTo(R * 0.2, my - R * 0.1); ctx.lineTo(R * 0.1, my); ctx.lineWidth = 3; ctx.stroke(); }
  ctx.restore();
}
// where the mouth is, in world coordinates, for the same (x, y, s)
function mouthPos(x, y, s, bob) { return { x: x, y: y + (bob || 0) + 95 * 0.42 * s }; }

// ─── backgrounds (drawn once into an offscreen canvas) ───
const cache = {};
function cached(key, createCanvas, W, H, scale, draw) {
  const k = key + '|' + W + 'x' + H + '@' + scale.toFixed(2);
  let c = cache[k];
  if (!c) {
    c = createCanvas(); c.width = Math.max(1, Math.round(W * scale)); c.height = Math.max(1, Math.round(H * scale));
    const cx = c.getContext('2d'); cx.setTransform(scale, 0, 0, scale, 0, 0); draw(cx, W, H); cache[k] = c;
    // keep the cache small: one canvas per key, drop others of the same key
    for (const kk in cache) if (kk.indexOf(key + '|') === 0 && kk !== k) delete cache[kk];
  }
  return c;
}
function cloud(ctx, x, y, s, col) { ctx.fillStyle = col || '#fff'; ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.arc(x + s * 1.1, y - s * 0.3, s * 0.8, 0, TAU); ctx.arc(x - s * 1.1, y - s * 0.1, s * 0.7, 0, TAU); ctx.arc(x + s * 0.3, y - s * 0.6, s * 0.7, 0, TAU); ctx.fill(); }
function tree(ctx, x, y, s, leaf, trunk) { ctx.fillStyle = trunk || '#b57c5a'; rr(ctx, x - s * 0.12, y - s * 0.6, s * 0.24, s * 0.7, s * 0.05); ctx.fill(); ctx.fillStyle = leaf; ctx.beginPath(); ctx.arc(x, y - s * 0.9, s * 0.5, 0, TAU); ctx.arc(x - s * 0.35, y - s * 0.6, s * 0.4, 0, TAU); ctx.arc(x + s * 0.35, y - s * 0.6, s * 0.4, 0, TAU); ctx.arc(x, y - s * 1.2, s * 0.35, 0, TAU); ctx.fill(); }
function palm(ctx, x, y, s, dir) { ctx.strokeStyle = '#c49a6c'; ctx.lineWidth = s * 0.08; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + dir * s * 0.3, y - s * 0.6, x + dir * s * 0.5, y - s); ctx.stroke(); ctx.fillStyle = '#9fe3a1'; const tx = x + dir * s * 0.5, ty = y - s; for (let i = 0; i < 5; i++) { const a = -Math.PI * 0.1 - i * 0.45; ctx.beginPath(); ctx.ellipse(tx + Math.cos(a) * s * 0.3 * dir, ty + Math.sin(a) * s * 0.3, s * 0.35, s * 0.1, a * dir, 0, TAU); ctx.fill(); } }
function drawSky(ctx, W, H, top, bottom) { const g = ctx.createLinearGradient(0, 0, 0, H * 0.6); g.addColorStop(0, top); g.addColorStop(1, bottom); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
const BG_DRAW = [
  function park(ctx, W, H) {
    drawSky(ctx, W, H, '#bfe9ff', '#eafaff');
    cloud(ctx, W * 0.2, H * 0.1, 26); cloud(ctx, W * 0.75, H * 0.16, 32); cloud(ctx, W * 0.5, H * 0.05, 18);
    ctx.fillStyle = '#b9ecb0'; ctx.beginPath(); ctx.ellipse(W * 0.25, H * 0.5, W * 0.6, H * 0.18, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#9fe3a1'; ctx.beginPath(); ctx.ellipse(W * 0.85, H * 0.52, W * 0.5, H * 0.16, 0, 0, TAU); ctx.fill();
    tree(ctx, W * 0.1, H * 0.44, 110, '#7ed37a'); tree(ctx, W * 0.9, H * 0.42, 130, '#8fdc86'); tree(ctx, W * 0.72, H * 0.4, 80, '#9fe3a1');
    ctx.fillStyle = '#8fd97a'; ctx.fillRect(0, H * 0.5, W, H);
    for (let i = 0; i < 14; i++) { const fx = (i * 97) % W, fy = H * 0.5 + ((i * 53) % Math.round(H * 0.08)); circle(ctx, fx, fy, 4, ['#ff9fc4', '#ffd95e', '#fff'][i % 3], 0); }
  },
  function beach(ctx, W, H) {
    drawSky(ctx, W, H, '#ffd1a8', '#ffe8f0');
    circle(ctx, W * 0.7, H * 0.18, 40, '#fff3b0', 0);
    cloud(ctx, W * 0.25, H * 0.12, 24, '#fff6f8');
    ctx.fillStyle = '#f7b8d9'; ctx.beginPath(); ctx.moveTo(0, H * 0.36); ctx.lineTo(W * 0.2, H * 0.22); ctx.lineTo(W * 0.4, H * 0.36); ctx.lineTo(W * 0.6, H * 0.26); ctx.lineTo(W * 0.85, H * 0.36); ctx.lineTo(W, H * 0.3); ctx.lineTo(W, H * 0.4); ctx.lineTo(0, H * 0.4); ctx.fill();
    ctx.fillStyle = '#8fd1ff'; ctx.fillRect(0, H * 0.36, W, H * 0.12);
    ctx.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(W * (0.1 + i * 0.17), H * 0.46, 40, 5, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#fff0c2'; ctx.fillRect(0, H * 0.47, W, H);
    palm(ctx, W * 0.12, H * 0.5, 170, 1); palm(ctx, W * 0.9, H * 0.48, 200, -1);
    ctx.fillStyle = '#ffe3a8'; rr(ctx, W * 0.72, H * 0.42, 70, 50, 6); ctx.fill(); ctx.fillStyle = '#ffd98a'; rr(ctx, W * 0.74, H * 0.37, 20, 40, 3); ctx.fill(); rr(ctx, W * 0.79, H * 0.37, 20, 40, 3); ctx.fill();
  },
  function sakura(ctx, W, H) {
    drawSky(ctx, W, H, '#ffe4ee', '#fff6fa');
    circle(ctx, W * 0.22, H * 0.14, 30, '#fff9c4', 0);
    cloud(ctx, W * 0.7, H * 0.1, 26, '#fff');
    ctx.fillStyle = '#ffb3c7'; for (let i = 0; i < 3; i++) { const tx = [W * 0.1, W * 0.88, W * 0.55][i], ty = H * 0.4, ts = [150, 170, 110][i]; ctx.fillStyle = '#b57c5a'; rr(ctx, tx - 10, ty - ts * 0.5, 20, ts * 0.55, 5); ctx.fill(); ctx.fillStyle = i === 2 ? '#ffc9d9' : '#ffb3c7'; ctx.beginPath(); ctx.arc(tx, ty - ts * 0.75, ts * 0.45, 0, TAU); ctx.arc(tx - ts * 0.35, ty - ts * 0.5, ts * 0.35, 0, TAU); ctx.arc(tx + ts * 0.35, ty - ts * 0.5, ts * 0.35, 0, TAU); ctx.arc(tx, ty - ts * 1.05, ts * 0.3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#c3ecc0'; ctx.fillRect(0, H * 0.42, W, H * 0.06);
    ctx.fillStyle = '#9fd8ff'; ctx.fillRect(0, H * 0.47, W, H * 0.09);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(W * (0.12 + i * 0.2), H * 0.515, 36, 4, 0, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#b9ecb0'; ctx.fillRect(0, H * 0.55, W, H);
    for (let i = 0; i < 18; i++) { const px = (i * 131) % W, py = (i * 71) % Math.round(H * 0.5); heart(ctx, px, py, 4, '#ffb3c7', 0); }
  },
  function room(ctx, W, H) {
    ctx.fillStyle = '#e9ddff'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#dccdff'; for (let i = 0; i < 10; i++) ctx.fillRect(i * (W / 10), 0, W / 20, H);
    // window with night sky
    rr(ctx, W * 0.56, H * 0.06, W * 0.36, H * 0.3, 18); ctx.fillStyle = '#fff'; ctx.fill();
    rr(ctx, W * 0.58, H * 0.075, W * 0.32, H * 0.27, 14); ctx.fillStyle = '#4a4f9e'; ctx.fill();
    circle(ctx, W * 0.82, H * 0.14, 20, '#fff6b0', 0); for (let i = 0; i < 8; i++) star(ctx, W * 0.6 + (i * 37) % (W * 0.28), H * 0.09 + (i * 29) % (H * 0.22), 4, '#fff', 0);
    ctx.fillStyle = '#fff'; ctx.fillRect(W * 0.735, H * 0.075, 6, H * 0.27); ctx.fillRect(W * 0.58, H * 0.2, W * 0.32, 6);
    // shelf with plushies
    ctx.fillStyle = '#c9a27c'; rr(ctx, W * 0.06, H * 0.3, W * 0.4, 14, 6); ctx.fill();
    circle(ctx, W * 0.14, H * 0.3 - 22, 20, '#ffd1e3', 3); circle(ctx, W * 0.14 - 12, H * 0.3 - 38, 8, '#ffd1e3', 3); circle(ctx, W * 0.14 + 12, H * 0.3 - 38, 8, '#ffd1e3', 3);
    circle(ctx, W * 0.3, H * 0.3 - 22, 22, '#c9a27c', 3); circle(ctx, W * 0.3 - 14, H * 0.3 - 40, 8, '#c9a27c', 3); circle(ctx, W * 0.3 + 14, H * 0.3 - 40, 8, '#c9a27c', 3);
    rr(ctx, W * 0.38, H * 0.3 - 40, 36, 40, 6); fillStroke(ctx, '#9fe3c9', 3);
    // fairy lights
    ctx.strokeStyle = '#8a6d6b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, H * 0.02); ctx.quadraticCurveTo(W * 0.5, H * 0.1, W, H * 0.02); ctx.stroke();
    for (let i = 1; i < 9; i++) { const lx = i * W / 9, ly = H * 0.02 + Math.sin(i / 9 * Math.PI) * H * 0.04 + 10; circle(ctx, lx, ly, 6, ['#ffd95e', '#ff9fc4', '#9fe3c9', '#8fd1ff'][i % 4], 0); circle(ctx, lx, ly, 11, 'rgba(255,230,150,0.25)', 0); }
    ctx.fillStyle = '#f3c58b'; ctx.fillRect(0, H * 0.48, W, H);
    ctx.fillStyle = '#e8b267'; for (let i = 0; i < 6; i++) ctx.fillRect(0, H * 0.48 + i * 30, W, 3);
  },
  function city(ctx, W, H) {
    drawSky(ctx, W, H, '#2b2f6b', '#6a4fa8');
    for (let i = 0; i < 30; i++) star(ctx, (i * 173) % W, (i * 97) % Math.round(H * 0.3), 3 + (i % 3), '#fff', 0);
    circle(ctx, W * 0.78, H * 0.12, 34, '#fff6b0', 0); circle(ctx, W * 0.74, H * 0.1, 30, '#5a4fa8', 0);
    const bcols = ['#3d3f8f', '#4a4aa8', '#2f3077', '#55519e'];
    for (let i = 0; i < 9; i++) { const bw = W / 9 + 12, bx = i * (W / 9) - 6, bh = H * (0.12 + ((i * 7) % 5) * 0.045), by = H * 0.46 - bh; ctx.fillStyle = bcols[i % 4]; ctx.fillRect(bx, by, bw, bh); for (let r = 0; r < Math.floor(bh / 22); r++) for (let c = 0; c < 2; c++) { if ((i + r + c) % 3 === 0) continue; ctx.fillStyle = (i + r) % 2 ? '#ffe066' : '#ffb3c7'; ctx.fillRect(bx + 10 + c * (bw / 2 - 8), by + 8 + r * 22, 12, 12); } }
    rr(ctx, W * 0.3, H * 0.3, W * 0.4, 50, 12); fillStroke(ctx, '#ff5fa0', 3); text(ctx, 'LIVE TONIGHT', W * 0.5, H * 0.3 + 25, 22, '#fff', 0);
    ctx.fillStyle = '#4a4f9e'; ctx.fillRect(0, H * 0.46, W, H);
    ctx.fillStyle = '#5b60b3'; for (let i = 0; i < 8; i++) ctx.fillRect(i * (W / 8), H * 0.46, W / 16, H);
  }
];
function background(ctx, idx, createCanvas, W, H, scale) {
  const c = cached('bg' + idx, createCanvas, W, H, scale, BG_DRAW[idx % BG_DRAW.length]);
  ctx.drawImage(c, 0, 0, W, H);
}
// Live bits on top of the cached background
function backgroundLive(ctx, idx, W, H, t) {
  if (idx === 2) { for (let i = 0; i < 8; i++) { const px = (W * 0.1 + i * W * 0.12 + t * 18) % W, py = ((t * 40 + i * 120) % (H * 0.5)); heart(ctx, px, py, 5, 'rgba(255,160,190,0.8)', 0); } }
  if (idx === 0 || idx === 1) { cloud(ctx, (t * 10 + W * 0.3) % (W + 120) - 60, H * 0.22, 16, 'rgba(255,255,255,0.8)'); }
  if (idx === 4) { for (let i = 0; i < 4; i++) { const a = 0.4 + 0.4 * Math.sin(t * 3 + i); star(ctx, W * (0.15 + i * 0.22), H * 0.08 + (i % 2) * 40, 5, 'rgba(255,255,255,' + a + ')', 0); } }
}
// picnic table: checked cloth across the bottom of the stream scene
function table(ctx, bg, W, y0, H) {
  const b = D.BACKGROUNDS[bg];
  ctx.fillStyle = b.cloth; ctx.beginPath(); ctx.moveTo(0, y0 + 30); ctx.quadraticCurveTo(W / 2, y0 - 30, W, y0 + 30); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.moveTo(0, y0 + 30); ctx.quadraticCurveTo(W / 2, y0 - 30, W, y0 + 30); ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.clip();
  ctx.fillStyle = b.clothDark; const cs = 44;
  for (let r = 0; r < Math.ceil((H - y0 + 40) / cs); r++) for (let c = 0; c < Math.ceil(W / cs) + 1; c++) if ((r + c) % 2 === 0) ctx.fillRect(c * cs - 20, y0 - 40 + r * cs, cs, cs);
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, y0 - 40, W, H);
  ctx.restore();
  ctx.lineWidth = 5; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(0, y0 + 30); ctx.quadraticCurveTo(W / 2, y0 - 30, W, y0 + 30); ctx.stroke();
}
// selfie phone on a stick, left edge of the stream
function phoneStick(ctx, x, y, s, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.25 + Math.sin(t * 1.5) * 0.02);
  ctx.strokeStyle = '#8a8f9e'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, 260); ctx.stroke();
  ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, 2); ctx.lineTo(-46, 262); ctx.moveTo(6, -2); ctx.lineTo(-34, 258); ctx.stroke();
  rr(ctx, -12, -24, 24, 44, 6); fillStroke(ctx, '#5b6fe0', 3);
  rr(ctx, -36, -110, 72, 120, 14); fillStroke(ctx, '#5b9fff', 5);
  rr(ctx, -30, -104, 60, 108, 10); fillStroke(ctx, '#8fd1ff', 0);
  circle(ctx, -18, -92, 8, '#fff', 2); circle(ctx, -18, -92, 4, '#3d4f9e', 0); circle(ctx, -4, -92, 5, '#fff', 2);
  circle(ctx, 2, -40, 14, '#fff', 3); circle(ctx, 2, -40, 9, '#8fd1ff', 0); circle(ctx, -2, -42, 2.5, OUT, 0);
  ctx.restore();
}
// LIVE pill
function livePill(ctx, x, y, w, h, viewers, s) {
  rr(ctx, x, y, w, h, h / 2); fillStroke(ctx, '#ff4a5f', 4);
  rr(ctx, x + 6, y + 6, 66 * s, h - 12, (h - 12) / 2); fillStroke(ctx, '#fff', 0);
  text(ctx, 'LIVE', x + 6 + 33 * s, y + h / 2 + 1, 18 * s, '#ff4a5f', 0);
  eyeIcon(ctx, x + 96 * s, y + h / 2, 12 * s, '#fff');
  text(ctx, viewers, x + 118 * s, y + h / 2 + 1, 22 * s, '#fff', 0, 'left');
}
// profile badge with level
function profileBadge(ctx, ch, x, y, r, lvl) {
  circle(ctx, x, y, r, '#fff', 4, C.gold);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r - 3, 0, TAU); ctx.clip(); streamer(ctx, ch, x, y + r * 0.25, r / 95 * 0.72, { expr: 'yum' }); ctx.restore();
  circle(ctx, x, y, r, null, 4, C.gold);
  rr(ctx, x - r * 0.9, y + r * 0.62, r * 1.8, r * 0.55, r * 0.28); fillStroke(ctx, C.gold, 3);
  text(ctx, 'LVL.' + lvl, x, y + r * 0.9, r * 0.42, '#fff', 2.5);
}
// coins pill with optional "+" button
function coinPill(ctx, x, y, w, h, value) {
  rr(ctx, x, y, w, h, h / 2); fillStroke(ctx, '#fff4d6', 4);
  circle(ctx, x + h * 0.5, y + h / 2, h * 0.42, C.gold, 3); circle(ctx, x + h * 0.5, y + h / 2, h * 0.26, C.goldDark, 0);
  text(ctx, value, x + h + 4, y + h / 2 + 1, h * 0.5, C.text, 0, 'left');
}

// ─── supermarket props ───
function storeBackground(ctx, createCanvas, W, H, scale) {
  const c = cached('store', createCanvas, W, H, scale, function (cx, W, H) {
    cx.fillStyle = '#ffe3ea'; cx.fillRect(0, 0, W, H);
    cx.fillStyle = '#ffd1dc'; for (let i = 0; i < 12; i++) for (let j = 0; j < 20; j++) if ((i + j) % 2) cx.fillRect(i * 50, j * 50, 50, 50);
    cx.fillStyle = 'rgba(255,255,255,0.5)'; cx.fillRect(0, 0, W, H);
    // awning
    cx.fillStyle = '#ff8fb3'; cx.fillRect(0, 0, W, 90);
    cx.fillStyle = '#fff'; for (let i = 0; i < 8; i++) if (i % 2) cx.fillRect(i * (W / 8), 0, W / 8, 90);
    cx.fillStyle = '#ff8fb3'; for (let i = 0; i < 8; i++) { cx.beginPath(); cx.arc(i * (W / 8) + W / 16, 90, W / 16, 0, Math.PI); cx.fill(); }
    cx.fillStyle = '#fff'; for (let i = 0; i < 8; i++) if (i % 2) { cx.beginPath(); cx.arc(i * (W / 8) + W / 16, 90, W / 16, 0, Math.PI); cx.fill(); }
    cx.fillStyle = '#f7c9d9'; cx.fillRect(0, H * 0.86, W, H);
  });
  ctx.drawImage(c, 0, 0, W, H);
}
function shelfBoard(ctx, x, y, w, h, color) { rr(ctx, x, y, w, h, 14); fillStroke(ctx, color, 4); ctx.fillStyle = 'rgba(0,0,0,0.08)'; rr(ctx, x + 6, y + h - 16, w - 12, 10, 5); ctx.fill(); }
function priceTag(ctx, x, y, price, dim) { rr(ctx, x - 36, y - 13, 72, 26, 13); fillStroke(ctx, dim ? '#eee' : '#fff', 3); coin(ctx, x - 20, y, 8); text(ctx, String(price), x + 6, y + 1, 15, dim ? '#aaa' : C.text, 0); }
function basket(ctx, x, y, w, h) {
  ctx.lineWidth = 6; ctx.strokeStyle = C.goldDark; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + w * 0.15, y + h * 0.2); ctx.quadraticCurveTo(x + w * 0.1, y - h * 0.3, x + w * 0.4, y - h * 0.1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w * 0.85, y + h * 0.2); ctx.quadraticCurveTo(x + w * 0.9, y - h * 0.3, x + w * 0.6, y - h * 0.1); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w * 0.88, y + h); ctx.lineTo(x + w * 0.12, y + h); ctx.closePath(); fillStroke(ctx, '#ff9fc4', 4);
  ctx.save(); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w * 0.88, y + h); ctx.lineTo(x + w * 0.12, y + h); ctx.closePath(); ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 4; for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(x + i * w / 6, y); ctx.lineTo(x + i * w / 6, y + h); ctx.stroke(); } for (let i = 1; i < 3; i++) { ctx.beginPath(); ctx.moveTo(x, y + i * h / 3); ctx.lineTo(x + w, y + i * h / 3); ctx.stroke(); }
  ctx.restore();
  rr(ctx, x - 4, y - 8, w + 8, 16, 8); fillStroke(ctx, '#ffb3c7', 4);
}
// self-checkout machine body; returns the screen rect and scanner rect
function machine(ctx, x, y, w, h) {
  circle(ctx, x + w * 0.22, y + 6, 26, '#c9a8ff', 4); circle(ctx, x + w * 0.78, y + 6, 26, '#c9a8ff', 4);
  rr(ctx, x, y, w, h, 28); fillStroke(ctx, '#c9a8ff', 5);
  const sx = x + 24, sy = y + 24, sw = w - 48, sh = h * 0.68;
  rr(ctx, sx, sy, sw, sh, 18); fillStroke(ctx, '#eef4ff', 4);
  const py = sy + sh + 16, ph = h - sh - 40;
  rr(ctx, x + w * 0.3, py, w * 0.4, ph, 10); fillStroke(ctx, '#4a4a5a', 4);
  ctx.fillStyle = '#ff4a5f'; ctx.fillRect(x + w * 0.33, py + ph / 2 - 2, w * 0.34, 4);
  circle(ctx, x + w * 0.16, py + ph / 2, 16, '#ff8fb3', 3); text(ctx, '▶', x + w * 0.16, py + ph / 2 + 1, 14, '#fff', 0);
  circle(ctx, x + w * 0.84, py + ph / 2, 16, '#ff8fb3', 3); text(ctx, '◀', x + w * 0.84, py + ph / 2 + 1, 14, '#fff', 0);
  return { sx: sx, sy: sy, sw: sw, sh: sh, px: x + w * 0.3, py: py, pw: w * 0.4, ph: ph };
}
function conveyor(ctx, x, y, w, h) { rr(ctx, x, y, w, h, 16); fillStroke(ctx, '#d9d4ff', 4); ctx.fillStyle = '#c3bbf5'; for (let i = 0; i < Math.floor(h / 22); i++) ctx.fillRect(x + 8, y + 10 + i * 22, w - 16, 8); }
// bear cashier mascot for the "Thank you!" screen
function cashier(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  rr(ctx, -40, 30, 80, 60, 20); fillStroke(ctx, '#9fe3c9', 4);
  circle(ctx, -34, -28, 14, '#c99b6a', 4); circle(ctx, 34, -28, 14, '#c99b6a', 4);
  circle(ctx, 0, 0, 44, '#c99b6a', 4);
  rr(ctx, -40, -48, 80, 22, 10); fillStroke(ctx, '#8fd1ff', 4); rr(ctx, -50, -32, 100, 10, 5); fillStroke(ctx, '#8fd1ff', 3);
  ellipse(ctx, 0, 14, 18, 13, '#f3dfc4', 3); circle(ctx, 0, 10, 5, OUT, 0);
  circle(ctx, -16, -4, 4, OUT, 0); circle(ctx, 16, -4, 4, OUT, 0);
  circle(ctx, -28, 10, 6, 'rgba(255,120,150,0.5)', 0); circle(ctx, 28, 10, 6, 'rgba(255,120,150,0.5)', 0);
  ctx.restore();
}

module.exports = { rr, circle, ellipse, shade, text, coin, star, heart, eyeIcon, sparkle, lock, reaction, avatar, food, streamer, mouthPos, background, backgroundLive, table, phoneStick, livePill, profileBadge, coinPill, storeBackground, shelfBoard, priceTag, basket, machine, conveyor, cashier, cloud };
