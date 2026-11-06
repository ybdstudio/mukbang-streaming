'use strict';
// Everything on screen is drawn here: kawaii foods (with an "eaten"
// fraction), the streamers with their faces, backgrounds, store props,
// reactions, chat avatars. Each public drawer uses the bitmap art from
// assets/ (sprites.js) once it has loaded, and its canvas-vector fallback
// (the *Vec functions) until then or when images are unavailable.
const U = require('./util.js');
const D = require('./data.js');
const S = require('./sprites.js');
const WR = require('./wardrobe.js');
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
function coinVec(ctx, x, y, r) { circle(ctx, x, y, r, C.gold, Math.max(2, r * 0.22)); circle(ctx, x, y, r * 0.62, C.goldDark, 0); text(ctx, '$', x, y + r * 0.05, r * 1.1, C.gold, 0); }
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
function eyeIconVec(ctx, x, y, r, color) { ctx.beginPath(); ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x, y - r * 1.1, x + r, y); ctx.quadraticCurveTo(x, y + r * 1.1, x - r, y); ctx.closePath(); ctx.fillStyle = color || '#fff'; ctx.fill(); circle(ctx, x, y, r * 0.42, OUT, 0); }
function sparkle(ctx, x, y, s, color) { ctx.beginPath(); ctx.moveTo(x, y - s); ctx.quadraticCurveTo(x, y, x + s, y); ctx.quadraticCurveTo(x, y, x, y + s); ctx.quadraticCurveTo(x, y, x - s, y); ctx.quadraticCurveTo(x, y, x, y - s); ctx.closePath(); ctx.fillStyle = color || '#fff'; ctx.fill(); }
function lockVec(ctx, x, y, s) { rr(ctx, x - s * 0.5, y - s * 0.1, s, s * 0.8, s * 0.18); fillStroke(ctx, C.goldDark, s * 0.12); ctx.beginPath(); ctx.arc(x, y - s * 0.2, s * 0.3, Math.PI, 0); ctx.lineWidth = s * 0.14; ctx.strokeStyle = OUT; ctx.stroke(); circle(ctx, x, y + 0.3 * s, s * 0.1, OUT, 0); }

// ─── reactions floating over the stream ───
function reactionVec(ctx, kind, x, y, s) {
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
function avatarVec(ctx, kind, x, y, r) {
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
function foodVec(ctx, f, x, y, size, e, t) {
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
function streamerVec(ctx, ch, x, y, s, st) {
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
    else if (expr === 'chew' || expr === 'yum' || expr === 'sip') eyeHappy(sx);
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
  else if (expr === 'sip') { const p2 = 1 + Math.sin(t * 9) * 0.08; ellipse(ctx, 0, my, R * 0.07 * p2, R * 0.08 * p2, '#7a2d3a', lw * 0.8); ellipse(ctx, 0, my, R * 0.12 * p2, R * 0.11 * p2, null, lw * 0.6); }
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
function mouthPosVec(x, y, s, bob) { return { x: x, y: y + (bob || 0) + 95 * 0.42 * s }; }

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
function backgroundVec(ctx, idx, createCanvas, W, H, scale) {
  const c = cached('bg' + idx, createCanvas, W, H, scale, BG_DRAW[idx % BG_DRAW.length]);
  ctx.drawImage(c, 0, 0, W, H);
}
// Live bits on top of the cached background
function backgroundLiveVec(ctx, idx, W, H, t) {
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
function phoneStickVec(ctx, x, y, s, t) {
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
  coin(ctx, x + h * 0.5, y + h / 2, h * 0.42);
  text(ctx, value, x + h + 4, y + h / 2 + 1, h * 0.5, C.text, 0, 'left');
}

// ─── supermarket props ───
function storeBackgroundVec(ctx, createCanvas, W, H, scale) {
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
function shelfBoardVec(ctx, x, y, w, h, color) { rr(ctx, x, y, w, h, 14); fillStroke(ctx, color, 4); ctx.fillStyle = 'rgba(0,0,0,0.08)'; rr(ctx, x + 6, y + h - 16, w - 12, 10, 5); ctx.fill(); }
function priceTag(ctx, x, y, price, dim) { rr(ctx, x - 36, y - 13, 72, 26, 13); fillStroke(ctx, dim ? '#eee' : '#fff', 3); coin(ctx, x - 20, y, 8); text(ctx, String(price), x + 6, y + 1, 15, dim ? '#aaa' : C.text, 0); }
function basketVec(ctx, x, y, w, h) {
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
function machineVec(ctx, x, y, w, h) {
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
function conveyorVec(ctx, x, y, w, h) { rr(ctx, x, y, w, h, 16); fillStroke(ctx, '#d9d4ff', 4); ctx.fillStyle = '#c3bbf5'; for (let i = 0; i < Math.floor(h / 22); i++) ctx.fillRect(x + 8, y + 10 + i * 22, w - 16, 8); }
// bear cashier mascot for the "Thank you!" screen
function cashierVec(ctx, x, y, s) {
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

// ─── bitmap art (assets/) with the vector drawers above as fallback ───
// art V3 single icons first (ui/coin.png, ui/star_on|off.png), then the V1 atlas, then vector
function ui3(ctx, name, x, y, size) { const im = S.enabled() ? S.get('ui/' + name + '.png') : null; if (!im) return false; ctx.drawImage(im, x - size / 2, y - size / 2, size, size); return true; }
function coin(ctx, x, y, r) { if (!ui3(ctx, 'coin', x, y, r * 2.4) && !S.atlas(ctx, S.ICONS, 'coin', x, y, r * 2.25)) coinVec(ctx, x, y, r); }
function eyeIcon(ctx, x, y, r, color) { if (!S.atlas(ctx, S.ICONS, 'eye', x, y, r * 2.3)) eyeIconVec(ctx, x, y, r, color); }
function lock(ctx, x, y, s) { if (!S.atlas(ctx, S.ICONS, 'lock', x, y + s * 0.1, s * 1.25)) lockVec(ctx, x, y, s); }
// result / level-select stars: `on` = earned; `offColor` is the vector fallback's colour for an unearned star
function uiStar(ctx, x, y, r, on, offColor, lw) { if (!ui3(ctx, on ? 'star_on' : 'star_off', x, y, r * 2.5) && !S.atlas(ctx, S.ICONS, on ? 'star_on' : 'star_off', x, y, r * 2.35)) star(ctx, x, y, r, on ? C.gold : offColor, lw); }
function reaction(ctx, kind, x, y, s) { if (!S.atlas(ctx, S.REACTIONS, kind, x, y, s * 2.4)) reactionVec(ctx, kind, x, y, s); }
function avatar(ctx, kind, x, y, r) { if (!S.atlas(ctx, S.AVATARS, kind, x, y, r * 2.1)) avatarVec(ctx, kind, x, y, r); }
// home-screen logo centred at (x, y), `w` wide; false while the image is not loaded
function logo(ctx, x, y, w) {
  const im = S.get(S.UI.logo.image); if (!im) return false;
  const h = w * S.UI.logo.h / S.UI.logo.w; ctx.drawImage(im, x - w / 2, y - h / 2, w, h); return true;
}

// food: one frame per bite (stage = bites already taken)
const FOOD_DRAW = 1.05; // sprite edge relative to the drawer's `size` box
function food(ctx, f, x, y, size, e, t) {
  const bites = f.bites || D.bitesOf(f); e = U.clamp(e || 0, 0, 1);
  if (S.enabled() && f.art !== false) {
    const sid = f.sprite || f.id;
    const stage = Math.min(bites - 1, Math.floor(e * bites + 1e-6));
    const im = S.get(S.foodPath(sid, stage));
    for (let i = 0; i < bites; i++) if (i !== stage) S.get(S.foodPath(sid, i)); // warm the next frames
    if (im) { const d = size * FOOD_DRAW; ctx.drawImage(im, x - d / 2, y - d / 2, d, d); return; }
  }
  if (f.shape && f.shape !== 'market') dishVec(ctx, f, x, y, size, e, t); else foodVec(ctx, f, x, y, size, e, t);
}

// Stand a food on a surface: the sprite's lowest opaque row lands on yFloor (art has uneven bottom padding).
const FOOT = {};
function footOf(im) {
  if (!im) return 0.92; const key = im.src || im; if (FOOT[key] !== undefined) return FOOT[key];
  let v = 0.92;
  try { const w = 64, c = S.canvas ? S.canvas(w, w) : null; if (c) { const g = c.getContext('2d'); g.drawImage(im, 0, 0, w, w); const a = g.getImageData(0, 0, w, w).data; for (let y = w - 1; y >= 0; y--) { let hit = 0; for (let x = 0; x < w; x++) if (a[(y * w + x) * 4 + 3] > 40) { hit = 1; break; } if (hit) { v = (y + 1) / w; break; } } } } catch (e) { /* tainted or no canvas: keep default */ }
  FOOT[key] = v; return v;
}
function foodOn(ctx, f, x, yFloor, size, t) {
  let foot = 0.92;
  if (S.enabled() && f.art !== false) { const im = S.get(S.foodPath(f.sprite || f.id, 0)); if (im) foot = footOf(im); }
  const d = size * FOOD_DRAW; food(ctx, f, x, yFloor - (foot - 0.5) * d, size, 0, t);
}

// streamer: body + head layers, eyes and mouth from the shared face atlas
function streamerParts(ch) {
  const sp = S.STREAMERS[ch.id]; if (!sp) return null;
  const head = S.get(sp.head), body = S.get(sp.body), face = S.get(S.FACE_IMG), fx = S.get(S.FX_IMG);
  return head && body && face ? { sp: sp, head: head, body: body, face: face, fx: fx } : null;
}
function streamer(ctx, ch, x, y, s, st) {
  const lk = st && st.look; const outfit = lk ? WR.BY_ID[lk.outfit] : null;
  const P = streamerParts(ch);
  if (!P) {
    // vector fallback: sweater colour swap + the same overlays in vector face units (R = 95)
    const ch2 = outfit && outfit.color ? Object.assign({}, ch, { top: outfit.color, topDark: outfit.dark }) : ch;
    streamerVec(ctx, ch2, x, y, s, st);
    if (lk) { ctx.save(); ctx.translate(x, y + ((st && st.bob) || 0)); ctx.scale(s, s); WR.drawBody(ctx, module.exports, lk, { nx: 0, ny: 95 * 0.72, bw: 200 }); WR.drawHead(ctx, module.exports, lk, { cx: 0, cy: 0, r: 95, ey: 4, ny: 95 * 0.8 }, ch, st && st.t); ctx.restore(); }
    return;
  }
  st = st || {}; const expr = S.EXPR[st.expr] ? st.expr : 'idle'; const t = st.t || 0; const sp = P.sp;
  const k = S.streamerK(sp) * s;
  ctx.save(); ctx.translate(x, y + (st.bob || 0)); ctx.scale(k, k); ctx.translate(-sp.headAnchor[0], -sp.headAnchor[1]);
  // now in head-image pixels
  // outfit: another streamer's sweater layer (same pose) or a vector overlay on top of our own
  // Codex wardrobe art: per-streamer layers on the same canvases as body / head (art5); vector fallback while it loads
  const wear = function (id) { return id && id !== 'hair_none' && id !== 'acc_none' && id !== 'outfit_default' ? S.v4('wardrobe/' + id + '_' + ch.id + '.png') : null; };
  const oIm = lk ? wear(lk.outfit) : null, hIm = lk ? wear(lk.hair) : null, aIm = lk ? wear(lk.acc) : null;
  let body = P.body, bodyAnchor = sp.bodyAnchor;
  if (!oIm && outfit && outfit.body && S.STREAMERS[outfit.body]) { const ob = S.get(S.STREAMERS[outfit.body].body); if (ob) { body = ob; bodyAnchor = S.STREAMERS[outfit.body].bodyAnchor; } }
  ctx.drawImage(body, sp.neckOnHead[0] - bodyAnchor[0], sp.neckOnHead[1] - bodyAnchor[1]);
  if (oIm) ctx.drawImage(oIm, sp.neckOnHead[0] - sp.bodyAnchor[0], sp.neckOnHead[1] - sp.bodyAnchor[1]);
  else if (lk) WR.drawBody(ctx, module.exports, lk, { nx: sp.neckOnHead[0], ny: sp.neckOnHead[1], bw: 343 });
  const fit = S.WEAR_FIT[ch.id] || {};
  const wearAt = function (im, id) { const a = fit[id] || {}, sx = a.sx || a.s || 1, sy = a.sy || a.s || 1, c = a.c || [256, 256]; ctx.save(); ctx.translate(c[0] + (a.dx || 0), c[1] + (a.dy || 0)); ctx.scale(sx, sy); ctx.translate(-c[0], -c[1]); ctx.drawImage(im, 0, 0); ctx.restore(); };
  const under = function (id) { return !!(fit[id] && fit[id].under); };
  if (aIm && under(lk.acc)) wearAt(aIm, lk.acc);
  ctx.drawImage(P.head, 0, 0);
  if (sp.neckPatch) { // Momo's back hair hides her neck: a pre-made neck (body neck joined to the chin) goes in front of it
    const np = sp.neckPatch, nim = S.get(np[0]);
    if (nim) { ctx.drawImage(nim, np[1], np[2]);
      if (oIm) { const ox = sp.neckOnHead[0] - sp.bodyAnchor[0], oy = sp.neckOnHead[1] - sp.bodyAnchor[1]; ctx.save(); ctx.beginPath(); ctx.rect(np[1], np[3], nim.width, np[2] + nim.height - np[3]); ctx.clip(); ctx.drawImage(oIm, ox, oy); ctx.restore(); } } }
  const ex = S.EXPR[expr]; let eyes = ex[0], mouth = ex[1];
  if ((expr === 'idle' || expr === 'open' || expr === 'chew') && st.blink) eyes = 'eyes_blink';
  if (expr === 'chew' && Math.sin(t * 22) < 0) mouth = 'mouth_chew_b';
  if (expr === 'sip' && Math.sin(t * 2.2) > 0.6) eyes = 'eyes_happy';
  const ey = sp.eyes || S.FACE_EYES_AT, dx = ey[0] - S.FACE_EYES_AT[0], dy = ey[1] - S.FACE_EYES_AT[1];
  const mx = sp.mouth[0] - S.FACE_MOUTH_AT[0], my = sp.mouth[1] - S.FACE_MOUTH_AT[1];
  // flushed (spicy) / chilled (cold) cheeks
  if (expr === 'spicy' || expr === 'cold') {
    ctx.globalAlpha = 0.32 + 0.12 * Math.sin(t * 10);
    const col = expr === 'spicy' ? '#ff3b3b' : '#7fb8ff';
    ellipse(ctx, ey[0] - 96, ey[1] + 58, 48, 30, col, 0); ellipse(ctx, ey[0] + 96, ey[1] + 58, 48, 30, col, 0);
    ctx.globalAlpha = 1;
  }
  if (S.FACE[eyes]) S.cell(ctx, P.face, S.FACE[eyes], ey[0], ey[1], 240, 120);
  if (S.FACE[mouth]) S.cell(ctx, P.face, S.FACE[mouth], sp.mouth[0], sp.mouth[1], 240, 120);
  if (ex[2] && P.fx && S.FX[ex[2]]) { const fa = S.fxAt(ex[2], sp); S.cell(ctx, P.fx, S.FX[ex[2]], fa[0], fa[1] + Math.sin(t * 6) * 4, 240, 120); }
  if (expr === 'fizzy') for (let i = 0; i < 3; i++) sparkle(ctx, ey[0] + [-180, 185, 140][i], ey[1] + [-70, -40, 120][i], 18 + Math.sin(t * 12 + i) * 6, '#fff');
  if (aIm && !under(lk.acc)) wearAt(aIm, lk.acc);
  if (hIm) wearAt(hIm, lk.hair);
  if (lk && (!aIm || !hIm)) { const vl = { outfit: 'outfit_default', hair: hIm ? 'hair_none' : lk.hair, acc: aIm ? 'acc_none' : lk.acc }; WR.drawHead(ctx, module.exports, vl, { cx: sp.headAnchor[0], cy: sp.headAnchor[1] - (sp.headAnchor[1] - ey[1]) * 0.2, r: sp.faceRadius, ey: ey[1], ny: sp.neckOnHead[1] }, ch, t); }
  ctx.restore();
}
function mouthPos(x, y, s, bob, ch) {
  const P = ch ? streamerParts(ch) : null;
  if (!P) return mouthPosVec(x, y, s, bob);
  return { x: x, y: y + (bob || 0) + (P.sp.mouth[1] - P.sp.headAnchor[1]) * S.streamerK(P.sp) * s };
}

// backgrounds
function bgPath(idx) { return 'bg/' + D.BACKGROUNDS[idx % D.BACKGROUNDS.length].id + '.jpg'; }
function background(ctx, idx, createCanvas, W, H, scale) {
  const im = S.enabled() ? S.getBg(bgPath(idx)) : null;
  if (im) S.cover(ctx, im, W, H); else backgroundVec(ctx, idx, createCanvas, W, H, scale);
}
function backgroundLive(ctx, idx, W, H, t) {
  if (!(S.enabled() && S.get(bgPath(idx)))) { backgroundLiveVec(ctx, idx, W, H, t); return; }
  // the painted backgrounds already have clouds; keep only the drifting petals and the twinkles
  if (idx === 2) { for (let i = 0; i < 8; i++) { const px = (W * 0.1 + i * W * 0.12 + t * 18) % W, py = ((t * 40 + i * 120) % (H * 0.5)); heart(ctx, px, py, 5, 'rgba(255,160,190,0.8)', 0); } }
  if (idx === 4) { for (let i = 0; i < 4; i++) { const a = 0.4 + 0.4 * Math.sin(t * 3 + i); star(ctx, W * (0.15 + i * 0.22), H * 0.08 + (i % 2) * 40, 5, 'rgba(255,255,255,' + a + ')', 0); } }
}
function storeBackground(ctx, createCanvas, W, H, scale) {
  const im = S.enabled() ? S.getBg(S.STORE.bg) : null;
  if (im) S.cover(ctx, im, W, H); else storeBackgroundVec(ctx, createCanvas, W, H, scale);
}

// supermarket + checkout props
function shelfBoard(ctx, x, y, w, h, color) {
  const im = S.get(S.STORE.shelf); if (!im) { shelfBoardVec(ctx, x, y, w, h, color); return; }
  ctx.drawImage(im, x, y, w, h);
  ctx.globalAlpha = 0.3; rr(ctx, x + 2, y + 2, w - 4, h * 0.45, h * 0.2); ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1; // tint by shelf colour
}
// basket: (x, y) = left end of the rim, w = rim width
function basket(ctx, x, y, w, h) {
  const B = S.STORE.basket, im = S.get(B.image); if (!im) { basketVec(ctx, x, y, w, h); return; }
  const k = (w + 8) / (B.rim[1] - B.rim[0]);
  ctx.drawImage(im, x + w / 2 - B.anchor[0] * k, y - B.anchor[1] * k, B.w * k, B.h * k);
}
// self-checkout machine in the box (x, y, w, h); returns the screen and scanner rects
function machine(ctx, x, y, w, h) {
  const M = S.STORE.machine, im = S.get(M.image); if (!im) return machineVec(ctx, x, y, w, h);
  const k = Math.min(w / M.w, h / M.h), ox = x + (w - M.w * k) / 2, oy = y;
  ctx.drawImage(im, ox, oy, M.w * k, M.h * k);
  const sc = M.screen, sl = M.slot;
  return { sx: ox + sc[0] * k, sy: oy + sc[1] * k, sw: sc[2] * k, sh: sc[3] * k, px: ox + sl[0] * k, py: oy + sl[1] * k, pw: sl[2] * k, ph: sl[3] * k };
}
function conveyor(ctx, x, y, w, h) {
  const V = S.STORE.conveyor, im = S.get(V.image); if (!im) { conveyorVec(ctx, x, y, w, h); return; }
  S.nine(ctx, im, V.slice, V.w, V.h, x, y, w, h, Math.min(0.5, h / V.h));
}
function cashier(ctx, x, y, s) {
  const im = S.get(S.STORE.cashier); if (!im) { cashierVec(ctx, x, y, s); return; }
  const w = 128 * s, h = 140 * s; ctx.drawImage(im, x - w / 2, y - h / 2 + 18 * s, w, h);
}
function phoneStick(ctx, x, y, s, t) {
  if (roomBitmap()) return; // the V3 room has its own ring light where the selfie stick stood
  const U2 = S.UI.phone, im = S.get(U2.image); if (!im) { phoneStickVec(ctx, x, y, s, t); return; }
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(-0.25 + Math.sin(t * 1.5) * 0.02);
  const k = 1.1; ctx.drawImage(im, -U2.anchor[0] * k, 260 - U2.anchor[1] * k, U2.w * k, U2.h * k);
  ctx.restore();
}

// ─── V2 vector fallbacks (until docs/ART-REQUEST-V2.md art arrives) ───
// Catalog dishes by `shape`, drawn in a 100-unit box centred at (x, y); e = eaten 0..1.
function dishVec(ctx, f, x, y, size, e, t) {
  e = U.clamp(e || 0, 0, 1); t = t || 0;
  ctx.save(); ctx.translate(x, y); const s = size / 100; ctx.scale(s, s);
  const lw = 4, left = 1 - e;
  const pieces = function (n, fn) { const k = Math.max(0, Math.ceil(n * left - 1e-6)); for (let i = 0; i < k; i++) fn(i, n); };
  const steam = function () { if (f.taste !== 'spicy' && f.taste !== 'savory') return; ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (let i = -1; i <= 1; i++) { const ph = t * 2 + i; ctx.beginPath(); ctx.moveTo(i * 14, -30); ctx.quadraticCurveTo(i * 14 + 8 * Math.sin(ph), -42, i * 14, -54 - 4 * Math.sin(ph * 1.3)); ctx.stroke(); } };
  switch (f.shape) {
    case 'plate':
      ellipse(ctx, 0, 24, 46, 15, '#fff', lw); ellipse(ctx, 0, 24, 36, 9, '#eef3ff', 0);
      pieces(5, function (i) { const px = [-18, 4, 22, -6, 12][i], py = [14, 16, 12, 2, 2][i]; ellipse(ctx, px, py, 15, 11, f.c1, 3); ellipse(ctx, px - 4, py - 4, 5, 3, 'rgba(255,255,255,0.5)', 0); if (i % 2) circle(ctx, px + 5, py + 1, 3, f.c2, 0); });
      break;
    case 'bowl': {
      ctx.beginPath(); ctx.moveTo(-42, 0); ctx.quadraticCurveTo(-40, 42, 0, 42); ctx.quadraticCurveTo(40, 42, 42, 0); ctx.closePath(); fillStroke(ctx, '#fff', lw);
      ctx.fillStyle = f.c3; ctx.fillRect(-36, 18, 72, 6);
      const h = 14 * left; if (h > 1) { ellipse(ctx, 0, 2 - h * 0.3, 40, 8 + h * 0.4, f.c1, 3); pieces(4, function (i) { circle(ctx, [-18, 0, 18, -6][i], [-2, -6, -1, 4][i] - h * 0.3, 6, f.c2, 2); }); }
      else ellipse(ctx, 0, 2, 40, 8, '#f3f0ea', 3);
      if (left > 0.3) steam(); break;
    }
    case 'box':
      rr(ctx, -40, -6, 80, 46, 8); fillStroke(ctx, '#f3c58b', lw); ctx.fillStyle = '#e8b267'; ctx.fillRect(-36, 22, 72, 6);
      pieces(5, function (i) { const px = [-22, 0, 22, -11, 11][i], py = [-8, -12, -8, -24, -24][i]; ellipse(ctx, px, py, 13, 11, f.c1, 3); ellipse(ctx, px - 3, py - 4, 4, 3, f.c2, 0); });
      rr(ctx, -40, -6, 80, 10, 4); fillStroke(ctx, f.c3, 3); break;
    case 'burger': {
      const k = left;
      ctx.save(); ctx.beginPath(); ctx.rect(-50, -50, 100 * k + 4, 100); ctx.clip();
      ellipse(ctx, 0, 30, 40, 9, f.c3 || '#e8a25a', lw); rr(ctx, -40, 12, 80, 14, 7); fillStroke(ctx, '#7a4b2f', lw);
      ctx.beginPath(); ctx.moveTo(-42, 10); for (let i = 0; i <= 6; i++) ctx.lineTo(-42 + i * 14, 10 + (i % 2 ? 8 : 0)); ctx.lineTo(42, 4); ctx.lineTo(-42, 4); ctx.closePath(); fillStroke(ctx, f.c2, 3);
      ctx.fillStyle = '#7ed37a'; ctx.fillRect(-42, 2, 84, 5);
      ctx.beginPath(); ctx.moveTo(-40, 2); ctx.quadraticCurveTo(-40, -34, 0, -34); ctx.quadraticCurveTo(40, -34, 40, 2); ctx.closePath(); fillStroke(ctx, f.c1, lw);
      for (let i = 0; i < 5; i++) ellipse(ctx, -20 + i * 10, -20 + (i % 2) * 6, 2.5, 1.5, '#fff8e1', 0);
      ctx.restore(); break;
    }
    case 'pizza': {
      circle(ctx, 0, 6, 42, f.c3, lw); circle(ctx, 0, 6, 35, f.c1, 0);
      const gone = Math.round(5 * e);
      for (let i = 0; i < gone; i++) { ctx.beginPath(); ctx.moveTo(0, 6); ctx.arc(0, 6, 44, -Math.PI / 2 + i * TAU / 5, -Math.PI / 2 + (i + 1) * TAU / 5); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); }
      for (let i = 0; i < 5; i++) { if (i < gone) continue; const a = -Math.PI / 2 + (i + 0.5) * TAU / 5; circle(ctx, Math.cos(a) * 20, 6 + Math.sin(a) * 20, 7, f.c2, 2); }
      ctx.strokeStyle = 'rgba(91,61,59,0.4)'; ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * TAU / 5; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(Math.cos(a) * 42, 6 + Math.sin(a) * 42); ctx.stroke(); }
      break;
    }
    case 'tray':
      rr(ctx, -44, 4, 88, 30, 8); fillStroke(ctx, '#3d2f3a', lw);
      pieces(5, function (i) { const px = -30 + i * 15; rr(ctx, px - 7, -6, 14, 18, 5); fillStroke(ctx, f.c2, 2.5); rr(ctx, px - 8, -12, 16, 9, 4); fillStroke(ctx, f.c1, 2.5); });
      break;
    case 'cup': {
      ctx.beginPath(); ctx.moveTo(-26, -30); ctx.lineTo(26, -30); ctx.lineTo(20, 40); ctx.lineTo(-20, 40); ctx.closePath(); fillStroke(ctx, 'rgba(255,255,255,0.85)', lw);
      const lvl = -26 + 64 * e; ctx.save(); ctx.beginPath(); ctx.moveTo(-26, -30); ctx.lineTo(26, -30); ctx.lineTo(20, 40); ctx.lineTo(-20, 40); ctx.closePath(); ctx.clip(); ctx.fillStyle = f.c1; ctx.fillRect(-30, lvl, 60, 80); ctx.fillStyle = 'rgba(255,255,255,0.3)'; ctx.fillRect(-14, lvl, 6, 80); ctx.restore();
      ctx.lineWidth = 7; ctx.strokeStyle = f.c3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(8, 10); ctx.lineTo(16, -48); ctx.stroke(); break;
    }
    case 'fries':
      pieces(7, function (i) { rr(ctx, -24 + i * 7, -36 + (i % 3) * 6, 7, 40, 3); fillStroke(ctx, f.c1, 2); });
      ctx.beginPath(); ctx.moveTo(-30, -6); ctx.lineTo(30, -6); ctx.lineTo(24, 40); ctx.lineTo(-24, 40); ctx.closePath(); fillStroke(ctx, f.c2, lw); circle(ctx, 0, 16, 9, '#fff', 2); break;
    case 'skewer':
      ctx.strokeStyle = '#c49a6c'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-36, 34); ctx.lineTo(34, -36); ctx.stroke();
      pieces(3, function (i) { const px = 14 - i * 20, py = -16 + i * 20; circle(ctx, px, py, 13, f.c1, 3); circle(ctx, px - 4, py - 4, 4, 'rgba(255,255,255,0.5)', 0); }); break;
    case 'pot': {
      ellipse(ctx, 0, 30, 44, 10, '#3d3d4a', lw); rr(ctx, -44, -6, 88, 38, 14); fillStroke(ctx, '#4a4a5a', lw);
      rr(ctx, -54, 2, 12, 8, 4); fillStroke(ctx, '#4a4a5a', 3); rr(ctx, 42, 2, 12, 8, 4); fillStroke(ctx, '#4a4a5a', 3);
      ellipse(ctx, 0, -6, 42, 10, left > 0.05 ? f.c1 : '#7a5a4a', 3);
      pieces(5, function (i) { circle(ctx, [-24, -8, 10, 26, 0][i], [-8, -4, -9, -5, -12][i], 7, i % 2 ? f.c2 : '#fff', 2); });
      if (left > 0.3) steam(); break;
    }
    case 'parfait': {
      ctx.beginPath(); ctx.moveTo(-28, -34); ctx.lineTo(28, -34); ctx.lineTo(14, 26); ctx.lineTo(-14, 26); ctx.closePath(); fillStroke(ctx, 'rgba(255,255,255,0.9)', lw);
      rr(ctx, -4, 26, 8, 12, 2); fillStroke(ctx, '#fff', 3); ellipse(ctx, 0, 40, 20, 5, '#fff', 3);
      const cols = [f.c1, f.c2, f.c3, '#8fd1ff', '#cdb0ff']; const layers = Math.max(0, Math.ceil(5 * left));
      ctx.save(); ctx.beginPath(); ctx.moveTo(-28, -34); ctx.lineTo(28, -34); ctx.lineTo(14, 26); ctx.lineTo(-14, 26); ctx.closePath(); ctx.clip();
      for (let i = 0; i < layers; i++) { ctx.fillStyle = cols[i]; ctx.fillRect(-30, 26 - (i + 1) * 12, 60, 12); } ctx.restore();
      if (layers >= 5) { circle(ctx, 0, -38, 10, '#fff8ef', 3); circle(ctx, 0, -48, 5, C.red, 2); }
      break;
    }
    case 'bento': {
      rr(ctx, -44, -24, 88, 58, 10); fillStroke(ctx, '#ff9fc4', lw); rr(ctx, -38, -18, 76, 46, 6); fillStroke(ctx, '#fff8ef', 3);
      ctx.strokeStyle = '#e8759a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(0, 28); ctx.moveTo(0, 5); ctx.lineTo(38, 5); ctx.stroke();
      pieces(5, function (i) { const pos = [[-20, -6, '#fff'], [-20, 14, '#ffe066'], [18, -8, '#d6841a'], [18, 16, '#5fbf5a'], [-26, 2, '#ff7a6b']][i]; ellipse(ctx, pos[0], pos[1], 12, 8, pos[2], 2.5); });
      break;
    }
    default:
      ellipse(ctx, 0, 24, 44, 14, '#fff', lw); circle(ctx, 0, 4, 26 * Math.max(0.2, left), f.c1, lw);
  }
  ctx.restore();
}
// gift box for a mystery food; `open` 0..1 lifts the lid
function mysteryBox(ctx, x, y, size, t, open, gold) {
  ctx.save(); ctx.translate(x, y + Math.sin(t * 4) * 2); const s = size / 100; ctx.scale(s, s); ctx.rotate(Math.sin(t * 6) * 0.05 * (1 - open));
  const body = gold ? '#ffd95e' : '#cdb0ff', rib = gold ? '#ff7fa8' : '#ff9fc4';
  rr(ctx, -34, -10, 68, 48, 8); fillStroke(ctx, body, 4); ctx.fillStyle = rib; ctx.fillRect(-6, -10, 12, 48);
  ctx.save(); ctx.translate(0, -open * 40); ctx.rotate(-open * 0.5);
  rr(ctx, -40, -24, 80, 18, 6); fillStroke(ctx, shade(body, -0.05), 4); ctx.fillStyle = rib; ctx.fillRect(-6, -24, 12, 18);
  ellipse(ctx, -12, -30, 12, 8, rib, 3); ellipse(ctx, 12, -30, 12, 8, rib, 3); circle(ctx, 0, -28, 5, shade(rib, -0.2), 2);
  ctx.restore();
  if (open < 0.2) text(ctx, '?', 0, 16, 30, '#fff', 4);
  ctx.restore();
}
// closed take-away box (delivery) in the restaurant's colour; tap to open
function takeoutBox(ctx, x, y, size, color, label, t) {
  ctx.save(); ctx.translate(x, y + Math.sin(t * 3) * 1.5); const s = size / 100; ctx.scale(s, s);
  ctx.beginPath(); ctx.moveTo(-36, -18); ctx.lineTo(36, -18); ctx.lineTo(30, 38); ctx.lineTo(-30, 38); ctx.closePath(); fillStroke(ctx, '#f3c58b', 4);
  ctx.beginPath(); ctx.moveTo(-36, -18); ctx.lineTo(-22, -38); ctx.lineTo(22, -38); ctx.lineTo(36, -18); ctx.closePath(); fillStroke(ctx, '#e8b267', 4);
  circle(ctx, 0, 10, 17, color, 3); text(ctx, label, 0, 11, 13, '#fff', 2.5);
  ctx.restore();
}
// home stream room: the chapter background seen through a big window, room wall around it
// art V3: the room is a bitmap with a real see-through window (windowAlphaBounds [216, 191, 624, 586] on 1080×2400)
const ROOM = { image: 'bg/home_room.png', win: [216, 191, 624, 586] };
function roomBitmap() { return S.enabled() ? S.get(ROOM.image) : null; }
function homeRoom(ctx, view, createCanvas, W, H, scale, t) {
  const room = roomBitmap();
  if (room) {
    const s = Math.max(W / S.BG_W, H / S.BG_H), ox = (W - S.BG_W * s) / 2, w = ROOM.win;
    const vx = ox + w[0] * s, vy = w[1] * s, vw = w[2] * s, vh = w[3] * s;
    const VIEW = { park: 'view_park', beach: 'view_beach', sakura: 'view_sakura', room: 'view_night', city: 'view_city' };
    const bid = D.BACKGROUNDS[view % D.BACKGROUNDS.length].id; const v = S.getBg('bg/' + VIEW[bid] + '.jpg') || S.getBg(bgPath(view));
    ctx.save(); ctx.beginPath(); ctx.rect(vx, vy, vw, vh); ctx.clip();
    if (v) { const k = Math.max(vw / v.width, vh / v.height); ctx.drawImage(v, vx + (vw - v.width * k) / 2, vy + (vh - v.height * k) * 0.35, v.width * k, v.height * k); }
    else { ctx.fillStyle = '#bfe9ff'; ctx.fillRect(vx, vy, vw, vh); }
    ctx.restore();
    ctx.drawImage(room, ox, 0, S.BG_W * s, S.BG_H * s);
    return;
  }
  background(ctx, view, createCanvas, W, H, scale);
  const wx = W * 0.16, wy = H * 0.07, ww = W * 0.68, wh = H * 0.31;
  const wall = '#f6ecff', stripe = '#efe0ff';
  ctx.fillStyle = wall; ctx.fillRect(0, 0, W, wy); ctx.fillRect(0, wy + wh, W, H - wy - wh); ctx.fillRect(0, wy, wx, wh); ctx.fillRect(wx + ww, wy, W - wx - ww, wh);
  ctx.fillStyle = stripe; for (let i = 0; i < 12; i++) { const sx = i * W / 12; if (sx + W / 24 < wx || sx > wx + ww) ctx.fillRect(sx, 0, W / 24, H); else { ctx.fillRect(sx, 0, W / 24, wy); ctx.fillRect(sx, wy + wh, W / 24, H); } }
  // window frame + cross
  ctx.lineJoin = 'round'; rr(ctx, wx - 8, wy - 8, ww + 16, wh + 16, 18); ctx.lineWidth = 12; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.lineWidth = 4; ctx.strokeStyle = OUT; rr(ctx, wx - 14, wy - 14, ww + 28, wh + 28, 22); ctx.stroke(); rr(ctx, wx - 2, wy - 2, ww + 4, wh + 4, 12); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(wx + ww / 2 - 4, wy, 8, wh); ctx.fillRect(wx, wy + wh * 0.45 - 4, ww, 8);
  // curtains
  for (let k = 0; k < 2; k++) { const cx = k ? wx + ww + 10 : wx - 10, dir = k ? -1 : 1; ctx.beginPath(); ctx.moveTo(cx - dir * 26, wy - 22); ctx.lineTo(cx + dir * 34, wy - 22); ctx.quadraticCurveTo(cx + dir * 6, wy + wh * 0.5, cx + dir * 24, wy + wh + 18); ctx.lineTo(cx - dir * 26, wy + wh + 18); ctx.closePath(); fillStroke(ctx, '#ffc2d6', 4); }
  // fairy lights
  ctx.strokeStyle = '#8a6d6b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, wy - 30); ctx.quadraticCurveTo(W / 2, wy + 10, W, wy - 30); ctx.stroke();
  for (let i = 1; i < 10; i++) { const lx = i * W / 10, ly = wy - 30 + Math.sin(i / 10 * Math.PI) * 30 + 4; const on = 0.6 + 0.4 * Math.sin(t * 3 + i); circle(ctx, lx, ly, 5, ['#ffd95e', '#ff9fc4', '#9fe3c9', '#8fd1ff'][i % 4], 0); ctx.globalAlpha = 0.3 * on; circle(ctx, lx, ly, 11, '#fff3b0', 0); ctx.globalAlpha = 1; }
  // shelf with plushies (left) and a poster (right)
  const sy = wy + wh + 46; rr(ctx, 14, sy, 96, 10, 5); fillStroke(ctx, '#c9a27c', 3);
  circle(ctx, 40, sy - 16, 16, '#ffd1e3', 3); circle(ctx, 30, sy - 30, 6, '#ffd1e3', 3); circle(ctx, 50, sy - 30, 6, '#ffd1e3', 3);
  circle(ctx, 82, sy - 16, 16, '#c99b6a', 3); circle(ctx, 72, sy - 30, 6, '#c99b6a', 3); circle(ctx, 92, sy - 30, 6, '#c99b6a', 3);
  rr(ctx, W - 100, sy - 66, 74, 86, 8); fillStroke(ctx, '#fff8ef', 4); heart(ctx, W - 63, sy - 30, 14, C.pink, 3); text(ctx, 'LIVE', W - 63, sy + 4, 14, C.pinkDark, 0);
}
// buffet restaurant: warm wall, hanging lanterns, counters in the back
function restaurantBg(ctx, W, H, t, tone) {
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.55); g.addColorStop(0, '#ffe3c2'); g.addColorStop(1, '#ffd0a8'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e8a87a'; ctx.fillRect(0, H * 0.34, W, H); ctx.fillStyle = '#d9945f'; for (let i = 0; i < 9; i++) ctx.fillRect(i * W / 8, H * 0.34, 4, H);
  // back counter with pans
  rr(ctx, -10, H * 0.36, W + 20, 40, 10); fillStroke(ctx, '#c9c9d9', 4); for (let i = 0; i < 6; i++) { rr(ctx, 14 + i * (W - 28) / 6, H * 0.36 - 12, (W - 28) / 6 - 10, 20, 6); fillStroke(ctx, ['#ff8a6b', '#ffd27a', '#9fe37a', '#ffb3c7', '#8fd1ff', '#f3c58b'][i], 3); }
  // lanterns
  for (let i = 0; i < 4; i++) { const lx = W * (0.14 + i * 0.24), ly = H * 0.08 + (i % 2) * 18 + Math.sin(t * 1.5 + i) * 3; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, ly - 22); ctx.stroke(); ellipse(ctx, lx, ly, 20, 24, i % 2 ? '#ff7a6b' : '#ffd95e', 3); ctx.globalAlpha = 0.25; circle(ctx, lx, ly, 40, '#fff3b0', 0); ctx.globalAlpha = 1; }
  // menu board
  rr(ctx, W * 0.33, H * 0.14, W * 0.34, H * 0.12, 12); fillStroke(ctx, '#5b3d3b', 4); text(ctx, 'ALL YOU', W * 0.5, H * 0.18, 20, '#fff8ef', 0); text(ctx, 'CAN EAT!', W * 0.5, H * 0.22, 20, '#ffd95e', 0);
  if (tone) { ctx.fillStyle = tone; ctx.fillRect(0, 0, W, H); }
}
// DIY kitchen: tiled wall + counter
function kitchenBg(ctx, W, H) {
  ctx.fillStyle = '#e9fbf3'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#cdeee0'; ctx.lineWidth = 2; for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(i * 48, 0); ctx.lineTo(i * 48, H * 0.62); ctx.stroke(); } for (let j = 0; j < 14; j++) { ctx.beginPath(); ctx.moveTo(0, j * 48); ctx.lineTo(W, j * 48); ctx.stroke(); }
  rr(ctx, W * 0.1, H * 0.16, W * 0.8, 14, 6); fillStroke(ctx, '#c9a27c', 3);
  for (let i = 0; i < 5; i++) { const jx = W * (0.17 + i * 0.165); rr(ctx, jx - 18, H * 0.16 - 44, 36, 44, 8); fillStroke(ctx, ['#ffd1e3', '#fff0c2', '#d4f5de', '#d9d4ff', '#ffe0ea'][i], 3); }
  ctx.fillStyle = '#f3c58b'; ctx.fillRect(0, H * 0.62, W, H); ctx.fillStyle = '#e8b267'; ctx.fillRect(0, H * 0.62, W, 10);
  ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(0, H * 0.62); ctx.lineTo(W, H * 0.62); ctx.stroke();
}
// buffet tongs at (x, y) pointing down; `closed` 0..1
function tongs(ctx, x, y, closed) {
  ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round';
  const o = 12 * (1 - closed);
  for (let k = -1; k <= 1; k += 2) { ctx.strokeStyle = OUT; ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(k * 4, -90); ctx.lineTo(k * (o + 4), -6); ctx.stroke(); ctx.strokeStyle = '#d9dbe6'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(k * 4, -90); ctx.lineTo(k * (o + 4), -6); ctx.stroke(); }
  rr(ctx, -10, -112, 20, 28, 8); fillStroke(ctx, C.pink, 3);
  ctx.restore();
}
// steel buffet pan holding a dish
function buffetPan(ctx, x, y, w, h, color) { rr(ctx, x, y, w, h, 12); fillStroke(ctx, '#dfe3ee', 4); rr(ctx, x + 6, y + 6, w - 12, h - 12, 8); fillStroke(ctx, color || '#f4f6fb', 2); }
// a delivery scooter (moving left as `t` grows)
function scooter(ctx, x, y, s, t) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  circle(ctx, -40, 30, 16, '#4a4a5a', 4); circle(ctx, 44, 30, 16, '#4a4a5a', 4); circle(ctx, -40, 30, 6, '#ccc', 0); circle(ctx, 44, 30, 6, '#ccc', 0);
  rr(ctx, -54, -4, 110, 28, 14); fillStroke(ctx, '#ff8fb3', 4);
  rr(ctx, 10, -58, 46, 44, 8); fillStroke(ctx, '#ffd95e', 4); text(ctx, 'GO!', 33, -36, 16, '#fff', 3);
  ctx.strokeStyle = OUT; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-46, -4); ctx.lineTo(-58, -40); ctx.stroke(); rr(ctx, -72, -46, 26, 10, 5); fillStroke(ctx, '#5b9fff', 3);
  // rider
  rr(ctx, -30, -46, 30, 40, 12); fillStroke(ctx, '#9fe3c9', 4); circle(ctx, -15, -62, 16, '#ffe6d6', 4); ctx.beginPath(); ctx.arc(-15, -66, 17, Math.PI, 0); fillStroke(ctx, '#ff5a74', 4);
  ctx.globalAlpha = 0.5; for (let i = 0; i < 3; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(70 + i * 16 + (t * 200 % 16), -10 + i * 10, 18, 4); } ctx.globalAlpha = 1;
  ctx.restore();
}
// flames around the streamer's head while "on fire"
function flames(ctx, x, y, r, t) {
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i / 8) * Math.PI, fx = x + Math.cos(a) * r, fy = y + Math.sin(a) * r * 0.9; const h = 26 + 10 * Math.sin(t * 12 + i * 1.7);
    ctx.beginPath(); ctx.moveTo(fx - 10, fy); ctx.quadraticCurveTo(fx - 12, fy - h * 0.6, fx, fy - h); ctx.quadraticCurveTo(fx + 12, fy - h * 0.6, fx + 10, fy); ctx.closePath();
    ctx.fillStyle = i % 2 ? 'rgba(255,120,40,0.85)' : 'rgba(255,200,60,0.85)'; ctx.fill();
  }
}

// ─── V3: one package on the table + the portion carried to the mouth ───
// state: 'sealed' · 'opening' (k 0..1) · 'open' (e = pickups / 3) · 'empty'
// art V3 packaged food (subpackage art3): 6 states per food + an opening strip per package type
const FOOD3 = { cat_chips: 1, honey_puffs: 1, cheese_noodle: 1, straw_cake: 1, peach_milk: 1, chili_noodle: 1, kfc_chicken: 1, mint_choc: 1, soda_pop: 1, rainbow_candy: 1 };
function food3(ctx, id, state, x, y, size) { const im = S.get('food3/' + id + '_' + state + '.png'); if (!im) return false; ctx.drawImage(im, x - size / 2, y - size / 2, size, size); return true; }
function pack3(ctx, f, kind, x, y, size, state, k, e) {
  if (!FOOD3[f.id]) return false; const z = size * (kind === 'bag' ? 0.92 : 1.05); // the V3 packages are drawn edge to edge: bags read too big at 1:1
  if (state === 'opening') { // the item's own art (never a generic package): a wobble while sealed, a pop as it opens; pack() adds the flying seal
    const open = k >= 0.35, w = open ? 0 : Math.sin(k * 46) * (1 - k / 0.35) * 0.07, pop = open ? 1 + 0.08 * Math.max(0, 1 - (k - 0.35) * 5) : 1 - 0.04 * Math.sin(k / 0.35 * Math.PI);
    ctx.save(); ctx.translate(x, y + z * 0.4); ctx.rotate(w); ctx.scale(pop, 1 / pop); ctx.translate(-x, -(y + z * 0.4));
    const ok = food3(ctx, f.id, open ? 'open' : 'sealed', x, y, z) || food3(ctx, f.id, 'sealed', x, y, z); ctx.restore(); return ok ? 'seal' : false; }
  const st = state === 'sealed' ? 'sealed' : state === 'empty' || e >= 1 ? 'empty' : e >= 0.66 ? 'p2' : e >= 0.33 ? 'p1' : 'open';
  return food3(ctx, f.id, st, x, y, z);
}
function pack(ctx, f, kind, x, y, size, state, k, e, t, toppings) {
  const p3 = pack3(ctx, f, kind, x, y, size, state, k || 0, e || 0); if (p3 === true) return;
  const s = size / 100;
  if (p3 === 'seal') { if (kind === 'bag' || kind === 'bottle') packSeal(ctx, f, kind, x, y, size, state, k); return; }
  if (state === 'empty') { ctx.globalAlpha = 0.85; food(ctx, f, x, y, size, 1, t); ctx.globalAlpha = 1; for (let i = 0; i < 5; i++) circle(ctx, x - size * 0.25 + i * size * 0.12, y + size * 0.36 + (i % 2) * 4, size * 0.018, f.c3 || OUT, 0); return; }
  const showFood = state === 'open' || (state === 'opening' && (kind === 'bag' || kind === 'cup' || kind === 'bottle' || k > 0.4));
  if (kind === 'box' || kind === 'dome') {
    if (showFood) { food(ctx, f, x, y, size, state === 'open' ? e : 0, t); toppingDots(ctx, toppings, x, y, size, state === 'open' ? e : 0); }
    const lift = state === 'sealed' ? 0 : U.easeInOut(k); if (state === 'open') return;
    ctx.save(); ctx.globalAlpha = 1 - Math.max(0, lift - 0.6) / 0.4; ctx.translate(x, y - lift * size * 0.7); ctx.rotate(-lift * 0.4); ctx.scale(s, s);
    if (kind === 'box') { rr(ctx, -46, -36, 92, 74, 10); fillStroke(ctx, '#f3c58b', 4); ctx.fillStyle = '#e8b267'; ctx.fillRect(-42, -8, 84, 6); circle(ctx, 0, 8, 18, f.c1, 3); text(ctx, '♥', 0, 9, 18, '#fff', 0); }
    else { ellipse(ctx, 0, 34, 50, 10, '#e9eef8', 4); ctx.beginPath(); ctx.moveTo(-46, 32); ctx.quadraticCurveTo(-46, -36, 0, -40); ctx.quadraticCurveTo(46, -36, 46, 32); ctx.closePath(); fillStroke(ctx, '#dfe3ee', 4); ellipse(ctx, -16, -10, 10, 18, 'rgba(255,255,255,0.7)', 0); circle(ctx, 0, -44, 7, '#c9cdd9', 3); }
    ctx.restore(); ctx.globalAlpha = 1; return;
  }
  // bag / cup / bottle: the package itself is the food art; a seal sits on top
  food(ctx, f, x, y, size, state === 'open' ? e : 0, t); toppingDots(ctx, toppings, x, y, size, state === 'open' ? e : 0);
  if (state === 'open') return;
  packSeal(ctx, f, kind, x, y, size, state, k);
}
function packSeal(ctx, f, kind, x, y, size, state, k) {
  const s = size / 100, g = state === 'sealed' ? 0 : U.easeInOut(k);
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (kind === 'bag') { ctx.translate(g * 40, -38 - g * 60); ctx.rotate(g * 0.9); ctx.globalAlpha = 1 - g; rr(ctx, -40, -6, 80, 14, 4); fillStroke(ctx, '#ffffff', 3); ctx.strokeStyle = 'rgba(91,61,59,0.5)'; ctx.lineWidth = 2; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(-36, 1); ctx.lineTo(36, 1); ctx.stroke(); ctx.setLineDash([]); }
  else if (kind === 'cup') { /* the cup art already shows its own lid: no extra vector seal on top */ }
  else { ctx.translate(0, -48 - g * 70); ctx.rotate(g * 2.5); ctx.globalAlpha = 1 - g; rr(ctx, -12, -8, 24, 16, 4); fillStroke(ctx, f.c1 || C.pink, 3); }
  ctx.restore(); ctx.globalAlpha = 1;
  if (state === 'opening' && kind === 'bottle' && g > 0.2) { for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.3; circle(ctx, x + Math.cos(a) * size * 0.3 * g, y - size * 0.5 + Math.sin(a) * size * 0.3 * g, size * 0.025, 'rgba(255,255,255,0.9)', 0); } }
}
function toppingDots(ctx, toppings, x, y, size, e) {
  if (!toppings || !toppings.length || e >= 1) return; const K2 = require('./catalog.js');
  for (let i = 0; i < toppings.length; i++) { const tp = K2.TOPPINGS[toppings[i]]; if (!tp) continue; const a = i / toppings.length * Math.PI * 2; circle(ctx, x + Math.cos(a) * size * 0.16 * (1 - e), y - size * 0.2 + Math.sin(a) * size * 0.05, size * 0.045, tp[1], 2); }
}
// one bite-sized portion (on chopsticks, fork, spoon or a sip) at (x, y)
function portion(ctx, f, x, y, size, t) {
  if (FOOD3[f.id]) { ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin((t || 0) * 6) * 0.05); const ok = food3(ctx, f.id, 'portion', 0, 0, size * 1.3); ctx.restore(); if (ok) return; }
  const s = size / 100; ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.sin((t || 0) * 6) * 0.05);
  const tags = f.tags || [], cat = f.cat;
  const kind = tags.indexOf('drink') >= 0 || cat === 'drinks' ? 'sip' : tags.indexOf('noodle') >= 0 || cat === 'noodles' ? 'noodle' : cat === 'icecream' || (tags.indexOf('cold') >= 0 && tags.indexOf('dessert') >= 0) ? 'scoop' : tags.indexOf('dessert') >= 0 || cat === 'cakes' ? 'cake' : cat === 'snacks' || tags.indexOf('crunchy') >= 0 ? 'chip' : cat === 'fruit' || tags.indexOf('fruit') >= 0 ? 'fruit' : 'chunk';
  // finger food is held by hand: no chopsticks, no spoon
  const hand = /burger|sandwich|pizza|taco|hotdog|hot_dog|fries|chicken|wing|nugget|drumstick|toast|kebab|corn_dog|donut|churro|pretzel|onigiri|kimbap|gimbap/.test(f.id);
  if (hand) {
    if (/burger|sandwich/.test(f.id)) { ellipse(ctx, 0, 14, 26, 9, '#e0a050', 4); rr(ctx, -26, 2, 52, 9, 4); fillStroke(ctx, '#7a4b2f', 3); ctx.beginPath(); ctx.moveTo(-28, 0); for (let i = 0; i <= 8; i++) ctx.lineTo(-28 + i * 7, i % 2 ? 4 : -3); ctx.lineTo(28, 0); ctx.closePath(); fillStroke(ctx, '#7fd46a', 2.5); rr(ctx, -24, -6, 48, 6, 2); fillStroke(ctx, '#ffd23f', 2); ctx.beginPath(); ctx.moveTo(-27, -6); ctx.quadraticCurveTo(-26, -30, 0, -30); ctx.quadraticCurveTo(26, -30, 27, -6); ctx.closePath(); fillStroke(ctx, '#f0b060', 4); for (let i = 0; i < 5; i++) ellipse(ctx, -14 + i * 7, -21 + (i % 2) * 4, 1.6, 1, '#fff6d8', 0); }
    else if (/pizza/.test(f.id)) { ctx.beginPath(); ctx.moveTo(-24, -24); ctx.lineTo(24, -24); ctx.lineTo(0, 30); ctx.closePath(); fillStroke(ctx, '#ffd36b', 4); rr(ctx, -27, -30, 54, 9, 4); fillStroke(ctx, '#d9944a', 3); circle(ctx, -6, -10, 5, '#d9402a', 2); circle(ctx, 8, -4, 4.5, '#d9402a', 2); circle(ctx, 0, 10, 4, '#d9402a', 2); }
    else if (/fries/.test(f.id)) { for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(-14 + i * 6, 0); ctx.rotate((i - 2.5) * 0.08); rr(ctx, -3, -26, 6, 40, 2); fillStroke(ctx, '#ffd23f', 2.5); ctx.restore(); } }
    else { ctx.save(); ctx.rotate(-0.5); rr(ctx, 14, -4, 22, 8, 4); fillStroke(ctx, '#fff6e8', 3); circle(ctx, 36, -6, 5, '#fff6e8', 3); circle(ctx, 36, 6, 5, '#fff6e8', 3); ctx.beginPath(); ctx.ellipse(-4, 0, 24, 18, 0, 0, Math.PI * 2); fillStroke(ctx, f.c1, 4); for (let i = 0; i < 6; i++) circle(ctx, -14 + i * 5, -6 + (i % 3) * 5, 2, f.c3 || '#b5651d', 0); ctx.restore(); }
    ctx.restore(); return;
  }
  const stick = function (x0, y0, x1, y1, col) { ctx.lineCap = 'round'; ctx.strokeStyle = OUT; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); };
  if (kind === 'noodle') { stick(-6, -40, 30, 40, '#c49a6c'); stick(6, -42, 40, 34, '#c49a6c');
    const dark = f.v === 5; // black bean noodles keep their dark sauce; every other noodle is golden
    for (let pass = 0; pass < 2; pass++) { ctx.strokeStyle = pass ? (dark ? '#6b4a3a' : '#ffd23f') : (dark ? '#3d2f3a' : '#d99a1a'); ctx.lineWidth = pass ? 4 : 6.5; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(-15 + i * 6, -30); ctx.quadraticCurveTo(-22 + i * 7, 0, -10 + i * 5, 26 + (i % 2) * 6); ctx.stroke(); } }
    ctx.globalAlpha = 0.85; for (let i = 0; i < 3; i++) circle(ctx, -12 + i * 10, 30 + (i % 2) * 5, 3, f.c1, 0); ctx.globalAlpha = 1; }
  else if (kind === 'sip') { ctx.beginPath(); ctx.moveTo(-20, -26); ctx.lineTo(20, -26); ctx.lineTo(15, 30); ctx.lineTo(-15, 30); ctx.closePath(); fillStroke(ctx, 'rgba(255,255,255,0.9)', 4); ctx.fillStyle = f.c1; ctx.fillRect(-17, -8, 33, 36); ctx.lineWidth = 6; ctx.strokeStyle = f.c3 || C.pink; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(12, -46); ctx.stroke(); }
  else if (kind === 'scoop') { stick(10, 14, 40, 44, '#d9dbe6'); ellipse(ctx, 4, 6, 18, 9, '#d9dbe6', 3); circle(ctx, 2, -6, 16, f.c1, 4); circle(ctx, -4, -11, 4, 'rgba(255,255,255,0.7)', 0); }
  else if (kind === 'cake') { stick(8, 8, 40, 44, '#d9dbe6'); rr(ctx, -18, -20, 34, 28, 6); fillStroke(ctx, f.c2 || '#fff5f7', 4); rr(ctx, -18, -26, 34, 10, 5); fillStroke(ctx, f.c1, 3); }
  else if (kind === 'chip') { ctx.beginPath(); ctx.moveTo(-20, 12); ctx.quadraticCurveTo(0, -30, 22, 8); ctx.quadraticCurveTo(0, 22, -20, 12); ctx.closePath(); fillStroke(ctx, f.c1, 4); circle(ctx, -2, 0, 3, f.c3 || OUT, 0); circle(ctx, 8, 6, 2.5, f.c3 || OUT, 0); }
  else if (kind === 'fruit') { stick(6, 6, 38, 44, '#d9dbe6'); ellipse(ctx, 0, -6, 17, 14, f.c1, 4); ellipse(ctx, -5, -11, 4, 3, 'rgba(255,255,255,0.6)', 0); }
  else { stick(-6, -40, 26, 42, '#c49a6c'); stick(6, -42, 36, 36, '#c49a6c'); ellipse(ctx, 0, -14, 20, 15, f.c1, 4); ellipse(ctx, -6, -19, 5, 3, 'rgba(255,255,255,0.5)', 0); }
  ctx.restore();
}

module.exports = { foodOn, pack, portion, dishVec, mysteryBox, takeoutBox, homeRoom, restaurantBg, kitchenBg, tongs, buffetPan, scooter, flames, rr, circle, ellipse, shade, text, coin, star, uiStar, heart, eyeIcon, sparkle, lock, reaction, avatar, food, streamer, mouthPos, background, backgroundLive, table, phoneStick, livePill, profileBadge, coinPill, storeBackground, shelfBoard, priceTag, basket, machine, conveyor, cashier, cloud, logo };
