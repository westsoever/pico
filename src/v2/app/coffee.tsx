import { useMemo, useState } from 'react';
import { getCoffeeById } from '../../lib/catalog';
import { getSimilarToCoffee } from '../../lib/similarity';
import { TasteHints } from './features/TasteHints';
import { matchReason, tasteLine } from '../../lib/taste-line';
import { BREW_METHOD_OPTIONS, FLAVOR_TAG_LABELS, ROAST_LEVEL_LABELS, type BrewJournal, type BrewMethod, type FlavorTag } from '../../types/coffee';
import { ACCOUNTS, addCup, currentProfile, updateCup, deleteCup, communityRating, type Cup, type ProtoState } from './state';
import { ArrowUpRight, BackIcon, ShareIcon, Star, StarOutline } from './icons';
import { Bag, Empty, SaveButton, Stars, Tile } from './parts';
import { close, go } from './routing';
import { RATING_WORDS, day, match } from './util';

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
export function KeepCupsPrompt({ count, next }: { count: number; next: string }) {
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

export function CoffeeScreen({ s, id }: { s: ProtoState; id: string }) {
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
