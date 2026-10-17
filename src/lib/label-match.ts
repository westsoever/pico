import type { Coffee } from '../types/coffee';

export interface LabelMatch {
  coffee: Coffee;
  score: number;
  /** Catalog values found on the label, most identifying first. */
  matched: string[];
}

export const MATCH_THRESHOLD = 1.5;
const MAX_MATCHES = 3;
const MIN_TOKEN_LENGTH = 3;

/** Words printed on most bags that say nothing about which coffee it is. */
const GENERIC_WORDS = new Set([
  'and', 'the', 'with', 'from', 'for', 'net', 'weight', 'best', 'before',
  'coffee', 'coffees', 'roaster', 'roasters', 'roastery', 'roasted', 'roast',
  'espresso', 'filter', 'omni', 'whole', 'bean', 'beans', 'ground',
  'washed', 'natural', 'honey', 'anaerobic', 'process', 'processed',
  'origin', 'region', 'producer', 'farm', 'variety', 'varieties', 'varietal',
  'altitude', 'masl', 'notes', 'tasting', 'taste', 'harvest', 'lot',
  'station', 'washing', 'factory', 'cooperative', 'society', 'farmers',
  'county', 'kaffe', 'kaffebrenderi', 'ristet', 'smagsnoter', 'noter', 'produceret',
]);

/** Danish country names printed on Copenhagen bags, mapped to catalog spelling. */
const DANISH_ORIGINS: Record<string, string> = {
  etiopien: 'ethiopia',
  brasilien: 'brazil',
  colombien: 'colombia',
  indonesien: 'indonesia',
};

type FieldKey = 'roaster' | 'name' | 'producer' | 'region' | 'origin' | 'variety' | 'tastingNotes';

const FIELD_WEIGHTS: Record<FieldKey, number> = {
  roaster: 3,
  name: 3,
  producer: 1.5,
  region: 1,
  origin: 0.75,
  variety: 0.75,
  tastingNotes: 0.5,
};

const FIELD_ORDER = Object.keys(FIELD_WEIGHTS) as FieldKey[];

/**
 * A suggestion needs one of these, or else this many other fields: origin and
 * variety alone fit too many bags, but origin + variety + notes is telling.
 */
const IDENTIFYING_FIELDS = new Set<FieldKey>(['roaster', 'name', 'producer']);
const MIN_DESCRIPTIVE_FIELDS = 3;

/** Lowercase, fold Danish letters and diacritics, keep only letters and digits. */
export function normalizeLabelText(text: string): string {
  return text
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  const normalized = normalizeLabelText(text);
  return normalized ? normalized.split(' ') : [];
}

function isUsefulToken(token: string): boolean {
  return token.length >= MIN_TOKEN_LENGTH && !GENERIC_WORDS.has(token);
}

/** OCR words plus adjacent pairs run together, to catch words split by a line break. */
function labelTokens(text: string): Set<string> {
  const words = tokenize(text).map((word) => DANISH_ORIGINS[word] ?? word);
  const tokens = new Set(words.filter(isUsefulToken));
  for (let index = 0; index < words.length - 1; index += 1) {
    const joined = words[index] + words[index + 1];
    if (joined.length >= 5) tokens.add(joined);
  }
  return tokens;
}

function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      rowMin = Math.min(rowMin, current[j]);
    }
    if (rowMin > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length];
}

/** 1 for an exact hit, less for an OCR-typo hit, 0 when the word is absent. */
function tokenQuality(catalogToken: string, label: Set<string>): number {
  if (label.has(catalogToken)) return 1;
  if (/\d/.test(catalogToken) || catalogToken.length < 4) return 0;

  const limit = catalogToken.length >= 7 ? 2 : 1;
  let best = 0;
  for (const token of label) {
    const distance = editDistance(catalogToken, token, limit);
    if (distance <= limit) best = Math.max(best, distance === 1 ? 0.85 : 0.7);
  }
  return best;
}

interface FieldPhrase {
  field: FieldKey;
  display: string;
  words: string[];
  /** All words run together, e.g. "lacabra"; only for multi-word values. */
  joined?: string;
}

function fieldValues(coffee: Coffee, field: FieldKey): string[] {
  if (field === 'tastingNotes') return coffee.tastingNotes ?? [];
  if (field === 'variety' || field === 'region') {
    return (coffee[field] ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  }
  const value = coffee[field];
  return value ? [value] : [];
}

function toPhrase(field: FieldKey, display: string): FieldPhrase | undefined {
  const allWords = tokenize(display);
  const words = [...new Set(allWords.filter(isUsefulToken))];
  const joined = allWords.length > 1 ? allWords.join('') : undefined;
  if (words.length === 0 && !joined) return undefined;
  return { field, display, words, joined };
}

function coffeePhrases(coffee: Coffee): FieldPhrase[] {
  return FIELD_ORDER.flatMap((field) =>
    fieldValues(coffee, field).flatMap((display) => toPhrase(field, display) ?? []),
  );
}

/** 0–1 per word: 1 when only one coffee uses it, lower the more coffees share it. */
function rarities(phrasesByCoffee: FieldPhrase[][]): Map<string, number> {
  const coffeeCounts = new Map<string, number>();
  for (const phrases of phrasesByCoffee) {
    for (const word of new Set(phrases.flatMap((phrase) => phrase.words))) {
      coffeeCounts.set(word, (coffeeCounts.get(word) ?? 0) + 1);
    }
  }
  const total = Math.max(phrasesByCoffee.length, 1);
  return new Map(
    [...coffeeCounts].map(([word, count]) => [word, Math.log(1 + total / count) / Math.log(1 + total)]),
  );
}

/** Share of the phrase read on the label (rarer words count more), scaled by rarity. */
function phraseScore(phrase: FieldPhrase, label: Set<string>, rarity: Map<string, number>): number {
  const rarityOf = (word: string) => rarity.get(word) ?? 1;
  const possible = phrase.words.reduce((sum, word) => sum + rarityOf(word), 0);
  let found = 0;
  let rarest = 0;
  for (const word of phrase.words) {
    const quality = tokenQuality(word, label);
    found += rarityOf(word) * quality;
    if (quality > 0) rarest = Math.max(rarest, rarityOf(word));
  }

  let coverage = possible > 0 ? found / possible : 0;
  const joinedQuality = phrase.joined ? tokenQuality(phrase.joined, label) : 0;
  if (joinedQuality > coverage) {
    coverage = joinedQuality;
    rarest = phrase.words.length > 0 ? Math.max(...phrase.words.map(rarityOf)) : 1;
  }

  // A phrase only counts when most of its distinctive words were read.
  if (coverage < 0.5) return 0;
  return coverage * (0.5 + 0.5 * rarest);
}

export function matchCoffeesFromText(text: string, coffees: Coffee[]): LabelMatch[] {
  const label = labelTokens(text);
  if (label.size === 0) return [];

  const phrasesByCoffee = coffees.map(coffeePhrases);
  const rarity = rarities(phrasesByCoffee);

  return coffees
    .map((coffee, index) => {
      const best = new Map<FieldKey, { score: number; display: string }>();
      for (const phrase of phrasesByCoffee[index]) {
        const score = phraseScore(phrase, label, rarity) * FIELD_WEIGHTS[phrase.field];
        const current = best.get(phrase.field);
        if (score > 0 && (!current || score > current.score)) {
          best.set(phrase.field, { score, display: phrase.display });
        }
      }

      const fields = FIELD_ORDER.filter((field) => best.has(field));
      const score = fields.reduce((sum, field) => sum + (best.get(field)?.score ?? 0), 0);
      return {
        coffee,
        index,
        score: Math.round(score * 100) / 100,
        identified:
          fields.some((field) => IDENTIFYING_FIELDS.has(field)) ||
          fields.length >= MIN_DESCRIPTIVE_FIELDS,
        matched: fields.map((field) => best.get(field)?.display ?? ''),
      };
    })
    .filter(({ score, identified }) => identified && score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, MAX_MATCHES)
    .map(({ coffee, score, matched }) => ({ coffee, score, matched }));
}

/** True when the label only told us who roasted it, not which coffee it is. */
export function isRoasterOnlyMatch({ coffee, matched }: LabelMatch): boolean {
  return matched.length === 1 && matched[0] === coffee.roaster;
}

/**
 * Most distinctive words read from the label, for pre-filling search when no
 * suggestion fits. Near-miss OCR spellings of catalog words are corrected.
 */
export function searchTermsFromText(text: string, coffees: Coffee[], limit = 3): string[] {
  const rarity = rarities(coffees.map(coffeePhrases));
  const vocabulary = new Set(rarity.keys());
  const terms: string[] = [];
  for (const word of tokenize(text)) {
    if (!/^[a-z]+$/.test(word) || word.length < 4 || GENERIC_WORDS.has(word)) continue;
    const term = vocabulary.has(word)
      ? word
      : ([...vocabulary].find((known) => known.length >= 4 && editDistance(known, word, 1) <= 1) ?? word);
    if (!terms.includes(term)) terms.push(term);
  }
  return terms
    // Unknown words rank below known ones; rarer known words (a coffee's own name) first.
    .map((term, order) => ({ term, order, rarity: rarity.get(term) ?? -1 }))
    .sort((a, b) => b.rarity - a.rarity || b.term.length - a.term.length || a.order - b.order)
    .slice(0, limit)
    .map(({ term }) => term);
}
