import { getAllCoffees } from './catalog';
import type { FlavorTag, Rating, RoastLevel, TasteProfile } from '../types/coffee';

function topValues<T extends string>(
  counts: Map<T, number>,
  limit = 3,
): T[] {
  return [...counts.entries()]
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
    if (rating.stars < 4) continue;

    const weight = rating.stars / 5;

    for (const tag of rating.flavorTags) {
      tagWeights[tag] = (tagWeights[tag] ?? 0) + weight;
    }

    const coffee = coffeeMap.get(rating.coffeeId);
    if (!coffee) continue;

    originCounts.set(coffee.origin, (originCounts.get(coffee.origin) ?? 0) + weight);
    processCounts.set(coffee.process, (processCounts.get(coffee.process) ?? 0) + weight);
    roastCounts.set(coffee.roastLevel, (roastCounts.get(coffee.roastLevel) ?? 0) + weight);
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
