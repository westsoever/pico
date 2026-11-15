"""The live beta makes no account promises (production build, served like GitHub Pages at /pico/).
live: empty localStorage, no account promises anywhere, no scan limit, no Sign out, bookmarks work signed out,
  data survives a reload. seeded: a tester who used the fake sign-up before the fix. proto: ?proto brings the fake flows back.
Usage: python3 scripts/e2e/check_no_accounts.py [live] [proto] [seeded]
"""
import json, sys
from playwright.sync_api import sync_playwright
from serve import Checks, build_and_serve

BASE = build_and_serve()
IDS = ['andersen-maillard-los-angeles-pacamara', 'andersen-maillard-muthua-ini', 'april-kamavindi-aa', 'april-tadesse-natural']
FORBIDDEN = ['every device', 'code we sent', 'free account', 'create an account', 'sign in', 'sign out',
             'continue with google', 'free scan', 'safe on']
checks = Checks()
ok = checks.ok

def cups(page):
    s = json.loads(page.evaluate("localStorage.getItem('pico-v2')") or '{}')
    live = lambda rows: [r for r in rows if not r.get('deletedAt')]
    return live(s.get('cups', [])), live(s.get('saved', [])), s.get('user')

def run(p, mode):
    b = p.chromium.launch()
    page = b.new_page(viewport={'width': 390, 'height': 844})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    hosts = {}
    page.on('request', lambda r: hosts.setdefault(r.url.split('/')[2], r.method) if 'localhost' not in r.url else None)
    posts = []
    page.on('request', lambda r: posts.append(r.url[:80]) if r.method != 'GET' and 'localhost' not in r.url else None)
    if mode == 'seeded':
        seeded(page, hosts, errors); b.close(); return
    q = '?proto' if mode == 'proto' else ''
    seen = {}
    def grab(name):
        page.wait_for_timeout(250)
        seen[name] = page.inner_text('body').lower()
    page.goto(BASE + q)
    page.wait_for_selector('.p-welcome')
    grab('welcome')
    page.get_by_role('button', name='Browse coffees').click()
    page.wait_for_selector('.p-quiz'); grab('quiz')
    for _ in range(3): page.locator('.p-quiz__options button').first.click()
    page.wait_for_selector('.p-discover'); grab('discover')
    for i, cid in enumerate(IDS):
        page.goto(f'{BASE}{q}#/coffee/{cid}'); page.wait_for_selector('.p-coffee')
        page.locator('button[aria-label="4 stars"]').click()
        page.get_by_role('button', name='Save to Journal').click()
        grab(f'coffee-rated-{i}')
    if mode == 'live':
        ok('added to your taste profile.' in seen['coffee-rated-0'], 'rating confirms "Added to your taste profile." only')
    # bookmark, signed out
    page.goto(f'{BASE}{q}#/coffee/april-volcan-azul'); page.wait_for_selector('.p-coffee')
    page.locator('.p-save').click(); page.wait_for_timeout(300)
    if mode == 'live':
        ok('#/coffee/' in page.url and page.locator('.p-save').get_attribute('aria-pressed') == 'true', 'bookmark works signed out, no detour')
    else:
        ok('#/signup' in page.url, 'proto: bookmark signed out goes to the fake sign-up')
        grab('signup')
        ok('continue with google' in seen['signup'], 'proto: sign-up screen shows Continue with Google')
        page.get_by_role('button', name='Continue with Google').click(); page.wait_for_timeout(300)
        ok(cups(page)[2] is not None and len(cups(page)[1]) == 1, 'proto: fake sign-in works and the pending bookmark is saved')
    for name in ['journal', 'saved', 'taste']:
        page.goto(f'{BASE}{q}#/{name}'); page.wait_for_timeout(300); grab(name)
    if mode == 'live':
        page.goto(f'{BASE}{q}#/saved'); page.wait_for_timeout(300)
        ok(page.locator('.p-grid .p-tile').count() == 1, 'Saved lists the bookmark signed out')
    # scans
    page.goto(f'{BASE}{q}#/scan'); page.wait_for_selector('.p-scan')
    if mode == 'proto':  # sign out first so the free-scan limit applies
        page.evaluate("localStorage.clear()"); page.goto(f'{BASE}{q}#/scan'); page.reload(); page.wait_for_selector('.p-scan')
    walled = False
    for i in range(6):
        if page.locator('.p-wall').count():
            walled = True; break
        page.get_by_role('button', name='No bag at hand? Try a sample scan').click()
        page.wait_for_selector('.p-results', timeout=5000); grab(f'scan-{i}')
        page.get_by_role('button', name='Scan another bag').click(); page.wait_for_timeout(200)
    grab('scan-after')
    if mode == 'live':
        ok(not walled and page.locator('.p-wall').count() == 0, '6 scans, no scan wall')
    else:
        ok(walled or page.locator('.p-wall').count() == 1, 'proto: scan wall after 5 free scans')
    for name in ['account', 'signup?reason=keep', 'profile', 'privacy']:
        page.goto(f'{BASE}{q}#/{name}'); page.wait_for_timeout(300); grab(name)
    if mode == 'live':
        ok('accounts are coming' in seen['account'] and 'accounts are coming' in seen['signup?reason=keep'], 'Account and /signup show the honest page')
        ok('placeholder' not in seen['privacy'] and 'goatcounter' in seen['privacy'], 'privacy page has the real statements')
        ok(page.get_by_role('button', name='Sign out').count() == 0, 'no Sign out anywhere reachable')
        for phrase in FORBIDDEN:
            hits = [n for n, t in seen.items() if phrase in t]
            ok(not hits, f'"{phrase}" appears nowhere' + (f' (found on {hits})' if hits else ''))
        acc = [n for n, t in seen.items() if 'account' in t]
        print('INFO "account" only on:', acc)
        ok(set(acc) <= {'account', 'signup?reason=keep', 'profile'}, '"account" only in "Accounts are coming"')
        before = cups(page)
        page.reload(); page.wait_for_timeout(500)
        after = cups(page)
        ok(len(after[0]) == 4 and len(after[1]) == 1 and before[:2] == after[:2], f'4 cups and 1 bookmark survive a reload')
        page.goto(f'{BASE}{q}#/journal'); page.wait_for_timeout(300)
        ok(page.locator('.p-screen').count() == 1 and 'no cups yet' not in page.inner_text('body').lower(), 'journal shows the cups after reload')
    else:
        ok('free scans' in seen['scan-0'] or 'free scan' in seen['discover'], 'proto: free-scan count shown')
        ok('create a free account' in seen['coffee-rated-0'], 'proto: keep-your-cups prompt shown')
        ok('i have an account' in seen['welcome'], 'proto: welcome offers sign-in')
        # Sign out exists for a signed-in user
        page.goto(f'{BASE}{q}#/signup'); page.get_by_role('button', name='Continue with Google').click(); page.wait_for_timeout(200)
        page.goto(f'{BASE}{q}#/account'); page.wait_for_timeout(300)
        ok(page.get_by_role('button', name='Sign out').count() == 1, 'proto: Account has Sign out')
    ok(not errors, f'no page errors {errors}')
    print('INFO external hosts:', sorted(hosts), 'non-GET requests:', posts)
    b.close()

def seeded(page, hosts, errors):
    """An existing tester: fake-signed-in on the live beta before the fix, cups, all 5 free scans used."""
    page.goto(BASE + '#/welcome'); page.wait_for_selector('.p-welcome')
    page.evaluate("""() => {
      const u = 'fake-user', at = '2026-11-14T09:00:00Z';
      const cups = ['april-kamavindi-aa', 'april-tadesse-natural'].map((c, i) => ({ id: 'c' + i, userId: u, coffeeId: c, stars: 4, note: '', flavorTags: [], ratedAt: at, updatedAt: at }));
      localStorage.setItem('pico-v2', JSON.stringify({ version: 1, user: { id: u, displayName: 'Tester', createdAt: at }, cups, saved: [], userCoffees: [],
        scansUsed: 5, seenWelcome: true, tasteSeed: null, v1Imported: true, outbox: [], lastPulledAt: null, signInNeeded: false, communityRatings: {}, communityFetchedAt: null }));
    }""")
    seen = {}
    for name in ['discover', 'journal', 'saved', 'taste', 'account', 'scan']:
        page.goto(f'{BASE}#/{name}'); page.reload(); page.wait_for_timeout(500)
        seen[name] = page.inner_text('body').lower()
    ok(page.locator('.p-wall').count() == 0, 'seeded: no scan wall with scansUsed 5')
    ok('no cups yet' not in seen['journal'] and 'kamavindi' in seen['journal'], 'seeded: cups visible')
    ok('accounts are coming' in seen['account'] and page.get_by_role('button', name='Sign out').count() == 0, 'seeded: Account is the honest page, no Sign out')
    page.goto(f'{BASE}#/coffee/april-volcan-azul'); page.wait_for_selector('.p-coffee')
    page.locator('.p-save').click(); page.wait_for_timeout(200)
    on = page.locator('.p-save').get_attribute('aria-pressed') == 'true'
    page.locator('.p-save').click(); page.wait_for_timeout(200)
    ok(on and page.locator('.p-save').get_attribute('aria-pressed') == 'false', 'seeded: bookmark toggles on and off')
    page.locator('button[aria-label="5 stars"]').click(); page.get_by_role('button', name='Save to Journal').click(); page.wait_for_timeout(200)
    seen['rated'] = page.inner_text('body').lower()
    ok('added to your taste profile.' in seen['rated'] and 'coffee’s rating' not in seen['rated'], 'seeded: rating says taste profile only')
    for phrase in FORBIDDEN:
        hits = [n for n, t in seen.items() if phrase in t]
        ok(not hits, f'seeded: "{phrase}" appears nowhere' + (f' (found on {hits})' if hits else ''))
    ok(not errors, f'seeded: no page errors {errors}')

with sync_playwright() as p:
    for mode in sys.argv[1:] or ['live', 'proto', 'seeded']:
        print(f'--- {mode}')
        run(p, mode)
checks.done()
