# pico — Vivino for Coffee

Pick the right coffee. Find or add a bag, rate it, keep a brew journal, build your taste profile, and discover similar coffees.

**Live site:** https://westsoever.github.io/pico/

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Test on iPhone

1. **Same Wi‑Fi:** Run `npm run dev -- --host` and open `http://<your-computer-ip>:5173` on your iPhone.
2. **Camera:** Safari requires HTTPS for camera access. If the camera fails over HTTP, deploy to GitHub Pages or use ngrok.
3. **Add to Home Screen:** Optional — open in Safari → Share → Add to Home Screen.

## Deploy

```bash
npm run build
```

Deploy the `dist` folder to Vercel, Netlify, or any static host.

**GitHub Pages** (permanent, at `https://westsoever.github.io/pico/`):

```bash
VITE_BASE=/pico/ npm run build
npx gh-pages -d dist -b gh-pages
```

Then enable GitHub Pages in repo Settings → Pages → source: `gh-pages` branch.

Pushes to `main` also deploy automatically via GitHub Actions.

## Core loop

1. **Discover** — Search the catalog, browse by roast, or add details from a bag
2. **Rate** — Save stars, flavor tags, and a tasting note
3. **Journal** — Revisit coffees, photos, notes, and optional brew recipes
4. **Taste** — See your preference patterns and explainable recommendations

The default flow stays intentionally quick. Enthusiasts can expand **Brew details** while rating to record method, dose, water or yield, temperature, grind, and brew time.

## Functionality

### Discover

- Browse the built-in specialty coffee catalog or filter it by roast level.
- Search by coffee, roaster, origin, process, variety, score, description, or flavor.
- Reopen recently tasted coffees.
- Add a custom coffee by copying details from its bag.
- Capture or choose a label photo. Pico resizes the image before storing it; it does not currently identify coffee from the photo.

### Rate and record

- Rate coffee from 1–5 stars with mouse, touch, or keyboard controls.
- Select flavor tags and save an optional tasting note.
- Attach a resized bag photo to the saved rating.
- Optionally record a repeatable brew recipe:
  - method
  - coffee dose
  - water or beverage yield
  - water temperature
  - grind size
  - brew time
- Update an existing saved rating without creating duplicates.
- Protect unsaved drafts when navigating away and report recoverable storage errors.

### Journal

- Review saved coffees with ratings, notes, photos, flavors, dates, and brew summaries.
- Search across coffee metadata, notes, and displayed flavor tags.
- Filter by favorites, attached photos, or roast level.
- Sort by newest, highest rated, or coffee name.
- View journal totals, average rating, and photo count.

### Taste

- Build a taste profile from coffees rated 4 stars or higher.
- Show relative flavor strengths and preferred origins, processes, and roast levels.
- Track profile maturity as more coffees are rated.
- Recommend unrated coffees using flavor, origin, process, and roast similarity.
- Explain why each recommendation matches the saved taste profile.

### App behavior

- Responsive mobile bottom navigation and desktop sidebar navigation.
- URL-backed Discover, Journal, Taste, and coffee-detail views with browser Back/Forward support.
- Accessible focus handling, semantic controls, reduced-motion support, and keyboard-operable ratings.
- Installable web-app metadata and iOS home-screen icon.
- Local-first persistence with validation and recovery from malformed saved records.
- No account, backend, analytics, or cloud sync: catalog additions and ratings remain in that browser's local storage.

## Quality checks

```bash
npm test
npm run lint
npm run build
VITE_BASE=/pico/ npm run build
```

The automated suite covers primary journeys, navigation guards, catalog and storage validation, taste calculations, brew boundaries, journal controls, keyboard ratings, and photo processing.

## Submodule setup

Use this repo as a submodule in a parent repository (for example at `02-Projects/pico`):

```bash
git submodule add https://github.com/westsoever/pico.git 02-Projects/pico
git commit -m "Add pico submodule"
git push origin main
```

See [PLAN.md](./PLAN.md) for the full build plan and [BUILD-LATER.md](./BUILD-LATER.md) for deferred features.
