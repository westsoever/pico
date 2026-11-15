import { describe, expect, it, vi } from 'vitest';
import { parseCatalog } from './catalog-schema';
import { isPoorRead, pickFromMenu, type MenuItem } from './menu-pick';
import type { TasteProfile } from '../types/coffee';

// The real catalog (setup.ts mocks the JSON import with 4 coffees): menu reading depends on how rare each word is.
const coffees = parseCatalog((await vi.importActual<{ default: unknown }>('../data/coffees-dk.json')).default);
const fruity: TasteProfile = { tagWeights: { fruity: 1, berry: 1 }, topOrigins: ['Kenya'], topProcesses: ['washed'], topRoastLevels: ['light'], avgRating: 4, ratingCount: 3 };
const chocolate: TasteProfile = { tagWeights: { chocolate: 1, nutty: 1 }, topOrigins: ['Guatemala'], topProcesses: [], topRoastLevels: ['medium'], avgRating: 4, ratingCount: 3 };
const ids = (items: MenuItem[]) => items.map((item) => (item.kind === 'catalog' ? item.coffee.id : `draft:${item.title}`));

const MENU = [
  'FILTER TODAY',
  '',
  'Coffee Collective Kieni',
  'Kenya - blackcurrant, rhubarb   45 kr',
  '',
  'Coffee Collective Vista Hermosa Espresso',
  'Guatemala · chocolate, pecan   40 kr',
  '',
  'Guest: Burundi Kayanza',
  'Washed · Red Bourbon',
  'Notes: raspberry, orange   50 kr',
].join('\n');

describe('pickFromMenu', () => {
  it('finds catalog coffees and sketches the unknown one, best for you first', () => {
    expect(ids(pickFromMenu(MENU, coffees, fruity))).toEqual([
      'coffee-collective-kieni', 'draft:Guest: Burundi Kayanza', 'coffee-collective-vista-hermosa-espresso',
    ]);
    expect(ids(pickFromMenu(MENU, coffees, chocolate))[0]).toBe('coffee-collective-vista-hermosa-espresso');
  });

  it('keeps menu order and gives no score without a profile', () => {
    const items = pickFromMenu(MENU, coffees, null);
    expect(ids(items)).toEqual(['coffee-collective-kieni', 'coffee-collective-vista-hermosa-espresso', 'draft:Guest: Burundi Kayanza']);
    expect(items.every((item) => item.score === null)).toBe(true);
  });

  it('splits a shelf with several coffees on one block by line', () => {
    const shelf = 'La Cabra Megadu\nApril Tadesse Natural\nProlog Kigari AA';
    expect(ids(pickFromMenu(shelf, coffees, null))).toEqual(['la-cabra-megadu', 'april-tadesse-natural', 'prolog-kigari-aa']);
  });

  it('splits items at prices when OCR drops the blank lines', () => {
    const ocr = MENU.replace(/\n\n/g, '\n') + '\nCappuccino 38 kr\nCroissant 25 kr';
    expect(ids(pickFromMenu(ocr, coffees, null))).toEqual([
      'coffee-collective-kieni', 'coffee-collective-vista-hermosa-espresso', 'draft:Guest: Burundi Kayanza',
    ]);
  });

  it('keeps a named coffee’s description when OCR puts a blank line inside it', () => {
    const ocr = 'La Cabra Megadu\n\nEthiopia - natural - blackberry jam   48 kr\n\nGuest: Burundi Kayanza\nWashed - Red Bourbon\nNotes: raspberry, orange   50 kr';
    expect(ids(pickFromMenu(ocr, coffees, null))).toEqual(['la-cabra-megadu', 'draft:Guest: Burundi Kayanza']);
  });

  it('lists a coffee only once', () => {
    expect(pickFromMenu('Kieni Coffee Collective\n\nCoffee Collective Kieni', coffees, null)).toHaveLength(1);
  });

  it('skips blocks with too little to go on', () => {
    expect(pickFromMenu('Cappuccino 38 kr\n\nCroissant 25 kr', coffees, fruity)).toEqual([]);
  });
});

describe('isPoorRead', () => {
  it('flags low confidence or too few words', () => {
    expect(isPoorRead({ text: 'Coffee Collective Kieni Kenya', confidence: 30 })).toBe(true);
    expect(isPoorRead({ text: 'a ~ |', confidence: 90 })).toBe(true);
    expect(isPoorRead({ text: 'Coffee Collective Kieni Kenya', confidence: 85 })).toBe(false);
  });
});
