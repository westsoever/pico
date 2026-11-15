import { describe, expect, it } from 'vitest';
import type { TasteProfile } from '../types/coffee';
import { matchReason, tasteLine } from './taste-line';

describe('matchReason', () => {
  const profile: TasteProfile = {
    tagWeights: { fruity: 1, berry: 0.6, chocolate: 0.2 },
    topOrigins: ['Kenya'],
    topProcesses: ['washed'],
    topRoastLevels: ['light'],
    avgRating: 4.5,
    ratingCount: 4,
  };

  it('names shared flavors and roast, at most two reasons', () => {
    expect(matchReason({ roastLevel: 'light', origin: 'Kenya', flavorTags: ['berry', 'fruity', 'chocolate'] }, profile))
      .toBe('Because you like fruity and berry, light roasts');
    expect(matchReason({ roastLevel: 'dark', origin: 'Kenya', flavorTags: ['chocolate'] }, profile))
      .toBe('Because you like coffee from Kenya');
  });

  it('skips weak flavors and returns null when nothing is shared', () => {
    expect(matchReason({ roastLevel: 'dark', origin: 'Brazil', flavorTags: ['chocolate'] }, profile)).toBeNull();
  });
});

describe('tasteLine', () => {
  const fruity = {
    roastLevel: 'light' as const,
    flavorTags: ['fruity' as const, 'berry' as const],
    tastingNotes: ['Strawberry candy', 'green apples', 'honeydew melon'],
  };

  it('gives a short line for tiles', () => {
    expect(tasteLine(fruity, 'short')).toBe('Fruity · light');
  });

  it('gives a long line with the first two tasting notes', () => {
    expect(tasteLine(fruity, 'long')).toBe('Light and fruity: strawberry candy, green apples');
  });

  it('falls back to flavor tags, then roast alone', () => {
    expect(tasteLine({ ...fruity, tastingNotes: undefined }, 'long')).toBe('Light, fruity and berry-like');
    expect(tasteLine({ roastLevel: 'dark', flavorTags: [], tastingNotes: [] }, 'long')).toBe('Dark roast');
    expect(tasteLine({ roastLevel: 'dark', flavorTags: [] }, 'short')).toBe('Dark');
  });
});
