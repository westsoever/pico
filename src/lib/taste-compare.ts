import type { Coffee, FlavorTag, TasteProfile } from '../types/coffee';
import { scoreSimilarity } from './similarity';

export interface RatedCup {
  coffeeId: string;
  stars: number;
}

/** Below this, two coffees are too different to say "like the one you loved". */
export const TWIN_MIN_SIMILARITY = 0.5;
/** A guess needs this many other rated coffees, at least one of them similar (TWIN_MIN_SIMILARITY). */
const GUESS_MIN_RATED = 3;

const MORE: Record<FlavorTag, string> = {
  fruity: 'more fruit',
  chocolate: 'more chocolate',
  floral: 'more florals',
  nutty: 'more nuttiness',
  bright: 'more brightness',
  'heavy-body': 'more body',
  caramel: 'more caramel',
  berry: 'more berries',
  citrus: 'more citrus',
  spice: 'more spice',
};

const ROAST_ORDER = { light: 0, medium: 1, dark: 2 } as const;

/** How alike two coffees are, 0–1: b scored against a profile made of a alone (as getSimilarToCoffee does). */
export function coffeeSimilarity(a: Coffee, b: Coffee): number {
  return scoreSimilarity(b, {
    tagWeights: Object.fromEntries(a.flavorTags.map((tag) => [tag, 1])),
    topOrigins: [a.origin],
    topProcesses: [a.process],
    topRoastLevels: [a.roastLevel],
    avgRating: 4,
    ratingCount: 1,
  });
}

/** Average stars per coffee, leaving out `excludeId` (the coffee being looked at). */
function averages(cups: RatedCup[], excludeId: string): Map<string, number> {
  const sums = new Map<string, [number, number]>();
  for (const { coffeeId, stars } of cups) {
    if (coffeeId === excludeId || !Number.isFinite(stars)) continue;
    const [total, count] = sums.get(coffeeId) ?? [0, 0];
    sums.set(coffeeId, [total + stars, count + 1]);
  }
  return new Map([...sums].map(([id, [total, count]]) => [id, total / count]));
}

/**
 * "Like the Kieni you loved, with more chocolate." The most similar coffee rated 4+ on average,
 * with one difference: a flavor this coffee has and that one lacks (the person's favorite first), else roast.
 */
export function lovedTwinLine(
  coffee: Coffee,
  cups: RatedCup[],
  coffees: Coffee[],
  profile: TasteProfile,
): string | null {
  const byId = new Map(coffees.map((c) => [c.id, c]));
  const twin = [...averages(cups, coffee.id)]
    .filter(([, stars]) => stars >= 4)
    .flatMap(([id]) => byId.get(id) ?? [])
    .map((loved) => ({ loved, score: coffeeSimilarity(coffee, loved) }))
    .filter(({ score }) => score >= TWIN_MIN_SIMILARITY)
    .sort((a, b) => b.score - a.score)[0]?.loved;
  if (!twin) return null;

  const extra = coffee.flavorTags
    .filter((tag) => !twin.flavorTags.includes(tag))
    .sort((a, b) => (profile.tagWeights[b] ?? 0) - (profile.tagWeights[a] ?? 0))[0];
  const roast = ROAST_ORDER[coffee.roastLevel] - ROAST_ORDER[twin.roastLevel];
  const difference = extra ? `, with ${MORE[extra]}` : roast > 0 ? ', roasted darker' : roast < 0 ? ', roasted lighter' : '';
  return `Like the ${twin.name} you loved${difference}.`;
}

/**
 * Stars Pico expects this person to give: their own stars on similar coffees, weighted by similarity.
 * Null when too little similar coffee has been rated to guess honestly.
 */
export function guessStars(coffee: Coffee, cups: RatedCup[], coffees: Coffee[]): number | null {
  const byId = new Map(coffees.map((c) => [c.id, c]));
  let count = 0;
  let similar = false;
  let weight = 0;
  let total = 0;
  for (const [id, stars] of averages(cups, coffee.id)) {
    const rated = byId.get(id);
    if (!rated) continue;
    const score = coffeeSimilarity(coffee, rated);
    count += 1;
    similar ||= score >= TWIN_MIN_SIMILARITY;
    // Squared, so close coffees count far more than loosely similar ones.
    weight += score ** 2;
    total += score ** 2 * stars;
  }
  if (count < GUESS_MIN_RATED || !similar || weight === 0) return null;
  return Math.min(5, Math.max(1, Math.round(total / weight)));
}
