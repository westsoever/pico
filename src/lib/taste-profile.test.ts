import { beforeEach, describe, expect, it } from 'vitest';
import type { Rating } from '../types/coffee';
import { blendTasteSeed, computeTasteProfile, hasTasteSignal } from './taste-profile';

function rating(overrides: Partial<Rating> = {}): Rating {
  return {
    coffeeId: 'fixture-ethiopia',
    stars: 4,
    flavorTags: ['floral'],
    note: '',
    ratedAt: '2026-07-18T12:00:00.000Z',
    ...overrides,
  };
}

describe('taste profile calculation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('derives preferences only from ratings of at least four stars', () => {
    const profile = computeTasteProfile([
      rating({
        coffeeId: 'fixture-kenya',
        stars: 1,
        flavorTags: ['fruity', 'berry'],
      }),
      rating({
        coffeeId: 'fixture-ethiopia',
        stars: 4,
        flavorTags: ['floral'],
      }),
      rating({
        coffeeId: 'fixture-colombia',
        stars: 5,
        flavorTags: ['chocolate'],
      }),
    ]);

    expect(profile).toEqual({
      tagWeights: { floral: 0.8, chocolate: 1 },
      topOrigins: ['Colombia', 'Ethiopia'],
      topProcesses: ['washed'],
      topRoastLevels: ['medium', 'light'],
      avgRating: 10 / 3,
      ratingCount: 3,
    });
  });

  it('retains average and count but has no preferences when nothing was enjoyed', () => {
    expect(
      computeTasteProfile([
        rating({ stars: 1, flavorTags: ['fruity'] }),
        rating({ coffeeId: 'fixture-kenya', stars: 3, flavorTags: ['berry'] }),
      ]),
    ).toEqual({
      tagWeights: {},
      topOrigins: [],
      topProcesses: [],
      topRoastLevels: [],
      avgRating: 2,
      ratingCount: 2,
    });
  });

  it('excludes invalid star values from the average and count', () => {
    expect(
      computeTasteProfile([
        rating({ stars: 0 }),
        rating({ stars: 6 }),
        rating({ stars: Number.NaN }),
        rating({ stars: 5 }),
      ]),
    ).toMatchObject({
      avgRating: 5,
      ratingCount: 1,
    });
  });
});

describe('taste signal threshold', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('has no signal after only low ratings, so no match % shows', () => {
    const profile = computeTasteProfile([rating({ coffeeId: 'fixture-kenya', stars: 2, flavorTags: ['fruity'] })]);
    expect(profile?.ratingCount).toBe(1);
    expect(hasTasteSignal(profile)).toBe(false);
    expect(hasTasteSignal(null)).toBe(false);
  });

  it('has signal after one liked cup', () => {
    expect(hasTasteSignal(computeTasteProfile([rating({ stars: 4 })]))).toBe(true);
  });

  it('lets a low rating take back part of a liked trait', () => {
    const profile = computeTasteProfile([
      rating({ coffeeId: 'fixture-ethiopia', stars: 5, flavorTags: ['fruity', 'floral'] }),
      rating({ coffeeId: 'fixture-kenya', stars: 1, flavorTags: ['fruity'] }),
    ]);
    // fruity 1 - 0.5 = 0.5, floral 1: the dislike lowers fruity but does not erase it.
    expect(profile?.tagWeights).toEqual({ floral: 1, fruity: 0.5 });
    // light roast: Ethiopia +1, Kenya -0.5; Kenya as an origin nets below zero and is dropped.
    expect(profile?.topRoastLevels).toEqual(['light']);
    expect(profile?.topOrigins).toEqual(['Ethiopia']);
  });
});

describe('taste quiz seed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('gives a profile with signal before any rating', () => {
    const profile = blendTasteSeed({ flavors: ['fruity', 'floral'], roasts: ['light'] }, null);
    expect(hasTasteSignal(profile)).toBe(true);
    expect(profile).toMatchObject({ tagWeights: { fruity: 1, floral: 1 }, topRoastLevels: ['light'], ratingCount: 0 });
  });

  it('fades as real ratings come in', () => {
    const rated = computeTasteProfile(
      Array.from({ length: 9 }, () => rating({ coffeeId: 'fixture-colombia', stars: 5, flavorTags: ['chocolate'] })),
    );
    const profile = blendTasteSeed({ flavors: ['fruity'], roasts: ['light'] }, rated);
    // 9 ratings: quiz share is 3 / 12 = 0.25, ratings 0.75.
    expect(profile?.tagWeights).toEqual({ chocolate: 1, fruity: 1 / 3 });
    expect(profile?.topRoastLevels).toEqual(['medium', 'light']);
  });

  it('returns the rated profile unchanged without quiz answers', () => {
    const rated = computeTasteProfile([rating()]);
    expect(blendTasteSeed(null, rated)).toBe(rated);
    expect(blendTasteSeed({ flavors: [], roasts: [] }, rated)).toBe(rated);
  });
});
