'use strict';
// Procedural ASMR-ish audio: every sound is a PCM buffer synthesised at start-up,
// played through buffer sources + gain nodes only (the subset every WebAudio
// runtime supports, TikTok included). No audio files → nothing to download.
const U = require('./util.js');

class Audio {
  constructor(createContext) {
    this.createContext = createContext;
    this.ctx = null; this.master = null; this.unlocked = false; this.muted = false;
    this.buffers = {}; this.lastPlay = {};
  }
  unlock() {
    if (this.unlocked) { if (this.ctx && this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume(); return; }
    try {
      this.ctx = this.createContext();
      if (!this.ctx || !this.ctx.createBuffer) { this.ctx = null; return; }
      this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : 1; this.master.connect(this.ctx.destination);
      this.build();
      this.unlocked = true;
      if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume();
    } catch (e) { this.ctx = null; }
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 1; }
  suspend() { try { if (this.ctx && this.ctx.suspend) this.ctx.suspend(); } catch (e) { /* ignore */ } }
  resume() { try { if (this.ctx && this.ctx.resume) this.ctx.resume(); } catch (e) { /* ignore */ } }
  buf(seconds, fn) {
    const sr = this.ctx.sampleRate, n = Math.max(1, Math.floor(seconds * sr));
    const b = this.ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    let lp = 0, lp2 = 0;
    for (let i = 0; i < n; i++) { const t = i / sr; const v = fn(t, i, lp, lp2); lp2 = lp; lp = v; d[i] = U.clamp(v, -1, 1); }
    return b;
  }
  env(t, a, d, dur) { if (t < a) return t / a; const r = (t - a) / Math.max(0.001, dur - a); return Math.max(0, 1 - r) * (1 - d) + d * Math.max(0, 1 - r * r); }
  build() {
    const rnd = U.rng(11); const B = this.buffers; const self = this;
    const noise = function () { return rnd() * 2 - 1; };
    // crunch: 3 short bright noise bursts (chips, crisps, fruit)
    B.crunch = this.buf(0.42, function (t, i, lp) { const k = Math.floor(t / 0.14); const lt = t - k * 0.14; const g = Math.exp(-lt * 38) * (k === 0 ? 1 : 0.75); return (noise() * 0.7 + lp * 0.2) * g * 0.8; });
    B.bite = this.buf(0.3, function (t, i, lp) { const g = Math.exp(-t * 26); return (noise() * 0.5 + lp * 0.45) * g * 0.8 + Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 30) * 0.3; });
    // slurp: filtered noise sweeping up, with a wobble
    B.slurp = this.buf(0.55, function (t, i, lp, lp2) { const w = 0.35 + 0.3 * Math.sin(t * 60); const n = noise() * 0.5 + lp * w + lp2 * (0.9 - w); return n * self.env(t, 0.05, 0.3, 0.55) * 0.55 + Math.sin(2 * Math.PI * (90 + t * 160) * t) * 0.15 * self.env(t, 0.05, 0.2, 0.55); });
    // gulp: two low blips
    B.gulp = this.buf(0.36, function (t) { const k = t < 0.17 ? 0 : 1; const lt = t - k * 0.17; const f = 140 - lt * 180; return Math.sin(2 * Math.PI * f * lt) * Math.exp(-lt * 18) * 0.6; });
    // soft bite (cake): a muffled thud + tiny sparkle
    B.soft = this.buf(0.3, function (t, i, lp) { const th = Math.sin(2 * Math.PI * 95 * t) * Math.exp(-t * 22) * 0.5; const n = (lp * 0.85 + noise() * 0.15) * Math.exp(-t * 20) * 0.4; return th + n; });
    // lick (ice cream): soft breathy swoosh
    B.lick = this.buf(0.4, function (t, i, lp, lp2) { return (lp * 0.6 + lp2 * 0.3 + noise() * 0.1) * self.env(t, 0.08, 0.3, 0.4) * 0.6; });
    // fizz: hiss
    B.fizz = this.buf(0.6, function (t, i, lp) { return (noise() * 0.6 + lp * 0.3) * self.env(t, 0.05, 0.4, 0.6) * 0.25; });
    // fire whoosh (spicy)
    B.fire = this.buf(0.5, function (t, i, lp, lp2) { return (lp * 0.5 + lp2 * 0.4 + noise() * 0.1) * self.env(t, 0.04, 0.2, 0.5) * 0.9 + Math.sin(2 * Math.PI * (60 + Math.sin(t * 50) * 20) * t) * 0.2 * self.env(t, 0.02, 0.2, 0.5); });
    // shiver (cold): wobbling tone
    B.shiver = this.buf(0.45, function (t) { const f = 420 + Math.sin(t * 90) * 40; return Math.sin(2 * Math.PI * f * t) * self.env(t, 0.01, 0.3, 0.45) * 0.25; });
    // sour: quick descending squeak
    B.sour = this.buf(0.3, function (t) { const f = 900 - t * 1600; return Math.sin(2 * Math.PI * f * t) * self.env(t, 0.01, 0.2, 0.3) * 0.3; });
    // sweet: little sparkle arpeggio
    B.sweet = this.buf(0.4, function (t) { const k = Math.min(2, Math.floor(t / 0.13)); const f = [1047, 1319, 1568][k]; const lt = t - k * 0.13; return Math.sin(2 * Math.PI * f * t) * self.env(lt, 0.005, 0.3, 0.13) * 0.3; });
    // interface
    B.click = this.buf(0.07, function (t) { return Math.sin(2 * Math.PI * 900 * t) * self.env(t, 0.002, 0.1, 0.07) * 0.4; });
    B.pop = this.buf(0.12, function (t) { const f = 500 + t * 2200; return Math.sin(2 * Math.PI * f * t) * self.env(t, 0.003, 0.1, 0.12) * 0.45; });
    B.drop = this.buf(0.16, function (t) { const f = 700 - t * 2500; return Math.sin(2 * Math.PI * f * t) * self.env(t, 0.003, 0.1, 0.16) * 0.4; });
    B.coin = this.buf(0.22, function (t) { const f = t < 0.07 ? 1046 : 1568; return Math.sin(2 * Math.PI * f * t) * self.env(t, 0.004, 0.3, 0.22) * 0.45; });
    B.beep = this.buf(0.14, function (t) { return Math.sin(2 * Math.PI * 1760 * t) * self.env(t, 0.003, 0.2, 0.14) * 0.4; });
    B.error = this.buf(0.2, function (t) { return Math.sign(Math.sin(2 * Math.PI * 180 * t)) * self.env(t, 0.005, 0.1, 0.2) * 0.2; });
    B.blip = this.buf(0.08, function (t) { return Math.sin(2 * Math.PI * 1320 * t) * self.env(t, 0.003, 0.1, 0.08) * 0.2; });
    B.like = this.buf(0.1, function (t) { const f = 1200 + t * 1500; return Math.sin(2 * Math.PI * f * t) * self.env(t, 0.003, 0.1, 0.1) * 0.18; });
    B.ding = this.buf(0.6, function (t) { return (Math.sin(2 * Math.PI * 1568 * t) + 0.5 * Math.sin(2 * Math.PI * 2093 * t)) * self.env(t, 0.004, 0.4, 0.6) * 0.35; });
    B.cash = this.buf(0.5, function (t) { const k = Math.min(1, Math.floor(t / 0.12)); const lt = t - k * 0.12; return Math.sin(2 * Math.PI * (k ? 1760 : 1320) * t) * self.env(lt, 0.004, 0.3, 0.3) * 0.4; });
    const win = [523, 659, 784, 1047, 784, 1047, 1319];
    B.win = this.buf(1.3, function (t) { const k = Math.min(win.length - 1, Math.floor(t / 0.17)); const lt = t - k * 0.17; return (Math.sin(2 * Math.PI * win[k] * t) * 0.6 + Math.sin(2 * Math.PI * win[k] * 2 * t) * 0.2) * self.env(lt, 0.01, 0.4, 0.2) * 0.4; });
    const up = [659, 784, 988, 1319];
    B.levelup = this.buf(0.9, function (t) { const k = Math.min(up.length - 1, Math.floor(t / 0.2)); const lt = t - k * 0.2; return Math.sin(2 * Math.PI * up[k] * t) * self.env(lt, 0.01, 0.4, 0.25) * 0.4; });
    B.whoosh = this.buf(0.3, function (t, i, lp, lp2) { return (lp * 0.5 + lp2 * 0.4 + noise() * 0.1) * self.env(t, 0.05, 0.2, 0.3) * 0.5; });
    B.confetti = this.buf(0.3, function (t, i, lp) { return (lp * 0.2 + noise() * 0.8) * self.env(t, 0.01, 0.2, 0.3) * 0.12; });
  }
  // One-shot. `rate` pitches, `gain` scales, `minGap` throttles spam (seconds).
  play(name, opts) {
    if (!this.unlocked || !this.buffers[name]) return;
    opts = opts || {};
    const now = this.ctx.currentTime;
    const gap = opts.minGap !== undefined ? opts.minGap : 0.05;
    if (this.lastPlay[name] && now - this.lastPlay[name] < gap) return;
    this.lastPlay[name] = now;
    try {
      const src = this.ctx.createBufferSource(); src.buffer = this.buffers[name];
      src.playbackRate.value = opts.rate || 1;
      const g = this.ctx.createGain(); g.gain.value = opts.gain !== undefined ? opts.gain : 1;
      src.connect(g); g.connect(this.master); src.start(0);
    } catch (e) { /* audio is optional */ }
  }
}

module.exports = { Audio };
