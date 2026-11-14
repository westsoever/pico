import { describe, expect, it } from 'vitest';
import type { Rating, TasteProfile } from '../types/coffee';
import { getCoffeeById } from './catalog';
import { exportJournal, getRatingForCoffee, importJournal, loadUserData, saveRating, saveUserData } from './storage';

const STORAGE_KEY = 'pico-user-data';

function rating(overrides: Partial<Rating> = {}): Rating {
  return {
    coffeeId: 'fixture-ethiopia',
    stars: 4,
    flavorTags: ['floral'],
    note: 'Tea-like',
    ratedAt: '2026-07-18T12:00:00.000Z',
    ...overrides,
  };
}

describe('Pico user-data storage compatibility', () => {
  it('loads a legacy rating that predates optional brew details', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ratings: [rating()],
        tasteProfile: null,
      }),
    );

    const data = loadUserData();

    expect(data.ratings).toEqual([rating()]);
    expect(data.ratings[0]).not.toHaveProperty('brew');
  });

  it('returns empty user data when localStorage contains malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{"ratings":');

    expect(loadUserData()).toEqual({
      ratings: [],
      tasteProfile: null,
    });
  });

  it('sanitizes persisted ratings and brew fields', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ratings: [
          null,
          { stars: 5 },
          {
            coffeeId: 'zero-stars',
            stars: 0,
            flavorTags: [],
            ratedAt: '2026-07-18T12:00:00.000Z',
          },
          {
            coffeeId: 'too-many-stars',
            stars: 12,
            flavorTags: [],
            ratedAt: '2026-07-18T12:00:00.000Z',
          },
          {
            coffeeId: 'coffee-with-bad-data',
            stars: 5,
            flavorTags: ['fruity', 'not-a-tag', 'fruity', 42],
            note: 123,
            ratedAt: 'not-a-date',
            brew: {
              method: 'chemex',
              grind: 'medium',
              doseGrams: 0,
              waterGrams: 300,
              yieldGrams: -1,
              temperatureCelsius: 0,
              brewTimeSeconds: 180,
            },
          },
        ],
      }),
    );

    expect(loadUserData().ratings).toEqual([
      {
        coffeeId: 'coffee-with-bad-data',
        stars: 5,
        flavorTags: ['fruity'],
        note: '',
        ratedAt: '1970-01-01T00:00:00.000Z',
        brew: {
          grind: 'medium',
          waterGrams: 300,
          temperatureCelsius: 0,
          brewTimeSeconds: 180,
        },
      },
    ]);
  });

  it('rejects missing and out-of-range stars instead of clamping them', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ratings: [
          rating({ coffeeId: 'below', stars: -1 }),
          rating({ coffeeId: 'zero', stars: 0 }),
          rating({ coffeeId: 'above', stars: 5.1 }),
          rating({ coffeeId: 'missing', stars: null as unknown as number }),
          rating({ coffeeId: 'one', stars: 1 }),
          rating({ coffeeId: 'five', stars: 5 }),
        ],
      }),
    );

    expect(loadUserData().ratings.map(({ coffeeId, stars }) => ({ coffeeId, stars }))).toEqual([
      { coffeeId: 'one', stars: 1 },
      { coffeeId: 'five', stars: 5 },
    ]);
  });

  it('rejects non-finite stars when sanitizing data before saving', () => {
    saveUserData({
      ratings: [
        rating({ coffeeId: 'nan', stars: Number.NaN }),
        rating({ coffeeId: 'infinity', stars: Number.POSITIVE_INFINITY }),
        rating({ coffeeId: 'valid', stars: 4 }),
      ],
      tasteProfile: null,
    });

    expect(loadUserData().ratings).toEqual([
      rating({ coffeeId: 'valid', stars: 4 }),
    ]);
  });

  it('keeps the newest duplicate rating and the last one when dates tie', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ratings: [
          rating({ stars: 2, note: 'older', ratedAt: '2026-07-17T12:00:00.000Z' }),
          rating({ stars: 5, note: 'newest', ratedAt: '2026-07-19T12:00:00.000Z' }),
          rating({ stars: 3, note: 'middle', ratedAt: '2026-07-18T12:00:00.000Z' }),
          rating({
            coffeeId: 'same-date',
            stars: 4,
            note: 'first',
            ratedAt: '2026-07-18T12:00:00.000Z',
          }),
          rating({
            coffeeId: 'same-date',
            stars: 5,
            note: 'last',
            ratedAt: '2026-07-18T12:00:00.000Z',
          }),
        ],
      }),
    );

    expect(loadUserData().ratings).toEqual([
      rating({ stars: 5, note: 'newest', ratedAt: '2026-07-19T12:00:00.000Z' }),
      rating({
        coffeeId: 'same-date',
        stars: 5,
        note: 'last',
        ratedAt: '2026-07-18T12:00:00.000Z',
      }),
    ]);
  });

  it('caps temperature at 100 while requiring other numeric brew amounts to be positive', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ratings: [
          rating({
            brew: {
              doseGrams: 0,
              waterGrams: -1,
              yieldGrams: 0,
              temperatureCelsius: 140,
              brewTimeSeconds: 0,
            },
          }),
        ],
      }),
    );

    expect(loadUserData().ratings[0].brew).toEqual({
      temperatureCelsius: 100,
    });
  });

  it('round-trips ratings both with and without optional brew details', () => {
    const withBrew = rating({
      coffeeId: 'fixture-kenya',
      brew: {
        method: 'pour-over',
        doseGrams: 18,
        waterGrams: 300,
        yieldGrams: 250,
        temperatureCelsius: 94,
        grind: 'medium-fine',
        brewTimeSeconds: 195,
      },
    });
    const withoutBrew = rating({ coffeeId: 'fixture-colombia', brew: undefined });

    saveUserData({ ratings: [withBrew, withoutBrew], tasteProfile: null });

    const loaded = loadUserData();
    expect(loaded.ratings).toEqual([withBrew, withoutBrew]);
    expect(loaded.ratings[1]).not.toHaveProperty('brew');
  });

  it('replaces an existing rating even when its stored timestamp is in the future', () => {
    saveUserData({
      ratings: [rating({ ratedAt: '2099-01-01T00:00:00.000Z', note: 'Old note' })],
      tasteProfile: null,
    });

    saveRating(rating({ ratedAt: '2026-07-18T13:00:00.000Z', note: 'Updated note' }));

    expect(loadUserData().ratings).toEqual([
      rating({ ratedAt: '2026-07-18T13:00:00.000Z', note: 'Updated note' }),
    ]);
  });

  it('recomputes the taste profile instead of trusting persisted profile data', () => {
    const staleProfile: TasteProfile = {
      tagWeights: { chocolate: 1 },
      topOrigins: ['Brazil'],
      topProcesses: ['natural'],
      topRoastLevels: ['dark'],
      avgRating: 1,
      ratingCount: 99,
    };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ratings: [
          rating({
            stars: 4,
            flavorTags: ['floral', 'citrus'],
          }),
        ],
        tasteProfile: staleProfile,
      }),
    );

    expect(loadUserData().tasteProfile).toEqual({
      tagWeights: { floral: 0.8, citrus: 0.8 },
      topOrigins: ['Ethiopia'],
      topProcesses: ['washed'],
      topRoastLevels: ['light'],
      avgRating: 4,
      ratingCount: 1,
    });
  });
});

describe('Pico journal backup', () => {
  const customCoffee = {
    id: 'custom-abc',
    name: 'Hand-added',
    roaster: 'Corner Roaster',
    origin: 'Unknown',
    process: 'Washed',
    roastLevel: 'light',
    flavorTags: [],
    description: 'Added to your Pico journal.',
    isCustom: true,
  };

  it('restores ratings and hand-added coffees from an export on an empty phone', () => {
    saveRating(rating({ photoDataUrl: 'data:image/jpeg;base64,dGVzdA==' }));
    saveRating(rating({ coffeeId: 'custom-abc', stars: 2 }));
    localStorage.setItem('pico-custom-coffees', JSON.stringify([customCoffee]));
    const backup = exportJournal();

    localStorage.clear();
    expect(importJournal(backup)).toEqual({ ratings: 2, coffees: 1 });

    expect(loadUserData().ratings.map(({ coffeeId }) => coffeeId).sort()).toEqual(['custom-abc', 'fixture-ethiopia']);
    expect(getCoffeeById('custom-abc')?.name).toBe('Hand-added');
    expect(importJournal(backup)).toEqual({ ratings: 0, coffees: 0 });
  });

  it('keeps the newer rating when both the phone and the backup have the coffee', () => {
    saveRating(rating({ coffeeId: 'a', stars: 2, ratedAt: '2026-08-01T00:00:00.000Z' }));
    saveRating(rating({ coffeeId: 'b', stars: 2, ratedAt: '2026-08-01T00:00:00.000Z' }));
    const backup = JSON.stringify({
      ratings: [
        rating({ coffeeId: 'a', stars: 5, ratedAt: '2026-09-01T00:00:00.000Z' }),
        rating({ coffeeId: 'b', stars: 5, ratedAt: '2026-07-01T00:00:00.000Z' }),
        rating({ coffeeId: 'c', photoDataUrl: 'javascript:alert(1)' }),
      ],
      customCoffees: [{ ...customCoffee, id: 'fixture-ethiopia' }],
    });

    expect(importJournal(backup)).toEqual({ ratings: 2, coffees: 0 });
    const stars = Object.fromEntries(loadUserData().ratings.map((r) => [r.coffeeId, r.stars]));
    expect(stars).toEqual({ a: 5, b: 2, c: 4 });
    expect(getRatingForCoffee('c')).not.toHaveProperty('photoDataUrl');
  });

  it('rejects a file that is not a backup and leaves the journal alone', () => {
    saveRating(rating());
    expect(() => importJournal('not json')).toThrow('not a Pico backup');
    expect(() => importJournal('{"ratings":{}}')).toThrow('not a Pico backup');
    expect(loadUserData().ratings).toHaveLength(1);
  });
});
