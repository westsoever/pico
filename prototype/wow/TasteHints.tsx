// Coffee page lines from the person's own cups (feature 3): "Like the Kieni you loved, with more chocolate."
// and "Pico guesses 4 stars for you" → "Called it". Rendered only when the profile has real signal.
import { useMemo } from 'react';
import { getAllCoffees } from '../../src/lib/catalog';
import { coffeeHints, type RatedCup } from '../../src/lib/taste-compare';
import type { Coffee, TasteProfile } from '../../src/types/coffee';
import './wow.css';

export function TasteHints({ coffee, cups, profile, reason, rated, savedStars }: {
  coffee: Coffee;
  cups: RatedCup[];
  profile: TasteProfile;
  /** The page's own "Because you like…" line; the loved-coffee line takes its place when there is one. */
  reason: string | null;
  /** The person had rated this coffee before opening the page. */
  rated: boolean;
  /** Stars of the cup just saved on this page, if any. */
  savedStars?: number;
}) {
  // Cups of this coffee are left out of both, so the guess stays put once the person rates.
  const { twin, guess, showReason } = useMemo(() => coffeeHints(coffee, cups, getAllCoffees(), profile), [coffee, cups, profile]);

  if (rated) return null;
  const line = showReason ? twin ?? reason : null;
  const guessLine = savedStars !== undefined
    ? (savedStars === guess ? 'Called it' : null)
    : guess !== null ? `Pico guesses ${guess} star${guess === 1 ? '' : 's'} for you` : null;
  return (
    <>
      {line && <p className="p-reason">{line}</p>}
      {guessLine && <p className="p-reason">{guessLine}</p>}
    </>
  );
}
