'use strict';
// V3 Wardrobe screen (installed onto Game.prototype): preview the current
// streamer, tabs Outfits / Hair / Extras, buy with coins, equip, themed looks,
// and an optional "free look" rewarded ad.
const U = require('./util.js');
const D = require('./data.js');
const A = require('./art.js');
const WR = require('./wardrobe.js');
const C = D.COLORS;

function install(Game) {
  const P = Game.prototype;
  P.wardrobeTap = function (id) {
    if (id.indexOf('wtab') === 0) { this.wardTab = +id.slice(4); this.audio.play('whoosh', { gain: 0.5 }); return true; }
    if (id.indexOf('witem_') === 0) { this.wardItem(id.slice(6)); return true; }
    if (id.indexOf('wlook_') === 0) { this.wardLook(id.slice(6)); return true; }
    if (id.indexOf('wstar') === 0) { const i = +id.slice(5); const s = D.STREAMERS[i]; if (s && this.streamerOpen(s)) { this.profile.set('streamer', i); this.audio.play('sweet'); } else this.audio.play('error'); return true; }
    return false;
  };
  P.streamerOpen = function (s) { return Math.max(this.curLevel(), (this.profile.get('levels_done') || 0) + 1) >= s.unlock; };
  P.wardItem = function (id) {
    const it = WR.BY_ID[id]; if (!it) return; const p = this.profile, s = WR.state(p), sid = this.streamerDef().id;
    if (WR.owns(s, id)) { WR.equip(p, sid, id); this.audio.play('pop'); this.spawnSparkles(this.W / 2, this.H * 0.28, 10); return; }
    if (it.gift) { if (this.watchUnlockLook(id)) return; this.audio.play('error'); this.showToast('A gift at stream ' + it.gift, 'Keep streaming to unlock it'); return; }
    const r = WR.buy(p, id);
    if (r === 'coins') { this.audio.play('error'); this.showToast('Need ' + U.fmtCoins(it.price) + ' coins'); return; }
    if (r === 'ok') { WR.equip(p, sid, id); this.audio.play('cash'); this.spawnConfetti(this.W / 2, this.H * 0.3, 30); this.showToast('NEW LOOK: ' + it.name.toUpperCase()); }
  };
  P.wardLook = function (lid) {
    const lk = WR.LOOKS.filter(function (l) { return l.id === lid; })[0]; if (!lk) return; const p = this.profile, s = WR.state(p), sid = this.streamerDef().id;
    for (const slot in lk.set) if (!WR.owns(s, lk.set[slot])) { this.audio.play('error'); this.showToast('Collect every piece first', WR.BY_ID[lk.set[slot]].name + ' is missing'); return; }
    for (const slot in lk.set) WR.equip(p, sid, lk.set[slot]);
    this.audio.play('levelup'); this.spawnConfetti(this.W / 2, this.H * 0.3, 40);
  };
  P.drawWardrobe = function () {
    const ui = this.ui, ctx = this.ctx, W = this.W, H = this.H, p = this.profile, top = this.top(), bottom = this.bottom();
    const sd = this.streamerDef(), s = WR.state(p), lk = WR.look(p, sd.id);
    A.homeRoom(ctx, 2, this.p.createCanvas, W, H, this.scale, this.time); ui.dim(0.12);
    ui.button('home', 16, top + 14, 48, 48, '✕', { color: C.red, dark: '#c93b55', size: 24, radius: 16 });
    this.coinsHud(top);
    ui.title('WARDROBE', W / 2, top + 96, 38, C.white, C.pinkDark);
    // preview (the face keeps animating: the overlays follow the head)
    const py = top + 250; A.streamer(ctx, sd, W / 2, py, 0.82, { expr: Math.sin(this.time * 0.8) > 0.6 ? 'chew' : 'yum', t: this.time, blink: this.face.blink, bob: Math.sin(this.time * 1.6) * 3, look: lk });
    // streamer picker
    for (let i = 0; i < D.STREAMERS.length; i++) { const st = D.STREAMERS[i], open = this.streamerOpen(st), cur = sd.id === st.id; const bx = 22, byy = top + 140 + i * 62; ui.button('wstar' + i, bx, byy, 84, 52, open ? st.name : 'LV ' + st.unlock, { color: cur ? C.pink : open ? C.lavender : '#e0d6d6', dark: cur ? C.pinkDark : open ? C.lavenderDark : '#bfb0b0', size: 14, radius: 16 }); }
    // tabs
    const tabY = py + 150; const tw = (W - 40 - 12) / 3;
    for (let i = 0; i < WR.SLOTS.length; i++) ui.button('wtab' + i, 20 + i * (tw + 6), tabY, tw, 46, WR.SLOTS[i].name, { color: (this.wardTab || 0) === i ? C.pink : C.lavender, dark: (this.wardTab || 0) === i ? C.pinkDark : C.lavenderDark, size: 16, radius: 16 });
    // items grid
    const slot = WR.SLOTS[this.wardTab || 0].id; const items = WR.ITEMS.filter(function (it) { return it.slot === slot; });
    const cols = 4, cw = (W - 40 - (cols - 1) * 8) / cols, chh = 104; let y = tabY + 56;
    for (let i = 0; i < items.length; i++) {
      const it = items[i], x = 20 + (i % cols) * (cw + 8), yy = y + Math.floor(i / cols) * (chh + 8);
      const owned = WR.owns(s, it.id), on = lk[slot] === it.id;
      ui.panel(x, yy, cw, chh, on ? '#eafff0' : owned ? '#fff' : '#f4eef0', on ? C.greenDark : C.outline, 16, on ? 5 : 2);
      this.wardIcon(it, x + cw / 2, yy + 40, sd);
      ui.label(it.name, x + cw / 2, yy + 76, 11, C.text);
      ui.label(on ? 'WEARING' : owned ? 'TAP TO WEAR' : it.gift ? (this.canUnlockLook() ? '▶ UNLOCK · LV ' + it.gift : 'GIFT · LV ' + it.gift) : '', x + cw / 2, yy + 93, 10, on ? C.greenDark : owned ? C.textLight : C.pinkDark);
      if (!owned && it.price) { A.coin(ctx, x + cw / 2 - 18, yy + 93, 7); ui.label(U.fmtCoins(it.price), x + cw / 2 + 4, yy + 94, 12, C.text, 'left'); }
      ui.hotspot('witem_' + it.id, x, yy, cw, chh);
    }
    y += Math.ceil(items.length / cols) * (chh + 8) + 6;
    // themed looks
    ui.label('THEMED LOOKS', W / 2, y + 8, 13, C.white, 'center', { stroke: 4 }); y += 20;
    const lw = (W - 40 - 12) / 3;
    for (let i = 0; i < WR.LOOKS.length; i++) { const l = WR.LOOKS[i]; let all = true; for (const k in l.set) if (!WR.owns(s, l.set[k])) all = false; ui.button('wlook_' + l.id, 20 + i * (lw + 6), y, lw, 44, l.name, { color: all ? C.yellow : '#e0d6d6', dark: all ? C.yellowDark : '#bfb0b0', size: 13, radius: 14 }); }
    y += 54;
    if (this.canFashion() && y + 52 < bottom) ui.button('fashion_ad', 40, Math.min(y, bottom - 60), W - 80, 52, '▶  WATCH AD: FREE NEW LOOK', { color: C.blue, dark: C.blueDark, size: 17 });
  };
  // small preview of an item
  P.wardIcon = function (it, x, y, sd) {
    const ctx = this.ctx;
    if (it.slot === 'outfit') { const col = it.color || (it.overlay === 'apron' ? '#ffffff' : it.overlay === 'bib' ? '#fff3f7' : it.overlay === 'overalls' ? '#cdb0ff' : sd.top); A.rr(ctx, x - 26, y - 20, 52, 44, 14); ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.outline; ctx.stroke(); if (it.overlay === 'overalls') A.star(ctx, x, y + 6, 8, C.gold, 2); if (it.overlay === 'bib') A.text(ctx, 'YUM', x, y + 2, 10, C.pinkDark, 0); if (it.overlay === 'apron') A.rr(ctx, x - 8, y + 2, 16, 10, 3); return; }
    if (it.id === 'hair_none' || it.id === 'acc_none') { ctx.strokeStyle = '#cfc2c2'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.moveTo(x - 11, y + 11); ctx.lineTo(x + 11, y - 11); ctx.stroke(); return; }
    // draw the accessory on a little face
    A.circle(ctx, x, y + 8, 22, sd.skin || '#ffe6d6', 3);
    const look = { outfit: 'outfit_default', hair: it.slot === 'hair' ? it.id : 'hair_none', acc: it.slot === 'acc' ? it.id : 'acc_none' };
    WR.drawHead(ctx, A, look, { cx: x, cy: y + 8, r: 22, ey: y + 6, ny: y + 28 }, sd, this.time);
  };
}

module.exports = { install };
