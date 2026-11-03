'use strict';
// Small helpers shared by every module. No platform calls here.
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function easeOutBack(t) { const c = 1.70158; t = clamp(t, 0, 1) - 1; return 1 + t * t * ((c + 1) * t + c); }
function easeOutCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
function easeInOut(t) { t = clamp(t, 0, 1); return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
// Exponential approach: stable at any frame rate.
function damp(cur, target, rate, dt) { return lerp(cur, target, 1 - Math.exp(-rate * dt)); }
function dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); }
// Deterministic RNG (mulberry32) so shelves and chat are the same on every device for a seed.
function rng(seed) {
  let s = seed >>> 0;
  const next = function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = function (a, b) { return a + (b - a) * next(); };
  next.int = function (a, b) { return a + Math.floor(next() * (b - a + 1)); };
  next.pick = function (arr) { return arr[Math.floor(next() * arr.length)]; };
  next.chance = function (p) { return next() < p; };
  return next;
}
// 820 → "820", 12345 → "12.3K", 123456 → "123K", 1.2M
function fmtViewers(n) {
  n = Math.max(0, Math.floor(n));
  if (n < 1000) return String(n);
  if (n < 100000) { const k = n / 1000; return (k < 10 ? k.toFixed(1) : Math.floor(k).toString()) + 'K'; }
  if (n < 1000000) return Math.floor(n / 1000) + 'K';
  return (n / 1000000).toFixed(1) + 'M';
}
function fmtCoins(n) { n = Math.max(0, Math.floor(n)); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function pad2(n) { return (n < 10 ? '0' : '') + n; }
module.exports = { clamp, lerp, smoothstep, easeOutBack, easeOutCubic, easeInOut, damp, dist, rng, fmtViewers, fmtCoins, pad2 };
