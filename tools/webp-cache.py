# Web build helper: lossy WebP copies of big PNGs for the single-file artifact (it must stay under 16 MB).
# The TikTok package keeps the original PNGs. Usage: python3 webp-cache.py <cache dir> <png>...  (prints "png\twebp" for each one kept)
import sys, os, hashlib
from PIL import Image
cache = sys.argv[1]; os.makedirs(cache, exist_ok=True)
for p in sys.argv[2:]:
    raw = open(p, 'rb').read(); h = hashlib.sha1(raw).hexdigest(); out = os.path.join(cache, h + '.webp')
    if not os.path.exists(out):
        im = Image.open(p); im = im.convert('RGBA') if ('A' in im.getbands() or im.mode == 'P') else im.convert('RGB')
        im.save(out, 'WEBP', quality=82, method=5, alpha_quality=90)
    if os.path.getsize(out) < len(raw) * 0.85: print(p + '\t' + out)
