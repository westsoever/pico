"""Live testers' data must carry through every change untouched.

Loads each fixtures/*.json (recorded from the live beta by make_fixtures.py) into localStorage, walks the app on
the production build, reloads, and checks that every cup (deleted ones too), bookmark, sketched coffee and setting
is still there and still shows. Usage: python3 scripts/e2e/check_fixtures.py
"""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
from serve import Checks, VIEWPORT, build_and_serve, stored

FIXTURES = sorted((Path(__file__).parent / 'fixtures').glob('*.json'))
CATALOG = {c['id']: c['name'] for c in json.loads((Path(__file__).resolve().parents[2] / 'src/data/coffees-dk.json').read_text())}
ROW_FIELDS = ['id', 'userId', 'coffeeId', 'stars', 'note', 'flavorTags', 'brew', 'ratedAt', 'savedAt', 'deletedAt']
SETTINGS = ['user', 'tasteSeed', 'seenWelcome', 'scansUsed']
c = Checks()
base = build_and_serve()


def rows_intact(before, after, label):
    by_id = {r['id']: r for r in after}
    missing = [r['id'] for r in before if r['id'] not in by_id]
    changed = [r['id'] for r in before if r['id'] in by_id and any(r.get(f) != by_id[r['id']].get(f) for f in ROW_FIELDS)]
    c.ok(not missing and not changed, f'{label}: all {len(before)} kept unchanged' + (f' missing {missing} changed {changed}' if missing or changed else ''))


with sync_playwright() as p:
    b = p.chromium.launch()
    for path in FIXTURES:
        name = path.stem
        fx = json.loads(path.read_text())['localStorage']
        want = json.loads(fx['pico-v2'])
        sketches = json.loads(fx.get('pico-custom-coffees', '[]'))
        names = {**CATALOG, **{s['id']: s['name'] for s in sketches}}
        live_cups = [x for x in want['cups'] if not x.get('deletedAt')]
        live_saved = [x for x in want['saved'] if not x.get('deletedAt')]
        print(f'--- {name}: {len(live_cups)} cups, {len(live_saved)} bookmarks, {len(sketches)} sketches, user {bool(want["user"])}')

        ctx = b.new_context(viewport=VIEWPORT)
        # Set the tester's storage once, before the app's first line runs (not again on reloads).
        ctx.add_init_script(f"""if (!sessionStorage.getItem('fx')) {{ localStorage.clear();
          for (const [k, v] of Object.entries({json.dumps(fx)})) localStorage.setItem(k, v); sessionStorage.setItem('fx', '1'); }}""")
        pg = ctx.new_page()
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(base); pg.wait_for_timeout(800)
        c.ok(pg.url.endswith('#/discover'), f'{name}: opens on Discover (welcome already seen): {pg.url}')
        pg.goto(f'{base}#/journal'); pg.wait_for_timeout(500)
        body = pg.inner_text('body')
        c.ok(pg.locator('.p-footstat').count() == 1 and pg.inner_text('.p-footstat').startswith(f'{len(live_cups)} cup'),
             f'{name}: Journal counts {len(live_cups)} cups')
        shown = [names.get(x['coffeeId'], x['coffeeId']) for x in live_cups]
        c.ok(all(n in body for n in shown), f'{name}: Journal shows every rated coffee {shown}')
        pg.goto(f'{base}#/saved'); pg.wait_for_timeout(500)
        c.ok(pg.locator('.p-grid .p-tile').count() == len(live_saved), f'{name}: Saved shows {len(live_saved)} bookmark(s)')
        pg.goto(f'{base}#/taste'); pg.wait_for_timeout(400)
        c.ok('your taste starts here' not in pg.inner_text('body').lower(), f'{name}: Taste shows a profile')
        for cup in live_cups:
            pg.goto(f'{base}#/coffee/{cup["coffeeId"]}'); pg.wait_for_timeout(400)
            ok = pg.locator('.p-coffee').count() == 1 and names[cup['coffeeId']] in pg.inner_text('.p-name')
            c.ok(ok, f'{name}: coffee page opens for {cup["coffeeId"]}')
        for route in ['discover', 'account', 'privacy', 'scan']:
            pg.goto(f'{base}#/{route}'); pg.wait_for_timeout(300)
        pg.reload(); pg.wait_for_timeout(800)

        got = stored(pg)
        rows_intact(want['cups'], got['cups'], f'{name}: cups')
        rows_intact(want['saved'], got['saved'], f'{name}: bookmarks')
        rows_intact(want['userCoffees'], got['userCoffees'], f'{name}: hand-added coffees')
        diff = {k: (want[k], got.get(k)) for k in SETTINGS if want[k] != got.get(k)}
        c.ok(not diff, f'{name}: settings unchanged ({", ".join(SETTINGS)})' + (f' {diff}' if diff else ''))
        # Sketches the live beta saved in v1's key become your own coffees (same id and name); v1's copy stays.
        mine = {u['id']: u['name'] for u in got['userCoffees'] if not u.get('deletedAt')}
        v1_left = {s['id'] for s in json.loads(pg.evaluate("localStorage.getItem('pico-custom-coffees')") or '[]')}
        lost = [s['id'] for s in sketches if mine.get(s['id']) != s['name'] or s['id'] not in v1_left]
        c.ok(not lost, f'{name}: every scan-miss sketch is one of your coffees, v1 copy kept' + (f' not adopted {lost}' if lost else ''))
        c.ok(not errors, f'{name}: no page errors {errors}')
        ctx.close()
    b.close()
c.done()
