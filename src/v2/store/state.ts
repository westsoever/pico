// Pico v2 persisted state: shapes from DATA-MODEL.md, kept on the phone first and synced in the background.
import type { BrewJournal, Coffee, FlavorTag } from '../../types/coffee';
import type { TasteSeed } from '../../lib/taste-profile';

export const STORAGE_KEY = 'pico-v2';
export const PROTOTYPE_KEY = 'pico-proto-v2';
/** userId of rows saved signed out. They move into the account on sign-in or sign-up. */
export const LOCAL_USER_ID = 'local';
/**
 * A coffee shows a community rating only from this many raters. Same number in SQL: public.community_min_raters().
 * Raise to 5 once Pico has 100 users (owner, 2026-11-15).
 */
export const MIN_COMMUNITY_RATERS = 3;

export interface User {
  id: string;
  displayName: string;
  createdAt: string;
}

/** Every synced row. updatedAt is the phone's clock and decides last-write-wins; deletedAt is a soft delete. */
interface Row {
  id: string;
  userId: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface Cup extends Row {
  coffeeId: string;
  stars: number;
  flavorTags: FlavorTag[];
  note: string;
  brew?: BrewJournal;
  ratedAt: string;
}

/** Wishlist entry. id is the coffeeId: one row per user and coffee. */
export interface SavedCoffee extends Row {
  coffeeId: string;
  savedAt: string;
}

/** A coffee added by hand ("custom-<uuid>"), private to its user. */
export type UserCoffee = Row & Omit<Coffee, 'id'> & { sentToPico: boolean };

export type Table = 'cups' | 'saved' | 'userCoffees';
export interface Tables {
  cups: Cup[];
  saved: SavedCoffee[];
  userCoffees: UserCoffee[];
}
export const TABLES: Table[] = ['cups', 'saved', 'userCoffees'];
export type AnyRow = Tables[Table][number];

export interface OutboxEntry {
  table: Table;
  id: string;
}

export interface PersistedState extends Tables {
  version: 1;
  user: User | null;
  scansUsed: number;
  seenWelcome: boolean;
  tasteSeed: TasteSeed | null;
  v1Imported: boolean;
  /** Rows changed on this phone and not yet confirmed by the server. */
  outbox: OutboxEntry[];
  /** Server cursor of the last pull (opaque). */
  lastPulledAt: string | null;
  /** The server session ran out while signed in: data stays, sync pauses, screens ask to sign in again. */
  signInNeeded: boolean;
  /** Last community ratings from the server, kept so a scan shows them offline. Not personal: survives sign-out. */
  communityRatings: Record<string, { average: number; count: number }>;
  communityFetchedAt: string | null;
}

export const EMPTY: PersistedState = {
  version: 1,
  user: null,
  cups: [],
  saved: [],
  userCoffees: [],
  scansUsed: 0,
  seenWelcome: false,
  tasteSeed: null,
  v1Imported: false,
  outbox: [],
  lastPulledAt: null,
  signInNeeded: false,
  communityRatings: {},
  communityFetchedAt: null,
};

export const uid = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

interface PrototypeState {
  cups?: Omit<Cup, 'updatedAt'>[];
  saved?: { coffeeId: string; savedAt: string }[];
  scansUsed?: number;
  seenWelcome?: boolean;
  tasteSeed?: TasteSeed | null;
  v1Imported?: boolean;
}

/**
 * Prototype data (test phones only) becomes signed-out local rows: its fake user is not a real account.
 * Every row goes in the outbox, so it syncs once someone signs in.
 */
export function fromPrototype(p: PrototypeState): PersistedState {
  const cups = (p.cups ?? []).map((c) => ({ ...c, userId: LOCAL_USER_ID, updatedAt: c.ratedAt }));
  const saved = (p.saved ?? []).map((s) => ({
    id: s.coffeeId, userId: LOCAL_USER_ID, coffeeId: s.coffeeId, savedAt: s.savedAt, updatedAt: s.savedAt,
  }));
  return {
    ...EMPTY,
    cups,
    saved,
    scansUsed: p.scansUsed ?? 0,
    seenWelcome: p.seenWelcome ?? false,
    tasteSeed: p.tasteSeed ?? null,
    v1Imported: p.v1Imported ?? false,
    outbox: [...cups.map((c) => ({ table: 'cups' as const, id: c.id })), ...saved.map((s) => ({ table: 'saved' as const, id: s.id }))],
  };
}

export function load(storage: Storage): PersistedState {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      if (parsed.version === 1) return { ...EMPTY, ...parsed };
    }
    const proto = storage.getItem(PROTOTYPE_KEY);
    if (proto) return fromPrototype(JSON.parse(proto) as PrototypeState);
  } catch {
    // Unreadable storage: start empty rather than crash. The old keys are left untouched.
  }
  return EMPTY;
}

/** false when the phone refused the write (storage full, blocked): the store keeps going in memory and flags it. */
export function save(storage: Storage, state: PersistedState): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
