import seedCoffees from '../data/seed-coffees.json';
import { FLAVOR_TAGS, type Coffee, type ManualCoffeeInput } from '../types/coffee';

const CUSTOM_COFFEES_KEY = 'pico-custom-coffees';
const flavorTags = new Set<string>(FLAVOR_TAGS);
const roastLevels = new Set(['light', 'medium', 'dark']);

const seedCatalog: Coffee[] = seedCoffees as Coffee[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isCoffee(value: unknown): value is Coffee {
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
    (value.barcode === undefined || typeof value.barcode === 'string') &&
    value.isCustom === true
  );
}

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
  return [...seedCatalog, ...loadCustomCoffees()];
}

export function getCoffeeById(id: string): Coffee | undefined {
  return getAllCoffees().find((c) => c.id === id);
}

export function getCoffeeByBarcode(barcode: string): Coffee | undefined {
  return getAllCoffees().find((c) => c.barcode === barcode);
}

export function searchCoffees(query: string, limit = 8): Coffee[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return getAllCoffees()
    .filter((coffee) => {
      const haystack = [
        coffee.name,
        coffee.roaster,
        coffee.origin,
        coffee.process,
        coffee.variety,
        coffee.description,
        coffee.scaScore?.toString(),
        ...coffee.flavorTags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    })
    .slice(0, limit);
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
    id: createCustomCoffeeId([...seedCatalog, ...customCoffees]),
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
