"""Record the two live-tester fixtures by using the built site the way testers did (run once, at 51d62dd).

signed-out-tester: the live beta as it is now (no accounts): quiz, cups with detail, an edit, a delete,
  a bookmark, sample scans, and a coffee sketched from a scan miss (stored in v1's pico-custom-coffees) with a cup.
existing-tester: someone who used the fake sign-up before the no-account fix (?proto reproduces it):
  cups before and after "signing in", a bookmark, a sketched coffee with a cup.
Usage: python3 scripts/e2e/make_fixtures.py
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from serve import SEEDED_RANDOM, VIEWPORT, build_and_serve

OUT = Path(__file__).parent / 'fixtures'
# The shape mergeCustomCoffees saves for a scan-miss sketch (label-parse draftToCoffee, undefined fields dropped).
SKETCH = {'id': 'custom-mfx1sketch', 'name': 'Finca La Esperanza', 'roaster': 'Small Batch Roasters', 'origin': 'Colombia',
          'process': 'Washed', 'roastLevel': 'light', 'flavorTags': ['fruity', 'citrus'], 'tastingNotes': ['lemon', 'red apple'],
          'description': 'Added from a label scan.', 'isCustom': True}


def rate(pg, base, coffee, stars, detail=None):
    pg.goto(f'{base}#/coffee/{coffee}'); pg.wait_for_selector('.p-coffee')
    pg.click(f'.p-rate button[aria-label="{stars} stars"]')
    if detail:
        pg.click('text=Add detail')
        pg.click(f'.p-rate .p-detail >> text={detail["flavor"]}')
        pg.click(f'.p-rate .p-detail >> text={detail["brew"]}')
        pg.fill('.p-rate textarea', detail['note'])
    pg.click('.p-cta__save'); pg.wait_for_timeout(300)


def dump(pg, name, description):
    keys = pg.evaluate("Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('pico-')).map(k => [k, localStorage.getItem(k)]))")
    OUT.mkdir(exist_ok=True)
    (OUT / f'{name}.json').write_text(json.dumps({'description': description, 'localStorage': keys}, indent=1) + '\n')
    print('wrote', name, sorted(keys))


with sync_playwright() as p:
    base = build_and_serve()
    b = p.chromium.launch()

    # --- signed-out tester (live mode) ---
    ctx = b.new_context(viewport=VIEWPORT); ctx.add_init_script(SEEDED_RANDOM); pg = ctx.new_page()
    pg.goto(base); pg.wait_for_selector('.p-welcome')
    pg.evaluate(f"localStorage.setItem('pico-custom-coffees', {json.dumps(json.dumps([SKETCH]))})")
    pg.click('text=Browse coffees'); pg.click('text=Black'); pg.click('text=Fruity, like berries'); pg.click('text=Mild and bright')
    pg.wait_for_selector('.p-discover')
    rate(pg, base, 'kontra-kenya-gicherori', 5, {'flavor': 'Berry', 'brew': 'AeroPress', 'note': 'Juicy, like blackcurrant'})
    rate(pg, base, 'april-tadesse-natural', 2)
    pg.click('.p-history__open >> nth=0'); pg.click('.p-edit button[aria-label="3 stars"]')
    pg.fill('.p-edit textarea', 'Better the second time'); pg.click('text=Save changes'); pg.wait_for_timeout(300)
    rate(pg, base, 'coffee-collective-mulugeta-anaerobic', 4)
    rate(pg, base, 'skaastrupkaffen-special-blend', 3)
    pg.click('.p-history__open >> nth=0'); pg.click('text=Delete cup'); pg.click('.p-edit__actions button.p-link--danger'); pg.wait_for_timeout(300)
    rate(pg, base, SKETCH['id'], 4)
    pg.goto(f'{base}#/coffee/april-kamavindi-aa'); pg.wait_for_selector('.p-coffee'); pg.click('.p-save'); pg.wait_for_timeout(200)
    pg.goto(f'{base}#/scan'); pg.wait_for_selector('.p-scan')
    for _ in range(2):
        pg.click('text=No bag at hand? Try a sample scan'); pg.wait_for_selector('.p-results'); pg.click('text=Scan another bag')
    dump(pg, 'signed-out-tester', 'Live beta without accounts: quiz, 5 cups (one with detail, one edited, one deleted, one on a scan-miss sketch), a bookmark, 2 sample scans.')
    ctx.close()

    # --- existing tester: fake sign-up before the fix (?proto brings that flow back) ---
    ctx = b.new_context(viewport=VIEWPORT); ctx.add_init_script(SEEDED_RANDOM); pg = ctx.new_page()
    q = '?proto'
    pg.goto(base + q); pg.wait_for_selector('.p-welcome')
    pg.evaluate(f"localStorage.setItem('pico-custom-coffees', {json.dumps(json.dumps([SKETCH]))})")
    pg.click('text=Browse coffees'); pg.click('text=Skip'); pg.wait_for_selector('.p-discover')
    rate(pg, base + q, 'kontra-kenya-gicherori', 4)
    rate(pg, base + q, 'april-volcan-azul', 5, {'flavor': 'Citrus', 'brew': 'Pour over', 'note': 'Bright'})
    pg.goto(f'{base}{q}#/signup?reason=keep'); pg.click('text=Continue with Google'); pg.wait_for_timeout(400)
    rate(pg, base + q, 'coffee-collective-mulugeta-anaerobic', 3)
    rate(pg, base + q, SKETCH['id'], 5)
    pg.goto(f'{base}{q}#/coffee/april-kamavindi-aa'); pg.wait_for_selector('.p-coffee'); pg.click('.p-save'); pg.wait_for_timeout(200)
    pg.goto(f'{base}{q}#/scan'); pg.wait_for_selector('.p-scan')
    pg.click('text=No bag at hand? Try a sample scan'); pg.wait_for_selector('.p-results')
    pg.wait_for_timeout(2500)  # auto-sync to the in-memory server, as on a tester's phone
    dump(pg, 'existing-tester', 'Fake-signed-in before the no-account fix: 2 cups rated signed out then moved into the account, 2 after, one on a scan-miss sketch, a bookmark, 1 scan.')
    ctx.close()
    b.close()
