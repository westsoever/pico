// Fake local store for the prototype. Shapes follow DATA-MODEL.md (User, Cup).
// Uses its own key; it only READS v1's `pico-user-data` (for the import screen).
import { useSyncExternalStore } from 'react';
import { getAllCoffees, getCoffeeById } from '../src/lib/catalog';
import { blendTasteSeed, computeTasteProfile, hasTasteSignal } from '../src/lib/taste-profile';
import type { TasteSeed } from '../src/lib/taste-profile';
import type { BrewJournal, Coffee, FlavorTag, Rating, TasteProfile } from '../src/types/coffee';

export const FREE_SCANS = 5;
const KEY = 'pico-proto-v2';
const V1_KEY = 'pico-user-data';

export interface User {
  id: string;
  displayName: string;
  createdAt: string;
}

export interface Cup {
  id: string;
  userId: string;
  coffeeId: string;
  stars: number;
  flavorTags: FlavorTag[];
  note: string;
  brew?: BrewJournal;
  ratedAt: string;
}

/** Wishlist: a coffee the user wants to try. Dropped once they log their first cup of it. */
export interface SavedCoffee {
  userId: string;
  coffeeId: string;
  savedAt: string;
}

export interface ProtoState {
  user: User | null;
  cups: Cup[];
  saved: SavedCoffee[];
  scansUsed: number;
  v1Imported: boolean;
  seenWelcome: boolean;
  /** First-run quiz answers, kept on the phone. null until answered (or skipped: then flavors/roasts are empty). */
  tasteSeed: TasteSeed | null;
  /** SAMPLE DATA: other people's ratings per coffee (their count and mean), seeded by demo states only. */
  communitySeed: Record<string, { average: number; count: number }>;
}

const EMPTY: ProtoState = { user: null, cups: [], saved: [], scansUsed: 0, v1Imported: false, seenWelcome: false, tasteSeed: null, communitySeed: {} };

function load(): ProtoState {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return EMPTY;
  }
}

let state = load();
const listeners = new Set<() => void>();

export function setState(next: Partial<ProtoState>) {
  state = { ...state, ...next };
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // prototype: keep working in memory
  }
  listeners.forEach((l) => l());
}

export function useStore(): ProtoState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

/** userId of cups saved signed out. They move into the account on sign-up. */
export const LOCAL_USER_ID = 'local';

export function signUp(name: string) {
  const user = { id: uid(), displayName: name || 'Coffee friend', createdAt: new Date().toISOString() };
  // Same move as importV1: cups rated on this phone before the account become the account's cups.
  setState({ user, cups: state.cups.map((c) => (c.userId === LOCAL_USER_ID ? { ...c, userId: user.id } : c)) });
}

/** Signed out, cups are kept on the phone under LOCAL_USER_ID. */
export function addCup(coffeeId: string, stars: number, note = '', flavorTags?: FlavorTag[], brew?: BrewJournal) {
  const coffee = getCoffeeById(coffeeId);
  const cup: Cup = {
    id: uid(),
    userId: state.user?.id ?? LOCAL_USER_ID,
    coffeeId,
    stars,
    note,
    flavorTags: flavorTags ?? coffee?.flavorTags ?? [],
    ...(brew ? { brew } : {}),
    ratedAt: new Date().toISOString(),
  };
  const firstCup = !state.cups.some((c) => c.coffeeId === coffeeId);
  setState({
    cups: [cup, ...state.cups],
    // Saved means "not tried yet", so the first cup takes it off the list.
    saved: firstCup ? state.saved.filter((x) => x.coffeeId !== coffeeId) : state.saved,
  });
  return cup;
}

export function updateCup(id: string, patch: Partial<Pick<Cup, 'stars' | 'note' | 'flavorTags' | 'brew'>>) {
  setState({ cups: state.cups.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
}

// shortcut: removes the cup outright; the real store sets Cup.deletedAt so sync can delete it on other devices (Phase B).
export function deleteCup(id: string) {
  setState({ cups: state.cups.filter((c) => c.id !== id) });
}

export const isSaved = (coffeeId: string) => state.saved.some((x) => x.coffeeId === coffeeId);

export function toggleSaved(coffeeId: string) {
  if (!state.user) return;
  setState({
    saved: isSaved(coffeeId)
      ? state.saved.filter((x) => x.coffeeId !== coffeeId)
      : [{ userId: state.user.id, coffeeId, savedAt: new Date().toISOString() }, ...state.saved],
  });
}

export function spendScan(): boolean {
  if (state.user) return true;
  if (state.scansUsed >= FREE_SCANS) return false;
  setState({ scansUsed: state.scansUsed + 1 });
  return true;
}

/** v1 journal on this phone, read only. */
export function readV1Ratings(): Rating[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(V1_KEY) ?? '{}');
    return Array.isArray(parsed.ratings) ? parsed.ratings : [];
  } catch {
    return [];
  }
}

export function importV1(ratings: Rating[]) {
  if (!state.user) return;
  const user = state.user;
  const imported: Cup[] = ratings.map((r) => ({
    id: uid(),
    userId: user.id,
    coffeeId: r.coffeeId,
    stars: r.stars,
    note: r.note ?? '',
    flavorTags: r.flavorTags ?? [],
    ratedAt: r.ratedAt,
  }));
  setState({ cups: [...state.cups, ...imported], v1Imported: true });
}

/** Taste profile from the cup log, reusing the real v1 logic. null until it has real signal. */
export function profileOf(cups: Cup[]): TasteProfile | null {
  const profile = computeTasteProfile(cups);
  return hasTasteSignal(profile) ? profile : null;
}

/** The one taste profile every screen uses: quiz answers + cups. null until there is real signal. */
export function currentProfile(s: ProtoState): TasteProfile | null {
  const profile = blendTasteSeed(s.tasteSeed, computeTasteProfile(s.cups));
  return hasTasteSignal(profile) ? profile : null;
}

/**
 * A coffee's community rating: how many people rated it and the mean of each person's own average.
 * null below 3 raters and for hand-added coffees. The signed-in user counts as one rater; cups saved
 * signed out stay on the phone and don't count. Other raters come from the sample `communitySeed`.
 */
export function communityRating(coffeeId: string): { average: number; count: number } | null {
  if (coffeeId.startsWith('custom-')) return null;
  const others = state.communitySeed[coffeeId] ?? { average: 0, count: 0 };
  const mine = state.user ? state.cups.filter((c) => c.coffeeId === coffeeId && c.userId === state.user?.id) : [];
  const own = mine.length ? mine.reduce((t, c) => t + c.stars, 0) / mine.length : null;
  const count = others.count + (own === null ? 0 : 1);
  if (count < 3) return null;
  return { average: (others.average * others.count + (own ?? 0)) / count, count };
}

/** SAMPLE DATA for demos: ~60% of coffees, 3–40 raters, averages 3.4–4.8, the same on every load (hash of the id). */
function sampleCommunity(): ProtoState['communitySeed'] {
  const seed: ProtoState['communitySeed'] = {};
  for (const c of getAllCoffees()) {
    let h = 7;
    for (const ch of c.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    if (h % 10 >= 6) continue;
    seed[c.id] = { count: 3 + (h % 38), average: 3.4 + ((h >>> 4) % 15) / 10 };
  }
  return seed;
}

export interface CoffeeTotals {
  coffee: Coffee;
  cups: Cup[];
  average: number;
  latest: Cup;
}

/** Per-coffee totals, derived from the log (never stored). */
export function totalsByCoffee(cups: Cup[]): CoffeeTotals[] {
  const groups = new Map<string, Cup[]>();
  for (const cup of cups) groups.set(cup.coffeeId, [...(groups.get(cup.coffeeId) ?? []), cup]);
  return [...groups.entries()]
    .map(([id, list]) => {
      const coffee = getCoffeeById(id);
      if (!coffee) return null;
      const sorted = [...list].sort((a, b) => b.ratedAt.localeCompare(a.ratedAt));
      return {
        coffee,
        cups: sorted,
        average: list.reduce((s, c) => s + c.stars, 0) / list.length,
        latest: sorted[0],
      };
    })
    .filter((x): x is CoffeeTotals => x !== null)
    .sort((a, b) => b.latest.ratedAt.localeCompare(a.latest.ratedAt));
}

// ---------- Demo states (switch with ?state=… or the Proto panel) ----------

function seedCups(userId: string, months: number, perMonth: number): Cup[] {
  const coffees = getAllCoffees().filter((c) => c.imageUrl);
  const cups: Cup[] = [];
  let n = 0;
  const now = new Date();
  for (let m = months - 1; m >= 0; m--) {
    for (let i = 0; i < perMonth; i++) {
      const coffee = coffees[(n * 7 + m * 3) % 18]; // repeats some coffees, so totals show
      const day = new Date(now.getFullYear(), now.getMonth() - m, 1 + ((i * 4) % 27), 8 + (i % 3) * 4);
      if (day > now) continue;
      cups.push({
        id: uid(),
        userId,
        coffeeId: coffee.id,
        stars: [5, 4, 4, 3, 5, 2, 4][n % 7],
        // Notes line up with the stars above: the 2★ cup gets the complaint.
        note: ['', 'Lovely as a V60', '', '', 'Morning favourite', 'Too sour for me', 'Great with milk'][n % 7],
        flavorTags: coffee.flavorTags,
        ratedAt: day.toISOString(),
      });
      n++;
    }
  }
  return cups.sort((a, b) => b.ratedAt.localeCompare(a.ratedAt));
}

export const DEMO_STATES = {
  'first-run': 'First visit, signed out',
  'scans-1': 'Signed out, 1 free scan left',
  'scans-0': 'Signed out, no free scans left',
  'new-user': 'Just signed up, empty journal',
  'regular': 'Signed in, 3 months of cups',
} as const;
export type DemoState = keyof typeof DEMO_STATES;

export function applyDemoState(name: DemoState) {
  const user: User = { id: 'demo-user', displayName: 'Lea', createdAt: '2026-08-01T09:00:00Z' };
  switch (name) {
    case 'first-run':
      return setState({ ...EMPTY });
    case 'scans-1':
      return setState({ ...EMPTY, seenWelcome: true, scansUsed: FREE_SCANS - 1 });
    case 'scans-0':
      return setState({ ...EMPTY, seenWelcome: true, scansUsed: FREE_SCANS });
    case 'new-user':
      return setState({ ...EMPTY, seenWelcome: true, user, v1Imported: true, communitySeed: sampleCommunity() });
    case 'regular': {
      const cups = seedCups(user.id, 3, 9);
      const tried = new Set(cups.map((c) => c.coffeeId));
      const saved = getAllCoffees().filter((c) => c.imageUrl && !tried.has(c.id)).slice(0, 5)
        .map((c, i) => ({ userId: user.id, coffeeId: c.id, savedAt: new Date(Date.now() - (i + 1) * 3 * 86400000).toISOString() }));
      return setState({ ...EMPTY, seenWelcome: true, user, v1Imported: true, cups, saved, communitySeed: sampleCommunity() });
    }
  }
}
