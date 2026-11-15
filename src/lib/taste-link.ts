import { FLAVOR_TAG_LABELS, FLAVOR_TAGS, ROAST_LEVEL_LABELS } from '../types/coffee';
import type { Coffee, FlavorTag, RoastLevel, TasteProfile } from '../types/coffee';
import { scoreSimilarity } from './similarity';

/**
 * A taste profile small enough for a link: no backend, the whole profile rides in the URL hash.
 * Version 1: { v: 1, n: name, t: one digit 0–9 per flavor tag in FLAVOR_TAGS order, o: origins, p: processes, r: roasts as "l"/"m"/"d" }.
 */
export interface SharedTaste {
  name: string;
  profile: TasteProfile;
}

const VERSION = 1;
const MAX_PAYLOAD = 1200;
const MAX_NAME = 30;
const MAX_LIST = 3;
const ROAST_CODES: Record<RoastLevel, string> = { light: 'l', medium: 'm', dark: 'd' };
const ROAST_BY_CODE = Object.fromEntries(Object.entries(ROAST_CODES).map(([level, code]) => [code, level as RoastLevel]));
/** Origins and processes: letters, spaces and a few marks only ("Costa Rica", "wet-hulled"). */
const SAFE_WORD = /^[\p{L} .'-]{1,30}$/u;

function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): string {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}

/** Plain text only (letters, digits, space, . ' -), spaces collapsed, at most MAX_NAME characters. */
function cleanName(value: unknown): string {
  if (typeof value !== 'string') return '';
  const plain = value.normalize('NFC').replace(/[^\p{L}\p{N} .'-]/gu, '').replace(/\s+/g, ' ').trim();
  return [...plain].slice(0, MAX_NAME).join('').trim();
}

const cleanList = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && SAFE_WORD.test(item)))].slice(0, MAX_LIST) : [];

export function encodeTaste(profile: TasteProfile, name: string): string {
  return toBase64Url(JSON.stringify({
    v: VERSION,
    n: cleanName(name),
    t: FLAVOR_TAGS.map((tag) => Math.round(Math.min(1, Math.max(0, profile.tagWeights[tag] ?? 0)) * 9)).join(''),
    o: profile.topOrigins.slice(0, MAX_LIST),
    p: profile.topProcesses.slice(0, MAX_LIST),
    r: profile.topRoastLevels.slice(0, MAX_LIST).map((level) => ROAST_CODES[level]).join(''),
  }));
}

/** The link's taste, or null for anything that is not a valid version-1 payload. Never throws. */
export function decodeTaste(payload: string): SharedTaste | null {
  if (!payload || payload.length > MAX_PAYLOAD || !/^[A-Za-z0-9_-]+$/.test(payload)) return null;
  let data: unknown;
  try {
    data = JSON.parse(fromBase64Url(payload));
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const { v, n, t, o, p, r } = data as Record<string, unknown>;
  if (v !== VERSION || typeof t !== 'string' || !new RegExp(`^[0-9]{${FLAVOR_TAGS.length}}$`).test(t)) return null;

  const tagWeights: Partial<Record<FlavorTag, number>> = {};
  FLAVOR_TAGS.forEach((tag, index) => {
    const digit = Number(t[index]);
    if (digit > 0) tagWeights[tag] = digit / 9;
  });
  const roasts = typeof r === 'string' ? [...new Set([...r.slice(0, MAX_LIST)].map((code) => ROAST_BY_CODE[code]))] : [];
  if (roasts.some((level) => !level)) return null;
  const profile: TasteProfile = {
    tagWeights,
    topOrigins: cleanList(o),
    topProcesses: cleanList(p),
    topRoastLevels: roasts,
    avgRating: 0,
    ratingCount: 0,
  };
  const empty = Object.keys(tagWeights).length === 0 && profile.topOrigins.length === 0 && roasts.length === 0;
  return empty ? null : { name: cleanName(n) || 'Your friend', profile };
}

const LIKED = 0.5;
const label = (tag: FlavorTag) => FLAVOR_TAG_LABELS[tag].toLowerCase();
const liked = (profile: TasteProfile) =>
  (Object.entries(profile.tagWeights) as [FlavorTag, number][]).filter(([, weight]) => weight >= LIKED).sort((a, b) => b[1] - a[1]).map(([tag]) => tag);

/** "You both love fruity and floral, light roasts", or null when nothing is shared. */
export function sharedLine(mine: TasteProfile, theirs: TasteProfile): string | null {
  const theirTags = new Set(liked(theirs));
  const flavors = liked(mine).filter((tag) => theirTags.has(tag)).slice(0, 2).map(label);
  const roast = mine.topRoastLevels[0] && mine.topRoastLevels[0] === theirs.topRoastLevels[0]
    ? `${ROAST_LEVEL_LABELS[mine.topRoastLevels[0]].toLowerCase()} roasts` : '';
  const parts = [flavors.join(' and '), roast].filter(Boolean);
  return parts.length ? `You both love ${parts.join(', ')}` : null;
}

/** "Anna leans chocolate, you lean citrus": each side's favorite flavor the other doesn't share. */
export function splitLine(mine: TasteProfile, theirs: TasteProfile, name: string): string | null {
  const myTags = liked(mine);
  const theirTags = liked(theirs);
  const theirOwn = theirTags.find((tag) => !myTags.includes(tag));
  const myOwn = myTags.find((tag) => !theirTags.includes(tag));
  if (theirOwn && myOwn) return `${name} leans ${label(theirOwn)}, you lean ${label(myOwn)}`;
  if (theirOwn) return `${name} also loves ${label(theirOwn)}`;
  if (myOwn) return `You also love ${label(myOwn)}`;
  return null;
}

/** The coffee both would like most: highest of the lower of the two match scores. */
export function coffeeForBoth(
  coffees: Coffee[],
  mine: TasteProfile,
  theirs: TasteProfile,
  excludeIds: Set<string> = new Set(),
): { coffee: Coffee; mine: number; theirs: number } | null {
  let best: { coffee: Coffee; mine: number; theirs: number } | null = null;
  for (const coffee of coffees) {
    if (excludeIds.has(coffee.id) || coffee.available === false) continue;
    const scores = { coffee, mine: scoreSimilarity(coffee, mine), theirs: scoreSimilarity(coffee, theirs) };
    if (!best || Math.min(scores.mine, scores.theirs) > Math.min(best.mine, best.theirs)) best = scores;
  }
  return best;
}
