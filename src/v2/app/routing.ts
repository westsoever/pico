import { useEffect, useState } from 'react';

interface Route { path: string[]; q: URLSearchParams }

const parse = (): Route => {
  const [p, q = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(q) };
};

export const go = (to: string) => { window.location.hash = to; };

export const back = () => (history.length > 1 ? history.back() : go('/discover'));

// "Close" for a coffee chain: the last tab screen it started from. sessionStorage survives HMR and reloads.
// Scan and Account are skipped on purpose: a coffee opened from scan results closes to where Scan was opened,
// and Account's own back button would otherwise point at itself.
const ORIGINS = ['discover', 'journal', 'saved', 'taste'];

const rememberOrigin = () => {
  if (!ORIGINS.includes(parse().path[0] ?? '')) return;
  try { sessionStorage.setItem('pico-proto-origin', window.location.hash); } catch { /* private mode: falls back to Discover */ }
};

export const close = () => {
  let to = '#/discover';
  try { to = sessionStorage.getItem('pico-proto-origin') || to; } catch { /* keep Discover */ }
  window.location.replace(to); // replace, so the arrow doesn't add a history entry
};

export function useRoute() {
  const [route, setRoute] = useState(() => { rememberOrigin(); return parse(); });
  useEffect(() => {
    const on = () => { rememberOrigin(); setRoute(parse()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', on);
    // The first render may already have redirected (e.g. / to #/welcome) before this listener existed;
    // in the production build that hashchange is missed and the page stays blank. Catch up once.
    setRoute(parse());
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

// Scan closes back to where it was opened. With no in-app tab visited yet (first visit: welcome → quiz → scan), go to Discover.
export const closeScan = () => {
  let origin: string | null = null;
  try { origin = sessionStorage.getItem('pico-proto-origin'); } catch { /* private mode: Discover */ }
  if (origin) back(); else window.location.replace('#/discover');
};
