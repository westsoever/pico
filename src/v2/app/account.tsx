import { useState } from 'react';
import { getCoffeeById } from '../../lib/catalog';
import { ACCOUNTS, FREE_SCANS, importV1, readV1Ratings, setState, signUp, toggleSaved, type ProtoState } from './state';
import { BackIcon, ChevronRight, CloseIcon, PersonIcon, PlusIcon, ShareIcon, SparkIcon } from './icons';
import { Bag, Nav } from './parts';
import { back, close, go } from './routing';
import { SHOW_WRAPPED, month, pendingSave } from './util';

const SIGNUP_REASONS: Record<string, string> = {
  keep: 'Keep the cups you rated on this phone, on every device.',
  scans: `You’ve used your ${FREE_SCANS} free scans. With an account, scanning is unlimited.`,
  add: 'Coffees you add by hand are saved to your journal, so you need an account.',
  journal: 'Keep your journal and taste profile safe on every device.',
  account: 'Sign in or create your Pico account.',
  save: 'Create a free account to save coffees you want to try.',
};

// Sign-in: Google, or email with a one-time code. No passwords. The prototype accepts any 6 digits.
export function SignUp({ s, q }: { s: ProtoState; q: URLSearchParams }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const next = q.get('next') ?? '/discover';
  const finish = (name = '') => {
    signUp(name);
    if (pendingSave.id) { toggleSaved(pendingSave.id); pendingSave.id = null; }
    const v1 = readV1Ratings();
    go(v1.length && !s.v1Imported ? `/import?next=${encodeURIComponent(next)}` : next);
  };
  const nameFromEmail = () => { const n = email.split('@')[0].split(/[._-]/)[0]; return n[0]?.toUpperCase() + n.slice(1); };
  return (
    <div className="p-sheet-page">
      <button className="p-glass p-glass--round p-sheet-page__close" onClick={back} aria-label="Close"><CloseIcon /></button>
      <span className="p-logo">pico</span>
      {code === null ? (
        <>
          <h1>Your coffee journal, everywhere</h1>
          <p>{SIGNUP_REASONS[q.get('reason') ?? 'account'] ?? SIGNUP_REASONS.account}</p>
          <button className="p-btn p-btn--dark" onClick={() => finish()}>Continue with Google</button>
          <form className="p-form" onSubmit={(e) => { e.preventDefault(); setCode(''); }}>
            <span className="p-or">or</span>
            <input placeholder="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="p-btn p-btn--ghost">Email me a code</button>
          </form>
        </>
      ) : (
        <form className="p-form" onSubmit={(e) => { e.preventDefault(); finish(nameFromEmail()); }}>
          <h1>Check your email</h1>
          <p className="p-form__note">Enter the 6-digit code we sent to {email}.</p>
          <input className="p-code" placeholder="000000" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required autoFocus
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} aria-label="6-digit code" />
          <button className="p-btn p-btn--amber" disabled={code.length < 6}>Sign in</button>
          <button type="button" className="p-link" onClick={() => setCode(null)}>Use a different email</button>
        </form>
      )}
      <span className="p-fine">Free. No password. We never sell your data. <a className="p-link" href="#/privacy">Privacy</a></span>
    </div>
  );
}

export function Import({ q }: { q: URLSearchParams }) {
  const v1 = readV1Ratings();
  const next = q.get('next') ?? '/journal';
  return (
    <div className="p-sheet-page">
      <h1>Bring your coffees along?</h1>
      {ACCOUNTS
        ? <p>This phone has {v1.length} {v1.length === 1 ? 'coffee' : 'coffees'} you rated before Pico had accounts. Add them to your journal so they’re safe and on every device.</p>
        : <p>This phone has {v1.length} {v1.length === 1 ? 'coffee' : 'coffees'} you rated in the first version of Pico. Add {v1.length === 1 ? 'it' : 'them'} to your journal.</p>}
      <div className="p-import">
        {v1.slice(0, 8).map((r) => {
          const c = getCoffeeById(r.coffeeId);
          return c ? <span key={r.coffeeId} className="p-import__item"><Bag coffee={c} w={120} /></span> : null;
        })}
      </div>
      <button className="p-btn p-btn--amber" onClick={() => { importV1(v1); go(next); }}>Add {v1.length} to my journal</button>
      <button className="p-btn p-btn--ghost" onClick={() => { setState({ v1Imported: true }); go(next); }}>Not now</button>
    </div>
  );
}

export function Profile({ s }: { s: ProtoState }) {
  if (!s.user) {
    const scansLeft = FREE_SCANS - s.scansUsed;
    return (
      <div className="p-sheet-page">
        <button className="p-glass p-glass--round p-sheet-page__close" onClick={back} aria-label="Close"><CloseIcon /></button>
        <span className="p-account__mark"><PersonIcon /></span>
        <h1>Your account</h1>
        <p>Sign in to keep your journal and taste profile safe on every device. {scansLeft > 0 ? `You have ${scansLeft} free scan${scansLeft === 1 ? '' : 's'} left without one.` : 'You’ve used your free scans.'}</p>
        <button className="p-btn p-btn--dark" onClick={() => go('/signup?reason=account')}>Sign in</button>
        <button className="p-btn p-btn--ghost" onClick={() => go('/signup?reason=journal')}>Create an account</button>
        <span className="p-fine"><a className="p-link" href="#/privacy">Privacy & data</a></span>
      </div>
    );
  }
  const coffees = new Set(s.cups.map((c) => c.coffeeId));
  const roasters = new Set(s.cups.map((c) => getCoffeeById(c.coffeeId)?.roaster));
  const v1 = readV1Ratings();
  return (
    <div className="p-screen">
      <header className="p-profile">
        <button className="p-glass p-glass--round" onClick={close} aria-label="Back"><BackIcon /></button>
        <span className="p-profile__avatar"><PersonIcon /></span>
        <h1 className="p-title">{s.user.displayName}</h1>
        <span className="p-eyebrow">On Pico since {month(s.user.createdAt)}</span>
      </header>
      <div className="p-stats">
        <div><b>{s.cups.length}</b><span>cups</span></div>
        <div><b>{coffees.size}</b><span>coffees</span></div>
        <div><b>{roasters.size}</b><span>roasters</span></div>
      </div>
      <div className="p-list">
        {SHOW_WRAPPED && <button onClick={() => go('/wrapped')}><SparkIcon /> Monthly Wrapped <ChevronRight /></button>}
        {SHOW_WRAPPED && <button onClick={() => go('/share/profile/me')}><ShareIcon /> Share my taste card <ChevronRight /></button>}
        {v1.length > 0 && <button onClick={() => go('/import?next=/profile')}><PlusIcon /> Import {v1.length} coffees from this phone <ChevronRight /></button>}
        <button onClick={() => go('/privacy')}>Privacy & data <ChevronRight /></button>
        <button className="p-list__danger" onClick={() => { setState({ user: null, cups: [], saved: [] }); go('/discover'); }}>Sign out</button>
      </div>
      <Nav active="" />
    </div>
  );
}

export function Privacy() {
  return (
    <div className="p-sheet-page p-text">
      <button className="p-glass p-glass--round p-sheet-page__close" onClick={back} aria-label="Close"><CloseIcon /></button>
      <h1>Privacy & data</h1>
      {ACCOUNTS ? (
        <p>Placeholder: the real privacy policy is needed before accounts launch (GDPR). It will name who runs Pico, what the account stores (name, email, cups, label photos), where, for how long, and how to export or delete it.</p>
      ) : (
        <>
          <p>Your journal, ratings, saved coffees and the label photos you scan stay on this phone. Labels are read on the phone. Nothing you add is uploaded.</p>
          <p>Pico counts page visits anonymously with GoatCounter. No cookies, nothing that identifies you.</p>
          <p>Coffee photos load from the roasters’ online shops. The label reader is downloaded from jsDelivr, a public code library.</p>
          <p>Questions: <a className="p-link" href="mailto:info@sunseekerlabs.dk">info@sunseekerlabs.dk</a></p>
        </>
      )}
    </div>
  );
}

// The live beta has no accounts yet: Account and any sign-up link land here instead.
export function NoAccounts({ s }: { s: ProtoState }) {
  const v1 = readV1Ratings();
  return (
    <div className="p-sheet-page">
      <button className="p-glass p-glass--round p-sheet-page__close" onClick={back} aria-label="Close"><CloseIcon /></button>
      <span className="p-account__mark"><PersonIcon /></span>
      <h1>Accounts are coming</h1>
      <p>For now your journal is saved on this phone.</p>
      <p className="p-fine">On iPhone, Safari deletes a website’s data after 7 days without a visit. Add Pico to your Home Screen to keep your journal: tap Share, then “Add to Home Screen”.</p>
      {v1.length > 0 && !s.v1Imported && (
        <button className="p-btn p-btn--ghost" onClick={() => go('/import?next=/journal')}>Add {v1.length} coffees from the first Pico</button>
      )}
      <span className="p-fine"><a className="p-link" href="#/privacy">Privacy & data</a></span>
    </div>
  );
}
