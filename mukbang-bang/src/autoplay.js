'use strict';
// Test-build autoplay (Settings → AUTO PLAY, web / artifact only): plays the main levels on
// its own at a normal human pace, through the same touch handlers a player uses. It cooks
// what the viewer asked for, eats every portion, closes tips and moves on to the next level.
// It never taps an ad button.
const CK = require('./cook.js');

const PACE = 0.75; // seconds between two "taps"

function install(Game) {
  const P = Game.prototype;
  P.has = function (id) { const b = this.ui.buttons; for (let i = 0; i < b.length; i++) if (b[i].id === id) return true; return false; };
  P.autoTick = function (dt) {
    if (!this.autoplay || this.adBusy) return;
    const a = this.auto || (this.auto = { wait: 1, hold: null });
    // a press in progress (pour / hold / shake) is released by its own timer
    if (a.hold) { a.hold.t -= dt; const k = this.ck;
      if (a.hold.rub && k) { const ar = this.cookArea(); const ang = this.time * 14; this.cookTouch('move', 'auto', ar.x + Math.cos(ang) * 70, ar.y + Math.sin(ang) * 40); }
      if (a.hold.t <= 0 || !this.ck || this.state !== 'cook' || (this.ck && this.curCookStep() !== a.hold.st)) { if (this.ck) this.cookTouch('end', 'auto', 0, 0); a.hold = null; a.wait = PACE; }
      return; }
    a.wait -= dt; if (a.wait > 0) return; a.wait = PACE * (0.8 + Math.random() * 0.5);
    const tapBtn = (id) => { if (this.has(id)) { this.tap(id); return true; } return false; };
    // tips and popups first
    if (tapBtn('gtip_ok') || tapBtn('mtip_ok') || tapBtn('gift_no') || tapBtn('feat_ok') || tapBtn('feat_later')) return;
    const s = this.state, r = this.run;
    if (s === 'home') { tapBtn('play'); return; }
    if (s === 'result') { if (!tapBtn('next')) tapBtn('res_main'); return; }
    if (s === 'pause') { tapBtn('resume'); return; }
    if (s === 'cook') {
      const k = this.ck; if (!k) return;
      if (k.serveAsk) { tapBtn('ck_serve'); return; }
      if (k.doneT >= 0) return;
      const st = this.curCookStep(); if (!st) return; const ar = this.cookArea();
      if (st.t === 'pick') {
        const want = k.req[CK.SLOT_KEY[st.slot]]; const o = (want && k.opts.find(function (x) { return x.id === want; })) || k.opts[Math.floor(Math.random() * k.opts.length)];
        if (k.sel !== o.id) this.cookTap('cko_' + o.id); else this.cookTap('ck_ok'); return; }
      if (st.t === 'pour' || st.t === 'hold') { this.cookTouch('start', 'auto', ar.x, ar.y); a.hold = { t: 6, st: st }; return; }
      if (st.t === 'shake') { this.cookTouch('start', 'auto', ar.x, ar.y); a.hold = { t: 6, st: st, rub: true }; return; }
      if (st.t === 'place' || st.t === 'flip') { this.cookTouch('start', 'auto', ar.x + (Math.random() - 0.5) * 60, ar.y - 20); this.cookTouch('end', 'auto', ar.x, ar.y); a.wait = PACE * 0.6; return; }
      return;
    }
    if (s === 'stream' && r) {
      if (r.phase === 'request') { tapBtn('cook_go'); return; }
      const fp = r.recipe ? this.platePos(Math.min(2, r.pickups || 0)) : this.packPos();
      if (r.phase === 'sealed' || r.phase === 'open') { this.streamTouch('start', 'auto', fp.x, fp.y); this.streamTouch('end', 'auto', fp.x, fp.y); return; }
      // between bites: now and then catch a floating heart like a player would
      if (this.hearts && this.hearts.length && Math.random() < 0.5) { const h = this.hearts.find(function (q) { return !q.taken; }); if (h) { this.streamTouch('start', 'auto', h.x, h.y); this.streamTouch('end', 'auto', h.x, h.y); } }
    }
  };
}

module.exports = { install };
