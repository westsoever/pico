import catalogData from '../data/coffees-dk.json';
import type { Coffee, ManualCoffeeInput } from '../types/coffee';
import { hasCoffeeFields, parseCatalog } from './catalog-schema';

export { parseCatalog, parseCatalogCoffee } from './catalog-schema';

const CUSTOM_COFFEES_KEY = 'pico-custom-coffees';

function isCoffee(value: unknown): value is Coffee {
  return hasCoffeeFields(value) && value.isCustom === true;
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
