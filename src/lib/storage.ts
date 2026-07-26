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

  if (typeof value.photoDataUrl === 'string') rating.photoDataUrl = value.photoDataUrl;
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

export function getRatingForCoffee(coffeeId: string): Rating | undefined {
  return loadUserData().ratings.find((r) => r.coffeeId === coffeeId);
}

export function getRatedCoffeeIds(): string[] {
  return loadUserData().ratings.map((r) => r.coffeeId);
}
