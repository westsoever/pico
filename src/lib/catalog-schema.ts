import {
  FLAVOR_TAGS,
  ROAST_STYLES,
  type Coffee,
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
  if (value.barcode !== undefined && typeof value.barcode !== 'string') problems.push('barcode must be text');
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
