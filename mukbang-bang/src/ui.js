'use strict';
// Immediate-mode UI on the game canvas: kawaii pastel buttons, panels, labels,
// touch routing. Logical coordinates (design width 540). Touch targets ≥ 48 px.
const U = require('./util.js');
const C = require('./data.js').COLORS;

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

class UI {
  constructor(ctx) {
    this.ctx = ctx; this.W = 540; this.H = 960;
    this.buttons = []; this.pressedId = null; this.pressedPointer = null; this.anim = {}; this.time = 0;
  }
  begin(dt) { this.buttons.length = 0; this.time += dt || 0; }
  font(size, bold) { this.ctx.font = (bold === false ? '' : 'bold ') + Math.round(size) + 'px sans-serif'; }
  measure(text, size, bold) { this.font(size, bold); return this.ctx.measureText(text).width; }
  // Text with an outline (bubbly look). opts: stroke (width), strokeColor, shadow, bold, baseline, alpha
  label(text, x, y, size, color, align, opts) {
    const ctx = this.ctx; opts = opts || {};
    this.font(size, opts.bold);
    ctx.textAlign = align || 'center'; ctx.textBaseline = opts.baseline || 'middle';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (opts.stroke) { ctx.lineWidth = opts.stroke; ctx.strokeStyle = opts.strokeColor || C.outline; ctx.strokeText(text, x, y); }
    if (opts.shadow) { ctx.fillStyle = opts.shadowColor || 'rgba(91,61,59,0.25)'; ctx.fillText(text, x, y + Math.max(1, size * 0.07)); }
    ctx.fillStyle = color || C.text; ctx.fillText(text, x, y);
  }
  // Word-wrapped paragraph, returns the height used.
  paragraph(text, x, y, maxW, size, color, align, lineH) {
    const words = String(text).split(' '); const lines = []; let cur = '';
    this.font(size);
    for (let i = 0; i < words.length; i++) { const t = cur ? cur + ' ' + words[i] : words[i]; if (this.ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = words[i]; } else cur = t; }
    if (cur) lines.push(cur);
    lineH = lineH || size * 1.3;
    for (let i = 0; i < lines.length; i++) this.label(lines[i], x, y + i * lineH, size, color, align);
    return lines.length * lineH;
  }
  panel(x, y, w, h, color, border, radius, borderW) {
    const ctx = this.ctx; roundRect(ctx, x, y, w, h, radius === undefined ? 22 : radius);
    ctx.fillStyle = color || C.cream; ctx.fill();
    if (border) { ctx.lineWidth = borderW || 4; ctx.strokeStyle = border; ctx.stroke(); }
  }
  // A tappable button. opts: color, dark, textColor, size, radius, disabled, badge, icon(ctx,w,h), sub, stroke
  button(id, x, y, w, h, text, opts) {
    opts = opts || {};
    const ctx = this.ctx;
    const pressed = this.pressedId === id;
    const a = this.anim[id] = U.damp(this.anim[id] || 0, pressed ? 1 : 0, 25, 1 / 60);
    const color = opts.disabled ? '#d9cfcf' : (opts.color || C.pink);
    const dark = opts.disabled ? '#b8abab' : (opts.dark || C.pinkDark);
    const r = opts.radius === undefined ? Math.min(24, h / 2) : opts.radius;
    const sc = 1 - a * 0.06;
    ctx.save(); ctx.translate(x + w / 2, y + h / 2); ctx.scale(sc, sc); ctx.translate(-w / 2, -h / 2 + a * 3);
    // 3D bottom edge + outline
    roundRect(ctx, 0, 5, w, h, r); ctx.fillStyle = dark; ctx.fill();
    roundRect(ctx, 0, 0, w, h, r); ctx.fillStyle = pressed ? dark : color; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = C.outline; roundRect(ctx, 0, 0, w, h + 5, r); ctx.stroke();
    // gloss
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(ctx, 6, 4, w - 12, h * 0.36, Math.max(4, r - 4)); ctx.fill();
    if (opts.icon) opts.icon(ctx, w, h);
    if (text) {
      const size = opts.size || Math.min(26, h * 0.42);
      const tcolor = opts.textColor || C.white;
      if (opts.sub) {
        this.label(text, w / 2, h / 2 - size * 0.38, size, tcolor, 'center', { stroke: size * 0.28 });
        this.label(opts.sub, w / 2, h / 2 + size * 0.55, size * 0.6, tcolor, 'center', { stroke: size * 0.18 });
      } else this.label(text, w / 2, h / 2 + 1, size, tcolor, 'center', { stroke: opts.stroke === undefined ? size * 0.28 : opts.stroke });
    }
    if (opts.badge) { ctx.fillStyle = C.red; ctx.beginPath(); ctx.arc(w - 4, 4, 14, 0, Math.PI * 2); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.outline; ctx.stroke(); this.label('!', w - 4, 5, 18, C.white, 'center'); }
    ctx.restore();
    if (!opts.disabled) this.buttons.push({ id: id, x: x, y: y, w: w, h: h });
    return pressed;
  }
  // Invisible hit area (for tappable drawn things like shelf items).
  hotspot(id, x, y, w, h) { this.buttons.push({ id: id, x: x, y: y, w: w, h: h }); }
  hit(x, y) { for (let i = this.buttons.length - 1; i >= 0; i--) { const b = this.buttons[i]; if (x >= b.x - 4 && x <= b.x + b.w + 4 && y >= b.y - 4 && y <= b.y + b.h + 4) return b; } return null; }
  touchStart(id, x, y) { const b = this.hit(x, y); if (!b) return false; this.pressedId = b.id; this.pressedPointer = id; return true; }
  touchMove(id, x, y) { if (this.pressedPointer === id) { const b = this.hit(x, y); if (!b || b.id !== this.pressedId) { this.pressedId = null; this.pressedPointer = null; } } }
  touchEnd(id, x, y) {
    let tapped = null;
    if (this.pressedPointer === id) { const b = this.hit(x, y); if (b && b.id === this.pressedId) tapped = b; this.pressedId = null; this.pressedPointer = null; }
    return tapped;
  }
  clearTouches() { this.pressedId = null; this.pressedPointer = null; }
  bar(x, y, w, h, t, color, bg) {
    const ctx = this.ctx; roundRect(ctx, x, y, w, h, h / 2); ctx.fillStyle = bg || '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.outline; ctx.stroke();
    const iw = Math.max(0, (w - 6) * U.clamp(t, 0, 1)); if (iw > 0) { roundRect(ctx, x + 3, y + 3, iw, h - 6, (h - 6) / 2); ctx.fillStyle = color || C.pink; ctx.fill(); }
  }
  // Big bubbly title: white fill, brown outline, pastel shadow
  title(text, x, y, size, color, shadow) {
    this.label(text, x, y + size * 0.08, size, shadow || C.pinkDark, 'center', { stroke: size * 0.32 });
    this.label(text, x, y, size, color || C.white, 'center', { stroke: size * 0.22 });
  }
  dim(alpha) { const ctx = this.ctx; ctx.fillStyle = 'rgba(91,61,59,' + (alpha === undefined ? 0.45 : alpha) + ')'; ctx.fillRect(0, 0, this.W, this.H); }
}

module.exports = { UI, roundRect };
