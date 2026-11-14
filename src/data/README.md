# Coffee catalog

`coffees-dk.json` is the one catalog the app ships. Browse, search, label scanning, and recommendations all read it. It is bundled into the app at build time, so there is no server or database to run.

New coffees reach it through batches:

```
src/data/raw/       what was scraped from roaster sites (provenance only, the app never reads it)
src/data/batches/   coffees ready to merge, one JSON array per file
coffees-dk.json     the merged catalog the app ships
```

## Ingest a batch

1. Turn the raw scrape into catalog entries (format below) and save them as `src/data/batches/<yyyy-mm-dd>-<source>.json`.
2. Dry run: `npm run catalog`. It validates every entry and prints what would be added, updated, held back, or skipped. Nothing is written.
3. Fix what it reports, then run `npm run catalog -- --write`.
4. Run `npm test && npm run build` and commit the batch file together with `coffees-dk.json`.

The merge rules:

- Never hand-edit `coffees-dk.json`. Batch files stay in `batches/` and every `--write` replays all of them, so a hand edit to a coffee that a batch also lists is overwritten. Put every change in a new batch file instead.
- Batches apply in file-name order, so a later file wins.
- **Ids never change.** Saved ratings in people's browsers point at them. To update a coffee, reuse its id. A batch entry with a known id is merged into the existing coffee, and fields the entry leaves out are kept.
- A new id whose roaster and name already exist under another id is held back as a likely duplicate.
- Invalid entries are skipped and the script exits with code 1.
- Nothing is deleted. When a roaster stops selling a coffee, set `"available": false`. The app then marks it "Past coffee".

## Entry format

```json
{
  "id": "coffee-collective-kieni",
  "name": "Kieni",
  "roaster": "Coffee Collective",
  "roasterCity": "Copenhagen",
  "origin": "Kenya",
  "region": "Nyeri",
  "producer": "Kieni Cooperative",
  "process": "washed",
  "variety": "SL28, SL34, Batian, Ruiru 11",
  "altitude": "1600–1800 masl",
  "roastLevel": "light",
  "roastStyle": "filter",
  "tastingNotes": ["blackcurrant", "blackberry", "rhubarb"],
  "flavorTags": ["berry", "fruity", "heavy-body"],
  "description": "One or two sentences in Pico's voice.",
  "imageUrl": "https://cdn.shopify.com/…/Kieni250gfront.png",
  "sourceUrl": "https://coffeecollective.dk/products/kieni-250-g",
  "available": true
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | `<roaster-slug>-<coffee-slug>`, lowercase. Never reuse one for a different coffee. |
| `name`, `roaster`, `origin`, `process` | yes | Non-empty text. Origin is the country in English ("Ethiopia", not "Etiopien"). Process is lowercase: `washed`, `natural`, `honey`, `anaerobic`, … |
| `roastLevel` | yes | `light`, `medium`, or `dark`. |
| `flavorTags` | yes | Array, may be empty. Only `fruity`, `chocolate`, `floral`, `nutty`, `bright`, `heavy-body`, `caramel`, `berry`, `citrus`, `spice`. Taste profiles and recommendations run on these. |
| `description` | yes | Text, may be empty. |
| `tastingNotes` | recommended | The roaster's own words, lowercase. Label scanning matches them. |
| `imageUrl`, `sourceUrl` | recommended | http(s) only. Shopify images are fetched at small sizes automatically. |
| `region`, `producer`, `variety`, `altitude`, `roasterCity`, `roastStyle`, `scaScore`, `available` | optional | `roastStyle` is `filter`, `espresso`, or `omni`. Invalid optional fields are dropped and reported. |

The dry run warns when an entry lacks `imageUrl`, `sourceUrl`, `tastingNotes`, `region`, `roastStyle`, or `roasterCity`. Coffees without them still show, but their pages look bare and label scans match them less often.

## Size

The catalog is bundled into the app, so it adds to the first download. At about 0.9 KB per coffee (0.2 KB gzipped):

- 20 coffees today: 18 KB.
- 3,000 coffees: about 2.7 MB raw and 0.6 MB gzipped. Measured in Node on a laptop with a synthetic catalog of 3,000 entries: search takes 6 ms per keystroke and label matching 225 ms per scan. Expect a phone to be a few times slower, which is still usable.
- Past about 5,000 coffees, load the catalog with `fetch` after the first screen instead of bundling it.
- The roaster filter on Discover is one row of chips. It works for a few dozen roasters; past that it needs a dropdown or search.

## Where more coffees can come from (researched 2026-11-14)

No open dataset covers specialty roasted coffee in Denmark. What exists:

| Source | What it has | Terms | Use for Pico |
|---|---|---|---|
| Roaster Shopify stores (`<shop>/products.json`) | Every coffee a roaster sells: name, body text with origin/process/notes, images, availability | Facts are fine to restate; descriptions and photos are the roaster's copyright | Main source. Ask roasters for permission, take facts, write our own descriptions, link images back. |
| Open Food Facts | 15,800 coffees with barcodes; Denmark: 36, all supermarket brands (Merrild, BKI, Nescafé, Coop) | ODbL (share-alike), images CC BY-SA | Barcode lookup at scan time only. Do not bundle rows, or the whole catalog may become ODbL. |
| CQI Coffee Quality Database (GitHub/Kaggle scrapes, 2018) | ~1,340 green-lot cupping scores | Underlying CQI terms unknown | Vocabulary reference for origins, processes, varieties. Do not ship. |
| Cup of Excellence, Coffee Review | Auction lots; ~10,000 reviews | All rights reserved; Coffee Review forbids copying | Link out at most. |
| SCA / World Coffee Research | Flavor Wheel (CC BY-NC-ND 4.0), Sensory Lexicon (personal-use copies), CVA cupping forms (redistribute unmodified only) | No per-coffee data or API | Write our own note-to-flavor-tag mapping; do not copy the wheel's tree. |

`scaScore`: SCA publishes no scores of specific coffees, and its 2024 Coffee Value Assessment replaced the old 100-point form. Only fill `scaScore` when the roaster prints a score, and treat it as the roaster's claim.
