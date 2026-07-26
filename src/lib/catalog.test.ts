import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Coffee, ManualCoffeeInput } from '../types/coffee';
import {
  addCustomCoffee,
  getAllCoffees,
  getCoffeeById,
  searchCoffees,
} from './catalog';

const STORAGE_KEY = 'pico-custom-coffees';

const validCustomCoffee: Coffee = {
  id: 'custom-preserved',
  name: 'Preserved Coffee',
  roaster: 'Pico Test Roaster',
  origin: 'Colombia',
  process: 'washed',
  roastLevel: 'medium',
  variety: 'Caturra',
  scaScore: 86,
  flavorTags: ['caramel', 'citrus'],
  description: 'A valid persisted custom coffee.',
  barcode: '123456789',
  isCustom: true,
};

const manualCoffee: ManualCoffeeInput = {
  name: 'New Coffee',
  roaster: 'New Roaster',
  origin: 'Kenya',
  process: 'washed',
  roastLevel: 'light',
};

describe('custom coffee catalog storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it.each([
    ['malformed JSON', '{"id":'],
    ['an object container', JSON.stringify(validCustomCoffee)],
    ['a primitive container', JSON.stringify('coffee')],
    ['a null container', JSON.stringify(null)],
  ])('treats %s as an empty custom catalog', (_label, storedValue) => {
    localStorage.setItem(STORAGE_KEY, storedValue);

    expect(() => getAllCoffees()).not.toThrow();
    expect(getCoffeeById(validCustomCoffee.id)).toBeUndefined();
    expect(() => searchCoffees('coffee')).not.toThrow();
  });

  it('preserves valid records while discarding malformed records', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        null,
        {},
        { ...validCustomCoffee, id: '' },
        { ...validCustomCoffee, roastLevel: 'burnt' },
        { ...validCustomCoffee, flavorTags: 'citrus' },
        { ...validCustomCoffee, flavorTags: ['not-a-real-tag'] },
        { ...validCustomCoffee, scaScore: '86' },
        validCustomCoffee,
      ]),
    );

    expect(getCoffeeById(validCustomCoffee.id)).toEqual(validCustomCoffee);
    expect(searchCoffees('Preserved Coffee')).toContainEqual(validCustomCoffee);
  });

  it('creates distinct collision-resistant IDs for rapid additions', () => {
    const first = addCustomCoffee(manualCoffee);
    const second = addCustomCoffee(manualCoffee);

    expect(first.id).toMatch(/^custom-/);
    expect(second.id).toMatch(/^custom-/);
    expect(second.id).not.toBe(first.id);
    expect(getCoffeeById(first.id)).toEqual(first);
    expect(getCoffeeById(second.id)).toEqual(second);
  });

  it('avoids an ID collision even if the entropy source repeats', () => {
    const repeatedUuid = '00000000-0000-4000-8000-000000000000';
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(repeatedUuid);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        { ...validCustomCoffee, id: `custom-${repeatedUuid}` },
      ]),
    );

    const added = addCustomCoffee(manualCoffee);

    expect(added.id).toBe(`custom-${repeatedUuid}-1`);
    expect(getCoffeeById(`custom-${repeatedUuid}`)).toBeDefined();
    expect(getCoffeeById(added.id)).toEqual(added);
  });
});
