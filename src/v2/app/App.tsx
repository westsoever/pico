// Pico v2: every screen on real catalog data, the real store (src/v2/store) and the match / scan logic from src/lib.
// Routes are hash-based (routing.ts); one file per screen. Demo states and the Prototype panel only in dev or with ?proto.
import { useEffect, useState } from 'react';
import { TasteCard, TasteMatch } from './features/TasteShare';
import { MenuPick } from './features/MenuPick';
import { DEMO_STATES, applyDemoState, type DemoState } from './demo';
import { ACCOUNTS, readV1Ratings, useStore } from './state';
import { Import, NoAccounts, Privacy, Profile, SignUp } from './account';
import { AddByHand } from './add';
import { CoffeeScreen } from './coffee';
import { Discover } from './discover';
import { Journal, Saved } from './journal';
import { Bag } from './parts';
import { go, useRoute } from './routing';
import { Scan } from './scan';
import { Share, Wrapped } from './share';
import { Taste } from './taste';
import { PROTO_TOOLS } from './util';
import { Quiz, Welcome } from './welcome';

function ProtoPanel() {
  const [open, setOpen] = useState(false);
  return (
    <div className="p-proto">
      <button className="p-proto__toggle" onClick={() => setOpen(!open)}>Prototype</button>
      {open && (
        <div className="p-proto__sheet">
          <b>Jump to a state</b>
          {(Object.keys(DEMO_STATES) as DemoState[]).map((k) => (
            <button key={k} onClick={() => { applyDemoState(k); setOpen(false); go(k === 'first-run' ? '/welcome' : '/discover'); }}>{DEMO_STATES[k]}</button>
          ))}
          <b>Screens</b>
          <div className="p-proto__links">
            {['welcome', 'quiz', 'discover', 'scan', 'journal', 'journal/cups', 'saved', 'taste', 'account', 'wrapped', 'signup?reason=keep', 'import', 'add'].map((r) => (
              <button key={r} onClick={() => { setOpen(false); go(`/${r}`); }}>{r}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function App() {
  const s = useStore();
  const route = useRoute();
  useEffect(() => {
    const demo = new URLSearchParams(window.location.search).get('state') as DemoState | null;
    if (PROTO_TOOLS && demo && demo in DEMO_STATES) applyDemoState(demo);
  }, []);
  const [screen, a = '', b = ''] = route.path;
  if (!screen) {
    window.location.replace('#' + (s.seenWelcome ? '/discover' : '/welcome')); // replace: Back from here leaves the app instead of redirecting again
    return null;
  }
  // Without accounts there is no sign-up to offer the v1 import, so a phone with a v1 journal is asked once, after the welcome.
  if (!ACCOUNTS && s.seenWelcome && !s.v1Imported && !['import', 'quiz', 'privacy'].includes(screen) && readV1Ratings().length) {
    go(`/import?next=${encodeURIComponent(window.location.hash.slice(1))}`); // raw hash: keeps the query and encoded payloads
    return null;
  }
  const view = (() => {
    switch (screen) {
      case 'welcome': return <Welcome />;
      case 'quiz': return <Quiz q={route.q} />;
      case 'discover': return <Discover s={s} />;
      case 'coffee': return <CoffeeScreen key={a} s={s} id={a} />;
      case 'scan': return <Scan s={s} />;
      case 'journal': return <Journal s={s} view={a} />;
      case 'saved': return <Saved s={s} />;
      case 'taste': return <Taste s={s} />;
      case 'signup': return ACCOUNTS ? <SignUp s={s} q={route.q} /> : <NoAccounts s={s} />;
      case 'import': return <Import q={route.q} />;
      case 'profile':
      case 'account': return ACCOUNTS ? <Profile s={s} /> : <NoAccounts s={s} />;
      case 'wrapped': return <Wrapped s={s} q={route.q} />;
      case 'share': return <Share s={s} kind={a} id={b} />;
      case 'tastecard': return <TasteCard s={s} bag={(c) => <Bag coffee={c} w={500} />} />;
      case 'menu': return <MenuPick s={s} bag={(c) => <Bag coffee={c} w={160} />} />;
      case 'tastematch': return <TasteMatch s={s} payload={a} bag={(c) => <Bag coffee={c} w={300} />} />;
      case 'add': return <AddByHand />;
      case 'privacy': return <Privacy />;
      default: return <Discover s={s} />;
    }
  })();
  return <div className="p-app">{view}{PROTO_TOOLS && <ProtoPanel />}</div>;
}
