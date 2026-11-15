import { describe, expect, it } from 'vitest';
import type { Coffee, TasteProfile } from '../types/coffee';
import { coffeeSimilarity, guessStars, lovedTwinLine } from './taste-compare';

const coffee = (id: string, over: Partial<Coffee> = {}): Coffee => ({
  id, name: id, roaster: 'R', origin: 'Kenya', process: 'washed', roastLevel: 'light',
  flavorTags: ['fruity', 'berry'], description: '', ...over,
});

const kieni = coffee('Kieni');
const newKenya = coffee('Gakuyuini', { flavorTags: ['fruity', 'berry', 'chocolate'] });
const brazil = coffee('Brazil', { origin: 'Brazil', process: 'natural', roastLevel: 'dark', flavorTags: ['nutty'] });
const ALL = [kieni, newKenya, brazil];
const profile: TasteProfile = { tagWeights: { fruity: 1 }, topOrigins: [], topProcesses: [], topRoastLevels: [], avgRating: 4, ratingCount: 1 };

describe('lovedTwinLine', () => {
  it('names the loved coffee and one flavor it lacks', () => {
    expect(lovedTwinLine(newKenya, [{ coffeeId: 'Kieni', stars: 5 }], ALL, profile)).toBe('Like the Kieni you loved, with more chocolate.');
  });

  it('falls back to roast when the flavors are the same', () => {
    const darker = coffee('Darker', { roastLevel: 'medium' });
    expect(lovedTwinLine(darker, [{ coffeeId: 'Kieni', stars: 4 }], [...ALL, darker], profile)).toBe('Like the Kieni you loved, roasted darker.');
  });

  it('says nothing when no loved coffee is similar enough', () => {
    expect(lovedTwinLine(brazil, [{ coffeeId: 'Kieni', stars: 5 }], ALL, profile)).toBeNull();
  });

  it('ignores coffees under 4 stars on average and the coffee itself', () => {
    const cups = [{ coffeeId: 'Kieni', stars: 5 }, { coffeeId: 'Kieni', stars: 2 }, { coffeeId: 'Gakuyuini', stars: 5 }];
    expect(lovedTwinLine(newKenya, cups, ALL, profile)).toBeNull();
  });
});

describe('guessStars', () => {
  it('guesses from similar rated coffees', () => {
    const twin = coffee('Twin');
    // Brazil shares nothing with a fruity Kenya, so its 1 star does not pull the guess down.
    const cups = [{ coffeeId: 'Kieni', stars: 4 }, { coffeeId: 'Twin', stars: 4 }, { coffeeId: 'Brazil', stars: 1 }];
    expect(guessStars(newKenya, cups, [...ALL, twin])).toBe(4);
  });

  it('needs 3 other rated coffees', () => {
    expect(guessStars(newKenya, [{ coffeeId: 'Kieni', stars: 5 }, { coffeeId: 'Brazil', stars: 2 }], ALL)).toBeNull();
  });

  it('needs at least one similar rated coffee', () => {
    const other = coffee('Other', { origin: 'Peru', process: 'natural', roastLevel: 'dark', flavorTags: ['spice'] });
    const cups = [{ coffeeId: 'Brazil', stars: 4 }, { coffeeId: 'Other', stars: 4 }, { coffeeId: 'Brazil2', stars: 4 }];
    const brazil2 = coffee('Brazil2', { ...brazil, id: 'Brazil2' });
    expect(guessStars(newKenya, cups, [...ALL, other, brazil2])).toBeNull();
  });

  it('never uses cups of the coffee itself', () => {
    expect(guessStars(kieni, [{ coffeeId: 'Kieni', stars: 5 }, { coffeeId: 'Kieni', stars: 5 }], ALL)).toBeNull();
  });
});

describe('coffeeSimilarity', () => {
  it('is 1 for the same coffee and low for a different one', () => {
    expect(coffeeSimilarity(kieni, kieni)).toBe(1);
    expect(coffeeSimilarity(kieni, brazil)).toBe(0);
  });
});
