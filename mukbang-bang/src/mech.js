'use strict';
// V2 stream mechanics as pure logic (no drawing, no platform): ASMR combo,
// perfect bites, spice meter, fan requests, mystery outcomes, streamer
// abilities. game.js feeds it bites and time and turns the returned events
// into effects. Fully testable headless (tools/sim-test.mjs).
const D = require('./data.js');
const K = require('./catalog.js');

const COMBO_GAP = 2.5;          // s between bites before the combo breaks
const COMBO_GAP_COLD = 3.5;     // Momo: after a cold bite
const PERFECT_R = 44;           // inner mouth radius for a perfect bite (outer eat radius is 92)
const SPICE_DECAY = 5;          // per second
const SPICE_FIRE = 60, SPICE_MAX = 100, SPICE_AFTER = 40;
const REQ_TIME = 10;            // s to answer a fan request
const REQ_BOOST = 0.08;         // × level goal, viewers added for an answered request

function comboMult(c) { return c >= 30 ? 2.5 : c >= 20 ? 2.0 : c >= 10 ? 1.5 : c >= 5 ? 1.2 : 1; }

class Mech {
  constructor(lv, streamerId, rand) {
    this.lv = lv; this.m = lv.mech || {}; this.sid = streamerId; this.rand = rand || Math.random;
    this.combo = 0; this.best = 0; this.gap = 0; this.gapMax = COMBO_GAP; this.perfects = 0; this.perfectStreak = 0;
    this.spice = 0; this.onFire = false; this.tooHot = 0;
    this.req = null; this.reqT = lv.req ? lv.req.first : -1; this.reqDone = 0; this.reqMissed = 0;
    this.mysteryHistory = [];
    this.challengeDone = false;
  }
  // restore from run_json
  load(s) { if (!s) return; this.rush = !!s.rush; this.combo = s.combo || 0; this.best = s.best || 0; this.spice = s.spice || 0; this.reqDone = s.reqDone || 0; this.perfects = s.perfects || 0; this.challengeDone = !!s.challengeDone; }
  save() { return { rush: !!this.rush, combo: this.combo, best: this.best, spice: Math.round(this.spice), reqDone: this.reqDone, perfects: this.perfects, challengeDone: this.challengeDone }; }

  // time passes; `tags` = tags still on the table (requests only ask for something you can eat)
  update(dt, tags) {
    const ev = [];
    if (this.combo > 0) { this.gap += dt; if (this.gap > this.gapMax) { if (this.combo >= 3) ev.push({ type: 'comboLost', combo: this.combo }); this.combo = 0; this.perfectStreak = 0; } }
    if (this.tooHot > 0) this.tooHot = Math.max(0, this.tooHot - dt);
    if (this.m.spice) { this.spice = Math.max(0, this.spice - SPICE_DECAY * dt); if (this.onFire && this.spice < SPICE_FIRE - 10) { this.onFire = false; ev.push({ type: 'fireOut' }); } }
    if (this.m.requests && this.lv.req) {
      if (this.req) { this.req.t -= dt; if (this.req.t <= 0) { ev.push({ type: 'reqMissed', tag: this.req.tag }); this.reqMissed++; this.req = null; this.reqT = this.lv.req.every; } }
      else if (this.reqT >= 0) { this.reqT -= dt * (this.rush ? 2.5 : 1); if (this.reqT <= 0) { const r = this.newRequest(tags); if (r) { this.req = r; ev.push({ type: 'request', tag: r.tag, text: r.text }); } else this.reqT = 3; } }
    }
    return ev;
  }
  newRequest(tags) {
    const ok = []; for (const t in K.REQUESTS) if (tags && tags.indexOf(t) >= 0) ok.push(t);
    if (!ok.length) return null;
    // avoid asking the same thing twice in a row
    let pick = ok[Math.floor(this.rand() * ok.length)]; if (ok.length > 1 && this.lastReq === pick) pick = ok[(ok.indexOf(pick) + 1) % ok.length];
    this.lastReq = pick;
    return { tag: pick, text: K.REQUESTS[pick], t: REQ_TIME, max: REQ_TIME };
  }

  // a bite of `dish`; `dist` = food centre to mouth. Returns { hypeMult, coinMult, events[] }
  bite(dish, dist, opts) {
    opts = opts || {};
    const ev = []; let hype = 1, coin = 1;
    const taste = opts.taste || dish.taste;
    const tags = dish.tags || [];
    // combo
    this.combo++; this.gap = 0; this.best = Math.max(this.best, this.combo);
    this.gapMax = (this.sid === 'momo' && (taste === 'cold' || tags.indexOf('cold') >= 0)) ? COMBO_GAP_COLD : COMBO_GAP;
    if (this.combo % 5 === 0) ev.push({ type: 'comboMilestone', combo: this.combo });
    // perfect
    const perfect = dist <= PERFECT_R;
    if (perfect) { this.perfects++; this.perfectStreak++; ev.push({ type: 'perfect', streak: this.perfectStreak }); if (this.sid === 'luna') hype *= 1.15; }
    else this.perfectStreak = 0;
    hype *= comboMult(this.combo);
    // spice
    if (this.m.spice) {
      const heat = dish.heat || (taste === 'spicy' ? 2 : 0);
      if (heat > 0 && taste === 'spicy') this.spice += 14 * heat;
      if (tags.indexOf('drink') >= 0) this.spice -= 35;
      if (taste === 'cold' || tags.indexOf('cold') >= 0) this.spice -= this.sid === 'momo' ? 30 : 20;
      if (taste === 'sour') this.spice -= 15;
      this.spice = Math.max(0, this.spice);
      if (this.spice >= SPICE_MAX) { this.spice = SPICE_AFTER; this.onFire = false; this.tooHot = 1.5; if (this.combo >= 3) ev.push({ type: 'comboLost', combo: this.combo }); this.combo = 0; this.perfectStreak = 0; ev.push({ type: 'tooHot' }); }
      else if (this.spice >= SPICE_FIRE && !this.onFire) { this.onFire = true; ev.push({ type: 'onFire' }); }
      if (this.onFire) hype *= 1.3;
    }
    // abilities
    if (this.sid === 'kiko' && (taste === 'sweet' || tags.indexOf('sweet') >= 0)) { coin *= 1.2; ev.push({ type: 'kikoHearts' }); }
    // fan request
    if (this.req && tags.indexOf(this.req.tag) >= 0) { ev.push({ type: 'reqDone', tag: this.req.tag, boost: Math.round(this.lv.goal * REQ_BOOST) }); this.reqDone++; this.req = null; this.reqT = this.lv.req.every; }
    // challenge
    if (!this.challengeDone && this.lv.challenge && this.challengeMet()) { this.challengeDone = true; ev.push({ type: 'challenge' }); }
    return { hypeMult: hype, coinMult: coin, perfect: perfect, events: ev };
  }
  challengeMet() { const c = this.lv.challenge; if (!c) return false; if (c.combo) return this.best >= c.combo; if (c.perfect) return this.perfects >= c.perfect; if (c.requests) return this.reqDone >= c.requests; return false; }
  challengeText() { const c = this.lv.challenge; if (!c) return ''; if (c.combo) return 'COMBO ' + Math.min(this.best, c.combo) + '/' + c.combo; if (c.perfect) return 'PERFECT ' + Math.min(this.perfects, c.perfect) + '/' + c.perfect; if (c.requests) return 'FAN REQUESTS ' + Math.min(this.reqDone, c.requests) + '/' + c.requests; return ''; }

  // mystery box → { kind, id }. `pool` = dish ids of the level (for "delicious").
  mystery(pool) {
    const w = K.MYSTERY.weights; let total = 0; for (let i = 0; i < w.length; i++) total += w[i][1];
    let kind = 'delicious', r = this.rand() * total;
    for (let i = 0; i < w.length; i++) { r -= w[i][1]; if (r <= 0) { kind = w[i][0]; break; } }
    // pity: never three "delicious" in a row
    const h = this.mysteryHistory; if (kind === 'delicious' && h.length >= 2 && h[h.length - 1] === 'delicious' && h[h.length - 2] === 'delicious') kind = 'rare';
    h.push(kind);
    const list = kind === 'delicious' ? pool : K.MYSTERY[kind];
    const id = list[Math.floor(this.rand() * list.length)] || pool[0];
    return { kind: kind, id: id };
  }
}

module.exports = { Mech, comboMult, PERFECT_R, COMBO_GAP, SPICE_FIRE, SPICE_MAX, REQ_TIME, REQ_BOOST };
