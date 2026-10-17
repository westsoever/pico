import catalogData from '../data/coffees-dk.json';
import {
  FLAVOR_TAGS,
  ROAST_STYLES,
  type Coffee,
  type ManualCoffeeInput,
  type RoastStyle,
} from '../types/coffee';

const CUSTOM_COFFEES_KEY = 'pico-custom-coffees';
const flavorTags = new Set<string>(FLAVOR_TAGS);
const roastLevels = new Set(['light', 'medium', 'dark']);
const roastStyles = new Set<string>(ROAST_STYLES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasCoffeeFields(value: unknown): value is Coffee {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.roaster) &&
    isNonEmptyString(value.origin) &&
    isNonEmptyString(value.process) &&
    typeof value.roastLevel === 'string' &&
    roastLevels.has(value.roastLevel) &&
    Array.isArray(value.flavorTags) &&
    value.flavorTags.every(
      (tag) => typeof tag === 'string' && flavorTags.has(tag),
    ) &&
    typeof value.description === 'string' &&
    (value.variety === undefined || typeof value.variety === 'string') &&
    (value.scaScore === undefined ||
      (typeof value.scaScore === 'number' && Number.isFinite(value.scaScore))) &&
    (value.barcode === undefined || typeof value.barcode === 'string')
  );
}

function isCoffee(value: unknown): value is Coffee {
  return hasCoffeeFields(value) && value.isCustom === true;
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
    barcode: value.barcode,
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

const catalog: Coffee[] = parseCatalog(catalogData);

function loadCustomCoffees(): Coffee[] {
  try {
    const raw = localStorage.getItem(CUSTOM_COFFEES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const byId = new Map<string, Coffee>();
    for (const candidate of parsed) {
      if (isCoffee(candidate)) byId.set(candidate.id, candidate);
    }
    return [...byId.values()];
  } catch {
    return [];
  }
}

function saveCustomCoffees(coffees: Coffee[]): void {
  localStorage.setItem(CUSTOM_COFFEES_KEY, JSON.stringify(coffees));
}

export function getAllCoffees(): Coffee[] {
  return [...catalog, ...loadCustomCoffees()];
}

export function getCoffeeById(id: string): Coffee | undefined {
  return getAllCoffees().find((c) => c.id === id);
}

export function getCoffeeByBarcode(barcode: string): Coffee | undefined {
  return getAllCoffees().find((c) => c.barcode === barcode);
}

function foldForSearch(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/** Coffees matching any query word, those matching the most words first. */
export function searchCoffees(query: string, limit = 8): Coffee[] {
  const terms = [...new Set(foldForSearch(query).split(/\s+/).filter(Boolean))];
  if (terms.length === 0) return [];

  return getAllCoffees()
    .map((coffee) => {
      const haystack = foldForSearch([
        coffee.name,
        coffee.roaster,
        coffee.roasterCity,
        coffee.origin,
        coffee.region,
        coffee.producer,
        coffee.process,
        coffee.variety,
        coffee.description,
        coffee.scaScore?.toString(),
        ...coffee.flavorTags,
        ...(coffee.tastingNotes ?? []),
      ]
        .filter(Boolean)
        .join(' '));
      return { coffee, hits: terms.filter((term) => haystack.includes(term)).length };
    })
    .filter(({ hits }) => hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, limit)
    .map(({ coffee }) => coffee);
}

export function getCatalogCoffees(excludeIds: string[] = []): Coffee[] {
  const excluded = new Set(excludeIds);
  return getAllCoffees().filter((c) => !excluded.has(c.id));
}

function createCustomCoffeeId(existingCoffees: Coffee[]): string {
  const entropy =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const base = `custom-${entropy}`;
  const existingIds = new Set(existingCoffees.map(({ id }) => id));

  let id = base;
  let suffix = 1;
  while (existingIds.has(id)) {
    id = `${base}-${suffix}`;
    suffix += 1;
  }
  return id;
}

export function addCustomCoffee(input: ManualCoffeeInput): Coffee {
  const customCoffees = loadCustomCoffees();
  const coffee: Coffee = {
    id: createCustomCoffeeId([...catalog, ...customCoffees]),
    name: input.name.trim(),
    roaster: input.roaster.trim(),
    origin: input.origin?.trim() || 'Unknown',
    process: input.process.trim(),
    roastLevel: input.roastLevel,
    variety: input.variety?.trim() || undefined,
    scaScore: input.scaScore,
    flavorTags: [],
    description: 'Added to your Pico journal.',
    isCustom: true,
  };

  customCoffees.push(coffee);
  saveCustomCoffees(customCoffees);

  return coffee;
}

export function removeCustomCoffee(id: string): void {
  const customCoffees = loadCustomCoffees();
  const remaining = customCoffees.filter((coffee) => coffee.id !== id);
  if (remaining.length !== customCoffees.length) {
    saveCustomCoffees(remaining);
  }
}
