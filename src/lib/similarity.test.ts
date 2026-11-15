import { describe, expect, it } from 'vitest';
import type { Coffee, TasteProfile } from '../types/coffee';
import { scoreSimilarity } from './similarity';
import { blendTasteSeed } from './taste-profile';

const coffee: Coffee = {
  id: 'test-fruity',
  name: 'Test',
  roaster: 'Test Roaster',
  origin: 'Kenya',
  process: 'washed',
  roastLevel: 'light',
  flavorTags: ['fruity', 'berry'],
  description: '',
};

describe('scoreSimilarity', () => {
  it('scores a quiz-only perfect fit 90%: origin and process are left out, and a guess is capped', () => {
    const profile = blendTasteSeed({ flavors: ['fruity', 'berry'], roasts: ['light'] }, null);
    expect(scoreSimilarity(coffee, profile!)).toBeCloseTo(0.9);
  });

  it('keeps the original weights when the profile knows every part', () => {
    const profile: TasteProfile = {
      tagWeights: { fruity: 1 },
      topOrigins: ['Kenya'],
      topProcesses: ['natural'],
      topRoastLevels: ['medium', 'light'],
      avgRating: 4,
      ratingCount: 3,
    };
    // tags 0.5 * 0.5 + origin 1 * 0.2 + process 0 + roast 0.75 * 0.15
    expect(scoreSimilarity(coffee, profile)).toBeCloseTo(0.5625);
  });

  it('scores 0 for an empty profile', () => {
    const empty: TasteProfile = { tagWeights: {}, topOrigins: [], topProcesses: [], topRoastLevels: [], avgRating: 0, ratingCount: 0 };
    expect(scoreSimilarity(coffee, empty)).toBe(0);
  });
});
