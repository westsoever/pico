"""Write prototype/image-kinds.json: per catalog coffee, "cutout" (transparent PNG), "plain" (bag on plain
white; both shown contained, the white multiplied away) or "photo" (coloured or lifestyle background, shown
edge to edge). Bag treats a missing entry as "photo". Also writes bag-widths.json for the share card.

Run: python3 prototype/image-kinds.py   (needs Pillow; rerun after the catalog changes)
"""
import io
import json
import pathlib
import urllib.parse
import urllib.request

from PIL import Image, ImageChops, ImageStat

ROOT = pathlib.Path(__file__).resolve().parent.parent
catalog = json.loads((ROOT / 'src/data/coffees-dk.json').read_text())
coffees = catalog if isinstance(catalog, list) else catalog['coffees']


def sized(url: str) -> str:
    # Same width=300 rendition the app requests (src/components/CoffeeImage.tsx sizedImageUrl).
    p = urllib.parse.urlparse(url)
    if p.hostname != 'cdn.shopify.com':
        return url
    q = dict(urllib.parse.parse_qsl(p.query), width='300')
    return urllib.parse.urlunparse(p._replace(query=urllib.parse.urlencode(q)))


def measure(url: str) -> tuple[str, float]:
    """(kind, share of the image width the bag itself fills; 1.0 for photos)."""
    req = urllib.request.Request(sized(url), headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'image/webp,image/png,*/*'})
    im = Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=20).read())).convert('RGBA')
    w, h = im.size
    corners = [im.getpixel(xy)[3] for xy in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]]
    if max(corners) < 16:
        box = im.getchannel('A').point(lambda a: 255 if a > 40 else 0).getbbox() or (0, 0, w, h)
        return 'cutout', round((box[2] - box[0]) / w, 3)
    rgb = im.convert('RGB')
    patches = [ImageStat.Stat(rgb.crop((x, y, x + 6, y + 6))) for x in (0, w - 6) for y in (0, h - 6)]
    if all(min(p.mean) >= 240 and max(p.stddev) <= 4 for p in patches):  # near-white, flat corners
        ink = ImageChops.difference(rgb, Image.new('RGB', rgb.size, 'white')).convert('L')
        box = ink.point(lambda v: 255 if v > 15 else 0).getbbox() or (0, 0, w, h)
        return 'plain', round((box[2] - box[0]) / w, 3)
    return 'photo', 1.0


kinds, widths = {}, {}
for c in coffees:
    if not c.get('imageUrl'):
        continue
    try:
        kinds[c['id']], width = measure(c['imageUrl'])
        if kinds[c['id']] != 'photo':
            widths[c['id']] = width
    except Exception as e:  # unreachable image: leave it out, Bag defaults to photo
        print('skip', c['id'], e)

out = ROOT / 'prototype/image-kinds.json'
out.write_text(json.dumps(dict(sorted(kinds.items())), indent=2) + '\n')
# Cutout and plain only: how wide the bag is inside its image, so the share card can enlarge narrow bags
# without wide boxes hitting the edge.
(ROOT / 'prototype/bag-widths.json').write_text(json.dumps(dict(sorted(widths.items())), indent=2) + '\n')
counts = {k: sum(v == k for v in kinds.values()) for k in ('cutout', 'plain', 'photo')}
print(f"{out}: {counts}; bag-widths.json: {len(widths)}")
