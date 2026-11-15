import { getAllCoffees } from './catalog';
import type { FlavorTag, Rating, RoastLevel, TasteProfile } from '../types/coffee';

function topValues<T extends string>(
  counts: Map<T, number>,
  limit = 3,
): T[] {
  return [...counts.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value]) => value);
}

export function computeTasteProfile(ratings: Rating[]): TasteProfile | null {
  const validRatings = ratings.filter(
    ({ stars }) => Number.isFinite(stars) && stars >= 1 && stars <= 5,
  );
  if (validRatings.length === 0) return null;

  const coffees = getAllCoffees();
  const coffeeMap = new Map(coffees.map((c) => [c.id, c]));

  const tagWeights: Partial<Record<FlavorTag, number>> = {};
  const originCounts = new Map<string, number>();
  const processCounts = new Map<string, number>();
  const roastCounts = new Map<RoastLevel, number>();
  let totalStars = 0;

  for (const rating of validRatings) {
    totalStars += rating.stars;
    if (rating.stars === 3) continue;

    // 4-5 stars add a trait; 1-2 stars take back half as much, so one bad cup can't erase a favourite.
    const weight = rating.stars >= 4 ? rating.stars / 5 : -(3 - rating.stars) / 4;

    for (const tag of rating.flavorTags) {
      tagWeights[tag] = (tagWeights[tag] ?? 0) + weight;
    }

    const coffee = coffeeMap.get(rating.coffeeId);
    if (!coffee) continue;

    originCounts.set(coffee.origin, (originCounts.get(coffee.origin) ?? 0) + weight);
    processCounts.set(coffee.process, (processCounts.get(coffee.process) ?? 0) + weight);
    roastCounts.set(coffee.roastLevel, (roastCounts.get(coffee.roastLevel) ?? 0) + weight);
  }

  for (const tag of Object.keys(tagWeights) as FlavorTag[]) {
    if ((tagWeights[tag] ?? 0) <= 0) delete tagWeights[tag];
  }
  const maxTagWeight = Math.max(...Object.values(tagWeights), 1);
  for (const tag of Object.keys(tagWeights) as FlavorTag[]) {
    tagWeights[tag] = (tagWeights[tag] ?? 0) / maxTagWeight;
  }

  return {
    tagWeights,
    topOrigins: topValues(originCounts),
    topProcesses: topValues(processCounts),
    topRoastLevels: topValues(roastCounts),
    avgRating: totalStars / validRatings.length,
    ratingCount: validRatings.length,
  };
}

/**
 * The one threshold for "we know your taste": at least one liked trait.
 * Match %, recommendations and the Taste screen all show only when this is true.
 */
export function hasTasteSignal(profile: TasteProfile | null): profile is TasteProfile {
  return (
    !!profile &&
    (Object.keys(profile.tagWeights).length > 0 ||
      profile.topOrigins.length > 0 ||
      profile.topProcesses.length > 0 ||
      profile.topRoastLevels.length > 0)
  );
}

/** What the first-run taste quiz tells us, before any cup is rated. */
export interface TasteSeed {
  flavors: FlavorTag[];
  roasts: RoastLevel[];
}

/**
 * Blend quiz answers into the rated profile. The quiz counts fully with no ratings
 * and fades as ratings come in (half at 3 ratings, a quarter at 9).
 */
export function blendTasteSeed(seed: TasteSeed | null, rated: TasteProfile | null): TasteProfile | null {
  if (!seed || (seed.flavors.length === 0 && seed.roasts.length === 0)) return rated;
  const count = rated?.ratingCount ?? 0;
  const share = 3 / (3 + count);
  const tagWeights: Partial<Record<FlavorTag, number>> = {};
  for (const [tag, weight] of Object.entries(rated?.tagWeights ?? {}) as [FlavorTag, number][]) {
    tagWeights[tag] = weight * (1 - share);
  }
  for (const tag of seed.flavors) tagWeights[tag] = (tagWeights[tag] ?? 0) + share;
  const maxTagWeight = Math.max(...Object.values(tagWeights), Number.EPSILON);
  for (const tag of Object.keys(tagWeights) as FlavorTag[]) {
    tagWeights[tag] = (tagWeights[tag] ?? 0) / maxTagWeight;
  }
  const ratedRoasts = rated?.topRoastLevels ?? [];
  const roasts = share >= 0.5 ? [...seed.roasts, ...ratedRoasts] : [...ratedRoasts, ...seed.roasts];
  return {
    tagWeights,
    topOrigins: rated?.topOrigins ?? [],
    topProcesses: rated?.topProcesses ?? [],
    topRoastLevels: [...new Set(roasts)].slice(0, 3),
    avgRating: rated?.avgRating ?? 0,
    ratingCount: count,
    quizShare: share,
  };
}
