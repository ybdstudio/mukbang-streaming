'use strict';
// Mukbang Bang — native TikTok mini game entry (also runs in the HS Android
// app and, through the kit's web shim, in a browser). Wires the HS kit to the
// game. Every HSGame key / place / feature is written as a literal HERE so
// hs-check and the dashboard JSON can read them; src/game.js only calls these
// wrappers.
var HSGame = require('./hs-game.js');
var Game = require('./src/game.js').Game;

// ── HS: rewards & items (what a moment gives is dashboard data; these are the offline defaults) ──
var DEFAULTS = {
  rewards: {
    level_bonus:     { coins: 150 },                      // first clear of each level (profile levels_done guards repeats)
    first_stream:    { coins: 200, $limit: 'once' },      // the player's first finished stream
    bonus_coins:     { coins: 300 },                      // rewarded ad place on the result screen
    free_coins:      { coins: 200 },                      // rewarded ad place behind the "+" next to the coins
    // no "stream_end" entry: that interstitial gives nothing, it only continues to the next level
    share:           { coins: 100, $limit: 'daily' },
    tiktok_shortcut: { coins: 300 },
    tiktok_profile:  { coins: 300 }
  },
  items: {
    coins:  { category: 'currency', name: 'Coins' },
    no_ads: { category: 'unlock',   name: 'No Ads' }
  }
};

// ── HS: the profile — ALL progress lives here ──
var profile = HSGame.profile({
  level: 1,            // next level to play (1..30)
  levels_done: 0,      // highest level cleared (level_bonus paid once per level)
  coins: 1000,         // spent in the supermarket, earned on the stream
  streamer: 0,         // selected streamer (0..2)
  stars_json: '{}',    // stars per level, JSON string
  run_json: '',        // a stream in progress (bought food not yet eaten) — resumes after a restart
  streams: 0,          // finished streams
  best_viewers: 0,     // best peak viewers
  no_ads: 0,           // > 0 = bought "No Ads" (number field so the shop item credits itself)
  sound: true
}, {
  save: 'cloud',
  local: ['sound'],
  merge: { level: 'max', levels_done: 'max', streams: 'max', best_viewers: 'max', no_ads: 'max' },
  summary: 'level'
});

// ── platform adapter (tt API only) ──
function makePlatform() {
  var info = tt.getSystemInfoSync();
  var canvas = tt.createCanvas();
  var dpr = Math.min(3, info.pixelRatio || 1);
  // winW/winH = the window size the platform reports (touches arrive in it);
  // cssW/cssH = the game's own box. On a phone they are the same. In a wide
  // browser window (desktop preview) the game keeps a phone-shaped box centred
  // in the window, so the portrait layout never gets squashed.
  var winW = info.windowWidth, winH = info.windowHeight, cssW = winW, cssH = winH;
  var ctx = canvas.getContext('2d');
  var safe = info.safeArea || null;
  var touchHandler = null, resizeHandler = null;
  function fit() {
    cssW = winW; cssH = winH;
    if (winW / winH > 0.62) cssW = Math.round(winH * 0.5);
    canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
    if (canvas.style) { canvas.style.width = cssW + 'px'; canvas.style.height = cssH + 'px'; canvas.style.left = Math.round((winW - cssW) / 2) + 'px'; canvas.style.top = '0px'; }
    if (cssW !== winW) safe = null;
  }
  fit();
  function fwd(kind) { return function (e) { var list = kind === 'end' ? (e.changedTouches || e.touches) : (e.touches || e.changedTouches); if (!touchHandler || !list) return; for (var i = 0; i < list.length; i++) { var t = list[i]; touchHandler(kind, t.identifier, t.clientX * cssW / winW, t.clientY * cssH / winH); } }; }
  tt.onTouchStart(fwd('start')); tt.onTouchMove(fwd('move')); tt.onTouchEnd(fwd('end')); tt.onTouchCancel(fwd('end'));
  if (tt.setKeepScreenOn) tt.setKeepScreenOn({ keepScreenOn: true });
  // Browsers resize (rotation, desktop windows); TikTok never does. Polled once per frame.
  function poll() {
    try {
      if (typeof window === 'undefined' || !window.innerWidth) return;
      if (window.innerWidth === winW && window.innerHeight === winH) return;
      var i2 = tt.getSystemInfoSync(); winW = i2.windowWidth; winH = i2.windowHeight; safe = i2.safeArea || null;
      fit();
      if (resizeHandler) resizeHandler();
    } catch (e) { /* not a browser */ }
  }
  return {
    canvas: canvas, ctx: ctx, poll: poll,
    width: function () { return cssW; }, height: function () { return cssH; }, dpr: function () { return dpr; },
    safeTop: function () { return safe ? Math.max(0, safe.top) : (info.statusBarHeight || 0); },
    safeBottom: function () { return safe ? Math.max(0, cssH - safe.bottom) : 0; },
    onTouch: function (h) { touchHandler = h; }, onResize: function (h) { resizeHandler = h; },
    vibrate: function (kind) { try { if (kind === 'long') tt.vibrateLong({}); else tt.vibrateShort({}); } catch (e) { /* optional */ } },
    createAudioContext: function () { return tt.createWebAudioContext(); },
    createCanvas: function () { return tt.createCanvas(); }
  };
}

// ── HS wrappers used by src/game.js (literal keys, places and features) ──
var hs = {
  profile: profile,
  // moments → claims
  claimLevelBonus: function () { return HSGame.claim('level_bonus'); },
  claimFirstStream: function () { return HSGame.claim('first_stream'); },
  // reward labels (never typed amounts)
  rewardsLevelBonus: function () { return HSGame.rewards('level_bonus'); },
  rewardsBonusCoins: function () { return HSGame.rewards('bonus_coins'); },
  rewardsFreeCoins: function () { return HSGame.rewards('free_coins'); },
  rewardsShare: function () { return HSGame.rewards('share'); },
  rewardsProfile: function () { return HSGame.rewards('tiktok_profile'); },
  rewardsShortcut: function () { return HSGame.rewards('tiktok_shortcut'); },
  shareAvailable: function () { return HSGame.available('share'); },
  item: function (id) { return HSGame.item(id); },
  // features (HSGame decides per platform — the game never asks which platform it is on)
  hasMissions: function () { return HSGame.has('tiktok_missions'); },
  hasShare: function () { return HSGame.has('share'); },
  hasAds: function () { return HSGame.has('ads'); },
  hasShop: function () { return HSGame.has('shop'); },
  // ad places — every showAd runs inside the tap that asked for it (src/game.js tap handlers)
  canShowStreamEnd: function () { return HSGame.canShowAd('stream_end'); },
  showStreamEnd: function () { return HSGame.showAd('stream_end'); },
  canShowBonusCoins: function () { return HSGame.canShowAd('bonus_coins'); },
  showBonusCoins: function () { return HSGame.showAd('bonus_coins'); },
  canShowFreeCoins: function () { return HSGame.canShowAd('free_coins'); },
  showFreeCoins: function () { return HSGame.showAd('free_coins'); },
  // TikTok review buttons
  profileMissionDone: function () { return HSGame.tiktokMission.done('profile'); },
  shortcutMissionDone: function () { return HSGame.tiktokMission.done('shortcut'); },
  startProfileMission: function () { return HSGame.tiktokMission.start('profile'); },
  startShortcutMission: function () { return HSGame.tiktokMission.start('shortcut'); },
  canShare: function () { return HSGame.canShare(); },
  share: function () { return HSGame.share({ title: 'Mukbang Bang', subtitle: 'Shop, scan and eat on a live stream. Come watch my mukbang!' }); },
  // shop & account
  shop: function () { return HSGame.shop(); },
  buy: function (id) { return HSGame.buy(id); },
  on: function (name, cb) { return HSGame.on(name, cb); }
};

var platform = makePlatform();
var game = new Game(platform, hs);

// An ad, a purchase or the app going away: freeze and mute; undo on resume.
HSGame.on('pause', function () { game.freeze(true); });
HSGame.on('resume', function () { game.freeze(false); });
HSGame.on('given', function (items, from) { game.onGiven(items, from); });
HSGame.on('otherDevice', function () {
  tt.showModal({ title: 'Playing on another device', content: 'Your account is open on another phone.', confirmText: 'Play here', showCancel: false, success: function () { HSGame.takeOver(); } });
});

// The game plays at once from the profile; claims work after start() resolves.
HSGame.start({ gameId: '', sdkKey: '', defaults: DEFAULTS }).then(function () { game.hsReady = true; });

var raf = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : (tt.requestAnimationFrame ? tt.requestAnimationFrame : function (f) { setTimeout(function () { f(Date.now()); }, 16); });
function loop(now) { game.frame(typeof now === 'number' ? now : Date.now()); raf(loop); }
raf(loop);

tt.onHide(function () { game.freeze(true); });
tt.onShow(function () { game.freeze(false); });

// Browser-only helpers: #auto=market|checkout|stream|result|levels|streamers[:level] jumps to a screen (screenshots, QA). Harmless on TikTok (no location).
try {
  if (typeof window !== 'undefined' && window.location && /auto=/.test(window.location.hash)) {
    var m = /auto=(\w+)(?::(\d+))?/.exec(window.location.hash);
    setTimeout(function () { game.autoDemo(m[1], m[2] ? +m[2] : 0); }, 50);
  }
  if (typeof window !== 'undefined') { window.__mukbang = { game: game, HSGame: HSGame }; if (/debug/.test(window.location.hash)) game.debug = true; }
} catch (e) { /* not a browser */ }
