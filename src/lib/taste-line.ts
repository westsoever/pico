import { FLAVOR_TAG_LABELS, ROAST_LEVEL_LABELS } from '../types/coffee';
import type { Coffee, FlavorTag, TasteProfile } from '../types/coffee';

/**
 * Why a coffee matches, in plain words: "Because you like fruity and berry, light roasts".
 * Only names traits the coffee and the profile share; null when they share none.
 */
export function matchReason(
  coffee: Pick<Coffee, 'roastLevel' | 'flavorTags' | 'origin'>,
  profile: TasteProfile,
): string | null {
  const flavors = coffee.flavorTags
    .filter((tag) => (profile.tagWeights[tag] ?? 0) >= 0.5)
    .sort((a: FlavorTag, b: FlavorTag) => (profile.tagWeights[b] ?? 0) - (profile.tagWeights[a] ?? 0))
    .slice(0, 2)
    .map((tag) => FLAVOR_TAG_LABELS[tag].toLowerCase());
  const parts = [
    flavors.join(' and '),
    profile.topRoastLevels.slice(0, 2).includes(coffee.roastLevel) && `${ROAST_LEVEL_LABELS[coffee.roastLevel].toLowerCase()} roasts`,
    profile.topOrigins[0] === coffee.origin && `coffee from ${coffee.origin}`,
  ].filter(Boolean).slice(0, 2); // two reasons at most, so it stays one short line
  return parts.length ? `Because you like ${parts.join(', ')}` : null;
}

// Flavor tags as describing words, so the line reads "Dark and chocolatey", not "Dark and chocolate".
const FLAVOR_WORDS: Record<FlavorTag, string> = {
  fruity: 'fruity',
  chocolate: 'chocolatey',
  floral: 'floral',
  nutty: 'nutty',
  bright: 'bright',
  'heavy-body': 'full-bodied',
  caramel: 'caramel-sweet',
  berry: 'berry-like',
  citrus: 'citrusy',
  spice: 'spicy',
};

/**
 * A coffee's taste in plain words, from its roast, flavor tags and tasting notes.
 * short: "Fruity · light" (tiles). long: "Light and fruity: strawberry, green apple" (coffee page).
 */
export function tasteLine(
  coffee: Pick<Coffee, 'roastLevel' | 'flavorTags' | 'tastingNotes'>,
  length: 'short' | 'long',
): string {
  const roast = ROAST_LEVEL_LABELS[coffee.roastLevel];
  const [first, second] = coffee.flavorTags.map((tag) => FLAVOR_WORDS[tag]);
  if (length === 'short') {
    const line = [first, roast.toLowerCase()].filter(Boolean).join(' · ');
    return line[0].toUpperCase() + line.slice(1);
  }
  const head = first ? `${roast} and ${first}` : `${roast} roast`;
  const notes = (coffee.tastingNotes ?? []).slice(0, 2).map((note) => note.toLowerCase());
  if (notes.length > 0) return `${head}: ${notes.join(', ')}`;
  return second ? `${roast}, ${first} and ${second}` : head;
}
