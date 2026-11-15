# Pico trajectory (draft, updated 2026-11-15)

Goal: settle the decisions that are expensive to change *before* building v2, so building becomes execution.

## Decided (owner, 2026-11-15)

1. **v2 replaces v1.** No hidden `/v2/` beta: prototype, then build, then switch everything to v2. v2 is a reskin on the existing `src/lib/` logic, not a rewrite.
2. **Journal keeps every cup.** Each rating is its own entry with an `id` and date; re-rating a coffee adds an entry instead of replacing it. Per coffee the user also sees the total: how many times, average stars, latest rating, all entries. (Today `saveRating` replaces the earlier rating; existing ratings migrate as one entry each.)
3. **Roaster ids.** Roaster becomes an entity with an id (today a free string, 21 roasters), set in a catalog batch. Find Cafe and buying hang off it.
4. **Photos are links, not bundled or stored on the phone.** All images (catalog bag photos and users' label photos) live in one image store (object storage + CDN, e.g. Supabase Storage or Cloudflare R2) and the app only keeps URLs. Served in phone-sized variants. Catalog photos are copied there instead of hotlinked from roaster sites (only for roasters who gave permission).
5. **Accounts from the start, sign-in optional at first.**
   - Without an account: scan a coffee and see its info and match, up to 5 scans.
   - Rating, journal, more scans: create an account.
   - Journal lives on the server, so it syncs and survives Safari's 7-day deletion. Ratings already on a phone from v1 are imported on sign-up.
6. **"View at roaster" clicks measure demand** before any buying feature.
7. **Add to Home Screen** stays encouraged (protects anything kept on the phone). The Qerko-style automatic install is parked for later.

## Consequences

- **Backend needed for v2 launch:** auth (email + Apple/Google), database (users, ratings, roasters, coffees), image storage. Supabase covers all three.
- **Privacy policy and terms become required** (accounts + personal data, GDPR). LAUNCH.md item 7 is no longer optional.
- **Scan limit:** 5 free scans counted on the device is easy to bypass; fine as a nudge, not as protection.
- **Catalog stays a static file** built from batches in git (scan matching runs on the phone against the whole catalog). The database holds users, cups, hand-added coffees; images live in the image store. See `DATA-MODEL.md`.

## Backlog, sorted by what each one forces

| Item | Needs | When |
|---|---|---|
| Sharable cards | Coffee + rating data, image store | v2, early. Also free growth |
| Monthly stats / Wrapped | Cup log (decision 2) | After a month of logs |
| User profiles | Accounts (in v2 from day one) | v2 or soon after |
| Find Cafe | Roaster ids + new Cafe data and Cafe↔Roaster/Coffee link | Data collection is the hard part |
| Buying through the app | Roaster entity, offers, partner deals | Last, once click data shows demand |
| Easy install (Qerko-style) | Service worker (Android install prompt); App Clip needs a native app | Later |

## Proposed order

1. *(Built 2026-11-15: `prototype/`, run locally.)* Prototype every v2 screen, including the undesigned ones: sign-up wall after 5 scans, Taste, Scan flow, empty first run, per-coffee rating history, share card, Wrapped. Test with ~5 people.
2. *(Drafted: `DATA-MODEL.md`.)* Data model: users, ratings (cup log), coffees, roasters, images.
3. Backend, tested locally first (local Supabase via Docker or a fake server), then a Supabase project, auth, tables, image bucket; migrate the catalog and catalog photos.
4. Build v2 screens on `src/lib/`, with `storage.ts` / `catalog.ts` switched to the backend.
5. Switch the site to v2.
6. Then: profiles, Wrapped, Find Cafe data, buying.

## From prototype to product (drafted 2026-11-15)

Core loop (owner, 2026-11-15): **scan a bag → see its community rating and whether it fits my taste**. Rating feeds the coffee's average and sharpens the user's match.

Besides database and hosting:

1. **Freeze the design** → move the prototype screens into `src/` (FABLEWORKER), drop the fake auth, demo states and Prototype panel; keep `src/lib` logic.
2. **Scan accuracy is now the #1 product risk.** Scanning is the main action, and the last eval found the right coffee in the top 3 for only 11 of 20 bags. Next: test 30 real bags, then improve matching (roaster logo/name weighting, catalog aliases) or add barcode/QR where bags have one.
3. **Community rating cold start.** No users means no averages. Seed it honestly: owner, friends, a few cafés and roasters rate the catalog before launch; "New on Pico" below 3 raters. Never fake numbers.
4. **Accounts and data:** email code + Google sign-in; move phone-only cups to the account on sign-up; v1 journal import; delete my data / export (GDPR).
5. **Legal:** privacy policy + terms (required with accounts and for the App Store), named operator and contact.
6. **Images:** roaster photo permission (YAMM email 2026-11-16) → copy permitted photos to Pico's image store with `imageKind`; drop or replace photos for roasters who say no.
7. **Catalog quality:** 18 coffees still lack Filter/Espresso; roaster ids; `available: false` for sold-out coffees (e.g. Andersen & Maillard Los Angeles Pacamara 404); keep growing the catalog; fix the batch script so partial entries merge as the README says.
8. **App feel:** service worker (offline + Android install prompt), Add to Home Screen hint, real iPhone test pass.
9. **Quality gates:** end-to-end tests for the core flows (scan → coffee → rate → journal; sign-up moves cups), fix the flaky 5s timeouts in `App.test.tsx`, usability test with ~5 people.
10. **Measure:** GoatCounter events for scan success/fail, rating saved, "View at roaster" (demand proof before any buying feature).
