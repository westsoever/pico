import {
  BREW_METHOD_OPTIONS,
  FLAVOR_TAGS,
  GRIND_SIZE_OPTIONS,
  type BrewJournal,
  type BrewMethod,
  type FlavorTag,
  type GrindSize,
  type Rating,
  type UserData,
} from '../types/coffee';
import { loadCustomCoffees, mergeCustomCoffees } from './catalog';
import { computeTasteProfile } from './taste-profile';

const STORAGE_KEY = 'pico-user-data';
const flavorTags = new Set<string>(FLAVOR_TAGS);
const brewMethods = new Set<string>(BREW_METHOD_OPTIONS.map(({ value }) => value));
const grindSizes = new Set<string>(GRIND_SIZE_OPTIONS.map(({ value }) => value));

function emptyUserData(): UserData {
  return {
    ratings: [],
    tasteProfile: null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;
}

function temperature(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(value, 100)
    : undefined;
}

function sanitizeBrewJournal(value: unknown): BrewJournal | undefined {
  if (!isRecord(value)) return undefined;

  const brew: BrewJournal = {};
  if (typeof value.method === 'string' && brewMethods.has(value.method)) {
    brew.method = value.method as BrewMethod;
  }
  if (typeof value.grind === 'string' && grindSizes.has(value.grind)) {
    brew.grind = value.grind as GrindSize;
  }

  brew.doseGrams = positiveNumber(value.doseGrams);
  brew.waterGrams = positiveNumber(value.waterGrams);
  brew.yieldGrams = positiveNumber(value.yieldGrams);
  brew.temperatureCelsius = temperature(value.temperatureCelsius);
  brew.brewTimeSeconds = positiveNumber(value.brewTimeSeconds);

  for (const key of Object.keys(brew) as (keyof BrewJournal)[]) {
    if (brew[key] === undefined) delete brew[key];
  }

  return Object.keys(brew).length > 0 ? brew : undefined;
}

function sanitizeRating(value: unknown): Rating | null {
  if (!isRecord(value) || typeof value.coffeeId !== 'string' || !value.coffeeId.trim()) {
    return null;
  }

  if (
    typeof value.stars !== 'number' ||
    !Number.isFinite(value.stars) ||
    value.stars < 1 ||
    value.stars > 5
  ) {
    return null;
  }
  const stars = value.stars;
  const tags = Array.isArray(value.flavorTags)
    ? value.flavorTags.filter(
        (tag): tag is FlavorTag => typeof tag === 'string' && flavorTags.has(tag),
      )
    : [];
  const ratedAt =
    typeof value.ratedAt === 'string' && !Number.isNaN(Date.parse(value.ratedAt))
      ? value.ratedAt
      : new Date(0).toISOString();

  const rating: Rating = {
    coffeeId: value.coffeeId,
    stars,
    flavorTags: [...new Set(tags)],
    note: typeof value.note === 'string' ? value.note : '',
    ratedAt,
  };

  if (typeof value.photoDataUrl === 'string' && value.photoDataUrl.startsWith('data:image/')) {
    rating.photoDataUrl = value.photoDataUrl;
  }
  const brew = sanitizeBrewJournal(value.brew);
  if (brew) rating.brew = brew;

  return rating;
}

function sanitizeRatings(value: unknown): Rating[] {
  if (!Array.isArray(value)) return [];

  const ratingsByCoffeeId = new Map<string, Rating>();
  for (const candidate of value) {
    const rating = sanitizeRating(candidate);
    if (!rating) continue;

    const existing = ratingsByCoffeeId.get(rating.coffeeId);
    if (
      !existing ||
      Date.parse(rating.ratedAt) >= Date.parse(existing.ratedAt)
    ) {
      ratingsByCoffeeId.set(rating.coffeeId, rating);
    }
  }
  return [...ratingsByCoffeeId.values()];
}

export function loadUserData(): UserData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyUserData();
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return emptyUserData();

    const ratings = sanitizeRatings(parsed.ratings);
    return {
      ratings,
      tasteProfile: computeTasteProfile(ratings),
    };
  } catch {
    return emptyUserData();
  }
}

export function saveUserData(data: UserData): void {
  const ratings = sanitizeRatings(data.ratings);
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ratings,
      tasteProfile: computeTasteProfile(ratings),
    } satisfies UserData),
  );
}

export function saveRating(rating: Rating): UserData {
  const data = loadUserData();
  const ratings = sanitizeRatings([
    ...data.ratings.filter((existing) => existing.coffeeId !== rating.coffeeId),
    rating,
  ]);
  const sanitizedData = {
    ratings,
    tasteProfile: computeTasteProfile(ratings),
  };
  saveUserData(sanitizedData);
  return sanitizedData;
}

export function removeRating(coffeeId: string): void {
  const { ratings } = loadUserData();
  saveUserData({ ratings: ratings.filter((rating) => rating.coffeeId !== coffeeId), tasteProfile: null });
}

/** The whole journal as a JSON backup file: ratings plus the coffees added by hand. */
export function exportJournal(): string {
  return JSON.stringify({
    app: 'pico',
    version: 1,
    exportedAt: new Date().toISOString(),
    ratings: loadUserData().ratings,
    customCoffees: loadCustomCoffees(),
  });
}

/**
 * Merges a backup made by exportJournal into this phone's journal; for a coffee in both,
 * the newer rating wins. Throws on a file that is not a Pico backup, leaving the journal as it was.
 */
export function importJournal(text: string): { ratings: number; coffees: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('This file is not a Pico backup.');
  }
  if (!isRecord(parsed) || !Array.isArray(parsed.ratings)) {
    throw new Error('This file is not a Pico backup.');
  }

  const coffees = mergeCustomCoffees(Array.isArray(parsed.customCoffees) ? parsed.customCoffees : []);
  const existing = loadUserData().ratings;
  // Existing ratings go last so a tie keeps the one already on this phone.
  const ratings = sanitizeRatings([...parsed.ratings, ...existing]);
  const existingRatedAt = new Map(existing.map((rating) => [rating.coffeeId, rating.ratedAt]));
  saveUserData({ ratings, tasteProfile: null });
  return {
    ratings: ratings.filter((rating) => existingRatedAt.get(rating.coffeeId) !== rating.ratedAt).length,
    coffees,
  };
}

export function getRatingForCoffee(coffeeId: string): Rating | undefined {
  return loadUserData().ratings.find((r) => r.coffeeId === coffeeId);
}

export function getRatedCoffeeIds(): string[] {
  return loadUserData().ratings.map((r) => r.coffeeId);
}
