// Scan miss with enough read from the label: a coffee sketched from the label text,
// its taste line and match, and the add form prefilled. Feature 1 ("any bag gets an answer").
import { useState } from 'react';
import { draftToCoffee, type LabelDraft } from '../../../lib/label-parse';
import { formatMatchPercent, scoreSimilarity } from '../../../lib/similarity';
import { tasteLine } from '../../../lib/taste-line';
import { hasTasteSignal } from '../../../lib/taste-profile';
import { ROAST_LEVEL_LABELS, type RoastLevel, type TasteProfile } from '../../../types/coffee';
import { store, uid } from '../state';
import './wow.css';

const ROASTS: RoastLevel[] = ['light', 'medium', 'dark'];
const cap = (text: string) => text[0].toUpperCase() + text.slice(1);

export function LabelAnswer({ draft, photo, profile, onRetry, retryLabel = 'Scan another bag' }: {
  draft: LabelDraft; photo?: string; profile: TasteProfile | null; onRetry: () => void; retryLabel?: string;
}) {
  const [id] = useState(() => `custom-${uid()}`);
  const [name, setName] = useState([draft.origin, draft.variety].filter(Boolean).join(' '));
  const [roaster, setRoaster] = useState(draft.roaster ?? '');
  const [roastLevel, setRoastLevel] = useState<RoastLevel | undefined>(draft.roastLevel);

  // The same Coffee object that gets saved, scored by the same functions as the coffee page, so the % never jumps.
  const coffee = roastLevel && draftToCoffee(draft, { id, name: name || 'x', roaster: roaster || 'x', roastLevel });
  const m = coffee && hasTasteSignal(profile) ? formatMatchPercent(scoreSimilarity(coffee, profile)) : null;
  const facts = [draft.origin, draft.process && cap(draft.process), draft.variety].filter(Boolean).join(' · ');
  const taste = coffee ? tasteLine(coffee, 'long') : draft.tastingNotes.length ? cap(draft.tastingNotes.join(', ')) : null;

  const save = () => {
    if (!coffee) return;
    // Yours, like a cup: on the phone, and into the account on sign-in. Same id the match above was scored with.
    store.addUserCoffee({ ...coffee, name: name.trim(), roaster: roaster.trim() });
    window.location.hash = `/coffee/${id}`;
  };

  return (
    <form className="w-answer" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="w-answer__card">
        {photo && <img className="w-answer__photo" src={photo} alt="Your bag" />}
        <div className="w-answer__text">
          {facts && <b>{facts}</b>}
          {taste && <span>{taste}</span>}
          {m !== null && <span className="p-match w-answer__match">{m}% match</span>}
        </div>
      </div>

      <label className="w-field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Coffee name" required />
      </label>
      <label className="w-field">
        <span>Roaster</span>
        <input value={roaster} onChange={(e) => setRoaster(e.target.value)} placeholder="Roaster" required />
      </label>
      <div className="w-field" role="radiogroup" aria-label="Roast">
        <span>Roast</span>
        <div className="w-roasts">
          {ROASTS.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={roastLevel === r} data-on={roastLevel === r || undefined} onClick={() => setRoastLevel(r)}>
              {ROAST_LEVEL_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      <button className="p-btn p-btn--amber" disabled={!coffee || !name.trim() || !roaster.trim()}>Save and rate it</button>
      <button type="button" className="p-link p-link--light" onClick={onRetry}>{retryLabel}</button>
    </form>
  );
}
