import { useMemo } from 'react';
import { getAllCoffees } from '../../lib/catalog';
import { scoreSimilarity } from '../../lib/similarity';
import { TasteShareButton } from './features/TasteShare';
import { FLAVOR_TAG_LABELS, ROAST_LEVEL_LABELS, type FlavorTag } from '../../types/coffee';
import { currentProfile, type ProtoState } from './state';
import { KeepCupsPrompt } from './coffee';
import { Empty, Head, Nav, Tile } from './parts';
import { go } from './routing';
import { tileBadge } from './util';

export function Taste({ s }: { s: ProtoState }) {
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
