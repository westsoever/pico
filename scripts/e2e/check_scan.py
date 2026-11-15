"""The bag scan on the PRODUCTION build (no ?proto, accounts off, as the live site), Chrome's fake camera.
(1) a known catalog bag opens its coffee by itself, and its photo is in the collection after reload
(2) camera granted: the shutter captures inside Pico, no file chooser opens
(3) the owner's mug: a visible state within ~3 s, "Add it now" reachable, saving shows the mug photo, Journal after reload
(4) an ambiguous bag: the list with bigger pictures and "Not found, add it now"; picking one keeps the photo
(5) camera denied: the file-input fallback still works
(6) IndexedDB blocked: scan and rating still work
(7) 200 stored photos: first paint of the Journal, measured
(8) the menu scan: the same in-app camera; the file input only when the camera is denied
(9) a coffee you added yourself is found by the live read too
Needs ffmpeg (turns the photos into fake camera video) and network (catalog bag photos, the OCR engine's CDN).
Usage: python3 scripts/e2e/check_scan.py [screenshot dir]
"""
import os, subprocess, sys, tempfile, time, urllib.request
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout
from serve import Checks, VIEWPORT, build_and_serve, stored

HERE = Path(__file__).resolve().parent
MUG = HERE / 'fixtures' / 'mug.jpg'
# Picked by probing 24 catalog bags with the live scan: Kieni opens by itself, Megadu gives a 3-coffee list.
KNOWN = ('coffee-collective-kieni', 'https://cdn.shopify.com/s/files/1/0744/9031/5020/files/Kieni250gfront.png?v=1783513947')
AMBIGUOUS = ('la-cabra-megadu', 'https://cdn.shopify.com/s/files/1/1094/5212/files/Megadu_Natural_La_Cabra_Seasonal_Coffee_box_250g.webp?v=1790757719')
SHOTS = Path(sys.argv[1]) if len(sys.argv) > 1 else None
TMP = Path(tempfile.mkdtemp(prefix='pico-scan-'))
DENY_CAMERA = "navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('denied', 'NotAllowedError'));"
BLOCK_IDB = "Object.defineProperty(window, 'indexedDB', { get() { throw new Error('blocked'); } });"
c = Checks()
BASE = build_and_serve()


def video(name, src, pad='white'):
    """A 2 s still video (y4m) of a photo, letterboxed to 1280x720, for --use-file-for-fake-video-capture."""
    img = TMP / f'{name}.img'
    if str(src).startswith('http'):
        urllib.request.urlretrieve(src, img)
    else:
        img = Path(src)
    out = TMP / f'{name}.y4m'
    vf = f'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:{pad},format=yuv420p'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-loop', '1', '-i', str(img), '-t', '2', '-r', '10', '-vf', vf, str(out)], check=True)
    return out


def session(p, cam=None, init=None):
    args = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
    if cam:
        args.append(f'--use-file-for-fake-video-capture={cam}')
    b = p.chromium.launch(args=args)
    ctx = b.new_context(viewport=VIEWPORT, permissions=['camera'])
    if init:
        ctx.add_init_script(init)
    pg = ctx.new_page()
    errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    return b, pg, errors


def shot(pg, name):
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        pg.screenshot(path=str(SHOTS / f'{name}.png'))


def wait_for(pg, fn, timeout=30):
    end = time.time() + timeout
    while time.time() < end:
        if fn():
            return True
        pg.wait_for_timeout(250)
    return False


def own_photo(pg, selector):
    """True when the first <img> under selector is the person's own photo (a blob: URL from store/photos.ts)."""
    loc = pg.locator(f'{selector} img').first
    return loc.count() > 0 and (loc.get_attribute('src') or '').startswith('blob:')


def journal_has(pg, name):
    pg.goto(f'{BASE}#/journal'); pg.wait_for_timeout(800)
    tile = pg.locator('.p-tile', has_text=name).first
    return tile.count() > 0 and own_photo(pg, f'.p-tile:has-text("{name}") .p-tile__img')


known_cam, amb_cam, mug_cam = video('known', KNOWN[1]), video('ambiguous', AMBIGUOUS[1]), video('mug', MUG, pad='black')

with sync_playwright() as p:
    # (1) known bag, live
    b, pg, errors = session(p, known_cam)
    pg.goto(f'{BASE}#/scan')
    pg.wait_for_selector('.p-cam__pill'); pg.wait_for_timeout(1200); shot(pg, '1-live-viewfinder')
    opened = wait_for(pg, lambda: pg.evaluate('location.hash') == f'#/coffee/{KNOWN[0]}')
    c.ok(opened, f'(1) known bag opens {KNOWN[0]} by itself')
    pg.wait_for_timeout(800)
    c.ok(own_photo(pg, '.p-hero__bag'), '(1) its coffee page shows the photo just taken')
    pg.reload(); pg.wait_for_timeout(1000)
    c.ok(own_photo(pg, '.p-hero__bag'), '(1) after reload the coffee page still shows it')
    c.ok(journal_has(pg, 'Kieni'), '(1) after reload it is in the Journal with that photo (not rated yet)')
    c.ok(not errors, f'(1) no page errors {errors}')
    b.close()

    # (2)+(3) the owner's mug: live states, shutter in-app, add it now
    b, pg, errors = session(p, mug_cam)
    pg.goto(f'{BASE}#/scan'); t0 = time.time()
    seen = wait_for(pg, lambda: pg.locator('.p-cam__pill').count() and 'Opening' not in pg.inner_text('.p-cam__pill'), 3)
    c.ok(seen, f'(3) a visible camera state within 3 s ({time.time() - t0:.1f} s): "{pg.inner_text(".p-cam__pill")}"')
    got_reading = wait_for(pg, lambda: pg.locator('.p-cam__pill[data-busy]').count() > 0, 20)
    if got_reading:
        shot(pg, '2-reading')
    c.ok(got_reading, '(3) the pill shows "Reading…" while a frame is read')
    c.ok(wait_for(pg, lambda: pg.get_by_text('Can’t find it? Add it now').count() > 0, 30), '(3) after a read without a hit: "Can’t find it? Add it now"')
    c.ok(pg.locator('.p-cam video').count() == 1 and pg.evaluate("!!document.querySelector('.p-cam video').srcObject?.active"), '(3) camera still running')
    # After the 15 s auto-read budget the screen says so, keeps the way forward, and the camera stays on.
    c.ok(wait_for(pg, lambda: 'Tap the button' in pg.inner_text('.p-cam__pill'), 20), '(3) after the auto-read budget the pill says to tap the button')
    c.ok(pg.get_by_text('Can’t find it? Add it now').count() == 1, '(3) and "Add it now" is still there')
    c.ok(pg.evaluate("!!document.querySelector('.p-cam video').srcObject?.active"), '(3) camera still running after the loop stopped')
    # (2) shutter: no file chooser
    chooser = True
    try:
        with pg.expect_file_chooser(timeout=2500):
            pg.click('.p-scan__shutter')
    except PWTimeout:
        chooser = False
    c.ok(not chooser, '(2) camera granted: the shutter opens no file chooser')
    c.ok(wait_for(pg, lambda: pg.locator('.p-scan__sheet').count() > 0, 30), '(2) the shutter frame was read in-app (a result sheet rose)')
    c.ok(pg.locator('.p-cam__still').count() == 1 and pg.locator('.p-cam__still').get_attribute('src').startswith('data:image/jpeg'), '(2) over the frame it captured')
    # The real mug has too little text: the owner's "Move closer" sheet, now with a way to log it.
    c.ok('Move closer and hold still' in pg.inner_text('.p-scan__sheet'), '(3) the mug gives the "Move closer" sheet')
    c.ok(pg.get_by_role('button', name='Not found, add it now').count() == 1, '(3) which offers "Not found, add it now"')
    shot(pg, '2b-poor-read')
    chooser = True
    try:
        with pg.expect_file_chooser(timeout=2500):
            pg.get_by_role('button', name='Retake photo').click()
    except PWTimeout:
        chooser = False
    c.ok(not chooser and pg.locator('.p-scan__sheet').count() == 0, '(3) "Retake photo" goes back to the live camera, no file chooser')
    pg.wait_for_timeout(500); pg.click('.p-scan__shutter')
    c.ok(wait_for(pg, lambda: pg.get_by_role('button', name='Not found, add it now').count() == 1, 30), '(3) shutter again: the sheet again')
    pg.get_by_role('button', name='Not found, add it now').click()
    c.ok(pg.locator('.w-answer__photo').count() == 1, '(3) the add form shows the mug photo')
    c.ok('stays on this phone' in pg.inner_text('.p-scan__sheet'), '(3) the add form says the photo stays on the phone')
    pg.fill('input[placeholder="Coffee name"]', 'Office mug'); pg.fill('input[placeholder="Roaster"]', 'Rosberg')
    pg.click('.w-roasts button:has-text("Medium")'); pg.wait_for_timeout(400); shot(pg, '4-add-form-with-photo')
    pg.click('text=Save and rate it'); pg.wait_for_timeout(1000)
    c.ok(pg.evaluate('location.hash').startswith('#/coffee/custom-'), '(3) saving opens the new coffee page')
    c.ok(own_photo(pg, '.p-hero__bag'), '(3) the coffee page shows the mug photo')
    st = stored(pg)
    c.ok(any(u['name'] == 'Office mug' for u in st['userCoffees']), '(3) saved as one of your coffees (UserCoffee in pico-v2)')
    c.ok('data:image' not in pg.evaluate("localStorage.getItem('pico-v2')"), '(3) no photo inside pico-v2')
    shot(pg, '6-coffee-page-own-photo')
    pg.reload(); pg.wait_for_timeout(800)
    c.ok(journal_has(pg, 'Office mug'), '(3) after reload: in the Journal with the mug photo')
    c.ok(not errors, f'(2,3) no page errors {errors}')
    b.close()

    # (4) ambiguous bag via the shutter
    b, pg, errors = session(p, amb_cam)
    pg.goto(f'{BASE}#/scan'); pg.wait_for_selector('.p-scan__shutter:enabled'); pg.wait_for_timeout(600)
    pg.click('.p-scan__shutter')
    listed = wait_for(pg, lambda: pg.locator('.p-scan__sheet .p-cand').count() >= 2, 30)
    c.ok(listed, '(4) ambiguous bag: a list of candidates')
    if listed:
        box = pg.locator('.p-scan__sheet .p-cand__img').nth(1).bounding_box()
        c.ok(box['width'] >= 150 and box['height'] >= 180, f'(4) photo-led tiles ({box["width"]:.0f}x{box["height"]:.0f} px pictures)')
        c.ok(pg.locator('.p-cand .p-result__tag').count() == 1 and pg.locator('.p-cand').first.locator('.p-result__tag').count() == 1, '(4) "Most likely" only on the first')
        c.ok(pg.get_by_text('Not found, add it now').count() == 1, '(4) "Not found, add it now" in the list')
        pg.wait_for_timeout(400)  # after the sheet's rise
        row = pg.locator('.p-result--add').bounding_box()
        n = pg.locator('.p-scan__sheet .p-cand').count()
        c.ok(row['y'] >= 0 and row['y'] + row['height'] <= VIEWPORT['height'] and pg.evaluate("document.querySelector('.p-scan__sheet').scrollTop") == 0,
             f'(4) with {n} candidates the row is in view at 390x844 without scrolling (y {row["y"]:.0f}-{row["y"] + row["height"]:.0f})')
        pg.wait_for_timeout(1500); shot(pg, '3-list')  # after the sheet's rise and the bag pictures
        name = pg.locator('.p-scan__sheet .p-cand b').first.inner_text()
        pg.locator('.p-scan__sheet .p-cand').first.click(); pg.wait_for_timeout(1000)
        c.ok(own_photo(pg, '.p-hero__bag'), f'(4) picking "{name}" opens it with the photo')
        pg.reload(); pg.wait_for_timeout(800)
        c.ok(journal_has(pg, name), '(4) and it is in the Journal after reload')
        shot(pg, '5-journal-own-photos')
    c.ok(not errors, f'(4) no page errors {errors}')
    b.close()

    # (5) camera denied: file input
    b, pg, errors = session(p, mug_cam, DENY_CAMERA)
    pg.goto(f'{BASE}#/scan')
    c.ok(wait_for(pg, lambda: 'Take a photo' in pg.inner_text('.p-cam__pill'), 3), '(5) camera denied: the screen says to take a photo at once')
    try:
        with pg.expect_file_chooser(timeout=3000) as fc:
            pg.click('.p-scan__shutter')
        fc.value.set_files(str(MUG))
        c.ok(fc.value.element.get_attribute('capture') == 'environment', '(5) the shutter opens the camera file input')
        c.ok(wait_for(pg, lambda: pg.get_by_role('button', name='Not found, add it now').count() == 1, 30), '(5) the photo is read: "Move closer" sheet with "Not found, add it now"')
        pg.get_by_role('button', name='Not found, add it now').click()
        c.ok(pg.locator('.w-answer__photo').count() == 1, '(5) the add form shows that photo')
    except PWTimeout:
        c.ok(False, '(5) camera denied: the shutter opens a file chooser')
    pg.goto(f'{BASE}#/discover'); pg.goto(f'{BASE}#/scan'); pg.wait_for_selector('.p-cam__library')
    with pg.expect_file_chooser(timeout=3000) as fc:
        pg.click('.p-cam__library')
    c.ok(fc.value.element.get_attribute('capture') is None, '(5) the library button opens a picker without capture')
    c.ok(not errors, f'(5) no page errors {errors}')
    b.close()

    # (8) the menu scan uses the same in-app camera: no file chooser when granted, the file input when denied
    b, pg, errors = session(p, mug_cam)
    pg.goto(f'{BASE}#/menu'); pg.wait_for_selector('.p-scan__shutter:enabled')
    chooser = True
    try:
        with pg.expect_file_chooser(timeout=2500):
            pg.click('.p-scan__shutter')
    except PWTimeout:
        chooser = False
    c.ok(not chooser, '(8) menu: camera granted, the shutter opens no file chooser')
    c.ok(wait_for(pg, lambda: pg.locator('.p-results, .w-poor').count() > 0, 30), '(8) menu: the captured frame was read')
    if pg.locator('.w-poor').count():
        chooser = True
        try:
            with pg.expect_file_chooser(timeout=2500):
                pg.get_by_role('button', name='Retake photo').click()
        except PWTimeout:
            chooser = False
        c.ok(not chooser and pg.locator('.p-cam video').count() == 1, '(8) menu: "Retake photo" goes back to the in-app camera, no file chooser')
    else:
        c.ok(False, '(8) menu: expected the mug to give the "Move closer" sheet')
    c.ok(not errors, f'(8) no page errors {errors}')
    b.close()
    b, pg, errors = session(p, mug_cam, DENY_CAMERA)
    pg.goto(f'{BASE}#/menu'); pg.wait_for_selector('.p-scan__shutter:enabled')
    try:
        with pg.expect_file_chooser(timeout=3000) as fc:
            pg.click('.p-scan__shutter')
        c.ok(fc.value.element.get_attribute('capture') == 'environment', '(8) menu: camera denied, the shutter opens the camera file input')
    except PWTimeout:
        c.ok(False, '(8) menu: camera denied, the shutter opens a file chooser')
    b.close()

    # (9) a coffee you added yourself is found by the live read, not only by the shutter
    OWN = "localStorage.getItem('pico-v2') || localStorage.setItem('pico-v2', JSON.stringify({ version: 1, userCoffees: [{ id: 'custom-e2e-kieni', name: 'Kieni', roaster: 'Coffee Collective', origin: 'Kenya', process: 'Washed', roastLevel: 'light', flavorTags: ['fruity'], description: 'Added by hand.', isCustom: true, userId: 'local', updatedAt: '2026-11-15T00:00:00Z', sentToPico: false }] }));"
    b, pg, errors = session(p, known_cam, OWN)
    pg.goto(f'{BASE}#/scan')
    # Alone, the catalog Kieni opens by itself in (1). With your own "Kieni" in the list the live read sees two equal hits,
    # so it must not open the catalog one (it did while LiveScan matched the catalog only).
    wait_for(pg, lambda: pg.evaluate('location.hash') != '#/scan', 20)
    c.ok(pg.evaluate('location.hash') != f'#/coffee/{KNOWN[0]}', f'(9) the live read sees your own "Kieni": it no longer opens the catalog one by itself ({pg.evaluate("location.hash")})')
    if pg.evaluate('location.hash') == '#/scan':
        pg.click('.p-scan__shutter')
        c.ok(wait_for(pg, lambda: pg.locator('.p-cand .p-bag-fallback').count() > 0, 30), '(9) the shutter lists both, yours among them')
    c.ok(not errors, f'(9) no page errors {errors}')
    b.close()

    # (6) IndexedDB blocked
    b, pg, errors = session(p, known_cam, BLOCK_IDB)
    pg.goto(f'{BASE}#/scan')
    c.ok(wait_for(pg, lambda: pg.evaluate('location.hash') == f'#/coffee/{KNOWN[0]}'), '(6) IndexedDB blocked: the scan still opens the coffee')
    pg.wait_for_timeout(500)
    pg.click('.p-rate button[aria-label="4 stars"]'); pg.click('.p-cta__save'); pg.wait_for_timeout(400)
    c.ok(any(x['coffeeId'] == KNOWN[0] and x['stars'] == 4 for x in stored(pg)['cups']), '(6) and rating it still saves the cup')
    c.ok(not errors, f'(6) no page errors {errors}')
    b.close()

    # (7) + screenshot of a Journal with own photos: 200 photos stored, first paint measured
    SEE_EMPTY = "new MutationObserver(() => { if (document.body && document.body.innerText.includes('No cups yet')) window.__sawEmpty = true; }).observe(document, { childList: true, subtree: true, characterData: true });"
    b, pg, errors = session(p, init=SEE_EMPTY)
    pg.goto(f'{BASE}#/journal'); pg.wait_for_timeout(500)
    pg.evaluate("""async () => {
      const canvas = Object.assign(document.createElement('canvas'), { width: 800, height: 1000 });
      const g = canvas.getContext('2d'); g.fillStyle = '#6b4a2b'; g.fillRect(0, 0, 800, 1000);
      const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
      const ids = ['coffee-collective-kieni', 'la-cabra-megadu', 'kontra-kenya-gicherori', 'prolog-kigari-aa'];
      const db = await new Promise((r) => { const q = indexedDB.open('pico-photos', 1); q.onupgradeneeded = () => q.result.createObjectStore('photos', { keyPath: 'id' }); q.onsuccess = () => r(q.result); });
      const tx = db.transaction('photos', 'readwrite');
      for (let i = 0; i < 200; i++) tx.objectStore('photos').put({ id: 'p' + i, coffeeId: ids[i % ids.length], takenAt: new Date(Date.now() - i * 60000).toISOString(), blob });
      await new Promise((r) => { tx.oncomplete = r; }); db.close();
    }""")
    pg.reload(); pg.wait_for_selector('.p-tile'); pg.wait_for_timeout(500)
    fcp = pg.evaluate("performance.getEntriesByName('first-contentful-paint')[0]?.startTime")
    c.ok(fcp is not None and fcp < 1500, f'(7) 200 photos: Journal first contentful paint {fcp:.0f} ms')
    c.ok(pg.locator('.p-tile').count() == 4 and own_photo(pg, '.p-tile__img'), '(7) 4 unrated scanned coffees in the Journal, own photos')
    c.ok(not pg.evaluate('!!window.__sawEmpty'), '(7) the Journal never flashed "No cups yet" while the photos loaded')
    shot(pg, '7-journal-200-photos')
    c.ok(not errors, f'(7) no page errors {errors}')
    b.close()

c.done()
