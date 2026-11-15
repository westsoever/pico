# Browser checks (Playwright, Python)

Each script builds the site exactly as the deploy does (`VITE_BASE=/pico/ npm run build`, `index.dev.html` →
`index.html`), serves it at `/pico/` on a free port, and drives it at 390×844. Set `E2E_BASE=http://host:port/pico/`
to test a site that is already running instead. Needs `pip install playwright pillow` and `playwright install chromium`.

| Script | What it proves |
|---|---|
| `check_fixtures.py` | Live testers' data (`fixtures/*.json`, recorded from the live beta) loads with every cup, bookmark, sketch and setting intact. Run after every change to storage or screens. |
| `check_no_accounts.py` | The live beta promises no accounts; `?proto` brings the fake flows back; a tester who fake-signed-in earlier keeps everything. |
| `check_flows.py` | Core flows with `?proto`: ratings, match %, sign-up moving cups, sticky Save bar, cup detail/edit/delete, community count, sketched coffees. |
| `snap.py <dir>` + `compare.py <before> <after>` | 60 screens (5 demo states × 11 screens + 5 live screens), text and pixels. Same build twice gives 60/60; anything else is a real change. |
| `make_fixtures.py` | Re-records the fixtures by using the site like a tester. Only when the stored shape changes on purpose. |

```sh
python3 scripts/e2e/check_fixtures.py
python3 scripts/e2e/snap.py /tmp/before   # on the old commit
python3 scripts/e2e/snap.py /tmp/after    # on the new one
python3 scripts/e2e/compare.py /tmp/before /tmp/after
```
