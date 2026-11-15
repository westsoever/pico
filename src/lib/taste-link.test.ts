import { describe, expect, it } from 'vitest';
import type { Coffee, TasteProfile } from '../types/coffee';
import { coffeeForBoth, decodeTaste, encodeTaste, sharedLine, splitLine } from './taste-link';

const profile = (over: Partial<TasteProfile> = {}): TasteProfile => ({
  tagWeights: {}, topOrigins: [], topProcesses: [], topRoastLevels: [], avgRating: 0, ratingCount: 0, ...over,
});

/** A raw payload, to test what a hand-made or tampered link does. */
const raw = (data: unknown) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(data)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const anna = profile({ tagWeights: { fruity: 1, chocolate: 0.8, floral: 0.33 }, topOrigins: ['Ethiopia', 'Kenya'], topProcesses: ['natural'], topRoastLevels: ['light', 'medium'] });

describe('encodeTaste / decodeTaste', () => {
  it('round-trips a profile with weights rounded to ninths', () => {
    const link = encodeTaste(anna, 'Anna');
    expect(link).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(link.length).toBeLessThan(140);
    const back = decodeTaste(link);
    expect(back?.name).toBe('Anna');
    expect(back?.profile.tagWeights).toEqual({ fruity: 1, chocolate: 7 / 9, floral: 3 / 9 });
    expect(back?.profile).toMatchObject({ topOrigins: ['Ethiopia', 'Kenya'], topProcesses: ['natural'], topRoastLevels: ['light', 'medium'] });
  });

  it('keeps non-ASCII names', () => {
    expect(decodeTaste(encodeTaste(anna, 'Søren Ærø'))?.name).toBe('Søren Ærø');
  });

  it('rejects a wrong or missing version (old links)', () => {
    expect(decodeTaste(raw({ v: 2, t: '9000000000' }))).toBeNull();
    expect(decodeTaste(raw({ t: '9000000000' }))).toBeNull();
  });

  it('rejects junk, oversize and non-JSON payloads without throwing', () => {
    for (const bad of ['', '%%%', 'abc', 'x'.repeat(5000), raw('text'), raw([1, 2]), raw(null)]) {
      expect(decodeTaste(bad)).toBeNull();
    }
  });

  it('only accepts one digit 0–9 per known tag, so weights stay within 0..1', () => {
    expect(decodeTaste(raw({ v: 1, t: '9x00000000' }))).toBeNull();
    expect(decodeTaste(raw({ v: 1, t: '90000000000' }))).toBeNull(); // an 11th, unknown tag
    expect(decodeTaste(raw({ v: 1, t: [9, 9] }))).toBeNull();
    const weights = Object.values(decodeTaste(raw({ v: 1, t: '9999999999' }))!.profile.tagWeights);
    expect(weights.every((w) => w >= 0 && w <= 1)).toBe(true);
  });

  it('strips everything but plain text from the name and caps its length', () => {
    const shared = decodeTaste(raw({ v: 1, n: '<img src=x onerror=alert(1)>‮Anna\u0000', t: '9000000000' }));
    expect(shared?.name).toBe('img srcx onerroralert1Anna');
    expect(decodeTaste(raw({ v: 1, n: 'A'.repeat(200), t: '9000000000' }))?.name).toHaveLength(30);
    expect(decodeTaste(raw({ v: 1, n: '<<>>', t: '9000000000' }))?.name).toBe('Your friend');
  });

  it('caps lists, drops unsafe or non-text items and unknown roast codes fail the link', () => {
    const shared = decodeTaste(raw({ v: 1, t: '9000000000', o: ['Kenya', '<b>x</b>', 42, 'Peru', 'Brazil', 'Colombia'], p: ['washed', 'x'.repeat(50)], r: 'lm' }));
    expect(shared?.profile.topOrigins).toEqual(['Kenya', 'Peru', 'Brazil']);
    expect(shared?.profile.topProcesses).toEqual(['washed']);
    expect(shared?.profile.topRoastLevels).toEqual(['light', 'medium']);
    expect(decodeTaste(raw({ v: 1, t: '9000000000', r: 'lz' }))).toBeNull();
  });

  it('rejects a link with no taste in it', () => {
    expect(decodeTaste(raw({ v: 1, n: 'Empty', t: '0000000000' }))).toBeNull();
  });
});

describe('comparing two tastes', () => {
  const me = profile({ tagWeights: { fruity: 1, citrus: 0.9 }, topRoastLevels: ['light'] });

  it('says what both love', () => {
    expect(sharedLine(me, anna)).toBe('You both love fruity, light roasts');
  });

  it('says where they split', () => {
    expect(splitLine(me, anna, 'Anna')).toBe('Anna leans chocolate, you lean citrus');
  });

  it('picks the coffee with the highest lower score of the two', () => {
    const c = (id: string, over: Partial<Coffee>): Coffee => ({ id, name: id, roaster: 'R', origin: 'Kenya', process: 'washed', roastLevel: 'light', flavorTags: [], description: '', ...over });
    const coffees = [
      c('only-me', { flavorTags: ['citrus'] }),
      c('only-anna', { flavorTags: ['chocolate'], roastLevel: 'medium' }),
      c('both', { flavorTags: ['fruity'] }),
      c('gone', { flavorTags: ['fruity'], available: false }),
    ];
    expect(coffeeForBoth(coffees, me, anna)?.coffee.id).toBe('both');
    expect(coffeeForBoth(coffees, me, anna, new Set(['both']))?.coffee.id).not.toBe('both');
  });
});
