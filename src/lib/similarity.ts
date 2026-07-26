import { getAllCoffees } from './catalog';
import type { Coffee, SimilarCoffee, TasteProfile } from '../types/coffee';

function tagOverlap(
  coffeeTags: string[],
  profileWeights: Partial<Record<string, number>>,
): number {
  if (coffeeTags.length === 0) return 0;
  let score = 0;
  for (const tag of coffeeTags) {
    score += profileWeights[tag] ?? 0;
  }
  return score / coffeeTags.length;
}

function listMatch(value: string, preferred: string[]): number {
  if (preferred.length === 0) return 0;
  const index = preferred.indexOf(value);
  if (index === -1) return 0;
  return 1 - index * 0.25;
}

export function scoreSimilarity(coffee: Coffee, profile: TasteProfile): number {
  const tagScore = tagOverlap(coffee.flavorTags, profile.tagWeights);
  const originScore = listMatch(coffee.origin, profile.topOrigins);
  const processScore = listMatch(coffee.process, profile.topProcesses);
  const roastScore = listMatch(coffee.roastLevel, profile.topRoastLevels);

  return tagScore * 0.5 + originScore * 0.2 + processScore * 0.15 + roastScore * 0.15;
}

export function getSimilarCoffees(
  profile: TasteProfile,
  excludeIds: string[] = [],
  limit = 5,
): SimilarCoffee[] {
  const excluded = new Set(excludeIds);

  return getAllCoffees()
    .filter((coffee) => !excluded.has(coffee.id))
    .map((coffee) => ({
      coffee,
      score: scoreSimilarity(coffee, profile),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function getSimilarToCoffee(
  coffee: Coffee,
  excludeIds: string[] = [],
  limit = 5,
): SimilarCoffee[] {
  const pseudoProfile: TasteProfile = {
    tagWeights: Object.fromEntries(coffee.flavorTags.map((t) => [t, 1])),
    topOrigins: [coffee.origin],
    topProcesses: [coffee.process],
    topRoastLevels: [coffee.roastLevel],
    avgRating: 4,
    ratingCount: 1,
  };

  const excluded = new Set([...excludeIds, coffee.id]);

  return getAllCoffees()
    .filter((c) => !excluded.has(c.id))
    .map((c) => ({
      coffee: c,
      score: scoreSimilarity(c, pseudoProfile),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function formatMatchPercent(score: number): number {
  return Math.round(Math.min(100, Math.max(0, score * 100)));
}
