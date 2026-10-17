import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Coffee, ManualCoffeeInput } from '../types/coffee';
import { catalogFixture } from '../test/fixtures/catalog';
import {
  addCustomCoffee,
  getAllCoffees,
  getCoffeeById,
  parseCatalog,
  parseCatalogCoffee,
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

const catalogEntry = {
  id: 'dk-entry',
  name: 'Kieni',
  roaster: 'Coffee Collective',
  roasterCity: 'Copenhagen',
  origin: 'Kenya',
  region: 'Nyeri',
  producer: 'Kieni Factory',
  process: 'washed',
  variety: 'SL28, SL34',
  altitude: '1700–1900 masl',
  roastLevel: 'light',
  roastStyle: 'filter',
  tastingNotes: ['blackcurrant', 'rhubarb'],
  flavorTags: ['berry', 'fruity', 'bright'],
  description: 'Washed Kenyan lot.',
  imageUrl: 'https://example.com/kieni.jpg',
  sourceUrl: 'https://example.com/shop/kieni',
  available: false,
};

describe('bundled catalog validation', () => {
  it('keeps every valid detail field', () => {
    expect(parseCatalogCoffee(catalogEntry)).toEqual(catalogEntry);
  });

  it('omits invalid optional details but keeps the coffee', () => {
    expect(
      parseCatalogCoffee({
        ...catalogEntry,
        roasterCity: '   ',
        region: 42,
        roastStyle: 'cold-brew',
        tastingNotes: ['', 3, ' plum '],
        imageUrl: 'javascript:alert(1)',
        sourceUrl: 'not a url',
        available: 'yes',
      }),
    ).toEqual({
      id: 'dk-entry',
      name: 'Kieni',
      roaster: 'Coffee Collective',
      origin: 'Kenya',
      producer: 'Kieni Factory',
      process: 'washed',
      variety: 'SL28, SL34',
      altitude: '1700–1900 masl',
      roastLevel: 'light',
      tastingNotes: ['plum'],
      flavorTags: ['berry', 'fruity', 'bright'],
      description: 'Washed Kenyan lot.',
    });
    expect(parseCatalogCoffee({ ...catalogEntry, tastingNotes: 'berry' })).not.toHaveProperty(
      'tastingNotes',
    );
  });

  it.each([
    ['a missing name', { ...catalogEntry, name: '' }],
    ['an unknown roast level', { ...catalogEntry, roastLevel: 'burnt' }],
    ['an unknown flavor tag', { ...catalogEntry, flavorTags: ['smoky'] }],
    ['a custom coffee', { ...catalogEntry, isCustom: true }],
    ['a non-object', 'Kieni'],
  ])('drops an entry with %s', (_label, entry) => {
    expect(parseCatalogCoffee(entry)).toBeUndefined();
  });

  it('keeps the first of duplicate ids and ignores a non-array catalog', () => {
    const catalog = parseCatalog([
      catalogEntry,
      { ...catalogEntry, name: 'Duplicate' },
      null,
    ]);

    expect(catalog.map(({ name }) => name)).toEqual(['Kieni']);
    expect(parseCatalog({ coffees: [catalogEntry] })).toEqual([]);
  });

  it('serves the bundled catalog and searches its detail fields', () => {
    expect(getAllCoffees()).toEqual(catalogFixture);
    expect(searchCoffees('Yirgacheffe').map(({ id }) => id)).toEqual(['fixture-ethiopia']);
    expect(searchCoffees('washing station').map(({ id }) => id)).toEqual(['fixture-ethiopia']);
    expect(searchCoffees('jasmine').map(({ id }) => id)).toEqual(['fixture-ethiopia']);
    expect(searchCoffees('copenhagen').map(({ id }) => id)).toEqual([
      'fixture-ethiopia',
      'fixture-kenya',
    ]);
  });

  it('ships a Copenhagen data file whose entries all validate unchanged', async () => {
    const { default: entries } = await vi.importActual<{ default: unknown[] }>(
      '../data/coffees-dk.json',
    );

    expect(entries.length).toBeGreaterThan(0);
    const parsed = parseCatalog(entries);
    expect(parsed).toEqual(entries);
  });
});
