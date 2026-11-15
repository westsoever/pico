// Feature 4: share your taste. A sheet on /taste with two choices, the "Share my taste" card (#/tastecard)
// and the TasteMatch screen a link opens (#/tastematch/<payload>). No backend: the taste rides in the link.
import { useMemo, useState, type ReactNode } from 'react';
import { getAllCoffees } from '../../../lib/catalog';
import { formatMatchPercent, scoreSimilarity } from '../../../lib/similarity';
import { coffeeForBoth, decodeTaste, encodeTaste, sharedLine, splitLine } from '../../../lib/taste-link';
import { FLAVOR_TAG_LABELS, type Coffee, type FlavorTag, type TasteProfile } from '../../../types/coffee';
import { CloseIcon, ShareIcon } from '../icons';
import { currentProfile, type ProtoState } from '../state';
import './wow.css';

type BagFn = (coffee: Coffee) => ReactNode;
const go = (to: string) => { window.location.hash = to; };

const topTags = (profile: TasteProfile) =>
  (Object.entries(profile.tagWeights) as [FlavorTag, number][]).sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
/** The Taste screen's headline word: "Fruity & Chocolate". */
const tasteWord = (profile: TasteProfile) => topTags(profile).slice(0, 2).map((tag) => FLAVOR_TAG_LABELS[tag]).join(' & ') || 'Still exploring';
const nameOf = (s: ProtoState) => s.user?.displayName ?? '';
const linkFor = (profile: TasteProfile, name: string) =>
  `${window.location.origin}${window.location.pathname}#/tastematch/${encodeTaste(profile, name)}`;

async function shareOrCopy(data: { title: string; text: string; url: string }): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) { await navigator.share(data); return 'shared'; }
    await navigator.clipboard.writeText(data.url);
    return 'copied';
  } catch {
    return 'failed'; // cancelled, or no clipboard permission
  }
}

/** Share button on /taste and its two-choice sheet. */
export function TasteShareButton({ s, profile }: { s: ProtoState; profile: TasteProfile }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const sendLink = async () => {
    const result = await shareOrCopy({ title: 'TasteMatch on Pico', text: 'How close is our coffee taste?', url: linkFor(profile, nameOf(s)) });
    if (result === 'copied') setCopied(true);
    else if (result === 'shared') setOpen(false);
  };
  return (
    <>
      <button className="p-glass p-glass--round w-share-taste" onClick={() => { setCopied(false); setOpen(true); }} aria-label="Share your taste"><ShareIcon /></button>
      {open && (
        <div className="w-sheet" role="dialog" aria-modal="true" aria-label="Share your taste" onClick={() => setOpen(false)}>
          <div className="w-sheet__panel" onClick={(e) => e.stopPropagation()}>
            <button className="w-sheet__choice" onClick={sendLink}>
              <b>TasteMatch link</b>
              <span>{copied ? 'Link copied' : 'See what you and a friend share'}</span>
            </button>
            <button className="w-sheet__choice" onClick={() => go('/tastecard')}>
              <b>Share my taste</b>
              <span>A card for Instagram, Messages and the rest</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** "Share my taste" card, in the coffee share card's look (.p-card). */
export function TasteCard({ s, bag }: { s: ProtoState; bag: BagFn }) {
  const profile = useMemo(() => currentProfile(s), [s]);
  const coffees = useMemo(() => getAllCoffees(), []);
  if (!profile) { go('/taste'); return null; }

  const byId = new Map(coffees.map((c) => [c.id, c]));
  // The bag on the card: their best-rated coffee with a photo, else their best catalog match.
  const favorite = [...s.cups].sort((a, b) => b.stars - a.stars || b.ratedAt.localeCompare(a.ratedAt))
    .map((cup) => byId.get(cup.coffeeId)).find((c) => c?.imageUrl)
    ?? coffees.filter((c) => c.imageUrl).sort((a, b) => scoreSimilarity(b, profile) - scoreSimilarity(a, profile))[0];
  const first = s.cups.reduce<string | null>((min, cup) => (!min || cup.ratedAt < min ? cup.ratedAt : min), null);
  const rated = new Set(s.cups.map((cup) => cup.coffeeId)).size;
  const since = first && new Date(first).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const name = nameOf(s);
  const title = name ? `${name}’s taste on Pico` : 'My taste on Pico';

  const share = () => shareOrCopy({ title, text: `${title}: ${tasteWord(profile)}`, url: linkFor(profile, name) });
  return (
    <div className="p-sheet-page p-share">
      <button className="p-glass p-glass--round p-sheet-page__close" onClick={() => history.back()} aria-label="Close"><CloseIcon /></button>
      <div className="p-card">
        {favorite && <span className="p-card__bag">{bag(favorite)}</span>}
        <span className="p-card__eyebrow">{title}</span>
        <span className="p-card__name">{tasteWord(profile)}</span>
        {rated > 0 && since && <span className="p-card__note w-card__since">{rated} {rated === 1 ? 'coffee' : 'coffees'} rated since {since}</span>}
        <span className="p-card__foot">{topTags(profile).slice(0, 3).map((tag) => FLAVOR_TAG_LABELS[tag]).join(' · ')}<b>pico</b></span>
      </div>
      <button className="p-btn p-btn--dark" onClick={share}><ShareIcon /> Share</button>
    </div>
  );
}

/** What a TasteMatch link opens. The payload is untrusted: decodeTaste validates and clamps it. */
export function TasteMatch({ s, payload, bag }: { s: ProtoState; payload: string; bag: BagFn }) {
  const friend = useMemo(() => decodeTaste(payload), [payload]);
  const mine = useMemo(() => currentProfile(s), [s]);
  const both = useMemo(() => {
    if (!friend || !mine) return null;
    return coffeeForBoth(getAllCoffees().filter((c) => c.imageUrl), mine, friend.profile, new Set(s.cups.map((cup) => cup.coffeeId)));
  }, [friend, mine, s.cups]);
  const close = <button className="p-glass p-glass--round p-sheet-page__close" onClick={() => go('/discover')} aria-label="Close"><CloseIcon /></button>;

  if (!friend) {
    return (
      <div className="p-sheet-page">
        {close}
        <h1>This TasteMatch link doesn’t work</h1>
        <p>It may be cut off, or made by an older Pico. Ask your friend to send it again.</p>
        <button className="p-btn p-btn--amber" onClick={() => go('/discover')}>Discover coffees</button>
      </div>
    );
  }

  const theirFlavors = topTags(friend.profile).slice(0, 3).map((tag) => FLAVOR_TAG_LABELS[tag].toLowerCase()).join(', ');
  if (!mine) {
    return (
      <div className="p-sheet-page">
        {close}
        <h1>{friend.name} loves {tasteWord(friend.profile).toLowerCase()}</h1>
        <p>{theirFlavors && `Top flavors: ${theirFlavors}. `}Tell Pico your taste to see what you share.</p>
        <button className="p-btn p-btn--amber" onClick={() => go(`/quiz?next=${encodeURIComponent(`/tastematch/${payload}`)}`)}>Take the taste quiz</button>
        <button className="p-btn p-btn--ghost" onClick={() => go('/scan')}>Scan a bag instead</button>
      </div>
    );
  }

  const shared = sharedLine(mine, friend.profile);
  const split = splitLine(mine, friend.profile, friend.name);
  const coffee = both && (
    <>
      <h2 className="p-section">One for you both</h2>
      <button className="w-match__coffee" onClick={() => go(`/coffee/${both.coffee.id}`)}>
        <span className="w-match__bag">{bag(both.coffee)}</span>
        <span className="w-match__text">
          <b>{both.coffee.name}</b>
          <span>{both.coffee.roaster}</span>
          <span className="p-match">{formatMatchPercent(both.mine)}% you · {formatMatchPercent(both.theirs)}% {friend.name}</span>
        </span>
      </button>
    </>
  );
  const splitLineEl = split && <p className="p-reason">{split}</p>;
  const sendBack = () => shareOrCopy({ title: 'TasteMatch on Pico', text: 'Here’s my coffee taste', url: linkFor(mine, nameOf(s)) });
  return (
    <div className="p-sheet-page w-match">
      {close}
      <h1>You and {friend.name}</h1>
      {/* Nothing shared: lead with the coffee you'd both like, not with where you split. */}
      {shared ? <><p className="p-taste">{shared}</p>{splitLineEl}{coffee}</> : <>{coffee}{splitLineEl}</>}
      <button className="p-btn p-btn--dark w-match__back" onClick={sendBack}><ShareIcon /> Send yours back</button>
    </div>
  );
}
