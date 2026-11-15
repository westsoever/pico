# Pico v2 screens

The live site. `index.dev.html` loads `src/v2/main.tsx`, so `npm run build` and the Pages deploy ship it.
One file per screen (`welcome`, `discover`, `coffee`, `scan`, `journal`, `taste`, `account`, `share`, `add`), shared
parts in `parts.tsx`, hash routing in `routing.ts`, the router in `App.tsx`, FableAgent's feature screens in
`features/`, styles in `app.css` (+ `features/wow.css`).

**State** (`state.ts`): one instance of the real v2 store (`src/v2/store`, localStorage `pico-v2`) with its sync engine
talking to an in-memory fake server: nothing leaves the phone yet. Coffees are looked up in the catalog plus your own
(`coffeeById`, `allCoffees`): hand-added and label-sketched coffees are UserCoffees. v1 data is only read: the
journal in `pico-user-data` (Import screen, offered once) and `pico-custom-coffees` (adopted as your coffees on start).

**Scan photos** (`src/v2/store/photos.ts`): when a scan ends at a coffee, its photo is kept in IndexedDB on the phone
(not in `pico-v2`) and becomes that coffee's picture in the Journal and on its page. Local only until accounts.

**Accounts** are fake and hidden on the live site (`ACCOUNTS` in `state.ts`: dev or `?proto` only). The live site says
"Accounts are coming"; real sign-in (`src/v2/auth.ts`, Supabase) is NEXT.md step b.

**Design review:** in dev, or with `?proto` on the live site (e.g. `/pico/?proto#/discover`), the Prototype pill jumps
between demo states (`demo.ts`: first visit, 1 or 0 free scans left, new account, 3 months of cups) and screens;
`?proto&state=regular` does the same from a link. Community ratings there are SAMPLE DATA from the demo states.

**Run:** `npm run dev`. On a phone (same Wi-Fi) open the "Network" URL. The live camera scan needs HTTPS on a phone:
make a self-signed cert once, then `PROTO_HTTPS=1 npm run dev` and open the https URL (accept the warning):
`mkdir -p prototype/certs.local && openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=pico-proto" -keyout prototype/certs.local/key.pem -out prototype/certs.local/cert.pem`

**Checks:** `scripts/e2e/` (production build, live-tester fixtures, screen comparison).

`image-kinds.py` writes `image-kinds.json` and `bag-widths.json` (rerun after the catalog changes; needs Pillow).
