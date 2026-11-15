# Pico v2 data model (draft, 2026-11-15)

Written before any server code, so v2 is built once. The prototype in `prototype/` uses these same shapes in a fake local store.

## Where each thing lives

| Data | Lives in | Why |
|---|---|---|
| Catalog: coffees, roasters | Static JSON built from `src/data/batches/` (as today), shipped with the app | Scan matching runs on the phone against the whole catalog. 65 KB for 75 coffees; fine to ~1–2k, then fetch it as a separate cached file |
| Users, cups (ratings), saved coffees, hand-added coffees | Database (Supabase Postgres later; local first) | Personal, synced across devices, survives Safari's 7-day deletion |
| Images | One image store (object storage + CDN), app keeps URLs only | Smaller app, faster load, nothing heavy on the phone |
| Scan count for signed-out users | On the phone | A nudge, not a lock (easy to reset); fine for 5 free scans |
| Cups rated while signed out | On the phone, under a local user id; moved into the account on sign-up | Rate before account: no sign-up wall before the first cup |

## Entities

```ts
// Catalog (static, ids never change)
Roaster {
  id: string            // slug, e.g. "coffee-collective"; derived once in a batch, then fixed
  name: string
  city?: string
  websiteUrl?: string
  imagePermission: 'granted' | 'pending' | 'refused'   // photos shown only when granted
}

Coffee {
  id: string            // existing ids, unchanged
  roasterId: string     // NEW, replaces the free-text `roaster` (keep `roaster` name for display until migrated)
  name, origin, process, roastLevel, roastStyle?, variety?, region?, producer?, altitude?
  flavorTags: FlavorTag[]
  tastingNotes?: string[]
  description: string
  imageUrl?: string     // points to Pico's image store, not the roaster's site
  imageKind?: 'cutout' | 'plain' | 'photo'  // transparent cutout or bag on plain white (both shown contained), or full photo (edge to edge); set when the image is stored
  sourceUrl?: string    // "View at roaster"
  available?: boolean
}

// Database (per user)
User {
  id: uuid              // from auth
  displayName: string
  createdAt: timestamp
}

Cup {                   // one entry per time you rate a coffee: the journal is a log
  id: uuid              // generated on the phone, so it can be saved offline and synced later without duplicates
  userId: uuid
  coffeeId: string      // catalog id or a UserCoffee id
  stars: 1..5
  flavorTags: FlavorTag[]
  note: string
  brew?: BrewJournal    // as today
  photoUrl?: string     // label photo in the image store
  ratedAt: timestamp
  deletedAt?: timestamp // soft delete, so sync can remove it on other devices
}

SavedCoffee {           // wishlist: coffees the user wants to try ("Saved" tab)
  userId: uuid
  coffeeId: string
  savedAt: timestamp      // removed when the user logs their first cup of it
}

UserCoffee {            // coffee added by hand when a scan found nothing (today: "custom-<uuid>")
  id: string            // "custom-<uuid>", unchanged format
  userId: uuid
  ...same fields as Coffee, roaster as free text
  sentToPico: boolean   // the "Send this coffee to Pico" step
}
```

## Derived, never stored

- **Per-coffee totals** (times rated, average, latest, all cups): computed from `Cup` rows.
- **Taste profile and match %**: computed on the phone from the user's cups (`computeTasteProfile`, `scoreSimilarity`), as today.
- **Monthly stats / Wrapped**: computed from `Cup.ratedAt` for the month.
- **Community rating per coffee** (core, owner 2026-11-15: "I take a picture to see the rating and whether it fits my taste"): a database view over all cups. Each user counts once per coffee (their own average for that coffee), so logging many cups doesn't outweigh others. Shown as `★ 4.3 · 12 ratings` once a coffee has at least 3 raters (owner 2026-11-15: raise to 5 once Pico has 100 users; keep it one constant); below that, "New on Pico". Public numbers only, no names. Only signed-in users' cups count; cups kept on the phone before sign-up count once the account exists. Cached on the phone so a scan shows it offline.

## Migration from v1

- v1 `Rating` (one per coffee, in localStorage `pico-user-data`) becomes one `Cup` each, with a new id and the old `ratedAt`.
- `photoDataUrl` is uploaded to the image store and replaced by `photoUrl`.
- v1 custom coffees become `UserCoffee` rows with the same id.
- Offered once after sign-up on a phone that has v1 data ("Add 6 coffees from this phone to your account?").

## Open points

1. **Label photos: public unguessable link or private?** Private (signed URLs) is safer for personal photos; public links are simpler and enough for catalog images. Proposal: catalog images public, label photos private.
2. **What a signed-out scan shows.** Coffee facts and tasting notes for sure. A personal match needs ratings, and community ratings don't exist at launch. Prototype shows facts plus "Rate it to start your taste profile".
3. **Hand-adding a coffee signed out:** prototype requires an account (it saves to your journal).
