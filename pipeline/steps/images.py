"""Lighter photos for the single-file page: 720 px wide, webp quality 55 (the page shows them at most ~600 px).
Writes <trip>/img/lite/<id>.webp and copies the small square thumbs. The build prefers img/lite when a file exists.
Needs cwebp (brew install webp). Usage: RELAXJER_TRIP=trips/<slug> uv run --project pipeline pipeline/steps/images.py"""
import os, subprocess, sys
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from lib.trip import S
SRC = S + 'img'; OUT = SRC + '/lite'
os.makedirs(OUT, exist_ok=True); before = after = 0
for f in sorted(os.listdir(SRC)):
    if not f.endswith('.webp'): continue
    src, dst = f'{SRC}/{f}', f'{OUT}/{f}'; before += os.path.getsize(src)
    if f.endswith('-sq.webp'): open(dst, 'wb').write(open(src, 'rb').read())
    else:
        w, h = Image.open(src).size
        args = ['cwebp', '-quiet', '-q', '55', '-m', '6', '-metadata', 'none'] + (['-resize', '720', '0'] if w > 720 else []) + [src, '-o', dst]
        subprocess.run(args, check=True)
    after += os.path.getsize(dst)
print(f'photos {before // 1024} KB → {after // 1024} KB')
