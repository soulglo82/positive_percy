# Side by side: the approved design (left) and the built screen (right).
#   python3 compose.py <reference dir> <built dir> <out dir>
import os, sys
from PIL import Image, ImageDraw
ref, built, out = sys.argv[1:4]
os.makedirs(out, exist_ok=True)
for f in sorted(os.listdir(ref)):
    if not f.endswith('.png') or not os.path.exists(os.path.join(built, f)):
        continue
    a = Image.open(os.path.join(ref, f)).convert('RGB')
    b = Image.open(os.path.join(built, f)).convert('RGB')
    sc = 900 / max(a.height, b.height)
    a = a.resize((max(1, int(a.width * sc)), max(1, int(a.height * sc))))
    b = b.resize((max(1, int(b.width * sc)), max(1, int(b.height * sc))))
    c = Image.new('RGB', (a.width + b.width + 30, 930), 'white')
    c.paste(a, (0, 30)); c.paste(b, (a.width + 30, 30))
    d = ImageDraw.Draw(c)
    d.text((5, 8), 'APPROVED ' + f[:-4], fill='black'); d.text((a.width + 35, 8), 'BUILT ' + f[:-4], fill='black')
    c.save(os.path.join(out, f))
