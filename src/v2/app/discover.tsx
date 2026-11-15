import { useEffect, useMemo, useRef, useState } from 'react';
import { searchCoffees } from '../../lib/catalog';
import { scoreSimilarity } from '../../lib/similarity';
import { FLAVOR_TAG_LABELS, type Coffee, type FlavorTag } from '../../types/coffee';
import { ACCOUNTS, FREE_SCANS, currentProfile, communityRating, type ProtoState, allCoffees } from './state';
import { ArrowUpRight, CloseIcon, SearchIcon, Star } from './icons';
import { Avatar, Bag, Empty, Head, Nav, SaveButton, Tile } from './parts';
import { go } from './routing';
import { COFFEE_TYPES, type CoffeeType, SHELVES, TYPE_LABELS, isType, shelfOf, tileBadge } from './util';

export function Discover({ s }: { s: ProtoState }) {
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
  const all = allCoffees().filter((c) => c.available !== false);
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
