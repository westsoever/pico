"""Build the site exactly as the deploy does and serve it at /pico/, like GitHub Pages.

Deploy (.github/workflows): VITE_BASE=/pico/ npm run build, then dist/index.dev.html -> index.html.
Set E2E_BASE=http://host:port/pico/ to test a site that is already running instead (no build).
"""
import functools, http.server, os, shutil, subprocess, tempfile, threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VIEWPORT = {'width': 390, 'height': 844}


def build_and_serve() -> str:
    if os.environ.get('E2E_BASE'):
        return os.environ['E2E_BASE']
    subprocess.run(['npm', 'run', 'build'], cwd=ROOT, check=True, env={**os.environ, 'VITE_BASE': '/pico/'},
                   stdout=subprocess.DEVNULL)
    site = Path(tempfile.mkdtemp(prefix='pico-e2e-'))
    shutil.copytree(ROOT / 'dist', site / 'pico')
    (site / 'pico' / 'index.dev.html').rename(site / 'pico' / 'index.html')
    class Quiet(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *args): pass
    handler = functools.partial(Quiet, directory=str(site))
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return f'http://localhost:{server.server_address[1]}/pico/'


class Checks:
    """PASS/FAIL lines and an exit code, so a script reads as a list of claims."""
    def __init__(self):
        self.failed = []

    def ok(self, cond, msg):
        print(('PASS ' if cond else 'FAIL ') + msg)
        if not cond:
            self.failed.append(msg)

    def done(self):
        print('ALL PASS' if not self.failed else f'{len(self.failed)} FAILED')
        raise SystemExit(1 if self.failed else 0)


# Same "random" on every run (sample scan picks a coffee with Math.random), so screenshots compare.
# window.__reseed() right before a random pick makes it independent of how many draws happened earlier.
SEEDED_RANDOM = """(() => { let s = 42; window.__reseed = () => { s = 42; };
  Math.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; }; })();"""


def stored(page, key='pico-v2'):
    import json
    return json.loads(page.evaluate(f"localStorage.getItem('{key}')") or 'null')
