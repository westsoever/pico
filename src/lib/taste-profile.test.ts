import { beforeEach, describe, expect, it } from 'vitest';
import type { Rating } from '../types/coffee';
import { computeTasteProfile } from './taste-profile';

function rating(overrides: Partial<Rating> = {}): Rating {
  return {
    coffeeId: 'eth-yirg-001',
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
        coffeeId: 'ken-aa-003',
        stars: 1,
        flavorTags: ['fruity', 'berry'],
      }),
      rating({
        coffeeId: 'eth-yirg-001',
        stars: 4,
        flavorTags: ['floral'],
      }),
      rating({
        coffeeId: 'col-huila-004',
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
        rating({ coffeeId: 'ken-aa-003', stars: 3, flavorTags: ['berry'] }),
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
