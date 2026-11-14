# Specialty Coffee Association: what Pico can use

Researched 2026-11-14. This is not legal advice. The summary of other coffee data sources is in `src/data/README.md`.

## In short

- The SCA publishes standards, forms, and reports. It publishes **no scores or data for specific coffees** and has no API.
- Cupping scores of green lots sit in the CQI (Coffee Quality Institute) database. Its reuse terms could not be read. The MIT-licensed GitHub scrape (about 1,340 rows, 2018) licenses only the scraper code, not CQI's data.
- The 2024 **Coffee Value Assessment (CVA)** replaced the old 100-point cupping form and avoids a single score. An "SCA score" is therefore only a roaster's own claim, not an SCA fact ([Daily Coffee News](https://dailycoffeenews.com/2024/11/05/sca-officially-adopts-new-cupping-forms-and-standards/)).

## Resources

| Resource | Terms | Use for Pico |
|---|---|---|
| Coffee Taster's Flavor Wheel (SCA/WCR 2016, [store](https://sca.coffee/store)) | CC BY-NC-ND 4.0. A paid PDF; an EPS version comes with its own licence. | Only as an unmodified image with attribution, and only while Pico is non-commercial. Don't rebuild its structure. |
| WCR Sensory Lexicon 2.0 ([WCR](https://worldcoffeeresearch.org/resources/sensory-lexicon)) | Free for personal-use copies. No licence stated. | Embedding needs WCR's permission. |
| CVA forms ([SCA](https://sca.coffee/value-assessment)) | May be redistributed only without modification. | Link to them. Their descriptive categories (Floral, Fruity > Berry/Citrus …) roughly match Pico's tags. |
| SCA standards, research, Coffee Science Foundation | Mostly members-only. The [Terms](https://sca.coffee/terms) bar reproducing or distributing content. | Low value. |
| Specialty Coffee Transaction Guide | Green-coffee prices only, not retail. | Low value. |

## Decisions for Pico

- Pico maps roaster tasting notes onto its 10 flavor tags with its own word list: `flavorTagsFromNotes` in `src/lib/catalog-schema.ts`. Nothing is copied from the wheel or the lexicon.
- Fill `scaScore` only when the roaster prints a score on the bag. Label it as the roaster's claim and call it "Cupping score", not "SCA score".
- Don't use the SCA name or logo; both are SCA trademarks.
