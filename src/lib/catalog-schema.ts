import {
  FLAVOR_TAGS,
  ROAST_STYLES,
  type Coffee,
  type FlavorTag,
  type RoastStyle,
} from '../types/coffee.ts';

// No JSON import here, so scripts/build-catalog.ts can run this file directly with Node.
const flavorTags = new Set<string>(FLAVOR_TAGS);
const roastLevels = new Set(['light', 'medium', 'dark']);
const roastStyles = new Set<string>(ROAST_STYLES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Why an entry cannot be a coffee; empty when every required field is valid. */
export function catalogEntryProblems(value: unknown): string[] {
  if (!isRecord(value)) return ['not an object'];
  const problems: string[] = [];
  for (const field of ['id', 'name', 'roaster', 'origin', 'process'] as const) {
    if (!isNonEmptyString(value[field])) problems.push(`${field} must be non-empty text`);
  }
  if (typeof value.roastLevel !== 'string' || !roastLevels.has(value.roastLevel)) {
    problems.push('roastLevel must be light, medium or dark');
  }
  if (!Array.isArray(value.flavorTags) || !value.flavorTags.every((tag) => typeof tag === 'string' && flavorTags.has(tag))) {
    problems.push(`flavorTags must only use: ${FLAVOR_TAGS.join(', ')}`);
  }
  if (typeof value.description !== 'string') problems.push('description must be text');
  if (value.variety !== undefined && typeof value.variety !== 'string') problems.push('variety must be text');
  if (value.scaScore !== undefined && !(typeof value.scaScore === 'number' && Number.isFinite(value.scaScore))) {
    problems.push('scaScore must be a number');
  }
  return problems;
}

export function hasCoffeeFields(value: unknown): value is Coffee {
  return catalogEntryProblems(value).length === 0;
}

function optionalText(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value.trim() : undefined;
}

function optionalHttpUrl(value: unknown): string | undefined {
  if (!isNonEmptyString(value)) return undefined;
  try {
    const { protocol } = new URL(value.trim());
    return protocol === 'https:' || protocol === 'http:' ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

function optionalTextList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value.filter(isNonEmptyString).map((item) => item.trim());
  return items.length > 0 ? items : undefined;
}

/**
 * Validates one bundled catalog entry. Invalid required fields drop the entry;
 * invalid optional detail fields are omitted so the coffee still shows.
 */
export function parseCatalogCoffee(value: unknown): Coffee | undefined {
  if (!hasCoffeeFields(value) || value.isCustom === true) return undefined;

  const coffee: Coffee = {
    id: value.id,
    name: value.name,
    roaster: value.roaster,
    origin: value.origin,
    process: value.process,
    roastLevel: value.roastLevel,
    variety: value.variety,
    scaScore: value.scaScore,
    flavorTags: value.flavorTags,
    description: value.description,
    roasterCity: optionalText(value.roasterCity),
    region: optionalText(value.region),
    producer: optionalText(value.producer),
    altitude: optionalText(value.altitude),
    roastStyle:
      typeof value.roastStyle === 'string' && roastStyles.has(value.roastStyle)
        ? (value.roastStyle as RoastStyle)
        : undefined,
    tastingNotes: optionalTextList(value.tastingNotes),
    imageUrl: optionalHttpUrl(value.imageUrl),
    sourceUrl: optionalHttpUrl(value.sourceUrl),
    available: typeof value.available === 'boolean' ? value.available : undefined,
  };

  return Object.fromEntries(
    Object.entries(coffee).filter(([, field]) => field !== undefined),
  ) as unknown as Coffee;
}

export function parseCatalog(entries: unknown): Coffee[] {
  if (!Array.isArray(entries)) return [];
  const byId = new Map<string, Coffee>();
  for (const entry of entries) {
    const coffee = parseCatalogCoffee(entry);
    if (coffee && !byId.has(coffee.id)) byId.set(coffee.id, coffee);
  }
  return [...byId.values()];
}

/**
 * Pico's own map from roaster tasting-note words to its 10 flavor tags.
 * Written for Pico (not copied from the SCA/WCR flavor wheel). Words match whole, plurals included.
 */
const NOTE_WORDS: Record<FlavorTag, string[]> = {
  berry: ['berry', 'berries', 'blackberry', 'blackcurrant', 'cassis', 'raspberry', 'strawberry', 'blueberry', 'cranberry', 'redcurrant', 'red currant', 'blackcurrant', 'currant', 'gooseberry', 'lingonberry', 'elderberry', 'boysenberry', 'mulberry', 'forest fruit'],
  citrus: ['citrus', 'lemon', 'lime', 'orange', 'grapefruit', 'bergamot', 'mandarin', 'tangerine', 'clementine', 'yuzu', 'kumquat', 'pomelo'],
  fruity: ['fruit', 'fruity', 'apple', 'pear', 'peach', 'apricot', 'plum', 'nectarine', 'cherry', 'grape', 'raisin', 'fig', 'date', 'prune', 'mango', 'pineapple', 'papaya', 'passion fruit', 'passionfruit', 'lychee', 'melon', 'watermelon', 'banana', 'kiwi', 'guava', 'rhubarb', 'pomegranate', 'tamarind', 'jam', 'tropical', 'cider'],
  floral: ['floral', 'florals', 'flower', 'flowers', 'jasmine', 'rose', 'hibiscus', 'lavender', 'elderflower', 'blossom', 'chamomile', 'honeysuckle', 'violet', 'lilac', 'orange blossom'],
  chocolate: ['chocolate', 'cocoa', 'cacao', 'mocha', 'brownie'],
  nutty: ['nut', 'nuts', 'nutty', 'hazelnut', 'almond', 'pecan', 'walnut', 'peanut', 'cashew', 'macadamia', 'pistachio', 'marzipan', 'praline'],
  caramel: ['caramel', 'toffee', 'brown sugar', 'cane sugar', 'molasses', 'honey', 'maple', 'syrup', 'butterscotch', 'panela', 'fudge', 'dulce de leche', 'vanilla', 'candy', 'candied'],
  spice: ['spice', 'spices', 'spicy', 'cinnamon', 'clove', 'nutmeg', 'cardamom', 'pepper', 'ginger', 'anise', 'licorice', 'liquorice'],
  bright: ['bright', 'juicy', 'tart', 'crisp', 'lively', 'zesty', 'vibrant', 'sparkling', 'acidity', 'black tea'],
  'heavy-body': ['full body', 'full-bodied', 'heavy', 'syrupy', 'creamy', 'velvety', 'round body'],
};

/** Whole words, plurals tolerated: "blackberries" finds "blackberry", "almonds" finds "almond". */
const NOTE_PATTERNS = (Object.entries(NOTE_WORDS) as [FlavorTag, string[]][]).map(([tag, words]) => {
  const stems = words.map((word) => word.replace(/y$/, '(?:y|ie)').replace(/ /g, '[\\s-]+'));
  return [tag, new RegExp(`\\b(?:${stems.join('|')})s?\\b`, 'i')] as const;
});

/** Flavor tags for a coffee from the roaster's tasting notes, in Pico's tag order. */
export function flavorTagsFromNotes(notes: string[]): FlavorTag[] {
  const text = notes.join(' · ');
  const found = new Set(NOTE_PATTERNS.filter(([, pattern]) => pattern.test(text)).map(([tag]) => tag));
  if (found.has('berry')) found.add('fruity');
  return FLAVOR_TAGS.filter((tag) => found.has(tag));
}
