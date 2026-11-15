"""Compare two snap.py runs: text diff and pixel diff per screen. Exit 1 if anything differs.
Usage: python3 scripts/e2e/compare.py <before> <after>
"""
import difflib, json, sys
from PIL import Image, ImageChops

a, b = sys.argv[1], sys.argv[2]
ta, tb = json.load(open(f'{a}/texts.json')), json.load(open(f'{b}/texts.json'))
same, specks = 0, []
for k in ta:
    if k not in tb:
        print(f'== {k}: missing in {b}'); continue
    ia, ib = Image.open(f'{a}/{k}.png').convert('RGB'), Image.open(f'{b}/{k}.png').convert('RGB')
    pix = f'size {ia.size} -> {ib.size}' if ia.size != ib.size else ImageChops.difference(ia, ib).getbbox()
    if ta[k] == tb[k] and not pix:
        same += 1; continue
    # Rendering noise seen run to run on the SAME build (image decode, shadows, anti-aliasing): same text, and
    # fewer than 50 pixels differ by more than 16 grey levels. A real change (text, layout, image) moves far more.
    if ta[k] == tb[k] and isinstance(pix, tuple):
        hist = ImageChops.difference(ia.convert('L'), ib.convert('L')).histogram()
        if sum(hist[17:]) < 50:
            same += 1; specks.append(k); continue
    print(f'== {k}: pixels {pix}')
    for line in difflib.unified_diff(ta[k].splitlines(), tb[k].splitlines(), lineterm='', n=0):
        if not line.startswith(('---', '+++', '@@')):
            print('   ', line)
print(f'{same}/{len(ta)} identical' + (f' ({len(specks)} within rendering noise: {specks})' if specks else ''))
raise SystemExit(0 if same == len(ta) else 1)
