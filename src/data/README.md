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
- 3,000 coffees: about 2.7 MB raw and 0.6 MB gzipped. Measured with a synthetic catalog of 3,000 entries: search takes 6 ms per keystroke and label matching 225 ms per scan. Both are fine.
- Past about 5,000 coffees, load the catalog with `fetch` after the first screen instead of bundling it.
