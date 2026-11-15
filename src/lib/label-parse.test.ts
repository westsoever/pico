import { describe, expect, it } from 'vitest';
import { draftToCoffee, parseLabel } from './label-parse';

const ROASTERS = [{ roaster: 'Coffee Collective' }, { roaster: 'La Cabra' }, { roaster: 'April' }];

describe('parseLabel', () => {
  it('reads a messy Danish label', () => {
    const text = [
      'COFFEE COLLECTIVE',
      'KØBENHAVN  ~ 250g',
      'Etiopien · Guji',
      'Hambela Wamena',
      'Proces: vasket',
      'Varietet: Heirloom',
      'Lys ristning / Filter',
      'Smagsnoter: jordbær, blåbær & mørk chokolade',
      'Bedst før 03.2027  |\\ ~',
    ].join('\n');
    expect(parseLabel(text, ROASTERS)).toEqual({
      roaster: 'Coffee Collective',
      origin: 'Ethiopia',
      process: 'washed',
      variety: 'Heirloom',
      roastLevel: 'light',
      roastStyle: 'filter',
      tastingNotes: ['strawberry', 'blueberry', 'dark chocolate'],
      flavorTags: ['fruity', 'chocolate', 'berry'],
      fieldCount: 5,
    });
  });

  it('returns null when only a date and weight were read', () => {
    expect(parseLabel('Best before 12.03.2027\nNet weight 250 g\n', ROASTERS)).toBeNull();
  });

  it('does not tag a honey process as caramel', () => {
    const draft = parseLabel('Costa Rica\nHoney process\nNotes: peach, black tea', ROASTERS);
    expect(draft?.process).toBe('honey');
    expect(draft?.tastingNotes).toEqual(['peach', 'black tea']);
    expect(draft?.flavorTags).not.toContain('caramel');
  });

  it('names no origin for a two-country blend', () => {
    const draft = parseLabel('House blend\nBrazil + Colombia\nMedium roast\nNotes: chocolate, hazelnut', ROASTERS);
    expect(draft?.origin).toBeUndefined();
    expect(draft?.roastLevel).toBe('medium');
  });

  it('ignores flavor-looking words outside a notes line', () => {
    const draft = parseLabel('Kenya\nWashed\nBest before date 2027', ROASTERS);
    expect(draft?.flavorTags).toEqual([]);
    expect(draft?.fieldCount).toBe(2);
  });

  it('follows a notes list onto the next line and reads the process outside it', () => {
    // "hindbeer" is how OCR reads "hindbær".
    const draft = parseLabel('Burundi\nProces: vasket\nSmagsnoter: hindbeer,\nappelsin & honning', []);
    expect(draft?.tastingNotes).toEqual(['raspberry', 'orange', 'honey']);
    expect(draft?.process).toBe('washed');
  });

  it('prefers the longer variety phrase', () => {
    expect(parseLabel('Colombia\nPink Bourbon', [])?.variety).toBe('Pink Bourbon');
  });
});

describe('draftToCoffee', () => {
  it('keeps notes and tags, and marks unread fields Unknown', () => {
    const draft = parseLabel('Notes: lemon, jasmine\nLight roast', [])!;
    const coffee = draftToCoffee(draft, { id: 'custom-1', name: ' My bag ', roaster: 'X', roastLevel: 'light' });
    expect(coffee).toMatchObject({ name: 'My bag', origin: 'Unknown', process: 'Unknown', flavorTags: ['floral', 'citrus'], tastingNotes: ['lemon', 'jasmine'], isCustom: true });
  });
});
