// Builds the single-file web version of Mukbang ASMR.
// It is the SAME game folder (game.js + src/*) running in a browser through the
// HS kit's own tt-web-shim.js, with a tiny CommonJS registry in place of
// TikTok's require(). Nothing here is uploaded to TikTok.
//   node tools/build-web.mjs   → web/index.html (standalone) + web/mukbang-bang-artifact.html (claude.ai artifact)
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, relative, extname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const gameDir = join(root, 'mukbang-bang');
const kitDir = process.env.HS_KIT || 'D:/New/REF/hs-sdk-1.1.3/hs-sdk-1.1.3';
const outDir = join(root, 'web');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

const files = ['game.js', 'hs-game.js', 'hs-sdk.min.js', ...readdirSync(join(gameDir, 'src')).filter((f) => /\.(js|json)$/.test(f)).map((f) => 'src/' + f)];
let registry = '';
for (const f of files) {
  // The SDK's UTF-8 decoder holds a literal U+FFFD; escape it so the page carries no replacement characters.
  const src = readFileSync(join(gameDir, f), 'utf8').replace(/\uFFFD/g, '\\uFFFD');
  const body = f.endsWith('.json') ? 'module.exports = ' + src.trim() + ';' : src;
  registry += `__mods[${JSON.stringify(f)}] = function (require, module, exports, __filename, __dirname) {\n${body}\n};\n`;
}
const loader = `
(function () {
  var __mods = {}; var __cache = {};
  ${registry}
  function norm(p) { var out = []; p.split('/').forEach(function (s) { if (!s || s === '.') return; if (s === '..') { out.pop(); return; } out.push(s); }); return out.join('/'); }
  function makeRequire(from) {
    return function (req) {
      var dir = from.indexOf('/') >= 0 ? from.slice(0, from.lastIndexOf('/') + 1) : '';
      var key = norm(dir + req);
      if (!__mods[key] && __mods[key + '.js']) key = key + '.js';
      if (!__mods[key]) throw new Error('module not found: ' + req + ' from ' + from);
      if (__cache[key]) return __cache[key].exports;
      var m = { exports: {} }; __cache[key] = m;
      __mods[key].call(m.exports, makeRequire(key), m, m.exports, key, dir);
      return m.exports;
    };
  }
  makeRequire('')('./game.js');
})();
`;
// Bitmap art: every image under mukbang-bang/assets/ as a data URI,
// keyed by the same path the game asks for ("assets/food/x.png").
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const assets = {}; let assetBytes = 0;
(function walk(dir) {
  if (!existsSync(dir)) return;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { walk(p); continue; }
    const mime = MIME[extname(e.name).toLowerCase()]; if (!mime) continue;
    const buf = readFileSync(p); assetBytes += buf.length;
    assets[relative(gameDir, p).split(String.fromCharCode(92)).join('/')] = 'data:' + mime + ';base64,' + buf.toString('base64');
  }
})(join(gameDir, 'assets'));
// the TikTok subpackages too (the web page has no subpackages: everything is inlined)
for (const sub of ['art1', 'art3', 'art4', 'art5', 'art6', 'art7', 'art8']) (function walk(dir) { if (!existsSync(dir)) return; for (const e of readdirSync(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) { walk(p); continue; } const mime = MIME[extname(e.name).toLowerCase()]; if (!mime) continue; const buf = readFileSync(p); assetBytes += buf.length; assets[relative(gameDir, p).split(String.fromCharCode(92)).join('/')] = 'data:' + mime + ';base64,' + buf.toString('base64'); } })(join(gameDir, sub));
// the page must stay under 16 MB: big PNGs go in as lossy WebP when that is clearly smaller (the TikTok zip keeps the PNGs)
{ const big = Object.keys(assets).filter(k => k.endsWith('.png') && assets[k].length > 6000).map(k => join(gameDir, k));
  if (big.length) { let out = ''; try { out = execFileSync('python3', [join(here, 'webp-cache.py'), join(here, '.cache-webp'), ...big], { encoding: 'utf8', maxBuffer: 1 << 26 }); } catch (e) { console.warn('webp cache skipped: ' + e.message); }
    for (const line of out.split('\n')) { const [png, webp] = line.split('\t'); if (!webp) continue; const k = relative(gameDir, png).split(String.fromCharCode(92)).join('/'); const buf = readFileSync(webp); assetBytes -= Buffer.from(assets[k].split(',')[1], 'base64').length - buf.length; assets[k] = 'data:image/webp;base64,' + buf.toString('base64'); } } }
const assetScript = 'var __HS_ASSETS = ' + JSON.stringify(assets) + ';';
const shim = readFileSync(join(kitDir, 'web', 'tt-web-shim.js'), 'utf8');
const DESC = 'Mukbang ASMR: shop at the supermarket, scan at the checkout, then eat it all on a live stream. Same code as the TikTok mini game.';
const style = `
  canvas { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; touch-action: none; }
  /* Layout: one canvas in a phone-shaped box, centred on wide screens; the game paints its own HUD. */
  :root { --bg: #ffe3ea; --bg2: #ffd1dc; --err: #b3261e; --fg: #5b3d3b; }
  @media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #3a2a3a; --bg2: #46324a; --fg: #ffe3ea; color-scheme: dark; } }
  :root[data-theme="dark"] { --bg: #3a2a3a; --bg2: #46324a; --fg: #ffe3ea; color-scheme: dark; }
  html, body { height: 100%; margin: 0; color: var(--fg); overflow: hidden; touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; overscroll-behavior: none;
    /* a long press (HOLD TO POUR) must never turn into iOS text selection, a callout or a scroll */
    background: var(--bg) repeating-conic-gradient(var(--bg2) 0% 25%, var(--bg) 0% 50%) 0 0 / 56px 56px !important; }
  canvas.hs-screen { display: block; position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; box-shadow: 0 0 0 4px #5b3d3b, 0 12px 40px rgba(91,61,59,0.35); }
  #err { position: fixed; left: max(16px, env(safe-area-inset-left, 0px)); right: max(16px, env(safe-area-inset-right, 0px)); bottom: 8px; background: var(--err); color: #fff; font: 13px/1.4 monospace; padding: 8px 10px; border-radius: 8px; display: none; white-space: pre-wrap; z-index: 9; }
`;
const errScript = `window.addEventListener('error', function (e) { var d = document.getElementById('err'); d.style.display = 'block'; d.textContent += (e.message || e) + '\\n'; });`;
const body = `<div id="err"></div>
<script>${errScript}</script>
<script>
/* Game art (mukbang-bang/assets/), inlined. */
${assetScript}
/* Web / artifact build only: tester tools in SETTINGS (unlock all levels). */
var __HS_DEV = true;
</script>
<script>
/* HS kit web shim (tt-web-shim.js) — browser stand-in for TikTok's tt API. Not part of the TikTok upload. */
${shim}
</script>
<script>
${loader}
</script>
`;
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<title>Mukbang ASMR</title>
<meta name="description" content="${DESC}">
<style>${style}</style>
</head>
<body>
${body}</body>
</html>
`;
writeFileSync(join(outDir, 'index.html'), html);
// Artifact variant: claude.ai wraps the file in its own document skeleton, so this is a fragment.
const artifact = `<meta charset="utf-8">
<title>Mukbang ASMR</title>
<meta name="description" content="${DESC}">
<style>${style}</style>
${body}`;
writeFileSync(join(outDir, 'mukbang-bang-artifact.html'), artifact);
console.log('web/index.html ' + (html.length / 1024).toFixed(0) + ' KB · web/mukbang-bang-artifact.html ' + (artifact.length / 1024).toFixed(0) + ' KB · modules: ' + files.length + ' · images: ' + Object.keys(assets).length + ' (' + (assetBytes / 1024).toFixed(0) + ' KB)');
