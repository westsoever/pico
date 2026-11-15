// Pico v2 click-through prototype: every v2 screen on real catalog data and the real
// match / scan logic from src/lib, with fake accounts. Not app code.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { getAllCoffees, getCoffeeById, searchCoffees } from '../src/lib/catalog';
import { formatMatchPercent, getSimilarToCoffee, scoreSimilarity } from '../src/lib/similarity';
import { matchCoffeesFromText } from '../src/lib/label-match';
import { parseLabel, type LabelDraft } from '../src/lib/label-parse';
import { LabelAnswer } from './wow/LabelAnswer';
import { TasteHints } from './wow/TasteHints';
import { TasteCard, TasteMatch, TasteShareButton } from './wow/TasteShare';
import { matchReason, tasteLine } from '../src/lib/taste-line';
import { preloadLabelReader, readLabel } from '../src/lib/label-ocr';
import { isPoorRead } from '../src/lib/menu-pick';
import { MenuPick, PoorRead } from './wow/MenuPick';
import { LiveScan } from './wow/LiveScan';
import { resizePhoto } from '../src/components/CameraCapture';
import { sizedImageUrl } from '../src/components/CoffeeImage';
import {
  BREW_METHOD_OPTIONS, FLAVOR_TAG_LABELS, ROAST_LEVEL_LABELS,
  type BrewJournal, type BrewMethod, type Coffee, type FlavorTag, type RoastLevel, type TasteProfile,
} from '../src/types/coffee';
import type { TasteSeed } from '../src/lib/taste-profile';
import {
  ACCOUNTS, DEMO_STATES, FREE_SCANS, addCup, applyDemoState, currentProfile, importV1, readV1Ratings, setState, signUp,
  spendScan, isSaved, toggleSaved, totalsByCoffee, updateCup, deleteCup, communityRating, useStore, type Cup, type DemoState, type ProtoState,
} from './store';
import {
  ArrowUpRight, BackIcon, BookmarkIcon, CameraIcon, ChevronRight, CloseIcon, DiscoverIcon, JournalIcon, PersonIcon, PlusIcon,
  SearchIcon, ShareIcon, SparkIcon, Star, StarOutline, TasteIcon,
} from './icons';
// From image-kinds.py: cutouts and bags on plain white are shown contained; photos fill their frame.
import imageKinds from './image-kinds.json';
import bagWidths from './bag-widths.json';

// ---------- Routing (hash) ----------

interface Route { path: string[]; q: URLSearchParams }
const parse = (): Route => {
  const [p, q = ''] = window.location.hash.replace(/^#\/?/, '').split('?');
  return { path: p.split('/').filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(q) };
};
const go = (to: string) => { window.location.hash = to; };
const back = () => (history.length > 1 ? history.back() : go('/discover'));

// "Close" for a coffee chain: the last tab screen it started from. sessionStorage survives HMR and reloads.
// Scan and Account are skipped on purpose: a coffee opened from scan results closes to where Scan was opened,
// and Account's own back button would otherwise point at itself.
const ORIGINS = ['discover', 'journal', 'saved', 'taste'];
const rememberOrigin = () => {
  if (!ORIGINS.includes(parse().path[0] ?? '')) return;
  try { sessionStorage.setItem('pico-proto-origin', window.location.hash); } catch { /* private mode: falls back to Discover */ }
};
const close = () => {
  let to = '#/discover';
  try { to = sessionStorage.getItem('pico-proto-origin') || to; } catch { /* keep Discover */ }
  window.location.replace(to); // replace, so the arrow doesn't add a history entry
};

function useRoute() {
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

// A bookmark tapped while signed out: saved right after sign-up. (Ratings need no detour: they save on the phone.)
let pendingSave: string | null = null;

// ---------- Small parts ----------

// Coffee type chips come from roastStyle; 'omni' counts as both. No cold-brew data in the catalog yet.
const COFFEE_TYPES = ['filter', 'espresso'] as const;
type CoffeeType = (typeof COFFEE_TYPES)[number];
const TYPE_LABELS: Record<CoffeeType, string> = { filter: 'Filter coffee', espresso: 'Espresso' };
// No roastStyle in the data yet counts as both, so those coffees aren't hidden by a type chip.
const isType = (c: Coffee, t: CoffeeType) => !c.roastStyle || c.roastStyle === t || c.roastStyle === 'omni';

// Discover shelves: each coffee goes to the group of its first flavor tag, the one tasteLine shows,
// so a tile's line never contradicts its shelf. No tags: Bold if dark, otherwise no shelf.
const SHELVES: { title: string; tags: FlavorTag[] }[] = [
  { title: 'Chocolatey & nutty', tags: ['chocolate', 'nutty', 'caramel'] },
  { title: 'Fruity & bright', tags: ['fruity', 'berry', 'citrus', 'bright'] },
  { title: 'Floral & delicate', tags: ['floral'] },
  { title: 'Bold & full', tags: ['heavy-body', 'spice'] },
];
const shelfOf = (c: Coffee) =>
  c.flavorTags.length ? SHELVES.findIndex((sh) => sh.tags.includes(c.flavorTags[0])) : c.roastLevel === 'dark' ? 3 : -1;
const RATING_WORDS = ['Tap to rate', 'Not for me', 'It’s okay', 'Good cup', 'Really good', 'Loved it'];
const month = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
// Match % or null. Tiles and carousel cards pass floor 50 (`match(c, profile, 50)`), so low numbers don't discourage;
// the coffee page shows the honest number (no floor).
const match = (coffee: Coffee, profile: TasteProfile | null, floor = 0) => {
  const m = profile ? formatMatchPercent(scoreSimilarity(coffee, profile)) : null;
  return m !== null && m >= floor ? m : null;
};

function Bag({ coffee, w = 300 }: { coffee: Coffee; w?: number }) {
  const [failed, setFailed] = useState(false);
  if (!coffee.imageUrl || failed) {
    return <span className="p-bag-fallback">{coffee.roaster.split(' ').map((s) => s[0]).join('').slice(0, 2)}</span>;
  }
  const kind = (imageKinds as Record<string, string>)[coffee.id];
  const contained = kind === 'cutout' || kind === 'plain'; // plain white is multiplied away, like transparency
  return <img className={contained ? 'p-img-bag' : 'p-img-photo'} src={sizedImageUrl(coffee.imageUrl, w)} alt="" loading={w >= 500 ? "eager" : "lazy"} onError={() => setFailed(true)} />;
}

function Stars({ n, size = 12 }: { n: number; size?: number }) {
  return <span className="p-mini-stars">{[1, 2, 3, 4, 5].map((i) => <Star key={i} size={size} on={i <= Math.round(n)} />)}</span>;
}

// Same person icon signed in or out (owner: no initial).
function Avatar() {
  return (
    <button className="p-avatar" data-out onClick={() => go('/account')} aria-label="Account">
      <PersonIcon />
    </button>
  );
}

function SaveButton({ s, coffeeId, className }: { s: ProtoState; coffeeId: string; className: string }) {
  const on = isSaved(coffeeId);
  const tap = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    if (s.user || !ACCOUNTS) return toggleSaved(coffeeId); // no accounts yet: saved on the phone, like cups
    pendingSave = coffeeId;
    go(`/signup?reason=save&next=${encodeURIComponent(`/coffee/${coffeeId}`)}`);
  };
  return (
    <button className={`p-glass p-glass--round p-save ${className}`} data-on={on || undefined} onClick={tap} aria-pressed={on} aria-label={on ? 'Remove from Saved' : 'Save to try later'}>
      <BookmarkIcon on={on} />
    </button>
  );
}

// "Journal" and "Saved" as two large titles; the inactive one is quiet but tappable.
function JournalTitle({ on }: { on: 'journal' | 'saved' }) {
  return (
    <span className="p-titletabs" role="tablist">
      <button role="tab" aria-selected={on === 'journal'} data-on={on === 'journal' || undefined} onClick={() => go('/journal')}>Journal</button>
      <button role="tab" aria-selected={on === 'saved'} data-on={on === 'saved' || undefined} onClick={() => go('/saved')}>Saved</button>
    </span>
  );
}

// Titles stand alone: no stat or count eyebrow above them (stats go in a quiet .p-footstat line at the bottom).
// Same header on every tab, so the avatar sits in the same spot; `aside` goes left of it without moving it.
function Head({ title, aside }: { title: ReactNode; aside?: ReactNode }) {
  return (
    <header className="p-head">
      <h1 className="p-title">{title}</h1>
      <span className="p-head__end">{aside}<Avatar /></span>
    </header>
  );
}

function Nav({ active }: { active: 'discover' | 'journal' | 'taste' | '' }) {
  const items = [
    { key: 'discover', icon: <DiscoverIcon />, label: 'Discover' },
    { key: 'journal', icon: <JournalIcon />, label: 'Journal' },
    { key: 'taste', icon: <TasteIcon />, label: 'Taste' },
  ] as const;
  return (
    <nav className="p-nav">
      <div className="p-nav__pill">
        {items.map((it) => (
          <button key={it.key} className="p-nav__item" data-on={it.key === active || undefined} aria-current={it.key === active ? 'page' : undefined}
            onClick={() => (window.location.hash === `#/${it.key}` ? window.scrollTo({ top: 0, behavior: 'smooth' }) : go(`/${it.key}`))}>
            {it.icon}
            <span className="p-nav__label">{it.label}</span>
          </button>
        ))}
      </div>
      <button className="p-nav__scan" aria-label="Scan a bag" onPointerDown={preloadLabelReader} onClick={() => go('/scan')}>
        <CameraIcon />
      </button>
    </nav>
  );
}

function Tile({ coffee, badge, onClick }: { coffee: Coffee; badge?: ReactNode; onClick: () => void }) {
  return (
    <button className="p-tile" onClick={onClick}>
      <span className="p-tile__img">
        <Bag coffee={coffee} w={300} />
        {badge && <span className="p-glass p-tile__badge">{badge}</span>}
      </span>
      <span className="p-tile__name">{coffee.name}</span>
      <span className="p-tile__roaster">{coffee.roaster}</span>
      <span className="p-tile__taste">{tileLine(coffee)}</span>
    </button>
  );
}

// Quiet third line: community rating first when there is one, then the taste. "★ 4.6 (8) · Fruity · light"
const tileLine = (c: Coffee) => {
  const cr = communityRating(c.id);
  return `${cr ? `★ ${cr.average.toFixed(1)} (${cr.count}) · ` : ''}${tasteLine(c, 'short')}`;
};

// Every tile's top-left badge: "You ★ x.x" once you've rated it (never mistaken for the community rating),
// else match % from 50 up, else nothing.
function tileBadge(s: ProtoState, c: Coffee, profile: TasteProfile | null): ReactNode {
  const mine = s.cups.filter((x) => x.coffeeId === c.id);
  if (mine.length) return <>You <Star size={12} /> {(mine.reduce((t, x) => t + x.stars, 0) / mine.length).toFixed(1)}</>;
  const m = match(c, profile, 50);
  return m !== null ? `${m}%` : undefined;
}

function Empty({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <div className="p-empty">
      <span className="p-empty__mark"><SparkIcon /></span>
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="p-empty__actions">{children}</div>
    </div>
  );
}

// ---------- Screens ----------

// First-run taste quiz: 3 one-tap questions, each skippable. Seeds the match % before any rating.
const QUIZ_DRINK = [
  { label: 'Black', roasts: ['light', 'medium'] },
  { label: 'With milk', roasts: ['medium', 'dark'] },
  { label: 'Both', roasts: ['medium'] },
] as const;
const QUIZ_FLAVORS: { label: string; tags: FlavorTag[] }[] = [
  { label: 'Fruity, like berries', tags: ['fruity', 'berry'] },
  { label: 'Fresh, like citrus', tags: ['citrus', 'bright'] },
  { label: 'Flowery, like tea', tags: ['floral'] },
  { label: 'Chocolate and nuts', tags: ['chocolate', 'nutty'] },
  { label: 'Sweet, like caramel', tags: ['caramel', 'chocolate'] },
];
const QUIZ_ROAST = [
  { label: 'Mild and bright', roasts: ['light'] },
  { label: 'In between', roasts: ['medium'] },
  { label: 'Dark and bold', roasts: ['dark'] },
] as const;

function Quiz({ q }: { q: URLSearchParams }) {
  const [step, setStep] = useState(0);
  const [roasts, setRoasts] = useState<RoastLevel[]>([]);
  const [flavors, setFlavors] = useState<FlavorTag[]>([]);
  // replace: the quiz leaves no history entry, so closing the next screen can't land back in it
  const finish = (seed: TasteSeed) => { setState({ tasteSeed: seed }); window.location.replace(`#${q.get('next') || '/discover'}`); };
  const steps = [
    { title: 'How do you drink your coffee?', options: QUIZ_DRINK.map((o) => ({ label: o.label, pick: () => { setRoasts([...o.roasts]); setStep(1); } })) },
    { title: 'Which sounds best?', options: QUIZ_FLAVORS.map((o) => ({ label: o.label, pick: () => { setFlavors(o.tags); setStep(2); } })) },
    { title: 'How strong do you like it?', options: [
      ...QUIZ_ROAST.map((o) => ({ label: o.label, pick: () => finish({ flavors, roasts: [...o.roasts] }) })),
      { label: 'Not sure', pick: () => finish({ flavors, roasts }) },
    ] },
  ];
  return (
    <div className="p-screen p-quiz">
      <div className="p-quiz__top">
        <div className="p-dots">{steps.map((_, i) => <span key={i} data-on={i <= step || undefined} />)}</div>
        <button className="p-link" onClick={() => finish({ flavors, roasts })}>Skip</button>
      </div>
      <h1 className="p-title">{steps[step].title}</h1>
      <div className="p-quiz__options">
        {steps[step].options.map((o) => <button key={o.label} className="p-btn p-btn--ghost" onClick={o.pick}>{o.label}</button>)}
      </div>
      <p className="p-fine">So Pico can show how well each coffee suits you. Your ratings take over from here.</p>
    </div>
  );
}

function Welcome() {
  // Scan and Browse pass through the taste quiz first; "I have an account" goes straight to sign-in.
  // The quiz replaces the welcome entry (and the quiz replaces itself), so Back never returns to onboarding.
  const done = (to: string) => {
    setState({ seenWelcome: true });
    if (to.startsWith('/signup')) go(to);
    else window.location.replace(`#/quiz?next=${encodeURIComponent(to)}`);
  };
  // Transparent-PNG bags (corner alpha 0) from 3 roasters, so no white box shows behind them.
  const hero = ['coffee-collective-mulugeta-anaerobic', 'kontra-kenya-gicherori', 'skaastrupkaffen-special-blend']
    .map((id) => getCoffeeById(id)).filter((c) => c !== undefined);
  // This bag fills more of its photo (89% vs 76% of the height), so shrink it to the same visible height.
  const heroScale: Record<string, number> = { 'skaastrupkaffen-special-blend': 0.85 };
  return (
    <div className="p-welcome">
      <div className="p-welcome__bags">
        {hero.map((c, i) => <span key={c.id} className="p-welcome__bag" data-i={i} style={{ scale: heroScale[c.id] }}><Bag coffee={c} w={300} /></span>)}
      </div>
      <h1 className="p-welcome__title">Know if you’ll love a bag before you open it.</h1>
      <p className="p-welcome__body">Taste it. Rate it. Let Pico find your next favorite.</p>
      <button className="p-btn p-btn--amber" onClick={() => done('/scan')}><CameraIcon size={22} /> Scan a coffee bag</button>
      <button className="p-btn p-btn--ghost" onClick={() => done('/discover')}>Browse coffees</button>
      {ACCOUNTS && <span className="p-fine">{FREE_SCANS} free scans, no account needed · <button className="p-link" onClick={() => done('/signup?reason=account')}>I have an account</button></span>}
    </div>
  );
}

function Discover({ s }: { s: ProtoState }) {
  const [query, setQuery] = useState('');
  // Filters: OR inside a group, AND across groups. "For you" is a sort, not a filter.
  const [types, setTypes] = useState<Set<CoffeeType>>(new Set());
  const [flavors, setFlavors] = useState<Set<FlavorTag>>(new Set());
  const [shelf, setShelf] = useState<number | null>(null); // "See all" on a shelf: the grid shows exactly its coffees
  const [forYou, setForYou] = useState(true);
  const [stuck, setStuck] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Stuck = the search bar has reached the top (the header row above it has scrolled away).
    const on = () => setStuck((barRef.current?.getBoundingClientRect().top ?? 1) <= 0);
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const profile = useMemo(() => currentProfile(s), [s]);
  const all = getAllCoffees().filter((c) => c.available !== false);
  const typeChips = COFFEE_TYPES.filter((t) => all.some((c) => isType(c, t)));
  const list = useMemo(() => {
    if (query.trim()) return searchCoffees(query, 30);
    const hits = all.filter((c) =>
      (!types.size || [...types].some((t) => isType(c, t))) && (!flavors.size || c.flavorTags.some((f) => flavors.has(f))));
    if (!profile || !forYou) return hits;
    // "For you" = new coffees first (owner: choose from what I haven't tried), then the ones you rated; each by score.
    const tried = new Set(s.cups.map((c) => c.coffeeId));
    return hits.sort((a, b) => Number(tried.has(a.id)) - Number(tried.has(b.id)) || scoreSimilarity(b, profile) - scoreSimilarity(a, profile));
  }, [query, types, flavors, forYou, profile, all, s.cups]);
  const featured = list.filter((c) => c.imageUrl).slice(0, 6);
  const rest = list.filter((c) => !featured.includes(c) && (shelf === null || query.trim() !== '' || shelfOf(c) === shelf));
  // Shelves only on the unfiltered page; `rest` is already match-sorted when "For you" is on.
  const shelves = !query.trim() && !types.size && !flavors.size && shelf === null
    ? SHELVES.map((sh, i) => ({ ...sh, i, coffees: rest.filter((c) => shelfOf(c) === i) })).filter((sh) => sh.coffees.length >= 3)
    : null;
  // "For you": shelves ordered by their best untried coffee (each shelf already lists untried first, best first).
  // Otherwise the owner's fixed order. Stable sort keeps the fixed order on ties.
  if (shelves && profile && forYou) {
    const tried = new Set(s.cups.map((c) => c.coffeeId));
    const best = (cs: Coffee[]) => (cs[0] && !tried.has(cs[0].id) ? scoreSimilarity(cs[0], profile) : -Infinity);
    shelves.sort((a, b) => best(b.coffees) - best(a.coffees));
  }
  const filtered = types.size > 0 || flavors.size > 0 || shelf !== null;
  // The match floor only hides the badge; sorting still uses the full score.
  const tile = (c: Coffee) => <Tile key={c.id} coffee={c} badge={tileBadge(s, c, profile)} onClick={() => go(`/coffee/${c.id}`)} />;
  const scansLeft = FREE_SCANS - s.scansUsed;
  const toggle = <T,>(set: Set<T>, v: T) => { const n = new Set(set); if (!n.delete(v)) n.add(v); return n; };

  return (
    <div className="p-screen p-discover">
      {/* Header row scrolls away; only the search bar sticks. */}
      <Head title="Discover" aside={ACCOUNTS && !s.user && (
        <button className="p-scans" onClick={() => go('/signup?reason=journal')}>
          {scansLeft > 0 ? `${scansLeft} free scan${scansLeft === 1 ? '' : 's'}` : 'Free scans used'}
        </button>
      )} />
      <div className="p-discover__bar" ref={barRef} data-stuck={stuck || undefined}>
        <label className="p-search">
          <SearchIcon />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Coffee, roaster, flavor" />
          {query && <button className="p-search__clear" onClick={() => setQuery('')} aria-label="Clear"><CloseIcon /></button>}
        </label>
        {stuck && <Avatar />}
      </div>
      {!query && (
        <div className="p-chips">
          {profile && <button className="p-chip p-chip--sort" data-on={forYou || undefined} onClick={() => setForYou(!forYou)}>For you</button>}
          {filtered && (
            <button className="p-chip p-chip--clear" onClick={() => { setTypes(new Set()); setFlavors(new Set()); setShelf(null); }}><CloseIcon /> Clear</button>
          )}
          {shelf !== null && (
            <button className="p-chip p-chip--shelf" data-on onClick={() => setShelf(null)} aria-label={`Remove ${SHELVES[shelf].title}`}>{SHELVES[shelf].title}<CloseIcon /></button>
          )}
          {(profile || filtered) && typeChips.length > 0 && <span className="p-chips__gap" />}
          {typeChips.map((t) => (
            <button key={t} className="p-chip" data-on={types.has(t) || undefined} onClick={() => setTypes(toggle(types, t))}>{TYPE_LABELS[t]}</button>
          ))}
          <span className="p-chips__gap" />
          {(['fruity', 'chocolate', 'floral', 'nutty', 'caramel', 'berry', 'citrus'] as FlavorTag[]).map((t) => (
            <button key={t} className="p-chip" data-on={flavors.has(t) || undefined} onClick={() => setFlavors(toggle(flavors, t))}>{FLAVOR_TAG_LABELS[t]}</button>
          ))}
        </div>
      )}
      <div className="p-carousel">
        {featured.map((c) => {
          const b = tileBadge(s, c, profile);
          const cr = communityRating(c.id);
          return (
            // The card is a div so the bookmark can be its own button (no button inside a button).
            <div key={c.id} className="p-feature">
              <button className="p-feature__open" onClick={() => go(`/coffee/${c.id}`)}>
                <span className="p-feature__img"><Bag coffee={c} w={600} /></span>
                {/* Community rating first, then your match (or your own stars). They wrap onto two lines if too wide. */}
                <span className="p-feature__pills">
                  {cr ? <span className="p-glass p-feature__match"><Star size={12} /> {cr.average.toFixed(1)} · {cr.count}</span>
                    : !s.cups.some((x) => x.coffeeId === c.id) && <span className="p-glass p-feature__match">New on Pico</span>}
                  {b && <span className="p-glass p-feature__match">{b}{typeof b === 'string' && ' match'}</span>}
                </span>
                <span className="p-feature__foot">
                  <span className="p-feature__origin">{[c.origin, c.region].filter(Boolean).join(' · ')}</span>
                  <span className="p-feature__name">{c.name}</span>
                  <span className="p-feature__notes">{(c.tastingNotes ?? []).slice(0, 3).join(', ') || c.process}</span>
                  <span className="p-feature__go"><ArrowUpRight size={17} /></span>
                </span>
              </button>
              <SaveButton s={s} coffeeId={c.id} className="p-feature__save" />
            </div>
          );
        })}
      </div>
      {shelves ? shelves.map((sh) => (
        <section key={sh.title}>
          <h2 className="p-section">
            {sh.title}
            {sh.coffees.length > 10 && (
              <button className="p-section__all" onClick={() => { setShelf(sh.i); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>See all</button>
            )}
          </h2>
          <div className="p-row p-shelf">{sh.coffees.slice(0, 10).map(tile)}</div>
        </section>
      )) : (
        <>
          {rest.length > 0 && <h2 className="p-section">{query ? 'More results' : 'More coffees'}</h2>}
          <div className="p-grid">{rest.map(tile)}</div>
        </>
      )}
      {list.length === 0 && <Empty title="Nothing found" body="Try a roaster, a country or a flavor like “berry”." />}
      <Nav active="discover" />
    </div>
  );
}

// A cup's optional detail, behind "Add detail": flavors tasted, brew method, a note. Stars stay the one-tap default.
interface CupDraft { stars: number; note: string; flavorTags: FlavorTag[]; brew?: BrewJournal }
const EMPTY_DRAFT: CupDraft = { stars: 0, note: '', flavorTags: [] };

function CupDetail({ draft, set }: { draft: CupDraft; set: (d: CupDraft) => void }) {
  const flavor = (t: FlavorTag) => set({ ...draft, flavorTags: draft.flavorTags.includes(t) ? draft.flavorTags.filter((x) => x !== t) : [...draft.flavorTags, t] });
  const method = (v: BrewMethod) => set({ ...draft, brew: { ...draft.brew, method: draft.brew?.method === v ? undefined : v } });
  return (
    <div className="p-detail">
      <span className="p-detail__label">Flavors you tasted</span>
      <div className="p-detail__chips">
        {(Object.keys(FLAVOR_TAG_LABELS) as FlavorTag[]).map((t) => (
          <button key={t} className="p-chip" data-on={draft.flavorTags.includes(t) || undefined} aria-pressed={draft.flavorTags.includes(t)} onClick={() => flavor(t)}>{FLAVOR_TAG_LABELS[t]}</button>
        ))}
      </div>
      <span className="p-detail__label">How you brewed it</span>
      <div className="p-detail__chips">
        {BREW_METHOD_OPTIONS.map((o) => (
          <button key={o.value} className="p-chip" data-on={draft.brew?.method === o.value || undefined} aria-pressed={draft.brew?.method === o.value} onClick={() => method(o.value)}>{o.label}</button>
        ))}
      </div>
      <textarea className="p-rate__note" value={draft.note} onChange={(e) => set({ ...draft, note: e.target.value })} placeholder="A note for yourself (optional)" rows={2} aria-label="Note" />
    </div>
  );
}

// Signed out, after a cup is saved: a quiet line, then a real button once there are 3 cups worth keeping.
function KeepCupsPrompt({ count, next }: { count: number; next: string }) {
  const to = () => go(`/signup?reason=keep&next=${encodeURIComponent(next)}`);
  if (!ACCOUNTS) return null; // nothing to keep them in yet
  if (count < 3) {
    return <p className="p-keep">Your cups are only on this phone. <button className="p-link" onClick={to}>Create a free account</button> to keep them.</p>;
  }
  return (
    <div className="p-keep p-keep--strong">
      <p>Your {count} cups are only on this phone.</p>
      <button className="p-btn p-btn--dark" onClick={to}>Create free account</button>
    </div>
  );
}

function CoffeeScreen({ s, id }: { s: ProtoState; id: string }) {
  const coffee = getCoffeeById(id);
  const [draft, setDraft] = useState<CupDraft>(EMPTY_DRAFT);
  const [detail, setDetail] = useState(false);
  const [saved, setSaved] = useState<Cup | null>(null);
  const [editing, setEditing] = useState<(CupDraft & { id: string }) | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const profile = useMemo(() => currentProfile(s), [s]);
  if (!coffee) return <Empty title="Coffee not found" body="It may have been removed from the catalog." />;

  const mine = s.cups.filter((c) => c.coffeeId === id);
  const avg = mine.length ? mine.reduce((t, c) => t + c.stars, 0) / mine.length : 0;
  const m = match(coffee, profile);
  const reason = profile && matchReason(coffee, profile);
  const community = communityRating(id);
  const similar = getSimilarToCoffee(coffee, [], 6);
  const stars = draft.stars;

  const tap = (n: number) => {
    setSaved(null);
    setDraft({ ...draft, stars: n });
  };
  const save = () => {
    // No flavors picked: the cup takes the coffee's own flavor tags (addCup's default).
    const cup = addCup(id, stars, draft.note, draft.flavorTags.length ? draft.flavorTags : undefined, draft.brew);
    setSaved(cup); setDraft(EMPTY_DRAFT); setDetail(false);
  };
  const edit = (c: Cup) => { setConfirmDelete(false); setEditing(editing?.id === c.id ? null : { id: c.id, stars: c.stars, note: c.note, flavorTags: c.flavorTags, brew: c.brew }); };
  const saveEdit = () => {
    if (!editing) return;
    const { id: cupId, ...patch } = editing;
    updateCup(cupId, patch);
    setEditing(null);
  };
  const details = [
    ['Origin', coffee.origin], ['Process', coffee.process], ['Variety', coffee.variety], ['Region', coffee.region],
    ['Producer', coffee.producer], ['Altitude', coffee.altitude?.replace(/\s*masl$/i, ' m')], ['Roast', ROAST_LEVEL_LABELS[coffee.roastLevel]],
  ].filter(([, v]) => v);

  return (
    <div className="p-screen p-coffee">
      <div className="p-hero">
        <span className="p-hero__floor" />
        <span className="p-hero__bag"><Bag coffee={coffee} w={700} /></span>
        <button className="p-glass p-glass--round p-hero__back" onClick={close} aria-label="Back"><BackIcon /></button>
        <span className="p-hero__actions">
          <button className="p-glass p-glass--round" onClick={() => go(`/share/coffee/${id}`)} aria-label="Share"><ShareIcon /></button>
          <SaveButton s={s} coffeeId={id} className="" />
        </span>
      </div>
      <div className="p-sheet">
        <span className="p-sheet__grab" />
        <div className="p-sheet__top">
          <span className="p-roaster">{coffee.roaster}</span>
          {/* Rated coffees show your own rating here: a match % would contradict it. */}
          {mine.length > 0
            ? <span className="p-match">You: {Number.isInteger(avg) ? avg : avg.toFixed(1)}★</span>
            : m !== null && <span className="p-match">{m}% match</span>}
        </div>
        <h1 className="p-name">{coffee.name}</h1>
        <p className="p-community">
          {community ? <><Star /> {community.average.toFixed(1)} · {community.count} ratings</> : 'New on Pico'}
        </p>
        <p className="p-taste">{tasteLine(coffee, 'long')}</p>
        {profile
          ? <TasteHints coffee={coffee} cups={s.cups} profile={profile} reason={m !== null ? reason : null} rated={mine.length > (saved ? 1 : 0)} savedStars={saved?.stars} />
          : mine.length === 0 && m !== null && reason && <p className="p-reason">{reason}</p>}

        <div className="p-rate">
          <span className="p-rate__label">{mine.length ? 'Log another cup' : 'Your rating'}</span>
          <span className="p-rate__word">{saved ? 'Saved' : RATING_WORDS[stars]}</span>
          <div className="p-rate__stars">
            {[1, 2, 3, 4, 5].map((i) => (
              <button key={i} className="p-star" data-on={i <= stars || undefined} onClick={() => tap(i)} aria-label={`${i} stars`} style={{ transitionDelay: `${i * 40}ms` }}>
                <StarOutline />
              </button>
            ))}
          </div>
          {stars > 0 && (detail
            ? <CupDetail draft={draft} set={setDraft} />
            : <button className="p-link p-rate__more" onClick={() => setDetail(true)}>Add detail</button>)}
        </div>
        {saved && (!ACCOUNTS
          ? <p className="p-keep">Added to your taste profile.</p>
          : s.user
          ? <p className="p-keep">Added to this coffee’s rating and your taste profile.</p>
          : s.cups.length < 3
            // Cups on the phone can't count in the shared average, so only the taste profile is true here.
            ? <p className="p-keep">Added to your taste profile. <button className="p-link" onClick={() => go(`/signup?reason=keep&next=${encodeURIComponent(`/coffee/${id}`)}`)}>Create a free account</button> to count it in this coffee’s rating.</p>
            : <KeepCupsPrompt count={s.cups.length} next={`/coffee/${id}`} />)}

        {mine.length > 0 && (
          <section className="p-history">
            <div className="p-history__sum">
              <b>{mine.length} {mine.length === 1 ? 'cup' : 'cups'}</b>
              <span><Stars n={avg} /> {avg.toFixed(1)} average</span>
              <span>since {day(mine[mine.length - 1].ratedAt)}</span>
            </div>
            {mine.slice(0, 4).map((c) => (
              <div key={c.id}>
                <div className="p-history__row" data-new={c.id === saved?.id || undefined}>
                  <button className="p-history__open" onClick={() => edit(c)} aria-expanded={editing?.id === c.id} aria-label={`Edit cup from ${day(c.ratedAt)}`}>
                    <span className="p-history__date">{day(c.ratedAt)}</span>
                    <Stars n={c.stars} />
                    <span className="p-history__note">{c.note}</span>
                  </button>
                  <button className="p-history__share" onClick={() => go(`/share/cup/${c.id}`)} aria-label="Share this cup"><ShareIcon /></button>
                </div>
                {editing?.id === c.id && (
                  <div className="p-edit">
                    <div className="p-rate__stars">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <button key={i} className="p-star" data-on={i <= editing.stars || undefined} onClick={() => setEditing({ ...editing, stars: i })} aria-label={`${i} stars`}>
                          <StarOutline />
                        </button>
                      ))}
                    </div>
                    <CupDetail draft={editing} set={(d) => setEditing({ ...editing, ...d })} />
                    {confirmDelete ? (
                      <div className="p-edit__actions">
                        <span>Delete this cup?</span>
                        <button className="p-link" onClick={() => setConfirmDelete(false)}>Keep</button>
                        <button className="p-link p-link--danger" onClick={() => { deleteCup(c.id); setEditing(null); }}>Delete</button>
                      </div>
                    ) : (
                      <div className="p-edit__actions">
                        <button className="p-link p-link--danger" onClick={() => setConfirmDelete(true)}>Delete cup</button>
                        <button className="p-link" onClick={() => setEditing(null)}>Cancel</button>
                        <button className="p-btn p-btn--dark p-edit__save" onClick={saveEdit}>Save changes</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {coffee.tastingNotes?.length ? (
          <>
            <h2 className="p-section">Tasting notes</h2>
            <div className="p-notes">{coffee.tastingNotes.map((n) => <span key={n} className="p-note">{n}</span>)}</div>
          </>
        ) : null}
        <p className="p-desc">{coffee.description}</p>
        <dl className="p-details">{details.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className={k === 'Altitude' ? 'p-nocap' : undefined}>{v}</dd></div>)}</dl>
        {coffee.sourceUrl && (
          // The roaster click is the demand metric we show roasters, so it gets a plain, labeled button.
          <a className="p-btn p-btn--ghost p-roaster-link" href={coffee.sourceUrl} target="_blank" rel="noreferrer">
            View at roaster <ArrowUpRight />
          </a>
        )}

        <h2 className="p-section">If you like this</h2>
        <div className="p-row">
          {similar.map(({ coffee: c }) => <Tile key={c.id} coffee={c} onClick={() => go(`/coffee/${c.id}`)} />)}
        </div>

        {/* The sticky save bar only appears once there are stars to save, so it never sits over the page while reading. */}
        {stars > 0 && (
          <div className="p-cta">
            <button className="p-cta__save" onClick={save}>Save to Journal</button>
          </div>
        )}
      </div>
    </div>
  );
}

type ScanPhase = { kind: 'idle' } | { kind: 'reading' } | { kind: 'poor' } | { kind: 'results'; coffees: Coffee[]; photo?: string; draft?: LabelDraft | null };

// Scan result answer line: community rating, then your own stars or your match. Unfloored match: this is the decision moment.
function ResultVerdict({ s, coffee, profile, best }: { s: ProtoState; coffee: Coffee; profile: TasteProfile | null; best: boolean }) {
  const community = communityRating(coffee.id);
  const mine = s.cups.filter((x) => x.coffeeId === coffee.id);
  const m = match(coffee, profile);
  //   keeps each part on one line, so the line only wraps at a " · ".
  const yours = mine.length ? `You ★ ${(mine.reduce((t, x) => t + x.stars, 0) / mine.length).toFixed(1)}` : m !== null ? `${m}% match` : null;
  return (
    <span className="p-result__verdict">
      {community ? <><Star size={best ? 16 : 12} />{community.average.toFixed(1)} · {community.count}{' '}ratings</> : 'New on Pico'}
      {yours && ` · ${yours}`}
    </span>
  );
}

// Scan closes back to where it was opened. With no in-app tab visited yet (first visit: welcome → quiz → scan), go to Discover.
const closeScan = () => {
  let origin: string | null = null;
  try { origin = sessionStorage.getItem('pico-proto-origin'); } catch { /* private mode: Discover */ }
  if (origin) back(); else window.location.replace('#/discover');
};

function Scan({ s }: { s: ProtoState }) {
  const [phase, setPhase] = useState<ScanPhase>({ kind: 'idle' });
  const [live, setLive] = useState(true); // live camera scan; off after its fallback or a shutter tap
  const input = useRef<HTMLInputElement>(null);
  const left = FREE_SCANS - s.scansUsed;
  const profile = useMemo(() => currentProfile(s), [s]);
  useEffect(preloadLabelReader, []);

  if (ACCOUNTS && !s.user && left <= 0 && phase.kind === 'idle') {
    return (
      <div className="p-scan">
        <button className="p-scan__close" onClick={back} aria-label="Close"><CloseIcon /></button>
        <div className="p-wall">
          <span className="p-wall__count">{FREE_SCANS}/{FREE_SCANS}</span>
          <h1>You’ve used your free scans</h1>
          <p>Create a free account to keep scanning. Your journal and taste profile stay safe on every device.</p>
          <button className="p-btn p-btn--amber" onClick={() => go('/signup?reason=scans&next=/scan')}>Create free account</button>
          <button className="p-btn p-btn--ghost-dark" onClick={() => go('/discover')}>Browse coffees instead</button>
        </div>
      </div>
    );
  }

  const start = () => (spendScan() ? true : (go('/signup?reason=scans&next=/scan'), false));
  const onFile = async (file?: File) => {
    if (!file || !start()) return;
    setPhase({ kind: 'reading' });
    try {
      const photo = await resizePhoto(file);
      const read = await readLabel(photo);
      const text = read.text;
      const coffees = matchCoffeesFromText(text, getAllCoffees()).map((m) => m.coffee);
      // Bag artwork drags Tesseract's confidence down even on good reads, so a match always wins over "blurry".
      if (!coffees.length && isPoorRead(read)) { setPhase({ kind: 'poor' }); return; }
      setPhase({ kind: 'results', photo, coffees, draft: coffees.length ? null : parseLabel(text, getAllCoffees()) });
    } catch {
      setPhase({ kind: 'results', coffees: [] });
    }
  };
  const sample = () => {
    if (!start()) return;
    setPhase({ kind: 'reading' });
    const pool = getAllCoffees().filter((c) => c.imageUrl);
    const hit = pool[Math.floor(Math.random() * pool.length)];
    setTimeout(() => setPhase({ kind: 'results', coffees: [hit, ...getSimilarToCoffee(hit, [], 2).map((x) => x.coffee)] }), 1200);
  };

  return (
    <div className="p-scan">
      <button className="p-scan__close" onClick={closeScan} aria-label="Close"><CloseIcon /></button>
      {ACCOUNTS && !s.user && <span className="p-scan__left">{left} of {FREE_SCANS} free scans left</span>}
      {phase.kind === 'poor' && <PoorRead onFile={onFile} />}
      {(phase.kind === 'idle' || phase.kind === 'reading') && (
        <>
          <div className="p-scan__frame" data-busy={phase.kind === 'reading' || undefined}>
            <span /><span /><span /><span />
            <LiveScan active={live && phase.kind === 'idle'} onStop={() => setLive(false)} onResult={(r) => {
              if (!start()) return;
              if (r.kind === 'open') go(`/coffee/${r.coffee.id}`);
              else setPhase({ kind: 'results', coffees: r.coffees, photo: r.photo, draft: r.draft ?? null });
            }} />
            <p>{phase.kind === 'reading' ? 'Reading the label…' : live ? 'Point at the front of the bag' : 'Tap to scan'}</p>
          </div>
          <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
          <button className="p-scan__shutter" disabled={phase.kind === 'reading'} onClick={() => { setLive(false); input.current?.click(); }} aria-label="Take photo"><span /></button>
          <button className="p-link p-link--light" disabled={phase.kind === 'reading'} onClick={sample}>No bag at hand? Try a sample scan</button>
          <button className="p-link p-link--light" disabled={phase.kind === 'reading'} onClick={() => go('/menu')}>At a café? Scan the menu</button>
        </>
      )}
      {phase.kind === 'results' && phase.draft && (
        <div className="p-results">
          <h1>Not in Pico yet. Here’s what the label says</h1>
          <LabelAnswer draft={phase.draft} photo={phase.photo} profile={profile} onRetry={() => setPhase({ kind: 'idle' })} />
        </div>
      )}
      {phase.kind === 'results' && !phase.draft && (
        <div className="p-results">
          <h1>{phase.coffees.length ? 'Is it one of these?' : 'We couldn’t find this bag'}</h1>
          {phase.coffees.map((c, i) => (
            <button key={c.id} className="p-result" data-best={i === 0 || undefined} onClick={() => go(`/coffee/${c.id}`)}>
              <span className="p-result__img"><Bag coffee={c} w={160} /></span>
              <span className="p-result__text">
                {i === 0 && <span className="p-result__tag">Most likely</span>}
                <b>{c.name}</b>
                <span>{c.roaster} · {c.origin}</span>
                <ResultVerdict s={s} coffee={c} profile={profile} best={i === 0} />
              </span>
              <ChevronRight />
            </button>
          ))}
          {/* The /add form doesn't save yet, so it waits for accounts. */}
          {ACCOUNTS && (
            <button className="p-result p-result--add" onClick={() => go(s.user ? '/add' : '/signup?reason=add&next=/add')}>
              <span className="p-result__img"><PlusIcon /></span>
              <span className="p-result__text"><b>Not here? Add it by hand</b><span>Saved to your journal, and you can send it to Pico</span></span>
            </button>
          )}
          <button className="p-link p-link--light" onClick={() => setPhase({ kind: 'idle' })}>Scan another bag</button>
        </div>
      )}
    </div>
  );
}

// Wrapped and the taste card are cut from the first release: entry points hidden, code kept.
// #/wrapped stays reachable from the Prototype panel.
const SHOW_WRAPPED = false;

function Journal({ s, view }: { s: ProtoState; view: string }) {
  // Rate before account: signed-out cups live in s.cups too, so the journal renders either way.
  const totals = useMemo(() => totalsByCoffee(s.cups), [s.cups]);
  if (!s.cups.length) {
    return (
      <div className="p-screen">
        <Head title={<JournalTitle on="journal" />} />
        <Empty title="No cups yet" body="Scan the bag you’re drinking from, give it stars, and it lands here.">
          <button className="p-btn p-btn--amber" onClick={() => go('/scan')}><CameraIcon size={20} /> Scan a bag</button>
          <button className="p-btn p-btn--ghost" onClick={() => go('/discover')}>Browse coffees</button>
        </Empty>
        <Nav active="journal" />
      </div>
    );
  }
  const avg = s.cups.reduce((t, c) => t + c.stars, 0) / s.cups.length;
  const byMonth = new Map<string, Cup[]>();
  for (const c of s.cups) byMonth.set(month(c.ratedAt), [...(byMonth.get(month(c.ratedAt)) ?? []), c]);
  const lastMonth = new Date(); lastMonth.setDate(0);
  const wrapMonth = s.cups.some((c) => month(c.ratedAt) === month(lastMonth.toISOString())) ? lastMonth : null;

  return (
    <div className="p-screen">
      <Head title={<JournalTitle on="journal" />} />
      {!s.user && <KeepCupsPrompt count={s.cups.length} next="/journal" />}
      {SHOW_WRAPPED && wrapMonth && (
        <button className="p-wrapped-banner" onClick={() => go(`/wrapped?m=${wrapMonth.toISOString().slice(0, 7)}`)}>
          <span><SparkIcon /> Your {wrapMonth.toLocaleDateString('en-GB', { month: 'long' })} in coffee</span>
          <ChevronRight />
        </button>
      )}
      <div className="p-seg" role="tablist">
        <button data-on={view !== 'cups' || undefined} onClick={() => go('/journal')}>Coffees</button>
        <button data-on={view === 'cups' || undefined} onClick={() => go('/journal/cups')}>Every cup</button>
      </div>
      {view !== 'cups' ? (
        <>
          <div className="p-grid">
            {totals.map((t) => (
              <Tile key={t.coffee.id} coffee={t.coffee} onClick={() => go(`/coffee/${t.coffee.id}`)}
                badge={<>You <Star size={12} /> {t.average.toFixed(1)}{t.cups.length > 1 && <span className="p-badge-count">×{t.cups.length}</span>}</>} />
            ))}
          </div>
        </>
      ) : (
        [...byMonth.entries()].map(([m, cups]) => (
          <section key={m} className="p-month">
            <h2 className="p-section">{m}</h2>
            {cups.map((c) => {
              const coffee = getCoffeeById(c.coffeeId);
              if (!coffee) return null;
              return (
                <button key={c.id} className="p-cuprow" onClick={() => go(`/coffee/${coffee.id}`)}>
                  <span className="p-cuprow__thumb"><Bag coffee={coffee} w={120} /></span>
                  <span className="p-cuprow__text">
                    <b>{coffee.name}</b>
                    <span>{coffee.roaster}{c.note ? ` · “${c.note}”` : ''}</span>
                  </span>
                  <span className="p-cuprow__right"><Stars n={c.stars} /><span>{day(c.ratedAt)}</span></span>
                </button>
              );
            })}
          </section>
        ))
      )}
      <p className="p-footstat">{s.cups.length} {s.cups.length === 1 ? 'cup' : 'cups'} · {totals.length} {totals.length === 1 ? 'coffee' : 'coffees'} · {avg.toFixed(1)} average</p>
      <Nav active="journal" />
    </div>
  );
}

function Saved({ s }: { s: ProtoState }) {
  const [sort, setSort] = useState<'recent' | 'match'>('recent');
  const profile = useMemo(() => currentProfile(s), [s]);
  if (ACCOUNTS && !s.user) {
    return (
      <div className="p-screen">
        <Head title={<JournalTitle on="saved" />} />
        <Empty title="Save coffees you want to try" body="Tap the bookmark on any coffee. Your list is kept in your account.">
          <button className="p-btn p-btn--dark" onClick={() => go('/signup?reason=save&next=/saved')}>Create free account</button>
        </Empty>
        <Nav active="journal" />
      </div>
    );
  }
  const items = [...s.saved]
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
    .map((x) => getCoffeeById(x.coffeeId))
    .filter((c) => c !== undefined);
  if (sort === 'match' && profile) items.sort((a, b) => scoreSimilarity(b, profile) - scoreSimilarity(a, profile));
  return (
    <div className="p-screen">
      <Head title={<JournalTitle on="saved" />} />
      {items.length === 0 ? (
        <Empty title="Nothing saved yet" body="Tap the bookmark on any coffee you want to try.">
          <button className="p-btn p-btn--ghost" onClick={() => go('/discover')}>Browse coffees</button>
        </Empty>
      ) : (
        <>
          {profile && (
            <div className="p-chips">
              <button className="p-chip" data-on={sort === 'recent' || undefined} onClick={() => setSort('recent')}>Recently saved</button>
              <button className="p-chip" data-on={sort === 'match' || undefined} onClick={() => setSort('match')}>Best match</button>
            </div>
          )}
          <div className="p-grid">
            {items.map((c) => <Tile key={c.id} coffee={c} badge={tileBadge(s, c, profile)} onClick={() => go(`/coffee/${c.id}`)} />)}
          </div>
          <p className="p-footstat">{items.length} {items.length === 1 ? 'coffee' : 'coffees'} to try</p>
        </>
      )}
      <Nav active="journal" />
    </div>
  );
}

function Taste({ s }: { s: ProtoState }) {
  const profile = useMemo(() => currentProfile(s), [s]);
  // Shown as soon as there is real taste signal (quiz answers or a liked cup), signed in or not.
  if (!profile) {
    return (
      <div className="p-screen">
        <Head title="Taste" />
        <Empty title="Your taste starts here" body="Rate a coffee you’re drinking, or answer 3 quick questions, and Pico turns it into your match % on every bag.">
          <button className="p-btn p-btn--amber" onClick={() => go('/quiz?next=/taste')}>Take the taste quiz</button>
          <button className="p-btn p-btn--ghost" onClick={() => go('/discover')}>Find a coffee to rate</button>
        </Empty>
        <Nav active="taste" />
      </div>
    );
  }
  const originsAndProcess = [...profile.topOrigins.slice(0, 3), ...profile.topProcesses.slice(0, 2)];
  const basedOn = [s.tasteSeed && 'your quiz', s.cups.length > 0 && `${s.cups.length} ${s.cups.length === 1 ? 'cup' : 'cups'}`].filter(Boolean).join(' and ');
  const tags = Object.entries(profile?.tagWeights ?? {}).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)) as [FlavorTag, number][];
  const word = tags.slice(0, 2).map(([t]) => FLAVOR_TAG_LABELS[t]).join(' & ') || 'Still exploring';
  const tried = new Set(s.cups.map((c) => c.coffeeId));
  const picks = profile
    ? getAllCoffees().filter((c) => !tried.has(c.id) && c.available !== false).sort((a, b) => scoreSimilarity(b, profile) - scoreSimilarity(a, profile)).slice(0, 6)
    : [];
  return (
    <div className="p-screen">
      <Head title="Taste" />
      {!s.user && s.cups.length > 0 && <KeepCupsPrompt count={s.cups.length} next="/taste" />}
      <div className="p-taste-hero">
        <span className="p-eyebrow">You love</span>
        <span className="p-taste-hero__word">{word}</span>
        <span className="p-taste-hero__sub">{profile?.topRoastLevels[0] ? `${ROAST_LEVEL_LABELS[profile.topRoastLevels[0]]} roasts` : ''}{profile?.topOrigins[0] ? ` · mostly ${profile.topOrigins.slice(0, 2).join(' and ')}` : ''}</span>
        <TasteShareButton s={s} profile={profile} />
      </div>
      {tags.length > 0 && (
        <>
          <h2 className="p-section">Flavors</h2>
          <div className="p-bars">
            {tags.slice(0, 6).map(([t, w]) => (
              <div key={t} className="p-bar"><span>{FLAVOR_TAG_LABELS[t]}</span><i style={{ width: `${Math.round(w * 100)}%` }} /></div>
            ))}
          </div>
        </>
      )}
      {/* A quiz-only profile has no origins yet; hide the section instead of showing an empty heading. */}
      {originsAndProcess.length > 0 && (
        <>
          <h2 className="p-section">Origins & process</h2>
          <div className="p-notes">{originsAndProcess.map((x) => <span key={x} className="p-note">{x}</span>)}</div>
        </>
      )}
      <h2 className="p-section">Next bags for you</h2>
      <div className="p-row">
        {picks.map((c) => <Tile key={c.id} coffee={c} badge={tileBadge(s, c, profile)} onClick={() => go(`/coffee/${c.id}`)} />)}
      </div>
      <p className="p-footstat">Based on {basedOn}</p>
      <Nav active="taste" />
    </div>
  );
}

const SIGNUP_REASONS: Record<string, string> = {
  keep: 'Keep the cups you rated on this phone, on every device.',
  scans: `You’ve used your ${FREE_SCANS} free scans. With an account, scanning is unlimited.`,
  add: 'Coffees you add by hand are saved to your journal, so you need an account.',
  journal: 'Keep your journal and taste profile safe on every device.',
  account: 'Sign in or create your Pico account.',
  save: 'Create a free account to save coffees you want to try.',
};

// Sign-in: Google, or email with a one-time code. No passwords. The prototype accepts any 6 digits.
function SignUp({ s, q }: { s: ProtoState; q: URLSearchParams }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState<string | null>(null);
  const next = q.get('next') ?? '/discover';
  const finish = (name = '') => {
    signUp(name);
    if (pendingSave) { toggleSaved(pendingSave); pendingSave = null; }
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

function Import({ q }: { q: URLSearchParams }) {
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

function Profile({ s }: { s: ProtoState }) {
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

function Wrapped({ s, q }: { s: ProtoState; q: URLSearchParams }) {
  const [slide, setSlide] = useState(0);
  const latest = s.cups[0]?.ratedAt.slice(0, 7);
  const ym = q.get('m') ?? latest ?? new Date().toISOString().slice(0, 7);
  const cups = s.cups.filter((c) => c.ratedAt.startsWith(ym));
  const label = new Date(`${ym}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long' });
  const close = () => go('/journal');
  if (!cups.length) {
    return (
      <div className="p-wrapped" data-slide="0">
        <button className="p-scan__close" onClick={close} aria-label="Close"><CloseIcon /></button>
        <div className="p-wrapped__body"><span className="p-eyebrow">Wrapped</span><h1>Your first Pico month wraps on the 1st.</h1><p>Log a few cups and come back.</p></div>
      </div>
    );
  }
  const totals = totalsByCoffee(cups);
  const top = [...totals].sort((a, b) => b.cups.length - a.cups.length || b.average - a.average)[0];
  const tagCount = new Map<FlavorTag, number>();
  cups.forEach((c) => c.flavorTags.forEach((t) => tagCount.set(t, (tagCount.get(t) ?? 0) + 1)));
  const topTag = [...tagCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const roasters = [...new Set(cups.map((c) => getCoffeeById(c.coffeeId)?.roaster).filter(Boolean))];
  const origins = [...new Set(totals.map((t) => t.coffee.origin))];
  const avg = cups.reduce((t, c) => t + c.stars, 0) / cups.length;
  const slides: ReactNode[] = [
    <><span className="p-eyebrow">Pico Wrapped</span><h1>Your {label} in coffee</h1><p>Tap to start</p></>,
    <><span className="p-wrapped__big">{cups.length}</span><h1>cups logged</h1><p>{totals.length} different coffees, {avg.toFixed(1)} stars on average.</p></>,
    <><span className="p-eyebrow">Your coffee of the month</span><span className="p-wrapped__bag"><Bag coffee={top.coffee} w={500} /></span><h1>{top.coffee.name}</h1><p>{top.coffee.roaster} · {top.cups.length} {top.cups.length === 1 ? "cup" : "cups"} · <Stars n={top.average} /></p></>,
    <><span className="p-eyebrow">Your flavor</span><span className="p-wrapped__big p-wrapped__big--word">{topTag ? FLAVOR_TAG_LABELS[topTag] : '—'}</span><p>Then {origins.slice(0, 3).join(', ')}.</p></>,
    <><span className="p-wrapped__big">{roasters.length}</span><h1>roasters</h1><p>{roasters.slice(0, 4).join(', ')}{roasters.length > 4 ? ' and more' : ''}</p></>,
    <><span className="p-eyebrow">That’s your {label}</span><h1>Share it?</h1><button className="p-btn p-btn--amber" onClick={(e) => { e.stopPropagation(); go(`/share/month/${ym}`); }}><ShareIcon /> Share my month</button></>,
  ];
  return (
    <div className="p-wrapped" data-slide={slide % 3} onClick={() => (slide < slides.length - 1 ? setSlide(slide + 1) : close())}>
      <div className="p-wrapped__bars">{slides.map((_, i) => <span key={i} data-on={i <= slide || undefined} />)}</div>
      <button className="p-scan__close" onClick={(e) => { e.stopPropagation(); close(); }} aria-label="Close"><CloseIcon /></button>
      <div className="p-wrapped__body" key={slide}>{slides[slide]}</div>
    </div>
  );
}

function Share({ s, kind, id }: { s: ProtoState; kind: string; id: string }) {
  const cup = kind === 'cup' ? s.cups.find((c) => c.id === id) : undefined;
  const coffee = getCoffeeById(cup?.coffeeId ?? (kind === 'coffee' ? id : s.cups[0]?.coffeeId ?? getAllCoffees()[0].id));
  if (!coffee) return null;
  const title = kind === 'month' ? `My ${new Date(`${id}-01T12:00:00`).toLocaleDateString('en-GB', { month: 'long' })} in coffee`
    : kind === 'profile' ? `${s.user?.displayName ?? 'My'} taste on Pico` : coffee.name;
  // shortcut: shares a link + text only; v2 renders the card to a PNG (canvas) and shares the file.
  const share = async () => {
    const data = { title, text: `${title} · ${coffee.roaster}`, url: `https://westsoever.github.io/pico/#/coffee/${coffee.id}` };
    try { await navigator.share?.(data); } catch { /* cancelled */ }
  };
  return (
    <div className="p-sheet-page p-share">
      <button className="p-glass p-glass--round p-sheet-page__close" onClick={back} aria-label="Close"><CloseIcon /></button>
      <div className="p-card">
        {/* Enlarge cutouts to trim their transparent margin, but never past the 12px-inset box (wide boxes stay put). */}
        <span className="p-card__bag" style={{ '--trim': Math.min(1.4, 1 / ((bagWidths as Record<string, number>)[coffee.id] ?? 1)) } as CSSProperties}>
          <Bag coffee={coffee} w={500} />
        </span>
        <span className="p-card__eyebrow">{kind === 'month' || kind === 'profile' ? title : coffee.roaster}</span>
        <span className="p-card__name">{kind === 'month' ? `${s.cups.filter((c) => c.ratedAt.startsWith(id)).length} cups · top: ${coffee.name}` : coffee.name}</span>
        {cup && <span className="p-card__stars"><Stars n={cup.stars} size={18} /></span>}
        {cup?.note && <span className="p-card__note">“{cup.note}”</span>}
        <span className="p-card__foot">{(coffee.tastingNotes ?? []).slice(0, 3).join(' · ')}<b>pico</b></span>
      </div>
      <button className="p-btn p-btn--dark" onClick={share}><ShareIcon /> Share</button>
      <span className="p-fine">Opens Instagram, Messages and the rest. The link opens this coffee in Pico.</span>
    </div>
  );
}

function AddByHand() {
  const [done, setDone] = useState(false);
  return (
    <div className="p-sheet-page">
      <button className="p-glass p-glass--round p-sheet-page__close" onClick={back} aria-label="Close"><CloseIcon /></button>
      {done ? (
        <>
          <h1>Saved to your journal</h1>
          <p>Want other people to find it too? Send it to Pico and we’ll add it to the catalog.</p>
          <button className="p-btn p-btn--amber" onClick={() => go('/journal')}>Send this coffee to Pico</button>
          <button className="p-btn p-btn--ghost" onClick={() => go('/journal')}>Not now</button>
        </>
      ) : (
        <form className="p-form" onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
          <h1>Add a coffee</h1>
          <input placeholder="Coffee name" required />
          <input placeholder="Roaster" required />
          <input placeholder="Origin (optional)" />
          <button className="p-btn p-btn--dark">Save</button>
        </form>
      )}
    </div>
  );
}

function Privacy() {
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
function NoAccounts({ s }: { s: ProtoState }) {
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

// ---------- Prototype panel ----------

// Beta on the live site: demo states and the panel only in dev or with ?proto in the URL (e.g. /pico/?proto#/discover).
const PROTO_TOOLS = import.meta.env.DEV || new URLSearchParams(window.location.search).has('proto');

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
