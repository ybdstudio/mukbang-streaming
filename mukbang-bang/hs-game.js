/*! hs-game.js 3.4.0 — the HS TikTok SDK for native TikTok mini games.
 *
 * Put this file and hs-sdk.min.js next to your game.js, then:
 *
 *   var HSGame = require('./hs-game.js');
 *   HSGame.start({
 *     gameId: '...', sdkKey: 'sk_live_...',
 *     defaults: { rewards: {...}, items: {...} },     // the game's own reward table
 *     onGive: function (items, from) { ... },         // THE place anything is given
 *     onLoad: function (cloud) { ... }                // cloud save from another phone
 *   });
 *
 *   HSGame.claim('mission_a')        // a game moment completed → its reward goes to onGive
 *   HSGame.showAd('revive')          // ad at a place → reward (if any) goes to onGive
 *   HSGame.share({ title })          // share → the "share" reward goes to onGive
 *   HSGame.save(progress)            // cloud save
 *   HSGame.shop() / HSGame.buy(id)   // purchases → onGive
 *   HSGame.restore()                 // "Restore purchases" (shown when has('restore'))
 *   HSGame.has('share')              // show a button only where it works (see has())
 *   HSGame.on('pause' | 'resume')    // mute + freeze while an ad / purchase / the app is away
 *
 * HS Analytics (3.4, start({ analytics: true })): sessions, ads, purchases and
 * the device profile are sent by the kit; the game adds
 *   HSGame.level.start(n) / HSGame.level.end(n, 'win' | 'lose' | 'quit', {…})
 *   HSGame.economy.earn / spend(currency, amount, {…}) · HSGame.powerUp(name, {…})
 *   HSGame.ui(action, name) · HSGame.track(registeredName, {…})
 *
 * One game, three platforms: TikTok Minis, and the HS app for Android and iOS
 * (the same files in a WebView, packed by HS). The game never checks the platform —
 * HSGame.has() says what is on, and the ad provider is HS's choice.
 *
 * Data-driven: a reward key, an ad place, an item, a product — if it is in the
 * HS dashboard (or the game's defaults), it works; if not, nothing happens.
 *
 * Rules this file enforces so a game cannot get them wrong:
 *   - It never throws, and runs without the SDK or credentials (rewards then
 *     come from the defaults; ads, shop and cloud are simply off).
 *   - Rewards reach the game ONLY through onGive. If onGive throws, nothing is
 *     recorded: a claim can be made again, a paid order comes back next login.
 *   - An ad reward only for a completed ad; a share reward only for a share.
 *   - A fresh install never overwrites the cloud.
 *
 * Needs hs-sdk.min.js 1.1.1 or newer (the Android app needs it — device
 * accounts and Google Play purchases; TikTok works with 1.0.7+, also under its
 * old name hs-tiktok-sdk.min.js). With 1.1.2 a change not yet in the cloud
 * survives an app killed before the sync, and paid orders are confirmed only
 * once their save is in the cloud; an older SDK works as before 3.2.3.
 */
(function (root) {
  'use strict';

  var VERSION = '3.4.0';
  // The SDK waits for the ad's own answer; past this the ad counts as failed,
  // so a host that never answers cannot latch or freeze the game. Android:
  // longer than the app's own ad watchdog (120 s), so there the app answers
  // first. TikTok: the SDK gives up on an ad that does not load in 8 s, so
  // this only ever waits for an ad on screen that sends no close (60 s; a
  // late close still pays the reward).
  var AD_STALE_MS_ANDROID = 130000;
  var AD_STALE_MS_TIKTOK = 60000;
  function adStaleMs() { return platformName() === 'android' ? AD_STALE_MS_ANDROID : AD_STALE_MS_TIKTOK; }
  var AD_TAP_MS = 8000; // an ad not under way this long after the tap is dropped (the SDK's load cap too)
  var BUY_PAUSE_MAX_MS = 120000; // the game unfreezes behind a pay sheet that stays open longer
  var TIKTOK_KEYS = { tiktok_shortcut: 'shortcut', tiktok_profile: 'profile' };
  var BUILTIN_LIMIT = { share: 'daily', tiktok_shortcut: 'once', tiktok_profile: 'once' };

  var sdk = null;
  var loadError = '';
  if (typeof require === 'function') {
    try {
      sdk = require('./hs-sdk.min.js');
    } catch (e) {
      // A game folder from before 1.1 has the SDK under its old name.
      try { sdk = require('./hs-tiktok-sdk.min.js'); } catch (e2) { loadError = 'hs-sdk.min.js not found next to hs-game.js'; }
    }
  }
  if (!sdk && root && root.HSTikTokSDK) sdk = root.HSTikTokSDK;

  var started = false;
  var ready = false;             // the SDK initialised (credentials set)
  var loginDone = false;         // the startup login finished, either way
  var giveCb = null;
  var loadCb = null;
  var defaults = { rewards: {}, items: {} };
  var cloudSettled = false;
  var cloudData = null;
  var loadDelivered = false;
  var latest;
  var hasLatest = false;
  var adBusySince = 0;
  var trace = [];

  var has = function (o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); };
  var log = function (msg) { try { if (HSGame.debug) console.log('[HSGame] ' + msg); } catch (e) {} };
  var note = function (what) { if (trace.length < 500) trace.push(what); };
  var noteOnce = function (what) { if (trace.indexOf(what) < 0) note(what); };
  var safe = function (fn, fallback) { try { return fn(); } catch (e) { log('error: ' + (e && e.message)); return fallback; } };
  var copy = function (v) { return safe(function () { return JSON.parse(JSON.stringify(v)); }, v); };

  // Device storage: TikTok storage in a mini game, localStorage in a browser
  // or the Android app's WebView. Strings in, strings out, never throws.
  var mem = {};
  function storeGet(key) {
    var t = root && root.tt;
    if (t && typeof t.getStorageSync === 'function') {
      var v = safe(function () { return t.getStorageSync(key); }, '');
      if (v !== '' && v !== null && v !== undefined) return typeof v === 'string' ? v : JSON.stringify(v);
      return has(mem, key) ? mem[key] : null;
    }
    var ls = safe(function () { return root && root.localStorage; }, null);
    var w = ls ? safe(function () { return ls.getItem(key); }, null) : null;
    return w !== null && w !== undefined ? w : (has(mem, key) ? mem[key] : null);
  }
  function storeSet(key, value) {
    mem[key] = value;
    var t = root && root.tt;
    if (t && typeof t.setStorageSync === 'function') { safe(function () { t.setStorageSync(key, value); }); return; }
    var ls = safe(function () { return root && root.localStorage; }, null);
    if (ls) safe(function () { ls.setItem(key, value); });
  }

  // Kit-level events: 'otherDevice', 'given', 'pause', 'resume'.
  var kitListeners = {};
  function kitEmit(name, a, b) {
    var list = (kitListeners[name] || []).slice();
    for (var i = 0; i < list.length; i++) safe(function () { list[i](a, b); });
  }

  // ─── Platform: TikTok Minis, or the HS Android app ───────────────────────
  // The Android app runs these same files in a WebView with a web `tt` shim
  // and injects HSNative (its bridge). It is checked first: the shim has a
  // tt.request too.

  function nativeBridge() {
    var n = root && root.HSNative;
    return n && typeof n === 'object' && n.platform === 'android' ? n : null;
  }

  function platformName() {
    if (nativeBridge()) return 'android';
    var t = root && root.tt;
    if ((t && typeof t.request === 'function') || (root && root.TTMinis && root.TTMinis.game)) return 'minis';
    return 'browser';
  }

  /** The runtime can do it (login, pay…). An SDK too old to say is a TikTok one. */
  function canDo(cap) {
    if (!sdk || !ready) return false;
    var c = safe(function () { return sdk.capabilities; }, null);
    return c && typeof c === 'object' && has(c, cap) ? !!c[cap] : platformName() === 'minis';
  }

  /** A login can work here: the runtime has one, or the SDK runs in test mode (a desktop browser). */
  function loginPossible() {
    return canDo('login') || !!(sdk && ready && safe(function () { return sdk.isTestMode; }, false));
  }

  /** Logged in as an Android device account (dv_…): an account, but still a guest at heart. */
  function onDeviceAccount() {
    return String((sdk && ready && safe(function () { return sdk.openId; }, '')) || '').indexOf('dv_') === 0;
  }

  /** The dashboard switched a feature off: iaa_config "features": { "share": false }. */
  function featureOff(name) {
    var f = remote('features');
    return !!(f && f[name] === false);
  }

  // 'pause' / 'resume': ONE pair however many reasons overlap — an ad that
  // also hides the app pauses once and resumes when both are over.
  var pauseReasons = {};
  function pauseFor(reason) {
    var was = isEmpty(pauseReasons);
    pauseReasons[reason] = true;
    if (was) kitEmit('pause', reason);
  }
  function resumeFrom(reason) {
    if (!has(pauseReasons, reason)) return;
    delete pauseReasons[reason];
    if (!isEmpty(pauseReasons)) return;
    kitEmit('resume', reason);
    safe(evPerfRun);   // analytics: the FPS sample paused with the game
  }

  // ─── The reward table: dashboard (iaa_config) over the game's defaults ────

  function remote(section) {
    var cfg = sdk && ready ? safe(function () { return sdk.ads.config; }, null) : null;
    var s = cfg && cfg[section];
    return s && typeof s === 'object' ? s : null;
  }

  /**
   * { items: { hint: 2 }, limit } for a key, or null when it gives nothing.
   * The dashboard wins per key — including `"key": null`, which switches a
   * default reward off. Accepts the old list form [{ type, amount }] too.
   */
  function entry(key) {
    var r = remote('rewards');
    var d = has(defaults.rewards, key) ? defaults.rewards[key] : undefined;
    var raw = has(r, key) ? r[key] : d;
    if (raw === undefined || raw === null || typeof raw !== 'object') return null;
    // The limit is part of what the moment IS: a dashboard entry that only
    // changes the amount keeps the game's own limit — a "once" never becomes
    // "every time" because someone retyped the number.
    var limit = limitOf(raw);
    if (!limit) limit = limitOf(d);
    if (!limit) limit = BUILTIN_LIMIT[key] || 'always';
    return { items: toItems(raw), limit: limit };
  }

  function limitOf(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return '';
    var l = raw.$limit !== undefined ? raw.$limit : raw.limit;   // `limit` = the 2.x shape
    return l === 'once' || l === 'daily' || l === 'always' ? l : '';
  }

  /**
   * { hint: 2, coins: 50 } from any form: that map itself (keys starting with
   * "$" are settings, not items; true counts as 1), the older list
   * [{ type, amount, value }] products may still carry, or the 2.x shape
   * { rewards: [...], limit }. Zero and negative amounts are dropped.
   */
  function toItems(raw) {
    var items = {};
    if (raw && !Array.isArray(raw) && typeof raw === 'object' && Array.isArray(raw.rewards)) raw = raw.rewards;
    if (Array.isArray(raw)) {
      for (var i = 0; i < raw.length; i++) {
        var x = raw[i];
        var n0 = x ? (Number(x.amount) || (x.value === true ? 1 : 0)) : 0;
        if (x && typeof x.type === 'string' && x.type && n0 > 0) items[x.type] = (items[x.type] || 0) + n0;
      }
    } else if (raw && typeof raw === 'object') {
      for (var k in raw) {
        if (!has(raw, k) || k.charAt(0) === '$') continue;
        var n = raw[k] === true ? 1 : Number(raw[k]);
        if (n > 0) items[k] = n;
      }
    }
    return items;
  }

  function isEmpty(o) { for (var k in o) if (has(o, k)) return false; return true; }

  function catalog() {
    var out = {};
    var d = defaults.items || {};
    var r = remote('items') || {};
    for (var a in d) if (has(d, a)) out[a] = d[a];
    for (var b in r) if (has(r, b)) { if (r[b] === null) delete out[b]; else out[b] = r[b]; }
    return out;
  }

  /**
   * Hands items to the game. True when it took them.
   *
   * With a profile, an item that is a number field of the profile (hint,
   * coins…) is credited to it — no game code. Anything else (a skin unlock…)
   * is "special" and goes to onGive FIRST; the profile is credited only if
   * onGive did not throw, so a retry can never credit the plain part twice.
   */
  function give(items, from) {
    note('give:' + from);
    var special = items;
    var credit = {};
    if (P) {
      special = {};
      for (var id in items) {
        if (!has(items, id)) continue;
        if (typeof P.defs[id] === 'number') credit[id] = items[id];
        else special[id] = items[id];
      }
    }
    if (!isEmpty(special)) {
      if (!giveCb) { log('nothing given for "' + from + '" — ' + Object.keys(special).join(', ') + ' needs onGive (or a number field in the profile)'); return false; }
      var cat = catalog();
      for (var s in special) if (has(special, s) && !isEmpty(cat) && !has(cat, s)) log('item "' + s + '" (from ' + from + ') is not in the items catalog');
      try { giveCb(copy(special), from); }
      catch (e) { log('onGive threw for "' + from + '": ' + (e && e.message) + ' — not recorded'); return false; }
    }
    if (!isEmpty(credit)) {
      var ch = {};
      for (var c in credit) if (has(credit, c)) ch[c] = (Number(P.data[c]) || 0) + (Number(credit[c]) || 0);
      applyChanges(ch, 'reward');
      // On the device at once, not on the 400 ms timer: a claim is recorded
      // right after this, and an app killed in between kept the claim but
      // lost what it paid.
      writeProfileNow();
    }
    // Anything given goes up within a second, not at the 10 s sync tick.
    syncSoon();
    kitEmit('given', copy(items), from);
    return true;
  }

  // ─── Claims: once / daily / always ────────────────────────────────────────
  // In TikTok storage, and inside the cloud save (`_hs`) when the game uses
  // save(), so a reinstall or a new phone does not pay again. `daily` follows
  // the phone's date — never use it for paid value.

  var CLAIMS_KEY = 'hsgame.claims';
  var memClaims = {};

  /** Claims belong to the account that made them (a cloud profile's owner); otherwise to the device. */
  function claimsKey() {
    return CLAIMS_KEY + (P && P.mode === 'cloud' && P.owner ? '.' + P.owner : '');
  }

  function today() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  function loadClaims() {
    var raw = storeGet(claimsKey());
    if (!raw) return memClaims;
    var parsed = safe(function () { return JSON.parse(raw); }, null);
    return parsed && typeof parsed === 'object' ? parsed : memClaims;
  }

  function storeClaims(c) {
    memClaims = c;
    storeSet(claimsKey(), JSON.stringify(c));
    if (cloudSettled && cloudWanted()) cloud.isDirtyForCloud = true;
    markSaveDirty();
  }

  // Claims are merged as a union, also when a newer cloud copy wins over a
  // copy this phone never sent: a "once" claimed there stays claimed. Rolling
  // it back could pay a reinstall twice; the window is the second before the
  // prompt upload, and only when another phone wrote the cloud meanwhile.
  function mergeClaims(other) {
    if (!other || typeof other !== 'object') return;
    var c = loadClaims();
    for (var k in other) {
      if (!has(other, k) || !other[k]) continue;
      var mine = c[k], theirs = other[k];
      if (!mine) { c[k] = theirs; continue; }
      c[k] = { n: Math.max(mine.n || 0, theirs.n || 0), last: (mine.last || '') > (theirs.last || '') ? mine.last : theirs.last };
    }
    storeClaims(c);
  }

  function isClaimed(key, limit) {
    var e = loadClaims()[key];
    if (!e || limit === 'always') return false;
    return limit === 'daily' ? e.last === today() : true;
  }

  function recordClaim(key) {
    var c = loadClaims();
    var e = c[key] || { n: 0, last: '' };
    c[key] = { n: (e.n || 0) + 1, last: today() };
    storeClaims(c);
    syncSoon();
  }

  /** The common path: the key's reward, if any and if its limit allows, given and recorded. */
  function payout(key, from) {
    var e = entry(key);
    if (!e || isEmpty(e.items) || isClaimed(key, e.limit)) return null;
    if (!give(e.items, from || key)) return null;
    recordClaim(key);
    return copy(e.items);
  }

  // ─── Profile (3.1): the game's progress, owned by the kit ─────────────────
  //
  // One object. The game changes it only through set / add / update; every
  // change fires events (for the UI), is written to the device, and — in
  // save:'cloud' — synced. On a new phone, a reinstall or a takeover the cloud
  // copy is merged field by field: 'max' / 'min' for values that only move one
  // way (level, best score), 'latest' (default) for everything else, by
  // server-corrected change time. No 'sum': it doubles on every new phone.
  // Consumables must not use 'max' — it would bring spent items back.

  var PROFILE_KEY = 'hsgame.profile';
  var ORDERS_KEEP = 200;
  var clockOffset = 0;       // server time - device time, ms, learned from cloud syncs (and a login, forward only)
  var P = null;              // the profile state, once HSGame.profile() ran
  var takingOver = false;
  var acceptNextCloud = false;   // a different account logged in: merge its cloud copy too

  function nowMs() { return Date.now() + clockOffset; }
  function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

  function profileKey(owner) { return PROFILE_KEY + (owner ? '.' + owner : ''); }

  function readEnvelope(owner) {
    var raw = storeGet(profileKey(owner));
    var env = raw ? safe(function () { return JSON.parse(raw); }, null) : null;
    if (env && typeof env === 'object' && env.data && typeof env.data === 'object') return env;
    // Unreadable (a write cut short) → the backup taken at the last good start.
    var bak = storeGet(profileKey(owner) + '.bak');
    env = bak ? safe(function () { return JSON.parse(bak); }, null) : null;
    if (env && env.data) log('profile: main copy unreadable — restored the backup');
    return env && typeof env === 'object' && env.data && typeof env.data === 'object' ? env : null;
  }

  /** Loads (or creates) the profile of `owner` into P, filling missing fields from the defaults. */
  function loadProfile(owner) {
    var env = readEnvelope(owner);
    P.owner = owner || '';
    P.fresh = !env;
    P.data = copy(P.defs);
    P.t = {};
    P.orders = [];
    if (env) {
      var stored = env.data;
      var from = env.v | 0;
      if (from < P.version && P.migrate) {
        var up = safe(function () { return P.migrate(copy(stored), from); }, null);
        if (up && typeof up === 'object') stored = up;
      }
      for (var k in stored) if (has(stored, k)) P.data[k] = stored[k];
      P.t = env.t && typeof env.t === 'object' ? env.t : {};
      P.orders = Array.isArray(env.o) ? env.o : [];
      // One backup per start, of a copy that just parsed — cheap insurance.
      storeSet(profileKey(owner) + '.bak', JSON.stringify(env));
    }
    if (P.mode === 'cloud' && owner) storeSet(PROFILE_KEY + '.last', owner);
  }

  function writeProfileNow() {
    if (!P) return;
    if (P.timer) { clearTimeout(P.timer); P.timer = null; }
    storeSet(profileKey(P.owner), JSON.stringify({ v: P.version, data: P.data, t: P.t, o: P.orders, owner: P.owner }));
  }

  function scheduleWrite() {
    if (!P || P.timer) return;
    P.timer = setTimeout(function () { P.timer = null; writeProfileNow(); }, 400);
  }

  /** Applies { field: value } and fires events. source: 'game' | 'reward' | 'cloud'. */
  function applyChanges(changes, source, cloudTimes) {
    var fired = {};
    var any = false;
    for (var f in changes) {
      if (!has(changes, f)) continue;
      var before = P.data[f];
      var now = changes[f];
      if (same(before, now)) continue;
      P.data[f] = copy(now);
      P.t[f] = source === 'cloud' ? ((cloudTimes && cloudTimes[f]) || 0) : nowMs();
      fired[f] = [copy(now), copy(before)];
      any = true;
    }
    if (!any) return;
    scheduleWrite();
    if (source !== 'cloud' && cloudSettled && cloudWanted()) cloud.isDirtyForCloud = true;
    fire(fired, source);
  }

  /** Calls the listeners for { field: [now, before] }. Data is already in place. */
  function fire(fired, source) {
    for (var g in fired) {
      if (!has(fired, g)) continue;
      var list = (P.listeners[g] || []).slice();
      for (var i = 0; i < list.length; i++) (function (cb, pair) { safe(function () { cb(pair[0], pair[1]); }); })(list[i], fired[g]);
    }
    var all = (P.listeners['*'] || []).slice();
    for (var j = 0; j < all.length; j++) (function (cb) { safe(function () { cb(copy(fired), source); }); })(all[j]);
  }

  function syncedFields(obj) {
    var out = {};
    for (var k in obj) if (has(obj, k) && !has(P.local, k)) out[k] = obj[k];
    return out;
  }

  /**
   * Merges a cloud copy into the profile, field by field. `stale`: another
   * phone wrote the cloud since this one last saw it — its 'latest' values
   * win, as on a new phone (this phone's unsent changes lose, like 3.0's).
   */
  function mergeIntoProfile(cloudObj, hs, stale, newerCloud) {
    var ct = (hs && hs.t) || {};
    var changes = {};
    var deviceNewer = false;
    for (var f in cloudObj) {
      if (!has(cloudObj, f) || has(P.local, f)) continue;
      var rule = P.rules[f] || 'latest';
      var lv = P.data[f], cv = cloudObj[f], pick;
      var bothNumbers = typeof lv === 'number' && typeof cv === 'number';
      if (rule === 'max' && bothNumbers) {
        // Always the higher — also for a value this device never changed
        // itself (an old save, a migrate()): a default is below any record.
        pick = Math.max(lv, cv);
      } else if (!has(P.t, f)) {
        // Never changed on this device: it still holds the default, which is
        // not a value to compare (a 'min' default of 0 would beat any record).
        pick = cv;
      } else if (rule === 'min' && bothNumbers) {
        pick = Math.min(lv, cv);
      } else if (P.fresh || stale) {
        pick = cv;                      // a new phone / reinstall / a newer cloud: the cloud is the truth
      } else {
        pick = (ct[f] || 0) >= (P.t[f] || 0) ? cv : lv;
      }
      if (!same(pick, cv)) deviceNewer = true;
      if (!same(pick, lv)) changes[f] = pick;
    }
    // Fields this device has that the cloud copy lacks go up with the next sync.
    for (var g in P.data) if (has(P.data, g) && !has(P.local, g) && !has(cloudObj, g)) deviceNewer = true;
    // The cloud's values won: an order this phone credited that the cloud copy
    // does not list is no longer in the profile. It leaves the list, so the
    // backend's next offer credits it again (it was never confirmed: held
    // until an upload holds it) — the rule 3.0 follows too: twice, never lost.
    if (P.fresh || stale || newerCloud) dropOrdersNotIn(hs);
    addOrders(hs);
    applyChanges(changes, 'cloud', ct);
    P.fresh = false;
    writeProfileNow();
    if (deviceNewer) cloud.isDirtyForCloud = true;
  }

  /**
   * The game uses cloud saving: a profile in 'cloud' mode, or the 3.0 save() —
   * also before its first save(): a game with onLoad wants the cloud copy, so
   * a Google purchase recovered at start waits for it (else the copy arriving
   * after the credit would overwrite it).
   */
  function cloudWanted() { return P ? P.mode === 'cloud' : (hasLatest || !!loadCb); }

  // ─── Prompt upload ────────────────────────────────────────────────────────
  // The SDK's own sync runs every 10 s; anything of value (a reward, a claim,
  // a purchase) goes up within about a second instead, so an app killed soon
  // after has it in the cloud. Skipped or failed (the SDK's 3 s cooldown, a
  // sync already running): tried again a few times, then the tick takes over.

  var SYNC_SOON_MS = 1000;
  var syncTimer = null;
  var syncTries = 0;

  /** Upload within a second. A new call restarts the retry count (a new change deserves its tries). */
  var syncTimerRetry = false;

  function syncSoon(retry) {
    if (!retry) syncTries = 0;
    // A new change while only a 3 s retry waits: back to the 1 s timer.
    if (syncTimer && !retry && syncTimerRetry) { clearTimeout(syncTimer); syncTimer = null; }
    if (syncTimer || !sdk || !ready) return;
    syncTimerRetry = !!retry;
    syncTimer = setTimeout(function () {
      syncTimer = null;
      if (!cloudSettled || !cloud.isDirtyForCloud || !safe(function () { return sdk.isAuthenticated; }, false)) return;
      Promise.resolve(safe(function () { return sdk.sync.syncNow(); }, false)).then(function (ok) {
        if (!ok && cloud.isDirtyForCloud && syncTries < 3) { syncTries++; syncSoon(true); }
      }, function () {});
    }, retry ? 3000 : SYNC_SOON_MS);
  }

  // ─── 3.0 save(): this phone's copy, until it is in the cloud ──────────────
  // Without it, an app killed before the sync lost the change: at the next
  // login the older cloud copy went to onLoad. Per account, the kit keeps
  // { data, dirty, ts, o, gp } — the last save(), "not in the cloud yet", the
  // server time of the last login / sync, TikTok orders whose save() came, and
  // Google purchases credited since the last upload. At login the SDK says
  // whether another phone wrote the cloud since this one last saw it (a hash
  // of the copy, not a clock). Unchanged → this phone's copy is kept, handed
  // to onLoad and uploaded. Changed → the cloud copy wins, as before: a stale
  // phone never overwrites newer progress from another phone (its unsent
  // change is lost — the strict choice). Offline, the copy belongs to the
  // account that played here last (like profile.last), so offline progress
  // is kept too.

  var SAVE_KEY = 'hsgame.save';
  var decided = false;      // this session knows whose copy it is, and chose between it and the cloud's
  var saveOwner = '';       // that account: the logged-in one, or offline the last one
  var baseTs = 0;           // server time of the last login / sync (for the record; the choice uses the SDK's hash)
  var orders0 = [];         // 3.0: TikTok order ids in the save (travel as _hs.orders)
  var ordersNew = [];       // 3.0: credited, but the game has not called save() since
  var gpNew = [];           // 3.0: Google purchases credited since the last upload
  var cloudOrders = {};     // order ids the cloud copy holds (read at login, or just uploaded)

  function readSave() {
    var raw = saveOwner ? storeGet(SAVE_KEY + '.' + saveOwner) : null;
    var env = raw ? safe(function () { return JSON.parse(raw); }, null) : null;
    return env && typeof env === 'object' ? env : null;
  }

  function writeSave(dirty) {
    if (P || !decided || !saveOwner) return;
    // Orders credited but in no save() yet are NOT stored: after a restart the
    // game gets the last save(), which lacks them, so they are credited again
    // (twice at worst, never lost). RULE: a 3.0 game calls save() in onGive.
    storeSet(SAVE_KEY + '.' + saveOwner, JSON.stringify({ data: hasLatest ? latest : null, dirty: !!dirty, ts: baseTs, o: orders0, gp: gpNew }));
  }

  /**
   * A change that is not in the cloud yet. Only once the session knows whose
   * copy it is (before that, a save() is the fresh-install state, never kept).
   */
  function markSaveDirty() { if (!P && decided) writeSave(true); }

  // ordersNew counts here only in memory: an order offered twice in ONE session
  // (a buy's poll and a resume's recovery) is credited once.
  function knownOrder0(id) { return orders0.indexOf(String(id)) >= 0 || ordersNew.indexOf(String(id)) >= 0; }

  /**
   * This phone's copy is the session's save: its data (also over a save()
   * made at boot — that may be defaults), its orders, its Google credits —
   * and it goes to onLoad, so a game that keeps no storage of its own gets
   * it back. `extraOrders`: order ids the cloud copy also lists.
   */
  function useSaved(env, extraOrders) {
    if (env.data && typeof env.data === 'object') { latest = copy(env.data); hasLatest = true; cloudData = copy(env.data); }
    var o = (Array.isArray(env.o) ? env.o : []).concat(extraOrders || []);
    orders0 = [];
    for (var i = 0; i < o.length; i++) if (orders0.indexOf(String(o[i])) < 0) orders0.push(String(o[i]));
    ordersNew = [];
    gpNew = Array.isArray(env.gp) ? env.gp.slice() : [];
  }

  /** Logged in, no (readable) cloud copy: this phone's own copy, if any, is the account's. */
  function decideWithoutCloud() {
    var env = readSave();
    decided = true;
    if (env && env.data) { useSaved(env); loadDelivered = false; deliverLoad(); }
    if (env && env.dirty) { cloudDirty = true; syncSoon(); }
  }

  /** The startup login failed: the session's copy is the last account's own (H3). */
  function decideOffline() {
    if (P || decided) return;
    saveOwner = storeGet(SAVE_KEY + '.last') || '';
    // Nobody ever logged in here: a fresh install. Its offline play is the
    // fresh-install state the kit never sets against an account's cloud copy;
    // the game's onLoad merges that copy with its own storage at the first
    // login (as before 3.2.3) — the kit does not know which account it is.
    if (!saveOwner) return;
    var env = readSave();
    decided = true;
    if (env && env.data) { useSaved(env); deliverLoad(); }
  }

  /**
   * The cloud copy won over a copy this phone never sent: what was credited
   * into that copy is gone with it. TikTok orders: never confirmed (held by
   * the SDK until an upload holds them), so the backend offers them again and
   * they are credited into the cloud copy. Google: the keys leave the device
   * list, so a permanent item Google still returns is credited again; a
   * consumable was already finished at Google and is lost — only when another
   * phone wrote the cloud in the second before the upload. A game whose
   * onLoad keeps its own value over the cloud's (a "keep the higher" merge)
   * then has such an order twice: the SDK's rule, twice rather than lost.
   */
  function dropUnsent(env, hs) {
    var inCloud = hs && Array.isArray(hs.gp) ? hs.gp : [];
    var drop = (Array.isArray(env.gp) ? env.gp : []).filter(function (k) { return inCloud.indexOf(k) < 0; });
    if (drop.length) storeSet(GP_CREDITED, JSON.stringify(readList(GP_CREDITED).filter(function (k) { return drop.indexOf(k) < 0; })));
  }

  // ─── Cloud provider (the SDK's sync) ──────────────────────────────────────

  var cloudDirty = false;
  var conflict = null;       // { data, hs, info } while the player chooses which progress to keep

  var cloud = {
    // Nothing goes up while the player is choosing: the SDK only uploads when
    // this reads true, and the change waits until the choice is made. A 3.0
    // game that never saved has nothing to upload ({} would wipe the cloud).
    get isDirtyForCloud() { return cloudDirty && !conflict && (!!P || hasLatest); },
    set isDirtyForCloud(v) { cloudDirty = !!v; },
    serializeForCloud: function () {
      var out = {};
      if (P) {
        if (P.mode !== 'cloud') return {};
        out = syncedFields(P.data);
        out._hs = { claims: loadClaims(), t: syncedFields(P.t), orders: trimOrders(P.orders), v: P.version };
        return out;
      }
      if (!hasLatest) return {};
      for (var k in latest) if (has(latest, k)) out[k] = latest[k];
      var c = loadClaims();
      // 3.0 save(): Google purchases already credited travel too — a reinstall
      // must not credit a permanent one again on top of the restored save.
      // TikTok orders too: a kept copy says which orders are already in it.
      var gp = readList(GP_CREDITED);
      if (!isEmpty(c) || gp.length || orders0.length) {
        out._hs = {};
        if (!isEmpty(c)) out._hs.claims = c;
        if (gp.length) out._hs.gp = gp;
        if (orders0.length) out._hs.orders = orders0.slice();
      }
      // No side effects here: the SDK may read a copy it does not send now
      // (a hide while a sync runs). What was sent comes back in onCloudSyncSuccess.
      return out;
    },
    /** SDK 1.1.2 passes `uploaded`: the copy that reached the cloud, maybe older than this phone's state. */
    onCloudSyncSuccess: function (ts, uploaded) {
      if (ts > 0) baseTs = ts;
      if (!uploaded || typeof uploaded !== 'object') return;
      var hs = uploaded._hs;
      cloudOrders = {};
      var o = hs && Array.isArray(hs.orders) ? hs.orders : [];
      for (var i = 0; i < o.length; i++) cloudOrders[String(o[i])] = true;
      // The cloud now holds exactly this phone's state: nothing unsent is left.
      if (!P && same(uploaded, cloud.serializeForCloud())) { gpNew = []; writeSave(false); }
    },
    /**
     * SDK 1.1.2: true while the cloud copy does not hold this paid order. The
     * SDK confirms it to the backend once an uploaded copy does. Any game that
     * saves to the cloud holds — also a 3.0 game whose first save() comes
     * after the credit (onLoad set). A game that saves nowhere (no onLoad, no
     * save(), profile 'local') confirms at once, as before.
     */
    holdOrderConfirmation: function (orderId) {
      return cloudWanted() && !has(cloudOrders, String(orderId));
    },
    onCloudDataReceived: function (json, ts, info) {
      // Only the first login of a session counts — unless the player chose
      // "play here" (takeOver), or a different account just logged in on this
      // phone: both pull and merge again.
      if (cloudSettled && !takingOver && !acceptNextCloud) { log('ignoring cloud data from a later login'); return; }
      acceptNextCloud = false;
      if (ts > 0) baseTs = ts;
      var data = safe(function () { return JSON.parse(json); }, null);
      if (!data || typeof data !== 'object') return;
      var env = P ? null : readSave();     // 3.0: as it was before this login touched anything
      var hs = data._hs || null;
      cloudOrders = {};                    // what THIS cloud copy holds — nothing from earlier copies
      if (hs) {
        mergeClaims(hs.claims);
        if (!P && Array.isArray(hs.gp)) mergeCredited(hs.gp);
        // This phone's own queued save (info.pending) is not in the cloud yet.
        if (Array.isArray(hs.orders) && !(info && info.pending)) {
          for (var i = 0; i < hs.orders.length; i++) cloudOrders[String(hs.orders[i])] = true;
        }
        delete data._hs;
      }

      if (P) {
        // A guest who made progress, joining an account that has its own:
        // which one wins is the player's call, never a silent overwrite.
        if (P.mode === 'cloud' && P.joining && guestProgressed() && accountDiffers(data)) {
          P.joining = false;
          // Paid orders wait for the choice (onOrder); it merges the account's
          // delivered ids first, then fetches them again — credited once.
          askWhichProgress(data, hs);
          return;
        }
        P.joining = false;
        // Always, even when the copy holds only orders / claims: the delivered
        // order ids must come down, or another phone's order is credited twice.
        // Another phone wrote the cloud since this one last saw it: its values
        // win (as on a new phone) — a stale phone's clock never decides. Not
        // for "Play here" (takeOver): its promise is to merge this phone's own
        // progress in, by change time, as before.
        // Either way, order ids that newer copy lacks leave the profile (the
        // backend offers them again): a field it won may have dropped them.
        var newer = !!(info && info.known && !info.unchanged && !info.pending);
        if (P.mode === 'cloud') mergeIntoProfile(data, hs, newer && !takingOver, newer);
        return;
      }
      if (!info) {
        // An SDK before 1.1.2 cannot say whether the cloud changed: as before —
        // and that choice is final, so this phone's stored copy is never
        // handed over or uploaded after it (decideWithoutCloud).
        decided = true;
        if (!isEmpty(data)) { latest = copy(data); hasLatest = true; cloudData = data; if (takingOver) loadDelivered = false; deliverLoad(); }
        return;
      }
      // 3.0 save(): a copy this phone saved but never sent, and nobody wrote
      // the cloud since → it is newer than the cloud copy: kept, handed to
      // onLoad, and uploaded within a second. A cloud copy with no game data
      // at all has nothing to win with either.
      var keep = !!(env && env.dirty && (info.unchanged || isEmpty(data)));
      var cloudOrders0 = hs && Array.isArray(hs.orders) ? hs.orders : [];
      decided = true;
      if (keep) {
        // onLoad gets this phone's copy once a session: a session that started
        // offline already handed it over, and its saves since ARE this copy.
        useSaved(env, cloudOrders0);
        note('cloud:kept this phone');
        log('cloud copy older than this phone\'s unsent save — keeping this phone\'s');
        writeSave(true);
        cloudDirty = true;
        syncSoon();
      } else {
        if (env && env.dirty) dropUnsent(env, hs);
        loadDelivered = false;          // a copy the game has not seen: it merges it
        orders0 = cloudOrders0.map(String);
        ordersNew = [];
        gpNew = [];
        cloudData = null;
        if (!isEmpty(data)) {
          // The pre-login save is the fresh-install state — drop it, never
          // upload it. Until the game saves its merge, the cloud copy IS the
          // save, so claims recorded meanwhile still travel with it.
          latest = copy(data); hasLatest = true;
          cloudData = data;
        }
        writeSave(false);
      }
      deliverLoad();                  // the game's merge, saved, is marked unsent
      // settleCloud() runs on loginSuccess, after this, for every login path.
    }
  };

  /** 3.1: drops the order ids (and Google keys) the cloud copy does not list. */
  function dropOrdersNotIn(hs) {
    var inCloud = {};
    var list = hs && Array.isArray(hs.orders) ? hs.orders : [];
    for (var i = 0; i < list.length; i++) inCloud[String(list[i])] = true;
    var gone = P.orders.filter(function (k) { return !has(inCloud, String(k)); });
    if (!gone.length) return;
    P.orders = P.orders.filter(function (k) { return has(inCloud, String(k)); });
    // A permanent Google item Google still returns is then credited again; a
    // consumable was finished at Google already (see dropUnsent).
    storeSet(GP_CREDITED, JSON.stringify(readList(GP_CREDITED).filter(function (k) { return gone.indexOf(k) < 0; })));
  }

  /** Order ids a cloud copy lists, into the profile's (3.1). */
  function addOrders(hs) {
    if (!hs || !Array.isArray(hs.orders)) return;
    for (var i = 0; i < hs.orders.length; i++) if (!orderKnown(hs.orders[i])) P.orders.push(String(hs.orders[i]));
    P.orders = trimOrders(P.orders);
  }

  // ─── Guest progress meets an account's own progress ───────────────────────

  /** The field that sums up progress for the "which one?" question: opts.summary, the first 'max' field, or level. */
  function summaryField() {
    if (P.summary && has(P.defs, P.summary)) return P.summary;
    for (var f in P.rules) if (has(P.rules, f) && P.rules[f] === 'max' && has(P.defs, f)) return f;
    return has(P.defs, 'level') ? 'level' : '';
  }

  /**
   * The guest really played: the summary field moved off its default (else any
   * synced field changed). A guest who bought something always counts — its
   * items must never be overwritten without asking.
   */
  function guestProgressed() {
    if (P.orders.length) return true;
    var f = summaryField();
    if (f) return has(P.t, f) && !same(P.data[f], P.defs[f]);
    for (var k in P.t) if (has(P.t, k) && !has(P.local, k)) return true;
    return false;
  }

  /**
   * The account's copy says something else than this phone (any field, once the guest bought something).
   * Known and kept on purpose: a guest who only earned small things (hints
   * from an ad) at the account's own level joins it without a question, and
   * the account's values win. Asking on every small difference would put the
   * popup in front of almost every first sign-in; paid items always ask.
   */
  function accountDiffers(data) {
    var f = summaryField();
    if (f && !P.orders.length) return has(data, f) && !same(data[f], P.data[f]);
    for (var k in data) if (has(data, k) && !has(P.local, k) && !same(data[k], P.data[k])) return true;
    return false;
  }

  function askWhichProgress(data, hs) {
    var f = summaryField();
    var info = { field: f, device: f ? copy(P.data[f]) : null, account: f ? copy(data[f]) : null };
    conflict = { data: data, hs: hs, info: info };
    note('accountConflict');
    var answered = false;
    var choose = function (which) {
      if (answered) return;
      answered = true;
      resolveConflict(which === 'device' ? 'device' : 'account');
    };
    // The game's own screen, if it has one…
    if ((kitListeners.accountConflict || []).length) { kitEmit('accountConflict', copy(info), choose); return; }
    // …else the system's confirm popup (TikTok, and the web shim in the app).
    var t = root && root.tt;
    if (t && typeof t.showModal === 'function') {
      var label = f ? f.replace(/_/g, ' ') : 'progress';
      safe(function () {
        t.showModal({
          title: 'Choose your progress',
          content: 'This account already has saved progress (' + label + ' ' + info.account + '). ' +
                   'This phone has ' + label + ' ' + info.device + '. Which one do you keep?',
          confirmText: 'Account', cancelText: 'This phone', showCancel: true,
          success: function (r) { choose(r && r.confirm ? 'account' : 'device'); },
          fail: function () { choose('account'); }
        });
      });
      return;
    }
    choose('account');   // nothing to ask with: the account's progress, as before
  }

  function resolveConflict(which) {
    var c = conflict;
    if (!c) return;
    // The side not kept stays on this phone — a wrong tap can be undone by support.
    storeSet(profileKey(P.owner) + '.conflict', JSON.stringify({ kept: which, device: P.data, account: c.data, at: Date.now() }));
    conflict = null;
    note('accountConflict:' + which);
    if (which === 'account') {
      P.fresh = true;
      mergeIntoProfile(c.data, c.hs);
    } else {
      // This phone's progress becomes the account's. Delivered orders still
      // come down, or another phone's purchase would be credited twice.
      addOrders(c.hs);
      for (var f in P.data) if (has(P.data, f) && !has(P.local, f)) P.t[f] = nowMs();
      P.fresh = false;
      writeProfileNow();
      cloud.isDirtyForCloud = true;
    }
    syncSoon();
    kitEmit('accountChosen', which);
    // Paid orders were turned away while the player chose (the choice could
    // have overwritten them): fetch and credit them now, into the kept progress.
    if (sdk && ready) safe(function () { sdk.iap.checkPendingRewards(); });
    if (billing()) recoverGoogle();
  }

  function settleCloud() {
    if (cloudSettled) return;
    cloudSettled = true;
    if (cloudWanted()) cloud.isDirtyForCloud = true;
  }

  function deliverLoad() {
    if (loadDelivered || !cloudData || !loadCb) return;
    loadDelivered = true;
    note('onLoad');
    var data = cloudData;
    safe(function () { loadCb(data); });
  }

  /**
   * On every login (loginSuccess fires just before the SDK hands over the
   * cloud copy): a different TikTok / Google account on this phone gets its
   * own profile — never the previous account's progress.
   */
  /** Returns true when the profile now belongs to a different account than before. */
  function onAccount(openId) {
    if (!P || P.mode !== 'cloud' || !openId) return false;
    if (P.owner === openId) return false;
    var guestClaims = (!P.owner || P.owner.indexOf('dv_') === 0) ? storeGet(claimsKey()) : null;

    // A device account (dv_…, the Android app without Google sign-in) is a
    // guest too: its progress joins a Google account signed in to later — and
    // a guest's progress joins the device account itself on its first login.
    var guestOwner = !P.owner || P.owner.indexOf('dv_') === 0;
    if (guestOwner && !storeGet(profileKey(openId))) {
      // Played before the first login, and this phone has nothing for this
      // account: the progress joins the account — but like a new phone, so
      // its cloud copy wins (except 'max' / 'min' fields) instead of being
      // overwritten by fresh device times.
      P.owner = openId;
      P.fresh = true;
      P.joining = true;                    // its cloud copy, if any, may ask the player first
      writeProfileNow();
      storeSet(PROFILE_KEY + '.last', openId);
      // The guest's claims join the account with its progress.
      if (guestClaims && !storeGet(claimsKey())) storeSet(claimsKey(), guestClaims);
      memClaims = {};
      acceptNextCloud = true;
      return true;
    }

    // A different account (or one with its own copy on this phone): keep the
    // previous copy where it was, load this account's, and let its cloud copy
    // merge even though this session already logged in once.
    writeProfileNow();
    var before = copy(P.data);
    loadProfile(openId);
    var fired = {};
    var keys = {};
    var k;
    for (k in before) if (has(before, k)) keys[k] = true;
    for (k in P.data) if (has(P.data, k)) keys[k] = true;
    for (k in keys) if (!same(P.data[k], before[k])) fired[k] = [copy(P.data[k]), copy(before[k])];
    memClaims = {};                       // the claims are this account's from here on
    acceptNextCloud = true;
    fire(fired, 'account');
    return true;
  }

  // ─── Purchases: one route, the same onGive ────────────────────────────────

  var lastBuyGiven = null;   // whether the order of the buy() in progress reached the game

  /** Order ids compare as text: one path may say 1042, another "1042". */
  function orderKnown(id) {
    var s = String(id);
    for (var i = 0; i < P.orders.length; i++) if (String(P.orders[i]) === s) return true;
    return false;
  }

  function onOrder(o) {
    note('order:' + o.product_id);
    var items = toItems(o.rewards);
    var ok = false;
    try {
      // Already credited — on this phone or another one whose profile came
      // down with the cloud copy — but its confirmation never reached the
      // backend, so it is offered again. Taking it without crediting lets the
      // SDK confirm it; crediting would grant it twice.
      var oid = o.order_id;
      var hasId = oid !== undefined && oid !== null && oid !== '' && oid !== 0;
      // The player is choosing between this phone's progress and the account's:
      // a credit now could be overwritten by the choice. Kept (not confirmed);
      // fetched again once the choice is made.
      if (conflict) throw new Error('order ' + o.order_id + ' waits for the progress choice — order kept');
      if (hasId && (P ? orderKnown(oid) : knownOrder0(oid))) {
        log('order #' + o.order_id + ' was already credited — confirming only');
        ok = true;
        // The SDK confirms it once an uploaded copy holds it: make sure one goes up.
        if (!has(cloudOrders, String(oid)) && cloudWanted()) { cloudDirty = true; syncSoon(); }
        return;
      }
      // Throwing is the "not taken" signal: the SDK does not confirm the order,
      // so the next login delivers it again. A paid order is stricter than a
      // claim: nothing to give, or an item this build does not know, is kept
      // rather than "given" to a game that would silently ignore it.
      if (isEmpty(items)) throw new Error('product ' + o.product_id + ' gives no item — order kept');
      var cat = catalog();
      for (var id in items) {
        if (!has(items, id)) continue;
        var known = (P && typeof P.defs[id] === 'number') || isEmpty(cat) || has(cat, id);
        if (!known) throw new Error('item "' + id + '" is not in the catalog — order kept');
      }
      // 3.0: the order is in the save from the game's NEXT save() on (in onGive,
      // or later) — only then does it travel with it, and only an uploaded
      // copy that lists it lets the SDK confirm it.
      var sid = String(oid);
      if (!P && hasId) ordersNew.push(sid);
      if (!give(items, 'product:' + o.product_id)) {
        ordersNew = ordersNew.filter(function (x) { return x !== sid; });
        throw new Error('product ' + o.product_id + ' was not taken — order kept');
      }
      if (P && hasId) {
        P.orders.push(sid);
        P.orders = trimOrders(P.orders);
        writeProfileNow();                       // before the SDK confirms it
      }
      // Also during the login (before the cloud settles): the SDK then knows
      // the game holds newer changes than a save queued on hide, and does not
      // resend that older copy first (nor start its cooldown).
      if (cloudWanted()) cloud.isDirtyForCloud = true;
      ok = true;
      evPurchase(o.product_id);
    } finally {
      if (!o.recovered) lastBuyGiven = ok;
    }
  }

  // ─── Google Play purchases (the HS Android app, client-only billing v1) ────
  // The app's billing plugin returns only purchases whose Google signature it
  // checked with the game's licensing key. The kit credits each one ONCE (its
  // order id is remembered on the device and in the cloud profile), and only
  // then tells Google it is finished — a crash in between leaves it owned, and
  // the next start credits it. Each purchase is also reported to the server.

  var GP_CREDITED = 'hsgame.gp.credited';   // device list of credited purchase keys
  var GP_REPORTS = 'hsgame.gp.reports';     // purchases still to report to the server
  var googleProducts = {};                  // google id → the HS product (raw, with rewards)

  function billing() {
    var nb = nativeBridge();
    return nb && nb.billing && typeof nb.billing.buy === 'function' ? nb.billing : null;
  }

  /** A purchase's product, order id and token — from the app's object, else Google's own JSON. */
  function gpInfo(p) {
    var j = (p && typeof p.json === 'string' && safe(function () { return JSON.parse(p.json); }, null)) || {};
    // A bridge may hand ids over as numbers (StoreKit's product "1", a transaction id).
    var text = function () {
      for (var i = 0; i < arguments.length; i++) {
        var v = arguments[i];
        if (typeof v === 'number' && isFinite(v)) return String(v);
        if (typeof v === 'string' && v) return v;
      }
      return '';
    };
    return {
      product: text(p && p.productId, j.productId, Array.isArray(j.productIds) ? j.productIds[0] : ''),
      order: text(p && p.orderId, j.orderId),
      token: text(p && p.token, p && p.purchaseToken, j.purchaseToken)
    };
  }

  /**
   * A permanent item (a skin): the store keeps it owned and returns it at every
   * start. Read as the iOS build worker reads it (it creates the App Store
   * product from the same item): "type" wins (one_time / non_consumable /
   * entitlement · consumable), else "consumable": false — in the item or its metadata.
   */
  function isPermanent(product) {
    if (!product) return false;
    var md = product.metadata;
    if (typeof md === 'string') { var raw = md; md = safe(function () { return JSON.parse(raw); }, null); }
    if (!md || typeof md !== 'object') md = {};
    var type = String(md.type != null ? md.type : (product.type != null ? product.type : '')).toLowerCase().replace(/[-\s]/g, '_');
    if (type === 'consumable') return false;
    if (/^(non_?consumable|one_time|entitlement)$/.test(type)) return true;
    return (typeof md.consumable === 'boolean' ? md.consumable : product.consumable) === false;
  }

  /**
   * The key a purchase is remembered by; '' when it has neither order id nor
   * token (such a purchase is never credited — two of them would look alike).
   * Permanent ones get their own prefix: they never age out of the lists.
   */
  function purchaseKey(p, product) {
    var g = gpInfo(p);
    var id = g.order || g.token;
    return id ? (isPermanent(product) ? 'gpo:' : 'gp:') + id : '';
  }

  /** The newest ORDERS_KEEP keys — plus every permanent purchase, which must stay known for good. */
  function trimOrders(list) {
    if (list.length <= ORDERS_KEEP) return list;
    var older = list.slice(0, -ORDERS_KEEP).filter(function (k) { return String(k).indexOf('gpo:') === 0; });
    return older.concat(list.slice(-ORDERS_KEEP));
  }

  function readList(key) {
    var raw = storeGet(key);
    var v = raw ? safe(function () { return JSON.parse(raw); }, null) : null;
    return Array.isArray(v) ? v : [];
  }

  function googleCredited(key) { return (P && orderKnown(key)) || readList(GP_CREDITED).indexOf(key) >= 0; }

  /** Purchases credited on another install (3.0 save(): they come with the cloud copy). */
  function mergeCredited(keys) {
    var list = readList(GP_CREDITED);
    keys.forEach(function (k) { if (typeof k === 'string' && list.indexOf(k) < 0) list.push(k); });
    storeSet(GP_CREDITED, JSON.stringify(trimOrders(list)));
  }

  /** Credit a checked Google purchase once. True when its items are in (now or before). */
  function creditGoogle(p, product) {
    var key = purchaseKey(p, product);
    if (!key) { log('Google purchase without an order id or token — not credited'); return false; }
    if (googleCredited(key)) return true;
    // The player is choosing which progress to keep: left unfinished at
    // Google, credited once the choice is made (resolveConflict recovers it).
    if (conflict) { log('Google purchase waits for the progress choice — kept'); return false; }
    var items = toItems(product && product.rewards);
    // As strict as a TikTok order: nothing to give, or an item this build does
    // not know, is NOT credited — the purchase stays owned and comes back.
    if (isEmpty(items)) { log('Google purchase of ' + gpInfo(p).product + ' gives no item — kept'); return false; }
    var cat = catalog();
    for (var id in items) {
      if (!has(items, id)) continue;
      if (!((P && typeof P.defs[id] === 'number') || isEmpty(cat) || has(cat, id))) { log('item "' + id + '" unknown — Google purchase kept'); return false; }
    }
    if (!give(items, 'product:' + (product.product_id || product.id))) return false;
    var list = readList(GP_CREDITED);
    list.push(key);
    storeSet(GP_CREDITED, JSON.stringify(trimOrders(list)));
    if (P) {
      P.orders.push(key);
      P.orders = trimOrders(P.orders);
      writeProfileNow();
    } else {
      // 3.0: kept with the save that holds it (see dropUnsent).
      gpNew.push(key);
      markSaveDirty();
    }
    if (cloudSettled && cloudWanted()) cloud.isDirtyForCloud = true;
    var q = readList(GP_REPORTS);
    // iOS: json is Apple's signed transaction (JWS), checked by the backend's Apple route.
    q.push(isIos() ? { json: p.json, store: 'apple', tries: 0 } : { json: p.json, signature: p.signature, tries: 0 });
    storeSet(GP_REPORTS, JSON.stringify(q.slice(-ORDERS_KEEP)));
    flushGoogleReports();
    safe(function () { evPurchase(String(product.product_id || product.id), product); });   // analytics: the purchase
    return true;
  }

  /** Tell Google the purchase is done: consumed (can be bought again) or acknowledged (owned for good). */
  function finishGoogle(p, product) {
    var b = billing();
    var token = gpInfo(p).token;
    if (!b || typeof b.finish !== 'function' || !token) return;
    var consumable = !isPermanent(product);
    safe(function () { Promise.resolve(b.finish({ token: token, consumable: consumable })).then(null, function (e) { log('finish failed: ' + (e && e.message)); }); });
  }

  var reporting = false;
  var REPORT_TRIES = 10;     // a report the server keeps refusing is dropped after this many
  /** Send queued purchases to the server (needs a session; the rest wait for the next login). */
  function flushGoogleReports() {
    if (reporting || !sdk || !ready || !sdk.isAuthenticated) return;
    var q = readList(GP_REPORTS);
    if (!q.length) return;
    reporting = true;
    var tried = {};
    // Change one queued report (by its json); fn returns null to drop it.
    var update = function (json, fn) {
      var now = [];
      readList(GP_REPORTS).forEach(function (x) {
        if (!x || x.json !== json) { now.push(x); return; }
        var y = fn(x);
        if (y) now.push(y);
      });
      storeSet(GP_REPORTS, JSON.stringify(now));
    };
    var failed = function (json) {
      update(json, function (x) {
        x.tries = (x.tries || 0) + 1;
        if (x.tries < REPORT_TRIES) return x;
        log('a purchase report was refused ' + x.tries + ' times — dropped');
        return null;
      });
    };
    var next = function (i) {
      if (i >= q.length) {
        // Purchases queued while this ran go too.
        var more = readList(GP_REPORTS).filter(function (x) { return x && !has(tried, x.json); });
        if (!more.length) { reporting = false; return; }
        q = q.concat(more);
      }
      var entry = q[i];
      if (!entry || typeof entry.json !== 'string') { update(entry && entry.json, function () { return null; }); next(i + 1); return; }
      tried[entry.json] = true;
      var apple = entry.store === 'apple';
      // An SDK without the Apple route keeps it queued, untried, for one that has it.
      if (apple && typeof sdk.iap.reportApplePurchase !== 'function') { next(i + 1); return; }
      Promise.resolve(safe(function () {
        return apple ? sdk.iap.reportApplePurchase(entry.json) : sdk.iap.reportStorePurchase(entry.json, entry.signature);
      }, null)).then(function (r) {
        if (r && r.success) update(entry.json, function () { return null; });
        else failed(entry.json);
        next(i + 1);
      }, function () { failed(entry.json); next(i + 1); });
    };
    next(0);
  }

  /**
   * The id the app's store sells a product under: its google_id. The iOS app
   * (HSNative.os 'ios') takes the product_id ("1") and maps it to the App
   * Store id itself, both ways — a google_id copied from Android means nothing
   * there. '' = not on sale in this app.
   */
  function storeId(p) {
    if (!p) return '';
    if (isIos()) return p.product_id != null && p.product_id !== '' ? String(p.product_id) : '';
    return typeof p.google_id === 'string' && p.google_id ? p.google_id : '';
  }

  function findGoogleProduct(productId) {
    var want = String(productId);
    var byRow = null;   // `id` (the backend's row on iOS) only when no product_id matches
    for (var sid in googleProducts) {
      if (!has(googleProducts, sid)) continue;
      var p = googleProducts[sid];
      if (String(p.product_id) === want || sid === want) return p;
      if (!byRow && String(p.id) === want) byRow = p;
    }
    return byRow;
  }

  var buyingGoogle = null;   // the open purchase (one at a time: Google shows one sheet)

  /** HSGame.buy() in the Android app: Google Play's sheet → credit once → finish. */
  function buyGoogle(productId) {
    if (buyingGoogle) return Promise.resolve({ ok: false, error: 'A purchase is already open', delivered: false });
    var b = billing();
    var mine = {};
    buyingGoogle = mine;
    var release = function () { if (buyingGoogle === mine) buyingGoogle = null; };
    var product = findGoogleProduct(productId);
    var found = product ? Promise.resolve(product) : loadGoogleProducts().then(function () { return findGoogleProduct(productId); });
    return found.then(function (prod) {
      if (!prod) return { ok: false, error: 'Unknown product', delivered: false };
      pauseFor('buy');
      // A sheet that never answers must not freeze the game, nor block buying for good.
      var cap = setTimeout(function () { resumeFrom('buy'); release(); }, BUY_PAUSE_MAX_MS);
      var buying;
      try { buying = Promise.resolve(b.buy(storeId(prod))); } catch (e) { buying = Promise.reject(e); }
      return buying.then(function (r) {
        clearTimeout(cap);
        resumeFrom('buy');
        if (!r || !r.ok || !r.purchase) {
          var error = (r && r.cancelled) ? 'Cancelled' : ((r && r.error) || 'Purchase failed');
          // Google still holds an earlier one (its finish failed): credit and finish it now.
          if (/already.?owned/i.test(error)) recoverGoogle();
          return { ok: false, error: error, delivered: false };
        }
        // What Google sold decides what is given — not the button that was tapped.
        var sold = gpInfo(r.purchase).product;
        var real = sold === storeId(prod) ? prod : (has(googleProducts, sold) ? googleProducts[sold] : null);
        if (!real) {
          log('the store sold "' + sold + '", not "' + storeId(prod) + '" — not credited');
          return { ok: true, error: '', delivered: false };
        }
        var given = creditGoogle(r.purchase, real);
        if (given) finishGoogle(r.purchase, real);
        // Paid but not given (unknown item, onGive threw): left unfinished at
        // Google, credited at the next start — tell the player it is on its way.
        return { ok: true, error: '', delivered: given };
      }, function (e) {
        clearTimeout(cap);
        resumeFrom('buy');
        return { ok: false, error: String(e && e.message || e), delivered: false };
      });
    }).then(function (res) { release(); return res; }, function (e) {
      release();
      return { ok: false, error: String(e && e.message || e), delivered: false };
    });
  }

  var googleLoaded = false;    // googleProducts came from the server at least once
  var recoverWanted = false;   // a recovery is waiting: for the products, or for the cloud copy

  /**
   * Purchases the store still holds — unfinished (a crash before finish) or
   * permanent: credit what is new. Resolves { owned, restored } (product ids:
   * credited now or before · credited now), or null when it could not look.
   */
  function recoverGoogle() {
    var b = billing();
    if (!b || typeof b.owned !== 'function') return Promise.resolve(null);
    // The cloud copy, not read yet, may already hold them (a reinstall):
    // crediting first would be overwritten by it. The login calls back here.
    if (cloudWanted() && loginPossible() && !cloudSettled) { recoverWanted = true; return Promise.resolve(null); }
    var products = googleLoaded ? Promise.resolve() : loadGoogleProducts();
    return products.then(function () {
      // Offline: what each purchase gives is unknown — again once the shop loads.
      if (!googleLoaded) { recoverWanted = true; return null; }
      recoverWanted = false;
      return Promise.resolve(safe(function () { return b.owned(); }, [])).then(function (list) {
        var found = { owned: [], restored: [] };
        (list || []).forEach(function (p) {
          var pid = gpInfo(p).product;
          var product = has(googleProducts, pid) ? googleProducts[pid] : null;
          if (!product) { log('owned store purchase of unknown product ' + pid + ' — left for a build that knows it'); return; }
          var before = googleCredited(purchaseKey(p, product));
          if (!creditGoogle(p, product)) return;
          finishGoogle(p, product);
          var id = product.product_id != null ? product.product_id : product.id;
          if (found.owned.indexOf(id) < 0) found.owned.push(id);
          if (!before && found.restored.indexOf(id) < 0) found.restored.push(id);
        });
        return found;
      }, function () { return null; });
    });
  }

  var storePermanent = false;  // a one-time product is on sale in the app's store — has('restore')

  /**
   * HS dashboard products that are on sale in the app's store (Google Play: a
   * `google_id`; iOS: every product, by product_id) + the store's price.
   */
  function loadGoogleProducts() {
    var b = billing();
    if (!b || !sdk || !ready) return Promise.resolve([]);
    return Promise.resolve(safe(function () { return sdk.iap.getShopItems(); }, null)).then(function (r) {
      // Offline: keep what an earlier load found.
      if (!r || !r.success) return [];
      var mine = (r.data || []).filter(function (p) { return !!storeId(p); });
      googleProducts = {};
      mine.forEach(function (p) { googleProducts[storeId(p)] = p; });
      googleLoaded = true;
      if (!mine.length || typeof b.products !== 'function') { storePermanent = false; return []; }
      return Promise.resolve(b.products(mine.map(storeId))).then(function (prices) {
        var byId = {};
        (prices || []).forEach(function (g) { if (g && g.id) byId[g.id] = g; });
        var list = mine.filter(function (p) { return has(byId, storeId(p)); }).map(function (p) {
          var out = {};
          for (var k in p) if (has(p, k) && k !== 'rewards') out[k] = p[k];
          out.items = toItems(p.rewards);
          out.price = byId[storeId(p)].price;          // the store's localized text, e.g. "₫25,000"
          out.currency = byId[storeId(p)].currency;
          // the price as a number, when the app's billing gives one (for the analytics purchase event)
          var micros = byId[storeId(p)].priceMicros;
          if (typeof micros !== 'number') micros = byId[storeId(p)].price_amount_micros;
          if (typeof micros === 'number' && isFinite(micros)) out.price_micros = micros;
          return out;
        });
        storePermanent = list.some(isPermanent);
        return list;
      });
    }, function () { return []; });
  }

  function isIos() { var nb = nativeBridge(); return !!nb && nb.os === 'ios'; }

  // ─── The HS app's ad provider (max.js behind HSNative.ads) ────────────────
  // The provider's key and the unit ids are data of the HS game (iaa_config
  // "ad_provider" + its placements): handed to the app each time the ad config
  // arrives, so it starts the provider and loads every unit before the first
  // tap. An app without ads.init (an older build) loads on the first show.

  var adsInitSent = '';

  function initNativeAds() {
    var nb = nativeBridge();
    if (!nb || !nb.ads || typeof nb.ads.init !== 'function' || !sdk) return;
    var cfg = safe(function () { return sdk.ads.config; }, null) || {};
    var p = cfg.ad_provider;
    if (!p || typeof p !== 'object' || typeof p.sdk_key !== 'string' || !p.sdk_key) return;
    // A unit's type comes from Edit Game (the active ad placements), as for showAd.
    var types = {};
    (safe(function () { return sdk.ads.getActivePlacements(); }, null) || []).forEach(function (ap) {
      if (ap && ap.id && typeof ap.type === 'string') types[ap.id] = /reward/i.test(ap.type) ? 'rewarded' : 'interstitial';
    });
    var units = [];
    (Array.isArray(cfg.placements) ? cfg.placements : []).forEach(function (pl) {
      (pl && Array.isArray(pl.ads) ? pl.ads : []).forEach(function (a) {
        var id = a && a.id;
        if (id && has(types, id) && !units.some(function (u) { return u.unitId === id; })) units.push({ type: types[id], unitId: id });
      });
    });
    var req = {
      provider: typeof p.name === 'string' && p.name ? p.name : 'applovin_max',
      sdkKey: p.sdk_key,
      testMode: p.test_mode !== false,   // test unless the dashboard says otherwise (a test build always is)
      units: units
    };
    var sent = JSON.stringify(req);
    if (sent === adsInitSent) return;
    adsInitSent = sent;
    safe(function () { Promise.resolve(nb.ads.init(req)).then(null, function (e) { log('ad provider init failed: ' + String(e && e.message || e)); }); });
  }

  // ─── TikTok APIs the backend is not involved in (missions, share) ─────────

  function tiktok(name) {
    var g = root && root.TTMinis && root.TTMinis.game;
    if (g && typeof g[name] === 'function') {
      var can = typeof g.canIUse !== 'function' || safe(function () { return g.canIUse(name); }, false);
      if (can) return g;
    }
    var t = root && root.tt;
    return t && typeof t[name] === 'function' ? t : null;
  }

  /**
   * Calls a callback-style TikTok API. Resolves { ok, res, err }; never
   * rejects, and never hangs: a host that answers nothing (backgrounded
   * mid-call) resolves 'timeout' after `ms`, and a late answer is dropped.
   */
  function callTikTok(name, args, ms) {
    return new Promise(function (resolve) {
      var settled = false;
      var done = function (r) { if (settled) return; settled = true; clearTimeout(timer); resolve(r); };
      var timer = setTimeout(function () { done({ ok: false, err: 'timeout' }); }, ms || 15000);
      var host = tiktok(name);
      if (!host) return done({ ok: false, err: 'unsupported' });
      var o = {};
      for (var k in (args || {})) o[k] = args[k];
      o.success = function (res) { done({ ok: true, res: res }); };
      o.fail = function (e) { done({ ok: false, err: (e && (e.errMsg || e.message)) || 'failed' }); };
      try { host[name](o); } catch (e) { done({ ok: false, err: String(e && e.message || e) }); }
    });
  }

  /**
   * The Android app's share sheet, in callTikTok's { ok, err } shape. `ok` =
   * the player picked an app to share to (Android cannot confirm the post
   * itself) — so the share reward stays once a day.
   */
  function shareNative(opts) {
    return new Promise(function (resolve) {
      var settled = false;
      var done = function (r) { if (settled) return; settled = true; clearTimeout(timer); resolve(r); };
      var timer = setTimeout(function () { done({ ok: false, err: 'timeout' }); }, 120000);
      var nb = nativeBridge();
      if (!nb || typeof nb.share !== 'function') return done({ ok: false, err: 'unsupported' });
      var req = { title: opts.title, text: opts.text || opts.subtitle || opts.desc, url: opts.url, imageUrl: opts.imageUrl };
      var call;
      try { call = Promise.resolve(nb.share(req)); } catch (e) { return done({ ok: false, err: String(e && e.message || e) }); }
      call.then(function (r) {
        done(r && r.ok ? { ok: true, res: r } : { ok: false, err: (r && r.error) || 'cancelled' });
      }, function (e) { done({ ok: false, err: String(e && e.message || e) }); });
    });
  }

  // ─── TikTok missions: tiktok_shortcut / tiktok_profile ────────────────────
  // The player is sent off with tiktokMission.start(); the reward is paid
  // when TikTok later confirms it (opened from the icon / came in from the
  // profile) — checked after login and on every return to the app.

  var MISSIONS = {
    shortcut: { start: 'addShortcut', check: 'getShortcutMissionReward' },
    profile: { start: 'startEntranceMission', check: 'getEntranceMissionReward' }
  };
  var missionBusy = {};
  var missionGiven = {};
  var missionStarted = {};   // the player was sent off this session
  var showHooked = false;

  function checkMission(kind) {
    var key = 'tiktok_' + kind;
    if (ready && !loginDone) return Promise.resolve(false);   // wait for the dashboard's values and the cloud claims
    if (featureOff('tiktok_missions')) return Promise.resolve(false);
    var e = entry(key);
    if (!giveCb || !e || isEmpty(e.items) || missionBusy[kind] || missionGiven[kind] || isClaimed(key, e.limit)) return Promise.resolve(false);
    missionBusy[kind] = true;
    return callTikTok(MISSIONS[kind].check, null, 10000).then(function (r) {
      missionBusy[kind] = false;
      if (!r.ok) return false;
      var res = r.res || {};
      var flag = res.canReceiveReward !== undefined ? res.canReceiveReward : res.can_receive_reward;
      // An explicit `true` pays. Some TikTok builds answer success with no
      // flag at all — that counts only after the player was actually sent
      // off this session (what the SDK's own missions rely on), never at a
      // cold start, where it would pay a mission nobody did.
      var can = flag === true || (flag === undefined && !!missionStarted[kind]);
      if (!can) return false;
      if (missionGiven[kind] || isClaimed(key, e.limit)) return false;
      // Locked for the session before the game runs, so a game that gives and
      // then throws in its UI code is not paid on every return to the app;
      // persisted only when onGive did not throw.
      missionGiven[kind] = true;
      if (!give(e.items, key)) return false;
      recordClaim(key);
      return true;
    });
  }

  function checkMissions() {
    return Promise.all([checkMission('shortcut'), checkMission('profile')]).then(function () {});
  }

  var lastActiveCheck = 0;

  /** Back in the foreground: missions, and — at most once a minute — "is this still the active device?". */
  function onAppShow() {
    evOnShow();
    resumeFrom('app');
    checkMissions();
    // A pending Google payment (cash, bank) that completed meanwhile: credit and
    // finish it now — Google refunds one not finished within 3 days. Not while
    // a purchase sheet is open: that sheet itself hides and shows the app.
    if (loginDone && !buyingGoogle && billing()) recoverGoogle();
    if (!sdk || !ready || !sdk.isAuthenticated || Date.now() - lastActiveCheck < 60000) return;
    lastActiveCheck = Date.now();
    // Any session call does: if another device logged in meanwhile, the SDK
    // gets a 401, marks the session replaced and the kit fires otherDevice.
    // Pending rewards is the call an app should make on resume anyway.
    safe(function () { sdk.iap.checkPendingRewards(); });
  }

  function hookShow() {
    if (showHooked) return;
    var t = root && root.tt;
    // Both or neither: a hide with no matching show would pause for good.
    if (t && typeof t.onShow === 'function' && typeof t.onHide === 'function') {
      showHooked = true;
      safe(function () { t.onShow(onAppShow); });
      // The profile is written when the app is hidden, not only on its timer.
      safe(function () { t.onHide(onAppHide); });
    }
    var doc = safe(function () { return root && root.document; }, null);
    if (!showHooked && doc && typeof doc.addEventListener === 'function') {
      showHooked = true;
      safe(function () {
        doc.addEventListener('visibilitychange', function () {
          if (doc.visibilityState === 'hidden') onAppHide(); else onAppShow();
        });
      });
    }
  }

  function onAppHide() {
    if (P && P.timer) writeProfileNow();
    evOnHide();
    pauseFor('app');
  }

  // ─── Ads ──────────────────────────────────────────────────────────────────

  var adLabels = {};    // places the game asked showAd / canShowAd about this session
  var shareKeys = { share: true };
  var shareBusy = false;

  function adConfigured(label) {
    if (!sdk || !ready || !label) return false;
    var ads = sdk.ads;
    return safe(function () { return !!ads.getPlacement(label) && ads.resolvePlace(label).resolved; }, false);
  }

  /** An ad place: one the dashboard has, or one the game shows ads at. Its reward is showAd's to pay. */
  function isAdPlace(key) {
    if (has(adLabels, key)) return true;
    return !!(sdk && ready && safe(function () { return sdk.ads.getPlacement(key); }, null));
  }

  /** The place gives a reward with a once / daily limit, and it is used up. */
  function rewardUsedUp(label) {
    var e = entry(label);
    return !!(e && !isEmpty(e.items) && e.limit !== 'always' && isClaimed(label, e.limit));
  }

  /** The dashboard has an ad place with an active unit, and this runtime can show ads. */
  function anyAdPlace() {
    if (!sdk || !ready) return false;
    var canShow = canDo('rewardedVideoAd') || canDo('interstitialAd') || safe(function () { return sdk.isTestMode; }, false);
    return canShow && safe(function () {
      return sdk.ads.getPlaceLabels().length > 0 && sdk.ads.getActivePlacements().length > 0;
    }, false);
  }

  var adToken = 0;

  /** What a finished ad gives: null (failed / skipped / not given), {} (no reward here) or the items. */
  function adOutcome(label, r) {
    if (!r || !r.success) { HSGame.lastAdError = (r && r.error_message) || 'unavailable'; return null; }
    if (!r.completed) { HSGame.lastAdError = 'skipped'; return null; }
    var e = entry(label);
    if (!e || isEmpty(e.items)) return {};         // e.g. an interstitial: shown, nothing to give
    var got = payout(label);
    // A rewarded ad that completed but gave nothing (onGive threw) must not
    // look like the no-reward {} — the game would continue as if paid.
    if (!got) { HSGame.lastAdError = 'not given'; return null; }
    return got;
  }

  // ─── Store gate ───────────────────────────────────────────────────────────
  // TikTok products cost beans and are paid through TikTok. An Android app
  // without its own billing must never list them.

  var shopCount = 0;    // products in the last shop() answer — has('shop')
  var shopKnown = false;  // a shop() answer arrived this session
  var shopTriedAt = 0;

  function storeOpen() {
    // Android: the app's own Google Play billing (TikTok products never show there).
    return !!(sdk && ready) && (platformName() !== 'android' || !!billing());
  }

  // ─── Analytics (HS Analytics — games-analytics docs/EVENTS.md) ────────────
  // Off unless start({ analytics: true }). The kit sends sessions, ads,
  // purchases and the device profile by itself; the game adds level / economy /
  // power-up / ui calls and registered custom events. Events wait in a queue on
  // the device and go out in batches; a resend after a lost answer is dropped
  // by the server (each event has its own id). Never throws, never blocks play.

  var EV_URL = 'https://games.wafflescouts.com/api/ev';
  var EV_QUEUE_KEY = 'hs_ev.q';
  var EV_INSTALL_KEY = 'hs_ev.install';
  var EV_MAX_QUEUE = 1000;
  var EV_BATCH = 50;
  var EV_FLUSH_AT = 20;
  var EV_FLUSH_MS = 10000;
  var EV_NEW_SESSION_MS = 30000;
  var EV_POST_TIMEOUT_MS = 30000;   // a request with no answer by then counts as failed (kept, sent again)
  var EV_SAVE_MS = 500;             // queue writes are batched; a hide writes at once
  var EV_SESSION_KEY = 'hs_ev.s';   // the session the app left in the background: { s, active, at, perf }
  var EV_NAME_RE = /^[a-z][a-z0-9_]{2,39}$/;
  var EV_TEMPLATE = {
    session_start: 1, session_end: 1, ad_shown: 1, purchase: 1, perf: 1, error: 1, ab_exposure: 1,
    level_start: 1, level_end: 1, power_up: 1, currency: 1, mission_step: 1, ui: 1, custom: 1
  };
  // The props each template event may carry (games-analytics schema/events.json) —
  // s: string · n: number · i: whole number · b: true/false. The server refuses an
  // event with any other prop, so the rest is dropped here. custom: the game's own.
  var EV_PROPS = {
    session_start: {}, level_start: {},
    session_end: { duration_s: 'n' },
    level_end: { result: 's', score: 'n', reason: 's', duration_s: 'n', moves: 'i', moves_left: 'n', time_left: 'n' },
    power_up: { name: 's', paid: 'b' },
    currency: { flow: 's', currency: 's', amount: 'i', balance: 'i', item_type: 's', item_id: 's', placement: 's' },
    ui: { action: 's', name: 's', location: 's', type: 's' },
    mission_step: { name: 's' },
    ad_shown: { place: 's', format: 's', network: 's', revenue_micros: 'i', currency: 's' },
    purchase: { product: 's', price_micros: 'i', currency: 's', first: 'b' },
    perf: { fps_avg: 'n', fps_p10: 'n' },
    error: { type: 's', hash: 's' },
    ab_exposure: { test_id: 's', variant: 's' }
  };
  // whole-number props kept within the server's caps
  var EV_CAPS = { amount: 1e9, balance: 1e9, price_micros: 5e8, revenue_micros: 5e7 };

  var EV = {
    on: false, url: EV_URL, gameId: '', env: 'live', cfg: {}, building: false,
    queue: [], early: [], timer: null, sending: false, flushPending: false, saveTimer: null,
    install: '', errors: {}, device: null,
    // the session: its id, when it started, its visible time before the current visible stretch
    // (activeMs) and since when it is visible (0 while away); rec = the record kept while away
    session: '', sessionStart: 0, activeMs: 0, visibleSince: 0, hiddenAt: 0, rec: null, products: {}
  };

  function evHex(n) {
    var c = root && root.crypto;
    var a = c && typeof c.getRandomValues === 'function' && typeof Uint8Array === 'function'
      ? safe(function () { var x = new Uint8Array(n); c.getRandomValues(x); return x; }, null)
      : null;
    var s = '';
    for (var i = 0; i < n; i++) {
      var b = a ? a[i] : Math.floor(Math.random() * 256);
      s += (b < 16 ? '0' : '') + b.toString(16);
    }
    return s;
  }

  // Time-ordered event id (UUIDv7 layout): unique, and sorts by creation time.
  function evId() {
    var t = Date.now().toString(16);
    while (t.length < 12) t = '0' + t;
    var r = evHex(10);
    return t.slice(0, 8) + '-' + t.slice(8, 12) + '-7' + r.slice(0, 3) + '-' + ((parseInt(r.charAt(3), 16) & 3) | 8).toString(16) + r.slice(4, 7) + '-' + r.slice(7, 19);
  }

  // The install id: random, made once, kept on the device. The server stores only a salted hash of it.
  function evInstall() {
    if (EV.install) return EV.install;
    var id = storeGet(EV_INSTALL_KEY);
    if (!id || !/^[0-9a-f]{32}$/.test(id)) { id = evHex(16); storeSet(EV_INSTALL_KEY, id); }
    EV.install = id;
    return id;
  }

  /** The short id a tester registers in the HS dashboard (Analytics Setup → Test devices). */
  function evDeviceId() { return 'hsd-' + evInstall().slice(0, 8).toUpperCase(); }

  function evPlatform() {
    var nb = nativeBridge();
    if (nb) return nb.os === 'ios' ? 'ios' : 'android';
    return platformName() === 'minis' ? 'tiktok' : 'web';
  }

  function evStore() {
    var p = evPlatform();
    return p === 'ios' ? 'appstore' : p === 'android' ? 'google' : p === 'tiktok' ? 'minis' : 'site';
  }

  // Coarse on purpose (EVENTS.md §1b): no ad id, no hardware id, RAM as a bucket.
  function evDevice() {
    var info = safe(function () {
      var t = root && root.tt;
      return t && typeof t.getSystemInfoSync === 'function' ? t.getSystemInfoSync() : null;
    }, null) || {};
    var nav = safe(function () { return root && root.navigator; }, null) || {};
    var nb = nativeBridge();
    var scr = safe(function () { return root && root.screen; }, null) || {};
    var w = Number(info.screenWidth || scr.width || 0);
    var h = Number(info.screenHeight || scr.height || 0);
    var short = Math.min(w, h);
    var gb = Number(info.memorySize ? info.memorySize / 1024 : nav.deviceMemory || 0);
    var ram = !gb ? '' : gb <= 2 ? '<=2' : gb <= 4 ? '3-4' : gb <= 8 ? '6-8' : '12+';
    var lang = String(info.language || nav.language || '').slice(0, 2).toLowerCase();
    // The HS app's WebView: the user agent holds the real OS version and model
    // ("Android 11; Redmi Note 8 Pro Build/…", "iPhone OS 18_1"); its getSystemInfo only has
    // the browser's platform ("Linux aarch64"). TikTok's own system string is "Android 11" / "iOS 17.0".
    var ua = String(nav.userAgent || '');
    var am = /Android ([0-9.]+);\s*([^;)]+?)(?:\s+Build\/|\))/.exec(ua);
    var im = /(?:iPhone|iPad)[^)]*? OS (\d+(?:_\d+)*)/.exec(ua);
    var sys = /android|ios|iphone/i.test(String(info.system || '')) ? /(\d+(?:\.\d+)*)/.exec(String(info.system)) : null;
    var osv = sys ? sys[1] : am ? am[1] : im ? im[1].replace(/_/g, '.') : String((nb && nb.osVersion) || '');
    var model = info.model || (nb && nb.model) || (am && am[2]) || (im ? (ua.indexOf('iPad') >= 0 ? 'iPad' : 'iPhone') : '');
    return {
      os: evPlatform() === 'tiktok' ? String(info.platform || '').toLowerCase().slice(0, 16) : evPlatform(),
      os_version: osv.replace(/[^0-9.]/g, '').slice(0, 24),
      model: String(model).replace(/[^0-9A-Za-z ,._()-]/g, '').slice(0, 48),
      ram: ram,
      screen: short ? (short >= 600 ? 'tablet' : 'phone') : '',
      lang: /^[a-z]{2}$/.test(lang) ? lang : ''
    };
  }

  // The queue on the device: written at most every 0.5 s while playing, at once on a hide.
  function evSaveNow() {
    if (EV.saveTimer) { safe(function () { clearTimeout(EV.saveTimer); }); EV.saveTimer = null; }
    storeSet(EV_QUEUE_KEY, safe(function () { return JSON.stringify(EV.queue); }, '[]'));
  }
  function evSave() {
    if (EV.saveTimer) return;
    EV.saveTimer = safe(function () { return setTimeout(function () { EV.saveTimer = null; safe(evSaveNow); }, EV_SAVE_MS); }, null);
    if (!EV.saveTimer) evSaveNow();
  }

  function evLoad() {
    var raw = storeGet(EV_QUEUE_KEY);
    var q = raw ? safe(function () { return JSON.parse(raw); }, []) : [];
    EV.queue = Object.prototype.toString.call(q) === '[object Array]' ? q.slice(-EV_MAX_QUEUE) : [];
  }

  // Props: plain numbers / short strings / booleans only — anything else is dropped here,
  // the server rejects what its template does not allow.
  function evProps(p) {
    var out = {};
    if (!p || typeof p !== 'object') return out;
    var n = 0;
    for (var k in p) {
      if (!has(p, k) || n >= 10 || !/^[a-z][a-z0-9_]{0,31}$/.test(k)) continue;
      var v = p[k];
      if (typeof v === 'number' && isFinite(v)) out[k] = v;
      else if (typeof v === 'boolean') out[k] = v;
      else if (typeof v === 'string') out[k] = v.slice(0, 128);
      else continue;
      n++;
    }
    return out;
  }

  // Only the props the server takes for this event, each of its type; whole numbers
  // rounded and kept within the caps. custom: the game's own (registered) values.
  function evAllowed(name, p) {
    var spec = EV_PROPS[name];
    if (!spec) return p;
    var out = {};
    for (var k in p) {
      if (!has(p, k) || !has(spec, k)) continue;
      var v = p[k], type = spec[k];
      if (type === 's') { if (typeof v === 'string') out[k] = v; else if (typeof v === 'number') out[k] = String(v); }
      else if (type === 'b') { if (typeof v === 'boolean') out[k] = v; }
      else if (typeof v === 'number') {
        if (type === 'i') {
          v = Math.round(v);
          if (has(EV_CAPS, k)) v = Math.max(0, Math.min(EV_CAPS[k], v));
        }
        out[k] = v;
      }
    }
    return out;
  }

  // at / session: an event of a session that already ended (its own time and id)
  function evPush(name, level, props, at, session) {
    // Before start(): a game often builds its first level first. Held (up to 100) until
    // start() says whether analytics is on — then sent, or dropped.
    if (!EV.on && started) return false;
    // t: when it happened (this phone's clock); sent as age_ms, so a wrong clock does not matter.
    // s: its session — a batch carries the events of one session only.
    var e = { id: evId(), name: name, t: typeof at === 'number' && isFinite(at) ? at : Date.now(), s: session || EV.session };
    if (typeof level === 'number' && isFinite(level) && level >= 0) e.level = Math.floor(level);
    var p = evAllowed(name, evProps(props));
    if (!isEmpty(p)) e.p = p;
    if (!EV.on) {
      if (EV.early.length < 100) EV.early.push(e);
      return true;
    }
    EV.queue.push(e);
    if (EV.queue.length > EV_MAX_QUEUE) EV.queue.splice(0, EV.queue.length - EV_MAX_QUEUE);
    if (EV.building) return true;   // start(): saved and sent once the queue is assembled
    evSave();
    if (EV.queue.length >= EV_FLUSH_AT) evFlush();
    return true;
  }

  // UTF-8 size, a little over for characters outside the BMP — enough for the 64 KB keepalive cap
  function evBytes(s) {
    var n = s.length;
    for (var i = 0; i < s.length; i++) { var c = s.charCodeAt(i); if (c > 0x7f) n += c > 0x7ff ? 2 : 1; }
    return n;
  }

  // done(status, data) runs ONCE: on the answer, on a request that throws, or after 30 s
  // without an answer — the queue is never left waiting on a request that is gone.
  function evPost(body, done) {
    var finished = false;
    var timer = null;
    var end = function (status, data) {
      if (finished) return;
      finished = true;
      if (timer) safe(function () { clearTimeout(timer); });
      done(status, data);
    };
    // hs-check: never the real service — the batch counts as accepted (the checker reads the trace)
    if (root && root.__HS_CHECK__) { note('analytics:batch'); end(202, null); return; }
    timer = safe(function () { return setTimeout(function () { safe(function () { end(0, null); }); }, EV_POST_TIMEOUT_MS); }, null);
    var t = root && root.tt;
    if (t && typeof t.request === 'function') {
      var asked = safe(function () {
        t.request({
          url: EV.url, method: 'POST', data: body, header: { 'content-type': 'application/json' },
          success: function (r) { end(r && r.statusCode, r && r.data); },
          fail: function () { end(0, null); }
        });
        return true;
      }, false);
      if (!asked) end(0, null);
      return;
    }
    var f = root && root.fetch;
    if (typeof f !== 'function') { end(0, null); return; }
    var sent = safe(function () {
      // keepalive: a batch sent as the page hides still goes out (browsers cap it at 64 KB)
      f.call(root, EV.url, { method: 'POST', body: body, keepalive: evBytes(body) < 60000, headers: { 'content-type': 'application/json' } })
        .then(function (r) { return r.text().then(function (x) { end(r.status, x); }, function () { end(r.status, null); }); },
          function () { end(0, null); });
      return true;
    }, false);
    if (!sent) end(0, null);
  }

  function evFlush() {
    if (!EV.on || !EV.queue.length) return;
    // one request at a time; a flush asked meanwhile (a hide) runs as soon as it ends
    if (EV.sending) { EV.flushPending = true; return; }
    EV.sending = true;
    EV.flushPending = false;
    // the events of ONE session — the oldest one's — sent with that session
    var s0 = EV.queue[0].s || '';
    var batch = [];
    for (var i = 0; i < EV.queue.length && batch.length < EV_BATCH; i++) {
      if ((EV.queue[i].s || '') !== s0) break;
      batch.push(EV.queue[i]);
    }
    var more = EV.queue.length > batch.length;
    var now = Date.now();
    var body = safe(function () {
      if (!EV.device) EV.device = evDevice();   // once per session
      return JSON.stringify({
        hs_game_id: EV.gameId, platform: evPlatform(), store: evStore(), env: EV.env,
        app_version: String((nativeBridge() && nativeBridge().appVersion) || HSGame.appVersion || ''),
        kit: 'hs-game.js ' + VERSION,
        player: { src: 'install', id: evInstall() },
        device_id: evDeviceId(),
        device: EV.device,
        session: s0 || EV.session,
        events: batch.map(function (e) {
          var x = { id: e.id, name: e.name, age_ms: Math.max(0, now - e.t) };
          if (e.level !== undefined) x.level = e.level;
          if (e.p) x.p = e.p;
          return x;
        })
      });
    }, null);
    if (!body) { EV.sending = false; return; }
    evPost(body, function (status) {
      EV.sending = false;
      var again = EV.flushPending;
      EV.flushPending = false;
      // 202 accepted · 4xx (not 429) refused for good: drop it, it would never pass.
      // 0 / 429 / 5xx: kept, sent again later.
      if (status === 202 || (status >= 400 && status < 500 && status !== 429)) {
        if (status !== 202) log('analytics: batch refused (' + status + ') — dropped');
        var sent = {};
        for (var j = 0; j < batch.length; j++) sent[batch[j].id] = true;
        EV.queue = EV.queue.filter(function (e) { return !sent[e.id]; });
        evSaveNow();   // once per batch: a sent batch is not sent again after a restart
        if (more) again = true;   // the rest: more of this session, or the next session
      }
      if (again) evFlush();
    });
  }

  function evSessionStart() {
    var now = Date.now();
    EV.session = 's' + evHex(8);
    EV.sessionStart = now;
    EV.activeMs = 0;
    EV.visibleSince = now;
    EV.errors = {};
    EV.device = null;
    evPush('session_start');
    evPerf();
  }

  // The session's visible time so far (short trips away not counted).
  function evActiveMs() {
    return EV.activeMs + (EV.visibleSince ? Math.max(0, Date.now() - EV.visibleSince) : 0);
  }

  // The end of a session left in the background: its perf (if measured and not sent)
  // and ONE session_end — at the moment it was left, with its own session id.
  function evEndSession(rec) {
    EV.rec = null;
    storeSet(EV_SESSION_KEY, '');
    if (!rec || typeof rec !== 'object' || typeof rec.s !== 'string' || !/^s[0-9a-f]{16}$/.test(rec.s)) return;
    var at = typeof rec.at === 'number' && isFinite(rec.at) ? Math.min(rec.at, Date.now()) : Date.now();
    var pf = rec.perf;
    if (pf && typeof pf === 'object' && typeof pf.fps_avg === 'number') {
      evPush('perf', null, { fps_avg: pf.fps_avg, fps_p10: pf.fps_p10 }, at, rec.s);
      if (perf && perf.session === rec.s) perf.sent = true;
    }
    var active = Number(rec.active);
    evPush('session_end', null, { duration_s: Math.round((isFinite(active) && active > 0 ? active : 0) / 1000) }, at, rec.s);
  }

  function evRecLoad() {
    var raw = storeGet(EV_SESSION_KEY);
    return raw ? safe(function () { return JSON.parse(raw); }, null) : null;
  }

  // perf: frames per second over 20 visible seconds, from 5 s after the session starts, once
  // per session — the average and the slowest tenth (p10). Paused while the app is away or
  // the game is paused (an ad, a purchase sheet); a session that ends first sends what it
  // has (≥ 5 s) with its session_end. Own frame callback only while measuring.
  var EV_PERF_DELAY_MS = 5000;
  var EV_PERF_SECONDS = 20;
  var perf = null;   // { session, perSec, frames, secStart, running, sent }

  // What this session measured so far (null: not enough yet, or already sent).
  function evPerfSummary() {
    var p = perf;
    if (!p || p.sent || p.session !== EV.session || p.perSec.length < 5) return null;
    var sorted = p.perSec.slice().sort(function (a, b) { return a - b; });
    var sum = 0;
    for (var i = 0; i < p.perSec.length; i++) sum += p.perSec[i];
    return {
      fps_avg: Math.round(sum / p.perSec.length * 10) / 10,
      fps_p10: Math.round(sorted[Math.floor(sorted.length * 0.1)] * 10) / 10
    };
  }

  function evPerfSend() {
    var sum = evPerfSummary();
    if (!sum) return;
    perf.sent = true;
    evPush('perf', null, sum);
  }

  function evPerfStopped() {
    // (a timer may fire a few ms early: 50 ms of slack)
    return !!EV.hiddenAt || !isEmpty(pauseReasons) || Date.now() < EV.sessionStart + EV_PERF_DELAY_MS - 50;
  }

  function evPerfRun() {
    var raf = root && root.requestAnimationFrame;
    var p = perf;
    if (typeof raf !== 'function' || !p || p.sent || p.running || p.session !== EV.session || evPerfStopped()) return;
    p.running = true;
    p.frames = 0;
    p.secStart = Date.now();
    var tick = function () {
      // paused; resumes on show / when the game resumes
      if (p.sent || p.session !== EV.session || EV.hiddenAt || !isEmpty(pauseReasons)) { p.running = false; return; }
      p.frames++;
      var now = Date.now();
      if (now - p.secStart >= 1000) {
        // a second that spans a pause (a long gap) is not a frame rate
        if (now - p.secStart < 2000) p.perSec.push(p.frames * 1000 / (now - p.secStart));
        p.frames = 0; p.secStart = now;
      }
      if (p.perSec.length >= EV_PERF_SECONDS) { p.running = false; evPerfSend(); return; }
      safe(function () { raf.call(root, tick); });
    };
    safe(function () { raf.call(root, tick); });
  }

  function evPerf() {
    var session = EV.session;
    perf = { session: session, perSec: [], frames: 0, secStart: 0, running: false, sent: false };
    setTimeout(function () { if (EV.on && perf && perf.session === session) evPerfRun(); }, EV_PERF_DELAY_MS);
  }

  // error: an uncaught error of the game — its type and a short hash of the message, never the
  // text (it may hold player data). At most 5 per session, each kind once.
  function evHashText(s) {
    var h = 0;
    s = String(s || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16);
  }
  function evError(err, message, fallback) {
    if (!EV.on) return;
    // tt.onError gives text like "TypeError: …" — the type is its first word. err.name only
    // when it reads like an error class: a rejected object's .name may be a player's name.
    var named = /^([A-Za-z]*Error)\b/.exec(String(message || ''));
    var en = err && typeof err.name === 'string' && /(Error|Exception)$/.test(err.name) ? err.name : '';
    var type = String(en || (named && named[1]) || fallback || 'Error').replace(/[^A-Za-z0-9_]/g, '').slice(0, 32) || 'Error';
    var hash = evHashText(type + ':' + ((err && err.message) || message || ''));
    if (!EV.errors || EV.errors[hash] || Object.keys(EV.errors).length >= 5) return;
    EV.errors[hash] = 1;
    evPush('error', null, { type: type, hash: hash });
  }
  function evHookErrors() {
    var t = root && root.tt;
    if (t && typeof t.onError === 'function') {
      // tt.onError hands a message string (or { message, stack })
      safe(function () { t.onError(function (e) { evError(null, e && e.message ? e.message : e); }); });
      return;
    }
    if (root && typeof root.addEventListener === 'function') {
      safe(function () {
        root.addEventListener('error', function (ev) { evError(ev && ev.error, ev && ev.message); });
        root.addEventListener('unhandledrejection', function (ev) { evError(ev && ev.reason, 'unhandled rejection', 'UnhandledRejection'); });
      });
    }
  }

  // A hide does NOT end the session: a trip away under 30 s (an ad, a pay sheet) continues
  // it. Its visible time and what perf measured are kept on the device; the ONE session_end
  // goes on the next show after ≥ 30 s away, or at the next start() if the app was closed.
  function evOnHide() {
    if (!EV.on) return;
    if (!EV.hiddenAt) {
      var now = Date.now();
      EV.hiddenAt = now;
      if (EV.session) {
        EV.activeMs = evActiveMs();
        EV.visibleSince = 0;
        EV.rec = { s: EV.session, active: EV.activeMs, at: now, perf: evPerfSummary() };
        storeSet(EV_SESSION_KEY, safe(function () { return JSON.stringify(EV.rec); }, ''));
      }
    }
    evSaveNow();
    evFlush();
  }

  function evOnShow() {
    if (!EV.on || !EV.hiddenAt) return;
    var now = Date.now();
    var away = now - EV.hiddenAt;
    EV.hiddenAt = 0;
    if (away >= EV_NEW_SESSION_MS) {
      evEndSession(EV.rec || evRecLoad());
      evSessionStart();
    } else {
      // a short trip away continues the session, its visible time and its FPS sample
      EV.rec = null;
      storeSet(EV_SESSION_KEY, '');
      EV.visibleSince = now;
      evPerfRun();
    }
  }

  // test: debug builds, the browser preview, the SDK's test mode, or forced; else live.
  // Run again once the SDK is initialised (its test mode is known only then).
  function evEnv() {
    var cfg = EV.cfg || {};
    var testSdk = safe(function () { return !!(sdk && ready && sdk.isTestMode); }, false);
    EV.env = cfg.env === 'live' || cfg.env === 'test' ? cfg.env
      : (HSGame.debug || platformName() === 'browser' || testSdk) ? 'test' : 'live';
  }

  function evStart(opts, gameId) {
    var early = EV.early;
    EV.early = [];
    var a = opts.analytics;
    if (!a) return;
    if (!gameId) { log('analytics: no game id — off'); return; }
    var cfg = typeof a === 'object' ? a : {};
    EV.on = true;
    EV.gameId = gameId;
    EV.cfg = cfg;
    if (typeof cfg.endpoint === 'string' && /^https?:\/\//.test(cfg.endpoint)) EV.url = cfg.endpoint;
    evEnv();
    // The queue is assembled in full before anything can be sent: what is left from last
    // time, the end of the session the app was closed in, this session_start, then the
    // calls made before start() (they belong to this session).
    EV.building = true;
    try {
      evLoad();
      evEndSession(evRecLoad());
      evSessionStart();
      for (var i = 0; i < early.length; i++) { early[i].s = EV.session; EV.queue.push(early[i]); }
      if (EV.queue.length > EV_MAX_QUEUE) EV.queue.splice(0, EV.queue.length - EV_MAX_QUEUE);
    } finally {
      EV.building = false;
    }
    evSaveNow();
    // A full queue goes once start() is past the SDK's init (env decided), not before.
    if (EV.queue.length >= EV_FLUSH_AT) safe(function () { setTimeout(function () { safe(evFlush); }, 0); });
    EV.timer = setInterval(evFlush, EV_FLUSH_MS);
    evHookErrors();
    log('analytics on — ' + EV.env + ', device ' + evDeviceId() + ' (register it in the HS dashboard to test)');
    note('analytics:' + EV.env);
  }

  function evCurrency(flow, currency, amount, props) {
    return safe(function () {
      if (!currency || typeof amount !== 'number' || !isFinite(amount) || amount < 0) return false;
      var p = evProps(props); var lv = p.level; delete p.level;
      p.flow = flow; p.currency = String(currency).slice(0, 32); p.amount = Math.round(amount);
      return evPush('currency', lv, p);
    }, false);
  }

  function evAdShown(label, r) {
    if (!EV.on || !r || !r.success) return;
    var pl = safe(function () { return sdk.ads.getPlacement(label); }, null) || {};
    var kind = String(pl.type || pl.ad_type || pl.format || '').toLowerCase();
    var format = kind.indexOf('inter') >= 0 ? 'interstitial' : kind.indexOf('banner') >= 0 ? 'banner' : 'rewarded';
    evPush('ad_shown', null, { place: label, format: format });
  }

  // A purchase credited — a TikTok order or a Google Play / App Store purchase. Its price:
  // the store's micros, else the TikTok beans (currency BEANS), else 0. 'XXX' (ISO: no
  // currency) when the currency is unknown — the server needs one.
  function evPurchase(productId, product) {
    if (!EV.on) return;
    var p = EV.products[productId] || product || {};
    var num = function (v) { return typeof v === 'number' && isFinite(v) && v >= 0; };
    var micros = 0, cur = '';
    if (num(p.price_micros)) micros = p.price_micros;
    else if (num(p.price_amount_micros)) micros = p.price_amount_micros;
    // beans are the TikTok price: only for a TikTok order, never for a Google / Apple one
    // (that is unknown → 0 'XXX', rather than a wrong amount in the revenue reports)
    else if (platformName() !== 'android' && num(p.beans_cost)) { micros = p.beans_cost * 1e6; cur = 'BEANS'; }
    else if (num(p.price)) micros = p.price * 1e6;
    if (!cur) cur = String(p.currency || p.price_currency_code || '').replace(/[^A-Za-z]/g, '').slice(0, 8).toUpperCase();
    evPush('purchase', null, { product: String(productId), price_micros: Math.round(micros), currency: cur || 'XXX' });
  }

  var HSGame = {
    version: VERSION,
    debug: false,
    /** Why the last showAd() gave null: 'not configured', 'skipped', 'busy', or TikTok's message. */
    lastAdError: '',
    /** Why the last share() gave null: 'unsupported', 'claimed' (shared, reward already taken), or TikTok's message. */
    lastShareError: '',

    get ready() { return ready; },
    get loggedIn() { return !!(sdk && ready && sdk.isAuthenticated); },
    get openId() { return sdk && ready ? sdk.openId : null; },
    /** The raw HSTikTokSDK, for anything this file does not wrap. */
    get sdk() { return ready ? sdk : null; },
    get trace() { return trace.slice(); },
    /** The defaults passed to start() — read by hs-check. */
    get defaults() { return copy(defaults); },
    /** True when rewards have somewhere to go: an onGive, or a profile to credit. */
    get canGive() { return !!giveCb || !!P; },
    /** 'minis' (TikTok) | 'android' (the HS app — Android or iOS) | 'browser' (development). For logs — build UI with has(). */
    get platform() { return platformName(); },
    /** True between 'pause' and 'resume' (an ad, a purchase, a share sheet, the app away). */
    get paused() { return !isEmpty(pauseReasons); },

    /**
     * Is this feature on HERE, right now? Show its button / popup only when
     * true, and ask every time you draw (it changes after start() resolves):
     *   'tiktok_missions' — Entry Reward (profile) + Launch Reward (home screen). TikTok only.
     *   'share'           — a share button
     *   'ads'             — any ad button (then canShowAd(place) per button)
     *   'shop'            — the shop button (products exist and this platform can sell)
     *   'restore'         — a "Restore purchases" link in the shop → HSGame.restore()
     *                       (the iOS app, when a one-time product is on sale: Apple requires it)
     *   'cloud'           — "your progress is saved to your account" (login works here)
     *   'exit'            — a "Quit" button (tt.exitMiniProgram) — never on iOS
     * The dashboard can switch any of them off: iaa_config "features": { "share": false }.
     */
    has: function (feature) {
      feature = String(feature || '');
      noteOnce('has:' + feature);
      if (featureOff(feature)) return false;
      switch (feature) {
        case 'tiktok_missions':
          return platformName() === 'minis' && (HSGame.tiktokMission.supported('profile') || HSGame.tiktokMission.supported('shortcut'));
        case 'share': return HSGame.canShare();
        case 'ads': return anyAdPlace();
        case 'shop':
          // The products could not be read (offline at start): ask again, at most once a minute.
          if (storeOpen() && !shopKnown && Date.now() - shopTriedAt > 60000) HSGame.shop();
          return storeOpen() && shopCount > 0;
        case 'restore':
          if (!storeOpen() || featureOff('shop') || !billing() || !isIos()) return false;
          if (!shopKnown && Date.now() - shopTriedAt > 60000) HSGame.shop();
          return storePermanent;
        case 'cloud': return loginPossible();
        // A "Quit" button: Apple rejects an iOS app that closes itself.
        case 'exit': return !isIos() && !!(root && root.tt && typeof root.tt.exitMiniProgram === 'function');
      }
      return false;
    },

    /**
     * hs-check only (inert unless the checker set __HS_CHECK__): would onGive
     * accept this key's reward? Hands the items over without recording a claim.
     */
    _probe: function (key) {
      if (!(root && root.__HS_CHECK__)) return null;
      var e = entry(String(key || ''));
      if (!e || isEmpty(e.items)) return { empty: true };
      return { items: copy(e.items), given: give(e.items, 'hs-check:' + key) };
    },

    /**
     * Start everything. Call once at startup. Resolves { loggedIn, reason };
     * never rejects. Rewards work from `defaults` even before (and without) login.
     */
    start: function (opts) {
      opts = opts || {};
      note('start');
      if (started) return Promise.resolve({ loggedIn: HSGame.loggedIn, reason: 'already started' });
      started = true;
      HSGame.debug = !!opts.debug;
      if (typeof opts.onGive === 'function') giveCb = opts.onGive;
      if (typeof opts.onLoad === 'function') loadCb = opts.onLoad;
      var d = opts.defaults || {};
      defaults = {
        rewards: d.rewards && typeof d.rewards === 'object' ? copy(d.rewards) : {},
        items: d.items && typeof d.items === 'object' ? copy(d.items) : {}
      };
      if (!giveCb && !P) log('start() without onGive or a profile — nothing can be given');
      hookShow();

      // Each platform is its own HS game: the Android app's build injects that
      // game's credentials, which win over the TikTok ones written in game.js.
      // In the app, ONLY the injected pair: falling back to game.js would talk
      // to the TikTok game (its ad ids, its players), and a half-injected pair
      // would sign every request with the wrong key.
      var nb = nativeBridge();
      var check = root && root.__HS_CHECK__;   // stand-in credentials for hs-check only
      var gameId, sdkKey;
      if (nb) {
        var injected = (nb.config && typeof nb.config === 'object') ? nb.config : {};
        gameId = String(injected.gameId || '');
        sdkKey = String(injected.sdkKey || '');
        if (!gameId || !sdkKey) gameId = sdkKey = '';   // → offline below, with its own reason
      } else {
        // hs-check runs against its own fake backend: its stand-ins win over
        // whatever is in game.js (empty, a placeholder, or the real pair).
        gameId = String((check && check.gameId) || opts.gameId || '');
        sdkKey = String((check && check.sdkKey) || opts.sdkKey || '');
      }

      // Analytics needs only the game id — it runs offline, without the SDK or a login.
      if (typeof opts.appVersion === 'string') HSGame.appVersion = opts.appVersion.slice(0, 32);
      safe(function () { evStart(opts, gameId); });

      var offline = function (reason) { loginDone = true; checkMissions(); return Promise.resolve({ loggedIn: false, reason: reason }); };
      if (!sdk) return offline(loadError || 'SDK not loaded');
      if (!gameId || !sdkKey) return offline(nb ? 'the app was built without its HS game credentials' : 'gameId / sdkKey not set');

      var ok = safe(function () {
        // single: one active device per account. When another device logs in,
        // the SDK stops instead of logging in again (which would knock that
        // device out in turn); the game hears it as otherDevice.
        if (!sdk.init({ gameId: gameId, sdkKey: sdkKey, enableDebugLogs: HSGame.debug, sessionReplaced: 'report' })) return false;
        sdk.registerSyncProvider(cloud);
        sdk.registerRewardHandler({ onOrderRewardsDelivered: onOrder });
        // The cloud is settled by a SUCCESSFUL login only — the startup one or
        // a later one (a buy() after a failed start). The SDK hands the cloud
        // copy over right after this event, so settle on the next tick. A failed
        // login settles nothing: a fresh install must not upload its empty
        // state, and the real cloud copy must still be read when login works.
        sdk.on('loginSuccess', function (profileJson, serverTs) {
          // The login's server time corrects a clock that is BEHIND, before the
          // first sync does: a change stamped too early loses a 'latest' merge
          // it should win. Only forward: by contract it is the time of the last
          // cloud write, which may be old (the HS backend sends "now").
          if (serverTs > 0 && serverTs * 1000 > Date.now() + clockOffset) clockOffset = serverTs * 1000 - Date.now();
          if (serverTs > 0) baseTs = serverTs;
          if (!P) {
            var id = String(sdk.openId || '');
            if (id && id !== saveOwner) {
              cloudOrders = {};
              if (decided && !profileJson) {
                // 3.0: signed in to an account with no cloud copy of its own
                // (a first Google sign-in in the Android app): this phone's
                // progress — and the orders / purchases in it — becomes that
                // account's, and goes up.
                saveOwner = id;
                writeSave(true);
                cloudDirty = true;
              } else {
                // Another account with its own copy (or the session's first
                // login): its copy and cloud copy, never the previous lists.
                if (decided && cloudSettled) acceptNextCloud = true;
                decided = false;
                orders0 = []; ordersNew = []; gpNew = [];
                saveOwner = id;
              }
            }
            if (id) storeSet(SAVE_KEY + '.last', id);
            // No cloud copy at all: this phone's own copy (if any) is the account's.
            if (!profileJson && (!decided || takingOver)) decideWithoutCloud();
            // A copy not in the cloud yet (also one played offline earlier this
            // session) goes up within a second, not at the 10 s tick.
            var unsent = readSave();
            if (!profileJson && unsent && unsent.dirty) { cloudDirty = true; syncSoon(); }
          }
          var switched = onAccount(sdk.openId);   // a different account → its own profile
          if (switched) cloudOrders = {};         // that account's cloud copy says which orders it holds
          // The cloud copy (if any) is handed over synchronously right after
          // this event; past that, nothing more to accept from this login.
          setTimeout(function () {
            acceptNextCloud = false;
            // A cloud copy that could not be read: chosen as if there were none —
            // this phone's own copy, not the game's state at boot (maybe defaults).
            if (!P && !decided) decideWithoutCloud();
            // An account with no cloud copy never reached the merge: its device
            // copy is the account's state now, not a "fresh install" any more…
            if (P) { P.joining = false; if (!conflict) P.fresh = false; }
            settleCloud();
            // …and it goes up, even if nothing changes after the switch.
            if (switched && cloudWanted()) cloud.isDirtyForCloud = true;
            flushGoogleReports();               // purchases made before this session had one
            if (recoverWanted) recoverGoogle(); // it waited for this cloud copy
          }, 0);
        });
        // The server's time of each cloud save corrects this phone's clock, so
        // a wrong clock cannot win a 'latest' merge.
        sdk.on('syncSuccess', function (serverTs) {
          if (serverTs > 0) clockOffset = serverTs * 1000 - Date.now();
        });
        sdk.on('sessionReplaced', function () {
          note('otherDevice');
          cloud.isDirtyForCloud = false;
          kitEmit('otherDevice');
        });
        // The HS app: start its ad provider with the units of every new ad config.
        sdk.on('initCompleted', initNativeAds);
        return true;
      }, false);
      if (!ok) return offline('init failed — check gameId / sdkKey');
      ready = true;
      if (EV.on) safe(evEnv);   // analytics: the SDK's test mode is known now, before the first batch

      var finish = function (r) {
        if (r.loggedIn) settleCloud();
        loginDone = true;
        checkMissions();
        // Products are known when start() resolves, so has('shop') is right
        // from the first frame of the menu. Android: Google purchases left
        // unfinished (a crash) are credited now, and queued reports sent.
        var products = storeOpen() ? HSGame.shop() : null;
        return Promise.resolve(products)
          .then(function () { return billing() ? recoverGoogle() : null; })
          .then(function () { flushGoogleReports(); return r; }, function () { return r; });
      };
      // No login (none on this platform, or it failed): the dashboard's ad
      // places, rewards and features still come — they need no account.
      var withoutLogin = function (r) {
        decideOffline();             // 3.0: saves from here on are kept for the last account
        var loading = safe(function () { return sdk.ads.loadRemoteConfig(); }, null);
        return Promise.resolve(loading).then(null, function () {}).then(function () { return finish(r); });
      };
      if (!loginPossible()) return withoutLogin({ loggedIn: false, reason: 'no login on this platform' });
      return sdk.auth.login().then(function (r) {
        if (!r.success) log('login failed: ' + r.failure + ' ' + (r.error || ''));
        var res = { loggedIn: !!r.success, reason: r.success ? '' : (r.failure + ': ' + (r.error || '')) };
        return r.success ? finish(res) : withoutLogin(res);
      }, function (e) {
        return withoutLogin({ loggedIn: false, reason: String(e && e.message || e) });
      });
    },

    // ─── Rewards ─────────────────────────────────────────────

    /**
     * A game moment completed (a mission, a quest, a daily gift, a level
     * bonus…). Its reward — the dashboard's, else the default — goes to
     * onGive. Returns the items given (to show a message), or null: not
     * configured, nothing in it, already claimed (once / today), or onGive threw.
     */
    claim: function (key) {
      key = String(key || '');
      note('claim:' + key);
      if (has(TIKTOK_KEYS, key)) { log('claim("' + key + '") refused — TikTok missions pay themselves when TikTok confirms'); return null; }
      // An ad place's reward is paid by showAd, the share reward by share():
      // claiming them here would pay without the ad / share, or pay twice.
      if (isAdPlace(key) || has(shareKeys, key)) { log('claim("' + key + '") refused — it is paid by ' + (has(shareKeys, key) ? 'share()' : 'showAd()')); return null; }
      // Before login lands, the cloud's claim record (a reinstall) and the
      // dashboard's values are not here yet — a "once" could pay twice.
      if (ready && !loginDone) { log('claim("' + key + '") refused — call it after HSGame.start() resolves'); return null; }
      return payout(key);
    },

    /** The items a key would give — for labels like "Reward: 2 hints". Null when it gives nothing. */
    rewards: function (key) {
      noteOnce('rewards:' + key);
      var e = entry(String(key || ''));
      return e && !isEmpty(e.items) ? copy(e.items) : null;
    },

    /** True when claim(key) would give something now — for "!" badges and enabled buttons. */
    available: function (key) {
      key = String(key || '');
      noteOnce('available:' + key);
      var e = entry(key);
      if (!e || isEmpty(e.items)) return false;
      if (ready && !loginDone) return false;
      if (has(TIKTOK_KEYS, key)) return HSGame.tiktokMission.supported(TIKTOK_KEYS[key]) && !missionGiven[TIKTOK_KEYS[key]] && !isClaimed(key, e.limit);
      return !isClaimed(key, e.limit);
    },

    /** The item catalog entry: { category, name, icon, ... } — dashboard over defaults. */
    item: function (id) { var c = catalog(); return has(c, id) ? copy(c[id]) : null; },
    /** Every item: { id: { category, name, ... } }. */
    items: function () { return copy(catalog()); },

    // ─── Ads ─────────────────────────────────────────────────

    /** True when an ad is set up for this place right now — show / hide the button with it, every time it is drawn. */
    canShowAd: function (label) {
      noteOnce('canShowAd:' + label);
      adLabels[label] = true;
      if (adBusySince && Date.now() - adBusySince < adStaleMs()) return false;
      if (rewardUsedUp(label)) return false;   // a once / daily ad reward already taken: do not offer the ad
      return !featureOff('ads') && adConfigured(label);
    },

    /**
     * Show the ad set up for this place in the dashboard. Resolves:
     *   null — no ad here (not configured, cooling down, no fill), or closed early
     *   {}   — the ad completed and this place gives no reward (e.g. interstitial)
     *   { hint: 1 } — completed, and the reward went to onGive
     * The game never needs to know whether the place is rewarded or interstitial.
     */
    showAd: function (label) {
      label = String(label || '');
      note('showAd:' + label);
      adLabels[label] = true;
      HSGame.lastAdError = '';
      if (adBusySince && Date.now() - adBusySince < adStaleMs()) { HSGame.lastAdError = 'busy'; return Promise.resolve(null); }
      if (!sdk || !ready || featureOff('ads')) { HSGame.lastAdError = 'not configured'; return Promise.resolve(null); }
      // Never make a player watch an ad whose reward they already took.
      if (rewardUsedUp(label)) { HSGame.lastAdError = 'claimed'; return Promise.resolve(null); }

      // This call owns the ad slot until it ends; a stale call that answers
      // late can never unfreeze or unlatch a newer one.
      var token = ++adToken;
      adBusySince = Date.now();
      var endAd = function () { if (token !== adToken) return; adBusySince = 0; resumeFrom('ad'); };

      // No config yet (no login): fetch it BEFORE freezing the game, so a dead
      // connection or a place with no ad never pauses anything.
      var loaded = safe(function () { return sdk.ads.isConfigLoaded; }, false);
      var asked = Date.now();
      var config = loaded ? Promise.resolve() : Promise.resolve(safe(function () { return sdk.ads.loadRemoteConfig(); }, null)).then(null, function () {});
      return config.then(function () {
        // A config that came too late (or after this call went stale) must not
        // start an ad: it would appear long after the tap.
        if (token !== adToken) return null;
        if (Date.now() - asked > AD_TAP_MS) { HSGame.lastAdError = 'not ready'; endAd(); return null; }
        if (!adConfigured(label)) {
          HSGame.lastAdError = safe(function () { return sdk.ads.getPlacement(label); }, null) ? 'cooling down' : 'not configured';
          endAd();
          return null;
        }
        pauseFor('ad');
        return new Promise(function (resolve) {
          var settled = false;
          var timer = setTimeout(function () {
            if (settled) return;
            settled = true;
            HSGame.lastAdError = 'timeout';
            endAd();
            resolve(null);
          }, adStaleMs());
          var showing;
          try { showing = Promise.resolve(sdk.ads.showAdsRemote(label)); } catch (e) { showing = Promise.reject(e); }
          showing.then(function (r) {
            var late = settled;
            settled = true;
            clearTimeout(timer);
            endAd();
            evAdShown(label, r);
            var out = adOutcome(label, r);
            // A late answer still pays an ad that was watched — the reward goes
            // to the profile / onGive; only the promise already said null.
            if (!late) resolve(out);
          }, function (e) {
            var late = settled;
            settled = true;
            clearTimeout(timer);
            endAd();
            if (late) return;
            HSGame.lastAdError = String(e && e.message || e);
            resolve(null);
          });
        });
      });
    },

    // ─── Share ───────────────────────────────────────────────

    /** True when sharing works here: TikTok 40.3.0+, or the Android app's share sheet. */
    canShare: function () {
      if (featureOff('share')) return false;
      var nb = nativeBridge();
      return nb ? typeof nb.share === 'function' : !!tiktok('shareAppMessage');
    },

    /**
     * Open the share sheet (TikTok's, or Android's in the app): opts { title,
     * subtitle, imageUrl, templateType }. Resolves like showAd:
     *   null        — not shared (cancelled, unsupported — see lastShareError)
     *   {}          — shared; this key gives nothing here (none set, or today's taken)
     *   { hint: 3 } — shared, and the reward of `key` (default "share", once a day) was given
     * A shared result (not null) can also complete the game's own tasks:
     *   HSGame.share({...}).then(function (r) { if (r) { shares++; if (shares === 3) HSGame.claim('quest_share_3'); } });
     */
    share: function (opts, key) {
      key = String(key || 'share');
      note('share:' + key);
      shareKeys[key] = true;
      HSGame.lastShareError = '';
      if (featureOff('share')) { HSGame.lastShareError = 'unsupported'; return Promise.resolve(null); }
      // Before login lands a reinstall's claims are not back yet — a daily
      // share could pay twice. And one sheet at a time.
      if (ready && !loginDone) { HSGame.lastShareError = 'not ready'; return Promise.resolve(null); }
      if (shareBusy) { HSGame.lastShareError = 'busy'; return Promise.resolve(null); }
      shareBusy = true;
      pauseFor('share');
      // The player picks friends in TikTok's sheet: give it time, but not forever.
      var sharing = nativeBridge() ? shareNative(opts || {}) : callTikTok('shareAppMessage', opts || {}, 120000);
      return sharing.then(function (r) {
        shareBusy = false;
        resumeFrom('share');
        if (!r.ok) { HSGame.lastShareError = r.err; return null; }
        // Shared. Like showAd: {} = done, nothing given here (no reward for this
        // key on this platform, or today's is taken) — the game can still count
        // it toward its own tasks and claim('its_task_key').
        var e = entry(key);
        if (!e || isEmpty(e.items)) return {};
        var items = payout(key);
        if (!items) { HSGame.lastShareError = isClaimed(key, e.limit) ? 'claimed' : 'not given'; return {}; }
        return items;
      });
    },

    // ─── TikTok missions ─────────────────────────────────────

    tiktokMission: {
      /** "shortcut" (add to home screen) or "profile" (visit from the TikTok profile). */
      supported: function (kind) { var m = MISSIONS[kind]; return !!(m && !featureOff('tiktok_missions') && tiktok(m.start)); },
      /** Already rewarded — remove the "!" badge. */
      done: function (kind) {
        var key = 'tiktok_' + kind;
        var e = entry(key);
        return !!missionGiven[kind] || isClaimed(key, e ? e.limit : 'once');
      },
      /** Button tap: send the player to do it. Resolves 'started' | 'unsupported' | 'failed'. */
      start: function (kind) {
        note('tiktokMission:' + kind);
        var m = MISSIONS[kind];
        if (!m) return Promise.resolve('unsupported');
        return callTikTok(m.start, null, 120000).then(function (r) {
          if (r.ok) { missionStarted[kind] = true; checkMissions(); }
          return r.ok ? 'started' : (r.err === 'unsupported' ? 'unsupported' : 'failed');
        });
      },
      /** Ask TikTok now (also done after login and on every return to the app). */
      refresh: function () { return checkMissions(); }
    },

    // ─── Shop ────────────────────────────────────────────────

    /**
     * Products from the HS dashboard: [{ product_id, name, description,
     * beans_cost, items: { hint: 15 }, ...display fields (icon, badge…) }].
     * Works before login.
     */
    shop: function () {
      note('shop');
      if (!storeOpen() || featureOff('shop')) return Promise.resolve([]);
      shopTriedAt = Date.now();
      if (billing()) {
        // Android: products on sale in BOTH the HS dashboard and Google Play,
        // with Google's local price.
        return loadGoogleProducts().then(function (list) {
          shopKnown = true;
          shopCount = list.length;
          for (var i = 0; i < list.length; i++) if (list[i] && list[i].product_id) EV.products[list[i].product_id] = list[i];
          if (recoverWanted) recoverGoogle();     // start-up was offline: recover now
          return list;
        }, function () { return []; });
      }
      return sdk.iap.getShopItems().then(function (r) {
        if (!r.success) return [];
        shopKnown = true;
        var list = (r.data || []).map(function (p) {
          var out = {};
          for (var k in p) if (has(p, k) && k !== 'rewards') out[k] = p[k];
          out.items = toItems(p.rewards);
          if (out.product_id) EV.products[out.product_id] = out;   // its price, for the purchase event
          return out;
        });
        shopCount = list.length;
        return list;
      }, function () { return []; });
    },

    /**
     * Buy a product. Resolves { ok, error, delivered }. The items arrive in
     * onGive — never give them here. ok + !delivered: paid, but this build
     * could not give it (unknown item, onGive threw) — it is kept and comes
     * back at the next start; tell the player it is on its way.
     */
    buy: function (productId) {
      note('buy');
      if (!storeOpen() || featureOff('shop')) return Promise.resolve({ ok: false, error: 'Store unavailable', delivered: false });
      if (billing()) return buyGoogle(productId);
      lastBuyGiven = null;
      // Frozen while the pay sheet is up — not during the settlement polling
      // after it closed, and never longer than BUY_PAUSE_MAX_MS.
      pauseFor('buy');
      var unpause = function () { clearTimeout(cap); safe(function () { offClosed(); }); resumeFrom('buy'); };
      var cap = setTimeout(unpause, BUY_PAUSE_MAX_MS);
      var offClosed = safe(function () { return sdk.on('paymentUiClosed', unpause); }, null) || function () {};
      var buying;
      try { buying = Promise.resolve(sdk.iap.buyProduct(String(productId))); } catch (e) { buying = Promise.reject(e); }
      return buying.then(
        function (r) {
          unpause();
          var ok = !!(r && r.success);
          // Login recovery handed this very order over while it was being
          // polled: the items DID arrive (through onGive / the profile).
          if (!ok && r && /already delivered/i.test(String(r.error || ''))) return { ok: true, error: '', delivered: true };
          return { ok: ok, error: ok ? '' : ((r && r.error) || 'Purchase failed'), delivered: ok && lastBuyGiven !== false };
        },
        function (e) { unpause(); return { ok: false, error: String(e && e.message || e), delivered: false }; }
      );
    },

    /**
     * "Restore purchases" — the link has('restore') asks for. Asks the app's
     * store what this account owns and credits what this phone lacks (through
     * the profile / onGive, like a purchase). Resolves { ok, error, restored,
     * owned }: product ids credited now · all owned ones (a recovery at the
     * app's return may have credited them first: say "restored" for owned).
     */
    restore: function () {
      note('restore');
      var fail = function (error) { return { ok: false, error: error, restored: [], owned: [] }; };
      if (!storeOpen() || featureOff('shop') || !billing()) return Promise.resolve(fail('Store unavailable'));
      if (buyingGoogle) return Promise.resolve(fail('A purchase is already open'));
      // A fresh product list: one added since the start is restored too.
      return loadGoogleProducts().then(function () { return recoverGoogle(); }).then(function (r) {
        if (!r) return fail(googleLoaded ? 'Not ready yet — try again in a moment' : 'Store unavailable');
        return { ok: true, error: '', restored: r.restored, owned: r.owned };
      }, function (e) { return fail(String(e && e.message || e)); });
    },

    // ─── Cloud save ──────────────────────────────────────────

    // ─── Profile (3.1) ───────────────────────────────────────

    /**
     * The game's progress, owned by the kit. Call once, BEFORE start():
     *
     *   var profile = HSGame.profile({ level: 0, coins: 0, hint: 3, sound: true }, {
     *     save: 'cloud',               // 'local' = this device only · 'cloud' = device + cloud (default)
     *     local: ['sound'],            // fields that stay on this device
     *     merge: { level: 'max' },     // 'max' | 'min' for values that only move one way; default 'latest'
     *     version: 1, migrate: function (old, fromVersion) { return old; }   // when the layout changes
     *   });
     *   profile.get('coins'); profile.add('coins', 50); profile.set('level', 4); profile.update({...});
     *   profile.on('coins', function (now, before) { redraw(); });   // or '*' for every change
     *
     * Rewards whose item is a number field here (coins, hint…) are credited to
     * it by the kit — onGive is then only needed for other items.
     */
    profile: function (defs, opts) {
      if (P) return P.api;
      opts = opts || {};
      note('profile');
      var local = {};
      (opts.local || []).forEach(function (f) { local[f] = true; });
      P = {
        defs: copy(defs || {}),
        mode: opts.save === 'local' ? 'local' : 'cloud',
        local: local,
        rules: opts.merge && typeof opts.merge === 'object' ? copy(opts.merge) : {},
        version: opts.version | 0,
        summary: typeof opts.summary === 'string' ? opts.summary : '',
        migrate: typeof opts.migrate === 'function' ? opts.migrate : null,
        listeners: {},
        timer: null
      };
      // In cloud mode the device copy belongs to an account; before login the
      // last account that played here is assumed (corrected at login).
      loadProfile(P.mode === 'cloud' ? storeGet(PROFILE_KEY + '.last') : '');
      // Up to 3.1 claims were one record per device. It belongs to the account
      // that played here last — the one just loaded — so it moves to that account.
      if (P.owner && !storeGet(claimsKey())) {
        var legacy = storeGet(CLAIMS_KEY);
        if (legacy) storeSet(claimsKey(), legacy);
      }
      var api = {
        get: function (f) { return copy(P.data[f]); },
        all: function () { return copy(P.data); },
        set: function (f, v) { var c = {}; c[f] = v; applyChanges(c, 'game'); },
        add: function (f, n) { var c = {}; c[f] = (Number(P.data[f]) || 0) + (Number(n) || 0); applyChanges(c, 'game'); },
        update: function (obj) { if (obj && typeof obj === 'object') applyChanges(copy(obj), 'game'); },
        on: function (f, cb) {
          if (typeof cb !== 'function') return function () {};
          (P.listeners[f] = P.listeners[f] || []).push(cb);
          return function () { var l = P.listeners[f] || []; var i = l.indexOf(cb); if (i >= 0) l.splice(i, 1); };
        },
        /** Write to the device now (the kit also does it on a short timer and when the app hides). */
        flush: function () { writeProfileNow(); }
      };
      P.api = api;
      return api;
    },

    /**
     * Kit events: 'otherDevice' (this account was opened on another device —
     * show "Playing on another device · Play here" and call takeOver()), and
     * 'given' (items, from) after any reward, for a "+2 hints" message,
     * 'pause' (reason) / 'resume' — an ad, a purchase or the app going away:
     * mute the music and freeze the game until 'resume'. Fired once per pause
     * however many reasons overlap,
     * 'accountConflict' (info, choose) — a guest who made progress logged in
     * to an account with its own: info { field, device, account }; call
     * choose('account' | 'device') once. Without a listener the kit asks with
     * the system popup. 'accountChosen' (which) after either.
     * Returns an unsubscribe function.
     */
    on: function (name, cb) {
      if (typeof cb !== 'function') return function () {};
      (kitListeners[name] = kitListeners[name] || []).push(cb);
      // Subscribed while already paused: hear that pause, so the 'resume'
      // that follows is not an unmatched one.
      if (name === 'pause' && !isEmpty(pauseReasons)) {
        var why = Object.keys(pauseReasons)[0];
        setTimeout(function () { if (!isEmpty(pauseReasons)) safe(function () { cb(why); }); }, 0);
      }
      return function () { var l = kitListeners[name] || []; var i = l.indexOf(cb); if (i >= 0) l.splice(i, 1); };
    },

    /** True when another device took this account over (until takeOver()). */
    get otherDevice() { return !!(sdk && ready && sdk.isSessionReplaced); },

    // ─── Analytics (start({ analytics: true })) ─────────────
    // Sessions, ads, purchases and the device profile are sent by the kit itself.
    // Each call below returns true when the event was queued (false: analytics off
    // or a bad argument). Never throws.

    analytics: {
      /** Analytics is on (start() was given analytics: true and a game id). */
      get on() { return EV.on; },
      /** 'test' or 'live'. Debug builds and the browser preview are test. */
      get env() { return EV.env; },
      /** This install's id for the HS dashboard (Analytics Setup → Test devices), e.g. hsd-7K2Q9F3A. */
      get deviceId() { return safe(evDeviceId, ''); },
      /** Events waiting to be sent. */
      get queued() { return EV.queue.length; },
      /** Send what is queued now (also happens every 10 s and when the app hides). */
      flush: function () { safe(evFlush); }
    },

    level: {
      /** A level begins. level: its number (1, 2, …). */
      start: function (level, props) {
        return safe(function () { return typeof level === 'number' && evPush('level_start', level, props); }, false);
      },
      /**
       * A level ends. result: 'win' | 'lose' | 'quit' (a restart is 'quit', reason 'restart').
       * props: score, duration_s, reason, moves (made this attempt), and — only a game with a
       * move / time limit — moves_left, time_left.
       */
      end: function (level, result, props) {
        return safe(function () {
          if (typeof level !== 'number' || ['win', 'lose', 'quit'].indexOf(result) < 0) { log('level.end(level, "win" | "lose" | "quit")'); return false; }
          var p = evProps(props); delete p.level; p.result = result;
          return evPush('level_end', level, p);
        }, false);
      }
    },

    economy: {
      /** Soft currency given to the player. props: item_type, item_id, placement, balance, level. */
      earn: function (currency, amount, props) { return evCurrency('given', currency, amount, props); },
      /** Soft currency taken (spent). props: item_type, item_id, placement, balance, level. */
      spend: function (currency, amount, props) { return evCurrency('taken', currency, amount, props); }
    },

    /** A booster / revive / undo used. props: level, paid (bought with currency). */
    powerUp: function (name, props) {
      return safe(function () {
        if (!name) return false;
        var p = evProps(props); var lv = p.level; delete p.level; p.name = String(name).slice(0, 64);
        return evPush('power_up', lv, p);
      }, false);
    },

    /** A tutorial / mission step done. props: level. */
    missionStep: function (name, props) {
      return safe(function () {
        if (!name) return false;
        var p = evProps(props); var lv = p.level; delete p.level; p.name = String(name).slice(0, 64);
        return evPush('mission_step', lv, p);
      }, false);
    },

    /** The same as missionStep, as docs/EVENTS.md writes it: HSGame.mission.step(name, { level }). */
    mission: {
      step: function (name, props) { return safe(function () { return HSGame.missionStep(name, props); }, false); }
    },

    /** A screen or button that matters: ui('open', 'shop'), ui('tap', 'settings', { location: 'home' }). */
    ui: function (action, name, props) {
      return safe(function () {
        if (!action || !name) return false;
        var p = evProps(props); delete p.level; p.action = String(action).slice(0, 32); p.name = String(name).slice(0, 64);
        return evPush('ui', null, p);
      }, false);
    },

    /**
     * A custom event — stored ONLY if its name is registered for this game in the
     * HS dashboard (Analytics Setup → Custom events), with the values registered
     * there. props.level is the level if the event has one.
     */
    track: function (name, props) {
      return safe(function () {
        name = String(name || '');
        if (!EV_NAME_RE.test(name) || has(EV_TEMPLATE, name)) { log('track("' + name + '"): snake_case, not a built-in event name'); return false; }
        var p = evProps(props); var lv = p.level; delete p.level;
        // at most 5 values besides the name (docs/EVENTS.md)
        var kept = 0;
        for (var k in p) { if (has(p, k) && ++kept > 5) delete p[k]; }
        p.name = name;
        return evPush('custom', lv, p);
      }, false);
    },

    /**
     * True while a "Sign in" button makes sense: a guest, or (Android app) a
     * device account that can still sign in to Google Play Games.
     */
    get canSignIn() {
      if (!sdk || !ready || !loginPossible() || featureOff('cloud')) return false;
      if (!HSGame.loggedIn) return true;
      var nb = nativeBridge();
      return !!(nb && typeof nb.login === 'function' && onDeviceAccount());
    },

    /**
     * The "Sign in to save your progress" button: show it only while
     * HSGame.canSignIn. Start-up already tried a silent sign-in; this one may
     * show the platform's sign-in screen (Google Play Games in the Android
     * app). The guest's — or the device account's — progress joins the account,
     * or the player chooses (accountConflict) when the account has its own.
     * Resolves { loggedIn, reason }; never rejects.
     */
    login: function () {
      note('login');
      if (!sdk || !ready) return Promise.resolve({ loggedIn: false, reason: 'SDK not started' });
      if (HSGame.loggedIn && !HSGame.canSignIn) return Promise.resolve({ loggedIn: true, reason: '' });
      if (!loginPossible()) return Promise.resolve({ loggedIn: false, reason: 'no sign-in on this platform' });
      return Promise.resolve(safe(function () { return sdk.auth.login({ interactive: true }); }, null)).then(function (r) {
        var ok = !!(r && r.success);
        return { loggedIn: ok, reason: ok ? '' : ((r && (r.failure + ': ' + (r.error || ''))) || 'sign-in failed') };
      }, function (e) {
        return { loggedIn: false, reason: String(e && e.message || e) };
      });
    },

    /**
     * "Play here": log in again on this device, pull the cloud copy and merge
     * this device's own progress into it, and become the active device. The
     * other device gets otherDevice in turn. Resolves { loggedIn, reason }.
     */
    takeOver: function () {
      note('takeOver');
      if (!sdk || !ready) return Promise.resolve({ loggedIn: false, reason: 'SDK not started' });
      takingOver = true;
      return sdk.auth.login().then(function (r) {
        takingOver = false;
        if (r.success && cloudWanted()) cloud.isDirtyForCloud = true;   // push the merge
        return { loggedIn: !!r.success, reason: r.success ? '' : (r.failure + ': ' + (r.error || '')) };
      }, function (e) {
        takingOver = false;
        return { loggedIn: false, reason: String(e && e.message || e) };
      });
    },

    /** Save progress (3.0 style): the WHOLE small progress object. With HSGame.profile() this is not needed. */
    save: function (data) {
      note('save');
      if (P) { log('save() ignored — this game uses HSGame.profile(); change the profile instead'); return; }
      var c = safe(function () { return JSON.parse(JSON.stringify(data)); }, undefined);
      if (c === undefined || c === null || typeof c !== 'object') { log('save() needs a plain JSON object'); return; }
      latest = c; hasLatest = true;
      // Orders credited before this save are in it now: up soon, so the SDK
      // can confirm them.
      var withOrders = ordersNew.length > 0;
      if (withOrders) { orders0 = trimOrders(orders0.concat(ordersNew)); ordersNew = []; }
      if (cloudSettled) cloud.isDirtyForCloud = true;
      markSaveDirty();                 // on the device until it is in the cloud
      if (withOrders) syncSoon();
    }
  };

  if (typeof module === 'object' && module && module.exports) module.exports = HSGame;
  if (root) root.HSGame = HSGame;
})(typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof globalThis !== 'undefined' ? globalThis : this));
