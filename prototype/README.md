# Pico v2 prototype

Click-through prototype of every v2 screen, for testing the flows before building v2.
Real catalog, real match % (`src/lib/similarity`), real label scan (`src/lib/label-ocr` + `label-match`).
Fake accounts: nothing leaves the phone. The store is the real v2 store (`src/v2/store`, localStorage `pico-v2`) with its sync engine talking to an in-memory fake server; older `pico-proto-v2` data is carried over once. To go back to the old fake store, copy `store.proto.ts` over `store.ts`.
It *reads* v1's `pico-user-data` (for the import screen) and *writes* v1's `pico-custom-coffees` when you save a coffee sketched from a scanned label (both stay readable by v1; nothing of v1's is deleted).

**Live beta (2026-11-15):** this prototype is the live site. `index.dev.html` loads `prototype/main.tsx`, so `npm run build` and the Pages deploy ship it. On the live site the Prototype pill, `?state=` demo states and the read-time readout are off; add `?proto` to the URL to get them (e.g. `/pico/?proto#/discover`). Accounts are still fake: everything stays on the phone.

Run: `npx vite --config prototype/vite.config.ts` → http://localhost:5180
On a phone (same Wi-Fi): open the "Network" URL Vite prints. The camera scan needs HTTPS on iPhone, so use "Try a sample scan" there, or a photo from the library.

Live camera scan on a phone: make a self-signed cert once, then start with `PROTO_HTTPS=1` and open the https "Network" URL (accept the certificate warning):
`mkdir -p prototype/certs.local && openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=pico-proto" -keyout prototype/certs.local/key.pem -out prototype/certs.local/cert.pem`
`PROTO_HTTPS=1 npx vite --config prototype/vite.config.ts`
The scan screen reads the camera by itself when the picture is still; the small "… ms" next to the Prototype pill is the last read time on that device. It falls back to the shutter after 15 s or one read over 4 s.

The small "Prototype" pill at the top jumps between states (first visit, 1 or 0 free scans left, new account, 3 months of cups) and screens. `?state=regular` etc. does the same from a link.

Screens: welcome, discover, coffee (rate, cup history, share), scan (free-scan counter, results, wall, add by hand),
sign-up (reason-specific copy; stars tapped before sign-up are kept), import from v1, journal (Coffees / Every cup),
taste, profile, Wrapped (monthly story), share card, privacy placeholder.

Community ratings ("★ 4.3 · 12 ratings") are SAMPLE DATA: `communitySeed` is made up in the `regular` and `new-user` demo states (none on first visit, so "New on Pico" shows). Your own signed-in cups count as one rater.
