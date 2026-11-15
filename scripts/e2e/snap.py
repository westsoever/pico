"""Screenshot + text of every screen in every demo state, on the production build, for before/after comparisons.

55 = 5 demo states (?proto&state=) x 11 screens, plus 5 screens of the live beta as a new visitor sees it (no ?proto).
Sample scans use a seeded Math.random and animations are frozen, so two runs of the same code match.
Usage: python3 scripts/e2e/snap.py <outdir>      then compare.py <before> <after>
"""
import json, os, sys
from playwright.sync_api import sync_playwright
from serve import SEEDED_RANDOM, VIEWPORT, build_and_serve

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
STATES = ['first-run', 'scans-1', 'scans-0', 'new-user', 'regular']
SCREENS = ['welcome', 'quiz', 'discover', 'coffee/kontra-kenya-gicherori', 'journal', 'journal/cups', 'saved', 'taste', 'account', 'signup', 'scan']
LIVE = ['welcome', 'discover', 'account', 'privacy', 'scan']
base = build_and_serve()
texts = {}


def shot(b, url, name, scan):
    ctx = b.new_context(viewport=VIEWPORT)
    ctx.add_init_script(SEEDED_RANDOM)
    pg = ctx.new_page()
    pg.goto(url); pg.wait_for_timeout(900)
    if scan:
        btn = pg.locator('text=Try a sample scan')
        if btn.count():
            pg.evaluate('window.__reseed()'); btn.click(); pg.wait_for_timeout(1800)
    # Coffee photos come from roaster sites: wait until every image has loaded or failed, then a beat for decode.
    # Lazy images would start loading mid-capture on a full-page shot: load them all first.
    pg.evaluate("document.querySelectorAll('img[loading=lazy]').forEach((i) => { i.loading = 'eager'; })")
    pg.wait_for_load_state('networkidle')
    pg.wait_for_function('Array.from(document.images).every((i) => i.complete)', timeout=15000)
    pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/{name}.png', full_page=True, animations='disabled')
    texts[name] = pg.inner_text('body')
    ctx.close()


with sync_playwright() as p:
    b = p.chromium.launch()
    for st in STATES:
        for sc in SCREENS:
            shot(b, f'{base}?proto&state={st}#/{sc}', f"{st}__{sc.replace('/', '_')}", sc == 'scan')
    for sc in LIVE:
        shot(b, f'{base}#/{sc}', f'live__{sc}', sc == 'scan')
    b.close()
json.dump(texts, open(f'{OUT}/texts.json', 'w'), indent=1)
print('captured', len(texts))
