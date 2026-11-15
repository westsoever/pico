"""Core flows on the production build with ?proto (fake accounts and demo states), ported from the Phase A checks.
(a) a low first rating shows no match %  (b) rate signed out, then sign up: cups move into the account
(c) quiz alone gives a match %  (d) sticky Save bar only after a star  (e) nav labels, "View at roaster"
(f) add detail, edit, delete a cup  (g) community rating counts the signed-in rater once, not signed-out cups
(h) a sketched coffee shows no "New on Pico" line (it is yours, not in the community).
Usage: python3 scripts/e2e/check_flows.py
"""
import json
from playwright.sync_api import sync_playwright
from serve import Checks, SEEDED_RANDOM, VIEWPORT, build_and_serve, stored

COFFEE = 'kontra-kenya-gicherori'
SKETCH = {'id': 'custom-flowsketch', 'name': 'Finca Prueba', 'roaster': 'Test Roasters', 'origin': 'Colombia', 'process': 'Washed',
          'roastLevel': 'light', 'flavorTags': ['fruity'], 'description': 'Added from a label scan.', 'isCustom': True}
c = Checks()
BASE = build_and_serve() + '?proto'


def page(b, state='first-run'):
    ctx = b.new_context(viewport=VIEWPORT); ctx.add_init_script(SEEDED_RANDOM)
    pg = ctx.new_page(); pg.goto(f'{BASE}&state={state}#/welcome' if state else f'{BASE}#/welcome'); pg.wait_for_timeout(600)
    return pg


def rate(pg, coffee, n):
    pg.goto(f'{BASE}#/coffee/{coffee}'); pg.wait_for_selector('.p-coffee')
    pg.click(f'.p-rate button[aria-label="{n} stars"]'); pg.click('.p-cta__save'); pg.wait_for_timeout(300)


def live_cups(pg):
    return [x for x in stored(pg)['cups'] if not x.get('deletedAt')]


with sync_playwright() as p:
    b = p.chromium.launch()
    # (a)
    pg = page(b); pg.click('text=Browse coffees'); pg.click('text=Skip'); rate(pg, COFFEE, 2)
    hits = []
    for route in ['#/discover', f'#/coffee/{COFFEE}', '#/coffee/coffee-collective-mulugeta-anaerobic']:
        pg.goto(BASE + route); pg.wait_for_timeout(400)
        if '% match' in pg.inner_text('body'): hits.append(route)
    c.ok(not hits, f'(a) no "% match" after one 2-star rating {hits}')
    pg.context.close()
    # (b)
    pg = page(b); pg.click('text=Browse coffees'); pg.click('text=Skip'); rate(pg, COFFEE, 4)
    c.ok('Create a free account' in pg.inner_text('.p-keep'), '(b) quiet keep-your-cups line after 1 cup')
    for x in ['coffee-collective-mulugeta-anaerobic', 'skaastrupkaffen-special-blend']: rate(pg, x, 5)
    c.ok(pg.locator('.p-keep .p-btn').count() == 1, '(b) button-sized prompt after 3 cups')
    pg.click('.p-keep .p-btn'); pg.wait_for_timeout(300)
    pg.fill('input[type=email]', 'lea.test@example.com'); pg.click('text=Email me a code'); pg.fill('.p-code', '123456'); pg.click('text=Sign in')
    pg.wait_for_timeout(500)
    st = stored(pg)
    c.ok(st['user'] and len(live_cups(pg)) == 3 and not any(x['userId'] == 'local' for x in st['cups']), '(b) after sign-up: 3 cups, none left signed out')
    pg.goto(f'{BASE}#/journal'); pg.wait_for_timeout(400)
    c.ok('Gicherori' in pg.inner_text('body'), '(b) Journal lists the cup rated before sign-up')
    pg.context.close()
    # (c)
    pg = page(b); pg.click('text=Browse coffees'); pg.click('text=Black'); pg.click('text=Fruity, like berries'); pg.click('text=Mild and bright')
    pg.goto(f'{BASE}#/coffee/{COFFEE}'); pg.wait_for_timeout(400)
    c.ok(not live_cups(pg) and pg.locator('.p-match').count() and '% match' in pg.inner_text('.p-match'), '(c) quiz alone gives a match %')
    pg.context.close()
    # (d) (e) (f)
    pg = page(b, 'regular'); pg.goto(f'{BASE}#/discover'); pg.wait_for_timeout(500)
    labels = [t.strip() for t in pg.locator('.p-nav__item').all_inner_texts()]
    c.ok(len(labels) >= 3 and all(labels), f'(e) nav items have labels {labels}')
    pg.goto(f'{BASE}#/coffee/{COFFEE}'); pg.wait_for_timeout(500)
    c.ok(pg.locator('.p-cta').count() == 0, '(d) no Save bar before a star is tapped')
    c.ok('View at roaster' in pg.inner_text('.p-roaster-link'), '(e) "View at roaster" button')
    pg.click('.p-rate button[aria-label="4 stars"]'); pg.wait_for_timeout(200)
    c.ok(pg.locator('.p-cta').count() == 1, '(d) Save bar after tapping a star')
    pg.click('text=Add detail'); pg.click('.p-rate .p-detail >> text=Berry'); pg.click('.p-rate .p-detail >> text=AeroPress')
    pg.fill('.p-rate textarea', 'Playwright cup'); pg.click('.p-cta__save'); pg.wait_for_timeout(300)
    cup = next((x for x in live_cups(pg) if x['note'] == 'Playwright cup'), None)
    c.ok(cup and cup['stars'] == 4 and 'berry' in cup['flavorTags'] and cup.get('brew', {}).get('method') == 'aeropress', f'(f) cup saved with detail {cup}')
    pg.click('.p-history__open >> nth=0'); pg.click('.p-edit button[aria-label="2 stars"]'); pg.fill('.p-edit textarea', 'Edited')
    pg.click('text=Save changes'); pg.wait_for_timeout(300)
    edited = next(x for x in live_cups(pg) if x['id'] == cup['id'])
    c.ok(edited['stars'] == 2 and edited['note'] == 'Edited', '(f) edit saved')
    n = len(live_cups(pg))
    pg.click('.p-history__open >> nth=0'); pg.click('text=Delete cup'); pg.click('.p-edit__actions button.p-link--danger'); pg.wait_for_timeout(300)
    c.ok(len(live_cups(pg)) == n - 1 and all(x['id'] != cup['id'] for x in live_cups(pg)), '(f) delete removes the cup')
    pg.context.close()
    # (g)
    pg = page(b, 'regular'); pg.goto(f'{BASE}#/discover'); pg.wait_for_timeout(500)
    st = stored(pg); seed = st['communityRatings']
    cid = next(k for k in seed if k not in {x['coffeeId'] for x in st['cups']})
    pg.goto(f'{BASE}#/coffee/{cid}'); pg.wait_for_timeout(400)
    count = lambda: int(pg.inner_text('.p-community').split('·')[1].split()[0])
    before = count(); rate(pg, cid, 5)
    c.ok(count() == before + 1, f'(g) signed in: rater count {before} -> {count()}')
    pg.context.close()
    pg = page(b, 'first-run'); pg.goto(f'{BASE}#/coffee/{cid}'); pg.wait_for_timeout(400)
    before = pg.inner_text('.p-community'); rate(pg, cid, 4)
    c.ok(pg.inner_text('.p-community') == before, f'(g) signed out: community line unchanged ({before})')
    pg.context.close()
    # (h)
    pg = page(b, None)
    pg.evaluate(f"localStorage.setItem('pico-custom-coffees', {json.dumps(json.dumps([SKETCH]))})")
    pg.goto(f'{BASE}#/coffee/{SKETCH["id"]}'); pg.reload(); pg.wait_for_selector('.p-coffee')
    c.ok('New on Pico' not in pg.inner_text('.p-coffee'), '(h) sketched coffee shows no "New on Pico"')
    pg.context.close()
    b.close()
c.done()
