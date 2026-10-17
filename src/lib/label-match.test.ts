import { describe, expect, it } from 'vitest';
import type { Coffee } from '../types/coffee';
import {
  MATCH_THRESHOLD,
  isRoasterOnlyMatch,
  matchCoffeesFromText,
  normalizeLabelText,
  searchTermsFromText,
} from './label-match';

function coffee(fields: Partial<Coffee> & Pick<Coffee, 'id' | 'name' | 'roaster' | 'origin'>): Coffee {
  return {
    process: 'washed',
    roastLevel: 'light',
    flavorTags: [],
    description: '',
    ...fields,
  };
}

// Label-relevant fields copied from real Copenhagen catalog entries, pinned so
// catalog updates cannot change these expectations.
const catalog: Coffee[] = [
  coffee({ id: 'kieni', name: 'Kieni', roaster: 'Coffee Collective', origin: 'Kenya', region: 'Nyeri', producer: 'Kieni Cooperative', variety: 'SL28, SL34, Batian, Ruiru 11', tastingNotes: ['blackcurrant', 'blackberry', 'rhubarb'] }),
  coffee({ id: 'vista-hermosa', name: 'Vista Hermosa Espresso', roaster: 'Coffee Collective', origin: 'Guatemala', region: 'Huehuetenango', producer: 'Vista Hermosa (Edwin Martinez)', variety: 'Bourbon, Caturra, Catuai', tastingNotes: ['light chocolate', 'vanilla', 'pecan nuts'] }),
  coffee({ id: 'mulugeta', name: 'Mulugeta Anaerobic', roaster: 'Coffee Collective', origin: 'Ethiopia', region: 'Sidama', producer: 'Mulugeta Muntasha', variety: '74-158 Kurume', tastingNotes: ['strawberry candy', 'green apples', 'honeydew melon'] }),
  coffee({ id: 'kamavindi', name: 'Kamavindi AA', roaster: 'April', origin: 'Kenya', producer: 'Peter Mbature (Kamavindi)', variety: 'SL34, SL28 (AA)', tastingNotes: ['blackberries', 'red apple', 'florals'] }),
  coffee({ id: 'tadesse', name: 'Tadesse Natural', roaster: 'April', origin: 'Ethiopia', producer: 'Tadesse Hanka (Tadesse)', variety: 'Krume 74158', tastingNotes: ['peach', 'yellow plum', 'mandarin orange'] }),
  coffee({ id: 'volcan-azul', name: 'Volcan Azul', roaster: 'April', origin: 'Costa Rica', region: 'Alajuela', producer: 'Alejo Castro (Volcan Azul)', variety: 'SL28', tastingNotes: ['florals', 'plum', 'stone fruit'] }),
  coffee({ id: 'kainamui', name: 'Kainamui', roaster: 'La Cabra', origin: 'Kenya', region: 'Kirinyaga', producer: 'New Ngariama FCS', variety: 'SL28, Ruiru 11, Batian' }),
  coffee({ id: 'megadu', name: 'Megadu', roaster: 'La Cabra', origin: 'Ethiopia', region: 'Guji', producer: 'Bette Buna', variety: 'Heirloom' }),
  coffee({ id: 'gicherori', name: 'Kenya Gicherori', roaster: 'Kontra Coffee', origin: 'Kenya', region: 'Embu County (Mount Kenya)', producer: 'Gicherori Factory (Kibugu Farmers Cooperative Society)', variety: 'SL28, SL32' }),
  coffee({ id: 'santa-monica', name: 'Santa Monica', roaster: 'Andersen & Maillard', origin: 'Colombia', region: 'Quindío', producer: 'Jairo Arcila', variety: 'Caturra' }),
  coffee({ id: 'los-angeles', name: 'Los Angeles Pacamara', roaster: 'Andersen & Maillard', origin: 'El Salvador', region: 'Ahuachapán', producer: 'Sigfredo Corado (Finca Los Angeles)', variety: 'Pacamara' }),
  coffee({ id: 'kigari', name: 'Kigari AA', roaster: 'Prolog', origin: 'Kenya', region: 'Meru County', producer: 'Kigari Farmers Cooperative Society', variety: 'Ruiru 11, SL28, Batian' }),
  // Made-up Danish roaster to exercise æ/ø/å folding.
  coffee({ id: 'danish', name: 'Blåbær Mørk', roaster: 'Ønskebrønd Kaffe', origin: 'Brazil', region: 'Sul de Minas' }),
];

const ids = (text: string) => matchCoffeesFromText(text, catalog).map(({ coffee }) => coffee.id);

describe('normalizeLabelText', () => {
  it('lowercases, folds Danish letters and accents, and strips OCR junk', () => {
    expect(normalizeLabelText('  KAFFEBRÆNDERIET  Ørsted\nÅrhus — Quindío™ |;| 250 g ')).toBe(
      'kaffebraenderiet orsted arhus quindio 250 g',
    );
  });
});

describe('matchCoffeesFromText', () => {
  it('finds a coffee from a clean label, explaining what matched', () => {
    const [best] = matchCoffeesFromText(
      'COFFEE COLLECTIVE\nKIENI\nKENYA · NYERI\nSL28 · SL34 · BATIAN\nBlackcurrant, rhubarb\n250 g',
      catalog,
    );

    expect(best.coffee.id).toBe('kieni');
    expect(best.matched.slice(0, 2)).toEqual(['Coffee Collective', 'Kieni']);
    expect(best.matched).toEqual(expect.arrayContaining(['Nyeri', 'Kenya']));
    expect(best.score).toBeGreaterThan(MATCH_THRESHOLD);
  });

  it('tolerates OCR typos: one edit in short words, two in long words', () => {
    expect(ids('C0FFEE CO11ECTIVE\nKIENl\nNyerl')[0]).toBe('kieni');
    expect(ids('kontra\nKenya Gichcrorl')[0]).toBe('gicherori');
  });

  it('does not accept two edits in a short word or any edit in a number', () => {
    expect(ids('Kxexi')).toEqual([]);
    const [kieni] = matchCoffeesFromText('Coffee Collective Kieni SL23', catalog);
    expect(kieni.matched).not.toContain('SL28');
  });

  it('joins words split across lines or run together by OCR', () => {
    expect(ids('LA CABRA\nKAINA-\nMUI\nKirinyaga')[0]).toBe('kainamui');
    expect(ids('LACABRA MEGADU ETHIOPIA')[0]).toBe('megadu');
    expect(ids('coffee collective vista her-\nmosa espresso')[0]).toBe('vista-hermosa');
  });

  it('matches Danish characters and accents whether or not OCR keeps them', () => {
    expect(ids('ØNSKEBRØND KAFFE\nBlåbær Mørk')[0]).toBe('danish');
    expect(ids('ONSKEBROND KAFFE\nBlabaer Mork')[0]).toBe('danish');
    expect(ids('Andersen & Maillard COLOMBIA Quindio Santa Monica')[0]).toBe('santa-monica');
    expect(ids('Andersen & Maillard EL SALVADOR Ahuachapán Pacamara')[0]).toBe('los-angeles');
  });

  it('ranks the coffee with the rarer matching word above shared origin words', () => {
    expect(ids('KENYA\nKIGARI\nMeru')[0]).toBe('kigari');
    expect(ids('Kenya Kenya Kenya Nyeri Kieni')[0]).toBe('kieni');
  });

  it('reads Danish country names on Copenhagen bags', () => {
    const [best] = matchCoffeesFromText('COFFEE COLLECTIVE\nMULUGETA\nProduceret af Mulugeta Muntasha i Sidama, Etiopien', catalog);

    expect(best.coffee.id).toBe('mulugeta');
    expect(best.matched).toContain('Ethiopia');
  });

  it('suggests a coffee from three descriptive fields when no name was read', () => {
    const [best] = matchCoffeesFromText('~ ~ KENYA | NYERI | BATIAN | blackcurrant, rhubarb', catalog);

    expect(best.coffee.id).toBe('kieni');
    expect(best.matched).toEqual(['Nyeri', 'Kenya', 'Batian', 'blackcurrant']);
    expect(isRoasterOnlyMatch(best)).toBe(false);
  });

  it('suggests nothing from common words alone', () => {
    expect(ids('KENYA · WASHED · SL28 · 250 g · filter roast')).toEqual([]);
    expect(ids('Single origin coffee, whole beans')).toEqual([]);
  });

  it("ranks a roaster's coffees on a roaster-only label and says so", () => {
    const matches = matchCoffeesFromText('APRIL\nFILTER\n250 g\nroasted in copenhagen', catalog);

    expect(matches.map(({ coffee }) => coffee.id)).toEqual(['kamavindi', 'tadesse', 'volcan-azul']);
    for (const match of matches) {
      expect(match.matched).toEqual(['April']);
      expect(isRoasterOnlyMatch(match)).toBe(true);
    }
  });

  it('puts the identified coffee above roaster-only suggestions', () => {
    const matches = matchCoffeesFromText('April Coffee Roasters — Volcan Azul, Costa Rica', catalog);

    expect(matches[0].coffee.id).toBe('volcan-azul');
    expect(isRoasterOnlyMatch(matches[0])).toBe(false);
    expect(matches.slice(1).every(isRoasterOnlyMatch)).toBe(true);
  });

  it('identifies a coffee from its producer when the roaster is unreadable', () => {
    expect(ids('~~ Mulugeta Muntasha ~~ Sidama, Ethiopia')[0]).toBe('mulugeta');
  });

  it('returns at most three matches, best first', () => {
    const matches = matchCoffeesFromText('Coffee Collective Kieni Mulugeta Vista Hermosa', catalog);

    expect(matches).toHaveLength(3);
    const scores = matches.map(({ score }) => score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it.each([[''], ['   \n\t'], ['|||| ~~ ;; —— ©'], ['8 7 6 1']])('returns nothing for junk %j', (text) => {
    expect(matchCoffeesFromText(text, catalog)).toEqual([]);
  });

  it('returns nothing for an empty catalog', () => {
    expect(matchCoffeesFromText('Coffee Collective Kieni', [])).toEqual([]);
  });
});

describe('searchTermsFromText', () => {
  it('prefers catalog words, fixing OCR near-misses, and skips generic words', () => {
    expect(searchTermsFromText('FILTER ROAST\nKamavlndi\nwashed coffee\nPeter Mbature', catalog)).toEqual([
      'kamavindi',
      'mbature',
      'peter',
    ]);
  });

  it('keeps unknown words so the user can search what was printed', () => {
    expect(searchTermsFromText('Wonderland Roasters Lychee Bomb', catalog, 2)).toEqual(['wonderland', 'lychee']);
  });
});
