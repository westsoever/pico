# Go-live checklist (picoV2)

Written 2026-11-14 for the launch on Monday 2026-11-16. Work happens on branch `picoV2`. Merging it into `main` deploys the site (GitHub Actions), so merge only when the must-fix items are done and the owner says go.

Outreach files live outside this public repo, in the owner's vault: `~/cos/02-Projects/pico/outreach/` (`copenhagen-roasters.csv` for YAMM, `roaster-email.md`).

## Must fix before launch

- [x] **1. Journal backup.** Done: the Journal shows a dismissible Home Screen hint on iPhone/iPad Safari once it has a rating, and has "Save backup" / "Restore backup" (JSON file, ratings + hand-added coffees, newer rating wins). Restore is also on the empty Journal, for a new phone. Ratings live only in localStorage. Safari on iPhone deletes a site's stored data after 7 days without a visit, unless the site was added to the Home Screen. Build both:
  - an "Add Pico to your Home Screen" hint after the first save (iOS Safari only, dismissible);
  - export and import of the journal as a JSON file (ratings + custom coffees), for example on the Journal page.
  About 1–2 hours. `navigator.storage.persist()` is already requested after a save, but it does not stop Safari's 7-day rule.
- [x] **2. Scan test on a real iPhone (owner).** Done 2026-11-14 on the live site: owner reports it looks good. Scan 10 real bags. A synthetic eval on degraded roaster photos found the right coffee in the top 3 for only 11 of 20. If it is weak, word the action "Scan to search" so people expect the fallback. While on the iPhone, also check: the Home Screen hint shows on the Journal in Safari (not from the Home Screen icon), "Save backup" saves a file to Files, and "Restore backup" reads it back.
- [ ] **3. Roaster permission.** The 75 catalog coffees show roaster photos (hotlinked) and facts without permission; descriptions are Pico's own. Send the YAMM email. Until roasters reply, decide whether to keep only facts and the roaster link, and drop photos for roasters who have not answered.
- [x] **4. Grow the catalog.** Done 2026-11-14: 75 coffees from 21 roasters (batch `src/data/batches/2026-11-14-shopify-02.json`; 37 light, 24 medium, 14 dark). Lagom, EverBean, Haldrup, Piccolo and Skåstrupkaffen are outside Copenhagen and not in the outreach CSV yet. Haldrup coffees have no photo (its shop only has AI renders). It had 20 coffees from 6 roasters, so most scans would miss. Use roaster replies, or 2–3 hours of manual entry from roaster shops, to reach 60–100 coffees via `src/data/batches/` and `npm run catalog` (see `src/data/README.md`). Leave `flavorTags` empty; the script fills them from tasting notes.

## Should do soon after launch

- [x] **5. Learn from misses.** Done: a hand-added coffee's page has "Send this coffee to Pico", a prefilled email to info@sunseekerlabs.dk. Coffees people add by hand stay on their phone. Add a "Send this coffee to Pico" mailto link after a manual add, prefilled with the details, about 30 minutes. This is how Vivino grew its database (see `research/vivino.md`).
- [ ] **6. Usage numbers.** GoatCounter script and "View at roaster" click events are in the code (site code `ljessen`, 2026-11-14). Still to do (owner): the `ljessen` site exists; allow `westsoever.github.io` in its settings; until then nothing is counted. An earlier note said to defer counting until logins exist, so reverse this if that still holds. Cookie-free counter such as GoatCounter or Plausible. It needs no consent banner.
- [ ] **7. About and privacy page.** Deferred (owner, 2026-11-14): Pico will become an app, so maybe not needed. An App Store listing still needs a privacy policy URL. Say there is no account and no tracking, data stays on the phone, and label photos are never uploaded. Name who runs Pico and give a contact.
- [x] **8. First scan is slow.** Done: touching the scan button starts the download while the camera is open. The OCR reader downloads about 7 MB on first use. The status line now says so. Consider preloading it when the scan button is tapped.
- [x] **9. Android icon.** Done: `public/icon-192.png`, `public/icon-512.png` in the manifest and the deploy copy step. The manifest only has an SVG. Add 192px and 512px PNG icons.
- [x] **10. Link previews.** Done (image: the 512px icon). Add Open Graph title, description, and image to `index.dev.html`.
- [x] **11. "SCA score" label.** Done. Rename it to "Cupping score" in `CoffeeDetail.tsx` and `ManualCoffeeForm.tsx`. The SCA publishes no per-coffee scores; see `research/sca.md`.

## Later (from Vivino's playbook)

- [ ] **"Match for you" percentage** on every coffee page after 5 ratings. It works for a single user, so it is the strongest next feature.
- [ ] **Track "View at roaster" clicks** to show roasters real demand before talking about any commission.
- [ ] **Community ratings** ("N ratings", shared average). Needs a small backend.
- **Skip for now:** social feed, premium plan, selling coffee. Vivino added commerce 6–7 years in.

## Already done on picoV2

Every core flow works:
- Scan, rate, journal, taste, back/forward and reload, checked on a production build.
- Remove a coffee from the journal.
- Manual add after a scan prefills the roaster read from the label.

Also done:
- Small catalog images.
- Label photos stored at 800px.
- iOS can choose from the photo library.
- Tasting notes map to flavor tags (`flavorTagsFromNotes`).
- Barcode field removed: Pico recognises bags by their label only.
- Journal backup: Home Screen hint, save and restore a JSON backup.
- 91 tests pass.
