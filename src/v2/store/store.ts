// The Pico v2 store: the same synchronous function API the prototype screens use,
// saved on the phone first; sync (engine.ts) moves rows to and from the server in the background.
import { useSyncExternalStore } from 'react';
import { getCoffeeById } from '../../lib/catalog';
import { loadCustomCoffees } from '../../lib/catalog';
import { blendTasteSeed, computeTasteProfile, hasTasteSignal } from '../../lib/taste-profile';
import type { BrewJournal, Coffee, FlavorTag, Rating, TasteProfile } from '../../types/coffee';
import {
  EMPTY, LOCAL_USER_ID, STORAGE_KEY, TABLES, load, save, uid,
  type AnyRow, type Cup, type OutboxEntry, type PersistedState, type Table, type Tables, type User, type UserCoffee,
} from './state';

export const FREE_SCANS = 5;
const V1_KEY = 'pico-user-data';

/** What screens read: the persisted state with soft-deleted rows hidden. */
export type StoreState = PersistedState & {
  /** The last save to this phone failed (storage full or blocked). Data is still in memory; screens say "couldn't save on this phone". */
  saveFailed: boolean;
};

export type CupPatch = Partial<Pick<Cup, 'stars' | 'note' | 'flavorTags' | 'brew'>>;
type PushedEntry = OutboxEntry & { row: AnyRow };
export type SignOutResult = { ok: true } | { ok: false; pending: number };

const visible = <T extends AnyRow>(rows: T[]) => rows.filter((r) => !r.deletedAt);
const now = () => new Date().toISOString();

export function createStore(storage: Storage = localStorage) {
  let data = load(storage);
  let saveFailed = false;
  let view = toView(data);
  const listeners = new Set<() => void>();

  // Another tab or the Home Screen app saved: take its state, so the two don't overwrite each other's cups.
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key !== STORAGE_KEY || e.storageArea !== storage) return;
      data = load(storage);
      view = toView(data);
      listeners.forEach((l) => l());
    });
  }

  function toView(d: PersistedState): StoreState {
    return { ...d, cups: visible(d.cups), saved: visible(d.saved), userCoffees: visible(d.userCoffees), saveFailed };
  }

  function commit(next: PersistedState) {
    data = next;
    saveFailed = !save(storage, next);
    view = toView(next);
    listeners.forEach((l) => l());
  }

  /** Replace or insert rows and queue them for the server. */
  function write<T extends Table>(table: T, rows: Tables[T]) {
    if (rows.length === 0) return;
    // A change must sort after the version it replaces, even within the same millisecond, or last-write-wins drops it.
    const before = new Map((data[table] as AnyRow[]).map((r) => [r.id, r.updatedAt]));
    rows = rows.map((r) => {
      const prev = before.get(r.id);
      return prev && r.updatedAt <= prev ? { ...r, updatedAt: new Date(Date.parse(prev) + 1).toISOString() } : r;
    }) as Tables[T];
    const ids = new Set(rows.map((r) => r.id));
    const queued = new Set(data.outbox.filter((e) => e.table === table).map((e) => e.id));
    commit({
      ...data,
      [table]: [...rows, ...(data[table] as AnyRow[]).filter((r) => !ids.has(r.id))],
      outbox: [...data.outbox, ...rows.filter((r) => !queued.has(r.id)).map((r) => ({ table, id: r.id }))],
    });
  }

  const ownerId = () => data.user?.id ?? LOCAL_USER_ID;

  const store = {
    getState: () => view,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },

    /** Local-only fields (welcome seen, quiz answers, scan count). Synced tables go through the write functions. */
    setState(patch: Partial<Pick<PersistedState, 'seenWelcome' | 'tasteSeed' | 'scansUsed' | 'v1Imported'>>) {
      commit({ ...data, ...patch });
    },

    /** Demo and test seeding only: replaces everything and skips the outbox. */
    replaceState(next: Partial<PersistedState>) {
      commit({ ...EMPTY, ...next });
    },

    /**
     * Signed in (auth.ts calls this). Rows saved signed out move into the account and stay queued,
     * the same for a new account and for signing in to an existing one.
     */
    setUser(user: User) {
      if (data.user && data.user.id !== user.id) throw new Error('Another account is signed in on this phone: sign out first.');
      const rekey = <T extends AnyRow>(rows: T[]) => rows.map((r) => (r.userId === LOCAL_USER_ID ? { ...r, userId: user.id, updatedAt: now() } : r));
      const local = TABLES.flatMap((table) => (data[table] as AnyRow[]).filter((r) => r.userId === LOCAL_USER_ID).map((r) => ({ table, id: r.id })));
      const queued = new Set(data.outbox.map((e) => `${e.table}:${e.id}`));
      commit({
        ...data,
        user,
        cups: rekey(data.cups),
        saved: rekey(data.saved),
        userCoffees: rekey(data.userCoffees),
        outbox: [...data.outbox, ...local.filter((e) => !queued.has(`${e.table}:${e.id}`))],
      });
    },

    /**
     * Sign out. Pushes first; only a fully drained outbox clears the account's data from this phone,
     * so nothing unsynced is lost and the next person on this phone never sees these cups.
     */
    async signOut(sync: () => Promise<void>): Promise<SignOutResult> {
      try {
        await sync();
      } catch {
        // Offline or server error: the check below keeps the data.
      }
      if (data.outbox.length > 0) return { ok: false, pending: data.outbox.length };
      commit({ ...EMPTY, seenWelcome: data.seenWelcome, v1Imported: data.v1Imported });
      return { ok: true };
    },

    addCup(coffeeId: string, stars: number, note = '', flavorTags?: FlavorTag[], brew?: BrewJournal): Cup {
      const at = now();
      const cup: Cup = {
        id: uid(),
        userId: ownerId(),
        coffeeId,
        stars,
        note,
        flavorTags: flavorTags ?? getCoffeeById(coffeeId)?.flavorTags ?? [],
        ...(brew ? { brew } : {}),
        ratedAt: at,
        updatedAt: at,
      };
      write('cups', [cup]);
      // Saved means "not tried yet", so the first cup takes the coffee off the list.
      const wish = view.saved.find((s) => s.coffeeId === coffeeId);
      if (wish && !view.cups.some((c) => c.coffeeId === coffeeId && c.id !== cup.id)) {
        write('saved', [{ ...wish, deletedAt: at, updatedAt: at }]);
      }
      return cup;
    },

    updateCup(id: string, patch: CupPatch) {
      const cup = view.cups.find((c) => c.id === id);
      if (cup) write('cups', [{ ...cup, ...patch, updatedAt: now() }]);
    },

    deleteCup(id: string) {
      const cup = view.cups.find((c) => c.id === id);
      const at = now();
      if (cup) write('cups', [{ ...cup, deletedAt: at, updatedAt: at }]);
    },

    isSaved: (coffeeId: string) => view.saved.some((s) => s.coffeeId === coffeeId),

    /** Saving to the wishlist needs an account (the screens send signed-out users to sign up first). */
    toggleSaved(coffeeId: string) {
      if (!data.user) return;
      const at = now();
      const row = data.saved.find((s) => s.id === coffeeId);
      const on = row && !row.deletedAt;
      write('saved', [on
        ? { ...row, deletedAt: at, updatedAt: at }
        : { id: coffeeId, userId: data.user.id, coffeeId, savedAt: at, updatedAt: at }]);
    },

    addUserCoffee(coffee: Omit<Coffee, 'id'>): UserCoffee {
      const row: UserCoffee = { ...coffee, id: `custom-${uid()}`, userId: ownerId(), sentToPico: false, isCustom: true, updatedAt: now() };
      write('userCoffees', [row]);
      return row;
    },

    spendScan(): boolean {
      if (data.user) return true;
      if (data.scansUsed >= FREE_SCANS) return false;
      commit({ ...data, scansUsed: data.scansUsed + 1 });
      return true;
    },

    /** v1 journal on this phone, read only. */
    readV1Ratings(): Rating[] {
      try {
        const parsed = JSON.parse(storage.getItem(V1_KEY) ?? '{}');
        return Array.isArray(parsed.ratings) ? parsed.ratings : [];
      } catch {
        return [];
      }
    },

    /** v1 ratings become cups (new ids, old ratedAt) and v1 custom coffees keep their ids. Runs once per phone. */
    importV1(ratings: Rating[]) {
      if (data.v1Imported) return;
      const at = now();
      write('cups', ratings.map((r) => ({
        id: uid(), userId: ownerId(), coffeeId: r.coffeeId, stars: r.stars, note: r.note ?? '',
        flavorTags: r.flavorTags ?? [], ...(r.brew ? { brew: r.brew } : {}), ratedAt: r.ratedAt, updatedAt: at,
      })));
      const known = new Set(data.userCoffees.map((c) => c.id));
      write('userCoffees', loadCustomCoffees().filter((c) => !known.has(c.id))
        .map((c) => ({ ...c, userId: ownerId(), sentToPico: false, updatedAt: at })));
      commit({ ...data, v1Imported: true });
    },

    // ----- for the sync engine -----

    /** Rows waiting for the server, read fresh at push time. */
    pending(): { entries: PushedEntry[]; changes: Tables } {
      const changes: Tables = { cups: [], saved: [], userCoffees: [] };
      const entries: PushedEntry[] = [];
      const orphans = new Set<OutboxEntry>();
      for (const e of data.outbox) {
        const row = (data[e.table] as AnyRow[]).find((r) => r.id === e.id);
        if (!row) { orphans.add(e); continue; } // its row is gone: drop the entry, or the outbox never drains
        if (row.userId === LOCAL_USER_ID) continue; // local rows wait for sign-in
        (changes[e.table] as AnyRow[]).push(row);
        entries.push({ ...e, row });
      }
      if (orphans.size > 0) commit({ ...data, outbox: data.outbox.filter((e) => !orphans.has(e)) });
      return { entries, changes };
    },

    /** The server took these rows. An entry stays queued if its row changed again while pushing. */
    confirmPushed(entries: PushedEntry[]) {
      // Rows are never mutated, so "unchanged" is "still the same object" (safe even for two edits in one millisecond).
      const done = new Set(entries.filter((e) => (data[e.table] as AnyRow[]).find((r) => r.id === e.id) === e.row).map((e) => `${e.table}:${e.id}`));
      commit({ ...data, outbox: data.outbox.filter((e) => !done.has(`${e.table}:${e.id}`)) });
    },

    /**
     * Merge rows from the server: the newer updatedAt wins per row (a tombstone wins the same way).
     * shortcut: last-write-wins on each phone's clock, so a phone whose clock runs fast wins ties it shouldn't;
     * fine for one person on a few devices, move to a server-assigned version if accounts get shared.
     */
    applyRemote(changes: Tables, cursor: string) {
      let next = { ...data, lastPulledAt: cursor };
      for (const table of TABLES) {
        const incoming = changes[table] as AnyRow[];
        if (incoming.length === 0) continue;
        const local = new Map((next[table] as AnyRow[]).map((r) => [r.id, r]));
        const won = incoming.filter((r) => { const mine = local.get(r.id); return !mine || r.updatedAt > mine.updatedAt; });
        const wonIds = new Set(won.map((r) => r.id));
        next = {
          ...next,
          [table]: [...won, ...(next[table] as AnyRow[]).filter((r) => !wonIds.has(r.id))],
          // A newer server row replaces an older local edit, so that edit no longer needs pushing.
          outbox: next.outbox.filter((e) => e.table !== table || !wonIds.has(e.id)),
        };
      }
      commit(next);
    },
  };
  return store;
}

export type Store = ReturnType<typeof createStore>;

export function useStoreState(store: Store): StoreState {
  return useSyncExternalStore(store.subscribe, store.getState);
}

/** Taste profile from a cup log, reusing the shared logic. null until it has real signal. */
export function profileOf(cups: Cup[]): TasteProfile | null {
  const profile = computeTasteProfile(cups);
  return hasTasteSignal(profile) ? profile : null;
}

/** The one taste profile every screen uses: quiz answers + cups. null until there is real signal. */
export function currentProfile(s: Pick<StoreState, 'tasteSeed' | 'cups'>): TasteProfile | null {
  const profile = blendTasteSeed(s.tasteSeed, computeTasteProfile(s.cups));
  return hasTasteSignal(profile) ? profile : null;
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
      return { coffee, cups: sorted, average: list.reduce((s, c) => s + c.stars, 0) / list.length, latest: sorted[0] };
    })
    .filter((x): x is CoffeeTotals => x !== null)
    .sort((a, b) => b.latest.ratedAt.localeCompare(a.latest.ratedAt));
}
